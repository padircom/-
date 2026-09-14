/* آزمون موتور تحویل موقت/قطعی و دفتر سپرده (PAC/FAC + D6).
 *
 * این دو با هم آزموده می‌شوند چون معنایشان به هم گره خورده: آزادسازی
 * ۵۰/۵۰ سپرده تنها رویدادی است که PAC و FAC را به پول وصل می‌کند. آنچه
 * سنجیده می‌شود دقیقاً همان جاهایی است که پول اشتباه آزاد می‌شود. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  certificateGate,
  planRetainageRelease,
  punchSummary,
  retainageBalance,
  warrantyEnd,
} from "./cntLogic.js";

/* ───────────────────────── فهرست نواقص ───────────────────────── */

test("جمع‌بندی نواقص باز و بسته به تفکیک دسته", () => {
  const s = punchSummary([
    { ItemNo: "P-1", Category: "a", Status: "open" },
    { ItemNo: "P-2", Category: "b", Status: "open" },
    { ItemNo: "P-3", Category: "c", Status: "closed" },
    { ItemNo: "P-4", Category: "a", Status: "waived" },
  ]);
  assert.equal(s.total, 4);
  assert.equal(s.open, 2);
  assert.equal(s.closed, 1);
  assert.equal(s.waived, 1);
  assert.equal(s.blockingCount, 1);
  assert.deepEqual(s.blockingItems, ["P-1"]);
});

test("نقص صرف‌نظر شده مانع تحویل نیست ولی جدا شمرده می‌شود", () => {
  const s = punchSummary([{ ItemNo: "P-9", Category: "a", Status: "waived" }]);
  assert.equal(s.blockingCount, 0);
  assert.equal(s.waived, 1);
  assert.equal(s.open, 0);
});

test("نقص بدون دسته، جزئی فرض می‌شود نه مانع", () => {
  const s = punchSummary([{ ItemNo: "P-0", Status: "open" }]);
  assert.equal(s.blockingCount, 0);
  assert.equal(s.openByCategory.c, 1);
});

/* ───────────────────────── دروازهٔ تحویل موقت ───────────────────────── */

test("تحویل موقت با نقص دستهٔ الف صادر نمی‌شود", () => {
  const r = certificateGate({
    type: "pac",
    punchItems: [{ ItemNo: "P-1", Category: "a", Status: "open" }],
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-CNT-PUNCH-BLOCKING");
  assert.match(r.messageFa, /P-1/);
});

test("تحویل موقت با نقص دستهٔ ب و ج صادر می‌شود", () => {
  /* اگر ب و ج هم مانع بودند، هیچ پروژه‌ای تحویل موقت نمی‌گرفت. */
  const r = certificateGate({
    type: "pac",
    punchItems: [
      { ItemNo: "P-2", Category: "b", Status: "open" },
      { ItemNo: "P-3", Category: "c", Status: "open" },
    ],
  });
  assert.equal(r.ok, true);
  assert.equal(r.punch.open, 2);
});

test("تحویل موقت بدون هیچ نقصی صادر می‌شود", () => {
  const r = certificateGate({ type: "pac", punchItems: [] });
  assert.equal(r.ok, true);
});

/* ───────────────────────── دروازهٔ تحویل قطعی ───────────────────────── */

test("تحویل قطعی بدون تحویل موقت پیشین صادر نمی‌شود", () => {
  const r = certificateGate({ type: "fac", punchItems: [], hasPac: false });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-CNT-NO-PAC");
});

test("تحویل قطعی با هر نقص بازی رد می‌شود، حتی دستهٔ ج", () => {
  const r = certificateGate({
    type: "fac",
    punchItems: [{ ItemNo: "P-5", Category: "c", Status: "open" }],
    hasPac: true,
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-CNT-PUNCH-OPEN");
});

test("تحویل قطعی پیش از پایان دورهٔ تضمین صادر نمی‌شود", () => {
  const r = certificateGate({ type: "fac", punchItems: [], hasPac: true, warrantyEnded: false });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-CNT-WARRANTY-ACTIVE");
});

test("تحویل قطعی با همهٔ شرایط صادر می‌شود", () => {
  const r = certificateGate({
    type: "fac",
    punchItems: [{ ItemNo: "P-6", Category: "a", Status: "closed" }],
    hasPac: true,
    warrantyEnded: true,
  });
  assert.equal(r.ok, true);
});

/* ───────────────────────── دورهٔ تضمین ───────────────────────── */

test("پایان تضمین از تاریخ تحویل حساب می‌شود نه تاریخ صدور", () => {
  assert.equal(warrantyEnd("2026-03-15", 12), "2027-03-15");
  assert.equal(warrantyEnd("2026-01-31", 1), "2026-03-03");
});

test("تاریخ نامعتبر پایان تضمین را نمی‌شکند", () => {
  assert.equal(warrantyEnd("", 12), null);
  assert.equal(warrantyEnd("چرند", 12), null);
});

/* ───────────────────────── ماندهٔ سپرده ───────────────────────── */

test("ماندهٔ سپرده از انباشت منهای آزادسازی و ضبط می‌آید", () => {
  const b = retainageBalance([
    { EntryType: "accrual", Amount: 100 },
    { EntryType: "accrual", Amount: 50 },
    { EntryType: "release_pac", Amount: 75 },
    { EntryType: "forfeit", Amount: 10 },
  ]);
  assert.equal(b.accrued, 150);
  assert.equal(b.released, 75);
  assert.equal(b.forfeited, 10);
  assert.equal(b.balance, 65);
  assert.equal(b.pacReleased, true);
  assert.equal(b.facReleased, false);
});

test("سطر برگشتی در مانده اثر ندارد", () => {
  const b = retainageBalance([
    { EntryType: "accrual", Amount: 100 },
    { EntryType: "accrual", Amount: 999, Status: "reversed" },
  ]);
  assert.equal(b.balance, 100);
});

/* ─────────────────── آزادسازی ۵۰/۵۰ (رفع G-01) ─────────────────── */

test("تحویل موقت نصف کل انباشت را آزاد می‌کند", () => {
  const entries = [{ EntryType: "accrual", Amount: 1_000_000 }];
  const p = planRetainageRelease({ entries, event: "pac" });
  assert.equal(p.ok, true);
  assert.equal(p.entryType, "release_pac");
  assert.equal(p.releaseAmount, 500_000);
  assert.equal(p.balanceAfter, 500_000);
});

test("تحویل قطعی کل ماندهٔ باقی‌مانده را می‌برد", () => {
  const entries = [
    { EntryType: "accrual", Amount: 1_000_000 },
    { EntryType: "release_pac", Amount: 500_000 },
  ];
  const p = planRetainageRelease({ entries, event: "fac" });
  assert.equal(p.ok, true);
  assert.equal(p.entryType, "release_fac");
  assert.equal(p.releaseAmount, 500_000);
  assert.equal(p.balanceAfter, 0);
});

test("سپردهٔ انباشته پس از تحویل موقت هم در تحویل قطعی آزاد می‌شود", () => {
  /* اگر تحویل قطعی هم پنجاه درصد ثابت می‌گرفت، این مبلغ برای همیشه
   * در دفتر گیر می‌کرد و پیمانکار کاملش را نمی‌گرفت. */
  const entries = [
    { EntryType: "accrual", Amount: 1_000_000 },
    { EntryType: "release_pac", Amount: 500_000 },
    { EntryType: "accrual", Amount: 200_000 },
  ];
  const p = planRetainageRelease({ entries, event: "fac" });
  assert.equal(p.releaseAmount, 700_000);
  assert.equal(p.balanceAfter, 0);
});

test("آزادسازی دوبارهٔ سهم تحویل موقت رد می‌شود", () => {
  const entries = [
    { EntryType: "accrual", Amount: 1_000_000 },
    { EntryType: "release_pac", Amount: 500_000 },
  ];
  const p = planRetainageRelease({ entries, event: "pac" });
  assert.equal(p.ok, false);
  assert.equal(p.code, "E-CNT-PAC-ALREADY-RELEASED");
  assert.equal(p.releaseAmount, 0);
});

test("تحویل قطعی پیش از آزادسازی تحویل موقت انجام نمی‌شود", () => {
  const p = planRetainageRelease({
    entries: [{ EntryType: "accrual", Amount: 1_000_000 }],
    event: "fac",
  });
  assert.equal(p.ok, false);
  assert.equal(p.code, "E-CNT-PAC-NOT-RELEASED");
});

test("ضبط سپرده سهم آزادسازی را کاهش می‌دهد", () => {
  const entries = [
    { EntryType: "accrual", Amount: 1_000_000 },
    { EntryType: "forfeit", Amount: 800_000 },
  ];
  const p = planRetainageRelease({ entries, event: "pac" });
  /* نصف انباشت ۵۰۰ هزار است ولی مانده فقط ۲۰۰ هزار. */
  assert.equal(p.releaseAmount, 200_000);
  assert.equal(p.balanceAfter, 0);
});

test("سپردهٔ صفر آزادسازی نمی‌سازد", () => {
  const p = planRetainageRelease({ entries: [], event: "pac" });
  assert.equal(p.ok, false);
  assert.equal(p.code, "E-CNT-NO-RETAINAGE");
});

test("درصد آزادسازی قابل تنظیم است", () => {
  const p = planRetainageRelease({
    entries: [{ EntryType: "accrual", Amount: 1_000_000 }],
    event: "pac",
    pacSharePct: 30,
  });
  assert.equal(p.releaseAmount, 300_000);
  assert.equal(p.balanceAfter, 700_000);
});
