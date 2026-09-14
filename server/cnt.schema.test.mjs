/* آزمون اسکیمای ماژول پیمان (d14) و موتور شناسنامه و فهرست بها.
 *
 * تمرکز بر چیزی است که واقعاً می‌شکند: ترکیب نامعتبر ستون‌ها در دو حالت
 * ارزش‌گذاری، مبنای سقف ۲۵٪، و مرز همگرایی که کل معماری روی آن بنا شده. */
import test from "node:test";
import assert from "node:assert/strict";
import { SCHEMA, MIGRATIONS } from "./sqlLogic.js";
import {
  CNT_VERSION,
  boqRollup,
  contractCeiling,
  contractSummary,
  extraWorkBillable,
  lineAmount,
  lineEarnedValue,
  mappingCoverage,
  measurementQuantity,
  measurementTotal,
  milestoneProgress,
  qualityGate,
  validateBoq,
  validateBoqItem,
} from "./cntLogic.js";

const D14 = SCHEMA.filter((t) => t.module === "d14");
const byName = (n) => SCHEMA.find((t) => t.name === n);

/* ══════ اسکیما ══════ */

test("ماژول d14 بیست‌وسه جدول دارد", () => {
  assert.equal(D14.length, 24);
});

test("جدول‌های پیمان سر جایشان‌اند و هیچ جدول قبلی حذف نشده", () => {
  /* عمداً عدد مطلق اسکیما را ادعا نمی‌کنیم: هر ماژول تازه‌ای که
   * جدول اضافه کند این آزمون را می‌شکست بی‌آنکه چیزی دربارهٔ ماژول
   * پیمان بگوید. چیزی که واقعاً باید تضمین شود این است که جدول‌های
   * این ماژول و همسایه‌های وابسته حذف نشده‌اند. */
  assert.ok(SCHEMA.length >= 122, "جدولی از اسکیما حذف شده است");
  for (const n of ["PaymentCertificate", "CostAccount", "MdrDeliverable", "PurchaseOrder"]) {
    assert.ok(byName(n), `${n} حذف شده است`);
  }
});

test("PaymentCertificate قدیمی دست‌نخورده مانده است", () => {
  /* جایگزین می‌شود ولی حذف نمی‌شود: از PUBLIC_TABLES سرو می‌شود و ممکن
   * است مصرف‌کنندهٔ ناشناخته داشته باشد. */
  const t = byName("PaymentCertificate");
  assert.equal(t.module, "d5");
  const cols = t.columns.map((c) => c.name);
  for (const c of ["SerialNo", "GrossAmount", "Deductions", "NetAmount"]) {
    assert.ok(cols.includes(c), `ستون ${c} حذف شده`);
  }
});

test("مهاجرت 0010 جداول پیمان را می‌سازد و 0009 دست‌نخورده مانده", () => {
  const m10 = MIGRATIONS.find((m) => m.version === "0010");
  assert.ok(m10);
  assert.equal(m10.name, "contracts_boq_ipc_adjustment");
  assert.ok(MIGRATIONS.some((m) => m.version === "0009" && m.name === "procurement_cycle_mr_pr_po"));
});

test("مهاجرت 0011 ستون فعالیت را به عدم انطباق می‌افزاید", () => {
  /* بدون این ستون، دروازهٔ کیفی نمی‌تواند بپرسد «عدم انطباق باز روی این
   * فعالیت هست؟» و نیمه‌کور می‌ماند. */
  const m11 = MIGRATIONS.find((m) => m.version === "0011");
  assert.ok(m11, "مهاجرت 0011 وجود ندارد");
  assert.equal(m11.name, "ncr_activity_link");
  const sql = m11.statements.join("\n");
  assert.match(sql, /ALTER TABLE .*Ncr.* ADD .*ActivityId/);
  /* ایدمپوتنت: اجرای دوباره روی پایگاه دادهٔ به‌روز نباید بشکند. */
  assert.match(sql, /COL_LENGTH/);
  assert.match(sql, /IX_Ncr_Activity/);
});

test("ستون ActivityId در عدم انطباق اختیاری است", () => {
  /* اجباری بودن، هر رکورد تاریخی بدون فعالیت را نامعتبر می‌کرد. */
  const ncr = SCHEMA.find((t) => t.name === "Ncr");
  const col = ncr.columns.find((c) => c.name === "ActivityId");
  assert.ok(col, "ستون ActivityId نیست");
  assert.notEqual(col.nullable, false);
});

test("هر جدول d14 در یکی از مهاجرت‌ها ساخته می‌شود", () => {
  /* بیست‌وسه جدول اولیه در ۰۰۱۰؛ پل مالی (G-03) در ۰۰۲۲ افزوده شد.
     قفل‌کردن آزمون روی یک شمارهٔ مهاجرت، هر افزودنی بعدی را می‌شکند —
     چیزی که باید بررسی شود این است که هیچ جدولی بی‌مهاجرت نماند. */
  const sql = MIGRATIONS.map((m) => m.statements.join("\n")).join("\n");
  for (const t of D14) {
    assert.ok(sql.includes(t.name), `جدول ${t.name} در هیچ مهاجرتی نیست`);
  }
  const m10 = MIGRATIONS.find((m) => m.version === "0010");
  assert.ok(m10.statements.join("\n").includes("ContractMaster"), "پایهٔ d14 در ۰۰۱۰ می‌ماند");
});

test("هر ستون Status در d14 اجباری است و مقادیر مجاز را مستند کرده", () => {
  for (const t of D14) {
    const st = t.columns.find((c) => c.name === "Status");
    if (!st) continue;
    assert.equal(st.nullable, false, `${t.name}.Status باید اجباری باشد`);
    assert.ok(st.comment && st.comment.includes("|"), `${t.name}.Status فهرست مقادیر مجاز ندارد`);
  }
});

test("هر جدول d14 کلید اصلی و ProjectId دارد", () => {
  for (const t of D14) {
    assert.equal(t.pk, "Id", `${t.name} کلید اصلی ندارد`);
    assert.ok(t.columns.some((c) => c.name === "ProjectId"), `${t.name} ستون ProjectId ندارد`);
  }
});

test("جداول محوری کلید طبیعی یکتا دارند", () => {
  const expect = {
    ContractMaster: ["ProjectId", "Code"],
    ContractBOQ_Item: ["ContractId", "ItemNo"],
    InterimPaymentCertificate: ["ContractId", "SerialNo"],
    IPC_LineItem: ["IpcId", "BoqItemId"],
    LumpSumMilestone: ["BoqItemId", "MilestoneNo"],
    PriceAdjustmentCalculation: ["IpcId", "ChapterCode"],
    AdjustmentIndexCatalog: ["ProjectId", "IndexPeriod", "ChapterCode"],
  };
  for (const [name, cols] of Object.entries(expect)) {
    const t = byName(name);
    const ux = (t.indexes ?? []).find((i) => i.unique);
    assert.ok(ux, `${name} ایندکس یکتا ندارد`);
    assert.deepEqual(ux.columns, cols, `کلید طبیعی ${name} مطابق طراحی نیست`);
  }
});

test("ایندکس پیمایش انقضای ضمانت‌نامه وجود دارد", () => {
  /* هشدار روزانه روی این ایندکس پیمایش می‌کند؛ نبودش یعنی اسکن کامل. */
  const t = byName("ContractGuarantee");
  const ix = (t.indexes ?? []).find((i) => i.name === "IX_Guarantee_Expiry");
  assert.ok(ix);
  assert.deepEqual(ix.columns, ["ProjectId", "ExpiryDate", "Status"]);
});

test("هیچ کلید خارجی سختی بین d14 و ماژول دیگر نیست", () => {
  /* ارجاع بین‌ماژولی نرم است تا حذف رکورد ماژول دیگر پیمان را قفل نکند. */
  for (const t of D14) {
    for (const fk of t.foreignKeys ?? []) {
      const ref = byName(fk.refTable);
      assert.equal(ref?.module, "d14", `${t.name}.${fk.column} کلید خارجی سخت به ${fk.refTable} دارد`);
    }
  }
});

/* ══════ اعتبارسنجی ردیف دوحالته ══════ */

const upItem = {
  Id: "b1", ProjectId: "p", ContractId: "c1", ItemNo: "010101", TitleFa: "بتن‌ریزی",
  PricingBasis: "unit_price", Unit: "مترمکعب", ContractQty: 100, UnitRate: 5_000_000,
  LineAmount: 500_000_000, ChapterCode: "01", Status: "active",
};
const lsItem = {
  Id: "b2", ProjectId: "p", ContractId: "c1", ItemNo: "020101", TitleFa: "مهندسی پایه",
  PricingBasis: "lump_sum", LumpSumAmount: 800_000_000, LineAmount: 800_000_000,
  ChapterCode: "02", Status: "active",
};

test("ردیف فهرست‌بهایی معتبر ایرادی ندارد", () => {
  assert.deepEqual(validateBoqItem(upItem), []);
});

test("ردیف مقطوع معتبر ایرادی ندارد", () => {
  assert.deepEqual(validateBoqItem(lsItem), []);
});

test("ردیف فهرست‌بهایی بدون واحد و نرخ رد می‌شود", () => {
  const bad = { ...upItem, Unit: null, UnitRate: null };
  const codes = validateBoqItem(bad).map((i) => i.code);
  assert.ok(codes.includes("CNT-BOQ-UNIT"));
  assert.ok(codes.includes("CNT-BOQ-RATE"));
});

test("ردیف مقطوع با مقدار و نرخ رد می‌شود", () => {
  /* اگر مقدار دارد، حالتش فهرست‌بهایی است نه مقطوع — ترکیب بی‌معناست. */
  const bad = { ...lsItem, ContractQty: 5, UnitRate: 100 };
  const codes = validateBoqItem(bad).map((i) => i.code);
  assert.ok(codes.includes("CNT-BOQ-LS-MIXED"));
});

test("ردیف فهرست‌بهایی با مبلغ مقطوع رد می‌شود", () => {
  const bad = { ...upItem, LumpSumAmount: 1000 };
  assert.ok(validateBoqItem(bad).some((i) => i.code === "CNT-BOQ-MIXED"));
});

test("مغایرت مبلغ ردیف با حاصل‌ضرب کشف می‌شود", () => {
  const bad = { ...upItem, LineAmount: 999_000_000 };
  const issue = validateBoqItem(bad).find((i) => i.code === "CNT-BOQ-AMOUNT");
  assert.ok(issue);
  assert.match(issue.messageFa, /نمی‌خواند/);
});

test("مقدار و نرخ منفی رد می‌شود", () => {
  const codes = validateBoqItem({ ...upItem, ContractQty: -5, LineAmount: -25_000_000 }).map((i) => i.code);
  assert.ok(codes.includes("CNT-BOQ-QTY-NEG"));
});

test("حالت ارزش‌گذاری ناشناخته رد می‌شود", () => {
  assert.ok(validateBoqItem({ ...upItem, PricingBasis: "cost_plus" }).some((i) => i.code === "CNT-BOQ-BASIS"));
});

test("شمارهٔ ردیف تکراری و والد ناموجود کشف می‌شود", () => {
  const r = validateBoq([upItem, { ...lsItem, ItemNo: "010101" }, { ...upItem, Id: "b3", ItemNo: "030101", ParentItemNo: "999" }]);
  const codes = r.issues.map((i) => i.code);
  assert.ok(codes.includes("CNT-BOQ-DUP"));
  assert.ok(codes.includes("CNT-BOQ-ORPHAN"));
});

test("جمع فهرست بها به تفکیک حالت گزارش می‌شود", () => {
  const r = validateBoq([upItem, lsItem]);
  assert.equal(r.ok, true);
  assert.equal(r.byBasis.unit_price, 500_000_000);
  assert.equal(r.byBasis.lump_sum, 800_000_000);
  assert.equal(r.totalAmount, 1_300_000_000);
});

/* ══════ مبلغ ردیف و رول‌آپ ══════ */

test("مبلغ ردیف در هر دو حالت درست محاسبه می‌شود", () => {
  assert.equal(lineAmount(upItem), 500_000_000);
  assert.equal(lineAmount(lsItem), 800_000_000);
});

test("رول‌آپ فصل، سهم درصدی و تفکیک حالت می‌دهد", () => {
  const r = boqRollup([upItem, lsItem, { ...upItem, Id: "b4", ItemNo: "010102", LineAmount: 200_000_000, ContractQty: 40 }]);
  assert.equal(r.total, 1_500_000_000);
  const ch01 = r.chapters.find((c) => c.chapterCode === "01");
  assert.equal(ch01.amount, 700_000_000);
  assert.equal(ch01.itemCount, 2);
  assert.equal(ch01.byBasis.unit_price, 700_000_000);
  /* بزرگ‌ترین فصل اول می‌آید. */
  assert.equal(r.chapters[0].chapterCode, "02");
});

test("ردیف لغوشده در جمع نمی‌آید", () => {
  const r = boqRollup([upItem, { ...lsItem, Status: "cancelled" }]);
  assert.equal(r.total, 500_000_000);
});

/* ══════ ریزمتره ══════ */

test("مقدار ریزمتره از ابعاد محاسبه می‌شود", () => {
  assert.equal(measurementQuantity({ BoqItemId: "b1", Count: 2, Length: 10, Width: 3, Height: 0.5 }), 30);
});

test("ابعاد نانوشته حذف می‌شوند نه صفر", () => {
  /* سطری که فقط طول دارد باید همان طول را بدهد؛ ضرب در صفر، متره را
   * بی‌صدا صفر می‌کند — منبع کلاسیک خطا. */
  assert.equal(measurementQuantity({ BoqItemId: "b1", Length: 25 }), 25);
  assert.equal(measurementQuantity({ BoqItemId: "b1", Count: 4, Length: 2.5 }), 10);
});

test("ضریب در مقدار اعمال می‌شود", () => {
  assert.equal(measurementQuantity({ BoqItemId: "b1", Count: 1, Length: 10, Factor: 0.85 }), 8.5);
});

test("سطر تهی صفر می‌دهد نه یک", () => {
  assert.equal(measurementQuantity({ BoqItemId: "b1" }), 0);
});

test("جمع ریزمتره مغایرت مقدار ذخیره‌شده را گزارش می‌کند", () => {
  const rows = [
    { BoqItemId: "b1", SheetNo: 1, Count: 2, Length: 10, Width: 1, Quantity: 20 },
    { BoqItemId: "b1", SheetNo: 2, Count: 1, Length: 5, Width: 1, Quantity: 99 },
  ];
  const r = measurementTotal(rows);
  assert.equal(r.rowCount, 2);
  assert.equal(r.total, 119);
  assert.equal(r.mismatches.length, 1);
  assert.equal(r.mismatches[0].sheetNo, 2);
  assert.equal(r.mismatches[0].computed, 5);
});

/* ══════ مرز همگرایی دو حالت ══════ */

test("ارزش کسب‌شدهٔ فهرست‌بهایی از مقدار و نرخ می‌آید", () => {
  const r = lineEarnedValue({ item: upItem, prevQty: 30, cumQty: 50 });
  assert.equal(r.basis, "unit_price");
  assert.equal(r.currentQty, 20);
  assert.equal(r.earnedCurrent, 100_000_000);
  assert.equal(r.earnedCumulative, 250_000_000);
  assert.equal(r.earnedPrevious, 150_000_000);
  assert.equal(r.currentPct, null);
});

test("ارزش کسب‌شدهٔ مقطوع از درصد مرحله می‌آید", () => {
  const r = lineEarnedValue({ item: lsItem, prevPct: 25, cumPct: 60 });
  assert.equal(r.basis, "lump_sum");
  assert.equal(r.currentPct, 35);
  assert.equal(r.earnedCurrent, 280_000_000);
  assert.equal(r.earnedCumulative, 480_000_000);
  assert.equal(r.currentQty, null);
});

test("دو حالت با ارزش برابر، خروجی ریالی یکسان می‌دهند", () => {
  /* قلب ADR-CNT-11: پایین‌دست نباید بفهمد کدام حالت بوده است. */
  const up = lineEarnedValue({ item: { PricingBasis: "unit_price", UnitRate: 1000, LineAmount: 100_000 }, prevQty: 0, cumQty: 50 });
  const ls = lineEarnedValue({ item: { PricingBasis: "lump_sum", LumpSumAmount: 100_000, LineAmount: 100_000 }, prevPct: 0, cumPct: 50 });
  assert.equal(up.earnedCurrent, ls.earnedCurrent);
  assert.equal(up.earnedCumulative, ls.earnedCumulative);
});

test("جاری همیشه مشتق تجمعی است نه عدد مستقل", () => {
  /* اگر جاری مستقل ذخیره شود، اصلاح صورت‌وضعیت قدیمی زنجیره را می‌شکند. */
  const r = lineEarnedValue({ item: upItem, prevQty: 80, cumQty: 80 });
  assert.equal(r.currentQty, 0);
  assert.equal(r.earnedCurrent, 0);
  assert.equal(r.earnedCumulative, 400_000_000);
});

test("کاهش مقدار تجمعی، کارکرد منفی می‌دهد نه صفر", () => {
  /* اصلاح رو به پایین در صورت‌وضعیت بعدی واقعی است و باید دیده شود. */
  const r = lineEarnedValue({ item: upItem, prevQty: 60, cumQty: 50 });
  assert.equal(r.currentQty, -10);
  assert.equal(r.earnedCurrent, -50_000_000);
});

/* ══════ مراحل مقطوع ══════ */

test("فقط مرحلهٔ تأییدشده پیشرفت می‌دهد", () => {
  const ms = [
    { Id: "m1", BoqItemId: "b2", MilestoneNo: 1, TitleFa: "الف", WeightPct: 30, Status: "verified" },
    { Id: "m2", BoqItemId: "b2", MilestoneNo: 2, TitleFa: "ب", WeightPct: 30, Status: "claimed" },
    { Id: "m3", BoqItemId: "b2", MilestoneNo: 3, TitleFa: "ج", WeightPct: 40, Status: "pending" },
  ];
  const r = milestoneProgress(ms);
  assert.equal(r.cumPct, 30);
  assert.equal(r.verifiedCount, 1);
  assert.equal(r.claimedCount, 1);
  assert.equal(r.weightIssueFa, null);
});

test("جمع وزن مراحل غیر از صد هشدار می‌دهد", () => {
  const r = milestoneProgress([
    { Id: "m1", BoqItemId: "b2", MilestoneNo: 1, TitleFa: "الف", WeightPct: 40, Status: "verified" },
    { Id: "m2", BoqItemId: "b2", MilestoneNo: 2, TitleFa: "ب", WeightPct: 40, Status: "pending" },
  ]);
  assert.match(r.weightIssueFa, /۸۰|80/);
});

test("درصد تحقق از صد بیشتر نمی‌شود", () => {
  const r = milestoneProgress([
    { Id: "m1", BoqItemId: "b2", MilestoneNo: 1, TitleFa: "الف", WeightPct: 70, Status: "verified" },
    { Id: "m2", BoqItemId: "b2", MilestoneNo: 2, TitleFa: "ب", WeightPct: 60, Status: "verified" },
  ]);
  assert.equal(r.cumPct, 100);
});

/* ══════ سقف ۲۵٪ ══════ */

test("سقف بر مبنای مبلغ اولیه سنجیده می‌شود نه جاری", () => {
  /* اگر مبنا جاری بود، هر الحاقیه سقف را بالا می‌برد و کنترل بی‌معنا می‌شد. */
  const r = contractCeiling({ initialAmount: 1_000_000_000, executedAmount: 1_200_000_000 });
  assert.equal(r.ceilingAmount, 1_250_000_000);
  assert.equal(r.usedPct, 120);
  assert.equal(r.status, "warning");
  assert.equal(r.remainingAmount, 50_000_000);
});

test("عبور از سقف با وضعیت exceeded گزارش می‌شود", () => {
  const r = contractCeiling({ initialAmount: 1_000_000_000, executedAmount: 1_300_000_000 });
  assert.equal(r.status, "exceeded");
  assert.match(r.messageFa, /الحاقیه|درخواست تغییر/);
});

test("کارکرد در محدودهٔ عادی وضعیت ok می‌دهد", () => {
  const r = contractCeiling({ initialAmount: 1_000_000_000, executedAmount: 600_000_000 });
  assert.equal(r.status, "ok");
  assert.equal(r.usedPct, 60);
});

test("درصد سقف قابل تنظیم است و آستانهٔ هشدار با آن جابه‌جا می‌شود", () => {
  /* هشدار وقتی است که ۸۰٪ مجازِ افزایش مصرف شده باشد؛ با سقف ۱۰٪ یعنی
   * ۱۰۸٪، پس ۱۰۵٪ هنوز عادی است و ۱۰۹٪ هشدار می‌گیرد. */
  const base = { initialAmount: 1_000_000_000, ceilingPct: 10 };
  assert.equal(contractCeiling({ ...base, executedAmount: 1_050_000_000 }).ceilingAmount, 1_100_000_000);
  assert.equal(contractCeiling({ ...base, executedAmount: 1_050_000_000 }).status, "ok");
  assert.equal(contractCeiling({ ...base, executedAmount: 1_090_000_000 }).status, "warning");
  assert.equal(contractCeiling({ ...base, executedAmount: 1_150_000_000 }).status, "exceeded");
});

test("مبلغ اولیهٔ صفر سقف را نمی‌شکند", () => {
  const r = contractCeiling({ initialAmount: 0, executedAmount: 0 });
  assert.equal(r.usedPct, 0);
  assert.ok(Number.isFinite(r.usedPct));
});

/* ══════ کار جدید ══════ */

test("کار جدید بدون نرخ مصوب در جمع مالی نمی‌آید", () => {
  const r = extraWorkBillable({ RateStatus: "rate_pending", Status: "rate_pending" });
  assert.equal(r.billable, false);
  assert.match(r.reasonFa, /نرخ/);
});

test("کار جدید با نرخ توافق‌شده قابل درج است", () => {
  assert.equal(extraWorkBillable({ RateStatus: "agreed", Status: "agreed", AgreedRate: 500 }).billable, true);
});

test("نرخ مورد اختلاف قابل درج نیست", () => {
  assert.equal(extraWorkBillable({ RateStatus: "disputed", AgreedRate: 500 }).billable, false);
});

/* ══════ دروازهٔ کیفی ══════ */

const inspections = [
  { Code: "IR-001", ActivityId: "A-1", Outcome: "accepted" },
  { Code: "IR-002", ActivityId: "A-2", Outcome: "rejected" },
];

test("کارکرد با تأییدیهٔ بازرسی عبور می‌کند", () => {
  const r = qualityGate({ activityId: "A-1", inspections });
  assert.equal(r.passed, true);
  assert.equal(r.status, "passed");
});

test("کارکرد بدون تأییدیه رد می‌شود", () => {
  const r = qualityGate({ activityId: "A-9", inspections });
  assert.equal(r.passed, false);
  assert.equal(r.code, "E-CNT-NO-IR");
});

test("بازرسی ردشده معادل نبود تأییدیه است", () => {
  const r = qualityGate({ activityId: "A-2", inspections });
  assert.equal(r.passed, false);
});

test("عدم انطباق باز مانع ثبت می‌شود حتی با تأییدیه", () => {
  const r = qualityGate({ activityId: "A-1", inspections, openNcrActivityIds: ["A-1"] });
  assert.equal(r.passed, false);
  assert.equal(r.code, "E-CNT-OPEN-NCR");
});

test("دور زدن دروازه ثبت می‌شود و در وضعیت پیداست", () => {
  /* دروازه بسته است ولی کلید دارد؛ استفاده از کلید باید در ممیزی دیده شود. */
  const r = qualityGate({ activityId: "A-9", inspections, override: { by: "u-pm", reasonFa: "بازرسی با تأخیر ثبت می‌شود" } });
  assert.equal(r.passed, true);
  assert.equal(r.status, "overridden");
  assert.match(r.messageFa, /u-pm/);
});

test("ارجاع مستقیم به کد بازرسی هم پذیرفته است", () => {
  assert.equal(qualityGate({ inspectionRecordCode: "IR-001", inspections }).passed, true);
});

/* ══════ نگاشت ══════ */

test("پوشش نگاشت WBS و CBS محاسبه می‌شود", () => {
  const r = mappingCoverage([
    { ...upItem, WbsId: "W-1", CostAccountCode: "CA-1" },
    { ...lsItem, WbsId: null, CostAccountCode: "CA-2" },
  ]);
  assert.equal(r.total, 2);
  assert.equal(r.wbsCoveragePct, 50);
  assert.equal(r.cbsCoveragePct, 100);
  assert.deepEqual(r.unmappedWbs, ["020101"]);
  assert.match(r.noteFa, /دیده نمی‌شود/);
});

/* ══════ خلاصهٔ پیمان ══════ */

const contract = {
  Id: "c1", ProjectId: "p", Code: "C-1404-118", TitleFa: "پیمان نمونه",
  ContractType: "mixed", InitialAmount: 1_300_000_000, CurrentAmount: 1_300_000_000,
  CeilingPct: 25, RetainagePct: 10, Status: "active",
};

test("خلاصهٔ پیمان اجزای کلیدی را می‌دهد", () => {
  const s = contractSummary({ contract, items: [upItem, lsItem], executedAmount: 700_000_000 });
  assert.equal(s.boqTotal, 1_300_000_000);
  assert.equal(s.boqVarianceFa, null);
  assert.equal(s.ceiling.status, "ok");
  assert.equal(s.validation.ok, true);
  assert.equal(s.chapters.length, 2);
});

test("اختلاف جمع فهرست بها با مبلغ پیمان اعلام می‌شود", () => {
  /* اختلاف یعنی یا ردیفی جا افتاده یا الحاقیه‌ای در فهرست منعکس نشده. */
  const s = contractSummary({ contract: { ...contract, InitialAmount: 2_000_000_000 }, items: [upItem, lsItem] });
  assert.ok(s.boqVarianceFa);
  assert.match(s.boqVarianceFa, /اختلاف/);
});

test("الحاقیهٔ مصوب در مبلغ مورد انتظار لحاظ می‌شود", () => {
  const s = contractSummary({
    contract: { ...contract, InitialAmount: 1_000_000_000 },
    items: [upItem, lsItem],
    amendments: [{ AmountDelta: 300_000_000, Status: "approved" }, { AmountDelta: 500_000_000, Status: "draft" }],
  });
  assert.equal(s.amendmentDelta, 300_000_000);
  /* ۱۰۰۰ + ۳۰۰ = ۱۳۰۰ برابر جمع فهرست بها، پس اختلافی نیست. */
  assert.equal(s.boqVarianceFa, null);
});

test("نسخهٔ موتور اعلام شده است", () => {
  assert.equal(CNT_VERSION, "cnt-v1");
});
