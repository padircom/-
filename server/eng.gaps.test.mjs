/* آزمون بستن شکاف‌های شناسایی‌شده در سند تحویل نهایی ENG.
 * مرجع: docs/ENG_Final_Delivery_Package.md بخش ۲ (ماتریس شکاف).
 *
 * تمرکز این مجموعه بر «رفتار در مرز» است نه مسیر خوش‌بینانه: هر شکاف با یک
 * آزمون مثبت و دست‌کم یک آزمون منفی پوشش داده می‌شود، چون بیشتر این توابع
 * دربارهٔ چیزی هستند که **نباید** اتفاق بیفتد (هشدار کاذب، ادعای بی‌مبنا،
 * حدس زدن مدرک هدف). */
import test from "node:test";
import assert from "node:assert/strict";
import {
  auditVendorPoRefs,
  eotSeverity,
  engKpiSnapshots,
  engProgressSnapshots,
  engineeringProgress,
  ifcLockCoverage,
  periodCodeOf,
  planDesignNcrActions,
  planEotClaims,
  planRocBackfill,
  reviewAging,
} from "./engLogic.js";

const NOW = "2026-06-01";

const act = (o = {}) => ({ Id: "A1", ProjectId: "p1", Code: "C-1", NameFa: "خاکبرداری", ActualStart: null, ...o });
const mdr = (o = {}) => ({
  Id: "D1", ProjectId: "p1", DocNo: "PR-PID-001", TitleFa: "نقشه", Discipline: "process",
  DocType: "pid", PlannedWeight: 100, TargetIfaDate: "2026-03-01", TargetIfcDate: "2026-05-01",
  Status: "in_progress", ...o,
});
const rev = (o = {}) => ({
  Id: "R1", ProjectId: "p1", DeliverableId: "D1", RevCode: "A", Purpose: "IFA",
  IssuedAt: "2026-02-01", Status: "issued", ...o,
});
const cmt = (o = {}) => ({
  Id: "C1", ProjectId: "p1", RevisionId: "R1", CommentNo: 1, RaisedBy: "c1",
  RaisedAt: "2026-02-10", Severity: "minor", CommentText: "x", ResponseStatus: "open", ...o,
});
const ncr = (o = {}) => ({
  Id: "N1", ProjectId: "p1", Code: "NCR-ENG-001", TitleFa: "خطای طراحی نازل",
  Severity: "major", Discipline: "process", RaisedBy: "qc1", RaisedAt: "2026-04-18",
  DueAt: "2026-05-18", Status: "open", Disposition: "rework", ...o,
});
const vpr = (o = {}) => ({
  Id: "V1", ProjectId: "p1", VendorDocNo: "VD-1", VendorName: "س", TitleFa: "t",
  Discipline: "mechanical", RevCode: "A", ReceivedAt: "2026-04-01", Status: "under_review",
  PoNo: "PO-1", ...o,
});
const kpi = (o = {}) => ({
  code: "K-ENG-SPI", title: { fa: "x", en: "x" }, value: 0.7,
  unit: "", target: 0.95, direction: "higher", status: "bad", ...o,
});

/* ══════ شکاف ۲ — پوشش محافظ IFC ══════ */

test("فعالیت بی‌نگاشت شمرده و افشا می‌شود", () => {
  const c = ifcLockCoverage({
    activities: [act({ Id: "A1" }), act({ Id: "A2", Code: "C-2" })],
    activityDocLinks: [{ activityId: "A1", deliverableId: "D1" }],
  });
  assert.equal(c.totalActivities, 2);
  assert.equal(c.mappedActivities, 1);
  assert.equal(c.unmappedActivities, 1);
  assert.equal(c.unmapped[0].activityId, "A2");
  assert.match(c.unmapped[0].reasonFa, /نگاشت نشده/);
});

test("پوشش کامل هیچ فعالیت بی‌نگاشتی نمی‌دهد", () => {
  const c = ifcLockCoverage({
    activities: [act({ Id: "A1" })],
    activityDocLinks: [{ activityId: "A1", deliverableId: "D1" }],
  });
  assert.equal(c.unmappedActivities, 0);
  assert.equal(c.coveragePct, 100);
});

test("فعالیت شروع‌شده از پوشش کنار می‌رود — قفل گذشته بی‌معناست", () => {
  const c = ifcLockCoverage({
    activities: [act({ Id: "A1", ActualStart: "2026-01-01" })],
    activityDocLinks: [],
  });
  assert.equal(c.totalActivities, 0);
  assert.equal(c.unmappedActivities, 0);
});

test("با includeStarted فعالیت شروع‌شده هم شمرده می‌شود", () => {
  const c = ifcLockCoverage({
    activities: [act({ Id: "A1", ActualStart: "2026-01-01" })],
    activityDocLinks: [],
    onlyNotStarted: false,
  });
  assert.equal(c.totalActivities, 1);
  assert.equal(c.unmappedActivities, 1);
});

test("بدون فعالیت، پوشش null است نه صفر یا صد", () => {
  const c = ifcLockCoverage({ activities: [], activityDocLinks: [] });
  assert.equal(c.coveragePct, null, "پوشش بی‌داده نباید عدد جعلی بدهد");
});

/* ══════ شکاف ۱ — تزریق KPI ══════ */

test("عکس شاخص کلید سه‌جزئی جدول مقصد را می‌سازد", () => {
  const rows = engKpiSnapshots([kpi()], "p1", "2026-06");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ProjectId, "p1");
  assert.equal(rows[0].KpiCode, "K-ENG-SPI");
  assert.equal(rows[0].PeriodCode, "2026-06");
});

test("شاخص بی‌داده null می‌ماند و صفر جعلی نمی‌شود", () => {
  const rows = engKpiSnapshots([kpi({ value: null, status: "unknown" })], "p1", "2026-06");
  assert.equal(rows[0].Value, null, "بی‌داده هرگز نباید صفر شود");
  assert.equal(rows[0].Status, "unknown");
});

test("کد دوره از تاریخ استخراج می‌شود", () => {
  assert.equal(periodCodeOf("2026-06-01"), "2026-06");
  assert.equal(periodCodeOf("2026-12-31"), "2026-12");
});

/* ══════ شکاف ۹ — snapshot دوره‌ای ══════ */

test("عکس پیشرفت ردیف تجمعی ALL می‌سازد", () => {
  const p = engineeringProgress([{ deliverable: mdr(), revisions: [rev()] }], NOW);
  const rows = engProgressSnapshots({
    projectId: "p1", progress: p, deliverables: [mdr()], revisions: [rev()], comments: [], asOf: NOW,
  });
  const all = rows.find((r) => r.Discipline === "ALL");
  assert.ok(all, "ردیف ALL ساخته نشد");
  assert.equal(all.ActualPct, p.actualPct);
  assert.equal(all.SpiEng, p.spi);
});

test("عکس پیشرفت مدرک IFC و نظر باز را می‌شمارد", () => {
  const revs = [rev({ Id: "R1", Purpose: "IFC", DocumentId: "doc1" })];
  const rows = engProgressSnapshots({
    projectId: "p1",
    progress: engineeringProgress([{ deliverable: mdr(), revisions: revs }], NOW),
    deliverables: [mdr()],
    revisions: revs,
    comments: [cmt({ ResponseStatus: "open" }), cmt({ Id: "C2", CommentNo: 2, ResponseStatus: "agreed" })],
    asOf: NOW,
  });
  const all = rows.find((r) => r.Discipline === "ALL");
  assert.equal(all.IfcIssuedCount, 1);
  assert.equal(all.OpenCommentCount, 1, "فقط نظر باز شمرده شود");
});

test("SPI دیسیپلین بدون برنامهٔ مثبت null است نه بی‌نهایت", () => {
  const d = mdr({ TargetIfaDate: "2027-01-01", TargetIfcDate: "2027-06-01" });
  const rows = engProgressSnapshots({
    projectId: "p1",
    progress: engineeringProgress([{ deliverable: d, revisions: [] }], NOW),
    deliverables: [d], revisions: [], comments: [], asOf: NOW,
  });
  for (const r of rows) {
    assert.ok(r.SpiEng === null || Number.isFinite(r.SpiEng), `SPI نامعتبر: ${r.SpiEng}`);
  }
});

test("کد دوره در همهٔ ردیف‌های یک عکس یکسان است", () => {
  const p = engineeringProgress([{ deliverable: mdr(), revisions: [rev()] }], NOW);
  const rows = engProgressSnapshots({
    projectId: "p1", progress: p, deliverables: [mdr()], revisions: [rev()], comments: [], asOf: NOW,
  });
  assert.equal(new Set(rows.map((r) => r.PeriodCode)).size, 1);
});

/* ══════ شکاف ۴ — ادعای EOT ══════ */

const agingOf = (revs, dels = [mdr()]) =>
  reviewAging(revs, NOW, new Map(dels.map((d) => [d.Id, d])));

test("تأخیر بالای آستانه پیش‌نویس ادعا می‌سازد", () => {
  const a = agingOf([rev({ IssuedAt: "2026-01-01", ReviewDueAt: "2026-01-15" })]);
  const plan = planEotClaims({ aging: a, deliverableById: new Map([["D1", mdr()]]) });
  assert.equal(plan.drafts.length, 1);
  assert.match(plan.drafts[0].code, /^EOT-ENG-/);
  assert.ok(plan.drafts[0].overdueDays > 8);
});

test("بررسی به‌موقع هیچ ادعایی نمی‌سازد", () => {
  const a = agingOf([rev({ IssuedAt: "2026-05-28", ReviewDueAt: "2026-06-20" })]);
  const plan = planEotClaims({ aging: a });
  assert.equal(plan.drafts.length, 0);
  assert.equal(plan.skippedOnTime.length, 1);
});

test("تأخیر زیر آستانه رد می‌شود — ادعای یک‌روزه رابطه را می‌سوزاند", () => {
  const a = agingOf([rev({ IssuedAt: "2026-05-01", ReviewDueAt: "2026-05-29" })]);
  const plan = planEotClaims({ aging: a });
  assert.equal(plan.drafts.length, 0);
  assert.equal(plan.skippedBelowThreshold.length, 1);
});

test("آستانه پارامتری است", () => {
  const a = agingOf([rev({ IssuedAt: "2026-05-01", ReviewDueAt: "2026-05-29" })]);
  assert.equal(planEotClaims({ aging: a, minOverdueDays: 1 }).drafts.length, 1);
});

test("ردیف بدون سررسید ادعا نمی‌سازد — مبنای حقوقی ندارد", () => {
  const plan = planEotClaims({
    aging: [{ revisionId: "R9", deliverableId: "D1", issuedAt: "2026-01-01", dueAt: null, overdueDays: 40, status: "overdue", reviewCode: null }],
  });
  assert.equal(plan.drafts.length, 0);
  assert.deepEqual(plan.skippedNoDueDate, ["R9"]);
});

test("کد ادعا ایدمپوتنت است", () => {
  const a = agingOf([rev({ IssuedAt: "2026-01-01", ReviewDueAt: "2026-01-15" })]);
  const one = planEotClaims({ aging: a }).drafts[0].code;
  const two = planEotClaims({ aging: a }).drafts[0].code;
  assert.equal(one, two);
});

test("ماتریس تشدید چهار سطح دارد", () => {
  assert.equal(eotSeverity(3), "info");
  assert.equal(eotSeverity(10), "medium");
  assert.equal(eotSeverity(20), "high");
  assert.equal(eotSeverity(43), "critical");
});

test("ادعاها از شدیدترین مرتب می‌شوند و جمع تمدید درست است", () => {
  const a = agingOf([
    rev({ Id: "R1", IssuedAt: "2026-04-01", ReviewDueAt: "2026-04-20" }),
    rev({ Id: "R2", IssuedAt: "2026-01-01", ReviewDueAt: "2026-01-10" }),
  ]);
  const plan = planEotClaims({ aging: a });
  assert.ok(plan.drafts[0].overdueDays >= plan.drafts[1].overdueDays, "ترتیب نزولی نیست");
  assert.equal(plan.totalExtensionDays, plan.drafts.reduce((s, d) => s + d.extensionDays, 0));
});

test("مستند ادعا شمارهٔ مدرک و مهلت را ذکر می‌کند", () => {
  const a = agingOf([rev({ IssuedAt: "2026-01-01", ReviewDueAt: "2026-01-15" })]);
  const d = planEotClaims({ aging: a, deliverableById: new Map([["D1", mdr()]]) }).drafts[0];
  assert.match(d.evidenceFa, /PR-PID-001/);
  assert.match(d.evidenceFa, /\d+ روز/);
});

/* ══════ شکاف ۵ — Design NCR → DCN ══════ */

test("عدم‌انطباق طراحی پیش‌نویس DCN می‌سازد", () => {
  const plan = planDesignNcrActions({ ncrs: [ncr()], deliverables: [mdr()] });
  assert.equal(plan.drafts.length, 1);
  assert.equal(plan.drafts[0].code, "DCN-NCR-ENG-001");
  assert.equal(plan.drafts[0].deliverableId, "D1");
});

test("عدم‌انطباق اجرایی رد می‌شود", () => {
  const plan = planDesignNcrActions({
    ncrs: [ncr({ Code: "NCR-2026-021", TitleFa: "جوشکاری خارج از رواداری", Disposition: "repair" })],
    deliverables: [mdr()],
  });
  assert.equal(plan.drafts.length, 0);
  assert.equal(plan.skippedNotDesign.length, 1);
});

test("عدم‌انطباق بسته دوباره اقدام نمی‌سازد", () => {
  const plan = planDesignNcrActions({ ncrs: [ncr({ Status: "closed" })], deliverables: [mdr()] });
  assert.equal(plan.drafts.length, 0);
  assert.deepEqual(plan.skippedClosed, ["NCR-ENG-001"]);
});

test("چند مدرک هم‌دیسیپلین یعنی هدف تعیین نمی‌شود — حدس ممنوع", () => {
  const plan = planDesignNcrActions({
    ncrs: [ncr()],
    deliverables: [mdr({ Id: "D1", DocNo: "A" }), mdr({ Id: "D2", DocNo: "B" })],
  });
  assert.equal(plan.drafts[0].deliverableId, null, "با ابهام نباید مدرکی انتخاب شود");
  assert.deepEqual(plan.unmatchedDiscipline, ["NCR-ENG-001"]);
  assert.match(plan.drafts[0].reasonFa, /ایمن نیست/);
});

test("اقدام موجود دوباره ساخته نمی‌شود — ایدمپوتنت", () => {
  const existing = [{
    Id: "T9", ProjectId: "p1", Code: "DCN-NCR-ENG-001", Kind: "DCN", TitleFa: "x",
    Discipline: "process", RaisedBy: "u", RaisedAt: "2026-05-01", Status: "open",
  }];
  const plan = planDesignNcrActions({ ncrs: [ncr()], deliverables: [mdr()], existingQueries: existing });
  assert.equal(plan.drafts.length, 0);
});

test("تشخیص طراحی به واژهٔ فارسی هم پاسخ می‌دهد", () => {
  const plan = planDesignNcrActions({
    ncrs: [ncr({ Code: "NCR-2026-050", TitleFa: "مغایرت نقشه با اجرا", Disposition: "" })],
    deliverables: [mdr()],
  });
  assert.equal(plan.drafts.length, 1);
});

/* ══════ شکاف ۷ — ارجاع PoNo ══════ */

test("مدرک بدون ارجاع سفارش پرچم می‌خورد", () => {
  const a = auditVendorPoRefs({ vendorDocs: [vpr({ PoNo: null })] });
  assert.equal(a.missing, 1);
  assert.equal(a.issues[0].code, "E-ENG-PO-MISSING");
});

test("بدون دفتر سفارش، یتیم کاذب گزارش نمی‌شود", () => {
  const a = auditVendorPoRefs({ vendorDocs: [vpr({ PoNo: "PO-HICHKODAM" })] });
  assert.equal(a.orphan, 0, "بدون مرجع نباید ارجاع را نامعتبر بخواند");
  assert.equal(a.linked, 1);
});

test("با دفتر سفارش، ارجاع نامعتبر یتیم می‌شود", () => {
  const a = auditVendorPoRefs({ vendorDocs: [vpr({ PoNo: "PO-X" })], knownPoNumbers: ["PO-1"] });
  assert.equal(a.orphan, 1);
  assert.equal(a.issues[0].code, "E-ENG-PO-ORPHAN");
});

test("ارجاع معتبر هیچ ایرادی نمی‌سازد", () => {
  const a = auditVendorPoRefs({ vendorDocs: [vpr({ PoNo: "PO-1" })], knownPoNumbers: ["PO-1"] });
  assert.equal(a.issues.length, 0);
  assert.equal(a.linked, 1);
});

test("فاصلهٔ اضافی در شمارهٔ سفارش نادیده گرفته می‌شود", () => {
  const a = auditVendorPoRefs({ vendorDocs: [vpr({ PoNo: "  PO-1  " })], knownPoNumbers: ["PO-1"] });
  assert.equal(a.linked, 1);
  assert.equal(a.orphan, 0);
});

test("رشتهٔ تهی همان نبود ارجاع است", () => {
  const a = auditVendorPoRefs({ vendorDocs: [vpr({ PoNo: "   " })] });
  assert.equal(a.missing, 1);
});

/* ══════ شکاف ۱۱ — پرکردن RocCode ══════ */

test("فعالیت نگاشت‌شده کد پله پیشنهاد می‌گیرد", () => {
  const p = planRocBackfill({
    activities: [act({ Id: "A1" })],
    activityDocLinks: [{ activityId: "A1", deliverableId: "D1" }],
    deliverables: [mdr()],
    revisions: [rev({ IdcCompletedAt: "2026-01-20" })],
  });
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].suggestedRocCode, "IFA");
  assert.equal(p.rows[0].reachedPct, 60);
});

test("فعالیت دارای کد بازنویسی نمی‌شود", () => {
  const p = planRocBackfill({
    activities: [{ ...act({ Id: "A1" }), RocCode: "IFC" }],
    activityDocLinks: [{ activityId: "A1", deliverableId: "D1" }],
    deliverables: [mdr()],
    revisions: [rev()],
  });
  assert.equal(p.rows.length, 0);
  assert.equal(p.alreadySet, 1);
});

test("فعالیت بی‌نگاشت جدا شمرده می‌شود", () => {
  const p = planRocBackfill({
    activities: [act({ Id: "A1" })], activityDocLinks: [], deliverables: [mdr()], revisions: [],
  });
  assert.equal(p.rows.length, 0);
  assert.equal(p.unlinked, 1);
});

test("مدرک بدون ریویژن پله DRAFT می‌گیرد نه خطا", () => {
  const p = planRocBackfill({
    activities: [act({ Id: "A1" })],
    activityDocLinks: [{ activityId: "A1", deliverableId: "D1" }],
    deliverables: [mdr()],
    revisions: [],
  });
  assert.equal(p.rows.length, 1);
  assert.ok(typeof p.rows[0].suggestedRocCode === "string");
});
