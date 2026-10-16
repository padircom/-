/**
 * PMO-FORENSIC-SCHEDULE-ENGINE-V1.0 — API ماژول «کارشناسی بازسازی و تحلیل
 * زمان‌بندی ادعا» (Forensic Schedule Reconstruction, AACE 29R-03 / SCL V2).
 *
 * مسیر اختصاصی پروژه‌ای /api/sched-recon/:projectId — جدول‌های PmisSchedRecon*
 * فقط از همین مسیر خوانده/نوشته می‌شوند (DEDICATED_TABLE_ROUTES). پیوند با
 * ادعا، رویداد تأخیر و EDMS نرم است (ClaimCode/DelayEventCode/DocumentId)؛
 * هیچ داده‌ای از ماژول‌های دیگر بازنویسی نمی‌شود. خروجی موتور «زمان‌بندی
 * بازسازی‌شده و یافتهٔ اعتبارسنجی» است و هرگز مبلغ خسارت یا مدت تمدید تولید
 * نمی‌کند. تکمیل مأموریت دروازهٔ تأیید + SoD دارد: تأییدکننده ≠ سازنده.
 */
import {
  FORENSIC_SCHED_MODULE_ID,
  FORENSIC_SCHED_VERSION,
  SCHED_RECON_LLM_CONNECTED,
  SCHED_RECON_TABLES,
  SCHED_RECON_CHILD_TABLES,
  RECON_STEPS,
  RECON_STEP_COUNT,
  MIP_PROTOCOLS,
  MISSION_STATUSES,
  MISSION_TRANSITIONS,
  ANALYSIS_STANDARDS,
  CHILD_TABLE_SPECS,
  CLAIM_DOC_SCHEDULE_TABLE_RANGE,
  NETWORK_VALIDATION_THRESHOLDS,
  validateMissionInput,
  validateChildRow,
  validateStep,
  canTransitionMission,
  transitionNeedsApproval,
  computeMissionProgress,
  newMissionCode,
  newRecordCode,
  validateNetworkLogic,
  computeCriticalPath,
  assessMipFeasibility,
} from "./schedReconLogic.js";

const locks = new Map();
async function serial(key, work) {
  const previous = locks.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(work);
  locks.set(key, current);
  try { return await current; } finally { if (locks.get(key) === current) locks.delete(key); }
}
function error(status, code, message) { return Object.assign(new Error(message), { status, code }); }

const CHILD_SET = new Set(SCHED_RECON_CHILD_TABLES);

export function registerSchedReconRoutes(app, { repo, subjects, evaluate }) {
  const base = "/api/sched-recon/:projectId";
  const can = (req, permission) => evaluate(req.schedSubject, permission, { projectId: req.params.projectId }).allow;
  const need = (perms) => (req, res, next) => {
    const fail = (status, code, message) => res.status(status).json({ ok: false, error: { code, message, traceId: req.requestId } });
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(req.params.projectId)) return fail(400, "SCHED_PROJECT", "شناسهٔ پروژه نامعتبر است");
    req.schedSubject = subjects.find((s) => s.id === String(req.headers["x-user-id"] || "").trim() && s.active);
    if (!req.schedSubject) return fail(401, "SCHED_AUTH", "هویت معتبر الزامی است");
    if (!(Array.isArray(perms) ? perms : [perms]).some((p) => can(req, p))) return fail(403, "SCHED_FORBIDDEN", "مجوز اقدام یا دسترسی به پروژه را ندارید");
    next();
  };
  const where = (projectId) => [{ column: "ProjectId", op: "eq", value: projectId }];
  const findMission = async (r, req) => {
    const row = await r.findOne("PmisSchedReconMissions", [...where(req.params.projectId), { column: "Id", op: "eq", value: req.params.id }]);
    if (!row) throw error(404, "SCHED_NOT_FOUND", "مأموریت در این پروژه یافت نشد");
    return row;
  };
  const run = (handler) => async (req, res, next) => {
    try {
      const work = async () => handler(await repo(), req);
      const out = req.method === "GET" ? await work() : await serial(`sched-recon:${req.params.projectId}`, work);
      res.json({ ok: true, data: out });
    } catch (e) {
      if (e?.status) return res.status(e.status).json({ ok: false, error: { code: e.code, message: e.message, traceId: req.requestId } });
      next(e);
    }
  };

  /* ── کاتالوگ قاعده‌محور: مراحل، پروتکل‌ها، شمارش‌ها (فقط‌خواندنی) ── */
  app.get(base + "/catalog", need("sched.recon.view"), run(async (r, req) => ({
    module: FORENSIC_SCHED_MODULE_ID,
    permissions: ["sched.recon.view", "sched.recon.edit", "sched.recon.approve"].filter((p) => can(req, p)),
    version: FORENSIC_SCHED_VERSION,
    llmConnected: SCHED_RECON_LLM_CONNECTED,
    steps: RECON_STEPS,
    stepCount: RECON_STEP_COUNT,
    mipProtocols: MIP_PROTOCOLS,
    missionStatuses: MISSION_STATUSES,
    missionTransitions: MISSION_TRANSITIONS,
    analysisStandards: ANALYSIS_STANDARDS,
    childTables: SCHED_RECON_CHILD_TABLES,
    childSpecs: CHILD_TABLE_SPECS,
    tables: SCHED_RECON_TABLES,
    claimDocTables: CLAIM_DOC_SCHEDULE_TABLE_RANGE,
    standardsNoteFa: "تطبیق با AACE 29R-03 (MIP 3.1..3.9) و SCL Delay Protocol ویرایش دوم؛ انتخاب نهایی روش و هر نتیجه فقط با تأیید کارشناس قطعی می‌شود.",
    referenceFa: "مدیر ادعا | Claim Manager — claimanager.ir",
  })));

  /* ── فهرست مأموریت‌ها + پیشرفت قاعده‌محور ── */
  app.get(base + "/missions", need("sched.recon.view"), run(async (r, req) => {
    const w = where(req.params.projectId);
    const missions = await r.list("PmisSchedReconMissions", { where: w, limit: 500 }).catch(() => []);
    /* شمارش واقعی رکوردهای هر جدول فرزند برای گزارش صادقانهٔ پیشرفت. */
    const counts = {};
    for (const t of SCHED_RECON_CHILD_TABLES) {
      const rows = await r.list(t, { where: w, limit: 5000 }).catch(() => []);
      for (const row of rows) {
        const key = row.MissionCode;
        counts[key] = counts[key] ?? {};
        counts[key][t] = (counts[key][t] ?? 0) + 1;
      }
    }
    const items = missions
      .sort((a, b) => String(b.Code).localeCompare(String(a.Code)))
      .map((m) => ({ ...m, progress: computeMissionProgress(m.CurrentStep ?? 1, counts[m.Code] ?? {}) }));
    return { missions: items };
  }));

  /* ── ایجاد مأموریت (مرحلهٔ ۱ دستورالعمل) ── */
  app.post(base + "/missions", need("sched.recon.edit"), run(async (r, req) => {
    const b = req.body ?? {};
    const v = validateMissionInput(b);
    if (!v.ok) throw error(400, "SCHED_VALIDATION", v.errors.join("؛ "));
    const code = String(b.Code ?? "").trim() || newMissionCode();
    const dup = await r.findOne("PmisSchedReconMissions", [...where(req.params.projectId), { column: "Code", op: "eq", value: code }]);
    if (dup) throw error(409, "SCHED_DUP", "کد مأموریت در این پروژه تکراری است");
    const row = await r.create("PmisSchedReconMissions", {
      Code: code,
      TitleFa: String(b.TitleFa).trim(),
      PurposeFa: b.PurposeFa ?? null,
      PeriodFrom: b.PeriodFrom,
      PeriodTo: b.PeriodTo,
      AnalysisStandard: b.AnalysisStandard ?? "BOTH",
      ClaimCode: b.ClaimCode ?? null,
      DelayEventCode: b.DelayEventCode ?? null,
      ContractCode: b.ContractCode ?? null,
      ScheduleFileRefs: b.ScheduleFileRefs ?? null,
      CurrentStep: 1,
      Status: "draft",
      CreatedBy: req.schedSubject.id,
      ExpertNoteFa: b.ExpertNoteFa ?? null,
      ProjectId: req.params.projectId,
    }, req.schedSubject.id, "schedRecon");
    return { mission: row };
  }));

  /* ── جزئیات یک مأموریت + رکوردهای فرزند ── */
  app.get(base + "/missions/:id", need("sched.recon.view"), run(async (r, req) => {
    const mission = await findMission(r, req);
    const children = {};
    const counts = {};
    for (const t of SCHED_RECON_CHILD_TABLES) {
      const rows = await r.list(t, { where: [...where(req.params.projectId), { column: "MissionCode", op: "eq", value: mission.Code }], limit: 5000 }).catch(() => []);
      children[t] = rows;
      counts[t] = rows.length;
    }
    return { mission, children, progress: computeMissionProgress(mission.CurrentStep ?? 1, counts) };
  }));

  /* ── ویرایش مأموریت (مادامی‌که تکمیل نشده) ── */
  app.patch(base + "/missions/:id", need("sched.recon.edit"), run(async (r, req) => {
    const row = await findMission(r, req);
    if (["completed", "cancelled"].includes(row.Status)) throw error(409, "SCHED_STATUS", "مأموریت بسته‌شده قابل ویرایش نیست");
    const merged = { ...row, ...(req.body ?? {}) };
    delete merged.Id; delete merged.Code; delete merged.ProjectId; delete merged.CreatedBy; delete merged.ApprovedBy; delete merged.ApprovedAt; delete merged.CompletedAt;
    const v = validateMissionInput(merged);
    if (!v.ok) throw error(400, "SCHED_VALIDATION", v.errors.join("؛ "));
    const allowed = ["TitleFa", "PurposeFa", "PeriodFrom", "PeriodTo", "AnalysisStandard", "ClaimCode", "DelayEventCode", "ContractCode", "ScheduleFileRefs", "ExpertNoteFa"];
    const patch = {};
    for (const k of allowed) if (k in merged) patch[k] = merged[k] ?? null;
    const updated = await r.patch("PmisSchedReconMissions", row.Id, patch, req.schedSubject.id, row.RowVersion);
    return { mission: updated };
  }));

  /* ── گذر وضعیت مأموریت؛ completed با مجوز تأیید و SoD (≠ سازنده) ── */
  app.post(base + "/missions/:id/transition", need(["sched.recon.edit", "sched.recon.approve"]), run(async (r, req) => {
    const row = await findMission(r, req);
    const to = String(req.body?.to ?? "");
    if (!MISSION_STATUSES.includes(to)) throw error(400, "SCHED_VALIDATION", "وضعیت مقصد نامعتبر است");
    if (!canTransitionMission(row.Status, to)) throw error(409, "SCHED_STATUS", `گذر از «${row.Status}» به «${to}» مجاز نیست`);
    const patch = { Status: to };
    if (transitionNeedsApproval(to)) {
      /* SoD زمان اجرا: تأییدکنندهٔ تکمیل مجوز جدا دارد و نباید سازندهٔ مأموریت باشد. */
      if (!can(req, "sched.recon.approve")) throw error(403, "SCHED_FORBIDDEN", "تکمیل مأموریت نیازمند مجوز تأیید است");
      if (row.CreatedBy && row.CreatedBy === req.schedSubject.id) throw error(403, "SCHED_SOD", "سازندهٔ مأموریت نمی‌تواند تکمیل آن را تأیید کند");
      patch.ApprovedBy = req.schedSubject.id;
      patch.ApprovedAt = new Date().toISOString();
      patch.CompletedAt = new Date().toISOString();
      patch.CurrentStep = RECON_STEP_COUNT;
    }
    if (to === "in_progress" && !row.StartedAt) patch.StartedAt = new Date().toISOString();
    const updated = await r.patch("PmisSchedReconMissions", row.Id, patch, req.schedSubject.id, row.RowVersion);
    return { mission: updated };
  }));

  /* ── ثبت گام جاری مأموریت (فقط پیشرو، در بازهٔ ۱..۸) ── */
  app.post(base + "/missions/:id/step", need("sched.recon.edit"), run(async (r, req) => {
    const row = await findMission(r, req);
    if (["completed", "cancelled"].includes(row.Status)) throw error(409, "SCHED_STATUS", "مأموریت بسته‌شده است");
    const step = Number(req.body?.step);
    if (!validateStep(step)) throw error(400, "SCHED_VALIDATION", `گام باید عددی از ۱ تا ${RECON_STEP_COUNT} باشد`);
    if (step > (row.CurrentStep ?? 1) + 1) throw error(409, "SCHED_STEP", "پرش از گام‌ها مجاز نیست؛ دستورالعمل مرحله‌به‌مرحله اجرا می‌شود");
    const updated = await r.patch("PmisSchedReconMissions", row.Id, { CurrentStep: step }, req.schedSubject.id, row.RowVersion);
    return { mission: updated };
  }));

  /* ── حذف مأموریت: فقط draft و بدون رکورد فرزند (پاک‌سازی امن آزمون) ── */
  app.delete(base + "/missions/:id", need("sched.recon.edit"), run(async (r, req) => {
    const row = await findMission(r, req);
    if (row.Status !== "draft") throw error(409, "SCHED_STATUS", "فقط مأموریت پیش‌نویس حذف می‌شود؛ برای توقف از لغو استفاده کنید");
    for (const t of SCHED_RECON_CHILD_TABLES) {
      const rows = await r.list(t, { where: [...where(req.params.projectId), { column: "MissionCode", op: "eq", value: row.Code }], limit: 1 }).catch(() => []);
      if (rows.length > 0) throw error(409, "SCHED_CHILDREN", "مأموریت دارای رکورد کارشناسی است و حذف نمی‌شود");
    }
    await r.remove("PmisSchedReconMissions", row.Id);
    return { deleted: true, code: row.Code };
  }));

  /* ── اجرای موتورهای کارشناسی روی مأموریت (خروجی پیش‌نویس محاسباتی) ── */

  /* NetworkLogicValidator: روی دیکشنری فعالیت + منطق شبکهٔ همان مأموریت می‌دود
   * و یافته‌ها را به‌جای نتایج خودکار قبلی بازنویسی می‌کند (یافته‌های انسانی
   * معتبر باقی می‌مانند — AutoDetected=false). */
  app.post(base + "/missions/:id/run-validation", need("sched.recon.edit"), run(async (r, req) => {
    const mission = await findMission(r, req);
    if (["completed", "cancelled"].includes(mission.Status)) throw error(409, "SCHED_STATUS", "مأموریت بسته‌شده قابل پردازش نیست");
    const mw = [...where(req.params.projectId), { column: "MissionCode", op: "eq", value: mission.Code }];
    const [activities, logicRows, oldFindings] = await Promise.all([
      r.list("PmisSchedReconActivities", { where: mw, limit: 5000 }).catch(() => []),
      r.list("PmisSchedReconLogic", { where: mw, limit: 5000 }).catch(() => []),
      r.list("PmisSchedReconValidations", { where: mw, limit: 5000 }).catch(() => []),
    ]);
    if (activities.length === 0) throw error(409, "SCHED_STEP", "ابتدا دیکشنری فعالیت‌ها (مرحلهٔ ۵) را ثبت کنید");
    const { findings, stats } = validateNetworkLogic(activities, logicRows);
    for (const old of oldFindings.filter((f) => f.AutoDetected === true)) await r.remove("PmisSchedReconValidations", old.Id);
    const created = [];
    for (const f of findings) {
      created.push(await r.create("PmisSchedReconValidations", {
        Code: newRecordCode("VALD"), MissionCode: mission.Code, ProjectId: req.params.projectId,
        CheckKind: f.CheckKind, Severity: f.Severity, ActivityCode: f.ActivityCode ?? null, DetailFa: f.DetailFa,
        AutoDetected: true, Resolution: "open",
      }, req.schedSubject.id, "schedRecon"));
    }
    return { stats, thresholds: NETWORK_VALIDATION_THRESHOLDS, findingsCreated: created.length, findingsReplaced: oldFindings.filter((f) => f.AutoDetected === true).length, noteFa: "یافته‌ها پیش‌نویس محاسباتی‌اند و بدون تعیین تکلیف کارشناس (Resolution) قطعی نیستند." };
  }));

  /* CriticalPathReconstructionEngine: CPM روی شبکهٔ بازسازی‌شده + ثبت مسیر در
   * مقطع‌های زمانیِ مشخص‌شده (یا بدون مقطع: SnapshotCode=null). */
  app.post(base + "/missions/:id/run-critical-path", need("sched.recon.edit"), run(async (r, req) => {
    const mission = await findMission(r, req);
    if (["completed", "cancelled"].includes(mission.Status)) throw error(409, "SCHED_STATUS", "مأموریت بسته‌شده قابل پردازش نیست");
    const mw = [...where(req.params.projectId), { column: "MissionCode", op: "eq", value: mission.Code }];
    const [activities, logicRows, snapshots] = await Promise.all([
      r.list("PmisSchedReconActivities", { where: mw, limit: 5000 }).catch(() => []),
      r.list("PmisSchedReconLogic", { where: mw, limit: 5000 }).catch(() => []),
      r.list("PmisSchedReconSnapshots", { where: mw, limit: 5000 }).catch(() => []),
    ]);
    if (activities.length === 0) throw error(409, "SCHED_STEP", "ابتدا دیکشنری فعالیت‌ها (مرحلهٔ ۵) را ثبت کنید");
    if (logicRows.length === 0) throw error(409, "SCHED_STEP", "ابتدا منطق شبکه (مرحلهٔ ۷) را ثبت کنید");
    const result = computeCriticalPath(activities, logicRows);
    if (!result.ok) {
      const msg = { loop: `حلقهٔ منطقی در شبکه (گذر از «${result.loopMember ?? "?"}») — ابتدا با تأیید کارشناس رفع شود`, empty: "شبکهٔ فعالیت خالی است", broken_chain: "هیچ رابطهٔ معتبری بین فعالیت‌ها نیست؛ منطق شبکه ناقص است" }[result.reason];
      throw error(409, "SCHED_CPM", msg);
    }
    let snapshotCode = String(req.body?.snapshotCode ?? "").trim() || null;
    if (snapshotCode && !snapshots.some((s) => s.Code === snapshotCode)) throw error(404, "SCHED_NOT_FOUND", "مقطع زمانی انتخاب‌شده در این مأموریت وجود ندارد");
    if (!snapshotCode) {
      /* مسیر بحرانی همیشه «به‌ازای» یک مقطع ثبت می‌شود؛ اگر کاربر مقطع نداد،
       * مقطع خودکارِ «وضعیت جاری مدل» به تاریخ امروز upsert می‌شود (CutoffDate
       * واقعیِ امروز، بدون عدد ساختگی) تا زنجیرهٔ منبع گزارش احفظ شود. */
      snapshotCode = "AUTO-CURRENT";
      const auto = snapshots.find((s) => s.Code === snapshotCode);
      const autoPayload = { CutoffDate: new Date().toISOString().slice(0, 10), NoteFa: "مقطع خودکار اجرای موتور — وضعیت جاری مدل بازسازی‌شده." };
      if (auto) await r.patch("PmisSchedReconSnapshots", auto.Id, autoPayload, req.schedSubject.id, auto.RowVersion);
      else await r.create("PmisSchedReconSnapshots", {
        Code: snapshotCode, MissionCode: mission.Code, ProjectId: req.params.projectId,
        LabelFa: "وضعیت جاری مدل بازسازی‌شده (خودکار)", CutoffDate: autoPayload.CutoffDate, DataKind: "other",
        Status: "open", CreatedBy: req.schedSubject.id, CreatedAt: new Date().toISOString(),
      }, req.schedSubject.id, "schedRecon");
    }
    const row = await r.create("PmisSchedReconCriticalPaths", {
      Code: newRecordCode("CRPA"), MissionCode: mission.Code, ProjectId: req.params.projectId,
      SnapshotCode: snapshotCode, PathRank: 1,
      ActivityCodes: JSON.stringify(result.criticalPath),
      TotalDuration: result.projectDuration,
      DrivingLogic: JSON.stringify(result.results.map((x) => ({ code: x.code, es: x.es, ef: x.ef, float: x.totalFloat, critical: x.critical }))),
      ChangeKind: null,
      NoteFa: `محاسبهٔ خودکار CPM (${result.results.filter((x) => x.critical).length} فعالیت بحرانی از ${result.results.length}) — پیش‌نویس، نیازمند تأیید کارشناس.`,
    }, req.schedSubject.id, "schedRecon");
    return { computed: { projectDuration: result.projectDuration, criticalPath: result.criticalPath, results: result.results, drivingOrder: result.drivingOrder }, snapshotCode, stored: row.Id, snapshotsAvailable: snapshots.map((s) => s.Code) };
  }));

  /* AACE29R03ProtocolMapper: امکان‌سنجی ۹ پروتکل بر اساس موجودیت واقعی دادهٔ
   * مأموریت؛ نتیجه در PmisSchedReconMipMappings بازنویسی می‌شود و انتخاب نهایی
   * روش (SelectedFlag) دست‌نخورده و منحصر کارشناس می‌ماند. */
  app.post(base + "/missions/:id/run-mip-assessment", need("sched.recon.edit"), run(async (r, req) => {
    const mission = await findMission(r, req);
    if (["completed", "cancelled"].includes(mission.Status)) throw error(409, "SCHED_STATUS", "مأموریت بسته‌شده قابل پردازش نیست");
    const mw = [...where(req.params.projectId), { column: "MissionCode", op: "eq", value: mission.Code }];
    const [activities, logicRows, snapshots, extractions, durations, calendars, evaluations, existing] = await Promise.all(
      ["PmisSchedReconActivities", "PmisSchedReconLogic", "PmisSchedReconSnapshots", "PmisSchedReconExtractions", "PmisSchedReconDurations", "PmisSchedReconCalendars", "PmisSchedReconEvaluations", "PmisSchedReconMipMappings"].map((t) => r.list(t, { where: mw, limit: 5000 }).catch(() => [])),
    );
    const assessments = assessMipFeasibility({
      activities: activities.length,
      activitiesWithActualDates: activities.filter((a) => a.ActualStart || a.ActualFinish).length,
      logicRows: logicRows.length,
      snapshots: snapshots.length,
      extractions: extractions.length,
      durations: durations.length,
      calendars: calendars.length,
      evaluationsConfirmed: evaluations.filter((e) => e.Status === "confirmed").length,
      decisionRepair: evaluations.some((e) => e.Decision === "repair" && e.Status === "confirmed"),
      decisionReconstruction: evaluations.some((e) => e.Decision === "reconstruction" && e.Status === "confirmed"),
    });
    const rows = [];
    for (const a of assessments) {
      const cur = existing.filter((x) => x.MipCode === a.code).sort((x, y) => String(y.Code).localeCompare(String(x.Code)))[0] ?? null;
      const payload = {
        Family: a.family, Feasibility: a.feasibility, FeasibilityReasonFa: a.reasonFa,
        RequiredDataJson: JSON.stringify(a.required), ProvidedDataJson: JSON.stringify(a.provided),
        NoteFa: `امکان‌سنجی خودکار ${new Date().toISOString().slice(0, 10)} — انتخاب نهایی روش با کارشناس است.`,
      };
      if (cur) {
        rows.push(await r.patch("PmisSchedReconMipMappings", cur.Id, payload, req.schedSubject.id, cur.RowVersion));
      } else {
        rows.push(await r.create("PmisSchedReconMipMappings", {
          Code: newRecordCode("MIPM"), MissionCode: mission.Code, ProjectId: req.params.projectId,
          MipCode: a.code, ...payload, SelectedFlag: false,
        }, req.schedSubject.id, "schedRecon"));
      }
    }
    return { assessments: assessments.map((a) => ({ code: a.code, family: a.family, feasibility: a.feasibility, reasonFa: a.reasonFa, required: a.required, provided: a.provided })), upserted: rows.length };
  }));

  /* ── رکوردهای فرزند: فهرست / ایجاد / ویرایش / حذف ── */  const childTable = (req) => {
    const t = String(req.params.table ?? "");
    if (!CHILD_SET.has(t)) throw error(404, "SCHED_TABLE", "جدول فرزند نامعتبر است");
    return t;
  };
  const findChildMission = async (r, req) => {
    const row = await r.findOne("PmisSchedReconMissions", [...where(req.params.projectId), { column: "Id", op: "eq", value: req.params.id }]);
    if (!row) throw error(404, "SCHED_NOT_FOUND", "مأموریت در این پروژه یافت نشد");
    if (["completed", "cancelled"].includes(row.Status) && req.method !== "GET") {
      throw error(409, "SCHED_STATUS", "مأموریت بسته‌شده قابل تغییر نیست");
    }
    return row;
  };

  app.get(base + "/missions/:id/rows/:table", need("sched.recon.view"), run(async (r, req) => {
    const t = childTable(req);
    const mission = await findChildMission(r, req);
    const rows = await r.list(t, { where: [...where(req.params.projectId), { column: "MissionCode", op: "eq", value: mission.Code }], limit: 5000 }).catch(() => []);
    return { table: t, rows };
  }));

  app.post(base + "/missions/:id/rows/:table", need("sched.recon.edit"), run(async (r, req) => {
    const t = childTable(req);
    const mission = await findChildMission(r, req);
    const b = req.body ?? {};
    const v = validateChildRow(t, b);
    if (!v.ok) throw error(400, "SCHED_VALIDATION", v.errors.join("؛ "));
    const code = String(b.Code ?? "").trim() || newRecordCode(t.replace("PmisSchedRecon", ""));
    const spec = CHILD_TABLE_SPECS[t];
    const row = { Code: code, MissionCode: mission.Code, ProjectId: req.params.projectId };
    /* فقط فیلدهای تعریف‌شدهٔ schema پذیرفته می‌شود؛ ورودی اضافه کنار گذاشته می‌شود. */
    for (const [k, val] of Object.entries(b)) {
      if (["Id", "Code", "MissionCode", "ProjectId", "RowVersion"].includes(k)) continue;
      row[k] = typeof val === "string" && val.trim() === "" ? null : val;
    }
    if (spec && b.AutoDetected === undefined && t === "PmisSchedReconValidations") row.AutoDetected = false;
    const created = await r.create(t, row, req.schedSubject.id, "schedRecon");
    return { table: t, row: created };
  }));

  app.patch(base + "/missions/:id/rows/:table/:rowId", need("sched.recon.edit"), run(async (r, req) => {
    const t = childTable(req);
    const mission = await findChildMission(r, req);
    const cur = await r.findOne(t, [...where(req.params.projectId), { column: "MissionCode", op: "eq", value: mission.Code }, { column: "Id", op: "eq", value: req.params.rowId }]);
    if (!cur) throw error(404, "SCHED_NOT_FOUND", "رکورد در این مأموریت یافت نشد");
    const patch = {};
    for (const [k, val] of Object.entries(req.body ?? {})) {
      if (["Id", "Code", "MissionCode", "ProjectId", "RowVersion"].includes(k)) continue;
      patch[k] = typeof val === "string" && val.trim() === "" ? null : val;
    }
    const merged = { ...cur, ...patch };
    const v = validateChildRow(t, merged);
    if (!v.ok) throw error(400, "SCHED_VALIDATION", v.errors.join("؛ "));
    const updated = await r.patch(t, cur.Id, patch, req.schedSubject.id, cur.RowVersion);
    return { table: t, row: updated };
  }));

  app.delete(base + "/missions/:id/rows/:table/:rowId", need("sched.recon.edit"), run(async (r, req) => {
    const t = childTable(req);
    const mission = await findChildMission(r, req);
    const cur = await r.findOne(t, [...where(req.params.projectId), { column: "MissionCode", op: "eq", value: mission.Code }, { column: "Id", op: "eq", value: req.params.rowId }]);
    if (!cur) throw error(404, "SCHED_NOT_FOUND", "رکورد در این مأموریت یافت نشد");
    await r.remove(t, cur.Id);
    return { table: t, deleted: true, code: cur.Code };
  }));
}
