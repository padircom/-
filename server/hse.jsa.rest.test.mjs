import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";

const PORT = 4719;
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
  dataDir = await mkdtemp(join(tmpdir(), "hse-jsa-"));
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

const P = "?projectId=hse-p1";
let jsaId, stepId, hazardId, weakJsaId;

/* ══════════════ واژگان ══════════════ */

test("واژگان ایمنی سلسله‌مراتب کنترل را به ترتیب اثربخشی می‌دهد", async () => {
  const r = await api("GET", "/api/hse/vocab");
  assert.equal(r.ok, true, JSON.stringify(r));
  const codes = r.data.controlLevels.map((c) => c.code);
  assert.deepEqual(codes, ["elimination", "substitution", "engineering", "administrative", "ppe"]);
  assert.equal(r.data.controlLevels[0].rank, 1, "حذف خطر باید مؤثرترین باشد");
  assert.equal(r.data.controlLevels.at(-1).code, "ppe", "تجهیزات حفاظت فردی آخرین لایه است");
  assert.equal(r.data.thresholds.maxApprovableResidual, 12);
  assert.equal(r.data.riskBands.length, 4);
});

/* ══════════════ ساخت ارزیابی ══════════════ */

test("ساخت ارزیابی ریسک شغلی در وضعیت پیش‌نویس", async () => {
  const r = await api("POST", `/api/hse/jsa${P}`, {
    body: {
      jsaNo: "JSA-001",
      titleFa: "جوشکاری روی خط لوله در ارتفاع",
      preparedBy: "u-site",
      preparedAt: "2026-09-01",
      validUntil: "2026-12-01",
      disciplineCode: "PI",
      locationFa: "واحد ۳۰۰ — رک لوله",
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  jsaId = r.data.id;
  assert.equal(r.data.item.Status, "draft");
  assert.equal(r.data.item.statusFa, "پیش‌نویس");
  assert.equal(r.data.item.ProjectId, "hse-p1");
});

test("شمارهٔ تکراری ارزیابی رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/jsa${P}`, {
    body: { jsaNo: "JSA-001", titleFa: "تکراری", preparedBy: "u-site", preparedAt: "2026-09-01" },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-DUP-JSA");
});

test("ارزیابی بدون عنوان رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/jsa${P}`, {
    body: { jsaNo: "JSA-BAD", titleFa: "   ", preparedBy: "u-site", preparedAt: "2026-09-01" },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-JSA-TITLE-REQUIRED");
});

test("ارزیابی بدون projectId رد می‌شود", async () => {
  const r = await api("POST", "/api/hse/jsa", { body: { jsaNo: "X" }, raw: true });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-CNT-NO-PROJECT");
});

/* ══════════════ گام کاری ══════════════ */

test("افزودن گام کاری با شماره‌گذاری خودکار", async () => {
  const r = await api("POST", `/api/hse/jsa/${jsaId}/step`, {
    body: { descriptionFa: "برپایی داربست و بستن حفاظ", responsibleFa: "سرپرست داربست" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  stepId = r.data.id;
  assert.equal(r.data.item.StepNo, 1, "اولین گام باید شمارهٔ ۱ بگیرد");
  assert.equal(r.data.item.JsaId, jsaId);
});

test("گام دوم شمارهٔ بعدی را می‌گیرد", async () => {
  const r = await api("POST", `/api/hse/jsa/${jsaId}/step`, {
    body: { descriptionFa: "برش و جوشکاری سرجوش" },
  });
  assert.equal(r.data.item.StepNo, 2);
});

test("شمارهٔ گام تکراری رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/jsa/${jsaId}/step`, {
    body: { descriptionFa: "تکراری", stepNo: 1 },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-DUP-STEP");
});

test("گام بدون شرح رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/jsa/${jsaId}/step`, { body: { descriptionFa: "" }, raw: true });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-STEP-DESC-REQUIRED");
});

test("گام روی ارزیابی ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await api("POST", "/api/hse/jsa/jsa-nope/step", { body: { descriptionFa: "x" }, raw: true });
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "E-HSE-JSA-NOT-FOUND");
});

/* ══════════════ خطر و کنترل ══════════════ */

test("افزودن خطر با کنترل‌ها؛ نمرهٔ ریسک مشتق می‌شود", async () => {
  const r = await api("POST", `/api/hse/jsa/step/${stepId}/hazard`, {
    body: {
      hazardFa: "سقوط از ارتفاع هنگام برپایی",
      hazardCategory: "fall",
      likelihood: 4,
      severity: 5,
      residualLikelihood: 2,
      residualSeverity: 3,
      controls: [
        { controlLevel: "engineering", controlFa: "نصب نرده و پاخور روی تمام طبقات داربست" },
        { controlLevel: "ppe", controlFa: "هارنس دوقلاب با اتصال دائم" },
      ],
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  hazardId = r.data.id;
  assert.equal(r.data.item.InitialRisk, 20, "۴×۵ باید ۲۰ شود");
  assert.equal(r.data.item.ResidualRisk, 6, "۲×۳ باید ۶ شود");
  assert.equal(r.data.item.bandFa, "بحرانی");
  assert.equal(r.data.item.categoryFa, "سقوط از ارتفاع");
  assert.equal(r.data.controls.length, 2);
  assert.equal(r.data.controls[0].levelFa, "کنترل مهندسی");
});

test("نمرهٔ ریسک ارسالی کاربر نادیده گرفته می‌شود", async () => {
  const r = await api("POST", `/api/hse/jsa/step/${stepId}/hazard`, {
    body: {
      hazardFa: "برخورد جرقهٔ جوش با مواد قابل اشتعال",
      hazardCategory: "fire",
      likelihood: 3,
      severity: 4,
      InitialRisk: 1,
      residualLikelihood: 1,
      residualSeverity: 3,
      controls: [{ controlLevel: "administrative", controlFa: "پاک‌سازی شعاع ۱۰ متری و نگهبان آتش" }],
    },
  });
  assert.equal(r.data.item.InitialRisk, 12, "نمره باید از احتمال×شدت محاسبه شود نه از ورودی");
});

test("احتمال خارج از بازهٔ ۱ تا ۵ رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/jsa/step/${stepId}/hazard`, {
    body: { hazardFa: "خطر آزمایشی", likelihood: 9, severity: 3 },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-RISK-RANGE");
});

test("دستهٔ خطر نامعتبر رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/jsa/step/${stepId}/hazard`, {
    body: { hazardFa: "خطر", hazardCategory: "ufo", likelihood: 2, severity: 2 },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-HAZARD-CATEGORY");
});

test("سطح کنترل نامعتبر کل درخواست خطر را رد می‌کند", async () => {
  const r = await api("POST", `/api/hse/jsa/step/${stepId}/hazard`, {
    body: {
      hazardFa: "خطر با کنترل بد",
      likelihood: 2,
      severity: 2,
      controls: [{ controlLevel: "magic", controlFa: "دعا" }],
    },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-CONTROL-LEVEL");
});

test("افزودن کنترل به خطر موجود ریسک باقیمانده را به‌روز می‌کند", async () => {
  const r = await api("POST", `/api/hse/jsa/hazard/${hazardId}/control`, {
    body: {
      controlLevel: "substitution",
      controlFa: "استفاده از سکوی بالابر به‌جای داربست دستی",
      residualLikelihood: 1,
      residualSeverity: 3,
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.ControlNo, 3);
  assert.equal(r.data.item.levelFa, "جایگزینی");
  assert.equal(r.data.evaluation.residualRisk, 3, "ریسک باقیمانده باید ۱×۳ شود");
});

test("خطر ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await api("POST", "/api/hse/jsa/hazard/hz-nope/control", {
    body: { controlLevel: "ppe", controlFa: "x" },
    raw: true,
  });
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "E-HSE-HAZARD-NOT-FOUND");
});

/* ══════════════ نمای کامل ══════════════ */

test("جزئیات ارزیابی درخت گام ← خطر ← کنترل را می‌دهد", async () => {
  const r = await api("GET", `/api/hse/jsa/${jsaId}`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.steps.length, 2);
  const s1 = r.data.steps.find((s) => s.StepNo === 1);
  assert.equal(s1.hazards.length, 2);
  const fall = s1.hazards.find((h) => h.HazardCategory === "fall");
  assert.equal(fall.controls.length, 3);
  assert.ok(fall.evaluation, "هر خطر باید ارزیابی داشته باشد");
  assert.equal(r.data.summary.hazards, 2);
});

test("خلاصه توزیع سطوح کنترل را با کلیدهای صفر می‌دهد", async () => {
  const r = await api("GET", `/api/hse/jsa/${jsaId}`);
  const lv = r.data.summary.byControlLevel;
  for (const k of ["elimination", "substitution", "engineering", "administrative", "ppe"]) {
    assert.equal(typeof lv[k], "number", `کلید ${k} باید همیشه باشد`);
  }
  assert.equal(lv.elimination, 0, "سطح بدون کنترل باید صفر باشد نه غایب");
  assert.equal(lv.engineering, 1);
});

test("فهرست ارزیابی‌ها خلاصه و وضعیت مؤثر دارد", async () => {
  const r = await api("GET", `/api/hse/jsa${P}`);
  assert.equal(r.ok, true);
  assert.ok(r.data.count >= 1);
  const it = r.data.items.find((x) => x.Id === jsaId);
  assert.equal(it.effectiveStatus, "draft");
  assert.ok(it.summary.hazards >= 2);
});

/* ══════════════ دروازهٔ تصویب ══════════════ */

test("تدوین‌کننده مجوز تصویب ندارد", async () => {
  const r = await api("POST", `/api/hse/jsa/${jsaId}/approve`, { user: "u-site", raw: true });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hse.jsa.approve");
});

test("پیش‌بینی تصویب بدون تغییر وضعیت کار می‌کند", async () => {
  const r = await api("POST", `/api/hse/jsa/${jsaId}/approve`, { user: "u-hse", body: { dryRun: true } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.dryRun, true);
  const after = await api("GET", `/api/hse/jsa/${jsaId}`);
  assert.equal(after.data.item.Status, "draft", "پیش‌بینی نباید وضعیت را عوض کند");
});

test("گام بدون خطر هشدار است نه مانع تصویب", async () => {
  /* نبودِ خطر روی یک گام ممکن است واقعی باشد (گام صرفاً اداری)، پس موتور
   * آن را هشدار می‌داند نه مانع؛ اینجا همان رفتار تأیید می‌شود. */
  const r = await api("POST", `/api/hse/jsa/${jsaId}/approve`, { user: "u-hse", body: { dryRun: true } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.verdict.ok, true, "گام بدون خطر نباید تصویب را ببندد");
  const joined = r.data.verdict.warningsFa.join(" | ");
  assert.match(joined, /بدون شناسایی خطر/, joined);
});

test("پس از پوشش همهٔ گام‌ها، افسر ایمنی تصویب می‌کند", async () => {
  const det = await api("GET", `/api/hse/jsa/${jsaId}`);
  const s2 = det.data.steps.find((s) => s.StepNo === 2);
  const h = await api("POST", `/api/hse/jsa/step/${s2.Id}/hazard`, {
    body: {
      hazardFa: "برق‌گرفتگی از دستگاه جوش",
      hazardCategory: "electrical",
      likelihood: 3,
      severity: 4,
      residualLikelihood: 1,
      residualSeverity: 2,
      controls: [{ controlLevel: "engineering", controlFa: "کلید محافظ جان و ارت بدنه" }],
    },
  });
  assert.equal(h.ok, true, JSON.stringify(h));

  const r = await api("POST", `/api/hse/jsa/${jsaId}/approve`, { user: "u-hse" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.Status, "approved");
  assert.equal(r.data.item.statusFa, "مصوب");
  assert.equal(r.data.item.ApprovedBy, "u-hse");
  assert.ok(r.data.item.MaxResidualRisk <= 12, "ریسک باقیماندهٔ بیشینه باید ثبت شود");
});

test("ارزیابی مصوب قفل می‌شود و ویرایش نمی‌پذیرد", async () => {
  const r = await api("POST", `/api/hse/jsa/${jsaId}/step`, { body: { descriptionFa: "گام بعد از تصویب" }, raw: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-JSA-LOCKED");
});

test("خطر جدید روی ارزیابی مصوب هم رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/jsa/step/${stepId}/hazard`, {
    body: { hazardFa: "خطر دیرهنگام", likelihood: 2, severity: 2 },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-JSA-LOCKED");
});

/* ══════════════ دروازهٔ اتکا به PPE ══════════════ */

test("ارزیابی پرریسک با تکیهٔ صرف بر PPE تصویب نمی‌شود", async () => {
  const j = await api("POST", `/api/hse/jsa${P}`, {
    body: { jsaNo: "JSA-PPE", titleFa: "کار در فضای بسته", preparedBy: "u-site", preparedAt: "2026-09-01" },
  });
  weakJsaId = j.data.id;
  const s = await api("POST", `/api/hse/jsa/${weakJsaId}/step`, { body: { descriptionFa: "ورود به مخزن" } });
  const hz = await api("POST", `/api/hse/jsa/step/${s.data.id}/hazard`, {
    body: {
      hazardFa: "کمبود اکسیژن داخل مخزن",
      hazardCategory: "chemical",
      likelihood: 4,
      severity: 5,
      residualLikelihood: 2,
      residualSeverity: 3,
      controls: [{ controlLevel: "ppe", controlFa: "ماسک هوارسان" }],
    },
  });
  assert.equal(hz.ok, true, JSON.stringify(hz));

  const r = await api("POST", `/api/hse/jsa/${weakJsaId}/approve`, { user: "u-hse", raw: true });
  assert.equal(r.status, 409);
  const joined = (r.json.error.detailsFa ?? []).join(" | ");
  assert.match(joined, /حفاظت فردی|PPE/, `مانع اتکا به PPE باید گزارش شود: ${joined}`);
});

test("ریسک باقیماندهٔ بالاتر از حد مجاز مانع تصویب است", async () => {
  const j = await api("POST", `/api/hse/jsa${P}`, {
    body: { jsaNo: "JSA-HIGH", titleFa: "جابه‌جایی بار سنگین", preparedBy: "u-site", preparedAt: "2026-09-01" },
  });
  const s = await api("POST", `/api/hse/jsa/${j.data.id}/step`, { body: { descriptionFa: "بلند کردن با جرثقیل" } });
  await api("POST", `/api/hse/jsa/step/${s.data.id}/hazard`, {
    body: {
      hazardFa: "سقوط بار روی افراد",
      hazardCategory: "struck",
      likelihood: 4,
      severity: 4,
      residualLikelihood: 4,
      residualSeverity: 4,
      controls: [{ controlLevel: "administrative", controlFa: "طرح بالابری و مسدودسازی محدوده" }],
    },
  });
  const r = await api("POST", `/api/hse/jsa/${j.data.id}/approve`, { user: "u-hse", raw: true });
  assert.equal(r.status, 409);
  const joined = (r.json.error.detailsFa ?? []).join(" | ");
  assert.match(joined, /باقیمانده/, joined);
});

/* ══════════════ پیوند با پروانهٔ کار ══════════════ */

test("ارزیابی مصوب و معتبر پروانهٔ کار را پشتیبانی می‌کند", async () => {
  const r = await api("GET", `/api/hse/jsa/${jsaId}/permit-readiness`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.readiness.ok, true, JSON.stringify(r.data.readiness));
  assert.equal(r.data.jsaNo, "JSA-001");
});

test("ارزیابی پیش‌نویس پروانه را پشتیبانی نمی‌کند", async () => {
  const r = await api("GET", `/api/hse/jsa/${weakJsaId}/permit-readiness`);
  assert.equal(r.data.readiness.ok, false);
  assert.ok(r.data.readiness.blockersFa.length > 0, "دلیل رد باید فارسی باشد");
});

/* ══════════════ دسترسی ══════════════ */

test("درخواست بدون شناسهٔ کاربر ۴۰۱ می‌گیرد", async () => {
  const res = await fetch(`${BASE}/api/hse/jsa${P}`);
  assert.equal(res.status, 401);
});

test("کارفرما به ارزیابی ریسک پیمانکار دسترسی ندارد", async () => {
  const r = await api("GET", `/api/hse/jsa${P}`, { user: "u-client", raw: true });
  assert.equal(r.status, 403);
});

test("مدیر راه‌اندازی ارزیابی را می‌بیند ولی تصویب نمی‌کند", async () => {
  const ok = await api("GET", `/api/hse/jsa${P}`, { user: "u-comm", raw: true });
  assert.equal(ok.status, 403, "مدیر راه‌اندازی فقط پروانه را می‌بیند نه ارزیابی ریسک");
  const no = await api("POST", `/api/hse/jsa/${jsaId}/approve`, { user: "u-comm", raw: true });
  assert.equal(no.status, 403);
});
