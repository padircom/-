import type { Lang } from "../data/framework";

export type IiotSubModuleId =
  | "drilling-das"
  | "iot-devices"
  | "condition-monitoring"
  | "sensor-alerts";

export const IIOT_SUBMODULES: Array<{
  id: IiotSubModuleId;
  icon: string;
  fa: string;
  en: string;
  descFa: string;
  descEn: string;
  plannedEntities: string[];
}> = [
  {
    id: "drilling-das",
    icon: "📡",
    fa: "پایش زنده حفاری و عملیات (Drilling DAS)",
    en: "Live Drilling & Operations Monitoring (Drilling DAS)",
    descFa: "دریافت و نمایش بلادرنگ داده‌های حفاری و عملیات میدانی (WOB، RPM، گشتاور، فشار پمپ، نرخ نفوذ ROP و عمق چاه).",
    descEn: "Real-time acquisition and visualization of field drilling & operational telemetry (WOB, RPM, torque, standpipe pressure, ROP, depth).",
    plannedEntities: ["IiotDrillingRigStream", "IiotDasChannel", "IiotTelemetrySample"],
  },
  {
    id: "iot-devices",
    icon: "🛰️",
    fa: "مدیریت سنسورها و تجهیزات IoT",
    en: "IoT Sensors & Edge Device Management",
    descFa: "شناسنامهٔ سنسورهای صنعتی، گیت‌وی‌های لبه (Edge Gateways)، کالیبراسیون، پروتکل‌های ارتباطی (OPC-UA / MQTT / Modbus) و وضعیت اتصال.",
    descEn: "Registry of industrial sensors, edge gateways, calibration schedules, protocols (OPC-UA / MQTT / Modbus), and heartbeat status.",
    plannedEntities: ["IiotEdgeGateway", "IiotSensorNode", "IiotCalibrationLog"],
  },
  {
    id: "condition-monitoring",
    icon: "🌡️",
    fa: "پایش آنلاین شرایط محیطی و تجهیزات",
    en: "Online Environmental & Equipment Condition Monitoring",
    descFa: "پایش پیوستهٔ ارتعاشات، دما، رطوبت، فشار، جریان مصرفی موتورها و گازهای محیطی برای نگهداری مبتنی بر وضعیت (CBM).",
    descEn: "Continuous vibration, temperature, humidity, pressure, motor current, and gas telemetry for condition-based maintenance (CBM).",
    plannedEntities: ["IiotConditionProfile", "IiotEnvironmentalReading", "IiotHealthIndex"],
  },
  {
    id: "sensor-alerts",
    icon: "🚨",
    fa: "سیستم هشدار بلادرنگ سنسورها",
    en: "Real-Time Sensor Threshold & Anomaly Alerts",
    descFa: "تعریف آستانه‌های بحرانی (High/High-High)، تشخیص ناهنجاری سیگنال، ثبت رخدادهای تله‌متری و ارسال خودکار دستورکار اضطراری به نت (CMMS) و تولید (MES).",
    descEn: "Threshold rules (High/High-High), signal anomaly detection, telemetry incident logs, and automated triggers to CMMS and MES.",
    plannedEntities: ["IiotThresholdRule", "IiotSensorAlert", "IiotIncidentDispatch"],
  },
];

interface Props {
  lang: Lang;
  activeSub: IiotSubModuleId;
  onSelectSub: (sub: IiotSubModuleId) => void;
  onBackHome?: () => void;
}

export default function IiotWorkspaceShell({ lang, activeSub, onSelectSub, onBackHome }: Props) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const current = IIOT_SUBMODULES.find((s) => s.id === activeSub) ?? IIOT_SUBMODULES[0];

  return (
    <div dir={fa ? "rtl" : "ltr"} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
      <header className="glass-dark rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-purple-500/40 bg-purple-500/10 text-lg">
            📡
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="tx1 font-semibold text-sm">
                {tr(
                  "سامانهٔ پایش میدانی و اینترنت اشیاء صنعتی (IIoT & DAS)",
                  "Field Telemetry, Data Acquisition & Industrial IoT (IIoT & DAS)",
                )}
              </h2>
              <span className="rounded-md border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300">
                {tr("پوستهٔ اولیه (Workspace Shell)", "Workspace Shell")}
              </span>
            </div>
            <p className="tx3 text-xs mt-0.5">
              {tr(
                "سرگروه پنجم سازمان · پایش بلادرنگ سنسورها، عملیات حفاری (Drilling DAS) و تله‌متری تجهیزات",
                "Organizational Pillar #5 · Real-time sensor telemetry, Drilling DAS, and equipment condition monitoring",
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

      {/* نوار تب‌های ۴گانهٔ IIoT & DAS */}
      <nav className="flex flex-wrap gap-1.5">
        {IIOT_SUBMODULES.map((item) => {
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
            module: iiot-das / {current.id}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-1">
            <div className="tx3 text-xs">{tr("وضعیت زیرماژول", "Submodule Status")}</div>
            <div className="tx1 font-semibold text-sm text-purple-300">
              {tr("پوستهٔ آماده (Placeholder Shell)", "Placeholder Shell Ready")}
            </div>
            <p className="tx3 text-[11px]">
              {tr(
                "ساختار ناوبری و نمای اولیهٔ تله‌متری آماده است و جریان داده‌های سنسوری در فازهای آتی متصل می‌شود.",
                "UI shell and navigation are wired; real-time sensor streams will be connected in upcoming phases.",
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
                "ارسال خودکار هشدارهای ارتعاش/دما به CMMS، ثبت توقفات خودکار ماشین‌آلات در MES و گزارش پیشرفت حفاری به PMIS.",
                "Auto-triggers maintenance alerts in CMMS, logs machine downtime in MES, and feeds drilling progress into PMIS.",
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
