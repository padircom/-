import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activityPhysicalPct,
  applyApproval,
  canDprTransition,
  detectConflicts,
  missingDpr,
  openDprBlocked,
  rollupApprovedQty,
  stepPercent,
  validateDpr,
  validateDprLine,
} from "./pexDprLogic.js";

const CTX = {
  activities: {
    "CIV-001": { locked: true, steps: [{ seq: 3, targetQty: 45 }, { seq: 5, targetQty: 420 }] },
    "ELE-CBL-04": { locked: false, steps: [{ seq: 2, targetQty: 1800 }] },
  },
};

test("submit: draft→submitted برای site_engineer مجاز", () => {
  const r = canDprTransition("draft", "submit", "site_engineer");
  assert.equal(r.ok, true);
  assert.equal(r.to, "submitted");
});

test("submit: از approved نامعتبر (409)", () => {
  const r = canDprTransition("approved", "submit", "site_engineer");
  assert.equal(r.ok, false);
  assert.equal(r.code, "INVALID_TRANSITION");
});

test("approve: فقط reviewer از submitted", () => {
  assert.equal(canDprTransition("submitted", "approve", "consultant").ok, true);
  const bad = canDprTransition("submitted", "approve", "site_engineer");
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "ROLE_NOT_ALLOWED");
});

test("revise/reject: به assignee درست برمی‌گردد", () => {
  assert.equal(canDprTransition("submitted", "revise", "consultant").to, "revision_required");
  assert.equal(canDprTransition("submitted", "reject", "client").to, "rejected");
  assert.equal(canDprTransition("rejected", "submit", "site_engineer").to, "submitted");
});

test("validateDpr: خطای تاریخ/شیفت/خط خالی", () => {
  assert.ok(validateDpr({ reportDate: "bad", shift: "A", lines: [{ activityCode: "ELE-CBL-04", stepSeq: 2, qty: 1 }] }, CTX).includes("DATE_INVALID"));
  assert.ok(validateDpr({ reportDate: "2026-09-04", shift: "Z", lines: [{ activityCode: "ELE-CBL-04", stepSeq: 2, qty: 1 }] }, CTX).includes("SHIFT_INVALID"));
  assert.ok(validateDpr({ reportDate: "2026-09-04", shift: "A", lines: [] }, CTX).includes("LINES_REQUIRED"));
});

test("validateDprLine: فعالیت نامشخص و گام نامعتبر", () => {
  assert.ok(validateDprLine({ activityCode: "NOPE", stepSeq: 1, qty: 5 }, CTX).includes("ACTIVITY_UNKNOWN"));
  assert.ok(validateDprLine({ activityCode: "ELE-CBL-04", stepSeq: 9, qty: 5 }, CTX).includes("STEP_UNKNOWN"));
  assert.ok(validateDprLine({ activityCode: "ELE-CBL-04", stepSeq: 2, qty: 0 }, CTX).includes("QTY_POSITIVE"));
});

test("validateDprLine: فعالیت قفل بدون CR خطا می‌دهد", () => {
  const errs = validateDprLine({ activityCode: "CIV-001", stepSeq: 3, qty: 2 }, CTX);
  assert.ok(errs.includes("LOCKED_NEEDS_CR"));
  const withCr = validateDprLine({ activityCode: "CIV-001", stepSeq: 3, qty: 2, crId: "CR-7" }, CTX);
  assert.ok(!withCr.includes("LOCKED_NEEDS_CR"));
});

test("rollup: فقط خطوط approved جمع می‌شوند", () => {
  const out = rollupApprovedQty([
    { activityCode: "CIV-001", stepSeq: 3, qty: 2, approvedQty: 2, lineStatus: "approved" },
    { activityCode: "CIV-001", stepSeq: 3, qty: 9, lineStatus: "draft" },
  ]);
  assert.equal(out["CIV-001#3"], 2);
});

test("stepPercent/activityPhysicalPct: میانگین وزنی با سقف ۱", () => {
  assert.equal(stepPercent(310, 500), 0.62);
  assert.equal(stepPercent(999, 0), 0);
  const pct = activityPhysicalPct([
    { weight: 0.22, approvedQty: 27.9, targetQty: 45 },
    { weight: 0.3, approvedQty: 420, targetQty: 420 },
    { weight: 0.48, approvedQty: 0, targetQty: 100 },
  ]);
  assert.equal(pct, 0.4364); // 0.22*0.62 + 0.3*1
});

test("applyApproval: ورودی جهش نمی‌کند و pct فعالیت را می‌دهد", () => {
  const rows = [{ activityCode: "CIV-001", stepSeq: 3, weight: 0.22, targetQty: 45, approvedQty: 27.9 }];
  const lines = [{ activityCode: "CIV-001", stepSeq: 3, qty: 2, approvedQty: 2, lineStatus: "approved" }];
  const { rows: next, pctByActivity } = applyApproval(lines, rows);
  assert.equal(rows[0].approvedQty, 27.9);
  assert.equal(next[0].approvedQty, 29.9);
  assert.equal(pctByActivity["CIV-001"], +(0.22 * (29.9 / 45)).toFixed(4));
});

test("detectConflicts: دو مقدار متفاوت برای یک کلید", () => {
  const out = detectConflicts([
    { activityCode: "CIV-001", reportDate: "2026-09-04", stepSeq: 3, qty: 2, dprId: 1 },
    { activityCode: "CIV-001", reportDate: "2026-09-04", stepSeq: 3, qty: 4, dprId: 2 },
    { activityCode: "CIV-001", reportDate: "2026-09-04", stepSeq: 5, qty: 1, dprId: 1 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].activityCode, "CIV-001");
  assert.equal(out[0].lines.length, 2);
});

test("missingDpr: بیش از ۲۴ ساعت بدون DPR", () => {
  assert.equal(missingDpr("2026-09-04", "2026-09-06"), true);
  assert.equal(missingDpr("2026-09-05", "2026-09-06"), false);
  assert.equal(missingDpr(null, "2026-09-06"), true);
});

test("openDprBlocked: فقط یک DPR باز در هر شیفت", () => {
  const existing = [{ reportDate: "2026-09-04", shift: "A", status: "submitted" }];
  assert.equal(openDprBlocked(existing, "2026-09-04", "A"), true);
  assert.equal(openDprBlocked(existing, "2026-09-04", "B"), false);
  assert.equal(openDprBlocked([{ reportDate: "2026-09-04", shift: "A", status: "approved" }], "2026-09-04", "A"), false);
});

test("validateDpr: نمونه معتبر OpenAPI بدون خطا", () => {
  const errs = validateDpr(
    { reportDate: "2026-09-04", shift: "A", lines: [{ activityCode: "ELE-CBL-04", stepSeq: 2, qty: 120 }] },
    CTX
  );
  assert.deepEqual(errs, []);
});
