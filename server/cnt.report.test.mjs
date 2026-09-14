/**
 * MOD-14 / D11 + D12 — آزمون موتور گزارش‌های پیمان.
 *
 * اصل محوری که آزموده می‌شود: **گزارش هیچ عددی نمی‌سازد.** هر رقمی که
 * چاپ می‌شود باید عیناً از ورودی آمده باشد، و مقدار غایب باید «—» شود
 * نه صفر.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CNT_REPORT_CATALOG,
  getCntReport,
  isCntAudienceAllowed,
  buildCntReport,
} from "./cntLogic.js";
import { toPrintHtml, toExcelHtml, toCsv, exportFileName } from "./rptLogic.js";

const CONTRACT = {
  Id: "c1", Code: "P-100", TitleFa: "احداث سالن تولید",
  ContractorName: "شرکت آلفا", ConsultantName: "مهندسین بتا", EmployerName: "کارفرمای گاما",
  InitialAmount: 1_000_000, CurrentAmount: 1_200_000,
};

const LH = {
  projectName: "پروژهٔ آزمون", projectCode: "PRJ", contractNo: "P-100",
  contractor: { name: "آلفا", logoText: "A", role: { fa: "پیمانکار", en: "Contractor" } },
  client: { name: "گاما", logoText: "G", role: { fa: "کارفرما", en: "Client" } },
  consultant: { name: "بتا", logoText: "B", role: { fa: "مشاور", en: "Consultant" } },
  docNo: "PRJ-RPT-CNT-IPC-001-R00", revision: "00", issueDate: "1404-06-19",
  periodLabel: "شهریور ۱۴۰۴", classification: "internal",
  preparedBy: "u-contracts", approvedBy: "u-client",
  distribution: ["کارفرما", "مشاور"],
};

/* ═══════════ ۱. کاتالوگ و مخاطب ═══════════ */

test("هشت گزارش تعریف شده و کدها یکتاست", () => {
  assert.equal(CNT_REPORT_CATALOG.length, 8);
  assert.equal(new Set(CNT_REPORT_CATALOG.map((r) => r.code)).size, 8);
  for (const r of CNT_REPORT_CATALOG) assert.ok(r.code.startsWith("RPT-CNT-"), r.code);
});

test("هر گزارش هدف و عنوان دوزبانه دارد", () => {
  for (const r of CNT_REPORT_CATALOG) {
    assert.ok(r.title.fa && r.title.en, `${r.code} عنوان ناقص`);
    assert.ok(r.purpose.fa.length > 20, `${r.code} هدف باید توضیح بدهد`);
    assert.ok(r.audiences.length > 0, `${r.code} مخاطب ندارد`);
  }
});

test("گزارش‌های حساس فقط داخلی‌اند", () => {
  /* رابطهٔ مالی با جزء، مغایرت دفاتر و نمرهٔ سلامت هیچ‌کدام نباید در
     سندی بروند که ممکن است پیوست نامهٔ اداری یا مدرک دعوا شود. */
  for (const code of ["RPT-CNT-SUB", "RPT-CNT-FIN", "RPT-CNT-EXEC"]) {
    const d = getCntReport(code);
    assert.deepEqual(d.audiences, ["internal"], `${code} نباید رسمی باشد`);
    assert.equal(isCntAudienceAllowed(code, "official"), false);
  }
});

test("گزارش‌های سندی برای مخاطب رسمی مجازند", () => {
  for (const code of ["RPT-CNT-IPC", "RPT-CNT-BOQ", "RPT-CNT-PRG", "RPT-CNT-GRT", "RPT-CNT-DED"]) {
    assert.equal(isCntAudienceAllowed(code, "official"), true, code);
    assert.equal(isCntAudienceAllowed(code, "internal"), true, code);
  }
});

test("کد ناشناخته به هیچ مخاطبی داده نمی‌شود", () => {
  assert.equal(isCntAudienceAllowed("RPT-CNT-GHOST", "internal"), false);
  assert.equal(isCntAudienceAllowed("RPT-CNT-GHOST", "official"), false);
  assert.equal(getCntReport("RPT-CNT-GHOST"), undefined);
});

test("گزارش ناشناخته ساخته نمی‌شود", () => {
  assert.equal(buildCntReport("RPT-CNT-GHOST", { contract: CONTRACT }), null);
});

/* ═══════════ ۲. سربرگ مشترک ═══════════ */

test("هر گزارش با شناسهٔ پیمان شروع می‌شود", () => {
  /* برگه‌ای که از پرونده جدا شود باید خودش بگوید مال کدام پیمان است. */
  for (const def of CNT_REPORT_CATALOG) {
    const r = buildCntReport(def.code, { contract: CONTRACT });
    assert.ok(r, def.code);
    const head = r.sections[0];
    assert.equal(head.kind, "kpi");
    assert.equal(head.title.fa, "شناسهٔ پیمان");
    assert.ok(head.cells.some((c) => c.value === "P-100"), `${def.code} کد پیمان ندارد`);
  }
});

test("مبلغ جاری بر مبلغ اولیه مقدم است", () => {
  const r = buildCntReport("RPT-CNT-BOQ", { contract: CONTRACT });
  const amount = r.sections[0].cells.find((c) => c.label.fa === "مبلغ پیمان");
  assert.equal(amount.value, "1200000", "الحاقیه باید در سربرگ دیده شود");
});

test("گزارش، ماژول مبدأ را اعلام می‌کند", () => {
  const r = buildCntReport("RPT-CNT-IPC", { contract: CONTRACT });
  assert.equal(r.sourceModule, "d14");
});

/* ═══════════ ۳. برگهٔ صورت‌وضعیت ═══════════ */

const IPC = {
  Id: "i1", SerialNo: 3, PeriodCode: "1404-06",
  GrossCurrent: 200_000, GrossCumulative: 500_000,
  TotalDeductions: 40_000, VatAmount: 18_000, NetPayable: 178_000,
};
const BOQ = [
  { Id: "b1", ItemNo: "030101", TitleFa: "بتن‌ریزی", Unit: "مترمکعب", ContractQty: 100, UnitRate: 1_000, LineAmount: 100_000 },
  { Id: "b2", ItemNo: "040201", TitleFa: "آرماتوربندی", Unit: "کیلوگرم", ContractQty: 5_000, UnitRate: 50, LineAmount: 250_000, IsStarred: true },
];
const LINES = [
  { BoqItemId: "b1", PrevQty: 20, CurrentQty: 20, CumQty: 40, UnitRate: 1_000, EarnedCurrent: 20_000 },
];
const DEDS = [
  { DeductionType: "retainage", BaseAmount: 200_000, RatePct: 10, Amount: 20_000, IsStatutory: false },
  { DeductionType: "insurance", BaseAmount: 200_000, RatePct: 1.6, Amount: 3_200, IsStatutory: true },
];

test("برگهٔ صورت‌وضعیت، خالص و ناخالص را جدا نشان می‌دهد", () => {
  const r = buildCntReport("RPT-CNT-IPC", { contract: CONTRACT, ipc: IPC, ipcLines: LINES, boq: BOQ, deductions: DEDS });
  const kpi = r.sections.find((s) => s.title.fa === "خلاصهٔ صورت‌وضعیت");
  assert.equal(kpi.cells.find((c) => c.label.fa === "ناخالص دوره").value, "200000");
  assert.equal(kpi.cells.find((c) => c.label.fa === "خالص پرداختنی").value, "178000");
});

test("ریزمتره شرح ردیف را از فهرست بها می‌گیرد", () => {
  const r = buildCntReport("RPT-CNT-IPC", { contract: CONTRACT, ipc: IPC, ipcLines: LINES, boq: BOQ });
  const t = r.sections.find((s) => s.kind === "table" && s.title.fa === "ریزمتره");
  assert.equal(t.rows[0].titleFa, "بتن‌ریزی");
  assert.equal(t.rows[0].unit, "مترمکعب");
  assert.equal(t.rows[0].earned, 20_000);
});

test("ردیف بدون تطبیق در فهرست بها، «—» می‌شود نه خطا", () => {
  const r = buildCntReport("RPT-CNT-IPC", {
    contract: CONTRACT, ipc: IPC, boq: BOQ,
    ipcLines: [{ BoqItemId: "ghost", CurrentQty: 5, EarnedCurrent: 100 }],
  });
  const t = r.sections.find((s) => s.title.fa === "ریزمتره");
  assert.equal(t.rows[0].titleFa, "—");
  assert.equal(t.rows[0].earned, 100, "مبلغ باید بماند حتی وقتی شرح نیست");
});

test("کسور قانونی از قراردادی جدا برچسب می‌خورد", () => {
  const r = buildCntReport("RPT-CNT-IPC", { contract: CONTRACT, ipc: IPC, deductions: DEDS, boq: BOQ });
  const t = r.sections.find((s) => s.title.fa === "کسور");
  assert.equal(t.rows.find((x) => x.amount === 3_200).statutory, "بله");
  assert.equal(t.rows.find((x) => x.amount === 20_000).statutory, "خیر");
});

test("نوع کسر برچسب فارسی می‌گیرد", () => {
  const r = buildCntReport("RPT-CNT-IPC", { contract: CONTRACT, ipc: IPC, deductions: DEDS, boq: BOQ });
  const t = r.sections.find((s) => s.title.fa === "کسور");
  assert.notEqual(t.rows[0].type, "retainage", "کد خام نباید چاپ شود");
});

test("بخش تأیید، نام سه طرف را می‌آورد", () => {
  const r = buildCntReport("RPT-CNT-IPC", { contract: CONTRACT, ipc: IPC });
  const t = r.sections.find((s) => s.kind === "text" && s.title.fa === "تأییدها");
  assert.ok(t.body.fa.includes("شرکت آلفا"));
  assert.ok(t.body.fa.includes("مهندسین بتا"));
  assert.ok(t.body.fa.includes("کارفرمای گاما"));
});

/* ═══════════ ۴. فهرست بها ═══════════ */

test("فهرست بها اجراشده را از بیشینهٔ تجمعی می‌گیرد", () => {
  /* اگر جمع می‌زد، ردیفی که در دو صورت‌وضعیت آمده دوبار شمرده می‌شد. */
  const r = buildCntReport("RPT-CNT-BOQ", {
    contract: CONTRACT, boq: BOQ,
    ipcLines: [
      { BoqItemId: "b1", CumQty: 20 },
      { BoqItemId: "b1", CumQty: 40 },
    ],
  });
  const t = r.sections.find((s) => s.kind === "table");
  const row = t.rows.find((x) => x.itemNo === "030101");
  assert.equal(row.doneQty, 40, "بیشینه، نه جمع");
  assert.equal(row.remainQty, 60);
  assert.equal(row.donePct, "40");
});

test("ردیف ستاره‌دار علامت می‌خورد", () => {
  const r = buildCntReport("RPT-CNT-BOQ", { contract: CONTRACT, boq: BOQ });
  const t = r.sections.find((s) => s.kind === "table");
  assert.equal(t.rows.find((x) => x.itemNo === "040201").starred, "★");
  assert.equal(t.rows.find((x) => x.itemNo === "030101").starred, "");
});

test("ردیف بدون اجرا، صفر درصد می‌شود نه «—»", () => {
  /* اینجا صفر واقعاً معنا دارد: ردیف هست و اجرا نشده. */
  const r = buildCntReport("RPT-CNT-BOQ", { contract: CONTRACT, boq: BOQ, ipcLines: [] });
  const t = r.sections.find((s) => s.kind === "table");
  assert.equal(t.rows[0].donePct, "0");
});

test("ردیف با مقدار پیمانی صفر، درصد ندارد", () => {
  const r = buildCntReport("RPT-CNT-BOQ", {
    contract: CONTRACT,
    boq: [{ Id: "x", ItemNo: "01", TitleFa: "مقطوع", ContractQty: 0, LumpSumAmount: 5_000, LineAmount: 5_000 }],
  });
  const t = r.sections.find((s) => s.kind === "table");
  assert.equal(t.rows[0].donePct, "—", "تقسیم بر صفر باید «—» بدهد نه صفر یا NaN");
});

/* ═══════════ ۵. پیشرفت ═══════════ */

test("فاصلهٔ مثبت بزرگ، لحن بد می‌گیرد", () => {
  const r = buildCntReport("RPT-CNT-PRG", {
    contract: CONTRACT,
    progress: { physicalPct: 30, financialPct: 45, gapPct: 15, ceilingUsedPct: 20, isGapReliable: true },
  });
  const kpi = r.sections.find((s) => s.kind === "kpi" && s.title.fa === "پیشرفت");
  assert.equal(kpi.cells.find((c) => c.label.fa === "فاصله").tone, "bad");
});

test("فهرست‌بهای ناقص، هشدار کیفیت داده می‌سازد", () => {
  const r = buildCntReport("RPT-CNT-PRG", {
    contract: CONTRACT,
    progress: { physicalPct: 40, financialPct: 4, gapPct: -36, isGapReliable: false, boqCoveragePct: 10 },
  });
  const w = r.sections.find((s) => s.kind === "text" && s.title.fa === "هشدار کیفیت داده");
  assert.ok(w, "منحنی زیبا روی مخرج غلط بدترین گزارش است");
  assert.ok(w.body.fa.includes("قابل اتکا نیست"));
});

test("پیشرفت قابل اتکا هشدار نمی‌سازد", () => {
  const r = buildCntReport("RPT-CNT-PRG", {
    contract: CONTRACT,
    progress: { physicalPct: 40, financialPct: 40, gapPct: 0, isGapReliable: true, boqCoveragePct: 100 },
  });
  assert.equal(r.sections.some((s) => s.title.fa === "هشدار کیفیت داده"), false);
});

test("منحنی، پیش‌بینی را از واقعی جدا برچسب می‌زند", () => {
  const r = buildCntReport("RPT-CNT-PRG", {
    contract: CONTRACT,
    progress: { physicalPct: 40 },
    sCurve: [
      { periodCode: "1404-05", physicalPct: 30, financialPct: 28, isForecast: false },
      { periodCode: "1404-06", physicalPct: 40, financialPct: 40, isForecast: true },
    ],
  });
  const t = r.sections.find((s) => s.kind === "table");
  assert.equal(t.rows[0].kind, "واقعی");
  assert.equal(t.rows[1].kind, "پیش‌بینی");
});

test("بدون منحنی، جدول منحنی ساخته نمی‌شود", () => {
  const r = buildCntReport("RPT-CNT-PRG", { contract: CONTRACT, progress: { physicalPct: 10 } });
  assert.equal(r.sections.some((s) => s.title.fa === "منحنی پیشرفت"), false,
    "جدول خالی بدتر از نبود جدول است");
});

test("پیشرفت بدون داده، «—» می‌دهد نه صفر", () => {
  const r = buildCntReport("RPT-CNT-PRG", { contract: CONTRACT, progress: {} });
  const kpi = r.sections.find((s) => s.kind === "kpi" && s.title.fa === "پیشرفت");
  assert.equal(kpi.cells.find((c) => c.label.fa === "فیزیکی").value, "—");
});

/* ═══════════ ۶. ضمانت‌نامه و کسور ═══════════ */

test("دفتر ضمانت‌نامه فقط در جریان‌ها را جمع می‌زند", () => {
  const r = buildCntReport("RPT-CNT-GRT", {
    contract: CONTRACT,
    guarantees: [
      { GuaranteeType: "performance", GuaranteeNo: "G1", Amount: 50_000, Status: "active" },
      { GuaranteeType: "advance", GuaranteeNo: "G2", Amount: 200_000, Status: "released" },
    ],
  });
  const kpi = r.sections[1];
  assert.equal(kpi.cells.find((c) => c.label.fa === "در جریان").value, "1");
  assert.equal(kpi.cells.find((c) => c.label.fa === "جمع مبلغ در جریان").value, "50000");
  assert.equal(kpi.cells.find((c) => c.label.fa === "آزادشده").value, "1");
});

test("صورت کسور بر اساس نوع تجمیع می‌شود", () => {
  const r = buildCntReport("RPT-CNT-DED", {
    contract: CONTRACT,
    deductions: [
      { DeductionType: "retainage", Amount: 20_000, IsStatutory: false },
      { DeductionType: "retainage", Amount: 15_000, IsStatutory: false },
      { DeductionType: "insurance", Amount: 3_200, IsStatutory: true },
    ],
  });
  const kpi = r.sections[1];
  assert.equal(kpi.cells.find((c) => c.label.fa === "سپردهٔ حسن انجام کار").value, "35000");
  assert.equal(kpi.cells.find((c) => c.label.fa === "جمع کل").value, "38200");
  const t = r.sections.find((s) => s.kind === "table");
  assert.equal(t.rows.find((x) => x.count === 2).amount, 35_000);
});

test("صورت کسور توضیح می‌دهد سپرده هزینهٔ پروژه نیست", () => {
  const r = buildCntReport("RPT-CNT-DED", { contract: CONTRACT, deductions: [] });
  const t = r.sections.find((s) => s.kind === "table");
  assert.ok(t.note.fa.includes("امانت"), "تفاوت سپرده و هزینه باید در سند نوشته شود");
});

/* ═══════════ ۷. تطبیق مالی و مدیریتی ═══════════ */

test("تطبیق مالی، مغایرت را با لحن بد نشان می‌دهد", () => {
  const r = buildCntReport("RPT-CNT-FIN", {
    contract: CONTRACT,
    reconcile: {
      summary: { inSync: 2, notPosted: 1, amountDrift: 1 },
      rows: [{ serialNo: 3, periodCode: "1404-06", netAmount: 178_000, postedAmount: 150_000, driftAmount: 28_000, stateFa: "مغایرت مبلغ", needsActionFa: "ارسال دوباره" }],
    },
    finSummary: { postedNet: 150_000, withheldAmount: 50_000 },
  });
  const kpi = r.sections[1];
  assert.equal(kpi.cells.find((c) => c.label.fa === "مغایرت مبلغ").tone, "bad");
  assert.equal(kpi.cells.find((c) => c.label.fa === "ارسال‌نشده").tone, "warn");
});

test("گزارش مدیریتی با قضاوت یک‌جمله‌ای شروع می‌شود", () => {
  const r = buildCntReport("RPT-CNT-EXEC", {
    contract: CONTRACT,
    scorecard: { headlineFa: "دو هشدار بحرانی فعال است", health: { score: 42, band: "poor" }, alerts: { criticalCount: 2, fired: [] } },
    progress: { physicalPct: 30, financialPct: 45 },
  });
  const first = r.sections[1];
  assert.equal(first.kind, "text");
  assert.equal(first.body.fa, "دو هشدار بحرانی فعال است");
});

test("مدیریتی حداکثر پنج قلم تصمیم می‌آورد", () => {
  const fired = Array.from({ length: 8 }, (_, i) => ({
    code: `EWS-0${i}`, titleFa: `هشدار ${i}`, severityFa: "بحرانی",
    messageFa: "وضعیت", actionFa: "اقدام",
  }));
  const r = buildCntReport("RPT-CNT-EXEC", {
    contract: CONTRACT,
    scorecard: { headlineFa: "خ", health: {}, alerts: { criticalCount: 8, fired } },
  });
  const t = r.sections.find((s) => s.kind === "table");
  assert.equal(t.rows.length, 5, "یک صفحه یعنی یک صفحه");
});

test("نمرهٔ بی‌داده در مدیریتی «—» می‌شود", () => {
  const r = buildCntReport("RPT-CNT-EXEC", {
    contract: CONTRACT,
    scorecard: { health: { score: null, band: "unknown" }, alerts: {} },
  });
  const kpi = r.sections.find((s) => s.kind === "kpi" && s.title.fa === "شاخص‌های کلیدی");
  assert.equal(kpi.cells.find((c) => c.label.fa === "نمرهٔ سلامت").value, "—");
});

test("بدون هشدار، جدول تصمیم ساخته نمی‌شود", () => {
  const r = buildCntReport("RPT-CNT-EXEC", {
    contract: CONTRACT,
    scorecard: { headlineFa: "سالم", health: { score: 90, band: "good" }, alerts: { criticalCount: 0, fired: [] } },
  });
  assert.equal(r.sections.some((s) => s.title.fa === "قلم‌های نیازمند تصمیم"), false);
});

/* ═══════════ ۸. خروجی چاپ و اکسل (D12) ═══════════ */

test("گزارش به HTML چاپی A4 تبدیل می‌شود", () => {
  const r = buildCntReport("RPT-CNT-IPC", { contract: CONTRACT, ipc: IPC, ipcLines: LINES, boq: BOQ, deductions: DEDS });
  const html = toPrintHtml(r, LH, "official", "fa");
  assert.ok(html.includes("<html"), "سند کامل باید باشد");
  assert.ok(html.includes("210mm") || html.includes("A4"), "قطع A4 باید در CSS باشد");
  assert.ok(html.includes("rtl"), "سند فارسی راست‌چین است");
  assert.ok(html.includes("بتن‌ریزی"), "دادهٔ واقعی باید در خروجی باشد");
});

test("خروجی چاپی سربرگ سه‌لوگویی دارد", () => {
  const r = buildCntReport("RPT-CNT-IPC", { contract: CONTRACT, ipc: IPC });
  const html = toPrintHtml(r, LH, "official", "fa");
  for (const name of ["آلفا", "گاما", "بتا"]) {
    assert.ok(html.includes(name), `${name} در سربرگ نیست`);
  }
  assert.ok(html.includes(LH.docNo), "شماره سند باید چاپ شود");
});

test("گزارش به اکسل تبدیل می‌شود", () => {
  const r = buildCntReport("RPT-CNT-BOQ", { contract: CONTRACT, boq: BOQ });
  const xls = toExcelHtml(r, LH, "fa");
  assert.ok(xls.includes("<table"), "اکسل جدول می‌خواهد");
  assert.ok(xls.includes("آرماتوربندی"));
});

test("گزارش به CSV تبدیل می‌شود", () => {
  const r = buildCntReport("RPT-CNT-BOQ", { contract: CONTRACT, boq: BOQ });
  const csv = toCsv(r, "fa");
  assert.ok(csv.includes("آرماتوربندی"));
  assert.ok(csv.split("\n").length > 2, "سرستون و دست‌کم دو ردیف");
});

test("نام فایل خروجی از کد گزارش و شماره سند ساخته می‌شود", () => {
  const r = buildCntReport("RPT-CNT-IPC", { contract: CONTRACT, ipc: IPC });
  const name = exportFileName(r, LH, "pdf");
  assert.ok(name.endsWith(".pdf"));
  assert.ok(name.includes("RPT-CNT-IPC") || name.includes(LH.docNo));
});

test("متن با کاراکتر خاص در HTML فرار داده می‌شود", () => {
  /* شرح ردیفی که شامل < باشد نباید ساختار سند را بشکند. */
  const r = buildCntReport("RPT-CNT-BOQ", {
    contract: CONTRACT,
    boq: [{ Id: "x", ItemNo: "01", TitleFa: "لوله <۲ اینچ> & اتصالات", ContractQty: 1, UnitRate: 1, LineAmount: 1 }],
  });
  const html = toPrintHtml(r, LH, "internal", "fa");
  assert.ok(!html.includes("<۲ اینچ>"), "تگ خام نباید وارد سند شود");
  assert.ok(html.includes("&lt;") || html.includes("&amp;"), "باید فرار داده شود");
});

test("همهٔ هشت گزارش بدون داده هم ساخته می‌شوند", () => {
  /* پیمان تازه هیچ صورت‌وضعیتی ندارد؛ گزارش باید خالی چاپ شود نه
     اینکه استثنا بیندازد. */
  for (const def of CNT_REPORT_CATALOG) {
    const r = buildCntReport(def.code, { contract: CONTRACT });
    assert.ok(r, `${def.code} ساخته نشد`);
    assert.ok(r.sections.length >= 1, `${def.code} بخشی ندارد`);
    const html = toPrintHtml(r, LH, "internal", "fa");
    assert.ok(html.length > 500, `${def.code} خروجی چاپی ناقص`);
  }
});
