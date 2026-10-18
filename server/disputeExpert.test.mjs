/*
 * تست واحد PMO-CONSTRUCTION-DISPUTE-EXPERT-ENGINE-V1.0 — فقط همین فایل اجرا می‌شود:
 *   node --test server/disputeExpert.test.mjs
 * (اجرای npm test کامل ممنوع است. پیش‌نیاز: npm run build:dispute && npm run build:disputedoc)
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DISPUTE_TABLES,
  DISPUTE_CHILD_TABLES,
  DISPUTE_LLM_CONNECTED,
  DISPUTE_SUBJECTS,
  CASE_STATUSES,
  CASE_STATUS_FA,
  CASE_TRANSITIONS,
  CASE_APPROVAL_TRANSITIONS,
  canTransitionCase,
  caseTransitionNeedsApproval,
  REPORT_SECTIONS,
  REPORT_STATUS_FA,
  REPORT_TRANSITIONS,
  canTransitionReport,
  LINK_KINDS,
  MANAGEMENT_REPORTS,
  buildManagementReport,
  analyzeClaim,
  summarizeCaseFindings,
  renderFindingsLines,
  computeDisputeDashboard,
  validateCaseInput,
  validateChildRow,
  validateClaimAmounts,
  validateLegalReference,
  validateOpinionSources,
  newCaseCode,
  newRecordCode,
} from "./disputeExpertLogic.js";
import {
  DISPUTE_REPORT_CHAPTERS,
  DISPUTE_REPORT_TABLES,
  buildExpertReport,
  sanitizeExpertReportHtml,
} from "./disputeExpertDocLogic.js";

const caseRow = (extra = {}) => ({
  Id: "c1", Code: "DSP-T1", TitleFa: "اختلاف پرداخت صورت‌وضعیت", SubjectCode: "payment_delay",
  Status: "under_review", Priority: "normal", RegistrationDate: "2026-09-01",
  ClaimedAmount: null, ClaimedDelayDays: null, CourtRefFa: "مرجع", ExpertScopeFa: "بررسی", ...extra,
});
const claimRow = (extra = {}) => ({
  Code: "CLM-1", TitleFa: "ادعای تأخیر پرداخت", ClaimantPartyCode: "CON", BasisKind: "both",
  ClaimedAmount: 1_000_000, ClaimedDelayDays: 30, ReviewStatus: "open", ...extra,
});
const evRow = (extra = {}) => ({
  Code: "EVD-1", DocType: "correspondence", TitleFa: "نامه", AuthenticityStatus: "pending",
  SufficiencyStatus: "unchecked", ...extra,
});
const emptyKids = { parties: [], claims: [], responses: [], evidence: [], analyses: [], calculations: [], hearings: [], opinions: [], links: [], deadlines: [] };

test("مدل: ۱۳ جدول، ۱۱ وضعیت، ۲۰ موضوع، LLM متصل نیست", () => {
  assert.equal(DISPUTE_TABLES.length, 13);
  assert.equal(DISPUTE_CHILD_TABLES.length, 12);
  assert.equal(CASE_STATUSES.length, 11);
  assert.equal(DISPUTE_SUBJECTS.length >= 20, true);
  assert.equal(DISPUTE_LLM_CONNECTED, false);
});

test("ماشین‌حالت پرونده: گذار مجاز/غیرمجاز + گذارهای تأییدی", () => {
  assert.equal(canTransitionCase("draft", "registered"), true);
  assert.equal(canTransitionCase("draft", "delivered"), false);
  assert.equal(canTransitionCase("under_review", "delivered"), false);
  assert.equal(canTransitionCase("pending_review", "ready_for_delivery"), true);
  assert.deepEqual(CASE_APPROVAL_TRANSITIONS, ["ready_for_delivery", "delivered", "closed", "archived"]);
  assert.equal(caseTransitionNeedsApproval("delivered"), true);
  assert.equal(caseTransitionNeedsApproval("under_review"), false);
});

test("وضعیت‌های گزارش: draft→in_review→approved→issued؛ پایانهٔ issued/superseded", () => {
  assert.equal(canTransitionReport("draft", "in_review"), true);
  assert.equal(canTransitionReport("draft", "issued"), false);
  assert.equal(canTransitionReport("in_review", "approved"), true);
  assert.equal(canTransitionReport("approved", "issued"), true);
  assert.deepEqual(REPORT_TRANSITIONS.issued, []);
  assert.deepEqual(REPORT_TRANSITIONS.superseded, []);
  assert.equal(Object.keys(REPORT_STATUS_FA).length, 5);
});

test("کدهای تولیدی قالب‌دار؛ با زمان متفاوت یکتا (تکمیل‌کنندهٔ DSP_DUP سرور)", () => {
  const a = newCaseCode(new Date(1000)), b = newCaseCode(new Date(2000));
  assert.notEqual(a, b); // یکتایی زمانی — یگانگی واقعی در سرور با DSP_DUP مستقل چک می‌شود
  assert.match(a, /^DSP-/);
  assert.match(newRecordCode("Reports", new Date(1000)), /^REPO-/);
});

test("اعتبارسنجی پرونده: موضوع استاندارد، تاریخ YYYY-MM-DD، مبالغ نامنفی", () => {
  assert.equal(validateCaseInput({ TitleFa: "x", SubjectCode: "payment_delay" }).ok, true);
  assert.equal(validateCaseInput({ TitleFa: "", SubjectCode: "payment_delay" }).ok, false);
  assert.equal(validateCaseInput({ TitleFa: "x", SubjectCode: "nope" }).ok, false);
  assert.equal(validateCaseInput({ TitleFa: "x", SubjectCode: "other", IncidentDate: "1405/01/01" }).ok, false); // قالب غلط
  assert.equal(validateCaseInput({ TitleFa: "x", SubjectCode: "other", IncidentDate: "2026-10-18" }).ok, true); // قالب درست
  assert.equal(validateCaseInput({ TitleFa: "x", SubjectCode: "other", ClaimedAmount: -5 }).ok, false);
  assert.equal(validateCaseInput({ TitleFa: "x", SubjectCode: "other", ClaimedDelayDays: 1.5 }).ok, false);
});

test("مبالغ لایه‌ای ادعا: بررسی نیازمند مبنا، تأیید نیازمند بررسی + مبنا", () => {
  assert.equal(validateClaimAmounts({ ClaimedAmount: 100 }).ok, true);
  const v1 = validateClaimAmounts({ ReviewedAmount: 50 });
  assert.equal(v1.ok, false);
  const v2 = validateClaimAmounts({ ReviewedAmount: 50, ReviewBasisFa: "مقایسه با سند", ApprovedAmount: 40 });
  assert.equal(v2.ok, false); // تأیید بدون مبنای تأیید
  assert.equal(validateClaimAmounts({ ReviewedAmount: 50, ReviewBasisFa: "x", ApprovedAmount: 40, ApprovedBasisFa: "y" }).ok, true);
  assert.equal(validateClaimAmounts({ ApprovedAmount: 40, ApprovedBasisFa: "y" }).ok, false); // بدون لایهٔ بررسی
});

test("رکورد فرزند: نوع سند/نقش/پیوند از فهرست استاندارد", () => {
  assert.equal(validateChildRow("PmisDisputeEvidence", { DocType: "correspondence", TitleFa: "x" }).ok, true);
  assert.equal(validateChildRow("PmisDisputeEvidence", { DocType: "nope", TitleFa: "x" }).ok, false);
  assert.equal(validateChildRow("PmisDisputeModuleLinks", { LinkKind: "delay_case", TargetCode: "D1", TargetTitleFa: "x" }).ok, true);
  assert.equal(validateChildRow("PmisDisputeModuleLinks", { LinkKind: "random_kind", TargetCode: "D1", TargetTitleFa: "x" }).ok, false);
});

test("ارجاع حقوقی: بدون VerifiedBy احراز نمی‌شود", () => {
  assert.equal(validateLegalReference({ SourceKind: "contract_clause", TitleFa: "بند ۳۰", Verification: "unverified" }).ok, true);
  const v = validateLegalReference({ SourceKind: "contract_clause", TitleFa: "بند ۳۰", Verification: "verified_text" });
  assert.equal(v.ok, false);
  assert.equal(validateLegalReference({ SourceKind: "contract_clause", TitleFa: "بند ۳۰", Verification: "verified_text", VerifiedBy: "u2" }).ok, true);
  assert.equal(validateLegalReference({ SourceKind: "contract_clause", TitleFa: "بند ۳۰", Verification: "neon_verified" }).ok, false); // وضعیت ساختگی
});

test("تحلیل قاعده‌محور ادعا: بند قرارداد ندارد → بحرانی؛ با بند → بدون «تأیید خودکار»", () => {
  const f1 = analyzeClaim(claimRow(), [], [], []);
  assert.equal(f1.some((f) => f.code === "clause-missing" && f.severity === "critical"), true);
  assert.equal(f1.some((f) => f.code === "link-delay-missing"), true); // مبنای زمانی بدون پیوند تأخیر
  const f2 = analyzeClaim(claimRow({ ContractClauseRef: "بند ۵۴" }), [evRow()], [], [{ LinkKind: "delay_case" }, { LinkKind: "loss_case" }]);
  assert.equal(f2.some((f) => f.code === "clause-missing"), false);
  const reg = f2.find((f) => f.code === "clause-registered");
  assert.ok(reg && reg.text.includes("تأیید خودکار نشده")); // صداقت: هیچ بند احراز خودکار نمی‌شود
});

test("تحلیل: لایهٔ تأیید بزرگ‌تر از بررسی → بحرانی؛ مدرک ناموجود → بحرانی", () => {
  const bad = analyzeClaim(claimRow({ ReviewedAmount: 100, ReviewBasisFa: "x", ApprovedAmount: 200, ApprovedBasisFa: "y", ContractClauseRef: "بند ۱" }), [evRow()], [], []);
  assert.equal(bad.some((f) => f.code === "amt-approved-gt-review" && f.severity === "critical"), true);
  const noev = analyzeClaim(claimRow({ ContractClauseRef: "بند ۱" }), [], [], []);
  assert.equal(noev.some((f) => f.code === "ev-none" && f.severity === "critical"), true);
  const rendered = renderFindingsLines(bad);
  assert.match(rendered, /بحرانی/);
});

test("خلاصهٔ پرونده: تأییدشدهٔ صفر = عدم انجام تأیید، نه رد", () => {
  const s = summarizeCaseFindings([claimRow()], [], [], "2026-10-18");
  assert.equal(s.findings.some((f) => f.code === "cc-approve-empty"), true);
  assert.equal(s.findings.every((f) => f.text.includes("اختراع") === false), true); // هیچ منبع ساختگی ثبت نشده
  assert.ok(s.findings.some((f) => f.text.includes("۱۳۰۰"))); // یادآوری قاعدهٔ صداقت در خلاصه
  assert.equal(s.totals.claimed, 1_000_000);
});

test("منابع نظریه: فقط رکورد واقعی پرونده — ناموجود «تأییدنشده»", () => {
  const bad = validateOpinionSources([{ kind: "hearing", code: "H-9" }], { hearing: new Set() });
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /تأییدنشده/);
  const good = validateOpinionSources([{ kind: "hearing", code: "H-9" }], { hearing: new Set(["H-9"]) });
  assert.equal(good.ok, true);
  assert.equal(validateOpinionSources([{ kind: "external_book", code: "x" }], {}).ok, false); // نوع ساختگی
  assert.equal(validateOpinionSources(undefined, {}).ok, true);
  assert.deepEqual(LINK_KINDS.length, 6);
});

test("داشبورد: سه لایهٔ مبلغ جدا و از رکوردهای واقعی", () => {
  const d = computeDisputeDashboard(
    [caseRow(), caseRow({ Id: "c2", Code: "DSP-T2", Status: "closed" })],
    [claimRow(), claimRow({ Code: "CLM-2", ClaimedAmount: 2_000_000, ReviewedAmount: 900_000, ApprovedAmount: 500_000 })],
    [{ Status: "draft" }, { Status: "in_review" }],
    [], "2026-10-18",
  );
  assert.equal(d.totalCases, 2);
  assert.equal(d.openCases, 1);
  assert.equal(d.totalClaimedAmount, 3_000_000);
  assert.equal(d.totalReviewedAmount, 900_000);
  assert.equal(d.totalApprovedAmount, 500_000);
  assert.equal(d.reportsDrafting, 1);
  assert.equal(d.reportsInReview, 1);
});

test("۱۴ گزارش مدیریتی: همه از دادهٔ واقعی و با دادهٔ خالی سازگار", () => {
  assert.equal(MANAGEMENT_REPORTS.length, 14);
  const base = { cases: [], claims: [], parties: [], evidence: [], analyses: [], calculations: [], hearings: [], opinions: [], links: [], deadlines: [], reports: [], today: "2026-10-18" };
  for (const m of MANAGEMENT_REPORTS) {
    const r = buildManagementReport(m.code, base);
    assert.ok(r.heads.length >= 1, m.code);
    assert.ok(Array.isArray(r.rows), m.code);
  }
  const r2 = buildManagementReport("claims_layers", { ...base, claims: [claimRow({ CaseCode: "DSP-T1", ClaimedAmount: 7 })] });
  assert.ok(r2.rows.length === 1 && r2.rows[0][1] === "CLM-1");
  const bad = buildManagementReport("nope_kind", base);
  assert.equal(bad.title, "گزارش نامعتبر");
});

test("ساختار سند: دقیقاً ۲۰ فصل (هم‌تراز REPORT_SECTIONS) و ۳۴ جدول استاندارد", () => {
  assert.equal(DISPUTE_REPORT_CHAPTERS.length, 20);
  assert.equal(DISPUTE_REPORT_TABLES.length, 34);
  assert.deepEqual(DISPUTE_REPORT_CHAPTERS.map((c) => c.key), [...REPORT_SECTIONS]);
  const seen = new Set(DISPUTE_REPORT_TABLES.map((t) => t.no));
  assert.equal(seen.size, 34);
  assert.ok(DISPUTE_REPORT_TABLES.every((t) => t.chapter >= 1 && t.chapter <= 20));
});

const docInput = (over = {}) => ({
  projectId: "c1-p1", caseRow: caseRow(), ...emptyKids,
  parties: [{ Code: "PTY-1", Role: "contractor", NameFa: "پیمانکار نمونه" }, { Code: "PTY-2", Role: "employer", NameFa: "کارفرما نمونه" }],
  claims: [claimRow({ CaseCode: "DSP-T1" })], evidence: [evRow()],
  hearings: [{ Code: "HEAR-1", TitleFa: "جلسه شفاف", MeetingDate: "2026-10-10", MinutesStatus: "draft" }],
  opinions: [{ Code: "OPIN-1", TitleFa: "نظریه نمونه", BodyFa: "متن نظریه", ReviewStatus: "draft", Version: 1 }],
  analyses: [{ Code: "ANA-SUMMARY", TopicFa: "جمع‌بندی", QuestionFa: "سؤال کلیدی", MethodFa: "قاعده‌محور", ApprovalStatus: "draft" }],
  calculations: [{ Code: "CALC-TOTAL-CLAIMED", TitleFa: "جمع مطالبه‌شده", ResultAmount: 1_000_000, Status: "draft" }],
  links: [{ Code: "LINK-1", LinkKind: "delay_case", TargetCode: "DLV-1", TargetTitleFa: "رویداد", Status: "active" }],
  reportRow: { Code: "RPT-1", TitleFa: "گزارش", Version: 3, Status: "draft" },
  reportVersions: [{ Code: "RPT-1", Version: 3, Status: "draft" }],
  generatedAt: "2026-10-18T05:00:00.000Z", generatedBy: "u-test", format: "word",
  ...over,
});

test("گیت تولید: پروندهٔ بدون طرفین یا بدون ادعا در issues گزارش می‌شود", () => {
  const noParties = buildExpertReport(docInput({ parties: [] }));
  assert.ok(noParties.issues.some((x) => x.includes("طرفین")));
  const noClaims = buildExpertReport(docInput({ claims: [] }));
  assert.ok(noClaims.issues.some((x) => x.includes("ادعا")));
  const noCase = buildExpertReport(docInput({ caseRow: {} }));
  assert.ok(noCase.issues.some((x) => x.includes("معتبری")));
});

test("ساخت گزارش: ۲۰ فصل و ۳۴ جدول در بدنه + دادهٔ واقعی رندر می‌شود", () => {
  const doc = buildExpertReport(docInput());
  assert.equal(doc.issues.length, 0);
  const h = doc.body;
  assert.equal((h.match(/<h2>فصل/g) ?? []).length, 20);
  assert.equal((h.match(/<h3>جدول/g) ?? []).length, 34);
  assert.ok(h.includes("اختلاف پرداخت صورت‌وضعیت")); // عنوان پرونده
  assert.ok(h.includes("CLM-1") && h.includes("جلسه شفاف") && h.includes("نظریه نمونه")); // ادعا/جلسه/نظریه
  assert.ok(h.includes("HEAR-1") && h.includes("ANA-SUMMARY"));
});

test("Auto-Cleanup: برچسب‌های الزامی/اختیاری و راهنمای داخلی حذف می‌شوند", () => {
  const doc = buildExpertReport(docInput());
  const raw = doc.body;
  assert.equal(raw.includes("[الزامی]"), false);
  assert.equal(raw.includes("راهنمای داخلی"), false);
  assert.equal(raw.includes("internal-guide"), false);
  assert.equal(raw.includes("data-internal"), false);
  const dirty = '<p class="hl">x</p><mark>y</mark><td style="background:#ffff00;">z</td><section data-internal="true">S</section>';
  const out = sanitizeExpertReportHtml(dirty);
  assert.ok(!out.includes("#ffff00") && !out.includes("<mark") && !out.includes('class="hl"') && !out.includes("S</section>"));
});

test("سند: صداقت حقوقی و عدم صدور رأی + B Nazanin", () => {
  const doc = buildExpertReport(docInput());
  assert.ok(doc.body.includes("B Nazanin"));
  assert.ok(doc.body.includes("بخشنامهٔ ۱۳۰۰"));
  assert.ok(doc.body.includes("صدور نظر نهایی کارشناسی خارج از صلاحیت خودکار سامانه است") || doc.body.includes("رأی"));
  assert.match(doc.filename, /^ExpertReport-DSP-T1-v3\.doc$/);
  const pdfName = buildExpertReport(docInput({ format: "pdf" })).filename;
  assert.match(pdfName, /\.html$/);
});

test("انتخاب فصل‌ها: EnabledSectionsJson سازارکاری فصل‌ها را تنظیم می‌کند", () => {
  const doc = buildExpertReport(docInput({ reportRow: { Code: "RPT-1", TitleFa: "گ", Version: 1, Status: "draft", EnabledSectionsJson: ["cover", "financial_analysis", "expert_conclusion"] } }));
  assert.equal((doc.body.match(/<h2>فصل/g) ?? []).length, 3);
});

test("کلمات ممنوعهٔ جعل منبع در متن سند غایب است", () => {
  const doc = buildExpertReport(docInput());
  for (const needle of ["سوپرکامپیوتر", "اسپارک", "Gemini", "GPT", "ChatGPT"]) {
    assert.ok(!doc.body.includes(needle), needle);
  }
});
