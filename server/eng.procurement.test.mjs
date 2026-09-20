/* آزمون چرخهٔ تدارکات مهندسی — شکاف ۳ ماتریس سند تحویل.
 *
 * مرز مالکیت (ADR-ENG-14): MR نزد d12 چون منشأ آن مدرک IFC است؛ PR و PO
 * نزد d5 چون کنترل بودجه آنجاست. این مجموعه بیشتر بر «چه چیزی نباید ساخته
 * شود» تمرکز دارد: درخواست از مدرک تأییدنشده، سفارش با تاریخ حدسی، و
 * کنترل بودجهٔ جعلی روی برآورد ناموجود. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LEAD_TIME_DAYS,
  auditVendorPoRefs,
  planMaterialRequests,
  planPurchaseRequisitions,
  poRegistry,
  procurementAlerts,
  procurementReleaseDate,
} from "./engLogic.js";
import { SCHEMA, MIGRATIONS } from "./sqlLogic.js";

const NOW = "2026-06-01";

const mdr = (o = {}) => ({
  Id: "D1", ProjectId: "p1", DocNo: "PR-PID-001", TitleFa: "نقشه فرآیند",
  Discipline: "process", DocType: "pid", PlannedWeight: 100,
  TargetIfaDate: "2026-03-01", TargetIfcDate: "2026-05-01", Status: "in_progress", ...o,
});
const rev = (o = {}) => ({
  Id: "R1", ProjectId: "p1", DeliverableId: "D1", RevCode: "0", Purpose: "IFC",
  IssuedAt: "2026-04-01", DocumentId: "DOC-1", Status: "issued", ...o,
});
const act = (o = {}) => ({
  Id: "A1", ProjectId: "p1", Code: "C-1", NameFa: "نصب", PlannedStart: "2026-09-01", ActualStart: null, ...o,
});
const mr = (o = {}) => ({
  Id: "M1", ProjectId: "p1", Code: "MR-PR-PID-001", TitleFa: "درخواست کالا",
  Discipline: "process", DocNo: "PR-PID-001", NeedByDate: "2026-09-01",
  ReleaseByDate: "2026-05-20", LeadTimeDays: 90, RaisedBy: "u1",
  RaisedAt: "2026-04-01", Status: "approved", ...o,
});
const vpr = (o = {}) => ({
  Id: "V1", ProjectId: "p1", VendorDocNo: "VD-1", VendorName: "س", TitleFa: "t",
  Discipline: "mechanical", RevCode: "A", ReceivedAt: "2026-04-01",
  Status: "under_review", PoNo: "PO-1", ...o,
});

const linksFor = (activityId = "A1", deliverableId = "D1") => [{ activityId, deliverableId }];

/* ══════ اسکیما ══════ */

test("سه جدول تدارکات با ماژول درست ثبت شده‌اند", () => {
  const byName = new Map(SCHEMA.map((t) => [t.name, t]));
  assert.equal(byName.get("MaterialRequest")?.module, "d12", "MR باید نزد مهندسی بماند");
  assert.equal(byName.get("PurchaseRequisition")?.module, "d5", "PR باید نزد مالی باشد");
  assert.equal(byName.get("PurchaseOrder")?.module, "d5", "PO باید نزد مالی باشد");
});

test("کلید طبیعی هر سه جدول یکتاست", () => {
  const uq = (n, cols) => {
    const t = SCHEMA.find((x) => x.name === n);
    const ix = (t.indexes ?? []).find((i) => i.unique);
    assert.ok(ix, `${n} ایندکس یکتا ندارد`);
    assert.deepEqual(ix.columns, cols, `${n} کلید طبیعی نادرست`);
  };
  uq("MaterialRequest", ["ProjectId", "Code"]);
  uq("PurchaseRequisition", ["ProjectId", "Code"]);
  uq("PurchaseOrder", ["ProjectId", "PoNo"]);
});

test("پیوند بین دامنه‌ای با کلید نرم است نه FK", () => {
  const pr = SCHEMA.find((t) => t.name === "PurchaseRequisition");
  assert.ok(pr.columns.some((c) => c.name === "MrCode"), "ستون MrCode نیست");
  const fks = pr.foreignKeys ?? [];
  assert.ok(!fks.some((f) => f.column === "MrCode"), "MrCode نباید FK سخت داشته باشد");
});

test("مهاجرت 0009 هر سه جدول را می‌سازد", () => {
  const m = MIGRATIONS.find((x) => x.version === "0009");
  assert.ok(m, "مهاجرت 0009 نیست");
  const sql = m.statements.join("\n");
  for (const n of ["MaterialRequest", "PurchaseRequisition", "PurchaseOrder"]) {
    assert.match(sql, new RegExp(n), `${n} در مهاجرت نیست`);
  }
});

test("مهاجرت‌های پیشین دست‌نخورده‌اند", () => {
  assert.ok(MIGRATIONS.some((m) => m.version === "0009"), "مهاجرت چرخهٔ تدارکات حذف شده");
  assert.ok(MIGRATIONS.some((m) => m.version === "0010"), "مهاجرت ماژول پیمان حذف شده");
  assert.ok(MIGRATIONS.some((m) => m.version === "0011"), "مهاجرت پیوند عدم انطباق حذف شده");
  assert.ok(MIGRATIONS.some((m) => m.version === "0012"), "مهاجرت گواهی تحویل حذف شده");
  assert.ok(MIGRATIONS.some((m) => m.version === "0013"), "مهاجرت تفکیک سیستمی حذف شده");
  assert.ok(MIGRATIONS.some((m) => m.version === "0014"), "مهاجرت بستهٔ آزمون حذف شده");
  assert.ok(MIGRATIONS.some((m) => m.version === "0008"), "مهاجرت 0008 حذف شده");
  /* ترتیب و یکتایی به‌جای «آخرین بودن»: ماژول بعدی نباید این آزمون
   * را بشکند. */
  const versions = MIGRATIONS.map((m) => m.version);
  assert.deepEqual([...versions].sort(), versions, "ترتیب مهاجرت‌ها باید صعودی بماند");
  assert.equal(new Set(versions).size, versions.length, "شمارهٔ مهاجرت تکراری");
});

/* ══════ تاریخ آزادسازی ══════ */

test("تاریخ آزادسازی مهلت و حاشیه را عقب می‌برد", () => {
  /* راستی‌آزمایی تقویمی: ۲۰۲۶-۰۹-۰۱ منهای ۱۰۴ روز = ۲۰۲۶-۰۵-۲۰ */
  assert.equal(procurementReleaseDate("2026-09-01", 90, 14), "2026-05-20");
});

test("حاشیهٔ صفر فقط مهلت را کم می‌کند", () => {
  assert.equal(procurementReleaseDate("2026-09-01", 30, 0), "2026-08-02");
});

test("تاریخ نامعتبر خود ورودی را برمی‌گرداند نه NaN", () => {
  assert.equal(procurementReleaseDate("نامعتبر", 30, 0), "نامعتبر");
});

/* ══════ ساخت درخواست کالا ══════ */

test("مدرک IFC-شده درخواست کالا می‌سازد", () => {
  const p = planMaterialRequests({
    deliverables: [mdr()], revisions: [rev()], activities: [act()], activityDocLinks: linksFor(),
  });
  assert.equal(p.drafts.length, 1);
  assert.equal(p.drafts[0].code, "MR-PR-PID-001");
  assert.equal(p.drafts[0].needByDate, "2026-09-01");
});

test("مدرک بدون IFC هرگز درخواست نمی‌سازد — ADR-ENG-15", () => {
  const p = planMaterialRequests({
    deliverables: [mdr()],
    revisions: [rev({ Purpose: "IFA" })],
    activities: [act()], activityDocLinks: linksFor(),
  });
  assert.equal(p.drafts.length, 0);
  assert.deepEqual(p.skippedNotIfc, ["PR-PID-001"]);
});

test("IFC بدون فایل مدرک درخواست نمی‌سازد", () => {
  const p = planMaterialRequests({
    deliverables: [mdr()],
    revisions: [rev({ DocumentId: null })],
    activities: [act()], activityDocLinks: linksFor(),
  });
  assert.equal(p.drafts.length, 0);
  assert.equal(p.skippedNotIfc.length, 1);
});

test("با requireDocument=false قید فایل برداشته می‌شود", () => {
  const p = planMaterialRequests({
    deliverables: [mdr()],
    revisions: [rev({ DocumentId: null })],
    activities: [act()], activityDocLinks: linksFor(),
    requireDocument: false,
  });
  assert.equal(p.drafts.length, 1);
});

test("فعالیت بدون تاریخ برنامه‌ای رد می‌شود — تاریخ حدسی ممنوع", () => {
  const p = planMaterialRequests({
    deliverables: [mdr()], revisions: [rev()],
    activities: [act({ PlannedStart: null })], activityDocLinks: linksFor(),
  });
  assert.equal(p.drafts.length, 0);
  assert.deepEqual(p.skippedNoActivity, ["PR-PID-001"]);
});

test("بدون فعالیت وابسته درخواست ساخته نمی‌شود", () => {
  const p = planMaterialRequests({ deliverables: [mdr()], revisions: [rev()] });
  assert.equal(p.drafts.length, 0);
  assert.equal(p.skippedNoActivity.length, 1);
});

test("زودترین فعالیت تاریخ نیاز را تعیین می‌کند", () => {
  const p = planMaterialRequests({
    deliverables: [mdr()], revisions: [rev()],
    activities: [act({ Id: "A1", PlannedStart: "2026-10-01" }), act({ Id: "A2", PlannedStart: "2026-08-01" })],
    activityDocLinks: [...linksFor("A1"), ...linksFor("A2")],
  });
  assert.equal(p.drafts[0].needByDate, "2026-08-01", "دیرترین تاریخ کالا را دیر می‌رساند");
});

test("درخواست موجود دوباره ساخته نمی‌شود — ایدمپوتنت", () => {
  const p = planMaterialRequests({
    deliverables: [mdr()], revisions: [rev()], activities: [act()], activityDocLinks: linksFor(),
    existingRequests: [mr()],
  });
  assert.equal(p.drafts.length, 0);
  assert.deepEqual(p.skippedExisting, ["PR-PID-001"]);
});

test("مهلت تدارک از دیسیپلین می‌آید", () => {
  const p = planMaterialRequests({
    deliverables: [mdr({ Discipline: "instrument" })], revisions: [rev()],
    activities: [act()], activityDocLinks: linksFor(),
  });
  assert.equal(p.drafts[0].leadTimeDays, DEFAULT_LEAD_TIME_DAYS.instrument);
});

test("مهلت دیسیپلین ناشناخته پیش‌فرض می‌گیرد نه صفر", () => {
  const p = planMaterialRequests({
    deliverables: [mdr({ Discipline: "hvac" })], revisions: [rev()],
    activities: [act()], activityDocLinks: linksFor(),
  });
  assert.ok(p.drafts[0].leadTimeDays > 0, "مهلت صفر یعنی سفارش لحظه‌آخری");
});

test("مهلت قابل بازنویسی است", () => {
  const p = planMaterialRequests({
    deliverables: [mdr()], revisions: [rev()], activities: [act()], activityDocLinks: linksFor(),
    leadTimeByDiscipline: { process: 10 },
  });
  assert.equal(p.drafts[0].leadTimeDays, 10);
});

test("درخواست‌ها بر پایهٔ فوریت سفارش مرتب می‌شوند", () => {
  const p = planMaterialRequests({
    deliverables: [mdr({ Id: "D1", DocNo: "A", Discipline: "civil" }), mdr({ Id: "D2", DocNo: "B", Discipline: "instrument" })],
    revisions: [rev({ DeliverableId: "D1" }), rev({ Id: "R2", DeliverableId: "D2" })],
    activities: [act({ Id: "A1" }), act({ Id: "A2" })],
    activityDocLinks: [...linksFor("A1", "D1"), ...linksFor("A2", "D2")],
  });
  assert.equal(p.drafts.length, 2);
  assert.ok(p.drafts[0].releaseByDate <= p.drafts[1].releaseByDate, "فوری‌ترین باید اول باشد");
});

/* ══════ هشدار پنجرهٔ سفارش ══════ */

test("پنجرهٔ گذشته هشدار بحرانی می‌دهد", () => {
  const a = procurementAlerts({ requests: [mr({ ReleaseByDate: "2026-01-01" })], asOf: NOW });
  assert.equal(a.length, 1);
  assert.equal(a[0].severity, "critical");
  assert.equal(a[0].code, "EWS-ENG-06");
  assert.ok(a[0].slackDays < 0);
});

test("پنجرهٔ نزدیک هشدار بالا می‌دهد", () => {
  const a = procurementAlerts({ requests: [mr({ ReleaseByDate: "2026-06-05" })], asOf: NOW });
  assert.equal(a[0].severity, "high");
});

test("پنجرهٔ دور هیچ هشداری نمی‌دهد", () => {
  const a = procurementAlerts({ requests: [mr({ ReleaseByDate: "2026-12-01" })], asOf: NOW });
  assert.equal(a.length, 0);
});

test("درخواست سفارش‌شده هشدار نمی‌گیرد", () => {
  const a = procurementAlerts({ requests: [mr({ ReleaseByDate: "2026-01-01", Status: "ordered" })], asOf: NOW });
  assert.equal(a.length, 0);
});

test("درخواست متصل به خرید هشدار نمی‌گیرد", () => {
  const a = procurementAlerts({ requests: [mr({ ReleaseByDate: "2026-01-01", LinkedPrCode: "PR-1" })], asOf: NOW });
  assert.equal(a.length, 0);
});

test("درخواست بدون تاریخ آزادسازی هشدار نمی‌سازد", () => {
  const a = procurementAlerts({ requests: [mr({ ReleaseByDate: null })], asOf: NOW });
  assert.equal(a.length, 0);
});

test("هشدارها از بحرانی‌ترین مرتب می‌شوند", () => {
  const a = procurementAlerts({
    requests: [mr({ Code: "M1", ReleaseByDate: "2026-06-05" }), mr({ Code: "M2", ReleaseByDate: "2026-01-01" })],
    asOf: NOW,
  });
  assert.equal(a[0].mrCode, "M2", "کم‌شناوری‌ترین باید اول باشد");
});

/* ══════ درخواست خرید ══════ */

test("درخواست تأییدشده پیش‌نویس خرید می‌سازد", () => {
  const p = planPurchaseRequisitions({ requests: [mr()] });
  assert.equal(p.drafts.length, 1);
  assert.equal(p.drafts[0].mrCode, "MR-PR-PID-001");
});

test("درخواست پیش‌نویس به خرید نمی‌رود", () => {
  const p = planPurchaseRequisitions({ requests: [mr({ Status: "draft" })] });
  assert.equal(p.drafts.length, 0);
  assert.equal(p.skippedDraft.length, 1);
});

test("درخواست متصل دوباره خرید نمی‌سازد — ایدمپوتنت", () => {
  const p = planPurchaseRequisitions({ requests: [mr({ LinkedPrCode: "PR-X" })] });
  assert.equal(p.drafts.length, 0);
  assert.deepEqual(p.skippedLinked, ["MR-PR-PID-001"]);
});

test("کد خرید موجود دوباره ساخته نمی‌شود", () => {
  const p = planPurchaseRequisitions({ requests: [mr()], existingPrCodes: ["PR-MR-PR-PID-001"] });
  assert.equal(p.drafts.length, 0);
});

test("بدون برآورد، بودجه unknown می‌ماند نه ok جعلی", () => {
  const p = planPurchaseRequisitions({ requests: [mr()] });
  assert.equal(p.drafts[0].budgetStatus, "unknown");
  assert.equal(p.drafts[0].estimatedAmount, null, "برآورد ساختگی ممنوع");
});

test("برآورد فراتر از بودجه پرچم می‌خورد ولی وتو نمی‌شود", () => {
  const p = planPurchaseRequisitions({
    requests: [mr()],
    estimates: { "MR-PR-PID-001": 500 },
    costAccountByDiscipline: { process: "CA-1" },
    budgetRemaining: { "CA-1": 100 },
  });
  assert.equal(p.drafts.length, 1, "ENG نباید خرید را وتو کند");
  assert.equal(p.drafts[0].budgetStatus, "over_budget");
  assert.equal(p.overBudget.length, 1);
});

test("برآورد داخل بودجه ok می‌شود", () => {
  const p = planPurchaseRequisitions({
    requests: [mr()],
    estimates: { "MR-PR-PID-001": 50 },
    costAccountByDiscipline: { process: "CA-1" },
    budgetRemaining: { "CA-1": 100 },
  });
  assert.equal(p.drafts[0].budgetStatus, "ok");
  assert.equal(p.overBudget.length, 0);
});

test("برآورد بدون حساب هزینه کنترل نمی‌شود", () => {
  const p = planPurchaseRequisitions({ requests: [mr()], estimates: { "MR-PR-PID-001": 500 } });
  assert.equal(p.drafts[0].budgetStatus, "unknown");
});

test("وضعیت released هم به خرید می‌رود", () => {
  const p = planPurchaseRequisitions({ requests: [mr({ Status: "released" })] });
  assert.equal(p.drafts.length, 1);
});

/* ══════ دفتر سفارش و تکمیل شکاف ۷ ══════ */

test("دفتر سفارش شماره‌های معتبر می‌دهد", () => {
  const reg = poRegistry([{ ProjectId: "p1", PoNo: " PO-1 " }, { ProjectId: "p1", PoNo: "PO-2" }]);
  assert.deepEqual(reg, ["PO-1", "PO-2"], "فاصله باید حذف شود");
});

test("دفتر خالی آرایهٔ خالی می‌دهد نه null", () => {
  assert.deepEqual(poRegistry([]), []);
});

test("با دفتر واقعی، ارجاع نامعتبر یتیم می‌شود", () => {
  const reg = poRegistry([{ ProjectId: "p1", PoNo: "PO-1" }]);
  const a = auditVendorPoRefs({ vendorDocs: [vpr({ PoNo: "PO-9" })], knownPoNumbers: reg });
  assert.equal(a.orphan, 1);
});

test("زنجیرهٔ کامل مدرک تا مدرک سازنده تأیید می‌شود", () => {
  const reg = poRegistry([{ ProjectId: "p1", PoNo: "PO-1" }]);
  const a = auditVendorPoRefs({ vendorDocs: [vpr({ PoNo: "PO-1" })], knownPoNumbers: reg });
  assert.equal(a.linked, 1);
  assert.equal(a.issues.length, 0);
});
