/**
 * آزمون خروجی و بازخوانی ساختار شکست.
 *
 * محور اصلی: رفت‌وبرگشت اکسل. اگر فایلی که بیرون می‌رود دوباره خوانده
 * نشود، کاربر در اکسل کار می‌کند و برنامه از حقیقت عقب می‌افتد.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  EXPORT_VERSION,
  letterheadRows,
  columnsFor,
  variancePct,
  buildSheet,
  parseSheet,
  diffNodes,
  buildXer,
  buildMspXml,
  depthFirst,
  exportFileName,
} from "./bexLogic.js";

const LH = {
  projectCode: "PRJ-167",
  projectTitleFa: "پروژهٔ نمونه",
  contractNo: "C-2026-001",
  contractType: "EPCC",
  contractAmount: 167000,
  currency: "MUSD",
  dataDate: "2026-09-12",
  revision: "2",
  preparedBy: "دفتر برنامه‌ریزی",
};

const NODES = [
  { id: "n1", code: "E", parentCode: null, titleFa: "مهندسی", depth: 1, weightFactor: 11, weightValue: 11, amount: 18370, actualPct: 100, plannedPct: 100, basis: "agreed" },
  { id: "n2", code: "P", parentCode: null, titleFa: "تدارکات", depth: 1, weightFactor: 45, weightValue: 45, amount: 75150, actualPct: 60, plannedPct: 70, basis: "agreed" },
  { id: "n3", code: "C", parentCode: null, titleFa: "اجرا", depth: 1, weightFactor: 36, weightValue: 36, amount: 60120, basis: "agreed" },
  { id: "n4", code: "C.1", parentCode: "C", titleFa: "ابنیه", depth: 2, weightFactor: 30, weightValue: 10.8, amount: 18036, actualPct: 40, plannedPct: 35, basis: "agreed" },
  { id: "n5", code: "C.2", parentCode: "C", titleFa: "مکانیک", depth: 2, weightFactor: 70, weightValue: 25.2, amount: 42084, actualPct: 10, plannedPct: 20, basis: "agreed" },
  { id: "n6", code: "CM", parentCode: null, titleFa: "راه‌اندازی", depth: 1, weightFactor: 8, weightValue: 8, amount: 13360, basis: "agreed" },
];

test("bex: نسخهٔ موتور اعلام شده است", () => {
  assert.equal(EXPORT_VERSION, "bex-v1");
});

/* ══════════════════ سربرگ ══════════════════ */

test("bex: سربرگ مبلغ و نوع قرارداد را می‌آورد", () => {
  const rows = letterheadRows(LH);
  const flat = rows.flat().join("|");
  assert.ok(flat.includes("EPCC"));
  assert.ok(flat.includes("167000"));
  assert.ok(flat.includes("PRJ-167"));
});

test("bex: نبود مبلغ سربرگ را نمی‌شکند", () => {
  const rows = letterheadRows({ ...LH, contractAmount: null });
  assert.ok(rows.length >= 3);
  assert.ok(rows.flat().join("|").includes("2026-09-12"));
});

test("bex: سربرگ با سطر خالی از جدول جدا می‌شود", () => {
  const rows = letterheadRows(LH);
  assert.equal(rows[rows.length - 1].length, 0);
});

/* ══════════════════ ستون‌ها ══════════════════ */

test("bex: هر نما ستون‌های خودش را دارد", () => {
  const wbs = columnsFor("wbs").map((c) => c.key);
  const cbs = columnsFor("cbs").map((c) => c.key);
  const wpa = columnsFor("wpa").map((c) => c.key);
  const pms = columnsFor("pms").map((c) => c.key);

  assert.ok(cbs.includes("costAccountCode"));
  assert.ok(!wbs.includes("costAccountCode"));
  assert.ok(wpa.includes("basis"));
  assert.ok(pms.includes("variancePct"));
});

test("bex: نمای لامپ‌سام ستون مقدار ندارد", () => {
  /* قرارداد لامپ‌سام ردیف متره‌ای ندارد؛ ستون مقدار یعنی دعوت به
   * پر کردن عددی که مبنای قراردادی ندارد. */
  const wpa = columnsFor("wpa").map((c) => c.key);
  assert.ok(!wpa.includes("qty"));
});

test("bex: شناسه نخستین ستون است", () => {
  /* بازخوانی به آن تکیه می‌کند. */
  for (const v of ["wbs", "cbs", "wpa", "pms"]) {
    assert.equal(columnsFor(v)[0].key, "id");
  }
});

test("bex: ستون دلخواه پس از ستون‌های ثابت می‌آید", () => {
  /* اگر پیش از آن‌ها بیاید، افزودن یک ستون قالب ذخیره‌شدهٔ کاربر را
   * می‌شکند. */
  const cols = columnsFor("pms", [{ key: "crew", titleFa: "اکیپ", dataKind: "text" }]);
  assert.equal(cols[cols.length - 1].key, "x:crew");
  assert.equal(cols[0].key, "id");
});

test("bex: ستون دلخواه فقط در نمای PMS ظاهر می‌شود", () => {
  const custom = [{ key: "crew", titleFa: "اکیپ", dataKind: "text" }];
  assert.ok(!columnsFor("wbs", custom).some((c) => c.key.startsWith("x:")));
  assert.ok(columnsFor("pms", custom).some((c) => c.key.startsWith("x:")));
});

/* ══════════════════ انحراف ══════════════════ */

test("bex: انحراف تفاضل واقعی از برنامه‌ای است", () => {
  assert.equal(variancePct({ actualPct: 40, plannedPct: 35 }), 5);
  assert.equal(variancePct({ actualPct: 10, plannedPct: 20 }), -10);
});

test("bex: نبود یکی از دو طرف انحراف را null می‌کند نه صفر", () => {
  /* صفر یعنی «دقیقاً طبق برنامه» که ادعاست. */
  assert.equal(variancePct({ actualPct: 40, plannedPct: null }), null);
  assert.equal(variancePct({ actualPct: null, plannedPct: 20 }), null);
});

/* ══════════════════ ساخت برگه ══════════════════ */

test("bex: برگه سربرگ و سرستون و داده دارد", () => {
  const sh = buildSheet("pms", NODES, LH);
  assert.equal(sh.name, "PMS");
  assert.ok(sh.rows.length > NODES.length);
  assert.ok(sh.headerRowIndex > 0);
});

test("bex: سطر کلید ماشینی زیر سرستون فارسی می‌آید", () => {
  /* بدون آن، بازخوانی باید عنوان فارسی را حدس بزند و یک نیم‌فاصله
   * واردات را می‌شکند. */
  const sh = buildSheet("wbs", NODES, LH);
  const keyRow = sh.rows[sh.headerRowIndex + 1];
  assert.ok(keyRow.includes("#code"));
  assert.ok(keyRow.includes("#id"));
});

test("bex: سرستون به زبان خواسته‌شده نوشته می‌شود", () => {
  const fa = buildSheet("wbs", NODES, LH, [], "fa");
  const en = buildSheet("wbs", NODES, LH, [], "en");
  assert.ok(fa.rows[fa.headerRowIndex].includes("شرح"));
  assert.ok(en.rows[en.headerRowIndex].includes("Description"));
});

test("bex: مقدار ستون دلخواه در سطر می‌نشیند", () => {
  const nodes = [{ ...NODES[0], custom: { crew: "اکیپ الف" } }];
  const sh = buildSheet("pms", nodes, LH, [{ key: "crew", titleFa: "اکیپ", dataKind: "text" }]);
  const dataRow = sh.rows[sh.rows.length - 1];
  assert.ok(dataRow.includes("اکیپ الف"));
});

test("bex: میدان خالی null می‌ماند نه رشتهٔ خالی", () => {
  const sh = buildSheet("wpa", [{ code: "X", titleFa: "بی‌وزن", depth: 1 }], LH);
  const row = sh.rows[sh.rows.length - 1];
  const keys = sh.rows[sh.headerRowIndex + 1];
  const at = keys.indexOf("#weightFactor");
  assert.equal(row[at], null);
});

/* ══════════════════ رفت‌وبرگشت ══════════════════ */

test("bex: فایل خروجی دوباره خوانده می‌شود", () => {
  const sh = buildSheet("pms", NODES, LH);
  const back = parseSheet(sh.rows);
  assert.equal(back.issues.filter((i) => i.severity === "error").length, 0);
  assert.equal(back.nodes.length, NODES.length);
});

test("bex: رفت‌وبرگشت وزن و مبلغ را حفظ می‌کند", () => {
  const sh = buildSheet("pms", NODES, LH);
  const back = parseSheet(sh.rows);
  const c2 = back.nodes.find((n) => n.code === "C.2");
  assert.equal(c2.weightFactor, 70);
  assert.equal(c2.weightValue, 25.2);
  assert.equal(c2.amount, 42084);
});

test("bex: رفت‌وبرگشت سلسله‌مراتب را حفظ می‌کند", () => {
  const sh = buildSheet("wbs", NODES, LH);
  const back = parseSheet(sh.rows);
  const c1 = back.nodes.find((n) => n.code === "C.1");
  assert.equal(c1.parentCode, "C");
  assert.equal(c1.depth, 2);
});

test("bex: رفت‌وبرگشت ستون دلخواه را حفظ می‌کند", () => {
  const cols = [{ key: "crew", titleFa: "اکیپ", dataKind: "text" }];
  const nodes = [{ ...NODES[0], custom: { crew: "اکیپ ب" } }];
  const sh = buildSheet("pms", nodes, LH, cols);
  const back = parseSheet(sh.rows);
  assert.equal(back.nodes[0].custom.crew, "اکیپ ب");
});

test("bex: ردیف با شناسه ویرایش است و بدون شناسه ایجاد", () => {
  const sh = buildSheet("wbs", NODES, LH);
  const rows = sh.rows.map((r) => [...r]);
  const keys = rows[sh.headerRowIndex + 1];
  const idAt = keys.indexOf("#id");
  /* کاربر شناسهٔ یک ردیف را پاک کرده است. */
  rows[rows.length - 1][idAt] = "";
  const back = parseSheet(rows);
  assert.equal(back.createdCount, 1);
  assert.equal(back.updatedCount, NODES.length - 1);
});

/* ══════════════════ خطاهای بازخوانی ══════════════════ */

test("bex: فایل بیگانه با پیام صریح رد می‌شود", () => {
  /* حدس زدن نگاشت ستون یعنی نوشتن عدد در ستون اشتباه. */
  const r = parseSheet([["کد", "شرح"], ["A", "چیزی"]]);
  assert.equal(r.nodes.length, 0);
  assert.ok(r.issues[0].messageFa.includes("#code"));
});

test("bex: ردیف بدون کد نادیده گرفته و گزارش می‌شود", () => {
  const sh = buildSheet("wbs", NODES, LH);
  const rows = sh.rows.map((r) => [...r]);
  const keys = rows[sh.headerRowIndex + 1];
  rows[rows.length - 1][keys.indexOf("#code")] = "";
  const back = parseSheet(rows);
  assert.equal(back.nodes.length, NODES.length - 1);
  assert.ok(back.issues.some((i) => i.messageFa.includes("بدون کد")));
});

test("bex: کد تکراری خطاست نه بازنویسی بی‌صدا", () => {
  /* دو ردیف سر یک گره دعوا دارند؛ کدام درست است قابل تشخیص نیست. */
  const sh = buildSheet("wbs", NODES, LH);
  const rows = sh.rows.map((r) => [...r]);
  const keys = rows[sh.headerRowIndex + 1];
  rows[rows.length - 1][keys.indexOf("#code")] = "E";
  const back = parseSheet(rows);
  assert.ok(back.issues.some((i) => i.messageFa.includes("تکراری")));
});

test("bex: وزن خارج از بازه خطا می‌دهد", () => {
  const sh = buildSheet("wpa", NODES, LH);
  const rows = sh.rows.map((r) => [...r]);
  const keys = rows[sh.headerRowIndex + 1];
  rows[rows.length - 1][keys.indexOf("#weightFactor")] = 150;
  const back = parseSheet(rows);
  assert.ok(back.issues.some((i) => i.messageFa.includes("خارج از بازه")));
});

test("bex: والد ناموجود پیش از ذخیره دیده می‌شود", () => {
  const sh = buildSheet("wbs", [{ code: "X", parentCode: "GHOST", titleFa: "یتیم", depth: 2 }], LH);
  const back = parseSheet(sh.rows);
  assert.ok(back.issues.some((i) => i.messageFa.includes("GHOST")));
});

test("bex: عدد با جداکنندهٔ هزارگان خوانده می‌شود", () => {
  const sh = buildSheet("wpa", NODES, LH);
  const rows = sh.rows.map((r) => [...r]);
  const keys = rows[sh.headerRowIndex + 1];
  rows[rows.length - 1][keys.indexOf("#amount")] = "13,360";
  const back = parseSheet(rows);
  assert.equal(back.nodes[back.nodes.length - 1].amount, 13360);
});

test("bex: سطر کاملاً خالی رد می‌شود بدون خطا", () => {
  const sh = buildSheet("wbs", NODES, LH);
  const rows = [...sh.rows, [null, null, null], []];
  const back = parseSheet(rows);
  assert.equal(back.nodes.length, NODES.length);
});

/* ══════════════════ گزارش مغایرت ══════════════════ */

test("bex: تغییر وزن در گزارش مغایرت دیده می‌شود", () => {
  const incoming = NODES.map((n) => (n.code === "P" ? { ...n, weightFactor: 50 } : n));
  const d = diffNodes(NODES, incoming);
  assert.equal(d.changed.length, 1);
  assert.equal(d.changed[0].code, "P");
  assert.equal(d.changed[0].before, 45);
  assert.equal(d.changed[0].after, 50);
});

test("bex: افزودن و حذف گره گزارش می‌شود", () => {
  const incoming = [...NODES.filter((n) => n.code !== "CM"), { code: "NEW", titleFa: "تازه", depth: 1 }];
  const d = diffNodes(NODES, incoming);
  assert.deepEqual(d.added, ["NEW"]);
  assert.deepEqual(d.removed, ["CM"]);
});

test("bex: نبود تغییر گزارش خالی می‌دهد", () => {
  const d = diffNodes(NODES, NODES);
  assert.equal(d.changed.length, 0);
  assert.equal(d.added.length, 0);
  assert.equal(d.removed.length, 0);
});

/* ══════════════════ پیمایش عمق‌اول ══════════════════ */

test("bex: فرزند هرگز پیش از والد نمی‌آید", () => {
  /* در XML تورفتگی از ترتیب سطرها ساخته می‌شود؛ فرزند زودرس کل درخت
   * را می‌شکند. */
  const shuffled = [NODES[3], NODES[0], NODES[4], NODES[2], NODES[5], NODES[1]];
  const out = depthFirst(shuffled);
  const at = (c) => out.findIndex((n) => n.code === c);
  assert.ok(at("C") < at("C.1"));
  assert.ok(at("C") < at("C.2"));
});

test("bex: حلقهٔ والد گره‌ها را حذف نمی‌کند", () => {
  const loop = [
    { code: "A", parentCode: "B", titleFa: "الف", depth: 1 },
    { code: "B", parentCode: "A", titleFa: "ب", depth: 1 },
  ];
  assert.equal(depthFirst(loop).length, 2);
});

/* ══════════════════ XER ══════════════════ */

test("bex: XER سربرگ و جدول PROJWBS دارد", () => {
  const xer = buildXer(NODES, LH);
  assert.ok(xer.startsWith("ERMHDR"));
  assert.ok(xer.includes("%T\tPROJWBS"));
  assert.ok(xer.trimEnd().endsWith("%E"));
});

test("bex: هر گره یک سطر R دارد به‌علاوهٔ ریشه", () => {
  const xer = buildXer(NODES, LH);
  const rCount = xer.split("\n").filter((l) => l.startsWith("%R")).length;
  assert.equal(rCount, NODES.length + 1);
});

test("bex: فرزند به شناسهٔ والد اشاره می‌کند نه به ریشه", () => {
  const xer = buildXer(NODES, LH);
  const lines = xer.split("\n").filter((l) => l.startsWith("%R"));
  const cLine = lines.find((l) => l.includes("\tC\t"));
  const c1Line = lines.find((l) => l.includes("\tC.1\t"));
  const cId = cLine.split("\t")[1];
  assert.equal(c1Line.split("\t")[3], cId);
});

test("bex: نویسهٔ tab در عنوان ساختار XER را نمی‌شکند", () => {
  /* XER جداشده با tab است؛ یک tab در عنوان همهٔ ستون‌ها را جابه‌جا
   * می‌کند. سطر %R نُه میدان دارد: نشانه + هشت ستون PROJWBS. */
  const clean = buildXer([{ code: "A", titleFa: "عنوان ساده", depth: 1 }], LH);
  const expected = clean.split("\n").find((l) => l.includes("\tA\t")).split("\t").length;

  const dirty = buildXer([{ code: "A", titleFa: "عنوان\tبا تب", depth: 1 }], LH);
  const line = dirty.split("\n").find((l) => l.includes("\tA\t"));
  assert.equal(line.split("\t").length, expected);
  assert.ok(line.includes("عنوان با تب"));
});

/* ══════════════════ MSP XML ══════════════════ */

test("bex: XML طرح مایکروسافت را اعلام می‌کند", () => {
  const xml = buildMspXml(NODES, LH);
  assert.ok(xml.includes('<?xml version="1.0"'));
  assert.ok(xml.includes("schemas.microsoft.com/project"));
  assert.ok(xml.includes("</Project>"));
});

test("bex: سطح تورفتگی از عمق گره می‌آید", () => {
  const xml = buildMspXml(NODES, LH);
  assert.ok(xml.includes("<OutlineLevel>2</OutlineLevel>"));
  assert.ok(xml.includes("<OutlineLevel>1</OutlineLevel>"));
});

test("bex: گره دارای فرزند خلاصه علامت می‌خورد", () => {
  const xml = buildMspXml(NODES, LH);
  const cBlock = xml.split("<Task>").find((b) => b.includes("<WBS>C</WBS>"));
  assert.ok(cBlock.includes("<Summary>1</Summary>"));
  const eBlock = xml.split("<Task>").find((b) => b.includes("<WBS>E</WBS>"));
  assert.ok(eBlock.includes("<Summary>0</Summary>"));
});

test("bex: پیشرفت نامشخص صفر نوشته نمی‌شود", () => {
  /* صفرِ ساختگی یعنی ادعای «شروع نشده» برای کاری که ممکن است تمام
   * باشد. */
  const xml = buildMspXml([{ code: "X", titleFa: "بی‌گزارش", depth: 1 }], LH);
  assert.ok(!xml.includes("<PercentComplete>"));
});

test("bex: نویسهٔ ویژه در عنوان XML را خراب نمی‌کند", () => {
  const xml = buildMspXml([{ code: "A", titleFa: 'خط <۱> و "نقل" و &', depth: 1 }], LH);
  assert.ok(xml.includes("&lt;"));
  assert.ok(xml.includes("&amp;"));
  assert.ok(!xml.includes("<۱>"));
});

/* ══════════════════ نام فایل ══════════════════ */

test("bex: نام فایل کد پروژه و نما و تاریخ دارد", () => {
  const name = exportFileName(LH, "pms", "xlsx");
  assert.ok(name.includes("PRJ-167"));
  assert.ok(name.includes("PMS"));
  assert.ok(name.includes("2026-09-12"));
  assert.ok(name.endsWith(".xlsx"));
});

test("bex: ویرایش در نام فایل می‌آید", () => {
  assert.ok(exportFileName(LH, "wbs", "xer").includes("R2"));
});

test("bex: نویسهٔ ممنوع ویندوز از نام فایل حذف می‌شود", () => {
  const name = exportFileName({ ...LH, projectCode: 'A/B:C*D?"' }, "wbs", "xml");
  assert.ok(!/[\\/:*?"<>|]/.test(name));
});
