import { useState } from "react";
import { t, type Lang } from "../data/framework";

// تابع دقیق و مستقل تبدیل تاریخ شمسی به میلادی برای محاسبات تقویم
function jalaliToGregorian(jy: number, jm: number, jd: number) {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd;
  if (jm < 7) {
    days += (jm - 1) * 31;
  } else {
    days += ((jm - 1) * 30) + 6;
  }
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  let sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13; gm++) {
    let v = sal_a[gm];
    if (days < v) break;
    days -= v;
  }
  gd = days + 1;
  return { gy, gm, gd };
}

function getJalaliMonthLength(jy: number, jm: number) {
  const g1 = jalaliToGregorian(jy, jm, 1);
  let nextY = jy;
  let nextM = jm + 1;
  if (nextM > 12) {
    nextM = 1;
    nextY++;
  }
  const g2 = jalaliToGregorian(nextY, nextM, 1);
  const d1 = Date.UTC(g1.gy, g1.gm - 1, g1.gd);
  const d2 = Date.UTC(g2.gy, g2.gm - 1, g2.gd);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

// بانک اطلاعاتی مناسبت‌های شمسی
const persianOccasions: Record<number, { day: number; title: { fa: string; en: string } }[]> = {
  0: [ // فروردین
    { day: 1, title: { fa: "جشن نوروز / آغاز سال نو", en: "Nowruz / New Year" } },
    { day: 2, title: { fa: "عید نوروز", en: "Nowruz Holiday" } },
    { day: 12, title: { fa: "روز جمهوری اسلامی ایران", en: "Islamic Republic Day" } },
    { day: 13, title: { fa: "روز طبیعت (سیزده‌بدر)", en: "Nature Day (Sizdah Bedar)" } },
  ],
  1: [ // اردیبهشت
    { day: 1, title: { fa: "روز بزرگداشت شیخ مفید", en: "Sheikh Mofid Commemoration" } },
    { day: 15, title: { fa: "جشن میانه بهار", en: "Mid-Spring Festival" } },
  ],
  2: [ // خرداد
    { day: 14, title: { fa: "رحلت حضرت امام خمینی (ره)", en: "Demise of Imam Khomeini" } },
    { day: 15, title: { fa: "قیام ۱۵ خرداد", en: "Uprising of Khordad 15" } },
  ],
  3: [ // تیر
    { day: 7, title: { fa: "شهادت دکتر بهشتی و هفته قوه قضاییه", en: "Martyrdom of Dr. Beheshti" } },
  ],
  4: [ // مرداد
    { day: 14, title: { fa: "فرمان مشروطیت", en: "Constitution Day" } },
  ],
  5: [ // شهریور
    { day: 1, title: { fa: "روز بزرگداشت ابوعلی سینا و روز پزشک", en: "National Doctor's Day" } },
    { day: 4, title: { fa: "روز کارمند", en: "Employee Day" } },
    { day: 5, title: { fa: "روز بزرگداشت محمدبن زکریای رازی و روز داروسازی", en: "Pharmacist Day" } },
    { day: 8, title: { fa: "شهادت رجایی و باهنر - روز تروریسم", en: "Martyrdom of Rajaei & Bahonar" } },
    { day: 11, title: { fa: "روز صنعت چاپ", en: "Printing Industry Day" } },
    { day: 19, title: { fa: "وفات آیت‌الله طالقانی", en: "Ayatollah Taleghani Demise" } },
    { day: 27, title: { fa: "روز شعر و ادب فارسی (بزرگداشت شهریار)", en: "Persian Poetry Day" } },
  ],
  6: [ // مهر
    { day: 7, title: { fa: "روز آتش‌نشانی و ایمنی", en: "Firefighters & Safety Day" } },
    { day: 8, title: { fa: "روز بزرگداشت مولوی", en: "Rumi Commemoration Day" } },
    { day: 13, title: { fa: "هجرت حضرت محمد (ص) از مکه به مدینه", en: "Migration of Prophet" } },
  ],
  7: [ // آبان
    { day: 13, title: { fa: "روز تسخیر لانه جاسوسی و روز دانش‌آموز", en: "Student Day" } },
  ],
  8: [ // آذر
    { day: 4, title: { fa: "روز نیروی دریایی", en: "Navy Day" } },
    { day: 16, title: { fa: "روز دانشجو", en: "Student Day" } },
    { day: 30, title: { fa: "شب یلدا", en: "Yalda Night" } },
  ],
  9: [ // دی
    { day: 13, title: { fa: "شهادت سردار حاج قاسم سلیمانی", en: "Martyrdom of General Soleimani" } },
  ],
  10: [ // بهمن
    { day: 22, title: { fa: "پیروزی انقلاب اسلامی ایران", en: "Islamic Revolution Victory Day" } },
  ],
  11: [ // اسفند
    { day: 29, title: { fa: "روز ملی شدن صنعت نفت ایران", en: "Nationalization of Oil Industry" } },
  ],
};

export default function CalendarView({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";

  const now = new Date();
  const persianParts = new Intl.DateTimeFormat('en-US', {
    calendar: 'persian',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(now);

  const todayFaYear = parseInt(persianParts.find(p => p.type === 'year')?.value || '1405');
  const todayFaMonthIndex = parseInt(persianParts.find(p => p.type === 'month')?.value || '1') - 1;
  const todayFaDay = parseInt(persianParts.find(p => p.type === 'day')?.value || '1');

  const todayEnYear = now.getFullYear();
  const todayEnMonthIndex = now.getMonth();
  const todayEnDay = now.getDate();

  const [faYear, setFaYear] = useState<number>(todayFaYear);
  const [faMonthIndex, setFaMonthIndex] = useState<number>(todayFaMonthIndex);

  const [enYear, setEnYear] = useState<number>(todayEnYear);
  const [enMonthIndex, setEnMonthIndex] = useState<number>(todayEnMonthIndex);

  // State برای نگهداری روز انتخاب شده
  const [selectedDay, setSelectedDay] = useState<number>(rtl ? todayFaDay : todayEnDay);

  // Stateهای ذخیره‌سازی پویا برای جلسات و کارها به تفکیک تاریخ (کلید: سال-ماه-روز)
  const dateKey = `${faYear}-${faMonthIndex}-${selectedDay}`;

  const [meetingsByDate, setMeetingsByDate] = useState<Record<string, { id: number; time: string; text: string }[]>>({
    [dateKey]: [
      { id: 1, time: "10:00 - 11:30", text: "هماهنگی فاز مهندسی و کنترل پروژه" },
      { id: 2, time: "14:00 - 15:00", text: "بررسی ادعای تأخیرات (Claim)" },
    ]
  });

  const [tasksByDate, setTasksByDate] = useState<Record<string, { id: number; text: string; color: string; completed: boolean }[]>>({
    [dateKey]: [
      { id: 1, text: "تکمیل گزارش پیشرفت فاز ۱", color: "#EF4444", completed: false },
      { id: 2, text: "بررسی مستندات پیمانکار (WBS)", color: "#F59E0B", completed: false },
    ]
  });

  // فرم ورودی موقت برای افزودن جلسه یا کار جدید
  const [newMeetingText, setNewMeetingText] = useState("");
  const [newMeetingTime, setNewMeetingTime] = useState("");
  const [newTaskText, setNewTaskText] = useState("");

  const faMonths = [
    "فروردین", "اردیبهشت", "خرداد",
    "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر",
    "دی", "بهمن", "اسفند"
  ];

  const enMonths = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const title = rtl 
    ? `${faMonths[faMonthIndex]} ${faYear}` 
    : `${enMonths[enMonthIndex]} ${enYear}`;

  const daysFa = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  const daysEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayHeaders = rtl ? daysFa : daysEn;

  let daysCount = 30;
  let offset = 0;

  if (rtl) {
    daysCount = getJalaliMonthLength(faYear, faMonthIndex + 1);
    const firstDayG = jalaliToGregorian(faYear, faMonthIndex + 1, 1);
    const firstDayObj = new Date(firstDayG.gy, firstDayG.gm - 1, firstDayG.gd);
    const jsDay = firstDayObj.getDay();
    offset = (jsDay + 1) % 7;
  } else {
    daysCount = new Date(enYear, enMonthIndex + 1, 0).getDate();
    const firstDayObj = new Date(enYear, enMonthIndex, 1);
    const jsDay = firstDayObj.getDay();
    offset = (jsDay + 6) % 7;
  }

  const days = Array.from({ length: daysCount }, (_, i) => i + 1);

  const handlePrevMonth = () => {
    if (rtl) {
      if (faMonthIndex === 0) {
        setFaMonthIndex(11);
        setFaYear(y => y - 1);
      } else {
        setFaMonthIndex(m => m - 1);
      }
    } else {
      if (enMonthIndex === 0) {
        setEnMonthIndex(11);
        setEnYear(y => y - 1);
      } else {
        setEnMonthIndex(m => m - 1);
      }
    }
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    if (rtl) {
      if (faMonthIndex === 11) {
        setFaMonthIndex(0);
        setFaYear(y => y + 1);
      } else {
        setFaMonthIndex(m => m + 1);
      }
    } else {
      if (enMonthIndex === 11) {
        setEnMonthIndex(0);
        setEnYear(y => y + 1);
      } else {
        setEnMonthIndex(m => m + 1);
      }
    }
    setSelectedDay(1);
  };

  const currentMonthOccasions = rtl ? (persianOccasions[faMonthIndex] || []) : [];

  const getDayOccasion = (day: number) => {
    if (!rtl) return null;
    const found = persianOccasions[faMonthIndex]?.find(o => o.day === day);
    return found ? t(found.title, lang) : null;
  };

  const isHoliday = (day: number) => {
    const weekDayIndex = (day - 1 + offset) % 7;
    const hasOccasionHoliday = rtl && (faMonthIndex === 0 && (day === 1 || day === 2 || day === 12 || day === 13) || faMonthIndex === 5 && day === 8);
    if (rtl) {
      return weekDayIndex === 6 || hasOccasionHoliday;
    } else {
      return weekDayIndex === 5 || weekDayIndex === 6;
    }
  };

  // لیست‌های جاری برای روز انتخاب‌شده
  const currentMeetings = meetingsByDate[dateKey] || [];
  const currentTasks = tasksByDate[dateKey] || [];

  // افزودن جلسه جدید
  const handleAddMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeetingText.trim()) return;
    const newItem = {
      id: Date.now(),
      time: newMeetingTime.trim() || "12:00 - 13:00",
      text: newMeetingText.trim()
    };
    setMeetingsByDate(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), newItem]
    }));
    setNewMeetingText("");
    setNewMeetingTime("");
  };

  // حذف جلسه
  const handleDeleteMeeting = (meetingId: number) => {
    setMeetingsByDate(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).filter(m => m.id !== meetingId)
    }));
  };

  // افزودن کار جدید
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const newItem = {
      id: Date.now(),
      text: newTaskText.trim(),
      color: "#3B82F6",
      completed: false
    };
    setTasksByDate(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), newItem]
    }));
    setNewTaskText("");
  };

  // تغییر وضعیت انجام کار
  const toggleTask = (taskId: number) => {
    setTasksByDate(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).map(task => 
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    }));
  };

  // حذف کار
  const handleDeleteTask = (taskId: number) => {
    setTasksByDate(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).filter(t => t.id !== taskId)
    }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row" dir={rtl ? "rtl" : "ltr"}>
      {/* ── Main Calendar Grid & Occasions Placed Below ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="glass flex flex-col rounded-2xl p-4">
          <header className="mb-4 flex items-center justify-between px-2">
            <h2 className="text-[15px] font-normal tx1">{title}</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrevMonth}
                className="glass-row grid h-7 w-7 place-items-center rounded-lg tx2 hover:tx1"
              >
                <span className={rtl ? "rotate-180" : ""}>&lt;</span>
              </button>
              <button 
                onClick={handleNextMonth}
                className="glass-row grid h-7 w-7 place-items-center rounded-lg tx2 hover:tx1"
              >
                <span className={rtl ? "rotate-180" : ""}>&gt;</span>
              </button>
            </div>
          </header>

          <div className="grid grid-cols-7 gap-1">
            {dayHeaders.map((d, i) => (
              <div key={i} className="pb-2 text-center text-[11px] font-light tx3">
                {d}
              </div>
            ))}

            {Array.from({ length: offset }).map((_, i) => (
              <div key={`blank-${i}`} className="h-14 rounded-xl bg-transparent" />
            ))}

            {days.map((d) => {
              const holi = isHoliday(d);
              const occasionText = getDayOccasion(d);
              const isSelected = d === selectedDay;
              const isToday = rtl 
                ? (faYear === todayFaYear && faMonthIndex === todayFaMonthIndex && d === todayFaDay)
                : (enYear === todayEnYear && enMonthIndex === todayEnMonthIndex && d === todayEnDay);

              const hasItems = (meetingsByDate[`${faYear}-${faMonthIndex}-${d}`]?.length || 0) > 0 || 
                               (tasksByDate[`${faYear}-${faMonthIndex}-${d}`]?.length || 0) > 0;

              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  title={occasionText || undefined}
                  className={`group relative flex h-14 flex-col rounded-xl border p-1.5 transition-all ${
                    isSelected
                      ? "border-sky-400 bg-sky-400/15 shadow-[0_0_12px_-3px_rgba(56,189,248,0.4)]"
                      : holi
                        ? "border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40 hover:bg-rose-500/10"
                        : "border-transparent hover:bg-[var(--row-hover)] b-line-soft hover:border-current"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={`text-[13px] ${
                        isSelected ? "font-normal text-sky-400" : holi ? "font-light text-rose-500" : "font-light tx1"
                      }`}
                    >
                      {d}
                    </span>
                    {occasionText && (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title={occasionText} />
                    )}
                  </div>

                  {hasItems && (
                    <span className="mx-auto mt-auto flex gap-0.5">
                      <span className="h-1 w-1 rounded-full bg-sky-400" />
                    </span>
                  )}
                  {isToday && !isSelected && !hasItems && (
                    <span className="mx-auto mt-auto flex gap-0.5">
                      <span className="h-1 w-1 rounded-full bg-rose-400" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Occasions List Below Calendar Grid */}
        {rtl && currentMonthOccasions.length > 0 && (
          <div className="glass flex flex-col rounded-2xl p-3.5">
            <h3 className="mb-2.5 flex items-center gap-2 text-[11.5px] font-normal tx1">
              <span className="chip-bg grid h-6 w-6 place-items-center rounded-md text-[12px] accent-t">🎉</span>
              مناسبت‌های این ماه
            </h3>
            <div className="flex flex-wrap gap-2">
              {currentMonthOccasions.map((occ) => {
                const isSelectedOccasion = occ.day === selectedDay;
                return (
                  <div 
                    key={occ.day} 
                    onClick={() => setSelectedDay(occ.day)}
                    className={`glass-row flex cursor-pointer items-center gap-2 rounded-xl px-3 py-1.5 text-[10px] transition-all ${
                      isSelectedOccasion 
                        ? "border-sky-400 bg-sky-400/10 tx1 shadow-sm" 
                        : "tx2 border-r-2 border-r-amber-400 rtl:border-r-2 rtl:border-l-0"
                    }`}
                  >
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${isSelectedOccasion ? "bg-sky-400 text-black" : "bg-amber-400/10 text-amber-400"}`}>
                      {occ.day} {faMonths[faMonthIndex]}
                    </span>
                    <span>{t(occ.title, lang)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Internal Sidebar: Meetings & Tasks with Add/Delete Controls ── */}
      <div className="flex w-[280px] shrink-0 flex-col gap-3">
        {/* Selected Date Header indicator */}
        <div className="glass flex items-center justify-between rounded-xl px-3 py-2 text-[11px] tx1">
          <span className="tx3">{rtl ? "روز انتخاب شده:" : "Selected:"}</span>
          <span className="font-medium accent-t">{selectedDay} {rtl ? faMonths[faMonthIndex] : enMonths[enMonthIndex]}</span>
        </div>

        {/* Meetings Box */}
        <div className="glass-dark flex flex-1 flex-col rounded-2xl p-3.5">
          <h3 className="mb-3 flex items-center justify-between text-[11.5px] font-normal tx1">
            <span className="flex items-center gap-2">
              <span className="chip-bg grid h-6 w-6 place-items-center rounded-md text-[12px] accent-t">📅</span>
              {rtl ? "تقویم جلسات" : "Meeting Calendar"}
            </span>
            <span className="text-[10px] tx3">({currentMeetings.length})</span>
          </h3>

          <div className="thin-scroll mb-2.5 max-h-[140px] flex-1 space-y-2 overflow-y-auto pr-1">
            {currentMeetings.length === 0 ? (
              <div className="text-center text-[10px] py-4 tx3">{rtl ? "جلسه‌ای ثبت نشده است" : "No meetings"}</div>
            ) : (
              currentMeetings.map((m) => (
                <div key={m.id} className="glass-row group relative flex items-start justify-between rounded-xl border-l-2 border-l-sky-400 p-2.5 rtl:border-l-0 rtl:border-r-2 rtl:border-r-sky-400">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-normal tx1">{m.text}</div>
                    <div className="mt-1 text-[9px] font-extralight tx3">{m.time}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteMeeting(m.id)}
                    className="opacity-60 transition hover:opacity-100 tx3 hover:text-rose-400 p-1"
                    title={rtl ? "حذف جلسه" : "Delete meeting"}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Form to add new meeting */}
          <form onSubmit={handleAddMeeting} className="flex flex-col gap-1.5 border-t border-white/5 pt-2">
            <input
              type="text"
              placeholder={rtl ? "عنوان جلسه جدید..." : "New meeting title..."}
              value={newMeetingText}
              onChange={(e) => setNewMeetingText(e.target.value)}
              className="w-full rounded-lg bg-black/20 px-2.5 py-1.5 text-[10px] tx1 placeholder:tx4 outline-none border border-white/10 focus:border-sky-400"
            />
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="10:00 - 11:30"
                value={newMeetingTime}
                onChange={(e) => setNewMeetingTime(e.target.value)}
                className="w-24 rounded-lg bg-black/20 px-2 py-1.5 text-[10px] tx1 placeholder:tx4 outline-none border border-white/10 focus:border-sky-400 text-center"
              />
              <button
                type="submit"
                className="flex-1 rounded-lg bg-sky-500/20 py-1.5 text-[10px] font-medium text-sky-400 transition hover:bg-sky-500/30"
              >
                {rtl ? "+ افزودن جلسه" : "+ Add Meeting"}
              </button>
            </div>
          </form>
        </div>

        {/* Tasks Box */}
        <div className="glass-dark flex flex-1 flex-col rounded-2xl p-3.5">
          <h3 className="mb-3 flex items-center justify-between text-[11.5px] font-normal tx1">
            <span className="flex items-center gap-2">
              <span className="chip-bg grid h-6 w-6 place-items-center rounded-md text-[12px] accent-t">☑</span>
              {rtl ? "کارهای من" : "My Tasks"}
            </span>
            <span className="text-[10px] tx3">({currentTasks.length})</span>
          </h3>

          <div className="thin-scroll mb-2.5 max-h-[140px] flex-1 space-y-2 overflow-y-auto pr-1">
            {currentTasks.length === 0 ? (
              <div className="text-center text-[10px] py-4 tx3">{rtl ? "کاری ثبت نشده است" : "No tasks"}</div>
            ) : (
              currentTasks.map((tItem) => (
                <div key={tItem.id} className="glass-row group flex items-center justify-between rounded-xl p-2.5 transition hover:bg-[var(--row-active)]">
                  <label className="flex flex-1 cursor-pointer items-start gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={tItem.completed}
                      onChange={() => toggleTask(tItem.id)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-white/20 bg-black/20 text-sky-500 outline-none ring-0 focus:ring-0"
                    />
                    <div className={`text-[10px] font-light leading-4 tx1 truncate ${tItem.completed ? "line-through opacity-50" : ""}`}>
                      {tItem.text}
                    </div>
                  </label>
                  <button
                    onClick={() => handleDeleteTask(tItem.id)}
                    className="opacity-60 transition hover:opacity-100 tx3 hover:text-rose-400 p-1 ml-1"
                    title={rtl ? "حذف کار" : "Delete task"}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Form to add new task */}
          <form onSubmit={handleAddTask} className="flex gap-1.5 border-t border-white/5 pt-2">
            <input
              type="text"
              placeholder={rtl ? "افزودن کار جدید..." : "New task..."}
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              className="flex-1 rounded-lg bg-black/20 px-2.5 py-1.5 text-[10px] tx1 placeholder:tx4 outline-none border border-white/10 focus:border-sky-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-sky-500/20 px-3 py-1.5 text-[10px] font-medium text-sky-400 transition hover:bg-sky-500/30 whitespace-nowrap"
            >
              {rtl ? "+ افزودن" : "+ Add"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}