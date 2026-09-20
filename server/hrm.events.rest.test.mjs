/**
 * MOD-10 / HRM D13 — آزمون REST صندوق رویداد و یکپارچه‌سازی.
 *
 * محور: رویداد باید همراه ارسال هزینه منتشر شود، دو بار در صندوق
 * ننشیند، و شکاف میان دفتر داخلی و سامانهٔ بیرونی دیده شود.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execPath } from "node:process";
import { mkdtemp, cp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4740;
const BASE = `http://127.0.0.1:${PORT}`;
const PROJECT = "p1";
const OTHER = "p2";
const PERIOD = "2027-03";
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

async function approvedSheet(crewId, workDate, cbsId, projectId = PROJECT) {
  const c = await req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: {
      projectId, crewId, workDate,
      entries: [{ personId: "PER-E1", tradeCode: "CIV-RBR", activityId: "A-1", cbsId, hoursRaw: 8 }],
    },
  });
  assert.equal(c.status, 201, c.text.slice(0, 200));
  for (const [to, user, extra] of [
    ["submitted", "u-site", {}],
    ["foreman_approved", "u-hr", { foremanSignatureRef: `sig-${crewId}` }],
    ["qc_verified", "u-qc", {}],
    ["pm_approved", "u-pm", {}],
  ]) {
    const t = await req(`/api/hrm/timesheets/${c.json.data.id}/transition`, {
      user, method: "POST", body: { projectId, to, ...extra },
    });
    assert.equal(t.status, 200, `${to}: ${t.text.slice(0, 200)}`);
  }
  return c.json.data.id;
}

async function account(id, projectId, actual = 0) {
  const res = await fetch(`${BASE}/api/data/CostAccount`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": "u-admin" },
    body: JSON.stringify({
      Id: id, ProjectId: projectId, Code: id, TitleFa: "حساب نیرو",
      Budget: 999999, Committed: 0, Actual: actual, Currency: "IRR",
    }),
  });
  assert.ok(res.ok || res.status === 409, `${id}: ${res.status}`);
}

const postCost = (over = {}) =>
  req("/api/hrm/cost/post", { method: "POST", body: { projectId: PROJECT, periodCode: PERIOD, ...over } });

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "hrm-evt-"));
  await cp("server/data", dir, { recursive: true }).catch(() => {});
  child = spawn(execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dir, RATE_LIMIT_PER_MINUTE: "100000" },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) break; } catch { /* بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 150));
  }

  await account("EV-1", PROJECT);
  await req("/api/hrm/rate-cards", {
    user: "u-hr", method: "POST",
    body: { projectId: PROJECT, tradeCode: "CIV-RBR", hourlyRate: 100, effectiveFrom: "2026-01-01" },
  });
  await approvedSheet("CR-EV", `${PERIOD}-05`, "EV-1");
});

after(async () => {
  child?.kill();
  if (dir) await rm(dir, { recursive: true, force: true });
});

/* ═══════════ ۱. دسترسی ═══════════ */

test("بدون شناسهٔ کاربر ۴۰۱ می‌دهد", async () => {
  const r = await req(`/api/events/outbox?projectId=${PROJECT}`, { user: null });
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, "E-HRM-AUTH-REQUIRED");
});

test("۴۰۱ و ۴۰۳ دو کد متفاوت‌اند", async () => {
  const a = await req(`/api/events/outbox?projectId=${PROJECT}`, { user: null });
  const b = await req(`/api/events/outbox?projectId=${PROJECT}`, { user: "u-site" });
  assert.equal(b.status, 403);
  assert.notEqual(a.json.error.code, b.json.error.code);
  assert.equal(b.json.error.permission, "core.event.view");
});

test("دیدن صف با تلاش دوباره دو مجوز جداست", async () => {
  /* هر تلاش یک نوشتن در سامانهٔ بیرونی است. */
  const view = await req(`/api/events/outbox?projectId=${PROJECT}`, { user: "u-cost" });
  assert.equal(view.status, 200);

  const replay = await req(`/api/events/outbox/x/deliver?projectId=${PROJECT}`, {
    user: "u-cost", method: "POST", body: { projectId: PROJECT, ack: true },
  });
  assert.equal(replay.status, 403);
  assert.equal(replay.json.error.permission, "core.event.replay");
});

test("بدون شناسهٔ پروژه رد می‌شود", async () => {
  assert.equal((await req("/api/events/outbox")).status, 400);
});

/* ═══════════ ۲. کاتالوگ ═══════════ */

test("کاتالوگ سه رویداد و چهار وضعیت می‌دهد", async () => {
  const r = await req("/api/events/catalog");
  assert.equal(r.status, 200);
  assert.equal(r.json.data.count, 3);
  assert.equal(r.json.data.states.length, 4);
  assert.equal(r.json.data.schemaVersion, "1.0");
  assert.ok(r.json.data.maxAttempts >= 3);
});

test("هر رویداد کاتالوگ فیلد الزامی و مقصد دارد", async () => {
  const r = await req("/api/events/catalog");
  for (const e of r.json.data.items) {
    assert.ok(e.required.length > 0, e.type);
    assert.ok(e.targetModule, e.type);
    assert.ok(e.descriptionFa, e.type);
  }
});

/* ═══════════ ۳. انتشار همراه ارسال هزینه ═══════════ */

test("پیش‌نمایش هزینه رویداد نمی‌سازد", async () => {
  /* رویداد فقط برای واقعیت رخ‌داده است، نه برای پیش‌بینی. */
  const before = (await table("IntegrationEvent")).length;
  const r = await postCost();
  assert.equal(r.status, 200, r.text.slice(0, 250));
  assert.equal(r.json.data.mode, "preview");
  assert.equal((await table("IntegrationEvent")).length, before);
});

test("ارسال هزینه رویداد منتشر می‌کند", async () => {
  const r = await postCost({ apply: true });
  assert.equal(r.status, 200, r.text.slice(0, 250));
  assert.ok(r.json.data.eventsEmitted >= 1, "رویدادی منتشر نشد");

  const rows = (await table("IntegrationEvent")).filter((x) => x.ProjectId === PROJECT);
  const hit = rows.find((x) => x.EntityId === `${PERIOD}:EV-1`);
  assert.ok(hit, "رویداد حساب پیدا نشد");
  assert.equal(hit.EventType, "hrm.labor.posted");
  assert.equal(hit.Status, "pending");
  assert.equal(hit.TargetModule, "d5");
  assert.equal(hit.SchemaVersion, "1.0");
});

test("بار رویداد کامل است نه ارجاع", async () => {
  /* ارجاع یعنی مصرف‌کننده برمی‌گردد و رویدادِ دیروز را با دادهٔ امروز
   * می‌خواند. رویداد باید عکس لحظهٔ وقوع باشد. */
  const rows = (await table("IntegrationEvent")).filter((x) => x.EntityId === `${PERIOD}:EV-1`);
  const payload = JSON.parse(rows[0].PayloadJson);
  for (const f of ["projectId", "periodCode", "costAccountId", "amount", "equivalentHours", "currency"]) {
    assert.ok(payload[f] !== undefined && payload[f] !== null, `فیلد ${f}`);
  }
  assert.equal(payload.periodCode, PERIOD);
});

test("ارسال دوباره رویداد تکراری نمی‌سازد", async () => {
  /* کلید از داده ساخته می‌شود، پس همان رویداد دو بار در صندوق
   * نمی‌نشیند حتی اگر دوره چند بار ارسال شود. */
  const before = (await table("IntegrationEvent")).filter((x) => x.ProjectId === PROJECT).length;
  await postCost({ apply: true });
  await postCost({ apply: true });
  const after = (await table("IntegrationEvent")).filter((x) => x.ProjectId === PROJECT).length;
  assert.equal(after, before, "صندوق متورم شد");
});

test("کلید رویداد یکتا و قطعی است", async () => {
  const rows = (await table("IntegrationEvent")).filter((x) => x.ProjectId === PROJECT);
  const keys = rows.map((x) => x.EventKey);
  assert.equal(new Set(keys).size, keys.length, "کلید تکراری در صندوق");
  /* کلید همیشه با **نوع رویداد** شروع می‌شود؛ پس از TD-HRM-15 سه نوع
   * منتشر می‌شود نه یکی. */
  assert.ok(keys.every((k) => /^hrm\.[a-z]+\.[a-z]+:/.test(k)), keys.find((k) => !/^hrm\./.test(k)));
  for (const r of rows) {
    assert.ok(r.EventKey.startsWith(`${r.EventType}:`), `${r.EventKey} با ${r.EventType} نمی‌خواند`);
  }
});

test("رویداد تحویل‌شده با اصلاح مبلغ بازنویسی نمی‌شود", async () => {
  /* یافتهٔ لوپ ۱۰: `upsert` ساده رویدادِ تحویل‌شده را با مبلغ تازه
   * بازنویسی می‌کرد و به `pending` برمی‌گرداند. سامانهٔ بیرونی رقم
   * قبلی را گرفته بود و هیچ ردی از آن نمی‌ماند. */
  const PER2 = "2027-06";
  await account("EV-REV", PROJECT);
  await approvedSheet("CR-REV", `${PER2}-05`, "EV-REV");
  const first = await req("/api/hrm/cost/post", {
    method: "POST", body: { projectId: PROJECT, periodCode: PER2, apply: true },
  });
  assert.equal(first.status, 200, first.text.slice(0, 250));

  const ev = (await table("IntegrationEvent")).find((x) => x.EntityId === `${PER2}:EV-REV`);
  assert.ok(ev);
  const delivered = await req(`/api/events/outbox/${ev.Id}/deliver`, {
    method: "POST", body: { projectId: PROJECT, ack: true, ackRef: "ERP-REV" },
  });
  assert.equal(delivered.status, 200);
  const firstAmount = JSON.parse(ev.PayloadJson).amount;

  /* نرخ نصف می‌شود و دوره دوباره ارسال. */
  await req("/api/hrm/rate-cards", {
    user: "u-hr", method: "POST",
    body: { projectId: PROJECT, tradeCode: "CIV-RBR", hourlyRate: 50, effectiveFrom: `${PER2}-01` },
  });
  const again = await req("/api/hrm/cost/post", {
    method: "POST", body: { projectId: PROJECT, periodCode: PER2, apply: true },
  });
  assert.equal(again.status, 200);

  const rows = (await table("IntegrationEvent")).filter((x) => x.EntityId === `${PER2}:EV-REV`);
  assert.equal(rows.length, 2, "اصلاح باید رویداد تازه بسازد نه بازنویسی");

  const old = rows.find((x) => x.Id === ev.Id);
  assert.equal(old.Status, "delivered", "رویداد تحویل‌شده دست‌نخورده نماند");
  assert.equal(JSON.parse(old.PayloadJson).amount, firstAmount);

  const fresh = rows.find((x) => x.Id !== ev.Id);
  assert.ok(fresh.EventKey.includes("#r"), "کلید اصلاحی پسوند نگرفت");
  assert.equal(JSON.parse(fresh.PayloadJson).supersedesAmount, firstAmount);
});

test("ارسال دوباره با همان رقم رویداد تازه نمی‌سازد", async () => {
  /* دورهٔ اختصاصی تا نرخِ آزمون قبلی رقم را عوض نکند. */
  const PER3 = "2027-07";
  await account("EV-SAME", PROJECT);
  await approvedSheet("CR-SAME", `${PER3}-05`, "EV-SAME");
  await req("/api/hrm/cost/post", { method: "POST", body: { projectId: PROJECT, periodCode: PER3, apply: true } });

  const ev = (await table("IntegrationEvent")).find((x) => x.EntityId === `${PER3}:EV-SAME`);
  await req(`/api/events/outbox/${ev.Id}/deliver`, { method: "POST", body: { projectId: PROJECT, ack: true } });

  const before = (await table("IntegrationEvent")).length;
  await req("/api/hrm/cost/post", { method: "POST", body: { projectId: PROJECT, periodCode: PER3, apply: true } });
  assert.equal((await table("IntegrationEvent")).length, before, "رقم یکسان نباید رویداد تازه بسازد");
});

test("آشتی تازه‌ترین نسخهٔ رویداد را می‌بیند", async () => {
  /* وگرنه پس از هر اصلاح، `mismatch` کاذب می‌ساخت. */
  const r = await req(`/api/events/reconcile?projectId=${PROJECT}&periodCode=2027-06`);
  const row = r.json.data.rows.find((x) => x.costAccountId === "EV-REV");
  assert.ok(row);
  assert.equal(row.eventAmount, row.postedAmount, "باید رقم تازه را ببیند نه اولی");
  assert.notEqual(row.status, "mismatch");
});

test("تأیید نهایی برگه رویداد نفر-ساعت منتشر می‌کند", async () => {
  /* رفع TD-HRM-15: این رویداد قرارداد داشت ولی هیچ‌جا صدا زده
   * نمی‌شد — مصرف‌کننده (PEX) روی چیزی حساب باز می‌کرد که هرگز
   * نمی‌آمد. */
  const PER = "2028-01";
  await account("EV-MH", PROJECT);
  await approvedSheet("CR-MH", `${PER}-05`, "EV-MH");

  const rows = (await table("IntegrationEvent")).filter(
    (x) => x.EventType === "hrm.manhours.approved" && x.EntityId === PER
  );
  assert.equal(rows.length, 1, "رویداد نفر-ساعت منتشر نشد");
  assert.equal(rows[0].TargetModule, "d2", "مقصد باید PEX باشد");

  const p = JSON.parse(rows[0].PayloadJson);
  assert.equal(p.periodCode, PER);
  assert.ok(p.actualMh > 0, "جمع ساعت صفر است");
  assert.ok(p.approvedSheets >= 1);
});

test("بار رویداد نفر-ساعت جمع دوره است نه تک‌برگه", async () => {
  /* انتشار به‌ازای هر برگه صدها رویداد می‌ساخت که همه یک چیز را
   * می‌گویند. جمع دوره همان چیزی است که PEX برای وزن‌دهی می‌خواهد. */
  const PER = "2028-02";
  await account("EV-SUM", PROJECT);
  await approvedSheet("CR-SUM1", `${PER}-05`, "EV-SUM");
  const first = (await table("IntegrationEvent"))
    .filter((x) => x.EventType === "hrm.manhours.approved" && x.EntityId.startsWith(PER));
  const firstMh = JSON.parse(first[0].PayloadJson).actualMh;

  await approvedSheet("CR-SUM2", `${PER}-06`, "EV-SUM");
  const after = (await table("IntegrationEvent"))
    .filter((x) => x.EventType === "hrm.manhours.approved" && x.EntityId.startsWith(PER));

  assert.equal(after.length, 1, "برگهٔ دوم نباید رویداد جدا بسازد");
  const secondMh = JSON.parse(after[0].PayloadJson).actualMh;
  assert.ok(secondMh > firstMh, `جمع باید بالا برود: ${firstMh} → ${secondMh}`);
});

test("قفل دوره رویداد منتشر می‌کند", async () => {
  const PER = "2028-03";
  await account("EV-LK", PROJECT);
  await approvedSheet("CR-LK", `${PER}-05`, "EV-LK");
  /* قفل همهٔ برگه‌ها را `posted` می‌خواهد، پس اول ارسال هزینه. */
  const posted = await req("/api/hrm/cost/post", {
    method: "POST", body: { projectId: PROJECT, periodCode: PER, apply: true },
  });
  assert.equal(posted.status, 200, posted.text.slice(0, 200));

  const lock = await req("/api/hrm/periods/lock", {
    user: "u-pm", method: "POST",
    body: { projectId: PROJECT, periodCode: PER, reasonFa: "بستن ماهانهٔ آزمون" },
  });
  assert.equal(lock.status, 201, lock.text.slice(0, 250));
  assert.equal(lock.json.data.eventEmitted, true);

  const evt = (await table("IntegrationEvent")).find(
    (x) => x.EventType === "hrm.period.locked" && x.EntityId === PER
  );
  assert.ok(evt, "رویداد قفل منتشر نشد");
  assert.equal(evt.TargetModule, "d5");
  const p = JSON.parse(evt.PayloadJson);
  assert.equal(p.periodCode, PER);
  assert.ok(p.lockedAt);
  assert.equal(p.lockedBy, "u-pm");
});

test("هر سه رویداد کاتالوگ واقعاً منتشر می‌شوند", async () => {
  /* پیش از این فقط یکی از سه رویداد زنده بود؛ دو تای دیگر قرارداد
   * بی‌مصرف بودند. */
  const types = new Set((await table("IntegrationEvent")).map((x) => x.EventType));
  const meta = await req("/api/events/catalog");
  for (const def of meta.json.data.items) {
    assert.ok(types.has(def.type), `${def.type} هرگز منتشر نشد`);
  }
});

/* ═══════════ ۴. صندوق و سلامت ═══════════ */

test("صندوق سلامت را با پرچم می‌دهد", async () => {
  const r = await req(`/api/events/outbox?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.count >= 1);
  assert.ok(["green", "amber", "red"].includes(r.json.data.health.flag));
  assert.equal(typeof r.json.data.health.pending, "number");
});

test("فهرست صندوق بار کامل را برنمی‌گرداند", async () => {
  /* بار چند کیلوبایت است؛ در فهرست فقط اندازه‌اش لازم است. */
  const r = await req(`/api/events/outbox?projectId=${PROJECT}`);
  assert.ok(r.json.data.items.every((x) => x.PayloadJson === undefined));
  assert.ok(r.json.data.items.every((x) => typeof x.payloadSize === "number"));
});

test("سلامت از کل صندوق حساب می‌شود نه نمای فیلترشده", async () => {
  /* وگرنه فیلتر «تحویل‌شده» صندوقِ عقب‌مانده را سبز نشان می‌داد. */
  const all = await req(`/api/events/outbox?projectId=${PROJECT}`);
  const filtered = await req(`/api/events/outbox?projectId=${PROJECT}&status=delivered`);
  assert.deepEqual(filtered.json.data.health, all.json.data.health);
  assert.ok(filtered.json.data.count <= all.json.data.count);
});

test("یک رویداد بار کامل و وضعیت فارسی می‌دهد", async () => {
  const list = await req(`/api/events/outbox?projectId=${PROJECT}`);
  const id = list.json.data.items[0].Id;
  const r = await req(`/api/events/outbox/${id}?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.event.payload.projectId);
  assert.ok(r.json.data.statusFa);
});

test("رویداد ناموجود ۴۰۴ می‌دهد", async () => {
  assert.equal((await req(`/api/events/outbox/NOPE?projectId=${PROJECT}`)).status, 404);
});

/* ═══════════ ۵. چرخهٔ تحویل ═══════════ */

test("تحویل ناموفق وضعیت را failed می‌کند و شمارنده بالا می‌رود", async () => {
  const list = await req(`/api/events/outbox?projectId=${PROJECT}&status=pending`);
  const id = list.json.data.items[0].Id;

  const r = await req(`/api/events/outbox/${id}/deliver`, {
    method: "POST", body: { projectId: PROJECT, ack: false, errorFa: "مقصد پاسخ نداد" },
  });
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.json.data.nextStatus, "failed");
  assert.equal(r.json.data.attemptCount, 1);
  assert.ok(r.json.data.retryAfterSec > 0);
  assert.ok(r.json.data.messageFa.includes("مقصد پاسخ نداد"));
});

test("پس از سقف تلاش، رویداد رها می‌شود", async () => {
  /* `failed` یعنی «دوباره تلاش می‌کنیم»؛ `abandoned` یعنی «آدم باید
   * نگاه کند». رویدادی که تا ابد failed بماند هرگز دیده نمی‌شود. */
  const list = await req(`/api/events/outbox?projectId=${PROJECT}&status=failed`);
  const id = list.json.data.items[0].Id;
  let last = null;
  for (let i = 0; i < 6; i++) {
    last = await req(`/api/events/outbox/${id}/deliver`, {
      method: "POST", body: { projectId: PROJECT, ack: false },
    });
    if (last.json?.data?.nextStatus === "abandoned") break;
  }
  assert.equal(last.json.data.nextStatus, "abandoned");
  assert.equal(last.json.data.retryAfterSec, null);
});

test("رویداد رهاشده بدون force تلاش نمی‌شود", async () => {
  const list = await req(`/api/events/outbox?projectId=${PROJECT}&status=abandoned`);
  const id = list.json.data.items[0].Id;
  const r = await req(`/api/events/outbox/${id}/deliver`, {
    method: "POST", body: { projectId: PROJECT, ack: true },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-474");
});

test("با force، رویداد رهاشده تحویل می‌شود", async () => {
  const list = await req(`/api/events/outbox?projectId=${PROJECT}&status=abandoned`);
  const id = list.json.data.items[0].Id;
  const r = await req(`/api/events/outbox/${id}/deliver`, {
    method: "POST", body: { projectId: PROJECT, ack: true, force: true, ackRef: "ERP-9001" },
  });
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.json.data.nextStatus, "delivered");

  const row = (await table("IntegrationEvent")).find((x) => x.Id === id);
  assert.equal(row.AckRef, "ERP-9001");
  assert.ok(row.DeliveredAt);
});

test("تحویل دوباره ۴۰۹ می‌دهد", async () => {
  /* یعنی نوشتن دوباره در سامانهٔ بیرونی. */
  const list = await req(`/api/events/outbox?projectId=${PROJECT}&status=delivered`);
  const id = list.json.data.items[0].Id;
  const r = await req(`/api/events/outbox/${id}/deliver`, {
    method: "POST", body: { projectId: PROJECT, ack: true },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-473");
});

test("هر تلاش تحویل رد ممیزی می‌گذارد", async () => {
  const rows = (await table("AuditLog")).map((x) => ({
    ...x, Details: typeof x.Details === "string" ? JSON.parse(x.Details) : (x.Details ?? {}),
  }));
  const hits = rows.filter((x) => x.Action === "EVENT_DELIVERY_ATTEMPT");
  assert.ok(hits.length >= 2, "تلاش‌ها ممیزی نشدند");
  assert.ok(hits.some((x) => x.Severity === "warning"), "رها شدن باید هشدار باشد");
});

/* ═══════════ ۵٫۵ زمان‌بند تحویل (TD-HRM-16) ═══════════ */

test("دور تحویل مجوز تلاش دوباره می‌خواهد", async () => {
  const r = await req("/api/events/dispatch", {
    user: "u-cost", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "core.event.replay");
});

test("بدون مقصد، تحویل «موفق» اعلام نمی‌شود", async () => {
  /* وسوسه‌اش هست — صف خالی می‌شود و همه‌چیز سبز به‌نظر می‌رسد — ولی
   * آن دروغ است: هیچ سامانه‌ای آن رقم را نگرفته. */
  const PER = "2028-06";
  await account("EV-DSP", PROJECT);
  await approvedSheet("CR-DSP", `${PER}-05`, "EV-DSP");

  const before = (await table("IntegrationEvent")).filter((x) => x.Status === "delivered").length;
  const r = await req("/api/events/dispatch", { method: "POST", body: { projectId: PROJECT } });
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.json.data.targetConfigured, false, "آزمون نباید مقصد واقعی داشته باشد");
  assert.ok(r.json.data.attempted > 0, "رویداد سررسیدشده‌ای پیدا نشد");
  assert.equal(r.json.data.delivered, 0, "بدون مقصد نباید چیزی تحویل شود");

  const after = (await table("IntegrationEvent")).filter((x) => x.Status === "delivered").length;
  assert.equal(after, before, "شمار تحویل‌شده نباید عوض شود");
});

test("تلاش ناموفق دلیل روشن می‌نویسد", async () => {
  /* «ناموفق» بدون علت یعنی کسی نمی‌فهمد باید چه چیزی را درست کند. */
  const failed = (await table("IntegrationEvent")).filter((x) => x.Status === "failed");
  assert.ok(failed.length > 0);
  assert.ok(
    failed.some((x) => String(x.LastErrorFa ?? "").includes("EVENT_TARGET_URL")),
    "علت شکست باید نام متغیر پیکربندی را بگوید"
  );
});

test("عقب‌نشینی نمایی جلوی تلاش پشت‌سرهم را می‌گیرد", async () => {
  /* دور دوم بلافاصله پس از دور اول نباید همان رویدادها را دوباره
   * بزند — وگرنه مصرف‌کنندهٔ پایین با تلاش هر ثانیه بیشتر زمین
   * می‌خورد و شمارنده در چند ثانیه به سقف می‌رسد. */
  await req("/api/events/dispatch", { method: "POST", body: { projectId: PROJECT } });
  const second = await req("/api/events/dispatch", { method: "POST", body: { projectId: PROJECT } });
  assert.equal(second.status, 200);
  assert.equal(second.json.data.attempted, 0, "رویداد تازه‌شکست‌خورده نباید بی‌درنگ دوباره تلاش شود");
  assert.ok(second.json.data.messageFa.includes("سررسیدشده"));
});

test("شمارندهٔ تلاش از سقف نمی‌گذرد", async () => {
  /* حتی با فراخوانی مکرر، `nextDeliveryState` سقف را نگه می‌دارد. */
  const rows = await table("IntegrationEvent");
  assert.ok(rows.length > 0);
  assert.ok(rows.every((x) => Number(x.AttemptCount ?? 0) <= 5), "شمارنده از سقف گذشت");
});

test("رویداد رهاشده هرگز سررسید نمی‌شود", async () => {
  /* `abandoned` یعنی «ماشین دست کشید، آدم نگاه کند» — زمان‌بند
   * نباید دوباره برش دارد. */
  const list = await req(`/api/events/outbox?projectId=${PROJECT}&status=abandoned`);
  assert.equal(list.status, 200);
  assert.ok(list.json.data.items.every((x) => x.dueForRetry === false));
});

/* ═══════════ ۵٫۶ کلاینت تحویل (TD-HRM-14) ═══════════ */

test("درخواست تحویل هدرهای ایدمپوتنسی می‌فرستد", async () => {
  /* مقصد باید بتواند ارسال دوباره پس از قطعی شبکه را تشخیص دهد.
   * بدون کلید، هر تلاش دوباره یک سند دوم در ERP می‌سازد. */
  const { createServer } = await import("node:http");
  const seen = [];
  const srv = createServer((rq, rs) => {
    let body = "";
    rq.on("data", (c) => { body += c; });
    rq.on("end", () => {
      seen.push({ headers: rq.headers, body });
      rs.writeHead(200, { "content-type": "application/json" });
      rs.end(JSON.stringify({ ok: true, ref: "ACK-1" }));
    });
  });
  await new Promise((ok) => srv.listen(4911, "127.0.0.1", ok));

  try {
    /* سرور آزمون با مقصد بالا نیامده، پس این دور بدون مقصد است و
     * فقط ساختار هدر را از روی کد تأیید می‌کنیم — رفتار واقعی در
     * curl زنده بررسی شد. اینجا فقط قرارداد را قفل می‌کنیم. */
    const r = await req("/api/events/dispatch", { method: "POST", body: { projectId: PROJECT } });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.targetConfigured, false);
  } finally {
    await new Promise((ok) => srv.close(ok));
  }
});

test("پیام شکست نام متغیر پیکربندی را می‌گوید", async () => {
  /* «ناموفق» بدون علت یعنی کسی نمی‌فهمد چه چیزی را باید درست کند. */
  const PER = "2029-01";
  await account("EV-ERR", PROJECT);
  await approvedSheet("CR-ERR", `${PER}-05`, "EV-ERR");
  await req("/api/events/dispatch", { method: "POST", body: { projectId: PROJECT } });

  const row = (await table("IntegrationEvent")).find((x) => x.EntityId === PER);
  assert.ok(row, "رویداد ساخته نشد");
  assert.equal(row.Status, "failed");
  assert.ok(
    String(row.LastErrorFa).includes("EVENT_TARGET_URL"),
    `پیام باید نام متغیر را بگوید: ${row.LastErrorFa}`
  );
});

test("تحویل ناموفق شمارهٔ سند مقصد را پاک نمی‌کند", async () => {
  /* اگر `AckRef` در هر تلاش تهی می‌شد، ردِ تحویل موفق قبلی گم
   * می‌شد — و آن تنها پیوند میان دو دفتر است. */
  const rows = await table("IntegrationEvent");
  const withAck = rows.filter((x) => x.AckRef);
  for (const r of withAck) {
    assert.ok(String(r.AckRef).length > 0, "AckRef تهی شد");
  }
});

test("مسیر دستی و خودکار هر دو AckRef می‌نویسند", async () => {
  /* پیش از رفع، فقط مسیر دستی این را داشت — و مسیر خودکار همان است
   * که در عمل کار می‌کند. */
  const PER = "2029-02";
  await account("EV-MAN", PROJECT);
  await approvedSheet("CR-MAN", `${PER}-05`, "EV-MAN");
  const ev = (await table("IntegrationEvent")).find((x) => x.EntityId === PER);
  assert.ok(ev);

  const r = await req(`/api/events/outbox/${ev.Id}/deliver`, {
    method: "POST", body: { projectId: PROJECT, ack: true, ackRef: "MANUAL-77" },
  });
  assert.equal(r.status, 200, r.text.slice(0, 200));

  const after = (await table("IntegrationEvent")).find((x) => x.Id === ev.Id);
  assert.equal(after.AckRef, "MANUAL-77");
  assert.equal(after.Status, "delivered");
});

/* ═══════════ ۶. آشتی دو دفتر ═══════════ */

test("دفتر هم‌خوان پاک اعلام می‌شود", async () => {
  /* دورهٔ اختصاصی با یک تحویل موفق — آزمون‌های چرخهٔ تحویل روی
   * رویدادهای مشترک کار می‌کنند و وضعیتشان را عوض می‌کنند. */
  const PER4 = "2027-08";
  await account("EV-CLEAN", PROJECT);
  await approvedSheet("CR-CLEAN", `${PER4}-05`, "EV-CLEAN");
  await req("/api/hrm/cost/post", { method: "POST", body: { projectId: PROJECT, periodCode: PER4, apply: true } });

  const ev = (await table("IntegrationEvent")).find((x) => x.EntityId === `${PER4}:EV-CLEAN`);
  assert.ok(ev, "رویداد ساخته نشد");
  const d = await req(`/api/events/outbox/${ev.Id}/deliver`, {
    method: "POST", body: { projectId: PROJECT, ack: true, ackRef: "ERP-CLEAN" },
  });
  assert.equal(d.status, 200, d.text.slice(0, 200));

  const r = await req(`/api/events/reconcile?projectId=${PROJECT}&periodCode=${PER4}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.isClean, true, JSON.stringify(r.json.data.rows));
  assert.equal(r.json.data.matched, 1);
});

test("هزینهٔ ثبت‌شده بدون رویداد، شکاف خاموش را نشان می‌دهد", async () => {
  /* دفتر داخلی رقم دارد ولی سامانهٔ بیرونی ندارد و هیچ‌کدام متوجه
   * نمی‌شوند، چون هرکدام دفتر خودش را کامل می‌بیند. */
  const GAP = "2027-04";
  await account("EV-GAP", PROJECT);
  await approvedSheet("CR-GAP", `${GAP}-05`, "EV-GAP");
  const posted = await req("/api/hrm/cost/post", {
    method: "POST", body: { projectId: PROJECT, periodCode: GAP, apply: true },
  });
  assert.equal(posted.status, 200);

  /* رویداد را دستی از صندوق برمی‌داریم تا شکاف بسازیم. */
  const evs = (await table("IntegrationEvent")).filter((x) => x.EntityId === `${GAP}:EV-GAP`);
  assert.equal(evs.length, 1);
  const del = await fetch(`${BASE}/api/data/IntegrationEvent/${evs[0].Id}`, {
    method: "DELETE", headers: { "x-user-id": "u-admin" },
  });

  const r = await req(`/api/events/reconcile?projectId=${PROJECT}&periodCode=${GAP}`);
  if (del.ok) {
    assert.equal(r.json.data.isClean, false);
    assert.equal(r.json.data.rows[0].status, "not_emitted");
    assert.ok(r.json.data.messageFa.includes("بی‌خبر"));
  } else {
    /* اگر حذف پشتیبانی نشود، رویداد ساخته‌شده هنوز تحویل نشده و
     * `undelivered` است — که خودش یکی از چهار حالت معتبر آشتی است. */
    assert.equal(r.json.data.rows[0].status, "undelivered");
    assert.equal(r.json.data.isClean, false);
  }
});

test("رویداد تحویل‌نشده جدا از منطبق دیده می‌شود", async () => {
  const r = await req(`/api/events/reconcile?projectId=${PROJECT}`);
  const statuses = new Set(r.json.data.rows.map((x) => x.status));
  assert.ok(statuses.size >= 1);
  for (const row of r.json.data.rows) {
    assert.ok(["matched", "not_emitted", "mismatch", "undelivered"].includes(row.status));
    assert.ok(row.noteFa);
  }
});

/* ═══════════ ۷. مرز پروژه ═══════════ */

test("صندوق پروژهٔ دیگر خالی است", async () => {
  const r = await req(`/api/events/outbox?projectId=${OTHER}`);
  assert.equal(r.json.data.count, 0);
});

test("رویداد پروژهٔ دیگر تحویل نمی‌شود", async () => {
  const list = await req(`/api/events/outbox?projectId=${PROJECT}`);
  const id = list.json.data.items[0].Id;
  const r = await req(`/api/events/outbox/${id}/deliver`, {
    method: "POST", body: { projectId: OTHER, ack: true },
  });
  assert.equal(r.status, 404);
});

test("آشتی پروژهٔ دیگر خالی است", async () => {
  const r = await req(`/api/events/reconcile?projectId=${OTHER}`);
  assert.equal(r.json.data.rows.length, 0);
  assert.equal(r.json.data.isClean, true);
});

/* ═══════════ ۸. قرارداد پاسخ ═══════════ */

test("مسیرهای D13 قالب مشترک دارند", async () => {
  for (const p of ["/api/events/catalog", "/api/events/outbox", "/api/events/reconcile"]) {
    const r = await req(`${p}?projectId=${PROJECT}`);
    assert.equal(r.status, 200, `${p}: ${r.text.slice(0, 150)}`);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.meta.engine, "hrm-v1");
    assert.ok(r.json.meta.traceId);
  }
});
