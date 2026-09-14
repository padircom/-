/**
 * آزمون یکپارچهٔ REST — MOD-08 بخش ۷ (شاخص، نمره و هشدار زودهنگام).
 *
 * چرخه: کاشت دادهٔ پایه ← داشبورد ← هشدار ← سکوت ← انتشار عکس ← روند.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";

const PORT = 4724;
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

const PID = "met-p1";
const P = `?projectId=${PID}`;

/* دورهٔ آزمون ثابت است تا نتیجه با گذشت زمان تغییر نکند. */
const PERIOD = "2026-08";

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "hse-met-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});
  child = spawn(execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${BASE}/api/hse/metrics-vocab`, { headers: { "x-user-id": "u-hse" } });
      if (r.status < 500) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("سرور بالا نیامد");
});

after(async () => {
  child?.kill("SIGKILL");
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

/* ══════════════ ۱) واژگان ══════════════ */

test("واژگان شش شاخص و پنج قاعده را می‌دهد", async () => {
  const r = await api("GET", "/api/hse/metrics-vocab");
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.metrics.length, 6);
  assert.equal(r.data.alertRules.length, 5);
  assert.equal(r.data.blockedScoreCap, 55);
  assert.match(r.data.currentPeriod, /^\d{4}-\d{2}$/);

  const ltifr = r.data.metrics.find((m) => m.code === "ltifr");
  assert.equal(ltifr.direction, "lower_better");
  assert.equal(ltifr.weight, 30);
  /* UI نباید جهت شاخص را حدس بزند؛ باید از سرور بیاید. */
  const score = r.data.metrics.find((m) => m.code === "hse_score");
  assert.equal(score.weight, null, "نمره در وزن خودش نمی‌آید");
});

/* ══════════════ ۲) داشبورد روی پروژهٔ خالی ══════════════ */

test("پروژهٔ بدون داده همهٔ شاخص‌ها را تهی می‌دهد نه صفر", async () => {
  const r = await api("GET", `/api/hse/metrics${P}&period=${PERIOD}`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.periodCode, PERIOD);
  assert.equal(r.data.from, "2026-08-01");
  assert.equal(r.data.to, "2026-08-31");

  for (const m of r.data.metrics) {
    assert.equal(m.value, null, `${m.code} باید تهی باشد نه صفر`);
    assert.equal(m.verdict.code, "unknown");
  }
  assert.equal(r.data.score.score, null);
  assert.equal(r.data.health.status, "unknown");
  assert.equal(r.data.health.isReliable, false);
});

test("کد دورهٔ نامعتبر رد می‌شود", async () => {
  const r = await api("GET", `/api/hse/metrics${P}&period=1405-06-20`, { raw: true });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-PERIOD-INVALID");
});

test("بدون projectId رد می‌شود", async () => {
  const r = await api("GET", "/api/hse/metrics", { raw: true });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-CNT-NO-PROJECT");
});

/* ══════════════ ۳) کاشت دادهٔ پایه ══════════════ */

test("کاشت دادهٔ پایهٔ دوره", async () => {
  /* نفرساعت: بدون آن، LTIFR و TRIR تهی می‌مانند. */
  const mh = await api("POST", `/api/hse/man-hours${P}`, {
    body: { logDate: "2026-08-15", manHours: 240000, headCount: 120 },
  });
  assert.equal(mh.ok, true, JSON.stringify(mh));

  /* دو پروانه از مسیر واقعی صادر می‌شوند — کاشتِ مستقیمِ وضعیت ممکن
   * نیست چون اندپوینت همیشه «پیش‌نویس» می‌سازد و صدور دروازه دارد.
   * همین، یکپارچگی D1/D2 با شاخص را هم می‌سنجد. */
  const jsa = await api("POST", `/api/hse/jsa${P}`, {
    body: {
      jsaNo: "JSA-MET", titleFa: "ارزیابی ریسک کار سرد",
      preparedBy: "u-site", validFrom: "2026-08-01", validTo: "2026-12-31",
    },
  });
  assert.equal(jsa.ok, true, JSON.stringify(jsa));

  /* JSA بدون گام و خطر تصویب نمی‌شود — دروازهٔ D1 عمداً سخت است. */
  const step = await api("POST", `/api/hse/jsa/${jsa.data.id}/step${P}`, {
    body: { stepNo: 1, descriptionFa: "آماده‌سازی محل و بستن مسیر تردد" },
  });
  assert.equal(step.ok, true, JSON.stringify(step));

  const hz = await api("POST", `/api/hse/jsa/step/${step.data.id}/hazard${P}`, {
    body: {
      hazardNo: "HZ-1", hazardFa: "برخورد با ماشین‌آلات در تردد",
      hazardCategory: "struck", likelihood: 3, severity: 3,
      residualLikelihood: 1, residualSeverity: 2,
      controls: [{
        controlFa: "نصب حصار و علائم و استقرار پرچم‌دار",
        controlLevel: "engineering", responsibleFa: "سرپرست اجرا",
      }],
    },
  });
  assert.equal(hz.ok, true, JSON.stringify(hz));

  const appr = await api("POST", `/api/hse/jsa/${jsa.data.id}/approve${P}`, { body: {} });
  assert.equal(appr.ok, true, JSON.stringify(appr));

  for (const [no, validTo, close] of [
    ["PTW-M1", "2026-08-28T17:00:00.000Z", true],
    ["PTW-M2", "2026-08-10T17:00:00.000Z", false],
  ]) {
    const c = await api("POST", `/api/hse/permit${P}`, {
      body: {
        permitNo: no, permitType: "cold", titleFa: "کار سرد",
        validFrom: "2026-08-01T08:00:00.000Z", validTo,
        requestedBy: "u-sub", jsaId: jsa.data.id,
      },
    });
    assert.equal(c.ok, true, `${no}: ${JSON.stringify(c)}`);
    const id = c.data.id;

    /* سه سطح امضا با سه نفر متفاوت — درخواست‌کننده (u-sub) عمداً
     * بیرون است، چون تفکیک وظیفه امضای خودی را رد می‌کند. */
    for (const [level, who] of [["supervisor", "u-site"], ["hse", "u-hse"], ["area_manager", "u-pm"]]) {
      const sg = await api("POST", `/api/hse/permit/${id}/sign${P}`, { user: who, body: { level } });
      assert.equal(sg.ok, true, `امضای ${level}: ${JSON.stringify(sg)}`);
    }

    const issued = await api("POST", `/api/hse/permit/${id}/issue${P}`, { user: "u-hse", body: {} });
    assert.equal(issued.ok, true, `صدور ${no}: ${JSON.stringify(issued.error ?? issued)}`);
    if (close) {
      const cl = await api("POST", `/api/hse/permit/${id}/close${P}`, { user: "u-hse", body: {} });
      assert.equal(cl.ok, true, `بستن ${no}: ${JSON.stringify(cl)}`);
    }
  }

  /* یک حادثهٔ منجر به از کارافتادگی. */
  const inc = await api("POST", `/api/hse/incident${P}`, {
    body: {
      incidentNo: "INC-M1", incidentType: "lost_time", titleFa: "سقوط از داربست",
      occurredAt: "2026-08-12T10:00:00.000Z", severity: "high", lostDays: 12,
    },
  });
  assert.equal(inc.ok, true, JSON.stringify(inc));

  /* دو تخلف: یکی بسته، یکی معوق. */
  const v1 = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "VIO-M1", violationType: "ppe_missing", titleFa: "بدون کلاه",
      issuedAt: "2026-08-05T09:00:00.000Z", severity: "medium", offenderRef: "w-1",
    },
  });
  assert.equal(v1.ok, true, JSON.stringify(v1));

  /* جلسهٔ آموزش با دو حاضر. */
  const s = await api("POST", `/api/hse/training/session${P}`, {
    body: {
      sessionNo: "TRN-M1", titleFa: "بدو ورود", courseCode: "HSE-IND",
      trainingType: "induction", heldAt: "2026-08-03T08:00:00.000Z",
      durationMinutes: 240, instructorFa: "مدرس", validityMonths: 24,
    },
  });
  assert.equal(s.ok, true, JSON.stringify(s));
  for (const ref of ["w-1", "w-2"]) {
    await api("POST", `/api/hse/training/session/${s.data.id}/attendee${P}`, {
      body: { personRef: ref, personNameFa: ref, scorePct: 90 },
    });
  }
});

test("داشبورد با دادهٔ کامل عدد می‌دهد", async () => {
  const r = await api("GET", `/api/hse/metrics${P}&period=${PERIOD}&headCount=120`);
  assert.equal(r.ok, true, JSON.stringify(r));
  const by = Object.fromEntries(r.data.metrics.map((m) => [m.code, m]));

  assert.equal(r.data.manHours, 240000);
  assert.ok(by.ltifr.value != null, "با نفرساعت باید عدد بدهد");
  assert.equal(by.permit_compliance.value, 50, "یکی از دو پروانه منقضی بازمانده");
  /* ۲ نفر × ۴ ساعت ÷ ۱۲۰ نفر */
  assert.equal(by.training_hours_per_worker.value, 0.07);
  assert.ok(r.data.score.score != null);
});

test("شمار کارکنان صریح بر افراد حاضر اولویت دارد", async () => {
  const withHead = await api("GET", `/api/hse/metrics${P}&period=${PERIOD}&headCount=120`);
  const noHead = await api("GET", `/api/hse/metrics${P}&period=${PERIOD}`);

  const a = withHead.data.metrics.find((m) => m.code === "training_hours_per_worker").value;
  const b = noHead.data.metrics.find((m) => m.code === "training_hours_per_worker").value;
  assert.ok(b > a, "سرانه بر پایهٔ حاضران باید بالاتر (خوش‌بینانه‌تر) باشد");
  assert.ok(
    noHead.data.warningsFa.some((w) => /بالاتر/.test(w)),
    "خوش‌بینانه‌بودن باید صریح گفته شود",
  );
});

test("دورهٔ بدون داده هنوز تهی می‌ماند", async () => {
  const r = await api("GET", `/api/hse/metrics${P}&period=2026-03`);
  const by = Object.fromEntries(r.data.metrics.map((m) => [m.code, m]));
  assert.equal(by.ltifr.value, null, "دادهٔ ماه دیگر نباید نشت کند");
  assert.equal(by.permit_compliance.value, null);
});

/* ══════════════ ۴) هشدارها ══════════════ */

test("پروانهٔ منقضی بازنشده هشدار می‌سازد", async () => {
  const r = await api("GET", `/api/hse/alerts${P}`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.count, 5);

  const ep = r.data.items.find((a) => a.ruleCode === "expired_permit");
  assert.equal(ep.isTriggered, true);
  assert.equal(ep.isConfigured, false, "قاعده‌ای ثبت نشده ولی پیش‌فرض کار می‌کند");
  assert.ok(ep.actionFa, "اقدام پیشنهادی باید بیاید");
  assert.equal(ep.ownerRole, "hse_officer");
});

test("قاعدهٔ سفارشی با آستانهٔ بالاتر هشدار را خاموش می‌کند", async () => {
  const c = await api("POST", `/api/hse/alerts${P}`, {
    body: {
      ruleCode: "expired_permit", titleFa: "پروانهٔ منقضی — آستانهٔ کارگاهی",
      severity: "high", threshold: 5, comparison: "gt",
    },
  });
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(c.data.action, "insert");

  const r = await api("GET", `/api/hse/alerts${P}`);
  const ep = r.data.items.find((a) => a.ruleCode === "expired_permit");
  assert.equal(ep.isTriggered, false, "۱ کمتر از آستانهٔ ۵");
  assert.equal(ep.isConfigured, true);
  assert.equal(ep.threshold, 5);
});

test("به‌روزرسانی قاعده به‌جای ایجاد دوباره", async () => {
  const u = await api("POST", `/api/hse/alerts${P}`, {
    body: {
      ruleCode: "expired_permit", titleFa: "پروانهٔ منقضی — بازنگری",
      severity: "critical", threshold: 0, comparison: "gt",
    },
  });
  assert.equal(u.data.action, "update");

  const r = await api("GET", `/api/hse/alerts${P}`);
  const ep = r.data.items.find((a) => a.ruleCode === "expired_permit");
  assert.equal(ep.isTriggered, true, "آستانه دوباره صفر شد");
  assert.equal(ep.severity, "critical");
});

test("قاعده با کد ناشناخته رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/alerts${P}`, {
    body: { ruleCode: "invented", titleFa: "x", severity: "high", threshold: 1, comparison: "gt" },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-ALERT-CODE");
});

/* ══════════════ ۵) سکوت ══════════════ */

test("سکوت بدون دلیل رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/alerts/expired_permit/mute${P}`, {
    body: { until: "2026-09-20" }, raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-ALERT-MUTE-REASON");
});

test("سکوت بیش از سی روز رد می‌شود", async () => {
  const far = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const r = await api("POST", `/api/hse/alerts/expired_permit/mute${P}`, {
    body: { until: far, reasonFa: "تا اطلاع ثانوی" }, raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-ALERT-MUTE-TOO-LONG",
    "سکوت بی‌پایان همان خاموش‌کردن است");
});

test("سکوت معتبر هشدار را خاموش می‌کند ولی مشاهده می‌ماند", async () => {
  const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const m = await api("POST", `/api/hse/alerts/expired_permit/mute${P}`, {
    body: { until: soon, reasonFa: "پروانه در جریان بسته‌شدن اداری است" },
  });
  assert.equal(m.ok, true, JSON.stringify(m));

  const r = await api("GET", `/api/hse/alerts${P}`);
  const ep = r.data.items.find((a) => a.ruleCode === "expired_permit");
  assert.equal(ep.isMuted, true);
  assert.equal(ep.isTriggered, false);
  assert.ok(ep.observed >= 1, "عدد مشاهده نباید پاک شود");
  assert.match(ep.detailFa, /اداری/);
});

test("رفع سکوت هشدار را برمی‌گرداند", async () => {
  const u = await api("POST", `/api/hse/alerts/expired_permit/unmute${P}`);
  assert.equal(u.ok, true, JSON.stringify(u));

  const r = await api("GET", `/api/hse/alerts${P}`);
  const ep = r.data.items.find((a) => a.ruleCode === "expired_permit");
  assert.equal(ep.isMuted, false);
  assert.equal(ep.isTriggered, true);
});

test("رفع سکوت قاعدهٔ ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await api("POST", `/api/hse/alerts/unsafe_gas/unmute${P}`, { raw: true });
  assert.equal(r.status, 404);
});

/* ══════════════ ۶) اثر هشدار بحرانی بر نمره ══════════════ */

test("هشدار بحرانی سقف نمره را پایین می‌کشد", async () => {
  const before = await api("GET", `/api/hse/metrics${P}&period=${PERIOD}&headCount=120`);
  const alerts = await api("GET", `/api/hse/alerts${P}`);

  assert.ok(alerts.data.criticalCount > 0, "قاعدهٔ بحرانی بخش قبل باید فعال مانده باشد");
  assert.notEqual(before.data.score.score, null);

  /* ادعای اصلی: با هشدار بحرانی، نمره هرگز از سقف بالاتر نمی‌رود.
   * پرچم `isCapped` فقط وقتی روشن می‌شود که سقف واقعاً چیزی را
   * بریده باشد — نمره‌ای که از پیش زیر سقف است «محدودشده» نیست و
   * ادعای خلافش، سقف را با نمرهٔ پایین اشتباه می‌گیرد. */
  assert.ok(before.data.score.score <= 55, `نمره ${before.data.score.score} از سقف بالاتر است`);
  if (before.data.score.isCapped) {
    assert.ok(before.data.score.capReasonFa.length >= 1, "بریدن سقف باید دلیل داشته باشد");
    assert.equal(before.data.score.score, 55);
  } else {
    assert.deepEqual(before.data.score.capReasonFa, []);
  }
  assert.equal(before.data.health.status, "red");
});

/* ══════════════ ۷) انتشار عکس ══════════════ */

test("دورهٔ آینده قابل انتشار نیست", async () => {
  const r = await api("POST", `/api/hse/metrics/publish${P}`, {
    user: "u-pm",
    body: { periodCode: "2099-01" },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-PERIOD-FUTURE");
});

test("دورهٔ بدون داده قابل انتشار نیست", async () => {
  const r = await api("POST", `/api/hse/metrics/publish${P}`, {
    user: "u-pm",
    body: { periodCode: "2026-03" },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-METRIC-NO-DATA",
    "انتشار عکس خالی، گزارش توخالی می‌سازد");
});

test("انتشار عکس دوره ردیف ذخیره می‌کند", async () => {
  const r = await api("POST", `/api/hse/metrics/publish${P}`, {
    user: "u-pm",
    body: { periodCode: PERIOD, headCount: 120 },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.data.published >= 2, "دست‌کم چند شاخص باید ذخیره شود");
  assert.equal(r.data.supersededCount, 0, "بار اول چیزی جایگزین نمی‌شود");

  const codes = r.data.items.map((x) => x.MetricCode);
  assert.ok(codes.includes("hse_score"), "نمره هم باید ذخیره شود");
  for (const it of r.data.items) {
    assert.equal(it.PeriodCode, PERIOD);
    assert.equal(it.Status, "published");
    assert.ok(it.Unit);
  }
});

test("انتشار دوباره، عکس قبلی را جایگزین می‌کند نه پاک", async () => {
  const r = await api("POST", `/api/hse/metrics/publish${P}`, {
    user: "u-pm",
    body: { periodCode: PERIOD, headCount: 120 },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.data.supersededCount >= 2, "عکس‌های پیشین باید جایگزین شوند");
});

/* ══════════════ ۸) روند ══════════════ */

test("روند یک شاخص پس از انتشار در دسترس است", async () => {
  const r = await api("GET", `/api/hse/metrics/trend/permit_compliance${P}`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.trend.metricCode, "permit_compliance");
  assert.ok(r.data.trend.points.length >= 1);
  /* عکس جایگزین‌شده نباید در روند بیاید. */
  const periods = r.data.trend.points.map((p) => p.periodCode);
  assert.equal(new Set(periods).size, periods.length, "هر دوره فقط یک نقطه");
});

test("کد شاخص نامعتبر در روند رد می‌شود", async () => {
  const r = await api("GET", `/api/hse/metrics/trend/made_up${P}`, { raw: true });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-METRIC-CODE");
});

test("روند با یک نقطه جهت را ادعا نمی‌کند", async () => {
  const r = await api("GET", `/api/hse/metrics/trend/permit_compliance${P}`);
  if (r.data.trend.points.length < 2) {
    assert.equal(r.data.trend.direction, "unknown");
    assert.equal(r.data.trend.changePct, null);
  }
});

/* ══════════════ ۹) دسترسی و تفکیک وظیفه ══════════════ */

test("افسر ایمنی نمی‌تواند عکس دوره را منتشر کند", async () => {
  /* او عدد را می‌سازد؛ نهایی‌کردنش برای کارفرما کار دیگری است. */
  const r = await api("POST", `/api/hse/metrics/publish${P}`, {
    user: "u-hse", body: { periodCode: PERIOD }, raw: true,
  });
  assert.equal(r.status, 403);
});

test("مدیر پروژه نمی‌تواند قاعدهٔ هشدار را سکوت کند", async () => {
  const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const r = await api("POST", `/api/hse/alerts/unsafe_gas/mute${P}`, {
    user: "u-pm", body: { until: soon, reasonFa: "x" }, raw: true,
  });
  assert.equal(r.status, 403, "خاموش‌کردن هشدار ایمنی کار افسر ایمنی است");
});

test("سرپرست کارگاه شاخص را می‌بیند ولی پیکربندی نمی‌کند", async () => {
  const view = await api("GET", `/api/hse/metrics${P}&period=${PERIOD}`, { user: "u-site" });
  assert.equal(view.ok, true);

  const conf = await api("POST", `/api/hse/alerts${P}`, {
    user: "u-site",
    body: { ruleCode: "unsafe_gas", titleFa: "x", severity: "critical", threshold: 0, comparison: "gt" },
    raw: true,
  });
  assert.equal(conf.status, 403);
});

test("کارشناس برنامه‌ریزی به شاخص ایمنی دسترسی ندارد", async () => {
  for (const path of [
    `/api/hse/metrics${P}`,
    `/api/hse/alerts${P}`,
    `/api/hse/metrics-vocab`,
  ]) {
    const r = await api("GET", path, { user: "u-planner", raw: true });
    assert.equal(r.status, 403, `${path} نباید باز باشد`);
  }
});

test("کاربر ناشناس ۴۰۱ می‌گیرد", async () => {
  const r = await api("GET", `/api/hse/metrics${P}`, { user: "ghost", raw: true });
  assert.ok(r.status === 401 || r.status === 403, `status=${r.status}`);
});

/* ══════════════ ۱۰) نشت میان پروژه‌ها ══════════════ */

test("شاخص پروژهٔ دیگر در این پروژه دیده نمی‌شود", async () => {
  await api("POST", "/api/hse/man-hours?projectId=other-met", {
    body: { logDate: "2026-08-15", manHours: 9_000_000 },
  });
  const r = await api("GET", `/api/hse/metrics${P}&period=${PERIOD}`);
  assert.equal(r.data.manHours, 240000, "نفرساعت پروژهٔ دیگر نباید جمع شود");
});

test("قاعدهٔ هشدار پروژهٔ دیگر اینجا اثر ندارد", async () => {
  await api("POST", "/api/hse/alerts?projectId=other-met", {
    body: {
      ruleCode: "unsafe_gas", titleFa: "قاعدهٔ پروژهٔ دیگر",
      severity: "low", threshold: 999, comparison: "gt",
    },
  });
  const r = await api("GET", `/api/hse/alerts${P}`);
  const gas = r.data.items.find((a) => a.ruleCode === "unsafe_gas");
  assert.equal(gas.isConfigured, false, "قاعدهٔ پروژهٔ دیگر نباید اینجا دیده شود");
  assert.equal(gas.threshold, 0, "پیش‌فرض باید بماند");
});

test("عکس پروژهٔ دیگر در روند این پروژه نمی‌آید", async () => {
  const r = await api("GET", `/api/hse/metrics/trend/hse_score${P}`);
  for (const p of r.data.trend.points) {
    assert.ok(Number.isFinite(p.value));
  }
  assert.ok(r.data.trend.points.length <= 2, "فقط دوره‌های همین پروژه");
});
