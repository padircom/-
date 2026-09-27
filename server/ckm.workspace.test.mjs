/**
 * LIVE-2 — منطق خالص میز کار d11 (server/ckmWsLogic.js ← src/services/ckmWorkspace.ts).
 * سطح تشدید از رویدادهای واقعی، نبودِ داده ≠ سالم، پیش‌نویس ≠ نامه،
 * و جابه‌جایی نمونه نسبت به امروز بدون تغییر معنای آن.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CKM_SAMPLE,
  CKM_SAMPLE_BASE,
  EVENT_CODES,
  addDays,
  buildCkmView,
  ckmSampleFor,
  isoDay,
  letterDueDate,
  pendingEvents,
  shiftDates,
  toLetter,
  toStakeholder,
} from "./ckmWsLogic.js";

const EMPTY = { projectId: "t", letters: [], meetings: [], actions: [], stakeholders: [], lessons: [], reuses: [], rules: [] };
const sampleAt = (today) => ({ projectId: "t", ...ckmSampleFor(today) });

test("shiftDates فقط تاریخ‌های YYYY-MM-DD را جابه‌جا می‌کند و غیرمخرب است", () => {
  const src = { a: "2026-09-08", b: "OG-2026-09", c: ["2026-01-31", 3, null], d: { e: "2026-09-08T08:00:00Z" } };
  const out = shiftDates(src, 1);
  assert.deepEqual(out, { a: "2026-09-09", b: "OG-2026-09", c: ["2026-02-01", 3, null], d: { e: "2026-09-08T08:00:00Z" } });
  assert.equal(src.a, "2026-09-08", "ورودی دست نخورده");
  assert.equal(shiftDates(src, 0), src);
});

test("نمونه روی تاریخ مبنا همان نمونهٔ اصلی است و با امروز جابه‌جا می‌شود", () => {
  assert.deepEqual(ckmSampleFor(CKM_SAMPLE_BASE), CKM_SAMPLE);
  const later = ckmSampleFor(addDays(CKM_SAMPLE_BASE, 19));
  assert.equal(later.letters[0].IssuedAt, addDays(CKM_SAMPLE.letters[0].IssuedAt, 19));
  assert.equal(later.actions[0].DueDate, addDays(CKM_SAMPLE.actions[0].DueDate, 19));
  assert.equal(later.letters[0].LetterNo, CKM_SAMPLE.letters[0].LetterNo, "شماره نامه تاریخ نیست");
});

test("نمای نمونه روی تاریخ مبنا همان اعداد صفحهٔ پیشین را می‌دهد", () => {
  const v = buildCkmView(sampleAt(CKM_SAMPLE_BASE), CKM_SAMPLE_BASE);
  assert.equal(v.empty, false);
  assert.equal(v.timeBarBreaches, 3);
  assert.equal(v.overdueLetters, 5);
  assert.equal(v.dueSoon, 1);
  assert.equal(v.openLetters, 9);
  assert.equal(v.overdueActions, 4);
  assert.equal(v.unapprovedMinutes, 2);
  assert.deepEqual(v.critical.map((s) => s.id), ["S-1", "S-3", "S-6", "S-8"]);
  assert.equal(v.coverage, 87.5);
  assert.equal(v.channels, 28);
  assert.equal(v.utilization, 83.3);
  assert.deepEqual(v.alerts.map((a) => a.code), ["EWS-CKM-01", "EWS-CKM-03", "EWS-CKM-05"]);
});

test("جابه‌جایی نمونه معنای آن را حفظ می‌کند (شمارش‌ها روی امروز یکسان)", () => {
  const today = addDays(CKM_SAMPLE_BASE, 19);
  const a = buildCkmView(sampleAt(CKM_SAMPLE_BASE), CKM_SAMPLE_BASE);
  const b = buildCkmView(sampleAt(today), today);
  for (const k of ["timeBarBreaches", "overdueLetters", "dueSoon", "openLetters", "overdueActions", "unapprovedMinutes"]) assert.equal(b[k], a[k], k);
});

test("نبودِ داده «سالم» نیست: شاخص‌ها null و هشدار دانش ساختگی تولید نمی‌شود", () => {
  const v = buildCkmView(EMPTY, "2026-09-27");
  assert.equal(v.empty, true);
  assert.equal(v.avgResponse, null);
  assert.equal(v.utilization, null);
  assert.equal(v.coverage, null);
  assert.equal(v.closureRate, null);
  assert.deepEqual(v.alerts, [], "پیش از این نرخ دانش ۰٪ روی پروژهٔ خالی هشدار EWS-CKM-06 می‌داد");
});

test("پیش‌نویس نامه در مهلت و آمار شمرده نمی‌شود", () => {
  const draft = { LetterNo: "D-1", Direction: "outgoing", Kind: "claim_notice", SubjectFa: "پیش‌نویس", IssuedAt: "2026-01-01", Status: "draft" };
  const v = buildCkmView({ ...EMPTY, letters: [draft] }, "2026-09-27");
  assert.equal(v.letterRows[0].due, null);
  assert.equal(v.timeBarBreaches, 0);
  assert.equal(v.overdueLetters, 0);
  assert.equal(v.drafts, 1);
  assert.equal(pendingEvents({ ...EMPTY, letters: [draft] }, "2026-09-27").notice_due.length, 0);
});

test("سطح تشدید از قدیمی‌ترین مورد معلق واقعی، نه از عدد ثابت", () => {
  const ws = {
    ...EMPTY,
    meetings: [{ Code: "M", TitleFa: "t", MeetingType: "weekly", HeldAt: "2026-09-01", Chair: "c", Invited: ["a"], Attendees: ["a"], MinutesApproved: true }],
    actions: [
      { Code: "A1", MeetingCode: "M", TitleFa: "مصوبهٔ نخست معوق", OwnerRole: "x", DueDate: "2026-09-26", Status: "open" },
      { Code: "A2", MeetingCode: "M", TitleFa: "مصوبهٔ دوم معوق", OwnerRole: "x", DueDate: "2026-09-21", Status: "open" },
      { Code: "A3", MeetingCode: "M", TitleFa: "مصوبهٔ بسته", OwnerRole: "x", DueDate: "2026-09-01", Status: "done" },
    ],
    rules: [
      { Code: "R1", EventCode: "action_overdue", NameFa: "معوق", EscalateAfterHours: 72, Active: true },
      { Code: "R2", EventCode: "letter_unowned", NameFa: "بدون مالک", EscalateAfterHours: 24, Active: true },
      { Code: "R3", EventCode: "action_overdue", NameFa: "خاموش", EscalateAfterHours: 24, Active: false },
    ],
  };
  const v = buildCkmView(ws, "2026-09-27");
  const [r1, r2, r3] = v.ruleRows;
  assert.equal(r1.items.length, 2, "مصوبهٔ بسته معلق نیست");
  assert.equal(r1.maxHours, 6 * 24);
  assert.equal(r1.level, 2, "۱۴۴ ساعت ÷ ۷۲ = ۲");
  assert.equal(r2.level, 0, "بی‌مورد ⇒ بدون تشدید");
  assert.equal(r3.level, 0, "قاعدهٔ غیرفعال تشدید نمی‌کند");
  /* تصویب‌شدهٔ توزیع‌نشده رویداد معلق دارد ولی قاعدهٔ فعالی ندارد. */
  assert.deepEqual(v.uncoveredEvents, ["minutes_undistributed"]);
  assert.ok(EVENT_CODES.includes("minutes_undistributed"));
});

test("نگاشت سطر: تاریخ SQL (Date یا زمان‌دار) و تناوب خالی", () => {
  assert.equal(isoDay(new Date("2026-09-08T00:00:00Z")), "2026-09-08");
  assert.equal(isoDay("2026-09-08T12:30:00.000Z"), "2026-09-08");
  assert.equal(isoDay(null), undefined);
  const l = toLetter({ LetterNo: "X", Direction: "incoming", Kind: "rfi", SubjectFa: "s", IssuedAt: new Date("2026-09-01T00:00:00Z"), ReceivedAt: "2026-09-02", Status: "registered", Links: [] });
  assert.equal(l.issuedAt, "2026-09-01");
  assert.equal(l.links, undefined, "آرایهٔ خالی = بدون ارجاع (برای E-CKM-103)");
  const s = toStakeholder({ Code: "S", NameFa: "n", Power: 5, Interest: 5, CurrentLevel: "neutral", DesiredLevel: "leading", Channels: ["x"], Frequency: null, OwnerRole: "o" });
  assert.equal(s.frequency, "", "تناوب تعریف‌نشده نباید «on_event» فرض شود");
});

test("مهلت نامه بر پایهٔ روز کاری از تاریخ ثبت دبیرخانه", () => {
  const row = { LetterNo: "X", Direction: "incoming", Kind: "rfi", SubjectFa: "s", IssuedAt: "2026-09-01", ReceivedAt: "2026-09-05", Status: "registered" };
  const due = letterDueDate(row, "2026-09-27");
  assert.ok(due > "2026-09-05");
  assert.equal(letterDueDate({ ...row, ResponseDays: 20 }, "2026-09-27") > due, true, "مهلت دستی بیشتر ⇒ موعد دیرتر");
});

test("توزیع صورت‌جلسه: شکاف = دعوت‌شدگانی که نسخه نگرفته‌اند", () => {
  const m = { Code: "M", TitleFa: "t", MeetingType: "client", HeldAt: "2026-09-01", Chair: "c", Invited: ["کارفرما", "مشاور", "مدیر پروژه"], Attendees: ["کارفرما"], MinutesApproved: true, DistributedAt: "2026-09-02", DistributedTo: ["کارفرما", "مدیر پروژه"] };
  const v = buildCkmView({ ...EMPTY, meetings: [m, { ...m, Code: "N", DistributedAt: null, DistributedTo: null }] }, "2026-09-27");
  assert.deepEqual(v.meetingRows[0].distGap, ["مشاور"]);
  assert.equal(v.meetingRows[1].distGap, null, "توزیع‌نشده ≠ بدون شکاف");
});
