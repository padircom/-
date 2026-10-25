import { useEffect, useMemo, useState } from "react";
import { t, type Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { useSystem } from "../context/SystemContext";
import { PEX_SCURVE } from "../data/pexProject";
import { buildPexModel } from "../services/pexModel";
import { workingDaysBetween, type WeightMode } from "../services/planning";
import { getSchedule, type ApiSchedule } from "../services/pexApiClient";
import BreakdownBuilder from "./BreakdownBuilder";
import OilfieldWorkStages from "./OilfieldWorkStages";
import { OILFIELD_CATALOGUE_SCOPE } from "../data/oilfieldWorkStages";
import PetrochemicalWorkStages from "./PetrochemicalWorkStages";
import ContractWorkshop from "./ContractWorkshop";
import InteractiveGantt, { type GanttActivity } from "./InteractiveGantt";
import BaselineSCurvePanel from "./BaselineSCurvePanel";
import CpmWorkspace from "./CpmWorkspace";
import DailyReportWorkspace from "./DailyReportWorkspace";
import WeeklyReportWorkspace from "./WeeklyReportWorkspace";
import MonthlyReportWorkspace from "./MonthlyReportWorkspace";
import DprProgressFallback from "./DprProgressFallback";
import DprSupportTables from "./DprSupportTables";
import { isDprFormatActive, isDprSupportBoxActive } from "../data/dprScope";
import MspAnalysisPanel from "./MspAnalysisPanel";
import PlanningWorkflowMap from "./PlanningWorkflowMap";
import { ScheduleImportActions } from "./ConnectorActions";

export type PexTab =
  | "workflow"
  | "dashboard"
  | "insight"
  | "workshop"
  | "wbs"
  | "gantt"
  | "baseline"
  | "milestone"
  | "cp"
  | "lookahead"
  | "dpr"
  | "dprReg"
  | "workAreas"
  | "discipline"
  | "weekly"
  | "mpr"
  | "alerts"
  | "roc";

const TABS: { id: PexTab; fa: string; en: string }[] = [
  { id: "workflow", fa: "نقشهٔ گردش‌کار", en: "Workflow Map" },
  { id: "dashboard", fa: "داشبورد", en: "Dashboard" },
  { id: "insight", fa: "تحلیل MSP/P6", en: "MSP/P6 Insight" },
  { id: "workshop", fa: "کارگاه برنامه‌ریزی", en: "Planning Workshop" },
  { id: "baseline", fa: "برنامه پایه", en: "Baseline" },
  { id: "dpr", fa: "گزارش روزانه", en: "DPR" },
  { id: "weekly", fa: "گزارش هفتگی", en: "Weekly Report" },
  { id: "mpr", fa: "ماهانه", en: "MPR" },
  { id: "alerts", fa: "هشدار", en: "Alerts" },
];

/** برچسب فارسی وضعیت؛ پیش از این کلید انگلیسی خام نشان داده می‌شد. */
const MS_STATUS_FA: Record<string, string> = {
  OnTrack: "طبق برنامه",
  AtRisk: "در خطر",
  Delayed: "تأخیر",
  Achieved: "محقق",
  Cancelled: "لغو",
};

const STATUS_COLOR: Record<string, string> = {
  OnTrack: "#8FE3C8",
  AtRisk: "#FFD48A",
  Delayed: "#FF9F9F",
  Achieved: "#7FB2FF",
  Cancelled: "#9AA4B2",
};

const SEV_COLOR: Record<string, string> = {
  warning: "#FFD48A",
  critical: "#FF9F9F",
  emergency: "#FF7A7A",
};

const fmtNum = (n: number) => n.toLocaleString("en-US");

export default function PlanningWorkspace({
  lang,
  initialTab = "dashboard",
  hideTabs = false,
  clusterId,
  projectId,
}: {
  lang: Lang;
  clusterId?: string;
  projectId?: string;
  initialTab?: PexTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const { can } = useAuth();
  const { projectsByCluster } = useSystem();
  /* کد پروژه برای کلید API باکس پشتیبان؛ بازگشت امن به شناسه. */
  const dprProjectCode =
    (clusterId && projectId ? projectsByCluster[clusterId]?.find((pj) => pj.id === projectId)?.code : undefined) ??
    projectId ?? "";
  const dprCanEdit = can("report.daily.edit", projectId);
  const [tab, setTab] = useState<PexTab>(initialTab);
  const [weightMode, setWeightMode] = useState<WeightMode>("Cost");
  const [alpha, setAlpha] = useState(0.6);
  const [ack, setAck] = useState<Record<string, boolean>>({});
  const [ackAt, setAckAt] = useState<Record<string, string>>({});
  const [alertFilter, setAlertFilter] = useState<string>("all");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  /* نشان «زنده/محلی» حذف شد؛ خواندن از سرور برای گرم‌شدن مسیر API می‌ماند
   * ولی مقدارش دیگر جایی نمایش داده نمی‌شود. */
  const [, setLive] = useState<ApiSchedule | null>(null);

  /* خواندن برنامه از سرور؛ بازخوانی پس از ورود فایل هم از همین مسیر می‌آید تا
   * نمودار و اعداد همان دادهٔ سرور باشند، نه محاسبهٔ محلی. */
  const [scheduleRevision, setScheduleRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    getSchedule(weightMode, alpha).then((res) => {
      if (alive) setLive(res);
    });
    return () => {
      alive = false;
    };
  }, [weightMode, alpha, scheduleRevision]);
  const reloadSchedule = () => setScheduleRevision((value) => value + 1);

  const m = useMemo(() => buildPexModel(weightMode, alpha), [weightMode, alpha]);

  /* تغذیهٔ گانت تعاملی از برنامهٔ واقعی، نه دادهٔ نمونه.
   *
   * روز شروع نسبت به آغاز پروژه حساب می‌شود؛ اگر تاریخ مطلق به نمودار
   * داده شود، همهٔ میله‌ها به لبهٔ راست می‌چسبند چون افق نمودار روز
   * است نه تاریخ. */
  const ganttFromSchedule = useMemo<GanttActivity[]>(() => {
    const real = m.rows.filter((r) => !r.isMilestone);
    if (!real.length) return [];
    const origin = real.reduce((min, r) => (r.es < min ? r.es : min), real[0].es);
    const originMs = Date.parse(origin);
    return real.slice(0, 40).map((r) => ({
      id: r.id,
      nameFa: r.nameFa,
      nameEn: r.nameEn,
      startDay: Math.max(1, Math.round((Date.parse(r.es) - originMs) / 86_400_000) + 1),
      duration: Math.max(1, r.duration),
      progress: Math.round(r.physicalPct),
      critical: r.critical,
    }));
  }, [m]);
  const dataDate = m.dataDate;

  /* تب‌های موازی داخل «برنامه پایه».
   *
   * گانت، مایلستون، مسیر بحرانی و نگاه‌به‌جلو همه روی همان برنامهٔ
   * زمان‌بندی کار می‌کنند، پس کنار هم بودنشان یعنی مقایسه بدون ترک
   * صفحه ممکن است. */
  type PlanView = "baseline" | "scurve" | "gantt" | "milestone" | "cp" | "lookahead";
  const [planView, setPlanView] = useState<PlanView>("baseline");

  /* تب‌های موازی داخل «کارگاه برنامه‌ریزی».
   *
   * کارگاه و ساختار شکست دو ماژول جدا بودند ولی یک زنجیره‌اند: قرارداد
   * وارد می‌شود، ساختار از آن درمی‌آید و وزن می‌گیرد. جدا بودنشان یعنی
   * کاربر برای دیدن نتیجهٔ استخراج باید ماژول عوض می‌کرد. */
  const [shopView, setShopView] = useState<"contract" | "wbs" | "oilfield" | "petrochemical" | "roc">("contract");

  /* کاتالوگ مراحل کاری وابسته به صنعت است.
   *
   * نفتی به یک پروژه بسته است (c1-p1)، پتروشیمی به کل خوشهٔ c2 و هر پنج
   * پروژهٔ زیرمجموعه‌اش. پس شرط نمایش یکسان نیست و جدا نگه داشته شده. */
  const showOilfield = clusterId === OILFIELD_CATALOGUE_SCOPE.clusterId && projectId === OILFIELD_CATALOGUE_SCOPE.projectId;
  const showPetrochemical = clusterId === "c2";

  /* اگر دامنه عوض شود در حالی که زیرتبِ صنعتی باز است، آن زیرتب دیگر
   * رندر نمی‌شود و کاربر پنل خالی می‌بیند بی‌آنکه بفهمد چرا. برگرداندن
   * به «قرارداد» تنها حالتی است که همیشه محتوا دارد. */
  useEffect(() => {
    if (shopView === "oilfield" && !showOilfield) setShopView("contract");
    if (shopView === "petrochemical" && !showPetrochemical) setShopView("contract");
  }, [shopView, showOilfield, showPetrochemical]);

  /* ورود مستقیم با شناسهٔ قدیمی.
   *
   * شناسه‌های gantt/milestone/cp/lookahead هنوز در نوع PexTab هستند
   * چون جاهای دیگر ممکن است به آن‌ها پیوند بدهند. بدون این تبدیل،
   * چنین پیوندی صفحهٔ سفید می‌داد: تبی که دیگر رندر نمی‌شود. */
  useEffect(() => {
    /* شناسهٔ قدیمی wbs هنوز در سایدبار و پیوندهای دیگر هست؛ بدون این
     * تبدیل، تبی باز می‌شد که دیگر رندر نمی‌شود — صفحهٔ سفید. */
    if (tab === "wbs") {
      setShopView("wbs");
      setTab("workshop");
      return;
    }
    if (tab === "roc") {
      setShopView("roc");
      setTab("workshop");
      return;
    }
    const MOVED: Partial<Record<PexTab, PlanView>> = {
      gantt: "gantt",
      milestone: "milestone",
      cp: "cp",
      lookahead: "lookahead",
    };
    const moved = MOVED[tab];
    if (moved) {
      setPlanView(moved);
      setTab("baseline");
    }
  }, [tab]);

  const msCount = useMemo(() => {
    const c: Record<string, number> = {};
    for (const x of m.milestones) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, [m]);

  /* SPI زمان‌بندی از پیشرفت وزنی موتور: واقعی ÷ برنامه‌ای در Data Date.
   * آستانه‌ها همان آستانهٔ EVM برنامه‌اند (کمتر از ۰٫۹۵ هشدار). مخرج
   * صفر یعنی نامعلوم — عدد ساختگی گذاشته نمی‌شود. */
  const spi = m.plannedPct > 0 ? Math.round((m.overallPct / m.plannedPct) * 1000) / 1000 : null;
  const spiColor = spi === null ? undefined : spi < 0.95 ? "#FF9F9F" : spi < 1 ? "#FFD48A" : "#8FE3C8";

  const kpis = useMemo(
    () => [
      { k: rtl ? "پیشرفت واقعی" : "Actual", v: `${m.overallPct}%`, c: "#8FE3C8" },
      { k: rtl ? "برنامه‌ای" : "Planned", v: `${m.plannedPct}%`, c: "#7FB2FF" },
      { k: rtl ? "انحراف" : "Variance", v: `${m.variance.deltaPct > 0 ? "+" : ""}${m.variance.deltaPct}`, c: m.variance.status === "behind" ? "#FF9F9F" : "#8FE3C8" },
      /* SPI به‌صورت نسبت (۰٫۹۵ آستانهٔ هشدار) — همان قرارداد تب EVM
       * پایش، نه درصد؛ وگرنه یک شاخص در دو ماژول دو معنا پیدا می‌کند. */
      ...(spi === null ? [] : [{ k: "SPI", v: spi.toFixed(2), c: spiColor }]),
      { k: "PPC", v: `${m.ppcPct}%`, c: "#C9A7FF" },
      { k: rtl ? "سلامت زمان‌بندی" : "Health", v: String(m.dcma.healthScore), c: m.dcma.healthScore < 80 ? "#FFD48A" : "#8FE3C8" },
      { k: rtl ? "جریمه برآوردی" : "Penalty est.", v: `${Math.round(m.totalPenalty / 1000)}k`, c: "#FF9F9F" },
    ],
    [rtl, m, spi, spiColor]
  );

  /** قالب مقدار بر پایهٔ واحد؛ بدون آن عدد بی‌معناست. */
  const formatDcma = (c: { value: number; unit: "pct" | "count" | "ratio" }) => {
    const v = Math.round(c.value * 100) / 100;
    if (c.unit === "pct") return `${v}%`;
    if (c.unit === "ratio") return v.toFixed(2);
    return String(v);
  };

  /* مردودها اول. کاربر چک‌لیست را برای پیدا کردن اشکال باز می‌کند، نه
   * برای خواندن چهارده مورد قبول‌شده. ترتیب شماره داخل هر گروه حفظ
   * می‌شود تا جای موارد بین دو بازدید نپرد. */
  const dcmaSorted = useMemo(
    () => [...m.dcma.checks].sort((a, b) => (a.pass === b.pass ? a.id - b.id : a.pass ? 1 : -1)),
    [m],
  );
  const dcmaFailed = useMemo(() => m.dcma.checks.filter((c) => !c.pass), [m]);
  const [dcmaOnlyFailed, setDcmaOnlyFailed] = useState(false);
  const dcmaVisible = useMemo(
    () => (dcmaOnlyFailed ? dcmaSorted.filter((c) => !c.pass) : dcmaSorted),
    [dcmaSorted, dcmaOnlyFailed],
  );

  /* برنامه پایه: لغزش هر فعالیت با همان تقویم موتور.
   *
   * پیش از این لغزش با تقریب `اختلاف تقویمی × ۵/۷` حساب می‌شد، در حالی
   * که موتور از `workingDaysBetween` استفاده می‌کند. نتیجه در ۹ ردیف از
   * هر ۱۰ ردیف متفاوت بود — مثلاً ENG-DD به‌جای ۱۲۸ روز، ۱۰۶ روز تأخیر
   * نشان می‌داد. عددی که ۲۲ روز خطا دارد، مبنای هیچ تصمیمی نیست. */
  const [blOnlyLate, setBlOnlyLate] = useState(false);

  const blAll = useMemo(
    () =>
      m.rows
        .filter((r) => r.baselineFinish)
        .map((r) => ({ ...r, slip: workingDaysBetween(r.baselineFinish as string, r.ef) - 1 }))
        .sort((a, b) => b.slip - a.slip),
    [m],
  );

  const blRows = useMemo(
    () => (blOnlyLate ? blAll.filter((r) => r.slip > 0) : blAll),
    [blAll, blOnlyLate],
  );

  const blStats = useMemo(() => ({
    total: blAll.length,
    late: blAll.filter((r) => r.slip > 0).length,
    onTime: blAll.filter((r) => r.slip === 0).length,
    ahead: blAll.filter((r) => r.slip < 0).length,
    worst: blAll.reduce((w, r) => Math.max(w, r.slip), 0),
  }), [blAll]);

  /** بیشترین لغزش (روز کاری) فعالیت‌های هر بسته WBS — نشانگر تأخیر روی
   * میله. همان فرمول ردیف «لغزش» جدول انطباق با پایه تا دو عدد از یک
   * محاسبه واگرا نشوند. */
  /* فهرست فعالیت‌های نمای پیشرفت: جستجوی متنی + بازهٔ دورهٔ باز.
   * بازه یک فیلتر حوزه است، نه تاریخچهٔ پیشرفت — ثبت پیشرفت تاریخ ندارد
   * و «پیشرفت دوره‌ای» بدون آن، عدد ساختگی می‌شود. */
  const [actQuery, setActQuery] = useState("");
  const [actScope, setActScope] = useState<"all" | "period">("all");

  /** لغزش هر فعالیت (روز کاری) — یک محاسبه برای همهٔ نمای‌ها. */
  const rowSlip = useMemo(
    () =>
      Object.fromEntries(
        m.rows
          .filter((r) => r.baselineFinish)
          .map((r) => [r.id, workingDaysBetween(r.baselineFinish as string, r.ef) - 1]),
      ) as Record<string, number>,
    [m],
  );

  /** فعالیت‌های نمای پیشرفت: جستجو + بازهٔ دورهٔ باز، عقب‌افتاده‌ها اول. */
  const actVisible = useMemo(() => {
    const q = actQuery.trim().toLowerCase();
    const period = m.openPeriod;
    return m.rows
      .filter((r) => {
        if (actScope === "period" && period && !(r.es <= period.to && r.ef >= period.from)) return false;
        if (!q) return true;
        return (
          r.id.toLowerCase().includes(q) ||
          r.nameFa.includes(actQuery.trim()) ||
          r.nameEn.toLowerCase().includes(q) ||
          r.wbs.includes(q)
        );
      })
      .map((r) => {
        const variance = Math.round((r.physicalPct - r.plannedPct) * 10) / 10;
        return { ...r, variance, slip: rowSlip[r.id] ?? 0 };
      })
      /* عقب‌افتاده‌ها اول — همان قاعدهٔ فهرست مایلستون (بیشترین لغزش
       * بالا). کاربر برای پیدا کردن مشکل می‌آید، نه برای دیدن ردیف سالم. */
      .sort((a, b) => a.variance - b.variance || a.id.localeCompare(b.id));
  }, [m, actQuery, actScope, rowSlip]);

  const wbsSlip = useMemo(() => {
    const out: Record<string, number> = {};
    for (const w of m.wbsRollup) {
      out[w.id] = m.rows
        .filter((r) => r.wbs === w.id && r.baselineFinish)
        .reduce((mx, r) => Math.max(mx, workingDaysBetween(r.baselineFinish as string, r.ef) - 1), 0);
    }
    return out;
  }, [m]);

  /* ردیابی مایلستون: فیلتر، مرتب‌سازی و جمع‌بندی. */
  const [msFilter, setMsFilter] = useState<"all" | "AtRisk" | "Delayed" | "Achieved">("all");


  const msVisible = useMemo(() => {
    const list = msFilter === "all"
      ? [...m.milestones]
      : m.milestones.filter((x) => (msFilter === "AtRisk" ? x.status === "AtRisk" : x.status === msFilter));
    /* بدترین لغزش اول. ترتیب تعریف در فایل داده برای خواننده معنایی
     * ندارد؛ چیزی که مهم است، مایلستونی است که بیشترین تأخیر را دارد. */
    return list.sort((a, b) => b.slipDays - a.slipDays);
  }, [m, msFilter]);

  const msAtRisk = useMemo(
    () => m.milestones.filter((x) => x.status === "AtRisk" || x.status === "Delayed").length,
    [m],
  );
  const msWorstSlip = useMemo(
    () => m.milestones.reduce((w, x) => Math.max(w, x.slipDays), 0),
    [m],
  );
  /* خالص: پاداش مثبت، جریمه منفی. جمع کردن مطلقشان عددی می‌سازد که
   * هیچ معنایی ندارد. */
  const msNet = useMemo(
    () => m.milestones.reduce((sum, x) => sum + (x.bonus ?? 0) - (x.penalty ?? 0), 0),
    [m],
  );

  const lookahead = m.rows.filter((r) => r.physicalPct < 100 && r.es <= "2026-10-16" && !r.isMilestone);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {!hideTabs && (
        <nav className="flex shrink-0 flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-light transition ${
                tab === item.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"
              }`}
            >
              {rtl ? item.fa : item.en}
            </button>
          ))}
        </nav>
      )}

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pe-1">
        <p className="mb-2 text-[9px] tx3">
          {rtl ? "تاریخ داده:" : "Data date:"} <span dir="ltr" className="inline-block">{dataDate}</span>
        </p>
        {/* در حالت بدون نوار تب (ورود از مسیر پروژه)، بعد از پرش از روی نقشه
            به یک زیربخش، راه برگشت فقط همین دکمه است. */}
        {hideTabs && tab !== "workflow" && (
          <div className="fade-rise mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("workflow")}
              className="glass-row flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1"
            >
              <span aria-hidden="true">{rtl ? "→" : "←"}</span>
              {rtl ? "بازگشت به نقشهٔ گردش‌کار" : "Back to workflow map"}
            </button>
            <span className="text-[10px] tx3">
              {rtl ? "برای دیدن دوبارهٔ نقشهٔ فرایند و انتخاب گرهٔ دیگر" : "To see the process map again and pick another node"}
            </span>
          </div>
        )}

        {/* نقشهٔ گردش‌کار: صفحهٔ مرکزی و مستقل ماژول؛ نقطهٔ ورود پیش‌فرض.
            کلیک روی هر گره به زیربخش/ماژول مربوط می‌رود و دکمهٔ بازگشت
            بالای زیربخش‌ها دوباره به همین نقشه برمی‌گردد. */}
        {tab === "workflow" && (
          <div className="fade-rise flex min-h-full items-center justify-center py-3">
            <div className="w-full max-w-[1060px]">
              <PlanningWorkflowMap rtl={rtl} onNavigate={(next) => setTab(next)} />
              <p className="mt-2 text-center text-[10px] tx3">
                {rtl ? "برای شروع، روی هر گره از نقشه کلیک کنید تا به بخش مربوط بروید." : "Start by clicking any node on the map to open its section."}
              </p>
            </div>
          </div>
        )}

        {tab === "dashboard" && (
          <div className="fade-rise space-y-2">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              {kpis.map((c) => (
                <div key={c.k} className="glass-dark rounded-2xl p-3">
                  <div className="text-[9.5px] font-extralight tx3">{c.k}</div>
                  <div className="mt-1 text-[19px] font-semibold tabular-nums" style={{ color: c.c }}>{c.v}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <div className="glass-dark rounded-2xl p-3">
                <div className="text-[11.5px] font-normal tx1">{rtl ? "ویجت مایلستون" : "Milestone widget"}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(msCount).map(([st, n]) => (
                    <span key={st} className="rounded-lg px-2 py-1 text-[10px]" style={{ background: `${STATUS_COLOR[st]}22`, color: STATUS_COLOR[st] }}>
                      {n} {st}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[10px] tx3">
                  {rtl ? "جریمه انباشته" : "Accrued penalty"} <span dir="ltr">{fmtNum(m.totalPenalty)} {m.project.currency}</span>
                </p>
              </div>

              <div className="glass-dark rounded-2xl p-3">
                <div className="text-[11.5px] font-normal tx1">{rtl ? "ویجت مسیر بحرانی" : "CP widget"}</div>
                <p className="mt-2 text-[11px] tx2" dir="ltr">
                  CP {m.cpm.criticalPath.length} act · len {m.cpm.cpLengthDays}d · BL {m.baseline.cpLengthDays}d
                </p>
                <p className="mt-1 text-[11px]" style={{ color: m.snapshot.drift > 10 ? "#FF9F9F" : m.snapshot.drift > 5 ? "#FFD48A" : "#8FE3C8" }} dir="ltr">
                  Drift {m.snapshot.drift > 0 ? "+" : ""}{m.snapshot.drift}d · Finish {m.cpm.projectFinish}
                </p>
                <p className="mt-1 text-[10px] tx3">{rtl ? "گام‌های مسدود بابت IR" : "Steps blocked by IR"}: {m.blockedCount}</p>
              </div>

              <div className="glass-dark rounded-2xl p-3">
                <div className="text-[11.5px] font-normal tx1">{rtl ? "پیش‌بینی پایان" : "Finish forecast"}</div>
                <p className="mt-2 text-[15px] font-semibold tabular-nums tx1" dir="ltr" style={{ color: m.snapshot.drift > 0 ? "#FF9F9F" : m.snapshot.drift < 0 ? "#8FE3C8" : undefined }}>
                  {m.cpm.projectFinish}
                </p>
                <p className="mt-1 text-[10px] tx3">
                  {rtl ? "پایان پایه" : "Baseline finish"} <span dir="ltr" className="tabular-nums">{m.baseline.projectFinish}</span>
                </p>
                <p className="mt-1 text-[11px] tabular-nums" dir="ltr" style={{ color: m.snapshot.drift > 0 ? "#FF9F9F" : m.snapshot.drift < 0 ? "#8FE3C8" : undefined }}>
                  {rtl ? "رانش" : "Drift"} {m.snapshot.drift > 0 ? "+" : ""}{m.snapshot.drift} {rtl ? "روز کاری" : "wd"}
                </p>
                <p className="mt-1 text-[9.5px] tx4">{rtl ? "از CPM جاری در Data Date — نه عدد دستی" : "From current CPM at data date — not hand-entered"}</p>
              </div>

              <div className="glass-dark rounded-2xl p-3">
                <div className="text-[11.5px] font-normal tx1">{rtl ? "منحنی S" : "S-curve"}</div>
                <div className="mt-2 flex h-12 items-end gap-1">
                  {PEX_SCURVE.map((p) => (
                    <div key={p.date} className="flex-1 rounded-t-sm bg-sky-400/35" style={{ height: `${Math.max(6, p.cumPct)}%` }} title={`${p.date} · ${p.cumPct}%`} />
                  ))}
                  <div className="flex-1 rounded-t-sm bg-emerald-400/60" style={{ height: `${Math.max(6, m.overallPct)}%` }} title={`${dataDate} · ${m.overallPct}%`} />
                </div>
                <p className="mt-1 text-[10px] tx3">{rtl ? "میله سبز: پیشرفت واقعی در Data Date" : "Green: actual at data date"}</p>
              </div>
            </div>

            <div className="glass-dark rounded-2xl p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] tx1">{rtl ? "پیشرفت بسته‌های کاری" : "Work package progress"}</span>
                <span className="ms-auto flex flex-wrap items-center gap-2.5 text-[9px] tx3">
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: "#8FE3C8" }} />{rtl ? "واقعی" : "Actual"}</span>
                  <span className="flex items-center gap-1"><i className="h-3 w-0 border-s-2 border-dashed" style={{ borderColor: "#7FB2FF" }} />{rtl ? "برنامه‌ای" : "Planned"}</span>
                </span>
              </div>
              {m.wbsRollup.map((w) => {
                /* انحراف یک بار حساب می‌شود و همان عدد، رنگ و نشانگر
                 * تأخیر را تعیین می‌کند؛ دو محاسبهٔ جدا می‌تواند واگرا شود. */
                const variance = Math.round((w.actualPct - w.plannedPct) * 10) / 10;
                const behind = variance < -3;
                const slip = wbsSlip[w.id] ?? 0;
                return (
                  <div key={w.id} className="mb-2.5 last:mb-0">
                    <div className="flex items-center gap-2 text-[10.5px] tx2">
                      <span className="min-w-0 flex-1 truncate">
                        {w.id} · {rtl ? w.nameFa : w.nameEn} · {rtl ? "وزن" : "w"} {(w.weight * 100).toFixed(1)}%
                      </span>
                      {slip > 0 && (
                        <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] tabular-nums" style={{ background: "#FF9F9F22", color: "#FF9F9F" }} dir="ltr">
                          {rtl ? "تأخیر" : "slip"} +{slip}d
                        </span>
                      )}
                      <span className="w-14 shrink-0 text-end tabular-nums" dir="ltr"
                        style={{ color: behind ? "#FF9F9F" : variance > 3 ? "#8FE3C8" : undefined }}>
                        {variance > 0 ? "+" : ""}
                        {variance}%
                      </span>
                    </div>
                    {/* میله روی محور ۰ تا ۱۰۰؛ نشانگر خط‌چین جای هدف است. */}
                    <div className="relative mt-1 h-2.5 w-full rounded bg-white/10">
                      <div className="h-2.5 rounded" style={{ width: `${w.actualPct}%`, background: behind ? "#FFD48A" : "#8FE3C8" }} />
                      <span className="absolute top-[-2px] h-3.5 w-0 border-s-2 border-dashed" style={{ insetInlineStart: `${w.plannedPct}%`, borderColor: "#7FB2FF" }} />
                    </div>
                  </div>
                );
              })}
              <div className="mt-1 flex justify-between text-[8.5px] tx4 tabular-nums" dir="ltr">
                <span>۰</span><span>۲۰</span><span>۴۰</span><span>۶۰</span><span>۸۰</span><span>۱۰۰</span>
              </div>
              <p className="mt-1.5 text-[9px] tx4">
                {rtl
                  ? "واقعی ÷ برنامه‌ای در Data Date · انحراف کمتر از ۳ واحد منفی = عقب‌افتاده"
                  : "Actual vs planned at data date · variance below −3 units = behind plan"}
              </p>
            </div>

            {/* نمای جدول WBS — همان اعداد میله‌های بالا، برای خواندن دقیق و
                خروجی چاپی. جمع ردیف آخر با جمع وزنی موتور یکی است. */}
            <details className="glass-dark rounded-2xl p-3">
              <summary className="cursor-pointer text-[11.5px] tx1">
                {rtl ? "جدول WBS" : "WBS table"}
                <span className="ms-2 text-[9.5px] tx4">
                  {rtl ? "تجمعی تا Data Date" : "Cumulative to data date"}
                </span>
              </summary>
              <div className="thin-scroll mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-[10.5px]">
                  <thead>
                    <tr className="border-b b-line text-[9.5px] tx3">
                      <th className="px-2 py-1.5 text-start" style={{ width: 56 }}>WBS</th>
                      <th className="px-2 py-1.5 text-start">{rtl ? "نام" : "Name"}</th>
                      <th className="px-2 py-1.5 text-center" style={{ width: 62 }}>{rtl ? "وزن از کل" : "Weight"}</th>
                      <th className="px-2 py-1.5 text-center" style={{ width: 62 }}>{rtl ? "برنامه‌ای" : "Planned"}</th>
                      <th className="px-2 py-1.5 text-center" style={{ width: 62 }}>{rtl ? "واقعی" : "Actual"}</th>
                      <th className="px-2 py-1.5 text-center" style={{ width: 60 }}>{rtl ? "انحراف" : "Var"}</th>
                      <th className="px-2 py-1.5 text-center" style={{ width: 52 }}>{rtl ? "فعالیت" : "Acts"}</th>
                      <th className="px-2 py-1.5 text-center" style={{ width: 56 }}>{rtl ? "لغزش" : "Slip"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y b-line-soft">
                    {m.wbsRollup.map((w) => {
                      const variance = Math.round((w.actualPct - w.plannedPct) * 10) / 10;
                      const slip = wbsSlip[w.id] ?? 0;
                      return (
                        <tr key={w.id} className="glass-row">
                          <td className="px-2 py-1.5 font-mono tx3" dir="ltr">{w.id}</td>
                          <td className="px-2 py-1.5 tx1"><span className="truncate">{rtl ? w.nameFa : w.nameEn}</span></td>
                          <td className="px-2 py-1.5 text-center tabular-nums tx2" dir="ltr">{(w.weight * 100).toFixed(1)}%</td>
                          <td className="px-2 py-1.5 text-center tabular-nums tx3" dir="ltr">{w.plannedPct}%</td>
                          <td className="px-2 py-1.5 text-center tabular-nums tx1" dir="ltr">{w.actualPct}%</td>
                          <td className="px-2 py-1.5 text-center tabular-nums" dir="ltr"
                            style={{ color: variance < -3 ? "#FF9F9F" : variance > 3 ? "#8FE3C8" : undefined }}>
                            {variance > 0 ? "+" : ""}
                            {variance}
                          </td>
                          <td className="px-2 py-1.5 text-center tabular-nums tx3" dir="ltr">{w.count}</td>
                          <td className="px-2 py-1.5 text-center tabular-nums" dir="ltr"
                            style={{ color: slip > 0 ? "#FF9F9F" : slip < 0 ? "#8FE3C8" : undefined }}>
                            {slip > 0 ? `+${slip}` : slip}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t b-line text-[10px] tx1">
                      <td className="px-2 py-1.5" colSpan={2}>{rtl ? "جمع پروژه" : "Project total"}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums" dir="ltr">
                        {(m.wbsRollup.reduce((s2, w) => s2 + w.weight, 0) * 100).toFixed(1)}%
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums" dir="ltr">{m.plannedPct}%</td>
                      <td className="px-2 py-1.5 text-center tabular-nums" dir="ltr">{m.overallPct}%</td>
                      <td className="px-2 py-1.5 text-center tabular-nums" dir="ltr"
                        style={{ color: m.variance.deltaPct < 0 ? "#FF9F9F" : m.variance.deltaPct > 0 ? "#8FE3C8" : undefined }}>
                        {m.variance.deltaPct > 0 ? "+" : ""}
                        {m.variance.deltaPct}
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums" dir="ltr">{m.rows.length}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums" dir="ltr">
                        {Math.max(0, ...Object.values(rowSlip))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-2 text-[9px] tx4">
                {rtl
                  ? "وزن هر WBS جمع وزن فعالیت‌هایش است و جمع کل باید ۱۰۰٪ بدهد؛ انحراف = واقعی − برنامه‌ای."
                  : "Each WBS weight is the sum of its activity weights and must total 100%; variance = actual − planned. A lock on the weight means changing it needs a change request."}
              </p>
            </details>

            {/* نمای پیشرفت فعالیت‌ها — همان دادهٔ WBS بالا، یک سطح ریزتر.
                عقب‌افتاده‌ها اول: کاربر برای پیدا کردن مشکل می‌آید، نه
                برای خواندن چهل ردیف سالم. */}
            <details className="glass-dark rounded-2xl p-3">
              <summary className="cursor-pointer text-[11.5px] tx1">
                {rtl ? "وضعیت پیشرفت فعالیت‌ها" : "Activity progress status"}
                <span className="ms-2 text-[9.5px] tx4">
                  {actVisible.length} / {m.rows.length}
                  {actVisible.filter((r) => r.variance < -3).length > 0 &&
                    ` · ${rtl ? "عقب‌افتاده" : "behind"} ${actVisible.filter((r) => r.variance < -3).length}`}
                </span>
              </summary>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={actQuery}
                  onChange={(e) => setActQuery(e.target.value)}
                  placeholder={rtl ? "جستجوی کد، نام یا WBS…" : "Search code, name or WBS…"}
                  className="min-w-[180px] flex-1 rounded-lg border b-line-soft bg-[var(--chip-bg)] px-2 py-1 text-[11px] tx1"
                />
                <div className="flex items-center gap-1">
                  {([
                    { id: "all" as const, fa: "همه", en: "All" },
                    { id: "period" as const, fa: "بازهٔ دورهٔ باز", en: "Open period" },
                  ] as const).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setActScope(v.id)}
                      className={`rounded-lg px-2 py-1 text-[10px] transition ${
                        actScope === v.id ? "toggle-on tx1" : "border b-line-soft tx3"
                      }`}
                    >
                      {rtl ? v.fa : v.en}
                    </button>
                  ))}
                </div>
                {m.openPeriod && (
                  <span className="rounded-lg border b-line-soft px-2 py-1 text-[9.5px] tx3" dir="ltr">
                    {rtl ? "دورهٔ باز" : "Open period"} {m.openPeriod.code} · {m.openPeriod.from} → {m.openPeriod.to}
                  </span>
                )}
              </div>

              {actVisible.length === 0 ? (
                <p className="py-5 text-center text-[10.5px] tx4">
                  {rtl ? "فعالیتی با این فیلتر نیست." : "No activity matches this filter."}
                </p>
              ) : (
                <div className="thin-scroll mt-2 max-h-[380px] overflow-y-auto">
                  <table className="w-full min-w-[620px] border-collapse text-[10.5px]">
                    <thead className="sticky top-0 z-10 bg-[var(--bg-c)]">
                      <tr className="border-b b-line text-[9.5px] tx3">
                        <th className="px-2 py-1.5 text-start" style={{ width: 74 }}>{rtl ? "کد" : "Code"}</th>
                        <th className="px-2 py-1.5 text-start">{rtl ? "فعالیت" : "Activity"}</th>
                        <th className="px-2 py-1.5 text-center" style={{ width: 54 }}>{rtl ? "برنامه‌ای" : "Plan"}</th>
                        <th className="px-2 py-1.5 text-center" style={{ width: 54 }}>{rtl ? "واقعی" : "Actual"}</th>
                        <th className="px-2 py-1.5 text-center" style={{ width: 56 }}>{rtl ? "انحراف" : "Var"}</th>
                        <th className="px-2 py-1.5 text-center" style={{ width: 48 }}>{rtl ? "لغزش" : "Slip"}</th>
                        <th className="px-2 py-1.5 text-center" style={{ width: 104 }}>{rtl ? "نمودار" : "Bar"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y b-line-soft">
                      {actVisible.map((r) => {
                        const behind = r.variance < -3;
                        return (
                          <tr key={r.id} className="glass-row">
                            <td className="px-2 py-1.5 font-mono tx3" dir="ltr">{r.id}</td>
                            <td className="px-2 py-1.5 tx1">
                              <span className="flex items-center gap-1.5">
                                {r.critical && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#FF9F9F" }} />}
                                <span className="truncate">{rtl ? r.nameFa : r.nameEn}</span>
                                <span className="shrink-0 text-[9px] tx4" dir="ltr">WBS {r.wbs}</span>
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-center tabular-nums tx3" dir="ltr">{r.plannedPct}%</td>
                            <td className="px-2 py-1.5 text-center tabular-nums tx1" dir="ltr">{r.physicalPct}%</td>
                            <td className="px-2 py-1.5 text-center tabular-nums" dir="ltr"
                              style={{ color: behind ? "#FF9F9F" : r.variance > 3 ? "#8FE3C8" : undefined }}>
                              {r.variance > 0 ? "+" : ""}
                              {r.variance}
                            </td>
                            <td className="px-2 py-1.5 text-center tabular-nums" dir="ltr"
                              style={{ color: r.slip > 0 ? "#FF9F9F" : r.slip < 0 ? "#8FE3C8" : undefined }}>
                              {r.slip > 0 ? `+${r.slip}` : r.slip}
                            </td>
                            <td className="px-2 py-1.5">
                              <span className="relative block h-2 w-full rounded bg-white/10">
                                <span className="absolute inset-y-0 start-0 rounded" style={{ width: `${r.physicalPct}%`, background: behind ? "#FFD48A" : "#8FE3C8" }} />
                                <span className="absolute top-[-2px] h-3 w-0 border-s-2 border-dashed" style={{ insetInlineStart: `${r.plannedPct}%`, borderColor: "#7FB2FF" }} />
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-2 text-[9px] tx4">
                {rtl
                  ? "همهٔ مقادیر تجمعی تا Data Date هستند؛ «بازهٔ دورهٔ باز» فقط حوزهٔ نمایش را محدود می‌کند، چون ثبت پیشرفت تاریخ ندارد و پیشرفت دوره‌ای بدون تاریخ، عدد ساختگی است."
                  : "All values are cumulative to the data date; the open-period filter only narrows the scope — progress entries carry no date, so a period cut would be a fabricated number."}
              </p>
            </details>
          </div>
        )}

        {tab === "workshop" && (
          <nav className="fade-rise flex flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1">
            {([
              { id: "contract" as const, fa: "قرارداد", en: "Contract" },
              { id: "wbs" as const, fa: "ساختار شکست", en: "Breakdown" },
              ...(showOilfield ? [{ id: "oilfield" as const, fa: "مراحل کاری میدان نفتی", en: "Oilfield work stages" }] : []),
              ...(showPetrochemical ? [{ id: "petrochemical" as const, fa: "مراحل کاری پتروشیمی", en: "Petrochemical work stages" }] : []),
              /* RoC به ساختار شکست می‌چسبد، نه به گزارش روزانه: وزن گام
               * و وزن بسته یک محاسبه‌اند — درصد بسته از گام‌ها، درصد
               * پروژه از بسته‌ها. */
              { id: "roc" as const, fa: "دستورالعمل پیشرفت", en: "Progress rules" },
            ]).map((v) => (
              <button
                key={v.id}
                onClick={() => setShopView(v.id)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-light transition ${
                  shopView === v.id ? "toggle-on tx1" : "tx3 hover:tx1"
                }`}
              >
                {rtl ? v.fa : v.en}
              </button>
            ))}
          </nav>
        )}

        {tab === "workshop" && shopView === "oilfield" && showOilfield && <OilfieldWorkStages lang={lang} />}

        {tab === "workshop" && shopView === "petrochemical" && showPetrochemical && (
          <PetrochemicalWorkStages lang={lang} clusterId={clusterId} />
        )}

        {tab === "workshop" && shopView === "contract" && <ContractWorkshop lang={lang} />}

        {tab === "workshop" && shopView === "wbs" && (
          <div className="fade-rise space-y-2">
            {/* سازندهٔ ساختار شکست لامپ‌سام.
              *
              * پیش از این تب WBS فقط تجمیع وزن‌های موجود را نشان
              * می‌داد؛ راهی برای ساختن ساختار از مبلغ توافقی قرارداد
              * نبود. سازنده بالای همان نما می‌نشیند تا نمای تحلیلی
              * پایین دست‌نخورده بماند. */}
            <BreakdownBuilder lang={lang} />

            <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-3 text-[11px]">
              <span className="tx3">{rtl ? "روش وزن‌دهی (PMS)" : "Weight mode (PMS)"}</span>
              {(["Cost", "MH", "Hybrid"] as WeightMode[]).map((wm) => (
                <button
                  key={wm}
                  onClick={() => setWeightMode(wm)}
                  className={`rounded-lg px-2.5 py-1 text-[10.5px] transition ${weightMode === wm ? "toggle-on tx1" : "border b-line-soft tx3"}`}
                >
                  {wm}
                </button>
              ))}
              {weightMode === "Hybrid" && (
                <span className="flex items-center gap-2 tx3">
                  α {alpha.toFixed(1)} / β {(1 - alpha).toFixed(1)}
                  <input type="range" min={0} max={1} step={0.1} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} className="h-1 w-24" />
                </span>
              )}
              <span className="ms-auto text-[10px] tx4">{rtl ? "Σ وزن فرزندان = ۱ · تغییر ساختار فقط با CR" : "Σ child weights = 1 · structure change needs CR"}</span>
            </div>
            {m.wbsRollup.map((w) => (
              <div key={w.id} className="glass-dark rounded-2xl p-3">
                <div className="flex flex-wrap items-center gap-2 text-[12px] tx1">
                  <span className="font-mono text-emerald-300" dir="ltr">{w.id}</span>
                  {rtl ? w.nameFa : w.nameEn}
                  <span className="ms-auto text-[10.5px] tx3" dir="ltr">w {(w.weight * 100).toFixed(1)}% · {w.actualPct}%</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {m.rows.filter((r) => r.wbs === w.id).map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 border-b b-line-soft pb-1 text-[11px] last:border-0">
                      <span className="font-mono tx2" dir="ltr">{r.id}</span>
                      <span className="tx1">{rtl ? r.nameFa : r.nameEn}</span>
                      <span className="tx4" dir="ltr">RoC {r.roc}</span>
                      <span className="ms-auto tx3" dir="ltr">w {(r.weight * 100).toFixed(1)}%</span>
                      <span className="w-14 text-end tabular-nums" style={{ color: r.physicalPct + 3 < r.plannedPct ? "#FFD48A" : "#8FE3C8" }}>{r.physicalPct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {tab === "baseline" && (
          <div className="fade-rise space-y-2">
            {/* ورود برنامه از پنل حذف‌شدهٔ «منابع داده» به همین صفحهٔ
              * زمان‌بندی/گانت منتقل شده است. */}
            <ScheduleImportActions lang={lang} projectId={projectId} onImported={() => void reloadSchedule()} />
            <nav className="flex flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1">
              {([
                { id: "baseline" as const, fa: "برنامه پایه", en: "Baseline" },
                { id: "scurve" as const, fa: "نمودار اسکرو", en: "S-Curve" },
                { id: "gantt" as const, fa: "گانت تعاملی", en: "Interactive Gantt" },
                { id: "milestone" as const, fa: "ردیابی مایلستون", en: "Milestones" },
                { id: "cp" as const, fa: "تحلیل مسیر بحرانی", en: "Critical Path" },
                { id: "lookahead" as const, fa: "نگاه‌به‌جلو", en: "Look-ahead" },
              ]).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setPlanView(v.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-light transition ${
                    planView === v.id ? "toggle-on tx1" : "tx3 hover:tx1"
                  }`}
                >
                  {rtl ? v.fa : v.en}
                </button>
              ))}
            </nav>
          </div>
        )}

        {tab === "baseline" && planView === "scurve" && (
          /* همان منحنی و همان اعداد موتور — عمداً از مدل گرفته می‌شود نه
           * از سری نمونه، وگرنه درصدِ این تب با درصد داشبورد در همین
           * ماژول یکی نبود. */
          <BaselineSCurvePanel
            lang={lang}
            curve={PEX_SCURVE}
            dataDate={dataDate}
            actualPct={m.overallPct}
            plannedPct={m.plannedPct}
            baselineFinish={m.baseline.projectFinish}
            forecastFinish={m.cpm.projectFinish}
          />
        )}

        {tab === "baseline" && planView === "gantt" && (
          <InteractiveGantt lang={lang} activities={ganttFromSchedule} />
        )}

        {tab === "baseline" && planView === "baseline" && (
          <div className="fade-rise space-y-2">
            {/* نوار فشرده به‌جای چهار کارت با فضای خالی. */}
            <div className="glass-dark flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-3 py-2">
              {[
                { k: rtl ? "شناسه برنامه پایه" : "Baseline id", v: m.project.baselineId, c: undefined as string | undefined, s: "" },
                { k: rtl ? "پایان پایه" : "Baseline finish", v: m.baseline.projectFinish, c: undefined, s: "" },
                {
                  k: rtl ? "پایان پیش‌بینی" : "Current finish",
                  v: m.cpm.projectFinish,
                  c: m.snapshot.drift > 0 ? "#FF9F9F" : m.snapshot.drift < 0 ? "#8FE3C8" : undefined,
                  s: "",
                },
                {
                  k: rtl ? "رانش کل" : "Total drift",
                  v: `${m.snapshot.drift > 0 ? "+" : ""}${m.snapshot.drift}`,
                  c: m.snapshot.drift > 0 ? "#FF9F9F" : m.snapshot.drift < 0 ? "#8FE3C8" : undefined,
                  s: rtl ? "روز کاری" : "wd",
                },
              ].map((x) => (
                <span key={x.k} className="flex items-baseline gap-1.5">
                  <span className="text-[10.5px] tx3">{x.k}</span>
                  <span className="text-[15px] tabular-nums" style={{ color: x.c }} dir="ltr">{x.v}</span>
                  {x.s && <span className="text-[10px] tx4">{x.s}</span>}
                </span>
              ))}
            </div>

            {/* توزیع انحراف — پیش از این فقط جدول خام بود و برای فهمیدن
              * «چند فعالیت عقب است» باید ردیف‌ها شمرده می‌شد. */}
            <div className="glass-dark rounded-2xl p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] tx1">{rtl ? "انطباق با برنامه پایه" : "Baseline conformance"}</span>
                <span className="ms-auto text-[9.5px] tx4">
                  {rtl ? `${blStats.total} فعالیت` : `${blStats.total} activities`}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                {[
                  { n: blStats.ahead, c: "#8FE3C8" },
                  { n: blStats.onTime, c: "#7FB2FF" },
                  { n: blStats.late, c: "#FF9F9F" },
                ].map((seg, i) => (
                  <div key={i} style={{ width: `${(seg.n / Math.max(1, blStats.total)) * 100}%`, background: seg.c }} />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-[9.5px]">
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: "#8FE3C8" }} /> {rtl ? "جلوتر" : "ahead"} {blStats.ahead}</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: "#7FB2FF" }} /> {rtl ? "طبق برنامه" : "on time"} {blStats.onTime}</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: "#FF9F9F" }} /> {rtl ? "عقب" : "late"} {blStats.late}</span>
                <span className="ms-auto tx4">
                  {rtl ? "بیشترین لغزش:" : "worst:"} <b style={{ color: blStats.worst > 0 ? "#FF9F9F" : "#8FE3C8" }} dir="ltr">{blStats.worst > 0 ? `+${blStats.worst}` : blStats.worst}</b>
                </span>
              </div>
            </div>

            <div className="glass-dark overflow-x-auto rounded-2xl p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] tx1">{rtl ? "مقایسهٔ فعالیت‌ها با برنامه پایه" : "Activity vs baseline"}</span>
                <button
                  onClick={() => setBlOnlyLate((v) => !v)}
                  className={`ms-auto rounded-lg px-2 py-0.5 text-[9.5px] transition ${blOnlyLate ? "toggle-on tx1" : "border b-line-soft tx3 hover:tx1"}`}
                >
                  {rtl ? "فقط عقب‌افتاده‌ها" : "Late only"}
                </button>
              </div>

              {blRows.length === 0 ? (
                <div className="py-6 text-center text-[10.5px] tx4">
                  {rtl ? "فعالیت عقب‌افتاده‌ای نیست." : "No late activity."}
                </div>
              ) : (
                <table className="w-full min-w-[760px] border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b b-line text-[9.5px] tx3">
                      <th className="px-2 py-2 text-start" style={{ width: 76 }}>{rtl ? "شناسه" : "Code"}</th>
                      <th className="px-2 py-2 text-start">{rtl ? "نام فعالیت" : "Activity"}</th>
                      <th className="px-2 py-2 text-center" style={{ width: 92 }}>{rtl ? "شروع پایه" : "BL start"}</th>
                      <th className="px-2 py-2 text-center" style={{ width: 92 }}>{rtl ? "پایان پایه" : "BL finish"}</th>
                      <th className="px-2 py-2 text-center" style={{ width: 92 }}>{rtl ? "پایان پیش‌بینی" : "Forecast"}</th>
                      <th className="px-2 py-2 text-center" style={{ width: 74 }}>{rtl ? "لغزش" : "Slip"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y b-line-soft">
                    {blRows.map((r) => (
                      <tr key={r.id} className="glass-row">
                        <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{r.id}</td>
                        <td className="px-2 py-1.5 tx1">
                          <span className="flex items-center gap-1.5">
                            {r.critical && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#FF9F9F" }} />}
                            <span className="truncate">{t({ fa: r.nameFa, en: r.nameEn }, lang)}</span>
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums tx3" dir="ltr">{r.baselineStart}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums tx3" dir="ltr">{r.baselineFinish}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums tx1" dir="ltr">{r.ef}</td>
                        <td
                          className="px-2 py-1.5 text-center tabular-nums"
                          style={{ color: r.slip > 0 ? "#FF9F9F" : r.slip < 0 ? "#8FE3C8" : undefined }}
                          dir="ltr"
                        >
                          {r.slip > 0 ? `+${r.slip}` : r.slip}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <p className="mt-2 text-[9.5px] tx4">
                {rtl
                  ? "لغزش بر حسب روز کاری، با همان تقویمی که موتور زمان‌بندی استفاده می‌کند · برنامه پایه مقدس است؛ جابه‌جایی تاریخ‌های پایه فقط با درخواست تغییر تأییدشده."
                  : "Slip in working days, using the same calendar as the scheduling engine · the baseline is fixed; moving baseline dates needs an approved change request."}
              </p>
            </div>
          </div>
        )}

        {tab === "baseline" && planView === "milestone" && (
          <div className="fade-rise space-y-2">
            {/* نوار خلاصه — پیش از این هیچ جمع‌بندی‌ای نبود و کاربر
              * باید ردیف‌ها را می‌شمرد تا بفهمد چند مایلستون در خطر
              * است. */}
            {/* نوار فشرده — همان الگوی تب مسیر بحرانی. */}
            <div className="glass-dark flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-3 py-2">
              {[
                { k: rtl ? "کل مایلستون‌ها" : "Total", v: String(m.milestones.length), c: undefined as string | undefined },
                { k: rtl ? "در خطر / تأخیر" : "At risk", v: String(msAtRisk), c: msAtRisk > 0 ? "#FF9F9F" : "#8FE3C8" },
                { k: rtl ? "بیشترین لغزش" : "Worst slip", v: `${msWorstSlip > 0 ? "+" : ""}${msWorstSlip}`, c: msWorstSlip > 0 ? "#FF9F9F" : "#8FE3C8" },
                {
                  k: rtl ? "خالص جریمه/پاداش" : "Net LD / bonus",
                  /* علامت داخل خود مقدار می‌آید تا شرط رشته‌ای روی
                   * برچسب لازم نباشد؛ آن شرط با تغییر ترجمه می‌شکست. */
                  v: `${msNet === 0 ? "" : msNet < 0 ? "−" : "+"}${fmtNum(Math.abs(msNet))}`,
                  c: msNet < 0 ? "#FF9F9F" : msNet > 0 ? "#8FE3C8" : undefined,
                },
              ].map((x) => (
                <span key={x.k} className="flex items-baseline gap-1.5">
                  <span className="text-[10.5px] tx3">{x.k}</span>
                  <span className="text-[15px] tabular-nums" style={{ color: x.c }} dir="ltr">{x.v}</span>
                </span>
              ))}
            </div>

            <div className="glass-dark overflow-x-auto rounded-2xl p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] tx1">{rtl ? "ردیابی مایلستون" : "Milestone tracking"}</span>
                {/* فیلتر وضعیت: در پروژهٔ بزرگ، پیدا کردن مایلستون‌های
                  * تأخیردار میان ده‌ها ردیف سالم دشوار است. */}
                <div className="ms-auto flex flex-wrap items-center gap-1">
                  {(["all", "AtRisk", "Delayed", "Achieved"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setMsFilter(f)}
                      className={`rounded-lg px-2 py-0.5 text-[9.5px] transition ${msFilter === f ? "toggle-on tx1" : "border b-line-soft tx3 hover:tx1"}`}
                    >
                      {f === "all"
                        ? (rtl ? "همه" : "All")
                        : f === "AtRisk" ? (rtl ? "در خطر" : "At risk")
                        : f === "Delayed" ? (rtl ? "تأخیر" : "Delayed")
                        : (rtl ? "محقق" : "Achieved")}
                    </button>
                  ))}
                </div>
              </div>

              {msVisible.length === 0 ? (
                <div className="py-6 text-center text-[10.5px] tx4">
                  {rtl ? "مایلستونی با این وضعیت نیست." : "No milestone in this state."}
                </div>
              ) : (
                <table className="w-full min-w-[900px] border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b b-line text-[9.5px] tx3">
                      <th className="px-2 py-2 text-start" style={{ width: 116 }}>{rtl ? "شناسه" : "Code"}</th>
                      <th className="px-2 py-2 text-start">{rtl ? "عنوان" : "Title"}</th>
                      <th className="px-2 py-2 text-center" style={{ width: 78 }}>{rtl ? "نوع" : "Type"}</th>
                      <th className="px-2 py-2 text-center" style={{ width: 84 }}>{rtl ? "وضعیت" : "Status"}</th>
                      <th className="px-2 py-2 text-center" style={{ width: 92 }}>{rtl ? "تاریخ قراردادی" : "Contractual"}</th>
                      <th className="px-2 py-2 text-center" style={{ width: 92 }}>{rtl ? "پیش‌بینی" : "Forecast"}</th>
                      <th className="px-2 py-2 text-center" style={{ width: 64 }}>{rtl ? "لغزش" : "Slip"}</th>
                      <th className="px-2 py-2 text-center" style={{ width: 96 }}>{rtl ? "جریمه / پاداش" : "LD / bonus"}</th>
                      <th className="px-2 py-2 text-center" style={{ width: 64 }}>{rtl ? "تشدید" : "Esc."}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y b-line-soft">
                    {msVisible.map((x) => (
                      <tr key={x.id} className="glass-row">
                        <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{x.id}</td>
                        <td className="px-2 py-1.5 tx1">{t({ fa: x.nameFa, en: x.nameEn }, lang)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className="rounded border b-line-soft px-1.5 py-0.5 text-[9px] tx3">{x.type}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span
                            className="rounded px-2 py-0.5 text-[9.5px]"
                            style={{ background: `${STATUS_COLOR[x.status]}22`, color: STATUS_COLOR[x.status] }}
                          >
                            {rtl ? MS_STATUS_FA[x.status] : x.status}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums tx3" dir="ltr">{x.contractualDate}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums tx1" dir="ltr">{x.forecastDate}</td>
                        <td
                          className="px-2 py-1.5 text-center tabular-nums"
                          style={{ color: x.slipDays > 0 ? "#FF9F9F" : x.slipDays < 0 ? "#8FE3C8" : undefined }}
                          dir="ltr"
                        >
                          {x.slipDays > 0 ? `+${x.slipDays}` : x.slipDays}
                        </td>
                        {/* جریمه و پاداش دو چیز متضادند و نباید یک رنگ
                          * باشند. پیش از این پاداش هم قرمز چاپ می‌شد و
                          * «+۱۰٬۰۰۰» شبیه بدهی دیده می‌شد. */}
                        <td className="px-2 py-1.5 text-center tabular-nums" dir="ltr">
                          {x.penalty ? (
                            <span style={{ color: "#FF9F9F" }}>−{fmtNum(x.penalty)}</span>
                          ) : x.bonus ? (
                            <span style={{ color: "#8FE3C8" }}>+{fmtNum(x.bonus)}</span>
                          ) : (
                            <span className="tx4">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {x.escalation ? (
                            <span
                              className="rounded px-1.5 py-0.5 text-[9px]"
                              style={{
                                background: x.escalation >= 3 ? "rgba(255,159,159,.18)" : x.escalation === 2 ? "rgba(255,212,138,.18)" : "rgba(154,164,178,.18)",
                                color: x.escalation >= 3 ? "#FF9F9F" : x.escalation === 2 ? "#FFD48A" : "#9AA4B2",
                              }}
                            >
                              L{x.escalation}
                            </span>
                          ) : (
                            <span className="tx4">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <p className="mt-2 text-[9.5px] tx4">
                {rtl
                  ? "پیش‌بینی هر مایلستون = زودترین پایان فعالیت راننده در CPM · لغزش مثبت یعنی تأخیر نسبت به تاریخ قراردادی · سطح تشدید: کمتر از ۳ روز L1، کمتر از ۷ روز L2، ۷ روز و بیشتر L3"
                  : "Forecast = driver activity early finish · positive slip means late against the contractual date · escalation: under 3d L1, under 7d L2, 7d or more L3"}
              </p>
            </div>
          </div>
        )}

        {tab === "baseline" && planView === "cp" && (
          <div className="fade-rise space-y-2">
            {/* نوار فشردهٔ شاخص‌ها.
              *
              * پیش از این چهار کارت بزرگ بودند که هرکدام یک عدد کوچک
              * داشتند و بقیه‌اش فضای خالی. حالا یک نوار افقی: همان
              * اطلاعات، یک‌سوم ارتفاع. */}
            <div className="glass-dark flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl px-3 py-2">
              {[
                { k: rtl ? "طول مسیر بحرانی" : "CP length", v: `${m.cpm.cpLengthDays}`, s: rtl ? "روز" : "d" },
                { k: rtl ? "در برنامه پایه" : "Baseline", v: `${m.baseline.cpLengthDays}`, s: rtl ? "روز" : "d" },
                {
                  k: rtl ? "رانش" : "Drift",
                  v: `${m.snapshot.drift > 0 ? "+" : ""}${m.snapshot.drift}`,
                  s: rtl ? "روز" : "d",
                  c: m.snapshot.drift > 0 ? "#FF9F9F" : m.snapshot.drift < 0 ? "#8FE3C8" : undefined,
                },
              ].map((x) => (
                <span key={x.k} className="flex items-baseline gap-1.5">
                  <span className="text-[9.5px] tx3">{x.k}</span>
                  <span className="text-[14px] tabular-nums" style={{ color: x.c }} dir="ltr">{x.v}</span>
                  <span className="text-[9px] tx4">{x.s}</span>
                </span>
              ))}

              {/* سلامت با نوار، چون درصد تنها حس نسبت نمی‌دهد. */}
              <span className="ms-auto flex items-center gap-2">
                <span className="text-[9.5px] tx3">{rtl ? "سلامت برنامه" : "Health"}</span>
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${m.dcma.healthScore}%`,
                      background: m.dcma.healthScore >= 80 ? "#8FE3C8" : m.dcma.healthScore >= 60 ? "#FFD48A" : "#FF9F9F",
                    }}
                  />
                </span>
                <span className="text-[12px] tabular-nums tx1" dir="ltr">{m.dcma.healthScore}%</span>
                <span
                  className="rounded px-1.5 py-0.5 text-[9.5px]"
                  style={{
                    background: dcmaFailed.length === 0 ? "rgba(110,231,183,.12)" : "rgba(255,159,159,.12)",
                    color: dcmaFailed.length === 0 ? "#8FE3C8" : "#FF9F9F",
                  }}
                >
                  {dcmaFailed.length === 0
                    ? (rtl ? "همه قبول" : "all pass")
                    : (rtl ? `${dcmaFailed.length} مردود` : `${dcmaFailed.length} failed`)}
                </span>
              </span>
            </div>

            {/* چک‌لیست DCMA — جدول فشرده، نه کارت‌های پراکنده.
              *
              * قالب قبلی هر آزمون را در یک کادر جدا می‌گذاشت: ستون‌ها
              * زیر هم نبودند و چهارده کادر نیم صفحه می‌گرفت. جدول
              * ستون‌ها را تراز می‌کند و ارتفاع را نصف. */}
            <div className="glass-dark overflow-x-auto rounded-2xl p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] tx1">{rtl ? "چک‌لیست DCMA ۱۴ آزمونه" : "DCMA 14-point check"}</span>
                <button
                  onClick={() => setDcmaOnlyFailed((v) => !v)}
                  className={`ms-auto rounded-lg px-2 py-0.5 text-[9.5px] transition ${dcmaOnlyFailed ? "toggle-on tx1" : "border b-line-soft tx3 hover:tx1"}`}
                >
                  {rtl ? "فقط مردودها" : "Failed only"}
                </button>
              </div>

              {dcmaVisible.length === 0 ? (
                <div className="py-4 text-center text-[10.5px] ok-t">
                  ✓ {rtl ? "هر چهارده آزمون قبول شده‌اند." : "All fourteen checks pass."}
                </div>
              ) : (
                <table className="w-full min-w-[560px] border-collapse text-[10.5px]">
                  <thead>
                    <tr className="border-b b-line text-[9px] tx3">
                      <th className="px-2 py-1.5 text-center" style={{ width: 34 }}>#</th>
                      <th className="px-2 py-1.5 text-start">{rtl ? "آزمون" : "Check"}</th>
                      <th className="px-2 py-1.5 text-center" style={{ width: 78 }}>{rtl ? "مقدار" : "Value"}</th>
                      <th className="px-2 py-1.5 text-start" style={{ width: 128 }}>{rtl ? "شرط قبولی" : "Threshold"}</th>
                      <th className="px-2 py-1.5 text-center" style={{ width: 46 }}>{rtl ? "نتیجه" : "Result"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y b-line-soft">
                    {dcmaVisible.map((c) => (
                      <tr key={c.id} className="glass-row" style={{ background: c.pass ? undefined : "rgba(255,159,159,.05)" }}>
                        <td className="px-2 py-1 text-center text-[9px] tabular-nums tx4" dir="ltr">{c.id}</td>
                        <td className="px-2 py-1 tx1">{c.nameFa}</td>
                        <td
                          className="px-2 py-1 text-center tabular-nums"
                          style={{ color: c.pass ? undefined : "#FF9F9F" }}
                          dir="ltr"
                        >
                          {formatDcma(c)}
                        </td>
                        <td className="px-2 py-1 text-[9.5px] tx4">{rtl ? c.thresholdFa : c.thresholdEn}</td>
                        <td className="px-2 py-1 text-center">
                          <span style={{ color: c.pass ? "#8FE3C8" : "#FF9F9F" }}>{c.pass ? "✓" : "✕"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="glass-dark overflow-x-auto rounded-2xl p-3">
              <div className="mb-2 text-[11.5px] tx1">{rtl ? "شناوری فعالیت‌ها" : "Activity float"}</div>
              <table className="w-full min-w-[620px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b b-line text-[9.5px] tx3">
                    <th className="px-2 py-2 text-start" style={{ width: 76 }}>{rtl ? "شناسه" : "Code"}</th>
                    <th className="px-2 py-2 text-start">{rtl ? "نام فعالیت" : "Activity"}</th>
                    <th className="px-2 py-2 text-center" style={{ width: 92 }}>{rtl ? "دیرترین شروع" : "Late start"}</th>
                    <th className="px-2 py-2 text-center" style={{ width: 92 }}>{rtl ? "دیرترین پایان" : "Late finish"}</th>
                    <th className="px-2 py-2 text-center" style={{ width: 74 }}>{rtl ? "شناوری کل" : "Total float"}</th>
                    <th className="px-2 py-2 text-center" style={{ width: 74 }}>{rtl ? "شناوری آزاد" : "Free float"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y b-line-soft">
                  {/* کم‌شناورترین اول: همان‌ها هستند که برنامه را تعیین
                    * می‌کنند. ترتیب ورودی هیچ معنایی برای خواننده ندارد. */}
                  {[...m.rows].sort((a, b) => a.totalFloat - b.totalFloat).map((r) => (
                    <tr key={r.id} className="glass-row">
                      <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{r.id}</td>
                      <td className="px-2 py-1.5 tx1">
                        <span className="flex items-center gap-1.5">
                          {r.critical && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#FF9F9F" }} />}
                          <span className="truncate">{t({ fa: r.nameFa, en: r.nameEn }, lang)}</span>
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums tx3" dir="ltr">{r.ls}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums tx3" dir="ltr">{r.lf}</td>
                      <td
                        className="px-2 py-1.5 text-center tabular-nums"
                        style={{ color: r.totalFloat <= 0 ? "#FF9F9F" : r.totalFloat <= 10 ? "#FFD48A" : undefined }}
                      >
                        {r.totalFloat}
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums tx2">{r.freeFloat}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[9.5px] tx4">
                {rtl
                  ? "شناوری کل = تأخیر ممکن بدون تغییر پایان پروژه · شناوری آزاد = تأخیر ممکن بدون تأثیر بر فعالیت بعدی"
                  : "Total float = delay possible without moving project finish · Free float = delay without affecting the next activity"}
              </p>

              {/* زنجیره و نزدیک‌بحرانی، زیر همین جدول.
                *
                * کارت‌های جداگانه‌شان حذف شد: هر دو فهرست کوتاهی از
                * همان فعالیت‌های این جدول‌اند، پس جای طبیعی‌شان پای
                * خودِ جدول است نه دو قاب مستقل بالای صفحه. */}
              <div className="mt-2 space-y-1.5 border-t b-line-soft pt-2">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="shrink-0 text-[9.5px] tx3">
                    {rtl ? "زنجیرهٔ مسیر بحرانی" : "Critical path"}
                    <span className="ms-1 tx4">({m.cpm.criticalPath.length})</span>
                  </span>
                  {m.cpm.criticalPath.length === 0 ? (
                    <span className="text-[9.5px] tx4">{rtl ? "شناسایی نشد." : "None."}</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1" dir="ltr">
                      {m.cpm.criticalPath.map((id, i) => (
                        <span key={id} className="flex items-center gap-1">
                          {i > 0 && <span className="text-[9px] tx4">→</span>}
                          <span className="rounded bg-rose-400/10 px-1.5 py-0.5 font-mono text-[9.5px] text-rose-300">{id}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="shrink-0 text-[9.5px] tx3">
                    {rtl ? "نزدیک‌بحرانی" : "Near-critical"}
                    <span className="ms-1 tx4">({rtl ? "شناوری ≤ ۱۰" : "float ≤ 10"})</span>
                  </span>
                  {m.nearCritical.length === 0 ? (
                    <span className="text-[9.5px] tx4">{rtl ? "موردی نیست." : "None."}</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1">
                      {m.nearCritical.map((r) => (
                        <span
                          key={r.id}
                          className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[9.5px] text-sky-300"
                          title={t({ fa: r.nameFa, en: r.nameEn }, lang)}
                        >
                          <span className="font-mono" dir="ltr">{r.id}</span>
                          <span
                            className="ms-1 tabular-nums"
                            style={{ color: r.totalFloat <= 5 ? "#FFD48A" : undefined }}
                            dir="ltr"
                          >
                            {r.totalFloat}
                          </span>
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "baseline" && planView === "lookahead" && (
          /* جدول واقعی، نه ردیف flex با justify-between.
           *
           * پیش از این هر ردیف یک flex بود و ستون‌ها هرجا که طول متن
           * اجازه می‌داد می‌افتادند؛ نام بلند بقیه را جلو می‌راند و
           * چشم نمی‌توانست تاریخ‌ها را با هم مقایسه کند. با جدول،
           * عرض هر ستون ثابت است و مقادیر زیر هم قرار می‌گیرند. */
          <div className="fade-rise glass-dark overflow-x-auto rounded-2xl p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] tx3">
              <span>{rtl ? "پنجره ۶ هفته از Data Date" : "6-week window from data date"}</span>
              <span className="tx4">· {lookahead.length} {rtl ? "فعالیت" : "activities"}</span>
              <span className="ms-auto" dir="ltr">{dataDate} → 2026-10-16</span>
            </div>

            {lookahead.length === 0 ? (
              <div className="py-6 text-center text-[10.5px] tx4">
                {rtl ? "در این پنجره فعالیتی باز نیست." : "No open activity in this window."}
              </div>
            ) : (
              <table className="w-full min-w-[680px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b b-line text-[9.5px] tx3">
                    <th className="px-2 py-2 text-start" style={{ width: 76 }}>{rtl ? "شناسه" : "Code"}</th>
                    <th className="px-2 py-2 text-start">{rtl ? "نام فعالیت" : "Activity"}</th>
                    <th className="px-2 py-2 text-center" style={{ width: 92 }}>{rtl ? "شروع" : "Start"}</th>
                    <th className="px-2 py-2 text-center" style={{ width: 92 }}>{rtl ? "پایان" : "Finish"}</th>
                    <th className="px-2 py-2 text-center" style={{ width: 56 }}>{rtl ? "شناوری" : "Float"}</th>
                    <th className="px-2 py-2 text-center" style={{ width: 64 }}>{rtl ? "برنامه‌ای" : "Planned"}</th>
                    <th className="px-2 py-2 text-center" style={{ width: 64 }}>{rtl ? "واقعی" : "Actual"}</th>
                    <th className="px-2 py-2 text-center" style={{ width: 66 }}>{rtl ? "انحراف" : "Var"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y b-line-soft">
                  {lookahead.map((r) => {
                    /* انحراف یک بار حساب می‌شود و همان هم رنگ را
                     * تعیین می‌کند؛ دو محاسبهٔ جدا می‌تواند واگرا شود
                     * و عددِ زرد با عددِ نوشته‌شده نخواند. */
                    const variance = Math.round((r.physicalPct - r.plannedPct) * 10) / 10;
                    const behind = variance < -3;
                    return (
                      <tr key={r.id} className="glass-row">
                        <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{r.id}</td>
                        <td className="px-2 py-1.5 tx1">{t({ fa: r.nameFa, en: r.nameEn }, lang)}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums tx3" dir="ltr">{r.es}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums tx2" dir="ltr">{r.ef}</td>
                        <td
                          className="px-2 py-1.5 text-center tabular-nums"
                          style={{ color: r.totalFloat <= 0 ? "#FF9F9F" : r.totalFloat <= 10 ? "#FFD48A" : undefined }}
                        >
                          {r.totalFloat}
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums tx3">{r.plannedPct}%</td>
                        <td className="px-2 py-1.5 text-center tabular-nums tx1">{r.physicalPct}%</td>
                        <td
                          className="px-2 py-1.5 text-center tabular-nums"
                          style={{ color: behind ? "#FFD48A" : "#8FE3C8" }}
                          dir="ltr"
                        >
                          {variance > 0 ? "+" : ""}{variance}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <p className="mt-2 text-[9.5px] tx4">
              {rtl
                ? "شناوری صفر یا منفی = روی مسیر بحرانی · انحراف منفی بیش از ۳ واحد = عقب‌افتاده"
                : "Zero or negative float = on the critical path · variance below −3 = behind plan"}
            </p>
          </div>
        )}

        {/* تب گزارش روزانه: راهسازی زیرساخت = فرمت کامل؛ نفت/پتروشیمی/حفاری =
            فقط باکس پشتیبان؛ بقیهٔ دامنه‌ها = نمای «ثبت پیشرفت واقعی». */}
        {tab === "dpr" && (
          <div className="fade-rise">
            {isDprFormatActive(clusterId, projectId) ? (
              <DailyReportWorkspace lang={lang} />
            ) : isDprSupportBoxActive(clusterId) ? (
              <DprSupportTables lang={lang} projectCode={dprProjectCode} canEdit={dprCanEdit} />
            ) : (
              <DprProgressFallback lang={lang} model={m} />
            )}
          </div>
        )}

        {/* CPM-2 — DPR زندهٔ پیمانکار (پیش‌نویس→ارسال→تأیید + پیوست عکس/مدرک) */}
        {tab === "dprReg" && (
          <div className="fade-rise">
            <CpmWorkspace lang={lang} initialTab="dpr" hideTabs />
          </div>
        )}

        {/* CPM-1 — حوزهٔ کاری پیمانکاران (تخصیص WBS به پیمانکار) */}
        {tab === "workAreas" && (
          <div className="fade-rise">
            <CpmWorkspace lang={lang} initialTab="areas" hideTabs />
          </div>
        )}

        {/* CPM-3 — گزارش‌های دیسیپلینی (لوله‌کشی/برق/ابزار دقیق/سیویل) */}
        {tab === "discipline" && (
          <div className="fade-rise">
            <CpmWorkspace lang={lang} initialTab="discipline" hideTabs />
          </div>
        )}

        {tab === "weekly" && (
          <div className="fade-rise">
            <WeeklyReportWorkspace lang={lang} projectId={projectId} />
          </div>
        )}

        {tab === "mpr" && (
          <div className="fade-rise">
            <MonthlyReportWorkspace lang={lang} model={m} />
          </div>
        )}

        {tab === "alerts" && (
          <div className="fade-rise space-y-2">
            {m.alerts.length === 0 ? (
              <div className="glass-dark rounded-2xl p-5 text-center text-[12px] text-emerald-300">
                ✓ {rtl ? "هشدار فعالی نیست — همه‌چیز تحت کنترل است." : "No active alerts — all under control."}
              </div>
            ) : (
              <>
                {(() => {
                  const rank: Record<string, number> = { emergency: 0, critical: 1, warning: 2 };
                  const keyOf = (a: (typeof m.alerts)[number], i: number) => `${a.code}-${a.refId ?? i}`;
                  const counts = {
                    total: m.alerts.length,
                    emergency: m.alerts.filter((a) => a.severity === "emergency").length,
                    critical: m.alerts.filter((a) => a.severity === "critical").length,
                    warning: m.alerts.filter((a) => a.severity === "warning").length,
                    unacked: m.alerts.filter((a, i) => !ack[keyOf(a, i)]).length,
                  };
                  const chips: { id: string; fa: string; en: string; color?: string; value: number }[] = [
                    { id: "all", fa: "همه", en: "All", value: counts.total },
                    { id: "emergency", fa: "اضطراری", en: "Emergency", color: SEV_COLOR.emergency, value: counts.emergency },
                    { id: "critical", fa: "بحرانی", en: "Critical", color: SEV_COLOR.critical, value: counts.critical },
                    { id: "warning", fa: "هشدار", en: "Warning", color: SEV_COLOR.warning, value: counts.warning },
                  ];
                  const visible = m.alerts
                    .map((a, i) => ({ a, i }))
                    .filter(({ a }) => alertFilter === "all" || a.severity === alertFilter)
                    .sort((x, y) => (rank[x.a.severity] ?? 3) - (rank[y.a.severity] ?? 3));
                  return (
                    <>
                      <div className="glass-dark flex flex-wrap items-center gap-1.5 rounded-2xl p-2">
                        {chips.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setAlertFilter(c.id)}
                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] transition ${alertFilter === c.id ? "toggle-on tx1" : "b-line-soft tx3 hover:tx1"}`}
                          >
                            {c.color && <i className="h-2 w-2 rounded-full" style={{ background: c.color }} />}
                            {rtl ? c.fa : c.en}
                            <b className="tabular-nums">{c.value}</b>
                          </button>
                        ))}
                        <span className="ms-auto px-2 text-[10px] tx3">
                          {rtl ? "تأییدنشده:" : "Unacknowledged:"} <b className="tabular-nums tx1">{counts.unacked}</b>
                        </span>
                      </div>
                      {visible.map(({ a, i }) => {
                        const key = keyOf(a, i);
                        const color = SEV_COLOR[a.severity] ?? "#9fb3c8";
                        const done = !!ack[key];
                        return (
                          <div
                            key={key}
                            className="glass-dark flex flex-wrap items-center gap-3 rounded-xl p-3 text-[11px] transition"
                            style={{ borderInlineStart: `3px solid ${color}`, opacity: done ? 0.55 : 1 }}
                          >
                            <span className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[9.5px] font-semibold" style={{ background: `${color}26`, color }}>
                              <i className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                              {a.severity}
                            </span>
                            <span className="font-mono tx3" dir="ltr">{a.code}</span>
                            <span className="tx3">{a.type}</span>
                            <span className="tx1">{a.message}</span>
                            {a.refId && (
                              <button onClick={() => setTab("baseline")} title={rtl ? "مشاهده در برنامه پایه" : "View in baseline"} className="rounded border border-sky-400/40 bg-sky-400/10 px-1.5 py-0.5 font-mono text-[9.5px] text-sky-300 transition hover:bg-sky-400/20" dir="ltr">
                                {a.refId} ↗
                              </button>
                            )}
                            <span className="ms-auto flex items-center gap-2">
                              {done && ackAt[key] && <span className="text-[9px] tx4" dir="ltr">✓ {ackAt[key]}</span>}
                              <button
                                onClick={() => { setAck((s) => ({ ...s, [key]: true })); setAckAt((s) => ({ ...s, [key]: new Date().toLocaleTimeString() })); }}
                                disabled={done}
                                className="rounded-lg border b-line-soft px-2 py-1 text-[10px] tx2 transition enabled:hover:border-emerald-400/50 disabled:opacity-60"
                              >
                                {done ? "ACK ✓" : rtl ? "تأیید وصول" : "Ack"}
                              </button>
                            </span>
                          </div>
                        );
                      })}
                      {visible.length === 0 && <div className="glass-dark rounded-2xl p-4 text-center text-[11px] tx3">{rtl ? "در این سطح هشداری نیست." : "No alerts at this level."}</div>}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {tab === "insight" && <MspAnalysisPanel lang={lang} />}

        {tab === "workshop" && shopView === "roc" && (
          <div className="fade-rise space-y-2">
            {m.rocIssues.length > 0 && (
              <div className="glass-dark rounded-2xl p-3 text-[11px] text-rose-300">
                {rtl ? "دستورهای نامعتبر (Σ ≠ ۱۰۰):" : "Invalid rules (Σ ≠ 100):"} {m.rocIssues.map((x) => `${x.code}=${x.sum}`).join("، ")}
              </div>
            )}
            {Object.entries(m.roc).map(([code, r]) => (
              <div key={code} className="glass-dark rounded-2xl p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-emerald-300" dir="ltr">{code}</span>
                  <span className="text-[12px] tx1">{r.nameFa}</span>
                  <span className="ms-auto text-[10px] tx4">{r.ref}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.steps.map((st) => (
                    <span
                      key={st.code}
                      className="rounded-lg border b-line-soft px-2 py-1 text-[10px]"
                      style={{ color: st.ir ? "#FFD48A" : undefined }}
                      title={st.ir ? (rtl ? "نیازمند تأیید بازرسی" : "requires inspection") : undefined}
                    >
                      {st.nameFa} {st.weight}{st.ir ? " ⚑" : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[9.5px] tx4">{rtl ? "⚑ گام دارای الزام بازرسی؛ بدون IR تأییدشده وارد پیشرفت نمی‌شود." : "⚑ inspection-gated step; excluded until IR approved."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
