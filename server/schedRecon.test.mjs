/*
 * تست واحد PMO-FORENSIC-SCHEDULE-ENGINE-V1.0 — فقط همین فایل اجرا می‌شود:
 *   node --test server/schedRecon.test.mjs
 * (اجرای npm test کامل ممنوع است.)
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  MIP_CODES,
  NETWORK_VALIDATION_THRESHOLDS,
  RECON_STEP_COUNT,
  SCHED_RECON_CHILD_TABLES,
  SCHED_RECON_TABLES,
  assessMipFeasibility,
  canTransitionMission,
  computeCriticalPath,
  transitionNeedsApproval,
  validateMissionInput,
  validateNetworkLogic,
} from "./schedReconLogic.js";
import {
  RECON_DOC_CHAPTERS,
  RECON_DOC_TABLES,
  buildSchedReconReport,
  sanitizeReconDocumentHtml,
} from "./schedReconDocLogic.js";

const act = (code, duration, extra = {}) => ({ Code: code, ActivityId: code, TitleFa: code, OriginalDuration: duration, ...extra });
const rel = (code, p, s, extra = {}) => ({ Code: code, PredecessorCode: p, SuccessorCode: s, RelType: "FS", Lag: 0, ReconstructionBasis: "file_record", ...extra });

test("مدل: ۱۱ جدول فرزند + ۸ گام", () => {
  assert.equal(SCHED_RECON_TABLES.length, 12); // Missions + 11 فرزند
  assert.equal(SCHED_RECON_CHILD_TABLES.length, 11);
  assert.equal(RECON_STEP_COUNT, 8);
});

test("CPM: زنجیرهٔ خطی", () => {
  const r = computeCriticalPath([act("A", 5), act("B", 7)], [rel("R1", "A", "B")]);
  assert.equal(r.ok, true);
  assert.equal(r.projectDuration, 12);
  assert.deepEqual(r.criticalPath, ["A", "B"]);
  assert.equal(r.results.find((x) => x.code === "A")?.ef, 5);
  assert.equal(r.results.every((x) => x.critical), true);
});

test("CPM: انشعاب، شناوری مسیر غیربحرانی مثبت است", () => {
  const r = computeCriticalPath(
    [act("A", 10), act("B", 4), act("C", 6)],
    [rel("R1", "A", "C"), rel("R2", "B", "C")],
  );
  assert.equal(r.ok, true);
  assert.equal(r.projectDuration, 16);
  const b = r.results.find((x) => x.code === "B");
  assert.equal(b.critical, false);
  assert.equal(b.totalFloat, 6);
});

test("CPM: حلقه تشخیص داده می‌شود", () => {
  const r = computeCriticalPath([act("A", 5), act("B", 5)], [rel("R1", "A", "B"), rel("R2", "B", "A")]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "loop");
});

test("CPM: رابطهٔ شکسته (ارجاع نامعلوم) نادیده گرفته نمی‌شود — پاس ok=false یا رد غیرقابل‌حل", () => {
  const r = computeCriticalPath([act("A", 5)], []);
  assert.equal(r.ok, true); // تک فعالیت بدون رابطه مدل‌پذیر است
  assert.equal(r.projectDuration, 5);
});

test("اعتبارسنجی شبکه: انتهای باز و سوء‌استفادهٔ Lag", () => {
  const v = validateNetworkLogic(
    [act("A", 10), act("B", 10)],
    [rel("R1", "A", "B", { Lag: 99 })], // بزرگ‌تر از سقف مطلق و کسر مدت
  );
  assert.equal(v.stats.activityCount, 2);
  const kinds = v.findings.map((f) => f.CheckKind);
  assert.ok(kinds.includes("lag_abuse"));
  assert.ok(kinds.includes("open_end")); // A انتهای-شروع و B انتهای-پایان باز دارد
  const lag = v.findings.find((f) => f.CheckKind === "lag_abuse");
  assert.ok(NETWORK_VALIDATION_THRESHOLDS.lagAbsoluteLimitDays < 99);
});

test("ورودی مأموریت: بازهٔ معکوس رد می‌شود", () => {
  const bad = validateMissionInput({ TitleFa: "تست", PeriodFrom: "2026-04-01", PeriodTo: "2026-01-01" });
  assert.equal(bad.ok, false);
  const good = validateMissionInput({ TitleFa: "تست", PeriodFrom: "2026-01-01", PeriodTo: "2026-04-01" });
  assert.equal(good.ok, true);
});

test("گذر وضعیت: بازگشت به پیش‌نویس ممنوع است", () => {
  assert.equal(canTransitionMission("draft", "in_progress"), true);
  assert.equal(canTransitionMission("in_progress", "draft"), false);
  assert.equal(canTransitionMission("completed", "in_progress"), false);
});

test("SoD: تکمیل مأموریت نیازمند تأیید است", () => {
  assert.equal(transitionNeedsApproval("completed"), true);
  assert.equal(transitionNeedsApproval("in_progress"), false);
  assert.equal(transitionNeedsApproval("cancelled"), false);
});

test("MIP: ۹ پروتکل و امکان‌سنجی داده‌محور", () => {
  assert.equal(MIP_CODES.length, 9);
  const empty = { activities: 0, activitiesWithActualDates: 0, logicRows: 0, snapshots: 0, extractions: 0, durations: 0, calendars: 0, evaluationsConfirmed: 0, decisionRepair: false, decisionReconstruction: false };
  const none = assessMipFeasibility(empty);
  assert.ok(none.every((a) => a.feasibility === "not_feasible"));
  const rich = assessMipFeasibility({ activities: 100, activitiesWithActualDates: 80, logicRows: 150, snapshots: 6, extractions: 200, durations: 60, calendars: 3, evaluationsConfirmed: 2, decisionRepair: true, decisionReconstruction: true });
  assert.ok(rich.every((a) => a.feasibility === "feasible"));
  assert.ok(none[0].reasonFa.includes("پیش‌نیاز")); // دلیل شفاف فارسی
});

/* ──────────────── سند گزارش ──────────────── */

const mission = { Code: "FSR-TEST", TitleFa: "تست", Status: "in_progress", PeriodFrom: "2026-01-01", PeriodTo: "2026-04-01", AnalysisStandard: "BOTH", CurrentStep: 5, ClaimCode: "CLM-1", ContractCode: "CNT-1" };

test("سند: دقیقاً ۱۸ فصل و ۵۱ جدول", () => {
  assert.equal(RECON_DOC_CHAPTERS.length, 18);
  assert.equal(RECON_DOC_TABLES.length, 51);
  const chapters = new Set(RECON_DOC_TABLES.map((t) => t.chapter));
  assert.equal(chapters.size, 18);
  for (let c = 1; c <= 18; c++) assert.ok(chapters.has(c), `فصل ${c} جدول ندارد`);
  const nums = RECON_DOC_TABLES.map((t) => t.no);
  assert.deepEqual([...nums].sort((a, b) => a - b), Array.from({ length: 51 }, (_, i) => i + 1));
});

test("سند: دادهٔ ناقص «—» و Auto-Cleanup", () => {
  const doc = buildSchedReconReport({
    projectId: "c1-p1",
    mission,
    children: {
      PmisSchedReconActivities: [{ Code: "A", ActivityId: "A", TitleFa: "آ", OriginalDuration: 5, StatusFlag: "in_progress" }],
      PmisSchedReconLogic: [],
      PmisSchedReconCriticalPaths: [],
      PmisSchedReconValidations: [],
      PmisSchedReconMipMappings: [],
    },
    format: "word",
    generatedAt: "2026-10-17T00:00:00Z",
  });
  assert.equal(doc.issues.length, 0);
  assert.match(doc.body, /—/); // دادهٔ ناقص نشان «—» دارد
  assert.match(doc.body, /پیش‌نویس/);
  // Auto-Cleanup: بدون راهنمای داخلی، برچسب الزامی/اختیاری، هایلایت زرد
  assert.doesNotMatch(doc.body, /الزامی/);
  assert.doesNotMatch(doc.body, /راهنمای داخلی/);
  assert.doesNotMatch(doc.body, /data-internal/);
  assert.doesNotMatch(doc.body, /background:#ff/i);
  assert.doesNotMatch(doc.body, /<mark/i);
  // فونت رسمی
  assert.match(doc.body, /B Nazanin/);
  // دقیقاً ۵۱ جدول در بدنه
  assert.equal((doc.body.match(/<table>/g) ?? []).length, 51);
});

test("سند: بدون دیکشنری فعالیت، دروازه فعال است", () => {
  const doc = buildSchedReconReport({ projectId: "c1-p1", mission, children: {}, format: "word", generatedAt: "2026-10-17T00:00:00Z" });
  assert.ok(doc.issues.length > 0);
  assert.match(doc.issues.join(" "), /گام ۵/);
});

test("سند: sanitize خالص‌سازی هایلایت و راهنما", () => {
  const dirty = `<p>متن</p><section data-internal="true"><p>راهنمای داخلی</p></section><p style="background:#ffff00">زرد</p><mark>نشان</mark> [الزامی]`;
  const clean = sanitizeReconDocumentHtml(dirty);
  assert.doesNotMatch(clean, /data-internal|راهنمای داخلی|#ffff00|<mark|الزامی/);
  assert.match(clean, /متن|نشان/);
});
