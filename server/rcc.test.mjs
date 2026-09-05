import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyGuardian,
  ccbEscalate,
  daysLeft,
  depletionAlert,
  guardianTick,
  impactReady,
  quantumDays,
} from "./rccLogic.js";

const d = (iso) => new Date(iso + "T00:00:00Z");

test("overdue notice is time-barred (G5 false-negative)", () => {
  const now = d("2026-09-05");
  const notices = [{ id: "n3", dueAt: "2026-09-04" }];
  const ev = guardianTick(notices, now);
  assert.equal(ev[0].action, "mark_time_barred");
  assert.equal(ev[0].ews, "EWS-CLM-05");
  const applied = applyGuardian(notices, now);
  assert.equal(applied.notices[0].timeBarred, true);
});

test("due yesterday vs today daysLeft negative", () => {
  assert.ok(daysLeft("2026-09-04", d("2026-09-05")) < 0);
});

test("3-day window is EWS-CLM-01", () => {
  const ev = guardianTick([{ id: "n2", dueAt: "2026-09-07" }], d("2026-09-05"));
  assert.equal(ev[0].ews, "EWS-CLM-01");
});

test("delivered notice skipped", () => {
  const ev = guardianTick([{ id: "n", dueAt: "2026-09-01", deliveredAt: "2026-08-30" }], d("2026-09-05"));
  assert.equal(ev.length, 0);
});

test("depletion > progress + 10", () => {
  assert.equal(depletionAlert(20, 100, 50), true);
  assert.equal(depletionAlert(50, 100, 50), false);
});

test("PM must escalate 180k / 12d", () => {
  assert.equal(ccbEscalate("PM", 180000, 12, false), true);
  assert.equal(ccbEscalate("Sponsor", 180000, 12, true), false);
});

test("quantum TF=0 * 12", () => {
  assert.equal(quantumDays(3), 36);
});

test("12 impact dims required", () => {
  const flags = Object.fromEntries(
    ["Scope", "Schedule", "Cost", "Quality", "Risk", "Resource", "HSE", "Contract", "Interface", "Commissioning", "Stakeholder", "Environment"].map((k) => [k, true])
  );
  assert.equal(impactReady(flags), true);
  flags.Scope = false;
  assert.equal(impactReady(flags), false);
});
