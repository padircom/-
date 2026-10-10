/**
 * آزمون پنج موتور هوش مصنوعی CMMS.
 *
 * این موتور‌ها عمداً قطعی (deterministic)‌اند: خروجی‌شان را می‌توان در
 * ممیزی بازتولید کرد. بنابراین هر آزمون علاوه بر درستی نتیجه، «یکسان‌بودن
 * دو فراخوانی» را هم قفل می‌کند — اگر روزی یک مدل یادگیری جای این توابع
 * بنشیند، این آزمون‌ها باید آگاهانه تغییر کنند نه بی‌صدا بشکنند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CMMS_AI_VERSION,
  normalizeText,
  extractKeywords,
  analyzeFailure,
  estimateWeibullFromTtf,
  optimizePmWithAi,
  median,
  recommendRepair,
  generateEquipmentTree,
  scheduleWorkOrders,
} from "./cmmsAiLogic.js";

const FAILURE_HISTORY = [
  { id: "f1", assetId: "P-101", failureMode: "leakage", failureMechanism: "wear", symptoms: ["نشتی روغن از مکانیکال سیل"], rootCauseFa: "فرسودگی مکانیکال سیل", resolved: true },
  { id: "f2", assetId: "P-101", failureMode: "leakage", failureMechanism: "wear", symptoms: ["نشتی روغن از سیل"], rootCauseFa: "فرسودگی مکانیکال سیل", resolved: true },
  { id: "f3", assetId: "P-202", failureMode: "fail-to-start", failureMechanism: "electrical", symptoms: ["موتور استارت نمی‌زند"], rootCauseFa: "خرابی کنتاکتور", resolved: true },
  { id: "f4", assetId: "P-101", failureMode: "leakage", failureMechanism: "wear", symptoms: ["نشتی روغن"], rootCauseFa: "شل‌بودن پیچ", resolved: false },
];

const REPAIR_HISTORY = [
  { workOrderId: "w1", assetId: "P-101", failureMode: "leakage", failureMechanism: "wear", fixDescriptionFa: "تعویض مکانیکال سیل", parts: [{ partNumber: "SEAL-01", quantity: 1 }], laborHours: 6, cost: 900, resolved: true },
  { workOrderId: "w2", assetId: "P-101", failureMode: "leakage", failureMechanism: "wear", fixDescriptionFa: "تعویض مکانیکال سیل", parts: [{ partNumber: "SEAL-01", quantity: 2 }], laborHours: 4, cost: 700, resolved: true },
  { workOrderId: "w3", assetId: "P-202", failureMode: "fail-to-start", fixDescriptionFa: "تعویض کنتاکتور", parts: [{ partNumber: "CONT-9", quantity: 1 }], laborHours: 2, cost: 300, resolved: true },
  { workOrderId: "w4", assetId: "P-101", failureMode: "leakage", failureMechanism: "wear", fixDescriptionFa: "سفت‌کردن پیچ", parts: [], laborHours: 1, cost: 50, resolved: false },
];

/* ═══════════════════════ ابزارهای متن ═══════════════════════ */

test("نرمال‌سازی متن: فاصلهٔ عربی/فارسی و نیم‌فاصله یکی می‌شوند", () => {
  assert.equal(CMMS_AI_VERSION, "cmms-ai-v1");
  assert.equal(normalizeText("  نشتی   روغن  "), "نشتی روغن");
  /* «ي» عربی باید به «ی» فارسی تبدیل شود تا هم‌معنی‌ها جدا نیفتند. */
  assert.equal(normalizeText("مكانيكال"), normalizeText("مکانیکال"));
  assert.equal(normalizeText(null), "");
  assert.equal(normalizeText(undefined), "");
});

test("کلیدواژه: واژه‌های ایست فارسی حذف می‌شوند", () => {
  const keywords = extractKeywords("نشتی روغن از مکانیکال سیل پمپ");
  assert.ok(keywords.includes("نشتی"));
  assert.ok(!keywords.includes("از"), "حرف اضافه باید حذف شود");
  assert.deepEqual(extractKeywords(""), []);
  assert.deepEqual(extractKeywords("   "), []);
});

/* ═══════════════════════ ۱. AI Failure Analysis ═══════════════════════ */

test("تحلیل خرابی: ریشهٔ پرتکرارِ همان تجهیز بالاترین اطمینان را می‌گیرد", () => {
  const result = analyzeFailure({
    assetId: "P-101", symptoms: ["نشتی روغن از مکانیکال سیل"], history: FAILURE_HISTORY, topN: 3,
  });
  assert.equal(result.historySize, 4);
  assert.equal(result.suggestions.length, 3);
  assert.equal(result.suggestions[0].titleFa, "فرسودگی مکانیکال سیل (leakage/wear)");
  assert.equal(result.suggestions[0].confidence, 0.785);
  /* رتبه‌بندی باید نزولی باشد. */
  for (let index = 1; index < result.suggestions.length; index += 1) {
    assert.ok(result.suggestions[index - 1].confidence >= result.suggestions[index].confidence);
  }
  /* هر پیشنهاد باید مدرک داشته باشد — پیشنهاد بی‌مدرک قابل پذیرش نیست. */
  for (const suggestion of result.suggestions) {
    assert.ok(suggestion.confidence > 0 && suggestion.confidence <= 1, `اطمینان ${suggestion.confidence} خارج از بازه است`);
    assert.ok(Array.isArray(suggestion.evidence) && suggestion.evidence.length > 0, `${suggestion.titleFa} مدرک ندارد`);
  }
});

test("تحلیل خرابی: قطعی است و دو فراخوانی یک خروجی می‌دهند", () => {
  const input = { assetId: "P-101", symptoms: ["نشتی روغن از مکانیکال سیل"], history: FAILURE_HISTORY, topN: 3 };
  assert.equal(JSON.stringify(analyzeFailure(input).suggestions), JSON.stringify(analyzeFailure(input).suggestions));
});

test("تحلیل خرابی: تاریخچهٔ خالی پیشنهاد نمی‌سازد و صریح هشدار می‌دهد", () => {
  const result = analyzeFailure({ assetId: "P-101", symptoms: ["نشتی روغن"], history: [] });
  assert.equal(result.suggestions.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("تاریخچه")));
});

test("تحلیل خرابی: بدون علامت هم بر پایهٔ فراوانی رتبه‌بندی می‌کند ولی هشدار می‌دهد", () => {
  const result = analyzeFailure({ history: FAILURE_HISTORY, symptoms: [] });
  assert.equal(result.suggestions.length, 3);
  assert.ok(result.warnings.some((warning) => warning.includes("علامتی داده نشد")));
});

test("تحلیل خرابی: سابقهٔ تجهیز دیگر با boost کمتر وزن می‌گیرد", () => {
  const sameAsset = analyzeFailure({ assetId: "P-101", symptoms: ["نشتی روغن"], history: FAILURE_HISTORY, sameAssetBoost: 1.5 });
  const noBoost = analyzeFailure({ assetId: "P-101", symptoms: ["نشتی روغن"], history: FAILURE_HISTORY, sameAssetBoost: 1 });
  assert.ok(
    sameAsset.suggestions[0].confidence > noBoost.suggestions[0].confidence,
    "boost هم‌تجهیز باید اطمینان را بالا ببرد",
  );
});

/* ═══════════════════════ ۲. AI PM Optimization ═══════════════════════ */

test("وایبول: رگرسیون میان‌رتبه با دادهٔ فرسایشی β>۱ می‌دهد", () => {
  const result = estimateWeibullFromTtf([100, 110, 120, 130, 140, 150, 160]);
  assert.equal(result.method, "median-rank-regression");
  assert.equal(result.sampleSize, 7);
  assert.equal(result.beta, 6.3334);
  assert.equal(result.eta, 139.1661);
  assert.equal(result.rSquared, 0.9851);
  assert.equal(result.warnings.length, 0);
});

test("وایبول: دادهٔ با فاصلهٔ فزاینده β<۱ می‌دهد (بدون فرسایش)", () => {
  const result = estimateWeibullFromTtf([100, 200, 400, 800, 1600]);
  assert.ok(result.beta < 1, `β=${result.beta} باید زیر ۱ باشد`);
  assert.equal(result.rSquared, 0.9799);
});

test("وایبول: زیر ۳ نمونه برآورد نمی‌کند و عدد جعلی نمی‌سازد", () => {
  const two = estimateWeibullFromTtf([100, 200]);
  assert.equal(two.method, "fallback");
  assert.ok(two.warnings.length > 0);
  const empty = estimateWeibullFromTtf([]);
  assert.equal(empty.method, "fallback");
  assert.equal(empty.sampleSize, 0);
  assert.equal(empty.rSquared, 0);
  /* برآورد ناموفق باید مقادیر بی‌اثر بدهد نه عدد تصادفی. */
  assert.equal(empty.beta, 1);
});

test("وایبول: دادهٔ نامعتبر بی‌صدا حذف نمی‌شود بلکه گزارش می‌شود", () => {
  /* در محاسبهٔ قابلیت اطمینان، نمونهٔ گم‌شده یعنی β و η بر پایهٔ جمعیتی
   * متفاوت از آنچه کاربر می‌پندارد برآورد شده‌اند. پس حذف باید گفته شود. */
  const result = estimateWeibullFromTtf([100, -5, 200]);
  assert.equal(result.sampleSize, 2);
  assert.ok(result.warnings.some((warning) => warning.includes("کنار گذاشته شد")), "حذف داده باید گزارش شود");
  assert.ok(result.warnings.some((warning) => warning.includes("۱ داده") || warning.includes("1 داده")));
  const zeros = estimateWeibullFromTtf([100, 0, 200, 300, 400]);
  assert.equal(zeros.sampleSize, 4);
  assert.ok(zeros.warnings.some((warning) => warning.includes("کنار گذاشته شد")));
});

test("PM هوشمند: فاصلهٔ بهینه از برآورد وایبول به‌دست می‌آید", () => {
  const result = optimizePmWithAi({
    ttfHours: [100, 110, 120, 130, 140, 150, 160],
    preventiveCost: 1000, failureCost: 20000, meanRepairHours: 20, currentInterval: 90,
  });
  assert.equal(result.optimization.wearOutDetected, true);
  assert.equal(result.optimization.recommendedInterval, 69.2119);
  assert.equal(result.optimization.savingPct, 86.774);
  /* وایبول استفاده‌شده باید همان برآورد باشد و منبعش ثبت شود. */
  assert.equal(result.weibull.beta, 6.3334);
  assert.equal(result.weibull.method, "median-rank-regression");
  assert.ok(result.suggestion.titleFa.length > 0);
  assert.ok(result.suggestion.explanationFa.length > 0);
});

test("PM هوشمند: وایبول دستی جای برآورد را می‌گیرد و علامت‌گذاری می‌شود", () => {
  const result = optimizePmWithAi({
    weibull: { beta: 2, eta: 1000 },
    preventiveCost: 1000, failureCost: 20000, meanRepairHours: 20,
  });
  assert.equal(result.weibull.beta, 2);
  assert.equal(result.weibull.eta, 1000);
  assert.equal(result.weibull.method, "manual");
  assert.ok(result.warnings.some((warning) => warning.includes("دستی")));
  assert.equal(result.optimization.wearOutDetected, true);
});

test("PM هوشمند: بدون داده، استثنا نمی‌دهد بلکه «توصیه‌ای نیست» برمی‌گرداند", () => {
  /* نبودِ داده یک خطای فراخوان نیست، یک وضعیت است. اندپوینت AI باید با
   * تاریخچهٔ خالی هم پاسخ معتبر بدهد و بگوید چرا عددی پیشنهاد نشده. */
  const result = optimizePmWithAi({ preventiveCost: 1000, failureCost: 20000, meanRepairHours: 20 });
  assert.equal(result.suggestion.confidence, 0);
  assert.equal(result.suggestion.suggestedValue.recommendedInterval, null);
  assert.ok(result.suggestion.titleFa.includes("پیشنهاد نمی‌شود"));
  /* وایبولِ fallback هم برمی‌گردد تا پروندهٔ CmmsAiRun بگوید برآورد نشد. */
  assert.equal(result.weibull.method, "fallback");
  assert.ok(result.warnings.length >= 2);
  assert.ok(result.warnings.some((warning) => warning.includes("پیشنهاد نمی‌شود")));
});

test("PM هوشمند: وایبول دستی نامعتبر خطای فراخوان است و استثنا می‌دهد", () => {
  /* تفاوت با آزمون پیشین مهم است: نبودِ داده → افت تدریجی، ولی دادنِ
   * پارامتر غلط → استثنا. یکی وضعیت است و دیگری اشتباه فراخوان. */
  assert.throws(() => optimizePmWithAi({
    weibull: { beta: 2, eta: 0 }, preventiveCost: 1000, failureCost: 20000, meanRepairHours: 20,
  }), RangeError);
  assert.throws(() => optimizePmWithAi({
    weibull: { beta: -1, eta: 1000 }, preventiveCost: 1000, failureCost: 20000, meanRepairHours: 20,
  }), RangeError);
});

/* ═══════════════════════ ۳. AI Repair Guidance ═══════════════════════ */

test("راهنمای تعمیر: اقدام موفقِ پرتکرار اول می‌شود و آمارش میانه است", () => {
  const result = recommendRepair({
    assetId: "P-101", failureMode: "leakage", failureMechanism: "wear", history: REPAIR_HISTORY, topN: 3,
  });
  assert.equal(result.matchedRecords, 3);
  assert.equal(result.suggestions[0].titleFa, "تعویض مکانیکال سیل");
  assert.equal(result.suggestions[0].confidence, 0.8163);
  assert.equal(result.suggestions[0].suggestedValue.historicalCount, 2);
  assert.equal(result.suggestions[0].suggestedValue.successRate, 1);
  /* میانگین ۶ و ۴ می‌شود ۵، ولی میانه هم ۵ است؛ آزمون میانه با دادهٔ پرت
   * متمایز می‌شود: ۱ و ۴ و ۱۰۰ → میانه ۴ نه میانگین ۳۵. */
  assert.equal(result.suggestions[0].suggestedValue.medianLaborHours, 5);
  assert.equal(result.suggestions[0].suggestedValue.medianCost, 800);
  assert.equal(median([1, 4, 100]), 4);
  assert.equal(median([]), null);
});

test("راهنمای تعمیر: قطعه از همهٔ تعمیرهای مرتبط جمع می‌شود نه فقط اولی", () => {
  const result = recommendRepair({ assetId: "P-101", failureMode: "leakage", history: REPAIR_HISTORY });
  assert.equal(result.spareSuggestions.length, 1);
  assert.ok(result.spareSuggestions[0].titleFa.includes("SEAL-01"));
  /* SEAL-01 در دو تعمیر با مقدار ۱ و ۲ آمده → جمع ۳. */
  const spare = result.spareSuggestions[0].suggestedValue;
  assert.equal(spare.partNumber, "SEAL-01");
  assert.equal(spare.totalHistoricalQuantity, 3);
  /* فراوانی = ۲ تعمیر از ۳ سابقهٔ مرتبط */
  assert.equal(spare.historicalFrequency, 0.6667);
  /* مقدار پیشنهادی میانهٔ مصرف هر تعمیر است: ۱ و ۲ → میانه ۱٫۵ → گرد به بالا ۲ */
  assert.equal(spare.suggestedQuantity, 2);
  /* CONT-9 مربوط به حالت خرابی دیگری است و نباید اینجا بیاید. */
  assert.ok(!result.spareSuggestions.some((item) => item.titleFa.includes("CONT-9")));
});

test("راهنمای تعمیر: حالت خرابی بدون سابقه، پیشنهاد نمی‌سازد", () => {
  const result = recommendRepair({ failureMode: "corrosion", history: REPAIR_HISTORY });
  assert.equal(result.suggestions.length, 0);
  assert.ok(result.warnings.length > 0);
  assert.throws(() => recommendRepair({ failureMode: "", history: REPAIR_HISTORY }), RangeError);
});

test("راهنمای تعمیر: اقدام ناموفق امتیاز کمتری از اقدام موفق می‌گیرد", () => {
  const result = recommendRepair({ assetId: "P-101", failureMode: "leakage", history: REPAIR_HISTORY, topN: 5 });
  const successful = result.suggestions.find((item) => item.titleFa.includes("مکانیکال سیل"));
  const unsuccessful = result.suggestions.find((item) => item.titleFa.includes("سفت"));
  assert.ok(successful && unsuccessful, "هر دو اقدام باید در فهرست باشند");
  assert.ok(successful.confidence > unsuccessful.confidence);
});

/* ═══════════════════════ ۴. AI Tree Generator ═══════════════════════ */

test("درخت هوشمند: شماره‌گذاری سلسله‌مراتبی با اطمینان بالا تشخیص داده می‌شود", () => {
  const result = generateEquipmentTree({
    equipmentCode: "P-101",
    equipmentNameFa: "پمپ سانتریفیوژ",
    catalogText: [
      "1 پمپ سانتریفیوژ P-101",
      "1.1 الکتروموتور",
      "1.2 محفظه پمپ",
      "1.2.1 پروانه",
      "1.2.2 مکانیکال سیل",
    ].join("\n"),
  });
  /* ریشه + چهار جزء؛ خط خودِ تجهیز ادغام می‌شود و گرهٔ تکراری نمی‌سازد. */
  assert.equal(result.nodes.length, 5);
  assert.equal(result.mergedRootLines, 1);
  assert.equal(result.siblingEquipmentLines, 0);
  assert.equal(result.nodes[0].nodeCode, "P-101");
  assert.equal(result.nodes[0].parentNodeCode, null);
  assert.equal(result.nodes[0].boundaryLevel, "equipment");

  const motor = result.nodes.find((node) => node.nameFa.includes("الکتروموتور"));
  assert.equal(motor.parentNodeCode, "P-101");
  assert.equal(motor.pathLevel, 2);
  assert.equal(motor.detectedBy, "numbering");
  assert.equal(motor.confidence, 0.9);

  const impeller = result.nodes.find((node) => node.nameFa.includes("پروانه"));
  assert.equal(impeller.pathLevel, 3);
  assert.equal(impeller.parentNodeCode, result.nodes.find((node) => node.nameFa.includes("محفظه")).nodeCode);

  /* کد گره‌ها باید یکتا و کوتاه بمانند تا در ستون NodeCode جا شوند. */
  const codes = result.nodes.map((node) => node.nodeCode);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.ok(code.length <= 60, `کد ${code} بلندتر از ۶۰ نویسه است`);
});

test("درخت هوشمند: خط هم‌سطحِ تجهیز، تجهیز دیگر است و بی‌صدا تو در تو نمی‌شود", () => {
  const result = generateEquipmentTree({
    equipmentCode: "P-101",
    catalogText: ["1 پمپ سانتریفیوژ P-101", "1.1 الکتروموتور", "2 کمپرسور C-201"].join("\n"),
  });
  assert.equal(result.siblingEquipmentLines, 1);
  assert.ok(!result.nodes.some((node) => node.nameFa.includes("کمپرسور")), "تجهیز هم‌سطح نباید وارد درخت شود");
  assert.ok(result.warnings.some((warning) => warning.includes("هم‌سطح")));
});

test("درخت هوشمند: تورفتگی با اطمینان کم‌تر از شماره‌گذاری تشخیص داده می‌شود", () => {
  const result = generateEquipmentTree({
    equipmentCode: "C-201",
    catalogText: ["الکتروموتور", "  بلبرینگ جلو", "  بلبرینگ عقب"].join("\n"),
  });
  const parent = result.nodes.find((node) => node.nameFa.includes("الکتروموتور"));
  const bearing = result.nodes.find((node) => node.nameFa.includes("بلبرینگ جلو"));
  assert.equal(bearing.parentNodeCode, parent.nodeCode);
  assert.equal(parent.detectedBy, "indentation");
  assert.equal(parent.confidence, 0.45);
  assert.equal(bearing.confidence, 0.7);
  /* گرهٔ کم‌اطمینان باید برای بازبینی انسان علامت بخورد. */
  assert.ok(result.warnings.some((warning) => warning.includes("بازبینی")));
});

test("درخت هوشمند: کد تجهیز الزامی است", () => {
  assert.throws(() => generateEquipmentTree({ equipmentCode: "", catalogText: "چیزی" }), RangeError);
});

/* ═══════════════════════ ۵. AI Smart Scheduler ═══════════════════════ */

const CALENDAR = Array.from({ length: 5 }, (_, index) => ({
  date: `2026-10-0${index + 1}`, working: true, isProductionBreak: index === 2,
}));

const TECHNICIANS = [
  { id: "t1", nameFa: "تکنسین مکانیک", skills: [{ key: "mechanical", level: 4 }], dailyCapacityHours: 8 },
  { id: "t2", nameFa: "تکنسین برق", skills: [{ key: "electrical", level: 3 }], dailyCapacityHours: 8 },
];

const WORK_ORDERS = [
  { id: "wo1", estimatedHours: 8, requiredSkill: "mechanical", criticalityRank: "A", isAssetDown: true, productionImpact: "plant-stop", dueDate: "2026-10-05", safetyConcern: true },
  { id: "wo2", estimatedHours: 4, requiredSkill: "mechanical", criticalityRank: "D", isAssetDown: false, productionImpact: "none", dueDate: "2026-10-05" },
  { id: "wo3", estimatedHours: 40, requiredSkill: "electrical", criticalityRank: "B", isAssetDown: false, productionImpact: "partial", dueDate: "2026-10-05" },
];

test("زمان‌بند: دستورکار بحرانی در روز توقف تولید قرار می‌گیرد", () => {
  const result = scheduleWorkOrders({ workOrders: WORK_ORDERS, technicians: TECHNICIANS, calendar: CALENDAR });
  assert.equal(result.summary.totalOrders, 3);
  assert.equal(result.summary.productionBreakOrders, 1);
  const critical = result.assignments.find((item) => item.workOrderId === "wo1");
  assert.equal(critical.date, "2026-10-03", "روز توقف تولید باید به کار بحرانی برسد");
  assert.equal(critical.technicianId, "t1");
});

test("زمان‌بند: کار بیش از سقف یک روز بی‌صدا رها نمی‌شود بلکه دلیل می‌گیرد", () => {
  const result = scheduleWorkOrders({ workOrders: WORK_ORDERS, technicians: TECHNICIANS, calendar: CALENDAR });
  assert.equal(result.assignments.length, 2);
  assert.equal(result.unassigned.length, 1);
  assert.equal(result.unassigned[0].workOrderId, "wo3");
  assert.ok(result.unassigned[0].reasonFa.includes("۲۴") || result.unassigned[0].reasonFa.includes("24"));
});

test("زمان‌بند: مجموع ساعات هر تکنسین از ظرفیتش بیشتر نمی‌شود", () => {
  const heavy = Array.from({ length: 10 }, (_, index) => ({
    id: `wo${index}`, estimatedHours: 8, requiredSkill: "mechanical",
    criticalityRank: "B", isAssetDown: false, productionImpact: "partial", dueDate: "2026-10-05",
  }));
  const result = scheduleWorkOrders({ workOrders: heavy, technicians: [TECHNICIANS[0]], calendar: CALENDAR });
  const perDay = new Map();
  for (const assignment of result.assignments) {
    perDay.set(assignment.date, (perDay.get(assignment.date) ?? 0) + assignment.hours);
  }
  for (const [date, hours] of perDay) {
    assert.ok(hours <= 8, `در ${date} مجموع ${hours} ساعت از ظرفیت ۸ بیشتر است`);
  }
  /* بقیه باید با دلیل در unassigned باشند، نه گم‌شده. */
  assert.equal(result.assignments.length + result.unassigned.length, heavy.length);
});

test("زمان‌بند: مهارت نامناسب یعنی انتساب نادرست، نه انتساب تصادفی", () => {
  const result = scheduleWorkOrders({ workOrders: WORK_ORDERS, technicians: [TECHNICIANS[1]], calendar: CALENDAR });
  assert.ok(!result.assignments.some((item) => item.workOrderId === "wo1"), "کار مکانیک نباید به تکنسین برق برسد");
  assert.ok(result.unassigned.some((item) => item.workOrderId === "wo1"));
  assert.ok(result.unassigned.find((item) => item.workOrderId === "wo1").reasonFa.includes("مهارت"));
});

test("زمان‌بند: بهره‌وری و خلاصه با انتساب‌ها سازگار است", () => {
  const result = scheduleWorkOrders({ workOrders: WORK_ORDERS, technicians: TECHNICIANS, calendar: CALENDAR });
  assert.equal(result.summary.assignedHours, 12);
  assert.equal(result.summary.totalCapacityHours, 80);
  assert.equal(result.summary.overallUtilizationPct, 15);
  const t1 = result.utilization.find((item) => item.technicianId === "t1");
  assert.equal(t1.assignedHours, 12);
  assert.equal(t1.utilizationPct, 30);
});

test("زمان‌بند: تقویم یا تکنسین خالی، هشدار می‌دهد و استثنا نمی‌دهد", () => {
  const noTech = scheduleWorkOrders({ workOrders: WORK_ORDERS, technicians: [], calendar: CALENDAR });
  assert.equal(noTech.assignments.length, 0);
  assert.ok(noTech.warnings.some((warning) => warning.includes("تکنسین")));
  const noCalendar = scheduleWorkOrders({ workOrders: WORK_ORDERS, technicians: TECHNICIANS, calendar: [] });
  assert.equal(noCalendar.assignments.length, 0);
  assert.ok(noCalendar.warnings.some((warning) => warning.includes("تقویم")));
});

test("زمان‌بند: روز غیرکاری انتساب نمی‌گیرد", () => {
  const calendar = [{ date: "2026-10-01", working: false, isProductionBreak: false }];
  const result = scheduleWorkOrders({ workOrders: [WORK_ORDERS[1]], technicians: TECHNICIANS, calendar });
  assert.equal(result.assignments.length, 0);
  assert.equal(result.unassigned.length, 1);
});

test("زمان‌بند: قطعی است", () => {
  const input = { workOrders: WORK_ORDERS, technicians: TECHNICIANS, calendar: CALENDAR };
  assert.equal(JSON.stringify(scheduleWorkOrders(input)), JSON.stringify(scheduleWorkOrders(input)));
});
