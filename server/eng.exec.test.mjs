/* آزمون گزارش تک‌صفحه‌ای مدیریتی (RPT-ENG-EXEC).
 *
 * خطر اصلی این گزارش «عدد متناقض» است: اگر مدیرعامل در این برگه ۴۹ روز
 * ادعا ببیند و مدیر پیمان در اندپوینت ادعا ۵۱ روز، اعتماد به کل سامانه
 * از بین می‌رود. پس بخش عمدهٔ آزمون، سازگاری عدد به عدد با همان توابعی
 * است که گزارش‌های تفصیلی مصرف می‌کنند.
 *
 * خطر دوم افشای موضع قراردادی است: این گزارش برآورد ادعای قابل مطالبه
 * دارد و نباید به کارفرما برسد. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  ENG_REPORT_CATALOG,
  buildEngReport,
  buildExecutiveReport,
  engReportMeta,
  getEngReport,
  planEotClaims,
  reviewAging,
} from "./engLogic.js";

const CODE = "RPT-ENG-EXEC";

/* ── دادهٔ ساختگی کوچک با اعداد قابل ردیابی دستی ── */
const deliverables = [
  { Id: "D1", ProjectId: "p", DocNo: "PI-001", TitleFa: "الف", Discipline: "piping", DocType: "ISO", PlannedWeight: 50, TargetIfaDate: "2026-01-01", TargetIfcDate: "2026-02-01" },
  { Id: "D2", ProjectId: "p", DocNo: "CV-002", TitleFa: "ب", Discipline: "civil", DocType: "DWG", PlannedWeight: 50, TargetIfaDate: "2026-01-01", TargetIfcDate: "2026-02-01" },
];
const revisions = [
  { Id: "R1", ProjectId: "p", DeliverableId: "D1", RevCode: "A", Purpose: "IFA", IssuedAt: "2026-01-05", IdcCompletedAt: "2026-01-03", ReviewDueAt: "2026-01-19" },
];
const base = {
  deliverables, revisions, comments: [], checks: [], clashes: [],
  queries: [], vendorDocs: [], asOf: "2026-06-01",
};

/* ══════ ثبت در کاتالوگ ══════ */

test("گزارش مدیریتی در کاتالوگ ثبت شده است", () => {
  const def = getEngReport(CODE);
  assert.ok(def, "کد در کاتالوگ نیست");
  assert.equal(def.periodicity, "monthly");
});

test("کاتالوگ حداقل هشت گزارش دارد و کدها یکتاست", () => {
  /* شرط «حداقل» تا افزودن گزارش تازه این آزمون را نشکند. */
  assert.ok(ENG_REPORT_CATALOG.length >= 8);
  const codes = ENG_REPORT_CATALOG.map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length);
});

test("فراداده بدون ساخت بدنه در دسترس است", () => {
  const meta = engReportMeta(CODE);
  assert.ok(meta);
  assert.equal(meta.def.code, CODE);
});

/* ══════ محرمانگی ══════ */

test("گزارش فقط داخلی است و به کارفرما نمی‌رسد", () => {
  /* شامل برآورد ادعای قابل مطالبه است؛ ارسال رسمی آن موضع قراردادی را
   * پیش از طرح ادعا فاش می‌کند. */
  const def = getEngReport(CODE);
  assert.deepEqual(def.audiences, ["internal"]);

  const body = buildEngReport(CODE, base);
  assert.deepEqual(body.audiences, ["internal"]);
  assert.ok(!body.audiences.includes("official"));
});

/* ══════ ساختار یک‌صفحه‌ای ══════ */

test("بدنه ساخته می‌شود و کد درست دارد", () => {
  const body = buildEngReport(CODE, base);
  assert.ok(body);
  assert.equal(body.code, CODE);
  assert.ok(body.sections.length >= 3);
});

test("گزارش هیچ جدول ردیف‌به‌ردیف مدارک ندارد", () => {
  /* اگر فهرست کامل مدارک وارد شود دیگر یک صفحه نیست و تفاوتش با گزارش
   * پیشرفت ماهانه از بین می‌رود. */
  const many = Array.from({ length: 60 }, (_, i) => ({
    Id: `X${i}`, ProjectId: "p", DocNo: `DOC-${i}`, TitleFa: "س", Discipline: "piping",
    DocType: "ISO", PlannedWeight: 1, TargetIfaDate: "2026-01-01", TargetIfcDate: "2026-02-01",
  }));
  const body = buildEngReport(CODE, { ...base, deliverables: many });
  for (const s of body.sections) {
    if (s.kind === "table") {
      assert.ok(s.rows.length <= 8, `بخش «${s.title.fa}» ${s.rows.length} ردیف دارد — از یک صفحه بیرون می‌زند`);
    }
  }
});

test("فهرست نیازمند تصمیم حداکثر سه قلم دارد و بر پایهٔ شدت مرتب است", () => {
  const alerts = [
    { code: "A1", severity: "low", titleFa: "کم", detailFa: "د", subject: "s" },
    { code: "A2", severity: "high", titleFa: "زیاد", detailFa: "د", subject: "s" },
    { code: "A3", severity: "medium", titleFa: "متوسط", detailFa: "د", subject: "s" },
    { code: "A4", severity: "high", titleFa: "زیاد۲", detailFa: "د", subject: "s" },
    { code: "A5", severity: "low", titleFa: "کم۲", detailFa: "د", subject: "s" },
  ];
  const body = buildExecutiveReport({
    progress: { actualPct: 50, plannedPct: 50, spi: 1, earnedWeight: 50, totalWeight: 100, byDiscipline: [], items: [] },
    kpis: [], alerts, aging: [], queries: [], lockPlan: { lock: [], release: [], unchanged: 0 },
    asOf: "2026-06-01",
  });
  const sec = body.sections.find((s) => s.title.fa === "نیازمند تصمیم");
  assert.ok(sec);
  assert.equal(sec.rows.length, 3);
  /* هر سه باید شدت بالا/متوسط باشند نه پایین. */
  assert.deepEqual(sec.rows.map((r) => r.severity), ["بالا", "بالا", "متوسط"]);
});

/* ══════ سازگاری عددی ══════ */

test("روز قابل مطالبه با همان قاعدهٔ پیش‌نویس ادعا شمرده می‌شود", () => {
  /* تأخیر زیر آستانهٔ هشت روز قابل مطالبه نیست. اگر گزارش جمع خام
   * روزهای تأخیر را نشان دهد، عددی می‌دهد که در جلسه قابل دفاع نیست. */
  const aging = [
    { revisionId: "R1", deliverableId: "D1", docNo: "A", status: "overdue", overdueDays: 43, dueAt: "2026-04-19", issuedAt: "2026-04-05", ageDays: 57 },
    { revisionId: "R2", deliverableId: "D2", docNo: "B", status: "overdue", overdueDays: 6, dueAt: "2026-05-20", issuedAt: "2026-05-06", ageDays: 20 },
  ];
  const plan = planEotClaims({ aging, deliverableById: new Map() });
  const expected = plan.drafts.reduce((s, d) => s + d.extensionDays, 0);

  const body = buildExecutiveReport({
    progress: { actualPct: 50, plannedPct: 50, spi: 1, earnedWeight: 50, totalWeight: 100, byDiscipline: [], items: [] },
    kpis: [], alerts: [], aging, queries: [], lockPlan: { lock: [], release: [], unchanged: 0 },
    eotDrafts: plan.drafts, asOf: "2026-06-01",
  });
  const cell = body.sections
    .flatMap((s) => (s.kind === "kpi" ? s.cells : []))
    .find((c) => c.label.fa.includes("قابل مطالبه"));

  assert.ok(cell);
  assert.equal(cell.value, String(expected));
  /* ۴۳ آری، ۶ نه — جمع خام ۴۹ می‌شد. */
  assert.equal(cell.value, "43");
});

test("پیشرفت و SPI با گزارش ماهانه یکی است", () => {
  const exec = buildEngReport(CODE, base);
  const prg = buildEngReport("RPT-ENG-PRG", base);

  const pick = (body, needle) =>
    body.sections.flatMap((s) => (s.kind === "kpi" ? s.cells : [])).find((c) => c.label.fa.includes(needle))?.value;

  assert.equal(pick(exec, "پیشرفت واقعی"), pick(prg, "پیشرفت واقعی"));
  assert.equal(pick(exec, "SPI"), pick(prg, "SPI"));
});

test("قضاوت کلی از SPI پیروی می‌کند", () => {
  const mk = (spi) => buildExecutiveReport({
    progress: { actualPct: 50, plannedPct: 50, spi, earnedWeight: 50, totalWeight: 100, byDiscipline: [], items: [] },
    kpis: [], alerts: [], aging: [], queries: [], lockPlan: { lock: [], release: [], unchanged: 0 },
    asOf: "2026-06-01",
  });
  const verdict = (b) => b.sections[0].cells[0].value;

  assert.equal(verdict(mk(0.70)), "نیازمند مداخلهٔ فوری");
  assert.equal(verdict(mk(0.90)), "نیازمند توجه مدیریتی");
  assert.equal(verdict(mk(1.00)), "در مسیر برنامه");
});

test("هشدار شدت بالا حتی با SPI سالم توجه مدیریتی می‌خواهد", () => {
  const body = buildExecutiveReport({
    progress: { actualPct: 99, plannedPct: 99, spi: 1, earnedWeight: 99, totalWeight: 100, byDiscipline: [], items: [] },
    kpis: [],
    alerts: [{ code: "A", severity: "high", titleFa: "ت", detailFa: "د", subject: "s" }],
    aging: [], queries: [], lockPlan: { lock: [], release: [], unchanged: 0 },
    asOf: "2026-06-01",
  });
  assert.equal(body.sections[0].cells[0].value, "نیازمند توجه مدیریتی");
});

test("اثر استعلام باز فقط استعلام‌های باز را می‌شمارد", () => {
  const queries = [
    { Id: "1", Code: "T1", Status: "open", CostImpact: 100, TimeImpactDays: 2 },
    { Id: "2", Code: "T2", Status: "closed", CostImpact: 900, TimeImpactDays: 9 },
    { Id: "3", Code: "T3", Status: "answered", CostImpact: 500, TimeImpactDays: 5 },
  ];
  const body = buildExecutiveReport({
    progress: { actualPct: 50, plannedPct: 50, spi: 1, earnedWeight: 50, totalWeight: 100, byDiscipline: [], items: [] },
    kpis: [], alerts: [], aging: [], queries, lockPlan: { lock: [], release: [], unchanged: 0 },
    asOf: "2026-06-01",
  });
  const cells = body.sections.flatMap((s) => (s.kind === "kpi" ? s.cells : []));
  /* بستهٔ ۹۰۰ و پاسخ‌دادهٔ ۵۰۰ نباید شمرده شوند. */
  assert.equal(cells.find((c) => c.label.fa.includes("اثر زمانی")).value, "2 روز");
});

test("نبود دیسیپلین عقب‌مانده با متن صریح اعلام می‌شود نه جدول خالی", () => {
  const body = buildExecutiveReport({
    progress: {
      actualPct: 100, plannedPct: 100, spi: 1, earnedWeight: 100, totalWeight: 100,
      byDiscipline: [{ discipline: "piping", actualPct: 100, plannedPct: 100, weight: 100, count: 1 }],
      items: [],
    },
    kpis: [], alerts: [], aging: [], queries: [], lockPlan: { lock: [], release: [], unchanged: 0 },
    asOf: "2026-06-01",
  });
  const sec = body.sections.find((s) => s.title.fa.includes("عقب از برنامه"));
  assert.equal(sec.kind, "text");
  assert.match(sec.body.fa, /هیچ دیسیپلینی/);
});

test("فعالیت متوقف از نقشهٔ قفل خوانده می‌شود", () => {
  const body = buildExecutiveReport({
    progress: { actualPct: 50, plannedPct: 50, spi: 1, earnedWeight: 50, totalWeight: 100, byDiscipline: [], items: [] },
    kpis: [], alerts: [], aging: [], queries: [],
    lockPlan: { lock: [{ activityId: "A1" }, { activityId: "A2" }], release: [], unchanged: 3 },
    asOf: "2026-06-01",
  });
  const cell = body.sections
    .flatMap((s) => (s.kind === "kpi" ? s.cells : []))
    .find((c) => c.label.fa.includes("متوقف"));
  assert.equal(cell.value, "2");
  assert.equal(cell.tone, "warn");
});

test("تأخیر بررسی از همان تابع سنجش کهنگی می‌آید", () => {
  /* راستی‌آزمایی اینکه ورودی aging گزارش با تابع مرجع سازگار است. */
  const delById = new Map(deliverables.map((d) => [d.Id, d]));
  const aging = reviewAging(revisions.filter((r) => r.Purpose === "IFA"), "2026-06-01", delById);
  assert.ok(aging.length > 0);
  assert.ok(aging.every((a) => typeof a.revisionId === "string"));
});
