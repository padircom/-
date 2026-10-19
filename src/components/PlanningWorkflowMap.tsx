/**
 * نقشهٔ گردش‌کار برنامه‌ریزی و کنترل پروژه (EPC) — بالای داشبورد برنامه‌ریزی.
 * ═══════════════════════════════════════════════════════════════════════
 * چیدمان و رنگ‌ها عین فلوچارت مرجع کارفرما: چهار ستون چپ‌به‌راست
 * (ورودی‌ها ← هاب داده ← چرخهٔ به‌روزرسانی ← خروجی‌ها)، جعبه‌های پردازش
 * سبز نعنایی، ورودی/خروجی کرم، ورودی‌های بین‌ماژولی خط‌چین و حلقهٔ
 * حاکمیت خط‌چین در پایین. گره‌های داخل ماژول کلیک‌پذیرند و به زیربخش
 * مربوط می‌روند؛ گره‌های بین‌ماژولی (تأمین، کیفیت) کلیک ندارند.
 */
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

const boxCls: Record<MapNode["kind"], string> = {
  io: "border-[#c9cfc9] bg-[#efeee9] text-[#26332e]",
  proc: "border-[#57a773] bg-[#e2f2e7] text-[#17563a]",
  cross: "border-dashed border-[#b9a86a] bg-[#f7f4ec] text-[#6b5d24]",
};

function NodeBox({ node, rtl, onNavigate }: { node: MapNode; rtl: boolean; onNavigate: (tab: PexTab) => void }) {
  const title = rtl ? node.titleFa : node.titleEn;
  const sub = rtl ? node.subFa : node.subEn;
  const inner = (
    <>
      <span className="block text-[13px] font-bold leading-5">{title}</span>
      {sub && <span className="mt-0.5 block text-[10px] font-normal leading-4 opacity-70">{sub}</span>}
      {node.kind === "cross" && (
        <span className="mx-auto mt-1 block w-fit rounded-full bg-[#e7dfc8] px-2 py-px text-[8.5px] font-bold text-[#6b5d24]">
          {rtl ? "بین‌ماژولی" : "cross-module"}
        </span>
      )}
    </>
  );
  const cls = `flex w-full flex-1 flex-col items-center justify-center rounded-[10px] border-[1.5px] px-2.5 py-2 text-center ${boxCls[node.kind]}`;
  if (!node.tab) {
    return <div className={cls} aria-label={title}>{inner}</div>;
  }
  return (
    <button
      type="button"
      className={`${cls} cursor-pointer transition hover:shadow-md hover:brightness-[1.03] focus:outline-none focus:ring-2 focus:ring-[#57a773]`}
      title={rtl ? `رفتن به «${title}»` : `Go to ${title}`}
      aria-label={rtl ? `رفتن به ${title}` : `Go to ${title}`}
      onClick={() => onNavigate(node.tab!)}
    >
      {inner}
    </button>
  );
}

export default function PlanningWorkflowMap({
  rtl,
  onNavigate,
}: {
  rtl: boolean;
  onNavigate: (tab: PexTab) => void;
}) {
  const colHead = "text-center text-[11px] font-normal text-[#6b7a74]";
  const arrow = "flex items-center justify-center text-[13px] text-[#5c6f68]";
  return (
    <section
      dir="ltr"
      aria-label={rtl ? "نقشهٔ گردش‌کار برنامه‌ریزی و کنترل پروژه" : "EPC planning and control workflow map"}
      className="rounded-2xl border border-[#d8ded8] bg-[#f6f8f6] p-4 text-[#21322c] shadow-sm"
    >
      <h3 className="text-center text-[16px] font-extrabold text-[#1c2b26]">
        {rtl ? "گردش‌کار برنامه‌ریزی و کنترل پروژه (EPC)" : "EPC planning and control workflow"}
      </h3>

      {/* سرستون‌ها — عین شکل مرجع */}
      <div className="mt-3 grid grid-cols-[1.25fr_22px_1.05fr_22px_1.25fr_22px_1.1fr]">
        <div className={colHead}>{rtl ? "ورودی‌ها" : "Inputs"}</div>
        <div />
        <div className={colHead}>{rtl ? "هاب داده" : "Data hub"}</div>
        <div />
        <div className={colHead}>{rtl ? "چرخهٔ به‌روزرسانی PMS" : "PMS update cycle"}</div>
        <div />
        <div className={colHead}>{rtl ? "خروجی‌ها" : "Outputs"}</div>
      </div>

      <div className="mt-1.5 grid grid-cols-[1.25fr_22px_1.05fr_22px_1.25fr_22px_1.1fr] items-stretch">
        {/* ورودی‌ها */}
        <div className="flex flex-col gap-2">
          {INPUTS.map((node) => (
            <NodeBox key={node.titleEn} node={node} rtl={rtl} onNavigate={onNavigate} />
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
          className="flex flex-col items-center justify-center rounded-[10px] border-[1.5px] border-[#57a773] bg-[#e2f2e7] px-3 py-3 text-center text-[#17563a] transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#57a773]"
        >
          <span className="text-[15px] font-extrabold leading-6">{rtl ? "لایهٔ یکپارچهٔ دادهٔ پروژه" : "Project database"}</span>
          <span className="mt-1 text-[10px] leading-4 opacity-75">
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
              <NodeBox node={node} rtl={rtl} onNavigate={onNavigate} />
              {i < CYCLE.length - 1 && <div className="text-center text-[13px] leading-3 text-[#5c6f68]">↓</div>}
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
            <NodeBox key={node.titleEn} node={node} rtl={rtl} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {/* حلقهٔ حاکمیت و کنترل */}
      <div className="relative mt-5 rounded-[14px] border-[1.5px] border-dashed border-[#a9b6b0] px-3 pb-3 pt-4">
        <span className="absolute -top-2 left-5 bg-[#f6f8f6] px-2 text-[10.5px] text-[#6b7a74]">
          {rtl ? "حلقهٔ حاکمیت و کنترل" : "Governance and control loop"}
        </span>
        <div className="grid grid-cols-[1fr_22px_1fr_22px_1fr_22px_1fr] items-stretch">
          <NodeBox node={{ titleFa: "اجرای سایت", titleEn: "Site execution", subFa: "اقدام‌های جبرانی", subEn: "Recovery actions", tab: "dpr", kind: "io" }} rtl={rtl} onNavigate={onNavigate} />
          <div className={arrow}>←</div>
          <NodeBox node={{ titleFa: "اقدام اصلاحی", titleEn: "Corrective plan", subFa: "مالک اقدام و موعد انجام", subEn: "Owner and due date", tab: "alerts", kind: "proc" }} rtl={rtl} onNavigate={onNavigate} />
          <div className={arrow}>←</div>
          <NodeBox node={{ titleFa: "جلسات بازبینی", titleEn: "Review meetings", subFa: "هفتگی و ماهانه", subEn: "Weekly and monthly", tab: "alerts", kind: "proc" }} rtl={rtl} onNavigate={onNavigate} />
          <div className={arrow}>→</div>
          <NodeBox node={{ titleFa: "کارفرما و PMO", titleEn: "Client and PMO", subFa: "بازبینی و تأیید وضعیت", subEn: "Status review", tab: "mpr", kind: "io" }} rtl={rtl} onNavigate={onNavigate} />
        </div>
        <p className="mt-2 text-center text-[9.5px] text-[#7a8a84]">
          {rtl ? "↺ اقدام‌های جبرانی دوباره به‌عنوان ورودی به گزارش‌های سایت و چرخهٔ به‌روزرسانی برمی‌گردد." : "↺ Recovery actions feed back into site reports and the next update cycle."}
        </p>
      </div>

      {/* راهنما */}
      <div className="mt-3 flex flex-wrap gap-x-7 gap-y-1 text-[10px] text-[#55665f]">
        <span>
          <i className="ml-1.5 inline-block h-3 w-3 rounded-[4px] border-[1.5px] border-[#c9cfc9] bg-[#efeee9] align-[-2px]" />
          {rtl ? "ورودی‌ها و خروجی‌ها" : "Inputs and outputs"}
        </span>
        <span>
          <i className="ml-1.5 inline-block h-3 w-3 rounded-[4px] border-[1.5px] border-[#57a773] bg-[#e2f2e7] align-[-2px]" />
          {rtl ? "پردازش و کنترل" : "Processing and control"}
        </span>
        <span>
          <i className="ml-1.5 inline-block h-3 w-3 rounded-[4px] border-[1.5px] border-dashed border-[#b9a86a] bg-[#f7f4ec] align-[-2px]" />
          {rtl ? "ورودی بین‌ماژولی" : "Cross-module input"}
        </span>
        <span className="opacity-70">{rtl ? "با کلیک روی هر گره به زیربخش مربوط می‌روید." : "Click a node to open its section."}</span>
      </div>
    </section>
  );
}
