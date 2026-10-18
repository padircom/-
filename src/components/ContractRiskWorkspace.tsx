import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { jsonRequest } from '../services/apiClient';
import JalaliDateInput from './JalaliDateInput';
import ProcessFlowMaps from './ProcessFlowMaps';
import { type Lang } from '../data/framework';

/**
 * PMO-CONTRACT-RISK-ENGINE-V1.0 — «مدیریت ریسک قراردادها و بهبود قرارداد» (d14).
 * همهٔ عددها از /api/cnt-risk می‌آیند؛ دادهٔ خالی = پیام خالی، نه عدد ساختگی.
 * امتیاز ریسک اینجا فقط اولویت‌بندی است و هرگز مبلغ یا مدت تمدید تولید نمی‌کند.
 */

type Row = Record<string, any>;
type Workspace = {
  categories: { code: string; labelFa: string }[];
  risks: Row[]; actions: Row[]; obligations: Row[]; improvements: Row[]; findings: Row[];
  scoringRules: Row[]; assessments: Row[]; contracts: Row[]; amendments: Row[];
  trend: { at: string; riskCode: string; inherent: number; residual: number }[];
  summary: Row; today: string; defaultScoringConfig: Row;
  links: { delayEvents: Row[]; claims: Row[] };
};

const SECTIONS = [
  ['map', 'نقشهٔ فرایند'],
  ['dashboard', 'مرکز کنترل ریسک قراردادی'],
  ['contracts', 'مدیریت قراردادها و نسخه‌ها'],
  ['clauses', 'تحلیل بندهای قرارداد'],
  ['register', 'دفتر ثبت ریسک‌های قراردادی'],
  ['matrix', 'ماتریس ارزیابی و رتبه‌بندی'],
  ['obligations', 'تعهدات و مهلت‌های قراردادی'],
  ['improve', 'پیشنهاد اصلاح و بهبود قرارداد'],
  ['responses', 'برنامهٔ پاسخ به ریسک'],
  ['effectiveness', 'پایش اثربخشی کنترل‌ها'],
  ['links', 'ارتباط با ادعاها، تأخیرات و خسارات'],
  ['reports', 'گزارش‌ها و خروجی‌های مدیریتی'],
  ['settings', 'تنظیمات و کتابخانهٔ قواعد ارزیابی'],
] as const;
type Section = (typeof SECTIONS)[number][0];

const BAND_FA: Record<string, string> = { low: 'پایین', medium: 'متوسط', high: 'بالا', critical: 'بحرانی' };
const BAND_COLOR: Record<string, string> = { low: '#16a34a', medium: '#d97706', high: '#ea580c', critical: '#dc2626' };
const STRAT_FA: Record<string, string> = { avoid: 'اجتناب', mitigate: 'کاهش', transfer: 'انتقال', accept: 'پذیرش آگاهانه', exploit: 'بهره‌برداری از فرصت' };
const IMP_STATUS_FA: Record<string, string> = { draft: 'پیش‌نویس', needs_review: 'نیازمند بررسی', pending_approval: 'در انتظار تأیید', approved: 'تأییدشده', rejected: 'ردشده', superseded: 'جایگزین‌شده', obsolete: 'منسوخ' };
const ACT_STATUS_FA: Record<string, string> = { defined: 'تعریف‌شده', in_progress: 'در حال اجرا', done: 'انجام‌شده', ineffective: 'فاقد اثربخشی', cancelled: 'لغوشده' };
const FINDING_KIND_FA: Record<string, string> = { payment: 'شرط پرداخت', deadline: 'مهلت', extension: 'تمدید مدت', suspension: 'تعلیق', termination: 'خاتمه/فسخ', guarantee: 'ضمانت‌نامه', insurance: 'بیمه', liability: 'مسئولیت و خسارت', variation: 'تغییر مقادیر', obligation_employer: 'تعهد کارفرما', obligation_contractor: 'تعهد پیمانکار', ambiguity: 'ابهام احتمالی', missing_criteria: 'فقدان مهلت/معیار' };
const EMPTY = '—';
const faNum = (v: unknown) => (v === null || v === undefined || v === '' ? EMPTY : String(v));
const faDate = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : EMPTY);

export default function ContractRiskWorkspace({ lang, projectId }: { lang: Lang; projectId: string }) {
  const { user } = useAuth();
  return <Live key={`${projectId}:${user?.id ?? ''}`} lang={lang} projectId={projectId} userId={user?.id ?? null} />;
}

function Live({ lang, projectId, userId }: { lang: Lang; projectId: string; userId: string | null }) {
  const fa = lang === 'fa';
  const [section, setSection] = useState<Section>('map');
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const mounted = useRef(true);
  const base = `/api/cnt-risk/${encodeURIComponent(projectId)}`;

  const [riskForm, setRiskForm] = useState<Row>({ Category: 'payment_cashflow', ControlEffectiveness: 'none', Probability: 3 });
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null);
  const [analyzeText, setAnalyzeText] = useState('');
  const [analyzeContract, setAnalyzeContract] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState<Row | null>(null);
  const [cmpBefore, setCmpBefore] = useState('');
  const [cmpAfter, setCmpAfter] = useState('');
  const [cmpDiff, setCmpDiff] = useState<Row | null>(null);
  const [oblForm, setOblForm] = useState<Row>({ ResponsibleParty: 'contractor' });
  const [impForm, setImpForm] = useState<Row>({});
  const [actForm, setActForm] = useState<Row>({ Strategy: 'mitigate' });
  const [ruleForm, setRuleForm] = useState<Row>({ Version: '1.0' });

  async function load() {
    const seq = ++generation.current;
    setLoading(true);
    const result = await jsonRequest<Workspace>(base + '/workspace', userId, 'GET');
    if (!mounted.current || seq !== generation.current) return;
    setLoading(false);
    if (result.ok) { setWs(result.data); setError(''); } else { setWs(null); setError(result.message); }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; generation.current++; }; }, [projectId, userId]);

  async function mutate(path: string, method: string, body?: unknown, okMsg?: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    const result = await jsonRequest<Row>(base + path, userId, method, body);
    if (!mounted.current) return;
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    if (okMsg) setNotice(okMsg);
    await load();
  }

  async function downloadReport(scope: 'all' | 'critical', format: 'word' | 'pdf') {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch(`${base}/report?scope=${scope}&format=${format}`, { headers: { ...(userId ? { 'x-user-id': userId } : {}) } });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error?.message ?? `خطای ${res.status}`); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `contract-risk-report-${scope}.${format === 'pdf' ? 'pdf' : 'doc'}`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
      setNotice('گزارش دانلود شد');
    } catch (e) { setError(e instanceof Error ? e.message : 'خطا در تولید گزارش'); }
    setBusy(false);
  }

  const s = ws?.summary;
  const overdue = (d?: string | null, status?: string) => Boolean(d && ws && d < ws.today && status !== 'done' && status !== 'cancelled' && status !== 'waived');
  const inputCls = 'glass-row w-full rounded-lg px-2 py-1.5 text-[11px] tx1 outline-none';
  const labelCls = 'mb-1 block text-[10px] font-light tx3';
  const btnCls = 'rounded-lg px-3 py-1.5 text-[11px] font-light transition toggle-on tx1 disabled:opacity-50';
  const ghostCls = 'glass-row rounded-lg px-2.5 py-1 text-[10.5px] font-light tx2 transition hover:tx1 disabled:opacity-50';

  const renderMatrix = (large: boolean) => (
    <div className="overflow-x-auto">
      <table className="border-collapse" dir="ltr">
        <thead><tr><th className="p-1 text-[9px] tx3">P\I</th>{[1, 2, 3, 4, 5].map((i) => <th key={i} className="p-1 text-[9px] tx3">{i}</th>)}</tr></thead>
        <tbody>
          {[5, 4, 3, 2, 1].map((p) => (
            <tr key={p}>
              <th className="p-1 text-[9px] tx3">{p}</th>
              {[1, 2, 3, 4, 5].map((i) => {
                const score = p * i;
                const band = score >= 15 ? 'critical' : score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low';
                const count = ws?.summary?.matrix?.[`${p}x${i}`] ?? 0;
                return <td key={i} className={`border border-white/20 text-center ${large ? 'h-12 w-14' : 'h-8 w-10'}`} style={{ background: `${BAND_COLOR[band]}33` }}>
                  <div className="text-[11px] font-semibold tx1">{count || ''}</div>
                  <div className="text-[8px] tx3">{score}</div>
                </td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 flex gap-3 text-[9px] tx3">{Object.entries(BAND_FA).map(([k, v]) => <span key={k}><span className="inline-block h-2 w-2 rounded-sm" style={{ background: BAND_COLOR[k] }} /> {v}</span>)}</div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold tx1">{fa ? 'مدیریت ریسک قراردادها و بهبود قرارداد' : 'Contract Risk & Improvement'}</h3>
        <span className="text-[9.5px] font-extralight tx3">PMO-CONTRACT-RISK-ENGINE-V1.0 · {fa ? 'امتیاز ریسک فقط برای اولویت‌بندی است؛ مبلغ خسارت یا مدت تمدید از آن ساخته نمی‌شود' : 'risk score is prioritisation only'}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setSection(k)} className={`rounded-lg px-2.5 py-1 text-[10.5px] font-light transition ${section === k ? 'toggle-on tx1' : 'tx3 hover:tx2'}`}>{label}</button>
        ))}
      </div>

      {error && <div className="glass rounded-xl px-3 py-2 text-[11px]" style={{ color: '#dc2626' }}>{error}</div>}
      {notice && <div className="glass rounded-xl px-3 py-2 text-[11px]" style={{ color: '#16a34a' }}>{notice}</div>}
      {section === 'map' && (
        <ProcessFlowMaps lang={lang} only={['integrated', 'risk']} defaultMap="risk" onNavigate={(t) => setSection(t as Section)} />
      )}

      {loading && <div className="py-8 text-center text-[11px] tx3">{fa ? 'در حال بارگذاری…' : 'Loading…'}</div>}

      {!loading && ws && section === 'dashboard' && s && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              ['کل ریسک‌ها', s.totalRisks], ['بحرانی (ذاتی)', s.critical], ['بالا', s.high], ['متوسط', s.medium], ['پایین', s.low],
              ['ارزیابی‌نشده', s.unassessed], ['فاقد مالک', s.ownerless], ['کنترل ناکافی', s.inadequateControl],
              ['باقیماندهٔ بحرانی', s.residualCritical], ['اقدامات معوق', s.overdueActions], ['تعهدات سررسیدگذشته', s.overdueObligations],
              ['پیشنهاد اصلاح در انتظار تأیید', s.improvementsPendingApproval], ['بند نیازمند بررسی', s.clausesNeedingReview], ['ریسک مرتبط با ادعای فعال', s.linkedActiveClaims],
            ].map(([t, v]) => (
              <div key={t as string} className="glass rounded-xl px-3 py-2"><div className="text-[18px] font-semibold tx1">{faNum(v)}</div><div className="text-[9.5px] font-extralight tx3">{t}</div></div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="glass rounded-2xl p-3"><h4 className="mb-2 text-[12px] font-medium tx1">ماتریس احتمال × اثر (ذاتی)</h4>{renderMatrix(false)}</div>
            <div className="glass rounded-2xl p-3">
              <h4 className="mb-2 text-[12px] font-medium tx1">روند امتیاز ریسک (سوابق ارزیابی)</h4>
              {ws.trend.length === 0 ? <p className="text-[11px] tx3">هنوز سابقهٔ ارزیابی ثبت نشده است.</p> : (
                <div className="flex h-28 items-end gap-1" dir="ltr">{ws.trend.slice(-24).map((t, i) => (
                  <div key={i} className="flex-1 rounded-t" title={`${t.riskCode} · ذاتی ${t.inherent} · باقیمانده ${t.residual}`} style={{ height: `${Math.max(6, (t.inherent / 25) * 100)}%`, background: BAND_COLOR[t.inherent >= 15 ? 'critical' : t.inherent >= 10 ? 'high' : t.inherent >= 5 ? 'medium' : 'low'] }} />
                ))}</div>
              )}
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="glass rounded-2xl p-3">
              <h4 className="mb-2 text-[12px] font-medium tx1">ریسک‌های بحرانی و بالا</h4>
              {(s.criticalList ?? []).length === 0 ? <p className="text-[11px] tx3">ریسک بحرانی یا بالایی ثبت نشده است.</p> : (s.criticalList as Row[]).map((r) => (
                <div key={r.Id} className="glass-row mb-1 flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px]">
                  <span className="tx1">{r.Code} · {r.TitleFa}</span>
                  <span className="rounded px-1.5 py-0.5 text-[9.5px]" style={{ background: `${BAND_COLOR[r.InherentBand]}33`, color: BAND_COLOR[r.InherentBand] }}>{faNum(r.InherentScore)} · {BAND_FA[r.InherentBand] ?? EMPTY}</span>
                </div>
              ))}
            </div>
            <div className="glass rounded-2xl p-3">
              <h4 className="mb-2 text-[12px] font-medium tx1">اقدامات و تعهدات معوق</h4>
              {[...ws.actions.filter((a) => overdue(a.DueDate, a.Status)), ...ws.obligations.filter((o) => overdue(o.DueDate, o.Status))].slice(0, 12).map((a, i) => (
                <div key={i} className="glass-row mb-1 flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px]">
                  <span className="tx1">{a.Code} · {a.TitleFa}</span><span className="text-[9.5px]" style={{ color: '#dc2626' }}>موعد: {faDate(a.DueDate)}</span>
                </div>
              ))}
              {ws.actions.filter((a) => overdue(a.DueDate, a.Status)).length + ws.obligations.filter((o) => overdue(o.DueDate, o.Status)).length === 0 && <p className="text-[11px] tx3">مورد معوقی وجود ندارد.</p>}
            </div>
          </div>
        </div>
      )}

      {!loading && ws && section === 'contracts' && (
        <div className="flex flex-col gap-3">
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-2 text-[12px] font-medium tx1">قراردادهای پروژه (از شناسنامهٔ پیمان — بازنویسی نمی‌شوند)</h4>
            {ws.contracts.length === 0 ? <p className="text-[11px] tx3">قراردادی برای این پروژه ثبت نشده است.</p> : ws.contracts.map((c) => (
              <div key={c.Id} className="glass-row mb-1 rounded-lg px-2 py-1.5 text-[11px] tx2">{c.Code} · {c.TitleFa ?? c.NameFa ?? EMPTY} · کارفرما: {faNum(c.ClientNameFa ?? c.EmployerFa)} · پیمانکار: {faNum(c.ContractorNameFa)} · مبلغ: {faNum(c.Amount)} {faNum(c.Currency)}</div>
            ))}
            {ws.amendments.length > 0 && <>
              <h4 className="mb-2 mt-3 text-[12px] font-medium tx1">الحاقیه‌ها و اصلاحیه‌ها</h4>
              {ws.amendments.map((a) => <div key={a.Id} className="glass-row mb-1 rounded-lg px-2 py-1.5 text-[11px] tx2">{a.Code} · {a.TitleFa} · از {faDate(a.EffectiveDate)}</div>)}
            </>}
          </div>
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-2 text-[12px] font-medium tx1">مقایسهٔ نسخه‌های قرارداد (در سطح بند)</h4>
            <div className="grid gap-2 md:grid-cols-2">
              <textarea className={inputCls} rows={6} placeholder="متن نسخهٔ قبلی…" value={cmpBefore} onChange={(e) => setCmpBefore(e.target.value)} />
              <textarea className={inputCls} rows={6} placeholder="متن نسخهٔ جدید…" value={cmpAfter} onChange={(e) => setCmpAfter(e.target.value)} />
            </div>
            <button type="button" className={`${btnCls} mt-2`} disabled={busy} onClick={async () => { setBusy(true); const r = await jsonRequest<Row>(base + '/compare', userId, 'POST', { TextBefore: cmpBefore, TextAfter: cmpAfter }); setBusy(false); if (r.ok) setCmpDiff(r.data.diff); else setError(r.message); }}>مقایسه</button>
            {cmpDiff && <div className="mt-2 grid gap-2 text-[11px] md:grid-cols-3">
              <div><div className="tx3">افزوده‌شده ({cmpDiff.added.length})</div>{cmpDiff.added.map((x: Row, i: number) => <div key={i} className="glass-row mt-1 rounded-lg px-2 py-1 tx2">{x.clauseNo}: {x.excerpt}…</div>)}</div>
              <div><div className="tx3">تغییرکرده ({cmpDiff.changed.length})</div>{cmpDiff.changed.map((x: Row, i: number) => <div key={i} className="glass-row mt-1 rounded-lg px-2 py-1 tx2">{x.clauseNo}<br /><span style={{ color: '#dc2626' }}>قبل: {x.beforeExcerpt}…</span><br /><span style={{ color: '#16a34a' }}>بعد: {x.afterExcerpt}…</span></div>)}</div>
              <div><div className="tx3">حذف‌شده ({cmpDiff.removed.length})</div>{cmpDiff.removed.map((x: Row, i: number) => <div key={i} className="glass-row mt-1 rounded-lg px-2 py-1 tx2">{x.clauseNo}: {x.excerpt}…</div>)}<div className="mt-1 tx3">بدون تغییر: {cmpDiff.unchangedCount}</div></div>
            </div>}
          </div>
        </div>
      )}

      {!loading && ws && section === 'clauses' && (
        <div className="flex flex-col gap-3">
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-1 text-[12px] font-medium tx1">تحلیل بندهای قرارداد (ContractClauseAnalysisService)</h4>
            <p className="mb-2 text-[10px] font-extralight tx3">قاعده‌محور و صادقانه؛ بدون LLM متصل. سند اسکن‌شده یا متن ناقص، یافتهٔ قطعی تولید نمی‌کند. هر یافته تا بررسی کارشناس «پیشنهاد» است.</p>
            <div className="mb-2 grid gap-2 md:grid-cols-3">
              <div><label className={labelCls}>کد قرارداد</label><input className={inputCls} value={analyzeContract} onChange={(e) => setAnalyzeContract(e.target.value)} placeholder="مثلاً CNT-01" /></div>
            </div>
            <textarea className={inputCls} rows={7} placeholder="متن استخراج‌شدهٔ قرارداد را اینجا بچسبانید (از EDMS)…" value={analyzeText} onChange={(e) => setAnalyzeText(e.target.value)} />
            <button type="button" className={`${btnCls} mt-2`} disabled={busy} onClick={async () => { setBusy(true); const r = await jsonRequest<Row>(base + '/analyze', userId, 'POST', { Text: analyzeText, ContractCode: analyzeContract || null, SourceLabel: 'متن قرارداد' }); setBusy(false); if (r.ok) { setAnalyzeResult(r.data.analysis); setNotice(r.data.analysis.status === 'analyzed' ? `${r.data.findings.length} یافته ذخیره شد` : ''); await load(); } else setError(r.message); }}>تحلیل متن</button>
            {analyzeResult && analyzeResult.status === 'not_extractable' && <p className="mt-2 text-[11px]" style={{ color: '#d97706' }}>{(analyzeResult.warningsFa ?? []).join(' ')}</p>}
          </div>
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-2 text-[12px] font-medium tx1">یافته‌ها ({ws.findings.length})</h4>
            {ws.findings.length === 0 ? <p className="text-[11px] tx3">یافته‌ای ثبت نشده است.</p> : ws.findings.map((f) => (
              <div key={f.Id} className="glass-row mb-1 rounded-lg px-2 py-1.5 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tx1">{FINDING_KIND_FA[f.Kind] ?? f.Kind} · بند {faNum(f.ClauseNo)} · اطمینان {faNum(f.Confidence)}</span>
                  <span className="text-[9.5px] tx3">{f.ReviewStatus === 'accepted' ? 'پذیرفته‌شده' : f.ReviewStatus === 'rejected' ? 'ردشده' : 'در انتظار بررسی'}</span>
                </div>
                <div className="tx2">{f.FindingFa}</div>
                <div className="text-[10px] tx3">{f.SourceRef}</div>
                {f.ReviewStatus === 'pending' && <div className="mt-1 flex gap-1.5">
                  <button type="button" className={ghostCls} disabled={busy} onClick={() => void mutate(`/findings/${f.Id}/review`, 'PATCH', { ReviewStatus: 'accepted' }, 'یافته پذیرفته شد')}>پذیرش</button>
                  <button type="button" className={ghostCls} disabled={busy} onClick={() => void mutate(`/findings/${f.Id}/review`, 'PATCH', { ReviewStatus: 'rejected' }, 'یافته رد شد')}>رد</button>
                </div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && ws && section === 'register' && (
        <div className="flex flex-col gap-3">
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-2 text-[12px] font-medium tx1">{editingRiskId ? 'ویرایش ریسک' : 'ثبت ریسک قراردادی'}</h4>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="md:col-span-2"><label className={labelCls}>عنوان ریسک *</label><input className={inputCls} value={riskForm.TitleFa ?? ''} onChange={(e) => setRiskForm({ ...riskForm, TitleFa: e.target.value })} /></div>
              <div><label className={labelCls}>دسته</label><select className={inputCls} value={riskForm.Category} onChange={(e) => setRiskForm({ ...riskForm, Category: e.target.value })}>{ws.categories.map((c) => <option key={c.code} value={c.code}>{c.labelFa}</option>)}</select></div>
              <div><label className={labelCls}>کد قرارداد</label><input className={inputCls} value={riskForm.ContractCode ?? ''} onChange={(e) => setRiskForm({ ...riskForm, ContractCode: e.target.value })} /></div>
              <div><label className={labelCls}>بند منشأ</label><input className={inputCls} value={riskForm.ClauseRef ?? ''} onChange={(e) => setRiskForm({ ...riskForm, ClauseRef: e.target.value })} /></div>
              <div><label className={labelCls}>مالک ریسک</label><input className={inputCls} value={riskForm.Owner ?? ''} onChange={(e) => setRiskForm({ ...riskForm, Owner: e.target.value })} /></div>
              {[['Probability', 'احتمال (۱–۵)'], ['ImpactTime', 'اثر زمانی'], ['ImpactFinancial', 'اثر مالی'], ['ImpactLegal', 'اثر حقوقی'], ['ImpactOperational', 'اثر عملیاتی'], ['ImpactQuality', 'اثر کیفی']].map(([k, t]) => (
                <div key={k}><label className={labelCls}>{t}</label><input type="number" min={1} max={5} className={inputCls} value={riskForm[k] ?? ''} onChange={(e) => setRiskForm({ ...riskForm, [k]: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              ))}
              <div><label className={labelCls}>اثربخشی کنترل موجود</label><select className={inputCls} value={riskForm.ControlEffectiveness} onChange={(e) => setRiskForm({ ...riskForm, ControlEffectiveness: e.target.value })}><option value="none">بدون کنترل</option><option value="weak">ضعیف</option><option value="partial">نسبی (نیازمند شاهد)</option><option value="strong">قوی (نیازمند شاهد)</option></select></div>
              <div><label className={labelCls}>کد رویداد تأخیر (پیوند نرم)</label><input className={inputCls} value={riskForm.DelayEventCode ?? ''} onChange={(e) => setRiskForm({ ...riskForm, DelayEventCode: e.target.value })} /></div>
              <div><label className={labelCls}>کد پروندهٔ خسارت (پیوند نرم)</label><input className={inputCls} value={riskForm.ClaimCode ?? ''} onChange={(e) => setRiskForm({ ...riskForm, ClaimCode: e.target.value })} /></div>
              <div><label className={labelCls}>بازبینی بعدی</label><JalaliDateInput value={riskForm.NextReviewDate ?? ''} onChange={(iso) => setRiskForm({ ...riskForm, NextReviewDate: iso })} /></div>
              <div className="md:col-span-3"><label className={labelCls}>شرح / علت / پیامد</label><textarea className={inputCls} rows={2} value={riskForm.DescriptionFa ?? ''} onChange={(e) => setRiskForm({ ...riskForm, DescriptionFa: e.target.value })} /></div>
              <div className="md:col-span-3"><label className={labelCls}>کنترل‌های موجود</label><textarea className={inputCls} rows={2} value={riskForm.ExistingControlsFa ?? ''} onChange={(e) => setRiskForm({ ...riskForm, ExistingControlsFa: e.target.value })} /></div>
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" className={btnCls} disabled={busy} onClick={() => void mutate(editingRiskId ? `/risks/${editingRiskId}` : '/risks', editingRiskId ? 'PATCH' : 'POST', riskForm, 'ریسک ذخیره و امتیازدهی شد').then(() => { setEditingRiskId(null); setRiskForm({ Category: 'payment_cashflow', ControlEffectiveness: 'none', Probability: 3 }); })}>{editingRiskId ? 'ذخیرهٔ ویرایش' : 'ثبت ریسک'}</button>
              {editingRiskId && <button type="button" className={ghostCls} onClick={() => { setEditingRiskId(null); setRiskForm({ Category: 'payment_cashflow', ControlEffectiveness: 'none', Probability: 3 }); }}>انصراف</button>}
            </div>
          </div>
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-2 text-[12px] font-medium tx1">دفتر ثبت ریسک‌ها ({ws.risks.length})</h4>
            {ws.risks.length === 0 ? <p className="text-[11px] tx3">هنوز ریسکی ثبت نشده است.</p> : ws.risks.map((r) => (
              <div key={r.Id} className="glass-row mb-1 rounded-lg px-2 py-1.5 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tx1">{r.Code} · {r.TitleFa}</span>
                  <span className="flex gap-1.5">
                    <span className="rounded px-1.5 py-0.5 text-[9.5px]" style={{ background: `${BAND_COLOR[r.InherentBand] ?? '#888'}33`, color: BAND_COLOR[r.InherentBand] ?? '#888' }}>ذاتی {faNum(r.InherentScore)} · {BAND_FA[r.InherentBand] ?? EMPTY}</span>
                    <span className="rounded px-1.5 py-0.5 text-[9.5px]" style={{ background: `${BAND_COLOR[r.ResidualBand] ?? '#888'}33`, color: BAND_COLOR[r.ResidualBand] ?? '#888' }}>باقیمانده {faNum(r.ResidualScore)} · {BAND_FA[r.ResidualBand] ?? EMPTY}</span>
                  </span>
                </div>
                <div className="text-[10px] tx3">{ws.categories.find((c) => c.code === r.Category)?.labelFa ?? r.Category} · مالک: {faNum(r.Owner)} · بند: {faNum(r.ClauseRef)} · روش: {faNum(r.ScoringVersion)}</div>
                <div className="mt-1 flex gap-1.5">
                  <button type="button" className={ghostCls} onClick={() => { setEditingRiskId(r.Id); setRiskForm({ ...r }); }}>ویرایش</button>
                  <button type="button" className={ghostCls} disabled={busy} onClick={() => void mutate(`/risks/${r.Id}/reassess`, 'POST', {}, 'ارزیابی مجدد ثبت شد')}>ارزیابی مجدد</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && ws && section === 'matrix' && (
        <div className="glass rounded-2xl p-3">
          <h4 className="mb-2 text-[12px] font-medium tx1">ماتریس ۵×۵ و روش امتیازدهی</h4>
          {renderMatrix(true)}
          <p className="mt-2 text-[11px] tx2">امتیاز ذاتی = احتمال × اثر وزن‌دار پنج‌بعدی. وزن ابعاد (روش پیش‌فرض {ws.defaultScoringConfig.version}): زمانی {ws.defaultScoringConfig.impactWeights.time} · مالی {ws.defaultScoringConfig.impactWeights.financial} · حقوقی {ws.defaultScoringConfig.impactWeights.legal} · عملیاتی {ws.defaultScoringConfig.impactWeights.operational} · کیفی {ws.defaultScoringConfig.impactWeights.quality}. آستانه‌ها: بحرانی ≥{ws.defaultScoringConfig.bands.critical} · بالا ≥{ws.defaultScoringConfig.bands.high} · متوسط ≥{ws.defaultScoringConfig.bands.medium}.</p>
          <p className="text-[11px] tx3">ریسک باقیمانده فقط با کنترلِ دارای شاهد اجرایی کم می‌شود؛ کاهش دستی امتیاز ممکن نیست. قاعدهٔ سازمانی از بخش «تنظیمات و کتابخانهٔ قواعد» ساخته و تصویب می‌شود.</p>
        </div>
      )}

      {!loading && ws && section === 'obligations' && (
        <div className="flex flex-col gap-3">
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-2 text-[12px] font-medium tx1">ثبت تعهد قراردادی</h4>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="md:col-span-2"><label className={labelCls}>شرح تعهد *</label><input className={inputCls} value={oblForm.TitleFa ?? ''} onChange={(e) => setOblForm({ ...oblForm, TitleFa: e.target.value })} /></div>
              <div><label className={labelCls}>بند مرتبط</label><input className={inputCls} value={oblForm.ClauseRef ?? ''} onChange={(e) => setOblForm({ ...oblForm, ClauseRef: e.target.value })} /></div>
              <div><label className={labelCls}>طرف مسئول</label><select className={inputCls} value={oblForm.ResponsibleParty} onChange={(e) => setOblForm({ ...oblForm, ResponsibleParty: e.target.value })}><option value="employer">کارفرما</option><option value="contractor">پیمانکار</option><option value="consultant">مشاور</option><option value="third_party">شخص ثالث</option></select></div>
              <div><label className={labelCls}>موعد انجام</label><JalaliDateInput value={oblForm.DueDate ?? ''} onChange={(iso) => setOblForm({ ...oblForm, DueDate: iso })} /></div>
              <div><label className={labelCls}>سند اثبات انجام (شناسهٔ EDMS)</label><input className={inputCls} value={oblForm.EvidenceDocumentId ?? ''} onChange={(e) => setOblForm({ ...oblForm, EvidenceDocumentId: e.target.value })} /></div>
            </div>
            <button type="button" className={`${btnCls} mt-2`} disabled={busy} onClick={() => void mutate('/obligations', 'POST', oblForm, 'تعهد ثبت شد').then(() => setOblForm({ ResponsibleParty: 'contractor' }))}>ثبت تعهد</button>
          </div>
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-2 text-[12px] font-medium tx1">تعهدات ({ws.obligations.length})</h4>
            {ws.obligations.length === 0 ? <p className="text-[11px] tx3">تعهدی ثبت نشده است.</p> : ws.obligations.map((o) => (
              <div key={o.Id} className="glass-row mb-1 flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px]">
                <span className="tx1">{o.Code} · {o.TitleFa} <span className="tx3">· بند {faNum(o.ClauseRef)} · موعد {faDate(o.DueDate)}</span></span>
                <span className="flex items-center gap-1.5">
                  {overdue(o.DueDate, o.Status) && <span className="text-[9.5px]" style={{ color: '#dc2626' }}>سررسیدگذشته</span>}
                  <span className="text-[10px] tx3">{o.Status === 'done' ? 'انجام‌شده' : o.Status === 'waived' ? 'چشم‌پوشی‌شده' : o.Status === 'cancelled' ? 'لغوشده' : 'در انتظار'}</span>
                  {o.Status === 'pending' && <button type="button" className={ghostCls} disabled={busy} onClick={() => void mutate(`/obligations/${o.Id}`, 'PATCH', { Status: 'done' }, 'تعهد انجام‌شده ثبت شد')}>ثبت انجام</button>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && ws && section === 'improve' && (
        <div className="flex flex-col gap-3">
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-1 text-[12px] font-medium tx1">پیشنهاد اصلاح بند</h4>
            <p className="mb-2 text-[10px] font-extralight tx3">پیشنهاد (حتی مصوب) متن قرارداد اصلی را تغییر نمی‌دهد؛ تغییر رسمی فقط از مسیر الحاقیهٔ ماژول پیمان است. هیچ استناد حقوقی ساختگی تولید نمی‌شود.</p>
            <div className="grid gap-2 md:grid-cols-2">
              <div><label className={labelCls}>ارجاع بند</label><input className={inputCls} value={impForm.ClauseRef ?? ''} onChange={(e) => setImpForm({ ...impForm, ClauseRef: e.target.value })} placeholder="مثلاً ماده ۵۰" /></div>
              <div><label className={labelCls}>کد ریسک مرتبط</label><input className={inputCls} value={impForm.RiskCode ?? ''} onChange={(e) => setImpForm({ ...impForm, RiskCode: e.target.value })} /></div>
              <div><label className={labelCls}>متن فعلی بند</label><textarea className={inputCls} rows={4} value={impForm.CurrentText ?? ''} onChange={(e) => setImpForm({ ...impForm, CurrentText: e.target.value })} /></div>
              <div><label className={labelCls}>متن جایگزین پیشنهادی</label><textarea className={inputCls} rows={4} value={impForm.ProposedText ?? ''} onChange={(e) => setImpForm({ ...impForm, ProposedText: e.target.value })} /></div>
              <div><label className={labelCls}>مشکل/ابهام شناسایی‌شده</label><textarea className={inputCls} rows={2} value={impForm.ProblemFa ?? ''} onChange={(e) => setImpForm({ ...impForm, ProblemFa: e.target.value })} /></div>
              <div><label className={labelCls}>دلیل و مبنای پیشنهاد</label><textarea className={inputCls} rows={2} value={impForm.ReasonFa ?? ''} onChange={(e) => setImpForm({ ...impForm, ReasonFa: e.target.value })} /></div>
              <div><label className={labelCls}>اثر بر کارفرما</label><input className={inputCls} value={impForm.EffectEmployerFa ?? ''} onChange={(e) => setImpForm({ ...impForm, EffectEmployerFa: e.target.value })} /></div>
              <div><label className={labelCls}>اثر بر پیمانکار / هزینه و زمان</label><input className={inputCls} value={impForm.EffectCostTimeFa ?? ''} onChange={(e) => setImpForm({ ...impForm, EffectCostTimeFa: e.target.value })} /></div>
            </div>
            <button type="button" className={`${btnCls} mt-2`} disabled={busy} onClick={() => void mutate('/improvements', 'POST', impForm, 'پیشنهاد اصلاح ثبت شد').then(() => setImpForm({}))}>ثبت پیشنهاد</button>
          </div>
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-2 text-[12px] font-medium tx1">پیشنهادها ({ws.improvements.length})</h4>
            {ws.improvements.length === 0 ? <p className="text-[11px] tx3">پیشنهادی ثبت نشده است.</p> : ws.improvements.map((im) => (
              <div key={im.Id} className="glass-row mb-1 rounded-lg px-2 py-1.5 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="tx1">{im.Code} · بند {faNum(im.ClauseRef)}</span><span className="text-[10px] tx3">{IMP_STATUS_FA[im.Status] ?? im.Status}</span></div>
                <div className="mt-1 grid gap-2 md:grid-cols-2">
                  <div className="rounded-lg px-2 py-1" style={{ background: '#dc262611' }}><div className="text-[9px] tx3">متن فعلی</div><span className="tx2">{faNum(im.CurrentText)}</span></div>
                  <div className="rounded-lg px-2 py-1" style={{ background: '#16a34a11' }}><div className="text-[9px] tx3">متن پیشنهادی</div><span className="tx2">{faNum(im.ProposedText)}</span></div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {im.Status === 'draft' && <button type="button" className={ghostCls} disabled={busy} onClick={() => void mutate(`/improvements/${im.Id}`, 'PATCH', { Status: 'pending_approval' }, 'برای تأیید ارسال شد')}>ارسال برای تأیید</button>}
                  {['draft', 'needs_review', 'pending_approval'].includes(im.Status) && <>
                    <button type="button" className={ghostCls} disabled={busy} onClick={() => void mutate(`/improvements/${im.Id}/decide`, 'POST', { Decision: 'approved' }, 'پیشنهاد تصویب شد')}>تصویب (مجاز)</button>
                    <button type="button" className={ghostCls} disabled={busy} onClick={() => void mutate(`/improvements/${im.Id}/decide`, 'POST', { Decision: 'rejected' }, 'پیشنهاد رد شد')}>رد (مجاز)</button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && ws && section === 'responses' && (
        <div className="flex flex-col gap-3">
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-2 text-[12px] font-medium tx1">تعریف اقدام پاسخ</h4>
            <div className="grid gap-2 md:grid-cols-3">
              <div><label className={labelCls}>کد ریسک *</label><input className={inputCls} value={actForm.RiskCode ?? ''} onChange={(e) => setActForm({ ...actForm, RiskCode: e.target.value })} placeholder="CR-…" /></div>
              <div><label className={labelCls}>راهبرد</label><select className={inputCls} value={actForm.Strategy} onChange={(e) => setActForm({ ...actForm, Strategy: e.target.value })}>{Object.entries(STRAT_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className={labelCls}>مجری</label><input className={inputCls} value={actForm.Owner ?? ''} onChange={(e) => setActForm({ ...actForm, Owner: e.target.value })} /></div>
              <div className="md:col-span-2"><label className={labelCls}>شرح اقدام</label><input className={inputCls} value={actForm.TitleFa ?? ''} onChange={(e) => setActForm({ ...actForm, TitleFa: e.target.value })} /></div>
              <div><label className={labelCls}>موعد تکمیل</label><JalaliDateInput value={actForm.DueDate ?? ''} onChange={(iso) => setActForm({ ...actForm, DueDate: iso })} /></div>
              <div><label className={labelCls}>شاخص سنجش اثربخشی</label><input className={inputCls} value={actForm.EffectivenessMetricFa ?? ''} onChange={(e) => setActForm({ ...actForm, EffectivenessMetricFa: e.target.value })} /></div>
              <div><label className={labelCls}>هزینهٔ اقدام</label><input type="number" className={inputCls} value={actForm.Cost ?? ''} onChange={(e) => setActForm({ ...actForm, Cost: e.target.value })} /></div>
            </div>
            <button type="button" className={`${btnCls} mt-2`} disabled={busy} onClick={() => void mutate('/actions', 'POST', actForm, 'اقدام پاسخ ثبت شد').then(() => setActForm({ Strategy: 'mitigate' }))}>ثبت اقدام</button>
          </div>
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-2 text-[12px] font-medium tx1">اقدامات ({ws.actions.length})</h4>
            {ws.actions.length === 0 ? <p className="text-[11px] tx3">اقدامی تعریف نشده است.</p> : ws.actions.map((a) => (
              <div key={a.Id} className="glass-row mb-1 rounded-lg px-2 py-1.5 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tx1">{a.Code} · {a.TitleFa} <span className="tx3">· {a.RiskCode} · {STRAT_FA[a.Strategy] ?? a.Strategy}</span></span>
                  <span className="text-[10px] tx3">{ACT_STATUS_FA[a.Status] ?? a.Status} · پیشرفت {faNum(a.ProgressPct)}٪{overdue(a.DueDate, a.Status) && <span style={{ color: '#dc2626' }}> · معوق</span>}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {a.Status !== 'done' && <>
                    <button type="button" className={ghostCls} disabled={busy} onClick={() => void mutate(`/actions/${a.Id}`, 'PATCH', { Status: 'in_progress', ProgressPct: 50 }, 'اقدام در حال اجرا شد')}>شروع/پیشرفت ۵۰٪</button>
                    <button type="button" className={ghostCls} disabled={busy} onClick={() => void mutate(`/actions/${a.Id}`, 'PATCH', { Status: 'ineffective', EffectivenessNoteFa: 'پس از اجرا اثربخشی مشاهده نشد؛ اقدام جایگزین لازم است' }, 'فاقد اثربخشی ثبت شد')}>ثبت عدم اثربخشی</button>
                  </>}
                </div>
              </div>
            ))}
            <p className="mt-1 text-[10px] tx3">بستن اقدام (done) از API فقط با مدرک اجرای EDMS ممکن است؛ پس از بستن، «ارزیابی مجدد» ریسک از دفتر ثبت انجام می‌شود.</p>
          </div>
        </div>
      )}

      {!loading && ws && section === 'effectiveness' && (
        <div className="glass rounded-2xl p-3">
          <h4 className="mb-2 text-[12px] font-medium tx1">اثربخشی کنترل‌ها: ذاتی ← باقیمانده</h4>
          {ws.risks.length === 0 ? <p className="text-[11px] tx3">ریسکی برای پایش وجود ندارد.</p> : ws.risks.map((r) => {
            const acts = ws.actions.filter((a) => a.RiskCode === r.Code);
            return (
              <div key={r.Id} className="glass-row mb-1 rounded-lg px-2 py-1.5 text-[11px]">
                <div className="flex flex-wrap items-center justify-between"><span className="tx1">{r.Code} · {r.TitleFa}</span><span className="text-[10px] tx3">کنترل: {faNum(r.ControlEffectiveness)} · اقدامات: {acts.filter((a) => a.Status === 'done').length} انجام‌شده / {acts.filter((a) => a.Status === 'ineffective').length} بی‌اثر / {acts.length} کل</span></div>
                <div className="mt-1 flex items-center gap-2" dir="ltr">
                  <div className="h-2.5 rounded" style={{ width: `${((r.InherentScore ?? 0) / 25) * 100}%`, background: BAND_COLOR[r.InherentBand] ?? '#888' }} />
                  <span className="text-[9.5px] tx3">ذاتی {faNum(r.InherentScore)}</span>
                  <div className="h-2.5 rounded opacity-70" style={{ width: `${((r.ResidualScore ?? 0) / 25) * 100}%`, background: BAND_COLOR[r.ResidualBand] ?? '#888' }} />
                  <span className="text-[9.5px] tx3">باقیمانده {faNum(r.ResidualScore)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && ws && section === 'links' && (
        <div className="glass rounded-2xl p-3">
          <h4 className="mb-1 text-[12px] font-medium tx1">پیوند ریسک با تأخیرات و خسارات</h4>
          <p className="mb-2 text-[10px] font-extralight tx3">پیوند فقط با کد مشترک است. وجود ریسک، وقوع تأخیر یا استحقاق خسارت را ثابت نمی‌کند و هیچ مبلغ/مدتی خودکار منتقل نمی‌شود؛ مبالغ زیر فقط نمایشِ دادهٔ موجود ماژول خسارت است.</p>
          {ws.risks.filter((r) => r.DelayEventCode || r.ClaimCode).length === 0 ? <p className="text-[11px] tx3">ریسک پیوندخورده‌ای وجود ندارد؛ کد رویداد تأخیر یا پروندهٔ خسارت را در فرم ریسک ثبت کنید.</p> : ws.risks.filter((r) => r.DelayEventCode || r.ClaimCode).map((r) => {
            const claim = ws.links.claims.find((c) => c.code === r.ClaimCode);
            const delay = ws.links.delayEvents.find((d) => d.code === r.DelayEventCode);
            return (
              <div key={r.Id} className="glass-row mb-1 rounded-lg px-2 py-1.5 text-[11px] tx2">
                {r.Code} · {r.TitleFa}
                {delay && <span className="tx3"> · رویداد تأخیر {delay.code}: {delay.titleFa} ({faNum(delay.status)})</span>}
                {claim && <span className="tx3"> · پروندهٔ خسارت {claim.code}: {claim.titleFa} ({faNum(claim.status)}) · مبلغ ثبت‌شده {faNum(claim.amount)} · تأییدشده {faNum(claim.approvedAmount)}</span>}
                {(r.DelayEventCode && !delay) && <span style={{ color: '#d97706' }}> · رویداد {r.DelayEventCode} در ماژول تأخیرات یافت نشد</span>}
                {(r.ClaimCode && !claim) && <span style={{ color: '#d97706' }}> · پروندهٔ {r.ClaimCode} در ماژول خسارت یافت نشد</span>}
              </div>
            );
          })}
        </div>
      )}

      {!loading && ws && section === 'reports' && (
        <div className="glass rounded-2xl p-3">
          <h4 className="mb-1 text-[12px] font-medium tx1">گزارش‌ها و خروجی‌های مدیریتی</h4>
          <p className="mb-2 text-[11px] tx3">گزارش از داده‌های واقعی همین لحظه ساخته می‌شود (۱۳ فصل: خلاصهٔ مدیریتی، ماتریس، ریسک‌های بحرانی، باقیمانده‌ها، تعهدات سررسیدگذشته، اقدامات معوق، بندهای نیازمند اصلاح، مقایسهٔ سوابق قرارداد، پیوند تأخیر/خسارت، روند و یافته‌های بندها). تاریخ تهیه و فیلتر اعمال‌شده داخل سند درج می‌شود.</p>
          <div className="flex flex-wrap gap-2">
            {([['all', 'گزارش جامع'], ['critical', 'گزارش ریسک‌های بحرانی و بالا']] as const).map(([scope, t]) => (
              <span key={scope} className="flex gap-1.5">
                <button type="button" className={btnCls} disabled={busy} onClick={() => void downloadReport(scope, 'word')}>{t} — Word</button>
                <button type="button" className={ghostCls} disabled={busy} onClick={() => void downloadReport(scope, 'pdf')}>{t} — PDF</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {!loading && ws && section === 'settings' && (
        <div className="flex flex-col gap-3">
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-1 text-[12px] font-medium tx1">کتابخانهٔ قواعد امتیازدهی</h4>
            <p className="mb-2 text-[10px] font-extralight tx3">تا وقتی قاعدهٔ سازمانی تصویب نشده، روش پیش‌فرض {ws.defaultScoringConfig.version} با وضعیت «نیازمند بازبینی» به‌کار می‌رود. تصویب با سازنده نیست (تفکیک وظایف).</p>
            {ws.scoringRules.length === 0 ? <p className="text-[11px] tx3">قاعدهٔ سازمانی ثبت نشده است.</p> : ws.scoringRules.map((r) => (
              <div key={r.Id} className="glass-row mb-1 flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px]">
                <span className="tx1">{r.Code} · {r.NameFa} · نسخه {r.Version}</span>
                <span className="flex items-center gap-1.5"><span className="text-[10px] tx3">{r.Status === 'approved' ? `تصویب‌شده توسط ${faNum(r.ApprovedBy)}` : 'در انتظار تصویب'}</span>
                  {r.Status !== 'approved' && <button type="button" className={ghostCls} disabled={busy} onClick={() => void mutate(`/scoring-rules/${r.Id}/approve`, 'POST', {}, 'قاعده تصویب شد')}>تصویب (مجاز)</button>}</span>
              </div>
            ))}
          </div>
          <div className="glass rounded-2xl p-3">
            <h4 className="mb-2 text-[12px] font-medium tx1">قاعدهٔ جدید (با همان وزن‌ها و آستانه‌های پیش‌فرض — قابل ویرایش در API)</h4>
            <div className="grid gap-2 md:grid-cols-3">
              <div><label className={labelCls}>کد قاعده *</label><input className={inputCls} value={ruleForm.Code ?? ''} onChange={(e) => setRuleForm({ ...ruleForm, Code: e.target.value })} placeholder="ORG-SCORING" /></div>
              <div><label className={labelCls}>نام</label><input className={inputCls} value={ruleForm.NameFa ?? ''} onChange={(e) => setRuleForm({ ...ruleForm, NameFa: e.target.value })} /></div>
              <div><label className={labelCls}>نسخه</label><input className={inputCls} value={ruleForm.Version} onChange={(e) => setRuleForm({ ...ruleForm, Version: e.target.value })} /></div>
            </div>
            <button type="button" className={`${btnCls} mt-2`} disabled={busy} onClick={() => void mutate('/scoring-rules', 'POST', ruleForm, 'قاعده ثبت شد؛ برای اثرگذاری باید تصویب شود').then(() => setRuleForm({ Version: '1.0' }))}>ثبت قاعده</button>
          </div>
        </div>
      )}
    </div>
  );
}
