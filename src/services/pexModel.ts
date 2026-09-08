/**
 * لایه اتصال داده پروژه به موتور PEX.
 * هیچ فرمولی اینجا تعریف نمی‌شود؛ فقط ترکیب src/data/pexProject.ts با src/services/planning.ts .
 */
import {
  PEX_ACTIVITIES,
  PEX_COMMITMENTS,
  PEX_MILESTONES,
  PEX_PERIODS,
  PEX_PROJECT,
  PEX_RELATIONS,
  PEX_ROC,
  PEX_SCURVE,
  PEX_WBS,
  PEX_WEIGHT_ITEMS,
} from "../data/pexProject";
import {
  DEFAULT_NEAR_CRITICAL,
  activityProgress,
  computeCpm,
  computeWeights,
  cpAlerts,
  cpSnapshot,
  dcma14,
  escalationLevel,
  milestoneAlerts,
  milestonePenalty,
  milestoneStatus,
  plannedPercentAt,
  ppc,
  progressVariance,
  rollUp,
  validateRoc,
  workingDaysBetween,
  type CpmActivity,
  type Milestone,
  type MilestoneStatus,
  type PexAlert,
  type WeightMode,
} from "./planning";

export type ActivityRow = CpmActivity & {
  wbs: string;
  nameEn: string;
  cost: number;
  manHours: number;
  roc: string;
  physicalPct: number;
  blockedSteps: string[];
  weight: number;
  plannedPct: number;
};

export type MilestoneRow = Milestone & {
  nameEn: string;
  driverActivity: string;
  status: MilestoneStatus;
  slipDays: number;
  penalty: number;
  bonus: number;
  escalation: 0 | 1 | 2 | 3;
};

export type PexModel = ReturnType<typeof buildPexModel>;

export function buildPexModel(weightMode: WeightMode = "Cost", alpha = 1) {
  const dataDate = PEX_PROJECT.dataDate;

  /* برنامه پایه BL-01: همان شبکه بدون تاریخ‌های واقعی — مرجع مقایسه و مقدس. */
  const baseline = computeCpm(
    PEX_ACTIVITIES.map(({ actualStart: _s, actualFinish: _f, ...rest }) => rest),
    PEX_RELATIONS,
    PEX_PROJECT.start
  );
  const baseById = Object.fromEntries(baseline.activities.map((a) => [a.id, a]));

  /* پیشرفت فیزیکی هر فعالیت از RoC → مدت باقی‌مانده → CPM جاری با Data Date. */
  const progressById: Record<string, { physicalPct: number; blockedSteps: string[] }> = {};
  const current = PEX_ACTIVITIES.map((a) => {
    const roc = PEX_ROC[a.roc];
    const prog = roc && a.progress.length ? activityProgress(roc.steps, a.progress) : { physicalPct: 0, blockedSteps: [] };
    progressById[a.id] = prog;
    const remaining = Math.ceil((a.duration * (100 - prog.physicalPct)) / 100);
    const done = prog.physicalPct >= 100;
    return {
      ...a,
      remainingDuration: a.isMilestone ? 0 : Math.max(done ? 0 : 1, remaining),
      actualFinish: done ? (a.actualFinish ?? dataDate) : undefined,
    };
  });

  const cpm = computeCpm(current, PEX_RELATIONS, dataDate);
  const cpmById = Object.fromEntries(cpm.activities.map((a) => [a.id, a]));
  const weights = computeWeights(PEX_WEIGHT_ITEMS, weightMode, alpha);

  const rows: ActivityRow[] = PEX_ACTIVITIES.map((a) => {
    const prog = progressById[a.id];
    const c = cpmById[a.id];
    const bl = baseById[a.id];
    /** درصد برنامه‌ای فعالیت در Data Date از روی گذر زمان کاری در برنامه پایه. */
    const elapsed = workingDaysBetween(bl.es, dataDate) - 1;
    const plannedPct = a.duration <= 0 ? (dataDate >= bl.ef ? 100 : 0) : Math.max(0, Math.min(100, (elapsed / a.duration) * 100));
    return {
      ...c,
      baselineStart: bl.es,
      baselineFinish: bl.ef,
      wbs: a.wbs,
      nameEn: a.nameEn,
      cost: a.cost,
      manHours: a.manHours,
      roc: a.roc,
      physicalPct: prog.physicalPct,
      blockedSteps: prog.blockedSteps,
      weight: weights[a.id] ?? 0,
      plannedPct: Math.round(plannedPct * 10) / 10,
    };
  });

  /* جمع‌بندی سلسله‌مراتبی: فعالیت → بسته WBS → پروژه */
  const wbsRollup = PEX_WBS.map((w) => {
    const kids = rows.filter((r) => r.wbs === w.id);
    const kidWeights = Object.fromEntries(kids.map((k) => [k.id, k.weight]));
    return {
      ...w,
      weight: kids.reduce((s, k) => s + k.weight, 0),
      actualPct: rollUp(kids.map((k) => ({ id: k.id, percent: k.physicalPct })), kidWeights),
      plannedPct: rollUp(kids.map((k) => ({ id: k.id, percent: k.plannedPct })), kidWeights),
      count: kids.length,
    };
  });
  const overallPct = rows.reduce((s, r) => s + r.weight * r.physicalPct, 0);
  const plannedPct = plannedPercentAt(PEX_SCURVE, dataDate);
  const variance = progressVariance(overallPct, plannedPct);

  /* مایلستون: پیش‌بینی = EF فعالیت راننده در CPM */
  const milestones: MilestoneRow[] = PEX_MILESTONES.map((m) => {
    const driver = cpmById[m.driverActivity];
    const ms: Milestone = {
      ...m,
      forecastDate: m.actualDate ?? driver?.ef ?? m.forecastDate,
      totalFloat: driver?.totalFloat,
    };
    const pen = milestonePenalty(ms, dataDate);
    return {
      ...ms,
      nameEn: m.nameEn,
      driverActivity: m.driverActivity,
      status: milestoneStatus(ms, dataDate),
      slipDays: workingDaysBetween(m.baselineDate ?? m.contractualDate, ms.forecastDate) - 1,
      penalty: pen.penalty,
      bonus: pen.bonus,
      escalation: escalationLevel(pen.days),
    };
  });

  const dcma = dcma14({
    cpm,
    rels: PEX_RELATIONS,
    dataDate,
    baselineCpLength: baseline.cpLengthDays,
    baselineCompletedByDataDate: rows.filter((r) => r.ef <= dataDate).length,
    actuallyCompleted: rows.filter((r) => r.physicalPct >= 100).length,
    hardConstraintCount: PEX_ACTIVITIES.filter((a) => a.constraintStart || a.constraintFinish).length,
  });

  const snapshot = cpSnapshot(cpm, baseline.cpLengthDays, baseline.projectFinish, dcma.healthScore, dataDate);
  const cfg = DEFAULT_NEAR_CRITICAL;
  const alerts: PexAlert[] = [
    ...cpAlerts(cpm, snapshot, {}, cpm.criticalPath, cfg, []),
    ...milestoneAlerts(milestones, dataDate),
  ];

  const nearCritical = rows
    .filter((r) => !r.critical && r.totalFloat <= cfg.warn)
    .sort((a, b) => a.totalFloat - b.totalFloat);

  const committed = PEX_COMMITMENTS.reduce((s, c) => s + c.committed, 0);
  const completed = PEX_COMMITMENTS.reduce((s, c) => s + c.completed, 0);

  const rocIssues = Object.entries(PEX_ROC)
    .map(([code, r]) => ({ code, ...validateRoc(r.steps) }))
    .filter((x) => !x.ok);

  const openPeriod = PEX_PERIODS.find((p) => !p.closedAt) ?? PEX_PERIODS[PEX_PERIODS.length - 1];

  return {
    project: PEX_PROJECT,
    dataDate,
    baseline,
    cpm,
    rows,
    wbsRollup,
    overallPct: Math.round(overallPct * 10) / 10,
    plannedPct: Math.round(plannedPct * 10) / 10,
    variance,
    milestones,
    dcma,
    snapshot,
    alerts,
    nearCritical,
    ppcPct: ppc(committed, completed),
    commitments: PEX_COMMITMENTS,
    periods: PEX_PERIODS,
    openPeriod,
    roc: PEX_ROC,
    rocIssues,
    weightMode,
    totalPenalty: milestones.reduce((s, m) => s + m.penalty, 0),
    blockedCount: rows.reduce((s, r) => s + r.blockedSteps.length, 0),
  };
}
