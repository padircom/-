/**
 * MOD-10 / HRM D4 — آزمون موتور تایم‌شیت.
 *
 * سه چیز آزموده می‌شود که اگر بشکنند، عدد نفر-ساعت کل پروژه بی‌اعتبار
 * می‌شود: تفکیک ساعت، قفل دوره، و حل تعارض آفلاین.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  TIMESHEET_STATES, TS_STATE_FA, TS_STATE_RANK, TS_TRANSITIONS,
  tsTransition, tsNextStates, canTransition, isTsEditable,
  validateTsEntry, hasBlockingIssue, isProductiveCode,
  NON_PRODUCTIVE_CODES, ABSENCE_CODES, ATTENDANCE_FA,
  timesheetId, computeTsEntries, tsTotals,
  buildTsCostLines, tsCostSummary,
  resolveSyncConflict,
  isDateLocked, periodOf, canLockPeriod,
  validateAdjustment, effectiveHours, ADJUSTMENT_TYPE_FA,
  dailySummary,
  IRAN_LABOR_LAW,
} from "./hrmLogic.js";

/* ═══════════ ۱. ماشین حالت ═══════════ */

test("هشت حالت با برچسب فارسی", () => {
  assert.equal(TIMESHEET_STATES.length, 8);
  for (const s of TIMESHEET_STATES) assert.ok(TS_STATE_FA[s], s);
});

test("رتبهٔ اقتدار صعودی است", () => {
  assert.ok(TS_STATE_RANK.draft < TS_STATE_RANK.submitted);
  assert.ok(TS_STATE_RANK.submitted < TS_STATE_RANK.foreman_approved);
  assert.ok(TS_STATE_RANK.pm_approved < TS_STATE_RANK.posted);
  assert.ok(TS_STATE_RANK.posted < TS_STATE_RANK.locked);
  assert.equal(TS_STATE_RANK.rejected, TS_STATE_RANK.draft, "برگشتی هم‌سطح پیش‌نویس است");
});

test("هر گذار مجوز و برچسب دارد", () => {
  for (const t of TS_TRANSITIONS) {
    assert.ok(t.permission.startsWith("hrm."), `${t.from}→${t.to}`);
    assert.ok(t.labelFa.length > 3, `${t.from}→${t.to}`);
    assert.ok(TIMESHEET_STATES.includes(t.from));
    assert.ok(TIMESHEET_STATES.includes(t.to));
  }
});

test("گیت کیفیت قابل دور زدن است ولی گیت سرپرست نه", () => {
  /* در پروژه‌های کوچک QC جدا وجود ندارد؛ ولی امضای سرپرست همیشه لازم است. */
  assert.ok(tsTransition("foreman_approved", "pm_approved"), "پرش از QC مجاز است");
  assert.equal(tsTransition("submitted", "pm_approved"), undefined, "پرش از سرپرست ممنوع است");
  assert.equal(tsTransition("draft", "posted"), undefined);
});

test("گذار تعریف‌نشده رد می‌شود", () => {
  const r = canTransition({ from: "draft", to: "locked", entryCount: 3 });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-110");
  assert.ok(r.messageFa.includes("پیش‌نویس"), "پیام باید فارسی و گویا باشد");
});

test("برگهٔ بی‌ردیف ارسال نمی‌شود", () => {
  const r = canTransition({ from: "draft", to: "submitted", entryCount: 0 });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-111");
});

test("تأیید سرپرست بدون امضا رد می‌شود", () => {
  const bad = canTransition({ from: "submitted", to: "foreman_approved", entryCount: 5 });
  assert.equal(bad.code, "E-HRM-112");
  const ok = canTransition({ from: "submitted", to: "foreman_approved", entryCount: 5, hasForemanSignature: true });
  assert.equal(ok.ok, true);
});

test("دورهٔ قفل هیچ گذاری نمی‌پذیرد", () => {
  const r = canTransition({ from: "draft", to: "submitted", entryCount: 3, isPeriodLocked: true });
  assert.equal(r.code, "E-HRM-103");
});

test("قفل پیش از امضا بررسی می‌شود", () => {
  /* اگر ترتیب برعکس بود، کاربر پیام «امضا لازم است» می‌گرفت و پس از
     امضا گرفتن تازه می‌فهمید دوره بسته است. */
  const r = canTransition({ from: "submitted", to: "foreman_approved", entryCount: 3, isPeriodLocked: true });
  assert.equal(r.code, "E-HRM-103");
});

test("فقط پیش‌نویس و برگشتی ویرایش‌پذیرند", () => {
  assert.equal(isTsEditable("draft"), true);
  assert.equal(isTsEditable("rejected"), true);
  assert.equal(isTsEditable("submitted"), false);
  assert.equal(isTsEditable("posted"), false);
});

test("گذارهای بعدی برای ساخت دکمه‌ها", () => {
  const next = tsNextStates("submitted").map((t) => t.to);
  assert.deepEqual(next.sort(), ["foreman_approved", "rejected"]);
  assert.equal(tsNextStates("locked").length, 0, "قفل، پایان راه است");
});

/* ═══════════ ۲. اعتبارسنجی ردیف ═══════════ */

const OK_ENTRY = { personId: "P1", tradeCode: "CIV-RBR", activityId: "A-1", cbsId: "CBS-1", hoursRaw: 8 };

test("ردیف سالم ایرادی ندارد", () => {
  assert.deepEqual(validateTsEntry(OK_ENTRY), []);
});

test("ساعت بدون فعالیت رد می‌شود", () => {
  const i = validateTsEntry({ ...OK_ENTRY, activityId: undefined });
  assert.ok(i.some((x) => x.code === "E-HRM-101"));
  assert.equal(hasBlockingIssue(i), true);
});

test("ساعت بدون حساب هزینه رد می‌شود", () => {
  const i = validateTsEntry({ ...OK_ENTRY, cbsId: undefined });
  assert.ok(i.some((x) => x.code === "E-HRM-105"));
});

test("فعالیت ناشناخته رد می‌شود", () => {
  const i = validateTsEntry(OK_ENTRY, { validActivityIds: ["A-9"] });
  assert.ok(i.some((x) => x.code === "E-HRM-101" && x.messageFa.includes("A-1")));
});

test("حساب هزینهٔ بسته رد می‌شود", () => {
  const i = validateTsEntry(OK_ENTRY, { openCbsIds: ["CBS-9"] });
  assert.ok(i.some((x) => x.code === "E-HRM-105"));
});

test("نفر بدون انتصاب فعال رد می‌شود", () => {
  const i = validateTsEntry(OK_ENTRY, { assignedPersonIds: ["P2"] });
  assert.ok(i.some((x) => x.code === "E-HRM-104"));
});

test("مدرک منقضی و نبود پاکسازی ایمنی ثبت را می‌بندند", () => {
  assert.ok(validateTsEntry(OK_ENTRY, { blockedPersonIds: ["P1"] }).some((x) => x.code === "E-HRM-201"));
  assert.ok(validateTsEntry(OK_ENTRY, { unclearedPersonIds: ["P1"] }).some((x) => x.code === "E-HRM-202"));
});

test("سقف مطلق روی جمع همهٔ برگه‌های همان روز سنجیده می‌شود", () => {
  /* بدون این، ثبت ۱۰+۱۰ ساعت در دو برگه از سقف ۱۶ ساعت رد می‌شد. */
  const i = validateTsEntry({ ...OK_ENTRY, hoursRaw: 10 }, { priorHoursByPerson: { P1: 10 } });
  const cap = i.find((x) => x.code === "E-HRM-102");
  assert.ok(cap, "سقف مطلق باید فعال شود");
  assert.ok(cap.messageFa.includes("20"), "پیام باید جمع واقعی را بگوید");
});

test("عبور از سقف اضافه‌کاری هشدار است نه خطا", () => {
  const i = validateTsEntry({ ...OK_ENTRY, hoursRaw: 14 });
  const w = i.find((x) => x.code === "W-HRM-301");
  assert.ok(w);
  assert.equal(w.severity, "warning");
  assert.equal(hasBlockingIssue(i), false, "شیفت فوق‌العاده واقعی است و نباید مسدود شود");
});

test("غیبت با ساعت کارکرد ناسازگار است", () => {
  const i = validateTsEntry({ ...OK_ENTRY, attendanceCode: "absent", hoursRaw: 8 });
  assert.ok(i.some((x) => x.code === "E-HRM-106"));
});

test("مرخصی بدون ساعت پذیرفته می‌شود", () => {
  const i = validateTsEntry({ personId: "P1", attendanceCode: "leave", hoursRaw: 0 });
  assert.deepEqual(i, [], "مرخصی فعالیت و حساب هزینه لازم ندارد");
});

test("ساعت صفر برای حاضر رد می‌شود", () => {
  const i = validateTsEntry({ ...OK_ENTRY, hoursRaw: 0 });
  assert.ok(i.some((x) => x.code === "E-HRM-107"));
});

test("کمیت بدون واحد هشدار می‌گیرد", () => {
  const i = validateTsEntry({ ...OK_ENTRY, qtyDone: 12 });
  assert.ok(i.some((x) => x.code === "W-HRM-302" && x.severity === "warning"));
});

test("ردیف بدون نفر زودتر برمی‌گردد", () => {
  const i = validateTsEntry({ hoursRaw: 8 });
  assert.equal(i.length, 1, "وقتی نفر نیست بقیهٔ بررسی‌ها بی‌معنا هستند");
  assert.equal(i[0].code, "E-HRM-100");
});

test("دورهٔ قفل ثبت ردیف را می‌بندد", () => {
  const i = validateTsEntry(OK_ENTRY, { isPeriodLocked: true });
  assert.ok(i.some((x) => x.code === "E-HRM-103"));
});

test("کد بی‌کاری اجباری، ساعت دارد ولی مولد نیست", () => {
  for (const c of NON_PRODUCTIVE_CODES) assert.equal(isProductiveCode(c), false, c);
  for (const c of ABSENCE_CODES) assert.equal(isProductiveCode(c), false, c);
  assert.equal(isProductiveCode("present"), true);
  assert.equal(isProductiveCode("mission"), true, "مأموریت کار مولد است");
  for (const k of Object.keys(ATTENDANCE_FA)) assert.ok(ATTENDANCE_FA[k].length > 1, k);
});

/* ═══════════ ۳. تفکیک ساعت ═══════════ */

test("شناسهٔ برگه قطعی و تکرارپذیر است", () => {
  const a = timesheetId({ projectId: "p1", crewId: "CR01", workDate: "2026-03-15", shift: "day" });
  const b = timesheetId({ projectId: "p1", crewId: "CR01", workDate: "2026-03-15", shift: "day" });
  assert.equal(a, b, "دستگاه آفلاین باید همان شناسه را بسازد");
  assert.notEqual(a, timesheetId({ projectId: "p1", crewId: "CR01", workDate: "2026-03-15", shift: "night" }));
  assert.ok(a.includes("20260315"));
});

test("ساعت یک نفر روی دو فعالیت انباشتی تفکیک می‌شود", () => {
  /* اگر هر ردیف مستقل حساب می‌شد، هر دو ۶ ساعت عادی می‌گرفتند و
     ۴ ساعت اضافه‌کاری ناپدید می‌شد. */
  const rows = computeTsEntries(
    [{ ...OK_ENTRY, hoursRaw: 6 }, { ...OK_ENTRY, activityId: "A-2", hoursRaw: 6 }],
    { workDate: "2026-03-16" }
  );
  assert.equal(rows[0].hoursNormal, 6);
  assert.equal(rows[0].hoursOt, 0);
  assert.equal(rows[1].hoursNormal, 2, "فقط ۲ ساعت تا سقف عادی مانده بود");
  assert.equal(rows[1].hoursOt, 4);
});

test("دو نفر مستقل از هم تفکیک می‌شوند", () => {
  const rows = computeTsEntries(
    [{ ...OK_ENTRY, hoursRaw: 8 }, { ...OK_ENTRY, personId: "P2", hoursRaw: 8 }],
    { workDate: "2026-03-16" }
  );
  assert.equal(rows[0].hoursNormal, 8);
  assert.equal(rows[1].hoursNormal, 8, "ساعت نفر اول نباید روی نفر دوم اثر بگذارد");
});

test("ساعت قبلی از برگهٔ دیگر لحاظ می‌شود", () => {
  const rows = computeTsEntries([{ ...OK_ENTRY, hoursRaw: 4 }], {
    workDate: "2026-03-16", priorHoursByPerson: { P1: 8 },
  });
  assert.equal(rows[0].hoursNormal, 0);
  assert.equal(rows[0].hoursOt, 4);
});

test("سقف مطلق ساعت مازاد را رد می‌کند", () => {
  const rows = computeTsEntries([{ ...OK_ENTRY, hoursRaw: 20 }], { workDate: "2026-03-16" });
  assert.equal(rows[0].hoursRejected, 4, "۲۰ منهای سقف ۱۶");
});

test("روز تعطیل کل ساعت را تعطیل‌کاری می‌کند", () => {
  const rows = computeTsEntries([{ ...OK_ENTRY, hoursRaw: 8 }], {
    workDate: "2026-03-20", holidays: ["2026-03-20"],
  });
  assert.equal(rows[0].hoursHoliday, 8);
  assert.equal(rows[0].hoursNormal, 0);
});

test("شیفت شب علامت می‌خورد", () => {
  const rows = computeTsEntries([{ ...OK_ENTRY, hoursRaw: 8 }], { workDate: "2026-03-16", shift: "night" });
  assert.equal(rows[0].hoursNight, 8);
  assert.equal(rows[0].hoursNormal, 8, "شب جایگزین عادی نیست، ضریب اضافه است");
});

test("مرخصی ساعت صفر می‌گیرد و مولد نیست", () => {
  const rows = computeTsEntries([{ personId: "P1", attendanceCode: "leave", hoursRaw: 0 }], { workDate: "2026-03-16" });
  assert.equal(rows[0].hoursNormal, 0);
  assert.equal(rows[0].isProductive, false);
});

test("آماده‌به‌کار ساعت دارد ولی مولد نیست", () => {
  const rows = computeTsEntries([{ ...OK_ENTRY, attendanceCode: "standby", hoursRaw: 8 }], { workDate: "2026-03-16" });
  assert.equal(rows[0].hoursNormal, 8, "ساعت واقعی است و پول دارد");
  assert.equal(rows[0].isProductive, false, "ولی کار مولد نیست");
});

/* ═══════════ ۴. جمع‌ها ═══════════ */

test("جمع برگه شامل نفرات یکتا است", () => {
  const rows = computeTsEntries(
    [{ ...OK_ENTRY, hoursRaw: 8 }, { ...OK_ENTRY, activityId: "A-2", hoursRaw: 2 }, { ...OK_ENTRY, personId: "P2", hoursRaw: 8 }],
    { workDate: "2026-03-16" }
  );
  const t = tsTotals(rows);
  assert.equal(t.headcount, 2, "یک نفر با دو ردیف، یک نفر است");
  assert.equal(t.raw, 18);
  assert.equal(t.normal, 16);
  assert.equal(t.ot, 2);
});

test("درصد زمان تلف‌شده از ساعت حاضر محاسبه می‌شود", () => {
  const rows = computeTsEntries(
    [{ ...OK_ENTRY, hoursRaw: 6 }, { ...OK_ENTRY, personId: "P2", attendanceCode: "weather_delay", hoursRaw: 2 }],
    { workDate: "2026-03-16" }
  );
  const t = tsTotals(rows);
  assert.equal(t.productiveHours, 6);
  assert.equal(t.lostHours, 2);
  assert.equal(t.lostTimePct, 25);
});

test("برگهٔ خالی درصد ندارد نه صفر", () => {
  const t = tsTotals([]);
  assert.equal(t.lostTimePct, null, "صفر یعنی اندازه‌گیری شد؛ اینجا چیزی نبود");
  assert.equal(t.headcount, 0);
});

/* ═══════════ ۵. هزینه ═══════════ */

const RATE = (trade) => ({ "CIV-RBR": 100, "WLD-6G": 200 })[trade] ?? null;

test("خطوط هزینه بر پایهٔ حساب × فعالیت × رسته تجمیع می‌شوند", () => {
  const rows = computeTsEntries(
    [
      { ...OK_ENTRY, hoursRaw: 8 },
      { ...OK_ENTRY, personId: "P2", hoursRaw: 8 },
      { ...OK_ENTRY, personId: "P3", tradeCode: "WLD-6G", hoursRaw: 8 },
    ],
    { workDate: "2026-03-16" }
  );
  const lines = buildTsCostLines(rows, RATE);
  assert.equal(lines.length, 2, "دو رستهٔ متفاوت، دو خط");
  const civ = lines.find((l) => l.tradeCode === "CIV-RBR");
  assert.equal(civ.hoursNormal, 16);
  assert.equal(civ.amount, 1600);
});

test("اضافه‌کاری با ضریب قانون کار مبلغ می‌گیرد", () => {
  const rows = computeTsEntries([{ ...OK_ENTRY, hoursRaw: 10 }], { workDate: "2026-03-16" });
  const [line] = buildTsCostLines(rows, RATE);
  /* ۸ عادی + ۲ اضافه × ۱٫۴ = ۱۰٫۸ ساعت مؤثر */
  assert.equal(line.equivalentHours, 10.8);
  assert.equal(line.amount, 1080);
});

test("شیفت شب فقط تفاوت ضریب را اضافه می‌کند", () => {
  const rows = computeTsEntries([{ ...OK_ENTRY, hoursRaw: 8 }], { workDate: "2026-03-16", shift: "night" });
  const [line] = buildTsCostLines(rows, RATE);
  /* ۸ عادی + ۸ × (۱٫۳۵ − ۱) = ۱۰٫۸ — نه ۸ × ۱٫۳۵ + ۸ */
  assert.equal(line.equivalentHours, 10.8);
});

test("ردیف بدون نرخ حذف نمی‌شود بلکه علامت می‌خورد", () => {
  /* ساعت گم‌شده بدتر از مبلغ نامعلوم است. */
  const rows = computeTsEntries([{ ...OK_ENTRY, tradeCode: "GHOST", hoursRaw: 8 }], { workDate: "2026-03-16" });
  const [line] = buildTsCostLines(rows, RATE);
  assert.equal(line.missingRate, true);
  assert.equal(line.amount, null);
  assert.equal(line.hoursNormal, 8, "ساعت باید بماند");
});

test("خلاصهٔ هزینه ساعت بی‌نرخ را جدا گزارش می‌کند", () => {
  const rows = computeTsEntries(
    [{ ...OK_ENTRY, hoursRaw: 8 }, { ...OK_ENTRY, personId: "P2", tradeCode: "GHOST", hoursRaw: 8 }],
    { workDate: "2026-03-16" }
  );
  const s = tsCostSummary(buildTsCostLines(rows, RATE));
  assert.equal(s.totalAmount, 800);
  assert.equal(s.unpricedHours, 8);
  assert.equal(s.isComplete, false, "سند ناقص نباید کامل به نظر برسد");
});

test("ردیف بدون فعالیت وارد هزینه نمی‌شود", () => {
  const rows = computeTsEntries([{ ...OK_ENTRY, activityId: undefined, hoursRaw: 8 }], { workDate: "2026-03-16" });
  assert.equal(buildTsCostLines(rows, RATE).length, 0);
});

/* ═══════════ ۶. حل تعارض ═══════════ */

test("دورهٔ قفل‌شده نسخهٔ محلی را قطعی رد می‌کند", () => {
  const v = resolveSyncConflict(
    { status: "locked", revision: 5 },
    { status: "foreman_approved", revision: 9, capturedAt: "2026-03-17T10:00:00Z" }
  );
  assert.equal(v.winner, "server");
  assert.equal(v.code, "E-HRM-103");
  assert.equal(v.requiresAdjustment, true);
});

test("نسخهٔ امضاشدهٔ سرور با همگام‌سازی بازنویسی نمی‌شود", () => {
  const v = resolveSyncConflict(
    { status: "pm_approved", revision: 3 },
    { status: "draft", revision: 7, capturedAt: "2026-03-18T08:00:00Z" }
  );
  assert.equal(v.winner, "server", "شمارندهٔ بالاتر محلی نباید تأیید را پاک کند");
  assert.equal(v.requiresAdjustment, true);
  assert.equal(v.needsConflictRecord, true);
});

test("سرور ارسال‌شده در برابر پیش‌نویس محلی برنده است ولی محلی ثبت می‌شود", () => {
  const v = resolveSyncConflict(
    { status: "submitted", revision: 2 },
    { status: "draft", revision: 3, capturedAt: "2026-03-18T09:00:00Z" }
  );
  assert.equal(v.winner, "server");
  assert.equal(v.needsConflictRecord, true, "کار اپراتور نباید بی‌صدا دور ریخته شود");
  assert.equal(v.requiresAdjustment, false);
});

test("محلیِ قوی‌تر اعمال می‌شود", () => {
  const v = resolveSyncConflict(
    { status: "draft", revision: 1 },
    { status: "foreman_approved", revision: 2, capturedAt: "2026-03-18T12:00:00Z" }
  );
  assert.equal(v.winner, "local", "اپراتور در کارگاه امضا گرفته است");
});

test("میان دو پیش‌نویس، امضا بر زمان مقدم است", () => {
  const v = resolveSyncConflict(
    { status: "draft", revision: 1, capturedAt: "2026-03-18T18:00:00Z", hasForemanSignature: false },
    { status: "draft", revision: 1, capturedAt: "2026-03-18T08:00:00Z", hasForemanSignature: true }
  );
  assert.equal(v.winner, "local");
  assert.equal(v.code, "W-HRM-404");
});

test("دو پیش‌نویس بی‌امضا: تازه‌ترین برنده", () => {
  const v = resolveSyncConflict(
    { status: "draft", revision: 1, capturedAt: "2026-03-18T08:00:00Z" },
    { status: "draft", revision: 1, capturedAt: "2026-03-18T18:00:00Z" }
  );
  assert.equal(v.winner, "local");
  assert.equal(v.needsConflictRecord, false, "این تعارض واقعی نیست");
});

test("دو نسخهٔ یکسان کاری لازم ندارند", () => {
  const same = { status: "draft", revision: 4, capturedAt: "2026-03-18T08:00:00Z" };
  const v = resolveSyncConflict(same, { ...same });
  assert.equal(v.winner, "none");
  assert.equal(v.needsConflictRecord, false);
});

test("همهٔ احکام تعارض دلیل فارسی دارند", () => {
  const cases = [
    [{ status: "locked", revision: 1 }, { status: "draft", revision: 1 }],
    [{ status: "qc_verified", revision: 1 }, { status: "draft", revision: 1 }],
    [{ status: "submitted", revision: 1 }, { status: "draft", revision: 1 }],
    [{ status: "draft", revision: 1 }, { status: "submitted", revision: 2 }],
    [{ status: "draft", revision: 1 }, { status: "draft", revision: 2 }],
  ];
  for (const [s, l] of cases) {
    const v = resolveSyncConflict(s, l);
    assert.ok(v.ruleFa.length > 15, `${s.status}/${l.status}: دلیل کوتاه است`);
    assert.ok(v.code, "کد لازم است");
  }
});

/* ═══════════ ۷. قفل دوره ═══════════ */

test("کد دوره از تاریخ استخراج می‌شود", () => {
  assert.equal(periodOf("1404-06-19"), "1404-06");
  assert.equal(periodOf("2026-03-16"), "2026-03");
});

test("قفل باز شده دیگر قفل نیست", () => {
  const locks = [{ PeriodCode: "1404-06", UnlockedAt: null }, { PeriodCode: "1404-05", UnlockedAt: "1404-06-01" }];
  assert.equal(isDateLocked("1404-06-10", locks), true);
  assert.equal(isDateLocked("1404-05-10", locks), false, "دورهٔ بازگشایی‌شده قفل نیست");
  assert.equal(isDateLocked("1404-07-10", locks), false);
});

test("دوره با برگهٔ تأییدنشده بسته نمی‌شود", () => {
  const r = canLockPeriod([{ Status: "posted" }, { Status: "draft" }]);
  assert.equal(r.canLock, false);
  assert.equal(r.code, "E-HRM-121");
  assert.equal(r.pendingCount, 1);
  assert.ok(r.messageFa.includes("1"), "تعداد باید در پیام بیاید");
});

test("دورهٔ بدون برگه بسته نمی‌شود", () => {
  const r = canLockPeriod([]);
  assert.equal(r.canLock, false);
  assert.equal(r.code, "E-HRM-120");
});

test("دوره با همهٔ برگه‌های ارسال‌شده قابل بستن است", () => {
  const r = canLockPeriod([{ Status: "posted" }, { Status: "locked" }]);
  assert.equal(r.canLock, true);
  assert.equal(r.postedCount, 2);
});

/* ═══════════ ۸. سند اصلاحی ═══════════ */

test("سه نوع اصلاح با برچسب فارسی", () => {
  for (const t of ["reverse", "reclass", "hours_correction"]) assert.ok(ADJUSTMENT_TYPE_FA[t]);
});

test("دلیل کوتاه پذیرفته نمی‌شود", () => {
  const i = validateAdjustment(
    { adjustmentType: "hours_correction", deltaHours: -2, reasonTextFa: "اشتباه" },
    { originalHours: 8 }
  );
  assert.ok(i.some((x) => x.code === "E-HRM-131"), "«اشتباه» دلیل نیست");
});

test("اصلاح نمی‌تواند ساعت را منفی کند", () => {
  const i = validateAdjustment(
    { adjustmentType: "hours_correction", deltaHours: -10, reasonTextFa: "ثبت اشتباه ساعت اپراتور شیفت شب" },
    { originalHours: 8 }
  );
  const e = i.find((x) => x.code === "E-HRM-134");
  assert.ok(e);
  assert.ok(e.messageFa.includes("-2"), "پیام باید عدد نهایی را نشان دهد");
});

test("ابطال باید دقیقاً به صفر برساند", () => {
  const bad = validateAdjustment(
    { adjustmentType: "reverse", deltaHours: -5, reasonTextFa: "برگه به اشتباه برای اکیپ دیگری ثبت شده بود" },
    { originalHours: 8 }
  );
  assert.ok(bad.some((x) => x.code === "E-HRM-132"));
  const ok = validateAdjustment(
    { adjustmentType: "reverse", deltaHours: -8, reasonTextFa: "برگه به اشتباه برای اکیپ دیگری ثبت شده بود" },
    { originalHours: 8 }
  );
  assert.deepEqual(ok, []);
});

test("ابطال، اصلاحیه‌های قبلی را هم لحاظ می‌کند", () => {
  const ok = validateAdjustment(
    { adjustmentType: "reverse", deltaHours: -6, reasonTextFa: "ابطال کامل ردیف پس از اصلاح قبلی" },
    { originalHours: 8, existingDelta: -2 }
  );
  assert.deepEqual(ok, [], "۸ − ۲ = ۶ باید ابطال شود نه ۸");
});

test("تغییر مقصد هزینه، ساعت را عوض نمی‌کند", () => {
  const bad = validateAdjustment(
    { adjustmentType: "reclass", deltaHours: 2, newCbsId: "CBS-9", reasonTextFa: "شارژ اشتباه به حساب هزینهٔ منطقهٔ دیگر" },
    { originalHours: 8 }
  );
  assert.ok(bad.some((x) => x.code === "E-HRM-135"));
});

test("تغییر مقصد بدون مقصد جدید بی‌معناست", () => {
  const i = validateAdjustment(
    { adjustmentType: "reclass", deltaHours: 0, reasonTextFa: "شارژ اشتباه به حساب هزینهٔ منطقهٔ دیگر" },
    { originalHours: 8 }
  );
  assert.ok(i.some((x) => x.code === "E-HRM-136"));
});

test("نوع اصلاح ناشناخته رد می‌شود", () => {
  const i = validateAdjustment(
    { adjustmentType: "delete", deltaHours: 0, reasonTextFa: "حذف کامل ردیف اشتباه از سیستم" },
    { originalHours: 8 }
  );
  assert.ok(i.some((x) => x.code === "E-HRM-130"));
});

test("ساعت مؤثر فقط اصلاحیه‌های تأییدشده را می‌شمارد", () => {
  const h = effectiveHours(8, [
    { DeltaHours: -2, Status: "approved" },
    { DeltaHours: -3, Status: "draft" },
  ]);
  assert.equal(h, 6, "پیش‌نویس نباید عدد را عوض کند");
});

test("ساعت مؤثر هرگز منفی نمی‌شود", () => {
  assert.equal(effectiveHours(8, [{ DeltaHours: -20, Status: "approved" }]), 0);
});

/* ═══════════ ۹. خلاصهٔ روزانه ═══════════ */

test("خلاصهٔ روزانه نفرات یکتا و برگه‌های معطل را می‌شمارد", () => {
  const s = dailySummary(
    "1404-06-19",
    [
      { Status: "pm_approved", TotalHoursRaw: 80, TotalHoursOt: 8 },
      { Status: "draft", TotalHoursRaw: 40, TotalHoursOt: 0 },
    ],
    [
      { PersonId: "P1", HoursRaw: 8, IsProductive: true },
      { PersonId: "P1", HoursRaw: 2, IsProductive: true },
      { PersonId: "P2", HoursRaw: 8, IsProductive: false },
    ]
  );
  assert.equal(s.headerCount, 2);
  assert.equal(s.headcount, 2);
  assert.equal(s.pendingCount, 1, "پیش‌نویس جلوی بستن دوره را می‌گیرد");
  assert.equal(s.totalHours, 120);
  assert.equal(s.otPct, 6.67);
  assert.equal(s.lostHours, 8);
  assert.equal(s.byStatus.draft, 1);
});

test("بولین صفر و یک از JSON درست خوانده می‌شود", () => {
  const s = dailySummary("1404-06-19", [], [
    { PersonId: "P1", HoursRaw: 8, IsProductive: 0 },
    { PersonId: "P2", HoursRaw: 8, IsProductive: 1 },
  ]);
  assert.equal(s.lostHours, 8);
  assert.equal(s.productiveHours, 8);
});

test("روز بی‌داده درصد ندارد", () => {
  const s = dailySummary("1404-06-19", [], []);
  assert.equal(s.lostTimePct, null);
  assert.equal(s.otPct, null);
});

test("قانون کار ایران دست‌نخورده مانده است", () => {
  /* موتور D4 روی این اعداد بنا شده؛ تغییرشان یعنی بازمحاسبهٔ همه‌چیز. */
  assert.equal(IRAN_LABOR_LAW.dailyNormalCap, 8);
  assert.equal(IRAN_LABOR_LAW.dailyAbsoluteCap, 16);
  assert.equal(IRAN_LABOR_LAW.otFactor, 1.4);
});
