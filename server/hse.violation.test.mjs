/**
 * آزمون موتور و اسکیما — MOD-08 / HSE، تحویلی D6.
 *
 * بازرسی، یافته، تخلف و دستور توقف کار (شکاف GH-04).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SCHEMA, MIGRATIONS } from "./sqlLogic.js";
import {
  FINDING_CATEGORIES, FINDING_CATEGORY_FA,
  VIOLATION_TYPES, VIOLATION_TYPE_FA,
  STOP_WORK_SCOPES, STOP_WORK_SCOPE_FA,
  VIOLATION_STATUSES, VIOLATION_STATUS_FA,
  FINDING_STATUSES, FINDING_STATUS_FA,
  MANDATORY_STOP_WORK_TYPES, VIOLATION_SLA_DAYS, INSPECTION_PASS_SCORE,
  validateFindingInput, validateViolationInput,
  stopWorkRequirement, suggestViolationDueDate,
  findingSummary, violationState, activityStopWorkState,
  canReleaseViolation, canCloseInspection, violationSummary,
  rfsuSafetyClearance,
} from "./hseLogic.js";

const byName = (n) => SCHEMA.find((t) => t.name === n);
const colsOf = (n) => new Set(byName(n).columns.map((c) => c.name));

/* ══════════════════════ ۱) اسکیما ══════════════════════ */

test("سه جدول تازهٔ D6 ساخته شده‌اند", () => {
  for (const n of ["InspectionFinding", "HSE_Violation", "ViolationClosure"]) {
    assert.ok(byName(n), `${n} نیست`);
    assert.equal(byName(n).module, "d16");
  }
  assert.ok(SCHEMA.length >= 122, "جدولی از اسکیما حذف شده است");
});

test("ستون قفل ایمنی به Activity افزوده شده و ستون‌های قفل قبلی سر جایشان‌اند", () => {
  const c = colsOf("Activity");
  assert.ok(c.has("IsStopWorkOrder"), "ستون قفل ایمنی نیست");
  assert.ok(c.has("BlockedByEquipmentId"), "قفل ماشین‌آلات نباید آسیب ببیند");
  assert.ok(c.has("BlockedByDocumentId"), "قفل مهندسی نباید آسیب ببیند");
});

test("ستون قفل ایمنی پیش‌فرض صفر دارد تا ردیف‌های موجود قفل نشوند", () => {
  const col = byName("Activity").columns.find((x) => x.name === "IsStopWorkOrder");
  assert.equal(col.kind, "bool");
  assert.equal(col.default, "0");
});

test("جدول SafetyInspection موجود دست‌نخورده مانده است", () => {
  const c = colsOf("SafetyInspection");
  for (const n of ["InspectionNo", "InspectionType", "FindingsCount", "ClosedFindings", "ScorePct"]) {
    assert.ok(c.has(n), `${n} نباید حذف شود`);
  }
});

test("مهاجرت 0019 افزوده شده و قبلی‌ها دست‌نخورده‌اند", () => {
  const v = MIGRATIONS.map((m) => m.version);
  assert.ok(v.includes("0015"), "مهاجرت ایمنی و بهداشت نباید حذف شود");
  assert.ok(v.includes("0016"), "مهاجرت ارزیابی ریسک شغلی نباید حذف شود");
  assert.ok(v.includes("0017"), "مهاجرت پروانهٔ کار نباید حذف شود");
  assert.ok(v.includes("0018"), "مهاجرت حادثه و اقدام اصلاحی نباید حذف شود");
  assert.ok(v.includes("0019"), "مهاجرت تخلف و توقف کار نیست");
  /* «آخرین مهاجرت» ادعای شکننده‌ای است: هر ماژول بعدی آن را
   * می‌شکند بی‌آنکه چیزی دربارهٔ این ماژول بگوید. چیزی که باید
   * ثابت بماند نبودن شکاف و ترتیب صعودی است. */
  assert.deepEqual([...v].sort(), v, "ترتیب مهاجرت‌ها باید صعودی بماند");
  assert.equal(new Set(v).size, v.length, "شمارهٔ مهاجرت تکراری");
});

test("مهاجرت 0019 هیچ چیزی حذف نمی‌کند", () => {
  const m = MIGRATIONS.find((x) => x.version === "0019");
  const sql = m.statements.join("\n");
  assert.ok(!/DROP\s+(TABLE|COLUMN)/i.test(sql), "مهاجرت نباید DROP داشته باشد");
  assert.match(sql, /ALTER TABLE .*Activity.* ADD .*IsStopWorkOrder/i);
  for (const t of ["InspectionFinding", "HSE_Violation", "ViolationClosure"]) {
    assert.ok(sql.includes(t), `${t} در مهاجرت نیست`);
  }
});

test("هیچ ایندکس یکتای D6 ستون nullable ندارد", () => {
  /* درس لوپ ۲ در D5: ایندکس یکتا با ستون nullable در SQL Server شرطی
   * می‌شود و یکتایی را از دست می‌دهد. */
  for (const n of ["InspectionFinding", "HSE_Violation", "ViolationClosure"]) {
    const t = byName(n);
    for (const ix of (t.indexes ?? []).filter((i) => i.unique)) {
      for (const cn of ix.columns) {
        const col = t.columns.find((c) => c.name === cn);
        assert.equal(col.nullable, false, `${n}.${cn} در ایندکس یکتا nullable است`);
      }
    }
  }
});

test("ایندکس پیمایش توقف کار وجود دارد", () => {
  const ix = byName("HSE_Violation").indexes.find((i) => i.name === "IX_HseViolation_Stop");
  assert.ok(ix, "بدون این ایندکس، پرسش «کدام فعالیت‌ها قفل‌اند» کل جدول را اسکن می‌کند");
  assert.deepEqual(ix.columns, ["ProjectId", "IsStopWork", "Status"]);
});

/* ══════════════════════ ۲) واژگان ══════════════════════ */

test("فهرست‌های کنترل‌شده کامل و دارای عنوان فارسی‌اند", () => {
  assert.equal(FINDING_CATEGORIES.length, 6);
  assert.equal(VIOLATION_TYPES.length, 6);
  assert.equal(STOP_WORK_SCOPES.length, 4);
  assert.equal(VIOLATION_STATUSES.length, 5);
  assert.equal(FINDING_STATUSES.length, 4);
  for (const [list, fa] of [
    [FINDING_CATEGORIES, FINDING_CATEGORY_FA],
    [VIOLATION_TYPES, VIOLATION_TYPE_FA],
    [STOP_WORK_SCOPES, STOP_WORK_SCOPE_FA],
    [VIOLATION_STATUSES, VIOLATION_STATUS_FA],
    [FINDING_STATUSES, FINDING_STATUS_FA],
  ]) {
    for (const code of list) {
      assert.ok(fa[code] && fa[code] !== code, `${code} عنوان فارسی ندارد`);
    }
  }
});

test("آستانه‌ها مقدار درست دارند", () => {
  assert.deepEqual(MANDATORY_STOP_WORK_TYPES, ["no_ptw"]);
  assert.equal(VIOLATION_SLA_DAYS.critical, 1);
  assert.equal(VIOLATION_SLA_DAYS.low, 14);
  assert.equal(INSPECTION_PASS_SCORE, 80);
});

/* ══════════════════════ ۳) اعتبارسنجی یافته ══════════════════════ */

test("یافتهٔ بدون شرح رد می‌شود", () => {
  const i = validateFindingInput({ Category: "ppe", Severity: "low" });
  assert.match(i.map((x) => x.code).join(), /E-HSE-FINDING-DESC/);
});

test("دسته و شدت نامعتبر یافته رد می‌شوند", () => {
  const i = validateFindingInput({ DescriptionFa: "x", Category: "cosmic", Severity: "extreme" });
  const codes = i.map((x) => x.code);
  assert.ok(codes.includes("E-HSE-FINDING-CATEGORY"));
  assert.ok(codes.includes("E-HSE-FINDING-SEVERITY"));
});

test("یافتهٔ معتبر بدون ایراد است", () => {
  assert.equal(
    validateFindingInput({ DescriptionFa: "کلاه ایمنی استفاده نشده", Category: "ppe", Severity: "medium" }).length,
    0,
  );
});

/* ══════════════════════ ۴) اعتبارسنجی تخلف ══════════════════════ */

const vBase = {
  ViolationNo: "V-001",
  TitleFa: "کار در ارتفاع بدون حمایل",
  ViolationType: "unsafe_act",
  Severity: "high",
  IssuedAt: "2026-09-01T08:00:00.000Z",
  IssuedBy: "u-hse",
};

test("تخلف معتبر بدون توقف کار پذیرفته می‌شود", () => {
  assert.equal(validateViolationInput(vBase).length, 0);
});

test("فیلدهای الزامی تخلف بررسی می‌شوند", () => {
  const codes = validateViolationInput({}).map((x) => x.code);
  for (const c of ["E-HSE-VIOLATION-NO", "E-HSE-VIOLATION-TITLE", "E-HSE-VIOLATION-TYPE", "E-HSE-VIOLATION-SEVERITY", "E-HSE-VIOLATION-ISSUER"]) {
    assert.ok(codes.includes(c), `${c} بررسی نشد`);
  }
});

test("توقف کار بدون دامنه رد می‌شود", () => {
  const i = validateViolationInput({ ...vBase, IsStopWork: true });
  assert.match(i.map((x) => x.code).join(), /E-HSE-SWO-SCOPE/);
});

test("توقف در سطح فعالیت بدون شناسهٔ فعالیت رد می‌شود", () => {
  const i = validateViolationInput({ ...vBase, IsStopWork: true, StopWorkScope: "activity" });
  assert.match(i.map((x) => x.code).join(), /E-HSE-SWO-ACTIVITY/);
});

test("توقف در سطح سیستم و منطقه هم مرجع می‌خواهد", () => {
  assert.match(
    validateViolationInput({ ...vBase, IsStopWork: true, StopWorkScope: "system" }).map((x) => x.code).join(),
    /E-HSE-SWO-SYSTEM/,
  );
  assert.match(
    validateViolationInput({ ...vBase, IsStopWork: true, StopWorkScope: "area" }).map((x) => x.code).join(),
    /E-HSE-SWO-AREA/,
  );
});

test("توقف در سطح کل پروژه مرجع اضافه نمی‌خواهد", () => {
  assert.equal(
    validateViolationInput({ ...vBase, IsStopWork: true, StopWorkScope: "project" }).length,
    0,
  );
});

test("جریمهٔ منفی رد می‌شود ولی صفر مجاز است", () => {
  assert.match(validateViolationInput({ ...vBase, FineAmount: -5 }).map((x) => x.code).join(), /E-HSE-VIOLATION-FINE/);
  assert.equal(validateViolationInput({ ...vBase, FineAmount: 0 }).length, 0);
});

/* ══════════════════════ ۵) الزام توقف کار ══════════════════════ */

test("کار بدون پروانه بدون استثنا توقف کار دارد", () => {
  const r = stopWorkRequirement({ ViolationType: "no_ptw", Severity: "low" });
  assert.equal(r.required, true, "حتی با شدت پایین");
  assert.match(r.reasonFa, /بدون استثنا/);
});

test("شدت بحرانی توقف کار دارد", () => {
  assert.equal(stopWorkRequirement({ ViolationType: "housekeeping", Severity: "critical" }).required, true);
});

test("تخلف عادی توقف کار الزامی ندارد", () => {
  const r = stopWorkRequirement({ ViolationType: "housekeeping", Severity: "low" });
  assert.equal(r.required, false);
  assert.equal(r.reasonFa, null);
});

test("مهلت پیشنهادی از شدت مشتق می‌شود", () => {
  assert.equal(suggestViolationDueDate("critical", "2026-09-01T00:00:00.000Z"), "2026-09-02");
  assert.equal(suggestViolationDueDate("medium", "2026-09-01T00:00:00.000Z"), "2026-09-08");
  assert.equal(suggestViolationDueDate("low", "2026-09-01T00:00:00.000Z"), "2026-09-15");
});

test("شدت ناشناخته یا تاریخ نامعتبر مهلت نمی‌سازد", () => {
  assert.equal(suggestViolationDueDate("unknown", "2026-09-01T00:00:00.000Z"), null);
  assert.equal(suggestViolationDueDate("high", "نامعتبر"), null);
});

/* ══════════════════════ ۶) خلاصهٔ یافته‌ها ══════════════════════ */

const f = (no, status, sev, cat, due) => ({
  Id: `f${no}`, ProjectId: "p", InspectionId: "insp1", FindingNo: no,
  DescriptionFa: `یافتهٔ شمارهٔ ${no}`, Category: cat, Severity: sev,
  DueDate: due ?? null, Status: status,
});

test("خلاصهٔ یافته درصد بستن را درست می‌دهد", () => {
  const r = findingSummary(
    [f(1, "closed", "low", "ppe"), f(2, "closed", "medium", "housekeeping"), f(3, "open", "high", "unsafe_act")],
    "insp1",
  );
  assert.equal(r.total, 3);
  assert.equal(r.closed, 2);
  assert.equal(r.open, 1);
  assert.equal(r.closureRatePct, 66.67);
});

test("یافتهٔ باطل‌شده از مخرج درصد بستن بیرون می‌ماند", () => {
  /* وگرنه می‌شد با ابطال یافته‌های سخت، درصد را مصنوعی بالا برد. */
  const r = findingSummary([f(1, "closed", "low", "ppe"), f(2, "void", "high", "unsafe_act")], "insp1");
  assert.equal(r.total, 2);
  assert.equal(r.closureRatePct, 100);
  assert.equal(r.open, 0);
});

test("بدون یافته درصد null است نه صفر", () => {
  const r = findingSummary([], "insp1");
  assert.equal(r.closureRatePct, null);
  assert.equal(r.hasCritical, false);
});

test("یافتهٔ معوق شناسایی می‌شود", () => {
  const r = findingSummary([f(1, "open", "high", "unsafe_act", "2026-01-01")], "insp1", new Date("2026-09-01"));
  assert.equal(r.overdue, 1);
  assert.equal(r.overdueFa.length, 1);
});

test("یافتهٔ بستهٔ گذشته از مهلت معوق شمرده نمی‌شود", () => {
  const r = findingSummary([f(1, "closed", "high", "unsafe_act", "2026-01-01")], "insp1", new Date("2026-09-01"));
  assert.equal(r.overdue, 0);
});

test("یافتهٔ بحرانی باز پرچم می‌گیرد ولی بسته‌اش نه", () => {
  assert.equal(findingSummary([f(1, "open", "critical", "unsafe_act")], "insp1").hasCritical, true);
  assert.equal(findingSummary([f(1, "closed", "critical", "unsafe_act")], "insp1").hasCritical, false);
});

test("یافتهٔ بازرسی دیگر وارد محاسبه نمی‌شود", () => {
  const other = { ...f(9, "open", "critical", "unsafe_act"), InspectionId: "insp2" };
  const r = findingSummary([f(1, "closed", "low", "ppe"), other], "insp1");
  assert.equal(r.total, 1);
  assert.equal(r.hasCritical, false);
});

test("کلیدهای دسته و شدت از پیش صفر شده‌اند", () => {
  const r = findingSummary([], "insp1");
  for (const c of FINDING_CATEGORIES) assert.equal(r.byCategory[c], 0, `${c} کلید ندارد`);
  for (const s of ["low", "medium", "high", "critical"]) assert.equal(r.bySeverity[s], 0);
});

/* ══════════════════════ ۷) وضعیت مؤثر تخلف ══════════════════════ */

const v = (over = {}) => ({
  Id: "v1", ProjectId: "p", ViolationNo: "V-001", TitleFa: "t",
  ViolationType: "unsafe_act", Severity: "high",
  IssuedAt: "2026-09-01T08:00:00.000Z", IssuedBy: "u-hse",
  IsStopWork: false, Status: "issued", ...over,
});

test("تخلف باز با توقف کار مسدودکننده است", () => {
  const s = violationState(v({ IsStopWork: true }));
  assert.equal(s.isOpen, true);
  assert.equal(s.isBlocking, true);
});

test("تخلف بسته دیگر مسدود نمی‌کند حتی اگر توقف کار داشته", () => {
  const s = violationState(v({ IsStopWork: true, Status: "closed" }));
  assert.equal(s.isOpen, false);
  assert.equal(s.isBlocking, false, "تخلف بسته نباید کار را قفل نگه دارد");
});

test("تخلف باطل‌شده هم مسدود نمی‌کند", () => {
  assert.equal(violationState(v({ IsStopWork: true, Status: "void" })).isBlocking, false);
});

test("تخلف باز بدون توقف کار مسدود نمی‌کند", () => {
  assert.equal(violationState(v({ IsStopWork: false })).isBlocking, false);
});

test("گذشتن از مهلت مستقل از ستون وضعیت تشخیص داده می‌شود", () => {
  const s = violationState(v({ Status: "in_progress", DueDate: "2026-09-05" }), new Date("2026-09-12"));
  assert.equal(s.isOverdue, true);
  assert.equal(s.overdueDays, 7);
  assert.match(s.slaFa, /۷|7/);
});

test("تخلف در مهلت معوق نیست", () => {
  const s = violationState(v({ DueDate: "2026-09-20" }), new Date("2026-09-12"));
  assert.equal(s.isOverdue, false);
  assert.equal(s.slaFa, "در مهلت");
});

test("تخلف بستهٔ گذشته از مهلت معوق شمرده نمی‌شود", () => {
  const s = violationState(v({ Status: "closed", DueDate: "2026-01-01" }), new Date("2026-09-12"));
  assert.equal(s.isOverdue, false);
  assert.equal(s.slaFa, "بسته");
});

/* ══════════════════════ ۸) قفل فعالیت ══════════════════════ */

test("توقف در سطح فعالیت همان فعالیت را قفل می‌کند", () => {
  const r = activityStopWorkState({
    activityId: "A-100",
    violations: [v({ IsStopWork: true, StopWorkScope: "activity", ActivityId: "A-100" })],
  });
  assert.equal(r.isLocked, true);
  assert.equal(r.blockingIds.length, 1);
  assert.match(r.reasonsFa[0], /سطح فعالیت/);
});

test("توقف روی فعالیت دیگر این فعالیت را قفل نمی‌کند", () => {
  const r = activityStopWorkState({
    activityId: "A-100",
    violations: [v({ IsStopWork: true, StopWorkScope: "activity", ActivityId: "A-200" })],
  });
  assert.equal(r.isLocked, false);
});

test("توقف در سطح منطقه فعالیت همان منطقه را می‌گیرد", () => {
  /* وگرنه با تغییر دامنه از فعالیت به منطقه می‌شد قفل را دور زد. */
  const r = activityStopWorkState({
    activityId: "A-100",
    areaFa: "واحد ۲۰۰",
    violations: [v({ IsStopWork: true, StopWorkScope: "area", AreaFa: "واحد ۲۰۰" })],
  });
  assert.equal(r.isLocked, true);
});

test("توقف در سطح سیستم فعالیت همان سیستم را می‌گیرد", () => {
  const r = activityStopWorkState({
    activityId: "A-100",
    systemId: "SYS-10",
    violations: [v({ IsStopWork: true, StopWorkScope: "system", SystemId: "SYS-10" })],
  });
  assert.equal(r.isLocked, true);
});

test("توقف در سطح کل پروژه همهٔ فعالیت‌ها را قفل می‌کند", () => {
  const r = activityStopWorkState({
    activityId: "هر-فعالیتی",
    violations: [v({ IsStopWork: true, StopWorkScope: "project" })],
  });
  assert.equal(r.isLocked, true);
});

test("منطقهٔ متفاوت قفل نمی‌شود", () => {
  const r = activityStopWorkState({
    activityId: "A-100",
    areaFa: "واحد ۳۰۰",
    violations: [v({ IsStopWork: true, StopWorkScope: "area", AreaFa: "واحد ۲۰۰" })],
  });
  assert.equal(r.isLocked, false);
});

test("چند تخلف مسدودکننده همه فهرست می‌شوند", () => {
  const r = activityStopWorkState({
    activityId: "A-100",
    violations: [
      v({ Id: "v1", ViolationNo: "V-1", IsStopWork: true, StopWorkScope: "activity", ActivityId: "A-100" }),
      v({ Id: "v2", ViolationNo: "V-2", IsStopWork: true, StopWorkScope: "project" }),
      v({ Id: "v3", ViolationNo: "V-3", IsStopWork: true, StopWorkScope: "activity", ActivityId: "A-100", Status: "closed" }),
    ],
  });
  assert.equal(r.blockingIds.length, 2, "تخلف بسته نباید شمرده شود");
  assert.deepEqual(r.blockingIds, ["v1", "v2"]);
});

test("دامنهٔ نامشخص هیچ فعالیتی را قفل نمی‌کند", () => {
  /* پیش‌فرض محافظه‌کارانه: دامنهٔ خالی نباید ناخواسته چیزی را قفل کند —
   * نه فعالیت نام‌برده و نه کل پروژه. یافتهٔ لوپ ۵. */
  for (const id of ["A-999", "A-100"]) {
    const r = activityStopWorkState({
      activityId: id,
      violations: [v({ IsStopWork: true, StopWorkScope: null, ActivityId: "A-100" })],
    });
    assert.equal(r.isLocked, false, `${id} نباید قفل شود`);
  }
});

/* ══════════════════════ ۹) دروازهٔ آزادسازی ══════════════════════ */

const closure = (no, ok, over = {}) => ({
  Id: `c${no}`, ProjectId: "p", ViolationId: "v1", AttemptNo: no,
  ReInspectedAt: "2026-09-05T10:00:00.000Z", ReInspectedBy: "u-hse",
  IsSatisfactory: ok, ...over,
});

const capa = (id, status, over = {}) => ({
  Id: id, ProjectId: "p", SourceType: "violation", SourceId: "v1", ActionNo: 1,
  ActionFa: "اقدام", ActionType: "corrective", OwnerRef: "u-site",
  DueDate: "2026-12-01", Status: status, ...over,
});

test("آزادسازی بدون بازبینی مجدد مسدود است", () => {
  const r = canReleaseViolation({ violation: v(), closures: [], releaserId: "u-qa" });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /بازبینی مجدد انجام نشده/);
});

test("بازبینی ناموفق آزادسازی را مسدود می‌کند", () => {
  const r = canReleaseViolation({ violation: v(), closures: [closure(1, false)], releaserId: "u-qa" });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /رضایت‌بخش/);
});

test("صادرکننده نمی‌تواند تخلف خودش را آزاد کند", () => {
  const r = canReleaseViolation({ violation: v(), closures: [closure(1, true)], releaserId: "u-hse" });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /صادرکننده/);
});

test("متخلف نمی‌تواند تخلف خودش را آزاد کند", () => {
  const r = canReleaseViolation({
    violation: v({ OffenderRef: "u-site" }),
    closures: [closure(1, true)],
    releaserId: "u-site",
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /متخلف/);
});

test("بازبین همان آزادکننده فقط هشدار می‌گیرد", () => {
  const r = canReleaseViolation({
    violation: v(),
    closures: [closure(1, true, { ReInspectedBy: "u-qa" })],
    releaserId: "u-qa",
  });
  assert.equal(r.ok, true, "هشدار نباید مانع شود");
  assert.match(r.warningsFa.join(), /بازبین/);
});

test("آزادسازی سالم مجاز است", () => {
  const r = canReleaseViolation({ violation: v(), closures: [closure(1, true)], releaserId: "u-qa" });
  assert.equal(r.ok, true, r.blockersFa.join("|"));
});

test("تخلف با توقف کار بدون اقدام اصلاحی آزاد نمی‌شود", () => {
  const r = canReleaseViolation({
    violation: v({ IsStopWork: true, StopWorkScope: "project" }),
    closures: [closure(1, true)],
    actions: [],
    releaserId: "u-qa",
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /بدون اقدام اصلاحی/);
});

test("اقدام اصلاحی باز مانع آزادسازی توقف کار است", () => {
  const r = canReleaseViolation({
    violation: v({ IsStopWork: true, StopWorkScope: "project" }),
    closures: [closure(1, true)],
    actions: [capa("c1", "in_progress")],
    releaserId: "u-qa",
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /هنوز باز است/);
});

test("توقف کار با اقدام تکمیل‌شده آزاد می‌شود", () => {
  const r = canReleaseViolation({
    violation: v({ IsStopWork: true, StopWorkScope: "project" }),
    closures: [closure(1, true)],
    actions: [capa("c1", "verified")],
    releaserId: "u-qa",
  });
  assert.equal(r.ok, true, r.blockersFa.join("|"));
});

test("اقدام تخلف دیگر به حساب نمی‌آید", () => {
  const r = canReleaseViolation({
    violation: v({ IsStopWork: true, StopWorkScope: "project" }),
    closures: [closure(1, true)],
    actions: [capa("c1", "verified", { SourceId: "OTHER" })],
    releaserId: "u-qa",
  });
  assert.equal(r.ok, false, "اقدام تخلف دیگر نباید دروازه را باز کند");
});

test("تخلف بسته دوباره آزاد نمی‌شود", () => {
  const r = canReleaseViolation({ violation: v({ Status: "closed" }), closures: [closure(1, true)], releaserId: "u-qa" });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /قبلاً بسته/);
});

test("بازبینی مکرر هشدار ضعف نظام‌مند می‌دهد", () => {
  const r = canReleaseViolation({
    violation: v(),
    closures: [closure(1, false), closure(2, false), closure(3, true)],
    releaserId: "u-qa",
  });
  assert.equal(r.ok, true);
  assert.match(r.warningsFa.join(), /ضعف نظام‌مند/);
});

test("آخرین تلاش ملاک است نه اولین", () => {
  const r = canReleaseViolation({
    violation: v(),
    closures: [closure(2, true), closure(1, false)],
    releaserId: "u-qa",
  });
  assert.equal(r.ok, true, "ترتیب ورودی نباید نتیجه را عوض کند");
});

/* ══════════════════════ ۱۰) دروازهٔ بستن بازرسی ══════════════════════ */

const insp = (over = {}) => ({
  Id: "insp1", ProjectId: "p", InspectionNo: "I-001", TitleFa: "بازدید هفتگی",
  InspectionType: "walkthrough", InspectedAt: "2026-09-01", InspectedBy: "u-hse",
  Status: "completed", ...over,
});

test("بازرسی با یافتهٔ باز بسته نمی‌شود", () => {
  const r = canCloseInspection({ inspection: insp(), findings: [f(1, "open", "high", "unsafe_act")] });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /یافتهٔ باز/);
});

test("بازرسی با تخلف باز بسته نمی‌شود", () => {
  const r = canCloseInspection({
    inspection: insp(),
    findings: [f(1, "closed", "low", "ppe")],
    violations: [v({ InspectionId: "insp1" })],
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /تخلف صادرشده/);
});

test("تخلف بازرسی دیگر مانع نمی‌شود", () => {
  const r = canCloseInspection({
    inspection: insp(),
    findings: [f(1, "closed", "low", "ppe")],
    violations: [v({ InspectionId: "insp-other" })],
  });
  assert.equal(r.ok, true, r.blockersFa.join("|"));
});

test("بازرسی با همه‌چیز بسته قابل بستن است", () => {
  const r = canCloseInspection({
    inspection: insp({ ScorePct: 92 }),
    findings: [f(1, "closed", "low", "ppe")],
    violations: [v({ InspectionId: "insp1", Status: "closed" })],
  });
  assert.equal(r.ok, true, r.blockersFa.join("|"));
  assert.equal(r.warningsFa.length, 0);
});

test("امتیاز زیر حد قبولی هشدار می‌دهد ولی مانع نیست", () => {
  const r = canCloseInspection({
    inspection: insp({ ScorePct: 65 }),
    findings: [f(1, "closed", "low", "ppe")],
  });
  assert.equal(r.ok, true);
  assert.match(r.warningsFa.join(), /زیر حد قبولی/);
});

test("بازرسی بدون یافته هشدار سطحی‌بودن می‌دهد", () => {
  const r = canCloseInspection({ inspection: insp(), findings: [] });
  assert.equal(r.ok, true);
  assert.match(r.warningsFa.join(), /بازرسی سطحی/);
});

test("بازرسی بسته دوباره بسته نمی‌شود", () => {
  const r = canCloseInspection({ inspection: insp({ Status: "closed" }), findings: [] });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /قبلاً بسته/);
});

/* ══════════════════════ ۱۱) خلاصهٔ تخلفات ══════════════════════ */

test("خلاصه توقف کار فعال را از کل جدا می‌کند", () => {
  const r = violationSummary([
    v({ Id: "v1", IsStopWork: true, Status: "issued" }),
    v({ Id: "v2", IsStopWork: true, Status: "closed" }),
    v({ Id: "v3", IsStopWork: false, Status: "issued" }),
  ]);
  assert.equal(r.total, 3);
  assert.equal(r.stopWorkTotal, 2, "دو تخلف اصلاً توقف کار داشتند");
  assert.equal(r.stopWorkActive, 1, "ولی فقط یکی هنوز فعال است");
  assert.equal(r.open, 2);
});

test("جریمهٔ تخلف باطل‌شده وصول نمی‌شود", () => {
  const r = violationSummary([
    v({ Id: "v1", FineAmount: 1000, Status: "issued" }),
    v({ Id: "v2", FineAmount: 5000, Status: "void" }),
  ]);
  assert.equal(r.totalFine, 1000);
});

test("پیمانکار با سه تخلف یا بیشتر متخلف تکراری است", () => {
  const r = violationSummary([
    v({ Id: "v1", ContractorFa: "الف" }),
    v({ Id: "v2", ContractorFa: "الف" }),
    v({ Id: "v3", ContractorFa: "الف" }),
    v({ Id: "v4", ContractorFa: "ب" }),
  ]);
  assert.equal(r.repeatOffendersFa.length, 1);
  assert.match(r.repeatOffendersFa[0], /الف/);
  assert.match(r.warningsFa.join(), /تخلف تکراری/);
});

test("دو تخلف هنوز تکراری شمرده نمی‌شود", () => {
  const r = violationSummary([v({ Id: "v1", ContractorFa: "الف" }), v({ Id: "v2", ContractorFa: "الف" })]);
  assert.equal(r.repeatOffendersFa.length, 0);
});

test("تخلف معوق شمرده و هشدار داده می‌شود", () => {
  const r = violationSummary([v({ DueDate: "2026-01-01", Status: "issued" })], new Date("2026-09-01"));
  assert.equal(r.overdue, 1);
  assert.match(r.warningsFa.join(), /مهلت رفع/);
});

test("خلاصهٔ خالی کلیدهای صفرشده می‌دهد", () => {
  const r = violationSummary([]);
  assert.equal(r.total, 0);
  assert.equal(r.totalFine, 0);
  assert.equal(r.warningsFa.length, 0);
  for (const t of VIOLATION_TYPES) assert.equal(r.byType[t], 0, `${t} کلید ندارد`);
  for (const s of VIOLATION_STATUSES) assert.equal(r.byStatus[s], 0, `${s} کلید ندارد`);
});

/* ══════════════════════ ۱۲) رگرسیون بخش‌های قبلی ══════════════════════ */

test("جداول بخش‌های قبلی HSE دست‌نخورده مانده‌اند", () => {
  for (const n of [
    "WorkPermit", "SafetyIncident", "GasTestLog", "IsolationLog", "PTW_Approval",
    "InjuredPerson", "HSE_Investigation", "RootCauseNode", "CapaAction", "HSE_ManHourLog",
  ]) {
    assert.ok(byName(n), `${n} نباید حذف شود`);
  }
  /* ۲۰ جدول D1–D6 + ۷ جدول آموزش، بهداشت و محیط‌زیست (D7). */
  assert.equal(SCHEMA.filter((t) => t.module === "d16").length, 29);
});

/* ══════════ رگرسیون: یافته‌های ۱۰ لوپ خودارزیابی D6 ══════════ */

test("لوپ ۵ — توقف کار بدون دامنه قابل اعمال نیست", () => {
  const bad = v({ IsStopWork: true, StopWorkScope: null });
  const st = violationState(bad);
  assert.equal(st.isBlocking, true, "هنوز مسدودکننده اعلام می‌شود");
  assert.equal(st.isEnforceable, false, "ولی قابل اعمال نیست");
  assert.match(st.enforcementIssueFa, /بدون دامنه/);
});

test("لوپ ۵ — دامنهٔ ناشناخته قابل اعمال نیست", () => {
  const st = violationState(v({ IsStopWork: true, StopWorkScope: "galaxy" }));
  assert.equal(st.isEnforceable, false);
  assert.match(st.enforcementIssueFa, /شناخته‌شده نیست/);
});

test("لوپ ۵ — دامنهٔ فعالیت بدون شناسه قابل اعمال نیست", () => {
  const st = violationState(v({ IsStopWork: true, StopWorkScope: "activity", ActivityId: null }));
  assert.equal(st.isEnforceable, false);
  assert.match(st.enforcementIssueFa, /بدون شناسهٔ فعالیت/);
});

test("لوپ ۵ — دامنهٔ سیستم و منطقه هم مرجع می‌خواهند", () => {
  assert.equal(violationState(v({ IsStopWork: true, StopWorkScope: "system" })).isEnforceable, false);
  assert.equal(violationState(v({ IsStopWork: true, StopWorkScope: "area" })).isEnforceable, false);
});

test("لوپ ۵ — توقف سالم قابل اعمال است", () => {
  const st = violationState(v({ IsStopWork: true, StopWorkScope: "project" }));
  assert.equal(st.isEnforceable, true);
  assert.equal(st.enforcementIssueFa, null);
});

test("لوپ ۵ — توقف غیرقابل‌اعمال فعالیت را قفل نمی‌کند ولی گزارش می‌شود", () => {
  /* پیش از این چنین تخلفی در آمار «توقف کار فعال» شمرده می‌شد ولی هیچ
   * فعالیتی را قفل نمی‌کرد — داشبورد می‌گفت کار متوقف است در حالی که
   * ادامه داشت. */
  const r = activityStopWorkState({
    activityId: "A-100",
    violations: [v({ IsStopWork: true, StopWorkScope: "galaxy", ActivityId: "A-100" })],
  });
  assert.equal(r.isLocked, false);
  assert.equal(r.unenforceableFa.length, 1);
  assert.match(r.unenforceableFa[0], /V-001/);
});

test("لوپ ۵ — خلاصه توقف بی‌اثر را جدا می‌شمارد و هشدار می‌دهد", () => {
  const r = violationSummary([
    v({ Id: "v1", ViolationNo: "V-1", IsStopWork: true, StopWorkScope: "project" }),
    v({ Id: "v2", ViolationNo: "V-2", IsStopWork: true, StopWorkScope: null }),
  ]);
  assert.equal(r.stopWorkActive, 2);
  assert.equal(r.stopWorkUnenforceable, 1);
  assert.equal(r.unenforceableFa.length, 1);
  assert.match(r.warningsFa.join(), /قابل اعمال نیست/);
});

test("لوپ ۵ — دادهٔ سالم هیچ هشدار بی‌اثری نمی‌دهد", () => {
  const r = violationSummary([v({ IsStopWork: true, StopWorkScope: "project" })]);
  assert.equal(r.stopWorkUnenforceable, 0);
  assert.equal(r.unenforceableFa.length, 0);
});

test("لوپ ۱۰ — دستور توقف کار فعال مانع RFSU است", () => {
  const sys = "SYS-50";
  const base = { permits: [], incidents: [], systemId: sys };

  const clean = rfsuSafetyClearance({ ...base, violations: [] });
  assert.equal(clean.ok, true);
  assert.equal(clean.activeStopWorkOrders, 0);

  const blocked = rfsuSafetyClearance({
    ...base,
    violations: [v({ IsStopWork: true, StopWorkScope: "system", SystemId: sys })],
  });
  assert.equal(blocked.ok, false, "سیستم با توقف کار فعال نباید RFSU بگیرد");
  assert.equal(blocked.activeStopWorkOrders, 1);
  assert.match(blocked.blockersFa.join(), /توقف کار فعال/);
});

test("لوپ ۱۰ — توقف کل پروژه همهٔ سیستم‌ها را می‌گیرد", () => {
  const r = rfsuSafetyClearance({
    systemId: "SYS-99", permits: [], incidents: [],
    violations: [v({ IsStopWork: true, StopWorkScope: "project" })],
  });
  assert.equal(r.ok, false);
  assert.equal(r.activeStopWorkOrders, 1);
});

test("لوپ ۱۰ — توقف سیستم دیگر مانع نیست", () => {
  const r = rfsuSafetyClearance({
    systemId: "SYS-50", permits: [], incidents: [],
    violations: [v({ IsStopWork: true, StopWorkScope: "system", SystemId: "SYS-OTHER" })],
  });
  assert.equal(r.ok, true, r.blockersFa.join("|"));
  assert.equal(r.activeStopWorkOrders, 0);
});

test("لوپ ۱۰ — تخلف بسته دیگر مانع RFSU نیست", () => {
  const r = rfsuSafetyClearance({
    systemId: "SYS-50", permits: [], incidents: [],
    violations: [v({ IsStopWork: true, StopWorkScope: "system", SystemId: "SYS-50", Status: "closed" })],
  });
  assert.equal(r.ok, true, r.blockersFa.join("|"));
});

test("لوپ ۱۰ — توقف ناقص مانع نیست ولی هشدار می‌دهد", () => {
  const r = rfsuSafetyClearance({
    systemId: "SYS-50", permits: [], incidents: [],
    violations: [v({ IsStopWork: true, StopWorkScope: null, SystemId: "SYS-50" })],
  });
  assert.equal(r.ok, true, "دستور ناقص اثر اجرایی ندارد");
  assert.match(r.warningsFa.join(), /توقف کار ناقص/);
});

test("لوپ ۱۰ — فراخوانی بدون تخلفات هنوز کار می‌کند", () => {
  /* سازگاری واپس‌گرا: مصرف‌کنندگان قبلی violations نمی‌فرستادند. */
  const r = rfsuSafetyClearance({ systemId: "SYS-50", permits: [] });
  assert.equal(r.ok, true);
  assert.equal(r.activeStopWorkOrders, 0);
});
