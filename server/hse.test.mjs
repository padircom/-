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
} from "./hseLogic.js";

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
