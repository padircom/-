/* آزمون مدل دادهٔ ماژول مهندسی و طراحی (ENG / d12) — Deliverable 2.
 * مبنا: docs/ENG_Architecture.md بخش ۶ و ADR-ENG-01..10.
 * این فایل فقط اسکیما و مهاجرت را می‌سنجد؛ منطق موتور در eng.test.mjs می‌آید. */
import test from "node:test";
import assert from "node:assert/strict";
import { MIGRATIONS, SCHEMA, generateDdl, indexDdl, pendingMigrations, tableDdl } from "./sqlLogic.js";

const D12 = SCHEMA.filter((t) => t.module === "d12");
const byName = (n) => SCHEMA.find((t) => t.name === n);
const colsOf = (n) => new Set((byName(n)?.columns ?? []).map((c) => c.name));

const EXPECTED = [
  "MdrDeliverable",
  "EngineeringRevision",
  "CrsComment",
  "SquadCheck",
  "InterfaceClashLog",
  "TechnicalQuery",
  "VendorPrintReview",
  "EngineeringProgressSnapshot",
  /* مهاجرت 0009 — چرخهٔ تدارکات؛ MR نزد مهندسی می‌ماند (ADR-ENG-14). */
  "MaterialRequest",
];

/* ── ۱. حضور جدول‌ها ── */

test("d12 دقیقاً نُه جدول دارد", () => {
  assert.equal(D12.length, 9);
  assert.deepEqual(D12.map((t) => t.name).sort(), [...EXPECTED].sort());
});

test("هر جدول d12 عنوان دوزبانه و کلید اصلی Id دارد", () => {
  for (const t of D12) {
    assert.equal(t.pk, "Id", `${t.name} کلید اصلی غیر Id دارد`);
    assert.ok(t.title?.fa && t.title?.en, `${t.name} عنوان دوزبانه ندارد`);
    assert.ok(t.title.fa.trim().length > 3, `${t.name} عنوان فارسی کوتاه است`);
  }
});

test("هر جدول d12 ستون ProjectId اجباری دارد", () => {
  for (const t of D12) {
    const p = t.columns.find((c) => c.name === "ProjectId");
    assert.ok(p, `${t.name} ستون ProjectId ندارد`);
    assert.equal(p.nullable, false, `${t.name}.ProjectId باید اجباری باشد`);
  }
});

/* ── ۲. کلیدهای طبیعی یکتا (ADR بخش ۶) ── */

test("کلید طبیعی یکتای هر جدول طبق سند تعریف شده", () => {
  const want = {
    MdrDeliverable: ["ProjectId", "DocNo"],
    EngineeringRevision: ["DeliverableId", "RevCode"],
    CrsComment: ["RevisionId", "CommentNo"],
    SquadCheck: ["RevisionId", "Discipline"],
    InterfaceClashLog: ["ProjectId", "ClashNo"],
    TechnicalQuery: ["ProjectId", "Code"],
    VendorPrintReview: ["ProjectId", "VendorDocNo", "RevCode"],
    EngineeringProgressSnapshot: ["ProjectId", "PeriodCode", "Discipline"],
  };
  for (const [tbl, cols] of Object.entries(want)) {
    const t = byName(tbl);
    const uq = (t.indexes ?? []).filter((i) => i.unique);
    assert.ok(uq.length >= 1, `${tbl} ایندکس یکتا ندارد`);
    assert.ok(
      uq.some((i) => i.columns.length === cols.length && i.columns.every((c, k) => c === cols[k])),
      `${tbl} کلید طبیعی مورد انتظار ${cols.join("+")} را ندارد`,
    );
  }
});

test("نام ایندکس‌های d12 در کل اسکیما یکتاست", () => {
  const all = SCHEMA.flatMap((t) => (t.indexes ?? []).map((i) => i.name));
  assert.equal(new Set(all).size, all.length, "نام ایندکس تکراری وجود دارد");
});

/* ── ۳. ADR-ENG-01: مالکیت فایل نزد d1 ── */

test("ADR-ENG-01: هیچ جدول d12 مسیر فایل ذخیره نمی‌کند", () => {
  for (const t of D12) {
    for (const c of t.columns) {
      assert.ok(!/FilePath|BlobPath|Attachment/i.test(c.name), `${t.name}.${c.name} نقض مالکیت فایل d1`);
    }
  }
});

test("ADR-ENG-01: پل به مخزن d1 از راه DocumentId است", () => {
  assert.ok(colsOf("MdrDeliverable").has("DocumentId"));
  assert.ok(colsOf("EngineeringRevision").has("DocumentId"));
  assert.ok(byName("Document"), "جدول Document باید در d1 باقی بماند");
  assert.equal(byName("Document").module, "d1", "مالکیت Document نباید جابه‌جا شود");
});

/* ── ۴. ADR-ENG-02: ریویژن موجودیت مستقل ── */

test("ADR-ENG-02: ریویژن هدف صدور و کد بررسی مستقل دارد", () => {
  const c = colsOf("EngineeringRevision");
  for (const n of ["RevCode", "Purpose", "ReviewCode", "IssuedAt", "ReviewDueAt", "ReviewAgingDays"]) {
    assert.ok(c.has(n), `EngineeringRevision.${n} لازم است`);
  }
});

test("ADR-ENG-02: ریویژن با حذف مدرک آبشاری پاک می‌شود", () => {
  const fk = (byName("EngineeringRevision").foreignKeys ?? []).find((f) => f.refTable === "MdrDeliverable");
  assert.ok(fk, "کلید خارجی به MdrDeliverable لازم است");
  assert.equal(fk.onDelete, "CASCADE");
});

/* ── ۵. ADR-ENG-04: قفل IFC آینهٔ الگوی EQP ── */

test("ADR-ENG-04: Activity ستون BlockedByDocumentId دارد و nullable است", () => {
  const col = byName("Activity").columns.find((c) => c.name === "BlockedByDocumentId");
  assert.ok(col, "ستون قفل IFC وجود ندارد");
  assert.notEqual(col.nullable, false, "ستون قفل باید nullable باشد تا دادهٔ موجود نشکند");
});

test("ADR-ENG-04: قفل IFC دقیقاً هم‌شکل قفل ماشین‌آلات است", () => {
  const cols = byName("Activity").columns;
  const eq = cols.find((c) => c.name === "BlockedByEquipmentId");
  const doc = cols.find((c) => c.name === "BlockedByDocumentId");
  assert.equal(doc.kind, eq.kind, "نوع دو ستون قفل باید یکی باشد");
  assert.equal(doc.len, eq.len, "طول دو ستون قفل باید یکی باشد");
});

/* ── ۶. ADR-ENG-06: محرک CR خودکار ── */

test("ADR-ENG-06: TechnicalQuery فیلدهای اثر و پیوند CR دارد", () => {
  const c = colsOf("TechnicalQuery");
  for (const n of ["CostImpact", "TimeImpactDays", "LinkedCrCode"]) {
    assert.ok(c.has(n), `TechnicalQuery.${n} لازم است`);
  }
  assert.ok(byName("ChangeRequest"), "جدول مقصد CR باید موجود باشد");
});

test("TQ و FCR و DCN یک جدول با ستون Kind هستند", () => {
  const kind = byName("TechnicalQuery").columns.find((c) => c.name === "Kind");
  assert.ok(kind, "ستون Kind لازم است");
  assert.equal(kind.nullable, false);
  for (const k of ["TQ", "FCR", "DCN"]) assert.ok(kind.comment.includes(k), `Kind باید ${k} را پوشش دهد`);
  for (const n of ["FieldChangeRequest", "DesignChangeNotice"]) {
    assert.equal(byName(n), undefined, `${n} نباید جدول جدا باشد`);
  }
});

/* ── ۷. ADR-ENG-07: CRS دو موجودیت نیست ── */

test("ADR-ENG-07: پاسخ و صحه‌گذاری هم‌رکورد نظر هستند", () => {
  const c = colsOf("CrsComment");
  for (const n of ["CommentText", "ResponseText", "ResponseStatus", "VerifiedBy", "VerifiedAt"]) {
    assert.ok(c.has(n), `CrsComment.${n} لازم است`);
  }
  assert.equal(byName("CrsResponse"), undefined, "پاسخ نباید جدول جدا باشد");
});

/* ── ۸. ADR-ENG-08: مهلت بررسی قراردادی ── */

test("ADR-ENG-08: مهلت بررسی در MDR قابل تنظیم است", () => {
  const col = byName("MdrDeliverable").columns.find((c) => c.name === "ContractReviewDays");
  assert.ok(col, "ContractReviewDays لازم است");
  assert.notEqual(col.nullable, false, "نبودش یعنی پیش‌فرض ۱۴ روز");
  assert.match(col.comment ?? "", /۱۴|14/, "پیش‌فرض باید مستند باشد");
});

/* ── ۹. ADR-ENG-09: Clash فقط لاگ ── */

test("ADR-ENG-09: لاگ تداخل ابزار مبدأ را ثبت می‌کند و مدل نگه نمی‌دارد", () => {
  const t = byName("InterfaceClashLog");
  const src = t.columns.find((c) => c.name === "SourceTool");
  assert.ok(src && src.nullable === false);
  for (const c of t.columns) assert.ok(!/Geometry|Mesh|ModelBlob/i.test(c.name), `${c.name} نباید هندسه نگه دارد`);
});

/* ── ۱۰. ADR-ENG-10: جدول داخلی ── */

test("ADR-ENG-10: عکس پیشرفت کلید دوره‌ای یکتا دارد", () => {
  const uq = byName("EngineeringProgressSnapshot").indexes.find((i) => i.unique);
  assert.deepEqual(uq.columns, ["ProjectId", "PeriodCode", "Discipline"]);
});

/* ── ۱۱. مهاجرت 0008 و 0009 ── */

test("مهاجرت‌های پیشین دست‌نخورده مانده‌اند و ترتیب صعودی است", () => {
  const v = MIGRATIONS.map((m) => m.version);
  assert.ok(v.includes("0008"), "مهاجرت ماژول مهندسی نباید حذف شود");
  assert.ok(v.includes("0009"), "مهاجرت چرخهٔ تدارکات نیست");
  assert.ok(v.includes("0010"), "مهاجرت ماژول پیمان نیست");
  assert.ok(v.includes("0011"), "مهاجرت پیوند عدم انطباق به فعالیت نیست");
  assert.ok(v.includes("0012"), "مهاجرت گواهی تحویل نیست");
  assert.ok(v.includes("0013"), "مهاجرت تفکیک سیستمی نیست");
  assert.ok(v.includes("0014"), "مهاجرت بستهٔ آزمون نیست");
  assert.ok(v.includes("0015"), "مهاجرت ایمنی و بهداشت نیست");
  assert.ok(v.includes("0016"), "مهاجرت ارزیابی ریسک شغلی نیست");
  assert.ok(v.includes("0017"), "مهاجرت پروانهٔ کار نیست");
  assert.ok(v.includes("0018"), "مهاجرت حادثه و اقدام اصلاحی نیست");
  assert.ok(v.includes("0019"), "مهاجرت تخلف و توقف کار نیست");
  /* «آخرین مهاجرت» ادعای شکننده‌ای است: هر ماژول بعدی آن را
   * می‌شکند بی‌آنکه چیزی دربارهٔ این ماژول بگوید. چیزی که باید
   * ثابت بماند نبودن شکاف و ترتیب صعودی است. */
  assert.deepEqual([...v].sort(), v, "ترتیب مهاجرت‌ها باید صعودی بماند");
  assert.equal(new Set(v).size, v.length, "شمارهٔ مهاجرت تکراری");
});

test("مهاجرت 0009 سه جدول تدارکات را می‌سازد", () => {
  const m = MIGRATIONS.find((x) => x.version === "0009");
  const sql = m.statements.join("\n");
  for (const n of ["MaterialRequest", "PurchaseRequisition", "PurchaseOrder"]) {
    assert.match(sql, new RegExp(n), `${n} در مهاجرت 0009 نیست`);
  }
});

test("هر جدول d12 در یکی از مهاجرت‌ها ساخته می‌شود", () => {
  /* MaterialRequest در 0009 می‌آید نه 0008؛ مهاجرت اجراشده هرگز ویرایش
   * نمی‌شود چون چک‌سام می‌شکند و پایگاه داده با کد واگرا می‌شود. */
  const sql = MIGRATIONS.filter((m) => m.version >= "0008").flatMap((m) => m.statements).join("\n");
  for (const n of EXPECTED) assert.match(sql, new RegExp(`CREATE TABLE[^;]*\\[${n}\\]`), `${n} ساخته نمی‌شود`);
});

test("0008 هشت جدول اصلی مهندسی را می‌سازد و MaterialRequest در آن نیست", () => {
  const sql = MIGRATIONS.find((m) => m.version === "0008").statements.join("\n");
  const core = EXPECTED.filter((n) => n !== "MaterialRequest");
  assert.equal(core.length, 8);
  for (const n of core) assert.match(sql, new RegExp(`CREATE TABLE[^;]*\\[${n}\\]`), `${n} ساخته نمی‌شود`);
  assert.ok(!sql.includes("[MaterialRequest]"), "مهاجرت اجراشده نباید ویرایش شود");
});

test("0008 ستون قفل را با محافظ می‌افزاید و ایندکس می‌سازد", () => {
  const st = MIGRATIONS.find((m) => m.version === "0008").statements;
  const add = st.find((s) => s.includes("BlockedByDocumentId") && s.includes("ALTER TABLE"));
  assert.ok(add, "ALTER TABLE برای ستون قفل لازم است");
  assert.match(add, /IF COL_LENGTH\('dbo\.Activity', 'BlockedByDocumentId'\) IS NULL/);
  assert.ok(st.some((s) => s.includes("IX_Activity_BlockedByDocument")), "ایندکس قفل لازم است");
});

test("0008 هیچ جدول ماژول دیگری را تغییر نمی‌دهد", () => {
  const st = MIGRATIONS.find((m) => m.version === "0008").statements;
  const foreign = SCHEMA.filter((t) => t.module !== "d12" && t.name !== "Activity").map((t) => t.name);
  for (const s of st) {
    if (!/^\s*(ALTER|DROP)/i.test(s)) continue;
    for (const n of foreign) assert.ok(!s.includes(`[${n}]`), `0008 نباید ${n} را تغییر دهد`);
  }
});

test("0008 هیچ ستون NOT NULL به جدول موجود نمی‌افزاید", () => {
  const st = MIGRATIONS.find((m) => m.version === "0008").statements;
  for (const s of st) {
    if (/ALTER TABLE[^;]*ADD/i.test(s)) assert.ok(!/NOT NULL/i.test(s), "افزودن NOT NULL دادهٔ موجود را می‌شکند");
  }
});

test("0008 پس از 0007 در صف اجرا قرار می‌گیرد", () => {
  const applied = MIGRATIONS.filter((m) => m.version !== "0008").map((m) => ({ version: m.version }));
  const pend = pendingMigrations(applied);
  assert.equal(pend.length, 1);
  assert.equal(pend[0].version, "0008");
});

/* ── ۱۲. سلامت DDL ── */

test("DDL هر جدول d12 بدون استثنا تولید می‌شود", () => {
  for (const t of D12) {
    const ddl = tableDdl(t, "mssql");
    assert.match(ddl, new RegExp(`CREATE TABLE \\[dbo\\]\\.\\[${t.name}\\]`));
    assert.match(ddl, /\[Id\]/);
    for (const i of t.indexes ?? []) assert.ok(indexDdl(t, i, "mssql").includes(i.name));
  }
});

test("DDL کامل اسکیما همچنان تولید می‌شود", () => {
  const ddl = generateDdl("mssql");
  assert.ok(ddl.length > 0);
  for (const n of EXPECTED) assert.ok(ddl.includes(`[${n}]`), `${n} در DDL کل نیست`);
});

test("هیچ ستون decimal بدون دقت و مقیاس نیست", () => {
  for (const t of D12) {
    for (const c of t.columns) {
      if (c.kind !== "decimal") continue;
      assert.ok(typeof c.precision === "number" && typeof c.scale === "number", `${t.name}.${c.name} دقت ندارد`);
    }
  }
});

test("هیچ ستون text بدون طول نیست مگر عمداً بلند", () => {
  for (const t of D12) {
    for (const c of t.columns) {
      if (c.kind !== "text") continue;
      assert.ok(typeof c.len === "number" && c.len > 0, `${t.name}.${c.name} طول ندارد`);
    }
  }
});

test("ستون‌های وضعیت مقادیر مجاز را مستند کرده‌اند", () => {
  const withStatus = D12.filter((t) => t.columns.some((c) => c.name === "Status"));
  assert.ok(withStatus.length >= 5, "بیشتر جدول‌ها باید Status داشته باشند");
  for (const t of withStatus) {
    const s = t.columns.find((c) => c.name === "Status");
    assert.equal(s.nullable, false, `${t.name}.Status باید اجباری باشد`);
    assert.ok((s.comment ?? "").includes("|"), `${t.name}.Status مقادیر مجاز را مستند نکرده`);
  }
});

/* ── ۱۳. رگرسیون: ماژول‌های قبلی دست‌نخورده ── */

test("هیچ جدول قبلی از اسکیما حذف نشده", () => {
  /* کف به‌جای عدد دقیق: افزوده شدن جدول توسط ماژول بعدی خطا نیست،
   * حذف شدن جدول خطاست. */
  assert.ok(SCHEMA.length >= 122, "جدولی از اسکیما حذف شده است");
  for (const n of ["Document", "Transmittal", "Activity", "ChangeRequest", "Ncr", "CostAccount", "PaymentCertificate", "Equipment", "EquipmentCostPosting", "PurchaseRequisition", "PurchaseOrder"]) {
    assert.ok(byName(n), `${n} نباید حذف شود`);
  }
});

test("مهاجرت‌های ۰۰۰۱ تا ۰۰۰۷ دست‌نخورده مانده‌اند", () => {
  const old = MIGRATIONS.filter((m) => m.version < "0008");
  assert.equal(old.length, 7);
  for (const m of old) assert.ok(m.statements.length > 0, `${m.version} خالی شده`);
  const m7 = MIGRATIONS.find((m) => m.version === "0007");
  assert.ok(m7.statements.some((s) => s.includes("EquipmentCostPosting")), "0007 نباید تغییر کند");
});

test("ستون BlockedByEquipmentId هنوز سر جایش است", () => {
  assert.ok(colsOf("Activity").has("BlockedByEquipmentId"), "قفل ماشین‌آلات نباید آسیب ببیند");
});
