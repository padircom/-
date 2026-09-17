import test from "node:test";
import assert from "node:assert/strict";
import { SCHEMA, MIGRATIONS } from "./sqlLogic.js";
import {
  CONTROL_LEVELS, CONTROL_LEVEL_FA, CONTROL_RANK,
  HAZARD_CATEGORIES, HAZARD_CATEGORY_FA, JSA_STATUS_FA,
  RISK_BANDS, PPE_ONLY_RISK_THRESHOLD, MAX_APPROVABLE_RESIDUAL,
  riskBand, riskScore,
  validateJsaInput, validateHazardInput, validateControlInput,
  evaluateHazard, jsaSummary, canApproveJsa, jsaState, jsaSupportsPermit,
} from "./hseLogic.js";

const NOW = new Date("2026-09-09T12:00:00Z");

function jsa(over = {}) {
  return {
    Id: "j1", ProjectId: "p", JsaNo: "JSA-001", TitleFa: "تعویض شیر خط بخار",
    PreparedBy: "u-site", PreparedAt: "2026-09-01", Status: "draft", ...over,
  };
}
function step(over = {}) {
  return { Id: "s1", ProjectId: "p", JsaId: "j1", StepNo: 1, DescriptionFa: "بستن شیر", ...over };
}
function hazard(over = {}) {
  return {
    Id: "h1", ProjectId: "p", JsaId: "j1", StepId: "s1", HazardNo: 1,
    HazardFa: "سوختگی با بخار", HazardCategory: "fire",
    Likelihood: 3, Severity: 4, ...over,
  };
}
function control(over = {}) {
  return {
    Id: "c1", ProjectId: "p", JsaId: "j1", HazardId: "h1", ControlNo: 1,
    ControlLevel: "engineering", ControlFa: "ایزولاسیون خط", ...over,
  };
}

/* ══════════════ اسکیما ══════════════ */

test("چهار جدول JSA در اسکیما هستند", () => {
  for (const n of ["HSE_RiskAssessment", "JSA_JobStep", "JSA_Hazard", "JSA_Control"]) {
    const t = SCHEMA.find((x) => x.name === n);
    assert.ok(t, `جدول ${n} نیست`);
    assert.equal(t.module, "d16");
  }
});

test("مهاجرت 0016 افزوده شده و قبلی‌ها دست‌نخورده‌اند", () => {
  const v = MIGRATIONS.map((m) => m.version);
  assert.ok(v.includes("0014"), "مهاجرت بستهٔ آزمون نباید حذف شود");
  assert.ok(v.includes("0015"), "مهاجرت ایمنی پایه نباید حذف شود");
  assert.ok(v.includes("0016"));
  assert.ok(v.includes("0017"), "مهاجرت پروانهٔ کار نباید حذف شود");
  assert.ok(v.includes("0018"), "مهاجرت حادثه و اقدام اصلاحی نباید حذف شود");
  assert.ok(v.includes("0019"), "مهاجرت تخلف و توقف کار نباید حذف شود");
  /* «آخرین مهاجرت» ادعای شکننده‌ای است: هر ماژول بعدی آن را
   * می‌شکند بی‌آنکه چیزی دربارهٔ این ماژول بگوید. چیزی که باید
   * ثابت بماند نبودن شکاف و ترتیب صعودی است. */
  assert.deepEqual([...v].sort(), v, "ترتیب مهاجرت‌ها باید صعودی بماند");
  assert.equal(new Set(v).size, v.length, "شمارهٔ مهاجرت تکراری");
});

test("مهاجرت 0016 فقط جدول می‌سازد", () => {
  const m = MIGRATIONS.find((x) => x.version === "0016");
  assert.equal(m.statements.filter((s) => /ALTER TABLE/i.test(s)).length, 0);
  assert.equal(m.statements.filter((s) => /DROP/i.test(s)).length, 0);
});

test("ریسک باقیمانده در اسکیما مشتق علامت خورده", () => {
  const t = SCHEMA.find((x) => x.name === "JSA_Hazard");
  const col = t.columns.find((c) => c.name === "ResidualRisk");
  assert.match(col.comment ?? "", /مشتق/);
});

/* ══════════════ ثابت‌ها ══════════════ */

test("پنج سطح کنترل به ترتیب اثربخشی رتبه دارند", () => {
  assert.equal(CONTROL_LEVELS.length, 5);
  assert.equal(CONTROL_RANK.elimination, 1, "حذف باید مؤثرترین باشد");
  assert.equal(CONTROL_RANK.ppe, 5, "حفاظت فردی باید کم‌اثرترین باشد");
  for (let i = 1; i < CONTROL_LEVELS.length; i++) {
    assert.ok(
      CONTROL_RANK[CONTROL_LEVELS[i]] > CONTROL_RANK[CONTROL_LEVELS[i - 1]],
      "ترتیب سلسله‌مراتب باید صعودی باشد",
    );
  }
});

test("هر سطح کنترل و دستهٔ خطر برچسب فارسی دارد", () => {
  for (const l of CONTROL_LEVELS) assert.ok(CONTROL_LEVEL_FA[l], `برچسب ${l} نیست`);
  for (const h of HAZARD_CATEGORIES) assert.ok(HAZARD_CATEGORY_FA[h], `برچسب ${h} نیست`);
});

test("باندهای ریسک کل بازهٔ ۱ تا ۲۵ را می‌پوشانند", () => {
  assert.equal(RISK_BANDS.at(-1).max, 25, "بیشینهٔ ۵×۵ باید پوشش داشته باشد");
  for (let i = 1; i < RISK_BANDS.length; i++) {
    assert.ok(RISK_BANDS[i].max > RISK_BANDS[i - 1].max);
  }
});

/* ══════════════ محاسبهٔ ریسک ══════════════ */

test("نمرهٔ ریسک حاصل‌ضرب احتمال و شدت است", () => {
  assert.equal(riskScore(3, 4), 12);
  assert.equal(riskScore(5, 5), 25);
  assert.equal(riskScore(1, 1), 1);
});

test("ورودی خارج از بازه محدود می‌شود نه صفر", () => {
  assert.equal(riskScore(9, 9), 25, "ورودی نامعتبر نباید خطر را بی‌خطر نشان دهد");
  assert.equal(riskScore(0, 3), 3);
  assert.equal(riskScore(-2, 4), 4);
});

test("باند ریسک درست تعیین می‌شود", () => {
  assert.equal(riskBand(2).code, "low");
  assert.equal(riskBand(8).code, "medium");
  assert.equal(riskBand(12).code, "high");
  assert.equal(riskBand(20).code, "extreme");
});

test("باند ریسک نامعلوم null است نه صفر", () => {
  assert.equal(riskBand(null).code, "unknown");
  assert.equal(riskBand(null).score, null);
  assert.equal(riskBand(undefined).code, "unknown");
});

/* ══════════════ اعتبارسنجی ══════════════ */

test("ارزیابی درست خطا ندارد", () => {
  assert.deepEqual(validateJsaInput(jsa()), []);
});

test("شمارهٔ ارزیابی الزامی است", () => {
  const e = validateJsaInput(jsa({ JsaNo: " " }));
  assert.ok(e.some((x) => x.code === "E-HSE-JSA-NO-REQUIRED"));
});

test("خطر با احتمال خارج از یک تا پنج رد می‌شود", () => {
  const e = validateHazardInput(hazard({ Likelihood: 7 }));
  assert.ok(e.some((x) => x.code === "E-HSE-RISK-RANGE"));
});

test("خطر بدون شرح رد می‌شود", () => {
  const e = validateHazardInput(hazard({ HazardFa: "" }));
  assert.ok(e.some((x) => x.code === "E-HSE-HAZARD-DESC-REQUIRED"));
});

test("دستهٔ خطر نامعتبر رد می‌شود", () => {
  const e = validateHazardInput(hazard({ HazardCategory: "alien" }));
  assert.ok(e.some((x) => x.code === "E-HSE-HAZARD-CATEGORY"));
});

test("سطح کنترل نامعتبر رد می‌شود", () => {
  const e = validateControlInput(control({ ControlLevel: "magic" }));
  assert.ok(e.some((x) => x.code === "E-HSE-CONTROL-LEVEL"));
});

/* ══════════════ ارزیابی خطر ══════════════ */

test("خطر با کنترل مهندسی درست ارزیابی می‌شود", () => {
  const e = evaluateHazard(
    hazard({ ResidualLikelihood: 1, ResidualSeverity: 3 }),
    [control()],
  );
  assert.equal(e.initialRisk, 12);
  assert.equal(e.residualRisk, 3);
  assert.equal(e.bestControlLevel, "engineering");
  assert.equal(e.bestControlLevelFa, "کنترل مهندسی");
  assert.equal(e.reductionPct, 75);
  assert.equal(e.ppeOnly, false);
});

test("خطر بدون کنترل هشدار می‌دهد", () => {
  const e = evaluateHazard(hazard(), []);
  assert.equal(e.controlCount, 0);
  assert.ok(e.warningsFa.some((w) => w.includes("هیچ کنترلی")));
});

test("ریسک باقیماندهٔ ثبت‌نشده برابر ریسک اولیه است نه صفر", () => {
  const e = evaluateHazard(hazard(), [control()]);
  assert.equal(e.residualRisk, 12, "کنترل سنجیده‌نشده خطر را کم نکرده است");
  assert.equal(e.reductionPct, 0);
  assert.ok(e.warningsFa.some((w) => w.includes("سنجیده نشده")));
});

test("اتکای صرف به حفاظت فردی برای ریسک بالا هشدار می‌دهد", () => {
  const e = evaluateHazard(
    hazard({ Likelihood: 4, Severity: 5 }),
    [control({ ControlLevel: "ppe" })],
  );
  assert.equal(e.initialRisk, 20);
  assert.equal(e.ppeOnly, true);
  assert.ok(e.warningsFa.some((w) => w.includes("حفاظت فردی")));
});

test("حفاظت فردی برای ریسک پایین هشدار ندارد", () => {
  const e = evaluateHazard(
    hazard({ Likelihood: 2, Severity: 2, ResidualLikelihood: 1, ResidualSeverity: 2 }),
    [control({ ControlLevel: "ppe" })],
  );
  assert.equal(e.ppeOnly, true);
  assert.ok(!e.warningsFa.some((w) => w.includes("حفاظت فردی")), "ریسک کم با PPE پذیرفتنی است");
});

test("بهترین سطح کنترل از میان چند کنترل انتخاب می‌شود", () => {
  const e = evaluateHazard(hazard(), [
    control({ Id: "c1", ControlNo: 1, ControlLevel: "ppe" }),
    control({ Id: "c2", ControlNo: 2, ControlLevel: "elimination" }),
    control({ Id: "c3", ControlNo: 3, ControlLevel: "administrative" }),
  ]);
  assert.equal(e.bestControlLevel, "elimination");
  assert.equal(e.ppeOnly, false);
});

test("ریسک باقیماندهٔ بیشتر از اولیه هشدار می‌دهد", () => {
  const e = evaluateHazard(
    hazard({ Likelihood: 2, Severity: 2, ResidualLikelihood: 4, ResidualSeverity: 4 }),
    [control()],
  );
  assert.ok(e.warningsFa.some((w) => w.includes("بیشتر است")));
});

test("کنترل خطر دیگر در این خطر شمرده نمی‌شود", () => {
  const e = evaluateHazard(hazard(), [control({ HazardId: "h9" })]);
  assert.equal(e.controlCount, 0);
});

/* ══════════════ خلاصه ══════════════ */

test("خلاصهٔ ارزیابی درست جمع می‌زند", () => {
  const s = jsaSummary(
    [step(), step({ Id: "s2", StepNo: 2, DescriptionFa: "باز کردن فلنج" })],
    [
      hazard({ ResidualLikelihood: 1, ResidualSeverity: 2 }),
      hazard({ Id: "h2", StepId: "s2", HazardNo: 1, Likelihood: 2, Severity: 3, ResidualLikelihood: 1, ResidualSeverity: 1 }),
    ],
    [control(), control({ Id: "c2", HazardId: "h2", ControlLevel: "ppe" })],
  );
  assert.equal(s.steps, 2);
  assert.equal(s.hazards, 2);
  assert.equal(s.controls, 2);
  assert.equal(s.maxInitialRisk, 12);
  assert.equal(s.maxResidualRisk, 2);
  assert.equal(s.byControlLevel.engineering, 1);
  assert.equal(s.byControlLevel.ppe, 1);
  assert.equal(s.byControlLevel.elimination, 0, "همهٔ سطوح باید کلید داشته باشند");
  assert.equal(s.stepsWithoutHazard, 0);
});

test("خلاصه گام بدون خطر را می‌شمارد", () => {
  const s = jsaSummary(
    [step(), step({ Id: "s2", StepNo: 2, DescriptionFa: "گام دوم" })],
    [hazard()],
    [control()],
  );
  assert.equal(s.stepsWithoutHazard, 1);
  assert.ok(s.warningsFa.some((w) => w.includes("بدون شناسایی خطر")));
});

test("خلاصهٔ خالی صفر می‌دهد نه خطا", () => {
  const s = jsaSummary([], [], []);
  assert.equal(s.hazards, 0);
  assert.equal(s.maxResidualRisk, null, "نبود خطر یعنی نامعلوم نه صفر");
  assert.equal(s.maxResidualBand.code, "unknown");
});

/* ══════════════ تصویب ══════════════ */

function fullSet() {
  return {
    jsa: jsa(),
    steps: [step()],
    hazards: [hazard({ ResidualLikelihood: 1, ResidualSeverity: 2 })],
    controls: [control()],
    approverId: "u-hse",
  };
}

test("ارزیابی کامل تصویب می‌شود", () => {
  const r = canApproveJsa(fullSet());
  assert.equal(r.ok, true, JSON.stringify(r.blockersFa));
  assert.equal(r.maxResidualRisk, 2);
});

test("ارزیابی بدون گام تصویب نمی‌شود", () => {
  const r = canApproveJsa({ ...fullSet(), steps: [] });
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("گام کاری")));
});

test("ارزیابی بدون خطر تصویب نمی‌شود", () => {
  const r = canApproveJsa({ ...fullSet(), hazards: [] });
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("خطری شناسایی نشده")));
});

test("خطر بدون کنترل مانع تصویب است", () => {
  const r = canApproveJsa({ ...fullSet(), controls: [] });
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("هیچ کنترلی")));
});

test("ریسک باقیماندهٔ بالاتر از حد مجاز مانع تصویب است", () => {
  const r = canApproveJsa({
    ...fullSet(),
    hazards: [hazard({ Likelihood: 5, Severity: 5, ResidualLikelihood: 4, ResidualSeverity: 4 })],
  });
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes(String(MAX_APPROVABLE_RESIDUAL))));
});

test("اتکای صرف به حفاظت فردی برای ریسک بالا مانع تصویب است", () => {
  const r = canApproveJsa({
    ...fullSet(),
    hazards: [hazard({ Likelihood: 4, Severity: 5, ResidualLikelihood: 2, ResidualSeverity: 2 })],
    controls: [control({ ControlLevel: "ppe" })],
  });
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("حفاظت فردی")));
});

test("تصویب‌کننده نمی‌تواند همان تهیه‌کننده باشد", () => {
  const r = canApproveJsa({ ...fullSet(), approverId: "u-site" });
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("تهیه‌کننده")));
});

test("ارزیابی مصوب دوباره تصویب نمی‌شود", () => {
  const r = canApproveJsa({ ...fullSet(), jsa: jsa({ Status: "approved" }) });
  assert.equal(r.ok, false);
});

test("همهٔ موانع یک‌جا برمی‌گردند", () => {
  const r = canApproveJsa({
    jsa: jsa(), steps: [], hazards: [], controls: [], approverId: "u-site",
  });
  assert.ok(r.blockersFa.length >= 3, `انتظار چند مانع، دریافت ${r.blockersFa.length}`);
});

test("گام بدون خطر هشدار است نه مانع", () => {
  const r = canApproveJsa({
    ...fullSet(),
    steps: [step(), step({ Id: "s2", StepNo: 2, DescriptionFa: "گام دوم" })],
  });
  assert.equal(r.ok, true, "گام بی‌خطر نباید تصویب را ببندد");
  assert.ok(r.warningsFa.some((w) => w.includes("بدون شناسایی خطر")));
});

/* ══════════════ وضعیت و پیش‌نیاز پروانه ══════════════ */

test("ارزیابی مصوب در بازهٔ اعتبار قابل استفاده است", () => {
  const st = jsaState(jsa({ Status: "approved", ValidUntil: "2026-12-01" }), NOW);
  assert.equal(st.effectiveStatus, "approved");
  assert.equal(st.isUsable, true);
  assert.equal(st.expiresInDays, 82);
});

test("انقضا از تاریخ محاسبه می‌شود نه ستون وضعیت", () => {
  const st = jsaState(jsa({ Status: "approved", ValidUntil: "2026-08-01" }), NOW);
  assert.equal(st.effectiveStatus, "expired", "ارزیابی کهنه نباید معتبر بماند");
  assert.equal(st.isUsable, false);
  assert.equal(st.statusFa, JSA_STATUS_FA.expired);
});

test("ارزیابی بدون تاریخ انقضا معتبر می‌ماند", () => {
  const st = jsaState(jsa({ Status: "approved" }), NOW);
  assert.equal(st.isUsable, true);
  assert.equal(st.expiresInDays, null);
});

test("پروانه بدون ارزیابی ریسک پشتیبانی نمی‌شود", () => {
  const r = jsaSupportsPermit(null, NOW);
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa[0].includes("پیوست نشده"));
});

test("ارزیابی پیش‌نویس پروانه را پشتیبانی نمی‌کند", () => {
  const r = jsaSupportsPermit(jsa(), NOW);
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("تصویب نشده")));
});

test("ارزیابی منقضی پروانه را پشتیبانی نمی‌کند", () => {
  const r = jsaSupportsPermit(jsa({ Status: "approved", ValidUntil: "2026-01-01" }), NOW);
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("منقضی")));
});

test("ارزیابی مصوب معتبر پروانه را پشتیبانی می‌کند", () => {
  const r = jsaSupportsPermit(jsa({ Status: "approved", ValidUntil: "2026-12-01" }), NOW);
  assert.equal(r.ok, true);
  assert.deepEqual(r.blockersFa, []);
});
