/**
 * ورک‌اسپیس پایش میدانی، اینترنت اشیاء صنعتی و تله‌متری حفاری (IIoT & DAS)
 * ═══════════════════════════════════════════════════════════════════════
 * پوستهٔ اولیه به داشبورد زنده تبدیل شده است؛ چهار زیرماژول و قرارداد عمومی
 * (`IiotSubModuleId`، `IIOT_SUBMODULES` و پراپ‌های `{lang, activeSub,
 * onSelectSub, onBackHome}`) دست‌نخورده مانده‌اند تا ناوبری بخش پنجم سازمان
 * و `App.tsx` بی‌تغییر کار کنند.
 *
 * چهار تصمیم:
 *  ۱) **همهٔ داده از سرور.** `GET /dashboard`، `GET /telemetry?channelId=` و
 *     `GET /telemetry/latest` تنها منابع صفحه‌اند؛ هیچ مقداری سمت مرورگر
 *     ساخته یا هموار نمی‌شود.
 *  ۲) **تازه‌سازی چندثانیه‌ای با توقف/تازه‌سازی دستی.** تایمر با `live`
 *     می‌ایستد ولی دادهٔ روی صفحه نمی‌پرد؛ دکمهٔ «توقف»، صفحه را سیاه نمی‌کند.
 *  ۳) **نمودار با SVG دستی.** نه کتابخانهٔ نموداری اضافه شده و نه محاسبهٔ
 *     ریاضی دامنه تکرار شده؛ هندسه از `iiotDashboard.ts` می‌آید.
 *  ۴) **اکشن‌ها بر پایهٔ مجوز غیرفعال می‌شوند** و دلیل غیرفعالی نوشته می‌شود:
 *     تأیید/رفع/ارسال و تأیید NPT با سرپرست حفاری، پذیرش نمونه و پیکربندی
 *     قاعده با مهندس IIoT، همگام‌سازی بافر و کالیبراسیون با تکنسین میدان.
 *
 * حالت خالی: اگر دکلی ثبت نشده باشد، دکمهٔ «آماده‌سازی دکل نمونه» همان دکل
 * آزمون‌ها را از راه REST می‌سازد (دکل + گیت‌وی لبه + جریان + ۶ کانال + ۴ قاعده
 * + ۱۰ دقیقه نمونهٔ تله‌متری) — نه با اسکریپت seed.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "../data/framework";
import { IiotAlertsView, IiotConditionView, IiotDevicesView } from "./IiotOpsViews";
import {
  Btn, Chip, Meter, Muted, Note, SectionCard, StatCard, StatusChip, ToneLegend, errorInfo, permissionTitle, usePolled,
} from "./IiotUi";
import {
  DEFAULT_RIG_ID,
  IIOT_DEMO_USERS,
  canIiotAccess,
  iiotCreateChannel,
  iiotCreateGateway,
  iiotCreateRig,
  iiotCreateStream,
  iiotCreateThresholdRule,
  iiotGetDashboard,
  iiotGetTelemetry,
  iiotIngestTelemetry,
  iiotListRigs,
  type IiotDashboard,
  type IiotDashboardGauge,
} from "../services/iiotApi";
import {
  actionGates,
  ageSecondsOf,
  buildChartGeometry,
  buildDemoRigPlan,
  buildDemoTelemetrySamples,
  buildSpikeSamples,
  decimalsForSignal,
  displayRangeFor,
  formatAgeFa,
  formatMeasure,
  gaugeFillPct,
  resolveDemoRigPlan,
  summarizeGaugeStatuses,
  toneForStatus,
  toneWeight,
  IIOT_TONE_LABEL,
  type IiotAction,
  type IiotChartGeometry,
} from "../services/iiotDashboard";
import ModuleWorkspaceShell, { moduleCardCls, moduleChipCls, moduleSelectCls } from "./ModuleWorkspaceShell";

export type IiotSubModuleId =
  | "dashboard"
  | "drilling-das"
  | "iot-devices"
  | "condition-monitoring"
  | "sensor-alerts";

/** دسته‌های سایدبار داخلی — همان الگوی CMMS/MES: خط جداکننده + عنوان دسته. */
const IIOT_NAV_GROUPS: Record<string, { fa: string; en: string }> = {
  dashboard: { fa: "نمای یکپارچه و عملیات زنده", en: "Unified View & Live Operations" },
  "drilling-das": { fa: "نمای یکپارچه و عملیات زنده", en: "Unified View & Live Operations" },
  "iot-devices": { fa: "تجهیزات و پایش وضعیت", en: "Devices & Condition Monitoring" },
  "condition-monitoring": { fa: "تجهیزات و پایش وضعیت", en: "Devices & Condition Monitoring" },
  "sensor-alerts": { fa: "هشدار و واکنش", en: "Alerts & Response" },
};

export const IIOT_SUBMODULES: Array<{
  id: IiotSubModuleId;
  icon: string;
  fa: string;
  en: string;
  descFa: string;
  descEn: string;
  plannedEntities: string[];
  /** مجوز دیدن این بخش؛ کاربر بی‌مجوز، تب غیرفعال می‌گیرد. */
  viewPermission: string;
}> = [
  {
    id: "dashboard",
    icon: "📊",
    fa: "داشبورد IIoT",
    en: "IIoT Dashboard",
    descFa: "نمای یکپارچهٔ دکل، کانال‌های DAS، گیت‌وی‌ها، هشدارها، بافر لبه، NPT و یکپارچگی — کلیک روی هر کارت، زیرماژول مربوطه را باز می‌کند.",
    descEn: "Unified view of the rig, DAS channels, gateways, alerts, edge buffer, NPT and integration — click any card to open its submodule.",
    plannedEntities: ["IiotDashboard", "IiotTelemetryAlert", "IotEdgeGateway"],
    viewPermission: "iiot.dashboard.view",
  },
  {
    id: "drilling-das",
    icon: "📡",
    fa: "پایش زنده حفاری و عملیات (Drilling DAS)",
    en: "Live Drilling & Operations Monitoring (Drilling DAS)",
    descFa: "دریافت و نمایش بلادرنگ داده‌های حفاری و عملیات میدانی (WOB، RPM، گشتاور، فشار پمپ، نرخ نفوذ ROP و عمق چاه).",
    descEn: "Real-time acquisition and visualization of field drilling & operational telemetry (WOB, RPM, torque, standpipe pressure, ROP, depth).",
    plannedEntities: ["IiotDrillingRigStream", "IiotDasChannel", "IiotTelemetrySample"],
    viewPermission: "iiot.dashboard.view",
  },
  {
    id: "iot-devices",
    icon: "🛰️",
    fa: "مدیریت سنسورها و تجهیزات IoT",
    en: "IoT Sensors & Edge Device Management",
    descFa: "شناسنامهٔ سنسورهای صنعتی، گیت‌وی‌های لبه (Edge Gateways)، کالیبراسیون، پروتکل‌های ارتباطی (OPC-UA / MQTT / Modbus) و وضعیت اتصال.",
    descEn: "Registry of industrial sensors, edge gateways, calibration schedules, protocols (OPC-UA / MQTT / Modbus), and heartbeat status.",
    plannedEntities: ["IiotEdgeGateway", "IiotSensorNode", "IiotGatewayBuffer"],
    viewPermission: "iiot.gateway.view",
  },
  {
    id: "condition-monitoring",
    icon: "🌡️",
    fa: "پایش آنلاین شرایط محیطی و تجهیزات",
    en: "Online Environmental & Equipment Condition Monitoring",
    descFa: "پایش پیوستهٔ ارتعاشات، دما، رطوبت، فشار، جریان مصرفی موتورها و گازهای محیطی برای نگهداری مبتنی بر وضعیت (CBM).",
    descEn: "Continuous vibration, temperature, humidity, pressure, motor current, and gas telemetry for condition-based maintenance (CBM).",
    plannedEntities: ["IiotConditionSnapshot", "IiotSensorNode", "IiotThresholdRule"],
    viewPermission: "iiot.condition.view",
  },
  {
    id: "sensor-alerts",
    icon: "🚨",
    fa: "سیستم هشدار بلادرنگ سنسورها",
    en: "Real-Time Sensor Threshold & Anomaly Alerts",
    descFa: "تعریف آستانه‌های بحرانی (High/High-High)، تشخیص ناهنجاری سیگنال، ثبت رخدادهای تله‌متری و ارسال خودکار دستورکار اضطراری به نت (CMMS) و تولید (MES).",
    descEn: "Threshold rules (High/High-High), signal anomaly detection, telemetry incident logs, and automated triggers to CMMS and MES.",
    plannedEntities: ["IiotThresholdRule", "IiotTelemetryAlert", "IiotRigDowntime"],
    viewPermission: "iiot.alert.view",
  },
];

interface Props {
  lang: Lang;
  activeSub: IiotSubModuleId;
  onSelectSub: (sub: IiotSubModuleId) => void;
  onBackHome?: () => void;
}

const INTERVAL_OPTIONS = [3000, 5000, 10000];

/** رنگ تأکیدی IIoT & DAS (بنفش هم‌خوان با هدر قبلی). */
const IIOT_ACCENT = "#c084fc";

export default function IiotWorkspaceShell({ lang, activeSub, onSelectSub, onBackHome }: Props) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);

  const [userId, setUserId] = useState(IIOT_DEMO_USERS[0].id);
  const [rigId, setRigId] = useState(DEFAULT_RIG_ID);
  const [live, setLive] = useState(true);
  const [intervalMs, setIntervalMs] = useState(5000);
  const [nonce, setNonce] = useState(0);
  const [setup, setSetup] = useState<{ kind: "idle" | "running" | "done" | "error"; step?: string; message?: string }>({ kind: "idle" });

  const bump = useCallback(() => setNonce((n) => n + 1), []);
  const gates = useMemo(() => actionGates(userId, rigId), [userId, rigId]);
  const current = IIOT_SUBMODULES.find((s) => s.id === activeSub) ?? IIOT_SUBMODULES[0];
  const canSeeCurrent = canIiotAccess(userId, current.viewPermission, rigId);

  /* فهرست دکل‌ها: سرور خودش دامنه را محدود می‌کند (`plantIds`). */
  const rigs = usePolled(() => iiotListRigs({ userId }), [userId, nonce], { live: false, intervalMs });
  const rigRows = rigs.state.kind === "ready" ? rigs.state.data.rigs : [];
  const rigMissing = rigs.state.kind === "ready" && !rigRows.some((row) => row.RigId === rigId);

  /* داشبورد زندهٔ دکل — منبع همهٔ گیج‌ها و خلاصه‌ها. */
  const dashboard = usePolled<IiotDashboard>(
    () => iiotGetDashboard(rigId, { userId }),
    [rigId, userId, nonce],
    { live: live && !rigMissing, intervalMs },
  );
  const dash = dashboard.state.kind === "ready" ? dashboard.state.data : null;

  const refs = useMemo(() => ({
    cmmsSiteRef: dash?.rig.CmmsSiteRef ?? null,
    mesWorkCenterRef: dash?.rig.MesWorkCenterRef ?? null,
    pmisProjectRef: dash?.rig.PmisProjectRef ?? null,
  }), [dash]);

  /* ── آماده‌سازی دکل نمونه از راه REST (بی هیچ اسکریپت seed) ── */
  const prepareDemoRig = useCallback(async () => {
    setSetup({ kind: "running", step: tr("دکل", "rig") });
    try {
      const plan = buildDemoRigPlan(rigId);
      await iiotCreateRig(plan.rig, { userId });

      const gateway = await iiotCreateGateway(rigId, plan.gateway.body, { userId });
      setSetup({ kind: "running", step: tr("جریان تله‌متری", "stream") });
      const empty = resolveDemoRigPlan(plan, { gatewayId: gateway.Id, streamId: null, channelIdByCode: {} });
      const stream = await iiotCreateStream(rigId, empty.stream, { userId });

      const channelIdByCode: Record<string, string> = {};
      for (const channel of empty.channels) {
        setSetup({ kind: "running", step: `${tr("کانال", "channel")} ${channel.code}` });
        const row = await iiotCreateChannel(rigId, channel.body, { userId });
        channelIdByCode[channel.code] = row.Id;
      }

      const wired = resolveDemoRigPlan(plan, { gatewayId: gateway.Id, streamId: stream.Id, channelIdByCode });
      for (const rule of wired.rules) {
        setSetup({ kind: "running", step: `${tr("قاعده", "rule")} ${rule.code}` });
        await iiotCreateThresholdRule(rigId, rule.body, { userId });
      }

      setSetup({ kind: "running", step: tr("نمونهٔ تله‌متری", "telemetry samples") });
      const samples = buildDemoTelemetrySamples({
        channels: plan.channels.map((c) => ({ code: c.code, signalType: c.signalType })),
        nowIso: new Date().toISOString(),
        minutes: 10,
        stepSeconds: 10,
      });
      const ingest = await iiotIngestTelemetry(rigId, samples, { userId });

      setSetup({
        kind: "done",
        message: tr(
          `دکل نمونه ساخته شد: ۶ کانال، ۴ قاعده و ${ingest.accepted} نمونهٔ تله‌متری.`,
          `Demo rig created: 6 channels, 4 rules and ${ingest.accepted} telemetry samples.`,
        ),
      });
      bump();
      dashboard.refresh();
    } catch (error) {
      const info = errorInfo(error);
      setSetup({ kind: "error", message: `${info.message}${info.code ? ` (${info.code})` : ""}` });
    }
  }, [rigId, userId, fa, bump, dashboard, tr]);

  const renderBody = () => {
    if (!canSeeCurrent) {
      return (
        <div className={`${moduleCardCls} p-4 space-y-1`}>
          <div className="tx1 text-sm font-medium">{tr("مجوز دسترسی به این بخش را ندارید", "You do not have access to this section")}</div>
          <p className="tx3 text-[11px]" dir="ltr">{tr("مجوز لازم: ", "Required permission: ")}{current.viewPermission}</p>
          <p className="tx3 text-[11px]">
            {tr(
              "کاربر دیگری را از نوار بالا انتخاب کنید؛ ماتریس مجوز نقش‌های IIoT در accessControl.ts تعریف شده است.",
              "Pick another user from the top bar; the IIoT role matrix lives in accessControl.ts.",
            )}
          </p>
        </div>
      );
    }

    if (rigMissing) {
      const steps = ["IotDrillingRig", "IotEdgeGateway", "IotDrillingRigStream", "IotDasChannel ×6", "IotThresholdRule ×4", tr("نمونهٔ تله‌متری ۱۰ دقیقه", "10 minutes of telemetry")];
      return (
        <div className="space-y-3">
          <Note
            kind="info"
            text={tr(
              `دکلی با شناسهٔ ${rigId} ثبت نشده است؛ پس داشبورد زنده داده‌ای برای نمایش ندارد (خطای ۴۰۴).`,
              `No rig with id ${rigId} exists, so the live dashboard has nothing to show (HTTP 404).`,
            )}
          />
          <div className={`${moduleCardCls} p-4 space-y-3`}>
            <div className="tx1 text-sm font-medium">{tr("آماده‌سازی دکل نمونه از راه REST", "Prepare the demo rig via REST")}</div>
            <p className="tx3 text-[11px]">
              {tr(
                "این دکمه، دکل نمونهٔ آزمون‌ها را با همان مسیرهای عمومی API می‌سازد — بدون اسکریپت seed و بدون دست‌زدن به پایگاه‌داده.",
                "This button builds the test fixtures' demo rig through the public API — no seed script, no direct database access.",
              )}
            </p>
            <div className="flex flex-wrap gap-1.5" dir="ltr">
              {steps.map((step) => <Chip key={step} text={step} />)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Btn
                tone="primary"
                disabled={!gates.createRig || setup.kind === "running"}
                title={permissionTitle(gates.createRig, "iiot.rig.edit", fa)}
                busy={setup.kind === "running"}
                onClick={() => void prepareDemoRig()}
              >
                {tr("آماده‌سازی دکل نمونه", "Prepare demo rig")}
              </Btn>
              {!gates.createRig && (
                <span className="tx3 text-[10px]">
                  {tr("این کار مجوز iiot.rig.edit دارد؛ کاربر مهندس IIoT را انتخاب کنید.", "This needs iiot.rig.edit — switch to the IIoT engineer user.")}
                </span>
              )}
            </div>
            {setup.kind === "running" && <Note kind="info" text={`${tr("در حال ساخت", "Building")}: ${setup.step ?? ""}`} />}
            {setup.kind === "done" && <Note kind="ok" text={setup.message ?? ""} />}
            {setup.kind === "error" && <Note kind="error" text={setup.message ?? ""} />}
          </div>
          {rigs.state.kind === "ready" && rigRows.length > 0 && (
            <SectionCard title={tr("دکل‌های موجود در دامنهٔ شما", "Rigs in your scope")} hint={tr("دکل دیگری را انتخاب کنید", "Select another rig")}>
              <div className="flex flex-wrap gap-1.5">
                {rigRows.map((row) => (
                  <Btn key={row.RigId} small onClick={() => { setRigId(row.RigId); bump(); }}>{row.RigId} — {row.NameFa}</Btn>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      );
    }

    if (dashboard.state.kind === "error") {
      const status = dashboard.state.status;
      return (
        <Note
          kind="error"
          text={`${dashboard.state.message}${dashboard.state.code ? ` (${dashboard.state.code})` : ""}${
            status === 403 ? tr(" — این کاربر در دامنهٔ این دکل نیست.", " — this user is outside the rig scope.") : ""}`}
        />
      );
    }

    if (activeSub === "dashboard") {
      return (
        <IiotOverviewDashboard
          fa={fa}
          dash={dash}
          loading={dashboard.state.kind === "loading" || dashboard.state.kind === "idle"}
          rigCount={rigRows.length}
          onNavigate={onSelectSub}
        />
      );
    }

    if (activeSub === "drilling-das") {
      return (
        <IiotLiveDashboard
          fa={fa}
          rigId={rigId}
          userId={userId}
          gates={gates}
          live={live}
          intervalMs={intervalMs}
          dash={dash}
          loading={dashboard.state.kind === "loading" || dashboard.state.kind === "idle"}
          updatedAt={dashboard.updatedAt}
          onRefresh={() => { bump(); dashboard.refresh(); }}
        />
      );
    }
    if (activeSub === "iot-devices") {
      return <IiotDevicesView lang={lang} rigId={rigId} userId={userId} gates={gates} live={live} intervalMs={intervalMs} onChanged={bump} refs={refs} />;
    }
    if (activeSub === "condition-monitoring") {
      return <IiotConditionView lang={lang} rigId={rigId} userId={userId} gates={gates} live={live} intervalMs={intervalMs} onChanged={bump} refs={refs} />;
    }
    return <IiotAlertsView lang={lang} rigId={rigId} userId={userId} gates={gates} live={live} intervalMs={intervalMs} onChanged={bump} refs={refs} />;
  };

  const canSeeAny = IIOT_SUBMODULES.some((item) => canIiotAccess(userId, item.viewPermission, rigId));

  return (
    <ModuleWorkspaceShell
      lang={lang}
      accent={IIOT_ACCENT}
      icon="📡"
      title={tr(
        "سامانهٔ پایش میدانی و اینترنت اشیاء صنعتی (IIoT & DAS)",
        "Field Telemetry, Data Acquisition & Industrial IoT (IIoT & DAS)",
      )}
      subtitle={tr(
        "سرگروه پنجم سازمان · پایش بلادرنگ سنسورها، عملیات حفاری (Drilling DAS) و تله‌متری تجهیزات",
        "Organizational Pillar #5 · Real-time sensor telemetry, Drilling DAS, and equipment condition monitoring",
      )}
      badges={
        <>
          <span className={`rounded-md border px-2 py-0.5 text-[10px] ${live ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}`}>
            {live ? tr(`زنده · هر ${Math.round(intervalMs / 1000)} ثانیه`, `Live · every ${Math.round(intervalMs / 1000)}s`) : tr("متوقف", "Paused")}
          </span>
          {dash && (
            <span className={moduleChipCls} dir="ltr">
              ts: {dash.tsDriver ?? "—"} · engine: {dash.modelVersion}
            </span>
          )}
        </>
      }
      actions={
        <>
          <select
            value={rigId}
            onChange={(event) => { setRigId(event.target.value); bump(); }}
            className={moduleSelectCls}
            dir="ltr"
          >
            {!rigRows.some((row) => row.RigId === rigId) && <option value={rigId}>{rigId}</option>}
            {rigRows.map((row) => <option key={row.RigId} value={row.RigId}>{row.RigId} — {row.NameFa}</option>)}
          </select>

          <select value={userId} onChange={(event) => setUserId(event.target.value)} className={moduleSelectCls}>
            {IIOT_DEMO_USERS.map((user) => <option key={user.id} value={user.id}>{fa ? user.fa : user.en}</option>)}
          </select>

          <select
            value={String(intervalMs)}
            onChange={(event) => setIntervalMs(Number(event.target.value))}
            className={moduleSelectCls}
            dir="ltr"
          >
            {INTERVAL_OPTIONS.map((option) => <option key={option} value={String(option)}>{option / 1000}s</option>)}
          </select>

          <Btn onClick={() => setLive((value) => !value)} tone={live ? "warn" : "ok"}>
            {live ? tr("توقف", "Pause") : tr("ادامه", "Resume")}
          </Btn>
          <Btn onClick={() => { bump(); if (dashboard.state.kind === "ready") dashboard.refresh(); }}>{tr("تازه‌سازی", "Refresh")}</Btn>
        </>
      }
      onBack={onBackHome}
      navTitle={tr("پایش میدانی و اینترنت اشیاء", "Field Monitoring & Industrial IoT")}
      navItems={IIOT_SUBMODULES.map((item) => {
        const allowed = canIiotAccess(userId, item.viewPermission, rigId);
        return {
          id: item.id,
          label: fa ? item.fa : item.en,
          icon: item.icon,
          group: fa ? IIOT_NAV_GROUPS[item.id]?.fa : IIOT_NAV_GROUPS[item.id]?.en,
          disabled: !allowed,
          disabledHint: tr(`مجوز لازم: ${item.viewPermission}`, `Required permission: ${item.viewPermission}`),
        };
      })}
      activeId={current.id}
      onSelect={onSelectSub}
      panelTitle={fa ? current.fa : current.en}
      panelIcon={current.icon}
      panelDesc={fa ? current.descFa : current.descEn}
      panelMeta={
        <>
          {dash && <Chip text={`${tr("دکل", "rig")}: ${dash.rig.RigNo}`} dir="ltr" />}
          <span className={moduleChipCls} dir="ltr">{rigId} · {current.viewPermission}</span>
        </>
      }
      notice={
        !canSeeAny ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5">
            <div className="tx1 text-xs font-medium">
              {tr("این کاربر به هیچ بخشی از IIoT & DAS در این دکل دسترسی ندارد", "This user has no IIoT & DAS access on this rig")}
            </div>
          </div>
        ) : undefined
      }
    >
      {renderBody()}
    </ModuleWorkspaceShell>
  );
}

/* ═══════════════════════ داشبورد یکپارچهٔ IIoT ═══════════════════════
 * نمای اول ماژول: خلاصهٔ همهٔ زیرسیستم‌ها از همان پاسخ `GET /dashboard`
 * که پوسته از قبل می‌گیرد؛ دادهٔ تازه‌ای ساخته نمی‌شود. هر کارت/ردیف
 * کلیک‌پذیر است و زیرماژول تخصصی خودش را باز می‌کند. */
function IiotOverviewDashboard({
  fa, dash, loading, rigCount, onNavigate,
}: {
  fa: boolean;
  dash: IiotDashboard | null;
  loading: boolean;
  rigCount: number;
  onNavigate: (sub: IiotSubModuleId) => void;
}) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const gauges = dash?.gauges ?? [];
  const counts = summarizeGaugeStatuses(gauges);
  const onlineGateways = (dash?.gateways ?? []).filter((g) => (g.connectionState ?? "").toLowerCase().includes("online") || (g.connectionState ?? "").toLowerCase().includes("connected")).length;
  const alertEntries = Object.entries(dash?.alertCounts ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const alertMax = Math.max(1, ...alertEntries.map(([, v]) => v));
  const statusTotal = Math.max(1, counts.ok + counts.warn + counts.danger + counts.idle);

  const navCard = (sub: IiotSubModuleId, label: string, value: ReactNode, hint?: string, tone?: "ok" | "warn" | "danger" | "idle") => (
    <button key={sub + label} type="button" onClick={() => onNavigate(sub)} className="text-start transition hover:-translate-y-px" aria-label={label}>
      <StatCard label={label} value={value} hint={hint} tone={tone} />
    </button>
  );

  if (!dash) {
    return <Muted text={loading ? tr("در حال دریافت داشبورد…", "Loading dashboard…") : tr("داده‌ای برای داشبورد نیست.", "No dashboard data.")} />;
  }

  return (
    <div className="space-y-3">
      {/* کارت‌های ناوبری/شمارشی */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {navCard("drilling-das", tr("کانال‌های DAS", "DAS channels"), gauges.length, tr(`${counts.danger} بحرانی · ${counts.warn} هشدار`, `${counts.danger} critical · ${counts.warn} warning`), counts.danger ? "danger" : counts.warn ? "warn" : "ok")}
        {navCard("sensor-alerts", tr("هشدارهای فعال", "Active alerts"), dash.alertCounts.active ?? 0, tr(`${dash.alertCounts.critical ?? 0} بحرانی`, `${dash.alertCounts.critical ?? 0} critical`), (dash.alertCounts.active ?? 0) ? "danger" : "idle")}
        {navCard("iot-devices", tr("گیت‌وی‌های لبه", "Edge gateways"), dash.gateways.length, tr(`${onlineGateways} برخط · ${rigCount} دکل در دامنه`, `${onlineGateways} online · ${rigCount} rigs in scope`))}
        {navCard("iot-devices", tr("بافر Store-&-Forward", "Store-&-forward buffer"), dash.storeAndForward.pendingBatches, tr(
          dash.storeAndForward.connectivityOnline ? "اتصال برقرار" : "اتصال قطع",
          dash.storeAndForward.connectivityOnline ? "Connectivity online" : "Connectivity offline",
        ), dash.storeAndForward.deadLetterBatches ? "danger" : dash.storeAndForward.pendingBatches ? "warn" : "ok")}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* توزیع وضعیت کانال‌ها: نوار انباشته */}
        <SectionCard title={tr("توزیع وضعیت کانال‌ها", "Channel status mix")} hint={tr("سبز/زرد/قرمز همان قرارداد تُن داشبورد زنده است", "Green/amber/red follow the live dashboard tone contract")}>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/30" dir="ltr">
            <div className="bg-emerald-400 h-full" style={{ width: `${(counts.ok / statusTotal) * 100}%` }} />
            <div className="bg-amber-400 h-full" style={{ width: `${(counts.warn / statusTotal) * 100}%` }} />
            <div className="bg-rose-500 h-full" style={{ width: `${(counts.danger / statusTotal) * 100}%` }} />
            <div className="bg-slate-500 h-full" style={{ width: `${(counts.idle / statusTotal) * 100}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[10.5px] tx2">
            <span>🟢 {tr("سالم", "Normal")}: <b className="tx1" dir="ltr">{counts.ok}</b></span>
            <span>🟡 {tr("هشدار", "Warning")}: <b className="tx1" dir="ltr">{counts.warn}</b></span>
            <span>🔴 {tr("بحرانی", "Critical")}: <b className="tx1" dir="ltr">{counts.danger}</b></span>
            <span>⚪ {tr("بی‌داده/کهنه", "Idle/stale")}: <b className="tx1" dir="ltr">{counts.idle}</b></span>
          </div>
          {/* کانال‌ها در یک نگاه */}
          <div className="space-y-1.5 pt-1">
            {gauges.length === 0 && <Muted text={tr("کانال فعالی برای این دکل نیست.", "No active channel for this rig.")} />}
            {[...gauges].sort((a, b) => toneWeight(toneForStatus(b.status)) - toneWeight(toneForStatus(a.status))).slice(0, 6).map((g) => {
              const range = displayRangeFor(g.signalType, g.displayMin, g.displayMax);
              const tone = toneForStatus(g.status);
              return (
                <button key={g.channelId} type="button" onClick={() => onNavigate("drilling-das")} className="flex w-full items-center gap-2 rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-start transition hover:bg-black/25">
                  <span className="min-w-0 flex-1">
                    <span className="tx1 block truncate text-[11px]">{g.nameFa}</span>
                    <span className="tx3 block text-[9.5px]" dir="ltr">{g.channelCode} · {g.unit}</span>
                  </span>
                  <span className="tx1 text-[12px] font-semibold" dir="ltr">{formatMeasure(g.value, { uom: g.unit, decimals: decimalsForSignal(g.signalType) })}</span>
                  <span className="hidden w-24 sm:block"><Meter pct={gaugeFillPct(g.value, range.min, range.max)} tone={tone} /></span>
                  <StatusChip status={g.status} fa={fa} />
                </button>
              );
            })}
          </div>
        </SectionCard>

        <div className="space-y-3">
          {/* هشدارها بر پایهٔ وضعیت/سطح */}
          <SectionCard title={tr("هشدارها در یک نگاه", "Alerts at a glance")} hint={tr("برای تأیید و رفع، به «هشدار سنسورها» بروید", "Acknowledge and resolve in Sensor Alerts")}>
            {alertEntries.length === 0
              ? <Muted text={tr("هشدار بازی ثبت نشده است.", "No open alerts recorded.")} />
              : (
                <div className="space-y-2">
                  {alertEntries.map(([key, value]) => (
                    <div key={key} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="tx2" dir="ltr">{key}</span>
                        <span className="tx3 tabular-nums" dir="ltr">{value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-black/30">
                        <div className="h-full rounded-full bg-rose-400" style={{ width: `${(value / alertMax) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            {dash.activeAlerts.slice(0, 3).map((alert) => (
              <button key={alert.Id} type="button" onClick={() => onNavigate("sensor-alerts")} className="block w-full rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-start transition hover:bg-black/25">
                <span className="tx1 text-[11px]">{alert.TitleFa ?? alert.AlertCode}</span>
                <span className="tx3 ms-2 text-[9.5px]" dir="ltr">{alert.AlertCode} · {alert.Level}</span>
              </button>
            ))}
          </SectionCard>

          {/* گیت‌وی‌ها، NPT و یکپارچگی */}
          <SectionCard title={tr("گیت‌وی، NPT و یکپارچگی", "Gateways, NPT & integration")}>
            <div className="space-y-1.5">
              {dash.gateways.length === 0 && <Muted text={tr("گیت‌وی ثبت نشده است.", "No gateway registered.")} />}
              {dash.gateways.map((g) => (
                <button key={g.id} type="button" onClick={() => onNavigate("iot-devices")} className="flex w-full items-center gap-2 rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-start transition hover:bg-black/25">
                  <span className="min-w-0 flex-1">
                    <span className="tx1 block truncate text-[11px]">{g.nameFa}</span>
                    <span className="tx3 block text-[9.5px]" dir="ltr">{g.code} · {g.connectionState ?? "—"}</span>
                  </span>
                  <span className="hidden w-24 sm:block"><Meter pct={g.fillPct} tone={g.fillPct > 85 ? "danger" : g.fillPct > 65 ? "warn" : "ok"} /></span>
                  <span className="tx3 text-[10px]" dir="ltr">{Math.round(g.fillPct)}%</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {dash.npt && <Chip dir="ltr" text={`NPT: ${dash.npt.nptMinutes} min · ${Math.round(dash.npt.nptPct)}% · open ${dash.npt.openCount}`} tone={dash.npt.openCount ? "warn" : "ok"} />}
              <Chip dir="ltr" text={`integration pending: ${dash.integration.pending}`} tone={dash.integration.pending ? "warn" : "ok"} />
              <Chip dir="ltr" text={`dispatched: ${dash.integration.dispatched}`} tone="ok" />
              <Chip dir="ltr" text={`failed: ${dash.integration.failed}`} tone={dash.integration.failed ? "danger" : "idle"} />
              <Chip dir="ltr" text={`dead-letter: ${dash.storeAndForward.deadLetterBatches}`} tone={dash.storeAndForward.deadLetterBatches ? "danger" : "idle"} />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ داشبورد زندهٔ Drilling DAS ═══════════════════════ */

interface LiveProps {
  fa: boolean;
  rigId: string;
  userId: string;
  gates: Record<IiotAction, boolean>;
  live: boolean;
  intervalMs: number;
  dash: IiotDashboard | null;
  loading: boolean;
  updatedAt: string | null;
  onRefresh: () => void;
}

function IiotLiveDashboard({ fa, rigId, userId, gates, live, intervalMs, dash, loading, updatedAt, onRefresh }: LiveProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [note, setNote] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [tick, setTick] = useState(0);
  const [windowSeconds, setWindowSeconds] = useState(1800);

  const gauges = dash?.gauges ?? [];
  const gauge = gauges.find((g) => g.channelId === selectedChannelId) ?? gauges[0] ?? null;
  const activeChannelId = gauge?.channelId ?? "";

  /* سری زمانی از سرور می‌آید؛ `filtered` مقدار همان نمونهٔ فیلترشده است. */
  const series = usePolled(
    () => (activeChannelId
      ? iiotGetTelemetry(rigId, activeChannelId, { from: new Date(Date.now() - windowSeconds * 1000).toISOString(), to: new Date().toISOString(), limit: 500 }, { userId })
      : Promise.resolve(null)),
    [rigId, userId, activeChannelId, windowSeconds, tick],
    { live, intervalMs },
  );

  const points = series.state.kind === "ready" ? series.state.data?.points ?? [] : [];
  const range = displayRangeFor(gauge?.signalType, gauge?.displayMin, gauge?.displayMax);
  const geometry = useMemo(
    () => buildChartGeometry(points, { width: 760, height: 220, displayMin: range.min, displayMax: range.max }),
    [points, range.min, range.max],
  );

  const counts = useMemo(() => summarizeGaugeStatuses(gauges), [gauges]);
  const criticalGauge = gauges.find((g) => toneForStatus(g.status) === "danger") ?? null;

  /* تزریق نمونهٔ آزمایشی: زنجیرهٔ کامل «نمونه → پایداری → هشدار → NPT» را
   * روی همان آستانه‌ای می‌آزماید که سرور اعمال می‌کند. */
  const injectSpike = async () => {
    if (!gauge) return;
    setBusy("spike");
    setNote(null);
    try {
      const thresholds = gauge.thresholds.filter((t) => typeof t.value === "number").map((t) => Number(t.value));
      const reference = gauge.value ?? (thresholds.length ? Math.min(...thresholds) : range.max * 0.8);
      const target = (thresholds.length ? Math.max(...thresholds) : range.max * 0.9) * 1.06;
      const samples = buildSpikeSamples({
        channelCode: gauge.channelCode,
        nowIso: new Date().toISOString(),
        from: Number(reference),
        to: Number(target),
        samples: 24,
        stepSeconds: 1,
      });
      const result = await iiotIngestTelemetry(rigId, samples, { userId });
      setNote({
        kind: result.alerts.created.length ? "ok" : "info",
        text: tr(
          `${result.accepted} نمونه پذیرفته شد. هشدار تازه: ${result.alerts.created.length} — توقف خودکار: ${result.alerts.created.filter((a) => a.Level === "critical").length}`,
          `${result.accepted} samples accepted. New alerts: ${result.alerts.created.length} — auto downtime: ${result.alerts.created.filter((a) => a.Level === "critical").length}`,
        ),
      });
      onRefresh();
    } catch (error) {
      const info = errorInfo(error);
      setNote({ kind: "error", text: `${info.message}${info.code ? ` (${info.code})` : ""}` });
    } finally {
      setBusy("");
    }
  };

  const sorted = [...gauges].sort((a, b) => toneWeight(toneForStatus(b.status)) - toneWeight(toneForStatus(a.status)));

  return (
    <div className="space-y-3">
      {note && <Note kind={note.kind} text={note.text} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToneLegend fa={fa} />
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] tx3">
          {updatedAt && <span dir="ltr">{tr("آخرین به‌روزرسانی: ", "last update: ")}{formatAgeFa(ageSecondsOf(updatedAt, new Date().toISOString()))}</span>}
          {dash && <span dir="ltr">asOf: {new Date(dash.asOf).toLocaleTimeString()}</span>}
          {loading && <span>{tr("در حال دریافت…", "loading…")}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCard label={tr("کانال سالم", "Normal channels")} value={counts.ok} tone="ok" hint={tr("گیج سبز", "green gauges")} />
        <StatCard label={tr("کانال هشدار", "Warning channels")} value={counts.warn} tone="warn" hint={tr("شامل دادهٔ کهنه", "includes stale data")} />
        <StatCard label={tr("کانال بحرانی", "Critical channels")} value={counts.danger} tone="danger" hint={criticalGauge ? criticalGauge.channelCode : tr("ندارد", "none")} />
        <StatCard
          label={tr("هشدار باز", "Open alerts")}
          value={dash ? dash.alertCounts.active ?? 0 : "—"}
          tone={dash && (dash.alertCounts.active ?? 0) > 0 ? "danger" : "idle"}
          hint={dash ? tr(`${dash.alertCounts.critical ?? 0} بحرانی`, `${dash.alertCounts.critical ?? 0} critical`) : undefined}
        />
      </div>

      {/* پنل گیج‌ها */}
      <SectionCard
        title={tr("گیج‌های زنده", "Live gauges")}
        hint={tr("هر کارت: نام کانال، مقدار آخر، واحد، سن داده و چراغ سه‌رنگ — کلیک، کانال نمودار را عوض می‌کند", "Each card: channel, last value, unit, data age and the three-colour lamp — click switches the chart channel")}
        actions={
          <Btn small tone="primary" onClick={onRefresh} busy={loading}>{tr("تازه‌سازی", "Refresh")}</Btn>
        }
      >
        {gauges.length === 0 && <Muted text={tr("کانال فعالی برای این دکل نیست.", "No active channel for this rig.")} />}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {sorted.map((item) => {
            const tone = toneForStatus(item.status);
            const toneFrame = tone === "danger" ? "border-rose-500/60 bg-rose-500/10"
              : tone === "warn" ? "border-amber-500/50 bg-amber-500/10"
                : "border-emerald-500/40 bg-emerald-500/10";
            const fill = gaugeFillPct(item.value, range.min, range.max);
            const age = ageSecondsOf(item.at, new Date().toISOString());
            const meterTone = tone === "danger" ? "danger" : tone === "warn" ? "warn" : tone === "idle" ? "idle" : "ok";
            return (
              <button
                key={item.channelId}
                type="button"
                onClick={() => { setSelectedChannelId(item.channelId); setTick((t) => t + 1); }}
                className={`text-start rounded-2xl border ${toneFrame} p-3 space-y-2 transition hover:ring-1 hover:ring-sky-500/40 ${
                  gauge?.channelId === item.channelId ? "ring-2 ring-sky-500/50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="tx1 text-xs font-medium">{item.nameFa}</div>
                    <div className="tx3 text-[10px]" dir="ltr">{item.channelCode} · {item.unit}{item.isCritical ? " · critical" : ""}</div>
                  </div>
                  {/* چراغ بزرگ: از فاصلهٔ چند متری سالن دکل هم خوانا است */}
                  <span className={`grid h-11 w-14 place-items-center rounded-xl border text-2xl ${toneFrame}`} title={fa ? IIOT_TONE_LABEL[tone].fa : IIOT_TONE_LABEL[tone].en}>
                    {IIOT_TONE_LABEL[tone].glyph}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="tx1 text-2xl font-semibold" dir="ltr">
                    {formatMeasure(item.value, { uom: item.unit, decimals: decimalsForSignal(item.signalType) })}
                  </div>
                  <StatusChip status={item.status} fa={fa} />
                </div>
                <Meter pct={fill} tone={meterTone} />
                <div className="flex flex-wrap items-center justify-between gap-1 tx3 text-[10px]" dir="ltr">
                  <span>{item.at ? `${formatAgeFa(age)}` : tr("بی‌داده", "no data")}</span>
                  <span>{item.thresholds.filter((x) => typeof x.value === "number").map((x) => `${x.level}:${x.value}`).join(" · ") || "—"}</span>
                </div>
                {item.stale && <div className="tx3 text-[10px]">{tr("دادهٔ کهنه — سنسور ساکت", "Stale data — silent sensor")}</div>}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* نمودار سری زمانی: خام در برابر فیلترشده */}
      <SectionCard
        title={tr("نمودار سری زمانی: خام در برابر فیلترشده", "Time series: raw vs filtered")}
        hint={gauge
          ? tr(
            `کانال ${gauge.channelCode} · پنجرهٔ ${Math.round(windowSeconds / 60)} دقیقه · ${geometry.sampleCount} نمونه از سرور`,
            `Channel ${gauge.channelCode} · ${Math.round(windowSeconds / 60)}-minute window · ${geometry.sampleCount} samples from the server`,
          )
          : tr("کانالی انتخاب نشده است", "No channel selected")}
        actions={
          <>
            <select
              value={windowSeconds}
              onChange={(event) => setWindowSeconds(Number(event.target.value))}
              className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
              dir="ltr"
            >
              {[600, 1800, 3600].map((option) => <option key={option} value={option}>{option / 60} min</option>)}
            </select>
            <Btn small onClick={() => setTick((t) => t + 1)} busy={series.state.kind === "loading"}>{tr("تازه‌سازی نمودار", "Refresh chart")}</Btn>
          </>
        }
      >
        {gauge && (
          <div className="flex flex-wrap items-center gap-1.5">
            {gauges.map((item) => (
              <button
                key={item.channelId}
                type="button"
                onClick={() => { setSelectedChannelId(item.channelId); setTick((t) => t + 1); }}
                className={`rounded-lg border b-line-soft px-2 py-1 text-[10px] ${gauge.channelId === item.channelId ? "toggle-on tx1" : "tx2 hover:tx1"}`}
                dir="ltr"
              >
                {item.channelCode}
              </button>
            ))}
          </div>
        )}
        {series.state.kind === "error" && <Note kind="error" text={series.state.message} />}
        <LiveChart geometry={geometry} fa={fa} gauge={gauge} />
        <div className="flex flex-wrap items-center gap-3 text-[10px] tx3" dir="ltr">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-sky-400" /> raw</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-emerald-400" /> filtered</span>
          {geometry.firstAt && <span>{new Date(geometry.firstAt).toLocaleTimeString()} → {geometry.lastAt ? new Date(geometry.lastAt).toLocaleTimeString() : "—"}</span>}
          {series.state.kind === "ready" && <span>{tr("موتور سری زمانی: ", "time-series driver: ")}{series.state.data?.tsDriver ?? "—"}</span>}
        </div>
      </SectionCard>

      {/* تزریق نمونه + خلاصهٔ عملیاتی */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SectionCard
          title={tr("تزریق نمونهٔ آزمایشی", "Inject a test sample")}
          hint={tr("سری صعودی روی آستانه می‌فرستد تا زنجیرهٔ «نمونه → پایداری → هشدار → توقف/NPT» را ببینید", "Sends a ramp across the threshold so you can watch sample → sustained → alert → downtime/NPT")}
        >
          {!gates.ingestTelemetry && (
            <Note kind="info" text={tr("این نقش اجازهٔ پذیرش نمونه ندارد؛ دکمه برای اطلاع نشان داده می‌شود.", "This role cannot ingest samples; the button is shown for reference.")} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Btn
              tone="danger"
              disabled={!gates.ingestTelemetry || !gauge}
              title={permissionTitle(gates.ingestTelemetry, "iiot.telemetry.ingest", fa)}
              busy={busy === "spike"}
              onClick={() => void injectSpike()}
            >
              {tr(`تزریق ناهنجاری روی ${gauge?.channelCode ?? "—"}`, `Inject anomaly on ${gauge?.channelCode ?? "—"}`)}
            </Btn>
            <span className="tx3 text-[10px]" dir="ltr">
              {gauge ? `${tr("آستانه‌ها", "thresholds")}: ${gauge.thresholds.map((t) => `${t.level}=${t.value}`).join(", ") || "—"}` : ""}
            </span>
          </div>
        </SectionCard>

        <SectionCard
          title={tr("دکل و پیوندهای بین‌بخشی", "Rig & cross-module links")}
          hint={tr("ارجاع‌ها «نرم» است: هیچ کلید خارجی بین بخش‌ها وجود ندارد", "References are soft: there is no foreign key across pillars")}
        >
          {dash && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <StatCard label={tr("وضعیت دکل", "Rig status")} value={dash.rig.Status} hint={dash.rig.RigType ?? ""} />
                <StatCard label={tr("عمق جاری (m)", "Current depth (m)")} value={dash.rig.CurrentDepthM ?? "—"} />
                <StatCard label={tr("بافر معلق", "Pending batches")} value={dash.storeAndForward.pendingBatches} tone={dash.storeAndForward.pendingBatches > 0 ? "warn" : "ok"} hint={tr(`نامهٔ مرده: ${dash.storeAndForward.deadLetterBatches}`, `dead-letter: ${dash.storeAndForward.deadLetterBatches}`)} />
                <StatCard label={tr("صف یکپارچگی", "Integration queue")} value={`${dash.integration.pending}/${dash.integration.dispatched}`} hint={tr("معلق/تحویل‌شده", "pending/dispatched")} />
              </div>
              <div className="flex flex-wrap gap-1.5" dir="ltr">
                <Chip text={`CMMS: ${dash.rig.CmmsSiteRef ?? "—"}`} />
                <Chip text={`MES: ${dash.rig.MesWorkCenterRef ?? "—"}`} />
                <Chip text={`PMIS: ${dash.rig.PmisProjectRef ?? "—"}`} />
                <Chip text={`${tr("چاه", "well")}: ${dash.rig.WellName ?? "—"}`} />
                <Chip text={`${tr("میدان", "field")}: ${dash.rig.FieldName ?? "—"}`} />
              </div>
              <div className="tx3 text-[10px]">
                {dash.npt
                  ? tr(`NPT: ${dash.npt.nptMinutes} دقیقه (${dash.npt.nptPct}%) · توقف باز: ${dash.npt.openCount}`, `NPT: ${dash.npt.nptMinutes} min (${dash.npt.nptPct}%) · open downtime: ${dash.npt.openCount}`)
                  : tr("جمع‌بندی NPT در دسترس نیست.", "NPT summary unavailable.")}
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

/* ═══════════════════════ نمودار SVG دست‌کشیده ═══════════════════════ */

function LiveChart({ geometry, fa, gauge }: { geometry: IiotChartGeometry; fa: boolean; gauge: IiotDashboardGauge | null }) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  if (geometry.empty) {
    return <Muted text={tr("در این پنجره نمونه‌ای برای نمودار نیست.", "No samples in this window.")} />;
  }
  const raw = geometry.lines.find((line) => line.key === "raw");
  const filtered = geometry.lines.find((line) => line.key === "filtered");
  const lastRaw = raw?.vertices[raw.vertices.length - 1] ?? null;
  const thresholds = (gauge?.thresholds ?? [])
    .filter((t) => typeof t.value === "number" && Number(t.value) >= geometry.min && Number(t.value) <= geometry.max)
    .map((t) => ({ level: t.level, value: Number(t.value) }));

  const yOf = (value: number) => {
    const innerH = geometry.height - geometry.padY * 2;
    return geometry.padY + innerH - ((value - geometry.min) / (geometry.max - geometry.min)) * innerH;
  };

  return (
    <div className="rounded-xl border b-line-soft bg-black/20 p-2">
      <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} className="w-full" style={{ maxHeight: 280 }} role="img" aria-label="telemetry chart">
        {/* شبکه و محور Y */}
        {geometry.yTicks.map((tick) => (
          <g key={`tick-${tick.y}`}>
            <line x1={geometry.padX} y1={tick.y} x2={geometry.width - geometry.padX} y2={tick.y} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
            <text x={geometry.padX - 6} y={tick.y + 3} textAnchor="end" fontSize="9" className="tx3" fill="currentColor">
              {Math.abs(tick.value) >= 1000 ? Math.round(tick.value) : tick.value}
            </text>
          </g>
        ))}

        {/* آستانه‌ها: همان مقادیری که سرور در گیج می‌دهد */}
        {thresholds.map((threshold) => (
          <g key={`th-${threshold.level}-${threshold.value}`}>
            <line
              x1={geometry.padX} y1={yOf(threshold.value)} x2={geometry.width - geometry.padX} y2={yOf(threshold.value)}
              stroke={threshold.level === "critical" ? "#f43f5e" : "#f59e0b"}
              strokeDasharray="6 4" strokeWidth="1.2"
            />
            <text x={geometry.width - geometry.padX - 4} y={yOf(threshold.value) - 4} textAnchor="end" fontSize="9" fill={threshold.level === "critical" ? "#f43f5e" : "#f59e0b"}>
              {threshold.level} {threshold.value}
            </text>
          </g>
        ))}

        {/* مساحت زیر خط خام */}
        {geometry.rawArea && <path d={geometry.rawArea} fill="#38bdf8" fillOpacity="0.12" />}

        {/* خط خام */}
        {raw && <polyline points={raw.points} fill="none" stroke="#38bdf8" strokeWidth="1.6" strokeLinejoin="round" />}

        {/* خط فیلترشده — همان مقدار فیلترشدهٔ سرور، نه هموارسازی مرورگر */}
        {filtered && <polyline points={filtered.points} fill="none" stroke="#34d399" strokeWidth="2.4" strokeLinejoin="round" />}

        {/* آخرین مقدار */}
        {lastRaw && (
          <>
            <circle cx={lastRaw.x} cy={lastRaw.y} r="3.4" fill="#38bdf8" />
            <text x={Math.min(lastRaw.x + 6, geometry.width - geometry.padX - 30)} y={Math.max(lastRaw.y - 6, 12)} fontSize="10" fill="#38bdf8">
              {lastRaw.value}
            </text>
          </>
        )}
        {!raw && (
          <text x={geometry.padX} y={geometry.padY + 10} fontSize="10" className="tx3" fill="currentColor">
            {tr("خط خام خالی است؛ خط فیلترشده نمایش داده می‌شود.", "Raw series is empty; the filtered line is shown.")}
          </text>
        )}
      </svg>
    </div>
  );
}
