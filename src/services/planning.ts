/**
 * PEX — موتور برنامه‌ریزی و اجرای عملیات (d2).
 * مبنای طراحی: docs/PEX_D4_Schedule_CPM.md · D5 Milestone · D6 Critical Path · D10 PMS · PEX_ROC_LIBRARY.md
 * قواعد: تقویم‌آگاه · Baseline قفل (تغییر فقط با CR) · فقط پیشرفت Approved وارد EV می‌شود ·
 * گام دارای بازرسی بدون IR تأییدشده صفر حساب می‌شود · PEX هزینه واقعی (AC) نمی‌نویسد.
 */

export const PEX_FORMULA_VERSION = "pex-v1";
const DAY = 86_400_000;

/* ══════════════════════════ تقویم کاری ══════════════════════════ */

export type WorkCalendar = {
  /** روزهای کاری هفته؛ ۰=یکشنبه … ۶=شنبه (پیش‌فرض ایران: شنبه تا چهارشنبه + پنجشنبه) */
  workDays: number[];
  /** تعطیلات رسمی به‌صورت ISO */
  holidays: string[];
};

export const IRAN_CALENDAR: WorkCalendar = {
  workDays: [6, 0, 1, 2, 3, 4], // شنبه تا پنجشنبه؛ جمعه تعطیل
  holidays: [],
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T00:00:00Z");

export function isWorkingDay(dateIso: string, cal: WorkCalendar = IRAN_CALENDAR): boolean {
  if (cal.holidays.includes(dateIso)) return false;
  return cal.workDays.includes(parse(dateIso).getUTCDay());
}

/** نخستین روز کاری از تاریخ داده‌شده به بعد. */
export function nextWorkingDay(dateIso: string, cal: WorkCalendar = IRAN_CALENDAR): string {
  const d = parse(dateIso);
  for (let i = 0; i < 400; i++) {
    const s = iso(d);
    if (isWorkingDay(s, cal)) return s;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dateIso;
}

/** جمع روز کاری (مثبت یا منفی) روی تاریخ؛ خودِ روز مبدأ شمرده نمی‌شود. */
export function addWorkingDays(dateIso: string, days: number, cal: WorkCalendar = IRAN_CALENDAR): string {
  const step = days >= 0 ? 1 : -1;
  let remaining = Math.abs(days);
  const d = parse(dateIso);
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + step);
    if (isWorkingDay(iso(d), cal)) remaining--;
  }
  return iso(d);
}

/** تعداد روز کاری بین دو تاریخ (شامل هر دو سر). */
export function workingDaysBetween(fromIso: string, toIso: string, cal: WorkCalendar = IRAN_CALENDAR): number {
  if (Date.parse(toIso) < Date.parse(fromIso)) return -workingDaysBetween(toIso, fromIso, cal);
  let n = 0;
  const d = parse(fromIso);
  while (iso(d) <= toIso) {
    if (isWorkingDay(iso(d), cal)) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}

/* ══════════════════════════ CPM ══════════════════════════ */

export type RelType = "FS" | "SS" | "FF" | "SF";

export type Relation = { pred: string; succ: string; type: RelType; lag?: number };

export type Activity = {
  id: string;
  nameFa: string;
  duration: number; // روز کاری؛ ۰ = مایلستون
  /** مدت باقی‌مانده برای فعالیت در جریان؛ پیش‌فرض = duration */
  remainingDuration?: number;
  isMilestone?: boolean;
  constraintStart?: string; // SNET — زودتر از این تاریخ شروع نشود
  constraintFinish?: string; // FNLT — دیرتر از این تاریخ تمام نشود
  actualStart?: string;
  actualFinish?: string;
  resourceIds?: string[];
  baselineStart?: string;
  baselineFinish?: string;
};

export type CpmActivity = Activity & {
  es: string;
  ef: string;
  ls: string;
  lf: string;
  totalFloat: number;
  freeFloat: number;
  critical: boolean;
};

export type CpmResult = {
  activities: CpmActivity[];
  projectStart: string;
  projectFinish: string;
  cpLengthDays: number;
  criticalPath: string[];
  formulaVersion: string;
};

export class CpmCycleError extends Error {
  edges: Relation[];
  constructor(edges: Relation[]) {
    super(`CPM_CYCLE: ${edges.map((e) => `${e.pred}→${e.succ}`).join(", ")}`);
    this.name = "CpmCycleError";
    this.edges = edges;
  }
}

/** ترتیب توپولوژیک (Kahn)؛ در صورت حلقه CpmCycleError پرتاب می‌شود. */
export function topoSort(activities: Activity[], rels: Relation[]): string[] {
  const indeg: Record<string, number> = {};
  const out: Record<string, string[]> = {};
  for (const a of activities) {
    indeg[a.id] ??= 0;
    out[a.id] ??= [];
  }
  for (const r of rels) {
    if (!(r.pred in indeg) || !(r.succ in indeg)) continue;
    out[r.pred].push(r.succ);
    indeg[r.succ]++;
  }
  const queue = Object.keys(indeg).filter((k) => indeg[k] === 0);
  const order: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    order.push(n);
    for (const m of out[n]) if (--indeg[m] === 0) queue.push(m);
  }
  if (order.length !== activities.length) {
    const stuck = new Set(Object.keys(indeg).filter((k) => !order.includes(k)));
    throw new CpmCycleError(rels.filter((r) => stuck.has(r.pred) && stuck.has(r.succ)));
  }
  return order;
}

/**
 * محاسبه CPM تقویم‌آگاه با چهار نوع رابطه و Lag روز کاری.
 * شناوری کل = LS − ES · بحرانی = شناوری کل ≤ ۰ و فعالیت هنوز تمام نشده باشد.
 * وضعیت پیشرفت (Progress Override): فعالیت خاتمه‌یافته با تاریخ واقعی قفل می‌شود،
 * فعالیت در جریان از Data Date با مدت باقی‌مانده جلو می‌رود و فعالیت شروع‌نشده
 * زودتر از Data Date برنامه‌ریزی نمی‌شود.
 */
export function computeCpm(
  activities: Activity[],
  rels: Relation[],
  dataDate: string,
  cal: WorkCalendar = IRAN_CALENDAR
): CpmResult {
  const order = topoSort(activities, rels);
  const byId: Record<string, Activity> = Object.fromEntries(activities.map((a) => [a.id, a]));
  const preds: Record<string, Relation[]> = {};
  const succs: Record<string, Relation[]> = {};
  for (const r of rels) {
    (preds[r.succ] ??= []).push(r);
    (succs[r.pred] ??= []).push(r);
  }

  const es: Record<string, string> = {};
  const ef: Record<string, string> = {};
  /** مدت مؤثر: خاتمه‌یافته = طول واقعی · در جریان = باقی‌مانده · وگرنه مدت برنامه‌ای. */
  const durOf = (id: string) => {
    const a = byId[id];
    if (a.actualFinish) return workingDaysBetween(a.actualStart ?? a.actualFinish, a.actualFinish, cal);
    if (a.actualStart) return Math.max(0, a.remainingDuration ?? a.duration);
    return a.duration;
  };
  const finishOf = (id: string, start: string) => {
    const dur = durOf(id);
    return dur <= 0 ? start : addWorkingDays(start, dur - 1, cal);
  };
  const startOf = (id: string, finish: string) => {
    const dur = durOf(id);
    return dur <= 0 ? finish : addWorkingDays(finish, -(dur - 1), cal);
  };

  /* گذر رو به جلو */
  for (const id of order) {
    const a = byId[id];
    const base = nextWorkingDay(a.constraintStart && a.constraintStart > dataDate ? a.constraintStart : dataDate, cal);
    let start = base;
    let finish: string | null = null;
    for (const r of preds[id] ?? []) {
      const lag = r.lag ?? 0;
      /* Progress Override: فعالیتی که واقعاً شروع شده، دیگر منتظر قید شروع پیش‌نیاز نمی‌ماند. */
      if (a.actualStart && (r.type === "FS" || r.type === "SS")) continue;
      if (r.type === "FS") start = maxIso(start, addWorkingDays(ef[r.pred], 1 + lag, cal));
      else if (r.type === "SS") start = maxIso(start, addWorkingDays(es[r.pred], lag, cal));
      else if (r.type === "FF") finish = maxIso(finish ?? "", addWorkingDays(ef[r.pred], lag, cal));
      else if (r.type === "SF") finish = maxIso(finish ?? "", addWorkingDays(es[r.pred], lag, cal));
    }
    if (finish) {
      const impliedStart = startOf(id, finish);
      start = maxIso(start, impliedStart);
    }
    if (a.actualFinish) {
      /* خاتمه‌یافته: تاریخ‌های واقعی قفل‌اند. */
      es[id] = a.actualStart ?? start;
      ef[id] = a.actualFinish;
    } else if (a.actualStart) {
      /* در جریان (Retained Logic): باقی‌مانده کار از Data Date یا از پایان پیش‌نیازها — هر کدام دیرتر — ادامه می‌یابد. */
      const resume = maxIso(start, nextWorkingDay(dataDate, cal));
      es[id] = nextWorkingDay(a.actualStart, cal);
      ef[id] = durOf(id) <= 0 ? resume : addWorkingDays(resume, durOf(id) - 1, cal);
    } else {
      es[id] = start;
      ef[id] = finishOf(id, start);
    }
  }

  const projectFinish = order.reduce((mx, id) => maxIso(mx, ef[id]), order.length ? ef[order[0]] : dataDate);
  const projectStart = order.reduce((mn, id) => minIso(mn, es[id]), order.length ? es[order[0]] : dataDate);

  /* گذر رو به عقب */
  const lf: Record<string, string> = {};
  const ls: Record<string, string> = {};
  const lateFloor = nextWorkingDay(dataDate, cal);
  for (const id of [...order].reverse()) {
    let finish = projectFinish;
    for (const r of succs[id] ?? []) {
      /* قرینه Progress Override: جانشین خاتمه‌یافته یا شروع‌شده قید شروع را ارضا کرده است. */
      if (byId[r.succ].actualFinish) continue;
      if (byId[r.succ].actualStart && (r.type === "FS" || r.type === "SS")) continue;
      const lag = r.lag ?? 0;
      if (r.type === "FS") finish = minIso(finish, addWorkingDays(ls[r.succ], -(1 + lag), cal));
      else if (r.type === "FF") finish = minIso(finish, addWorkingDays(lf[r.succ], -lag, cal));
      else if (r.type === "SS") finish = minIso(finish, finishOf(id, addWorkingDays(ls[r.succ], -lag, cal)));
      else if (r.type === "SF") finish = minIso(finish, finishOf(id, addWorkingDays(lf[r.succ], -lag, cal)));
    }
    lf[id] = finish;
    ls[id] = startOf(id, finish);
    /* تاریخ دیر هیچ کار ناتمامی نمی‌تواند پیش از Data Date باشد. */
    if (!byId[id].actualFinish && ls[id] < lateFloor) {
      ls[id] = lateFloor;
      lf[id] = finishOf(id, lateFloor);
    }
  }

  const out: CpmActivity[] = activities.map((a) => {
    /* شناوری کل از LF − EF گرفته می‌شود تا برای فعالیت در جریان (که ES آن در گذشته قفل است) نیز معتبر بماند. */
    const tf = lf[a.id] >= ef[a.id]
      ? workingDaysBetween(ef[a.id], lf[a.id], cal) - 1
      : workingDaysBetween(ef[a.id], lf[a.id], cal) + 1;
    const succRels = succs[a.id] ?? [];
    /* شناوری آزاد: فاصله روز کاری میان پایان این فعالیت و شروع نزدیک‌ترین جانشین.
       شروع در نخستین روز کاری پس از EF یعنی شناوری صفر. */
    const ff = succRels.length
      ? Math.min(...succRels.map((r) => workingDaysBetween(ef[a.id], es[r.succ], cal) - 2))
      : tf;
    return {
      ...a,
      es: es[a.id],
      ef: ef[a.id],
      ls: ls[a.id],
      lf: lf[a.id],
      totalFloat: tf,
      freeFloat: Math.max(0, ff),
      critical: tf <= 0 && !a.actualFinish,
    };
  });

  return {
    activities: out,
    projectStart,
    projectFinish,
    cpLengthDays: workingDaysBetween(projectStart, projectFinish, cal),
    criticalPath: out.filter((a) => a.critical).map((a) => a.id),
    formulaVersion: PEX_FORMULA_VERSION,
  };
}

const maxIso = (a: string, b: string) => (!a ? b : !b ? a : a >= b ? a : b);
const minIso = (a: string, b: string) => (!a ? b : !b ? a : a <= b ? a : b);

/* ══════════════════════════ پایش مسیر بحرانی ══════════════════════════ */

export type NearCriticalConfig = { warn: number; crit: number; emerg: number; driftWarn: number; driftCrit: number };
export const DEFAULT_NEAR_CRITICAL: NearCriticalConfig = { warn: 10, crit: 5, emerg: 0, driftWarn: 5, driftCrit: 10 };

export type CpSnapshot = {
  dataDate: string;
  cpLengthDays: number;
  baselineCpLengthDays: number;
  drift: number;
  endDate: string;
  baselineEndDate: string;
  healthScore: number;
};

export function cpSnapshot(cpm: CpmResult, baselineLength: number, baselineEnd: string, healthScore: number, dataDate: string): CpSnapshot {
  return {
    dataDate,
    cpLengthDays: cpm.cpLengthDays,
    baselineCpLengthDays: baselineLength,
    drift: cpm.cpLengthDays - baselineLength,
    endDate: cpm.projectFinish,
    baselineEndDate: baselineEnd,
    healthScore,
  };
}

export type PexAlert = { code: string; type: string; severity: "warning" | "critical" | "emergency"; message: string; refId?: string };

/** ۹ قاعده هشدار مسیر بحرانی (D6). */
export function cpAlerts(
  cpm: CpmResult,
  snap: CpSnapshot,
  prevFloat: Record<string, number> = {},
  prevCritical: string[] = [],
  cfg: NearCriticalConfig = DEFAULT_NEAR_CRITICAL,
  contractualMilestoneIds: string[] = []
): PexAlert[] {
  const alerts: PexAlert[] = [];
  for (const a of cpm.activities) {
    if (a.totalFloat < 0) alerts.push({ code: "CP-R1", type: "FloatNegative", severity: "critical", message: `شناوری منفی ${a.totalFloat} روز`, refId: a.id });
    const prev = prevFloat[a.id];
    if (prev !== undefined && a.totalFloat - prev < -cfg.driftWarn)
      alerts.push({ code: "CP-R2", type: "FloatDecreasing", severity: "warning", message: `افت شناوری ${prev} ← ${a.totalFloat}`, refId: a.id });
    if (a.critical && prevCritical.length && !prevCritical.includes(a.id))
      alerts.push({ code: "CP-R4", type: "NewCritical", severity: "warning", message: "ورود فعالیت جدید به مسیر بحرانی", refId: a.id });
    if (!a.critical && a.totalFloat <= cfg.warn && a.totalFloat > cfg.crit)
      alerts.push({ code: "CP-R7", type: "NearCritical", severity: "warning", message: `نزدیک بحرانی (TF=${a.totalFloat})`, refId: a.id });
    if (!a.critical && a.totalFloat <= cfg.crit)
      alerts.push({ code: "CP-R8", type: "NearEscalation", severity: "critical", message: `تشدید نزدیک‌بحرانی (TF=${a.totalFloat})`, refId: a.id });
    if (contractualMilestoneIds.includes(a.id) && a.critical && a.totalFloat < 0)
      alerts.push({ code: "CP-R9", type: "MilestoneEmergency", severity: "emergency", message: "مایلستون قراردادی روی مسیر بحرانی با شناوری منفی", refId: a.id });
  }
  if (snap.drift > cfg.driftCrit) alerts.push({ code: "CP-R3", type: "CPDrift", severity: "critical", message: `رانش مسیر بحرانی ${snap.drift} روز` });
  else if (snap.drift > cfg.driftWarn) alerts.push({ code: "CP-R3", type: "CPDrift", severity: "warning", message: `رانش مسیر بحرانی ${snap.drift} روز` });
  if (snap.endDate > snap.baselineEndDate) alerts.push({ code: "CP-R5", type: "EndDateSlip", severity: "critical", message: `لغزش تاریخ پایان تا ${snap.endDate}` });
  if (snap.healthScore < 80) alerts.push({ code: "CP-R6", type: "HealthDrop", severity: "warning", message: `سلامت زمان‌بندی ${snap.healthScore}` });
  return alerts;
}

/* ─────────────── DCMA 14-Point ─────────────── */

export type DcmaInput = {
  cpm: CpmResult;
  rels: Relation[];
  dataDate: string;
  baselineCpLength: number;
  baselineCompletedByDataDate: number;
  actuallyCompleted: number;
  hardConstraintCount: number;
};

export type DcmaCheck = {
  id: number;
  nameFa: string;
  value: number;
  pass: boolean;
  /**
   * واحد مقدار.
   *
   * بدون این، «۳» در آزمون ۱ یعنی سه درصد و «۳» در آزمون ۲ یعنی سه
   * رابطه، ولی هر دو یکسان چاپ می‌شدند. خواننده راهی نداشت بفهمد کدام
   * است و عدد بی‌معنا می‌شد.
   */
  unit: "pct" | "count" | "ratio";
  /** شرط قبولی به زبان خوانا — مبنای داوری باید دیده شود. */
  thresholdFa: string;
  thresholdEn: string;
};

/** چهارده آزمون DCMA؛ HealthScore = میانگین امتیاز آزمون‌ها. */
export function dcma14(input: DcmaInput): { checks: DcmaCheck[]; healthScore: number } {
  const { cpm, rels, dataDate, baselineCpLength, baselineCompletedByDataDate, actuallyCompleted, hardConstraintCount } = input;
  const acts = cpm.activities;
  const n = acts.length || 1;
  const withPred = new Set(rels.map((r) => r.succ));
  const withSucc = new Set(rels.map((r) => r.pred));

  const missingLogic = acts.filter((a) => !withPred.has(a.id) && !withSucc.has(a.id)).length;
  const leads = rels.filter((r) => (r.lag ?? 0) < 0).length;
  const highFloat = acts.filter((a) => a.totalFloat > 44).length;
  const highDuration = acts.filter((a) => a.duration > 44).length;
  const lags = rels.filter((r) => (r.lag ?? 0) > 0).length;
  const density = rels.length / n;
  const invalidDates = acts.filter((a) => (a.actualFinish && a.actualFinish > dataDate) || (a.actualStart && a.actualStart > dataDate)).length;
  const cpNoResource = acts.filter((a) => a.critical && !(a.resourceIds?.length)).length;
  const missedTasks = acts.filter((a) => a.baselineFinish && a.baselineFinish < dataDate && !a.actualFinish).length;
  const cpli = cpm.cpLengthDays > 0 ? baselineCpLength / cpm.cpLengthDays : 1;
  const bei = baselineCompletedByDataDate > 0 ? actuallyCompleted / baselineCompletedByDataDate : 1;
  const hasCriticalPath = acts.some((a) => a.totalFloat <= 0);
  const buckets: Record<string, number> = {};
  for (const a of acts) {
    const k = String(Math.floor(a.totalFloat / 10));
    buckets[k] = (buckets[k] ?? 0) + 1;
  }
  const maxBucket = Math.max(0, ...Object.values(buckets));

  const pct = (x: number) => (x / n) * 100;
  const checks: DcmaCheck[] = [
    { id: 1, nameFa: "منطق ناقص", value: pct(missingLogic), pass: pct(missingLogic) <= 5, unit: "pct", thresholdFa: "حداکثر ۵٪", thresholdEn: "max 5%" },
    { id: 2, nameFa: "لگ منفی (Lead)", value: leads, pass: leads === 0, unit: "count", thresholdFa: "باید صفر باشد", thresholdEn: "must be 0" },
    { id: 3, nameFa: "شناوری زیاد", value: pct(highFloat), pass: pct(highFloat) <= 5, unit: "pct", thresholdFa: "حداکثر ۵٪", thresholdEn: "max 5%" },
    { id: 4, nameFa: "مدت زیاد", value: pct(highDuration), pass: pct(highDuration) <= 5, unit: "pct", thresholdFa: "حداکثر ۵٪", thresholdEn: "max 5%" },
    { id: 5, nameFa: "قید سخت", value: pct(hardConstraintCount), pass: pct(hardConstraintCount) <= 10, unit: "pct", thresholdFa: "حداکثر ۱۰٪", thresholdEn: "max 10%" },
    { id: 6, nameFa: "چگالی روابط", value: Math.round(density * 100) / 100, pass: density >= 0.5 && density <= 2, unit: "ratio", thresholdFa: "بین ۰٫۵ تا ۲", thresholdEn: "0.5 – 2" },
    { id: 7, nameFa: "لگ‌ها", value: rels.length ? (lags / rels.length) * 100 : 0, pass: !rels.length || (lags / rels.length) * 100 <= 5, unit: "pct", thresholdFa: "حداکثر ۵٪", thresholdEn: "max 5%" },
    { id: 8, nameFa: "تاریخ نامعتبر", value: invalidDates, pass: invalidDates === 0, unit: "count", thresholdFa: "باید صفر باشد", thresholdEn: "must be 0" },
    { id: 9, nameFa: "منابع مسیر بحرانی", value: cpNoResource, pass: cpNoResource === 0, unit: "count", thresholdFa: "باید صفر باشد", thresholdEn: "must be 0" },
    { id: 10, nameFa: "کارهای عقب‌افتاده", value: pct(missedTasks), pass: pct(missedTasks) <= 5, unit: "pct", thresholdFa: "حداکثر ۵٪", thresholdEn: "max 5%" },
    { id: 11, nameFa: "CPLI", value: Math.round(cpli * 100) / 100, pass: cpli >= 0.95, unit: "ratio", thresholdFa: "حداقل ۰٫۹۵", thresholdEn: "min 0.95" },
    { id: 12, nameFa: "BEI", value: Math.round(bei * 100) / 100, pass: bei >= 0.95, unit: "ratio", thresholdFa: "حداقل ۰٫۹۵", thresholdEn: "min 0.95" },
    { id: 13, nameFa: "وجود مسیر بحرانی", value: hasCriticalPath ? 1 : 0, pass: hasCriticalPath, unit: "count", thresholdFa: "باید وجود داشته باشد", thresholdEn: "must exist" },
    { id: 14, nameFa: "توزیع شناوری", value: pct(maxBucket), pass: pct(maxBucket) <= 40, unit: "pct", thresholdFa: "حداکثر ۴۰٪", thresholdEn: "max 40%" },
  ];
  return { checks, healthScore: Math.round((checks.filter((c) => c.pass).length / checks.length) * 100) };
}

/* ══════════════════════════ مایلستون ══════════════════════════ */

export type MilestoneStatus = "OnTrack" | "AtRisk" | "Delayed" | "Achieved" | "Cancelled";

export type Milestone = {
  id: string;
  nameFa: string;
  type: "Contractual" | "Key" | "Gate" | "Internal" | "Client";
  contractualDate: string;
  baselineDate: string;
  forecastDate: string; // = EF از CPM
  actualDate?: string;
  penaltyPerDay?: number;
  bonusPerDay?: number;
  totalFloat?: number;
  cancelled?: boolean;
  alertDaysBefore?: number[];
};

export function milestoneStatus(ms: Milestone, today: string): MilestoneStatus {
  if (ms.cancelled) return "Cancelled";
  if (ms.actualDate) return "Achieved";
  if (today > ms.contractualDate) return "Delayed";
  if (ms.forecastDate > ms.contractualDate || (ms.totalFloat !== undefined && ms.totalFloat < 0)) return "AtRisk";
  return "OnTrack";
}

/** جریمه/پاداش تجمعی بر مبنای تاریخ واقعی یا پیش‌بینی. */
export function milestonePenalty(ms: Milestone, today: string, cal: WorkCalendar = IRAN_CALENDAR): { days: number; penalty: number; bonus: number } {
  const effective = ms.actualDate ?? (today > ms.forecastDate ? today : ms.forecastDate);
  const days = workingDaysBetween(ms.contractualDate, effective, cal) - 1;
  if (days > 0) return { days, penalty: days * (ms.penaltyPerDay ?? 0), bonus: 0 };
  if (days < 0) return { days, penalty: 0, bonus: Math.abs(days) * (ms.bonusPerDay ?? 0) };
  return { days: 0, penalty: 0, bonus: 0 };
}

/** سطح تشدید بر مبنای روزهای تأخیر (D5). */
export function escalationLevel(daysLate: number): 0 | 1 | 2 | 3 {
  if (daysLate <= 0) return 0;
  if (daysLate < 3) return 1;
  if (daysLate < 7) return 2;
  return 3;
}

/** ۷ قاعده هشدار مایلستون (D5). */
export function milestoneAlerts(list: Milestone[], today: string, cal: WorkCalendar = IRAN_CALENDAR): PexAlert[] {
  const out: PexAlert[] = [];
  for (const ms of list) {
    const st = milestoneStatus(ms, today);
    if (st === "Achieved" || st === "Cancelled") continue;
    const daysToContract = workingDaysBetween(today, ms.contractualDate, cal) - 1;
    const { days, penalty } = milestonePenalty(ms, today, cal);

    if (st === "Delayed") out.push({ code: "MS-R1", type: "Delayed", severity: "critical", message: `تأخیر ${days} روز کاری`, refId: ms.id });
    if (st === "AtRisk") out.push({ code: "MS-R2", type: "AtRisk", severity: "warning", message: `پیش‌بینی ${ms.forecastDate} پس از تعهد ${ms.contractualDate}`, refId: ms.id });
    for (const d of ms.alertDaysBefore ?? [30, 14, 7, 3, 1])
      if (daysToContract === d) out.push({ code: "MS-R3", type: "Countdown", severity: d <= 3 ? "critical" : "warning", message: `${d} روز تا موعد قراردادی`, refId: ms.id });
    if (penalty > 0) out.push({ code: "MS-R4", type: "PenaltyAccruing", severity: "critical", message: `جریمه انباشته ${penalty.toLocaleString("en-US")}`, refId: ms.id });
    if (ms.totalFloat !== undefined && ms.totalFloat < 0) out.push({ code: "MS-R5", type: "NegativeFloat", severity: "critical", message: `شناوری منفی ${ms.totalFloat}`, refId: ms.id });
    if (ms.forecastDate > ms.baselineDate) out.push({ code: "MS-R6", type: "BaselineSlip", severity: "warning", message: `لغزش نسبت به برنامه پایه`, refId: ms.id });
    const level = escalationLevel(days);
    if (level >= 2) out.push({ code: "MS-R7", type: "Escalation", severity: level === 3 ? "emergency" : "critical", message: `تشدید سطح ${level}`, refId: ms.id });
  }
  return out;
}

/* ══════════════════════════ PMS — وزن و پیشرفت ══════════════════════════ */

export type WeightMode = "Cost" | "MH" | "Hybrid" | "BOQ" | "Manual";

export type WeightItem = { id: string; cost?: number; manHours?: number; boq?: number; manual?: number };

/** وزن‌دهی مرسوم ایران؛ Hybrid = α·هزینه + β·نفر-ساعت با α+β=۱ و نرمال‌سازی نهایی. */
export function computeWeights(items: WeightItem[], mode: WeightMode, alpha = 1): Record<string, number> {
  const share = (get: (i: WeightItem) => number) => {
    const total = items.reduce((s, i) => s + (get(i) || 0), 0);
    return items.map((i) => (total > 0 ? (get(i) || 0) / total : 1 / items.length));
  };
  let w: number[];
  if (mode === "Cost") w = share((i) => i.cost ?? 0);
  else if (mode === "MH") w = share((i) => i.manHours ?? 0);
  else if (mode === "BOQ") w = share((i) => i.boq ?? 0);
  else if (mode === "Manual") w = share((i) => i.manual ?? 0);
  else {
    const beta = 1 - alpha;
    const wc = share((i) => i.cost ?? 0);
    const wh = share((i) => i.manHours ?? 0);
    w = wc.map((x, k) => alpha * x + beta * wh[k]);
  }
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(items.map((it, k) => [it.id, w[k] / sum]));
}

export type RocStep = { code: string; nameFa: string; weight: number; ir?: boolean };

/** جمع وزن گام‌های یک دستور RoC باید ۱۰۰ باشد. */
export function validateRoc(steps: RocStep[]): { ok: boolean; sum: number } {
  const sum = steps.reduce((s, x) => s + x.weight, 0);
  return { ok: Math.abs(sum - 100) < 0.01, sum };
}

export type StepProgress = { code: string; percent: number; irApproved?: boolean };

/**
 * پیشرفت فیزیکی فعالیت از روی گام‌های RoC.
 * گام دارای بازرسی بدون IR تأییدشده صفر حساب می‌شود (فقط پیشرفت Approved وارد EV می‌شود).
 */
export function activityProgress(steps: RocStep[], progress: StepProgress[]): { physicalPct: number; blockedSteps: string[] } {
  const blocked: string[] = [];
  let acc = 0;
  for (const st of steps) {
    const p = progress.find((x) => x.code === st.code);
    if (!p) continue;
    if (st.ir && !p.irApproved) {
      if (p.percent > 0) blocked.push(st.code);
      continue;
    }
    acc += (st.weight * Math.min(100, Math.max(0, p.percent))) / 100;
  }
  return { physicalPct: Math.round(acc * 100) / 100, blockedSteps: blocked };
}

/** جمع‌بندی سلسله‌مراتبی: درصد والد = Σ (وزن فرزند × درصد فرزند). */
export function rollUp(children: { id: string; percent: number }[], weights: Record<string, number>): number {
  const total = children.reduce((s, c) => s + (weights[c.id] ?? 0), 0) || 1;
  return Math.round((children.reduce((s, c) => s + (weights[c.id] ?? 0) * c.percent, 0) / total) * 100) / 100;
}

export type Period = { code: string; from: string; to: string; closedAt?: string };

/** قفل دوره: پس از بستن، ثبت پیشرفت در آن بازه رد می‌شود. */
export function canPostProgress(period: Period, dateIso: string): { ok: boolean; reason?: string } {
  if (period.closedAt) return { ok: false, reason: "period_closed" };
  if (dateIso < period.from || dateIso > period.to) return { ok: false, reason: "out_of_period" };
  return { ok: true };
}

/** درصد برنامه‌ای در تاریخ گزارش از منحنی برنامه (خطی بین دوره‌ها). */
export function plannedPercentAt(curve: { date: string; cumPct: number }[], dataDate: string): number {
  if (!curve.length) return 0;
  const sorted = [...curve].sort((a, b) => a.date.localeCompare(b.date));
  if (dataDate <= sorted[0].date) return sorted[0].cumPct;
  const last = sorted[sorted.length - 1];
  if (dataDate >= last.date) return last.cumPct;
  for (let i = 1; i < sorted.length; i++) {
    if (dataDate <= sorted[i].date) {
      const a = sorted[i - 1];
      const b = sorted[i];
      const span = (Date.parse(b.date) - Date.parse(a.date)) / DAY || 1;
      const pos = (Date.parse(dataDate) - Date.parse(a.date)) / DAY;
      return Math.round((a.cumPct + ((b.cumPct - a.cumPct) * pos) / span) * 100) / 100;
    }
  }
  return last.cumPct;
}

/** انحراف پیشرفت: واقعی − برنامه‌ای (درصد مطلق). */
export function progressVariance(actualPct: number, plannedPct: number): { deltaPct: number; status: "ahead" | "on_track" | "behind" } {
  const d = Math.round((actualPct - plannedPct) * 100) / 100;
  return { deltaPct: d, status: d > 1 ? "ahead" : d < -1 ? "behind" : "on_track" };
}

/** درصد تحقق برنامه هفتگی (PPC) در Last Planner. */
export function ppc(committed: number, completed: number): number {
  return committed > 0 ? Math.round((completed / committed) * 1000) / 10 : 0;
}
