/**
 * آزمون یکپارچگی بین‌بخشی IIoT ⇄ CMMS / MES / PMIS.
 * ═══════════════════════════════════════════════════════════════════════
 * این فایل «اتصال واقعی» ماژول را می‌آزماید، نه یک تقلید: همان
 * `applyIiotIntegrationEvent` که `server/index.js` به عنوان حمل‌ونقل
 * درون‌فرآیندی ثبت می‌کند، اینجا هم به همان شکل به API وصل می‌شود. پس مسیری
 * که آزمون می‌گذراند، همان مسیر تولید است:
 *
 *   نمونهٔ بحرانی → قاعدهٔ آستانه → هشدار → صف خروجی (IotIntegrationEvent)
 *     → CMMS: آلارم + دستورکار اضطراری (+ درخواست‌کار اگر دارایی شناخته شود)
 *     → MES:  ثبت توقف ناخواسته در لایهٔ اجرا
 *     → PMIS: رویداد در صندوق یکپارچگی پروژه (+ پیش‌نویس ادعا برای NPT شایسته)
 *
 * سه اصل که اینجا قفل می‌شوند:
 *   ۱) هیچ رکورد تکراری با کلید ضدتکرار یکسان ساخته نمی‌شود.
 *   ۲) شکست یک مقصد، دو مقصد دیگر را متوقف نمی‌کند (تحویل جزئی).
 *   ۳) ارجاع‌ها نرم‌اند: نبودِ دارایی/مرکز کاری، خطای دسته‌بندی‌شده می‌دهد
 *      نه رکورد بی‌صاحب.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_SUBJECTS } from "./rbacLogic.js";
import {
  IIOT_BRIDGE_EVENT_TYPES,
  IIOT_BRIDGE_MODEL,
  applyIiotIntegrationEvent,
  normalizeIiotInboundEvent,
  registerIiotBridgeRoutes,
} from "./iiotIntegration.js";
import {
  ENGINEER,
  RIG,
  ROOT,
  SUPERVISOR,
  iso,
  makeApi,
  makeFakeTimeSeries,
  makeRepo,
  ok,
  seedRig,
  series,
} from "./iiotTestFixtures.mjs";

const SITE = "SITE-DEMO";
const WORK_CENTER = "WC-DRILL-01";
const PROJECT = "c1-p1";
const ASSET_CODE = "ASSET-MUDPUMP-01";

/** ساعت قابل پیش‌رفتن. */
function clock(start = 0) {
  let seconds = start;
  return { get at() { return seconds; }, set(v) { seconds = v; }, iso: () => iso(seconds) };
}

/**
 * محیط یکپارچگی: یک مخزن مشترک که هم جدول‌های `Iot*` و هم جدول‌های مقصد
 * (CMMS/MES/PMIS) در آن‌اند — دقیقاً مثل استقرار تک‌پایگاه‌داده‌ای. استقلال
 * منطقی از نبودِ کلید خارجی می‌آید، نه از جدا بودن مخزن.
 */
async function setupBridge({ withAsset = true, start = 0 } = {}) {
  const clk = clock(start);
  /* حمل‌ونقل درون‌فرآیندی — همان شکل server/index.js. */
  const transport = {
    deliveries: [],
    async deliver(event) {
      try {
        const outcome = await applyIiotIntegrationEvent({ repo: api.repo, event, actor: "svc-iiot-bridge" });
        this.deliveries.push({ ok: true, event, outcome });
        return { ok: true, ref: outcome.ref, table: outcome.table, alreadyApplied: outcome.alreadyApplied === true };
      } catch (err) {
        this.deliveries.push({ ok: false, event, code: err?.code });
        return { ok: false, code: typeof err?.code === "string" && err.code ? err.code : "E-IIOT-BRIDGE", messageFa: err?.messageFa ?? String(err) };
      }
    },
  };
  const api = makeApi({ subjects: DEMO_SUBJECTS, now: () => clk.iso(), timeSeries: makeFakeTimeSeries(), transport });
  /* مقصدهای واقعی: سایت نت، دارایی، مرکز کاری و پارامتر پایش وضعیت. */
  await api.repo.create("CmmsSite", { Id: SITE, SiteCode: SITE, NameFa: "سایت آزادگان جنوبی", IsActive: true }, "seed");
  const asset = withAsset
    ? await api.repo.create("CmmsAsset", { Id: "AST-1", SiteId: SITE, AssetCode: ASSET_CODE, NameFa: "پمپ گل شمارهٔ ۱", Status: "active" }, "seed")
    : null;
  await api.repo.create("MfgWorkCenter", { Id: "WC-1", Code: WORK_CENTER, PlantId: "PLANT-01", NameFa: "مرکز حفاری ۱" }, "seed");
  await api.repo.create("CmmsFamilyConditionParam", { Id: "FCP-1", Code: "VIB-RMS", NameFa: "ارتعاش مؤثر", Uom: "mm/s" }, "seed");

  const seeded = await seedRig(api.repo, {});
  return { ...api, ...seeded, clk, transport, asset, site: SITE };
}

/** پذیرش نمونه با هویت مهندس. */
async function ingest(env, samples) {
  return ok(env.call, "POST", `${ROOT}/telemetry`, {
    params: { rigId: RIG }, body: { samples }, as: ENGINEER, expect: 202,
  });
}

/** ۲۵ نمونهٔ داغ که آستانهٔ بحرانی دما را به‌طور پایدار می‌شکنند. */
const hotTemp = () => series("CH-TEMP", Array(25).fill(135));

/* ═══════════════════ الف) رویداد بحرانی → CMMS ═══════════════════ */

test("CMMS: هشدار بحرانی، آلارم و دستورکار اضطراری خودکار می‌سازد", async () => {
  const env = await setupBridge();
  env.clk.set(30);
  const data = await ingest(env, hotTemp());
  assert.equal(data.alerts.created.length, 1);

  const alerts = await env.repo.list("CmmsAlert", { where: [] });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].SiteId, SITE);
  assert.ok(alerts[0].AlertCode.startsWith("IIOT-"), `کد آلارم باید با پیشوند IIOT باشد: ${alerts[0].AlertCode}`);
  assert.equal(alerts[0].Severity, "critical");
  assert.equal(alerts[0].Status, "open");
  assert.ok(alerts[0].MessageFa.includes("کلید تکرارناپذیر"), "کلید ضدتکرار باید در پیام بماند تا بستن خودکار ممکن شود");
  assert.equal(alerts[0].NotifyEmail, true);

  const orders = await env.repo.list("CmmsWorkOrder", { where: [] });
  assert.equal(orders.length, 1);
  assert.equal(orders[0].WorkOrderNo, "IIOT-WO-001");
  assert.equal(orders[0].WorkOrderType, "emergency");
  assert.equal(orders[0].Status, "draft");
  assert.equal(orders[0].Priority, 1);
  assert.equal(orders[0].IsAssetDown, true);
  assert.equal(orders[0].ProductionImpact, "partial");
  assert.ok(orders[0].ScopeFa.includes("IIoT/threshold"), "منبع رویداد در دامنهٔ کار می‌نشیند");

  /* قاعدهٔ نمونه، ارجاع دارایی ندارد → درخواست‌کار ساخته نمی‌شود
   * (چون CmmsWorkRequest.AssetId اجباری است)، ولی دستورکار ساخته شد. */
  assert.equal((await env.repo.list("CmmsWorkRequest", { where: [] })).length, 0);
  assert.equal(orders[0].AssetId, null);
});

test("CMMS: با دارایی شناخته‌شده، درخواست‌کار هم ساخته و به دستورکار وصل می‌شود", async () => {
  const env = await setupBridge();
  await env.repo.patch("IotThresholdRule", env.rules.tempCritical.Id, { CmmsAssetRef: ASSET_CODE }, "test", env.rules.tempCritical.RowVersion);
  env.clk.set(30);
  await ingest(env, hotTemp());

  const requests = await env.repo.list("CmmsWorkRequest", { where: [] });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].RequestNo, "IIOT-REQ-001");
  assert.equal(requests[0].AssetId, env.asset.Id, "ارجاع نرم با کد دارایی حل می‌شود");
  assert.equal(requests[0].RequestType, "service");
  assert.equal(requests[0].Status, "submitted");
  assert.equal(requests[0].IsAssetStopped, true);
  const order = (await env.repo.list("CmmsWorkOrder", { where: [] }))[0];
  assert.equal(requests[0].ConvertedWorkOrderId, order.Id, "درخواست به همان دستورکار خودکار وصل است");
  assert.equal(order.AssetId, env.asset.Id);
});

test("CMMS: تحویل دوبارهٔ همان رویداد، رکورد تکراری نمی‌سازد", async () => {
  const env = await setupBridge();
  env.clk.set(30);
  await ingest(env, hotTemp());
  const event = (await env.repo.list("IotIntegrationEvent", { where: [{ column: "TargetSystem", op: "eq", value: "cmms" }] }))[0];
  const again = await applyIiotIntegrationEvent({ repo: env.repo, event, actor: "svc-iiot-bridge" });
  assert.equal(again.alreadyApplied, true);
  assert.equal((await env.repo.list("CmmsAlert", { where: [] })).length, 1);
  assert.equal((await env.repo.list("CmmsWorkOrder", { where: [] })).length, 1);
});

/* ═══════════════════ ب) رویداد بحرانی → MES ═══════════════════ */

test("MES: ناهنجاری تله‌متری، توقف ناخواسته در لایهٔ اجرا ثبت می‌کند", async () => {
  const env = await setupBridge();
  env.clk.set(30);
  const data = await ingest(env, hotTemp());
  assert.equal(data.alerts.created[0].DispatchStatus, "dispatched");

  const logs = await env.repo.list("MfgDowntimeLog", { where: [] });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].WorkCenterId, "WC-1", "ارجاع نرم با کد مرکز کاری حل می‌شود");
  assert.equal(logs[0].PlantId, "PLANT-01");
  assert.equal(logs[0].DowntimeType, "unplanned", "توقف ناشی از ناهنجاری، ناخواسته است");
  assert.equal(logs[0].ReasonCode, "IIOT-THRESHOLD");
  assert.equal(logs[0].FinishedAt, null, "تا رفع نشود باز می‌ماند");
  assert.ok(logs[0].NoteFa.includes("کلید:"), "کلید ضدتکرار در یادداشت می‌ماند");
});

test("MES: رویداد رفع، همان ردیف توقف را می‌بندد", async () => {
  const env = await setupBridge();
  env.clk.set(30);
  await ingest(env, hotTemp());
  /* پس از دورهٔ سکوت، دما به محدودهٔ عادی برمی‌گردد. */
  env.clk.set(400);
  const data = await ingest(env, series("CH-TEMP", Array(10).fill(90), { startOffsetSeconds: 380 }));
  assert.equal(data.alerts.resolved.length, 1);

  const logs = await env.repo.list("MfgDowntimeLog", { where: [] });
  assert.equal(logs.length, 1, "ردیف تازه‌ای ساخته نمی‌شود");
  assert.ok(logs[0].FinishedAt, "توقف بسته می‌شود");
  assert.ok(Number(logs[0].DurationMinutes) > 0);

  const alert = (await env.repo.list("CmmsAlert", { where: [] }))[0];
  assert.equal(alert.Status, "resolved", "آلارم CMMS هم بسته می‌شود");
  assert.ok(alert.ResolutionNoteFa.includes("بازگشت سیگنال"));
});

/* ═══════════════════ پ) رویداد بحرانی → PMIS ═══════════════════ */

test("PMIS: رویداد در صندوق یکپارچگی پروژه می‌نشیند", async () => {
  const env = await setupBridge();
  env.clk.set(30);
  await ingest(env, hotTemp());
  const events = await env.repo.list("IntegrationEvent", { where: [] });
  assert.equal(events.length, 1);
  assert.ok(events[0].EventKey.startsWith("iiot-pmis:"), `کلید رویداد باید با پیشوند قرارداد باشد: ${events[0].EventKey}`);
  assert.equal(events[0].SourceModule, "iiot");
  assert.equal(events[0].TargetModule, "d2");
  assert.equal(events[0].ProjectId, PROJECT, "ارجاع نرم پروژه از قاعده/دکل می‌آید");
  assert.equal(events[0].Status, "pending");
  const payload = JSON.parse(events[0].PayloadJson);
  assert.equal(payload.contract, "iiot-pmis-v1");
  assert.equal(payload.modelVersion, "iiot-v1");
  assert.ok(payload.idempotencyKey.length > 0);
  /* بدون NPT شایستهٔ ادعا، پیش‌نویس ادعا ساخته نمی‌شود. */
  assert.equal((await env.repo.list("Claim", { where: [] })).length, 0);
});

test("PMIS: راستی‌آزمایی NPT شایستهٔ ادعا، پیش‌نویس Claim می‌سازد", async () => {
  const env = await setupBridge();
  /* ۳۰۰ دقیقه با مسئولیت کارفرما (دستهٔ wellbore). */
  const downtime = await ok(env.call, "POST", `${ROOT}/downtime`, {
    params: { rigId: RIG }, expect: 201,
    body: { Category: "wellbore", CauseFa: "گیرکردن رشته", StartedAt: iso(-21600), EndedAt: iso(-3600) },
  });
  assert.equal(downtime.ResponsibilityFa, "کارفرما");
  const verified = await ok(env.call, "POST", `${ROOT}/downtime/:downtimeId/verify`, {
    params: { rigId: RIG, downtimeId: downtime.Id }, as: SUPERVISOR, body: { NoteFa: "تأیید شد", dispatch: true },
  });
  assert.deepEqual(verified.dispatched.map((d) => d.target).sort(), ["mes", "pmis"]);
  assert.ok(verified.dispatched.every((d) => d.delivered), "هر دو مقصد باید تحویل گرفته باشند");

  const claims = await env.repo.list("Claim", { where: [] });
  assert.equal(claims.length, 1);
  assert.equal(claims[0].Code, `IIOT-NPT-${downtime.DowntimeCode}`);
  assert.equal(claims[0].ProjectId, PROJECT);
  assert.equal(claims[0].Status, "draft", "اعلام ادعا تصمیم انسانی است — IIoT فقط پیش‌نویس می‌سازد");
  assert.equal(claims[0].TimeBarred, false);
  assert.equal(claims[0].ExtensionDays, 0, "۳۰۰ دقیقه = ۰ روز کامل");
  assert.ok(claims[0].QuantumNote.includes("300"));
  assert.ok(claims[0].EvidenceRef.includes(downtime.Id), "شاهد، ردیف منبع را نام می‌برد");

  /* تحویل دوباره، ادعای دوم نمی‌سازد. */
  const pmisEvent = (await env.repo.list("IotIntegrationEvent", { where: [{ column: "TargetSystem", op: "eq", value: "pmis" }] }))[0];
  const again = await applyIiotIntegrationEvent({ repo: env.repo, event: pmisEvent, actor: "svc-iiot-bridge" });
  assert.equal(again.alreadyApplied, true);
  assert.equal((await env.repo.list("Claim", { where: [] })).length, 1);
});

test("PMIS/MES: راستی‌آزمایی، ردیف توقف MES را می‌بندد", async () => {
  const env = await setupBridge();
  const downtime = await ok(env.call, "POST", `${ROOT}/downtime`, {
    params: { rigId: RIG }, expect: 201,
    body: { Category: "equipment", CauseFa: "خرابی پمپ", StartedAt: iso(-7200) },
  });
  await ok(env.call, "POST", `${ROOT}/downtime/:downtimeId/close`, {
    params: { rigId: RIG, downtimeId: downtime.Id }, body: { EndedAt: iso(-3600) },
  });
  await ok(env.call, "POST", `${ROOT}/downtime/:downtimeId/verify`, {
    params: { rigId: RIG, downtimeId: downtime.Id }, as: SUPERVISOR, body: { dispatch: true },
  });
  const logs = await env.repo.list("MfgDowntimeLog", { where: [] });
  assert.equal(logs.length, 1);
  assert.ok(logs[0].FinishedAt, "توقف در MES بسته می‌شود");
  assert.equal(Number(logs[0].DurationMinutes), 60);
  /* NPT زیر آستانه/با مسئولیت پیمانکار → ادعا نمی‌سازد. */
  assert.equal((await env.repo.list("Claim", { where: [] })).length, 0);
});

/* ═══════════════════ ت) شکست جزئی و خطاهای دسته‌بندی‌شده ═══════════════════ */

test("تحویل جزئی: شکست یک مقصد، دو مقصد دیگر را متوقف نمی‌کند", async () => {
  const env = await setupBridge();
  /* مرکز کاری ناموجود در قاعده → فقط MES شکست می‌خورد. */
  await env.repo.patch("IotThresholdRule", env.rules.tempCritical.Id, { MesWorkCenterRef: "WC-ناموجود" }, "test", env.rules.tempCritical.RowVersion);
  env.clk.set(30);
  const data = await ingest(env, hotTemp());
  const alert = data.alerts.created[0];
  assert.equal(alert.DispatchStatus, "partial", "cmms و pmis رسیدند، mes نرسید");
  assert.ok(alert.CmmsWorkOrderRef && alert.PmisEventRef);
  assert.equal(alert.MesDowntimeRef, null);

  /* CMMS و PMIS واقعاً نوشته‌اند. */
  assert.equal((await env.repo.list("CmmsWorkOrder", { where: [] })).length, 1);
  assert.equal((await env.repo.list("IntegrationEvent", { where: [] })).length, 1);
  assert.equal((await env.repo.list("MfgDowntimeLog", { where: [] })).length, 0);
  /* و دلیل شکست در صف خروجی ثبت شده است. */
  const mesEvent = (await env.repo.list("IotIntegrationEvent", { where: [{ column: "TargetSystem", op: "eq", value: "mes" }] }))[0];
  assert.equal(mesEvent.Status, "failed");
  assert.equal(mesEvent.ErrorCode, "E-IIOT-MES-WORKCENTER-UNKNOWN");
  assert.ok(mesEvent.ErrorFa.includes("WC-ناموجود"));
});

test("خطاها: مقصد/رویداد/کلید نامعتبر، کد دسته‌بندی‌شده می‌دهند نه رکورد خراب", async () => {
  const env = await setupBridge();
  const expectCode = async (event, code) => {
    try {
      await applyIiotIntegrationEvent({ repo: env.repo, event, actor: "svc-iiot-bridge" });
      assert.fail("باید خطا می‌داد");
    } catch (err) {
      assert.equal(err.code, code);
    }
  };
  const base = { TargetSystem: "cmms", EventType: "alert.critical", IdempotencyKey: "k-1", PayloadJson: {} };
  await expectCode({ ...base, TargetSystem: "sap" }, "E-IIOT-BRIDGE-TARGET");
  await expectCode({ ...base, EventType: "invoice.paid" }, "E-IIOT-BRIDGE-EVENT");
  await expectCode({ ...base, IdempotencyKey: "" }, "E-IIOT-BRIDGE-KEY");
  await expectCode({ TargetSystem: "cmms", EventType: "alert.critical", IdempotencyKey: "k-2", PayloadJson: {} }, "E-IIOT-CMMS-SITE-MISSING");
  /* هیچ رکوردی در مقصدها ساخته نشده است. */
  assert.equal((await env.repo.list("CmmsAlert", { where: [] })).length, 0);
  assert.equal((await env.repo.list("IntegrationEvent", { where: [] })).length, 0);
});

test("CMMS: پایش وضعیت بدون پارامتر مقصد، ردیف بی‌صاحب نمی‌گذارد", async () => {
  const env = await setupBridge();
  const event = {
    TargetSystem: "cmms", EventType: "condition.reading", IdempotencyKey: "cond-1",
    PayloadJson: { cmmsSiteRef: SITE, cmmsAssetRef: ASSET_CODE, readingType: "vibration", value: 7.4, uom: "mm/s", eventKind: "condition" },
  };
  try {
    await applyIiotIntegrationEvent({ repo: env.repo, event, actor: "svc-iiot-bridge" });
    assert.fail("باید خطا می‌داد");
  } catch (err) {
    assert.equal(err.code, "E-IIOT-CMMS-PARAM-MISSING");
  }
  assert.equal((await env.repo.list("CmmsConditionReading", { where: [] })).length, 0, "ردیف موقت پاک می‌شود");

  /* با پارامتر مقصد، خوانش ثبت می‌شود. */
  const withParam = await applyIiotIntegrationEvent({
    repo: env.repo, actor: "svc-iiot-bridge",
    event: { ...event, IdempotencyKey: "cond-2", PayloadJson: { ...event.PayloadJson, cmmsConditionParamRef: "FCP-1" } },
  });
  assert.equal(withParam.table, "CmmsConditionReading");
  const reading = await env.repo.get("CmmsConditionReading", withParam.ref);
  assert.equal(reading.Source, "iiot");
  assert.equal(reading.AssetId, env.asset.Id);
  assert.equal(Number(reading.Value), 7.4);
});

test("CMMS: دارایی ناشناخته برای پایش وضعیت، خطای صریح می‌دهد", async () => {
  const env = await setupBridge({ withAsset: false });
  try {
    await applyIiotIntegrationEvent({
      repo: env.repo, actor: "svc-iiot-bridge",
      event: {
        TargetSystem: "cmms", EventType: "condition.reading", IdempotencyKey: "cond-3",
        PayloadJson: { cmmsSiteRef: SITE, cmmsAssetRef: "ASSET-ناموجود", readingType: "vibration", value: 1, uom: "mm/s", eventKind: "condition", cmmsConditionParamRef: "FCP-1" },
      },
    });
    assert.fail("باید خطا می‌داد");
  } catch (err) {
    assert.equal(err.code, "E-IIOT-CMMS-ASSET-UNKNOWN");
  }
});

test("بدون ارجاع سایت/پروژه، مقصد مربوطه خطا می‌دهد ولی بقیه می‌رسند", async () => {
  const env = await setupBridge();
  /* قاعده و دکل هر دو بدون ارجاع PMIS — ارث‌بری قاعده←دکل عمداست، پس باید
   * هر دو خالی باشند تا رویداد واقعاً بی‌مقصد بماند. */
  await env.repo.patch("IotThresholdRule", env.rules.tempCritical.Id, { PmisProjectRef: null }, "test", env.rules.tempCritical.RowVersion);
  const rig = await env.repo.findOne("IotDrillingRig", [{ column: "RigId", op: "eq", value: RIG }]);
  await env.repo.patch("IotDrillingRig", rig.Id, { PmisProjectRef: null }, "test", rig.RowVersion);
  env.clk.set(30);
  await ingest(env, hotTemp());
  const pmisEvent = (await env.repo.list("IotIntegrationEvent", { where: [{ column: "TargetSystem", op: "eq", value: "pmis" }] }))[0];
  assert.equal(pmisEvent.ErrorCode, "E-IIOT-PMIS-PROJECT-MISSING");
  /* CMMS و MES unaffected. */
  assert.equal((await env.repo.list("CmmsWorkOrder", { where: [] })).length, 1);
  assert.equal((await env.repo.list("MfgDowntimeLog", { where: [] })).length, 1);
});

/* ═══════════════════ ث) قرارداد و مسیرهای REST پل ═══════════════════ */

test("قرارداد: هر دو شکل رویداد (ردیف ذخیره‌شده و پاکت حمل‌ونقل) پذیرفته می‌شود", () => {
  const fromRow = normalizeIiotInboundEvent({
    Id: "E-1", EventType: "alert.critical", TargetSystem: "cmms", IdempotencyKey: "k",
    Contract: "iiot-cmms-v1", OccurredAt: iso(0), PayloadJson: { a: 1 },
  });
  assert.equal(fromRow.EventType, "alert.critical");
  assert.equal(fromRow.PayloadJson.a, 1);

  const fromEnvelope = normalizeIiotInboundEvent({
    eventId: "E-1", eventType: "alert.critical", targetSystem: "cmms", idempotencyKey: "k",
    contract: "iiot-cmms-v1", occurredAt: iso(0), payload: { a: 1 },
  });
  assert.deepEqual(fromEnvelope, fromRow, "دو شکل، یک معنی");

  assert.deepEqual(normalizeIiotInboundEvent(null), {});
  assert.deepEqual(IIOT_BRIDGE_EVENT_TYPES, ["alert.critical", "alert.resolved", "downtime.npt", "downtime.closed", "condition.reading"]);
});

test("REST پل: مسیرهای سه مقصد با RBAC مقصد محافظت می‌شوند", async () => {
  const repo = makeRepo();
  await repo.create("CmmsSite", { Id: SITE, SiteCode: SITE, NameFa: "سایت" }, "seed");
  const handlers = new Map();
  const app = { post: (path, handler) => handlers.set(path, handler), get() {}, patch() {}, delete() {} };
  const registered = registerIiotBridgeRoutes(app, { repo, subjects: DEMO_SUBJECTS, evaluate: (await import("./rbacLogic.js")).evaluate });
  assert.deepEqual(registered.routes, ["POST /api/cmms/iiot-events", "POST /api/mes/iiot-events", "POST /api/pmis/iiot-events"]);
  assert.equal(registered.model, IIOT_BRIDGE_MODEL);

  const call = async (path, body, userId) => {
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
    await handlers.get(path)({ body, headers: { "x-user-id": userId ?? "" }, requestId: "bridge-test" }, res);
    return res;
  };
  const event = {
    EventType: "alert.critical", TargetSystem: "cmms", IdempotencyKey: "rest-1", Contract: "iiot-cmms-v1", OccurredAt: iso(0),
    PayloadJson: { cmmsSiteRef: SITE, level: "critical", titleFa: "دمای بحرانی", alertCode: "THRESHOLD-CH-TEMP-CRITICAL", rigNo: "RIG-91" },
  };

  /* بی‌هویت → ۴۰۱ */
  assert.equal((await call("/api/cmms/iiot-events", event, "")).statusCode, 401);
  /* کاربر بدون مجوز مقصد → ۴۰۳ (مهندس IIoT حق نوشتن در CMMS ندارد). */
  const forbidden = await call("/api/cmms/iiot-events", event, ENGINEER);
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.body.error.permission, "cmms.request.create");
  /* کاربر مجاز → ۲۰۱ */
  const created = await call("/api/cmms/iiot-events", event, "u-cmms-planner");
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.data.table, "CmmsWorkOrder");
  assert.equal(created.body.data.model, IIOT_BRIDGE_MODEL);
  /* تکرار همان رویداد → ۲۰۰ و alreadyApplied */
  const repeat = await call("/api/cmms/iiot-events", event, "u-cmms-planner");
  assert.equal(repeat.statusCode, 200);
  assert.equal(repeat.body.data.alreadyApplied, true);
  assert.equal((await repo.list("CmmsWorkOrder", { where: [] })).length, 1);
  /* خطای مقصد → ۴۲۲ با کد دسته‌بندی‌شده */
  const missing = await call("/api/cmms/iiot-events", { ...event, IdempotencyKey: "rest-2", PayloadJson: {} }, "u-cmms-planner");
  assert.equal(missing.statusCode, 422);
  assert.equal(missing.body.error.code, "E-IIOT-CMMS-SITE-MISSING");
});

test("REST پل: مسیر MES با مجوز اجرای تولید محافظت می‌شود", async () => {
  const repo = makeRepo();
  await repo.create("MfgWorkCenter", { Id: "WC-1", Code: WORK_CENTER, PlantId: "PLANT-01" }, "seed");
  const handlers = new Map();
  registerIiotBridgeRoutes({ post: (p, h) => handlers.set(p, h), get() {}, patch() {}, delete() {} }, {
    repo, subjects: DEMO_SUBJECTS, evaluate: (await import("./rbacLogic.js")).evaluate,
  });
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
  const event = {
    EventType: "downtime.npt", TargetSystem: "mes", IdempotencyKey: "mes-1", Contract: "iiot-mes-v1",
    PayloadJson: { mesWorkCenterRef: WORK_CENTER, rigNo: "RIG-91", causeFa: "گیرکردن رشته", detectKind: "stick-slip", occurredAt: iso(0) },
  };
  await handlers.get("/api/mes/iiot-events")({ body: event, headers: { "x-user-id": "u-mfg-supervisor" }, requestId: "t" }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.reasonCode, "IIOT-STICK-SLIP");
  const logs = await repo.list("MfgDowntimeLog", { where: [] });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].DowntimeType, "unplanned");
});

/* ═══════════════════ ج) زنجیرهٔ کامل ═══════════════════ */

test("زنجیرهٔ کامل: از نمونهٔ خام تا دستورکار نت و گزارش پروژه", async () => {
  const env = await setupBridge();
  await env.repo.patch("IotThresholdRule", env.rules.tempCritical.Id, { CmmsAssetRef: ASSET_CODE }, "test", env.rules.tempCritical.RowVersion);

  /* ۱) گیت‌وی یک دستهٔ بافرشده را پس از قطعی لینک تحویل می‌دهد. */
  const samples = series("CH-TEMP", Array(25).fill(135), { startOffsetSeconds: -60 });
  await ok(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer`, {
    params: { rigId: RIG, gatewayId: env.gateway.Id }, expect: 202,
    body: { batchNo: "BUF-E2E", capturedAt: iso(-30), samples, connectivityState: "online" },
  });
  env.clk.set(30);

  /* ۲) هشدار و سه مقصد. */
  const alerts = await env.repo.list("IotTelemetryAlert", { where: [] });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].DispatchStatus, "dispatched");

  const cmmsOrder = (await env.repo.list("CmmsWorkOrder", { where: [] }))[0];
  assert.ok(cmmsOrder, "دستورکار نت ساخته شد");
  const cmmsRequest = (await env.repo.list("CmmsWorkRequest", { where: [] }))[0];
  assert.ok(cmmsRequest, "درخواست‌کار ساخته شد");
  const mesLog = (await env.repo.list("MfgDowntimeLog", { where: [] }))[0];
  assert.ok(mesLog, "توقف در MES ثبت شد");
  const pmisEvent = (await env.repo.list("IntegrationEvent", { where: [] }))[0];
  assert.ok(pmisEvent, "رویداد پروژه ثبت شد");

  /* ۳) رفع ناهنجاری → بستن در هر دو سامانه. */
  env.clk.set(500);
  await ingest(env, series("CH-TEMP", Array(10).fill(88), { startOffsetSeconds: 480 }));
  assert.equal((await env.repo.list("CmmsAlert", { where: [] }))[0].Status, "resolved");
  assert.ok((await env.repo.list("MfgDowntimeLog", { where: [] }))[0].FinishedAt);
  assert.ok((await env.repo.list("IotRigDowntime", { where: [] }))[0].EndedAt);

  /* ۴) صف خروجی همه تحویل‌شده‌اند. */
  const events = await env.repo.list("IotIntegrationEvent", { where: [] });
  assert.ok(events.length >= 3);
  assert.ok(events.every((e) => e.Status === "dispatched"), "هیچ رویدادی در صف نمی‌ماند");
});
