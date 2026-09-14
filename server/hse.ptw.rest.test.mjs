import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";

const PORT = 4720;
const BASE = `http://127.0.0.1:${PORT}`;
let child;
let dataDir;

async function api(method, path, { body, user = "u-site", raw = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-user-id": user },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return raw ? { status: res.status, json } : json;
}

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "hse-ptw-"));
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

const P = "?projectId=ptw-p1";
let jsaId, permitId, coldPermitId, elecPermitId, qrToken, precautionIds = [];

/* ── تاریخ اعتبار همیشه نسبت به «حالا» ساخته می‌شود تا آزمون کهنه نشود ── */
const hoursFromNow = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

/* ══════════════ واژگان ══════════════ */

test("واژگان پروانه الزام‌های هر نوع را اعلام می‌کند", async () => {
  const r = await api("GET", "/api/hse/permit-vocab");
  assert.equal(r.ok, true, JSON.stringify(r));
  const hot = r.data.permitTypes.find((t) => t.code === "hot");
  assert.equal(hot.requiresGasTest, true);
  assert.equal(hot.isHighRisk, true);
  const lifting = r.data.permitTypes.find((t) => t.code === "lifting");
  assert.equal(lifting.requiresGasTest, false);
  assert.deepEqual(r.data.approvalLevels.map((l) => l.code), ["supervisor", "hse", "area_manager"]);
  assert.equal(r.data.gasLimits.oxygenMinPct, 19.5);
  assert.equal(r.data.gasTestValidityMinutes, 120);
});

/* ══════════════ آماده‌سازی: ارزیابی ریسک مصوب ══════════════ */

test("آماده‌سازی: ارزیابی ریسک مصوب برای پروانه", async () => {
  const j = await api("POST", `/api/hse/jsa${P}`, {
    body: { jsaNo: "JSA-PTW-1", titleFa: "جوشکاری روی مخزن", preparedBy: "u-site", preparedAt: "2026-09-01", validUntil: "2027-06-01" },
  });
  assert.equal(j.ok, true, JSON.stringify(j));
  jsaId = j.data.id;

  const s = await api("POST", `/api/hse/jsa/${jsaId}/step`, { body: { descriptionFa: "آماده‌سازی سطح" } });
  const h = await api("POST", `/api/hse/jsa/step/${s.data.id}/hazard`, {
    body: {
      hazardFa: "جرقهٔ جوش", hazardCategory: "fire", likelihood: 3, severity: 4,
      residualLikelihood: 1, residualSeverity: 3,
      controls: [{ controlLevel: "engineering", controlFa: "پرده جوش و پاک‌سازی محدوده" }],
    },
  });
  assert.equal(h.ok, true, JSON.stringify(h));

  const a = await api("POST", `/api/hse/jsa/${jsaId}/approve`, { user: "u-hse" });
  assert.equal(a.ok, true, JSON.stringify(a));
});

/* ══════════════ ثبت پروانه ══════════════ */

test("ثبت پروانهٔ کار گرم با اقدامات احتیاطی", async () => {
  const r = await api("POST", `/api/hse/permit${P}`, {
    body: {
      permitNo: "PTW-001",
      permitType: "hot",
      titleFa: "جوشکاری بدنهٔ مخزن T-101",
      requestedBy: "u-sub",
      validFrom: hoursFromNow(-1),
      validTo: hoursFromNow(8),
      jsaId,
      locationFa: "محوطهٔ مخازن",
      simopsApprovedBy: "u-pm",
      precautions: [
        { precautionFa: "خاموش‌کننده دستی در محل", isMandatory: true },
        { precautionFa: "نگهبان آتش تا ۳۰ دقیقه پس از پایان", isMandatory: true },
        { precautionFa: "اطلاع به اتاق کنترل", isMandatory: false },
      ],
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  permitId = r.data.id;
  qrToken = r.data.item.QrToken;
  assert.equal(r.data.item.typeFa, "کار گرم");
  assert.equal(r.data.item.statusFa, "پیش‌نویس");
  assert.equal(r.data.requiresGasTest, true);
  assert.equal(r.data.precautions.length, 3);
  assert.ok(qrToken, "توکن QR باید تولید شود");
  precautionIds = r.data.precautions.map((p) => p.Id);
});

test("توکن QR شناسهٔ داخلی را افشا نمی‌کند", async () => {
  assert.ok(!qrToken.includes(permitId), "توکن نباید شامل شناسهٔ رکورد باشد");
});

test("اقدامات احتیاطی در وضعیت «بررسی نشده» ثبت می‌شوند", async () => {
  const r = await api("GET", `/api/hse/permit/${permitId}`);
  assert.equal(r.data.precautionState.unchecked, 3, "هیچ اقدامی نباید از پیش تأییدشده باشد");
  assert.equal(r.data.precautionState.confirmed, 0);
});

test("شمارهٔ تکراری پروانه رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/permit${P}`, {
    body: { permitNo: "PTW-001", permitType: "cold", titleFa: "تکراری", validFrom: hoursFromNow(0), validTo: hoursFromNow(4) },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-DUP-PERMIT");
});

test("ارزیابی ریسک پروژهٔ دیگر پذیرفته نمی‌شود", async () => {
  const other = await api("POST", "/api/hse/jsa?projectId=ptw-other", {
    body: { jsaNo: "JSA-X", titleFa: "پروژهٔ دیگر", preparedBy: "u-site", preparedAt: "2026-09-01" },
  });
  const r = await api("POST", `/api/hse/permit${P}`, {
    body: { permitNo: "PTW-CROSS", permitType: "cold", titleFa: "نشت پروژه", validFrom: hoursFromNow(0), validTo: hoursFromNow(4), jsaId: other.data.id },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-JSA-CROSS-PROJECT");
});

/* ══════════════ دروازهٔ صدور — گام‌به‌گام ══════════════ */

test("پروانهٔ تازه هنوز قابل صدور نیست و همهٔ موانع را می‌گوید", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/issue`, { user: "u-hse", body: { dryRun: true } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.verdict.ok, false);
  const joined = r.data.verdict.blockersFa.join(" | ");
  assert.match(joined, /گازسنجی/, joined);
  assert.match(joined, /امضای/, joined);
  assert.ok(r.data.verdict.blockersFa.length >= 3, `فقط ${r.data.verdict.blockersFa.length} مانع`);
});

test("گازسنجی ناایمن ثبت می‌شود ولی IsSafe از ورودی خوانده نمی‌شود", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/gas-test`, {
    body: { lelPct: 18, oxygenPct: 20.9, h2sPpm: 0, coPpm: 2, IsSafe: true, deviceSerial: "GX-2000" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.IsSafe, false, "ادعای کاربر نباید پذیرفته شود");
  assert.match(r.data.evaluation.breachesFa.join(), /حد انفجار/);
  assert.match(r.data.item.BreachedFa, /حد انفجار/);
});

test("گازسنجی بدون هیچ قرائتی رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/gas-test`, { body: { deviceSerial: "GX" }, raw: true });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-GAS-NO-READING");
  assert.equal(r.json.error.detailsFa.length, 4);
});

test("گازسنجی ایمن مانع گاز را برمی‌دارد", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/gas-test`, {
    body: { lelPct: 0, oxygenPct: 20.8, h2sPpm: 0, coPpm: 1, deviceSerial: "GX-2000" },
  });
  assert.equal(r.data.item.IsSafe, true);

  const gate = await api("POST", `/api/hse/permit/${permitId}/issue`, { user: "u-hse", body: { dryRun: true } });
  assert.ok(!gate.data.verdict.blockersFa.join().includes("گازسنجی"), "مانع گاز باید برداشته شود");
});

test("آخرین گازسنجی ملاک است نه اولی", async () => {
  const r = await api("GET", `/api/hse/permit/${permitId}`);
  assert.equal(r.data.gasTests.length, 2);
  assert.equal(r.data.latestGasTest.IsSafe, true, "قرائت تازه‌تر باید ملاک باشد");
});

test("امضای بی‌ترتیب رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/sign`, { user: "u-hse", body: { level: "area_manager" }, raw: true });
  assert.equal(r.status, 409);
  assert.match(r.json.error.detailsFa.join(), /نوبت امضای سرپرست اجرا/);
});

test("زنجیرهٔ امضا به ترتیب تکمیل می‌شود", async () => {
  const s1 = await api("POST", `/api/hse/permit/${permitId}/sign`, { user: "u-site", body: { level: "supervisor" } });
  assert.equal(s1.ok, true, JSON.stringify(s1));
  assert.equal(s1.data.chain.nextLevel, "hse");

  const s2 = await api("POST", `/api/hse/permit/${permitId}/sign`, { user: "u-hse", body: { level: "hse" } });
  assert.equal(s2.data.chain.nextLevel, "area_manager");

  const s3 = await api("POST", `/api/hse/permit/${permitId}/sign`, { user: "u-pm", body: { level: "area_manager" } });
  assert.equal(s3.data.chain.isComplete, true);
  assert.equal(s3.data.chain.signed.length, 3);
});

test("امضای دوباره در یک سطح رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/sign`, { user: "u-hse", body: { level: "hse" }, raw: true });
  assert.equal(r.status, 409);
  assert.match(r.json.error.detailsFa.join(), /قبلاً نظر خود را ثبت/);
});

test("اقدام احتیاطی اجباری بررسی‌نشده هنوز مانع است", async () => {
  const g = await api("POST", `/api/hse/permit/${permitId}/issue`, { user: "u-hse", body: { dryRun: true } });
  assert.equal(g.data.verdict.ok, false);
  assert.match(g.data.verdict.blockersFa.join(), /بررسی نشده/);
});

test("تأیید اقدامات احتیاطی مانع را برمی‌دارد", async () => {
  for (const id of precautionIds) {
    const r = await api("POST", `/api/hse/precaution/${id}/confirm`, { user: "u-site", body: { isConfirmed: true } });
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  const st = await api("GET", `/api/hse/permit/${permitId}`);
  assert.equal(st.data.precautionState.isReady, true);
});

test("رد یک اقدام احتیاطی با false ثبت می‌شود و مانع می‌سازد", async () => {
  const r = await api("POST", `/api/hse/precaution/${precautionIds[0]}/confirm`, { user: "u-site", body: { isConfirmed: false } });
  assert.equal(r.data.item.IsConfirmed, false);
  assert.equal(r.data.state.unconfirmed, 1);
  assert.match(r.data.state.mandatoryPendingFa.join(), /برقرار نیست/);
  /* بازگرداندن برای ادامهٔ آزمون */
  await api("POST", `/api/hse/precaution/${precautionIds[0]}/confirm`, { user: "u-site", body: { isConfirmed: true } });
});

test("تدوین‌کننده مجوز صدور ندارد", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/issue`, { user: "u-site", raw: true });
  assert.equal(r.status, 403);
});

test("پروانهٔ کامل صادر می‌شود", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/issue`, { user: "u-hse" });
  assert.equal(r.ok, true, JSON.stringify(r.error ?? r));
  assert.equal(r.data.item.Status, "active");
  assert.equal(r.data.item.statusFa, "معتبر");
  assert.equal(r.data.verdict.checks.jsa, true);
  assert.equal(r.data.verdict.checks.gasTest, true);
  assert.equal(r.data.verdict.checks.approvals, true);
});

/* ══════════════ اعتبارسنجی میدانی ══════════════ */

test("اسکن توکن QR وضعیت پروانه را می‌دهد بدون افشای شناسه", async () => {
  const r = await api("GET", `/api/hse/permit/verify/${qrToken}`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.permitNo, "PTW-001");
  assert.equal(r.data.isValidNow, true);
  assert.equal(r.data.gasTestSafe, true);
  assert.equal(r.data.Id, undefined, "شناسهٔ داخلی نباید برگردد");
  assert.equal(r.data.JsaId, undefined);
});

test("توکن نامعتبر ۴۰۴ می‌دهد", async () => {
  const r = await api("GET", "/api/hse/permit/verify/ptw-جعلی", { raw: true });
  assert.equal(r.status, 404);
});

/* ══════════════ گازسنجی ناایمن روی پروانهٔ فعال ══════════════ */

test("قرائت ناایمن پروانهٔ فعال را خودکار معلق می‌کند", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/gas-test`, {
    body: { lelPct: 0, oxygenPct: 17.2, h2sPpm: 0, coPpm: 0, deviceSerial: "GX-2000" },
  });
  assert.equal(r.data.autoSuspended, true, "کمبود اکسیژن باید کار را متوقف کند");
  const st = await api("GET", `/api/hse/permit/${permitId}`);
  assert.equal(st.data.item.Status, "suspended");
  assert.match(st.data.item.SuspendReasonFa, /کمبود اکسیژن/);
});

test("ازسرگیری بدون گازسنجی تازهٔ ایمن رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/resume`, { user: "u-hse", raw: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-RESUME-GAS-REQUIRED");
  assert.match(r.json.error.detailsFa.join(), /خارج از محدودهٔ ایمن/);
});

test("پس از قرائت ایمن، پروانه از سر گرفته می‌شود", async () => {
  await api("POST", `/api/hse/permit/${permitId}/gas-test`, {
    body: { lelPct: 0, oxygenPct: 20.9, h2sPpm: 0, coPpm: 0, deviceSerial: "GX-2000" },
  });
  const r = await api("POST", `/api/hse/permit/${permitId}/resume`, { user: "u-hse" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.Status, "active");
  assert.equal(r.data.item.SuspendReasonFa, null, "دلیل تعلیق باید پاک شود");
});

test("تعلیق دستی بدون دلیل رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/suspend`, { user: "u-hse", body: {}, raw: true });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-SUSPEND-REASON-REQUIRED");
});

test("سرپرست کارگاه مجوز تعلیق ندارد", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/suspend`, { user: "u-site", body: { reasonFa: "باد شدید" }, raw: true });
  assert.equal(r.status, 403);
});

/* ══════════════ ایزولاسیون و بستن ══════════════ */

test("ایزولاسیون اعمال‌شده بدون شمارهٔ قفل رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/isolation`, {
    body: { isolationType: "electrical", pointTagFa: "کلید MCC-01", status: "applied" },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-ISO-LOCK-REQUIRED");
});

test("نوع ایزولاسیون نامعتبر رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/isolation`, {
    body: { isolationType: "کوانتومی", pointTagFa: "x", status: "planned" },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-ISO-TYPE");
});

test("ایزولاسیون معتبر ثبت می‌شود", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/isolation`, {
    body: { isolationType: "process", pointTagFa: "شیر V-200", lockNo: "L-77", tagNo: "T-77", status: "applied" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.typeFa, "فرآیندی");
  assert.equal(r.data.state.applied, 1);
  assert.equal(r.data.state.allRemoved, false);
});

test("پروانه با قفل روی تجهیز بسته نمی‌شود", async () => {
  const r = await api("POST", `/api/hse/permit/${permitId}/close`, { user: "u-hse", raw: true });
  assert.equal(r.status, 409);
  assert.match(r.json.error.detailsFa.join(), /قفل هنوز روی تجهیز/);
});

test("پس از برداشتن قفل، پروانه بسته می‌شود", async () => {
  const det = await api("GET", `/api/hse/permit/${permitId}`);
  const iso = det.data.isolations[0];
  const rem = await api("POST", `/api/hse/isolation/${iso.Id}/remove`, { user: "u-site" });
  assert.equal(rem.ok, true, JSON.stringify(rem));
  assert.equal(rem.data.state.allRemoved, true);

  const r = await api("POST", `/api/hse/permit/${permitId}/close`, { user: "u-hse" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.Status, "closed");
});

test("برداشتن دوبارهٔ قفل رد می‌شود", async () => {
  const det = await api("GET", `/api/hse/permit/${permitId}`);
  const iso = det.data.isolations[0];
  const r = await api("POST", `/api/hse/isolation/${iso.Id}/remove`, { user: "u-site", raw: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-ISO-ALREADY-REMOVED");
});

/* ══════════════ کار برقی: الزام ایزولاسیون ══════════════ */

test("کار برقی بدون ایزولاسیون صادر نمی‌شود", async () => {
  const p = await api("POST", `/api/hse/permit${P}`, {
    body: { permitNo: "PTW-ELEC", permitType: "electrical", titleFa: "تعویض کنتاکتور", requestedBy: "u-sub", validFrom: hoursFromNow(-1), validTo: hoursFromNow(6), jsaId },
  });
  elecPermitId = p.data.id;
  assert.equal(p.data.requiresIsolation, true);

  await api("POST", `/api/hse/permit/${elecPermitId}/sign`, { user: "u-site", body: { level: "supervisor" } });
  await api("POST", `/api/hse/permit/${elecPermitId}/sign`, { user: "u-hse", body: { level: "hse" } });
  await api("POST", `/api/hse/permit/${elecPermitId}/sign`, { user: "u-pm", body: { level: "area_manager" } });

  const g = await api("POST", `/api/hse/permit/${elecPermitId}/issue`, { user: "u-hse", body: { dryRun: true } });
  assert.equal(g.data.verdict.ok, false);
  assert.match(g.data.verdict.blockersFa.join(), /ایزولاسیون/);
});

test("کار برقی با ایزولاسیون اعمال‌شده صادر می‌شود", async () => {
  await api("POST", `/api/hse/permit/${elecPermitId}/isolation`, {
    body: { isolationType: "electrical", pointTagFa: "بریکر B-12", lockNo: "L-90", status: "applied" },
  });
  const r = await api("POST", `/api/hse/permit/${elecPermitId}/issue`, { user: "u-hse" });
  assert.equal(r.ok, true, JSON.stringify(r.error ?? r));
  assert.equal(r.data.item.Status, "active");
});

/* ══════════════ رد پروانه ══════════════ */

test("رد در یک سطح پروانه را رد می‌کند", async () => {
  const p = await api("POST", `/api/hse/permit${P}`, {
    body: { permitNo: "PTW-REJ", permitType: "cold", titleFa: "کار سرد آزمایشی", requestedBy: "u-sub", validFrom: hoursFromNow(-1), validTo: hoursFromNow(4), jsaId },
  });
  coldPermitId = p.data.id;
  await api("POST", `/api/hse/permit/${coldPermitId}/sign`, { user: "u-site", body: { level: "supervisor" } });
  const rej = await api("POST", `/api/hse/permit/${coldPermitId}/sign`, {
    user: "u-hse", body: { level: "hse", decision: "rejected", commentFa: "محدوده آماده نیست" },
  });
  assert.equal(rej.data.chain.rejectedBy, "hse");

  const det = await api("GET", `/api/hse/permit/${coldPermitId}`);
  assert.equal(det.data.item.Status, "rejected");

  const iss = await api("POST", `/api/hse/permit/${coldPermitId}/issue`, { user: "u-hse", raw: true });
  assert.equal(iss.status, 409);
});

/* ══════════════ فهرست و خلاصه ══════════════ */

test("فهرست پروانه‌ها خلاصهٔ کنترل‌روم می‌دهد", async () => {
  const r = await api("GET", `/api/hse/permit${P}`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.data.count >= 3);
  const s = r.data.summary;
  for (const k of ["draft", "active", "suspended", "closed", "expired", "rejected"]) {
    assert.equal(typeof s.byStatus[k], "number", `کلید ${k} غایب است`);
  }
  assert.ok(s.activeNow >= 1);
  assert.equal(typeof s.locksOnEquipment, "number");
});

test("پروانهٔ پرخطر فعال در خلاصه جدا شمرده می‌شود", async () => {
  const r = await api("GET", `/api/hse/permit${P}`);
  assert.equal(typeof r.data.summary.highRiskActive, "number");
  const elec = r.data.items.find((x) => x.Id === elecPermitId);
  assert.equal(elec.isHighRisk, false, "کار برقی در فهرست پرخطر نیست");
});

/* ══════════════ پل به ماژول راه‌اندازی ══════════════ */

test("دروازهٔ RFSU پروانهٔ باز روی سیستم را مانع می‌شمارد", async () => {
  const p = await api("POST", `/api/hse/permit${P}`, {
    body: {
      permitNo: "PTW-SYS", permitType: "cold", titleFa: "کار روی سیستم بخار",
      requestedBy: "u-sub", systemId: "SYS-300",
      validFrom: hoursFromNow(-1), validTo: hoursFromNow(6), jsaId,
    },
  });
  assert.equal(p.ok, true, JSON.stringify(p));

  /* پروانهٔ پیش‌نویس «باز» نیست — باید واقعاً صادر شود تا مانع بشمارد. */
  const sysPermitId = p.data.id;
  await api("POST", `/api/hse/permit/${sysPermitId}/sign`, { user: "u-site", body: { level: "supervisor" } });
  await api("POST", `/api/hse/permit/${sysPermitId}/sign`, { user: "u-hse", body: { level: "hse" } });
  await api("POST", `/api/hse/permit/${sysPermitId}/sign`, { user: "u-pm", body: { level: "area_manager" } });
  const iss = await api("POST", `/api/hse/permit/${sysPermitId}/issue`, { user: "u-hse" });
  assert.equal(iss.ok, true, JSON.stringify(iss.error ?? iss));

  const r = await api("GET", `/api/hse/rfsu-clearance/SYS-300${P}`, { user: "u-comm" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.clearance.ok, false, "پروانهٔ باز باید مانع آمادگی راه‌اندازی باشد");
  assert.ok(r.data.clearance.openPermits >= 1);
  assert.equal(r.data.blockingPermits[0].permitNo, "PTW-SYS", "باید بگوید کدام پروانه مانع است");
});

test("سیستم بدون پروانهٔ باز آمادگی می‌گیرد", async () => {
  const r = await api("GET", `/api/hse/rfsu-clearance/SYS-BARE${P}`, { user: "u-comm" });
  assert.equal(r.data.clearance.ok, true);
  assert.equal(r.data.blockingPermits.length, 0);
});

/* ══════════════ دسترسی ══════════════ */

test("بدون شناسهٔ کاربر ۴۰۱ برمی‌گردد", async () => {
  const res = await fetch(`${BASE}/api/hse/permit${P}`);
  assert.equal(res.status, 401);
});

test("مدیر راه‌اندازی پروانه را می‌بیند ولی ثبت نمی‌کند", async () => {
  const ok = await api("GET", `/api/hse/permit${P}`, { user: "u-comm", raw: true });
  assert.equal(ok.status, 200, "دروازهٔ RFSU به دیدن پروانه نیاز دارد");
  const no = await api("POST", `/api/hse/permit${P}`, {
    user: "u-comm",
    body: { permitNo: "X", permitType: "cold", titleFa: "x", validFrom: hoursFromNow(0), validTo: hoursFromNow(1) },
    raw: true,
  });
  assert.equal(no.status, 403);
});

test("کارفرما به سامانهٔ پروانه دسترسی ندارد", async () => {
  const r = await api("GET", `/api/hse/permit${P}`, { user: "u-client", raw: true });
  assert.equal(r.status, 403);
});
