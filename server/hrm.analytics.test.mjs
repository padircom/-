/**
 * آزمون موتور تحلیل، هیستوگرام و گزارش — HRM D8.
 *
 * محور: لایهٔ تحلیلی نباید «نمی‌دانیم» را به صفر ترجمه کند. هر جا مخرج
 * صفر است باید `null` برگردد و دلیلش گفته شود، وگرنه مدیر عدد سبز
 * می‌بیند و خیالش راحت می‌شود.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  HISTOGRAM_VARIANCE_THRESHOLD,
  HR_KPI_CODES,
  HR_KPI_FA,
  HR_KPI_TARGETS,
  hrAnalyticsAlerts,
  hrHeadlineFa,
  hrKpiSet,
  manpowerHistogram,
  manpowerSCurve,
  mhBreakdown,
  workingDaysInPeriod,
  capacityMh,
} from "./hrmLogic.js";

/* ══════════ ۱. هیستوگرام ══════════ */

const BARS_IN = [
  { periodCode: "2026-03", plannedMh: 1000, directMh: 900, subMh: 100, plannedHeadcount: 10, actualHeadcount: 11 },
  { periodCode: "2026-01", plannedMh: 500, directMh: 480, subMh: 0, plannedHeadcount: 5, actualHeadcount: 5 },
  { periodCode: "2026-02", plannedMh: 800, directMh: 600, subMh: 0, plannedHeadcount: 8, actualHeadcount: 6 },
];

test("هیستوگرام بر اساس دوره مرتب می‌شود", () => {
  const h = manpowerHistogram(BARS_IN);
  assert.deepEqual(h.bars.map((b) => b.periodCode), ["2026-01", "2026-02", "2026-03"]);
});

test("ساعت پیمانکاری در جمع هست ولی جدا هم قابل خواندن است", () => {
  /* دو مسیر هزینهٔ متفاوت؛ در یک ستون نشستن یعنی گم شدن مرز. */
  const h = manpowerHistogram(BARS_IN);
  const mar = h.bars.find((b) => b.periodCode === "2026-03");
  assert.equal(mar.directMh, 900);
  assert.equal(mar.subMh, 100);
  assert.equal(mar.actualMh, 1000);
  assert.equal(h.totals.subMh, 100);
  assert.equal(h.totals.directMh, 1980);
});

test("سه وضعیت انحراف با آستانهٔ ده درصد تفکیک می‌شوند", () => {
  const h = manpowerHistogram(BARS_IN);
  assert.equal(h.bars.find((b) => b.periodCode === "2026-03").status, "on_track", "۰٪ انحراف");
  assert.equal(h.bars.find((b) => b.periodCode === "2026-02").status, "under", "۲۵٪ کسری");
  assert.equal(h.bars.find((b) => b.periodCode === "2026-01").status, "on_track", "۴٪ انحراف");
  assert.equal(HISTOGRAM_VARIANCE_THRESHOLD, 10);
});

test("مرز آستانه دقیق است", () => {
  const at = manpowerHistogram([{ periodCode: "P", plannedMh: 100, directMh: 110 }]);
  assert.equal(at.bars[0].variancePct, 10);
  assert.equal(at.bars[0].status, "on_track", "دقیقاً روی آستانه هنوز مطابق است");

  const over = manpowerHistogram([{ periodCode: "P", plannedMh: 100, directMh: 110.5 }]);
  assert.equal(over.bars[0].status, "over");
});

test("دورهٔ بدون برنامه انحراف ندارد، نه اینکه انحرافش صفر باشد", () => {
  /* صفر یعنی «مطابق برنامه» که دروغ است وقتی برنامه‌ای وجود ندارد. */
  const h = manpowerHistogram([{ periodCode: "2026-04", directMh: 700 }]);
  assert.equal(h.bars[0].plannedMh, null);
  assert.equal(h.bars[0].variancePct, null);
  assert.equal(h.bars[0].status, "no_plan");
  assert.equal(h.totals.variancePct, null);
  assert.equal(h.totals.periodsWithoutPlan, 1);
});

test("برنامهٔ صفر با نبود برنامه یکی نیست", () => {
  const h = manpowerHistogram([{ periodCode: "P", plannedMh: 0, directMh: 50 }]);
  assert.equal(h.bars[0].plannedMh, 0);
  assert.equal(h.bars[0].variancePct, null, "تقسیم بر صفر ⇒ نامعلوم");
  assert.equal(h.bars[0].status, "no_plan");
});

test("انحراف کل فقط از دوره‌های دارای برنامه حساب می‌شود", () => {
  /* اگر دورهٔ بی‌برنامه در صورت می‌آمد، انحراف کل باد می‌کرد. */
  const h = manpowerHistogram([
    { periodCode: "P1", plannedMh: 100, directMh: 120 },
    { periodCode: "P2", directMh: 5000 },
  ]);
  assert.equal(h.totals.plannedMh, 100);
  assert.equal(h.totals.actualMh, 5120, "جمع واقعی همه را می‌شمارد");
  assert.equal(h.totals.variancePct, 20, "ولی انحراف فقط از P1");
  assert.equal(h.totals.periodsWithPlan, 1);
});

test("دورهٔ اوج شناسایی می‌شود", () => {
  const h = manpowerHistogram(BARS_IN);
  assert.equal(h.totals.peakPeriod, "2026-03");
  assert.equal(h.totals.peakMh, 1000);
});

test("هیستوگرام خالی امن است و اوج ندارد", () => {
  const h = manpowerHistogram([]);
  assert.deepEqual(h.bars, []);
  assert.equal(h.totals.actualMh, 0);
  assert.equal(h.totals.plannedMh, null);
  assert.equal(h.totals.peakPeriod, null);
});

test("دوره‌ای که ساعتی ندارد اوج شمرده نمی‌شود", () => {
  const h = manpowerHistogram([{ periodCode: "P", plannedMh: 100, directMh: 0 }]);
  assert.equal(h.totals.peakPeriod, null, "صفر ساعت اوج نیست");
});

test("سرشماری برنامه و واقعی جدا نگه داشته می‌شوند", () => {
  const h = manpowerHistogram(BARS_IN);
  const feb = h.bars.find((b) => b.periodCode === "2026-02");
  assert.equal(feb.plannedHeadcount, 8);
  assert.equal(feb.actualHeadcount, 6);
  const none = manpowerHistogram([{ periodCode: "P", directMh: 10 }]);
  assert.equal(none.bars[0].actualHeadcount, null, "بدون داده null نه صفر");
});

/* ══════════ ۲. منحنی S ══════════ */

test("تجمع برنامه و واقعی درست انباشته می‌شود", () => {
  const h = manpowerHistogram(BARS_IN);
  const s = manpowerSCurve(h.bars);
  assert.equal(s.points.length, 3);
  assert.equal(s.points[0].cumActualMh, 480);
  assert.equal(s.points[1].cumActualMh, 1080);
  assert.equal(s.points[2].cumActualMh, 2080);
  assert.equal(s.points[2].cumPlannedMh, 2300);
  assert.equal(s.totalPlannedMh, 2300);
  assert.equal(s.hasBaseline, true);
});

test("درصد تجمعی بر مبنای کل برنامه است نه کل واقعی", () => {
  /* اگر مخرج واقعی بود، پروژه‌ای که نصف کار را کرده همیشه ۱۰۰٪ نشان
   * می‌داد و منحنی بی‌معنا می‌شد. */
  const h = manpowerHistogram([
    { periodCode: "P1", plannedMh: 100, directMh: 50 },
    { periodCode: "P2", plannedMh: 100, directMh: 50 },
  ]);
  const s = manpowerSCurve(h.bars);
  assert.equal(s.points[1].cumPlannedPct, 100);
  assert.equal(s.points[1].cumActualPct, 50, "نصف کار یعنی ۵۰٪ نه ۱۰۰٪");
  assert.equal(s.points[1].deltaPct, -50);
});

test("عقب‌افتادگی منفی و جلوافتادگی مثبت است", () => {
  const behind = manpowerSCurve(manpowerHistogram([{ periodCode: "P", plannedMh: 100, directMh: 80 }]).bars);
  assert.ok(behind.points[0].deltaPct < 0);
  const ahead = manpowerSCurve(manpowerHistogram([{ periodCode: "P", plannedMh: 100, directMh: 120 }]).bars);
  assert.ok(ahead.points[0].deltaPct > 0);
});

test("بدون برنامهٔ مبنا، منحنی فقط روند واقعی است", () => {
  const h = manpowerHistogram([{ periodCode: "P1", directMh: 100 }, { periodCode: "P2", directMh: 200 }]);
  const s = manpowerSCurve(h.bars);
  assert.equal(s.hasBaseline, false);
  assert.equal(s.totalPlannedMh, null);
  assert.equal(s.points[1].cumActualMh, 300, "روند واقعی همچنان هست");
  assert.equal(s.points[1].cumActualPct, null, "ولی درصد بی‌معناست");
  assert.equal(s.points[1].deltaPct, null);
});

test("منحنی خالی امن است", () => {
  const s = manpowerSCurve([]);
  assert.deepEqual(s.points, []);
  assert.equal(s.hasBaseline, false);
});

/* ══════════ ۳. شاخص‌های کلیدی ══════════ */

const KPI_FULL = {
  activeHeadcount: 120,
  periodStartHeadcount: 100,
  leaversInPeriod: 4,
  compliantCount: 114,
  totalPeople: 120,
  availableHours: 20000,
  chargedHours: 18000,
  otHours: 1800,
  totalHours: 20000,
  subMh: 6000,
  directMh: 14000,
};

test("شش شاخص با ترجمهٔ فارسی برمی‌گردند", () => {
  const k = hrKpiSet(KPI_FULL);
  assert.equal(k.length, 6);
  assert.equal(HR_KPI_CODES.length, 6);
  for (const c of HR_KPI_CODES) {
    assert.ok(HR_KPI_FA[c], `ترجمهٔ ${c} نیست`);
    assert.ok(k.some((x) => x.code === c), `${c} در خروجی نیست`);
    assert.ok(HR_KPI_TARGETS[c], `آستانهٔ ${c} نیست`);
  }
  assert.ok(k.every((x) => x.nameFa && x.nameFa.length > 2));
});

test("مقادیر شاخص‌ها درست محاسبه می‌شوند", () => {
  const k = hrKpiSet(KPI_FULL);
  const v = (c) => k.find((x) => x.code === c).value;
  assert.equal(v("HEADCOUNT"), 120);
  assert.equal(v("TURNOVER_PCT"), 4);
  assert.equal(v("COMPLIANCE_PCT"), 95);
  assert.equal(v("UTILIZATION_PCT"), 90);
  assert.equal(v("OT_PCT"), 9);
  assert.equal(v("SUB_SHARE_PCT"), 30);
});

test("جهت خوب بودن هر شاخص رعایت می‌شود", () => {
  /* بالا بودن انطباق خوب است، بالا بودن گردش نیرو بد. */
  const good = hrKpiSet(KPI_FULL);
  assert.equal(good.find((x) => x.code === "COMPLIANCE_PCT").status, "green");
  assert.equal(good.find((x) => x.code === "TURNOVER_PCT").status, "green");

  const bad = hrKpiSet({ ...KPI_FULL, leaversInPeriod: 15, compliantCount: 60 });
  assert.equal(bad.find((x) => x.code === "TURNOVER_PCT").status, "red", "۱۵٪ گردش بد است");
  assert.equal(bad.find((x) => x.code === "COMPLIANCE_PCT").status, "red", "۵۰٪ انطباق بد است");
});

test("حالت زرد میان هدف و آستانهٔ بحرانی است", () => {
  const amber = hrKpiSet({ ...KPI_FULL, compliantCount: 108 });
  assert.equal(amber.find((x) => x.code === "COMPLIANCE_PCT").value, 90);
  assert.equal(amber.find((x) => x.code === "COMPLIANCE_PCT").status, "amber");
});

test("مخرج صفر ⇒ null با دلیل صریح، نه صفر", () => {
  /* تبدیل «نمی‌دانیم» به صفر بدترین کار یک داشبورد است. */
  const k = hrKpiSet({ activeHeadcount: 0 });
  for (const c of ["TURNOVER_PCT", "COMPLIANCE_PCT", "UTILIZATION_PCT", "OT_PCT", "SUB_SHARE_PCT"]) {
    const x = k.find((y) => y.code === c);
    assert.equal(x.value, null, `${c} باید null باشد`);
    assert.equal(x.status, "na");
    assert.ok(x.caveatFa && x.caveatFa.length > 5, `${c} باید دلیل داشته باشد`);
  }
});

test("شاخص سالم توضیح اضافه ندارد", () => {
  const k = hrKpiSet(KPI_FULL);
  assert.equal(k.find((x) => x.code === "COMPLIANCE_PCT").caveatFa, null);
});

test("سرشماری نامعلوم با سرشماری صفر یکی نیست", () => {
  /* «صفر نفر» ادعایی دربارهٔ واقعیت است؛ «نمی‌دانیم» اعتراف به نبود
   * داده. داشبوردی که این دو را یکی کند دروغ می‌گوید. */
  const zero = hrKpiSet({ activeHeadcount: 0 });
  assert.equal(zero.find((x) => x.code === "HEADCOUNT").value, 0);
  assert.equal(zero.find((x) => x.code === "HEADCOUNT").caveatFa, null);

  const unknown = hrKpiSet({ activeHeadcount: null });
  const hc = unknown.find((x) => x.code === "HEADCOUNT");
  assert.equal(hc.value, null);
  assert.equal(hc.status, "na");
  assert.ok(hc.caveatFa);
});

test("کارکرد بدون پرونده هشدار پرشدت می‌سازد", () => {
  const a = hrAnalyticsAlerts({ kpis: hrKpiSet({ activeHeadcount: null }) });
  const hit = a.find((x) => x.code === "EWS-HRA-NOREG");
  assert.ok(hit);
  assert.equal(hit.severity, "high");
});

test("سرشماری صفرِ واقعی هشدار بی‌پرونده نمی‌سازد", () => {
  const a = hrAnalyticsAlerts({ kpis: hrKpiSet({ activeHeadcount: 0 }) });
  assert.equal(a.filter((x) => x.code === "EWS-HRA-NOREG").length, 0);
});

test("سربرگ سرشماری نامعلوم را صفر جا نمی‌زند", () => {
  const h = hrHeadlineFa(hrKpiSet({ activeHeadcount: null }), []);
  assert.ok(h.includes("سرشماری نامعلوم"), h);
  assert.ok(!h.includes("0 نفر"), h);
});

test("سرشماری هدف ندارد پس همیشه خنثی است", () => {
  /* «چند نفر خوب است» به پروژه بستگی دارد، نه به یک عدد ثابت. */
  const k = hrKpiSet(KPI_FULL);
  const hc = k.find((x) => x.code === "HEADCOUNT");
  assert.equal(hc.target, null);
  assert.equal(hc.status, "na");
  assert.equal(hc.value, 120);
});

test("نرخ استفادهٔ بدون ظرفیت نامعلوم است نه صفر", () => {
  const k = hrKpiSet({ ...KPI_FULL, availableHours: 0 });
  const u = k.find((x) => x.code === "UTILIZATION_PCT");
  assert.equal(u.value, null);
  assert.ok(u.caveatFa.includes("ظرفیت"));
});

/* ══════════ ۴. ظرفیت دوره ══════════ */

test("روز کاری ماه بدون آخر هفته شمرده می‌شود", () => {
  /* ژانویهٔ ۲۰۲۶: ۳۱ روز، پنج جمعه ⇒ ۲۶ روز کاری. */
  assert.equal(workingDaysInPeriod("2026-01"), 26);
  assert.equal(workingDaysInPeriod("2026-02"), 24, "فوریهٔ ۲۸روزه با چهار جمعه");
  assert.equal(workingDaysInPeriod("2024-02"), 25, "سال کبیسه ۲۹ روز دارد");
});

test("کد دورهٔ بدقالب صفر می‌دهد نه NaN", () => {
  assert.equal(workingDaysInPeriod("1405/01"), 0);
  assert.equal(workingDaysInPeriod(""), 0);
});

test("ظرفیت از سرشماری، روز کاری و سقف روزانه ساخته می‌شود", () => {
  assert.equal(capacityMh(10, ["2026-01"]), 10 * 26 * 8);
  assert.equal(capacityMh(10, ["2026-01", "2026-02"]), 10 * (26 + 24) * 8);
});

test("ظرفیتِ بدون سرشماری نامعلوم است", () => {
  /* اگر صفر برمی‌گرداندیم، نرخ استفاده تقسیم بر صفر می‌شد و شاخص
   * بی‌سروصدا ناپدید می‌ماند. */
  assert.equal(capacityMh(null, ["2026-01"]), null);
  assert.equal(capacityMh(0, ["2026-01"]), null);
  assert.equal(capacityMh(10, []), null);
});

test("نرخ استفاده روی ظرفیت، پروژهٔ کم‌کار را سبز نشان نمی‌دهد", () => {
  /* همان تناقضی که در آزمون زندهٔ D8 دیده شد: پروژه‌ای ۹۳٪ عقب،
   * با مخرجِ «ساعت ثبت‌شده» صد درصد سبز بود. */
  const cap = capacityMh(2, ["2026-01"]);
  const k = hrKpiSet({ activeHeadcount: 2, availableHours: cap, chargedHours: 200 });
  const u = k.find((x) => x.code === "UTILIZATION_PCT");
  assert.ok(u.value < 60, `نرخ استفاده ${u.value}`);
  assert.equal(u.status, "red");
});

/* ══════════ ۴. تجمیع ══════════ */

const BD_ROWS = [
  { key: "CIV-FRM", directMh: 500, subMh: 100, personId: "P1" },
  { key: "CIV-FRM", directMh: 300, subMh: 0, personId: "P2" },
  { key: "ELE-CBL", directMh: 200, subMh: 0, personId: "P3" },
];

test("تجمیع بر اساس کلید با تفکیک مستقیم و پیمانکاری", () => {
  const b = mhBreakdown(BD_ROWS);
  assert.equal(b.length, 2);
  const civ = b.find((x) => x.key === "CIV-FRM");
  assert.equal(civ.directMh, 800);
  assert.equal(civ.subMh, 100);
  assert.equal(civ.totalMh, 900);
  assert.equal(civ.headcount, 2);
});

test("سهم درصدی روی همین نما جمع صد می‌شود", () => {
  /* اگر مخرج کل پروژه بود، نمودار دایره‌ای فیلترشده ناقص می‌شد. */
  const b = mhBreakdown(BD_ROWS);
  assert.equal(round(b.reduce((s, x) => s + x.sharePct, 0)), 100);
  assert.equal(b.find((x) => x.key === "ELE-CBL").sharePct, round((200 / 1100) * 100));
});

test("بزرگ‌ترین سهم اول می‌آید", () => {
  const b = mhBreakdown(BD_ROWS);
  assert.equal(b[0].key, "CIV-FRM");
  assert.deepEqual(b.map((x) => x.totalMh), [...b.map((x) => x.totalMh)].sort((a, c) => c - a));
});

test("برچسب فارسی از تابع بیرونی می‌آید", () => {
  const b = mhBreakdown(BD_ROWS, (k) => (k === "CIV-FRM" ? "قالب‌بندی" : k));
  assert.equal(b.find((x) => x.key === "CIV-FRM").nameFa, "قالب‌بندی");
  assert.equal(b.find((x) => x.key === "ELE-CBL").nameFa, "ELE-CBL", "بدون ترجمه، خود کد");
});

test("سرشماری یکتا می‌شمارد نه ردیف", () => {
  const b = mhBreakdown([
    { key: "K", directMh: 10, personId: "P1" },
    { key: "K", directMh: 10, personId: "P1" },
  ]);
  assert.equal(b[0].headcount, 1, "یک نفر با دو ردیف، یک نفر است");
  assert.equal(b[0].totalMh, 20);
});

test("تجمیع خالی امن است و سهم صفر می‌دهد", () => {
  assert.deepEqual(mhBreakdown([]), []);
  const zero = mhBreakdown([{ key: "K", directMh: 0 }]);
  assert.equal(zero[0].sharePct, 0, "تقسیم بر صفر نباید NaN بدهد");
});

function round(n) { return Math.round(n * 100) / 100; }

/* ══════════ ۵. هشدارها ══════════ */

test("شاخص قرمز هشدار پرشدت می‌سازد", () => {
  const kpis = hrKpiSet({ ...KPI_FULL, compliantCount: 60 });
  const a = hrAnalyticsAlerts({ kpis });
  const hit = a.find((x) => x.metricCode === "COMPLIANCE_PCT");
  assert.ok(hit);
  assert.equal(hit.severity, "high");
});

test("شاخص سبز و زرد هشدار نمی‌سازند", () => {
  const a = hrAnalyticsAlerts({ kpis: hrKpiSet(KPI_FULL) });
  assert.equal(a.filter((x) => x.metricCode).length, 0);
});

test("انحراف تجهیز در دو جهت پیام متفاوت دارد", () => {
  const over = hrAnalyticsAlerts({ histogram: { totals: { variancePct: 30, periodsWithoutPlan: 0 } } });
  assert.equal(over[0].code, "EWS-HRA-MOB");
  assert.equal(over[0].severity, "high");
  assert.ok(over[0].messageFa.includes("بیشتر"));

  const under = hrAnalyticsAlerts({ histogram: { totals: { variancePct: -15, periodsWithoutPlan: 0 } } });
  assert.ok(under[0].messageFa.includes("کمتر"));
  assert.equal(under[0].severity, "medium", "۱۵٪ هنوز بحرانی نیست");
});

test("انحراف داخل آستانه هشدار نمی‌دهد", () => {
  const a = hrAnalyticsAlerts({ histogram: { totals: { variancePct: 5, periodsWithoutPlan: 0 } } });
  assert.equal(a.filter((x) => x.code === "EWS-HRA-MOB").length, 0);
});

test("دورهٔ بی‌برنامه خودش هشدار است", () => {
  /* بدون آن، نصف نمودار بی‌مبنا است و کسی متوجه نمی‌شود. */
  const a = hrAnalyticsAlerts({ histogram: { totals: { variancePct: null, periodsWithoutPlan: 3 } } });
  const hit = a.find((x) => x.code === "EWS-HRA-NOPLAN");
  assert.ok(hit);
  assert.ok(hit.messageFa.includes("3"));
});

test("نبود برنامهٔ مبنا اعلام می‌شود", () => {
  const a = hrAnalyticsAlerts({ sCurve: { points: [], hasBaseline: false } });
  assert.ok(a.some((x) => x.code === "EWS-HRA-NOBASE"));
});

test("عقب‌افتادگی بیش از ده درصد هشدار بحرانی است", () => {
  const a = hrAnalyticsAlerts({
    sCurve: { hasBaseline: true, points: [{ periodCode: "P", deltaPct: -22, cumActualMh: 0, cumPlannedMh: 0, cumActualPct: 0, cumPlannedPct: 0 }] },
  });
  const hit = a.find((x) => x.code === "EWS-HRA-SLIP");
  assert.ok(hit);
  assert.equal(hit.severity, "high");
  assert.ok(hit.messageFa.includes("22"));
});

test("جلوافتادگی هشدار نمی‌سازد", () => {
  const a = hrAnalyticsAlerts({
    sCurve: { hasBaseline: true, points: [{ periodCode: "P", deltaPct: 15, cumActualMh: 0, cumPlannedMh: 0, cumActualPct: 0, cumPlannedPct: 0 }] },
  });
  assert.equal(a.filter((x) => x.code === "EWS-HRA-SLIP").length, 0);
});

test("نفر فعالِ مسدود بحرانی‌ترین هشدار است", () => {
  const a = hrAnalyticsAlerts({ blockedActiveCount: 5, expiringSoonCount: 12 });
  assert.equal(a[0].code, "EWS-HRA-BLOCKED", "بحرانی باید اول باشد");
  assert.equal(a[0].severity, "high");
  const exp = a.find((x) => x.code === "EWS-HRA-EXPIRING");
  assert.equal(exp.severity, "low");
});

test("هشدارها بر اساس شدت مرتب می‌شوند", () => {
  const a = hrAnalyticsAlerts({
    kpis: hrKpiSet({ ...KPI_FULL, compliantCount: 60 }),
    histogram: { totals: { variancePct: null, periodsWithoutPlan: 2 } },
    expiringSoonCount: 3,
  });
  const rank = { high: 0, medium: 1, low: 2 };
  const seq = a.map((x) => rank[x.severity]);
  assert.deepEqual(seq, [...seq].sort((x, y) => x - y));
});

test("نبود دادهٔ انطباق هشدار کم‌شدت می‌دهد نه سکوت", () => {
  const a = hrAnalyticsAlerts({ kpis: hrKpiSet({ activeHeadcount: 0 }) });
  assert.ok(a.some((x) => x.code === "EWS-HRA-NODATA"));
});

test("تعارض همگام‌سازی باز، ناقص بودن ارقام را اعلام می‌کند", () => {
  /* یافتهٔ لوپ ۱۰ در D9: داشبورد با اطمینان کامل رقمی می‌داد که
   * خودش می‌دانست تمام نیست. */
  const a = hrAnalyticsAlerts({ openSyncConflicts: 3 });
  const hit = a.find((x) => x.code === "EWS-HRA-UNSYNCED");
  assert.ok(hit);
  assert.equal(hit.severity, "medium");
  assert.ok(hit.messageFa.includes("3"));
});

test("نبود تعارض هشدار نمی‌سازد", () => {
  assert.equal(hrAnalyticsAlerts({ openSyncConflicts: 0 }).length, 0);
});

test("ورودی خالی هشداری نمی‌سازد", () => {
  assert.deepEqual(hrAnalyticsAlerts({}), []);
});

/* ══════════ ۶. سربرگ ══════════ */

test("سربرگ سه‌بخشی و فارسی است", () => {
  const kpis = hrKpiSet(KPI_FULL);
  const h = hrHeadlineFa(kpis, []);
  assert.ok(h.includes("120 نفر فعال"));
  assert.ok(h.includes("95٪ انطباق"));
  assert.ok(h.includes("بدون هشدار بحرانی"));
});

test("سربرگ نبود داده را پنهان نمی‌کند", () => {
  /* اعداد صفر نباید سربرگ را خوش‌بین جلوه بدهند. */
  const h = hrHeadlineFa(hrKpiSet({ activeHeadcount: 0 }), []);
  assert.ok(h.includes("نامعلوم"), h);
});

test("سربرگ تعداد هشدار بحرانی را می‌گوید", () => {
  const h = hrHeadlineFa(hrKpiSet(KPI_FULL), [
    { code: "A", severity: "high", messageFa: "x" },
    { code: "B", severity: "high", messageFa: "y" },
    { code: "C", severity: "low", messageFa: "z" },
  ]);
  assert.ok(h.includes("2 هشدار بحرانی"), h);
});
