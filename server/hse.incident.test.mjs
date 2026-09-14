import test from "node:test";
import assert from "node:assert/strict";
import { SCHEMA, MIGRATIONS } from "./sqlLogic.js";
import {
  INJURY_TYPES, INJURY_TYPE_FA, BODY_PARTS, BODY_PART_FA,
  CAUSE_LEVELS, CAUSE_LEVEL_FA, CAUSE_CATEGORIES, CAUSE_CATEGORY_FA,
  CAPA_TYPES, CAPA_TYPE_FA, CAPA_STATUSES, INVESTIGATION_STATUS_FA,
  INVESTIGATION_REQUIRED_TYPES, FLASH_REPORT_SLA_MINUTES,
  MIN_ROOT_CAUSE_DEPTH, ICEBERG_RATIO_MIN,
  validateInjuredPersonInput, validateRootCauseInput, validateCapaInput,
  flashReportStatus, injurySummary, rootCauseTree, capaSummary,
  requiresInvestigation, canCloseInvestigation, canCloseIncidentFull,
  manHourTotal, safetyMetricsFull,
  safetyMetrics, canCloseIncident,
} from "./hseLogic.js";

/* ══════════════ اسکیما ══════════════ */

test("پنج جدول حوادث و اقدام اصلاحی در اسکیما هستند", () => {
  for (const n of ["InjuredPerson", "HSE_Investigation", "RootCauseNode", "CapaAction", "HSE_ManHourLog"]) {
    const t = SCHEMA.find((x) => x.name === n);
    assert.ok(t, `${n} نیست`);
    assert.equal(t.module, "d16");
  }
});

test("SafetyIncident پنج ستون تازه گرفته و ستون‌های قبلی حفظ شده‌اند", () => {
  const t = SCHEMA.find((x) => x.name === "SafetyIncident");
  for (const c of ["PermitId", "FlashReportAt", "IsEmergencyActivated", "GpsLat", "GpsLng"]) {
    assert.ok(t.columns.some((x) => x.name === c), `${c} افزوده نشده`);
  }
  /* ستون متنی قدیمی برای دادهٔ تاریخی می‌ماند. */
  assert.ok(t.columns.some((x) => x.name === "InjuredPersonFa"), "ستون قدیمی نباید حذف شود");
  assert.ok(t.columns.some((x) => x.name === "LostDays"), "ستون قدیمی نباید حذف شود");
});

test("ستون‌های افزوده به SafetyIncident همه nullable هستند", () => {
  const t = SCHEMA.find((x) => x.name === "SafetyIncident");
  for (const c of ["PermitId", "FlashReportAt", "IsEmergencyActivated", "GpsLat", "GpsLng"]) {
    assert.notEqual(t.columns.find((x) => x.name === c).nullable, false, `${c} روی دادهٔ موجود می‌شکند`);
  }
});

test("مهاجرت 0018 فقط ستون می‌افزاید و چیزی حذف نمی‌کند", () => {
  const m = MIGRATIONS.find((x) => x.version === "0018");
  assert.ok(m);
  assert.equal(m.statements.filter((s) => s.includes("DROP")).length, 0);
  assert.equal(m.statements.filter((s) => s.includes("COL_LENGTH")).length, 5, "هر پنج ستون گارد دارد");
  for (const s of m.statements.filter((x) => x.includes("ALTER TABLE"))) {
    assert.match(s, /ADD/, "تنها ALTER مجاز افزودن ستون است");
  }
});

test("مهاجرت‌های پیشین دست‌نخورده مانده‌اند", () => {
  const v = MIGRATIONS.map((m) => m.version);
  for (const prev of ["0015", "0016", "0017"]) {
    assert.ok(v.includes(prev), `مهاجرت ${prev} نباید حذف شود`);
  }
  assert.ok(v.includes("0019"), "مهاجرت تخلف و توقف کار نباید حذف شود");
  /* «آخرین مهاجرت» ادعای شکننده‌ای است: هر ماژول بعدی آن را
   * می‌شکند بی‌آنکه چیزی دربارهٔ این ماژول بگوید. چیزی که باید
   * ثابت بماند نبودن شکاف و ترتیب صعودی است. */
  assert.deepEqual([...v].sort(), v, "ترتیب مهاجرت‌ها باید صعودی بماند");
  assert.equal(new Set(v).size, v.length, "شمارهٔ مهاجرت تکراری");
});

test("یکتایی مصدوم، تحقیق و اقدام در اسکیما تضمین شده", () => {
  const ip = SCHEMA.find((x) => x.name === "InjuredPerson");
  assert.deepEqual(ip.indexes.find((i) => i.name === "UX_InjuredPerson").columns, ["IncidentId", "PersonNo"]);
  const inv = SCHEMA.find((x) => x.name === "HSE_Investigation");
  const ux = inv.indexes.find((i) => i.name === "UX_HseInvestigation");
  assert.ok(ux.unique);
  assert.deepEqual(ux.columns, ["IncidentId"], "هر حادثه فقط یک تحقیق");
  const capa = SCHEMA.find((x) => x.name === "CapaAction");
  assert.deepEqual(capa.indexes.find((i) => i.name === "UX_CapaAction").columns, ["SourceType", "SourceId", "ActionNo"]);
});

test("درخت ریشه‌یابی خودارجاع است", () => {
  const t = SCHEMA.find((x) => x.name === "RootCauseNode");
  const parent = t.columns.find((c) => c.name === "ParentId");
  assert.ok(parent);
  assert.notEqual(parent.nullable, false, "ریشهٔ درخت باید ParentId خالی داشته باشد");
  assert.ok(t.indexes.some((i) => i.name === "IX_RootCauseNode_Parent"), "پیمایش درخت باید ایندکس داشته باشد");
});

/* ══════════════ ثابت‌ها ══════════════ */

test("هر نوع آسیب و ناحیهٔ بدن برچسب فارسی دارد", () => {
  for (const t of INJURY_TYPES) assert.ok(INJURY_TYPE_FA[t], `${t} برچسب ندارد`);
  for (const b of BODY_PARTS) assert.ok(BODY_PART_FA[b], `${b} برچسب ندارد`);
});

test("سطوح علت از بی‌واسطه به ریشه‌ای مرتب‌اند", () => {
  assert.deepEqual(CAUSE_LEVELS, ["immediate", "underlying", "root"]);
  assert.equal(CAUSE_LEVEL_FA.root, "علت ریشه‌ای");
});

test("شش شاخهٔ استخوان ماهی کامل است", () => {
  assert.equal(CAUSE_CATEGORIES.length, 6);
  for (const c of CAUSE_CATEGORIES) assert.ok(CAUSE_CATEGORY_FA[c]);
});

test("تحقیق رسمی برای حادثهٔ سنگین اجباری است", () => {
  assert.ok(INVESTIGATION_REQUIRED_TYPES.includes("fatality"));
  assert.ok(INVESTIGATION_REQUIRED_TYPES.includes("lost_time"));
  assert.ok(!INVESTIGATION_REQUIRED_TYPES.includes("near_miss"), "شبه‌حادثه تحقیق رسمی لازم ندارد");
});

test("آستانه‌های عددی مطابق طراحی‌اند", () => {
  assert.equal(FLASH_REPORT_SLA_MINUTES, 15);
  assert.equal(MIN_ROOT_CAUSE_DEPTH, 3);
  assert.equal(ICEBERG_RATIO_MIN, 4);
  assert.deepEqual(CAPA_TYPES, ["corrective", "preventive"]);
  assert.equal(CAPA_TYPE_FA.preventive, "پیشگیرانه");
});

/* ══════════════ اعتبارسنجی ══════════════ */

test("مصدوم معتبر خطا ندارد", () => {
  assert.equal(validateInjuredPersonInput({ FullNameFa: "علی رضایی", InjuryType: "fracture", BodyPart: "arm", LostWorkDays: 12 }).length, 0);
});

test("مصدوم بدون نام یا با نوع آسیب نامعتبر رد می‌شود", () => {
  assert.match(validateInjuredPersonInput({ FullNameFa: "  ", InjuryType: "cut" })[0].code, /INJURED-NAME/);
  assert.match(validateInjuredPersonInput({ FullNameFa: "x", InjuryType: "خیالی" })[0].code, /INJURY-TYPE/);
  assert.match(validateInjuredPersonInput({ FullNameFa: "x", InjuryType: "cut", BodyPart: "دم" })[0].code, /BODY-PART/);
});

test("روز منفی رد می‌شود", () => {
  const r = validateInjuredPersonInput({ FullNameFa: "x", InjuryType: "cut", LostWorkDays: -3 });
  assert.match(r[0].code, /DAYS-RANGE/);
});

test("گره ریشه‌یابی بدون شرح یا با سطح نامعتبر رد می‌شود", () => {
  assert.match(validateRootCauseInput({ StatementFa: "", CauseLevel: "root" })[0].code, /CAUSE-STATEMENT/);
  assert.match(validateRootCauseInput({ StatementFa: "x", CauseLevel: "شاید" })[0].code, /CAUSE-LEVEL/);
  assert.match(validateRootCauseInput({ StatementFa: "x", CauseLevel: "root", Category: "جادو" })[0].code, /CAUSE-CATEGORY/);
});

test("اقدام بدون مسئول یا مهلت رد می‌شود", () => {
  const r = validateCapaInput({ ActionFa: "کاری", ActionType: "preventive" });
  const codes = r.map((x) => x.code).join();
  assert.match(codes, /CAPA-OWNER/);
  assert.match(codes, /CAPA-DUE/);
});

/* ══════════════ گزارش فوری ══════════════ */

const inc = (over = {}) => ({
  Id: "i1",
  ProjectId: "p1",
  IncidentNo: "INC-001",
  TitleFa: "سقوط از داربست",
  IncidentType: "lost_time",
  OccurredAt: "2026-09-09T08:00:00Z",
  ReportedBy: "u-site",
  Severity: "high",
  Status: "open",
  ...over,
});

test("گزارش در مهلت ۱۵ دقیقه تأیید می‌شود", () => {
  const r = flashReportStatus(inc({ FlashReportAt: "2026-09-09T08:10:00Z" }));
  assert.equal(r.reported, true);
  assert.equal(r.delayMinutes, 10);
  assert.equal(r.withinSla, true);
});

test("گزارش با تأخیر علامت می‌خورد", () => {
  const r = flashReportStatus(inc({ FlashReportAt: "2026-09-09T09:30:00Z" }));
  assert.equal(r.withinSla, false);
  assert.equal(r.delayMinutes, 90);
  assert.match(r.statusFa, /تأخیر/);
});

test("مرز دقیق ۱۵ دقیقه در مهلت است", () => {
  assert.equal(flashReportStatus(inc({ FlashReportAt: "2026-09-09T08:15:00Z" })).withinSla, true);
  assert.equal(flashReportStatus(inc({ FlashReportAt: "2026-09-09T08:16:00Z" })).withinSla, false);
});

test("رویداد گزارش‌نشده هرگز «در مهلت» نیست", () => {
  const fresh = flashReportStatus(inc(), new Date("2026-09-09T08:05:00Z"));
  assert.equal(fresh.reported, false);
  assert.equal(fresh.withinSla, false, "سکوت تأیید نیست حتی اگر تازه باشد");
  assert.equal(fresh.pendingMinutes, 5);

  const late = flashReportStatus(inc(), new Date("2026-09-09T10:00:00Z"));
  assert.match(late.statusFa, /مهلت گذشته/);
});

test("زمان نامعتبر استثنا نمی‌دهد", () => {
  assert.doesNotThrow(() => flashReportStatus(inc({ OccurredAt: "دیروز" })));
  assert.doesNotThrow(() => flashReportStatus(inc({ FlashReportAt: "زود" })));
  assert.equal(flashReportStatus(inc({ OccurredAt: "دیروز" })).withinSla, false);
});

/* ══════════════ مصدومان ══════════════ */

const PERSONS = [
  { Id: "x1", IncidentId: "i1", PersonNo: 1, FullNameFa: "علی", InjuryType: "fracture", BodyPart: "arm", LostWorkDays: 20, RestrictedDays: 5, ReturnedToWork: false },
  { Id: "x2", IncidentId: "i1", PersonNo: 2, FullNameFa: "رضا", InjuryType: "cut", BodyPart: "hand", LostWorkDays: 3, ReturnedToWork: true },
  { Id: "x3", IncidentId: "i2", PersonNo: 1, FullNameFa: "حسن", InjuryType: "burn", BodyPart: "hand", LostWorkDays: 7 },
];

test("خلاصهٔ مصدومان فقط حادثهٔ خودش را می‌شمارد", () => {
  const r = injurySummary(PERSONS, "i1");
  assert.equal(r.count, 2);
  assert.equal(r.totalLostDays, 23, "جمع دو مصدوم، نه ستون واحد حادثه");
  assert.equal(r.maxLostDays, 20);
  assert.equal(r.totalRestrictedDays, 5);
});

test("بازگشت به کار جدا شمرده می‌شود", () => {
  const r = injurySummary(PERSONS, "i1");
  assert.equal(r.returnedCount, 1);
  assert.equal(r.stillOffWork, 1, "علی هنوز برنگشته و روز از دست رفته دارد");
});

test("کلیدهای نوع آسیب و ناحیه از پیش صفر می‌شوند", () => {
  const r = injurySummary([], "none");
  for (const t of INJURY_TYPES) assert.equal(r.byInjuryType[t], 0, `کلید ${t} غایب است`);
  for (const b of BODY_PARTS) assert.equal(r.byBodyPart[b], 0, `کلید ${b} غایب است`);
  assert.equal(r.count, 0);
});

test("مصدوم بدون روز از دست رفته «سر کار نیامده» شمرده نمی‌شود", () => {
  const r = injurySummary([{ Id: "z", IncidentId: "i9", PersonNo: 1, FullNameFa: "x", InjuryType: "cut" }], "i9");
  assert.equal(r.stillOffWork, 0, "بدون روز از دست رفته یعنی سر کار است");
});

/* ══════════════ درخت ریشه‌یابی ══════════════ */

const node = (id, parent, depth, level, over = {}) =>
  ({ Id: id, InvestigationId: "inv1", NodeNo: Number(id.slice(1)), ParentId: parent, Depth: depth, StatementFa: `علت ${id}`, CauseLevel: level, ...over });

const TREE = [
  node("n1", null, 0, "immediate"),
  node("n2", "n1", 1, "underlying", { Category: "method" }),
  node("n3", "n1", 1, "underlying", { Category: "man" }),
  node("n4", "n2", 2, "root", { Category: "management", IsVerified: true }),
  node("n5", "n3", 2, "root", { Category: "man" }),
];

test("درخت سالم عمق و سطوح را درست می‌دهد", () => {
  const r = rootCauseTree(TREE, "inv1");
  assert.equal(r.total, 5);
  assert.equal(r.maxDepth, 2);
  /* عمق صفرمبناست، پس سه لایه. */
  assert.equal(r.layerCount, 3);
  assert.equal(r.byLevel.root, 2);
  assert.equal(r.byLevel.underlying, 2);
  assert.equal(r.rootCauses.length, 2);
  assert.equal(r.verifiedRoots, 1);
  assert.equal(r.orphanIds.length, 0);
  assert.equal(r.cyclicIds.length, 0);
});

test("یک «چرا» می‌تواند چند پاسخ داشته باشد", () => {
  const r = rootCauseTree(TREE, "inv1");
  const children = TREE.filter((n) => n.ParentId === "n1");
  assert.equal(children.length, 2, "ساختار درختی باید چند شاخه بپذیرد");
  assert.equal(r.byCategory.man, 2);
});

test("گره یتیم شناسایی می‌شود", () => {
  const r = rootCauseTree([...TREE, node("n6", "غایب", 3, "root")], "inv1");
  assert.deepEqual(r.orphanIds, ["n6"]);
  assert.match(r.warningsFa.join(), /والد ناموجود/);
});

test("حلقهٔ ارجاعی شناسایی می‌شود و استثنا نمی‌دهد", () => {
  const cyc = [
    { Id: "c1", InvestigationId: "inv2", NodeNo: 1, ParentId: "c2", Depth: 0, StatementFa: "الف", CauseLevel: "root" },
    { Id: "c2", InvestigationId: "inv2", NodeNo: 2, ParentId: "c1", Depth: 1, StatementFa: "ب", CauseLevel: "root" },
  ];
  assert.doesNotThrow(() => rootCauseTree(cyc, "inv2"));
  const r = rootCauseTree(cyc, "inv2");
  assert.equal(r.cyclicIds.length, 2);
  assert.match(r.warningsFa.join(), /حلقه/);
});

test("درخت بدون علت ریشه‌ای هشدار می‌دهد", () => {
  const r = rootCauseTree([node("m1", null, 0, "immediate")], "inv1");
  assert.match(r.warningsFa.join(), /علت ریشه‌ای/);
});

test("درخت خالی کلیدها را صفر می‌دهد", () => {
  const r = rootCauseTree([], "nope");
  assert.equal(r.total, 0);
  for (const l of CAUSE_LEVELS) assert.equal(r.byLevel[l], 0);
  assert.equal(r.warningsFa.length, 0, "درخت خالی هشدار «بدون ریشه» نمی‌دهد");
});

/* ══════════════ CAPA ══════════════ */

const NOW = new Date("2026-09-09T12:00:00Z");
const capa = (no, type, status, due, over = {}) =>
  ({ Id: "a" + no, SourceType: "investigation", SourceId: "inv1", ActionNo: no, ActionFa: `اقدام ${no}`, ActionType: type, OwnerRef: "u-hse", DueDate: due, Status: status, ...over });

test("خلاصهٔ CAPA کلیدهای همهٔ وضعیت‌ها را صفر می‌کند", () => {
  const r = capaSummary([], NOW);
  for (const s of CAPA_STATUSES) assert.equal(r.byStatus[s], 0, `کلید ${s} غایب است`);
  for (const t of CAPA_TYPES) assert.equal(r.byType[t], 0);
  assert.equal(r.hasPreventive, false);
});

test("اقدام دارای تأخیر شناسایی می‌شود", () => {
  const r = capaSummary([capa(1, "corrective", "open", "2026-09-01")], NOW);
  assert.equal(r.overdue, 1);
  assert.match(r.overdueFa[0], /8 روز تأخیر/);
});

test("اقدام نزدیک مهلت جدا شمرده می‌شود", () => {
  const r = capaSummary([capa(1, "preventive", "in_progress", "2026-09-14")], NOW);
  assert.equal(r.dueSoon, 1);
  assert.equal(r.overdue, 0);
});

test("اقدام بسته‌شده در تأخیر شمرده نمی‌شود", () => {
  const r = capaSummary([capa(1, "corrective", "verified", "2026-08-01")], NOW);
  assert.equal(r.overdue, 0, "اقدام تأییدشده دیگر تأخیر ندارد");
  assert.equal(r.verified, 1);
});

test("اقدام پیشگیرانهٔ لغوشده به حساب نمی‌آید", () => {
  const r = capaSummary([capa(1, "preventive", "cancelled", "2026-10-01")], NOW);
  assert.equal(r.hasPreventive, false, "اقدام لغوشده جلوی تکرار را نمی‌گیرد");
});

test("مهلت نامعتبر استثنا نمی‌دهد", () => {
  assert.doesNotThrow(() => capaSummary([capa(1, "corrective", "open", "شاید")], NOW));
});

/* ══════════════ الزام تحقیق ══════════════ */

test("حادثهٔ منجر به فوت تحقیق رسمی لازم دارد", () => {
  const r = requiresInvestigation(inc({ IncidentType: "fatality", Severity: "critical" }));
  assert.equal(r.required, true);
});

test("شبه‌حادثهٔ کم‌شدت تحقیق رسمی لازم ندارد", () => {
  const r = requiresInvestigation(inc({ IncidentType: "near_miss", Severity: "low" }));
  assert.equal(r.required, false);
  assert.equal(r.reasonFa, null);
});

test("شدت بالا حتی در نوع سبک تحقیق را الزامی می‌کند", () => {
  const r = requiresInvestigation(inc({ IncidentType: "near_miss", Severity: "critical" }));
  assert.equal(r.required, true);
  assert.match(r.reasonFa, /شدت/);
});

/* ══════════════ دروازهٔ تحقیق ══════════════ */

const invRow = (over = {}) => ({
  Id: "inv1", ProjectId: "p1", IncidentId: "i1",
  LeadInvestigator: "u-hse", StartedAt: "2026-09-09", Status: "in_progress", ...over,
});

test("تحقیق کامل بسته می‌شود", () => {
  const r = canCloseInvestigation({
    investigation: invRow(),
    nodes: [...TREE, node("n7", "n4", 3, "root", { IsVerified: true })],
    actions: [capa(1, "corrective", "completed", "2026-10-01"), capa(2, "preventive", "completed", "2026-10-01")],
    approverId: "u-qa",
  });
  assert.equal(r.ok, true, r.blockersFa.join(" | "));
});

test("تحقیق بدون اقدام پیشگیرانه بسته نمی‌شود", () => {
  const r = canCloseInvestigation({
    investigation: invRow(),
    nodes: [...TREE, node("n7", "n4", 3, "root")],
    actions: [capa(1, "corrective", "completed", "2026-10-01")],
    approverId: "u-qa",
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /پیشگیرانه/);
});

test("عمق ناکافی ریشه‌یابی مانع است", () => {
  const r = canCloseInvestigation({
    investigation: invRow(),
    nodes: [node("n1", null, 0, "immediate"), node("n2", "n1", 1, "root")],
    actions: [capa(1, "preventive", "completed", "2026-10-01")],
    approverId: "u-qa",
  });
  assert.equal(r.ok, false);
  /* دو گره یعنی دو لایه، و آستانه سه لایه است. */
  assert.match(r.blockersFa.join(), /ریشه‌یابی 2 لایه دارد/);
});

test("درخت خالی مانع بستن تحقیق است", () => {
  const r = canCloseInvestigation({
    investigation: invRow(),
    nodes: [],
    actions: [capa(1, "preventive", "completed", "2026-10-01")],
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /درخت ریشه‌یابی خالی/);
});

test("سرپرست تحقیق نمی‌تواند تحقیق خودش را تأیید کند", () => {
  const r = canCloseInvestigation({
    investigation: invRow(),
    nodes: [...TREE, node("n7", "n4", 3, "root")],
    actions: [capa(1, "preventive", "completed", "2026-10-01")],
    approverId: "u-hse",
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /سرپرست تحقیق/);
});

test("حلقه در درخت مانع بستن است", () => {
  const cyc = [
    { Id: "c1", InvestigationId: "inv1", NodeNo: 1, ParentId: "c2", Depth: 0, StatementFa: "الف", CauseLevel: "root" },
    { Id: "c2", InvestigationId: "inv1", NodeNo: 2, ParentId: "c1", Depth: 3, StatementFa: "ب", CauseLevel: "root" },
  ];
  const r = canCloseInvestigation({
    investigation: invRow(),
    nodes: cyc,
    actions: [capa(1, "preventive", "completed", "2026-10-01")],
    approverId: "u-qa",
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /حلقه/);
});

test("هزینهٔ غیرمستقیم ثبت‌نشده هشدار می‌دهد نه مانع", () => {
  const r = canCloseInvestigation({
    investigation: invRow({ DirectCost: 500000000, IndirectCost: 0 }),
    nodes: [...TREE, node("n7", "n4", 3, "root")],
    actions: [capa(1, "preventive", "completed", "2026-10-01")],
    approverId: "u-qa",
  });
  assert.equal(r.ok, true);
  assert.match(r.warningsFa.join(), /غیرمستقیم/);
});

test("نسبت کوه یخ کمتر از ۴ برابر هشدار می‌گیرد", () => {
  const r = canCloseInvestigation({
    investigation: invRow({ DirectCost: 1000, IndirectCost: 2000 }),
    nodes: [...TREE, node("n7", "n4", 3, "root")],
    actions: [capa(1, "preventive", "completed", "2026-10-01")],
    approverId: "u-qa",
  });
  assert.match(r.warningsFa.join(), /کم‌برآوردی/);
});

/* ══════════════ دروازهٔ بستن رویداد ══════════════ */

test("حادثهٔ سنگین بدون تحقیق تأییدشده بسته نمی‌شود", () => {
  const r = canCloseIncidentFull({ incident: inc(), investigation: null });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /تحقیقی ثبت نشده/);
});

test("تحقیق تکمیل‌نشده مانع بستن رویداد است", () => {
  const r = canCloseIncidentFull({ incident: inc(), investigation: invRow({ Status: "in_progress" }) });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /باید تأیید شود/);
});

test("تحقیق تأییدشده با درخت خالی یعنی تأیید صوری", () => {
  const r = canCloseIncidentFull({
    incident: inc(),
    investigation: invRow({ Status: "approved" }),
    nodes: [],
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /هیچ علت ریشه‌ای/);
});

test("حادثهٔ سنگین با تحقیق تأییدشده و اقدام بسته می‌شود", () => {
  const r = canCloseIncidentFull({
    incident: inc(),
    investigation: invRow({ Status: "approved" }),
    nodes: TREE,
    actions: [capa(1, "preventive", "verified", "2026-09-01")],
  });
  assert.equal(r.ok, true, r.blockersFa.join(" | "));
});

test("اقدام باز مانع بستن رویداد است", () => {
  const r = canCloseIncidentFull({
    incident: inc(),
    investigation: invRow({ Status: "approved" }),
    nodes: TREE,
    actions: [capa(1, "preventive", "open", "2026-10-01")],
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /اقدام اصلاحی هنوز باز/);
});

test("رویداد سبک تحقیق لازم ندارد ولی علت و اقدام می‌خواهد", () => {
  const light = inc({ IncidentType: "near_miss", Severity: "low" });
  const bare = canCloseIncidentFull({ incident: light });
  assert.equal(bare.ok, false);
  assert.match(bare.blockersFa.join(), /ریشه‌یابی/);

  const done = canCloseIncidentFull({
    incident: inc({ IncidentType: "near_miss", Severity: "low", RootCauseFa: "لغزندگی کف", CorrectiveActionFa: "نصب تابلو" }),
  });
  assert.equal(done.ok, true, done.blockersFa.join());
});

test("مصدوم بازنگشته هشدار است نه مانع", () => {
  const r = canCloseIncidentFull({
    incident: inc(),
    investigation: invRow({ Status: "approved" }),
    nodes: TREE,
    actions: [capa(1, "preventive", "verified", "2026-09-01")],
    persons: PERSONS,
  });
  assert.equal(r.ok, true);
  assert.match(r.warningsFa.join(), /بازنگشته/);
});

test("تأخیر گزارش فوری در بستن رویداد یادآوری می‌شود", () => {
  const r = canCloseIncidentFull({
    incident: inc({ FlashReportAt: "2026-09-09T11:00:00Z" }),
    investigation: invRow({ Status: "approved" }),
    nodes: TREE,
    actions: [capa(1, "preventive", "verified", "2026-09-01")],
  });
  assert.match(r.warningsFa.join(), /تأخیر/);
});

/* ══════════════ نفرساعت ══════════════ */

const LOGS = [
  { Id: "h1", ProjectId: "p1", LogDate: "2026-09-01", ManHours: 1200, HeadCount: 150, SourceFa: "timesheet" },
  { Id: "h2", ProjectId: "p1", LogDate: "2026-09-02", ManHours: 1300, HeadCount: 160, SourceFa: "timesheet" },
  { Id: "h3", ProjectId: "p1", LogDate: "2026-09-03", ManHours: 800, SourceFa: "manual" },
];

test("جمع نفرساعت با منبع تفکیک می‌شود", () => {
  const r = manHourTotal(LOGS);
  assert.equal(r.totalHours, 3300);
  assert.equal(r.dayCount, 3);
  assert.equal(r.bySource.timesheet, 2500);
  assert.equal(r.bySource.manual, 800);
  assert.equal(r.avgHeadCount, 155);
});

test("بازهٔ زمانی رعایت می‌شود", () => {
  const r = manHourTotal(LOGS, "2026-09-02", "2026-09-03");
  assert.equal(r.totalHours, 2100);
  assert.equal(r.dayCount, 2);
});

test("سیاههٔ نامعتبر شمرده می‌شود ولی در جمع نمی‌آید", () => {
  const r = manHourTotal([...LOGS, { Id: "bad", ProjectId: "p1", LogDate: "نامعلوم", ManHours: 999, SourceFa: "manual" }]);
  assert.equal(r.invalidCount, 1);
  assert.equal(r.totalHours, 3300, "مقدار نامعتبر نباید در جمع بیاید");
});

test("نفرساعت منفی نامعتبر است", () => {
  const r = manHourTotal([{ Id: "n", ProjectId: "p1", LogDate: "2026-09-01", ManHours: -100, SourceFa: "manual" }]);
  assert.equal(r.invalidCount, 1);
  assert.equal(r.totalHours, 0);
});

/* ══════════════ شاخص‌های کامل ══════════════ */

test("شاخص‌ها با نفرساعت واقعی محاسبه می‌شوند", () => {
  const r = safetyMetricsFull({
    incidents: [inc(), inc({ Id: "i2", IncidentType: "medical_treatment", Severity: "medium" })],
    persons: PERSONS,
    manHourLogs: LOGS,
  });
  assert.equal(r.manHours, 3300);
  assert.equal(r.lostTime, 1);
  assert.equal(r.recordable, 2);
  assert.equal(r.lostDays, 30, "جمع سه مصدوم هر دو حادثه");
  assert.ok(r.ltifr > 0);
  assert.ok(r.severityRate > 0);
});

test("بدون نفرساعت شاخص null است نه صفر", () => {
  const r = safetyMetricsFull({ incidents: [inc()], persons: PERSONS, manHourLogs: [] });
  assert.equal(r.ltifr, null, "صفر یعنی «ایمن» و گمراه‌کننده است");
  assert.equal(r.trir, null);
  assert.equal(r.severityRate, null);
  assert.match(r.warningsFa.join(), /نفرساعت ثبت نشده/);
});

test("نبود جدول مصدومان به ستون قدیمی برمی‌گردد", () => {
  const r = safetyMetricsFull({
    incidents: [inc({ LostDays: 14 })],
    persons: [],
    manHourLogs: LOGS,
  });
  assert.equal(r.lostDays, 14);
  assert.match(r.warningsFa.join(), /ستون قدیمی/);
});

test("شبه‌حادثه در شاخص ثبت‌شدنی نمی‌آید", () => {
  const r = safetyMetricsFull({
    incidents: [inc({ IncidentType: "near_miss", Severity: "low" })],
    manHourLogs: LOGS,
  });
  assert.equal(r.recordable, 0, "شبه‌حادثه ثبت‌شدنی نیست");
  assert.equal(r.nearMiss, 1);
  assert.equal(r.trir, 0);
});

/* ══════════════ سازگاری با بخش ۱ ══════════════ */

test("توابع بخش ۱ دست‌نخورده کار می‌کنند", () => {
  const legacy = safetyMetrics([inc()], 100000);
  assert.equal(legacy.lostTime, 1);
  assert.ok(legacy.ltifr > 0);

  const close = canCloseIncident(inc({ RootCauseFa: "الف", CorrectiveActionFa: "ب" }));
  assert.equal(close.ok, true, "دروازهٔ سادهٔ قبلی نباید بشکند");
});

/* ══════════════ رگرسیون: یافته‌های ۱۰ لوپ خودارزیابی D5 ══════════════ */

test("لوپ ۳ — زمان گزارش پیش از وقوع خطای داده اعلام می‌شود", () => {
  const r = flashReportStatus({
    Id: "i", ProjectId: "p", IncidentNo: "1", TitleFa: "t", IncidentType: "near_miss",
    OccurredAt: "2026-09-01T10:00:00.000Z", ReportedBy: "u", Severity: "low", Status: "open",
    FlashReportAt: "2026-09-01T09:30:00.000Z",
  });
  assert.equal(r.withinSla, false, "تأخیر منفی نباید در مهلت شمرده شود");
  assert.match(r.statusFa, /پیش از زمان وقوع/);
});

test("لوپ ۸ — بازهٔ زمانی روی رویدادها هم اعمال می‌شود", () => {
  const inc = (id, type, at) => ({
    Id: id, ProjectId: "p", IncidentNo: id, TitleFa: "t", IncidentType: type,
    OccurredAt: at, ReportedBy: "u", Severity: "medium", Status: "open",
  });
  const incidents = [
    inc("1", "lost_time", "2026-01-05"),
    inc("2", "lost_time", "2026-02-10"),
    inc("3", "medical_treatment", "2026-03-01"),
    inc("4", "near_miss", "2026-04-01"),
  ];
  const persons = [
    { Id: "p1", IncidentId: "1", LostWorkDays: 20 },
    { Id: "p2", IncidentId: "2", LostWorkDays: 10 },
  ];
  const logs = [{ ProjectId: "p", LogDate: "2026-01-01", ManHours: 1_000_000, SourceFa: "manual" }];

  const q = safetyMetricsFull({ incidents, persons, manHourLogs: logs, from: "2026-02-01", to: "2026-03-31" });
  assert.equal(q.total, 2, "فقط دو رویداد در بازه است");
  assert.equal(q.lostTime, 1);
  assert.equal(q.lostDays, 10, "روزهای رویداد خارج بازه نباید شمرده شود");
  assert.equal(q.recordable, 2);

  const all = safetyMetricsFull({ incidents, persons, manHourLogs: logs });
  assert.equal(all.total, 4, "بدون بازه همه شمرده می‌شوند");
  assert.equal(all.lostDays, 30);
});

test("لوپ ۸ — روز پایان بازه به‌طور کامل در بر گرفته می‌شود", () => {
  const incidents = [{
    Id: "1", ProjectId: "p", IncidentNo: "1", TitleFa: "t", IncidentType: "near_miss",
    OccurredAt: "2026-03-01T18:30:00.000Z", ReportedBy: "u", Severity: "low", Status: "open",
  }];
  const r = safetyMetricsFull({ incidents, from: "2026-03-01", to: "2026-03-01" });
  assert.equal(r.total, 1, "رویداد بعدازظهرِ روز پایان نباید حذف شود");
});

test("لوپ ۲ — ستون پیمانکار نفرساعت اجباری است", () => {
  const t = SCHEMA.find((x) => x.name === "HSE_ManHourLog");
  const col = t.columns.find((c) => c.name === "ContractorFa");
  assert.equal(col.nullable, false, "ستون عضو ایندکس یکتا نباید nullable بماند");
  const ux = t.indexes.find((i) => i.unique);
  assert.deepEqual(ux.columns, ["ProjectId", "LogDate", "ContractorFa"]);
});
