/**
 * آزمون موتور گزارش‌های رسمی نیرو — HRM D11.
 *
 * محور: سند رسمی نباید عدد تازه بسازد، و نباید «نمی‌دانیم» را به صفر
 * ترجمه کند. دروازهٔ انتشار باید بین «عدد غلط است» و «خواننده باید
 * بداند» تفکیک قائل شود.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  HISTOGRAM_STATUS_FA,
  HRM_REPORT_CATALOG,
  HRM_DEFAULT_LETTERHEAD,
  hrmReportByCode,
  hrmPublishGate,
  buildManpowerReport,
  buildTimesheetCertificate,
  buildComplianceReport,
  hrmReportRows,
} from "./hrmLogic.js";

/* ══════════ ۱. کاتالوگ ══════════ */

test("چهار گزارش با کد یکتا تعریف شده‌اند", () => {
  assert.equal(HRM_REPORT_CATALOG.length, 4);
  const codes = HRM_REPORT_CATALOG.map((r) => r.code);
  assert.equal(new Set(codes).size, 4);
});

test("هر گزارش عنوان دوزبانه و هدف دارد", () => {
  for (const r of HRM_REPORT_CATALOG) {
    assert.ok(r.title.fa && r.title.en, r.code);
    assert.ok(r.purpose.fa, r.code);
    assert.ok(r.audiences.length > 0, r.code);
  }
});

test("صورت کارکرد فقط مخاطب رسمی دارد", () => {
  /* سند مبنای پرداخت است؛ نسخهٔ «داخلی» آن معنا ندارد و فقط راهی
   * می‌شد برای دور زدن دروازهٔ انتشار. */
  assert.deepEqual(hrmReportByCode("RPT-HRM-TS").audiences, ["official"]);
});

test("کد ناشناخته undefined می‌دهد نه خطا", () => {
  assert.equal(hrmReportByCode("RPT-NOPE"), undefined);
});

test("سربرگ پیش‌فرض سه طرف قرارداد را دارد", () => {
  for (const k of ["contractor", "client", "consultant"]) {
    assert.ok(HRM_DEFAULT_LETTERHEAD[k]?.name, k);
    assert.ok(HRM_DEFAULT_LETTERHEAD[k]?.role?.fa, k);
  }
});

test("سربرگ همان شکل گزارش‌ساز مرکزی را دارد", () => {
  /* شکل تازه یعنی `validateLetterhead` و `toPrintHtml` مشترک روی آن
   * کار نمی‌کنند و کل زیرساخت گزارش دوباره نوشته می‌شود. */
  assert.equal(typeof HRM_DEFAULT_LETTERHEAD.projectName, "string");
  for (const k of ["projectCode", "contractNo", "docNo", "revision", "issueDate", "periodLabel", "preparedBy", "approvedBy"]) {
    assert.equal(typeof HRM_DEFAULT_LETTERHEAD[k], "string", k);
  }
  assert.ok(Array.isArray(HRM_DEFAULT_LETTERHEAD.distribution));
});

test("طبقه‌بندی پیش‌فرض محرمانه است نه داخلی", () => {
  /* نرخ ساعتی و پروندهٔ پرسنلی دادهٔ حساس‌اند. */
  assert.equal(HRM_DEFAULT_LETTERHEAD.classification, "confidential");
});

/* ══════════ ۲. دروازهٔ انتشار ══════════ */

test("گزارش داخلی دروازه ندارد", () => {
  /* مخاطب داخلی دقیقاً برای دیدن همان نقص گزارش می‌گیرد. */
  const g = hrmPublishGate("internal", { openSyncConflicts: 9, unapprovedSheets: 9, headcountUnknown: true });
  assert.equal(g.ok, true);
  assert.deepEqual(g.reasons, []);
});

test("دادهٔ کامل، گزارش رسمی را باز می‌گذارد", () => {
  const g = hrmPublishGate("official", {});
  assert.equal(g.ok, true);
  assert.deepEqual(g.warnings, []);
});

test("تعارض همگام‌سازی باز، سند رسمی را می‌بندد", () => {
  /* صورت‌وضعیت روی ساعتی که هنوز تکلیفش روشن نیست امضا نمی‌شود. */
  const g = hrmPublishGate("official", { openSyncConflicts: 2 });
  assert.equal(g.ok, false);
  assert.ok(g.reasons.some((r) => r.includes("تعارض")));
});

test("برگهٔ تأییدنشده سند رسمی را می‌بندد", () => {
  const g = hrmPublishGate("official", { unapprovedSheets: 5 });
  assert.equal(g.ok, false);
  assert.ok(g.reasons[0].includes("5"));
});

test("سرشماری نامعلوم سند رسمی را می‌بندد", () => {
  /* اگر مخرج معلوم نباشد، همهٔ درصدهای سند بی‌پشتوانه‌اند. */
  const g = hrmPublishGate("official", { headcountUnknown: true });
  assert.equal(g.ok, false);
  assert.ok(g.reasons.some((r) => r.includes("مخرج")));
});

test("نیروی مسدود سند رسمی را می‌بندد", () => {
  assert.equal(hrmPublishGate("official", { blockedActive: 1 }).ok, false);
});

test("دورهٔ بی‌برنامه هشدار است نه مانع", () => {
  /* عدد را غلط نمی‌کند، فقط ناقص؛ خواننده باید بداند. */
  const g = hrmPublishGate("official", { periodsWithoutPlan: 3 });
  assert.equal(g.ok, true);
  assert.equal(g.reasons.length, 0);
  assert.ok(g.warnings[0].includes("3"));
});

test("مدرک نزدیک انقضا هشدار است نه مانع", () => {
  const g = hrmPublishGate("official", { expiringSoon: 4 });
  assert.equal(g.ok, true);
  assert.equal(g.warnings.length, 1);
});

test("چند مانع همزمان همه گزارش می‌شوند", () => {
  /* کاربر باید یک بار همهٔ کارها را ببیند نه اینکه هر بار یکی. */
  const g = hrmPublishGate("official", {
    openSyncConflicts: 1, unapprovedSheets: 2, headcountUnknown: true, periodsWithoutPlan: 1,
  });
  assert.equal(g.ok, false);
  assert.equal(g.reasons.length, 3);
  assert.equal(g.warnings.length, 1);
});

/* ══════════ ۳. گزارش هیستوگرام ══════════ */

const MP_VIEW = {
  histogram: {
    bars: [
      { periodCode: "2026-01", plannedMh: 100, directMh: 80, subMh: 20, actualMh: 100, variancePct: 0, status: "on_track" },
      { periodCode: "2026-02", plannedMh: null, directMh: 50, subMh: 0, actualMh: 50, variancePct: null, status: "no_plan" },
    ],
    totals: { plannedMh: 100, directMh: 130, subMh: 20, actualMh: 150, variancePct: 50 },
  },
  sCurve: {
    points: [{ periodCode: "2026-01", cumPlannedMh: 100, cumActualMh: 100, plannedPct: 100, actualPct: 100 }],
    hasBaseline: true,
  },
  kpis: [{ code: "HEADCOUNT", nameFa: "سرشماری", value: 12, status: "green" }],
  headlineFa: "۱۲ نفر فعال · بدون هشدار بحرانی",
};

test("گزارش هیستوگرام کد و مخاطب درست دارد", () => {
  const r = buildManpowerReport(MP_VIEW);
  assert.equal(r.code, "RPT-HRM-MP");
  assert.ok(r.audiences.includes("official"));
  assert.ok(r.sourceModule.includes("d10"));
});

test("هیستوگرام هیچ عددی را دوباره حساب نمی‌کند", () => {
  /* اگر سند محاسبهٔ خودش را داشت، دو گزارش از یک ماه دو رقم می‌دادند. */
  const r = buildManpowerReport(MP_VIEW);
  const table = r.sections.find((s) => s.kind === "table" && s.title.fa.includes("هیستوگرام"));
  assert.equal(table.rows[0].actual, 100);
  assert.equal(table.rows[0].direct, 80);
});

test("دورهٔ بی‌برنامه در سند «—» می‌گیرد نه صفر", () => {
  /* صفر یعنی «مطابق برنامه» — ادعایی که وقتی برنامه‌ای نیست دروغ است. */
  const r = buildManpowerReport(MP_VIEW);
  const table = r.sections.find((s) => s.kind === "table" && s.title.fa.includes("هیستوگرام"));
  assert.equal(table.rows[1].planned, "—");
  assert.equal(table.rows[1].variance, "—");
});

test("وضعیت هیستوگرام به فارسی ترجمه می‌شود نه واژگان زمان‌بندی", () => {
  /* یافتهٔ آزمون زنده: `format:"status"` واژگان زمان‌بندی می‌خواهد
   * (`critical`/`on_track`/…). با واژگان نیرو، `primaveraColor`
   * undefined می‌داد و رندر HTML می‌شکست. */
  const r = buildManpowerReport(MP_VIEW);
  const table = r.sections.find((s) => s.kind === "table" && s.title.fa.includes("هیستوگرام"));
  assert.equal(table.rows[0].status, HISTOGRAM_STATUS_FA.on_track);
  assert.equal(table.rows[1].status, HISTOGRAM_STATUS_FA.no_plan);
  assert.equal(table.columns.find((c) => c.key === "status").format, "text");
});

test("هر چهار وضعیت هیستوگرام ترجمهٔ فارسی دارند", () => {
  for (const k of ["over", "under", "on_track", "no_plan"]) {
    assert.ok(HISTOGRAM_STATUS_FA[k], k);
  }
});

test("شدت هشدار در سند رسمی فارسی است", () => {
  const r = buildComplianceReport(CMP_VIEW);
  const t = r.sections.find((s) => s.kind === "table");
  assert.equal(t.rows[0].severity, "بحرانی");
  assert.equal(t.rows[1].severity, "متوسط");
  assert.equal(t.columns.find((c) => c.key === "severity").format, "text");
});

test("منحنی S بدون مبنا جدول نمی‌شود، متن می‌شود", () => {
  /* جدولی از صفرها بدتر از نبودن آن است. */
  const r = buildManpowerReport({ ...MP_VIEW, sCurve: { points: [], hasBaseline: false } });
  const sc = r.sections.find((s) => s.title.fa.includes("منحنی"));
  assert.equal(sc.kind, "text");
  assert.ok(sc.body.fa.includes("مبنا"));
});

test("منحنی S با مبنا جدول می‌شود", () => {
  const r = buildManpowerReport(MP_VIEW);
  const sc = r.sections.find((s) => s.title.fa.includes("منحنی"));
  assert.equal(sc.kind, "table");
  assert.equal(sc.rows.length, 1);
});

test("انحراف بزرگ در کارت چکیده قرمز می‌شود", () => {
  const r = buildManpowerReport(MP_VIEW);
  const k = r.sections.find((s) => s.kind === "kpi");
  assert.equal(k.cells.find((c) => c.label.fa === "انحراف").tone, "bad");
});

test("انحراف نامعلوم زرد است نه سبز", () => {
  const r = buildManpowerReport({
    ...MP_VIEW,
    histogram: { ...MP_VIEW.histogram, totals: { ...MP_VIEW.histogram.totals, variancePct: null } },
  });
  const k = r.sections.find((s) => s.kind === "kpi");
  const v = k.cells.find((c) => c.label.fa === "انحراف");
  assert.equal(v.value, "—");
  assert.equal(v.tone, "warn");
});

test("سرشماری نامعلوم در کارت «—» است", () => {
  const r = buildManpowerReport({ ...MP_VIEW, kpis: [{ code: "HEADCOUNT", nameFa: "س", value: null, status: "amber" }] });
  const k = r.sections.find((s) => s.kind === "kpi");
  assert.equal(k.cells.find((c) => c.label.fa === "سرشماری فعال").value, "—");
});

test("جمع‌بندی فقط وقتی سربرگ هست درج می‌شود", () => {
  assert.ok(buildManpowerReport(MP_VIEW).sections.some((s) => s.title.fa === "جمع‌بندی"));
  const bare = buildManpowerReport({ ...MP_VIEW, headlineFa: undefined });
  assert.ok(!bare.sections.some((s) => s.title.fa === "جمع‌بندی"));
});

/* ══════════ ۴. صورت کارکرد ══════════ */

const TS_VIEW = {
  breakdown: [
    { key: "CIV-RBR", labelFa: "آرماتوربند", headcount: 5, directMh: 100, subMh: 0, totalMh: 100, sharePct: 66.7 },
    { key: "SUB", labelFa: "پیمانکاری", headcount: 3, directMh: 0, subMh: 50, totalMh: 50, sharePct: 33.3 },
  ],
  histogram: { totals: { directMh: 100, subMh: 50, actualMh: 150 } },
  fromCode: "2026-01",
  toCode: "2026-03",
  groupByFa: "رسته",
};

test("صورت کارکرد مبنای محاسبه را صریح می‌نویسد", () => {
  /* سندی که نگوید کدام ساعت‌ها را شمرده، در جلسهٔ اختلاف بی‌فایده است. */
  const r = buildTimesheetCertificate(TS_VIEW);
  const basis = r.sections.find((s) => s.kind === "text");
  assert.ok(basis.body.fa.includes("pm_approved"));
  assert.ok(basis.body.fa.includes("2026-01"));
  assert.ok(basis.body.fa.includes("2026-03"));
});

test("مبنا می‌گوید ساعت مستقیم و پیمانکاری جمع نشده‌اند", () => {
  const r = buildTimesheetCertificate(TS_VIEW);
  assert.ok(r.sections[0].body.fa.includes("در یک ستون جمع نشده"));
});

test("صورت کارکرد دو ستون ساعت جدا دارد", () => {
  const r = buildTimesheetCertificate(TS_VIEW);
  const t = r.sections.find((s) => s.kind === "table");
  const keys = t.columns.map((c) => c.key);
  assert.ok(keys.includes("direct"));
  assert.ok(keys.includes("sub"));
});

test("صورت کارکرد فقط رسمی است", () => {
  assert.deepEqual(buildTimesheetCertificate(TS_VIEW).audiences, ["official"]);
});

test("عنوان تفکیک از ورودی می‌آید", () => {
  const r = buildTimesheetCertificate({ ...TS_VIEW, groupByFa: "ساختار سازمانی" });
  assert.ok(r.sections.find((s) => s.kind === "table").title.fa.includes("ساختار سازمانی"));
});

test("تفکیک خالی سند را نمی‌شکند", () => {
  const r = buildTimesheetCertificate({ ...TS_VIEW, breakdown: [] });
  assert.equal(hrmReportRows(r), 0);
});

/* ══════════ ۵. گزارش انطباق ══════════ */

const CMP_VIEW = {
  compliance: { headcount: 20, activeCount: 15, activeCompliantCount: 14, compliancePct: 93.3 },
  alerts: [
    { code: "EWS-HRA-BLOCKED", severity: "high", messageFa: "۱ نفر مسدود" },
    { code: "EWS-HRA-EXPIRING", severity: "medium", messageFa: "۳ مدرک نزدیک انقضا" },
    { code: "EWS-HRA-NODATA", severity: "low", messageFa: "کم‌اهمیت" },
  ],
};

test("گزارش انطباق نرخ را با آستانه رنگ می‌کند", () => {
  const r = buildComplianceReport(CMP_VIEW);
  const k = r.sections.find((s) => s.kind === "kpi");
  assert.equal(k.cells.find((c) => c.label.fa === "نرخ انطباق").tone, "warn");

  const good = buildComplianceReport({ ...CMP_VIEW, compliance: { ...CMP_VIEW.compliance, compliancePct: 98 } });
  assert.equal(good.sections[0].cells.find((c) => c.label.fa === "نرخ انطباق").tone, "good");

  const bad = buildComplianceReport({ ...CMP_VIEW, compliance: { ...CMP_VIEW.compliance, compliancePct: 60 } });
  assert.equal(bad.sections[0].cells.find((c) => c.label.fa === "نرخ انطباق").tone, "bad");
});

test("نرخ انطباق نامعلوم «—» است و زرد", () => {
  const r = buildComplianceReport({ ...CMP_VIEW, compliance: { ...CMP_VIEW.compliance, compliancePct: null } });
  const v = r.sections[0].cells.find((c) => c.label.fa === "نرخ انطباق");
  assert.equal(v.value, "—");
  assert.equal(v.tone, "warn");
});

test("هشدار کم‌اهمیت وارد سند رسمی نمی‌شود", () => {
  /* خواننده باید فوری ببیند چه چیزی واقعاً مهم است. */
  const r = buildComplianceReport(CMP_VIEW);
  const t = r.sections.find((s) => s.kind === "table");
  assert.equal(t.rows.length, 2);
  assert.ok(!t.rows.some((x) => x.code === "EWS-HRA-NODATA"));
});

test("صورت و مخرج انطباق در سند از یک جمعیت‌اند", () => {
  /* اگر صورت همهٔ پرونده‌ها را می‌شمرد و مخرج فقط فعال‌ها را،
   * نرخ بالای صد ممکن می‌شد. */
  const r = buildComplianceReport(CMP_VIEW);
  const k = r.sections[0].cells;
  assert.equal(k.find((c) => c.label.fa === "منطبق").value, "14");
  assert.equal(k.find((c) => c.label.fa === "نیروی فعال").value, "15");
});

/* ══════════ ۶. شمارش صفحه ══════════ */

test("شمار ردیف فقط جدول‌ها را می‌شمارد", () => {
  const r = buildManpowerReport(MP_VIEW);
  assert.equal(hrmReportRows(r), 3, "۲ ردیف هیستوگرام + ۱ ردیف منحنی S");
});

test("گزارش بدون جدول صفر ردیف دارد", () => {
  assert.equal(hrmReportRows({ code: "X", title: { fa: "", en: "" }, periodicity: "adhoc", sourceModule: "", audiences: [], sections: [] }), 0);
});
