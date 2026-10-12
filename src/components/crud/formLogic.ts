/**
 * اعتبارسنجی و ساخت بدنهٔ درخواست برای فرم‌های ثبت/ویرایش.
 * ═══════════════════════════════════════════════════════════════════════
 * مقادیر فرم همیشه رشته‌اند (مطابق ورودی‌ها)؛ تبدیل به نوع واقعی فقط در
 * `buildPayload` انجام می‌شود تا خطای نوع در یک جا دیده شود.
 * هیچ وابستگی به React ندارد.
 */

export type FormFieldType = "text" | "number" | "select" | "textarea" | "date" | "datetime" | "checkbox";

export interface FormFieldOption {
  value: string;
  label: string;
}

export type FormValues = Record<string, string>;

export interface FormFieldDef {
  name: string;
  label: string;
  type?: FormFieldType;
  required?: boolean;
  options?: FormFieldOption[];
  min?: number;
  max?: number;
  integer?: boolean;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  ltr?: boolean;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  /** اعتبارسنجی سفارشی؛ رشتهٔ خطا یا null. */
  validate?: (value: string, values: FormValues) => string | null;
  /** نمایش شرطی؛ فیلد پنهان‌شده در بدنه هم نمی‌آید. */
  visibleWhen?: (values: FormValues) => boolean;
  /** اگر true باشد و مقدار خالی بماند، در بدنه `null` می‌رود (نه رشتهٔ خالی). پیش‌فرض: true. */
  nullIfEmpty?: boolean;
}

export interface FormMessages {
  required: string;
  notNumber: string;
  notInteger: string;
  tooSmall: (min: number) => string;
  tooLarge: (max: number) => string;
  tooLong: (max: number) => string;
  badDate: string;
}

export const FORM_MESSAGES_FA: FormMessages = {
  required: "این فیلد الزامی است",
  notNumber: "عدد معتبر وارد کنید",
  notInteger: "عدد صحیح وارد کنید",
  tooSmall: (min) => `مقدار نباید از ${min} کمتر باشد`,
  tooLarge: (max) => `مقدار نباید از ${max} بیشتر باشد`,
  tooLong: (max) => `حداکثر ${max} نویسه مجاز است`,
  badDate: "تاریخ معتبر نیست (قالب YYYY-MM-DD)",
};

export const FORM_MESSAGES_EN: FormMessages = {
  required: "This field is required",
  notNumber: "Enter a valid number",
  notInteger: "Enter a whole number",
  tooSmall: (min) => `Must be at least ${min}`,
  tooLarge: (max) => `Must be at most ${max}`,
  tooLong: (max) => `Maximum ${max} characters`,
  badDate: "Invalid date (format YYYY-MM-DD)",
};

export function visibleFields(fields: FormFieldDef[], values: FormValues): FormFieldDef[] {
  return fields.filter((field) => !field.visibleWhen || field.visibleWhen(values));
}

/** تاریخ YYYY-MM-DD که واقعاً وجود دارد (مثلاً ۲۰۲۶-۰۲-۳۰ معتبر نیست). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateField(field: FormFieldDef, value: string, values: FormValues, messages: FormMessages): string | null {
  const trimmed = value.trim();
  const type = field.type ?? "text";

  if (type === "checkbox") return null;

  if (trimmed === "") {
    return field.required ? messages.required : null;
  }

  if (type === "number") {
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return messages.notNumber;
    if (field.integer && !Number.isInteger(parsed)) return messages.notInteger;
    if (field.min !== undefined && parsed < field.min) return messages.tooSmall(field.min);
    if (field.max !== undefined && parsed > field.max) return messages.tooLarge(field.max);
  }

  if (type === "date" && !isValidIsoDate(trimmed)) return messages.badDate;
  if (type === "datetime" && Number.isNaN(Date.parse(trimmed))) return messages.badDate;

  if (field.maxLength !== undefined && trimmed.length > field.maxLength) return messages.tooLong(field.maxLength);

  if (field.pattern && !field.pattern.test(trimmed)) {
    return field.patternMessage ?? messages.required;
  }

  if (field.validate) return field.validate(trimmed, values);
  return null;
}

/** خطاها بر اساس نام فیلد؛ اگر خالی باشد فرم معتبر است. */
export function validateForm(
  fields: FormFieldDef[],
  values: FormValues,
  messages: FormMessages = FORM_MESSAGES_FA,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of visibleFields(fields, values)) {
    if (field.disabled) continue;
    const message = validateField(field, values[field.name] ?? "", values, messages);
    if (message) errors[field.name] = message;
  }
  return errors;
}

/**
 * ساخت بدنهٔ درخواست از مقادیر فرم.
 * - فیلدهای پنهان و غیرفعال حذف می‌شوند.
 * - عدد به `number`، چک‌باکس به `boolean`، خالی به `null` (اگر `nullIfEmpty`).
 */
export function buildPayload(fields: FormFieldDef[], values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of visibleFields(fields, values)) {
    if (field.disabled) continue;
    const type = field.type ?? "text";
    const raw = values[field.name] ?? "";
    if (type === "checkbox") {
      payload[field.name] = raw === "true";
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed === "") {
      payload[field.name] = field.nullIfEmpty === false ? "" : null;
      continue;
    }
    if (type === "number") {
      payload[field.name] = Number(trimmed);
      continue;
    }
    /* input[type=datetime-local] محلی است؛ سرور زمان ISO کامل (UTC) می‌خواهد. */
    if (type === "datetime") {
      payload[field.name] = new Date(trimmed).toISOString();
      continue;
    }
    payload[field.name] = trimmed;
  }
  return payload;
}

/** مقادیر اولیهٔ فرم از یک رکورد (برای پیش‌بارگذاری ویرایش). */
export function valuesFromRecord(fields: FormFieldDef[], record: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const field of fields) {
    const raw = record[field.name];
    if ((field.type ?? "text") === "checkbox") {
      out[field.name] = raw === true || raw === 1 || raw === "true" ? "true" : "false";
    } else if (raw === null || raw === undefined) {
      out[field.name] = "";
    } else if ((field.type ?? "text") === "date") {
      /* تاریخ‌های سرور اغلب ISO کامل‌اند؛ برای input[type=date] فقط روز لازم است. */
      out[field.name] = String(raw).slice(0, 10);
    } else if ((field.type ?? "text") === "datetime") {
      out[field.name] = toLocalDateTimeInput(raw);
    } else {
      out[field.name] = String(raw);
    }
  }
  return out;
}

/** مقادیر پیش‌فرض ساخت (ایجاد) با احترام به `defaults` فیلدها. */
export function emptyValues(fields: FormFieldDef[], overrides: FormValues = {}): FormValues {
  const out: FormValues = {};
  for (const field of fields) {
    out[field.name] = (field.type ?? "text") === "checkbox" ? "false" : "";
  }
  return { ...out, ...overrides };
}

/**
 * بدنهٔ ویرایش (PATCH): فقط فیلدهایی که نسبت به مقدار اولیه عوض شده‌اند.
 * سرورهای این سامانه کلیدهای ناشناخته را رد می‌کنند و PATCH خالی را نمی‌پذیرند،
 * پس ارسال کامل فرم هم ناپایدار است و هم اعتبارسنجی‌های اضافه اجرا می‌کند.
 */
export function diffPayload(
  fields: FormFieldDef[],
  initialValues: FormValues,
  values: FormValues,
): Record<string, unknown> {
  const before = buildPayload(fields, initialValues);
  const after = buildPayload(fields, values);
  const changed: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(after[key]) !== JSON.stringify(before[key])) changed[key] = after[key];
  }
  return changed;
}

/** `YYYY-MM-DD` → زمان ISO کامل (نیمه‌شب UTC)؛ برای ستون‌هایی که سرور datetime می‌خواهد. */
export function dayToIsoDateTime(value: unknown): unknown {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  return value;
}

/** نمای خوانای یک رکورد بر پایهٔ تعریف فیلدها (برای مودال مشاهده). */
export function describeRecord(
  fields: FormFieldDef[],
  record: Record<string, unknown>,
  labels: { yes: string; no: string; empty: string },
): Array<{ label: string; value: string; ltr: boolean }> {
  return fields.map((field) => {
    const raw = record[field.name];
    const type = field.type ?? "text";
    let value: string;
    if (raw === null || raw === undefined || raw === "") value = labels.empty;
    else if (type === "checkbox") value = raw === true || raw === 1 || raw === "true" ? labels.yes : labels.no;
    else if (type === "select") value = field.options?.find((option) => option.value === String(raw))?.label ?? String(raw);
    else if (type === "date") value = String(raw).slice(0, 10);
    else if (type === "datetime") value = toLocalDateTimeInput(raw).replace("T", " ") || labels.empty;
    else value = String(raw);
    return { label: field.label, value, ltr: Boolean(field.ltr) || type === "number" || type === "date" };
  });
}

/** ISO → `YYYY-MM-DDTHH:mm` به وقت محلی مرورگر؛ مقدار نامعتبر → رشتهٔ خالی. */
export function toLocalDateTimeInput(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
