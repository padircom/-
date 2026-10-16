import { useEffect, useRef, useState } from 'react';
import { jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js';

/** ورودی تاریخ شمسی (جلالی) — مقدار ذخیره‌شده همیشه ISO میلادی (yyyy-mm-dd) است. */
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const MONTHS_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const WEEKDAYS_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const faNum = (v: string | number): string => String(v).replace(/\d/g, d => FA_DIGITS[Number(d)]);
const normDigits = (s: string): string => s.replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d)));
const pad = (n: number): string => String(n).padStart(2, '0');

function isoToJalali(iso: string): { jy: number; jm: number; jd: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const j = toJalaali(Number(m[1]), Number(m[2]), Number(m[3]));
  return { jy: j.jy, jm: j.jm, jd: j.jd };
}
function jalaliToIso(jy: number, jm: number, jd: number): string {
  const g = toGregorian(jy, jm, jd);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}
function displayOf(iso: string): string {
  const j = isoToJalali(iso);
  return j ? `${faNum(j.jy)}/${faNum(pad(j.jm))}/${faNum(pad(j.jd))}` : '';
}
function parseJalaliText(raw: string): string | null {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(normDigits(raw).trim());
  if (!m) return null;
  const jy = Number(m[1]); const jm = Number(m[2]); const jd = Number(m[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > jalaaliMonthLength(jy, jm)) return null;
  return jalaliToIso(jy, jm, jd);
}

type Props = {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

export default function JalaliDateInput({ value, onChange, className, disabled, ariaLabel }: Props) {
  const [text, setText] = useState(() => displayOf(value));
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const todayJ = (() => { const n = new Date(); const j = toJalaali(n.getFullYear(), n.getMonth() + 1, n.getDate()); return { jy: j.jy, jm: j.jm }; })();
  const current = isoToJalali(value);
  const [view, setView] = useState<{ jy: number; jm: number }>({ jy: current?.jy ?? todayJ.jy, jm: current?.jm ?? todayJ.jm });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setText(displayOf(value)); setInvalid(false); }, [value]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open ]);

  const commit = (raw: string) => {
    if (!raw.trim()) { setInvalid(false); onChange(''); return; }
    const iso = parseJalaliText(raw);
    if (iso) { setInvalid(false); onChange(iso); } else { setInvalid(true); setText(displayOf(value)); }
  };
  const moveMonth = (delta: number) => setView(v => {
    const total = v.jy * 12 + (v.jm - 1) + delta;
    return { jy: Math.floor(total / 12), jm: (total % 12) + 1 };
  });
  const openCalendar = () => {
    if (disabled) return;
    const base = isoToJalali(value) ?? { jy: todayJ.jy, jm: todayJ.jm, jd: 1 };
    setView({ jy: base.jy, jm: base.jm });
    setOpen(o => !o);
  };

  const monthLen = jalaaliMonthLength(view.jy, view.jm);
  const firstGregorian = toGregorian(view.jy, view.jm, 1);
  const firstDow = new Date(Date.UTC(firstGregorian.gy, firstGregorian.gm - 1, firstGregorian.gd)).getUTCDay();
  const startOffset = (firstDow + 1) % 7; // هفته از شنبه آغاز می‌شود
  const cells: (number | null)[] = [...Array.from({ length: startOffset }, () => null), ...Array.from({ length: monthLen }, (_, i) => i + 1)];

  return <div ref={boxRef} className="relative">
    <input
      aria-label={ariaLabel}
      className={`${className ?? ''} ${invalid ? 'border-rose-500' : ''}`}
      dir="ltr"
      inputMode="numeric"
      placeholder="۱۴۰۵/۰۷/۲۴"
      disabled={disabled}
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit((e.target as HTMLInputElement).value); setOpen(false); } }}
      onClick={openCalendar}
    />
    {open && !disabled && <div className="absolute z-50 mt-1 w-64 rounded-xl border b-line-soft bg-[var(--panel,#101826)] p-2 shadow-xl" dir="rtl">
      <div className="flex items-center justify-between px-1 pb-2">
        <button type="button" className="rounded px-2 py-0.5 text-sm tx1" onClick={() => moveMonth(-1)}>‹</button>
        <span className="text-xs font-semibold tx1">{MONTHS_FA[view.jm - 1]} {faNum(view.jy)}</span>
        <button type="button" className="rounded px-2 py-0.5 text-sm tx1" onClick={() => moveMonth(1)}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS_FA.map(d => <span key={d} className="py-1 text-[10px] tx3">{d}</span>)}
        {cells.map((day, i) => day === null
          ? <span key={`x${i}`} />
          : <button key={day} type="button"
              className={`rounded py-1 text-[11px] ${current && current.jy === view.jy && current.jm === view.jm && current.jd === day ? 'toggle-on font-bold' : 'tx2'}`}
              onClick={() => { onChange(jalaliToIso(view.jy, view.jm, day)); setOpen(false); }}>
              {faNum(day)}
            </button>)}
      </div>
      <p className="pt-1 text-center text-[10px] tx3">تقویم شمسی — مقدار به‌صورت میلادی ذخیره می‌شود</p>
    </div>}
  </div>;
}
