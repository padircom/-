import test from "node:test";
import assert from "node:assert/strict";
import { buildChangeReport, sanitizeChangeReportHtml, CHANGE_REPORT_CHAPTERS, CHANGE_REPORT_TABLES } from "./changeDocLogic.js";

const baseInput = {
  projectId: "c1-p1", projectTitleFa: "پروژهٔ آزمون",
  request: {
    Code: "CHG-TEST1", TitleFa: "تغییر آزمون", Status: "approved",
    ChangeType: "design", Priority: "high", RequestedBy: "u-contracts", RequestDate: "2026-10-01",
    ContractCode: "CNT-110", Currency: "IRR", InitialCostEstimate: 86000000, InitialTimeImpactDays: 4,
    DescriptionFa: "شرح واقعی", ReasonFa: "علت واقعی", NecessityFa: "ضرورت واقعی",
    WbsRefs: ["W-1"], ActivityRefs: ["A-1"], ClauseRefs: ["مادهٔ ۱۲"] ,
    DecidedBy: "u-pm", DecidedAt: "2026-10-10T10:00:00Z", DecisionFa: "تأیید مشروط",
    StatusChangedBy: "u-contracts", StatusChangedAt: "2026-10-10T09:00:00Z",
  },
  impacts: [], costs: [{
    Code: "CST-1", Layer: "estimated", Amount: 50000000, FormulaFa: "کمیت×نرخ", SourceFa: "برآورد PMO", BasisDate: "2026-10-01", DirectAmount: 30000000,
  }],
  schedules: [{ Code: "SCH-1", MethodFa: "پنجره‌ای", AssumptionsFa: "فرض واقعی", EstimatedDurationDeltaDays: 4, CompletionEffectDays: 4 }],
  approvals: [{ StepCode: "approved", Stage: "approval", Decision: "approved", DecidedBy: "u-pm", DecidedAt: "2026-10-10T10:00:00Z", NoteFa: "نمونه" }],
  riskLinks: [], claimLinks: [], documents: [], implementation: [],
  audits: [{ OccurredAt: "2026-10-10T10:00:00Z", Action: "status_changed", Actor: "u-pm", DetailFa: "گذر", FromValue: "pending_decision", ToValue: "approved" }],
  moduleLinks: [],
  timeAnalysis: { estimatedDeltaDays: 4, criticalPathEffect: "none", approvedEotDays: 0, unknownCodes: ["A-1"] },
  costAnalysis: { layers: { estimated: 50000000 }, layerDeltas: {}, directTotal: 30000000, warningsFa: [] },
  linksVerify: { verified: 0, missing: 0 },
  generatedAt: "2026-10-19T08:00:00Z", generatedBy: "u-pm", format: "word",
};

test("ساختار ۱۲ فصل/۲۸ جدول و وجود داده‌های واقعی + «—» برای ناقص", () => {
  const doc = buildChangeReport(baseInput);
  assert.equal(doc.issues.length, 0, doc.issues.join("; "));
  assert.equal(CHANGE_REPORT_CHAPTERS.length, 12);
  assert.equal(CHANGE_REPORT_TABLES.length, 28);
  assert.ok(doc.body.includes("CHG-TEST1"), "کد درخواست بیاید");
  assert.ok(doc.body.includes("کمیت×نرخ"), "فرمول واقعی هزینه بیاید");
  assert.ok(doc.body.includes("B Nazanin"), "فونت رسمی اعمال شود");
  assert.ok(doc.body.includes("application/msword") === false); // بدنه HTML است، contentType جدا
  assert.equal(doc.contentType, "application/msword; charset=utf-8");
  assert.ok(doc.filename.endsWith(".doc"));
  /* دادهٔ ناقص وجود داشته باشد اما سلول خالی تولید نشود — هر سلول یا مقدار دارد یا «—» */
  const emptyCells = (doc.body.match(/<td>\s*<\/td>/g) || []).length;
  assert.equal(emptyCells, 0);
  /* صدق: llmConnected:false در بیانیه */
  assert.ok(doc.body.includes("بدون اتصال LLM"), "بیانیهٔ صدق LLM");
});

test("گیت صدور — پیش‌نویس تهی از داده پذیرفته نیست (422)", () => {
  const bad = buildChangeReport({ ...baseInput, request: { ...baseInput.request, Status: "draft" }, costs: [], schedules: [] });
  assert.ok(bad.issues.length >= 1);
  assert.ok(bad.issues[0].includes("دادهٔ واقعی"));
});

test("Auto-Cleanup: راهنمای داخلی/هایلایت/برچسب‌های الزامی حذف می‌شوند", () => {
  const dirty = `<html><body><div class="internal-guide"><p>راهنمای داخلی: ادمو [الزامی]</p></div><p style="background:yellow">متن <mark class="hl">با هایلایت</mark> [اختیاری]</p></body></html>`;
  const clean = sanitizeChangeReportHtml(dirty);
  assert.ok(!clean.includes("راهنمای داخلی"));
  assert.ok(!clean.includes("[الزامی]") && !clean.includes("[اختیاری]"));
  assert.ok(!clean.includes("background:yellow") && !clean.includes("<mark"));
});
