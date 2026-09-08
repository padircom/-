import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QMS_FORMULA_VERSION,
  canProceed,
  capaRequired,
  certificationRisk,
  complianceScore,
  concreteAcceptance,
  controlLimits,
  costOfQuality,
  dossierCompleteness,
  dpmo,
  dispositionAllowed,
  firstPassYield,
  irNoticeCheck,
  irOutcome,
  itpBlocking,
  itpCoverage,
  mechanicalCompletionGate,
  ncrAgeDays,
  ncrClosureRate,
  ncrDueDays,
  ncrOverdue,
  ncrSeverity,
  outOfControl,
  pareto,
  punchSummary,
  qmsEws,
  samplingPlan,
  sigmaLevel,
  signRecord,
  traceChain,
  verifyCertificate,
  verifySignature,
  weldRepairRate,
} from "./qmsLogic.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const day = (iso) => new Date(iso + "T00:00:00Z");

/* ── ITP ── */
test("ITP: فقط نقطه توقف امضانشده کار را متوقف می‌کند", () => {
  const pts = [
    { id: "H-1", activityId: "A1", type: "H", party: "consultant" },
    { id: "W-1", activityId: "A1", type: "W", party: "client" },
    { id: "H-2", activityId: "A2", type: "H", party: "tpi", signedAt: "2026-09-01" },
    { id: "H-3", activityId: "A3", type: "H", party: "tpi", waivedBy: "QA Manager" },
  ];
  assert.deepEqual(itpBlocking(pts).map((p) => p.id), ["H-1"]);
  const g = canProceed(pts);
  assert.equal(g.ok, false);
  assert.deepEqual(g.blockedBy, ["H-1"]);
  assert.equal(canProceed(pts.filter((p) => p.id !== "H-1")).ok, true);
});

test("پوشش ITP روی فعالیت‌ها", () => {
  const pts = [{ id: "H-1", activityId: "A1", type: "H", party: "client" }];
  near(itpCoverage(["A1", "A2", "A3", "A4"], pts), 25);
  assert.equal(itpCoverage([], pts), 0);
});

/* ── درخواست بازرسی ── */
test("اعلان بازرسی زیر ۴۸ ساعت رد می‌شود", () => {
  const late = irNoticeCheck({ requestedAt: "2026-09-08T08:00:00Z", inspectionAt: "2026-09-09T08:00:00Z", noticeHours: 48 });
  assert.equal(late.ok, false);
  assert.equal(late.leadHours, 24);
  assert.equal(irNoticeCheck({ requestedAt: "2026-09-05T08:00:00Z", inspectionAt: "2026-09-08T08:00:00Z", noticeHours: 48 }).ok, true);
});

test("نتیجه بازرسی بر پایه شدت ایرادها", () => {
  assert.equal(irOutcome([]), "accepted");
  assert.equal(irOutcome([{ severity: "minor" }]), "conditional");
  assert.equal(irOutcome([{ severity: "major" }, { severity: "major" }, { severity: "major" }]), "rejected");
  assert.equal(irOutcome([{ severity: "critical" }]), "rejected");
  near(firstPassYield(84, 100), 84);
  assert.equal(firstPassYield(1, 0), 0);
});

/* ── NCR و CAPA ── */
test("طبقه‌بندی، مهلت و تأخیر NCR", () => {
  assert.equal(ncrSeverity({ safetyImpact: true, structuralImpact: false, reworkCost: 0, functionalImpact: false }), "critical");
  assert.equal(ncrSeverity({ safetyImpact: false, structuralImpact: false, reworkCost: 900_000_000, functionalImpact: false }), "major");
  assert.equal(ncrSeverity({ safetyImpact: false, structuralImpact: false, reworkCost: 1_000, functionalImpact: false }), "minor");
  assert.equal(ncrDueDays("critical"), 7);
  const n = { id: "NCR-1", severity: "critical", openedAt: "2026-09-01" };
  assert.equal(ncrAgeDays(n, day("2026-09-11")), 10);
  assert.equal(ncrOverdue(n, day("2026-09-11")), true);
  assert.equal(ncrOverdue({ ...n, closedAt: "2026-09-03" }, day("2026-09-11")), false);
  near(ncrClosureRate([n, { ...n, id: "n2", closedAt: "2026-09-05" }]), 50);
});

test("تعیین تکلیف use-as-is بدون ارفاق مهندسی ممنوع است", () => {
  assert.equal(dispositionAllowed("use_as_is").ok, false);
  assert.equal(dispositionAllowed("use_as_is").reason, "concession_required");
  assert.equal(dispositionAllowed("repair", "Lead Engineer").ok, true);
  assert.equal(dispositionAllowed("rework").ok, true);
  assert.equal(capaRequired("minor", 3), true);
  assert.equal(capaRequired("critical", 0), true);
  assert.equal(capaRequired("minor", 1), false);
});

test("پارتو علل اصلی را جدا می‌کند", () => {
  const p = pareto([
    { cause: "جوشکاری", count: 50 },
    { cause: "ابعاد", count: 30 },
    { cause: "رنگ", count: 15 },
    { cause: "مستندات", count: 5 },
  ]);
  assert.equal(p[0].cause, "جوشکاری");
  assert.equal(p[0].vital, true);
  assert.equal(p[3].vital, false);
  near(p[3].cumPct, 100);
});

/* ── مواد و آزمون‌ها ── */
test("تأیید گواهی مواد", () => {
  const base = { heatNo: "H-9931", certType: "3.1", issuedAt: "2026-01-10", declaredGrade: "A106-B", requiredGrade: "A106-B", labVerified: true };
  assert.equal(verifyCertificate(base).ok, true);
  assert.deepEqual(verifyCertificate({ ...base, certType: "2.2" }).reasons, ["cert_type_below_requirement"]);
  assert.ok(verifyCertificate({ ...base, declaredGrade: "A53-B" }).reasons.includes("grade_mismatch"));
  assert.ok(verifyCertificate({ ...base, expiresAt: "2026-01-01" }, "3.1", day("2026-09-08")).reasons.includes("certificate_expired"));
  assert.ok(verifyCertificate({ ...base, labVerified: false }).reasons.includes("lab_verification_missing"));
  assert.equal(verifyCertificate(base, "3.2").ok, false);
});

test("زنجیره ردیابی از ذوب تا داکیومنت", () => {
  const chain = traceChain("H-9931", [
    { from: "H-9931", to: "SPOOL-14" },
    { from: "SPOOL-14", to: "WELD-221" },
    { from: "WELD-221", to: "RT-556" },
    { from: "RT-556", to: "DOSSIER-A" },
  ]);
  assert.deepEqual(chain, ["H-9931", "SPOOL-14", "WELD-221", "RT-556", "DOSSIER-A"]);
  assert.deepEqual(traceChain("X", []), ["X"]);
});

test("پذیرش بتن طبق ACI و نرخ تعمیر جوش", () => {
  assert.equal(concreteAcceptance([32, 33, 34, 35], 30).ok, true);
  assert.ok(concreteAcceptance([32, 26, 34], 30).reasons.includes("single_test_below_limit"));
  assert.ok(concreteAcceptance([28, 29, 28.5], 30).reasons.includes("moving_average_below_fc"));
  const w = weldRepairRate(5, 100);
  near(w.ratePct, 5);
  assert.equal(w.welderSuspended, true);
  assert.equal(weldRepairRate(2, 100).welderSuspended, false);
});

test("طرح نمونه‌برداری بر پایه اندازه محموله", () => {
  assert.deepEqual(samplingPlan(10), { sampleSize: 3, accept: 0, reject: 1 });
  assert.deepEqual(samplingPlan(400), { sampleSize: 50, accept: 5, reject: 6 });
  assert.equal(samplingPlan(5).sampleSize, 2);
});

/* ── ممیزی و هزینه کیفیت ── */
test("امتیاز انطباق و ریسک گواهینامه", () => {
  const f = [
    { clause: "8.5.1", severity: "major" },
    { clause: "7.5", severity: "minor" },
    { clause: "9.2", severity: "observation", closed: true },
  ];
  assert.equal(complianceScore(f), 87);
  assert.equal(certificationRisk(f), "watch");
  assert.equal(certificationRisk([...f, { clause: "8.7", severity: "major" }]), "suspension");
  assert.equal(certificationRisk([{ clause: "7.1", severity: "minor" }]), "none");
});

test("هزینه کیفیت و شاخص‌های شش‌سیگما", () => {
  const c = costOfQuality({ prevention: 20, appraisal: 30, internalFailure: 40, externalFailure: 10 }, 1000);
  assert.equal(c.conformance, 50);
  assert.equal(c.nonConformance, 50);
  near(c.copqPct, 5);
  near(c.ratio, 1);
  near(dpmo(12, 1000, 4), 3000);
  assert.equal(dpmo(1, 0, 4), 0);
  const s = sigmaLevel(3000);
  assert.ok(s > 4 && s < 5.5, String(s));
  assert.equal(sigmaLevel(1_000_000), 0);
});

test("حدود کنترل و تشخیص روند خارج از کنترل", () => {
  const cl = controlLimits([10, 10, 10, 10]);
  near(cl.mean, 10);
  near(cl.sigma, 0);
  const oc = outOfControl([10, 10, 11, 9, 10, 40]);
  assert.ok(oc.violating.includes(5));
  assert.equal(outOfControl([1, 2, 3, 4, 5, 6, 7, 8]).trend, true);
  assert.equal(outOfControl([9, 8, 7, 6, 5, 4, 3]).trend, true);
  assert.equal(outOfControl([5, 11, 11, 11, 11, 11, 11, 11]).shift, true);
  assert.equal(outOfControl([10, 9, 11, 10]).trend, false);
});

/* ── پانچ و تحویل مکانیکی ── */
test("خلاصه پانچ و دروازه تحویل مکانیکی", () => {
  const punch = [
    { id: "P1", category: "A", systemId: "S1" },
    { id: "P2", category: "B", systemId: "S1" },
    { id: "P3", category: "B", systemId: "S1", closed: true },
  ];
  const s = punchSummary(punch);
  assert.equal(s.openA, 1);
  assert.equal(s.openB, 1);
  near(s.closureRate, 33.333333, 1e-4);

  const blocked = mechanicalCompletionGate({
    punch,
    ncrs: [{ id: "N1", severity: "critical", openedAt: "2026-09-01" }],
    itp: [{ id: "H-1", activityId: "A1", type: "H", party: "client" }],
    dossierCompletenessPct: 80,
    preCommissioningDone: false,
  });
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.blockers, ["open_punch_class_a", "open_critical_ncr", "unsigned_hold_point", "dossier_incomplete", "pre_commissioning_pending"]);

  const clear = mechanicalCompletionGate({
    punch: punch.map((p) => ({ ...p, closed: true })),
    ncrs: [{ id: "N1", severity: "critical", openedAt: "2026-09-01", closedAt: "2026-09-04" }],
    itp: [{ id: "H-1", activityId: "A1", type: "H", party: "client", signedAt: "2026-09-05" }],
    dossierCompletenessPct: 98,
    preCommissioningDone: true,
  });
  assert.equal(clear.ok, true);
});

test("کامل‌بودن داکیومنت تحویل", () => {
  const d = dossierCompleteness(["ITP", "MTC", "RT", "AS-BUILT"], ["ITP", "MTC"]);
  near(d.pct, 50);
  assert.deepEqual(d.missing, ["RT", "AS-BUILT"]);
  assert.equal(dossierCompleteness([], []).pct, 100);
});

/* ── امضا و EWS ── */
test("امضای رکورد بازرسی دست‌کاری را آشکار می‌کند", () => {
  const payload = { irId: "IR-4412", result: "accepted", by: "QC-02" };
  const sig = signRecord(payload, "بازرس ارشد", "2026-09-08T09:00:00Z");
  assert.equal(sig.version, QMS_FORMULA_VERSION);
  assert.equal(verifySignature(payload, sig), true);
  assert.equal(verifySignature({ ...payload, result: "rejected" }, sig), false);
  assert.equal(signRecord({ b: 2, a: 1 }, "x", "t").hash, signRecord({ a: 1, b: 2 }, "x", "t").hash);
});

test("هشدارهای زودهنگام کیفیت", () => {
  const alerts = qmsEws({
    openCriticalNcr: 1, ncrOverdueCount: 2, fpyPct: 70, weldRepairPct: 6, copqPct: 4,
    openMajorAuditFindings: 1, certRejections: 2, openPunchA: 3, unsignedHoldPoints: 1, outOfControlTrend: true,
  });
  assert.equal(alerts.length, 10);
  assert.ok(alerts.every((a) => a.code.startsWith("EWS-QMS-")));
  assert.equal(qmsEws({ fpyPct: 96, copqPct: 1 }).length, 0);
});
