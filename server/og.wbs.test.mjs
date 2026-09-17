/**
 * آزمون ساختار نفت و گاز و واژگان ترجمهٔ تخصصی.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  OG_WBS_VERSION,
  OG_TEMPLATES,
  TEMPLATE_BY_ID,
  OG_GLOSSARY,
  translationInstructions,
  wbsInstructions,
  detectGlossaryTerms,
  detectLanguage,
  TEMPLATE_PROFILES,
  profileOf,
  seedFromTemplate,
  validateTemplate,
  offlineGlossaryTranslate,
} from "./ogwLogic.js";

test("ogw: نسخهٔ موتور اعلام شده است", () => {
  assert.equal(OG_WBS_VERSION, "ogw-v1");
});

/* ══════════════════ قالب‌ها ══════════════════ */

test("ogw: دو قالب صنعتی تعریف شده‌اند", () => {
  assert.equal(OG_TEMPLATES.length, 2);
  assert.ok(TEMPLATE_BY_ID.has("og-epc"));
  assert.ok(TEMPLATE_BY_ID.has("og-drilling"));
});

test("ogw: هر قالب عنوان دوزبانه دارد", () => {
  for (const t of OG_TEMPLATES) {
    assert.ok(t.title.fa && t.title.en, `${t.id} عنوان ناقص`);
    assert.ok(t.note.fa && t.note.en, `${t.id} توضیح ناقص`);
  }
});

test("ogw: جمع درصد هر شاخهٔ هر قالب دقیقاً ۱۰۰ است", () => {
  /* اگر قالب خودش ۱۰۰ نشود، کاربر از فرم نامعتبر شروع می‌کند و
   * نخستین چیزی که می‌بیند خطاست. */
  for (const t of OG_TEMPLATES) {
    const v = validateTemplate(t.id);
    assert.equal(v.ok, true, `${t.id}: ${v.issues.join(" | ")}`);
  }
});

test("ogw: قالب ناشناخته خطای صریح می‌دهد", () => {
  const v = validateTemplate("ghost");
  assert.equal(v.ok, false);
  assert.ok(v.issues[0].includes("ghost"));
});

test("ogw: قالب EPC چهار فاز ریشه دارد", () => {
  const roots = TEMPLATE_BY_ID.get("og-epc").nodes.filter((n) => !n.parentCode);
  assert.deepEqual(roots.map((r) => r.code), ["E", "P", "C", "CM"]);
});

test("ogw: ابنیه و مکانیک زیر اجرا هستند", () => {
  /* ساختاری که کارفرما صریح تأیید کرد. */
  const nodes = TEMPLATE_BY_ID.get("og-epc").nodes;
  const civil = nodes.find((n) => n.code === "C.1");
  const mech = nodes.find((n) => n.code === "C.2");
  assert.equal(civil.parentCode, "C");
  assert.equal(mech.parentCode, "C");
});

test("ogw: راه‌اندازی شاخهٔ ریشهٔ مستقل است", () => {
  /* کارفرما گفت «راه‌اندازی هم جداگانه». */
  const cm = TEMPLATE_BY_ID.get("og-epc").nodes.find((n) => n.code === "CM");
  assert.equal(cm.parentCode, null);
});

test("ogw: قالب حفاری شاخهٔ برنامهٔ اضطراری دارد", () => {
  /* در سند واقعی کاربر، Contingency plan بخشی از دامنهٔ کار بود نه
   * ریسک حاشیه‌ای. */
  const cp = TEMPLATE_BY_ID.get("og-drilling").nodes.find((n) => n.code === "CP");
  assert.ok(cp);
  assert.equal(cp.parentCode, null);
});

test("ogw: کد گره در هر قالب یکتا است", () => {
  for (const t of OG_TEMPLATES) {
    const codes = t.nodes.map((n) => n.code);
    assert.equal(new Set(codes).size, codes.length, `${t.id} کد تکراری دارد`);
  }
});

test("ogw: هر والدِ ارجاع‌شده در همان قالب وجود دارد", () => {
  for (const t of OG_TEMPLATES) {
    const codes = new Set(t.nodes.map((n) => n.code));
    for (const n of t.nodes) {
      if (n.parentCode) assert.ok(codes.has(n.parentCode), `${t.id}: والد ${n.parentCode} نیست`);
    }
  }
});

test("ogw: بذر قالب گره‌های قابل ویرایش می‌دهد", () => {
  const seed = seedFromTemplate("og-epc");
  assert.ok(seed.length > 10);
  for (const n of seed) assert.equal(n.basis, "typical");
});

test("ogw: بذر قالب ناشناخته آرایهٔ خالی است نه خطا", () => {
  assert.deepEqual(seedFromTemplate("ghost"), []);
});

/* ══════════════════ واژگان ══════════════════ */

test("ogw: واژه‌نامه اصطلاحات کلیدی نفت و گاز را دارد", () => {
  const terms = OG_GLOSSARY.map((g) => g.en);
  for (const t of ["tie-in", "hook-up", "workover", "wellhead", "as-built", "lump sum"]) {
    assert.ok(terms.includes(t), `${t} در واژه‌نامه نیست`);
  }
});

test("ogw: هیچ اصطلاحی دو معادل متفاوت ندارد", () => {
  /* دو معادل برای یک اصطلاح یعنی دو ساختار شکست متفاوت از یک متن. */
  const seen = new Map();
  for (const g of OG_GLOSSARY) {
    if (seen.has(g.en)) assert.equal(seen.get(g.en), g.fa, `${g.en} دو معادل دارد`);
    seen.set(g.en, g.fa);
  }
});

test("ogw: اصطلاح مبهم معادل انگلیسی را در پرانتز نگه می‌دارد", () => {
  /* «ماهیگیری» بدون Fishing برای مهندس بی‌معناست. */
  const fishing = OG_GLOSSARY.find((g) => g.en === "fishing");
  assert.ok(fishing.fa.includes("("));
});

test("ogw: شمارش اصطلاح در متن درست است", () => {
  const text = "Perform tie-in works. The tie-in point is ready. Hook-up follows.";
  const found = detectGlossaryTerms(text);
  const tie = found.find((f) => f.term === "tie-in");
  assert.equal(tie.count, 2);
  assert.ok(found.some((f) => f.term === "hook-up"));
});

test("ogw: تشخیص اصطلاح به بزرگی و کوچکی حرف حساس نیست", () => {
  const found = detectGlossaryTerms("WORKOVER operations and Wellhead check");
  assert.ok(found.some((f) => f.term === "workover"));
  assert.ok(found.some((f) => f.term === "wellhead"));
});

test("ogw: متن بدون اصطلاح فهرست خالی می‌دهد", () => {
  assert.deepEqual(detectGlossaryTerms("hello world"), []);
});

test("ogw: متن خالی موتور را نمی‌شکند", () => {
  assert.deepEqual(detectGlossaryTerms(null), []);
  assert.deepEqual(detectGlossaryTerms(undefined), []);
});

/* ══════════════════ تشخیص زبان ══════════════════ */

test("ogw: متن انگلیسی تشخیص داده می‌شود", () => {
  const r = detectLanguage("This agreement is made between the parties on this date.");
  assert.equal(r.lang, "en");
});

test("ogw: متن فارسی تشخیص داده می‌شود", () => {
  const r = detectLanguage("این قرارداد بین طرفین در تاریخ مذکور منعقد گردید.");
  assert.equal(r.lang, "fa");
});

test("ogw: متن دوزبانه mixed اعلام می‌شود نه یکی از دو", () => {
  /* اگر mixed را انگلیسی فرض کنیم، نیمی از سند بی‌جهت ترجمه می‌شود. */
  const r = detectLanguage("این بند شامل tie-in و hook-up و mechanical completion و commissioning است و ادامه دارد");
  assert.equal(r.lang, "mixed");
});

test("ogw: متن کوتاه unknown است نه حدس", () => {
  assert.equal(detectLanguage("ok").lang, "unknown");
  assert.equal(detectLanguage("").lang, "unknown");
});

/* ══════════════════ دستورهای مدل ══════════════════ */

test("ogw: دستور ترجمه عدد و کد را قفل می‌کند", () => {
  /* یک رقم جابه‌جا یعنی مبلغ غلط در صورت‌وضعیت. */
  const ins = translationInstructions("fa");
  assert.ok(/never change numbers/i.test(ins));
  assert.ok(/clause numbers/i.test(ins));
});

test("ogw: دستور ترجمه خلاصه‌سازی را ممنوع می‌کند", () => {
  /* خلاصه کردن بند قرارداد یعنی حذف تعهد. */
  assert.ok(/never summarise/i.test(translationInstructions("fa")));
});

test("ogw: واژه‌نامه داخل دستور ترجمه می‌رود", () => {
  const ins = translationInstructions("fa");
  assert.ok(ins.includes("tie-in"));
  assert.ok(ins.includes("اتصال به خط موجود"));
});

test("ogw: جهت ترجمه در دستور منعکس می‌شود", () => {
  assert.notEqual(translationInstructions("fa"), translationInstructions("en"));
});

test("ogw: دستور WBS ساختن عدد را ممنوع می‌کند", () => {
  /* خروجی مستقیم وارد محاسبهٔ هزینه می‌شود. */
  const ins = wbsInstructions(null);
  assert.ok(/never invent a quantity, rate or amount/i.test(ins));
  assert.ok(/null/.test(ins));
});

test("ogw: دستور WBS ارجاع به بند را اجباری می‌کند", () => {
  assert.ok(/sourceRef/i.test(wbsInstructions(null)));
});

test("ogw: اسکلت قالب داخل دستور WBS می‌رود", () => {
  const withTpl = wbsInstructions("og-epc");
  assert.ok(withTpl.includes("Engineering"));
  assert.ok(withTpl.includes("Commissioning"));
  const without = wbsInstructions(null);
  assert.ok(!without.includes("Commissioning"));
});

test("ogw: قالب ناشناخته دستور را نمی‌شکند", () => {
  const ins = wbsInstructions("ghost");
  assert.ok(ins.length > 0);
  assert.ok(/Derive the structure/i.test(ins));
});

/* ══════════════════ ترجمهٔ آفلاین ══════════════════ */

test("ogw: ترجمهٔ آفلاین اصطلاحات تخصصی را جایگزین می‌کند", () => {
  /* بدون این، نبودِ اینترنت یعنی دکمه‌های «ترجمه» و «دوستونی» برای
   * همیشه خاموش می‌مانند. */
  const r = offlineGlossaryTranslate("Perform tie-in and hook-up works.");
  assert.ok(r.text.includes("اتصال به خط موجود"));
  assert.ok(r.text.includes("اتصال نهایی"));
  assert.equal(r.replaced, 2);
});

test("ogw: اصطلاح بلندتر بر کوتاه‌تر مقدم است", () => {
  /* اگر ترتیب برعکس باشد، «tie» داخل «tie-in» جایگزین می‌شود و
   * اصطلاح بلند هرگز تطبیق نمی‌یابد. */
  const r = offlineGlossaryTranslate("tie-in point");
  assert.ok(r.text.includes("اتصال به خط موجود"));
});

test("ogw: مرز واژه رعایت می‌شود", () => {
  /* «cut» داخل «circuit» نباید تطبیق یابد. */
  const r = offlineGlossaryTranslate("The circuit is ready.");
  assert.equal(r.text, "The circuit is ready.");
  assert.equal(r.replaced, 0);
});

test("ogw: نرخ پوشش گزارش می‌شود", () => {
  /* تا رابط کاربری بتواند صریح بگوید این ترجمهٔ کامل نیست. */
  const r = offlineGlossaryTranslate("Perform workover on the wellhead now.");
  assert.ok(r.coveragePct > 0);
  assert.ok(r.coveragePct <= 100);
});

test("ogw: متن بدون اصطلاح دست‌نخورده می‌ماند", () => {
  const r = offlineGlossaryTranslate("Hello world.");
  assert.equal(r.text, "Hello world.");
  assert.equal(r.replaced, 0);
});

test("ogw: متن خالی موتور را نمی‌شکند", () => {
  assert.equal(offlineGlossaryTranslate("").text, "");
  assert.equal(offlineGlossaryTranslate(null).replaced, 0);
});

test("ogw: بزرگی و کوچکی حرف مانع تطبیق نیست", () => {
  const r = offlineGlossaryTranslate("WORKOVER and Wellhead");
  assert.equal(r.replaced, 2);
});

/* ══════════════════ قالب سازمانی ══════════════════ */

test("ogw: دو نوع قالب خروجی هست", () => {
  assert.equal(TEMPLATE_PROFILES.length, 2);
  assert.ok(TEMPLATE_PROFILES.some((p) => p.kind === "internal"));
  assert.ok(TEMPLATE_PROFILES.some((p) => p.kind === "client"));
});

test("ogw: قالب ابلاغی کارفرما ستون قفل دارد", () => {
  /* تغییر ستون یعنی رد شدن فایل و هدر رفتن یک چرخهٔ بازبینی. */
  assert.equal(profileOf("client").editableColumns, false);
  assert.equal(profileOf("internal").editableColumns, true);
});

test("ogw: نوع ناشناخته به قالب داخلی می‌افتد نه خطا", () => {
  assert.equal(profileOf("ghost").kind, "internal");
});
