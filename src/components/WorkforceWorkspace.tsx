import { useCallback, useEffect, useMemo, useState } from "react";
import { type Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../services/auditLogger";
import {
  HRM_FORMULA_VERSION,
  IRAN_LABOR_LAW,
  TRADE_BY_CODE,
  TRADE_CATALOG,
  distribute,
  headcountFor,
  hrmEws,
  indirectShare,
  mobilizationVariance,
  obsHealth,
  peakFactor,
  productivityIndex,
  splitHours,
  validateObs,
  validatePlan,
  type MobilizationRequest,
  type ObsNode,
  type PlanLine,
} from "../services/workforce";

/* شش تب = دقیقاً شش زیرماژول ماژول منابع انسانی */
export type HrmTab = "planning" | "timesheet" | "productivity" | "crew" | "onboarding" | "analytics";

const TABS: { id: HrmTab; fa: string; en: string; icon: string; proc: string; deliverable: string }[] = [
  { id: "planning", fa: "برنامه‌ریزی نیرو و OBS", en: "Workforce Planning & OBS", icon: "🗺", proc: "p1", deliverable: "D3" },
  { id: "timesheet", fa: "تایم‌شیت و حضور و غیاب", en: "Timesheet & Attendance", icon: "⏱", proc: "p2", deliverable: "D4" },
  { id: "productivity", fa: "بهره‌وری و عملکرد", en: "Productivity & Performance", icon: "📊", proc: "p3", deliverable: "D5" },
  { id: "crew", fa: "اکیپ و نیروی پیمانکاری", en: "Crews & Subcontracted Labor", icon: "👷", proc: "p4", deliverable: "D6" },
  { id: "onboarding", fa: "پذیرش، احکام و انطباق", en: "Onboarding & Compliance", icon: "🪪", proc: "p5", deliverable: "D7" },
  { id: "analytics", fa: "تحلیل، هیستوگرام و گزارش", en: "Analytics & Histogram", icon: "📈", proc: "p6", deliverable: "D8" },
];

const TODAY = "2026-09-08";

/* ─────────────── داده نمونه (پروژه OG-2401) ─────────────── */

const SAMPLE_OBS: ObsNode[] = [
  { id: "O-1", code: "OG2401", fa: "پروژه OG-2401", en: "Project OG-2401", level: 1, managerId: "مهندس رضایی", wbsLink: [], headcount: 412 },
  { id: "O-2", parentId: "O-1", code: "OG2401.CON", fa: "ساختمان و نصب", en: "Construction", level: 2, managerId: "مهندس کاظمی", wbsLink: [], headcount: 336 },
  { id: "O-3", parentId: "O-1", code: "OG2401.ENG", fa: "مهندسی", en: "Engineering", level: 2, managerId: "مهندس نوری", wbsLink: ["WBS-1.0"], headcount: 28 },
  { id: "O-4", parentId: "O-1", code: "OG2401.HSQ", fa: "ایمنی و کیفیت", en: "HSE & Quality", level: 2, managerId: "مهندس شریفی", wbsLink: [], headcount: 24 },
  { id: "O-5", parentId: "O-1", code: "OG2401.SUP", fa: "پشتیبانی و اداری", en: "Support & Admin", level: 2, managerId: "آقای موسوی", wbsLink: [], headcount: 24 },
  { id: "O-6", parentId: "O-2", code: "OG2401.CON.CIV", fa: "عمران", en: "Civil", level: 3, managerId: "مهندس احمدی", wbsLink: ["WBS-2.1", "WBS-2.2"], headcount: 148 },
  { id: "O-7", parentId: "O-2", code: "OG2401.CON.MEC", fa: "مکانیک و پایپینگ", en: "Mechanical & Piping", level: 3, managerId: "مهندس تقوی", wbsLink: ["WBS-3.1", "WBS-3.2"], headcount: 121 },
  { id: "O-8", parentId: "O-2", code: "OG2401.CON.ELE", fa: "برق و ابزار دقیق", en: "Electrical & Instrument", level: 3, managerId: "مهندس فرهادی", wbsLink: ["WBS-4.1"], headcount: 67 },
  { id: "O-9", parentId: "O-6", code: "OG2401.CON.CIV.A1", fa: "منطقه ۱ — فونداسیون", en: "Area 1 — Foundations", level: 4, managerId: "آقای سلطانی", wbsLink: ["WBS-2.1"], headcount: 86 },
  { id: "O-10", parentId: "O-6", code: "OG2401.CON.CIV.A2", fa: "منطقه ۲ — ابنیه", en: "Area 2 — Buildings", level: 4, managerId: "آقای جعفری", wbsLink: ["WBS-2.2"], headcount: 62 },
  { id: "O-11", parentId: "O-7", code: "OG2401.CON.MEC.A1", fa: "منطقه ۱ — نصب مخازن", en: "Area 1 — Tank Erection", level: 4, managerId: "آقای رستمی", wbsLink: ["WBS-3.1"], headcount: 58 },
  { id: "O-12", parentId: "O-7", code: "OG2401.CON.MEC.A3", fa: "منطقه ۳ — پایپ‌رک", en: "Area 3 — Pipe Rack", level: 4, managerId: "آقای زمانی", wbsLink: ["WBS-3.2"], headcount: 63 },
  { id: "O-13", parentId: "O-8", code: "OG2401.CON.ELE.A1", fa: "منطقه ۱ — کابل‌کشی", en: "Area 1 — Cabling", level: 4, wbsLink: ["WBS-4.1"], headcount: 67 },
  { id: "O-14", parentId: "O-9", code: "OG2401.CON.CIV.A1.CR01", fa: "اکیپ آرماتوربندی ۱", en: "Rebar Crew 1", level: 5, managerId: "استاد کریمی", wbsLink: ["WBS-2.1"], headcount: 24 },
  { id: "O-15", parentId: "O-9", code: "OG2401.CON.CIV.A1.CR02", fa: "اکیپ قالب‌بندی ۲", en: "Formwork Crew 2", level: 5, managerId: "استاد بابایی", wbsLink: ["WBS-2.1"], headcount: 31 },
];

const ALL_WBS = ["WBS-1.0", "WBS-2.1", "WBS-2.2", "WBS-3.1", "WBS-3.2", "WBS-4.1", "WBS-5.1"];

const PERIODS = ["1405-01", "1405-02", "1405-03", "1405-04", "1405-05", "1405-06", "1405-07", "1405-08"];

/** برنامه نیرو: دوره × رسته — دانه داده هم‌سطح با تجمیع تایم‌شیت (L7). */
const SAMPLE_PLAN: PlanLine[] = (() => {
  const mix: { trade: string; obs: string; totalMH: number; shape: "bell" | "front_loaded" | "back_loaded" | "uniform" }[] = [
    { trade: "CIV-RBR", obs: "O-9", totalMH: 41000, shape: "front_loaded" },
    { trade: "CIV-FRM", obs: "O-9", totalMH: 36000, shape: "front_loaded" },
    { trade: "CIV-CNC", obs: "O-9", totalMH: 22000, shape: "bell" },
    { trade: "PIP-FIT", obs: "O-12", totalMH: 48000, shape: "bell" },
    { trade: "WLD-6G", obs: "O-12", totalMH: 39000, shape: "back_loaded" },
    { trade: "MEC-STF", obs: "O-11", totalMH: 27000, shape: "bell" },
    { trade: "ELE-CAB", obs: "O-13", totalMH: 24000, shape: "back_loaded" },
    { trade: "INS-FIT", obs: "O-13", totalMH: 14000, shape: "back_loaded" },
    { trade: "QCM-WLD", obs: "O-4", totalMH: 9000, shape: "uniform" },
    { trade: "HSE-OFF", obs: "O-4", totalMH: 8000, shape: "uniform" },
    { trade: "STF-SUP", obs: "O-2", totalMH: 11000, shape: "uniform" },
    { trade: "GEN-HLP", obs: "O-2", totalMH: 19000, shape: "bell" },
  ];
  // انحراف واقعی نسبت به برنامه — عمداً در دوره‌های میانی کمبود نیرو دارد.
  const actualBias = [1.02, 0.98, 0.93, 0.86, 0.82, 0.88, 0, 0];
  const rows: PlanLine[] = [];
  for (const m of mix) {
    const dist = distribute(PERIODS.length, m.shape);
    PERIODS.forEach((p, i) => {
      const mh = Math.round(m.totalMH * dist[i]);
      if (mh <= 0) return;
      const hc = headcountFor(mh / 22, 8.5); // ۲۲ روز کاری در ماه
      const bias = actualBias[i];
      rows.push({
        id: `PL-${m.trade}-${p}`,
        periodCode: p,
        periodStart: `${p}-01`,
        periodEnd: `${p}-30`,
        tradeCode: m.trade,
        obsNodeId: m.obs,
        plannedHeadcount: hc,
        plannedMH: mh,
        actualHeadcount: bias > 0 ? Math.round(hc * bias) : undefined,
        actualMH: bias > 0 ? Math.round(mh * bias) : undefined,
      });
    });
  }
  return rows;
})();

const SAMPLE_MOB: MobilizationRequest[] = [
  { id: "MOB-0112", tradeCode: "WLD-6G", qty: 18, needByDate: "1405-06-20", status: "in_progress", fulfilledQty: 11, justification: "جبران عقب‌ماندگی جوش پایپ‌رک منطقه ۳", gates: { contract: true, medical: true, hseTraining: false, tradeDocs: true, gatePass: false } },
  { id: "MOB-0113", tradeCode: "PIP-FIT", qty: 24, needByDate: "1405-06-15", status: "approved", fulfilledQty: 0, justification: "پیک نصب اسپول طبق برنامه بازنگری ۳", gates: { contract: true, medical: false, hseTraining: false, tradeDocs: true, gatePass: false } },
  { id: "MOB-0114", tradeCode: "ELE-CAB", qty: 12, needByDate: "1405-07-05", status: "submitted", fulfilledQty: 0, justification: "شروع کابل‌کشی منطقه ۱", gates: { contract: false, medical: false, hseTraining: false, tradeDocs: false, gatePass: false } },
  { id: "MOB-0115", tradeCode: "CIV-RBR", qty: 15, needByDate: "1405-06-01", status: "fulfilled", fulfilledQty: 15, justification: "تکمیل اکیپ آرماتوربندی منطقه ۱", gates: { contract: true, medical: true, hseTraining: true, tradeDocs: true, gatePass: true } },
  { id: "MOB-0116", tradeCode: "GEN-HLP", qty: 30, needByDate: "1405-06-25", status: "draft", fulfilledQty: 0, justification: "پشتیبانی بتن‌ریزی حجیم", gates: { contract: false, medical: false, hseTraining: false, tradeDocs: false, gatePass: false } },
  { id: "MOB-0117", tradeCode: "INS-FIT", qty: 8, needByDate: "1405-08-10", status: "rejected", fulfilledQty: 0, justification: "پیش‌بینی زودهنگام — به دوره بعد موکول شد" },
];

/* مجموع نفر-ساعت فعالیت‌های PEX برای اعتبارسنجی برنامه */
const PEX_TOTAL_MH = SAMPLE_PLAN.reduce((a, l) => a + l.plannedMH, 0);

/* ─────────────── اجزای نمایشی ─────────────── */

function Kpi({ label, value, hint, tone = "tx1" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/15 px-2.5 py-2">
      <div className="text-[8.5px] font-extralight tx3">{label}</div>
      <div className={`text-[13px] font-semibold tabular-nums ${tone}`} dir="ltr">{value}</div>
      {hint && <div className="text-[8px] font-extralight tx4">{hint}</div>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="glass-dark rounded-2xl p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h4 className="text-[11px] font-semibold tx1">{title}</h4>
        {note && <span className="text-[8.5px] font-extralight tx3">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-1 text-start font-normal">{children}</th>;
}

/* `Upcoming` حذف شد: با تحویل D8 هر شش تب زنده‌اند و کارت «در دست
 * ساخت» دیگر مسیری ندارد. نگه داشتنش یعنی نگهداری وعده‌ای که هیچ‌وقت
 * دیده نمی‌شود، و بدتر: اگر روزی تبی بشکند، به‌جای خطا یک صفحهٔ
 * آرام و گمراه‌کننده نشان می‌داد. */

/* ══════════════════════════ کامپوننت اصلی ══════════════════════════ */

export default function WorkforceWorkspace({
  lang,
  initialTab = "planning",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: HrmTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [tab, setTab] = useState<HrmTab>(initialTab);
  const [view, setView] = useState<"obs" | "plan" | "mob">("obs");
  const [obs] = useState<ObsNode[]>(SAMPLE_OBS);
  const [mob, setMob] = useState<MobilizationRequest[]>(SAMPLE_MOB);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string>("O-6");
  useEffect(() => setTab(initialTab), [initialTab]);

  const fmt = (n: number) => n.toLocaleString(rtl ? "fa-IR" : "en-US");

  /* ── محاسبات ── */
  const obsIssues = useMemo(() => validateObs(obs), [obs]);
  const health = useMemo(() => obsHealth(obs, ALL_WBS), [obs]);
  const planIssues = useMemo(() => validatePlan(SAMPLE_PLAN, PEX_TOTAL_MH), []);

  /** تجمیع دوره‌ای برنامه در برابر واقعی — پایه هیستوگرام. */
  const byPeriod = useMemo(
    () =>
      PERIODS.map((p) => {
        const rows = SAMPLE_PLAN.filter((l) => l.periodCode === p);
        return {
          period: p,
          planHC: rows.reduce((a, l) => a + l.plannedHeadcount, 0),
          actualHC: rows.reduce((a, l) => a + (l.actualHeadcount ?? 0), 0),
          planMH: rows.reduce((a, l) => a + l.plannedMH, 0),
          actualMH: rows.reduce((a, l) => a + (l.actualMH ?? 0), 0),
          hasActual: rows.some((l) => l.actualHeadcount !== undefined),
        };
      }),
    []
  );

  const currentPeriod = byPeriod.find((p) => p.period === "1405-06")!;
  const mobVar = mobilizationVariance(currentPeriod.actualHC, currentPeriod.planHC);
  const pkFactor = peakFactor(byPeriod.map((p) => p.planHC));
  const indirect = indirectShare(
    SAMPLE_PLAN.filter((l) => l.periodCode === "1405-06").map((l) => ({ tradeCode: l.tradeCode, headcount: l.plannedHeadcount }))
  );

  /** نمونه بهره‌وری برای نوار وضعیت — از پیشرفت تأییدشده، نه اعلامی (ADR-09). */
  const pi = productivityIndex(48000, 62, 34800);

  /** نمونه تفکیک ساعت برای نمایش آمادگی موتور D4. */
  const sample = splitHours(11.5, { dateIso: "2026-09-07", shift: "day" });
  const otPct = round1((sample.ot / sample.raw) * 100);

  const expiringDocs = 7;
  const alerts = useMemo(
    () => hrmEws({ mobVarPct: mobVar, piWorst: pi.pi, otPct, expiringDocs, indirectPct: indirect }),
    [mobVar, pi.pi, otPct, indirect]
  );

  /* ── ماتریس RAM: ستون C از کارکرد واقعی مشتق می‌شود، نه از اعلام ── */
  const ramRows = useMemo(() => obs.filter((n) => n.level === 3), [obs]);
  const ramFor = (node: ObsNode, wbs: string): "R" | "A" | "C" | "I" | "—" => {
    if (node.wbsLink.includes(wbs)) return "R";
    const children = obs.filter((c) => c.parentId === node.id);
    if (children.some((c) => c.wbsLink.includes(wbs))) return "A";
    if (node.code.includes("HSQ")) return "I";
    return "—";
  };

  const advance = (id: string) => {
    const order: MobilizationRequest["status"][] = ["draft", "submitted", "approved", "in_progress", "fulfilled"];
    setMob((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const i = order.indexOf(m.status);
        if (i < 0 || i === order.length - 1) return m;
        const next = order[i + 1];
        logAudit("HRM_MOB_ADVANCE", "Workforce", `Mobilization ${id}: ${m.status} → ${next}`);
        return { ...m, status: next, fulfilledQty: next === "fulfilled" ? m.qty : m.fulfilledQty };
      })
    );
  };

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /* درخت OBS تخت‌شده با احترام به گره‌های جمع‌شده */
  const visibleObs = useMemo(() => {
    const out: ObsNode[] = [];
    const walk = (parentId?: string) => {
      for (const n of obs.filter((x) => x.parentId === parentId)) {
        out.push(n);
        if (!collapsed.has(n.id)) walk(n.id);
      }
    };
    walk(undefined);
    return out;
  }, [obs, collapsed]);

  const selected = obs.find((n) => n.id === selectedNode);
  const maxHC = Math.max(...byPeriod.map((p) => Math.max(p.planHC, p.actualHC)), 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* هدر */}
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/40 bg-amber-400/10 text-[15px]">👷</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-semibold tx1">
              {rtl ? "مدیریت منابع انسانی و بهره‌وری نیروی کار" : "Human Resources & Workforce Productivity"}
            </h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "هر ساعت به یک فعالیت شارژ می‌شود · بهره‌وری از پیشرفت تأییدشده · نرخ×ساعت فقط برای هزینه پروژه"
                : "every hour charged to an activity · productivity from approved progress · rate×hours for project cost only"}
            </p>
          </div>
          <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold tabular-nums ${Math.abs(mobVar) > 10 ? "bg-rose-400/15 text-rose-300" : "bg-emerald-400/15 text-emerald-300"}`}>
            {rtl ? "انحراف تجهیز" : "Mob var"} {mobVar > 0 ? "+" : ""}{mobVar}%
          </span>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">PI {pi.pi.toFixed(2)}</span>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">HC {fmt(currentPeriod.actualHC)}</span>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3">{rtl ? "داده نمونه" : "Sample data"}</span>
          <span className="rounded-lg border b-line-soft px-2 py-1 font-mono text-[9px] tx3" dir="ltr">{HRM_FORMULA_VERSION} · {TODAY}</span>
        </div>
        {alerts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {alerts.map((a) => (
              <span
                key={a.code}
                className={`rounded-lg px-2 py-0.5 text-[8.5px] ${
                  a.severity === "critical" ? "bg-rose-400/15 text-rose-300" : a.severity === "high" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"
                }`}
              >
                <span dir="ltr">{a.code}</span> · {a.message}
              </span>
            ))}
          </div>
        )}
      </section>

      {!hideTabs && (
        <nav className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl bg-black/15 p-1">
          {TABS.map((it) => (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-light transition ${tab === it.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"}`}
              title={it.proc}
            >
              <span>{it.icon}</span>
              <span>{rtl ? it.fa : it.en}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* ═══ تب ۱: برنامه‌ریزی نیرو، OBS و تجهیز ═══ */}
        {tab === "planning" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Kpi label={rtl ? "نیروی فعال" : "Active headcount"} value={fmt(currentPeriod.actualHC)} hint={`${rtl ? "برنامه" : "plan"} ${fmt(currentPeriod.planHC)}`} />
              <Kpi
                label={rtl ? "انحراف تجهیز" : "Mobilization variance"}
                value={`${mobVar > 0 ? "+" : ""}${mobVar}%`}
                tone={Math.abs(mobVar) > 10 ? "text-rose-300" : "text-emerald-300"}
                hint={rtl ? "آستانه ±۱۰٪" : "threshold ±10%"}
              />
              <Kpi label={rtl ? "ضریب پیک" : "Peak factor"} value={pkFactor.toFixed(2)} tone={pkFactor > 2.5 ? "text-amber-300" : "tx1"} hint={rtl ? "حداکثر ۲.۵" : "max 2.5"} />
              <Kpi label={rtl ? "سهم غیرمستقیم" : "Indirect share"} value={`${indirect}%`} tone={indirect > 25 ? "text-amber-300" : "tx1"} hint={rtl ? "آستانه ۲۵٪" : "threshold 25%"} />
              <Kpi label={rtl ? "پوشش WBS در سازمان" : "OBS→WBS coverage"} value={`${health.wbsCoverage}%`} tone={health.wbsCoverage < 95 ? "text-amber-300" : "text-emerald-300"} />
            </div>

            <nav className="flex flex-wrap items-center gap-1.5 rounded-xl bg-black/15 p-1">
              {([
                { id: "obs", fa: "چارت سازمانی", en: "Org chart", icon: "🌳" },
                { id: "plan", fa: "برنامه نیرو و هیستوگرام", en: "Plan & histogram", icon: "📊" },
                { id: "mob", fa: "تجهیز نیرو", en: "Mobilization", icon: "🚚" },
              ] as const).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[9.5px] font-light transition ${view === v.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"}`}
                >
                  <span>{v.icon}</span>
                  <span>{rtl ? v.fa : v.en}</span>
                </button>
              ))}
            </nav>

            {/* ── نمای ۱: چارت سازمانی ── */}
            {view === "obs" && (
              <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
                <Section
                  title={rtl ? "ساختار شکست سازمانی (OBS)" : "Organization Breakdown Structure"}
                  note={rtl ? "شش سطح · کد فرزند باید با کد والد شروع شود" : "six levels · child code must extend parent code"}
                >
                  <div className="space-y-0.5">
                    {visibleObs.map((n) => {
                      const hasChildren = obs.some((c) => c.parentId === n.id);
                      const issue = obsIssues.find((i) => i.nodeId === n.id);
                      return (
                        <button
                          key={n.id}
                          onClick={() => setSelectedNode(n.id)}
                          className={`glass-row flex w-full items-center gap-2 rounded-lg py-1.5 text-start transition ${selectedNode === n.id ? "row-on" : ""}`}
                          style={{ paddingInlineStart: `${(n.level - 1) * 16 + 8}px`, paddingInlineEnd: "8px" }}
                        >
                          <span
                            onClick={(e) => { e.stopPropagation(); if (hasChildren) toggle(n.id); }}
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded text-[8px] ${hasChildren ? "border b-line-soft tx3" : "tx4"}`}
                          >
                            {hasChildren ? (collapsed.has(n.id) ? "+" : "−") : "·"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[10px] font-light tx1">{rtl ? n.fa : n.en}</span>
                          {issue && (
                            <span className={`shrink-0 rounded px-1 py-[1px] text-[7.5px] ${issue.severity === "error" ? "bg-rose-400/15 text-rose-300" : "bg-amber-400/15 text-amber-200"}`} dir="ltr">
                              {issue.code}
                            </span>
                          )}
                          {n.headcount !== undefined && (
                            <span className="shrink-0 rounded bg-sky-400/10 px-1.5 py-[1px] text-[8px] tabular-nums text-sky-300" dir="ltr">
                              {fmt(n.headcount)}
                            </span>
                          )}
                          <span className="shrink-0 font-mono text-[7.5px] tx4" dir="ltr">L{n.level}</span>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                <div className="space-y-3">
                  <Section title={rtl ? "جزئیات گره" : "Node detail"}>
                    {selected ? (
                      <div className="space-y-1.5 text-[9.5px]">
                        <Row k={rtl ? "کد" : "Code"} v={selected.code} mono />
                        <Row k={rtl ? "عنوان" : "Title"} v={rtl ? selected.fa : selected.en} />
                        <Row k={rtl ? "سطح" : "Level"} v={`L${selected.level}`} mono />
                        <Row k={rtl ? "مسئول" : "Manager"} v={selected.managerId ?? (rtl ? "— تعیین نشده" : "— unassigned")} />
                        <Row k={rtl ? "نفرات" : "Headcount"} v={fmt(selected.headcount ?? 0)} mono />
                        <Row k={rtl ? "پیوند WBS" : "WBS link"} v={selected.wbsLink.length ? selected.wbsLink.join(" · ") : "—"} mono />
                      </div>
                    ) : null}
                  </Section>

                  <Section title={rtl ? "سلامت سازمان" : "Organization health"} note={rtl ? "سه شاخص" : "three indicators"}>
                    <div className="grid grid-cols-3 gap-2">
                      <Kpi label={rtl ? "پوشش WBS" : "WBS coverage"} value={`${health.wbsCoverage}%`} tone={health.wbsCoverage < 95 ? "text-amber-300" : "text-emerald-300"} />
                      <Kpi label={rtl ? "توازن عمق" : "Depth balance"} value={health.depthStdDev.toFixed(2)} tone={health.depthStdDev > 1.5 ? "text-amber-300" : "text-emerald-300"} />
                      <Kpi label={rtl ? "حیطه نظارت" : "Span of control"} value={fmt(Math.round(health.spanOfControl))} tone={health.spanOfControl > 35 ? "text-rose-300" : "text-emerald-300"} />
                    </div>
                    {obsIssues.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {obsIssues.slice(0, 4).map((i, k) => (
                          <li key={k} className="text-[8.5px] font-light tx3">
                            <span className={i.severity === "error" ? "text-rose-300" : "text-amber-200"} dir="ltr">{i.code}</span> · {i.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section title={rtl ? "ماتریس مسئولیت (RAM)" : "Responsibility matrix"} note={rtl ? "ستون مشورتی از کارکرد واقعی مشتق می‌شود" : "consulted column derived from actual charged hours"}>
                    <table className="w-full text-[9px]">
                      <thead className="tx3">
                        <tr className="border-b b-line-soft">
                          <Th>{rtl ? "واحد" : "Unit"}</Th>
                          {ALL_WBS.slice(0, 5).map((w) => (
                            <th key={w} className="px-1 py-1 text-center font-normal" dir="ltr">{w.replace("WBS-", "")}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ramRows.map((n) => (
                          <tr key={n.id} className="border-b b-line-soft/50">
                            <td className="px-2 py-1 tx2">{rtl ? n.fa : n.en}</td>
                            {ALL_WBS.slice(0, 5).map((w) => {
                              const r = ramFor(n, w);
                              return (
                                <td key={w} className="px-1 py-1 text-center">
                                  <span
                                    className={`inline-grid h-4 w-4 place-items-center rounded text-[8px] font-semibold ${
                                      r === "R" ? "bg-emerald-400/20 text-emerald-300"
                                      : r === "A" ? "bg-sky-400/20 text-sky-300"
                                      : r === "I" ? "bg-white/5 tx4" : "tx4"
                                    }`}
                                    dir="ltr"
                                  >
                                    {r === "—" ? "" : r}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Section>
                </div>
              </div>
            )}

            {/* ── نمای ۲: برنامه نیرو و هیستوگرام ── */}
            {view === "plan" && (
              <>
                <Section
                  title={rtl ? "هیستوگرام نیرو — برنامه در برابر واقعی" : "Manpower histogram — plan vs actual"}
                  note={rtl ? "میله روشن: برنامه · میله پررنگ: واقعی" : "light bar: plan · solid bar: actual"}
                >
                  <div className="flex h-48 items-end gap-3 px-1">
                    {byPeriod.map((p) => (
                      <div key={p.period} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                        <div className="flex h-40 w-full items-end justify-center gap-[3px]">
                          <div
                            className="w-1/2 rounded-t bg-sky-400/25"
                            style={{ height: `${(p.planHC / maxHC) * 100}%` }}
                            title={`${rtl ? "برنامه" : "plan"} ${p.planHC}`}
                          />
                          <div
                            className={`w-1/2 rounded-t ${p.actualHC && p.actualHC < p.planHC * 0.9 ? "bg-rose-400/70" : "bg-emerald-400/70"}`}
                            style={{ height: `${(p.actualHC / maxHC) * 100}%` }}
                            title={`${rtl ? "واقعی" : "actual"} ${p.actualHC}`}
                          />
                        </div>
                        <span className="truncate text-[7.5px] tx4" dir="ltr">{p.period.replace("1405-", "")}</span>
                        <span className="text-[8px] tabular-nums tx3" dir="ltr">{p.hasActual ? p.actualHC : "—"}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title={rtl ? "برنامه نیرو بر حسب دوره و رسته" : "Manpower plan by period and trade"} note={`${fmt(PEX_TOTAL_MH)} ${rtl ? "نفر-ساعت برنامه‌ریزی‌شده" : "planned man-hours"}`}>
                  <div className="thin-scroll max-h-72 overflow-auto">
                    <table className="w-full text-[9.5px]">
                      <thead className="tx3">
                        <tr className="border-b b-line-soft">
                          <Th>{rtl ? "دوره" : "Period"}</Th>
                          <Th>{rtl ? "برنامه نفر" : "Plan HC"}</Th>
                          <Th>{rtl ? "واقعی نفر" : "Actual HC"}</Th>
                          <Th>{rtl ? "انحراف" : "Variance"}</Th>
                          <Th>{rtl ? "برنامه نفر-ساعت" : "Plan MH"}</Th>
                          <Th>{rtl ? "واقعی نفر-ساعت" : "Actual MH"}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {byPeriod.map((p) => {
                          const v = p.hasActual ? mobilizationVariance(p.actualHC, p.planHC) : null;
                          return (
                            <tr key={p.period} className="border-b b-line-soft/50">
                              <td className="px-2 py-1 font-mono tx2" dir="ltr">{p.period}</td>
                              <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmt(p.planHC)}</td>
                              <td className="px-2 py-1 tabular-nums tx1" dir="ltr">{p.hasActual ? fmt(p.actualHC) : "—"}</td>
                              <td className={`px-2 py-1 tabular-nums ${v === null ? "tx4" : Math.abs(v) > 10 ? "text-rose-300" : "text-emerald-300"}`} dir="ltr">
                                {v === null ? "—" : `${v > 0 ? "+" : ""}${v}%`}
                              </td>
                              <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{fmt(p.planMH)}</td>
                              <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{p.hasActual ? fmt(p.actualMH) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {planIssues.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {planIssues.map((i, k) => (
                        <span key={k} className={`rounded-lg px-2 py-0.5 text-[8.5px] ${i.severity === "error" ? "bg-rose-400/15 text-rose-300" : "bg-amber-400/15 text-amber-200"}`}>
                          <span dir="ltr">{i.code}</span> · {i.message}
                        </span>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title={rtl ? "کاتالوگ رسته‌های شغلی" : "Trade catalog"} note={`${fmt(TRADE_CATALOG.length)} ${rtl ? "رسته · نرخ استاندارد نیازمند کالیبراسیون با داده تاریخی" : "trades · standard rates require historical calibration"}`}>
                  <div className="thin-scroll max-h-64 overflow-auto">
                    <table className="w-full text-[9.5px]">
                      <thead className="tx3">
                        <tr className="border-b b-line-soft">
                          <Th>{rtl ? "کد" : "Code"}</Th>
                          <Th>{rtl ? "رسته" : "Trade"}</Th>
                          <Th>{rtl ? "گروه" : "Category"}</Th>
                          <Th>{rtl ? "نوع" : "Type"}</Th>
                          <Th>{rtl ? "نرخ استاندارد" : "Std rate"}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {TRADE_CATALOG.map((tr) => (
                          <tr key={tr.code} className="border-b b-line-soft/50">
                            <td className="px-2 py-1 font-mono tx2" dir="ltr">{tr.code}</td>
                            <td className="px-2 py-1 tx1">{rtl ? tr.fa : tr.en}</td>
                            <td className="px-2 py-1 tx3" dir="ltr">{tr.category}</td>
                            <td className="px-2 py-1">
                              <span className={`rounded px-1.5 py-[1px] text-[8px] ${tr.direct ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 tx3"}`}>
                                {tr.direct ? (rtl ? "مستقیم" : "direct") : rtl ? "غیرمستقیم" : "indirect"}
                              </span>
                            </td>
                            <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{tr.stdRate ? `${tr.stdRate} ${tr.uom}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </>
            )}

            {/* ── نمای ۳: تجهیز نیرو ── */}
            {view === "mob" && (
              <>
                <Section title={rtl ? "درخواست‌های تجهیز نیرو" : "Mobilization requests"} note={rtl ? "نفر تازه‌وارد فقط با پنج گیت سبز اجازه ثبت ساعت دارد" : "a new hire may log hours only when all five gates are green"}>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {mob.map((m) => {
                      const trade = TRADE_BY_CODE[m.tradeCode];
                      const gates = m.gates;
                      const green = gates ? Object.values(gates).filter(Boolean).length : 0;
                      const pct = m.qty > 0 ? Math.round((m.fulfilledQty / m.qty) * 100) : 0;
                      return (
                        <div key={m.id} className="rounded-xl border b-line-soft bg-black/15 p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] tx3" dir="ltr">{m.id}</span>
                            <span className={`rounded px-1.5 py-[1px] text-[8px] ${STATUS_TONE[m.status]}`}>{STATUS_LABEL[m.status][rtl ? "fa" : "en"]}</span>
                            <span className="ms-auto text-[9px] tabular-nums tx2" dir="ltr">{fmt(m.fulfilledQty)}/{fmt(m.qty)}</span>
                          </div>
                          <div className="mt-1 text-[10px] font-light tx1">{trade ? (rtl ? trade.fa : trade.en) : m.tradeCode}</div>
                          <div className="mt-0.5 text-[8.5px] font-extralight tx3">{m.justification}</div>
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded bg-white/5">
                            <div className="h-full rounded bg-emerald-400/60" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-1.5 flex items-center gap-1">
                            {gates ? (
                              GATE_KEYS.map((g) => (
                                <span
                                  key={g}
                                  title={GATE_LABEL[g][rtl ? "fa" : "en"]}
                                  className={`h-1.5 flex-1 rounded ${gates[g] ? "bg-emerald-400/70" : "bg-rose-400/40"}`}
                                />
                              ))
                            ) : (
                              <span className="text-[8px] tx4">{rtl ? "بدون گیت" : "no gates"}</span>
                            )}
                            <span className="ms-1 text-[8px] tabular-nums tx4" dir="ltr">{green}/5</span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-[8px] tx4" dir="ltr">{m.needByDate}</span>
                            {!["fulfilled", "rejected", "cancelled"].includes(m.status) && (
                              <button
                                onClick={() => advance(m.id)}
                                className="glass-row rounded-lg px-2 py-1 text-[8.5px] font-light tx2 transition hover:tx1"
                              >
                                {rtl ? "پیشبرد وضعیت ←" : "Advance →"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>

                <Section title={rtl ? "موتور تفکیک ساعت — آماده اتصال در تحویلی ۴" : "Hours split engine — ready, wired in D4"} note={rtl ? "نمونه: ۱۱.۵ ساعت در روز کاری عادی" : "sample: 11.5 hours on a normal working day"}>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                    <Kpi label={rtl ? "ساعت خام" : "Raw"} value={String(sample.raw)} />
                    <Kpi label={rtl ? "عادی" : "Normal"} value={String(sample.normal)} hint={`${rtl ? "سقف" : "cap"} ${IRAN_LABOR_LAW.dailyNormalCap}`} />
                    <Kpi label={rtl ? "اضافه‌کاری" : "Overtime"} value={String(sample.ot)} tone="text-amber-300" hint={`×${IRAN_LABOR_LAW.otFactor}`} />
                    <Kpi label={rtl ? "شب‌کاری" : "Night"} value={String(sample.night)} hint={`×${IRAN_LABOR_LAW.nightFactor}`} />
                    <Kpi label={rtl ? "مازاد رد شده" : "Rejected"} value={String(sample.rejected)} tone={sample.rejected > 0 ? "text-rose-300" : "tx1"} hint={`${rtl ? "سقف مطلق" : "abs cap"} ${IRAN_LABOR_LAW.dailyAbsoluteCap}`} />
                  </div>
                  <p className="mt-2 text-[8.5px] font-extralight tx4">
                    {rtl
                      ? "کاربر فقط ساعت خام را وارد می‌کند؛ تفکیک خروجی موتور است و دستی قابل ویرایش نیست."
                      : "the user enters raw hours only; the split is engine output and cannot be edited by hand."}
                  </p>
                </Section>
              </>
            )}
          </>
        )}

        {/* ═══ تب کارکرد — زنده روی /api/hrm ═══ */}
        {tab === "timesheet" && <TimesheetTab rtl={rtl} userId={userId} />}

        {/* ═══ تب بهره‌وری — زنده روی /api/hrm ═══ */}
        {tab === "productivity" && <ProductivityTab rtl={rtl} userId={userId} />}

        {/* ═══ تب اکیپ و نیروی پیمانکاری — زنده روی /api/hrm ═══ */}
        {tab === "crew" && <CrewTab rtl={rtl} userId={userId} />}

        {/* ═══ تب پذیرش و انطباق — زنده روی /api/hrm ═══ */}
        {tab === "onboarding" && <OnboardingTab rtl={rtl} userId={userId} />}

        {/* ═══ تب تحلیل، هیستوگرام و گزارش — زنده روی /api/hrm ═══ */}
        {tab === "analytics" && <AnalyticsTab rtl={rtl} userId={userId} />}
      </div>
    </div>
  );
}

/* ═══════════════ تب تایم‌شیت (D4) ═══════════════ */

const HRM_PROJECT_ID = "p1";

type Json = Record<string, unknown>;

const TS_TONE: Record<string, string> = {
  draft: "bg-white/5 tx3",
  rejected: "bg-rose-400/15 text-rose-300",
  submitted: "bg-sky-400/15 text-sky-300",
  foreman_approved: "bg-amber-400/15 text-amber-200",
  qc_verified: "bg-violet-400/15 text-violet-300",
  pm_approved: "bg-emerald-400/15 text-emerald-300",
  posted: "bg-emerald-400/25 text-emerald-200",
  locked: "bg-white/10 tx2",
};

type HrmGetResult = {
  data: Json | null;
  denied: boolean;
  unauth: boolean;
  /** پیام فارسی خطا — بدون آن رابط فقط «انجام نشد» می‌گوید. */
  messageFa?: string;
  /** دلایل بستهٔ دروازهٔ انتشار یا جزئیات خطا. */
  reasons?: string[];
};

async function hrmGet(path: string, userId: string): Promise<HrmGetResult> {
  try {
    const res = await fetch(path, { headers: { accept: "application/json", "x-user-id": userId } });
    const ct = res.headers.get("content-type") ?? "";
    const body = ct.includes("application/json") ? await res.json().catch(() => null) : null;

    if (res.status === 401) return { data: null, denied: false, unauth: true };
    if (res.status === 403) {
      return { data: null, denied: true, unauth: false, messageFa: body?.error?.message };
    }
    if (!body) return { data: null, denied: false, unauth: false };
    if (body.ok) return { data: body.data as Json, denied: false, unauth: false };

    /* دلیل خطا به رابط می‌رسد: «سند صادر نشد» بدون گفتن چرا، کاربر را
     * وادار می‌کند دوباره و دوباره امتحان کند. */
    return {
      data: null, denied: false, unauth: false,
      messageFa: body.error?.message,
      reasons: body.error?.reasons ?? body.error?.detailsFa,
    };
  } catch {
    return { data: null, denied: false, unauth: false };
  }
}

type HrmPostResult = {
  ok: boolean;
  data?: Json;
  messageFa?: string;
  issues?: Json[];
  detailsFa?: string[];
  /** رد مجوز — تا رابط «مجوز ندارید» بگوید نه «انجام نشد». */
  denied?: boolean;
  /** دلایل بستهٔ دروازه (۴۰۹) — مسیر متفاوتی از `detailsFa` دارد. */
  reasons?: string[];
};

async function hrmPost(path: string, body: Json, userId: string): Promise<HrmPostResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "x-user-id": userId },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok) return { ok: true, data: json.data as Json };
    const err = (json?.error ?? {}) as Json;
    return {
      ok: false,
      denied: res.status === 403,
      messageFa: String(err.message ?? "ثبت انجام نشد"),
      issues: (err.issues as Json[] | undefined) ?? undefined,
      detailsFa: (err.detailsFa as string[] | undefined) ?? undefined,
      reasons: (err.reasons as string[] | undefined) ?? undefined,
    };
  } catch {
    return { ok: false, messageFa: "ارتباط با سرور برقرار نشد" };
  }
}

function TimesheetTab({ rtl, userId }: { rtl: boolean; userId: string }) {
  const [workDate, setWorkDate] = useState("");
  const [list, setList] = useState<Json | null>(null);
  const [periods, setPeriods] = useState<Json | null>(null);
  const [conflicts, setConflicts] = useState<Json | null>(null);
  const [devices, setDevices] = useState<Json | null>(null);
  const [showSync, setShowSync] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [detail, setDetail] = useState<Json | null>(null);
  const [denied, setDenied] = useState(false);
  const [unauth, setUnauth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const fmt = (n: number) => Number(n || 0).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 2 });

  const load = useCallback(async () => {
    const q = `projectId=${HRM_PROJECT_ID}${workDate ? `&workDate=${workDate}` : ""}`;
    const [l, p, c, d] = await Promise.all([
      hrmGet(`/api/hrm/timesheets?${q}`, userId),
      hrmGet(`/api/hrm/periods?projectId=${HRM_PROJECT_ID}`, userId),
      hrmGet(`/api/hrm/conflicts?projectId=${HRM_PROJECT_ID}&status=open`, userId),
      hrmGet(`/api/hrm/devices?projectId=${HRM_PROJECT_ID}`, userId),
    ]);
    setList(l.data);
    setPeriods(p.data);
    /* دفتر تعارض و تابلوی دستگاه هرکدام مجوز جدا دارند؛ نبودشان خطا
     * نیست و فقط آن بخش خالی می‌ماند. */
    setConflicts(c.data);
    setDevices(d.data);
    setDenied(l.denied);
    setUnauth(l.unauth);
  }, [workDate, userId]);

  useEffect(() => { void load(); }, [load]);

  const openSheet = useCallback(async (id: string) => {
    setSelected(id);
    setMsg(null);
    const r = await hrmGet(`/api/hrm/timesheets/${id}?projectId=${HRM_PROJECT_ID}`, userId);
    setDetail(r.data);
  }, [userId]);

  const closeConflict = useCallback(async (id: string, resolution: string, noteFa?: string) => {
    setBusy(true);
    setMsg(null);
    const r = await hrmPost(`/api/hrm/conflicts/${id}/close`, { projectId: HRM_PROJECT_ID, resolution, noteFa }, userId);
    setMsg(r.ok
      ? { kind: "ok", text: String((r.data as Json)?.messageFa ?? "تعارض بسته شد") }
      : { kind: "err", text: r.messageFa ?? "بستن تعارض انجام نشد", details: r.detailsFa });
    logAudit(r.ok ? "HRM_CONFLICT_CLOSE" : "HRM_CONFLICT_CLOSE_DENIED", "Workforce", id);
    await load();
    setBusy(false);
  }, [userId, load]);

  const act = useCallback(async (id: string, to: string, extra: Json = {}) => {
    setBusy(true);
    setMsg(null);
    const r = await hrmPost(`/api/hrm/timesheets/${id}/transition`, { projectId: HRM_PROJECT_ID, to, ...extra }, userId);
    if (r.ok) {
      setMsg({ kind: "ok", text: String((r.data as Json)?.messageFa ?? "انجام شد") });
      logAudit(`HRM_TS_${to.toUpperCase()}`, "Workforce", id);
      await load();
      await openSheet(id);
    } else {
      setMsg({ kind: "err", text: r.messageFa ?? "انجام نشد", details: r.detailsFa });
      logAudit(`HRM_TS_${to.toUpperCase()}_DENIED`, "Workforce", r.messageFa ?? "");
    }
    setBusy(false);
  }, [userId, load, openSheet]);

  const lockPeriod = useCallback(async (periodCode: string) => {
    setBusy(true);
    setMsg(null);
    const r = await hrmPost("/api/hrm/periods/lock", { projectId: HRM_PROJECT_ID, periodCode }, userId);
    setMsg(r.ok
      ? { kind: "ok", text: String((r.data as Json)?.messageFa ?? "دوره بسته شد") }
      : { kind: "err", text: r.messageFa ?? "بستن دوره ممکن نشد", details: r.detailsFa });
    logAudit(r.ok ? "HRM_PERIOD_LOCK" : "HRM_PERIOD_LOCK_DENIED", "Workforce", periodCode);
    await load();
    setBusy(false);
  }, [userId, load]);

  if (unauth) {
    return (
      <Section title={rtl ? "تایم‌شیت و حضور و غیاب" : "Timesheet"}>
        <p className="text-[9.5px] font-light tx3">
          {rtl ? "برای دیدن کارکرد باید وارد شوید." : "Sign in to view timesheets."}
        </p>
      </Section>
    );
  }
  if (denied) {
    return (
      <Section title={rtl ? "تایم‌شیت و حضور و غیاب" : "Timesheet"}>
        <p className="text-[9.5px] font-light tx3">
          {rtl ? "مجوز «hrm.roster.view» را ندارید." : "Missing permission hrm.roster.view."}
        </p>
      </Section>
    );
  }

  const items = ((list?.items as Json[] | undefined) ?? []);
  const summary = (list?.summary as Json | null) ?? null;
  const periodItems = ((periods?.items as Json[] | undefined) ?? []);
  const openConflicts = Number(conflicts?.openCount ?? 0);
  const conflictItems = ((conflicts?.items as Json[] | undefined) ?? []);
  const deviceRows = ((devices?.rows as Json[] | undefined) ?? []);
  const deviceSummary = (devices?.summary as Json | undefined) ?? null;
  const header = (detail?.header as Json | undefined) ?? null;
  const entries = ((detail?.entries as Json[] | undefined) ?? []);
  const totals = (detail?.totals as Json | undefined) ?? null;

  return (
    <>
      {(openConflicts > 0 || deviceRows.length > 0) && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {openConflicts > 0 && (
              <span className="rounded-lg bg-rose-400/10 px-3 py-2 text-[9.5px] font-light text-rose-300">
                {rtl
                  ? `${fmt(openConflicts)} تعارض همگام‌سازی باز است؛ تا تعیین تکلیف، عدد این دوره کامل نیست.`
                  : `${openConflicts} open sync conflicts — this period's figures are incomplete.`}
              </span>
            )}
            {deviceSummary && Number(deviceSummary.red ?? 0) > 0 && (
              <span className="rounded-lg bg-amber-400/10 px-3 py-2 text-[9.5px] font-light text-amber-200">
                {rtl
                  ? `${fmt(Number(deviceSummary.red))} دستگاه میدانی نیازمند رسیدگی است`
                  : `${deviceSummary.red} field devices need attention`}
              </span>
            )}
            {(deviceRows.length > 0 || conflictItems.length > 0) && (
              <button
                onClick={() => setShowSync((v) => !v)}
                className="rounded-lg border b-line-soft px-2.5 py-1.5 text-[9px] font-light tx2 transition hover:tx1"
              >
                {showSync ? (rtl ? "بستن کارتابل همگام‌سازی" : "Hide sync desk") : (rtl ? "کارتابل همگام‌سازی" : "Sync desk")}
              </button>
            )}
          </div>

          {showSync && (
            <div className="grid gap-3 lg:grid-cols-2">
              {/* ── تعارض‌های باز ── */}
              <Section
                title={rtl ? "تعارض‌های باز" : "Open conflicts"}
                note={rtl ? "نسخهٔ بازنده دور ریخته نمی‌شود" : "the losing version is never discarded"}
              >
                {conflictItems.length === 0 ? (
                  <p className="text-[9px] font-light tx3">{rtl ? "تعارض بازی نیست." : "No open conflicts."}</p>
                ) : (
                  <div className="space-y-1.5">
                    {conflictItems.map((c) => {
                      const blocked = c.RequiresAdjustment === true || c.RequiresAdjustment === 1;
                      return (
                        <div key={String(c.Id)} className="rounded-lg border b-line-soft bg-black/10 px-2.5 py-2">
                          <div className="flex flex-wrap items-baseline justify-between gap-1">
                            <span className="font-mono text-[8.5px] tx2" dir="ltr">{String(c.EntityId)}</span>
                            <span className="text-[8px] tx4" dir="ltr">{String(c.DeviceId ?? "—")}</span>
                          </div>
                          <p className="mt-1 text-[9px] font-light tx2">{String(c.DiffSummaryFa ?? "")}</p>
                          {/* برگه‌ای که سند اصلاحی می‌خواهد، دکمهٔ «حل شد»
                              نمی‌گیرد — وگرنه رابط راهی برای پنهان کردن
                              اختلاف پیشنهاد می‌کرد. */}
                          {blocked ? (
                            <p className="mt-1.5 rounded-md bg-rose-400/10 px-2 py-1 text-[8.5px] font-light text-rose-300">
                              {rtl
                                ? "فقط با صدور سند اصلاحی بسته می‌شود"
                                : "closable only via an adjustment document"}
                            </p>
                          ) : (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <button
                                disabled={busy}
                                onClick={() => void closeConflict(String(c.Id), "server_wins")}
                                className="rounded-md border b-line-soft px-2 py-1 text-[8.5px] font-light tx2 transition hover:tx1 disabled:opacity-40"
                              >
                                {rtl ? "نسخهٔ سرور" : "Server wins"}
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => void closeConflict(String(c.Id), "local_wins")}
                                className="rounded-md border b-line-soft px-2 py-1 text-[8.5px] font-light tx2 transition hover:tx1 disabled:opacity-40"
                              >
                                {rtl ? "نسخهٔ دستگاه" : "Device wins"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* ── سلامت دستگاه‌ها ── */}
              <Section
                title={rtl ? "دستگاه‌های میدانی" : "Field devices"}
                note={rtl ? "دستگاه ساکت یعنی دادهٔ نرسیده" : "a silent device means data that never arrived"}
              >
                {deviceRows.length === 0 ? (
                  <p className="text-[9px] font-light tx3">{rtl ? "دستگاهی ثبت نشده است." : "No devices seen."}</p>
                ) : (
                  <div className="space-y-1">
                    {deviceRows.map((d) => (
                      <div key={String(d.deviceId)} className="glass-row flex items-start gap-2 rounded-lg px-2.5 py-1.5">
                        <span
                          className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                            d.flag === "red" ? "bg-rose-400" : d.flag === "amber" ? "bg-amber-400" : "bg-emerald-400"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-1">
                            <span className="font-mono text-[9px] tx1" dir="ltr">{String(d.deviceId)}</span>
                            <span className="text-[8px] tabular-nums tx4">
                              {d.staleDays === null ? (rtl ? "زمان نامعلوم" : "unknown") : `${fmt(Number(d.staleDays))} ${rtl ? "روز" : "d"}`}
                            </span>
                          </div>
                          {Boolean(d.noteFa) && <p className="text-[8.5px] font-extralight tx3">{String(d.noteFa)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}
        </div>
      )}

      <Section
        title={rtl ? "برگه‌های کارکرد" : "Timesheets"}
        note={rtl ? "ساعت خام تنها ورودی کاربر است؛ تفکیک عادی، اضافه‌کاری، شب و تعطیل خروجی موتور است" : "raw hours are the only user input"}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span className="text-[8.5px] font-extralight tx4">{rtl ? "تاریخ" : "Date"}</span>
            <input
              type="date"
              value={workDate}
              onChange={(e) => { setWorkDate(e.target.value); setDetail(null); setSelected(""); }}
              className="rounded-md border b-line-soft bg-transparent px-2 py-1 text-[9.5px] font-light tx1"
            />
          </label>
          {workDate && (
            <button
              type="button"
              onClick={() => { setWorkDate(""); setDetail(null); setSelected(""); }}
              className="rounded-md border b-line-soft px-2 py-1 text-[8.5px] font-light tx3 transition hover:tx1"
            >
              {rtl ? "همهٔ روزها" : "All days"}
            </button>
          )}
        </div>

        {summary && (
          <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label={rtl ? "برگه" : "Sheets"} value={fmt(Number(summary.headerCount ?? 0))} />
            <Kpi label={rtl ? "نفرات" : "Headcount"} value={fmt(Number(summary.headcount ?? 0))} />
            <Kpi label={rtl ? "ساعت خام" : "Raw hours"} value={fmt(Number(summary.totalHours ?? 0))} />
            <Kpi
              label={rtl ? "زمان تلف‌شده" : "Lost time"}
              value={summary.lostTimePct == null ? "—" : `${fmt(Number(summary.lostTimePct))}٪`}
              tone={Number(summary.lostTimePct ?? 0) > 10 ? "text-rose-300" : "tx1"}
              hint={rtl ? "حاضر ولی بدون کار مولد" : "present but not productive"}
            />
            <Kpi
              label={rtl ? "معطل تأیید" : "Pending"}
              value={fmt(Number(summary.pendingCount ?? 0))}
              tone={Number(summary.pendingCount ?? 0) > 0 ? "text-amber-200" : "tx1"}
            />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-light">
            <thead>
              <tr>
                <Th>{rtl ? "تاریخ" : "Date"}</Th>
                <Th>{rtl ? "اکیپ" : "Crew"}</Th>
                <Th>{rtl ? "شیفت" : "Shift"}</Th>
                <Th>{rtl ? "وضعیت" : "Status"}</Th>
                <Th>{rtl ? "ردیف" : "Rows"}</Th>
                <Th>{rtl ? "ساعت" : "Hours"}</Th>
                <Th>{rtl ? "اضافه‌کاری" : "OT"}</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody className="tx2">
              {items.slice(0, 30).map((x) => {
                const st = String(x.Status ?? "");
                return (
                  <tr
                    key={String(x.Id)}
                    className={`border-t b-line-soft/40 ${selected === String(x.Id) ? "bg-white/5" : ""}`}
                  >
                    <td className="px-1.5 py-1">{String(x.WorkDate ?? "—")}</td>
                    <td className="px-1.5 py-1">{String(x.CrewId ?? "—")}</td>
                    <td className="px-1.5 py-1">{String(x.Shift ?? "—")}</td>
                    <td className="px-1.5 py-1">
                      <span className={`rounded px-1.5 py-0.5 text-[8px] ${TS_TONE[st] ?? "bg-white/5 tx3"}`}>
                        {String(x.statusFa ?? st)}
                      </span>
                      {Boolean(x.isLocked) && (
                        <span className="ms-1 text-[8px] tx4">{rtl ? "🔒 دورهٔ بسته" : "🔒 locked"}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1">{fmt(Number(x.entryCount ?? 0))}</td>
                    <td className="px-1.5 py-1">{fmt(Number(x.TotalHoursRaw ?? 0))}</td>
                    <td className="px-1.5 py-1">{fmt(Number(x.TotalHoursOt ?? 0))}</td>
                    <td className="px-1.5 py-1">
                      <button
                        type="button"
                        onClick={() => { void openSheet(String(x.Id)); }}
                        className="rounded border b-line-soft px-1.5 py-0.5 text-[8px] font-light tx3 transition hover:tx1"
                      >
                        {rtl ? "جزئیات" : "Open"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-1.5 py-3 text-center text-[8.5px] font-extralight tx4">
                    {rtl ? "برگه‌ای برای این بازه ثبت نشده است." : "No timesheets for this range."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {msg && (
        <div
          className={`rounded-lg px-3 py-2 text-[9px] font-light ${
            msg.kind === "ok" ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"
          }`}
        >
          {msg.text}
          {msg.details && msg.details.length > 0 && (
            <ul className="mt-1 list-disc pe-4">
              {msg.details.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </div>
      )}

      {header && (
        <Section
          title={rtl ? `برگهٔ ${String(header.CrewId ?? "")} — ${String(header.WorkDate ?? "")}` : `Sheet ${String(header.CrewId ?? "")}`}
          note={String(header.statusFa ?? "")}
        >
          {totals && (
            <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label={rtl ? "نفرات" : "Headcount"} value={fmt(Number(totals.headcount ?? 0))} />
              <Kpi label={rtl ? "عادی" : "Normal"} value={fmt(Number(totals.normal ?? 0))} />
              <Kpi label={rtl ? "اضافه‌کاری" : "Overtime"} value={fmt(Number(totals.ot ?? 0))} />
              <Kpi label={rtl ? "تعطیل" : "Holiday"} value={fmt(Number(totals.holiday ?? 0))} />
              <Kpi
                label={rtl ? "ساعت تلف‌شده" : "Lost"}
                value={fmt(Number(totals.lostHours ?? 0))}
                tone={Number(totals.lostHours ?? 0) > 0 ? "text-amber-200" : "tx1"}
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[9px] font-light">
              <thead>
                <tr>
                  <Th>{rtl ? "نفر" : "Person"}</Th>
                  <Th>{rtl ? "رسته" : "Trade"}</Th>
                  <Th>{rtl ? "فعالیت" : "Activity"}</Th>
                  <Th>{rtl ? "حساب هزینه" : "CBS"}</Th>
                  <Th>{rtl ? "حضور" : "Attendance"}</Th>
                  <Th>{rtl ? "خام" : "Raw"}</Th>
                  <Th>{rtl ? "عادی" : "Normal"}</Th>
                  <Th>{rtl ? "اضافه" : "OT"}</Th>
                </tr>
              </thead>
              <tbody className="tx2">
                {entries.map((e) => (
                  <tr key={String(e.Id)} className="border-t b-line-soft/40">
                    <td className="px-1.5 py-1">{String(e.PersonId ?? "—")}</td>
                    <td className="px-1.5 py-1">{String(e.TradeCode ?? "—")}</td>
                    <td className="px-1.5 py-1">{String(e.ActivityId ?? "—")}</td>
                    <td className="px-1.5 py-1">{String(e.CbsId ?? "—")}</td>
                    <td className="px-1.5 py-1">
                      {String(e.attendanceFa ?? "—")}
                      {e.IsProductive === false || e.IsProductive === 0 ? (
                        <span className="ms-1 text-[8px] text-amber-200">{rtl ? "غیرمولد" : "non-prod"}</span>
                      ) : null}
                    </td>
                    <td className="px-1.5 py-1">{fmt(Number(e.HoursRaw ?? 0))}</td>
                    <td className="px-1.5 py-1">{fmt(Number(e.HoursNormal ?? 0))}</td>
                    <td className="px-1.5 py-1">{fmt(Number(e.HoursOt ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {((header.nextStates as Json[] | undefined) ?? []).map((t) => {
              const to = String(t.to);
              /* امضای سرپرست مقدار می‌خواهد؛ اینجا ارجاع نمادین می‌فرستیم
                 چون ثبت امضای واقعی کار اپلیکیشن میدانی است. */
              const extra = to === "foreman_approved" ? { foremanSignatureRef: `sig-${userId}` } : {};
              const needsReason = to === "rejected";
              return (
                <button
                  key={to}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (needsReason) {
                      const reason = window.prompt(rtl ? "دلیل برگشت (دست‌کم ۱۰ نویسه):" : "Rejection reason:");
                      if (!reason) return;
                      void act(String(header.Id), to, { reasonFa: reason });
                      return;
                    }
                    void act(String(header.Id), to, extra);
                  }}
                  className="rounded-md border b-line-soft px-2 py-1 text-[8.5px] font-light tx2 transition hover:bg-white/5 disabled:opacity-40"
                >
                  {String(t.labelFa ?? to)}
                </button>
              );
            })}
            {((header.nextStates as Json[] | undefined) ?? []).length === 0 && (
              <p className="text-[8.5px] font-extralight tx4">
                {rtl ? "این برگه به پایان چرخه رسیده است." : "This sheet has completed its cycle."}
              </p>
            )}
          </div>
        </Section>
      )}

      <Section
        title={rtl ? "دوره‌های کارکرد" : "Timesheet periods"}
        note={rtl ? "دورهٔ بسته تغییر نمی‌کند؛ اصلاح فقط با سند اصلاحی" : "closed periods change only through adjustments"}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-light">
            <thead>
              <tr>
                <Th>{rtl ? "دوره" : "Period"}</Th>
                <Th>{rtl ? "برگه" : "Sheets"}</Th>
                <Th>{rtl ? "معطل" : "Pending"}</Th>
                <Th>{rtl ? "وضعیت" : "State"}</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody className="tx2">
              {periodItems.slice(0, 12).map((p) => (
                <tr key={String(p.periodCode)} className="border-t b-line-soft/40">
                  <td className="px-1.5 py-1">{String(p.periodCode)}</td>
                  <td className="px-1.5 py-1">{fmt(Number(p.headerCount ?? 0))}</td>
                  <td className={`px-1.5 py-1 ${Number(p.pendingCount ?? 0) > 0 ? "text-amber-200" : ""}`}>
                    {fmt(Number(p.pendingCount ?? 0))}
                  </td>
                  <td className="px-1.5 py-1">
                    {p.isLocked
                      ? <span className="rounded bg-white/10 px-1.5 py-0.5 text-[8px] tx2">{rtl ? "🔒 بسته" : "🔒 locked"}</span>
                      : <span className="text-[8px] tx4">{rtl ? "باز" : "open"}</span>}
                  </td>
                  <td className="px-1.5 py-1">
                    {!p.isLocked && (
                      <button
                        type="button"
                        disabled={busy || !p.canLock}
                        title={String(p.blockedReasonFa ?? "")}
                        onClick={() => { void lockPeriod(String(p.periodCode)); }}
                        className="rounded border b-line-soft px-1.5 py-0.5 text-[8px] font-light tx3 transition hover:tx1 disabled:opacity-30"
                      >
                        {rtl ? "بستن دوره" : "Lock"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {periodItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-1.5 py-3 text-center text-[8.5px] font-extralight tx4">
                    {rtl ? "دوره‌ای ثبت نشده است." : "No periods yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

/* ═══════════════ تب بهره‌وری (D5) ═══════════════ */

const PROD_TONE: Record<string, string> = {
  green: "bg-emerald-400/15 text-emerald-300",
  amber: "bg-amber-400/15 text-amber-200",
  red: "bg-rose-400/15 text-rose-300",
  na: "bg-white/5 tx4",
};

const PROD_STATUS_FA: Record<string, string> = {
  green: "مطلوب",
  amber: "هشدار",
  red: "بحرانی",
  na: "نامشخص",
};

const TREND_FA: Record<string, string> = {
  improving: "↑ رو به بهبود",
  stable: "→ پایدار",
  declining: "↓ رو به افت",
};

function ProductivityTab({ rtl, userId }: { rtl: boolean; userId: string }) {
  const [period, setPeriod] = useState("2026-09");
  const [prod, setProd] = useState<Json | null>(null);
  const [rca, setRca] = useState<Json | null>(null);
  const [calib, setCalib] = useState<Json | null>(null);
  const [catalog, setCatalog] = useState<Json | null>(null);
  const [costPlan, setCostPlan] = useState<Json | null>(null);
  const [outbox, setOutbox] = useState<Json | null>(null);
  const [recon, setRecon] = useState<Json | null>(null);
  const [denied, setDenied] = useState(false);
  const [unauth, setUnauth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const fmt = (n: number, d = 2) =>
    Number(n || 0).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: d });

  const load = useCallback(async () => {
    const q = `projectId=${HRM_PROJECT_ID}&periodCode=${period}`;
    const [p, r, c, k] = await Promise.all([
      hrmGet(`/api/hrm/productivity?${q}`, userId),
      hrmGet(`/api/hrm/rca?${q}`, userId),
      hrmGet(`/api/hrm/rates/calibration?projectId=${HRM_PROJECT_ID}`, userId),
      hrmGet(`/api/hrm/rca-catalog`, userId),
    ]);
    setProd(p.data);
    setRca(r.data);
    setCalib(c.data);
    setCatalog(k.data);
    /* صندوق رویداد مجوز جدا دارد (`core.event.view`)؛ نبودش خطا
     * نیست و فقط آن بخش خالی می‌ماند. */
    const [ob, rc] = await Promise.all([
      hrmGet(`/api/events/outbox?projectId=${HRM_PROJECT_ID}`, userId),
      hrmGet(`/api/events/reconcile?projectId=${HRM_PROJECT_ID}`, userId),
    ]);
    setOutbox(ob.data);
    setRecon(rc.data);
    setDenied(p.denied);
    setUnauth(p.unauth);
  }, [period, userId]);

  useEffect(() => { void load(); }, [load]);

  /**
   * پیش‌نمایش و ارسال هزینه (D12).
   *
   * `apply` پارامتر است نه دو مسیر جدا: آنچه کاربر در پیش‌نمایش
   * می‌بیند باید دقیقاً همان چیزی باشد که نوشته می‌شود.
   */
  const postCost = useCallback(async (apply: boolean) => {
    setBusy(true);
    setMsg(null);
    const r = await hrmPost("/api/hrm/cost/post", { projectId: HRM_PROJECT_ID, periodCode: period, apply }, userId);
    if (r.ok) {
      setCostPlan(r.data as Json);
      setMsg({
        kind: "ok",
        text: apply
          ? `ارسال شد — ${(r.data as Json)?.movedToPosted ?? 0} برگه به وضعیت «ارسال‌شده» رفت`
          : "پیش‌نمایش آماده است",
      });
    } else {
      setCostPlan(null);
      setMsg({
        kind: "err",
        text: r.messageFa ?? (r.denied ? "مجوز «hrm.cost.post» را ندارید" : "ارسال هزینه انجام نشد"),
        details: r.reasons,
      });
    }
    logAudit(apply ? "HRM_COST_POST" : "HRM_COST_PREVIEW", "Workforce", period);
    setBusy(false);
  }, [period, userId]);

  const compute = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    const r = await hrmPost("/api/hrm/productivity/compute", { projectId: HRM_PROJECT_ID, periodCode: period }, userId);
    setMsg(r.ok
      ? { kind: "ok", text: String((r.data as Json)?.messageFa ?? "محاسبه انجام شد") }
      : { kind: "err", text: r.messageFa ?? "محاسبه انجام نشد", details: r.detailsFa });
    logAudit(r.ok ? "HRM_PROD_COMPUTE" : "HRM_PROD_COMPUTE_DENIED", "Workforce", period);
    await load();
    setBusy(false);
  }, [period, userId, load]);

  const finalize = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    const r = await hrmPost("/api/hrm/metrics/finalize", { projectId: HRM_PROJECT_ID, periodCode: period }, userId);
    setMsg(r.ok
      ? { kind: "ok", text: String((r.data as Json)?.messageFa ?? "دوره نهایی شد") }
      : { kind: "err", text: r.messageFa ?? "نهایی‌سازی ممکن نشد", details: r.detailsFa });
    logAudit(r.ok ? "HRM_METRIC_FINALIZE" : "HRM_METRIC_FINALIZE_DENIED", "Workforce", period);
    await load();
    setBusy(false);
  }, [period, userId, load]);

  if (unauth) {
    return (
      <Section title={rtl ? "بهره‌وری نیرو" : "Productivity"}>
        <p className="text-[9.5px] font-light tx3">
          {rtl ? "برای دیدن شاخص بهره‌وری باید وارد شوید." : "Sign in to view productivity."}
        </p>
      </Section>
    );
  }
  if (denied) {
    return (
      <Section title={rtl ? "بهره‌وری نیرو" : "Productivity"}>
        <p className="text-[9.5px] font-light tx3">
          {rtl
            ? "مجوز «hrm.productivity.view» را ندارید؛ این عدد مبنای ارزیابی عملکرد است و دسترسی محدود دارد."
            : "Missing permission hrm.productivity.view."}
        </p>
      </Section>
    );
  }

  const items = ((prod?.items as Json[] | undefined) ?? []);
  const summary = (prod?.summary as Json | null) ?? null;
  const byTrade = ((prod?.byTrade as Json[] | undefined) ?? []);
  const isFinal = Boolean(prod?.isFinal);
  const isComplete = prod?.isComplete !== false;
  const tsInfo = (prod?.timesheet as Json | undefined) ?? null;
  const rcaItems = ((rca?.items as Json[] | undefined) ?? []);
  const rollup = ((rca?.rollup as Json[] | undefined) ?? []);
  const calibItems = ((calib?.items as Json[] | undefined) ?? []);
  const reasons = ((catalog?.reasons as Json[] | undefined) ?? []);

  return (
    <>
      {!isComplete && (
        <div className="rounded-lg bg-amber-400/10 px-3 py-2 text-[9.5px] font-light text-amber-200">
          {rtl
            ? `${fmt(Number(tsInfo?.pending ?? 0))} برگهٔ کارکرد هنوز تأیید نشده است؛ شاخص این دوره کامل نیست و نباید مبنای گزارش رسمی شود.`
            : `${Number(tsInfo?.pending ?? 0)} timesheets pending — this period's figures are incomplete.`}
        </div>
      )}
      {isFinal && (
        <div className="rounded-lg bg-white/5 px-3 py-2 text-[9.5px] font-light tx2">
          {rtl
            ? "🔒 متریک این دوره نهایی و تغییرناپذیر شده است؛ بازمحاسبه پذیرفته نمی‌شود."
            : "🔒 This period's metrics are final and immutable."}
        </div>
      )}

      <Section
        title={rtl ? "شاخص بهره‌وری دوره" : "Period productivity"}
        note={rtl ? "ارزش کسب‌شده فقط از پیشرفت تأییدشده ساخته می‌شود" : "earned value comes only from approved progress"}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span className="text-[8.5px] font-extralight tx4">{rtl ? "دوره" : "Period"}</span>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-md border b-line-soft bg-transparent px-2 py-1 text-[9.5px] font-light tx1"
            />
          </label>
          <button
            type="button"
            disabled={busy || isFinal}
            onClick={() => { void compute(); }}
            className="rounded-md border b-line-soft px-2 py-1 text-[8.5px] font-light tx2 transition hover:bg-white/5 disabled:opacity-30"
          >
            {rtl ? "اجرای محاسبه" : "Run computation"}
          </button>
          <button
            type="button"
            disabled={busy || isFinal}
            onClick={() => { void finalize(); }}
            className="rounded-md border b-line-soft px-2 py-1 text-[8.5px] font-light tx2 transition hover:bg-white/5 disabled:opacity-30"
          >
            {rtl ? "نهایی‌سازی دوره" : "Finalize period"}
          </button>
        </div>

        {summary && (
          <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi
              label={rtl ? "شاخص بهره‌وری" : "PI"}
              value={Number(summary.pi ?? 0) > 0 ? fmt(Number(summary.pi), 3) : "—"}
              tone={PROD_TONE[String(summary.pi ?? 0) === "0" ? "na" : Number(summary.pi) < 0.85 ? "red" : Number(summary.pi) < 1 ? "amber" : "green"].split(" ").pop()}
              hint={rtl ? "کسب‌شده ÷ واقعی" : "earned ÷ actual"}
            />
            <Kpi label={rtl ? "نفر-ساعت کسب‌شده" : "Earned MH"} value={fmt(Number(summary.earnedMh ?? 0))} />
            <Kpi label={rtl ? "نفر-ساعت واقعی" : "Actual MH"} value={fmt(Number(summary.actualMh ?? 0))} />
            <Kpi
              label={rtl ? "زمان تلف‌شده" : "Lost time"}
              value={summary.lostPct == null ? "—" : `${fmt(Number(summary.lostPct))}٪`}
              tone={Number(summary.lostPct ?? 0) > 10 ? "text-rose-300" : "tx1"}
              hint={rtl ? `${fmt(Number(summary.lostMh ?? 0))} نفر-ساعت` : undefined}
            />
            <Kpi
              label={rtl ? "پوشش ریشه‌یابی" : "RCA coverage"}
              value={summary.rcaCoveragePct == null ? "—" : `${fmt(Number(summary.rcaCoveragePct))}٪`}
              tone={summary.rcaCoveragePct == null ? "tx1" : Number(summary.rcaCoveragePct) >= 100 ? "text-emerald-300" : "text-amber-200"}
              hint={rtl ? `${fmt(Number(summary.redCount ?? 0))} فعالیت بحرانی` : undefined}
            />
          </div>
        )}

        {summary && Array.isArray(summary.unexplainedRed) && (summary.unexplainedRed as string[]).length > 0 && (
          <p className="mb-2 text-[8.5px] font-light text-rose-300">
            {rtl
              ? `قرمز بدون علت ثبت‌شده: ${(summary.unexplainedRed as string[]).join("، ")} — تا ریشه‌یابی نشوند، دوره نهایی نمی‌شود.`
              : `Unexplained red: ${(summary.unexplainedRed as string[]).join(", ")}`}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-light">
            <thead>
              <tr>
                <Th>{rtl ? "فعالیت" : "Activity"}</Th>
                <Th>{rtl ? "رسته" : "Trade"}</Th>
                <Th>{rtl ? "پیشرفت" : "Progress"}</Th>
                <Th>{rtl ? "بودجه" : "Budget"}</Th>
                <Th>{rtl ? "کسب‌شده" : "Earned"}</Th>
                <Th>{rtl ? "واقعی" : "Actual"}</Th>
                <Th>{rtl ? "تلف‌شده" : "Lost"}</Th>
                <Th>{rtl ? "شاخص" : "PI"}</Th>
                <Th>{rtl ? "روند" : "Trend"}</Th>
                <Th>{rtl ? "نرخ اجرا" : "Unit rate"}</Th>
              </tr>
            </thead>
            <tbody className="tx2">
              {items.slice(0, 40).map((x) => {
                const st = String(x.status ?? "na");
                return (
                  <tr key={String(x.activityId)} className="border-t b-line-soft/40">
                    <td className="px-1.5 py-1">
                      {String(x.activityNameFa ?? x.activityId)}
                      <span className="ms-1 text-[8px] tx4">{String(x.activityId)}</span>
                    </td>
                    <td className="px-1.5 py-1">{String(x.tradeCode ?? "—")}</td>
                    <td className="px-1.5 py-1">{fmt(Number(x.approvedProgressPct ?? 0))}٪</td>
                    <td className="px-1.5 py-1">{fmt(Number(x.budgetMh ?? 0))}</td>
                    <td className="px-1.5 py-1">{fmt(Number(x.earnedMh ?? 0))}</td>
                    <td className="px-1.5 py-1">{fmt(Number(x.actualMh ?? 0))}</td>
                    <td className={`px-1.5 py-1 ${Number(x.lostMh ?? 0) > 0 ? "text-amber-200" : ""}`}>
                      {fmt(Number(x.lostMh ?? 0))}
                    </td>
                    <td className="px-1.5 py-1">
                      <span className={`rounded px-1.5 py-0.5 text-[8px] ${PROD_TONE[st]}`}>
                        {Number(x.pi ?? 0) > 0 ? fmt(Number(x.pi), 2) : "—"} · {PROD_STATUS_FA[st]}
                      </span>
                    </td>
                    <td className="px-1.5 py-1 text-[8px]">{TREND_FA[String(x.trend ?? "stable")]}</td>
                    <td className="px-1.5 py-1">
                      {x.unitRate == null ? "—" : (
                        <>
                          {fmt(Number(x.unitRate), 3)}
                          {x.variancePct != null && (
                            <span className={`ms-1 text-[8px] ${Number(x.variancePct) < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                              {Number(x.variancePct) > 0 ? "+" : ""}{fmt(Number(x.variancePct))}٪
                            </span>
                          )}
                          {x.isCalibrated === false && (
                            <span className="ms-1 text-[8px] tx4">{rtl ? "(کالیبره‌نشده)" : "(uncalibrated)"}</span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-1.5 py-3 text-center text-[8.5px] font-extralight tx4">
                    {rtl
                      ? "در این دوره برگهٔ کارکرد تأییدشده‌ای نیست؛ شاخص بدون داده ساخته نمی‌شود."
                      : "No approved timesheets in this period."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {msg && (
        <div
          className={`rounded-lg px-3 py-2 text-[9px] font-light ${
            msg.kind === "ok" ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"
          }`}
        >
          {msg.text}
          {msg.details && msg.details.length > 0 && (
            <ul className="mt-1 list-disc pe-4">
              {msg.details.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </div>
      )}

      {byTrade.length > 0 && (
        <Section title={rtl ? "بهره‌وری به تفکیک رسته" : "Productivity by trade"} note={rtl ? "بدترین رسته اول" : "worst first"}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {byTrade.map((t) => (
              <div key={String(t.tradeCode)} className="rounded-xl border b-line-soft bg-black/15 px-2.5 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[9px] font-light tx2">{String(t.tradeFa ?? t.tradeCode)}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[8px] ${PROD_TONE[String(t.status ?? "na")]}`}>
                    {Number(t.pi ?? 0) > 0 ? fmt(Number(t.pi), 2) : "—"}
                  </span>
                </div>
                <div className="mt-1 text-[8px] font-extralight tx4">
                  {rtl
                    ? `${fmt(Number(t.actualMh ?? 0))} نفر-ساعت · ${fmt(Number(t.activityCount ?? 0))} فعالیت`
                    : `${fmt(Number(t.actualMh ?? 0))} MH · ${fmt(Number(t.activityCount ?? 0))} activities`}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── صندوق رویداد و آشتی دو دفتر (D13) ── */}
      {outbox !== null && (
        <Section
          title={rtl ? "تحویل به سامانهٔ بیرونی" : "External delivery"}
          note={rtl ? "رقمی که ثبت شده ولی نرسیده، از هر دو دفتر پنهان می‌ماند" : "a posted-but-undelivered figure hides from both ledgers"}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[9px] font-light ${
                (outbox.health as Json)?.flag === "red"
                  ? "bg-rose-400/10 text-rose-300"
                  : (outbox.health as Json)?.flag === "amber"
                    ? "bg-amber-400/10 text-amber-200"
                    : "bg-emerald-400/10 text-emerald-300"
              }`}
            >
              {rtl ? "صف تحویل" : "Delivery queue"}
              <span className="tabular-nums">{fmt(Number((outbox.health as Json)?.pending ?? 0), 0)}</span>
            </span>
            {Number((outbox.health as Json)?.abandoned ?? 0) > 0 && (
              <span className="rounded-md bg-rose-400/10 px-2 py-1 text-[9px] font-light text-rose-300">
                {rtl
                  ? `${fmt(Number((outbox.health as Json).abandoned), 0)} رویداد رهاشده — تحویل خودکار متوقف شده`
                  : `${(outbox.health as Json).abandoned} abandoned events`}
              </span>
            )}
            {recon !== null && !recon.isClean && (
              <span className="rounded-md bg-amber-400/10 px-2 py-1 text-[9px] font-light text-amber-200">
                {String(recon.messageFa ?? "")}
              </span>
            )}
          </div>

          {Boolean((outbox.health as Json)?.noteFa) && (
            <p className="mt-1.5 text-[8.5px] font-light tx3">{String((outbox.health as Json).noteFa)}</p>
          )}

          {/* فقط ناهمخوانی‌ها فهرست می‌شوند — ردیف منطبق خبر نیست. */}
          {recon !== null && Boolean((recon.rows as Json[] | undefined)?.length) && (
            <div className="mt-2 space-y-1">
              {((recon.rows as Json[]) ?? []).filter((x) => x.status !== "matched").slice(0, 8).map((x, i) => (
                <div key={i} className="rounded-md border b-line-soft bg-black/10 px-2.5 py-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <span className="font-mono text-[8.5px] tx2" dir="ltr">
                      {String(x.periodCode)} · {String(x.costAccountId)}
                    </span>
                    <span className="text-[8px] tabular-nums tx4">{fmt(Number(x.postedAmount ?? 0), 0)}</span>
                  </div>
                  <p className="mt-0.5 text-[8.5px] font-extralight text-amber-200">{String(x.noteFa)}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── ارسال هزینه به مالی (D12) ── */}
      <Section
        title={rtl ? "ارسال هزینهٔ نیرو به مالی" : "Post labour cost"}
        note={rtl ? "نرخ × ساعت تأییدشده؛ ارسال دوباره جایگزین می‌کند نه اضافه" : "rate × approved hours; re-posting replaces, never adds"}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => void postCost(false)}
            disabled={busy}
            className="rounded-md border b-line-soft px-2.5 py-1 text-[9px] font-light tx2 transition hover:tx1 disabled:opacity-40"
          >
            {rtl ? "پیش‌نمایش" : "Preview"}
          </button>
          {/* دکمهٔ ارسال فقط پس از پیش‌نمایشِ باز ظاهر می‌شود — کاربر
              نباید چیزی را که ندیده به دفتر مالی بفرستد. */}
          {Boolean((costPlan?.gate as Json | undefined)?.ok) && (
            <button
              onClick={() => void postCost(true)}
              disabled={busy}
              className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[9px] font-light text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-40"
            >
              {busy ? (rtl ? "در حال ارسال…" : "posting…") : (rtl ? "ارسال به دفتر مالی" : "Post to ledger")}
            </button>
          )}
        </div>

        {costPlan ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Kpi label={rtl ? "مبلغ" : "Amount"} value={fmt(Number((costPlan.totals as Json)?.amount ?? 0), 0)} />
              <Kpi label={rtl ? "نفر-ساعت معادل" : "Equivalent MH"} value={fmt(Number((costPlan.totals as Json)?.equivalentHours ?? 0))} />
              <Kpi
                label={rtl ? "ساعت بدون نرخ" : "Unpriced MH"}
                value={fmt(Number((costPlan.totals as Json)?.unpricedHours ?? 0))}
                tone={Number((costPlan.totals as Json)?.unpricedHours ?? 0) > 0 ? "warn" : "good"}
              />
            </div>

            {Boolean(((costPlan.gate as Json | undefined)?.warnings as string[] | undefined)?.length) && (
              <ul className="space-y-0.5 rounded-md bg-amber-400/10 px-2 py-1.5">
                {(((costPlan.gate as Json).warnings as string[]) ?? []).map((w, i) => (
                  <li key={i} className="text-[8.5px] font-light text-amber-200">{w}</li>
                ))}
              </ul>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-[9px] font-light">
                <thead>
                  <tr>
                    <Th>{rtl ? "حساب هزینه" : "Cost account"}</Th>
                    <Th>{rtl ? "ساعت معادل" : "Equiv. MH"}</Th>
                    <Th>{rtl ? "سهم HRM" : "HRM share"}</Th>
                    <Th>{rtl ? "دفتر پیش" : "Before"}</Th>
                    <Th>{rtl ? "دفتر پس" : "After"}</Th>
                    <Th>{rtl ? "وضعیت" : "Status"}</Th>
                  </tr>
                </thead>
                <tbody className="tx2">
                  {(((costPlan.postings as Json[] | undefined) ?? [])).map((x) => (
                    <tr key={String(x.costAccountId)} className="glass-row">
                      <td className="px-2 py-1 font-mono text-[8.5px]" dir="ltr">{String(x.costAccountId)}</td>
                      <td className="px-2 py-1 tabular-nums">{fmt(Number(x.equivalentHours ?? 0))}</td>
                      <td className="px-2 py-1 tabular-nums">{fmt(Number(x.hrmShare ?? 0), 0)}</td>
                      <td className="px-2 py-1 tabular-nums tx3">{fmt(Number(x.previousActual ?? 0), 0)}</td>
                      <td className="px-2 py-1 tabular-nums">{fmt(Number(x.nextActual ?? 0), 0)}</td>
                      <td className={`px-2 py-1 ${x.status === "missing_account" ? "text-rose-300" : "tx3"}`}>
                        {x.status === "missing_account"
                          ? (rtl ? "حساب ناموجود" : "missing account")
                          : x.status === "posted"
                            ? (rtl ? "ارسال شد" : "posted")
                            : (rtl ? "پیش‌نمایش" : "preview")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-[9px] font-light tx3">
            {rtl ? "برای دیدن سهم هر حساب، ابتدا پیش‌نمایش بگیرید." : "Take a preview first."}
          </p>
        )}
      </Section>

      <Section
        title={rtl ? "ریشه‌یابی افت بهره‌وری" : "Root-cause analysis"}
        note={rtl ? "علت درون‌کنترل پیمانکار مبنای ادعا نیست" : "in-control causes are not claimable"}
      >
        {rollup.length > 0 && (
          <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {rollup.slice(0, 8).map((g) => (
              <div key={String(g.category)} className="rounded-xl border b-line-soft bg-black/15 px-2.5 py-2">
                <div className="text-[8.5px] font-extralight tx3">{String(g.categoryFa)}</div>
                <div className="text-[13px] font-semibold tabular-nums tx1" dir="ltr">{fmt(Number(g.lostMh ?? 0))}</div>
                <div className="text-[8px] font-extralight tx4">
                  {rtl
                    ? `نفر-ساعت · ادعاپذیر ${fmt(Number(g.claimableMh ?? 0))} · ادعاشده ${fmt(Number(g.claimedMh ?? 0))}`
                    : `MH · claimable ${fmt(Number(g.claimableMh ?? 0))}`}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-light">
            <thead>
              <tr>
                <Th>{rtl ? "فعالیت" : "Activity"}</Th>
                <Th>{rtl ? "علت" : "Reason"}</Th>
                <Th>{rtl ? "دسته" : "Category"}</Th>
                <Th>{rtl ? "سهم" : "Share"}</Th>
                <Th>{rtl ? "ساعت" : "Hours"}</Th>
                <Th>{rtl ? "ادعا" : "Claim"}</Th>
                <Th>{rtl ? "شرح" : "Note"}</Th>
              </tr>
            </thead>
            <tbody className="tx2">
              {rcaItems.slice(0, 25).map((x) => (
                <tr key={String(x.Id)} className="border-t b-line-soft/40">
                  <td className="px-1.5 py-1">{String(x.ActivityId)}</td>
                  <td className="px-1.5 py-1">{String(x.reasonFa ?? x.ReasonCode)}</td>
                  <td className="px-1.5 py-1">{String(x.categoryFa ?? "—")}</td>
                  <td className="px-1.5 py-1">{fmt(Number(x.SharePct ?? 0))}٪</td>
                  <td className="px-1.5 py-1">{fmt(Number(x.LostMh ?? 0))}</td>
                  <td className="px-1.5 py-1">
                    {x.ClaimRef
                      ? <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[8px] text-emerald-300">{String(x.ClaimRef)}</span>
                      : x.isClaimable
                        ? <span className="text-[8px] text-amber-200">{rtl ? "ادعاپذیر" : "claimable"}</span>
                        : <span className="text-[8px] tx4">{rtl ? "غیرادعاپذیر" : "not claimable"}</span>}
                  </td>
                  <td className="px-1.5 py-1 tx3">{String(x.NoteFa ?? "")}</td>
                </tr>
              ))}
              {rcaItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-1.5 py-3 text-center text-[8.5px] font-extralight tx4">
                    {rtl ? "برای این دوره علتی ثبت نشده است." : "No root causes recorded."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {reasons.length > 0 && (
          <p className="mt-2 text-[8px] font-extralight tx4">
            {rtl
              ? `کاتالوگ ${fmt(reasons.length, 0)} علت استاندارد دارد؛ ${fmt(reasons.filter((r) => r.isClaimable).length, 0)} مورد ادعاپذیر است. علت متن آزاد پذیرفته نمی‌شود تا گزارش قابل تجمیع بماند.`
              : `${reasons.length} standard causes, ${reasons.filter((r) => r.isClaimable).length} claimable.`}
          </p>
        )}
      </Section>

      {calibItems.length > 0 && (
        <Section
          title={rtl ? "کالیبراسیون نرخ استاندارد" : "Standard rate calibration"}
          note={rtl ? `حداقل ${fmt(Number(calib?.minPeriods ?? 3), 0)} دوره لازم است` : "min periods required"}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[9px] font-light">
              <thead>
                <tr>
                  <Th>{rtl ? "رسته" : "Trade"}</Th>
                  <Th>{rtl ? "دوره" : "Periods"}</Th>
                  <Th>{rtl ? "نرخ مشاهده‌شده" : "Observed"}</Th>
                  <Th>{rtl ? "نرخ کاتالوگ" : "Catalog"}</Th>
                  <Th>{rtl ? "نرخ مؤثر" : "Effective"}</Th>
                  <Th>{rtl ? "انحراف" : "Drift"}</Th>
                </tr>
              </thead>
              <tbody className="tx2">
                {calibItems.slice(0, 20).map((x) => (
                  <tr key={String(x.tradeCode)} className="border-t b-line-soft/40">
                    <td className="px-1.5 py-1">{String(x.tradeFa ?? x.tradeCode)}</td>
                    <td className="px-1.5 py-1">{fmt(Number(x.periodCount ?? 0), 0)}</td>
                    <td className="px-1.5 py-1">{fmt(Number(x.observedRate ?? 0), 3)}</td>
                    <td className="px-1.5 py-1">{x.catalogRate == null ? "—" : fmt(Number(x.catalogRate), 3)}</td>
                    <td className="px-1.5 py-1">
                      {x.effectiveRate == null ? "—" : fmt(Number(x.effectiveRate), 3)}
                      {!x.isCalibrated && (
                        <span className="ms-1 text-[8px] tx4">{rtl ? "کالیبره‌نشده" : "uncalibrated"}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1">
                      {x.driftPct == null ? "—" : (
                        <span className={Number(x.driftPct) < 0 ? "text-rose-300" : "text-emerald-300"}>
                          {Number(x.driftPct) > 0 ? "+" : ""}{fmt(Number(x.driftPct))}٪
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {calib?.noteFa ? (
            <p className="mt-2 text-[8px] font-extralight tx4">{String(calib.noteFa)}</p>
          ) : null}
        </Section>
      )}
    </>
  );
}

/* ═══════════════ تب اکیپ و نیروی پیمانکاری (D6) ═══════════════ */

const CREW_TONE: Record<string, string> = {
  forming: "bg-white/5 tx3",
  active: "bg-emerald-400/15 text-emerald-300",
  disbanded: "bg-white/10 tx4",
};

const FLAG_TONE: Record<string, string> = {
  green: "text-emerald-300",
  amber: "text-amber-200",
  red: "text-rose-300",
  na: "tx4",
};

const SUB_ATT_TONE: Record<string, string> = {
  draft: "bg-white/5 tx3",
  submitted: "bg-sky-400/15 text-sky-300",
  verified: "bg-emerald-400/15 text-emerald-300",
  rejected: "bg-rose-400/15 text-rose-300",
  invoiced: "bg-violet-400/15 text-violet-300",
};

function CrewTab({ rtl, userId }: { rtl: boolean; userId: string }) {
  const [onDate, setOnDate] = useState("2026-09-08");
  const [workingDays, setWorkingDays] = useState(22);
  const [board, setBoard] = useState<Json | null>(null);
  const [subs, setSubs] = useState<Json | null>(null);
  const [subId, setSubId] = useState("");
  const [att, setAtt] = useState<Json | null>(null);
  const [ipc, setIpc] = useState<Json | null>(null);
  const [denied, setDenied] = useState(false);
  const [unauth, setUnauth] = useState(false);
  /* دسترسی به قرارداد جداست: کارگاه اکیپ را می‌بیند ولی نرخ را نه. */
  const [subDenied, setSubDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const fmt = (n: number, d = 2) =>
    Number(n || 0).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: d });
  const period = onDate.slice(0, 7);

  const load = useCallback(async () => {
    const [b, s] = await Promise.all([
      hrmGet(`/api/hrm/crews?projectId=${HRM_PROJECT_ID}&onDate=${onDate}&workingDays=${workingDays}`, userId),
      hrmGet(`/api/hrm/subcontracts?projectId=${HRM_PROJECT_ID}`, userId),
    ]);
    setBoard(b.data);
    setSubs(s.data);
    setDenied(b.denied);
    setUnauth(b.unauth);
    setSubDenied(s.denied);
  }, [onDate, workingDays, userId]);

  useEffect(() => { void load(); }, [load]);

  /* حضور و صورت‌کارکرد فقط وقتی قراردادی انتخاب شده باشد. */
  const loadSub = useCallback(async () => {
    if (!subId) { setAtt(null); setIpc(null); return; }
    const [a, i] = await Promise.all([
      hrmGet(`/api/hrm/sub-attendance?projectId=${HRM_PROJECT_ID}&subContractId=${subId}&periodCode=${period}`, userId),
      hrmGet(`/api/hrm/sub-ipc?projectId=${HRM_PROJECT_ID}&subContractId=${subId}&periodCode=${period}`, userId),
    ]);
    setAtt(a.data);
    setIpc(i.data);
  }, [subId, period, userId]);

  useEffect(() => { void loadSub(); }, [loadSub]);

  const act = useCallback(async (path: string, body: Json, code: string, ref: string) => {
    setBusy(true);
    setMsg(null);
    const r = await hrmPost(path, { projectId: HRM_PROJECT_ID, ...body }, userId);
    setMsg(r.ok
      ? { kind: "ok", text: String((r.data as Json)?.messageFa ?? "انجام شد") }
      : {
          kind: "err",
          text: r.messageFa ?? "انجام نشد",
          /* ایرادهای اعتبارسنجی و موانع دروازه هر دو باید یکجا دیده
           * شوند، وگرنه کاربر سه بار دکمه می‌زند. */
          details: r.detailsFa ?? (r.issues ?? []).map((i) => String((i as Json).messageFa ?? "")),
        });
    logAudit(r.ok ? code : `${code}_DENIED`, "Workforce", ref);
    await load();
    await loadSub();
    setBusy(false);
  }, [userId, load, loadSub]);

  if (unauth) {
    return (
      <Section title={rtl ? "اکیپ و نیروی پیمانکاری" : "Crews & subcontracted labour"}>
        <p className="text-[9.5px] font-light tx3">
          {rtl ? "برای دیدن تابلوی اکیپ باید وارد شوید." : "Sign in to view the crew board."}
        </p>
      </Section>
    );
  }
  if (denied) {
    return (
      <Section title={rtl ? "اکیپ و نیروی پیمانکاری" : "Crews & subcontracted labour"}>
        <p className="text-[9.5px] font-light tx3">
          {rtl
            ? "مجوز «hrm.crew.view» را ندارید."
            : "Missing permission hrm.crew.view."}
        </p>
      </Section>
    );
  }

  const crews = ((board?.items as Json[] | undefined) ?? []);
  const summary = (board?.summary as Json | null) ?? null;
  const utilOn = board?.utilizationAvailable !== false;
  const subItems = ((subs?.items as Json[] | undefined) ?? []);
  const attItems = ((att?.items as Json[] | undefined) ?? []);
  const attSummary = (att?.summary as Json | null) ?? null;
  const draft = (ipc?.draft as Json | null) ?? null;
  const issued = ((ipc?.issued as Json[] | undefined) ?? []);

  return (
    <>
      {msg && (
        <div className={`rounded-lg px-3 py-2 text-[9.5px] font-light ${msg.kind === "ok" ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}>
          <div>{msg.text}</div>
          {msg.details && msg.details.length > 0 && (
            <ul className="mt-1 space-y-0.5 ps-3">
              {msg.details.filter(Boolean).map((d, i) => <li key={i} className="text-[8.5px] font-extralight">• {d}</li>)}
            </ul>
          )}
        </div>
      )}

      <Section
        title={rtl ? "تابلوی اکیپ‌ها" : "Crew board"}
        note={rtl ? "نرخ حضور و نرخ مولد دو عدد جدا هستند" : "attendance and productive ratios are separate"}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span className="text-[8.5px] font-extralight tx4">{rtl ? "تاریخ" : "Date"}</span>
            <input
              type="date"
              value={onDate}
              onChange={(e) => setOnDate(e.target.value)}
              className="rounded-md border b-line-soft bg-transparent px-2 py-1 text-[9.5px] font-light tx1"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-[8.5px] font-extralight tx4">{rtl ? "روز کاری دوره" : "Working days"}</span>
            <input
              type="number"
              min={0}
              max={31}
              value={workingDays}
              onChange={(e) => setWorkingDays(Number(e.target.value))}
              className="w-16 rounded-md border b-line-soft bg-transparent px-2 py-1 text-[9.5px] font-light tx1"
            />
          </label>
        </div>

        {!utilOn && (
          <div className="mb-2 rounded-lg bg-amber-400/10 px-3 py-2 text-[9px] font-light text-amber-200">
            {rtl
              ? "بدون تعداد روز کاری، ساعت در دسترس محاسبه نمی‌شود و نرخ استفاده «نامشخص» است — نه صفر."
              : "Without working days, utilisation is unknown — not zero."}
          </div>
        )}

        {summary && (
          <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label={rtl ? "اکیپ فعال" : "Active crews"} value={`${fmt(Number(summary.activeCount ?? 0), 0)} / ${fmt(Number(summary.crewCount ?? 0), 0)}`} />
            <Kpi label={rtl ? "سرشماری" : "Headcount"} value={fmt(Number(summary.headcount ?? 0), 0)} />
            <Kpi
              label={rtl ? "نرخ حضور" : "Utilisation"}
              value={summary.utilizationPct == null ? "—" : `${fmt(Number(summary.utilizationPct))}٪`}
              hint={rtl ? `${fmt(Number(summary.chargedHours ?? 0))} از ${fmt(Number(summary.availableHours ?? 0))} ساعت` : undefined}
            />
            <Kpi
              label={rtl ? "نرخ مولد" : "Productive"}
              value={summary.productivePct == null ? "—" : `${fmt(Number(summary.productivePct))}٪`}
            />
            <Kpi
              label={rtl ? "اکیپ قرمز" : "Red crews"}
              value={fmt(Number(summary.redCount ?? 0), 0)}
              tone={Number(summary.redCount ?? 0) > 0 ? "text-rose-300" : "tx1"}
            />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-light">
            <thead>
              <tr>
                <Th>{rtl ? "کد" : "Code"}</Th>
                <Th>{rtl ? "نام" : "Name"}</Th>
                <Th>{rtl ? "وضعیت" : "Status"}</Th>
                <Th>{rtl ? "نفر" : "Head"}</Th>
                <Th>{rtl ? "معادل تمام‌وقت" : "FTE"}</Th>
                <Th>{rtl ? "سرپرست" : "Foreman"}</Th>
                <Th>{rtl ? "نرخ حضور" : "Util."}</Th>
                <Th>{rtl ? "نرخ مولد" : "Prod."}</Th>
                <Th>{rtl ? "هشدار ترکیب" : "Mix issues"}</Th>
              </tr>
            </thead>
            <tbody className="tx2">
              {crews.map((c) => {
                const comp = (c.composition as Json | undefined) ?? {};
                const u = (c.utilization as Json | null) ?? null;
                const issues = ((comp.issues as Json[] | undefined) ?? []);
                const blocking = issues.filter((i) => i.severity === "error");
                return (
                  <tr key={String(c.id)} className="border-t b-line-soft/40">
                    <td className="px-1.5 py-1 font-mono text-[8.5px]" dir="ltr">{String(c.code)}</td>
                    <td className="px-1.5 py-1">
                      {String(c.nameFa)}
                      {c.isSubcontracted ? <span className="ms-1 rounded bg-violet-400/15 px-1 py-0.5 text-[7.5px] text-violet-300">{rtl ? "پیمانکاری" : "sub"}</span> : null}
                    </td>
                    <td className="px-1.5 py-1">
                      <span className={`rounded px-1.5 py-0.5 text-[8px] ${CREW_TONE[String(c.status)] ?? "tx3"}`}>{String(c.statusFa ?? c.status)}</span>
                    </td>
                    <td className="px-1.5 py-1">
                      {fmt(Number(comp.headcount ?? 0), 0)}
                      {Number(c.targetSize ?? 0) > 0 && <span className="tx4"> / {fmt(Number(c.targetSize), 0)}</span>}
                    </td>
                    <td className="px-1.5 py-1">{fmt(Number(comp.fte ?? 0))}</td>
                    <td className="px-1.5 py-1">
                      {Number(comp.foremanCount ?? 0) > 0
                        ? <span className="text-emerald-300">✓</span>
                        : <span className="text-rose-300">{rtl ? "ندارد" : "none"}</span>}
                    </td>
                    <td className={`px-1.5 py-1 ${FLAG_TONE[String(u?.flag ?? "na")]}`}>
                      {u?.utilizationPct == null ? "—" : `${fmt(Number(u.utilizationPct))}٪`}
                    </td>
                    <td className="px-1.5 py-1">
                      {u?.productivePct == null ? "—" : `${fmt(Number(u.productivePct))}٪`}
                    </td>
                    <td className="px-1.5 py-1 tx3">
                      {issues.length === 0
                        ? <span className="tx4">—</span>
                        : (
                          <span className={blocking.length > 0 ? "text-rose-300" : "text-amber-200"}>
                            {String(issues[0].messageFa ?? "")}
                            {issues.length > 1 && <span className="tx4"> (+{fmt(issues.length - 1, 0)})</span>}
                          </span>
                        )}
                    </td>
                  </tr>
                );
              })}
              {crews.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-1.5 py-3 text-center text-[8.5px] font-extralight tx4">
                    {rtl ? "هنوز اکیپی برای این پروژه تعریف نشده است." : "No crews defined."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[8px] font-extralight tx4">
          {rtl
            ? "قید T-4: یک نفر در یک روز فقط در یک اکیپ فعال است. عضویت هم‌زمان در دو اکیپ نفر-ساعت را دوبار می‌شمارد و در سرور مسدود می‌شود."
            : "Rule T-4: a person may belong to only one active crew per day."}
        </p>
      </Section>

      {subDenied ? (
        <Section title={rtl ? "نیروی پیمانکاری" : "Subcontracted labour"}>
          <p className="text-[9.5px] font-light tx3">
            {rtl
              ? "مجوز «hrm.sub.view» را ندارید؛ نرخ توافقی قرارداد و مبلغ صورت‌کارکرد دادهٔ محرمانهٔ پیمان است."
              : "Missing permission hrm.sub.view."}
          </p>
        </Section>
      ) : (
        <Section
          title={rtl ? "قرارداد نیروی پیمانکاری" : "Labour subcontracts"}
          note={rtl ? `دورهٔ ${period}` : `period ${period}`}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5">
              <span className="text-[8.5px] font-extralight tx4">{rtl ? "قرارداد" : "Contract"}</span>
              <select
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                className="rounded-md border b-line-soft bg-transparent px-2 py-1 text-[9.5px] font-light tx1"
              >
                <option value="">{rtl ? "— انتخاب کنید —" : "— select —"}</option>
                {subItems.map((s) => (
                  <option key={String(s.id)} value={String(s.id)} className="bg-neutral-900">
                    {String(s.contractNo)} — {String(s.contractorName)}
                  </option>
                ))}
              </select>
            </label>
            {subId && draft && (
              <button
                type="button"
                disabled={busy}
                onClick={() => { void act("/api/hrm/sub-ipc/prepare", { subContractId: subId, periodCode: period }, "HRM_SUBIPC_PREPARE", period); }}
                className="rounded-md border b-line-soft px-2 py-1 text-[8.5px] font-light tx2 transition hover:bg-white/5 disabled:opacity-30"
              >
                {rtl ? "تهیهٔ صورت‌کارکرد دوره" : "Prepare period IPC"}
              </button>
            )}
          </div>

          {subItems.length === 0 && (
            <p className="text-[8.5px] font-extralight tx4">
              {rtl ? "قرارداد نیروی پیمانکاری ثبت نشده است." : "No labour subcontracts."}
            </p>
          )}

          {subItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[9px] font-light">
                <thead>
                  <tr>
                    <Th>{rtl ? "شماره" : "No."}</Th>
                    <Th>{rtl ? "پیمانکار" : "Contractor"}</Th>
                    <Th>{rtl ? "دامنهٔ رسته" : "Scope"}</Th>
                    <Th>{rtl ? "مدل قیمت" : "Pricing"}</Th>
                    <Th>{rtl ? "بازه" : "Window"}</Th>
                    <Th>{rtl ? "حسن انجام" : "Retention"}</Th>
                    <Th>{rtl ? "وضعیت" : "Status"}</Th>
                  </tr>
                </thead>
                <tbody className="tx2">
                  {subItems.map((s) => (
                    <tr key={String(s.id)} className={`border-t b-line-soft/40 ${String(s.id) === subId ? "bg-white/5" : ""}`}>
                      <td className="px-1.5 py-1 font-mono text-[8.5px]" dir="ltr">{String(s.contractNo)}</td>
                      <td className="px-1.5 py-1">{String(s.contractorName)}</td>
                      <td className="px-1.5 py-1 tx3">{((s.scopeTrades as string[] | undefined) ?? []).join("، ") || "—"}</td>
                      <td className="px-1.5 py-1">{String(s.pricingModelFa ?? s.pricingModel)}</td>
                      <td className="px-1.5 py-1 font-mono text-[8px]" dir="ltr">{String(s.startDate)} … {String(s.endDate)}</td>
                      <td className="px-1.5 py-1">{fmt(Number(s.retentionPct ?? 0))}٪</td>
                      <td className="px-1.5 py-1 tx3">{String(s.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {subId && !subDenied && (
        <Section
          title={rtl ? "حضور گروهی پیمانکار" : "Subcontractor attendance"}
          note={rtl ? "ثبت با کارگاه، تأیید با منابع انسانی — تفکیک وظیفه" : "recorded on site, verified by HR"}
        >
          {attSummary && (
            <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label={rtl ? "ردیف" : "Rows"} value={fmt(Number(attSummary.rowCount ?? 0), 0)} />
              <Kpi label={rtl ? "جمع نفر-ساعت" : "Total MH"} value={fmt(Number(attSummary.totalHours ?? 0))} />
              <Kpi label={rtl ? "تأییدشده" : "Verified MH"} value={fmt(Number(attSummary.verifiedHours ?? 0))} />
              <Kpi
                label={rtl ? "در انتظار تأیید" : "Pending"}
                value={fmt(Number(attSummary.pendingCount ?? 0), 0)}
                tone={Number(attSummary.pendingCount ?? 0) > 0 ? "text-amber-200" : "tx1"}
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[9px] font-light">
              <thead>
                <tr>
                  <Th>{rtl ? "تاریخ" : "Date"}</Th>
                  <Th>{rtl ? "رسته" : "Trade"}</Th>
                  <Th>{rtl ? "نفر" : "Head"}</Th>
                  <Th>{rtl ? "ساعت هر نفر" : "Hrs/person"}</Th>
                  <Th>{rtl ? "جمع" : "Total"}</Th>
                  <Th>{rtl ? "فعالیت" : "Activity"}</Th>
                  <Th>{rtl ? "وضعیت" : "Status"}</Th>
                  <Th>{rtl ? "اقدام" : "Action"}</Th>
                </tr>
              </thead>
              <tbody className="tx2">
                {attItems.map((a) => (
                  <tr key={String(a.id)} className="border-t b-line-soft/40">
                    <td className="px-1.5 py-1 font-mono text-[8.5px]" dir="ltr">{String(a.workDate)}</td>
                    <td className="px-1.5 py-1">{String(a.tradeCode)}</td>
                    <td className="px-1.5 py-1">{fmt(Number(a.headcount ?? 0), 0)}</td>
                    <td className="px-1.5 py-1">{fmt(Number(a.hoursPerPerson ?? 0))}</td>
                    <td className="px-1.5 py-1 tabular-nums">{fmt(Number(a.totalHours ?? 0))}</td>
                    <td className="px-1.5 py-1 tx3">{String(a.activityId)}</td>
                    <td className="px-1.5 py-1">
                      <span className={`rounded px-1.5 py-0.5 text-[8px] ${SUB_ATT_TONE[String(a.status)] ?? "tx3"}`}>
                        {String(a.statusFa ?? a.status)}
                      </span>
                    </td>
                    <td className="px-1.5 py-1">
                      {String(a.status) === "submitted" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => { void act(`/api/hrm/sub-attendance/${String(a.id)}/verify`, {}, "HRM_SUBATT_VERIFY", String(a.id)); }}
                          className="rounded border b-line-soft px-1.5 py-0.5 text-[8px] font-light tx2 transition hover:bg-white/5 disabled:opacity-30"
                        >
                          {rtl ? "تأیید" : "Verify"}
                        </button>
                      ) : (
                        <span className="text-[8px] tx4">
                          {a.verifiedBy ? String(a.verifiedBy) : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {attItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-1.5 py-3 text-center text-[8.5px] font-extralight tx4">
                      {rtl ? "برای این دوره حضوری ثبت نشده است." : "No attendance for this period."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {subId && !subDenied && (draft || issued.length > 0) && (
        <Section
          title={rtl ? "صورت‌کارکرد نیروی پیمانکاری" : "Labour payment certificate"}
          note={rtl ? "فقط ردیف تأییدشده وارد مبلغ می‌شود" : "verified rows only"}
        >
          {draft && (
            <>
              <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Kpi label={rtl ? "نفر-ساعت" : "Man-hours"} value={fmt(Number(draft.totalHours ?? 0))} />
                <Kpi label={rtl ? "ناخالص" : "Gross"} value={fmt(Number(draft.grossAmount ?? 0), 0)} />
                <Kpi label={rtl ? "حسن انجام کار" : "Retention"} value={fmt(Number(draft.retentionAmount ?? 0), 0)} />
                <Kpi label={rtl ? "خالص" : "Net"} value={fmt(Number(draft.netBeforeDeduction ?? 0), 0)} />
                <Kpi
                  label={rtl ? "ساعت بی‌نرخ" : "Unpriced MH"}
                  value={fmt(Number(draft.unpricedHours ?? 0))}
                  tone={Number(draft.unpricedHours ?? 0) > 0 ? "text-rose-300" : "tx1"}
                />
              </div>

              {draft.isComplete === false && (
                <div className="mb-2 rounded-lg bg-rose-400/10 px-3 py-2 text-[9px] font-light text-rose-200">
                  {rtl
                    ? `${fmt(Number(draft.unpricedHours ?? 0))} نفر-ساعت نرخ توافقی ندارد؛ مبلغ بالا ناقص است و تا افزودن نرخ به قرارداد، صورت‌کارکرد تأیید نمی‌شود.`
                    : "Unpriced hours present — the amount above is incomplete and cannot be approved."}
                </div>
              )}

              {((draft.issues as Json[] | undefined) ?? []).length > 0 && (
                <ul className="mb-2 space-y-1">
                  {((draft.issues as Json[] | undefined) ?? []).map((i, k) => (
                    <li key={k} className={`text-[8.5px] font-extralight ${i.severity === "error" ? "text-rose-300" : "text-amber-200"}`}>
                      • {String(i.messageFa ?? "")}
                    </li>
                  ))}
                </ul>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-[9px] font-light">
                  <thead>
                    <tr>
                      <Th>{rtl ? "حساب هزینه" : "CBS"}</Th>
                      <Th>{rtl ? "فعالیت" : "Activity"}</Th>
                      <Th>{rtl ? "رسته" : "Trade"}</Th>
                      <Th>{rtl ? "نفر-روز" : "Head-days"}</Th>
                      <Th>{rtl ? "نفر-ساعت" : "Man-hours"}</Th>
                      <Th>{rtl ? "نرخ" : "Rate"}</Th>
                      <Th>{rtl ? "مبلغ" : "Amount"}</Th>
                    </tr>
                  </thead>
                  <tbody className="tx2">
                    {((draft.lines as Json[] | undefined) ?? []).map((l, k) => (
                      <tr key={k} className="border-t b-line-soft/40">
                        <td className="px-1.5 py-1 tx3">{String(l.cbsId)}</td>
                        <td className="px-1.5 py-1 tx3">{String(l.activityId)}</td>
                        <td className="px-1.5 py-1">{String(l.tradeCode)}</td>
                        <td className="px-1.5 py-1">{fmt(Number(l.headcountDays ?? 0), 0)}</td>
                        <td className="px-1.5 py-1 tabular-nums">{fmt(Number(l.totalHours ?? 0))}</td>
                        <td className="px-1.5 py-1">
                          {l.missingRate
                            ? <span className="text-rose-300 text-[8px]">{rtl ? "بی‌نرخ" : "no rate"}</span>
                            : fmt(Number(l.rate ?? 0), 0)}
                        </td>
                        <td className="px-1.5 py-1 tabular-nums">
                          {l.amount == null ? <span className="tx4">—</span> : fmt(Number(l.amount), 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {issued.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[9px] font-light">
                <thead>
                  <tr>
                    <Th>{rtl ? "دوره" : "Period"}</Th>
                    <Th>{rtl ? "سریال" : "Serial"}</Th>
                    <Th>{rtl ? "نفر-ساعت" : "MH"}</Th>
                    <Th>{rtl ? "خالص" : "Net"}</Th>
                    <Th>{rtl ? "وضعیت" : "Status"}</Th>
                    <Th>{rtl ? "تأییدکننده" : "Approver"}</Th>
                    <Th>{rtl ? "اقدام" : "Action"}</Th>
                  </tr>
                </thead>
                <tbody className="tx2">
                  {issued.map((x) => (
                    <tr key={String(x.id)} className="border-t b-line-soft/40">
                      <td className="px-1.5 py-1 font-mono text-[8.5px]" dir="ltr">{String(x.periodCode)}</td>
                      <td className="px-1.5 py-1">{fmt(Number(x.serialNo ?? 0), 0)}</td>
                      <td className="px-1.5 py-1 tabular-nums">{fmt(Number(x.totalHours ?? 0))}</td>
                      <td className="px-1.5 py-1 tabular-nums">{fmt(Number(x.netAmount ?? 0), 0)}</td>
                      <td className="px-1.5 py-1 tx3">{String(x.status)}</td>
                      <td className="px-1.5 py-1 tx3">{x.approvedBy ? String(x.approvedBy) : "—"}</td>
                      <td className="px-1.5 py-1">
                        {String(x.status) === "draft" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => { void act(`/api/hrm/sub-ipc/${String(x.id)}/approve`, {}, "HRM_SUBIPC_APPROVE", String(x.id)); }}
                            className="rounded border b-line-soft px-1.5 py-0.5 text-[8px] font-light tx2 transition hover:bg-white/5 disabled:opacity-30"
                          >
                            {rtl ? "تأیید" : "Approve"}
                          </button>
                        ) : <span className="text-[8px] tx4">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-2 text-[8px] font-extralight tx4">
            {rtl
              ? "تهیهٔ صورت‌کارکرد با مدیر پیمان و تأیید آن با مدیر پروژه است (SOD-22)؛ ساعتی که وارد صورت‌کارکرد شد دیگر در دورهٔ بعد شمرده نمی‌شود."
              : "Preparation and approval are separated (SOD-22); invoiced hours are never counted again."}
          </p>
        </Section>
      )}
    </>
  );
}

/* ═══════════════ تب پذیرش، احکام و انطباق (D7) ═══════════════ */

const PERSON_TONE: Record<string, string> = {
  candidate: "bg-white/5 tx3",
  onboarding: "bg-sky-400/15 text-sky-300",
  active: "bg-emerald-400/15 text-emerald-300",
  on_leave: "bg-amber-400/15 text-amber-200",
  demobilized: "bg-white/10 tx4",
  terminated: "bg-rose-400/15 text-rose-300",
};

const MOB_TONE: Record<string, string> = {
  draft: "bg-white/5 tx3",
  submitted: "bg-sky-400/15 text-sky-300",
  approved: "bg-emerald-400/15 text-emerald-300",
  rejected: "bg-rose-400/15 text-rose-300",
  in_progress: "bg-violet-400/15 text-violet-300",
  fulfilled: "bg-emerald-400/25 text-emerald-200",
  cancelled: "bg-white/10 tx4",
};

const DOC_STATE_TONE: Record<string, string> = {
  valid: "text-emerald-300",
  undated: "tx3",
  expiring: "text-amber-200",
  expired: "text-rose-300",
};

function OnboardingTab({ rtl, userId }: { rtl: boolean; userId: string }) {
  const [panel, setPanel] = useState<Json | null>(null);
  const [watch, setWatch] = useState<Json | null>(null);
  const [mob, setMob] = useState<Json | null>(null);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<Json | null>(null);
  const [denied, setDenied] = useState(false);
  const [unauth, setUnauth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const fmt = (n: number, d = 0) =>
    Number(n || 0).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: d });

  const load = useCallback(async () => {
    const [p, w, m] = await Promise.all([
      hrmGet(`/api/hrm/people?projectId=${HRM_PROJECT_ID}`, userId),
      hrmGet(`/api/hrm/expiry-watch?projectId=${HRM_PROJECT_ID}`, userId),
      hrmGet(`/api/hrm/mob-requests?projectId=${HRM_PROJECT_ID}`, userId),
    ]);
    setPanel(p.data);
    setWatch(w.data);
    setMob(m.data);
    setDenied(p.denied);
    setUnauth(p.unauth);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const openPerson = useCallback(async (id: string) => {
    setSelected(id);
    setMsg(null);
    const r = await hrmGet(`/api/hrm/people/${id}?projectId=${HRM_PROJECT_ID}`, userId);
    setDetail(r.data);
  }, [userId]);

  const act = useCallback(async (path: string, body: Json, code: string, ref: string) => {
    setBusy(true);
    setMsg(null);
    const r = await hrmPost(path, { projectId: HRM_PROJECT_ID, ...body }, userId);
    setMsg(r.ok
      ? { kind: "ok", text: String((r.data as Json)?.messageFa ?? "انجام شد") }
      : {
          kind: "err",
          text: r.messageFa ?? "انجام نشد",
          details: r.detailsFa ?? (r.issues ?? []).map((i) => String((i as Json).messageFa ?? "")),
        });
    logAudit(r.ok ? code : `${code}_DENIED`, "Workforce", ref);
    await load();
    if (selected) {
      const d = await hrmGet(`/api/hrm/people/${selected}?projectId=${HRM_PROJECT_ID}`, userId);
      setDetail(d.data);
    }
    setBusy(false);
  }, [userId, load, selected]);

  if (unauth) {
    return (
      <Section title={rtl ? "پذیرش و انطباق" : "Onboarding & compliance"}>
        <p className="text-[9.5px] font-light tx3">
          {rtl ? "برای دیدن پروندهٔ نیرو باید وارد شوید." : "Sign in to view personnel files."}
        </p>
      </Section>
    );
  }
  if (denied) {
    return (
      <Section title={rtl ? "پذیرش و انطباق" : "Onboarding & compliance"}>
        <p className="text-[9.5px] font-light tx3">
          {rtl ? "مجوز «hrm.person.view» را ندارید." : "Missing permission hrm.person.view."}
        </p>
      </Section>
    );
  }

  const rows = ((panel?.rows as Json[] | undefined) ?? []);
  const watchItems = ((watch?.items as Json[] | undefined) ?? []);
  const watchSummary = (watch?.summary as Json | null) ?? null;
  const mobItems = ((mob?.items as Json[] | undefined) ?? []);
  const mobSummary = (mob?.summary as Json | null) ?? null;
  const gates = (detail?.gates as Json | null) ?? null;
  const gateList = ((gates?.gates as Json[] | undefined) ?? []);
  const hse = (detail?.hse as Json | null) ?? null;

  return (
    <>
      {msg && (
        <div className={`rounded-lg px-3 py-2 text-[9.5px] font-light ${msg.kind === "ok" ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}>
          <div>{msg.text}</div>
          {msg.details && msg.details.length > 0 && (
            <ul className="mt-1 space-y-0.5 ps-3">
              {msg.details.filter(Boolean).map((d, i) => <li key={i} className="text-[8.5px] font-extralight">• {d}</li>)}
            </ul>
          )}
        </div>
      )}

      {Number(panel?.blockedActiveCount ?? 0) > 0 && (
        <div className="rounded-lg bg-rose-400/10 px-3 py-2 text-[9.5px] font-light text-rose-200">
          {rtl
            ? `${fmt(Number(panel?.blockedActiveCount))} نفر فعال با مدرک یا صلاحیت منقضی سر کار هستند؛ سامانه آن‌ها را مجاز می‌داند ولی نیستند.`
            : `${Number(panel?.blockedActiveCount)} active people have expired blocking documents.`}
        </div>
      )}

      <Section
        title={rtl ? "تابلوی انطباق نیرو" : "Workforce compliance board"}
        note={rtl ? "چه کسی امروز حق کار دارد" : "who is cleared to work today"}
      >
        <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label={rtl ? "کل نیرو" : "Headcount"} value={fmt(Number(panel?.headcount ?? 0))} />
          <Kpi label={rtl ? "فعال" : "Active"} value={fmt(Number(panel?.activeCount ?? 0))} />
          <Kpi label={rtl ? "سازگار" : "Compliant"} value={fmt(Number(panel?.compliantCount ?? 0))} tone="text-emerald-300" />
          <Kpi
            label={rtl ? "فعالِ مسدود" : "Blocked active"}
            value={fmt(Number(panel?.blockedActiveCount ?? 0))}
            tone={Number(panel?.blockedActiveCount ?? 0) > 0 ? "text-rose-300" : "tx1"}
          />
          <Kpi
            label={rtl ? "رو به انقضا" : "Expiring"}
            value={fmt(Number(panel?.expiringSoonCount ?? 0))}
            tone={Number(panel?.expiringSoonCount ?? 0) > 0 ? "text-amber-200" : "tx1"}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-light">
            <thead>
              <tr>
                <Th>{rtl ? "شماره" : "No."}</Th>
                <Th>{rtl ? "نام" : "Name"}</Th>
                <Th>{rtl ? "رسته" : "Trade"}</Th>
                <Th>{rtl ? "وضعیت" : "Status"}</Th>
                <Th>{rtl ? "مدارک" : "Docs"}</Th>
                <Th>{rtl ? "مهارت" : "Skill"}</Th>
                <Th>{rtl ? "انطباق" : "Compliance"}</Th>
              </tr>
            </thead>
            <tbody className="tx2">
              {rows.map((p) => {
                const ds = (p.docSummary as Json | undefined) ?? {};
                return (
                  <tr
                    key={String(p.personId)}
                    onClick={() => { void openPerson(String(p.personId)); }}
                    className={`cursor-pointer border-t b-line-soft/40 transition hover:bg-white/5 ${String(p.personId) === selected ? "bg-white/5" : ""}`}
                  >
                    <td className="px-1.5 py-1 font-mono text-[8.5px]" dir="ltr">{String(p.personnelNo)}</td>
                    <td className="px-1.5 py-1">{String(p.nameFa)}</td>
                    <td className="px-1.5 py-1 tx3">{String(p.tradeCode)}</td>
                    <td className="px-1.5 py-1">
                      <span className={`rounded px-1.5 py-0.5 text-[8px] ${PERSON_TONE[String(p.status)] ?? "tx3"}`}>
                        {String(p.statusFa)}
                      </span>
                    </td>
                    <td className="px-1.5 py-1">
                      <span className="text-emerald-300">{fmt(Number(ds.valid ?? 0))}</span>
                      {Number(ds.expiring ?? 0) > 0 && <span className="text-amber-200"> · {fmt(Number(ds.expiring))}</span>}
                      {Number(ds.expired ?? 0) > 0 && <span className="text-rose-300"> · {fmt(Number(ds.expired))}</span>}
                    </td>
                    <td className="px-1.5 py-1">{p.skillLevel == null ? <span className="tx4">—</span> : fmt(Number(p.skillLevel), 1)}</td>
                    <td className="px-1.5 py-1">
                      {p.isCompliant
                        ? <span className={p.flag === "amber" ? "text-amber-200" : "text-emerald-300"}>{rtl ? (p.flag === "amber" ? "هشدار انقضا" : "سازگار") : "ok"}</span>
                        : <span className="text-rose-300">{String(((p.blockersFa as string[]) ?? [])[0] ?? "ناسازگار")}</span>}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-1.5 py-3 text-center text-[8.5px] font-extralight tx4">
                    {rtl ? "هنوز پروندهٔ پرسنلی ثبت نشده است." : "No personnel files."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {detail && (
        <Section
          title={rtl ? `پروندهٔ ${String(detail.fullNameFa)}` : `File — ${String(detail.fullNameFa)}`}
          note={rtl ? `${String(detail.statusFa)} · ${String(detail.employmentTypeFa ?? "")}` : String(detail.status)}
        >
          {detail.piiMasked ? (
            <p className="mb-2 text-[8px] font-extralight tx4">
              {rtl
                ? "کد ملی و شمارهٔ تماس پشت مجوز «hrm.personal.view» پنهان است؛ برای بررسی مدارک نیازی به آن‌ها نیست."
                : "Personal identifiers are masked."}
            </p>
          ) : null}

          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {gateList.map((g) => (
              <div
                key={String(g.gate)}
                className={`rounded-xl border px-2.5 py-2 ${g.ok ? "border-emerald-400/30 bg-emerald-400/5" : g.isBlocking ? "border-rose-400/30 bg-rose-400/5" : "border-amber-400/30 bg-amber-400/5"}`}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[8.5px] font-extralight tx3">{String(g.titleFa)}</span>
                  <span className={g.ok ? "text-emerald-300" : g.isBlocking ? "text-rose-300" : "text-amber-200"}>
                    {g.ok ? "✓" : "✗"}
                  </span>
                </div>
                <div className="mt-0.5 text-[8px] font-extralight tx4">{String(g.messageFa)}</div>
                {!g.ok && !g.isBlocking && (
                  <div className="mt-0.5 text-[7.5px] font-extralight text-amber-200/70">
                    {rtl ? "هشدار — مانع فعال‌سازی نیست" : "warning only"}
                  </div>
                )}
              </div>
            ))}
          </div>

          {hse && hse.siteEntryOk === false && (
            <div className="mb-2 rounded-lg bg-amber-400/10 px-3 py-2 text-[9px] font-light text-amber-200">
              {rtl
                ? "دروازهٔ ورود روزانه به کارگاه (آموزش + تجهیزات + سلامت در ماژول ایمنی) هنوز کامل نیست. این مانع فعال‌سازی نیست، ولی نفر امروز نمی‌تواند وارد کارگاه شود."
                : "Daily site-entry clearance is incomplete (HSE module)."}
              <ul className="mt-1 space-y-0.5 ps-3">
                {((hse.warningsFa as string[] | undefined) ?? []).map((w, i) => (
                  <li key={i} className="text-[8px] font-extralight">• {w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-2">
            {((detail.nextStates as string[] | undefined) ?? []).map((st) => (
              <button
                key={st}
                type="button"
                disabled={busy}
                onClick={() => {
                  const reasonFa = st === "terminated" ? "قطع همکاری طبق تصمیم کارفرما و تسویهٔ کامل" : undefined;
                  void act(`/api/hrm/people/${String(detail.id)}/transition`, { to: st, reasonFa }, `HRM_PERSON_${st.toUpperCase()}`, String(detail.personnelNo));
                }}
                className="rounded-md border b-line-soft px-2 py-1 text-[8.5px] font-light tx2 transition hover:bg-white/5 disabled:opacity-30"
              >
                {rtl ? `→ ${PERSON_STATUS_LABEL_FA[st] ?? st}` : `→ ${st}`}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[9px] font-light">
              <thead>
                <tr>
                  <Th>{rtl ? "مدرک" : "Document"}</Th>
                  <Th>{rtl ? "شماره" : "No."}</Th>
                  <Th>{rtl ? "انقضا" : "Expires"}</Th>
                  <Th>{rtl ? "وضعیت" : "State"}</Th>
                  <Th>{rtl ? "مسدودکننده" : "Blocking"}</Th>
                  <Th>{rtl ? "تأیید اصالت" : "Verified"}</Th>
                  <Th>{rtl ? "اقدام" : "Action"}</Th>
                </tr>
              </thead>
              <tbody className="tx2">
                {((detail.docs as Json[] | undefined) ?? []).map((d) => (
                  <tr key={String(d.id)} className="border-t b-line-soft/40">
                    <td className="px-1.5 py-1">{String(d.docTypeFa)}</td>
                    <td className="px-1.5 py-1 font-mono text-[8px]" dir="ltr">{String(d.docNo ?? "—")}</td>
                    <td className="px-1.5 py-1 font-mono text-[8px]" dir="ltr">{String(d.expiresAt ?? "—")}</td>
                    <td className={`px-1.5 py-1 ${DOC_STATE_TONE[String(d.state)] ?? "tx3"}`}>
                      {String(d.messageFa)}
                    </td>
                    <td className="px-1.5 py-1">{d.isBlocking ? <span className="text-rose-300">●</span> : <span className="tx4">—</span>}</td>
                    <td className="px-1.5 py-1 tx3">{d.verifiedBy ? String(d.verifiedBy) : <span className="tx4">{rtl ? "تأییدنشده" : "unverified"}</span>}</td>
                    <td className="px-1.5 py-1">
                      {!d.verifiedAt && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => { void act(`/api/hrm/docs/${String(d.id)}/verify`, {}, "HRM_DOC_VERIFY", String(d.id)); }}
                          className="rounded border b-line-soft px-1.5 py-0.5 text-[8px] font-light tx2 transition hover:bg-white/5 disabled:opacity-30"
                        >
                          {rtl ? "تأیید" : "Verify"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {((detail.docs as Json[] | undefined) ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-1.5 py-3 text-center text-[8.5px] font-extralight tx4">
                      {rtl ? "هیچ مدرکی بارگذاری نشده است." : "No documents."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {Number(((detail.skills as Json | undefined)?.count) ?? 0) > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-[9px] font-semibold tx2">{rtl ? "ماتریس مهارت" : "Skill matrix"}</div>
              <div className="flex flex-wrap gap-1.5">
                {(((detail.skills as Json).items as Json[] | undefined) ?? []).map((s, i) => (
                  <span
                    key={i}
                    className={`rounded-lg border b-line-soft px-2 py-1 text-[8.5px] font-light ${s.state === "expired" && s.isBlocking ? "text-rose-300" : s.state === "expiring" ? "text-amber-200" : "tx2"}`}
                  >
                    {String(s.nameFa)} · {Number(s.level) === 0 ? (rtl ? "ارزیابی‌نشده" : "unassessed") : `L${fmt(Number(s.level))}`}
                  </span>
                ))}
              </div>
              {((detail.skills as Json).unassessed as number) > 0 && (
                <p className="mt-1 text-[8px] font-extralight tx4">
                  {rtl
                    ? `${fmt(Number((detail.skills as Json).unassessed))} مهارت ارزیابی نشده است؛ «ارزیابی‌نشده» با «بلد نیست» یکی نیست و در میانگین نمی‌آید.`
                    : "unassessed skills are excluded from the average"}
                </p>
              )}
            </div>
          )}
        </Section>
      )}

      <Section
        title={rtl ? "پایش انقضای مدارک" : "Document expiry watch"}
        note={rtl ? `افق ${fmt(Number(watch?.horizonDays ?? 30))} روز` : `${Number(watch?.horizonDays ?? 30)}-day horizon`}
      >
        {watchSummary && (
          <div className="mb-2 grid gap-2 sm:grid-cols-3">
            <Kpi label={rtl ? "در افق" : "In horizon"} value={fmt(Number(watchSummary.total ?? 0))} />
            <Kpi label={rtl ? "منقضی" : "Expired"} value={fmt(Number(watchSummary.expired ?? 0))} tone={Number(watchSummary.expired ?? 0) > 0 ? "text-rose-300" : "tx1"} />
            <Kpi
              label={rtl ? "منقضیِ فعالِ مسدودکننده" : "Blocking & active"}
              value={fmt(Number(watchSummary.blockingExpiredActive ?? 0))}
              tone={Number(watchSummary.blockingExpiredActive ?? 0) > 0 ? "text-rose-300" : "tx1"}
              hint={rtl ? "بدترین حالت" : "worst case"}
            />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-light">
            <thead>
              <tr>
                <Th>{rtl ? "نفر" : "Person"}</Th>
                <Th>{rtl ? "مدرک" : "Document"}</Th>
                <Th>{rtl ? "انقضا" : "Expires"}</Th>
                <Th>{rtl ? "روز باقی‌مانده" : "Days left"}</Th>
                <Th>{rtl ? "وضعیت نفر" : "Person status"}</Th>
              </tr>
            </thead>
            <tbody className="tx2">
              {watchItems.slice(0, 25).map((x, i) => (
                <tr key={i} className="border-t b-line-soft/40">
                  <td className="px-1.5 py-1">{String(x.personNameFa)}</td>
                  <td className="px-1.5 py-1">{String(x.docTypeFa)}</td>
                  <td className="px-1.5 py-1 font-mono text-[8px]" dir="ltr">{String(x.expiresAt)}</td>
                  <td className={`px-1.5 py-1 tabular-nums ${Number(x.daysLeft) < 0 ? "text-rose-300" : "text-amber-200"}`}>
                    {Number(x.daysLeft) < 0
                      ? (rtl ? `${fmt(Math.abs(Number(x.daysLeft)))} روز گذشته` : `${Math.abs(Number(x.daysLeft))} overdue`)
                      : fmt(Number(x.daysLeft))}
                  </td>
                  <td className="px-1.5 py-1 tx3">{String(x.personStatus)}</td>
                </tr>
              ))}
              {watchItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-1.5 py-3 text-center text-[8.5px] font-extralight tx4">
                    {rtl ? "هیچ مدرکی در افق هشدار نیست." : "Nothing expiring."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title={rtl ? "درخواست تجهیز نیرو" : "Mobilization requests"}
        note={rtl ? "درخواست با کارگاه و برنامه‌ریز، تأیید با مدیر پروژه" : "requested on site, approved by PM"}
      >
        {mobSummary && (
          <div className="mb-2 grid gap-2 sm:grid-cols-3">
            <Kpi label={rtl ? "درخواست" : "Requests"} value={fmt(Number(mobSummary.total ?? 0))} />
            <Kpi label={rtl ? "نفرِ باز" : "Open qty"} value={fmt(Number(mobSummary.openQty ?? 0))} />
            <Kpi
              label={rtl ? "عقب‌افتاده" : "Overdue"}
              value={fmt(Number(mobSummary.overdueCount ?? 0))}
              tone={Number(mobSummary.overdueCount ?? 0) > 0 ? "text-rose-300" : "tx1"}
            />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-light">
            <thead>
              <tr>
                <Th>{rtl ? "شماره" : "No."}</Th>
                <Th>{rtl ? "نوع" : "Type"}</Th>
                <Th>{rtl ? "رسته" : "Trade"}</Th>
                <Th>{rtl ? "تعداد" : "Qty"}</Th>
                <Th>{rtl ? "تحقق" : "Filled"}</Th>
                <Th>{rtl ? "تاریخ نیاز" : "Need by"}</Th>
                <Th>{rtl ? "وضعیت" : "Status"}</Th>
                <Th>{rtl ? "اقدام" : "Action"}</Th>
              </tr>
            </thead>
            <tbody className="tx2">
              {mobItems.map((m) => (
                <tr key={String(m.id)} className="border-t b-line-soft/40">
                  <td className="px-1.5 py-1 font-mono text-[8.5px]" dir="ltr">{String(m.requestNo)}</td>
                  <td className="px-1.5 py-1">{String(m.requestTypeFa)}</td>
                  <td className="px-1.5 py-1 tx3">{String(m.tradeCode)}</td>
                  <td className="px-1.5 py-1">{fmt(Number(m.qty))}</td>
                  <td className="px-1.5 py-1">{fmt(Number(m.fulfilledPct))}٪</td>
                  <td className={`px-1.5 py-1 font-mono text-[8px] ${m.isOverdue ? "text-rose-300" : ""}`} dir="ltr">
                    {String(m.needByDate)}
                  </td>
                  <td className="px-1.5 py-1">
                    <span className={`rounded px-1.5 py-0.5 text-[8px] ${MOB_TONE[String(m.status)] ?? "tx3"}`}>
                      {String(m.statusFa)}
                    </span>
                  </td>
                  <td className="px-1.5 py-1">
                    {String(m.status) === "submitted" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => { void act(`/api/hrm/mob-requests/${String(m.id)}/transition`, { to: "approved" }, "HRM_MOB_APPROVE", String(m.requestNo)); }}
                        className="rounded border b-line-soft px-1.5 py-0.5 text-[8px] font-light tx2 transition hover:bg-white/5 disabled:opacity-30"
                      >
                        {rtl ? "تأیید" : "Approve"}
                      </button>
                    ) : String(m.status) === "draft" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => { void act(`/api/hrm/mob-requests/${String(m.id)}/transition`, { to: "submitted" }, "HRM_MOB_SUBMIT", String(m.requestNo)); }}
                        className="rounded border b-line-soft px-1.5 py-0.5 text-[8px] font-light tx2 transition hover:bg-white/5 disabled:opacity-30"
                      >
                        {rtl ? "ارسال" : "Submit"}
                      </button>
                    ) : <span className="text-[8px] tx4">—</span>}
                  </td>
                </tr>
              ))}
              {mobItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-1.5 py-3 text-center text-[8.5px] font-extralight tx4">
                    {rtl ? "درخواست تجهیزی ثبت نشده است." : "No mobilization requests."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[8px] font-extralight tx4">
          {rtl
            ? "درخواست تجهیز تعهد بودجهٔ نفر-ساعت است؛ تأییدش با مدیر پروژه است نه با درخواست‌دهنده (SOD-25). درخواست ناتمام هم بسته نمی‌شود تا کسری نیرو از رادار خارج نشود."
            : "Requester and approver are separated (SOD-25); partial requests cannot be closed."}
        </p>
      </Section>
    </>
  );
}

/** برچسب فارسی وضعیت نفر برای دکمه‌های گذار. */
const PERSON_STATUS_LABEL_FA: Record<string, string> = {
  candidate: "داوطلب",
  onboarding: "در حال پذیرش",
  active: "فعال",
  on_leave: "مرخصی",
  demobilized: "تخلیه‌شده",
  terminated: "قطع همکاری",
};

/* ═══════════════ تب تحلیل، هیستوگرام و گزارش (D8) ═══════════════ */

const KPI_TONE: Record<string, string> = {
  green: "text-emerald-300",
  amber: "text-amber-300",
  red: "text-rose-300",
  na: "tx3",
};

const BAR_TONE: Record<string, string> = {
  over: "bg-rose-400/70",
  under: "bg-amber-400/70",
  on_track: "bg-emerald-400/70",
  no_plan: "bg-white/20",
};

const BAR_LABEL: Record<string, string> = {
  over: "بیش از برنامه",
  under: "کمتر از برنامه",
  on_track: "مطابق برنامه",
  no_plan: "بدون برنامه",
};

const SEV_TONE: Record<string, string> = {
  high: "bg-rose-400/15 text-rose-300",
  medium: "bg-amber-400/15 text-amber-200",
  low: "border b-line-soft tx3",
};

function AnalyticsTab({ rtl, userId }: { rtl: boolean; userId: string }) {
  const [view, setView] = useState<Json | null>(null);
  const [groupBy, setGroupBy] = useState("trade");
  const [report, setReport] = useState<Json | null>(null);
  const [denied, setDenied] = useState(false);
  const [unauth, setUnauth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const fmt = (n: number, d = 0) =>
    Number(n || 0).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: d });

  /* عدد نامعلوم هرگز به صفر ترجمه نمی‌شود — همان قاعدهٔ موتور. */
  const num = (v: unknown, suffix = "") =>
    v === null || v === undefined ? (rtl ? "نامعلوم" : "n/a") : `${fmt(Number(v), 2)}${suffix}`;

  const [catalog, setCatalog] = useState<Json | null>(null);
  const [rptCode, setRptCode] = useState("RPT-HRM-MP");
  const [audience, setAudience] = useState<"internal" | "official">("internal");
  const [gate, setGate] = useState<Json | null>(null);

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([
      hrmGet(`/api/hrm/analytics?projectId=${HRM_PROJECT_ID}&groupBy=${groupBy}`, userId),
      hrmGet(`/api/hrm/reports?projectId=${HRM_PROJECT_ID}`, userId),
    ]);
    setView(r.data);
    setCatalog(c.data);
    setDenied(r.denied);
    setUnauth(r.unauth);
  }, [userId, groupBy]);

  useEffect(() => { void load(); }, [load]);

  const makeReport = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    const r = await hrmGet(`/api/hrm/analytics/report?projectId=${HRM_PROJECT_ID}&groupBy=${groupBy}`, userId);
    if (r.data) {
      setReport(r.data);
      setMsg({ kind: "ok", text: "گزارش رسمی صادر شد" });
      logAudit("HRM_REPORT_EXPORT", "Workforce", HRM_PROJECT_ID);
    } else {
      setReport(null);
      setMsg({
        kind: "err",
        text: r.denied ? "مجوز «hrm.analytics.export» را ندارید" : "صدور گزارش انجام نشد",
      });
      logAudit("HRM_REPORT_EXPORT_DENIED", "Workforce", HRM_PROJECT_ID);
    }
    setBusy(false);
  }, [userId, groupBy]);

  /**
   * پیش از دانلود، وضعیت دروازه با نسخهٔ JSON سنجیده می‌شود.
   *
   * دانلود مستقیم یعنی مرورگر با یک فایل خطای JSON برمی‌گردد که کاربر
   * نمی‌بیند و فکر می‌کند سند صادر شده. اینجا اول می‌پرسیم، بعد لینک
   * را باز می‌کنیم.
   */
  const checkGate = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    setGate(null);
    const q = `projectId=${HRM_PROJECT_ID}&groupBy=${groupBy}&audience=${audience}`;
    const r = await hrmGet(`/api/hrm/reports/${rptCode}?${q}`, userId);
    if (r.data) {
      setGate(r.data.gate as Json);
      setMsg({ kind: "ok", text: rtl ? "سند آمادهٔ دریافت است" : "Document ready" });
    } else {
      setGate(null);
      setMsg({
        kind: "err",
        text: r.messageFa ?? (r.denied ? "مجوز صدور این نسخه را ندارید" : "سند با شرایط فعلی قابل صدور نیست"),
        details: r.reasons,
      });
    }
    logAudit(r.data ? "HRM_RPT_CHECK" : "HRM_RPT_BLOCKED", "Workforce", rptCode);
    setBusy(false);
  }, [userId, groupBy, rptCode, audience, rtl]);

  const downloadUrl = (format: string) =>
    `/api/hrm/reports/${rptCode}?projectId=${HRM_PROJECT_ID}&groupBy=${groupBy}&audience=${audience}&format=${format}`;

  if (unauth) {
    return (
      <Section title={rtl ? "تحلیل و گزارش نیرو" : "Workforce analytics"}>
        <p className="text-[9.5px] font-light tx3">
          {rtl ? "برای دیدن تحلیل نیرو باید وارد شوید." : "Sign in to view workforce analytics."}
        </p>
      </Section>
    );
  }
  if (denied) {
    return (
      <Section title={rtl ? "تحلیل و گزارش نیرو" : "Workforce analytics"}>
        <p className="text-[9.5px] font-light tx3">
          {rtl ? "مجوز «hrm.analytics.view» را ندارید." : "Missing permission hrm.analytics.view."}
        </p>
      </Section>
    );
  }

  const kpis = (view?.kpis as Json[] | undefined) ?? [];
  const bars = ((view?.histogram as Json | undefined)?.bars as Json[] | undefined) ?? [];
  const totals = ((view?.histogram as Json | undefined)?.totals as Json | undefined) ?? {};
  const sCurve = (view?.sCurve as Json | undefined) ?? {};
  const points = (sCurve.points as Json[] | undefined) ?? [];
  const breakdown = (view?.breakdown as Json[] | undefined) ?? [];
  const alerts = (view?.alerts as Json[] | undefined) ?? [];

  /* مقیاس ستون‌ها از بیشینهٔ برنامه و واقعی با هم، تا دو ستون یک
   * دوره روی یک محور قابل مقایسه بمانند. */
  const maxMh = Math.max(
    1,
    ...bars.map((b) => Math.max(Number(b.actualMh ?? 0), Number(b.plannedMh ?? 0)))
  );

  return (
    <div className="space-y-3">
      {/* ── سربرگ زنده ── */}
      <Section
        title={rtl ? "خلاصهٔ وضعیت نیرو" : "Workforce headline"}
        note={rtl ? `${view?.from ?? "—"} تا ${view?.to ?? "—"}` : `${view?.from ?? "—"} to ${view?.to ?? "—"}`}
      >
        <p className="rounded-lg border b-line-soft bg-black/10 px-2.5 py-2 text-[10px] font-light tx1">
          {String(view?.headlineFa ?? (rtl ? "در حال بارگذاری…" : "loading…"))}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {kpis.map((k) => (
            <Kpi
              key={String(k.code)}
              label={String(k.nameFa)}
              value={
                k.value === null
                  ? (rtl ? "نامعلوم" : "n/a")
                  : String(k.code) === "HEADCOUNT"
                    ? fmt(Number(k.value))
                    : `${fmt(Number(k.value), 1)}٪`
              }
              tone={KPI_TONE[String(k.status)] ?? "tx1"}
              hint={
                k.caveatFa
                  ? String(k.caveatFa)
                  : k.target === null
                    ? undefined
                    : `${rtl ? "هدف" : "target"} ${fmt(Number(k.target), 1)}٪`
              }
            />
          ))}
        </div>
      </Section>

      {/* ── هشدارها ── */}
      {alerts.length > 0 && (
        <Section
          title={rtl ? "هشدار زودهنگام" : "Early warnings"}
          note={rtl ? "به ترتیب شدت" : "sorted by severity"}
        >
          <div className="space-y-1">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[9px] ${SEV_TONE[String(a.severity)] ?? ""}`}>
                <span className="shrink-0 font-mono text-[8px]" dir="ltr">{String(a.code)}</span>
                <span className="min-w-0 font-light">{String(a.messageFa)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── هیستوگرام ── */}
      <Section
        title={rtl ? "هیستوگرام نیرو — برنامه در برابر واقعی" : "Manpower histogram — plan vs actual"}
        note={
          rtl
            ? `جمع واقعی ${fmt(Number(totals.actualMh ?? 0))} نفر-ساعت · انحراف کل ${num(totals.variancePct, "٪")}`
            : `${fmt(Number(totals.actualMh ?? 0))} MH · variance ${num(totals.variancePct, "%")}`
        }
      >
        {bars.length === 0 ? (
          <p className="text-[9px] font-light tx3">{rtl ? "دوره‌ای ثبت نشده است." : "No periods recorded."}</p>
        ) : (
          <>
            <div className="thin-scroll overflow-x-auto">
              <div className="flex min-w-max items-end gap-3 px-1 pb-1" style={{ height: "140px" }}>
                {bars.map((b) => {
                  const actual = Number(b.actualMh ?? 0);
                  const planned = b.plannedMh === null ? null : Number(b.plannedMh);
                  return (
                    <div key={String(b.periodCode)} className="flex h-full w-14 flex-col items-center justify-end gap-1">
                      <div className="flex h-full w-full items-end justify-center gap-0.5">
                        {/* ستون برنامه فقط وقتی مبنا هست؛ نبودنش خودش
                            پیام است و با ستون صفر جایگزین نمی‌شود. */}
                        {planned !== null && (
                          <div
                            className="w-4 rounded-t bg-white/25"
                            style={{ height: `${Math.max(2, (planned / maxMh) * 100)}%` }}
                            title={`${rtl ? "برنامه" : "plan"} ${fmt(planned)}`}
                          />
                        )}
                        <div
                          className={`w-4 rounded-t ${BAR_TONE[String(b.status)] ?? "bg-white/20"}`}
                          style={{ height: `${Math.max(2, (actual / maxMh) * 100)}%` }}
                          title={`${rtl ? "واقعی" : "actual"} ${fmt(actual)}`}
                        />
                      </div>
                      <span className="font-mono text-[7.5px] tx4" dir="ltr">{String(b.periodCode)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[8px] tx3">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-white/25" />{rtl ? "برنامه" : "plan"}</span>
              {Object.entries(BAR_LABEL).map(([k, fa]) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-sm ${BAR_TONE[k]}`} />{fa}
                </span>
              ))}
            </div>
            <div className="thin-scroll mt-2 max-h-52 overflow-y-auto">
              <table className="w-full text-[9px]">
                <thead className="sticky top-0 bg-black/30 tx3">
                  <tr>
                    <Th>{rtl ? "دوره" : "Period"}</Th>
                    <Th>{rtl ? "برنامه" : "Plan"}</Th>
                    <Th>{rtl ? "مستقیم" : "Direct"}</Th>
                    <Th>{rtl ? "پیمانکاری" : "Sub"}</Th>
                    <Th>{rtl ? "نفر" : "HC"}</Th>
                    <Th>{rtl ? "انحراف" : "Var"}</Th>
                  </tr>
                </thead>
                <tbody>
                  {bars.map((b) => (
                    <tr key={String(b.periodCode)} className="glass-row">
                      <td className="px-2 py-1 font-mono tx2" dir="ltr">{String(b.periodCode)}</td>
                      <td className="px-2 py-1 tabular-nums tx2">{num(b.plannedMh)}</td>
                      <td className="px-2 py-1 tabular-nums tx1">{fmt(Number(b.directMh ?? 0))}</td>
                      <td className="px-2 py-1 tabular-nums tx2">{fmt(Number(b.subMh ?? 0))}</td>
                      <td className="px-2 py-1 tabular-nums tx2">{num(b.actualHeadcount)}</td>
                      <td className={`px-2 py-1 tabular-nums ${b.status === "on_track" ? "text-emerald-300" : b.status === "no_plan" ? "tx4" : "text-amber-300"}`}>
                        {num(b.variancePct, "٪")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      {/* ── منحنی S ── */}
      <Section
        title={rtl ? "منحنی S تجمعی نفر-ساعت" : "Cumulative man-hour S-curve"}
        note={
          sCurve.hasBaseline
            ? (rtl ? "درصدها بر مبنای کل برنامه" : "percent of total plan")
            : (rtl ? "بدون مبنا — فقط روند واقعی" : "no baseline — actual trend only")
        }
      >
        {points.length === 0 ? (
          <p className="text-[9px] font-light tx3">{rtl ? "داده‌ای برای رسم نیست." : "Nothing to plot."}</p>
        ) : (
          <div className="thin-scroll max-h-52 overflow-y-auto">
            <table className="w-full text-[9px]">
              <thead className="sticky top-0 bg-black/30 tx3">
                <tr>
                  <Th>{rtl ? "دوره" : "Period"}</Th>
                  <Th>{rtl ? "برنامه تجمعی" : "Cum plan"}</Th>
                  <Th>{rtl ? "واقعی تجمعی" : "Cum actual"}</Th>
                  <Th>{rtl ? "برنامه ٪" : "Plan %"}</Th>
                  <Th>{rtl ? "واقعی ٪" : "Actual %"}</Th>
                  <Th>{rtl ? "اختلاف" : "Delta"}</Th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={String(p.periodCode)} className="glass-row">
                    <td className="px-2 py-1 font-mono tx2" dir="ltr">{String(p.periodCode)}</td>
                    <td className="px-2 py-1 tabular-nums tx2">{num(p.cumPlannedMh)}</td>
                    <td className="px-2 py-1 tabular-nums tx1">{fmt(Number(p.cumActualMh ?? 0))}</td>
                    <td className="px-2 py-1 tabular-nums tx3">{num(p.cumPlannedPct, "٪")}</td>
                    <td className="px-2 py-1 tabular-nums tx3">{num(p.cumActualPct, "٪")}</td>
                    <td className={`px-2 py-1 tabular-nums ${p.deltaPct === null ? "tx4" : Number(p.deltaPct) < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                      {num(p.deltaPct, "٪")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── تجمیع ── */}
      <Section
        title={rtl ? "تجمیع نفر-ساعت" : "Man-hour breakdown"}
        note={rtl ? "سهم‌ها روی همین نما جمع صد می‌شوند" : "shares sum to 100 within this view"}
      >
        <nav className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-black/15 p-1">
          {([
            { id: "trade", fa: "رسته", en: "Trade" },
            { id: "cbs", fa: "شکست هزینه", en: "CBS" },
            { id: "obs", fa: "واحد سازمانی", en: "OBS" },
          ] as const).map((g) => (
            <button
              key={g.id}
              onClick={() => setGroupBy(g.id)}
              className={`rounded-lg px-3 py-1.5 text-[9.5px] font-light transition ${groupBy === g.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"}`}
            >
              {rtl ? g.fa : g.en}
            </button>
          ))}
        </nav>
        {breakdown.length === 0 ? (
          <p className="text-[9px] font-light tx3">{rtl ? "ساعتی در این نما ثبت نشده است." : "No hours in this view."}</p>
        ) : (
          <div className="space-y-1">
            {breakdown.map((x) => (
              <div key={String(x.key)} className="glass-row rounded-lg px-2.5 py-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[9.5px] tx1">{String(x.nameFa)}</span>
                  <span className="shrink-0 text-[9px] tabular-nums tx2" dir="ltr">
                    {fmt(Number(x.totalMh ?? 0))} · {fmt(Number(x.sharePct ?? 0), 1)}٪
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-amber-400/60" style={{ width: `${Number(x.sharePct ?? 0)}%` }} />
                </div>
                <div className="mt-0.5 text-[8px] font-extralight tx4">
                  {rtl ? "مستقیم" : "direct"} {fmt(Number(x.directMh ?? 0))} · {rtl ? "پیمانکاری" : "sub"} {fmt(Number(x.subMh ?? 0))} · {rtl ? "نفر" : "HC"} {fmt(Number(x.headcount ?? 0))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── مرکز اسناد رسمی (D11) ── */}
      <Section
        title={rtl ? "مرکز اسناد رسمی" : "Official document centre"}
        note={rtl ? "سند رسمی با دادهٔ ناقص صادر نمی‌شود" : "official documents are gated on data completeness"}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            value={rptCode}
            onChange={(e) => { setRptCode(e.target.value); setGate(null); setMsg(null); }}
            className="rounded-md border b-line-soft bg-transparent px-2 py-1 text-[9.5px] font-light tx1"
          >
            {(((catalog?.items as Json[] | undefined) ?? [])).map((d) => (
              <option key={String(d.code)} value={String(d.code)} className="bg-neutral-900">
                {String((d.title as Json).fa)}
              </option>
            ))}
          </select>

          <div className="flex overflow-hidden rounded-md border b-line-soft">
            {(["internal", "official"] as const).map((a) => (
              <button
                key={a}
                onClick={() => { setAudience(a); setGate(null); setMsg(null); }}
                className={`px-2.5 py-1 text-[9px] font-light transition ${audience === a ? "bg-white/10 tx1" : "tx3 hover:tx2"}`}
              >
                {a === "internal" ? (rtl ? "داخلی" : "Internal") : (rtl ? "رسمی" : "Official")}
              </button>
            ))}
          </div>

          <button
            onClick={() => void checkGate()}
            disabled={busy}
            className="rounded-md border b-line-soft px-2.5 py-1 text-[9px] font-light tx2 transition hover:tx1 disabled:opacity-40"
          >
            {busy ? (rtl ? "بررسی…" : "checking…") : (rtl ? "بررسی امکان صدور" : "Check")}
          </button>
        </div>

        {/* لینک دانلود فقط پس از تأیید دروازه ظاهر می‌شود — دکمهٔ همیشه
            فعال یعنی کاربر فایل خطا دانلود می‌کند و متوجه نمی‌شود. */}
        {gate ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {["pdf", "doc", "xls", "csv"].map((f) => (
                <a
                  key={f}
                  href={downloadUrl(f)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => logAudit("HRM_RPT_DOWNLOAD", "Workforce", `${rptCode}:${f}`)}
                  className="rounded-md border b-line-soft px-2.5 py-1 text-[9px] font-light tx2 transition hover:tx1"
                >
                  {f.toUpperCase()}
                </a>
              ))}
            </div>
            {Boolean((gate.warnings as string[] | undefined)?.length) && (
              <ul className="space-y-0.5 rounded-md bg-amber-400/10 px-2 py-1.5">
                {((gate.warnings as string[]) ?? []).map((w, i) => (
                  <li key={i} className="text-[8.5px] font-light text-amber-200">{w}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-[9px] font-light tx3">
            {rtl ? "برای دریافت فایل، ابتدا امکان صدور را بررسی کنید." : "Check availability first."}
          </p>
        )}

        {msg && (
          <div className="mt-2">
            <p className={`text-[9px] font-light ${msg.kind === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{msg.text}</p>
            {Boolean(msg.details?.length) && (
              <ul className="mt-1 space-y-0.5">
                {(msg.details ?? []).map((d, i) => (
                  <li key={i} className="text-[8.5px] font-extralight text-rose-200">{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      {/* ── چکیدهٔ گزارش (D8) ── */}
      <Section
        title={rtl ? "چکیدهٔ گزارش A4" : "A4 report summary"}
        note={rtl ? "نیازمند مجوز صدور" : "requires export permission"}
      >
        <button
          onClick={() => void makeReport()}
          disabled={busy}
          className="rounded-lg border b-line-soft px-3 py-1.5 text-[9.5px] font-light tx2 transition hover:tx1 disabled:opacity-40"
        >
          {busy ? (rtl ? "در حال صدور…" : "issuing…") : (rtl ? "صدور گزارش" : "Issue report")}
        </button>
        {msg && (
          <p className={`mt-2 text-[9px] font-light ${msg.kind === "ok" ? "text-emerald-300" : "text-rose-300"}`}>
            {msg.text}
          </p>
        )}
        {report && (
          <div className="mt-2 rounded-xl border b-line-soft bg-black/10 p-3">
            <h5 className="text-[11px] font-semibold tx1">{String((report.header as Json).titleFa)}</h5>
            <p className="mt-1 text-[9.5px] font-light tx2">{String((report.header as Json).headlineFa)}</p>
            <div className="mt-2 space-y-0.5">
              <Row k={rtl ? "پروژه" : "Project"} v={String((report.header as Json).projectId)} mono />
              <Row k={rtl ? "بازه" : "Period"} v={String((report.header as Json).periodFa)} mono />
              <Row k={rtl ? "صادرکننده" : "Issued by"} v={String((report.header as Json).issuedBy)} mono />
              <Row k={rtl ? "شمارهٔ ردیابی" : "Trace"} v={String((report.header as Json).traceId)} mono />
              <Row k={rtl ? "قطع" : "Page"} v={String((report.header as Json).pageSize)} mono />
            </div>
            {/* مبنای محاسبه روی برگه می‌ماند: خواننده باید بداند کدام
                ساعت‌ها شمرده شده‌اند، وگرنه فرض می‌کند همه را می‌بیند. */}
            <p className="mt-2 rounded-lg border b-line-soft px-2 py-1 text-[8.5px] font-extralight tx3">
              {rtl ? "مبنای محاسبه: " : "Basis: "}{String((report.header as Json).basisFa)}
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ─────────────── کمکی ─────────────── */

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b b-line-soft/40 py-1">
      <span className="shrink-0 text-[8.5px] font-extralight tx3">{k}</span>
      <span className={`min-w-0 truncate text-end text-[9.5px] tx1 ${mono ? "font-mono" : ""}`} dir={mono ? "ltr" : undefined}>{v}</span>
    </div>
  );
}

const GATE_KEYS = ["contract", "medical", "hseTraining", "tradeDocs", "gatePass"] as const;

const GATE_LABEL: Record<(typeof GATE_KEYS)[number], { fa: string; en: string }> = {
  contract: { fa: "قرارداد امضاشده", en: "Signed contract" },
  medical: { fa: "معاینات طب کار (دادهٔ نمونه)", en: "Medical clearance (sample data)" },
  /* برچسب پیشین می‌گفت «از ماژول HSE» در حالی که مقدارش دادهٔ نمونه
   * بود. حالا مسیر واقعی وجود دارد
   * (`GET /api/hse/clearance/:personRef`) ولی این کارت در سطح
   * «درخواست بسیج رسته» است نه فرد، پس اتصال یک‌به‌یک ندارد. تا وقتی
   * وصل نشده، برچسب نباید منبعی را ادعا کند که از آن نمی‌خواند. */
  hseTraining: { fa: "آموزش ایمنی (دادهٔ نمونه)", en: "HSE training (sample data)" },
  tradeDocs: { fa: "مدارک تخصصی رسته", en: "Trade documents" },
  gatePass: { fa: "کارت تردد", en: "Gate pass" },
};

const STATUS_LABEL: Record<MobilizationRequest["status"], { fa: string; en: string }> = {
  draft: { fa: "پیش‌نویس", en: "Draft" },
  submitted: { fa: "ارسال‌شده", en: "Submitted" },
  approved: { fa: "تأییدشده", en: "Approved" },
  in_progress: { fa: "در جریان جذب", en: "In progress" },
  fulfilled: { fa: "تکمیل‌شده", en: "Fulfilled" },
  rejected: { fa: "رد شده", en: "Rejected" },
  cancelled: { fa: "لغو شده", en: "Cancelled" },
};

const STATUS_TONE: Record<MobilizationRequest["status"], string> = {
  draft: "bg-white/5 tx3",
  submitted: "bg-sky-400/15 text-sky-300",
  approved: "bg-indigo-400/15 text-indigo-300",
  in_progress: "bg-amber-400/15 text-amber-200",
  fulfilled: "bg-emerald-400/15 text-emerald-300",
  rejected: "bg-rose-400/15 text-rose-300",
  cancelled: "bg-white/5 tx4",
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
