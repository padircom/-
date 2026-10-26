import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ChangeEventHandler, type InputHTMLAttributes, type Ref } from "react";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";

const MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const MONTHS_EN = ["Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar", "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"];
const WEEKDAYS_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const WEEKDAYS_EN = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

type JalaliDate = { year: number; month: number; day: number };
type PersianDateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value?: string | number | readonly string[] | null;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  includeTime?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

function asciiDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
}

function localizedDigits(value: string, fa: boolean): string {
  return fa ? value.replace(/[0-9]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) + 1728)) : value;
}

function parseJalali(value: string): JalaliDate | null {
  const match = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/.exec(asciiDigits(value).trim());
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (date.year < 1300 || date.year > 1500 || date.month < 1 || date.month > 12 || date.day < 1 || date.day > jalaaliMonthLength(date.year, date.month)) return null;
  return date;
}

function isoToJalali(value: string): JalaliDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return parseJalali(value);
  const [, year, month, day] = match;
  const converted = toJalaali(Number(year), Number(month), Number(day));
  return { year: converted.jy, month: converted.jm, day: converted.jd };
}

function jalaliToIso(date: JalaliDate): string {
  const converted = toGregorian(date.year, date.month, date.day);
  return `${converted.gy}-${String(converted.gm).padStart(2, "0")}-${String(converted.gd).padStart(2, "0")}`;
}

function formatJalali(date: JalaliDate): string {
  return `${date.year}/${String(date.month).padStart(2, "0")}/${String(date.day).padStart(2, "0")}`;
}

function todayJalali(): JalaliDate {
  const date = toJalaali(new Date());
  return { year: date.jy, month: date.jm, day: date.jd };
}

function isoFromInput(value: string): string | null {
  const normalized = asciiDigits(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) return normalized;
  }
  const jalali = parseJalali(normalized);
  return jalali ? jalaliToIso(jalali) : null;
}

function emitDate(onChange: PersianDateInputProps["onChange"], value: string) {
  if (!onChange) return;
  const target = { value } as HTMLInputElement;
  onChange({ target, currentTarget: target } as ChangeEvent<HTMLInputElement>);
}

export default function PersianDateInput({ value, onChange, className = "", style, dir: _dir, onBlur, onKeyDown, includeTime = false, inputRef, ...inputProps }: PersianDateInputProps) {
  const [fa, setFa] = useState(true);
  const rawValue = String(value ?? "");
  const parsedValue = isoToJalali(rawValue);
  const initialDate = parsedValue ?? todayJalali();
  const [draft, setDraft] = useState(parsedValue ? localizedDigits(formatJalali(parsedValue), fa) : rawValue);
  const [time, setTime] = useState(/T(\d{2}:\d{2})/.exec(rawValue)?.[1] ?? "");
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(initialDate.month);
  const [year, setYear] = useState(initialDate.year);
  const [invalid, setInvalid] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncLanguage = () => setFa(document.documentElement.lang !== "en");
    syncLanguage();
    const observer = new MutationObserver(syncLanguage);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const next = isoToJalali(String(value ?? ""));
    setDraft(next ? localizedDigits(formatJalali(next), fa) : String(value ?? ""));
    if (next) { setYear(next.year); setMonth(next.month); }
    setTime(/T(\d{2}:\d{2})/.exec(String(value ?? ""))?.[1] ?? "");
    setInvalid(false);
  }, [value, fa]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);

  const today = todayJalali();
  const cells = useMemo(() => {
    const firstGregorian = toGregorian(year, month, 1);
    const weekday = new Date(Date.UTC(firstGregorian.gy, firstGregorian.gm - 1, firstGregorian.gd)).getUTCDay();
    const out: Array<number | null> = Array.from({ length: (weekday + 1) % 7 }, () => null);
    for (let day = 1; day <= jalaaliMonthLength(year, month); day += 1) out.push(day);
    return out;
  }, [year, month]);

  const choose = (date: JalaliDate) => {
    const iso = jalaliToIso(date);
    setDraft(localizedDigits(formatJalali(date), fa));
    setInvalid(false);
    emitDate(onChange, includeTime ? `${iso}T${time || "00:00"}` : iso);
    setOpen(false);
  };
  const commit = () => {
    if (!draft.trim()) { setInvalid(false); emitDate(onChange, ""); return; }
    const iso = isoFromInput(draft);
    if (!iso) { setInvalid(true); return; }
    const parsed = isoToJalali(iso)!;
    setDraft(localizedDigits(formatJalali(parsed), fa));
    setInvalid(false);
    emitDate(onChange, includeTime ? `${iso}T${time || "00:00"}` : iso);
  };
  const shiftMonth = (offset: number) => {
    const total = year * 12 + month - 1 + offset;
    const nextYear = Math.floor(total / 12);
    if (nextYear < 1300 || nextYear > 1500) return;
    setYear(nextYear);
    setMonth((total % 12) + 1);
  };
  const selected = parsedValue ? jalaliToIso(parsedValue) : "";
  const widthClasses = className.split(/\s+/).filter((part) => part === "w-full" || /^w-\d+/.test(part));
  const wrapperWidthClass = widthClasses[widthClasses.length - 1];
  const defaultWidthClass = wrapperWidthClass ? "" : "w-36";

  return (
    <div ref={wrapperRef} className={`persian-date-picker relative ${wrapperWidthClass === "w-full" ? "w-full" : "inline-flex max-w-full"}`} dir="ltr">
      <input
        {...inputProps}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={draft}
        onChange={(event) => { setDraft(event.target.value); setInvalid(false); }}
        onBlur={(event) => { commit(); onBlur?.(event); }}
        onKeyDown={(event) => { if (event.key === "Enter") commit(); onKeyDown?.(event); }}
        placeholder={inputProps.placeholder ?? (fa ? "۱۴۰۵/۰۷/۱۱" : "1405/07/11")}
        aria-invalid={invalid || inputProps["aria-invalid"] || undefined}
        className={`${className} ${defaultWidthClass} pe-8 ${invalid ? "!border-rose-400 text-rose-300" : ""}`}
        style={style}
        dir="ltr"
      />
      {includeTime && (
        <input
          aria-label={fa ? "ساعت" : "Time"}
          type="time"
          value={time}
          onChange={(event) => {
            setTime(event.target.value);
            const iso = isoFromInput(draft);
            if (iso) emitDate(onChange, `${iso}T${event.target.value}`);
          }}
          className="ms-1 min-w-[5.5rem] rounded-lg border b-line-soft bg-transparent px-1.5 py-1 text-xs tx1"
          disabled={inputProps.disabled}
        />
      )}
      <button
        type="button"
        aria-label={fa ? "باز کردن تقویم فارسی" : "Open Persian calendar"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={fa ? "انتخاب تاریخ شمسی" : "Select Jalali date"}
        disabled={inputProps.disabled || inputProps.readOnly}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (!open) {
            const current = isoToJalali(String(value ?? "")) ?? parseJalali(draft) ?? today;
            setYear(current.year); setMonth(current.month);
          }
          setOpen((current) => !current);
        }}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-sky-200 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-1 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-40 ${includeTime ? "" : "absolute end-1 top-1/2 -translate-y-1/2"}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
        </svg>
      </button>
      {open && (
        <div role="dialog" aria-label={fa ? "تقویم فارسی" : "Persian calendar"} dir={fa ? "rtl" : "ltr"} className={`absolute top-full z-[500] mt-1 w-[264px] rounded-xl border b-line bg-[var(--bg-c)] p-2.5 text-[10px] shadow-2xl ${fa ? "right-0" : "left-0"}`}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <button type="button" aria-label={fa ? "ماه قبل" : "Previous month"} disabled={year === 1300 && month === 1} onClick={() => shiftMonth(-1)} className="grid h-7 w-7 place-items-center rounded-lg border b-line-soft tx2 transition hover:bg-white/10 disabled:opacity-30">{fa ? "›" : "‹"}</button>
            <div className="font-semibold tx1">{(fa ? MONTHS_FA : MONTHS_EN)[month - 1]} {localizedDigits(String(year), fa)}</div>
            <button type="button" aria-label={fa ? "ماه بعد" : "Next month"} disabled={year === 1500 && month === 12} onClick={() => shiftMonth(1)} className="grid h-7 w-7 place-items-center rounded-lg border b-line-soft tx2 transition hover:bg-white/10 disabled:opacity-30">{fa ? "‹" : "›"}</button>
          </div>
          <div className="grid grid-cols-7 text-center tx4">{(fa ? WEEKDAYS_FA : WEEKDAYS_EN).map((day, index) => <span key={`${day}-${index}`} className="py-1.5 font-medium">{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, index) => {
              if (day === null) return <span key={`empty-${index}`} aria-hidden="true" className="h-8" />;
              const date = { year, month, day };
              const iso = jalaliToIso(date);
              const isSelected = iso === selected;
              const isToday = day === today.day && month === today.month && year === today.year;
              return <button key={iso} type="button" aria-current={isToday ? "date" : undefined} aria-label={`${fa ? "انتخاب" : "Select"} ${localizedDigits(formatJalali(date), fa)}`} onClick={() => choose(date)} className={`relative h-8 rounded-md text-center transition hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-sky-300 ${isSelected ? "bg-sky-500/30 font-semibold text-sky-100" : "tx1"} ${isToday && !isSelected ? "ring-1 ring-inset ring-amber-300/70" : ""}`}>{localizedDigits(String(day), fa)}</button>;
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t b-line-soft pt-1.5">
            <span className="text-[9px] tx4">{fa ? "تقویم شمسی" : "Persian calendar"}</span>
            <button type="button" onClick={() => choose(today)} className="rounded-md px-2 py-1 text-[9px] text-sky-200 hover:bg-white/10">{fa ? "امروز" : "Today"}</button>
          </div>
        </div>
      )}
      {invalid && <span role="alert" className="absolute top-full z-[510] mt-0.5 whitespace-nowrap rounded bg-[var(--bg-c)] px-1.5 py-1 text-[8px] text-rose-300">{fa ? "تاریخ شمسی نامعتبر است." : "Invalid Jalali date."}</span>}
    </div>
  );
}
