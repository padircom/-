/**
 * آزمون موتور صورت‌وضعیت پیمانکار جزء و کسور پشت‌به‌پشت — CNT/D8.
 *
 * تمرکز روی جایی است که پیمانکار اصلی پول از دست می‌دهد: ردیفی که در
 * صورت‌وضعیت جزء تأیید شده ولی در اصلی رد یا کم شده، و تأیید جزء پیش
 * از تأیید صورت‌وضعیت اصلی.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  SUB_IPC_STATES, SUB_IPC_TRANSITIONS, SUB_IPC_STATE_FA,
  VARIANCE_FLAG_FA, BACK_TO_BACK_SOURCES, BACK_TO_BACK_SOURCE_FA,
  subIpcLines, backToBackSummary, subIpcTotals, canTransitionSubIpc,
  isSubIpcLocked, subIpcRegister, validateBackToBack,
} from "./cntLogic.js";

const line = (over = {}) => ({
  BoqItemId: "b1", DescriptionFa: "خاک‌برداری", Unit: "مترمکعب",
  Quantity: 100, UnitRate: 500, MainApprovedQty: 100, ...over,
});

/* ══════════════ ۱) واژگان و گذارها ══════════════ */

test("واژگان وضعیت کامل است", () => {
  assert.deepEqual(SUB_IPC_STATES, ["draft", "submitted", "reviewed", "approved", "rejected", "paid"]);
  for (const s of SUB_IPC_STATES) {
    assert.equal(typeof SUB_IPC_STATE_FA[s], "string", `${s} نام فارسی ندارد`);
  }
});

test("پرداخت‌شده بن‌بست است — اصلاح باید در دورهٔ بعد بیاید", () => {
  assert.deepEqual(SUB_IPC_TRANSITIONS.paid, []);
});

test("هر گذار به وضعیت موجود اشاره می‌کند", () => {
  for (const [from, tos] of Object.entries(SUB_IPC_TRANSITIONS)) {
    assert.ok(SUB_IPC_STATES.includes(from), `${from} در واژگان نیست`);
    for (const t of tos) assert.ok(SUB_IPC_STATES.includes(t), `${from}→${t} نامعتبر`);
  }
});

test("ردشده به پیش‌نویس برمی‌گردد — مسیر اصلاح باز است", () => {
  assert.deepEqual(SUB_IPC_TRANSITIONS.rejected, ["draft"]);
});

test("سه پرچم انحراف نام فارسی دارند", () => {
  for (const f of ["ok", "exceeds_main", "no_main_ref"]) {
    assert.ok(VARIANCE_FLAG_FA[f]);
  }
});

test("منشأهای کسر پشت‌به‌پشت تعریف شده‌اند", () => {
  assert.deepEqual([...BACK_TO_BACK_SOURCES], ["fin_material", "hse_incident", "qlt_rework", "other"]);
  for (const s of BACK_TO_BACK_SOURCES) assert.ok(BACK_TO_BACK_SOURCE_FA[s]);
});

/* ══════════════ ۲) ردیف‌ها و تطبیق با اصلی ══════════════ */

test("ردیف منطبق پرچم ok می‌گیرد", () => {
  const r = subIpcLines([line()]);
  assert.equal(r.gross, 50_000);
  assert.equal(r.lines[0].varianceFlag, "ok");
  assert.equal(r.exceedingCount, 0);
  assert.deepEqual(r.warningsFa, []);
});

test("مقدار کمتر از تأییدشدهٔ اصلی مشکلی ندارد", () => {
  const r = subIpcLines([line({ Quantity: 60, MainApprovedQty: 100 })]);
  assert.equal(r.lines[0].varianceFlag, "ok");
  assert.equal(r.lines[0].excessQty, null);
});

test("مقدار بیش از تأییدشدهٔ اصلی پرچم و مبلغ مازاد می‌سازد", () => {
  const r = subIpcLines([line({ Quantity: 130, MainApprovedQty: 100, UnitRate: 500 })]);
  assert.equal(r.lines[0].varianceFlag, "exceeds_main");
  assert.equal(r.lines[0].excessQty, 30);
  assert.equal(r.lines[0].excessAmount, 15_000);
  assert.equal(r.exceedingCount, 1);
  assert.equal(r.totalExcessAmount, 15_000);
  assert.ok(r.warningsFa[0].includes("از جیب پیمانکار اصلی"));
});

test("ردیف بدون مرجع از ردیف مازاد جدا است", () => {
  const r = subIpcLines([line({ BoqItemId: null })]);
  assert.equal(r.lines[0].varianceFlag, "no_main_ref");
  assert.equal(r.unmatchedCount, 1);
  assert.equal(r.exceedingCount, 0, "بی‌مرجع یعنی نمی‌دانیم، نه بیشتر");
});

test("مرجع بدون مقدار تأییدشده هم بی‌مرجع است", () => {
  const r = subIpcLines([line({ MainApprovedQty: null })]);
  assert.equal(r.lines[0].varianceFlag, "no_main_ref");
});

test("مقدار تأییدشدهٔ صفر معتبر است و مازاد می‌سازد", () => {
  const r = subIpcLines([line({ Quantity: 10, MainApprovedQty: 0 })]);
  assert.equal(r.lines[0].varianceFlag, "exceeds_main", "صفر یعنی هیچ‌چیز تأیید نشده، نه بی‌مرجع");
  assert.equal(r.lines[0].excessQty, 10);
});

test("مبلغ صریح بر حاصل‌ضرب اولویت دارد — ردیف مقطوع توافقی", () => {
  const r = subIpcLines([line({ Quantity: null, UnitRate: null, Amount: 7_777, BoqItemId: null })]);
  assert.equal(r.gross, 7_777);
});

test("چند ردیف با هم جمع و شمرده می‌شوند", () => {
  const r = subIpcLines([
    line({ Quantity: 100, MainApprovedQty: 100 }),
    line({ Quantity: 200, MainApprovedQty: 150, UnitRate: 100 }),
    line({ BoqItemId: null, Quantity: 10, UnitRate: 1_000 }),
  ]);
  assert.equal(r.gross, 50_000 + 20_000 + 10_000);
  assert.equal(r.exceedingCount, 1);
  assert.equal(r.unmatchedCount, 1);
  assert.equal(r.totalExcessAmount, 5_000);
  assert.equal(r.warningsFa.length, 2);
});

test("فهرست خالی صفر می‌دهد بدون هشدار", () => {
  const r = subIpcLines([]);
  assert.equal(r.gross, 0);
  assert.deepEqual(r.warningsFa, []);
});

/* ══════════════ ۳) کسور پشت‌به‌پشت ══════════════ */

test("فقط کسر تأییدشده شمرده می‌شود", () => {
  const s = backToBackSummary([
    { SourceModule: "fin_material", Amount: 1_000, Status: "approved", EvidenceDocNo: "D-1" },
    { SourceModule: "hse_incident", Amount: 2_000, Status: "draft" },
    { SourceModule: "qlt_rework", Amount: 3_000, Status: "disputed" },
    { SourceModule: "other", Amount: 4_000, Status: "waived" },
  ]);
  assert.equal(s.approvedTotal, 1_000);
  assert.equal(s.draftTotal, 2_000);
  assert.equal(s.disputedTotal, 3_000);
  assert.equal(s.waivedTotal, 4_000);
});

test("کسر مورد اختلاف کم نمی‌شود ولی اعلام می‌شود", () => {
  const s = backToBackSummary([{ SourceModule: "qlt_rework", Amount: 5_000, Status: "disputed" }]);
  assert.equal(s.approvedTotal, 0);
  assert.ok(s.warningsFa.some((w) => w.includes("مورد اختلاف")));
});

test("کسر تأییدشدهٔ بی‌سند شمرده و هشدار داده می‌شود", () => {
  const s = backToBackSummary([
    { SourceModule: "fin_material", Amount: 1_000, Status: "approved" },
    { SourceModule: "fin_material", Amount: 2_000, Status: "approved", EvidenceDocNo: "  " },
    { SourceModule: "fin_material", Amount: 3_000, Status: "approved", EvidenceDocNo: "D-9" },
  ]);
  assert.equal(s.missingEvidence, 2);
  assert.equal(s.approvedTotal, 6_000, "بی‌سند بودن مانع محاسبه نیست، فقط هشدار است");
  assert.ok(s.warningsFa.some((w) => w.includes("قابل دفاع نیست")));
});

test("سند پشتیبانِ کسر پیش‌نویس شرط نیست", () => {
  const s = backToBackSummary([{ SourceModule: "other", Amount: 1_000, Status: "draft" }]);
  assert.equal(s.missingEvidence, 0);
});

test("تفکیک به منشأ درست است", () => {
  const s = backToBackSummary([
    { SourceModule: "fin_material", Amount: 1_000, Status: "approved", EvidenceDocNo: "d" },
    { SourceModule: "fin_material", Amount: 500, Status: "draft" },
    { SourceModule: "hse_incident", Amount: 2_000, Status: "approved", EvidenceDocNo: "d" },
  ]);
  assert.equal(s.byModule.fin_material, 1_500);
  assert.equal(s.byModule.hse_incident, 2_000);
});

test("نام فارسی منشأ و وضعیت در خروجی می‌آید", () => {
  const s = backToBackSummary([{ SourceModule: "hse_incident", Amount: 1, Status: "disputed" }]);
  assert.equal(s.rows[0].sourceFa, "خسارت حادثهٔ ایمنی");
  assert.equal(s.rows[0].statusFa, "مورد اختلاف");
  assert.equal(s.rows[0].isCountable, false);
});

/* ══════════════ ۴) خالص پرداختنی ══════════════ */

test("خالص = ناخالص منهای کسور تأییدشده", () => {
  const t = subIpcTotals({
    lines: [line({ Quantity: 100, UnitRate: 1_000 })],
    backToBack: [
      { SourceModule: "fin_material", Amount: 20_000, Status: "approved", EvidenceDocNo: "d" },
      { SourceModule: "qlt_rework", Amount: 50_000, Status: "disputed" },
    ],
    otherDeductions: 5_000,
  });
  assert.equal(t.gross, 100_000);
  assert.equal(t.backToBack, 20_000);
  assert.equal(t.otherDeductions, 5_000);
  assert.equal(t.totalDeductions, 25_000);
  assert.equal(t.netPayable, 75_000, "کسر مورد اختلاف کم نشده");
  assert.equal(t.isNegative, false);
});

test("خالص منفی مجاز است ولی پرچم می‌گیرد", () => {
  const t = subIpcTotals({
    lines: [line({ Quantity: 10, UnitRate: 100 })],
    backToBack: [{ SourceModule: "hse_incident", Amount: 50_000, Status: "approved", EvidenceDocNo: "d" }],
  });
  assert.equal(t.netPayable, -49_000);
  assert.equal(t.isNegative, true);
  assert.ok(t.warningsFa.some((w) => w.includes("دورهٔ بعد")));
});

test("کسر سایر منفی نادیده گرفته می‌شود", () => {
  const t = subIpcTotals({ lines: [line()], otherDeductions: -1_000 });
  assert.equal(t.otherDeductions, 0, "کسر منفی یعنی افزودن پول، از این در نه");
});

test("هشدار ردیف و هشدار کسر با هم می‌آیند", () => {
  const t = subIpcTotals({
    lines: [line({ Quantity: 200, MainApprovedQty: 100 })],
    backToBack: [{ SourceModule: "other", Amount: 1, Status: "approved" }],
  });
  assert.ok(t.warningsFa.some((w) => w.includes("پیمانکار اصلی")));
  assert.ok(t.warningsFa.some((w) => w.includes("قابل دفاع نیست")));
});

/* ══════════════ ۵) دروازهٔ گذار ══════════════ */

const okTotals = () => subIpcTotals({ lines: [line()] });

test("گذار پیش‌نویس به ارسال‌شده مجاز است", () => {
  const g = canTransitionSubIpc({ from: "draft", to: "submitted", totals: okTotals() });
  assert.equal(g.ok, true);
});

test("پرش از مرحله بسته است", () => {
  const g = canTransitionSubIpc({ from: "draft", to: "approved", totals: okTotals() });
  assert.equal(g.ok, false);
  assert.equal(g.code, "E-CNT-SUB-TRANSITION");
});

test("وضعیت مقصد نامعتبر رد می‌شود", () => {
  const g = canTransitionSubIpc({ from: "draft", to: "invented" });
  assert.equal(g.code, "E-CNT-SUB-STATE");
});

test("از پرداخت‌شده هیچ گذاری نیست", () => {
  const g = canTransitionSubIpc({ from: "paid", to: "draft" });
  assert.equal(g.ok, false);
  assert.ok(g.blockersFa[0].includes("پایانی"));
});

test("تأیید جزء بدون گره به صورت‌وضعیت اصلی بسته است", () => {
  const g = canTransitionSubIpc({ from: "reviewed", to: "approved", totals: okTotals() });
  assert.equal(g.ok, false);
  assert.ok(g.blockersFa.some((b) => b.includes("گره نخورده")));
});

test("تأیید جزء پیش از تأیید اصلی بسته است — گرهٔ نقدینگی", () => {
  const g = canTransitionSubIpc({
    from: "reviewed", to: "approved", totals: okTotals(), mainIpcState: "submitted",
  });
  assert.equal(g.ok, false);
  assert.ok(g.blockersFa.some((b) => b.includes("از جیب پیمانکار اصلی")));
});

test("با تأیید صورت‌وضعیت اصلی، تأیید جزء باز می‌شود", () => {
  const g = canTransitionSubIpc({
    from: "reviewed", to: "approved", totals: okTotals(), mainIpcState: "approved",
  });
  assert.equal(g.ok, true);
});

test("صورت‌وضعیت اصلی پرداخت‌شده هم کافی است", () => {
  const g = canTransitionSubIpc({
    from: "reviewed", to: "approved", totals: okTotals(), mainIpcState: "paid",
  });
  assert.equal(g.ok, true);
});

test("ردیف مازاد، تأیید را می‌بندد", () => {
  const totals = subIpcTotals({ lines: [line({ Quantity: 200, MainApprovedQty: 100 })] });
  const g = canTransitionSubIpc({
    from: "reviewed", to: "approved", totals, mainIpcState: "approved",
  });
  assert.equal(g.ok, false);
  assert.ok(g.blockersFa.some((b) => b.includes("بیش از مقدار تأییدشدهٔ اصلی")));
});

test("ردیف بی‌مرجع تأیید را می‌بندد مگر صریح پذیرفته شود", () => {
  const totals = subIpcTotals({ lines: [line({ BoqItemId: null })] });
  const blocked = canTransitionSubIpc({
    from: "reviewed", to: "approved", totals, mainIpcState: "approved",
  });
  assert.equal(blocked.ok, false);

  const allowed = canTransitionSubIpc({
    from: "reviewed", to: "approved", totals, mainIpcState: "approved", allowUnmatched: true,
  });
  assert.equal(allowed.ok, true, "کار جدید توافقی مشروع است، ولی باید صریح تأیید شود");
});

test("کسر بی‌سند تأیید را نمی‌بندد ولی هشدار می‌دهد", () => {
  const totals = subIpcTotals({
    lines: [line()],
    backToBack: [{ SourceModule: "other", Amount: 100, Status: "approved" }],
  });
  const g = canTransitionSubIpc({
    from: "reviewed", to: "approved", totals, mainIpcState: "approved",
  });
  assert.equal(g.ok, true);
  assert.ok(g.warningsFa.some((w) => w.includes("سند پشتیبان")));
});

test("خالص منفی تأیید را نمی‌بندد ولی پرداخت را می‌بندد", () => {
  const totals = subIpcTotals({
    lines: [line({ Quantity: 1, UnitRate: 100 })],
    backToBack: [{ SourceModule: "hse_incident", Amount: 99_000, Status: "approved", EvidenceDocNo: "d" }],
  });
  const approve = canTransitionSubIpc({
    from: "reviewed", to: "approved", totals, mainIpcState: "approved",
  });
  assert.equal(approve.ok, true);
  assert.ok(approve.warningsFa.some((w) => w.includes("منفی")));

  const pay = canTransitionSubIpc({ from: "approved", to: "paid", totals });
  assert.equal(pay.ok, false);
  assert.ok(pay.blockersFa.some((b) => b.includes("چیزی برای پرداخت")));
});

test("رد کردن از هر مرحله‌ای ممکن است", () => {
  for (const from of ["submitted", "reviewed", "approved"]) {
    assert.equal(canTransitionSubIpc({ from, to: "rejected" }).ok, true, from);
  }
});

/* ══════════════ ۶) قفل ویرایش ══════════════ */

test("پیش‌نویس و ردشده باز، بقیه قفل", () => {
  assert.equal(isSubIpcLocked("draft"), false);
  assert.equal(isSubIpcLocked("rejected"), false);
  for (const s of ["submitted", "reviewed", "approved", "paid"]) {
    assert.equal(isSubIpcLocked(s), true, s);
  }
});

/* ══════════════ ۷) دفتر صورت‌وضعیت‌ها ══════════════ */

test("دفتر خالی صفر می‌دهد", () => {
  const r = subIpcRegister({ rows: [] });
  assert.equal(r.count, 0);
  assert.equal(r.grossTotal, 0);
  assert.deepEqual(r.warningsFa, []);
});

test("جمع و تفکیک وضعیت درست است", () => {
  const r = subIpcRegister({
    rows: [
      { WorkflowState: "draft", GrossCurrent: 100, NetPayable: 90, TotalDeductions: 10 },
      { WorkflowState: "draft", GrossCurrent: 200, NetPayable: 200, TotalDeductions: 0 },
      { WorkflowState: "paid", GrossCurrent: 300, NetPayable: 250, TotalDeductions: 50 },
    ],
  });
  assert.equal(r.count, 3);
  assert.equal(r.grossTotal, 600);
  assert.equal(r.netTotal, 540);
  assert.equal(r.deductionTotal, 60);
  assert.equal(r.byState.draft, 2);
  assert.equal(r.byState.paid, 1);
});

test("منتظر تأیید اصلی شمرده می‌شود — شاخص ریسک نقدینگی", () => {
  const r = subIpcRegister({
    rows: [
      { WorkflowState: "submitted", MainIpcId: "m1" },
      { WorkflowState: "reviewed", MainIpcId: "m2" },
      { WorkflowState: "reviewed", MainIpcId: "m3" },
      { WorkflowState: "draft", MainIpcId: "m1" },
    ],
    mainStates: { m1: "submitted", m2: "approved", m3: "reviewed" },
  });
  assert.equal(r.awaitingMain, 2, "m2 تأیید شده پس منتظر نیست؛ پیش‌نویس هم منتظر نیست");
  assert.ok(r.warningsFa[0].includes("منتظر تأیید"));
});

test("وضعیت اصلی در هر ردیف برمی‌گردد", () => {
  const r = subIpcRegister({
    rows: [{ WorkflowState: "submitted", MainIpcId: "m1" }],
    mainStates: { m1: "reviewed" },
  });
  assert.equal(r.items[0].mainIpcState, "reviewed");
  assert.equal(r.items[0].isAwaitingMain, true);
  assert.equal(r.items[0].isLocked, true);
  assert.equal(r.items[0].stateFa, "ارسال‌شده");
});

/* ══════════════ ۸) اعتبارسنجی کسر ══════════════ */

test("کسر معتبر پذیرفته می‌شود", () => {
  const v = validateBackToBack({
    sourceModule: "fin_material", descriptionFa: "بتن تحویلی کارگاه مرکزی",
    amount: 5_000_000, evidenceDocNo: "INV-90", status: "approved",
  });
  assert.equal(v.ok, true);
  assert.deepEqual(v.issues, []);
});

test("منشأ نامعتبر رد می‌شود", () => {
  const v = validateBackToBack({ sourceModule: "invented", descriptionFa: "x", amount: 1 });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.code === "E-CNT-BTB-SOURCE"));
});

test("مبلغ صفر یا منفی رد می‌شود", () => {
  for (const amount of [0, -1]) {
    const v = validateBackToBack({ sourceModule: "other", descriptionFa: "شرح کافی دارد", amount });
    assert.ok(v.issues.some((i) => i.code === "E-CNT-BTB-AMOUNT"), `${amount}`);
  }
});

test("شرح خالی رد می‌شود", () => {
  const v = validateBackToBack({ sourceModule: "other", descriptionFa: "   ", amount: 10 });
  assert.ok(v.issues.some((i) => i.code === "E-CNT-BTB-DESC"));
});

test("منشأ «سایر» با شرح کوتاه هشدار می‌گیرد نه خطا", () => {
  const v = validateBackToBack({ sourceModule: "other", descriptionFa: "کسر", amount: 10 });
  assert.equal(v.ok, true);
  assert.ok(v.issues.some((i) => i.code === "W-CNT-BTB-VAGUE" && i.severity === "warning"));
});

test("کسر تأییدشدهٔ بی‌سند هشدار می‌گیرد", () => {
  const v = validateBackToBack({
    sourceModule: "hse_incident", descriptionFa: "خسارت جرثقیل واژگون‌شده", amount: 10, status: "approved",
  });
  assert.equal(v.ok, true);
  assert.ok(v.issues.some((i) => i.code === "W-CNT-BTB-NO-EVIDENCE"));
});
