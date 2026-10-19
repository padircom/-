import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { jsonRequest } from '../services/apiClient';
import { type Lang } from '../data/framework';

/**
 * PMO-INTEGRATED-CHANGE-MANAGEMENT-V1.0 — «مدیریت تغییر یکپارچه» (d4).
 * همهٔ داده از /api/change-mgmt می‌آید؛ دادهٔ خالی = «—»، نه عدد ساختگی.
 * قواعد کلیدی: لایه‌های مبلغ جدا و منفاوت؛ اثر مدت ≠ تمدید قراردادی؛ مصوب فقط با منبع معتبر؛
 * پیشنهاد نسخهٔ مبنا هرگز خودکار اعمال نمی‌شود و مبنای جاری بازنویسی نمی‌شود.
 */

type Row = Record<string, any>;

type Catalog = {
  module: string; version: string; llmConnected: boolean;
  types: { code: string; fa: string }[];
  statuses: { code: string; fa: string; perm: string; to: string[] }[];
  costLayers: string[]; costLayerFa: Record<string, string>;
  linkKinds: { code: string; fa: string }[];
  layersRuleFa: string;
};

type Dash = {
  totalRequests: number; byStatus: Record<string, number>; byType: Record<string, number>;
  awaitingReview: number; awaitingApproval: number; approvedCount: number; rejectedCount: number;
  implementingCount: number; overdueCount: number; avgCompletionDays: number | null;
  costLayers: Record<string, number>; cumulativeDurationDeltaDays: number;
  approvedEotDaysTotal: number; highRiskCount: number; disputeLinkedCount: number;
  filters: Record<string, string | null>;
  drilldown: { requests: Row[] };
};

type Detail = {
  request: Row;
  children: Record<string, Row[]>;
};

type TimeAnalysis = {
  affectedActivities: Row[]; unknownCodes: string[]; criticalCount: number;
  criticalPathEffect: string; milestoneCount: number; baselineFinish: string | null;
  estimatedDeltaDays: number; approvedEotDays: number; basisNoteFa: string;
};

type CostAnalysis = {
  currency: string; layers: Record<string, number>; layerDeltas: Record<string, number | null>;
  directTotal: number; indirectTotal: number; timeRelatedTotal: number;
  rowCount: number; approvedLayerCount: number; warningsFa: string[];
};

const EMPTY = '—';
const fmtNum = (v: unknown, fa: boolean) => {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return EMPTY;
  return Number(v).toLocaleString(fa ? 'fa-IR' : 'en-US');
};
const fmtDate = (v: unknown) => (v ? String(v).slice(0, 10) : EMPTY);

const SECTIONS = [
  ['dashboard', 'داشبورد و drill-down'],
  ['requests', 'فهرست و ثبت درخواست'],
  ['detail', 'پروندهٔ تغییر (۱۶ مرحله)'],
  ['reports', 'گزارش‌های مدیریتی (۱۴)'],
] as const;
type MgmtReport = { kind: string; title: string; heads: string[]; rows: string[][]; noteFa?: string };
const MGMT_KINDS: { code: string; fa: string }[] = [
  { code: 'requests_status', fa: 'وضعیت پرونده‌ها و گردش‌کار' }, { code: 'requests_by_type', fa: 'درخواست‌ها به تفکیک نوع' },
  { code: 'trend_requests', fa: 'روند ثبت ماهانه' }, { code: 'cost_layers_detail', fa: 'جزئیات ۵ لایهٔ هزینه' },
  { code: 'cost_warnings', fa: 'ثبت مصوب/پرداخت بی‌منبع' }, { code: 'analyze_rows', fa: 'ردیف‌های اثر زمان‌بندی' },
  { code: 'links_register', fa: 'دفتر پیوندهای نرم' }, { code: 'links_gaps', fa: 'پیوندهای بی‌مقصد' },
  { code: 'risk_claim_links', fa: 'پیوندهای ریسک/ادعا/اختلاف' }, { code: 'implementation', fa: 'مسیر اجرا/مبنا' },
  { code: 'documents_register', fa: 'دفتر اسناد' }, { code: 'audit_trail', fa: 'ردپای ممیزی' },
  { code: 'review_sod_gaps', fa: 'کنترل SoD' }, { code: 'dashboard_detail', fa: 'جزئیات داشبورد' },
];
type Section = (typeof SECTIONS)[number][0];

const DETAIL_TABS = [
  ['workflow', 'گردش‌کار و انتقال'],
  ['schedule', 'اثر زمان‌بندی + تحلیل'],
  ['cost', 'لایه‌های هزینه (۵ لایه)'],
  ['links', 'پیوندهای نرم ماژول‌ها'],
  ['implement', 'اجرای مسیر تصویب/مبنا'],
  ['docs', 'اسناد پشتیبان (آپلود/دانلود واقعی)'],
  ['report', 'گزارش Word/PDF (۱۲ فصل/۲۸ جدول)'],
  ['audit', 'ممیزی'],
] as const;
type DetailTab = (typeof DETAIL_TABS)[number][0];

const CP_FA: Record<string, string> = { none: 'بدون اثر', partial: 'اثر جزئی مسیر بحرانی', critical: 'اثر کامل بحرانی', unknown: 'نامشخص (بدون کد رزربرنامه)' };
const DOC_KIND_FA: Record<string, string> = {
  supporting: 'مستند پشتیبان', decision: 'سند تصمیم CCB', instruction: 'دستورکار اجرا',
  evidence: 'مدرک اجرایی', correspondence: 'مکاتبه',
};
const LINK_FA: Record<string, string> = {
  delay_event: 'رویداد تأخیر (ماژول تأخیر)', loss_case: 'پروندهٔ ضرر و زیان', contract_risk: 'ریسک قرارداد d14',
  claim: 'ادعا', dispute_case: 'پروندهٔ کارشناسی دعاوی', edms_document: 'سند EDMS',
  legacy_change_request: 'تغییر قدیمی d4 (فقط‌خواندنی)', baseline_revision: 'نسخهٔ نامستقر مبنا (پیشنهادی)',
};

export default function ChangeMgmtWorkspace({ lang, projectId }: { lang: Lang; projectId: string }) {
  const { user } = useAuth();
  return <Live key={`${projectId}:${user?.id ?? ''}`} lang={lang} projectId={projectId} userId={user?.id ?? null} />;
}

function Live({ lang, projectId, userId }: { lang: Lang; projectId: string; userId: string | null }) {
  const fa = lang === 'fa';
  const [section, setSection] = useState<Section>('dashboard');
  const [detailTab, setDetailTab] = useState<DetailTab>('workflow');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [requests, setRequests] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [timeA, setTimeA] = useState<TimeAnalysis | null>(null);
  const [costA, setCostA] = useState<CostAnalysis | null>(null);
  const [linksV, setLinksV] = useState<{ links: Row[]; totals: { verified: number; missing: number } } | null>(null);
  const [mgmt, setMgmt] = useState<MgmtReport | null>(null);
  const [mgmtKind, setMgmtKind] = useState<string>('requests_status');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const mounted = useRef(true);
  const base = `/api/change-mgmt/${encodeURIComponent(projectId)}`;

  /* فیلترهای داشبورد */
  const [fStatus, setFStatus] = useState('');
  const [fType, setFType] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [fContract, setFContract] = useState('');

  /* فرم ثبت درخواست */
  const [reqForm, setReqForm] = useState<Row>({ TitleFa: '', ChangeType: 'other', RequestDate: new Date().toISOString().slice(0, 10), Priority: 'normal', Currency: 'IRR' });
  const [tForm, setTForm] = useState<Row>({ to: '', noteFa: '', decisionFa: '', reasonFa: '' });
  const [schedForm, setSchedForm] = useState<Row>({ MethodFa: '', AssumptionsFa: '', EstimatedDurationDeltaDays: '', CompletionEffectDays: '', ApprovedEotDays: '', EotEntitlementFa: '', ActivityRefs: '' });
  const [costForm, setCostForm] = useState<Row>({ Layer: 'estimated', Amount: '', FormulaFa: '', SourceFa: '', BasisDate: new Date().toISOString().slice(0, 10) });
  const [linkForm, setLinkForm] = useState<Row>({ LinkKind: 'delay_event', TargetCode: '', TargetTitleFa: '', DescriptionFa: '' });
  const [implForm, setImplForm] = useState<Row>({ Step: 'instruction_issued', Status: 'planned', BaselineUpdateRef: '', ExecutionResultFa: '' });
  const [docForm, setDocForm] = useState<{ TitleFa: string; Kind: string; DocNo: string; DocDate: string }>({ TitleFa: '', Kind: 'supporting', DocNo: '', DocDate: '' });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUpBusy, setDocUpBusy] = useState(false);
  const [docDlBusy, setDocDlBusy] = useState('');
  const [baselineForm, setBaselineForm] = useState<Row>({ noteFa: '', sourceBaselineId: '' });

  const bump = useCallback(() => setRefresh((x) => x + 1), []);

  /* بارگذاری بنیاد */
  useEffect(() => {
    mounted.current = true;
    const seq = ++generation.current;
    setLoading(true); setError('');
    (async () => {
      const cat = await jsonRequest<Catalog>(`${base}/catalog`, userId, 'GET');
      if (!mounted.current || seq !== generation.current) return;
      if (cat.ok) setCatalog(cat.data); else setError(cat.message);
      const q = new URLSearchParams();
      if (fStatus) q.set('status', fStatus);
      if (fType) q.set('type', fType);
      if (fFrom) q.set('from', fFrom);
      if (fTo) q.set('to', fTo);
      if (fContract) q.set('contract', fContract);
      const [d, r] = await Promise.all([
        jsonRequest<Dash>(`${base}/dashboard?${q.toString()}`, userId, 'GET'),
        jsonRequest<{ requests: Row[] }>(`${base}/requests`, userId, 'GET'),
      ]);
      if (!mounted.current || seq !== generation.current) return;
      if (d.ok) setDash(d.data);
      if (r.ok) setRequests(r.data.requests);
      setLoading(false);
    })();
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, userId, refresh, fStatus, fType, fFrom, fTo, fContract]);

  /* بازخوانی جزئیات وقتی انتخاب می‌شود */
  useEffect(() => {
    if (!detail) return;
    const id = detail.request.Id;
    (async () => {
      const [dd, t, c, l] = await Promise.all([
        jsonRequest<Detail>(`${base}/requests/${encodeURIComponent(id)}`, userId, 'GET'),
        jsonRequest<{ analysis: TimeAnalysis }>(`${base}/requests/${encodeURIComponent(id)}/analysis/time`, userId, 'GET'),
        jsonRequest<{ analysis: CostAnalysis }>(`${base}/requests/${encodeURIComponent(id)}/analysis/cost`, userId, 'GET'),
        jsonRequest<{ links: Row[]; totals: { verified: number; missing: number } }>(`${base}/requests/${encodeURIComponent(id)}/analysis/links-verify`, userId, 'GET'),
      ]);
      if (!mounted.current) return;
      if (dd.ok) setDetail((prev) => (prev && dd.data.request.RowVersion !== prev.request.RowVersion ? dd.data : prev));
      setDetail((prev) => (prev ? (dd.ok ? dd.data : prev) : prev));
      if (t.ok) setTimeA(t.data.analysis);
      if (c.ok) setCostA(c.data.analysis);
      if (l.ok) setLinksV({ links: l.data.links, totals: l.data.totals });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.request.Id, base, userId]);

  const act = useCallback(async (method: string, path: string, body?: unknown, okMsg = 'ثبت شد') => {
    setBusy(true); setError(''); setNotice('');
    const r = await jsonRequest<Row>(path, userId, method, body);
    if (r.ok) {
      setNotice(okMsg); bump();
      if (detail) {
        const id = detail.request.Id;
        const dd = await jsonRequest<Detail>(`${base}/requests/${encodeURIComponent(id)}`, userId, 'GET');
        if (dd.ok) setDetail(dd.data);
      }
      setBusy(false); return true;
    }
    setError(`${r.code}: ${r.message}`); setBusy(false); return false;
  }, [userId, bump, detail, base]);

  const [docBusy, setDocBusy] = useState('');
  const uploadDoc = useCallback(async (id: string) => {
    if (docUpBusy || !docFile) return;
    setDocUpBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('TitleFa', docForm.TitleFa);
      fd.append('Kind', docForm.Kind);
      if (docForm.DocNo) fd.append('DocNo', docForm.DocNo);
      if (docForm.DocDate) fd.append('DocDate', docForm.DocDate);
      fd.append('file', docFile);
      const res = await fetch(`${base}/requests/${encodeURIComponent(id)}/documents/upload`, {
        method: 'POST', headers: { ...(userId ? { 'x-user-id': userId } : {}) }, body: fd,
      });
      const payload = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      if (!res.ok) throw new Error(payload?.error?.message ?? (fa ? 'بارگذاری انجام نشد' : 'Upload failed'));
      setNotice(fa ? 'سند بارگذاری شد (sha256 کنترل شد)' : 'Document uploaded (sha256 verified)');
      setDocForm({ TitleFa: '', Kind: 'supporting', DocNo: '', DocDate: '' }); setDocFile(null);
      const dd = await jsonRequest<Detail>(`${base}/requests/${encodeURIComponent(id)}`, userId, 'GET');
      if (dd.ok && detail) setDetail(dd.data);
    } catch (e) { setError(e instanceof Error ? e.message : (fa ? 'بارگذاری انجام نشد' : 'Upload failed')); }
    finally { setDocUpBusy(false); }
  }, [docUpBusy, docFile, docForm, base, userId, fa, detail]);

  const downloadDocFile = useCallback(async (id: string, docId: string, fallbackName: string) => {
    if (docDlBusy) return;
    setDocDlBusy(String(docId)); setError('');
    try {
      const res = await fetch(`${base}/requests/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}/download`, { headers: { ...(userId ? { 'x-user-id': userId } : {}) } });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? (fa ? 'دانلود سند انجام نشد' : 'Download failed'));
      }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition');
      const utf8Name = cd?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      const asciiName = cd?.match(/filename="([^"]+)"/)?.[1];
      const filename = utf8Name ? decodeURIComponent(utf8Name) : (asciiName ?? fallbackName ?? 'document.bin');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
      document.body.appendChild(anchor); anchor.click();
      window.setTimeout(() => anchor.remove(), 1000);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice(fa ? `دانلود انجام شد: ${filename} (sha256: ${String(res.headers.get('x-doc-sha256') ?? '').slice(0, 12)}…)` : 'Downloaded');
    } catch (e) { setError(e instanceof Error ? e.message : (fa ? 'دانلود سند انجام نشد' : 'Download failed')); }
    finally { setDocDlBusy(''); }
  }, [docDlBusy, base, userId, fa]);

  const downloadDoc = useCallback(async (id: string, format: 'word' | 'pdf') => {
    if (docBusy) return;
    setDocBusy(format); setError('');
    try {
      const res = await fetch(`${base}/requests/${encodeURIComponent(id)}/report?format=${format}`, { headers: { ...(userId ? { 'x-user-id': userId } : {}) } });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? (fa ? 'تولید سند انجام نشد' : 'Document generation failed'));
      }
      const blob = await res.blob();
      if (!blob.size) throw new Error(fa ? 'فایل خروجی خالی است' : 'Empty file');
      const filename = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `ChangeReport.${format === 'pdf' ? 'pdf' : 'doc'}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
      document.body.appendChild(anchor); anchor.click();
      window.setTimeout(() => anchor.remove(), 1000);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice(fa ? `دانلود آغاز شد: ${filename}` : `Download started: ${filename}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : (fa ? 'تولید سند انجام نشد' : 'Generation failed'));
    } finally {
      setDocBusy('');
    }
  }, [docBusy, base, userId, fa]);

  const typeFa = useCallback((code: string) => catalog?.types.find((t) => t.code === code)?.fa ?? code, [catalog]);
  const statusFa = useCallback((code: string) => catalog?.statuses.find((s) => s.code === code)?.fa ?? code, [catalog]);
  const statusDef = useCallback((code: string) => catalog?.statuses.find((s) => s.code === code), [catalog]);

  const fieldCls = 'rounded-lg border b-line-soft bg-black/10 px-2.5 py-2 text-[11px] tx1 outline-none focus:border-[#3b82f6]';
  const labelCls = 'grid gap-1 text-[10px] font-light tx3';
  const btnCls = 'rounded-lg px-3 py-2 text-[11px] font-light transition toggle-on tx1 disabled:opacity-50';
  const cBtnCls = `rounded-lg px-2.5 py-1.5 text-[9.5px] font-light transition border b-line-soft tx1 hover:tx2`;
  const cardCls = 'glass-dark rounded-xl p-4 flex flex-col gap-1';
  const chipClsBase = 'rounded-md px-2.5 py-1 text-[10px] font-light';

  const statusMembers: { code: string; fa: string }[] = catalog?.statuses.map((s) => ({ code: s.code, fa: s.fa })) ?? [];
  const implSteps = ['instruction_issued', 'started', 'baselines_updated', 'execution_control', 'verified', 'completed'];

  /* بارگذاری گزارش مدیریتی وقتی وارد تب می‌شویم */
  useEffect(() => {
    if (section !== 'reports') return;
    (async () => {
      const r = await jsonRequest<MgmtReport>(`${base}/management-reports?kind=${encodeURIComponent(mgmtKind)}`, userId, 'GET');
      if (!mounted.current) return;
      setMgmt(r.ok ? r.data : null);
      if (!r.ok) setError(`${r.code}: ${r.message}`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, mgmtKind, base, userId]);

  if (loading && !dash) return <div className="py-8 text-center text-[11px] tx3">{fa ? 'در حال بارگذاری…' : 'Loading…'}</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold tx1">{fa ? 'مدیریت تغییر یکپارچه' : 'Integrated Change Engine'}</h3>
        <span className="text-[9.5px] font-extralight tx3">PMO-INTEGRATED-CHANGE-MANAGEMENT-V1.0 · {fa ? 'لایه‌های مبلغ جدا و منفاوتند؛ اثر مدت با تمدید یکی نیست؛ هیچ تصویب خودکاری وجود ندارد' : 'Cost layers differ; time-effect ≠ EOT; zero auto-approval'}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setSection(k)} className={`rounded-lg px-2.5 py-1 text-[10.5px] font-light transition ${section === k ? 'toggle-on tx1' : 'tx3 hover:tx2'}`}>{label}</button>
        ))}
      </div>

      {error && <div className="glass rounded-xl px-3 py-2 text-[11px]" style={{ color: '#dc2626' }}>{error}</div>}
      {notice && <div className="glass rounded-xl px-3 py-2 text-[11px]" style={{ color: '#16a34a' }}>{notice}</div>}

      {/* ─────────────── داشبورد + drill-down مدیریتی ─────────────── */}
      {section === 'dashboard' && dash && (
        <div className="flex flex-col gap-3">
          <div className="glass-dark rounded-xl p-3 flex flex-wrap gap-2">
            {([
              ['status', fStatus, setFStatus, 'وضعیت', statusMembers.map((s) => ({ value: s.code, label: s.fa }))],
              ['type', fType, setFType, 'نوع', (catalog?.types ?? []).map((t) => ({ value: t.code, label: t.fa }))],
            ] as [string, string, (v: string) => void, string, { value: string; label: string }[]][]).map(([key, val, setter, lbl, opts]) => (
              <select key={key} className={fieldCls} value={val} onChange={(e) => setter(e.target.value)} aria-label={lbl}>
                <option value="">{fa ? `${lbl} (همه)` : `${lbl} (all)`}</option>
                {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ))}
            <input className={fieldCls} placeholder={fa ? 'از تاریخ YYYY-MM-DD' : 'From'} value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
            <input className={fieldCls} placeholder={fa ? 'تا تاریخ YYYY-MM-DD' : 'To'} value={fTo} onChange={(e) => setFTo(e.target.value)} />
            <input className={fieldCls} placeholder={fa ? 'کد قرارداد' : 'Contract code'} value={fContract} onChange={(e) => setFContract(e.target.value)} />
            {(fStatus || fType || fFrom || fTo || fContract) && <button type="button" className={cBtnCls} onClick={() => { setFStatus(''); setFType(''); setFFrom(''); setFTo(''); setFContract(''); }}>{fa ? 'پاک کردن فیلتر' : 'Clear filters'}</button>}
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            {([
              ['کل درخواست‌ها', dash.totalRequests, ''],
              ['در انتظار بررسی', dash.awaitingReview, '#f59e0b'],
              ['در انتظار تصمیم', dash.awaitingApproval, '#a855f7'],
              ['مسیر تصویب/اجرا', dash.implementingCount, '#3b82f6'],
              ['تأییدشده', dash.approvedCount, '#16a34a'],
              ['رد / عقب‌افتاده', `${dash.rejectedCount} / ${dash.overdueCount}`, dash.overdueCount > 0 ? '#dc2626' : '#16a34a'],
              ['میانگین تکمیل (روز)', dash.avgCompletionDays, '#3b82f6'],
              ['ریسک بالا', dash.highRiskCount, dash.highRiskCount > 0 ? '#dc2626' : '#16a34a'],
              ['پیوندمعتبر به اختلاف', dash.disputeLinkedCount, '#a855f7'],
              ['Σ اثر برنامه', dash.cumulativeDurationDeltaDays, '#f59e0b'],
              ['Σ تمدید تأییدشده', dash.approvedEotDaysTotal, '#16a34a'],
              ['دستیار قاعده‌محور', dash.filters && catalog ? (catalog.llmConnected ? 'متصل' : 'بدون LLM (قاعده‌محور)') : '—', '#55665f'],
            ] as [string, string | number | null, string][]).map(([lbl, v, c]) => (
              <div key={lbl} className={cardCls}>
                <div className="text-[9px] font-light tx4">{fa ? lbl : lbl}</div>
                <div className="text-[14px] font-semibold" style={{ color: c || undefined }}>{typeof v === 'number' ? fmtNum(v, fa) : String(v ?? EMPTY)}</div>
              </div>
            ))}
          </div>

          {/* drill-down جدول — همان ردیف‌های واقعی فیلترشده */}
          <div className="glass-dark rounded-xl p-3">
            <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'درخواست‌های این دید (حداکثر ۲۰۰)' : 'Filtered requests (≤200)'}</div>
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full text-[10px] tx2">
                <thead><tr className="text-[9px] tx4">
                  {[fa ? 'کد' : 'Code', fa ? 'عنوان' : 'Title', fa ? 'وضعیت' : 'Status', fa ? 'نوع' : 'Type', fa ? 'اولویت' : 'Priority', fa ? 'تاریخ درخواست' : 'Date', fa ? 'مهلت بررسی' : 'Review due', fa ? 'برآورد نخست' : 'Initial estimate'].map((h) => <th key={h} className="px-2 py-1.5 text-start">{h}</th>)}
                </tr></thead>
                <tbody>
                  {(dash.drilldown?.requests ?? []).map((r) => (
                    <tr key={r.Id} className="border-t b-line-soft cursor-pointer hover:bg-black/10" onClick={() => { setDetailTab('workflow'); setDetail({ request: r, children: {} }); setSection('detail'); }}>
                      <td className="px-2 py-1.5 tabular-nums" dir="ltr">{r.Code}</td>
                      <td className="px-2 py-1.5">{r.TitleFa}</td>
                      <td className="px-2 py-1.5"><span className="rounded-full px-2 py-0.5 text-[9px]" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>{statusFa(String(r.Status))}</span></td>
                      <td className="px-2 py-1.5">{typeFa(String(r.ChangeType))}</td>
                      <td className="px-2 py-1.5">{r.Priority ?? EMPTY}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtDate(r.RequestDate)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtDate(r.ReviewDueDate)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtNum(r.InitialCostEstimate, fa)}</td>
                    </tr>
                  ))}
                  {(dash.drilldown?.requests ?? []).length === 0 && <tr><td colSpan={8} className="px-2 py-4 text-center tx4">—</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* ۵ لایهٔ جمع‌آوری‌شده */}
          <div className="grid grid-cols-5 gap-2">
            {(catalog?.costLayers ?? []).map((layer) => (
              <div key={layer} className={cardCls}>
                <div className="text-[9px] font-light tx4">{catalog?.costLayerFa[layer] ?? layer}</div>
                <div className="text-[13px] font-semibold" style={{ color: layer === 'paid' ? '#16a34a' : layer === 'approved' ? '#3b82f6' : '#f59e0b' }}>{fmtNum(dash.costLayers?.[layer], fa)}</div>
              </div>
            ))}
          </div>
          <div className="text-[9px] tx3 leading-4">⬤ {catalog?.layersRuleFa}</div>
        </div>
      )}

      {/* ─────────────── فهرست و ثبت درخواست ─────────────── */}
      {section === 'requests' && (
        <div className="flex flex-col gap-3">
          <div className="glass-dark rounded-xl p-3">
            <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'ثبت درخواست تغییر' : 'Raise change request'}</div>
            <div className="grid gap-2 md:grid-cols-3">
              {([
                ['TitleFa', 'عنوان (الزامی)'], ['ChangeType', 'نوع'], ['Priority', 'اولویت'],
                ['RequestDate', 'تاریخ درخواست'], ['ContractCode', 'کد قرارداد'], ['ReviewDueDate', 'مهلت بررسی'],
                ['InitialCostEstimate', 'برآورد نخست (ریال)'], ['InitialTimeImpactDays', 'اثر زمان نخست (روز)'], ['Currency', 'واحد'],
              ] as [string, string][]).map(([k, l]) => (
                <label key={k} className={labelCls}>
                  {fa ? l : k}{' '}
                  {k === 'ChangeType' ? (
                    <select className={fieldCls} value={String(reqForm[k] ?? 'other')} onChange={(e) => setReqForm({ ...reqForm, [k]: e.target.value })}>
                      {(catalog?.types ?? []).map((t) => <option key={t.code} value={t.code}>{t.fa}</option>)}
                    </select>
                  ) : k === 'Priority' ? (
                    <select className={fieldCls} value={String(reqForm[k] ?? 'normal')} onChange={(e) => setReqForm({ ...reqForm, [k]: e.target.value })}>
                      {['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <input className={fieldCls} value={String(reqForm[k] ?? '')} onChange={(e) => setReqForm({ ...reqForm, [k]: e.target.value })} />
                  )}
                </label>
              ))}
            </div>
            {([['DescriptionFa', 'شرح'], ['ReasonFa', 'علت'], ['NecessityFa', 'ضرورت'], ['AffectedScopeFa', 'محدودهٔ متأثر'], ['ClauseRefs', 'بندهای قرارداد مرجع (با ویرگول)'], ['WbsRefs', 'کدهای WBS (با ویرگول)'], ['ActivityRefs', 'کدهای فعالیت (با ویرگول)'], ['SupportDocRefs', 'اسناد پشتیبان (با ویرگول)']] as [string, string][]).map(([k, l]) => (
              <label key={k} className={`${labelCls} mt-2`}>
                {fa ? String(l) : k}{' '}
                <textarea rows={2} className={fieldCls} value={String(reqForm[k] ?? '')} onChange={(e) => setReqForm({ ...reqForm, [k]: e.target.value })} />
              </label>
            ))}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className={btnCls} disabled={busy}
                onClick={() => void act('POST', `${base}/requests`, reqForm, fa ? 'درخواست ثبت شد' : 'Request created')}>
                {fa ? 'ثبت درخواست (draft)' : 'Create (draft)'}
              </button>
              <button type="button" className={cBtnCls} onClick={() => setReqForm({ TitleFa: '', ChangeType: 'other', RequestDate: new Date().toISOString().slice(0, 10), Priority: 'normal', Currency: 'IRR' })}>{fa ? 'پاک کردن فرم' : 'Clear'}</button>
            </div>
          </div>

          <div className="glass-dark rounded-xl p-3">
            <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'فهرست درخواست‌ها' : 'Requests'}</div>
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full text-[10px] tx2">
                <thead><tr className="text-[9px] tx4">
                  {[fa ? 'کد' : 'Code', fa ? 'عنوان' : 'Title', fa ? 'وضعیت' : 'Status', fa ? 'نوع' : 'Type', fa ? 'درخواست‌کننده' : 'Requester', fa ? 'تاریخ' : 'Date', ''].map((h) => <th key={h} className="px-2 py-1.5 text-start">{h}</th>)}
                </tr></thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.Id} className="border-t b-line-soft hover:bg-black/10 cursor-pointer" onClick={() => { setDetailTab('workflow'); setDetail({ request: r, children: {} }); setSection('detail'); }}>
                      <td className="px-2 py-1.5 tabular-nums" dir="ltr">{r.Code}</td>
                      <td className="px-2 py-1.5">{r.TitleFa}</td>
                      <td className="px-2 py-1.5"><span className="rounded-full px-2 py-0.5 text-[9px]" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>{statusFa(String(r.Status))}</span></td>
                      <td className="px-2 py-1.5">{typeFa(String(r.ChangeType))}</td>
                      <td className="px-2 py-1.5">{r.RequestedBy ?? EMPTY}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtDate(r.RequestDate)}</td>
                      <td className="px-2 py-1.5">
                        <button type="button" className={cBtnCls} disabled={busy || String(r.Status) !== 'draft'}
                          onClick={(e) => { e.stopPropagation(); if (window.confirm(fa ? `حذف پیش‌نویس ${r.Code}؟` : `Delete draft ${r.Code}?`)) void act('DELETE', `${base}/requests/${encodeURIComponent(r.Id)}`, undefined, fa ? 'حذف شد' : 'Deleted'); }}>
                          {fa ? 'حذف پیش‌نویس' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && <tr><td colSpan={7} className="px-2 py-4 text-center tx4">—</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────── گزارش‌های مدیریتی ─────────────── */}
      {section === 'reports' && (
        <div className="flex flex-col gap-3">
          <div className="glass-dark rounded-xl p-3 flex flex-wrap gap-1.5">
            {MGMT_KINDS.map((k) => (
              <button key={k.code} type="button" onClick={() => setMgmtKind(k.code)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-light transition ${mgmtKind === k.code ? 'toggle-on tx1' : 'tx3 hover:tx2'}`}>{k.fa}</button>
            ))}
          </div>
          {mgmt && (
            <div className="glass-dark rounded-xl p-3">
              <div className="mb-2 text-[11px] font-semibold tx1">{mgmt.title}</div>
              {mgmt.noteFa && <div className="mb-2 text-[9.5px] tx3">{mgmt.noteFa}</div>}
              <div className="thin-scroll overflow-x-auto">
                <table className="w-full text-[10px] tx2">
                  <thead><tr className="text-[9px] tx4">{mgmt.heads.map((h) => <th key={h} className="px-2 py-1.5 text-start">{h}</th>)}</tr></thead>
                  <tbody>
                    {mgmt.rows.map((row, i) => <tr key={i} className="border-t b-line-soft">{row.map((c, j) => <td key={j} className="px-2 py-1.5">{c}</td>)}</tr>)}
                    {mgmt.rows.length === 0 && <tr><td colSpan={mgmt.heads.length} className="px-2 py-4 text-center tx4">—</td></tr>}
                  </tbody>
                </table>
              </div>
              {mgmt.rows.length > 0 && <div className="mt-2 text-[9px] tx4">{fa ? `${fmtNum(mgmt.rows.length, fa)} سطر (از دادهٔ واقعی محاسبه‌شده)` : `${mgmt.rows.length} rows`}</div>}
            </div>
          )}
        </div>
      )}

      {/* ─────────────── پروندهٔ تغییر ─────────────── */}
      {section === 'detail' && !detail && (
        <div className="glass-dark rounded-xl p-6 text-center text-[11px] tx4">{fa ? 'برای باز کردن پرونده، یک درخواست را از داشبورد یا فهرست انتخاب کنید' : 'Select a request from the dashboard or list'}</div>
      )}

      {section === 'detail' && detail && (() => {
        const r = detail.request;
        const children = detail.children ?? {};
        const audits: Row[] = children.PmisChangeAuditTrail ?? [];
        const scheds: Row[] = children.PmisChangeScheduleImpacts ?? [];
        const costs: Row[] = children.PmisChangeCostEstimates ?? [];
        const links: Row[] = children.PmisChangeModuleLinks ?? [];
        const impl: Row[] = children.PmisChangeImplementation ?? [];
        const statusesThatReachImpl = ['approved', 'approved_conditional', 'notified', 'implementing', 'baselines_updated', 'execution_monitoring', 'closed', 'archived'];
        const cur = statusDef(String(r.Status));
        const transitionOptions = cur?.to ?? [];
        const layerFa = (layer: string) => catalog?.costLayerFa[layer] ?? layer;

        return (
          <div className="flex flex-col gap-3">
            <div className="glass-dark rounded-xl p-3">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={cBtnCls} onClick={() => { setDetail(null); setSection('requests'); }}>{fa ? '↩ فهرست' : '↩ List'}</button>
                <span className="text-[13px] font-semibold tx1" dir="ltr">{r.Code}</span>
                <span className="rounded-full px-2.5 py-0.5 text-[10px]" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>{statusFa(String(r.Status))}</span>
                <span className="text-[10px] tx3">{typeFa(String(r.ChangeType))} · {fa ? 'اولویت:' : 'Priority:'} {r.Priority ?? EMPTY}</span>
              </div>
              <div className="mt-2 text-[11px] font-semibold tx1">{r.TitleFa}</div>
              {r.DescriptionFa && <div className="mt-1 text-[10px] tx2 leading-5">{r.DescriptionFa}</div>}
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[9.5px] md:grid-cols-4">
                <div className="tx3">{fa ? 'درخواست‌کننده:' : 'Requester:'} <span className="tx1">{r.RequestedBy ?? EMPTY}</span></div>
                <div className="tx3">{fa ? 'تاریخ درخواست:' : 'Date:'} <span className="tx1 tabular-nums">{fmtDate(r.RequestDate)}</span></div>
                <div className="tx3">{fa ? 'مهلت بررسی:' : 'Review due:'} <span className="tx1 tabular-nums">{fmtDate(r.ReviewDueDate)}</span></div>
                <div className="tx3">{fa ? 'واحد:' : 'Currency:'} <span className="tx1">{r.Currency ?? 'IRR'}</span></div>
                <div className="tx3">{fa ? 'برآورد نخست:' : 'Initial estimate:'} <span className="tx1 tabular-nums">{fmtNum(r.InitialCostEstimate, fa)}</span></div>
                <div className="tx3">{fa ? 'اثر زمان نخست (روز):' : 'Initial time effect:'} <span className="tx1 tabular-nums">{fmtNum(r.InitialTimeImpactDays, fa)}</span></div>
                <div className="tx3">{fa ? 'کد قرارداد:' : 'Contract:'} <span className="tx1">{r.ContractCode ?? EMPTY}</span></div>
                <div className="tx3">{fa ? 'تصمیم‌گیرنده:' : 'Decider:'} <span className="tx1">{r.DecidedBy ?? EMPTY}</span></div>
                <div className="tx3 col-span-2">{fa ? 'بندهای قرارداد:' : 'Clause refs:'} <span className="tx1">{String(r.ClauseRefs ?? EMPTY)}</span></div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {DETAIL_TABS.map(([k, l]) => (
                <button key={k} type="button" className={`rounded-lg px-2.5 py-1 text-[10px] font-light transition ${detailTab === k ? 'toggle-on tx1' : 'tx3 hover:tx2'}`}
                  onClick={() => setDetailTab(k)}>{fa ? l : k}</button>
              ))}
            </div>

            {/* ── گردش‌کار ـ آخر ۱۶ مرحله ── */}
            {detailTab === 'workflow' && (
              <div className="flex flex-col gap-3">
                <div className="glass-dark rounded-xl p-3">
                  <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'مسیر تصویب تا وضعیت فعلی' : 'Approval trail (16 steps)'}</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(catalog?.statuses ?? []).map((s) => {
                      const on = String(r.Status) === s.code;
                      const passedIndex = (catalog?.statuses ?? []).findIndex((x) => x.code === r.Status);
                      const myIndex = (catalog?.statuses ?? []).findIndex((x) => x.code === s.code);
                      const state = on ? 'translate-y-0 toggle-on text-[#17563a]' : myIndex < passedIndex ? 'text-[#3b82f6]' : ['closed', 'rejected', 'archived'].includes(String(r.Status)) ? 'tx4' : 'tx4';
                      return <span key={s.code} className={`rounded-full px-2 py-0.5 text-[9px] ${state}`}>{s.fa}</span>;
                    })}
                  </div>
                </div>

                  {transitionOptions.length > 0 && !['closed', 'rejected', 'archived'].includes(String(r.Status)) && (
                    <div className="glass-dark rounded-xl p-3">
                      <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'گذر مجاز از این وضعیت' : 'Allowed transitions'}</div>
                      <div className="flex flex-wrap gap-2">
                        {transitionOptions.map((to) => (
                          <button key={to} type="button"
                            className={`rounded-lg px-3 py-1.5 text-[10px] font-light transition ${tForm.to === to ? 'toggle-on tx1' : 'tx3 hover:tx2'}`}
                            onClick={() => setTForm({ ...tForm, to })}>
                            {statusFa(to)}
                          </button>
                        ))}
                      </div>
                      {tForm.to && (() => {
                        const dec = ['approved', 'approved_conditional', 'rejected'].includes(tForm.to);
                        return (
                          <div className="mt-2 grid gap-2">
                            {dec && <div className="text-[9.5px]" style={{ color: '#dc2626' }}>{fa ? 'تصمیم سمی: SoD به اجرا گذاشته می‌شود؛ یادداشت تصمیم الزامی است، تصمیم‌گیرنده و آماده‌کنندهٔ درخواست نمی‌توانند یک نفر باشند' : 'Decision gate: SoD enforced; decision note required'}</div>}
                            <textarea rows={2} className={fieldCls} placeholder={fa ? 'یادداشت گذر وضعیت (الزامی)' : 'Transition note (required)'} value={tForm.noteFa} onChange={(e) => setTForm({ ...tForm, noteFa: e.target.value })} />
                            {dec && <textarea rows={2} className={fieldCls} placeholder={fa ? 'تاریخچهٔ تصمیم / دلیل (مخصوص تصمیم‌دهی)' : 'Decision text / reason (decision only)'} value={tForm.decisionFa} onChange={(e) => setTForm({ ...tForm, decisionFa: e.target.value })} />}
                            {tForm.to === 'rejected' && <textarea rows={2} className={fieldCls} placeholder={fa ? 'علت رد (برای درخواست ردشده)' : 'Rejection reason'} value={tForm.reasonFa} onChange={(e) => setTForm({ ...tForm, reasonFa: e.target.value })} />}
                            <div className="flex gap-2">
                              <button type="button" className={btnCls} disabled={busy}
                                onClick={() => void act('POST', `${base}/requests/${encodeURIComponent(r.Id)}/transition`, { to: tForm.to, noteFa: tForm.noteFa, decisionFa: tForm.decisionFa || undefined, reasonFa: tForm.reasonFa || undefined, RowVersion: r.RowVersion }, fa ? 'وضعیت به‌روز شد' : 'Status updated')}>
                                {fa ? 'اعمال گذر' : 'Apply transition'}
                              </button>
                              <button type="button" className={cBtnCls} onClick={() => setTForm({ to: '', noteFa: '', decisionFa: '', reasonFa: '' })}>{fa ? 'لغو انتخاب' : 'Clear'}</button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
              </div>
            )}

            {/* ── اثر زمان‌بندی + موتور تحلیل ── */}
            {detailTab === 'schedule' && (
              <div className="flex flex-col gap-3">
                <div className="glass-dark rounded-xl p-3">
                  <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'ردیف‌های اثر زمان‌بندی' : 'Schedule-impact rows'}</div>
                  <div className="thin-scroll overflow-x-auto">
                    <table className="w-full text-[10px] tx2">
                      <thead><tr className="text-[9px] tx4">
                        {[fa ? 'کد' : 'Code', fa ? 'روش' : 'Method', fa ? 'Σ اثر (روز)' : 'Δ days', fa ? 'اثر پایان' : 'Completion', fa ? 'تمدید مصوب' : 'EOT approved', fa ? 'مبنای استحقاق' : 'EOT basis', fa ? 'تهیه‌کننده' : 'Prepared by'].map((h) => <th key={h} className="px-2 py-1.5 text-start">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {scheds.map((s) => (
                          <tr key={s.Id} className="border-t b-line-soft">
                            <td className="px-2 py-1.5 tabular-nums" dir="ltr">{s.Code}</td>
                            <td className="px-2 py-1.5">{s.MethodFa ?? EMPTY}</td>
                            <td className="px-2 py-1.5 tabular-nums">{fmtNum(s.EstimatedDurationDeltaDays, fa)}</td>
                            <td className="px-2 py-1.5 tabular-nums">{fmtNum(s.CompletionEffectDays, fa)}</td>
                            <td className="px-2 py-1.5 tabular-nums">{fmtNum(s.ApprovedEotDays, fa)}</td>
                            <td className="px-2 py-1.5 max-w-[280px] truncate">{s.EotEntitlementFa ?? EMPTY}</td>
                            <td className="px-2 py-1.5">{s.PreparedBy ?? EMPTY}</td>
                          </tr>
                        ))}
                        {scheds.length === 0 && <tr><td colSpan={7} className="px-2 py-4 text-center tx4">—</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {timeA && (
                    <div className="mt-3 rounded-lg border b-line-soft p-3 text-[10px]">
                      <div className="mb-1 text-[11px] font-semibold tx1">{fa ? 'تحلیل اثر زمانی (فقط‌خواندنی از d2)' : 'Time-impact analysis (read-only, d2)'}</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-3">
                        <div className="tx3">{fa ? 'اثر مسیر بحرانی:' : 'CP effect:'} <span className="tx1" style={{ color: timeA.criticalPathEffect === 'critical' ? '#dc2626' : timeA.criticalPathEffect === 'partial' ? '#f59e0b' : '#16a34a' }}>{CP_FA[timeA.criticalPathEffect] ?? timeA.criticalPathEffect}</span></div>
                        <div className="tx3">{fa ? 'فعالیت متأثر:' : 'Affected:'} <span className="tx1 tabular-nums">{fmtNum(timeA.affectedActivities.length, fa)}</span></div>
                        <div className="tx3">{fa ? 'فعالیت بحرانی:' : 'Critical:'} <span className="tx1 tabular-nums">{fmtNum(timeA.criticalCount, fa)}</span></div>
                        <div className="tx3">{fa ? 'نقاط عطف:' : 'Milestones:'} <span className="tx1 tabular-nums">{fmtNum(timeA.milestoneCount, fa)}</span></div>
                        <div className="tx3">{fa ? 'پایان مبنا:' : 'Baseline finish:'} <span className="tx1 tabular-nums">{timeA.baselineFinish ?? EMPTY}</span></div>
                        <div className="tx3">{fa ? 'Σ اثر تخمینی:' : 'Σ est. delta:'} <span className="tx1 tabular-nums">{fmtNum(timeA.estimatedDeltaDays, fa)}</span></div>
                        <div className="tx3 col-span-2">{fa ? 'Σ تمدید تأییدشده:' : 'Σ approved EOT:'} <span className="tx1 tabular-nums" style={{ color: '#16a34a' }}>{fmtNum(timeA.approvedEotDays, fa)}</span></div>
                      </div>
                      {timeA.unknownCodes.length > 0 && <div className="mt-1 text-[9.5px]" style={{ color: '#f59e0b' }}>{fa ? `کدهای ناشناخته در برنامه: ${timeA.unknownCodes.join(', ')}` : `Unknown codes: ${timeA.unknownCodes.join(', ')}`}</div>}
                      <div className="mt-1 text-[9px] tx4">{timeA.basisNoteFa}</div>
                    </div>
                  )}

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <label className={labelCls}>{fa ? 'روش تحلیل *' : 'Method *'}
                      <textarea rows={2} className={fieldCls} value={schedForm.MethodFa} onChange={(e) => setSchedForm({ ...schedForm, MethodFa: e.target.value })} placeholder={fa ? 'مثلاً: مقایسهٔ بازدیدهای زمان‌بندی' : ''} />
                    </label>
                    <label className={labelCls}>{fa ? 'مفروضات *' : 'Assumptions *'}
                      <textarea rows={2} className={fieldCls} value={schedForm.AssumptionsFa} onChange={(e) => setSchedForm({ ...schedForm, AssumptionsFa: e.target.value })} />
                    </label>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-4">
                    {([['EstimatedDurationDeltaDays', fa ? 'Σ اثر تخمینی (روز)' : 'Est. delta'], ['CompletionEffectDays', fa ? 'اثر پایان (روز)' : 'Completion effect'], ['ApprovedEotDays', fa ? 'تمدید مصوب (روز)' : 'EOT approved'], ['EotEntitlementFa', fa ? 'مبنای استحقاق (الزامی وقتی تمدید مصوب دارد)' : 'EOT basis'], ['ActivityRefs', fa ? 'کدهای فعالیت (با ویرگول)' : 'Activity codes']] as [string, string][]).map(([k, l]) => (
                      <label key={k} className={labelCls}><span>{l}</span><input className={fieldCls} value={String(schedForm[k] ?? '')} onChange={(e) => setSchedForm({ ...schedForm, [k]: e.target.value })} /></label>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={btnCls} disabled={busy}
                      onClick={() => void act('POST', `${base}/requests/${encodeURIComponent(r.Id)}/rows/PmisChangeScheduleImpacts`, {
                        ...schedForm,
                        EstimatedDurationDeltaDays: schedForm.EstimatedDurationDeltaDays === '' ? null : Number(schedForm.EstimatedDurationDeltaDays),
                        CompletionEffectDays: schedForm.CompletionEffectDays === '' ? null : Number(schedForm.CompletionEffectDays),
                        ApprovedEotDays: schedForm.ApprovedEotDays === '' ? null : Number(schedForm.ApprovedEotDays),
                        ActivityRefs: schedForm.ActivityRefs ? String(schedForm.ActivityRefs).split(',').map((x) => x.trim()).filter(Boolean) : null,
                      }, fa ? 'ردیف زمان‌بندی ثبت شد' : 'Schedule row saved')}>{fa ? 'ثبت ردیف زمان‌بندی' : 'Add schedule row'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── لایه‌های هزینه (۵ لایه) ── */}
            {detailTab === 'cost' && (
              <div className="flex flex-col gap-3">
                {costA && (
                  <div className="grid grid-cols-5 gap-2">
                    {(catalog?.costLayers ?? []).map((l) => (
                      <div key={l} className={cardCls}>
                        <div className="text-[9px] font-light tx4">{catalog?.costLayerFa[l] ?? l}</div>
                        <div className="text-[13px] font-semibold" style={{ color: l === 'paid' ? '#16a34a' : l === 'approved' ? '#3b82f6' : '#f59e0b' }}>{fmtNum(costA.layers?.[l], fa)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {costA && (
                  <div className="glass-dark rounded-xl p-3 text-[10px]">
                    <div className="mb-1 text-[11px] font-semibold tx1">{fa ? '۴ دلتای زنجیرهٔ لایه + تفکیک مستقیم/غیرمستقیم/زمان‌وابسته' : '4 layer-deltas + direct/indirect split'}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
                      {([['proposed-estimated', 'برآورد→پیشنهاد'], ['negotiated-proposed', 'پیشنهاد→مذاکره'], ['approved-negotiated', 'مذاکره→مصوب'], ['paid-approved', 'مصوب→پرداخت']] as [string, string][]).map(([k, lbl]) => (
                        <div key={k} className="tx3">{fa ? lbl : k}: <span className="tx1 tabular-nums">{fmtNum(costA.layerDeltas?.[k], fa)}</span></div>
                      ))}
                    </div>
                    <div className="mt-1 grid grid-cols-3 gap-x-4 gap-y-1" dir="ltr">
                      <div className="tx3">{fa ? 'مستقیم:' : 'Direct:'} <span className="tx1 tabular-nums">{fmtNum(costA.directTotal, fa)}</span></div>
                      <div className="tx3">{fa ? 'غیرمستقیم:' : 'Indirect:'} <span className="tx1 tabular-nums">{fmtNum(costA.indirectTotal, fa)}</span></div>
                      <div className="tx3">{fa ? 'زمان‌وابسته:' : 'Time-related:'} <span className="tx1 tabular-nums">{fmtNum(costA.timeRelatedTotal, fa)}</span></div>
                    </div>
                    {(costA.warningsFa ?? []).length > 0 && (
                      <ul className="mt-2 space-y-1 text-[9.5px]" style={{ color: '#dc2626' }}>
                        {costA.warningsFa.map((w, i) => <li key={i}>⚠ {w}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                <div className="glass-dark rounded-xl p-3">
                  <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'ردیف‌های لایهٔ هزینه' : 'Cost rows'}</div>
                  <div className="thin-scroll overflow-x-auto">
                    <table className="w-full text-[10px] tx2">
                      <thead><tr className="text-[9px] tx4">
                        {[fa ? 'کد' : 'Code', fa ? 'لایه' : 'Layer', fa ? 'مبلغ' : 'Amount', fa ? 'مستقیم' : 'Direct', fa ? 'فرمول' : 'Formula', fa ? 'منبع' : 'Source', fa ? 'تهیه‌کننده' : 'Prepared by'].map((h) => <th key={h} className="px-2 py-1.5 text-start">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {costs.map((c) => (
                          <tr key={c.Id} className="border-t b-line-soft">
                            <td className="px-2 py-1.5 tabular-nums" dir="ltr">{c.Code}</td>
                            <td className="px-2 py-1.5"><span className={`${chipClsBase}`} style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>{layerFa(String(c.Layer))}</span></td>
                            <td className="px-2 py-1.5 tabular-nums">{fmtNum(c.Amount, fa)}</td>
                            <td className="px-2 py-1.5 tabular-nums">{fmtNum(c.DirectAmount, fa)}</td>
                            <td className="px-2 py-1.5 max-w-[220px] truncate">{c.FormulaFa ?? EMPTY}</td>
                            <td className="px-2 py-1.5 max-w-[220px] truncate">{c.SourceFa ?? EMPTY}</td>
                            <td className="px-2 py-1.5">{c.PreparedBy ?? EMPTY}</td>
                          </tr>
                        ))}
                        {costs.length === 0 && <tr><td colSpan={7} className="px-2 py-4 text-center tx4">—</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <label className={labelCls}>{fa ? 'لایه *' : 'Layer *'}
                      <select className={fieldCls} value={costForm.Layer} onChange={(e) => setCostForm({ ...costForm, Layer: e.target.value })}>
                        {(catalog?.costLayers ?? []).map((l) => <option key={l} value={l}>{catalog?.costLayerFa[l] ?? l}</option>)}
                      </select>
                    </label>
                    <label className={labelCls}>{fa ? 'مبلغ *' : 'Amount *'}
                      <input className={fieldCls} value={costForm.Amount} onChange={(e) => setCostForm({ ...costForm, Amount: e.target.value })} type="number" />
                    </label>
                    <label className={labelCls}>{fa ? 'سهم مستقیم' : 'Direct'}
                      <input className={fieldCls} value={String(costForm.DirectAmount ?? '')} onChange={(e) => setCostForm({ ...costForm, DirectAmount: e.target.value })} type="number" />
                    </label>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {([['FormulaFa', 'فرمول/مبنای محاسبه *'], ['SourceFa', 'منبع/مستند *'], ['BasisDate', 'تاریخ مبنا *']] as [string, string][]).map(([k, l]) => (
                      <label key={k} className={labelCls}>{fa ? l : k}<textarea rows={k === 'SourceFa' ? 1 : 2} className={fieldCls} value={costForm[k]} onChange={(e) => setCostForm({ ...costForm, [k]: e.target.value })} /></label>
                    ))}
                  </div>
                  {['approved', 'paid'].includes(costForm.Layer) && (
                    <div className="mt-1 text-[9.5px]" style={{ color: '#dc2626' }}>{fa ? 'ثبت لایهٔ المصوب/مپرداخت بدون منبع معتبر رد می‌شود (مبلغ مصوب قراردادی فقط با بند + سند قانونی)' : 'Approved/paid rows require a valid source'}</div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={btnCls} disabled={busy}
                      onClick={() => void act('POST', `${base}/requests/${encodeURIComponent(r.Id)}/rows/PmisChangeCostEstimates`, { ...costForm, Amount: Number(costForm.Amount) || 0, DirectAmount: costForm.DirectAmount === '' || costForm.DirectAmount === undefined ? undefined : Number(costForm.DirectAmount) }, fa ? 'ردیف هزینه ثبت شد' : 'Cost row saved')}>
                      {fa ? 'ثبت ردیف هزینه' : 'Add cost row'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── پیوندهای نرم ── */}
            {detailTab === 'links' && (
              <div className="glass-dark rounded-xl p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="text-[11px] font-semibold tx1">{fa ? 'پیوندهای نرم به ماژول‌های تأخیر/ضرر/ریسک قرارداد/دعوا/EDMS' : 'Soft links to delay/loss/contract-risk/dispute/EDMS'}</div>
                  {linksV && <span className="ms-auto text-[9.5px]" style={{ color: linksV.totals.missing > 0 ? '#dc2626' : '#16a34a' }}>{fa ? `راستی‌آزمایی: ${fmtNum(linksV.totals.verified, fa)} تأیید / ${fmtNum(linksV.totals.missing, fa)} مفقود` : `verify: ${linksV.totals.verified} ok / ${linksV.totals.missing} missing`}</span>}
                </div>
                <div className="thin-scroll overflow-x-auto">
                  <table className="w-full text-[10px] tx2">
                    <thead><tr className="text-[9px] tx4">
                      {[fa ? 'کد' : 'Code', fa ? 'نوع پیوند' : 'Link', fa ? 'هدف' : 'Target', fa ? 'عنوان' : 'Title', fa ? 'راستی‌آزمایی' : 'Verified', fa ? 'یادداشت راستی‌آزما' : 'Verify note'].map((h) => <th key={h} className="px-2 py-1.5 text-start">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {linksV ? linksV.links.map((l) => (
                        <tr key={l.Id ?? l.Code} className="border-t b-line-soft">
                          <td className="px-2 py-1.5 tabular-nums" dir="ltr">{l.Code}</td>
                          <td className="px-2 py-1.5">{LINK_FA[String(l.LinkKind)] ?? l.LinkKind}</td>
                          <td className="px-2 py-1.5 tabular-nums" dir="ltr">{l.TargetCode}</td>
                          <td className="px-2 py-1.5">{l.TargetTitleFa ?? EMPTY}</td>
                          <td className="px-2 py-1.5">{l.verified === true ? <span style={{ color: '#16a34a' }}>✓</span> : l.verified === false ? <span style={{ color: '#dc2626' }}>✗</span> : EMPTY}</td>
                          <td className="px-2 py-1.5 text-[9px] tx3">{l.verifiedNoteFa ?? EMPTY}</td>
                        </tr>
                      )) : links.map((l) => <tr key={l.Id} className="border-t b-line-soft"><td className="px-2 py-1.5 tabular-nums" dir="ltr">{l.Code}</td><td className="px-2 py-1.5">{LINK_FA[String(l.LinkKind)] ?? l.LinkKind}</td><td className="px-2 py-1.5 tabular-nums" dir="ltr">{l.TargetCode}</td><td className="px-2 py-1.5">{l.TargetTitleFa}</td><td colSpan={2} className="px-2 py-1.5 tx4">—</td></tr>)}
                      {linksV ? linksV.links.length === 0 && links.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center tx4">—</td></tr> : links.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center tx4">—</td></tr>}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <label className={labelCls}>{fa ? 'نوع پیوند *' : 'Link kind *'}
                    <select className={fieldCls} value={linkForm.LinkKind} onChange={(e) => setLinkForm({ ...linkForm, LinkKind: e.target.value })}>
                      {(catalog?.linkKinds ?? []).map((k) => <option key={k.code} value={k.code}>{k.fa}</option>)}
                    </select>
                  </label>
                  <label className={labelCls}>{fa ? 'کد هدف در ماژول مبدأ *' : 'Target code *'}
                    <input className={fieldCls} value={linkForm.TargetCode} onChange={(e) => setLinkForm({ ...linkForm, TargetCode: e.target.value })} />
                  </label>
                  <label className={labelCls}>{fa ? 'عنوان هدف *' : 'Target title *'}
                    <input className={fieldCls} value={linkForm.TargetTitleFa} onChange={(e) => setLinkForm({ ...linkForm, TargetTitleFa: e.target.value })} />
                  </label>
                  <label className={labelCls}>{fa ? 'توضیح' : 'Description'}
                    <input className={fieldCls} value={linkForm.DescriptionFa} onChange={(e) => setLinkForm({ ...linkForm, DescriptionFa: e.target.value })} />
                  </label>
                </div>
                <div className="mt-1 text-[9px] tx4">{fa ? 'پیوند به «لایهٔ نامستقر مبنا» فقط از مسیر «اجرای مسیر تصویب/مبنا» ساخته می‌شود؛ لایه‌های دیگر دستی وارد می‌شوند و در برابر ماژول مبدأ راستی‌آزمایی می‌شوند' : 'baseline_revision links are created only from the implement tab; others are verified against source modules'}</div>
                <div className="mt-2 flex gap-2">
                  <button type="button" className={btnCls} disabled={busy || linkForm.LinkKind === 'baseline_revision'}
                    onClick={() => void act('POST', `${base}/requests/${encodeURIComponent(r.Id)}/rows/PmisChangeModuleLinks`, linkForm, fa ? 'پیوند ثبت شد' : 'Link saved')}>{fa ? 'ثبت پیوند' : 'Add link'}</button>
                </div>
              </div>
            )}

            {/* ── اجرای مسیر تصویب/مبنا ── */}
            {detailTab === 'implement' && (
              <div className="flex flex-col gap-3">
                {!statusesThatReachImpl.includes(String(r.Status)) && (
                  <div className="glass-dark rounded-xl p-4 text-center text-[11px]" style={{ color: '#f59e0b' }}>{fa ? `این تب وقتی وضعیت به «تأییدشده» یا فراتر برسد فعال می‌شود؛ وضعیت فعلی: ${statusFa(String(r.Status))}` : 'Implementation unlocks post-approval'}</div>
                )}

                {statusesThatReachImpl.includes(String(r.Status)) && (
                  <div className="glass-dark rounded-xl p-3">
                    <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'پیشنهاد نسخهٔ نامستقر مبنا (baselines_updated)' : 'Non-current baseline revision proposal'}</div>
                    <div className="text-[9.5px] tx3 leading-4">✓ {fa ? 'مبنای جاری برنامه‌ریزی هرگز بازنویسی نمی‌شود — فقط نسخهٔ نامستکر (IsCurrent=false) ساخته می‌شود و با پیوند `baseline_revision` به این تغییر وصل می‌گردد' : 'current planning baseline is never overwritten — a non-current revision is proposed and linked'}</div>
                    <div className="text-[9.5px] tx3 leading-4">✓ {fa ? 'اعتبارش دهندهٔ مرحلهٔ «به‌روزرسانی مبنا»؛ انتقال وضعیت با دکمهٔ مخصوص خودش انجام می‌شود، نه با ساخت پیشنهاد' : 'this step does NOT auto-transition status'}</div>
                    <div className="mt-2 grid gap-2">
                      <label className={labelCls}>{fa ? 'یادداشت پیشنهاد (الزامی، حداکثر ۱۰۰۰ حرف) *' : 'Proposal note *'}
                        <textarea rows={3} className={fieldCls} value={baselineForm.noteFa} onChange={(e) => setBaselineForm({ ...baselineForm, noteFa: e.target.value })} />
                      </label>
                      <label className={labelCls}>{fa ? 'شناسهٔ مبنای جاری (اختیاری — پیش‌فرض: مبنای جاری همین پروژه)' : 'Source baseline (optional)'}
                        <input className={fieldCls} value={baselineForm.sourceBaselineId} onChange={(e) => setBaselineForm({ ...baselineForm, sourceBaselineId: e.target.value })} placeholder="bl-..." />
                      </label>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button type="button" className={btnCls} disabled={busy}
                        onClick={() => void act('POST', `${base}/requests/${encodeURIComponent(r.Id)}/baseline-proposal`, { noteFa: baselineForm.noteFa, sourceBaselineId: baselineForm.sourceBaselineId || undefined }, fa ? 'نسخهٔ نامستکر مبنا ساخته شد' : 'Baseline revision proposed')}>
                        {fa ? 'ساخت پیشنهاد مبنا' : 'Propose revision'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="glass-dark rounded-xl p-3">
                  <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'کنترل اجرا (ردیف‌های پیگیری مراحل)' : 'Implementation tracking rows'}</div>
                  <div className="thin-scroll overflow-x-auto">
                    <table className="w-full text-[10px] tx2">
                      <thead><tr className="text-[9px] tx4"><th className="px-2 py-1.5 text-start">{fa ? 'کد' : 'Code'}</th><th className="px-2 py-1.5 text-start">{fa ? 'مرحله' : 'Step'}</th><th className="px-2 py-1.5 text-start">{fa ? 'وضعیت' : 'Status'}</th><th className="px-2 py-1.5 text-start">{fa ? 'ارجاع مبنا' : 'Baseline ref'}</th><th className="px-2 py-1.5 text-start">{fa ? 'نتیجهٔ اجرا' : 'Result'}</th></tr></thead>
                      <tbody>
                        {impl.map((m) => (
                          <tr key={m.Id ?? m.Code} className="border-t b-line-soft">
                            <td className="px-2 py-1.5 tabular-nums" dir="ltr">{m.Code}</td>
                            <td className="px-2 py-1.5">{m.Step ?? EMPTY}</td>
                            <td className="px-2 py-1.5">{m.Status ?? EMPTY}</td>
                            <td className="px-2 py-1.5 tabular-nums" dir="ltr">{m.BaselineUpdateRef ?? EMPTY}</td>
                            <td className="px-2 py-1.5 max-w-[280px] truncate">{m.ExecutionResultFa ?? EMPTY}</td>
                          </tr>
                        ))}
                        {impl.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center tx4">—</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    <label className={labelCls}>{fa ? 'مرحلهٔ اجرا *' : 'Step *'}
                      <select className={fieldCls} value={implForm.Step} onChange={(e) => setImplForm({ ...implForm, Step: e.target.value })}>
                        {implSteps.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                    <label className={labelCls}>{fa ? 'وضعیت *' : 'Status *'}
                      <select className={fieldCls} value={implForm.Status} onChange={(e) => setImplForm({ ...implForm, Status: e.target.value })}>
                        {['planned', 'in_progress', 'done', 'blocked'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                    <label className={labelCls}>{fa ? 'ارجاع مبنا' : 'Baseline ref'}<input className={fieldCls} value={implForm.BaselineUpdateRef} onChange={(e) => setImplForm({ ...implForm, BaselineUpdateRef: e.target.value })} /></label>
                    <label className={labelCls}>{fa ? 'نتیجهٔ اجرا' : 'Result'}<input className={fieldCls} value={implForm.ExecutionResultFa} onChange={(e) => setImplForm({ ...implForm, ExecutionResultFa: e.target.value })} /></label>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={btnCls} disabled={busy}
                      onClick={() => void act('POST', `${base}/requests/${encodeURIComponent(r.Id)}/rows/PmisChangeImplementation`, implForm, fa ? 'ردیف اجرا ثبت شد' : 'Implementation row saved')}>
                      {fa ? 'ثبت ردیف اجرا' : 'Add implementation row'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── گزارش Word/PDF ── */}
            {detailTab === 'report' && (
              <div className="flex flex-col gap-3">
                <div className="glass-dark rounded-xl p-4">
                  <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'سند گزارش چرخهٔ تغییر — ۱۲ فصل / ۲۸ جدول' : 'Change-cycle report — 12 chapters / 28 tables'}</div>
                  <ul className="text-[9.5px] tx3 leading-5 space-y-0.5">
                    <li>✓ {fa ? 'Auto-Cleanup هنگام صدور: راهنمای داخلی حذف، برچسب‌ها پاک، هایلایت زرد شفاف، فونت رسمی B Nazanin' : 'Auto-Cleanup on issue: internal guides/mandatory-optional labels/yellow highlights stripped, B Nazanin font'}</li>
                    <li>✓ {fa ? 'هر سلول یا دادهٔ واقعی جدول‌های PmisChange* است یا «—» — هیچ مبلغ/استحقاق/ماده‌ای حدس زده نمی‌شود' : 'Every cell is a real PmisChange* value or «—» — no fabricated amounts/entitlements'}</li>
                    <li>✓ {fa ? 'برای پیش‌نویسِ فاقد هر ردیف واقعی (تحلیل/هزینه/پیوند/سند) گیت ۴۲۲ می‌خورد' : '422 gate for an empty draft (no analysis/cost/link/document rows)'}</li>
                    <li>✓ {fa ? 'PDF فقط در صورت وجود موتور رندر واقعی سمت سرور (خارج از پیکربندی فعلی: ۵۰۱ با راهنمای Word)' : 'PDF only when a real renderer is available server-side (current config: 501 + Word guidance)'}</li>
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={btnCls} disabled={!!docBusy} onClick={() => void downloadDoc(String(r.Id), 'word')}>
                      {docBusy === 'word' ? '…' : fa ? 'دانلود Word (.doc)' : 'Download Word (.doc)'}
                    </button>
                    <button type="button" className={btnCls} disabled={!!docBusy} onClick={() => void downloadDoc(String(r.Id), 'pdf')}>
                      {docBusy === 'pdf' ? '…' : fa ? 'دانلود PDF' : 'Download PDF'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── فاز ۶: اسناد پشتیبان — آپلود/دانلود واقعی با sha256 ── */}
            {detailTab === 'docs' && (
              <div className="flex flex-col gap-3">
                <div className="glass-dark rounded-xl p-4">
                  <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'بارگذاری سند واقعی' : 'Upload real document'}</div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <label className={labelCls}>{fa ? 'عنوان سند *' : 'Title *'}
                      <input className={fieldCls} value={docForm.TitleFa} onChange={(e) => setDocForm({ ...docForm, TitleFa: e.target.value })} />
                    </label>
                    <label className={labelCls}>{fa ? 'نوع سند *' : 'Kind *'}
                      <select className={fieldCls} value={docForm.Kind} onChange={(e) => setDocForm({ ...docForm, Kind: e.target.value })}>
                        {Object.entries(DOC_KIND_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <label className={labelCls}>{fa ? 'شمارهٔ سند' : 'Doc no'}<input className={fieldCls} value={docForm.DocNo} onChange={(e) => setDocForm({ ...docForm, DocNo: e.target.value })} /></label>
                    <label className={labelCls}>{fa ? 'تاریخ سند' : 'Doc date'}<input type="date" className={fieldCls} value={docForm.DocDate} onChange={(e) => setDocForm({ ...docForm, DocDate: e.target.value })} /></label>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="file" className="text-[10px] tx2"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json,.xml,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
                    <button type="button" className={btnCls} disabled={docUpBusy || !docFile || docForm.TitleFa.trim().length < 3}
                      onClick={() => void uploadDoc(r.Id)}>
                      {docUpBusy ? (fa ? 'در حال بارگذاری…' : 'Uploading…') : (fa ? 'بارگذاری فایل + متادیتا' : 'Upload file + metadata')}
                    </button>
                    <span className="text-[9px] tx4">{fa ? 'حداکثر ۲۵MB — sha256 هنگام دانلود کنترل می‌شود' : 'Max 25MB — sha256 checked on download'}</span>
                  </div>
                </div>
                <div className="glass-dark rounded-xl p-4">
                  <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'دفتر اسناد این پرونده' : 'Document register'}</div>
                  <div className="thin-scroll overflow-x-auto">
                    <table className="w-full text-[10px] tx2">
                      <thead><tr className="text-[9px] tx4">
                        {[fa ? 'کد' : 'Code', fa ? 'عنوان' : 'Title', fa ? 'نوع' : 'Kind', fa ? 'فایل' : 'File', fa ? 'حجم' : 'Size', 'SHA-256', fa ? 'بارگذارنده' : 'By', fa ? 'دانلود' : 'Download'].map((h) => <th key={h} className="px-2 py-1.5 text-start">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {(children.PmisChangeDocuments ?? []).map((doc) => {
                          const hasFile = Boolean(doc.Sha256);
                          return (
                            <tr key={doc.Id} className="border-t b-line-soft">
                              <td className="px-2 py-1.5">{String(doc.Code ?? '—')}</td>
                              <td className="px-2 py-1.5">{String(doc.TitleFa ?? '—')}</td>
                              <td className="px-2 py-1.5">{DOC_KIND_FA[String(doc.Kind)] ?? String(doc.Kind ?? '—')}</td>
                              <td className="px-2 py-1.5">{hasFile ? String(doc.FileNameFa ?? '—') : (fa ? 'فقط متادیتا (بدون فایل)' : 'Metadata only')}</td>
                              <td className="px-2 py-1.5">{hasFile && doc.SizeBytes ? `${Math.round(Number(doc.SizeBytes) / 1024)}KB` : '—'}</td>
                              <td className="px-2 py-1.5 font-mono text-[8.5px]" title={String(doc.Sha256 ?? '')}>{hasFile ? `${String(doc.Sha256).slice(0, 12)}…` : '—'}</td>
                              <td className="px-2 py-1.5">{String(doc.UploadedBy ?? '—')}</td>
                              <td className="px-2 py-1.5">
                                {hasFile
                                  ? <button type="button" className={btnCls} disabled={docDlBusy === String(doc.Id)} onClick={() => void downloadDocFile(r.Id, String(doc.Id), String(doc.FileNameFa ?? 'document.bin'))}>{docDlBusy === String(doc.Id) ? '…' : (fa ? 'دانلود' : 'Download')}</button>
                                  : <span className="text-[9px] tx4">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {(children.PmisChangeDocuments ?? []).length === 0 && <tr><td colSpan={8} className="px-2 py-4 text-center tx4">—</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-[9px] tx4">{fa ? 'متادیتا در PmisChangeDocuments (Zero-Regression)؛ بدنهٔ فایل جدا با کنترل شا۲۵۶ — راستی‌آزمایی آسیب‌دیدگی خودکار قبل از دانلود.' : ''}</div>
                </div>
              </div>
            )}

            {/* ── ممیزی ── */}
            {detailTab === 'audit' && (
              <div className="glass-dark rounded-xl p-3">
                <div className="mb-2 text-[11px] font-semibold tx1">{fa ? 'ردپای ممیزی' : 'Audit trail'}</div>
                <div className="thin-scroll overflow-x-auto">
                  <table className="w-full text-[10px] tx2">
                    <thead><tr className="text-[9px] tx4">
                      {[fa ? 'کد' : 'Code', fa ? 'اقدام' : 'Action', fa ? 'مجری' : 'Actor', fa ? 'جزئیات' : 'Detail', fa ? 'زمان' : 'At', fa ? 'از → به' : 'From → To'].map((h) => <th key={h} className="px-2 py-1.5 text-start">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {audits.map((a) => (
                        <tr key={a.Id ?? a.Code} className="border-t b-line-soft">
                          <td className="px-2 py-1.5 tabular-nums" dir="ltr">{a.Code}</td>
                          <td className="px-2 py-1.5">{a.Action}</td>
                          <td className="px-2 py-1.5">{a.Actor}</td>
                          <td className="px-2 py-1.5 max-w-[300px]">{a.DetailFa ?? EMPTY}</td>
                          <td className="px-2 py-1.5 tabular-nums">{String(a.OccurredAt ?? '').slice(0, 19).replace('T', ' ')}</td>
                          <td className="px-2 py-1.5 tabular-nums">{a.FromValue ?? EMPTY} → {a.ToValue ?? EMPTY}</td>
                        </tr>
                      ))}
                      {audits.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center tx4">—</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

