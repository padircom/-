/**
 * EDM-1 + EDM-2 + EDM-3 — میز کار زنده اسناد و مدارک (d1) با اتصال فایل، Hold و پیش‌نیاز.
 * هیچ دادهٔ نمونه ندارد؛ همه از /api/edms/:projectId/... می‌آید.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import { useSystem } from '../context/SystemContext';
import { EdmsClient, type EdmsDocumentList, type EdmsFileList, type EdmsHoldList, type EdmsDependencyList, type EdmsReadiness, type EdmsCommentList, type EdmsDciList, type EdmsDistributionList, type EdmsTemplateList, type EdmsNotificationList, type EdmsEffortList } from '../services/edmsWorkspace';
import { createRow, listRows } from '../services/edmsApi';

export type EdmsTab = 'overview' | 'mdr' | 'revision' | 'files' | 'holds' | 'deps' | 'comments' | 'dci' | 'templates' | 'notifications' | 'effort' | 'workflow' | 'excel' | 'numbering' | 'correspondence' | 'transmittal' | 'lessons';

const TABS: { id: EdmsTab; fa: string; en: string }[] = [
  { id: 'overview', fa: 'نمای کلی', en: 'Overview' },
  { id: 'mdr', fa: 'MDR', en: 'MDR' },
  { id: 'revision', fa: 'نسخه‌ها', en: 'Revisions' },
  { id: 'files', fa: 'پیوست فایل', en: 'Files' },
  { id: 'holds', fa: 'Hold Items', en: 'Holds' },
  { id: 'deps', fa: 'پیش‌نیاز و قفل', en: 'Prereq & Gate' },
  { id: 'comments', fa: 'نظر و Conclusion', en: 'Comments' },
  { id: 'dci', fa: 'DCI و توزیع', en: 'DCI & Dist' },
  { id: 'templates', fa: 'قالب‌ها', en: 'Templates' },
  { id: 'notifications', fa: 'اعلان‌ها', en: 'Notifications' },
  { id: 'effort', fa: 'نفرساعت', en: 'Effort' },
  { id: 'workflow', fa: 'گردش کار', en: 'Workflow' },
  { id: 'excel', fa: 'اکسل', en: 'Excel' },
  { id: 'numbering', fa: 'شماره‌گذاری', en: 'Numbering' },
];

const inputCls = 'rounded-lg border b-line-soft bg-black/20 px-2.5 py-1.5 text-[11px] tx1 placeholder:text-[10px] placeholder:tx4 w-full';
const btnCls = 'rounded-lg border px-3 py-1.5 text-[11px] transition disabled:opacity-40';
const btnPrimary = `${btnCls} border-sky-400/40 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20`;
const btnOk = `${btnCls} border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20`;
const btnGhost = `${btnCls} border b-line-soft tx2 hover:bg-white/5`;

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="glass-dark rounded-2xl p-3 space-y-3">
      <div>
        <h4 className="text-[12px] font-semibold tx1">{title}</h4>
        {note && <p className="text-[10px] tx3 mt-1">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/15 px-3 py-2">
      <div className="text-[9px] tx3">{label}</div>
      <div className="text-[14px] font-semibold tx1 tabular-nums" dir="ltr">{value}</div>
    </div>
  );
}

export default function DocumentWorkspace({
  lang,
  projectId: propProjectId,
  initialTab = 'overview',
  hideTabs = false,
}: {
  lang: Lang;
  projectId?: string;
  initialTab?: EdmsTab;
  hideTabs?: boolean;
}) {
  const { user } = useAuth();
  const { projectScope } = useSystem();
  const projectId = propProjectId ?? projectScope?.projectId ?? '';
  return <LiveEdms key={`${projectId}:${user?.id ?? ''}`} lang={lang} projectId={projectId} initialTab={initialTab} hideTabs={hideTabs} userId={user?.id ?? null} />;
}

function LiveEdms({
  lang,
  projectId,
  initialTab,
  hideTabs,
  userId,
}: {
  lang: Lang;
  projectId: string;
  initialTab: EdmsTab;
  hideTabs: boolean;
  userId: string | null;
}) {
  const fa = lang === 'fa';
  const t = (a: string, b: string) => (fa ? a : b);
  const client = useMemo(() => (projectId ? new EdmsClient(projectId, userId) : null), [projectId, userId]);

  const [tab, setTab] = useState<EdmsTab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  const [docsData, setDocsData] = useState<EdmsDocumentList | null>(null);
  const [filesData, setFilesData] = useState<EdmsFileList | null>(null);
  const [holdsData, setHoldsData] = useState<EdmsHoldList | null>(null);
  const [depsData, setDepsData] = useState<EdmsDependencyList | null>(null);
  const [readiness, setReadiness] = useState<EdmsReadiness | null>(null);
  const [commentsData, setCommentsData] = useState<EdmsCommentList | null>(null);
  const [dciData, setDciData] = useState<EdmsDciList | null>(null);
  const [distData, setDistData] = useState<EdmsDistributionList | null>(null);
  const [tplData, setTplData] = useState<EdmsTemplateList | null>(null);
  const [notifData, setNotifData] = useState<EdmsNotificationList | null>(null);
  const [effortData, setEffortData] = useState<EdmsEffortList | null>(null);
  const [selDocId, setSelDocId] = useState<string>('');
  const [selDocNo, setSelDocNo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const gen = useRef(0);

  const [docForm, setDocForm] = useState({ docNo: '', titleFa: '', revision: 'A', discipline: 'Civil', status: 'draft', reviewCode: '—', slaHours: '0' });
  const [fileNote, setFileNote] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [holdForm, setHoldForm] = useState({ documentId: '', titleFa: '', holdType: 'other', dueAt: '', noteFa: '' });
  const [holdFilter, setHoldFilter] = useState({ status: '', holdType: '' });
  const [depForm, setDepForm] = useState({ documentId: '', dependsOnDocumentId: '', dependencyType: 'approval', isMandatory: true, noteFa: '' });
  const [commentForm, setCommentForm] = useState({ documentId: '', commentText: '', reviewCode: '' });
  const [replyForm, setReplyForm] = useState({ commentId: '', replyText: '' });
  const [concludeForm, setConcludeForm] = useState({ commentId: '', conclusionText: '', reviewCode: '' });
  const [distForm, setDistForm] = useState({ documentId: '', party: 'client', transmittalNo: '', noteFa: '' });
  const [tplForm, setTplForm] = useState({ templateType: 'doc', nameFa: '', code: '', noteFa: '' });
  const [effortForm, setEffortForm] = useState({ documentId: '', workDate: new Date().toISOString().slice(0,10), hours: '4', personName: '', activity: 'design', cost: '', noteFa: '' });

  const loadDocs = useCallback(async () => {
    if (!client) return;
    const seq = ++gen.current;
    setLoading(true);
    setError('');
    try {
      const r = await client.documents();
      if (seq !== gen.current) return;
      if (!r.ok) throw new Error(r.message);
      setDocsData(r.data);
      if (r.data.items.length && !selDocId) {
        const first = r.data.items[0];
        setSelDocId(first.Id);
        setSelDocNo(first.DocNo);
        setHoldForm(f => ({ ...f, documentId: first.Id }));
        setDepForm(f => ({ ...f, documentId: first.Id }));
        setCommentForm(f => ({ ...f, documentId: first.Id }));
        setDistForm(f => ({ ...f, documentId: first.Id }));
        setEffortForm(f => ({ ...f, documentId: first.Id }));
      }
    } catch (e: any) {
      if (seq !== gen.current) return;
      setError(e?.message ?? t('خطا در دریافت', 'Fetch error'));
    } finally {
      if (seq === gen.current) setLoading(false);
    }
  }, [client, selDocId, t]);

  const loadFiles = useCallback(async (docId: string) => {
    if (!client || !docId) { setFilesData(null); return; }
    const r = await client.files(docId);
    if (r.ok) setFilesData(r.data); else setFilesData(null);
  }, [client]);

  const loadHolds = useCallback(async () => {
    if (!client) return;
    const r = await client.holds({ status: holdFilter.status || undefined, holdType: holdFilter.holdType || undefined });
    if (r.ok) setHoldsData(r.data);
  }, [client, holdFilter]);

  const loadDeps = useCallback(async (docId?: string) => {
    if (!client) return;
    const r = await client.dependencies({ documentId: docId || undefined });
    if (r.ok) setDepsData(r.data);
  }, [client]);

  const loadReadiness = useCallback(async (docId: string) => {
    if (!client || !docId) { setReadiness(null); return; }
    const r = await client.readiness(docId);
    if (r.ok) setReadiness(r.data); else setReadiness(null);
  }, [client]);

  const loadDci = useCallback(async () => {
    if (!client) return;
    const r = await client.dci();
    if (r.ok) setDciData(r.data);
  }, [client]);

  const loadEffort = useCallback(async (docId?: string) => {
    if (!client) return;
    if (docId) {
      const r = await client.effort(docId);
      if (r.ok) setEffortData(r.data);
    } else {
      const r = await client.allEffort({});
      if (r.ok) setEffortData(r.data);
    }
  }, [client]);

  const loadNotif = useCallback(async () => {
    if (!client) return;
    const r = await client.notifications({});
    if (r.ok) setNotifData(r.data);
  }, [client]);

  const loadTpl = useCallback(async (type?: string) => {
    if (!client) return;
    const r = await client.templates({ templateType: type || undefined });
    if (r.ok) setTplData(r.data);
  }, [client]);

  const loadDist = useCallback(async (docId?: string) => {
    if (!client) return;
    if (docId) {
      const r = await client.docDistributions(docId);
      if (r.ok) setDistData(r.data);
    } else {
      const r = await client.distributions({});
      if (r.ok) setDistData(r.data);
    }
  }, [client]);

  const loadComments = useCallback(async (docId: string) => {
    if (!client || !docId) { setCommentsData(null); return; }
    const r = await client.comments(docId);
    if (r.ok) setCommentsData(r.data); else setCommentsData(null);
  }, [client]);

  useEffect(() => { void loadDocs(); return () => { gen.current++; }; }, [loadDocs]);
  useEffect(() => { if (selDocId) { void loadFiles(selDocId); void loadReadiness(selDocId); void loadDeps(selDocId); void loadComments(selDocId); void loadDist(selDocId); void loadEffort(selDocId); } }, [selDocId, loadFiles, loadReadiness, loadDeps, loadComments, loadDist, loadEffort]);
  useEffect(() => { void loadHolds(); void loadDci(); void loadDist(); void loadTpl(); void loadNotif(); void loadEffort(); }, [loadHolds, loadDci, loadDist, loadTpl, loadNotif, loadEffort]);

  const filtered = useMemo(() => {
    if (!docsData) return [];
    const q = query.trim().toLowerCase();
    if (!q) return docsData.items;
    return docsData.items.filter(d => d.DocNo.toLowerCase().includes(q) || d.TitleFa.toLowerCase().includes(q) || (d.Discipline ?? '').toLowerCase().includes(q));
  }, [docsData, query]);

  const kpis = useMemo(() => {
    if (!docsData) return { total: 0, approved: 0, withFile: 0, withoutFile: 0, versions: 0 };
    const total = docsData.count;
    const approved = docsData.items.filter(d => d.Status === 'approved').length;
    const withFile = docsData.items.filter(d => d.hasFile).length;
    const versions = Object.values(docsData.byDocNo).reduce((acc, arr) => acc + arr.length, 0);
    return { total, approved, withFile, withoutFile: total - withFile, versions };
  }, [docsData]);

  const act = async (fn: () => Promise<{ ok: boolean; message?: string }>, okText: string) => {
    setBusy(true);
    setMsg(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) {
      setMsg({ tone: 'ok', text: okText });
      await loadDocs();
      if (selDocId) { await loadFiles(selDocId); await loadReadiness(selDocId); await loadDeps(selDocId); await loadComments(selDocId); await loadDist(selDocId); }
      await loadDci();
      await loadTpl();
      await loadNotif();
      if (selDocId) await loadEffort(selDocId); else await loadEffort();
      await loadHolds();
      return true;
    }
    setMsg({ tone: 'err', text: (r as any).message ?? t('خطا', 'Error') });
    return false;
  };

  if (!projectId) return <div className="tx3 text-[11px] p-3">{t('پروژه انتخاب نشده است', 'No project selected')}</div>;

  return (
    <div dir={fa ? 'rtl' : 'ltr'} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
      <header className="glass-dark rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h3 className="tx1 font-semibold text-[13px]">{t('اسناد — فایل + Hold + پیش‌نیاز + نظر/Conclusion (EDM-1..4)', 'EDMS — file + Hold + prereq + comments')}</h3>
          <p className="text-[10px] tx3" dir="ltr">{projectId} · {kpis.total} docs · {kpis.versions} vers · {kpis.withFile} with file · {holdsData?.summary.open ?? 0} open holds · {depsData?.count ?? 0} deps · {readiness ? (readiness.canIssue ? 'Can Issue' : `${readiness.blockers.length} blockers`) : ''}</p>
        </div>
        <button className={btnGhost} disabled={loading || busy} onClick={() => void loadDocs()}>{t('تازه‌سازی', 'Refresh')}</button>
      </header>

      {!hideTabs && (
        <nav className="flex flex-wrap gap-1.5">
          {TABS.map(tb => (
            <button key={tb.id} className={`${btnCls} ${tab === tb.id ? 'toggle-on' : 'border b-line-soft tx3'}`} onClick={() => setTab(tb.id)}>
              {fa ? tb.fa : tb.en}
            </button>
          ))}
        </nav>
      )}

      {error && <p role="alert" className="rounded-xl p-3 bg-rose-500/10 text-rose-300 text-[11px]">{error}</p>}
      {msg && <p className={`rounded-xl p-2 text-[11px] ${msg.tone === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>{msg.text}</p>}
      {loading && <p className="tx3 text-[11px]">{t('در حال دریافت…', 'Fetching…')}</p>}

      {tab === 'overview' && (
        <div className="grid gap-3">
          <Section title={t('KPI اسناد و Hold و پیش‌نیاز', 'Docs & Hold & Prereq KPI')}>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              <Kpi label={t('کل مدارک', 'Total docs')} value={String(kpis.total)} />
              <Kpi label={t('تأییدشده', 'Approved')} value={String(kpis.approved)} />
              <Kpi label={t('دارای فایل', 'With file')} value={String(kpis.withFile)} />
              <Kpi label={t('Hold باز', 'Open holds')} value={String(holdsData?.summary.open ?? 0)} />
              <Kpi label={t('وابستگی‌ها', 'Deps')} value={String(depsData?.count ?? 0)} />
            </div>
          </Section>
          <Section title={t('آمادگی صدور مدرک انتخاب‌شده', 'Readiness of selected doc')} note={t('قفل صدور: Hold باز یا پیش‌نیاز الزامی تأییدنشده', 'Gate: open Hold or mandatory prereq not approved')}>
            {readiness ? (
              <div className="text-[11px] tx2 space-y-1">
                <p>{readiness.document.docNo} Rev {readiness.document.revision} — {readiness.document.status} — {readiness.canIssue ? t('قابل صدور', 'Can issue') : t('مسدود', 'Blocked')}</p>
                {readiness.blockers.length > 0 && <ul className="list-disc ps-4 text-rose-300">{readiness.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul>}
                {readiness.warnings.length > 0 && <ul className="list-disc ps-4 text-amber-300">{readiness.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>}
              </div>
            ) : <p className="tx3 text-[11px]">{t('مدرکی انتخاب نشده', 'No doc selected')}</p>}
          </Section>
        </div>
      )}

      {tab === 'mdr' && (
        <div className="grid gap-3">
          <Section title={t('ایجاد مدرک جدید', 'Create document')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input className={inputCls} placeholder="DocNo" value={docForm.docNo} onChange={e => setDocForm({ ...docForm, docNo: e.target.value })} />
              <input className={inputCls} placeholder={t('عنوان فارسی', 'Title Fa')} value={docForm.titleFa} onChange={e => setDocForm({ ...docForm, titleFa: e.target.value })} />
              <input className={inputCls} placeholder="Revision" value={docForm.revision} onChange={e => setDocForm({ ...docForm, revision: e.target.value })} />
              <input className={inputCls} placeholder="Discipline" value={docForm.discipline} onChange={e => setDocForm({ ...docForm, discipline: e.target.value })} />
              <select className={inputCls} value={docForm.status} onChange={e => setDocForm({ ...docForm, status: e.target.value })}>
                {['draft','under_review','approved','rejected'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <input className={inputCls} placeholder="ReviewCode" value={docForm.reviewCode} onChange={e => setDocForm({ ...docForm, reviewCode: e.target.value })} />
            </div>
            <button className={btnPrimary} disabled={busy || !docForm.docNo || !docForm.titleFa} onClick={() => void act(async () => {
              const res = await listRows('Document', projectId);
              if (res?.items?.some((r:any)=> r.DocNo===docForm.docNo && r.Revision===docForm.revision)) return { ok:false, message: t('تکراری است','Duplicate') };
              const row = { ProjectId: projectId, DocNo: docForm.docNo.trim(), TitleFa: docForm.titleFa.trim(), TitleEn: docForm.titleFa.trim(), Revision: docForm.revision.trim(), Discipline: docForm.discipline.trim(), Status: docForm.status, ReviewCode: docForm.reviewCode.trim(), SlaHours: Number(docForm.slaHours)||0, IssuedAt: new Date().toISOString().slice(0,10) };
              const created = await createRow('Document', row);
              return created ? { ok:true } : { ok:false, message: t('ثبت ناموفق','Create failed') };
            }, t('مدرک ایجاد شد','Document created'))}>{t('ثبت مدرک','Create')}</button>
          </Section>
          <Section title={t('MDR — فهرست مدارک', 'MDR — documents')}>
            <div className="flex gap-2 mb-2"><input className={inputCls} style={{maxWidth:'300px'}} placeholder={t('جستجو','Search')} value={query} onChange={e=>setQuery(e.target.value)} /></div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1 text-start">DocNo</th><th className="p-1 text-start">{t('عنوان','Title')}</th><th className="p-1">Rev</th><th className="p-1">Status</th><th className="p-1">Disc</th><th className="p-1">{t('فایل','File')}</th><th className="p-1">{t('نسخه‌ها','Vers')}</th><th className="p-1">{t('اقدام','Action')}</th></tr></thead>
                <tbody>
                  {filtered.map(d=>(
                    <tr key={d.Id} className={`border-t b-line-soft ${selDocId===d.Id?'bg-white/5':''}`}>
                      <td className="p-1" dir="ltr">{d.DocNo}</td><td className="p-1">{d.TitleFa}</td><td className="p-1" dir="ltr">{d.Revision}</td><td className="p-1">{d.Status}</td><td className="p-1">{d.Discipline ?? '—'}</td><td className="p-1">{d.hasFile?'✓':'—'}</td><td className="p-1">{d.versions}</td>
                      <td className="p-1 flex gap-1"><button className={btnGhost} onClick={()=>{setSelDocId(d.Id); setSelDocNo(d.DocNo); setTab('files');}}>{t('فایل‌ها','Files')}</button><button className={btnGhost} onClick={()=>{setSelDocId(d.Id); setHoldForm(f=>({...f,documentId:d.Id})); setTab('holds');}}>{t('Hold','Hold')}</button><button className={btnGhost} onClick={()=>{setSelDocId(d.Id); setDepForm(f=>({...f,documentId:d.Id})); setTab('deps');}}>{t('پیش‌نیاز','Prereq')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && <p className="tx3 text-[11px] mt-2">{t('مدرکی نیست','No docs')}</p>}
            </div>
          </Section>
        </div>
      )}

      {tab === 'revision' && (
        <Section title={t('تاریخچه نسخه‌ها','Version history')}>
          <div className="grid gap-2">
            <select className={inputCls} value={selDocNo} onChange={e=>setSelDocNo(e.target.value)}>
              <option value="">{t('انتخاب DocNo','Select DocNo')}</option>
              {Object.keys(docsData?.byDocNo ?? {}).map(dn=><option key={dn} value={dn}>{dn}</option>)}
            </select>
            {selDocNo && docsData?.byDocNo[selDocNo] && (
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">Revision</th><th className="p-1">Status</th><th className="p-1">IssuedAt</th><th className="p-1">FilePath</th><th className="p-1">Id</th></tr></thead>
                <tbody>
                  {docsData.byDocNo[selDocNo].map(v=>(
                    <tr key={v.id} className="border-t b-line-soft"><td className="p-1" dir="ltr">{v.revision}</td><td className="p-1">{v.status}</td><td className="p-1" dir="ltr">{v.issuedAt ?? '—'}</td><td className="p-1" dir="ltr">{v.filePath ?? '—'}</td><td className="p-1" dir="ltr">{v.id.slice(0,8)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Section>
      )}

      {tab === 'files' && (
        <div className="grid gap-3">
          <Section title={t('انتخاب مدرک','Select document')}>
            <select className={inputCls} value={selDocId} onChange={e=>{setSelDocId(e.target.value); const doc=docsData?.items.find(x=>x.Id===e.target.value); if(doc) setSelDocNo(doc.DocNo);}}>
              <option value="">{t('انتخاب مدرک','Select doc')}</option>
              {(docsData?.items ?? []).map(d=><option key={d.Id} value={d.Id}>{d.DocNo} Rev {d.Revision} — {d.TitleFa}</option>)}
            </select>
          </Section>
          <Section title={t('آپلود فایل به نسخه','Upload file to revision')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input type="file" className={inputCls} onChange={e=>setUploadFile(e.target.files?.[0] ?? null)} />
              <input className={inputCls} placeholder={t('یادداشت','Note')} value={fileNote} onChange={e=>setFileNote(e.target.value)} />
              <button className={btnPrimary} disabled={busy || !uploadFile || !selDocId} onClick={()=>void act(async ()=>{
                if(!client || !uploadFile || !selDocId) return {ok:false, message:'No file'};
                const r=await client.uploadFile(selDocId, uploadFile, fileNote||undefined);
                if(r.ok){setUploadFile(null); setFileNote(''); return {ok:true};}
                return {ok:false, message:r.message};
              }, t('فایل آپلود شد','File uploaded'))}>{t('آپلود','Upload')}</button>
            </div>
          </Section>
          <Section title={t('پیوست‌های این نسخه','Attachments')}>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">{t('FileName','نام فایل')}</th><th className="p-1">Mime</th><th className="p-1">Size</th><th className="p-1">UploadedAt</th><th className="p-1">By</th><th className="p-1">{t('دانلود','Download')}</th><th className="p-1">{t('حذف','Delete')}</th></tr></thead>
                <tbody>
                  {(filesData?.items ?? []).map(f=>(
                    <tr key={f.Id} className="border-t b-line-soft"><td className="p-1" dir="ltr">{f.FileName}</td><td className="p-1">{f.MimeType}</td><td className="p-1">{(f.SizeBytes/1024).toFixed(1)} KB</td><td className="p-1" dir="ltr">{new Date(f.UploadedAt).toLocaleString(fa?'fa-IR':'en-US')}</td><td className="p-1" dir="ltr">{f.UploadedBy.slice(0,8)}</td><td className="p-1"><a className={btnGhost} href={f.downloadUrl} target="_blank" rel="noreferrer">{t('دانلود','Download')}</a></td><td className="p-1"><button className={btnGhost} disabled={busy} onClick={()=>void act(async ()=>{
                    if(!client) return {ok:false, message:'No client'};
                    const r=await client.deleteFile(f.Id);
                    return r.ok ? {ok:true} : {ok:false, message:r.message};
                  }, t('حذف شد','Deleted'))}>{t('حذف','Delete')}</button></td></tr>
                  ))}
                </tbody>
              </table>
              {!filesData?.items.length && <p className="tx3 text-[11px] mt-2">{t('پیوستی نیست','No attachments')}</p>}
            </div>
          </Section>
        </div>
      )}

      {tab === 'holds' && (
        <div className="grid gap-3">
          <Section title={t('ایجاد Hold','Create Hold')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={holdForm.documentId} onChange={e=>setHoldForm({...holdForm, documentId:e.target.value})}>
                <option value="">{t('انتخاب مدرک','Select doc')}</option>
                {(docsData?.items ?? []).map(d=><option key={d.Id} value={d.Id}>{d.DocNo} Rev {d.Revision}</option>)}
              </select>
              <input className={inputCls} placeholder={t('دلیل Hold','Hold reason')} value={holdForm.titleFa} onChange={e=>setHoldForm({...holdForm, titleFa:e.target.value})} />
              <select className={inputCls} value={holdForm.holdType} onChange={e=>setHoldForm({...holdForm, holdType:e.target.value})}>
                {['vendor','client','engineering','procurement','other'].map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              <input className={inputCls} type="date" value={holdForm.dueAt} onChange={e=>setHoldForm({...holdForm, dueAt:e.target.value})} />
              <input className={inputCls} placeholder={t('یادداشت','Note')} value={holdForm.noteFa} onChange={e=>setHoldForm({...holdForm, noteFa:e.target.value})} />
              <button className={btnPrimary} disabled={busy || !holdForm.documentId || !holdForm.titleFa} onClick={()=>void act(async ()=>{
                if(!client) return {ok:false, message:'No client'};
                const r=await client.createHold({documentId:holdForm.documentId, titleFa:holdForm.titleFa, holdType:holdForm.holdType, dueAt:holdForm.dueAt||undefined, noteFa:holdForm.noteFa||undefined});
                return r.ok ? {ok:true} : {ok:false, message:r.message};
              }, t('Hold ثبت شد','Hold created'))}>{t('ثبت Hold','Create Hold')}</button>
            </div>
          </Section>
          <Section title={t('فیلتر Hold','Hold filter')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={holdFilter.status} onChange={e=>setHoldFilter({...holdFilter, status:e.target.value})}>
                <option value="">{t('همه وضعیت‌ها','All statuses')}</option><option value="open">open</option><option value="released">released</option><option value="cancelled">cancelled</option>
              </select>
              <select className={inputCls} value={holdFilter.holdType} onChange={e=>setHoldFilter({...holdFilter, holdType:e.target.value})}>
                <option value="">{t('همه نوع‌ها','All types')}</option>{['vendor','client','engineering','procurement','other'].map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              <button className={btnGhost} onClick={()=>void loadHolds()}>{t('اعمال','Apply')}</button>
            </div>
            {holdsData?.summary && <div className="grid grid-cols-3 gap-2 mt-2"><Kpi label={t('باز','Open')} value={String(holdsData.summary.open)} /><Kpi label={t('معوق','Overdue')} value={String(holdsData.summary.overdue)} /><Kpi label={t('آزادشده','Released')} value={String(holdsData.summary.released)} /></div>}
          </Section>
          <Section title={t('فهرست Hold Items','Hold Items list')}>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">HoldNo</th><th className="p-1">DocNo</th><th className="p-1">Rev</th><th className="p-1">{t('دلیل','Reason')}</th><th className="p-1">Type</th><th className="p-1">Status</th><th className="p-1">DueAt</th><th className="p-1">{t('اقدام','Action')}</th></tr></thead>
                <tbody>
                  {(holdsData?.items ?? []).map(h=>(
                    <tr key={h.Id} className="border-t b-line-soft"><td className="p-1" dir="ltr">{h.HoldNo}</td><td className="p-1" dir="ltr">{h.DocNo}</td><td className="p-1" dir="ltr">{h.Revision}</td><td className="p-1">{h.TitleFa}</td><td className="p-1">{h.HoldType}</td><td className="p-1">{h.Status}</td><td className="p-1" dir="ltr">{h.DueAt ?? '—'}</td><td className="p-1 flex gap-1">{h.Status==='open' && <><button className={btnOk} disabled={busy} onClick={()=>void act(async ()=>{
                      if(!client) return {ok:false, message:'No client'};
                      const r=await client.releaseHold(h.Id);
                      return r.ok ? {ok:true} : {ok:false, message:r.message};
                    }, t('آزاد شد','Released'))}>{t('آزاد','Release')}</button><button className={btnGhost} disabled={busy} onClick={()=>void act(async ()=>{
                      if(!client) return {ok:false, message:'No client'};
                      const r=await client.cancelHold(h.Id);
                      return r.ok ? {ok:true} : {ok:false, message:r.message};
                    }, t('لغو شد','Cancelled'))}>{t('لغو','Cancel')}</button></>}</td></tr>
                  ))}
                </tbody>
              </table>
              {!holdsData?.items.length && <p className="tx3 text-[11px] mt-2">{t('Hold باز نیست','No open holds')}</p>}
            </div>
          </Section>
        </div>
      )}

      {tab === 'deps' && (
        <div className="grid gap-3">
          <Section title={t('ایجاد پیش‌نیاز (وابستگی مدرک به مدرک)','Create prerequisite')} note={t('IsMandatory=true = قفل صدور — حلقه ممنوع', 'Mandatory = gate lock — cycle forbidden')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={depForm.documentId} onChange={e=>setDepForm({...depForm, documentId:e.target.value})}>
                <option value="">{t('مدرک وابسته','Dependent doc')}</option>
                {(docsData?.items ?? []).map(d=><option key={d.Id} value={d.Id}>{d.DocNo} Rev {d.Revision}</option>)}
              </select>
              <select className={inputCls} value={depForm.dependsOnDocumentId} onChange={e=>setDepForm({...depForm, dependsOnDocumentId:e.target.value})}>
                <option value="">{t('پیش‌نیاز','Prerequisite doc')}</option>
                {(docsData?.items ?? []).map(d=><option key={d.Id} value={d.Id}>{d.DocNo} Rev {d.Revision} — {d.Status}</option>)}
              </select>
              <select className={inputCls} value={depForm.dependencyType} onChange={e=>setDepForm({...depForm, dependencyType:e.target.value})}>
                {['approval','info','hold'].map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              <label className="flex items-center gap-2 text-[11px] tx2"><input type="checkbox" checked={depForm.isMandatory} onChange={e=>setDepForm({...depForm, isMandatory:e.target.checked})} />{t('الزامی (قفل صدور)','Mandatory (gate lock)')}</label>
              <input className={inputCls} placeholder={t('یادداشت','Note')} value={depForm.noteFa} onChange={e=>setDepForm({...depForm, noteFa:e.target.value})} />
              <button className={btnPrimary} disabled={busy || !depForm.documentId || !depForm.dependsOnDocumentId} onClick={()=>void act(async ()=>{
                if(!client) return {ok:false, message:'No client'};
                const r=await client.createDependency({documentId:depForm.documentId, dependsOnDocumentId:depForm.dependsOnDocumentId, dependencyType:depForm.dependencyType, isMandatory:depForm.isMandatory, noteFa:depForm.noteFa||undefined});
                return r.ok ? {ok:true} : {ok:false, message:r.message};
              }, t('پیش‌نیاز ثبت شد','Dependency created'))}>{t('ثبت پیش‌نیاز','Create prereq')}</button>
            </div>
          </Section>

          <Section title={t('آمادگی صدور مدرک انتخاب‌شده','Readiness of selected doc')} note={t('Hold باز یا پیش‌نیاز الزامی تأییدنشده = مسدود', 'Open Hold or mandatory prereq not approved = blocked')}>
            {readiness ? (
              <div className="text-[11px] tx2 space-y-1">
                <p>{readiness.document.docNo} Rev {readiness.document.revision} — {readiness.document.status} — {readiness.canIssue ? t('قابل صدور','Can issue') : t('مسدود','Blocked')} — {readiness.totalDeps} deps ({readiness.mandatory} mandatory)</p>
                {readiness.blockers.length>0 && <ul className="list-disc ps-4 text-rose-300">{readiness.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul>}
                {readiness.warnings.length>0 && <ul className="list-disc ps-4 text-amber-300">{readiness.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>}
                <button className={btnGhost} onClick={()=> selDocId && void loadReadiness(selDocId)}>{t('بررسی مجدد','Recheck')}</button>
              </div>
            ) : <p className="tx3 text-[11px]">{t('مدرکی انتخاب نشده','No doc selected')}</p>}
          </Section>

          <Section title={t('فهرست وابستگی‌ها','Dependency list')}>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">DocNo</th><th className="p-1">Rev</th><th className="p-1">→ {t('پیش‌نیاز','Prereq')}</th><th className="p-1">Rev</th><th className="p-1">Type</th><th className="p-1">Mandatory</th><th className="p-1">Prereq Status</th><th className="p-1">{t('حذف','Delete')}</th></tr></thead>
                <tbody>
                  {(depsData?.items ?? []).map(d=>(
                    <tr key={d.Id} className="border-t b-line-soft"><td className="p-1" dir="ltr">{d.document?.docNo ?? d.DocumentId.slice(0,8)}</td><td className="p-1" dir="ltr">{d.document?.revision ?? '—'}</td><td className="p-1" dir="ltr">{d.prereq?.docNo ?? d.DependsOnDocumentId.slice(0,8)}</td><td className="p-1" dir="ltr">{d.prereq?.revision ?? '—'}</td><td className="p-1">{d.DependencyType}</td><td className="p-1">{d.IsMandatory?'✓':''}</td><td className="p-1">{d.prereq?.status ?? '—'}</td><td className="p-1"><button className={btnGhost} disabled={busy} onClick={()=>void act(async ()=>{
                      if(!client) return {ok:false, message:'No client'};
                      const r=await client.deleteDependency(d.Id);
                      return r.ok ? {ok:true} : {ok:false, message:r.message};
                    }, t('حذف شد','Deleted'))}>{t('حذف','Delete')}</button></td></tr>
                  ))}
                </tbody>
              </table>
              {!depsData?.items.length && <p className="tx3 text-[11px] mt-2">{t('وابستگی ثبت نشده','No dependencies')}</p>}
            </div>
          </Section>
        </div>
      )}

      {tab === 'comments' && (
        <div className="grid gap-3">
          <Section title={t('ثبت نظر (Comment)','Create comment')} note={t('CommentNo خودکار — ReviewCode C1..C4 — Status open→replied→concluded','Auto CommentNo — ReviewCode C1..C4 — open→replied→concluded')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={commentForm.documentId} onChange={e=>setCommentForm({...commentForm, documentId:e.target.value})}>
                <option value="">{t('انتخاب مدرک','Select doc')}</option>
                {(docsData?.items ?? []).map(d=><option key={d.Id} value={d.Id}>{d.DocNo} Rev {d.Revision}</option>)}
              </select>
              <input className={inputCls} placeholder={t('متن نظر','Comment text')} value={commentForm.commentText} onChange={e=>setCommentForm({...commentForm, commentText:e.target.value})} />
              <select className={inputCls} value={commentForm.reviewCode} onChange={e=>setCommentForm({...commentForm, reviewCode:e.target.value})}>
                <option value="">{t('بدون ReviewCode','No code')}</option>
                <option value="C1">C1 — Rejected</option><option value="C2">C2 — Major</option><option value="C3">C3 — Minor</option><option value="C4">C4 — Approved</option>
              </select>
              <button className={btnPrimary} disabled={busy || !commentForm.documentId || !commentForm.commentText} onClick={()=>void act(async ()=>{
                if(!client) return {ok:false, message:'No client'};
                const r=await client.createComment({documentId:commentForm.documentId, commentText:commentForm.commentText, reviewCode:commentForm.reviewCode||undefined});
                if(r.ok) setCommentForm(f=>({...f, commentText:''}));
                return r.ok ? {ok:true} : {ok:false, message:r.message};
              }, t('نظر ثبت شد','Comment created'))}>{t('ثبت نظر','Create comment')}</button>
            </div>
          </Section>

          <Section title={t('فهرست نظرات مدرک انتخاب‌شده + برگه Conclusion','Comments of selected doc + Conclusion sheet')}>
            {commentsData?.summary && <div className="grid grid-cols-4 gap-2 mb-2"><Kpi label={t('باز','Open')} value={String(commentsData.summary.open)} /><Kpi label={t('پاسخ‌داده','Replied')} value={String(commentsData.summary.replied)} /><Kpi label={t('جمع‌بندی','Concluded')} value={String(commentsData.summary.concluded)} /><Kpi label={t('کل','Total')} value={String(commentsData.summary.total)} /></div>}
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">#</th><th className="p-1">DocNo</th><th className="p-1">Rev</th><th className="p-1">{t('نظر','Comment')}</th><th className="p-1">Code</th><th className="p-1">Status</th><th className="p-1">{t('پاسخ','Reply')}</th><th className="p-1">{t('Conclusion','Conclusion')}</th><th className="p-1">{t('اقدام','Action')}</th></tr></thead>
                <tbody>
                  {(commentsData?.items ?? []).map(c=>(
                    <tr key={c.Id} className="border-t b-line-soft">
                      <td className="p-1" dir="ltr">{c.CommentNo}</td><td className="p-1" dir="ltr">{c.DocNo}</td><td className="p-1" dir="ltr">{c.Revision}</td>
                      <td className="p-1 max-w-[200px] truncate" title={c.CommentText}>{c.CommentText}</td><td className="p-1">{c.ReviewCode ?? '—'}</td><td className="p-1">{c.Status}</td>
                      <td className="p-1 max-w-[150px] truncate" title={c.ReplyText ?? ''}>{c.ReplyText ?? '—'}</td><td className="p-1 max-w-[150px] truncate" title={c.ConclusionText ?? ''}>{c.ConclusionText ?? '—'}</td>
                      <td className="p-1 flex gap-1 flex-wrap">
                        {c.Status==='open' && <button className={btnOk} onClick={()=>setReplyForm({commentId:c.Id, replyText:''})}>{t('پاسخ','Reply')}</button>}
                        {c.Status==='replied' && <button className={btnOk} onClick={()=>setConcludeForm({commentId:c.Id, conclusionText:'', reviewCode:c.ReviewCode ?? ''})}>{t('Conclusion','Conclude')}</button>}
                        {c.Status!=='void' && c.Status!=='concluded' && <button className={btnGhost} disabled={busy} onClick={()=>void act(async ()=>{
                          if(!client) return {ok:false, message:'No client'};
                          const r=await client.voidComment(c.Id);
                          return r.ok ? {ok:true} : {ok:false, message:r.message};
                        }, t('باطل شد','Voided'))}>{t('باطل','Void')}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!commentsData?.items.length && <p className="tx3 text-[11px] mt-2">{t('نظری ثبت نشده','No comments')}</p>}
            </div>
          </Section>

          <Section title={t('ثبت پاسخ (Reply)','Reply')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={replyForm.commentId} onChange={e=>setReplyForm({...replyForm, commentId:e.target.value})}>
                <option value="">{t('انتخاب Comment','Select comment')}</option>
                {(commentsData?.items ?? []).filter(c=>c.Status==='open').map(c=><option key={c.Id} value={c.Id}>#{c.CommentNo} — {c.CommentText.slice(0,40)}</option>)}
              </select>
              <input className={inputCls} placeholder={t('متن پاسخ','Reply text')} value={replyForm.replyText} onChange={e=>setReplyForm({...replyForm, replyText:e.target.value})} />
              <button className={btnPrimary} disabled={busy || !replyForm.commentId || !replyForm.replyText} onClick={()=>void act(async ()=>{
                if(!client) return {ok:false, message:'No client'};
                const r=await client.replyComment(replyForm.commentId, replyForm.replyText);
                if(r.ok) setReplyForm({commentId:'', replyText:''});
                return r.ok ? {ok:true} : {ok:false, message:r.message};
              }, t('پاسخ ثبت شد','Reply saved'))}>{t('ثبت پاسخ','Save reply')}</button>
            </div>
          </Section>

          <Section title={t('ثبت Conclusion — نیاز مجوز approve','Conclude — requires approve permission')} note={t('فقط replied → concluded','Only replied → concluded')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={concludeForm.commentId} onChange={e=>setConcludeForm({...concludeForm, commentId:e.target.value})}>
                <option value="">{t('انتخاب Comment','Select comment')}</option>
                {(commentsData?.items ?? []).filter(c=>c.Status==='replied').map(c=><option key={c.Id} value={c.Id}>#{c.CommentNo} — {c.CommentText.slice(0,40)}</option>)}
              </select>
              <input className={inputCls} placeholder={t('متن Conclusion','Conclusion text')} value={concludeForm.conclusionText} onChange={e=>setConcludeForm({...concludeForm, conclusionText:e.target.value})} />
              <select className={inputCls} value={concludeForm.reviewCode} onChange={e=>setConcludeForm({...concludeForm, reviewCode:e.target.value})}>
                <option value="">{t('بدون تغییر Code','Keep code')}</option>
                <option value="C1">C1</option><option value="C2">C2</option><option value="C3">C3</option><option value="C4">C4</option>
              </select>
              <button className={btnPrimary} disabled={busy || !concludeForm.commentId || !concludeForm.conclusionText} onClick={()=>void act(async ()=>{
                if(!client) return {ok:false, message:'No client'};
                const r=await client.concludeComment(concludeForm.commentId, {conclusionText:concludeForm.conclusionText, reviewCode:concludeForm.reviewCode||undefined});
                if(r.ok) setConcludeForm({commentId:'', conclusionText:'', reviewCode:''});
                return r.ok ? {ok:true} : {ok:false, message:r.message};
              }, t('Conclusion ثبت شد','Concluded'))}>{t('ثبت Conclusion','Conclude')}</button>
            </div>
          </Section>
        </div>
      )}

      {tab === 'dci' && (
        <div className="grid gap-3">
          <Section title={t('فهرست کنترل مدارک (DCI)','Document Control Index (DCI)')} note={t('تجمیع فایل، Hold، پیش‌نیاز، نظر و آمادگی صدور','Aggregated file, Hold, prereq, comments, readiness')}>
            {dciData?.summary && <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-2"><Kpi label={t('کل','Total')} value={String(dciData.summary.total)} /><Kpi label={t('قابل صدور','Can Issue')} value={String(dciData.summary.canIssue)} /><Kpi label={t('مسدود','Blocked')} value={String(dciData.summary.blocked)} /><Kpi label={t('با فایل','With File')} value={String(dciData.summary.withFile)} /><Kpi label={t('Hold باز','Open Holds')} value={String(dciData.summary.openHolds)} /><Kpi label={t('نظر باز','Open Comments')} value={String(dciData.summary.openComments)} /></div>}
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">DocNo</th><th className="p-1">Rev</th><th className="p-1">Status</th><th className="p-1">Disc</th><th className="p-1">File</th><th className="p-1">Holds</th><th className="p-1">Deps</th><th className="p-1">Mand Block</th><th className="p-1">CanIssue</th><th className="p-1">Comments</th><th className="p-1">Dist</th><th className="p-1">Effort h</th></tr></thead>
                <tbody>
                  {(dciData?.items ?? []).map(d=>(
                    <tr key={d.Id} className="border-t b-line-soft"><td className="p-1" dir="ltr">{d.DocNo}</td><td className="p-1" dir="ltr">{d.Revision}</td><td className="p-1">{d.Status}</td><td className="p-1">{d.Discipline ?? '—'}</td><td className="p-1">{d.fileCount}</td><td className="p-1">{d.openHolds}</td><td className="p-1">{d.totalDeps} ({d.mandatoryDeps} mand)</td><td className="p-1">{d.mandatoryNotApproved}</td><td className="p-1">{d.canIssue?'✓':'✗'}</td><td className="p-1">{d.comments.open}/{d.comments.total}</td><td className="p-1">{d.distCount}</td><td className="p-1">{d.effortHours}</td></tr>
                  ))}
                </tbody>
              </table>
              {!dciData?.items.length && <p className="tx3 text-[11px] mt-2">{t('مدرکی نیست','No docs')}</p>}
            </div>
            <button className={btnGhost} onClick={()=>void loadDci()}>{t('تازه‌سازی DCI','Refresh DCI')}</button>
          </Section>

          <Section title={t('ثبت توزیع مدرک','Distribute document')} note={t('Party: client/consultant/contractor/subcontractor/vendor — نیاز مجوز transmittal.issue','Party needs transmittal.issue permission')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={distForm.documentId} onChange={e=>setDistForm({...distForm, documentId:e.target.value})}>
                <option value="">{t('انتخاب مدرک','Select doc')}</option>
                {(docsData?.items ?? []).map(d=><option key={d.Id} value={d.Id}>{d.DocNo} Rev {d.Revision}</option>)}
              </select>
              <select className={inputCls} value={distForm.party} onChange={e=>setDistForm({...distForm, party:e.target.value})}>
                {['client','consultant','contractor','subcontractor','vendor','other'].map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              <input className={inputCls} placeholder={t('شماره ترنسمیتال','Transmittal No')} value={distForm.transmittalNo} onChange={e=>setDistForm({...distForm, transmittalNo:e.target.value})} />
              <input className={inputCls} placeholder={t('یادداشت','Note')} value={distForm.noteFa} onChange={e=>setDistForm({...distForm, noteFa:e.target.value})} />
              <button className={btnPrimary} disabled={busy || !distForm.documentId || !distForm.party} onClick={()=>void act(async ()=>{
                if(!client) return {ok:false, message:'No client'};
                const r=await client.distribute(distForm.documentId, {party:distForm.party, transmittalNo:distForm.transmittalNo||undefined, noteFa:distForm.noteFa||undefined});
                return r.ok ? {ok:true} : {ok:false, message:r.message};
              }, t('توزیع ثبت شد','Distributed'))}>{t('ثبت توزیع','Distribute')}</button>
            </div>
          </Section>

          <Section title={t('تاریخچه توزیع','Distribution history')}>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">DocNo</th><th className="p-1">Rev</th><th className="p-1">Party</th><th className="p-1">Transmittal</th><th className="p-1">At</th><th className="p-1">By</th><th className="p-1">Note</th></tr></thead>
                <tbody>
                  {(distData?.items ?? []).map(x=>(
                    <tr key={x.Id} className="border-t b-line-soft"><td className="p-1" dir="ltr">{x.DocNo}</td><td className="p-1" dir="ltr">{x.Revision}</td><td className="p-1">{x.Party}</td><td className="p-1" dir="ltr">{x.TransmittalNo ?? '—'}</td><td className="p-1" dir="ltr">{(x.DistributedAt||'').slice(0,16)}</td><td className="p-1" dir="ltr">{x.DistributedBy.slice(0,12)}</td><td className="p-1">{x.NoteFa ?? '—'}</td></tr>
                  ))}
                </tbody>
              </table>
              {!distData?.items.length && <p className="tx3 text-[11px] mt-2">{t('توزیعی ثبت نشده','No distributions')}</p>}
            </div>
            <button className={btnGhost} onClick={()=>void loadDist()}>{t('تازه‌سازی','Refresh')}</button>
          </Section>
        </div>
      )}

      {tab === 'templates' && (
        <div className="grid gap-3">
          <Section title={t('ایجاد قالب پروژه','Create project template')} note={t('نوع: doc/transmittal/checksheet/letter','Type: doc/transmittal/checksheet/letter')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={tplForm.templateType} onChange={e=>setTplForm({...tplForm, templateType:e.target.value})}>
                {['doc','transmittal','checksheet','letter','other'].map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              <input className={inputCls} placeholder={t('نام قالب','Template name')} value={tplForm.nameFa} onChange={e=>setTplForm({...tplForm, nameFa:e.target.value})} />
              <input className={inputCls} placeholder={t('کد قالب','Code')} value={tplForm.code} onChange={e=>setTplForm({...tplForm, code:e.target.value})} />
              <input className={inputCls} placeholder={t('یادداشت','Note')} value={tplForm.noteFa} onChange={e=>setTplForm({...tplForm, noteFa:e.target.value})} />
              <button className={btnPrimary} disabled={busy || !tplForm.nameFa || !tplForm.templateType} onClick={()=>void act(async ()=>{
                if(!client) return {ok:false, message:'No client'};
                const r=await client.createTemplate({templateType:tplForm.templateType, nameFa:tplForm.nameFa, code:tplForm.code||undefined, noteFa:tplForm.noteFa||undefined, contentJson:{fields:['DocNo','TitleFa','Revision']}});
                if(r.ok) setTplForm(f=>({...f, nameFa:'', code:''}));
                return r.ok ? {ok:true} : {ok:false, message:r.message};
              }, t('قالب ثبت شد','Template created'))}>{t('ثبت قالب','Create template')}</button>
            </div>
          </Section>
          <Section title={t('فهرست قالب‌ها','Template list')}>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">Type</th><th className="p-1">NameFa</th><th className="p-1">Code</th><th className="p-1">CreatedBy</th><th className="p-1">At</th><th className="p-1">{t('حذف','Delete')}</th></tr></thead>
                <tbody>
                  {(tplData?.items ?? []).map(x=>(
                    <tr key={x.Id} className="border-t b-line-soft"><td className="p-1">{x.TemplateType}</td><td className="p-1">{x.NameFa}</td><td className="p-1" dir="ltr">{x.Code ?? '—'}</td><td className="p-1" dir="ltr">{x.CreatedBy.slice(0,12)}</td><td className="p-1" dir="ltr">{(x.CreatedAt||'').slice(0,16)}</td><td className="p-1"><button className={btnGhost} disabled={busy} onClick={()=>void act(async ()=>{
                      if(!client) return {ok:false, message:'No client'};
                      const r=await client.deleteTemplate(x.Id);
                      return r.ok ? {ok:true} : {ok:false, message:r.message};
                    }, t('حذف شد','Deleted'))}>{t('حذف','Delete')}</button></td></tr>
                  ))}
                </tbody>
              </table>
              {!tplData?.items.length && <p className="tx3 text-[11px] mt-2">{t('قالبی ثبت نشده','No templates')}</p>}
            </div>
          </Section>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="grid gap-3">
          <Section title={t('اعلان‌های ایمیلی EDMS','EDMS email notifications')} note={t('خودکار: hold_created, comment_created, distributed — موتور SMTP موجود، در صورت عدم تنظیم شبیه‌سازی می‌شود','Auto: hold_created, comment_created, distributed — SMTP engine existing, simulated if not configured')}>
            {notifData?.summary && <div className="grid grid-cols-3 gap-2 mb-2"><Kpi label={t('در انتظار','Pending')} value={String(notifData.summary.pending)} /><Kpi label={t('ارسال‌شده','Sent')} value={String(notifData.summary.sent)} /><Kpi label={t('کل','Total')} value={String(notifData.summary.total)} /></div>}
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">DocNo</th><th className="p-1">Event</th><th className="p-1">Party</th><th className="p-1">Subject</th><th className="p-1">Channel</th><th className="p-1">Status</th><th className="p-1">At</th><th className="p-1">{t('ارسال','Send')}</th></tr></thead>
                <tbody>
                  {(notifData?.items ?? []).map(n=>(
                    <tr key={n.Id} className="border-t b-line-soft"><td className="p-1" dir="ltr">{n.DocNo}</td><td className="p-1">{n.EventType}</td><td className="p-1">{n.RecipientParty}</td><td className="p-1 max-w-[200px] truncate" title={n.SubjectFa}>{n.SubjectFa}</td><td className="p-1">{n.Channel}</td><td className="p-1">{n.Status}</td><td className="p-1" dir="ltr">{(n.CreatedAt||'').slice(0,16)}</td><td className="p-1">{n.Status==='pending' && <button className={btnOk} disabled={busy} onClick={()=>void act(async ()=>{
                      if(!client) return {ok:false, message:'No client'};
                      const r=await client.sendNotification(n.Id);
                      return r.ok ? {ok:true} : {ok:false, message:r.message};
                    }, t('ارسال شد','Sent'))}>{t('ارسال','Send')}</button>}</td></tr>
                  ))}
                </tbody>
              </table>
              {!notifData?.items.length && <p className="tx3 text-[11px] mt-2">{t('اعلانی نیست','No notifications')}</p>}
            </div>
            <button className={btnGhost} onClick={()=>void loadNotif()}>{t('تازه‌سازی','Refresh')}</button>
          </Section>
        </div>
      )}

      {tab === 'effort' && (
        <div className="grid gap-3">
          <Section title={t('ثبت نفرساعت واقعی مدرک','Log document effort')} note={t('اتصال به تایم‌شیت — از HRM یا ثبت دستی — ساعت واقعی هر مدرک','Linked to timesheet — from HRM or manual — real hours per doc')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={effortForm.documentId} onChange={e=>setEffortForm({...effortForm, documentId:e.target.value})}>
                <option value="">{t('انتخاب مدرک','Select doc')}</option>
                {(docsData?.items ?? []).map(d=><option key={d.Id} value={d.Id}>{d.DocNo} Rev {d.Revision}</option>)}
              </select>
              <input className={inputCls} type="date" value={effortForm.workDate} onChange={e=>setEffortForm({...effortForm, workDate:e.target.value})} />
              <input className={inputCls} type="number" step="0.5" placeholder={t('ساعت','Hours')} value={effortForm.hours} onChange={e=>setEffortForm({...effortForm, hours:e.target.value})} />
              <input className={inputCls} placeholder={t('نام شخص','Person name')} value={effortForm.personName} onChange={e=>setEffortForm({...effortForm, personName:e.target.value})} />
              <select className={inputCls} value={effortForm.activity} onChange={e=>setEffortForm({...effortForm, activity:e.target.value})}>
                {['design','review','check','approval','other'].map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              <input className={inputCls} type="number" step="0.01" placeholder={t('هزینه (اختیاری)','Cost opt')} value={effortForm.cost} onChange={e=>setEffortForm({...effortForm, cost:e.target.value})} />
              <input className={inputCls} placeholder={t('یادداشت','Note')} value={effortForm.noteFa} onChange={e=>setEffortForm({...effortForm, noteFa:e.target.value})} />
              <button className={btnPrimary} disabled={busy || !effortForm.documentId || !effortForm.workDate || !effortForm.hours} onClick={()=>void act(async ()=>{
                if(!client) return {ok:false, message:'No client'};
                const r=await client.createEffort(effortForm.documentId, {workDate:effortForm.workDate, hours:Number(effortForm.hours), personName:effortForm.personName||undefined, activity:effortForm.activity||undefined, cost:effortForm.cost?Number(effortForm.cost):undefined, noteFa:effortForm.noteFa||undefined});
                return r.ok ? {ok:true} : {ok:false, message:r.message};
              }, t('نفرساعت ثبت شد','Effort logged'))}>{t('ثبت نفرساعت','Log effort')}</button>
            </div>
          </Section>
          <Section title={t('خلاصه نفرساعت مدرک انتخاب‌شده','Effort summary of selected doc')}>
            {effortData?.summary && <div className="grid grid-cols-3 gap-2 mb-2"><Kpi label={t('کل ساعت','Total Hours')} value={String(effortData.summary.totalHours)} /><Kpi label={t('کل هزینه','Total Cost')} value={String(effortData.summary.totalCost)} /><Kpi label={t('تعداد رکورد','Records')} value={String(effortData.count)} /></div>}
            {effortData?.summary?.byPerson && <div className="text-[11px] tx2 mb-2">{Object.entries(effortData.summary.byPerson).map(([k,v])=><span key={k} className="me-3">{k}: {v}h</span>)}</div>}
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">DocNo</th><th className="p-1">Date</th><th className="p-1">Person</th><th className="p-1">Hours</th><th className="p-1">Activity</th><th className="p-1">Cost</th><th className="p-1">Note</th><th className="p-1">{t('حذف','Delete')}</th></tr></thead>
                <tbody>
                  {(effortData?.items ?? []).map(e=>(
                    <tr key={e.Id} className="border-t b-line-soft"><td className="p-1" dir="ltr">{e.DocNo}</td><td className="p-1" dir="ltr">{e.WorkDate}</td><td className="p-1">{e.PersonName ?? e.PersonId ?? '—'}</td><td className="p-1">{e.Hours}</td><td className="p-1">{e.Activity ?? '—'}</td><td className="p-1">{e.Cost ?? '—'}</td><td className="p-1">{e.NoteFa ?? '—'}</td><td className="p-1"><button className={btnGhost} disabled={busy} onClick={()=>void act(async ()=>{
                      if(!client) return {ok:false, message:'No client'};
                      const r=await client.deleteEffort(e.Id);
                      return r.ok ? {ok:true} : {ok:false, message:r.message};
                    }, t('حذف شد','Deleted'))}>{t('حذف','Delete')}</button></td></tr>
                  ))}
                </tbody>
              </table>
              {!effortData?.items.length && <p className="tx3 text-[11px] mt-2">{t('نفرساعتی ثبت نشده','No effort')}</p>}
            </div>
          </Section>
        </div>
      )}

      {['workflow','excel','numbering','correspondence','transmittal','lessons'].includes(tab) && (
        <Section title={t('این تب در مراحل بعدی P3 تکمیل می‌شود','This tab in next P3 steps')}>
          <p className="tx3 text-[11px]">{t('باقی: EDM-4..9','Remaining: EDM-4..9')}</p>
        </Section>
      )}
    </div>
  );
}
