/**
 * بخش‌های تعاملی CMMS: جدول با جستجو/فیلتر/مرتب‌سازی/صفحه‌بندی و ثبت/ویرایش/تغییر وضعیت.
 * ═══════════════════════════════════════════════════════════════════════
 * هر پنل داده‌اش را خودش می‌گیرد و پس از هر تغییر موفق، فهرست را دوباره می‌خواند.
 * همه‌چیز از همان مسیرهای REST سرور می‌گذرد؛ مجوزها از `canCmmsAccess` می‌آیند و
 * تصمیم نهایی همچنان با سرور است.
 *
 * یادداشت صداقت: سرور CMMS مسیر حذف سخت ندارد. «حذف» در اینجا همان
 * غیرفعال‌سازی است (`IsActive=false` یا انتقال به وضعیت بازنشسته/لغوشده)، نه پاک‌کردن.
 */
import { useState, type ReactNode } from "react";
import DataGrid, { type RowAction } from "./crud/DataGrid";
import { ConfirmDialog, DetailDialog, FormDialog } from "./crud/FormDialog";
import { describeRecord, dayToIsoDateTime, emptyValues, valuesFromRecord, type FormFieldDef } from "./crud/formLogic";
import { useAsyncList } from "./crud/useAsyncList";
import type { GridColumnDef } from "./crud/gridLogic";
import { crudPrimaryBtnCls } from "./crud/styles";
import { CMMS_HOLD_REASONS } from "../services/cmmsDomain";
import {
  canCmmsAccess,
  CmmsClient,
  CmmsRequestError,
  type CmmsAsset,
  type CmmsFamily,
  type CmmsSparePart,
  type CmmsWorkOrder,
  type CmmsWorkOrderStatus,
} from "../services/cmmsApi";

interface PanelProps {
  fa: boolean;
  siteId: string;
  userId: string;
}

/* ═══════════════════════ ابزارهای مشترک ═══════════════════════ */

function describe(error: unknown): string {
  if (error instanceof CmmsRequestError) return `${error.message}${error.code ? ` (${error.code})` : ""}`;
  if (error instanceof Error) return error.message;
  return "خطای ناشناخته در ارتباط با سرور";
}

type Notice = { kind: "ok" | "error"; text: string } | null;

function NoticeBar({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  if (!notice) return null;
  const tone = notice.kind === "ok"
    ? "border-emerald-500/30 bg-emerald-500/10"
    : "border-rose-500/30 bg-rose-500/10";
  return (
    <div className={`rounded-xl border ${tone} p-2.5 flex items-start justify-between gap-2 text-[11px] tx1`} role={notice.kind === "error" ? "alert" : "status"}>
      <span>{notice.text}</span>
      <button type="button" onClick={onClose} className="tx3 hover:tx1" aria-label="close notice">✕</button>
    </div>
  );
}

function PanelShell({
  title,
  hint,
  actions,
  children,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="tx1 text-xs font-medium">{title}</h4>
          {hint && <p className="tx3 text-[10px] mt-0.5">{hint}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      {children}
    </section>
  );
}

function permTitle(allowed: boolean, permission: string, fa: boolean): string | undefined {
  return allowed ? undefined : fa ? `مجوز لازم: ${permission}` : `Required permission: ${permission}`;
}

function useCmmsCan(userId: string, siteId: string) {
  return (permission: string) => canCmmsAccess(userId, permission, siteId);
}

const SEVERITY_OPTIONS = [
  { value: "critical", label: "critical" },
  { value: "high", label: "high" },
  { value: "medium", label: "medium" },
  { value: "low", label: "low" },
];

const PRIORITY_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));
const RANK_OPTIONS = ["A", "B", "C", "D"].map((r) => ({ value: r, label: r }));

/* ═══════════════════════ ۱. تجهیزات و دارایی‌ها ═══════════════════════ */

type AssetRow = CmmsAsset & {
  NameEn?: string | null;
  SerialNumber?: string | null;
  Manufacturer?: string | null;
  Model?: string | null;
  WarrantyExpiresOn?: string | null;
  ExpectedLifeYears?: number | null;
  NoteFa?: string | null;
};

export function CmmsAssetsPanel({ fa, siteId, userId }: PanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const can = useCmmsCan(userId, siteId);
  const canEdit = can("cmms.asset.edit");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AssetRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<AssetRow | null>(null);
  const [toggling, setToggling] = useState<AssetRow | null>(null);

  const assets = useAsyncList(() => CmmsClient.listAssets(siteId, userId, { limit: 500 }), [siteId, userId], describe);
  const families = useAsyncList(() => CmmsClient.listFamilies(siteId, userId), [siteId, userId], describe);
  const locations = useAsyncList(() => CmmsClient.listLocations(siteId, userId), [siteId, userId], describe);

  const rows = (assets.data?.assets ?? []) as AssetRow[];
  const familyOptions = (families.data?.families ?? []).map((f) => ({ value: f.Id, label: `${f.FamilyCode} — ${f.NameFa}` }));
  const familyCodeById = new Map((families.data?.families ?? []).map((f) => [f.Id, f.FamilyCode]));
  const locationOptions = ((locations.data?.locations ?? []) as Array<{ Id: string; NameFa?: string; LocationCode?: string }>)
    .map((l) => ({ value: l.Id, label: `${l.LocationCode ?? l.Id} — ${l.NameFa ?? ""}` }));
  const assetOptions = rows.map((a) => ({ value: a.Id, label: `${a.AssetTag} — ${a.NameFa}` }));

  const commonFields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام تجهیز", "Asset name"), required: true, maxLength: 240, fullWidth: true },
    { name: "NameEn", label: tr("نام لاتین", "English name"), maxLength: 240, ltr: true },
    { name: "AssetState", label: tr("وضعیت بهره‌برداری", "Operational state"), type: "select", required: true, options: [
      "planned", "installed", "commissioned", "operating", "standby", "under-maintenance", "degraded", "retired", "disposed",
    ].map((v) => ({ value: v, label: v })) },
    { name: "CriticalityRank", label: tr("رتبهٔ بحرانی‌بودن", "Criticality rank"), type: "select", required: true, options: RANK_OPTIONS },
    { name: "LocationId", label: tr("مکان استقرار", "Location"), type: "select", options: locationOptions },
    { name: "ParentAssetId", label: tr("تجهیز والد", "Parent asset"), type: "select", options: assetOptions.filter((o) => !editing || o.value !== editing.Id) },
    { name: "SerialNumber", label: tr("شماره سریال", "Serial no."), maxLength: 120, ltr: true },
    { name: "Manufacturer", label: tr("سازنده", "Manufacturer"), maxLength: 240 },
    { name: "Model", label: tr("مدل", "Model"), maxLength: 160, ltr: true },
    { name: "WarrantyExpiresOn", label: tr("پایان گارانتی", "Warranty expires"), type: "date" },
    { name: "ExpectedLifeYears", label: tr("عمر مفید مورد انتظار (سال)", "Expected life (years)"), type: "number", min: 0.01 },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const createFields: FormFieldDef[] = [
    { name: "FamilyId", label: tr("خانوادهٔ تجهیز", "Equipment family"), type: "select", required: true, options: familyOptions },
    { name: "AssetTag", label: tr("برچسب تجهیز", "Asset tag"), required: true, maxLength: 60, ltr: true, placeholder: "P-101A" },
    ...commonFields,
    { name: "InstalledOn", label: tr("تاریخ نصب", "Installed on"), type: "date" },
    { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" },
  ];

  const editFields = commonFields;

  const columns: GridColumnDef<AssetRow>[] = [
    { key: "AssetTag", header: tr("برچسب", "Tag"), ltr: true } as GridColumnDef<AssetRow>,
    { key: "NameFa", header: tr("نام تجهیز", "Asset name") },
    { key: "FamilyCode", header: tr("خانواده", "Family"), accessor: (row) => familyCodeById.get(row.FamilyId) ?? "", filter: "auto" },
    { key: "AssetState", header: tr("وضعیت", "State"), filter: "auto" },
    { key: "CriticalityRank", header: tr("رتبه", "Rank"), filter: RANK_OPTIONS },
    {
      key: "IsActive",
      header: tr("فعال", "Active"),
      accessor: (row) => (row.IsActive ? "true" : "false"),
      render: (row) => (row.IsActive ? tr("فعال", "Active") : tr("غیرفعال", "Inactive")),
      filter: [{ value: "true", label: tr("فعال", "Active") }, { value: "false", label: tr("غیرفعال", "Inactive") }],
    },
  ];

  const actions = (row: AssetRow): RowAction<AssetRow>[] => [
    { key: "view", label: tr("مشاهده", "View"), onClick: setViewing, tone: "neutral" },
    { key: "edit", label: tr("ویرایش", "Edit"), onClick: setEditing, tone: "primary", disabled: !canEdit || busy, title: permTitle(canEdit, "cmms.asset.edit", fa) },
    {
      key: "toggle",
      label: row.IsActive ? tr("غیرفعال‌سازی", "Deactivate") : tr("فعال‌سازی", "Activate"),
      onClick: setToggling,
      tone: row.IsActive ? "danger" : "ok",
      disabled: !canEdit || busy,
      title: permTitle(canEdit, "cmms.asset.edit", fa),
    },
  ];

  const saveCreate = async (payload: Record<string, unknown>) => {
    await CmmsClient.createAsset(siteId, userId, payload);
    setCreating(false);
    setNotice({ kind: "ok", text: tr("تجهیز ثبت شد.", "Asset created.") });
    assets.reload();
  };

  const saveEdit = async (payload: Record<string, unknown>) => {
    if (!editing) return;
    await CmmsClient.patchAsset(siteId, userId, editing.Id, editing.RowVersion, { ...payload, RowVersion: editing.RowVersion });
    setEditing(null);
    setNotice({ kind: "ok", text: tr("تغییرات تجهیز ذخیره شد.", "Asset updated.") });
    assets.reload();
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    setBusy(true);
    try {
      await CmmsClient.patchAsset(siteId, userId, toggling.Id, toggling.RowVersion, {
        IsActive: !toggling.IsActive,
        RowVersion: toggling.RowVersion,
      });
      setNotice({ kind: "ok", text: toggling.IsActive ? tr("تجهیز غیرفعال شد (رکورد حذف نشد).", "Asset deactivated (record kept).") : tr("تجهیز فعال شد.", "Asset activated.") });
      setToggling(null);
      assets.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title={tr("شناسنامه و درخت دارایی‌ها", "Asset registry")}
      hint={tr("فهرست تجهیزات سایت؛ فیلتر، مرتب‌سازی و ویرایش با تأیید سرور.", "Site asset list; filter, sort and edit with server validation.")}
    >
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <DataGrid
        fa={fa}
        rows={rows}
        columns={columns}
        rowKey={(row) => row.Id}
        actions={actions}
        loading={assets.loading}
        error={assets.error}
        onRetry={assets.reload}
        emptyText={tr("هنوز تجهیزی ثبت نشده است", "No assets registered yet")}
        caption={tr("فهرست تجهیزات", "Assets")}
        toolbar={can("cmms.asset.edit") && (
          <button type="button" className={crudPrimaryBtnCls} onClick={() => setCreating(true)} disabled={families.loading || (families.data?.families.length ?? 0) === 0}
            title={(families.data?.families.length ?? 0) === 0 ? tr("ابتدا یک خانوادهٔ تجهیز تعریف کنید", "Define an equipment family first") : undefined}>
            {tr("+ تجهیز جدید", "+ New asset")}
          </button>
        )}
      />

      <FormDialog
        open={creating}
        fa={fa}
        mode="create"
        title={tr("ثبت تجهیز جدید", "New asset")}
        description={tr("خانوادهٔ تجهیز و برچسب یکتا الزامی است.", "Family and a unique tag are required.")}
        fields={createFields}
        initialValues={emptyValues(createFields, { AssetState: "commissioned", CriticalityRank: "C", IsActive: "true" })}
        onSubmit={saveCreate}
        onClose={() => setCreating(false)}
        wide
      />

      <FormDialog
        open={editing !== null}
        fa={fa}
        mode="edit"
        title={tr("ویرایش تجهیز", "Edit asset")}
        description={editing ? `${editing.AssetTag} · RowVersion ${editing.RowVersion}` : undefined}
        fields={editFields}
        initialValues={editing ? valuesFromRecord(editFields, editing as unknown as Record<string, unknown>) : {}}
        onSubmit={saveEdit}
        onClose={() => setEditing(null)}
        wide
      />

      <DetailDialog
        open={viewing !== null}
        fa={fa}
        title={viewing ? `${viewing.AssetTag} — ${viewing.NameFa}` : ""}
        items={viewing ? describeRecord([
          { name: "FamilyId", label: tr("خانواده", "Family") },
          ...editFields,
          { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" },
        ], { ...(viewing as unknown as Record<string, unknown>), FamilyId: familyCodeById.get(viewing.FamilyId) ?? viewing.FamilyId }, { yes: tr("بله", "Yes"), no: tr("خیر", "No"), empty: "—" }) : []}
        onClose={() => setViewing(null)}
      />

      <ConfirmDialog
        open={toggling !== null}
        fa={fa}
        title={toggling?.IsActive ? tr("غیرفعال‌سازی تجهیز", "Deactivate asset") : tr("فعال‌سازی تجهیز", "Activate asset")}
        message={toggling ? tr(
          `${toggling.AssetTag} ${toggling.IsActive ? "غیرفعال" : "فعال"} می‌شود. رکورد حذف نمی‌شود و سابقه باقی می‌ماند.`,
          `${toggling.AssetTag} will be ${toggling.IsActive ? "deactivated" : "activated"}. The record is kept with its history.`,
        ) : ""}
        confirmLabel={toggling?.IsActive ? tr("غیرفعال‌سازی", "Deactivate") : tr("فعال‌سازی", "Activate")}
        danger={toggling?.IsActive}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />
    </PanelShell>
  );
}

/* ═══════════════════════ ۲. خانوادهٔ تجهیز ═══════════════════════ */

const STRATEGY_OPTIONS = ["pm", "cbm", "predictive", "risk-based", "run-to-failure", "zero-breakdown"].map((v) => ({ value: v, label: v }));

export function CmmsFamiliesPanel({ fa, siteId, userId }: PanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const can = useCmmsCan(userId, siteId);
  const canEdit = can("cmms.family.edit");
  const canApprove = can("cmms.family.approve");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CmmsFamily | null>(null);
  const [viewing, setViewing] = useState<CmmsFamily | null>(null);
  const [approving, setApproving] = useState<CmmsFamily | null>(null);

  const families = useAsyncList(() => CmmsClient.listFamilies(siteId, userId), [siteId, userId], describe);
  const groups = useAsyncList(() => CmmsClient.listFamilyGroups(siteId, userId), [siteId, userId], describe);
  const rows = (families.data?.families ?? []) as Array<CmmsFamily & { Manufacturer?: string | null; NoteFa?: string | null; NameEn?: string | null; ModelSeries?: string | null; DefaultStrategy?: string | null }>;
  const groupOptions = ((groups.data?.groups ?? []) as Array<{ Id: string; GroupCode: string; NameFa: string }>)
    .map((g) => ({ value: g.Id, label: `${g.GroupCode} — ${g.NameFa}` }));

  const familyFields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام خانواده", "Family name"), required: true, maxLength: 240, fullWidth: true },
    { name: "NameEn", label: tr("نام لاتین", "English name"), maxLength: 240, ltr: true },
    { name: "Manufacturer", label: tr("سازنده", "Manufacturer"), maxLength: 240 },
    { name: "ModelSeries", label: tr("سری مدل", "Model series"), maxLength: 160, ltr: true },
    { name: "CriticalityRank", label: tr("رتبهٔ بحرانی‌بودن", "Criticality rank"), type: "select", required: true, options: RANK_OPTIONS },
    { name: "DefaultStrategy", label: tr("راهبرد پیش‌فرض", "Default strategy"), type: "select", required: true, options: STRATEGY_OPTIONS },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const createFields: FormFieldDef[] = [
    { name: "FamilyGroupId", label: tr("گروه خانواده", "Family group"), type: "select", required: true, options: groupOptions },
    { name: "FamilyCode", label: tr("کد خانواده", "Family code"), required: true, maxLength: 60, ltr: true, placeholder: "PUMP-CENT" },
    ...familyFields,
    { name: "IsTemplate", label: tr("الگوی عمومی است", "Is a template"), type: "checkbox" },
  ];

  const columns: GridColumnDef<(typeof rows)[number]>[] = [
    { key: "FamilyCode", header: tr("کد", "Code"), ltr: true } as GridColumnDef<(typeof rows)[number]>,
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "CriticalityRank", header: tr("رتبه", "Rank"), filter: RANK_OPTIONS },
    { key: "DefaultStrategy", header: tr("راهبرد", "Strategy"), filter: "auto" },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "Version", header: tr("نسخه", "Version"), align: "center" },
  ];

  const saveCreate = async (payload: Record<string, unknown>) => {
    await CmmsClient.createFamily(siteId, userId, payload);
    setCreating(false);
    setNotice({ kind: "ok", text: tr("خانواده ثبت شد (پیش‌نویس).", "Family created as draft.") });
    families.reload();
  };

  const saveEdit = async (payload: Record<string, unknown>) => {
    if (!editing) return;
    await CmmsClient.patchFamily(siteId, userId, editing.Id, editing.RowVersion, payload);
    setEditing(null);
    setNotice({ kind: "ok", text: tr("تغییرات خانواده ذخیره شد.", "Family updated.") });
    families.reload();
  };

  const confirmApprove = async () => {
    if (!approving) return;
    setBusy(true);
    try {
      await CmmsClient.approveFamily(siteId, userId, approving.Id);
      setApproving(null);
      setNotice({ kind: "ok", text: tr("خانواده تصویب شد و قفل شد.", "Family approved and locked.") });
      families.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title={tr("خانوادهٔ تجهیز (PMworks)", "Equipment families (PMworks)")}
      hint={tr("خانوادهٔ تصویب‌شده قفل است؛ تغییر آن نیازمند نسخهٔ تازه است.", "Approved families are locked; changes need a new version.")}
    >
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <DataGrid
        fa={fa}
        rows={rows}
        columns={columns}
        rowKey={(row) => row.Id}
        loading={families.loading}
        error={families.error}
        onRetry={families.reload}
        caption={tr("فهرست خانواده‌ها", "Families")}
        emptyText={tr("خانواده‌ای تعریف نشده است", "No families defined")}
        actions={(row) => {
          const locked = row.Status === "approved";
          return [
            { key: "view", label: tr("مشاهده", "View"), onClick: setViewing, tone: "neutral" },
            {
              key: "edit", label: tr("ویرایش", "Edit"), onClick: setEditing, tone: "primary",
              disabled: !canEdit || locked || busy,
              title: locked ? tr("خانوادهٔ تصویب‌شده مستقیماً ویرایش نمی‌شود", "Approved families cannot be edited directly") : permTitle(canEdit, "cmms.family.edit", fa),
            },
            {
              key: "approve", label: tr("تصویب", "Approve"), onClick: setApproving, tone: "ok",
              hidden: row.Status !== "draft",
              disabled: !canApprove || busy,
              title: permTitle(canApprove, "cmms.family.approve", fa),
            },
          ];
        }}
        toolbar={canEdit && (
          <button type="button" className={crudPrimaryBtnCls} onClick={() => setCreating(true)} disabled={(groups.data?.groups.length ?? 0) === 0}
            title={(groups.data?.groups.length ?? 0) === 0 ? tr("ابتدا گروه خانواده تعریف کنید", "Define a family group first") : undefined}>
            {tr("+ خانوادهٔ جدید", "+ New family")}
          </button>
        )}
      />

      <FormDialog
        open={creating}
        fa={fa}
        mode="create"
        title={tr("خانوادهٔ تجهیز جدید", "New equipment family")}
        fields={createFields}
        initialValues={emptyValues(createFields, { CriticalityRank: "C", DefaultStrategy: "pm" })}
        onSubmit={saveCreate}
        onClose={() => setCreating(false)}
        wide
      />

      <FormDialog
        open={editing !== null}
        fa={fa}
        mode="edit"
        title={tr("ویرایش خانواده", "Edit family")}
        description={editing ? `${editing.FamilyCode} · v${editing.Version}` : undefined}
        fields={familyFields}
        initialValues={editing ? valuesFromRecord(familyFields, editing as unknown as Record<string, unknown>) : {}}
        onSubmit={saveEdit}
        onClose={() => setEditing(null)}
        wide
      />

      <DetailDialog
        open={viewing !== null}
        fa={fa}
        title={viewing ? `${viewing.FamilyCode} — ${viewing.NameFa}` : ""}
        items={viewing ? [
          { label: tr("کد", "Code"), value: viewing.FamilyCode, ltr: true },
          { label: tr("وضعیت", "Status"), value: viewing.Status },
          { label: tr("نسخه", "Version"), value: String(viewing.Version) },
          ...describeRecord(familyFields, viewing as unknown as Record<string, unknown>, { yes: tr("بله", "Yes"), no: tr("خیر", "No"), empty: "—" }),
        ] : []}
        onClose={() => setViewing(null)}
      />

      <ConfirmDialog
        open={approving !== null}
        fa={fa}
        title={tr("تصویب خانواده", "Approve family")}
        message={approving ? tr(`با تصویب ${approving.FamilyCode}، ویرایش مستقیم آن بسته می‌شود.`, `Approving ${approving.FamilyCode} locks it against direct edits.`) : ""}
        confirmLabel={tr("تصویب", "Approve")}
        onConfirm={async () => confirmApprove()}
        onCancel={() => setApproving(null)}
      />
      {busy && <span className="sr-only" aria-live="polite">{tr("در حال انجام…", "Working…")}</span>}
    </PanelShell>
  );
}

/* ═══════════════════════ ۳. درخواست‌کار و دستورکار ═══════════════════════ */

const WO_TYPES = ["pm", "cm", "emergency", "overhaul", "project", "calibration", "inspection"];
const IMPACT_TYPES = ["none", "partial", "line-stop", "plant-stop"];

type WorkOrderTransition = "release" | "start" | "resume" | "complete" | "close";

const TRANSITION_FROM: Record<WorkOrderTransition, CmmsWorkOrderStatus[]> = {
  release: ["draft", "planned", "scheduled"],
  start: ["released", "on-hold"],
  resume: ["on-hold"],
  complete: ["in-progress"],
  close: ["completed"],
};

export function CmmsWorkOrdersPanel({ fa, siteId, userId }: PanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const can = useCmmsCan(userId, siteId);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<CmmsWorkOrder | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof CmmsClient.getWorkOrder>> | null>(null);
  const [holding, setHolding] = useState<CmmsWorkOrder | null>(null);
  const [cancelling, setCancelling] = useState<CmmsWorkOrder | null>(null);

  const orders = useAsyncList(() => CmmsClient.listWorkOrders(siteId, userId, { limit: 500 }), [siteId, userId], describe);
  const assets = useAsyncList(() => CmmsClient.listAssets(siteId, userId, { limit: 500 }), [siteId, userId], describe);
  const rows = (orders.data?.workOrders ?? []) as CmmsWorkOrder[];
  const assetOptions = (assets.data?.assets ?? []).map((a) => ({ value: a.Id, label: `${a.AssetTag} — ${a.NameFa}` }));
  const assetTagById = new Map((assets.data?.assets ?? []).map((a) => [a.Id, a.AssetTag]));

  const canCreate = can("cmms.wo.create");
  const canRelease = can("cmms.wo.release");
  const canExecute = can("cmms.wo.execute");
  const canComplete = can("cmms.wo.complete");
  const canClose = can("cmms.wo.close");
  const canHold = can("cmms.wo.hold");
  const canResume = can("cmms.wo.resume");
  const canCancel = can("cmms.wo.cancel");

  const createFields: FormFieldDef[] = [
    { name: "WorkOrderNo", label: tr("شمارهٔ دستورکار", "Work order no."), required: true, maxLength: 60, ltr: true, placeholder: "WO-2026-0001" },
    { name: "WorkOrderType", label: tr("نوع", "Type"), type: "select", required: true, options: WO_TYPES.map((v) => ({ value: v, label: v })) },
    { name: "AssetId", label: tr("تجهیز", "Asset"), type: "select", required: true, options: assetOptions, fullWidth: true },
    { name: "TitleFa", label: tr("شرح کار", "Title"), required: true, maxLength: 300, fullWidth: true },
    { name: "ScopeFa", label: tr("دامنهٔ کار", "Scope"), type: "textarea", maxLength: 4000, fullWidth: true },
    { name: "Priority", label: tr("اولویت (۱ بالاترین)", "Priority (1 highest)"), type: "number", integer: true, min: 1, max: 5, required: true },
    { name: "ProductionImpact", label: tr("اثر بر تولید", "Production impact"), type: "select", options: IMPACT_TYPES.map((v) => ({ value: v, label: v })) },
    { name: "PlannedStartAt", label: tr("شروع برنامه‌ریزی‌شده", "Planned start"), type: "date" },
    {
      name: "PlannedFinishAt",
      label: tr("پایان برنامه‌ریزی‌شده", "Planned finish"),
      type: "date",
      validate: (value, values) => (values.PlannedStartAt && value && value < values.PlannedStartAt
        ? tr("پایان نمی‌تواند پیش از شروع باشد", "Finish cannot be before start")
        : null),
    },
    { name: "EstimatedHours", label: tr("ساعت تخمینی", "Estimated hours"), type: "number", min: 0 },
    { name: "EstimatedCost", label: tr("هزینهٔ تخمینی", "Estimated cost"), type: "number", min: 0 },
    { name: "IsAssetDown", label: tr("تجهیز از سرویس خارج است", "Asset is down"), type: "checkbox" },
  ];

  const holdFields: FormFieldDef[] = [
    {
      name: "HoldReasonCode", label: tr("علت توقف", "Hold reason"), type: "select", required: true,
      options: CMMS_HOLD_REASONS.map((reason) => ({ value: reason.code, label: `${reason.code} — ${fa ? reason.fa : reason.en}` })),
    },
    {
      name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true,
      validate: (value, values) => {
        const reason = CMMS_HOLD_REASONS.find((item) => item.code === values.HoldReasonCode);
        return reason?.requiresNote && !value ? tr("برای این علت یادداشت الزامی است", "A note is required for this reason") : null;
      },
    },
  ];

  const runTransition = async (order: CmmsWorkOrder, transition: WorkOrderTransition) => {
    setBusyId(order.Id);
    setNotice(null);
    try {
      const call = {
        release: () => CmmsClient.releaseWorkOrder(siteId, userId, order.Id),
        start: () => CmmsClient.startWorkOrder(siteId, userId, order.Id),
        resume: () => CmmsClient.resumeWorkOrder(siteId, userId, order.Id, {}),
        complete: () => CmmsClient.completeWorkOrder(siteId, userId, order.Id),
        close: () => CmmsClient.closeWorkOrder(siteId, userId, order.Id),
      }[transition];
      await call();
      setNotice({ kind: "ok", text: tr(`وضعیت دستورکار ${order.WorkOrderNo} به‌روز شد.`, `Work order ${order.WorkOrderNo} updated.`) });
      orders.reload();
    } catch (error) {
      setNotice({ kind: "error", text: describe(error) });
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = async (order: CmmsWorkOrder) => {
    setViewing(order);
    setDetail(null);
    try {
      setDetail(await CmmsClient.getWorkOrder(siteId, userId, order.Id));
    } catch (error) {
      setNotice({ kind: "error", text: describe(error) });
      setViewing(null);
    }
  };

  const saveCreate = async (payload: Record<string, unknown>) => {
    const body = {
      ...payload,
      PlannedStartAt: dayToIsoDateTime(payload.PlannedStartAt) ?? undefined,
      PlannedFinishAt: dayToIsoDateTime(payload.PlannedFinishAt) ?? undefined,
    };
    await CmmsClient.createWorkOrder(siteId, userId, body);
    setCreating(false);
    setNotice({ kind: "ok", text: tr("دستورکار ثبت شد (پیش‌نویس).", "Work order created as draft.") });
    orders.reload();
  };

  const saveHold = async (payload: Record<string, unknown>) => {
    if (!holding) return;
    await CmmsClient.holdWorkOrder(siteId, userId, holding.Id, payload);
    setHolding(null);
    setNotice({ kind: "ok", text: tr("دستورکار متوقف شد.", "Work order put on hold.") });
    orders.reload();
  };

  /* سرور برای لغو بدنه نمی‌خواند؛ دلیلی گرفته نمی‌شود تا چیزی ذخیره‌نشده وانمود نشود. */
  const confirmCancel = async () => {
    if (!cancelling) return;
    await CmmsClient.cancelWorkOrder(siteId, userId, cancelling.Id);
    setCancelling(null);
    setNotice({ kind: "ok", text: tr("دستورکار لغو شد.", "Work order cancelled.") });
    orders.reload();
  };

  const columns: GridColumnDef<CmmsWorkOrder>[] = [
    { key: "WorkOrderNo", header: tr("شماره", "No."), ltr: true } as GridColumnDef<CmmsWorkOrder>,
    { key: "TitleFa", header: tr("شرح", "Title") },
    { key: "AssetTag", header: tr("تجهیز", "Asset"), accessor: (row) => assetTagById.get(row.AssetId ?? "") ?? "", filter: "auto" },
    { key: "WorkOrderType", header: tr("نوع", "Type"), filter: "auto" },
    { key: "Status", header: tr("وضعیت", "Status"), filter: WO_STATUS_OPTIONS(fa) },
    { key: "Priority", header: tr("اولویت", "Priority"), align: "center", filter: PRIORITY_OPTIONS },
    { key: "ProductionImpact", header: tr("اثر تولید", "Impact"), filter: "auto" },
    {
      key: "IsAssetDown",
      header: tr("توقف تجهیز", "Asset down"),
      accessor: (row) => (row.IsAssetDown ? "true" : "false"),
      render: (row) => (row.IsAssetDown ? tr("بله", "Yes") : tr("خیر", "No")),
      filter: [{ value: "true", label: tr("بله", "Yes") }, { value: "false", label: tr("خیر", "No") }],
    },
  ];

  const actions = (row: CmmsWorkOrder): RowAction<CmmsWorkOrder>[] => {
    const busy = busyId === row.Id;
    const transitionAction = (transition: WorkOrderTransition, label: string, allowed: boolean, permission: string, tone: RowAction<CmmsWorkOrder>["tone"]): RowAction<CmmsWorkOrder> => ({
      key: transition,
      label,
      tone,
      hidden: !TRANSITION_FROM[transition].includes(row.Status),
      disabled: !allowed || busy,
      title: permTitle(allowed, permission, fa),
      onClick: (order) => void runTransition(order, transition),
    });
    const holdable = ["planned", "scheduled", "released", "in-progress"].includes(row.Status);
    return [
      { key: "view", label: tr("مشاهده", "View"), onClick: (order) => void openDetail(order), tone: "neutral" },
      transitionAction("release", tr("آزادسازی", "Release"), canRelease, "cmms.wo.release", "primary"),
      transitionAction("start", tr("شروع", "Start"), canExecute, "cmms.wo.execute", "primary"),
      transitionAction("resume", tr("ادامه", "Resume"), canResume, "cmms.wo.resume", "ok"),
      {
        key: "hold", label: tr("توقف", "Hold"), tone: "warn", hidden: !holdable,
        disabled: !canHold || busy, title: permTitle(canHold, "cmms.wo.hold", fa),
        onClick: setHolding,
      },
      transitionAction("complete", tr("اتمام", "Complete"), canComplete, "cmms.wo.complete", "ok"),
      transitionAction("close", tr("بستن", "Close"), canClose, "cmms.wo.close", "ok"),
      {
        key: "cancel", label: tr("لغو", "Cancel"), tone: "danger",
        hidden: !["draft", "planned", "scheduled", "released", "on-hold"].includes(row.Status),
        disabled: !canCancel || busy, title: permTitle(canCancel, "cmms.wo.cancel", fa),
        onClick: setCancelling,
      },
    ];
  };

  return (
    <PanelShell
      title={tr("درخواست‌کار و دستورکار", "Work requests & orders")}
      hint={tr("هر تغییر وضعیت از قواعد گردش سرور عبور می‌کند؛ گذار غیرمجاز رد می‌شود.", "Each status change follows the server workflow; invalid transitions are rejected.")}
    >
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <DataGrid
        fa={fa}
        rows={rows}
        columns={columns}
        rowKey={(row) => row.Id}
        actions={actions}
        loading={orders.loading}
        error={orders.error}
        onRetry={orders.reload}
        caption={tr("فهرست دستورکارها", "Work orders")}
        emptyText={tr("دستورکاری ثبت نشده است", "No work orders")}
        defaultSort={{ key: "Priority", dir: "asc" }}
        toolbar={canCreate && (
          <button type="button" className={crudPrimaryBtnCls} onClick={() => setCreating(true)} disabled={(assets.data?.assets.length ?? 0) === 0}>
            {tr("+ دستورکار جدید", "+ New work order")}
          </button>
        )}
      />

      <FormDialog
        open={creating}
        fa={fa}
        mode="create"
        title={tr("دستورکار جدید", "New work order")}
        description={tr("دستورکار با تجهیز مشخص و در پیش‌نویس ثبت می‌شود.", "A work order is created as draft for a specific asset.")}
        fields={createFields}
        initialValues={emptyValues(createFields, { WorkOrderType: "cm", Priority: "3", ProductionImpact: "none" })}
        onSubmit={saveCreate}
        onClose={() => setCreating(false)}
        wide
      />

      <FormDialog
        open={holding !== null}
        fa={fa}
        mode="create"
        title={tr("توقف دستورکار", "Hold work order")}
        description={holding ? `${holding.WorkOrderNo} — ${holding.TitleFa}` : undefined}
        fields={holdFields}
        initialValues={emptyValues(holdFields, { HoldReasonCode: "waiting-parts" })}
        submitLabel={tr("توقف", "Hold")}
        onSubmit={saveHold}
        onClose={() => setHolding(null)}
      />

      <ConfirmDialog
        open={cancelling !== null}
        fa={fa}
        title={tr("لغو دستورکار", "Cancel work order")}
        message={cancelling ? tr(`${cancelling.WorkOrderNo} لغو می‌شود و قابل بازگشت نیست.`, `${cancelling.WorkOrderNo} will be cancelled and cannot be reopened.`) : ""}
        confirmLabel={tr("لغو دستورکار", "Cancel order")}
        danger
        onConfirm={async () => confirmCancel()}
        onCancel={() => setCancelling(null)}
      />

      <DetailDialog
        open={viewing !== null}
        fa={fa}
        title={viewing ? `${viewing.WorkOrderNo} — ${viewing.TitleFa}` : ""}
        items={viewing ? [
          { label: tr("وضعیت", "Status"), value: viewing.Status },
          { label: tr("نوع", "Type"), value: viewing.WorkOrderType },
          { label: tr("اولویت", "Priority"), value: String(viewing.Priority), ltr: true },
          { label: tr("تجهیز", "Asset"), value: assetTagById.get(viewing.AssetId ?? "") ?? "—", ltr: true },
          { label: tr("ساعت واقعی", "Actual hours"), value: viewing.ActualHours ?? "—", ltr: true },
          { label: tr("هزینهٔ واقعی", "Actual cost"), value: viewing.ActualCost ?? "—", ltr: true },
        ] : []}
        onClose={() => { setViewing(null); setDetail(null); }}
      >
        {viewing && !detail && <p className="tx3 text-[11px]">{tr("در حال دریافت جزئیات…", "Loading details…")}</p>}
        {detail && (
          <div className="space-y-2">
            <div className="tx1 text-[11px] font-medium">{tr(`چک‌لیست (${detail.tasks.length} مورد)`, `Checklist (${detail.tasks.length} items)`)}</div>
            {detail.tasks.length === 0 && <p className="tx3 text-[11px]">{tr("فعالیتی برای این دستورکار ثبت نشده است.", "No tasks recorded.")}</p>}
            {detail.tasks.length > 0 && (
              <DataGrid
                fa={fa}
                rows={detail.tasks}
                columns={[
                  { key: "LineNo", header: "#", align: "center" },
                  { key: "DescriptionFa", header: tr("شرح", "Task") },
                  { key: "ResultStatus", header: tr("نتیجه", "Result"), filter: "auto" },
                ]}
                rowKey={(row) => row.Id}
                defaultPageSize={5}
                pageSizes={[5, 10]}
                caption={tr("چک‌لیست دستورکار", "Work order checklist")}
              />
            )}
            <p className="tx3 text-[10px]" dir="ltr">
              labor: {detail.labor.length} · materials: {detail.materials.length} · costs: {detail.costs.length} · total: {detail.totals?.total ?? 0}
            </p>
          </div>
        )}
      </DetailDialog>
    </PanelShell>
  );
}

function WO_STATUS_OPTIONS(fa: boolean) {
  const labels: Record<string, string> = fa
    ? { draft: "پیش‌نویس", planned: "برنامه‌ریزی‌شده", scheduled: "زمان‌بندی‌شده", released: "آزادشده", "in-progress": "در حال اجرا", "on-hold": "متوقف", completed: "تکمیل‌شده", closed: "بسته‌شده", cancelled: "لغوشده" }
    : { draft: "Draft", planned: "Planned", scheduled: "Scheduled", released: "Released", "in-progress": "In progress", "on-hold": "On hold", completed: "Completed", closed: "Closed", cancelled: "Cancelled" };
  return Object.keys(labels).map((value) => ({ value, label: labels[value] }));
}

/* ═══════════════════════ ۴. قطعات یدکی ═══════════════════════ */

const SPARE_CATEGORIES = ["mechanical", "electrical", "instrument", "consumable", "lubricant", "seal", "bearing", "filter"];
const TX_TYPES = ["receipt", "issue", "return", "adjust", "scrap"];

export function CmmsSparesPanel({ fa, siteId, userId }: PanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const can = useCmmsCan(userId, siteId);
  const canEdit = can("cmms.spare.edit");
  const canMove = can("cmms.spare.receive");
  const [notice, setNotice] = useState<Notice>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CmmsSparePart | null>(null);
  const [moving, setMoving] = useState<CmmsSparePart | null>(null);

  const spares = useAsyncList(() => CmmsClient.listSpareParts(siteId, userId), [siteId, userId], describe);
  const rows = (spares.data?.parts ?? []) as Array<CmmsSparePart & { NameEn?: string | null; Uom?: string | null; Manufacturer?: string | null; UnitCost?: number | null; MaxStock?: number | null; SafetyStock?: number | null; LeadTimeDays?: number | null; IsCriticalSpare?: boolean; IsConsumable?: boolean; IsActive?: boolean; NoteFa?: string | null }>;

  const editFields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام قطعه", "Part name"), required: true, maxLength: 240, fullWidth: true },
    { name: "UnitCost", label: tr("بهای واحد", "Unit cost"), type: "number", min: 0 },
    { name: "MinStock", label: tr("حداقل موجودی", "Min stock"), type: "number", min: 0 },
    { name: "MaxStock", label: tr("حداکثر موجودی", "Max stock"), type: "number", min: 0 },
    { name: "ReorderPoint", label: tr("نقطهٔ سفارش", "Reorder point"), type: "number", min: 0 },
    { name: "SafetyStock", label: tr("موجودی اطمینان", "Safety stock"), type: "number", min: 0 },
    { name: "LeadTimeDays", label: tr("زمان تحویل (روز)", "Lead time (days)"), type: "number", integer: true, min: 0 },
    { name: "IsCriticalSpare", label: tr("قطعهٔ بحرانی", "Critical spare"), type: "checkbox" },
    { name: "IsConsumable", label: tr("مصرفی", "Consumable"), type: "checkbox" },
    { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const createFields: FormFieldDef[] = [
    { name: "PartNumber", label: tr("شمارهٔ قطعه", "Part number"), required: true, maxLength: 60, ltr: true },
    { name: "NameFa", label: tr("نام قطعه", "Part name"), required: true, maxLength: 240, fullWidth: true },
    { name: "NameEn", label: tr("نام لاتین", "English name"), maxLength: 240, ltr: true },
    { name: "Category", label: tr("دسته", "Category"), type: "select", required: true, options: SPARE_CATEGORIES.map((v) => ({ value: v, label: v })) },
    { name: "Uom", label: tr("واحد", "UoM"), required: true, maxLength: 24, ltr: true, placeholder: "ea" },
    { name: "Manufacturer", label: tr("سازنده", "Manufacturer"), maxLength: 240 },
    { name: "OemPartNumber", label: tr("شمارهٔ OEM", "OEM part no."), maxLength: 120, ltr: true },
    { name: "UnitCost", label: tr("بهای واحد", "Unit cost"), type: "number", min: 0 },
    { name: "QtyOnHand", label: tr("موجودی اولیه", "Opening stock"), type: "number", min: 0 },
    { name: "MinStock", label: tr("حداقل موجودی", "Min stock"), type: "number", min: 0 },
    { name: "ReorderPoint", label: tr("نقطهٔ سفارش", "Reorder point"), type: "number", min: 0 },
    { name: "IsCriticalSpare", label: tr("قطعهٔ بحرانی", "Critical spare"), type: "checkbox" },
    { name: "IsConsumable", label: tr("مصرفی", "Consumable"), type: "checkbox" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const moveFields: FormFieldDef[] = [
    { name: "TransactionType", label: tr("نوع تراکنش", "Transaction type"), type: "select", required: true, options: TX_TYPES.map((v) => ({ value: v, label: v })) },
    {
      name: "Quantity", label: tr("مقدار (بدون علامت)", "Quantity (unsigned)"), type: "number", required: true, min: 0.0001,
      validate: (value) => (Number(value) === 0 ? tr("مقدار نمی‌تواند صفر باشد", "Quantity cannot be zero") : null),
    },
    { name: "ReferenceNo", label: tr("شمارهٔ سند", "Reference no."), maxLength: 60, ltr: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const saveCreate = async (payload: Record<string, unknown>) => {
    await CmmsClient.createSparePart(siteId, userId, payload);
    setCreating(false);
    setNotice({ kind: "ok", text: tr("قطعه ثبت شد.", "Spare part created.") });
    spares.reload();
  };

  const saveEdit = async (payload: Record<string, unknown>) => {
    if (!editing) return;
    await CmmsClient.patchSparePart(siteId, userId, editing.Id, editing.RowVersion, payload);
    setEditing(null);
    setNotice({ kind: "ok", text: tr("تغییرات قطعه ذخیره شد.", "Spare part updated.") });
    spares.reload();
  };

  const saveMove = async (payload: Record<string, unknown>) => {
    if (!moving) return;
    const result = await CmmsClient.postSpareTransaction(siteId, userId, moving.Id, payload);
    setMoving(null);
    setNotice({ kind: "ok", text: tr(`موجودی به‌روز شد: ${result.qtyOnHand}`, `Stock updated: ${result.qtyOnHand}`) });
    spares.reload();
  };

  const shortage = (row: CmmsSparePart) => row.ReorderPoint !== null && row.ReorderPoint !== undefined && row.QtyOnHand <= row.ReorderPoint;

  const columns: GridColumnDef<(typeof rows)[number]>[] = [
    { key: "PartNumber", header: tr("شمارهٔ قطعه", "Part no."), ltr: true } as GridColumnDef<(typeof rows)[number]>,
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "Category", header: tr("دسته", "Category"), filter: SPARE_CATEGORIES.map((v) => ({ value: v, label: v })) },
    { key: "QtyOnHand", header: tr("موجودی", "On hand"), align: "center", ltr: true },
    { key: "ReorderPoint", header: tr("نقطهٔ سفارش", "Reorder"), align: "center", ltr: true },
    {
      key: "stock",
      header: tr("وضعیت موجودی", "Stock status"),
      accessor: (row) => (shortage(row) ? "below" : "ok"),
      render: (row) => (shortage(row)
        ? <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-200">{tr("زیر نقطهٔ سفارش", "Below reorder")}</span>
        : <span className="tx3 text-[10px]">{tr("کافی", "OK")}</span>),
      filter: [{ value: "below", label: tr("زیر نقطهٔ سفارش", "Below reorder") }, { value: "ok", label: tr("کافی", "OK") }],
    },
  ];

  return (
    <PanelShell
      title={tr("انبار قطعات یدکی", "MRO spare parts")}
      hint={tr("تغییر موجودی فقط از راه تراکنش ثبت می‌شود تا ردپای حسابرسی بماند.", "Stock changes are posted as transactions to keep an audit trail.")}
    >
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <DataGrid
        fa={fa}
        rows={rows}
        columns={columns}
        rowKey={(row) => row.Id}
        loading={spares.loading}
        error={spares.error}
        onRetry={spares.reload}
        caption={tr("فهرست قطعات یدکی", "Spare parts")}
        emptyText={tr("قطعه‌ای ثبت نشده است", "No spare parts")}
        actions={() => [
          { key: "edit", label: tr("ویرایش", "Edit"), onClick: setEditing, tone: "primary", disabled: !canEdit, title: permTitle(canEdit, "cmms.spare.edit", fa) },
          { key: "move", label: tr("ثبت تراکنش", "Post movement"), onClick: setMoving, tone: "neutral", disabled: !canMove, title: permTitle(canMove, "cmms.spare.receive", fa) },
        ]}
        toolbar={canEdit && (
          <button type="button" className={crudPrimaryBtnCls} onClick={() => setCreating(true)}>{tr("+ قطعهٔ جدید", "+ New part")}</button>
        )}
      />

      <FormDialog open={creating} fa={fa} mode="create" wide title={tr("قطعهٔ یدکی جدید", "New spare part")} fields={createFields}
        initialValues={emptyValues(createFields, { Category: "mechanical", Uom: "ea", QtyOnHand: "0" })} onSubmit={saveCreate} onClose={() => setCreating(false)} />

      <FormDialog open={editing !== null} fa={fa} mode="edit" wide title={tr("ویرایش قطعه", "Edit part")}
        description={editing ? `${editing.PartNumber} · ${tr("موجودی فعلی", "on hand")}: ${editing.QtyOnHand}` : undefined}
        fields={editFields} initialValues={editing ? valuesFromRecord(editFields, editing as unknown as Record<string, unknown>) : {}}
        onSubmit={saveEdit} onClose={() => setEditing(null)} />

      <FormDialog open={moving !== null} fa={fa} mode="create" title={tr("ثبت تراکنش انبار", "Post stock movement")}
        description={moving ? `${moving.PartNumber} — ${tr("موجودی فعلی", "on hand")}: ${moving.QtyOnHand}` : undefined}
        fields={moveFields} initialValues={emptyValues(moveFields, { TransactionType: "receipt", Quantity: "1" })}
        submitLabel={tr("ثبت تراکنش", "Post")} onSubmit={saveMove} onClose={() => setMoving(null)} />
    </PanelShell>
  );
}

/* ═══════════════════════ ۵. برنامهٔ نت پیشگیرانه (PM) ═══════════════════════ */

const TRIGGER_TYPES = ["time", "meter", "condition", "combined"];
const INTERVAL_UNITS = ["hours", "days", "weeks", "months", "cycles", "km"];

export function CmmsPmPanel({ fa, siteId, userId }: PanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const can = useCmmsCan(userId, siteId);
  const canCreate = can("cmms.pm.edit");
  const [notice, setNotice] = useState<Notice>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Record<string, unknown> | null>(null);

  const schedules = useAsyncList(() => CmmsClient.listPmSchedules(siteId, userId, { limit: 500 }), [siteId, userId], describe);
  const assets = useAsyncList(() => CmmsClient.listAssets(siteId, userId, { limit: 500 }), [siteId, userId], describe);
  const assetTagById = new Map((assets.data?.assets ?? []).map((a) => [a.Id, a.AssetTag]));
  const assetOptions = (assets.data?.assets ?? []).map((a) => ({ value: a.Id, label: `${a.AssetTag} — ${a.NameFa}` }));
  const rows = (schedules.data?.schedules ?? []) as Array<Record<string, any>>;

  const createFields: FormFieldDef[] = [
    { name: "AssetId", label: tr("تجهیز", "Asset"), type: "select", required: true, options: assetOptions, fullWidth: true },
    { name: "ScheduleCode", label: tr("کد برنامه", "Schedule code"), required: true, maxLength: 60, ltr: true },
    { name: "TriggerType", label: tr("نوع محرک", "Trigger"), type: "select", required: true, options: TRIGGER_TYPES.map((v) => ({ value: v, label: v })) },
    {
      name: "IntervalValue", label: tr("تناوب", "Interval"), type: "number", min: 0.0001,
      validate: (value, values) => (values.TriggerType === "time" || values.TriggerType === "meter") && !value
        ? tr("این نوع محرک به تناوب نیاز دارد", "This trigger needs an interval") : null,
    },
    { name: "IntervalUnit", label: tr("واحد تناوب", "Interval unit"), type: "select", options: INTERVAL_UNITS.map((v) => ({ value: v, label: v })) },
    {
      name: "MeterDefinitionId", label: tr("کنتور مرجع", "Meter definition"), ltr: true,
      visibleWhen: (values) => values.TriggerType === "meter" || values.TriggerType === "combined",
      validate: (value, values) => (!value && (values.TriggerType === "meter" || values.TriggerType === "combined")
        ? tr("برنامهٔ کارکردمحور باید به کنتور وصل باشد", "Meter-based schedules must reference a meter") : null),
    },
    { name: "NextDueAt", label: tr("سررسید بعدی", "Next due"), type: "date" },
    { name: "Priority", label: tr("اولویت (۱ بالاترین)", "Priority (1 highest)"), type: "number", integer: true, min: 1, max: 5 },
    { name: "LeadTimeDays", label: tr("پیش‌آگهی (روز)", "Lead time (days)"), type: "number", integer: true, min: 0 },
    { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" },
  ];

  const saveCreate = async (payload: Record<string, unknown>) => {
    const body: Record<string, unknown> = { ...payload, NextDueAt: dayToIsoDateTime(payload.NextDueAt) ?? undefined };
    await CmmsClient.createPmSchedule(siteId, userId, body);
    setCreating(false);
    setNotice({ kind: "ok", text: tr("برنامهٔ PM ثبت شد.", "PM schedule created.") });
    schedules.reload();
  };

  const columns: GridColumnDef<Record<string, any>>[] = [
    { key: "ScheduleCode", header: tr("کد", "Code"), ltr: true } as GridColumnDef<Record<string, any>>,
    { key: "AssetTag", header: tr("تجهیز", "Asset"), accessor: (row) => assetTagById.get(row.AssetId) ?? "", filter: "auto" },
    { key: "TriggerType", header: tr("محرک", "Trigger"), filter: "auto" },
    { key: "IntervalValue", header: tr("تناوب", "Interval"), align: "center", ltr: true },
    { key: "IntervalUnit", header: tr("واحد", "Unit"), filter: "auto" },
    { key: "NextDueAt", header: tr("سررسید بعدی", "Next due"), ltr: true, accessor: (row) => (row.NextDueAt ? String(row.NextDueAt).slice(0, 10) : "") },
    { key: "Priority", header: tr("اولویت", "Priority"), align: "center", filter: PRIORITY_OPTIONS },
    {
      key: "IsActive", header: tr("فعال", "Active"),
      accessor: (row) => (row.IsActive ? "true" : "false"),
      render: (row) => (row.IsActive ? tr("فعال", "Active") : tr("غیرفعال", "Inactive")),
      filter: [{ value: "true", label: tr("فعال", "Active") }, { value: "false", label: tr("غیرفعال", "Inactive") }],
    },
  ];

  return (
    <PanelShell
      title={tr("برنامه‌ریزی نت پیشگیرانه", "Preventive maintenance planning")}
      hint={tr("برنامه‌های PM ثبت‌شده؛ ویرایش برنامه در سرور وجود ندارد و برای تغییر، برنامهٔ جدید ثبت می‌شود.", "Registered PM schedules. The server has no edit route, so changes are made by creating a new schedule.")}
    >
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <DataGrid
        fa={fa}
        rows={rows}
        columns={columns}
        rowKey={(row) => String(row.Id)}
        loading={schedules.loading}
        error={schedules.error}
        onRetry={schedules.reload}
        caption={tr("برنامه‌های PM", "PM schedules")}
        emptyText={tr("برنامهٔ PM ثبت نشده است", "No PM schedules")}
        actions={() => [{ key: "view", label: tr("مشاهده", "View"), onClick: setViewing, tone: "neutral" }]}
        toolbar={canCreate && (
          <button type="button" className={crudPrimaryBtnCls} onClick={() => setCreating(true)} disabled={(assets.data?.assets.length ?? 0) === 0}>
            {tr("+ برنامهٔ PM جدید", "+ New PM schedule")}
          </button>
        )}
      />

      <FormDialog open={creating} fa={fa} mode="create" wide title={tr("برنامهٔ PM جدید", "New PM schedule")} fields={createFields}
        initialValues={emptyValues(createFields, { TriggerType: "time", IntervalUnit: "days", IsActive: "true", Priority: "3" })}
        onSubmit={saveCreate} onClose={() => setCreating(false)} />

      <DetailDialog
        open={viewing !== null}
        fa={fa}
        title={viewing ? `${String(viewing.ScheduleCode)}` : ""}
        items={viewing ? Object.entries(viewing)
          .filter(([key]) => !["SiteId", "RowVersion", "Id"].includes(key))
          .map(([key, value]) => ({ label: key, value: value === null || value === undefined ? "—" : String(value), ltr: true })) : []}
        onClose={() => setViewing(null)}
      />
    </PanelShell>
  );
}

/* ═══════════════════════ ۶. هشدارها ═══════════════════════ */

export function CmmsAlertsPanel({ fa, siteId, userId }: PanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const can = useCmmsCan(userId, siteId);
  const canAck = can("cmms.alert.ack");
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resolving, setResolving] = useState<Record<string, any> | null>(null);

  const alerts = useAsyncList(() => CmmsClient.listAlerts(siteId, userId), [siteId, userId], describe);
  const assets = useAsyncList(() => CmmsClient.listAssets(siteId, userId, { limit: 500 }), [siteId, userId], describe);
  const assetOptions = (assets.data?.assets ?? []).map((a) => ({ value: a.Id, label: `${a.AssetTag} — ${a.NameFa}` }));
  const rows = (alerts.data?.alerts ?? []) as Array<Record<string, any>>;

  const createFields: FormFieldDef[] = [
    { name: "AlertCode", label: tr("کد هشدار", "Alert code"), required: true, maxLength: 60, ltr: true },
    { name: "Severity", label: tr("شدت", "Severity"), type: "select", required: true, options: SEVERITY_OPTIONS },
    {
      name: "Category", label: tr("دسته", "Category"), type: "select", required: true,
      options: ["condition", "pm-due", "pm-overdue", "spare-shortage", "sla-breach", "safety", "reliability", "ai-insight"].map((v) => ({ value: v, label: v })),
    },
    { name: "TitleFa", label: tr("عنوان", "Title"), required: true, maxLength: 300, fullWidth: true },
    { name: "MessageFa", label: tr("شرح", "Message"), type: "textarea", maxLength: 2000, fullWidth: true },
    { name: "AssetId", label: tr("تجهیز مرتبط", "Related asset"), type: "select", options: assetOptions },
    { name: "NotifyInApp", label: tr("اعلان درون‌برنامه‌ای", "In-app notification"), type: "checkbox" },
  ];

  const runAck = async (row: Record<string, any>) => {
    setBusyId(row.Id);
    setNotice(null);
    try {
      await CmmsClient.acknowledgeAlert(siteId, userId, row.Id);
      setNotice({ kind: "ok", text: tr(`هشدار ${row.AlertCode} تأیید شد.`, `Alert ${row.AlertCode} acknowledged.`) });
      alerts.reload();
    } catch (error) {
      setNotice({ kind: "error", text: describe(error) });
    } finally {
      setBusyId(null);
    }
  };

  const saveCreate = async (payload: Record<string, unknown>) => {
    await CmmsClient.createAlert(siteId, userId, payload);
    setCreating(false);
    setNotice({ kind: "ok", text: tr("هشدار ثبت شد.", "Alert raised.") });
    alerts.reload();
  };

  const confirmResolve = async (note: string) => {
    if (!resolving) return;
    await CmmsClient.resolveAlert(siteId, userId, resolving.Id, note ? { ResolutionNoteFa: note } : {});
    setResolving(null);
    setNotice({ kind: "ok", text: tr("هشدار بسته شد.", "Alert resolved.") });
    alerts.reload();
  };

  const columns: GridColumnDef<Record<string, any>>[] = [
    { key: "AlertCode", header: tr("کد", "Code"), ltr: true } as GridColumnDef<Record<string, any>>,
    { key: "Severity", header: tr("شدت", "Severity"), filter: SEVERITY_OPTIONS },
    { key: "Category", header: tr("دسته", "Category"), filter: "auto" },
    { key: "TitleFa", header: tr("عنوان", "Title") },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "RaisedAt", header: tr("زمان ثبت", "Raised at"), ltr: true, accessor: (row) => (row.RaisedAt ? String(row.RaisedAt).slice(0, 16).replace("T", " ") : "") },
  ];

  return (
    <PanelShell title={tr("هشدارهای پایش و نگهداری", "Condition & maintenance alerts")}
      hint={tr("تأیید و بستن هشدار ثبت می‌شود؛ هیچ هشداری خودکار بسته نمی‌شود.", "Acknowledge and resolve are recorded; nothing closes automatically.")}>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <DataGrid
        fa={fa}
        rows={rows}
        columns={columns}
        rowKey={(row) => String(row.Id)}
        loading={alerts.loading}
        error={alerts.error}
        onRetry={alerts.reload}
        caption={tr("فهرست هشدارها", "Alerts")}
        emptyText={tr("هشداری ثبت نشده است", "No alerts")}
        defaultSort={{ key: "Severity", dir: "asc" }}
        actions={(row) => [
          { key: "ack", label: tr("تأیید", "Acknowledge"), tone: "primary", hidden: row.Status !== "open", disabled: !canAck || busyId === row.Id, title: permTitle(canAck, "cmms.alert.ack", fa), onClick: (r) => void runAck(r) },
          { key: "resolve", label: tr("بستن", "Resolve"), tone: "ok", hidden: row.Status === "resolved", disabled: !canAck || busyId === row.Id, title: permTitle(canAck, "cmms.alert.ack", fa), onClick: setResolving },
        ]}
        toolbar={canAck && (
          <button type="button" className={crudPrimaryBtnCls} onClick={() => setCreating(true)}>{tr("+ ثبت هشدار دستی", "+ Raise alert")}</button>
        )}
      />

      <FormDialog open={creating} fa={fa} mode="create" wide title={tr("ثبت هشدار", "Raise alert")} fields={createFields}
        initialValues={emptyValues(createFields, { Severity: "medium", Category: "condition", NotifyInApp: "true" })}
        onSubmit={saveCreate} onClose={() => setCreating(false)} />

      <ConfirmDialog
        open={resolving !== null}
        fa={fa}
        title={tr("بستن هشدار", "Resolve alert")}
        message={resolving ? `${String(resolving.AlertCode)} — ${String(resolving.TitleFa)}` : ""}
        confirmLabel={tr("بستن هشدار", "Resolve")}
        reason={{ label: tr("شرح اقدام (اختیاری)", "Resolution note (optional)"), required: false }}
        onConfirm={confirmResolve}
        onCancel={() => setResolving(null)}
      />
    </PanelShell>
  );
}

/* ═══════════════════════ ۷. پیشنهادهای هوشمند ═══════════════════════ */

export function CmmsAiPanel({ fa, siteId, userId }: PanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const can = useCmmsCan(userId, siteId);
  const canDecide = can("cmms.ai.apply");
  const [notice, setNotice] = useState<Notice>(null);
  const [deciding, setDeciding] = useState<{ row: Record<string, any>; decision: "accept" | "reject" | "apply" } | null>(null);

  const recs = useAsyncList(() => CmmsClient.listRecommendations(siteId, userId), [siteId, userId], describe);
  const rows = (recs.data?.recommendations ?? []) as Array<Record<string, any>>;

  const decisionLabel = (decision: "accept" | "reject" | "apply") => ({
    accept: tr("پذیرش", "Accept"),
    reject: tr("رد", "Reject"),
    apply: tr("اعمال", "Apply"),
  })[decision];

  const confirmDecision = async (note: string) => {
    if (!deciding) return;
    await CmmsClient.decideRecommendation(siteId, userId, deciding.row.Id, {
      Decision: deciding.decision,
      ...(note ? { DecisionNoteFa: note } : {}),
    });
    const label = decisionLabel(deciding.decision);
    setDeciding(null);
    setNotice({ kind: "ok", text: tr(`پیشنهاد ${label} شد.`, `Recommendation ${label.toLowerCase()}d.`) });
    recs.reload();
  };

  const columns: GridColumnDef<Record<string, any>>[] = [
    { key: "Engine", header: tr("موتور", "Engine"), ltr: true, filter: "auto" } as GridColumnDef<Record<string, any>>,
    { key: "RecommendationType", header: tr("نوع", "Type"), filter: "auto" },
    { key: "TitleFa", header: tr("پیشنهاد", "Suggestion") },
    { key: "Confidence", header: tr("اطمینان", "Confidence"), align: "center", ltr: true, render: (row) => (row.Confidence != null ? `${Math.round(Number(row.Confidence) * (Number(row.Confidence) <= 1 ? 100 : 1))}%` : "—") },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
  ];

  return (
    <PanelShell title={tr("پیشنهادهای هوشمند نت", "Maintenance AI recommendations")}
      hint={tr("هیچ پیشنهادی خودکار اعمال نمی‌شود؛ پذیرش و اعمال جداگانه ثبت می‌شوند.", "Nothing is applied automatically; accepting and applying are separate, recorded decisions.")}>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <DataGrid
        fa={fa}
        rows={rows}
        columns={columns}
        rowKey={(row) => String(row.Id)}
        loading={recs.loading}
        error={recs.error}
        onRetry={recs.reload}
        caption={tr("پیشنهادهای هوشمند", "AI recommendations")}
        emptyText={tr("پیشنهادی ثبت نشده است", "No recommendations yet")}
        actions={(row) => [
          { key: "accept", label: tr("پذیرش", "Accept"), tone: "ok", hidden: row.Status !== "proposed", disabled: !canDecide, title: permTitle(canDecide, "cmms.ai.apply", fa), onClick: (r) => setDeciding({ row: r, decision: "accept" }) },
          { key: "reject", label: tr("رد", "Reject"), tone: "danger", hidden: row.Status !== "proposed", disabled: !canDecide, title: permTitle(canDecide, "cmms.ai.apply", fa), onClick: (r) => setDeciding({ row: r, decision: "reject" }) },
          { key: "apply", label: tr("اعمال مستقیم", "Apply directly"), tone: "primary", hidden: row.Status !== "proposed", disabled: !canDecide, title: permTitle(canDecide, "cmms.ai.apply", fa), onClick: (r) => setDeciding({ row: r, decision: "apply" }) },
        ]}
      />

      <ConfirmDialog
        open={deciding !== null}
        fa={fa}
        title={deciding ? `${decisionLabel(deciding.decision)} — ${String(deciding.row.TitleFa ?? "")}` : ""}
        message={tr("این تصمیم در دفتر ممیزی ثبت می‌شود.", "This decision is recorded in the audit log.")}
        confirmLabel={deciding ? decisionLabel(deciding.decision) : ""}
        danger={deciding?.decision === "reject"}
        reason={{ label: tr("یادداشت تصمیم (اختیاری)", "Decision note (optional)"), required: false }}
        onConfirm={confirmDecision}
        onCancel={() => setDeciding(null)}
      />
    </PanelShell>
  );
}

/* ═══════════════════════ ۸. شاخص‌های هدف (KPI) ═══════════════════════ */

const KPI_CATEGORIES = ["technical", "economic", "organizational"];
const KPI_DIRECTIONS = ["maximize", "minimize", "target"];
const KPI_PERIODS = ["daily", "weekly", "monthly", "quarterly", "yearly"];

export function CmmsKpiPanel({ fa, siteId, userId }: PanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const can = useCmmsCan(userId, siteId);
  const canEdit = can("cmms.kpi.edit");
  const [notice, setNotice] = useState<Notice>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Record<string, any> | null>(null);

  const kpis = useAsyncList(() => CmmsClient.listKpiTargets(siteId, userId), [siteId, userId], describe);
  const rows = (kpis.data?.targets ?? []) as Array<Record<string, any>>;

  const createFields: FormFieldDef[] = [
    { name: "KpiCode", label: tr("کد شاخص", "KPI code"), required: true, maxLength: 60, ltr: true, placeholder: "MTBF" },
    { name: "NameFa", label: tr("نام فارسی", "Persian name"), required: true, maxLength: 240, fullWidth: true },
    { name: "NameEn", label: tr("نام لاتین", "English name"), maxLength: 240, ltr: true },
    { name: "Category", label: tr("دسته", "Category"), type: "select", required: true, options: KPI_CATEGORIES.map((v) => ({ value: v, label: v })) },
    { name: "Uom", label: tr("واحد", "Unit"), required: true, maxLength: 24, ltr: true, placeholder: "h" },
    { name: "Direction", label: tr("جهت", "Direction"), type: "select", options: KPI_DIRECTIONS.map((v) => ({ value: v, label: v })) },
    { name: "PeriodType", label: tr("دورهٔ گزارش", "Period"), type: "select", options: KPI_PERIODS.map((v) => ({ value: v, label: v })) },
    { name: "TargetValue", label: tr("مقدار هدف", "Target value"), type: "number" },
    { name: "WarnThreshold", label: tr("آستانهٔ هشدار", "Warn threshold"), type: "number" },
    { name: "AlarmThreshold", label: tr("آستانهٔ آلارم", "Alarm threshold"), type: "number" },
    { name: "FormulaFa", label: tr("فرمول", "Formula"), type: "textarea", maxLength: 800, fullWidth: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
    { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" },
  ];

  const saveCreate = async (payload: Record<string, unknown>) => {
    await CmmsClient.createKpiTarget(siteId, userId, payload);
    setCreating(false);
    setNotice({ kind: "ok", text: tr("شاخص هدف ثبت شد.", "KPI target created.") });
    kpis.reload();
  };

  const columns: GridColumnDef<Record<string, any>>[] = [
    { key: "KpiCode", header: tr("کد", "Code"), ltr: true } as GridColumnDef<Record<string, any>>,
    { key: "NameFa", header: tr("شاخص", "KPI") },
    { key: "Category", header: tr("دسته", "Category"), filter: KPI_CATEGORIES.map((v) => ({ value: v, label: v })) },
    { key: "Uom", header: tr("واحد", "Unit"), ltr: true },
    { key: "TargetValue", header: tr("هدف", "Target"), align: "center", ltr: true },
    { key: "WarnThreshold", header: tr("هشدار", "Warn"), align: "center", ltr: true },
    { key: "AlarmThreshold", header: tr("آلارم", "Alarm"), align: "center", ltr: true },
    { key: "PeriodType", header: tr("دوره", "Period"), filter: "auto" },
  ];

  return (
    <PanelShell title={tr("شاخص‌های هدف نت", "Maintenance KPI targets")}
      hint={tr("اهداف ثبت‌شده؛ شاخص‌ها پس از ثبت اصلاح نمی‌شوند و برای تغییر، شاخص جدید ساخته می‌شود.", "Recorded targets. The server has no edit route for KPI targets; create a new one to change a target.")}>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <DataGrid
        fa={fa}
        rows={rows}
        columns={columns}
        rowKey={(row) => String(row.Id)}
        loading={kpis.loading}
        error={kpis.error}
        onRetry={kpis.reload}
        caption={tr("شاخص‌های هدف", "KPI targets")}
        emptyText={tr("شاخص هدفی ثبت نشده است", "No KPI targets")}
        actions={() => [{ key: "view", label: tr("مشاهده", "View"), onClick: setViewing, tone: "neutral" }]}
        toolbar={canEdit && (
          <button type="button" className={crudPrimaryBtnCls} onClick={() => setCreating(true)}>{tr("+ شاخص هدف جدید", "+ New KPI target")}</button>
        )}
      />

      <FormDialog open={creating} fa={fa} mode="create" wide title={tr("شاخص هدف جدید", "New KPI target")} fields={createFields}
        initialValues={emptyValues(createFields, { Category: "technical", Uom: "", Direction: "maximize", PeriodType: "monthly", IsActive: "true" })}
        onSubmit={saveCreate} onClose={() => setCreating(false)} />

      <DetailDialog
        open={viewing !== null}
        fa={fa}
        title={viewing ? `${String(viewing.KpiCode)} — ${String(viewing.NameFa)}` : ""}
        items={viewing ? describeRecord(createFields, viewing, { yes: tr("بله", "Yes"), no: tr("خیر", "No"), empty: "—" }) : []}
        onClose={() => setViewing(null)}
      />
    </PanelShell>
  );
}
