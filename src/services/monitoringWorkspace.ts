import { computeEvm as financeEvm, verifySnapshot, type EvmInput } from './finance';
/** LIVE-5: read-only, deterministic monitoring projections. No demo values or UI clock arithmetic. */
export type MonitorRow = Record<string, unknown>;
export type SourceState = 'ready' | 'empty' | 'restricted' | 'unavailable' | 'too_large';
export type MonitorSource = { table: string; state: SourceState; rows: MonitorRow[] };
export const MONITOR_SOURCES = [
  { table: 'Activity', permissions: ['plan.schedule.view'], label: 'برنامه و فعالیت', discipline: true },
  { table: 'ProgressEntry', permissions: ['plan.schedule.view'], label: 'پیشرفت تأییدشده' },
  { table: 'EvmSnapshot', permissions: ['pex.evm.view', 'fin.cost.view'], all: true, label: 'تصویر ارزش کسب‌شده' },
  { table: 'Risk', permissions: ['rcc.risk.view'], label: 'ریسک' },
  { table: 'ChangeRequest', permissions: ['rcc.change.raise', 'rcc.change.approve'], label: 'تغییر' },
  { table: 'Claim', permissions: ['rcc.claim.view'], label: 'ادعا' },
  { table: 'Document', permissions: ['doc.document.view'], label: 'مدارک', discipline: true },
  { table: 'Ncr', permissions: ['qms.itp.view'], label: 'عدم انطباق', discipline: true },
  { table: 'Equipment', permissions: ['eqm.workspace.view'], label: 'ماشین‌آلات' },
  { table: 'MaintenanceOrder', permissions: ['eqm.workspace.view'], label: 'تعمیرات' },
  { table: 'Correspondence', permissions: ['ckm.letter.view'], label: 'مکاتبات' },
  { table: 'MeetingAction', permissions: ['ckm.meeting.record'], label: 'مصوبات جلسه' },
] as const;
export function monitorDay(value: unknown): string | null {
  if (typeof value === 'string' && !Number.isFinite(Date.parse(value))) return null;
  const s = value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : typeof value === 'string' ? value.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s ? s : null;
}
export function monitorNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || (typeof value !== 'number' && typeof value !== 'string')) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
}
const positive = (v: unknown) => { const n = monitorNumber(v); return n !== null && n >= 0 ? n : null; };
// Persistence monetary columns are DECIMAL(18,2); allow only the half-cent rounding quantum.
const sameMoney = (a: number | null, b: number | null) => a === null || b === null ? a === b : Math.abs(a - b) <= 0.005 + Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
const finite = (v: number | null) => v !== null && Number.isFinite(v) ? v : null;
export function evmPoint(row: MonitorRow, today: string) {
  const dataDate = monitorDay(row.DataDate);
  const pv = positive(row.Pv), ev = positive(row.Ev), ac = positive(row.Ac), bac = positive(row.Bac), eac = positive(row.Eac);
  let integrity = 'unverified';
  if (row.Inputs && typeof row.Inputs === 'object' && !Array.isArray(row.Inputs) && typeof row.Hash === 'string') {
    try {
      const inputs = row.Inputs as EvmInput;
      const result = financeEvm(inputs);
      const checked = verifySnapshot({ id: String(row.Id), projectId: String(row.ProjectId), dataDate: dataDate ?? '', formulaVersion: String(row.FormulaVersion), inputs, result, hash: row.Hash, createdAt: '', frozen: true });
      // The saved output columns are not part of the old hash payload. Check them too.
      const columnsMatch = sameMoney(pv, positive(inputs.pv)) && sameMoney(ev, positive(inputs.ev)) && sameMoney(ac, positive(inputs.ac)) && sameMoney(bac, positive(inputs.bac)) && sameMoney(eac, positive(result.eac.cpi));
      integrity = checked.valid && columnsMatch ? 'verified' : checked.reason ?? 'column_mismatch';
    } catch { integrity = 'invalid_inputs'; }
  }
  const valid = Boolean(integrity === 'verified' && dataDate && dataDate <= today && pv !== null && ev !== null && ac !== null);
  const spi = valid && pv !== 0 ? finite(ev! / pv!) : null;
  const cpi = valid && ac !== 0 ? finite(ev! / ac!) : null;
  return {
    id: String(row.Id ?? ''), dataDate, integrity, state: valid ? 'ready' : integrity === 'unverified' ? 'unverified' : 'invalid',
    stale: dataDate ? (Date.parse(today) - Date.parse(dataDate)) / 86400000 > 30 : null,
    pv: valid ? pv : null, ev: valid ? ev : null, ac: valid ? ac : null, bac: valid ? bac : null,
    spi, cpi, sv: valid ? finite(ev! - pv!) : null, cv: valid ? finite(ev! - ac!) : null,
    // Only the stored forecast is shown; never synthesize a forecast using made-up planned %.
    eac: valid ? eac : null, etc: valid && eac !== null ? finite(eac - ac!) : null,
    vac: valid && bac !== null && eac !== null ? finite(bac - eac) : null,
    formulaVersion: typeof row.FormulaVersion === 'string' ? row.FormulaVersion : null,
  };
}
export type MonitoringItem = { table: string; id: string; code: string; title: string; dueDate: string | null; status: string; critical: boolean; approvedPct: number | null };
const flag = (v: unknown) => v === true || v === 1 || v === '1';
export function buildMonitoring(sources: MonitorSource[], today: string, horizonDays: number) {
  const source = (table: string) => sources.find(s => s.table === table);
  const usable = (table: string) => ['ready', 'empty'].includes(source(table)?.state ?? '');
  const rows = (table: string) => usable(table) ? source(table)!.rows : [];
  const end = new Date(today + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + horizonDays);
  const until = end.toISOString().slice(0, 10);
  const approved = new Map<string, MonitorRow>();
  for (const row of rows('ProgressEntry')) {
    const d = monitorDay(row.EntryDate);
    if (!flag(row.AcceptedIntoEv) || !d || d > today || !row.ApprovedBy || !monitorDay(row.ApprovedAt) || monitorDay(row.ApprovedAt)! > today) continue;
    const prev = approved.get(String(row.ActivityId));
    if (!prev || `${d}|${String(row.ApprovedAt)}|${String(row.Id)}` > `${monitorDay(prev.EntryDate)}|${String(prev.ApprovedAt)}|${String(prev.Id)}`) approved.set(String(row.ActivityId), row);
  }
  const lookahead: MonitoringItem[] = rows('Activity').filter(row => {
    const start = monitorDay(row.PlannedStart), finish = monitorDay(row.PlannedFinish), actual = monitorDay(row.ActualFinish);
    return start && finish && start <= finish && start <= until && !(actual && actual <= today);
  }).map(row => {
    const pct = positive(approved.get(String(row.Id))?.PhysicalPct);
    return { table: 'Activity', id: String(row.Id), code: String(row.Code ?? ''), title: String(row.NameFa ?? ''), dueDate: monitorDay(row.PlannedFinish), status: monitorDay(row.PlannedFinish)! < today ? 'overdue' : 'planned', critical: flag(row.IsCritical) || (monitorNumber(row.TotalFloat) !== null && Number(row.TotalFloat) <= 0), approvedPct: pct !== null && pct <= 100 ? pct : null };
  }).filter(row => row.approvedPct !== 100).sort((a,b) => String(a.dueDate).localeCompare(String(b.dueDate)) || a.id.localeCompare(b.id));
  const actions: MonitoringItem[] = rows('MeetingAction').filter(row => !['done','cancelled'].includes(String(row.Status)) && monitorDay(row.DueDate) && monitorDay(row.DueDate)! <= until).map(row => ({ table: 'MeetingAction', id: String(row.Id), code: String(row.Code ?? ''), title: String(row.TitleFa ?? ''), dueDate: monitorDay(row.DueDate), status: String(row.Status), critical: monitorDay(row.DueDate)! < today, approvedPct: null })).sort((a,b) => String(a.dueDate).localeCompare(String(b.dueDate)) || a.id.localeCompare(b.id));
  const snapshots = rows('EvmSnapshot').filter(row => monitorDay(row.DataDate) && monitorDay(row.DataDate)! <= today).sort((a,b) => monitorDay(a.DataDate)!.localeCompare(monitorDay(b.DataDate)!) || String(a.Id).localeCompare(String(b.Id)));
  const history = snapshots.map(row => evmPoint(row, today));
  const evm = { source: 'EvmSnapshot', state: !usable('EvmSnapshot') ? source('EvmSnapshot')?.state ?? 'unavailable' : history.length ? history[history.length - 1].state : 'empty', latest: history.slice(-1)[0] ?? null, history, excludedUndatedOrFuture: usable('EvmSnapshot') ? rows('EvmSnapshot').length - history.length : null };
  const summaries = [
    ['Activity', rows('Activity').length, 'تعداد فعالیت‌ها'],
    ['Risk', rows('Risk').filter(r => r.Status === 'open' && positive(r.Probability) !== null && positive(r.Impact) !== null && Number(r.Probability) * Number(r.Impact) >= 16).length, 'ریسک باز با امتیاز ≥۱۶'],
    ['ChangeRequest', rows('ChangeRequest').filter(r => ['draft','pending'].includes(String(r.Status))).length, 'تغییر در انتظار تصمیم'],
    ['Claim', rows('Claim').filter(r => r.Status === 'draft').length, 'ادعای پیش‌نویس'],
    ['Document', rows('Document').filter(r => ['draft','under_review'].includes(String(r.Status))).length, 'مدرک پیش‌نویس / در بازبینی'],
    ['Ncr', rows('Ncr').filter(r => r.Status !== 'closed').length, 'عدم انطباق بسته‌نشده'],
    ['Equipment', rows('Equipment').filter(r => r.Status === 'repair').length, 'ماشین در تعمیر'],
    ['MaintenanceOrder', rows('MaintenanceOrder').filter(r => ['open','in_progress'].includes(String(r.Status))).length, 'دستورکار باز تعمیرات'],
    ['Correspondence', rows('Correspondence').filter(r => !['draft','closed','responded'].includes(String(r.Status)) && !r.RespondedAt && monitorDay(r.DueAt) && monitorDay(r.DueAt)! < today).length, 'مکاتبهٔ معوقِ بی‌پاسخ'],
    ['MeetingAction', rows('MeetingAction').filter(r => !['done','cancelled'].includes(String(r.Status)) && monitorDay(r.DueDate) && monitorDay(r.DueDate)! < today).length, 'مصوبهٔ معوق'],
  ].map(([table, value, label]) => ({ table: String(table), label: String(label), value: usable(String(table)) ? Number(value) : null, state: source(String(table))?.state ?? 'unavailable' }));
  // Explicit deterministic rules, not a synthetic composite PHI or auto-acknowledgement workflow.
  const alerts: { table: string; code: string; message: string; count: number | null }[] = [];
  for (const k of summaries) if (k.table !== 'Activity' && k.value !== null && k.value > 0) alerts.push({ table: k.table, code: 'OPEN_' + k.table, message: k.label, count: k.value });
  if (lookahead.some(a => a.status === 'overdue')) alerts.push({ table: 'Activity', code: 'SCHEDULE_OVERDUE', message: 'فعالیت با پایان برنامه‌ای گذشته و بدون اتمام ثبت‌شده', count: lookahead.filter(a => a.status === 'overdue').length });
  if (evm.latest?.spi !== null && evm.latest?.spi !== undefined && evm.latest.spi < 0.95) alerts.push({ table: 'EvmSnapshot', code: 'SPI_BELOW_095', message: 'SPI کمتر از ۰٫۹۵ در آخرین تصویر ثبت‌شده', count: null });
  if (evm.latest?.cpi !== null && evm.latest?.cpi !== undefined && evm.latest.cpi < 1) alerts.push({ table: 'EvmSnapshot', code: 'CPI_BELOW_1', message: 'CPI کمتر از یک در آخرین تصویر ثبت‌شده', count: null });
  return { today, horizonDays, until, summaries, evm, lookahead, actions, alerts,
    sources: sources.map(s => ({ table: s.table, state: s.state, rowCount: usable(s.table) ? s.rows.length : null,
      lastUpdatedAt: usable(s.table) ? s.rows.flatMap(r => [r.UpdatedAt, r.CreatedAt]).map(v => v instanceof Date && Number.isFinite(v.getTime()) ? v.toISOString() : v).filter((v): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v))).sort().slice(-1)[0] ?? null : null })),
    phi: { value: null, reason: 'مدل سلامت کالیبره و ورودی‌های تأییدشدهٔ هم‌تاریخ ثبت نشده است' },
  };
}
export type MonitoringData = ReturnType<typeof buildMonitoring> & { projectId: string; generatedAt: string; version: string };
