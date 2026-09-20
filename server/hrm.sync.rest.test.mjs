/**
 * MOD-10 / HRM D9 — آزمون REST همگام‌سازی میدانی و کارتابل تعارض.
 *
 * تمرکز روی سه چیزی که یک صف آفلاین را خراب می‌کند: ارسال دوباره که
 * ساعت را دو برابر کند، نسخهٔ بازنده‌ای که بی‌صدا گم شود، و تعارضی که
 * بدون اصلاح واقعی «حل شده» اعلام شود.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execPath } from "node:process";
import { mkdtemp, cp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4737;
const BASE = `http://127.0.0.1:${PORT}`;
const PROJECT = "p1";
const OTHER = "p2";
let child, dir;

async function req(path, { user = "u-site", method = "GET", body } = {}) {
  const headers = { "content-type": "application/json" };
  if (user) headers["x-user-id"] = user;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* غیر JSON */ }
  return { status: res.status, json, text };
}

async function auditRows() {
  try {
    const raw = JSON.parse(await readFile(join(dir, "AuditLog.json"), "utf8"));
    return raw.map((x) => ({ ...x, Details: typeof x.Details === "string" ? JSON.parse(x.Details) : (x.Details ?? {}) }));
  } catch {
    return [];
  }
}

const E = (over = {}) => ({
  personId: "PER-S1", tradeCode: "CIV-RBR", activityId: "A-1", cbsId: "CBS-1", hoursRaw: 8, ...over,
});

/** برگهٔ سرور با وضعیت دلخواه. */
async function serverSheet(crewId, workDate, upto = "draft", projectId = PROJECT) {
  const c = await req("/api/hrm/timesheets", {
    method: "POST", body: { projectId, crewId, workDate, entries: [E()] },
  });
  assert.equal(c.status, 201, `${crewId}: ${c.text.slice(0, 200)}`);
  const id = c.json.data.id;
  const chain = [
    ["submitted", "u-site", {}],
    ["foreman_approved", "u-hr", { foremanSignatureRef: `sig-${crewId}` }],
    ["qc_verified", "u-qc", {}],
    ["pm_approved", "u-pm", {}],
  ];
  for (const [to, user, extra] of chain) {
    if (["draft"].includes(upto)) break;
    const t = await req(`/api/hrm/timesheets/${id}/transition`, {
      user, method: "POST", body: { projectId, to, ...extra },
    });
    assert.equal(t.status, 200, `گذار ${to}: ${t.text.slice(0, 200)}`);
    if (to === upto) break;
  }
  return id;
}

async function syncBatch(deviceId, items, { user = "u-site", projectId = PROJECT } = {}) {
  return req("/api/hrm/sync/batch", { user, method: "POST", body: { projectId, deviceId, items } });
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "hrm-sync-"));
  /* `server/data` در .gitignore است و در محیط تازه ممکن است اصلاً
   * وجود نداشته باشد؛ نبودش خطا نیست چون درایور JSON جدول نبوده را
   * فهرست خالی می‌گیرد. */
  await cp("server/data", dir, { recursive: true }).catch(() => {});
  child = spawn(execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dir, RATE_LIMIT_PER_MINUTE: "100000" },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) break; } catch { /* بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 150));
  }
});

after(async () => {
  child?.kill();
  if (dir) await rm(dir, { recursive: true, force: true });
});

/* ═══════════ ۱. دسترسی ═══════════ */

test("بدون شناسهٔ کاربر، همگام‌سازی ۴۰۱ می‌دهد", async () => {
  const r = await req("/api/hrm/sync/batch", { user: null, method: "POST", body: { projectId: PROJECT, deviceId: "d", items: [] } });
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, "E-HRM-AUTH-REQUIRED");
});

test("۴۰۱ و ۴۰۳ دو کد متفاوت‌اند", async () => {
  const a = await req(`/api/hrm/devices?projectId=${PROJECT}`, { user: null });
  const b = await req(`/api/hrm/devices?projectId=${PROJECT}`, { user: "u-sub" });
  assert.equal(a.status, 401);
  assert.equal(b.status, 403);
  assert.notEqual(a.json.error.code, b.json.error.code);
  assert.equal(b.json.error.permission, "hrm.device.monitor");
});

test("ثبت‌کنندهٔ ساعت لزوماً پایشگر دستگاه نیست", async () => {
  /* پیمانکار ساعت می‌فرستد ولی تابلوی ناوگان را نمی‌بیند. */
  const send = await req("/api/hrm/sync-meta", { user: "u-sub" });
  assert.equal(send.status, 200);
  const watch = await req(`/api/hrm/devices?projectId=${PROJECT}`, { user: "u-sub" });
  assert.equal(watch.status, 403);
});

test("بستن تعارض مجوز خودش را می‌خواهد", async () => {
  const r = await req("/api/hrm/conflicts/x/close", {
    user: "u-sub", method: "POST", body: { projectId: PROJECT, resolution: "server_wins" },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.conflict.resolve");
});

test("بدون شناسهٔ پروژه رد می‌شود", async () => {
  assert.equal((await req("/api/hrm/devices")).status, 400);
});

/* ═══════════ ۲. کاتالوگ ═══════════ */

test("کاتالوگ سقف دسته، نقش‌های امضا و تصمیم‌ها را می‌دهد", async () => {
  const r = await req("/api/hrm/sync-meta");
  assert.equal(r.status, 200);
  assert.equal(r.json.data.batchMax, 200);
  assert.equal(r.json.data.signatureRoles.length, 4);
  assert.equal(r.json.data.resolutions.length, 4);
  assert.ok(r.json.data.signatureRoles.every((x) => x.fa));
  assert.ok(r.json.data.staleCritDays > r.json.data.staleWarnDays);
  assert.equal(r.json.meta.engine, "hrm-v1");
});

/* ═══════════ ۳. اعتبارسنجی دسته ═══════════ */

test("دسته بدون شناسهٔ دستگاه رد می‌شود", async () => {
  const r = await syncBatch("", [{ id: "TS-X" }]);
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-420"));
});

test("دستهٔ خالی رد می‌شود", async () => {
  const r = await syncBatch("dev-1", []);
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-421"));
});

test("دستهٔ بزرگ‌تر از سقف رد می‌شود", async () => {
  const big = Array.from({ length: 201 }, (_, i) => ({ id: `TS-${i}` }));
  const r = await syncBatch("dev-1", big);
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-422"));
});

test("شناسهٔ تکراری داخل یک دسته رد می‌شود", async () => {
  const r = await syncBatch("dev-1", [{ id: "TS-D" }, { id: "TS-D" }]);
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-424"));
});

test("دستهٔ نامعتبر هیچ ردیفی نمی‌نویسد", async () => {
  /* پذیرش نیمه‌کاره بدترین حالت است: دستگاه نمی‌داند کدام برگه رفته. */
  const before = await req(`/api/hrm/sync/batches?projectId=${PROJECT}`, { user: "u-hr" });
  await syncBatch("dev-bad", [{ id: "TS-A" }, { id: "TS-A" }]);
  const after = await req(`/api/hrm/sync/batches?projectId=${PROJECT}`, { user: "u-hr" });
  assert.equal(after.json.data.count, before.json.data.count);
});

/* ═══════════ ۴. ایدمپوتنسی ═══════════ */

test("برگهٔ ناشناخته تعارض نیست، فقط تازه است", async () => {
  const r = await syncBatch("dev-new", [{ id: "TS-UNKNOWN", status: "draft", revision: 1 }]);
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.json.data.outcomes[0].action, "create_needed");
  assert.equal(r.json.data.summary.created, 1);
  assert.equal(r.json.data.replay, false);
});

test("ارسال دوبارهٔ همان دسته همان پاسخ را می‌دهد و چیزی نمی‌نویسد", async () => {
  /* شبکهٔ کارگاه دقیقاً وقتی قطع می‌شود که سرور نوشته و پاسخ نرسیده. */
  const items = [{ id: "TS-IDEM", status: "draft", revision: 1 }];
  const first = await syncBatch("dev-idem", items);
  assert.equal(first.json.data.replay, false);

  const second = await syncBatch("dev-idem", items);
  assert.equal(second.status, 200);
  assert.equal(second.json.data.replay, true);
  assert.deepEqual(second.json.data.outcomes, first.json.data.outcomes, "پاسخ باید عیناً همان باشد");
  assert.deepEqual(second.json.data.summary, first.json.data.summary);

  const list = await req(`/api/hrm/sync/batches?projectId=${PROJECT}&deviceId=dev-idem`, { user: "u-hr" });
  assert.equal(list.json.data.count, 1, "دسته یک ردیف بیشتر ندارد");
  assert.equal(Number(list.json.data.items[0].ReplayCount), 1);
});

test("ترتیب متفاوت همان برگه‌ها بازپخش شمرده می‌شود", async () => {
  /* صف دستگاه ممکن است جور دیگری مرتب شود؛ همان دسته است. */
  const a = [{ id: "TS-O1", revision: 1 }, { id: "TS-O2", revision: 1 }];
  const first = await syncBatch("dev-order", a);
  assert.equal(first.json.data.replay, false);
  const second = await syncBatch("dev-order", [...a].reverse());
  assert.equal(second.json.data.replay, true);
});

test("تغییر نسخهٔ برگه دستهٔ تازه است نه بازپخش", async () => {
  /* وگرنه ویرایش اپراتور به‌عنوان تکراری رد می‌شد و کارش گم. */
  await syncBatch("dev-rev", [{ id: "TS-R", revision: 1 }]);
  const r = await syncBatch("dev-rev", [{ id: "TS-R", revision: 2 }]);
  assert.equal(r.json.data.replay, false);
});

test("دستگاه متفاوت با همان محتوا بازپخش نیست", async () => {
  const items = [{ id: "TS-SHARED", revision: 1 }];
  await syncBatch("dev-a", items);
  const r = await syncBatch("dev-b", items);
  assert.equal(r.json.data.replay, false);
});

/* ═══════════ ۵. حل تعارض در دسته ═══════════ */

test("نسخهٔ سرورِ امضاشده بازنویسی نمی‌شود و تعارض ثبت می‌شود", async () => {
  /* برگه‌ای که سرپرست امضا کرده نباید با ارسال دیرهنگام یک گوشی
   * آفلاین پاک شود. */
  const id = await serverSheet("CR-SIGN", "2026-04-01", "foreman_approved");
  const r = await syncBatch("dev-late", [{ id, status: "draft", revision: 1 }]);
  const out = r.json.data.outcomes[0];
  assert.equal(out.winner, "server");
  assert.equal(out.action, "keep_server");
  assert.equal(out.conflictRecorded, true);
  assert.equal(out.requiresAdjustment, true);
  assert.deepEqual(r.json.data.summary.blockedIds, [id]);
});

test("نسخهٔ بازنده در دفتر تعارض می‌نشیند نه سطل زباله", async () => {
  const list = await req(`/api/hrm/conflicts?projectId=${PROJECT}`, { user: "u-hr" });
  assert.equal(list.status, 200);
  const hit = list.json.data.items.find((x) => x.DeviceId === "dev-late");
  assert.ok(hit, "ردیف تعارض ثبت نشده");
  assert.ok(hit.LocalPayload, "نسخهٔ محلی نگهداری نشده");
  assert.equal(hit.Status, "open");
});

test("نسخهٔ محلیِ قوی‌تر برنده می‌شود", async () => {
  const id = await serverSheet("CR-WEAK", "2026-04-02", "draft");
  const r = await syncBatch("dev-strong", [
    { id, status: "foreman_approved", revision: 2, foremanSignatureRef: "sig-x" },
  ]);
  const out = r.json.data.outcomes[0];
  assert.equal(out.winner, "local");
  assert.equal(out.action, "apply_local");
});

test("دستهٔ ترکیبی هر برگه را جدا داوری می‌کند", async () => {
  const locked = await serverSheet("CR-MIX1", "2026-04-03", "foreman_approved");
  const fresh = await serverSheet("CR-MIX2", "2026-04-04", "draft");
  const r = await syncBatch("dev-mix", [
    { id: locked, status: "draft", revision: 1 },
    { id: fresh, status: "foreman_approved", revision: 2, foremanSignatureRef: "s" },
    { id: "TS-GHOST", status: "draft", revision: 1 },
  ]);
  assert.equal(r.json.data.summary.total, 3);
  assert.equal(r.json.data.summary.kept, 1);
  assert.equal(r.json.data.summary.applied, 1);
  assert.equal(r.json.data.summary.created, 1);
  assert.deepEqual(r.json.data.summary.blockedIds, [locked]);
});

test("ساعت جلوتر از سرور هشدار است نه رد", async () => {
  const r = await req("/api/hrm/sync/batch", {
    method: "POST",
    body: {
      projectId: PROJECT, deviceId: "dev-clock",
      items: [{ id: "TS-CLOCK", status: "draft", revision: 1, capturedAt: "2031-01-01T00:00:00Z" }],
    },
  });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.warnings.some((w) => w.code === "W-HRM-426"));
});

/* ═══════════ ۶. تابلوی دستگاه‌ها ═══════════ */

test("دستگاه با تعارض باز قرمز است", async () => {
  const r = await req(`/api/hrm/devices?projectId=${PROJECT}`, { user: "u-hr" });
  assert.equal(r.status, 200);
  const late = r.json.data.rows.find((x) => x.deviceId === "dev-late");
  assert.ok(late);
  assert.equal(late.flag, "red");
  assert.ok(late.openConflicts >= 1);
});

test("دستگاه بدون تعارض هم در تابلو دیده می‌شود", async () => {
  /* سکوت دستگاه ممکن است یعنی داده در جیب کسی مانده. */
  const r = await req(`/api/hrm/devices?projectId=${PROJECT}`, { user: "u-hr" });
  const quiet = r.json.data.rows.find((x) => x.deviceId === "dev-idem");
  assert.ok(quiet, "دستگاه بی‌تعارض غایب است");
  assert.equal(quiet.totalConflicts, 0);
  assert.ok(quiet.lastSeenAt, "زمان آخرین دسته باید ثبت شده باشد");
});

test("بدترین دستگاه اول فهرست می‌آید", async () => {
  const r = await req(`/api/hrm/devices?projectId=${PROJECT}`, { user: "u-hr" });
  const rank = { red: 0, amber: 1, green: 2 };
  const seq = r.json.data.rows.map((x) => rank[x.flag]);
  assert.deepEqual(seq, [...seq].sort((a, b) => a - b));
});

test("کهنگی صف با تاریخ آینده سنجیده می‌شود", async () => {
  const r = await req(`/api/hrm/devices?projectId=${PROJECT}&onDate=2030-01-01`, { user: "u-hr" });
  assert.ok(r.json.data.rows.every((x) => x.flag === "red"), "همه باید کهنه باشند");
  assert.ok(r.json.data.summary.red > 0);
});

/* ═══════════ ۷. بستن تعارض ═══════════ */

test("تعارض ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await req("/api/hrm/conflicts/NOPE/close", {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, resolution: "server_wins" },
  });
  assert.equal(r.status, 404);
});

test("تعارض برگهٔ امضاشده با «حل شد» ساده بسته نمی‌شود", async () => {
  /* وگرنه اختلاف پنهان می‌شود بی‌آنکه چیزی اصلاح شده باشد. */
  const list = await req(`/api/hrm/conflicts?projectId=${PROJECT}&status=open`, { user: "u-hr" });
  const target = list.json.data.items.find((x) => x.DeviceId === "dev-late");
  assert.ok(target);

  const cheat = await req(`/api/hrm/conflicts/${target.Id}/close`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, resolution: "server_wins" },
  });
  assert.equal(cheat.status, 422);
  assert.equal(cheat.json.error.code, "E-HRM-443");
  /* یافتهٔ آزمون زنده: پیام «دورهٔ بسته» می‌گفت در حالی که دوره قفل
   * نبود و دلیل واقعی امضای سرپرست بود. */
  assert.ok(cheat.json.error.detailsFa?.some((d) => d.includes("دلیل این تعارض")), JSON.stringify(cheat.json.error));
});

test("الزام سند اصلاحی از ستون صریح خوانده می‌شود نه از متن", async () => {
  /* اگر از `DiffSummaryFa` استنتاج می‌شد، یک ویرایش نگارشی می‌توانست
   * بی‌صدا گیت را خاموش کند. */
  const list = await req(`/api/hrm/conflicts?projectId=${PROJECT}&status=open`, { user: "u-hr" });
  const target = list.json.data.items.find((x) => x.DeviceId === "dev-late");
  assert.equal(target.RequiresAdjustment, true);
  assert.ok(target.BlockReasonFa, "دلیل مسدودی ثبت نشده");

  const free = list.json.data.items.find((x) => x.RequiresAdjustment === false);
  if (free) assert.equal(free.BlockReasonFa, null, "تعارض آزاد نباید دلیل مسدودی داشته باشد");
});

test("ادعای سند اصلاحی بدون سند واقعی رد می‌شود", async () => {
  const list = await req(`/api/hrm/conflicts?projectId=${PROJECT}&status=open`, { user: "u-hr" });
  const target = list.json.data.items.find((x) => x.DeviceId === "dev-late");
  const r = await req(`/api/hrm/conflicts/${target.Id}/close`, {
    user: "u-hr", method: "POST",
    body: { projectId: PROJECT, resolution: "adjustment_raised", adjustmentId: "ADJ-GHOST" },
  });
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "E-HRM-ADJ-NOT-FOUND");
});

test("سند اصلاحی تأییدنشده گیت را باز نمی‌کند", async () => {
  /* یافتهٔ لوپ ۶: هرکس `adjustment.raise` داشت می‌توانست یک پیش‌نویس
   * بسازد و با شمارهٔ آن تعارض را ببندد — همان راه فراری که گیت برای
   * بستنش ساخته شده بود. */
  const entries = JSON.parse(await readFile(join(dir, "HrmTimesheetEntry.json"), "utf8"));
  const entry = entries.find((e) => !e.VoidedAt);
  const draft = await req("/api/hrm/adjustments", {
    user: "u-hr", method: "POST",
    body: {
      projectId: PROJECT, originalEntryId: entry.Id, adjustmentType: "hours_correction",
      deltaHours: -1, reasonTextFa: "پیش‌نویس اصلاح برای آزمون دروازه",
    },
  });
  assert.equal(draft.status, 201, draft.text.slice(0, 200));

  const list = await req(`/api/hrm/conflicts?projectId=${PROJECT}&status=open`, { user: "u-hr" });
  const target = list.json.data.items.find((x) => x.DeviceId === "dev-late");
  assert.ok(target);
  const r = await req(`/api/hrm/conflicts/${target.Id}/close`, {
    user: "u-hr", method: "POST",
    body: { projectId: PROJECT, resolution: "adjustment_raised", adjustmentId: draft.json.data.id },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-446");
});

test("دستهٔ دارای تعارض رد ممیزی سمت سرور می‌گذارد", async () => {
  /* یافتهٔ لوپ ۹: سیاهه باید بگوید چه کسی چه چیزی را کنار زد. */
  const rows = await auditRows();
  const hit = rows.find((x) => x.Action === "HRM_SYNC_BATCH_CONFLICT" && x.Details?.deviceId === "dev-late");
  assert.ok(hit, "رد ممیزی دستهٔ متعارض ثبت نشد");
  assert.equal(hit.Severity, "warning");
  assert.ok(hit.Details.blockedIds.length > 0);
});

test("دستهٔ بی‌تعارض سیاهه را با نویز پر نمی‌کند", async () => {
  const before = (await auditRows()).length;
  await syncBatch("dev-clean", [{ id: "TS-CLEAN", status: "draft", revision: 1 }]);
  assert.equal((await auditRows()).length, before);
});

test("با سند اصلاحی تأییدشده، تعارض بسته می‌شود و ممیزی می‌گیرد", async () => {
  const entries = JSON.parse(await readFile(join(dir, "HrmTimesheetEntry.json"), "utf8"));
  const entry = entries.find((e) => !e.VoidedAt);
  assert.ok(entry, "ردیف کارکردی برای اصلاح نیست");

  const adj = await req("/api/hrm/adjustments", {
    user: "u-hr", method: "POST",
    body: {
      projectId: PROJECT, originalEntryId: entry.Id, adjustmentType: "hours_correction",
      deltaHours: -1, reasonTextFa: "اصلاح ساعت پس از بررسی نسخهٔ کاغذی کارگاه",
    },
  });
  assert.equal(adj.status, 201, adj.text.slice(0, 250));

  /* تأیید سند مجوز جداست — همان مرزی که پیش‌نویس را از سند واقعی
   * تفکیک می‌کند. */
  const ok = await req(`/api/hrm/adjustments/${adj.json.data.id}/approve`, {
    user: "u-pm", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(ok.status, 200, ok.text.slice(0, 250));

  const list = await req(`/api/hrm/conflicts?projectId=${PROJECT}&status=open`, { user: "u-hr" });
  const target = list.json.data.items.find((x) => x.DeviceId === "dev-late");
  const r = await req(`/api/hrm/conflicts/${target.Id}/close`, {
    user: "u-hr", method: "POST",
    body: { projectId: PROJECT, resolution: "adjustment_raised", adjustmentId: adj.json.data.id },
  });
  assert.equal(r.status, 200, r.text.slice(0, 250));
  assert.equal(r.json.data.resolution, "adjustment_raised");

  const hit = (await auditRows()).find((x) => x.Details?.traceId === r.json.meta.traceId);
  assert.ok(hit, "رد ممیزی ثبت نشد");
  assert.equal(hit.Action, "HRM_SYNC_CONFLICT_CLOSED");
  assert.equal(hit.SubjectId, "u-hr");
});

test("تعارض بسته دوباره بسته نمی‌شود", async () => {
  /* بستن دوباره یعنی پاک شدن نام تصمیم‌گیرندهٔ اول. */
  const all = await req(`/api/hrm/conflicts?projectId=${PROJECT}`, { user: "u-hr" });
  const closed = all.json.data.items.find((x) => x.Status === "resolved" && x.ResolvedBy);
  assert.ok(closed);
  const r = await req(`/api/hrm/conflicts/${closed.Id}/close`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, resolution: "server_wins" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-440");
});

test("تصمیم دستی بدون دلیل رد می‌شود", async () => {
  const id = await serverSheet("CR-MAN", "2026-04-08", "foreman_approved");
  await syncBatch("dev-man", [{ id, status: "draft", revision: 1 }]);
  const list = await req(`/api/hrm/conflicts?projectId=${PROJECT}&status=open`, { user: "u-hr" });
  const target = list.json.data.items.find((x) => x.DeviceId === "dev-man");
  assert.ok(target);

  const short = await req(`/api/hrm/conflicts/${target.Id}/close`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, resolution: "manual", noteFa: "ok" },
  });
  assert.equal(short.status, 422);
  assert.equal(short.json.error.code, "E-HRM-442");
});

/* ═══════════ ۸. زنجیرهٔ امضا ═══════════ */

test("برگهٔ بدون امضا زنجیرهٔ ناقص دارد", async () => {
  const id = await serverSheet("CR-NOSIG", "2026-04-05", "draft");
  const r = await req(`/api/hrm/timesheets/${id}/signature-chain?projectId=${PROJECT}`);
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.json.data.chain.ok, false);
  assert.deepEqual(r.json.data.chain.missingRolesFa, ["سرپرست اکیپ"]);
});

test("برگهٔ امضاشده زنجیرهٔ سالم دارد", async () => {
  const id = await serverSheet("CR-FULLSIG", "2026-04-06", "foreman_approved");
  const r = await req(`/api/hrm/timesheets/${id}/signature-chain?projectId=${PROJECT}`);
  assert.equal(r.json.data.chain.ok, true);
  assert.ok(r.json.data.chain.signedRoles.includes("foreman"));
});

test("نقش الزامی از پارامتر خوانده می‌شود", async () => {
  /* برگهٔ داخلی امضای کارفرما نمی‌خواهد؛ صورت‌وضعیت می‌خواهد. */
  const id = await serverSheet("CR-REQ", "2026-04-07", "foreman_approved");
  const soft = await req(`/api/hrm/timesheets/${id}/signature-chain?projectId=${PROJECT}`);
  assert.equal(soft.json.data.chain.ok, true);
  const hard = await req(`/api/hrm/timesheets/${id}/signature-chain?projectId=${PROJECT}&required=foreman&required=client`);
  assert.equal(hard.json.data.chain.ok, false);
  assert.deepEqual(hard.json.data.chain.missingRolesFa, ["نمایندهٔ کارفرما"]);
});

test("برگهٔ ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await req(`/api/hrm/timesheets/NOPE/signature-chain?projectId=${PROJECT}`);
  assert.equal(r.status, 404);
});

/* ═══════════ ۹. مرز پروژه ═══════════ */

test("برگهٔ پروژهٔ دیگر در همگام‌سازی دیده نمی‌شود", async () => {
  /* اگر دیده می‌شد، تعارض بین‌پروژه‌ای ساخته می‌شد. */
  const id = await serverSheet("CR-P2", "2026-04-09", "foreman_approved", OTHER);
  const r = await syncBatch("dev-cross", [{ id, status: "draft", revision: 1 }]);
  assert.equal(r.json.data.outcomes[0].action, "create_needed", "نباید تعارض بسازد");
});

test("تعارض پروژهٔ دیگر بسته نمی‌شود", async () => {
  const list = await req(`/api/hrm/conflicts?projectId=${PROJECT}`, { user: "u-hr" });
  const any = list.json.data.items[0];
  assert.ok(any);
  const r = await req(`/api/hrm/conflicts/${any.Id}/close`, {
    user: "u-hr", method: "POST", body: { projectId: OTHER, resolution: "server_wins" },
  });
  assert.equal(r.status, 404);
});

test("تابلوی دستگاه پروژهٔ دیگر خالی است", async () => {
  const r = await req(`/api/hrm/devices?projectId=${OTHER}`, { user: "u-hr" });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.rows.length, 0);
});

test("زنجیرهٔ امضای برگهٔ پروژهٔ دیگر ۴۰۴ می‌دهد", async () => {
  const id = await serverSheet("CR-P2SIG", "2026-04-10", "draft", OTHER);
  const r = await req(`/api/hrm/timesheets/${id}/signature-chain?projectId=${PROJECT}`);
  assert.equal(r.status, 404);
});

/* ═══════════ ۱۰. یکپارچگی با تحلیل (D8) ═══════════ */

test("تحلیل D8 از تعارض باز خبر می‌دهد", async () => {
  /* یافتهٔ لوپ ۱۰: داشبورد با اطمینان کامل عددی می‌داد در حالی که
   * بخشی از کارکرد هنوز تکلیفش روشن نبود. */
  const id = await serverSheet("CR-UNSYNC", "2026-04-20", "foreman_approved");
  await syncBatch("dev-unsync", [{ id, status: "draft", revision: 1 }]);

  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}`, { user: "u-pm" });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.openSyncConflicts > 0);
  assert.ok(r.json.data.alerts.some((a) => a.code === "EWS-HRA-UNSYNCED"));
});

test("پروژهٔ بدون تعارض این هشدار را نمی‌گیرد", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${OTHER}`, { user: "u-pm" });
  assert.equal(r.json.data.openSyncConflicts, 0);
  assert.ok(!r.json.data.alerts.some((a) => a.code === "EWS-HRA-UNSYNCED"));
});

/* ═══════════ ۱۱. قرارداد پاسخ ═══════════ */

test("همهٔ مسیرهای خواندنی قالب مشترک دارند", async () => {
  const paths = [
    ["/api/hrm/sync-meta", "u-site"],
    ["/api/hrm/devices", "u-hr"],
    ["/api/hrm/sync/batches", "u-hr"],
    ["/api/hrm/conflicts", "u-hr"],
  ];
  for (const [p, user] of paths) {
    const r = await req(`${p}?projectId=${PROJECT}`, { user });
    assert.equal(r.status, 200, `${p}: ${r.text.slice(0, 150)}`);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.meta.engine, "hrm-v1");
    assert.ok(r.json.meta.traceId);
  }
});

test("فهرست دسته‌ها پاسخ کامل را برنمی‌گرداند", async () => {
  /* پاسخ هر دسته چند کیلوبایت است؛ در فهرست فقط سرشماری لازم است. */
  const r = await req(`/api/hrm/sync/batches?projectId=${PROJECT}`, { user: "u-hr" });
  assert.ok(r.json.data.items.length > 0);
  assert.ok(r.json.data.items.every((x) => x.ResultJson === undefined));
  assert.ok(r.json.data.replayTotal >= 1);
});

test("فیلتر دستگاه روی فهرست دسته‌ها کار می‌کند", async () => {
  const r = await req(`/api/hrm/sync/batches?projectId=${PROJECT}&deviceId=dev-idem`, { user: "u-hr" });
  assert.ok(r.json.data.items.every((x) => x.DeviceId === "dev-idem"));
});
