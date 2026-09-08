import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendTrail,
  auditCloseBlocked,
  authorityFor,
  canGovWrite,
  capaRequired,
  complianceBand,
  complianceScore,
  connectorHealth,
  decisionGate,
  escalationLevel,
  needsEscalation,
  slaLevel,
  verifyTrail,
  workflowTick,
} from "./govLogic.js";

const d = (iso) => new Date(iso + "T00:00:00Z");

test("SLA: overdue step escalates", () => {
  const ev = workflowTick([{ id: "t1", code: "WF-1", dueAt: "2026-09-04" }], d("2026-09-08"));
  assert.equal(ev[0].level, "breach");
  assert.equal(ev[0].action, "escalate");
  assert.equal(ev[0].escalation, "L2"); // ۴ روز تأخیر → سطح PMO
});

test("SLA: due tomorrow only notifies", () => {
  const ev = workflowTick([{ id: "t2", code: "WF-2", dueAt: "2026-09-09" }], d("2026-09-08"));
  assert.equal(ev[0].level, "due_soon");
  assert.equal(ev[0].action, "notify");
});

test("SLA: closed task is skipped", () => {
  const ev = workflowTick([{ id: "t3", dueAt: "2026-01-01", closedAt: "2026-01-01" }], d("2026-09-08"));
  assert.equal(ev.length, 0);
});

test("escalation ladder L0..L3", () => {
  assert.equal(escalationLevel(0), "L0");
  assert.equal(escalationLevel(3), "L1");
  assert.equal(escalationLevel(7), "L2");
  assert.equal(escalationLevel(30), "L3");
  assert.equal(slaLevel(5), "ok");
});

test("compliance weighted score and band", () => {
  assert.equal(complianceScore([{ id: "a", compliance: 90 }, { id: "b", compliance: 70 }]), 80);
  assert.equal(complianceScore([{ id: "a", compliance: 90, weight: 3 }, { id: "b", compliance: 70, weight: 1 }]), 85);
  assert.equal(complianceBand(92), "Green");
  assert.equal(complianceBand(80), "Yellow");
  assert.equal(complianceBand(60), "Red");
  assert.equal(complianceScore([]), 100);
});

test("major finding without CAPA blocks audit close", () => {
  const findings = [{ id: "f1", compliance: 60 }];
  assert.equal(capaRequired(findings[0]), true);
  assert.equal(auditCloseBlocked(findings), true);
  assert.equal(auditCloseBlocked([{ id: "f1", compliance: 60, capaId: "CAPA-1" }]), false);
  assert.equal(auditCloseBlocked([{ id: "f2", compliance: 95 }]), false);
});

test("DoA picks lowest sufficient authority", () => {
  assert.equal(authorityFor(10_000, 3), "PM");
  assert.equal(authorityFor(10_000, 30), "STEERING"); // زمان سقف PMO را رد می‌کند
  assert.equal(authorityFor(400_000, 10), "STEERING");
  assert.equal(authorityFor(5_000_000, 1), "BOARD");
  assert.equal(needsEscalation("PM", 100_000, 2), true);
  assert.equal(needsEscalation("PMO", 100_000, 2), false);
});

test("decision gate: evidence + authority + baseline rule", () => {
  assert.deepEqual(decisionGate({ id: "d1" }).reasons.sort(), ["authority_missing", "evidence_missing"]);
  assert.equal(decisionGate({ id: "d2", evidenceRef: "PMA:EVM#1", authority: "PM", cost: 10_000, days: 2 }).ok, true);
  assert.equal(
    decisionGate({ id: "d3", evidenceRef: "PMA:EVM#1", authority: "PM", cost: 900_000, days: 2 }).reasons[0],
    "authority_insufficient"
  );
  assert.equal(
    decisionGate({ id: "d4", evidenceRef: "PEX:BL#3", authority: "PMO", rewritesBaseline: true }).reasons[0],
    "baseline_rewrite_without_cr"
  );
  assert.equal(
    decisionGate({ id: "d5", evidenceRef: "PEX:BL#3", authority: "PMO", rewritesBaseline: true, crId: "CR-9" }).ok,
    true
  );
});

test("connector health degrades with sync age", () => {
  const now = new Date("2026-09-08T12:00:00Z");
  assert.equal(connectorHealth("2026-09-08 06:00", 24, now), "ok");
  assert.equal(connectorHealth("2026-09-07 06:00", 24, now), "warn");
  assert.equal(connectorHealth("2026-09-01 06:00", 24, now), "fail");
});

test("governance never owns other modules figures", () => {
  assert.equal(canGovWrite("evm"), false);
  assert.equal(canGovWrite("baseline"), false);
  assert.equal(canGovWrite("decision_note"), true);
});

test("audit trail is tamper evident", () => {
  let trail = [];
  trail = appendTrail(trail, "APPROVE:WF-1");
  trail = appendTrail(trail, "APPROVE:WF-2");
  assert.equal(verifyTrail(trail), true);
  const tampered = trail.map((e, i) => (i === 0 ? { ...e, payload: "APPROVE:WF-X" } : e));
  assert.equal(verifyTrail(tampered), false);
});
