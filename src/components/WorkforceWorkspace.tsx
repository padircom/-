import { useEffect, useMemo, useState } from "react";
import { type Lang } from "../data/framework";
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

/** کارت تب‌های در دست ساخت — نقشه راه صادقانه به جای صفحه خالی. */
function Upcoming({ rtl, tab }: { rtl: boolean; tab: (typeof TABS)[number] }) {
  const plan: Record<HrmTab, { fa: string; en: string }[]> = {
    planning: [],
    timesheet: [
      { fa: "موتور تفکیک ساعت عادی / اضافه‌کاری / شب / تعطیل طبق قانون کار", en: "Hours split engine per labor law" },
      { fa: "ثبت میدانی آفلاین با GPS، عکس و امضای دیجیتال", en: "Offline field capture with GPS, photo and signature" },
      { fa: "چرخه تأیید هفت‌مرحله‌ای و قفل دوره", en: "Seven-stage approval and period lock" },
      { fa: "حل تعارض همگام‌سازی مبتنی بر امضا", en: "Signature-based sync conflict resolution" },
    ],
    productivity: [
      { fa: "شاخص بهره‌وری از پیشرفت تأییدشده", en: "PI from approved progress only" },
      { fa: "مقایسه نرخ اجرا با نرخ استاندارد رسته", en: "Unit rate vs trade standard" },
      { fa: "ریشه‌یابی افت بهره‌وری و پل به ادعا", en: "Root-cause analysis and claim linkage" },
    ],
    crew: [
      { fa: "ترکیب اکیپ و بهره‌وری تیمی", en: "Crew mix and team productivity" },
      { fa: "قرارداد نیروی پیمانکاری و صورت‌کارکرد", en: "Subcontracted labor and payment certificates" },
    ],
    onboarding: [
      { fa: "پنج گیت تجهیز و پرونده پرسنلی", en: "Five mobilization gates and personnel file" },
      { fa: "پایش انقضای مدارک و ماتریس مهارت", en: "Document expiry watch and skill matrix" },
    ],
    analytics: [
      { fa: "هیستوگرام نیرو برنامه در برابر واقعی", en: "Manpower histogram plan vs actual" },
      { fa: "شش شاخص کلیدی و مرکز گزارش A4 سه‌لوگو", en: "Six KPIs and A4 three-logo report centre" },
    ],
  };
  const items = plan[tab.id] ?? [];
  return (
    <Section
      title={rtl ? `${tab.fa} — در دست ساخت` : `${tab.en} — under construction`}
      note={rtl ? `طراحی این زیرماژول در تحویلی ${tab.deliverable} انجام می‌شود` : `designed in deliverable ${tab.deliverable}`}
    >
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 rounded-lg border b-line-soft bg-black/10 px-2.5 py-1.5">
            <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" />
            <span className="text-[9.5px] font-light tx2">{rtl ? it.fa : it.en}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[8.5px] font-extralight tx4">
        {rtl
          ? "موتور محاسباتی این بخش‌ها در src/services/workforce.ts آماده است و پس از تأیید طراحی به رابط کاربری وصل می‌شود."
          : "The calculation engine already exists in src/services/workforce.ts and will be wired once the design is approved."}
      </p>
    </Section>
  );
}

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

        {/* ═══ تب‌های ۲ تا ۶ — نقشه راه ═══ */}
        {tab !== "planning" && <Upcoming rtl={rtl} tab={TABS.find((x) => x.id === tab)!} />}
      </div>
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
  medical: { fa: "معاینات طب کار", en: "Medical clearance" },
  hseTraining: { fa: "آموزش ایمنی (از ماژول HSE)", en: "HSE training (from HSE module)" },
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
