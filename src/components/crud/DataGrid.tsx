/**
 * جدول تعاملی عمومی: جستجو، فیلتر ستونی، مرتب‌سازی، صفحه‌بندی و دکمه‌های ردیف.
 * ═══════════════════════════════════════════════════════════════════════
 * منطق داده در `gridLogic.ts` است؛ این فایل فقط نمایش و وضعیت UI را دارد.
 * دکمهٔ بی‌مجوز با `disabled` و `title` دلیل‌دار نمایش داده می‌شود (نه حذف)،
 * تا کاربر بداند چرا کاری انجام نمی‌شود. تصمیم نهایی همچنان با سرور است.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyGrid,
  cellValueOf,
  paginate,
  resolveFilterOptions,
  type GridColumnDef,
  type SortState,
} from "./gridLogic";
import { crudBtnCls, crudInputCls, crudToneCls } from "./styles";

export interface RowAction<T> {
  key: string;
  label: string;
  onClick: (row: T) => void;
  tone?: "neutral" | "primary" | "danger" | "warn" | "ok";
  disabled?: boolean;
  title?: string;
  hidden?: boolean;
}

export interface DataGridProps<T> {
  fa: boolean;
  rows: T[];
  columns: GridColumnDef<T>[];
  rowKey: (row: T) => string;
  actions?: (row: T) => RowAction<T>[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** دکمه‌های بالای جدول (مثلاً «ثبت جدید»). */
  toolbar?: ReactNode;
  emptyText?: string;
  searchPlaceholder?: string;
  pageSizes?: number[];
  defaultPageSize?: number;
  defaultSort?: SortState;
  /** ستون‌هایی که محتوایشان لاتین است (کد، شناسه). */
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** برچسب کوتاه بالای جدول برای خوانایی و دسترس‌پذیری. */
  caption?: string;
}

const DEFAULT_PAGE_SIZES = [10, 25, 50];

function displayValue(raw: unknown, fa: boolean): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  if (typeof raw === "boolean") return raw ? (fa ? "بله" : "Yes") : (fa ? "خیر" : "No");
  return String(raw);
}

export default function DataGrid<T>({
  fa,
  rows,
  columns,
  rowKey,
  actions,
  loading = false,
  error = null,
  onRetry,
  toolbar,
  emptyText,
  searchPlaceholder,
  pageSizes = DEFAULT_PAGE_SIZES,
  defaultPageSize = 10,
  defaultSort,
  rowClassName,
  onRowClick,
  caption,
}: DataGridProps<T>) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState | null>(defaultSort ?? null);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(1);

  const filterColumns = useMemo(() => columns.filter((column) => column.filter), [columns]);
  const filterOptions = useMemo(
    () => Object.fromEntries(filterColumns.map((column) => [column.key, resolveFilterOptions(rows, column)])),
    [filterColumns, rows],
  );

  const visibleRows = useMemo(
    () => applyGrid(rows, { columns, query, filters, sort }),
    [rows, columns, query, filters, sort],
  );
  const slice = paginate(visibleRows, page, pageSize);

  /* با تغییر جستجو/فیلتر به صفحهٔ اول برگرد؛ اگر داده کم شد، صفحه را کلمپ کن. */
  useEffect(() => {
    setPage(1);
  }, [query, filters, sort, pageSize]);
  useEffect(() => {
    if (page !== slice.page) setPage(slice.page);
  }, [page, slice.page]);

  const hasActiveFilter = query.trim() !== "" || Object.values(filters).some((value) => value !== "");

  const toggleSort = (column: GridColumnDef<T>) => {
    if (column.sortable === false) return;
    setSort((current) => {
      if (!current || current.key !== column.key) return { key: column.key, dir: "asc" };
      if (current.dir === "asc") return { key: column.key, dir: "desc" };
      return null;
    });
  };

  const sortMark = (column: GridColumnDef<T>) => {
    if (!sort || sort.key !== column.key) return "↕";
    return sort.dir === "asc" ? "▲" : "▼";
  };

  const totalColumns = columns.length + (actions ? 1 : 0);

  return (
    <div className="space-y-2" dir={fa ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label={tr("جستجو", "Search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder ?? tr("جستجو در همهٔ ستون‌ها…", "Search all columns…")}
          className={`${crudInputCls} max-w-xs`}
        />

        {filterColumns.map((column) => (
          <select
            key={column.key}
            aria-label={column.header}
            value={filters[column.key] ?? ""}
            onChange={(event) => setFilters((current) => ({ ...current, [column.key]: event.target.value }))}
            className={`${crudInputCls} w-auto min-w-[8rem]`}
          >
            <option value="">{`${column.header}: ${tr("همه", "All")}`}</option>
            {(filterOptions[column.key] ?? []).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ))}

        {hasActiveFilter && (
          <button
            type="button"
            className={crudBtnCls}
            onClick={() => {
              setQuery("");
              setFilters({});
            }}
          >
            {tr("پاک‌کردن فیلترها", "Clear filters")}
          </button>
        )}

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {toolbar}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 flex flex-wrap items-center justify-between gap-2">
          <span className="tx1 text-xs">{error}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className={crudBtnCls}>{tr("تلاش دوباره", "Retry")}</button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border b-line-soft">
        <table className="w-full text-xs" aria-label={caption}>
          <thead className="bg-black/25">
            <tr>
              {columns.map((column) => {
                const sortable = column.sortable !== false;
                return (
                  <th key={column.key} className="px-3 py-2 tx3 font-medium whitespace-nowrap text-start">
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className="inline-flex items-center gap-1 hover:tx1"
                        aria-label={`${column.header} — ${tr("مرتب‌سازی", "sort")}`}
                      >
                        <span>{column.header}</span>
                        <span className="text-[9px] opacity-70" aria-hidden="true">{sortMark(column)}</span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {actions && <th className="px-3 py-2 tx3 font-medium whitespace-nowrap text-start">{tr("اقدام", "Actions")}</th>}
            </tr>
          </thead>

          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={totalColumns} className="px-3 py-6 text-center tx3">{tr("در حال دریافت داده…", "Loading data…")}</td></tr>
            )}

            {!loading && slice.pageRows.length === 0 && (
              <tr>
                <td colSpan={totalColumns} className="px-3 py-6 text-center tx3">
                  {hasActiveFilter
                    ? tr("موردی با این جستجو/فیلتر پیدا نشد", "No rows match this search/filter")
                    : emptyText ?? tr("داده‌ای برای نمایش نیست", "No data to display")}
                </td>
              </tr>
            )}

            {slice.pageRows.map((row) => {
              const rowActions = actions ? actions(row).filter((action) => !action.hidden) : [];
              return (
                <tr
                  key={rowKey(row)}
                  className={`border-t b-line-soft ${onRowClick ? "cursor-pointer hover:bg-white/[0.03]" : ""} ${rowClassName ? rowClassName(row) : ""}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => {
                    const raw = cellValueOf(column, row);
                    const content = column.render ? column.render(row) : displayValue(raw, fa);
                    return (
                      <td key={column.key} className={`px-3 py-1.5 tx2 align-middle ${column.align === "center" ? "text-center" : ""}`} dir={column.ltr ? "ltr" : undefined}>
                        <span className={column.mono || column.ltr ? "font-mono" : ""}>{content}</span>
                      </td>
                    );
                  })}
                  {actions && (
                    <td className="px-3 py-1.5 align-middle">
                      <div className="flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
                        {rowActions.map((action) => (
                          <button
                            key={action.key}
                            type="button"
                            disabled={action.disabled}
                            title={action.title}
                            aria-label={action.label}
                            onClick={() => action.onClick(row)}
                            className={`rounded-md px-2 py-0.5 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-40 ${crudToneCls[action.tone ?? "neutral"]}`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] tx3">
        <span>
          {tr(
            `نمایش ${slice.total === 0 ? 0 : (slice.page - 1) * pageSize + 1}–${Math.min(slice.page * pageSize, slice.total)} از ${slice.total} ردیف`,
            `Showing ${slice.total === 0 ? 0 : (slice.page - 1) * pageSize + 1}–${Math.min(slice.page * pageSize, slice.total)} of ${slice.total} rows`,
          )}
          {hasActiveFilter && rows.length !== slice.total ? tr(` (از ${rows.length} ردیف کل)`, ` (of ${rows.length} total)`) : ""}
        </span>

        <div className="flex items-center gap-1.5">
          <select
            aria-label={tr("تعداد در صفحه", "Rows per page")}
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className={`${crudInputCls} w-auto`}
          >
            {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <button type="button" className={crudBtnCls} disabled={slice.page <= 1} onClick={() => setPage(1)} aria-label={tr("صفحهٔ اول", "First page")}>«</button>
          <button type="button" className={crudBtnCls} disabled={slice.page <= 1} onClick={() => setPage(slice.page - 1)} aria-label={tr("صفحهٔ قبل", "Previous page")}>‹</button>
          <span className="px-1 tx2" dir="ltr">{slice.page} / {slice.pageCount}</span>
          <button type="button" className={crudBtnCls} disabled={slice.page >= slice.pageCount} onClick={() => setPage(slice.page + 1)} aria-label={tr("صفحهٔ بعد", "Next page")}>›</button>
          <button type="button" className={crudBtnCls} disabled={slice.page >= slice.pageCount} onClick={() => setPage(slice.pageCount)} aria-label={tr("صفحهٔ آخر", "Last page")}>»</button>
        </div>
      </div>
    </div>
  );
}
