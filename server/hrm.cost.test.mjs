/**
 * آزمون موتور ارسال هزینهٔ نیرو به مالی — HRM D12.
 *
 * محور: ارسال دوباره نباید رقم را متورم کند، ساعت بدون نرخ نباید گم
 * شود، و هزینهٔ فروردین باید با نرخ فروردین حساب شود.
 *
 * دامنه: نرخ × ساعت. فیش حقوقی و بیمه در دامنهٔ این سامانه نیست.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  rateCardFor,
  rateLookupFrom,
  buildLaborPostings,
  laborPostingGate,
  applyLaborPosting,
  laborEventKey,
} from "./hrmLogic.js";

/* ══════════ ۱. انتخاب نرخ ══════════ */

const CARD = (over = {}) => ({
  TradeCode: "CIV-RBR", Grade: null, HourlyRate: 100, Currency: "IRR",
  EffectiveFrom: "2026-01-01", EffectiveTo: null, Status: "active", ...over,
});

test("نرخ معتبر در تاریخ پیدا می‌شود", () => {
  assert.equal(rateCardFor([CARD()], "CIV-RBR", "2026-03-15").HourlyRate, 100);
});

test("هزینهٔ فروردین با نرخ فروردین حساب می‌شود", () => {
  /* اگر همیشه آخرین نرخ برداشته می‌شد، هر افزایش دستمزد کل تاریخ
   * هزینهٔ پروژه را بازنویسی می‌کرد و مقایسهٔ دوره‌ها بی‌معنا می‌شد. */
  const cards = [
    CARD({ HourlyRate: 100, EffectiveFrom: "2026-01-01", EffectiveTo: "2026-03-31" }),
    CARD({ HourlyRate: 150, EffectiveFrom: "2026-04-01" }),
  ];
  assert.equal(rateCardFor(cards, "CIV-RBR", "2026-02-10").HourlyRate, 100);
  assert.equal(rateCardFor(cards, "CIV-RBR", "2026-05-10").HourlyRate, 150);
});

test("نرخ پیش از تاریخ اثر برداشته نمی‌شود", () => {
  assert.equal(rateCardFor([CARD({ EffectiveFrom: "2026-06-01" })], "CIV-RBR", "2026-01-01"), null);
});

test("نرخ منقضی برداشته نمی‌شود", () => {
  assert.equal(rateCardFor([CARD({ EffectiveTo: "2026-02-01" })], "CIV-RBR", "2026-05-01"), null);
});

test("کارت غیرفعال نادیده می‌ماند", () => {
  assert.equal(rateCardFor([CARD({ Status: "archived" })], "CIV-RBR", "2026-03-01"), null);
});

test("رستهٔ دیگر برداشته نمی‌شود", () => {
  assert.equal(rateCardFor([CARD()], "CIV-FRM", "2026-03-01"), null);
});

test("میان نسخه‌های هم‌زمان، تازه‌ترین شروع برنده است", () => {
  const cards = [
    CARD({ HourlyRate: 100, EffectiveFrom: "2026-01-01" }),
    CARD({ HourlyRate: 120, EffectiveFrom: "2026-02-01" }),
  ];
  assert.equal(rateCardFor(cards, "CIV-RBR", "2026-03-01").HourlyRate, 120);
});

test("درجهٔ خواسته‌شده بر کارت عمومی مقدم است", () => {
  const cards = [CARD({ HourlyRate: 100 }), CARD({ Grade: "S1", HourlyRate: 180 })];
  assert.equal(rateCardFor(cards, "CIV-RBR", "2026-03-01", "S1").HourlyRate, 180);
});

test("درجهٔ تعریف‌نشده به کارت عمومی برمی‌گردد", () => {
  /* وگرنه یک درجهٔ ثبت‌نشده کل ردیف را بی‌نرخ می‌کرد. */
  const cards = [CARD({ HourlyRate: 100 })];
  assert.equal(rateCardFor(cards, "CIV-RBR", "2026-03-01", "S9").HourlyRate, 100);
});

test("درخواست بدون درجه، کارت درجه‌دار را برنمی‌دارد", () => {
  assert.equal(rateCardFor([CARD({ Grade: "S1" })], "CIV-RBR", "2026-03-01"), null);
});

test("جست‌وجوگر نرخ صفر و منفی را null می‌دهد", () => {
  /* نرخ صفر یعنی «ثبت نشده»، نه «رایگان». */
  const look = rateLookupFrom([CARD({ HourlyRate: 0 })], "2026-03-01");
  assert.equal(look("CIV-RBR"), null);
  assert.equal(rateLookupFrom([CARD({ HourlyRate: 90 })], "2026-03-01")("CIV-RBR"), 90);
});

test("فهرست خالی کارت null می‌دهد نه خطا", () => {
  assert.equal(rateCardFor([], "CIV-RBR", "2026-03-01"), null);
  assert.equal(rateLookupFrom([], "2026-03-01")("CIV-RBR"), null);
});

/* ══════════ ۲. تجمیع به حساب هزینه ══════════ */

const L = (over = {}) => ({
  cbsId: "CBS-1", activityId: "A-1", tradeCode: "CIV-RBR",
  hoursNormal: 8, hoursOt: 0, hoursNight: 0, hoursHoliday: 0,
  equivalentHours: 8, hourlyRate: 100, amount: 800, missingRate: false, ...over,
});

test("خطوط یک حساب در یک سطر جمع می‌شوند", () => {
  const p = buildLaborPostings({ periodCode: "2026-03", lines: [L(), L({ activityId: "A-2" })] });
  assert.equal(p.lines.length, 1);
  assert.equal(p.lines[0].amount, 1600);
  assert.equal(p.lines[0].equivalentHours, 16);
});

test("حساب‌های متفاوت جدا می‌مانند", () => {
  const p = buildLaborPostings({ periodCode: "2026-03", lines: [L(), L({ cbsId: "CBS-2" })] });
  assert.equal(p.lines.length, 2);
  assert.equal(p.totalAmount, 1600);
});

test("سطر با مبلغ بیشتر اول می‌آید", () => {
  const p = buildLaborPostings({
    periodCode: "2026-03",
    lines: [L({ cbsId: "CBS-S", amount: 100, equivalentHours: 1 }), L({ cbsId: "CBS-B", amount: 900 })],
  });
  assert.equal(p.lines[0].costAccountId, "CBS-B");
});

test("ساعت بدون حساب هزینه گم نمی‌شود", () => {
  /* اگر بی‌صدا کنار می‌رفت، جمع ساعت گزارش نیرو و جمع ساعت سند ارسال
   * دو عدد متفاوت می‌شدند و کسی نمی‌فهمید چرا. */
  const p = buildLaborPostings({ periodCode: "2026-03", lines: [L(), L({ cbsId: "", equivalentHours: 5 })] });
  assert.equal(p.lines.length, 1);
  assert.equal(p.unallocatedHours, 5);
  assert.equal(p.isComplete, false);
});

test("ساعت بدون نرخ شمرده می‌شود ولی مبلغ نمی‌گیرد", () => {
  const p = buildLaborPostings({
    periodCode: "2026-03",
    lines: [L(), L({ tradeCode: "X", missingRate: true, amount: null, hourlyRate: null, equivalentHours: 4 })],
  });
  assert.equal(p.lines[0].amount, 800, "مبلغ فقط از ردیف نرخ‌دار");
  assert.equal(p.lines[0].equivalentHours, 12, "ساعت هر دو شمرده شد");
  assert.equal(p.lines[0].unpricedHours, 4);
  assert.equal(p.unpricedHours, 4);
});

test("یادداشت ساعت بدون نرخ را صریح می‌گوید", () => {
  const p = buildLaborPostings({
    periodCode: "2026-03",
    lines: [L({ missingRate: true, amount: null, equivalentHours: 3 })],
  });
  assert.ok(p.lines[0].memoFa.includes("بدون نرخ"));
  assert.ok(p.lines[0].memoFa.includes("2026-03"));
});

test("یادداشت دورهٔ سالم اشاره‌ای به نرخ ندارد", () => {
  const p = buildLaborPostings({ periodCode: "2026-03", lines: [L()] });
  assert.ok(!p.lines[0].memoFa.includes("بدون نرخ"));
});

test("شمار رستهٔ هر حساب یکتاست", () => {
  const p = buildLaborPostings({
    periodCode: "2026-03",
    lines: [L(), L({ activityId: "A-2" }), L({ tradeCode: "CIV-FRM" })],
  });
  assert.equal(p.lines[0].tradeCount, 2);
});

test("دورهٔ کامل پرچم isComplete می‌گیرد", () => {
  assert.equal(buildLaborPostings({ periodCode: "2026-03", lines: [L()] }).isComplete, true);
});

test("فهرست خالی امن است", () => {
  const p = buildLaborPostings({ periodCode: "2026-03", lines: [] });
  assert.deepEqual(p.lines, []);
  assert.equal(p.totalAmount, 0);
  assert.equal(p.isComplete, true);
});

test("واحد پول پیش‌فرض ریال است و قابل تغییر", () => {
  /* HRM نرخ تبدیل نگه نمی‌دارد (H-12)؛ فقط واحد را حمل می‌کند. */
  assert.equal(buildLaborPostings({ periodCode: "2026-03", lines: [] }).currency, "IRR");
  assert.equal(buildLaborPostings({ periodCode: "2026-03", lines: [], currency: "USD" }).currency, "USD");
});

/* ══════════ ۳. دروازهٔ ارسال ══════════ */

const OK_GATE = { periodLocked: true };

test("دورهٔ کامل ارسال را باز می‌گذارد", () => {
  const g = laborPostingGate(OK_GATE);
  assert.equal(g.ok, true);
  assert.equal(g.code, "I-HRM-450");
  assert.deepEqual(g.warnings, []);
});

test("قفل دوره پیش‌شرط ارسال نیست", () => {
  /* یافتهٔ آزمون زنده: `canLockPeriod` همهٔ برگه‌ها را `posted`
   * می‌خواهد و `posted` شدن نتیجهٔ همین ارسال است. اگر قفل را
   * پیش‌شرط می‌گرفتیم، هیچ دوره‌ای هرگز ارسال نمی‌شد — بن‌بست
   * دایره‌ای. ترتیب درست: تأیید → ارسال → قفل. */
  const g = laborPostingGate({});
  assert.equal(g.ok, true, "دورهٔ باز باید قابل ارسال باشد");
});

test("پیش‌شرط نقض‌شده صریحاً رد می‌شود", () => {
  const g = laborPostingGate({ periodLocked: false });
  assert.equal(g.ok, false);
  assert.equal(g.code, "E-HRM-451");
});

test("ارسال روی دورهٔ قفل‌شده هشدار می‌گیرد", () => {
  /* ممنوع نیست (پس از سند اصلاحی لازم می‌شود) ولی رقمی را عوض
   * می‌کند که قبلاً نهایی اعلام شده بود. */
  const g = laborPostingGate({ ...OK_GATE, periodLockedActual: true });
  assert.equal(g.ok, true);
  assert.ok(g.warnings.some((w) => w.includes("قفل")));
});

test("برگهٔ تأییدنشده ارسال را می‌بندد", () => {
  const g = laborPostingGate({ ...OK_GATE, unapprovedSheets: 3 });
  assert.equal(g.ok, false);
  assert.ok(g.reasons.some((r) => r.includes("3")));
});

test("تعارض باز ارسال را می‌بندد", () => {
  const g = laborPostingGate({ ...OK_GATE, openConflicts: 1 });
  assert.equal(g.ok, false);
  assert.ok(g.reasons.some((r) => r.includes("تعارض")));
});

test("ساعت بدون نرخ هشدار است نه مانع", () => {
  /* بقیهٔ حساب‌ها نباید معطل یک رستهٔ بی‌نرخ بمانند. */
  const g = laborPostingGate({ ...OK_GATE, unpricedHours: 12 });
  assert.equal(g.ok, true);
  assert.equal(g.warnings.length, 1);
  assert.ok(g.warnings[0].includes("12"));
});

test("ساعت بدون حساب هزینه هشدار است", () => {
  const g = laborPostingGate({ ...OK_GATE, unallocatedHours: 5 });
  assert.equal(g.ok, true);
  assert.ok(g.warnings[0].includes("5"));
});

test("ارسال قبلی هشدار جایگزینی می‌دهد", () => {
  /* کاربر باید بداند رقم جایگزین می‌شود نه اضافه. */
  const g = laborPostingGate({ ...OK_GATE, alreadyPostedAt: "2026-04-01T10:00:00Z" });
  assert.equal(g.ok, true);
  assert.ok(g.warnings[0].includes("2026-04-01"));
  assert.ok(g.warnings[0].includes("جایگزین"));
});

test("چند مانع همزمان همه گزارش می‌شوند", () => {
  const g = laborPostingGate({ periodLocked: false, unapprovedSheets: 2, openConflicts: 1, unpricedHours: 4 });
  assert.equal(g.reasons.length, 3);
  assert.equal(g.warnings.length, 1);
});

test("برگهٔ تأییدنشده همچنان مانع است", () => {
  /* قفل پیش‌شرط نیست، ولی این یکی هست: عدد پیش‌نویس در دفتر مالی
   * جایی ندارد. */
  assert.equal(laborPostingGate({ unapprovedSheets: 1 }).ok, false);
});

/* ══════════ ۴. اعمال روی حساب هزینه ══════════ */

test("ارسال اول سهم را اضافه می‌کند", () => {
  assert.equal(applyLaborPosting(1000, 0, 300), 1300);
});

test("ارسال دوباره جمع را متورم نمی‌کند", () => {
  /* در عمل همیشه پیش می‌آید: یک ردیف اصلاح می‌شود و دوره دوباره
   * ارسال می‌گردد. */
  const first = applyLaborPosting(1000, 0, 300);
  assert.equal(applyLaborPosting(first, 300, 300), 1300, "ارسال یکسان رقم را عوض نمی‌کند");
});

test("سهم کاهش‌یافته رقم را پایین می‌آورد", () => {
  assert.equal(applyLaborPosting(1300, 300, 200), 1200);
});

test("سهم صفر سهم قبلی را برمی‌دارد", () => {
  assert.equal(applyLaborPosting(1300, 300, 0), 1000);
});

test("هزینهٔ ماژول دیگر روی همان حساب دست‌نخورده می‌ماند", () => {
  /* حساب ۱۰۰۰ سهم ماشین‌آلات دارد؛ HRM فقط سهم خودش را جابه‌جا کند. */
  const withEqp = 1000;
  const afterHrm = applyLaborPosting(withEqp, 0, 400);
  assert.equal(applyLaborPosting(afterHrm, 400, 250), 1250);
  assert.equal(applyLaborPosting(1250, 250, 0), withEqp, "برداشتن سهم HRM، سهم ماشین‌آلات را برمی‌گرداند");
});

test("ورودی تهی صفر می‌شود نه NaN", () => {
  assert.equal(applyLaborPosting(undefined, null, 100), 100);
});

test("گرد کردن دو رقمی اعمال می‌شود", () => {
  assert.equal(applyLaborPosting(0.1, 0, 0.2), 0.3);
});

/* ══════════ ۵. کلید رویداد ══════════ */

test("کلید رویداد از سه بخش قطعی ساخته می‌شود", () => {
  const k = laborEventKey("p1", "2026-03", "CBS-1");
  assert.equal(k, "hrm.labor.posted:p1:2026-03:CBS-1");
  assert.equal(laborEventKey("p1", "2026-03", "CBS-1"), k, "قطعی است");
});

test("کلید رویداد برای حساب متفاوت متفاوت است", () => {
  assert.notEqual(laborEventKey("p1", "2026-03", "CBS-1"), laborEventKey("p1", "2026-03", "CBS-2"));
  assert.notEqual(laborEventKey("p1", "2026-03", "CBS-1"), laborEventKey("p2", "2026-03", "CBS-1"));
});
