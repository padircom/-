/**
 * MOD-14 / D11 + D12 — آزمون REST گزارش‌های پیمان.
 *
 * تمرکز روی مرزها: مجوز دیدن در برابر مجوز صدور، مخاطب داخلی در برابر
 * رسمی، دروازهٔ سربرگ، و نشت بین پروژه‌ها.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execPath } from "node:process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4730;
const BASE = `http://127.0.0.1:${PORT}`;
const PROJECT = "p1";
let child, dir;

async function req(path, { user = "u-pm", method = "GET", body, raw = false } = {}) {
  const headers = { "content-type": "application/json" };
  if (user) headers["x-user-id"] = user;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (raw) {
    /* بایت خام لازم است: `res.text()` طبق مشخصات fetch علامت BOM را
     * بی‌صدا حذف می‌کند و آزمون BOM بی‌معنا می‌شود. */
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, text: buf.toString("utf8"), bytes: buf, headers: res.headers };
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* خروجی غیر JSON */ }
  return { status: res.status, json, text };
}

let contractId, ipcId;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "cnt-rpt-"));
  /* `server/data` در .gitignore است و در محیط تازه ممکن است اصلاً
   * وجود نداشته باشد؛ نبودش خطا نیست چون درایور JSON جدول نبوده را
   * فهرست خالی می‌گیرد. بدون این محافظ، کل آزمون REST روی یک
   * checkout تمیز می‌افتاد. */
  await cp("server/data", dir, { recursive: true }).catch(() => {});
  child = spawn(execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dir, RATE_LIMIT_PER_MINUTE: "100000" },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) break; } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 150));
  }

  // پیمان آزمونی
  const c = await req(`/api/cnt/contracts?projectId=${PROJECT}`, {
    user: "u-contracts", method: "POST",
    body: {
      projectId: PROJECT, code: "RPT-9001", titleFa: "پیمان آزمون گزارش",
      contractType: "unit_price", employerName: "کارفرمای آزمون",
      contractorName: "پیمانکار آزمون", consultantName: "مشاور آزمون",
      initialAmount: 1_000_000, signDate: "1404-01-15",
      startDate: "1404-02-01", durationDays: 365,
    },
  });
  contractId = c.json?.data?.item?.Id;
  assert.ok(contractId, `ساخت پیمان: ${c.status} ${c.text.slice(0, 300)}`);

  const q = `projectId=${PROJECT}&contractId=${contractId}`;
  const b = await req(`/api/cnt/boq?${q}`, {
    user: "u-contracts", method: "POST",
    body: {
      projectId: PROJECT, contractId, itemNo: "030101", chapterCode: "03",
      titleFa: "بتن‌ریزی پی", unit: "مترمکعب", pricingBasis: "unit_price",
      contractQty: 100, unitRate: 1_000,
    },
  });
  const boqId = b.json?.data?.item?.Id;
  assert.ok(boqId, `ساخت ردیف: ${b.status} ${b.text.slice(0, 300)}`);

  const i = await req(`/api/cnt/ipc?${q}`, {
    user: "u-contracts", method: "POST",
    body: {
      projectId: PROJECT, contractId, periodCode: "1404-06",
      periodFrom: "1404-06-01", periodTo: "1404-06-31",
      lines: [{ boqItemId: boqId, cumQty: 40 }],
      deductions: [{ deductionType: "retainage", ratePct: 10 }],
    },
  });
  ipcId = i.json?.data?.id;
  assert.ok(ipcId, `ساخت صورت‌وضعیت: ${i.status} ${i.text.slice(0, 300)}`);
});

after(async () => {
  child?.kill();
  if (dir) await rm(dir, { recursive: true, force: true });
});

const Q = () => `projectId=${PROJECT}&contractId=${contractId}`;

/* ═══════════ ۱. کاتالوگ ═══════════ */

test("کاتالوگ هشت گزارش را می‌دهد", async () => {
  const r = await req("/api/cnt/reports");
  assert.equal(r.status, 200);
  assert.equal(r.json.data.count, 8);
  assert.ok(r.json.data.formats.includes("excel"));
  assert.equal(r.json.meta.engine, "cnt-v1");
});

test("پالایش مخاطب رسمی، گزارش‌های داخلی را حذف می‌کند", async () => {
  const r = await req("/api/cnt/reports?audience=official");
  assert.equal(r.json.data.count, 5);
  const codes = r.json.data.items.map((x) => x.code);
  assert.ok(!codes.includes("RPT-CNT-FIN"), "تطبیق مالی نباید رسمی شود");
  assert.ok(!codes.includes("RPT-CNT-SUB"));
});

test("بدون شناسهٔ کاربر، کاتالوگ ۴۰۱ می‌دهد", async () => {
  const r = await req("/api/cnt/reports", { user: null });
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, "E-CNT-AUTH-REQUIRED");
});

test("کاربر بی‌ربط ۴۰۳ می‌گیرد و مجوز نامش را می‌بیند", async () => {
  const r = await req("/api/cnt/reports", { user: "u-site" });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "cnt.report.view");
});

/* ═══════════ ۲. دادهٔ گزارش ═══════════ */

test("برگهٔ صورت‌وضعیت با اعداد واقعی ساخته می‌شود", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-IPC?${Q()}`);
  assert.equal(r.status, 200, r.text.slice(0, 300));
  const rep = r.json.data;
  assert.equal(rep.code, "RPT-CNT-IPC");
  const kpi = rep.sections.find((s) => s.title.fa === "خلاصهٔ صورت‌وضعیت");
  assert.equal(kpi.cells.find((c) => c.label.fa === "ناخالص دوره").value, "40000",
    "۴۰ مترمکعب × ۱۰۰۰ ریال");
  const t = rep.sections.find((s) => s.title.fa === "ریزمتره");
  assert.equal(t.rows[0].titleFa, "بتن‌ریزی پی", "شرح باید از فهرست بها بیاید");
});

test("کد کوچک هم پذیرفته می‌شود", async () => {
  const r = await req(`/api/cnt/reports/rpt-cnt-boq?${Q()}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.code, "RPT-CNT-BOQ");
});

test("کد ناشناخته ۴۰۴ می‌دهد", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-GHOST?${Q()}`);
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "E-CNT-RPT-CODE");
});

test("گزارش داخلی با مخاطب رسمی ۴۰۳ می‌دهد", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-FIN?${Q()}&audience=official`, { user: "u-pm" });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.code, "E-CNT-RPT-AUDIENCE");
});

test("پیمان پروژهٔ دیگر ۴۰۴ می‌دهد نه ۴۰۳", async () => {
  /* ۴۰۳ خودش افشای اطلاعات است: تأیید می‌کند چنین پیمانی هست. */
  const r = await req(`/api/cnt/reports/RPT-CNT-BOQ?projectId=p2&contractId=${contractId}`);
  assert.equal(r.status, 404);
});

test("فهرست بها درصد اجرا را از صورت‌وضعیت می‌گیرد", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-BOQ?${Q()}`);
  const t = r.json.data.sections.find((s) => s.kind === "table");
  assert.equal(t.rows[0].doneQty, 40);
  assert.equal(t.rows[0].donePct, "40");
});

test("هر هشت گزارش روی داده واقعی بدون خطا ساخته می‌شوند", async () => {
  const codes = (await req("/api/cnt/reports")).json.data.items.map((x) => x.code);
  for (const code of codes) {
    const r = await req(`/api/cnt/reports/${code}?${Q()}`, { user: "u-pm" });
    assert.equal(r.status, 200, `${code}: ${r.text.slice(0, 200)}`);
    assert.ok(r.json.data.sections.length >= 1, `${code} بخشی ندارد`);
  }
});

test("گزارش مدیریتی نمرهٔ سلامت را از موتور KPI می‌آورد", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-EXEC?${Q()}`);
  assert.equal(r.status, 200);
  const kpi = r.json.data.sections.find((s) => s.kind === "kpi" && s.title.fa === "شاخص‌های کلیدی");
  assert.ok(kpi, "بخش شاخص‌ها نیست");
});

test("گزارش تطبیق مالی، ارسال‌نشده را می‌بیند", async () => {
  /* صورت‌وضعیت ساخته شده ولی به مالی نرفته. */
  const r = await req(`/api/cnt/reports/RPT-CNT-FIN?${Q()}`);
  assert.equal(r.status, 200);
  const kpi = r.json.data.sections.find((s) => s.kind === "kpi" && s.cells?.some((c) => c.label.fa === "ارسال‌نشده"));
  assert.ok(kpi, "شمارندهٔ ارسال‌نشده نیست");
});

/* ═══════════ ۳. خروجی قالب‌بندی‌شده (D12) ═══════════ */

test("خروجی HTML چاپی برمی‌گردد", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-BOQ/render?${Q()}&format=html`, { raw: true });
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").includes("text/html"));
  assert.ok(r.text.includes("بتن‌ریزی پی"));
  assert.ok(r.text.includes("rtl"));
});

test("خروجی pdf همان HTML چاپی با نام فایل است", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-BOQ/render?${Q()}&format=pdf`, { raw: true });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-disposition"), /\.pdf/);
});

test("خروجی اکسل با BOM و نوع درست می‌آید", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-BOQ/render?${Q()}&format=excel`, { raw: true });
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").includes("ms-excel"));
  assert.deepEqual([...r.bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], "بدون BOM اکسل فارسی را خراب می‌کند");
  assert.match(r.headers.get("content-disposition"), /\.xls/);
});

test("خروجی CSV با BOM می‌آید", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-BOQ/render?${Q()}&format=csv`, { raw: true });
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").includes("text/csv"));
  assert.deepEqual([...r.bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.ok(r.text.includes("بتن‌ریزی پی"));
});

test("خروجی ورد نوع msword دارد", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-BOQ/render?${Q()}&format=word`, { raw: true });
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").includes("msword"));
});

test("قالب json هم دادهٔ خام و هم سربرگ می‌دهد", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-BOQ/render?${Q()}&format=json`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.report.sections.length > 0);
  assert.ok(r.json.data.letterhead.docNo);
});

test("قالب ناشناخته ۴۰۰ می‌دهد", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-BOQ/render?${Q()}&format=dwg`);
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-CNT-RPT-FORMAT");
});

/* ═══════════ ۴. دروازهٔ سند رسمی ═══════════ */

test("نسخهٔ رسمی بدون سربرگ کامل صادر نمی‌شود", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-IPC/render?${Q()}&audience=official`, { user: "u-pm" });
  assert.equal(r.status, 422, r.text.slice(0, 300));
  assert.equal(r.json.error.code, "E-CNT-RPT-LETTERHEAD");
  assert.ok(Array.isArray(r.json.error.detailsFa) && r.json.error.detailsFa.length > 0,
    "کاربر باید بداند دقیقاً چه چیزی کم است");
});

test("با سربرگ کامل، نسخهٔ رسمی صادر می‌شود", async () => {
  const lh = [
    "projectName=پروژهٔ آزمون", "projectCode=PRJ",
    "contractorLogo=آلفا", "clientLogo=گاما", "consultantLogo=بتا",
    "distribution=کارفرما,مشاور", "preparedBy=u-contracts", "approvedBy=u-client",
    "periodLabel=شهریور ۱۴۰۴", "issueDate=1404-06-19",
  ].join("&");
  const r = await req(`/api/cnt/reports/RPT-CNT-IPC/render?${Q()}&audience=official&${lh}`, { user: "u-pm", raw: true });
  assert.equal(r.status, 200, r.text.slice(0, 400));
  assert.ok(r.text.includes("پیمانکار آزمون"), "نام پیمانکار از خود پیمان می‌آید");
  assert.ok(r.text.includes("PRJ-RPT-CNT-IPC"), "شمارهٔ سند باید تولید شود");
});

test("مجوز صدور رسمی از مجوز دیدن جداست", async () => {
  /* مدیر پیمان گزارش را می‌بیند ولی نسخهٔ رسمی صادر نمی‌کند. */
  const v = await req("/api/cnt/reports", { user: "u-contracts" });
  assert.equal(v.status, 200, "مدیر پیمان باید ببیند");
  const i = await req(`/api/cnt/reports/RPT-CNT-IPC/render?${Q()}&audience=official`, { user: "u-contracts" });
  assert.equal(i.status, 403, "ولی نباید صادر کند");
  assert.equal(i.json.error.permission, "cnt.report.issue");
});

test("نسخهٔ داخلی برای مدیر پیمان باز است", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-IPC/render?${Q()}&format=json`, { user: "u-contracts" });
  assert.equal(r.status, 200);
});

test("مشاور گزارش را می‌بیند ولی صادر نمی‌کند", async () => {
  assert.equal((await req("/api/cnt/reports", { user: "u-consultant" })).status, 200);
  const i = await req(`/api/cnt/reports/RPT-CNT-BOQ/render?${Q()}&audience=official`, { user: "u-consultant" });
  assert.equal(i.status, 403);
});

test("رندر بدون کاربر ۴۰۱ می‌دهد", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-BOQ/render?${Q()}`, { user: null });
  assert.equal(r.status, 401);
});

test("رندر گزارش داخلی با مخاطب رسمی، پیش از سربرگ رد می‌شود", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-FIN/render?${Q()}&audience=official`, { user: "u-pm" });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.code, "E-CNT-RPT-AUDIENCE");
});

/* ═══════════ ۵. پایداری ═══════════ */

test("دو فراخوان پیاپی خروجی یکسان می‌دهند", async () => {
  const a = await req(`/api/cnt/reports/RPT-CNT-BOQ?${Q()}`);
  const b = await req(`/api/cnt/reports/RPT-CNT-BOQ?${Q()}`);
  assert.deepEqual(a.json.data.sections, b.json.data.sections, "گزارش نباید بین دو خواندن تغییر کند");
});

test("گزارش هیچ داده‌ای نمی‌نویسد", async () => {
  const before = (await req(`/api/cnt/ipc?${Q()}`, { user: "u-admin" })).json?.data;
  await req(`/api/cnt/reports/RPT-CNT-IPC/render?${Q()}&format=json`);
  const after = (await req(`/api/cnt/ipc?${Q()}`, { user: "u-admin" })).json?.data;
  assert.deepEqual(after, before, "گزارش فقط می‌خواند");
});

test("بدون شناسهٔ پیمان، دامنه رد می‌شود", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-BOQ?projectId=${PROJECT}`);
  assert.ok(r.status >= 400, "پیمان باید مشخص باشد");
});

test("صورت‌وضعیت مشخص با ipcId انتخاب می‌شود", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-IPC?${Q()}&ipcId=${ipcId}`);
  assert.equal(r.status, 200);
  const kpi = r.json.data.sections.find((s) => s.title.fa === "خلاصهٔ صورت‌وضعیت");
  assert.ok(kpi);
});

test("ipcId ناموجود، برگهٔ خالی می‌دهد نه خطای ۵۰۰", async () => {
  const r = await req(`/api/cnt/reports/RPT-CNT-IPC?${Q()}&ipcId=ghost-id`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.sections.length >= 1);
});
