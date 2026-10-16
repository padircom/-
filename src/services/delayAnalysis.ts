/**
 * PMO Delay Analysis & Claims Engine — pure, testable services.
 *
 * Legal rules are versioned inputs, not hidden constants copied into UI.
 * A calculation is never presented as a final entitlement: `finalDays`
 * remains null until the rule version is marked approved by an expert.
 */
import { computeCpm, IRAN_CALENDAR, type Activity, type Relation, type WorkCalendar } from './planning';

export type RuleStatus = 'needs_review' | 'approved';
export type CalculationStatus = 'calculated' | 'needs_review' | 'not_applicable';

export const CIRCULAR_1300_RULE = {
  code: 'IR-CIRC-1300',
  version: '1360/09/02',
  source: 'بخشنامه ۱۳۰۰، پیرو بخشنامه شماره ۱-۱۱۰۸۲/۵۴/۵۰۹۰ مورخ ۱۳۶۰/۰۹/۰۲',
  numeratorDays: 20,
  denominatorDays: 30,
} as const;

export const CIRCULAR_5090_RULE = {
  code: 'IR-CIRC-5090',
  version: '1-11082-54-5090',
  source: 'بخشنامه نحوه محاسبه تأخیرات ناشی از تأخیر در پرداخت صورت‌وضعیت‌ها',
  interimFactor: 0.697,
  firstAdvanceFactor: 0.9,
  defaultContractPaymentDays: 10,
} as const;

export const DELAY_CATEGORIES = [
  'employer', 'contractor', 'neutral', 'change_order', 'procurement',
  'engineering_approval', 'payment', 'site_access', 'concurrent', 'unknown',
] as const;
export type DelayCategory = typeof DELAY_CATEGORIES[number];

const DAY_MS = 86_400_000;
function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
function addDays(day: string, days: number): string {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY_MS);
}
function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/* ═══════════════ Circular 1300 ═══════════════ */

export type Circular1300Input = {
  periodDays?: number;
  article37ExactlyComplied?: boolean;
  ruleVersion?: string;
  ruleStatus?: RuleStatus;
};

export type Circular1300Result = {
  status: CalculationStatus;
  applicable: boolean;
  ruleCode: string;
  ruleVersion: string;
  rawAllowedPaymentDays: number | null;
  finalAllowedPaymentDays: number | null;
  issues: string[];
};

export function calculateCircular1300(input: Circular1300Input): Circular1300Result {
  const ruleVersion = input.ruleVersion || CIRCULAR_1300_RULE.version;
  const base = { ruleCode: CIRCULAR_1300_RULE.code, ruleVersion };
  if (!positive(input.periodDays)) {
    return { ...base, status: 'needs_review', applicable: false, rawAllowedPaymentDays: null, finalAllowedPaymentDays: null, issues: ['مدت دوره کارکرد معتبر لازم است'] };
  }
  if (input.article37ExactlyComplied === undefined) {
    return { ...base, status: 'needs_review', applicable: false, rawAllowedPaymentDays: null, finalAllowedPaymentDays: null, issues: ['وضعیت رعایت دقیق ماده ۳۷ باید مشخص شود'] };
  }
  if (input.article37ExactlyComplied) {
    return { ...base, status: 'not_applicable', applicable: false, rawAllowedPaymentDays: null, finalAllowedPaymentDays: null, issues: ['ماده ۳۷ دقیقاً رعایت شده است؛ قاعده ۱۳۰۰ اعمال نمی‌شود'] };
  }
  if (input.periodDays <= CIRCULAR_1300_RULE.denominatorDays) {
    return { ...base, status: 'not_applicable', applicable: false, rawAllowedPaymentDays: null, finalAllowedPaymentDays: null, issues: ['دوره صورت‌وضعیت بیش از یک ماه نیست؛ شرط شمول ۱۳۰۰ احراز نشده است'] };
  }
  const raw = (input.periodDays * CIRCULAR_1300_RULE.numeratorDays) / CIRCULAR_1300_RULE.denominatorDays;
  const approved = input.ruleStatus === 'approved';
  return {
    ...base,
    status: approved ? 'calculated' : 'needs_review',
    applicable: true,
    rawAllowedPaymentDays: raw,
    finalAllowedPaymentDays: approved ? raw : null,
    issues: approved ? [] : ['قاعده محاسبه شده، اما نسخه ضابطه هنوز تأیید کارشناس ندارد'],
  };
}

/* ═══════════════ Circular 5090 ═══════════════ */

export type Circular5090Input = {
  statementKind: 'interim' | 'advance_first' | 'advance_subsequent';
  submittedAt?: string;
  actualPaidAt?: string;
  contractPaymentDays?: number;
  circular1300?: Circular1300Result;
  statementGrossAmount?: number;
  statementPeriodDays?: number;
  initialContractDurationDays?: number;
  initialContractAmount?: number;
  latestStatementCumulativeAmount?: number;
  latestStatementDate?: string;
  firstAdvanceReceivedDate?: string;
  ruleVersion?: string;
  ruleStatus?: RuleStatus;
};

export type Circular5090Result = {
  status: CalculationStatus;
  ruleCode: string;
  ruleVersion: string;
  contractPaymentDate: string | null;
  paymentDelayDays: number | null;
  rawExtensionDays: number | null;
  finalExtensionDays: number | null;
  formula: string | null;
  issues: string[];
};

export function calculateCircular5090(input: Circular5090Input): Circular5090Result {
  const ruleVersion = input.ruleVersion || CIRCULAR_5090_RULE.version;
  const base = { ruleCode: CIRCULAR_5090_RULE.code, ruleVersion };
  const issues: string[] = [];
  if (!isDay(input.submittedAt)) issues.push('تاریخ تسلیم صورت‌وضعیت معتبر لازم است');
  if (!isDay(input.actualPaidAt)) issues.push('تاریخ پرداخت واقعی معتبر لازم است');
  if (issues.length) return { ...base, status: 'needs_review', contractPaymentDate: null, paymentDelayDays: null, rawExtensionDays: null, finalExtensionDays: null, formula: null, issues };
  if (input.actualPaidAt! < input.submittedAt!) issues.push('تاریخ پرداخت واقعی نمی‌تواند پیش از تاریخ تسلیم باشد');

  let allowedDays = input.contractPaymentDays ?? CIRCULAR_5090_RULE.defaultContractPaymentDays;
  if (input.circular1300?.applicable) {
    if (input.circular1300.rawAllowedPaymentDays === null) issues.push('نتیجه بخشنامه ۱۳۰۰ کامل نیست');
    else allowedDays = input.circular1300.rawAllowedPaymentDays;
  }
  if (!positive(allowedDays) && allowedDays !== 0) issues.push('مدت مجاز پرداخت طبق پیمان معتبر نیست');
  if (issues.length) return { ...base, status: 'needs_review', contractPaymentDate: null, paymentDelayDays: null, rawExtensionDays: null, finalExtensionDays: null, formula: null, issues };

  const contractPaymentDate = addDays(input.submittedAt!, Math.floor(allowedDays));
  const paymentDelayDays = diffDays(contractPaymentDate, input.actualPaidAt!);
  const theta = Math.max(0, paymentDelayDays);
  let raw: number | null = null;
  let formula: string | null = null;

  if (input.statementKind === 'advance_first') {
    raw = CIRCULAR_5090_RULE.firstAdvanceFactor * theta;
    formula = 'τ = 0.9 × θ';
  } else if (input.statementKind === 'interim') {
    if (!positive(input.statementGrossAmount) || !positive(input.statementPeriodDays) || !positive(input.initialContractDurationDays) || !positive(input.initialContractAmount)) {
      issues.push('مبلغ صورت‌وضعیت، دوره آن، مدت اولیه پیمان و مبلغ اولیه پیمان لازم است');
    } else {
      raw = CIRCULAR_5090_RULE.interimFactor * theta * (input.statementGrossAmount / input.statementPeriodDays) * (input.initialContractDurationDays / input.initialContractAmount);
      formula = 'τ = 0.697 × θ × (A/t) × (T/P)';
    }
  } else {
    const elapsed = isDay(input.latestStatementDate) && isDay(input.firstAdvanceReceivedDate)
      ? diffDays(input.firstAdvanceReceivedDate, input.latestStatementDate)
      : null;
    if (!positive(input.latestStatementCumulativeAmount) || !positive(input.initialContractDurationDays) || !positive(input.initialContractAmount) || elapsed === null || elapsed <= 0) {
      issues.push('مبلغ تجمعی آخرین صورت‌وضعیت، مدت و مبلغ اولیه پیمان و بازه معتبر از اولین پیش‌پرداخت لازم است');
    } else {
      raw = theta * (input.initialContractDurationDays / input.initialContractAmount) * (input.latestStatementCumulativeAmount / elapsed);
      formula = 'τ = θ × (T/P) × (مبلغ تجمعی آخرین صورت‌وضعیت / بازه تا آخرین صورت‌وضعیت)';
    }
  }
  if (issues.length || raw === null) {
    return { ...base, status: 'needs_review', contractPaymentDate, paymentDelayDays, rawExtensionDays: raw, finalExtensionDays: null, formula, issues };
  }
  const approved = input.ruleStatus === 'approved';
  if (paymentDelayDays < 0) issues.push('پرداخت پیش از موعد انجام شده است؛ تمدید مثبت ایجاد نمی‌شود');
  if (!approved) issues.push('نتیجه خام محاسبه شده، اما نسخه ضابطه هنوز تأیید کارشناس ندارد');
  return {
    ...base,
    status: approved ? 'calculated' : 'needs_review',
    contractPaymentDate,
    paymentDelayDays,
    rawExtensionDays: raw,
    finalExtensionDays: approved ? raw : null,
    formula,
    issues,
  };
}

export function sumCircular5090Extensions(results: Circular5090Result[]): { rawExtensionDays: number; finalExtensionDays: number | null; status: CalculationStatus } {
  const raw = results.reduce((sum, r) => sum + (r.rawExtensionDays ?? 0), 0);
  const final = results.every(r => r.finalExtensionDays !== null) ? results.reduce((sum, r) => sum + (r.finalExtensionDays ?? 0), 0) : null;
  return { rawExtensionDays: raw, finalExtensionDays: final, status: final === null ? 'needs_review' : 'calculated' };
}

/* ═══════════════ Schedule delay analysis ═══════════════ */

export type DelayAnalysisMethod = 'as_planned_as_built' | 'impacted_as_planned' | 'time_impact_analysis' | 'windows' | 'collapsed_as_built';
export type DelayWindowSnapshot = {
  label: string;
  dataDate?: string;
  baselineActivities: Activity[];
  updatedActivities: Activity[];
};

export type DelayAnalysisInput = {
  method: DelayAnalysisMethod;
  baselineActivities: Activity[];
  updatedActivities?: Activity[];
  relations: Relation[];
  dataDate: string;
  calendar?: WorkCalendar;
  eventActivityIds?: string[];
  eventDelayDays?: number;
  windows?: DelayWindowSnapshot[];
};

export type DelayAnalysisResult = {
  status: CalculationStatus;
  method: DelayAnalysisMethod;
  baselineFinish: string | null;
  analysedFinish: string | null;
  completionShiftDays: number | null;
  baselineCriticalPath: string[];
  analysedCriticalPath: string[];
  criticalPathChanged: boolean;
  windowResults: { label: string; dataDate: string; baselineFinish: string; updatedFinish: string; shiftDays: number; criticalPathChanged: boolean }[];
  issues: string[];
  limitations: string[];
};

function validateNetwork(activities: Activity[], relations: Relation[], label: string, issues: string[]) {
  if (!activities.length) issues.push(`${label}: فعالیت زمان‌بندی وجود ندارد`);
  const ids = new Set<string>();
  for (const a of activities) {
    if (!a.id || ids.has(a.id)) issues.push(`${label}: شناسه فعالیت تکراری یا خالی است`);
    ids.add(a.id);
    if (!Number.isFinite(a.duration) || a.duration < 0) issues.push(`${label}: مدت فعالیت ${a.id} معتبر نیست`);
  }
  for (const r of relations) if (!ids.has(r.pred) || !ids.has(r.succ)) issues.push(`${label}: رابطه ${r.pred}→${r.succ} به فعالیت موجود وصل نیست`);
}
function shiftActivities(activities: Activity[], ids: string[], days: number): Activity[] {
  const wanted = new Set(ids);
  return activities.map(a => wanted.has(a.id) ? { ...a, duration: Math.max(0, a.duration + days), remainingDuration: Math.max(0, (a.remainingDuration ?? a.duration) + days) } : a);
}
function finishShift(a: string, b: string): number { return diffDays(a, b); }

export function analyseDelay(input: DelayAnalysisInput): DelayAnalysisResult {
  const issues: string[] = [];
  const limitations: string[] = [];
  const base: Omit<DelayAnalysisResult, 'status' | 'issues' | 'limitations'> = {
    method: input.method, baselineFinish: null, analysedFinish: null, completionShiftDays: null,
    baselineCriticalPath: [], analysedCriticalPath: [], criticalPathChanged: false, windowResults: [],
  };
  if (!isDay(input.dataDate)) issues.push('تاریخ وضعیت (Data Date) معتبر لازم است');
  if (input.method === 'windows') {
    if (!input.windows?.length) issues.push('برای Windows Analysis، Snapshot جداگانه هر پنجره لازم است');
    const labels = new Set<string>();
    let previousDataDate = '';
    for (const [index, window] of (input.windows ?? []).entries()) {
      const label = window.label?.trim() || `پنجره ${index + 1}`;
      if (!window.label?.trim() || labels.has(label)) issues.push(`Snapshot پنجره ${index + 1}: برچسب یکتا لازم است`);
      labels.add(label);
      const dataDate = window.dataDate ?? input.dataDate;
      if (!isDay(dataDate)) issues.push(`${label}: Data Date معتبر لازم است`);
      if (previousDataDate && dataDate < previousDataDate) issues.push(`${label}: ترتیب زمانی Snapshotها معتبر نیست`);
      previousDataDate = dataDate;
      validateNetwork(window.baselineActivities ?? [], input.relations, `${label} ـ مبنا`, issues);
      validateNetwork(window.updatedActivities ?? [], input.relations, `${label} ـ به‌روز`, issues);
    }
  } else {
    validateNetwork(input.baselineActivities, input.relations, 'برنامه مبنا', issues);
    if (input.updatedActivities && ['as_planned_as_built', 'time_impact_analysis', 'collapsed_as_built'].includes(input.method)) validateNetwork(input.updatedActivities, input.relations, 'برنامه به‌روز', issues);
  }
  const eventIds = input.eventActivityIds ?? [];
  if (['impacted_as_planned', 'time_impact_analysis', 'collapsed_as_built'].includes(input.method)) {
    if (!eventIds.length) issues.push('فعالیت‌های متأثر از رویداد باید مشخص شوند');
    if (!positive(input.eventDelayDays) && input.eventDelayDays !== 0) issues.push('مدت اثر رویداد معتبر لازم است');
  }
  if (issues.length) return { ...base, status: 'needs_review', issues, limitations };

  const calendar = input.calendar ?? IRAN_CALENDAR;
  try {
    if (input.method === 'windows') {
      const windowResults = (input.windows ?? []).map(window => {
        const dataDate = window.dataDate ?? input.dataDate;
        const beforeWindow = computeCpm(window.baselineActivities.map(({ actualStart: _s, actualFinish: _f, ...a }) => a), input.relations, dataDate, calendar);
        const afterWindow = computeCpm(window.updatedActivities, input.relations, dataDate, calendar);
        return { label: window.label, dataDate, baselineFinish: beforeWindow.projectFinish, updatedFinish: afterWindow.projectFinish, shiftDays: finishShift(beforeWindow.projectFinish, afterWindow.projectFinish), criticalPathChanged: beforeWindow.criticalPath.join('|') !== afterWindow.criticalPath.join('|') };
      });
      const lastWindow = (input.windows ?? [])[windowResults.length - 1];
      const lastResult = windowResults[windowResults.length - 1];
      limitations.push('Windows فقط بر اساس Snapshotهای صریح ارسالی محاسبه شده است؛ Snapshotها تجمعی‌اند و اثر نهایی از مقایسهٔ مبنا و به‌روز در آخرین پنجره خوانده می‌شود');
      return { ...base, status: 'calculated', baselineFinish: lastResult.baselineFinish, analysedFinish: lastResult.updatedFinish, completionShiftDays: lastResult.shiftDays, baselineCriticalPath: computeCpm(lastWindow.baselineActivities.map(({ actualStart: _s, actualFinish: _f, ...a }) => a), input.relations, lastResult.dataDate, calendar).criticalPath, analysedCriticalPath: computeCpm(lastWindow.updatedActivities, input.relations, lastResult.dataDate, calendar).criticalPath, criticalPathChanged: lastResult.criticalPathChanged, windowResults, issues: [], limitations };
    }

    const baselinePlain = input.baselineActivities.map(({ actualStart: _s, actualFinish: _f, ...a }) => a);
    const baseline = computeCpm(baselinePlain, input.relations, input.dataDate, calendar);
    let analysedActivities: Activity[];
    if (input.method === 'as_planned_as_built') {
      if (!input.updatedActivities) return { ...base, status: 'needs_review', issues: ['نسخه واقعی/به‌روز برنامه برای As-Planned vs As-Built لازم است'], limitations };
      analysedActivities = input.updatedActivities;
    } else if (input.method === 'impacted_as_planned') {
      analysedActivities = shiftActivities(baselinePlain, eventIds, input.eventDelayDays ?? 0);
      limitations.push('Impacted As-Planned اثر رویداد را به‌صورت افزایش مدت فعالیت‌های انتخاب‌شده مدل می‌کند؛ Fragnet مستقل در این نسخه ساخته نمی‌شود');
    } else if (input.method === 'time_impact_analysis') {
      if (!input.updatedActivities) return { ...base, status: 'needs_review', issues: ['برنامه به‌روز در Data Date برای TIA لازم است'], limitations };
      analysedActivities = shiftActivities(input.updatedActivities, eventIds, input.eventDelayDays ?? 0);
    } else {
      if (!input.updatedActivities) return { ...base, status: 'needs_review', issues: ['برنامه As-Built برای Collapsed As-Built لازم است'], limitations };
      analysedActivities = shiftActivities(input.updatedActivities, eventIds, -(input.eventDelayDays ?? 0));
      limitations.push('Collapsed As-Built فقط مدت فعالیت‌های انتخاب‌شده را حذف می‌کند و جایگزین بازسازی کامل منطق As-Built نیست');
    }
    const analysed = computeCpm(analysedActivities, input.relations, input.dataDate, calendar);
    const reference = input.method === 'time_impact_analysis' || input.method === 'collapsed_as_built'
      ? computeCpm(input.updatedActivities ?? analysedActivities, input.relations, input.dataDate, calendar)
      : baseline;
    return {
      ...base,
      status: 'calculated',
      baselineFinish: reference.projectFinish,
      analysedFinish: analysed.projectFinish,
      completionShiftDays: finishShift(reference.projectFinish, analysed.projectFinish),
      baselineCriticalPath: reference.criticalPath,
      analysedCriticalPath: analysed.criticalPath,
      criticalPathChanged: reference.criticalPath.join('|') !== analysed.criticalPath.join('|'),
      issues: [],
      limitations,
    };
  } catch (err) {
    return { ...base, status: 'needs_review', issues: [`شبکه برنامه قابل محاسبه نیست: ${err instanceof Error ? err.message : String(err)}`], limitations };
  }
}

export type DelayParty = 'employer' | 'contractor' | 'concurrent' | 'other';
export function delayPartyOf(category: unknown): DelayParty {
  if (category === 'employer') return 'employer';
  if (category === 'contractor') return 'contractor';
  if (category === 'concurrent') return 'concurrent';
  return 'other';
}
export const DELAY_PARTY_COLORS: Record<DelayParty, string> = { employer: '#2563eb', contractor: '#dc2626', concurrent: '#7c3aed', other: '#64748b' };

export type ConcurrencyBar = { code: string; title: string; party: DelayParty; color: string; startDate: string; finishDate: string; leftPct: number; widthPct: number; critical: boolean };
export type ConcurrencyTimeline = { minDate: string | null; maxDate: string | null; bars: ConcurrencyBar[]; overlaps: { aCode: string; bCode: string; from: string; to: string; leftPct: number; widthPct: number }[] };
type TimelineEvent = { Code?: unknown; TitleFa?: unknown; Category?: unknown; StartDate?: unknown; FinishDate?: unknown; IsCritical?: unknown };

/** Timeline هم‌زمانی: جای هر رویداد روی محور زمان + بازه‌های هم‌پوشانی کارفرما/پیمانکار. */
export function buildConcurrencyTimeline(events: TimelineEvent[]): ConcurrencyTimeline {
  const valid = events
    .map(e => ({ code: String(e.Code ?? ''), title: String(e.TitleFa ?? ''), party: delayPartyOf(e.Category), startDate: String(e.StartDate ?? '').slice(0, 10), finishDate: String(e.FinishDate ?? '').slice(0, 10), critical: e.IsCritical === true || e.IsCritical === 1 || e.IsCritical === '1' }))
    .filter(e => isDay(e.startDate) && isDay(e.finishDate) && e.startDate <= e.finishDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.code.localeCompare(b.code));
  if (!valid.length) return { minDate: null, maxDate: null, bars: [], overlaps: [] };
  const minDate = valid[0].startDate;
  const maxDate = valid.reduce((m, e) => (e.finishDate > m ? e.finishDate : m), valid[0].finishDate);
  const span = Math.max(1, diffDays(minDate, maxDate) + 1);
  const pct = (day: string, inclusiveEnd = false) => Math.min(100, Math.max(0, ((diffDays(minDate, day) + (inclusiveEnd ? 1 : 0)) / span) * 100));
  const bars: ConcurrencyBar[] = valid.map(e => ({ code: e.code, title: e.title, party: e.party, color: DELAY_PARTY_COLORS[e.party], startDate: e.startDate, finishDate: e.finishDate, leftPct: pct(e.startDate), widthPct: Math.max(1.5, pct(e.finishDate, true) - pct(e.startDate)), critical: e.critical }));
  const overlaps: ConcurrencyTimeline['overlaps'] = [];
  for (let i = 0; i < valid.length; i++) for (let j = i + 1; j < valid.length; j++) {
    const a = valid[i]; const b = valid[j];
    const parties = new Set([a.party, b.party]);
    if (!(parties.has('employer') && parties.has('contractor')) && !parties.has('concurrent')) continue;
    const from = a.startDate > b.startDate ? a.startDate : b.startDate;
    const to = a.finishDate < b.finishDate ? a.finishDate : b.finishDate;
    if (from <= to) overlaps.push({ aCode: a.code, bCode: b.code, from, to, leftPct: pct(from), widthPct: Math.max(1.5, pct(to, true) - pct(from)) });
  }
  return { minDate, maxDate, bars, overlaps };
}

const svgEscape = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** تصویر SVG تایم‌لاین هم‌زمانی برای درج در لایحه (Word/PDF). */
export function concurrencyTimelineSvg(events: TimelineEvent[], width = 720): string {
  const timeline = buildConcurrencyTimeline(events);
  if (!timeline.bars.length) return '';
  const rowH = 22; const labelW = 150; const axisH = 18;
  const plotW = width - labelW - 10;
  const height = axisH + timeline.bars.length * rowH + 26;
  const x = (p: number) => labelW + (p / 100) * plotW;
  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="B Nazanin, Vazirmatn, Tahoma, sans-serif" font-size="11">`];
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);
  parts.push(`<text x="${width - 4}" y="13" text-anchor="end" fill="#334155">${svgEscape(timeline.minDate ?? '')} ← محور زمان → ${svgEscape(timeline.maxDate ?? '')}</text>`);
  for (const overlap of timeline.overlaps) parts.push(`<rect x="${x(overlap.leftPct).toFixed(1)}" y="${axisH}" width="${Math.max(3, (overlap.widthPct / 100) * plotW).toFixed(1)}" height="${timeline.bars.length * rowH}" fill="#f59e0b" opacity="0.18"/>`);
  timeline.bars.forEach((bar, i) => {
    const y = axisH + i * rowH;
    parts.push(`<text x="${labelW - 6}" y="${y + 15}" text-anchor="end" fill="#111827">${svgEscape(bar.code)}</text>`);
    parts.push(`<rect x="${x(bar.leftPct).toFixed(1)}" y="${y + 4}" width="${Math.max(3, (bar.widthPct / 100) * plotW).toFixed(1)}" height="13" rx="3" fill="${bar.color}" ${bar.critical ? 'stroke="#7f1d1d" stroke-width="2"' : 'opacity="0.78"'}/>`);
    if (bar.critical) parts.push(`<text x="${x(bar.leftPct) + 4}" y="${y + 15}" fill="#b91c1c" font-size="10">بحرانی</text>`);
  });
  const ly = axisH + timeline.bars.length * rowH + 16;
  const legend: [string, string][] = [['#2563eb', 'کارفرما'], ['#dc2626', 'پیمانکار'], ['#7c3aed', 'هم‌زمان'], ['#64748b', 'سایر'], ['rgba(245,158,11,0.35)', 'هم‌پوشانی']];
  let lx = width - 6;
  for (const [color, label] of legend) { lx -= 78; parts.push(`<rect x="${lx}" y="${ly - 10}" width="12" height="9" fill="${color}"/><text x="${lx + 16}" y="${ly}" fill="#334155">${label}</text>`); }
  parts.push('</svg>');
  return parts.join('');
}

export function overlappingDelayEvents<T extends { startDate: string; finishDate: string }>(events: T[]): [T, T][] {
  const valid = events.filter(e => isDay(e.startDate) && isDay(e.finishDate) && e.startDate <= e.finishDate);
  const out: [T, T][] = [];
  for (let i = 0; i < valid.length; i++) for (let j = i + 1; j < valid.length; j++) {
    if (valid[i].startDate <= valid[j].finishDate && valid[j].startDate <= valid[i].finishDate) out.push([valid[i], valid[j]]);
  }
  return out;
}

type PersistedCalculation = Record<string, unknown> & { DelayEventId?: unknown; Engine?: unknown; Inputs?: unknown; Status?: unknown; FinalValueDays?: unknown; ApprovedAt?: unknown; CalculatedAt?: unknown; CreatedAt?: unknown; Id?: unknown };
function calculationInputs(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') { try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; } }
  return {};
}
function calculationTime(row: PersistedCalculation): number {
  for (const value of [row.ApprovedAt, row.CalculatedAt, row.CreatedAt]) {
    const time = Date.parse(String(value ?? ''));
    if (Number.isFinite(time)) return time;
  }
  return 0;
}
/**
 * انتخاب محاسبات مؤثر در تمدید: ۱۳۰۰ «مدت مجاز پرداخت» است و تمدید نیست؛ برای هر رویداد فقط
 * آخرین بازبینی تأییدشدهٔ روش زمان‌بندی، یا در نبود آن آخرین بازبینی تأییدشدهٔ هر صورت‌وضعیت ۵۰۹۰ شمرده می‌شود.
 */
export function selectApprovedExtensionCalculations(rows: PersistedCalculation[]): { calculations: PersistedCalculation[]; totalDays: number } {
  const latest = new Map<string, PersistedCalculation>();
  for (const row of rows) {
    if (String(row.Status ?? '') !== 'approved' || String(row.Engine ?? '') === 'circular1300') continue;
    const finalDays = Number(row.FinalValueDays);
    if (!Number.isFinite(finalDays) || finalDays <= 0) continue;
    const eventId = String(row.DelayEventId ?? '');
    if (!eventId) continue;
    const engine = String(row.Engine ?? '');
    const inputs = calculationInputs(row.Inputs);
    const statementKey = engine === 'schedule'
      ? 'schedule'
      : String(inputs.ipcId ?? `${String(inputs.statementKind ?? 'statement')}|${String(inputs.submittedAt ?? '')}|${String(inputs.actualPaidAt ?? '')}|${String(inputs.latestStatementDate ?? '')}`);
    const key = `${eventId}|${engine}|${statementKey}`;
    const previous = latest.get(key);
    if (!previous || calculationTime(row) > calculationTime(previous) || (calculationTime(row) === calculationTime(previous) && String(row.Id ?? '') > String(previous.Id ?? ''))) latest.set(key, row);
  }
  const byEvent = new Map<string, PersistedCalculation[]>();
  for (const row of latest.values()) {
    const eventId = String(row.DelayEventId);
    byEvent.set(eventId, [...(byEvent.get(eventId) ?? []), row]);
  }
  const calculations: PersistedCalculation[] = [];
  for (const rowsForEvent of byEvent.values()) {
    const schedule = rowsForEvent.filter(row => String(row.Engine) === 'schedule');
    calculations.push(...(schedule.length ? schedule : rowsForEvent));
  }
  return { calculations, totalDays: Math.round(calculations.reduce((sum, row) => sum + Number(row.FinalValueDays), 0) * 1_000_000) / 1_000_000 };
}
