/**
 * آزمون موتور قرارداد رویداد و یکپارچه‌سازی — HRM D13.
 *
 * محور: رویداد باید عکس لحظهٔ وقوع باشد، دو بار در صندوق ننشیند، و
 * وقتی ماشین دست می‌کشد آدم خبردار شود.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENT_SCHEMA_VERSION,
  EVENT_STATES,
  EVENT_STATE_FA,
  EVENT_MAX_ATTEMPTS,
  OUTBOX_STALE_WARN_HOURS,
  OUTBOX_STALE_CRIT_HOURS,
  HRM_EVENT_CATALOG,
  eventDefOf,
  validateEventPayload,
  buildEvent,
  nextDeliveryState,
  isDueForRetry,
  outboxHealth,
  reconcilePostings,
} from "./hrmLogic.js";

/* ══════════ ۱. کاتالوگ ══════════ */

test("سه رویداد با نوع یکتا تعریف شده‌اند", () => {
  assert.equal(HRM_EVENT_CATALOG.length, 3);
  const types = HRM_EVENT_CATALOG.map((e) => e.type);
  assert.equal(new Set(types).size, 3);
});

test("نام رویداد قالب دامنه.موجودیت.رخداد دارد", () => {
  /* نام باید **واقعیت رخ‌داده** را بگوید نه درخواست: رویداد به‌عنوان
   * دستور، مالکیت داده را مبهم می‌کند. */
  for (const e of HRM_EVENT_CATALOG) {
    assert.match(e.type, /^hrm\.[a-z]+\.[a-z]+$/, e.type);
    assert.match(e.type, /(posted|locked|approved)$/, `${e.type} باید زمان گذشته باشد`);
  }
});

test("هر رویداد مبدأ، مقصد و فیلد الزامی دارد", () => {
  for (const e of HRM_EVENT_CATALOG) {
    assert.equal(e.sourceModule, "d10", e.type);
    assert.ok(e.targetModule, e.type);
    assert.ok(e.required.length > 0, e.type);
    assert.ok(e.titleFa && e.descriptionFa, e.type);
    assert.equal(e.version, EVENT_SCHEMA_VERSION);
  }
});

test("هر رویداد projectId را الزامی می‌داند", () => {
  /* بدون آن، مصرف‌کننده نمی‌داند رقم به کدام پروژه تعلق دارد. */
  for (const e of HRM_EVENT_CATALOG) assert.ok(e.required.includes("projectId"), e.type);
});

test("نوع ناشناخته undefined می‌دهد نه خطا", () => {
  assert.equal(eventDefOf("hrm.nope.happened"), undefined);
});

/* ══════════ ۲. اعتبارسنجی بار ══════════ */

const LABOR = {
  projectId: "p1", periodCode: "2026-03", costAccountId: "CBS-1",
  amount: 1000, equivalentHours: 10, currency: "IRR",
};

test("بار کامل ایرادی ندارد", () => {
  assert.deepEqual(validateEventPayload("hrm.labor.posted", LABOR), []);
});

test("فیلد الزامی غایب با نامش گزارش می‌شود", () => {
  const { costAccountId, ...rest } = LABOR;
  void costAccountId;
  const v = validateEventPayload("hrm.labor.posted", rest);
  assert.equal(v.length, 1);
  assert.equal(v[0].code, "E-HRM-471");
  assert.equal(v[0].field, "costAccountId");
});

test("رشتهٔ خالی هم غایب حساب می‌شود", () => {
  assert.ok(validateEventPayload("hrm.labor.posted", { ...LABOR, currency: "" }).some((i) => i.field === "currency"));
});

test("صفر مقدار معتبری است", () => {
  /* مبلغ صفر یعنی «سهم HRM برداشته شد» — رویداد واقعی. */
  assert.deepEqual(validateEventPayload("hrm.labor.posted", { ...LABOR, amount: 0 }), []);
});

test("مبلغ منفی مجاز است ولی غیرعدد نه", () => {
  /* اصلاح رو به پایین مبلغ منفی می‌سازد. */
  assert.deepEqual(validateEventPayload("hrm.labor.posted", { ...LABOR, amount: -50 }), []);
  const bad = validateEventPayload("hrm.labor.posted", { ...LABOR, amount: "زیاد" });
  assert.ok(bad.some((i) => i.code === "E-HRM-472"));
});

test("فیلد اضافه خطا نیست", () => {
  /* مصرف‌کنندهٔ نسخهٔ قدیمی نادیده‌اش می‌گیرد؛ همین سازگاری رو به جلو
   * را ممکن می‌کند. */
  assert.deepEqual(validateEventPayload("hrm.labor.posted", { ...LABOR, futureField: 1 }), []);
});

test("نوع ناشناخته رد می‌شود", () => {
  const v = validateEventPayload("hrm.nope.happened", {});
  assert.equal(v[0].code, "E-HRM-470");
});

/* ══════════ ۳. ساخت پاکت ══════════ */

test("پاکت کامل ساخته می‌شود", () => {
  const { envelope, issues } = buildEvent({
    type: "hrm.labor.posted", projectId: "p1",
    keyParts: ["2026-03", "CBS-1"], payload: LABOR,
  });
  assert.deepEqual(issues, []);
  assert.equal(envelope.eventType, "hrm.labor.posted");
  assert.equal(envelope.sourceModule, "d10");
  assert.equal(envelope.targetModule, "d5");
  assert.equal(envelope.schemaVersion, EVENT_SCHEMA_VERSION);
  assert.ok(envelope.occurredAt);
});

test("کلید رویداد از داده ساخته می‌شود نه از زمان", () => {
  /* همان رویداد دو بار در صندوق نمی‌نشیند حتی اگر منبع دو بار
   * تولیدش کند — تنها دفاع در برابر ارسال دوباره پس از قطعی شبکه. */
  const mk = () => buildEvent({
    type: "hrm.labor.posted", projectId: "p1",
    keyParts: ["2026-03", "CBS-1"], payload: LABOR,
  }).envelope.eventKey;
  assert.equal(mk(), mk());
  assert.equal(mk(), "hrm.labor.posted:p1:2026-03:CBS-1");
});

test("کلید برای حساب یا پروژهٔ متفاوت، متفاوت است", () => {
  const k = (proj, acc) => buildEvent({
    type: "hrm.labor.posted", projectId: proj,
    keyParts: ["2026-03", acc], payload: { ...LABOR, projectId: proj, costAccountId: acc },
  }).envelope.eventKey;
  assert.notEqual(k("p1", "CBS-1"), k("p1", "CBS-2"));
  assert.notEqual(k("p1", "CBS-1"), k("p2", "CBS-1"));
});

test("بار ناقص پاکت نمی‌سازد", () => {
  /* رویداد ناقصی که در صندوق بنشیند، بارها تلاش و بارها شکست
   * می‌خورد. خطا باید جایی دیده شود که هنوز قابل اصلاح است. */
  const { envelope, issues } = buildEvent({
    type: "hrm.labor.posted", projectId: "p1", keyParts: ["x"], payload: { projectId: "p1" },
  });
  assert.equal(envelope, null);
  assert.ok(issues.length > 0);
});

test("نوع ناشناخته پاکت نمی‌سازد", () => {
  assert.equal(buildEvent({ type: "hrm.x.y", projectId: "p1", keyParts: [], payload: {} }).envelope, null);
});

test("زمان وقوع قابل تعیین است", () => {
  const e = buildEvent({
    type: "hrm.labor.posted", projectId: "p1", keyParts: ["2026-03", "CBS-1"],
    payload: LABOR, occurredAt: "2026-03-31T12:00:00Z",
  }).envelope;
  assert.equal(e.occurredAt, "2026-03-31T12:00:00Z");
});

/* ══════════ ۴. چرخهٔ تحویل ══════════ */

test("چهار وضعیت با ترجمهٔ فارسی تعریف شده‌اند", () => {
  assert.equal(EVENT_STATES.length, 4);
  for (const s of EVENT_STATES) assert.ok(EVENT_STATE_FA[s]);
});

test("تحویل موفق وضعیت را نهایی می‌کند", () => {
  const o = nextDeliveryState({ ok: true, attemptCount: 2 });
  assert.equal(o.nextStatus, "delivered");
  assert.equal(o.attemptCount, 3);
  assert.equal(o.retryAfterSec, null);
});

test("تلاش ناموفق عقب‌نشینی نمایی می‌دهد", () => {
  /* مصرف‌کنندهٔ پایین نباید با تلاش هر ثانیه بیشتر زمین بخورد. */
  assert.equal(nextDeliveryState({ ok: false, attemptCount: 0 }).retryAfterSec, 30);
  assert.equal(nextDeliveryState({ ok: false, attemptCount: 1 }).retryAfterSec, 60);
  assert.equal(nextDeliveryState({ ok: false, attemptCount: 2 }).retryAfterSec, 120);
});

test("عقب‌نشینی سقف دارد", () => {
  const o = nextDeliveryState({ ok: false, attemptCount: 3 });
  assert.ok(o.retryAfterSec <= 3600);
});

test("پس از سقف تلاش، رویداد رها می‌شود نه شکست‌خورده", () => {
  /* `failed` یعنی «دوباره تلاش می‌کنیم»، `abandoned` یعنی «ماشین دست
   * کشید، آدم باید نگاه کند». رویدادی که تا ابد `failed` بماند هرگز
   * دیده نمی‌شود. */
  const o = nextDeliveryState({ ok: false, attemptCount: EVENT_MAX_ATTEMPTS - 1 });
  assert.equal(o.nextStatus, "abandoned");
  assert.equal(o.retryAfterSec, null);
  assert.ok(o.messageFa.includes("رسیدگی دستی"));
});

test("پیام خطای مقصد در نتیجه می‌آید", () => {
  const o = nextDeliveryState({ ok: false, attemptCount: 0, errorFa: "مقصد پاسخ نداد" });
  assert.ok(o.messageFa.includes("مقصد پاسخ نداد"));
});

test("رویداد تازه بی‌درنگ آمادهٔ تلاش است", () => {
  assert.equal(isDueForRetry({ Status: "pending" }, "2026-03-01T00:00:00Z"), true);
});

test("رویداد تحویل‌شده یا رهاشده دوباره تلاش نمی‌شود", () => {
  assert.equal(isDueForRetry({ Status: "delivered" }, "2026-03-01T00:00:00Z"), false);
  assert.equal(isDueForRetry({ Status: "abandoned" }, "2026-03-01T00:00:00Z"), false);
});

test("رویداد ناموفق پیش از پایان انتظار تلاش نمی‌شود", () => {
  const row = { Status: "failed", AttemptCount: 3, OccurredAt: "2026-03-01T00:00:00Z" };
  assert.equal(isDueForRetry(row, "2026-03-01T00:00:10Z"), false, "۱۰ ثانیه از ۱۲۰ ثانیه");
  assert.equal(isDueForRetry(row, "2026-03-01T00:05:00Z"), true, "۵ دقیقه گذشته");
});

/* ══════════ ۵. سلامت صندوق ══════════ */

const NOW = "2026-03-10T12:00:00Z";
const E = (Status, OccurredAt) => ({ Status, OccurredAt });

test("صندوق خالی سبز است", () => {
  const h = outboxHealth([], NOW);
  assert.equal(h.flag, "green");
  assert.equal(h.stalenessHours, null);
});

test("رویداد تازه سبز است", () => {
  const h = outboxHealth([E("pending", "2026-03-10T11:30:00Z")], NOW);
  assert.equal(h.flag, "green");
  assert.equal(h.pending, 1);
});

test("معیار سن است نه تعداد", () => {
  /* صد رویدادِ پنج‌دقیقه‌ای سالم است؛ یک رویدادِ سه‌روزه یعنی دفتر
   * مالی سازمان سه روز عقب است. */
  const many = Array.from({ length: 100 }, () => E("pending", "2026-03-10T11:55:00Z"));
  assert.equal(outboxHealth(many, NOW).flag, "green");
  assert.equal(outboxHealth([E("pending", "2026-03-07T12:00:00Z")], NOW).flag, "red");
});

test("کهنگی در دو سطح هشدار می‌دهد", () => {
  const warn = outboxHealth([E("pending", "2026-03-10T05:00:00Z")], NOW);
  assert.ok(warn.stalenessHours >= OUTBOX_STALE_WARN_HOURS);
  assert.equal(warn.flag, "amber");

  const crit = outboxHealth([E("pending", "2026-03-09T00:00:00Z")], NOW);
  assert.ok(crit.stalenessHours >= OUTBOX_STALE_CRIT_HOURS);
  assert.equal(crit.flag, "red");
});

test("رویداد رهاشده از کهنگی مهم‌تر است", () => {
  /* ماشین دست کشیده و کسی خبر ندارد. */
  const h = outboxHealth([E("abandoned", "2026-03-10T11:59:00Z")], NOW);
  assert.equal(h.flag, "red");
  assert.ok(h.noteFa.includes("رهاشده"));
});

test("رویداد تحویل‌شده در سن قدیمی‌ترین نمی‌آید", () => {
  const h = outboxHealth([E("delivered", "2020-01-01T00:00:00Z"), E("pending", "2026-03-10T11:50:00Z")], NOW);
  assert.equal(h.delivered, 1);
  assert.equal(h.oldestPendingAt, "2026-03-10T11:50:00Z");
  assert.equal(h.flag, "green");
});

test("هر چهار وضعیت جدا شمرده می‌شوند", () => {
  const h = outboxHealth([
    E("pending", NOW), E("failed", NOW), E("abandoned", NOW), E("delivered", NOW),
  ], NOW);
  assert.equal(h.total, 4);
  assert.equal(h.pending, 1);
  assert.equal(h.failed, 1);
  assert.equal(h.abandoned, 1);
  assert.equal(h.delivered, 1);
});

/* ══════════ ۶. آشتی دو دفتر ══════════ */

const P = (period, acc, amount) => ({ PeriodCode: period, CostAccountId: acc, Amount: amount });
const EV = (period, acc, amount, Status = "delivered") => ({
  EventType: "hrm.labor.posted",
  EventKey: `hrm.labor.posted:p1:${period}:${acc}`,
  PayloadJson: JSON.stringify({ amount }),
  Status,
});

test("دفتر منطبق مشکلی ندارد", () => {
  const r = reconcilePostings([P("2026-03", "CBS-1", 1000)], [EV("2026-03", "CBS-1", 1000)]);
  assert.equal(r.matched, 1);
  assert.equal(r.issues, 0);
  assert.equal(r.rows[0].status, "matched");
});

test("هزینهٔ ثبت‌شده بدون رویداد، شکاف خاموش است", () => {
  /* دفتر داخلی رقم دارد ولی سامانهٔ بیرونی ندارد و هیچ‌کدام متوجه
   * نمی‌شوند، چون هرکدام دفتر خودش را کامل می‌بیند. */
  const r = reconcilePostings([P("2026-03", "CBS-1", 1000)], []);
  assert.equal(r.rows[0].status, "not_emitted");
  assert.ok(r.rows[0].noteFa.includes("بی‌خبر"));
  assert.equal(r.issues, 1);
});

test("مبلغ ناهمخوان گزارش می‌شود", () => {
  const r = reconcilePostings([P("2026-03", "CBS-1", 1200)], [EV("2026-03", "CBS-1", 1000)]);
  assert.equal(r.rows[0].status, "mismatch");
  assert.equal(r.rows[0].postedAmount, 1200);
  assert.equal(r.rows[0].eventAmount, 1000);
});

test("رویداد ساخته‌شدهٔ تحویل‌نشده جدا دیده می‌شود", () => {
  const r = reconcilePostings([P("2026-03", "CBS-1", 1000)], [EV("2026-03", "CBS-1", 1000, "failed")]);
  assert.equal(r.rows[0].status, "undelivered");
  assert.ok(r.rows[0].noteFa.includes(EVENT_STATE_FA.failed));
});

test("بدترین ناهمخوانی اول فهرست می‌آید", () => {
  const r = reconcilePostings(
    [P("2026-03", "A-ok", 100), P("2026-03", "B-gap", 200), P("2026-03", "C-bad", 300)],
    [EV("2026-03", "A-ok", 100), EV("2026-03", "C-bad", 999)]
  );
  assert.deepEqual(r.rows.map((x) => x.status), ["mismatch", "not_emitted", "matched"]);
});

test("رویداد نوع دیگر در آشتی نمی‌آید", () => {
  const other = { EventType: "hrm.period.locked", EventKey: "hrm.period.locked:p1:2026-03", PayloadJson: "{}", Status: "delivered" };
  const r = reconcilePostings([P("2026-03", "CBS-1", 100)], [other]);
  assert.equal(r.rows[0].status, "not_emitted");
});

test("بار خراب رویداد را بی‌مبلغ می‌کند نه می‌شکند", () => {
  const broken = { EventType: "hrm.labor.posted", EventKey: "hrm.labor.posted:p1:2026-03:CBS-1", PayloadJson: "{بد", Status: "delivered" };
  const r = reconcilePostings([P("2026-03", "CBS-1", 100)], [broken]);
  assert.equal(r.rows[0].status, "matched", "بدون مبلغ قابل مقایسه، تحویل ملاک است");
  assert.equal(r.rows[0].eventAmount, null);
});

test("دفتر خالی امن است", () => {
  const r = reconcilePostings([], []);
  assert.deepEqual(r.rows, []);
  assert.equal(r.issues, 0);
});
