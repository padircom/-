# PEX Deliverable 11 — Reporting, Templates & Output
خلاصه ۳ خط: دو قالب Internal/External. سربرگ A4 با ۳ لوگو. Excel ظرف بازتولید از DB. رنگ P6 یا سفارشی. پیش‌نمایش پنجره جدا نه شکستن پوسته Arena.

D10 بدون بازخورد.

---

## Template Engine
هر گزارش: `Kind = Internal | External`  
Internal = کاربر/پیمانکار (جزئیات بیشتر، Draft watermark اختیاری).  
External = ابلاغی کارفرما/مشاور (رسمی، امضا، بدون داده حساس داخلی).

**ReportHeaderConfig:** LogoContractor, LogoClient, LogoConsultant (fileId) + Project.Code/Name/Client/DataDate/Revision.  
صفحه A4 Portrait یا Landscape. پاورقی: تهیه / بررسی / تأیید + محل امضا.

**ReportColorScheme:**  
- Primavera Standard: Critical=#FF0000, Milestone=لوزی سیاه، Progress=#0000FF, Baseline=#000000, Remaining=#00FF00 (نزدیک P6 کلاسیک؛ قابل override)  
- Custom: JSONB palettes picker در صفحه d2 نه سایدبار اصلی.

QR روی PDF: لینک ReportInstance + checksum.

---

## خروجی / ورودی
| جهت | فرمت | قاعده |
|---|---|---|
| Out | XLSX | گروه‌بندی WBS، رنگ سطح، فرمول فقط نمایش؛ داده از DB |
| Out | DOCX | سربرگ لوگو، جدول، mammoth معکوس برای ingest |
| Out | PDF | مهر، واترمارک نقش، A4 |
| Out | PNG/SVG | S-Curve, Histogram, Gantt, Heatmap |
| In | DOCX | قرارداد/شرح خدمات → AI WBS (D3) |
| In | XER/XML P6 | ExternalIdP6 Round-Trip |
| In | MSP XML/MPP | parse predecessors |
| In | XLSX | Template Designer + incremental + cell validation مثل PIM D3 |

پیش‌نمایش: پنجره/route جدا `preview`؛ پوسته اصلی و فونت دست نخورَد.

P6 pipeline: Parse → map ExternalId → validate calendar/rel → staging → commit. Export همان Id برای Round-Trip. Excel هرگز SoT نیست.

---

## ۲۰+ گزارش استاندارد
1–10 Milestone (D5) · 11–20 Critical Path (D6)  
21 MDR-like Activity Register · 22 Baseline vs Current · 23 Look-ahead + PPC  
24 DPR summary · 25 WPR · 26 MPR ابلاغی  
27 PMS S-Curve · 28 EVM SPI/CPI/ES · 29 Resource histogram  
30 Material status · 31 DCMA 14 · 32 Delay register  
33 Cash flow · 34 Variance CAM · 35 Handover/Punch A  
36 Schedule update log

هر کدام دو قالب Internal/External و سه فرمت فایل.

---

## ۱۵+ KPI (هدف نمونه)
| KPI | هدف |
|---|---|
| SPI | ≥ 0.95 |
| CPI | ≥ 0.95 |
| SPI(t) | ≥ 0.95 |
| PPC look-ahead | ≥ 80% |
| Physical% vs Plan@DD | انحراف ≤ 5% |
| CP Drift | ≤ 5 روز |
| HealthScore DCMA | ≥ 80 |
| Milestone OnTrack | ≥ 85% |
| Overdue MS | 0 قراردادی |
| DPR on-time | ≥ 95% در 24h |
| Punch A open at MC | 0 |
| TF<0 count | 0 |
| Material shortage alerts | 0 بحرانی |
| Timesheet approve lag | ≤ 48h |
| Period close on time | 100% |

---

## وایرفریم داشبورد (صفحه d2)
ردیف1: SPI/CPI/Physical%/HealthScore کارت glass.  
ردیف2: S-Curve + CP Drift spark.  
ردیف3: Upcoming MS + Overdue DPR.  
سایدبار داخلی فرآیندهای d2؛ سایدبار اصلی برنامه بدون آیتم جدید.

---

## Self-Validation D11
| Loop | |
|---|---|
| 1 | Communications reports + Integration baseline pack |
| 2 | ۱۰ گزارش MS در لیست 1–10 |
| 3 | ۱۰ گزارش CP در 11–20 |
| 4 | KPI آستانه = AlertRule |
| 5 | S-Curve Actual=Approved |
| 6 ★ | Internal/External، P6+Custom color، ۳ لوگو، A4، Excel/Word/PDF، Word in، preview جدا، P6/MSP Round-Trip |
| 7 | فیلد گزارش = ستون D2 |
| 8 | DOCX با lib موجود mammoth/xlsx؛ PDF F5 |
| 9 | External قالب بدون Secret؛ watermark نقش |

**Gap:** رندر واقعی PDF/لوگو F5. Parser XER کامل F1. رنگ P6 دقیق کارگاه با پلنر. QR نیاز URL پایدار.
