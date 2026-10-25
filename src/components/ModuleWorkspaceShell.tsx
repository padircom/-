/**
 * پوستهٔ مشترک ماژول‌های سامانه (MES، CMMS، SCM، IIoT).
 *
 * چیدمان و کلاس‌ها دقیقاً از قالب صفحهٔ دامنه‌های PMIS در `ModuleDetail.tsx`
 * گرفته شده‌اند:
 *   - نوار سربرگ شیشه‌ای: دکمهٔ بازگشت، کاشی آیکن رنگی، مسیر (breadcrumb)،
 *     عنوان و زیرعنوان، و در انتهای سطر نشان‌ها و دکمه‌های فوری.
 *   - بدنهٔ دوستونه: پنل اصلی شیشه‌ای و سایدبار داخلی ماژول (۳۰۰px) با
 *     فهرست زیرماژول‌ها؛ زیرماژول فعال با کلاس `row-on` مشخص می‌شود.
 *
 * همهٔ رنگ‌ها و سطوح از متغیرهای تم (`glass`, `glass-row`, `tx1`…) می‌آیند،
 * پس حالت تیره و روشن هر دو از `index.css` پیروی می‌کنند.
 *
 * این کامپوننت فقط نمایش است؛ هیچ API، داده یا منطق دامنه‌ای ندارد.
 */

import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Lang } from "../data/framework";

export type ModuleNavItem<T extends string = string> = {
  id: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** متن راهنمای هنگام غیرفعال بودن (مثلاً نام مجوز لازم). */
  disabledHint?: string;
  /** عنصر دلخواه در انتهای ردیف، مثل نقطهٔ وضعیت مجوز. */
  trailing?: ReactNode;
  /**
   * عنوان دستهٔ سایدبار داخلی (اختیاری). هرجا مقدارش نسبت به آیتم قبلی
   * عوض شود، یک سربند دسته چاپ می‌شود؛ ماژول‌هایی که دسته نمی‌گذارند
   * (MES/SCM/…) همان فهرست تخت قبلی را می‌بینند.
   */
  group?: string;
};

/** کلاس‌های مشترک؛ هم‌خوان با سطوح PMIS. */
export const moduleSelectCls = "glass-row rounded-lg border b-line-soft px-2.5 py-1.5 text-[10.5px] tx1 outline-none";
export const moduleCardCls = "glass-row rounded-xl border b-line-soft";
export const moduleChipCls = "rounded-md border b-line-soft px-2 py-0.5 text-[10px] font-light tx3";

const TAB_ON = "toggle-on tx1 shadow-sm";
const TAB_OFF = "tx3 hover:tx2";

/** کاشی آیکن با همان رنگ‌بندی `ModuleDetail` (پس‌زمینهٔ کم‌رنگ + حاشیهٔ نیمه‌شفاف). */
export function ModuleIconTile({ accent, children, size = "lg" }: { accent: string; children: ReactNode; size?: "lg" | "sm" }) {
  const box = size === "lg" ? "h-11 w-11 rounded-2xl text-[20px]" : "h-6 w-6 rounded-md text-[12px]";
  return (
    <span
      className={`grid shrink-0 place-items-center ${box}`}
      style={{ background: `${accent}1f`, border: `1px solid ${accent}55`, color: accent }}
    >
      {children}
    </span>
  );
}

/** نوار زیرتب‌های داخل یک زیرماژول (همان الگوی تب‌های PMIS). */
export function ModuleTabs<T extends string>({
  items,
  activeId,
  onSelect,
  ariaLabel,
}: {
  items: { id: T; label: string; icon?: ReactNode; trailing?: ReactNode; disabled?: boolean }[];
  activeId: T;
  onSelect: (id: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="glass-row inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl p-1">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onSelect(item.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-light transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? TAB_ON : TAB_OFF}`}
          >
            {item.icon && <span aria-hidden="true">{item.icon}</span>}
            <span>{item.label}</span>
            {item.trailing}
          </button>
        );
      })}
    </div>
  );
}

export type ModuleWorkspaceShellProps<T extends string = string> = {
  lang: Lang;
  /** رنگ تأکیدی ماژول (هگز) برای کاشی، عنوان و نقطه‌های سایدبار. */
  accent: string;
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  /** هویت صنعت و پروژه، جایگزین آیکن و عنوان پیش‌فرض؛ فقط با درخواست میزبان. */
  headerIdentity?: ReactNode;
  /** نشان‌های وضعیت کنار عنوان (مثلاً «متصل به API»). */
  badges?: ReactNode;
  /** دکمه‌ها و انتخاب‌گرهای فوری در انتهای سربرگ. */
  actions?: ReactNode;
  /** بازگشت به نمای اصلی؛ اگر نباشد دکمه نمایش داده نمی‌شود. */
  onBack?: () => void;
  backLabel?: string;

  /** عنوان سایدبار داخلی و آیکن آن. */
  navTitle: string;
  navIcon?: ReactNode;
  navItems: ModuleNavItem<T>[];
  activeId: T;
  onSelect: (id: T) => void;

  /** عنوان بخش فعال، نمایش‌داده‌شده در بالای پنل اصلی. */
  panelTitle?: string;
  panelIcon?: ReactNode;
  panelDesc?: ReactNode;
  panelMeta?: ReactNode;
  /** پیام‌های وضعیت که بالای محتوای پنل قرار می‌گیرند (مثلاً نبود دسترسی). */
  notice?: ReactNode;

  /** `standalone` در MES برای تمام‌صفحه‌بودن کلاس اضافه می‌کند. */
  className?: string;
  children: ReactNode;
};

export default function ModuleWorkspaceShell<T extends string>({
  lang,
  accent,
  icon,
  title,
  subtitle,
  headerIdentity,
  badges,
  actions,
  onBack,
  backLabel,
  navTitle,
  navIcon,
  navItems,
  activeId,
  onSelect,
  panelTitle,
  panelIcon,
  panelDesc,
  panelMeta,
  notice,
  className = "",
  children,
}: ModuleWorkspaceShellProps<T>) {
  const fa = lang === "fa";
  const dirValue = fa ? "rtl" : "ltr";
  const homeLabel = fa ? "نمای اصلی" : "Hub";
  const backText = backLabel ?? (fa ? "بازگشت به نمای اصلی" : "Back to Hub");
  const titleStyle: CSSProperties = { color: accent };

  return (
    <div dir={dirValue} className={`flex min-h-0 flex-1 flex-col gap-3 overflow-hidden ${className}`}>
      {/* سربرگ: همان ساختار هدر صفحهٔ دامنه‌های PMIS */}
      <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1"
          >
            <span className="inline-block rotate-180 rtl:rotate-0" aria-hidden="true">→</span>
            {backText}
          </button>
        )}

        {headerIdentity ?? (<>
        <ModuleIconTile accent={accent}>{icon}</ModuleIconTile>

        {/* بلوک عنوان حداقل عرض خوانا دارد؛ اگر انتخاب‌گرهای ماژول (مثل IIoT)
            جا را تنگ کنند، به‌جای له‌شدن عنوان و کلمه‌کلمه‌شدن متن، کل بخش
            اکشن‌ها به خط بعد می‌رود و عنوان با ellipsis کوتاه می‌شود. */}
        <div className="min-w-60 flex-1">
          <nav aria-label={fa ? "مسیر" : "Breadcrumb"} className="flex flex-wrap items-center gap-1 text-[9px] font-extralight tx3">
            {onBack ? (
              <button type="button" onClick={onBack} className="hover:tx1 transition">{homeLabel}</button>
            ) : (
              <span>{homeLabel}</span>
            )}
            {panelTitle && (
              <>
                <span className="tx4" aria-hidden="true">/</span>
                <span className="tx2">{panelTitle}</span>
              </>
            )}
          </nav>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h1 className="truncate text-[20px] font-semibold leading-tight" style={titleStyle}>{title}</h1>
          </div>
          {subtitle && <p className="mt-1 truncate text-[10px] font-extralight tx3">{subtitle}</p>}
        </div>

        </>)}

        {(badges || actions) && (
          <div className="ms-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 text-end [&_input]:max-w-52 [&_select]:max-w-52">
            {badges}
            {actions}
          </div>
        )}
      </div>

      {/* بدنه: پنل اصلی + سایدبار داخلی ماژول */}
      <div className="workspace-columns flex min-h-0 flex-1 gap-3 overflow-hidden">
        <div dir={dirValue} className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
          {panelTitle && (
            <div className="b-line mb-3 flex flex-wrap items-start justify-between gap-3 border-b pb-3">
              <div className="flex min-w-0 items-center gap-2.5">
                {panelIcon && <span className="text-xl" aria-hidden="true">{panelIcon}</span>}
                <div className="min-w-0">
                  <h2 className="truncate text-[14px] font-semibold tx1">{panelTitle}</h2>
                  {panelDesc && <p className="mt-0.5 text-[10px] font-extralight tx3">{panelDesc}</p>}
                </div>
              </div>
              {panelMeta && <div className="flex flex-wrap items-center gap-1.5">{panelMeta}</div>}
            </div>
          )}

          {notice && <div className="mb-3 shrink-0">{notice}</div>}

          <div className="thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </div>

        <aside dir={dirValue} aria-label={navTitle} className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
          <div className="b-line border-b px-3 py-2.5">
            <div className="flex items-center gap-2">
              <ModuleIconTile accent={accent} size="sm">{navIcon ?? icon}</ModuleIconTile>
              <div className="text-[10.5px] font-normal tx1">{navTitle}</div>
            </div>
          </div>

          <div className="thin-scroll flex-1 space-y-1 overflow-y-auto p-2">
            {navItems.map((item, index) => {
              const active = item.id === activeId;
              /* سربند دسته: فقط وقتی این آیتم دسته دارد و دسته‌اش با قبلی فرق می‌کند. */
              const groupHeader = item.group && item.group !== navItems[index - 1]?.group ? (
                <div
                  key={`group:${item.group}`}
                  className="flex items-center gap-1.5 px-2 pb-0.5 pt-3 text-[9px] font-semibold tracking-wide tx3 first:pt-1"
                  role="presentation"
                >
                  <span className="h-px flex-1" style={{ background: "var(--line-soft)" }} aria-hidden="true" />
                  <span>{item.group}</span>
                  <span className="h-px flex-1" style={{ background: "var(--line-soft)" }} aria-hidden="true" />
                </div>
              ) : null;
              return (
                <Fragment key={item.id}>
                {groupHeader}
                <button
                  type="button"
                  disabled={item.disabled}
                  title={item.disabled ? item.disabledHint : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onSelect(item.id)}
                  className={`group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start transition glass-row hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 ${active ? "row-on" : ""}`}
                >
                  <span className="text-[8px] font-light tabular-nums tx4">
                    {(index + 1).toLocaleString(fa ? "fa-IR" : "en-US")}
                  </span>
                  {item.icon && <span className="shrink-0 text-[12px]" aria-hidden="true">{item.icon}</span>}
                  <span className="min-w-0 flex-1 truncate text-[10px] font-light tx1">{item.label}</span>
                  {item.trailing}
                </button>
                </Fragment>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
