import { useEffect, useMemo, useRef, useState } from "react";
import { t, type Bi, type Lang } from "../data/framework";
import { useSystem } from "../context/SystemContext";

type Horizon = "1m" | "2m" | "3m";
type InputMode = "workshop" | "schedule";

type ActionItem = {
  id: string;
  title: Bi;
  horizon: Horizon;
  source: InputMode;
  weight: number;
  status: "open" | "risk" | "done";
  important: boolean;
};

const orgTemplates: Record<Horizon, { name: Bi; rev: string }> = {
  "1m": { name: { fa: "قالب سازمانی اکشن‌پلن ۱ ماهه", en: "Org 1-Month Action Plan" }, rev: "ORG-AP-1M-v3" },
  "2m": { name: { fa: "قالب سازمانی اکشن‌پلن ۲ ماهه", en: "Org 2-Month Action Plan" }, rev: "ORG-AP-2M-v2" },
  "3m": { name: { fa: "قالب سازمانی اکشن‌پلن ۳ ماهه", en: "Org 3-Month Action Plan" }, rev: "ORG-AP-3M-v4" },
};

const seedActions: ActionItem[] = [
  { id: "a1", title: { fa: "تکمیل بتن فونداسیون زون شمال", en: "Complete north-zone foundation concrete" }, horizon: "1m", source: "workshop", weight: 92, status: "open", important: true },
  { id: "a2", title: { fa: "تحویل لوله‌های Long Lead", en: "Deliver long-lead piping" }, horizon: "2m", source: "schedule", weight: 88, status: "risk", important: true },
  { id: "a3", title: { fa: "آزادسازی جبهه نصب مکانیک", en: "Release mechanical installation front" }, horizon: "1m", source: "workshop", weight: 81, status: "open", important: true },
  { id: "a4", title: { fa: "رفع گلوگاه ماشین‌آلات سنگین", en: "Clear heavy-equipment bottleneck" }, horizon: "3m", source: "workshop", weight: 76, status: "risk", important: true },
  { id: "a5", title: { fa: "تست هیدرواستاتیک هدر اصلی", en: "Main header hydrostatic test" }, horizon: "2m", source: "schedule", weight: 64, status: "open", important: false },
  { id: "a6", title: { fa: "بستن Punch List فاز ۱", en: "Close Phase-1 punch list" }, horizon: "3m", source: "schedule", weight: 58, status: "done", important: false },
];

const statusLabel: Record<ActionItem["status"], Bi> = {
  open: { fa: "باز", en: "Open" },
  risk: { fa: "ریسک", en: "Risk" },
  done: { fa: "انجام", en: "Done" },
};

const statusColor: Record<ActionItem["status"], string> = {
  open: "#7FB2FF",
  risk: "#F87171",
  done: "#34D399",
};

export default function MonitoringWorkspace({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { clusters, projectsByCluster, projectScope } = useSystem();
  const [horizon, setHorizon] = useState<Horizon>("1m");
  const [mode, setMode] = useState<InputMode>("workshop");
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionItem[]>(seedActions);
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 4000);
    return () => window.clearInterval(id);
  }, [live]);

  const metrics = useMemo(() => {
    const spi = Number((0.94 + (tick % 5) * 0.008).toFixed(3));
    const cpi = Number((1.02 - (tick % 4) * 0.006).toFixed(3));
    const sv = -2 - (tick % 3);
    const cv = 18 - (tick % 4) * 3;
    const kpi = 71 + (tick % 6);
    const alerts = 4 + (tick % 3);
    return { spi, cpi, sv, cv, kpi, alerts, pv: 850, ev: Math.round(790 + tick * 2), ac: 820 };
  }, [tick]);

  const important = actions.filter((a) => a.important && a.horizon === horizon);
  const tpl = orgTemplates[horizon];
  const scopeCluster = clusters.find((cluster) => cluster.id === projectScope?.clusterId);
  const scopeProject = projectScope ? projectsByCluster[projectScope.clusterId]?.find((project) => project.id === projectScope.projectId) : undefined;

  const loadOrgTemplate = () => {
    setTemplateName(`${tpl.rev}.xlsx`);
  };

  const importOrgTemplate = (files: FileList | null) => {
    if (!files?.length) return;
    setTemplateName(files[0].name);
  };

  const ingest = () => {
    if (mode === "workshop") {
      setActions((prev) =>
        prev.map((a) =>
          a.horizon === horizon
            ? { ...a, source: "workshop", important: a.weight >= 75, status: a.weight >= 85 ? "risk" : a.status }
            : a
        )
      );
    } else {
      setActions((prev) => {
        const imported: ActionItem[] = [
          { id: `imp-${horizon}-1`, title: { fa: `خروجی برنامه اصلی — افق ${horizon}`, en: `Main schedule output — ${horizon}` }, horizon, source: "schedule", weight: 90, status: "open", important: true },
          { id: `imp-${horizon}-2`, title: { fa: "فعالیت‌های بحرانی Lookahead", en: "Critical lookahead activities" }, horizon, source: "schedule", weight: 86, status: "risk", important: true },
        ];
        return [...imported, ...prev.filter((a) => !(a.source === "schedule" && a.horizon === horizon && a.id.startsWith("imp-")))];
      });
    }
  };

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* Compact org-template + action-plan intake */}
      <section className="glass-dark shrink-0 rounded-2xl px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-amber-400/40 bg-amber-400/10 text-[13px]">📋</span>
          <div>
            <h3 className="text-[11.5px] font-normal tx1">{rtl ? "گزارش مدیریتی زنده" : "Live Management Report"}</h3>
            <p className="text-[8px] font-extralight tx3">{rtl ? "ادغام KPI · EVM · انحراف · هشدار + اهم اکشن‌پلن" : "Merged KPI · EVM · Variance · Alert + Action Plan highlights"}</p>
            {scopeCluster && scopeProject && (
              <p className="mt-0.5 truncate text-[8px] font-light text-amber-200" dir={rtl ? "rtl" : "ltr"}>
                {t(scopeCluster.title, lang)} · {scopeProject.code} · {t(scopeProject.name, lang)}
              </p>
            )}
          </div>

          <span className="mx-1 hidden h-4 w-px hline md:block" />
          <span className="text-[8.5px] font-extralight tx3">{rtl ? "افق:" : "Horizon:"}</span>
          {(["1m", "2m", "3m"] as Horizon[]).map((h) => (
            <button key={h} onClick={() => setHorizon(h)} className={`rounded-md border px-2 py-0.5 text-[9px] font-light ${horizon === h ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "b-line-soft tx3"}`}>
              {h === "1m" ? (rtl ? "۱ ماهه" : "1M") : h === "2m" ? (rtl ? "۲ ماهه" : "2M") : rtl ? "۳ ماهه" : "3M"}
            </button>
          ))}

          <span className="mx-1 hidden h-4 w-px hline md:block" />
          <div className="toggle-shell flex items-center gap-1 rounded-lg p-[2px]">
            <button onClick={() => setMode("workshop")} className={`rounded-md px-2 py-0.5 text-[9px] font-light ${mode === "workshop" ? "toggle-on tx1" : "tx3"}`}>
              {rtl ? "تشخیص کارگاه" : "Workshop policy"}
            </button>
            <button onClick={() => setMode("schedule")} className={`rounded-md px-2 py-0.5 text-[9px] font-light ${mode === "schedule" ? "toggle-on tx1" : "tx3"}`}>
              {rtl ? "خروجی برنامه اصلی" : "Main schedule"}
            </button>
          </div>

          <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.docx,.pdf" onChange={(e) => importOrgTemplate(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} className="glass-row rounded-lg px-2 py-1 text-[9px] font-light tx1">⬆ {rtl ? "ورود قالب سازمانی" : "Import org template"}</button>
          <button onClick={loadOrgTemplate} className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-2 py-1 text-[9px] font-light text-sky-200">⚙ {rtl ? "تولید قالب برنامه" : "Build org template"}</button>
          <button onClick={ingest} className="rounded-lg border border-emerald-400/50 bg-emerald-400/10 px-2 py-1 text-[9px] font-light text-emerald-300">
            {mode === "workshop" ? (rtl ? "تشخیص و ورود اهم اقلام" : "Detect key items") : (rtl ? "ایمپورت Lookahead" : "Import lookahead")}
          </button>

          <button onClick={() => setLive((v) => !v)} className={`ms-auto rounded-lg border px-2 py-1 text-[9px] font-light ${live ? "border-emerald-400/50 text-emerald-300" : "b-line-soft tx3"}`}>
            <span className={`me-1 inline-block h-1.5 w-1.5 rounded-full ${live ? "pulse-dot bg-emerald-400" : "bg-slate-400"}`} />
            {live ? (rtl ? "آپدیت لحظه‌ای" : "Live") : (rtl ? "متوقف" : "Paused")}
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[8px] font-extralight tx4">
          <span>🏢 {tpl.name[lang]} · {tpl.rev}</span>
          {templateName && <span className="text-emerald-300">✓ {templateName}</span>}
          <span className="tx4">·</span>
          <span>{rtl ? "قالب کارفرما در این حوزه وجود ندارد" : "No client-mandated template in this domain"}</span>
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[minmax(280px,.85fr)_minmax(0,1.55fr)]">
        {/* Action plan important items */}
        <section className="glass-dark flex min-h-0 flex-col overflow-hidden rounded-2xl">
          <header className="border-b b-line-soft px-3 py-2">
            <h4 className="text-[11px] font-normal tx1">{rtl ? "اهم اقلام اکشن‌پلن" : "Action Plan Highlights"}</h4>
            <p className="text-[8px] font-extralight tx3">
              {rtl ? `فقط اقلام با اولویت بالا در افق ${horizon === "1m" ? "۱ ماهه" : horizon === "2m" ? "۲ ماهه" : "۳ ماهه"}` : `High-weight items only · ${horizon}`}
            </p>
          </header>
          <div className="thin-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {important.length === 0 && (
              <div className="flex h-full items-center justify-center text-[10px] font-extralight tx4">
                {rtl ? "اقلام مهمی برای این افق ثبت نشده." : "No highlight items for this horizon."}
              </div>
            )}
            {important.map((item) => (
              <div key={item.id} className="glass-row rounded-xl px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <i className="h-2 w-2 rounded-full" style={{ background: statusColor[item.status] }} />
                  <span className="min-w-0 flex-1 truncate text-[10px] font-light tx1">{t(item.title, lang)}</span>
                  <span className="text-[8px] font-light tabular-nums tx3">{item.weight}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[8px] font-extralight tx4">
                  <span>{statusLabel[item.status][lang]}</span>
                  <span>·</span>
                  <span>{item.source === "workshop" ? (rtl ? "تشخیص کارگاه" : "Workshop") : (rtl ? "برنامه اصلی" : "Schedule")}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Live merged management report */}
        <section className="flex min-h-0 flex-col gap-2 overflow-hidden">
          <div className="grid shrink-0 grid-cols-2 gap-2 md:grid-cols-4">
            <MetricCard label={rtl ? "KPI تجمیعی" : "Composite KPI"} value={`${metrics.kpi}٪`} color="#FFD48A" source="KPI_Value" />
            <MetricCard label="SPI" value={metrics.spi.toFixed(2)} color={metrics.spi < 1 ? "#FBBF24" : "#34D399"} source="EVM_Transaction" />
            <MetricCard label="CPI" value={metrics.cpi.toFixed(2)} color={metrics.cpi < 1 ? "#FBBF24" : "#34D399"} source="EVM_Transaction" />
            <MetricCard label={rtl ? "هشدار باز" : "Open alerts"} value={String(metrics.alerts)} color="#F87171" source="Alert_Register" />
          </div>

          <div className="grid shrink-0 grid-cols-3 gap-2">
            <MetricCard label="PV" value={metrics.pv.toLocaleString()} color="#7FB2FF" source="PV" compact />
            <MetricCard label="EV" value={metrics.ev.toLocaleString()} color="#8FE3C8" source="EV" compact />
            <MetricCard label="AC" value={metrics.ac.toLocaleString()} color="#C9A7FF" source="AC" compact />
          </div>

          <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <div className="mb-2 flex items-center gap-2">
              <h4 className="text-[11px] font-normal tx1">{rtl ? "ادغام چهار ماژول پایش" : "Four-module merge"}</h4>
              <span className="text-[8px] font-extralight tx4">KPI · EVM · Variance · Early Warning</span>
              <span className="ms-auto text-[8px] font-extralight ok-dim-t">{rtl ? "به‌روز در لحظه" : "Realtime"} · tick {tick}</span>
            </div>
            <div className="thin-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              <MergeRow tone="#FFD48A" title={rtl ? "KPI" : "KPI"} text={rtl ? `شاخص ترکیبی ${metrics.kpi}٪ — فاصله با هدف سازمانی ۱۲ واحد.` : `Composite KPI ${metrics.kpi}% — 12 pts below org target.`} />
              <MergeRow tone="#8FE3C8" title="EVM" text={rtl ? `SPI ${metrics.spi.toFixed(2)} · CPI ${metrics.cpi.toFixed(2)} · EV ${metrics.ev.toLocaleString()} در برابر PV ${metrics.pv.toLocaleString()}.` : `SPI ${metrics.spi.toFixed(2)} · CPI ${metrics.cpi.toFixed(2)} · EV ${metrics.ev.toLocaleString()} vs PV ${metrics.pv.toLocaleString()}.`} />
              <MergeRow tone="#FBBF24" title={rtl ? "انحراف" : "Variance"} text={rtl ? `SV ${metrics.sv} روز · CV ${metrics.cv} واحد هزینه — ریشه اصلی تأمین Long Lead.` : `SV ${metrics.sv} days · CV ${metrics.cv} cost units — primary root: long-lead supply.`} />
              <MergeRow tone="#F87171" title={rtl ? "هشدار زودهنگام" : "Early Warning"} text={rtl ? `${metrics.alerts} هشدار باز. دو مورد مرتبط با گلوگاه ماشین‌آلات و تأخیر مصالح.` : `${metrics.alerts} open alerts. Two linked to equipment bottleneck and material delay.`} />
              <MergeRow tone="#C9A7FF" title={rtl ? "اهم اکشن‌پلن" : "Action Plan"} text={rtl ? `${important.length} قلم اولویت‌دار از افق جاری به گزارش مدیریتی تزریق شد.` : `${important.length} high-priority items from current horizon injected into the report.`} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, source, compact }: { label: string; value: string; color: string; source: string; compact?: boolean }) {
  return (
    <div className="glass-dark rounded-2xl p-2.5">
      <div className="flex items-center gap-1.5">
        <i className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        <span className="truncate text-[8.5px] font-extralight tx3">{label}</span>
      </div>
      <div className={`${compact ? "text-[15px]" : "text-[18px]"} mt-1 font-light tabular-nums tx1`} dir="ltr">{value}</div>
      <div className="mt-0.5 text-[7.5px] font-extralight tx4" dir="ltr">{source}</div>
    </div>
  );
}

function MergeRow({ tone, title, text }: { tone: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/10 px-3 py-2">
      <div className="flex items-center gap-2">
        <i className="h-2 w-2 rounded-full" style={{ background: tone }} />
        <span className="text-[10px] font-medium" style={{ color: tone }}>{title}</span>
      </div>
      <p className="mt-1 text-[10px] font-light leading-5 tx2">{text}</p>
    </div>
  );
}
