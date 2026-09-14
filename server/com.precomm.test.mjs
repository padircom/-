import test from "node:test";
import assert from "node:assert/strict";
import { SCHEMA, MIGRATIONS } from "./sqlLogic.js";
import {
  TEST_KINDS_BY_TYPE,
  TEST_KIND_FA,
  PACK_TYPE_FA,
  validatePackInput,
  validateSheetInput,
  validateSheetLines,
  sheetVerdict,
  canSignSheet,
  packProgress,
  coldTestClearance,
  preCommSummary,
} from "./comLogic.js";

/* ══════════════ اسکیما ══════════════ */

test("سه جدول بستهٔ آزمون در اسکیما هستند", () => {
  for (const n of ["CheckRecordPack", "CheckSheet", "CheckSheetLine"]) {
    const t = SCHEMA.find((x) => x.name === n);
    assert.ok(t, `${n} نیست`);
    assert.equal(t.module, "d15");
  }
});

test("مهاجرت 0014 افزوده شده و قبلی‌ها دست‌نخورده‌اند", () => {
  const v = MIGRATIONS.map((m) => m.version);
  assert.ok(v.includes("0012"), "مهاجرت گواهی تحویل نباید حذف شود");
  assert.ok(v.includes("0013"), "مهاجرت تفکیک سیستمی نباید حذف شود");
  assert.ok(v.includes("0014"));
  assert.ok(v.includes("0015"), "مهاجرت ایمنی و بهداشت نباید حذف شود");
  assert.ok(v.includes("0016"), "مهاجرت ارزیابی ریسک شغلی نباید حذف شود");
  assert.ok(v.includes("0017"), "مهاجرت پروانهٔ کار نباید حذف شود");
  assert.ok(v.includes("0018"), "مهاجرت حادثه و اقدام اصلاحی نباید حذف شود");
  assert.ok(v.includes("0019"), "مهاجرت تخلف و توقف کار نباید حذف شود");
  /* «آخرین مهاجرت» ادعای شکننده‌ای است: هر ماژول بعدی آن را
   * می‌شکند بی‌آنکه چیزی دربارهٔ این ماژول بگوید. چیزی که باید
   * ثابت بماند نبودن شکاف و ترتیب صعودی است. */
  assert.deepEqual([...v].sort(), v, "ترتیب مهاجرت‌ها باید صعودی بماند");
  assert.equal(new Set(v).size, v.length, "شمارهٔ مهاجرت تکراری");
});

test("مهاجرت 0014 فقط جدول می‌سازد و چیزی را تغییر نمی‌دهد", () => {
  const m = MIGRATIONS.find((x) => x.version === "0014");
  assert.equal(m.statements.filter((s) => s.includes("ALTER TABLE")).length, 0, "نباید ستونی تغییر کند");
  assert.equal(m.statements.filter((s) => s.includes("DROP")).length, 0, "نباید چیزی حذف شود");
  const creates = m.statements.filter((s) => s.includes("CREATE TABLE"));
  assert.equal(creates.length, 3);
  for (const s of creates) assert.match(s, /IF OBJECT_ID/, "ساخت جدول باید ایدمپوتنت باشد");
});

test("یکتایی ردیف برگه از ثبت دوبارهٔ یک شماره جلوگیری می‌کند", () => {
  const t = SCHEMA.find((x) => x.name === "CheckSheetLine");
  const ux = t.indexes.find((i) => i.name === "UX_CheckSheetLine");
  assert.ok(ux?.unique);
  assert.deepEqual(ux.columns, ["SheetId", "LineNo"]);
});

/* ══════════════ اعتبارسنجی بسته ══════════════ */

test("بستهٔ معتبر خطا ندارد", () => {
  assert.deepEqual(validatePackInput({ packNo: "TP-001", titleFa: "هیدروتست خط ۱۰", packType: "a" }), []);
});

test("بستهٔ نامعتبر همهٔ خطاها را یک‌جا می‌دهد", () => {
  const codes = validatePackInput({ packNo: "", titleFa: "", packType: "c", status: "بد" }).map((e) => e.code);
  assert.ok(codes.includes("E-COM-PACK-NO-REQUIRED"));
  assert.ok(codes.includes("E-COM-TITLE-REQUIRED"));
  assert.ok(codes.includes("E-COM-PACK-TYPE"));
  assert.ok(codes.includes("E-COM-PACK-STATUS"));
});

/* ══════════════ سازگاری نوع آزمون با بسته ══════════════ */

test("آزمون سرد در بستهٔ سرد پذیرفته می‌شود", () => {
  assert.deepEqual(
    validateSheetInput({ sheetNo: "S-1", titleFa: "هیدروتست", testKind: "hydrotest", packType: "a" }),
    [],
  );
});

test("آزمون گرم در بستهٔ سرد رد می‌شود", () => {
  const errs = validateSheetInput({ sheetNo: "S-2", titleFa: "زیر بار", testKind: "load_test", packType: "a" });
  assert.equal(errs[0].code, "E-COM-KIND-PACK-MISMATCH");
  assert.match(errs[0].message, /آزمون سرد/);
});

test("آزمون سرد در بستهٔ گرم هم رد می‌شود", () => {
  const errs = validateSheetInput({ sheetNo: "S-3", titleFa: "هیدروتست", testKind: "hydrotest", packType: "b" });
  assert.equal(errs[0].code, "E-COM-KIND-PACK-MISMATCH");
});

test("نوع آزمون ناشناخته رد می‌شود", () => {
  const errs = validateSheetInput({ sheetNo: "S-4", titleFa: "چیزی", testKind: "طالع‌بینی", packType: "a" });
  assert.equal(errs[0].code, "E-COM-TEST-KIND");
});

test("هر نوع آزمون برچسب فارسی دارد", () => {
  for (const k of [...TEST_KINDS_BY_TYPE.a, ...TEST_KINDS_BY_TYPE.b])
    assert.ok(TEST_KIND_FA[k], `${k} برچسب فارسی ندارد`);
  assert.equal(PACK_TYPE_FA.a, "آزمون سرد");
  assert.equal(PACK_TYPE_FA.b, "آزمون گرم");
});

test("نوع آزمون سرد و گرم همپوشانی ندارند", () => {
  const overlap = TEST_KINDS_BY_TYPE.a.filter((k) => TEST_KINDS_BY_TYPE.b.includes(k));
  assert.deepEqual(overlap, [], "یک آزمون نمی‌تواند هم سرد باشد هم گرم");
});

/* ══════════════ ردیف‌های برگه ══════════════ */

test("برگهٔ بدون ردیف رد می‌شود", () => {
  assert.equal(validateSheetLines([])[0].code, "E-COM-NO-LINES");
});

test("شمارهٔ ردیف تکراری رد می‌شود", () => {
  const errs = validateSheetLines([
    { LineNo: 1, ParameterFa: "فشار" },
    { LineNo: 1, ParameterFa: "دما" },
  ]);
  assert.equal(errs[0].code, "E-COM-DUP-LINE");
});

test("ردیف بدون نام پارامتر رد می‌شود", () => {
  const errs = validateSheetLines([{ LineNo: 1, ParameterFa: "  " }]);
  assert.equal(errs[0].code, "E-COM-LINE-PARAM");
});

/* ══════════════ نتیجهٔ برگه ══════════════ */

test("همهٔ ردیف‌های الزامی قبول یعنی برگه قبول", () => {
  const v = sheetVerdict([
    { LineNo: 1, ParameterFa: "فشار آزمون", IsMandatory: true, Passed: true },
    { LineNo: 2, ParameterFa: "مدت نگهداشت", IsMandatory: true, Passed: true },
  ]);
  assert.equal(v.resultFa, "pass");
  assert.equal(v.resultLabelFa, "قبول");
  assert.deepEqual(v.blockersFa, []);
});

test("یک ردیف الزامی مردود کل برگه را مردود می‌کند", () => {
  const v = sheetVerdict([
    { LineNo: 1, ParameterFa: "فشار", IsMandatory: true, Passed: true },
    { LineNo: 2, ParameterFa: "افت فشار", IsMandatory: true, Passed: false },
  ]);
  assert.equal(v.resultFa, "fail");
  assert.equal(v.failed, 1);
});

test("ردیف سنجیده‌نشده یعنی در انتظار نه قبول", () => {
  const v = sheetVerdict([
    { LineNo: 1, ParameterFa: "فشار", IsMandatory: true, Passed: true },
    { LineNo: 2, ParameterFa: "دما", IsMandatory: true, Passed: null },
  ]);
  assert.equal(v.resultFa, "pending", "سکوت را نباید قبولی تفسیر کرد");
  assert.equal(v.pending, 1);
});

test("مردودی بر در انتظار اولویت دارد", () => {
  const v = sheetVerdict([
    { LineNo: 1, ParameterFa: "الف", IsMandatory: true, Passed: false },
    { LineNo: 2, ParameterFa: "ب", IsMandatory: true, Passed: null },
  ]);
  assert.equal(v.resultFa, "fail");
});

test("ردیف اختیاری در نتیجه اثر ندارد", () => {
  const v = sheetVerdict([
    { LineNo: 1, ParameterFa: "الزامی", IsMandatory: true, Passed: true },
    { LineNo: 2, ParameterFa: "اختیاری", IsMandatory: false, Passed: false },
  ]);
  assert.equal(v.resultFa, "pass", "ردیف اختیاری مردود نباید برگه را مردود کند");
  assert.equal(v.mandatory, 1);
  assert.equal(v.total, 2);
});

test("ردیف بدون تعیین الزامی‌بودن، الزامی فرض می‌شود", () => {
  const v = sheetVerdict([{ LineNo: 1, ParameterFa: "پیش‌فرض", Passed: false }]);
  assert.equal(v.mandatory, 1);
  assert.equal(v.resultFa, "fail");
});

test("برگهٔ بدون ردیف الزامی در انتظار می‌ماند", () => {
  const v = sheetVerdict([{ LineNo: 1, ParameterFa: "فقط اختیاری", IsMandatory: false, Passed: true }]);
  assert.equal(v.resultFa, "pending");
  assert.match(v.blockersFa[0], /الزامی/);
});

/* ══════════════ امضای برگه ══════════════ */

const PASSED_LINES = [{ LineNo: 1, ParameterFa: "فشار", IsMandatory: true, Passed: true }];
const FAILED_LINES = [{ LineNo: 1, ParameterFa: "فشار", IsMandatory: true, Passed: false }];
const PENDING_LINES = [{ LineNo: 1, ParameterFa: "فشار", IsMandatory: true, Passed: null }];

test("برگهٔ کامل با شاهد امضا می‌شود", () => {
  assert.equal(canSignSheet(PASSED_LINES, "u-qc"), null);
});

test("برگهٔ مردود هم امضا می‌شود چون امضا یعنی ثبت نتیجه", () => {
  assert.equal(canSignSheet(FAILED_LINES, "u-qc"), null);
});

test("برگهٔ ناتمام امضا نمی‌شود", () => {
  assert.equal(canSignSheet(PENDING_LINES, "u-qc")?.code, "E-COM-SHEET-PENDING");
});

test("امضا بدون شاهد مجاز نیست", () => {
  assert.equal(canSignSheet(PASSED_LINES, "")?.code, "E-COM-NO-WITNESS");
  assert.equal(canSignSheet(PASSED_LINES, null)?.code, "E-COM-NO-WITNESS");
});

/* ══════════════ پیشرفت بسته ══════════════ */

const SHEETS = [
  { Id: "sh1", PackId: "pk1", SheetNo: "S-1", SheetType: "a", TestKind: "hydrotest", TitleFa: "الف", ResultFa: "pass", Status: "signed" },
  { Id: "sh2", PackId: "pk1", SheetNo: "S-2", SheetType: "a", TestKind: "megger", TitleFa: "ب", ResultFa: "pass", Status: "signed" },
  { Id: "sh3", PackId: "pk1", SheetNo: "S-3", SheetType: "a", TestKind: "flushing", TitleFa: "ج", ResultFa: null, Status: "draft" },
  { Id: "sh4", PackId: "pk2", SheetNo: "S-4", SheetType: "a", TestKind: "hydrotest", TitleFa: "د", ResultFa: "fail", Status: "signed" },
  { Id: "sh5", PackId: "pk1", SheetNo: "S-5", SheetType: "a", TestKind: "alignment", TitleFa: "ه", ResultFa: null, Status: "void" },
];

test("پیشرفت بسته بر برگه‌های امضاشده است", () => {
  const p = packProgress("pk1", SHEETS);
  assert.equal(p.total, 3, "برگهٔ باطل نباید شمرده شود");
  assert.equal(p.voided, 1);
  assert.equal(p.signed, 2);
  assert.equal(p.draft, 1);
  assert.equal(p.clearedPct, 66.67);
  assert.equal(p.canClear, false);
  assert.match(p.blockersFa[0], /امضا نشده/);
});

test("بسته با برگهٔ مردود قابل تأیید نیست", () => {
  const p = packProgress("pk2", SHEETS);
  assert.equal(p.failed, 1);
  assert.equal(p.canClear, false);
  assert.ok(p.blockersFa.some((b) => b.includes("مردود")));
});

test("بستهٔ کامل قابل تأیید است", () => {
  const p = packProgress("pk1", SHEETS.filter((s) => s.Id !== "sh3"));
  assert.equal(p.canClear, true);
  assert.equal(p.clearedPct, 100);
  assert.deepEqual(p.blockersFa, []);
});

test("بستهٔ خالی قابل تأیید نیست", () => {
  const p = packProgress("ghost", SHEETS);
  assert.equal(p.total, 0);
  assert.equal(p.canClear, false);
  assert.match(p.blockersFa[0], /هیچ برگهٔ فعالی/);
});

test("برگهٔ مشروط مانع تأیید نیست", () => {
  const p = packProgress("pk9", [
    { Id: "x", PackId: "pk9", SheetNo: "S-9", SheetType: "a", TestKind: "megger", TitleFa: "م", ResultFa: "conditional", Status: "signed" },
  ]);
  assert.equal(p.passed, 1);
  assert.equal(p.canClear, true);
});

/* ══════════════ دروازهٔ آزمون سرد ══════════════ */

const PACKS = [
  { Id: "pk1", ProjectId: "p1", SystemId: "s1", PackNo: "TP-001", PackType: "a", Status: "in_progress" },
  { Id: "pk2", ProjectId: "p1", SystemId: "s1", PackNo: "TP-002", PackType: "a", Status: "cleared" },
  { Id: "pk3", ProjectId: "p1", SystemId: "s1", PackNo: "TP-003", PackType: "b", Status: "draft" },
];

test("دروازهٔ سرد همهٔ موانع را یک‌جا برمی‌گرداند", () => {
  const c = coldTestClearance({ systemId: "s1", packs: PACKS, sheets: SHEETS, openNcrCount: 2 });
  assert.equal(c.ok, false);
  assert.equal(c.packCount, 2, "فقط بستهٔ سرد شمرده می‌شود");
  assert.equal(c.clearedPacks, 1);
  assert.ok(c.blockersFa.length >= 2, "باید هم بسته هم عدم انطباق گزارش شود");
  assert.ok(c.blockersFa.some((b) => b.includes("TP-001")));
  assert.ok(c.blockersFa.some((b) => b.includes("عدم انطباق")));
});

test("سیستم بدون بستهٔ سرد رد می‌شود", () => {
  const c = coldTestClearance({ systemId: "s-empty", packs: PACKS, sheets: SHEETS });
  assert.equal(c.ok, false);
  assert.match(c.blockersFa[0], /هیچ بستهٔ آزمون سردی/);
});

test("همهٔ بسته‌های سرد تأییدشده یعنی دروازه باز", () => {
  const c = coldTestClearance({
    systemId: "s1",
    packs: PACKS.map((p) => (p.PackType === "a" ? { ...p, Status: "cleared" } : p)),
    sheets: SHEETS,
    openNcrCount: 0,
  });
  assert.equal(c.ok, true);
  assert.equal(c.clearedPacks, 2);
  assert.deepEqual(c.blockersFa, []);
});

test("پیشرفت فیزیکی ناقص هشدار است نه مانع", () => {
  const c = coldTestClearance({
    systemId: "s1",
    packs: PACKS.map((p) => (p.PackType === "a" ? { ...p, Status: "cleared" } : p)),
    sheets: SHEETS,
    openNcrCount: 0,
    physicalPct: 92,
  });
  assert.equal(c.ok, true, "ساخت ناقص نباید آزمون سرد را قفل کند");
  assert.equal(c.blockersFa.length, 0);
  assert.match(c.warningsFa[0], /۹۲|92/);
});

test("عدم انطباق باز مانع سخت است", () => {
  const c = coldTestClearance({
    systemId: "s1",
    packs: PACKS.map((p) => (p.PackType === "a" ? { ...p, Status: "cleared" } : p)),
    sheets: SHEETS,
    openNcrCount: 1,
  });
  assert.equal(c.ok, false);
  assert.match(c.blockersFa[0], /عدم انطباق/);
});

/* ══════════════ خلاصه ══════════════ */

test("خلاصه بدون بستهٔ گرم هم کلید هر دو نوع را دارد", () => {
  const sm = preCommSummary(
    [{ Id: "s1", ProjectId: "p1", SystemCode: "U-100", TitleFa: "الف", SystemType: "system", Status: "planned" }],
    [PACKS.find((p) => p.PackType === "a")],
    [],
  );
  assert.deepEqual(sm.byType, { a: 1, b: 0 }, "نبودِ بستهٔ گرم باید صفر باشد نه کلید غایب");
});

test("خلاصهٔ پیش‌راه‌اندازی سیستم بدون بسته را نام می‌برد", () => {
  const systems = [
    { Id: "s1", ProjectId: "p1", SystemCode: "U-100", TitleFa: "الف", SystemType: "system", Status: "planned" },
    { Id: "s2", ProjectId: "p1", SystemCode: "U-200", TitleFa: "ب", SystemType: "system", Status: "planned" },
  ];
  const sum = preCommSummary(systems, PACKS, SHEETS);
  assert.equal(sum.packs, 3);
  assert.deepEqual(sum.byType, { a: 2, b: 1 });
  assert.equal(sum.sheets, 4, "برگهٔ باطل شمرده نمی‌شود");
  assert.equal(sum.signedSheets, 3);
  assert.equal(sum.failedSheets, 1);
  assert.equal(sum.progressPct, 75);
  assert.deepEqual(sum.systemsWithoutPack, ["U-200"]);
});

test("خلاصهٔ خالی صفر می‌دهد نه خطا", () => {
  const sum = preCommSummary([], [], []);
  assert.deepEqual(sum.byType, { a: 0, b: 0 }, "خلاصهٔ خالی هم باید هر دو کلید را داشته باشد");
  assert.equal(sum.packs, 0);
  assert.equal(sum.progressPct, 0);
  assert.deepEqual(sum.systemsWithoutPack, []);
});
