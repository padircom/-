import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import {
  canCmmsAccess,
  CmmsClient,
  CMMS_DEMO_USERS,
  CmmsRequestError,
  DEFAULT_SITE_ID,
  type CmmsAsset,
  type CmmsDashboard,
  type CmmsSparePart,
  type CmmsWorkOrder,
} from "../services/cmmsApi";

export type CmmsSubModuleId =
  | "dashboard"
  | "assets"
  | "families"
  | "pm"
  | "work-orders"
  | "spares"
  | "condition"
  | "analytics"
  | "ai";

export const CMMS_SUBMODULES: Array<{
  id: CmmsSubModuleId;
  icon: string;
  fa: string;
  en: string;
  descFa: string;
  descEn: string;
  /** مجوز لازم برای دیدن این بخش؛ اگر کاربر نداشته باشد تب غیرفعال می‌شود. */
  viewPermission: string;
}> = [
  {
    id: "dashboard", icon: "📊", fa: "داشبورد مدیریت نت", en: "Maintenance Dashboard",
    descFa: "نمای یکپارچهٔ دارایی‌ها، دستورکارها، هشدارها، قابلیت اطمینان و پیشنهادهای هوشمند.",
    descEn: "Unified view of assets, work orders, alerts, reliability and AI recommendations.",
    viewPermission: "cmms.dashboard.view",
  },
  {
    id: "assets", icon: "⚙️", fa: "شناسنامه تجهیزات و دارایی‌ها", en: "Equipment & Asset Registry",
    descFa: "درخت تجهیزات، مشخصات فنی، محل استقرار، وضعیت بهره‌برداری و تاریخچهٔ کارکرد.",
    descEn: "Asset hierarchy, technical specs, location, operational state and runtime history.",
    viewPermission: "cmms.asset.view",
  },
  {
    id: "families", icon: "🧬", fa: "خانوادهٔ تجهیز (PMworks)", en: "Equipment Family (PMworks)",
    descFa: "الگوی خانواده، درخت ساختاری، حالات خرابی ISO 14224، فعالیت‌های PM و چک‌لیست استاندارد.",
    descEn: "Family template, boundary tree, ISO 14224 failure modes, PM tasks and standard checklists.",
    viewPermission: "cmms.family.view",
  },
  {
    id: "pm", icon: "🗓️", fa: "برنامه‌ریزی نت پیشگیرانه", en: "Preventive Maintenance Planning",
    descFa: "زمان‌بندی سرویس‌های دوره‌ای بر پایهٔ زمان یا کارکرد و بهینه‌سازی فاصلهٔ سرویس.",
    descEn: "Time-based and meter-based PM schedules plus interval optimization.",
    viewPermission: "cmms.pm.view",
  },
  {
    id: "work-orders", icon: "🛠️", fa: "درخواست‌کار و دستورکار", en: "Work Requests & Orders",
    descFa: "ثبت درخواست، آزادسازی، اجرا با چک‌لیست، ثبت نفرساعت و هزینه، اتمام و بستن.",
    descEn: "Request, release, execute with checklists, post labor and cost, complete and close.",
    viewPermission: "cmms.wo.view",
  },
  {
    id: "spares", icon: "🔩", fa: "انبار قطعات یدکی", en: "MRO Spare Parts",
    descFa: "فهرست قطعات، نقطهٔ سفارش، رسید و حواله و کنترل کسری موجودی.",
    descEn: "Parts catalog, reorder points, receipts and issues, shortage control.",
    viewPermission: "cmms.spare.view",
  },
  {
    id: "condition", icon: "🌡️", fa: "پایش وضعیت و هشدارها", en: "Condition Monitoring & Alerts",
    descFa: "قرائت ارتعاش و دما بر پایهٔ ISO 10816، آستانه‌ها و هشدارهای بلادرنگ.",
    descEn: "Vibration and temperature readings per ISO 10816, thresholds and live alerts.",
    viewPermission: "cmms.alert.view",
  },
  {
    id: "analytics", icon: "📈", fa: "قابلیت اطمینان و هزینهٔ چرخهٔ عمر", en: "Reliability & LCC Analytics",
    descFa: "MTBF/MTTR/دسترس‌پذیری، OEE، شاخص‌های IEEE 1366 و NPV چرخهٔ عمر.",
    descEn: "MTBF/MTTR/availability, OEE, IEEE 1366 indices and life-cycle NPV.",
    viewPermission: "cmms.reliability.view",
  },
  {
    id: "ai", icon: "🤖", fa: "هوش مصنوعی نت", en: "Maintenance AI",
    descFa: "تحلیل خرابی، بهینه‌سازی PM، راهنمای تعمیر، تولید درخت و زمان‌بند هوشمند.",
    descEn: "Failure analysis, PM optimization, repair guidance, tree generation and smart scheduling.",
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
    <div className="rounded-xl border b-line-soft bg-black/15 p-3 space-y-0.5">
      <div className="tx3 text-[11px]">{label}</div>
      <div className="tx1 text-lg font-semibold" dir="ltr">{value}</div>
      {hint && <div className="tx3 text-[10px]">{fa ? hint : hint}</div>}
    </div>
  );
}

function SectionTitle({ fa, en, children }: { fa: boolean; en: string; children: string }) {
  return <h4 className="tx2 text-xs font-medium">{fa ? children : en}</h4>;
}

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
  const assets = useCmmsLoader<{ assets: CmmsAsset[]; total: number }>(
    () => CmmsClient.listAssets(siteId, userId, { limit: 200 }),
    [siteId, userId, activeSub],
  );
  const families = useCmmsLoader<{ families: Array<{ Id: string; FamilyCode: string; NameFa: string; Status: string; CriticalityRank: string }>; total: number }>(
    () => CmmsClient.listFamilies(siteId, userId),
    [siteId, userId, activeSub],
  );
  const workOrders = useCmmsLoader<{ workOrders: CmmsWorkOrder[]; total: number }>(
    () => CmmsClient.listWorkOrders(siteId, userId, { limit: 200 }),
    [siteId, userId, activeSub],
  );
  const spares = useCmmsLoader<{ parts: CmmsSparePart[]; total: number }>(
    () => CmmsClient.listSpareParts(siteId, userId),
    [siteId, userId, activeSub],
  );
  const alerts = useCmmsLoader<{ alerts: Array<{ Id: string; AlertCode: string; Severity: string; TitleFa: string; Status: string }>; total: number }>(
    () => CmmsClient.listAlerts(siteId, userId),
    [siteId, userId, activeSub],
  );
  const recommendations = useCmmsLoader<{ recommendations: Array<{ Id: string; Engine: string; RecommendationType: string; TitleFa: string; Confidence: number; Status: string }>; total: number }>(
    () => CmmsClient.listRecommendations(siteId, userId),
    [siteId, userId, activeSub],
  );

  const renderBody = () => {
    if (!canSeeCurrent) {
      return (
        <div className="rounded-xl border b-line-soft bg-black/15 p-4">
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
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard fa={fa} label={tr("تجهیزات ثبت‌شده", "Registered assets")} value={d.counts.assets} hint={tr(`${d.counts.criticalAssets} تجهیز بحرانی (رتبهٔ A)`, `${d.counts.criticalAssets} critical (rank A)`)} />
              <StatCard fa={fa} label={tr("خانوادهٔ تجهیز", "Equipment families")} value={d.counts.families} />
              <StatCard fa={fa} label={tr("دستورکارها", "Work orders")} value={d.counts.workOrders} hint={tr(`${d.counts.openAlerts} هشدار باز`, `${d.counts.openAlerts} open alerts`)} />
              <StatCard fa={fa} label={tr("قطعات یدکی", "Spare parts")} value={d.counts.spareParts} hint={tr(`${d.spares.belowReorder} زیر نقطهٔ سفارش`, `${d.spares.belowReorder} below reorder`)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-2">
                <SectionTitle fa={fa} en="Work orders by status">{tr("دستورکارها بر پایهٔ وضعیت", "Work orders by status")}</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(d.workOrdersByStatus).map(([status, count]) => (
                    <span key={status} className="rounded border b-line-soft bg-black/25 px-2 py-0.5 text-[11px] tx2" dir="ltr">
                      {status}: {count}
                    </span>
                  ))}
                  {Object.keys(d.workOrdersByStatus).length === 0 && <span className="tx3 text-[11px]">{tr("داده‌ای نیست", "No data")}</span>}
                </div>
              </div>
              <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-2">
                <SectionTitle fa={fa} en="Reliability highlights">{tr("نمای قابلیت اطمینان", "Reliability highlights")}</SectionTitle>
                <div className="grid grid-cols-2 gap-2 text-[11px] tx2">
                  <div>{tr("دسترس‌پذیری", "Availability")}: <span dir="ltr">{d.highlights.latestAvailabilityPct != null ? `${d.highlights.latestAvailabilityPct}%` : "—"}</span></div>
                  <div>MTBF: <span dir="ltr">{d.highlights.latestMtbfHours != null ? `${d.highlights.latestMtbfHours} h` : "—"}</span></div>
                  <div>MTTR: <span dir="ltr">{d.highlights.latestMttrHours != null ? `${d.highlights.latestMttrHours} h` : "—"}</span></div>
                  <div>{tr("میانگین OEE", "Average OEE")}: <span dir="ltr">{d.highlights.averageOeePct != null ? `${d.highlights.averageOeePct}%` : "—"}</span></div>
                </div>
                <div className="tx3 text-[10px]" dir="ltr">model: {d.modelVersion}</div>
              </div>
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

      case "assets": {
        if (assets.state.kind === "loading") return <Loading fa={fa} />;
        if (assets.state.kind === "error") return <ErrorBox {...pick(assets.state)} onRetry={assets.reload} fa={fa} />;
        if (assets.state.kind !== "ready") return <Empty fa={fa} />;
        return (
          <DataTable
            fa={fa}
            emptyText={tr("هنوز تجهیزی ثبت نشده است", "No assets registered yet")}
            columns={[
              { key: "AssetTag", header: tr("برچسب", "Tag"), mono: true },
              { key: "NameFa", header: tr("نام تجهیز", "Asset name") },
              { key: "AssetState", header: tr("وضعیت", "State") },
              { key: "CriticalityRank", header: tr("رتبهٔ بحرانی‌بودن", "Criticality"), align: "center" },
            ]}
            rows={assets.state.data.assets}
          />
        );
      }

      case "families": {
        if (families.state.kind === "loading") return <Loading fa={fa} />;
        if (families.state.kind === "error") return <ErrorBox {...pick(families.state)} onRetry={families.reload} fa={fa} />;
        if (families.state.kind !== "ready") return <Empty fa={fa} />;
        return (
          <DataTable
            fa={fa}
            emptyText={tr("خانواده‌ای تعریف نشده است", "No families defined")}
            columns={[
              { key: "FamilyCode", header: tr("کد خانواده", "Family code"), mono: true },
              { key: "NameFa", header: tr("نام", "Name") },
              { key: "Status", header: tr("وضعیت", "Status") },
              { key: "CriticalityRank", header: tr("رتبه", "Rank"), align: "center" },
            ]}
            rows={families.state.data.families}
          />
        );
      }

      case "work-orders": {
        if (workOrders.state.kind === "loading") return <Loading fa={fa} />;
        if (workOrders.state.kind === "error") return <ErrorBox {...pick(workOrders.state)} onRetry={workOrders.reload} fa={fa} />;
        if (workOrders.state.kind !== "ready") return <Empty fa={fa} />;
        return (
          <DataTable
            fa={fa}
            emptyText={tr("دستورکاری ثبت نشده است", "No work orders")}
            columns={[
              { key: "WorkOrderNo", header: tr("شماره", "No."), mono: true },
              { key: "TitleFa", header: tr("شرح", "Title") },
              { key: "WorkOrderType", header: tr("نوع", "Type") },
              { key: "Status", header: tr("وضعیت", "Status") },
              { key: "Priority", header: tr("اولویت", "Priority"), align: "center" },
            ]}
            rows={workOrders.state.data.workOrders}
          />
        );
      }

      case "spares": {
        if (spares.state.kind === "loading") return <Loading fa={fa} />;
        if (spares.state.kind === "error") return <ErrorBox {...pick(spares.state)} onRetry={spares.reload} fa={fa} />;
        if (spares.state.kind !== "ready") return <Empty fa={fa} />;
        const parts = spares.state.data.parts;
        const belowReorder = parts.filter((part) => (part.QtyOnHand ?? 0) <= (part.ReorderPoint ?? part.MinStock ?? 0));
        return (
          <div className="space-y-3">
            {belowReorder.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="tx1 text-xs font-medium">
                  {tr(`${belowReorder.length} قطعه زیر نقطهٔ سفارش است`, `${belowReorder.length} parts below reorder point`)}
                </div>
              </div>
            )}
            <DataTable
              fa={fa}
              emptyText={tr("قطعه‌ای ثبت نشده است", "No spare parts")}
              columns={[
                { key: "PartNumber", header: tr("کد قطعه", "Part no."), mono: true },
                { key: "NameFa", header: tr("نام", "Name") },
                { key: "Category", header: tr("دسته", "Category") },
                { key: "QtyOnHand", header: tr("موجودی", "On hand"), align: "right" },
                { key: "ReorderPoint", header: tr("نقطهٔ سفارش", "Reorder"), align: "right" },
              ]}
              rows={parts}
            />
          </div>
        );
      }

      case "condition": {
        if (alerts.state.kind === "loading") return <Loading fa={fa} />;
        if (alerts.state.kind === "error") return <ErrorBox {...pick(alerts.state)} onRetry={alerts.reload} fa={fa} />;
        if (alerts.state.kind !== "ready") return <Empty fa={fa} />;
        return (
          <DataTable
            fa={fa}
            emptyText={tr("هشداری ثبت نشده است", "No alerts")}
            columns={[
              { key: "AlertCode", header: tr("کد هشدار", "Alert code"), mono: true },
              { key: "TitleFa", header: tr("عنوان", "Title") },
              { key: "Severity", header: tr("شدت", "Severity") },
              { key: "Status", header: tr("وضعیت", "Status") },
            ]}
            rows={alerts.state.data.alerts}
          />
        );
      }

      case "pm":
      case "analytics":
      case "ai": {
        if (current.id === "ai") {
          if (recommendations.state.kind === "loading") return <Loading fa={fa} />;
          if (recommendations.state.kind === "error") return <ErrorBox {...pick(recommendations.state)} onRetry={recommendations.reload} fa={fa} />;
          if (recommendations.state.kind === "ready") {
            return (
              <DataTable
                fa={fa}
                emptyText={tr("پیشنهادی ثبت نشده است", "No recommendations yet")}
                columns={[
                  { key: "Engine", header: tr("موتور", "Engine"), mono: true },
                  { key: "TitleFa", header: tr("پیشنهاد", "Suggestion") },
                  { key: "Confidence", header: tr("اطمینان", "Confidence"), align: "right" },
                  { key: "Status", header: tr("وضعیت", "Status") },
                ]}
                rows={recommendations.state.data.recommendations}
              />
            );
          }
        }
        return <Empty fa={fa} />;
      }

      default:
        return <Empty fa={fa} />;
    }
  };

  return (
    <div dir={fa ? "rtl" : "ltr"} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
      <header className="glass-dark rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-lg">🔧</span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="tx1 font-semibold text-sm">
                {tr("سامانهٔ نگهداری و تعمیرات (CMMS)", "Computerized Maintenance Management System (CMMS)")}
              </h2>
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                {tr("متصل به API", "Live API")}
              </span>
            </div>
            <p className="tx3 text-xs mt-0.5">
              {tr(
                "بخش سوم سازمان · ISO 55000/14224/60812/60300 · ۱۰۵ مسیر REST زیر /api/cmms",
                "Organizational Pillar #3 · ISO 55000/14224/60812/60300 · 105 REST routes under /api/cmms",
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            className="rounded-lg border b-line-soft bg-black/25 px-2.5 py-1.5 text-xs tx1"
            dir="ltr"
          >
            {sites.length === 0 && <option value={DEFAULT_SITE_ID}>{DEFAULT_SITE_ID}</option>}
            {sites.map((site) => (
              <option key={site.SiteId} value={site.SiteId}>{site.SiteId} — {site.NameFa}</option>
            ))}
          </select>

          <select
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="rounded-lg border b-line-soft bg-black/25 px-2.5 py-1.5 text-xs tx1"
            dir="ltr"
          >
            {CMMS_DEMO_USERS.map((user) => (
              <option key={user.id} value={user.id}>{fa ? user.fa : user.en}</option>
            ))}
          </select>

          {onBackHome && (
            <button type="button" onClick={onBackHome} className="rounded-lg border b-line-soft px-3 py-1.5 text-xs tx2 hover:tx1">
              {tr("بازگشت به نمای اصلی", "Back to Hub")}
            </button>
          )}
        </div>
      </header>

      <nav className="flex flex-wrap gap-1.5">
        {CMMS_SUBMODULES.map((item) => {
          const active = item.id === current.id;
          const allowed = canCmmsAccess(userId, item.viewPermission, siteId);
          return (
            <button
              key={item.id}
              type="button"
              disabled={!allowed}
              onClick={() => onSelectSub(item.id)}
              title={allowed ? undefined : tr("مجوز این بخش را ندارید", "No permission for this section")}
              className={`rounded-lg border b-line-soft px-3 py-1.5 text-xs transition flex items-center gap-1.5 ${
                !allowed ? "opacity-40 cursor-not-allowed tx3"
                  : active ? "toggle-on tx1 font-medium"
                  : "tx2 hover:tx1"
              }`}
            >
              <span>{item.icon}</span>
              <span>{fa ? item.fa : item.en}</span>
            </button>
          );
        })}
      </nav>

      {visibleSubs.length === 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5">
          <div className="tx1 text-xs font-medium">
            {tr("این کاربر به هیچ بخشی از CMMS در این سایت دسترسی ندارد", "This user has no CMMS access on this site")}
          </div>
        </div>
      )}

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
            {siteId} · {current.viewPermission}
          </span>
        </div>

        {renderBody()}
      </section>
    </div>
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

/**
 * جدول عمومی. `key` عمداً رشتهٔ آزاد است چون ستون‌ها از نام ستون‌های
 * پایگاه‌داده می‌آیند و هر زیرماژول شکل ردیف خودش را دارد.
 */
function DataTable<T extends Record<string, any>>({
  fa, columns, rows, emptyText,
}: {
  fa: boolean;
  columns: Array<{ key: string; header: string; mono?: boolean; align?: "center" | "right" }>;
  rows: T[];
  emptyText: string;
}) {
  if (rows.length === 0) return <Empty fa={fa} text={emptyText} />;
  return (
    <div className="overflow-x-auto rounded-xl border b-line-soft">
      <table className="w-full text-xs">
        <thead className="bg-black/25">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-3 py-2 tx3 font-medium whitespace-nowrap ${
                  column.align === "center" ? "text-center" : column.align === "right" ? "text-right" : "text-start"
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.Id ?? index)} className="border-t b-line-soft">
              {columns.map((column) => {
                const value = row[column.key];
                return (
                  <td
                    key={column.key}
                    className={`px-3 py-1.5 tx2 whitespace-nowrap ${column.mono ? "font-mono" : ""} ${
                      column.align === "center" ? "text-center" : column.align === "right" ? "text-right" : "text-start"
                    }`}
                    dir="ltr"
                  >
                    {value == null ? "—" : String(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
