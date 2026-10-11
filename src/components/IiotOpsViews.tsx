/**
 * پنل‌های عملیاتی IIoT & DAS: تجهیزات لبه، پایش وضعیت و هشدار/NPT/یکپارچگی.
 * ═══════════════════════════════════════════════════════════════════════
 * سه قاعده در همهٔ پنل‌ها:
 *
 * ۱) **هیچ عددی اینجا ساخته نمی‌شود.** همه از سرور می‌آید و همهٔ اکشن‌ها
 *    از همان مسیرهای REST زیر `/api/iiot/rigs/:rigId/...` می‌گذرند.
 * ۲) **دکمهٔ بی‌مجوز غیرفعال است و دلیلش را می‌گوید** (از `gates` که با
 *    همان موتور RBAC ساخته می‌شود)؛ تصمیم نهایی سرور است.
 * ۳) **هر تغییر، تازه‌سازی می‌خواهد.** پس از هر اکشن موفق، `onChanged`
 *    صدا زده می‌شود تا داشبورد و پنل‌ها هم‌زمان به‌روز شوند.
 */
import { useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import {
  iiotCalibrateSensor,
  iiotCloseDowntime,
  iiotCreateConditionSnapshot,
  iiotCreateThresholdRule,
  iiotDispatchAlert,
  iiotDispatchEvent,
  iiotFalsePositiveAlert,
  iiotAcknowledgeAlert,
  iiotGatewayHeartbeat,
  iiotGetNptSummary,
  iiotListAlerts,
  iiotListBuffer,
  iiotListChannels,
  iiotListConditionSnapshots,
  iiotListDowntime,
  iiotListGateways,
  iiotListIntegrationEvents,
  iiotListSensors,
  iiotListStreams,
  iiotListThresholdRules,
  iiotResolveAlert,
  iiotSyncBuffer,
  iiotTestThresholdRule,
  iiotVerifyDowntime,
  type IiotGatewayBuffer,
  type IiotTelemetryAlert,
  type IiotThresholdRule,
} from "../services/iiotApi";
import {
  decimalsForSignal,
  formatAgeFa,
  ageSecondsOf,
  formatMeasure,
  summarizeBufferRows,
  summarizeIntegrationEvents,
  type IiotAction,
} from "../services/iiotDashboard";
import { Btn, Chip, Meter, Muted, Note, SectionCard, StatusChip, StatCard, errorInfo, permissionTitle, usePolled } from "./IiotUi";

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

const READING_TYPES = ["vibration", "temperature", "humidity", "pressure", "current", "gas", "flow"] as const;
const ZONES = ["A", "B", "C", "D"] as const;
/* ═══════════════════════ ۱. تجهیزات IoT و Store-and-Forward ═══════════════════════ */

export function IiotDevicesView({ lang, rigId, userId, gates, live, intervalMs, onChanged }: IiotOpsProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);

  const streams = usePolled(() => iiotListStreams(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const gateways = usePolled(() => iiotListGateways(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const sensors = usePolled(() => iiotListSensors(rigId, { userId }), [rigId, userId], { live, intervalMs });

  const gatewayRows = gateways.state.kind === "ready" ? gateways.state.data.gateways : [];
  const [gatewayId, setGatewayId] = useState<string>("");
  const activeGatewayId = gatewayId || gatewayRows[0]?.Id || "";

  const buffer = usePolled(
    () => (activeGatewayId ? iiotListBuffer(rigId, activeGatewayId, { userId }) : Promise.resolve(null)),
    [rigId, userId, activeGatewayId],
    { live, intervalMs },
  );

  const [note, setNote] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState<string>("");

  const run = async (key: string, action: () => Promise<unknown>, okText: string) => {
    setBusy(key);
    setNote(null);
    try {
      await action();
      setNote({ kind: "ok", text: okText });
      onChanged();
    } catch (error) {
      const info = errorInfo(error);
      setNote({ kind: "error", text: `${info.message}${info.code ? ` (${info.code})` : ""}` });
    } finally {
      setBusy("");
    }
  };

  const bufferRows = buffer.state.kind === "ready" ? (buffer.state.data?.buffer ?? []) : [];
  const summary = useMemo(() => summarizeBufferRows(bufferRows as Array<{ Status?: string | null; SampleCount?: number | null; CapturedAt?: string | null }>), [bufferRows]);

  return (
    <div className="space-y-3">
      {note && <Note kind={note.kind} text={note.text} />}

      <SectionCard
        title={tr("جریان‌های تله‌متری", "Telemetry streams")}
        hint={tr("منبع داده، پروتکل و سلامت اتصال هر جریان", "Source system, protocol and connectivity per stream")}
        actions={
          <Btn small onClick={streams.refresh} busy={busy === "streams"}>{tr("تازه‌سازی", "Refresh")}</Btn>
        }
      >
        {streams.state.kind === "loading" && <Muted text={tr("در حال دریافت…", "Loading…")} />}
        {streams.state.kind === "error" && <Note kind="error" text={streams.state.message} />}
        {streams.state.kind === "ready" && (
          streams.state.data.streams.length === 0
            ? <Muted text={tr("جریانی برای این دکل تعریف نشده است.", "No stream defined for this rig.")} />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="tx3">
                    <tr>
                      <th className="text-start py-1">{tr("کد", "Code")}</th>
                      <th className="text-start py-1">{tr("منبع", "Source")}</th>
                      <th className="text-start py-1">{tr("پروتکل", "Protocol")}</th>
                      <th className="text-start py-1">{tr("نرخ نمونه", "Rate")}</th>
                      <th className="text-start py-1">{tr("آخرین نمونه", "Last sample")}</th>
                      <th className="text-start py-1">{tr("کیفیت", "Quality")}</th>
                      <th className="text-start py-1">{tr("اتصال", "Link")}</th>
                    </tr>
                  </thead>
                  <tbody className="tx2">
                    {streams.state.data.streams.map((stream) => (
                      <tr key={stream.Id} className="border-t b-line-soft">
                        <td className="py-1.5 tx1" dir="ltr">{stream.StreamCode}</td>
                        <td className="py-1.5" dir="ltr">{stream.SourceSystem ?? "—"}</td>
                        <td className="py-1.5" dir="ltr">{stream.TransportProtocol ?? "—"}</td>
                        <td className="py-1.5" dir="ltr">{stream.SampleRateHz ?? "—"} Hz</td>
                        <td className="py-1.5 tx3" dir="ltr">{stream.LastSampleAt ? new Date(stream.LastSampleAt).toLocaleString() : "—"}</td>
                        <td className="py-1.5" dir="ltr">{stream.QualityPct === null || stream.QualityPct === undefined ? "—" : `${stream.QualityPct}%`}</td>
                        <td className="py-1.5"><StatusChip status={stream.ConnectionState === "online" ? "normal" : stream.ConnectionState === "degraded" ? "warning" : "critical"} fa={fa} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}
      </SectionCard>

      <SectionCard
        title={tr("گیت‌وی‌های لبه", "Edge gateways")}
        hint={tr("ظرفیت بافر، آخرین ضربان و وضعیت اتصال — مبنای Store-and-Forward", "Buffer capacity, last heartbeat and link state — the store-and-forward basis")}
        actions={<Btn small onClick={gateways.refresh} busy={busy === "gateways"}>{tr("تازه‌سازی", "Refresh")}</Btn>}
      >
        {gateways.state.kind === "error" && <Note kind="error" text={gateways.state.message} />}
        {gateways.state.kind === "ready" && gatewayRows.length === 0 && <Muted text={tr("گیت‌وی لبه‌ای ثبت نشده است.", "No edge gateway registered.")} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {gatewayRows.map((gateway) => {
            const fill = Number(gateway.BufferCapacity ?? 0) > 0
              ? Math.round((Number(gateway.BufferUsed ?? 0) / Number(gateway.BufferCapacity ?? 0)) * 1000) / 10
              : 0;
            const tone = fill >= 90 ? "danger" : fill >= 70 ? "warn" : "ok";
            return (
              <div key={gateway.Id} className={`rounded-xl border b-line-soft bg-black/15 p-3 space-y-2 ${activeGatewayId === gateway.Id ? "ring-1 ring-sky-500/40" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="tx1 text-xs font-medium" dir="ltr">{gateway.GatewayCode}</div>
                    <div className="tx3 text-[10px]">{gateway.NameFa}</div>
                  </div>
                  <StatusChip status={gateway.ConnectionState === "online" ? "normal" : gateway.ConnectionState === "degraded" ? "warning" : "critical"} fa={fa} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between tx3 text-[10px]" dir="ltr">
                    <span>{gateway.Protocol ?? "—"}</span>
                    <span>{Number(gateway.BufferUsed ?? 0)} / {Number(gateway.BufferCapacity ?? 0)}</span>
                  </div>
                  <Meter pct={fill} tone={tone} />
                </div>
                <div className="tx3 text-[10px]" dir="ltr">
                  {tr("آخرین ضربان: ", "Last heartbeat: ")}
                  {gateway.LastHeartbeatAt ? new Date(gateway.LastHeartbeatAt).toLocaleString() : "—"}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Btn
                    small tone="primary"
                    disabled={!gates.ingestTelemetry}
                    title={permissionTitle(gates.ingestTelemetry, "iiot.telemetry.ingest", fa)}
                    busy={busy === `hb-${gateway.Id}`}
                    onClick={() => void run(`hb-${gateway.Id}`,
                      () => iiotGatewayHeartbeat(rigId, gateway.Id, { connectionState: "online", bufferUsed: Number(gateway.BufferUsed ?? 0) }, { userId }),
                      tr("ضربان ثبت شد.", "Heartbeat recorded."))}
                  >
                    {tr("ضربان", "Heartbeat")}
                  </Btn>
                  <Btn small onClick={() => setGatewayId(gateway.Id)}>{tr("نمایش بافر", "Show buffer")}</Btn>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title={tr("بافر لبه (Store-and-Forward)", "Edge buffer (store-and-forward)")}
        hint={tr("دسته‌های معلق، ناموفق و نامهٔ مرده — دادهٔ دکل بی‌صدا دور ریخته نمی‌شود", "Pending, failed and dead-letter batches — rig data is never dropped silently")}
        actions={
          <>
            <Chip text={`${tr("معلق", "pending")}: ${summary.buffered + summary.failed}`} tone={summary.failed ? "warn" : "idle"} />
            <Chip text={`${tr("نامهٔ مرده", "dead-letter")}: ${summary.deadLetter}`} tone={summary.deadLetter ? "danger" : "idle"} />
            <Chip text={`${tr("نمونهٔ معلق", "pending samples")}: ${summary.pendingSamples}`} tone="idle" />
          </>
        }
      >
        {activeGatewayId === "" && <Muted text={tr("برای دیدن بافر، یک گیت‌وی انتخاب کنید.", "Select a gateway to inspect its buffer.")} />}
        {buffer.state.kind === "loading" && <Muted text={tr("در حال دریافت…", "Loading…")} />}
        {buffer.state.kind === "error" && <Note kind="error" text={buffer.state.message} />}
        {buffer.state.kind === "ready" && buffer.state.data && (
          <>
            {summary.needsAttention && (
              <Note kind="error" text={tr(
                "دستهٔ «نامهٔ مرده» وجود دارد: پس از پایان تلاش‌ها تحویل نشده و نیازمند بررسی دستی است.",
                "Dead-letter batches exist: delivery failed after all attempts and they need manual review.",
              )} />
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <Btn
                small tone="primary" disabled={!gates.syncBuffer}
                title={permissionTitle(gates.syncBuffer, "iiot.buffer.sync", fa)}
                busy={busy === "sync-all"}
                onClick={() => void run("sync-all", async () => {
                  const ready = buffer.state.kind === "ready" ? buffer.state.data?.readyToSync ?? [] : [];
                  for (const batch of ready.slice(0, 50)) {
                    await iiotSyncBuffer(rigId, activeGatewayId, batch.Id, { delivered: true, ackRef: "dashboard-bulk-sync" }, { userId });
                  }
                }, tr("دسته‌های آماده همگام‌سازی شدند.", "Ready batches synchronized."))}
              >
                {tr("همگام‌سازی همهٔ آماده‌ها", "Sync all ready")}
              </Btn>
              <span className="tx3 text-[10px]" dir="ltr">
                {tr("قدیمی‌ترین معلق: ", "oldest pending: ")}
                {summary.oldestCapturedAt ? `${formatAgeFa(ageSecondsOf(summary.oldestCapturedAt, new Date().toISOString()))}` : "—"}
              </span>
            </div>

            {bufferRows.length === 0
              ? <Muted text={tr("بافر خالی است — همهٔ دسته‌ها تحویل شده‌اند.", "Buffer is empty — every batch delivered.")} />
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="tx3">
                      <tr>
                        <th className="text-start py-1">{tr("دسته", "Batch")}</th>
                        <th className="text-start py-1">{tr("وضعیت", "Status")}</th>
                        <th className="text-start py-1">{tr("نمونه", "Samples")}</th>
                        <th className="text-start py-1">{tr("تلاش", "Attempts")}</th>
                        <th className="text-start py-1">{tr("خطا", "Error")}</th>
                        <th className="text-start py-1">{tr("اقدام", "Action")}</th>
                      </tr>
                    </thead>
                    <tbody className="tx2">
                      {bufferRows.map((row: IiotGatewayBuffer) => (
                        <tr key={row.Id} className="border-t b-line-soft">
                          <td className="py-1.5 tx1" dir="ltr">{row.BatchNo}</td>
                          <td className="py-1.5">
                            <Chip
                              text={row.Status}
                              dir="ltr"
                              tone={row.Status === "sent" ? "ok" : row.Status === "dead-letter" ? "danger" : row.Status === "failed" ? "warn" : "idle"}
                            />
                          </td>
                          <td className="py-1.5" dir="ltr">{Number(row.SampleCount ?? 0)}</td>
                          <td className="py-1.5" dir="ltr">{Number(row.Attempts ?? 0)}/{Number(row.MaxAttempts ?? 0)}</td>
                          <td className="py-1.5 tx3" dir="ltr">{row.ErrorCode ?? "—"}</td>
                          <td className="py-1.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <Btn small tone="ok" disabled={!gates.syncBuffer} title={permissionTitle(gates.syncBuffer, "iiot.buffer.sync", fa)}
                                busy={busy === `sync-${row.Id}`}
                                onClick={() => void run(`sync-${row.Id}`,
                                  () => iiotSyncBuffer(rigId, activeGatewayId, row.Id, { delivered: true, ackRef: "dashboard-manual" }, { userId }),
                                  tr("دسته تحویل شد.", "Batch delivered."))}
                              >
                                {tr("همگام‌سازی", "Sync")}
                              </Btn>
                              <Btn small tone="warn" disabled={!gates.syncBuffer} title={permissionTitle(gates.syncBuffer, "iiot.buffer.sync", fa)}
                                busy={busy === `fail-${row.Id}`}
                                onClick={() => void run(`fail-${row.Id}`,
                                  () => iiotSyncBuffer(rigId, activeGatewayId, row.Id, { delivered: false, errorCode: "E-NET-LINK", errorFa: "لینک دکل در دسترس نیست" }, { userId }),
                                  tr("تحویل ناموفق ثبت شد.", "Failed delivery recorded."))}
                              >
                                {tr("ثبت شکست", "Mark failed")}
                              </Btn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}
      </SectionCard>

      <SectionCard
        title={tr("سنسورها و کالیبراسیون", "Sensors & calibration")}
        hint={tr("کالیبراسیون از ردهٔ «تکنسین میدان» است، نه مهندس پیکربندی‌کننده", "Calibration belongs to the field technician role, not the configuring engineer")}
        actions={<Btn small onClick={sensors.refresh} busy={busy === "sensors"}>{tr("تازه‌سازی", "Refresh")}</Btn>}
      >
        {sensors.state.kind === "error" && <Note kind="error" text={sensors.state.message} />}
        {sensors.state.kind === "ready" && sensors.state.data.sensors.length === 0 && (
          <Muted text={tr("سنسوری ثبت نشده است. (ساخت دکل نمونه، سنسور نمی‌سازد.)", "No sensor registered. (Demo rig setup does not create sensors.)")} />
        )}
        {sensors.state.kind === "ready" && sensors.state.data.sensors.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="tx3">
                <tr>
                  <th className="text-start py-1">{tr("تگ", "Tag")}</th>
                  <th className="text-start py-1">{tr("نوع", "Type")}</th>
                  <th className="text-start py-1">{tr("واحد", "Unit")}</th>
                  <th className="text-start py-1">{tr("وضعیت", "Status")}</th>
                  <th className="text-start py-1">{tr("کالیبراسیون بعدی", "Next calibration")}</th>
                  <th className="text-start py-1">{tr("اقدام", "Action")}</th>
                </tr>
              </thead>
              <tbody className="tx2">
                {sensors.state.data.sensors.map((sensor) => (
                  <tr key={sensor.Id} className="border-t b-line-soft">
                    <td className="py-1.5 tx1" dir="ltr">{sensor.SensorTag}</td>
                    <td className="py-1.5" dir="ltr">{sensor.SensorType ?? "—"}</td>
                    <td className="py-1.5" dir="ltr">{sensor.Unit ?? "—"}</td>
                    <td className="py-1.5">
                      <Chip
                        text={sensor.calibrationOverdue ? tr("کالیبراسیون سررسید", "calibration overdue") : (sensor.Status ?? "—")}
                        tone={sensor.calibrationOverdue ? "warn" : sensor.Status === "faulty" ? "danger" : "ok"}
                      />
                    </td>
                    <td className="py-1.5 tx3" dir="ltr">{sensor.NextCalibrationDue ?? "—"}</td>
                    <td className="py-1.5">
                      <Btn
                        small tone="primary" disabled={!gates.calibrateSensor}
                        title={permissionTitle(gates.calibrateSensor, "iiot.sensor.calibrate", fa)}
                        busy={busy === `cal-${sensor.Id}`}
                        onClick={() => {
                          const certificate = window.prompt(tr("شمارهٔ گواهی کالیبراسیون:", "Calibration certificate no:")) ?? "";
                          void run(`cal-${sensor.Id}`,
                            () => iiotCalibrateSensor(rigId, sensor.Id, { certificateNo: certificate || undefined, resultFa: "کالیبراسیون میدانی از داشبورد" }, { userId }),
                            tr("کالیبراسیون ثبت شد.", "Calibration recorded."));
                        }}
                      >
                        {tr("کالیبراسیون", "Calibrate")}
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ═══════════════════════ ۲. پایش شرایط (CBM) ═══════════════════════ */

export function IiotConditionView({ lang, rigId, userId, gates, live, intervalMs, onChanged }: IiotOpsProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);

  const snapshots = usePolled(() => iiotListConditionSnapshots(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const channels = usePolled(() => iiotListChannels(rigId, { userId }), [rigId, userId], { live, intervalMs });

  const [form, setForm] = useState({ readingType: "vibration", value: "4.2", uom: "mm/s", zone: "B", assetRef: "", sensorTag: "", healthIndex: "82", trend: "stable" });
  const [note, setNote] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setNote(null);
    try {
      await iiotCreateConditionSnapshot(rigId, {
        ReadingType: form.readingType,
        Value: Number(form.value),
        Uom: form.uom,
        Zone: form.zone || undefined,
        CmmsAssetRef: form.assetRef || undefined,
        SensorTag: form.sensorTag || undefined,
        HealthIndex: form.healthIndex === "" ? undefined : Number(form.healthIndex),
        TrendDirection: form.trend || undefined,
        Source: "manual",
      }, { userId });
      setNote({ kind: "ok", text: tr("قرائت پایش وضعیت ثبت شد.", "Condition reading recorded.") });
      onChanged();
    } catch (error) {
      const info = errorInfo(error);
      setNote({ kind: "error", text: `${info.message}${info.code ? ` (${info.code})` : ""}` });
    } finally {
      setBusy(false);
    }
  };

  const rows = snapshots.state.kind === "ready" ? snapshots.state.data.snapshots : [];

  return (
    <div className="space-y-3">
      {note && <Note kind={note.kind} text={note.text} />}

      <SectionCard
        title={tr("وضعیت کانال‌های سیگنال", "Signal channel status")}
        hint={tr("رنگ هر کانال را سرور از آستانه‌های فعال می‌سازد", "Server-side colour derived from active thresholds")}
        actions={<Btn small onClick={channels.refresh} busy={busy}>{tr("تازه‌سازی", "Refresh")}</Btn>}
      >
        {channels.state.kind === "error" && <Note kind="error" text={channels.state.message} />}
        {channels.state.kind === "ready" && channels.state.data.channels.length === 0 && <Muted text={tr("کانالی تعریف نشده است.", "No channel defined.")} />}
        {channels.state.kind === "ready" && channels.state.data.channels.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {channels.state.data.channels.map((channel) => (
              <div key={channel.Id} className="rounded-xl border b-line-soft bg-black/15 p-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="tx1 text-xs font-medium" dir="ltr">{channel.ChannelCode}</span>
                  <StatusChip status={channel.status} fa={fa} />
                </div>
                <div className="tx3 text-[10px]">{channel.NameFa}</div>
                <div className="tx2 text-lg font-semibold" dir="ltr">
                  {formatMeasure(channel.LastValue === null || channel.LastValue === undefined ? null : Number(channel.LastValue), { uom: channel.Unit, decimals: decimalsForSignal(channel.SignalType) })}
                </div>
                <div className="tx3 text-[10px]" dir="ltr">
                  {channel.FilterMethod ?? "—"} · {channel.FilterWindowSeconds ?? "—"}s {channel.IsCritical ? " · critical" : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={tr("ثبت قرائت پایش وضعیت (ISO 10816)", "Record condition reading (ISO 10816)")}
        hint={tr("هر قرائت می‌تواند به CMMS گزارش شود؛ پیوند با ارجاع نرم است، نه کلید خارجی", "Readings can be reported to CMMS through a soft reference, not a foreign key")}
      >
        {!gates.recordCondition && (
          <Note kind="info" text={tr("این نقش اجازهٔ ثبت قرائت ندارد؛ فرم فقط برای اطلاع نشان داده می‌شود.", "This role cannot record readings; the form is shown for reference only.")} />
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <label className="space-y-1">
            <span className="tx3 text-[10px]">{tr("نوع قرائت", "Reading type")}</span>
            <select dir="ltr" value={form.readingType} onChange={(e) => setForm({ ...form, readingType: e.target.value })}
              className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1">
              {READING_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="tx3 text-[10px]">{tr("مقدار", "Value")}</span>
            <input dir="ltr" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1" />
          </label>
          <label className="space-y-1">
            <span className="tx3 text-[10px]">{tr("واحد", "UoM")}</span>
            <input dir="ltr" value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })}
              className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1" />
          </label>
          <label className="space-y-1">
            <span className="tx3 text-[10px]">{tr("منطقه", "Zone")}</span>
            <select dir="ltr" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}
              className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1">
              {ZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="tx3 text-[10px]">{tr("تگ سنسور", "Sensor tag")}</span>
            <input dir="ltr" value={form.sensorTag} onChange={(e) => setForm({ ...form, sensorTag: e.target.value })}
              className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1" />
          </label>
          <label className="space-y-1">
            <span className="tx3 text-[10px]">{tr("دارایی نت (نرم)", "CMMS asset (soft)")}</span>
            <input dir="ltr" value={form.assetRef} onChange={(e) => setForm({ ...form, assetRef: e.target.value })}
              className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1" />
          </label>
          <label className="space-y-1">
            <span className="tx3 text-[10px]">{tr("شاخص سلامت", "Health index")}</span>
            <input dir="ltr" value={form.healthIndex} onChange={(e) => setForm({ ...form, healthIndex: e.target.value })}
              className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1" />
          </label>
          <label className="space-y-1">
            <span className="tx3 text-[10px]">{tr("روند", "Trend")}</span>
            <select dir="ltr" value={form.trend} onChange={(e) => setForm({ ...form, trend: e.target.value })}
              className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1">
              {["rising", "stable", "falling"].map((trend) => <option key={trend} value={trend}>{trend}</option>)}
            </select>
          </label>
        </div>
        <Btn
          tone="primary" busy={busy} disabled={!gates.recordCondition}
          title={permissionTitle(gates.recordCondition, "iiot.condition.record", fa)}
          onClick={() => void submit()}
        >
          {tr("ثبت قرائت", "Record reading")}
        </Btn>
      </SectionCard>

      <SectionCard
        title={tr("قرائت‌های ثبت‌شده", "Recorded readings")}
        hint={snapshots.state.kind === "ready" ? tr(
          `${snapshots.state.data.total} قرائت · ${snapshots.state.data.unreported} گزارش‌نشده به نت`,
          `${snapshots.state.data.total} readings · ${snapshots.state.data.unreported} not yet reported to CMMS`,
        ) : undefined}
        actions={<Btn small onClick={snapshots.refresh}>{tr("تازه‌سازی", "Refresh")}</Btn>}
      >
        {snapshots.state.kind === "error" && <Note kind="error" text={snapshots.state.message} />}
        {rows.length === 0 ? <Muted text={tr("قرائتی ثبت نشده است.", "No reading recorded.")} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="tx3">
                <tr>
                  <th className="text-start py-1">{tr("نوع", "Type")}</th>
                  <th className="text-start py-1">{tr("مقدار", "Value")}</th>
                  <th className="text-start py-1">{tr("منطقه", "Zone")}</th>
                  <th className="text-start py-1">{tr("شاخص سلامت", "Health")}</th>
                  <th className="text-start py-1">{tr("روند", "Trend")}</th>
                  <th className="text-start py-1">{tr("دارایی", "Asset")}</th>
                  <th className="text-start py-1">{tr("زمان", "Measured")}</th>
                </tr>
              </thead>
              <tbody className="tx2">
                {rows.map((row) => (
                  <tr key={row.Id} className="border-t b-line-soft">
                    <td className="py-1.5 tx1" dir="ltr">{row.ReadingType}</td>
                    <td className="py-1.5" dir="ltr">{formatMeasure(Number(row.Value), { uom: row.Uom, decimals: 2 })}</td>
                    <td className="py-1.5" dir="ltr">
                      <Chip text={row.Zone ?? "—"} tone={row.Zone === "D" ? "danger" : row.Zone === "C" ? "warn" : "ok"} />
                    </td>
                    <td className="py-1.5" dir="ltr">{row.HealthIndex === null || row.HealthIndex === undefined ? "—" : `${row.HealthIndex}%`}</td>
                    <td className="py-1.5" dir="ltr">{row.TrendDirection ?? "—"}</td>
                    <td className="py-1.5 tx3" dir="ltr">{row.CmmsAssetRef ?? "—"}</td>
                    <td className="py-1.5 tx3" dir="ltr">{row.MeasuredAt ? new Date(row.MeasuredAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ═══════════════════════ ۳. هشدار، NPT و صف یکپارچگی ═══════════════════════ */

export function IiotAlertsView({ lang, rigId, userId, gates, live, intervalMs, onChanged, refs }: IiotOpsProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);

  const alerts = usePolled(() => iiotListAlerts(rigId, { limit: 100 }, { userId }), [rigId, userId], { live, intervalMs });
  const rules = usePolled(() => iiotListThresholdRules(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const channels = usePolled(() => iiotListChannels(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const npt = usePolled(() => iiotGetNptSummary(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const downtime = usePolled(() => iiotListDowntime(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const events = usePolled(() => iiotListIntegrationEvents(rigId, { userId }), [rigId, userId], { live, intervalMs });

  const [note, setNote] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({ channelId: "", level: "critical", detectKind: "threshold", comparison: "gt", thresholdValue: "100", durationSeconds: "20", minSamples: "5", cooldownSeconds: "300", autoDispatch: false, ruleCode: "" });

  const run = async (key: string, action: () => Promise<unknown>, okText: string) => {
    setBusy(key);
    setNote(null);
    try {
      await action();
      setNote({ kind: "ok", text: okText });
      onChanged();
    } catch (error) {
      const info = errorInfo(error);
      setNote({ kind: "error", text: `${info.message}${info.code ? ` (${info.code})` : ""}` });
    } finally {
      setBusy("");
    }
  };

  const alertRows = alerts.state.kind === "ready" ? alerts.state.data.alerts : [];
  const ruleRows = rules.state.kind === "ready" ? rules.state.data.thresholdRules : [];
  const channelRows = channels.state.kind === "ready" ? channels.state.data.channels : [];
  const eventRows = events.state.kind === "ready" ? events.state.data.events : [];
  const eventSummary = useMemo(() => summarizeIntegrationEvents(eventRows as Array<{ Status?: string | null; Attempts?: number | null; TargetSystem?: string | null }>), [eventRows]);
  const openDowntime = downtime.state.kind === "ready" ? downtime.state.data.downtime.filter((row) => !row.EndedAt) : [];
  const nptData = npt.state.kind === "ready" ? npt.state.data : null;

  const alertActions = (alert: IiotTelemetryAlert) => (
    <div className="flex flex-wrap items-center gap-1">
      <Btn small tone="primary" disabled={!gates.acknowledgeAlert} title={permissionTitle(gates.acknowledgeAlert, "iiot.alert.ack", fa)}
        busy={busy === `ack-${alert.Id}`}
        onClick={() => {
          const noteText = window.prompt(tr("یادداشت تأیید (اختیاری):", "Acknowledgement note (optional):")) ?? undefined;
          void run(`ack-${alert.Id}`, () => iiotAcknowledgeAlert(rigId, alert.Id, noteText ? { NoteFa: noteText } : {}, { userId }), tr("هشدار تأیید شد.", "Alert acknowledged."));
        }}
      >
        {tr("تأیید", "Ack")}
      </Btn>
      <Btn small tone="ok" disabled={!gates.resolveAlert} title={permissionTitle(gates.resolveAlert, "iiot.alert.resolve", fa)}
        busy={busy === `res-${alert.Id}`}
        onClick={() => {
          const reason = window.prompt(tr("دلیل و اقدام رفع (الزامی):", "Resolution note (required):"));
          if (!reason) return;
          void run(`res-${alert.Id}`, () => iiotResolveAlert(rigId, alert.Id, { ResolutionNoteFa: reason }, { userId }), tr("هشدار بسته شد.", "Alert resolved."));
        }}
      >
        {tr("رفع", "Resolve")}
      </Btn>
      <Btn small tone="warn" disabled={!gates.falsePositiveAlert} title={permissionTitle(gates.falsePositiveAlert, "iiot.alert.resolve", fa)}
        busy={busy === `fp-${alert.Id}`}
        onClick={() => {
          const reason = window.prompt(tr("دلیل هشدار کاذب (الزامی):", "False-positive reason (required):"));
          if (!reason) return;
          void run(`fp-${alert.Id}`, () => iiotFalsePositiveAlert(rigId, alert.Id, { SuppressedReasonFa: reason }, { userId }), tr("هشدار کاذب ثبت شد و توقف خودکار برگشت.", "Marked false positive; the auto downtime was reverted."));
        }}
      >
        {tr("هشدار کاذب", "False positive")}
      </Btn>
      <Btn small tone="danger" disabled={!gates.dispatchAlert} title={permissionTitle(gates.dispatchAlert, "iiot.alert.dispatch", fa)}
        busy={busy === `dis-${alert.Id}`}
        onClick={() => void run(`dis-${alert.Id}`, () => iiotDispatchAlert(rigId, alert.Id, {}, { userId }), tr("هشدار به سامانه‌های مقصد ارسال شد.", "Alert dispatched to downstream systems."))}
      >
        {tr("ارسال", "Dispatch")}
      </Btn>
    </div>
  );

  return (
    <div className="space-y-3">
      {note && <Note kind={note.kind} text={note.text} />}

      <SectionCard
        title={tr("هشدارهای تله‌متری", "Telemetry alerts")}
        hint={tr("تأیید/رفع/هشدار کاذب/ارسال — مالک این تصمیم سرپرست حفاری است", "Ack / resolve / false-positive / dispatch — owned by the drilling supervisor")}
        actions={
          <>
            {alerts.state.kind === "ready" && (
              <>
                <Chip text={`${tr("باز", "active")}: ${alerts.state.data.counts.active ?? 0}`} tone="danger" />
                <Chip text={`${tr("بحرانی", "critical")}: ${alerts.state.data.counts.critical ?? 0}`} tone="warn" />
              </>
            )}
            <Btn small onClick={alerts.refresh}>{tr("تازه‌سازی", "Refresh")}</Btn>
          </>
        }
      >
        {alerts.state.kind === "error" && <Note kind="error" text={alerts.state.message} />}
        {alerts.state.kind === "ready" && alertRows.length === 0 && <Muted text={tr("هشداری ثبت نشده است.", "No alert recorded.")} />}
        {alertRows.length > 0 && (
          <div className="space-y-2">
            {alertRows.map((alert) => (
              <div key={alert.Id} className="rounded-xl border b-line-soft bg-black/15 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusChip status={alert.Level === "critical" ? "critical" : "warning"} fa={fa} />
                    <span className="tx1 text-xs font-medium">{alert.TitleFa ?? alert.AlertCode}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip text={alert.Status} dir="ltr" tone={alert.Status === "active" ? "danger" : alert.Status === "acknowledged" ? "warn" : "idle"} />
                    {alert.DispatchStatus && <Chip text={`dispatch: ${alert.DispatchStatus}`} dir="ltr" tone={alert.DispatchStatus === "dispatched" ? "ok" : alert.DispatchStatus === "failed" ? "danger" : "idle"} />}
                  </div>
                </div>
                <div className="tx3 text-[11px]" dir="ltr">
                  {alert.channel ? `${alert.channel.code} · ${alert.channel.nameFa} · ${alert.channel.unit}` : alert.ChannelId}
                </div>
                {alert.MessageFa && <p className="tx2 text-[11px]">{alert.MessageFa}</p>}
                <div className="flex flex-wrap items-center gap-3 tx3 text-[10px]" dir="ltr">
                  <span>detected: {new Date(alert.DetectedAt).toLocaleString()}</span>
                  <span>{formatAgeFa(ageSecondsOf(alert.DetectedAt, new Date().toISOString()))}</span>
                  {alert.TriggerValue !== null && alert.TriggerValue !== undefined && <span>trigger: {alert.TriggerValue}</span>}
                  {alert.DurationSeconds ? <span>sustained: {alert.DurationSeconds}s</span> : null}
                </div>
                {alertActions(alert)}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={tr("آستانه‌ها و قواعد تشخیص", "Threshold & detection rules")}
        hint={tr("پیکربندی قاعده با مهندس IIoT است؛ همان کسی که تأیید هشدار می‌کند، آستانه را عوض نمی‌کند", "Rule configuration is the IIoT engineer's; the alert approver does not move the threshold")}
        actions={<Btn small onClick={rules.refresh}>{tr("تازه‌سازی", "Refresh")}</Btn>}
      >
        {rules.state.kind === "error" && <Note kind="error" text={rules.state.message} />}
        {ruleRows.length === 0 && rules.state.kind === "ready" && <Muted text={tr("قاعده‌ای ثبت نشده است.", "No rule configured.")} />}
        {ruleRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="tx3">
                <tr>
                  <th className="text-start py-1">{tr("کد", "Code")}</th>
                  <th className="text-start py-1">{tr("سطح", "Level")}</th>
                  <th className="text-start py-1">{tr("نوع تشخیص", "Kind")}</th>
                  <th className="text-start py-1">{tr("مقدار", "Threshold")}</th>
                  <th className="text-start py-1">{tr("پایداری", "Sustained")}</th>
                  <th className="text-start py-1">{tr("ارسال خودکار", "Auto dispatch")}</th>
                  <th className="text-start py-1">{tr("اقدام", "Action")}</th>
                </tr>
              </thead>
              <tbody className="tx2">
                {ruleRows.map((rule: IiotThresholdRule) => (
                  <tr key={rule.Id} className="border-t b-line-soft">
                    <td className="py-1.5 tx1" dir="ltr">{rule.RuleCode}</td>
                    <td className="py-1.5"><Chip text={rule.Level ?? "—"} dir="ltr" tone={rule.Level === "critical" ? "danger" : "warn"} /></td>
                    <td className="py-1.5" dir="ltr">{rule.DetectKind ?? "threshold"}</td>
                    <td className="py-1.5" dir="ltr">{rule.ThresholdValue === null || rule.ThresholdValue === undefined ? "—" : String(rule.ThresholdValue)}</td>
                    <td className="py-1.5" dir="ltr">{rule.DurationSeconds ?? "—"}s / {rule.MinSamples ?? "—"}</td>
                    <td className="py-1.5" dir="ltr">{rule.AutoDispatch ? (rule.DispatchTargets ?? "—") : "—"}</td>
                    <td className="py-1.5">
                      <Btn small busy={busy === `test-${rule.Id}`}
                        onClick={() => void run(`test-${rule.Id}`, async () => {
                          const result = await iiotTestThresholdRule(rigId, rule.Id, { userId });
                          setTestResult(`${rule.RuleCode}: ${result.verdict.status} · ${tr("نمونه", "samples")}: ${result.sampleCount} · ${tr("هشدار می‌سازد؟", "would alert")}: ${result.wouldAlert ? tr("بله", "yes") : tr("خیر", "no")}`);
                        }, tr("اجرای آزمایشی انجام شد (هشداری ساخته نشد).", "Dry-run done (no alert created)."))}
                      >
                        {tr("آزمون", "Test")}
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {testResult && <Note kind="info" text={testResult} ltr />}

        <div className="rounded-xl border b-line-soft bg-black/10 p-2.5 space-y-2">
          <div className="tx2 text-[11px] font-medium">{tr("قاعدهٔ تازه (مهندس IIoT)", "New rule (IIoT engineer)")}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="space-y-1">
              <span className="tx3 text-[10px]">{tr("کانال", "Channel")}</span>
              <select dir="ltr" value={newRule.channelId} onChange={(e) => setNewRule({ ...newRule, channelId: e.target.value })}
                className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1">
                <option value="">—</option>
                {channelRows.map((channel) => <option key={channel.Id} value={channel.Id}>{channel.ChannelCode}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="tx3 text-[10px]">{tr("کد قاعده", "Rule code")}</span>
              <input dir="ltr" value={newRule.ruleCode} onChange={(e) => setNewRule({ ...newRule, ruleCode: e.target.value })}
                className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1" />
            </label>
            <label className="space-y-1">
              <span className="tx3 text-[10px]">{tr("سطح", "Level")}</span>
              <select dir="ltr" value={newRule.level} onChange={(e) => setNewRule({ ...newRule, level: e.target.value })}
                className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1">
                {["warning", "critical"].map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="tx3 text-[10px]">{tr("مقدار آستانه", "Threshold")}</span>
              <input dir="ltr" value={newRule.thresholdValue} onChange={(e) => setNewRule({ ...newRule, thresholdValue: e.target.value })}
                className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1" />
            </label>
            <label className="space-y-1">
              <span className="tx3 text-[10px]">{tr("پایداری (ثانیه)", "Sustained (s)")}</span>
              <input dir="ltr" value={newRule.durationSeconds} onChange={(e) => setNewRule({ ...newRule, durationSeconds: e.target.value })}
                className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1" />
            </label>
            <label className="space-y-1">
              <span className="tx3 text-[10px]">{tr("حداقل نمونه", "Min samples")}</span>
              <input dir="ltr" value={newRule.minSamples} onChange={(e) => setNewRule({ ...newRule, minSamples: e.target.value })}
                className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1" />
            </label>
            <label className="space-y-1">
              <span className="tx3 text-[10px]">{tr("دورهٔ سکوت (ثانیه)", "Cooldown (s)")}</span>
              <input dir="ltr" value={newRule.cooldownSeconds} onChange={(e) => setNewRule({ ...newRule, cooldownSeconds: e.target.value })}
                className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1" />
            </label>
            <label className="space-y-1">
              <span className="tx3 text-[10px]">{tr("ارسال خودکار", "Auto dispatch")}</span>
              <select dir="ltr" value={newRule.autoDispatch ? "yes" : "no"} onChange={(e) => setNewRule({ ...newRule, autoDispatch: e.target.value === "yes" })}
                className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[11px] tx1">
                <option value="no">no</option>
                <option value="yes">cmms,mes,pmis</option>
              </select>
            </label>
          </div>
          <Btn
            tone="primary" disabled={!gates.configureRule} title={permissionTitle(gates.configureRule, "iiot.threshold.edit", fa)}
            busy={busy === "create-rule"}
            onClick={() => void run("create-rule", () => iiotCreateThresholdRule(rigId, {
              RuleCode: newRule.ruleCode,
              ChannelId: newRule.channelId,
              NameFa: `${newRule.ruleCode} — ${newRule.level}`,
              Level: newRule.level,
              DetectKind: newRule.detectKind,
              Comparison: newRule.comparison,
              ThresholdValue: Number(newRule.thresholdValue),
              DurationSeconds: Number(newRule.durationSeconds),
              MinSamples: Number(newRule.minSamples),
              CooldownSeconds: Number(newRule.cooldownSeconds),
              AutoDispatch: newRule.autoDispatch,
              DispatchTargets: newRule.autoDispatch ? "cmms,mes,pmis" : undefined,
              CmmsSiteRef: newRule.autoDispatch ? refs.cmmsSiteRef ?? undefined : undefined,
              MesWorkCenterRef: newRule.autoDispatch ? refs.mesWorkCenterRef ?? undefined : undefined,
              PmisProjectRef: newRule.autoDispatch ? refs.pmisProjectRef ?? undefined : undefined,
              IsActive: true,
            }, { userId }), tr("قاعده ثبت شد.", "Rule created."))}
          >
            {tr("ثبت قاعده", "Create rule")}
          </Btn>
        </div>
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
        title={tr("توقف‌های باز دکل", "Open rig downtime")}
        hint={tr("بستن توقف با پرسنل شیفت، تأیید NPT با سرپرست حفاری", "Close with shift staff; verification of NPT with the drilling supervisor")}
        actions={<Btn small onClick={downtime.refresh}>{tr("تازه‌سازی", "Refresh")}</Btn>}
      >
        {downtime.state.kind === "error" && <Note kind="error" text={downtime.state.message} />}
        {openDowntime.length === 0 && downtime.state.kind === "ready" && <Muted text={tr("توقف بازی وجود ندارد.", "No open downtime.")} />}
        <div className="space-y-2">
          {openDowntime.map((row) => (
            <div key={row.Id} className="rounded-xl border b-line-soft bg-black/15 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Chip text={row.DowntimeCode} dir="ltr" tone={row.IsNpt ? "danger" : "ok"} />
                  <span className="tx2 text-[11px]" dir="ltr">{row.Category} · {row.NptCode ?? "—"}</span>
                </div>
                <span className="tx3 text-[10px]" dir="ltr">{row.DetectedBy === "auto" ? tr("خودکار از هشدار", "auto from alert") : tr("دستی", "manual")}</span>
              </div>
              <p className="tx2 text-[11px]">{row.CauseFa}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Btn small busy={busy === `close-${row.Id}`} disabled={!gates.reportDowntime} title={permissionTitle(gates.reportDowntime, "iiot.downtime.report", fa)}
                  onClick={() => void run(`close-${row.Id}`, () => iiotCloseDowntime(rigId, row.Id, {}, { userId }), tr("توقف بسته شد.", "Downtime closed."))}
                >
                  {tr("بستن توقف", "Close")}
                </Btn>
                <Btn small tone="primary" disabled={!gates.verifyDowntime} title={permissionTitle(gates.verifyDowntime, "iiot.downtime.verify", fa)}
                  busy={busy === `verify-${row.Id}`}
                  onClick={() => void run(`verify-${row.Id}`, () => iiotVerifyDowntime(rigId, row.Id, {}, { userId }), tr("توقف تأیید شد و NPT به MES/PMIS رفت.", "Downtime verified; NPT released to MES/PMIS."))}
                >
                  {tr("تأیید NPT", "Verify NPT")}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title={tr("صف یکپارچگی بین‌بخشی", "Cross-module event queue")}
        hint={tr("رویداد اول در صف می‌نشیند؛ تلاش دوباره، همان رویداد را می‌فرستد (کلید ضدتکرار)", "Events queue first; a retry resends the same event (idempotency key)")}
        actions={
          <>
            <Chip text={`${tr("معلق", "pending")}: ${eventSummary.pending}`} tone={eventSummary.pending ? "warn" : "idle"} />
            <Chip text={`${tr("تحویل‌شده", "dispatched")}: ${eventSummary.dispatched}`} tone="ok" />
            <Chip text={`${tr("ناموفق", "failed")}: ${eventSummary.failed + eventSummary.deadLetter}`} tone={eventSummary.failed + eventSummary.deadLetter ? "danger" : "idle"} />
            <Btn small tone="primary" disabled={!gates.dispatchEvent} title={permissionTitle(gates.dispatchEvent, "iiot.integration.dispatch", fa)}
              busy={busy === "retry-all"}
              onClick={() => void run("retry-all", async () => {
                for (const event of eventRows.filter((e) => e.Status !== "dispatched").slice(0, 30)) {
                  try { await iiotDispatchEvent(rigId, event.Id, { userId }); } catch { /* ناموفق‌ها در فهرست می‌مانند */ }
                }
              }, tr("تلاش دوباره برای رویدادهای تحویل‌نشده انجام شد.", "Retried undelivered events."))}
            >
              {tr("تلاش دوباره برای همه", "Retry all")}
            </Btn>
            <Btn small onClick={events.refresh}>{tr("تازه‌سازی", "Refresh")}</Btn>
          </>
        }
      >
        {events.state.kind === "error" && <Note kind="error" text={events.state.message} />}
        {events.state.kind === "ready" && !events.state.data.transportConfigured && (
          <Note kind="info" text={tr("حمل‌ونقل بین‌بخشی در این اجرا پیکربندی نشده است؛ رویدادها در صف می‌مانند.", "Cross-module transport is not configured in this run; events stay queued.")} />
        )}
        {eventRows.length === 0 && events.state.kind === "ready" && <Muted text={tr("رویدادی در صف نیست.", "Queue is empty.")} />}
        {eventRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="tx3">
                <tr>
                  <th className="text-start py-1">{tr("نوع رویداد", "Event")}</th>
                  <th className="text-start py-1">{tr("مقصد", "Target")}</th>
                  <th className="text-start py-1">{tr("وضعیت", "Status")}</th>
                  <th className="text-start py-1">{tr("تلاش", "Attempts")}</th>
                  <th className="text-start py-1">{tr("خطا", "Error")}</th>
                  <th className="text-start py-1">{tr("اقدام", "Action")}</th>
                </tr>
              </thead>
              <tbody className="tx2">
                {eventRows.map((event) => (
                  <tr key={event.Id} className="border-t b-line-soft">
                    <td className="py-1.5 tx1" dir="ltr">{event.EventType}</td>
                    <td className="py-1.5" dir="ltr">{event.TargetSystem}</td>
                    <td className="py-1.5">
                      <Chip text={event.Status} dir="ltr" tone={event.Status === "dispatched" ? "ok" : event.Status === "pending" ? "warn" : "danger"} />
                    </td>
                    <td className="py-1.5" dir="ltr">{Number(event.Attempts ?? 0)}/{Number(event.MaxAttempts ?? 0)}</td>
                    <td className="py-1.5 tx3" dir="ltr">{event.ErrorCode ?? "—"}</td>
                    <td className="py-1.5">
                      <Btn small tone="primary" disabled={!gates.dispatchEvent || event.Status === "dispatched"}
                        title={permissionTitle(gates.dispatchEvent, "iiot.integration.dispatch", fa)}
                        busy={busy === `ev-${event.Id}`}
                        onClick={() => void run(`ev-${event.Id}`, () => iiotDispatchEvent(rigId, event.Id, { userId }), tr("رویداد تحویل شد.", "Event delivered."))}
                      >
                        {tr("تلاش دوباره", "Retry")}
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
