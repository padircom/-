/**
 * CSU-1 + CSU-2 + CSU-3 — میز کار زنده راه‌اندازی و تحویل (d15) روی موتور commissioning.ts
 * OPERCOM-aligned: Systemization, Tag Register, Check Sheet A/B, Test Pack, Punch Cat A/B/C → MC/PAC/FAC, Certificates MC/RFSU/PAC/FAC
 * 25 مسیر /api/com/* (22 قبلی + 3 تگ) — دادهٔ واقعی پروژه‌ای، بدون نمونه.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import {
  ComClient,
  SYSTEM_TYPES,
  SYSTEM_STATUSES,
  GATE_TYPES,
  BOUNDARY_KINDS,
  CRITICALITIES,
  PACK_TYPES,
  TEST_KINDS_BY_TYPE,
  TAG_TYPES,
  TAG_STATUSES,
  type SystemTreePayload,
  type BoundaryPayload,
  type PlanPayload,
  type MatrixPayload,
  type PackPayload,
  type SheetPayload,
  type PunchPayload,
  type CertificatePayload,
  type PrecommPayload,
  type ColdClearancePayload,
  type TagPayload,
  type SystemItem,
} from '../services/comWorkspace';
import {
  SYSTEM_TYPE_FA,
  SYSTEM_STATUS_FA,
  GATE_TYPE_FA,
  BOUNDARY_KIND_FA,
  CRITICALITY_FA,
  PACK_TYPE_FA,
  PACK_STATUS_FA,
  TEST_KIND_FA,
  TAG_TYPE_FA,
  TAG_STATUS_FA,
} from '../services/commissioning';

export type ComTab = 'overview' | 'systems' | 'tags' | 'boundaries' | 'plan' | 'matrix' | 'packs' | 'sheets' | 'clearance' | 'punch' | 'certs';

const TABS: { id: ComTab; fa: string; en: string; icon: string; subs: string[] }[] = [
  { id: 'overview', fa: 'نمای کلی OPERCOM', en: 'OPERCOM Overview', icon: '🏁', subs: ['d15-p1-s1', 'd15-p2-s2'] },
  { id: 'systems', fa: 'Systemization', en: 'Systems', icon: '🌳', subs: ['d15-p1-s1'] },
  { id: 'tags', fa: 'Tag Register', en: 'Tag Register', icon: '🏷️', subs: ['d15-p1-s1'] },
  { id: 'boundaries', fa: 'مرزبندی سیستم', en: 'Boundaries', icon: '🧭', subs: ['d15-p1-s1'] },
  { id: 'plan', fa: 'برنامه دروازه‌ها', en: 'Gates Plan', icon: '📅', subs: ['d15-p1-s2'] },
  { id: 'matrix', fa: 'Systemization Matrix', en: 'Matrix', icon: '📊', subs: ['d15-p1-s2'] },
  { id: 'packs', fa: 'Test Pack', en: 'Test Packs', icon: '📦', subs: ['d15-p2-s1'] },
  { id: 'sheets', fa: 'Check Sheet A/B', en: 'Check Sheets', icon: '📋', subs: ['d15-p2-s1', 'd15-p3-s1'] },
  { id: 'clearance', fa: 'Cold Clearance', en: 'Clearance', icon: '✅', subs: ['d15-p2-s2'] },
  { id: 'punch', fa: 'Punch List', en: 'Punch', icon: '📝', subs: ['d15-p4-s2'] },
  { id: 'certs', fa: 'Certificates MC/RFSU/PAC/FAC', en: 'Certificates', icon: '📜', subs: ['d15-p4-s1'] },
];

const SUB_TO_TAB: Record<string, ComTab> = {
  'd15-p1-s1': 'systems',
  'd15-p1-s2': 'plan',
  'd15-p2-s1': 'packs',
  'd15-p2-s2': 'clearance',
  'd15-p3-s1': 'sheets',
  'd15-p3-s2': 'overview',
  'd15-p4-s1': 'certs',
  'd15-p4-s2': 'punch',
  'd15-p5-s1': 'overview',
  'd15-p5-s2': 'overview',
  'd15-p6-s1': 'overview',
  'd15-p6-s2': 'overview',
};

const inputCls = 'rounded-lg border b-line-soft bg-black/20 px-2.5 py-1.5 text-[11px] tx1 placeholder:text-[10px] placeholder:tx4 w-full';
const btnCls = 'rounded-lg border px-3 py-1.5 text-[11px] transition disabled:opacity-40';
const btnPrimary = `${btnCls} border-sky-400/40 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20`;
const btnOk = `${btnCls} border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20`;
const btnGhost = `${btnCls} border b-line-soft tx2 hover:bg-white/5`;

function Section({ title, note, children, action }: { title: string; note?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="glass-dark rounded-2xl p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <h4 className="text-[12px] font-semibold tx1">{title}</h4>
          {note && <p className="text-[10px] font-extralight tx3 mt-1">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/15 px-3 py-2">
      <div className="text-[9px] tx3">{label}</div>
      <div className="text-[14px] font-semibold tx1 tabular-nums" dir="ltr">{value}</div>
      {hint && <div className="text-[8px] tx4 mt-1">{hint}</div>}
    </div>
  );
}

export default function CommissioningWorkspace({
  lang,
  projectId,
  initialTab,
  subId,
  hideTabs = false,
}: {
  lang: Lang;
  projectId: string;
  initialTab?: ComTab;
  subId?: string;
  hideTabs?: boolean;
}) {
  const { user } = useAuth();
  return <LiveCom key={`${projectId}:${user?.id ?? ''}`} lang={lang} projectId={projectId} initialTab={initialTab} subId={subId} hideTabs={hideTabs} userId={user?.id ?? null} />;
}

function LiveCom({
  lang,
  projectId,
  initialTab,
  subId,
  hideTabs,
  userId,
}: {
  lang: Lang;
  projectId: string;
  initialTab?: ComTab;
  subId?: string;
  hideTabs?: boolean;
  userId: string | null;
}) {
  const fa = lang === 'fa';
  const t = (a: string, b: string) => (fa ? a : b);
  const client = useMemo(() => new ComClient(projectId, userId), [projectId, userId]);

  const [tab, setTab] = useState<ComTab>(() => initialTab ?? (subId ? SUB_TO_TAB[subId] ?? 'overview' : 'overview'));
  useEffect(() => {
    if (initialTab) setTab(initialTab);
    else if (subId && SUB_TO_TAB[subId]) setTab(SUB_TO_TAB[subId]);
  }, [initialTab, subId]);

  // data
  const [systems, setSystems] = useState<SystemTreePayload | null>(null);
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [matrix, setMatrix] = useState<MatrixPayload | null>(null);
  const [packs, setPacks] = useState<PackPayload | null>(null);
  const [sheets, setSheets] = useState<SheetPayload | null>(null);
  const [punch, setPunch] = useState<PunchPayload | null>(null);
  const [certs, setCerts] = useState<CertificatePayload | null>(null);
  const [precomm, setPrecomm] = useState<PrecommPayload | null>(null);
  const [tags, setTags] = useState<TagPayload | null>(null);

  // per-selection
  const [selSystemId, setSelSystemId] = useState<string>('');
  const [boundaries, setBoundaries] = useState<BoundaryPayload | null>(null);
  const [cold, setCold] = useState<ColdClearancePayload | null>(null);
  const [selPackId, setSelPackId] = useState<string>('');
  const [selSheetId, setSelSheetId] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const gen = useRef(0);

  // forms
  const [sysForm, setSysForm] = useState({ systemCode: '', titleFa: '', systemType: 'system', status: 'planned', criticalityFa: '', commissioningPriority: '', disciplineCode: '', parentId: '', sortOrder: '' });
  const [moveForm, setMoveForm] = useState({ id: '', parentId: '' });
  const [bndForm, setBndForm] = useState({ systemId: '', targetKind: 'wbs', targetRef: '', isPrimary: false, boundaryNoteFa: '' });
  const [mileForm, setMileForm] = useState({ systemId: '', gateType: 'mc', targetDate: '' });
  const [packForm, setPackForm] = useState({ systemId: '', packNo: '', titleFa: '', packType: 'a', status: 'draft' });
  const [sheetForm, setSheetForm] = useState({ packId: '', sheetNo: '', titleFa: '', testKind: 'hydrotest', lines: [{ lineNo: '1', parameterFa: '', expectedValue: '', unitFa: '', isMandatory: true }] as any[] });
  const [readForm, setReadForm] = useState({ sheetId: '', lineNo: '', actualValue: '', passed: '', noteFa: '' });
  const [signForm, setSignForm] = useState({ sheetId: '', witnessedBy: '' });
  const [clearForm, setClearForm] = useState({ packId: '', dryRun: true });
  const [punchForm, setPunchForm] = useState({ itemNo: '', titleFa: '', category: 'a', disciplineCode: '', contractId: '', certificateId: '' });
  const [punchCloseForm, setPunchCloseForm] = useState({ id: '', resolutionFa: '' });
  const [certForm, setCertForm] = useState({ contractId: '', certificateType: 'mc', certificateNo: '', titleFa: '', handoverDate: '' });
  const [tagForm, setTagForm] = useState({ tagNo: '', titleFa: '', tagType: 'equipment', status: 'planned', systemId: '', disciplineCode: '', locationFa: '', loopNo: '', criticalityFa: '', manufacturerFa: '', modelFa: '' });
  const [tagFilter, setTagFilter] = useState({ q: '', tagType: '', status: '', systemId: '' });

  const loadAll = useCallback(async () => {
    const seq = ++gen.current;
    setLoading(true);
    setError('');
    try {
      const [s, p, m, pk, sh, pu, ce, pr, tg] = await Promise.all([
        client.systems(),
        client.plan(),
        client.matrix(),
        client.packs(),
        client.sheets(),
        client.punch(),
        client.certificates(),
        client.precomm(),
        client.tags(),
      ]);
      if (seq !== gen.current) return;
      if (!s.ok) throw new Error(s.message);
      setSystems(s.data);
      if (p.ok) setPlan(p.data); else setPlan(null);
      if (m.ok) setMatrix(m.data); else setMatrix(null);
      if (pk.ok) setPacks(pk.data); else setPacks(null);
      if (sh.ok) setSheets(sh.data); else setSheets(null);
      if (pu.ok) setPunch(pu.data); else setPunch(null);
      if (ce.ok) setCerts(ce.data); else setCerts(null);
      if (pr.ok) setPrecomm(pr.data); else setPrecomm(null);
      if (tg.ok) setTags(tg.data); else setTags(null);

      if (s.data.items.length && !selSystemId) {
        const first = s.data.items[0].Id;
        setSelSystemId(first);
        setBndForm(v => ({ ...v, systemId: first }));
        setMileForm(v => ({ ...v, systemId: first }));
        setPackForm(v => ({ ...v, systemId: first }));
        setTagForm(v => ({ ...v, systemId: first }));
      }
      if (pk.ok && pk.data.items.length && !selPackId) {
        const fp = pk.data.items[0].Id;
        setSelPackId(fp);
        setSheetForm(v => ({ ...v, packId: fp }));
        setClearForm(v => ({ ...v, packId: fp }));
      }
      if (sh.ok && sh.data.items.length && !selSheetId) {
        const fs = sh.data.items[0].Id;
        setSelSheetId(fs);
        setReadForm(v => ({ ...v, sheetId: fs }));
        setSignForm(v => ({ ...v, sheetId: fs }));
      }
    } catch (e: any) {
      if (seq !== gen.current) return;
      setError(e?.message ?? t('خطا در دریافت', 'Fetch error'));
    } finally {
      if (seq === gen.current) setLoading(false);
    }
  }, [client, selSystemId, selPackId, selSheetId, t]);

  useEffect(() => {
    void loadAll();
    return () => { gen.current++; };
  }, [loadAll]);

  const loadBoundaries = useCallback(async (systemId: string) => {
    if (!systemId) { setBoundaries(null); setCold(null); return; }
    const b = await client.boundaries(systemId);
    if (b.ok) setBoundaries(b.data); else setBoundaries(null);
    const c = await client.coldClearance(systemId);
    if (c.ok) setCold(c.data); else setCold(null);
  }, [client]);

  useEffect(() => { if (selSystemId) void loadBoundaries(selSystemId); }, [selSystemId, loadBoundaries]);

  const loadSheetsForPack = useCallback(async (packId: string) => {
    if (!packId) return;
    const r = await client.sheets({ packId });
    if (r.ok) setSheets(r.data);
  }, [client]);

  const loadTags = useCallback(async (filter: typeof tagFilter) => {
    const r = await client.tags({ q: filter.q || undefined, tagType: filter.tagType || undefined, status: filter.status || undefined, systemId: filter.systemId || undefined });
    if (r.ok) setTags(r.data);
  }, [client]);

  // actions
  const act = async (fn: () => Promise<{ ok: boolean; message?: string }>, okText: string) => {
    setBusy(true);
    setMsg(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) {
      setMsg({ tone: 'ok', text: okText });
      await loadAll();
      if (selSystemId) await loadBoundaries(selSystemId);
      return true;
    }
    setMsg({ tone: 'err', text: (r as any).message ?? t('خطا', 'Error') });
    return false;
  };

  // derived
  const sysItems = systems?.items ?? [];
  const flatSystems = useMemo(() => {
    if (!systems) return [];
    const out: { item: SystemItem; depth: number }[] = [];
    const walk = (nodes: any[], d: number) => {
      for (const n of nodes) {
        out.push({ item: n, depth: d });
        if (n.children?.length) walk(n.children, d + 1);
      }
    };
    walk(systems.tree ?? [], 0);
    if (!out.length) return sysItems.map(s => ({ item: s, depth: (s as any).depth ?? 0 }));
    return out;
  }, [systems, sysItems]);

  const selectedSheet = sheets?.items.find(s => s.Id === selSheetId);

  return (
    <div dir={fa ? 'rtl' : 'ltr'} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
      <header className="glass-dark rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h3 className="tx1 font-semibold text-[13px]">{t('راه‌اندازی و تحویل OPERCOM — دادهٔ واقعی پروژه', 'Commissioning OPERCOM — live project data')}</h3>
          <p className="text-[10px] tx3" dir="ltr">{projectId} · {systems?.count ?? 0} Systems · {tags?.count ?? 0} Tags · {packs?.count ?? 0} Packs · {sheets?.count ?? 0} Sheets</p>
          {plan?.summary && <p className="text-[10px] tx3 mt-1">{t(`Systemization Readiness: ${plan.summary.readinessPct}% — Without boundary: ${plan.summary.withoutBoundary} — Without milestone: ${plan.summary.withoutMilestone}`, `آمادگی تفکیک: ${plan.summary.readinessPct}% — بدون مرز: ${plan.summary.withoutBoundary} — بدون تاریخ هدف: ${plan.summary.withoutMilestone}`)}</p>}
          <p className="text-[9px] tx4 mt-1">{t('OPERCOM Flow: Systemization → Tag Register → Boundary → Test Pack → Check Sheet A (Cold) → Cold Clearance → MC → Check Sheet B (Hot) → RFSU → PAC → FAC | Punch Cat A blocks MC, B blocks PAC, C blocks FAC', 'گردش OPERCOM: تفکیک → بانک تگ → مرزبندی → بسته آزمون → برگه سرد A → پاکسازی سرد → MC → برگه گرم B → RFSU → PAC → FAC | پانچ A مانع MC، B مانع PAC، C مانع FAC')}</p>
        </div>
        <button className={btnGhost} disabled={loading || busy} onClick={() => void loadAll()}>{t('تازه‌سازی', 'Refresh')}</button>
      </header>

      {!hideTabs && (
        <nav className="flex flex-wrap gap-1.5">
          {TABS.map(tabDef => (
            <button key={tabDef.id} className={`${btnCls} ${tab === tabDef.id ? 'toggle-on' : 'border b-line-soft tx3'}`} onClick={() => setTab(tabDef.id)}>
              <span className="me-1">{tabDef.icon}</span>{fa ? tabDef.fa : tabDef.en}
            </button>
          ))}
        </nav>
      )}

      {error && <p role="alert" className="rounded-xl p-3 bg-rose-500/10 text-rose-300 text-[11px]">{error}</p>}
      {msg && <p className={`rounded-xl p-2 text-[11px] ${msg.tone === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>{msg.text}</p>}
      {loading && <p className="tx3 text-[11px]">{t('در حال دریافت از سرور…', 'Fetching from server…')}</p>}

      {/* overview OPERCOM */}
      {tab === 'overview' && (
        <div className="grid gap-3">
          <Section title={t('OPERCOM — گردش استاندارد راه‌اندازی', 'OPERCOM — Standard Commissioning Flow')} note={t('واژگان مطابق OPERCOM: System → Subsystem → Tag → Boundary → Test Pack → Check Sheet A/B → Punch → Certificate', 'OPERCOM vocab: System → Subsystem → Tag → Boundary → Test Pack → Check Sheet A/B → Punch → Certificate')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] tx2">
              <div className="rounded-lg border b-line-soft p-2">1️⃣ Systemization & Tag Register<br/><span className="tx3 text-[10px]">درخت سیستم‌ها + بانک تگ (Tag No یکتا)</span></div>
              <div className="rounded-lg border b-line-soft p-2">2️⃣ Boundary & Milestone<br/><span className="tx3 text-[10px]">مرزبندی WBS/Activity/PID + تاریخ هدف MC/RFSU/PAC/FAC</span></div>
              <div className="rounded-lg border b-line-soft p-2">3️⃣ Test Pack & Check Sheet A<br/><span className="tx3 text-[10px]">بسته آزمون سرد + برگه‌های A (hydrotest, loop check...)</span></div>
              <div className="rounded-lg border b-line-soft p-2">4️⃣ Cold Clearance → MC<br/><span className="tx3 text-[10px]">تأیید آزمون سرد + بدون NCR باز + بدون Punch Cat A</span></div>
              <div className="rounded-lg border b-line-soft p-2">5️⃣ Check Sheet B → RFSU<br/><span className="tx3 text-[10px]">آزمون گرم (no-load, load test...)</span></div>
              <div className="rounded-lg border b-line-soft p-2">6️⃣ PAC / FAC + Punch<br/><span className="tx3 text-[10px]">Cat B blocks PAC, Cat C blocks FAC</span></div>
            </div>
          </Section>
          <Section title={t('خلاصهٔ تفکیک سیستمی', 'Systemization summary')} note={t('Readiness = سیستم‌هایی که هم مرز دارند هم تاریخ هدف', 'Readiness = systems having both boundary and target date')}>
            {plan?.summary ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <Kpi label={t('کل سیستم‌ها', 'Total systems')} value={String(plan.summary.total)} />
                <Kpi label={t('ریشه‌ها', 'Roots')} value={String(plan.summary.rootCount)} />
                <Kpi label={t('بیشترین عمق', 'Max depth')} value={String(plan.summary.maxDepth)} />
                <Kpi label={t('آمادگی %', 'Readiness %')} value={`${plan.summary.readinessPct}%`} />
                <Kpi label={t('بدون مرز', 'Without boundary')} value={String(plan.summary.withoutBoundary)} />
                <Kpi label={t('بدون تاریخ', 'Without milestone')} value={String(plan.summary.withoutMilestone)} />
                <Kpi label={t('یتیم', 'Orphans')} value={String(plan.summary.orphanCount)} />
                <Kpi label={t('تگ‌ها', 'Tags')} value={String(tags?.count ?? 0)} />
              </div>
            ) : <p className="tx3 text-[11px]">{t('داده‌ای نیست', 'No data')}</p>}
          </Section>
          <Section title={t('پیش‌راه‌اندازی و تگ‌ها', 'Pre-comm & Tags')}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Kpi label={t('بسته‌ها', 'Packs')} value={String(precomm?.summary.packs ?? packs?.count ?? 0)} />
              <Kpi label={t('برگه‌ها', 'Sheets')} value={String(precomm?.summary.sheets ?? sheets?.count ?? 0)} />
              <Kpi label={t('امضاشده', 'Signed')} value={String(precomm?.summary.signedSheets ?? 0)} />
              <Kpi label={t('تگ بدون سیستم', 'Tags without system')} value={String(tags?.summary.withoutSystem ?? 0)} />
            </div>
            {precomm?.summary.systemsWithoutPack?.length ? <p className="text-[10px] tx3 mt-2">{t('سیستم‌های بدون بسته:', 'Systems without pack:')} {precomm.summary.systemsWithoutPack.join(', ')}</p> : null}
            {tags?.summary.withoutSystem ? <p className="text-[10px] tx3">{t('تگ‌های یتیم (بدون سیستم):', 'Orphan tags:')} {tags.summary.withoutSystem}</p> : null}
          </Section>
        </div>
      )}

      {/* systems */}
      {tab === 'systems' && (
        <div className="grid gap-3">
          <Section title={t('ایجاد سیستم (Systemization)', 'Create System')} note={t('OPERCOM: SystemCode یکتا لاتین، TitleFa الزامی، Parent = Subsystem', 'OPERCOM: unique latin SystemCode, Fa title required, Parent = Subsystem')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input className={inputCls} placeholder={t('System Code', 'System code')} value={sysForm.systemCode} onChange={e => setSysForm({ ...sysForm, systemCode: e.target.value })} />
              <input className={inputCls} placeholder={t('عنوان فارسی (TitleFa)', 'Title Fa')} value={sysForm.titleFa} onChange={e => setSysForm({ ...sysForm, titleFa: e.target.value })} />
              <select className={inputCls} value={sysForm.systemType} onChange={e => setSysForm({ ...sysForm, systemType: e.target.value })}>
                {SYSTEM_TYPES.map(v => <option key={v} value={v}>{(SYSTEM_TYPE_FA as any)[v] ?? v}</option>)}
              </select>
              <select className={inputCls} value={sysForm.status} onChange={e => setSysForm({ ...sysForm, status: e.target.value })}>
                {SYSTEM_STATUSES.map(v => <option key={v} value={v}>{(SYSTEM_STATUS_FA as any)[v] ?? v}</option>)}
              </select>
              <select className={inputCls} value={sysForm.criticalityFa} onChange={e => setSysForm({ ...sysForm, criticalityFa: e.target.value })}>
                <option value="">{t('Criticality (اختیاری)', 'Criticality')}</option>
                {CRITICALITIES.map(v => <option key={v} value={v}>{(CRITICALITY_FA as any)[v] ?? v}</option>)}
              </select>
              <input className={inputCls} placeholder={t('Commissioning Priority', 'Priority number')} value={sysForm.commissioningPriority} onChange={e => setSysForm({ ...sysForm, commissioningPriority: e.target.value })} />
              <input className={inputCls} placeholder={t('Discipline', 'Discipline')} value={sysForm.disciplineCode} onChange={e => setSysForm({ ...sysForm, disciplineCode: e.target.value })} />
              <select className={inputCls} value={sysForm.parentId} onChange={e => setSysForm({ ...sysForm, parentId: e.target.value })}>
                <option value="">{t('No Parent (Root System)', 'بدون والد (ریشه)')}</option>
                {sysItems.map(s => <option key={s.Id} value={s.Id}>{s.SystemCode} — {s.TitleFa}</option>)}
              </select>
              <input className={inputCls} placeholder={t('SortOrder', 'Sort order')} value={sysForm.sortOrder} onChange={e => setSysForm({ ...sysForm, sortOrder: e.target.value })} />
            </div>
            <button className={btnPrimary} disabled={busy} onClick={() => void act(async () => {
              const body: any = { systemCode: sysForm.systemCode, titleFa: sysForm.titleFa, systemType: sysForm.systemType, status: sysForm.status };
              if (sysForm.criticalityFa) body.criticalityFa = sysForm.criticalityFa;
              if (sysForm.commissioningPriority) body.commissioningPriority = Number(sysForm.commissioningPriority);
              if (sysForm.disciplineCode) body.disciplineCode = sysForm.disciplineCode;
              if (sysForm.parentId) body.parentId = sysForm.parentId;
              if (sysForm.sortOrder) body.sortOrder = Number(sysForm.sortOrder);
              const r = await client.createSystem(body);
              return r.ok ? { ok: true } : { ok: false, message: r.message };
            }, t('سیستم ایجاد شد', 'System created'))}>{t('ثبت سیستم', 'Create')}</button>
          </Section>

          <Section title={t('درخت سیستم‌ها (System/Subsystem)', 'System tree')} note={t('OPERCOM: System → Subsystem → Package | انتخاب برای مرزبندی و تگ', 'Select for boundaries & tags')}>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1 text-start">{t('System Code', 'Code')}</th><th className="p-1 text-start">{t('Title', 'Title')}</th><th className="p-1">{t('Type', 'Type')}</th><th className="p-1">{t('Status', 'Status')}</th><th className="p-1">{t('Priority', 'Prio')}</th><th className="p-1">{t('Depth', 'Depth')}</th><th className="p-1">{t('Action', 'Action')}</th></tr></thead>
                <tbody>
                  {flatSystems.map(({ item, depth }) => (
                    <tr key={item.Id} className={`border-t b-line-soft ${selSystemId === item.Id ? 'bg-white/5' : ''}`}>
                      <td className="p-1" style={{ paddingInlineStart: `${depth * 16 + 4}px` }}>{item.SystemCode}</td>
                      <td className="p-1">{item.TitleFa}</td>
                      <td className="p-1">{item.typeFa ?? item.SystemType}</td>
                      <td className="p-1">{item.statusFa ?? item.Status}</td>
                      <td className="p-1">{(item as any).CommissioningPriority ?? '—'}</td>
                      <td className="p-1">{(item as any).depth ?? depth}</td>
                      <td className="p-1 flex gap-1">
                        <button className={btnGhost} onClick={() => setSelSystemId(item.Id)}>{t('انتخاب', 'Select')}</button>
                        <button className={btnGhost} onClick={() => setMoveForm({ id: item.Id, parentId: item.ParentId ?? '' })}>{t('جابجایی', 'Move')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {moveForm.id && (
              <div className="flex flex-wrap gap-2 items-center mt-2">
                <span className="text-[11px] tx2">{t('جابجایی', 'Move')} {moveForm.id.slice(0, 8)}</span>
                <select className={inputCls} style={{ width: '260px' }} value={moveForm.parentId} onChange={e => setMoveForm({ ...moveForm, parentId: e.target.value })}>
                  <option value="">{t('Root', 'ریشه')}</option>
                  {sysItems.filter(s => s.Id !== moveForm.id).map(s => <option key={s.Id} value={s.Id}>{s.SystemCode}</option>)}
                </select>
                <button className={btnOk} disabled={busy} onClick={() => void act(async () => {
                  const r = await client.moveSystem(moveForm.id, moveForm.parentId || null);
                  return r.ok ? { ok: true } : { ok: false, message: r.message };
                }, t('جابجا شد', 'Moved'))}>{t('اعمال', 'Apply')}</button>
                <button className={btnGhost} onClick={() => setMoveForm({ id: '', parentId: '' })}>{t('لغو', 'Cancel')}</button>
              </div>
            )}
          </Section>
        </div>
      )}

      {/* tags CSU-2 */}
      {tab === 'tags' && (
        <div className="grid gap-3">
          <Section title={t('Tag Register — بانک تگ راه‌اندازی (CSU-2)', 'Tag Register (CSU-2)')} note={t('OPERCOM: Tag No یکتا، Tag Type = equipment/instrument/electrical...، انتساب به System اختیاری ولی توصیه می‌شود', 'OPERCOM: unique Tag No, Tag Type, System assignment optional but recommended')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input className={inputCls} placeholder={t('Tag No (مثل P-101A)', 'Tag No')} value={tagForm.tagNo} onChange={e => setTagForm({ ...tagForm, tagNo: e.target.value })} />
              <input className={inputCls} placeholder={t('عنوان فارسی تگ', 'Title Fa')} value={tagForm.titleFa} onChange={e => setTagForm({ ...tagForm, titleFa: e.target.value })} />
              <select className={inputCls} value={tagForm.tagType} onChange={e => setTagForm({ ...tagForm, tagType: e.target.value })}>
                {TAG_TYPES.map(v => <option key={v} value={v}>{(TAG_TYPE_FA as any)[v] ?? v}</option>)}
              </select>
              <select className={inputCls} value={tagForm.status} onChange={e => setTagForm({ ...tagForm, status: e.target.value })}>
                {TAG_STATUSES.map(v => <option key={v} value={v}>{(TAG_STATUS_FA as any)[v] ?? v}</option>)}
              </select>
              <select className={inputCls} value={tagForm.systemId} onChange={e => setTagForm({ ...tagForm, systemId: e.target.value })}>
                <option value="">{t('بدون سیستم (یتیم)', 'No system (orphan)')}</option>
                {sysItems.map(s => <option key={s.Id} value={s.Id}>{s.SystemCode} — {s.TitleFa}</option>)}
              </select>
              <input className={inputCls} placeholder={t('Discipline', 'Discipline')} value={tagForm.disciplineCode} onChange={e => setTagForm({ ...tagForm, disciplineCode: e.target.value })} />
              <input className={inputCls} placeholder={t('Location', 'Location')} value={tagForm.locationFa} onChange={e => setTagForm({ ...tagForm, locationFa: e.target.value })} />
              <input className={inputCls} placeholder={t('Loop No', 'Loop No')} value={tagForm.loopNo} onChange={e => setTagForm({ ...tagForm, loopNo: e.target.value })} />
              <select className={inputCls} value={tagForm.criticalityFa} onChange={e => setTagForm({ ...tagForm, criticalityFa: e.target.value })}>
                <option value="">{t('Criticality', 'بحرانیت')}</option>
                {CRITICALITIES.map(v => <option key={v} value={v}>{(CRITICALITY_FA as any)[v] ?? v}</option>)}
              </select>
              <input className={inputCls} placeholder={t('Manufacturer', 'Manufacturer')} value={tagForm.manufacturerFa} onChange={e => setTagForm({ ...tagForm, manufacturerFa: e.target.value })} />
              <input className={inputCls} placeholder={t('Model', 'Model')} value={tagForm.modelFa} onChange={e => setTagForm({ ...tagForm, modelFa: e.target.value })} />
              <button className={btnPrimary} disabled={busy} onClick={() => void act(async () => {
                const body: any = { tagNo: tagForm.tagNo, titleFa: tagForm.titleFa, tagType: tagForm.tagType, status: tagForm.status };
                if (tagForm.systemId) body.systemId = tagForm.systemId;
                if (tagForm.disciplineCode) body.disciplineCode = tagForm.disciplineCode;
                if (tagForm.locationFa) body.locationFa = tagForm.locationFa;
                if (tagForm.loopNo) body.loopNo = tagForm.loopNo;
                if (tagForm.criticalityFa) body.criticalityFa = tagForm.criticalityFa;
                if (tagForm.manufacturerFa) body.manufacturerFa = tagForm.manufacturerFa;
                if (tagForm.modelFa) body.modelFa = tagForm.modelFa;
                const r = await client.createTag(body);
                return r.ok ? { ok: true } : { ok: false, message: r.message };
              }, t('تگ ثبت شد', 'Tag created'))}>{t('ثبت تگ', 'Create Tag')}</button>
            </div>
          </Section>

          <Section title={t('فیلتر و جستجوی تگ', 'Tag filter & search')}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input className={inputCls} placeholder={t('جستجو TagNo/Title', 'Search')} value={tagFilter.q} onChange={e => setTagFilter({ ...tagFilter, q: e.target.value })} />
              <select className={inputCls} value={tagFilter.tagType} onChange={e => setTagFilter({ ...tagFilter, tagType: e.target.value })}>
                <option value="">{t('همه نوع‌ها', 'All types')}</option>
                {TAG_TYPES.map(v => <option key={v} value={v}>{(TAG_TYPE_FA as any)[v] ?? v}</option>)}
              </select>
              <select className={inputCls} value={tagFilter.status} onChange={e => setTagFilter({ ...tagFilter, status: e.target.value })}>
                <option value="">{t('همه وضعیت‌ها', 'All statuses')}</option>
                {TAG_STATUSES.map(v => <option key={v} value={v}>{(TAG_STATUS_FA as any)[v] ?? v}</option>)}
              </select>
              <select className={inputCls} value={tagFilter.systemId} onChange={e => setTagFilter({ ...tagFilter, systemId: e.target.value })}>
                <option value="">{t('همه سیستم‌ها', 'All systems')}</option>
                {sysItems.map(s => <option key={s.Id} value={s.Id}>{s.SystemCode}</option>)}
              </select>
              <button className={btnGhost} onClick={() => void loadTags(tagFilter)}>{t('اعمال فیلتر', 'Apply')}</button>
            </div>
            {tags?.summary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
                <Kpi label={t('کل تگ‌ها', 'Total tags')} value={String(tags.summary.total)} />
                <Kpi label={t('بدون سیستم', 'Without system')} value={String(tags.summary.withoutSystem)} />
                <Kpi label={t('بدون دیسیپلین', 'Without discipline')} value={String(tags.summary.withoutDiscipline)} />
                <Kpi label={t('نوع غالب', 'Top type')} value={Object.entries(tags.summary.byType).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? '—'} />
              </div>
            )}
          </Section>

          <Section title={t('فهرست تگ‌ها', 'Tag list')} note={t('Tag No یکتا در پروژه — مبنای Boundary Kind=tag', 'Unique per project — used as Boundary TargetRef when kind=tag')}>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">{t('Tag No', 'Tag No')}</th><th className="p-1">{t('Title', 'Title')}</th><th className="p-1">{t('Type', 'Type')}</th><th className="p-1">{t('System', 'System')}</th><th className="p-1">{t('Status', 'Status')}</th><th className="p-1">{t('Discipline', 'Disc')}</th><th className="p-1">{t('Location', 'Loc')}</th></tr></thead>
                <tbody>{(tags?.items ?? []).map(tg => <tr key={tg.Id} className="border-t b-line-soft"><td className="p-1" dir="ltr">{tg.TagNo}</td><td className="p-1">{tg.TitleFa}</td><td className="p-1">{tg.typeFa}</td><td className="p-1">{sysItems.find(s=>s.Id===tg.SystemId)?.SystemCode ?? '—'}</td><td className="p-1">{tg.statusFa}</td><td className="p-1">{tg.DisciplineCode ?? '—'}</td><td className="p-1">{tg.LocationFa ?? '—'}</td></tr>)}</tbody>
              </table>
              {!tags?.items.length && <p className="tx3 text-[11px] mt-2">{t('تگی ثبت نشده', 'No tags')}</p>}
            </div>
          </Section>
        </div>
      )}

      {/* boundaries */}
      {tab === 'boundaries' && (
        <div className="grid gap-3">
          <Section title={t('انتخاب سیستم', 'Select system')}>
            <select className={inputCls} value={selSystemId} onChange={e => setSelSystemId(e.target.value)}>
              {sysItems.map(s => <option key={s.Id} value={s.Id}>{s.SystemCode} — {s.TitleFa}</option>)}
            </select>
          </Section>
          <Section title={t('مرزهای سیستم (System Boundary)', 'System boundaries')} note={boundaries?.coverage.gapsFa.join('؛ ') || t('OPERCOM: هر سیستم دقیقاً یک نگاشت اصلی (IsPrimary) باید داشته باشد', 'OPERCOM: each system must have exactly one primary mapping')}>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">{t('نوع (WBS/Activity/PID/Tag)', 'Kind')}</th><th className="p-1">{t('ارجاع', 'Ref')}</th><th className="p-1">{t('اصلی', 'Primary')}</th><th className="p-1">{t('یادداشت', 'Note')}</th></tr></thead>
                <tbody>{(boundaries?.items ?? []).map(b => <tr key={b.Id} className="border-t b-line-soft"><td className="p-1">{b.kindFa ?? b.TargetKind}</td><td className="p-1">{b.TargetRef}</td><td className="p-1">{b.IsPrimary ? '✓' : ''}</td><td className="p-1">{b.BoundaryNoteFa ?? ''}</td></tr>)}</tbody>
              </table>
              {!boundaries?.items.length && <p className="tx3 text-[11px] mt-2">{t('مرزی ثبت نشده — برای سنجش پیشرفت و نمایش به بازرس لازم است', 'No boundaries — required for progress and inspector')}</p>}
            </div>
          </Section>
          <Section title={t('افزودن مرز', 'Add boundary')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={bndForm.targetKind} onChange={e => setBndForm({ ...bndForm, targetKind: e.target.value })}>
                {BOUNDARY_KINDS.map(k => <option key={k} value={k}>{(BOUNDARY_KIND_FA as any)[k] ?? k}</option>)}
              </select>
              <input className={inputCls} placeholder={t('ارجاع (مثل WBS-001 یا TagNo)', 'Target ref')} value={bndForm.targetRef} onChange={e => setBndForm({ ...bndForm, targetRef: e.target.value })} />
              <label className="flex items-center gap-2 text-[11px] tx2"><input type="checkbox" checked={bndForm.isPrimary} onChange={e => setBndForm({ ...bndForm, isPrimary: e.target.checked })} />{t('نگاشت اصلی (Primary)', 'Primary')}</label>
              <input className={inputCls} placeholder={t('یادداشت', 'Note')} value={bndForm.boundaryNoteFa} onChange={e => setBndForm({ ...bndForm, boundaryNoteFa: e.target.value })} />
            </div>
            <button className={btnPrimary} disabled={busy || !selSystemId} onClick={() => void act(async () => {
              const r = await client.createBoundary(selSystemId, { targetKind: bndForm.targetKind, targetRef: bndForm.targetRef, isPrimary: bndForm.isPrimary, boundaryNoteFa: bndForm.boundaryNoteFa || undefined });
              return r.ok ? { ok: true } : { ok: false, message: r.message };
            }, t('مرز ثبت شد', 'Boundary created'))}>{t('ثبت مرز', 'Add')}</button>
          </Section>
        </div>
      )}

      {/* plan */}
      {tab === 'plan' && (
        <div className="grid gap-3">
          <Section title={t('تاریخ هدف دروازه (Gate Target)', 'Gate target date')} note={t('OPERCOM: MC → RFSU → PAC → FAC باید صعودی باشد — لغزش از Target محاسبه می‌شود', 'Gates must be chronological MC→RFSU→PAC→FAC')}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select className={inputCls} value={mileForm.systemId} onChange={e => setMileForm({ ...mileForm, systemId: e.target.value })}>
                {sysItems.map(s => <option key={s.Id} value={s.Id}>{s.SystemCode}</option>)}
              </select>
              <select className={inputCls} value={mileForm.gateType} onChange={e => setMileForm({ ...mileForm, gateType: e.target.value })}>
                {GATE_TYPES.map(g => <option key={g} value={g}>{(GATE_TYPE_FA as any)[g] ?? g}</option>)}
              </select>
              <input className={inputCls} type="date" value={mileForm.targetDate} onChange={e => setMileForm({ ...mileForm, targetDate: e.target.value })} />
              <button className={btnPrimary} disabled={busy} onClick={() => void act(async () => {
                const r = await client.createMilestone(mileForm.systemId, { gateType: mileForm.gateType, targetDate: mileForm.targetDate });
                return r.ok ? { ok: true } : { ok: false, message: r.message };
              }, t('تاریخ هدف ثبت شد', 'Milestone saved'))}>{t('ثبت', 'Save')}</button>
            </div>
          </Section>
          <Section title={t('برنامه تکمیل (Completion Schedule)', 'Completion plan')}>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1 text-start">{t('System', 'سیستم')}</th><th className="p-1">{t('Status', 'وضعیت')}</th>{GATE_TYPES.map(g => <th key={g} className="p-1">{(GATE_TYPE_FA as any)[g] ?? g}</th>)}<th className="p-1">{t('Worst Slip', 'بدترین لغزش')}</th></tr></thead>
                <tbody>{(plan?.plan ?? []).map(row => <tr key={row.systemId} className="border-t b-line-soft"><td className="p-1">{row.systemCode} — {row.titleFa}</td><td className="p-1">{row.statusFa}</td>{GATE_TYPES.map(g => <td key={g} className="p-1" dir="ltr">{row.gates[g]?.target ?? '—'}</td>)}<td className="p-1" dir="ltr">{row.worstSlipDays ?? '—'}</td></tr>)}</tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* matrix */}
      {tab === 'matrix' && (
        <Section title={t('Systemization Matrix — ماتریس سیستمی (خروجی اکسل فارسی)', 'Systemization matrix')} note={t('ستون‌ها فارسی برای فایل تحویل کارفرما — مستقیم از موتور', 'Fa columns for client handover')}>
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-[10px] tx2">
              <thead><tr>{(matrix?.columns ?? []).map(c => <th key={c} className="p-1 text-start">{c}</th>)}</tr></thead>
              <tbody>{(matrix?.rows ?? []).slice(0, 200).map((r: any, i) => <tr key={i} className="border-t b-line-soft">{(matrix?.columns ?? []).map(col => <td key={col} className="p-1">{String(r[col] ?? '—')}</td>)}</tr>)}</tbody>
            </table>
            {!matrix?.rows.length && <p className="tx3 text-[11px] mt-2">{t('ماتریسی نیست', 'No matrix')}</p>}
          </div>
        </Section>
      )}

      {/* packs */}
      {tab === 'packs' && (
        <div className="grid gap-3">
          <Section title={t('ایجاد Test Pack', 'Create test pack')} note={t('OPERCOM: Pack Type A = Cold, B = Hot | PackNo یکتا', 'OPERCOM: A=Cold, B=Hot')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={packForm.systemId} onChange={e => setPackForm({ ...packForm, systemId: e.target.value })}>
                {sysItems.map(s => <option key={s.Id} value={s.Id}>{s.SystemCode}</option>)}
              </select>
              <input className={inputCls} placeholder={t('Pack No', 'Pack No')} value={packForm.packNo} onChange={e => setPackForm({ ...packForm, packNo: e.target.value })} />
              <input className={inputCls} placeholder={t('عنوان فارسی', 'Title Fa')} value={packForm.titleFa} onChange={e => setPackForm({ ...packForm, titleFa: e.target.value })} />
              <select className={inputCls} value={packForm.packType} onChange={e => setPackForm({ ...packForm, packType: e.target.value })}>
                {PACK_TYPES.map(pt => <option key={pt} value={pt}>{(PACK_TYPE_FA as any)[pt] ?? pt} — {pt === 'a' ? 'Cold' : 'Hot'}</option>)}
              </select>
              <select className={inputCls} value={packForm.status} onChange={e => setPackForm({ ...packForm, status: e.target.value })}>
                {['draft', 'in_progress', 'cleared', 'rejected'].map(s => <option key={s} value={s}>{(PACK_STATUS_FA as any)[s] ?? s}</option>)}
              </select>
              <button className={btnPrimary} disabled={busy} onClick={() => void act(async () => {
                const r = await client.createPack({ systemId: packForm.systemId, packNo: packForm.packNo, titleFa: packForm.titleFa, packType: packForm.packType, status: packForm.status });
                return r.ok ? { ok: true } : { ok: false, message: r.message };
              }, t('بسته ایجاد شد', 'Pack created'))}>{t('ثبت', 'Create')}</button>
            </div>
          </Section>
          <Section title={t('فهرست Test Packها', 'Packs')} note={t('Progress از Signed Sheets، Void از مخرج حذف می‌شود — OPERCOM', 'Progress from signed, void excluded')}>
            <div className="flex flex-wrap gap-2 mb-2">
              <select className={inputCls} style={{ width: '200px' }} value={selPackId} onChange={e => setSelPackId(e.target.value)}>
                <option value="">{t('انتخاب بسته', 'Select pack')}</option>
                {(packs?.items ?? []).map(p => <option key={p.Id} value={p.Id}>{p.PackNo} — {p.TitleFa}</option>)}
              </select>
              <button className={btnGhost} onClick={() => selPackId && void loadSheetsForPack(selPackId)}>{t('بارگذاری برگه‌ها', 'Load sheets')}</button>
              <label className="flex items-center gap-1 text-[11px] tx2"><input type="checkbox" checked={clearForm.dryRun} onChange={e => setClearForm({ ...clearForm, dryRun: e.target.checked })} />{t('بررسی خشک (Dry Run)', 'Dry run')}</label>
              <button className={btnOk} disabled={busy || !selPackId} onClick={() => void act(async () => {
                const r = await client.clearPack(selPackId, { dryRun: clearForm.dryRun });
                if (!r.ok) return { ok: false, message: r.message };
                const data = r.data as any;
                if (data.dryRun) {
                  setMsg({ tone: data.progress?.canClear ? 'ok' : 'err', text: `${t('بررسی:', 'Check:')} ${(data.progress?.blockersFa ?? []).join('؛ ') || t('قابل تأیید', 'Can clear')}` });
                  return { ok: true };
                }
                return { ok: true };
              }, t('بسته بررسی/تأیید شد', 'Pack checked/cleared'))}>{clearForm.dryRun ? t('بررسی', 'Check') : t('تأیید بسته (Clear)', 'Clear pack')}</button>
            </div>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">{t('Pack No', 'شماره')}</th><th className="p-1">{t('Title', 'عنوان')}</th><th className="p-1">{t('Type A/B', 'نوع')}</th><th className="p-1">{t('Status', 'وضعیت')}</th><th className="p-1">{t('Sheets', 'برگه‌ها')}</th><th className="p-1">{t('Signed', 'امضا')}</th><th className="p-1">{t('Progress', 'پیشرفت')}</th><th className="p-1">{t('Can Clear', 'قابل تأیید')}</th></tr></thead>
                <tbody>{(packs?.items ?? []).map(p => <tr key={p.Id} className={`border-t b-line-soft ${selPackId === p.Id ? 'bg-white/5' : ''}`}><td className="p-1">{p.PackNo}</td><td className="p-1">{p.TitleFa}</td><td className="p-1">{p.typeFa}</td><td className="p-1">{p.statusFa}</td><td className="p-1">{p.progress.total}</td><td className="p-1">{p.progress.signed}</td><td className="p-1">{p.progress.clearedPct}%</td><td className="p-1">{p.progress.canClear ? '✓' : (p.progress.blockersFa[0] ?? '')}</td></tr>)}</tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* sheets */}
      {tab === 'sheets' && (
        <div className="grid gap-3">
          <Section title={t('ایجاد Check Sheet A/B', 'Create check sheet')} note={t('OPERCOM: Test Kind باید با Pack Type بخواند — A: hydrotest/flushing/loop_check..., B: no_load/load_test...', 'Test kind must match pack type')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={sheetForm.packId} onChange={e => setSheetForm({ ...sheetForm, packId: e.target.value })}>
                {(packs?.items ?? []).map(p => <option key={p.Id} value={p.Id}>{p.PackNo} ({(PACK_TYPE_FA as any)[p.PackType]})</option>)}
              </select>
              <input className={inputCls} placeholder={t('Sheet No', 'شماره برگه')} value={sheetForm.sheetNo} onChange={e => setSheetForm({ ...sheetForm, sheetNo: e.target.value })} />
              <input className={inputCls} placeholder={t('عنوان فارسی', 'Title Fa')} value={sheetForm.titleFa} onChange={e => setSheetForm({ ...sheetForm, titleFa: e.target.value })} />
              <select className={inputCls} value={sheetForm.testKind} onChange={e => setSheetForm({ ...sheetForm, testKind: e.target.value })}>
                {Object.entries(TEST_KINDS_BY_TYPE).flatMap(([pt, kinds]) => (kinds as string[]).map(k => <option key={`${pt}-${k}`} value={k}>{(TEST_KIND_FA as any)[k] ?? k} — {(PACK_TYPE_FA as any)[pt]}</option>))}
              </select>
            </div>
            <div className="space-y-2 mt-2">
              <div className="text-[11px] tx2">{t('ردیف‌های پارامتر (حداقل یکی) — IsMandatory مبنای قبولی', 'Parameter lines — mandatory = verdict basis')}</div>
              {sheetForm.lines.map((ln: any, idx: number) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <input className={inputCls} placeholder={t('Line No', 'شماره ردیف')} value={ln.lineNo} onChange={e => { const a = [...sheetForm.lines]; a[idx] = { ...a[idx], lineNo: e.target.value }; setSheetForm({ ...sheetForm, lines: a }); }} />
                  <input className={inputCls} placeholder={t('Parameter', 'نام پارامتر')} value={ln.parameterFa} onChange={e => { const a = [...sheetForm.lines]; a[idx] = { ...a[idx], parameterFa: e.target.value }; setSheetForm({ ...sheetForm, lines: a }); }} />
                  <input className={inputCls} placeholder={t('Expected', 'مقدار مورد انتظار')} value={ln.expectedValue} onChange={e => { const a = [...sheetForm.lines]; a[idx] = { ...a[idx], expectedValue: e.target.value }; setSheetForm({ ...sheetForm, lines: a }); }} />
                  <input className={inputCls} placeholder={t('Unit', 'واحد')} value={ln.unitFa} onChange={e => { const a = [...sheetForm.lines]; a[idx] = { ...a[idx], unitFa: e.target.value }; setSheetForm({ ...sheetForm, lines: a }); }} />
                  <div className="flex gap-1">
                    <label className="flex items-center gap-1 text-[10px] tx2"><input type="checkbox" checked={ln.isMandatory} onChange={e => { const a = [...sheetForm.lines]; a[idx] = { ...a[idx], isMandatory: e.target.checked }; setSheetForm({ ...sheetForm, lines: a }); }} />{t('الزامی', 'Mandatory')}</label>
                    <button className={btnGhost} onClick={() => setSheetForm({ ...sheetForm, lines: sheetForm.lines.filter((_: any, i: number) => i !== idx) })}>{t('حذف', 'Remove')}</button>
                  </div>
                </div>
              ))}
              <button className={btnGhost} onClick={() => setSheetForm({ ...sheetForm, lines: [...sheetForm.lines, { lineNo: String(sheetForm.lines.length + 1), parameterFa: '', expectedValue: '', unitFa: '', isMandatory: true }] })}>{t('افزودن ردیف', 'Add line')}</button>
            </div>
            <button className={btnPrimary} disabled={busy} onClick={() => void act(async () => {
              const lines = sheetForm.lines.map((l: any) => ({ lineNo: Number(l.lineNo), parameterFa: l.parameterFa, expectedValue: l.expectedValue || null, unitFa: l.unitFa || null, isMandatory: l.isMandatory }));
              const r = await client.createSheet({ packId: sheetForm.packId, sheetNo: sheetForm.sheetNo, titleFa: sheetForm.titleFa, testKind: sheetForm.testKind, lines });
              return r.ok ? { ok: true } : { ok: false, message: r.message };
            }, t('برگه ایجاد شد', 'Sheet created'))}>{t('ثبت برگه', 'Create sheet')}</button>
          </Section>

          <Section title={t('فهرست برگه‌ها (Check Sheet A=سرد، B=گرم)', 'Sheets A=Cold, B=Hot')}>
            <div className="flex flex-wrap gap-2 mb-2">
              <select className={inputCls} style={{ width: '260px' }} value={selPackId} onChange={e => { setSelPackId(e.target.value); void loadSheetsForPack(e.target.value); }}>
                <option value="">{t('همهٔ بسته‌ها', 'All packs')}</option>
                {(packs?.items ?? []).map(p => <option key={p.Id} value={p.Id}>{p.PackNo}</option>)}
              </select>
              <select className={inputCls} style={{ width: '260px' }} value={selSheetId} onChange={e => setSelSheetId(e.target.value)}>
                <option value="">{t('انتخاب برگه', 'Select sheet')}</option>
                {(sheets?.items ?? []).map(s => <option key={s.Id} value={s.Id}>{s.SheetNo} — {s.TitleFa}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">{t('Sheet No', 'شماره')}</th><th className="p-1">{t('Title', 'عنوان')}</th><th className="p-1">{t('Test Kind', 'نوع آزمون')}</th><th className="p-1">{t('Result', 'نتیجه')}</th><th className="p-1">{t('Status', 'وضعیت')}</th><th className="p-1">{t('Blockers', 'خطاها')}</th></tr></thead>
                <tbody>{(sheets?.items ?? []).map(s => <tr key={s.Id} className={`border-t b-line-soft ${selSheetId === s.Id ? 'bg-white/5' : ''}`}><td className="p-1">{s.SheetNo}</td><td className="p-1">{s.TitleFa}</td><td className="p-1">{s.kindFa}</td><td className="p-1">{s.resultLabelFa ?? s.verdict.resultLabelFa}</td><td className="p-1">{s.Status}</td><td className="p-1">{s.verdict.blockersFa.join('؛ ')}</td></tr>)}</tbody>
              </table>
            </div>
            {selectedSheet && (
              <div className="mt-3 space-y-2">
                <h5 className="text-[11px] tx1">{t('ردیف‌های برگه', 'Sheet lines')} — {selectedSheet.SheetNo}</h5>
                <table className="w-full text-[10px] tx2">
                  <thead><tr><th className="p-1">{t('Line', 'ردیف')}</th><th className="p-1">{t('Param', 'پارامتر')}</th><th className="p-1">{t('Expected', 'مورد انتظار')}</th><th className="p-1">{t('Actual', 'واقعی')}</th><th className="p-1">{t('Pass', 'قبول')}</th></tr></thead>
                  <tbody>{selectedSheet.lines.map(l => <tr key={l.Id} className="border-t b-line-soft"><td className="p-1">{l.LineNo}</td><td className="p-1">{l.ParameterFa}</td><td className="p-1">{l.ExpectedValue ?? '—'}</td><td className="p-1">{l.ActualValue ?? '—'}</td><td className="p-1">{l.Passed === true ? '✓' : l.Passed === false ? '✗' : '—'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title={t('ثبت قرائت (Reading)', 'Record reading')} note={t('Verdict از ردیف‌های الزامی مشتق می‌شود — سکوت = قبولی نیست', 'Verdict derived from mandatory lines')}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select className={inputCls} value={readForm.sheetId} onChange={e => setReadForm({ ...readForm, sheetId: e.target.value })}>
                {(sheets?.items ?? []).map(s => <option key={s.Id} value={s.Id}>{s.SheetNo}</option>)}
              </select>
              <input className={inputCls} placeholder={t('Line No', 'شماره ردیف')} value={readForm.lineNo} onChange={e => setReadForm({ ...readForm, lineNo: e.target.value })} />
              <input className={inputCls} placeholder={t('Actual Value', 'مقدار واقعی')} value={readForm.actualValue} onChange={e => setReadForm({ ...readForm, actualValue: e.target.value })} />
              <select className={inputCls} value={readForm.passed} onChange={e => setReadForm({ ...readForm, passed: e.target.value })}>
                <option value="">{t('Unknown', 'نامعلوم')}</option>
                <option value="true">{t('Pass', 'قبول')}</option>
                <option value="false">{t('Fail', 'مردود')}</option>
              </select>
              <input className={inputCls} placeholder={t('Note', 'یادداشت')} value={readForm.noteFa} onChange={e => setReadForm({ ...readForm, noteFa: e.target.value })} />
              <button className={btnPrimary} disabled={busy} onClick={() => void act(async () => {
                const body: any = { lineNo: Number(readForm.lineNo), actualValue: readForm.actualValue || null, noteFa: readForm.noteFa || undefined };
                if (readForm.passed === 'true') body.passed = true;
                if (readForm.passed === 'false') body.passed = false;
                const r = await client.postReading(readForm.sheetId, body);
                return r.ok ? { ok: true } : { ok: false, message: r.message };
              }, t('قرائت ثبت شد', 'Reading saved'))}>{t('ثبت قرائت', 'Save reading')}</button>
            </div>
          </Section>

          <Section title={t('امضای برگه (Sign) + شاهد', 'Sign sheet')} note={t('OPERCOM: بدون Witness امضا مجاز نیست؛ Pending قابل امضا نیست', 'Witness required; pending not signable')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={signForm.sheetId} onChange={e => setSignForm({ ...signForm, sheetId: e.target.value })}>
                {(sheets?.items ?? []).map(s => <option key={s.Id} value={s.Id}>{s.SheetNo} — {s.verdict.resultLabelFa}</option>)}
              </select>
              <input className={inputCls} placeholder={t('شاهد (Witnessed By)', 'Witnessed by')} value={signForm.witnessedBy} onChange={e => setSignForm({ ...signForm, witnessedBy: e.target.value })} />
              <button className={btnOk} disabled={busy} onClick={() => void act(async () => {
                const r = await client.signSheet(signForm.sheetId, { witnessedBy: signForm.witnessedBy });
                return r.ok ? { ok: true } : { ok: false, message: r.message };
              }, t('برگه امضا شد', 'Sheet signed'))}>{t('امضا', 'Sign')}</button>
            </div>
          </Section>
        </div>
      )}

      {/* clearance */}
      {tab === 'clearance' && (
        <div className="grid gap-3">
          <Section title={t('انتخاب سیستم برای Cold Clearance', 'Select system for cold clearance')}>
            <select className={inputCls} value={selSystemId} onChange={e => setSelSystemId(e.target.value)}>
              {sysItems.map(s => <option key={s.Id} value={s.Id}>{s.SystemCode} — {s.TitleFa}</option>)}
            </select>
          </Section>
          <Section title={t('وضعیت تأیید آزمون سرد (Cold Clearance) — پیش‌نیاز MC', 'Cold test clearance — prereq for MC')} note={t('OPERCOM: همهٔ موانع یک‌جا — بسته‌های A باید Cleared باشند، NCR باز نباشد، Punch A بسته باشد', 'All blockers at once')}>
            {cold ? (
              <div className="space-y-2 text-[11px] tx2">
                <p>{t('System:', 'سیستم:')} {cold.system.code} — {cold.system.titleFa}</p>
                <p>{t('Cold packs:', 'بسته‌های سرد:')} {cold.clearance.clearedPacks}/{cold.clearance.packCount} — {cold.clearance.ok ? t('Ready', 'آماده') : t('Blocked', 'مسدود')}</p>
                {cold.clearance.blockersFa.length > 0 && <ul className="list-disc ps-4 text-rose-300">{cold.clearance.blockersFa.map((b, i) => <li key={i}>{b}</li>)}</ul>}
                {cold.clearance.warningsFa.length > 0 && <ul className="list-disc ps-4 text-amber-300">{cold.clearance.warningsFa.map((w, i) => <li key={i}>{w}</li>)}</ul>}
              </div>
            ) : <p className="tx3 text-[11px]">{t('داده‌ای نیست', 'No data')}</p>}
          </Section>
        </div>
      )}

      {/* punch */}
      {tab === 'punch' && (
        <div className="grid gap-3">
          <Section title={t('ایجاد Punch List', 'Create punch item')} note={t('OPERCOM: Cat A blocks MC, B blocks PAC, C blocks FAC', 'دسته الف مانع MC، ب مانع PAC، ج مانع FAC')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input className={inputCls} placeholder={t('Item No (اختیاری)', 'Item No optional')} value={punchForm.itemNo} onChange={e => setPunchForm({ ...punchForm, itemNo: e.target.value })} />
              <input className={inputCls} placeholder={t('Title Fa', 'عنوان فارسی')} value={punchForm.titleFa} onChange={e => setPunchForm({ ...punchForm, titleFa: e.target.value })} />
              <select className={inputCls} value={punchForm.category} onChange={e => setPunchForm({ ...punchForm, category: e.target.value })}>
                <option value="a">{t('Cat A — blocks MC', 'دسته الف — مانع MC')}</option>
                <option value="b">{t('Cat B — blocks PAC', 'دسته ب — مانع PAC')}</option>
                <option value="c">{t('Cat C — blocks FAC', 'دسته ج — مانع FAC')}</option>
              </select>
              <input className={inputCls} placeholder={t('Discipline', 'دیسیپلین')} value={punchForm.disciplineCode} onChange={e => setPunchForm({ ...punchForm, disciplineCode: e.target.value })} />
              <input className={inputCls} placeholder={t('Contract Id optional', 'قرارداد (اختیاری)')} value={punchForm.contractId} onChange={e => setPunchForm({ ...punchForm, contractId: e.target.value })} />
              <input className={inputCls} placeholder={t('Certificate Id optional', 'گواهی (اختیاری)')} value={punchForm.certificateId} onChange={e => setPunchForm({ ...punchForm, certificateId: e.target.value })} />
              <button className={btnPrimary} disabled={busy} onClick={() => void act(async () => {
                const body: any = { titleFa: punchForm.titleFa, category: punchForm.category };
                if (punchForm.itemNo) body.itemNo = punchForm.itemNo;
                if (punchForm.disciplineCode) body.disciplineCode = punchForm.disciplineCode;
                if (punchForm.contractId) body.contractId = punchForm.contractId;
                if (punchForm.certificateId) body.certificateId = punchForm.certificateId;
                const r = await client.createPunch(body);
                return r.ok ? { ok: true } : { ok: false, message: r.message };
              }, t('نقص ثبت شد', 'Punch created'))}>{t('ثبت', 'Create')}</button>
            </div>
          </Section>
          <Section title={t('فهرست نواقص (Punch List)', 'Punch list')}>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">{t('No', 'شماره')}</th><th className="p-1">{t('Title', 'عنوان')}</th><th className="p-1">{t('Category', 'دسته')}</th><th className="p-1">{t('Status', 'وضعیت')}</th><th className="p-1">{t('Contract', 'قرارداد')}</th></tr></thead>
                <tbody>{(punch?.items ?? []).map(pu => <tr key={pu.Id} className="border-t b-line-soft"><td className="p-1">{pu.ItemNo}</td><td className="p-1">{pu.TitleFa}</td><td className="p-1">{(pu as any).categoryFa ?? pu.Category}</td><td className="p-1">{pu.Status}</td><td className="p-1">{pu.ContractId ?? '—'}</td></tr>)}</tbody>
              </table>
            </div>
          </Section>
          <Section title={t('بستن نقص (Close Punch)', 'Close punch')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={punchCloseForm.id} onChange={e => setPunchCloseForm({ ...punchCloseForm, id: e.target.value })}>
                <option value="">{t('انتخاب نقص باز', 'Select open punch')}</option>
                {(punch?.items ?? []).filter(p => p.Status !== 'closed').map(p => <option key={p.Id} value={p.Id}>{p.ItemNo} — {p.TitleFa}</option>)}
              </select>
              <input className={inputCls} placeholder={t('Resolution Fa', 'توضیح رفع')} value={punchCloseForm.resolutionFa} onChange={e => setPunchCloseForm({ ...punchCloseForm, resolutionFa: e.target.value })} />
              <button className={btnOk} disabled={busy} onClick={() => void act(async () => {
                const r = await client.closePunch(punchCloseForm.id, { resolutionFa: punchCloseForm.resolutionFa });
                return r.ok ? { ok: true } : { ok: false, message: r.message };
              }, t('نقص بسته شد', 'Punch closed'))}>{t('بستن', 'Close')}</button>
            </div>
          </Section>
        </div>
      )}

      {/* certs */}
      {tab === 'certs' && (
        <div className="grid gap-3">
          <Section title={t('صدور گواهی تحویل (MC/RFSU/PAC/FAC)', 'Issue certificate')} note={t('OPERCOM: MC → RFSU → PAC → FAC زنجیره‌ای — نواقص دسته مرتبط باید بسته باشد', 'Chain must be respected, related punch closed')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={certForm.certificateType} onChange={e => setCertForm({ ...certForm, certificateType: e.target.value })}>
                {GATE_TYPES.map(g => <option key={g} value={g}>{(GATE_TYPE_FA as any)[g] ?? g}</option>)}
              </select>
              <input className={inputCls} placeholder={t('Certificate No', 'شماره گواهی')} value={certForm.certificateNo} onChange={e => setCertForm({ ...certForm, certificateNo: e.target.value })} />
              <input className={inputCls} placeholder={t('Title Fa', 'عنوان فارسی')} value={certForm.titleFa} onChange={e => setCertForm({ ...certForm, titleFa: e.target.value })} />
              <input className={inputCls} type="date" value={certForm.handoverDate} onChange={e => setCertForm({ ...certForm, handoverDate: e.target.value })} />
              <input className={inputCls} placeholder={t('Contract Id optional', 'قرارداد (اختیاری)')} value={certForm.contractId} onChange={e => setCertForm({ ...certForm, contractId: e.target.value })} />
              <button className={btnPrimary} disabled={busy} onClick={() => void act(async () => {
                const body: any = { certificateType: certForm.certificateType, certificateNo: certForm.certificateNo, titleFa: certForm.titleFa, handoverDate: certForm.handoverDate };
                if (certForm.contractId) body.contractId = certForm.contractId;
                const r = await client.createCertificate(body);
                return r.ok ? { ok: true } : { ok: false, message: r.message };
              }, t('گواهی صادر شد', 'Certificate issued'))}>{t('صدور', 'Issue')}</button>
            </div>
          </Section>
          <Section title={t('فهرست گواهی‌ها (Completion Certificates)', 'Certificates')}>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">{t('No', 'شماره')}</th><th className="p-1">{t('Type', 'نوع')}</th><th className="p-1">{t('Title', 'عنوان')}</th><th className="p-1">{t('Handover', 'تاریخ تحویل')}</th><th className="p-1">{t('Status', 'وضعیت')}</th></tr></thead>
                <tbody>{(certs?.items ?? []).map(c => <tr key={c.Id} className="border-t b-line-soft"><td className="p-1">{c.CertificateNo}</td><td className="p-1">{(c as any).typeFa ?? c.CertificateType}</td><td className="p-1">{c.TitleFa}</td><td className="p-1" dir="ltr">{c.HandoverDate}</td><td className="p-1">{c.Status}</td></tr>)}</tbody>
              </table>
              {!certs?.items.length && <p className="tx3 text-[11px] mt-2">{t('گواهی ثبت نشده', 'No certificates')}</p>}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
