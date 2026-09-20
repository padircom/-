/**
 * آزمون موتور پیشرفت پیمان (CNT/D9).
 *
 * تمرکز روی جاهایی که محاسبهٔ پیشرفت معمولاً دروغ می‌گوید: وزن‌دهی
 * ردیف بی‌مبلغ، جمع کردن تجمعی‌ها، افت واقعی به صفر در آینده، و
 * نقطهٔ عطف محقق‌شدهٔ بی‌سند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  boqLineAmount,
  progressBreakdown,
  financialProgress,
  progressGap,
  PROGRESS_GAP_FA,
  PROGRESS_GAP_TOLERANCE_PCT,
  sCurve,
  milestoneRollup,
  MILESTONE_STATUS_FA,
  progressSnapshot,
} from "./cntLogic.js";

/* ══════════════ ۱) مبلغ ردیف ══════════════ */

test("مبلغ ذخیره‌شده بر بازسازی اولویت دارد", () => {
  assert.equal(boqLineAmount({ LineAmount: 500, ContractQty: 10, UnitRate: 1 }), 500);
});

test("ردیف مقطوع از مبلغ مقطوع خوانده می‌شود", () => {
  assert.equal(boqLineAmount({ LumpSumAmount: 9_000, ContractQty: null, UnitRate: null }), 9_000);
});

test("ردیف واحدبها از مقدار × نرخ بازسازی می‌شود", () => {
  assert.equal(boqLineAmount({ ContractQty: 20, UnitRate: 250 }), 5_000);
});

test("ردیف بی‌داده صفر می‌شود نه NaN", () => {
  assert.equal(boqLineAmount({}), 0);
  assert.equal(boqLineAmount({ ContractQty: null, UnitRate: undefined }), 0);
});

/* ══════════════ ۲) پیشرفت فیزیکی ══════════════ */

const BOQ = [
  { Id: "a", ItemNo: "0101", ChapterCode: "01", TitleFa: "خاک‌برداری", ContractQty: 100, UnitRate: 1_000 },
  { Id: "b", ItemNo: "0301", ChapterCode: "03", TitleFa: "بتن‌ریزی", ContractQty: 100, UnitRate: 9_000 },
];

test("وزن بر مبلغ است نه بر تعداد ردیف", () => {
  const r = progressBreakdown({ boq: BOQ });
  assert.equal(r.baseAmount, 1_000_000);
  assert.equal(r.lines.find((l) => l.boqItemId === "a").weightPct, 10);
  assert.equal(r.lines.find((l) => l.boqItemId === "b").weightPct, 90);
});

test("ردیف کوچکِ تمام‌شده پیشرفت را بزرگ نمی‌کند", () => {
  /* ردیف ۱۰٪ وزن، ۱۰۰٪ اجرا → پیشرفت کل باید ۱۰٪ باشد نه ۵۰٪. */
  const r = progressBreakdown({
    boq: BOQ,
    achieved: [{ BoqItemId: "a", EarnedCumulative: 100_000 }],
  });
  assert.equal(r.physicalPct, 10);
  assert.equal(r.startedCount, 1);
  assert.equal(r.completedCount, 1);
});

test("درصد تجمعی جایگزین مبلغ کسب‌شده می‌شود", () => {
  const r = progressBreakdown({
    boq: BOQ,
    achieved: [{ BoqItemId: "b", CumPct: 50 }],
  });
  assert.equal(r.lines.find((l) => l.boqItemId === "b").earnedAmount, 450_000);
  assert.equal(r.physicalPct, 45);
});

test("نسبت مقدار وقتی نه مبلغ هست نه درصد", () => {
  const r = progressBreakdown({
    boq: BOQ,
    achieved: [{ BoqItemId: "b", CumQty: 25 }],
  });
  assert.equal(r.lines.find((l) => l.boqItemId === "b").earnedAmount, 225_000);
});

test("ردیف بی‌مبلغ در وزن‌دهی نقشی ندارد و هشدار می‌دهد", () => {
  const r = progressBreakdown({
    boq: [...BOQ, { Id: "c", ChapterCode: "05", ContractQty: 50, UnitRate: 0 }],
  });
  assert.equal(r.baseAmount, 1_000_000, "مخرج دست‌نخورده");
  assert.equal(r.zeroWeightCount, 1);
  assert.ok(r.warningsFa.some((w) => w.includes("بدون مبلغ")));
});

test("اجرای بیش از پیمان پرچم می‌گیرد", () => {
  const r = progressBreakdown({
    boq: BOQ,
    achieved: [{ BoqItemId: "a", EarnedCumulative: 150_000 }],
  });
  const line = r.lines.find((l) => l.boqItemId === "a");
  assert.equal(line.itemPct, 150);
  assert.equal(line.isOverrun, true);
  assert.equal(r.overrunCount, 1);
  assert.ok(r.warningsFa.some((w) => w.includes("بیش از مقدار پیمان")));
});

test("بزرگ‌ترین تجمعی ملاک است، نه آخرین", () => {
  /* دو صورت‌وضعیت همان ردیف را دارند؛ جمع کردن یعنی دوبار شمردن. */
  const r = progressBreakdown({
    boq: BOQ,
    achieved: [
      { BoqItemId: "b", EarnedCumulative: 300_000 },
      { BoqItemId: "b", EarnedCumulative: 500_000 },
    ],
  });
  assert.equal(r.earnedAmount, 500_000);
  assert.equal(r.physicalPct, 50);
});

test("ردیف لغوشده کنار گذاشته می‌شود", () => {
  const r = progressBreakdown({
    boq: [...BOQ, { Id: "z", ContractQty: 1_000, UnitRate: 1_000, Status: "cancelled" }],
  });
  assert.equal(r.baseAmount, 1_000_000);
  assert.equal(r.lineCount, 2);
});

test("تجمیع فصلی بر حسب وزن مرتب می‌شود", () => {
  const r = progressBreakdown({
    boq: BOQ,
    achieved: [{ BoqItemId: "b", CumPct: 100 }],
  });
  assert.equal(r.byChapter[0].chapterCode, "03");
  assert.equal(r.byChapter[0].weightPct, 90);
  assert.equal(r.byChapter[0].progressPct, 100);
  assert.equal(r.byChapter[1].progressPct, 0);
});

test("فهرست‌بهای خالی هشدار می‌دهد و صفر برمی‌گرداند", () => {
  const r = progressBreakdown({ boq: [] });
  assert.equal(r.physicalPct, 0);
  assert.ok(r.warningsFa.some((w) => w.includes("مبلغ ندارد")));
});

/* ══════════════ ۳) پیشرفت مالی ══════════════ */

test("تجمعی‌ها جمع نمی‌شوند، بیشینه گرفته می‌شوند", () => {
  const r = financialProgress({
    contractAmount: 1_000_000,
    ipcs: [
      { WorkflowState: "approved", GrossCumulative: 200_000, NetPayable: 180_000 },
      { WorkflowState: "approved", GrossCumulative: 500_000, NetPayable: 270_000 },
    ],
  });
  assert.equal(r.approvedGross, 500_000, "بیشینه نه جمع");
  assert.equal(r.financialPct, 50);
  assert.equal(r.approvedNet, 450_000, "خالص اما جمع می‌شود");
});

test("صورت‌وضعیت در جریان در درصد نمی‌آید ولی شمرده می‌شود", () => {
  const r = financialProgress({
    contractAmount: 1_000_000,
    ipcs: [
      { WorkflowState: "approved", GrossCumulative: 300_000, NetPayable: 270_000 },
      { WorkflowState: "submitted", GrossCurrent: 200_000 },
      { WorkflowState: "reviewed", GrossCurrent: 100_000 },
    ],
  });
  assert.equal(r.financialPct, 30);
  assert.equal(r.pendingCount, 2);
  assert.equal(r.pendingGross, 300_000);
  assert.ok(r.warningsFa.some((w) => w.includes("در جریان")));
});

test("پرداخت‌شده جدا از تأییدشده شمرده می‌شود", () => {
  const r = financialProgress({
    contractAmount: 1_000_000,
    ipcs: [
      { WorkflowState: "paid", GrossCumulative: 300_000, NetPayable: 270_000 },
      { WorkflowState: "approved", GrossCumulative: 500_000, NetPayable: 180_000 },
    ],
  });
  assert.equal(r.paidNet, 270_000);
  assert.equal(r.approvedNet, 450_000);
  assert.equal(r.paidPct, 27);
});

test("صورت‌وضعیت لغوشده نادیده گرفته می‌شود", () => {
  const r = financialProgress({
    contractAmount: 1_000_000,
    ipcs: [{ WorkflowState: "approved", GrossCumulative: 900_000, Status: "cancelled" }],
  });
  assert.equal(r.financialPct, 0);
});

test("سقف مجاز، درصد مصرف را جدا می‌سنجد", () => {
  const r = financialProgress({
    contractAmount: 1_000_000,
    ceilingPct: 25,
    ipcs: [{ WorkflowState: "approved", GrossCumulative: 1_000_000 }],
  });
  assert.equal(r.financialPct, 100);
  assert.equal(r.ceilingUsedPct, 80, "با سقف ۲۵٪، ظرفیت ۱٬۲۵۰٬۰۰۰ است");
});

test("فراتر رفتن از مبلغ پیمان هشدار می‌دهد", () => {
  const r = financialProgress({
    contractAmount: 1_000_000,
    ipcs: [{ WorkflowState: "approved", GrossCumulative: 1_200_000 }],
  });
  assert.equal(r.financialPct, 120);
  assert.ok(r.warningsFa.some((w) => w.includes("فراتر")));
});

test("مبلغ صفر هشدار می‌دهد نه تقسیم بر صفر", () => {
  const r = financialProgress({ contractAmount: 0, ipcs: [] });
  assert.equal(r.financialPct, 0);
  assert.ok(Number.isFinite(r.financialPct));
  assert.ok(r.warningsFa.some((w) => w.includes("صفر")));
});

/* ══════════════ ۴) فاصلهٔ فیزیکی و مالی ══════════════ */

test("فاصلهٔ کوچک متوازن است", () => {
  const g = progressGap({ physicalPct: 50, financialPct: 52 });
  assert.equal(g.verdict, "balanced");
  assert.equal(g.isMaterial, false);
});

test("پرداخت جلوتر از کار یعنی اضافه‌پرداخت", () => {
  const g = progressGap({ physicalPct: 40, financialPct: 60, contractAmount: 1_000_000 });
  assert.equal(g.verdict, "overpaid");
  assert.equal(g.gapPct, 20);
  assert.equal(g.exposureAmount, 200_000);
  assert.equal(g.verdictFa, PROGRESS_GAP_FA.overpaid);
});

test("کار جلوتر از پرداخت یعنی تأمین مالی از جیب پیمانکار", () => {
  const g = progressGap({ physicalPct: 70, financialPct: 40, contractAmount: 1_000_000 });
  assert.equal(g.verdict, "underpaid");
  assert.equal(g.gapPct, -30);
  assert.equal(g.exposureAmount, 300_000, "قدر مطلق، نه منفی");
  assert.ok(g.messageFa.includes("منابع خود"));
});

test("هر دو صفر یعنی قابل سنجش نیست، نه متوازن", () => {
  const g = progressGap({ physicalPct: 0, financialPct: 0 });
  assert.equal(g.verdict, "unknown");
  assert.equal(g.isMaterial, false);
});

test("آستانه قابل تنظیم است", () => {
  assert.equal(progressGap({ physicalPct: 50, financialPct: 58 }).verdict, "overpaid");
  assert.equal(progressGap({ physicalPct: 50, financialPct: 58, tolerancePct: 10 }).verdict, "balanced");
  assert.equal(PROGRESS_GAP_TOLERANCE_PCT, 5);
});

/* ══════════════ ۵) منحنی S ══════════════ */

test("منحنی از دو مجموعه ساخته و مرتب می‌شود", () => {
  const c = sCurve({
    planned: [
      { periodCode: "1405-03", cumPct: 30 },
      { periodCode: "1405-01", cumPct: 10 },
      { periodCode: "1405-02", cumPct: 20 },
    ],
    actual: [
      { periodCode: "1405-01", cumPct: 8 },
      { periodCode: "1405-02", cumPct: 15 },
    ],
  });
  assert.deepEqual(c.points.map((p) => p.periodCode), ["1405-01", "1405-02", "1405-03"]);
  assert.equal(c.points[1].variancePct, -5);
});

test("دورهٔ آینده واقعی را حمل می‌کند، به صفر نمی‌افتد", () => {
  const c = sCurve({
    planned: [
      { periodCode: "1405-01", cumPct: 10 },
      { periodCode: "1405-02", cumPct: 40 },
      { periodCode: "1405-03", cumPct: 80 },
    ],
    actual: [{ periodCode: "1405-01", cumPct: 12 }],
  });
  assert.equal(c.points[2].isForecast, true);
  assert.equal(c.points[2].actualPct, 12, "افت ساختگی به صفر نداریم");
  assert.equal(c.dataThroughPeriod, "1405-01");
});

test("بدترین دوره فقط از داده‌های واقعی انتخاب می‌شود", () => {
  const c = sCurve({
    planned: [
      { periodCode: "1405-01", cumPct: 10 },
      { periodCode: "1405-02", cumPct: 40 },
      { periodCode: "1405-09", cumPct: 95 },
    ],
    actual: [
      { periodCode: "1405-01", cumPct: 10 },
      { periodCode: "1405-02", cumPct: 25 },
    ],
  });
  assert.equal(c.worstPeriod, "1405-02");
  assert.equal(c.maxLagPct, 15, "دورهٔ آیندهٔ ۹ در انتخاب دخالت نکرد");
  assert.equal(c.latest.periodCode, "1405-02");
});

test("جلو بودن از برنامه، عقب‌ماندگی ثبت نمی‌کند", () => {
  const c = sCurve({
    planned: [{ periodCode: "1405-01", cumPct: 10 }],
    actual: [{ periodCode: "1405-01", cumPct: 18 }],
  });
  assert.equal(c.maxLagPct, 0);
  assert.equal(c.worstPeriod, null);
  assert.equal(c.points[0].variancePct, 8);
});

test("نبود برنامه هشدار می‌دهد", () => {
  const c = sCurve({ planned: [], actual: [{ periodCode: "1405-01", cumPct: 20 }] });
  assert.ok(c.warningsFa.some((w) => w.includes("برنامهٔ زمانی")));
});

test("منحنی خالی هشدار می‌دهد نه خطا", () => {
  const c = sCurve({ planned: [], actual: [] });
  assert.deepEqual(c.points, []);
  assert.equal(c.latest, null);
  assert.ok(c.warningsFa.some((w) => w.includes("داده‌ای")));
});

/* ══════════════ ۶) نقاط عطف ══════════════ */

const NOW = new Date("2026-06-01T00:00:00Z");

test("تأییدشده صد درصد است", () => {
  const r = milestoneRollup({
    rows: [
      { MilestoneNo: 1, WeightPct: 50, Status: "verified", EvidenceDocNo: "D-1" },
      { MilestoneNo: 2, WeightPct: 50, Status: "planned" },
    ],
    now: NOW,
  });
  assert.equal(r.progressPct, 50);
  assert.equal(r.verifiedCount, 1);
  assert.equal(MILESTONE_STATUS_FA.verified, "تأییدشده");
});

test("محقق‌شدهٔ بی‌سند نیم‌شمرده می‌شود", () => {
  const r = milestoneRollup({
    rows: [{ MilestoneNo: 1, WeightPct: 100, Status: "achieved" }],
    now: NOW,
  });
  assert.equal(r.progressPct, 50, "نه صفر نه صد");
  assert.equal(r.missingEvidence, 1);
  assert.ok(r.warningsFa.some((w) => w.includes("نیم‌شمرده")));
});

test("سند، شمارش کامل را باز می‌کند", () => {
  const r = milestoneRollup({
    rows: [{ MilestoneNo: 1, WeightPct: 100, Status: "achieved", EvidenceDocNo: "D-9" }],
    now: NOW,
  });
  assert.equal(r.progressPct, 100);
  assert.equal(r.missingEvidence, 0);
});

test("الزام سند قابل خاموش کردن است", () => {
  const r = milestoneRollup({
    rows: [{ MilestoneNo: 1, WeightPct: 100, Status: "achieved" }],
    requireEvidence: false,
    now: NOW,
  });
  assert.equal(r.progressPct, 100);
});

test("جمع وزن غیر از صد هشدار می‌دهد", () => {
  const r = milestoneRollup({
    rows: [
      { MilestoneNo: 1, WeightPct: 30, Status: "verified", EvidenceDocNo: "D" },
      { MilestoneNo: 2, WeightPct: 40, Status: "planned" },
    ],
    now: NOW,
  });
  assert.equal(r.totalWeightPct, 70);
  assert.ok(r.warningsFa.some((w) => w.includes("۱۰۰")));
  /* درصد نسبت به وزن موجود سنجیده می‌شود، نه نسبت به ۱۰۰ فرضی. */
  assert.ok(Math.abs(r.progressPct - 42.86) < 0.1);
});

test("تأخیر از تاریخ برنامه‌ای شمرده می‌شود", () => {
  const r = milestoneRollup({
    rows: [{ MilestoneNo: 1, WeightPct: 100, PlannedDate: "2026-05-01", Status: "in_progress" }],
    now: NOW,
  });
  assert.equal(r.lateCount, 1);
  assert.equal(r.items[0].lateDays, 31);
  assert.equal(r.items[0].isLate, true);
});

test("نقطهٔ عطف کامل، دیرکرد نمی‌گیرد", () => {
  const r = milestoneRollup({
    rows: [{
      MilestoneNo: 1, WeightPct: 100, PlannedDate: "2026-01-01",
      Status: "verified", EvidenceDocNo: "D",
    }],
    now: NOW,
  });
  assert.equal(r.lateCount, 0, "کارِ تمام‌شده هرچند دیر، دیگر عقب‌افتاده نیست");
});

test("نقطهٔ عطف لغوشده کنار می‌رود", () => {
  const r = milestoneRollup({
    rows: [
      { MilestoneNo: 1, WeightPct: 100, Status: "verified", EvidenceDocNo: "D" },
      { MilestoneNo: 2, WeightPct: 500, Status: "cancelled" },
    ],
    now: NOW,
  });
  assert.equal(r.totalWeightPct, 100);
  assert.equal(r.progressPct, 100);
});

test("درصد جزئی روی محقق‌شده محترم است", () => {
  const r = milestoneRollup({
    rows: [{ MilestoneNo: 1, WeightPct: 100, Status: "in_progress", AchievedPct: 60, EvidenceDocNo: "D" }],
    now: NOW,
  });
  assert.equal(r.progressPct, 60);
});

/* ══════════════ ۷) تصویر یکجا ══════════════ */

test("فهرست‌بها منبع پیشرفت است وقتی مبلغ دارد", () => {
  const s = progressSnapshot({
    periodCode: "1405-06",
    contractAmount: 1_000_000,
    boq: BOQ,
    achieved: [{ BoqItemId: "b", CumPct: 50 }],
    ipcs: [{ WorkflowState: "approved", GrossCumulative: 450_000 }],
    now: NOW,
  });
  assert.equal(s.physicalSource, "boq");
  assert.equal(s.physicalPct, 45);
  assert.equal(s.financialPct, 45);
  assert.equal(s.gap.verdict, "balanced");
});

test("نبود فهرست‌بها، نقاط عطف را منبع می‌کند", () => {
  const s = progressSnapshot({
    contractAmount: 1_000_000,
    contractType: "lump_sum",
    boq: [],
    milestones: [{ MilestoneNo: 1, WeightPct: 100, Status: "verified", EvidenceDocNo: "D" }],
    ipcs: [],
    now: NOW,
  });
  assert.equal(s.physicalSource, "milestone");
  assert.equal(s.physicalPct, 100);
});

test("نبود هر دو منبع، صریح اعلام می‌شود", () => {
  const s = progressSnapshot({ contractAmount: 1_000_000, boq: [], ipcs: [], now: NOW });
  assert.equal(s.physicalSource, "none");
  assert.equal(s.physicalPct, 0);
  assert.ok(s.warningsFa.some((w) => w.includes("پیشرفت فیزیکی صفر فرض شد")));
});

test("فاصلهٔ بااهمیت به بالای هشدارها می‌آید", () => {
  const s = progressSnapshot({
    contractAmount: 1_000_000,
    boq: BOQ,
    achieved: [{ BoqItemId: "a", CumPct: 100 }],
    ipcs: [{ WorkflowState: "approved", GrossCumulative: 600_000 }],
    now: NOW,
  });
  assert.equal(s.physicalPct, 10);
  assert.equal(s.financialPct, 60);
  assert.equal(s.gap.verdict, "overpaid");
  assert.equal(s.warningsFa[0], s.gap.messageFa, "مهم‌ترین یافته اول");
});

test("تصویر یکجا اجزای خود را هم برمی‌گرداند", () => {
  const s = progressSnapshot({
    contractAmount: 1_000_000,
    boq: BOQ,
    ipcs: [],
    milestones: [{ MilestoneNo: 1, WeightPct: 100, Status: "planned" }],
    now: NOW,
  });
  assert.ok(s.physical.lines.length === 2);
  assert.ok(s.financial.contractAmount === 1_000_000);
  assert.ok(s.milestones !== null);
});
