import type { ReactNode } from "react";

/**
 * منطق خالص جدول‌های تعاملی (جستجو، فیلتر، مرتب‌سازی، صفحه‌بندی).
 * ═══════════════════════════════════════════════════════════════════════
 * فقط نوع `ReactNode` را (برای `render`) وارد می‌کند؛ منطق بدون رندر قابل آزمون است.
 * ارقام فارسی/عربی و «ی/ك» عربی در جستجو یکسان‌سازی می‌شوند.
 */

export type SortDirection = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDirection;
}

export interface GridFilterOption {
  value: string;
  label: string;
}

export interface GridColumnDef<T> {
  key: string;
  header: string;
  /** مقدار خام برای مرتب‌سازی، فیلتر و جستجو؛ پیش‌فرض `row[key]`. */
  accessor?: (row: T) => unknown;
  /** اگر true باشد جستجوی آزاد این ستون را هم در نظر می‌گیرد (پیش‌فرض: بله). */
  searchable?: boolean;
  /** پیش‌فرض: بله. */
  sortable?: boolean;
  /** فیلتر انتخابی؛ `auto` یعنی مقادیر یکتای همان ستون. */
  filter?: "auto" | GridFilterOption[];
  /** نمایش سفارشی سلول؛ مقدار جستجو/مرتب‌سازی همچنان از `accessor` می‌آید. */
  render?: (row: T) => ReactNode;
  /** تراز سلول. */
  align?: "start" | "center" | "end";
  /** فونت یکنواخت برای کدها و شمارنده‌ها. */
  mono?: boolean;
  /** متن لاتین/عددی: جهت چپ‌به‌راست. */
  ltr?: boolean;
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** متن را برای جستجو و مقایسه یکسان می‌کند (ارقام، حروف عربی، فاصله، حروف کوچک). */
export function normalizeSearchText(input: unknown): string {
  if (input === null || input === undefined) return "";
  const raw = typeof input === "string" ? input : String(input);
  return raw
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .toLowerCase()
    .trim();
}

export function cellValueOf<T>(column: GridColumnDef<T>, row: T): unknown {
  if (column.accessor) return column.accessor(row);
  return (row as Record<string, unknown>)[column.key];
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** مقایسهٔ عددی-آگاه؛ خالی‌ها همیشه آخر فهرست می‌مانند. */
export function compareCellValues(a: unknown, b: unknown, dir: SortDirection = "asc"): number {
  const aEmpty = isEmptyValue(a);
  const bEmpty = isEmptyValue(b);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  let result: number;
  if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else if (typeof a === "boolean" && typeof b === "boolean") {
    result = Number(a) - Number(b);
  } else {
    result = normalizeSearchText(a).localeCompare(normalizeSearchText(b), undefined, { numeric: true, sensitivity: "base" });
  }
  return dir === "desc" ? -result : result;
}

export function rowMatchesFilters<T>(row: T, columns: GridColumnDef<T>[], filters: Record<string, string>): boolean {
  for (const [key, expected] of Object.entries(filters)) {
    if (!expected) continue;
    const column = columns.find((item) => item.key === key);
    if (!column) continue;
    const raw = cellValueOf(column, row);
    const actual = raw === null || raw === undefined ? "" : String(raw);
    if (actual !== expected) return false;
  }
  return true;
}

/** جستجوی آزاد: هر واژهٔ فاصله‌جداشده باید در یکی از ستون‌های جستجوپذیر باشد (AND). */
export function rowMatchesQuery<T>(row: T, columns: GridColumnDef<T>[], query: string): boolean {
  const needle = normalizeSearchText(query);
  if (!needle) return true;
  const haystack = columns
    .filter((column) => column.searchable !== false)
    .map((column) => normalizeSearchText(cellValueOf(column, row)))
    .join(" \u0000 ");
  return needle.split(/\s+/).every((token) => haystack.includes(token));
}

export interface ApplyGridOptions<T> {
  columns: GridColumnDef<T>[];
  query: string;
  filters: Record<string, string>;
  sort: SortState | null;
}

export function applyGrid<T>(rows: T[], options: ApplyGridOptions<T>): T[] {
  const { columns, query, filters, sort } = options;
  const filtered = rows.filter((row) => rowMatchesFilters(row, columns, filters) && rowMatchesQuery(row, columns, query));
  if (!sort) return filtered;
  const column = columns.find((item) => item.key === sort.key);
  if (!column) return filtered;
  return [...filtered].sort((a, b) => compareCellValues(cellValueOf(column, a), cellValueOf(column, b), sort.dir));
}

export interface PageSlice<T> {
  pageRows: T[];
  page: number;
  pageCount: number;
  total: number;
}

export function paginate<T>(rows: T[], page: number, pageSize: number): PageSlice<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const start = (safePage - 1) * size;
  return { pageRows: rows.slice(start, start + size), page: safePage, pageCount, total: rows.length };
}

/** گزینه‌های فیلتر `auto`: مقادیر یکتای غیرخالی ستون، مرتب‌شده. */
export function autoFilterOptions<T>(rows: T[], column: GridColumnDef<T>): GridFilterOption[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const raw = cellValueOf(column, row);
    if (isEmptyValue(raw)) continue;
    seen.add(String(raw));
  }
  return [...seen]
    .sort((a, b) => compareCellValues(a, b))
    .map((value) => ({ value, label: value }));
}

/** گزینه‌های واقعی یک فیلتر: یا فهرست ثابت ستون، یا مقادیر یکتای داده. */
export function resolveFilterOptions<T>(rows: T[], column: GridColumnDef<T>): GridFilterOption[] {
  if (!column.filter) return [];
  if (column.filter === "auto") return autoFilterOptions(rows, column);
  return column.filter;
}
