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
  validateMissionInput,
  validateChildRow,
  validateStep,
  canTransitionMission,
  transitionNeedsApproval,
  computeMissionProgress,
  newMissionCode,
  newRecordCode,
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
  app.get(base + "/catalog", need("sched.recon.view"), run(async () => ({
    module: FORENSIC_SCHED_MODULE_ID,
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

  /* ── رکوردهای فرزند: فهرست / ایجاد / ویرایش / حذف ── */
  const childTable = (req) => {
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
