/**
 * آزمون موتور همگام‌سازی میدانی و کارتابل تعارض — HRM D9.
 *
 * محور: هیچ نسخه‌ای بی‌صدا دور ریخته نمی‌شود، و هیچ ارسال دوباره‌ای
 * نفر-ساعت را دو برابر نمی‌کند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  SYNC_BATCH_MAX,
  SIGNATURE_ROLES,
  SIGNATURE_ROLE_FA,
  CONFLICT_RESOLUTIONS,
  CONFLICT_RESOLUTION_FA,
  DEVICE_STALE_WARN_DAYS,
  DEVICE_STALE_CRIT_DAYS,
  batchFingerprint,
  validateSyncBatch,
  summarizeSyncBatch,
  verifySignatureChain,
  canCloseConflict,
  deviceHealth,
} from "./hrmLogic.js";

/* ══════════ ۱. اثر انگشت دسته ══════════ */

test("اثر انگشت از محتوا ساخته می‌شود نه از زمان", () => {
  /* اگر زمان در آن بود، ارسال دوبارهٔ همان دسته اثر انگشت تازه
   * می‌ساخت و ایدمپوتنسی بی‌معنا می‌شد. */
  const a = batchFingerprint("dev-1", [{ id: "TS-1", revision: 1 }]);
  const b = batchFingerprint("dev-1", [{ id: "TS-1", revision: 1 }]);
  assert.equal(a, b);
});

test("ترتیب برگه‌ها در دسته بی‌اثر است", () => {
  /* صف دستگاه ممکن است جور دیگری مرتب شود؛ همان دسته است. */
  const items = [{ id: "TS-1", revision: 1 }, { id: "TS-2", revision: 3 }];
  assert.equal(
    batchFingerprint("dev-1", items),
    batchFingerprint("dev-1", [...items].reverse())
  );
});

test("تغییر نسخهٔ یک برگه اثر انگشت را عوض می‌کند", () => {
  /* وگرنه ویرایش برگه به‌عنوان «تکراری» رد می‌شد و کار اپراتور گم. */
  assert.notEqual(
    batchFingerprint("dev-1", [{ id: "TS-1", revision: 1 }]),
    batchFingerprint("dev-1", [{ id: "TS-1", revision: 2 }])
  );
});

test("دستگاه متفاوت اثر انگشت متفاوت دارد", () => {
  assert.notEqual(
    batchFingerprint("dev-1", [{ id: "TS-1", revision: 1 }]),
    batchFingerprint("dev-2", [{ id: "TS-1", revision: 1 }])
  );
});

test("اثر انگشت تعداد برگه را در خود دارد", () => {
  assert.ok(batchFingerprint("d", [{ id: "a" }, { id: "b" }]).endsWith("-2"));
  assert.ok(batchFingerprint("d", []).endsWith("-0"));
});

/* ══════════ ۲. اعتبارسنجی دسته ══════════ */

const OK_BATCH = { deviceId: "dev-1", items: [{ id: "TS-1", revision: 1 }] };

test("دستهٔ سالم ایرادی ندارد", () => {
  assert.deepEqual(validateSyncBatch(OK_BATCH), []);
});

test("دسته بدون شناسهٔ دستگاه رد می‌شود", () => {
  /* بدون آن، تعارض به هیچ دستگاهی قابل نسبت دادن نیست. */
  const v = validateSyncBatch({ ...OK_BATCH, deviceId: "" });
  assert.ok(v.some((x) => x.code === "E-HRM-420" && x.severity === "error"));
});

test("دستهٔ خالی رد می‌شود", () => {
  assert.ok(validateSyncBatch({ deviceId: "d", items: [] }).some((x) => x.code === "E-HRM-421"));
});

test("سقف اندازهٔ دسته رعایت می‌شود", () => {
  const big = Array.from({ length: SYNC_BATCH_MAX + 1 }, (_, i) => ({ id: `TS-${i}` }));
  const v = validateSyncBatch({ deviceId: "d", items: big });
  assert.ok(v.some((x) => x.code === "E-HRM-422"));

  const atCap = Array.from({ length: SYNC_BATCH_MAX }, (_, i) => ({ id: `TS-${i}` }));
  assert.equal(validateSyncBatch({ deviceId: "d", items: atCap }).length, 0, "دقیقاً روی سقف مجاز است");
});

test("برگهٔ بی‌شناسه رد می‌شود و شمارهٔ ردیفش گفته می‌شود", () => {
  const v = validateSyncBatch({ deviceId: "d", items: [{ id: "TS-1" }, { id: "" }] });
  const hit = v.find((x) => x.code === "E-HRM-423");
  assert.ok(hit);
  assert.equal(hit.index, 1);
});

test("شناسهٔ تکراری داخل یک دسته رد می‌شود", () => {
  /* اگر می‌پذیرفتیم، دومی روی اولی می‌نوشت و یک برگه گم می‌شد. */
  const v = validateSyncBatch({ deviceId: "d", items: [{ id: "TS-1" }, { id: "TS-1" }] });
  const hit = v.find((x) => x.code === "E-HRM-424");
  assert.ok(hit);
  assert.equal(hit.itemId, "TS-1");
});

test("شمارهٔ نسخهٔ صفر یا منفی رد می‌شود", () => {
  assert.ok(validateSyncBatch({ deviceId: "d", items: [{ id: "T", revision: 0 }] }).some((x) => x.code === "E-HRM-425"));
});

test("ساعت جلوتر از سرور هشدار است نه خطا", () => {
  /* ساعت غلط دستگاه دلیلی برای دور ریختن کار واقعی اپراتور نیست. */
  const v = validateSyncBatch({
    deviceId: "d",
    items: [{ id: "T", capturedAt: "2030-01-01T00:00:00Z" }],
    capturedAtMax: "2026-01-01T00:00:00Z",
  });
  const hit = v.find((x) => x.code === "W-HRM-426");
  assert.ok(hit);
  assert.equal(hit.severity, "warning");
  assert.equal(v.filter((x) => x.severity === "error").length, 0);
});

test("بدون سقف زمانی، زمان بررسی نمی‌شود", () => {
  const v = validateSyncBatch({ deviceId: "d", items: [{ id: "T", capturedAt: "2030-01-01T00:00:00Z" }] });
  assert.equal(v.length, 0);
});

/* ══════════ ۳. جمع‌بندی دسته ══════════ */

const OUT = (over = {}) => ({
  itemId: "TS-1", winner: "local", action: "apply_local",
  code: "W-HRM-403", ruleFa: "x", conflictRecorded: false, requiresAdjustment: false,
  ...over,
});

test("سه نوع اقدام جدا شمرده می‌شوند", () => {
  const s = summarizeSyncBatch([
    OUT({ itemId: "A", action: "apply_local" }),
    OUT({ itemId: "B", action: "keep_server" }),
    OUT({ itemId: "C", action: "create_needed" }),
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.applied, 1);
  assert.equal(s.kept, 1);
  assert.equal(s.created, 1);
});

test("برگهٔ نیازمند سند اصلاحی در فهرست مسدود می‌آید", () => {
  /* دستگاه نباید این‌ها را از صف محلی پاک کند، وگرنه کار اپراتور
   * برای همیشه گم می‌شود. */
  const s = summarizeSyncBatch([
    OUT({ itemId: "A" }),
    OUT({ itemId: "B", action: "keep_server", requiresAdjustment: true, conflictRecorded: true }),
  ]);
  assert.deepEqual(s.blockedIds, ["B"]);
  assert.equal(s.needsAdjustment, 1);
  assert.equal(s.conflicts, 1);
  assert.ok(s.messageFa.includes("سند اصلاحی"));
});

test("دستهٔ بی‌مسئله پیام آرام دارد", () => {
  const s = summarizeSyncBatch([OUT()]);
  assert.deepEqual(s.blockedIds, []);
  assert.ok(!s.messageFa.includes("سند اصلاحی"));
});

test("دستهٔ خالی امن است", () => {
  const s = summarizeSyncBatch([]);
  assert.equal(s.total, 0);
  assert.deepEqual(s.blockedIds, []);
});

/* ══════════ ۴. زنجیرهٔ امضا ══════════ */

const SIG = (role, at, ref = `sig-${role}`) => ({ role, ref, signedAt: at, signerId: `u-${role}` });

test("چهار نقش امضا با ترجمهٔ فارسی تعریف شده‌اند", () => {
  assert.equal(SIGNATURE_ROLES.length, 4);
  for (const r of SIGNATURE_ROLES) assert.ok(SIGNATURE_ROLE_FA[r]);
});

test("زنجیرهٔ کامل و مرتب پذیرفته می‌شود", () => {
  const v = verifySignatureChain(
    [SIG("foreman", "2026-01-01T08:00:00Z"), SIG("qc", "2026-01-01T10:00:00Z")],
    ["foreman", "qc"]
  );
  assert.equal(v.ok, true);
  assert.equal(v.orderOk, true);
  assert.deepEqual(v.missingRolesFa, []);
});

test("امضای غایب با نام فارسی گزارش می‌شود", () => {
  const v = verifySignatureChain([SIG("foreman", "2026-01-01T08:00:00Z")], ["foreman", "pm"]);
  assert.equal(v.ok, false);
  assert.deepEqual(v.missingRolesFa, ["مدیر پروژه"]);
  assert.ok(v.issues.some((x) => x.code === "E-HRM-433"));
});

test("امضای بدون مرجع، امضا نیست", () => {
  /* ادعای امضا با امضا یکی نیست؛ بدون مرجع چیزی قابل استناد نمانده. */
  const v = verifySignatureChain([{ role: "foreman", ref: "", signedAt: "2026-01-01T08:00:00Z" }]);
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((x) => x.code === "E-HRM-431"));
  assert.deepEqual(v.signedRoles, [], "امضای بی‌مرجع شمرده نمی‌شود");
});

test("نقش ناشناخته رد می‌شود", () => {
  const v = verifySignatureChain([SIG("mayor", "2026-01-01T08:00:00Z")], []);
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((x) => x.code === "E-HRM-430"));
});

test("ترتیب وارونهٔ امضا خطاست", () => {
  /* امضای مدیر پروژه پیش از سرپرست یعنی تأیید برگه‌ای که هنوز کسی
   * در کارگاه صحتش را تأیید نکرده بود. */
  const v = verifySignatureChain(
    [SIG("pm", "2026-01-01T08:00:00Z"), SIG("foreman", "2026-01-01T12:00:00Z")],
    ["foreman", "pm"]
  );
  assert.equal(v.orderOk, false);
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((x) => x.code === "E-HRM-434"));
});

test("امضای بدون زمان هشدار می‌گیرد ولی زنجیره را نمی‌شکند", () => {
  const v = verifySignatureChain([{ role: "foreman", ref: "sig-1" }], ["foreman"]);
  assert.equal(v.ok, true, "هشدار مانع نیست");
  assert.ok(v.issues.some((x) => x.code === "W-HRM-432"));
  assert.equal(v.orderOk, true, "ترتیبِ نبود، وارونه نیست");
});

test("امضای بی‌زمان دو بار جریمه نمی‌شود", () => {
  const v = verifySignatureChain([{ role: "foreman", ref: "s1" }, { role: "qc", ref: "s2" }], []);
  assert.equal(v.issues.filter((x) => x.code === "E-HRM-434").length, 0);
});

test("نقش الزامی پیش‌فرض فقط سرپرست است", () => {
  /* برگهٔ داخلی امضای کارفرما نمی‌خواهد؛ الزام باید ورودی باشد. */
  assert.equal(verifySignatureChain([SIG("foreman", "2026-01-01T08:00:00Z")]).ok, true);
  assert.equal(verifySignatureChain([]).ok, false);
});

test("امضای تکراری یک نقش، نقش را دوبار نمی‌شمارد", () => {
  const v = verifySignatureChain(
    [SIG("foreman", "2026-01-01T08:00:00Z", "s1"), SIG("foreman", "2026-01-01T09:00:00Z", "s2")],
    ["foreman"]
  );
  assert.deepEqual(v.signedRoles, ["foreman"]);
  assert.equal(v.ok, true);
});

/* ══════════ ۵. بستن تعارض ══════════ */

test("چهار نوع تصمیم با ترجمه تعریف شده‌اند", () => {
  assert.equal(CONFLICT_RESOLUTIONS.length, 4);
  for (const c of CONFLICT_RESOLUTIONS) assert.ok(CONFLICT_RESOLUTION_FA[c]);
});

test("تعارض باز با تصمیم معتبر بسته می‌شود", () => {
  const v = canCloseConflict({ currentStatus: "open", resolution: "server_wins" });
  assert.equal(v.ok, true);
  assert.equal(v.messageFa, CONFLICT_RESOLUTION_FA.server_wins);
});

test("تعارض بسته دوباره بسته نمی‌شود", () => {
  /* بستن دوباره یعنی پاک شدن نام تصمیم‌گیرندهٔ اول. */
  const v = canCloseConflict({ currentStatus: "resolved", resolution: "server_wins" });
  assert.equal(v.ok, false);
  assert.equal(v.code, "E-HRM-440");
});

test("نوع تصمیم ناشناخته رد می‌شود و گزینه‌ها را می‌گوید", () => {
  const v = canCloseConflict({ currentStatus: "open", resolution: "هرچی" });
  assert.equal(v.ok, false);
  assert.equal(v.code, "E-HRM-441");
  assert.equal(v.detailsFa.length, 4);
});

test("تصمیم دستی بدون دلیل رد می‌شود", () => {
  /* «بستن بی‌دلیل» با نام بهتر، همان بستن بی‌دلیل است. */
  const short = canCloseConflict({ currentStatus: "open", resolution: "manual", noteFa: "اوکی" });
  assert.equal(short.ok, false);
  assert.equal(short.code, "E-HRM-442");

  const good = canCloseConflict({ currentStatus: "open", resolution: "manual", noteFa: "با سرپرست تماس گرفتیم و نسخهٔ کاغذی بررسی شد" });
  assert.equal(good.ok, true);
});

test("تعارض قفل‌شده یا امضاشده فقط با سند اصلاحی بسته می‌شود", () => {
  /* وگرنه «حل شد» زدن، اختلاف را پنهان می‌کند بی‌آنکه چیزی اصلاح شود. */
  const cheat = canCloseConflict({ currentStatus: "open", resolution: "server_wins", requiresAdjustment: true });
  assert.equal(cheat.ok, false);
  assert.equal(cheat.code, "E-HRM-443");
  /* پیام نباید فقط «دورهٔ بسته» بگوید: دلیل غالب در عمل برگهٔ
   * امضاشده است و پیام غلط کاربر را دنبال مشکل نادرست می‌فرستد. */
  assert.ok(cheat.messageFa.includes("امضا"), cheat.messageFa);

  const ok = canCloseConflict({
    currentStatus: "open", resolution: "adjustment_raised",
    requiresAdjustment: true, adjustmentId: "ADJ-1",
  });
  assert.equal(ok.ok, true);
});

test("ادعای سند اصلاحی بدون شمارهٔ سند رد می‌شود", () => {
  const v = canCloseConflict({ currentStatus: "open", resolution: "adjustment_raised", adjustmentId: "" });
  assert.equal(v.ok, false);
  assert.equal(v.code, "E-HRM-444");
});

/* ══════════ ۶. سلامت دستگاه‌ها ══════════ */

const TODAY = "2026-03-10";
const C = (deviceId, status, detectedAt) => ({ DeviceId: deviceId, Status: status, DetectedAt: detectedAt });

test("تعارض باز دستگاه را قرمز می‌کند", () => {
  const rows = deviceHealth([C("dev-1", "open", "2026-03-10T08:00:00Z")], TODAY);
  assert.equal(rows[0].flag, "red");
  assert.equal(rows[0].openConflicts, 1);
  assert.ok(rows[0].noteFa.includes("تعارض باز"));
});

test("تعارض حل‌شده دستگاه را قرمز نمی‌کند", () => {
  const rows = deviceHealth([C("dev-1", "resolved", "2026-03-10T08:00:00Z")], TODAY);
  assert.equal(rows[0].flag, "green");
  assert.equal(rows[0].openConflicts, 0);
  assert.equal(rows[0].totalConflicts, 1);
});

test("کهنگی صف در دو سطح هشدار می‌دهد", () => {
  const warn = deviceHealth([C("d", "resolved", "2026-03-06T08:00:00Z")], TODAY);
  assert.equal(warn[0].staleDays, DEVICE_STALE_WARN_DAYS + 1);
  assert.equal(warn[0].flag, "amber");

  const crit = deviceHealth([C("d", "resolved", "2026-03-01T08:00:00Z")], TODAY);
  assert.ok(crit[0].staleDays >= DEVICE_STALE_CRIT_DAYS);
  assert.equal(crit[0].flag, "red");
  assert.ok(crit[0].noteFa.includes("هنوز به سامانه نرسیده"));
});

test("دستگاه تازه همگام‌شده سبز است", () => {
  const rows = deviceHealth([C("d", "resolved", "2026-03-10T08:00:00Z")], TODAY);
  assert.equal(rows[0].flag, "green");
  assert.equal(rows[0].noteFa, null);
});

test("دستگاه بدون تعارض هم دیده می‌شود", () => {
  /* نبودِ تعارض با نبودِ ارتباط اشتباه گرفته می‌شود؛ دستگاه ساکت
   * ممکن است یک هفته داده در جیب کسی داشته باشد. */
  const rows = deviceHealth([], TODAY, { "dev-quiet": "2026-03-01T08:00:00Z" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].deviceId, "dev-quiet");
  assert.equal(rows[0].flag, "red");
  assert.equal(rows[0].totalConflicts, 0);
});

test("زمان نامعلوم زرد است نه سبز", () => {
  const rows = deviceHealth([C("d", "resolved", "")], TODAY);
  assert.equal(rows[0].staleDays, null);
  assert.equal(rows[0].flag, "amber");
});

test("بدترین دستگاه اول فهرست می‌آید", () => {
  const rows = deviceHealth([
    C("green-1", "resolved", "2026-03-10T08:00:00Z"),
    C("red-1", "open", "2026-03-10T08:00:00Z"),
    C("amber-1", "resolved", "2026-03-05T08:00:00Z"),
  ], TODAY);
  assert.deepEqual(rows.map((r) => r.deviceId), ["red-1", "amber-1", "green-1"]);
});

test("دستگاه با تعارض بیشتر جلوتر می‌آید", () => {
  const rows = deviceHealth([
    C("a", "open", "2026-03-10T08:00:00Z"),
    C("b", "open", "2026-03-10T08:00:00Z"),
    C("b", "open", "2026-03-10T09:00:00Z"),
  ], TODAY);
  assert.equal(rows[0].deviceId, "b");
  assert.equal(rows[0].openConflicts, 2);
});

test("آخرین زمان دیده‌شدن بیشینه است نه آخرین ردیف", () => {
  const rows = deviceHealth([
    C("d", "resolved", "2026-03-09T08:00:00Z"),
    C("d", "resolved", "2026-03-02T08:00:00Z"),
  ], TODAY);
  assert.equal(rows[0].lastSeenAt, "2026-03-09T08:00:00Z");
});

test("ردیف بدون شناسهٔ دستگاه نادیده می‌ماند", () => {
  assert.deepEqual(deviceHealth([C("", "open", "2026-03-10T08:00:00Z")], TODAY), []);
});

test("فهرست خالی امن است", () => {
  assert.deepEqual(deviceHealth([], TODAY), []);
});
