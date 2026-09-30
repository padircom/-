/** کاتالوگ مرجع «مراحل کاری پتروشیمی» — خوشهٔ c2 و پروژه‌های زیرمجموعه.
 *
 * ── منشأ ────────────────────────────────────────────────────────────
 *
 * رونویسی برگه‌های مرجع تصویری کاربر. برچسب‌ها و وزن‌ها **عیناً** همان
 * چیزی هستند که در برگه آمده‌اند — شامل غلط‌های املایی برگه (مثل
 * «Resturant») و جمع‌هایی که ۱۰۰ نمی‌شوند. اصلاح سلیقه‌ای یعنی دست
 * بردن در سند مرجع؛ هر انحرافی را رابط کاربری با رنگ زرد نشان می‌دهد
 * تا تصمیمش با خود کاربر باشد.
 *
 * وضعیت رونویسی:
 *   ✔ صفحهٔ ۱ — Mobilization & Demobilization (۹ ردیف)
 *   … صفحات بعدی هنوز نرسیده‌اند.
 *
 * ── نگاشت ستون‌های برگه به سه کشوی صفحه ─────────────────────────────
 *
 *   عنوان برگه   → «۱. حوزه کاری»
 *   ستون Mob Type → «۲. جاب‌فاز»      (بخش پیش از ` / ` در نام ردیف)
 *   ستون JOB PHASES → «۳. ردیف کاری»  (بخش پس از ` / `)
 *   ستون‌های WORK STEP → جدول گام‌ها با وزن قابل ویرایش
 *
 * برگهٔ پتروشیمی یک ستون گروه‌بندی بیشتر از برگه‌های نفتی دارد
 * (Mob Type). چون قالب ردیف همان است، این ستون در نام ردیف با ` / `
 * کدگذاری شد؛ به این ترتیب بدون تغییر منطق، هر سه سطح برگه حفظ می‌شود.
 *
 * ── نحوهٔ افزودن صفحات بعدی ─────────────────────────────────────────
 *
 * هر ردیف: [حوزهٔ کاری، «گروه / ردیف»، گام‌ها]
 * گام‌ها با `|` جدا و هر گام به شکل `نام:وزن`.
 */

import { buildWorkStages, type WorkStageRow } from "./workStages";

const rows: WorkStageRow[] = [
  /* ───────── صفحهٔ ۱ · Mobilization & Demobilization ───────── */

  ["Mobilization & Demobilization", "Primary Mobilization / Designing Office Layout", "Office Layout:40|Shop Layout:40|Sub area Layout:20"],
  ["Mobilization & Demobilization", "Primary Mobilization / Installation Conex", "Main Office:80|Installation Conex:20"],
  ["Mobilization & Demobilization", "Primary Mobilization / Mobilization of Batching Plant", "Mobilization of Batching Plant:100"],
  ["Mobilization & Demobilization", "Primary Mobilization / Fencing around the yard", "Fencing around the yard:100"],
  ["Mobilization & Demobilization", "Primary Mobilization / Camp", "Camp:100"],
  ["Mobilization & Demobilization", "Primary Mobilization / Resturant", "Resturant:100"],
  ["Mobilization & Demobilization", "Primary Mobilization / Shop & Warehouse", "Fencing:5|Preparing Rebar Workshop:25|Preparing of Welding shop:20|Preparing Of Spool Yard:4|Preparing Of Support Shop:2|Preparing Warehouse:4|Preparing Material Stores:4|Preparing Of Sandblast & Painting Yard:9|Preparing Of Electrical Shop:9|Preparing Of Instrument Shop:9|Preparing Of Insulation Shop:9"],

  /* یادداشت «As Per Construction Progress» در برگه یک سلول ادغام‌شده
   * کنار همین ردیف است، نه یک گام مستقل. چون نوع گام فقط نام و وزن
   * دارد، یادداشت داخل پرانتز نام آمد — همان روشی که برگه‌های نفتی
   * برای همین ردیف به کار برده بودند. */
  ["Mobilization & Demobilization", "Mobilization / Continuous Mobilization", "Continuous Mobilization (As Per Construction Progress):100"],

  ["Mobilization & Demobilization", "Demobilization / Demobilization", "Demobilization:100"],
];

export const petrochemicalWorkStages = buildWorkStages(rows);
