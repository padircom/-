/* آزمون اسکریپت مهاجرت CntIpcCertificate → InterimPaymentCertificate
 * (ADR-CNT-IPC-UNIFY فاز ۳ / بند ۳) — مستقیم روی درایور JSON، بدون سرور HTTP. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRepository, JsonFileDriver } from "./persistence/driver.mjs";
import { runMigration } from "../scripts/migrate-cntipc-to-core.mjs";
import { normalizeIpcTemplate, normalizeIpcInputs, computeTemplateIpc } from "./cntIpcLogic.js";

const PID = "c1-p1";

async function withTempRepo(fn) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "cntipc-migrate-"));
  const repo = createRepository(new JsonFileDriver(dataDir));
  try { return await fn(repo); } finally { await rm(dataDir, { recursive: true, force: true }); }
}

/* عیناً همان نمونهٔ طلایی CNT-1: ناخالص ۱۶٬۰۰۰ ← خالص ۱۳٬۶۸۰. */
const TEMPLATE_DEF = {
  Code: "MIGTPL", TitleFa: "قالب آزمون مهاجرت", ContractCode: "MIGCON",
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
};
const INPUTS_DEF = [
  { ItemCode: "R01", Quantity: 10, UnitRate: 1000 },
  { ItemCode: "R02", Amount: 5000 },
  { ItemCode: "R03", Percent: 20 },
];

async function seedContract(r, code = "MIGCON") {
  return r.create("ContractMaster", {
    ProjectId: PID, Code: code, TitleFa: "پیمان آزمون مهاجرت", ContractType: "lump_sum", Party: "client",
    EmployerName: "کارفرما", ContractorName: "پیمانکار", SignDate: "2026-01-01", StartDate: "2026-01-01",
    DurationDays: 365, InitialAmount: 1_000_000, CurrentAmount: 1_000_000, Currency: "IRR",
    CeilingPct: 25, RetainagePct: 5, AdjustmentEnabled: false, Status: "active",
  }, "u-admin", "con");
}

async function seedCertificate(r, { periodNo, status = "approved", contractCode = "MIGCON" } = {}) {
  const template = normalizeIpcTemplate(TEMPLATE_DEF);
  const inputs = normalizeIpcInputs(INPUTS_DEF);
  const computation = computeTemplateIpc(template, inputs);
  return r.create("CntIpcCertificate", {
    ProjectId: PID, TemplateCode: TEMPLATE_DEF.Code, TemplateVersion: 1, ContractCode: contractCode,
    PeriodNo: periodNo, PeriodFrom: "2026-01-01", PeriodTo: "2026-01-31", Currency: "IRR",
    InputsJson: inputs, ComputationJson: computation,
    GrossAmount: computation.grossAmount, DeductionTotal: computation.deductionTotal, NetAmount: computation.netAmount,
    Status: status, ModelVersion: "cnt-ipc-v1",
  }, "u-admin", "cntipc");
}

test("مهاجرت: dry-run چیزی نمی‌نویسد ولی گزارش اختلاف صفر می‌دهد", async () => {
  await withTempRepo(async (r) => {
    await seedContract(r);
    await seedCertificate(r, { periodNo: 1 });
    const report = await runMigration({ repo: r, projectId: PID, apply: false });
    assert.equal(report.summary.total, 1);
    assert.equal(report.summary.dryRunOk, 1);
    assert.equal(report.summary.zeroDiff, true);
    const afterCount = (await r.list("InterimPaymentCertificate", { limit: 10 })).length;
    assert.equal(afterCount, 0, "dry-run نباید چیزی بنویسد");
  });
});

test("مهاجرت: --apply رکورد هسته می‌سازد با اعداد طلایی ۱۶۰۰۰/۱۳۶۸۰ و LegacyRef درست", async () => {
  await withTempRepo(async (r) => {
    const contract = await seedContract(r);
    const cert = await seedCertificate(r, { periodNo: 1 });
    const report = await runMigration({ repo: r, projectId: PID, apply: true });
    assert.equal(report.summary.migrated, 1);
    assert.equal(report.summary.zeroDiff, true);

    const ipcs = await r.list("InterimPaymentCertificate", { limit: 10 });
    assert.equal(ipcs.length, 1);
    const ipc = ipcs[0];
    assert.equal(ipc.ContractId, contract.Id);
    assert.equal(ipc.LegacyRef, `cntipc:${cert.Id}`);
    assert.equal(ipc.GrossCurrent, 16_000);
    assert.equal(ipc.TotalDeductions, 2_320);
    assert.equal(ipc.NetPayable, 13_680);
    assert.equal(ipc.WorkflowState, "approved"); // status=approved → approved
    assert.equal(ipc.SerialNo, 1);

    const lines = await r.list("IPC_LineItem", { where: [{ column: "IpcId", op: "eq", value: ipc.Id }], limit: 10 });
    assert.equal(lines.length, 3);
    assert.ok(lines.every((l) => String(l.BoqItemId).startsWith("cntipc-item:")));

    const deds = await r.list("IPC_Deduction", { where: [{ column: "IpcId", op: "eq", value: ipc.Id }], limit: 10 });
    assert.equal(deds.length, 2);
    assert.ok(deds.find((d) => d.DeductionType === "retainage" && d.Amount === 800));
    assert.ok(deds.find((d) => d.DeductionType === "advance_recovery" && d.Amount === 1520 && d.BaseAmount === 15200));
  });
});

test("مهاجرت: ایدمپوتنت — اجرای دوم رکورد تازه نمی‌سازد", async () => {
  await withTempRepo(async (r) => {
    await seedContract(r);
    await seedCertificate(r, { periodNo: 1 });
    await runMigration({ repo: r, projectId: PID, apply: true });
    const countAfterFirst = (await r.list("InterimPaymentCertificate", { limit: 10 })).length;

    const report2 = await runMigration({ repo: r, projectId: PID, apply: true });
    assert.equal(report2.summary.migrated, 0);
    assert.equal(report2.summary.alreadyMigrated, 1);
    const countAfterSecond = (await r.list("InterimPaymentCertificate", { limit: 10 })).length;
    assert.equal(countAfterSecond, countAfterFirst, "اجرای دوم نباید رکورد تازه بسازد");
  });
});

test("مهاجرت: گواهی بدون ContractCode معتبر نادیده گرفته می‌شود، نه حدس زده", async () => {
  await withTempRepo(async (r) => {
    await seedCertificate(r, { periodNo: 1, contractCode: "NOPE" }); // پیمانی با این کد ساخته نشده
    const report = await runMigration({ repo: r, projectId: PID, apply: true });
    assert.equal(report.summary.skipped, 1);
    assert.equal(report.summary.migrated, 0);
    assert.match(report.results[0].reasonFa, /یافت نشد/);
  });
});

test("مهاجرت: نگاشت وضعیت‌ها طبق مشخصات انجام می‌شود (submitted→contractor_submitted، returned→draft)", async () => {
  await withTempRepo(async (r) => {
    await seedContract(r, "MIGCON2");
    await seedCertificate(r, { periodNo: 1, status: "submitted", contractCode: "MIGCON2" });
    await seedCertificate(r, { periodNo: 2, status: "returned", contractCode: "MIGCON2" });
    const report = await runMigration({ repo: r, projectId: PID, apply: true });
    assert.equal(report.summary.migrated, 2);
    const ipcs = await r.list("InterimPaymentCertificate", { limit: 10 });
    const submitted = ipcs.find((i) => i.SerialNo === 1);
    const returned = ipcs.find((i) => i.SerialNo === 2);
    assert.equal(submitted.WorkflowState, "contractor_submitted");
    assert.equal(returned.WorkflowState, "draft");
  });
});

test("مهاجرت: سریال‌های پیمان موجود رعایت می‌شود (بدون تصادم با IPC هستهٔ از قبل موجود)", async () => {
  await withTempRepo(async (r) => {
    const contract = await seedContract(r);
    await r.create("InterimPaymentCertificate", {
      ProjectId: PID, ContractId: contract.Id, SerialNo: 1, IpcType: "interim", PeriodCode: "X-1",
      PeriodFrom: "2025-01-01", PeriodTo: "2025-01-31", GrossCurrent: 1, GrossCumulative: 1,
      SubtotalAmount: 1, TotalDeductions: 0, NetPayable: 1, WorkflowState: "paid", PostedToFin: true, Status: "open",
    }, "u-admin", "ipc");
    await seedCertificate(r, { periodNo: 1 });
    const report = await runMigration({ repo: r, projectId: PID, apply: true });
    assert.equal(report.summary.migrated, 1);
    const migrated = report.results.find((x) => x.status === "migrated");
    assert.equal(migrated.serialNo, 2, "باید بعد از سریال موجود ۱ عدد ۲ بگیرد");
  });
});
