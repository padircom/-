/**
 * مودال‌های عمومی CRUD: فرم ثبت/ویرایش با پیش‌بارگذاری و اعتبارسنجی،
 * نمایش جزئیات، و تأیید عملیات حساس (غیرفعال‌سازی، تغییر وضعیت).
 * ═══════════════════════════════════════════════════════════════════════
 * به‌جای `window.confirm`/`prompt` (که در محیط تعبیه‌شده مسدود می‌شوند)،
 * همه‌چیز با مودال داخلی انجام می‌شود.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import PersianDateInput from "../PersianDateInput";
import {
  buildPayload,
  diffPayload,
  FORM_MESSAGES_EN,
  FORM_MESSAGES_FA,
  validateForm,
  visibleFields,
  type FormFieldDef,
  type FormValues,
} from "./formLogic";
import { crudBtnCls, crudDangerBtnCls, crudInputCls, crudLabelCls, crudPrimaryBtnCls } from "./styles";

function useEscToClose(open: boolean, onClose: () => void, disabled: boolean) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !disabled) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, disabled]);
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "خطای ناشناخته در ارتباط با سرور";
}

function Shell({
  fa,
  title,
  description,
  onClose,
  closeDisabled,
  children,
  wide,
}: {
  fa: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  closeDisabled: boolean;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        dir={fa ? "rtl" : "ltr"}
        className={`glass-dark w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-[90vh] overflow-y-auto rounded-2xl p-5 space-y-4`}
      >
        <div className="flex items-start justify-between gap-3 border-b b-line-soft pb-3">
          <div>
            <h3 className="tx1 font-semibold text-sm">{title}</h3>
            {description && <p className="tx3 text-[11px] mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={fa ? "بستن" : "Close"}
            className="rounded-lg border b-line-soft px-2 py-0.5 text-xs tx2 hover:tx1 disabled:opacity-40"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════ فرم ثبت / ویرایش ═══════════════════════ */

export interface FormDialogProps {
  open: boolean;
  fa: boolean;
  mode: "create" | "edit";
  title: string;
  description?: string;
  fields: FormFieldDef[];
  /** مقادیر پیش‌بارگذاری‌شده (ویرایش) یا پیش‌فرض (ایجاد). */
  initialValues: FormValues;
  submitLabel?: string;
  /** بدنهٔ نهایی را با مقادیر تبدیل‌شده دریافت می‌کند؛ خطا را throw کند تا در فرم نشان داده شود. */
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  /** یادداشت بالای فرم، مثلاً «این رکورد تغییر کرده است». */
  notice?: ReactNode;
  wide?: boolean;
  /** Opt-in Jalali input for modules that require the Persian calendar. */
  persianDates?: boolean;
}

export function FormDialog({
  open,
  fa,
  mode,
  title,
  description,
  fields,
  initialValues,
  submitLabel,
  onSubmit,
  onClose,
  notice,
  wide,
  persianDates = false,
}: FormDialogProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLElement | null>(null);

  /* مقدار اولیه با هر بار باز شدن یا تغییر محتوای رکورد بازنشانی می‌شود —
   * نه با هر رندر والد، تا تایپ کاربر پاک نشود. */
  const initialKey = useMemo(() => JSON.stringify(initialValues), [initialValues]);
  useEffect(() => {
    if (!open) return;
    setValues(JSON.parse(initialKey) as FormValues);
    setErrors({});
    setServerError(null);
  }, [open, initialKey]);

  useEffect(() => {
    if (open) firstFieldRef.current?.focus();
  }, [open]);

  useEscToClose(open, onClose, submitting);
  if (!open) return null;

  const messages = fa ? FORM_MESSAGES_FA : FORM_MESSAGES_EN;
  const shownFields = visibleFields(fields, values);
  let firstAssigned = false;

  const setField = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setServerError(null);
    const found = validateForm(fields, values, messages);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    /* ویرایش: فقط تغییرات را می‌فرستیم. بدون تغییر، درخواستی به سرور نمی‌رود. */
    const payload = mode === "edit" ? diffPayload(fields, initialValues, values) : buildPayload(fields, values);
    if (mode === "edit" && Object.keys(payload).length === 0) {
      setServerError(tr("هیچ تغییری نسبت به مقدار فعلی وجود ندارد", "Nothing has changed"));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (error) {
      setServerError(errorText(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell fa={fa} title={title} description={description} onClose={onClose} closeDisabled={submitting} wide={wide}>
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {notice}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {shownFields.map((field) => {
            const type = field.type ?? "text";
            const value = values[field.name] ?? "";
            const error = errors[field.name];
            const isFirst = !firstAssigned;
            firstAssigned = true;
            const refProps = isFirst ? { ref: (node: HTMLElement | null) => { firstFieldRef.current = node; } } : {};
            const label = (
              <span className="flex items-center gap-1">
                {field.label}
                {field.required && <span className="text-rose-300" aria-hidden="true">*</span>}
              </span>
            );
            const common = {
              id: `crud-${field.name}`,
              name: field.name,
              "aria-invalid": error ? true : undefined,
              disabled: submitting || field.disabled,
              dir: field.ltr ? "ltr" as const : undefined,
              className: `${crudInputCls} ${error ? "border-rose-500/60" : ""}`,
              placeholder: field.placeholder,
            };

            let control: ReactNode;
            if (type === "checkbox") {
              control = (
                <label className="flex items-center gap-2 tx2 text-xs">
                  <input
                    {...refProps}
                    type="checkbox"
                    name={field.name}
                    checked={value === "true"}
                    disabled={submitting || field.disabled}
                    onChange={(event) => setField(field.name, event.target.checked ? "true" : "false")}
                  />
                  {label}
                </label>
              );
            } else if (type === "select") {
              control = (
                <select {...common} {...refProps} value={value} onChange={(event) => setField(field.name, event.target.value)}>
                  <option value="">{field.required ? tr("— انتخاب کنید —", "— select —") : tr("— بدون مقدار —", "— none —")}</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              );
            } else if (type === "textarea") {
              control = (
                <textarea
                  {...common}
                  {...refProps}
                  rows={3}
                  value={value}
                  onChange={(event) => setField(field.name, event.target.value)}
                />
              );
            } else if (persianDates && (type === "date" || type === "datetime")) {
              control = (
                <PersianDateInput
                  {...common}
                  inputRef={isFirst ? (node) => { firstFieldRef.current = node; } : undefined}
                  includeTime={type === "datetime"}
                  value={value}
                  onChange={(event) => setField(field.name, event.target.value)}
                />
              );
            } else {
              control = (
                <input
                  {...common}
                  {...refProps}
                  type={type === "number" ? "number" : type === "date" ? "date" : type === "datetime" ? "datetime-local" : "text"}
                  step={type === "number" && field.integer ? 1 : type === "number" ? "any" : undefined}
                  inputMode={type === "number" ? "decimal" : undefined}
                  value={value}
                  onChange={(event) => setField(field.name, event.target.value)}
                />
              );
            }

            return (
              <div key={field.name} className={`${field.fullWidth ? "md:col-span-2" : ""}`}>
                {type === "checkbox" ? control : <label className={crudLabelCls} htmlFor={`crud-${field.name}`}>{label}{control}</label>}
                {field.hint && !error && <span className="tx3 text-[10px]">{field.hint}</span>}
                {error && <span className="text-[10px] text-rose-300" role="alert">{error}</span>}
              </div>
            );
          })}
        </div>

        {serverError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] tx1" role="alert">
            {serverError}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t b-line-soft pt-3">
          <button type="button" onClick={onClose} disabled={submitting} className={crudBtnCls}>
            {tr("انصراف", "Cancel")}
          </button>
          <button type="submit" disabled={submitting} className={crudPrimaryBtnCls}>
            {submitting
              ? tr("در حال ذخیره…", "Saving…")
              : submitLabel ?? (mode === "create" ? tr("ثبت", "Create") : tr("ذخیرهٔ تغییرات", "Save changes"))}
          </button>
        </div>
      </form>
    </Shell>
  );
}

/* ═══════════════════════ نمایش جزئیات ═══════════════════════ */

export interface DetailItem {
  label: string;
  value: ReactNode;
  ltr?: boolean;
}

export function DetailDialog({
  open,
  fa,
  title,
  description,
  items,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  fa: boolean;
  title: string;
  description?: string;
  items: DetailItem[];
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  useEscToClose(open, onClose, false);
  if (!open) return null;
  return (
    <Shell fa={fa} title={title} description={description} onClose={onClose} closeDisabled={false} wide>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5 border-b b-line-soft pb-1.5">
            <dt className="tx3 text-[10px]">{item.label}</dt>
            <dd className="tx1 break-words" dir={item.ltr ? "ltr" : undefined}>{item.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {children}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t b-line-soft pt-3">
        {footer}
        <button type="button" onClick={onClose} className={crudBtnCls}>{fa ? "بستن" : "Close"}</button>
      </div>
    </Shell>
  );
}

/* ═══════════════════════ تأیید عملیات ═══════════════════════ */

export interface ConfirmDialogProps {
  open: boolean;
  fa: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** اگر تعریف شود، یک فیلد یادداشت نشان داده می‌شود. */
  reason?: { label: string; required: boolean; placeholder?: string };
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({ open, fa, title, message, confirmLabel, danger, reason, onConfirm, onCancel }: ConfirmDialogProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote("");
      setError(null);
    }
  }, [open]);

  useEscToClose(open, onCancel, busy);
  if (!open) return null;

  const missingReason = reason?.required && note.trim() === "";

  const confirm = async () => {
    if (missingReason) {
      setError(tr("یادداشت الزامی است", "A note is required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(note.trim());
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell fa={fa} title={title} onClose={onCancel} closeDisabled={busy}>
      <div className="tx2 text-xs leading-6">{message}</div>
      {reason && (
        <label className={crudLabelCls}>
          <span>{reason.label}{reason.required && <span className="text-rose-300"> *</span>}</span>
          <textarea
            rows={2}
            value={note}
            disabled={busy}
            placeholder={reason.placeholder}
            onChange={(event) => setNote(event.target.value)}
            className={crudInputCls}
          />
        </label>
      )}
      {error && <div className="text-[11px] text-rose-300" role="alert">{error}</div>}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t b-line-soft pt-3">
        <button type="button" onClick={onCancel} disabled={busy} className={crudBtnCls}>{tr("انصراف", "Cancel")}</button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy || missingReason}
          className={danger ? crudDangerBtnCls : crudPrimaryBtnCls}
        >
          {busy ? "…" : confirmLabel}
        </button>
      </div>
    </Shell>
  );
}
