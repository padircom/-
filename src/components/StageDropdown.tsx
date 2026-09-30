import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Choice = { label: string; value: string };

/**
 * کشوی انتخاب با ظاهر خودِ برنامه، به‌جای پاپ‌آپ `select` سیستم‌عامل
 * (که روی ویندوز سفیدِ ناخوانا رندر می‌شود).
 *
 * مشترک بین کاتالوگ‌های «مراحل کاری» است؛ پیش‌تر نسخهٔ یکسانی داخل
 * کامپوننت نفتی بود و تکرارش برای پتروشیمی یعنی دو کشو که به‌مرور
 * رفتار متفاوت پیدا می‌کنند.
 *
 * نام کلاس‌ها (`oilfield-select-*`) عمداً دست‌نخورده ماند: در
 * `src/index.css` تعریف شده‌اند و تغییر آن فایل ممنوع است.
 */
export default function StageDropdown({ label, placeholder, value, choices, disabled, onChange }: {
  label: string; placeholder: string; value: string; choices: Choice[];
  disabled?: boolean; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const toggle = () => {
    if (!open) setRect(wrapper.current?.getBoundingClientRect() ?? null);
    setOpen(current => !current);
  };
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOnScroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    window.addEventListener("resize", closeEscapeOrResize);
    document.addEventListener("scroll", closeOnScroll, true);
    function closeEscapeOrResize() { setOpen(false); }
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
      window.removeEventListener("resize", closeEscapeOrResize);
      document.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);
  const selected = choices.find(item => item.value === value);
  return (
    <div ref={wrapper} className="relative min-w-0 space-y-1 text-[11px] tx2">
      <span id={`stage-label-${label}`}>{label}</span>
      <button type="button" disabled={disabled} aria-labelledby={`stage-label-${label}`}
        aria-expanded={open} aria-haspopup="listbox"
        onClick={toggle}
        className="oilfield-select-trigger flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start text-[11px] outline-none disabled:opacity-50">
        <span className="truncate">{selected?.label ?? placeholder}</span><span aria-hidden="true">⌄</span>
      </button>
      {open && rect && !disabled && createPortal(<div ref={menu} role="listbox" aria-label={label}
        className="oilfield-select-menu fixed max-h-64 overflow-y-auto rounded-lg border p-1"
        style={{ zIndex: 99999, top: rect.bottom + 264 > window.innerHeight && rect.top > 264 ? rect.top - 264 : rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: Math.min(rect.width, window.innerWidth - 16), backgroundColor: "#172341" }}>
        {choices.map(choice => <button type="button" role="option" aria-selected={value === choice.value}
          key={choice.value} onClick={() => { onChange(choice.value); setOpen(false); }}
          className="oilfield-select-option block w-full rounded-md px-3 py-2 text-start text-[11px] focus:outline-none">
          {choice.label}
        </button>)}
      </div>, document.body)}
    </div>
  );
}
