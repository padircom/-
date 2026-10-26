/* آزمون واحد نگاشت قالب → هستهٔ BOQمحور (ADR-CNT-IPC-UNIFY فاز ۳ / بند ۲)
 * و هشدار منسوخی مبنای «running» — بدون سرور، مستقیم روی باندل cntIpcLogic. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeIpcTemplate,
  normalizeIpcInputs,
  computeTemplateIpc,
  mapTemplateIpcToCore,
  CERTIFICATE_STATE_TO_CORE,
  DEDUCTION_KIND_TO_CORE,
  templateRunningBaseWarningsFa,
} from "./cntIpcLogic.js";

/* عیناً همان نمونهٔ طلایی CNT-1 در ADR و server/p8.workspace.rest.test.mjs:
   ناخالص = ۱۰×۱۰۰۰ + ۵۰۰۰ + ۲۰٪×۵۰۰۰ = ۱۶٬۰۰۰
   D01 = ۵٪×۱۶٬۰۰۰ = ۸۰۰ → مانده ۱۵٬۲۰۰
   D02 = ۱۰٪×۱۵٬۲۰۰ = ۱٬۵۲۰ → خالص ۱۳٬۶۸۰ (عدد طلایی که نباید با نگاشت تغییر کند) */
const template = normalizeIpcTemplate({
  Code: "TPLX", TitleFa: "قالب آزمون نگاشت", ContractCode: "CON1",
  Items: [
    { Code: "R01", TitleFa: "ردیف اندازه‌گیری‌شده", Unit: "m3", Basis: "measured", Sign: "+" },
    { Code: "R02", TitleFa: "ردیف مقطوع", Unit: "ls", Basis: "lump", Sign: "+" },
    { Code: "R03", TitleFa: "سهم تجهیزات", Unit: "%", Basis: "percent", PercentOf: "R02", Sign: "+" },
  ],
  Deductions: [
    { Code: "D01", TitleFa: "حسن انجام کار", Kind: "retention", Mode: "percent", Rate: 5, Base: "gross" },
    { Code: "D02", TitleFa: "بازیافت پیش‌پرداخت", Kind: "advance", Mode: "percent", Rate: 10, Base: "running" },
  ],
  NoteFa: null,
});
const inputs = normalizeIpcInputs([
  { ItemCode: "R01", Quantity: 10, UnitRate: 1000 },
  { ItemCode: "R02", Amount: 5000 },
  { ItemCode: "R03", Percent: 20 },
]);
const computation = computeTemplateIpc(template, inputs);

test("نگاشت هسته: عدد طلایی ناخالص/خالص CNT-1 (۱۶٬۰۰۰ ← ۱۳٬۶۸۰) بدون تغییر می‌ماند", () => {
  assert.equal(computation.grossAmount, 16_000);
  assert.equal(computation.deductionTotal, 2_320);
  assert.equal(computation.netAmount, 13_680);
});

test("نگاشت ردیف: BoqItemId مصنوعی و ردیابی‌پذیر، مبنای قیمت‌گذاری درست", () => {
  const mapped = mapTemplateIpcToCore({
    certificateId: "cert-1", status: "draft", periodFrom: "2026-01-01", periodTo: "2026-01-31",
    currency: "IRR", computation,
  });
  const r01 = mapped.lines.find((l) => l.BoqItemId === "cntipc-item:R01");
  assert.ok(r01, "ردیف R01 باید با شناسهٔ مصنوعی نگاشت شود");
  assert.equal(r01.PricingBasis, "unit_price");
  assert.equal(r01.CurrentQty, 10);
  assert.equal(r01.UnitRate, 1000);
  assert.equal(r01.QualityGateStatus, "passed");
  assert.equal(r01.Status, "claimed");

  const r02 = mapped.lines.find((l) => l.BoqItemId === "cntipc-item:R02");
  assert.equal(r02.PricingBasis, "lump_sum");
  assert.equal(r02.CurrentQty, null);
  assert.equal(r02.UnitRate, null);
  assert.equal(r02.EarnedCurrent, 5000);

  const r03 = mapped.lines.find((l) => l.BoqItemId === "cntipc-item:R03");
  assert.equal(r03.PricingBasis, "lump_sum"); // percent هم به lump_sum نگاشت می‌شود
  assert.equal(r03.EarnedCurrent, 1000);
});

test("نگاشت کسر: نوع و BaseAmount عیناً از خروجی محاسبه‌شده می‌آید", () => {
  const mapped = mapTemplateIpcToCore({
    certificateId: "cert-1", status: "draft", periodFrom: "2026-01-01", periodTo: "2026-01-31",
    currency: "IRR", computation,
  });
  assert.equal(mapped.deductions.length, 2);
  assert.equal(DEDUCTION_KIND_TO_CORE.retention, "retainage");
  assert.equal(DEDUCTION_KIND_TO_CORE.advance, "advance_recovery");
  assert.equal(DEDUCTION_KIND_TO_CORE.tax, "withholding_tax");
  for (const [i, d] of mapped.deductions.entries()) {
    assert.equal(d.BaseAmount, computation.deductions[i].BaseAmount, `BaseAmount کسر ${i} باید عیناً منتقل شود`);
    assert.equal(d.Amount, computation.deductions[i].Amount);
  }
  const retention = mapped.deductions.find((d) => d.DeductionType === "retainage");
  assert.equal(retention.BaseAmount, 16_000);
  assert.equal(retention.Amount, 800);
  assert.equal(retention.IsStatutory, false);
  const advance = mapped.deductions.find((d) => d.DeductionType === "advance_recovery");
  assert.equal(advance.BaseAmount, 15_200); // مبنای زنجیره‌ای running: مانده پس از D01
  assert.equal(advance.Amount, 1_520);
  assert.equal(advance.IsStatutory, false);
});

test("نگاشت کسر مالیاتی: IsStatutory=true برای Kind=tax", () => {
  const taxTemplate = normalizeIpcTemplate({
    Code: "TPLTAX", TitleFa: "قالب مالیات", ContractCode: "CON1",
    Items: [{ Code: "R01", TitleFa: "ردیف", Unit: "ls", Basis: "lump", Sign: "+" }],
    Deductions: [{ Code: "DT", TitleFa: "مالیات تکلیفی", Kind: "tax", Mode: "fixed", Rate: 500, Base: "item", ItemCode: "R01" }],
    NoteFa: null,
  });
  const taxComputation = computeTemplateIpc(taxTemplate, normalizeIpcInputs([{ ItemCode: "R01", Amount: 5000 }]));
  const mapped = mapTemplateIpcToCore({
    certificateId: "cert-tax", status: "draft", periodFrom: "2026-01-01", periodTo: "2026-01-31",
    currency: "IRR", computation: taxComputation,
  });
  const tax = mapped.deductions.find((d) => d.DeductionType === "withholding_tax");
  assert.ok(tax);
  assert.equal(tax.IsStatutory, true);
  assert.equal(tax.Amount, 500);
});

test("نگاشت سرجمع: مبلغ‌ها و LegacyRef درست ساخته می‌شوند", () => {
  const mapped = mapTemplateIpcToCore({
    certificateId: "cert-42", status: "approved", periodFrom: "2026-02-01", periodTo: "2026-02-28",
    currency: "IRR", computation,
  });
  assert.equal(mapped.header.GrossCurrent, computation.grossAmount);
  assert.equal(mapped.header.TotalDeductions, computation.deductionTotal);
  assert.equal(mapped.header.NetPayable, computation.netAmount);
  assert.equal(mapped.header.LegacyRef, "cntipc:cert-42");
  assert.equal(mapped.header.WorkflowState, "approved");
});

test("نگاشت وضعیت گردش کار طبق مشخصات: submitted→contractor_submitted، returned→draft", () => {
  assert.equal(CERTIFICATE_STATE_TO_CORE.draft, "draft");
  assert.equal(CERTIFICATE_STATE_TO_CORE.submitted, "contractor_submitted");
  assert.equal(CERTIFICATE_STATE_TO_CORE.approved, "approved");
  assert.equal(CERTIFICATE_STATE_TO_CORE.returned, "draft");
});

test("هشدار منسوخی: کسر با مبنای running هشدار می‌دهد، کسر با مبنای gross/item ساکت است", () => {
  const warnings = templateRunningBaseWarningsFa(template.Deductions);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /D02/);
  assert.match(warnings[0], /منسوخ/);

  const noRunning = templateRunningBaseWarningsFa([
    { Code: "D01", TitleFa: "حسن انجام کار", Base: "gross" },
    { Code: "D03", TitleFa: "مالیات", Base: "item" },
  ]);
  assert.equal(noRunning.length, 0);
});
