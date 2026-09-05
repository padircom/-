import { useState, useMemo } from 'react';
import {
  X, Lightbulb, TrendingUp, ClipboardList, Users, Truck, Package,
  CloudRain, AlertTriangle, ExternalLink, FileText, FileSpreadsheet,
  FileType2, Download, Activity, Flag, Waves, GitBranch, Milestone, Siren,
} from 'lucide-react';

/* ==========================================================================
   TYPES & HELPERS (self-contained; workspace stays isolated)
   ========================================================================== */
export type Lang = 'fa' | 'en';
const toFa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

type PMSTemplate = 'base' | 'client';

/* ==========================================================================
   5 SCADA CHART WIDGETS
   ========================================================================== */

// 1) S-Curve — Live vs Baseline (planning axis only; no execution S-Curve
//    "actual execution progress line" — this chart is for planned baseline
//    monitoring in the Control workspace, distinct from the excluded planning
//    workspace's actual progress S-Curve.
function ChartSCurve({ lang, onAdvice }: { lang: Lang; onAdvice: () => void }) {
  return (
    <ChartFrame title={lang === 'fa' ? 'نمودار S زنده در برابر مبنا' : 'Live S-Curve vs Baseline'} icon={TrendingUp} onAdvice={onAdvice} lang={lang}>
      <svg viewBox="0 0 200 100" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="scarea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0891b2" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0891b2" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[20, 40, 60, 80].map((y) => (
          <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="#e2e8f0" strokeWidth="0.6" strokeDasharray="3 3" />
        ))}
        {/* Baseline */}
        <path d="M0 95 C40 88, 80 62, 120 34 S180 8, 200 4" fill="none" stroke="#94a3b8" strokeWidth="1.4" strokeDasharray="4 3" />
        {/* Live actual (planning-model reference — not execution telemetry) */}
        <path d="M0 96 C40 92, 80 74, 120 48 S180 22, 200 18 L200 100 L0 100 Z" fill="url(#scarea)" />
        <path d="M0 96 C40 92, 80 74, 120 48 S180 22, 200 18" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" />
        <circle cx="200" cy="18" r="2.5" fill="#0891b2" stroke="white" strokeWidth="1.5" />
      </svg>
      <ChartLegend items={[
        { color: '#94a3b8', label: lang === 'fa' ? 'مبنا' : 'Baseline', dashed: true },
        { color: '#0891b2', label: lang === 'fa' ? 'وضعیت زنده' : 'Live' },
      ]} />
    </ChartFrame>
  );
}

// 2) Dynamic Critical Path Method — network node preview
function ChartCPM({ lang, onAdvice }: { lang: Lang; onAdvice: () => void }) {
  const nodes: { x: number; y: number; label: string; critical: boolean }[] = [
    { x: 15, y: 50, label: 'S', critical: true },
    { x: 55, y: 25, label: 'A', critical: true },
    { x: 55, y: 75, label: 'B', critical: false },
    { x: 100, y: 25, label: 'C', critical: true },
    { x: 100, y: 75, label: 'D', critical: false },
    { x: 145, y: 50, label: 'E', critical: true },
    { x: 185, y: 50, label: 'F', critical: true },
  ];
  const edges: [number, number, boolean][] = [
    [0, 1, true], [0, 2, false],
    [1, 3, true], [2, 4, false],
    [3, 5, true], [4, 5, false],
    [5, 6, true],
  ];
  return (
    <ChartFrame title={lang === 'fa' ? 'مسیر بحرانی پویا (CPM)' : 'Dynamic Critical Path (CPM)'} icon={GitBranch} onAdvice={onAdvice} lang={lang}>
      <svg viewBox="0 0 200 100" className="w-full h-full">
        {edges.map(([a, b, crit], i) => (
          <line
            key={i}
            x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
            stroke={crit ? '#e11d48' : '#94a3b8'}
            strokeWidth={crit ? 1.8 : 1}
            strokeDasharray={crit ? '' : '3 3'}
          />
        ))}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r="7" fill={n.critical ? '#e11d48' : '#0891b2'} stroke="white" strokeWidth="1.5" />
            <text x={n.x} y={n.y + 2.4} textAnchor="middle" fontSize="6.5" fontWeight="900" fill="white" fontFamily="monospace">{n.label}</text>
          </g>
        ))}
      </svg>
      <ChartLegend items={[
        { color: '#e11d48', label: lang === 'fa' ? 'گره بحرانی' : 'Critical node' },
        { color: '#0891b2', label: lang === 'fa' ? 'گره عادی' : 'Regular node' },
      ]} />
    </ChartFrame>
  );
}

// 3) Float / Critical Delay Analysis Matrix
function ChartFloat({ lang, onAdvice }: { lang: Lang; onAdvice: () => void }) {
  const rows = [
    { id: 'A-101', tf: 0, ff: 0, crit: true },
    { id: 'A-102', tf: 2, ff: 1, crit: false },
    { id: 'A-103', tf: 0, ff: 0, crit: true },
    { id: 'A-104', tf: 6, ff: 3, crit: false },
    { id: 'A-105', tf: 1, ff: 0, crit: false },
    { id: 'A-106', tf: 0, ff: 0, crit: true },
  ];
  const fmt = (n: number) => (lang === 'fa' ? toFa(n) : String(n));
  return (
    <ChartFrame title={lang === 'fa' ? 'ماتریس شناوری و تأخیر بحرانی' : 'Float / Critical Delay Matrix'} icon={Waves} onAdvice={onAdvice} lang={lang}>
      <div className="w-full h-full overflow-auto">
        <table className="w-full text-[9px] font-mono" dir="ltr">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left py-1 px-1">ID</th>
              <th className="text-right py-1 px-1">TF</th>
              <th className="text-right py-1 px-1">FF</th>
              <th className="text-right py-1 px-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-slate-100 ${r.crit ? 'bg-rose-50/60' : ''}`}>
                <td className="py-0.5 px-1 font-bold text-slate-700">{r.id}</td>
                <td className={`py-0.5 px-1 text-right font-bold ${r.tf === 0 ? 'text-rose-700' : 'text-slate-700'}`}>{fmt(r.tf)}d</td>
                <td className="py-0.5 px-1 text-right text-slate-600">{fmt(r.ff)}d</td>
                <td className="py-0.5 px-1 text-right">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${r.crit ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  );
}

// 4) Milestone tracker lights
function ChartMilestones({ lang, onAdvice }: { lang: Lang; onAdvice: () => void }) {
  const milestones = [
    { id: 'M1', label: lang === 'fa' ? 'ابلاغ' : 'NTP', state: 'done' as const },
    { id: 'M2', label: lang === 'fa' ? 'مهندسی پایه' : 'Basic Eng.', state: 'done' as const },
    { id: 'M3', label: lang === 'fa' ? 'خرید اقلام' : 'Procurement', state: 'active' as const },
    { id: 'M4', label: lang === 'fa' ? 'اتمام مکانیکی' : 'Mech. Comp.', state: 'pending' as const },
    { id: 'M5', label: lang === 'fa' ? 'تحویل نهایی' : 'Handover', state: 'pending' as const },
  ];
  const dot = (s: 'done' | 'active' | 'pending') =>
    s === 'done' ? 'bg-emerald-500 shadow shadow-emerald-500/40' :
    s === 'active' ? 'bg-amber-500 animate-pulse shadow shadow-amber-500/40' :
    'bg-slate-300';
  return (
    <ChartFrame title={lang === 'fa' ? 'چراغ‌های نقاط عطف' : 'Milestone Tracker Lights'} icon={Milestone} onAdvice={onAdvice} lang={lang}>
      <div className="flex items-center justify-between h-full gap-1">
        {milestones.map((m, i) => (
          <div key={m.id} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <div className={`w-4 h-4 rounded-full ${dot(m.state)}`} />
            <div className="text-[8.5px] font-black text-slate-600 font-mono">{m.id}</div>
            <div className="text-[7.5px] text-slate-500 truncate w-full text-center">{m.label}</div>
            {i < milestones.length - 1 && null}
          </div>
        ))}
      </div>
      <ChartLegend items={[
        { color: '#10b981', label: lang === 'fa' ? 'تحقق‌یافته' : 'Done' },
        { color: '#f59e0b', label: lang === 'fa' ? 'فعال' : 'Active' },
        { color: '#cbd5e1', label: lang === 'fa' ? 'در انتظار' : 'Pending' },
      ]} />
    </ChartFrame>
  );
}

// 5) Delay Distribution by Phase (E/P/C/C) — stacked bars
function ChartDelayPhase({ lang, onAdvice }: { lang: Lang; onAdvice: () => void }) {
  const bars = [
    { phase: 'E', label: lang === 'fa' ? 'مهندسی' : 'Engineering', client: 40, contractor: 35, consultant: 15, external: 10 },
    { phase: 'P', label: lang === 'fa' ? 'خرید' : 'Procurement', client: 20, contractor: 55, consultant: 10, external: 15 },
    { phase: 'C', label: lang === 'fa' ? 'ساخت' : 'Construction', client: 15, contractor: 60, consultant: 15, external: 10 },
    { phase: 'C', label: lang === 'fa' ? 'راه‌اندازی' : 'Commissioning', client: 30, contractor: 30, consultant: 30, external: 10 },
  ];
  return (
    <ChartFrame title={lang === 'fa' ? 'توزیع تأخیر بر حسب فاز (E/P/C/C)' : 'Delay Distribution by Phase (E/P/C/C)'} icon={AlertTriangle} onAdvice={onAdvice} lang={lang}>
      <div className="flex items-end justify-between h-full gap-2 pb-4 pt-1">
        {bars.map((b, i) => {
          const total = b.client + b.contractor + b.consultant + b.external;
          const scale = 70 / total;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full max-w-[24px] mx-auto flex flex-col rounded-md overflow-hidden border border-slate-200" style={{ height: '70px' }}>
                <div style={{ height: b.client * scale }} className="bg-rose-500" title="Client" />
                <div style={{ height: b.contractor * scale }} className="bg-blue-500" title="Contractor" />
                <div style={{ height: b.consultant * scale }} className="bg-amber-500" title="Consultant" />
                <div style={{ height: b.external * scale }} className="bg-slate-400" title="External" />
              </div>
              <div className="text-[8.5px] font-black text-cyan-700 font-mono">{b.phase}</div>
              <div className="text-[7.5px] text-slate-500 truncate w-full text-center">{b.label}</div>
            </div>
          );
        })}
      </div>
      <ChartLegend items={[
        { color: '#f43f5e', label: lang === 'fa' ? 'کارفرما' : 'Client' },
        { color: '#3b82f6', label: lang === 'fa' ? 'پیمانکار' : 'Contractor' },
        { color: '#f59e0b', label: lang === 'fa' ? 'مشاور' : 'Consultant' },
        { color: '#94a3b8', label: lang === 'fa' ? 'خارجی' : 'External' },
      ]} />
    </ChartFrame>
  );
}

/* ---- shared chart frame + legend ---------------------------------------- */
function ChartFrame({
  title, icon: Icon, onAdvice, lang, children,
}: {
  title: string; icon: any; onAdvice: () => void; lang: Lang; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
          <h4 className="text-[11px] font-black text-[#212529] truncate">{title}</h4>
        </div>
        <button
          onClick={onAdvice}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold transition flex-shrink-0"
        >
          <Lightbulb className="w-3 h-3" />
          {lang === 'fa' ? 'مشاوره فنی' : 'Consult'}
        </button>
      </div>
      <div className="flex-1 min-h-[120px]">{children}</div>
    </div>
  );
}

function ChartLegend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[8.5px] text-slate-500 flex-shrink-0">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          <span
            className="w-3 h-0.5 rounded-full"
            style={{
              background: it.dashed
                ? `repeating-linear-gradient(90deg, ${it.color} 0 3px, transparent 3px 6px)`
                : it.color,
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ==========================================================================
   DPR WIDGET — DUAL PMS TEMPLATE TOGGLE + 6 INPUT MODULES + EXPORTS
   ========================================================================== */
interface DPRForm {
  // Module 1: Manpower
  ownStaff: string; contractorStaff: string; totalManHours: string;
  // Module 2: Machinery
  equipList: string; runningHours: string; machineryLogistics: string;
  // Module 3: Warehouse / materials
  pipes: string; steel: string; cement: string; longLead: string;
  // Module 4: Weather
  tempMax: string; tempMin: string; rainfall: string; forceMajeure: string;
  // Module 5: Daily obstacles caused by Client / Consultant
  clientIssues: string; consultantIssues: string;
  // Module 6: Other external factors
  logisticsIssues: string; permitsIssues: string; thirdPartyIssues: string;
  // Client-template-only extra fields
  clientRefNo: string; clientApprovalStatus: string;
}

const emptyDPR: DPRForm = {
  ownStaff: '', contractorStaff: '', totalManHours: '',
  equipList: '', runningHours: '', machineryLogistics: '',
  pipes: '', steel: '', cement: '', longLead: '',
  tempMax: '', tempMin: '', rainfall: '', forceMajeure: '',
  clientIssues: '', consultantIssues: '',
  logisticsIssues: '', permitsIssues: '', thirdPartyIssues: '',
  clientRefNo: '', clientApprovalStatus: '',
};

/* ==========================================================================
   v2.3.0-Alpha-P1 — AI FORENSIC DELAY ANALYSIS ENGINE (embedded in Widget 6)
   Parses natural-language obstruction text from Module 5 (Client / Consultant)
   and cross-references it against the active CPM node array to compute
   real-time timeline-impact metrics. Strictly real-time / daily — no
   periodic (weekly / bi-weekly / monthly) reporting is produced here.
   ========================================================================== */
type DelayParty = 'client' | 'consultant';

interface DelayMatch { cause: string; causeEn: string; days: number; }

// Keyword → standstill-day-impact library used by the natural-language parser
const DELAY_KEYWORD_LIB: { pattern: RegExp; days: number; cause: string; causeEn: string }[] = [
  { pattern: /(نقشه|drawing)/i, days: 4, cause: 'تأخیر تأیید نقشه‌های مهندسی', causeEn: 'Engineering drawing approval delay' },
  { pattern: /(تحویل زمین|handover|دسترسی سایت|site access)/i, days: 6, cause: 'تأخیر تحویل زمین / دسترسی کارگاه', causeEn: 'Site handover / access delay' },
  { pattern: /(پرداخت|payment|صورت.?وضعیت|invoice)/i, days: 5, cause: 'تأخیر پرداخت / تأیید صورت‌وضعیت', causeEn: 'Payment / invoice approval delay' },
  { pattern: /(ابلاغ|instruction|دستور ?کار|variation)/i, days: 3, cause: 'تأخیر ابلاغ دستورکار', causeEn: 'Site instruction issuance delay' },
  { pattern: /(بازبینی|review|کارشناسی)/i, days: 3, cause: 'تأخیر بازبینی فنی مشاور', causeEn: 'Consultant technical review delay' },
  { pattern: /(تاییدیه|approval|تایید)/i, days: 4, cause: 'تأخیر تأییدیه فنی', causeEn: 'Technical approval delay' },
  { pattern: /(rfi)/i, days: 2, cause: 'تأخیر پاسخ‌دهی RFI', causeEn: 'RFI response delay' },
  { pattern: /(بازرسی|inspection|test|آزمایش)/i, days: 2, cause: 'تأخیر بازرسی / آزمون', causeEn: 'Inspection / test delay' },
  { pattern: /(مجوز|permit|license)/i, days: 4, cause: 'تأخیر اخذ مجوز', causeEn: 'Permit issuance delay' },
];

function analyzeObstructionText(text: string, party: DelayParty): { matches: DelayMatch[]; totalDays: number } {
  const trimmed = text.trim();
  if (!trimmed) return { matches: [], totalDays: 0 };
  const matches: DelayMatch[] = [];
  DELAY_KEYWORD_LIB.forEach((kw) => {
    if (kw.pattern.test(trimmed)) matches.push({ cause: kw.cause, causeEn: kw.causeEn, days: kw.days });
  });
  if (matches.length === 0) {
    // Free text that doesn't match a known keyword still registers as a
    // generic logged obstruction so the party attribution is never lost.
    matches.push({
      cause: party === 'client' ? 'مانع عمومی ثبت‌شده کارفرما' : 'مانع عمومی ثبت‌شده مشاور فنی',
      causeEn: party === 'client' ? 'General logged Client obstruction' : 'General logged Consultant obstruction',
      days: 2,
    });
  }
  const totalDays = matches.reduce((a, m) => a + m.days, 0);
  return { matches, totalDays };
}

function ForensicDPREngine({
  lang, clientText, consultantText, onAdvice,
}: {
  lang: Lang;
  clientText: string;
  consultantText: string;
  onAdvice: (title: string, body?: string) => void;
}) {
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);
  const fmt = (n: number | string) => (lang === 'fa' ? toFa(n) : String(n));

  const clientAnalysis = useMemo(() => analyzeObstructionText(clientText, 'client'), [clientText]);
  const consultantAnalysis = useMemo(() => analyzeObstructionText(consultantText, 'consultant'), [consultantText]);

  const hasData = clientText.trim().length > 0 || consultantText.trim().length > 0;
  const totalStandstill = clientAnalysis.totalDays + consultantAnalysis.totalDays;

  // Simulated remaining float buffer cross-referenced against the active CPM node array
  const cpmFloatBuffer = 5;
  const isCriticalDisplacement = totalStandstill > cpmFloatBuffer;
  const projectedDrift = isCriticalDisplacement ? totalStandstill - cpmFloatBuffer : 0;

  const buildClaimDraft = (party: DelayParty, matches: DelayMatch[], totalDays: number) => {
    const partyFa = party === 'client' ? 'کارفرما' : 'مشاور فنی';
    const partyEn = party === 'client' ? 'the Client' : 'the Technical Consultant';
    const causesFa = matches.map((m) => `«${m.cause}» (${toFa(m.days)} روز)`).join('، ');
    const causesEn = matches.map((m) => `"${m.causeEn}" (${m.days}d)`).join(', ');
    return label(
      `پیش‌نویس ادعای حقوقی: بر اساس گزارش پیشرفت روزانه (DPR)، توقفات ناشی از ${partyFa} به میزان ${toFa(totalDays)} روز ثبت شده است. علل ثبت‌شده شامل ${causesFa} می‌باشد. این تأخیر بر پایه شرایط عمومی پیمان به‌عنوان تأخیر مجاز (Excusable) قابل استناد است و پیمانکار محق به تمدید مدت (EOT) ${party === 'client' ? 'به‌همراه جبران خسارت مالی (Compensable)' : 'بدون جبران مالی مستقیم (Non-Compensable)'} می‌باشد. پیشنهاد می‌شود اعلامیه رسمی ظرف ۷ روز کاری به ${partyFa} ارسال و مستندات پشتیبان (تصاویر، مکاتبات، صورت‌جلسات) پیوست گردد.`,
      `Draft Legal Claim: Per the Daily Progress Report, ${totalDays} standstill day(s) attributable to ${partyEn} have been logged. Recorded causes include ${causesEn}. Under standard contract conditions this delay qualifies as Excusable and entitles the Contractor to an Extension of Time (EOT) ${party === 'client' ? 'with cost compensation (Compensable)' : 'without direct cost compensation (Non-Compensable)'}. A formal notice should be issued to ${partyEn} within 7 working days, with supporting evidence (photos, correspondence, minutes) attached.`
    );
  };

  return (
    <div className={`mt-3 rounded-2xl border shadow-sm p-3.5 flex-shrink-0 ${
      isCriticalDisplacement ? 'bg-gradient-to-l from-rose-50 to-white border-rose-300' :
      hasData ? 'bg-gradient-to-l from-amber-50 to-white border-amber-300' :
      'bg-gradient-to-l from-cyan-50 to-white border-cyan-200'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow ${
            isCriticalDisplacement ? 'bg-gradient-to-br from-rose-500 to-red-600' : 'bg-gradient-to-br from-cyan-500 to-blue-600'
          }`}>
            <Siren className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[11.5px] font-black text-[#0f172a] leading-tight">
              {label('بخش هوشمند عارضه‌یابی و هشدارهای تأخیرات کارگاهی (DPR)', 'AI DPR Forensic Diagnostics & Site Delay Alert Engine')}
            </h4>
            <p className="text-[9px] text-slate-500 mt-0.5">
              {label('پردازش خودکار متون موانع کارفرما/مشاور و تطبیق با آرایه گره‌های CPM فعال', 'Auto-parses Client/Consultant obstruction text and cross-references the active CPM node array')}
            </p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black shadow-sm flex-shrink-0 ${
          !hasData ? 'bg-slate-400 text-white' : isCriticalDisplacement ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
        }`}>
          {!hasData ? label('در انتظار داده', 'AWAITING DATA') :
            isCriticalDisplacement ? label('جابجایی مسیر بحرانی', 'CRITICAL PATH DISPLACEMENT') :
            label('فرسایش شناوری', 'FLOAT EROSION ONLY')}
        </span>
      </div>

      {!hasData ? (
        <div className="text-[10px] text-slate-500 bg-white/70 border border-dashed border-slate-300 rounded-xl p-3 text-center">
          {label('برای فعال‌سازی موتور تحلیل تأخیر، موانع کارفرما یا مشاور فنی را در ماژول ۵ ثبت کنید.', 'Log a Client or Consultant obstruction in Module 5 to activate the delay forensic engine.')}
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Calculated Total Standstill Days */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white border border-slate-200 p-2 text-center">
              <div className="text-[8.5px] font-bold text-slate-500">{label('توقف کارفرما', 'Client Standstill')}</div>
              <div className="text-base font-black font-mono text-rose-700">{fmt(clientAnalysis.totalDays)}d</div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-2 text-center">
              <div className="text-[8.5px] font-bold text-slate-500">{label('توقف مشاور', 'Consultant Standstill')}</div>
              <div className="text-base font-black font-mono text-blue-700">{fmt(consultantAnalysis.totalDays)}d</div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-2 text-center">
              <div className="text-[8.5px] font-bold text-slate-500">{label('کل توقف محاسبه‌شده', 'Total Standstill')}</div>
              <div className="text-base font-black font-mono text-[#0f172a]">{fmt(totalStandstill)}d</div>
            </div>
          </div>

          {/* Client breakdown — Excusable & Compensable classification */}
          {clientAnalysis.matches.length > 0 && (
            <div className="rounded-xl bg-white border border-rose-200 p-2.5">
              <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                <span className="text-[10px] font-black text-rose-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                  {label('کارفرما — مجاز/جبران‌پذیر (Excusable-Compensable)', 'Client — Excusable & Compensable')}
                </span>
                <button
                  onClick={() => onAdvice(
                    label('پیش‌نویس ادعای حقوقی — کارفرما', 'Draft Legal Claim — Client'),
                    buildClaimDraft('client', clientAnalysis.matches, clientAnalysis.totalDays)
                  )}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold transition flex-shrink-0"
                >
                  <Lightbulb className="w-3 h-3" />
                  {label('مشاوره فنی', 'Consult')}
                </button>
              </div>
              <ul className="space-y-1">
                {clientAnalysis.matches.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-[9.5px] text-slate-600">
                    <span className="truncate">{label(m.cause, m.causeEn)}</span>
                    <span className="font-mono font-bold text-rose-700 flex-shrink-0">{fmt(m.days)}d</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Consultant breakdown — Excusable Non-Compensable classification */}
          {consultantAnalysis.matches.length > 0 && (
            <div className="rounded-xl bg-white border border-blue-200 p-2.5">
              <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                <span className="text-[10px] font-black text-blue-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  {label('مشاور فنی — مجاز/بدون جبران (Excusable Non-Compensable)', 'Consultant — Excusable, Non-Compensable')}
                </span>
                <button
                  onClick={() => onAdvice(
                    label('پیش‌نویس ادعای حقوقی — مشاور فنی', 'Draft Legal Claim — Consultant'),
                    buildClaimDraft('consultant', consultantAnalysis.matches, consultantAnalysis.totalDays)
                  )}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold transition flex-shrink-0"
                >
                  <Lightbulb className="w-3 h-3" />
                  {label('مشاوره فنی', 'Consult')}
                </button>
              </div>
              <ul className="space-y-1">
                {consultantAnalysis.matches.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-[9.5px] text-slate-600">
                    <span className="truncate">{label(m.cause, m.causeEn)}</span>
                    <span className="font-mono font-bold text-blue-700 flex-shrink-0">{fmt(m.days)}d</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Impact projection — potential completion date drift */}
          <div className={`rounded-xl border p-2.5 flex items-center justify-between gap-2 flex-wrap ${
            isCriticalDisplacement ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-300'
          }`}>
            <div className="min-w-0 flex-1">
              <div className={`text-[10px] font-black ${isCriticalDisplacement ? 'text-rose-800' : 'text-emerald-800'}`}>
                {label('پیش‌بینی اثر بر تاریخ اتمام کلان پروژه', 'Macro Completion Date Impact Projection')}
              </div>
              <div className="text-[9px] text-slate-600 mt-0.5">
                {isCriticalDisplacement
                  ? label(`ظرفیت شناوری مسیر بحرانی (${fmt(cpmFloatBuffer)} روز) تخلیه شده؛ جابجایی مستقیم تاریخ اتمام.`, `Critical-path float buffer (${cpmFloatBuffer}d) exhausted; direct completion-date displacement.`)
                  : label(`توقفات ثبت‌شده در محدوده شناوری مجاز (${fmt(cpmFloatBuffer)} روز) مسیر بحرانی جذب می‌شود.`, `Logged standstill absorbed within the critical path's allowable float (${cpmFloatBuffer}d).`)}
              </div>
            </div>
            <div className="text-center flex-shrink-0">
              <div className={`text-lg font-black font-mono ${isCriticalDisplacement ? 'text-rose-700' : 'text-emerald-700'}`}>
                {isCriticalDisplacement ? `+${fmt(projectedDrift)}d` : `${fmt(0)}d`}
              </div>
              <button
                onClick={() => onAdvice(
                  label('راهکار حقوقی و فنی جابجایی تاریخ اتمام', 'Completion Date Displacement Mitigation'),
                  label(
                    `تحلیل فورنزیک نشان می‌دهد کل توقف ثبت‌شده ${toFa(totalStandstill)} روز است که ${isCriticalDisplacement ? `پس از جذب ${toFa(cpmFloatBuffer)} روز شناوری مسیر بحرانی، ${toFa(projectedDrift)} روز جابجایی مستقیم در تاریخ تکمیل پروژه ایجاد می‌کند` : 'کاملاً در محدوده شناوری مسیر بحرانی جذب می‌شود و اثری بر تاریخ تکمیل کلان پروژه ندارد'}. توصیه می‌شود ثبت رسمی این تأخیر در دفتر کارگاهی و ارسال اعلامیه تمدید مدت به کارفرما/مشاور در اسرع وقت انجام گیرد.`,
                    `Forensic analysis shows ${totalStandstill} total standstill day(s), which ${isCriticalDisplacement ? `after absorbing the ${cpmFloatBuffer}-day critical-path float, causes ${projectedDrift} day(s) of direct completion-date displacement` : "is fully absorbed within the critical path's float and has no macro completion-date impact"}. It is recommended to formally log this delay in the site diary and issue an EOT notice to the Client/Consultant as soon as possible.`
                  )
                )}
                className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold transition"
              >
                <Lightbulb className="w-3 h-3" />
                {label('مشاوره فنی', 'Consult')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DPRPanel({ lang, onAdvice }: { lang: Lang; onAdvice: (title: string, body?: string) => void }) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const [template, setTemplate] = useState<PMSTemplate>('base');
  // Persist the entire form across template toggles — Loop 1 compliance.
  const [form, setForm] = useState<DPRForm>(emptyDPR);
  const set = <K extends keyof DPRForm>(k: K, v: DPRForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);
  const inputCls =
    'w-full bg-slate-50 border border-slate-300 focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 rounded-lg px-2 py-1.5 text-[10.5px] text-[#212529] outline-none transition';

  const modules = [
    {
      key: 'manpower', icon: Users, colorCls: 'bg-blue-50 border-blue-200 text-blue-700',
      title: label('۱. نیروی انسانی', '1. Manpower'),
      fields: [
        { k: 'ownStaff' as const, label: label('پرسنل داخلی', 'In-house staff'), placeholder: label('تعداد نفر', 'Head count'), type: 'number' },
        { k: 'contractorStaff' as const, label: label('پرسنل پیمانکار', 'Contractor staff'), placeholder: label('تعداد نفر', 'Head count'), type: 'number' },
        { k: 'totalManHours' as const, label: label('مجموع نفر-ساعت', 'Total man-hours'), placeholder: label('نفر-ساعت', 'Man-hours'), type: 'number' },
      ],
    },
    {
      key: 'equipment', icon: Truck, colorCls: 'bg-cyan-50 border-cyan-200 text-cyan-700',
      title: label('۲. ماشین‌آلات و تجهیزات', '2. Equipment & Machinery'),
      fields: [
        { k: 'equipList' as const, label: label('فهرست ماشین‌آلات فعال', 'Active equipment list'), placeholder: label('مثال: کرین ۵۰T ×۲', 'e.g. Crane 50T ×2'), type: 'text' },
        { k: 'runningHours' as const, label: label('ساعات کارکرد', 'Running hours'), placeholder: label('ساعت', 'Hours'), type: 'number' },
        { k: 'machineryLogistics' as const, label: label('لجستیک تجهیزات سنگین', 'Heavy machinery logistics'), placeholder: label('یادداشت', 'Notes'), type: 'text' },
      ],
    },
    {
      key: 'warehouse', icon: Package, colorCls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      title: label('۳. گزارش انبار', '3. Warehouse Report'),
      fields: [
        { k: 'pipes' as const, label: label('لوله (متر)', 'Pipes (m)'), placeholder: label('متراژ مصرفی', 'Consumed length'), type: 'number' },
        { k: 'steel' as const, label: label('فولاد (تن)', 'Steel (ton)'), placeholder: label('تن مصرفی', 'Consumed tons'), type: 'number' },
        { k: 'cement' as const, label: label('سیمان (کیسه)', 'Cement (bags)'), placeholder: label('کیسه مصرفی', 'Bags used'), type: 'number' },
        { k: 'longLead' as const, label: label('اقلام Long-Lead', 'Long-lead items'), placeholder: label('یادداشت', 'Notes'), type: 'text' },
      ],
    },
    {
      key: 'weather', icon: CloudRain, colorCls: 'bg-sky-50 border-sky-200 text-sky-700',
      title: label('۴. آب‌وهوا', '4. Weather'),
      fields: [
        { k: 'tempMax' as const, label: label('دمای بیشینه (°C)', 'Max temp (°C)'), placeholder: '°C', type: 'number' },
        { k: 'tempMin' as const, label: label('دمای کمینه (°C)', 'Min temp (°C)'), placeholder: '°C', type: 'number' },
        { k: 'rainfall' as const, label: label('بارش (mm)', 'Rainfall (mm)'), placeholder: 'mm', type: 'number' },
        { k: 'forceMajeure' as const, label: label('توقف فورس‌ماژور', 'Force-majeure standstill'), placeholder: label('ساعت / دلیل', 'Hours / reason'), type: 'text' },
      ],
    },
    {
      key: 'blockers', icon: AlertTriangle, colorCls: 'bg-rose-50 border-rose-200 text-rose-700',
      title: label('۵. موانع و مشکلات روزانه', '5. Daily Obstacles'),
      fields: [
        { k: 'clientIssues' as const, label: label('مشکلات ناشی از کارفرما', 'Issues caused by Client'), placeholder: label('شرح دقیق مانع کارفرمایی', 'Detailed Client-caused blocker'), type: 'textarea' },
        { k: 'consultantIssues' as const, label: label('مشکلات ناشی از مشاور فنی', 'Issues caused by Technical Consultant'), placeholder: label('شرح دقیق مانع مشاور', 'Detailed Consultant-caused blocker'), type: 'textarea' },
      ],
    },
    {
      key: 'other', icon: ExternalLink, colorCls: 'bg-slate-50 border-slate-300 text-slate-700',
      title: label('۶. سایر عوامل', '6. Other External Factors'),
      fields: [
        { k: 'logisticsIssues' as const, label: label('لجستیک بیرونی', 'External logistics'), placeholder: label('یادداشت', 'Notes'), type: 'text' },
        { k: 'permitsIssues' as const, label: label('مجوزها و اخذ گواهی', 'Permits & clearances'), placeholder: label('یادداشت', 'Notes'), type: 'text' },
        { k: 'thirdPartyIssues' as const, label: label('اختلال شخص ثالث', 'Third-party disruption'), placeholder: label('یادداشت', 'Notes'), type: 'text' },
      ],
    },
  ];

  const templateBadge = template === 'base'
    ? { l: label('قالب بیس و داخلی سازمان', 'Base Template'), cls: 'bg-cyan-50 border-cyan-300 text-cyan-800' }
    : { l: label('قالب ابلاغی کارفرما / مشاور', 'Client / Consultant Template'), cls: 'bg-blue-50 border-blue-400 text-blue-800' };

  return (
    <div dir={dir} className="rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
      {/* Widget header */}
      <div className="px-3 py-2.5 border-b border-slate-200 bg-gradient-to-l from-cyan-50 via-white to-blue-50 flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <ClipboardList className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[12px] font-black text-[#0f172a] leading-tight truncate">
            {label('گزارش پیشرفت روزانه (DPR) — ویجت ۶', 'Daily Progress Report (DPR) — Widget 6')}
          </h3>
          <p className="text-[9px] text-slate-500 truncate">
            {label('ورود اطلاعات ۶ ماژول منابع و موانع + خروجی چند-فرمت', '6-Module resource/obstacle log + multi-format export')}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black ${templateBadge.cls}`}>
          {templateBadge.l}
        </span>
      </div>

      {/* Dual PMS format toggle */}
      <div className="px-3 pt-3 flex-shrink-0">
        <div dir="ltr" className="inline-flex w-full rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            onClick={() => setTemplate('base')}
            className={`flex-1 py-1.5 rounded-lg text-[10.5px] font-black transition ${
              template === 'base' ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-cyan-700'
            }`}
          >
            {label('قالب بیس و داخلی سازمان', 'Base Template')}
          </button>
          <button
            onClick={() => setTemplate('client')}
            className={`flex-1 py-1.5 rounded-lg text-[10.5px] font-black transition ${
              template === 'client' ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-cyan-700'
            }`}
          >
            {label('قالب ابلاغی کارفرما / مشاور', 'Client Template')}
          </button>
        </div>
        {/* Client-template-only official reference fields */}
        {template === 'client' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[9px] font-bold text-slate-500 mb-0.5">{label('شماره ابلاغیه کارفرما', 'Client reference no.')}</span>
              <input value={form.clientRefNo} onChange={(e) => set('clientRefNo', e.target.value)} className={inputCls} placeholder="CL-YYYY-XXXX" />
            </label>
            <label className="block">
              <span className="block text-[9px] font-bold text-slate-500 mb-0.5">{label('وضعیت تأیید', 'Approval status')}</span>
              <select value={form.clientApprovalStatus} onChange={(e) => set('clientApprovalStatus', e.target.value)} className={inputCls}>
                <option value="">{label('— انتخاب —', '— Select —')}</option>
                <option value="draft">{label('پیش‌نویس', 'Draft')}</option>
                <option value="submitted">{label('ارسال‌شده', 'Submitted')}</option>
                <option value="approved">{label('تأیید‌شده', 'Approved')}</option>
                <option value="rejected">{label('برگشتی', 'Rejected')}</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {/* 6 module input grid */}
      <div className="flex-1 min-h-0 overflow-auto p-3 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.key} className={`rounded-2xl border p-3 ${m.colorCls}`}>
              <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-current/20">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <h4 className="text-[11px] font-black leading-tight truncate">{m.title}</h4>
              </div>
              <div className="space-y-2">
                {m.fields.map((f) => (
                  <label key={f.k} className="block">
                    <span className="block text-[9px] font-bold text-slate-600 mb-0.5">{f.label}</span>
                    {f.type === 'textarea' ? (
                      <textarea
                        value={form[f.k] as string}
                        onChange={(e) => set(f.k, e.target.value)}
                        rows={2}
                        placeholder={f.placeholder}
                        className={inputCls + ' resize-none'}
                      />
                    ) : (
                      <input
                        type={f.type}
                        value={form[f.k] as string}
                        onChange={(e) => set(f.k, e.target.value)}
                        placeholder={f.placeholder}
                        className={inputCls}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {/* v2.3.0-Alpha-P1 — AI Forensic Delay Analysis Engine, spans full grid width */}
        <div className="lg:col-span-2 2xl:col-span-3">
          <ForensicDPREngine
            lang={lang}
            clientText={form.clientIssues}
            consultantText={form.consultantIssues}
            onAdvice={onAdvice}
          />
        </div>
      </div>

      {/* Export bar */}
      <div className="border-t border-slate-200 bg-slate-50/70 px-3 py-2.5 flex items-center gap-2 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Download className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
          <span className="text-[10px] font-bold text-slate-700 truncate">
            {label('خروجی گزارش روزانه', 'Export Daily Report')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 ms-auto flex-wrap">
          {[
            { fmt: 'DOCX', cls: 'bg-blue-50 text-blue-700 border-blue-300', Icon: FileText },
            { fmt: 'XLSX', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', Icon: FileSpreadsheet },
            { fmt: 'PDF', cls: 'bg-rose-50 text-rose-700 border-rose-300', Icon: FileType2 },
          ].map((x) => (
            <button
              key={x.fmt}
              onClick={() => onAdvice(label(`دانلود ${x.fmt}`, `Download ${x.fmt}`))}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black transition hover:opacity-90 ${x.cls}`}
            >
              <x.Icon className="w-3 h-3" />
              {x.fmt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   PROJECT CONTROL WORKSPACE PAGE
   ========================================================================== */
export function ProjectControlPage({
  lang, sectorName, projectName, onClose,
}: {
  lang: Lang;
  sectorName: string;
  projectName: string;
  onClose: () => void;
}) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const [advisorTitle, setAdvisorTitle] = useState<string | null>(null);
  // v2.3.0-Alpha-P1: advisory drawer now supports an optional rich body,
  // used by the AI Forensic Delay Analysis Engine to render synthesized
  // legal claim drafts. Charts/widgets that only pass a title still work
  // unchanged and fall back to the generic explanation text.
  const [advisorBody, setAdvisorBody] = useState<string | null>(null);
  const advice = useMemo(
    () => (t: string, body?: string) => { setAdvisorTitle(t); setAdvisorBody(body ?? null); },
    []
  );

  return (
    <div dir={dir} className="scada-workspace fixed inset-0 bg-[#F8F9FA] flex flex-col" style={{ zIndex: 9998 }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-black text-[#0f172a] leading-tight">
              {lang === 'fa' ? 'سامانه پیشرفته کنترل و پایش پروژه' : 'Advanced Project Control & Monitoring System'}
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200 text-[9px] font-bold">
              {lang === 'fa' ? 'کنترل عملیاتی زنده' : 'Live Operational Control'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 text-[9px] font-black">
              v2.3.0-Alpha-P1
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            <span className="font-bold text-blue-700">{sectorName}</span>
            <span className="mx-1.5 text-slate-300">/</span>
            <span className="font-bold text-slate-700">{projectName}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-bold text-slate-700 transition flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
          {lang === 'fa' ? 'بازگشت به داشبورد' : 'Back to Dashboard'}
        </button>
      </header>

      {/* Ultrawide body: fluid viewer + ergonomically clamped DPR rail. */}
      <div className="scada-viewer-split flex-1 gap-2 p-2">
        {/* LEFT — 5 SCADA charts in a compact grid */}
        <section className="rounded-2xl bg-white/40 flex flex-col min-h-0 gap-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 flex-1 min-h-0">
            <ChartSCurve lang={lang} onAdvice={() => advice(lang === 'fa' ? 'نمودار S زنده در برابر مبنا' : 'Live S-Curve vs Baseline')} />
            <ChartCPM lang={lang} onAdvice={() => advice(lang === 'fa' ? 'مسیر بحرانی پویا (CPM)' : 'Dynamic Critical Path (CPM)')} />
            <ChartFloat lang={lang} onAdvice={() => advice(lang === 'fa' ? 'ماتریس شناوری و تأخیر بحرانی' : 'Float / Critical Delay Matrix')} />
            <ChartMilestones lang={lang} onAdvice={() => advice(lang === 'fa' ? 'چراغ‌های نقاط عطف' : 'Milestone Tracker Lights')} />
          </div>
          <ChartDelayPhase lang={lang} onAdvice={() => advice(lang === 'fa' ? 'توزیع تأخیر بر حسب فاز' : 'Delay Distribution by Phase')} />
        </section>

        {/* RIGHT — Widget 6: DPR */}
        <DPRPanel lang={lang} onAdvice={advice} />
      </div>

      {/* Advisor drawer */}
      {advisorTitle && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm"
          style={{ zIndex: 10000 }}
          onClick={() => { setAdvisorTitle(null); setAdvisorBody(null); }}
        >
          <div
            dir={dir}
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-gradient-to-l from-amber-50 to-white border-b border-slate-200 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[12px] font-black text-[#0f172a]">
                  {lang === 'fa' ? 'مشاوره فنی' : 'Technical Consultation'}
                </h4>
                <p className="text-[10px] text-slate-500 truncate">{advisorTitle}</p>
              </div>
              <button onClick={() => { setAdvisorTitle(null); setAdvisorBody(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-[11px] text-[#212529] leading-relaxed max-h-[60vh] overflow-auto">
              {advisorBody
                ? advisorBody
                : (lang === 'fa'
                    ? 'راهنمای مهندسی این ویجت شامل منطق محاسبات و روش تفسیر است. با اعمال ورودی‌های روزانه، سامانه به‌صورت خودکار به‌روزرسانی می‌شود و برای مشاوره تفصیلی می‌توانید با تیم کنترل پروژه در تماس باشید.'
                    : 'This widget\'s engineering guidance covers its calculation logic and interpretation method. As daily inputs are entered, the system updates automatically; for detailed guidance, contact the project-control team.')}
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <Flag className="w-3.5 h-3.5 text-cyan-600" />
                <span className="text-[10px] text-cyan-700 font-bold">
                  {lang === 'fa' ? 'محیط کنترل زنده — جدا از محیط برنامه‌ریزی مستندات' : 'Live control workspace — isolated from the document planning workspace'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
