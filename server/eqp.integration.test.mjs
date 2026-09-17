/* تست شکاف‌های High بستهٔ تحویل: G-01 قفل PEX، G-02 ثبت ایدمپوتنت هزینه،
 * و مهاجرت 0007 که پیش‌نیاز هر دو و G-03 است. */
import test from "node:test";
import assert from "node:assert/strict";

import { applyPostingToActual, buildCostPostings, isBlockingOrder, planActivityLocks } from "./eqmLogic.js";
import { MIGRATIONS, SCHEMA, allColumns, validateSchema } from "./sqlLogic.js";

/* ═══════════ مهاجرت 0007 ═══════════ */

test("مهاجرت 0007 وجود دارد و افزایشی است، نه بازساز جدول", () => {
  const m = MIGRATIONS.find((x) => x.version === "0007");
  assert.ok(m, "مهاجرت 0007 ثبت نشده");
  const alters = m.statements.filter((s) => s.includes("ALTER TABLE"));
  assert.equal(alters.length, 4, "چهار ستون جدید انتظار می‌رود");
  for (const st of alters) {
    assert.ok(st.includes("COL_LENGTH"), "ALTER باید ایدمپوتنت باشد");
    assert.ok(st.trim().endsWith("NULL;"), "ستون جدید باید nullable باشد تا دادهٔ موجود نشکند");
  }
});

test("ستون‌های جدید در اسکیما تعریف شده‌اند", () => {
  const has = (t, c) => allColumns(SCHEMA.find((x) => x.name === t)).some((x) => x.name === c);
  assert.ok(has("WorkforceMember", "LicenseType"), "HRM: نوع گواهی‌نامه");
  assert.ok(has("WorkforceMember", "LicenseExpiry"), "HRM: انقضای گواهی‌نامه");
  assert.ok(has("MaintenanceOrder", "RootCause"), "CMMS: علت ریشه‌ای");
  assert.ok(has("Activity", "BlockedByEquipmentId"), "PEX: قفل فعالیت");
});

test("ستون‌های جدید nullable هستند", () => {
  for (const [t, c] of [["WorkforceMember", "LicenseExpiry"], ["MaintenanceOrder", "RootCause"], ["Activity", "BlockedByEquipmentId"]]) {
    const col = allColumns(SCHEMA.find((x) => x.name === t)).find((x) => x.name === c);
    assert.notEqual(col.nullable, false, `${t}.${c} نباید NOT NULL باشد`);
  }
});

test("جدول دفتر ثبت هزینه با کلید یکتای دوره‌ای ساخته شد", () => {
  const t = SCHEMA.find((x) => x.name === "EquipmentCostPosting");
  assert.ok(t, "جدول EquipmentCostPosting نیست");
  const ux = t.indexes.find((i) => i.unique);
  assert.deepEqual(ux.columns, ["CostAccountId", "PeriodCode"], "کلید ایدمپوتنسی غلط است");
});

test("اسکیما پس از مهاجرت 0007 سالم است", () => {
  assert.deepEqual(validateSchema(), []);
});

/* ═══════════ G-01 · قفل فعالیت PEX ═══════════ */

const ORD_CRIT_OPEN = { Id: "w1", EquipmentId: "e1", Priority: "critical", Status: "open" };
const ORD_CRIT_CLOSED = { Id: "w2", EquipmentId: "e1", Priority: "critical", Status: "closed" };
const ORD_LOW_OPEN = { Id: "w3", EquipmentId: "e1", Priority: "low", Status: "open" };
const DSP = { Id: "d1", EquipmentId: "e1", ActivityId: "a1", Status: "approved" };

test("خرابی بحرانی باز، فعالیت متصل را قفل می‌کند", () => {
  const p = planActivityLocks({ activities: [{ Id: "a1" }], dispatches: [DSP], orders: [ORD_CRIT_OPEN] });
  assert.equal(p.lock.length, 1);
  assert.equal(p.lock[0].activityId, "a1");
  assert.equal(p.lock[0].equipmentId, "e1");
});

test("بسته شدن آخرین خرابی بحرانی، قفل را خودکار برمی‌دارد", () => {
  /* ریسک R-04: قفلی که فقط دستی باز شود فعالیت را برای همیشه می‌بندد. */
  const p = planActivityLocks({
    activities: [{ Id: "a1", BlockedByEquipmentId: "e1" }],
    dispatches: [DSP],
    orders: [ORD_CRIT_CLOSED],
  });
  assert.equal(p.release.length, 1, "آزادسازی خودکار انجام نشد");
  assert.equal(p.lock.length, 0);
});

test("خرابی غیربحرانی فعالیت را قفل نمی‌کند", () => {
  const p = planActivityLocks({ activities: [{ Id: "a1" }], dispatches: [DSP], orders: [ORD_LOW_OPEN] });
  assert.equal(p.lock.length, 0);
  assert.equal(p.unchanged, 1);
});

test("قفل موجود و درست، دوباره نوشته نمی‌شود", () => {
  const p = planActivityLocks({
    activities: [{ Id: "a1", BlockedByEquipmentId: "e1" }],
    dispatches: [DSP],
    orders: [ORD_CRIT_OPEN],
  });
  assert.equal(p.lock.length, 0, "نوشتن بی‌دلیل روی جدول PEX");
  assert.equal(p.release.length, 0);
  assert.equal(p.unchanged, 1);
});

test("دیسپچ لغوشده یا ردشده تخصیص محسوب نمی‌شود", () => {
  for (const st of ["cancelled", "rejected"]) {
    const p = planActivityLocks({
      activities: [{ Id: "a1" }],
      dispatches: [{ ...DSP, Status: st }],
      orders: [ORD_CRIT_OPEN],
    });
    assert.equal(p.lock.length, 0, `دیسپچ ${st} نباید قفل بسازد`);
  }
});

test("فعالیت با چند ماشین، با خرابی هرکدام قفل می‌شود", () => {
  const p = planActivityLocks({
    activities: [{ Id: "a1" }],
    dispatches: [DSP, { Id: "d2", EquipmentId: "e2", ActivityId: "a1", Status: "approved" }],
    orders: [{ Id: "w9", EquipmentId: "e2", Priority: "critical", Status: "in_progress" }],
  });
  assert.equal(p.lock.length, 1);
  assert.equal(p.lock[0].equipmentId, "e2");
});

test("محاسبهٔ قفل بارها اجرا شود نتیجه یکسان می‌دهد", () => {
  const args = { activities: [{ Id: "a1", BlockedByEquipmentId: "e1" }], dispatches: [DSP], orders: [ORD_CRIT_OPEN] };
  assert.deepEqual(planActivityLocks(args), planActivityLocks(args));
});

test("دیسپچ بدون فعالیت، قفلی نمی‌سازد", () => {
  const p = planActivityLocks({ activities: [{ Id: "a1" }], dispatches: [{ ...DSP, ActivityId: undefined }], orders: [ORD_CRIT_OPEN] });
  assert.equal(p.lock.length, 0);
});

test("isBlockingOrder فقط بحرانیِ باز یا در جریان را می‌گیرد", () => {
  assert.equal(isBlockingOrder({ Priority: "critical", Status: "open" }), true);
  assert.equal(isBlockingOrder({ Priority: "critical", Status: "in_progress" }), true);
  assert.equal(isBlockingOrder({ Priority: "critical", Status: "done" }), false);
  assert.equal(isBlockingOrder({ Priority: "high", Status: "open" }), false);
});

/* ═══════════ G-02 · ثبت هزینه ═══════════ */

const ROWS = [
  { equipmentId: "e1", code: "EQ-001", costAccountId: "CA-01", workHours: 100, rentalCost: 0, maintenanceCost: 0, fuelCost: 20e6 },
  { equipmentId: "e2", code: "EQ-002", costAccountId: "CA-01", workHours: 0, rentalCost: 50e6, maintenanceCost: 5e6, fuelCost: 0 },
  { equipmentId: "e3", code: "EQ-003", costAccountId: "CA-02", workHours: 10, rentalCost: 0, maintenanceCost: 0, fuelCost: 3e6 },
];

test("هزینه به تفکیک حساب جمع می‌شود", () => {
  const { postings } = buildCostPostings({ periodCode: "1405-06", rows: ROWS });
  assert.equal(postings.length, 2);
  const ca1 = postings.find((p) => p.costAccountId === "CA-01");
  assert.equal(ca1.amount, 75e6, "جمع CA-01 غلط است");
  assert.deepEqual(ca1.equipmentCodes, ["EQ-001", "EQ-002"]);
});

test("هزینهٔ بدون حساب، بی‌سروصدا به حسابی نمی‌چسبد", () => {
  const { postings, unallocated } = buildCostPostings({
    periodCode: "1405-06",
    rows: [...ROWS, { equipmentId: "e4", code: "EQ-004", workHours: 0, rentalCost: 9e6, maintenanceCost: 0, fuelCost: 0 }],
  });
  assert.equal(postings.length, 2, "ماشین بی‌حساب نباید سطر ثبت بسازد");
  assert.equal(unallocated.length, 1);
  assert.equal(unallocated[0].code, "EQ-004");
  assert.equal(unallocated[0].amount, 9e6);
});

test("ماشین بی‌حساب و بی‌هزینه در فهرست تخصیص‌نیافته نمی‌آید", () => {
  const { unallocated } = buildCostPostings({
    periodCode: "1405-06",
    rows: [{ equipmentId: "e5", code: "EQ-005", workHours: 0, rentalCost: 0, maintenanceCost: 0, fuelCost: 0 }],
  });
  assert.equal(unallocated.length, 0);
});

test("شرح ثبت، تفکیک سه‌گانهٔ هزینه را نگه می‌دارد", () => {
  const { postings } = buildCostPostings({ periodCode: "1405-06", rows: ROWS });
  const memo = postings.find((p) => p.costAccountId === "CA-01").memoFa;
  assert.ok(memo.includes("1405-06"));
  assert.ok(/اجاره|تعمیر|سوخت/.test(memo));
});

test("ثبت دوباره جمع Actual را دوبرابر نمی‌کند", () => {
  /* ریسک R-05 — مهم‌ترین تضمین این اندپوینت. */
  let actual = 1000;
  actual = applyPostingToActual(actual, 0, 500);
  assert.equal(actual, 1500);
  for (let i = 0; i < 5; i += 1) actual = applyPostingToActual(actual, 500, 500);
  assert.equal(actual, 1500, "اجرای مکرر جمع را متورم کرد");
});

test("تغییر مبلغ دوره، تفاوت را درست اعمال می‌کند", () => {
  const actual = applyPostingToActual(1500, 500, 800);
  assert.equal(actual, 1800);
});

test("کاهش مبلغ دوره هم درست اعمال می‌شود", () => {
  assert.equal(applyPostingToActual(1500, 500, 200), 1200);
});

test("Actual هرگز منفی نمی‌شود", () => {
  assert.equal(applyPostingToActual(100, 900, 0), 0);
});

test("هزینهٔ صفر سطر ثبت با مبلغ صفر می‌سازد نه حذف حساب", () => {
  const { postings } = buildCostPostings({
    periodCode: "1405-06",
    rows: [{ equipmentId: "e1", code: "EQ-001", costAccountId: "CA-09", workHours: 5, rentalCost: 0, maintenanceCost: 0, fuelCost: 0 }],
  });
  assert.equal(postings.length, 1);
  assert.equal(postings[0].amount, 0);
});
