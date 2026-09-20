/* تست‌های تحویلی ۱۱ و ۱۲ ماژول ماشین‌آلات: کاتالوگ گزارش، شش سازنده،
 * دروازهٔ انتشار و سازگاری خروجی با سریال‌سازهای موتور A4 سه‌لوگو. */
import test from "node:test";
import assert from "node:assert/strict";

import {
  EQP_REPORT_BY_CODE,
  EQP_REPORT_CATALOG,
  EQP_REPORT_VERSION,
  buildCostAllocationReport,
  buildDispatchSheetReport,
  buildEquipmentIdCardReport,
  buildExecutiveOnePager,
  buildFleetPerformanceReport,
  buildMaintenanceReport,
  buildSparePartsReport,
  eqpPublishGate,
  eqpReportRows,
} from "./eqmLogic.js";
import { TEMPLATE_CATALOG, mapHeaders, templateByCode, templateCsv, templateGuide } from "./itgLogic.js";
import { estimatePages, toCsv, toExcelHtml, toPrintHtml, toWordHtml, validateLetterhead } from "./rptLogic.js";

const LH = {
  projectName: "پروژه آزمون",
  projectCode: "TST-01",
  contractNo: "C-1",
  contractor: { name: "پیمانکار", logoText: "پ", role: { fa: "پیمانکار", en: "Contractor" } },
  client: { name: "کارفرما", logoText: "ک", role: { fa: "کارفرما", en: "Client" } },
  consultant: { name: "مشاور", logoText: "م", role: { fa: "مشاور", en: "Consultant" } },
  docNo: "TST-01-RPT-0001-R00",
  revision: "R00",
  issueDate: "2026-09-09",
  periodLabel: "شهریور ۱۴۰۵",
  classification: "confidential",
  distribution: ["مدیر پروژه"],
  preparedBy: "واحد ماشین‌آلات",
  approvedBy: "مدیر پروژه",
};

const EQ = {
  Id: "e1", Code: "EQ-001", NameFa: "بیل مکانیکی", Category: "EXC", Ownership: "owned",
  Status: "active", BrandFa: "کوماتسو", Model: "PC220", Year: 2023,
  CommissionedAt: "2024-03-01", PurchaseValue: 28e9, SalvageValue: 2.8e9,
  Capacity: 22, CapacityUom: "تن",
};

/* ───────────────────────── کاتالوگ ───────────────────────── */

test("کاتالوگ گزارش‌های ناوگان شش قلم یکتا دارد", () => {
  assert.equal(EQP_REPORT_VERSION, "eqp-rpt-v1");
  assert.equal(EQP_REPORT_CATALOG.length, 7);
  const codes = EQP_REPORT_CATALOG.map((r) => r.code);
  assert.equal(new Set(codes).size, 7);
  for (const c of ["RPT-EQP-DSP", "RPT-EQP-CARD", "RPT-EQP-MNT", "RPT-EQP-PERF", "RPT-EQP-COST", "RPT-EQP-PART", "RPT-EQP-EXEC"]) {
    assert.ok(codes.includes(c), `کد ${c} غایب است`);
  }
});

test("هر مدخل کاتالوگ عنوان دوزبانه، دوره و مخاطب معتبر دارد", () => {
  const periods = ["daily", "weekly", "monthly", "quarterly", "adhoc"];
  for (const r of EQP_REPORT_CATALOG) {
    assert.ok(r.title.fa.length > 3, `${r.code} عنوان فارسی ندارد`);
    assert.ok(r.title.en.length > 3, `${r.code} عنوان انگلیسی ندارد`);
    assert.ok(r.purpose.fa.length > 5, `${r.code} شرح هدف ندارد`);
    assert.ok(periods.includes(r.periodicity), `${r.code} دوره نامعتبر: ${r.periodicity}`);
    assert.ok(Array.isArray(r.audiences) && r.audiences.length > 0, `${r.code} مخاطب ندارد`);
    for (const a of r.audiences) assert.ok(["internal", "official"].includes(a), `${r.code} مخاطب نامعتبر`);
  }
});

test("گزارش ساخته‌شده بخش و ستون‌های تعریف‌شده دارد", () => {
  for (const rep of ALL()) {
    assert.ok(Array.isArray(rep.sections) && rep.sections.length > 0, `${rep.code} بخش ندارد`);
    for (const sec of rep.sections) {
      if (sec.kind !== "table") continue;
      assert.ok(sec.columns.length > 0, `${rep.code}/${sec.title.fa} ستون ندارد`);
      for (const c of sec.columns) assert.ok(c.key && c.title.fa, `${rep.code} ستون ناقص`);
    }
  }
});

test("نمایهٔ EQP_REPORT_BY_CODE با کاتالوگ هم‌خوان است", () => {
  assert.equal(Object.keys(EQP_REPORT_BY_CODE).length, EQP_REPORT_CATALOG.length);
  for (const r of EQP_REPORT_CATALOG) assert.equal(EQP_REPORT_BY_CODE[r.code].code, r.code);
});

test("گزارش قطعات فقط داخلی است و برگهٔ دیسپچ رسمی‌پذیر", () => {
  assert.deepEqual(EQP_REPORT_BY_CODE["RPT-EQP-PART"].audiences, ["internal"]);
  assert.ok(EQP_REPORT_BY_CODE["RPT-EQP-DSP"].audiences.includes("official"));
});

/* ─────────────────── برگهٔ دیسپچ روزانه ─────────────────── */

const dspRow = (ok, code = "EQ-001") => ({
  dispatch: { Id: "d1", EquipmentId: "e1", DispatchDate: "2026-09-09", Shift: "day", OperatorId: "op1", PlannedHours: 8, PlannedQty: 450, QtyUom: "مترمکعب", SiteFa: "بلوک B", Status: "approved" },
  equipmentName: "بیل مکانیکی",
  equipmentCode: code,
  check: { allowed: ok, gates: ok ? [] : [{ code: "G-EQP-PM", passed: false, messageFa: "PM معوق" }] },
});

test("برگهٔ دیسپچ سطر هر ماشین و تاریخ را بازتاب می‌دهد", () => {
  const rep = buildDispatchSheetReport({ dateIso: "2026-09-09", rows: [dspRow(true)] });
  assert.equal(rep.code, "RPT-EQP-DSP");
  assert.ok(JSON.stringify(rep).includes("2026-09-09"));
  assert.equal(eqpReportRows(rep) >= 1, true);
});

test("دیسپچ مسدود در برگه علامت‌گذاری می‌شود", () => {
  const rep = buildDispatchSheetReport({ dateIso: "2026-09-09", rows: [dspRow(false)] });
  const txt = JSON.stringify(rep);
  assert.ok(txt.includes("PM معوق") || txt.includes("مسدود"), "دلیل مسدودی در گزارش نیامد");
});

test("برگهٔ دیسپچ خالی هم ساختار معتبر می‌سازد", () => {
  const rep = buildDispatchSheetReport({ dateIso: "2026-09-09", rows: [] });
  assert.ok(rep.sections.length > 0);
  assert.equal(eqpReportRows(rep), 0);
});

/* ─────────────────── کارت شناسنامه ─────────────────── */

test("کارت شناسنامه مشخصات و QR ماشین را دارد", () => {
  const rep = buildEquipmentIdCardReport({ equipment: EQ, nowIso: "2026-09-09", orders: [], meters: [{ EquipmentId: "e1", ReadAt: "2026-09-08", HourMeter: 1286, WorkHours: 96 }], rental: undefined });
  const txt = JSON.stringify(rep);
  assert.equal(rep.code, "RPT-EQP-CARD");
  assert.ok(txt.includes("EQ-001"));
  assert.ok(txt.includes("کوماتسو"));
  assert.ok(txt.includes("1286"), "قرائت ساعت‌شمار در کارت نیست");
});

test("کارت شناسنامه استهلاک و عمر را محاسبه می‌کند", () => {
  const rep = buildEquipmentIdCardReport({ equipment: EQ, nowIso: "2026-09-09", orders: [], meters: [], rental: undefined });
  const txt = JSON.stringify(rep);
  assert.ok(/استهلاک|دفتری/.test(txt), "ردیف استهلاک نیامد");
  assert.ok(/عمر/.test(txt), "ردیف عمر نیامد");
});

/* ─────────────────── گزارش نگهداری ─────────────────── */

const ORDERS = [
  { Id: "w1", EquipmentId: "e1", Kind: "corrective", Priority: "critical", Status: "open", ReportedAt: "2026-09-01", Cost: 12e6, RootCause: "wear" },
  { Id: "w2", EquipmentId: "e1", Kind: "preventive", Priority: "medium", Status: "closed", ReportedAt: "2026-08-20", ClosedAt: "2026-08-21", Cost: 4e6 },
];

test("گزارش نگهداری بک‌لاگ، MTTR و MTBF را گزارش می‌کند", () => {
  const rep = buildMaintenanceReport({
    fromIso: "2026-08-10", toIso: "2026-09-09", orders: ORDERS,
    equipmentNameById: { e1: "بیل مکانیکی" }, plannedPmCount: 2, periodHours: 720, downtimeHrs: 24,
  });
  const txt = JSON.stringify(rep);
  assert.equal(rep.code, "RPT-EQP-MNT");
  assert.ok(/MTTR|میانگین زمان تعمیر/.test(txt));
  assert.ok(/MTBF|میانگین زمان بین/.test(txt));
});

test("گزارش نگهداری بدون سفارش کار سقوط نمی‌کند", () => {
  const rep = buildMaintenanceReport({ fromIso: "2026-08-10", toIso: "2026-09-09", orders: [], equipmentNameById: {}, plannedPmCount: 0, periodHours: 720, downtimeHrs: 0 });
  assert.ok(rep.sections.length > 0);
});

/* ─────────────────── عملکرد ناوگان ─────────────────── */

const BOARD = { availability: 92.5, utilization: 68.1, oee: null, mtbf: 340, mttr: 6.2, mcr: 3.1, pmCompliance: 88, sfc: 17.4, scoreboard: [] };

test("گزارش عملکرد شاخص‌ها و نمرهٔ سلامت را می‌آورد", () => {
  const rep = buildFleetPerformanceReport({
    fromIso: "2026-08-10", toIso: "2026-09-09", board: BOARD,
    perEquipment: [{ code: "EQ-001", name: "بیل مکانیکی", workHours: 96, utilization: 68.1, availability: 92.5, downtimeHrs: 24, costPerHour: 1.2e6 }],
    alerts: [{ code: "EWS-EQP-02", severity: "warning", messageFa: "بهره‌وری پایین" }],
    healthScore: 81, healthGrade: "B",
  });
  const txt = JSON.stringify(rep);
  assert.equal(rep.code, "RPT-EQP-PERF");
  assert.ok(txt.includes("92.5") || txt.includes("92٫5") || txt.includes("۹۲"), "آمادگی در گزارش نیست");
  assert.ok(txt.includes("EWS-EQP-02"), "هشدار در گزارش نیست");
});

test("OEE نامعلوم به‌جای عدد ساختگی «—» نمایش داده می‌شود", () => {
  const rep = buildFleetPerformanceReport({
    fromIso: "2026-08-10", toIso: "2026-09-09", board: { ...BOARD, oee: null },
    perEquipment: [], alerts: [], healthScore: 81, healthGrade: "B",
  });
  const txt = JSON.stringify(rep);
  assert.ok(!/"oee"\s*:\s*(100|0)\b/.test(txt), "OEE ساختگی تولید شد");
});

/* ─────────────────── تخصیص هزینه ─────────────────── */

test("گزارش تخصیص هزینه جمع ستون‌ها را درست می‌بندد", () => {
  const rep = buildCostAllocationReport({
    fromIso: "2026-08-10", toIso: "2026-09-09",
    rows: [
      { code: "EQ-001", name: "بیل", costAccount: "CA-01", workHours: 100, rentalCost: 0, maintenanceCost: 16e6, fuelCost: 24e6 },
      { code: "EQ-002", name: "لودر", costAccount: "CA-02", workHours: 50, rentalCost: 30e6, maintenanceCost: 0, fuelCost: 10e6 },
    ],
  });
  const txt = JSON.stringify(rep);
  assert.equal(rep.code, "RPT-EQP-COST");
  assert.ok(txt.includes("80000000") || txt.includes("8e7") || /جمع/.test(txt), "جمع کل نیامد");
});

test("گزارش هزینه ماشین بدون کارکرد را با نرخ صفر رد نمی‌کند", () => {
  const rep = buildCostAllocationReport({ fromIso: "2026-08-10", toIso: "2026-09-09", rows: [{ code: "EQ-003", name: "جرثقیل", workHours: 0, rentalCost: 5e6, maintenanceCost: 0, fuelCost: 0 }] });
  assert.ok(eqpReportRows(rep) >= 1);
});

/* ─────────────────── قطعات یدکی ─────────────────── */

const PARTS = [
  { Id: "p1", PartNo: "CAT-1R", NameFa: "فیلتر سوخت", OnHand: 4, MinLevel: 10, LeadTimeDays: 21, AvgDailyUsage: 0.4, UnitCost: 4.2e6, Critical: true },
  { Id: "p2", PartNo: "KOM-77", NameFa: "واشر", OnHand: 50, MinLevel: 10, LeadTimeDays: 7, AvgDailyUsage: 0.1, UnitCost: 2e5, Critical: false },
];

test("گزارش قطعات کسری و نقطهٔ سفارش را می‌دهد", () => {
  const rep = buildSparePartsReport({ parts: PARTS, coverDays: 30 });
  const txt = JSON.stringify(rep);
  assert.equal(rep.code, "RPT-EQP-PART");
  assert.ok(txt.includes("CAT-1R"));
  assert.ok(/سفارش|ROP|کسری/.test(txt), "ستون نقطهٔ سفارش نیامد");
});

test("قطعهٔ بحرانی زیر حداقل موجودی برجسته می‌شود", () => {
  const rep = buildSparePartsReport({ parts: PARTS, coverDays: 30 });
  const txt = JSON.stringify(rep);
  assert.ok(/danger|critical|بحرانی/.test(txt), "قطعهٔ بحرانی علامت نخورد");
});

/* ─────────────────── دروازهٔ انتشار ─────────────────── */

const CLEAN = { blockedDispatch: 0, pmOverdue: 0, criticalOpen: 0, criticalPartsOut: 0, missingMeterReadings: 0 };

test("گزارش رسمی با دادهٔ کامل مجاز است", () => {
  const g = eqpPublishGate("official", CLEAN);
  assert.equal(g.ok, true);
  assert.equal(g.reasons.length, 0);
});

test("قرائت ساعت‌شمار ناقص انتشار رسمی را مسدود می‌کند", () => {
  const g = eqpPublishGate("official", { ...CLEAN, missingMeterReadings: 3 });
  assert.equal(g.ok, false);
  assert.ok(g.reasons.some((r) => /ساعت‌شمار|قرائت/.test(r)));
});

test("خرابی بحرانی باز انتشار رسمی را مسدود می‌کند", () => {
  const g = eqpPublishGate("official", { ...CLEAN, criticalOpen: 2 });
  assert.equal(g.ok, false);
});

test("PM معوق فقط هشدار است نه مسدودکننده", () => {
  const g = eqpPublishGate("official", { ...CLEAN, pmOverdue: 5 });
  assert.equal(g.ok, true);
  assert.ok(g.warnings.length > 0);
});

test("گزارش داخلی حتی با ایراد داده صادر می‌شود", () => {
  const g = eqpPublishGate("internal", { blockedDispatch: 4, pmOverdue: 9, criticalOpen: 3, criticalPartsOut: 2, missingMeterReadings: 7 });
  assert.equal(g.ok, true);
});

/* ────────── سازگاری با سریال‌سازهای موتور A4 (rpt-v1) ────────── */

const EXEC_IN = {
  fromIso: "2026-08-10", toIso: "2026-09-09", board: BOARD,
  fleetSize: 3, activeCount: 2, healthScore: 42, healthGrade: "D",
  backlog: { total: 1, byPriority: { low: 0, medium: 0, high: 0, critical: 1 } },
  topCauses: [{ cause: "wear", count: 3, pct: 60 }, { cause: "external", count: 2, pct: 40 }],
  cost: { budget: 1000000000, actual: 834665361 },
  alerts: [
    { code: "EWS-EQP-03", severity: "critical", message: "سرویس دوره‌ای معوق است", escalateTo: "رئیس نگهداری" },
    { code: "EWS-EQP-02", severity: "warning", message: "بهره‌برداری پایین", escalateTo: "مدیر ماشین‌آلات" },
  ],
  pmOverdueCount: 1,
};

function ALL() { return [
  buildDispatchSheetReport({ dateIso: "2026-09-09", rows: [dspRow(true)] }),
  buildEquipmentIdCardReport({ equipment: EQ, nowIso: "2026-09-09", orders: ORDERS, meters: [], rental: undefined }),
  buildMaintenanceReport({ fromIso: "2026-08-10", toIso: "2026-09-09", orders: ORDERS, equipmentNameById: { e1: "بیل" }, plannedPmCount: 2, periodHours: 720, downtimeHrs: 24 }),
  buildFleetPerformanceReport({ fromIso: "2026-08-10", toIso: "2026-09-09", board: BOARD, perEquipment: [], alerts: [], healthScore: 81, healthGrade: "B" }),
  buildCostAllocationReport({ fromIso: "2026-08-10", toIso: "2026-09-09", rows: [{ code: "EQ-001", name: "بیل", workHours: 100, rentalCost: 0, maintenanceCost: 1e6, fuelCost: 2e6 }] }),
  buildSparePartsReport({ parts: PARTS, coverDays: 30 }),
  buildExecutiveOnePager(EXEC_IN),
]; }

test("هر هفت گزارش به HTML چاپی A4 تبدیل می‌شوند", () => {
  for (const rep of ALL()) {
    const html = toPrintHtml(rep, LH, "internal", "fa");
    assert.ok(html.includes("<html"), `${rep.code} خروجی HTML نداد`);
    assert.ok(html.includes("210mm") || html.includes("@page"), `${rep.code} قالب A4 ندارد`);
  }
});

test("سربرگ سه‌لوگو در خروجی چاپی هر گزارش هست", () => {
  for (const rep of ALL()) {
    const html = toPrintHtml(rep, LH, "official", "fa");
    assert.ok(html.includes("پیمانکار"), `${rep.code} لوگوی پیمانکار ندارد`);
    assert.ok(html.includes("کارفرما"), `${rep.code} لوگوی کارفرما ندارد`);
    assert.ok(html.includes("مشاور"), `${rep.code} لوگوی مشاور ندارد`);
  }
});

test("خروجی Word و Excel برای هر گزارش تولید می‌شود", () => {
  for (const rep of ALL()) {
    assert.ok(toWordHtml(rep, LH, "internal", "fa").length > 200, `${rep.code} Word نداد`);
    assert.ok(toExcelHtml(rep, LH, "fa").includes("<table"), `${rep.code} Excel نداد`);
  }
});

test("خروجی CSV هر گزارش سطر داده دارد", () => {
  for (const rep of ALL()) {
    const csv = toCsv(rep, "fa");
    assert.ok(csv.split("\n").length >= 2, `${rep.code} CSV تهی است`);
  }
});

test("برآورد صفحه برای هر گزارش دست‌کم یک صفحه است", () => {
  for (const rep of ALL()) assert.ok(estimatePages(rep) >= 1, `${rep.code} صفحه صفر`);
});

test("سربرگ نمونه از اعتبارسنجی رسمی rpt-v1 رد می‌شود", () => {
  const errs = validateLetterhead(LH, "official").filter((i) => i.severity === "error");
  assert.equal(errs.length, 0, `ایراد سربرگ: ${JSON.stringify(errs)}`);
});

test("سربرگ بدون شماره سند برای مخاطب رسمی خطا می‌دهد", () => {
  const errs = validateLetterhead({ ...LH, docNo: "" }, "official").filter((i) => i.severity === "error");
  assert.ok(errs.length > 0);
});

/* ─────────── تحویلی ۱۲: پنج قالب Excel ماشین‌آلات ─────────── */

test("پنج قالب d9 در کاتالوگ یکپارچه‌سازی ثبت شده‌اند", () => {
  const d9 = TEMPLATE_CATALOG.filter((t) => t.module === "d9");
  assert.equal(d9.length, 5);
  for (const c of ["TPL-EQP", "TPL-DSP", "TPL-SMH", "TPL-PMS", "TPL-SPR"]) {
    assert.ok(templateByCode(c), `قالب ${c} یافت نشد`);
  }
});

test("هر قالب d9 کلید طبیعی و جدول مقصد دارد", () => {
  for (const t of TEMPLATE_CATALOG.filter((x) => x.module === "d9")) {
    assert.ok(t.targetTable, `${t.code} جدول مقصد ندارد`);
    assert.ok(t.keyFields.length > 0, `${t.code} کلید طبیعی ندارد`);
    for (const k of t.keyFields) {
      assert.ok(t.fields.some((f) => f.key === k), `${t.code}: کلید ${k} بین فیلدها نیست`);
    }
  }
});

test("فیلدهای الزامی قالب‌های d9 نمونهٔ مقدار دارند", () => {
  for (const t of TEMPLATE_CATALOG.filter((x) => x.module === "d9")) {
    for (const f of t.fields.filter((x) => x.required)) {
      assert.ok(String(f.sample ?? "").length > 0, `${t.code}/${f.key} نمونه ندارد`);
    }
  }
});

test("فیلدهای enum قالب‌های d9 فهرست مقادیر دارند", () => {
  for (const t of TEMPLATE_CATALOG.filter((x) => x.module === "d9")) {
    for (const f of t.fields.filter((x) => x.type === "enum")) {
      assert.ok(Array.isArray(f.enumValues) && f.enumValues.length > 1, `${t.code}/${f.key} مقادیر مجاز ندارد`);
    }
  }
});

test("نام‌های مستعار فارسی و انگلیسی برای ستون‌های کلیدی تعریف شده‌اند", () => {
  const eqp = templateByCode("TPL-EQP");
  const codeField = eqp.fields.find((f) => f.key === "Code");
  assert.ok(codeField.aliases.some((a) => /[\u0600-\u06FF]/.test(a)), "نام مستعار فارسی ندارد");
  assert.ok(codeField.aliases.some((a) => /^[A-Za-z]/.test(a)), "نام مستعار انگلیسی ندارد");
});

test("CSV و راهنمای هر قالب d9 تولید می‌شود", () => {
  for (const t of TEMPLATE_CATALOG.filter((x) => x.module === "d9")) {
    const csv = templateCsv(t);
    assert.ok(csv.split("\n").length >= 2, `${t.code} CSV ناقص`);
    const guide = templateGuide(t);
    assert.equal(guide.length, t.fields.length, `${t.code} راهنما ناقص است`);
    for (const g of guide) assert.ok(g.column && g.kind, `${t.code} سطر راهنما ناقص`);
  }
});

test("قالب دیسپچ کلید سه‌جزئی ماشین/تاریخ/شیفت دارد", () => {
  assert.deepEqual(templateByCode("TPL-DSP").keyFields, ["EquipmentId", "DispatchDate", "Shift"]);
});

test("قالب PM چهار پایهٔ دوره را پوشش می‌دهد", () => {
  const basis = templateByCode("TPL-PMS").fields.find((f) => f.key === "Basis");
  assert.deepEqual([...basis.enumValues].sort(), ["calendar_days", "cycles", "kilometers", "run_hours"]);
});

test("CSV تولیدشدهٔ هر قالب در برگشت کامل شناسایی می‌شود", () => {
  /* رگرسیون: عنوان میدان جزو نام‌های مستعار نبود و فایل خروجی خودِ قالب
   * هنگام ورود دو ستون ناشناخته می‌داد. */
  for (const t of TEMPLATE_CATALOG) {
    const headers = templateCsv(t).split("\r\n")[0].split(",");
    const map = mapHeaders(t, headers);
    assert.deepEqual(map.unmatched, [], `${t.code}: ستون ناشناخته در رفت‌وبرگشت`);
    assert.deepEqual(map.missingRequired, [], `${t.code}: میدان اجباری گم شد`);
  }
});

test("مخاطب مجاز هر گزارش با کاتالوگ کنترل‌پذیر است", () => {
  /* پشتوانهٔ کد E-EQP-RPT-AUDIENCE در لایهٔ REST: گزارش داخلی‌محور نباید
   * مخاطب رسمی بپذیرد و برعکس، گزارش‌های رسمی باید هر دو را بپذیرند. */
  assert.ok(!EQP_REPORT_BY_CODE["RPT-EQP-PART"].audiences.includes("official"));
  for (const code of ["RPT-EQP-DSP", "RPT-EQP-CARD", "RPT-EQP-MNT", "RPT-EQP-PERF", "RPT-EQP-COST"]) {
    assert.ok(EQP_REPORT_BY_CODE[code].audiences.includes("internal"), `${code} مخاطب داخلی ندارد`);
    assert.ok(EQP_REPORT_BY_CODE[code].audiences.includes("official"), `${code} مخاطب رسمی ندارد`);
  }
});

/* ─────────────── گزارش یک‌صفحه‌ای مدیرعامل ─────────────── */

test("گزارش مدیرعامل دقیقاً شش بلوک دارد", () => {
  const rep = buildExecutiveOnePager(EXEC_IN);
  assert.equal(rep.code, "RPT-EQP-EXEC");
  assert.equal(rep.sections.length, 6, "برگ مدیرعامل باید شش بلوک باشد");
  for (let i = 0; i < 6; i += 1) {
    assert.ok(rep.sections[i].title.fa.startsWith(["۱", "۲", "۳", "۴", "۵", "۶"][i]), `بلوک ${i + 1} شماره‌گذاری ندارد`);
  }
});

test("گزارش مدیرعامل روی یک برگ A4 جا می‌شود", () => {
  assert.equal(estimatePages(buildExecutiveOnePager(EXEC_IN)), 1, "برگ مدیرعامل نباید به صفحهٔ دوم برود");
});

test("انحراف بودجه درست محاسبه می‌شود", () => {
  const rep = buildExecutiveOnePager(EXEC_IN);
  const txt = JSON.stringify(rep);
  /* (834665361 − 1000000000) / 1000000000 = −16.53٪ */
  assert.ok(txt.includes("-16.53"), "انحراف بودجه غلط است");
});

test("بودجهٔ ثبت‌نشده انحراف را صفر نشان نمی‌دهد", () => {
  const rep = buildExecutiveOnePager({ ...EXEC_IN, cost: { budget: 0, actual: 5e8 } });
  const txt = JSON.stringify(rep);
  assert.ok(txt.includes("سنجش‌ناپذیر"), "بودجهٔ نبود باید سنجش‌ناپذیر بدهد نه صفر");
  assert.ok(!/"value":\s*"0٪"/.test(txt), "انحراف صفر ساختگی تولید شد");
});

test("فقط هشدار بحرانی در برگ مدیرعامل می‌آید", () => {
  const rep = buildExecutiveOnePager(EXEC_IN);
  const block6 = rep.sections[5];
  assert.equal(block6.rows.length, 1, "هشدار غیربحرانی نباید در برگ مدیرعامل بیاید");
  assert.equal(block6.rows[0].code, "EWS-EQP-03");
});

test("نبود هشدار بحرانی جدول خالی نمی‌گذارد", () => {
  const rep = buildExecutiveOnePager({ ...EXEC_IN, alerts: [] });
  const block6 = rep.sections[5];
  assert.equal(block6.rows.length, 1);
  assert.ok(/وجود ندارد/.test(block6.rows[0].msg));
});

test("شاخص سنجش‌ناپذیر در برگ مدیرعامل عدد ساختگی نمی‌گیرد", () => {
  const rep = buildExecutiveOnePager({ ...EXEC_IN, board: { ...BOARD, oee: null, mtbf: null, mttrHours: null, mtbfHours: null } });
  const txt = JSON.stringify(rep);
  assert.ok(txt.includes("سنجش‌ناپذیر"));
  assert.ok(!/OEE[^}]*:\s*0\b/.test(txt), "OEE صفر ساختگی");
});

test("ارزیابی «در هدف/خارج از هدف» با جهت شاخص هم‌خوان است", () => {
  const rep = buildExecutiveOnePager(EXEC_IN);
  const rows = rep.sections[1].rows;
  const util = rows.find((r) => r.metric === "بهره‌برداری");
  const sfc = rows.find((r) => r.metric === "مصرف ویژه سوخت");
  /* بهره‌برداری ۶۸.۱ زیر هدف ۷۰ → خارج؛ مصرف ۱۷.۴ زیر سقف ۱۸ → در هدف */
  assert.equal(util.verdict, "خارج از هدف");
  assert.equal(sfc.verdict, "در هدف");
});
