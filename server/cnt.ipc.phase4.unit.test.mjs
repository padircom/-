/* فاز ۴ ADR-CNT-IPC-UNIFY — موتور خالص: نمایهٔ سند، زنجیرهٔ هش،
 * و گیت تصویب ضمانتنامهٔ حسن انجام کار.
 *
 * اینجا هیچ سرور و پایگاه دادهای بالا نمیآید؛ چیزی سنجیده میشود که
 * باید مستقل از لایهٔ ماندگاری درست باشد: پایداری رشتهٔ کانونی،
 * شکستن زنجیره با کوچکترین دستکاری، و قواعد اعتبار/انقضای وثیقه. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  IPC_SNAPSHOT_VERSION,
  IPC_SIGNATURE_METHOD,
  IPC_PERFORMANCE_GUARANTEE_TYPES,
  ipcStableStringify,
  ipcDocumentSnapshot,
  ipcDocumentCanonical,
  ipcStepCanonical,
  ipcAttestationFa,
  verifyIpcSnapshotChain,
  ipcApprovalGuaranteeGate,
  computeIpc,
  guaranteeState,
} from "./cntLogic.js";

const sha = (s) => createHash("sha256").update(s).digest("hex");

const IPC = {
  Id: "IPC-1", ProjectId: "c1-p1", ContractId: "C-1", SerialNo: 3,
  IpcType: "interim", PeriodCode: "1405-07", GrossCurrent: 100_000_000,
  GrossCumulative: 100_000_000, TotalDeductions: 9_000_000, NetPayable: 91_000_000,
  WorkflowState: "approved", Status: "open",
};
const LINES = [{
  BoqItemId: "boq-1", PricingBasis: "unit_price", CurrentQty: 100,
  UnitRate: 1_000_000, EarnedCurrent: 100_000_000, Status: "claimed",
}];
const DEDS = [{ DeductionType: "insurance", BaseAmount: 100_000_000, RatePct: 5, Amount: 5_000_000 }];

/* ───────────────────────── رشتهسازی پایدار ───────────────────────── */

test("رشتهسازی کانونی وابسته به ترتیب کلیدها نیست", () => {
  assert.equal(ipcStableStringify({ a: 1, b: 2 }), ipcStableStringify({ b: 2, a: 1 }));
  assert.equal(ipcStableStringify({ a: 1 }), '{"a":1}');
  assert.equal(ipcStableStringify({ a: [1, { z: 3, y: 4 }] }), '{"a":[1,{"y":4,"z":3}]}');
});

test("نمایهٔ سند، ترتیب ردیفها و کسورات و نوع عدد را نرمال میکند", () => {
  const a = ipcDocumentCanonical({ ipc: IPC, lines: [LINES[0], { ...LINES[0], BoqItemId: "boq-2" }], deductions: DEDS });
  const b = ipcDocumentCanonical({ ipc: IPC, lines: [{ ...LINES[0], BoqItemId: "boq-2" }, LINES[0]], deductions: DEDS });
  assert.equal(a, b, "جابهجایی ردیفها نباید هش را عوض کند");

  const numeric = ipcDocumentCanonical({ ipc: IPC, lines: [{ ...LINES[0], EarnedCurrent: 100_000_000 }], deductions: DEDS });
  const stringy = ipcDocumentCanonical({ ipc: IPC, lines: [{ ...LINES[0], EarnedCurrent: "100000000" }], deductions: DEDS });
  assert.equal(numeric, stringy, "عدد و رشتهٔ همارز باید یک نمایه بدهند (JSON در برابر SQL)");
});

test("نمایهٔ سند فقط فیلدهای مالی/هویتی را میگیرد و فیلد حسابرسی را کنار میگذارد", () => {
  const snap = ipcDocumentSnapshot({ ipc: { ...IPC, RowVersion: 9, CreatedBy: "x" }, lines: LINES, deductions: DEDS });
  assert.equal(snap.version, IPC_SNAPSHOT_VERSION);
  assert.ok(!("RowVersion" in snap.header));
  assert.ok(!("CreatedBy" in snap.header));
  assert.equal(snap.header.NetPayable, 91_000_000);
});

test("تغییر مبلغ سند، هش نمایه را عوض میکند", () => {
  const a = ipcDocumentCanonical({ ipc: IPC, lines: LINES, deductions: DEDS });
  const b = ipcDocumentCanonical({ ipc: { ...IPC, NetPayable: 90_000_000 }, lines: LINES, deductions: DEDS });
  assert.notEqual(sha(a), sha(b), "دستکاری مبلغ پس از تأیید باید آشکار شود");
});

/* ───────────────────────── زنجیرهٔ هش ───────────────────────── */

function chainOf(n = 3) {
  const steps = [];
  let prev = null;
  for (let i = 1; i <= n; i++) {
    const doc = sha(ipcDocumentCanonical({ ipc: IPC, lines: LINES, deductions: DEDS }));
    const canonical = ipcStepCanonical({
      documentSha256: doc, prevHash: prev, stepNo: i, actor: "employer",
      actorUserId: "u-client", action: "approve", actedAt: `2026-10-2${i}T10:00:00.000Z`,
    });
    const snapshotSha256 = sha(canonical);
    steps.push({
      StepNo: i, Actor: "employer", ActorUserId: "u-client", Action: "approve",
      ActedAt: `2026-10-2${i}T10:00:00.000Z`, CommentFa: null,
      DocumentSha256: doc, PrevHash: prev, SnapshotSha256: snapshotSha256,
    });
    prev = snapshotSha256;
  }
  return steps;
}

test("زنجیرهٔ سالم راستیآزمایی میشود", () => {
  const v = verifyIpcSnapshotChain(chainOf(3), sha);
  assert.equal(v.ok, true);
  assert.equal(v.checked, 3);
  assert.deepEqual(v.issuesFa, []);
});

test("دستکاری هش یک گام زنجیره را میشکند", () => {
  const steps = chainOf(3);
  steps[1].SnapshotSha256 = "0".repeat(64);
  const v = verifyIpcSnapshotChain(steps, sha);
  assert.equal(v.ok, false);
  assert.ok(v.issuesFa.length >= 1);
});

test("تغییر فرادادهٔ گام (نقش/زمان) بدون عوضکردن هش آشکار میشود", () => {
  const steps = chainOf(2);
  steps[0].Actor = "contractor";
  const v = verifyIpcSnapshotChain(steps, sha);
  assert.equal(v.ok, false);
});

test("گامهای پیش از فاز ۴ (بیهش) نادیده گرفته میشوند نه اینکه خطا بدهند", () => {
  const legacy = { StepNo: 1, Actor: "contractor", Action: "submit", ActedAt: "2026-01-01T00:00:00Z" };
  const v = verifyIpcSnapshotChain([legacy], sha);
  assert.equal(v.ok, true);
  assert.equal(v.checked, 0);
});

test("متن تأیید ثبتشده صریحاً میگوید PKI اعمال نشده", () => {
  const s = ipcAttestationFa({ actorFa: "کارفرما", actionFa: "تصویب", actedAt: "2026-10-26", snapshotSha256: "a".repeat(64) });
  assert.ok(s.includes("PKI"));
  assert.ok(s.includes("aaaaaaaaaaaaaaaa"));
  assert.equal(IPC_SIGNATURE_METHOD, "recorded");
});

/* ───────────────────────── گیت ضمانتنامه ───────────────────────── */

const NOW = new Date("2026-10-26T12:00:00Z");
const future = (days) => new Date(NOW.getTime() + days * 86_400_000).toISOString().slice(0, 10);

test("نبود ضمانتنامه: پیشفرض هشدار غیرمسدودکننده", () => {
  const v = ipcApprovalGuaranteeGate({ guarantees: [], now: NOW });
  assert.equal(v.ok, true);
  assert.equal(v.blocking, false);
  assert.equal(v.checked, 0);
  assert.ok(v.warningsFa.length > 0);
  assert.equal(v.code, null);
});

test("نبود ضمانتنامه با الزام سازمان: مسدودکننده", () => {
  const v = ipcApprovalGuaranteeGate({ guarantees: [], now: NOW, requirePresent: true });
  assert.equal(v.ok, false);
  assert.equal(v.code, "E-CNT-IPC-GUARANTEE-MISSING");
});

test("ضمانتنامهٔ منقضی تصویب را مسدود میکند", () => {
  const rows = [{ Code: "G-1", GuaranteeType: "performance", Status: "active", ExpiryDate: future(-3) }];
  const v = ipcApprovalGuaranteeGate({ guarantees: rows, now: NOW });
  assert.equal(v.ok, false);
  assert.equal(v.code, "E-CNT-IPC-GUARANTEE-EXPIRED");
  assert.equal(v.validCount, 0);
});

test("ضمانتنامهٔ آزادشده/ضبطشده معتبر نیست", () => {
  for (const Status of ["released", "forfeited"]) {
    const v = ipcApprovalGuaranteeGate({
      guarantees: [{ Code: "G-2", GuaranteeType: "performance", Status, ExpiryDate: future(300) }], now: NOW,
    });
    assert.equal(v.ok, false, Status);
  }
});

test("ضمانتنامهٔ معتبر آزاد میگذرد و انقضای نزدیک هشدار میدهد", () => {
  const ok = ipcApprovalGuaranteeGate({
    guarantees: [{ Code: "G-3", GuaranteeType: "performance", Status: "active", ExpiryDate: future(300) }], now: NOW,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.validCount, 1);
  assert.equal(ok.warningsFa.length, 0);

  const soon = ipcApprovalGuaranteeGate({
    guarantees: [{ Code: "G-4", GuaranteeType: "performance", Status: "active", ExpiryDate: future(9) }], now: NOW,
  });
  assert.equal(soon.ok, true);
  assert.ok(soon.warningsFa.some((w) => w.includes("روز مانده")));
});

test("تمدید معتبر، انقضای اصلی گذشته را جبران میکند", () => {
  const v = ipcApprovalGuaranteeGate({
    guarantees: [{ Code: "G-5", GuaranteeType: "performance", Status: "extended", ExpiryDate: future(-5), ExtendedToDate: future(100) }], now: NOW,
  });
  assert.equal(v.ok, true);
  assert.equal(v.guarantees[0].DaysToExpiry, 100);
});

test("ضمانتنامهٔ نامربوط (پیشپرداخت) جای وثیقهٔ حسن انجام کار را نمیگیرد", () => {
  const v = ipcApprovalGuaranteeGate({
    guarantees: [{ Code: "G-6", GuaranteeType: "advance", Status: "active", ExpiryDate: future(300) }],
    now: NOW, requirePresent: true,
  });
  assert.equal(v.checked, 0);
  assert.equal(v.ok, false);
  assert.ok(IPC_PERFORMANCE_GUARANTEE_TYPES.includes("performance"));
});

test("یک ضمانتنامهٔ معتبر در کنار یکی منقضی کافی است", () => {
  const v = ipcApprovalGuaranteeGate({
    guarantees: [
      { Code: "G-7", GuaranteeType: "performance", Status: "active", ExpiryDate: future(-10) },
      { Code: "G-8", GuaranteeType: "retention", Status: "active", ExpiryDate: future(200) },
    ], now: NOW,
  });
  assert.equal(v.ok, true);
  assert.equal(v.checked, 2);
  assert.equal(v.validCount, 1);
});

/* ───────────────────────── اعداد طلایی ───────────────────────── */

test("عدد طلایی D4 دستنخورده ماند: کارکرد ۱۰۰٬۰۰۰٬۰۰۰ ← خالص ۹۱٬۰۰۰٬۰۰۰", () => {
  /* همان قرارداد D4: ۱۰۰ واحد × ۱٬۰۰۰٬۰۰۰ ریال، بیمه ۵٪ و مالیات ۴٪
   * (۹٪ کسر) بدون ارزش افزوده. ردیفها به امضای `computeIpcLines` میروند. */
  const r = computeIpc({
    lines: [{ BoqItemId: "b1", PricingBasis: "unit_price", UnitRate: 1_000_000,
      prevQty: 0, cumQty: 100, QualityGateStatus: "passed" }],
    deductions: { insurancePct: 5, taxPct: 4 },
  });
  assert.equal(r.subtotal, 100_000_000);
  assert.equal(r.netPayable, 91_000_000);
});

test("عدد طلایی CNT-1 دستنخورده ماند: ناخالص ۱۶٬۰۰۰ ← خالص ۱۳٬۶۸۰", async () => {
  const { computeTemplateIpc, normalizeIpcTemplate, normalizeIpcInputs } = await import("./cntIpcLogic.js");
  const template = normalizeIpcTemplate({
    Code: "TPLX", TitleFa: "قالب آزمون نگاشت", ContractCode: "CON1",
    Items: [
      { Code: "R01", TitleFa: "ردیف اندازهگیری‌شده", Unit: "m3", Basis: "measured", Sign: "+" },
      { Code: "R02", TitleFa: "ردیف مقطوع", Unit: "ls", Basis: "lump", Sign: "+" },
      { Code: "R03", TitleFa: "سهم تجهیزات", Unit: "%", Basis: "percent", PercentOf: "R02", Sign: "+" },
    ],
    Deductions: [
      { Code: "D01", TitleFa: "حسن انجام کار", Kind: "retention", Mode: "percent", Rate: 5, Base: "gross" },
      { Code: "D02", TitleFa: "بازیافت پیشپرداخت", Kind: "advance", Mode: "percent", Rate: 10, Base: "running" },
    ],
    NoteFa: null,
  });
  const inputs = normalizeIpcInputs([
    { ItemCode: "R01", Quantity: 10, UnitRate: 1000 },
    { ItemCode: "R02", Amount: 5000 },
    { ItemCode: "R03", Percent: 20 },
  ]);
  const c = computeTemplateIpc(template, inputs);
  assert.equal(c.grossAmount, 16_000);
  assert.equal(c.deductionTotal, 2_320);
  assert.equal(c.netAmount, 13_680);
});

test("guaranteeState همچنان منقضیشدهٔ خاموش را تشخیص میدهد", () => {
  const s = guaranteeState({ Status: "active", ExpiryDate: future(-1) }, NOW);
  assert.equal(s.isExpiredSilently, true);
  assert.equal(s.isLive, false);
});
