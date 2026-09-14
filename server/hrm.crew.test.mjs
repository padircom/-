/**
 * آزمون موتور اکیپ و نیروی پیمانکاری — HRM D6.
 *
 * محور: قیدهای T-1 و T-4 (که اگر بشکنند نفر-ساعت دوبار شمرده می‌شود)
 * و مرز میان نیروی مستقیم و پیمانکاری.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CREW_MAX_SPAN,
  CREW_ROLES,
  CREW_ROLE_FA,
  CREW_SKILL_RATIO,
  CREW_STATUSES,
  CREW_STATUS_FA,
  PRICING_MODELS,
  PRICING_MODEL_FA,
  SUB_ATT_STATES,
  SUB_ATT_STATE_FA,
  assertNoDoubleCount,
  buildSubIpc,
  canActivateCrew,
  canApproveSubIpc,
  canDisbandCrew,
  crewBoardSummary,
  crewComposition,
  crewUtilization,
  isMemberActiveOn,
  spansOverlap,
  validateMembership,
  validateSubAttendance,
} from "./hrmLogic.js";
import { MIGRATIONS, SCHEMA, tableDef } from "./sqlLogic.js";
import {
  PERMISSION_CATALOG,
  ROLE_CATALOG,
  SOD_RULES,
  effectivePermissions,
  permissionDef,
  sodViolations,
} from "./rbacLogic.js";

const T = (n) => tableDef(n);

/* ══════════ ۱. کاتالوگ‌ها ══════════ */

test("کاتالوگ نقش، وضعیت، مدل قیمت و حالت حضور کامل و ترجمه‌دار است", () => {
  assert.equal(CREW_ROLES.length, 4);
  assert.equal(CREW_STATUSES.length, 3);
  assert.equal(PRICING_MODELS.length, 4);
  assert.equal(SUB_ATT_STATES.length, 5);
  for (const r of CREW_ROLES) assert.ok(CREW_ROLE_FA[r], `ترجمهٔ نقش ${r} نیست`);
  for (const s of CREW_STATUSES) assert.ok(CREW_STATUS_FA[s], `ترجمهٔ وضعیت ${s} نیست`);
  for (const p of PRICING_MODELS) assert.ok(PRICING_MODEL_FA[p], `ترجمهٔ مدل ${p} نیست`);
  for (const s of SUB_ATT_STATES) assert.ok(SUB_ATT_STATE_FA[s], `ترجمهٔ حالت ${s} نیست`);
});

/* ══════════ ۲. بازهٔ عضویت ══════════ */

test("عضویت با بازهٔ باز تا ابد فعال است", () => {
  const m = { personId: "P1", roleInCrew: "skilled", fromDate: "2026-01-01" };
  assert.equal(isMemberActiveOn(m, "2026-01-01"), true, "روز شروع باید شامل باشد");
  assert.equal(isMemberActiveOn(m, "2099-12-31"), true);
  assert.equal(isMemberActiveOn(m, "2025-12-31"), false);
});

test("بازهٔ بسته روز پایان را شامل می‌شود", () => {
  const m = { personId: "P1", roleInCrew: "skilled", fromDate: "2026-01-01", toDate: "2026-03-31" };
  assert.equal(isMemberActiveOn(m, "2026-03-31"), true);
  assert.equal(isMemberActiveOn(m, "2026-04-01"), false);
});

test("عضویت غیرفعال حتی در بازه هم فعال شمرده نمی‌شود", () => {
  const m = { personId: "P1", roleInCrew: "skilled", fromDate: "2026-01-01", status: "removed" };
  assert.equal(isMemberActiveOn(m, "2026-02-01"), false);
});

test("همپوشانی بازه: بازهٔ باز با هر بازهٔ بعدی همپوشان است", () => {
  const open = { crewId: "C1", personId: "P1", fromDate: "2026-01-01" };
  assert.equal(spansOverlap(open, { crewId: "C2", personId: "P1", fromDate: "2027-06-01" }), true);
  assert.equal(spansOverlap(open, { crewId: "C2", personId: "P1", fromDate: "2025-01-01", toDate: "2025-12-31" }), false);
});

test("همپوشانی مرزی: پایان یکی برابر شروع دیگری همپوشان است", () => {
  /* اگر این را باز می‌گذاشتیم، نفر در روز جابه‌جایی در دو اکیپ
   * می‌شد و ساعت آن روزش دوبار شمرده می‌شد. */
  const a = { crewId: "C1", personId: "P1", fromDate: "2026-01-01", toDate: "2026-03-31" };
  const b = { crewId: "C2", personId: "P1", fromDate: "2026-03-31" };
  assert.equal(spansOverlap(a, b), true);
  assert.equal(spansOverlap(a, { crewId: "C2", personId: "P1", fromDate: "2026-04-01" }), false);
});

/* ══════════ ۳. ترکیب اکیپ ══════════ */

const CREW_OK = [
  { personId: "P1", roleInCrew: "foreman", tradeCode: "CIV-FRM", fromDate: "2026-01-01" },
  { personId: "P2", roleInCrew: "skilled", tradeCode: "CIV-FRM", fromDate: "2026-01-01" },
  { personId: "P3", roleInCrew: "skilled", tradeCode: "CIV-FRM", fromDate: "2026-01-01" },
  { personId: "P4", roleInCrew: "helper", tradeCode: "CIV-FRM", fromDate: "2026-01-01" },
  { personId: "P5", roleInCrew: "helper", tradeCode: "CIV-RBR", fromDate: "2026-01-01" },
];

test("ترکیب سالم: شمارش نقش، رسته و نسبت مهارت", () => {
  const c = crewComposition(CREW_OK, "2026-02-01");
  assert.equal(c.headcount, 5);
  assert.equal(c.foremanCount, 1);
  assert.equal(c.byRole.skilled, 2);
  assert.equal(c.byRole.helper, 2);
  assert.equal(c.byTrade["CIV-FRM"], 4);
  assert.equal(c.skillRatio, 1);
  assert.equal(c.fte, 5);
  assert.equal(c.issues.filter((i) => i.severity === "error").length, 0);
});

test("نفرِ معادل تمام‌وقت از سرشماری جداست", () => {
  /* ده نفرِ نیمه‌وقت ده نفر نیست؛ برنامه با سرشماری و هزینه با FTE
   * بسته می‌شود. */
  const half = CREW_OK.map((m) => ({ ...m, allocationPct: 50 }));
  const c = crewComposition(half, "2026-02-01");
  assert.equal(c.headcount, 5);
  assert.equal(c.fte, 2.5);
});

test("اکیپ بدون سرپرست خطای مسدودکننده می‌دهد", () => {
  const c = crewComposition(CREW_OK.filter((m) => m.roleInCrew !== "foreman"), "2026-02-01");
  assert.equal(c.foremanCount, 0);
  assert.ok(c.issues.some((i) => i.code === "E-HRM-160" && i.severity === "error"));
});

test("دو سرپرست هم‌زمان هشدار می‌دهد نه خطا", () => {
  const c = crewComposition([...CREW_OK, { personId: "P6", roleInCrew: "foreman", fromDate: "2026-01-01" }], "2026-02-01");
  const w = c.issues.find((i) => i.code === "W-HRM-502");
  assert.ok(w);
  assert.equal(w.severity, "warning");
});

test("اکیپ بزرگ‌تر از حد کنترل هشدار می‌گیرد", () => {
  const big = Array.from({ length: CREW_MAX_SPAN + 2 }, (_, i) => ({
    personId: `B${i}`, roleInCrew: i === 0 ? "foreman" : "skilled", fromDate: "2026-01-01",
  }));
  const c = crewComposition(big, "2026-02-01");
  assert.ok(c.issues.some((i) => i.code === "W-HRM-503"));
});

test("نسبت نامتعادل استادکار به کمکی هشدار می‌دهد", () => {
  const tooFewSkilled = [
    { personId: "F", roleInCrew: "foreman", fromDate: "2026-01-01" },
    { personId: "S", roleInCrew: "skilled", fromDate: "2026-01-01" },
    ...Array.from({ length: 6 }, (_, i) => ({ personId: `H${i}`, roleInCrew: "helper", fromDate: "2026-01-01" })),
  ];
  const low = crewComposition(tooFewSkilled, "2026-02-01");
  assert.ok(low.skillRatio < CREW_SKILL_RATIO.min);
  assert.ok(low.issues.some((i) => i.code === "W-HRM-504" && i.messageFa.includes("پایین")));

  const tooManySkilled = [
    { personId: "F", roleInCrew: "foreman", fromDate: "2026-01-01" },
    ...Array.from({ length: 8 }, (_, i) => ({ personId: `S${i}`, roleInCrew: "skilled", fromDate: "2026-01-01" })),
    { personId: "H", roleInCrew: "helper", fromDate: "2026-01-01" },
  ];
  const high = crewComposition(tooManySkilled, "2026-02-01");
  assert.ok(high.issues.some((i) => i.code === "W-HRM-504" && i.messageFa.includes("بالا")));
});

test("اکیپ بدون کمکی نسبت مهارت ندارد و هشدار نسبت نمی‌گیرد", () => {
  /* تقسیم بر صفر جای هشدار نیست؛ nullـبودن یعنی «قابل محاسبه نیست». */
  const c = crewComposition([
    { personId: "F", roleInCrew: "foreman", fromDate: "2026-01-01" },
    { personId: "S", roleInCrew: "skilled", fromDate: "2026-01-01" },
  ], "2026-02-01");
  assert.equal(c.skillRatio, null);
  assert.equal(c.issues.filter((i) => i.code === "W-HRM-504").length, 0);
});

test("اکیپ خالی هشدار می‌دهد ولی خطای سرپرست نمی‌دهد", () => {
  const c = crewComposition([], "2026-02-01");
  assert.equal(c.headcount, 0);
  assert.ok(c.issues.some((i) => i.code === "W-HRM-501"));
  assert.equal(c.issues.filter((i) => i.code === "E-HRM-160").length, 0);
});

test("کسری و مازاد نسبت به اندازهٔ هدف گزارش می‌شود", () => {
  const short = crewComposition(CREW_OK, "2026-02-01", { size: 8 });
  assert.ok(short.issues.some((i) => i.code === "W-HRM-505" && i.messageFa.includes("3")));
  const over = crewComposition(CREW_OK, "2026-02-01", { size: 3 });
  assert.ok(over.issues.some((i) => i.code === "W-HRM-506"));
  const exact = crewComposition(CREW_OK, "2026-02-01", { size: 5 });
  assert.equal(exact.issues.filter((i) => i.code === "W-HRM-505" || i.code === "W-HRM-506").length, 0);
});

test("کسری ترکیب رسته‌ای گزارش می‌شود", () => {
  const c = crewComposition(CREW_OK, "2026-02-01", { mix: { "CIV-FRM": 4, "CIV-RBR": 3 } });
  const gaps = c.issues.filter((i) => i.code === "W-HRM-507");
  assert.equal(gaps.length, 1, "فقط رستهٔ کسری‌دار باید گزارش شود");
  assert.ok(gaps[0].messageFa.includes("CIV-RBR"));
});

test("عضو خارج‌شده در تاریخ بعد از خروج شمرده نمی‌شود", () => {
  const withLeaver = [...CREW_OK, { personId: "PX", roleInCrew: "skilled", fromDate: "2026-01-01", toDate: "2026-01-15" }];
  assert.equal(crewComposition(withLeaver, "2026-01-10").headcount, 6);
  assert.equal(crewComposition(withLeaver, "2026-02-01").headcount, 5);
});

/* ══════════ ۴. قیدهای عضویت ══════════ */

const EXISTING = [
  { crewId: "C1", personId: "P1", fromDate: "2026-01-01", allocationPct: 100 },
  { crewId: "C1", personId: "P2", fromDate: "2026-01-01", allocationPct: 50 },
];

test("عضویت تازهٔ سالم ایرادی ندارد", () => {
  const i = validateMembership({ crewId: "C1", personId: "P9", fromDate: "2026-02-01" }, EXISTING);
  assert.deepEqual(i, []);
});

test("T-4: عضویت هم‌زمان در دو اکیپ رد می‌شود", () => {
  /* بدون این قید، ساعت این نفر یک بار در برگهٔ C1 و یک بار در برگهٔ
   * C2 ثبت می‌شد و هزینهٔ پروژه دو برابر واقعیت می‌رفت. */
  const i = validateMembership({ crewId: "C2", personId: "P1", fromDate: "2026-06-01" }, EXISTING);
  const e = i.find((x) => x.code === "E-HRM-165");
  assert.ok(e);
  assert.equal(e.severity, "error");
  assert.ok(e.messageFa.includes("C1"));
  assert.equal(e.personId, "P1");
});

test("T-4 پس از پایان عضویت قبلی آزاد می‌شود", () => {
  const closed = [{ crewId: "C1", personId: "P1", fromDate: "2026-01-01", toDate: "2026-05-31", allocationPct: 100 }];
  const i = validateMembership({ crewId: "C2", personId: "P1", fromDate: "2026-06-01" }, closed);
  assert.deepEqual(i, []);
});

test("T-1: جمع تخصیص بیش از صد درصد رد می‌شود", () => {
  const i = validateMembership({ crewId: "C1", personId: "P2", fromDate: "2026-02-01", allocationPct: 60 }, EXISTING);
  const e = i.find((x) => x.code === "E-HRM-166");
  assert.ok(e);
  assert.ok(e.messageFa.includes("110"));
});

test("T-1: تخصیص جزئی مکمل روی همان اکیپ مجاز است", () => {
  const i = validateMembership({ crewId: "C1", personId: "P2", fromDate: "2026-02-01", allocationPct: 50 }, EXISTING);
  assert.equal(i.filter((x) => x.severity === "error").length, 0);
  assert.ok(i.some((x) => x.code === "W-HRM-508"), "عضویت تکراری باید هشدار بدهد");
});

test("درصد تخصیص خارج از بازه رد می‌شود", () => {
  assert.ok(validateMembership({ crewId: "C1", personId: "PZ", fromDate: "2026-02-01", allocationPct: 0 }, []).some((x) => x.code === "E-HRM-164"));
  assert.ok(validateMembership({ crewId: "C1", personId: "PZ", fromDate: "2026-02-01", allocationPct: 120 }, []).some((x) => x.code === "E-HRM-164"));
});

test("تاریخ پایان پیش از شروع رد می‌شود", () => {
  const i = validateMembership({ crewId: "C1", personId: "PZ", fromDate: "2026-05-01", toDate: "2026-04-01" }, []);
  assert.ok(i.some((x) => x.code === "E-HRM-163"));
});

test("تاریخ بدقالب و نفر خالی رد می‌شوند", () => {
  const i = validateMembership({ crewId: "C1", personId: "  ", fromDate: "1405/02/01" }, []);
  assert.ok(i.some((x) => x.code === "E-HRM-161"));
  assert.ok(i.some((x) => x.code === "E-HRM-162"));
});

test("عضویت لغوشدهٔ قبلی مانع عضویت تازه نیست", () => {
  const cancelled = [{ crewId: "C1", personId: "P1", fromDate: "2026-01-01", status: "removed" }];
  assert.deepEqual(validateMembership({ crewId: "C2", personId: "P1", fromDate: "2026-02-01" }, cancelled), []);
});

/* ══════════ ۵. گذار حالت اکیپ ══════════ */

test("اکیپ آماده فعال می‌شود", () => {
  const c = crewComposition(CREW_OK, "2026-02-01");
  assert.equal(canActivateCrew({ status: "forming", composition: c }).ok, true);
});

test("اکیپ خالی یا بی‌سرپرست فعال نمی‌شود", () => {
  const empty = canActivateCrew({ status: "forming", composition: crewComposition([], "2026-02-01") });
  assert.equal(empty.ok, false);
  assert.equal(empty.code, "E-HRM-169");
  assert.ok(empty.detailsFa.some((d) => d.includes("عضو")));

  const noForeman = canActivateCrew({
    status: "forming",
    composition: crewComposition(CREW_OK.filter((m) => m.roleInCrew !== "foreman"), "2026-02-01"),
  });
  assert.equal(noForeman.ok, false);
  assert.ok(noForeman.detailsFa.some((d) => d.includes("سرپرست")));
});

test("سرپرست تعیین‌شده در سربرگ، نبود نقش سرپرست را جبران می‌کند", () => {
  const r = canActivateCrew({
    status: "forming",
    composition: crewComposition(CREW_OK.filter((m) => m.roleInCrew !== "foreman"), "2026-02-01"),
    hasForemanAssigned: true,
  });
  assert.equal(r.ok, true);
});

test("اکیپ منحل‌شده دوباره فعال نمی‌شود", () => {
  const r = canActivateCrew({ status: "disbanded", composition: crewComposition(CREW_OK, "2026-02-01") });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-167");
});

test("اکیپ فعال دوباره فعال نمی‌شود", () => {
  const r = canActivateCrew({ status: "active", composition: crewComposition(CREW_OK, "2026-02-01") });
  assert.equal(r.code, "E-HRM-168");
});

test("انحلال با دلیل کافی و بدون کار باز مجاز است", () => {
  const r = canDisbandCrew({ status: "active", openTimesheets: 0, activeMembers: 0, reasonFa: "پایان عملیات فونداسیون منطقهٔ یک" });
  assert.equal(r.ok, true);
});

test("انحلال بدون دلیل کافی رد می‌شود", () => {
  assert.equal(canDisbandCrew({ status: "active", reasonFa: "تمام شد" }).code, "E-HRM-171");
});

test("برگهٔ باز و عضو فعال جلوی انحلال را می‌گیرند و همه یکجا گزارش می‌شوند", () => {
  const r = canDisbandCrew({ status: "active", openTimesheets: 2, activeMembers: 5, reasonFa: "بازسازمان‌دهی اکیپ‌های عمرانی" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-172");
  assert.equal(r.detailsFa.length, 2, "کاربر باید هر دو مانع را یکجا ببیند");
});

test("اکیپ منحل‌شده دوباره منحل نمی‌شود", () => {
  assert.equal(canDisbandCrew({ status: "disbanded", reasonFa: "دلیل کافی برای انحلال" }).code, "E-HRM-170");
});

/* ══════════ ۶. حضور نیروی پیمانکاری ══════════ */

const CONTRACT = {
  Id: "SC-1",
  ScopeTrades: ["CIV-FRM", "CIV-RBR"],
  AgreedRates: { "CIV-FRM": 200000, "CIV-RBR": 180000 },
  StartDate: "2026-01-01",
  EndDate: "2026-12-31",
  Status: "active",
  PricingModel: "hourly",
  RetentionPct: 10,
};

const ATT_OK = { workDate: "2026-05-10", tradeCode: "CIV-FRM", headcount: 12, hoursPerPerson: 9, activityId: "A-1", cbsId: "CBS-1" };

test("حضور گروهی معتبر ایرادی ندارد", () => {
  assert.deepEqual(validateSubAttendance(ATT_OK, CONTRACT), []);
});

test("رستهٔ خارج از دامنهٔ قرارداد رد می‌شود", () => {
  /* بدون این بند، پیمانکار جوشکاری صورت‌کارکرد برق‌کار می‌فرستاد. */
  const i = validateSubAttendance({ ...ATT_OK, tradeCode: "ELE-CBL" }, CONTRACT);
  assert.ok(i.some((x) => x.code === "E-HRM-185"));
});

test("تاریخ بیرون بازهٔ قرارداد رد می‌شود", () => {
  assert.ok(validateSubAttendance({ ...ATT_OK, workDate: "2025-12-31" }, CONTRACT).some((x) => x.code === "E-HRM-181"));
  assert.ok(validateSubAttendance({ ...ATT_OK, workDate: "2027-01-01" }, CONTRACT).some((x) => x.code === "E-HRM-182"));
});

test("قرارداد غیرفعال حضور نمی‌پذیرد", () => {
  assert.ok(validateSubAttendance(ATT_OK, { ...CONTRACT, Status: "draft" }).some((x) => x.code === "E-HRM-183"));
});

test("سقف ساعت per-person است نه per-row", () => {
  /* ۱۲ نفر × ۹ ساعت = ۱۰۸ ساعت مجاز است؛ ۱ نفر × ۲۰ ساعت نه. */
  assert.deepEqual(validateSubAttendance({ ...ATT_OK, headcount: 12, hoursPerPerson: 9 }, CONTRACT), []);
  const over = validateSubAttendance({ ...ATT_OK, headcount: 1, hoursPerPerson: 20 }, CONTRACT);
  assert.ok(over.some((x) => x.code === "E-HRM-188"));
});

test("ساعت فراتر از عادی+اضافه‌کاری هشدار می‌دهد نه خطا", () => {
  const i = validateSubAttendance({ ...ATT_OK, hoursPerPerson: 14 }, CONTRACT);
  const w = i.find((x) => x.code === "W-HRM-509");
  assert.ok(w);
  assert.equal(w.severity, "warning");
  assert.equal(i.filter((x) => x.severity === "error").length, 0);
});

test("تعداد نفرات باید صحیح مثبت باشد", () => {
  assert.ok(validateSubAttendance({ ...ATT_OK, headcount: 0 }, CONTRACT).some((x) => x.code === "E-HRM-186"));
  assert.ok(validateSubAttendance({ ...ATT_OK, headcount: 2.5 }, CONTRACT).some((x) => x.code === "E-HRM-186"));
  assert.ok(validateSubAttendance({ ...ATT_OK, headcount: -3 }, CONTRACT).some((x) => x.code === "E-HRM-186"));
});

test("ساعت بی‌صاحب پذیرفته نمی‌شود", () => {
  const i = validateSubAttendance({ ...ATT_OK, activityId: "", cbsId: "  " }, CONTRACT);
  assert.ok(i.some((x) => x.code === "E-HRM-189"));
  assert.ok(i.some((x) => x.code === "E-HRM-190"));
});

test("رستهٔ بی‌نرخ هشدار می‌دهد ولی ثبت را نمی‌بندد", () => {
  const noRate = { ...CONTRACT, AgreedRates: { "CIV-RBR": 180000 } };
  const i = validateSubAttendance(ATT_OK, noRate);
  assert.ok(i.some((x) => x.code === "W-HRM-510"));
  assert.equal(i.filter((x) => x.severity === "error").length, 0);
});

test("قرارداد بدون دامنهٔ رسته همه را می‌پذیرد", () => {
  const open = { ...CONTRACT, ScopeTrades: null };
  assert.equal(validateSubAttendance({ ...ATT_OK, tradeCode: "ELE-CBL" }, open).filter((x) => x.severity === "error").length, 0);
});

test("دامنهٔ رسته به‌صورت رشتهٔ JSON هم خوانده می‌شود", () => {
  /* درایور JSON گاهی ستون json را رشته برمی‌گرداند. */
  const asString = { ...CONTRACT, ScopeTrades: '["CIV-FRM"]', AgreedRates: '{"CIV-FRM":200000}' };
  assert.deepEqual(validateSubAttendance(ATT_OK, asString), []);
  assert.ok(validateSubAttendance({ ...ATT_OK, tradeCode: "CIV-RBR" }, asString).some((x) => x.code === "E-HRM-185"));
});

/* ══════════ ۷. دوبار شمردن ══════════ */

test("نفرِ دارای برگهٔ فردی، زیر چتر حضور گروهی رد می‌شود", () => {
  const i = assertNoDoubleCount({
    workDate: "2026-05-10",
    directEntries: [{ PersonId: "P1", WorkDate: "2026-05-10", HoursRaw: 8 }],
    crewMemberPersonIds: ["P1", "P2"],
  });
  assert.equal(i.length, 1);
  assert.equal(i[0].code, "E-HRM-191");
  assert.ok(i[0].messageFa.includes("P1"));
});

test("روز متفاوت دوبار شمردن نیست", () => {
  const i = assertNoDoubleCount({
    workDate: "2026-05-11",
    directEntries: [{ PersonId: "P1", WorkDate: "2026-05-10", HoursRaw: 8 }],
    crewMemberPersonIds: ["P1"],
  });
  assert.deepEqual(i, []);
});

test("نفرِ خارج از اکیپ پیمانکاری تداخل نمی‌سازد", () => {
  const i = assertNoDoubleCount({
    workDate: "2026-05-10",
    directEntries: [{ PersonId: "PX", WorkDate: "2026-05-10", HoursRaw: 8 }],
    crewMemberPersonIds: ["P1", "P2"],
  });
  assert.deepEqual(i, []);
});

test("ردیف صفرساعته تداخل نیست", () => {
  const i = assertNoDoubleCount({
    workDate: "2026-05-10",
    directEntries: [{ PersonId: "P1", WorkDate: "2026-05-10", HoursRaw: 0 }],
    crewMemberPersonIds: ["P1"],
  });
  assert.deepEqual(i, []);
});

test("اکیپ بی‌عضو هرگز تداخل نمی‌سازد", () => {
  assert.deepEqual(assertNoDoubleCount({
    workDate: "2026-05-10",
    directEntries: [{ PersonId: "P1", WorkDate: "2026-05-10", HoursRaw: 8 }],
    crewMemberPersonIds: [],
  }), []);
});

/* ══════════ ۸. صورت‌کارکرد ══════════ */

const ATT_ROWS = [
  { Id: "R1", WorkDate: "2026-05-10", TradeCode: "CIV-FRM", Headcount: 10, HoursPerPerson: 8, TotalHours: 80, ActivityId: "A-1", CbsId: "CBS-1", Status: "verified" },
  { Id: "R2", WorkDate: "2026-05-11", TradeCode: "CIV-FRM", Headcount: 10, HoursPerPerson: 8, TotalHours: 80, ActivityId: "A-1", CbsId: "CBS-1", Status: "verified" },
  { Id: "R3", WorkDate: "2026-05-12", TradeCode: "CIV-RBR", Headcount: 5, HoursPerPerson: 8, TotalHours: 40, ActivityId: "A-2", CbsId: "CBS-2", Status: "verified" },
  { Id: "R4", WorkDate: "2026-05-13", TradeCode: "CIV-FRM", Headcount: 8, HoursPerPerson: 8, TotalHours: 64, ActivityId: "A-1", CbsId: "CBS-1", Status: "draft" },
];

test("صورت‌کارکرد فقط از ردیف تأییدشده ساخته می‌شود", () => {
  const d = buildSubIpc(ATT_ROWS, CONTRACT, "2026-05");
  assert.equal(d.totalHours, 200, "ردیف پیش‌نویس نباید وارد شود");
  assert.ok(d.issues.some((i) => i.code === "W-HRM-511"));
});

test("تجمیع روی کلید حساب هزینه، فعالیت و رسته", () => {
  const d = buildSubIpc(ATT_ROWS, CONTRACT, "2026-05");
  assert.equal(d.lines.length, 2, "دو روز یک رسته باید در یک خط جمع شوند");
  const frm = d.lines.find((l) => l.tradeCode === "CIV-FRM");
  assert.equal(frm.totalHours, 160);
  assert.equal(frm.headcountDays, 20);
  assert.equal(frm.rate, 200000);
  assert.equal(frm.amount, 32_000_000);
});

test("مبلغ ناخالص، حسن انجام کار و خالص", () => {
  const d = buildSubIpc(ATT_ROWS, CONTRACT, "2026-05");
  assert.equal(d.grossAmount, 39_200_000);   // 160×200000 + 40×180000
  assert.equal(d.retentionAmount, 3_920_000); // ۱۰٪
  assert.equal(d.netBeforeDeduction, 35_280_000);
  assert.equal(d.isComplete, true);
});

test("ساعت بی‌نرخ صفر نمی‌شود؛ جدا می‌ماند و صورت‌کارکرد را ناقص می‌کند", () => {
  /* همان الگوی D4: عدد ناقص باید صدای خودش را داشته باشد. */
  const noRate = { ...CONTRACT, AgreedRates: { "CIV-FRM": 200000 } };
  const d = buildSubIpc(ATT_ROWS, noRate, "2026-05");
  assert.equal(d.unpricedHours, 40);
  assert.equal(d.grossAmount, 32_000_000);
  assert.equal(d.isComplete, false);
  const line = d.lines.find((l) => l.tradeCode === "CIV-RBR");
  assert.equal(line.missingRate, true);
  assert.equal(line.amount, null, "مبلغ نبود، صفر نیست");
  assert.ok(d.issues.some((i) => i.code === "W-HRM-512"));
});

test("دورهٔ بدون ردیف تأییدشده خطا می‌دهد", () => {
  const d = buildSubIpc([ATT_ROWS[3]], CONTRACT, "2026-05");
  assert.equal(d.lines.length, 0);
  assert.ok(d.issues.some((i) => i.code === "E-HRM-192" && i.severity === "error"));
});

test("قرارداد بدون حسن انجام کار، خالص برابر ناخالص است", () => {
  const d = buildSubIpc(ATT_ROWS, { ...CONTRACT, RetentionPct: 0 }, "2026-05");
  assert.equal(d.retentionAmount, 0);
  assert.equal(d.netBeforeDeduction, d.grossAmount);
});

test("جمع ساعت از تعداد نفر ضرب در ساعت بازسازی می‌شود اگر جمع ذخیره نشده باشد", () => {
  const noTotal = [{ ...ATT_ROWS[0], TotalHours: undefined }];
  const d = buildSubIpc(noTotal, CONTRACT, "2026-05");
  assert.equal(d.totalHours, 80);
});

test("خطوط صورت‌کارکرد مرتب‌اند", () => {
  const d = buildSubIpc(ATT_ROWS, CONTRACT, "2026-05");
  const keys = d.lines.map((l) => l.cbsId + l.activityId + l.tradeCode);
  assert.deepEqual(keys, [...keys].sort());
});

/* ══════════ ۹. دروازهٔ تأیید صورت‌کارکرد ══════════ */

test("صورت‌کارکرد کامل تأیید می‌شود", () => {
  assert.equal(canApproveSubIpc({ status: "draft", totalHours: 200, unpricedHours: 0, netAmount: 35_280_000 }).ok, true);
});

test("صورت‌کارکرد دارای ساعت بی‌نرخ تأیید نمی‌شود", () => {
  /* مبلغی که بعداً باید اصلاح شود، پس از پرداخت اصلاح نمی‌شود. */
  const r = canApproveSubIpc({ status: "draft", totalHours: 200, unpricedHours: 40, netAmount: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-195");
  assert.ok(r.detailsFa.some((d) => d.includes("نرخ")));
});

test("صورت‌کارکرد صفرساعته یا منفی تأیید نمی‌شود", () => {
  assert.ok(canApproveSubIpc({ status: "draft", totalHours: 0, netAmount: 0 }).detailsFa.some((d) => d.includes("صفر")));
  assert.ok(canApproveSubIpc({ status: "draft", totalHours: 10, netAmount: -5 }).detailsFa.some((d) => d.includes("منفی")));
});

test("صورت‌کارکرد تأییدشده یا برگشتی دوباره تأیید نمی‌شود", () => {
  assert.equal(canApproveSubIpc({ status: "approved", totalHours: 1, netAmount: 1 }).code, "E-HRM-193");
  assert.equal(canApproveSubIpc({ status: "rejected", totalHours: 1, netAmount: 1 }).code, "E-HRM-194");
});

/* ══════════ ۱۰. نرخ استفاده ══════════ */

const CREWS = [
  { Id: "C1", NameFa: "اکیپ قالب‌بندی", Status: "active" },
  { Id: "C2", NameFa: "اکیپ آرماتور", Status: "active" },
];
const UTIL_MEMBERS = [
  { crewId: "C1", personId: "P1", roleInCrew: "foreman", fromDate: "2026-01-01" },
  { crewId: "C1", personId: "P2", roleInCrew: "skilled", fromDate: "2026-01-01" },
  { crewId: "C2", personId: "P3", roleInCrew: "foreman", fromDate: "2026-01-01" },
];

test("نرخ استفاده و نرخ مولد دو عدد جدا هستند", () => {
  /* اکیپی که ۱۰۰٪ حاضر است ولی ۵۰٪ مولد، مسئله‌اش جبههٔ کاری است
   * نه غیبت؛ یک عدد ترکیبی این تفاوت را پنهان می‌کرد. */
  const rows = crewUtilization(CREWS, UTIL_MEMBERS, [
    { CrewId: "C1", HoursRaw: 40, IsProductive: true },
    { CrewId: "C1", HoursRaw: 40, IsProductive: false },
    { CrewId: "C2", HoursRaw: 20, IsProductive: true },
  ], { workingDays: 5, dateIso: "2026-02-01" });

  const c1 = rows.find((r) => r.crewId === "C1");
  assert.equal(c1.headcount, 2);
  assert.equal(c1.availableHours, 80);   // 2 FTE × 8 × 5
  assert.equal(c1.chargedHours, 80);
  assert.equal(c1.utilizationPct, 100);
  assert.equal(c1.productivePct, 50);
  assert.equal(c1.flag, "red", "پرچم باید از بدترین نسبت بیاید");
});

test("اکیپ کم‌حضور قرمز می‌شود", () => {
  const rows = crewUtilization(CREWS, UTIL_MEMBERS, [{ CrewId: "C2", HoursRaw: 10, IsProductive: true }], { workingDays: 5, dateIso: "2026-02-01" });
  const c2 = rows.find((r) => r.crewId === "C2");
  assert.equal(c2.availableHours, 40);
  assert.equal(c2.utilizationPct, 25);
  assert.equal(c2.flag, "red");
});

test("اکیپ بدون داده «نامشخص» است نه قرمز", () => {
  const rows = crewUtilization(CREWS, [], [], { workingDays: 0, dateIso: "2026-02-01" });
  assert.ok(rows.every((r) => r.flag === "na"));
  assert.ok(rows.every((r) => r.utilizationPct === null));
});

test("بدترین اکیپ اول فهرست می‌آید", () => {
  const rows = crewUtilization(CREWS, UTIL_MEMBERS, [
    { CrewId: "C1", HoursRaw: 80, IsProductive: true },
    { CrewId: "C2", HoursRaw: 10, IsProductive: true },
  ], { workingDays: 5, dateIso: "2026-02-01" });
  assert.equal(rows[0].crewId, "C2");
});

test("تخصیص جزئی ساعت در دسترس را کم می‌کند", () => {
  const half = UTIL_MEMBERS.map((m) => ({ ...m, allocationPct: 50 }));
  const rows = crewUtilization(CREWS, half, [], { workingDays: 5, dateIso: "2026-02-01" });
  assert.equal(rows.find((r) => r.crewId === "C1").availableHours, 40);
});

test("خلاصهٔ تابلو، اکیپ قرمز و بدترین را نشان می‌دهد", () => {
  const rows = crewUtilization(CREWS, UTIL_MEMBERS, [
    { CrewId: "C1", HoursRaw: 80, IsProductive: true },
    { CrewId: "C2", HoursRaw: 10, IsProductive: true },
  ], { workingDays: 5, dateIso: "2026-02-01" });
  const s = crewBoardSummary(rows);
  assert.equal(s.crewCount, 2);
  assert.equal(s.activeCount, 2);
  assert.equal(s.headcount, 3);
  assert.equal(s.availableHours, 120);
  assert.equal(s.chargedHours, 90);
  assert.equal(s.utilizationPct, 75);
  assert.equal(s.productivePct, 100);
  assert.equal(s.redCount, 1);
  assert.equal(s.worstCrewId, "C2");
});

test("خلاصهٔ تابلوی خالی امن است", () => {
  const s = crewBoardSummary([]);
  assert.equal(s.crewCount, 0);
  assert.equal(s.utilizationPct, null);
  assert.equal(s.worstCrewId, null);
});

/* ══════════ ۱۱. اسکیما و مهاجرت ══════════ */

test("پنج جدول D6 در اسکیما هستند و به d10 تعلق دارند", () => {
  for (const n of ["HrmCrew", "HrmCrewMember", "HrmSubContract", "HrmSubAttendance", "HrmSubIpc"]) {
    const t = T(n);
    assert.ok(t, `جدول ${n} نیست`);
    assert.equal(t.module, "d10");
    assert.equal(t.pk, "Id");
    assert.ok(t.title.fa && t.title.en, `عنوان دوزبانه ندارد: ${n}`);
  }
});

test("مهاجرت 0025 اکیپ است و قبلی‌ها حفظ شده‌اند", () => {
  const v = MIGRATIONS.map((m) => m.version);
  assert.ok(v.includes("0024"), "مهاجرت بهره‌وری نباید حذف شود");
  assert.equal(new Set(v).size, v.length, "شمارهٔ مهاجرت تکراری");
  /* «آخرین» نه — «خودش»: D7 مهاجرت 0026 را افزود و ادعای آخر بودن
   * می‌شکست بی‌آنکه دربارهٔ اکیپ چیزی بگوید. */
  assert.equal(MIGRATIONS.find((m) => m.version === "0025").name, "hrm_crew_subcontract");
  assert.deepEqual([...v].sort(), v, "ترتیب مهاجرت‌ها باید صعودی بماند");
});

test("مهاجرت 0025 هر پنج جدول را می‌سازد", () => {
  const sql = MIGRATIONS.find((x) => x.version === "0025").statements.join("\n");
  for (const n of ["HrmCrew", "HrmCrewMember", "HrmSubContract", "HrmSubAttendance", "HrmSubIpc"]) {
    assert.ok(sql.includes(n), `${n} در مهاجرت نیست`);
  }
  assert.ok(sql.includes("UX_HrmSubAtt"));
  assert.ok(sql.includes("UX_HrmSubIpc"));
});

test("کلید یکتای حضور از ثبت دوبارهٔ یک روز-رسته-فعالیت جلوگیری می‌کند", () => {
  const ux = T("HrmSubAttendance").indexes.find((i) => i.unique);
  assert.deepEqual(ux.columns, ["SubContractId", "WorkDate", "TradeCode", "ActivityId"]);
});

test("یک صورت‌کارکرد در هر دوره برای هر قرارداد", () => {
  const ux = T("HrmSubIpc").indexes.find((i) => i.unique);
  assert.deepEqual(ux.columns, ["SubContractId", "PeriodCode"]);
});

test("جدول‌های پیش از اکیپ حذف نشده‌اند", () => {
  assert.ok(SCHEMA.length >= 127, "جدولی از اسکیما حذف شده است");
});

test("ستون‌های حساس اکیپ و حضور اجباری‌اند", () => {
  const crew = Object.fromEntries(T("HrmCrew").columns.map((c) => [c.name, c]));
  for (const n of ["ProjectId", "Code", "NameFa", "PrimaryTradeCode", "Status"]) {
    assert.equal(crew[n].nullable, false, `${n} نباید nullable باشد`);
  }
  const att = Object.fromEntries(T("HrmSubAttendance").columns.map((c) => [c.name, c]));
  for (const n of ["SubContractId", "WorkDate", "TradeCode", "Headcount", "ActivityId", "CbsId"]) {
    assert.equal(att[n].nullable, false, `${n} نباید nullable باشد`);
  }
  assert.equal(crew.CreatedAt, undefined, "ستون CreatedAt خودکار افزوده می‌شود");
});

/* ══════════ ۱۲. دسترسی ══════════ */

test("نُه مجوز D6 تعریف شده و به d10 تعلق دارند", () => {
  const codes = [
    "hrm.crew.view", "hrm.crew.manage", "hrm.crew.disband",
    "hrm.sub.view", "hrm.sub.manage", "hrm.sub.record",
    "hrm.sub.verify", "hrm.subipc.prepare", "hrm.subipc.approve",
  ];
  for (const c of codes) {
    const d = permissionDef(c);
    assert.ok(d, `مجوز ${c} نیست`);
    assert.equal(d.module, "d10");
    assert.match(c, /^[a-z]+\.[a-z]+\.[a-z]+$/);
  }
});

test("عمل‌های نوشتنی D6 ممیزی می‌شوند و خواندنی‌ها نه", () => {
  for (const c of ["hrm.crew.manage", "hrm.crew.disband", "hrm.sub.manage", "hrm.sub.record", "hrm.sub.verify", "hrm.subipc.prepare", "hrm.subipc.approve"]) {
    assert.equal(permissionDef(c).audited, true, `${c} باید ممیزی شود`);
  }
  assert.equal(permissionDef("hrm.crew.view").audited, false);
  assert.equal(permissionDef("hrm.sub.view").audited, false);
});

test("نرخ قرارداد از حضور کارگاهی جدا طبقه‌بندی شده است", () => {
  /* سرپرست کارگاه سطح «داخلی» دارد؛ اگر ثبت حضور را سری می‌کردیم،
   * او نمی‌توانست بنویسد و کل زنجیره روی کاغذ می‌ماند. */
  assert.equal(permissionDef("hrm.sub.record").touches, "internal");
  assert.equal(permissionDef("hrm.sub.verify").touches, "internal");
  assert.equal(permissionDef("hrm.sub.manage").touches, "restricted");
  assert.equal(permissionDef("hrm.subipc.approve").touches, "restricted");
});

test("سه قاعدهٔ تفکیک وظیفهٔ D6 برقرار است", () => {
  const ids = SOD_RULES.map((r) => r.id);
  for (const id of ["SOD-21", "SOD-22", "SOD-23"]) assert.ok(ids.includes(id), `${id} نیست`);
  assert.equal(SOD_RULES.find((r) => r.id === "SOD-22").severity, "critical");
  for (const id of ["SOD-21", "SOD-22", "SOD-23"]) {
    const r = SOD_RULES.find((x) => x.id === id);
    assert.ok(PERMISSION_CATALOG.some((p) => p.code === r.a), `${id}.a ناموجود`);
    assert.ok(PERMISSION_CATALOG.some((p) => p.code === r.b), `${id}.b ناموجود`);
  }
});

test("هیچ نقشی به‌تنهایی تفکیک وظیفهٔ نیروی پیمانکاری را نقض نمی‌کند", () => {
  for (const r of ROLE_CATALOG) {
    const v = sodViolations(effectivePermissions(r.code)).map((x) => x.id);
    assert.deepEqual(v, [], `نقش ${r.code}`);
  }
});

test("زنجیرهٔ حضور تا پرداخت میان چهار نقش پخش شده است", () => {
  const has = (role, perm) => effectivePermissions(role).includes(perm);
  assert.ok(has("site_engineer", "hrm.sub.record"), "ثبت با کارگاه");
  assert.ok(has("hr_manager", "hrm.sub.verify"), "تأیید با منابع انسانی");
  assert.ok(has("contracts_manager", "hrm.subipc.prepare"), "تهیه با مدیر پیمان");
  assert.ok(has("project_manager", "hrm.subipc.approve"), "تأیید با مدیر پروژه");
  assert.equal(has("site_engineer", "hrm.sub.verify"), false);
  assert.equal(has("contracts_manager", "hrm.subipc.approve"), false);
});

test("ترکیب اکیپ دست کارگاه و منابع انسانی است؛ انحلال یک پله بالاتر", () => {
  const has = (role, perm) => effectivePermissions(role).includes(perm);
  assert.ok(has("site_engineer", "hrm.crew.manage"));
  assert.ok(has("hr_manager", "hrm.crew.manage"));
  assert.equal(has("site_engineer", "hrm.crew.disband"), false, "انحلال دست کارگاه نیست");
  assert.ok(has("project_manager", "hrm.crew.disband"));
  assert.ok(has("planner", "hrm.crew.view"), "برنامه‌ریز باید نرخ استفاده را ببیند");
  assert.equal(has("planner", "hrm.crew.manage"), false);
});

test("نرخ قرارداد پیمانکاری از دید کارگاه پنهان است", () => {
  assert.equal(effectivePermissions("site_engineer").includes("hrm.sub.view"), false);
  assert.ok(effectivePermissions("cost_controller").includes("hrm.sub.view"));
});

test("سطح مجوز از سطح دسترسی نقش‌های دارنده بالاتر نیست", () => {
  /* دادن مجوز سری به نقش محرمانه ۴۰۳ خاموش در زمان اجرا می‌سازد. */
  const rank = { public: 0, internal: 1, confidential: 2, restricted: 3 };
  const d6 = new Set(["hrm.crew.view", "hrm.crew.manage", "hrm.crew.disband", "hrm.sub.view", "hrm.sub.manage", "hrm.sub.record", "hrm.sub.verify", "hrm.subipc.prepare", "hrm.subipc.approve"]);
  for (const r of ROLE_CATALOG) {
    for (const p of effectivePermissions(r.code)) {
      if (!d6.has(p)) continue;
      assert.ok(rank[permissionDef(p).touches] <= rank[r.clearance], `${r.code} (${r.clearance}) نمی‌تواند ${p} را اعمال کند`);
    }
  }
});
