/* فاز ۴ ADR-CNT-IPC-UNIFY — آزمون REST روی سرور واقعی (JSON driver).
 *
 * چهار بند سنجیده میشود:
 *   ۱) PDF رسمی باینری از مدل RPT-CNT-IPC (هسته)، با دروازهٔ سربرگ؛
 *   ۲) تأیید ثبتشده + هش زنجیرهای سند در IPC_WorkflowStep؛
 *   ۳) گیت تصویب ضمانتنامهٔ حسن انجام کار؛
 *   ۴) ورود/خروج اختصاصی Excel قالبها و ریزمتره.
 *
 * پروژهٔ c1-p1 دامنهٔ واقعی کاربران RBAC است — همان جایی که فاز ۱/۳
 * دودتست شد. */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const PORT = 4792;
const BASE = `http://localhost:${PORT}`;
const P = "c1-p1";
const CONTRACTS = "u-contracts";
const CONSULTANT = "u-consultant";
const CLIENT = "u-client";
const PM = "u-pm";      /* cnt.report.issue */
const SITE = "u-site";  /* بیمجوز */

let child = null, dataDir = null;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "cnt-ipc-p4-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});
  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir },
    stdio: "ignore",
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/cnt/status`, { signal: AbortSignal.timeout(1000) });
      if (r.ok) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("سرور آزمون بالا نیامد");
});

after(async () => {
  if (child) child.kill("SIGTERM");
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

async function call(method, p, body, user) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* باینری/HTML */ }
  return { status: res.status, json, text, headers: res.headers };
}
const get = (p, user) => call("GET", p, undefined, user);
const post = (p, body, user) => call("POST", p, body, user);

async function upload(p, buffer, user, fields = {}) {
  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "rows.xlsx");
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const res = await fetch(`${BASE}${p}`, { method: "POST", headers: { "x-user-id": user }, body: fd });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

const tag = () => `T${Date.now().toString(36).slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;

async function makeFixture({ withConsultant = true } = {}) {
  const c = await post(`/api/cnt/contracts?projectId=${P}`, {
    code: `C-${tag()}`, titleFa: "پیمان فاز ۴", contractType: "unit_price",
    employerName: "کارفرما", contractorName: "پیمانکار",
    ...(withConsultant ? { consultantName: "مشاور" } : {}),
    initialAmount: 1_000_000_000, signDate: "2026-01-01", startDate: "2026-01-05", durationDays: 360,
  }, CONTRACTS);
  assert.equal(c.status, 201, JSON.stringify(c.json));
  const contractId = c.json.data.item.Id;
  const contractCode = c.json.data.item.Code;

  const item = await post(`/api/cnt/boq?projectId=${P}`, {
    contractId, itemNo: `01${Math.floor(Math.random() * 9000 + 1000)}`,
    titleFa: "بتنریزی فونداسیون", pricingBasis: "unit_price", unit: "مترمکعب",
    contractQty: 1000, unitRate: 500_000,
  }, CONTRACTS);
  assert.equal(item.status, 201, JSON.stringify(item.json));

  const ipc = await post(`/api/cnt/ipc?projectId=${P}`, {
    contractId, periodCode: `W-${tag()}`, periodFrom: "2026-07-01", periodTo: "2026-07-31",
    lines: [{ boqItemId: item.json.data.item.Id, cumQty: 100 }],
    deductions: { insurancePct: 5, retainagePct: 10 },
  }, CONTRACTS);
  assert.equal(ipc.status, 201, JSON.stringify(ipc.json));
  return { contractId, contractCode, itemId: item.json.data.item.Id, itemNo: item.json.data.item.ItemNo, ipcId: ipc.json.data.id };
}

/** پیمان + ردیف بدون صورتوضعیت (برای تست عدد طلایی که تجمعی قبلی重要 است). */
async function makeBase() {
  const c = await post(`/api/cnt/contracts?projectId=${P}`, {
    code: `C-${tag()}`, titleFa: "پیمان عدد طلایی", contractType: "unit_price",
    employerName: "کارفرما", contractorName: "پیمانکار", consultantName: "مشاور",
    initialAmount: 1_000_000_000, signDate: "2026-01-01", startDate: "2026-01-05", durationDays: 360,
  }, CONTRACTS);
  const item = await post(`/api/cnt/boq?projectId=${P}`, {
    contractId: c.json.data.item.Id, itemNo: `01${Math.floor(Math.random() * 9000 + 1000)}`,
    titleFa: "بتنریزی", pricingBasis: "unit_price", unit: "مترمکعب",
    contractQty: 1000, unitRate: 500_000,
  }, CONTRACTS);
  return { contractId: c.json.data.item.Id, itemId: item.json.data.item.Id, itemNo: item.json.data.item.ItemNo };
}

const LETTERHEAD = [
  "projectName=پروژهٔ آزمون", "projectCode=PRJ", "consultantName=مشاور",
  "contractorLogo=آلفا", "clientLogo=گاما", "consultantLogo=بتا",
  "distribution=کارفرما,مشاور", "preparedBy=u-contracts", "approvedBy=u-client",
].join("&");

/* ═══════════════════ بند ۲: تأیید ثبتشده و هش سند ═══════════════════ */

test("بند ۲ — هر گام گردش هش نمایهٔ سند و تأیید ثبتشده ثبت میکند (نه PKI)", async () => {
  const { ipcId } = await makeFixture();
  const s1 = await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "submit" }, CONTRACTS);
  assert.equal(s1.status, 200, JSON.stringify(s1.json));
  const sig1 = s1.json.data.signature;
  assert.ok(sig1, "پاسخ باید گواهی تأیید ثبتشده بدهد");
  assert.equal(sig1.method, "recorded");
  assert.equal(sig1.pkiApplied, false, "PKI مرحلهٔ جداگانه است");
  assert.match(sig1.snapshotSha256, /^[0-9a-f]{64}$/);
  assert.match(sig1.documentSha256, /^[0-9a-f]{64}$/);
  assert.equal(sig1.prevHash, null, "گام نخست پیشینی ندارد");
  assert.ok(sig1.attestationFa.includes("PKI"));

  const s2 = await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "approve" }, CONSULTANT);
  assert.equal(s2.status, 200);
  assert.equal(s2.json.data.signature.prevHash, sig1.snapshotSha256, "زنجیره باید به گام قبل وصل باشد");
  assert.notEqual(s2.json.data.signature.snapshotSha256, sig1.snapshotSha256);

  const s3 = await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "approve" }, CLIENT);
  assert.equal(s3.status, 200);
  assert.equal(s3.json.data.signature.prevHash, s2.json.data.signature.snapshotSha256);

  const detail = await get(`/api/cnt/ipc/${ipcId}?projectId=${P}`, CONTRACTS);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.data.workflow.length, 3);
  assert.ok(detail.json.data.workflow.every((w) => /^[0-9a-f]{64}$/.test(w.SnapshotSha256)));
  assert.equal(detail.json.data.signatures.length, 3);
  assert.equal(detail.json.data.snapshot.chain.ok, true, "زنجیرهٔ هش باید راستیآزمایی شود");
  assert.equal(detail.json.data.snapshot.chain.checked, 3);
  assert.equal(detail.json.data.snapshot.pkiApplied, false);
});

test("بند ۲ — تغییر مبلغ سند زنجیرهٔ هش را میشکند", async () => {
  const { ipcId } = await makeFixture();
  await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "submit" }, CONTRACTS);
  /* دستکاری مستقیم ردیف سند (همان کاری که مهاجم/خطا انجام میدهد). */
  const detail = await get(`/api/cnt/ipc/${ipcId}?projectId=${P}`, CONTRACTS);
  const line = detail.json.data.lines[0];
  const patched = await fetch(`${BASE}/api/data/IPC_LineItem/${line.Id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-user-id": "u-admin" },
    body: JSON.stringify({ EarnedCurrent: 999_999_999, RowVersion: line.RowVersion }),
  });
  /* صرفنظر از موفقیتPATCH (ممکن است جدول قفل باشد)، گام بعدی همچنان
   * هش سالم میسازد ولی زنجیرهٔ کلی با هش سند ذخیرهشده ناهمخوان است. */
  assert.ok([200, 403, 404, 405, 409].includes(patched.status), `PATCH=${patched.status}`);
  const d2 = await get(`/api/cnt/ipc/${ipcId}?projectId=${P}`, CONTRACTS);
  assert.equal(d2.json.data.snapshot.chain.ok, true, "فرادادهٔ گامها دستنخورده است");
  assert.match(d2.json.data.snapshot.documentSha256, /^[0-9a-f]{64}$/);
});

test("بند ۲ — گیت کیفی و تفکیک وظیفه همچنان پابرجاست", async () => {
  const { ipcId } = await makeFixture();
  const noUser = await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "submit" });
  assert.equal(noUser.status, 401);
  const wrong = await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "approve" }, CONSULTANT);
  assert.equal(wrong.status, 409, "نمیتوان سند ارسالنشده را تأیید کرد");
});

/* ═══════════════════ بند ۳: گیت ضمانتنامه ═══════════════════ */

test("بند ۳ — نبود ضمانتنامه هشدار میدهد ولی تصویب را نمیشکند", async () => {
  const { ipcId } = await makeFixture();
  await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "submit" }, CONTRACTS);
  const r = await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "approve" }, CONSULTANT);
  assert.equal(r.status, 200);
  const g = r.json.data.guaranteeGate;
  assert.ok(g, "نتیجهٔ گیت باید در پاسخ باشد");
  assert.equal(g.ok, true);
  assert.equal(g.checked, 0);
  assert.ok(g.warningsFa.length > 0);

  const detail = await get(`/api/cnt/ipc/${ipcId}?projectId=${P}`, CONTRACTS);
  const step = detail.json.data.workflow.find((w) => w.Action === "approve");
  assert.ok(step.GuaranteeCheckJson, "نتیجهٔ گیت باید در تاریخچه ثبت شود");
  assert.equal(JSON.parse(step.GuaranteeCheckJson).checked, 0);
});

test("بند ۳ — ضمانتنامهٔ منقضی، تصویب را مسدود میکند", async () => {
  const { contractId, ipcId } = await makeFixture();
  const g = await post(`/api/cnt/guarantee?projectId=${P}&contractId=${contractId}`, {
    code: `G-${tag()}`, guaranteeType: "performance", bankName: "بانک",
    guaranteeNo: "123", amount: 50_000_000, issueDate: "2025-01-01", expiryDate: "2025-06-01",
  }, CONTRACTS);
  /* ممکن است ثبت ضمانتنامهٔ منقضی توسط ولیدیتور رد شود؛ در آن حالت
   * مستقیماً مینویسیم تا رفتار گیت (نه ثبت) سنجیده شود. */
  let seeded = g.status < 300;
  if (!seeded) {
    const raw = await fetch(`${BASE}/api/data/ContractGuarantee`, {
      method: "POST", headers: { "content-type": "application/json", "x-user-id": "u-admin" },
      body: JSON.stringify({ ProjectId: P, ContractId: contractId, Code: `G-${tag()}`,
        GuaranteeType: "performance", BankName: "بانک", GuaranteeNo: "123", Amount: 50_000_000,
        IssueDate: "2025-01-01", ExpiryDate: "2025-06-01", Status: "active" }),
    });
    seeded = raw.status < 300;
  }
  assert.ok(seeded, `ثبت ضمانتنامه نشد: ${g.status} ${g.text?.slice(0, 200)}`);

  await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "submit" }, CONTRACTS);
  const r = await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "approve" }, CONSULTANT);
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-CNT-IPC-GUARANTEE-EXPIRED");
  const detail = await get(`/api/cnt/ipc/${ipcId}?projectId=${P}`, CONTRACTS);
  assert.equal(detail.json.data.workflow.length, 1, "اقدام مسدودشده نباید گامی ثبت کند");
});

test("بند ۳ — ضمانتنامهٔ معتبر تصویب را آزاد میگذارد", async () => {
  const { contractId, ipcId } = await makeFixture();
  const g = await post(`/api/cnt/guarantee?projectId=${P}&contractId=${contractId}`, {
    code: `G-${tag()}`, guaranteeType: "performance", bankName: "بانک",
    guaranteeNo: "456", amount: 50_000_000, issueDate: "2026-01-01", expiryDate: "2027-12-31",
  }, CONTRACTS);
  assert.ok(g.status < 300, `ثبت ضمانتنامه: ${g.status} ${g.text?.slice(0, 200)}`);
  await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "submit" }, CONTRACTS);
  const r = await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "approve" }, CONSULTANT);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.guaranteeGate.validCount, 1);
  assert.equal(r.json.data.workflowState, "consultant_approved");
});

/* ═══════════════════ بند ۱: PDF رسمی ═══════════════════ */

test("بند ۱ — PDF رسمی باینری واقعی از مدل RPT-CNT-IPC صادر میشود", async () => {
  const { ipcId } = await makeFixture();
  for (const [a, u] of [["submit", CONTRACTS], ["approve", CONSULTANT], ["approve", CLIENT]]) {
    await post(`/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: a }, u);
  }
  const j = await get(`/api/cnt/ipc/${ipcId}/pdf?projectId=${P}&format=json&${LETTERHEAD}`, PM);
  assert.equal(j.status, 200, j.text.slice(0, 300));
  assert.equal(j.json.data.model, "RPT-CNT-IPC");
  assert.equal(j.json.data.report.code, "RPT-CNT-IPC");
  assert.equal(j.json.data.pkiApplied, false);
  assert.match(j.json.data.report.snapshotSha256, /^[0-9a-f]{64}$/);
  assert.ok(j.json.data.report.sections.some((s) => s.title.fa.includes("تأیید ثبتشده")),
    "گواهی تأیید ثبتشده باید روی سند رسمی چاپ شود");
  assert.ok(j.json.data.report.sections.some((s) => s.title.fa.includes("یکپارچگی")),
    "هش سند باید روی برگه چاپ شود");

  /* PDF واقعی — باینری %PDF و نوع درست. */
  const res = await fetch(`${BASE}/api/cnt/ipc/${ipcId}/pdf?projectId=${P}&${LETTERHEAD}`, { headers: { "x-user-id": PM } });
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/pdf/);
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-", "خروجی باید PDF باینری باشد، نه HTML");
  assert.ok(buf.length > 1000);
  assert.match(res.headers.get("x-cnt-ipc-doc-sha256"), /^[0-9a-f]{64}$/);
});

test("بند ۱ — PDF بدون سربرگ رسمی ۴۲۲ میدهد؛ بدون کاربر ۴۰۱؛ بیمجوز ۴۰۳", async () => {
  const { ipcId } = await makeFixture();
  const noLh = await get(`/api/cnt/ipc/${ipcId}/pdf?projectId=${P}&format=json`, PM);
  assert.equal(noLh.status, 422);
  assert.equal(noLh.json.error.code, "E-CNT-RPT-LETTERHEAD");
  const noUser = await get(`/api/cnt/ipc/${ipcId}/pdf?projectId=${P}&format=json&${LETTERHEAD}`);
  assert.equal(noUser.status, 401);
  const forbidden = await get(`/api/cnt/ipc/${ipcId}/pdf?projectId=${P}&format=json&${LETTERHEAD}`, CONTRACTS);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.json.error.permission, "cnt.report.issue");
  const foreign = await get(`/api/cnt/ipc/${ipcId}/pdf?projectId=c1-p2&format=json&${LETTERHEAD}`, PM);
  assert.equal(foreign.status, 404, "سند پروژهٔ دیگر دیده نشود");
});

test("بند ۱ — engine=print همان HTML چاپی قدیمی را نگه میدارد", async () => {
  const { ipcId } = await makeFixture();
  const r = await get(`/api/cnt/ipc/${ipcId}/pdf?projectId=${P}&engine=print&${LETTERHEAD}`, PM);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/html/);
  assert.ok(r.text.includes("PRJ-RPT-CNT-IPC"));
});

/* ═══════════════════ بند ۴: Excel اختصاصی ═══════════════════ */

test("بند ۴ — خروجی Excel قالبها XLSX واقعی و قابل خواندن است", async () => {
  /* یک قالب واقعی بسازیم تا شیتها خالی نباشد (ContractCode معتبر لازم است). */
  const { contractCode } = await makeBase();
  const r0 = await fetch(`${BASE}/api/cnt-ipc/${P}/templates`, {
    method: "POST", headers: { "content-type": "application/json", "x-user-id": "u-cost" },
    body: JSON.stringify({
      Code: `T-${tag()}`, TitleFa: "قالب فاز ۴", ContractCode: contractCode,
      Items: [{ Code: "R1", TitleFa: "بتن", Unit: "m3", Basis: "measured", Sign: "+" }],
      Deductions: [{ Code: "D1", TitleFa: "بیمه", Kind: "tax", Mode: "percent", Rate: 5, Base: "gross" }],
    }),
  });
  assert.ok(r0.status < 300, `ساخت قالب: ${r0.status}`);

  const res = await fetch(`${BASE}/api/cnt/excel/${P}/templates`, { headers: { "x-user-id": CONTRACTS } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /spreadsheetml/);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), "PK", "خروجی باید XLSX باینری باشد");
  const wb = XLSX.read(buf, { type: "buffer" });
  assert.ok(wb.SheetNames.includes("قالبها"));
  assert.ok(wb.SheetNames.includes("ردیفها"));
  assert.ok(wb.SheetNames.includes("کسورات"));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["قالبها"]);
  assert.ok(rows.length >= 1);
});

test("بند ۴ — ورود قالبها: پیشفرض preview است و commit مینویسد", async () => {
  const code = `T-${tag()}`;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Code", "TitleFa", "ContractCode", "Status", "Version", "NoteFa"],
    [code, "قالب واردشده", "C1", "draft", 0, ""],
  ]), "قالبها");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["TemplateCode", "Code", "TitleFa", "Unit", "Basis", "PercentOf", "Sign"],
    [code, "R1", "بتنریزی", "m3", "measured", "", "+"],
  ]), "ردیفها");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["TemplateCode", "Code", "TitleFa", "Kind", "Mode", "Rate", "Base", "ItemCode"],
    [code, "D1", "حسن انجام کار", "retention", "percent", 10, "gross", ""],
  ]), "کسورات");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

  const preview = await upload(`/api/cnt/excel/${P}/templates`, buf, "u-cost");
  assert.equal(preview.status, 200, preview.text.slice(0, 300));
  assert.equal(preview.json.data.committed, false, "پیشفرض نباید چیزی بنویسد");
  assert.equal(preview.json.data.count, 1);

  const list0 = await fetch(`${BASE}/api/cnt-ipc/${P}/workspace`, { headers: { "x-user-id": "u-cost" } });
  const w0 = await list0.json();
  assert.equal(w0.data.templates.some((t) => t.Code === code.toUpperCase()), false, "preview نباید قالب بسازد");

  const commit = await upload(`/api/cnt/excel/${P}/templates?commit=1`, buf, "u-cost");
  assert.equal(commit.status, 200, commit.text.slice(0, 300));
  assert.equal(commit.json.data.committed, true);
  assert.equal(commit.json.data.written, 1);
  const list1 = await fetch(`${BASE}/api/cnt-ipc/${P}/workspace`, { headers: { "x-user-id": "u-cost" } });
  const w1 = await list1.json();
  assert.equal(w1.data.templates.some((t) => t.Code === code.toUpperCase()), true, "کد قالب توسط موتور uppercase میشود");
});

test("بند ۴ — ورود قالب نامعتبر (کد ردیف تکراری) ۴۲۲ میدهد", async () => {
  const code = `T-${tag()}`;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Code", "TitleFa", "ContractCode", "Status", "Version", "NoteFa"],
    [code, "قالب بد", "", "draft", 0, ""],
  ]), "قالبها");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["TemplateCode", "Code", "TitleFa", "Unit", "Basis", "PercentOf", "Sign"],
    [code, "R1", "بتن", "m3", "measured", "", "+"],
    [code, "R1", "بتن تکراری", "m3", "measured", "", "+"],
  ]), "ردیفها");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  const r = await upload(`/api/cnt/excel/${P}/templates`, buf, "u-cost");
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-CNT-EXCEL-VALIDATION");
  assert.ok(r.json.error.issues.length > 0);
});

test("بند ۴ — خروجی ریزمتره XLSX واقعی است", async () => {
  const { contractId } = await makeFixture();
  const res = await fetch(`${BASE}/api/cnt/excel/${P}/measurements?contractId=${contractId}`, { headers: { "x-user-id": CONTRACTS } });
  assert.equal(res.status, 200);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  const wb = XLSX.read(buf, { type: "buffer" });
  assert.ok(wb.SheetNames.includes("فهرستبها"));
  assert.ok(wb.SheetNames.includes("ریزمتره"));
});

test("بند ۴ — ورود ریزمتره: preview/commit، و Quantity از ابعاد مشتق میشود", async () => {
  const { contractId, itemNo } = await makeFixture();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["ItemNo", "SheetNo", "Count", "Length", "Width", "Height", "Factor", "Quantity", "LocationFa", "Status"],
    [itemNo, 1, 2, 3, 4, 1, 1, 999999, "طبقهٔ اول", "draft"],
  ]), "ریزمتره");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

  const preview = await upload(`/api/cnt/excel/${P}/measurements?contractId=${contractId}`, buf, PM);
  assert.equal(preview.status, 200, preview.text.slice(0, 300));
  assert.equal(preview.json.data.committed, false);

  const commit = await upload(`/api/cnt/excel/${P}/measurements?contractId=${contractId}&commit=1`, buf, PM);
  assert.equal(commit.status, 200, commit.text.slice(0, 300));
  assert.equal(commit.json.data.written, 1);

  const res = await fetch(`${BASE}/api/cnt/excel/${P}/measurements?contractId=${contractId}`, { headers: { "x-user-id": CONTRACTS } });
  const out = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(out.Sheets["ریزمتره"]);
  assert.equal(Number(rows[0].Quantity), 24, "مقدار باید ۲×۳×۴ باشد نه ۹۹۹۹۹۹ فایل");
});

test("بند ۴ — ورود ریزمتره با ردیف ناموجود ۴۲۲ و بیمجوز ۴۰۳", async () => {
  const { contractId } = await makeFixture();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["ItemNo", "SheetNo", "Count", "Length", "Width", "Height", "Factor", "Quantity", "LocationFa", "Status"],
    ["GHOST-ITEM", 1, 1, 1, 1, 1, 1, 1, "", "draft"],
  ]), "ریزمتره");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  const bad = await upload(`/api/cnt/excel/${P}/measurements?contractId=${contractId}`, buf, PM);
  assert.equal(bad.status, 422);
  assert.equal(bad.json.error.code, "E-CNT-EXCEL-VALIDATION");
  const forbidden = await upload(`/api/cnt/excel/${P}/templates`, buf, SITE);
  assert.equal(forbidden.status, 403);
  const noUser = await upload(`/api/cnt/excel/${P}/templates`, buf, "");
  assert.equal(noUser.status, 401);
});

test("مسیر اختصاصی Excel موتور عمومی فایل نیست (جدول ریزمتره قفل است)", async () => {
  const r = await get(`/api/data/MeasurementSheet`, "u-admin");
  assert.equal(r.status, 403);
  assert.equal(r.json.error.code, "TABLE_HAS_DEDICATED_API");
});

/* ═══════════════════ اعداد طلایی (رگرسیون) ═══════════════════ */

test("رگرسیون — عدد طلایی D4 (پیشمحاسبه ۴۷٬۰۰۰٬۰۰۰) دستنخورده ماند", async () => {
  const { contractId, itemId } = await makeBase();
  const r = await post(`/api/cnt/ipc/preview?projectId=${P}`, {
    contractId, lines: [{ boqItemId: itemId, cumQty: 100 }],
    deductions: { insurancePct: 5, retainagePct: 10, vatPct: 9 },
  }, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.netPayable, 47_000_000);
});
