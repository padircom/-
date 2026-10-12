/**
 * پنل‌های عملیاتی IIoT & DAS: هر بخش یک جدول تعاملی (جستجو، فیلتر، مرتب‌سازی،
 * صفحه‌بندی) با ثبت/ویرایش/مشاهده و اقدام‌های وضعیت است.
 * ═══════════════════════════════════════════════════════════════════════
 * قواعد:
 * ۱) هیچ عددی اینجا ساخته نمی‌شود؛ همه از سرور می‌آید.
 * ۲) دکمهٔ بی‌مجوز غیرفعال است و دلیلش را نشان می‌دهد؛ تصمیم نهایی با سرور است.
 * ۳) هر تغییر موفق، داشبورد و بخش‌های دیگر را تازه می‌کند (`onChanged`).
 */
import { useState } from "react";
import type { Lang } from "../data/framework";
import { Btn, Meter, Note, SectionCard, StatCard, usePolled } from "./IiotUi";
import { iiotGetNptSummary } from "../services/iiotApi";
import { formatMeasure } from "../services/iiotDashboard";
import {
  IiotAlertsPanel,
  IiotBufferPanel,
  IiotChannelsPanel,
  IiotConditionPanel,
  IiotDowntimePanel,
  IiotEventsPanel,
  IiotFilterRulesPanel,
  IiotGatewaysPanel,
  IiotSensorsPanel,
  IiotStreamsPanel,
  IiotThresholdRulesPanel,
  type IiotPanelProps,
} from "./IiotCrudPanels";
import type { IiotAction } from "../services/iiotDashboard";

export interface IiotOpsProps {
  lang: Lang;
  rigId: string;
  userId: string;
  gates: Record<IiotAction, boolean>;
  live: boolean;
  intervalMs: number;
  /** تازه‌سازی بیرونی: پس از هر تغییر موفق صدا زده می‌شود. */
  onChanged: () => void;
  /** ارجاع‌های نرم دکل — برای ساخت قاعدهٔ ارسال خودکار. */
  refs: { cmmsSiteRef?: string | null; mesWorkCenterRef?: string | null; pmisProjectRef?: string | null };
}

/* ═══════════════════════ ۱. تجهیزات IoT و Store-and-Forward ═══════════════════════ */

export function IiotDevicesView({ lang, rigId, userId, live, intervalMs, onChanged }: IiotOpsProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const [gatewayId, setGatewayId] = useState<string>("");
  const common: IiotPanelProps = { lang, rigId, userId, live, intervalMs, onChanged };

  return (
    <div className="space-y-3">
      <SectionCard
        title={tr("جریان‌های تله‌متری", "Telemetry streams")}
        hint={tr("منبع داده، پروتکل و سلامت اتصال هر جریان", "Source system, protocol and connectivity per stream")}
      >
        <IiotStreamsPanel {...common} />
      </SectionCard>

      <SectionCard
        title={tr("گیت‌وی‌های لبه", "Edge gateways")}
        hint={tr("ظرفیت بافر، آخرین ضربان و وضعیت اتصال — مبنای Store-and-Forward", "Buffer capacity, last heartbeat and link state — the store-and-forward basis")}
      >
        <IiotGatewaysPanel {...common} />
      </SectionCard>

      <SectionCard
        title={tr("بافر لبه (Store-and-Forward)", "Edge buffer (store-and-forward)")}
        hint={tr("دسته‌های معلق، ناموفق و نامهٔ مرده — دادهٔ دکل بی‌صدا دور ریخته نمی‌شود", "Pending, failed and dead-letter batches — rig data is never dropped silently")}
      >
        <IiotBufferPanel {...common} gatewayId={gatewayId} onGatewayChange={setGatewayId} />
      </SectionCard>

      <SectionCard
        title={tr("سنسورها و کالیبراسیون", "Sensors & calibration")}
        hint={tr("سنسورهای دکل، سررسید کالیبراسیون و خروج از سرویس", "Rig sensors, calibration due dates and retirement")}
      >
        <IiotSensorsPanel {...common} />
      </SectionCard>
    </div>
  );
}

/* ═══════════════════════ ۲. پایش وضعیت ═══════════════════════ */

export function IiotConditionView({ lang, rigId, userId, live, intervalMs, onChanged }: IiotOpsProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const common: IiotPanelProps = { lang, rigId, userId, live, intervalMs, onChanged };

  return (
    <div className="space-y-3">
      <SectionCard
        title={tr("کانال‌های سیگنال", "Signal channels")}
        hint={tr("سیگنال‌های نامی، واحد، نرخ نمونه و روش فیلتر هر کانال", "Nominal ranges, units, sample rate and filter method per channel")}
      >
        <IiotChannelsPanel {...common} />
      </SectionCard>

      <SectionCard
        title={tr("قواعد فیلتر سیگنال", "Signal filter rules")}
        hint={tr("فیلتر نویز و جهش پیش از تشخیص آستانه", "Noise and spike filtering before threshold detection")}
      >
        <IiotFilterRulesPanel {...common} />
      </SectionCard>

      <SectionCard
        title={tr("قرائت‌های پایش وضعیت (ISO 10816)", "Condition readings (ISO 10816)")}
        hint={tr("ثبت و بررسی قرائت‌ها؛ ارسال به CMMS از مسیر یکپارچگی انجام می‌شود", "Record and review readings; CMMS delivery follows the integration path")}
      >
        <IiotConditionPanel {...common} />
      </SectionCard>
    </div>
  );
}

/* ═══════════════════════ ۳. هشدار، NPT و یکپارچگی ═══════════════════════ */

export function IiotAlertsView({ lang, rigId, userId, live, intervalMs, onChanged, refs }: IiotOpsProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const common: IiotPanelProps = { lang, rigId, userId, live, intervalMs, onChanged };
  const npt = usePolled(() => iiotGetNptSummary(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const nptData = npt.state.kind === "ready" ? npt.state.data : null;

  return (
    <div className="space-y-3">
      <SectionCard
        title={tr("هشدارهای تله‌متری", "Telemetry alerts")}
        hint={tr("تأیید، بستن، ثبت هشدار کاذب و ارسال به سامانه‌های مقصد", "Acknowledge, resolve, mark false positive and dispatch to target systems")}
      >
        <IiotAlertsPanel {...common} />
      </SectionCard>

      <SectionCard
        title={tr("آستانه‌ها و قواعد تشخیص", "Threshold & detection rules")}
        hint={tr("قاعدهٔ آستانه، آزمایش و مقصدهای ارسال خودکار", "Threshold rules, dry-run testing and auto-dispatch targets")}
      >
        <IiotThresholdRulesPanel {...common} refs={refs} />
      </SectionCard>

      <SectionCard
        title={tr("زمان نامولّد (NPT)", "Non-productive time (NPT)")}
        hint={tr("NPT فقط پس از «تأیید» رسمی می‌شود و به MES/PMIS می‌رود — نه به CMMS", "NPT becomes official only after verification and goes to MES/PMIS — never to CMMS")}
        actions={<Btn small onClick={npt.refresh}>{tr("تازه‌سازی", "Refresh")}</Btn>}
      >
        {npt.state.kind === "error" && <Note kind="error" text={npt.state.message} />}
        {nptData && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <StatCard label={tr("NPT (دقیقه)", "NPT (min)")} value={nptData.nptMinutes} tone={nptData.nptMinutes > 0 ? "warn" : "ok"} />
              <StatCard label={tr("نرخ NPT", "NPT rate")} value={`${nptData.nptPct}%`} tone={nptData.nptPct > 10 ? "danger" : "ok"} />
              <StatCard label={tr("زمان مولد", "Productive")} value={nptData.productiveMinutes ?? "—"} tone="ok" />
              <StatCard label={tr("توقف باز", "Open downtime")} value={nptData.openCount} tone={nptData.openCount > 0 ? "warn" : "idle"} />
            </div>
            {nptData.byCategory.length > 0 && (
              <div className="space-y-1.5">
                {nptData.byCategory.slice(0, 6).map((row) => {
                  const share = nptData.nptMinutes > 0 ? Math.round((row.minutes / nptData.nptMinutes) * 100) : 0;
                  return (
                    <div key={row.category} className="space-y-1">
                      <div className="flex items-center justify-between tx3 text-[10px]" dir="ltr">
                        <span>{row.category}{row.nptCode ? ` · ${row.nptCode}` : ""}</span>
                        <span>{formatMeasure(row.minutes, { decimals: 1, uom: tr("دقیقه", "min") })}</span>
                      </div>
                      <Meter pct={share} tone={row.nptCode && row.nptCode.startsWith("NPT-7") ? "warn" : "danger"} />
                    </div>
                  );
                })}
              </div>
            )}
            {nptData.claimCandidates.length > 0 && (
              <div className="space-y-1.5">
                <div className="tx2 text-[11px]">
                  {tr(
                    `نامزدهای ادعا (بیش از ${nptData.claimThresholdMinutes} دقیقه و خارج از مسئولیت پیمانکار):`,
                    `Claim candidates (beyond ${nptData.claimThresholdMinutes} min and outside contractor responsibility):`,
                  )}
                </div>
                {nptData.claimCandidates.map((candidate) => (
                  <div key={candidate.downtimeId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border b-line-soft bg-black/10 px-2.5 py-1.5">
                    <span className="tx2 text-[11px]" dir="ltr">{candidate.code} · {candidate.category} · {candidate.minutes} min</span>
                    <span className="tx3 text-[10px]">{candidate.responsibilityFa ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </SectionCard>


      <SectionCard
        title={tr("توقف‌های دکل", "Rig downtime")}
        hint={tr("ثبت توقف، بستن و تأیید آن؛ تأیید، NPT را به MES/PMIS می‌فرستد", "Report, close and verify downtime; verification sends NPT to MES/PMIS")}
      >
        <IiotDowntimePanel {...common} />
      </SectionCard>

      <SectionCard
        title={tr("صف یکپارچگی بین‌بخشی", "Cross-module event queue")}
        hint={tr("رویدادهای در انتظار تحویل به CMMS/MES/PMIS", "Events waiting for delivery to CMMS/MES/PMIS")}
      >
        <IiotEventsPanel {...common} />
      </SectionCard>
    </div>
  );
}
