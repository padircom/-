import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actionEscalation,
  actionSla,
  hseScore,
  inspectionBand,
  inspectionScore,
  isLostTime,
  isRecordable,
  ltifr,
  ptwCanTransition,
  ptwMissing,
  recycleRate,
  severityWeight,
  spillTier,
  tbtCompliance,
  trir,
} from "./hseFieldLogic.js";

const INC = [
  { type: "near_miss" },
  { type: "first_aid" },
  { type: "medical" },
  { type: "lost_time" },
];

test("recordable: فقط medical به بالا", () => {
  assert.equal(isRecordable("near_miss"), false);
  assert.equal(isRecordable("first_aid"), false);
  assert.equal(isRecordable("medical"), true);
  assert.equal(isRecordable("fatality"), true);
  assert.equal(isLostTime("medical"), false);
  assert.equal(isLostTime("lost_time"), true);
});

test("TRIR/LTIFR با ضریب ۲۰۰٬۰۰۰", () => {
  assert.equal(trir(INC, 200000), 2); // medical + lost_time
  assert.equal(ltifr(INC, 200000), 1);
  assert.equal(trir(INC, 0), 0);
  assert.equal(trir([], 200000), 0);
});

test("وزن شدت صعودی است", () => {
  assert.ok(severityWeight("fatality") > severityWeight("lost_time"));
  assert.ok(severityWeight("lost_time") > severityWeight("medical"));
  assert.ok(severityWeight("medical") > severityWeight("first_aid"));
  assert.ok(severityWeight("first_aid") > severityWeight("near_miss"));
});

test("PTW: چرخه کامل draft تا closed", () => {
  assert.equal(ptwCanTransition("draft", "request", "requester").to, "requested");
  assert.equal(ptwCanTransition("requested", "approve", "area_authority").to, "approved");
  assert.equal(ptwCanTransition("approved", "activate", "performing_authority").to, "active");
  assert.equal(ptwCanTransition("active", "close", "hse_officer").to, "closed");
});

test("PTW: نقش اشتباه و گذار نامعتبر", () => {
  assert.equal(ptwCanTransition("requested", "approve", "requester").code, "ROLE_NOT_ALLOWED");
  assert.equal(ptwCanTransition("draft", "activate", "performing_authority").code, "INVALID_TRANSITION");
  assert.equal(ptwCanTransition("active", "bogus", "admin").code, "INVALID_ACTION");
});

test("PTW: تعلیق و بازگشت", () => {
  assert.equal(ptwCanTransition("active", "suspend", "hse_officer").to, "suspended");
  assert.equal(ptwCanTransition("suspended", "resume", "area_authority").to, "active");
  assert.equal(ptwCanTransition("suspended", "close", "performing_authority").to, "closed");
});

test("PTW: پیش‌شرط نوع‌کار", () => {
  assert.deepEqual(ptwMissing("cold", {}), []);
  assert.deepEqual(ptwMissing("hot", { gasTest: true }), ["barricade"]);
  assert.deepEqual(ptwMissing("confined", {}), ["gasTest", "rescuePlan"]);
  assert.deepEqual(ptwMissing("electrical", { isolation: true }), []);
});

test("بازرسی: امتیاز و باند (N/A حذف می‌شود)", () => {
  assert.equal(inspectionScore([{ ok: true }, { ok: false }, { ok: true, na: true }]), 50);
  assert.equal(inspectionScore([]), 0);
  assert.equal(inspectionBand(92), "A");
  assert.equal(inspectionBand(80), "B");
  assert.equal(inspectionBand(60), "C");
  assert.equal(inspectionBand(59), "D");
});

test("اقدام: SLA سه‌حالته", () => {
  assert.equal(actionSla({ dueISO: "2026-09-04", closedAt: "2026-09-03" }, "2026-09-08"), "closed");
  assert.equal(actionSla({ dueISO: "2026-09-04", closedAt: null }, "2026-09-08"), "overdue");
  assert.equal(actionSla({ dueISO: "2026-09-10", closedAt: null }, "2026-09-08"), "due_soon");
  assert.equal(actionSla({ dueISO: "2026-09-20", closedAt: null }, "2026-09-08"), "ok");
});

test("اقدام: تشدید تا L3 برای critical معوق", () => {
  const now = "2026-09-08";
  assert.equal(actionEscalation({ dueISO: "2026-08-28", closedAt: null, severity: "critical" }, now), "L3");
  assert.equal(actionEscalation({ dueISO: "2026-09-01", closedAt: null, severity: "high" }, now), "L2");
  assert.equal(actionEscalation({ dueISO: "2026-09-07", closedAt: null, severity: "low" }, now), "L1");
  assert.equal(actionEscalation({ dueISO: "2026-09-20", closedAt: null, severity: "low" }, now), "L0");
});

test("TBT و پسماند در بازه ۰..۱", () => {
  assert.equal(tbtCompliance(24, 21), 0.875);
  assert.equal(tbtCompliance(0, 5), 0);
  assert.equal(recycleRate(1840, 5200), 0.354);
  assert.equal(recycleRate(10, 0), 0);
});

test("رده نشت T1..T3", () => {
  assert.equal(spillTier(12), "T1");
  assert.equal(spillTier(20), "T2");
  assert.equal(spillTier(250), "T3");
});

test("امتیاز HSE: TRIR صفر سبز کامل نیست مگر بقیه کامل", () => {
  const full = hseScore({ trir: 0, ptwCompliance: 1, inspectionAvg: 100, actionClosure: 1 });
  assert.deepEqual(full, { total: 100, band: "Green" });
  const bad = hseScore({ trir: 4, ptwCompliance: 0.5, inspectionAvg: 60, actionClosure: 0.4 });
  assert.equal(bad.band, "Red"); // 0 + 12.5 + 12 + 8 = 32.5 → 33
  assert.equal(bad.total, 33);
});

test("امتیاز HSE: میانه زرد", () => {
  const mid = hseScore({ trir: 1, ptwCompliance: 0.8, inspectionAvg: 78, actionClosure: 0.6 });
  assert.equal(mid.band, "Yellow"); // 26.25 + 20 + 15.6 + 12 = 73.85 → 74
  assert.equal(mid.total, 74);
});

// ── D3: ثبت و گیت ──
import {
  nextInspectionDue,
  validateIncident,
  validateInspection,
  validatePermit,
  woPermitGate,
} from "./hseFieldLogic.js";

test("D3 validateIncident: نمونه معتبر بدون خطا", () => {
  assert.deepEqual(
    validateIncident({ dateISO: "2026-09-08", type: "medical", lostDays: 0, area: "FND", descFa: "تست", status: "open" }),
    []
  );
  assert.deepEqual(
    validateIncident({ dateISO: "2026-09-08", type: "spill", area: "Laydown", descFa: "نشت", volumeL: 12 }),
    []
  );
});

test("D3 validateIncident: خطاها", () => {
  const e = validateIncident({ dateISO: "bad", type: "alien", lostDays: -1, area: "", descFa: "" });
  for (const c of ["DATE_INVALID", "TYPE_UNKNOWN", "LOSTDAYS_INVALID", "AREA_REQUIRED", "DESC_REQUIRED"]) {
    assert.ok(e.includes(c), c);
  }
  assert.ok(validateIncident({ dateISO: "2026-09-08", type: "spill", area: "A", descFa: "x" }).includes("VOLUME_REQUIRED"));
  assert.ok(validateIncident({ dateISO: "2026-09-08", type: "medical", area: "A", descFa: "x", status: "weird" }).includes("STATUS_UNKNOWN"));
});

test("D3 validatePermit: معتبر و نامعتبر", () => {
  assert.deepEqual(
    validatePermit({ type: "hot", workDate: "2026-09-09", area: "Yard", riskLevel: "high" }),
    []
  );
  const e = validatePermit({ type: "steam", workDate: "09-09", area: "", riskLevel: "extreme" });
  for (const c of ["TYPE_UNKNOWN", "DATE_INVALID", "AREA_REQUIRED", "RISK_UNKNOWN"]) {
    assert.ok(e.includes(c), c);
  }
});

test("D3 validateInspection: معتبر و نامعتبر", () => {
  assert.deepEqual(
    validateInspection({ area: "Yard", dateISO: "2026-09-08", items: [{ item: "کپسول", ok: true }] }),
    []
  );
  assert.ok(validateInspection({ area: "Yard", dateISO: "2026-09-08", items: [] }).includes("ITEMS_REQUIRED"));
  const e = validateInspection({ area: "", dateISO: "bad", items: [{ ok: true }] });
  assert.ok(e.includes("AREA_REQUIRED") && e.includes("DATE_INVALID") && e.includes("I1:ITEM_TEXT_REQUIRED"));
});

test("D3 gate: کار سرد/عمومی نیاز به PTW ندارد", () => {
  assert.equal(woPermitGate({ workType: "cold", workDate: "2026-09-09" }, []).verdict, "allow");
  assert.equal(woPermitGate({ workType: "general", workDate: "2026-09-09" }, []).reason, "NO_PERMIT_NEEDED");
});

test("D3 gate: PTW فعالِ هم‌نوع/هم‌روز/هم‌ناحیه allow", () => {
  const r = woPermitGate(
    { workType: "hot", area: "Yard", workDate: "2026-09-09" },
    [{ no: "PTW-1", type: "hot", status: "active", workDate: "2026-09-09", area: "Yard" }]
  );
  assert.equal(r.verdict, "allow");
  assert.equal(r.permitNo, "PTW-1");
});

test("D3 gate: بدون PTW فعال — warn در advisory و block در hard", () => {
  const permits = [{ no: "PTW-9", type: "hot", status: "approved", workDate: "2026-09-09", area: "Yard" }];
  const soft = woPermitGate({ workType: "hot", workDate: "2026-09-09" }, permits, "advisory");
  assert.equal(soft.verdict, "warn");
  assert.equal(soft.ok, true);
  assert.deepEqual(soft.pending, ["PTW-9"]);
  const hard = woPermitGate({ workType: "hot", workDate: "2026-09-09" }, permits, "hard");
  assert.equal(hard.verdict, "block");
  assert.equal(hard.ok, false);
});

test("D3 gate: ناهماهنگی ناحیه/تاریخ/وضعیت یعنی تطبیق نیست", () => {
  const permits = [
    { no: "PTW-A", type: "hot", status: "active", workDate: "2026-09-09", area: "Tank" },
    { no: "PTW-B", type: "hot", status: "closed", workDate: "2026-09-09", area: "Yard" },
    { no: "PTW-C", type: "hot", status: "active", workDate: "2026-09-08", area: "Yard" },
  ];
  const r = woPermitGate({ workType: "hot", area: "Yard", workDate: "2026-09-09" }, permits);
  assert.equal(r.verdict, "warn");
  assert.equal(r.permitNo, undefined);
});

test("D3 nextInspectionDue: قاعده باند", () => {
  assert.equal(nextInspectionDue("2026-09-04", "B"), "2026-10-04");
  assert.equal(nextInspectionDue("2026-09-06", "D"), "2026-09-13");
  assert.equal(nextInspectionDue("2026-09-05", "A"), "2026-12-04");
  assert.equal(nextInspectionDue("2026-09-05", "C"), "2026-09-19");
});
