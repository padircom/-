/**
 * آزمون موتور تقسیم بند قرارداد.
 *
 * هر الگوی شماره‌گذاری آزمون جدا دارد تا افزودن الگوی تازه — که با
 * دیدن قرارداد واقعی کاربر لازم می‌شود — چیزی را نشکند.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  CLAUSE_VERSION,
  canonicalStepCode,
  normalizeClauseNo,
  parentOf,
  guessTitle,
  buildPageIndex,
  pageOf,
  parseClauses,
  buildClauseTree,
  sourceRefFa,
} from "./clauseLogic.js";

test("clause: نسخهٔ موتور اعلام شده است", () => {
  assert.equal(CLAUSE_VERSION, "clause-v1");
});

/* ══════════════════ یکسان‌سازی شماره ══════════════════ */

test("clause: ارقام فارسی به لاتین تبدیل می‌شوند", () => {
  assert.equal(normalizeClauseNo("۵-۲-۳"), "5-2-3");
});

test("clause: ارقام عربی هم تبدیل می‌شوند", () => {
  assert.equal(normalizeClauseNo("٥-٢"), "5-2");
});

test("clause: فاصله دور جداکننده حذف می‌شود", () => {
  /* «۵ - ۲» و «۵-۲» یک بندند؛ اگر جدا شمرده شوند درخت دو شاخه می‌گیرد. */
  assert.equal(normalizeClauseNo("۵ - ۲"), "5-2");
  assert.equal(normalizeClauseNo("5 . 2"), "5.2");
});

test("clause: خط تیرهٔ بلند به خط تیرهٔ ساده تبدیل می‌شود", () => {
  assert.equal(normalizeClauseNo("5–2"), "5-2");
  assert.equal(normalizeClauseNo("5—2"), "5-2");
});

test("clause: نیم‌فاصله پاک می‌شود", () => {
  assert.equal(normalizeClauseNo("ماده\u200c۵"), "ماده5");
});

/* ══════════════════ والد ══════════════════ */

test("clause: والد از شمارهٔ سلسله‌مراتبی درمی‌آید", () => {
  assert.equal(parentOf("5-2-3"), "5-2");
  assert.equal(parentOf("5.2.3"), "5.2");
});

test("clause: بند سطح یک والد ندارد", () => {
  assert.equal(parentOf("5"), null);
});

test("clause: بند غیرعددی والد سلسله‌مراتبی ندارد", () => {
  /* «ماده ۷» ساختار سلسله‌مراتبی در خودش ندارد. */
  assert.equal(parentOf("ماده 7"), null);
  assert.equal(parentOf("بند الف"), null);
});

test("clause: ترکیب حرف و عدد والد نمی‌سازد", () => {
  assert.equal(parentOf("الف-2"), null);
});

/* ══════════════════ عنوان ══════════════════ */

test("clause: عنوان کوتاه پذیرفته می‌شود", () => {
  assert.equal(guessTitle("تعاریف و اصطلاحات"), "تعاریف و اصطلاحات");
});

test("clause: خط بلند عنوان نیست", () => {
  /* عنوان ساختگی بدتر از نبودن عنوان است. */
  const long = "ا".repeat(120);
  assert.equal(guessTitle(long), null);
});

test("clause: جمله‌ای که با نقطه تمام شود عنوان نیست", () => {
  assert.equal(guessTitle("این قرارداد بین طرفین منعقد شد."), null);
  assert.equal(guessTitle("پرداخت‌ها ماهانه انجام می‌شود،"), null);
});

test("clause: خط خالی عنوان نمی‌دهد", () => {
  assert.equal(guessTitle("   "), null);
});

/* ══════════════════ صفحه ══════════════════ */

test("clause: شمارهٔ صفحه از جداکنندهٔ صفحه درمی‌آید", () => {
  const text = "صفحه یک\fصفحه دو\fصفحه سه";
  const bounds = buildPageIndex(text);
  assert.equal(pageOf(0, bounds), 1);
  assert.equal(pageOf(text.indexOf("صفحه دو"), bounds), 2);
  assert.equal(pageOf(text.indexOf("صفحه سه"), bounds), 3);
});

test("clause: متن بدون جداکننده یک صفحه است", () => {
  const bounds = buildPageIndex("بدون شکست صفحه");
  assert.equal(pageOf(5, bounds), 1);
});

/* ══════════════════ الگوها ══════════════════ */

test("clause: الگوی عدد-خط‌تیره", () => {
  const text = ["۱- موضوع قرارداد", "متن اول", "۱-۱- شرح کار", "متن دوم", "۲- مدت"].join("\n");
  const r = parseClauses(text);
  assert.equal(r.dominantStyle, "numeric_dash");
  assert.deepEqual(r.clauses.map((c) => c.clauseNo), ["1", "1-1", "2"]);
});

test("clause: الگوی عدد-نقطه", () => {
  const text = ["1.1 Scope of work", "body", "1.2 Duration", "body"].join("\n");
  const r = parseClauses(text);
  assert.deepEqual(r.clauses.map((c) => c.clauseNo), ["1.1", "1.2"]);
});

test("clause: الگوی ماده", () => {
  const text = ["ماده ۱ - تعاریف", "متن", "ماده ۲ - موضوع", "متن"].join("\n");
  const r = parseClauses(text);
  assert.equal(r.dominantStyle, "article");
  assert.deepEqual(r.clauses.map((c) => c.clauseNo), ["ماده 1", "ماده 2"]);
});

test("clause: الگوی بند حرفی", () => {
  const text = ["بند الف) شرایط", "متن", "بند ب) تعهدات", "متن"].join("\n");
  const r = parseClauses(text);
  assert.deepEqual(r.clauses.map((c) => c.clauseNo), ["بند الف", "بند ب"]);
});

test("clause: تبصره فرزند بند پیشین است", () => {
  const text = ["ماده ۵ - پرداخت", "متن ماده", "تبصره ۱", "متن تبصره"].join("\n");
  const r = parseClauses(text);
  const note = r.clauses.find((c) => c.style === "note");
  assert.ok(note);
  assert.equal(note.parentClauseNo, "ماده 5");
});

test("clause: الگوی انگلیسی Article/Section", () => {
  const text = ["Article 1 Definitions", "body", "Section 2.1 Payment", "body"].join("\n");
  const r = parseClauses(text);
  assert.equal(r.clauses.length, 2);
  assert.equal(r.clauses[0].style, "section_en");
});

test("clause: عدد تنها با نقطه سرِ بند است", () => {
  const text = ["7. Payment terms", "body text", "8. Warranty", "body"].join("\n");
  const r = parseClauses(text);
  assert.deepEqual(r.clauses.map((c) => c.clauseNo), ["7", "8"]);
});

test("clause: ماده پیش از عدد ساده تشخیص داده می‌شود", () => {
  /* اگر ترتیب الگوها غلط باشد «ماده ۵» به عدد ساده تجزیه می‌شود و
   * کلمهٔ «ماده» از دست می‌رود. */
  const r = parseClauses("ماده ۵ - پرداخت\nمتن");
  assert.equal(r.clauses[0].style, "article");
  assert.equal(r.clauses[0].clauseNo, "ماده 5");
});

/* ══════════════════ ساختار خروجی ══════════════════ */

test("clause: عمق از تعداد اجزا حساب می‌شود", () => {
  const text = ["۱- الف", "x", "۱-۱- ب", "x", "۱-۱-۱- ج", "x"].join("\n");
  const r = parseClauses(text);
  assert.deepEqual(r.clauses.map((c) => c.depth), [1, 2, 3]);
});

test("clause: بدنهٔ بند تا سرِ بند بعدی ادامه دارد", () => {
  const text = ["۱- اول", "خط یک", "خط دو", "۲- دوم", "خط سه"].join("\n");
  const r = parseClauses(text);
  assert.ok(r.clauses[0].bodyText.includes("خط یک"));
  assert.ok(r.clauses[0].bodyText.includes("خط دو"));
  assert.ok(!r.clauses[0].bodyText.includes("خط سه"));
});

test("clause: مرز نویسه‌ای بند ثبت می‌شود", () => {
  /* مبنای برجسته‌سازی در پیش‌نمایش. */
  const text = ["۱- اول", "متن", "۲- دوم"].join("\n");
  const r = parseClauses(text);
  assert.equal(r.clauses[0].charStart, 0);
  assert.ok(r.clauses[0].charEnd > r.clauses[0].charStart);
  assert.equal(r.clauses[1].charStart, r.clauses[0].charEnd);
});

test("clause: ترتیب اصلی حفظ می‌شود", () => {
  const r = parseClauses(["۳- سوم", "x", "۱- اول", "x"].join("\n"));
  assert.deepEqual(r.clauses.map((c) => c.ordinal), [1, 2]);
  assert.equal(r.clauses[0].clauseNo, "3");
});

test("clause: مقدمه پیش از نخستین بند جدا نگه داشته می‌شود", () => {
  const text = ["قرارداد پیمانکاری", "بین شرکت الف و ب", "۱- موضوع", "متن"].join("\n");
  const r = parseClauses(text);
  assert.ok(r.preamble.includes("قرارداد پیمانکاری"));
  assert.equal(r.clauses.length, 1);
});

/* ══════════════════ حالت‌های مرزی ══════════════════ */

test("clause: متن خالی هشدار OCR می‌دهد نه خطا", () => {
  const r = parseClauses("");
  assert.equal(r.clauses.length, 0);
  assert.ok(r.warningsFa.some((w) => w.includes("OCR")));
});

test("clause: متن بدون شماره‌گذاری صریح اعلام می‌شود", () => {
  const r = parseClauses("این یک متن ساده است بدون هیچ شماره‌ای در ابتدای خطوط");
  assert.equal(r.clauses.length, 0);
  assert.equal(r.dominantStyle, null);
  assert.ok(r.warningsFa.some((w) => w.includes("شناسایی نشد")));
});

test("clause: null و undefined نمی‌شکنند", () => {
  assert.equal(parseClauses(null).clauses.length, 0);
  assert.equal(parseClauses(undefined).clauses.length, 0);
});

test("clause: شمارهٔ تکراری هشدار می‌دهد و یکتا می‌شود", () => {
  /* بعضی قراردادها شماره را در سربرگ صفحه تکرار می‌کنند. */
  const text = ["۱- اول", "متن", "۱- دوباره", "متن"].join("\n");
  const r = parseClauses(text);
  assert.equal(r.clauses.length, 2);
  assert.notEqual(r.clauses[0].clauseNo, r.clauses[1].clauseNo);
  assert.ok(r.warningsFa.some((w) => w.includes("بیش از یک بار")));
});

test("clause: والد گم‌شده هشدار می‌دهد", () => {
  /* «۵-۲-۳» بدون «۵-۲» درخت را می‌شکند. */
  const r = parseClauses("۵-۲-۳- بند تنها\nمتن");
  assert.ok(r.warningsFa.some((w) => w.includes("والدِ ثبت‌نشده")));
});

test("clause: قاطی بودن چند سبک هشدار می‌دهد", () => {
  const text = ["ماده ۱", "x", "بند الف", "x", "1.1 Scope", "x", "تبصره ۱", "x"].join("\n");
  const r = parseClauses(text);
  assert.ok(r.warningsFa.some((w) => w.includes("چند سبک")));
});

/* ══════════════════ درخت ══════════════════ */

test("clause: درخت از فهرست تخت ساخته می‌شود", () => {
  const r = parseClauses(["۱- الف", "x", "۱-۱- ب", "x", "۱-۲- ج", "x", "۲- د", "x"].join("\n"));
  const tree = buildClauseTree(r.clauses);
  assert.equal(tree.length, 2);
  assert.equal(tree[0].children.length, 2);
  assert.equal(tree[1].children.length, 0);
});

test("clause: بند یتیم دور ریخته نمی‌شود", () => {
  /* یک بند گم‌شده بدتر از یک درخت ناقص است. */
  const clauses = [
    { clauseNo: "5-2-3", parentClauseNo: "5-2", depth: 3, titleFa: null, bodyText: "x", style: "numeric_dash", charStart: 0, charEnd: 1, pageNo: 1, ordinal: 1 },
  ];
  const tree = buildClauseTree(clauses);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].clauseNo, "5-2-3");
});

/* ══════════════════ سند واقع‌نما ══════════════════ */

test("clause: زیربند عددی به سرشاخهٔ «ماده» وصل می‌شود", () => {
  /* این نقص روی متن واقع‌نما پیدا شد نه در طراحی: سندهای فارسی مرتب
   * سرشاخه را «ماده ۲» و زیرشاخه را «۲-۱» می‌نویسند. والد عددی «۲»
   * وجود ندارد، پس بدون این اصلاح همهٔ زیربندها یتیم می‌شدند. */
  const text = ["ماده ۲ - موضوع", "متن", "۲-۱- خاکبرداری", "متن", "۲-۲- بتن‌ریزی", "متن"].join("\n");
  const r = parseClauses(text);
  const sub = r.clauses.filter((c) => c.clauseNo.startsWith("2-"));
  assert.equal(sub.length, 2);
  for (const c of sub) assert.equal(c.parentClauseNo, "ماده 2");
  assert.ok(!r.warningsFa.some((w) => w.includes("والدِ ثبت‌نشده")));
});

test("clause: سند مختلط درخت درست می‌سازد", () => {
  const text = [
    "ماده ۱ - تعاریف", "متن",
    "ماده ۲ - موضوع", "متن",
    "۲-۱- خاکبرداری", "متن",
    "۲-۲- بتن‌ریزی", "متن",
    "۲-۲-۱- بتن مگر", "متن",
    "تبصره ۱", "متن",
    "ماده ۳ - مبلغ", "متن",
  ].join("\n");
  const r = parseClauses(text);
  const tree = buildClauseTree(r.clauses);
  assert.deepEqual(tree.map((n) => n.clauseNo), ["ماده 1", "ماده 2", "ماده 3"]);
  const m2 = tree[1];
  assert.deepEqual(m2.children.map((n) => n.clauseNo), ["2-1", "2-2"]);
  assert.equal(m2.children[1].children[0].clauseNo, "2-2-1");
});

test("clause: تبصره به آخرین بند می‌چسبد حتی اگر عددی باشد", () => {
  const text = ["ماده ۵", "x", "۵-۱- زیربند", "x", "تبصره ۱", "x"].join("\n");
  const r = parseClauses(text);
  const note = r.clauses.find((c) => c.style === "note");
  assert.equal(note.parentClauseNo, "5-1");
});

/* ══════════════════ سند رویه‌ای واقعی ══════════════════ */

test("clause: کد گام رویه‌ای شناسایی می‌شود", () => {
  /* از سند واقعی کاربر (Scope of Work حفاری). پیش از افزودن این
   * الگو، موتور فقط ۲ سرفصل را می‌دید و هر ۲۶ گام اجرایی را دور
   * می‌ریخت — یعنی ۹۳٪ محتوای عملیاتی سند گم می‌شد. */
  const text = [
    "5.2.2.3\tContingency plan-3",
    "",
    "C.P3.1\tMake sure Dummy is installed in TRSV",
    "",
    "C.P3.2\tRun drift and gauge inside tubing",
  ].join("\n");
  const r = parseClauses(text);
  assert.equal(r.clauses.length, 3);
  const steps = r.clauses.filter((c) => c.style === "step_code");
  assert.equal(steps.length, 2);
});

test("clause: سه نگارش یک کد گام یکی می‌شوند", () => {
  /* سند واقعی همان گام را C.P3.9 و CP.3.9 و Cp.3.9 می‌نویسد. اگر
   * یکسان نشوند، درخت سه شاخهٔ تکراری می‌گیرد. */
  assert.equal(canonicalStepCode("C.P3.1"), "CP3.1");
  assert.equal(canonicalStepCode("CP.3.1"), "CP3.1");
  assert.equal(canonicalStepCode("Cp.3.1"), "CP3.1");
});

test("clause: پسوند حرفی گام حفظ می‌شود", () => {
  /* Cp.3.9.B یک زیرگام واقعی است، نه تکرار Cp.3.9. */
  assert.equal(canonicalStepCode("Cp.3.9.B"), "CP3.9.B");
  assert.notEqual(canonicalStepCode("Cp.3.9.B"), canonicalStepCode("Cp.3.9"));
});

test("clause: گام به سرفصل پیش از خود وصل می‌شود", () => {
  const text = [
    "5.2.2.3\tContingency plan-3",
    "C.P3.1\tStep one",
    "5.2.2.4\tContingency plan-4",
    "C.P4.1\tStep two",
  ].join("\n");
  const r = parseClauses(text);
  const s31 = r.clauses.find((c) => c.clauseNo === "CP3.1");
  const s41 = r.clauses.find((c) => c.clauseNo === "CP4.1");
  assert.equal(s31.parentClauseNo, "5.2.2.3");
  assert.equal(s41.parentClauseNo, "5.2.2.4");
});

test("clause: کد گام پیش از الگوی عددی برنده می‌شود", () => {
  /* اگر ترتیب برعکس بود، «3.1» از دل «C.P3.1» بیرون کشیده می‌شد و
   * حرف‌ها گم می‌شدند. */
  const r = parseClauses("C.P3.1\tSome step");
  assert.equal(r.clauses[0].style, "step_code");
  assert.equal(r.clauses[0].clauseNo, "CP3.1");
});

test("clause: شمارهٔ دورقمی گام با تک‌رقمی قاطی نمی‌شود", () => {
  const r = parseClauses(["C.P3.1\tone", "CP.3.10\tten", "CP.3.11\televen"].join("\n"));
  assert.deepEqual(r.clauses.map((c) => c.clauseNo), ["CP3.1", "CP3.10", "CP3.11"]);
});

test("clause: خط ادامه به گام پیشین می‌چسبد", () => {
  /* در سند واقعی، «Apply light set-down weight» خط دوم گام C.P4.8
   * است نه یک گام تازه. */
  const text = ["C.P4.8\tLower the tie-back assembly, Tag liner top or PBR,", "Apply light set-down weight"].join("\n");
  const r = parseClauses(text);
  assert.equal(r.clauses.length, 1);
  assert.ok(r.clauses[0].bodyText.includes("Apply light set-down weight"));
});

/* ══════════════════ ارجاع منشأ ══════════════════ */

test("clause: ارجاع منشأ صفحه و بند را می‌آورد", () => {
  assert.equal(sourceRefFa({ pageNo: 14, clauseNo: "5-2" }), "ص 14 / بند 5-2");
});

test("clause: صفحهٔ نامشخص صریح اعلام می‌شود", () => {
  /* صفر ادعاست؛ «نامشخص» اعتراف. */
  assert.ok(sourceRefFa({ pageNo: 0, clauseNo: "1" }).includes("نامشخص"));
});
