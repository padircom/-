/**
 * MOD-10 / HRM D12 — آزمون REST ارسال هزینهٔ نیرو به مالی.
 *
 * محور: ارسال دوباره نباید `Actual` را متورم کند، سهم ماژول دیگر روی
 * همان حساب نباید آسیب ببیند، و دورهٔ باز نباید ارسال شود.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execPath } from "node:process";
import { mkdtemp, cp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4739;
const BASE = `http://127.0.0.1:${PORT}`;
const PROJECT = "p1";
const OTHER = "p2";
const PERIOD = "2026-11";
let child, dir;

async function req(path, { user = "u-pmo", method = "GET", body } = {}) {
  const headers = { "content-type": "application/json" };
  if (user) headers["x-user-id"] = user;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* غیر JSON */ }
  return { status: res.status, json, text };
}

async function table(name) {
  try {
    return JSON.parse(await readFile(join(dir, `${name}.json`), "utf8"));
  } catch {
    return [];
  }
}

async function auditRows() {
  return (await table("AuditLog")).map((x) => ({
    ...x,
    Details: typeof x.Details === "string" ? JSON.parse(x.Details) : (x.Details ?? {}),
  }));
}

/** برگهٔ کاملاً تأییدشده روی یک حساب هزینه. */
async function approvedSheet(crewId, workDate, cbsId = "CBS-1", projectId = PROJECT) {
  const c = await req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: {
      projectId, crewId, workDate,
      entries: [{ personId: "PER-C1", tradeCode: "CIV-RBR", activityId: "A-1", cbsId, hoursRaw: 8 }],
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

const post = (over = {}) =>
  req("/api/hrm/cost/post", { method: "POST", body: { projectId: PROJECT, periodCode: PERIOD, ...over } });

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "hrm-cost-"));
  await cp("server/data", dir, { recursive: true }).catch(() => {});
  child = spawn(execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dir, RATE_LIMIT_PER_MINUTE: "100000" },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) break; } catch { /* بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 150));
  }

  /* حساب هزینه باید واقعاً وجود داشته باشد؛ `CostAccount` در
   * `PUBLIC_TABLES` است و از مسیر عمومی ساخته می‌شود.
   *
   * `Actual` عمداً از صفر شروع نمی‌شود: می‌خواهیم ثابت کنیم سهم
   * ماژول دیگر روی همان حساب دست‌نخورده می‌ماند. */
  const acc = await fetch(`${BASE}/api/data/CostAccount`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": "u-admin" },
    body: JSON.stringify({
      Id: "CBS-1", ProjectId: PROJECT, Code: "CBS-1",
      TitleFa: "هزینهٔ مستقیم نیرو", Budget: 100000, Committed: 0,
      Actual: 5000, Currency: "IRR",
    }),
  });
  assert.ok(acc.ok || acc.status === 409, `ساخت حساب هزینه: ${acc.status} ${await acc.text()}`);

  await approvedSheet("CR-C1", `${PERIOD}-03`);
  const rc = await req("/api/hrm/rate-cards", {
    user: "u-hr", method: "POST",
    body: { projectId: PROJECT, tradeCode: "CIV-RBR", hourlyRate: 100, effectiveFrom: "2026-01-01" },
  });
  assert.equal(rc.status, 201, rc.text.slice(0, 200));
});

after(async () => {
  child?.kill();
  if (dir) await rm(dir, { recursive: true, force: true });
});

/* ═══════════ ۱. دسترسی و تفکیک وظیفه ═══════════ */

test("بدون شناسهٔ کاربر ۴۰۱ می‌دهد", async () => {
  const r = await req(`/api/hrm/rate-cards?projectId=${PROJECT}`, { user: null });
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, "E-HRM-AUTH-REQUIRED");
});

test("۴۰۱ و ۴۰۳ دو کد متفاوت‌اند", async () => {
  const a = await req(`/api/hrm/rate-cards?projectId=${PROJECT}`, { user: null });
  const b = await req(`/api/hrm/rate-cards?projectId=${PROJECT}`, { user: "u-site" });
  assert.equal(b.status, 403);
  assert.notEqual(a.json.error.code, b.json.error.code);
  assert.equal(b.json.error.permission, "hrm.rate.view");
});

test("تعریف‌کنندهٔ نرخ نمی‌تواند هزینه بفرستد", async () => {
  /* SOD-28: وگرنه می‌شد نرخ را بالا برد و همان لحظه ارسال کرد —
   * بی‌آنکه هیچ ساعتی جعل شده باشد. */
  const rate = await req("/api/hrm/rate-cards", {
    user: "u-hr", method: "POST",
    body: { projectId: PROJECT, tradeCode: "CIV-FRM", hourlyRate: 90, effectiveFrom: "2026-01-01" },
  });
  assert.equal(rate.status, 201);

  const send = await req("/api/hrm/cost/post", { user: "u-hr", method: "POST", body: { projectId: PROJECT, periodCode: PERIOD } });
  assert.equal(send.status, 403);
  assert.equal(send.json.error.permission, "hrm.cost.post");
});

test("تأییدکنندهٔ نهایی کارکرد نمی‌تواند هزینه بفرستد", async () => {
  /* SOD-17: مدیر پروژه دوره را قفل می‌کند، نمی‌فرستد. */
  const r = await req("/api/hrm/cost/post", { user: "u-pm", method: "POST", body: { projectId: PROJECT, periodCode: PERIOD } });
  assert.equal(r.status, 403);
});

test("ارسال‌کننده نمی‌تواند نرخ تعریف کند", async () => {
  const r = await req("/api/hrm/rate-cards", {
    user: "u-pmo", method: "POST",
    body: { projectId: PROJECT, tradeCode: "X", hourlyRate: 1, effectiveFrom: "2026-01-01" },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.rate.manage");
});

test("بدون شناسهٔ پروژه رد می‌شود", async () => {
  assert.equal((await req("/api/hrm/rate-cards", { user: "u-hr" })).status, 400);
});

/* ═══════════ ۲. کارت نرخ ═══════════ */

test("کارت نرخ نامعتبر رد می‌شود", async () => {
  const bad = await req("/api/hrm/rate-cards", {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, tradeCode: "", hourlyRate: -5, effectiveFrom: "بد" },
  });
  assert.equal(bad.status, 422);
  const codes = bad.json.error.issues.map((i) => i.code);
  assert.ok(codes.includes("E-HRM-460"));
  assert.ok(codes.includes("E-HRM-461"));
  assert.ok(codes.includes("E-HRM-462"));
});

test("نرخ صفر رد می‌شود", async () => {
  /* صفر یعنی «ثبت نشده»، نه «رایگان». */
  const r = await req("/api/hrm/rate-cards", {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, tradeCode: "CIV-RBR", hourlyRate: 0, effectiveFrom: "2026-05-01" },
  });
  assert.equal(r.status, 422);
});

test("نسخهٔ تازه، نسخهٔ باز قبلی را می‌بندد", async () => {
  /* دو نرخ هم‌زمان معتبر یعنی انتخاب میانشان دلبخواهی. */
  const r = await req("/api/hrm/rate-cards", {
    user: "u-hr", method: "POST",
    body: { projectId: PROJECT, tradeCode: "CIV-RBR", hourlyRate: 130, effectiveFrom: "2026-12-01" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.data.closedVersions, 1);

  const cards = (await table("HrmRateCard")).filter((c) => c.TradeCode === "CIV-RBR" && c.ProjectId === PROJECT);
  const open = cards.filter((c) => !c.EffectiveTo);
  assert.equal(open.length, 1, "فقط یک نسخهٔ باز باید بماند");
  assert.equal(Number(open[0].HourlyRate), 130);
});

test("نرخ مؤثر در تاریخ برگردانده می‌شود", async () => {
  const before = await req(`/api/hrm/rate-cards?projectId=${PROJECT}&tradeCode=CIV-RBR&onDate=2026-06-01`, { user: "u-hr" });
  assert.equal(Number(before.json.data.effective.HourlyRate), 100);

  const after = await req(`/api/hrm/rate-cards?projectId=${PROJECT}&tradeCode=CIV-RBR&onDate=2026-12-15`, { user: "u-hr" });
  assert.equal(Number(after.json.data.effective.HourlyRate), 130);
});

test("ثبت کارت نرخ رد ممیزی می‌گذارد", async () => {
  const rows = await auditRows();
  const hit = rows.filter((x) => x.Action === "HRM_RATE_CARD_SET").at(-1);
  assert.ok(hit, "رد ممیزی ثبت نشد");
  assert.ok(hit.Details.tradeCode);
});

test("بستن نسخهٔ قبلی شدت هشدار می‌گیرد", async () => {
  /* بازنویسی نرخ رویدادی است که باید دیده شود. */
  const rows = await auditRows();
  const warn = rows.find((x) => x.Action === "HRM_RATE_CARD_SET" && x.Details.closedVersions > 0);
  assert.ok(warn);
  assert.equal(warn.Severity, "warning");
});

/* ═══════════ ۳. دروازهٔ ارسال ═══════════ */

test("پیش‌نمایش پیش از ارسال کار می‌کند", async () => {
  const r = await post();
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.json.data.mode, "preview");
  assert.equal(r.json.data.periodLocked, false);
});

test("برگهٔ تأییدنشده ارسال را ۴۰۹ می‌کند", async () => {
  /* عدد پیش‌نویس در دفتر مالی جایی ندارد. */
  const draft = await req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, crewId: "CR-DRAFT", workDate: `${PERIOD}-09`,
      entries: [{ personId: "PER-C1", tradeCode: "CIV-RBR", activityId: "A-1", cbsId: "CBS-1", hoursRaw: 4 }],
    },
  });
  assert.equal(draft.status, 201);

  const r = await post({ apply: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-451");
  assert.ok(r.json.error.reasons.some((x) => x.includes("تأییدنشده")));

  /* پاک‌سازی: برگهٔ پیش‌نویس نباید آزمون‌های بعدی را مسدود کند. */
  const del = await req(`/api/hrm/timesheets/${draft.json.data.id}`, {
    user: "u-hr", method: "DELETE", body: { projectId: PROJECT, reasonFa: "پاک‌سازی آزمون" },
  });
  if (del.status !== 200) {
    /* اگر حذف پشتیبانی نشود، تا آخر زنجیره تأییدش می‌کنیم. */
    for (const [to, user, extra] of [
      ["submitted", "u-site", {}],
      ["foreman_approved", "u-hr", { foremanSignatureRef: "sig-draft" }],
      ["qc_verified", "u-qc", {}],
      ["pm_approved", "u-pm", {}],
    ]) {
      await req(`/api/hrm/timesheets/${draft.json.data.id}/transition`, {
        user, method: "POST", body: { projectId: PROJECT, to, ...extra },
      });
    }
  }
});

test("تلاش مسدودشده رد ممیزی می‌گذارد", async () => {
  const hit = (await auditRows()).find((x) => x.Action === "HRM_COST_POST_BLOCKED");
  assert.ok(hit);
  assert.equal(hit.Severity, "warning");
});

test("کد دورهٔ بدقالب رد می‌شود", async () => {
  const r = await req("/api/hrm/cost/post", { method: "POST", body: { projectId: PROJECT, periodCode: "2026" } });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-HRM-463");
});

/* ═══════════ ۴. ارسال واقعی ═══════════ */

test("ارسال انجام می‌شود و برگه‌ها به posted می‌روند", async () => {
  /* گذار `pm_approved → posted` که سند D2 به «موتور D12» سپرده بود. */
  const preview = await post();
  assert.equal(preview.json.data.gate.ok, true, JSON.stringify(preview.json.data.gate.reasons));
  assert.equal(preview.json.data.mode, "preview");
  const planned = preview.json.data.postings.find((x) => x.costAccountId === "CBS-1");
  assert.ok(planned, "سطر حساب پیدا نشد");

  const applied = await post({ apply: true });
  assert.equal(applied.status, 200, applied.text.slice(0, 250));
  assert.equal(applied.json.data.mode, "applied");
  const row = applied.json.data.postings.find((x) => x.costAccountId === "CBS-1");
  assert.equal(row.status, "posted");
  assert.equal(row.hrmShare, planned.hrmShare, "پیش‌نمایش و ارسال یک رقم می‌دهند");
  assert.ok(applied.json.data.movedToPosted >= 1, "برگه‌ای به posted نرفت");
});

test("پس از ارسال، دوره قابل قفل شدن است", async () => {
  /* پیش از D12 بن‌بست بود: قفل همهٔ برگه‌ها را `posted` می‌خواست و
   * `posted` شدن نتیجهٔ ارسال است که خودش قفل می‌خواست. */
  const lock = await req("/api/hrm/periods/lock", {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, periodCode: PERIOD },
  });
  assert.equal(lock.status, 201, lock.text.slice(0, 250));
});

test("ارسال روی دورهٔ قفل‌شده هشدار می‌دهد نه خطا", async () => {
  const r = await post();
  assert.equal(r.json.data.periodLocked, true);
  assert.ok(r.json.data.gate.warnings.some((w) => w.includes("قفل")));
  assert.equal(r.json.data.gate.ok, true);
});

test("ارسال دوباره جمع را متورم نمی‌کند", async () => {
  /* در عمل همیشه پیش می‌آید: یک ردیف اصلاح می‌شود و دوره دوباره
   * ارسال می‌گردد. */
  const accounts1 = await table("CostAccount");
  const before = Number(accounts1.find((a) => a.Id === "CBS-1")?.Actual ?? 0);

  const again = await post({ apply: true });
  assert.equal(again.status, 200);

  const accounts2 = await table("CostAccount");
  const after = Number(accounts2.find((a) => a.Id === "CBS-1")?.Actual ?? 0);
  assert.equal(after, before, "رقم نباید عوض شود");
});

test("دفتر ارسال یک سطر برای هر حساب و دوره دارد", async () => {
  const rows = (await table("HrmCostPosting")).filter((x) => x.ProjectId === PROJECT && x.PeriodCode === PERIOD);
  const keys = rows.map((x) => `${x.CostAccountId}`);
  assert.equal(new Set(keys).size, keys.length, "سطر تکراری ساخته شد");
});

test("کاهش نرخ رقم دفتر مالی را پایین می‌آورد", async () => {
  /* اثبات اینکه واقعاً «جایگزینی» است نه «افزودن». */
  const accountsBefore = await table("CostAccount");
  const before = Number(accountsBefore.find((a) => a.Id === "CBS-1")?.Actual ?? 0);

  const cut = await req("/api/hrm/rate-cards", {
    user: "u-hr", method: "POST",
    body: { projectId: PROJECT, tradeCode: "CIV-RBR", hourlyRate: 50, effectiveFrom: `${PERIOD}-01` },
  });
  assert.equal(cut.status, 201);

  const r = await post({ apply: true });
  assert.equal(r.status, 200);
  const accountsAfter = await table("CostAccount");
  const after = Number(accountsAfter.find((a) => a.Id === "CBS-1")?.Actual ?? 0);
  assert.ok(after < before, `انتظار کاهش: ${before} → ${after}`);
});

test("سهم ماژول دیگر روی همان حساب دست‌نخورده می‌ماند", async () => {
  /* حساب با ۵۰۰۰ شروع شد. هرچه HRM بفرستد، آن ۵۰۰۰ باید بماند. */
  const actual = Number((await table("CostAccount")).find((a) => a.Id === "CBS-1")?.Actual ?? 0);
  const share = Number((await table("HrmCostPosting")).find(
    (x) => x.ProjectId === PROJECT && x.PeriodCode === PERIOD && x.CostAccountId === "CBS-1"
  )?.Amount ?? 0);
  assert.equal(Math.round((actual - share) * 100) / 100, 5000, "سهم غیر HRM جابه‌جا شد");
});

test("ارسال موفق رد ممیزی می‌گذارد", async () => {
  const hit = (await auditRows()).filter((x) => x.Action === "HRM_COST_POSTED").at(-1);
  assert.ok(hit, "رد ممیزی ارسال ثبت نشد");
  assert.equal(hit.SubjectId, "u-pmo");
  assert.ok(hit.Details.accounts >= 1);
});

test("پیش‌نمایش سیاهه را با نویز پر نمی‌کند", async () => {
  const before = (await auditRows()).length;
  await post();
  assert.equal((await auditRows()).length, before);
});

test("کلید رویداد برای D13 ساخته می‌شود", async () => {
  const rows = (await table("HrmCostPosting")).filter((x) => x.ProjectId === PROJECT && x.PeriodCode === PERIOD);
  assert.ok(rows.every((x) => String(x.EventKey ?? "").startsWith("hrm.labor.posted:")));
});

/* ═══════════ ۵. دفتر ارسال ═══════════ */

test("دفتر ارسال جمع‌ها را می‌دهد", async () => {
  const r = await req(`/api/hrm/cost/postings?projectId=${PROJECT}`, { user: "u-pm" });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.count >= 1);
  assert.equal(typeof r.json.data.totalAmount, "number");
  assert.equal(typeof r.json.data.unpricedHours, "number");
});

test("فیلتر دوره روی دفتر کار می‌کند", async () => {
  const r = await req(`/api/hrm/cost/postings?projectId=${PROJECT}&periodCode=${PERIOD}`, { user: "u-pm" });
  assert.ok(r.json.data.items.every((x) => x.PeriodCode === PERIOD));

  const none = await req(`/api/hrm/cost/postings?projectId=${PROJECT}&periodCode=2019-01`, { user: "u-pm" });
  assert.equal(none.json.data.count, 0);
});

/* ═══════════ ۶. یکپارچگی با مسیر هزینهٔ D4 ═══════════ */

test("دو مسیر هزینه یک نرخ می‌بینند", async () => {
  /* پیش از D12، `/api/hrm/cost` نرخ را از `WorkforceMember.DailyRate`
   * می‌ساخت و مسیر ارسال از کارت نرخ — دو رقم از یک دوره. */
  const legacy = await req(`/api/hrm/cost?projectId=${PROJECT}&periodCode=${PERIOD}`, { user: "u-hr" });
  assert.equal(legacy.status, 200, legacy.text.slice(0, 200));
  const preview = await post();

  assert.equal(
    legacy.json.data.totalAmount,
    preview.json.data.totals.amount,
    "مبلغ دو مسیر باید یکی باشد"
  );
  assert.equal(legacy.json.data.totalEquivalentHours, preview.json.data.totals.equivalentHours);
});

/* ═══════════ ۷. مرز پروژه ═══════════ */

test("ارسال پروژهٔ دیگر حساب این پروژه را دست نمی‌زند", async () => {
  const before = (await table("CostAccount")).find((a) => a.Id === "CBS-1")?.Actual;
  const r = await req("/api/hrm/cost/post", { method: "POST", body: { projectId: OTHER, periodCode: PERIOD } });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.postings.length, 0, "پروژهٔ دیگر نباید سطری داشته باشد");
  const after = (await table("CostAccount")).find((a) => a.Id === "CBS-1")?.Actual;
  assert.equal(after, before);
});

test("برگه نمی‌تواند حساب هزینهٔ پروژهٔ دیگر را هدف بگیرد", async () => {
  /* یافتهٔ لوپ ۸: برگهٔ p1 روی حساب p2 نوشت و رقم آن پروژه را عوض
   * کرد. نمایهٔ حساب‌ها حالا با `ProjectId` فیلتر می‌شود. */
  const acc = await fetch(`${BASE}/api/data/CostAccount`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": "u-admin" },
    body: JSON.stringify({
      Id: "CBS-OTHER", ProjectId: OTHER, Code: "CBS-OTHER",
      TitleFa: "حساب پروژهٔ دیگر", Budget: 9999, Committed: 0, Actual: 777, Currency: "IRR",
    }),
  });
  assert.ok(acc.ok || acc.status === 409);

  const PER2 = "2026-12";
  await approvedSheet("CR-CROSS", `${PER2}-04`, "CBS-OTHER");
  const r = await req("/api/hrm/cost/post", { method: "POST", body: { projectId: PROJECT, periodCode: PER2, apply: true } });
  assert.equal(r.status, 200, r.text.slice(0, 250));
  const row = r.json.data.postings.find((x) => x.costAccountId === "CBS-OTHER");
  assert.equal(row.status, "missing_account", "حساب پروژهٔ دیگر نباید نوشته شود");

  const after = Number((await table("CostAccount")).find((a) => a.Id === "CBS-OTHER")?.Actual ?? 0);
  assert.equal(after, 777, "رقم پروژهٔ دیگر جابه‌جا شد");
});

test("کارت نرخ پروژهٔ دیگر دیده نمی‌شود", async () => {
  const r = await req(`/api/hrm/rate-cards?projectId=${OTHER}`, { user: "u-hr" });
  assert.equal(r.json.data.count, 0);
});

test("دفتر ارسال پروژهٔ دیگر خالی است", async () => {
  const r = await req(`/api/hrm/cost/postings?projectId=${OTHER}`, { user: "u-pm" });
  assert.equal(r.json.data.count, 0);
});

/* ═══════════ ۸. قرارداد پاسخ ═══════════ */

test("مسیرهای D12 قالب مشترک HRM دارند", async () => {
  for (const [p, user] of [
    ["/api/hrm/rate-cards", "u-hr"],
    ["/api/hrm/cost/postings", "u-pm"],
  ]) {
    const r = await req(`${p}?projectId=${PROJECT}`, { user });
    assert.equal(r.status, 200, `${p}: ${r.text.slice(0, 150)}`);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.meta.engine, "hrm-v1");
    assert.ok(r.json.meta.traceId);
  }
});
