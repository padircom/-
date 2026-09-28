/**
 * EDM-1 + EDM-2 — میز کار زنده اسناد و مدارک (d1) با اتصال فایل به نسخه و Hold.
 * هیچ دادهٔ نمونه ندارد؛ همه از /api/edms/:projectId/... می‌آید.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import { useSystem } from '../context/SystemContext';
import { EdmsClient, type EdmsDocumentList, type EdmsFileList, type EdmsHoldList } from '../services/edmsWorkspace';
import { createRow, listRows } from '../services/edmsApi';

export type EdmsTab = 'overview' | 'mdr' | 'revision' | 'files' | 'holds' | 'workflow' | 'excel' | 'numbering' | 'correspondence' | 'transmittal' | 'lessons';

const TABS: { id: EdmsTab; fa: string; en: string }[] = [
  { id: 'overview', fa: 'نمای کلی', en: 'Overview' },
  { id: 'mdr', fa: 'MDR', en: 'MDR' },
  { id: 'revision', fa: 'نسخه‌ها', en: 'Revisions' },
  { id: 'files', fa: 'پیوست فایل', en: 'Files' },
  { id: 'holds', fa: 'Hold Items', en: 'Holds' },
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
  const [selDocId, setSelDocId] = useState<string>('');
  const [selDocNo, setSelDocNo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const gen = useRef(0);

  // create doc form
  const [docForm, setDocForm] = useState({ docNo: '', titleFa: '', revision: 'A', discipline: 'Civil', status: 'draft', reviewCode: '—', slaHours: '0' });
  const [fileNote, setFileNote] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  // hold form
  const [holdForm, setHoldForm] = useState({ documentId: '', titleFa: '', holdType: 'other', dueAt: '', noteFa: '' });
  const [holdFilter, setHoldFilter] = useState({ status: '', holdType: '' });

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
    if (r.ok) setFilesData(r.data);
    else setFilesData(null);
  }, [client]);

  const loadHolds = useCallback(async () => {
    if (!client) return;
    const r = await client.holds({ status: holdFilter.status || undefined, holdType: holdFilter.holdType || undefined });
    if (r.ok) setHoldsData(r.data);
  }, [client, holdFilter]);

  useEffect(() => { void loadDocs(); return () => { gen.current++; }; }, [loadDocs]);
  useEffect(() => { if (selDocId) void loadFiles(selDocId); }, [selDocId, loadFiles]);
  useEffect(() => { void loadHolds(); }, [loadHolds]);

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
      if (selDocId) await loadFiles(selDocId);
      await loadHolds();
      return true;
    }
    setMsg({ tone: 'err', text: (r as any).message ?? t('خطا', 'Error') });
    return false;
  };

  if (!projectId) {
    return <div className="tx3 text-[11px] p-3">{t('پروژه انتخاب نشده است', 'No project selected')}</div>;
  }

  return (
    <div dir={fa ? 'rtl' : 'ltr'} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
      <header className="glass-dark rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h3 className="tx1 font-semibold text-[13px]">{t('اسناد و مدارک — فایل به نسخه + Hold (EDM-1/2)', 'EDMS — file to revision + Holds')}</h3>
          <p className="text-[10px] tx3" dir="ltr">{projectId} · {kpis.total} docs · {kpis.versions} versions · {kpis.withFile} with file · {holdsData?.summary.open ?? 0} open holds</p>
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
          <Section title={t('KPI اسناد و Hold', 'Docs & Hold KPI')} note={t('بدون نمونه — فقط دادهٔ واقعی', 'No sample — live only')}>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              <Kpi label={t('کل مدارک', 'Total docs')} value={String(kpis.total)} />
              <Kpi label={t('تأییدشده', 'Approved')} value={String(kpis.approved)} />
              <Kpi label={t('دارای فایل', 'With file')} value={String(kpis.withFile)} />
              <Kpi label={t('Hold باز', 'Open holds')} value={String(holdsData?.summary.open ?? 0)} />
              <Kpi label={t('Hold معوق', 'Overdue holds')} value={String(holdsData?.summary.overdue ?? 0)} />
            </div>
          </Section>
          <Section title={t('نسخه‌ها به تفکیک DocNo', 'Versions by DocNo')}>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1 text-start">DocNo</th><th className="p-1">Versions</th><th className="p-1">Revisions</th></tr></thead>
                <tbody>
                  {Object.entries(docsData?.byDocNo ?? {}).slice(0, 50).map(([docNo, vers]) => (
                    <tr key={docNo} className="border-t b-line-soft"><td className="p-1" dir="ltr">{docNo}</td><td className="p-1">{vers.length}</td><td className="p-1" dir="ltr">{vers.map(v => v.revision).join(', ')}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {tab === 'mdr' && (
        <div className="grid gap-3">
          <Section title={t('ایجاد مدرک جدید', 'Create document')} note={t('DocNo + Revision یکتا', 'DocNo+Revision unique')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input className={inputCls} placeholder="DocNo" value={docForm.docNo} onChange={e => setDocForm({ ...docForm, docNo: e.target.value })} />
              <input className={inputCls} placeholder={t('عنوان فارسی', 'Title Fa')} value={docForm.titleFa} onChange={e => setDocForm({ ...docForm, titleFa: e.target.value })} />
              <input className={inputCls} placeholder="Revision" value={docForm.revision} onChange={e => setDocForm({ ...docForm, revision: e.target.value })} />
              <input className={inputCls} placeholder="Discipline" value={docForm.discipline} onChange={e => setDocForm({ ...docForm, discipline: e.target.value })} />
              <select className={inputCls} value={docForm.status} onChange={e => setDocForm({ ...docForm, status: e.target.value })}>
                {['draft', 'under_review', 'approved', 'rejected'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input className={inputCls} placeholder="ReviewCode" value={docForm.reviewCode} onChange={e => setDocForm({ ...docForm, reviewCode: e.target.value })} />
            </div>
            <button className={btnPrimary} disabled={busy || !docForm.docNo || !docForm.titleFa} onClick={() => void act(async () => {
              const res = await listRows('Document', projectId);
              if (res?.items?.some((r: any) => r.DocNo === docForm.docNo && r.Revision === docForm.revision)) {
                return { ok: false, message: t('تکراری است', 'Duplicate') };
              }
              const row = {
                ProjectId: projectId,
                DocNo: docForm.docNo.trim(),
                TitleFa: docForm.titleFa.trim(),
                TitleEn: docForm.titleFa.trim(),
                Revision: docForm.revision.trim(),
                Discipline: docForm.discipline.trim(),
                Status: docForm.status,
                ReviewCode: docForm.reviewCode.trim(),
                SlaHours: Number(docForm.slaHours) || 0,
                IssuedAt: new Date().toISOString().slice(0, 10),
              };
              const created = await createRow('Document', row);
              return created ? { ok: true } : { ok: false, message: t('ثبت ناموفق', 'Create failed') };
            }, t('مدرک ایجاد شد', 'Document created'))}>{t('ثبت مدرک', 'Create')}</button>
          </Section>

          <Section title={t('MDR — فهرست مدارک', 'MDR — documents')}>
            <div className="flex gap-2 mb-2">
              <input className={inputCls} style={{ maxWidth: '300px' }} placeholder={t('جستجو DocNo/Title', 'Search')} value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1 text-start">DocNo</th><th className="p-1 text-start">{t('عنوان', 'Title')}</th><th className="p-1">Rev</th><th className="p-1">Status</th><th className="p-1">Disc</th><th className="p-1">{t('فایل', 'File')}</th><th className="p-1">{t('نسخه‌ها', 'Vers')}</th><th className="p-1">{t('اقدام', 'Action')}</th></tr></thead>
                <tbody>
                  {filtered.map(d => (
                    <tr key={d.Id} className={`border-t b-line-soft ${selDocId === d.Id ? 'bg-white/5' : ''}`}>
                      <td className="p-1" dir="ltr">{d.DocNo}</td>
                      <td className="p-1">{d.TitleFa}</td>
                      <td className="p-1" dir="ltr">{d.Revision}</td>
                      <td className="p-1">{d.Status}</td>
                      <td className="p-1">{d.Discipline ?? '—'}</td>
                      <td className="p-1">{d.hasFile ? '✓' : '—'}</td>
                      <td className="p-1">{d.versions}</td>
                      <td className="p-1 flex gap-1"><button className={btnGhost} onClick={() => { setSelDocId(d.Id); setSelDocNo(d.DocNo); setTab('files'); }}>{t('فایل‌ها', 'Files')}</button><button className={btnGhost} onClick={() => { setSelDocId(d.Id); setHoldForm(f=>({...f,documentId:d.Id})); setTab('holds'); }}>{t('Hold', 'Hold')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && <p className="tx3 text-[11px] mt-2">{t('مدرکی نیست', 'No docs')}</p>}
            </div>
          </Section>
        </div>
      )}

      {tab === 'revision' && (
        <Section title={t('تاریخچه نسخه‌ها', 'Version history')}>
          <div className="grid gap-2">
            <select className={inputCls} value={selDocNo} onChange={e => setSelDocNo(e.target.value)}>
              <option value="">{t('انتخاب DocNo', 'Select DocNo')}</option>
              {Object.keys(docsData?.byDocNo ?? {}).map(dn => <option key={dn} value={dn}>{dn}</option>)}
            </select>
            {selDocNo && docsData?.byDocNo[selDocNo] && (
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">Revision</th><th className="p-1">Status</th><th className="p-1">IssuedAt</th><th className="p-1">FilePath</th><th className="p-1">Id</th></tr></thead>
                <tbody>
                  {docsData.byDocNo[selDocNo].map(v => (
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
          <Section title={t('انتخاب مدرک', 'Select document')}>
            <select className={inputCls} value={selDocId} onChange={e => { setSelDocId(e.target.value); const doc = docsData?.items.find(x => x.Id === e.target.value); if (doc) setSelDocNo(doc.DocNo); }}>
              <option value="">{t('انتخاب مدرک', 'Select doc')}</option>
              {(docsData?.items ?? []).map(d => <option key={d.Id} value={d.Id}>{d.DocNo} Rev {d.Revision} — {d.TitleFa}</option>)}
            </select>
          </Section>

          <Section title={t('آپلود فایل به نسخه', 'Upload file to revision')} note={t('اتصال فایل به نسخه — FilePath در Document هم به‌روز می‌شود', 'File to revision link')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input type="file" className={inputCls} onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
              <input className={inputCls} placeholder={t('یادداشت (اختیاری)', 'Note optional')} value={fileNote} onChange={e => setFileNote(e.target.value)} />
              <button className={btnPrimary} disabled={busy || !uploadFile || !selDocId} onClick={() => void act(async () => {
                if (!client || !uploadFile || !selDocId) return { ok: false, message: 'No file' };
                const r = await client.uploadFile(selDocId, uploadFile, fileNote || undefined);
                if (r.ok) { setUploadFile(null); setFileNote(''); return { ok: true }; }
                return { ok: false, message: r.message };
              }, t('فایل آپلود شد', 'File uploaded'))}>{t('آپلود', 'Upload')}</button>
            </div>
          </Section>

          <Section title={t('پیوست‌های این نسخه', 'Attachments')}>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">{t('FileName', 'نام فایل')}</th><th className="p-1">Mime</th><th className="p-1">Size</th><th className="p-1">UploadedAt</th><th className="p-1">By</th><th className="p-1">{t('دانلود', 'Download')}</th><th className="p-1">{t('حذف', 'Delete')}</th></tr></thead>
                <tbody>
                  {(filesData?.items ?? []).map(f => (
                    <tr key={f.Id} className="border-t b-line-soft"><td className="p-1" dir="ltr">{f.FileName}</td><td className="p-1">{f.MimeType}</td><td className="p-1">{(f.SizeBytes/1024).toFixed(1)} KB</td><td className="p-1" dir="ltr">{new Date(f.UploadedAt).toLocaleString(fa?'fa-IR':'en-US')}</td><td className="p-1" dir="ltr">{f.UploadedBy.slice(0,8)}</td><td className="p-1"><a className={btnGhost} href={f.downloadUrl} target="_blank" rel="noreferrer">{t('دانلود', 'Download')}</a></td><td className="p-1"><button className={btnGhost} disabled={busy} onClick={() => void act(async () => {
                    if (!client) return { ok: false, message: 'No client' };
                    const r = await client.deleteFile(f.Id);
                    return r.ok ? { ok: true } : { ok: false, message: r.message };
                  }, t('حذف شد', 'Deleted'))}>{t('حذف', 'Delete')}</button></td></tr>
                  ))}
                </tbody>
              </table>
              {!filesData?.items.length && <p className="tx3 text-[11px] mt-2">{t('پیوستی نیست', 'No attachments')}</p>}
            </div>
          </Section>
        </div>
      )}

      {tab === 'holds' && (
        <div className="grid gap-3">
          <Section title={t('ایجاد Hold برای مدرک', 'Create Hold for document')} note={t('HoldNo خودکار — DueAt تاریخ رفع مورد انتظار', 'HoldNo auto — DueAt expected release')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={holdForm.documentId} onChange={e => setHoldForm({ ...holdForm, documentId: e.target.value })}>
                <option value="">{t('انتخاب مدرک', 'Select doc')}</option>
                {(docsData?.items ?? []).map(d => <option key={d.Id} value={d.Id}>{d.DocNo} Rev {d.Revision}</option>)}
              </select>
              <input className={inputCls} placeholder={t('دلیل Hold', 'Hold reason')} value={holdForm.titleFa} onChange={e => setHoldForm({ ...holdForm, titleFa: e.target.value })} />
              <select className={inputCls} value={holdForm.holdType} onChange={e => setHoldForm({ ...holdForm, holdType: e.target.value })}>
                {['vendor','client','engineering','procurement','other'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <input className={inputCls} type="date" value={holdForm.dueAt} onChange={e => setHoldForm({ ...holdForm, dueAt: e.target.value })} />
              <input className={inputCls} placeholder={t('یادداشت', 'Note')} value={holdForm.noteFa} onChange={e => setHoldForm({ ...holdForm, noteFa: e.target.value })} />
              <button className={btnPrimary} disabled={busy || !holdForm.documentId || !holdForm.titleFa} onClick={() => void act(async () => {
                if (!client) return { ok: false, message: 'No client' };
                const r = await client.createHold({ documentId: holdForm.documentId, titleFa: holdForm.titleFa, holdType: holdForm.holdType, dueAt: holdForm.dueAt || undefined, noteFa: holdForm.noteFa || undefined });
                return r.ok ? { ok: true } : { ok: false, message: r.message };
              }, t('Hold ثبت شد', 'Hold created'))}>{t('ثبت Hold', 'Create Hold')}</button>
            </div>
          </Section>

          <Section title={t('فیلتر Hold', 'Hold filter')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={inputCls} value={holdFilter.status} onChange={e => setHoldFilter({ ...holdFilter, status: e.target.value })}>
                <option value="">{t('همه وضعیت‌ها', 'All statuses')}</option>
                <option value="open">open</option>
                <option value="released">released</option>
                <option value="cancelled">cancelled</option>
              </select>
              <select className={inputCls} value={holdFilter.holdType} onChange={e => setHoldFilter({ ...holdFilter, holdType: e.target.value })}>
                <option value="">{t('همه نوع‌ها', 'All types')}</option>
                {['vendor','client','engineering','procurement','other'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <button className={btnGhost} onClick={() => void loadHolds()}>{t('اعمال', 'Apply')}</button>
            </div>
            {holdsData?.summary && <div className="grid grid-cols-3 gap-2 mt-2"><Kpi label={t('باز', 'Open')} value={String(holdsData.summary.open)} /><Kpi label={t('معوق', 'Overdue')} value={String(holdsData.summary.overdue)} /><Kpi label={t('آزادشده', 'Released')} value={String(holdsData.summary.released)} /></div>}
          </Section>

          <Section title={t('فهرست Hold Items', 'Hold Items list')}>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-[11px] tx2">
                <thead><tr><th className="p-1">HoldNo</th><th className="p-1">DocNo</th><th className="p-1">Rev</th><th className="p-1">{t('دلیل', 'Reason')}</th><th className="p-1">Type</th><th className="p-1">Status</th><th className="p-1">DueAt</th><th className="p-1">{t('اقدام', 'Action')}</th></tr></thead>
                <tbody>
                  {(holdsData?.items ?? []).map(h => (
                    <tr key={h.Id} className="border-t b-line-soft"><td className="p-1" dir="ltr">{h.HoldNo}</td><td className="p-1" dir="ltr">{h.DocNo}</td><td className="p-1" dir="ltr">{h.Revision}</td><td className="p-1">{h.TitleFa}</td><td className="p-1">{h.HoldType}</td><td className="p-1">{h.Status}</td><td className="p-1" dir="ltr">{h.DueAt ?? '—'}</td><td className="p-1 flex gap-1">{h.Status==='open' && <><button className={btnOk} disabled={busy} onClick={() => void act(async () => {
                      if (!client) return { ok: false, message: 'No client' };
                      const r = await client.releaseHold(h.Id);
                      return r.ok ? { ok: true } : { ok: false, message: r.message };
                    }, t('آزاد شد', 'Released'))}>{t('آزاد', 'Release')}</button><button className={btnGhost} disabled={busy} onClick={() => void act(async () => {
                      if (!client) return { ok: false, message: 'No client' };
                      const r = await client.cancelHold(h.Id);
                      return r.ok ? { ok: true } : { ok: false, message: r.message };
                    }, t('لغو شد', 'Cancelled'))}>{t('لغو', 'Cancel')}</button></>}</td></tr>
                  ))}
                </tbody>
              </table>
              {!holdsData?.items.length && <p className="tx3 text-[11px] mt-2">{t('Hold باز نیست', 'No open holds')}</p>}
            </div>
          </Section>
        </div>
      )}

      {['workflow','excel','numbering','correspondence','transmittal','lessons'].includes(tab) && (
        <Section title={t('این تب در مراحل بعدی P3 تکمیل می‌شود', 'This tab in next P3 steps')} note={t('تمرکز فعلی EDM-1/2', 'Current focus EDM-1/2')}>
          <p className="tx3 text-[11px]">{t('باقی: EDM-3..9', 'Remaining: EDM-3..9')}</p>
        </Section>
      )}
    </div>
  );
}
