import type { Lang } from "../data/framework";
import ModuleWorkspaceShell, { moduleCardCls, moduleChipCls } from "./ModuleWorkspaceShell";

export type ScmSubModuleId =
  | "inventory"
  | "purchasing"
  | "crm"
  | "movements"
  | "finance";

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
    descFa: "تبدیل پیشنهادهای تأمین MRP به درخواست خرید (PR)، استعلام بها (RFQ)، ارزیابی تأمین‌کنندگان و صدور سفارش خرید (PO).",
    descEn: "Convert MRP procurement proposals into Purchase Requisitions (PR), RFQs, vendor evaluation, and Purchase Orders (PO).",
    plannedEntities: ["ScmPurchaseRequisition", "ScmPurchaseOrder", "ScmVendor"],
  },
  {
    id: "crm",
    icon: "🤝",
    fa: "فروش و مدیریت مشتریان (CRM)",
    en: "Sales & Customer Relationship Management (CRM)",
    descFa: "مدیریت پروندهٔ مشتریان، پیش‌فاکتورها، قراردادهای فروش، سفارش‌های مشتری (Sales Orders) و پیگیری تعهدات تحویل.",
    descEn: "Customer accounts, quotations, sales contracts, customer sales orders, and delivery commitment tracking.",
    plannedEntities: ["CrmCustomer", "CrmQuotation", "ScmSalesOrder"],
  },
  {
    id: "movements",
    icon: "🚚",
    fa: "ورود و خروج کالا (رسید / حواله)",
    en: "Goods Receipt & Issue (GRN / GIN)",
    descFa: "ثبت رسید موقت و قطعی انبار، قرنطینهٔ کنترل کیفیت ورودی (IQC)، حوالهٔ مصرف به خطوط تولید و ارسال به مشتری.",
    descEn: "Goods Receipt Notes (GRN), incoming QC quarantine, shop-floor Goods Issue Notes (GIN), and customer shipments.",
    plannedEntities: ["ScmGoodsReceipt", "ScmGoodsIssue", "ScmStockTransfer"],
  },
  {
    id: "finance",
    icon: "💳",
    fa: "حسابداری و هزینه‌یابی مالی",
    en: "Financial Accounting & Costing",
    descFa: "دفتر کل و اسناد حسابداری، تطبیق بهای تمام‌شدهٔ تولید و موجودی انبار، حساب‌های دریافتنی/پرداختنی (AR/AP) و صورت‌های مالی.",
    descEn: "General ledger, manufacturing & inventory cost reconciliation, accounts receivable/payable (AR/AP), and financial statements.",
    plannedEntities: ["FinLedgerEntry", "FinInvoice", "FinCostCenterSnapshot"],
  },
];

interface Props {
  lang: Lang;
  activeSub: ScmSubModuleId;
  onSelectSub: (sub: ScmSubModuleId) => void;
  onBackHome?: () => void;
}

/** رنگ تأکیدی SCM (هم‌خوان با تیل قبلی). */
const SCM_ACCENT = "#2dd4bf";

export default function ScmWorkspaceShell({ lang, activeSub, onSelectSub, onBackHome }: Props) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const current = SCM_SUBMODULES.find((s) => s.id === activeSub) ?? SCM_SUBMODULES[0];

  return (
    <ModuleWorkspaceShell
      lang={lang}
      accent={SCM_ACCENT}
      icon="📦"
      title={tr(
        "سامانهٔ زنجیره تأمین، بازرگانی و مالی (SCM & Finance)",
        "Supply Chain, Commercial & Financial System (SCM & Finance)",
      )}
      subtitle={tr(
        "سرگروه چهارم سازمان · مدیریت یکپارچهٔ انبار، تدارکات، فروش (CRM) و حسابداری مالی",
        "Organizational Pillar #4 · Integrated warehousing, procurement, CRM sales, and financial accounting",
      )}
      badges={
        <span className="rounded-md border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[10px] text-teal-300">
          {tr("پوستهٔ اولیه (Workspace Shell)", "Workspace Shell")}
        </span>
      }
      onBack={onBackHome}
      navTitle={tr("زیرماژول‌های SCM", "SCM Submodules")}
      navItems={SCM_SUBMODULES.map((item) => ({
        id: item.id,
        label: fa ? item.fa : item.en,
        icon: item.icon,
      }))}
      activeId={current.id}
      onSelect={onSelectSub}
      panelTitle={fa ? current.fa : current.en}
      panelIcon={current.icon}
      panelDesc={fa ? current.descFa : current.descEn}
      panelMeta={<span className={moduleChipCls} dir="ltr">module: scm-finance / {current.id}</span>}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className={`${moduleCardCls} space-y-1 p-3.5`}>
          <div className="tx3 text-xs">{tr("وضعیت زیرماژول", "Submodule Status")}</div>
          <div className="tx1 font-semibold text-sm text-teal-300">
            {tr("پوستهٔ آماده (Placeholder Shell)", "Placeholder Shell Ready")}
          </div>
          <p className="tx3 text-[11px]">
            {tr(
              "ساختار ناوبری و رابط کاربری اولیه ایجاد شده است و منطق دامنه و API در فازهای آتی متصل می‌شود.",
              "UI shell and navigation are wired; domain logic and APIs will be connected in upcoming phases.",
            )}
          </p>
        </div>

        <div className={`${moduleCardCls} space-y-1 p-3.5`}>
          <div className="tx3 text-xs">{tr("موجودیت‌های هدف در دیتابیس", "Target Domain Entities")}</div>
          <div className="flex flex-wrap gap-1.5 pt-1" dir="ltr">
            {current.plannedEntities.map((ent) => (
              <span key={ent} className="rounded border b-line-soft bg-black/25 px-2 py-0.5 text-xs tx2">
                {ent}
              </span>
            ))}
          </div>
        </div>

        <div className={`${moduleCardCls} space-y-1 p-3.5`}>
          <div className="tx3 text-xs">{tr("یکپارچگی با سایر بخش‌های سازمان", "Cross-System Integration")}</div>
          <div className="tx2 text-xs leading-5">
            {tr(
              "تبدیل سفارش‌های فروش CRM به سفارش تولید (MES)، دریافت پیشنهادهای خرید MRP و تطبیق سند مالی بهای تمام‌شده.",
              "Feeds CRM sales orders into MES production orders, processes MRP purchase proposals, and reconciles financial cost ledgers.",
            )}
          </div>
        </div>
      </div>
    </ModuleWorkspaceShell>
  );
}
