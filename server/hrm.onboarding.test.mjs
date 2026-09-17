/**
 * آزمون موتور پذیرش، احکام و انطباق — HRM D7.
 *
 * محور: دروازه‌ای که تصمیم می‌گیرد چه کسی حق کار دارد. هر شکاف اینجا
 * یعنی نفری بدون مدرک معتبر پای کار می‌رود.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMOB_ITEMS,
  DEMOB_ITEM_FA,
  DEMOB_OPTIONAL,
  DOC_EXPIRY_WARN_DAYS,
  DOC_TYPES,
  DOC_TYPE_FA,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_FA,
  MOB_GATES,
  MOB_GATE_FA,
  MOB_REQUEST_TYPES,
  MOB_REQ_STATES,
  MOB_REQ_STATE_FA,
  MOB_REQ_TRANSITIONS,
  PERSON_STATUSES,
  PERSON_STATUS_FA,
  PERSON_TRANSITIONS,
  canTransitionMobRequest,
  canTransitionPerson,
  compliancePanel,
  demobProgress,
  docCompliance,
  docState,
  evaluateMobGates,
  expiryWatch,
  personNextStates,
  skillMatrix,
  validateMobRequest,
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

const TODAY = "2026-09-10";
const T = (n) => tableDef(n);

/* ══════════ ۱. کاتالوگ‌ها ══════════ */

test("کاتالوگ وضعیت، نوع استخدام، مدرک، گیت و تخلیه کامل و ترجمه‌دار است", () => {
  assert.equal(PERSON_STATUSES.length, 6);
  assert.equal(EMPLOYMENT_TYPES.length, 5);
  assert.equal(DOC_TYPES.length, 8);
  assert.equal(MOB_GATES.length, 5);
  assert.equal(DEMOB_ITEMS.length, 5);
  assert.equal(MOB_REQ_STATES.length, 7);
  for (const s of PERSON_STATUSES) assert.ok(PERSON_STATUS_FA[s], `ترجمهٔ ${s} نیست`);
  for (const e of EMPLOYMENT_TYPES) assert.ok(EMPLOYMENT_TYPE_FA[e], `ترجمهٔ ${e} نیست`);
  for (const d of DOC_TYPES) assert.ok(DOC_TYPE_FA[d], `ترجمهٔ ${d} نیست`);
  for (const g of MOB_GATES) assert.ok(MOB_GATE_FA[g], `ترجمهٔ ${g} نیست`);
  for (const i of DEMOB_ITEMS) assert.ok(DEMOB_ITEM_FA[i], `ترجمهٔ ${i} نیست`);
  for (const s of MOB_REQ_STATES) assert.ok(MOB_REQ_STATE_FA[s], `ترجمهٔ ${s} نیست`);
});

test("هر وضعیت نفر مقصد تعریف‌شده دارد و قطع همکاری بن‌بست است", () => {
  for (const s of PERSON_STATUSES) assert.ok(Array.isArray(PERSON_TRANSITIONS[s]), `${s} گذار ندارد`);
  assert.deepEqual(PERSON_TRANSITIONS.terminated, [], "قطع همکاری نباید برگشت داشته باشد");
  assert.deepEqual(MOB_REQ_TRANSITIONS.fulfilled, []);
  assert.deepEqual(MOB_REQ_TRANSITIONS.cancelled, []);
});

test("هر مقصد گذار خودش وضعیت معتبری است", () => {
  for (const [from, tos] of Object.entries(PERSON_TRANSITIONS)) {
    for (const to of tos) assert.ok(PERSON_STATUSES.includes(to), `${from} → ${to} نامعتبر`);
  }
  for (const [from, tos] of Object.entries(MOB_REQ_TRANSITIONS)) {
    for (const to of tos) assert.ok(MOB_REQ_STATES.includes(to), `${from} → ${to} نامعتبر`);
  }
});

test("تجهیز دوبارهٔ نیروی تخلیه‌شده ممکن است", () => {
  /* در پروژه‌های عمرانی، بازگشت نیروی فصلی قاعده است نه استثنا. */
  assert.ok(personNextStates("demobilized").includes("active"));
  assert.deepEqual(personNextStates("ناموجود"), []);
});

/* ══════════ ۲. وضعیت مدرک ══════════ */

test("مدرک بدون تاریخ انقضا دائمی است نه منقضی", () => {
  /* اگر این را «منقضی» می‌گرفتیم، کارت ملی هر نفر پرونده‌اش را قرمز
   * می‌کرد و کل تابلو بی‌معنا می‌شد. */
  const s = docState({ DocType: "id_card" }, TODAY);
  assert.equal(s.state, "undated");
  assert.equal(s.daysLeft, null);
  assert.ok(s.messageFa.includes("دائمی"));
});

test("مدرک معتبر، رو به انقضا و منقضی تفکیک می‌شوند", () => {
  assert.equal(docState({ DocType: "medical", ExpiresAt: "2027-01-01" }, TODAY).state, "valid");
  assert.equal(docState({ DocType: "medical", ExpiresAt: "2026-10-01" }, TODAY).state, "expiring");
  assert.equal(docState({ DocType: "medical", ExpiresAt: "2026-08-01" }, TODAY).state, "expired");
});

test("مرز پنجرهٔ هشدار دقیق است", () => {
  const edge = docState({ DocType: "medical", ExpiresAt: "2026-10-10" }, TODAY);
  assert.equal(edge.daysLeft, DOC_EXPIRY_WARN_DAYS);
  assert.equal(edge.state, "expiring", "روز سی‌ام هنوز داخل پنجره است");
  assert.equal(docState({ DocType: "medical", ExpiresAt: "2026-10-11" }, TODAY).state, "valid");
});

test("مدرکی که امروز منقضی می‌شود هنوز معتبر است", () => {
  /* روز انقضا روز آخر اعتبار است، نه اولین روز بی‌اعتباری. */
  const s = docState({ DocType: "contract", ExpiresAt: TODAY }, TODAY);
  assert.equal(s.daysLeft, 0);
  assert.equal(s.state, "expiring");
});

test("وضعیت ذخیره‌شده نادیده گرفته می‌شود و تاریخ حاکم است", () => {
  /* ستون Status دیروز نوشته شده و هیچ کار پس‌زمینه‌ای به‌روزش نمی‌کند. */
  const s = docState({ DocType: "medical", ExpiresAt: "2026-01-01", Status: "valid" }, TODAY);
  assert.equal(s.state, "expired");
});

test("تاریخ بدقالب به‌جای خطای پنهان، «بدون تاریخ» گزارش می‌شود", () => {
  const s = docState({ DocType: "visa", ExpiresAt: "1405/06/19" }, TODAY);
  assert.equal(s.state, "undated");
  assert.ok(s.messageFa.includes("نامعتبر"));
});

test("پرچم مسدودکننده در وضعیت مدرک حفظ می‌شود", () => {
  assert.equal(docState({ DocType: "hse_card", ExpiresAt: "2026-08-01", IsBlocking: 1 }, TODAY).isBlocking, true);
  assert.equal(docState({ DocType: "other", ExpiresAt: "2026-08-01" }, TODAY).isBlocking, false);
});

/* ══════════ ۳. انطباق مدارک ══════════ */

const DOCS_OK = [
  { DocType: "contract", ExpiresAt: "2027-06-01", IsBlocking: 1 },
  { DocType: "medical", ExpiresAt: "2027-01-01", IsBlocking: 1 },
  { DocType: "id_card" },
];

test("پروندهٔ سالم هیچ ایراد مسدودکننده‌ای ندارد", () => {
  const c = docCompliance(DOCS_OK, TODAY);
  assert.equal(c.total, 3);
  assert.equal(c.valid, 3, "مدرک دائمی هم معتبر شمرده می‌شود");
  assert.equal(c.blockingExpired, 0);
  assert.equal(c.issues.length, 0);
});

test("مدرک مسدودکنندهٔ منقضی خطا و غیرمسدودکننده هشدار می‌دهد", () => {
  const c = docCompliance([
    { DocType: "medical", ExpiresAt: "2026-01-01", IsBlocking: 1 },
    { DocType: "insurance", ExpiresAt: "2026-01-01" },
  ], TODAY);
  assert.equal(c.expired, 2);
  assert.equal(c.blockingExpired, 1);
  const err = c.issues.find((i) => i.code === "E-HRM-201");
  const warn = c.issues.find((i) => i.code === "W-HRM-520");
  assert.equal(err.severity, "error");
  assert.equal(warn.severity, "warning");
});

test("مدرک رو به انقضا هشدار می‌دهد ولی مانع نیست", () => {
  const c = docCompliance([{ DocType: "medical", ExpiresAt: "2026-09-20", IsBlocking: 1 }], TODAY);
  assert.equal(c.expiring, 1);
  assert.equal(c.blockingExpired, 0);
  assert.equal(c.issues.filter((i) => i.severity === "error").length, 0);
  assert.ok(c.issues.some((i) => i.code === "W-HRM-521"));
});

test("پروندهٔ خالی ایراد نمی‌دهد ولی گیت‌ها جدا آن را می‌گیرند", () => {
  const c = docCompliance([], TODAY);
  assert.equal(c.total, 0);
  assert.deepEqual(c.issues, []);
});

/* ══════════ ۴. ماتریس مهارت ══════════ */

test("سطح صفر «ارزیابی‌نشده» است و در میانگین نمی‌آید", () => {
  /* قاطی کردن «نمی‌دانیم» با «بلد نیست» باعث می‌شود برای کسی برنامهٔ
   * آموزشی بریزیم که شاید اصلاً نیازی ندارد. */
  const m = skillMatrix([
    { SkillCode: "WLD-6G", Level: 4 },
    { SkillCode: "RIG-1", Level: 2 },
    { SkillCode: "SCAF", Level: 0 },
  ], TODAY);
  assert.equal(m.count, 3);
  assert.equal(m.assessed, 2);
  assert.equal(m.unassessed, 1);
  assert.equal(m.averageLevel, 3, "میانگین فقط از ارزیابی‌شده‌ها");
});

test("صلاحیت مسدودکنندهٔ منقضی خطا می‌دهد", () => {
  const m = skillMatrix([
    { SkillCode: "WLD-6G", SkillNameFa: "جوشکاری ۶G", Level: 4, ExpiresAt: "2026-01-01", IsBlocking: 1 },
  ], TODAY);
  assert.equal(m.expiredBlocking, 1);
  const e = m.issues.find((i) => i.code === "E-HRM-201");
  assert.ok(e);
  assert.ok(e.messageFa.includes("جوشکاری ۶G"));
});

test("صلاحیت رو به انقضا فقط هشدار می‌دهد", () => {
  const m = skillMatrix([{ SkillCode: "RIG-1", SkillNameFa: "ریگری", Level: 3, ExpiresAt: "2026-09-25", IsBlocking: 1 }], TODAY);
  assert.equal(m.expiredBlocking, 0);
  assert.equal(m.issues.filter((i) => i.severity === "error").length, 0);
  assert.ok(m.issues.some((i) => i.code === "W-HRM-521"));
});

test("ماتریس خالی امن است", () => {
  const m = skillMatrix([], TODAY);
  assert.equal(m.count, 0);
  assert.equal(m.averageLevel, null, "میانگین نداریم، صفر نیست");
});

/* ══════════ ۵. پنج گیت تجهیز ══════════ */

const GATE_INPUT_OK = {
  docs: DOCS_OK,
  skills: [],
  hseCleared: true,
  gatePassRef: "GP-100",
  todayIso: TODAY,
};

test("پروندهٔ کامل هر پنج گیت را سبز می‌کند", () => {
  const g = evaluateMobGates(GATE_INPUT_OK);
  assert.equal(g.gates.length, 5);
  assert.equal(g.ok, true);
  assert.deepEqual(g.blockersFa, []);
  assert.deepEqual(g.warningsFa, []);
  assert.ok(g.gates.every((x) => x.titleFa && x.titleFa.length > 2));
});

test("نبود قرارداد گیت اول را می‌بندد", () => {
  const g = evaluateMobGates({ ...GATE_INPUT_OK, docs: DOCS_OK.filter((d) => d.DocType !== "contract") });
  assert.equal(g.ok, false);
  const gate = g.gates.find((x) => x.gate === "contract");
  assert.equal(gate.ok, false);
  assert.equal(gate.code, "E-HRM-210");
});

test("طب کار منقضی گیت دوم را می‌بندد", () => {
  const g = evaluateMobGates({
    ...GATE_INPUT_OK,
    docs: [{ DocType: "contract", ExpiresAt: "2027-06-01" }, { DocType: "medical", ExpiresAt: "2026-01-01", IsBlocking: 1 }],
  });
  assert.equal(g.ok, false);
  assert.equal(g.gates.find((x) => x.gate === "medical").code, "E-HRM-211");
});

test("دروازهٔ ایمنی استعلام‌نشده قرمز است نه سبز", () => {
  /* نبودِ خبر، خبر خوب نیست: اگر null را سبز می‌گرفتیم، هر خطای
   * شبکه‌ای در تماس با HSE یک نفر را بی‌صدا مجاز می‌کرد. */
  const g = evaluateMobGates({ ...GATE_INPUT_OK, hseCleared: null });
  assert.equal(g.ok, false);
  const gate = g.gates.find((x) => x.gate === "hse_training");
  assert.equal(gate.code, "E-HRM-202");
  assert.ok(gate.messageFa.includes("استعلام"));
});

test("دلیل بستهٔ دروازهٔ ایمنی از خود ماژول ایمنی نقل می‌شود", () => {
  const g = evaluateMobGates({ ...GATE_INPUT_OK, hseCleared: false, hseBlockersFa: ["آموزش: دورهٔ عمومی گذرانده نشده"] });
  assert.ok(g.gates.find((x) => x.gate === "hse_training").messageFa.includes("دورهٔ عمومی"));
});

test("مدرک یا صلاحیت مسدودکنندهٔ منقضی گیت چهارم را می‌بندد", () => {
  const withDoc = evaluateMobGates({
    ...GATE_INPUT_OK,
    docs: [...DOCS_OK, { DocType: "hse_card", ExpiresAt: "2026-01-01", IsBlocking: 1 }],
  });
  assert.equal(withDoc.gates.find((x) => x.gate === "trade_docs").ok, false);

  const withSkill = evaluateMobGates({
    ...GATE_INPUT_OK,
    skills: [{ SkillCode: "WLD-6G", ExpiresAt: "2026-01-01", IsBlocking: 1 }],
  });
  assert.equal(withSkill.gates.find((x) => x.gate === "trade_docs").code, "E-HRM-201");
});

test("کارت تردد هشدار است نه مانع", () => {
  /* حراست گاهی یک روز عقب می‌افتد؛ مسدود کردن فعال‌سازی به‌خاطر آن
   * تنها نتیجه‌اش دور زدن سامانه بود. */
  const g = evaluateMobGates({ ...GATE_INPUT_OK, gatePassRef: null });
  assert.equal(g.ok, true, "کارت تردد نباید فعال‌سازی را ببندد");
  assert.equal(g.blockersFa.length, 0);
  assert.equal(g.warningsFa.length, 1);
  const gate = g.gates.find((x) => x.gate === "gate_pass");
  assert.equal(gate.isBlocking, false);
  assert.equal(gate.code, "W-HRM-330");
});

test("رشتهٔ خالی کارت تردد با نبودش یکسان رفتار می‌شود", () => {
  assert.equal(evaluateMobGates({ ...GATE_INPUT_OK, gatePassRef: "   " }).warningsFa.length, 1);
});

test("چند مانع هم‌زمان همه یکجا گزارش می‌شوند", () => {
  const g = evaluateMobGates({ docs: [], skills: [], hseCleared: false, gatePassRef: null, todayIso: TODAY });
  assert.equal(g.blockersFa.length, 3, "قرارداد، طب کار و ایمنی");
  assert.equal(g.warningsFa.length, 1);
});

test("جدیدترین مدرک هم‌نوع مبنا قرار می‌گیرد", () => {
  /* قرارداد تمدیدشده نباید به‌خاطر نسخهٔ قدیمیِ منقضی رد شود. */
  const g = evaluateMobGates({
    ...GATE_INPUT_OK,
    docs: [
      { DocType: "contract", DocNo: "C-1", ExpiresAt: "2026-01-01" },
      { DocType: "contract", DocNo: "C-2", ExpiresAt: "2027-06-01" },
      { DocType: "medical", ExpiresAt: "2027-01-01" },
    ],
  });
  assert.equal(g.gates.find((x) => x.gate === "contract").ok, true);
});

/* ══════════ ۶. گذار وضعیت نفر ══════════ */

const GATES_OK = { ok: true, blockersFa: [] };

test("گذار مجاز با گیت سبز انجام می‌شود", () => {
  assert.equal(canTransitionPerson({ from: "onboarding", to: "active", gates: GATES_OK }).ok, true);
  assert.equal(canTransitionPerson({ from: "candidate", to: "onboarding" }).ok, true);
});

test("گذار غیرمجاز رد می‌شود", () => {
  const r = canTransitionPerson({ from: "candidate", to: "active", gates: GATES_OK });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-217");
  assert.ok(r.messageFa.includes("داوطلب"));
});

test("قطع همکاری برگشت ندارد", () => {
  assert.equal(canTransitionPerson({ from: "terminated", to: "active", gates: GATES_OK }).code, "E-HRM-217");
});

test("وضعیت تکراری و ناشناخته رد می‌شوند", () => {
  assert.equal(canTransitionPerson({ from: "active", to: "active" }).code, "E-HRM-216");
  assert.equal(canTransitionPerson({ from: "active", to: "ناموجود" }).code, "E-HRM-215");
});

test("فعال‌سازی بدون ارزیابی گیت ممکن نیست", () => {
  /* حذف پارامتر gates نباید به «سبز فرض کن» ترجمه شود. */
  const r = canTransitionPerson({ from: "onboarding", to: "active" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-218");
});

test("فعال‌سازی با گیت قرمز، موانع را یکجا برمی‌گرداند", () => {
  const r = canTransitionPerson({
    from: "onboarding",
    to: "active",
    gates: { ok: false, blockersFa: ["قرارداد نیست", "طب کار منقضی"] },
  });
  assert.equal(r.code, "E-HRM-219");
  assert.equal(r.detailsFa.length, 2);
});

test("گذار به مرخصی گیت نمی‌خواهد", () => {
  assert.equal(canTransitionPerson({ from: "active", to: "on_leave" }).ok, true);
});

test("نفر دارای برگهٔ تأییدنشده تخلیه نمی‌شود", () => {
  /* ساعت یتیم: برگهٔ نفری که رفته هرگز تأیید نمی‌شود و آن ساعت نه به
   * هزینه می‌رسد نه به بهره‌وری. */
  const r = canTransitionPerson({ from: "active", to: "demobilized", openTimesheets: 3 });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-123");
  assert.ok(r.detailsFa[0].includes("3"));
});

test("چک‌لیست ناقص جلوی تخلیه را می‌گیرد و همهٔ بندها را می‌گوید", () => {
  const r = canTransitionPerson({
    from: "active",
    to: "demobilized",
    openTimesheets: 0,
    demobChecklist: { done: 1, mandatoryTotal: 4, pendingFa: ["تحویل کارت تردد انجام نشده", "تسویه‌حساب نهایی انجام نشده"] },
  });
  assert.equal(r.code, "E-HRM-123");
  assert.equal(r.detailsFa.length, 2);
});

test("تخلیه با چک‌لیست کامل و بدون برگهٔ باز انجام می‌شود", () => {
  const r = canTransitionPerson({
    from: "active",
    to: "demobilized",
    openTimesheets: 0,
    demobChecklist: { done: 4, mandatoryTotal: 4, pendingFa: [] },
  });
  assert.equal(r.ok, true);
});

test("قطع همکاری بدون دلیل کافی رد می‌شود", () => {
  assert.equal(canTransitionPerson({ from: "active", to: "terminated", reasonFa: "رفت" }).code, "E-HRM-220");
  assert.equal(canTransitionPerson({ from: "active", to: "terminated", reasonFa: "انصراف کتبی نیرو در تاریخ مذکور" }).ok, true);
});

/* ══════════ ۷. چک‌لیست تخلیه ══════════ */

test("بند ثبت‌نشده «انجام‌نشده» است نه «وجود ندارد»", () => {
  const p = demobProgress([]);
  assert.equal(p.total, 5, "همهٔ بندها باید ساخته شوند");
  assert.equal(p.done, 0);
  assert.equal(p.isComplete, false);
  assert.equal(p.pendingFa.length, 4);
});

test("مصاحبهٔ خروج اختیاری است و مانع تکمیل نیست", () => {
  const rows = DEMOB_ITEMS
    .filter((c) => !DEMOB_OPTIONAL.includes(c))
    .map((c) => ({ ItemCode: c, IsDone: 1, IsMandatory: 1 }));
  const p = demobProgress(rows);
  assert.equal(p.mandatoryTotal, 4);
  assert.equal(p.mandatoryDone, 4);
  assert.equal(p.isComplete, true, "بدون مصاحبهٔ خروج هم کامل است");
  assert.equal(p.done, 4);
});

test("بند اجباریِ ناتمام تکمیل را می‌بندد", () => {
  const p = demobProgress([
    { ItemCode: "tools_returned", IsDone: 1, IsMandatory: 1 },
    { ItemCode: "gate_pass_returned", IsDone: 0, IsMandatory: 1 },
  ]);
  assert.equal(p.isComplete, false);
  assert.ok(p.pendingFa.some((x) => x.includes("کارت تردد")));
});

test("بند دلخواه می‌تواند اجباری اعلام شود", () => {
  /* برخی پروژه‌ها مصاحبهٔ خروج را الزامی می‌کنند. */
  const rows = DEMOB_ITEMS.map((c) => ({ ItemCode: c, IsDone: c === "exit_interview" ? 0 : 1, IsMandatory: 1 }));
  const p = demobProgress(rows);
  assert.equal(p.mandatoryTotal, 5);
  assert.equal(p.isComplete, false);
});

/* ══════════ ۸. درخواست تجهیز ══════════ */

const REQ_OK = {
  requestType: "mobilize",
  tradeCode: "CIV-FRM",
  qty: 12,
  needByDate: "2026-10-01",
  justificationFa: "شروع عملیات قالب‌بندی منطقهٔ سه",
  todayIso: TODAY,
};

test("درخواست معتبر ایرادی ندارد", () => {
  assert.deepEqual(validateMobRequest(REQ_OK), []);
});

test("نوع، رسته، تعداد و توجیه اجباری‌اند", () => {
  const i = validateMobRequest({ requestType: "خرید", tradeCode: "", qty: 0, needByDate: "", justificationFa: "زود" });
  for (const c of ["E-HRM-230", "E-HRM-231", "E-HRM-232", "E-HRM-233", "E-HRM-234"]) {
    assert.ok(i.some((x) => x.code === c), `${c} نیست`);
  }
});

test("تعداد اعشاری یا منفی رد می‌شود", () => {
  assert.ok(validateMobRequest({ ...REQ_OK, qty: 2.5 }).some((x) => x.code === "E-HRM-232"));
  assert.ok(validateMobRequest({ ...REQ_OK, qty: -3 }).some((x) => x.code === "E-HRM-232"));
});

test("تاریخ نیاز گذشته هشدار است نه خطا", () => {
  /* درخواست عقب‌افتاده واقعیت کارگاه است؛ رد کردنش کاربر را وادار به
   * تاریخ جعلی می‌کرد. */
  const i = validateMobRequest({ ...REQ_OK, needByDate: "2026-08-01" });
  assert.equal(i.filter((x) => x.severity === "error").length, 0);
  assert.ok(i.some((x) => x.code === "W-HRM-522"));
});

test("گذار درخواست: مسیر عادی باز و پرش ممنوع", () => {
  assert.equal(canTransitionMobRequest({ from: "draft", to: "submitted" }).ok, true);
  assert.equal(canTransitionMobRequest({ from: "submitted", to: "approved" }).ok, true);
  assert.equal(canTransitionMobRequest({ from: "draft", to: "approved" }).code, "E-HRM-236");
  assert.equal(canTransitionMobRequest({ from: "fulfilled", to: "draft" }).code, "E-HRM-236");
});

test("رد و لغو بدون دلیل ممکن نیست", () => {
  assert.equal(canTransitionMobRequest({ from: "submitted", to: "rejected", reasonFa: "نه" }).code, "E-HRM-237");
  assert.equal(canTransitionMobRequest({ from: "submitted", to: "rejected", reasonFa: "بودجهٔ دوره کافی نیست" }).ok, true);
});

test("درخواست ناتمام بسته نمی‌شود", () => {
  /* بستن نیمه‌تمام یعنی کسری نیرو از رادار خارج می‌شود. */
  const r = canTransitionMobRequest({ from: "in_progress", to: "fulfilled", fulfilledQty: 7, qty: 12 });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-238");
  assert.ok(r.messageFa.includes("7"));
  assert.equal(canTransitionMobRequest({ from: "in_progress", to: "fulfilled", fulfilledQty: 12, qty: 12 }).ok, true);
});

test("وضعیت مقصد ناشناخته رد می‌شود", () => {
  assert.equal(canTransitionMobRequest({ from: "draft", to: "ناموجود" }).code, "E-HRM-235");
});

/* ══════════ ۹. تابلوی انطباق ══════════ */

const PEOPLE = [
  { Id: "P1", PersonnelNo: "1001", FullNameFa: "علی رضایی", PrimaryTradeCode: "CIV-FRM", Status: "active", GatePassRef: "GP-1" },
  { Id: "P2", PersonnelNo: "1002", FullNameFa: "حسن کریمی", PrimaryTradeCode: "CIV-RBR", Status: "active", GatePassRef: "GP-2" },
  { Id: "P3", PersonnelNo: "1003", FullNameFa: "رضا نوری", PrimaryTradeCode: "ELE-CBL", Status: "onboarding" },
];

test("نفرِ فعالِ ناسازگار جدا شمرده و اول فهرست می‌آید", () => {
  /* خطرناک‌ترین حالت: سامانه او را مجاز می‌داند ولی مدرکش منقضی است. */
  const panel = compliancePanel(PEOPLE, {
    P1: DOCS_OK,
    P2: [{ DocType: "medical", ExpiresAt: "2026-01-01", IsBlocking: 1 }],
    P3: [],
  }, {}, TODAY);

  assert.equal(panel.headcount, 3);
  assert.equal(panel.activeCount, 2);
  assert.equal(panel.blockedActiveCount, 1);
  assert.equal(panel.rows[0].personId, "P2", "ناسازگارِ فعال باید اول باشد");
  assert.equal(panel.rows[0].flag, "red");
  assert.ok(panel.rows[0].blockersFa.length > 0);
});

test("نفر رو به انقضا زرد است نه قرمز", () => {
  const panel = compliancePanel([PEOPLE[0]], {
    P1: [{ DocType: "medical", ExpiresAt: "2026-09-20", IsBlocking: 1 }],
  }, {}, TODAY);
  assert.equal(panel.rows[0].flag, "amber");
  assert.equal(panel.rows[0].isCompliant, true);
  assert.equal(panel.expiringSoonCount, 1);
});

test("صلاحیت منقضی هم نفر را قرمز می‌کند", () => {
  const panel = compliancePanel([PEOPLE[0]], { P1: DOCS_OK }, {
    P1: [{ SkillCode: "WLD-6G", SkillNameFa: "جوشکاری", Level: 4, ExpiresAt: "2026-01-01", IsBlocking: 1 }],
  }, TODAY);
  assert.equal(panel.rows[0].flag, "red");
  assert.equal(panel.compliantCount, 0);
});

test("نفرِ فعالِ بدون کارت تردد شمرده می‌شود", () => {
  const panel = compliancePanel([
    { Id: "PX", PersonnelNo: "9", FullNameFa: "بدون کارت", Status: "active" },
  ], {}, {}, TODAY);
  assert.equal(panel.noGatePassCount, 1);
});

test("نفر در حال پذیرش بدون کارت تردد شمرده نمی‌شود", () => {
  /* او هنوز قرار نیست وارد کارگاه شود. */
  const panel = compliancePanel([PEOPLE[2]], { P3: [] }, {}, TODAY);
  assert.equal(panel.noGatePassCount, 0);
});

test("تفکیک وضعیت‌ها درست شمرده می‌شود", () => {
  const panel = compliancePanel(PEOPLE, {}, {}, TODAY);
  assert.equal(panel.byStatus.active, 2);
  assert.equal(panel.byStatus.onboarding, 1);
  assert.ok(panel.rows.every((r) => r.statusFa && r.statusFa.length > 1));
});

test("تابلوی خالی امن است", () => {
  const panel = compliancePanel([], {}, {}, TODAY);
  assert.equal(panel.headcount, 0);
  assert.equal(panel.compliantCount, 0);
  assert.deepEqual(panel.rows, []);
});

/* ══════════ ۱۰. پایش انقضا ══════════ */

const WATCH_DOCS = [
  { PersonId: "P1", DocType: "medical", ExpiresAt: "2026-09-15", IsBlocking: 1 },
  { PersonId: "P2", DocType: "hse_card", ExpiresAt: "2026-08-01", IsBlocking: 1 },
  { PersonId: "P3", DocType: "insurance", ExpiresAt: "2026-09-25" },
  { PersonId: "P4", DocType: "contract", ExpiresAt: "2027-06-01" },
  { PersonId: "P5", DocType: "id_card" },
];

test("پایش فقط مدارک داخل افق را برمی‌گرداند", () => {
  const w = expiryWatch(WATCH_DOCS, TODAY);
  assert.equal(w.length, 3, "قرارداد دور و کارت ملی دائمی نباید بیایند");
  assert.equal(w.every((x) => x.docTypeFa && x.docTypeFa.length > 1), true);
});

test("فوری‌ترین اول می‌آید و منقضی‌شده خطاست", () => {
  const w = expiryWatch(WATCH_DOCS, TODAY);
  assert.equal(w[0].personId, "P2", "منقضی‌شده باید اول باشد");
  assert.ok(w[0].daysLeft < 0);
  assert.equal(w[0].severity, "error");
  assert.deepEqual(w.map((x) => x.daysLeft), [...w.map((x) => x.daysLeft)].sort((a, b) => a - b));
});

test("منقضی غیرمسدودکننده هشدار است نه خطا", () => {
  const w = expiryWatch([{ PersonId: "PX", DocType: "insurance", ExpiresAt: "2026-01-01" }], TODAY);
  assert.equal(w[0].severity, "warning");
});

test("افق قابل تنظیم است", () => {
  assert.equal(expiryWatch(WATCH_DOCS, TODAY, 400).length, 4, "قرارداد هم داخل افق یک‌ساله می‌آید");
  assert.equal(expiryWatch(WATCH_DOCS, TODAY, 0).length, 1, "فقط منقضی‌شده");
});

/* ══════════ ۱۱. اسکیما و مهاجرت ══════════ */

test("پنج جدول D7 در اسکیما هستند و به d10 تعلق دارند", () => {
  for (const n of ["HrmPerson", "HrmPersonDoc", "HrmSkill", "HrmMobRequest", "HrmDemobCheck"]) {
    const t = T(n);
    assert.ok(t, `جدول ${n} نیست`);
    assert.equal(t.module, "d10");
    assert.equal(t.pk, "Id");
    assert.ok(t.title.fa && t.title.en, `عنوان دوزبانه ندارد: ${n}`);
  }
});

test("مهاجرت 0026 سر جایش است و قبلی‌ها حفظ شده‌اند", () => {
  /* ادعای «آخرین بودن» شکننده است: هر تحویلی بعدی مهاجرت تازه اضافه
   * می‌کند و این آزمون بی‌دلیل می‌افتد. آنچه واقعاً اهمیت دارد وجود،
   * یکتایی و ترتیب است. */
  const v = MIGRATIONS.map((m) => m.version);
  assert.ok(v.includes("0025"), "مهاجرت اکیپ نباید حذف شود");
  assert.equal(MIGRATIONS.find((m) => m.version === "0026").name, "hrm_person_onboarding");
  assert.equal(new Set(v).size, v.length, "شمارهٔ مهاجرت تکراری");
  assert.deepEqual([...v].sort(), v, "ترتیب صعودی");
});

test("مهاجرت 0026 هر پنج جدول را می‌سازد و چیزی حذف نمی‌کند", () => {
  const m = MIGRATIONS.find((x) => x.version === "0026");
  const sql = m.statements.join("\n");
  for (const n of ["HrmPerson", "HrmPersonDoc", "HrmSkill", "HrmMobRequest", "HrmDemobCheck"]) {
    assert.ok(sql.includes(n), `${n} در مهاجرت نیست`);
  }
  assert.equal(m.statements.filter((s) => /DROP/i.test(s)).length, 0, "هیچ DROP مجاز نیست");
});

test("شمارهٔ پرسنلی در هر پروژه یکتاست", () => {
  const ux = T("HrmPerson").indexes.find((i) => i.unique);
  assert.deepEqual(ux.columns, ["ProjectId", "PersonnelNo"]);
});

test("یک بند چک‌لیست تخلیه برای هر نفر فقط یک بار ثبت می‌شود", () => {
  assert.deepEqual(T("HrmDemobCheck").indexes.find((i) => i.unique).columns, ["PersonId", "ItemCode"]);
});

test("مدرک تکراری هم‌نوع و هم‌شماره ممکن نیست", () => {
  assert.deepEqual(T("HrmPersonDoc").indexes.find((i) => i.unique).columns, ["PersonId", "DocType", "DocNo"]);
});

test("ایندکس پایش انقضا وجود دارد", () => {
  /* بدون آن، تابلوی انطباق روی پروژهٔ بزرگ کل جدول را می‌خواند. */
  const ix = T("HrmPersonDoc").indexes.find((i) => i.name === "IX_HrmPersonDoc_Exp");
  assert.ok(ix);
  assert.deepEqual(ix.columns, ["ProjectId", "ExpiresAt", "IsBlocking"]);
});

test("اسکیما رشد می‌کند و جدول‌های پیشین حذف نشده‌اند", () => {
  /* کف، نه عدد دقیق: تحویلی بعدی جدول تازه می‌آورد و شمارندهٔ دقیق
   * این آزمون را بی‌ربط می‌شکند. آنچه باید محافظت شود، حذف‌نشدن
   * جدول‌های موجود است. */
  assert.ok(SCHEMA.length >= 132, `اسکیما کوچک شده: ${SCHEMA.length}`);
  for (const n of ["HrmCrew", "HrmSubIpc", "HrmTimesheetHeader", "HrmProductivityLog"]) {
    assert.ok(T(n), `${n} حذف شده است`);
  }
});

test("ستون‌های حساس پرونده اجباری‌اند و کد ملی اختیاری است", () => {
  const p = Object.fromEntries(T("HrmPerson").columns.map((c) => [c.name, c]));
  for (const n of ["ProjectId", "PersonnelNo", "FullNameFa", "EmploymentType", "PrimaryTradeCode", "Status", "HseClearance"]) {
    assert.equal(p[n].nullable, false, `${n} نباید nullable باشد`);
  }
  /* کد ملی برای نیروی پیمانکاری خارجی همیشه در دسترس نیست؛ اجباری
   * کردنش کاربر را وادار به عدد جعلی می‌کرد. */
  assert.equal(p.NationalId.nullable, true);
  assert.equal(p.CreatedAt, undefined, "ستون CreatedAt خودکار افزوده می‌شود");
});

/* ══════════ ۱۲. دسترسی ══════════ */

test("نُه مجوز D7 تعریف شده و به d10 تعلق دارند", () => {
  for (const c of [
    "hrm.person.view", "hrm.person.manage", "hrm.person.activate", "hrm.person.demobilize",
    "hrm.doc.upload", "hrm.doc.verify", "hrm.skill.assess",
    "hrm.mob.request", "hrm.mob.approve",
  ]) {
    const d = permissionDef(c);
    assert.ok(d, `مجوز ${c} نیست`);
    assert.equal(d.module, "d10");
    assert.match(c, /^[a-z]+\.[a-z]+\.[a-z]+$/);
  }
});

test("عمل‌های نوشتنی ممیزی می‌شوند و دیدن پرونده نه", () => {
  for (const c of ["hrm.person.manage", "hrm.person.activate", "hrm.person.demobilize", "hrm.doc.upload", "hrm.doc.verify", "hrm.skill.assess", "hrm.mob.request", "hrm.mob.approve"]) {
    assert.equal(permissionDef(c).audited, true, `${c} باید ممیزی شود`);
  }
  assert.equal(permissionDef("hrm.person.view").audited, false);
});

test("دیدن پرونده از دیدن اطلاعات فردی جدا طبقه‌بندی شده", () => {
  /* سرپرست کارگاه سطح «داخلی» دارد؛ باید بداند نفرش مدرک معتبر دارد
   * بی‌آنکه کد ملی او را ببیند. */
  assert.equal(permissionDef("hrm.person.view").touches, "internal");
  assert.equal(permissionDef("hrm.personal.view").touches, "restricted");
  assert.equal(permissionDef("hrm.doc.upload").touches, "internal");
  assert.equal(permissionDef("hrm.doc.verify").touches, "confidential");
});

test("سه قاعدهٔ تفکیک وظیفهٔ D7 برقرار و ارجاعشان معتبر است", () => {
  const ids = SOD_RULES.map((r) => r.id);
  for (const id of ["SOD-24", "SOD-25", "SOD-26"]) {
    assert.ok(ids.includes(id), `${id} نیست`);
    const r = SOD_RULES.find((x) => x.id === id);
    assert.ok(PERMISSION_CATALOG.some((p) => p.code === r.a), `${id}.a ناموجود`);
    assert.ok(PERMISSION_CATALOG.some((p) => p.code === r.b), `${id}.b ناموجود`);
    assert.ok(r.reason.fa && r.reason.en, `${id} دلیل دوزبانه ندارد`);
  }
});

test("هیچ نقشی به‌تنهایی تفکیک وظیفهٔ پذیرش را نقض نمی‌کند", () => {
  for (const r of ROLE_CATALOG) {
    assert.deepEqual(sodViolations(effectivePermissions(r.code)).map((x) => x.id), [], `نقش ${r.code}`);
  }
});

test("زنجیرهٔ پذیرش میان کارگاه، منابع انسانی و مدیر پروژه پخش شده", () => {
  const has = (role, perm) => effectivePermissions(role).includes(perm);
  assert.ok(has("site_engineer", "hrm.doc.upload"), "بارگذاری با کارگاه");
  assert.ok(has("hr_manager", "hrm.doc.verify"), "تأیید اصالت با منابع انسانی");
  assert.ok(has("hr_manager", "hrm.person.activate"), "فعال‌سازی با منابع انسانی");
  assert.ok(has("project_manager", "hrm.mob.approve"), "تأیید تجهیز با مدیر پروژه");
  assert.equal(has("site_engineer", "hrm.doc.verify"), false);
  assert.equal(has("site_engineer", "hrm.person.activate"), false);
  assert.equal(has("project_manager", "hrm.mob.request"), false);
});

test("فعال‌کنندهٔ نفر ثبت‌کنندهٔ ساعت او نیست", () => {
  /* SOD-26 در عمل: مدیر منابع انسانی فعال می‌کند، کارگاه ساعت می‌زند. */
  assert.equal(effectivePermissions("hr_manager").includes("hrm.timesheet.enter"), false);
  assert.ok(effectivePermissions("site_engineer").includes("hrm.timesheet.enter"));
});

test("کارگاه پرونده را می‌بیند ولی اطلاعات فردی را نه", () => {
  assert.ok(effectivePermissions("site_engineer").includes("hrm.person.view"));
  assert.equal(effectivePermissions("site_engineer").includes("hrm.personal.view"), false);
  assert.ok(effectivePermissions("hr_manager").includes("hrm.personal.view"));
});

test("سطح مجوز D7 از سطح دسترسی نقش‌های دارنده بالاتر نیست", () => {
  const rank = { public: 0, internal: 1, confidential: 2, restricted: 3 };
  const d7 = new Set([
    "hrm.person.view", "hrm.person.manage", "hrm.person.activate", "hrm.person.demobilize",
    "hrm.doc.upload", "hrm.doc.verify", "hrm.skill.assess", "hrm.mob.request", "hrm.mob.approve",
  ]);
  for (const r of ROLE_CATALOG) {
    for (const p of effectivePermissions(r.code)) {
      if (!d7.has(p)) continue;
      assert.ok(rank[permissionDef(p).touches] <= rank[r.clearance], `${r.code} (${r.clearance}) نمی‌تواند ${p} را اعمال کند`);
    }
  }
});
