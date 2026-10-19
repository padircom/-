import test from "node:test";
import assert from "node:assert/strict";
import { buildChangeManagementReport, CHANGE_MGMT_KINDS, CHANGE_MGMT_REPORTS } from "./changeMgmtLogic.js";

const sample = {
  requests: [
    { Code: "CHG-B1", TitleFa: "تغییر ۱", ChangeType: "design", Status: "approved", Priority: "high", RequestedBy: "u-contracts", RequestDate: "2026-10-01", DecidedBy: "u-pm", StatusChangedBy: "u-contracts" },
    { Code: "CHG-B2", TitleFa: "تغییر ۲", ChangeType: "cost", Status: "pending_decision", Priority: "normal", RequestedBy: "u-contracts", RequestDate: "2026-10-05" },
  ],
  costs: [
    { ChangeCode: "CHG-B1", Code: "C1", Layer: "estimated", Amount: 60000000, SourceFa: "برآورد PMO", PreparedBy: "u-contracts" },
    { ChangeCode: "CHG-B1", Code: "C2", Layer: "approved", Amount: 55000000, SourceFa: "صورت‌جلسهٔ CCB-۱۲", PreparedBy: "u-pm" },
    { ChangeCode: "CHG-B1", Code: "C3", Layer: "paid", Amount: 10000000, SourceFa: "", PreparedBy: "u-pm" },
  ],
  schedules: [{ ChangeCode: "CHG-B1", Code: "S1", MethodFa: "پنجره‌ای", EstimatedDurationDeltaDays: 3, CompletionEffectDays: 3, ApprovedEotDays: 0, PreparedBy: "u-contracts" }],
  moduleLinks: [
    { ChangeCode: "CHG-B1", Code: "L1", LinkKind: "delay_event", TargetCode: "DLY-1", TargetTitleFa: "رویداد", EstablishedBy: "u-pm" },
    { ChangeCode: "CHG-B1", Code: "L2", LinkKind: "claim", TargetCode: "", TargetTitleFa: "" },
  ],
  riskLinks: [{ ChangeCode: "CHG-B1", Code: "R1", RiskRegistryRef: "RK-1", LinkType: "trigger", DescriptionFa: "توضیح", CreatedBy: "u-pm" }],
  claimLinks: [],
  documents: [{ ChangeCode: "CHG-B1", Code: "D1", TitleFa: "صورت‌جلسهٔ CCB", Kind: "meeting", DocNo: "M-12", UploadedBy: "u-pm" }],
  implementation: [{ ChangeCode: "CHG-B1", Code: "I1", Step: "baselines_updated", Status: "in_progress", BaselineUpdateRef: "chg-bl-1", ExecutionResultFa: "نتایج راستی‌آزمایی در انتظار" }],
  audits: [
    { OccurredAt: "2026-10-03T10:00:00Z", ChangeCode: "CHG-B1", Action: "change_created", Actor: "u-contracts", DetailFa: "ایجاد", FromValue: "", ToValue: "draft" },
    { OccurredAt: "2026-10-04T10:00:00Z", ChangeCode: "CHG-B1", Action: "status_changed", Actor: "u-pm", DetailFa: "تأیید", FromValue: "pending_decision", ToValue: "approved" },
  ],
  today: "2026-10-19",
};

test("فاز ۵: هر ۱۴ گزارش مدیریتی با دادهٔ واقعی سطرهای صحیح تولید می‌کند", () => {
  for (const k of CHANGE_MGMT_KINDS) {
    const r = buildChangeManagementReport(k, sample);
    assert.ok(r.title && r.title !== "گزارش نامعتبر", `kind=${k} نامشخص`);
    assert.ok(Array.isArray(r.heads) && Array.isArray(r.rows), `kind=${k}`);
  }
  /* نقطه‌چایه‌ها */
  assert.equal(buildChangeManagementReport("requests_status", sample).rows.length, 2);
  assert.equal(buildChangeManagementReport("requests_by_type", sample).rows.length, 2);
  const warnings = buildChangeManagementReport("cost_warnings", sample);
  assert.equal(warnings.rows.length, 1); /* C3 لایهٔ paid بدون منبع */
  const sod = buildChangeManagementReport("review_sod_gaps", sample);
  /* CHG-B1: decidedBy=u-pm, statusChangedBy=u-contracts — SoD رعایت شده، فقط یک ردیف (C3 paid بی‌منبع) */
  assert.equal(sod.rows.length, 1);
  const l = buildChangeManagementReport("links_gaps", sample);
  assert.equal(l.rows.length, 1); /* L2 — کد هدف تهی */
  /* sortedAudits در audit_trail */
  const audit = buildChangeManagementReport("audit_trail", sample);
  assert.equal(audit.rows.length, 2);
  assert.equal(audit.rows[0][0], "2026-10-04T10:00:00Z"); /* جدیدترین اول */
  const dd = buildChangeManagementReport("dashboard_detail", sample);
  assert.equal(dd.rows.length, 15);
});

test("فاز ۵: دادهٔ خالی — نه خطای سیستم بلکه «—»", () => {
  const empty = { requests: [], costs: [], schedules: [], moduleLinks: [], riskLinks: [], claimLinks: [], documents: [], implementation: [], audits: [], today: "2026-10-19" };
  for (const k of CHANGE_MGMT_KINDS) {
    const r = buildChangeManagementReport(k, empty);
    assert.ok(r.rows.every((row) => row.every((c) => String(c).trim() !== "")), `kind=${k} سلول خالی دارد`);
  }
  const warn = buildChangeManagementReport("cost_layers_detail", empty);
  assert.equal(warn.rows.length, 5); /* هر ۵ لایه با مجموع صفر */
});
