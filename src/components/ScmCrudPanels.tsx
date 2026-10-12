/**
 * بخش‌های تعاملی SCM: جدول با جستجو/فیلتر/مرتب‌سازی/صفحه‌بندی و ثبت/ویرایش/اقدام سطری.
 * ═══════════════════════════════════════════════════════════════════════
 * همه‌چیز از همان مسیرهای REST `/api/scm/:projectId/...` می‌گذرد؛ هیچ داده‌ای در
 * کلاینت ساخته نمی‌شود. مجوزها از `canScmAccess` می‌آیند (آینهٔ `evaluate` سرور)
 * و تصمیم نهایی همچنان با سرور است؛ دکمهٔ بی‌مجوز غیرفعال و با دلیل نشان داده
 * می‌شود، نه پنهان.
 *
 * یادداشت صداقت (چون سرور این مرزها را دارد):
 * ۱) فهرست‌ها از یک فراخوانی مشترک `GET /workspace` می‌آیند (پرمجوز
 *    `scm.package.view`) تا هر پنل یک درخواست جدا نزند؛ پس از هر تغییر موفق،
 *    همان فراخوانی دوباره خوانده می‌شود.
 * ۲) ویرایش سخت‌گیرانه است: فقط فیلدهایی به PATCH می‌روند که سرور پذیرفته است
 *    (مثلاً `Code` و `ReceivedAt` رسید قابل تغییر نیستند) و فرم ویرایش فقط
 *    همان فیلدها را نشان می‌دهد.
 * ۳) جایی که سرور مسیر ویرایش/حذف ندارد (انبار، کاتالوگ، کالا، استعلام حذف)،
 *    دکمه‌ای هم ساخته نشده است.
 * ۴) `finance` با API حسابداری رسمی (دفتر کل/بهای تمام‌شده) پر نمی‌شود؛ آن
 *    مسیرها در این ماژول پیاده نشده‌اند و پنل مالی صریحاً تجمیع برآوردی نشان
 *    می‌دهد، نه سند حسابداری.
 */
import { useMemo, type ReactNode } from "react";
import CrudResource, { type ResourceAction } from "./crud/CrudResource";
import DataGrid from "./crud/DataGrid";
import type { GridColumnDef } from "./crud/gridLogic";
import type { FormFieldDef } from "./crud/formLogic";
import { moduleCardCls } from "./ModuleWorkspaceShell";
import {
  callScm,
  canScmAccess,
  describeScmError,
  ScmClient,
  type ScmAvlRow,
  type ScmBalanceRow,
  type ScmBidderRow,
  type ScmBidReportRow,
  type ScmCatalogRow,
  type ScmClarificationRow,
  type ScmEvaluationRow,
  type ScmInquiryRow,
  type ScmInvitationRow,
  type ScmKomRow,
  type ScmMrcLineRow,
  type ScmMrcRow,
  type ScmMrChangeRow,
  type ScmMrrRow,
  type ScmMivLineRow,
  type ScmMivRow,
  type ScmMrvRow,
  type ScmMrRow,
  type ScmPackageMrLinkRow,
  type ScmPackageRow,
  type ScmProposalRow,
  type ScmPsrRow,
  type ScmShipmentRow,
  type ScmInspectionRow,
  type ScmTransferRow,
  type ScmVendorRow,
  type ScmWarehouseRow,
  type ScmWorkspacePayload,
} from "../services/scmApi";

export interface ScmPanelProps {
  fa: boolean;
  projectId: string;
  /** هویتی که در هدر `x-user-id` می‌رود و مبنای بررسی مجوز است. */
  userId: string;
  client: ScmClient;
  data: ScmWorkspacePayload | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/* ═══════════════════════ ابزارهای مشترک ═══════════════════════ */

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border b-line-soft bg-black/15 p-3 space-y-2">
      <header className="space-y-0.5">
        <h3 className="tx1 text-sm font-semibold">{title}</h3>
        {hint && <p className="tx3 text-[11px]">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

function rowsOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function opts(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

function optionRows<T>(items: T[], to: (item: T) => { value: string; label: string }) {
  return items.map(to);
}

const permTitle = (allowed: boolean, permission: string, fa: boolean) =>
  allowed ? undefined : fa ? `مجوز لازم: ${permission}` : `Required permission: ${permission}`;

/** «الف، ب» → `["الف","ب"]`؛ برای فیلدهای فهرستی که سرور آرایه می‌خواهد. */
function splitList(value: unknown): string[] | null {
  if (typeof value !== "string") return null;
  const items = value.split(/[,،]/).map((item) => item.trim()).filter(Boolean);
  return items.length ? items : null;
}

function joinList(value: unknown): string {
  return Array.isArray(value) ? value.join("، ") : "";
}

const VENDOR_STATUSES = ["active", "inactive", "blacklisted"] as const;
const PACKAGE_STATUSES = ["draft", "planned", "inquiry", "evaluation", "ordered", "closed", "cancelled"] as const;
const INQUIRY_STATUSES = ["draft", "issued", "closed", "cancelled"] as const;
const MRR_STATUSES = ["draft", "accepted", "rejected", "closed"] as const;

function useVocab(data: ScmWorkspacePayload | null) {
  return useMemo(() => {
    const vendors = rowsOf<ScmVendorRow>(data?.vendors);
    const packages = rowsOf<ScmPackageRow>(data?.packages);
    const mrs = rowsOf<ScmMrRow>(data?.mrs);
    const inquiries = rowsOf<ScmInquiryRow>(data?.inquiries);
    const proposals = rowsOf<ScmProposalRow>(data?.proposals);
    const warehouses = rowsOf<ScmWarehouseRow>(data?.warehouses);
    const catalog = rowsOf<ScmCatalogRow>(data?.catalog);
    const mrcs = rowsOf<ScmMrcRow>(data?.mrcs);
    const mivs = rowsOf<ScmMivRow>(data?.mivs);

    const vendorById = new Map(vendors.map((row) => [row.Id, row]));
    const packageById = new Map(packages.map((row) => [row.Id, row]));
    const inquiryById = new Map(inquiries.map((row) => [row.Id, row]));

    return {
      vendors,
      packages,
      mrs,
      inquiries,
      proposals,
      warehouses,
      catalog,
      mrcs,
      mivs,
      vendorCode: (id: string) => vendorById.get(id)?.Code ?? id,
      vendorName: (id: string) => vendorById.get(id)?.NameFa ?? "",
      packageCode: (id: string) => packageById.get(id)?.Code ?? id,
      inquiryCode: (id: string) => inquiryById.get(id)?.Code ?? id,
      vendorOptions: optionRows(vendors, (row) => ({ value: row.Code, label: `${row.Code} — ${row.NameFa}` })),
      packageOptions: optionRows(packages, (row) => ({ value: row.Code, label: `${row.Code} — ${row.TitleFa}` })),
      mrOptions: optionRows(mrs, (row) => ({ value: row.Code, label: `${row.Code} — ${row.TitleFa}` })),
      inquiryOptions: optionRows(inquiries, (row) => ({ value: row.Code, label: `${row.Code} — ${row.TitleFa}` })),
      proposalOptions: optionRows(proposals, (row) => ({
        value: row.ProposalNo,
        label: `${row.ProposalNo} — ${row.VendorCode}`,
      })),
      warehouseOptions: optionRows(warehouses, (row) => ({ value: row.Code, label: `${row.Code} — ${row.NameFa}` })),
      catalogOptions: optionRows(catalog, (row) => ({ value: row.Code, label: `${row.Code} — ${row.NameFa}` })),
      mrcOptions: optionRows(mrcs, (row) => ({ value: row.MrcNo, label: `${row.MrcNo} — ${row.RequiredDate}` })),
      mivOptions: optionRows(mivs, (row) => ({ value: row.MivNo, label: `${row.MivNo} — ${row.IssuedAt}` })),
    };
  }, [data]);
}

type Vocab = ReturnType<typeof useVocab>;

/** «کد — نام» فروشنده از شناسه؛ اگر رکورد پیدا نشود، همان شناسه برمی‌گردد. */
function vendorLabel(vocab: Vocab, vendorId: string): string {
  const code = vocab.vendorCode(vendorId);
  const name = vocab.vendorName(vendorId);
  return name ? `${code} — ${name}` : code;
}

/** فیلد کد انبار/کالا: اگر فهرست موجود باشد انتخابی، وگرنه متنی. */
function codeField(
  name: string,
  label: string,
  options: Array<{ value: string; label: string }>,
  required: boolean,
  tr: (fa: string, en: string) => string,
): FormFieldDef {
  if (options.length === 0) {
    return { name, label, required, ltr: true, hint: tr("فهرست مرجع خالی است؛ کد را دستی وارد کنید", "Reference list is empty; enter the code manually") };
  }
  return { name, label, type: "select", required, options };
}

/* ═══════════════════════ ۱. انبار، کاتالوگ و موجودی ═══════════════════════ */

export function ScmWarehousesPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canCreate = canScmAccess(userId, "scm.mrr.post");
  const rows = rowsOf<ScmWarehouseRow>(data?.warehouses);

  const fields: FormFieldDef[] = [
    { name: "Code", label: tr("کد انبار", "Warehouse code"), required: true, maxLength: 40, ltr: true },
    { name: "NameFa", label: tr("نام انبار", "Warehouse name"), required: true, maxLength: 200 },
    { name: "LocationFa", label: tr("موقعیت", "Location"), maxLength: 200 },
    { name: "Status", label: tr("وضعیت", "Status"), type: "select", options: opts(["active", "inactive"]) },
  ];

  const columns: GridColumnDef<ScmWarehouseRow>[] = [
    { key: "Code", header: tr("کد", "Code"), ltr: true },
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "LocationFa", header: tr("موقعیت", "Location") },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
  ];

  return (
    <CrudResource<ScmWarehouseRow>
      fa={fa}
      caption={tr("انبارها", "Warehouses")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("انباری ثبت نشده است", "No warehouse registered")}
      viewFields={fields}
      create={{
        title: tr("انبار جدید", "New warehouse"),
        fields,
        defaults: { Status: "active" },
        allowed: canCreate,
        deniedTitle: permTitle(canCreate, "scm.mrr.post", fa),
        submit: (payload) => callScm(client.createWarehouse(payload)),
        successText: tr("انبار ثبت شد.", "Warehouse created."),
      }}
    />
  );
}

export function ScmCatalogPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canCreate = canScmAccess(userId, "scm.mrr.post");
  const rows = rowsOf<ScmCatalogRow>(data?.catalog);

  const fields: FormFieldDef[] = [
    { name: "Code", label: tr("کد کالا", "Material code"), required: true, maxLength: 40, ltr: true },
    { name: "NameFa", label: tr("نام کالا", "Material name"), required: true, maxLength: 400 },
    { name: "Category", label: tr("دسته", "Category"), maxLength: 60 },
    { name: "Unit", label: tr("واحد", "Unit"), maxLength: 20, ltr: true },
    { name: "SpecFa", label: tr("مشخصات فنی", "Specification"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmCatalogRow>[] = [
    { key: "Code", header: tr("کد", "Code"), ltr: true },
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "Category", header: tr("دسته", "Category"), filter: "auto" },
    { key: "Unit", header: tr("واحد", "Unit"), ltr: true },
    { key: "SpecFa", header: tr("مشخصات", "Spec") },
  ];

  return (
    <CrudResource<ScmCatalogRow>
      fa={fa}
      caption={tr("کاتالوگ کالا", "Material catalog")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("کالایی در کاتالوگ نیست", "No catalog item")}
      viewFields={fields}
      create={{
        title: tr("کالای جدید", "New material"),
        fields,
        allowed: canCreate,
        deniedTitle: permTitle(canCreate, "scm.mrr.post", fa),
        submit: (payload) => callScm(client.createCatalog(payload)),
        successText: tr("کالا ثبت شد.", "Material created."),
      }}
    />
  );
}

export function ScmBalancesPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canPost = canScmAccess(userId, "scm.mrr.post");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmBalanceRow>(data?.balances);

  const fields: FormFieldDef[] = [
    codeField("WarehouseCode", tr("کد انبار", "Warehouse"), vocab.warehouseOptions, true, tr),
    codeField("MaterialCode", tr("کد کالا", "Material"), vocab.catalogOptions, true, tr),
    { name: "OnHand", label: tr("موجودی روی دست", "On hand"), type: "number", required: true, min: 0, ltr: true },
    { name: "Reserved", label: tr("رزرو‌شده", "Reserved"), type: "number", min: 0, ltr: true },
    { name: "OnOrder", label: tr("در راه", "On order"), type: "number", min: 0, ltr: true },
  ];

  const columns: GridColumnDef<ScmBalanceRow>[] = [
    { key: "WarehouseCode", header: tr("انبار", "Warehouse"), ltr: true, filter: "auto" },
    { key: "MaterialCode", header: tr("کالا", "Material"), ltr: true },
    { key: "OnHand", header: tr("موجودی", "On hand"), align: "end", ltr: true },
    { key: "Reserved", header: tr("رزرو", "Reserved"), align: "end", ltr: true },
    { key: "OnOrder", header: tr("در راه", "On order"), align: "end", ltr: true },
  ];

  return (
    <CrudResource<ScmBalanceRow>
      fa={fa}
      caption={tr("مانده موجودی", "Stock balances")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("مانده‌ای ثبت نشده است", "No stock balance")}
      viewFields={fields}
      create={{
        title: tr("ثبت/به‌روزرسانی مانده", "Upsert stock balance"),
        fields,
        defaults: { Reserved: "0", OnOrder: "0" },
        allowed: canPost,
        deniedTitle: permTitle(canPost, "scm.mrr.post", fa),
        submit: (payload) => callScm(client.upsertBalance(payload)),
        successText: tr(
          "مانده ثبت شد؛ در ردیف موجود، فقط «موجودی روی دست» به‌روزرسانی می‌شود.",
          "Balance saved; for an existing row only On-hand is updated.",
        ),
      }}
    />
  );
}

/* ═══════════════════════ ۲. خرید و تدارکات ═══════════════════════ */

export function ScmMrsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canManage = canScmAccess(userId, "scm.mr.manage");
  const rows = rowsOf<ScmMrRow>(data?.mrs);

  const fields: FormFieldDef[] = [
    { name: "Code", label: tr("شمارهٔ MR", "MR code"), required: true, maxLength: 40, ltr: true },
    { name: "TitleFa", label: tr("عنوان", "Title"), required: true, maxLength: 400, fullWidth: true },
    { name: "Discipline", label: tr("دیسیپلین", "Discipline"), maxLength: 40, ltr: true },
    { name: "Quantity", label: tr("مقدار", "Quantity"), type: "number", min: 0, ltr: true },
    { name: "Unit", label: tr("واحد", "Unit"), maxLength: 20, ltr: true },
    { name: "NeedByDate", label: tr("تاریخ نیاز", "Need-by date"), type: "date" },
    { name: "Status", label: tr("وضعیت", "Status"), maxLength: 30, ltr: true },
    { name: "RemarksFa", label: tr("ملاحظات", "Remarks"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmMrRow>[] = [
    { key: "Code", header: tr("کد", "Code"), ltr: true },
    { key: "TitleFa", header: tr("عنوان", "Title") },
    { key: "Discipline", header: tr("دیسیپلین", "Discipline"), filter: "auto", ltr: true },
    { key: "Quantity", header: tr("مقدار", "Qty"), align: "end", ltr: true },
    { key: "Unit", header: tr("واحد", "Unit"), ltr: true },
    { key: "NeedByDate", header: tr("تاریخ نیاز", "Need by"), ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
  ];

  return (
    <CrudResource<ScmMrRow>
      fa={fa}
      caption={tr("درخواست‌های مواد (MR)", "Material requests (MR)")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("MR ثبت نشده است", "No material request")}
      viewFields={fields}
      defaultSort={{ key: "Code", dir: "asc" }}
      create={{
        title: tr("MR جدید", "New MR"),
        fields,
        defaults: { Discipline: "piping", Status: "draft" },
        allowed: canManage,
        deniedTitle: permTitle(canManage, "scm.mr.manage", fa),
        submit: (payload) => callScm(client.createMr(payload)),
        successText: tr("MR ثبت شد.", "Material request created."),
      }}
    />
  );
}

export function ScmVendorsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.vendor.manage");
  const rows = rowsOf<ScmVendorRow>(data?.vendors);

  const fields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام فروشنده", "Vendor name"), required: true, maxLength: 300, fullWidth: true },
    { name: "NameEn", label: tr("نام لاتین", "English name"), maxLength: 300, ltr: true },
    { name: "ContactPerson", label: tr("شخص رابط", "Contact person"), maxLength: 200 },
    { name: "Email", label: tr("ایمیل", "Email"), maxLength: 200, ltr: true },
    { name: "Phone", label: tr("تلفن", "Phone"), maxLength: 60, ltr: true },
    { name: "Country", label: tr("کشور", "Country"), maxLength: 60 },
    { name: "City", label: tr("شهر", "City"), maxLength: 80 },
    { name: "Status", label: tr("وضعیت", "Status"), type: "select", options: opts(VENDOR_STATUSES) },
    { name: "Disciplines", label: tr("دیسیپلین‌ها (با کاما)", "Disciplines (comma)"), type: "textarea", fullWidth: true },
    { name: "MaterialCategories", label: tr("دسته‌های کالا (با کاما)", "Material categories (comma)"), type: "textarea", fullWidth: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];
  const createFields: FormFieldDef[] = [
    { name: "Code", label: tr("کد فروشنده", "Vendor code"), required: true, maxLength: 40, ltr: true },
    ...fields,
  ];

  const columns: GridColumnDef<ScmVendorRow>[] = [
    { key: "Code", header: tr("کد", "Code"), ltr: true },
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "Country", header: tr("کشور", "Country"), filter: "auto" },
    { key: "City", header: tr("شهر", "City") },
    { key: "Email", header: tr("ایمیل", "Email"), ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    {
      key: "Disciplines",
      header: tr("دیسیپلین‌ها", "Disciplines"),
      accessor: (row) => joinList(row.Disciplines),
      render: (row) => joinList(row.Disciplines) || "—",
    },
  ];

  return (
    <CrudResource<ScmVendorRow>
      fa={fa}
      caption={tr("فروشندگان و تأمین‌کنندگان", "Vendors")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("فروشنده‌ای ثبت نشده است", "No vendor registered")}
      viewFields={createFields}
      defaultSort={{ key: "Code", dir: "asc" }}
      create={{
        title: tr("فروشندهٔ جدید", "New vendor"),
        fields: createFields,
        defaults: { Status: "active" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.vendor.manage", fa),
        submit: (payload) =>
          callScm(
            client.createVendor({
              ...payload,
              Disciplines: splitList(payload.Disciplines),
              MaterialCategories: splitList(payload.MaterialCategories),
            }),
          ),
        successText: tr("فروشنده ثبت شد.", "Vendor created."),
      }}
      edit={{
        title: tr("ویرایش فروشنده", "Edit vendor"),
        fields,
        allowed,
        deniedTitle: permTitle(allowed, "scm.vendor.manage", fa),
        submit: (row, payload) =>
          callScm(
            client.updateVendor(row.Code, {
              ...payload,
              ...("Disciplines" in payload ? { Disciplines: splitList(payload.Disciplines) } : {}),
              ...("MaterialCategories" in payload ? { MaterialCategories: splitList(payload.MaterialCategories) } : {}),
            }),
          ),
        successText: tr("تغییرات فروشنده ذخیره شد.", "Vendor updated."),
      }}
      actions={(row): ResourceAction<ScmVendorRow>[] => [
        {
          key: "delete",
          label: tr("حذف", "Delete"),
          tone: "danger",
          disabled: () => !allowed,
          title: permTitle(allowed, "scm.vendor.manage", fa),
          confirm: {
            title: tr("حذف فروشنده", "Delete vendor"),
            message: tr(
              `فروشنده ${row.Code} حذف شود؟ اگر در AVL یا فهرست مناقصه استفاده شده باشد، سرور جلوی حذف را می‌گیرد.`,
              `Delete vendor ${row.Code}? The server blocks deletion when it is used in AVL or a bidder list.`,
            ),
            confirmLabel: tr("حذف", "Delete"),
            danger: true,
          },
          run: (target) => callScm(client.deleteVendor(target.Code)),
          successText: tr("فروشنده حذف شد.", "Vendor deleted."),
        },
        {
          key: "blacklist",
          label: tr("مسدودسازی", "Blacklist"),
          tone: "warn",
          hidden: (target) => target.Status === "blacklisted",
          disabled: () => !allowed,
          title: permTitle(allowed, "scm.vendor.manage", fa),
          confirm: {
            title: tr("مسدودسازی فروشنده", "Blacklist vendor"),
            message: tr(
              `فروشنده ${row.Code} مسدود شود؟ رکورد حذف نمی‌شود و سابقه می‌ماند.`,
              `Blacklist vendor ${row.Code}? The record is kept as history.`,
            ),
            confirmLabel: tr("مسدود کن", "Blacklist"),
            danger: true,
            reason: { label: tr("دلیل مسدودسازی", "Reason"), required: false },
          },
          run: (target, input) =>
            callScm(
              client.updateVendor(target.Code, {
                Status: "blacklisted",
                ...(input.reason ? { NoteFa: String(input.reason) } : {}),
              }),
            ),
          successText: tr("فروشنده مسدود شد.", "Vendor blacklisted."),
        },
      ]}
    />
  );
}

export function ScmAvlPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.vendor.manage");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmAvlRow>(data?.avls);

  const fields: FormFieldDef[] = [
    { name: "Discipline", label: tr("دیسیپلین", "Discipline"), required: true, maxLength: 40, ltr: true },
    { name: "MaterialCategory", label: tr("دستهٔ کالا", "Material category"), maxLength: 60 },
    { name: "Status", label: tr("وضعیت", "Status"), type: "select", options: opts(["approved", "suspended"]) },
    { name: "ExpiryAt", label: tr("انقضا", "Expiry"), type: "date" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 500, fullWidth: true },
  ];
  const createFields: FormFieldDef[] = [
    codeField("VendorCode", tr("کد فروشنده", "Vendor"), vocab.vendorOptions, true, tr),
    ...fields,
  ];

  const columns: GridColumnDef<ScmAvlRow>[] = [
    {
      key: "VendorId",
      header: tr("فروشنده", "Vendor"),
      accessor: (row) => vendorLabel(vocab, row.VendorId),
      ltr: true,
    },
    { key: "Discipline", header: tr("دیسیپلین", "Discipline"), filter: "auto", ltr: true },
    { key: "MaterialCategory", header: tr("دسته", "Category"), filter: "auto" },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "ExpiryAt", header: tr("انقضا", "Expiry"), ltr: true },
    { key: "ApprovedBy", header: tr("تأییدکننده", "Approved by"), ltr: true },
  ];

  return (
    <CrudResource<ScmAvlRow>
      fa={fa}
      caption={tr("فهرست تأمین‌کنندگان تأییدشده (AVL)", "Approved vendor list (AVL)")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("رکورد AVL ثبت نشده است", "No AVL entry")}
      viewFields={createFields}
      create={{
        title: tr("افزودن به AVL", "Add to AVL"),
        fields: createFields,
        defaults: { Status: "approved" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.vendor.manage", fa),
        submit: (payload) => callScm(client.createAvl(payload)),
        successText: tr("فروشنده برای این دیسیپلین/دسته تأیید شد.", "Vendor approved for this discipline/category."),
      }}
      actions={(row): ResourceAction<ScmAvlRow>[] => [
        {
          key: "delete",
          label: tr("حذف از AVL", "Remove"),
          tone: "danger",
          disabled: () => !allowed,
          title: permTitle(allowed, "scm.vendor.manage", fa),
          confirm: {
            title: tr("حذف از AVL", "Remove from AVL"),
            message: tr(
              `رکورد ${vocab.vendorCode(row.VendorId)} / ${row.Discipline} حذف شود؟ در SBL دیگر قابل استفاده نیست.`,
              `Remove ${vocab.vendorCode(row.VendorId)} / ${row.Discipline}? It can no longer be used in an SBL.`,
            ),
            confirmLabel: tr("حذف", "Remove"),
            danger: true,
          },
          run: (target) => callScm(client.deleteAvl(target.Id)),
          successText: tr("از AVL حذف شد.", "Removed from AVL."),
        },
      ]}
    />
  );
}

export function ScmPackagesPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.package.edit");
  const rows = rowsOf<ScmPackageRow>(data?.packages);

  const fields: FormFieldDef[] = [
    { name: "TitleFa", label: tr("عنوان بسته", "Package title"), required: true, maxLength: 400, fullWidth: true },
    { name: "Discipline", label: tr("دیسیپلین", "Discipline"), maxLength: 40, ltr: true },
    { name: "WbsId", label: tr("WBS", "WBS"), maxLength: 60, ltr: true },
    { name: "Status", label: tr("وضعیت", "Status"), type: "select", options: opts(PACKAGE_STATUSES) },
    { name: "PlannedIssueDate", label: tr("تاریخ صدور برنامه‌ای", "Planned issue date"), type: "date" },
    { name: "TotalEstimatedAmount", label: tr("مبلغ برآوردی", "Estimated amount"), type: "number", min: 0, ltr: true },
    { name: "Currency", label: tr("ارز", "Currency"), maxLength: 10, ltr: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];
  const createFields: FormFieldDef[] = [
    { name: "Code", label: tr("کد بسته", "Package code"), required: true, maxLength: 40, ltr: true },
    ...fields,
  ];

  const columns: GridColumnDef<ScmPackageRow>[] = [
    { key: "Code", header: tr("کد", "Code"), ltr: true },
    { key: "TitleFa", header: tr("عنوان", "Title") },
    { key: "Discipline", header: tr("دیسیپلین", "Discipline"), filter: "auto", ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "PlannedIssueDate", header: tr("تاریخ صدور", "Planned issue"), ltr: true },
    { key: "TotalEstimatedAmount", header: tr("مبلغ برآوردی", "Estimate"), align: "end", ltr: true },
    { key: "Currency", header: tr("ارز", "Ccy"), ltr: true },
  ];

  return (
    <CrudResource<ScmPackageRow>
      fa={fa}
      caption={tr("بسته‌های خرید", "Procurement packages")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("بستهٔ خریدی ثبت نشده است", "No procurement package")}
      viewFields={createFields}
      defaultSort={{ key: "Code", dir: "asc" }}
      create={{
        title: tr("بستهٔ خرید جدید", "New procurement package"),
        fields: createFields,
        defaults: { Status: "draft", Currency: "IRR" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.package.edit", fa),
        submit: (payload) => callScm(client.createPackage(payload)),
        successText: tr("بستهٔ خرید ثبت شد.", "Package created."),
      }}
      edit={{
        title: tr("ویرایش بستهٔ خرید", "Edit package"),
        fields,
        allowed,
        deniedTitle: permTitle(allowed, "scm.package.edit", fa),
        submit: (row, payload) => callScm(client.updatePackage(row.Code, payload)),
        successText: tr("بستهٔ خرید به‌روزرسانی شد.", "Package updated."),
      }}
      actions={(row): ResourceAction<ScmPackageRow>[] => [
        {
          key: "delete",
          label: tr("حذف", "Delete"),
          tone: "danger",
          disabled: () => !allowed,
          title: permTitle(allowed, "scm.package.edit", fa),
          confirm: {
            title: tr("حذف بستهٔ خرید", "Delete package"),
            message: tr(
              `بسته ${row.Code} حذف شود؟ اگر MR یا استعلام به آن پیوند خورده باشد، سرور جلوی حذف را می‌گیرد.`,
              `Delete package ${row.Code}? The server blocks this when an MR link or inquiry exists.`,
            ),
            confirmLabel: tr("حذف", "Delete"),
            danger: true,
          },
          run: (target) => callScm(client.deletePackage(target.Code)),
          successText: tr("بستهٔ خرید حذف شد.", "Package deleted."),
        },
      ]}
    />
  );
}

export function ScmPackageMrLinksPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.package.edit");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmPackageMrLinkRow>(data?.links);

  const createFields: FormFieldDef[] = [
    codeField("PackageCode", tr("بستهٔ خرید", "Package"), vocab.packageOptions, true, tr),
    codeField("MrCode", tr("شمارهٔ MR", "MR code"), vocab.mrOptions, true, tr),
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 300, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmPackageMrLinkRow>[] = [
    {
      key: "PackageId",
      header: tr("بسته", "Package"),
      accessor: (row) => vocab.packageCode(row.PackageId),
      ltr: true,
    },
    { key: "MrCode", header: tr("MR", "MR"), ltr: true },
    { key: "AddedBy", header: tr("افزوده‌شده توسط", "Added by"), ltr: true },
    { key: "AddedAt", header: tr("زمان افزودن", "Added at"), ltr: true },
    { key: "NoteFa", header: tr("یادداشت", "Note") },
  ];

  return (
    <CrudResource<ScmPackageMrLinkRow>
      fa={fa}
      caption={tr("پیوند MR به بستهٔ خرید", "Package ↔ MR links")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("پیوندی ثبت نشده است", "No link")}
      viewFields={createFields}
      create={{
        title: tr("پیوند MR به بسته", "Link MR to package"),
        fields: createFields,
        allowed,
        deniedTitle: permTitle(allowed, "scm.package.edit", fa),
        submit: (payload) =>
          callScm(client.linkMr(String(payload.PackageCode ?? ""), { MrCode: payload.MrCode, NoteFa: payload.NoteFa })),
        successText: tr("MR به بسته پیوند خورد.", "MR linked to package."),
      }}
      actions={(row): ResourceAction<ScmPackageMrLinkRow>[] => [
        {
          key: "unlink",
          label: tr("حذف پیوند", "Unlink"),
          tone: "danger",
          disabled: () => !allowed,
          title: permTitle(allowed, "scm.package.edit", fa),
          confirm: {
            title: tr("حذف پیوند", "Unlink MR"),
            message: tr(
              `پیوند ${vocab.packageCode(row.PackageId)} ↔ ${row.MrCode} حذف شود؟`,
              `Remove link ${vocab.packageCode(row.PackageId)} ↔ ${row.MrCode}?`,
            ),
            confirmLabel: tr("حذف پیوند", "Unlink"),
            danger: true,
          },
          run: (target) => callScm(client.unlinkMr(vocab.packageCode(target.PackageId), target.MrCode)),
          successText: tr("پیوند حذف شد.", "Link removed."),
        },
      ]}
    />
  );
}

export function ScmInquiriesPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.package.edit");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmInquiryRow>(data?.inquiries);

  const fields: FormFieldDef[] = [
    { name: "TitleFa", label: tr("عنوان استعلام", "Inquiry title"), required: true, maxLength: 400, fullWidth: true },
    { name: "IssueDate", label: tr("تاریخ صدور", "Issue date"), type: "date" },
    { name: "DueDate", label: tr("مهلت پیشنهاد", "Due date"), type: "date" },
    { name: "Status", label: tr("وضعیت", "Status"), type: "select", options: opts(INQUIRY_STATUSES) },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];
  const createFields: FormFieldDef[] = [
    { name: "Code", label: tr("کد استعلام", "Inquiry code"), required: true, maxLength: 40, ltr: true },
    codeField("PackageCode", tr("بستهٔ خرید", "Package"), vocab.packageOptions, true, tr),
    { name: "InquiryType", label: tr("نوع", "Type"), type: "select", options: opts(["rfq", "rfi", "itb"]) },
    ...fields,
  ];

  const columns: GridColumnDef<ScmInquiryRow>[] = [
    { key: "Code", header: tr("کد", "Code"), ltr: true },
    { key: "TitleFa", header: tr("عنوان", "Title") },
    {
      key: "PackageId",
      header: tr("بسته", "Package"),
      accessor: (row) => vocab.packageCode(row.PackageId),
      ltr: true,
    },
    { key: "InquiryType", header: tr("نوع", "Type"), filter: "auto", ltr: true },
    { key: "IssueDate", header: tr("صدور", "Issued"), ltr: true },
    { key: "DueDate", header: tr("مهلت", "Due"), ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
  ];

  return (
    <CrudResource<ScmInquiryRow>
      fa={fa}
      caption={tr("بسته‌های استعلام", "Inquiry packages")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("استعلامی ثبت نشده است", "No inquiry")}
      viewFields={createFields}
      create={{
        title: tr("استعلام جدید", "New inquiry"),
        fields: createFields,
        defaults: { InquiryType: "rfq", Status: "draft" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.package.edit", fa),
        submit: (payload) => callScm(client.createInquiry(payload)),
        successText: tr("استعلام ثبت شد.", "Inquiry created."),
      }}
      edit={{
        title: tr("ویرایش استعلام", "Edit inquiry"),
        fields,
        allowed,
        deniedTitle: permTitle(allowed, "scm.package.edit", fa),
        submit: (row, payload) => callScm(client.updateInquiry(row.Code, payload)),
        successText: tr("استعلام به‌روزرسانی شد.", "Inquiry updated."),
      }}
    />
  );
}

export function ScmBiddersPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.bidder.manage");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmBidderRow>(data?.bidders);

  const createFields: FormFieldDef[] = [
    codeField("InquiryCode", tr("استعلام", "Inquiry"), vocab.inquiryOptions, true, tr),
    codeField("VendorCode", tr("فروشنده", "Vendor"), vocab.vendorOptions, true, tr),
    { name: "ListType", label: tr("نوع فهرست", "List type"), type: "select", options: opts(["lbl", "sbl"]) },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 300, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmBidderRow>[] = [
    {
      key: "InquiryPackageId",
      header: tr("استعلام", "Inquiry"),
      accessor: (row) => vocab.inquiryCode(row.InquiryPackageId),
      ltr: true,
    },
    {
      key: "VendorId",
      header: tr("فروشنده", "Vendor"),
      accessor: (row) => vocab.vendorCode(row.VendorId),
      ltr: true,
    },
    { key: "ListType", header: tr("فهرست", "List"), filter: "auto", ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "InvitedAt", header: tr("زمان دعوت", "Invited"), ltr: true },
    { key: "AcknowledgedAt", header: tr("زمان پاسخ", "Acknowledged"), ltr: true },
  ];

  return (
    <CrudResource<ScmBidderRow>
      fa={fa}
      caption={tr("فهرست مناقصه‌گران (LBL/SBL)", "Bidder lists (LBL/SBL)")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("مناقصه‌گری ثبت نشده است", "No bidder")}
      viewFields={createFields}
      create={{
        title: tr("افزودن مناقصه‌گر", "Add bidder"),
        fields: createFields,
        defaults: { ListType: "sbl" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.bidder.manage", fa),
        submit: (payload) =>
          callScm(
            client.addBidder(String(payload.InquiryCode ?? ""), {
              VendorCode: payload.VendorCode,
              ListType: payload.ListType,
              NoteFa: payload.NoteFa,
            }),
          ),
        successText: tr("مناقصه‌گر افزوده شد.", "Bidder added."),
      }}
      actions={(): ResourceAction<ScmBidderRow>[] => [
        {
          key: "ack",
          label: tr("ثبت پاسخ", "Acknowledge"),
          tone: "ok",
          disabled: () => !allowed,
          title: permTitle(allowed, "scm.bidder.manage", fa),
          form: {
            title: tr("پاسخ مناقصه‌گر", "Bidder response"),
            fields: [
              { name: "AckStatus", label: tr("پاسخ", "Response"), type: "select", required: true, options: opts(["acknowledged", "declined"]) },
              {
                name: "DeclineReasonFa",
                label: tr("دلیل انصراف", "Decline reason"),
                type: "textarea",
                maxLength: 500,
                fullWidth: true,
                visibleWhen: (values) => values.AckStatus === "declined",
              },
            ],
            initialValues: () => ({ AckStatus: "acknowledged", DeclineReasonFa: "" }),
          },
          run: (target, input) =>
            callScm(
              client.ackBidder(vocab.inquiryCode(target.InquiryPackageId), vocab.vendorCode(target.VendorId), input),
            ),
          successText: tr("پاسخ ثبت شد.", "Response recorded."),
        },
        {
          key: "remove",
          label: tr("حذف", "Remove"),
          tone: "danger",
          disabled: () => !allowed,
          title: permTitle(allowed, "scm.bidder.manage", fa),
          confirm: {
            title: tr("حذف مناقصه‌گر", "Remove bidder"),
            message: tr(
              "این فروشنده از فهرست مناقصه‌گران این استعلام حذف شود؟",
              "Remove this vendor from the inquiry bidder list?",
            ),
            confirmLabel: tr("حذف", "Remove"),
            danger: true,
          },
          run: (target) =>
            callScm(
              client.removeBidder(vocab.inquiryCode(target.InquiryPackageId), vocab.vendorCode(target.VendorId)),
            ),
          successText: tr("مناقصه‌گر حذف شد.", "Bidder removed."),
        },
      ]}
    />
  );
}

export function ScmInvitationsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.bidder.manage");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmInvitationRow>(data?.invitations);

  const createFields: FormFieldDef[] = [
    codeField("InquiryCode", tr("استعلام", "Inquiry"), vocab.inquiryOptions, true, tr),
    codeField("VendorCode", tr("فروشنده", "Vendor"), vocab.vendorOptions, true, tr),
    { name: "InvitationNo", label: tr("شمارهٔ دعوت‌نامه", "Invitation no."), required: true, maxLength: 40, ltr: true },
    { name: "ValidUntil", label: tr("اعتبار تا", "Valid until"), type: "date" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 500, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmInvitationRow>[] = [
    { key: "InvitationNo", header: tr("شماره", "No."), ltr: true },
    {
      key: "InquiryPackageId",
      header: tr("استعلام", "Inquiry"),
      accessor: (row) => vocab.inquiryCode(row.InquiryPackageId),
      ltr: true,
    },
    {
      key: "VendorId",
      header: tr("فروشنده", "Vendor"),
      accessor: (row) => vocab.vendorCode(row.VendorId),
      ltr: true,
    },
    { key: "SentAt", header: tr("زمان ارسال", "Sent"), ltr: true },
    { key: "ValidUntil", header: tr("اعتبار", "Valid until"), ltr: true },
    { key: "AckStatus", header: tr("پاسخ", "Ack"), filter: "auto" },
  ];

  return (
    <CrudResource<ScmInvitationRow>
      fa={fa}
      caption={tr("دعوت‌نامه‌ها", "Invitations")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("دعوت‌نامه‌ای ثبت نشده است", "No invitation")}
      viewFields={createFields}
      create={{
        title: tr("دعوت‌نامهٔ جدید", "New invitation"),
        fields: createFields,
        allowed,
        deniedTitle: permTitle(allowed, "scm.bidder.manage", fa),
        submit: (payload) =>
          callScm(
            client.createInvitation({
              InquiryCode: payload.InquiryCode,
              VendorCode: payload.VendorCode,
              InvitationNo: payload.InvitationNo,
              ValidUntil: payload.ValidUntil,
              NoteFa: payload.NoteFa,
            }),
          ),
        successText: tr("دعوت‌نامه ثبت شد.", "Invitation created."),
      }}
      actions={(): ResourceAction<ScmInvitationRow>[] => [
        {
          key: "ack",
          label: tr("ثبت پاسخ", "Acknowledge"),
          tone: "ok",
          hidden: (target) => target.AckStatus === "accepted" || target.AckStatus === "declined",
          disabled: () => !allowed,
          title: permTitle(allowed, "scm.bidder.manage", fa),
          form: {
            title: tr("پاسخ به دعوت‌نامه", "Invitation response"),
            fields: [
              {
                name: "AckStatus",
                label: tr("پاسخ", "Response"),
                type: "select",
                required: true,
                options: opts(["accepted", "declined", "acknowledged"]),
              },
            ],
            initialValues: () => ({ AckStatus: "accepted" }),
          },
          run: (target, input) => callScm(client.ackInvitation(target.InvitationNo, input)),
          successText: tr("پاسخ دعوت‌نامه ثبت شد.", "Invitation response recorded."),
        },
      ]}
    />
  );
}

export function ScmMrChangesPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.package.edit");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmMrChangeRow>(data?.mrChanges);

  const createFields: FormFieldDef[] = [
    codeField("MrCode", tr("شمارهٔ MR", "MR code"), vocab.mrOptions, true, tr),
    {
      name: "ChangeType",
      label: tr("نوع تغییر", "Change type"),
      type: "select",
      required: true,
      options: opts(["quantity", "spec", "date", "cancel", "other"]),
    },
    { name: "OldValue", label: tr("مقدار قبلی", "Old value"), maxLength: 2000, fullWidth: true },
    { name: "NewValue", label: tr("مقدار جدید", "New value"), maxLength: 2000, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmMrChangeRow>[] = [
    { key: "MrCode", header: tr("MR", "MR"), ltr: true },
    { key: "ChangeType", header: tr("نوع تغییر", "Change"), filter: "auto", ltr: true },
    { key: "OldValue", header: tr("قبلی", "Old") },
    { key: "NewValue", header: tr("جدید", "New") },
    { key: "NotifyStatus", header: tr("اعلان", "Notify"), filter: "auto", ltr: true },
    { key: "ChangedAt", header: tr("زمان", "Changed at"), ltr: true },
  ];

  return (
    <CrudResource<ScmMrChangeRow>
      fa={fa}
      caption={tr("لاگ تغییرات MR", "MR change log")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("تغییری ثبت نشده است", "No change logged")}
      viewFields={createFields}
      create={{
        title: tr("ثبت تغییر MR", "Log MR change"),
        fields: createFields,
        allowed,
        deniedTitle: permTitle(allowed, "scm.package.edit", fa),
        submit: (payload) => callScm(client.createMrChange(payload)),
        successText: tr("تغییر ثبت شد و در وضعیت «در انتظار اعلان» است.", "Change logged and pending notification."),
      }}
      actions={(row): ResourceAction<ScmMrChangeRow>[] => [
        {
          key: "notify",
          label: tr("اعلان", "Notify"),
          tone: "primary",
          disabled: (target) => !allowed || target.NotifyStatus === "notified",
          title: !allowed
            ? permTitle(allowed, "scm.package.edit", fa)
            : row.NotifyStatus === "notified"
              ? tr("قبلاً اعلان شده است", "Already notified")
              : undefined,
          confirm: {
            title: tr("اعلان تغییر", "Notify change"),
            message: tr(
              "اعلان این تغییر ثبت شود؟ سرور اعلان تکراری را رد می‌کند.",
              "Mark this change as notified? The server rejects a duplicate notification.",
            ),
            confirmLabel: tr("اعلان", "Notify"),
          },
          run: (target) => callScm(client.notifyMrChange(target.Id)),
          successText: tr("اعلان ثبت شد.", "Notification recorded."),
        },
      ]}
    />
  );
}

export function ScmKomsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.package.edit");
  const rows = rowsOf<ScmKomRow>(data?.koms);

  const fields: FormFieldDef[] = [
    { name: "KomNo", label: tr("شمارهٔ جلسه", "KOM no."), required: true, maxLength: 40, ltr: true },
    { name: "PoNo", label: tr("شمارهٔ سفارش خرید", "PO no."), maxLength: 40, ltr: true },
    { name: "Type", label: tr("نوع", "Type"), type: "select", required: true, options: opts(["kom", "pim", "expediting"]) },
    { name: "MeetingDate", label: tr("تاریخ جلسه", "Meeting date"), type: "date", required: true },
    { name: "LocationFa", label: tr("محل", "Location"), maxLength: 200 },
    { name: "Status", label: tr("وضعیت", "Status"), maxLength: 20, ltr: true },
    { name: "NoteFa", label: tr("صورت‌جلسه/یادداشت", "Note"), type: "textarea", maxLength: 2000, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmKomRow>[] = [
    { key: "KomNo", header: tr("شماره", "No."), ltr: true },
    { key: "Type", header: tr("نوع", "Type"), filter: "auto", ltr: true },
    { key: "PoNo", header: tr("PO", "PO"), ltr: true },
    { key: "MeetingDate", header: tr("تاریخ", "Date"), ltr: true },
    { key: "LocationFa", header: tr("محل", "Location") },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
  ];

  return (
    <CrudResource<ScmKomRow>
      fa={fa}
      caption={tr("جلسات KOM/PIM و Expediting", "KOM/PIM & expediting meetings")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("جلسه‌ای ثبت نشده است", "No meeting")}
      viewFields={fields}
      create={{
        title: tr("جلسهٔ جدید", "New meeting"),
        fields,
        defaults: { Type: "kom", Status: "scheduled" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.package.edit", fa),
        submit: (payload) => callScm(client.createKom(payload)),
        successText: tr("جلسه ثبت شد.", "Meeting created."),
      }}
    />
  );
}

export function ScmPsrPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.package.edit");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmPsrRow>(data?.psrs);

  const fields: FormFieldDef[] = [
    { name: "PsrNo", label: tr("شمارهٔ گزارش", "PSR no."), required: true, maxLength: 40, ltr: true },
    { name: "PoNo", label: tr("شمارهٔ سفارش خرید", "PO no."), maxLength: 40, ltr: true },
    codeField("PackageCode", tr("بستهٔ خرید", "Package"), vocab.packageOptions, false, tr),
    { name: "ProgressPct", label: tr("درصد پیشرفت", "Progress %"), type: "number", min: 0, max: 100, ltr: true },
    { name: "ReportDate", label: tr("تاریخ گزارش", "Report date"), type: "date", required: true },
    { name: "StatusFa", label: tr("وضعیت (شرح)", "Status (text)"), type: "textarea", maxLength: 1000, fullWidth: true },
    { name: "NextActionFa", label: tr("اقدام بعدی", "Next action"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmPsrRow>[] = [
    { key: "PsrNo", header: tr("شماره", "No."), ltr: true },
    { key: "PackageCode", header: tr("بسته", "Package"), ltr: true },
    { key: "PoNo", header: tr("PO", "PO"), ltr: true },
    { key: "ProgressPct", header: tr("پیشرفت %", "Progress %"), align: "end", ltr: true },
    { key: "ReportDate", header: tr("تاریخ", "Date"), ltr: true },
    { key: "StatusFa", header: tr("وضعیت", "Status") },
  ];

  return (
    <CrudResource<ScmPsrRow>
      fa={fa}
      caption={tr("گزارش پیشرفت خرید (PSR)", "Procurement status reports (PSR)")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("گزارشی ثبت نشده است", "No report")}
      viewFields={fields}
      create={{
        title: tr("گزارش پیشرفت جدید", "New progress report"),
        fields,
        allowed,
        deniedTitle: permTitle(allowed, "scm.package.edit", fa),
        submit: (payload) => callScm(client.createPsr(payload)),
        successText: tr("گزارش ثبت شد.", "Report created."),
      }}
    />
  );
}

/* ═══════════════════════ ۳. بازرگانی (پیشنهاد، ارزیابی، گزارش مناقصه) ═══════════════════════ */

export function ScmProposalsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.bidder.manage");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmProposalRow>(data?.proposals);

  const fields: FormFieldDef[] = [
    { name: "ProposalNo", label: tr("شمارهٔ پیشنهاد", "Proposal no."), required: true, maxLength: 40, ltr: true },
    codeField("InquiryCode", tr("استعلام", "Inquiry"), vocab.inquiryOptions, true, tr),
    codeField("VendorCode", tr("فروشنده", "Vendor"), vocab.vendorOptions, true, tr),
    { name: "Type", label: tr("نوع", "Type"), type: "select", required: true, options: opts(["technical", "commercial", "both"]) },
    { name: "SubmittedAt", label: tr("تاریخ ارسال", "Submitted"), type: "date" },
    { name: "Amount", label: tr("مبلغ", "Amount"), type: "number", min: 0, ltr: true },
    { name: "Currency", label: tr("ارز", "Currency"), maxLength: 10, ltr: true },
    { name: "ValidUntil", label: tr("اعتبار تا", "Valid until"), type: "date" },
    { name: "Status", label: tr("وضعیت", "Status"), maxLength: 30, ltr: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmProposalRow>[] = [
    { key: "ProposalNo", header: tr("شماره", "No."), ltr: true },
    { key: "InquiryCode", header: tr("استعلام", "Inquiry"), ltr: true },
    { key: "VendorCode", header: tr("فروشنده", "Vendor"), ltr: true },
    { key: "Type", header: tr("نوع", "Type"), filter: "auto", ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "Amount", header: tr("مبلغ", "Amount"), align: "end", ltr: true },
    { key: "Currency", header: tr("ارز", "Ccy"), ltr: true },
    { key: "SubmittedAt", header: tr("ارسال", "Submitted"), ltr: true },
  ];

  return (
    <CrudResource<ScmProposalRow>
      fa={fa}
      caption={tr("پیشنهادهای فنی/بازرگانی", "Technical & commercial proposals")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("پیشنهادی ثبت نشده است", "No proposal")}
      viewFields={fields}
      create={{
        title: tr("پیشنهاد جدید", "New proposal"),
        fields,
        defaults: { Type: "both", Status: "submitted" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.bidder.manage", fa),
        submit: (payload) => callScm(client.createProposal(payload)),
        successText: tr("پیشنهاد ثبت شد.", "Proposal created."),
      }}
      actions={(): ResourceAction<ScmProposalRow>[] => [
        {
          key: "clarify",
          label: tr("شفاف‌سازی", "Clarify"),
          tone: "neutral",
          disabled: () => !allowed,
          title: permTitle(allowed, "scm.bidder.manage", fa),
          form: {
            title: tr("پرسش و پاسخ شفاف‌سازی", "Clarification Q&A"),
            fields: [
              { name: "QuestionFa", label: tr("پرسش", "Question"), type: "textarea", required: true, maxLength: 1000, fullWidth: true },
              { name: "AnswerFa", label: tr("پاسخ", "Answer"), type: "textarea", maxLength: 1000, fullWidth: true },
            ],
          },
          run: (target, input) => callScm(client.createClarification(target.ProposalNo, input)),
          successText: tr("شفاف‌سازی ثبت شد.", "Clarification recorded."),
        },
      ]}
    />
  );
}

export function ScmClarificationsPanel({ fa, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const rows = rowsOf<ScmClarificationRow>(data?.clarifications);

  const fields: FormFieldDef[] = [
    { name: "ProposalNo", label: tr("شمارهٔ پیشنهاد", "Proposal no."), ltr: true },
    { name: "QuestionFa", label: tr("پرسش", "Question"), fullWidth: true },
    { name: "AnswerFa", label: tr("پاسخ", "Answer"), fullWidth: true },
    { name: "Status", label: tr("وضعیت", "Status"), type: "select", options: opts(["open", "answered"]) },
    { name: "AskedAt", label: tr("زمان پرسش", "Asked at"), ltr: true },
    { name: "AnsweredAt", label: tr("زمان پاسخ", "Answered at"), ltr: true },
  ];

  const columns: GridColumnDef<ScmClarificationRow>[] = [
    { key: "ProposalNo", header: tr("پیشنهاد", "Proposal"), ltr: true },
    { key: "QuestionFa", header: tr("پرسش", "Question") },
    { key: "AnswerFa", header: tr("پاسخ", "Answer") },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "AskedAt", header: tr("زمان پرسش", "Asked at"), ltr: true },
  ];

  return (
    <CrudResource<ScmClarificationRow>
      fa={fa}
      caption={tr("شفاف‌سازی‌ها", "Clarifications")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("شفاف‌سازی‌ای ثبت نشده است", "No clarification")}
      viewFields={fields}
    />
  );
}

export function ScmEvaluationsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.bidder.manage");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmEvaluationRow>(data?.evaluations);

  const fields: FormFieldDef[] = [
    { name: "EvalNo", label: tr("شمارهٔ ارزیابی", "Evaluation no."), required: true, maxLength: 40, ltr: true },
    codeField("ProposalNo", tr("پیشنهاد", "Proposal"), vocab.proposalOptions, true, tr),
    { name: "Type", label: tr("نوع ارزیابی", "Evaluation type"), type: "select", required: true, options: opts(["tbe", "tba", "cbe"]) },
    { name: "Score", label: tr("امتیاز (۰–۱۰۰)", "Score (0–100)"), type: "number", min: 0, max: 100, ltr: true },
    { name: "Result", label: tr("نتیجه", "Result"), type: "select", required: true, options: opts(["pass", "fail", "conditional"]) },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmEvaluationRow>[] = [
    { key: "EvalNo", header: tr("شماره", "No."), ltr: true },
    { key: "ProposalNo", header: tr("پیشنهاد", "Proposal"), ltr: true },
    { key: "Type", header: tr("نوع", "Type"), filter: "auto", ltr: true },
    { key: "Score", header: tr("امتیاز", "Score"), align: "end", ltr: true },
    { key: "Result", header: tr("نتیجه", "Result"), filter: "auto", ltr: true },
    { key: "EvaluatedBy", header: tr("ارزیاب", "Evaluator"), ltr: true },
    { key: "EvaluatedAt", header: tr("زمان", "At"), ltr: true },
  ];

  return (
    <CrudResource<ScmEvaluationRow>
      fa={fa}
      caption={tr("ارزیابی‌ها (TBE/TBA/CBE)", "Evaluations (TBE/TBA/CBE)")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("ارزیابی‌ای ثبت نشده است", "No evaluation")}
      viewFields={fields}
      create={{
        title: tr("ارزیابی جدید", "New evaluation"),
        fields,
        defaults: { Type: "tbe", Result: "pass" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.bidder.manage", fa),
        submit: (payload) => callScm(client.createEvaluation(payload)),
        successText: tr("ارزیابی ثبت شد.", "Evaluation created."),
      }}
    />
  );
}

export function ScmBidReportsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.bidder.manage");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmBidReportRow>(data?.bidReports);

  const fields: FormFieldDef[] = [
    { name: "ReportNo", label: tr("شمارهٔ گزارش", "Report no."), required: true, maxLength: 40, ltr: true },
    codeField("InquiryCode", tr("استعلام", "Inquiry"), vocab.inquiryOptions, true, tr),
    codeField("WinnerVendorCode", tr("فروشندهٔ برنده", "Winning vendor"), vocab.vendorOptions, false, tr),
    { name: "TotalAmount", label: tr("مبلغ کل", "Total amount"), type: "number", min: 0, ltr: true },
    { name: "Currency", label: tr("ارز", "Currency"), maxLength: 10, ltr: true },
    { name: "RecommendationFa", label: tr("توصیه", "Recommendation"), type: "textarea", maxLength: 2000, fullWidth: true },
    { name: "Status", label: tr("وضعیت", "Status"), maxLength: 20, ltr: true },
  ];

  const columns: GridColumnDef<ScmBidReportRow>[] = [
    { key: "ReportNo", header: tr("شماره", "No."), ltr: true },
    { key: "InquiryCode", header: tr("استعلام", "Inquiry"), ltr: true },
    { key: "WinnerVendorCode", header: tr("برنده", "Winner"), ltr: true },
    { key: "TotalAmount", header: tr("مبلغ کل", "Total"), align: "end", ltr: true },
    { key: "Currency", header: tr("ارز", "Ccy"), ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "CreatedAt", header: tr("زمان", "Created at"), ltr: true },
  ];

  return (
    <CrudResource<ScmBidReportRow>
      fa={fa}
      caption={tr("گزارش‌های مناقصه (Bid Report)", "Bid reports")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("گزارشی ثبت نشده است", "No bid report")}
      viewFields={fields}
      create={{
        title: tr("گزارش جدید", "New bid report"),
        fields,
        defaults: { Status: "draft" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.bidder.manage", fa),
        submit: (payload) => callScm(client.createBidReport(payload)),
        successText: tr("گزارش ثبت شد.", "Bid report created."),
      }}
    />
  );
}

/* ═══════════════════════ ۴. ورود و خروج کالا (MRC/MIV/MRV/انتقال/رسید) ═══════════════════════ */

export function ScmMrcsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.mr.manage");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmMrcRow>(data?.mrcs);

  const fields: FormFieldDef[] = [
    { name: "MrcNo", label: tr("شمارهٔ درخواست مصرف", "MRC no."), required: true, maxLength: 40, ltr: true },
    { name: "RequiredDate", label: tr("تاریخ نیاز", "Required date"), type: "date", required: true },
    { name: "Status", label: tr("وضعیت", "Status"), maxLength: 20, ltr: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
    codeField("MaterialCode", tr("کد کالا (قلم اول)", "Material (first line)"), vocab.catalogOptions, true, tr),
    { name: "Quantity", label: tr("مقدار قلم", "Line quantity"), type: "number", min: 0, required: true, ltr: true },
  ];

  const columns: GridColumnDef<ScmMrcRow>[] = [
    { key: "MrcNo", header: tr("شماره", "No."), ltr: true },
    { key: "RequiredDate", header: tr("تاریخ نیاز", "Required"), ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "RequestedBy", header: tr("درخواست‌کننده", "Requested by"), ltr: true },
    { key: "NoteFa", header: tr("یادداشت", "Note") },
  ];

  return (
    <CrudResource<ScmMrcRow>
      fa={fa}
      caption={tr("درخواست‌های مصرف انبار (MRC)", "Material requisitions (MRC)")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("MRC ثبت نشده است", "No requisition")}
      viewFields={fields}
      create={{
        title: tr("MRC جدید (سر + یک قلم)", "New MRC (header + one line)"),
        fields,
        defaults: { Status: "draft" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.mr.manage", fa),
        submit: (payload) =>
          callScm(
            client.createMrc({
              MrcNo: payload.MrcNo,
              RequiredDate: payload.RequiredDate,
              Status: payload.Status,
              NoteFa: payload.NoteFa,
              Lines: payload.MaterialCode
                ? [{ MaterialCode: payload.MaterialCode, Quantity: payload.Quantity ?? 0 }]
                : [],
            }),
          ),
        successText: tr(
          "MRC با قلم اول ثبت شد؛ سرور خطوط را در همان درخواست می‌سازد.",
          "MRC created with its first line; the server creates lines in the same request.",
        ),
      }}
    />
  );
}

export function ScmMrcLinesPanel({ fa, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const rows = rowsOf<ScmMrcLineRow>(data?.mrcLines);

  const fields: FormFieldDef[] = [
    { name: "MrcNo", label: tr("شمارهٔ MRC", "MRC no."), ltr: true },
    { name: "MaterialCode", label: tr("کد کالا", "Material"), ltr: true },
    { name: "Quantity", label: tr("مقدار", "Quantity"), ltr: true },
    { name: "ReservedQty", label: tr("رزرو‌شده", "Reserved"), ltr: true },
  ];

  const columns: GridColumnDef<ScmMrcLineRow>[] = [
    { key: "MrcNo", header: tr("MRC", "MRC"), ltr: true, filter: "auto" },
    { key: "MaterialCode", header: tr("کالا", "Material"), ltr: true },
    { key: "Quantity", header: tr("مقدار", "Qty"), align: "end", ltr: true },
    { key: "ReservedQty", header: tr("رزرو", "Reserved"), align: "end", ltr: true },
  ];

  return (
    <CrudResource<ScmMrcLineRow>
      fa={fa}
      caption={tr("اقلام MRC", "MRC lines")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("قلمی ثبت نشده است", "No line")}
      viewFields={fields}
    />
  );
}

export function ScmMivsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.mrr.post");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmMivRow>(data?.mivs);

  const fields: FormFieldDef[] = [
    { name: "MivNo", label: tr("شمارهٔ حواله", "MIV no."), required: true, maxLength: 40, ltr: true },
    codeField("MrcNo", tr("MRC مرجع", "Reference MRC"), vocab.mrcOptions, false, tr),
    codeField("WarehouseCode", tr("انبار", "Warehouse"), vocab.warehouseOptions, true, tr),
    { name: "IssuedAt", label: tr("تاریخ صدور", "Issued at"), type: "date", required: true },
    codeField("MaterialCode", tr("کد کالا (قلم اول)", "Material (first line)"), vocab.catalogOptions, true, tr),
    { name: "Quantity", label: tr("مقدار قلم", "Line quantity"), type: "number", min: 0, required: true, ltr: true },
    { name: "NoteFa", label: tr("شرح مصرف", "Purpose"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmMivRow>[] = [
    { key: "MivNo", header: tr("شماره", "No."), ltr: true },
    { key: "MrcNo", header: tr("MRC", "MRC"), ltr: true },
    { key: "WarehouseCode", header: tr("انبار", "Warehouse"), ltr: true, filter: "auto" },
    { key: "IssuedAt", header: tr("تاریخ", "Issued"), ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "IssuedBy", header: tr("صادرکننده", "Issued by"), ltr: true },
  ];

  return (
    <CrudResource<ScmMivRow>
      fa={fa}
      caption={tr("حواله‌های مصرف (MIV)", "Goods issue notes (MIV)")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("حواله‌ای ثبت نشده است", "No issue note")}
      viewFields={fields}
      create={{
        title: tr("حوالهٔ مصرف جدید (سر + یک قلم)", "New issue note (header + one line)"),
        fields,
        allowed,
        deniedTitle: permTitle(allowed, "scm.mrr.post", fa),
        submit: (payload) =>
          callScm(
            client.createMiv({
              MivNo: payload.MivNo,
              MrcNo: payload.MrcNo,
              WarehouseCode: payload.WarehouseCode,
              IssuedAt: payload.IssuedAt,
              NoteFa: payload.NoteFa,
              Lines: payload.MaterialCode
                ? [{ MaterialCode: payload.MaterialCode, Quantity: payload.Quantity ?? 0 }]
                : [],
            }),
          ),
        successText: tr(
          "حواله ثبت شد؛ سرور موجودی «روی دست» را خودکار کم می‌کند.",
          "Issue note created; the server automatically reduces the on-hand balance.",
        ),
      }}
    />
  );
}

export function ScmMivLinesPanel({ fa, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const rows = rowsOf<ScmMivLineRow>(data?.mivLines);

  const fields: FormFieldDef[] = [
    { name: "MivNo", label: tr("شمارهٔ حواله", "MIV no."), ltr: true },
    { name: "MaterialCode", label: tr("کد کالا", "Material"), ltr: true },
    { name: "Quantity", label: tr("مقدار", "Quantity"), ltr: true },
  ];

  const columns: GridColumnDef<ScmMivLineRow>[] = [
    { key: "MivNo", header: tr("MIV", "MIV"), ltr: true, filter: "auto" },
    { key: "MaterialCode", header: tr("کالا", "Material"), ltr: true },
    { key: "Quantity", header: tr("مقدار", "Qty"), align: "end", ltr: true },
  ];

  return (
    <CrudResource<ScmMivLineRow>
      fa={fa}
      caption={tr("اقلام حواله", "Issue lines")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("قلمی ثبت نشده است", "No line")}
      viewFields={fields}
    />
  );
}

export function ScmMrvsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.mrr.post");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmMrvRow>(data?.mrvs);

  const fields: FormFieldDef[] = [
    { name: "MrvNo", label: tr("شمارهٔ مرجوعی", "MRV no."), required: true, maxLength: 40, ltr: true },
    codeField("MivNo", tr("حوالهٔ مرجع", "Reference MIV"), vocab.mivOptions, false, tr),
    codeField("WarehouseCode", tr("انبار", "Warehouse"), vocab.warehouseOptions, true, tr),
    { name: "ReturnedAt", label: tr("تاریخ مرجوعی", "Returned at"), type: "date", required: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmMrvRow>[] = [
    { key: "MrvNo", header: tr("شماره", "No."), ltr: true },
    { key: "MivNo", header: tr("MIV", "MIV"), ltr: true },
    { key: "WarehouseCode", header: tr("انبار", "Warehouse"), ltr: true, filter: "auto" },
    { key: "ReturnedAt", header: tr("تاریخ", "Returned"), ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
  ];

  return (
    <CrudResource<ScmMrvRow>
      fa={fa}
      caption={tr("مرجوعی‌ها (MRV)", "Material return vouchers (MRV)")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("مرجوعی‌ای ثبت نشده است", "No return voucher")}
      viewFields={fields}
      create={{
        title: tr("مرجوعی جدید", "New return voucher"),
        fields,
        allowed,
        deniedTitle: permTitle(allowed, "scm.mrr.post", fa),
        submit: (payload) => callScm(client.createMrv(payload)),
        successText: tr(
          "مرجوعی ثبت شد؛ سرور این سند را روی موجودی اعمال نمی‌کند (فقط ثبت سابقه).",
          "Return voucher recorded; the server does not post it to stock (record only).",
        ),
      }}
    />
  );
}

export function ScmTransfersPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.mrr.post");
  const vocab = useVocab(data);
  const rows = rowsOf<ScmTransferRow>(data?.transfers);

  const fields: FormFieldDef[] = [
    { name: "TransferNo", label: tr("شمارهٔ انتقال", "Transfer no."), required: true, maxLength: 40, ltr: true },
    codeField("FromWarehouse", tr("از انبار", "From warehouse"), vocab.warehouseOptions, true, tr),
    codeField("ToWarehouse", tr("به انبار", "To warehouse"), vocab.warehouseOptions, true, tr),
    codeField("MaterialCode", tr("کد کالا", "Material"), vocab.catalogOptions, true, tr),
    { name: "Quantity", label: tr("مقدار", "Quantity"), type: "number", min: 0, required: true, ltr: true },
    { name: "TransferredAt", label: tr("تاریخ انتقال", "Transferred at"), type: "date", required: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmTransferRow>[] = [
    { key: "TransferNo", header: tr("شماره", "No."), ltr: true },
    { key: "FromWarehouse", header: tr("از", "From"), ltr: true, filter: "auto" },
    { key: "ToWarehouse", header: tr("به", "To"), ltr: true, filter: "auto" },
    { key: "MaterialCode", header: tr("کالا", "Material"), ltr: true },
    { key: "Quantity", header: tr("مقدار", "Qty"), align: "end", ltr: true },
    { key: "TransferredAt", header: tr("تاریخ", "Date"), ltr: true },
  ];

  return (
    <CrudResource<ScmTransferRow>
      fa={fa}
      caption={tr("انتقال بین انبارها", "Stock transfers")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("انتقالی ثبت نشده است", "No transfer")}
      viewFields={fields}
      create={{
        title: tr("انتقال جدید", "New transfer"),
        fields,
        allowed,
        deniedTitle: permTitle(allowed, "scm.mrr.post", fa),
        submit: (payload) => callScm(client.createTransfer(payload)),
        successText: tr(
          "انتقال ثبت شد؛ سرور ماندهٔ مبدأ و مقصد را خودکار به‌روزرسانی می‌کند.",
          "Transfer recorded; the server updates both balances automatically.",
        ),
      }}
    />
  );
}

export function ScmMrrsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.mrr.post");
  const rows = rowsOf<ScmMrrRow>(data?.mrrs);

  const fields: FormFieldDef[] = [
    { name: "Code", label: tr("کد رسید", "Receipt code"), required: true, maxLength: 40, ltr: true },
    { name: "PoNo", label: tr("شمارهٔ سفارش خرید", "PO no."), required: true, maxLength: 40, ltr: true },
    { name: "ReceivedAt", label: tr("تاریخ رسید", "Received at"), type: "date", required: true },
    { name: "Quantity", label: tr("مقدار کل", "Total quantity"), type: "number", min: 0, ltr: true },
    { name: "AcceptedQty", label: tr("پذیرش‌شده", "Accepted"), type: "number", min: 0, ltr: true },
    { name: "RejectedQty", label: tr("رد‌شده", "Rejected"), type: "number", min: 0, ltr: true },
    { name: "OverQty", label: tr("اضافه", "Over"), type: "number", min: 0, ltr: true },
    { name: "ShortageQty", label: tr("کسری", "Shortage"), type: "number", min: 0, ltr: true },
    { name: "DamageQty", label: tr("آسیب‌دیده", "Damaged"), type: "number", min: 0, ltr: true },
    { name: "Status", label: tr("وضعیت", "Status"), type: "select", options: opts(MRR_STATUSES) },
    { name: "Warehouse", label: tr("انبار", "Warehouse"), maxLength: 60, ltr: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];
  /** فیلدهای قابل تغییر با PATCH سرور (بدون کد، PO و تاریخ رسید). */
  const editFields: FormFieldDef[] = fields.filter((field) =>
    ["AcceptedQty", "RejectedQty", "OverQty", "ShortageQty", "DamageQty", "Status", "Warehouse", "NoteFa"].includes(field.name),
  );

  const columns: GridColumnDef<ScmMrrRow>[] = [
    { key: "Code", header: tr("کد", "Code"), ltr: true },
    { key: "PoNo", header: tr("PO", "PO"), ltr: true },
    { key: "ReceivedAt", header: tr("تاریخ", "Received"), ltr: true },
    { key: "AcceptedQty", header: tr("پذیرش", "Accepted"), align: "end", ltr: true },
    { key: "RejectedQty", header: tr("رد", "Rejected"), align: "end", ltr: true },
    { key: "OpiType", header: tr("نوع مغایرت", "OPI"), filter: "auto", ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "Warehouse", header: tr("انبار", "Warehouse"), ltr: true },
  ];

  const patchStatus = (row: ScmMrrRow, status: string) => callScm(client.updateMrr(row.Code, { Status: status }));

  return (
    <CrudResource<ScmMrrRow>
      fa={fa}
      caption={tr("رسیدهای مواد (MRR/OPI)", "Material receiving (MRR/OPI)")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("رسیدی ثبت نشده است", "No receipt")}
      viewFields={fields}
      create={{
        title: tr("رسید مواد جدید", "New material receipt"),
        fields,
        defaults: { Status: "draft" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.mrr.post", fa),
        submit: (payload) => callScm(client.createMrr(payload)),
        successText: tr(
          "رسید ثبت شد؛ نوع مغایرت (OPI) از مقادیر اضافه/کسری/آسیب تعیین می‌شود.",
          "Receipt created; the OPI type is derived from over/shortage/damage quantities.",
        ),
      }}
      edit={{
        title: tr("ویرایش رسید", "Edit receipt"),
        fields: editFields,
        allowed,
        deniedTitle: permTitle(allowed, "scm.mrr.post", fa),
        submit: (row, payload) => callScm(client.updateMrr(row.Code, payload)),
        successText: tr("رسید به‌روزرسانی شد.", "Receipt updated."),
      }}
      actions={(row): ResourceAction<ScmMrrRow>[] => [
        {
          key: "accept",
          label: tr("پذیرش", "Accept"),
          tone: "ok",
          hidden: (target) => target.Status !== "draft",
          disabled: () => !allowed,
          title: permTitle(allowed, "scm.mrr.post", fa),
          confirm: {
            title: tr("پذیرش رسید", "Accept receipt"),
            message: row ? tr(`رسید ${row.Code} پذیرفته شود؟`, `Accept receipt ${row.Code}?`) : "",
            confirmLabel: tr("پذیرش", "Accept"),
          },
          run: (target) => patchStatus(target, "accepted"),
          successText: tr("رسید پذیرفته شد.", "Receipt accepted."),
        },
        {
          key: "reject",
          label: tr("رد", "Reject"),
          tone: "danger",
          hidden: (target) => target.Status !== "draft",
          disabled: () => !allowed,
          title: permTitle(allowed, "scm.mrr.post", fa),
          confirm: {
            title: tr("رد رسید", "Reject receipt"),
            message: tr(
              `رسید ${row.Code} رد شود؟ دلیل را بنویسید تا در سابقه بماند.`,
              `Reject receipt ${row.Code}? Write the reason so it stays in the record.`,
            ),
            confirmLabel: tr("رد", "Reject"),
            danger: true,
            reason: { label: tr("دلیل رد", "Reason"), required: false },
          },
          run: (target, input) =>
            callScm(
              client.updateMrr(target.Code, {
                Status: "rejected",
                ...(input.reason ? { NoteFa: String(input.reason) } : {}),
              }),
            ),
          successText: tr("رسید رد شد.", "Receipt rejected."),
        },
        {
          key: "close",
          label: tr("بستن", "Close"),
          tone: "neutral",
          hidden: (target) => target.Status === "closed",
          disabled: () => !allowed,
          title: permTitle(allowed, "scm.mrr.post", fa),
          confirm: {
            title: tr("بستن رسید", "Close receipt"),
            message: tr(`رسید ${row.Code} بسته شود؟`, `Close receipt ${row.Code}?`),
            confirmLabel: tr("بستن", "Close"),
          },
          run: (target) => patchStatus(target, "closed"),
          successText: tr("رسید بسته شد.", "Receipt closed."),
        },
      ]}
    />
  );
}

export function ScmInspectionsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.mrr.post");
  const rows = rowsOf<ScmInspectionRow>(data?.inspections);

  const fields: FormFieldDef[] = [
    { name: "InspectionNo", label: tr("شمارهٔ بازرسی", "Inspection no."), required: true, maxLength: 40, ltr: true },
    { name: "PoNo", label: tr("شمارهٔ سفارش خرید", "PO no."), maxLength: 40, ltr: true },
    { name: "Type", label: tr("نوع", "Type"), type: "select", required: true, options: opts(["factory", "site", "third_party"]) },
    { name: "Inspector", label: tr("بازرس", "Inspector"), maxLength: 100 },
    { name: "InspectionDate", label: tr("تاریخ بازرسی", "Inspection date"), type: "date", required: true },
    { name: "Result", label: tr("نتیجه", "Result"), type: "select", required: true, options: opts(["pass", "fail", "conditional"]) },
    { name: "ReleaseNoteNo", label: tr("شمارهٔ Release Note", "Release note no."), maxLength: 40, ltr: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 2000, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmInspectionRow>[] = [
    { key: "InspectionNo", header: tr("شماره", "No."), ltr: true },
    { key: "PoNo", header: tr("PO", "PO"), ltr: true },
    { key: "Type", header: tr("نوع", "Type"), filter: "auto", ltr: true },
    { key: "InspectionDate", header: tr("تاریخ", "Date"), ltr: true },
    { key: "Result", header: tr("نتیجه", "Result"), filter: "auto", ltr: true },
    { key: "ReleaseNoteNo", header: tr("Release", "Release"), ltr: true },
    { key: "Inspector", header: tr("بازرس", "Inspector") },
  ];

  return (
    <CrudResource<ScmInspectionRow>
      fa={fa}
      caption={tr("بازرسی و Release Note", "Inspections & release notes")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("بازرسی‌ای ثبت نشده است", "No inspection")}
      viewFields={fields}
      create={{
        title: tr("بازرسی جدید", "New inspection"),
        fields,
        defaults: { Type: "factory", Result: "pass" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.mrr.post", fa),
        submit: (payload) => callScm(client.createInspection(payload)),
        successText: tr("بازرسی ثبت شد.", "Inspection created."),
      }}
    />
  );
}

export function ScmShipmentsPanel({ fa, userId, client, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canScmAccess(userId, "scm.mrr.post");
  const rows = rowsOf<ScmShipmentRow>(data?.shipments);

  const fields: FormFieldDef[] = [
    { name: "ShipmentNo", label: tr("شمارهٔ حمل", "Shipment no."), required: true, maxLength: 40, ltr: true },
    { name: "PoNo", label: tr("شمارهٔ سفارش خرید", "PO no."), maxLength: 40, ltr: true },
    { name: "Mode", label: tr("شیوهٔ حمل", "Mode"), type: "select", required: true, options: opts(["road", "sea", "air", "rail"]) },
    { name: "OriginFa", label: tr("مبدأ", "Origin"), maxLength: 200 },
    { name: "DestinationFa", label: tr("مقصد", "Destination"), maxLength: 200 },
    { name: "EtaDate", label: tr("ETA", "ETA"), type: "date" },
    { name: "AtaDate", label: tr("ATA", "ATA"), type: "date" },
    { name: "CustomsStatus", label: tr("وضعیت ترخیص", "Customs status"), maxLength: 30, ltr: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<ScmShipmentRow>[] = [
    { key: "ShipmentNo", header: tr("شماره", "No."), ltr: true },
    { key: "PoNo", header: tr("PO", "PO"), ltr: true },
    { key: "Mode", header: tr("حمل", "Mode"), filter: "auto", ltr: true },
    { key: "OriginFa", header: tr("مبدأ", "Origin") },
    { key: "DestinationFa", header: tr("مقصد", "Destination") },
    { key: "EtaDate", header: tr("ETA", "ETA"), ltr: true },
    { key: "CustomsStatus", header: tr("ترخیص", "Customs"), filter: "auto", ltr: true },
  ];

  return (
    <CrudResource<ScmShipmentRow>
      fa={fa}
      caption={tr("حمل و ترخیص", "Shipments & customs")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={loading}
      error={error}
      onRetry={reload}
      onChanged={reload}
      describeError={describeScmError}
      emptyText={tr("حملی ثبت نشده است", "No shipment")}
      viewFields={fields}
      create={{
        title: tr("حمل جدید", "New shipment"),
        fields,
        defaults: { Mode: "sea", CustomsStatus: "pending" },
        allowed,
        deniedTitle: permTitle(allowed, "scm.mrr.post", fa),
        submit: (payload) => callScm(client.createShipment(payload)),
        successText: tr("حمل ثبت شد.", "Shipment created."),
      }}
    />
  );
}

/* ═══════════════════════ ۵. مالی: تجمیع برآوردی (بدون دفتر کل) ═══════════════════════ */

type WarehouseStockRow = { WarehouseCode: string; Items: number; OnHand: number; Reserved: number; OnOrder: number };
type CommitmentRow = {
  Code: string;
  TitleFa: string;
  Status: string;
  TotalEstimatedAmount: number | null;
  Currency: string;
  PlannedIssueDate: string | null;
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className={`${moduleCardCls} p-3 space-y-0.5`}>
      <div className="tx3 text-[11px]">{label}</div>
      <div className="tx1 text-lg font-semibold" dir="ltr">{value}</div>
      {hint && <div className="tx3 text-[10px]">{hint}</div>}
    </div>
  );
}

function sumBy<T>(rows: T[], pick: (row: T) => number | null | undefined): number {
  return rows.reduce((total, row) => total + Number(pick(row) ?? 0), 0);
}

export function ScmFinancePanel({ fa, data, loading, error, reload }: ScmPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const vocab = useVocab(data);
  const balances = rowsOf<ScmBalanceRow>(data?.balances);
  const packages = rowsOf<ScmPackageRow>(data?.packages);
  const proposals = rowsOf<ScmProposalRow>(data?.proposals);
  const mrrs = rowsOf<ScmMrrRow>(data?.mrrs);

  const stockRows = useMemo<WarehouseStockRow[]>(() => {
    const grouped = new Map<string, WarehouseStockRow>();
    for (const row of balances) {
      const current = grouped.get(row.WarehouseCode) ?? {
        WarehouseCode: row.WarehouseCode,
        Items: 0,
        OnHand: 0,
        Reserved: 0,
        OnOrder: 0,
      };
      current.Items += 1;
      current.OnHand += Number(row.OnHand ?? 0);
      current.Reserved += Number(row.Reserved ?? 0);
      current.OnOrder += Number(row.OnOrder ?? 0);
      grouped.set(row.WarehouseCode, current);
    }
    return [...grouped.values()].sort((a, b) => a.WarehouseCode.localeCompare(b.WarehouseCode));
  }, [balances]);

  const commitmentRows = useMemo<CommitmentRow[]>(
    () =>
      packages
        .map((row) => ({
          Code: row.Code,
          TitleFa: row.TitleFa,
          Status: row.Status ?? "—",
          TotalEstimatedAmount: row.TotalEstimatedAmount ?? null,
          Currency: row.Currency ?? "—",
          PlannedIssueDate: row.PlannedIssueDate ?? null,
        }))
        .sort((a, b) => a.Code.localeCompare(b.Code)),
    [packages],
  );

  const byCurrency = (values: Array<{ amount: number | null; currency: string }>) => {
    const map = new Map<string, number>();
    for (const item of values) {
      if (item.amount == null) continue;
      map.set(item.currency, (map.get(item.currency) ?? 0) + Number(item.amount));
    }
    return [...map.entries()].map(([currency, amount]) => `${currency} ${amount.toLocaleString("en-US")}`).join(" · ") || "—";
  };

  const openPackages = packages.filter((row) => row.Status !== "closed" && row.Status !== "cancelled").length;
  const acceptedQty = sumBy(mrrs, (row) => row.AcceptedQty);

  const stockColumns: GridColumnDef<WarehouseStockRow>[] = [
    { key: "WarehouseCode", header: tr("انبار", "Warehouse"), ltr: true },
    { key: "Items", header: tr("تعداد اقلام", "Items"), align: "end", ltr: true },
    { key: "OnHand", header: tr("موجودی", "On hand"), align: "end", ltr: true },
    { key: "Reserved", header: tr("رزرو", "Reserved"), align: "end", ltr: true },
    { key: "OnOrder", header: tr("در راه", "On order"), align: "end", ltr: true },
  ];

  const commitmentColumns: GridColumnDef<CommitmentRow>[] = [
    { key: "Code", header: tr("بسته", "Package"), ltr: true },
    { key: "TitleFa", header: tr("عنوان", "Title") },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "TotalEstimatedAmount", header: tr("مبلغ برآوردی", "Estimate"), align: "end", ltr: true },
    { key: "Currency", header: tr("ارز", "Ccy"), ltr: true },
    { key: "PlannedIssueDate", header: tr("تاریخ صدور", "Planned issue"), ltr: true },
  ];

  const hasData = balances.length > 0 || packages.length > 0 || proposals.length > 0 || mrrs.length > 0;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
        <div className="tx1 text-xs font-medium">
          {tr("این پنل سند حسابداری نیست", "This panel is not an accounting ledger")}
        </div>
        <p className="tx3 text-[11px] leading-5">
          {tr(
            "ماژول SCM در این نسخه API دفتر کل، بهای تمام‌شده و حساب‌های دریافتنی/پرداختنی ندارد؛ تنها مسیرهای موجود، خرید/بازرگانی و انبار/موجودی‌اند. اعداد زیر تجمیع مقداری و برآوردیِ همان داده‌های ثبت‌شده‌اند و برای تصمیم مالی کافی نیستند.",
            "This SCM module has no general-ledger, costing or AR/AP API yet; only procurement and inventory routes exist. The figures below are quantity/estimate aggregates of the recorded data, not accounting records.",
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[11px] tx1" role="alert">
          {error}
          <button type="button" onClick={reload} className="mx-2 underline">
            {tr("تلاش دوباره", "Retry")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={tr("انبارهای دارای مانده", "Warehouses with stock")} value={stockRows.length} />
        <Stat label={tr("اقلام دارای مانده", "Stocked items")} value={balances.length} hint={tr(`مجموع موجودی: ${sumBy(balances, (row) => row.OnHand)}`, `Total on hand: ${sumBy(balances, (row) => row.OnHand)}`)} />
        <Stat
          label={tr("بسته‌های خرید", "Procurement packages")}
          value={packages.length}
          hint={tr(`${openPackages} بستهٔ باز`, `${openPackages} open packages`)}
        />
        <Stat
          label={tr("مقدار پذیرش‌شدهٔ رسیدها", "Accepted receipt quantity")}
          value={acceptedQty}
          hint={tr(`${mrrs.length} رسید`, `${mrrs.length} receipts`)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Stat label={tr("مجموع مبلغ برآوردی بسته‌ها", "Total estimated packages")} value={byCurrency(packages.map((row) => ({ amount: row.TotalEstimatedAmount ?? null, currency: row.Currency ?? "—" })))} />
        <Stat label={tr("مجموع مبالغ پیشنهادها", "Total proposal amounts")} value={byCurrency(proposals.map((row) => ({ amount: row.Amount ?? null, currency: row.Currency ?? "—" })))} />
      </div>

      <Section
        title={tr("ماندهٔ موجودی به تفکیک انبار", "Stock on hand per warehouse")}
        hint={tr("تجمیع ردیف‌های ScmStockBalance؛ ارزش‌گذاری ریالی وجود ندارد", "Aggregated ScmStockBalance rows; no monetary valuation exists")}
      >
        <DataGrid
          fa={fa}
          rows={stockRows}
          columns={stockColumns}
          rowKey={(row) => row.WarehouseCode}
          loading={loading}
          emptyText={tr("مانده‌ای ثبت نشده است", "No stock balance")}
          caption={tr("موجودی به تفکیک انبار", "Stock per warehouse")}
        />
      </Section>

      <Section
        title={tr("تعهدات بسته‌های خرید", "Procurement package commitments")}
        hint={tr("مبالغ برآوردی ثبت‌شده در بسته‌ها — نه مبلغ قرارداد یا سفارش خرید", "Estimated package amounts — not contract or PO values")}
      >
        <DataGrid
          fa={fa}
          rows={commitmentRows}
          columns={commitmentColumns}
          rowKey={(row) => row.Code}
          loading={loading}
          emptyText={tr("بستهٔ خریدی ثبت نشده است", "No package")}
          caption={tr("برآورد بسته‌های خرید", "Package estimates")}
        />
      </Section>

      {!hasData && !loading && !error && (
        <div className="tx3 text-xs text-center py-4">
          {tr(
            "برای این پروژه داده‌ای ثبت نشده است؛ با ثبت انبار، کالا و بستهٔ خرید، این پنل پر می‌شود.",
            "No data for this project yet; register warehouses, materials and packages to populate this panel.",
          )}
        </div>
      )}

      <div className="tx3 text-[10px]" dir="ltr">
        project: {vocab.warehouses.length} warehouses · {vocab.catalog.length} catalog items
      </div>
    </div>
  );
}

/* ═══════════════════════ بخش‌های تب‌ها ═══════════════════════ */

export function ScmInventoryCrudSection(props: ScmPanelProps) {
  const t = (faText: string, enText: string) => (props.fa ? faText : enText);
  return (
    <div className="space-y-3">
      <Section
        title={t("انبارها و کاتالوگ کالا", "Warehouses & material catalog")}
        hint={t(
          "ثبت انبار و کالا از مسیرهای /warehouses و /catalog؛ سرور برای این دو موجودیت مسیر ویرایش/حذف ندارد.",
          "Warehouses and materials are created via /warehouses and /catalog; the server exposes no edit/delete for them.",
        )}
      >
        <ScmWarehousesPanel {...props} />
        <ScmCatalogPanel {...props} />
      </Section>
      <Section
        title={t("ماندهٔ موجودی", "Stock balances")}
        hint={t("ثبت ردیف جدید یا به‌روزرسانی «موجودی روی دست» ردیف موجود", "Create a row or update the on-hand of an existing one")}
      >
        <ScmBalancesPanel {...props} />
      </Section>
    </div>
  );
}

export function ScmPurchasingCrudSection(props: ScmPanelProps) {
  const t = (faText: string, enText: string) => (props.fa ? faText : enText);
  return (
    <div className="space-y-3">
      <Section title={t("فروشندگان و AVL", "Vendors & AVL")} hint={t("حذف فروشندهٔ در حال استفاده، توسط سرور رد می‌شود", "Deleting an in-use vendor is rejected by the server")}>
        <ScmVendorsPanel {...props} />
        <ScmAvlPanel {...props} />
      </Section>
      <Section title={t("درخواست‌های مواد (MR)", "Material requests (MR)")} hint={t("MR پایهٔ بستهٔ خرید و لاگ تغییرات است", "MRs are the basis for packages and change logs")}>
        <ScmMrsPanel {...props} />
        <ScmMrChangesPanel {...props} />
      </Section>
      <Section title={t("بسته‌های خرید و پیوند MR", "Packages & MR links")} hint={t("یکتایی کد و شرط حذف با سرور است", "Code uniqueness and delete guards live on the server")}>
        <ScmPackagesPanel {...props} />
        <ScmPackageMrLinksPanel {...props} />
      </Section>
      <Section title={t("استعلام، مناقصه‌گران و دعوت‌نامه", "Inquiries, bidders & invitations")} hint={t("افزودن به SBL نیازمند AVL تأییدشده است (قاعدهٔ سرور)", "Adding to an SBL requires an approved AVL entry (server rule)")}>
        <ScmInquiriesPanel {...props} />
        <ScmBiddersPanel {...props} />
        <ScmInvitationsPanel {...props} />
      </Section>
      <Section title={t("جلسات و گزارش پیشرفت خرید", "Meetings & procurement progress")}>
        <ScmKomsPanel {...props} />
        <ScmPsrPanel {...props} />
      </Section>
    </div>
  );
}

export function ScmCrmCrudSection(props: ScmPanelProps) {
  const t = (faText: string, enText: string) => (props.fa ? faText : enText);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border b-line-soft bg-black/15 p-3 space-y-1">
        <div className="tx1 text-xs font-medium">{t("دامنهٔ این تب", "Scope of this tab")}</div>
        <p className="tx3 text-[11px] leading-5">
          {t(
            "API فعلی SCM برای «مشتری/فروش» مسیری ندارد (پروندهٔ مشتری، پیش‌فاکتور، قرارداد فروش و سفارش مشتری پیاده نشده‌اند). آنچه اینجا مدیریت می‌شود، سمت بازرگانیِ مناقصه است: پیشنهاد فنی/بازرگانی، شفاف‌سازی، ارزیابی و گزارش مناقصه.",
            "The current SCM API has no customer/sales routes yet (customer accounts, quotations, sales contracts and sales orders are not implemented). This tab covers the commercial side of tendering: proposals, clarifications, evaluations and bid reports.",
          )}
        </p>
      </div>
      <Section title={t("پیشنهادها و شفاف‌سازی", "Proposals & clarifications")} hint={t("شفاف‌سازی از دکمهٔ سطری همین جدول ثبت می‌شود", "Clarifications are logged from this table's row action")}>
        <ScmProposalsPanel {...props} />
        <ScmClarificationsPanel {...props} />
      </Section>
      <Section title={t("ارزیابی و گزارش مناقصه", "Evaluation & bid report")}>
        <ScmEvaluationsPanel {...props} />
        <ScmBidReportsPanel {...props} />
      </Section>
    </div>
  );
}

export function ScmMovementsCrudSection(props: ScmPanelProps) {
  const t = (faText: string, enText: string) => (props.fa ? faText : enText);
  return (
    <div className="space-y-3">
      <Section title={t("درخواست مصرف (MRC)", "Requisitions (MRC)")} hint={t("سر و قلم اول در یک درخواست ثبت می‌شوند", "Header and first line are created in one request")}>
        <ScmMrcsPanel {...props} />
        <ScmMrcLinesPanel {...props} />
      </Section>
      <Section
        title={t("حوالهٔ مصرف (MIV)", "Goods issue (MIV)")}
        hint={t("سرور موجودی «روی دست» را به‌ازای هر قلم حواله کم می‌کند", "The server reduces on-hand stock per issue line")}
      >
        <ScmMivsPanel {...props} />
        <ScmMivLinesPanel {...props} />
      </Section>
      <Section
        title={t("مرجوعی و انتقال", "Returns & transfers")}
        hint={t("انتقال موجودی را جابه‌جا می‌کند؛ مرجوعی فقط سابقه است", "Transfers move stock; returns are record-only")}
      >
        <ScmMrvsPanel {...props} />
        <ScmTransfersPanel {...props} />
      </Section>
      <Section
        title={t("رسید مواد، بازرسی و حمل", "Receiving, inspection & shipment")}
        hint={t("رسید به PO وابسته است؛ OPI از مقادیر مغایرت تعیین می‌شود", "Receipts require an existing PO; OPI derives from the variance quantities")}
      >
        <ScmMrrsPanel {...props} />
        <ScmInspectionsPanel {...props} />
        <ScmShipmentsPanel {...props} />
      </Section>
    </div>
  );
}

export function ScmFinanceCrudSection(props: ScmPanelProps) {
  return (
    <Section
      title={props.fa ? "تجمیع مالی برآوردی" : "Estimated financial summary"}
      hint={props.fa ? "خواندنی؛ از همان دادهٔ خرید و انبار محاسبه می‌شود" : "Read-only; computed from the same procurement and stock data"}
    >
      <ScmFinancePanel {...props} />
    </Section>
  );
}
