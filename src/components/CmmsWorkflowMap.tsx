/**
 * نقشهٔ تعاملی جریان فرآیند نت (CMMS Process Workflow Map) — الگوی مرجع PMworks.
 *
 * سه ورودی/محرک (طرح‌ریزی PM، پایش وضعیت CBM و خرابی‌ها) چرخهٔ اصلی درون
 * سامانه را تغذیه می‌کنند: برنامه‌ریزی ← اجرا ← گزارش ← تحلیل KPI ← اقدامات
 * اصلاحی (CAPA)، و خروجی CAPA با حلقهٔ بازخورد به برنامه‌ریزی و اجرا برمی‌گردد.
 *
 * هر گره کلیک‌پذیر است و تب مربوطهٔ CMMS را باز می‌کند؛ نگاشت گره ← تب در
 * `target` هر گره است و برچسب مقصد زیر عنوان هر باکس دیده می‌شود تا کاربر
 * پیش از کلیک بداند کجا می‌رود. هیچ tooltip شناوری (نه `title` و نه
 * `<title>` در SVG) استفاده نشده است.
 *
 * نمودار یک SVG واکنش‌گرا با viewBox ثابت است؛ رنگ‌ها از متغیرهای تم
 * (`--ink`/`--row`/`--line-soft`) می‌آیند تا هر دو حالت Dark/Light درست
 * دیده شود و تأکید CMMS همان کهربایی ماژول (`#fbbf24`) می‌ماند.
 */

import { useState } from "react";
import type { CmmsSubModuleId } from "./CmmsWorkspaceShell";
import { moduleCardCls } from "./ModuleWorkspaceShell";

const CMMS_ACCENT = "#fbbf24";

type NodeKind = "input" | "step";

type WorkflowNode = {
  id: string;
  kind: NodeKind;
  stepNo?: number;
  icon: string;
  x: number;
  y: number;
  w: number;
  h: number;
  faLines: string[];
  enLines: string[];
  faSub: string;
  enSub: string;
  /** تبی که کلیک روی این گره باز می‌کند. */
  target: CmmsSubModuleId;
  targetFa: string;
  targetEn: string;
};

/* هندسه روی بوم ۹۸۰×۵۲۸: ستون ورودی‌ها راستِ بیرونِ مرز، چرخه درون مرز
 * خط‌چین. ترتیب گام‌ها با شمارهٔ روی هر باکس مشخص است، پس جهت فلش‌ها در
 * هر دو زبان یکسان و خوانا می‌ماند. */
const NODES: WorkflowNode[] = [
  /* ── ورودی‌ها و محرک‌های سه‌گانه ─────────────────────────────── */
  {
    id: "in-pm", kind: "input", icon: "🗓️", x: 716, y: 118, w: 244, h: 92,
    faLines: ["طرح‌ریزی فعالیت‌های", "نگهداری و تعمیرات"], enLines: ["Maintenance Activity", "Design (PM Strategy)"],
    faSub: "PM Strategy", enSub: "PM Strategy",
    target: "pm", targetFa: "برنامه‌ریزی نت پیشگیرانه", targetEn: "Preventive Maintenance Planning",
  },
  {
    id: "in-cbm", kind: "input", icon: "🌡️", x: 716, y: 262, w: 244, h: 92,
    faLines: ["پایش و شناسایی", "وضعیت تجهیزات"], enLines: ["Equipment Condition", "Monitoring & Detection"],
    faSub: "CBM · Condition Monitoring", enSub: "CBM · Condition Monitoring",
    target: "condition", targetFa: "پایش وضعیت و هشدارها", targetEn: "Condition Monitoring & Alerts",
  },
  {
    id: "in-breakdown", kind: "input", icon: "🚨", x: 716, y: 406, w: 244, h: 92,
    faLines: ["اتفاقات و خرابی", "تجهیزات"], enLines: ["Equipment Incidents", "& Breakdowns"],
    faSub: "Breakdowns · CM Requests", enSub: "Breakdowns · CM Requests",
    target: "work-orders", targetFa: "درخواست‌کار و دستورکار", targetEn: "Work Requests & Orders",
  },

  /* ── چرخهٔ اصلی درون سامانه ──────────────────────────────────── */
  {
    id: "step-plan", kind: "step", stepNo: 1, icon: "🧭", x: 478, y: 138, w: 184, h: 96,
    faLines: ["برنامه‌ریزی فعالیت", "نگهداری و تعمیرات"], enLines: ["Maintenance Activity", "Planning"],
    faSub: "Work Order Planning & Scheduling", enSub: "Work Order Planning & Scheduling",
    target: "work-orders", targetFa: "درخواست‌کار و دستورکار", targetEn: "Work Requests & Orders",
  },
  {
    id: "step-execute", kind: "step", stepNo: 2, icon: "🛠️", x: 262, y: 138, w: 184, h: 96,
    faLines: ["اجرای فعالیت‌های", "نگهداری و تعمیرات"], enLines: ["Maintenance Activity", "Execution"],
    faSub: "Work Order Execution · Parts/Labor", enSub: "Work Order Execution · Parts/Labor",
    target: "work-orders", targetFa: "درخواست‌کار و دستورکار", targetEn: "Work Requests & Orders",
  },
  {
    id: "step-report", kind: "step", stepNo: 3, icon: "🧾", x: 46, y: 138, w: 184, h: 96,
    faLines: ["گزارش فعالیت‌های", "نگهداری و تعمیرات"], enLines: ["Maintenance Activity", "Reporting"],
    faSub: "Maintenance Logs & Reports", enSub: "Maintenance Logs & Reports",
    target: "dashboard", targetFa: "داشبورد مدیریت نت", targetEn: "Maintenance Dashboard",
  },
  {
    id: "step-kpi", kind: "step", stepNo: 4, icon: "📈", x: 46, y: 372, w: 184, h: 96,
    faLines: ["تحلیل شاخص‌های کلیدی", "عملکرد نت"], enLines: ["Maintenance KPI", "Analysis"],
    faSub: "MTBF · MTTR · Availability", enSub: "MTBF · MTTR · Availability",
    target: "analytics", targetFa: "قابلیت اطمینان و هزینهٔ چرخهٔ عمر", targetEn: "Reliability & LCC Analytics",
  },
  {
    id: "step-capa", kind: "step", stepNo: 5, icon: "🎯", x: 300, y: 372, w: 200, h: 96,
    faLines: ["تعریف اقدامات اصلاحی", "و بهبود"], enLines: ["Corrective & Improvement", "Actions"],
    faSub: "CAPA", enSub: "CAPA",
    target: "rcfa", targetFa: "تحلیل ریشه‌ای (RCFA)", targetEn: "Root Cause Analysis (RCFA)",
  },
];

type Props = {
  fa: boolean;
  onNavigate: (sub: CmmsSubModuleId) => void;
};

export default function CmmsWorkflowMap({ fa, onNavigate }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const lines = (node: WorkflowNode) => (fa ? node.faLines : node.enLines);

  const renderNode = (node: WorkflowNode) => {
    const isHover = hovered === node.id;
    const cx = node.x + node.w / 2;
    const textLines = lines(node);
    const firstLineY = node.y + 30;
    return (
      <g
        key={node.id}
        role="button"
        tabIndex={0}
        aria-label={`${fa ? node.faLines.join(" ") : node.enLines.join(" ")} ← ${fa ? node.targetFa : node.targetEn}`}
        onClick={() => onNavigate(node.target)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onNavigate(node.target);
          }
        }}
        onMouseEnter={() => setHovered(node.id)}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(node.id)}
        onBlur={() => setHovered(null)}
        style={{ cursor: "pointer", outline: "none" }}
      >
        <rect
          x={node.x}
          y={node.y}
          width={node.w}
          height={node.h}
          rx={12}
          fill={isHover ? "var(--row-hover)" : "var(--row)"}
          stroke={isHover ? CMMS_ACCENT : "var(--line-soft)"}
          strokeWidth={isHover ? 2 : 1}
          strokeDasharray={node.kind === "input" ? "5 4" : undefined}
          style={{ transition: "fill 160ms ease, stroke 160ms ease" }}
        />
        {/* نشان شمارهٔ گام / نوع ورودی */}
        {node.kind === "step" ? (
          <>
            <circle cx={node.x + 16} cy={node.y + 16} r={10} fill={CMMS_ACCENT} />
            <text x={node.x + 16} y={node.y + 20} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1a1207">
              {node.stepNo}
            </text>
          </>
        ) : (
          <text x={node.x + 18} y={node.y + 21} textAnchor="middle" fontSize={13} aria-hidden="true">
            {node.icon}
          </text>
        )}
        {textLines.map((line, index) => (
          <text
            key={index}
            x={cx}
            y={firstLineY + index * 19}
            textAnchor="middle"
            fontSize={14}
            fontWeight={600}
            fill="var(--ink)"
          >
            {line}
          </text>
        ))}
        <text x={cx} y={firstLineY + textLines.length * 19 + 2} textAnchor="middle" fontSize={9.5} fill="var(--ink3)">
          {fa ? node.faSub : node.enSub}
        </text>
        <text x={cx} y={node.y + node.h - 8} textAnchor="middle" fontSize={9.5} fill={isHover ? CMMS_ACCENT : "var(--ink4)"}>
          ← {fa ? node.targetFa : node.targetEn}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-3">
      {/* راهنمای بالای نقشه */}
      <div className={`${moduleCardCls} flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5`}>
        <span className="text-[13px]" aria-hidden="true">🗺️</span>
        <p className="tx2 min-w-0 flex-1 text-[11.5px] leading-5">
          {fa
            ? "نقشهٔ جریان فرآیند نت بر پایهٔ الگوی مرجع PMworks: سه ورودیِ بیرونی، چرخهٔ پنج‌گامی درون سامانه و حلقهٔ بازخورد اقدامات اصلاحی. روی هر باکس کلیک کنید تا بخش مربوطه در CMMS باز شود."
            : "Maintenance process flow based on the PMworks reference pattern: three external inputs, the five-step cycle inside the system and the corrective-action feedback loop. Click any box to open its CMMS section."}
        </p>
        <span className="flex flex-wrap items-center gap-1.5 text-[10px] tx3">
          <span className="rounded-md border border-dashed b-line px-2 py-0.5">{fa ? "ورودی / محرک" : "Input / Trigger"}</span>
          <span className="rounded-md border b-line-soft px-2 py-0.5">{fa ? "گام چرخهٔ اصلی" : "Main-cycle step"}</span>
          <span className="rounded-md border px-2 py-0.5" style={{ borderColor: CMMS_ACCENT, color: CMMS_ACCENT }}>
            {fa ? "حلقهٔ بازخورد بهبود" : "Improvement feedback"}
          </span>
        </span>
      </div>

      {/* بوم نمودار */}
      <div className={`${moduleCardCls} p-2 sm:p-3`}>
        <svg
          viewBox="0 0 980 528"
          className="h-auto w-full"
          role="group"
          aria-label={fa ? "نمودار تعاملی گردش‌کار مدیریت نگهداری و تعمیرات" : "Interactive maintenance workflow diagram"}
        >
          <defs>
            <marker id="cmms-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--ink3)" />
            </marker>
            <marker id="cmms-arrow-accent" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={CMMS_ACCENT} />
            </marker>
          </defs>

          {/* مرز سامانهٔ CMMS */}
          <rect x={10} y={76} width={684} height={432} rx={18} fill="none" stroke={CMMS_ACCENT} strokeWidth={1.2} strokeDasharray="7 5" opacity={0.75} />
          <text x={352} y={102} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={CMMS_ACCENT}>
            {fa ? "چرخهٔ اصلی درون سامانهٔ CMMS" : "Main cycle inside the CMMS"}
          </text>
          <text x={838} y={102} textAnchor="middle" fontSize={12.5} fontWeight={700} fill="var(--ink2)">
            {fa ? "ورودی‌ها و محرک‌ها" : "Inputs & Triggers"}
          </text>

          {/* فلش‌های ورودی به گام ۱ (برنامه‌ریزی) */}
          <path d="M716,164 C700,168 682,176 664,182" fill="none" stroke="var(--ink3)" strokeWidth={1.4} markerEnd="url(#cmms-arrow)" />
          <path d="M716,308 C698,290 684,240 664,200" fill="none" stroke="var(--ink3)" strokeWidth={1.4} markerEnd="url(#cmms-arrow)" />
          <path d="M716,452 C690,420 676,300 664,214" fill="none" stroke="var(--ink3)" strokeWidth={1.4} markerEnd="url(#cmms-arrow)" />

          {/* جریان اصلی چرخه: ۱←۲←۳، پایین به ۴، راست به ۵ */}
          <path d="M478,186 L450,186" fill="none" stroke="var(--ink3)" strokeWidth={1.6} markerEnd="url(#cmms-arrow)" />
          <path d="M262,186 L234,186" fill="none" stroke="var(--ink3)" strokeWidth={1.6} markerEnd="url(#cmms-arrow)" />
          <path d="M138,234 L138,368" fill="none" stroke="var(--ink3)" strokeWidth={1.6} markerEnd="url(#cmms-arrow)" />
          <path d="M230,420 L296,420" fill="none" stroke="var(--ink3)" strokeWidth={1.6} markerEnd="url(#cmms-arrow)" />

          {/* حلقه‌های بازخورد CAPA به اجرا و برنامه‌ریزی */}
          <path d="M368,372 C360,330 356,290 355,238" fill="none" stroke={CMMS_ACCENT} strokeWidth={1.6} strokeDasharray="6 4" markerEnd="url(#cmms-arrow-accent)" />
          <path d="M452,372 C500,330 548,290 566,238" fill="none" stroke={CMMS_ACCENT} strokeWidth={1.6} strokeDasharray="6 4" markerEnd="url(#cmms-arrow-accent)" />
          <text x={352} y={330} textAnchor="middle" fontSize={10} fill={CMMS_ACCENT}>
            {fa ? "بازخورد به اجرا" : "Feedback to execution"}
          </text>
          <text x={540} y={316} textAnchor="middle" fontSize={10} fill={CMMS_ACCENT}>
            {fa ? "بازخورد به برنامه‌ریزی" : "Feedback to planning"}
          </text>

          {NODES.map(renderNode)}
        </svg>
      </div>

      <p className="tx3 px-1 text-[10.5px] leading-5">
        {fa
          ? "چرخه از «تعریف اقدامات اصلاحی و بهبود» بسته می‌شود: CAPA یا مستقیم در چرخهٔ بعد برنامه‌ریزی می‌شود یا هنگام اجرا به‌کار می‌رود. مقصد هر باکس زیر عنوان آن نوشته شده است."
          : "The cycle closes at “Corrective & Improvement Actions”: a CAPA is either planned into the next cycle or applied during execution. Each box names the section it opens beneath its title."}
      </p>
    </div>
  );
}
