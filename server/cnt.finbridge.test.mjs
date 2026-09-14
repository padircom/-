/**
 * MOD-14 / D13 — آزمون موتور پل CNT→FIN (G-03).
 *
 * تمرکز آزمون‌ها روی چیزی است که پول را جابه‌جا می‌کند: ایدمپوتنسی،
 * مرز کسور، و تشخیص مغایرت بین دو دفتر.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  FIN_POSTABLE_STATES,
  FIN_BLOCK_REASON_FA,
  ipcPostability,
  applyPostingToAccount,
  buildFinPosting,
  budgetImpact,
  reconcileFinPostings,
  RECONCILE_STATE_FA,
  contractFinSummary,
} from "./cntLogic.js";

const CONTRACT = {
  Id: "c1", Code: "P-100", CostAccountCode: "CA-10",
  InitialAmount: 1_000_000, CurrentAmount: 1_000_000,
};
const ACCOUNT = { Id: "acc1", Code: "CA-10", Budget: 800_000, Actual: 100_000 };

function IPC(over = {}) {
  return {
    Id: "ipc1", ContractId: "c1", SerialNo: 1, PeriodCode: "1404-01",
    SubtotalAmount: 200_000, TotalDeductions: 40_000, VatAmount: 18_000,
    NetPayable: 178_000, WorkflowState: "approved", Status: "open",
    ...over,
  };
}

/* ───────────────────── ۱. شرط ارسال ───────────────────── */

test("فقط صورت‌وضعیت تأییدشده قابل ارسال است", () => {
  for (const state of ["draft", "contractor_submitted", "consultant_review", "consultant_approved", "employer_review", "rejected"]) {
    const p = ipcPostability({ ipc: IPC({ WorkflowState: state }), contract: CONTRACT, account: ACCOUNT });
    assert.equal(p.isPostable, false, `${state} نباید قابل ارسال باشد`);
    assert.equal(p.blockCode, "not_approved");
  }
});

test("وضعیت‌های نهایی هر دو قابل ارسال‌اند", () => {
  assert.deepEqual([...FIN_POSTABLE_STATES], ["approved", "paid"]);
  for (const state of FIN_POSTABLE_STATES) {
    const p = ipcPostability({ ipc: IPC({ WorkflowState: state }), contract: CONTRACT, account: ACCOUNT });
    assert.equal(p.isPostable, true, `${state} باید قابل ارسال باشد`);
  }
});

test("صورت‌وضعیت باطل حتی اگر تأییدشده باشد ارسال نمی‌شود", () => {
  const p = ipcPostability({
    ipc: IPC({ WorkflowState: "approved", Status: "cancelled" }),
    contract: CONTRACT, account: ACCOUNT,
  });
  assert.equal(p.isPostable, false);
  assert.equal(p.blockCode, "cancelled");
});

test("پیمان بدون حساب هزینه ارسال نمی‌شود — حدس زدن ممنوع", () => {
  for (const code of [undefined, null, "", "   "]) {
    const p = ipcPostability({
      ipc: IPC(), contract: { ...CONTRACT, CostAccountCode: code }, account: ACCOUNT,
    });
    assert.equal(p.isPostable, false);
    assert.equal(p.blockCode, "no_cost_account");
    assert.equal(p.costAccountCode, null);
  }
});

test("حساب هزینه‌ای که در دفتر مالی نیست، خطای جدا دارد", () => {
  const p = ipcPostability({ ipc: IPC(), contract: CONTRACT, account: null });
  assert.equal(p.blockCode, "account_missing");
  assert.notEqual(p.blockCode, "no_cost_account", "دو خطای متفاوت با دو صاحب متفاوت");
});

test("مبلغ صفر یا منفی ارسال نمی‌شود", () => {
  for (const net of [0, -5000]) {
    const p = ipcPostability({ ipc: IPC({ NetPayable: net }), contract: CONTRACT, account: ACCOUNT });
    assert.equal(p.isPostable, false);
    assert.equal(p.blockCode, "zero_amount");
  }
});

test("ترتیب بررسی: وضعیت گردش کار پیش از پیکربندی حساب", () => {
  /* اگر هم پیش‌نویس باشد هم حساب نداشته باشد، خطای پیمان اول می‌آید
     چون رفعش با مدیر پیمان است نه مدیر مالی. */
  const p = ipcPostability({
    ipc: IPC({ WorkflowState: "draft" }),
    contract: { ...CONTRACT, CostAccountCode: "" },
    account: null,
  });
  assert.equal(p.blockCode, "not_approved");
});

test("هر دلیل رد، پیام فارسی دارد", () => {
  for (const code of ["not_approved", "no_cost_account", "account_missing", "zero_amount", "cancelled"]) {
    assert.ok(FIN_BLOCK_REASON_FA[code], `${code} پیام ندارد`);
    assert.ok(FIN_BLOCK_REASON_FA[code].length > 10, "پیام باید توضیح بدهد نه اینکه کد را تکرار کند");
  }
});

/* ───────────────────── ۲. ایدمپوتنسی ───────────────────── */

test("ثبت تازه، مبلغ را به مانده اضافه می‌کند", () => {
  assert.equal(applyPostingToAccount(100_000, 0, 50_000), 150_000);
});

test("ثبت دوباره جمع را دوبرابر نمی‌کند", () => {
  /* سناریوی واقعی: کاربر دکمه را دو بار می‌زند. */
  const after1 = applyPostingToAccount(100_000, 0, 50_000);
  const after2 = applyPostingToAccount(after1, 50_000, 50_000);
  assert.equal(after2, 150_000, "ارسال دوباره باید بی‌اثر باشد");
});

test("اصلاح مبلغ صورت‌وضعیت، فقط تفاوت را جابه‌جا می‌کند", () => {
  const after1 = applyPostingToAccount(100_000, 0, 50_000);
  const after2 = applyPostingToAccount(after1, 50_000, 70_000);
  assert.equal(after2, 170_000);
  assert.equal(after2 - after1, 20_000, "فقط تفاوت ۲۰ هزار باید اثر بگذارد");
});

test("کاهش مبلغ صورت‌وضعیت، مانده را پایین می‌آورد", () => {
  const after = applyPostingToAccount(150_000, 50_000, 30_000);
  assert.equal(after, 130_000);
});

test("ثبت برگشت‌خورده سهم ندارد", () => {
  const line = buildFinPosting({
    ipc: IPC(), contract: CONTRACT, account: ACCOUNT,
    prior: { IpcId: "ipc1", NetAmount: 178_000, Status: "reversed" },
  });
  assert.equal(line.previousShare, 0, "ثبت برگشت‌خورده اثرش را پس گرفته");
  assert.equal(line.isRepost, false);
  assert.equal(line.nextActual, 278_000);
});

test("ثبت فعال قبلی، سهم دارد و پرچم ارسال دوباره می‌خورد", () => {
  const line = buildFinPosting({
    ipc: IPC(), contract: CONTRACT, account: { ...ACCOUNT, Actual: 278_000 },
    prior: { IpcId: "ipc1", NetAmount: 178_000, Status: "posted" },
  });
  assert.equal(line.previousShare, 178_000);
  assert.equal(line.isRepost, true);
  assert.equal(line.nextActual, 278_000, "مبلغ عوض نشده پس مانده هم عوض نمی‌شود");
  assert.equal(line.deltaAmount, 0);
});

/* ───────────────────── ۳. ساخت سطر ───────────────────── */

test("سطر ثبت، خالص را روی حساب می‌نشاند نه ناخالص را", () => {
  const line = buildFinPosting({ ipc: IPC(), contract: CONTRACT, account: ACCOUNT });
  assert.equal(line.grossAmount, 200_000);
  assert.equal(line.netAmount, 178_000);
  assert.equal(line.nextActual, 278_000, "Actual باید با خالص بالا برود");
});

test("کسور و ارزش افزوده جدا نگه داشته می‌شوند", () => {
  const line = buildFinPosting({ ipc: IPC(), contract: CONTRACT, account: ACCOUNT });
  assert.equal(line.deductionAmount, 40_000);
  assert.equal(line.vatAmount, 18_000);
});

test("اگر SubtotalAmount نباشد از GrossCurrent می‌خواند", () => {
  const line = buildFinPosting({
    ipc: IPC({ SubtotalAmount: 0, GrossCurrent: 150_000 }),
    contract: CONTRACT, account: ACCOUNT,
  });
  assert.equal(line.grossAmount, 150_000);
});

test("شرح ثبت، شمارهٔ صورت‌وضعیت و کد پیمان را دارد", () => {
  const line = buildFinPosting({ ipc: IPC({ SerialNo: 3 }), contract: CONTRACT, account: ACCOUNT });
  assert.ok(line.memoFa.includes("P-100"), "کد پیمان باید در شرح باشد");
  assert.ok(line.memoFa.includes("۳"), "شمارهٔ سریال با رقم فارسی");
  assert.ok(line.memoFa.includes("1404-01"), "دوره باید در شرح باشد");
});

test("دورهٔ صریح بر دورهٔ صورت‌وضعیت مقدم است", () => {
  const line = buildFinPosting({
    ipc: IPC(), contract: CONTRACT, account: ACCOUNT, periodCode: "1404-06",
  });
  assert.equal(line.periodCode, "1404-06");
});

/* ───────────────────── ۴. اثر بودجه ───────────────────── */

test("ثبت درون بودجه هشدار نمی‌دهد", () => {
  const line = buildFinPosting({ ipc: IPC({ NetPayable: 100_000 }), contract: CONTRACT, account: ACCOUNT });
  const b = budgetImpact(line, ACCOUNT);
  assert.equal(b.isOverBudget, false);
  assert.equal(b.warningFa, null);
  assert.equal(b.remaining, 600_000);
});

test("ثبتی که از بودجه رد می‌کند، صاحب خطا را نام می‌برد", () => {
  const line = buildFinPosting({ ipc: IPC({ NetPayable: 750_000 }), contract: CONTRACT, account: ACCOUNT });
  const b = budgetImpact(line, ACCOUNT);
  assert.equal(b.isOverBudget, true);
  assert.equal(b.wasAlreadyOver, false);
  assert.ok(b.warningFa.includes("این ثبت"), "باید بگوید همین ثبت خط را رد کرد");
});

test("حسابی که از قبل منفی بوده، تقصیر این ثبت نیست", () => {
  const over = { ...ACCOUNT, Actual: 900_000 };
  const line = buildFinPosting({ ipc: IPC({ NetPayable: 10_000 }), contract: CONTRACT, account: over });
  const b = budgetImpact(line, over);
  assert.equal(b.isOverBudget, true);
  assert.equal(b.wasAlreadyOver, true);
  assert.ok(b.warningFa.includes("پیش از این"), "متن باید تقصیر را درست نسبت دهد");
});

test("مصرف بالای ۹۰ درصد هشدار زودهنگام می‌دهد", () => {
  const line = buildFinPosting({ ipc: IPC({ NetPayable: 630_000 }), contract: CONTRACT, account: ACCOUNT });
  const b = budgetImpact(line, ACCOUNT);
  assert.equal(b.isOverBudget, false);
  assert.ok(b.usedPct >= 90);
  assert.ok(b.warningFa.includes("٪"), "هشدار درصد باید عدد بدهد");
});

test("حساب بدون بودجه، درصد مصرف ندارد نه صفر", () => {
  const noBudget = { ...ACCOUNT, Budget: 0 };
  const line = buildFinPosting({ ipc: IPC(), contract: CONTRACT, account: noBudget });
  const b = budgetImpact(line, noBudget);
  assert.equal(b.usedPct, null, "بدون بودجه، درصد معنا ندارد");
  assert.equal(b.isOverBudget, false, "بدون بودجه نمی‌شود از بودجه رد شد");
});

/* ───────────────────── ۵. تطبیق دو دفتر ───────────────────── */

const P = (over = {}) => ({
  IpcId: "ipc1", SerialNo: 1, PeriodCode: "1404-01",
  NetAmount: 178_000, Status: "posted", ...over,
});

test("دفتر هماهنگ، تمیز اعلام می‌شود", () => {
  const r = reconcileFinPostings({ ipcs: [IPC()], postings: [P()] });
  assert.equal(r.summary.isClean, true);
  assert.equal(r.summary.inSync, 1);
  assert.deepEqual(r.warningsFa, []);
});

test("صورت‌وضعیت تأییدشدهٔ ارسال‌نشده دیده می‌شود", () => {
  const r = reconcileFinPostings({ ipcs: [IPC()], postings: [] });
  assert.equal(r.summary.notPosted, 1);
  assert.equal(r.summary.notPostedAmount, 178_000);
  assert.equal(r.summary.isClean, false);
  assert.equal(r.rows[0].needsActionFa, "ارسال به مالی");
});

test("صورت‌وضعیت پیش‌نویسِ ارسال‌نشده مسئله نیست", () => {
  const r = reconcileFinPostings({ ipcs: [IPC({ WorkflowState: "draft" })], postings: [] });
  assert.equal(r.rows.length, 0, "پیش‌نویس تعهد نیست");
  assert.equal(r.summary.isClean, true);
});

test("مغایرت مبلغ، خطرناک‌ترین حالت است و اول فهرست می‌آید", () => {
  const r = reconcileFinPostings({
    ipcs: [IPC({ Id: "a", SerialNo: 1 }), IPC({ Id: "b", SerialNo: 2, NetPayable: 200_000 })],
    postings: [P({ IpcId: "a" }), P({ IpcId: "b", SerialNo: 2, NetAmount: 178_000 })],
  });
  assert.equal(r.summary.amountDrift, 1);
  assert.equal(r.rows[0].state, "amount_drift", "مغایرت باید اول فهرست باشد");
  assert.equal(r.rows[0].driftAmount, 22_000);
  assert.ok(r.warningsFa.some((w) => w.includes("یک عدد نمی‌گویند")));
});

test("ثبت بی‌مرجع در مالی پیدا می‌شود", () => {
  const r = reconcileFinPostings({ ipcs: [], postings: [P({ IpcId: "ghost" })] });
  assert.equal(r.summary.orphan, 1);
  assert.equal(r.rows[0].state, "orphan_posting");
  assert.equal(r.rows[0].driftAmount, -178_000);
  assert.ok(r.warningsFa.some((w) => w.includes("بدون صورت‌وضعیت معتبر")));
});

test("ثبت برگشت‌خوردهٔ صورت‌وضعیتِ هنوز تأییدشده، یعنی ارسال‌نشده", () => {
  const r = reconcileFinPostings({ ipcs: [IPC()], postings: [P({ Status: "reversed" })] });
  assert.equal(r.summary.notPosted, 1, "برگشت خورده یعنی دوباره باید برود");
});

test("ثبت برگشت‌خوردهٔ صورت‌وضعیت باطل، مسئله نیست", () => {
  const r = reconcileFinPostings({
    ipcs: [IPC({ Status: "cancelled" })],
    postings: [P({ Status: "reversed" })],
  });
  assert.equal(r.summary.notPosted, 0);
  assert.equal(r.rows[0].state, "reversed");
});

test("ثبت برگشت‌خورده، ثبت بی‌مرجع شمرده نمی‌شود", () => {
  const r = reconcileFinPostings({ ipcs: [], postings: [P({ IpcId: "gone", Status: "reversed" })] });
  assert.equal(r.summary.orphan, 0, "برگشت‌خورده اثری در دفتر ندارد");
});

test("هر حالت تطبیق، برچسب فارسی دارد", () => {
  for (const k of ["in_sync", "not_posted", "amount_drift", "orphan_posting", "reversed"]) {
    assert.ok(RECONCILE_STATE_FA[k], `${k} برچسب ندارد`);
  }
});

test("جمع مبلغ مغایرت، قدر مطلق است", () => {
  const r = reconcileFinPostings({
    ipcs: [IPC({ Id: "a", NetPayable: 100_000 }), IPC({ Id: "b", SerialNo: 2, NetPayable: 100_000 })],
    postings: [P({ IpcId: "a", NetAmount: 120_000 }), P({ IpcId: "b", SerialNo: 2, NetAmount: 80_000 })],
  });
  assert.equal(r.summary.driftAmount, 40_000, "دو مغایرت ۲۰ هزاری نباید یکدیگر را خنثی کنند");
});

/* ───────────────────── ۶. خلاصهٔ مالی پیمان ───────────────────── */

test("خلاصه، خالص ارسال‌شده و ناخالص تأییدشده را جدا می‌کند", () => {
  const s = contractFinSummary({
    contract: CONTRACT, ipcs: [IPC()], postings: [P()],
  });
  assert.equal(s.postedNet, 178_000);
  assert.equal(s.approvedGross, 200_000);
  assert.equal(s.withheldAmount, 22_000);
});

test("کسورِ در حساب ننشسته، صریح توضیح داده می‌شود", () => {
  const s = contractFinSummary({ contract: CONTRACT, ipcs: [IPC()], postings: [P()] });
  assert.ok(s.notesFa.some((n) => n.includes("پول پروژه")),
    "مدیر باید بداند چرا Actual کمتر از ناخالص است");
});

test("ثبت برگشت‌خورده در جمع ارسال‌شده نمی‌آید", () => {
  const s = contractFinSummary({
    contract: CONTRACT, ipcs: [IPC()], postings: [P({ Status: "reversed" })],
  });
  assert.equal(s.postedNet, 0);
  assert.equal(s.postedCount, 0);
  assert.equal(s.pendingCount, 1);
});

test("تعهد باقی‌مانده بر ناخالص سنجیده می‌شود نه خالص", () => {
  /* اگر بر خالص می‌سنجیدیم، پیمان همیشه ارزان‌تر از واقع به نظر
     می‌رسید و سقف دیر کشف می‌شد. */
  const s = contractFinSummary({ contract: CONTRACT, ipcs: [IPC()], postings: [P()] });
  assert.equal(s.remainingCommitment, 800_000);
  assert.equal(s.commitmentUsedPct, 20);
});

test("پیمان بدون حساب هزینه، در خلاصه اعلام می‌شود", () => {
  const s = contractFinSummary({
    contract: { ...CONTRACT, CostAccountCode: "" }, ipcs: [], postings: [],
  });
  assert.equal(s.costAccountCode, null);
  assert.ok(s.notesFa.some((n) => n.includes("هیچ عددی به مالی نمی‌رسد")));
});

test("صورت‌وضعیت باطل در ناخالص تأییدشده نمی‌آید", () => {
  const s = contractFinSummary({
    contract: CONTRACT,
    ipcs: [IPC(), IPC({ Id: "x", SerialNo: 2, Status: "cancelled" })],
    postings: [P()],
  });
  assert.equal(s.approvedGross, 200_000, "فقط یکی معتبر است");
});

test("پیمان با مبلغ صفر، درصد مصرف تعهد ندارد", () => {
  const s = contractFinSummary({
    contract: { ...CONTRACT, InitialAmount: 0, CurrentAmount: 0 }, ipcs: [], postings: [],
  });
  assert.equal(s.commitmentUsedPct, null);
});

test("مبلغ جاری بر مبلغ اولیه مقدم است", () => {
  const s = contractFinSummary({
    contract: { ...CONTRACT, InitialAmount: 1_000_000, CurrentAmount: 1_200_000 },
    ipcs: [], postings: [],
  });
  assert.equal(s.contractAmount, 1_200_000, "الحاقیه باید در تعهد دیده شود");
});
