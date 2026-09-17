/**
 * PEX DPR engine — validation, workflow, roll-up, conflicts.
 * Pure logic (no I/O) so routes and tests share it.
 * Rule: فقط Approved وارد PMS/گانت/EVM می‌شود (PEX_D9).
 */

export const DPR_STATUS = ["draft", "submitted", "approved", "rejected", "revision_required"];

export const DPR_TRANSITIONS = {
  submit: {
    from: ["draft", "revision_required", "rejected"],
    to: "submitted",
    roles: ["admin", "project_manager", "site_engineer", "planner"],
    assignee: "reviewer",
  },
  approve: {
    from: ["submitted"],
    to: "approved",
    roles: ["admin", "project_manager", "consultant", "client"],
    assignee: null,
  },
  reject: {
    from: ["submitted"],
    to: "rejected",
    roles: ["admin", "project_manager", "consultant", "client"],
    assignee: "site_engineer",
  },
  revise: {
    from: ["submitted"],
    to: "revision_required",
    roles: ["admin", "project_manager", "consultant", "client"],
    assignee: "site_engineer",
  },
};

export function canDprTransition(fromStatus, actionCode, actorRole) {
  const tr = DPR_TRANSITIONS[actionCode];
  if (!tr) return { ok: false, code: "INVALID_ACTION" };
  if (!tr.roles.includes(actorRole)) return { ok: false, code: "ROLE_NOT_ALLOWED" };
  if (!tr.from.includes(fromStatus)) return { ok: false, code: "INVALID_TRANSITION" };
  return { ok: true, to: tr.to, assignee: tr.assignee };
}

const SHIFTS = new Set(["A", "B", "C", "N"]);

export function validateDprLine(line, ctx = {}) {
  const errors = [];
  const acts = ctx.activities || {};
  const act = acts[line.activityCode];
  if (!line.activityCode) errors.push("ACTIVITY_REQUIRED");
  else if (ctx.strictActivity !== false && !act) errors.push("ACTIVITY_UNKNOWN");
  if (!Number.isInteger(line.stepSeq) || line.stepSeq < 1) errors.push("STEP_INVALID");
  else if (act && !act.steps.some((s) => s.seq === line.stepSeq)) errors.push("STEP_UNKNOWN");
  if (!(Number(line.qty) > 0)) errors.push("QTY_POSITIVE");
  if (act && act.locked && !line.crId) errors.push("LOCKED_NEEDS_CR");
  if (line.locationCode != null && String(line.locationCode).length > 50) errors.push("LOCATION_TOO_LONG");
  return errors;
}

export function validateDpr(dpr, ctx = {}) {
  const errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dpr.reportDate || ""))) errors.push("DATE_INVALID");
  else if (Number.isNaN(new Date(dpr.reportDate + "T00:00:00Z").getTime())) errors.push("DATE_INVALID");
  if (!SHIFTS.has(String(dpr.shift || "").toUpperCase())) errors.push("SHIFT_INVALID");
  if (!Array.isArray(dpr.lines) || dpr.lines.length === 0) errors.push("LINES_REQUIRED");
  else if (dpr.lines.length > 200) errors.push("LINES_TOO_MANY");
  else {
    dpr.lines.forEach((ln, i) => {
      validateDprLine(ln, ctx).forEach((code) => errors.push(`L${i + 1}:${code}`));
    });
  }
  return errors;
}

/** جمع مقادیر تأییدشده به تفکیک فعالیت×گام. */
export function rollupApprovedQty(lines) {
  const out = {};
  for (const ln of lines || []) {
    if (ln.lineStatus !== "approved") continue;
    const key = `${ln.activityCode}#${ln.stepSeq}`;
    out[key] = (out[key] || 0) + Number(ln.approvedQty ?? ln.qty ?? 0);
  }
  return out;
}

export function stepPercent(approvedQty, targetQty) {
  if (!(targetQty > 0)) return 0;
  return Math.max(0, Math.min(1, Number(approvedQty || 0) / targetQty));
}

/** درصد فیزیکی فعالیت = Σ وزن‌گام × درصد گام */
export function activityPhysicalPct(steps) {
  const pct = (steps || []).reduce(
    (s, st) => s + Number(st.weight || 0) * stepPercent(st.approvedQty, st.targetQty),
    0
  );
  return +Math.max(0, Math.min(1, pct)).toFixed(4);
}

/**
 * اعمال خطوط تأییدشده روی ردیف‌های گام (خالص؛ ورودی را جهش نمی‌دهد).
 * stepRows: [{ activityCode, stepSeq, weight, targetQty, approvedQty }]
 * returns: { rows, pctByActivity }
 */
export function applyApproval(lines, stepRows) {
  const add = rollupApprovedQty(lines);
  const rows = (stepRows || []).map((r) => {
    const key = `${r.activityCode}#${r.stepSeq}`;
    const delta = add[key] || 0;
    return { ...r, approvedQty: +(Number(r.approvedQty || 0) + delta).toFixed(4) };
  });
  const byAct = {};
  for (const r of rows) (byAct[r.activityCode] = byAct[r.activityCode] || []).push(r);
  const pctByActivity = {};
  for (const [code, steps] of Object.entries(byAct)) pctByActivity[code] = activityPhysicalPct(steps);
  return { rows, pctByActivity };
}

/**
 * تعارض آفلاین (PEX_D9): همان فعالیت+تاریخ+گام با دو مقدار متفاوت.
 * lines: [{ activityCode, reportDate, stepSeq, qty, dprId }]
 */
export function detectConflicts(lines) {
  const groups = new Map();
  for (const ln of lines || []) {
    const key = `${ln.activityCode}|${ln.reportDate}|${ln.stepSeq}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ln);
  }
  const out = [];
  for (const [key, items] of groups) {
    const qtys = new Set(items.map((x) => Number(x.qty)));
    if (qtys.size > 1) {
      const [activityCode, reportDate, stepSeq] = key.split("|");
      out.push({ activityCode, reportDate, stepSeq: Number(stepSeq), lines: items });
    }
  }
  return out;
}

/** هشدار DPR ثبت‌نشده بعد از ۲۴ ساعت. */
export function missingDpr(lastReportDateIso, nowIso) {
  if (!lastReportDateIso) return true;
  const last = new Date(lastReportDateIso + "T00:00:00Z").getTime();
  const now = new Date((nowIso || new Date().toISOString().slice(0, 10)) + "T00:00:00Z").getTime();
  if (Number.isNaN(last) || Number.isNaN(now)) return true;
  return now - last > 24 * 3600 * 1000;
}

/** فقط یک DPR باز (draft/submitted/revision) به‌ازای پروژه+تاریخ+شیفت. */
export function openDprBlocked(existing, reportDate, shift) {
  const s = String(shift || "").toUpperCase();
  return (existing || []).some(
    (d) =>
      d.reportDate === reportDate &&
      String(d.shift || "").toUpperCase() === s &&
      ["draft", "submitted", "revision_required"].includes(d.status)
  );
}
