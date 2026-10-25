/**
 * نقشهٔ گردش‌کار برنامه‌ریزی و کنترل پروژه (EPC) — بالای داشبورد برنامه‌ریزی.
 * ═══════════════════════════════════════════════════════════════════════
 * چیدمان چهار ستون (ورودی‌ها ← هاب داده ← چرخهٔ به‌روزرسانی ← خروجی‌ها)
 * با زبان بصری «نقشهٔ فرایندی ماژول‌ها»: سرستون رنگیِ هر ستون، کارت‌های
 * تیره با نوار رنگی در لبه، گره‌های بین‌ماژولی خط‌چین و حلقهٔ حاکمیت در پایین.
 * گره‌های داخل ماژول کلیک‌پذیرند و به زیربخش مربوط می‌روند؛ گره‌های
 * بین‌ماژولی (تأمین، کیفیت) کلیک ندارند.
 *
 * اجزای مشترک بصری در `WorkflowMapKit.tsx` است تا نقشهٔ گردش‌کار کنترل
 * پروژه (d6) دقیقاً همین جلوه را داشته باشد.
 */
import type { PexTab } from "./PlanningWorkspace";
import {
  WF_COLOR,
  WorkflowColumnHead,
  WorkflowLegend,
  WorkflowMapFrame,
  WorkflowMapNode,
  WorkflowNodeBox,
} from "./WorkflowMapKit";

interface MapNode extends WorkflowMapNode {
  tab?: PexTab;
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

const C_INPUT = WF_COLOR.input;
const C_HUB = WF_COLOR.hub;
const C_CYCLE = WF_COLOR.cycle;
const C_OUTPUT = WF_COLOR.output;

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
    <WorkflowMapFrame
      title={rtl ? "گردش‌کار برنامه‌ریزی و کنترل پروژه (EPC)" : "EPC planning and control workflow"}
      hint={rtl ? "با کلیک روی هر گره، به همان زیربخش بروید" : "Click a node to open its section"}
    >
      {/* سرستون‌ها — نوار رنگی هر ستون */}
      <div className={`mt-2 grid ${gridCols}`}>
        <WorkflowColumnHead fa="ورودی‌ها" en="Inputs" rtl={rtl} color={C_INPUT} icon="inputs" />
        <div />
        <WorkflowColumnHead fa="هاب داده" en="Data hub" rtl={rtl} color={C_HUB} icon="hub" />
        <div />
        <WorkflowColumnHead fa="چرخهٔ به‌روزرسانی PMS" en="PMS update cycle" rtl={rtl} color={C_CYCLE} icon="cycle" />
        <div />
        <WorkflowColumnHead fa="خروجی‌ها" en="Outputs" rtl={rtl} color={C_OUTPUT} icon="outputs" />
      </div>

      <div className={`mt-2 grid ${gridCols} items-stretch`}>
        {/* ورودی‌ها */}
        <div className="flex flex-col gap-1">
          {INPUTS.map((node) => (
            <WorkflowNodeBox dense
              key={node.titleEn}
              node={node}
              rtl={rtl}
              accent={C_INPUT}
              grow={node.kind === "cross" ? 1.5 : 0.8}
              onNavigate={node.tab ? () => onNavigate(node.tab!) : undefined}
            />
          ))}
        </div>
        <div className="flex flex-col">
          {INPUTS.map((node) => (
            <div key={node.titleEn} className={`${arrow} flex-1`} style={{ flexGrow: node.kind === "cross" ? 1.5 : 0.8 }}>→</div>
          ))}
        </div>

        {/* هاب داده */}
        <button
          type="button"
          onClick={() => onNavigate("workshop")}
          title={rtl ? "رفتن به «کارگاه برنامه‌ریزی»" : "Go to Planning Workshop"}
          className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border px-2 py-2 text-center transition hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
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
        <div className="flex flex-col gap-1">
          {CYCLE.map((node, i) => (
            <div key={node.titleEn} className="flex flex-1 flex-col gap-1">
              <WorkflowNodeBox dense node={node} rtl={rtl} accent={C_CYCLE} onNavigate={node.tab ? () => onNavigate(node.tab!) : undefined} />
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
        <div className="flex flex-col gap-1">
          {OUTPUTS.map((node) => (
            <WorkflowNodeBox dense
              key={node.titleEn}
              node={node}
              rtl={rtl}
              accent={C_OUTPUT}
              onNavigate={node.tab ? () => onNavigate(node.tab!) : undefined}
            />
          ))}
        </div>
      </div>

      {/* حلقهٔ حاکمیت و کنترل */}
      <div className="relative mt-3 rounded-2xl border border-dashed b-line px-2 pb-2 pt-3">
        <span className="absolute -top-2 start-5 rounded-full border b-line bg-[var(--bg-b)] px-2 text-[9.5px] tx3">
          {rtl ? "حلقهٔ حاکمیت و کنترل" : "Governance and control loop"}
        </span>
        <div className="grid grid-cols-[1fr_20px_1fr_20px_1fr_20px_1fr] items-stretch">
          <WorkflowNodeBox dense node={{ titleFa: "اجرای سایت", titleEn: "Site execution", subFa: "اقدام‌های جبرانی", subEn: "Recovery actions", kind: "io" }} rtl={rtl} accent={C_OUTPUT} onNavigate={() => onNavigate("dpr")} />
          <div className={arrow}>←</div>
          <WorkflowNodeBox dense node={{ titleFa: "اقدام اصلاحی", titleEn: "Corrective plan", subFa: "مالک اقدام و موعد انجام", subEn: "Owner and due date", kind: "proc" }} rtl={rtl} accent={C_CYCLE} onNavigate={() => onNavigate("alerts")} />
          <div className={arrow}>←</div>
          <WorkflowNodeBox dense node={{ titleFa: "جلسات بازبینی", titleEn: "Review meetings", subFa: "هفتگی و ماهانه", subEn: "Weekly and monthly", kind: "proc" }} rtl={rtl} accent={C_CYCLE} onNavigate={() => onNavigate("alerts")} />
          <div className={arrow}>→</div>
          <WorkflowNodeBox dense node={{ titleFa: "کارفرما و PMO", titleEn: "Client and PMO", subFa: "بازبینی و تأیید وضعیت", subEn: "Status review", kind: "io" }} rtl={rtl} accent={C_OUTPUT} onNavigate={() => onNavigate("mpr")} />
        </div>
        <p className="mt-2 text-center text-[9px] font-light tx4">
          {rtl ? "↺ اقدام‌های جبرانی دوباره به‌عنوان ورودی به گزارش‌های سایت و چرخهٔ به‌روزرسانی برمی‌گردد." : "↺ Recovery actions feed back into site reports and the next update cycle."}
        </p>
      </div>

      <WorkflowLegend rtl={rtl} />
    </WorkflowMapFrame>
  );
}
