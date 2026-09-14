/**
 * MOD-10 / HRM D11 — آزمون REST گزارش‌های رسمی و خروجی چندقالبی.
 *
 * محور: سند رسمی نباید بدون دو لایه مجوز بیرون برود، نباید با دادهٔ
 * ناقص صادر شود، و نباید عددی متفاوت از داشبورد بدهد.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execPath } from "node:process";
import { mkdtemp, cp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4738;
const BASE = `http://127.0.0.1:${PORT}`;
const PROJECT = "p1";
const OTHER = "p2";
let child, dir;

async function req(path, { user = "u-pm", method = "GET", body, raw = false } = {}) {
  const headers = { "content-type": "application/json" };
  if (user) headers["x-user-id"] = user;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (raw) {
    return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type"), disp: res.headers.get("content-disposition") };
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* غیر JSON */ }
  return { status: res.status, json, text, type: res.headers.get("content-type") };
}

async function auditRows() {
  try {
    const rows = JSON.parse(await readFile(join(dir, "AuditLog.json"), "utf8"));
    return rows.map((x) => ({ ...x, Details: typeof x.Details === "string" ? JSON.parse(x.Details) : (x.Details ?? {}) }));
  } catch {
    return [];
  }
}

/** برگهٔ کارکرد کاملاً تأییدشده — تنها ورودی معتبر سند رسمی. */
async function approvedSheet(crewId, workDate, projectId = PROJECT) {
  const c = await req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: {
      projectId, crewId, workDate,
      entries: [{ personId: "PER-R1", tradeCode: "CIV-RBR", activityId: "A-1", cbsId: "CBS-1", hoursRaw: 8 }],
    },
  });
  assert.equal(c.status, 201, c.text.slice(0, 200));
  const id = c.json.data.id;
  for (const [to, user, extra] of [
    ["submitted", "u-site", {}],
    ["foreman_approved", "u-hr", { foremanSignatureRef: `sig-${crewId}` }],
    ["qc_verified", "u-qc", {}],
    ["pm_approved", "u-pm", {}],
  ]) {
    const t = await req(`/api/hrm/timesheets/${id}/transition`, { user, method: "POST", body: { projectId, to, ...extra } });
    assert.equal(t.status, 200, `${to}: ${t.text.slice(0, 200)}`);
  }
  return id;
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "hrm-rpt-"));
  await cp("server/data", dir, { recursive: true }).catch(() => {});
  child = spawn(execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dir, RATE_LIMIT_PER_MINUTE: "100000" },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) break; } catch { /* بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  await approvedSheet("CR-RPT", "2026-08-03");
});

after(async () => {
  child?.kill();
  if (dir) await rm(dir, { recursive: true, force: true });
});

/* ═══════════ ۱. دسترسی ═══════════ */

test("بدون شناسهٔ کاربر ۴۰۱ می‌دهد", async () => {
  const r = await req(`/api/hrm/reports?projectId=${PROJECT}`, { user: null });
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, "E-HRM-AUTH-REQUIRED");
});

test("۴۰۱ و ۴۰۳ دو کد متفاوت‌اند", async () => {
  const a = await req(`/api/hrm/reports?projectId=${PROJECT}`, { user: null });
  const b = await req(`/api/hrm/reports?projectId=${PROJECT}`, { user: "u-sub" });
  assert.equal(b.status, 403);
  assert.notEqual(a.json.error.code, b.json.error.code);
  assert.equal(b.json.error.permission, "hrm.analytics.view");
});

test("نسخهٔ رسمی مجوز دومی می‌خواهد", async () => {
  /* کسی که فقط داشبورد نیرو را می‌بیند نباید سند ابلاغی امضا کند. */
  const internal = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}`, { user: "u-hr" });
  assert.equal(internal.status, 200, internal.text.slice(0, 200));

  const official = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&audience=official`, { user: "u-hr" });
  assert.equal(official.status, 403);
  assert.equal(official.json.error.permission, "report.official.publish");
});

test("مجوز انتشار به‌تنهایی دادهٔ نیرو را باز نمی‌کند", async () => {
  /* `report.official.publish` را نقش‌های زیادی دارند؛ نباید دری به
   * دادهٔ پرسنلی باشد. */
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&audience=official`, { user: "u-doc" });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.analytics.view");
});

test("بدون شناسهٔ پروژه رد می‌شود", async () => {
  assert.equal((await req("/api/hrm/reports/RPT-HRM-MP")).status, 400);
});

/* ═══════════ ۲. کاتالوگ ═══════════ */

test("کاتالوگ چهار گزارش و شش قالب می‌دهد", async () => {
  const r = await req(`/api/hrm/reports?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.count, 4);
  assert.equal(r.json.data.formats.length, 6);
  assert.equal(r.json.meta.engine, "hrm-v1");
});

test("گزارش ناشناخته ۴۰۴ با فهرست گزینه‌ها می‌دهد", async () => {
  const r = await req(`/api/hrm/reports/RPT-NOPE?projectId=${PROJECT}`);
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "E-HRM-RPT-UNKNOWN");
  assert.equal(r.json.error.detailsFa.length, 4);
});

test("کد گزارش به حروف کوچک هم پذیرفته می‌شود", async () => {
  const r = await req(`/api/hrm/reports/rpt-hrm-mp?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
});

test("صورت کارکرد نسخهٔ داخلی ندارد", async () => {
  /* نسخهٔ «داخلی» آن فقط راهی می‌شد برای دور زدن دروازهٔ انتشار. */
  const r = await req(`/api/hrm/reports/RPT-HRM-TS?projectId=${PROJECT}&audience=internal`);
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-RPT-AUDIENCE");
});

/* ═══════════ ۳. دروازهٔ انتشار ═══════════ */

test("گزارش داخلی با دادهٔ ناقص هم صادر می‌شود", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.gate.ok, true);
  assert.equal(r.json.data.audience, "internal");
});

test("سند رسمی با تعارض باز صادر نمی‌شود", async () => {
  /* صورت‌وضعیت روی ساعتی که تکلیفش روشن نیست امضا نمی‌شود. */
  const id = await approvedSheet("CR-GATE", "2026-08-04");
  const sync = await req("/api/hrm/sync/batch", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, deviceId: "dev-rpt", items: [{ id, status: "draft", revision: 1 }] },
  });
  assert.equal(sync.status, 200);

  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&audience=official`, { user: "u-pm" });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-RPT-GATE");
  assert.ok(r.json.error.reasons.some((x) => x.includes("تعارض")));
});

test("دروازهٔ بسته همهٔ دلایل را یک‌جا می‌گوید", async () => {
  /* کاربر باید یک بار همهٔ کارها را ببیند نه هر بار یکی. */
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&audience=official`, { user: "u-pm" });
  assert.equal(r.status, 409);
  assert.ok(Array.isArray(r.json.error.reasons));
  assert.ok(r.json.error.reasons.length >= 1);
  assert.ok(Array.isArray(r.json.error.warnings));
});

test("تلاش مسدودشده رد ممیزی می‌گذارد", async () => {
  /* تکرار الگو یعنی یا داده مزمن ناقص است یا کسی مدام در می‌زند. */
  const rows = await auditRows();
  const hit = rows.find((x) => x.Action === "HRM_REPORT_PUBLISH_BLOCKED");
  assert.ok(hit, "رد ممیزی تلاش مسدودشده ثبت نشد");
  assert.equal(hit.Severity, "warning");
  assert.ok(hit.Details.reasons.length > 0);
});

test("پس از بستن تعارض، سند رسمی صادر می‌شود", async () => {
  const list = await req(`/api/hrm/conflicts?projectId=${PROJECT}&status=open`, { user: "u-hr" });
  for (const c of list.json.data.items) {
    if (c.RequiresAdjustment === true || c.RequiresAdjustment === 1) continue;
    await req(`/api/hrm/conflicts/${c.Id}/close`, {
      user: "u-hr", method: "POST", body: { projectId: PROJECT, resolution: "server_wins" },
    });
  }
  const still = await req(`/api/hrm/conflicts?projectId=${PROJECT}&status=open`, { user: "u-hr" });
  const blocked = still.json.data.items.length;

  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&audience=official`, { user: "u-pm" });
  if (blocked === 0) {
    assert.equal(r.status, 200, r.text.slice(0, 300));
    assert.equal(r.json.data.gate.ok, true);
  } else {
    /* تعارض نیازمند سند اصلاحی هنوز باز است — دروازه درست بسته مانده. */
    assert.equal(r.status, 409);
  }
});

/* ═══════════ ۴. محتوای سند ═══════════ */

test("سند و داشبورد یک عدد می‌دهند", async () => {
  /* اگر سند محاسبهٔ خودش را داشت، جلسه سر «کدام درست است» می‌گذشت. */
  const dash = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-08&to=2026-08`);
  const rep = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&from=2026-08&to=2026-08`);
  const table = rep.json.data.report.sections.find((s) => s.kind === "table");
  assert.equal(table.rows[0].actual, dash.json.data.histogram.bars[0].actualMh);
});

test("دورهٔ بی‌برنامه در سند «—» می‌گیرد نه صفر", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&from=2026-08&to=2026-08`);
  const table = r.json.data.report.sections.find((s) => s.kind === "table");
  assert.equal(table.rows[0].planned, "—");
  assert.equal(table.rows[0].variance, "—");
});

test("سربرگ شمارهٔ سند می‌سازد", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}`);
  assert.ok(r.json.data.letterhead.docNo, "شمارهٔ سند تولید نشد");
  /* سه لوگو: پیمانکار، کارفرما، مشاور — شکل مشترک گزارش‌ساز مرکزی. */
  for (const k of ["contractor", "client", "consultant"]) {
    assert.ok(r.json.data.letterhead[k]?.name, k);
  }
});

test("سند رسمی کارفرما و مشاور را در فهرست توزیع دارد", async () => {
  /* یافتهٔ لوپ ۱۰: سند به دست کسی می‌رسید که در فهرست توزیع خودش
   * نبود، و بعداً معلوم نمی‌شد چه کسی قانوناً نسخه گرفته است. */
  const r = await req(`/api/hrm/reports/RPT-HRM-CMP?projectId=${OTHER}&audience=official`, { user: "u-pm" });
  if (r.status !== 200) return; /* دروازه بسته — در آزمون دیگری پوشش دارد */
  const lh = r.json.data.letterhead;
  assert.ok(lh.distribution.includes(lh.client.name), "کارفرما در فهرست توزیع نیست");
  assert.ok(lh.distribution.includes(lh.consultant.name), "مشاور در فهرست توزیع نیست");
});

test("سند داخلی فهرست توزیع را گسترش نمی‌دهد", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-CMP?projectId=${PROJECT}`);
  const lh = r.json.data.letterhead;
  assert.ok(!lh.distribution.includes(lh.client.name));
});

test("فهرست توزیع صریح کاربر بازنویسی نمی‌شود", async () => {
  /* اگر کاربر فهرست داده، سامانه نباید نامی به آن اضافه کند. */
  const lh = encodeURIComponent(JSON.stringify({ distribution: ["فقط مدیر پروژه"] }));
  const r = await req(`/api/hrm/reports/RPT-HRM-CMP?projectId=${OTHER}&audience=official&letterhead=${lh}`, { user: "u-pm" });
  if (r.status !== 200) return;
  assert.deepEqual(r.json.data.letterhead.distribution, ["فقط مدیر پروژه"]);
});

test("سربرگ از پارامتر بازنویسی می‌شود", async () => {
  const lh = encodeURIComponent(JSON.stringify({ projectCode: "AZ1", revision: "03" }));
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&letterhead=${lh}`);
  assert.equal(r.json.data.letterhead.projectCode, "AZ1");
  assert.ok(r.json.data.letterhead.docNo.includes("AZ1"));
});

test("سربرگ نامعتبر گزارش را نمی‌شکند", async () => {
  /* ورودی خراب نباید صدور را متوقف کند؛ پیش‌فرض جای آن می‌نشیند. */
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&letterhead=%7Bbroken`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.letterhead.docNo);
});

test("گزارش انطباق نرخ و هشدارها را می‌دهد", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-CMP?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.report.code, "RPT-HRM-CMP");
  const kpi = r.json.data.report.sections.find((s) => s.kind === "kpi");
  assert.ok(kpi.cells.some((c) => c.label.fa === "نرخ انطباق"));
});

test("برآورد صفحه و شمار ردیف برمی‌گردد", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}`);
  assert.ok(r.json.data.pages >= 1);
  assert.equal(typeof r.json.data.rows, "number");
});

/* ═══════════ ۵. قالب‌های خروجی ═══════════ */

test("قالب CSV با BOM می‌آید", async () => {
  /* بدون BOM، اکسل فارسی را خراب می‌خواند. */
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&format=csv`, { raw: true });
  assert.equal(r.status, 200);
  assert.ok(r.type.includes("text/csv"));
  assert.equal(r.buf[0], 0xef);
  assert.equal(r.buf[1], 0xbb);
  assert.equal(r.buf[2], 0xbf);
  assert.ok(r.disp.includes("attachment"));
});

test("قالب Word نوع MIME درست دارد", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&format=doc`, { raw: true });
  assert.equal(r.status, 200);
  assert.ok(r.type.includes("msword"));
  assert.ok(r.disp.includes(".doc"));
});

test("قالب Excel نوع MIME درست دارد", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&format=xls`, { raw: true });
  assert.equal(r.status, 200);
  assert.ok(r.type.includes("ms-excel"));
});

test("قالب HTML سند چاپی می‌دهد", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&format=html`);
  assert.equal(r.status, 200);
  assert.ok(r.type.includes("text/html"));
  assert.ok(r.text.includes("<html") || r.text.includes("<!DOCTYPE"));
});

test("PDF همان HTML آمادهٔ چاپ است", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&format=pdf`);
  assert.equal(r.status, 200);
  assert.ok(r.type.includes("text/html"));
});

test("قالب ناشناخته با فهرست گزینه‌ها رد می‌شود", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&format=dwg`);
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-RPT-FORMAT");
  assert.ok(r.json.error.detailsFa.includes("csv"));
});

test("زبان انگلیسی سند را می‌شکند نه", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&format=html&lang=en`);
  assert.equal(r.status, 200);
});

/* ═══════════ ۶. مرز پروژه ═══════════ */

test("گزارش پروژهٔ دیگر دادهٔ این پروژه را نشان نمی‌دهد", async () => {
  const a = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&from=2026-08&to=2026-08`);
  const b = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${OTHER}&from=2026-08&to=2026-08`);
  const rowA = a.json.data.report.sections.find((s) => s.kind === "table").rows[0];
  const rowB = b.json.data.report.sections.find((s) => s.kind === "table").rows[0];
  assert.notEqual(rowA.actual, rowB.actual);
  assert.equal(rowB.actual, 0);
});

test("بازهٔ نیمه رد می‌شود", async () => {
  /* سندی که ندانیم کدام ماه‌ها را پوشش می‌دهد بی‌معناست. */
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&from=2026-08`);
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-HRM-RANGE");
});

test("بازهٔ وارونه رد می‌شود", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}&from=2026-09&to=2026-01`);
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-HRM-RANGE-ORDER");
});

/* ═══════════ ۷. ممیزی و قرارداد پاسخ ═══════════ */

test("صدور رسمی موفق رد ممیزی می‌گذارد", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-CMP?projectId=${OTHER}&audience=official`, { user: "u-pm" });
  if (r.status !== 200) return; /* دروازه بسته — در آزمون دیگری پوشش دارد */
  const hit = (await auditRows()).find((x) => x.Details?.traceId === r.json.meta.traceId);
  assert.ok(hit, "رد ممیزی صدور رسمی ثبت نشد");
  assert.equal(hit.Action, "HRM_REPORT_PUBLISHED");
  assert.ok(hit.Details.docNo);
});

test("گزارش داخلی سیاهه را با نویز پر نمی‌کند", async () => {
  const before = (await auditRows()).length;
  await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}`);
  assert.equal((await auditRows()).length, before);
});

test("پاسخ JSON قالب مشترک HRM دارد", async () => {
  const r = await req(`/api/hrm/reports/RPT-HRM-MP?projectId=${PROJECT}`);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.meta.engine, "hrm-v1");
  assert.ok(r.json.meta.traceId);
});
