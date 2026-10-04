import type { Lang } from "../data/framework";

export type ScmSubModuleId =
  | "inventory"
  | "purchasing"
  | "vendors"
  | "movements"
  | "dashboard";

export const SCM_SUBMODULES: Array<{
  id: ScmSubModuleId;
  icon: string;
  fa: string;
  en: string;
  descFa: string;
  descEn: string;
  plannedEntities: string[];
}> = [
  {
    id: "inventory",
    icon: "🏬",
    fa: "مدیریت انبارها و موجودی",
    en: "Warehouses & Inventory Management",
    descFa: "مدیریت انبارهای مرکزی و پای‌خط، جانمایی قفسه/سلول، کنترل بچ/لات، انبارگردانی و نقطهٔ سفارش.",
    descEn: "Central and line-side warehouses, bin locations, lot tracking, cycle counts, and reorder points.",
    plannedEntities: ["ScmWarehouse", "ScmBinLocation", "ScmStockBalance"],
  },
  {
    id: "purchasing",
    icon: "🧾",
    fa: "درخواست و سفارشات خرید",
    en: "Purchase Requisitions & Orders",
    descFa: "تبدیل پیشنهادهای تأمین MRP به درخواست خرید (PR)، استعلام بها (RFQ) و صدور سفارش خرید (PO).",
    descEn: "Convert MRP procurement proposals into Purchase Requisitions (PR), RFQs, and Purchase Orders (PO).",
    plannedEntities: ["ScmPurchaseRequisition", "ScmPurchaseOrder", "ScmPurchaseOrderLine"],
  },
  {
    id: "vendors",
    icon: "🤝",
    fa: "مدیریت تأمین‌کنندگان",
    en: "Supplier & Vendor Management",
    descFa: "پروندهٔ تأمین‌کنندگان مجاز (AVL)، ارزیابی عملکرد تحویل به‌موقع (OTD)، کیفیت محموله و زمان تدارک.",
    descEn: "Approved Vendor List (AVL), on-time delivery (OTD) scoring, quality rating, and lead-time tracking.",
    plannedEntities: ["ScmVendor", "ScmVendorScorecard", "ScmPriceAgreement"],
  },
  {
    id: "movements",
    icon: "🚚",
    fa: "ورود و خروج کالا (رسید / حواله)",
    en: "Goods Receipt & Issue (GRN / GIN)",
    descFa: "ثبت رسید موقت و قطعی انبار، قرنطینهٔ کنترل کیفیت ورودی (IQC)، حوالهٔ مصرف به خطوط تولید و انتقال بین‌انباری.",
    descEn: "Goods Receipt Notes (GRN), incoming QC quarantine, shop-floor Goods Issue Notes (GIN), and transfers.",
    plannedEntities: ["ScmGoodsReceipt", "ScmGoodsIssue", "ScmStockTransfer"],
  },
  {
    id: "dashboard",
    icon: "📈",
    fa: "داشبورد زنجیره تأمین",
    en: "Supply Chain Analytics Dashboard",
    descFa: "پایش نرخ گردش موجودی، ارزش ریالی انبار، سفارش‌های خرید معوق، ریسک کسری مواد و عملکرد تأمین‌کنندگان.",
    descEn: "Inventory turnover, stock valuation, open PO aging, shortage risk, and supplier KPIs.",
    plannedEntities: ["ScmKpiSnapshot", "ScmLeadTimeVariance"],
  },
];

interface Props {
  lang: Lang;
  activeSub: ScmSubModuleId;
  onSelectSub: (sub: ScmSubModuleId) => void;
  onBackHome?: () => void;
}

export default function ScmWorkspaceShell({ lang, activeSub, onSelectSub, onBackHome }: Props) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const current = SCM_SUBMODULES.find((s) => s.id === activeSub) ?? SCM_SUBMODULES[0];

  return (
    <div dir={fa ? "rtl" : "ltr"} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
      <header className="glass-dark rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-lg">
            📦
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="tx1 font-semibold text-sm">
                {tr("سامانهٔ زنجیره تأمین و انبارداری (SCM)", "Supply Chain & Warehouse Management System (SCM)")}
              </h2>
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                {tr("پوستهٔ اولیه (Workspace Shell)", "Workspace Shell")}
              </span>
            </div>
            <p className="tx3 text-xs mt-0.5">
              {tr(
                "بخش چهارم سازمان · آمادهٔ پیاده‌سازی منطق دامنه و API پس از تکمیل فاز ۴ ماژول تولید (MES)",
                "Organizational Pillar #4 · Ready for domain & API implementation after MES Phase 4",
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

      {/* نوار تب‌های ۵گانهٔ SCM */}
      <nav className="flex flex-wrap gap-1.5">
        {SCM_SUBMODULES.map((item) => {
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
            module: scm / {current.id}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-1">
            <div className="tx3 text-xs">{tr("وضعیت زیرماژول", "Submodule Status")}</div>
            <div className="tx1 font-semibold text-sm text-emerald-300">
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
                "دریافت پیشنهادهای خرید ناشی از کمبود MRP تولید (MES)، تأمین قطعات یدکی نت (CMMS) و تدارکات پروژه‌ها (PMIS).",
                "Consumes MRP procurement proposals from MES, spare part requests from CMMS, and project procurement from PMIS.",
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
