/**
 * اجزای مشترک نقشهٔ گردش‌کار — «نقشهٔ گردش‌کار ماژول‌ها» (زبان بصری مشترک).
 * ═══════════════════════════════════════════════════════════════════════
 * نقشهٔ گردش‌کار برنامه‌ریزی (d2) و نقشهٔ گردش‌کار کنترل پروژه (d6) باید
 * دقیقاً یک جلوهٔ بصری داشته باشند؛ بنابراین سرستون رنگی، کارت گره با نوار
 * لبه، چیپ «بین‌ماژولی» و راهنما از این فایل مشترک می‌آیند تا تغییر یکی
 * روی دیگری هم دیده شود.
 */
import type { ReactElement, ReactNode } from "react";

/** نوع گره: ورودی/خروجی، پردازش (کنترل) یا ورودی بین‌ماژولی. */
export type WorkflowNodeKind = "io" | "proc" | "cross";

export interface WorkflowMapNode {
  titleFa: string;
  titleEn: string;
  subFa?: string;
  subEn?: string;
  kind: WorkflowNodeKind;
}

/** رنگ ستون‌ها — هم‌خانواده با رنگ حوزه‌های عملکردی. */
export const WF_COLOR = {
  input: "#D08A16",
  hub: "#0FA08C",
  cycle: "#2E9E4F",
  output: "#4C7FD1",
  cross: "#B08900",
} as const;

/* آیکن‌های ستون‌ها به‌صورت SVG درون‌خطی تا به فونت ایموجی وابسته نباشند. */
export const WF_ICONS: Record<string, ReactElement> = {
  inputs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
      <path d="M12 3v11" /><path d="m8 10 4 4 4-4" /><path d="M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" />
    </svg>
  ),
  hub: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
      <ellipse cx="12" cy="6" rx="7.5" ry="3" /><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" /><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
    </svg>
  ),
  cycle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
      <path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4h-4" />
    </svg>
  ),
  outputs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
      <path d="M12 21V10" /><path d="m8 13 4-4 4 4" /><path d="M4 9V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3" />
    </svg>
  ),
};

/**
 * کارت گرهٔ نقشه. اگر `onNavigate` داده شود، گره کلیک‌پذیر است؛
 * گره‌های «بین‌ماژولی» بدون کلیک می‌مانند (خط‌چین + چیپ).
 */
export function WorkflowNodeBox({
  node,
  rtl,
  accent,
  onNavigate,
  compact,
}: {
  node: WorkflowMapNode;
  rtl: boolean;
  accent: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const title = rtl ? node.titleFa : node.titleEn;
  const sub = rtl ? node.subFa : node.subEn;
  const isCross = node.kind === "cross";
  const inner = (
    <>
      <span
        aria-hidden="true"
        className={`absolute end-0 ${compact ? "top-1 bottom-1" : "top-2 bottom-2"} w-[3px] rounded-full`}
        style={{ background: isCross ? WF_COLOR.cross : accent, opacity: isCross ? 0.75 : 0.9 }}
      />
      <span className={`block ${compact ? "text-[8px] leading-[11px]" : "text-[11px] leading-4"} font-medium text-start tx1`}>{title}</span>
      {sub && !compact && <span className="mt-1 block text-[9.5px] font-light leading-4 text-start tx3">{sub}</span>}
      {isCross && !compact && (
        <span
          className={`block w-fit rounded-full font-medium ${compact ? "mt-0.5 px-1 py-px text-[7px]" : "mt-1.5 px-2 py-px text-[8px]"}`}
          style={{ background: `${WF_COLOR.cross}22`, color: "var(--ink)" }}
        >
          {rtl ? "بین‌ماژولی" : "cross-module"}
        </span>
      )}
    </>
  );
  const cls = `relative flex w-full flex-1 flex-col justify-center overflow-hidden rounded-xl border ${compact ? "px-2 py-1" : "px-3 py-2"} text-start transition ${
    isCross ? "border-dashed" : "border-solid"
  }`;
  const style = {
    background: isCross ? `${WF_COLOR.cross}12` : node.kind === "proc" ? `${accent}1a` : "var(--row)",
    borderColor: isCross ? `${WF_COLOR.cross}55` : node.kind === "proc" ? `${accent}55` : "var(--line-soft)",
  };
  if (!onNavigate) {
    return <div className={cls} style={style} aria-label={title}>{inner}</div>;
  }
  return (
    <button
      type="button"
      className={`${cls} cursor-pointer hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70`}
      style={{ ...style, transitionProperty: "transform, box-shadow, border-color, background-color" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accent}99`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isCross ? `${WF_COLOR.cross}55` : node.kind === "proc" ? `${accent}55` : "var(--line-soft)"; }}
      title={rtl ? `رفتن به «${title}»` : `Go to ${title}`}
      aria-label={rtl ? `رفتن به ${title}` : `Go to ${title}`}
      onClick={onNavigate}
    >
      {inner}
    </button>
  );
}

/** سرستون رنگی ستون نقشه. */
export function WorkflowColumnHead({
  fa,
  en,
  rtl,
  color,
  icon,
  compact,
}: {
  fa: string;
  en: string;
  rtl: boolean;
  color: string;
  icon: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-center gap-1.5 rounded-xl px-2 font-medium text-white ${compact ? "py-0.5 text-[9px]" : "py-1.5 text-[10.5px]"}`}
      style={{ background: `linear-gradient(180deg, ${color}, ${color}cc)`, boxShadow: `0 6px 16px -8px ${color}` }}
    >
      <span aria-hidden="true" className="inline-flex">{WF_ICONS[icon]}</span>
      <span>{rtl ? fa : en}</span>
    </div>
  );
}

/** راهنمای رنگ‌ها در پایین نقشه. */
export function WorkflowLegend({ rtl }: { rtl: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 text-[9.5px] font-light tx3">
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block h-2.5 w-2.5 rounded-[4px]" style={{ background: "var(--row)", border: "1px solid var(--line-soft)" }} />
        {rtl ? "ورودی‌ها و خروجی‌ها" : "Inputs and outputs"}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block h-2.5 w-2.5 rounded-[4px]" style={{ background: `${WF_COLOR.cycle}33`, border: `1px solid ${WF_COLOR.cycle}88` }} />
        {rtl ? "پردازش و کنترل" : "Processing and control"}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block h-2.5 w-2.5 rounded-[4px]" style={{ background: `${WF_COLOR.cross}22`, border: `1px dashed ${WF_COLOR.cross}88` }} />
        {rtl ? "ورودی بین‌ماژولی" : "Cross-module input"}
      </span>
    </div>
  );
}

/** پوستهٔ نقشه: عنوان، راهنما و کادر اصلی — مشترک بین همهٔ نقشه‌ها. */
export function WorkflowMapFrame({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section
      dir="ltr"
      aria-label={title}
      className="rounded-2xl border b-line bg-[var(--row)] p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h3 className="text-[13px] font-medium tx1">{title}</h3>
        <span className="text-[9.5px] font-light tx3">{hint}</span>
      </div>
      {children}
    </section>
  );
}
