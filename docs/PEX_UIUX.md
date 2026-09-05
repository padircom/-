# PEX UI/UX — Wireframes + Component Structure

دامنه: صفحات کلیدی D12. **سایدبار اصلی محصول تغییر نمی‌کند.** ورود از صفحه دامنه d2 پس از انتخاب صنعت/پروژه. شِل موجود: شیشه + Vazirmatn + RTL. بدون lucide در شِل.

---

## Design System (هم‌تراز محصول فعلی)

| توکن | مقدار |
|---|---|
| Font | Vazirmatn, 13–14px بدنه، 16–18 عنوان |
| Radius | 10–14px کارت شیشه |
| Gap | 8 / 12 / 16 / 24 |
| رنگ بحرانی | `#FF9F9F` (نه قرمز خالص P6 روی شِل) |
| مایلستون | `#7FB2FF` |
| پیشرفت | `#8FE3C8` |
| Baseline | `#94A3B8` |
| باقیمانده | `#FFD48A` |
| سطح | شیشه نیمه‌شفاف روی گرادیان موجود |
| Density | جدول فشرده؛ موبایل DPR تک‌ستونه |

رنگ Primavera فقط داخل **خروجی گزارش خارجی** و Gantt با سوئیچ «P6 colors».

---

## Component Library

```
PexPageShell          // عنوان FA/EN + تب داخلی ماژول — نه RightSidebar
PexFilterBar          // پروژه، DataDate، WBS، رشته
PexKpiStrip           // ۴–۶ کارت KPI
PexTable              // sort, sticky header, offset/cursor
PexChart              // S-curve, histogram, float trend (SVG)
PexGanttCanvas        // timescale + bars + baseline overlay
PexMilestoneWidget    // OnTrack / AtRisk / Delayed
PexCpWidget           // طول CP + TF=0 count
PexEvmStrip           // SPI CPI SPI(t) EAC
PexBtnPrimary / Ghost / Danger
PexChipStatus
PexDrawer / PexModal  // جزئیات فعالیت
PexFormField          // لیبل FA، خطا ۴۰۰
PexPager              // offset + cursor
PexAlertRow
PexTemplateCanvas     // طراح قالب
```

دکمه‌ها: Primary شیشه پررنگ، Ghost حاشیه، Danger فقط حذف/قفل.

---

## ۱) Dashboard مدیر پروژه

```
┌ PexPageShell: کنترل پروژه / Dashboard ─────────────────────────┐
│ [Filter: پروژه | DataDate]                                      │
│ ┌KPI SPI┐ ┌CPI┐ ┌PPC┐ ┌Health┐ ┌Penalty est.┐                  │
│ ┌ MilestoneWidget (OnTrack/AtRisk/Delayed chips) ─────────────┐ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌ CP Widget: TF=0 = 42 | Near=18 | DCMA 14 score ─────────────┐ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌ EVM: PV EV AC | S-curve spark  | VAC ───────────────────────┐ │
│ └─────────────────────────────────────────────────────────────┘ │
│ جدول Look-ahead ۷ روز | فهرست Alert بدون ACK                   │
└─────────────────────────────────────────────────────────────────┘
```

کامپوننت: `PexDashboardPage` → KpiStrip + MilestoneWidget + CpWidget + EvmStrip + Table + AlertRow.

---

## ۲) Gantt تعاملی

```
┌ فیلتر WBS / Critical only / Baseline on ─┬ timescale D/W/M ┐
│ کد │ نام │ مدت │ TF │ ES EF │████████░░░░  baseline ---   │
│    │     │     │    │       │  ██ crit                     │
└────┴─────┴─────┴────┴───────┴──────────────────────────────┘
 Drawer: روابط FS/SS + تقویم + قید
```

`PexGanttPage` = FilterBar + split (جدول + `PexGanttCanvas`). درگ مدت فقط اگر دوره Open و قفل WBS رعایت شود.

---

## ۳) Milestone Tracking

```
تب: Register | Alerts | Reports 1–10 | Penalty
جدول: کد | نوع | Contractual | Forecast=EF | Actual | Status chip | جریمه
```

`PexMilestonePage` — ویرایش تاریخ قراردادی بدون CR → ۴۰۹.

---

## ۴) Critical Path Analysis

```
نوار: طول CP | جابجایی مسیر | Float trend chart
جدول فعالیت‌های TF=0 + Near-Critical
دکمه گزارش ۱–۱۰
```

`PexCpPage` = CpWidget + Chart + Table.

---

## ۵) فرم DPR (وب + موبایل)

**وب**

```
تاریخ | شیفت | آب‌وهوا
خطوط پیشرفت: فعالیت | گام RoC | مقدار | مدرک
نیروی انسانی | تجهیز | توقف | ایمنی | عکس
[ثبت پیش‌نویس] [ارسال WF2]
```

**موبایل (ستون تکی)**

```
تاریخ    شیفت
[+ خط پیشرفت]
[+ عکس]
ارسال
```

`PexDprForm` — آفلاین: صف محلی، صفحه `sync/conflicts`.

---

## ۶) Template Designer (AI)

```
چپ: کتابخانه بلوک (هدر سه لوگو، جدول، نمودار)
وسط: بوم WYSIWYG
راست: AI prompt «قالب MPR نفت» → پیشنهاد → Approve
پایین: رنگ P6 / Arena | Internal/External
```

`PexTemplateDesigner` + `PexAiPanel`. بدون اعمال خودکار روی WBS.

---

## ۷) Look-ahead

```
هفته‌های ۱/۲/۳/۴/۶ | فیلتر پیمانکار
جدول: فعالیت پنجره | پیش‌نیاز باز | منبع | PPC
```

`PexLookaheadPage`.

---

## ۸) Report Generator

```
قالب ▼ | Internal/External | XLSX/DOCX/PDF
پیش‌نمایش هدر + رنگ
[Generate] → job 202 → دانلود
```

`PexReportGenerator`.

---

## ۹) Alert Center

```
فیلتر دسته/شدت | فقط ACK نشده
ردیف: زمان | قانون JSON | payload | [ACK]
```

`PexAlertCenter`.

---

## ساختار فایل پیشنهادی (پیاده‌سازی بعدی — الان ساخته نشود در شِل)

```
منبع دامنه d2 (زیرماژول داخلی، نه RightSidebar):
  PexDashboardPage
  PexGanttPage
  PexMilestonePage
  PexCpPage
  PexDprForm
  PexLookaheadPage
  PexReportGenerator
  PexAlertCenter
  PexTemplateDesigner
```

قانون: هیچ آیتم جدیدی روی سایدبار اصلی.
