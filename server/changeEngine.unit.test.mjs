/**
 * تست واحد موتورهای فاز ۲ مدیریت تغییر — خالص و بدون پایگاه‌داده.
 * اجرا: npm run build:change --silent && node --test server/changeEngine.unit.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTimeImpact, analyzeCostImpact, verifyModuleLinks, parseCodeList } from "./changeMgmtLogic.js";

test("parseCodeList — آرایه/JSON-رشته/رشتهٔ ساده", () => {
  assert.deepEqual(parseCodeList('["A1","A2"]'), ["A1", "A2"]);
  assert.deepEqual(parseCodeList(["W1", " W2 "]), ["W1", "W2"]);
  assert.deepEqual(parseCodeList("A9"), ["A9"]);
  assert.deepEqual(parseCodeList(null), []);
});

test("analyzeTimeImpact — تطبیق کدها، مسیر بحرانی و جمع اثر/تمدید", () => {
  const acts = [
    { Id: "i1", Code: "A1", NameFa: "فعالیت ۱", PlannedStart: "2026-01-01", PlannedFinish: "2026-01-10", DurationDays: 10, TotalFloat: 0, FreeFloat: 0, IsCritical: true },
    { Id: "i2", Code: "A2", NameFa: "فعالیت ۲", PlannedStart: "2026-01-11", PlannedFinish: "2026-01-20", DurationDays: 10, TotalFloat: 5, FreeFloat: 2, IsCritical: false },
    { Id: "i3", Code: "A3", NameFa: "فعالیت ۳", PlannedStart: "2026-02-01", PlannedFinish: "2026-02-05", DurationDays: 0, TotalFloat: 0, FreeFloat: 0, IsCritical: true },
  ];
  const rels = [{ PredecessorId: "i1", SuccessorId: "i2" }, { PredecessorId: "i2", SuccessorId: "i3" }];
  const request = { ActivityRefs: '["A1","UNKNOWN"]', WbsRefs: null };
  const sched = [
    { AffectedActivitiesJson: '["A2"]', EstimatedDurationDeltaDays: 3, ApprovedEotDays: 2, EotEntitlementFa: "بند ۲۳" },
    { AffectedActivitiesJson: '["A3"]', EstimatedDurationDeltaDays: 4, ApprovedEotDays: 0 },
  ];
  const out = analyzeTimeImpact(request, sched, acts, rels);
  assert.equal(out.affectedCount, 3);
  assert.deepEqual(out.unknownCodes, ["UNKNOWN"]);
  assert.equal(out.criticalCount, 2);
  assert.equal(out.criticalPathEffect, "critical");
  assert.equal(out.milestoneCount, 1); // A3 با مدت صفر
  assert.equal(out.estimatedDeltaDays, 7);
  assert.equal(out.approvedEotDays, 2);
  assert.equal(out.baselineFinish, "2026-02-05");
  const a2 = out.affected.find((x) => x.code === "A2");
  assert.deepEqual(a2.predecessorCodes, ["A1"]);
  assert.deepEqual(a2.successorCodes, ["A3"]);
});

test("analyzeTimeImpact — بدون فعالیت بحرانی: مسیر غیربحرانی", () => {
  const acts = [{ Id: "i1", Code: "A1", NameFa: "x", PlannedStart: "2026-01-01", PlannedFinish: "2026-01-05", DurationDays: 5, TotalFloat: 10, FreeFloat: 5, IsCritical: false }];
  const out = analyzeTimeImpact({ ActivityRefs: '["A1"]' }, [{ EstimatedDurationDeltaDays: 2 }], acts, []);
  assert.equal(out.criticalPathEffect, "none");
  assert.equal(out.approvedEotDays, 0);
});

test("analyzeCostImpact — لایه‌ها، دلتاها و هشدارهای صادقانه", () => {
  const rows = [
    { Code: "C1", Layer: "estimated", Amount: 125000000, DirectAmount: 100000000, IndirectAmount: 25000000, FormulaFa: "x", SourceFa: "برآورد کارشناسی", BasisDate: "2026-01-01" },
    { Code: "C2", Layer: "proposed", Amount: 145000000, FormulaFa: "y", SourceFa: "مذاکرهٔ اولیه", BasisDate: "2026-01-02" },
    { Code: "C3", Layer: "approved", Amount: 130000000, ApprovedBy: "mgr-1", FormulaFa: "z", SourceFa: "صورت‌جلسه CCB", BasisDate: "2026-01-03" },
  ];
  const out = analyzeCostImpact(rows, "IRR");
  assert.equal(out.layers.estimated, 125000000);
  assert.equal(out.layers.approved, 130000000);
  assert.equal(out.layerDeltas["proposed-estimated"], 20000000);
  assert.equal(out.layerDeltas["approved-negotiated"], 130000000); // negotiated صفر است، approved غیرصفر ⇒ دلتا محاسبه می‌شود
  assert.equal(out.directTotal, 100000000);
  assert.equal(out.indirectTotal, 25000000);
  assert.equal(out.approvedLayerCount, 1);
  assert.equal(out.warningsFa.length, 0);
});

test("analyzeCostImpact — پرداخت بیش از مصوب هشدار می‌دهد", () => {
  const rows = [
    { Code: "C1", Layer: "approved", Amount: 100, ApprovedBy: "m", FormulaFa: "f", SourceFa: "سند", BasisDate: "2026-01-01" },
    { Code: "C2", Layer: "paid", Amount: 150, FormulaFa: "f", SourceFa: "رسید پرداخت", BasisDate: "2026-01-02" },
  ];
  const out = analyzeCostImpact(rows);
  assert.ok(out.warningsFa.some((w) => w.includes("بیشتر")));
});

test("verifyModuleLinks — تأیید/رد نرم در برابر کدهای واقعی ماژول‌ها", () => {
  const links = [
    { LinkKind: "delay_event", TargetCode: "DL-1", TargetTitleFa: "تأخیر ۱" },
    { LinkKind: "dispute_case", TargetCode: "DXP-9", TargetTitleFa: "پرونده ۹" },
    { LinkKind: "contract_risk", TargetCode: "CR-1", TargetTitleFa: "ریسک ۱" },
  ];
  const sets = {
    delayEventCodes: new Set(["DL-1"]), lossCaseCodes: new Set(), contractRiskCodes: new Set(),
    claimCodes: new Set(), disputeCaseCodes: new Set(), documentIds: new Set(), legacyChangeCodes: new Set(), baselineIds: new Set(),
  };
  const out = verifyModuleLinks(links, sets);
  assert.equal(out[0].verified, true);
  assert.equal(out[1].verified, false);
  assert.equal(out[1].verifiedNoteFa, "مقصد پیوند در ماژول مبدأ یافت نشد (نرم ارزیابی شد)");
  assert.equal(out[2].verified, false);
});
