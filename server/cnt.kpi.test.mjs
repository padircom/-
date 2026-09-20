/**
 * آزمون موتور سنجه و هشدار زودهنگام پیمان (CNT/D10).
 *
 * تمرکز روی جاهایی که تابلوی مدیریتی معمولاً دروغ می‌گوید: میانگین
 * چرخه که صورت‌وضعیت‌های گیرکرده را نمی‌بیند، نمرهٔ سلامتی که از یک
 * سوم داده ساخته شده، هشداری که به‌خاطر نبود داده بی‌صدا رد می‌شود،
 * و روندی که علامت عدد را با «بهبود» یکی می‌گیرد.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_KPI_CATALOG,
  KPI_BY_CODE,
  ipcCycle,
  extraWorkRatio,
  contractKpis,
  ALERT_SEVERITY_FA,
  DEFAULT_ALERT_RULES,
  evaluateAlerts,
  HEALTH_BAND_FA,
  contractHealth,
  TREND_FA,
  kpiTrend,
  contractScorecard,
} from "./cntLogic.js";

const NOW = new Date("2026-06-01T00:00:00Z");

/* ══════════════ ۱) فهرست سنجه‌ها ══════════════ */

test("هر سنجه شناسه، واحد و جهت دارد", () => {
  assert.equal(CONTRACT_KPI_CATALOG.length, 10);
  for (const k of CONTRACT_KPI_CATALOG) {
    assert.ok(k.code && k.titleFa && k.hintFa, k.code);
    assert.ok(["pct", "days", "count", "amount"].includes(k.unit), k.code);
    assert.ok(["higher_better", "lower_better", "target_100"].includes(k.direction), k.code);
  }
  assert.equal(new Set(CONTRACT_KPI_CATALOG.map((k) => k.code)).size, 10, "شناسه‌ها یکتا");
});

test("هر قاعدهٔ هشدار به سنجهٔ موجود اشاره می‌کند و اقدام دارد", () => {
  for (const r of DEFAULT_ALERT_RULES) {
    assert.ok(KPI_BY_CODE[r.kpi], `${r.code} به سنجهٔ ناموجود ${r.kpi} اشاره دارد`);
    assert.ok(r.actionFa.length > 20, `${r.code} اقدام مشخصی ندارد`);
    assert.ok(["gt", "lt"].includes(r.op));
  }
  assert.equal(new Set(DEFAULT_ALERT_RULES.map((r) => r.code)).size, DEFAULT_ALERT_RULES.length);
});

/* ══════════════ ۲) چرخهٔ صورت‌وضعیت ══════════════ */

test("چرخه از ارسال تا تأیید کارفرما شمرده می‌شود", () => {
  const c = ipcCycle({
    rows: [{
      SerialNo: 1, WorkflowState: "approved",
      SubmittedAt: "2026-01-01", ConsultantApprovedAt: "2026-01-10", EmployerApprovedAt: "2026-01-21",
    }],
    now: NOW,
  });
  assert.equal(c.closed[0].days, 20);
  assert.equal(c.closed[0].consultantDays, 9);
  assert.equal(c.avgDays, 20);
});

test("صورت‌وضعیت گیرکرده میانگین را بالا می‌برد — دام بقا", () => {
  const c = ipcCycle({
    rows: [
      { SerialNo: 1, WorkflowState: "approved", SubmittedAt: "2026-05-01", EmployerApprovedAt: "2026-05-11" },
      { SerialNo: 2, WorkflowState: "submitted", SubmittedAt: "2026-01-01" },  /* ۱۵۱ روز باز */
    ],
    now: NOW,
  });
  assert.equal(c.avgDays, 10, "میانگین بسته‌ها فقط سریع‌ها را می‌بیند");
  assert.ok(c.avgIncludingOpenDays > 75, `با احتساب باز: ${c.avgIncludingOpenDays}`);
  assert.equal(c.openCount, 1);
  assert.ok(c.warningsFa.some((w) => w.includes("با احتساب")));
});

test("قدیمی‌ترین باز با مرحله‌اش گزارش می‌شود", () => {
  const c = ipcCycle({
    rows: [{ SerialNo: 7, WorkflowState: "submitted", SubmittedAt: "2026-01-01" }],
    now: NOW,
  });
  assert.equal(c.oldestOpenDays, 151);
  assert.equal(c.open[0].stageFa, "منتظر بررسی مشاور");
  assert.ok(c.warningsFa.some((w) => w.includes("7") && w.includes("151")));
});

test("صورت‌وضعیت ارسال‌نشده چرخه ندارد", () => {
  const c = ipcCycle({ rows: [{ SerialNo: 1, WorkflowState: "draft" }], now: NOW });
  assert.equal(c.closed.length, 0);
  assert.equal(c.openCount, 0);
  assert.equal(c.avgDays, 0);
});

test("لغوشده شمرده نمی‌شود", () => {
  const c = ipcCycle({
    rows: [{ SerialNo: 1, WorkflowState: "submitted", SubmittedAt: "2026-01-01", Status: "cancelled" }],
    now: NOW,
  });
  assert.equal(c.openCount, 0);
});

test("تأیید پیش از ارسال، میانگین را منفی نمی‌کند", () => {
  const c = ipcCycle({
    rows: [{ SerialNo: 1, WorkflowState: "approved", SubmittedAt: "2026-05-10", EmployerApprovedAt: "2026-05-01" }],
    now: NOW,
  });
  assert.equal(c.closed[0].days, 0, "کلمپ به صفر، نه عدد منفی");
  assert.ok(c.avgDays >= 0);
});

test("باز مرتب بر سن، بسته مرتب بر شماره", () => {
  const c = ipcCycle({
    rows: [
      { SerialNo: 3, WorkflowState: "submitted", SubmittedAt: "2026-05-01" },
      { SerialNo: 1, WorkflowState: "submitted", SubmittedAt: "2026-02-01" },
    ],
    now: NOW,
  });
  assert.equal(c.open[0].serialNo, 1, "قدیمی‌ترین اول");
});

/* ══════════════ ۳) نسبت کار جدید ══════════════ */

test("ردیف ستاره‌دار و تغییر مقادیر با هم شمرده می‌شوند", () => {
  const r = extraWorkRatio({
    boq: [
      { ContractQty: 10, UnitRate: 1_000, IsStarred: true },
      { ContractQty: 100, UnitRate: 1_000 },
    ],
    changes: [{ DeltaAmount: 5_000 }],
    initialAmount: 100_000,
  });
  assert.equal(r.starredAmount, 10_000);
  assert.equal(r.changeAmount, 5_000);
  assert.equal(r.ratioPct, 15);
  assert.equal(r.starredCount, 1);
});

test("ستارهٔ رشته‌ای و عددی هم شناخته می‌شود", () => {
  const r = extraWorkRatio({
    boq: [
      { ContractQty: 1, UnitRate: 1_000, IsStarred: 1 },
      { ContractQty: 1, UnitRate: 1_000, IsStarred: "1" },
    ],
    initialAmount: 100_000,
  });
  assert.equal(r.starredCount, 2);
});

test("عبور از ماده ۲۹ هشدار می‌دهد", () => {
  const r = extraWorkRatio({
    boq: [{ ContractQty: 30, UnitRate: 1_000, IsStarred: true }],
    initialAmount: 100_000,
  });
  assert.equal(r.ratioPct, 30);
  assert.ok(r.warningsFa.some((w) => w.includes("ماده ۲۹")));
});

test("مبنا مبلغ اولیه است نه جاری", () => {
  /* اگر مبنا جاری بود، هر الحاقیه نسبت را کوچک می‌کرد. */
  const r = extraWorkRatio({
    boq: [{ ContractQty: 25, UnitRate: 1_000, IsStarred: true }],
    initialAmount: 100_000,
  });
  assert.equal(r.baseAmount, 100_000);
  assert.equal(r.ratioPct, 25);
});

test("مبلغ اولیهٔ صفر هشدار می‌دهد نه تقسیم بر صفر", () => {
  const r = extraWorkRatio({ boq: [], initialAmount: 0 });
  assert.equal(r.ratioPct, 0);
  assert.ok(Number.isFinite(r.ratioPct));
  assert.ok(r.warningsFa.some((w) => w.includes("صفر")));
});

/* ══════════════ ۴) محاسبهٔ سنجه‌ها ══════════════ */

test("سنجهٔ بی‌داده null است نه صفر", () => {
  const k = contractKpis({ physicalPct: 40 });
  assert.equal(k.byCode.physical_pct, 40);
  assert.equal(k.byCode.ceiling_used_pct, null, "نداشتن داده با صفر یکی نیست");
  assert.equal(k.values.find((v) => v.code === "ceiling_used_pct").displayFa, "—");
  assert.equal(k.computableCount, 1);
});

test("دادهٔ ناقص، هشدار پوشش می‌دهد", () => {
  const k = contractKpis({ physicalPct: 10 });
  assert.ok(k.warningsFa.some((w) => w.includes("دادهٔ کافی")));
});

test("واحد در متن نمایشی می‌آید", () => {
  const k = contractKpis({ physicalPct: 42.5, avgIpcCycleDays: 33.4, openGuaranteeCount: 3 });
  assert.equal(k.values.find((v) => v.code === "physical_pct").displayFa, "42.5٪");
  assert.equal(k.values.find((v) => v.code === "avg_ipc_cycle_days").displayFa, "33.4 روز");
  assert.equal(k.values.find((v) => v.code === "open_guarantee_count").displayFa, "3");
});

test("عدد نامعتبر null می‌شود", () => {
  const k = contractKpis({ physicalPct: Number.NaN, financialPct: Number.POSITIVE_INFINITY });
  assert.equal(k.byCode.physical_pct, null);
  assert.equal(k.byCode.financial_pct, null);
});

/* ══════════════ ۵) هشدارها ══════════════ */

const FULL = {
  physicalPct: 50, financialPct: 52, gapPct: 2, ceilingUsedPct: 40,
  advanceRecoveredPct: 60, extraWorkRatioPct: 5, avgIpcCycleDays: 25,
  openGuaranteeCount: 2, expiringGuaranteeCount: 0, retainageBalance: 100_000,
};

test("پیمان سالم هیچ هشداری ندارد", () => {
  const v = evaluateAlerts({ kpis: contractKpis(FULL) });
  assert.equal(v.fired.length, 0);
  assert.equal(v.criticalCount, 0);
  assert.equal(v.summaryFa, "هیچ هشداری فعال نیست");
  assert.equal(v.topSeverity, null);
});

test("اضافه‌پرداخت هشدار بحرانی می‌دهد با اقدام", () => {
  const v = evaluateAlerts({ kpis: contractKpis({ ...FULL, gapPct: 18 }) });
  const a = v.fired.find((f) => f.code === "EWS-01");
  assert.ok(a, "EWS-01 باید فعال شود");
  assert.equal(a.severity, "critical");
  assert.equal(a.severityFa, ALERT_SEVERITY_FA.critical);
  assert.ok(a.actionFa.includes("تطبیق متره"));
  assert.equal(v.criticalCount, 1);
});

test("کارکرد تأییدنشده هشدار جداگانه دارد", () => {
  const v = evaluateAlerts({ kpis: contractKpis({ ...FULL, gapPct: -22 }) });
  assert.ok(v.fired.some((f) => f.code === "EWS-02"));
  assert.ok(!v.fired.some((f) => f.code === "EWS-01"), "جهت مخالف نباید هر دو را روشن کند");
});

test("بحرانی‌ها اول فهرست می‌آیند", () => {
  const v = evaluateAlerts({
    kpis: contractKpis({ ...FULL, avgIpcCycleDays: 70, ceilingUsedPct: 95 }),
  });
  assert.equal(v.fired[0].severity, "critical");
  assert.equal(v.topSeverity, "critical");
  assert.equal(v.warningCount, 1);
});

test("سنجهٔ بی‌داده، قاعده را کنار می‌گذارد نه رد", () => {
  const v = evaluateAlerts({ kpis: contractKpis({ physicalPct: 10 }) });
  assert.equal(v.fired.length, 0);
  assert.ok(v.skipped.length >= 6, "قواعد بی‌داده باید گزارش شوند");
  assert.ok(v.summaryFa.includes("سنجیده نشد"), "سکوت نباید با سلامت اشتباه شود");
  assert.ok(v.skipped[0].reasonFa.includes("محاسبه‌پذیر نیست"));
});

test("آستانهٔ سفارشی جای پیش‌فرض می‌نشیند", () => {
  const kpis = contractKpis({ ...FULL, gapPct: 12 });
  assert.ok(evaluateAlerts({ kpis }).fired.some((f) => f.code === "EWS-01"));

  const relaxed = evaluateAlerts({
    kpis,
    overrides: [{ RuleCode: "EWS-01", ThresholdValue: 20 }],
  });
  assert.ok(!relaxed.fired.some((f) => f.code === "EWS-01"), "آستانهٔ بازتر، هشدار را خاموش می‌کند");
});

test("قاعدهٔ خاموش‌شده اصلاً سنجیده نمی‌شود", () => {
  const kpis = contractKpis({ ...FULL, gapPct: 40 });
  const v = evaluateAlerts({
    kpis,
    overrides: [{ RuleCode: "EWS-01", IsEnabled: false }],
  });
  assert.ok(!v.fired.some((f) => f.code === "EWS-01"));
  assert.ok(!v.skipped.some((s) => s.code === "EWS-01"), "خاموشی آگاهانه، «نبود داده» نیست");
});

test("شدت سفارشی هم اعمال می‌شود", () => {
  const v = evaluateAlerts({
    kpis: contractKpis({ ...FULL, avgIpcCycleDays: 60 }),
    overrides: [{ RuleCode: "EWS-05", Severity: "critical" }],
  });
  assert.equal(v.fired.find((f) => f.code === "EWS-05").severity, "critical");
});

test("ضمانت‌نامهٔ رو به انقضا با یک عدد هم بحرانی است", () => {
  const v = evaluateAlerts({ kpis: contractKpis({ ...FULL, expiringGuaranteeCount: 1 }) });
  const a = v.fired.find((f) => f.code === "EWS-07");
  assert.equal(a.severity, "critical");
  assert.ok(a.actionFa.includes("پوشش از بین"));
});

/* ══════════════ ۶) نمرهٔ سلامت ══════════════ */

test("پیمان سالم نمرهٔ بالا می‌گیرد", () => {
  const h = contractHealth({ kpis: contractKpis(FULL) });
  assert.ok(h.score > 75, `نمره ${h.score}`);
  assert.equal(h.band, "good");
  assert.equal(h.bandFa, HEALTH_BAND_FA.good);
});

test("پوشش ناکافی نمره نمی‌دهد", () => {
  const h = contractHealth({ kpis: contractKpis({ physicalPct: 50, gapPct: 2 }) });
  assert.equal(h.score, null, "نمره از یک‌سوم داده، دقتی را ادعا می‌کند که ندارد");
  assert.equal(h.band, "unknown");
  assert.ok(h.messageFa.includes("پوشش"));
});

test("اضافه‌پرداخت بیش از کم‌پرداخت جریمه می‌شود", () => {
  const over = contractHealth({ kpis: contractKpis({ ...FULL, gapPct: 10 }) });
  const under = contractHealth({ kpis: contractKpis({ ...FULL, gapPct: -10 }) });
  assert.ok(over.score < under.score, "پول رفته سخت‌تر برمی‌گردد تا کار تأییدنشده");
});

test("سهم هر سنجه در نمره گزارش می‌شود", () => {
  const h = contractHealth({ kpis: contractKpis({ ...FULL, avgIpcCycleDays: 90 }) });
  const cycle = h.contributions.find((c) => c.code === "avg_ipc_cycle_days");
  assert.ok(cycle.normalized === 0, "۹۰ روز = صفر");
  assert.ok(cycle.penaltyFa, "سنجهٔ ضعیف باید نامش برده شود");
  assert.equal(h.contributions[0].code, "avg_ipc_cycle_days", "ضعیف‌ترین اول");
});

test("نمره بر وزن پوشش‌داده‌شده نرمال می‌شود", () => {
  /* نبود پیش‌پرداخت نباید نمره را پایین بکشد. */
  const withAdvance = contractHealth({ kpis: contractKpis(FULL) });
  const without = contractHealth({ kpis: contractKpis({ ...FULL, advanceRecoveredPct: null }) });
  assert.ok(without.score >= withAdvance.score - 1, "نداشتن داده با بد بودن یکی نیست");
  assert.ok(without.weightCovered < 100);
});

test("پیمان بیمار نمرهٔ پایین و باند بحرانی می‌گیرد", () => {
  const h = contractHealth({
    kpis: contractKpis({
      ...FULL, gapPct: 20, ceilingUsedPct: 98, extraWorkRatioPct: 30,
      avgIpcCycleDays: 85, advanceRecoveredPct: 5, expiringGuaranteeCount: 3,
    }),
  });
  assert.ok(h.score < 50, `نمره ${h.score}`);
  assert.equal(h.band, "poor");
});

test("مصرف سقف تا ۷۵٪ جریمه ندارد", () => {
  const a = contractHealth({ kpis: contractKpis({ ...FULL, ceilingUsedPct: 70 }) });
  const b = contractHealth({ kpis: contractKpis({ ...FULL, ceilingUsedPct: 75 }) });
  assert.equal(
    a.contributions.find((c) => c.code === "ceiling_used_pct").normalized,
    b.contributions.find((c) => c.code === "ceiling_used_pct").normalized,
  );
});

/* ══════════════ ۷) روند ══════════════ */

const SNAP = (p, over = {}) => ({
  PeriodCode: p, PhysicalPct: 40, FinancialPct: 42, VariancePct: 2,
  CeilingUsedPct: 40, AdvanceRecoveredPct: 50, ExtraWorkRatioPct: 5,
  AvgIpcCycleDays: 25, ...over,
});

test("یک دوره روند نمی‌سازد", () => {
  const t = kpiTrend({ snapshots: [SNAP("1405-01")] });
  assert.deepEqual(t.trends, []);
  assert.ok(t.summaryFa.includes("یک دوره"));
});

test("بدون دوره هم خطا نمی‌دهد", () => {
  const t = kpiTrend({ snapshots: [] });
  assert.deepEqual(t.periods, []);
  assert.ok(t.summaryFa.includes("هیچ عکس"));
});

test("جهت بهبود به نوع سنجه بستگی دارد، نه علامت عدد", () => {
  const t = kpiTrend({
    snapshots: [
      SNAP("1405-01", { AvgIpcCycleDays: 40, PhysicalPct: 40 }),
      SNAP("1405-02", { AvgIpcCycleDays: 25, PhysicalPct: 30 }),
    ],
  });
  const cycle = t.trends.find((x) => x.code === "avg_ipc_cycle_days");
  const phys = t.trends.find((x) => x.code === "physical_pct");
  assert.equal(cycle.direction, "improving", "کاهش چرخه بهبود است");
  assert.equal(phys.direction, "worsening", "کاهش پیشرفت فاجعه است");
  assert.equal(cycle.directionFa, TREND_FA.improving);
});

test("تغییر کوچک‌تر از نویز، روند نیست", () => {
  const t = kpiTrend({
    snapshots: [SNAP("1405-01", { PhysicalPct: 40 }), SNAP("1405-02", { PhysicalPct: 41 })],
  });
  const phys = t.trends.find((x) => x.code === "physical_pct");
  assert.equal(phys.direction, "flat");
  assert.equal(phys.isSignificant, false);
});

test("هشدار نوظهور: هنوز رد نشده ولی دارد می‌رود", () => {
  const t = kpiTrend({
    snapshots: [
      SNAP("1405-01", { CeilingUsedPct: 78 }),
      SNAP("1405-02", { CeilingUsedPct: 88 }),
    ],
  });
  assert.ok(t.emergingFa.some((e) => e.includes("سقف")), t.emergingFa.join(" | "));
  assert.ok(t.summaryFa.includes("در مسیر عبور"));
});

test("سنجه‌ای که از قبل هشدار داده، نوظهور نیست", () => {
  const t = kpiTrend({
    snapshots: [
      SNAP("1405-01", { CeilingUsedPct: 92 }),
      SNAP("1405-02", { CeilingUsedPct: 96 }),
    ],
  });
  assert.equal(t.emergingFa.length, 0, "هشدار فعلی، «نوظهور» نیست");
});

test("سنجهٔ رو به بهبود هرگز نوظهور نمی‌شود", () => {
  const t = kpiTrend({
    snapshots: [
      SNAP("1405-01", { CeilingUsedPct: 88 }),
      SNAP("1405-02", { CeilingUsedPct: 80 }),
    ],
  });
  assert.equal(t.emergingFa.length, 0);
  assert.ok(t.improving.some((x) => x.code === "ceiling_used_pct"));
});

test("دوره‌ها مرتب می‌شوند، نه به ترتیب ورود", () => {
  const t = kpiTrend({
    snapshots: [SNAP("1405-03", { PhysicalPct: 60 }), SNAP("1405-01", { PhysicalPct: 20 })],
  });
  assert.deepEqual(t.periods, ["1405-01", "1405-03"]);
  assert.equal(t.trends.find((x) => x.code === "physical_pct").current, 60);
});

test("ستون خالی، روند نامعلوم می‌دهد نه صفر", () => {
  const t = kpiTrend({
    snapshots: [
      SNAP("1405-01", { AdvanceRecoveredPct: null }),
      SNAP("1405-02", { AdvanceRecoveredPct: null }),
    ],
  });
  const adv = t.trends.find((x) => x.code === "advance_recovered_pct");
  assert.equal(adv.direction, "unknown");
  assert.equal(adv.delta, null);
});

/* ══════════════ ۸) تابلوی یکجا ══════════════ */

test("تیتر، بحرانی را بر نمره مقدم می‌دارد", () => {
  const s = contractScorecard({ kpis: contractKpis({ ...FULL, gapPct: 25 }) });
  assert.ok(s.headlineFa.includes("بحرانی"));
  assert.ok(s.alerts.criticalCount >= 1);
});

test("بدون هشدار، تیتر نمره را می‌گوید", () => {
  const s = contractScorecard({ kpis: contractKpis(FULL) });
  assert.ok(s.headlineFa.includes("نمرهٔ سلامت"));
});

test("هشدار نوظهور بر هشدار غیربحرانی مقدم است", () => {
  const s = contractScorecard({
    kpis: contractKpis({ ...FULL, avgIpcCycleDays: 50, ceilingUsedPct: 85 }),
    snapshots: [
      SNAP("1405-01", { CeilingUsedPct: 78 }),
      SNAP("1405-02", { CeilingUsedPct: 85 }),
    ],
  });
  assert.ok(s.trend.emergingFa.length > 0);
  assert.equal(s.headlineFa, s.trend.emergingFa[0], "پیش‌بینی مهم‌تر از گزارش است");
});

test("تابلو همهٔ اجزا را برمی‌گرداند", () => {
  const s = contractScorecard({
    contractId: "c1", periodCode: "1405-06",
    kpis: contractKpis(FULL),
    snapshots: [SNAP("1405-05"), SNAP("1405-06")],
  });
  assert.equal(s.contractId, "c1");
  assert.equal(s.periodCode, "1405-06");
  assert.ok(s.kpis.values.length === 10);
  assert.ok(s.health.score != null);
  assert.ok(Array.isArray(s.alerts.fired));
  assert.ok(s.trend.periods.length === 2);
});

test("پیمان بی‌داده، تابلوی صادق می‌دهد", () => {
  const s = contractScorecard({ kpis: contractKpis({}) });
  assert.equal(s.health.score, null);
  assert.equal(s.alerts.fired.length, 0);
  assert.ok(s.alerts.skipped.length > 0);
  assert.ok(s.headlineFa.includes("پوشش") || s.headlineFa.includes("سنجیده نشد"));
});
