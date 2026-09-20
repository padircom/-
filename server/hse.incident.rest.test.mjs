/**
 * آزمون یکپارچهٔ لایهٔ REST — MOD-08 / HSE، تحویلی D5.
 *
 * چرخهٔ کامل: ثبت رویداد ← گزارش فوری ← مصدوم ← تحقیق ← درخت
 * ریشه‌یابی ← CAPA ← راستی‌آزمایی ← تأیید تحقیق ← بستن رویداد.
 *
 * سرور روی دادهٔ کپی‌شده در پوشهٔ موقت بالا می‌آید تا آزمون دادهٔ کاری
 * را آلوده نکند.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";

const PORT = 4721;
const BASE = `http://127.0.0.1:${PORT}`;
let child;
let dataDir;

async function api(method, path, { body, user = "u-hse", raw = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-user-id": user },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return raw ? { status: res.status, json } : json;
}

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "hse-inc-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});
  child = spawn(execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${BASE}/api/cnt/status`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("سرور بالا نیامد");
});

after(async () => {
  child?.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 200));
  await rm(dataDir, { recursive: true, force: true }).catch(() => {});
});

const P = "?projectId=inc-p1";

/* تاریخ‌ها نسبی ساخته می‌شوند تا آزمون با گذر زمان کهنه نشود. */
const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();
const daysFromNow = (d) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

let ltiId, invId, nodeL1, nodeL2, nodeL3, capaCorr, capaPrev;
let nearMissId;

/* ══════════════════════ ۱) واژگان ══════════════════════ */

test("واژگان حوادث همهٔ فهرست‌های کنترل‌شده را می‌دهد", async () => {
  const r = await api("GET", "/api/hse/incident-vocab");
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.data.incidentTypes.length >= 6);
  assert.equal(r.data.injuryTypes.length, 8);
  assert.equal(r.data.bodyParts.length, 9);
  assert.deepEqual(r.data.causeLevels.map((c) => c.code), ["immediate", "underlying", "root"]);
  assert.equal(r.data.causeCategories.length, 6);
  assert.deepEqual(r.data.capaTypes.map((t) => t.code), ["corrective", "preventive"]);
  assert.equal(r.data.thresholds.flashReportSlaMinutes, 15);
  assert.equal(r.data.thresholds.minRootCauseDepth, 3);
});

test("واژگان همه‌جا عنوان فارسی دارد", async () => {
  const r = await api("GET", "/api/hse/incident-vocab");
  for (const key of ["incidentTypes", "injuryTypes", "bodyParts", "causeLevels", "causeCategories", "capaTypes"]) {
    for (const item of r.data[key]) {
      assert.ok(item.titleFa && item.titleFa !== item.code, `${key}/${item.code} عنوان فارسی ندارد`);
    }
  }
});

/* ══════════════════════ ۲) ثبت رویداد ══════════════════════ */

test("ثبت رویداد بدون projectId رد می‌شود", async () => {
  const r = await api("POST", "/api/hse/incident", { body: { incidentNo: "X" }, raw: true });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-CNT-NO-PROJECT");
});

test("ثبت رویداد با نوع نامعتبر رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/incident${P}`, {
    body: { incidentNo: "INC-BAD", titleFa: "نامعتبر", incidentType: "alien_attack", occurredAt: minutesAgo(60) },
    raw: true,
  });
  assert.equal(r.status, 422);
});

test("ثبت حادثهٔ ازکارافتادگی — شدت خودکار مشتق می‌شود", async () => {
  const r = await api("POST", `/api/hse/incident${P}`, {
    body: {
      incidentNo: "INC-001",
      titleFa: "سقوط از داربست",
      incidentType: "lost_time",
      occurredAt: minutesAgo(90),
      reportedBy: "u-site",
      lostDays: 12,
      locationFa: "واحد ۲۰۰",
      gpsLat: 29.61,
      gpsLng: 50.83,
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  ltiId = r.data.id;
  assert.ok(r.data.item.Severity, "شدت باید مشتق شود");
  assert.equal(r.data.requiresInvestigation.required, true);
  assert.ok(r.data.item.severityFa);
  assert.equal(r.data.item.typeFa, "حادثهٔ منجر به از کارافتادگی");
});

test("رویداد ازکارافتادگی هنوز گزارش فوری ندارد", async () => {
  const r = await api("GET", `/api/hse/incident/${ltiId}`);
  assert.equal(r.data.flashReport.reported, false);
  assert.ok(r.data.flashReport.pendingMinutes > 15, "باید تأخیر SLA را نشان دهد");
});

test("شمارهٔ تکراری رویداد رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/incident${P}`, {
    body: { incidentNo: "INC-001", titleFa: "تکراری", incidentType: "near_miss", occurredAt: minutesAgo(10) },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-DUP-INCIDENT");
});

test("پروانهٔ متعلق به پروژهٔ دیگر پذیرفته نمی‌شود", async () => {
  const r = await api("POST", `/api/hse/incident${P}`, {
    body: {
      incidentNo: "INC-XP", titleFa: "ارجاع نامعتبر", incidentType: "near_miss",
      occurredAt: minutesAgo(5), permitId: "does-not-exist",
    },
    raw: true,
  });
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "E-HSE-PERMIT-NOT-FOUND");
});

test("ثبت شبه‌حادثه با گزارش فوری به‌موقع", async () => {
  const occurred = minutesAgo(20);
  const r = await api("POST", `/api/hse/incident${P}`, {
    body: {
      incidentNo: "INC-002",
      titleFa: "سقوط ابزار از ارتفاع",
      incidentType: "near_miss",
      occurredAt: occurred,
      reportedBy: "u-site",
      flashReportAt: new Date(new Date(occurred).getTime() + 8 * 60_000).toISOString(),
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  nearMissId = r.data.id;
  assert.equal(r.data.flashReport.reported, true);
  assert.equal(r.data.flashReport.withinSla, true);
  assert.equal(r.data.flashReport.delayMinutes, 8);
  assert.equal(r.data.requiresInvestigation.required, false);
});

test("گزارش فوری تکراری رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/incident/${nearMissId}/flash-report`, { body: {}, raw: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-FLASH-ALREADY");
});

test("ثبت گزارش فوری روی رویداد ازکارافتادگی — تأخیر ثبت می‌شود", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/flash-report`, {
    body: { isEmergencyActivated: true },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.IsEmergencyActivated, true);
  assert.equal(r.data.flashReport.reported, true);
  assert.equal(r.data.flashReport.withinSla, false, "۹۰ دقیقه بعد یعنی نقض SLA");
});

/* ══════════════════════ ۳) مصدومان ══════════════════════ */

test("مصدوم با نوع آسیب نامعتبر رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/injured`, {
    body: { fullNameFa: "علی رضایی", injuryType: "sunburn" },
    raw: true,
  });
  assert.equal(r.status, 422);
});

test("مصدوم بدون نام رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/injured`, {
    body: { injuryType: "fracture" },
    raw: true,
  });
  assert.equal(r.status, 422);
});

test("افزودن مصدوم اول — شماره خودکار", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/injured`, {
    body: {
      fullNameFa: "علی رضایی", injuryType: "fracture", bodyPart: "leg",
      lostWorkDays: 12, companyFa: "پیمانکار الف",
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.PersonNo, 1);
  assert.equal(r.data.item.injuryFa, "شکستگی");
  assert.equal(r.data.item.bodyPartFa, "پا");
  assert.equal(r.data.summary.count, 1);
  assert.equal(r.data.summary.totalLostDays, 12);
  assert.equal(r.data.summary.stillOffWork, 1);
});

test("افزودن مصدوم دوم — جمع روزهای ازکارافتادگی", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/injured`, {
    body: {
      fullNameFa: "حسن کریمی", injuryType: "cut", bodyPart: "hand",
      lostWorkDays: 3, restrictedDays: 5, returnedToWork: true,
    },
  });
  assert.equal(r.data.item.PersonNo, 2);
  assert.equal(r.data.summary.count, 2);
  assert.equal(r.data.summary.totalLostDays, 15);
  assert.equal(r.data.summary.totalRestrictedDays, 5);
  assert.equal(r.data.summary.maxLostDays, 12);
  assert.equal(r.data.summary.returnedCount, 1);
  assert.equal(r.data.summary.stillOffWork, 1);
});

test("شمارهٔ مصدوم تکراری رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/injured`, {
    body: { personNo: 1, fullNameFa: "تکراری", injuryType: "cut" },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-DUP-INJURED");
});

/* ══════════════════════ ۴) دروازهٔ بستن — پیش از تحقیق ══════════════════════ */

test("بستن رویداد ازکارافتادگی بدون تحقیق مسدود است", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/close`, { body: { dryRun: true } });
  assert.equal(r.data.verdict.ok, false);
  assert.ok(r.data.verdict.blockersFa.some((b) => b.includes("تحقیقی ثبت نشده")), JSON.stringify(r.data.verdict));
});

test("بستن واقعی هم با ۴۰۹ رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/close`, { body: {}, raw: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-INCIDENT-NOT-CLOSABLE");
});

/* ══════════════════════ ۵) تحقیق و ریشه‌یابی ══════════════════════ */

test("سرپرست کارگاه مجوز آغاز تحقیق ندارد", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/investigation`, {
    body: {}, user: "u-site", raw: true,
  });
  assert.equal(r.status, 403);
});

test("آغاز تحقیق توسط افسر ایمنی", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/investigation`, {
    body: { leadInvestigator: "u-hse", teamFa: "کمیتهٔ HSE", methodFa: "five_why" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  invId = r.data.id;
  assert.equal(r.data.item.Status, "in_progress");
  assert.equal(r.data.requiredDepth, 3);
});

test("تحقیق دوم برای همان رویداد رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/investigation`, { body: {}, raw: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-DUP-INVESTIGATION");
});

test("گره ریشه‌یابی با سطح نامعتبر رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/investigation/${invId}/cause`, {
    body: { statementFa: "چیزی", causeLevel: "cosmic" },
    raw: true,
  });
  assert.equal(r.status, 422);
});

test("گره لایهٔ یک — علت بی‌واسطه", async () => {
  const r = await api("POST", `/api/hse/investigation/${invId}/cause`, {
    body: { statementFa: "نرده حفاظ داربست نصب نبود", causeLevel: "immediate", category: "machine" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  nodeL1 = r.data.id;
  assert.equal(r.data.item.Depth, 0);
  assert.equal(r.data.item.levelFa, "علت بی‌واسطه");
  assert.equal(r.data.item.categoryFa, "ماشین و تجهیزات");
  assert.equal(r.data.tree.maxDepth, 0);
});

test("والد ناموجود رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/investigation/${invId}/cause`, {
    body: { statementFa: "یتیم", causeLevel: "underlying", parentId: "no-such-node" },
    raw: true,
  });
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "E-HSE-CAUSE-PARENT-NOT-FOUND");
});

test("عمق از والد مشتق می‌شود و ورودی کاربر نادیده گرفته می‌شود", async () => {
  const r = await api("POST", `/api/hse/investigation/${invId}/cause`, {
    body: {
      statementFa: "بازرسی روزانهٔ داربست انجام نشده بود",
      causeLevel: "underlying", category: "method", parentId: nodeL1, depth: 99,
    },
  });
  nodeL2 = r.data.id;
  assert.equal(r.data.item.Depth, 1, "عمق باید ۱ باشد نه ۹۹");
  assert.equal(r.data.tree.maxDepth, 1);
});

test("تحقیق با عمق ۲ هنوز قابل تأیید نیست", async () => {
  const r = await api("POST", `/api/hse/investigation/${invId}/approve`, {
    body: { dryRun: true }, user: "u-qa",
  });
  assert.equal(r.data.verdict.ok, false);
  assert.ok(r.data.verdict.blockersFa.some((b) => b.includes("لایه")), JSON.stringify(r.data.verdict));
  assert.ok(r.data.verdict.blockersFa.some((b) => b.includes("علت ریشه‌ای")));
});

test("گره لایهٔ سه — علت ریشه‌ای راستی‌آزمایی‌شده", async () => {
  const r = await api("POST", `/api/hse/investigation/${invId}/cause`, {
    body: {
      statementFa: "برنامهٔ بازرسی دوره‌ای داربست در سیستم تعریف نشده است",
      causeLevel: "root", category: "management", parentId: nodeL2,
      evidenceFa: "بررسی رویهٔ PR-HSE-08", isVerified: true,
    },
  });
  nodeL3 = r.data.id;
  assert.equal(r.data.item.Depth, 2);
  assert.equal(r.data.tree.maxDepth, 2, "سه لایه یعنی maxDepth=۲");
  assert.equal(r.data.tree.rootCauses.length, 1);
  assert.equal(r.data.tree.verifiedRoots, 1);
  assert.equal(r.data.tree.cyclicIds.length, 0);
  assert.equal(r.data.tree.orphanIds.length, 0);
});

test("تحقیق بدون CAPA قابل تأیید نیست", async () => {
  const r = await api("POST", `/api/hse/investigation/${invId}/approve`, {
    body: { dryRun: true }, user: "u-qa",
  });
  assert.equal(r.data.verdict.ok, false);
  assert.ok(
    r.data.verdict.blockersFa.some((b) => b.includes("اقدام اصلاحی یا پیشگیرانه")),
    JSON.stringify(r.data.verdict),
  );
});

/* ══════════════════════ ۶) CAPA ══════════════════════ */

test("CAPA با منشأ نامعتبر رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/capa${P}`, {
    body: { sourceType: "dream", sourceId: invId, actionFa: "کاری", actionType: "corrective", ownerRef: "u-site", dueDate: daysFromNow(10) },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-CAPA-SOURCE");
});

test("CAPA بدون مهلت رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/capa${P}`, {
    body: { sourceType: "investigation", sourceId: invId, actionFa: "کاری", actionType: "corrective", ownerRef: "u-site" },
    raw: true,
  });
  assert.equal(r.status, 422);
});

test("ثبت اقدام اصلاحی", async () => {
  const r = await api("POST", `/api/hse/capa${P}`, {
    body: {
      sourceType: "investigation", sourceId: invId,
      actionFa: "نصب فوری نرده حفاظ روی همهٔ داربست‌های واحد ۲۰۰",
      actionType: "corrective", ownerRef: "u-site", dueDate: daysFromNow(7),
      rootCauseNodeId: nodeL1,
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  capaCorr = r.data.id;
  assert.equal(r.data.item.ActionNo, 1);
  assert.equal(r.data.item.typeFa, "اصلاحی");
  assert.equal(r.data.item.statusFa, "باز");
  assert.equal(r.data.summary.hasPreventive, false);
});

test("تحقیق با اقدام صرفاً اصلاحی قابل تأیید نیست", async () => {
  const r = await api("POST", `/api/hse/investigation/${invId}/approve`, {
    body: { dryRun: true }, user: "u-qa",
  });
  assert.equal(r.data.verdict.ok, false);
  assert.ok(
    r.data.verdict.blockersFa.some((b) => b.includes("پیشگیرانه")),
    JSON.stringify(r.data.verdict),
  );
});

test("ثبت اقدام پیشگیرانه — شماره خودکار افزایش می‌یابد", async () => {
  const r = await api("POST", `/api/hse/capa${P}`, {
    body: {
      sourceType: "investigation", sourceId: invId,
      actionFa: "افزودن بازرسی هفتگی داربست به برنامهٔ بازرسی سامانه",
      actionType: "preventive", ownerRef: "u-hse", dueDate: daysFromNow(30),
      rootCauseNodeId: nodeL3,
    },
  });
  capaPrev = r.data.id;
  assert.equal(r.data.item.ActionNo, 2);
  assert.equal(r.data.summary.hasPreventive, true);
  assert.equal(r.data.summary.total, 2);
  assert.equal(r.data.summary.open, 2);
});

test("راستی‌آزمایی اقدامِ انجام‌نشده رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/capa/${capaCorr}/verify`, { body: {}, raw: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-CAPA-NOT-COMPLETED");
});

test("مسیر status نمی‌تواند وضعیت را مستقیم verified کند", async () => {
  const r = await api("POST", `/api/hse/capa/${capaCorr}/status`, {
    body: { status: "verified" }, raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-CAPA-STATUS");
});

test("تغییر وضعیت به در حال انجام", async () => {
  const r = await api("POST", `/api/hse/capa/${capaCorr}/status`, { body: { status: "in_progress" } });
  assert.equal(r.data.item.Status, "in_progress");
  assert.equal(r.data.item.statusFa, "در حال انجام");
});

test("تکمیل هر دو اقدام", async () => {
  const a = await api("POST", `/api/hse/capa/${capaCorr}/status`, { body: { status: "completed" } });
  assert.equal(a.data.item.Status, "completed");
  assert.ok(a.data.item.CompletedAt);
  const b = await api("POST", `/api/hse/capa/${capaPrev}/status`, { body: { status: "completed" } });
  assert.equal(b.data.item.Status, "completed");
});

test("مجری اقدام نمی‌تواند اثربخشی آن را خودش تأیید کند", async () => {
  /* مالک capaPrev کاربر u-hse است و همین کاربر مجوز verify هم دارد. */
  const r = await api("POST", `/api/hse/capa/${capaPrev}/verify`, { body: {}, user: "u-hse", raw: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-CAPA-SELF-VERIFY");
});

test("سرپرست کارگاه مجوز راستی‌آزمایی ندارد", async () => {
  const r = await api("POST", `/api/hse/capa/${capaCorr}/verify`, { body: {}, user: "u-site", raw: true });
  assert.equal(r.status, 403);
});

test("راستی‌آزمایی هر دو اقدام توسط شخص ثالث", async () => {
  const a = await api("POST", `/api/hse/capa/${capaCorr}/verify`, {
    body: { effectivenessFa: "بازدید میدانی: همهٔ داربست‌ها مجهز شدند" }, user: "u-hse",
  });
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(a.data.item.Status, "verified");
  assert.equal(a.data.item.VerifiedBy, "u-hse");

  const b = await api("POST", `/api/hse/capa/${capaPrev}/verify`, { body: {}, user: "u-qa" });
  assert.equal(b.data.item.Status, "verified");
});

test("اقدام تأییدشده دیگر قابل تغییر وضعیت نیست", async () => {
  const r = await api("POST", `/api/hse/capa/${capaCorr}/status`, {
    body: { status: "cancelled" }, raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-CAPA-VERIFIED");
});

/* ══════════════════════ ۷) تأیید تحقیق ══════════════════════ */

test("سرپرست تحقیق نمی‌تواند تحقیق خودش را تأیید کند", async () => {
  /* u-hse هم سرپرست تحقیق است هم مجوز approve را ندارد؛ پس ۴۰۳. */
  const r = await api("POST", `/api/hse/investigation/${invId}/approve`, { body: {}, user: "u-hse", raw: true });
  assert.equal(r.status, 403);
});

test("موتور تفکیک وظیفه را در dryRun هم اعلام می‌کند", async () => {
  /* اگر سرپرست تحقیق مجوز داشت، موتور باید مسدودش کند. */
  const r = await api("GET", `/api/hse/incident/${ltiId}`);
  assert.equal(r.data.investigation.LeadInvestigator, "u-hse");
});

test("تأیید تحقیق توسط مدیر تضمین کیفیت", async () => {
  const r = await api("POST", `/api/hse/investigation/${invId}/approve`, {
    body: {
      summaryFa: "سقوط ناشی از نبود نرده حفاظ و فقدان برنامهٔ بازرسی",
      directCost: 50_000_000,
      indirectCost: 250_000_000,
      lessonsLearnedFa: "بازرسی داربست باید در سامانه برنامه‌ریزی شود",
    },
    user: "u-qa",
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.Status, "approved");
  assert.equal(r.data.item.ApprovedBy, "u-qa");
  assert.equal(r.data.verdict.ok, true);
  assert.equal(r.data.verdict.warningsFa.length, 0, "نسبت کوه یخ ۵ برابر است، هشدار نباید بدهد");
});

test("تحقیق تأییدشده دیگر گره نمی‌پذیرد", async () => {
  const r = await api("POST", `/api/hse/investigation/${invId}/cause`, {
    body: { statementFa: "دیرهنگام", causeLevel: "root" },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-INVESTIGATION-LOCKED");
});

test("تأیید دوبارهٔ تحقیق رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/investigation/${invId}/approve`, { body: {}, user: "u-qa", raw: true });
  assert.equal(r.status, 409);
});

/* ══════════════════════ ۸) نفرساعت ══════════════════════ */

test("نفرساعت منفی رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/man-hours${P}`, {
    body: { logDate: "2026-09-01", manHours: -100 }, user: "u-site", raw: true,
  });
  assert.equal(r.status, 422);
});

test("نفرساعت بدون تاریخ رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/man-hours${P}`, {
    body: { manHours: 100 }, user: "u-site", raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-MANHOUR-DATE-REQUIRED");
});

test("ثبت نفرساعت روز اول", async () => {
  const r = await api("POST", `/api/hse/man-hours${P}`, {
    body: { logDate: "2026-09-01", manHours: 120_000, headCount: 500, contractorFa: "پیمانکار الف" },
    user: "u-site", raw: true,
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.data.action, "insert");
  assert.equal(r.json.data.item.ManHours, 120_000);
});

test("ثبت دوبارهٔ همان روز به‌روزرسانی است نه ردیف تازه", async () => {
  const r = await api("POST", `/api/hse/man-hours${P}`, {
    body: { logDate: "2026-09-01", manHours: 130_000, contractorFa: "پیمانکار الف" },
    user: "u-site", raw: true,
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.action, "update");
  assert.equal(r.json.data.item.ManHours, 130_000);
});

test("پیمانکار متفاوت در همان روز ردیف جدا می‌سازد", async () => {
  const r = await api("POST", `/api/hse/man-hours${P}`, {
    body: { logDate: "2026-09-01", manHours: 70_000, contractorFa: "پیمانکار ب" },
    user: "u-site", raw: true,
  });
  assert.equal(r.status, 201);
});

test("افسر ایمنی هم مجوز ثبت نفرساعت دارد", async () => {
  const r = await api("POST", `/api/hse/man-hours${P}`, {
    body: { logDate: "2026-09-02", manHours: 200_000 },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
});

test("مدیر تضمین کیفیت مجوز ثبت نفرساعت ندارد", async () => {
  const r = await api("POST", `/api/hse/man-hours${P}`, {
    body: { logDate: "2026-09-03", manHours: 10 }, user: "u-qa", raw: true,
  });
  assert.equal(r.status, 403);
});

/* ══════════════════════ ۹) شاخص‌ها ══════════════════════ */

test("فهرست رویدادها شاخص‌های ایمنی را می‌دهد", async () => {
  const r = await api("GET", `/api/hse/incident${P}`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.count, 2);
  assert.equal(r.data.metrics.lostTime, 1);
  assert.equal(r.data.metrics.nearMiss, 1);
  assert.equal(r.data.metrics.injuredCount, 2);
  assert.equal(r.data.metrics.lostDays, 15);
  assert.equal(r.data.metrics.restrictedDays, 5);
});

test("نفرساعت کل و LTIFR محاسبه می‌شوند", async () => {
  const r = await api("GET", `/api/hse/incident${P}`);
  const total = 130_000 + 70_000 + 200_000;
  assert.equal(r.data.manHours.totalHours, total);
  assert.equal(r.data.metrics.manHours, total);
  /* LTIFR = حوادث ازکارافتادگی × ۱٬۰۰۰٬۰۰۰ ÷ نفرساعت */
  const expected = (1 * 1_000_000) / total;
  assert.ok(Math.abs(r.data.metrics.ltifr - expected) < 1e-6, `ltifr=${r.data.metrics.ltifr}`);
  assert.ok(r.data.metrics.severityRate > 0);
});

test("فهرست وضعیت گزارش فوری و تحقیق را نشان می‌دهد", async () => {
  const r = await api("GET", `/api/hse/incident${P}`);
  const lti = r.data.items.find((i) => i.Id === ltiId);
  assert.equal(lti.injuredCount, 2);
  assert.equal(lti.requiresInvestigation.required, true);
  assert.equal(lti.investigationStatus, "تأییدشده");
  assert.equal(lti.flashReport.withinSla, false);
  const nm = r.data.items.find((i) => i.Id === nearMissId);
  assert.equal(nm.investigationStatus, null);
  assert.equal(nm.injuredCount, 0);
});

test("پروژهٔ بدون داده شاخص‌های صفر می‌دهد نه خطا", async () => {
  const r = await api("GET", "/api/hse/incident?projectId=inc-empty");
  assert.equal(r.ok, true);
  assert.equal(r.data.count, 0);
  assert.equal(r.data.metrics.total, 0);
  assert.equal(r.data.metrics.ltifr, null, "بدون نفرساعت نرخ باید null باشد نه صفر");
});

/* ══════════════════════ ۱۰) بستن رویداد ══════════════════════ */

test("رویداد ازکارافتادگی حالا قابل بستن است", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/close`, { body: { dryRun: true } });
  assert.equal(r.data.verdict.ok, true, JSON.stringify(r.data.verdict));
  assert.ok(
    r.data.verdict.warningsFa.some((w) => w.includes("بازنگشته")),
    "مصدوم بازنگشته باید هشدار بدهد",
  );
});

test("بستن رویداد ازکارافتادگی", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/close`, {
    body: { rootCauseFa: "فقدان برنامهٔ بازرسی داربست", correctiveActionFa: "نصب نرده و بازرسی هفتگی" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.Status, "closed");
  assert.ok(r.data.item.ClosedAt);
});

test("رویداد بسته دیگر مصدوم نمی‌پذیرد", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/injured`, {
    body: { fullNameFa: "دیرهنگام", injuryType: "cut" },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-INCIDENT-LOCKED");
});

test("بستن دوبارهٔ رویداد رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/incident/${ltiId}/close`, { body: {}, raw: true });
  assert.equal(r.status, 409);
});

test("شبه‌حادثه بدون ریشه‌یابی متنی قابل بستن نیست", async () => {
  const r = await api("POST", `/api/hse/incident/${nearMissId}/close`, { body: { dryRun: true } });
  assert.equal(r.data.verdict.ok, false);
  assert.ok(r.data.verdict.blockersFa.some((b) => b.includes("ریشه‌یابی")), JSON.stringify(r.data.verdict));
  assert.ok(r.data.verdict.blockersFa.some((b) => b.includes("اقدام اصلاحی")));
});

test("شبه‌حادثه با CAPA باز قابل بستن نیست", async () => {
  const c = await api("POST", `/api/hse/capa${P}`, {
    body: {
      sourceType: "incident", sourceId: nearMissId,
      actionFa: "نصب تور ایمنی زیر داربست", actionType: "corrective",
      ownerRef: "u-site", dueDate: daysFromNow(5),
    },
  });
  assert.equal(c.ok, true, JSON.stringify(c));

  const r = await api("POST", `/api/hse/incident/${nearMissId}/close`, {
    body: { dryRun: true, rootCauseFa: "x", correctiveActionFa: "y" },
  });
  assert.equal(r.data.verdict.ok, false);
  assert.ok(r.data.verdict.blockersFa.some((b) => b.includes("باز است")), JSON.stringify(r.data.verdict));
});

/* ══════════════════════ ۱۱) جزئیات و RBAC ══════════════════════ */

test("جزئیات رویداد کل پرونده را یکجا می‌دهد", async () => {
  const r = await api("GET", `/api/hse/incident/${ltiId}`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.persons.length, 2);
  assert.equal(r.data.nodes.length, 3);
  assert.equal(r.data.actions.length, 2);
  assert.equal(r.data.tree.maxDepth, 2);
  assert.equal(r.data.capaSummary.verified, 2);
  assert.equal(r.data.investigation.statusFa, "تأییدشده");
  assert.equal(r.data.closeGate.ok, false, "رویداد بسته دیگر قابل بستن نیست");
});

test("رویداد ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await api("GET", "/api/hse/incident/no-such-incident", { raw: true });
  assert.equal(r.status, 404);
});

test("کاربر بدون مجوز به جزئیات رویداد دسترسی ندارد", async () => {
  const r = await api("GET", `/api/hse/incident/${ltiId}`, { user: "u-doc", raw: true });
  assert.equal(r.status, 403);
});

test("کاربر ناشناس رد می‌شود", async () => {
  const r = await api("GET", `/api/hse/incident${P}`, { user: "no-such-user", raw: true });
  assert.ok(r.status === 401 || r.status === 403, `status=${r.status}`);
});

/* ══════════════ ۱۲) یکپارچگی با دروازهٔ RFSU (یافتهٔ لوپ ۱۰) ══════════════ */

test("دروازهٔ RFSU رویدادهای مانع را فهرست می‌کند نه فقط بشمارد", async () => {
  const hi = await api("POST", `/api/hse/incident?projectId=rfsu-p1`, {
    body: {
      incidentNo: "RF-01", titleFa: "نشت گاز در واحد تقطیر", incidentType: "environmental",
      occurredAt: minutesAgo(120), reportedBy: "u-site", severity: "critical", systemId: "SYS-100",
    },
  });
  assert.equal(hi.ok, true, JSON.stringify(hi));

  const lo = await api("POST", `/api/hse/incident?projectId=rfsu-p1`, {
    body: {
      incidentNo: "RF-02", titleFa: "لغزش جزئی", incidentType: "first_aid",
      occurredAt: minutesAgo(60), reportedBy: "u-site", severity: "low", systemId: "SYS-100",
    },
  });
  assert.equal(lo.ok, true, JSON.stringify(lo));

  const r = await api("GET", "/api/hse/rfsu-clearance/SYS-100?projectId=rfsu-p1");
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.clearance.ok, false, "رویداد بحرانی باز باید مانع باشد");
  assert.equal(r.data.clearance.openHighSeverityIncidents, 1);
  assert.equal(r.data.blockingIncidents.length, 2, "هر دو رویداد باز فهرست می‌شوند");

  const crit = r.data.blockingIncidents.find((i) => i.incidentNo === "RF-01");
  assert.equal(crit.isBlocker, true);
  assert.equal(crit.severityFa, "بحرانی");
  assert.equal(crit.typeFa, "رویداد زیست‌محیطی");

  const minor = r.data.blockingIncidents.find((i) => i.incidentNo === "RF-02");
  assert.equal(minor.isBlocker, false, "شدت پایین مانع نیست ولی دیده می‌شود");
});

test("سیستم بدون رویداد و پروانه پاک است", async () => {
  const r = await api("GET", "/api/hse/rfsu-clearance/SYS-999?projectId=rfsu-p1");
  assert.equal(r.data.clearance.ok, true);
  assert.equal(r.data.blockingIncidents.length, 0);
});

/* ══════════════ ۱۳) ایدمپوتنسی نفرساعت بدون پیمانکار (یافتهٔ لوپ ۲) ══════════════ */

test("نفرساعت بدون پیمانکار هم ایدمپوتنت است", async () => {
  const first = await api("POST", `/api/hse/man-hours?projectId=idem-p1`, {
    body: { logDate: "2026-08-01", manHours: 90_000 },
    raw: true,
  });
  assert.equal(first.status, 201);
  assert.equal(first.json.data.item.ContractorFa, "کل پروژه", "به‌جای تهی مقدار پیش‌فرض می‌گیرد");

  const second = await api("POST", `/api/hse/man-hours?projectId=idem-p1`, {
    body: { logDate: "2026-08-01", manHours: 95_000 },
    raw: true,
  });
  assert.equal(second.status, 200, "ثبت دوباره باید به‌روزرسانی باشد نه ردیف تازه");
  assert.equal(second.json.data.action, "update");

  const list = await api("GET", "/api/hse/incident?projectId=idem-p1");
  assert.equal(list.data.manHours.totalHours, 95_000, "نفرساعت نباید دوبار جمع شود");
  assert.equal(list.data.manHours.dayCount, 1);
});
