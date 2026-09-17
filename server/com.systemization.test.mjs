import test from "node:test";
import assert from "node:assert/strict";
import {
  SCHEMA,
  MIGRATIONS,
} from "./sqlLogic.js";
import {
  GATE_ORDER,
  GATE_TYPE_FA,
  previousGate,
  validateSystemCode,
  validateSystemInput,
  detectCycle,
  buildSystemTree,
  flattenTree,
  subtreeIds,
  validateBoundary,
  assertSinglePrimary,
  boundaryCoverage,
  priorityMatrix,
  validateMilestone,
  daysBetween,
  gateSlip,
  validateGateSequence,
  completionPlan,
  systemizationSummary,
  systemizationMatrix,
} from "./comLogic.js";

/* ══════════════ اسکیما و مهاجرت ══════════════ */

test("سه جدول تفکیک سیستمی در اسکیما هستند", () => {
  for (const n of ["SystemSubsystem", "SystemBoundaryMapping", "SystemMilestoneTarget"]) {
    const t = SCHEMA.find((x) => x.name === n);
    assert.ok(t, `${n} نیست`);
    assert.equal(t.module, "d15");
    assert.equal(t.pk, "Id");
  }
});

test("جداول قبلی d15 دست‌نخورده مانده‌اند", () => {
  const cert = SCHEMA.find((t) => t.name === "CompletionCertificate");
  const punch = SCHEMA.find((t) => t.name === "PunchListItem");
  assert.ok(cert && punch);
  // هیچ ستونی حذف نشده
  for (const col of ["Id", "ProjectId", "ContractId", "CertificateType", "CertificateNo", "HandoverDate", "WarrantyMonths", "PredecessorId", "Status"])
    assert.ok(cert.columns.some((c) => c.name === col), `ستون ${col} حذف شده`);
  for (const col of ["Id", "ProjectId", "ItemNo", "Category", "RaisedAt", "Status"])
    assert.ok(punch.columns.some((c) => c.name === col), `ستون ${col} حذف شده`);
});

test("سه ستون جدید nullable هستند تا روی دادهٔ موجود نشکنند", () => {
  const cert = SCHEMA.find((t) => t.name === "CompletionCertificate");
  const punch = SCHEMA.find((t) => t.name === "PunchListItem");
  for (const [t, name] of [[cert, "SystemId"], [cert, "ReadyForGateAt"], [punch, "SystemId"]]) {
    const col = t.columns.find((c) => c.name === name);
    assert.ok(col, `${name} نیست`);
    assert.notEqual(col.nullable, false, `${name} نباید NOT NULL باشد`);
  }
});

test("دامنهٔ CertificateType به چهار گواهی گسترش یافته", () => {
  const cert = SCHEMA.find((t) => t.name === "CompletionCertificate");
  const col = cert.columns.find((c) => c.name === "CertificateType");
  assert.match(col.comment, /mc/);
  assert.match(col.comment, /rfsu/);
  assert.match(col.comment, /pac/);
  assert.match(col.comment, /fac/);
  assert.equal(col.len, 10, "طول ستون نباید عوض شود");
});

test("مهاجرت 0013 وجود دارد و مهاجرت‌های قبلی حفظ شده‌اند", () => {
  const versions = MIGRATIONS.map((m) => m.version);
  assert.ok(versions.includes("0012"), "مهاجرت 0012 نباید حذف شود");
  assert.ok(versions.includes("0013"));
  assert.ok(versions.includes("0014"), "مهاجرت بستهٔ آزمون حذف شده");
  /* «آخرین مهاجرت» ادعای شکننده‌ای است: هر ماژول بعدی آن را
   * می‌شکند بی‌آنکه چیزی دربارهٔ این ماژول بگوید. چیزی که باید
   * ثابت بماند نبودن شکاف و ترتیب صعودی است. */
  assert.deepEqual([...versions].sort(), versions, "ترتیب مهاجرت‌ها باید صعودی بماند");
  assert.equal(new Set(versions).size, versions.length, "شمارهٔ مهاجرت تکراری");
});

test("مهاجرت 0013 ایدمپوتنت است و ستون‌ها را با محافظ اضافه می‌کند", () => {
  const m = MIGRATIONS.find((x) => x.version === "0013");
  const adds = m.statements.filter((s) => s.includes("ALTER TABLE"));
  assert.equal(adds.length, 3);
  for (const s of adds) assert.match(s, /IF COL_LENGTH/, "افزودن ستون باید محافظ داشته باشد");
  const creates = m.statements.filter((s) => s.includes("CREATE TABLE"));
  assert.equal(creates.length, 3);
  for (const s of creates) assert.match(s, /IF OBJECT_ID/, "ساخت جدول باید محافظ داشته باشد");
});

test("ایندکس دروازهٔ نقص برای پرس‌وجوی داغ ساخته می‌شود", () => {
  const punch = SCHEMA.find((t) => t.name === "PunchListItem");
  const ix = punch.indexes.find((i) => i.name === "IX_PunchListItem_Gate");
  assert.ok(ix);
  assert.deepEqual(ix.columns, ["ProjectId", "SystemId", "Category", "Status"]);
});

/* ══════════════ اعتبارسنجی ══════════════ */

test("کد سیستم کاراکتر آزاد نمی‌پذیرد", () => {
  assert.equal(validateSystemCode("SYS-01"), null);
  assert.equal(validateSystemCode("U_100.A"), null);
  assert.equal(validateSystemCode("")?.code, "E-COM-CODE-REQUIRED");
  assert.equal(validateSystemCode("سیستم ۱")?.code, "E-COM-CODE-INVALID");
  assert.equal(validateSystemCode("-BAD")?.code, "E-COM-CODE-INVALID");
  assert.equal(validateSystemCode("A B")?.code, "E-COM-CODE-INVALID");
});

test("ورودی سیستم نامعتبر همهٔ خطاها را یک‌جا برمی‌گرداند", () => {
  const errs = validateSystemInput({ systemCode: "", titleFa: "", systemType: "zzz", status: "qqq", criticalityFa: "urgent", commissioningPriority: 0 });
  const codes = errs.map((e) => e.code);
  assert.ok(codes.includes("E-COM-CODE-REQUIRED"));
  assert.ok(codes.includes("E-COM-TITLE-REQUIRED"));
  assert.ok(codes.includes("E-COM-TYPE-INVALID"));
  assert.ok(codes.includes("E-COM-STATUS-INVALID"));
  assert.ok(codes.includes("E-COM-CRITICALITY-INVALID"));
  assert.ok(codes.includes("E-COM-PRIORITY-INVALID"));
});

test("ورودی معتبر خطا نمی‌دهد و بحرانیت اختیاری است", () => {
  assert.deepEqual(validateSystemInput({ systemCode: "SYS-1", titleFa: "واحد تقطیر", systemType: "system", status: "planned" }), []);
  assert.deepEqual(validateSystemInput({ systemCode: "SYS-2", titleFa: "پمپ", systemType: "package", criticalityFa: null }), []);
});

/* ══════════════ درخت ══════════════ */

const NODES = [
  { Id: "s1", ProjectId: "p1", ParentId: null, SystemCode: "U-100", TitleFa: "واحد تقطیر", SystemType: "system", Status: "planned", SortOrder: 1 },
  { Id: "s2", ProjectId: "p1", ParentId: "s1", SystemCode: "U-110", TitleFa: "برج", SystemType: "subsystem", Status: "precomm", SortOrder: 1 },
  { Id: "s3", ProjectId: "p1", ParentId: "s1", SystemCode: "U-120", TitleFa: "مبدل", SystemType: "subsystem", Status: "planned", SortOrder: 2 },
  { Id: "s4", ProjectId: "p1", ParentId: "s2", SystemCode: "U-111", TitleFa: "پمپ خوراک", SystemType: "package", Status: "planned", SortOrder: 1 },
  { Id: "s5", ProjectId: "p1", ParentId: null, SystemCode: "U-200", TitleFa: "واحد برق", SystemType: "system", Status: "comm", SortOrder: 2 },
];

test("درخت با عمق و مسیر صحیح ساخته می‌شود", () => {
  const { roots, orphans } = buildSystemTree(NODES);
  assert.equal(roots.length, 2);
  assert.equal(orphans.length, 0);
  const flat = flattenTree(roots);
  assert.equal(flat.length, 5);
  const pump = flat.find((n) => n.SystemCode === "U-111");
  assert.equal(pump.depth, 2);
  assert.deepEqual(pump.path, ["U-100", "U-110", "U-111"]);
});

test("شمارش نوادگان درست است", () => {
  const { roots } = buildSystemTree(NODES);
  const u100 = roots.find((r) => r.SystemCode === "U-100");
  assert.equal(u100.descendantCount, 3);
  const u200 = roots.find((r) => r.SystemCode === "U-200");
  assert.equal(u200.descendantCount, 0);
});

test("گرهٔ یتیم پنهان نمی‌شود بلکه به‌عنوان ریشه برمی‌گردد", () => {
  const withOrphan = [...NODES, { Id: "s9", ProjectId: "p1", ParentId: "ghost", SystemCode: "U-900", TitleFa: "بی‌والد", SystemType: "package", Status: "planned" }];
  const { roots, orphans } = buildSystemTree(withOrphan);
  assert.deepEqual(orphans, ["s9"]);
  assert.ok(roots.some((r) => r.Id === "s9"), "گرهٔ یتیم باید دیده شود");
  assert.equal(flattenTree(roots).length, 6, "هیچ گرهی نباید گم شود");
});

test("مرتب‌سازی هم‌نیاها بر SortOrder سپس کد است", () => {
  const shuffled = [
    { Id: "a", ProjectId: "p1", ParentId: null, SystemCode: "Z-1", TitleFa: "ز", SystemType: "system", Status: "planned", SortOrder: 5 },
    { Id: "b", ProjectId: "p1", ParentId: null, SystemCode: "A-1", TitleFa: "الف", SystemType: "system", Status: "planned", SortOrder: 5 },
    { Id: "c", ProjectId: "p1", ParentId: null, SystemCode: "M-1", TitleFa: "م", SystemType: "system", Status: "planned", SortOrder: 1 },
  ];
  const { roots } = buildSystemTree(shuffled);
  assert.deepEqual(roots.map((r) => r.SystemCode), ["M-1", "A-1", "Z-1"]);
});

test("حلقهٔ مستقیم و غیرمستقیم تشخیص داده می‌شود", () => {
  assert.equal(detectCycle(NODES, "s1", "s1")?.code, "E-COM-SELF-PARENT");
  // s1 والد s2 است؛ پس s2 نمی‌تواند والد s1 شود
  assert.equal(detectCycle(NODES, "s1", "s2")?.code, "E-COM-CYCLE");
  // حلقهٔ سه‌سطحی: s1 -> s2 -> s4
  assert.equal(detectCycle(NODES, "s1", "s4")?.code, "E-COM-CYCLE");
  // انتساب معتبر
  assert.equal(detectCycle(NODES, "s5", "s1"), null);
  assert.equal(detectCycle(NODES, "s3", null), null);
});

test("زیردرخت شامل خود گره است", () => {
  assert.deepEqual(subtreeIds(NODES, "s1").sort(), ["s1", "s2", "s3", "s4"]);
  assert.deepEqual(subtreeIds(NODES, "s4"), ["s4"]);
  assert.deepEqual(subtreeIds(NODES, "s5"), ["s5"]);
});

/* ══════════════ مرزبندی ══════════════ */

const BOUNDS = [
  { Id: "b1", SystemId: "s1", TargetKind: "wbs", TargetRef: "W-1", IsPrimary: true },
  { Id: "b2", SystemId: "s1", TargetKind: "pid", TargetRef: "PID-01", IsPrimary: false },
  { Id: "b3", SystemId: "s2", TargetKind: "pid", TargetRef: "PID-02", IsPrimary: true },
];

test("نوع مرز نامعتبر رد می‌شود", () => {
  assert.deepEqual(validateBoundary({ targetKind: "wbs", targetRef: "W-1" }), []);
  const errs = validateBoundary({ targetKind: "spreadsheet", targetRef: "" });
  assert.equal(errs.length, 2);
  assert.ok(errs.some((e) => e.code === "E-COM-BOUNDARY-KIND"));
  assert.ok(errs.some((e) => e.code === "E-COM-BOUNDARY-REF"));
});

test("دو نگاشت اصلی برای یک سیستم رد می‌شود", () => {
  assert.equal(assertSinglePrimary(BOUNDS, "s1"), null);
  const bad = [...BOUNDS, { Id: "b4", SystemId: "s1", TargetKind: "activity", TargetRef: "A-9", IsPrimary: 1 }];
  assert.equal(assertSinglePrimary(bad, "s1")?.code, "E-COM-MULTI-PRIMARY");
});

test("سیستم بدون مرز شکاف گزارش می‌کند", () => {
  const cov = boundaryCoverage(BOUNDS, "s9");
  assert.equal(cov.total, 0);
  assert.equal(cov.hasPrimary, false);
  assert.ok(cov.gapsFa.some((g) => g.includes("هیچ مرزی")));
});

test("سیستم بدون نگاشت به بستهٔ کاری یا فعالیت شکاف دارد", () => {
  const cov = boundaryCoverage(BOUNDS, "s2");
  assert.equal(cov.total, 1);
  assert.equal(cov.hasPrimary, true);
  assert.ok(cov.gapsFa.some((g) => g.includes("بستهٔ کاری")));
});

test("سیستم با مرز کامل شکاف ندارد", () => {
  const cov = boundaryCoverage(BOUNDS, "s1");
  assert.deepEqual(cov.gapsFa, []);
  assert.deepEqual(cov.byKind, { wbs: 1, pid: 1 });
});

/* ══════════════ ماتریس اولویت ══════════════ */

test("ماتریس اولویت بحرانیت را با آمادگی می‌سنجد", () => {
  const systems = [
    { Id: "a", ProjectId: "p1", SystemCode: "A", TitleFa: "الف", SystemType: "system", Status: "planned", CriticalityFa: "high", CommissioningPriority: 1 },
    { Id: "b", ProjectId: "p1", SystemCode: "B", TitleFa: "ب", SystemType: "system", Status: "planned", CriticalityFa: "high", CommissioningPriority: 2 },
    { Id: "c", ProjectId: "p1", SystemCode: "C", TitleFa: "ج", SystemType: "system", Status: "planned", CriticalityFa: "low", CommissioningPriority: 3 },
  ];
  const cells = priorityMatrix(systems, { a: 95, b: 10, c: 100 });
  const byId = Object.fromEntries(cells.map((c) => [c.systemId, c]));
  assert.equal(byId.a.band, "now", "بحرانی و آماده باید اکنون باشد");
  assert.equal(byId.b.band, "later", "بحرانی ولی ناآماده نباید صف را قفل کند");
  assert.equal(byId.c.band, "next", "کم‌اهمیت ولی آماده");
  assert.equal(byId.a.rank, 1);
});

test("سیستم بدون بحرانیت متوسط فرض می‌شود و آمادگی نامعتبر صفر", () => {
  const cells = priorityMatrix(
    [{ Id: "x", ProjectId: "p1", SystemCode: "X", TitleFa: "ایکس", SystemType: "system", Status: "planned" }],
    { x: Number.NaN },
  );
  assert.equal(cells[0].criticality, "medium");
  assert.equal(cells[0].readinessPct, 0);
  assert.equal(cells[0].band, "hold");
  assert.equal(cells[0].priority, 999, "اولویت تعیین‌نشده باید ته صف برود");
});

test("آمادگی بیرون بازه بریده می‌شود", () => {
  const cells = priorityMatrix(
    [{ Id: "x", ProjectId: "p1", SystemCode: "X", TitleFa: "ایکس", SystemType: "system", Status: "planned" }],
    { x: 250 },
  );
  assert.equal(cells[0].readinessPct, 100);
});

/* ══════════════ دروازه‌ها ══════════════ */

test("ترتیب دروازه‌ها و دروازهٔ پیشین درست است", () => {
  assert.deepEqual(GATE_ORDER, ["mc", "rfsu", "pac", "fac"]);
  assert.equal(previousGate("mc"), null);
  assert.equal(previousGate("rfsu"), "mc");
  assert.equal(previousGate("fac"), "pac");
  assert.equal(GATE_TYPE_FA.pac, "تحویل موقت");
});

test("تاریخ هدف نامعتبر رد می‌شود", () => {
  assert.deepEqual(validateMilestone({ gateType: "mc", targetDate: "2026-03-01" }), []);
  const errs = validateMilestone({ gateType: "xx", targetDate: "1405/01/01" });
  assert.equal(errs.length, 2);
  assert.ok(errs.some((e) => e.code === "E-COM-GATE-INVALID"));
  assert.ok(errs.some((e) => e.code === "E-COM-TARGET-DATE"));
});

test("فاصلهٔ روز درست محاسبه می‌شود", () => {
  assert.equal(daysBetween("2026-01-01", "2026-01-31"), 30);
  assert.equal(daysBetween("2026-03-01", "2026-02-01"), -28);
  assert.equal(daysBetween("bad", "2026-01-01"), 0);
});

test("لغزش با نبود تاریخ واقعی نامعلوم است نه صفر", () => {
  assert.deepEqual(gateSlip({ Id: "m", SystemId: "s", GateType: "mc", TargetDate: "2026-01-01" }), { slipDays: null, basis: "unknown" });
  assert.deepEqual(gateSlip({ Id: "m", SystemId: "s", GateType: "mc", TargetDate: "2026-01-01", ForecastDate: "2026-01-11" }), { slipDays: 10, basis: "forecast" });
  // واقعی بر پیش‌بینی اولویت دارد
  assert.deepEqual(gateSlip({ Id: "m", SystemId: "s", GateType: "mc", TargetDate: "2026-01-01", ForecastDate: "2026-01-11", ActualDate: "2026-01-06" }), { slipDays: 5, basis: "actual" });
});

test("لغزش منفی یعنی زودتر از موعد", () => {
  const { slipDays } = gateSlip({ Id: "m", SystemId: "s", GateType: "pac", TargetDate: "2026-06-01", ActualDate: "2026-05-20" });
  assert.equal(slipDays, -12);
});

test("ترتیب زمانی دروازه‌ها اجباری است", () => {
  const ok = [
    { Id: "1", SystemId: "s1", GateType: "mc", TargetDate: "2026-01-01" },
    { Id: "2", SystemId: "s1", GateType: "rfsu", TargetDate: "2026-02-01" },
    { Id: "3", SystemId: "s1", GateType: "pac", TargetDate: "2026-03-01" },
    { Id: "4", SystemId: "s1", GateType: "fac", TargetDate: "2027-03-01" },
  ];
  assert.deepEqual(validateGateSequence(ok), []);

  const bad = [
    { Id: "1", SystemId: "s1", GateType: "mc", TargetDate: "2026-05-01" },
    { Id: "2", SystemId: "s1", GateType: "rfsu", TargetDate: "2026-02-01" },
  ];
  assert.equal(validateGateSequence(bad)[0].code, "E-COM-GATE-SEQUENCE");
});

test("ترتیب با دروازهٔ غایب بررسی نمی‌شود", () => {
  const partial = [
    { Id: "1", SystemId: "s1", GateType: "mc", TargetDate: "2026-05-01" },
    { Id: "4", SystemId: "s1", GateType: "fac", TargetDate: "2027-03-01" },
  ];
  assert.deepEqual(validateGateSequence(partial), []);
});

/* ══════════════ برنامهٔ تحویل ══════════════ */

const MILES = [
  { Id: "m1", SystemId: "s1", GateType: "mc", TargetDate: "2026-01-01", ActualDate: "2026-01-21" },
  { Id: "m2", SystemId: "s1", GateType: "rfsu", TargetDate: "2026-02-01", ForecastDate: "2026-02-06" },
  { Id: "m3", SystemId: "s2", GateType: "mc", TargetDate: "2026-03-01" },
];

test("برنامهٔ تحویل بدترین لغزش را می‌گیرد", () => {
  const plan = completionPlan(NODES, MILES);
  const s1 = plan.find((p) => p.systemId === "s1");
  assert.equal(s1.gates.mc.slipDays, 20);
  assert.equal(s1.gates.rfsu.slipDays, 5);
  assert.equal(s1.worstSlipDays, 20);
  assert.equal(s1.gates.pac.basis, "unset");
});

test("سیستم بدون هیچ تاریخ واقعی لغزش نامعلوم دارد", () => {
  const plan = completionPlan(NODES, MILES);
  const s2 = plan.find((p) => p.systemId === "s2");
  assert.equal(s2.worstSlipDays, null);
  assert.equal(s2.gates.mc.basis, "unknown");
});

test("وضعیت نامعتبر به برنامه‌ریزی‌شده برمی‌گردد", () => {
  const plan = completionPlan([{ Id: "z", ProjectId: "p1", SystemCode: "Z", TitleFa: "ز", SystemType: "system", Status: "چرند" }], []);
  assert.equal(plan[0].status, "planned");
  assert.equal(plan[0].statusFa, "برنامه‌ریزی‌شده");
});

/* ══════════════ خلاصه و ماتریس ══════════════ */

test("خلاصهٔ تفکیک سیستمی شکاف‌ها را می‌شمارد", () => {
  const sum = systemizationSummary(NODES, BOUNDS, MILES);
  assert.equal(sum.total, 5);
  assert.equal(sum.rootCount, 2);
  assert.equal(sum.maxDepth, 2);
  assert.equal(sum.orphanCount, 0);
  assert.equal(sum.withoutBoundary, 3, "s3 s4 s5 مرز ندارند");
  assert.equal(sum.withoutMilestone, 3, "s3 s4 s5 تاریخ هدف ندارند");
  // فقط s1 و s2 هم مرز دارند هم تاریخ
  assert.equal(sum.readinessPct, 40);
  assert.deepEqual(sum.byType, { system: 2, subsystem: 2, package: 1 });
});

test("خلاصهٔ پروژهٔ خالی صفر می‌دهد نه خطا", () => {
  const sum = systemizationSummary([], [], []);
  assert.equal(sum.total, 0);
  assert.equal(sum.readinessPct, 0);
  assert.equal(sum.maxDepth, 0);
});

test("ماتریس سیستمی ستون‌های فارسی و ترتیب درخت دارد", () => {
  const rows = systemizationMatrix(NODES, BOUNDS, MILES);
  assert.equal(rows.length, 5);
  // ترتیب پیمایش درخت: U-100 سپس فرزندانش
  assert.equal(rows[0]["کد"], "U-100");
  assert.equal(rows[1]["کد"], "U-110");
  assert.equal(rows[2]["کد"], "U-111");
  assert.equal(rows[3]["کد"], "U-120");
  assert.equal(rows[4]["کد"], "U-200");
  assert.equal(rows[0]["سطح"], 1);
  assert.equal(rows[2]["سطح"], 3);
  assert.equal(rows[2]["والد"], "U-110");
  assert.equal(rows[0]["مرزها"], 2);
  assert.equal(rows[0]["هدف تکمیل مکانیکی"], "2026-01-01");
  assert.equal(rows[0]["بدترین لغزش"], "20 روز");
  assert.equal(rows[4]["بدترین لغزش"], "—");
});

test("ماتریس نوع و وضعیت را فارسی می‌کند", () => {
  const rows = systemizationMatrix(NODES, [], []);
  assert.equal(rows[0]["نوع"], "سیستم");
  assert.equal(rows[1]["وضعیت"], "پیش‌راه‌اندازی");
  assert.equal(rows[2]["نوع"], "بسته");
});
