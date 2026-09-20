/* آزمون یکپارچگی ماژول مهندسی — Deliverable 12 و 13.
 * قالب‌های Excel، رفت‌وبرگشت CSV، و پیوند بین‌ماژولی.
 * API واقعی itgLogic: templateCsv / parseDelimited / mapHeaders / parseImport
 * و فیلدها کلیدشان `key` است نه `name` (پیش از نوشتن با node -e بازرسی شد). */
import test from "node:test";
import assert from "node:assert/strict";
import { TEMPLATE_CATALOG, mapHeaders, normalizeDigits, parseDelimited, parseImport, templateCsv } from "./itgLogic.js";
import { SCHEMA } from "./sqlLogic.js";
import { planChangeRequests, planIfcLocks } from "./engLogic.js";

const ENG_TEMPLATES = ["TPL-MDR", "TPL-CRS", "TPL-EPR", "TPL-TQR", "TPL-VPR"];
const byCode = (c) => TEMPLATE_CATALOG.find((t) => t.code === c);
const d12 = TEMPLATE_CATALOG.filter((t) => t.module === "d12");
const norm = (s) => normalizeDigits(String(s ?? "")).trim().toLowerCase().replace(/\s+/g, " ");

/* ── حضور و شکل قالب‌ها ── */

test("پنج قالب مهندسی در کاتالوگ هست", () => {
  assert.equal(d12.length, 5);
  assert.deepEqual(d12.map((t) => t.code).sort(), [...ENG_TEMPLATES].sort());
});

test("کاتالوگ دست‌کم ۱۶ قالب دارد و کدها یکتا هستند", () => {
  assert.ok(TEMPLATE_CATALOG.length >= 16, `فقط ${TEMPLATE_CATALOG.length} قالب`);
  const codes = TEMPLATE_CATALOG.map((t) => t.code);
  assert.equal(new Set(codes).size, codes.length);
});

test("جدول مقصد هر قالب مهندسی واقعاً در اسکیما هست", () => {
  for (const t of d12) {
    const tbl = SCHEMA.find((s) => s.name === t.targetTable);
    assert.ok(tbl, `${t.code} به جدول ناموجود ${t.targetTable} اشاره دارد`);
    assert.equal(tbl.module, "d12", `${t.targetTable} در دامنهٔ d12 نیست`);
  }
});

test("هر فیلد قالب ستون واقعی جدول مقصد است", () => {
  for (const t of d12) {
    const cols = new Set(SCHEMA.find((s) => s.name === t.targetTable).columns.map((c) => c.name));
    for (const f of t.fields) {
      assert.ok(cols.has(f.key), `${t.code}: ستون ${f.key} در ${t.targetTable} نیست`);
    }
  }
});

test("کلید طبیعی هر قالب با ایندکس یکتای جدول همخوان است", () => {
  for (const t of d12) {
    const tbl = SCHEMA.find((s) => s.name === t.targetTable);
    const uq = (tbl.indexes ?? []).find((i) => i.unique);
    assert.ok(uq, `${t.targetTable} ایندکس یکتا ندارد`);
    for (const k of t.keyFields) {
      assert.ok(uq.columns.includes(k), `${t.code}: کلید ${k} در ایندکس یکتا نیست`);
    }
  }
});

test("عنوان دوزبانه و نمونهٔ هر فیلد پر است", () => {
  for (const t of d12) {
    assert.ok(t.title.fa && t.title.en, `${t.code} عنوان دوزبانه ندارد`);
    for (const f of t.fields) {
      assert.ok(f.title.fa, `${t.code}.${f.key} عنوان فارسی ندارد`);
      assert.ok(f.title.en, `${t.code}.${f.key} عنوان انگلیسی ندارد`);
      assert.ok(String(f.sample ?? "").length > 0, `${t.code}.${f.key} نمونه ندارد`);
    }
  }
});

test("فیلد کلیدی هر قالب اجباری است", () => {
  for (const t of d12) {
    for (const k of t.keyFields) {
      const f = t.fields.find((x) => x.key === k);
      assert.ok(f?.required, `${t.code}: کلید ${k} اجباری نیست`);
    }
  }
});

/* ── نام‌های مستعار ── */

test("عنوان فارسی هر فیلد جزو نام‌های مستعار خودش است", () => {
  for (const t of d12) {
    for (const f of t.fields) {
      const al = (f.aliases ?? []).map(norm);
      assert.ok(al.includes(norm(f.title.fa)), `${t.code}.${f.key}: عنوان فارسی alias نیست`);
    }
  }
});

test("نام ستون هم جزو نام‌های مستعار است", () => {
  for (const t of d12) {
    for (const f of t.fields) {
      const al = (f.aliases ?? []).map(norm);
      assert.ok(al.includes(norm(f.key)), `${t.code}.${f.key}: نام ستون alias نیست`);
    }
  }
});

test("نام مستعار درون یک قالب دوبار به دو فیلد نمی‌خورد", () => {
  for (const t of d12) {
    const seen = new Map();
    for (const f of t.fields) {
      for (const a of f.aliases ?? []) {
        const n = norm(a);
        const prev = seen.get(n);
        assert.ok(!prev || prev === f.key, `${t.code}: نام «${a}» هم به ${prev} هم به ${f.key} می‌خورد`);
        seen.set(n, f.key);
      }
    }
  }
});

/* ── رفت‌وبرگشت CSV — دام شناخته‌شده ── */

test("هر قالب مهندسی CSV خودش را بازمی‌شناسد", () => {
  for (const code of ENG_TEMPLATES) {
    const t = byCode(code);
    const csv = templateCsv(t);
    assert.ok(csv.length > 0, `${code}: CSV خالی`);
    const rows = parseDelimited(csv);
    assert.ok(rows.length >= 2, `${code}: CSV سرستون و نمونه ندارد`);
    const m = mapHeaders(t, rows[0]);
    assert.equal(m.unmatched.length, 0, `${code}: سرستون ناشناخته ${JSON.stringify(m.unmatched)}`);
    assert.equal(m.missingRequired.length, 0, `${code}: فیلد اجباری گم شد ${JSON.stringify(m.missingRequired.map((f) => f.key))}`);
    const mapped = new Set(m.byIndex.filter(Boolean).map((f) => f.key));
    for (const f of t.fields) {
      assert.ok(mapped.has(f.key), `${code}: فیلد ${f.key} در رفت‌وبرگشت گم شد`);
    }
  }
});

test("ورود کامل قالب MDR بدون خطا انجام می‌شود", () => {
  const t = byCode("TPL-MDR");
  const res = parseImport(t, templateCsv(t));
  assert.equal(res.targetTable, "MdrDeliverable");
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].DocNo, "PR-PID-001");
  const errs = (res.issues ?? []).filter((i) => i.severity === "error");
  assert.equal(errs.length, 0, JSON.stringify(errs));
});

test("هر پنج قالب مهندسی نمونهٔ خود را بی‌خطا وارد می‌کنند", () => {
  for (const code of ENG_TEMPLATES) {
    const t = byCode(code);
    const res = parseImport(t, templateCsv(t));
    const errs = (res.issues ?? []).filter((i) => i.severity === "error");
    assert.equal(errs.length, 0, `${code}: ${JSON.stringify(errs)}`);
    assert.equal(res.rows.length, 1, `${code}: ردیف نمونه وارد نشد`);
  }
});

test("سرستون با فاصله و حروف بزرگ هم شناخته می‌شود", () => {
  const t = byCode("TPL-MDR");
  const m = mapHeaders(t, ["  DOC NO  ", "Discipline", "  وزن  "]);
  const keys = m.byIndex.filter(Boolean).map((f) => f.key);
  assert.ok(keys.includes("DocNo"), "شمارهٔ مدرک شناخته نشد");
  assert.ok(keys.includes("Discipline"));
  assert.ok(keys.includes("PlannedWeight"), "وزن شناخته نشد");
});

test("سرستون ناشناخته گزارش می‌شود نه نادیده", () => {
  const t = byCode("TPL-MDR");
  const m = mapHeaders(t, ["شماره مدرک", "ستون بی‌ربط"]);
  assert.equal(m.unmatched.length, 1);
  assert.ok(m.missingRequired.length > 0, "فیلدهای اجباری غایب باید گزارش شوند");
});

test("نبود فیلد اجباری در ورود خطا می‌دهد", () => {
  const t = byCode("TPL-MDR");
  const res = parseImport(t, "عنوان مدرک\r\nفقط عنوان بدون شماره");
  const hasProblem = (res.issues ?? []).length > 0 || res.rows.length === 0;
  assert.ok(hasProblem, "نبود شمارهٔ مدرک باید مشکل بدهد");
});

test("وزن بیرون از بازه در قالب MDR خطا می‌دهد", () => {
  const t = byCode("TPL-MDR");
  const res = parseImport(t, "شماره مدرک,عنوان مدرک,دیسیپلین,نوع مدرک,وزن برنامه‌ای,وضعیت\r\nX-1,عنوان,civil,drawing,250,planned");
  assert.ok((res.issues ?? []).length > 0, "وزن ۲۵۰ باید خطا بدهد");
});

test("رقم فارسی در ورود به لاتین تبدیل می‌شود", () => {
  const t = byCode("TPL-MDR");
  const res = parseImport(t, "شماره مدرک,عنوان مدرک,دیسیپلین,نوع مدرک,وزن برنامه‌ای,وضعیت\r\nX-1,عنوان,civil,drawing,۱۲٫۵,planned");
  assert.equal(res.rows.length, 1);
  assert.equal(Number(res.rows[0].PlannedWeight), 12.5);
});

/* ── D13: پیوند بین‌ماژولی ── */

test("ENG→PEX: ستون قفل در جدول Activity ماژول d2 است", () => {
  const act = SCHEMA.find((t) => t.name === "Activity");
  assert.equal(act.module, "d2", "ENG نباید مالکیت Activity را بگیرد");
  assert.ok(act.columns.some((c) => c.name === "BlockedByDocumentId"));
});

test("ENG→RCC: جدول مقصد CR در دامنهٔ d4 است", () => {
  const cr = SCHEMA.find((t) => t.name === "ChangeRequest");
  assert.equal(cr.module, "d4");
  for (const n of ["Code", "CostImpact", "TimeImpactDays", "Status"]) {
    assert.ok(cr.columns.some((c) => c.name === n), `ChangeRequest.${n} لازم است`);
  }
});

test("ENG→FIN: قالب سازندگان شمارهٔ سفارش خرید را می‌گیرد", () => {
  assert.ok(byCode("TPL-VPR").fields.some((f) => f.key === "PoNo"));
});

test("ENG→DMS: مالکیت فایل نزد d1 می‌ماند", () => {
  assert.equal(SCHEMA.find((t) => t.name === "Document").module, "d1");
  for (const t of SCHEMA.filter((x) => x.module === "d12")) {
    assert.ok(!t.columns.some((c) => /FilePath/i.test(c.name)), `${t.name} نباید مسیر فایل داشته باشد`);
  }
});

test("پیوند بین‌ماژولی کلید خارجی سخت ندارد", () => {
  for (const t of SCHEMA.filter((x) => x.module === "d12")) {
    for (const fk of t.foreignKeys ?? []) {
      const ref = SCHEMA.find((s) => s.name === fk.refTable);
      assert.equal(ref.module, "d12", `${t.name}.${fk.column} به ماژول دیگر قید سخت دارد`);
    }
  }
});

/* ── ایدمپوتنسی دو اتصال ── */

const impactfulTq = () => ({
  Id: "T1", ProjectId: "p1", Code: "FCR-9", Kind: "FCR", TitleFa: "x",
  Discipline: "civil", RaisedBy: "u", RaisedAt: "2026-05-01", Status: "open", CostImpact: 1000,
});

test("اجرای دوبارهٔ برنامهٔ CR نتیجهٔ یکسان می‌دهد", () => {
  const q = [impactfulTq()];
  assert.deepEqual(planChangeRequests(q), planChangeRequests(q));
});

test("پس از پیوند CR، اجرای دوباره چیزی نمی‌سازد", () => {
  const first = planChangeRequests([impactfulTq()]);
  assert.equal(first.drafts.length, 1);
  const after = planChangeRequests([{ ...impactfulTq(), LinkedCrCode: first.drafts[0].code }]);
  assert.equal(after.drafts.length, 0);
  assert.deepEqual(after.skippedExisting, ["FCR-9"]);
});

test("اجرای دوبارهٔ برنامهٔ قفل پس از اعمال، تغییری نمی‌دهد", () => {
  const del = { Id: "D1", ProjectId: "p1", DocNo: "X-1", TitleFa: "t", Discipline: "civil", DocType: "drawing", PlannedWeight: 100, Status: "in_progress" };
  const p1 = planIfcLocks({
    activities: [{ Id: "A1", ProjectId: "p1" }],
    activityDocLinks: [{ activityId: "A1", deliverableId: "D1" }],
    deliverables: [del],
    revisions: [],
  });
  assert.equal(p1.lock.length, 1);
  const p2 = planIfcLocks({
    activities: [{ Id: "A1", ProjectId: "p1", BlockedByDocumentId: "D1" }],
    activityDocLinks: [{ activityId: "A1", deliverableId: "D1" }],
    deliverables: [del],
    revisions: [],
  });
  assert.equal(p2.lock.length, 0);
  assert.equal(p2.release.length, 0);
  assert.equal(p2.unchanged, 1);
});

/* ── رگرسیون قالب‌های قبلی ── */

test("یازده قالب پیشین دست‌نخورده مانده‌اند", () => {
  for (const c of ["TPL-ACT", "TPL-PRG", "TPL-TMS", "TPL-NCR", "TPL-COR", "TPL-CST", "TPL-EQP", "TPL-DSP", "TPL-SMH", "TPL-PMS", "TPL-SPR"]) {
    assert.ok(byCode(c), `قالب ${c} حذف شده`);
  }
});

test("قالب‌های پیشین همچنان رفت‌وبرگشت CSV می‌دهند", () => {
  for (const c of ["TPL-ACT", "TPL-CST", "TPL-EQP"]) {
    const t = byCode(c);
    const m = mapHeaders(t, parseDelimited(templateCsv(t))[0]);
    assert.equal(m.unmatched.length, 0, `${c} رگرسیون خورد`);
  }
});
