/**
 * نقشهٔ گردش‌کار برنامه‌ریزی و کنترل پروژه (EPC) — بالای داشبورد برنامه‌ریزی.
 * ═══════════════════════════════════════════════════════════════════════
 * چیدمان چهار ستون (ورودی‌ها ← هاب داده ← چرخهٔ به‌روزرسانی ← خروجی‌ها)
 * با زبان بصری «نقشهٔ فرایندی ماژول‌ها»: سرستون رنگیِ هر ستون، کارت‌های
 * تیره با نوار رنگی در لبه، گره‌های بین‌ماژولی خط‌چین و حلقهٔ حاکمیت در پایین.
 * گره‌های داخل ماژول کلیک‌پذیرند و به زیربخش مربوط می‌روند؛ گره‌های
 * بین‌ماژولی (تأمین، کیفیت) کلیک ندارند.
 */
import type { ReactElement } from "react";
import type { PexTab } from "./PlanningWorkspace";

interface MapNode {
  titleFa: string;
  titleEn: string;
  subFa?: string;
  subEn?: string;
  tab?: PexTab;
  kind: "io" | "proc" | "cross";
}

const INPUTS: MapNode[] = [
  { titleFa: "برنامهٔ پایه", titleEn: "Baseline plan", subFa: "برنامه‌های سطوح ۱ تا ۴ (MSP/P6)", subEn: "L1–L4 schedules", tab: "baseline", kind: "io" },
  { titleFa: "پیمانکاران", titleEn: "Subcontractors", subFa: "برنامهٔ پایه و گزارش روزانهٔ پیمانکار", subEn: "Baseline schedules & live DPR", tab: "dpr", kind: "io" },
  { titleFa: "گزارش‌های سایت", titleEn: "Site reports", subFa: "پیشرفت روزانه و تاریخ‌های واقعی", subEn: "Daily progress", tab: "dpr", kind: "io" },
  { titleFa: "تأمین و خرید", titleEn: "Procurement", subFa: "وضعیت پیگیری و ارسال — از ماژول تأمین", subEn: "Expediting status — cross-module", kind: "cross" },
  { titleFa: "مهندسی", titleEn: "Engineering", subFa: "وضعیت مدارک و خروجی‌های مهندسی", subEn: "Deliverables status", tab: "weekly", kind: "io" },
  { titleFa: "کنترل کیفیت ساخت", titleEn: "Construction QC", subFa: "ITP و بازرسی‌ها — از ماژول کیفیت", subEn: "ITP / inspections — cross-module", kind: "cross" },
  { titleFa: "ایمنی و نیروی انسانی", titleEn: "HSE and manpower", subFa: "هیستوگرام نیروی انسانی و شاخص‌ها", subEn: "Histogram, KPIs", tab: "weekly", kind: "io" },
];

const CYCLE: MapNode[] = [
  { titleFa: "به‌روزرسانی روزانه", titleEn: "Daily update", subFa: "تاریخ‌های واقعی، درصد پیشرفت", subEn: "Actual dates, %", tab: "dpr", kind: "proc" },
  { titleFa: "به‌روزرسانی هفتگی", titleEn: "Weekly update", subFa: "بازپیش‌بینی، مسیر بحرانی و سلامت برنامه، نگاه‌به‌جلو", subEn: "Re-forecast, CP & health, 3WLA", tab: "weekly", kind: "proc" },
  { titleFa: "به‌روزرسانی ماهانه", titleEn: "Monthly update", subFa: "برش دوره و پیش‌بینی نهایی", subEn: "Cut-off and forecast", tab: "mpr", kind: "proc" },
];

const OUTPUTS: MapNode[] = [
  /* نمای خلاصهٔ ماژول: KPI، WBS، انحراف و پیش‌بینی روی یک صفحه. اول از
   * همه می‌آید چون نقطهٔ ورود ماژول همین نقشه است و کاربر پیش از هر
   * چیز وضعیت کل را می‌خواهد. */
  { titleFa: "داشبورد کنترل پیشرفت", titleEn: "Progress control dashboard", subFa: "KPI، WBS، انحراف و پیش‌بینی", subEn: "KPIs, WBS, variance & forecast", tab: "dashboard", kind: "io" },
  { titleFa: "گزارش روزانه", titleEn: "Daily report", tab: "dpr", kind: "io" },
  { titleFa: "گزارش هفتگی", titleEn: "Weekly report", tab: "weekly", kind: "io" },
  { titleFa: "برنامهٔ نگاه‌به‌جلو (3WLA)", titleEn: "3WLA schedule", tab: "baseline", kind: "io" },
  { titleFa: "گزارش ماهانه (PSR/MPR)", titleEn: "PSR (monthly)", tab: "mpr", kind: "io" },
  { titleFa: "منحنی S و ارزش کسب‌شده (EVM)", titleEn: "EVM and S-curves", tab: "baseline", kind: "io" },
  { titleFa: "تأخیرها و نقاط عطف", titleEn: "Delay and claims", subFa: "تحلیل تأخیر، جریمه و تصعید", subEn: "Delay analysis & escalation", tab: "alerts", kind: "io" },
];

/* رنگ ستون‌ها — هم‌خانواده با رنگ حوزه‌های عملکردی در نقشهٔ ماژول‌ها. */
const C_INPUT = "#D08A16";
const C_HUB = "#0FA08C";
const C_CYCLE = "#2E9E4F";
const C_OUTPUT = "#4C7FD1";
const C_CROSS = "#B08900";

function NodeBox({
  node,
  rtl,
  accent,
  onNavigate,
}: {
  node: MapNode;
  rtl: boolean;
  accent: string;
  onNavigate: (tab: PexTab) => void;
}) {
  const title = rtl ? node.titleFa : node.titleEn;
  const sub = rtl ? node.subFa : node.subEn;
  const isCross = node.kind === "cross";
  const inner = (
    <>
      <span
        aria-hidden="true"
        className="absolute end-0 top-2 bottom-2 w-[3px] rounded-full"
        style={{ background: isCross ? C_CROSS : accent, opacity: isCross ? 0.75 : 0.9 }}
      />
      <span className="block text-[11px] font-medium leading-4 text-start tx1">{title}</span>
      {sub && <span className="mt-1 block text-[9.5px] font-light leading-4 text-start tx3">{sub}</span>}
      {isCross && (
        <span
          className="mt-1.5 block w-fit rounded-full px-2 py-px text-[8px] font-medium"
          style={{ background: `${C_CROSS}22`, color: "var(--ink)" }}
        >
          {rtl ? "بین‌ماژولی" : "cross-module"}
        </span>
      )}
    </>
  );
  const cls = `relative flex w-full flex-1 flex-col justify-center overflow-hidden rounded-xl border px-3 py-2 text-start transition ${
    isCross
      ? "border-dashed"
      : "border-solid"
  }`;
  const style = {
    background: isCross ? `${C_CROSS}12` : node.kind === "proc" ? `${accent}1a` : "var(--row)",
    borderColor: isCross ? `${C_CROSS}55` : node.kind === "proc" ? `${accent}55` : "var(--line-soft)",
  };
  if (!node.tab) {
    return <div className={cls} style={style} aria-label={title}>{inner}</div>;
  }
  return (
    <button
      type="button"
      className={`${cls} cursor-pointer hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70`}
      style={{ ...style, transitionProperty: "transform, box-shadow, border-color, background-color" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accent}99`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isCross ? `${C_CROSS}55` : node.kind === "proc" ? `${accent}55` : "var(--line-soft)"; }}
      title={rtl ? `رفتن به «${title}»` : `Go to ${title}`}
      aria-label={rtl ? `رفتن به ${title}` : `Go to ${title}`}
      onClick={() => onNavigate(node.tab!)}
    >
      {inner}
    </button>
  );
}

/* آیکن‌های ستون‌ها به‌صورت SVG درون‌خطی تا به فونت ایموجی وابسته نباشند. */
const ICONS: Record<string, ReactElement> = {
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

function ColumnHead({ fa, en, rtl, color, icon }: { fa: string; en: string; rtl: boolean; color: string; icon: keyof typeof ICONS }) {
  return (
    <div
      className="flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-[10.5px] font-medium text-white"
      style={{ background: `linear-gradient(180deg, ${color}, ${color}cc)`, boxShadow: `0 6px 16px -8px ${color}` }}
    >
      <span aria-hidden="true" className="inline-flex">{ICONS[icon]}</span>
      <span>{rtl ? fa : en}</span>
    </div>
  );
}

export default function PlanningWorkflowMap({
  rtl,
  onNavigate,
}: {
  rtl: boolean;
  onNavigate: (tab: PexTab) => void;
}) {
  const arrow = "flex items-center justify-center text-[12px] leading-none tx4";
  const gridCols = "grid-cols-[1.25fr_20px_1.05fr_20px_1.25fr_20px_1.1fr]";
  return (
    <section
      dir="ltr"
      aria-label={rtl ? "نقشهٔ گردش‌کار برنامه‌ریزی و کنترل پروژه" : "EPC planning and control workflow map"}
      className="rounded-2xl border b-line bg-[var(--row)] p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h3 className="text-[13px] font-medium tx1">
          {rtl ? "گردش‌کار برنامه‌ریزی و کنترل پروژه (EPC)" : "EPC planning and control workflow"}
        </h3>
        <span className="text-[9.5px] font-light tx3">
          {rtl ? "با کلیک روی هر گره، به همان زیربخش بروید" : "Click a node to open its section"}
        </span>
      </div>

      {/* سرستون‌ها — نوار رنگی هر ستون */}
      <div className={`mt-3 grid ${gridCols}`}>
        <ColumnHead fa="ورودی‌ها" en="Inputs" rtl={rtl} color={C_INPUT} icon="inputs" />
        <div />
        <ColumnHead fa="هاب داده" en="Data hub" rtl={rtl} color={C_HUB} icon="hub" />
        <div />
        <ColumnHead fa="چرخهٔ به‌روزرسانی PMS" en="PMS update cycle" rtl={rtl} color={C_CYCLE} icon="cycle" />
        <div />
        <ColumnHead fa="خروجی‌ها" en="Outputs" rtl={rtl} color={C_OUTPUT} icon="outputs" />
      </div>

      <div className={`mt-2 grid ${gridCols} items-stretch`}>
        {/* ورودی‌ها */}
        <div className="flex flex-col gap-2">
          {INPUTS.map((node) => (
            <NodeBox key={node.titleEn} node={node} rtl={rtl} accent={C_INPUT} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="flex flex-col">
          {INPUTS.map((node) => (
            <div key={node.titleEn} className={`${arrow} flex-1`}>→</div>
          ))}
        </div>

        {/* هاب داده */}
        <button
          type="button"
          onClick={() => onNavigate("workshop")}
          title={rtl ? "رفتن به «کارگاه برنامه‌ریزی»" : "Go to Planning Workshop"}
          className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border px-3 py-3 text-center transition hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
          style={{ background: `${C_HUB}18`, borderColor: `${C_HUB}66` }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${C_HUB}aa`; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${C_HUB}66`; }}
        >
          <span aria-hidden="true" className="absolute end-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: C_HUB, opacity: 0.9 }} />
          <span className="text-[12.5px] font-medium leading-5 tx1">{rtl ? "لایهٔ یکپارچهٔ دادهٔ پروژه" : "Project database"}</span>
          <span className="mt-1 text-[9.5px] font-light leading-4 tx3">
            {rtl ? "اتصال ماژول‌ها با API و کانکتورها · اعتبارسنجی داده · قواعد پیشرفت (ROC) · قفل دوره‌های بسته" : "Validated data hub"}
          </span>
        </button>
        <div className="flex flex-col">
          {CYCLE.map((node) => (
            <div key={node.titleEn} className={`${arrow} flex-1`}>→</div>
          ))}
        </div>

        {/* چرخهٔ به‌روزرسانی */}
        <div className="flex flex-col gap-2">
          {CYCLE.map((node, i) => (
            <div key={node.titleEn} className="flex flex-1 flex-col gap-2">
              <NodeBox node={node} rtl={rtl} accent={C_CYCLE} onNavigate={onNavigate} />
              {i < CYCLE.length - 1 && <div className="text-center text-[12px] leading-3 tx4">↓</div>}
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          {OUTPUTS.map((node) => (
            <div key={node.titleEn} className={`${arrow} flex-1`}>→</div>
          ))}
        </div>

        {/* خروجی‌ها */}
        <div className="flex flex-col gap-2">
          {OUTPUTS.map((node) => (
            <NodeBox key={node.titleEn} node={node} rtl={rtl} accent={C_OUTPUT} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {/* حلقهٔ حاکمیت و کنترل */}
      <div className="relative mt-5 rounded-2xl border border-dashed b-line px-3 pb-3 pt-4">
        <span className="absolute -top-2 start-5 rounded-full border b-line bg-[var(--bg-b)] px-2 text-[9.5px] tx3">
          {rtl ? "حلقهٔ حاکمیت و کنترل" : "Governance and control loop"}
        </span>
        <div className="grid grid-cols-[1fr_20px_1fr_20px_1fr_20px_1fr] items-stretch">
          <NodeBox node={{ titleFa: "اجرای سایت", titleEn: "Site execution", subFa: "اقدام‌های جبرانی", subEn: "Recovery actions", tab: "dpr", kind: "io" }} rtl={rtl} accent={C_OUTPUT} onNavigate={onNavigate} />
          <div className={arrow}>←</div>
          <NodeBox node={{ titleFa: "اقدام اصلاحی", titleEn: "Corrective plan", subFa: "مالک اقدام و موعد انجام", subEn: "Owner and due date", tab: "alerts", kind: "proc" }} rtl={rtl} accent={C_CYCLE} onNavigate={onNavigate} />
          <div className={arrow}>←</div>
          <NodeBox node={{ titleFa: "جلسات بازبینی", titleEn: "Review meetings", subFa: "هفتگی و ماهانه", subEn: "Weekly and monthly", tab: "alerts", kind: "proc" }} rtl={rtl} accent={C_CYCLE} onNavigate={onNavigate} />
          <div className={arrow}>→</div>
          <NodeBox node={{ titleFa: "کارفرما و PMO", titleEn: "Client and PMO", subFa: "بازبینی و تأیید وضعیت", subEn: "Status review", tab: "mpr", kind: "io" }} rtl={rtl} accent={C_OUTPUT} onNavigate={onNavigate} />
        </div>
        <p className="mt-2 text-center text-[9px] font-light tx4">
          {rtl ? "↺ اقدام‌های جبرانی دوباره به‌عنوان ورودی به گزارش‌های سایت و چرخهٔ به‌روزرسانی برمی‌گردد." : "↺ Recovery actions feed back into site reports and the next update cycle."}
        </p>
      </div>

      {/* راهنما */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 text-[9.5px] font-light tx3">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[4px]" style={{ background: "var(--row)", border: "1px solid var(--line-soft)" }} />
          {rtl ? "ورودی‌ها و خروجی‌ها" : "Inputs and outputs"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[4px]" style={{ background: `${C_CYCLE}33`, border: `1px solid ${C_CYCLE}88` }} />
          {rtl ? "پردازش و کنترل" : "Processing and control"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[4px]" style={{ background: `${C_CROSS}22`, border: `1px dashed ${C_CROSS}88` }} />
          {rtl ? "ورودی بین‌ماژولی" : "Cross-module input"}
        </span>
      </div>
    </section>
  );
}
