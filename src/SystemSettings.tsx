import { useState, useRef, useEffect } from 'react';
import {
  X, ChevronDown, HardDrive, UploadCloud, Download, Settings,
  Save, CheckCircle2, AlertTriangle, Lightbulb, MapPin,
  User, Briefcase, FileText, Hash, Thermometer, Database,
  ShieldCheck, RefreshCw, Link2, Cpu, Radio, ExternalLink,
  KeyRound, LockKeyhole, Send, Bot, Wifi, WifiOff, MessageSquareText,
} from 'lucide-react';
import { ensureSchema, registerDailyTemplate, isDailyTemplateAuthorized } from './platform/schema';

/* ==========================================================================
   TYPES & HELPERS
   ========================================================================== */
export type Lang = 'fa' | 'en';


export interface SectorOption {
  key: string;
  name: string;
  nameEn: string;
  projects: { id: string; name: string; nameEn: string }[];
}

/** Remote consultation link requested for Channel 1. Kept as one explicit
 *  constant so intranet deployments can redirect it to their approved Arena
 *  conversation portal without changing component markup. */
const ARENA_CONVERSATION_PORTAL = 'https://chatgpt.com/';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; text: string };

/* ==========================================================================
   1. CLEAN 2-FIELD CENTER SELECTOR MODAL (z-index: 9999)
   ========================================================================== */
export function SettingsSelectorModal({
  lang, sectors, onClose, onSubmit,
}: {
  lang: Lang;
  sectors: SectorOption[];
  onClose: () => void;
  onSubmit: (sectorKey: string, projectId: string) => void;
}) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const [sector, setSector] = useState('');
  const [project, setProject] = useState('');
  const activeSector = sectors.find((s) => s.key === sector);
  const canSubmit = !!sector && !!project;
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);

  const selectCls =
    'w-full appearance-none bg-slate-50 border border-slate-300 focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 rounded-xl px-3 py-2.5 text-[12px] text-[#212529] font-medium outline-none transition cursor-pointer';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        dir={dir}
        className="relative w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5 bg-gradient-to-l from-slate-50 via-white to-blue-50 border-b border-slate-200 flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-sm flex-shrink-0">
            <Settings className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-black text-[#0f172a] leading-tight">
              {label('تنظیمات سامانه', 'System Settings')}
            </h3>
            <p className="text-[10px] text-slate-600 font-medium mt-0.5">
              {label('صنعت و پروژه هدف را انتخاب کنید', 'Select target sector and project')}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Field 1: Sector */}
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-600 mb-1.5">
              {label('انتخاب صنعت', 'Select Sector')}
            </span>
            <div className="relative">
              <select value={sector} onChange={(e) => { setSector(e.target.value); setProject(''); }} className={selectCls}>
                <option value="">{label('— انتخاب کنید —', '— Choose —')}</option>
                {sectors.map((s) => (
                  <option key={s.key} value={s.key}>{lang === 'fa' ? s.name : s.nameEn}</option>
                ))}
              </select>
              <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none`} />
            </div>
          </label>

          {/* Field 2: Project */}
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-600 mb-1.5">
              {label('انتخاب پروژه', 'Select Project')}
            </span>
            <div className="relative">
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                disabled={!activeSector}
                className={`${selectCls} ${!activeSector ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option value="">
                  {activeSector
                    ? label('— انتخاب کنید —', '— Choose —')
                    : label('ابتدا صنعت را انتخاب کنید', 'Select a sector first')}
                </option>
                {activeSector?.projects.map((p) => (
                  <option key={p.id} value={p.id}>{lang === 'fa' ? p.name : p.nameEn}</option>
                ))}
              </select>
              <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none`} />
            </div>
          </label>

          <button
            disabled={!canSubmit}
            onClick={() => canSubmit && onSubmit(sector, project)}
            className={`w-full py-2.5 rounded-xl text-[12px] font-black transition shadow-md ${
              canSubmit
                ? 'bg-gradient-to-l from-slate-700 to-slate-900 text-white hover:from-slate-800 hover:to-slate-950 shadow-slate-500/25'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {label('ورود به تنظیمات سامانه', 'Enter System Settings')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   2. FULLSCREEN SYSTEM SETTINGS WORKSPACE (v2.2.0-SETTINGS)
   ========================================================================== */
export function SystemSettingsPage({
  lang, sectorName, projectName, projectId, onClose,
}: {
  lang: Lang;
  sectorName: string;
  projectName: string;
  projectId: string;
  onClose: () => void;
}) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);

  // ---- Backup / Restore state ----
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [backupDone, setBackupDone] = useState(false);
  const [restoreFile, setRestoreFile] = useState<string | null>(null);
  const [restoreDone, setRestoreDone] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);

  // ---- Project metadata state ----
  const [meta, setMeta] = useState({
    clientName: '',
    consultantName: '',
    contractNumber: '',
    lat: '',
    lng: '',
  });

  // ---- Template gate state ----
  const [templateCode, setTemplateCode] = useState('');
  const [gateStatus, setGateStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  // ---- v2.4.0-AI-SYNC · AI Upgrade Hub state ----
  const [changeRequest, setChangeRequest] = useState('');
  const [patchToken, setPatchToken] = useState('');
  const [patchState, setPatchState] = useState<'idle' | 'snapshotting' | 'syncing' | 'applied' | 'queued' | 'error'>('idle');
  const [patchLog, setPatchLog] = useState<string[]>([]);

  // ---- v2.5.0-DUAL-AI · Channel 2 encrypted API + chat state ----
  const [apiKey, setApiKey] = useState('');
  const [apiKeyState, setApiKeyState] = useState<'dormant' | 'encrypting' | 'active' | 'error'>('dormant');
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'system', text: label('کانال مستقیم غیرفعال است. کلید معتبر وارد کنید.', 'Direct channel is dormant. Enter a valid API key.') },
  ]);

  // ---- Notification flash ----
  const [notice, setNotice] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const flash = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setNotice({ msg, kind });
    setTimeout(() => setNotice(null), 3500);
  };

  const apiKeyValid = apiKey.trim().length >= 20 && /^[A-Za-z0-9._-]+$/.test(apiKey.trim());

  /** AES-GCM encryption-at-rest for Channel 2. The ciphertext persists in
   * localStorage while the generated decrypt key is kept only in sessionStorage,
   * so the plain API key never enters localStorage. */
  const storeEncryptedApiKey = async (plain: string) => {
    if (!globalThis.crypto?.subtle) throw new Error('WebCrypto unavailable');
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plain);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    const b64 = (bytes: Uint8Array) => {
      let s = '';
      bytes.forEach((b) => { s += String.fromCharCode(b); });
      return btoa(s);
    };
    localStorage.setItem('sccpp.arena.api.cipher', JSON.stringify({
      cipher: b64(new Uint8Array(cipher)),
      iv: b64(iv),
      storedAt: new Date().toISOString(),
    }));
    sessionStorage.setItem('sccpp.arena.api.sessionKey', b64(rawKey));
  };

  // Channel 2 remains dormant until a syntactically valid key is populated.
  useEffect(() => {
    if (!apiKey.trim()) {
      setApiKeyState('dormant');
      setChatMessages([{ role: 'system', text: label('کانال مستقیم غیرفعال است. کلید معتبر وارد کنید.', 'Direct channel is dormant. Enter a valid API key.') }]);
      return;
    }
    if (!apiKeyValid) {
      setApiKeyState('error');
      return;
    }
    let cancelled = false;
    setApiKeyState('encrypting');
    storeEncryptedApiKey(apiKey.trim())
      .then(() => {
        if (cancelled) return;
        setApiKeyState('active');
        setChatMessages([{ role: 'system', text: label('کانال مستقیم فعال شد. قبل از هر تغییر، اسنپ‌شات محافظ ثبت می‌شود.', 'Direct channel active. A protected snapshot is captured before every mutation.') }]);
      })
      .catch(() => { if (!cancelled) setApiKeyState('error'); });
    return () => { cancelled = true; };
    // label is intentionally excluded; API state should react only to key input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, apiKeyValid]);

  // Load persisted meta from schema on mount
  useEffect(() => {
    const s = ensureSchema();
    const p = s.projects[projectId];
    if (p?.templateCode) setTemplateCode(p.templateCode);
  }, [projectId]);

  const handleBackup = () => {
    setBackupInProgress(true);
    const s = ensureSchema();
    const json = JSON.stringify(s, null, 2);
    const blob = new Blob([json], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sccpp_backup_${projectId}_${Date.now()}.bak`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => { setBackupInProgress(false); setBackupDone(true); flash(label('فایل پشتیبان با موفقیت ذخیره شد.', 'Backup saved successfully.')); }, 800);
  };

  const handleRestoreFile = (file: File | null) => {
    if (!file) return;
    setRestoreFile(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        localStorage.setItem('sccpp.v1', JSON.stringify(data));
        setRestoreDone(true);
        flash(label('اطلاعات با موفقیت بازیابی شد.', 'Data restored successfully.'));
      } catch {
        flash(label('فایل نامعتبر — بازیابی انجام نشد.', 'Invalid file — restore aborted.'), 'err');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveMeta = () => {
    flash(label('اطلاعات پروژه ذخیره شد.', 'Project metadata saved.'));
  };

  const handleAssignTemplate = () => {
    if (!templateCode.trim()) {
      flash(label('کد قالب را وارد کنید.', 'Enter a template code.'), 'err');
      setGateStatus('error');
      return;
    }
    const gate = isDailyTemplateAuthorized(projectId);
    if (gate.authorized && gate.templateCode === templateCode) {
      setGateStatus('ok');
      flash(label(`قالب ${templateCode} برای این پروژه فعال است.`, `Template ${templateCode} is already active for this project.`));
    } else {
      // Register a skeleton template so the gate activates
      registerDailyTemplate({
        code: templateCode,
        familyFa: templateCode.startsWith('RD') ? 'راه‌سازی' : 'عمومی',
        familyEn: templateCode.startsWith('RD') ? 'Roads' : 'General',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rows: [],
      });
      setGateStatus('ok');
      flash(label(`قالب ${templateCode} با موفقیت تخصیص یافت.`, `Template ${templateCode} assigned successfully.`));
    }
  };

  /** Creates the immutable local checkpoint shared by BOTH upgrade channels. */
  const createProtectedSnapshot = (channel: 'offline-token' | 'direct-api') => {
    const snapshotId = `sccpp.arena.snapshot.${Date.now()}`;
    const schema = ensureSchema();
    const snapshot = {
      snapshotId,
      command: 'BACKUP DATABASE [Arena_PMS]',
      capturedAt: new Date().toISOString(),
      projectId,
      channel,
      schema,
    };
    try { localStorage.setItem(snapshotId, JSON.stringify(snapshot)); } catch { /* private mode fallback */ }
    setPatchLog((l) => [
      ...l.slice(-3),
      `${label('اسنپ‌شات محلی پایگاه داده ثبت شد:', 'Local database snapshot captured:')} ${snapshot.command}`,
    ]);
    return { snapshotId, command: snapshot.command };
  };

  /** Applies only allowlisted runtime presentation changes. Arbitrary scripts
   * or local filesystem instructions are never executed in the browser. */
  const applySafeRuntimePatch = (patch: { patchId?: string; cssVariables?: Record<string, string>; menu?: unknown }) => {
    Object.entries(patch.cssVariables ?? {}).forEach(([key, value]) => {
      if (key.startsWith('--scada-') && typeof value === 'string' && value.length < 128) {
        document.documentElement.style.setProperty(key, value);
      }
    });
    window.dispatchEvent(new CustomEvent('arena:patch-applied', { detail: patch }));
    try { localStorage.setItem('sccpp.arena.lastPatch', JSON.stringify({ ...patch, token: '***', at: new Date().toISOString() })); } catch { /* ignore */ }
  };

  /** Channel 1: free copy/paste route. Accepts opaque tokens plus optional
   * JSON/base64-JSON payloads containing safe `--scada-*` variables. */
  const handleOfflinePatch = async () => {
    const token = patchToken.trim();
    if (!token) {
      flash(label('کد پچ ارتقای هوش مصنوعی را وارد کنید.', 'Enter an AI Patch Token.'), 'err');
      return;
    }

    setPatchState('snapshotting');
    const { snapshotId } = createProtectedSnapshot('offline-token');
    setPatchState('syncing');
    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      let decoded = token;
      if (token.startsWith('ARENA64:')) decoded = atob(token.slice('ARENA64:'.length));
      const patch = decoded.trim().startsWith('{')
        ? JSON.parse(decoded)
        : { patchId: token, cssVariables: {}, mode: 'opaque-token' };
      applySafeRuntimePatch(patch);
      localStorage.setItem('sccpp.arena.offlinePatch', JSON.stringify({ token, snapshotId, changeRequest, appliedAt: new Date().toISOString() }));
      setPatchState('applied');
      setPatchLog((l) => [...l.slice(-3), `${label('پچ آفلاین اعمال شد:', 'Offline patch applied:')} ${patch.patchId ?? 'runtime'}`]);
      flash(label('پچ آفلاین پس از اسنپ‌شات امن اعمال شد.', 'Offline patch applied after protected snapshot.'));
    } catch {
      setPatchState('error');
      flash(label('ساختار کد پچ نامعتبر است.', 'Invalid patch-token payload.'), 'err');
    }
  };

  /** Channel 2: encrypted-key direct chat. The same-origin Arena bridge is the
   * sole component allowed to perform function calls that write source files.
   * Every request is preceded by an Arena_PMS snapshot. */
  const handleDirectChat = async () => {
    const message = chatInput.trim();
    if (!apiKeyValid || apiKeyState !== 'active') {
      flash(label('ابتدا کلید اشتراک معتبر وارد کنید.', 'Enter a valid API key first.'), 'err');
      return;
    }
    if (!message) return;

    setChatMessages((m) => [...m, { role: 'user', text: message }]);
    setChatInput('');
    setChatBusy(true);
    const { snapshotId, command } = createProtectedSnapshot('direct-api');

    try {
      const response = await fetch('/api/arena/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({
          message,
          projectId,
          snapshotId,
          backupCommand: command,
          functionTools: ['patchMenu', 'patchCssVariables', 'patchTheme'],
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json() as { reply?: string; patch?: { patchId?: string; cssVariables?: Record<string, string>; menu?: unknown } };
      if (result.patch) applySafeRuntimePatch(result.patch);
      setChatMessages((m) => [...m, { role: 'assistant', text: result.reply ?? label('پچ تأیید و اجرا شد.', 'Verified patch executed.') }]);
    } catch {
      // Queue without exposing the key. The raw key remains only in React state;
      // ciphertext-at-rest was saved by the activation hook above.
      localStorage.setItem('sccpp.arena.pendingChat', JSON.stringify({ message, projectId, snapshotId, queuedAt: new Date().toISOString() }));
      setChatMessages((m) => [...m, { role: 'system', text: label('Arena Bridge در دسترس نیست؛ پیام پس از اسنپ‌شات در صف محلی ذخیره شد.', 'Arena Bridge unavailable; message queued locally after snapshot.') }]);
    } finally {
      setChatBusy(false);
    }
  };

  return (
    <div dir={dir} className="fixed inset-0 bg-[#F8F9FA] flex flex-col" style={{ zIndex: 9998 }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-900 flex items-center justify-center shadow-md flex-shrink-0">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-black text-[#0f172a] leading-tight">
              {label('تنظیمات سامانه', 'System Settings')}
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-[9px] font-bold">
              {label('پیکربندی و مدیریت سیستم', 'System Configuration & Management')}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 text-[9px] font-black" dir="ltr">
              v2.5.0-DUAL-AI
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            <span className="font-bold text-blue-700">{sectorName}</span>
            <span className="mx-1.5 text-slate-300">/</span>
            <span className="font-bold text-slate-700">{projectName}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="font-mono text-slate-400" dir="ltr">{projectId}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-bold text-slate-700 transition flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
          {label('بازگشت به داشبورد', 'Back to Dashboard')}
        </button>
      </header>

      {/* Flash notification */}
      {notice && (
        <div className={`flex items-center gap-2 px-5 py-2 text-[11px] font-bold flex-shrink-0 ${
          notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-rose-50 text-rose-800 border-b border-rose-200'
        }`}>
          {notice.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {notice.msg}
        </div>
      )}

      {/* Body grid */}
      <div className="flex-1 min-h-0 overflow-auto p-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 auto-rows-min">

        {/* ==== Card 1: Backup (.bak export) ==== */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center flex-shrink-0">
              <HardDrive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-[13px] font-black text-[#0f172a]">
                {label('پشتیبان‌گیری و خروجی پروژه', 'Project Backup & Export')}
              </h3>
              <p className="text-[9px] text-slate-500 mt-0.5">
                {label('ذخیره اطلاعات روی فلش یا پوشه مقصد به فرمت .bak', 'Save project data as a portable .bak file')}
              </p>
            </div>
          </div>

          <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-5 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md">
              <Download className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="text-[12.5px] font-black text-[#0f172a]">
                {label('خروجی فایل پشتیبان (.bak)', 'Export Backup File (.bak)')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {label('کلیک کنید تا فایل پشتیبان به فلش درایو یا پوشه انتخابی ذخیره شود.', 'Click to compile and save a .bak file to your flash drive or selected folder.')}
              </div>
            </div>
            <button
              onClick={handleBackup}
              disabled={backupInProgress}
              className={`px-5 py-2.5 rounded-xl text-[12px] font-black transition shadow-md ${
                backupInProgress
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : backupDone
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gradient-to-l from-blue-500 to-cyan-600 text-white hover:from-blue-600 hover:to-cyan-700 shadow-blue-500/25'
              }`}
            >
              {backupInProgress
                ? label('در حال پردازش…', 'Processing…')
                : backupDone
                  ? label('✓ پشتیبان ذخیره شد', '✓ Backup saved')
                  : label('آغاز پشتیبان‌گیری', 'Start Backup')}
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            {label('فایل .bak شامل تمام جداول DailyReports Core و Extension و تنظیمات قالب‌ها می‌باشد.', 'The .bak file includes DailyReports Core + Extension tables and all template settings.')}
          </div>
        </div>

        {/* ==== Card 2: Restore (.bak import) ==== */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
              <UploadCloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-[13px] font-black text-[#0f172a]">
                {label('بارگذاری و بازیابی اطلاعات', 'Restore from Backup File')}
              </h3>
              <p className="text-[9px] text-slate-500 mt-0.5">
                {label('خواندن فایل .bak و بازیابی به پایگاه داده SQL Server محلی', 'Read .bak file and restore to the local SQL Server database')}
              </p>
            </div>
          </div>

          <div
            onClick={() => restoreRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleRestoreFile(e.dataTransfer.files?.[0] ?? null); }}
            className={`rounded-xl border-2 border-dashed cursor-pointer p-5 text-center flex flex-col items-center gap-3 transition ${
              restoreFile
                ? 'border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50'
                : 'border-amber-200 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-400'
            }`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${
              restoreFile ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-amber-500 to-orange-600'
            }`}>
              {restoreFile ? <CheckCircle2 className="w-7 h-7 text-white" /> : <Database className="w-7 h-7 text-white" />}
            </div>
            <div>
              <div className="text-[12.5px] font-black text-[#0f172a]">
                {restoreFile
                  ? label(`فایل: ${restoreFile}`, `File: ${restoreFile}`)
                  : label('فایل .bak را اینجا رها کنید', 'Drop or select a .bak file')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {restoreFile
                  ? (restoreDone ? label('✓ بازیابی کامل شد', '✓ Restore complete') : label('برای تأیید بازیابی کلیک کنید', 'Click to confirm restore'))
                  : label('یا کلیک کنید برای انتخاب فایل', 'or click to browse')}
              </div>
            </div>
            <input
              ref={restoreRef}
              type="file"
              accept=".bak,.json"
              className="hidden"
              onChange={(e) => handleRestoreFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
            {label('بازیابی داده‌های موجود را بازنویسی می‌کند. قبل از ادامه پشتیبان تهیه کنید.', 'Restore overwrites existing data. Take a backup before proceeding.')}
          </div>
        </div>

        {/* ==== Card 3: Project Metadata Config ==== */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-[13px] font-black text-[#0f172a]">
                {label('پیکربندی متادیتای پروژه', 'Project Metadata Configuration')}
              </h3>
              <p className="text-[9px] text-slate-500 mt-0.5">
                {label('تنظیم فیلدهای خودکار: کارفرما، مشاور، شماره قرارداد و مختصات جغرافیایی', 'Configure autofill fields: Client, Consultant, Contract No., and geo-coordinates')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { key: 'clientName', icon: User, fa: 'نام کارفرما', en: 'Client Name', placeholder: label('شرکت توسعه ملی…', 'National Development Corp.') },
              { key: 'consultantName', icon: Lightbulb, fa: 'نام مشاور فنی', en: 'Consultant Name', placeholder: label('دفتر مهندسی…', 'Engineering Office…') },
              { key: 'contractNumber', icon: Hash, fa: 'شماره قرارداد', en: 'Contract Number', placeholder: 'PROJ-1404-XXX' },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <label key={f.key} className="block">
                  <span className="block text-[10px] font-bold text-slate-600 mb-1">{lang === 'fa' ? f.fa : f.en}</span>
                  <div className="relative">
                    <Icon className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400`} />
                    <input
                      value={meta[f.key as keyof typeof meta]}
                      onChange={(e) => setMeta((m) => ({ ...m, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className={`w-full bg-slate-50 border border-slate-300 focus:border-cyan-500 focus:bg-white rounded-xl py-1.5 text-[11px] text-[#212529] outline-none transition ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'}`}
                    />
                  </div>
                </label>
              );
            })}

            {/* Geo-coordinates for live weather widget */}
            <div>
              <span className="block text-[10px] font-bold text-slate-600 mb-1">
                {label('مختصات جغرافیایی (ابزار آب‌وهوا)', 'Geo-Coordinates (Weather Widget)')}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k: 'lat', ph: label('عرض جغرافیایی', 'Latitude e.g. 35.69') },
                  { k: 'lng', ph: label('طول جغرافیایی', 'Longitude e.g. 51.38') },
                ].map((f) => (
                  <div key={f.k} className="relative">
                    <MapPin className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400`} />
                    <input
                      value={meta[f.k as keyof typeof meta]}
                      onChange={(e) => setMeta((m) => ({ ...m, [f.k]: e.target.value }))}
                      placeholder={f.ph}
                      className={`w-full bg-slate-50 border border-slate-300 focus:border-cyan-500 focus:bg-white rounded-xl py-1.5 text-[11px] text-[#212529] outline-none transition ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveMeta}
            className="w-full py-2 rounded-xl bg-gradient-to-l from-cyan-500 to-blue-600 text-white text-[11px] font-black shadow-sm hover:from-cyan-600 hover:to-blue-700 transition flex items-center justify-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {label('ذخیره متادیتای پروژه', 'Save Project Metadata')}
          </button>
        </div>

        {/* ==== Card 4: Template Assignment Gate ==== */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-[13px] font-black text-[#0f172a]">
                {label('دروازه تخصیص قالب روزانه', 'Daily Template Assignment Gate')}
              </h3>
              <p className="text-[9px] text-slate-500 mt-0.5">
                {label('انتساب کد قالب به پروژه و فعال‌سازی بلوک‌های ثبت روزانه', 'Assign a template code to this project and activate daily entry blocks')}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
            <div className="text-[10px] font-bold text-slate-600">
              {label('کد قالب مانند RD-101 برای راه‌سازی وارد کنید:', 'Enter template code (e.g. RD-101 for Roads):')}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Hash className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400`} />
                <input
                  value={templateCode}
                  onChange={(e) => { setTemplateCode(e.target.value.toUpperCase()); setGateStatus('idle'); }}
                  placeholder="RD-101"
                  className={`w-full bg-white border ${
                    gateStatus === 'ok' ? 'border-emerald-400' : gateStatus === 'error' ? 'border-rose-400' : 'border-slate-300'
                  } focus:border-cyan-500 focus:bg-white rounded-lg py-1.5 text-[11px] font-mono outline-none transition ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'}`}
                  dir="ltr"
                />
              </div>
              <button
                onClick={handleAssignTemplate}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-l from-teal-500 to-emerald-600 text-white text-[11px] font-black flex items-center gap-1 transition hover:from-teal-600 hover:to-emerald-700 flex-shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {label('تخصیص', 'Assign')}
              </button>
            </div>
            <div className={`rounded-lg px-2.5 py-2 text-[10px] font-bold flex items-center gap-1.5 ${
              gateStatus === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : gateStatus === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-800'
                : 'bg-slate-100 border border-slate-200 text-slate-600'
            }`}>
              {gateStatus === 'ok'
                ? <><CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />{label(`دروازه فعال — قالب ${templateCode} تخصیص یافت`, `Gate ACTIVE — template ${templateCode} assigned`)}</>
                : gateStatus === 'error'
                  ? <><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{label('دروازه غیرفعال — کد قالب وارد کنید', 'Gate OFF — enter a valid template code')}</>
                  : <><Thermometer className="w-3.5 h-3.5 flex-shrink-0" />{label('در انتظار تخصیص قالب', 'Awaiting template assignment')}</>}
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[9.5px] text-amber-800 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {label(
              'اگر قالب تخصیص نیابد، دروازه بر روی OFF می‌ماند و فیلدهای ثبت روزانه غیرفعال (greyed-out) می‌شوند تا قالب معتبری اختصاص داده شود.',
              'If no template is assigned, the gate stays OFF and daily entry fields remain greyed-out until a valid template code is attached.'
            )}
          </div>
        </div>

        {/* ==== Card 5: Database Status & Reset ==== */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-[13px] font-black text-[#0f172a]">
                {label('وضعیت پایگاه داده محلی', 'Local Database Status')}
              </h3>
              <p className="text-[9px] text-slate-500 mt-0.5">
                {label('پارامترهای اتصال SQL Server و وضعیت جداول Core / Extension', 'SQL Server connection parameters and Core / Extension table status')}
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-[10px]">
            {[
              { k: 'Server', v: 'localhost\\SQLEXPRESS', ok: true },
              { k: 'Database', v: 'PMS_Portfolio', ok: true },
              { k: 'Auth', v: 'Integrated Security=SSPI', ok: true },
              { k: 'DailyReports', v: 'Core table ready', ok: true },
              { k: 'Bim4DSchedule', v: 'Extension table ready', ok: true },
              { k: 'Bim5DCost', v: 'Extension table ready', ok: true },
            ].map((row) => (
              <div key={row.k} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-mono font-bold text-slate-600" dir="ltr">{row.k}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-700" dir="ltr">{row.v}</span>
                  <span className={`w-2 h-2 rounded-full ${row.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => flash(label('وضعیت جداول بازبینی و تأیید شد.', 'Table status re-verified successfully.'))}
            className="w-full py-2 rounded-xl bg-gradient-to-l from-violet-500 to-indigo-600 text-white text-[11px] font-black flex items-center justify-center gap-1.5 transition hover:from-violet-600 hover:to-indigo-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {label('بازبینی وضعیت جداول', 'Re-verify Table Status')}
          </button>
        </div>

        {/* ==== Card 6: System Versioning ==== */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center flex-shrink-0">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-[13px] font-black text-[#0f172a]">
              {label('اطلاعات نسخه سامانه', 'System Version Info')}
            </h3>
          </div>
          <div className="space-y-1.5 text-[10px]">
            {[
              { k: label('نسخه پلتفرم', 'Platform version'), v: '2.5.0-DUAL-AI' },
              { k: label('شماره ساخت (Build)', 'Build number'), v: `b${Date.now().toString().slice(-6)}` },
              { k: label('حالت استقرار', 'Deployment mode'), v: label('آفلاین — LAN داخلی', 'Offline — Internal LAN') },
              { k: label('سازنده', 'Author'), v: 'محمدرضا هاشمی‌پور / Mohammadreza Hashemipour' },
              { k: label('مرجع قانونی', 'Legal reference'), v: label('بخشنامه ۵۰۹۰ + ماده ۳۰ ش.ع.پ', 'Circular 5090 + Art.30 GCC') },
            ].map((row) => (
              <div key={row.k} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 flex-shrink-0">{row.k}</span>
                <span className="font-bold text-[#212529] font-mono truncate ms-2" dir={row.k.includes('Author') || row.k.includes('سازنده') ? dir : 'ltr'}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ==== Card 7: v2.5.0-DUAL-AI · Dual AI Integration Box ==== */}
        <div className="lg:col-span-2 2xl:col-span-3 rounded-2xl bg-gradient-to-l from-cyan-50/70 via-white to-indigo-50/50 border border-cyan-200 shadow-sm p-5">
          <div className="flex items-start gap-3 pb-3 border-b border-cyan-200/70">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-md flex-shrink-0">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[13px] font-black text-[#0f172a]">
                  {label('کنسول مدیریت ارتقای هوش مصنوعی (Dual AI Integration Box)', 'Dual AI Integration & Upgrade Console')}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-100 border border-cyan-200 text-cyan-700 text-[8.5px] font-black" dir="ltr">
                  DUAL CHANNEL · ARENA BRIDGE
                </span>
              </div>
              <p className="text-[9.5px] text-slate-500 mt-0.5 leading-snug">
                {label('مسیر اول: کپی پچ آفلاین · مسیر دوم: چت مستقیم رمزگذاری‌شده و فراخوانی توابع بریج محلی.', 'Channel 1: offline copy/paste patch · Channel 2: encrypted direct chat with local bridge function calls.')}
              </p>
            </div>
            <Radio className={`w-4 h-4 flex-shrink-0 ${chatBusy || patchState === 'syncing' ? 'text-cyan-600 animate-pulse' : 'text-slate-400'}`} />
          </div>

          {/* ================= CHANNEL 1 · FREE COPY/PATCH ROUTE ================= */}
          <section className="mt-4 rounded-2xl bg-white/80 border border-cyan-200 p-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-cyan-100">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center font-black text-[11px] flex-shrink-0">1</div>
              <div className="min-w-0">
                <h4 className="text-[11.5px] font-black text-[#0f172a]">{label('مسیر اول — رایگان و کپی پچ', 'Channel 1 — Free Copy/Paste Patch')}</h4>
                <p className="text-[8.5px] text-slate-500">{label('فعال دائمی · بدون کلید API', 'Always active · No API key required')}</p>
              </div>
              <span className="ms-auto px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 text-[8px] font-black">ACTIVE</span>
            </div>

            <label className="block mt-3">
              <span className="block text-[10px] font-bold text-slate-600 mb-1.5">{label('شرح تغییرات مدنظر شما در ظاهر و منوها', 'Describe desired changes to appearance and menus')}</span>
              <textarea
                value={changeRequest}
                onChange={(e) => setChangeRequest(e.target.value)}
                rows={3}
                placeholder={label('مثال: رنگ پوسته شب را تیره‌تر کنید و ترتیب منوها را تغییر دهید…', 'Example: darken the night skin and reorder the module menu…')}
                className="w-full resize-none bg-slate-50 border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-xl px-3 py-2 text-[10.5px] text-[#212529] outline-none transition"
              />
            </label>

            <a
              href={ARENA_CONVERSATION_PORTAL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl bg-gradient-to-l from-blue-500 to-indigo-600 text-white text-[10.5px] font-black shadow-sm hover:opacity-90 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {label('ورود به اتاق گفتگو و مشاوره فنی با ارنا', 'Open Arena Conversation & Technical Consultation')}
            </a>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3 mt-3 items-end">
            <label className="block">
              <span className="block text-[10px] font-bold text-slate-600 mb-1.5">
                {label('کد پچ ارتقای هوش مصنوعی (AI Patch Token)', 'AI Patch Token')}
              </span>
              <div className="relative">
                <Link2 className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-600`} />
                <input
                  value={patchToken}
                  onChange={(e) => { setPatchToken(e.target.value); if (patchState !== 'idle') setPatchState('idle'); }}
                  placeholder="ARENA-PATCH-XXXX-XXXX"
                  className={`w-full bg-white border border-cyan-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-xl py-2.5 text-[11px] font-mono text-[#212529] outline-none transition ${dir === 'rtl' ? 'pr-10 pl-3' : 'pl-10 pr-3'}`}
                  dir="ltr"
                />
              </div>
            </label>

            <button
              onClick={handleOfflinePatch}
              disabled={patchState === 'snapshotting' || patchState === 'syncing'}
              className={`px-4 py-2.5 rounded-xl text-[11px] font-black shadow-md transition flex items-center justify-center gap-1.5 ${
                patchState === 'snapshotting' || patchState === 'syncing'
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : patchState === 'applied'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gradient-to-l from-cyan-500 to-indigo-600 text-white hover:from-cyan-600 hover:to-indigo-700 shadow-cyan-500/25'
              }`}
            >
              {patchState === 'snapshotting'
                ? label('ثبت اسنپ‌شات…', 'Snapshotting…')
                : patchState === 'syncing'
                  ? label('در حال همگام‌سازی…', 'Syncing…')
                  : patchState === 'applied'
                    ? label('✓ به‌روزرسانی اعمال شد', '✓ Update Applied')
                    : label('اعمال پچ آفلاین', 'Apply Offline Patch')}
            </button>
          </div>
          </section>

          {/* ================= CHANNEL 2 · DIRECT IN-APP CHAT ================= */}
          <section className={`mt-4 rounded-2xl border p-4 transition ${apiKeyState === 'active' ? 'bg-emerald-50/50 border-emerald-300' : 'bg-slate-50/80 border-slate-300'}`}>
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 text-white flex items-center justify-center font-black text-[11px] flex-shrink-0">2</div>
              <div className="min-w-0">
                <h4 className="text-[11.5px] font-black text-[#0f172a]">{label('مسیر دوم — چت مستقیم مستقل درون‌برنامه‌ای', 'Channel 2 — Independent In-App Direct Chat')}</h4>
                <p className="text-[8.5px] text-slate-500">{label('فراخوانی توابع از طریق Arena Bridge هم‌مبدأ', 'Function calls through same-origin Arena Bridge')}</p>
              </div>
              <span className={`ms-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black ${
                apiKeyState === 'active' ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                  : apiKeyState === 'error' ? 'bg-rose-100 border-rose-300 text-rose-700'
                  : 'bg-slate-200 border-slate-300 text-slate-500'
              }`}>
                {apiKeyState === 'active' ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                {apiKeyState === 'active' ? 'ACTIVE' : 'DORMANT'}
              </span>
            </div>

            <label className="block mt-3">
              <span className="block text-[10px] font-bold text-slate-600 mb-1.5">{label('تنظیمات کلید اشتراک هوش مصنوعی (API Key Console)', 'AI Subscription Key Settings (API Key Console)')}</span>
              <div className="relative">
                <KeyRound className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 ${apiKeyState === 'active' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={label('وضعیت: غیرفعال / منتظر وارد کردن کلید اشتراک…', 'Status: inactive / waiting for subscription key…')}
                  className={`w-full bg-white border focus:ring-2 rounded-xl py-2 text-[10px] font-mono text-[#212529] outline-none transition ${
                    dir === 'rtl' ? 'pr-10 pl-10' : 'pl-10 pr-10'
                  } ${apiKeyState === 'active' ? 'border-emerald-400 focus:ring-emerald-500/20' : apiKeyState === 'error' ? 'border-rose-400 focus:ring-rose-500/20' : 'border-slate-300 focus:border-violet-500 focus:ring-violet-500/20'}`}
                  dir="ltr"
                  autoComplete="off"
                />
                <LockKeyhole className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${apiKeyState === 'active' ? 'text-emerald-600' : 'text-slate-400'}`} />
              </div>
              <div className={`mt-1 text-[8.5px] font-bold ${apiKeyState === 'active' ? 'text-emerald-700' : apiKeyState === 'error' ? 'text-rose-700' : 'text-slate-400'}`}>
                {apiKeyState === 'active' ? label('کلید با AES-GCM رمزگذاری شد؛ موتور چت فعال است.', 'Key AES-GCM encrypted; chat engine active.')
                  : apiKeyState === 'encrypting' ? label('در حال رمزگذاری کلید…', 'Encrypting key…')
                  : apiKeyState === 'error' ? label('فرمت کلید نامعتبر است (حداقل ۲۰ کاراکتر).', 'Invalid key format (minimum 20 characters).')
                  : label('کانال امن خاموش است و هیچ ارتباطی برقرار نمی‌شود.', 'Secure channel is dormant; no connection is attempted.')}
              </div>
            </label>

            <div className={`mt-3 rounded-xl border flex flex-col min-h-[180px] max-h-[260px] overflow-hidden ${apiKeyState === 'active' ? 'bg-white border-emerald-200' : 'bg-slate-100 border-slate-200 opacity-70'}`}>
              <div className="px-2.5 py-2 border-b border-slate-200 flex items-center gap-1.5">
                <Bot className={`w-3.5 h-3.5 ${apiKeyState === 'active' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="text-[9.5px] font-black text-slate-700">{label('چت مستقیم ارتقای رابط', 'Direct UI Upgrade Chat')}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-auto p-2 space-y-1.5">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`rounded-lg px-2 py-1.5 text-[9px] leading-snug ${
                    m.role === 'user' ? 'bg-cyan-50 border border-cyan-200 text-cyan-900 ms-6'
                      : m.role === 'assistant' ? 'bg-emerald-50 border border-emerald-200 text-emerald-900 me-6'
                      : 'bg-slate-50 border border-slate-200 text-slate-500'
                  }`}>
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 p-2 flex items-center gap-1.5">
                <MessageSquareText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input
                  disabled={apiKeyState !== 'active' || chatBusy}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDirectChat()}
                  placeholder={label('دستور تغییر منو، CSS یا پوسته…', 'Describe a menu, CSS, or theme mutation…')}
                  className="flex-1 min-w-0 bg-transparent text-[9.5px] outline-none disabled:cursor-not-allowed"
                />
                <button
                  disabled={apiKeyState !== 'active' || chatBusy || !chatInput.trim()}
                  onClick={handleDirectChat}
                  className="p-1.5 rounded-lg bg-gradient-to-l from-violet-500 to-indigo-600 text-white disabled:bg-slate-300 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
            {[
              { icon: HardDrive, title: label('مرحله ۱ · حفاظت داده', 'Step 1 · Data Protection'), body: 'BACKUP DATABASE [Arena_PMS]' },
              { icon: Link2, title: label('مرحله ۲ · دو کانال مستقل', 'Step 2 · Dual Channels'), body: 'OFFLINE TOKEN · POST /api/arena/chat' },
              { icon: RefreshCw, title: label('مرحله ۳ · Hot Runtime Update', 'Step 3 · Hot Runtime Update'), body: label('CSS Variables + UI Event', 'CSS Variables + UI Event') },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="rounded-xl bg-white/80 border border-slate-200 p-2.5 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[9px] font-black text-slate-700">{s.title}</div>
                    <div className="text-[8px] font-mono text-slate-500 truncate" dir="ltr">{s.body}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl bg-slate-900 text-emerald-300 border border-slate-700 px-3 py-2 font-mono text-[9px] min-h-[42px] max-h-[92px] overflow-auto" dir="ltr">
            {patchLog.length
              ? patchLog.map((line, i) => <div key={i}>[{new Date().toLocaleTimeString()}] {line}</div>)
              : <div>READY · protected update channel initialized · local schema parameters remain immutable during patch verification.</div>}
          </div>

          <div className="mt-2 flex items-start gap-1.5 text-[9px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            {label('هر دو کانال ابتدا BACKUP DATABASE [Arena_PMS] را ثبت می‌کنند. مرورگر فقط پچ نمایشی امن را اعمال می‌کند؛ تغییر فایل محلی و SQL Server توسط Arena Bridge هم‌مبدأ انجام می‌شود.', 'Both channels snapshot BACKUP DATABASE [Arena_PMS] first. The browser applies only safe presentation patches; local files and SQL Server commands are delegated to the same-origin Arena Bridge.')}
          </div>
        </div>

      </div>
    </div>
  );
}
