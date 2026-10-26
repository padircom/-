#!/usr/bin/env node
/**
 * مهاجرت داده: CntIpcCertificate (CNT-1، قالب‌محور) → InterimPaymentCertificate
 * (هستهٔ BOQمحور) — ADR-CNT-IPC-UNIFY فاز ۳ / بند ۳.
 *
 * ایدمپوتنت: هر گواهی قالب حداکثر یک‌بار مهاجرت می‌کند — با جست‌وجوی
 * `LegacyRef = cntipc:<Id>` روی `InterimPaymentCertificate` تشخیص داده
 * می‌شود؛ اجرای دوم اسکریپت روی همان داده رکورد تازه‌ای نمی‌سازد.
 *
 * هیچ عددی دوباره محاسبه نمی‌شود: ورودیِ نگاشت همان `ComputationJson`ی
 * است که در لحظهٔ محاسبهٔ سرور ذخیره شده (`mapTemplateIpcToCore` در
 * src/services/cntIpc.ts، باندل‌شده در server/cntIpcLogic.js). گزارش پایانی
 * برای هر گواهیِ مهاجرت‌شده اختلافِ (ناخالص/کسور/خالص) نگاشته‌شده را با
 * خودِ گواهی مقایسه می‌کند؛ باید همیشه صفر باشد.
 *
 * گواهی‌هایی که `ContractCode` ندارند یا پیمان متناظرشان در `ContractMaster`
 * یافت نمی‌شود، یا هنوز محاسبه نشده‌اند (`ComputationJson` خالی)، مهاجرت
 * نمی‌شوند و با دلیل صریح در گزارش «نیازمند بررسی دستی» علامت می‌خورند —
 * حدس زدن یک پیمان اشتباه از ساکت ماندن بدتر است.
 *
 * استفاده:
 *   node scripts/migrate-cntipc-to-core.mjs [--project <ProjectId>] [--apply] [--out <path>]
 *
 *   پیش‌فرض اجرا در حالت dry-run است (فقط گزارش، بدون نوشتن). برای نوشتنِ
 *   واقعی رکوردهای هسته باید `--apply` صریح داده شود.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { createPersistence } from "../server/persistence/driver.mjs";
import { mapTemplateIpcToCore } from "../server/cntIpcLogic.js";
import { nextIpcSerial } from "../server/cntLogic.js";

const __filename = fileURLToPath(import.meta.url);
const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === __filename;

function parseArgs(argv) {
  const out = { apply: false, project: null, outFile: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--project") out.project = argv[++i];
    else if (a === "--out") out.outFile = argv[++i];
  }
  return out;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * ادغام کسوراتی که به یک `DeductionType` یکسان نگاشت می‌شوند — چون
 * `IPC_Deduction` روی (IpcId, DeductionType) یکتا است (ردیف قالب اجازهٔ
 * بیش از یک کسر «retention»/«advance» را نمی‌دهد، ولی «tax»/«other» می‌توانند
 * تکرار شوند). مبلغ و مبنا جمع می‌شوند، یادداشت‌ها به هم می‌پیوندند — هیچ
 * عددی گم نمی‌شود.
 */
function mergeDeductionsByType(deductions) {
  const byType = new Map();
  for (const d of deductions) {
    const prev = byType.get(d.DeductionType);
    if (!prev) { byType.set(d.DeductionType, { ...d }); continue; }
    prev.BaseAmount = round2((prev.BaseAmount || 0) + (d.BaseAmount || 0));
    prev.Amount = round2((prev.Amount || 0) + (d.Amount || 0));
    prev.RatePct = null; // بعد از ادغام، یک نرخ واحد معنا ندارد.
    prev.IsStatutory = prev.IsStatutory || d.IsStatutory;
    prev.NoteFa = `${prev.NoteFa} / ${d.NoteFa}`;
  }
  return [...byType.values()];
}

/**
 * یک گواهی را مهاجرت می‌کند. `serials` نگاشت ContractId→آخرین SerialNo
 * مصرف‌شده است (برای جلوگیری از تصادم سریال داخل همین اجرا، چون چند
 * گواهی ممکن است به یک پیمان تعلق داشته باشند).
 */
async function migrateOne(r, cert, { contractsByCode, serials, userId, apply }) {
  const base = { certificateId: cert.Id, templateCode: cert.TemplateCode, periodNo: cert.PeriodNo };

  const existing = await r.findOne("InterimPaymentCertificate", [
    { column: "LegacyRef", op: "eq", value: `cntipc:${cert.Id}` },
  ]);
  if (existing) return { ...base, status: "already_migrated", ipcId: existing.Id, diff: 0 };

  if (!cert.ContractCode) {
    return { ...base, status: "skipped", reasonFa: "گواهی به هیچ کد پیمانی وصل نیست (ContractCode خالی است)" };
  }
  const contract = contractsByCode.get(`${cert.ProjectId}::${cert.ContractCode}`);
  if (!contract) {
    return { ...base, status: "skipped", reasonFa: `پیمان «${cert.ContractCode}» در ContractMaster یافت نشد` };
  }
  const computation = cert.ComputationJson ? (typeof cert.ComputationJson === "string" ? JSON.parse(cert.ComputationJson) : cert.ComputationJson) : null;
  if (!computation || !Array.isArray(computation.rows)) {
    return { ...base, status: "skipped", reasonFa: "گواهی هنوز محاسبه نشده (ComputationJson خالی) — پیش‌نویس بدون محاسبه" };
  }

  const mapped = mapTemplateIpcToCore({
    certificateId: cert.Id,
    status: String(cert.Status || "draft"),
    periodFrom: cert.PeriodFrom,
    periodTo: cert.PeriodTo,
    currency: cert.Currency || "IRR",
    computation,
  });

  /* بررسی اختلافِ صفر — پیش از نوشتن. */
  const diff = {
    gross: round2((mapped.header.GrossCurrent || 0) - (Number(cert.GrossAmount) || 0)),
    deductions: round2((mapped.header.TotalDeductions || 0) - (Number(cert.DeductionTotal) || 0)),
    net: round2((mapped.header.NetPayable || 0) - (Number(cert.NetAmount) || 0)),
  };
  const hasDiff = diff.gross !== 0 || diff.deductions !== 0 || diff.net !== 0;
  if (hasDiff) {
    return { ...base, status: "error", reasonFa: "اختلاف غیرصفر بین مبلغ نگاشته‌شده و گواهی اصلی", diff };
  }

  if (!apply) {
    return { ...base, status: "dry_run_ok", contractId: contract.Id, gross: mapped.header.GrossCurrent, net: mapped.header.NetPayable, diff: 0 };
  }

  const contractId = String(contract.Id);
  if (!serials.has(contractId)) {
    const existingForContract = await r.list("InterimPaymentCertificate", {
      where: [{ column: "ContractId", op: "eq", value: contractId }], limit: 5000,
    });
    serials.set(contractId, nextIpcSerial(existingForContract) - 1); // آخرین سریال مصرف‌شده
  }
  const serialNo = serials.get(contractId) + 1;
  serials.set(contractId, serialNo);

  const created = await r.create("InterimPaymentCertificate", {
    ProjectId: cert.ProjectId,
    ContractId: contractId,
    SerialNo: serialNo,
    IpcType: "interim",
    PeriodCode: `CNTIPC-${cert.TemplateCode}-${cert.PeriodNo}`,
    PeriodFrom: mapped.header.PeriodFrom,
    PeriodTo: mapped.header.PeriodTo,
    GrossCurrent: mapped.header.GrossCurrent,
    GrossCumulative: mapped.header.GrossCurrent,
    SubtotalAmount: mapped.header.SubtotalAmount,
    TotalDeductions: mapped.header.TotalDeductions,
    NetPayable: mapped.header.NetPayable,
    WorkflowState: mapped.header.WorkflowState,
    PostedToFin: false,
    LegacyRef: mapped.header.LegacyRef,
    Status: "open",
  }, userId, "IPC");
  const ipcId = created.Id ?? created.id;

  for (const line of mapped.lines) {
    await r.create("IPC_LineItem", {
      ProjectId: cert.ProjectId,
      IpcId: ipcId,
      BoqItemId: line.BoqItemId,
      PricingBasis: line.PricingBasis,
      CurrentQty: line.CurrentQty,
      UnitRate: line.UnitRate,
      EarnedCurrent: line.EarnedCurrent,
      EarnedCumulative: line.EarnedCurrent,
      QualityGateStatus: line.QualityGateStatus,
      Status: line.Status,
    }, userId, "IPCL");
  }
  for (const d of mergeDeductionsByType(mapped.deductions)) {
    await r.create("IPC_Deduction", {
      ProjectId: cert.ProjectId,
      IpcId: ipcId,
      DeductionType: d.DeductionType,
      BaseAmount: d.BaseAmount,
      RatePct: d.RatePct,
      Amount: d.Amount,
      IsStatutory: d.IsStatutory,
      NoteFa: d.NoteFa,
    }, userId, "IPCD");
  }

  return { ...base, status: "migrated", ipcId, contractId, serialNo, gross: mapped.header.GrossCurrent, net: mapped.header.NetPayable, diff: 0 };
}

export async function runMigration({ repo, projectId = null, apply = false, userId = "migration-script" } = {}) {
  const r = repo;
  const where = projectId ? [{ column: "ProjectId", op: "eq", value: projectId }] : [];
  const certificates = await r.list("CntIpcCertificate", { where, limit: 50000 });
  const contracts = await r.list("ContractMaster", { where, limit: 50000 });
  const contractsByCode = new Map(contracts.map((c) => [`${c.ProjectId}::${c.Code}`, c]));
  const serials = new Map();

  const results = [];
  for (const cert of certificates.sort((a, b) => Number(a.PeriodNo) - Number(b.PeriodNo))) {
    results.push(await migrateOne(r, cert, { contractsByCode, serials, userId, apply }));
  }

  const summary = {
    total: results.length,
    migrated: results.filter((x) => x.status === "migrated").length,
    alreadyMigrated: results.filter((x) => x.status === "already_migrated").length,
    dryRunOk: results.filter((x) => x.status === "dry_run_ok").length,
    skipped: results.filter((x) => x.status === "skipped").length,
    errors: results.filter((x) => x.status === "error").length,
    zeroDiff: results.every((x) => !x.diff || x.diff === 0),
    mode: apply ? "apply" : "dry_run",
    generatedAt: new Date().toISOString(),
  };
  return { summary, results };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { repo } = await createPersistence({
    getPool: async () => null, // اسکریپت مهاجرت فقط با DATA_DIR محلی اجرا می‌شود؛ اتصال SQL از server/index.js مدیریت می‌شود.
    dataDir: path.resolve(process.cwd(), process.env.DATA_DIR || "server/data"),
    preferSql: false,
  });
  const report = await runMigration({ repo, projectId: args.project, apply: args.apply });
  const text = JSON.stringify(report, null, 2);
  console.log(text);
  if (!args.apply) console.error("\n[dry-run] چیزی نوشته نشد — برای نوشتن واقعی با --apply اجرا کنید.");
  if (!report.summary.zeroDiff) console.error("\n[هشدار] اختلاف غیرصفر در گزارش — نباید مسیر ثبت را ببندید.");
  if (args.outFile) writeFileSync(args.outFile, text, "utf8");
}

if (IS_MAIN) {
  main().catch((err) => { console.error(err); process.exitCode = 1; });
}
