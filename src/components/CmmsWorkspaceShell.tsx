import type { Lang } from "../data/framework";

export type CmmsSubModuleId =
  | "assets"
  | "pm"
  | "work-orders"
  | "spares"
  | "analytics";

export const CMMS_SUBMODULES: Array<{
  id: CmmsSubModuleId;
  icon: string;
  fa: string;
  en: string;
  descFa: string;
  descEn: string;
  plannedEntities: string[];
}> = [
  {
    id: "assets",
    icon: "⚙️",
    fa: "شناسنامه تجهیزات و دارایی‌ها",
    en: "Equipment & Asset Registry",
    descFa: "درخت تجهیزات کارخانه، مشخصات فنی، محل استقرار، وضعیت بهره‌برداری و تاریخچهٔ کارکرد ماشین‌آلات.",
    descEn: "Plant asset hierarchy, technical specs, location, operational state, and runtime history.",
    plannedEntities: ["CmmsAsset", "CmmsAssetClass", "CmmsMeterReading"],
  },
  {
    id: "pm",
    icon: "🗓️",
    fa: "برنامه‌ریزی نت پیشگیرانه (PM)",
    en: "Preventive Maintenance (PM)",
    descFa: "تعریف سرویس‌های دوره‌ای مبتنی بر زمان یا کارکرد، چک‌لیست‌های بازرسی و تولید خودکار برنامهٔ نت.",
    descEn: "Time-based and meter-based preventive maintenance schedules and inspection checklists.",
    plannedEntities: ["CmmsPmSchedule", "CmmsPmTaskList", "CmmsPmCalendar"],
  },
  {
    id: "work-orders",
    icon: "🛠️",
    fa: "دستور کار تعمیرات (Work Order)",
    en: "Maintenance Work Orders",
    descFa: "ثبت درخواست تعمیرات اضطراری (EM) و برنامه‌ریزی‌شده، تخصیص تکنسین، ثبت نفرساعت و بستن دستور کار.",
    descEn: "Corrective & emergency work orders, technician dispatch, labor hours, and completion sign-off.",
    plannedEntities: ["CmmsWorkOrder", "CmmsWorkOrderLabor", "CmmsFailureLog"],
  },
  {
    id: "spares",
    icon: "🔩",
    fa: "قطعات یدکی و ابزارها",
    en: "Spare Parts & Tooling",
    descFa: "فهرست قطعات یدکی بحرانی (BOM تعمیراتی)، نقطهٔ سفارش قطعات یدکی و رزرو ابزارهای ویژه.",
    descEn: "Spare parts catalog, maintenance BOM, minimum stock thresholds, and special tooling.",
    plannedEntities: ["CmmsSparePart", "CmmsAssetSpareLink", "CmmsSpareIssue"],
  },
  {
    id: "analytics",
    icon: "📊",
    fa: "شاخص‌ها و تحلیل نت (MTBF / MTTR)",
    en: "Maintenance KPIs (MTBF / MTTR)",
    descFa: "پایش میانگین زمان بین خرابی‌ها (MTBF)، میانگین زمان تعمیر (MTTR)، دسترس‌پذیری تجهیزات و هزینهٔ نت.",
    descEn: "Mean Time Between Failures (MTBF), Mean Time To Repair (MTTR), availability, and maintenance cost.",
    plannedEntities: ["CmmsReliabilitySnapshot", "CmmsDowntimeBridge"],
  },
];

interface Props {
  lang: Lang;
  activeSub: CmmsSubModuleId;
  onSelectSub: (sub: CmmsSubModuleId) => void;
  onBackHome?: () => void;
}

export default function CmmsWorkspaceShell({ lang, activeSub, onSelectSub, onBackHome }: Props) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const current = CMMS_SUBMODULES.find((s) => s.id === activeSub) ?? CMMS_SUBMODULES[0];

  return (
    <div dir={fa ? "rtl" : "ltr"} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
      <header className="glass-dark rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-lg">
            🔧
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="tx1 font-semibold text-sm">
                {tr("سامانهٔ نگهداری و تعمیرات (CMMS)", "Computerized Maintenance Management System (CMMS)")}
              </h2>
              <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                {tr("پوستهٔ اولیه (Workspace Shell)", "Workspace Shell")}
              </span>
            </div>
            <p className="tx3 text-xs mt-0.5">
              {tr(
                "بخش سوم سازمان · آمادهٔ پیاده‌سازی منطق دامنه و API پس از تکمیل فاز ۴ ماژول تولید (MES)",
                "Organizational Pillar #3 · Ready for domain & API implementation after MES Phase 4",
              )}
            </p>
          </div>
        </div>
        {onBackHome && (
          <button
            type="button"
            onClick={onBackHome}
            className="rounded-lg border b-line-soft px-3 py-1.5 text-xs tx2 hover:tx1"
          >
            {tr("بازگشت به نمای اصلی", "Back to Hub")}
          </button>
        )}
      </header>

      {/* نوار تب‌های ۵گانهٔ CMMS */}
      <nav className="flex flex-wrap gap-1.5">
        {CMMS_SUBMODULES.map((item) => {
          const active = item.id === current.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSub(item.id)}
              className={`rounded-lg border b-line-soft px-3 py-1.5 text-xs transition flex items-center gap-1.5 ${
                active ? "toggle-on tx1 font-medium" : "tx2 hover:tx1"
              }`}
            >
              <span>{item.icon}</span>
              <span>{fa ? item.fa : item.en}</span>
            </button>
          );
        })}
      </nav>

      {/* نمای پوستهٔ زیرماژول انتخاب‌شده */}
      <section className="glass-dark rounded-2xl p-5 space-y-4 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b b-line-soft pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{current.icon}</span>
            <div>
              <h3 className="tx1 font-semibold text-base">{fa ? current.fa : current.en}</h3>
              <p className="tx3 text-xs mt-0.5">{fa ? current.descFa : current.descEn}</p>
            </div>
          </div>
          <span className="rounded-lg border b-line-soft bg-black/20 px-2.5 py-1 text-[11px] tx3" dir="ltr">
            module: cmms / {current.id}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-1">
            <div className="tx3 text-xs">{tr("وضعیت زیرماژول", "Submodule Status")}</div>
            <div className="tx1 font-semibold text-sm text-amber-300">
              {tr("پوستهٔ آماده (Placeholder Shell)", "Placeholder Shell Ready")}
            </div>
            <p className="tx3 text-[11px]">
              {tr(
                "ساختار ناوبری و رابط کاربری اولیه ایجاد شده است و منطق بک‌اند پس از پایان ماژول تولید افزوده می‌شود.",
                "UI shell and navigation are wired; backend logic will be added after MES completion.",
              )}
            </p>
          </div>

          <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-1">
            <div className="tx3 text-xs">{tr("موجودیت‌های هدف در دیتابیس", "Target Domain Entities")}</div>
            <div className="flex flex-wrap gap-1.5 pt-1" dir="ltr">
              {current.plannedEntities.map((ent) => (
                <span key={ent} className="rounded border b-line-soft bg-black/25 px-2 py-0.5 text-xs tx2">
                  {ent}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-1">
            <div className="tx3 text-xs">{tr("یکپارچگی با سایر بخش‌های سازمان", "Cross-System Integration")}</div>
            <div className="tx2 text-xs leading-5">
              {tr(
                "تبادل وضعیت توقف ماشین‌آلات و تقویم تعمیرات با سامانهٔ تولید (MES) و تأمین قطعات یدکی از طریق انبار (SCM).",
                "Syncs machine downtime & PM windows with MES and spare parts requisitions with SCM.",
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
