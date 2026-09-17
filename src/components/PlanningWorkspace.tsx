import { useEffect, useMemo, useState } from "react";
import { t, type Lang } from "../data/framework";
import { PEX_SCURVE } from "../data/pexProject";
import { buildPexModel } from "../services/pexModel";
import { canPostProgress, workingDaysBetween, type WeightMode } from "../services/planning";
import { getSchedule, type ApiSchedule } from "../services/pexApiClient";
import BreakdownBuilder from "./BreakdownBuilder";
import ContractWorkshop from "./ContractWorkshop";
import InteractiveGantt, { type GanttActivity } from "./InteractiveGantt";
import PexDprPanel from "./PexDprPanel";
import { PEX_ACTIVITIES as PEX_SNAPSHOT_ACTIVITIES, PEX_PROJECT as PEX_SNAPSHOT_PROJECT } from "../data/pexSnapshot";

export type PexTab =
  | "dashboard"
  | "workshop"
  | "wbs"
  | "gantt"
  | "baseline"
  | "milestone"
  | "cp"
  | "lookahead"
  | "dpr"
  | "dprReg"
  | "weekly"
  | "mpr"
  | "reports"
  | "alerts"
  | "template"
  | "roc";

const TABS: { id: PexTab; fa: string; en: string }[] = [
  { id: "dashboard", fa: "داشبورد", en: "Dashboard" },
  { id: "workshop", fa: "کارگاه برنامه‌ریزی", en: "Planning Workshop" },
  { id: "baseline", fa: "برنامه پایه", en: "Baseline" },
  { id: "dpr", fa: "گزارش روزانه", en: "DPR" },
  { id: "weekly", fa: "هفتگی", en: "Weekly" },
  { id: "mpr", fa: "ماهانه", en: "MPR" },
  { id: "reports", fa: "گزارش‌ساز", en: "Reports" },
  { id: "alerts", fa: "هشدار", en: "Alerts" },
  { id: "template", fa: "قالب AI", en: "Templates" },
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
}: {
  lang: Lang;
  initialTab?: PexTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const [tab, setTab] = useState<PexTab>(initialTab);
  const [weightMode, setWeightMode] = useState<WeightMode>("Cost");
  const [alpha, setAlpha] = useState(0.6);
  const [ack, setAck] = useState<Record<string, boolean>>({});
  const [fmt, setFmt] = useState("PDF");
  const [kind, setKind] = useState("External");
  const [dprDate, setDprDate] = useState("2026-09-04");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const [live, setLive] = useState<ApiSchedule | null>(null);

  useEffect(() => {
    let alive = true;
    getSchedule(weightMode, alpha).then((res) => {
      if (alive) setLive(res);
    });
    return () => {
      alive = false;
    };
  }, [weightMode, alpha]);

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
  type PlanView = "baseline" | "gantt" | "milestone" | "cp" | "lookahead";
  const [planView, setPlanView] = useState<PlanView>("baseline");

  /* تب‌های موازی داخل «کارگاه برنامه‌ریزی».
   *
   * کارگاه و ساختار شکست دو ماژول جدا بودند ولی یک زنجیره‌اند: قرارداد
   * وارد می‌شود، ساختار از آن درمی‌آید و وزن می‌گیرد. جدا بودنشان یعنی
   * کاربر برای دیدن نتیجهٔ استخراج باید ماژول عوض می‌کرد. */
  const [shopView, setShopView] = useState<"contract" | "wbs" | "roc">("contract");

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

  const kpis = useMemo(
    () => [
      { k: rtl ? "پیشرفت واقعی" : "Actual", v: `${m.overallPct}%`, c: "#8FE3C8" },
      { k: rtl ? "برنامه‌ای" : "Planned", v: `${m.plannedPct}%`, c: "#7FB2FF" },
      { k: rtl ? "انحراف" : "Variance", v: `${m.variance.deltaPct > 0 ? "+" : ""}${m.variance.deltaPct}`, c: m.variance.status === "behind" ? "#FF9F9F" : "#8FE3C8" },
      { k: "PPC", v: `${m.ppcPct}%`, c: "#C9A7FF" },
      { k: rtl ? "سلامت زمان‌بندی" : "Health", v: String(m.dcma.healthScore), c: m.dcma.healthScore < 80 ? "#FFD48A" : "#8FE3C8" },
      { k: rtl ? "جریمه برآوردی" : "Penalty est.", v: `${Math.round(m.totalPenalty / 1000)}k`, c: "#FF9F9F" },
    ],
    [rtl, m]
  );

  const postGate = canPostProgress(m.openPeriod, dprDate);
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
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/40 bg-emerald-400/10 text-[16px]">🧭</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-semibold tx1">
              {rtl ? "برنامه‌ریزی و اجرای عملیات (PEX)" : "Planning & Execution (PEX)"}
            </h3>
            <p className="text-[9.5px] font-extralight tx3">
              {rtl
                ? "WBS ستون فقرات · Baseline قفل · Excel/XER ظرف · پیشرفت فقط Approved · Forecast مایلستون = CPM EF"
                : "WBS backbone · locked baseline · Excel/XER vessel · EV from Approved only · MS forecast = CPM EF"}
            </p>
          </div>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[10px] tx3" dir="ltr">{m.project.code} · DataDate {dataDate}</span>
          <span className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-200" dir="ltr">{m.cpm.formulaVersion}</span>
          <span
            className="rounded-lg px-2 py-1 text-[10px]"
            style={live ? { background: "#8FE3C822", color: "#8FE3C8" } : { background: "#FFD48A22", color: "#FFD48A" }}
            title={live ? "/api/pex/schedule" : rtl ? "بک‌اند در دسترس نیست؛ محاسبه محلی با همان موتور" : "backend unavailable; local engine"}
          >
            {live ? (rtl ? "داده زنده" : "live") : rtl ? "محاسبه محلی" : "local"}
          </span>
        </div>
      </section>

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

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === "dashboard" && (
          <div className="fade-rise space-y-2">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {kpis.map((c) => (
                <div key={c.k} className="glass-dark rounded-2xl p-3">
                  <div className="text-[9.5px] font-extralight tx3">{c.k}</div>
                  <div className="mt-1 text-[19px] font-semibold tabular-nums" style={{ color: c.c }}>{c.v}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-2 md:grid-cols-3">
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
              <div className="mb-2 text-[11.5px] tx1">{rtl ? "پیشرفت بسته‌های کاری" : "Work package progress"}</div>
              {m.wbsRollup.map((w) => (
                <div key={w.id} className="mb-2 last:mb-0">
                  <div className="flex justify-between text-[10.5px] tx2">
                    <span>{w.id} · {rtl ? w.nameFa : w.nameEn} · {rtl ? "وزن" : "w"} {(w.weight * 100).toFixed(1)}%</span>
                    <span dir="ltr">{w.actualPct}% / {w.plannedPct}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded bg-white/10">
                    <div className="h-2 rounded" style={{ width: `${w.actualPct}%`, background: w.actualPct + 3 < w.plannedPct ? "#FFD48A" : "#8FE3C8" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "workshop" && (
          <nav className="fade-rise flex flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1">
            {([
              { id: "contract" as const, fa: "قرارداد", en: "Contract" },
              { id: "wbs" as const, fa: "ساختار شکست", en: "Breakdown" },
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
            <nav className="flex flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1">
              {([
                { id: "baseline" as const, fa: "برنامه پایه", en: "Baseline" },
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

        {tab === "dpr" && (
          <div className="fade-rise space-y-2">
            <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-3 text-[11px]">
              <span className="tx3">{rtl ? "تاریخ گزارش" : "Report date"}</span>
              <input
                value={dprDate}
                onChange={(e) => setDprDate(e.target.value)}
                className="rounded border b-line-soft bg-black/20 px-2 py-1 tx1"
                dir="ltr"
              />
              <span className="tx3">{rtl ? "دوره باز" : "Open period"}</span>
              <span className="rounded border b-line-soft px-2 py-1 tx1" dir="ltr">{m.openPeriod.code} · {m.openPeriod.from} → {m.openPeriod.to}</span>
              <span
                className="ms-auto rounded-lg px-2 py-1 text-[10px]"
                style={{ background: postGate.ok ? "#8FE3C822" : "#FF9F9F22", color: postGate.ok ? "#8FE3C8" : "#FF9F9F" }}
              >
                {postGate.ok
                  ? rtl ? "ثبت پیشرفت مجاز" : "posting allowed"
                  : postGate.reason === "period_closed"
                    ? rtl ? "دوره بسته است" : "period closed"
                    : rtl ? "خارج از دوره" : "out of period"}
              </span>
            </div>

            <div className="glass-dark overflow-x-auto rounded-2xl p-3">
              <div className="mb-2 text-[11.5px] tx1">{rtl ? "خطوط پیشرفت گام‌های RoC" : "RoC step progress lines"}</div>
              <table className="w-full min-w-[640px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b b-line-soft text-[10px] tx3">
                    <th className="px-2 py-1.5 text-start">{rtl ? "فعالیت" : "Activity"}</th>
                    <th className="px-2 py-1.5 text-start">RoC</th>
                    <th className="px-2 py-1.5 text-center">{rtl ? "درصد فیزیکی" : "Physical %"}</th>
                    <th className="px-2 py-1.5 text-start">{rtl ? "گام مسدود (بدون IR)" : "Blocked (no IR)"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y b-line-soft">
                  {m.rows.filter((r) => !r.isMilestone).map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{r.id}</td>
                      <td className="px-2 py-1.5 tx3" dir="ltr">{r.roc}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums tx1">{r.physicalPct}%</td>
                      <td className="px-2 py-1.5 text-[10px]" style={{ color: r.blockedSteps.length ? "#FF9F9F" : undefined }}>
                        {r.blockedSteps.length ? r.blockedSteps.join(" · ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[9.5px] tx4">
                {rtl
                  ? "گام دارای الزام بازرسی بدون IR تأییدشده وارد پیشرفت و EV نمی‌شود؛ فقط پیشرفت Approved محاسبه می‌گردد."
                  : "Steps requiring inspection without an approved IR are excluded from progress and EV."}
              </p>
            </div>
          </div>
        )}

        {tab === "dprReg" && (
          <div className="fade-rise">
            <PexDprPanel lang={lang} projectCode={PEX_SNAPSHOT_PROJECT.code} activities={PEX_SNAPSHOT_ACTIVITIES} />
          </div>
        )}

        {tab === "weekly" && (
          <div className="fade-rise space-y-2">
            <div className="glass-dark rounded-2xl p-3 text-[11.5px] tx2">
              {rtl ? "درصد تعهدات انجام‌شده هفته (PPC)" : "Percent Plan Complete"} — <span className="tx1">{m.ppcPct}%</span>
            </div>
            <div className="glass-dark overflow-x-auto rounded-2xl p-3">
              <table className="w-full min-w-[520px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b b-line-soft text-[10px] tx3">
                    <th className="px-2 py-1.5 text-start">{rtl ? "هفته" : "Week"}</th>
                    <th className="px-2 py-1.5 text-start">{rtl ? "فعالیت" : "Activity"}</th>
                    <th className="px-2 py-1.5 text-center">{rtl ? "تعهد" : "Committed"}</th>
                    <th className="px-2 py-1.5 text-center">{rtl ? "انجام" : "Completed"}</th>
                    <th className="px-2 py-1.5 text-center">PPC</th>
                  </tr>
                </thead>
                <tbody className="divide-y b-line-soft">
                  {m.commitments.map((c) => (
                    <tr key={c.activityId}>
                      <td className="px-2 py-1.5 tx3" dir="ltr">{c.week}</td>
                      <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{c.activityId}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums tx2">{c.committed}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums tx2">{c.completed}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums" style={{ color: c.completed / c.committed < 0.8 ? "#FFD48A" : "#8FE3C8" }}>
                        {Math.round((c.completed / c.committed) * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "mpr" && (
          <div className="fade-rise space-y-2">
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                { k: rtl ? "پیشرفت واقعی" : "Actual", v: `${m.overallPct}%` },
                { k: rtl ? "برنامه‌ای" : "Planned", v: `${m.plannedPct}%` },
                { k: rtl ? "وضعیت" : "Status", v: m.variance.status },
                { k: rtl ? "دوره" : "Period", v: m.openPeriod.code },
              ].map((x) => (
                <div key={x.k} className="glass-dark rounded-2xl p-3">
                  <div className="text-[9.5px] tx3">{x.k}</div>
                  <div className="mt-1 text-[14px] tx1" dir="ltr">{x.v}</div>
                </div>
              ))}
            </div>
            <div className="glass-dark rounded-2xl p-3 text-[11px] tx2">
              <p>{rtl ? "خلاصه ماهانه از داده تأییدشده تولید می‌شود:" : "Monthly summary from approved data:"}</p>
              <ul className="mt-2 space-y-1 tx3">
                <li>· {rtl ? "مایلستون‌های در تأخیر" : "Delayed milestones"}: {m.milestones.filter((x) => x.status === "Delayed").length}</li>
                <li>· {rtl ? "جریمه انباشته" : "Accrued penalty"}: <span dir="ltr">{fmtNum(m.totalPenalty)} {m.project.currency}</span></li>
                <li>· {rtl ? "رانش مسیر بحرانی" : "CP drift"}: <span dir="ltr">{m.snapshot.drift}d</span></li>
                <li>· {rtl ? "سلامت زمان‌بندی (DCMA)" : "Schedule health (DCMA)"}: {m.dcma.healthScore}</li>
                <li>· {rtl ? "دوره‌های بسته‌شده" : "Closed periods"}: {m.periods.filter((p) => p.closedAt).map((p) => p.code).join("، ") || "—"}</li>
              </ul>
            </div>
          </div>
        )}

        {tab === "reports" && (
          <div className="fade-rise space-y-2">
            <div className="glass-dark flex flex-wrap gap-2 rounded-2xl p-3 text-[11px]">
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1" style={{ colorScheme: "dark" }}>
                <option>Internal</option>
                <option>External</option>
              </select>
              <select value={fmt} onChange={(e) => setFmt(e.target.value)} className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1" style={{ colorScheme: "dark" }}>
                <option>PDF</option>
                <option>XLSX</option>
                <option>DOCX</option>
              </select>
              <button className="rounded-lg border border-sky-400/40 bg-sky-400/15 px-3 py-1 text-sky-200">{rtl ? "تولید (نمونه)" : "Generate (demo)"}</button>
              <span className="ms-auto text-[10px] tx4">{kind} · {fmt} · {rtl ? "سربرگ A4 با سه لوگو" : "A4 header, three logos"}</span>
            </div>
            <div className="glass-dark rounded-2xl p-3">
              <div className="mb-2 text-[11.5px] tx1">{rtl ? "گزارش‌های استاندارد ماژول" : "Standard module reports"}</div>
              <div className="grid gap-1 sm:grid-cols-2">
                {[
                  ["MS-01", rtl ? "وضعیت مایلستون‌ها" : "Milestone status", `${m.milestones.length}`],
                  ["MS-02", rtl ? "جریمه و پاداش" : "LD & bonus", fmtNum(m.totalPenalty)],
                  ["MS-03", rtl ? "تشدید مایلستون" : "Escalation", String(m.milestones.filter((x) => x.escalation >= 2).length)],
                  ["CP-01", rtl ? "مسیر بحرانی" : "Critical path", String(m.cpm.criticalPath.length)],
                  ["CP-02", rtl ? "نزدیک‌بحرانی" : "Near-critical", String(m.nearCritical.length)],
                  ["CP-03", rtl ? "رانش مسیر بحرانی" : "CP drift", `${m.snapshot.drift}d`],
                  ["CP-04", rtl ? "سلامت DCMA" : "DCMA health", String(m.dcma.healthScore)],
                  ["PMS-01", rtl ? "پیشرفت وزنی WBS" : "WBS weighted progress", `${m.overallPct}%`],
                  ["PMS-02", rtl ? "انحراف برنامه‌ای" : "Progress variance", `${m.variance.deltaPct}`],
                  ["PMS-03", rtl ? "PPC هفتگی" : "Weekly PPC", `${m.ppcPct}%`],
                ].map(([code, name, val]) => (
                  <div key={code} className="flex items-center gap-2 rounded-lg border b-line-soft px-2 py-1.5 text-[10.5px]">
                    <span className="font-mono text-emerald-300" dir="ltr">{code}</span>
                    <span className="tx2">{name}</span>
                    <span className="ms-auto tabular-nums tx1" dir="ltr">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "alerts" && (
          <div className="fade-rise space-y-2">
            {m.alerts.length === 0 && <div className="glass-dark rounded-2xl p-3 text-[11px] tx3">{rtl ? "هشدار فعالی نیست." : "No active alerts."}</div>}
            {m.alerts.map((a, i) => {
              const key = `${a.code}-${a.refId ?? i}`;
              return (
                <div key={key} className="glass-dark flex flex-wrap items-center gap-3 rounded-xl p-3 text-[11px]">
                  <span className="rounded px-2 py-0.5" style={{ background: `${SEV_COLOR[a.severity]}22`, color: SEV_COLOR[a.severity] }}>{a.severity}</span>
                  <span className="font-mono tx3" dir="ltr">{a.code}</span>
                  <span className="tx3">{a.type}</span>
                  <span className="tx1">{a.message}</span>
                  {a.refId && <span className="font-mono text-sky-300" dir="ltr">{a.refId}</span>}
                  <button
                    onClick={() => setAck((s) => ({ ...s, [key]: true }))}
                    className="ms-auto rounded-lg border b-line-soft px-2 py-1 text-[10px] tx2"
                  >
                    {ack[key] ? "ACK" : rtl ? "تأیید وصول" : "Ack"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === "template" && (
          <div className="fade-rise grid gap-2 md:grid-cols-3">
            <div className="glass-dark rounded-2xl p-3 text-[11px] tx2">{rtl ? "بلوک: هدر · جدول · نمودار" : "Blocks: header · table · chart"}</div>
            <div className="glass-dark rounded-2xl p-3 text-[11px] tx1">{rtl ? "بوم WYSIWYG (نمونه)" : "WYSIWYG canvas (demo)"}</div>
            <div className="glass-dark rounded-2xl p-3 text-[11px] tx2">{rtl ? "AI پیشنهاد می‌دهد؛ اعمال فقط پس از Approve" : "AI suggests; apply only after Approve"}</div>
          </div>
        )}

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
