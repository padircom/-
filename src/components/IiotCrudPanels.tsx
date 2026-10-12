/**
 * بخش‌های CRUD دکل IIoT: هر موجودیت یک جدول تعاملی با ثبت/ویرایش/مشاهده و
 * اقدام‌های وضعیت است. همهٔ درخواست‌ها از همان مسیرهای REST زیر
 * `/api/iiot/rigs/:rigId/...` می‌روند و مجوزها از موتور RBAC همان دکل می‌آیند.
 *
 * یادداشت صداقت: سرور IIoT مسیر حذف سخت ندارد. «حذف» همان غیرفعال‌سازی است:
 * `IsActive=false` برای جریان/کانال/گیت‌وی/قاعده، و `Status=removed` برای سنسور.
 */
import type { Lang } from "../data/framework";
import CrudResource, { type ResourceAction } from "./crud/CrudResource";
import type { GridColumnDef } from "./crud/gridLogic";
import type { FormFieldDef } from "./crud/formLogic";
import { dayToIsoDateTime } from "./crud/formLogic";
import { usePolled, errorInfo } from "./IiotUi";
import {
  canIiotAccess,
  IIOT_SIGNAL_LIST,
  iiotCloseDowntime,
  iiotCreateChannel,
  iiotCreateConditionSnapshot,
  iiotCreateDowntime,
  iiotCreateFilterRule,
  iiotCreateGateway,
  iiotCreateSensor,
  iiotCreateStream,
  iiotCreateThresholdRule,
  iiotDispatchAlert,
  iiotDispatchEvent,
  iiotFalsePositiveAlert,
  iiotAcknowledgeAlert,
  iiotGatewayHeartbeat,
  iiotListAlerts,
  iiotListBuffer,
  iiotListChannels,
  iiotListConditionSnapshots,
  iiotListDowntime,
  iiotListFilterRules,
  iiotListGateways,
  iiotListIntegrationEvents,
  iiotListSensors,
  iiotListStreams,
  iiotListThresholdRules,
  iiotPatchChannel,
  iiotPatchFilterRule,
  iiotPatchGateway,
  iiotPatchSensor,
  iiotPatchStream,
  iiotPatchThresholdRule,
  iiotResolveAlert,
  iiotSyncBuffer,
  iiotTestThresholdRule,
  iiotVerifyDowntime,
  iiotCalibrateSensor as calibrate,
  type IotDasChannel,
  type IiotDrillingRigStream,
  type IiotEdgeGateway,
  type IiotGatewayBuffer,
  type IiotIntegrationEvent,
  type IiotRigDowntime,
  type IiotSensorNode,
  type IiotSignalFilterRule,
  type IiotTelemetryAlert,
  type IiotThresholdRule,
  type IiotConditionSnapshot,
} from "../services/iiotApi";

export interface IiotPanelProps {
  lang: Lang;
  rigId: string;
  userId: string;
  live: boolean;
  intervalMs: number;
  /** تازه‌سازی داشبورد و بخش‌های دیگر پس از هر تغییر موفق. */
  onChanged: () => void;
}

/* ═══════════════════════ ابزارهای مشترک ═══════════════════════ */

const SOURCE_SYSTEMS = ["witsml", "mudlogger", "plc", "scada", "edge", "manual"];
const TRANSPORTS = ["mqtt", "opc-ua", "modbus", "witsml", "http"];
const CONNECTION_STATES = ["online", "degraded", "offline"];
const FILTER_METHODS = ["none", "sma", "ema", "median"];
const DETECT_KINDS = ["threshold", "rate-of-change", "stick-slip", "pump-drop", "flatline", "spike"];
const COMPARISONS = ["gt", "gte", "lt", "lte", "band-out", "rate"];
const LEVELS = ["warning", "critical"];
const SYNC_MODES = ["realtime", "store-forward", "batch"];
const AUTH_MODES = ["token", "certificate", "anonymous"];
const SENSOR_STATUS = ["active", "faulty", "calibration-due", "removed"];
const READING_TYPES = ["vibration", "temperature", "humidity", "pressure", "current", "gas", "flow"];
const ZONES = ["A", "B", "C", "D"];
const TRENDS = ["rising", "falling", "stable"];
const DOWNTIME_CATEGORIES = [
  "equipment", "mud", "directional", "wellbore", "weather", "power", "logistics", "cementing", "waiting-on-decision", "other",
];
const DOWNTIME_TYPES = ["productive", "non-productive", "planned"];
const ALERT_STATUSES = ["active", "acknowledged", "resolved", "suppressed", "false-positive"];
const EVENT_STATUSES = ["pending", "dispatched", "failed", "dead-letter"];
const BUFFER_STATUSES = ["buffered", "sending", "sent", "failed", "dead-letter"];
const DISPATCH_TARGETS_HINT = "cmms, mes, pmis";

function opts(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

/** مشتق‌گیری از پاسخ `usePolled` برای CrudResource. */
function usePanelData<T>(loader: () => Promise<T>, deps: unknown[], props: Pick<IiotPanelProps, "live" | "intervalMs">) {
  const polled = usePolled(loader, deps, { live: props.live, intervalMs: props.intervalMs });
  return {
    data: polled.state.kind === "ready" ? polled.state.data : null,
    loading: polled.state.kind === "idle" || polled.state.kind === "loading",
    error: polled.state.kind === "error" ? polled.state.message : null,
    refresh: polled.refresh,
  };
}

function describeIiotError(error: unknown): string {
  const info = errorInfo(error);
  return info.code ? `${info.message} (${info.code})` : info.message;
}

/** قفل سطر به‌صورت فعال/غیرفعال؛ سرور حذف سخت ندارد. */
function toggleAction<T extends { IsActive?: boolean | null; RowVersion: number }>(
  fa: boolean,
  allowed: boolean,
  permission: string,
  patch: (row: T, body: Record<string, unknown>) => Promise<unknown>,
): ResourceAction<T> {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  return {
    key: "toggle",
    label: (row) => (row.IsActive ? tr("غیرفعال‌سازی", "Deactivate") : tr("فعال‌سازی", "Activate")),
    tone: "warn",
    disabled: () => !allowed,
    title: allowed ? undefined : `${fa ? "مجوز لازم" : "Required permission"}: ${permission}`,
    confirm: (row) => ({
      title: row.IsActive ? tr("غیرفعال‌سازی", "Deactivate") : tr("فعال‌سازی", "Activate"),
      message: row.IsActive
        ? tr("رکورد حذف نمی‌شود؛ فقط از کار می‌افتد و سابقه باقی می‌ماند.", "The record is kept; it is only switched off with its history intact.")
        : tr("رکورد دوباره فعال می‌شود.", "The record becomes active again."),
      confirmLabel: row.IsActive ? tr("غیرفعال‌سازی", "Deactivate") : tr("فعال‌سازی", "Activate"),
      danger: row.IsActive === true,
    }),
    run: (row) => patch(row, { IsActive: !row.IsActive, RowVersion: row.RowVersion }),
    successText: (row) => (row.IsActive ? tr("غیرفعال شد.", "Deactivated.") : tr("فعال شد.", "Activated.")),
  };
}

/* ═══════════════════════ ۱. جریان‌های تله‌متری ═══════════════════════ */

export function IiotStreamsPanel({ lang, rigId, userId, live, intervalMs, onChanged }: IiotPanelProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canIiotAccess(userId, "iiot.stream.edit", rigId);
  const streams = usePanelData(() => iiotListStreams(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const gateways = usePanelData(() => iiotListGateways(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const gatewayOptions = (gateways.data?.gateways ?? []).map((g) => ({ value: g.Id, label: `${g.GatewayCode} — ${g.NameFa}` }));
  const rows = (streams.data?.streams ?? []) as IiotDrillingRigStream[];

  const fields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام جریان", "Stream name"), required: true, maxLength: 240, fullWidth: true },
    { name: "SourceSystem", label: tr("منبع داده", "Source system"), type: "select", required: true, options: opts(SOURCE_SYSTEMS) },
    { name: "TransportProtocol", label: tr("پروتکل انتقال", "Transport"), type: "select", required: true, options: opts(TRANSPORTS) },
    { name: "GatewayId", label: tr("گیت‌وی", "Gateway"), type: "select", options: gatewayOptions },
    { name: "SampleRateHz", label: tr("نرخ نمونه (Hz)", "Sample rate (Hz)"), type: "number", min: 0.001, ltr: true },
    { name: "BatchSize", label: tr("اندازهٔ دسته", "Batch size"), type: "number", integer: true, min: 1, ltr: true },
    { name: "ConnectionState", label: tr("وضعیت اتصال", "Connection"), type: "select", options: opts(CONNECTION_STATES) },
    { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];
  const createFields: FormFieldDef[] = [
    { name: "StreamCode", label: tr("کد جریان", "Stream code"), required: true, maxLength: 40, ltr: true },
    ...fields,
  ];

  const columns: GridColumnDef<IiotDrillingRigStream>[] = [
    { key: "StreamCode", header: tr("کد", "Code"), ltr: true } as GridColumnDef<IiotDrillingRigStream>,
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "SourceSystem", header: tr("منبع", "Source"), filter: "auto" },
    { key: "TransportProtocol", header: tr("پروتکل", "Protocol"), filter: "auto" },
    { key: "SampleRateHz", header: tr("نرخ (Hz)", "Rate (Hz)"), align: "center", ltr: true },
    { key: "ConnectionState", header: tr("اتصال", "Link"), filter: "auto" },
    { key: "QualityPct", header: tr("کیفیت %", "Quality %"), align: "center", ltr: true },
    {
      key: "IsActive", header: tr("فعال", "Active"),
      accessor: (row) => (row.IsActive ? "true" : "false"),
      render: (row) => (row.IsActive ? tr("فعال", "Active") : tr("غیرفعال", "Inactive")),
      filter: [{ value: "true", label: tr("فعال", "Active") }, { value: "false", label: tr("غیرفعال", "Inactive") }],
    },
  ];

  return (
    <CrudResource<IiotDrillingRigStream>
      fa={fa}
      caption={tr("جریان‌های تله‌متری", "Telemetry streams")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={streams.loading}
      error={streams.error}
      onRetry={streams.refresh}
      onChanged={() => { streams.refresh(); onChanged(); }}
      describeError={describeIiotError}
      emptyText={tr("جریانی برای این دکل تعریف نشده است", "No stream defined for this rig")}
      create={{
        title: tr("جریان تله‌متری جدید", "New telemetry stream"),
        fields: createFields,
        defaults: { SourceSystem: "edge", TransportProtocol: "mqtt", ConnectionState: "offline", IsActive: "true" },
        allowed,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.stream.edit`,
        submit: (payload) => iiotCreateStream(rigId, payload, { userId }),
        successText: tr("جریان ثبت شد.", "Stream created."),
      }}
      edit={{
        title: tr("ویرایش جریان", "Edit stream"),
        fields,
        allowed,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.stream.edit`,
        submit: (row, payload) => iiotPatchStream(rigId, row.Id, { ...payload, RowVersion: row.RowVersion }, { userId }),
      }}
      actions={() => [toggleAction<IiotDrillingRigStream>(fa, allowed, "iiot.stream.edit", (row, body) => iiotPatchStream(rigId, row.Id, body, { userId }))]}
    />
  );
}

/* ═══════════════════════ ۲. کانال‌های سیگنال و فیلترها ═══════════════════════ */

export function IiotChannelsPanel({ lang, rigId, userId, live, intervalMs, onChanged }: IiotPanelProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canIiotAccess(userId, "iiot.channel.edit", rigId);
  const channels = usePanelData(() => iiotListChannels(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const streams = usePanelData(() => iiotListStreams(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const streamOptions = (streams.data?.streams ?? []).map((s) => ({ value: s.Id, label: `${s.StreamCode} — ${s.NameFa}` }));
  const rows = (channels.data?.channels ?? []) as IotDasChannel[];
  const signalOptions = opts(IIOT_SIGNAL_LIST);

  const fields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام کانال", "Channel name"), required: true, maxLength: 240, fullWidth: true },
    { name: "NameEn", label: tr("نام لاتین", "English name"), maxLength: 240, ltr: true },
    { name: "Unit", label: tr("واحد", "Unit"), required: true, maxLength: 24, ltr: true },
    { name: "NominalMin", label: tr("کمینهٔ نامی", "Nominal min"), type: "number", ltr: true },
    { name: "NominalMax", label: tr("بیشینهٔ نامی", "Nominal max"), type: "number", ltr: true },
    { name: "NominalValue", label: tr("مقدار نامی", "Nominal value"), type: "number", ltr: true },
    { name: "DisplayMin", label: tr("کمینهٔ نمایش", "Display min"), type: "number", ltr: true },
    { name: "DisplayMax", label: tr("بیشینهٔ نمایش", "Display max"), type: "number", ltr: true },
    { name: "SampleRateHz", label: tr("نرخ نمونه (Hz)", "Sample rate (Hz)"), type: "number", integer: true, min: 1, max: 1000, ltr: true },
    { name: "FilterMethod", label: tr("روش فیلتر", "Filter method"), type: "select", options: opts(FILTER_METHODS) },
    { name: "FilterWindowSeconds", label: tr("پنجرهٔ فیلتر (ثانیه)", "Filter window (s)"), type: "number", min: 0, ltr: true },
    { name: "DeadbandPct", label: tr("باند مرده %", "Deadband %"), type: "number", min: 0, max: 100, ltr: true },
    { name: "SensorTag", label: tr("برچسب سنسور", "Sensor tag"), maxLength: 60, ltr: true },
    { name: "IsCritical", label: tr("کانال بحرانی", "Critical channel"), type: "checkbox" },
    { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" },
    { name: "InstalledLocationFa", label: tr("محل نصب", "Location"), maxLength: 240 },
    { name: "NextCalibrationDue", label: tr("کالیبراسیون بعدی", "Next calibration"), type: "date" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];
  const createFields: FormFieldDef[] = [
    { name: "ChannelCode", label: tr("کد کانال", "Channel code"), required: true, maxLength: 60, ltr: true },
    { name: "SignalType", label: tr("نوع سیگنال", "Signal type"), type: "select", required: true, options: signalOptions },
    { name: "StreamId", label: tr("جریان", "Stream"), type: "select", options: streamOptions },
    ...fields,
  ];

  const columns: GridColumnDef<IotDasChannel>[] = [
    { key: "ChannelCode", header: tr("کد", "Code"), ltr: true } as GridColumnDef<IotDasChannel>,
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "SignalType", header: tr("سیگنال", "Signal"), filter: "auto" },
    { key: "Unit", header: tr("واحد", "Unit"), ltr: true },
    { key: "SampleRateHz", header: tr("نرخ (Hz)", "Rate (Hz)"), align: "center", ltr: true },
    { key: "FilterMethod", header: tr("فیلتر", "Filter"), filter: "auto" },
    {
      key: "IsCritical", header: tr("بحرانی", "Critical"),
      accessor: (row) => (row.IsCritical ? "true" : "false"),
      render: (row) => (row.IsCritical ? tr("بله", "Yes") : tr("خیر", "No")),
      filter: [{ value: "true", label: tr("بله", "Yes") }, { value: "false", label: tr("خیر", "No") }],
    },
    {
      key: "IsActive", header: tr("فعال", "Active"),
      accessor: (row) => (row.IsActive ? "true" : "false"),
      render: (row) => (row.IsActive ? tr("فعال", "Active") : tr("غیرفعال", "Inactive")),
      filter: [{ value: "true", label: tr("فعال", "Active") }, { value: "false", label: tr("غیرفعال", "Inactive") }],
    },
  ];

  return (
    <CrudResource<IotDasChannel>
      fa={fa}
      caption={tr("کانال‌های سیگنال", "Signal channels")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={channels.loading}
      error={channels.error}
      onRetry={channels.refresh}
      onChanged={() => { channels.refresh(); onChanged(); }}
      describeError={describeIiotError}
      emptyText={tr("کانالی تعریف نشده است", "No channel defined")}
      create={{
        title: tr("کانال سیگنال جدید", "New signal channel"),
        fields: createFields,
        defaults: { SignalType: "rpm", Unit: "", FilterMethod: "sma", IsCritical: "false", IsActive: "true" },
        allowed,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.channel.edit`,
        submit: (payload) => iiotCreateChannel(rigId, payload, { userId }),
        successText: tr("کانال ثبت شد.", "Channel created."),
      }}
      edit={{
        title: tr("ویرایش کانال", "Edit channel"),
        fields,
        allowed,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.channel.edit`,
        submit: (row, payload) => iiotPatchChannel(rigId, row.Id, { ...payload, RowVersion: row.RowVersion }, { userId }),
      }}
      actions={() => [toggleAction<IotDasChannel>(fa, allowed, "iiot.channel.edit", (row, body) => iiotPatchChannel(rigId, row.Id, body, { userId }))]}
    />
  );
}

export function IiotFilterRulesPanel({ lang, rigId, userId, live, intervalMs, onChanged }: IiotPanelProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canIiotAccess(userId, "iiot.filter.edit", rigId);
  const rules = usePanelData(() => iiotListFilterRules(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const rows = (rules.data?.filterRules ?? []) as IiotSignalFilterRule[];

  const fields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام قاعده", "Rule name"), required: true, maxLength: 240, fullWidth: true },
    { name: "AppliesToSignals", label: tr("سیگنال‌ها (با کاما)", "Signals (comma-separated)"), required: true, maxLength: 400, ltr: true, fullWidth: true, placeholder: "rpm, torque" },
    { name: "FilterMethod", label: tr("روش", "Method"), type: "select", required: true, options: opts(FILTER_METHODS) },
    { name: "WindowSeconds", label: tr("پنجره (ثانیه)", "Window (s)"), type: "number", min: 0, ltr: true },
    { name: "EmaAlpha", label: tr("ضریب EMA", "EMA alpha"), type: "number", min: 0, max: 1, ltr: true },
    { name: "MinSamples", label: tr("حداقل نمونه", "Min samples"), type: "number", integer: true, min: 1, ltr: true },
    { name: "DeadbandPct", label: tr("باند مرده %", "Deadband %"), type: "number", min: 0, max: 100, ltr: true },
    { name: "SpikeZThreshold", label: tr("آستانهٔ Z جهش", "Spike Z threshold"), type: "number", min: 0, ltr: true },
    { name: "FlatlineSeconds", label: tr("ثانیهٔ ثابت‌ماندن", "Flatline (s)"), type: "number", integer: true, min: 0, ltr: true },
    { name: "IsDefault", label: tr("پیش‌فرض", "Default"), type: "checkbox" },
    { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];
  const createFields: FormFieldDef[] = [{ name: "RuleCode", label: tr("کد قاعده", "Rule code"), required: true, maxLength: 60, ltr: true }, ...fields];

  const columns: GridColumnDef<IiotSignalFilterRule>[] = [
    { key: "RuleCode", header: tr("کد", "Code"), ltr: true } as GridColumnDef<IiotSignalFilterRule>,
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "AppliesToSignals", header: tr("سیگنال‌ها", "Signals"), ltr: true },
    { key: "FilterMethod", header: tr("روش", "Method"), filter: "auto" },
    { key: "WindowSeconds", header: tr("پنجره (s)", "Window (s)"), align: "center", ltr: true },
    { key: "IsDefault", header: tr("پیش‌فرض", "Default"), accessor: (row) => (row.IsDefault ? "true" : "false"), render: (row) => (row.IsDefault ? tr("بله", "Yes") : tr("خیر", "No")) },
  ];

  return (
    <CrudResource<IiotSignalFilterRule>
      fa={fa}
      caption={tr("قواعد فیلتر سیگنال", "Signal filter rules")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={rules.loading}
      error={rules.error}
      onRetry={rules.refresh}
      onChanged={() => { rules.refresh(); onChanged(); }}
      describeError={describeIiotError}
      emptyText={tr("قاعدهٔ فیلتری تعریف نشده است", "No filter rule defined")}
      create={{
        title: tr("قاعدهٔ فیلتر جدید", "New filter rule"),
        fields: createFields,
        defaults: { FilterMethod: "sma", IsDefault: "false", IsActive: "true" },
        allowed,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.filter.edit`,
        submit: (payload) => iiotCreateFilterRule(rigId, payload, { userId }),
        successText: tr("قاعده ثبت شد.", "Rule created."),
      }}
      edit={{
        title: tr("ویرایش قاعدهٔ فیلتر", "Edit filter rule"),
        fields,
        allowed,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.filter.edit`,
        submit: (row, payload) => iiotPatchFilterRule(rigId, row.Id, { ...payload, RowVersion: row.RowVersion }, { userId }),
      }}
      actions={() => [toggleAction<IiotSignalFilterRule>(fa, allowed, "iiot.filter.edit", (row, body) => iiotPatchFilterRule(rigId, row.Id, body, { userId }))]}
    />
  );
}

/* ═══════════════════════ ۳. آستانه‌ها و قواعد تشخیص ═══════════════════════ */

export function IiotThresholdRulesPanel({ lang, rigId, userId, live, intervalMs, onChanged, refs }: IiotPanelProps & {
  refs: { cmmsSiteRef?: string | null; mesWorkCenterRef?: string | null; pmisProjectRef?: string | null };
}) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canEdit = canIiotAccess(userId, "iiot.threshold.edit", rigId);
  const rules = usePanelData(() => iiotListThresholdRules(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const channels = usePanelData(() => iiotListChannels(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const channelOptions = (channels.data?.channels ?? []).map((c) => ({ value: c.Id, label: `${c.ChannelCode} — ${c.NameFa}` }));
  const channelCodeById = new Map((channels.data?.channels ?? []).map((c) => [c.Id, c.ChannelCode]));
  const rows = (rules.data?.thresholdRules ?? []) as IiotThresholdRule[];

  const fields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام قاعده", "Rule name"), required: true, maxLength: 240, fullWidth: true },
    { name: "Level", label: tr("سطح", "Level"), type: "select", required: true, options: opts(LEVELS) },
    { name: "DetectKind", label: tr("نوع تشخیص", "Detection"), type: "select", options: opts(DETECT_KINDS) },
    { name: "Comparison", label: tr("مقایسه", "Comparison"), type: "select", options: opts(COMPARISONS) },
    { name: "ThresholdValue", label: tr("مقدار آستانه", "Threshold"), type: "number", required: true, ltr: true },
    { name: "SecondaryValue", label: tr("مقدار ثانویه (باند)", "Secondary value (band)"), type: "number", ltr: true },
    { name: "DurationSeconds", label: tr("مدت (ثانیه)", "Duration (s)"), type: "number", integer: true, min: 0, ltr: true },
    { name: "MinSamples", label: tr("حداقل نمونه", "Min samples"), type: "number", integer: true, min: 1, ltr: true },
    { name: "HysteresisPct", label: tr("هیسترزیس %", "Hysteresis %"), type: "number", min: 0, max: 100, ltr: true },
    { name: "CooldownSeconds", label: tr("فاصلهٔ خاموشی (ثانیه)", "Cooldown (s)"), type: "number", integer: true, min: 0, ltr: true },
    { name: "AutoDispatch", label: tr("ارسال خودکار", "Auto-dispatch"), type: "checkbox" },
    { name: "DispatchTargets", label: tr("مقصدها", "Dispatch targets"), maxLength: 80, ltr: true, placeholder: DISPATCH_TARGETS_HINT, hint: DISPATCH_TARGETS_HINT },
    { name: "CmmsSiteRef", label: tr("ارجاع سایت CMMS", "CMMS site ref"), maxLength: 60, ltr: true },
    { name: "CmmsAssetRef", label: tr("ارجاع تجهیز CMMS", "CMMS asset ref"), maxLength: 60, ltr: true },
    { name: "MesWorkCenterRef", label: tr("ارجاع مرکز کاری MES", "MES work center"), maxLength: 60, ltr: true },
    { name: "PmisProjectRef", label: tr("ارجاع پروژهٔ PMIS", "PMIS project"), maxLength: 60, ltr: true },
    { name: "NptCode", label: tr("کد NPT", "NPT code"), maxLength: 40, ltr: true },
    { name: "EscalationNoteFa", label: tr("یادداشت تشدید", "Escalation note"), type: "textarea", maxLength: 600, fullWidth: true },
    { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];
  const createFields: FormFieldDef[] = [
    { name: "RuleCode", label: tr("کد قاعده", "Rule code"), required: true, maxLength: 60, ltr: true },
    { name: "ChannelId", label: tr("کانال", "Channel"), type: "select", required: true, options: channelOptions, fullWidth: true },
    ...fields,
  ];

  const columns: GridColumnDef<IiotThresholdRule>[] = [
    { key: "RuleCode", header: tr("کد", "Code"), ltr: true } as GridColumnDef<IiotThresholdRule>,
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "Channel", header: tr("کانال", "Channel"), accessor: (row) => channelCodeById.get(row.ChannelId) ?? "", filter: "auto", ltr: true } as GridColumnDef<IiotThresholdRule>,
    { key: "Level", header: tr("سطح", "Level"), filter: opts(LEVELS) },
    { key: "DetectKind", header: tr("تشخیص", "Detection"), filter: "auto" },
    { key: "Comparison", header: tr("مقایسه", "Comparison"), align: "center", ltr: true },
    { key: "ThresholdValue", header: tr("آستانه", "Threshold"), align: "center", ltr: true },
    {
      key: "IsActive", header: tr("فعال", "Active"),
      accessor: (row) => (row.IsActive ? "true" : "false"),
      render: (row) => (row.IsActive ? tr("فعال", "Active") : tr("غیرفعال", "Inactive")),
      filter: [{ value: "true", label: tr("فعال", "Active") }, { value: "false", label: tr("غیرفعال", "Inactive") }],
    },
  ];

  return (
    <CrudResource<IiotThresholdRule>
      fa={fa}
      caption={tr("آستانه‌ها و قواعد تشخیص", "Thresholds & detection rules")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={rules.loading}
      error={rules.error}
      onRetry={rules.refresh}
      onChanged={() => { rules.refresh(); onChanged(); }}
      describeError={describeIiotError}
      emptyText={tr("قاعدهٔ آستانه‌ای تعریف نشده است", "No threshold rule defined")}
      create={{
        title: tr("قاعدهٔ آستانه جدید", "New threshold rule"),
        fields: createFields,
        defaults: {
          Level: "warning", DetectKind: "threshold", Comparison: "gt", ThresholdValue: "100", DurationSeconds: "20", MinSamples: "5",
          CooldownSeconds: "60", AutoDispatch: "false", IsActive: "true",
          CmmsSiteRef: refs.cmmsSiteRef ?? "", MesWorkCenterRef: refs.mesWorkCenterRef ?? "", PmisProjectRef: refs.pmisProjectRef ?? "",
        },
        allowed: canEdit,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.threshold.edit`,
        submit: (payload) => iiotCreateThresholdRule(rigId, payload, { userId }),
        successText: tr("قاعده ثبت شد.", "Rule created."),
      }}
      edit={{
        title: tr("ویرایش قاعدهٔ آستانه", "Edit threshold rule"),
        fields,
        allowed: canEdit,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.threshold.edit`,
        submit: (row, payload) => iiotPatchThresholdRule(rigId, row.Id, { ...payload, RowVersion: row.RowVersion }, { userId }),
      }}
      actions={(row) => [
        {
          key: "test",
          label: tr("آزمایش", "Test"),
          tone: "primary",
          disabled: () => !canEdit,
          title: canEdit ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.threshold.edit`,
          successText: (_row, result) => {
            const data = result as { wouldFire?: boolean; reason?: string } | null;
            return data?.wouldFire === false
              ? tr("آزمایش: این قاعده در وضعیت فعلی شلیک نمی‌کند.", "Test: this rule would not fire with the current data.")
              : tr("آزمایش انجام شد.", "Test completed.");
          },
          run: () => iiotTestThresholdRule(rigId, row.Id, { userId }),
        },
        toggleAction<IiotThresholdRule>(fa, canEdit, "iiot.threshold.edit", (r, body) => iiotPatchThresholdRule(rigId, r.Id, body, { userId })),
      ]}
    />
  );
}

/* ═══════════════════════ ۴. گیت‌وی‌های لبه ═══════════════════════ */

export function IiotGatewaysPanel({ lang, rigId, userId, live, intervalMs, onChanged }: IiotPanelProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canEdit = canIiotAccess(userId, "iiot.gateway.edit", rigId);
  const canIngest = canIiotAccess(userId, "iiot.telemetry.ingest", rigId);
  const gateways = usePanelData(() => iiotListGateways(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const rows = (gateways.data?.gateways ?? []) as IiotEdgeGateway[];

  const fields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام گیت‌وی", "Gateway name"), required: true, maxLength: 240, fullWidth: true },
    { name: "Protocol", label: tr("پروتکل", "Protocol"), type: "select", required: true, options: opts(TRANSPORTS) },
    { name: "SyncMode", label: tr("حالت همگام‌سازی", "Sync mode"), type: "select", options: opts(SYNC_MODES) },
    { name: "BufferCapacity", label: tr("ظرفیت بافر", "Buffer capacity"), type: "number", integer: true, min: 1, ltr: true },
    { name: "MaxBatchSize", label: tr("بیشینهٔ اندازهٔ دسته", "Max batch size"), type: "number", integer: true, min: 1, ltr: true },
    { name: "MaxAttempts", label: tr("بیشینهٔ تلاش", "Max attempts"), type: "number", integer: true, min: 1, ltr: true },
    { name: "HeartbeatIntervalSeconds", label: tr("فاصلهٔ ضربان (ثانیه)", "Heartbeat (s)"), type: "number", integer: true, min: 1, ltr: true },
    { name: "ConnectionState", label: tr("وضعیت اتصال", "Connection"), type: "select", options: opts(CONNECTION_STATES) },
    { name: "FirmwareVersion", label: tr("نسخهٔ firmware", "Firmware"), maxLength: 60, ltr: true },
    { name: "IpAddress", label: tr("آدرس IP", "IP address"), maxLength: 60, ltr: true },
    { name: "LocationFa", label: tr("محل نصب", "Location"), maxLength: 240 },
    { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];
  const createFields: FormFieldDef[] = [
    { name: "GatewayCode", label: tr("کد گیت‌وی", "Gateway code"), required: true, maxLength: 60, ltr: true },
    { name: "AuthMode", label: tr("احراز هویت", "Auth mode"), type: "select", options: opts(AUTH_MODES) },
    { name: "InstalledAt", label: tr("زمان نصب", "Installed at"), type: "datetime" },
    ...fields,
  ];

  const columns: GridColumnDef<IiotEdgeGateway>[] = [
    { key: "GatewayCode", header: tr("کد", "Code"), ltr: true } as GridColumnDef<IiotEdgeGateway>,
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "Protocol", header: tr("پروتکل", "Protocol"), filter: "auto" },
    { key: "SyncMode", header: tr("همگام‌سازی", "Sync"), filter: "auto" },
    { key: "ConnectionState", header: tr("اتصال", "Link"), filter: opts(CONNECTION_STATES) },
    {
      key: "buffer", header: tr("بافر", "Buffer"), align: "center", ltr: true,
      accessor: (row) => Number(row.BufferUsed ?? 0),
      render: (row) => `${Number(row.BufferUsed ?? 0)} / ${Number(row.BufferCapacity ?? 0)}`,
    },
    {
      key: "LastHeartbeatAt", header: tr("آخرین ضربان", "Last heartbeat"), ltr: true,
      accessor: (row) => (row.LastHeartbeatAt ? String(row.LastHeartbeatAt).slice(0, 16).replace("T", " ") : ""),
    },
  ];

  return (
    <CrudResource<IiotEdgeGateway>
      fa={fa}
      caption={tr("گیت‌وی‌های لبه", "Edge gateways")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={gateways.loading}
      error={gateways.error}
      onRetry={gateways.refresh}
      onChanged={() => { gateways.refresh(); onChanged(); }}
      describeError={describeIiotError}
      emptyText={tr("گیت‌وی لبه‌ای ثبت نشده است", "No edge gateway registered")}
      create={{
        title: tr("گیت‌وی لبهٔ جدید", "New edge gateway"),
        fields: createFields,
        defaults: { Protocol: "mqtt", SyncMode: "store-forward", AuthMode: "token", BufferCapacity: "1000", MaxBatchSize: "200", MaxAttempts: "5", HeartbeatIntervalSeconds: "30", IsActive: "true" },
        allowed: canEdit,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.gateway.edit`,
        submit: (payload) => iiotCreateGateway(rigId, { ...payload, InstalledAt: dayToIsoDateTime(payload.InstalledAt) ?? undefined }, { userId }),
        successText: tr("گیت‌وی ثبت شد.", "Gateway created."),
      }}
      edit={{
        title: tr("ویرایش گیت‌وی", "Edit gateway"),
        fields,
        allowed: canEdit,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.gateway.edit`,
        submit: (row, payload) => iiotPatchGateway(rigId, row.Id, { ...payload, RowVersion: row.RowVersion }, { userId }),
      }}
      actions={(row) => [
        {
          key: "heartbeat",
          label: tr("ضربان", "Heartbeat"),
          tone: "primary",
          disabled: () => !canIngest,
          title: canIngest ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.telemetry.ingest`,
          successText: tr("ضربان ثبت شد.", "Heartbeat recorded."),
          run: () => iiotGatewayHeartbeat(rigId, row.Id, { connectionState: "online", bufferUsed: Number(row.BufferUsed ?? 0) }, { userId }),
        },
        toggleAction<IiotEdgeGateway>(fa, canEdit, "iiot.gateway.edit", (r, body) => iiotPatchGateway(rigId, r.Id, body, { userId })),
      ]}
    />
  );
}

/* ═══════════════════════ ۵. بافر لبه (Store-and-Forward) ═══════════════════════ */

export function IiotBufferPanel({ lang, rigId, userId, live, intervalMs, onChanged, gatewayId, onGatewayChange }: IiotPanelProps & {
  gatewayId: string;
  onGatewayChange: (id: string) => void;
}) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canSync = canIiotAccess(userId, "iiot.buffer.sync", rigId);
  const gateways = usePanelData(() => iiotListGateways(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const gatewayRows = gateways.data?.gateways ?? [];
  const activeId = gatewayId || gatewayRows[0]?.Id || "";
  const buffer = usePanelData(
    () => (activeId ? iiotListBuffer(rigId, activeId, { userId }) : Promise.resolve({ buffer: [] as IiotGatewayBuffer[] })),
    [rigId, userId, activeId],
    { live, intervalMs },
  );
  const rows = ((buffer.data as { buffer?: IiotGatewayBuffer[] } | null)?.buffer ?? []) as IiotGatewayBuffer[];

  const columns: GridColumnDef<IiotGatewayBuffer>[] = [
    { key: "BatchNo", header: tr("دسته", "Batch"), ltr: true } as GridColumnDef<IiotGatewayBuffer>,
    { key: "Status", header: tr("وضعیت", "Status"), filter: opts(BUFFER_STATUSES) },
    { key: "SampleCount", header: tr("نمونه", "Samples"), align: "center", ltr: true },
    {
      key: "Attempts", header: tr("تلاش", "Attempts"), align: "center", ltr: true,
      accessor: (row) => Number(row.Attempts ?? 0),
      render: (row) => `${Number(row.Attempts ?? 0)}/${Number(row.MaxAttempts ?? 0)}`,
    },
    { key: "ErrorCode", header: tr("خطا", "Error"), ltr: true },
  ];

  return (
    <CrudResource<IiotGatewayBuffer>
      fa={fa}
      caption={tr("بافر گیت‌وی", "Gateway buffer")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={buffer.loading}
      error={buffer.error}
      onRetry={buffer.refresh}
      onChanged={() => { buffer.refresh(); onChanged(); }}
      describeError={describeIiotError}
      emptyText={activeId ? tr("بافر خالی است — همهٔ دسته‌ها تحویل شده‌اند.", "Buffer is empty — every batch delivered.") : tr("گیت‌وی انتخاب نشده است.", "No gateway selected.")}
      toolbarExtra={
        <select
          value={activeId}
          onChange={(event) => onGatewayChange(event.target.value)}
          className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
          dir="ltr"
          aria-label={tr("انتخاب گیت‌وی", "Select gateway")}
        >
          {gatewayRows.map((g) => <option key={g.Id} value={g.Id}>{g.GatewayCode} — {g.NameFa}</option>)}
        </select>
      }
      actions={(row) => [
        {
          key: "sync",
          label: tr("همگام‌سازی", "Sync"),
          tone: "ok",
          hidden: () => row.Status === "sent",
          disabled: () => !canSync,
          title: canSync ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.buffer.sync`,
          successText: tr("دسته تحویل شد.", "Batch delivered."),
          run: () => iiotSyncBuffer(rigId, activeId, row.Id, { delivered: true, ackRef: "dashboard-manual" }, { userId }),
        },
        {
          key: "fail",
          label: tr("ثبت شکست", "Mark failed"),
          tone: "warn",
          hidden: () => row.Status === "sent",
          disabled: () => !canSync,
          title: canSync ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.buffer.sync`,
          successText: tr("تحویل ناموفق ثبت شد.", "Failed delivery recorded."),
          run: () => iiotSyncBuffer(rigId, activeId, row.Id, { delivered: false, errorCode: "E-NET-LINK", errorFa: "لینک دکل در دسترس نیست" }, { userId }),
        },
      ]}
    />
  );
}

/* ═══════════════════════ ۶. سنسورها و کالیبراسیون ═══════════════════════ */

export function IiotSensorsPanel({ lang, rigId, userId, live, intervalMs, onChanged }: IiotPanelProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canEdit = canIiotAccess(userId, "iiot.sensor.edit", rigId);
  const canCalibrate = canIiotAccess(userId, "iiot.sensor.calibrate", rigId);
  const sensors = usePanelData(() => iiotListSensors(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const gateways = usePanelData(() => iiotListGateways(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const gatewayOptions = (gateways.data?.gateways ?? []).map((g) => ({ value: g.Id, label: `${g.GatewayCode} — ${g.NameFa}` }));
  const rows = (sensors.data?.sensors ?? []) as IiotSensorNode[];

  const fields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام سنسور", "Sensor name"), required: true, maxLength: 240, fullWidth: true },
    { name: "SensorType", label: tr("نوع سنسور", "Sensor type"), required: true, maxLength: 40, ltr: true },
    { name: "Manufacturer", label: tr("سازنده", "Manufacturer"), maxLength: 160 },
    { name: "ModelNo", label: tr("مدل", "Model"), maxLength: 120, ltr: true },
    { name: "SerialNo", label: tr("سریال", "Serial"), maxLength: 120, ltr: true },
    { name: "RangeMin", label: tr("کمینهٔ دامنه", "Range min"), type: "number", ltr: true },
    { name: "RangeMax", label: tr("بیشینهٔ دامنه", "Range max"), type: "number", ltr: true },
    { name: "Unit", label: tr("واحد", "Unit"), maxLength: 24, ltr: true },
    { name: "AccuracyPct", label: tr("دقت %", "Accuracy %"), type: "number", min: 0, max: 100, ltr: true },
    { name: "GatewayId", label: tr("گیت‌وی", "Gateway"), type: "select", options: gatewayOptions },
    { name: "LocationFa", label: tr("محل نصب", "Location"), maxLength: 240 },
    { name: "CalibrationIntervalDays", label: tr("دورهٔ کالیبراسیون (روز)", "Calibration interval (days)"), type: "number", integer: true, min: 1, max: 3650, ltr: true },
    { name: "Status", label: tr("وضعیت", "Status"), type: "select", options: opts(SENSOR_STATUS) },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];
  const createFields: FormFieldDef[] = [
    { name: "SensorTag", label: tr("برچسب سنسور", "Sensor tag"), required: true, maxLength: 60, ltr: true },
    { name: "InstalledAt", label: tr("زمان نصب", "Installed at"), type: "datetime" },
    ...fields,
  ];

  const columns: GridColumnDef<IiotSensorNode>[] = [
    { key: "SensorTag", header: tr("برچسب", "Tag"), ltr: true } as GridColumnDef<IiotSensorNode>,
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "SensorType", header: tr("نوع", "Type"), filter: "auto" },
    { key: "Status", header: tr("وضعیت", "Status"), filter: opts(SENSOR_STATUS) },
    {
      key: "range", header: tr("دامنه", "Range"), ltr: true,
      accessor: (row) => Number(row.RangeMax ?? 0) - Number(row.RangeMin ?? 0),
      render: (row) => (row.RangeMin == null && row.RangeMax == null ? "—" : `${row.RangeMin ?? "—"} … ${row.RangeMax ?? "—"} ${row.Unit ?? ""}`),
    },
    { key: "LastCalibratedAt", header: tr("آخرین کالیبراسیون", "Last calibrated"), ltr: true, accessor: (row) => (row.LastCalibratedAt ? String(row.LastCalibratedAt).slice(0, 10) : "") },
    {
      key: "calibrationOverdue", header: tr("سررسید", "Due"),
      accessor: (row) => (row.calibrationOverdue ? "overdue" : "ok"),
      render: (row) => (row.calibrationOverdue ? tr("گذشته", "Overdue") : tr("به‌موقع", "On time")),
      filter: [{ value: "overdue", label: tr("گذشته", "Overdue") }, { value: "ok", label: tr("به‌موقع", "On time") }],
    },
  ];

  return (
    <CrudResource<IiotSensorNode>
      fa={fa}
      caption={tr("سنسورها و کالیبراسیون", "Sensors & calibration")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={sensors.loading}
      error={sensors.error}
      onRetry={sensors.refresh}
      onChanged={() => { sensors.refresh(); onChanged(); }}
      describeError={describeIiotError}
      emptyText={tr("سنسوری ثبت نشده است", "No sensor registered")}
      create={{
        title: tr("سنسور جدید", "New sensor"),
        fields: createFields,
        defaults: { Status: "active" },
        allowed: canEdit,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.sensor.edit`,
        submit: (payload) => iiotCreateSensor(rigId, { ...payload, InstalledAt: dayToIsoDateTime(payload.InstalledAt) ?? undefined }, { userId }),
        successText: tr("سنسور ثبت شد.", "Sensor created."),
      }}
      edit={{
        title: tr("ویرایش سنسور", "Edit sensor"),
        fields,
        allowed: canEdit,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.sensor.edit`,
        submit: (row, payload) => iiotPatchSensor(rigId, row.Id, { ...payload, RowVersion: row.RowVersion }, { userId }),
      }}
      actions={(row) => [
        {
          key: "calibrate",
          label: tr("کالیبراسیون", "Calibrate"),
          tone: "primary",
          hidden: () => row.Status === "removed",
          disabled: () => !canCalibrate,
          title: canCalibrate ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.sensor.calibrate`,
          form: {
            title: tr("ثبت کالیبراسیون", "Record calibration"),
            submitLabel: tr("ثبت کالیبراسیون", "Record"),
            fields: [
              { name: "calibratedAt", label: tr("زمان کالیبراسیون", "Calibrated at"), type: "datetime", required: true },
              { name: "CertificateNo", label: tr("شمارهٔ گواهی", "Certificate no."), required: true, maxLength: 120, ltr: true },
              { name: "ResultFa", label: tr("نتیجه", "Result"), type: "textarea", maxLength: 600, fullWidth: true },
            ],
            initialValues: () => ({ calibratedAt: new Date().toISOString() }),
          },
          successText: tr("کالیبراسیون ثبت شد.", "Calibration recorded."),
          run: (_r, input) => calibrate(rigId, row.Id, {
            calibratedAt: input.calibratedAt ? String(input.calibratedAt) : undefined,
            certificateNo: input.CertificateNo ? String(input.CertificateNo) : undefined,
            resultFa: input.ResultFa ? String(input.ResultFa) : undefined,
            RowVersion: row.RowVersion,
          }, { userId }),
        },
        {
          key: "retire",
          label: tr("خروج از سرویس", "Retire"),
          tone: "danger",
          hidden: (r) => r.Status === "removed",
          disabled: () => !canEdit,
          title: canEdit ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.sensor.edit`,
          confirm: {
            title: tr("خروج سنسور از سرویس", "Retire sensor"),
            message: tr("وضعیت سنسور «removed» می‌شود و رکورد و سابقه حفظ می‌شود.", "The sensor is marked 'removed'; the record and its history are kept."),
            confirmLabel: tr("خروج از سرویس", "Retire"),
            danger: true,
          },
          successText: tr("سنسور از سرویس خارج شد.", "Sensor retired."),
          run: () => iiotPatchSensor(rigId, row.Id, { Status: "removed", RowVersion: row.RowVersion }, { userId }),
        },
      ]}
    />
  );
}

/* ═══════════════════════ ۷. قرائت‌های پایش وضعیت ═══════════════════════ */

export function IiotConditionPanel({ lang, rigId, userId, live, intervalMs, onChanged }: IiotPanelProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canRecord = canIiotAccess(userId, "iiot.condition.record", rigId);
  const snapshots = usePanelData(() => iiotListConditionSnapshots(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const rows = (snapshots.data?.snapshots ?? []) as IiotConditionSnapshot[];

  const fields: FormFieldDef[] = [
    { name: "ReadingType", label: tr("نوع قرائت", "Reading type"), type: "select", required: true, options: opts(READING_TYPES) },
    { name: "Value", label: tr("مقدار", "Value"), type: "number", required: true, ltr: true },
    { name: "Uom", label: tr("واحد", "Unit"), required: true, maxLength: 24, ltr: true, placeholder: "mm/s" },
    { name: "Zone", label: tr("ناحیه (ISO 10816)", "Zone (ISO 10816)"), type: "select", options: opts(ZONES) },
    { name: "MeasuredAt", label: tr("زمان اندازه‌گیری", "Measured at"), type: "datetime" },
    { name: "HealthIndex", label: tr("شاخص سلامت (۰–۱۰۰)", "Health index (0–100)"), type: "number", min: 0, max: 100, ltr: true },
    { name: "TrendDirection", label: tr("روند", "Trend"), type: "select", options: opts(TRENDS) },
    { name: "RateOfChange", label: tr("نرخ تغییر", "Rate of change"), type: "number", ltr: true },
    { name: "SensorTag", label: tr("برچسب سنسور", "Sensor tag"), maxLength: 60, ltr: true },
    { name: "CmmsAssetRef", label: tr("ارجاع تجهیز CMMS", "CMMS asset ref"), maxLength: 60, ltr: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<IiotConditionSnapshot>[] = [
    {
      key: "MeasuredAt", header: tr("زمان", "Measured"), ltr: true,
      accessor: (row) => (row.MeasuredAt ? String(row.MeasuredAt).slice(0, 16).replace("T", " ") : ""),
    },
    { key: "ReadingType", header: tr("نوع", "Type"), filter: opts(READING_TYPES) },
    { key: "SensorTag", header: tr("سنسور", "Sensor"), ltr: true } as GridColumnDef<IiotConditionSnapshot>,
    { key: "Value", header: tr("مقدار", "Value"), align: "center", ltr: true },
    { key: "Uom", header: tr("واحد", "Unit"), ltr: true },
    { key: "Zone", header: tr("ناحیه", "Zone"), filter: opts(ZONES) },
    { key: "HealthIndex", header: tr("سلامت", "Health"), align: "center", ltr: true },
    { key: "TrendDirection", header: tr("روند", "Trend"), filter: opts(TRENDS) },
    {
      key: "ReportedToCmms", header: tr("ارسال به CMMS", "Sent to CMMS"),
      accessor: (row) => (row.ReportedToCmms ? "true" : "false"),
      render: (row) => (row.ReportedToCmms ? tr("بله", "Yes") : tr("خیر", "No")),
      filter: [{ value: "true", label: tr("بله", "Yes") }, { value: "false", label: tr("خیر", "No") }],
    },
  ];

  return (
    <CrudResource<IiotConditionSnapshot>
      fa={fa}
      caption={tr("قرائت‌های پایش وضعیت", "Condition readings")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={snapshots.loading}
      error={snapshots.error}
      onRetry={snapshots.refresh}
      onChanged={() => { snapshots.refresh(); onChanged(); }}
      describeError={describeIiotError}
      emptyText={tr("قرائتی ثبت نشده است", "No readings recorded")}
      viewFields={fields}
      create={{
        title: tr("ثبت قرائت پایش وضعیت (ISO 10816)", "Record condition reading (ISO 10816)"),
        fields,
        defaults: { ReadingType: "vibration", Uom: "mm/s", Zone: "B", TrendDirection: "stable" },
        allowed: canRecord,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.condition.record`,
        submit: (payload) => iiotCreateConditionSnapshot(rigId, { ...payload, MeasuredAt: dayToIsoDateTime(payload.MeasuredAt) ?? undefined }, { userId }),
        successText: tr("قرائت ثبت شد.", "Reading recorded."),
      }}
    />
  );
}

/* ═══════════════════════ ۸. هشدارهای تله‌متری ═══════════════════════ */

export function IiotAlertsPanel({ lang, rigId, userId, live, intervalMs, onChanged }: IiotPanelProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canAck = canIiotAccess(userId, "iiot.alert.ack", rigId);
  const canResolve = canIiotAccess(userId, "iiot.alert.resolve", rigId);
  const canDispatch = canIiotAccess(userId, "iiot.alert.dispatch", rigId);
  const alerts = usePanelData(() => iiotListAlerts(rigId, { limit: 300 }, { userId }), [rigId, userId], { live, intervalMs });
  const rows = (alerts.data?.alerts ?? []) as IiotTelemetryAlert[];

  const columns: GridColumnDef<IiotTelemetryAlert>[] = [
    { key: "AlertCode", header: tr("کد", "Code"), ltr: true } as GridColumnDef<IiotTelemetryAlert>,
    { key: "Level", header: tr("سطح", "Level"), filter: opts(LEVELS) },
    { key: "TitleFa", header: tr("عنوان", "Title") },
    { key: "Status", header: tr("وضعیت", "Status"), filter: opts(ALERT_STATUSES) },
    { key: "DetectionKind", header: tr("تشخیص", "Detection"), filter: "auto" },
    { key: "DetectedAt", header: tr("زمان تشخیص", "Detected"), ltr: true, accessor: (row) => String(row.DetectedAt ?? "").slice(0, 16).replace("T", " ") },
    { key: "DispatchStatus", header: tr("ارسال", "Dispatch"), filter: "auto" },
  ];

  return (
    <CrudResource<IiotTelemetryAlert>
      fa={fa}
      caption={tr("هشدارهای تله‌متری", "Telemetry alerts")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={alerts.loading}
      error={alerts.error}
      onRetry={alerts.refresh}
      onChanged={() => { alerts.refresh(); onChanged(); }}
      describeError={describeIiotError}
      emptyText={tr("هشداری ثبت نشده است", "No alerts")}
      viewFields={[
        { name: "AlertCode", label: tr("کد", "Code") },
        { name: "TitleFa", label: tr("عنوان", "Title") },
        { name: "MessageFa", label: tr("شرح", "Message") },
        { name: "Level", label: tr("سطح", "Level") },
        { name: "Status", label: tr("وضعیت", "Status") },
        { name: "TriggerValue", label: tr("مقدار فعال‌ساز", "Trigger value") },
        { name: "DurationSeconds", label: tr("مدت (ثانیه)", "Duration (s)") },
        { name: "DispatchStatus", label: tr("وضعیت ارسال", "Dispatch") },
      ]}
      actions={(row) => {
        const open = row.Status === "active" || row.Status === "acknowledged";
        return [
          {
            key: "ack",
            label: tr("تأیید", "Acknowledge"),
            tone: "primary",
            hidden: () => row.Status !== "active",
            disabled: () => !canAck,
            title: canAck ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.alert.ack`,
            form: { title: tr("تأیید هشدار", "Acknowledge alert"), submitLabel: tr("تأیید", "Acknowledge"), fields: [{ name: "NoteFa", label: tr("یادداشت (اختیاری)", "Note (optional)"), type: "textarea", maxLength: 600, fullWidth: true }] },
            successText: tr("هشدار تأیید شد.", "Alert acknowledged."),
            run: (_r, input) => iiotAcknowledgeAlert(rigId, row.Id, input.NoteFa ? { NoteFa: String(input.NoteFa) } : {}, { userId }),
          },
          {
            key: "resolve",
            label: tr("بستن", "Resolve"),
            tone: "ok",
            hidden: () => !open,
            disabled: () => !canResolve,
            title: canResolve ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.alert.resolve`,
            confirm: { title: tr("بستن هشدار", "Resolve alert"), message: tr("شرح اقدام رفع را بنویسید.", "Describe the corrective action."), confirmLabel: tr("بستن هشدار", "Resolve"), reason: { label: tr("دلیل و اقدام رفع", "Resolution note"), required: true } },
            successText: tr("هشدار بسته شد.", "Alert resolved."),
            run: (_r, input) => iiotResolveAlert(rigId, row.Id, { ResolutionNoteFa: String(input.reason ?? "") }, { userId }),
          },
          {
            key: "falsePositive",
            label: tr("هشدار کاذب", "False positive"),
            tone: "warn",
            hidden: () => !open,
            disabled: () => !canResolve,
            title: canResolve ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.alert.resolve`,
            confirm: { title: tr("ثبت هشدار کاذب", "Mark false positive"), message: tr("توقف خودکار مرتبط برگشت داده می‌شود.", "The related automatic downtime is reverted."), confirmLabel: tr("ثبت کاذب", "Mark false positive"), reason: { label: tr("دلیل هشدار کاذب", "False-positive reason"), required: true } },
            successText: tr("هشدار کاذب ثبت شد و توقف خودکار برگشت.", "Marked false positive; automatic downtime reverted."),
            run: (_r, input) => iiotFalsePositiveAlert(rigId, row.Id, { SuppressedReasonFa: String(input.reason ?? "") }, { userId }),
          },
          {
            key: "dispatch",
            label: tr("ارسال", "Dispatch"),
            tone: "danger",
            disabled: () => !canDispatch,
            title: canDispatch ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.alert.dispatch`,
            confirm: { title: tr("ارسال هشدار", "Dispatch alert"), message: tr("هشدار به CMMS/MES/PMIS ارسال می‌شود.", "The alert is sent to CMMS/MES/PMIS."), confirmLabel: tr("ارسال", "Dispatch") },
            successText: tr("هشدار به سامانه‌های مقصد ارسال شد.", "Alert dispatched to downstream systems."),
            run: () => iiotDispatchAlert(rigId, row.Id, {}, { userId }),
          },
        ];
      }}
    />
  );
}

/* ═══════════════════════ ۹. توقف‌های دکل و NPT ═══════════════════════ */

export function IiotDowntimePanel({ lang, rigId, userId, live, intervalMs, onChanged }: IiotPanelProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canReport = canIiotAccess(userId, "iiot.downtime.report", rigId);
  const canVerify = canIiotAccess(userId, "iiot.downtime.verify", rigId);
  const downtime = usePanelData(() => iiotListDowntime(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const rows = (downtime.data?.downtime ?? []) as IiotRigDowntime[];

  const fields: FormFieldDef[] = [
    { name: "Category", label: tr("دسته", "Category"), type: "select", required: true, options: opts(DOWNTIME_CATEGORIES) },
    { name: "DowntimeType", label: tr("نوع توقف", "Downtime type"), type: "select", options: opts(DOWNTIME_TYPES) },
    { name: "CauseFa", label: tr("علت", "Cause"), type: "textarea", required: true, maxLength: 600, fullWidth: true },
    { name: "EffectFa", label: tr("اثر", "Effect"), type: "textarea", maxLength: 600, fullWidth: true },
    { name: "StartedAt", label: tr("آغاز", "Started at"), type: "datetime", required: true },
    { name: "EndedAt", label: tr("پایان", "Ended at"), type: "datetime" },
    { name: "IsNpt", label: tr("زمان نامولّد (NPT)", "Non-productive (NPT)"), type: "checkbox" },
    { name: "NptCode", label: tr("کد NPT", "NPT code"), maxLength: 40, ltr: true },
    { name: "ResponsibilityFa", label: tr("مسئولیت", "Responsibility"), maxLength: 240 },
    { name: "ShiftName", label: tr("شیفت", "Shift"), maxLength: 40 },
    { name: "RecoverableMinutes", label: tr("دقیقهٔ قابل بازیافت", "Recoverable minutes"), type: "number", min: 0, ltr: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<IiotRigDowntime>[] = [
    { key: "DowntimeCode", header: tr("کد", "Code"), ltr: true } as GridColumnDef<IiotRigDowntime>,
    { key: "Category", header: tr("دسته", "Category"), filter: opts(DOWNTIME_CATEGORIES) },
    { key: "CauseFa", header: tr("علت", "Cause") },
    { key: "StartedAt", header: tr("آغاز", "Started"), ltr: true, accessor: (row) => String(row.StartedAt ?? "").slice(0, 16).replace("T", " ") },
    { key: "DurationMinutes", header: tr("مدت (دقیقه)", "Minutes"), align: "center", ltr: true },
    {
      key: "IsNpt", header: "NPT",
      accessor: (row) => (row.IsNpt ? "true" : "false"),
      render: (row) => (row.IsNpt ? "NPT" : tr("—", "—")),
      filter: [{ value: "true", label: "NPT" }, { value: "false", label: tr("غیر NPT", "Non-NPT") }],
    },
    {
      key: "state", header: tr("وضعیت", "State"),
      accessor: (row) => (!row.EndedAt ? "open" : row.VerifiedAt ? "verified" : "closed"),
      render: (row) => (!row.EndedAt ? tr("باز", "Open") : row.VerifiedAt ? tr("تأییدشده", "Verified") : tr("بسته (منتظر تأیید)", "Closed (unverified)")),
      filter: [
        { value: "open", label: tr("باز", "Open") },
        { value: "closed", label: tr("بسته (منتظر تأیید)", "Closed (unverified)") },
        { value: "verified", label: tr("تأییدشده", "Verified") },
      ],
    },
  ];

  return (
    <CrudResource<IiotRigDowntime>
      fa={fa}
      caption={tr("توقف‌های دکل", "Rig downtime")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={downtime.loading}
      error={downtime.error}
      onRetry={downtime.refresh}
      onChanged={() => { downtime.refresh(); onChanged(); }}
      describeError={describeIiotError}
      emptyText={tr("توقفی ثبت نشده است", "No downtime recorded")}
      viewFields={fields}
      create={{
        title: tr("ثبت توقف جدید", "Report downtime"),
        fields,
        defaults: { Category: "equipment", DowntimeType: "non-productive", IsNpt: "true" },
        allowed: canReport,
        deniedTitle: `${tr("مجوز لازم", "Required permission")}: iiot.downtime.report`,
        submit: (payload) => iiotCreateDowntime(rigId, {
          ...payload,
          StartedAt: payload.StartedAt,
          EndedAt: payload.EndedAt ?? undefined,
        }, { userId }),
        successText: tr("توقف ثبت شد.", "Downtime reported."),
      }}
      actions={(row) => [
        {
          key: "close",
          label: tr("بستن توقف", "Close"),
          tone: "primary",
          hidden: () => Boolean(row.EndedAt),
          disabled: () => !canReport,
          title: canReport ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.downtime.report`,
          form: {
            title: tr("بستن توقف", "Close downtime"),
            submitLabel: tr("بستن", "Close"),
            fields: [{ name: "EndedAt", label: tr("پایان", "Ended at"), type: "datetime", required: true }],
            initialValues: () => ({ EndedAt: toLocalNow() }),
          },
          successText: tr("توقف بسته شد.", "Downtime closed."),
          run: (_r, input) => iiotCloseDowntime(rigId, row.Id, { EndedAt: String(input.EndedAt), RowVersion: row.RowVersion }, { userId }),
        },
        {
          key: "verify",
          label: tr("تأیید", "Verify"),
          tone: "ok",
          hidden: () => !row.EndedAt || Boolean(row.VerifiedAt),
          disabled: () => !canVerify,
          title: canVerify ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.downtime.verify`,
          confirm: {
            title: tr("تأیید توقف", "Verify downtime"),
            message: tr("پس از تأیید، NPT به MES/PMIS ارسال می‌شود (نه CMMS).", "After verification NPT is sent to MES/PMIS (not CMMS)."),
            confirmLabel: tr("تأیید", "Verify"),
            reason: { label: tr("یادداشت (اختیاری)", "Note (optional)"), required: false },
          },
          successText: tr("توقف تأیید شد و NPT به MES/PMIS رفت.", "Downtime verified; NPT released to MES/PMIS."),
          run: (_r, input) => iiotVerifyDowntime(rigId, row.Id, { ...(input.reason ? { NoteFa: String(input.reason) } : {}), RowVersion: row.RowVersion }, { userId }),
        },
      ]}
    />
  );
}

function toLocalNow(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/* ═══════════════════════ ۱۰. صف یکپارچگی بین‌بخشی ═══════════════════════ */

export function IiotEventsPanel({ lang, rigId, userId, live, intervalMs, onChanged }: IiotPanelProps) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canDispatch = canIiotAccess(userId, "iiot.integration.dispatch", rigId);
  const events = usePanelData(() => iiotListIntegrationEvents(rigId, { userId }), [rigId, userId], { live, intervalMs });
  const rows = ((events.data as { events?: IiotIntegrationEvent[] } | null)?.events ?? []) as IiotIntegrationEvent[];

  const columns: GridColumnDef<IiotIntegrationEvent>[] = [
    { key: "EventType", header: tr("رویداد", "Event"), ltr: true } as GridColumnDef<IiotIntegrationEvent>,
    { key: "TargetSystem", header: tr("مقصد", "Target"), filter: "auto" },
    { key: "Status", header: tr("وضعیت", "Status"), filter: opts(EVENT_STATUSES) },
    { key: "Attempts", header: tr("تلاش", "Attempts"), align: "center", ltr: true },
    { key: "ErrorCode", header: tr("خطا", "Error"), ltr: true },
  ];

  return (
    <CrudResource<IiotIntegrationEvent>
      fa={fa}
      caption={tr("صف یکپارچگی بین‌بخشی", "Cross-module event queue")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={events.loading}
      error={events.error}
      onRetry={events.refresh}
      onChanged={() => { events.refresh(); onChanged(); }}
      describeError={describeIiotError}
      emptyText={tr("رویدادی در صف نیست", "No queued events")}
      actions={(row) => [
        {
          key: "dispatch",
          label: tr("تحویل", "Deliver"),
          tone: "primary",
          hidden: () => row.Status === "dispatched",
          disabled: () => !canDispatch,
          title: canDispatch ? undefined : `${tr("مجوز لازم", "Required permission")}: iiot.integration.dispatch`,
          successText: tr("رویداد تحویل شد.", "Event delivered."),
          run: () => iiotDispatchEvent(rigId, row.Id, { userId }),
        },
      ]}
    />
  );
}

