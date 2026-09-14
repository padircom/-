/**
 * آزمون اسکیمای ساختار شکست از قرارداد.
 *
 * این آزمون‌ها روی تصمیم‌های معماری قفل می‌زنند، نه روی شمارنده‌ها.
 * ادعای `SCHEMA.length === N` شکننده است و با هر جدول تازه می‌شکند؛
 * به‌جایش وجود و شکل هر جدول جداگانه سنجیده می‌شود.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { SCHEMA, MIGRATIONS, tableDef } from "./sqlLogic.js";

const NEW_TABLES = ["CtrDocument", "CtrClause", "CtrBoqDraft", "BreakdownNode", "BreakdownColumnDef", "BreakdownValue"];

const colsOf = (name) => new Map((tableDef(name)?.columns ?? []).map((c) => [c.name, c]));
const idxOf = (name) => tableDef(name)?.indexes ?? [];

/* ══════════════════════ وجود ══════════════════════ */

test("wbs: هر شش جدول تعریف شده‌اند", () => {
  for (const n of NEW_TABLES) {
    assert.ok(tableDef(n), `جدول ${n} پیدا نشد`);
  }
});

test("wbs: همه به ماژول d2 تعلق دارند", () => {
  for (const n of NEW_TABLES) {
    assert.equal(tableDef(n).module, "d2", `${n} ماژول اشتباه دارد`);
  }
});

test("wbs: هر جدول عنوان دوزبانه دارد", () => {
  for (const n of NEW_TABLES) {
    const t = tableDef(n);
    assert.ok(t.title.fa && t.title.en, `${n} عنوان ناقص دارد`);
  }
});

test("wbs: نام جدول‌ها در کل اسکیما یکتا است", () => {
  /* این آزمون یک تصادم واقعی گرفت: نام WbsNode از قبل برای جدول سادهٔ
   * گره‌های زمان‌بندی گرفته شده بود که Activity.WbsId به آن ارجاع
   * می‌دهد. جدول تازه به BreakdownNode تغییر نام داد. */
  const names = SCHEMA.map((t) => t.name);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dup, [], `نام تکراری: ${dup.join(", ")}`);
});

test("wbs: جدول قدیمی WbsNode دست‌نخورده مانده", () => {
  /* Activity.WbsId به آن ارجاع می‌دهد؛ عوض کردنش زنجیره را می‌شکند. */
  const old = tableDef("WbsNode");
  assert.ok(old, "جدول قدیمی حذف شده");
  assert.ok(old.columns.some((c) => c.name === "NameFa"));
  assert.equal(old.columns.length, 7);
});

/* ══════════════════════ سند قرارداد ══════════════════════ */

test("wbs: سند قرارداد چک‌سام محتوا دارد", () => {
  /* بدون آن، بارگذاری دوبارهٔ همان فایل سند تکراری می‌سازد. */
  const c = colsOf("CtrDocument");
  assert.ok(c.has("ContentHash"));
  assert.equal(c.get("ContentHash").nullable, false);
});

test("wbs: بارگذاری تکراری با کلید یکتا مسدود است", () => {
  const ux = idxOf("CtrDocument").find((i) => i.unique);
  assert.ok(ux, "کلید یکتا ندارد");
  assert.deepEqual(ux.columns, ["ProjectId", "ContentHash"]);
});

test("wbs: وضعیت استخراج صریح است نه استنتاجی", () => {
  /* «هنوز استخراج نشده» باید از «استخراج شد و متنی نبود» جدا بماند؛
   * حالت دوم یعنی PDF اسکن است و مسیر OCR لازم دارد. */
  const c = colsOf("CtrDocument");
  assert.ok(c.has("ExtractStatus"));
  assert.equal(c.get("ExtractStatus").nullable, false);
  assert.ok(String(c.get("ExtractStatus").default).includes("pending"));
});

test("wbs: متن استخراجی سقف طول ندارد", () => {
  /* متن قرارداد به‌راحتی از هر سقف ثابتی بیشتر می‌شود. */
  const col = colsOf("CtrDocument").get("ExtractedText");
  assert.equal(col.len, undefined);
});

test("wbs: خطای استخراج جای ثبت دارد", () => {
  assert.ok(colsOf("CtrDocument").has("ExtractErrorFa"));
});

/* ══════════════════════ بند ══════════════════════ */

test("wbs: بند جای دقیق خود در متن را نگه می‌دارد", () => {
  /* مبنای برجسته‌سازی در پیش‌نمایش. */
  const c = colsOf("CtrClause");
  for (const n of ["PageNo", "CharStart", "CharEnd"]) {
    assert.ok(c.has(n), `${n} ندارد`);
  }
});

test("wbs: متن بند سقف طول ندارد", () => {
  assert.equal(colsOf("CtrClause").get("BodyText").len, undefined);
});

test("wbs: شمارهٔ بند در هر سند یکتا است", () => {
  const ux = idxOf("CtrClause").find((i) => i.unique);
  assert.deepEqual(ux.columns, ["DocumentId", "ClauseNo"]);
});

/* ══════════════════════ BoQ پیش‌نویس ══════════════════════ */

test("wbs: BoQ پیش‌نویس از BoQ قطعی جداست", () => {
  /* استخراج ماشینی حدس است و حدس نباید مستقیم وارد دفتر مالی شود. */
  assert.ok(tableDef("CtrBoqDraft"));
  assert.ok(colsOf("CtrBoqDraft").has("PromotedToBoqId"));
});

test("wbs: مقدار و نرخ می‌توانند خالی بمانند", () => {
  /* اگر در متن نبود، null می‌ماند. AI حق ساختن عدد ندارد. */
  const c = colsOf("CtrBoqDraft");
  for (const n of ["Qty", "UnitRate", "LumpSumAmount"]) {
    assert.equal(c.get(n).nullable, true, `${n} نباید اجباری باشد`);
  }
});

test("wbs: منشأ هر ردیف ثبت می‌شود", () => {
  const c = colsOf("CtrBoqDraft");
  assert.ok(c.has("ExtractedBy"));
  assert.equal(c.get("ExtractedBy").nullable, false);
  assert.ok(c.has("ProviderId"));
  assert.ok(c.has("Confidence"));
});

test("wbs: ارجاع به منبع روی هر ردیف هست", () => {
  /* بدون آن، اثبات اینکه عدد از قرارداد آمده ممکن نیست. */
  const c = colsOf("CtrBoqDraft");
  assert.ok(c.has("SourceRefFa"));
  assert.ok(c.has("ClauseId"));
  assert.ok(c.has("PageNo"));
});

test("wbs: ردیف استخراجی با وضعیت پیش‌نویس آغاز می‌شود", () => {
  const col = colsOf("CtrBoqDraft").get("Status");
  assert.ok(String(col.default).includes("draft"));
});

test("wbs: بازبینی انسانی ثبت می‌شود", () => {
  const c = colsOf("CtrBoqDraft");
  assert.ok(c.has("ReviewedBy"));
  assert.ok(c.has("ReviewedAt"));
});

/* ══════════════════════ درخت واحد ══════════════════════ */

test("wbs: چهار نما یک جدول‌اند نه چهار جدول", () => {
  /* اگر جدا بودند، روز سوم از هم واگرا می‌شدند. */
  assert.equal(tableDef("WbsWpaNode"), undefined);
  assert.equal(tableDef("WbsPmsNode"), undefined);
  assert.equal(tableDef("CbsNode"), undefined);
  assert.ok(colsOf("BreakdownNode").has("ViewKind"));
});

test("wbs: کد گره در هر نما یکتا است نه در کل پروژه", () => {
  /* یک کد می‌تواند هم در WBS و هم در CBS باشد؛ آن دو یک چیز نیستند. */
  const ux = idxOf("BreakdownNode").find((i) => i.unique);
  assert.deepEqual(ux.columns, ["ProjectId", "ViewKind", "Code"]);
});

test("wbs: نمای پیش‌فرض wbs است", () => {
  assert.ok(String(colsOf("BreakdownNode").get("ViewKind").default).includes("wbs"));
});

test("wbs: هر دو وزن WF و WV جای جدا دارند", () => {
  const c = colsOf("BreakdownNode");
  assert.ok(c.has("WeightFactor"), "WF ندارد");
  assert.ok(c.has("WeightValue"), "WV ندارد");
});

test("wbs: وزن‌ها می‌توانند خالی بمانند", () => {
  /* گرهٔ تازه‌ساخته هنوز وزن ندارد؛ صفر گذاشتن یعنی ادعای وزن صفر. */
  const c = colsOf("BreakdownNode");
  assert.equal(c.get("WeightFactor").nullable, true);
  assert.equal(c.get("WeightValue").nullable, true);
});

test("wbs: وزن دقت اعشاری کافی دارد", () => {
  /* با دو رقم اعشار، جمع وزن‌های یک سطح ۹۹.۹۹ می‌شود و گیت می‌شکند. */
  const wf = colsOf("BreakdownNode").get("WeightFactor");
  assert.equal(wf.kind, "decimal");
  assert.ok(wf.scale >= 4, "دقت اعشاری کم است");
});

test("wbs: پیوند به حساب هزینه برای نمای CBS هست", () => {
  assert.ok(colsOf("BreakdownNode").has("CostAccountCode"));
});

test("wbs: گره منشأ خود را نگه می‌دارد", () => {
  const c = colsOf("BreakdownNode");
  assert.ok(c.has("BoqDraftId"));
  assert.ok(c.has("ClauseId"));
  assert.ok(c.has("SourceRefFa"));
  assert.ok(c.has("GeneratedBy"));
});

test("wbs: گره با وضعیت پیش‌نویس آغاز می‌شود", () => {
  /* فقط approved به Baseline می‌رود — همان الگوی D8 و D11. */
  assert.ok(String(colsOf("BreakdownNode").get("Status").default).includes("draft"));
});

test("wbs: تأیید گره ثبت می‌شود", () => {
  const c = colsOf("BreakdownNode");
  assert.ok(c.has("ApprovedBy"));
  assert.ok(c.has("ApprovedAt"));
});

test("wbs: پیمایش والد نمایه دارد", () => {
  /* بدون آن، ساختن درخت برای هر گره یک پویش کامل است — N+1. */
  const ix = idxOf("BreakdownNode").find((i) => i.columns.includes("ParentCode"));
  assert.ok(ix, "نمایهٔ والد ندارد");
});

/* ══════════════════════ ستون دلخواه ══════════════════════ */

test("wbs: ستون دلخواه جدول جدا دارد نه JSON در گره", () => {
  /* JSON نه قابل جست‌وجوست نه قابل جمع زدن. */
  assert.ok(tableDef("BreakdownColumnDef"));
  assert.ok(tableDef("BreakdownValue"));
  assert.equal(colsOf("BreakdownNode").has("CustomJson"), false);
});

test("wbs: ستون دلخواه می‌گوید در والد جمع می‌شود یا نه", () => {
  const col = colsOf("BreakdownColumnDef").get("RollsUp");
  assert.ok(col);
  assert.equal(col.kind, "bool");
});

test("wbs: کلید ستون در هر نما یکتا است", () => {
  const ux = idxOf("BreakdownColumnDef").find((i) => i.unique);
  assert.deepEqual(ux.columns, ["ProjectId", "ViewKind", "ColumnKey"]);
});

test("wbs: هر گره برای هر ستون یک مقدار دارد", () => {
  const ux = idxOf("BreakdownValue").find((i) => i.unique);
  assert.deepEqual(ux.columns, ["NodeId", "ColumnKey"]);
});

test("wbs: مقدار عددی و متنی جدا نگه داشته می‌شوند", () => {
  /* عدد در ستون متنی یعنی جمع زدن ناممکن. */
  const c = colsOf("BreakdownValue");
  assert.ok(c.has("ValueText"));
  assert.equal(c.get("ValueNumber").kind, "decimal");
});

/* ══════════════════════ مهاجرت ══════════════════════ */

test("wbs: مهاجرت 0032 وجود دارد", () => {
  const m = MIGRATIONS.find((x) => x.version === "0032");
  assert.ok(m, "مهاجرت پیدا نشد");
  assert.equal(m.name, "contract_breakdown_structure");
});

test("wbs: مهاجرت هر شش جدول را می‌سازد", () => {
  const m = MIGRATIONS.find((x) => x.version === "0032");
  const sql = m.statements.join("\n");
  for (const n of NEW_TABLES) {
    assert.ok(sql.includes(n), `${n} در مهاجرت نیست`);
  }
});

test("wbs: مهاجرت نمایه‌ها را هم می‌سازد", () => {
  const m = MIGRATIONS.find((x) => x.version === "0032");
  const sql = m.statements.join("\n");
  assert.ok(sql.includes("UX_BreakdownNode_Code"));
  assert.ok(sql.includes("IX_BreakdownNode_Parent"));
});

test("wbs: شمارهٔ مهاجرت تکراری نیست", () => {
  const versions = MIGRATIONS.map((m) => m.version);
  assert.equal(new Set(versions).size, versions.length);
});

test("wbs: متن بلند به NVARCHAR(MAX) نگاشته می‌شود نه طول منفی", () => {
  const m = MIGRATIONS.find((x) => x.version === "0032");
  const sql = m.statements.join("\n");
  assert.ok(!sql.includes("NVARCHAR(-1)"), "طول منفی تولید شد");
  assert.ok(sql.includes("NVARCHAR(MAX)"));
});
