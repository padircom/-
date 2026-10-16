import { useEffect, useRef, useState } from 'react';
import { type Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import { schedReconApi, type SchedCatalog, type SchedMission, type SchedRow, CHILD_TABLE_FA, MISSION_STATUS_FA, SEVERITY_FA, CHECK_KIND_FA, FEASIBILITY_FA, EMPTY } from '../services/schedReconClient';
import JalaliDateInput from './JalaliDateInput';

const btn = 'rounded-lg border b-line-soft px-2.5 py-1 text-[11px] transition hover:opacity-80 disabled:opacity-40';
const inputClass = 'w-full rounded-lg border b-line-soft bg-transparent px-2 py-1 text-xs tx1';
const EMPTY_DASH = EMPTY;

type EngineState = { kind: 'validation' | 'cpm' | 'mip' | null; text: string };

export default function SchedReconWorkspace(props: { lang: Lang; projectId: string }) {
  const { user } = useAuth();
  return <Live key={`${props.projectId}:${user?.id ?? ''}`} {...props} userId={user?.id ?? null} />;
}

function Live({ lang, projectId, userId }: { lang: Lang; projectId: string; userId: string | null }) {
  const fa = lang === 'fa';
  const label = (a: string, b: string) => (fa ? a : b);
  const [catalog, setCatalog] = useState<SchedCatalog | null>(null);
  const [missions, setMissions] = useState<SchedMission[]>([]);
  const [current, setCurrent] = useState<SchedMission | null>(null);
  const [children, setChildren] = useState<Record<string, SchedRow[]>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [engine, setEngine] = useState<EngineState>({ kind: null, text: '' });
  const [cpmResult, setCpmResult] = useState<{ projectDuration: number; criticalPath: string[]; results: { code: string; duration: number; es: number; ef: number; totalFloat: number; critical: boolean }[] } | null>(null);
  const [mipResult, setMipResult] = useState<{ code: string; family: string; feasibility: string; reasonFa: string }[] | null>(null);
  const [missionForm, setMissionForm] = useState({ TitleFa: '', PurposeFa: '', PeriodFrom: '', PeriodTo: '', AnalysisStandard: 'BOTH', ContractCode: '', ClaimCode: '', DelayEventCode: '' });
  const [activityForm, setActivityForm] = useState<Record<string, string>>({ Code: '', TitleFa: '', OriginalDuration: '', ActualStart: '', ActualFinish: '' });
  const [logicForm, setLogicForm] = useState<Record<string, string>>({ PredecessorCode: '', SuccessorCode: '', RelType: 'FS', Lag: '0', ReconstructionBasis: 'file_record' });
  const [showCreate, setShowCreate] = useState(false);
  const generation = useRef(0);
  const mounted = useRef(true);

  const can = (p: string) => catalog?.permissions.includes(p) ?? false;
  const missionCode = current?.Code ?? '';
  const validations = children.PmisSchedReconValidations ?? [];
  const activityRows = children.PmisSchedReconActivities ?? [];
  const logicRows = children.PmisSchedReconLogic ?? [];
  const mipRows = children.PmisSchedReconMipMappings ?? [];
  const criticalRows = children.PmisSchedReconCriticalPaths ?? [];
  const openFindings = validations.filter((v) => v.Resolution === 'open');

  async function loadMissions() {
    const seq = ++generation.current;
    setLoading(true);
    const [cat, list] = await Promise.all([
      schedReconApi.catalog(projectId, userId),
      schedReconApi.listMissions(projectId, userId),
    ]);
    if (!mounted.current || seq !== generation.current) return;
    setLoading(false);
    if (!cat.ok) { setError(cat.message); return; }
    if (!list.ok) { setError(list.message); return; }
    setCatalog(cat.data); setMissions(list.data.missions); setError('');
  }
  async function loadMission(id: string) {
    const seq = ++generation.current;
    const r = await schedReconApi.mission(projectId, userId, id);
    if (!mounted.current || seq !== generation.current) return;
    if (r.ok) { setCurrent(r.data.mission); setChildren(r.data.children); setError(''); }
    else setError(r.message);
  }
  useEffect(() => { mounted.current = true; void loadMissions(); return () => { mounted.current = false; generation.current++; }; }, [projectId, userId]);

  async function mutate(work: () => Promise<{ ok: boolean; message?: string; data?: unknown }>, after?: () => void) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    const r = await work();
    if (!mounted.current) return;
    if (!r.ok) { setError(r.message ?? label('خطای ناشناخته', 'Unknown error')); setBusy(false); return; }
    if (current) await loadMission(current.Id);
    await loadMissions();
    after?.();
    if (mounted.current) setBusy(false);
  }

  const createMission = () => mutate(async () => {
    const r = await schedReconApi.createMission(projectId, userId, missionForm);
    if (r.ok) { setShowCreate(false); setMissionForm({ TitleFa: '', PurposeFa: '', PeriodFrom: '', PeriodTo: '', AnalysisStandard: 'BOTH', ContractCode: '', ClaimCode: '', DelayEventCode: '' }); setNotice(label('مأموریت ایجاد شد.', 'Mission created.')); void loadMission(r.data.mission.Id); }
    return r;
  });
  const startMission = () => current && mutate(() => schedReconApi.transition(projectId, userId, current.Id, current.Status === 'on_hold' ? 'in_progress' : 'in_progress'), () => setNotice(label('مأموریت آغاز شد.', 'Mission started.')));
  const completeMission = () => current && mutate(() => schedReconApi.transition(projectId, userId, current.Id, 'completed'), () => setNotice(label('مأموریت تکمیل و بسته شد.', 'Mission completed.')));
  const cancelMission = () => current && mutate(() => schedReconApi.transition(projectId, userId, current.Id, 'cancelled'), () => setNotice(label('مأموریت لغو شد.', 'Mission cancelled.')));
  const deleteMission = () => current && mutate(() => schedReconApi.deleteMission(projectId, userId, current.Id), () => { setCurrent(null); setChildren({}); setCpmResult(null); setMipResult(null); setNotice(label('مأموریت پیش‌نویس حذف شد.', 'Draft mission deleted.')); });
  const advanceStep = () => current && mutate(() => schedReconApi.setStep(projectId, userId, current.Id, (current.CurrentStep ?? 1) + 1));

  const addActivity = () => current && mutate(async () => {
    const body: Record<string, unknown> = { Code: activityForm.Code, ActivityId: activityForm.Code, TitleFa: activityForm.TitleFa, OriginalDuration: activityForm.OriginalDuration === '' ? null : Number(activityForm.OriginalDuration), ActualStart: activityForm.ActualStart || null, ActualFinish: activityForm.ActualFinish || null, StatusFlag: 'in_progress' };
    const r = await schedReconApi.addRow(projectId, userId, current.Id, 'PmisSchedReconActivities', body);
    if (r.ok) setActivityForm({ Code: '', TitleFa: '', OriginalDuration: '', ActualStart: '', ActualFinish: '' });
    return r;
  });
  const addLogic = () => current && mutate(async () => {
    const r = await schedReconApi.addRow(projectId, userId, current.Id, 'PmisSchedReconLogic', { ...logicForm, Lag: logicForm.Lag === '' ? 0 : Number(logicForm.Lag) });
    if (r.ok) setLogicForm({ PredecessorCode: '', SuccessorCode: '', RelType: 'FS', Lag: '0', ReconstructionBasis: 'file_record' });
    return r;
  });
  const removeRow = (table: string, rowId: string) => current && mutate(() => schedReconApi.deleteRow(projectId, userId, current.Id, table, rowId));

  const runValidation = () => current && mutate(async () => {
    const r = await schedReconApi.runValidation(projectId, userId, current.Id);
    if (r.ok) setEngine({ kind: 'validation', text: label(`${r.data.findingsCreated} یافته ثبت شد (${r.data.findingsReplaced} یافتهٔ خودکار قبلی جایگزین شد). ${r.data.noteFa}`, `${r.data.findingsCreated} findings recorded. ${r.data.noteFa}`) });
    return r;
  });
  const runCpm = () => current && mutate(async () => {
    const r = await schedReconApi.runCriticalPath(projectId, userId, current.Id);
    if (r.ok) { setCpmResult(r.data.computed); setEngine({ kind: 'cpm', text: label(`مدت پروژهٔ بازسازی‌شده: ${r.data.computed.projectDuration} روز؛ ${r.data.computed.criticalPath.length} فعالیت بحرانی.`, `Reconstructed duration: ${r.data.computed.projectDuration} days.`) }); }
    return r;
  });
  const runMip = () => current && mutate(async () => {
    const r = await schedReconApi.runMipAssessment(projectId, userId, current.Id);
    if (r.ok) { setMipResult(r.data.assessments); setEngine({ kind: 'mip', text: label(`امکان‌سنجی ${r.data.assessments.length} پروتکل انجام و در دفتر نگاشت ثبت شد.`, `${r.data.assessments.length} MIP assessments recorded.`) }); }
    return r;
  });

  if (loading && !catalog) return <p className="tx3 p-4">{label('در حال بارگذاری…', 'Loading…')}</p>;
  if (error && !catalog) return <p role="alert" className="rounded-xl bg-rose-500/10 text-rose-400 p-3 text-sm">{error}</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="glass-dark rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="tx1 text-sm font-semibold">{label('بازسازی و تحلیل زمان‌بندی ادعا (AACE 29R-03 / SCL)', 'Forensic schedule reconstruction (AACE 29R-03 / SCL)')}</h3>
          <span className="tx3 text-[10px]" dir="ltr">{catalog?.module} v{catalog?.version}</span>
          <button className={btn} disabled={busy} onClick={() => void loadMissions()}>{label('تازه‌سازی', 'Refresh')}</button>
          {can('sched.recon.edit') && <button className={`${btn} ${showCreate ? 'toggle-on' : ''}`} onClick={() => setShowCreate((s) => !s)}>{label('مأموریت جدید', 'New mission')}</button>}
        </div>
        <p className="tx3 mt-1 text-[11px]">{catalog?.standardsNoteFa}</p>
      </header>
      {error && <p role="alert" className="rounded-xl bg-rose-500/10 text-rose-400 p-2.5 text-xs">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-500/10 text-emerald-400 p-2.5 text-xs">{notice}</p>}
      {engine.text && <p role="status" className="rounded-xl bg-sky-500/10 p-2.5 text-xs text-sky-300">{engine.text}</p>}

      {showCreate && (
        <section className="glass-dark rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <label className="text-[11px] tx3">{label('عنوان مأموریت', 'Mission title')}<input aria-label={label('عنوان مأموریت', 'Mission title')} className={inputClass} value={missionForm.TitleFa} onChange={(e) => setMissionForm((f) => ({ ...f, TitleFa: e.target.value }))} /></label>
            <label className="text-[11px] tx3">{label('شروع بازه ادعا', 'Claim period from')}<JalaliDateInput ariaLabel={label('شروع بازه ادعا', 'Claim period from')} className={inputClass} value={missionForm.PeriodFrom} onChange={(v) => setMissionForm((f) => ({ ...f, PeriodFrom: v }))} /></label>
            <label className="text-[11px] tx3">{label('پایان بازه ادعا', 'Claim period to')}<JalaliDateInput ariaLabel={label('پایان بازه ادعا', 'Claim period to')} className={inputClass} value={missionForm.PeriodTo} onChange={(v) => setMissionForm((f) => ({ ...f, PeriodTo: v }))} /></label>
            <label className="text-[11px] tx3">{label('استاندارد تحلیل', 'Analysis standard')}<select aria-label={label('استاندارد تحلیل', 'Analysis standard')} className={inputClass} value={missionForm.AnalysisStandard} onChange={(e) => setMissionForm((f) => ({ ...f, AnalysisStandard: e.target.value }))}>{(catalog?.analysisStandards ?? []).map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="text-[11px] tx3">{label('کد قرارداد (پیوند نرم)', 'Contract code (soft link)')}<input aria-label={label('کد قرارداد', 'Contract code')} className={inputClass} value={missionForm.ContractCode} onChange={(e) => setMissionForm((f) => ({ ...f, ContractCode: e.target.value }))} /></label>
            <label className="text-[11px] tx3">{label('کد ادعا / رویداد تأخیر (نرم)', 'Claim / delay event code')}<input aria-label={label('کد ادعا', 'Claim code')} className={inputClass} value={missionForm.ClaimCode} onChange={(e) => setMissionForm((f) => ({ ...f, ClaimCode: e.target.value }))} /></label>
          </div>
          <label className="block text-[11px] tx3">{label('هدف داوری/کارشناسی', 'Expert purpose')}<textarea aria-label={label('هدف داوری', 'Purpose')} className={inputClass} rows={2} value={missionForm.PurposeFa} onChange={(e) => setMissionForm((f) => ({ ...f, PurposeFa: e.target.value }))} /></label>
          <button className={btn} disabled={busy || !missionForm.TitleFa.trim() || !missionForm.PeriodFrom || !missionForm.PeriodTo} onClick={createMission}>{label('ثبت مأموریت', 'Create mission')}</button>
        </section>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
        {/* فهرست مأموریت‌ها */}
        <aside className="glass-dark thin-scroll min-h-0 overflow-y-auto rounded-xl p-2 space-y-1">
          {missions.length === 0 && <p className="tx3 p-2 text-xs">{label('مأموریتی ثبت نشده است.', 'No missions yet.')}</p>}
          {missions.map((m) => (
            <button key={m.Id} type="button" onClick={() => { setCurrent(m); void loadMission(m.Id); setCpmResult(null); setMipResult(null); }} className={`w-full rounded-lg border b-line-soft p-2 text-start text-xs transition ${current?.Id === m.Id ? 'toggle-on' : 'hover:opacity-80'}`}>
              <div className="flex items-center justify-between gap-1">
                <span className="tx1 font-medium">{m.TitleFa}</span>
                <span className="tx3 text-[9px]" dir="ltr">{m.Code}</span>
              </div>
              <div className="tx3 mt-1 flex items-center justify-between text-[10px]">
                <span>{fa ? (MISSION_STATUS_FA[m.Status] ?? m.Status) : m.Status}</span>
                <span dir="ltr">{m.progress?.pct ?? 0}% · {label('گام', 'step')} {m.CurrentStep}/{catalog?.stepCount ?? 8}</span>
              </div>
            </button>
          ))}
        </aside>

        {/* جزئیات مأموریت */}
        <main className="thin-scroll min-h-0 space-y-3 overflow-y-auto">
          {!current ? (
            <p className="tx3 glass-dark rounded-xl p-4 text-xs">{label('یک مأموریت را از فهرست انتخاب کنید یا مأموریت جدید بسازید.', 'Select a mission from the list or create one.')}</p>
          ) : (
            <>
              <section className="glass-dark rounded-xl p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="tx1 text-sm font-semibold">{current.TitleFa}</h4>
                  <span className="tx3 text-[10px]" dir="ltr">{missionCode}</span>
                  <span className="tx3 text-[10px]">{fa ? (MISSION_STATUS_FA[current.Status] ?? current.Status) : current.Status}</span>
                  <span className="tx3 text-[10px]" dir="ltr">{String(current.PeriodFrom).slice(0, 10)} → {String(current.PeriodTo).slice(0, 10)}</span>
                </div>
                {/* نوار ۸ مرحله */}
                <div className="mt-2 grid grid-cols-4 gap-1 md:grid-cols-8">
                  {(catalog?.steps ?? []).map((s) => {
                    const active = s.n === current.CurrentStep;
                    const done = s.n < current.CurrentStep;
                    return (
                      <div key={s.n} title={s.titleFa} className={`rounded-lg border p-1.5 text-center text-[9px] ${active ? 'toggle-on border-sky-500' : done ? 'tx2 border-emerald-500/40' : 'tx3 b-line-soft'}`}>
                        <div className="font-semibold">{s.n}</div>
                        <div className="leading-tight">{s.titleFa.split('،')[0].split('و ')[0]}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {can('sched.recon.edit') && ['draft', 'on_hold'].includes(current.Status) && <button className={btn} disabled={busy} onClick={startMission}>{label('آغاز/ادامهٔ مأموریت', 'Start/resume')}</button>}
                  {can('sched.recon.edit') && current.Status === 'in_progress' && (current.CurrentStep ?? 1) < (catalog?.stepCount ?? 8) && <button className={btn} disabled={busy} onClick={advanceStep}>{label(`رفتن به گام ${(current.CurrentStep ?? 1) + 1}`, `Step ${(current.CurrentStep ?? 1) + 1}`)}</button>}
                  {can('sched.recon.approve') && current.Status === 'in_progress' && <button className={btn} disabled={busy} onClick={completeMission}>{label('تکمیل و بستن مأموریت (تأیید)', 'Complete mission (approve)')}</button>}
                  {can('sched.recon.edit') && ['draft', 'in_progress', 'on_hold'].includes(current.Status) && <button className={btn} disabled={busy} onClick={cancelMission}>{label('لغو مأموریت', 'Cancel mission')}</button>}
                  {can('sched.recon.edit') && current.Status === 'draft' && <button className={btn} disabled={busy} onClick={deleteMission}>{label('حذف پیش‌نویس', 'Delete draft')}</button>}
                </div>
              </section>

              {/* خلاصهٔ داده‌ها */}
              <section className="glass-dark rounded-xl p-3">
                <h5 className="tx1 text-xs font-semibold">{label('موجودیت دادهٔ مأموریت', 'Mission data inventory')}</h5>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {catalog?.childTables.map((t) => (
                    <span key={t} className="rounded-md border b-line-soft px-2 py-0.5 text-[10px] tx2">{CHILD_TABLE_FA[t] ?? t}: <b dir="ltr">{(children[t] ?? []).length}</b></span>
                  ))}
                </div>
              </section>

              {/* موتورها */}
              {can('sched.recon.edit') && !['completed', 'cancelled'].includes(current.Status) && (
                <section className="glass-dark rounded-xl p-3">
                  <h5 className="tx1 text-xs font-semibold">{label('موتورهای کارشناسی (خروجی پیش‌نویس محاسباتی — قطعیت با تأیید کارشناس)', 'Expert engines — computational drafts, finalized only by expert sign-off')}</h5>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button className={btn} disabled={busy || activityRows.length === 0} onClick={runCpm}>{label('بازسازی مسیر بحرانی (CPM)', 'Run critical path (CPM)')}</button>
                    <button className={btn} disabled={busy || activityRows.length === 0} onClick={runValidation}>{label('اعتبارسنجی منطق شبکه', 'Validate network logic')}</button>
                    <button className={btn} disabled={busy} onClick={runMip}>{label('امکان‌سنجی پروتکل‌های MIP', 'Assess MIP feasibility')}</button>
                  </div>
                  {cpmResult && (
                    <div className="mt-2 rounded-lg border b-line-soft p-2 text-xs">
                      <p className="tx1">{label('مدت پروژهٔ بازسازی‌شده:', 'Reconstructed project duration:')} <b dir="ltr">{cpmResult.projectDuration}</b> {label('روز', 'days')} · {label('مسیر بحرانی:', 'Critical path:')} <span dir="ltr">{cpmResult.criticalPath.join(' → ')}</span></p>
                      <div className="mt-1 max-h-40 overflow-y-auto thin-scroll">
                        {cpmResult.results.map((r) => (
                          <div key={r.code} className={`flex items-center gap-2 py-0.5 text-[10px] ${r.critical ? 'tx1 font-semibold' : 'tx3'}`}>
                            <span dir="ltr" className="w-16">{r.code}</span>
                            <span dir="ltr">ES {r.es} · EF {r.ef} · TF {r.totalFloat}</span>
                            {r.critical && <span className="rounded bg-rose-500/15 px-1 text-rose-400">{label('بحرانی', 'critical')}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {mipResult && (
                    <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-3">
                      {mipResult.map((a) => (
                        <div key={a.code} className="rounded-lg border b-line-soft p-2 text-[10px]" title={a.reasonFa}>
                          <span className="tx1 font-semibold" dir="ltr">MIP {a.code}</span>
                          <span className={`mr-1 rounded px-1 ${a.feasibility === 'feasible' ? 'bg-emerald-500/15 text-emerald-400' : a.feasibility === 'partial' ? 'bg-amber-500/15 text-amber-400' : 'bg-rose-500/15 text-rose-400'}`}>{fa ? FEASIBILITY_FA[a.feasibility] : a.feasibility}</span>
                          <p className="tx3 mt-1">{a.reasonFa}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* یافته‌های اعتبارسنجی */}
              {validations.length > 0 && (
                <section className="glass-dark rounded-xl p-3">
                  <h5 className="tx1 text-xs font-semibold">{label(`یافته‌های اعتبارسنجی مدل (${openFindings.length} باز از ${validations.length})`, `Validation findings (${openFindings.length} open of ${validations.length})`)}</h5>
                  <div className="mt-1 max-h-48 space-y-1 overflow-y-auto thin-scroll">
                    {validations.map((v) => (
                      <p key={v.Id} className="rounded-lg border b-line-soft p-2 text-[11px] tx2">
                        <span className={`ml-1 rounded px-1 text-[9px] ${v.Severity === 'critical' ? 'bg-rose-500/15 text-rose-400' : v.Severity === 'major' ? 'bg-amber-500/15 text-amber-400' : 'bg-sky-500/15 text-sky-300'}`}>{fa ? SEVERITY_FA[String(v.Severity)] : String(v.Severity)}</span>
                        <span className="ml-1 rounded px-1 bg-white/5 text-[9px] tx3">{fa ? (CHECK_KIND_FA[String(v.CheckKind)] ?? String(v.CheckKind)) : String(v.CheckKind)}</span>
                        {String(v.DetailFa ?? '')}
                        <span className="tx3 text-[9px]"> · {String(v.Resolution)}{v.AutoDetected ? ` · ${label('خودکار', 'auto')}` : ''}</span>
                      </p>
                    ))}
                  </div>
                </section>
              )}

              {/* دیکشنری فعالیت‌ها */}
              {can('sched.recon.edit') && !['completed', 'cancelled'].includes(current.Status) && (
                <section className="glass-dark rounded-xl p-3">
                  <h5 className="tx1 text-xs font-semibold">{label('دیکشنری فعالیت‌های بازسازی‌شده (مرحلهٔ ۵)', 'Reconstructed activity dictionary (step 5)')}</h5>
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
                    <label className="text-[11px] tx3">{label('کد فعالیت', 'Activity code')}<input aria-label={label('کد فعالیت', 'Activity code')} className={inputClass} value={activityForm.Code} onChange={(e) => setActivityForm((f) => ({ ...f, Code: e.target.value }))} /></label>
                    <label className="text-[11px] tx3">{label('عنوان', 'Title')}<input aria-label={label('عنوان فعالیت', 'Activity title')} className={inputClass} value={activityForm.TitleFa} onChange={(e) => setActivityForm((f) => ({ ...f, TitleFa: e.target.value }))} /></label>
                    <label className="text-[11px] tx3">{label('مدت اصلی (روز)', 'Original duration (d)')}<input aria-label={label('مدت اصلی', 'Original duration')} type="number" className={inputClass} value={activityForm.OriginalDuration} onChange={(e) => setActivityForm((f) => ({ ...f, OriginalDuration: e.target.value }))} /></label>
                    <label className="text-[11px] tx3">{label('شروع واقعی', 'Actual start')}<JalaliDateInput ariaLabel={label('شروع واقعی', 'Actual start')} className={inputClass} value={activityForm.ActualStart} onChange={(v) => setActivityForm((f) => ({ ...f, ActualStart: v }))} /></label>
                    <label className="text-[11px] tx3">{label('پایان واقعی', 'Actual finish')}<JalaliDateInput ariaLabel={label('پایان واقعی', 'Actual finish')} className={inputClass} value={activityForm.ActualFinish} onChange={(v) => setActivityForm((f) => ({ ...f, ActualFinish: v }))} /></label>
                  </div>
                  <button className={`${btn} mt-2`} disabled={busy || !activityForm.Code.trim() || !activityForm.TitleFa.trim()} onClick={addActivity}>{label('ثبت فعالیت', 'Add activity')}</button>
                  {activityRows.length > 0 && (
                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto thin-scroll">
                      {activityRows.map((a) => (
                        <p key={a.Id} className="flex items-center gap-2 rounded-lg border b-line-soft p-1.5 text-[11px] tx2">
                          <b dir="ltr">{String(a.Code)}</b> {String(a.TitleFa)}
                          <span className="tx3" dir="ltr">{String(a.OriginalDuration ?? EMPTY_DASH)}d</span>
                          <span className="tx3 text-[10px]">{String(a.ActualStart ?? EMPTY_DASH)} → {String(a.ActualFinish ?? EMPTY_DASH)}</span>
                          <button className={`${btn} !py-0`} disabled={busy} onClick={() => removeRow('PmisSchedReconActivities', a.Id)}>{label('حذف', 'Delete')}</button>
                        </p>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* منطق شبکه */}
              {can('sched.recon.edit') && !['completed', 'cancelled'].includes(current.Status) && activityRows.length > 0 && (
                <section className="glass-dark rounded-xl p-3">
                  <h5 className="tx1 text-xs font-semibold">{label('منطق شبکهٔ بازسازی‌شده؛ FS/SS/FF/SF و Lag (مرحلهٔ ۷)', 'Reconstructed network logic (step 7)')}</h5>
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
                    <label className="text-[11px] tx3">{label('پیش‌نیاز', 'Predecessor')}<select aria-label={label('پیش‌نیاز', 'Predecessor')} className={inputClass} value={logicForm.PredecessorCode} onChange={(e) => setLogicForm((f) => ({ ...f, PredecessorCode: e.target.value }))}><option value="">—</option>{activityRows.map((a) => <option key={a.Id} value={String(a.Code)}>{String(a.Code)}</option>)}</select></label>
                    <label className="text-[11px] tx3">{label('پس‌نیاز', 'Successor')}<select aria-label={label('پس‌نیاز', 'Successor')} className={inputClass} value={logicForm.SuccessorCode} onChange={(e) => setLogicForm((f) => ({ ...f, SuccessorCode: e.target.value }))}><option value="">—</option>{activityRows.map((a) => <option key={a.Id} value={String(a.Code)}>{String(a.Code)}</option>)}</select></label>
                    <label className="text-[11px] tx3">{label('نوع رابطه', 'Relation')}<select aria-label={label('نوع رابطه', 'Relation type')} className={inputClass} value={logicForm.RelType} onChange={(e) => setLogicForm((f) => ({ ...f, RelType: e.target.value }))}>{['FS', 'SS', 'FF', 'SF'].map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
                    <label className="text-[11px] tx3">{label('Lag (روز)', 'Lag (days)')}<input aria-label={label('Lag', 'Lag')} type="number" className={inputClass} value={logicForm.Lag} onChange={(e) => setLogicForm((f) => ({ ...f, Lag: e.target.value }))} /></label>
                    <label className="text-[11px] tx3">{label('مبنای بازسازی', 'Reconstruction basis')}<select aria-label={label('مبنای بازسازی', 'Reconstruction basis')} className={inputClass} value={logicForm.ReconstructionBasis} onChange={(e) => setLogicForm((f) => ({ ...f, ReconstructionBasis: e.target.value }))}>{[['file_record', 'سند فایل'], ['inferred_physical', 'استنباط فیزیکی'], ['inferred_documented', 'استنباط مستندی'], ['assumed', 'فرضی']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
                  </div>
                  <button className={`${btn} mt-2`} disabled={busy || !logicForm.PredecessorCode || !logicForm.SuccessorCode || logicForm.PredecessorCode === logicForm.SuccessorCode} onClick={addLogic}>{label('ثبت رابطه', 'Add relation')}</button>
                  {logicRows.length > 0 && (
                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto thin-scroll">
                      {logicRows.map((l) => (
                        <p key={l.Id} className="flex items-center gap-2 rounded-lg border b-line-soft p-1.5 text-[11px] tx2">
                          <span dir="ltr">{String(l.PredecessorCode)} —{String(l.RelType)}{Number(l.Lag ?? 0) !== 0 ? `+${String(l.Lag)}` : ''}→ {String(l.SuccessorCode)}</span>
                          <span className="tx3 text-[10px]">{String(l.ReconstructionBasis)}</span>
                          <button className={`${btn} !py-0`} disabled={busy} onClick={() => removeRow('PmisSchedReconLogic', l.Id)}>{label('حذف', 'Delete')}</button>
                        </p>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* سوابق ثبت‌شدهٔ سایر مراحل */}
              {(catalog?.childTables ?? []).filter((t) => !['PmisSchedReconActivities', 'PmisSchedReconLogic', 'PmisSchedReconValidations'].includes(t) && (children[t] ?? []).length > 0).map((t) => (
                <section key={t} className="glass-dark rounded-xl p-3">
                  <h5 className="tx1 text-xs font-semibold">{CHILD_TABLE_FA[t] ?? t}</h5>
                  <div className="mt-1 max-h-32 space-y-1 overflow-y-auto thin-scroll">
                    {(children[t] ?? []).map((row) => (
                      <p key={row.Id} className="rounded-lg border b-line-soft p-1.5 text-[11px] tx2" dir="ltr">
                        <b>{String(row.Code ?? '')}</b>
                        {t === 'PmisSchedReconMipMappings' ? ` MIP ${String(row.MipCode ?? '')} · ${String(row.Feasibility ?? EMPTY_DASH)} · ${String(row.FeasibilityReasonFa ?? '')}` : null}
                        {t === 'PmisSchedReconCriticalPaths' ? ` ${label('مدت', 'dur')} ${String(row.TotalDuration ?? EMPTY_DASH)} · snapshot ${String(row.SnapshotCode ?? EMPTY_DASH)}` : null}
                        {t === 'PmisSchedReconSnapshots' ? ` ${String(row.LabelFa ?? '')} · ${String(row.CutoffDate ?? '')}` : null}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
              {criticalRows.length === 0 && mipRows.length === 0 && validations.length === 0 && (
                <p className="tx3 glass-dark rounded-xl p-3 text-[11px]">{label('هنوز خروجی موتوری برای این مأموریت ثبت نشده است؛ پس از ورود فعالیت‌ها و منطق، موتورها را اجرا کنید.', 'No engine output yet; enter activities & logic, then run engines.')}</p>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
