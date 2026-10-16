import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCircular1300, calculateCircular5090, sumCircular5090Extensions, analyseDelay, overlappingDelayEvents, selectApprovedExtensionCalculations, buildConcurrencyTimeline, concurrencyTimelineSvg } from './delayLogic.js';

test('Circular 1300: base table 30/45/60/75/90 days', () => {
  for (const [period, expected] of [[30, null], [45, 30], [60, 40], [75, 50], [90, 60]]) {
    const r = calculateCircular1300({ periodDays: period, article37ExactlyComplied: false, ruleStatus: 'approved' });
    assert.equal(r.rawAllowedPaymentDays, expected === null ? null : expected);
    if (period === 30) assert.equal(r.status, 'not_applicable');
  }
});

test('Circular 1300: exact Article 37 compliance and unapproved rule do not produce a final number', () => {
  assert.equal(calculateCircular1300({ periodDays: 60, article37ExactlyComplied: true }).status, 'not_applicable');
  const r = calculateCircular1300({ periodDays: 60, article37ExactlyComplied: false });
  assert.equal(r.rawAllowedPaymentDays, 40);
  assert.equal(r.finalAllowedPaymentDays, null);
  assert.equal(r.status, 'needs_review');
  assert.equal(calculateCircular1300({ periodDays: 0, article37ExactlyComplied: false }).status, 'needs_review');
});

test('Circular 5090: interim formula uses theta, amount/period and T/P with 0.697', () => {
  const r = calculateCircular5090({
    statementKind: 'interim', submittedAt: '2026-01-01', actualPaidAt: '2026-01-21', contractPaymentDays: 10,
    statementGrossAmount: 1000, statementPeriodDays: 50, initialContractDurationDays: 200, initialContractAmount: 10000,
    ruleStatus: 'approved',
  });
  assert.equal(r.contractPaymentDate, '2026-01-11');
  assert.equal(r.paymentDelayDays, 10);
  assert.equal(r.rawExtensionDays, 0.697 * 10 * (1000 / 50) * (200 / 10000));
  assert.equal(r.finalExtensionDays, r.rawExtensionDays);
});

test('Circular 5090: early payment creates no positive extension; first advance uses 0.9 theta', () => {
  const early = calculateCircular5090({ statementKind: 'advance_first', submittedAt: '2026-01-01', actualPaidAt: '2026-01-05', ruleStatus: 'approved' });
  assert.equal(early.rawExtensionDays, 0);
  const late = calculateCircular5090({ statementKind: 'advance_first', submittedAt: '2026-01-01', actualPaidAt: '2026-01-21', ruleStatus: 'approved' });
  assert.equal(late.rawExtensionDays, 9);
  assert.equal(sumCircular5090Extensions([late, late]).rawExtensionDays, 18);
});

test('Circular 5090: missing evidence dates remain needs_review', () => {
  const r = calculateCircular5090({ statementKind: 'interim', submittedAt: '2026-01-01' });
  assert.equal(r.status, 'needs_review');
  assert.equal(r.finalExtensionDays, null);
});

const acts = [
  { id: 'A', nameFa: 'A', duration: 5 },
  { id: 'B', nameFa: 'B', duration: 5 },
  { id: 'C', nameFa: 'C', duration: 2 },
];
const rels = [
  { pred: 'A', succ: 'B', type: 'FS' },
  { pred: 'A', succ: 'C', type: 'FS' },
];

test('DelayAnalysis: impacted activity shifts completion only when it is on the driving path', () => {
  const r = analyseDelay({ method: 'impacted_as_planned', baselineActivities: acts, relations: rels, dataDate: '2026-01-01', eventActivityIds: ['B'], eventDelayDays: 3 });
  assert.equal(r.status, 'calculated');
  assert.equal(r.completionShiftDays, 3);
  const nonDriving = analyseDelay({ method: 'impacted_as_planned', baselineActivities: acts, relations: rels, dataDate: '2026-01-01', eventActivityIds: ['C'], eventDelayDays: 1 });
  assert.equal(nonDriving.completionShiftDays, 0);
});

test('DelayAnalysis: incomplete network is not calculated', () => {
  const r = analyseDelay({ method: 'as_planned_as_built', baselineActivities: acts, relations: [{ pred: 'A', succ: 'X', type: 'FS' }], dataDate: '2026-01-01', updatedActivities: acts });
  assert.equal(r.status, 'needs_review');
  assert.match(r.issues.join(' '), /فعالیت موجود وصل نیست/);
});

test('DelayAnalysis: calendar overlap is detected without summing durations', () => {
  const pairs = overlappingDelayEvents([
    { id: 1, startDate: '2026-01-01', finishDate: '2026-01-10' },
    { id: 2, startDate: '2026-01-05', finishDate: '2026-01-07' },
    { id: 3, startDate: '2026-02-01', finishDate: '2026-02-02' },
  ]);
  assert.equal(pairs.length, 1);
});

test('DelayAnalysis: TIA and Windows use distinct explicit inputs', () => {
  const tia = analyseDelay({ method: 'time_impact_analysis', baselineActivities: acts, updatedActivities: acts, relations: rels, dataDate: '2026-01-01', eventActivityIds: ['B'], eventDelayDays: 3 });
  assert.equal(tia.status, 'calculated');
  assert.equal(tia.completionShiftDays, 3);
  const noSnapshot = analyseDelay({ method: 'windows', baselineActivities: [], relations: rels, dataDate: '2026-01-01' });
  assert.equal(noSnapshot.status, 'needs_review');
  const windows = analyseDelay({
    method: 'windows', baselineActivities: [], relations: rels, dataDate: '2026-01-01',
    windows: [
      { label: 'W1', dataDate: '2026-01-01', baselineActivities: acts, updatedActivities: acts.map(a => a.id === 'B' ? { ...a, duration: 7 } : a) },
      { label: 'W2', dataDate: '2026-02-01', baselineActivities: acts, updatedActivities: acts.map(a => a.id === 'B' ? { ...a, duration: 8 } : a) },
    ],
  });
  assert.equal(windows.status, 'calculated');
  assert.equal(windows.windowResults.length, 2);
  assert.equal(windows.windowResults[0].shiftDays, 2);
  assert.equal(windows.completionShiftDays, windows.windowResults[1].shiftDays);
  assert.ok(windows.completionShiftDays > 0);
});

test('Concurrency timeline: party colors, critical flags and employer/contractor overlaps', () => {
  const events = [
    { Code: 'E1', TitleFa: 'کارفرما', Category: 'employer', StartDate: '2026-01-01', FinishDate: '2026-01-11', IsCritical: true },
    { Code: 'C1', TitleFa: 'پیمانکار', Category: 'contractor', StartDate: '2026-01-06', FinishDate: '2026-01-16', IsCritical: false },
    { Code: 'N1', TitleFa: 'خنثی', Category: 'neutral', StartDate: '2026-02-01', FinishDate: '2026-02-05' },
  ];
  const timeline = buildConcurrencyTimeline(events);
  assert.equal(timeline.bars.length, 3);
  assert.equal(timeline.bars[0].color, '#2563eb');
  assert.equal(timeline.bars[0].critical, true);
  assert.equal(timeline.bars[1].critical, false);
  assert.equal(timeline.overlaps.length, 1);
  assert.equal(timeline.overlaps[0].from, '2026-01-06');
  assert.equal(timeline.overlaps[0].to, '2026-01-11');
  const svg = concurrencyTimelineSvg(events);
  assert.match(svg, /<svg/);
  assert.match(svg, /#dc2626/);
  assert.equal(buildConcurrencyTimeline([]).bars.length, 0);
});

test('Delay aggregation: latest approved revision only, 1300 excluded, schedule wins per event', () => {
  const selected = selectApprovedExtensionCalculations([
    { Id: 'old5090', DelayEventId: 'e1', Engine: 'circular5090', Status: 'approved', FinalValueDays: 2, ApprovedAt: '2026-01-01T00:00:00Z', Inputs: { ipcId: 'ipc1' } },
    { Id: 'new5090', DelayEventId: 'e1', Engine: 'circular5090', Status: 'approved', FinalValueDays: 5, ApprovedAt: '2026-02-01T00:00:00Z', Inputs: { ipcId: 'ipc1' } },
    { Id: 'pay1300', DelayEventId: 'e1', Engine: 'circular1300', Status: 'approved', FinalValueDays: 40, ApprovedAt: '2026-03-01T00:00:00Z', Inputs: {} },
    { Id: 'schedImpacted', DelayEventId: 'e2', Engine: 'schedule', Status: 'approved', FinalValueDays: 3, ApprovedAt: '2026-01-01T00:00:00Z', Inputs: { method: 'impacted_as_planned' } },
    { Id: 'schedTia', DelayEventId: 'e2', Engine: 'schedule', Status: 'approved', FinalValueDays: 7, ApprovedAt: '2026-02-01T00:00:00Z', Inputs: { method: 'time_impact_analysis' } },
    { Id: 'both5090', DelayEventId: 'e2', Engine: 'circular5090', Status: 'approved', FinalValueDays: 11, ApprovedAt: '2026-03-01T00:00:00Z', Inputs: { ipcId: 'ipc2' } },
  ]);
  assert.deepEqual(selected.calculations.map(row => row.Id).sort(), ['new5090', 'schedTia']);
  assert.equal(selected.totalDays, 12);
});
