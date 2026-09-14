/* آزمون سازندگان گزارش A4 سه‌لوگو ماژول مهندسی — Deliverable 15 (G-ENG-01).
 * مبنا: docs/ENG_Architecture.md بخش ۲۶.
 * قرارداد کلیدی: بدنهٔ EngReportBody باید بدون تبدیل میانی توسط سریال‌سازهای
 * rpt-v1 مصرف شود، پس هر آزمون خروجی را واقعاً از همان موتور عبور می‌دهد. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  ENG_REPORT_CATALOG,
  buildCrsReport,
  buildEngReport,
  buildIdcReport,
  buildMdrStatusReport,
  buildProgressReport,
  buildTqFcrReport,
  buildTransmittalReport,
  buildVprReport,
  crsGate,
  crsSummary,
  engReportMeta,
  engineeringKpis,
  engineeringProgress,
  isAudienceAllowed,
} from "./engLogic.js";
import { documentNumber, toCsv, toExcelHtml, toPrintHtml, toWordHtml, validateLetterhead } from "./rptLogic.js";

const NOW = "2026-06-01";

const mdr = (o = {}) => ({
  Id: "D1", ProjectId: "p1", DocNo: "PR-PID-001", TitleFa: "نقشه جریان فرآیند",
  Discipline: "process", DocType: "pid", PlannedWeight: 100,
  TargetIfaDate: "2026-03-01", TargetIfcDate: "2026-05-01", Status: "in_progress", ...o,
});
const rev = (o = {}) => ({
  Id: "R1", ProjectId: "p1", DeliverableId: "D1", RevCode: "A",
  Purpose: "IFA", IssuedAt: "2026-02-01", Status: "issued", ...o,
});
const cmt = (o = {}) => ({
  Id: "C1", ProjectId: "p1", RevisionId: "R1", CommentNo: 1, RaisedBy: "client1",
  RaisedAt: "2026-02-10", Severity: "minor", CommentText: "اصلاح ابعاد", ResponseStatus: "open", ...o,
});
const tq = (o = {}) => ({
  Id: "T1", ProjectId: "p1", Code: "TQ-001", Kind: "TQ", TitleFa: "ابهام تراز",
  Discipline: "civil", RaisedBy: "site1", RaisedAt: "2026-05-01", Status: "open", ...o,
});
const vp = (o = {}) => ({
  Id: "V1", ProjectId: "p1", VendorDocNo: "VD-1", VendorName: "سازنده الف", TitleFa: "نقشه پمپ",
  Discipline: "mechanical", RevCode: "A", ReceivedAt: "2026-04-01", Status: "under_review", ...o,
});
const sc = (o = {}) => ({
  Id: "S1", ProjectId: "p1", RevisionId: "R1", Discipline: "civil",
  ReviewerId: "u1", RequestedAt: "2026-02-01", Status: "pending", ...o,
});
const clash = (o = {}) => ({
  Id: "K1", ProjectId: "p1", ClashNo: "CL-1", DetectedAt: "2026-03-01", SourceTool: "navisworks",
  DisciplineA: "piping", DisciplineB: "civil", Severity: "major", Status: "open", ...o,
});

const LH = {
  projectName: "پروژه نمونه",
  projectCode: "OG-2401",
  contractNo: "C-1404-118",
  contractor: { name: "پیمانکار نمونه", logoText: "پیمانکار", role: { fa: "پیمانکار", en: "Contractor" } },
  client: { name: "کارفرمای نمونه", logoText: "کارفرما", role: { fa: "کارفرما", en: "Client" } },
  consultant: { name: "مشاور نمونه", logoText: "مشاور", role: { fa: "مشاور", en: "Consultant" } },
  docNo: "OG-2401-RPT-ENG-0001-R00",
  revision: "R00",
  issueDate: "2026-06-01",
  periodLabel: "خرداد ۱۴۰۵",
  classification: "confidential",
  distribution: ["مدیر پروژه", "مدیر مهندسی"],
  preparedBy: "واحد مهندسی",
  approvedBy: "مدیر مهندسی",
};

const revMap = (revs) => {
  const m = new Map();
  for (const r of revs) {
    const a = m.get(r.DeliverableId) ?? [];
    a.push(r);
    m.set(r.DeliverableId, a);
  }
  return m;
};

const fullInput = (o = {}) => ({
  deliverables: [mdr()],
  revisions: [rev({ IdcCompletedAt: "2026-01-28", ReviewCode: "1" })],
  comments: [cmt()],
  checks: [sc()],
  clashes: [clash()],
  queries: [tq({ CostImpact: 5000 })],
  vendorDocs: [vp()],
  asOf: NOW,
  ...o,
});

/* ── شکل مشترک همهٔ بدنه‌ها ── */

const ALL_CODES = () => ENG_REPORT_CATALOG.map((r) => r.code);

test("هر کد کاتالوگ سازندهٔ کارآمد دارد", () => {
  for (const code of ALL_CODES()) {
    const body = buildEngReport(code, fullInput());
    assert.ok(body, `${code} سازنده ندارد`);
    assert.equal(body.code, code);
  }
});

test("کد ناشناخته null می‌دهد نه استثنا", () => {
  assert.equal(buildEngReport("RPT-ENG-NOPE", fullInput()), null);
  assert.equal(engReportMeta("RPT-ENG-NOPE"), null);
});

test("هر بدنه عنوان دوزبانه و مبدأ داده دارد", () => {
  for (const code of ALL_CODES()) {
    const b = buildEngReport(code, fullInput());
    assert.ok(b.title.fa && b.title.en, `${code} عنوان دوزبانه ندارد`);
    assert.match(b.sourceModule, /d12/, `${code} مبدأ داده را اعلام نکرده`);
    assert.ok(b.sections.length > 0, `${code} بخشی ندارد`);
  }
});

test("مخاطبان بدنه با کاتالوگ یکی است", () => {
  for (const def of ENG_REPORT_CATALOG) {
    const b = buildEngReport(def.code, fullInput());
    assert.deepEqual(b.audiences, def.audiences, `${def.code} مخاطب ناهمخوان`);
  }
});

test("دوره‌ای بودن به واژگان rpt-v1 نگاشت می‌شود", () => {
  for (const def of ENG_REPORT_CATALOG) {
    const b = buildEngReport(def.code, fullInput());
    assert.notEqual(b.periodicity, "on_demand", `${def.code}: on_demand باید adhoc شود`);
    assert.ok(["daily", "weekly", "biweekly", "monthly", "quarterly", "milestone", "adhoc"].includes(b.periodicity));
    assert.equal(engReportMeta(def.code).periodicity, b.periodicity);
  }
});

test("هر ستون جدول کلید و عنوان دوزبانه دارد", () => {
  for (const code of ALL_CODES()) {
    for (const s of buildEngReport(code, fullInput()).sections) {
      if (s.kind !== "table") continue;
      assert.ok(s.columns.length > 0, `${code}/${s.title.fa} ستون ندارد`);
      for (const c of s.columns) {
        assert.ok(c.key, `${code}: ستون بدون کلید`);
        assert.ok(c.title.fa && c.title.en, `${code}.${c.key} عنوان دوزبانه ندارد`);
      }
    }
  }
});

test("هر ردیف فقط کلیدهای اعلام‌شده را دارد", () => {
  for (const code of ALL_CODES()) {
    for (const s of buildEngReport(code, fullInput()).sections) {
      if (s.kind !== "table") continue;
      const keys = new Set(s.columns.map((c) => c.key));
      for (const r of s.rows) {
        for (const k of Object.keys(r)) {
          assert.ok(keys.has(k), `${code}/${s.title.fa}: کلید ناشناخته ${k}`);
        }
      }
    }
  }
});

test("سلول KPI برچسب دوزبانه و مقدار رشته‌ای دارد", () => {
  for (const code of ALL_CODES()) {
    for (const s of buildEngReport(code, fullInput()).sections) {
      if (s.kind !== "kpi") continue;
      for (const c of s.cells) {
        assert.ok(c.label.fa && c.label.en, `${code}: سلول بدون برچسب دوزبانه`);
        assert.equal(typeof c.value, "string", `${code}.${c.label.fa}: مقدار باید رشته باشد`);
        if (c.tone) assert.ok(["good", "warn", "bad"].includes(c.tone));
      }
    }
  }
});

test("هیچ سلول یا ردیفی undefined خام نشان نمی‌دهد", () => {
  for (const code of ALL_CODES()) {
    for (const s of buildEngReport(code, fullInput()).sections) {
      if (s.kind === "kpi") {
        for (const c of s.cells) assert.ok(!/undefined|null|NaN/.test(c.value), `${code}: ${c.value}`);
      }
      if (s.kind === "table") {
        for (const r of s.rows) {
          for (const [k, v] of Object.entries(r)) {
            assert.ok(v !== undefined && v !== null, `${code}/${k}: مقدار خالی`);
            assert.ok(!/^(undefined|null|NaN)$/.test(String(v)), `${code}/${k}: ${v}`);
          }
        }
      }
    }
  }
});

/* ── عبور واقعی از سریال‌سازهای rpt-v1 ── */

test("هر بدنه از toPrintHtml بی‌استثنا عبور می‌کند", () => {
  for (const code of ALL_CODES()) {
    const b = buildEngReport(code, fullInput());
    const aud = b.audiences.includes("official") ? "official" : "internal";
    const html = toPrintHtml(b, LH, aud, "fa");
    assert.ok(html.length > 200, `${code}: HTML کوتاه`);
    assert.match(html, /@page/, `${code}: قواعد چاپ A4 ندارد`);
    assert.ok(html.includes(b.title.fa), `${code}: عنوان در خروجی نیست`);
  }
});

test("گزارش رسمی سه لوگو و شماره سند را چاپ می‌کند", () => {
  const b = buildEngReport("RPT-ENG-TRN", fullInput());
  const html = toPrintHtml(b, LH, "official", "fa");
  for (const s of [LH.contractor.logoText, LH.client.logoText, LH.consultant.logoText, LH.docNo]) {
    assert.ok(html.includes(s), `«${s}» در سربرگ رسمی نیست`);
  }
});

test("هر بدنه از toCsv و toWordHtml و toExcelHtml عبور می‌کند", () => {
  for (const code of ALL_CODES()) {
    const b = buildEngReport(code, fullInput());
    const aud = b.audiences.includes("official") ? "official" : "internal";
    assert.ok(toCsv(b, "fa").length > 10, `${code}: CSV خالی`);
    assert.ok(toWordHtml(b, LH, aud, "fa").length > 200, `${code}: Word خالی`);
    assert.ok(toExcelHtml(b, LH, "fa").length > 100, `${code}: Excel خالی`);
  }
});

test("خروجی انگلیسی هم ساخته می‌شود", () => {
  const b = buildEngReport("RPT-ENG-MDR", fullInput());
  const html = toPrintHtml(b, LH, "internal", "en");
  assert.ok(html.includes(b.title.en), "عنوان انگلیسی در خروجی نیست");
});

test("بدنه با دادهٔ خالی هم سریال می‌شود", () => {
  const empty = { deliverables: [], revisions: [], comments: [], checks: [], clashes: [], queries: [], vendorDocs: [], asOf: NOW };
  for (const code of ALL_CODES()) {
    const b = buildEngReport(code, empty);
    assert.ok(b, `${code} با دادهٔ خالی null داد`);
    const aud = b.audiences.includes("official") ? "official" : "internal";
    assert.ok(toPrintHtml(b, LH, aud, "fa").length > 100, `${code}: HTML خالی`);
  }
});

/* ── محتوای هر گزارش ── */

test("ماتریس MDR ستون پیشرفت و پله دارد", () => {
  const b = buildMdrStatusReport({ deliverables: [mdr()], revisionsByDeliverable: revMap([rev({ IdcCompletedAt: "2026-01-28" })]) });
  const tbl = b.sections.find((s) => s.kind === "table");
  const keys = tbl.columns.map((c) => c.key);
  for (const k of ["docNo", "weight", "step", "pct"]) assert.ok(keys.includes(k), `ستون ${k} نیست`);
  assert.equal(tbl.rows[0].pct, 60, "پیشرفت باید از پله مشتق شود");
});

test("مغایرت وزن در ماتریس MDR بخش جدا می‌سازد", () => {
  const b = buildMdrStatusReport({ deliverables: [mdr({ PlannedWeight: 40 })], revisionsByDeliverable: new Map() });
  const issues = b.sections.find((s) => s.kind === "table" && s.title.fa.includes("مغایرت"));
  assert.ok(issues, "بخش مغایرت ساخته نشد");
  assert.ok(issues.rows.some((r) => r.code === "ENG-MDR-SUM"));
});

test("فهرست سالم بخش مغایرت نمی‌سازد", () => {
  const b = buildMdrStatusReport({ deliverables: [mdr()], revisionsByDeliverable: new Map() });
  assert.ok(!b.sections.some((s) => s.title.fa.includes("مغایرت")));
});

test("ترانسمیتال فقط ریویژن‌های دارای شماره را می‌آورد", () => {
  const revs = [rev({ Id: "R1", TransmittalId: "TRN-1" }), rev({ Id: "R2", RevCode: "B" })];
  const b = buildTransmittalReport({ revisions: revs, deliverableById: new Map([["D1", mdr()]]) });
  const tbl = b.sections.find((s) => s.kind === "table");
  assert.equal(tbl.rows.length, 1, "ریویژن بدون ترانسمیتال نباید بیاید");
  assert.equal(tbl.rows[0].transmittal, "TRN-1");
});

test("ترانسمیتال با شماره مشخص فقط همان را می‌آورد", () => {
  const revs = [rev({ Id: "R1", TransmittalId: "TRN-1" }), rev({ Id: "R2", RevCode: "B", TransmittalId: "TRN-2" })];
  const b = buildTransmittalReport({ revisions: revs, deliverableById: new Map([["D1", mdr()]]), transmittalId: "TRN-2" });
  assert.equal(b.sections.find((s) => s.kind === "table").rows.length, 1);
  assert.match(b.title.fa, /TRN-2/);
});

test("ترانسمیتال فقط مخاطب رسمی دارد", () => {
  assert.deepEqual(buildTransmittalReport({ revisions: [], deliverableById: new Map() }).audiences, ["official"]);
  assert.ok(!isAudienceAllowed("RPT-ENG-TRN", "internal"));
});

test("شیت CRS نتیجهٔ دروازه را متنی اعلام می‌کند", () => {
  const b = buildCrsReport({ comments: [cmt()] });
  const txt = b.sections.find((s) => s.kind === "text");
  assert.ok(txt, "بخش نتیجهٔ دروازه نیست");
  assert.match(txt.body.fa, /مجاز نیست/, "نظر باز باید مانع اعلام شود");
});

test("شیت CRS با نظرات بسته دروازه را باز اعلام می‌کند", () => {
  const ok = cmt({ ResponseStatus: "agreed", ResponseText: "شد", VerifiedBy: "n1", Severity: "editorial" });
  const b = buildCrsReport({ comments: [ok] });
  assert.match(b.sections.find((s) => s.kind === "text").body.fa, /مانعی/);
});

test("شیت CRS خلاصهٔ محاسبه‌شده را بازاستفاده می‌کند", () => {
  const rows = [cmt(), cmt({ Id: "C2", CommentNo: 2, ResponseStatus: "agreed", ResponseText: "x", VerifiedBy: "n" })];
  const s = crsSummary(rows);
  const b = buildCrsReport({ comments: rows, summary: s, gate: crsGate(rows) });
  const kpi = b.sections.find((x) => x.kind === "kpi");
  assert.equal(kpi.cells.find((c) => c.label.fa === "کل نظر").value, String(s.total));
});

test("شیت CRS فقط ریویژن خواسته‌شده را فیلتر می‌کند", () => {
  const rows = [cmt({ RevisionId: "R1" }), cmt({ Id: "C2", CommentNo: 2, RevisionId: "R2" })];
  const b = buildCrsReport({ comments: rows, revisionId: "R2" });
  assert.equal(b.sections.find((s) => s.kind === "table").rows.length, 1);
});

test("دفتر TQ پیش‌نویس CR را بخش جدا می‌کند", () => {
  const b = buildTqFcrReport({ queries: [tq({ Kind: "FCR", CostImpact: 9000 })], asOf: NOW });
  const draft = b.sections.find((s) => s.kind === "table" && s.title.fa.includes("پیش‌نویس"));
  assert.ok(draft, "بخش پیش‌نویس CR ساخته نشد");
  assert.equal(draft.rows.length, 1);
  assert.match(draft.note.fa, /ایدمپوتنت/, "قید ایدمپوتنسی باید مستند شود");
});

test("استعلام بدون اثر بخش پیش‌نویس نمی‌سازد", () => {
  const b = buildTqFcrReport({ queries: [tq()], asOf: NOW });
  assert.ok(!b.sections.some((s) => s.title.fa.includes("پیش‌نویس")));
});

test("دفتر TQ استعلام سررسیدگذشته را علامت می‌زند", () => {
  const b = buildTqFcrReport({ queries: [tq({ DueAt: "2026-05-10" })], asOf: NOW });
  const row = b.sections.find((s) => s.kind === "table").rows[0];
  assert.match(String(row.status), /⚠/, "استعلام معوق باید علامت بخورد");
});

test("گزارش پیشرفت انحراف را درست علامت‌گذاری می‌کند", () => {
  const p = engineeringProgress([{ deliverable: mdr({ TargetIfcDate: "2026-01-01" }), revisions: [] }], NOW);
  const b = buildProgressReport({ progress: p, kpis: [] });
  const cell = b.sections.find((s) => s.kind === "kpi").cells.find((c) => c.label.fa === "انحراف");
  assert.equal(cell.tone, "bad", "عقب‌ماندگی شدید باید bad باشد");
});

test("گزارش پیشرفت شاخص بی‌داده را «بی‌داده» می‌نویسد نه صفر", () => {
  const p = engineeringProgress([], NOW);
  const kpis = engineeringKpis({ progress: p, revisions: [], aging: [], queries: [], deliverables: [], asOf: NOW });
  const b = buildProgressReport({ progress: p, kpis });
  const tbl = b.sections.find((s) => s.kind === "table" && s.title.fa.includes("شاخص"));
  assert.ok(tbl.rows.some((r) => r.status === "بی‌داده"), "شاخص بدون داده باید بی‌داده بماند");
  assert.ok(tbl.rows.every((r) => r.value !== 0), "بی‌داده نباید صفر شود");
});

test("گزارش پیشرفت هشدارها را بخش جدا می‌کند", () => {
  const p = engineeringProgress([{ deliverable: mdr(), revisions: [rev()] }], NOW);
  const alerts = [{ code: "EWS-ENG-05", severity: "high", titleFa: "عقب‌ماندگی", detailFa: "SPI پایین", subject: "x" }];
  const b = buildProgressReport({ progress: p, kpis: [], alerts });
  const t = b.sections.find((s) => s.kind === "table" && s.title.fa.includes("هشدار"));
  assert.ok(t);
  assert.equal(t.rows[0].severity, "بالا", "شدت باید فارسی شود");
});

test("بدون هشدار بخش هشدار ساخته نمی‌شود", () => {
  const p = engineeringProgress([{ deliverable: mdr(), revisions: [] }], NOW);
  const b = buildProgressReport({ progress: p, kpis: [], alerts: [] });
  assert.ok(!b.sections.some((s) => s.title.fa.includes("هشدار")));
});

test("گزارش سازندگان مدرک بی‌سفارش را پرچم می‌زند", () => {
  const b = buildVprReport({ rows: [vp()], asOf: NOW });
  const cell = b.sections.find((s) => s.kind === "kpi").cells.find((c) => c.label.fa.includes("سفارش"));
  assert.equal(cell.value, "1");
  assert.equal(cell.tone, "warn");
});

test("گزارش سازندگان فقط داخلی است", () => {
  assert.deepEqual(buildVprReport({ rows: [], asOf: NOW }).audiences, ["internal"]);
});

test("گزارش IDC جفت دیسیپلین را فارسی می‌نویسد", () => {
  const b = buildIdcReport({ checks: [sc()], clashes: [clash()], asOf: NOW });
  const pair = b.sections.find((s) => s.kind === "table" && s.title.fa.includes("جفت"));
  assert.match(String(pair.rows[0].pair), /عمران|لوله/, "نام دیسیپلین باید فارسی باشد");
});

test("گزارش IDC قید نبود رندر سه‌بعدی را مستند می‌کند", () => {
  const b = buildIdcReport({ checks: [], clashes: [clash()], asOf: NOW });
  const t = b.sections.find((s) => s.kind === "table" && s.note);
  assert.match(t.note.fa, /رندر نمی‌شود/, "ADR-ENG-09 باید در گزارش مستند شود");
});

/* ── سربرگ ── */

test("سربرگ کامل برای مخاطب رسمی خطا ندارد", () => {
  assert.equal(validateLetterhead(LH, "official").filter((i) => i.severity === "error").length, 0);
});

test("سربرگ ناقص برای مخاطب رسمی رد می‌شود", () => {
  const bad = { ...LH, projectName: "", contractor: { name: "", logoText: "", role: { fa: "", en: "" } } };
  const errs = validateLetterhead(bad, "official").filter((i) => i.severity === "error");
  assert.ok(errs.length >= 2, "نبود نام پروژه و لوگوی پیمانکار باید خطا بدهد");
});

test("شماره سند قالب استاندارد دارد", () => {
  assert.equal(documentNumber("OG-2401", "RPT-ENG-MDR", 1, 0), "OG-2401-RPT-ENG-MDR-0001-R00");
  assert.equal(documentNumber("OG-2401", "RPT-ENG-PRG", 42, 3), "OG-2401-RPT-ENG-PRG-0042-R03");
});

/* ── رگرسیون ── */

test("کاتالوگ همچنان هفت گزارش با کد یکتا دارد", () => {
  assert.ok(ENG_REPORT_CATALOG.length >= 7);
  const codes = ENG_REPORT_CATALOG.map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length);
});

test("کنترل مخاطب پس از افزودن سازنده دست‌نخورده مانده", () => {
  assert.ok(isAudienceAllowed("RPT-ENG-MDR", "official"));
  assert.ok(!isAudienceAllowed("RPT-ENG-VPR", "official"));
  assert.ok(!isAudienceAllowed("RPT-ENG-TRN", "internal"));
});
