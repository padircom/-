import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as jalaaliNs from "jalaali-js";
import {
  ACTIVITY_COMPARE_FIELDS,
  CONNECTORS,
  INTEGRATION_VERSION,
  TEMPLATE_CATALOG,
  XER_RELATION,
  XER_STATUS,
  coerceCell,
  connectorsByStatus,
  detectDelimiter,
  diffRows,
  extractCalendars,
  extractWbs,
  extractXer,
  generateOpenApi,
  hoursToDays,
  integrationStats,
  mapHeaders,
  normalizeDigits,
  parseDelimited,
  parseImport,
  parseXer,
  templateByCode,
  templateCsv,
  templateGuide,
  toBool,
  toIsoDate,
  toNumber,
  toYaml,
} from "./itgLogic.js";
import { SCHEMA, allColumns } from "./sqlLogic.js";

const jalaali = jalaaliNs.default ?? jalaaliNs;
const toG = (jy, jm, jd) => jalaali.toGregorian(jy, jm, jd);

const here = path.dirname(fileURLToPath(import.meta.url));
const XER_TEXT = fs.readFileSync(path.join(here, "fixtures", "sample.xer"), "utf8");
const parsed = parseXer(XER_TEXT);
const extract = extractXer(parsed, "prj-1");

/* ══════════ ۱. کمکی ══════════ */

test("نسخه موتور", () => {
  assert.equal(INTEGRATION_VERSION, "itg-v1");
});

test("normalizeDigits ارقام فارسی و عربی را لاتین می‌کند", () => {
  assert.equal(normalizeDigits("۱۴۰۵/۰۶/۱۷"), "1405/06/17");
  assert.equal(normalizeDigits("٤٢"), "42");
  assert.equal(normalizeDigits("  ۸.۵  "), "8.5");
});

test("toNumber جداکننده هزارگان و درصد را می‌فهمد", () => {
  assert.equal(toNumber("1,250,000"), 1250000);
  assert.equal(toNumber("۴۲%"), 42);
  assert.equal(toNumber("abc"), null);
  assert.equal(toNumber(""), null);
  assert.equal(toNumber("0"), 0);
});

test("toIsoDate تاریخ میلادی را نرمال می‌کند", () => {
  assert.equal(toIsoDate("2026-9-8"), "2026-09-08");
  assert.equal(toIsoDate("2026/09/08 08:00"), "2026-09-08");
  assert.equal(toIsoDate("garbage"), null);
  assert.equal(toIsoDate(""), null);
  assert.equal(toIsoDate("2026-13-01"), null, "ماه ۱۳ باید رد شود");
});

test("toIsoDate تاریخ شمسی را فقط با مبدل تزریق‌شده تبدیل می‌کند", () => {
  assert.equal(toIsoDate("1405/06/17"), null, "بدون مبدل باید null بدهد نه تاریخ غلط");
  assert.equal(toIsoDate("1405/06/17", toG), "2026-09-08");
  assert.equal(toIsoDate("۱۴۰۵/۰۶/۱۷", toG), "2026-09-08", "ارقام فارسی هم باید کار کند");
});

test("toBool مقادیر فارسی و انگلیسی", () => {
  assert.equal(toBool("Y"), true);
  assert.equal(toBool("بله"), true);
  assert.equal(toBool("N"), false);
  assert.equal(toBool(""), false);
});

test("hoursToDays با ساعت کاری روز", () => {
  assert.equal(hoursToDays(80, 8), 10);
  assert.equal(hoursToDays(360, 12), 30);
  assert.equal(hoursToDays(null), null);
  assert.equal(hoursToDays(8, 0), null, "تقسیم بر صفر");
});

/* ══════════ ۲. تجزیه XER ══════════ */

test("XER: سرآیند ERMHDR خوانده می‌شود", () => {
  assert.equal(parsed.header.version, "19.12");
  assert.equal(parsed.header.exportedAt, "2026-09-08");
});

test("XER: همه جدول‌ها شناسایی می‌شوند", () => {
  for (const t of ["CALENDAR", "PROJECT", "PROJWBS", "TASK", "TASKPRED"]) {
    assert.ok(parsed.tableNames.includes(t), `${t} پیدا نشد`);
  }
  assert.equal(parsed.tables.TASK.length, 5);
  assert.equal(parsed.tables.TASKPRED.length, 6);
});

test("XER: ستون‌ها درست به مقادیر بسته می‌شوند", () => {
  const t1 = parsed.tables.TASK[0];
  assert.equal(t1.task_code, "CIV-1010");
  assert.equal(t1.task_name, "خاکبرداری محوطه");
  assert.equal(t1.status_code, "TK_Complete");
});

test("XER: فایل خالی یا بی‌ربط بدون استثنا تجزیه می‌شود", () => {
  assert.deepEqual(parseXer("").tableNames, []);
  assert.deepEqual(parseXer("hello world\nnot an xer").tableNames, []);
});

test("XER: %E پایان فایل را می‌بندد", () => {
  const truncated = parseXer("%T\tTASK\n%F\ta\n%R\t1\n%E\n%T\tGHOST\n%F\tb\n%R\t2");
  assert.ok(!truncated.tableNames.includes("GHOST"));
});

/* ══════════ ۳. استخراج XER ══════════ */

test("استخراج: تقویم‌ها با ساعت کاری", () => {
  const cals = extractCalendars(parsed);
  assert.equal(cals.length, 2);
  assert.equal(cals.find((c) => c.id === "C1").hoursPerDay, 8);
  assert.equal(cals.find((c) => c.id === "C1").isDefault, true);
  assert.equal(cals.find((c) => c.id === "C2").hoursPerDay, 12);
});

test("استخراج: WBS با سلسله‌مراتب و سطح", () => {
  const wbs = extractWbs(parsed, "prj-1");
  assert.equal(wbs.length, 3);
  const root = wbs.find((w) => w.Code === "OG");
  const child = wbs.find((w) => w.Code === "OG.CIV");
  assert.equal(root.Level, 0);
  assert.equal(root.ParentId, null);
  assert.equal(child.Level, 1);
  assert.equal(child.ParentId, root.Id);
});

test("استخراج: نام پروژه و تاریخ داده", () => {
  assert.equal(extract.projectName, "OG-2401");
  assert.equal(extract.dataDate, "2026-09-04");
});

test("استخراج: پنج فعالیت با کد و نام درست", () => {
  assert.equal(extract.activities.length, 5);
  assert.deepEqual(extract.activities.map((a) => a.Code), ["CIV-1010", "CIV-1020", "CIV-1030", "MEC-2010", "MEC-2020"]);
});

test("استخراج: مدت با تقویم اختصاصی هر فعالیت محاسبه می‌شود", () => {
  const civ = extract.activities.find((a) => a.Code === "CIV-1030"); // 120h با تقویم ۸ ساعته
  const mec = extract.activities.find((a) => a.Code === "MEC-2010"); // 360h با تقویم ۱۲ ساعته
  assert.equal(civ.DurationDays, 15);
  assert.equal(mec.DurationDays, 30, "تقویم ۱۲ ساعته باید اعمال شود، نه ۸");
});

test("استخراج: شناوری کل از ساعت به روز و بحرانی بودن از آن استنتاج می‌شود", () => {
  const a = extract.activities.find((x) => x.Code === "CIV-1030");
  assert.equal(a.TotalFloat, 5);
  assert.equal(a.FreeFloat, 2);
  assert.equal(a.IsCritical, false);
  const crit = extract.activities.find((x) => x.Code === "CIV-1020");
  assert.equal(crit.TotalFloat, 0);
  assert.equal(crit.IsCritical, true);
});

test("استخراج: شناوری منفی هم بحرانی است", () => {
  const neg = extract.activities.find((x) => x.Code === "MEC-2020");
  assert.equal(neg.TotalFloat, -2);
  assert.equal(neg.IsCritical, true);
});

test("استخراج: تاریخ‌های برنامه‌ای و واقعی تفکیک می‌شوند", () => {
  const a = extract.activities.find((x) => x.Code === "CIV-1010");
  assert.equal(a.PlannedStart, "2026-08-01");
  assert.equal(a.PlannedFinish, "2026-08-15");
  assert.equal(a.ActualStart, "2026-08-02");
  assert.equal(a.ActualFinish, "2026-08-16");
  const b = extract.activities.find((x) => x.Code === "CIV-1020");
  assert.equal(b.ActualFinish, null, "فعالیت ناتمام نباید پایان واقعی داشته باشد");
});

test("استخراج: وضعیت پریماورا نگاشت می‌شود", () => {
  assert.equal(extract.activities.find((x) => x.Code === "CIV-1010")._status, "completed");
  assert.equal(extract.activities.find((x) => x.Code === "CIV-1020")._status, "in_progress");
  assert.equal(extract.activities.find((x) => x.Code === "CIV-1030")._status, "not_started");
  assert.equal(Object.keys(XER_STATUS).length, 3);
});

test("استخراج: فعالیت به گره WBS بسته می‌شود", () => {
  const a = extract.activities.find((x) => x.Code === "CIV-1010");
  assert.ok(a.WbsId.endsWith(":wbs:W2"));
});

test("استخراج: درصد پیشرفت در بازه صفر تا صد محدود می‌شود", () => {
  assert.equal(extract.activities.find((x) => x.Code === "CIV-1010").PhysicalPct, 100);
  assert.equal(extract.activities.find((x) => x.Code === "CIV-1020").PhysicalPct, 60);
});

test("استخراج: روابط با نوع و تأخیر روزانه", () => {
  const r2 = extract.relations.find((r) => r.Id.endsWith(":rel:R2"));
  assert.equal(r2.RelType, "FS");
  assert.equal(r2.LagDays, 2, "۱۶ ساعت با تقویم ۸ ساعته = ۲ روز");
  const r3 = extract.relations.find((r) => r.Id.endsWith(":rel:R3"));
  assert.equal(r3.RelType, "SS");
  assert.equal(r3.LagDays, 5);
  assert.equal(Object.keys(XER_RELATION).length, 4);
});

test("استخراج: رابطه به فعالیت ناموجود دور ریخته و گزارش می‌شود", () => {
  assert.ok(!extract.relations.some((r) => r.Id.endsWith(":rel:R5")));
  assert.ok(extract.issues.some((i) => i.code === "W-ITG-XER-ORPHANREL"));
});

test("استخراج: نوع رابطه ناشناخته به FS تنزل می‌کند و هشدار می‌دهد", () => {
  const r6 = extract.relations.find((r) => r.Id.endsWith(":rel:R6"));
  assert.equal(r6.RelType, "FS");
  assert.ok(extract.issues.some((i) => i.code === "W-ITG-XER-RELTYPE"));
});

test("استخراج: شمارش‌ها با محتوا می‌خوانند", () => {
  assert.equal(extract.counts.activities, 5);
  assert.equal(extract.counts.relations, 5, "شش رابطه منهای یکی که یتیم بود");
  assert.equal(extract.counts.wbs, 3);
  assert.equal(extract.counts.calendars, 2);
});

test("استخراج: خروجی با اسکیمای Activity سازگار است", () => {
  const cols = new Set(allColumns(SCHEMA.find((t) => t.name === "Activity")).map((c) => c.name));
  for (const key of Object.keys(extract.activities[0])) {
    if (key.startsWith("_")) continue;
    assert.ok(cols.has(key), `ستون ${key} در جدول Activity نیست`);
  }
});

test("استخراج: هر سه خروجی همه ستون‌های اجباری اسکیما را دارند", () => {
  const cases = [
    ["WbsNode", extract.wbs],
    ["Activity", extract.activities],
    ["ActivityRelation", extract.relations],
  ];
  const managed = new Set(["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy", "RowVersion"]);
  for (const [table, rows] of cases) {
    const required = allColumns(SCHEMA.find((t) => t.name === table)).filter((c) => !c.nullable && !managed.has(c.name));
    for (const col of required) {
      assert.ok(rows[0][col.name] !== undefined && rows[0][col.name] !== null, `${table}.${col.name} در خروجی نیست`);
    }
  }
});

test("استخراج: خروجی روابط با اسکیمای ActivityRelation سازگار است", () => {
  const cols = new Set(allColumns(SCHEMA.find((t) => t.name === "ActivityRelation")).map((c) => c.name));
  for (const key of Object.keys(extract.relations[0])) assert.ok(cols.has(key), `ستون ${key} نیست`);
});

test("استخراج: فایل بدون TASK هشدار می‌دهد", () => {
  const e = extractXer(parseXer("%T\tCALENDAR\n%F\tclndr_id\n%R\tC1"), "p");
  assert.ok(e.issues.some((i) => i.code === "W-ITG-XER-NOTASK"));
  assert.equal(e.activities.length, 0);
});

test("استخراج: کد فعالیت تکراری خطا می‌سازد", () => {
  const dup = "%T\tTASK\n%F\ttask_id\ttask_code\ttask_name\n%R\tT1\tA\tیک\n%R\tT2\tA\tدو";
  const e = extractXer(parseXer(dup), "p");
  assert.ok(e.issues.some((i) => i.code === "E-ITG-XER-DUPCODE"));
});

test("استخراج: پایان پیش از شروع خطا می‌سازد", () => {
  const bad = "%T\tTASK\n%F\ttask_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\n%R\tT1\tA\tیک\t2026-09-20\t2026-09-01";
  const e = extractXer(parseXer(bad), "p");
  assert.ok(e.issues.some((i) => i.code === "E-ITG-XER-BADRANGE"));
});

/* ══════════ ۴. تفاوت‌گیری ══════════ */

test("diffRows افزوده، تغییریافته و حذف‌شده را تفکیک می‌کند", () => {
  const existing = [
    { Code: "A", NameFa: "یک", PhysicalPct: 10 },
    { Code: "B", NameFa: "دو", PhysicalPct: 20 },
    { Code: "C", NameFa: "سه", PhysicalPct: 30 },
  ];
  const incoming = [
    { Code: "A", NameFa: "یک", PhysicalPct: 10 },
    { Code: "B", NameFa: "دو ویرایش‌شده", PhysicalPct: 55 },
    { Code: "D", NameFa: "چهار", PhysicalPct: 0 },
  ];
  const d = diffRows(existing, incoming, "Code", ["NameFa", "PhysicalPct"]);
  assert.deepEqual(d.added.map((r) => r.Code), ["D"]);
  assert.deepEqual(d.removed.map((r) => r.Code), ["C"]);
  assert.equal(d.unchanged, 1);
  assert.equal(d.updated.length, 1);
  assert.deepEqual(d.updated[0].changed.sort(), ["NameFa", "PhysicalPct"]);
});

test("diffRows روی ورود دوباره همان فایل هیچ تغییری نمی‌بیند", () => {
  const d = diffRows(extract.activities, extract.activities, "Code", ACTIVITY_COMPARE_FIELDS);
  assert.equal(d.added.length, 0);
  assert.equal(d.updated.length, 0);
  assert.equal(d.removed.length, 0);
  assert.equal(d.unchanged, 5);
});

test("diffRows پایگاه خالی همه را افزوده می‌بیند", () => {
  const d = diffRows([], extract.activities, "Code", ACTIVITY_COMPARE_FIELDS);
  assert.equal(d.added.length, 5);
  assert.equal(d.removed.length, 0);
});

test("diffRows null و undefined را تغییر نمی‌شمارد", () => {
  const d = diffRows([{ K: "1", X: null }], [{ K: "1", X: undefined }], "K", ["X"]);
  assert.equal(d.updated.length, 0);
  assert.equal(d.unchanged, 1);
});

/* ══════════ ۵. تجزیه CSV ══════════ */

test("parseDelimited نقل‌قول و کاما داخل سلول را می‌فهمد", () => {
  const g = parseDelimited('a,b,c\r\n"1,5",دو,"او گفت ""بله"""');
  assert.deepEqual(g[0], ["a", "b", "c"]);
  assert.deepEqual(g[1], ["1,5", "دو", 'او گفت "بله"']);
});

test("parseDelimited خط جدید داخل سلول نقل‌قول‌شده را حفظ می‌کند", () => {
  const g = parseDelimited('a,b\n"خط یک\nخط دو",x');
  assert.equal(g.length, 2);
  assert.equal(g[1][0], "خط یک\nخط دو");
});

test("parseDelimited ردیف کاملاً خالی را حذف می‌کند و BOM را می‌خورد", () => {
  const g = parseDelimited("\uFEFFa,b\n1,2\n\n , \n3,4");
  assert.equal(g[0][0], "a");
  assert.deepEqual(g.map((r) => r[0]), ["a", "1", "3"]);
});

test("detectDelimiter نقطه‌ویرگول و tab را تشخیص می‌دهد", () => {
  assert.equal(detectDelimiter("a,b,c\n1,2,3"), ",");
  assert.equal(detectDelimiter("a;b;c\n1;2;3"), ";");
  assert.equal(detectDelimiter("a\tb\tc"), "\t");
  assert.equal(detectDelimiter('"a,b";c'), ";", "کامای داخل نقل‌قول نباید شمرده شود");
});

/* ══════════ ۶. قالب‌ها ══════════ */

test("کاتالوگ قالب‌ها سالم است", () => {
  assert.equal(TEMPLATE_CATALOG.length, 6);
  assert.equal(new Set(TEMPLATE_CATALOG.map((t) => t.code)).size, 6);
  for (const t of TEMPLATE_CATALOG) {
    assert.ok(t.title?.fa && t.title?.en, `${t.code} عنوان دوزبانه ندارد`);
    assert.ok(t.fields.length > 0, `${t.code} بدون میدان`);
    for (const fd of t.fields) assert.ok(fd.title?.fa && fd.title?.en, `${t.code}.${fd.key} عنوان دوزبانه ندارد`);
    assert.ok(t.keyFields.length > 0, `${t.code} بدون کلید`);
    for (const k of t.keyFields) assert.ok(t.fields.some((fd) => fd.key === k), `${t.code}: کلید ${k} میدان نیست`);
  }
});

test("هر قالب به جدول واقعی اسکیما اشاره می‌کند و میدان‌ها ستون واقعی‌اند", () => {
  for (const t of TEMPLATE_CATALOG) {
    const table = SCHEMA.find((x) => x.name === t.targetTable);
    assert.ok(table, `${t.code}: جدول ${t.targetTable} وجود ندارد`);
    const cols = new Set(allColumns(table).map((c) => c.name));
    for (const fd of t.fields) assert.ok(cols.has(fd.key), `${t.code}: ستون ${fd.key} در ${t.targetTable} نیست`);
  }
});

test("templateCsv سرستون و ردیف نمونه می‌سازد", () => {
  const csv = templateCsv(templateByCode("TPL-ACT"));
  const [header, sample] = csv.trim().split("\r\n");
  assert.ok(header.includes("کد فعالیت"));
  assert.ok(sample.includes("A-1010"));
  assert.equal(header.split(",").length, templateByCode("TPL-ACT").fields.length);
});

test("templateCsv انگلیسی سرستون لاتین می‌دهد", () => {
  assert.ok(templateCsv(templateByCode("TPL-NCR"), "en").includes("Severity"));
});

test("templateGuide قواعد هر ستون را می‌دهد", () => {
  const g = templateGuide(templateByCode("TPL-NCR"));
  const sev = g.find((x) => x.column === "شدت");
  assert.ok(sev.rule.includes("minor | major | critical"));
  assert.equal(sev.required, true);
});

test("templateByCode کد ناشناخته undefined می‌دهد", () => {
  assert.equal(templateByCode("TPL-NOPE"), undefined);
});

/* ══════════ ۷. نگاشت سرستون ══════════ */

test("mapHeaders نام فارسی، انگلیسی و پریماورا را می‌پذیرد", () => {
  const t = templateByCode("TPL-ACT");
  const m = mapHeaders(t, ["کد فعالیت", "Activity Name", "target_start_date"]);
  assert.equal(m.byIndex[0].key, "Code");
  assert.equal(m.byIndex[1].key, "NameFa");
  assert.equal(m.byIndex[2].key, "PlannedStart");
});

test("mapHeaders به فاصله، خط تیره و حروف بزرگ حساس نیست", () => {
  const m = mapHeaders(templateByCode("TPL-ACT"), ["  ACTIVITY   ID ", "activity_name"]);
  assert.equal(m.byIndex[0].key, "Code");
  assert.equal(m.byIndex[1].key, "NameFa");
});

test("mapHeaders ستون ناشناخته و ستون اجباری غایب را گزارش می‌کند", () => {
  const m = mapHeaders(templateByCode("TPL-ACT"), ["کد فعالیت", "ستون بی‌ربط"]);
  assert.deepEqual(m.unmatched, ["ستون بی‌ربط"]);
  assert.ok(m.missingRequired.some((fd) => fd.key === "NameFa"));
});

/* ══════════ ۸. تبدیل سلول ══════════ */

test("coerceCell عدد، تاریخ و بولی", () => {
  const t = templateByCode("TPL-ACT");
  const pct = t.fields.find((fd) => fd.key === "PhysicalPct");
  assert.equal(coerceCell(pct, "۴۲٫5".replace("٫", ".")).value, 42.5);
  assert.equal(coerceCell(pct, "abc").issue !== undefined, true);
  const d = t.fields.find((fd) => fd.key === "PlannedStart");
  assert.equal(coerceCell(d, "1405/06/17", toG).value, "2026-09-08");
});

test("coerceCell بازه عددی را کنترل می‌کند", () => {
  const pct = templateByCode("TPL-ACT").fields.find((fd) => fd.key === "PhysicalPct");
  assert.ok(coerceCell(pct, "150").issue.includes("بیشتر"));
  assert.ok(coerceCell(pct, "-5").issue.includes("کمتر"));
  assert.equal(coerceCell(pct, "100").issue, undefined);
});

test("coerceCell مقدار خارج از enum را رد می‌کند", () => {
  const sev = templateByCode("TPL-NCR").fields.find((fd) => fd.key === "Severity");
  assert.equal(coerceCell(sev, "major").issue, undefined);
  assert.ok(coerceCell(sev, "خیلی زیاد").issue);
});

test("coerceCell سلول خالی اجباری را خطا می‌دهد و اختیاری را null", () => {
  const t = templateByCode("TPL-ACT");
  assert.ok(coerceCell(t.fields.find((fd) => fd.key === "Code"), "  ").issue);
  assert.equal(coerceCell(t.fields.find((fd) => fd.key === "Discipline"), "").value, null);
});

test("coerceCell رشته بلندتر از حد را کوتاه و گزارش می‌کند", () => {
  const code = templateByCode("TPL-ACT").fields.find((fd) => fd.key === "Code");
  const r = coerceCell(code, "x".repeat(70));
  assert.equal(String(r.value).length, 60);
  assert.ok(r.issue.includes("60"));
});

/* ══════════ ۹. ورود کامل ══════════ */

const GOOD_CSV = `کد فعالیت,شرح فعالیت,شروع برنامه‌ای,پایان برنامه‌ای,درصد پیشرفت
A-1010,بتن‌ریزی فونداسیون,2026-09-01,2026-09-20,35.5
A-1020,"نصب سازه فلزی، فاز ۱",1405/06/17,1405/07/10,۰`;

test("ورود: فایل سالم همه ردیف‌ها را می‌پذیرد", () => {
  const r = parseImport(templateByCode("TPL-ACT"), GOOD_CSV, toG);
  assert.equal(r.counts.total, 2);
  assert.equal(r.counts.valid, 2);
  assert.equal(r.counts.errors, 0);
  assert.equal(r.rows[0].Code, "A-1010");
  assert.equal(r.rows[0].PhysicalPct, 35.5);
});

test("ورود: تاریخ شمسی و ارقام فارسی تبدیل می‌شوند", () => {
  const r = parseImport(templateByCode("TPL-ACT"), GOOD_CSV, toG);
  assert.equal(r.rows[1].PlannedStart, "2026-09-08");
  assert.equal(r.rows[1].PhysicalPct, 0);
  assert.equal(r.rows[1].NameFa, "نصب سازه فلزی، فاز 1");
});

test("ورود: ستون اجباری غایب کل ورود را متوقف می‌کند", () => {
  const r = parseImport(templateByCode("TPL-ACT"), "کد فعالیت\nA-1");
  assert.ok(r.issues.some((i) => i.code === "E-ITG-MISSINGCOL"));
  assert.equal(r.rows.length, 0, "با ستون اجباری غایب نباید ردیفی پذیرفته شود");
});

test("ورود: خطای سلولی با شماره سطر و نام ستون گزارش می‌شود", () => {
  const csv = `کد فعالیت,شرح فعالیت,شروع برنامه‌ای,پایان برنامه‌ای
A-1,یک,چرند,2026-09-20`;
  const r = parseImport(templateByCode("TPL-ACT"), csv);
  const issue = r.issues.find((i) => i.code === "E-ITG-CELL");
  assert.equal(issue.row, 2);
  assert.equal(issue.column, "شروع برنامه‌ای");
  assert.equal(r.counts.invalid, 1);
  assert.equal(r.counts.valid, 0);
});

test("ورود: کلید تکراری داخل فایل گرفته می‌شود", () => {
  const csv = `کد فعالیت,شرح فعالیت,شروع برنامه‌ای,پایان برنامه‌ای
A-1,یک,2026-09-01,2026-09-02
A-1,دو,2026-09-01,2026-09-02`;
  const r = parseImport(templateByCode("TPL-ACT"), csv);
  assert.equal(r.counts.duplicates, 1);
  assert.ok(r.issues.some((i) => i.code === "E-ITG-DUPKEY" && i.row === 3));
});

test("ورود: ستون ناشناخته فقط هشدار است و ورود ادامه می‌یابد", () => {
  const csv = `کد فعالیت,شرح فعالیت,شروع برنامه‌ای,پایان برنامه‌ای,ستون اضافه
A-1,یک,2026-09-01,2026-09-02,چیزی`;
  const r = parseImport(templateByCode("TPL-ACT"), csv);
  assert.ok(r.issues.some((i) => i.code === "W-ITG-UNKNOWNCOL"));
  assert.equal(r.counts.valid, 1);
});

test("ورود: فایل خالی خطای صریح می‌دهد", () => {
  const r = parseImport(templateByCode("TPL-ACT"), "");
  assert.ok(r.issues.some((i) => i.code === "E-ITG-EMPTY"));
});

test("ورود: جداکنندهٔ نقطه‌ویرگول خودکار تشخیص داده می‌شود", () => {
  const csv = "کد فعالیت;شرح فعالیت;شروع برنامه‌ای;پایان برنامه‌ای\nA-1;یک;2026-09-01;2026-09-02";
  const r = parseImport(templateByCode("TPL-ACT"), csv);
  assert.equal(r.counts.valid, 1);
  assert.equal(r.rows[0].Code, "A-1");
});

test("ورود: قالب تولیدشده توسط خودمان بدون خطا برمی‌گردد", () => {
  for (const t of TEMPLATE_CATALOG) {
    const r = parseImport(t, templateCsv(t), toG);
    assert.equal(r.counts.errors, 0, `${t.code}: ${JSON.stringify(r.issues)}`);
    assert.equal(r.counts.valid, 1, `${t.code} ردیف نمونه پذیرفته نشد`);
  }
});

test("ورود: خروجی با ستون‌های جدول هدف سازگار است", () => {
  for (const t of TEMPLATE_CATALOG) {
    const r = parseImport(t, templateCsv(t), toG);
    const cols = new Set(allColumns(SCHEMA.find((x) => x.name === t.targetTable)).map((c) => c.name));
    for (const key of Object.keys(r.rows[0])) assert.ok(cols.has(key), `${t.code}: ${key}`);
  }
});

/* ══════════ ۱۰. OpenAPI ══════════ */

const apiTables = SCHEMA.filter((t) => ["Activity", "Ncr", "ProgressEntry"].includes(t.name)).map((t) => ({
  name: t.name,
  title: t.title,
  pk: t.pk,
  columns: allColumns(t).map((c) => ({ name: c.name, kind: c.kind, len: c.len, nullable: c.nullable })),
}));
const spec = generateOpenApi(apiTables);

test("OpenAPI: ساختار پایه درست است", () => {
  assert.equal(spec.openapi, "3.0.3");
  assert.ok(spec.info.title);
  assert.ok(Array.isArray(spec.servers));
});

test("OpenAPI: برای هر جدول چهار عملیات ساخته می‌شود", () => {
  for (const t of apiTables) {
    const collection = spec.paths[`/api/data/${t.name}`];
    const item = spec.paths[`/api/data/${t.name}/{id}`];
    assert.ok(collection.get && collection.post, `${t.name} فهرست/ایجاد ندارد`);
    assert.ok(item.get && item.patch && item.delete, `${t.name} عملیات تکی ندارد`);
  }
});

test("OpenAPI: schema ستون‌ها با نوع و طول تولید می‌شود", () => {
  const act = spec.components.schemas.Activity;
  assert.equal(act.properties.PhysicalPct.type, "number");
  assert.equal(act.properties.PlannedStart.format, "date");
  assert.equal(act.properties.IsCritical.type, "boolean");
  assert.equal(act.properties.Code.maxLength, 60);
  assert.ok(act.required.includes("Code"));
});

test("OpenAPI: سرآیند If-Match برای کنترل هم‌زمانی مستند شده", () => {
  const patch = spec.paths["/api/data/Activity/{id}"].patch;
  assert.ok(patch.parameters.some((p) => p.name === "If-Match"));
  assert.ok(patch.responses[409]);
});

test("OpenAPI: مسیرهای یکپارچه‌سازی هم مستند شده‌اند", () => {
  assert.ok(spec.paths["/api/integration/xer"]);
  assert.ok(spec.paths["/api/integration/templates"]);
  assert.ok(spec.paths["/api/integration/import/{code}"]);
});

test("OpenAPI: مدل خطای مشترک تعریف شده", () => {
  assert.ok(spec.components.schemas.ApiError);
  assert.ok(spec.components.securitySchemes.bearerAuth);
});

test("OpenAPI: تولید برای کل اسکیما بدون استثنا انجام می‌شود", () => {
  const all = SCHEMA.map((t) => ({ name: t.name, title: t.title, pk: t.pk, columns: allColumns(t).map((c) => ({ name: c.name, kind: c.kind, len: c.len, nullable: c.nullable })) }));
  const full = generateOpenApi(all);
  assert.equal(Object.keys(full.components.schemas).length, SCHEMA.length + 1);
  assert.ok(Object.keys(full.paths).length >= SCHEMA.length * 2);
});

/* ══════════ ۱۱. YAML ══════════ */

test("toYaml انواع پایه را درست می‌نویسد", () => {
  assert.equal(toYaml(42), "42");
  assert.equal(toYaml(true), "true");
  assert.equal(toYaml("simple"), "simple");
  assert.equal(toYaml(""), '""');
  assert.equal(toYaml("has space"), '"has space"');
  assert.equal(toYaml([]), "[]");
  assert.equal(toYaml({}), "{}");
});

test("toYaml عدد داخل رشته را نقل‌قول می‌کند تا عدد تفسیر نشود", () => {
  assert.equal(toYaml("200"), '"200"');
});

test("toYaml ساختار تودرتو را با تورفتگی می‌سازد", () => {
  const y = toYaml({ a: { b: 1 }, c: [1, 2] });
  assert.ok(y.includes("a:"));
  assert.ok(y.includes("b: 1"));
  assert.ok(y.includes("- 1"));
});

test("toYaml روی مشخصات کامل OpenAPI اجرا می‌شود", () => {
  const y = toYaml(spec);
  assert.ok(y.includes("openapi: 3.0.3"));
  assert.ok(y.includes("/api/data/Activity"));
  assert.ok(y.length > 2000);
});

/* ══════════ ۱۲. اتصال‌دهنده‌ها ══════════ */

test("رجیستری اتصال‌دهنده‌ها سالم است", () => {
  assert.equal(CONNECTORS.length, 6);
  assert.equal(new Set(CONNECTORS.map((c) => c.code)).size, 6);
  for (const c of CONNECTORS) {
    assert.ok(["inbound", "outbound", "both"].includes(c.direction));
    assert.ok(["ready", "partial", "planned"].includes(c.status));
    assert.ok(c.note.fa && c.note.en);
  }
});

test("سه اتصال‌دهنده آماده‌اند و جدول‌های هدفشان واقعی است", () => {
  const ready = connectorsByStatus("ready");
  assert.equal(ready.length, 3);
  const names = new Set(SCHEMA.map((t) => t.name));
  for (const c of CONNECTORS) for (const t of c.targetTables) assert.ok(names.has(t), `${c.code}: جدول ${t} نیست`);
});

test("integrationStats با کاتالوگ می‌خواند", () => {
  const s = integrationStats();
  assert.equal(s.connectors, CONNECTORS.length);
  assert.equal(s.templates, TEMPLATE_CATALOG.length);
  assert.equal(s.templateFields, TEMPLATE_CATALOG.reduce((a, t) => a + t.fields.length, 0));
});
