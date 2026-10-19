import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import ModuleWorkspaceShell, { moduleCardCls, moduleChipCls, moduleSelectCls } from "./ModuleWorkspaceShell";
import CmmsRcfaPanel from "./CmmsRcfaPanel";
import CmmsIntegrationPanel from "./CmmsIntegrationPanel";
import CmmsWorkflowMap from "./CmmsWorkflowMap";
import {
  CmmsAiPanel,
  CmmsAlertsPanel,
  CmmsAssetsPanel,
  CmmsFamiliesPanel,
  CmmsKpiPanel,
  CmmsPmPanel,
  CmmsSparesPanel,
  CmmsWorkOrdersPanel,
} from "./CmmsCrudPanels";
import {
  canCmmsAccess,
  CmmsClient,
  CMMS_DEMO_USERS,
  CmmsRequestError,
  DEFAULT_SITE_ID,
  type CmmsDashboard,
} from "../services/cmmsApi";

export type CmmsSubModuleId =
  | "dashboard"
  | "workflow"
  | "assets"
  | "families"
  | "pm"
  | "work-orders"
  | "spares"
  | "condition"
  | "analytics"
  | "rcfa"
  | "integration"
  | "ai";

/**
 * دسته‌بندی سایدبار داخلی CMMS. سایدبار اصلی فقط ۵ ماژول اصلی را نشان
 * می‌دهد (`CMMS_SIDEBAR_ITEMS` در RightSidebar) و باقی زیرماژول‌ها
 * این‌جا، زیر این دسته‌ها می‌نشینند تا فهرست داخلی بلند ولی خوانا بماند.
 */
export type CmmsGroupId = "overview" | "assets" | "execution" | "reliability" | "smart";

export const CMMS_GROUPS: Record<CmmsGroupId, { fa: string; en: string }> = {
  overview: { fa: "نمای کلی و فرآیند", en: "Overview & Process" },
  assets: { fa: "دارایی و ساختار تجهیز", en: "Assets & Equipment Structure" },
  execution: { fa: "برنامه‌ریزی، اجرا و پشتیبانی کار", en: "Planning, Execution & Support" },
  reliability: { fa: "پایش وضعیت و قابلیت اطمینان", en: "Condition Monitoring & Reliability" },
  smart: { fa: "یکپارچگی و هوشمندی", en: "Integration & Intelligence" },
};

export const CMMS_SUBMODULES: Array<{
  id: CmmsSubModuleId;
  icon: string;
  fa: string;
  en: string;
  descFa: string;
  descEn: string;
  /** دستهٔ این زیرماژول در سایدبار داخلی CMMS. */
  group: CmmsGroupId;
  /** مجوز لازم برای دیدن این بخش؛ اگر کاربر نداشته باشد تب غیرفعال می‌شود. */
  viewPermission: string;
}> = [
  {
    id: "dashboard", icon: "📊", fa: "داشبورد مدیریت نت", en: "Maintenance Dashboard",
    descFa: "نمای یکپارچهٔ دارایی‌ها، دستورکارها، هشدارها، قابلیت اطمینان و پیشنهادهای هوشمند.",
    descEn: "Unified view of assets, work orders, alerts, reliability and AI recommendations.",
    group: "overview",
    viewPermission: "cmms.dashboard.view",
  },
  {
    id: "workflow", icon: "🗺️", fa: "نقشهٔ گردش‌کار نت", en: "Maintenance Workflow Map",
    descFa: "نقشهٔ تعاملی جریان فرآیند نت (الگوی PMworks): سه ورودی PM/CBM/خرابی، چرخهٔ پنج‌گامی و حلقهٔ بازخورد CAPA — کلیک روی هر گام بخش مربوطه را باز می‌کند.",
    descEn: "Interactive maintenance process flow (PMworks pattern): PM/CBM/breakdown inputs, the five-step cycle and the CAPA feedback loop — click any step to open its section.",
    group: "overview",
    viewPermission: "cmms.dashboard.view",
  },
  {
    id: "assets", icon: "⚙️", fa: "شناسنامه تجهیزات و دارایی‌ها", en: "Equipment & Asset Registry",
    descFa: "درخت تجهیزات، مشخصات فنی، محل استقرار، وضعیت بهره‌برداری و تاریخچهٔ کارکرد.",
    descEn: "Asset hierarchy, technical specs, location, operational state and runtime history.",
    group: "assets",
    viewPermission: "cmms.asset.view",
  },
  {
    id: "families", icon: "🧬", fa: "خانوادهٔ تجهیز (PMworks)", en: "Equipment Family (PMworks)",
    descFa: "الگوی خانواده، درخت ساختاری، حالات خرابی ISO 14224، فعالیت‌های PM و چک‌لیست استاندارد.",
    descEn: "Family template, boundary tree, ISO 14224 failure modes, PM tasks and standard checklists.",
    group: "assets",
    viewPermission: "cmms.family.view",
  },
  {
    id: "pm", icon: "🗓️", fa: "برنامه‌ریزی نت پیشگیرانه", en: "Preventive Maintenance Planning",
    descFa: "زمان‌بندی سرویس‌های دوره‌ای بر پایهٔ زمان یا کارکرد و بهینه‌سازی فاصلهٔ سرویس.",
    descEn: "Time-based and meter-based PM schedules plus interval optimization.",
    group: "execution",
    viewPermission: "cmms.pm.view",
  },
  {
    id: "work-orders", icon: "🛠️", fa: "درخواست‌کار و دستورکار", en: "Work Requests & Orders",
    descFa: "ثبت درخواست، آزادسازی، اجرا با چک‌لیست، ثبت نفرساعت و هزینه، اتمام و بستن.",
    descEn: "Request, release, execute with checklists, post labor and cost, complete and close.",
    group: "execution",
    viewPermission: "cmms.wo.view",
  },
  {
    id: "spares", icon: "🔩", fa: "انبار قطعات یدکی", en: "MRO Spare Parts",
    descFa: "فهرست قطعات، نقطهٔ سفارش، رسید و حواله و کنترل کسری موجودی.",
    descEn: "Parts catalog, reorder points, receipts and issues, shortage control.",
    group: "execution",
    viewPermission: "cmms.spare.view",
  },
  {
    id: "condition", icon: "🌡️", fa: "پایش وضعیت و هشدارها", en: "Condition Monitoring & Alerts",
    descFa: "قرائت ارتعاش و دما بر پایهٔ ISO 10816، آستانه‌ها و هشدارهای بلادرنگ.",
    descEn: "Vibration and temperature readings per ISO 10816, thresholds and live alerts.",
    group: "reliability",
    viewPermission: "cmms.alert.view",
  },
  {
    id: "analytics", icon: "📈", fa: "قابلیت اطمینان و هزینهٔ چرخهٔ عمر", en: "Reliability & LCC Analytics",
    descFa: "MTBF/MTTR/دسترس‌پذیری، OEE، شاخص‌های IEEE 1366 و NPV چرخهٔ عمر.",
    descEn: "MTBF/MTTR/availability, OEE, IEEE 1366 indices and life-cycle NPV.",
    group: "reliability",
    viewPermission: "cmms.reliability.view",
  },
  {
    id: "rcfa", icon: "🧩", fa: "تحلیل ریشه‌ای (RCFA)", en: "Root Cause Analysis (RCFA)",
    descFa: "۵ چرا و استخوان‌ماهی ۶M با پارتو وزنی، و CAPA با ارجاع به مالک یا تبدیل به دستورکار.",
    descEn: "5-Why and 6M fishbone with weighted Pareto, plus CAPA referred to an owner or a new work order.",
    group: "reliability",
    viewPermission: "cmms.rca.view",
  },
  {
    id: "integration", icon: "🔗", fa: "یکپارچگی با تولید (MES)", en: "Cross-module Integration (MES)",
    descFa: "صف رویداد توقف/ظرفیت و رزرو نرم ظرفیت مراکز کاری — بدون کلید خارجی بین دو ماژول.",
    descEn: "Downtime/capacity event outbox and soft work-center reservations — no foreign key across modules.",
    group: "smart",
    viewPermission: "cmms.integration.view",
  },
  {
    id: "ai", icon: "🤖", fa: "هوش مصنوعی نت", en: "Maintenance AI",
    descFa: "تحلیل خرابی، بهینه‌سازی PM، راهنمای تعمیر، تولید درخت و زمان‌بند هوشمند.",
    descEn: "Failure analysis, PM optimization, repair guidance, tree generation and smart scheduling.",
    group: "smart",
    viewPermission: "cmms.ai.view",
  },
];

interface Props {
  lang: Lang;
  activeSub: CmmsSubModuleId;
  onSelectSub: (sub: CmmsSubModuleId) => void;
  onBackHome?: () => void;
}

/** وضعیت بارگذاری یک بخش از داده. */
type LoadState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "error"; message: string; code?: string };

function useCmmsLoader<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<LoadState<T>>({ kind: "idle" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    loader()
      .then((data) => { if (!cancelled) setState({ kind: "ready", data }); })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof CmmsRequestError
          ? `${error.message}${error.code ? ` (${error.code})` : ""}`
          : error instanceof Error ? error.message : "خطای ناشناخته";
        setState({ kind: "error", message, code: error instanceof CmmsRequestError ? error.code : undefined });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { state, reload };
}

/** پیام خطای سرور را طوری نشان می‌دهد که کاربر بداند چه کار کند. */
function ErrorBox({ message, code, onRetry, fa }: { message: string; code?: string; onRetry: () => void; fa: boolean }) {
  /* ۴۰۱/۴۰۳ یعنی هویت یا مجوز؛ تکرار درخواست کمکی نمی‌کند، پس دکمهٔ
   * «تلاش دوباره» برای آن‌ها نمایش داده نمی‌شود. */
  const isAccessError = code === "CMMS_AUTH_REQUIRED" || code === "CMMS_FORBIDDEN" || code === "CMMS_SITE_SCOPE_DENIED";
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 space-y-2">
      <div className="tx1 text-xs font-medium">{fa ? "دریافت داده ناموفق بود" : "Failed to load data"}</div>
      <div className="tx2 text-[11px] leading-5" dir="rtl">{message}</div>
      {isAccessError && (
        <div className="tx3 text-[11px]">
          {fa ? "کاربر دیگری را از نوار بالا انتخاب کنید." : "Pick another user from the top bar."}
        </div>
      )}
      {!isAccessError && (
        <button type="button" onClick={onRetry} className="rounded-lg border b-line-soft px-2.5 py-1 text-[11px] tx2 hover:tx1">
          {fa ? "تلاش دوباره" : "Retry"}
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, hint, fa }: { label: string; value: string | number; hint?: string; fa: boolean }) {
  return (
    <div className={`${moduleCardCls} p-3 space-y-0.5`}>
      <div className="tx3 text-[11px]">{label}</div>
      <div className="tx1 text-lg font-semibold" dir="ltr">{value}</div>
      {hint && <div className="tx3 text-[10px]">{fa ? hint : hint}</div>}
    </div>
  );
}

function SectionTitle({ fa, en, children }: { fa: boolean; en: string; children: string }) {
  return <h4 className="tx2 text-xs font-medium">{fa ? children : en}</h4>;
}

/* ── نمودارهای داشبورد (SVG/دیو خالص، بدون وابستگی؛ رنگ از پالت ثابت و
 * سطح‌ها از متغیرهای تم تا هر دو حالت Dark/Light خوانا بماند) ─────── */
const CHART_COLORS = ["#38bdf8", "#34d399", "#a78bfa", "#fb7185", "#fbbf24", "#f472b6", "#94a3b8", "#2dd4bf"];
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#fb7185", high: "#fbbf24", medium: "#38bdf8", low: "#34d399", info: "#94a3b8",
};

function sortedEntries(data: Record<string, number>): Array<[string, number]> {
  return Object.entries(data).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
}

function ChartEmpty({ fa }: { fa: boolean }) {
  return <div className="tx3 py-4 text-center text-[11px]">{fa ? "داده‌ای برای نمودار نیست" : "No data to chart"}</div>;
}

/** نمودار میله‌ای افقی برای توزیع‌های دسته‌ای (شدت هشدار، حالت خرابی…). */
function BarList({ data, fa, colorByKey }: { data: Record<string, number>; fa: boolean; colorByKey?: Record<string, string> }) {
  const entries = sortedEntries(data);
  if (entries.length === 0) return <ChartEmpty fa={fa} />;
  const max = Math.max(...entries.map(([, v]) => v));
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  return (
    <div className="space-y-2">
      {entries.map(([key, value], index) => (
        <div key={key} className="space-y-0.5">
          <div className="flex items-center justify-between gap-2 text-[10.5px]">
            <span className="tx2 min-w-0 truncate" dir="ltr">{key}</span>
            <span className="tx3 shrink-0 tabular-nums" dir="ltr">{value} · {total ? Math.round((value / total) * 100) : 0}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--row)" }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${max ? (value / max) * 100 : 0}%`, background: colorByKey?.[key] ?? CHART_COLORS[index % CHART_COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** نمودار دونات وضعیت‌ها با راهنمای رنگی و مجموع در مرکز. */
function DonutChart({ data, fa, centerLabel }: { data: Record<string, number>; fa: boolean; centerLabel: string }) {
  const entries = sortedEntries(data);
  if (entries.length === 0) return <ChartEmpty fa={fa} />;
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = entries.map(([key, value], index) => {
    const fraction = total ? value / total : 0;
    const segment = { key, value, color: CHART_COLORS[index % CHART_COLORS.length], dash: fraction * circumference, offset };
    offset += fraction * circumference;
    return segment;
  });
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 120 120" className="h-[110px] w-[110px] shrink-0 -rotate-90" role="img" aria-label={centerLabel}>
        <circle cx={60} cy={60} r={radius} fill="none" strokeWidth={13} style={{ stroke: "var(--row)" }} />
        {segments.map((segment) => (
          <circle
            key={segment.key}
            cx={60} cy={60} r={radius} fill="none"
            stroke={segment.color} strokeWidth={13}
            strokeDasharray={`${Math.max(segment.dash - 1.5, 0)} ${circumference}`}
            strokeDashoffset={-segment.offset}
          />
        ))}
        <text x={60} y={57} textAnchor="middle" fontSize={19} fontWeight={700} fill="var(--ink)" transform="rotate(90 60 60)">{total}</text>
        <text x={60} y={72} textAnchor="middle" fontSize={8} fill="var(--ink3)" transform="rotate(90 60 60)">{centerLabel}</text>
      </svg>
      <ul className="min-w-[130px] flex-1 space-y-1">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-1.5 text-[10.5px]">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: segment.color }} aria-hidden="true" />
            <span className="tx2 min-w-0 flex-1 truncate" dir="ltr">{segment.key}</span>
            <span className="tx3 tabular-nums" dir="ltr">{segment.value} · {total ? Math.round((segment.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** کارت شاخص درصدی با حلقهٔ پیشرفت (دسترس‌پذیری، OEE). */
function RingKpiCard({ label, pct, fa }: { label: string; pct: number | null; fa: boolean }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const clamped = pct == null ? 0 : Math.min(Math.max(pct, 0), 100);
  return (
    <div className={`${moduleCardCls} flex items-center gap-3 p-3`}>
      <svg viewBox="0 0 64 64" className="h-14 w-14 shrink-0 -rotate-90" role="img" aria-label={label}>
        <circle cx={32} cy={32} r={radius} fill="none" strokeWidth={6} style={{ stroke: "var(--row)" }} />
        {pct != null && (
          <circle cx={32} cy={32} r={radius} fill="none" stroke={CMMS_ACCENT} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`} />
        )}
        <text x={32} y={36} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--ink)" transform="rotate(90 32 32)">
          {pct == null ? "—" : `${Math.round(clamped)}%`}
        </text>
      </svg>
      <div className="min-w-0">
        <div className="tx3 text-[11px]">{label}</div>
        <div className="tx2 mt-0.5 text-[10px]">{fa ? "آخرین snapshot قابلیت اطمینان" : "Latest reliability snapshot"}</div>
      </div>
    </div>
  );
}

/** رنگ تأکیدی CMMS (هم‌خوان با کاشی کهربایی قبلی). */
const CMMS_ACCENT = "#fbbf24";

export default function CmmsWorkspaceShell({ lang, activeSub, onSelectSub, onBackHome }: Props) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);

  const [siteId, setSiteId] = useState(DEFAULT_SITE_ID);
  const [sites, setSites] = useState<Array<{ SiteId: string; NameFa: string }>>([]);
  const [userId, setUserId] = useState(CMMS_DEMO_USERS[0].id);

  /* فهرست سایت‌ها یک‌بار گرفته می‌شود؛ سرور خودش آن را به دامنهٔ کاربر
   * محدود می‌کند، پس نیازی به فیلتر سمت کلاینت نیست. */
  useEffect(() => {
    let cancelled = false;
    CmmsClient.listSites(userId)
      .then((data) => { if (!cancelled) setSites(data.sites); })
      .catch(() => { if (!cancelled) setSites([]); });
    return () => { cancelled = true; };
  }, [userId]);

  const visibleSubs = useMemo(
    () => CMMS_SUBMODULES.filter((item) => canCmmsAccess(userId, item.viewPermission, siteId)),
    [userId, siteId],
  );
  const current = CMMS_SUBMODULES.find((item) => item.id === activeSub) ?? CMMS_SUBMODULES[0];
  const canSeeCurrent = canCmmsAccess(userId, current.viewPermission, siteId);

  /* ── دادهٔ هر بخش ─────────────────────────────────────────────── */
  const dashboard = useCmmsLoader<CmmsDashboard>(
    () => CmmsClient.getDashboard(siteId, userId),
    [siteId, userId, activeSub],
  );
  const renderBody = () => {
    if (!canSeeCurrent) {
      return (
        <div className={`${moduleCardCls} p-4`}>
          <div className="tx1 text-sm font-medium">{tr("مجوز دسترسی به این بخش را ندارید", "You do not have access to this section")}</div>
          <p className="tx3 text-[11px] mt-1" dir="ltr">
            {tr("مجوز لازم: ", "Required permission: ")}{current.viewPermission}
          </p>
          <p className="tx3 text-[11px] mt-1">
            {tr(
              "کاربر دیگری را از نوار بالا انتخاب کنید؛ ماتریس مجوز نقش‌ها در accessControl.ts تعریف شده است.",
              "Pick another user from the top bar; the role permission matrix lives in accessControl.ts.",
            )}
          </p>
        </div>
      );
    }

    switch (current.id) {
      case "dashboard": {
        if (dashboard.state.kind === "loading") return <Loading fa={fa} />;
        if (dashboard.state.kind === "error") return <ErrorBox {...pick(dashboard.state)} onRetry={dashboard.reload} fa={fa} />;
        if (dashboard.state.kind !== "ready") return <Empty fa={fa} />;
        const d = dashboard.state.data;
        const healthySpares = Math.max(d.counts.spareParts - d.spares.belowReorder, 0);
        const lowSpares = Math.max(d.spares.belowReorder - d.spares.outOfStock, 0);
        return (
          <div className="space-y-4">
            {/* کارت‌های شمارشی اصلی */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard fa={fa} label={tr("تجهیزات ثبت‌شده", "Registered assets")} value={d.counts.assets} hint={tr(`${d.counts.criticalAssets} تجهیز بحرانی (رتبهٔ A)`, `${d.counts.criticalAssets} critical (rank A)`)} />
              <StatCard fa={fa} label={tr("خانوادهٔ تجهیز", "Equipment families")} value={d.counts.families} />
              <StatCard fa={fa} label={tr("دستورکارها", "Work orders")} value={d.counts.workOrders} hint={tr(`${d.counts.openAlerts} هشدار باز`, `${d.counts.openAlerts} open alerts`)} />
              <StatCard fa={fa} label={tr("قطعات یدکی", "Spare parts")} value={d.counts.spareParts} hint={tr(`${d.spares.belowReorder} زیر نقطهٔ سفارش`, `${d.spares.belowReorder} below reorder`)} />
            </div>

            {/* کارت‌های شاخص قابلیت اطمینان */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <RingKpiCard fa={fa} label={tr("دسترس‌پذیری", "Availability")} pct={d.highlights.latestAvailabilityPct} />
              <RingKpiCard fa={fa} label={tr("میانگین OEE", "Average OEE")} pct={d.highlights.averageOeePct} />
              <StatCard fa={fa} label="MTBF" value={d.highlights.latestMtbfHours != null ? `${d.highlights.latestMtbfHours} h` : "—"} hint={tr("میانگین زمان بین دو خرابی", "Mean time between failures")} />
              <StatCard fa={fa} label="MTTR" value={d.highlights.latestMttrHours != null ? `${d.highlights.latestMttrHours} h` : "—"} hint={tr("میانگین زمان تعمیر", "Mean time to repair")} />
            </div>

            {/* نمودارهای توزیعی */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              <div className={`${moduleCardCls} p-3.5 space-y-3`}>
                <SectionTitle fa={fa} en="Work orders by status">{tr("دستورکارها بر پایهٔ وضعیت", "Work orders by status")}</SectionTitle>
                <DonutChart fa={fa} data={d.workOrdersByStatus} centerLabel={fa ? "دستورکار" : "orders"} />
              </div>
              <div className={`${moduleCardCls} p-3.5 space-y-3`}>
                <SectionTitle fa={fa} en="Open alerts by severity">{tr("هشدارهای باز بر پایهٔ شدت", "Open alerts by severity")}</SectionTitle>
                <BarList fa={fa} data={d.openAlertsBySeverity} colorByKey={SEVERITY_COLORS} />
              </div>
              <div className={`${moduleCardCls} p-3.5 space-y-3`}>
                <SectionTitle fa={fa} en="Failures by mode">{tr("خرابی‌ها بر پایهٔ حالت خرابی", "Failures by mode")}</SectionTitle>
                <BarList fa={fa} data={d.failuresByMode} />
              </div>
            </div>

            {/* وضعیت موجودی قطعات: نوار انباشتهٔ سالم / کم‌موجودی / تمام‌شده */}
            <div className={`${moduleCardCls} p-3.5 space-y-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionTitle fa={fa} en="Spare-parts stock health">{tr("سلامت موجودی قطعات یدکی", "Spare-parts stock health")}</SectionTitle>
                <span className="tx3 text-[10px]" dir="ltr">model: {d.modelVersion}</span>
              </div>
              {d.counts.spareParts > 0 ? (
                <>
                  <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: "var(--row)" }} dir="ltr">
                    <div style={{ width: `${(healthySpares / d.counts.spareParts) * 100}%`, background: "#34d399" }} />
                    <div style={{ width: `${(lowSpares / d.counts.spareParts) * 100}%`, background: "#fbbf24" }} />
                    <div style={{ width: `${(d.spares.outOfStock / d.counts.spareParts) * 100}%`, background: "#fb7185" }} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] tx2">
                    <span>🟢 {tr("موجودی سالم", "Healthy")}: <b className="tx1" dir="ltr">{healthySpares}</b></span>
                    <span>🟡 {tr("زیر نقطهٔ سفارش", "Below reorder")}: <b className="tx1" dir="ltr">{lowSpares}</b></span>
                    <span>🔴 {tr("تمام‌شده", "Out of stock")}: <b className="tx1" dir="ltr">{d.spares.outOfStock}</b></span>
                    <span>⚠️ {tr("خرابی‌های ثبت‌شده", "Recorded failures")}: <b className="tx1" dir="ltr">{d.counts.failures}</b></span>
                  </div>
                </>
              ) : <ChartEmpty fa={fa} />}
            </div>

            {d.counts.proposedAiRecommendations > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                <div className="tx1 text-xs font-medium">
                  {tr(
                    `${d.counts.proposedAiRecommendations} پیشنهاد هوشمند در انتظار بازبینی است`,
                    `${d.counts.proposedAiRecommendations} AI recommendations awaiting review`,
                  )}
                </div>
                <p className="tx3 text-[11px] mt-1">
                  {tr(
                    "هیچ پیشنهادی خودکار اعمال نمی‌شود؛ پذیرش و اعمال به مجوز جداگانه نیاز دارد.",
                    "Nothing is applied automatically; accepting and applying need separate permissions.",
                  )}
                </p>
              </div>
            )}
          </div>
        );
      }

      case "workflow":
        return <CmmsWorkflowMap fa={fa} onNavigate={onSelectSub} />;

      case "assets":
        return <CmmsAssetsPanel fa={fa} siteId={siteId} userId={userId} />;

      case "families":
        return <CmmsFamiliesPanel fa={fa} siteId={siteId} userId={userId} />;

      case "work-orders":
        return <CmmsWorkOrdersPanel fa={fa} siteId={siteId} userId={userId} />;

      case "rcfa":
        return <CmmsRcfaPanel siteId={siteId} userId={userId} lang={lang} />;

      case "integration":
        return <CmmsIntegrationPanel siteId={siteId} userId={userId} lang={lang} />;

      case "spares":
        return <CmmsSparesPanel fa={fa} siteId={siteId} userId={userId} />;

      case "condition":
        return <CmmsAlertsPanel fa={fa} siteId={siteId} userId={userId} />;

      case "pm":
        return <CmmsPmPanel fa={fa} siteId={siteId} userId={userId} />;

      case "analytics":
        return <CmmsKpiPanel fa={fa} siteId={siteId} userId={userId} />;

      case "ai":
        return <CmmsAiPanel fa={fa} siteId={siteId} userId={userId} />;

      default:
        return <Empty fa={fa} />;
    }
  };

  const siteOptions = sites.length === 0 ? [{ SiteId: DEFAULT_SITE_ID, NameFa: DEFAULT_SITE_ID }] : sites;

  return (
    <ModuleWorkspaceShell
      lang={lang}
      accent={CMMS_ACCENT}
      icon="🔧"
      title={tr("سامانهٔ نگهداری و تعمیرات (CMMS)", "Computerized Maintenance Management System (CMMS)")}
      subtitle={tr(
        "بخش سوم سازمان · ISO 55000/14224/60812/60300 · ۱۲۱ مسیر REST زیر /api/cmms",
        "Organizational Pillar #3 · ISO 55000/14224/60812/60300 · 121 REST routes under /api/cmms",
      )}
      badges={
        <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
          {tr("متصل به API", "Live API")}
        </span>
      }
      actions={
        <>
          <select value={siteId} onChange={(event) => setSiteId(event.target.value)} className={moduleSelectCls} dir="ltr">
            {siteOptions.map((site) => (
              <option key={site.SiteId} value={site.SiteId}>{site.SiteId} — {site.NameFa}</option>
            ))}
          </select>
          <select value={userId} onChange={(event) => setUserId(event.target.value)} className={moduleSelectCls} dir="ltr">
            {CMMS_DEMO_USERS.map((user) => (
              <option key={user.id} value={user.id}>{fa ? user.fa : user.en}</option>
            ))}
          </select>
        </>
      }
      onBack={onBackHome}
      navTitle={tr("نگهداری و تعمیرات", "Maintenance Management")}
      navItems={CMMS_SUBMODULES.map((item) => {
        const allowed = canCmmsAccess(userId, item.viewPermission, siteId);
        return {
          id: item.id,
          label: fa ? item.fa : item.en,
          icon: item.icon,
          group: fa ? CMMS_GROUPS[item.group].fa : CMMS_GROUPS[item.group].en,
          disabled: !allowed,
          disabledHint: tr("مجوز این بخش را ندارید", "No permission for this section"),
        };
      })}
      activeId={current.id}
      onSelect={onSelectSub}
      panelTitle={fa ? current.fa : current.en}
      panelIcon={current.icon}
      panelDesc={fa ? current.descFa : current.descEn}
      panelMeta={<span className={moduleChipCls} dir="ltr">{siteId} · {current.viewPermission}</span>}
      notice={
        visibleSubs.length === 0 ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5">
            <div className="tx1 text-xs font-medium">
              {tr("این کاربر به هیچ بخشی از CMMS در این سایت دسترسی ندارد", "This user has no CMMS access on this site")}
            </div>
          </div>
        ) : undefined
      }
    >
      {renderBody()}
    </ModuleWorkspaceShell>
  );
}

/* ═══════════════════════ اجزای کمکی ═══════════════════════ */

function pick<T>(state: LoadState<T>): { message: string; code?: string } {
  return state.kind === "error" ? { message: state.message, code: state.code } : { message: "" };
}

function Loading({ fa }: { fa: boolean }) {
  return <div className="tx3 text-xs py-6 text-center">{fa ? "در حال دریافت داده…" : "Loading data…"}</div>;
}

function Empty({ fa, text }: { fa: boolean; text?: string }) {
  return (
    <div className="tx3 text-xs py-6 text-center">
      {text ?? (fa ? "داده‌ای برای نمایش در این سایت وجود ندارد." : "No data to display for this site.")}
    </div>
  );
}
