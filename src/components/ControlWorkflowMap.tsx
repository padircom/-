/**
 * نقشهٔ گردش‌کار پایش و کنترل پروژه — داخل ماژول «آغازین» (d6).
 * ═══════════════════════════════════════════════════════════════════════
 * همان جلوهٔ بصری نقشهٔ گردش‌کار برنامه‌ریزی (d2): چهار ستون رنگی
 * (ورودی‌ها ← هاب داده ← چرخهٔ کنترل ← خروجی‌ها)، کارت‌های تیره با نوار
 * رنگی لبه، گره‌های بین‌ماژولی خط‌چین، حلقهٔ حاکمیت در پایین و راهنما.
 *
 * تفاوت با نقشهٔ برنامه‌ریزی: گره‌ها اینجا به «ماژول» می‌روند (پایش و
 * کنترل، هزینه و تأمین، کیفیت، ریسک و تغییرات) چون نقشه در ماژول آغازین
 * است و ورودی‌هایش از ماژول‌های برنامه‌ریزی و پیمان می‌آید.
 */
import {
  WF_COLOR,
  WorkflowColumnHead,
  WorkflowLegend,
  WorkflowMapFrame,
  WorkflowMapNode,
  WorkflowNodeBox,
} from "./WorkflowMapKit";

interface ControlNode extends WorkflowMapNode {
  /** ماژول مقصد — نبودنش یعنی گرهٔ بین‌ماژولی و بدون کلیک. */
  moduleId?: string;
  processId?: string;
  subId?: string;
}

const INPUTS: ControlNode[] = [
  { titleFa: "برنامهٔ پایه و پیشرفت واقعی", titleEn: "Baseline & actual progress", subFa: "از ماژول برنامه‌ریزی", subEn: "From planning module", kind: "cross" },
  { titleFa: "گزارش روزانه و هفتگی سایت", titleEn: "Site reports", subFa: "ثبت پیشرفت و تاریخ‌های واقعی", subEn: "Progress and actual dates", kind: "cross" },
  { titleFa: "هزینهٔ واقعی و تعهدات پیمان", titleEn: "Actual cost & commitments", subFa: "هزینهٔ واقعی در برابر بودجه", subEn: "Actual cost vs budget", moduleId: "d5", processId: "d5-p2", subId: "d5-p2-s1", kind: "io" },
  { titleFa: "پیشرفت فیزیکی و برداشت احجام", titleEn: "Physical progress & measurement", subFa: "مقادیر اجراشده در دوره", subEn: "Measured quantities", moduleId: "d5", processId: "d5-p7", subId: "d5-p7-s2", kind: "io" },
  { titleFa: "نتایج بازرسی و عدم‌انطباق", titleEn: "Inspection & NCR results", subFa: "NCR و اقدام اصلاحی", subEn: "NCR and corrective action", moduleId: "d8", processId: "d8-p3", subId: "d8-p3-s1", kind: "io" },
  { titleFa: "ریسک‌ها، تغییرات و ادعاها", titleEn: "Risks, changes & claims", subFa: "ثبت و تحلیل ریسک", subEn: "Risk register", moduleId: "d4", processId: "d4-p1", subId: "d4-p1-s1", kind: "io" },
  { titleFa: "قراردادها و تضمین‌ها", titleEn: "Contracts & guarantees", subFa: "تعهدات پیمان — از ماژول پیمان", subEn: "Contractual commitments", kind: "cross" },
];

const CYCLE: ControlNode[] = [
  { titleFa: "پایش و اندازه‌گیری", titleEn: "Measure", subFa: "KPI پروژه، SPI و CPI", subEn: "Project KPIs, SPI & CPI", moduleId: "d3", processId: "d3-p1", subId: "d3-p1-s1", kind: "proc" },
  { titleFa: "تحلیل انحراف و ریشهٔ مشکل", titleEn: "Analyze", subFa: "PV / EV / AC و علت‌یابی", subEn: "PV / EV / AC, root cause", moduleId: "d3", processId: "d3-p3", subId: "d3-p3-s1", kind: "proc" },
  { titleFa: "هشدار زودهنگام و تصمیم", titleEn: "Warn & decide", subFa: "آستانهٔ هشدار و گیت تصمیم", subEn: "Alert thresholds, decision gate", moduleId: "d3", processId: "d3-p4", subId: "d3-p4-s1", kind: "proc" },
  { titleFa: "اقدام اصلاحی و اکشن‌پلن", titleEn: "Act", subFa: "اکشن‌پلن ۱، ۲ و ۳ ماهه", subEn: "1 / 2 / 3-month action plan", moduleId: "d3", processId: "d3-p5", subId: "d3-p5-s1", kind: "proc" },
];

const OUTPUTS: ControlNode[] = [
  { titleFa: "داشبورد کنترل عملکرد", titleEn: "Performance dashboard", subFa: "SPI / CPI و وضعیت کل پروژه", subEn: "SPI / CPI and project status", moduleId: "d3", processId: "d3-p1", subId: "d3-p1-s1", kind: "io" },
  { titleFa: "منحنی S و ارزش کسب‌شده (EVM)", titleEn: "S-curve & EVM", moduleId: "d3", processId: "d3-p2", subId: "d3-p2-s1", kind: "io" },
  { titleFa: "گزارش انحراف و تحلیل ریشه", titleEn: "Variance & root cause", moduleId: "d3", processId: "d3-p3", subId: "d3-p3-s1", kind: "io" },
  { titleFa: "مرکز هشدار و اقدام اصلاحی", titleEn: "Alert & corrective centre", moduleId: "d3", processId: "d3-p4", subId: "d3-p4-s1", kind: "io" },
  { titleFa: "گزارش مدیریتی زنده", titleEn: "Live management report", moduleId: "d3", processId: "d3-p6", subId: "d3-p6-s1", kind: "io" },
  { titleFa: "اکشن‌پلن و تعهدات", titleEn: "Action plan & commitments", moduleId: "d3", processId: "d3-p5", subId: "d3-p5-s1", kind: "io" },
  { titleFa: "وضعیت هزینه و بودجه", titleEn: "Cost & budget status", moduleId: "d5", processId: "d5-p1", subId: "d5-p1-s1", kind: "io" },
];

const C_INPUT = WF_COLOR.input;
const C_HUB = WF_COLOR.hub;
const C_CYCLE = WF_COLOR.cycle;
const C_OUTPUT = WF_COLOR.output;

export default function ControlWorkflowMap({
  rtl,
  onOpenModule,
}: {
  rtl: boolean;
  onOpenModule: (moduleId: string, processId?: string, subId?: string) => void;
}) {
  const arrow = "flex items-center justify-center text-[12px] leading-none tx4";
  const gridCols = "grid-cols-[1.25fr_20px_1.05fr_20px_1.25fr_20px_1.1fr]";
  const open = (node: ControlNode) =>
    node.moduleId ? () => onOpenModule(node.moduleId!, node.processId, node.subId) : undefined;

  return (
    <WorkflowMapFrame
      title={rtl ? "گردش‌کار پایش و کنترل پروژه" : "Project monitoring & control workflow"}
      hint={rtl ? "با کلیک روی هر گره، به ماژول مربوط بروید" : "Click a node to open its module"}
    >
      {/* سرستون‌ها — نوار رنگی هر ستون */}
      <div className={`mt-3 grid ${gridCols}`}>
        <WorkflowColumnHead fa="ورودی‌ها" en="Inputs" rtl={rtl} color={C_INPUT} icon="inputs" compact />
        <div />
        <WorkflowColumnHead fa="هاب داده" en="Data hub" rtl={rtl} color={C_HUB} icon="hub" compact />
        <div />
        <WorkflowColumnHead fa="چرخهٔ کنترل" en="Control cycle" rtl={rtl} color={C_CYCLE} icon="cycle" compact />
        <div />
        <WorkflowColumnHead fa="خروجی‌ها" en="Outputs" rtl={rtl} color={C_OUTPUT} icon="outputs" compact />
      </div>

      <div className={`mt-2 grid ${gridCols} items-stretch`}>
        {/* ورودی‌ها */}
        <div className="flex flex-col gap-2">
          {INPUTS.map((node) => (
            <WorkflowNodeBox key={node.titleEn} node={node} rtl={rtl} accent={C_INPUT} onNavigate={open(node)} compact />
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
          onClick={() => onOpenModule("d3", "d3-p1", "d3-p1-s1")}
          title={rtl ? "رفتن به «پایش و کنترل عملکرد پروژه»" : "Go to performance monitoring"}
          className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border px-2 py-1.5 text-center transition hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
          style={{ background: `${C_HUB}18`, borderColor: `${C_HUB}66` }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${C_HUB}aa`; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${C_HUB}66`; }}
        >
          <span aria-hidden="true" className="absolute end-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: C_HUB, opacity: 0.9 }} />
          <span className="text-[9.5px] font-medium leading-[13px] tx1">{rtl ? "لایهٔ یکپارچهٔ دادهٔ کنترل" : "Project control database"}</span>
          <span className="mt-px text-[7px] font-light leading-[9px] tx3">
            {rtl ? "اتصال ماژول‌های پایش، هزینه، کیفیت و ریسک با API · اعتبارسنجی داده · قواعد پیشرفت (ROC) · قفل دوره‌های بسته" : "Validated control data hub"}
          </span>
        </button>
        <div className="flex flex-col">
          {CYCLE.map((node) => (
            <div key={node.titleEn} className={`${arrow} flex-1`}>→</div>
          ))}
        </div>

        {/* چرخهٔ کنترل */}
        <div className="flex flex-col gap-2">
          {CYCLE.map((node, i) => (
            <div key={node.titleEn} className="flex flex-1 flex-col gap-2">
              <WorkflowNodeBox node={node} rtl={rtl} accent={C_CYCLE} onNavigate={open(node)} compact />
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
            <WorkflowNodeBox key={node.titleEn} node={node} rtl={rtl} accent={C_OUTPUT} onNavigate={open(node)} compact />
          ))}
        </div>
      </div>

      {/* حلقهٔ حاکمیت و کنترل */}
      <div className="relative mt-5 rounded-2xl border border-dashed b-line px-3 pb-3 pt-4">
        <span className="absolute -top-2 start-5 rounded-full border b-line bg-[var(--bg-b)] px-2 text-[9.5px] tx3">
          {rtl ? "حلقهٔ حاکمیت و کنترل" : "Governance and control loop"}
        </span>
        <div className="grid grid-cols-[1fr_20px_1fr_20px_1fr_20px_1fr] items-stretch">
          <WorkflowNodeBox
            node={{ titleFa: "اجرای سایت و بازگشت به داده", titleEn: "Site execution & data feed-back", subFa: "نتیجهٔ اقدام به چرخهٔ پایش برمی‌گردد", subEn: "Results feed the monitoring cycle", kind: "cross" }}
            rtl={rtl}
            accent={C_OUTPUT}
            compact
          />
          <div className={arrow}>←</div>
          <WorkflowNodeBox
            node={{ titleFa: "اقدام اصلاحی و پیگیری", titleEn: "Corrective action tracking", subFa: "مالک اقدام و موعد انجام", subEn: "Owner and due date", kind: "proc" }}
            rtl={rtl}
            accent={C_CYCLE}
            compact
            onNavigate={() => onOpenModule("d3", "d3-p5", "d3-p5-s1")}
          />
          <div className={arrow}>←</div>
          <WorkflowNodeBox
            node={{ titleFa: "تصمیم مدیریتی", titleEn: "Management decision", subFa: "بازبینی ماهانه و گیت تصمیم", subEn: "Monthly review, decision gate", kind: "proc" }}
            rtl={rtl}
            accent={C_CYCLE}
            compact
            onNavigate={() => onOpenModule("d3", "d3-p4", "d3-p4-s1")}
          />
          <div className={arrow}>→</div>
          <WorkflowNodeBox
            node={{ titleFa: "بازبینی عملکرد و کارفرما", titleEn: "Performance review & client", subFa: "تأیید وضعیت دوره", subEn: "Period status approval", kind: "io" }}
            rtl={rtl}
            accent={C_OUTPUT}
            compact
            onNavigate={() => onOpenModule("d3", "d3-p6", "d3-p6-s1")}
          />
        </div>
        <p className="mt-2 text-center text-[9px] font-light tx4">
          {rtl ? "↺ نتیجهٔ اقدام‌های اصلاحی دوباره به‌عنوان ورودی چرخهٔ پایش و گزارش‌های دوره‌ای ثبت می‌شود." : "↺ Corrective-action results are recorded as input to the next monitoring cycle and period report."}
        </p>
      </div>

      <WorkflowLegend rtl={rtl} />
    </WorkflowMapFrame>
  );
}
