/* آزمون موتور مهندسی و طراحی (ENG / d12) — Deliverable 3 تا 10.
 * مبنا: docs/ENG_Architecture.md — ADR-ENG-01..10.
 * موتور خالص است، پس همهٔ آزمون‌ها «اکنون» را تزریق می‌کنند. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CONTRACT_REVIEW_DAYS,
  DISCIPLINES,
  ENG_DOMAIN_ID,
  ENG_KPI_TARGETS,
  ENG_REPORT_CATALOG,
  ENG_VERSION,
  ROC_STEPS,
  addDays,
  asBuiltStatus,
  clashSummary,
  crsGate,
  crsSummary,
  daysBetween,
  dayNumber,
  deliverableProgress,
  distributeWeights,
  engineeringAlerts,
  engineeringKpis,
  engineeringOverview,
  engineeringProgress,
  getEngReport,
  hasCommercialImpact,
  idcStatus,
  isApprovingCode,
  isAudienceAllowed,
  isRejectingCode,
  planChangeRequests,
  planIfcLocks,
  rejectionCycles,
  reviewAging,
  reviewDaysFor,
  reviewDueDate,
  rocPct,
  tqAging,
  validateMdr,
  vprSummary,
} from "./engLogic.js";

const NOW = "2026-06-01";

const mdr = (over = {}) => ({
  Id: "D1", ProjectId: "p1", DocNo: "PR-DWG-001", TitleFa: "نقشه فرآیند",
  Discipline: "process", DocType: "drawing", PlannedWeight: 100,
  TargetIfaDate: "2026-03-01", TargetIfcDate: "2026-05-01", Status: "in_progress", ...over,
});

const rev = (over = {}) => ({
  Id: "R1", ProjectId: "p1", DeliverableId: "D1", RevCode: "A",
  Purpose: "IFA", IssuedAt: "2026-02-01", Status: "issued", ...over,
});

const cmt = (over = {}) => ({
  Id: "C1", ProjectId: "p1", RevisionId: "R1", CommentNo: 1,
  RaisedBy: "u1", RaisedAt: "2026-02-10", Severity: "minor",
  CommentText: "اصلاح ابعاد", ResponseStatus: "open", ...over,
});

const tq = (over = {}) => ({
  Id: "T1", ProjectId: "p1", Code: "TQ-001", Kind: "TQ", TitleFa: "ابهام تراز",
  Discipline: "civil", RaisedBy: "u2", RaisedAt: "2026-05-01", Status: "open", ...over,
});

/* ── پایه ── */

test("نسخه و دامنه ثابت‌اند", () => {
  assert.equal(ENG_VERSION, "eng-v1");
  assert.equal(ENG_DOMAIN_ID, "d12");
  assert.equal(DISCIPLINES.length, 8);
});

test("ابزار تاریخ ورودی نامعتبر را null می‌دهد نه صفر", () => {
  assert.equal(daysBetween("bad", "2026-01-01"), null);
  assert.equal(daysBetween("2026-01-01", null), null);
  assert.ok(Number.isNaN(dayNumber(undefined)));
  assert.equal(daysBetween("2026-01-01", "2026-01-15"), 14);
  assert.equal(addDays("2026-01-30", 2), "2026-02-01");
  assert.equal(addDays("bad", 2), null);
});

test("فاصلهٔ صفر روز با نامعتبر اشتباه نمی‌شود", () => {
  assert.equal(daysBetween("2026-01-01", "2026-01-01"), 0);
  assert.notEqual(daysBetween("2026-01-01", "2026-01-01"), null);
});

/* ── کدهای بررسی ── */

test("کد ۱ و ۲ تأییدکننده و کد ۳ ردکننده است", () => {
  assert.ok(isApprovingCode("1"));
  assert.ok(isApprovingCode("2"));
  assert.ok(!isApprovingCode("3"));
  assert.ok(!isApprovingCode("4"));
  assert.ok(!isApprovingCode(null));
  assert.ok(isRejectingCode("3"));
  assert.ok(!isRejectingCode("1"));
});

test("کد ۴ نه تأیید است نه رد — صرفاً اطلاع", () => {
  assert.ok(!isApprovingCode("4"));
  assert.ok(!isRejectingCode("4"));
});

/* ── D3: MDR ── */

test("مهلت بررسی نبودش پیش‌فرض ۱۴ روز است", () => {
  assert.equal(reviewDaysFor(null), DEFAULT_CONTRACT_REVIEW_DAYS);
  assert.equal(reviewDaysFor({ ContractReviewDays: null }), 14);
  assert.equal(reviewDaysFor({ ContractReviewDays: 21 }), 21);
  assert.equal(reviewDaysFor({ ContractReviewDays: 0 }), 14, "صفر بی‌معناست، پیش‌فرض می‌گیرد");
});

test("سررسید بررسی از تاریخ صدور مشتق می‌شود", () => {
  assert.equal(reviewDueDate("2026-02-01", null), "2026-02-15");
  assert.equal(reviewDueDate("2026-02-01", { ContractReviewDays: 30 }), "2026-03-03");
});

test("مجموع وزن غیر ۱۰۰ خطاست", () => {
  const r = validateMdr([mdr({ PlannedWeight: 60 }), mdr({ Id: "D2", DocNo: "X-2", PlannedWeight: 30 })]);
  assert.ok(!r.ok);
  assert.ok(r.issues.some((i) => i.code === "ENG-MDR-SUM"));
  assert.equal(r.totalWeight, 90);
});

test("مجموع دقیقاً ۱۰۰ قبول است", () => {
  const r = validateMdr([mdr({ PlannedWeight: 40 }), mdr({ Id: "D2", DocNo: "X-2", PlannedWeight: 60 })]);
  assert.ok(r.ok, JSON.stringify(r.issues));
});

test("شمارهٔ مدرک تکراری خطاست", () => {
  const r = validateMdr([mdr({ PlannedWeight: 50 }), mdr({ Id: "D2", PlannedWeight: 50 })]);
  assert.ok(r.issues.some((i) => i.code === "ENG-MDR-DUP"));
});

test("IFC پیش از IFA خطاست", () => {
  const r = validateMdr([mdr({ TargetIfaDate: "2026-05-01", TargetIfcDate: "2026-03-01" })]);
  assert.ok(r.issues.some((i) => i.code === "ENG-MDR-DATE"));
});

test("وزن صفر یا منفی خطاست", () => {
  const r = validateMdr([mdr({ PlannedWeight: 0 })]);
  assert.ok(r.issues.some((i) => i.code === "ENG-MDR-WEIGHT"));
});

test("دیسیپلین ناشناخته هشدار است نه خطا", () => {
  const r = validateMdr([mdr({ Discipline: "alien" })]);
  const i = r.issues.find((x) => x.code === "ENG-MDR-DISC");
  assert.ok(i);
  assert.equal(i.severity, "warning");
});

test("فهرست خالی خطای مجموع نمی‌دهد", () => {
  const r = validateMdr([]);
  assert.ok(r.ok);
  assert.equal(r.totalWeight, 0);
});

test("توزیع وزن بر پایهٔ نفرساعت است", () => {
  const w = distributeWeights([
    { DocNo: "A", EstimatedManhours: 300 },
    { DocNo: "B", EstimatedManhours: 100 },
  ]);
  assert.equal(w[0].weight, 75);
  assert.equal(w[1].weight, 25);
});

test("نبودِ نفرساعت یعنی توزیع مساوی", () => {
  const w = distributeWeights([{ DocNo: "A" }, { DocNo: "B" }, { DocNo: "C" }, { DocNo: "D" }]);
  assert.ok(w.every((x) => x.weight === 25));
});

/* ── D8: Rule of Credit ── */

test("شش پله با درصدهای مصوب و ترتیب صعودی", () => {
  assert.deepEqual(ROC_STEPS.map((s) => s.pct), [20, 30, 60, 85, 95, 100]);
  assert.deepEqual(ROC_STEPS.map((s) => s.code), ["DRAFT", "IDC", "IFA", "CODE12", "IFC", "ASBUILT"]);
  assert.equal(rocPct("IFC"), 95);
  assert.equal(rocPct("UNKNOWN"), 0);
});

test("بدون ریویژن پیشرفت صفر است", () => {
  const p = deliverableProgress([]);
  assert.equal(p.pct, 0);
  assert.equal(p.step, "NONE");
});

test("یک ریویژن یعنی پلهٔ پیش‌نویس", () => {
  assert.equal(deliverableProgress([rev({ Purpose: "IFR" })]).pct, 20);
});

test("IFA بدون IDC روی ۲۰ می‌ماند — پله جهش نمی‌کند", () => {
  const p = deliverableProgress([rev({ Purpose: "IFA" })]);
  assert.equal(p.pct, 20, "پلهٔ IDC رد نشده، پس IFA باز نمی‌شود");
});

test("IDC سپس IFA یعنی ۶۰", () => {
  const p = deliverableProgress([rev({ Purpose: "IFA", IdcCompletedAt: "2026-02-05" })]);
  assert.equal(p.pct, 60);
  assert.equal(p.step, "IFA");
});

test("کد ۱ یعنی ۸۵", () => {
  const p = deliverableProgress([rev({ Purpose: "IFA", IdcCompletedAt: "2026-02-05", ReviewCode: "1" })]);
  assert.equal(p.pct, 85);
});

test("کد ۳ پله را باز نمی‌کند", () => {
  const p = deliverableProgress([rev({ Purpose: "IFA", IdcCompletedAt: "2026-02-05", ReviewCode: "3" })]);
  assert.equal(p.pct, 60, "کد ۳ یعنی اصلاح مجدد، نه تأیید");
});

test("ADR-ENG-03: IFC بدون فایل شاهد قفل می‌ماند", () => {
  const revs = [
    rev({ Purpose: "IFA", IdcCompletedAt: "2026-02-05", ReviewCode: "1" }),
    rev({ Id: "R2", RevCode: "0", Purpose: "IFC", IssuedAt: "2026-04-01" }),
  ];
  assert.equal(deliverableProgress(revs).pct, 85, "بدون DocumentId پلهٔ ۹۵ باز نمی‌شود");
  assert.equal(deliverableProgress(revs, { requireDocument: false }).pct, 95);
});

test("IFC با فایل شاهد یعنی ۹۵", () => {
  const revs = [
    rev({ Purpose: "IFA", IdcCompletedAt: "2026-02-05", ReviewCode: "2" }),
    rev({ Id: "R2", RevCode: "0", Purpose: "IFC", IssuedAt: "2026-04-01", DocumentId: "doc-9" }),
  ];
  assert.equal(deliverableProgress(revs).pct, 95);
});

test("چون‌ساخت با شاهد یعنی ۱۰۰", () => {
  const revs = [
    rev({ Purpose: "IFA", IdcCompletedAt: "2026-02-05", ReviewCode: "1" }),
    rev({ Id: "R2", RevCode: "0", Purpose: "IFC", IssuedAt: "2026-04-01", DocumentId: "d1" }),
    rev({ Id: "R3", RevCode: "1", Purpose: "AB", IssuedAt: "2026-05-20", DocumentId: "d2" }),
  ];
  const p = deliverableProgress(revs);
  assert.equal(p.pct, 100);
  assert.equal(p.step, "ASBUILT");
});

test("ردیابی شاهد برای هر شش پله برمی‌گردد", () => {
  const p = deliverableProgress([rev({ IdcCompletedAt: "2026-02-05" })]);
  assert.equal(p.trail.length, 6);
  assert.ok(p.trail[0].evidence, "پلهٔ رسیده باید شاهد داشته باشد");
  assert.equal(p.trail[5].evidence, null, "پلهٔ نرسیده شاهد ندارد");
});

/* ── پیشرفت کل ── */

test("پیشرفت وزنی دو مدرک درست جمع می‌شود", () => {
  const rows = [
    { deliverable: mdr({ Id: "A", DocNo: "A", PlannedWeight: 70 }), revisions: [rev({ DeliverableId: "A", Purpose: "IFR" })] },
    { deliverable: mdr({ Id: "B", DocNo: "B", PlannedWeight: 30 }), revisions: [] },
  ];
  const r = engineeringProgress(rows, NOW);
  assert.equal(r.earnedWeight, 14, "۷۰×۲۰٪ = ۱۴");
  assert.equal(r.actualPct, 14);
});

test("SPI در نبودِ برنامه null است نه صفر", () => {
  const rows = [{ deliverable: mdr({ TargetIfaDate: null, TargetIfcDate: null }), revisions: [rev()] }];
  assert.equal(engineeringProgress(rows, NOW).spi, null);
});

test("گذشتن تاریخ IFC یعنی برنامهٔ ۹۵ درصد", () => {
  const rows = [{ deliverable: mdr({ TargetIfcDate: "2026-01-01" }), revisions: [] }];
  const r = engineeringProgress(rows, NOW);
  assert.equal(r.plannedPct, 95);
  assert.equal(r.spi, 0);
});

test("تفکیک دیسیپلین جمع وزن را نگه می‌دارد", () => {
  const rows = [
    { deliverable: mdr({ Id: "A", DocNo: "A", Discipline: "civil", PlannedWeight: 60 }), revisions: [rev({ DeliverableId: "A" })] },
    { deliverable: mdr({ Id: "B", DocNo: "B", Discipline: "piping", PlannedWeight: 40 }), revisions: [] },
  ];
  const r = engineeringProgress(rows, NOW);
  assert.equal(r.byDiscipline.length, 2);
  assert.equal(r.byDiscipline.reduce((s, d) => s + d.weight, 0), 100);
  assert.equal(r.byDiscipline[0].discipline, "civil", "مرتب بر پایهٔ وزن");
});

test("فهرست خالی صفر می‌دهد نه استثنا", () => {
  const r = engineeringProgress([], NOW);
  assert.equal(r.actualPct, 0);
  assert.equal(r.spi, null);
});

/* ── D4: سن بررسی ── */

test("بررسی سررسیدنگذشته on_time است", () => {
  const a = reviewAging([rev({ IssuedAt: "2026-05-25" })], NOW)[0];
  assert.equal(a.status, "on_time");
  assert.ok(a.overdueDays < 0);
});

test("سه روز مانده به سررسید due_soon است", () => {
  const a = reviewAging([rev({ IssuedAt: "2026-05-20" })], NOW)[0];
  assert.equal(a.status, "due_soon");
});

test("گذشتن از مهلت overdue با روز مثبت است", () => {
  const a = reviewAging([rev({ IssuedAt: "2026-04-01" })], NOW)[0];
  assert.equal(a.status, "overdue");
  assert.equal(a.overdueDays, 47, "۱ آوریل + ۱۴ = ۱۵ آوریل؛ تا ۱ ژوئن ۴۷ روز");
});

test("بررسی انجام‌شده تأخیر واقعی می‌گیرد نه جاری", () => {
  const a = reviewAging([rev({ IssuedAt: "2026-02-01", ReviewedAt: "2026-02-20" })], NOW)[0];
  assert.equal(a.status, "reviewed");
  assert.equal(a.overdueDays, 5, "سررسید ۱۵ فوریه، بررسی ۲۰ فوریه");
});

test("مهلت مدرک بر پیش‌فرض اولویت دارد", () => {
  const m = new Map([["D1", mdr({ ContractReviewDays: 30 })]]);
  const a = reviewAging([rev({ IssuedAt: "2026-05-01" })], NOW, m)[0];
  assert.equal(a.dueAt, "2026-05-31");
  assert.equal(a.status, "overdue");
});

test("ReviewDueAt ذخیره‌شده بر محاسبه اولویت دارد", () => {
  const a = reviewAging([rev({ IssuedAt: "2026-02-01", ReviewDueAt: "2026-12-31" })], NOW)[0];
  assert.equal(a.dueAt, "2026-12-31");
  assert.equal(a.status, "on_time");
});

/* ── D4: CRS ── */

test("خلاصهٔ نظرات وضعیت‌ها را تفکیک می‌کند", () => {
  const s = crsSummary([
    cmt({ ResponseStatus: "agreed", ResponseText: "اصلاح شد", VerifiedBy: "n1" }),
    cmt({ Id: "C2", CommentNo: 2, ResponseStatus: "disagreed", ResponseText: "قابل اجرا نیست" }),
    cmt({ Id: "C3", CommentNo: 3 }),
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.agreed, 1);
  assert.equal(s.disagreed, 1);
  assert.equal(s.open, 1);
  assert.equal(s.unanswered, 1);
  assert.equal(s.verified, 1);
  assert.equal(s.closureRate, 33.33);
});

test("نظر باز مانع صدور IFC است", () => {
  const g = crsGate([cmt()]);
  assert.ok(!g.passed);
  assert.ok(g.blockers.some((b) => b.code === "ENG-CRS-OPEN"));
});

test("نظر مورد اختلاف مانع است", () => {
  const g = crsGate([cmt({ ResponseStatus: "disagreed", ResponseText: "خیر", VerifiedBy: "n1" })]);
  assert.ok(!g.passed);
  assert.ok(g.blockers.some((b) => b.code === "ENG-CRS-DISAGREED"));
});

test("نظر بحرانی بدون صحه‌گذاری مانع است", () => {
  const g = crsGate([cmt({ Severity: "critical", ResponseStatus: "agreed", ResponseText: "شد" })]);
  assert.ok(!g.passed);
  assert.ok(g.blockers.some((b) => b.code === "ENG-CRS-UNVERIFIED"));
});

test("نظر جزئی بدون صحه‌گذاری مانع نیست", () => {
  const g = crsGate([cmt({ Severity: "editorial", ResponseStatus: "agreed", ResponseText: "شد" })]);
  assert.ok(g.passed, JSON.stringify(g.blockers));
});

test("بدون نظر دروازه باز است", () => {
  assert.ok(crsGate([]).passed);
});

test("شمارش چرخهٔ دوباره‌کاری فقط کد ۳ را می‌شمارد", () => {
  const n = rejectionCycles([rev({ ReviewCode: "3" }), rev({ ReviewCode: "3" }), rev({ ReviewCode: "1" }), rev({})]);
  assert.equal(n, 2);
});

/* ── D5: IDC و تداخل ── */

const sc = (over = {}) => ({
  Id: "S1", ProjectId: "p1", RevisionId: "R1", Discipline: "civil",
  ReviewerId: "u1", RequestedAt: "2026-02-01", Status: "pending", ...over,
});

test("IDC تکمیل‌شده وقتی همه cleared باشند", () => {
  const s = idcStatus([sc({ Status: "cleared" }), sc({ Id: "S2", Discipline: "piping", Status: "cleared" })], NOW)[0];
  assert.ok(s.complete);
  assert.equal(s.cleared, 2);
});

test("یک اعتراض یعنی IDC ناتمام", () => {
  const s = idcStatus([sc({ Status: "cleared" }), sc({ Id: "S2", Discipline: "piping", Status: "objected" })], NOW)[0];
  assert.ok(!s.complete);
  assert.equal(s.objected, 1);
});

test("بازبینی سررسیدگذشته پرچم می‌خورد", () => {
  const s = idcStatus([sc({ DueAt: "2026-03-01" })], NOW)[0];
  assert.deepEqual(s.overdue, ["civil"]);
});

const clash = (over = {}) => ({
  Id: "K1", ProjectId: "p1", ClashNo: "CL-1", DetectedAt: "2026-03-01",
  SourceTool: "navisworks", DisciplineA: "piping", DisciplineB: "civil",
  Severity: "major", Status: "open", ...over,
});

test("جفت دیسیپلین بدون توجه به ترتیب یکی شمرده می‌شود", () => {
  const s = clashSummary([clash(), clash({ Id: "K2", ClashNo: "CL-2", DisciplineA: "civil", DisciplineB: "piping" })]);
  assert.equal(s.byPair.length, 1);
  assert.equal(s.byPair[0].count, 2);
  assert.equal(s.byPair[0].pair, "civil↔piping");
});

test("نرخ رفع تداخل درست است", () => {
  const s = clashSummary([clash({ Status: "resolved" }), clash({ Id: "K2", ClashNo: "CL-2", Status: "open" })]);
  assert.equal(s.resolutionRate, 50);
  assert.equal(s.open, 1);
});

test("مرحلهٔ بازبینی مدل تفکیک می‌شود", () => {
  const s = clashSummary([clash({ ModelReviewStage: "60" }), clash({ Id: "K2", ClashNo: "CL-2", ModelReviewStage: "60" })]);
  assert.equal(s.byStage["60"], 2);
});

/* ── D6: TQ/FCR و CR خودکار ── */

test("اثر مالی یا زمانی تشخیص داده می‌شود", () => {
  assert.ok(hasCommercialImpact({ CostImpact: 100 }));
  assert.ok(hasCommercialImpact({ TimeImpactDays: 3 }));
  assert.ok(hasCommercialImpact({ CostImpact: -50 }), "کاهش هزینه هم اثر است");
  assert.ok(!hasCommercialImpact({ CostImpact: 0, TimeImpactDays: 0 }));
  assert.ok(!hasCommercialImpact({}));
});

test("سن استعلام بسته نهایی است نه جاری", () => {
  const a = tqAging([tq({ Status: "closed", AnsweredAt: "2026-05-10" })], NOW)[0];
  assert.equal(a.ageDays, 9, "۱ تا ۱۰ مه");
});

test("سن استعلام باز تا امروز است", () => {
  const a = tqAging([tq()], NOW)[0];
  assert.equal(a.ageDays, 31);
});

test("استعلام سررسیدگذشته پرچم می‌خورد", () => {
  const a = tqAging([tq({ DueAt: "2026-05-15" })], NOW)[0];
  assert.ok(a.overdue);
});

test("استعلام بسته سررسیدگذشته پرچم نمی‌خورد", () => {
  const a = tqAging([tq({ Status: "closed", AnsweredAt: "2026-05-20", DueAt: "2026-05-15" })], NOW)[0];
  assert.ok(!a.overdue);
});

test("ADR-ENG-06: فقط استعلام اثرگذار پیش‌نویس CR می‌سازد", () => {
  const p = planChangeRequests([
    tq({ Code: "TQ-1", CostImpact: 5000 }),
    tq({ Code: "TQ-2" }),
  ]);
  assert.equal(p.drafts.length, 1);
  assert.equal(p.drafts[0].sourceCode, "TQ-1");
  assert.deepEqual(p.skippedNoImpact, ["TQ-2"]);
});

test("ADR-ENG-06: استعلام دارای CR دوباره CR نمی‌سازد — ایدمپوتنسی", () => {
  const p = planChangeRequests([tq({ Code: "TQ-1", CostImpact: 5000, LinkedCrCode: "CR-TQ-TQ-1" })]);
  assert.equal(p.drafts.length, 0);
  assert.deepEqual(p.skippedExisting, ["TQ-1"]);
});

test("کد CR قطعی است — اجرای دوباره نتیجهٔ یکسان می‌دهد", () => {
  const rows = [tq({ Code: "TQ-9", Kind: "FCR", TimeImpactDays: 4 })];
  assert.equal(planChangeRequests(rows).drafts[0].code, planChangeRequests(rows).drafts[0].code);
  assert.equal(planChangeRequests(rows).drafts[0].code, "CR-FCR-TQ-9");
});

test("استعلام ردشده CR نمی‌سازد حتی با اثر", () => {
  const p = planChangeRequests([tq({ Code: "TQ-1", CostImpact: 900, Status: "rejected" })]);
  assert.equal(p.drafts.length, 0);
});

test("دلیل CR هر دو اثر را می‌نویسد", () => {
  const d = planChangeRequests([tq({ CostImpact: 1000, TimeImpactDays: 5 })]).drafts[0];
  assert.match(d.reasonFa, /اثر هزینه/);
  assert.match(d.reasonFa, /اثر زمان/);
});

test("وضعیت چون‌ساخت نرخ تکمیل می‌دهد", () => {
  const s = asBuiltStatus([
    tq({ Code: "T1", AsBuiltStatus: "approved" }),
    tq({ Code: "T2", AsBuiltStatus: "pending" }),
    tq({ Code: "T3", AsBuiltStatus: "not_required" }),
  ]);
  assert.equal(s.approved, 1);
  assert.equal(s.completionRate, 50, "یک از دو مورد لازم");
  assert.deepEqual(s.outstanding, ["T2"]);
});

test("نبودِ مورد لازم یعنی صددرصد", () => {
  assert.equal(asBuiltStatus([tq({ AsBuiltStatus: "not_required" })]).completionRate, 100);
});

/* ── D7: VPR ── */

const vp = (over = {}) => ({
  Id: "V1", ProjectId: "p1", VendorDocNo: "VD-1", VendorName: "سازنده الف",
  TitleFa: "نقشه پمپ", Discipline: "mechanical", RevCode: "A",
  ReceivedAt: "2026-04-01", Status: "under_review", ...over,
});

test("مدرک سازنده بدون سفارش خرید پرچم می‌خورد", () => {
  const s = vprSummary([vp(), vp({ Id: "V2", VendorDocNo: "VD-2", PoNo: "PO-9" })], NOW);
  assert.deepEqual(s.unmappedToPo, ["VD-1"]);
});

test("مدرک تأییدشده برای ساخت شمرده می‌شود", () => {
  const s = vprSummary([vp({ Status: "approved_for_mfg" })], NOW);
  assert.equal(s.approvedForMfg, 1);
  assert.equal(s.underReview, 0);
});

test("مدرک بررسی‌نشدهٔ سررسیدگذشته overdue است", () => {
  assert.equal(vprSummary([vp({ DueAt: "2026-05-01" })], NOW).overdue, 1);
});

test("مدرک تمام‌شده overdue نمی‌شود", () => {
  assert.equal(vprSummary([vp({ Status: "approved_for_mfg", DueAt: "2026-05-01" })], NOW).overdue, 0);
});

test("تجمیع بر پایهٔ سازنده مرتب است", () => {
  const s = vprSummary([vp(), vp({ Id: "V2", VendorDocNo: "VD-2" }), vp({ Id: "V3", VendorDocNo: "VD-3", VendorName: "ب" })], NOW);
  assert.equal(s.byVendor[0].vendor, "سازنده الف");
  assert.equal(s.byVendor[0].count, 2);
});

/* ── قفل IFC ── */

const act = (over = {}) => ({ Id: "A1", ProjectId: "p1", Code: "ACT-1", ...over });

test("ADR-ENG-04: فعالیت وابسته به مدرک بدون IFC قفل می‌شود", () => {
  const p = planIfcLocks({
    activities: [act()],
    activityDocLinks: [{ activityId: "A1", deliverableId: "D1" }],
    deliverables: [mdr()],
    revisions: [rev({ Purpose: "IFA" })],
  });
  assert.equal(p.lock.length, 1);
  assert.equal(p.lock[0].docNo, "PR-DWG-001");
  assert.match(p.lock[0].reasonFa, /IFC/);
});

test("ADR-ENG-05: صدور IFC آزادسازی خودکار می‌آورد", () => {
  const p = planIfcLocks({
    activities: [act({ BlockedByDocumentId: "D1" })],
    activityDocLinks: [{ activityId: "A1", deliverableId: "D1" }],
    deliverables: [mdr()],
    revisions: [rev({ Id: "R2", Purpose: "IFC", DocumentId: "doc-1" })],
  });
  assert.equal(p.release.length, 1);
  assert.equal(p.lock.length, 0);
  assert.match(p.release[0].reasonFa, /IFC/);
});

test("IFC بدون فایل شاهد آزاد نمی‌کند", () => {
  const p = planIfcLocks({
    activities: [act()],
    activityDocLinks: [{ activityId: "A1", deliverableId: "D1" }],
    deliverables: [mdr()],
    revisions: [rev({ Id: "R2", Purpose: "IFC" })],
  });
  assert.equal(p.lock.length, 1, "بدون DocumentId هنوز قفل است");
});

test("فعالیت شروع‌شده قفل نمی‌شود — قفل گذشته بی‌معناست", () => {
  const p = planIfcLocks({
    activities: [act({ ActualStart: "2026-01-15" })],
    activityDocLinks: [{ activityId: "A1", deliverableId: "D1" }],
    deliverables: [mdr()],
    revisions: [],
  });
  assert.equal(p.lock.length, 0);
});

test("فعالیت بدون پیوند مدرک دست‌نخورده می‌ماند", () => {
  const p = planIfcLocks({ activities: [act(), act({ Id: "A2" })], activityDocLinks: [], deliverables: [], revisions: [] });
  assert.equal(p.unchanged, 2);
  assert.equal(p.lock.length, 0);
});

test("قفل موجود و درست دوباره اعمال نمی‌شود — ایدمپوتنسی", () => {
  const input = {
    activities: [act({ BlockedByDocumentId: "D1" })],
    activityDocLinks: [{ activityId: "A1", deliverableId: "D1" }],
    deliverables: [mdr()],
    revisions: [],
  };
  const p = planIfcLocks(input);
  assert.equal(p.lock.length, 0);
  assert.equal(p.release.length, 0);
  assert.equal(p.unchanged, 1);
});

/* ── D10: KPI و EWS ── */

const kpiInput = (over = {}) => ({
  progress: engineeringProgress([{ deliverable: mdr(), revisions: [rev()] }], NOW),
  revisions: [rev()],
  aging: [],
  queries: [],
  deliverables: [mdr()],
  asOf: NOW,
  ...over,
});

test("شش شاخص با هدف مصوب برمی‌گردد", () => {
  const k = engineeringKpis(kpiInput());
  assert.equal(k.length, 6);
  assert.deepEqual(k.map((x) => x.code).sort(), Object.keys(ENG_KPI_TARGETS).sort());
  for (const x of k) assert.equal(x.target, ENG_KPI_TARGETS[x.code].target);
});

test("شاخص بدون داده null است نه صفر", () => {
  const k = engineeringKpis(kpiInput({ revisions: [], deliverables: [], progress: engineeringProgress([], NOW) }));
  for (const x of k) {
    if (x.value === null) assert.equal(x.status, "unknown");
  }
  assert.equal(k.find((x) => x.code === "K-ENG-FTA").value, null);
});

test("نرخ تأیید بار اول فقط ریویژن نخست هر مدرک را می‌بیند", () => {
  const revs = [
    rev({ Id: "R1", RevCode: "A", IssuedAt: "2026-02-01", ReviewCode: "3" }),
    rev({ Id: "R2", RevCode: "B", IssuedAt: "2026-03-01", ReviewCode: "1" }),
  ];
  const k = engineeringKpis(kpiInput({ revisions: revs }));
  assert.equal(k.find((x) => x.code === "K-ENG-FTA").value, 0, "نخستین ارسال کد ۳ گرفت");
});

test("نرخ کد ۳ درست محاسبه می‌شود", () => {
  const revs = [rev({ ReviewCode: "3" }), rev({ Id: "R2", ReviewCode: "1" }), rev({ Id: "R3", ReviewCode: "2" }), rev({ Id: "R4", ReviewCode: "1" })];
  assert.equal(engineeringKpis(kpiInput({ revisions: revs })).find((x) => x.code === "K-ENG-REJ").value, 25);
});

test("جهت شاخص در وضعیت رعایت می‌شود", () => {
  const k = engineeringKpis(kpiInput());
  const age = k.find((x) => x.code === "K-ENG-AGE");
  assert.equal(age.direction, "lower");
  assert.equal(k.find((x) => x.code === "K-ENG-SPI").direction, "higher");
});

test("هشدار تأخیر بررسی صادر می‌شود", () => {
  const aging = reviewAging([rev({ IssuedAt: "2026-04-01" })], NOW);
  const a = engineeringAlerts({ aging, revisionsByDeliverable: new Map(), queries: [], lockPlan: { lock: [], release: [], unchanged: 0 }, kpis: [], asOf: NOW });
  const x = a.find((y) => y.code === "EWS-ENG-01");
  assert.ok(x);
  assert.equal(x.severity, "high", "بیش از ۱۴ روز تأخیر یعنی شدید");
});

test("سه بار کد ۳ هشدار دوباره‌کاری مزمن می‌دهد", () => {
  const m = new Map([["D1", [rev({ ReviewCode: "3" }), rev({ Id: "R2", ReviewCode: "3" }), rev({ Id: "R3", ReviewCode: "3" })]]]);
  const a = engineeringAlerts({ aging: [], revisionsByDeliverable: m, queries: [], lockPlan: { lock: [], release: [], unchanged: 0 }, kpis: [], asOf: NOW });
  assert.ok(a.some((x) => x.code === "EWS-ENG-02"));
});

test("دو بار کد ۳ هنوز هشدار نمی‌دهد", () => {
  const m = new Map([["D1", [rev({ ReviewCode: "3" }), rev({ Id: "R2", ReviewCode: "3" })]]]);
  const a = engineeringAlerts({ aging: [], revisionsByDeliverable: m, queries: [], lockPlan: { lock: [], release: [], unchanged: 0 }, kpis: [], asOf: NOW });
  assert.ok(!a.some((x) => x.code === "EWS-ENG-02"));
});

test("استعلام کهنهٔ اثرگذار هشدار شدید می‌دهد", () => {
  const a = engineeringAlerts({
    aging: [], revisionsByDeliverable: new Map(),
    queries: [tq({ RaisedAt: "2026-04-01", CostImpact: 1000 })],
    lockPlan: { lock: [], release: [], unchanged: 0 }, kpis: [], asOf: NOW,
  });
  const x = a.find((y) => y.code === "EWS-ENG-03");
  assert.ok(x);
  assert.equal(x.severity, "high");
});

test("قفل ساخت هشدار می‌دهد", () => {
  const a = engineeringAlerts({
    aging: [], revisionsByDeliverable: new Map(), queries: [],
    lockPlan: { lock: [{ activityId: "A1", documentId: "D1", docNo: "X", reasonFa: "" }], release: [], unchanged: 0 },
    kpis: [], asOf: NOW,
  });
  assert.ok(a.some((x) => x.code === "EWS-ENG-04"));
});

test("SPI پایین هشدار می‌دهد", () => {
  const a = engineeringAlerts({
    aging: [], revisionsByDeliverable: new Map(), queries: [], lockPlan: { lock: [], release: [], unchanged: 0 },
    kpis: [{ code: "K-ENG-SPI", title: { fa: "", en: "" }, value: 0.7, unit: "", target: 0.95, direction: "higher", status: "bad" }],
    asOf: NOW,
  });
  assert.ok(a.some((x) => x.code === "EWS-ENG-05"));
});

test("SPI سالم هشدار نمی‌دهد", () => {
  const a = engineeringAlerts({
    aging: [], revisionsByDeliverable: new Map(), queries: [], lockPlan: { lock: [], release: [], unchanged: 0 },
    kpis: [{ code: "K-ENG-SPI", title: { fa: "", en: "" }, value: 0.98, unit: "", target: 0.95, direction: "higher", status: "good" }],
    asOf: NOW,
  });
  assert.ok(!a.some((x) => x.code === "EWS-ENG-05"));
});

/* ── کاتالوگ گزارش ── */

test("کاتالوگ هفت گزارش با کد یکتا دارد", () => {
  assert.ok(ENG_REPORT_CATALOG.length >= 7);
  const codes = ENG_REPORT_CATALOG.map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const r of ENG_REPORT_CATALOG) {
    assert.ok(r.title.fa && r.title.en);
    assert.ok(r.audiences.length > 0);
  }
});

test("گزارش سازندگان فقط داخلی است", () => {
  assert.ok(isAudienceAllowed("RPT-ENG-VPR", "internal"));
  assert.ok(!isAudienceAllowed("RPT-ENG-VPR", "official"), "قیمت و سازنده به کارفرما نمی‌رود");
});

test("ترانسمیتال فقط رسمی است", () => {
  assert.ok(isAudienceAllowed("RPT-ENG-TRN", "official"));
  assert.ok(!isAudienceAllowed("RPT-ENG-TRN", "internal"));
});

test("کد ناشناخته گزارش undefined می‌دهد", () => {
  assert.equal(getEngReport("RPT-ENG-NOPE"), undefined);
  assert.ok(!isAudienceAllowed("RPT-ENG-NOPE", "internal"));
});

/* ── منظرهٔ یکپارچه ── */

test("منظرهٔ یکپارچه همهٔ بخش‌ها را می‌دهد", () => {
  const o = engineeringOverview({
    deliverables: [mdr()],
    revisions: [rev({ IdcCompletedAt: "2026-02-05", ReviewCode: "1" })],
    comments: [cmt()],
    clashes: [clash()],
    queries: [tq({ CostImpact: 100 })],
    vendorDocs: [vp()],
    asOf: NOW,
  });
  assert.equal(o.version, "eng-v1");
  assert.equal(o.progress.actualPct, 85);
  assert.equal(o.kpis.length, 6);
  assert.equal(o.crs.total, 1);
  assert.equal(o.clash.total, 1);
  assert.equal(o.vpr.total, 1);
  assert.equal(o.openQueries, 1);
  assert.ok(Array.isArray(o.alerts));
});

test("منظرهٔ یکپارچه با دادهٔ خالی نمی‌شکند", () => {
  const o = engineeringOverview({
    deliverables: [], revisions: [], comments: [], clashes: [], queries: [], vendorDocs: [], asOf: NOW,
  });
  assert.equal(o.progress.actualPct, 0);
  assert.equal(o.reviewOverdue, 0);
  assert.equal(o.asBuilt.completionRate, 100);
});
