/**
 * یک منبع CRUD کامل روی DataGrid: جدول (جستجو/فیلتر/مرتب‌سازی/صفحه‌بندی)،
 * ثبت، ویرایش، مشاهده، و اقدام‌های سطر (مستقیم، با تأیید، یا با فرم).
 * ═══════════════════════════════════════════════════════════════════════
 * این کامپوننت داده را خودش نمی‌گیرد: والد `rows/loading/error` را می‌دهد و
 * `onChanged` را برای تازه‌سازی بعد از هر تغییر موفق دریافت می‌کند.
 * دکمه‌های غیرمجاز غیرفعال و با دلیل نمایش داده می‌شوند؛ تصمیم نهایی با سرور است.
 */
import { useState, type ReactNode } from "react";
import DataGrid, { type RowAction } from "./DataGrid";
import type { GridColumnDef } from "./gridLogic";
import { ConfirmDialog, DetailDialog, FormDialog } from "./FormDialog";
import { describeRecord, emptyValues, valuesFromRecord, type FormFieldDef, type FormValues } from "./formLogic";
import { crudPrimaryBtnCls } from "./styles";

export type ResourceNotice = { kind: "ok" | "error"; text: string } | null;

type Maybe<T, V> = V | ((row: T) => V);

export interface ConfirmSpec {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  reason?: { label: string; required: boolean };
}

export interface FormSpec<T> {
  title: string;
  fields: FormFieldDef[];
  initialValues?: (row: T) => FormValues;
  submitLabel?: string;
}

export interface ResourceAction<T> {
  key: string;
  /** برچسب ثابت یا تابع سطر (مثلاً «فعال‌سازی» / «غیرفعال‌سازی»). */
  label: Maybe<T, string>;
  tone?: "neutral" | "primary" | "danger" | "warn" | "ok";
  hidden?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
  title?: string;
  /** تأیید پیش از اجرا؛ `reason` اختیاری یا الزامی است. */
  confirm?: Maybe<T, ConfirmSpec>;
  /** فرم ورودی پیش از اجرا (مثلاً تاریخ و شمارهٔ گواهی کالیبراسیون). */
  form?: Maybe<T, FormSpec<T>>;
  /** اجرای اقدام؛ ورودی شامل مقادیر فرم یا `reason` از تأیید است. */
  run: (row: T, input: Record<string, unknown>) => Promise<unknown>;
  /** متن موفقیت؛ می‌تواند از نتیجهٔ سرور استفاده کند. */
  successText?: string | ((row: T, result: unknown) => string);
}

function resolveMaybe<T, V>(value: Maybe<T, V> | undefined, row: T): V | undefined {
  if (value === undefined) return undefined;
  return typeof value === "function" ? (value as (row: T) => V)(row) : value;
}

export interface CrudResourceProps<T> {
  fa: boolean;
  caption: string;
  rows: T[];
  columns: GridColumnDef<T>[];
  rowKey: (row: T) => string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** پس از هر تغییر موفق صدا زده می‌شود (فهرست و داشبورد را تازه می‌کند). */
  onChanged: () => void;
  describeError: (error: unknown) => string;
  emptyText?: string;
  create?: {
    title: string;
    fields: FormFieldDef[];
    defaults?: FormValues;
    allowed: boolean;
    deniedTitle?: string;
    submit: (payload: Record<string, unknown>) => Promise<unknown>;
    successText?: string;
  };
  edit?: {
    title: string;
    fields: FormFieldDef[];
    allowed: boolean;
    deniedTitle?: string;
    submit: (row: T, payload: Record<string, unknown>) => Promise<unknown>;
    successText?: string;
    /** اگر true باشد ویرایش برای این سطر ممنوع است (مثلاً رکورد قفل‌شده). */
    locked?: (row: T) => boolean;
    lockedTitle?: string;
  };
  /** فیلدهای نمایش در مودال مشاهده؛ پیش‌فرض همان فیلدهای ویرایش. */
  viewFields?: FormFieldDef[];
  actions?: (row: T) => ResourceAction<T>[];
  /** محتوای کنار دکمهٔ ایجاد (مثلاً فیلتر دستگاه). */
  toolbarExtra?: ReactNode;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  defaultPageSize?: number;
  pageSizes?: number[];
}

type Pending<T> = { action: ResourceAction<T>; row: T } | null;

export default function CrudResource<T>(props: CrudResourceProps<T>) {
  const {
    fa, caption, rows, columns, rowKey, loading, error, onRetry, onChanged, describeError, emptyText,
    create, edit, viewFields, actions, toolbarExtra, defaultSort, defaultPageSize, pageSizes,
  } = props;
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const [notice, setNotice] = useState<ResourceNotice>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [viewing, setViewing] = useState<T | null>(null);
  const [pending, setPending] = useState<Pending<T>>(null);

  const successOf = (action: ResourceAction<T>, row: T, result: unknown) =>
    typeof action.successText === "function" ? action.successText(row, result) : action.successText ?? tr("انجام شد.", "Done.");

  /* اجرای اقدام؛ اگر `rethrow` باشد خطا به دیالوگ می‌رسد تا داخل آن نشان داده شود. */
  const execute = async (action: ResourceAction<T>, row: T, input: Record<string, unknown>, rethrow: boolean) => {
    setBusyKey(`${action.key}:${rowKey(row)}`);
    setNotice(null);
    try {
      const result = await action.run(row, input);
      setNotice({ kind: "ok", text: successOf(action, row, result) });
      setPending(null);
      onChanged();
    } catch (err) {
      if (rethrow) throw err;
      setNotice({ kind: "error", text: describeError(err) });
    } finally {
      setBusyKey(null);
    }
  };

  const startAction = (action: ResourceAction<T>, row: T) => {
    if (action.confirm || action.form) {
      setPending({ action, row });
      return;
    }
    void execute(action, row, {}, false);
  };

  const rowActions = (row: T): RowAction<T>[] => {
    const out: RowAction<T>[] = [];
    if (viewFields || edit) {
      out.push({ key: "view", label: tr("مشاهده", "View"), tone: "neutral", onClick: (r) => setViewing(r) });
    }
    if (edit) {
      const locked = edit.locked?.(row) ?? false;
      out.push({
        key: "edit",
        label: tr("ویرایش", "Edit"),
        tone: "primary",
        disabled: !edit.allowed || locked || busyKey !== null,
        title: locked ? edit.lockedTitle : !edit.allowed ? edit.deniedTitle : undefined,
        onClick: (r) => setEditing(r),
      });
    }
    for (const action of actions?.(row) ?? []) {
      if (action.hidden?.(row)) continue;
      out.push({
        key: action.key,
        label: resolveMaybe(action.label, row) ?? "",
        tone: action.tone,
        disabled: (action.disabled?.(row) ?? false) || busyKey !== null,
        title: action.title,
        onClick: (r) => startAction(action, r),
      });
    }
    return out;
  };

  const pendingAction = pending?.action;
  const pendingRow = pending?.row;
  const pendingConfirm = pendingAction && pendingRow !== undefined ? resolveMaybe(pendingAction.confirm, pendingRow) : undefined;
  const pendingForm = pendingAction && pendingRow !== undefined ? resolveMaybe(pendingAction.form, pendingRow) : undefined;

  return (
    <section className="space-y-3">
      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`rounded-xl border p-2.5 flex items-start justify-between gap-2 text-[11px] tx1 ${
            notice.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="tx3 hover:tx1" aria-label={tr("بستن پیام", "Dismiss")}>✕</button>
        </div>
      )}

      <DataGrid
        fa={fa}
        rows={rows}
        columns={columns}
        rowKey={rowKey}
        actions={rowActions}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyText={emptyText ?? tr("داده‌ای ثبت نشده است", "No records yet")}
        caption={caption}
        defaultSort={defaultSort}
        defaultPageSize={defaultPageSize}
        pageSizes={pageSizes}
        toolbar={(create || toolbarExtra) && (
          <div className="flex flex-wrap items-center gap-2">
            {toolbarExtra}
            {create && (
              <button
                type="button"
                className={crudPrimaryBtnCls}
                disabled={!create.allowed || busyKey !== null}
                title={!create.allowed ? create.deniedTitle : undefined}
                onClick={() => setCreating(true)}
              >
                {tr("+ ثبت جدید", "+ New")}
              </button>
            )}
          </div>
        )}
      />

      {create && (
        <FormDialog
          open={creating}
          fa={fa}
          mode="create"
          wide
          title={create.title}
          fields={create.fields}
          initialValues={emptyValues(create.fields, create.defaults ?? {})}
          onSubmit={async (payload) => {
            await create.submit(payload);
            setCreating(false);
            setNotice({ kind: "ok", text: create.successText ?? tr("ثبت شد.", "Created.") });
            onChanged();
          }}
          onClose={() => setCreating(false)}
        />
      )}

      {edit && (
        <FormDialog
          open={editing !== null}
          fa={fa}
          mode="edit"
          wide
          title={edit.title}
          fields={edit.fields}
          initialValues={editing ? valuesFromRecord(edit.fields, editing as unknown as Record<string, unknown>) : {}}
          onSubmit={async (payload) => {
            if (!editing) return;
            await edit.submit(editing, payload);
            setEditing(null);
            setNotice({ kind: "ok", text: edit.successText ?? tr("تغییرات ذخیره شد.", "Changes saved.") });
            onChanged();
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {(viewFields || edit) && (
        <DetailDialog
          open={viewing !== null}
          fa={fa}
          title={viewing ? `${caption} · ${rowKey(viewing)}` : ""}
          items={viewing ? describeRecord(viewFields ?? edit?.fields ?? [], viewing as unknown as Record<string, unknown>, {
            yes: tr("بله", "Yes"), no: tr("خیر", "No"), empty: "—",
          }) : []}
          onClose={() => setViewing(null)}
        />
      )}

      {pendingAction && pendingRow !== undefined && pendingForm && (
        <FormDialog
          open
          fa={fa}
          mode="create"
          title={pendingForm.title}
          fields={pendingForm.fields}
          initialValues={emptyValues(pendingForm.fields, pendingForm.initialValues?.(pendingRow) ?? {})}
          submitLabel={pendingForm.submitLabel}
          onSubmit={(payload) => execute(pendingAction, pendingRow, payload, true)}
          onClose={() => setPending(null)}
        />
      )}

      {pendingAction && pendingRow !== undefined && pendingConfirm && !pendingForm && (
        <ConfirmDialog
          open
          fa={fa}
          title={pendingConfirm.title}
          message={pendingConfirm.message}
          confirmLabel={pendingConfirm.confirmLabel}
          danger={pendingConfirm.danger}
          reason={pendingConfirm.reason}
          onConfirm={async (reason) => {
            await execute(pendingAction, pendingRow, reason ? { reason } : {}, true);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  );
}
