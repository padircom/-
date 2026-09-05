import { t, type Lang } from "../data/framework";

type AlertItem = {
  id: string;
  title: { fa: string; en: string };
  module: { fa: string; en: string };
  severity: "critical" | "warning" | "info";
  time: string;
  source: string;
};

const alerts: AlertItem[] = [
  { id: "a1", title: { fa: "انحراف شاخص عملکرد زمان (SPI < 0.95) در فاز ۲", en: "Schedule performance index below threshold (SPI < 0.95) in Phase 2" }, module: { fa: "زمان‌بندی و EVM", en: "Schedule & EVM" }, severity: "critical", time: "۱۰ دقیقه پیش", source: "EVM_Transaction" },
  { id: "a2", title: { fa: "عدم تایید مدارک مهندسی پمپ‌های سانتریفیوژ بیش از ۱۴ روز", en: "Piping datasheet pending review for >14 days" }, module: { fa: "مدیریت اسناد EDMS", en: "EDMS" }, severity: "warning", time: "۱ ساعت پیش", source: "Document_Master" },
  { id: "a3", title: { fa: "احتمال وقوع ریسک تأخیر در تامین شیرآلات 24 اینچ (Long Lead)", en: "Long Lead Valve procurement risk elevated" }, module: { fa: "مدیریت ریسک", en: "Risk Register" }, severity: "critical", time: "۳ ساعت پیش", source: "Risk_Register" },
  { id: "a4", title: { fa: "موجود بودن کمتر از ۱۰٪ میلگرد سایز ۲۰ در کارگاه (نقطه سفارش)", en: "Rebar Size 20 stock below minimum reorder level" }, module: { fa: "کنترل انبار", en: "Inventory" }, severity: "warning", time: "امروز", source: "Material_Register" },
  { id: "a5", title: { fa: "توقف کارگاه زون B به‌دلیل عدم ابلاغ نقشه‌های اصلاحی", en: "Zone B site stoppage due to missing revised drawings" }, module: { fa: "گزارش روزانه", en: "Daily Report" }, severity: "critical", time: "امروز", source: "Daily_Report" },
];

const severityMeta = {
  critical: { fa: "بحرانی", en: "Critical", color: "#EF4444", bg: "rgba(239, 68, 68, 0.15)" },
  warning: { fa: "هشدار", en: "Warning", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)" },
  info: { fa: "اطلاعی", en: "Info", color: "#3B82F6", bg: "rgba(59, 130, 246, 0.15)" },
};

export default function AlertCenter({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";

  return (
    <div className="glass flex h-full min-h-0 flex-col rounded-2xl p-4" dir={rtl ? "rtl" : "ltr"}>
      <header className="b-line-soft mb-3 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-rose-400/40 bg-rose-400/10 text-[16px]">🔔</span>
          <div>
            <h2 className="text-[13px] font-medium tx1">{rtl ? "مرکز مدیریت هشدارهای زودهنگام (Early Warning Center)" : "Early Warning & Alert Center"}</h2>
            <p className="text-[9px] font-extralight tx3">{rtl ? "پایش زنده انحرافات زمان، هزینه، ریسک‌های بحرانی و گلوگاه‌های کارگاهی" : "Live tracking of schedule, cost, critical risks & site bottlenecks"}</p>
          </div>
        </div>
        <span className="rounded-md border border-rose-400/40 bg-rose-400/15 px-2.5 py-1 text-[9.5px] font-light text-rose-300">
          {alerts.length} {rtl ? "هشدار فعال" : "Active Alerts"}
        </span>
      </header>

      <div className="thin-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {alerts.map((al) => {
          const meta = severityMeta[al.severity];
          return (
            <div key={al.id} className="glass-row flex items-start gap-3 rounded-xl p-3 transition hover:-translate-y-0.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px]" style={{ background: meta.bg, color: meta.color }}>
                i
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-medium tx1">{t(al.title, lang)}</span>
                  <span className="shrink-0 font-mono text-[8.5px] tx4" dir="ltr">{al.time}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[8.5px] font-extralight tx3">
                  <span className="rounded px-1.5 py-0.5 font-medium" style={{ background: meta.bg, color: meta.color }}>
                    {t({ fa: meta.fa, en: meta.en }, lang)}
                  </span>
                  <span>·</span>
                  <span>{rtl ? "ماژول:" : "Module:"} {t(al.module, lang)}</span>
                  <span className="ms-auto font-mono text-sky-300">dbo.{al.source}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
