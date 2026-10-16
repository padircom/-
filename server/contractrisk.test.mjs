/**
 * PMO-CONTRACT-RISK-ENGINE-V1.0 — آزمون‌های هدفمند موتور امتیازدهی،
 * تحلیل بند و جمع‌بندی مرکز کنترل. اجرا: node --test server/contractrisk.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateContractRisk, summarizeContractRiskPortfolio, DEFAULT_SCORING_CONFIG } from "./contractRiskLogic.js";
import { analyzeContractText, compareContractVersions } from "./contractClauseLogic.js";

const full = { probability: 4, impactTime: 3, impactFinancial: 5, impactLegal: 3, impactOperational: 2, impactQuality: 1 };

test("امتیاز ذاتی = احتمال × اثر وزن‌دار و رتبه درست است", () => {
  const r = evaluateContractRisk(full);
  assert.equal(r.inherentScore, 12.2); // 4 × 3.05
  assert.equal(r.inherentBand, "high");
  assert.equal(r.status, "scored");
});

test("بدون کنترل مستند، باقیمانده برابر ذاتی است", () => {
  const r = evaluateContractRisk({ ...full, controlEffectiveness: "none" });
  assert.equal(r.residualScore, r.inherentScore);
});

test("کنترل قوی بدون شاهد به ضعیف محدود می‌شود", () => {
  const r = evaluateContractRisk({ ...full, controlEffectiveness: "strong", controlEvidenceRefs: [] });
  assert.equal(r.controlEffectApplied, DEFAULT_SCORING_CONFIG.controlEffects.weak);
  const withEvidence = evaluateContractRisk({ ...full, controlEffectiveness: "strong", controlEvidenceRefs: ["doc-1"] });
  assert.equal(withEvidence.controlEffectApplied, 0.6);
  assert.ok(withEvidence.residualScore < withEvidence.inherentScore);
});

test("داده ناقص و خارج از محدوده needs_review می‌دهد و عدد ساختگی نمی‌سازد", () => {
  assert.equal(evaluateContractRisk({}).status, "needs_review");
  assert.equal(evaluateContractRisk({ probability: 9, impactTime: 3 }).inherentScore, null);
  assert.equal(evaluateContractRisk({ probability: 3 }).inherentScore, null);
});

test("قاعده تصویب‌نشده نتیجه را قطعی نمی‌کند", () => {
  const r = evaluateContractRisk(full, DEFAULT_SCORING_CONFIG, false);
  assert.equal(r.status, "needs_review");
  assert.ok(r.rationaleFa.some((x) => x.includes("مصوب نیست")));
});

test("آستانه‌های رتبه‌بندی قابل تنظیم‌اند", () => {
  const custom = { ...DEFAULT_SCORING_CONFIG, bands: { critical: 20, high: 12, medium: 6 } };
  assert.equal(evaluateContractRisk(full, custom).inherentBand, "high");
  const strict = { ...DEFAULT_SCORING_CONFIG, bands: { critical: 12, high: 8, medium: 4 } };
  assert.equal(evaluateContractRisk(full, strict).inherentBand, "critical");
});

test("تحلیل بند: یافته‌ها با ارجاع بند و نوع درست", () => {
  const text = "ماده ۲۹- شرایط پرداخت پیمان\nکارفرما موظف است صورت وضعیت پیمانکار را حداکثر ظرف مدت ۳۰ روز پس از تایید ناظر پرداخت نماید و کسور قانونی را کسر کند.\nماده ۵۰- تمدید مدت\nدر صورت تاخیر کارفرما پیمانکار می تواند درخواست تمدید مدت پیمان را ارائه نماید.";
  const r = analyzeContractText(text, "قرارداد اصلی");
  assert.equal(r.status, "analyzed");
  assert.equal(r.clauseCount, 2);
  const kinds = r.findings.map((f) => f.kind);
  assert.ok(kinds.includes("payment"));
  assert.ok(kinds.includes("extension"));
  assert.ok(r.findings.every((f) => f.sourceRef.includes("بند")));
  assert.equal(r.llmConnected, false);
});

test("متن ناکافی/اسکن‌شده یافته قطعی تولید نمی‌کند", () => {
  const r = analyzeContractText("متن کوتاه");
  assert.equal(r.status, "not_extractable");
  assert.equal(r.findings.length, 0);
});

test("ابهام بدون مهلت عددی شناسایی می‌شود و مهلت فارسی شمرده می‌شود", () => {
  const vague = analyzeContractText("ماده ۱۰- تحویل مدارک پیمان و اسناد نهایی پروژه\nپیمانکار موظف است مدارک را در اسرع وقت و بدون هیچ گونه معیار مشخص و روشنی به کارفرما تحویل نماید و این کار باید در ادامه پروژه انجام شود و مدارک تکمیلی نیز باید به همین ترتیب ارائه گردد و هیچ مهلت مشخصی برای آن تعیین نشده است.");
  assert.ok(vague.findings.some((f) => f.kind === "ambiguity" || f.kind === "missing_criteria"));
  const withDeadline = analyzeContractText("ماده ۱۰- تحویل مدارک پیمان به کارفرما\nپیمانکار موظف است مدارک نهایی پروژه را حداکثر ظرف مدت ۳۰ روز پس از تحویل موقت به کارفرما تحویل نماید و رسید دریافت کند.");
  assert.ok(!withDeadline.findings.some((f) => f.kind === "missing_criteria"));
});

test("مقایسه نسخه‌ها افزوده/حذف/تغییر را در سطح بند می‌دهد", () => {
  const a = "ماده ۱- موضوع پیمان\nاجرای عملیات ساختمانی فاز یک پروژه به صورت کامل و طبق نقشه های اجرایی ابلاغی کارفرما انجام می شود.\nماده ۲- مبلغ پیمان\nمبلغ پیمان طبق فهرست بهای پیوست محاسبه می شود و پرداخت بر اساس صورت وضعیت های تاییدشده است.";
  const b = "ماده ۱- موضوع پیمان\nاجرای عملیات ساختمانی فاز یک و دو پروژه به صورت کامل و طبق نقشه های اجرایی ابلاغی کارفرما انجام می شود.\nماده ۳- مدت پیمان\nمدت پیمان دوازده ماه از تاریخ تحویل زمین است و شروع عملیات پس از ابلاغ دستور شروع خواهد بود.";
  const d = compareContractVersions(a, b);
  assert.equal(d.changed.length, 1);
  assert.equal(d.added.length, 1);
  assert.equal(d.removed.length, 1);
});

test("جمع‌بندی مرکز کنترل از داده واقعی و بدون داده ساختگی", () => {
  const risks = [
    { Code: "CR-1", Status: "assessed", InherentBand: "critical", ResidualBand: "high", InherentScore: 20, Probability: 4, Owner: "u1", ControlEffectiveness: "partial" },
    { Code: "CR-2", Status: "identified", InherentBand: null, InherentScore: null, Owner: null, ControlEffectiveness: "none" },
  ];
  const s = summarizeContractRiskPortfolio(risks, [{ RiskCode: "CR-1", Status: "defined", DueDate: "2020-01-01" }], [{ Status: "pending", DueDate: "2020-01-01" }], [{ Status: "pending_approval" }], 3, "2026-01-01");
  assert.equal(s.totalRisks, 2);
  assert.equal(s.critical, 1);
  assert.equal(s.unassessed, 1);
  assert.equal(s.ownerless, 1);
  assert.equal(s.overdueActions, 1);
  assert.equal(s.overdueObligations, 1);
  assert.equal(s.clausesNeedingReview, 3);
});
