/** کاتالوگ مرجع «مراحل کاری پتروشیمی» — خوشهٔ c2 و پروژه‌های زیرمجموعه.
 *
 * ── منشأ ────────────────────────────────────────────────────────────
 *
 * رونویسی برگه‌های مرجع تصویری کاربر. برچسب‌ها و وزن‌ها **عیناً** همان
 * چیزی هستند که در برگه آمده‌اند — شامل غلط‌های املایی برگه
 * («Resturant»، «Gravell»، «Chromming»، «Sysrem»، «Installaion»،
 * «Prepration»، «Seperation»، «Handing») و جمع‌هایی که ۱۰۰ نمی‌شوند.
 * اصلاح سلیقه‌ای یعنی دست بردن در سند مرجع؛ هر انحرافی را رابط کاربری
 * با رنگ زرد نشان می‌دهد تا تصمیمش با خود کاربر باشد.
 *
 * ── نگاشت ستون‌های برگه به سه کشوی صفحه ─────────────────────────────
 *
 *   عنوان برگه          → «۱. حوزه کاری»
 *   ستون گروه‌بندی برگه  → «۲. جاب‌فاز»   (Mob Type / Building Type / نوع)
 *   ستون JOB PHASES     → «۳. ردیف کاری»
 *   ستون‌های WORK STEP   → جدول گام‌ها با وزن قابل ویرایش
 *
 * برگه‌هایی که ستون گروه‌بندی ندارند، با شکل سه‌تایی نوشته می‌شوند و
 * خودِ ردیف نقش گروه را می‌گیرد — دقیقاً مثل برگه‌های نفتی.
 *
 * ── آنچه عمداً رونویسی نشد ───────────────────────────────────────────
 *
 * این ردیف‌ها در برگه ناخوانا یا ناتمام بودند و با حدس پر **نشده‌اند**:
 *
 *   · Static Equipment ▸ «Double Tank» و «Spherical tank» (Note 12) —
 *     در برگه خالی‌اند.
 *   · Equipment Packages ▸ «Double Tank» و «Spherical tank» — در برگه
 *     زرد/قرمز علامت خورده‌اند یعنی هنوز نهایی نشده‌اند؛ ردیف وزن هست
 *     ولی نام گام‌ها خالی است.
 *   · Rotary Equipment ▸ «Silencer» — ردیف خالی.
 *
 * (تأیید ۱۴۰۵/۰۷/۰۸: هر پنج ردیف تا رسیدن برگهٔ نهایی بیرون از کاتالوگ
 * می‌مانند.)
 *
 * برگه‌های Civil و Piping کامل‌اند (کاربر تأیید کرد): نشانگر «Page 2»
 * کنار تصویر مرز ناحیهٔ چاپ است، نه صفحهٔ دوم داده.
 *
 * ── تنها برچسبی که از برگهٔ پتروشیمی خوانده نشده ────────────────────
 *
 * نام گام‌های `Piping ▸ Valve Erection- (AG)` از ردیف هم‌ارز کاتالوگ
 * نفتی برداشته شده است (وزن‌ها در هر دو برگه یکی است). جزئیات کنار
 * خود ردیف. هیچ **وزنی** در این فایل استنتاجی نیست.
 *
 * ── ردیف‌های با جمع ناهمسان ─────────────────────────────────────────
 *
 * ۱۳ ردیف جمعشان ۱۰۰ نیست و این عمدی است. کاربر بررسی و تأیید کرد که
 * نرمال‌سازی خودکار لازم نیست، چون وزن هر گام در خود صفحه قابل ویرایش
 * است و رابط کاربری جمع ناهمسان را زرد نشان می‌دهد.
 *
 * چرا با تقسیم خودکار به ۱۰۰ نرسیدند:
 *
 * دو چیز متفاوت را نباید یکی کرد. «۱۰۱ بودنِ جمع در برگه» یک واقعیتِ
 * سند است؛ «۹۸٫۵ بودنِ Fan/Blower» احتمالاً خطای رونویسی است. اگر هر
 * دو با یک ضریب به ۱۰۰ کشیده شوند، خطای رونویسی داخل داده دفن می‌شود
 * و پرچمی که باید آن را لو بدهد هم پاک می‌شود. نرمال‌سازی وقتی درست
 * است که منشأ انحراف معلوم باشد.
 *
 *   · ۱۲ ردیف `MECHANICAL WORK` و `ELECTRICAL WORK` ساختمان‌ها = ۱۰۱،
 *     عیناً مطابق برگه.
 *   · `Rotary Equipment ▸ Fan/Blower` = ۹۸٫۵ — ۳۲ گام در نواری بسیار
 *     باریک؛ تنها ردیفی که به خوانشش اطمینان نیست. پیش از استناد به
 *     این ردیف، با نسخهٔ بزرگ‌ترِ برگه مقابله شود (تأیید ۱۴۰۵/۰۷/۰۸:
 *     تا رسیدن آن نسخه، رونویسی فعلی با همین هشدار می‌ماند).
 *
 * حل‌شده ۱۴۰۵/۰۷/۰۸: `Equipment Packages ▸ Package Equipment` در برگهٔ
 * کامل ۹۵ بود (۱۰/۸/۶۰/۵/۵/۲/۵) و در برگهٔ کوچک‌تر ۱۰۰
 * (۵/۵/۶۰/۱۵/۵/۵/۵). با تصمیم کاربر وزن‌های برگهٔ کوچک‌تر ثبت شد؛ نام
 * گام‌ها از برگهٔ کامل ماند، چون برچسب‌های برگهٔ کوچک‌تر داده نشده
 * است. جزئیات کنار خود ردیف.
 *
 * ── نحوهٔ افزودن ردیف ────────────────────────────────────────────────
 *
 *   بدون گروه: [حوزه، ردیف، گام‌ها]
 *   با گروه:   [حوزه، گروه، ردیف، گام‌ها]
 *   گام‌ها: `نام:وزن|نام:وزن|…`
 */

import { buildWorkStages, type WorkStageRow } from "./workStages";

/* ابرگام‌های پرتکرار ساختمان‌ها. در برگه‌های «Industrial» و
 * «Non-Industrial» عیناً تکرار شده‌اند؛ تکرار دستی‌شان یعنی ۳۰ رشتهٔ
 * یکسان که با یک تایپ اشتباه از هم واگرا می‌شوند. */
const BLD_CONCRETE = "Excavation:5|Lean Conc.:3|Rebar:25|Formwork:20|Concrete Pouring (M3):32|Curing:5|Backfill & Compaction:5|Final Inspection:5";
const BLD_ARCH = "Side Walk External Works:2|Wall External Works:19|Roof External Works:17|Floor Interior Works:32|Wall Interior Works:24|Roof Interior Works:6";
const BLD_MECH_FULL = "Handling:5|HVAC Equipment:7|HVAC Ducting Work:28|HVAC Piping Work:28|HVAC Electrical Work:10|HVAC Control Work:8|Fire Fighting:6|Plumbing Works:4|Final Inspection:5";
/* دو نمای برق ساختمان که فقط در سه وزن اول/میانی فرق دارند. */
const BLD_ELEC_23 = "Conduit Work:23|Cable tray & cable ladder & Accessories Installation:15|Wire & Cable Pulling:5|Switch Installation:3|Power Outlet Installation:12|Lighting Installation:3|Cad Weld Connection:4|Support Material Galvanized:2|Fire & Gas System:14|Lightning Installation:1|Termination:8|Telecom & Paging Equipment:9|Distribution Panels Installation:2";
const BLD_ELEC_15 = "Conduit Work:15|Cable tray & cable ladder & Accessories Installation:20|Wire & Cable Pulling:5|Switch Installation:3|Power Outlet Installation:12|Lighting Installation:3|Cad Weld Connection:4|Support Material Galvanized:2|Fire & Gas System:15|Lightning Installation:3|Termination:8|Telecom & Paging Equipment:9|Distribution Panels Installation:2";
const BLD_ELEC_TRAY = "Tray Installation:12|Conduit Installation:10|Cabling and Wiring:30|Ltg Fixture, Detector, etc Install:20|Distribution Panel:8|Earthing:3|Telecommunication & Paging System:7|Support:5|Final Inspection:5";

/* پنج نمای استاندارد تجهیز ثابت که بین چند ردیف مشترک‌اند. */
const SE_STD_10 = "Material Handling:5|Chipping & Padding:5|Installation:55|Alignment / Leveling:4|Grouting:5|Bolt Tightening:6|External Installation:10|Internal Installation:3|Punch Removal:2|Final Inspection:5";
const SE_STD_9 = "Material Handling:5|Chipping & Padding:5|Installation:55|Alignment / Leveling:5|Grouting:5|Bolt Tightening:8|External Installation:10|Punch Removal:2|Final Inspection:5";
const SE_TANK_PLATE = "Marking & Cutting & Beveling:30|Material Handling  & Arrangement:4|Fit up:34|Welding:30|NDT & Inspection Test:2";
/* گام‌های مشترک دوار: کمپرسور/توربین/پمپ یک زنجیرهٔ یکسان دارند. */
const RE_STD = "Material Handling:5|Chipping & Padding:5|Installation:45|Positioning:5|Pocket Grout:3|Leveling:2|Full Grouting:10|First Alignment:3|Accessories:5|Skid Filling:5|Final Alignment:7|Final Inspection:5";
/* عایق: هر شش ردیف برگه دقیقاً یک زنجیره دارند. */
const INS_STD = "Material Preparation and surface Preparation*:10|Insulation:50|METAL Jacketing and Sealing Work:30|Cleaning & Punch Clear:5|FINAL INSPECTION:5";
/* ارت‌کشی: در برگه‌های Electrical و Instrumentation یکسان است. */
const GROUNDING = "Handling:5|EARTH PIT/EARTH RODE INSTALLATION:20|WIRE LAYING:30|COMPRESSION CLAMP/CADWELD CONNECTION:20|EARTHING DISPATCHER/EARTHING LUG:15|Test:5|FINAL INSPECTION:5";
/* حفاظت کاتدی: دو ردیف برگهٔ Electrical با هم مو نمی‌زنند. */
const CATHODIC = "Handling:5|ANODE INSTALLATION:20|Reference Electrod Installation:5|CABLE LAYING:30|BOX INSTALLATION (HALFCELL,TEST, POSITIVE & NEGATIVE):5|EQUIPMENT INSTALLATION (Trans, Resistance Band Box):20|TERMINATION INCLUDING CAD WELD:5|TEST:5|FINAL INSPECTION:5";
/* مخابرات: سه ردیف تجهیزات یک زنجیره دارند. */
const TEL_EQUIP = "Handling:5|Support Fabrication:20|Support Installation:40|Equipment Installation:25|Test:5|Final Inspection:5";

const rows: WorkStageRow[] = [
  /* ═══════════ Mobilization & Demobilization ═══════════
   * ستون گروه‌بندی برگه: Mob Type */

  ["Mobilization & Demobilization", "Primary Mobilization", "Designing Office Layout", "Office Layout:40|Shop Layout:40|Sub area Layout:20"],
  ["Mobilization & Demobilization", "Primary Mobilization", "Installation Conex", "Main Office:80|Installation Conex:20"],
  ["Mobilization & Demobilization", "Primary Mobilization", "Mobilization of Batching Plant", "Mobilization of Batching Plant:100"],
  ["Mobilization & Demobilization", "Primary Mobilization", "Fencing around the yard", "Fencing around the yard:100"],
  ["Mobilization & Demobilization", "Primary Mobilization", "Camp", "Camp:100"],
  ["Mobilization & Demobilization", "Primary Mobilization", "Resturant", "Resturant:100"],
  ["Mobilization & Demobilization", "Primary Mobilization", "Shop & Warehouse", "Fencing:5|Preparing Rebar Workshop:25|Preparing of Welding shop:20|Preparing Of Spool Yard:4|Preparing Of Support Shop:2|Preparing Warehouse:4|Preparing Material Stores:4|Preparing Of Sandblast & Painting Yard:9|Preparing Of Electrical Shop:9|Preparing Of Instrument Shop:9|Preparing Of Insulation Shop:9"],
  /* یادداشت «As Per Construction Progress» در برگه سلول ادغام‌شده است،
   * نه گام مستقل؛ داخل پرانتز نام آمد. */
  ["Mobilization & Demobilization", "Mobilization", "Continuous Mobilization", "Continuous Mobilization (As Per Construction Progress):100"],
  ["Mobilization & Demobilization", "Demobilization", "Demobilization", "Demobilization:100"],

  /* ═══════════ Civil ═══════════ (بدون ستون گروه‌بندی) */

  ["Civil", "Road", "Sub-Grade:10|Sub-Base:10|Base:15|Primer:15|Binder:25|Topeka:15|Mark&Signs:5|Final Inspection:5"],
  ["Civil", "Concrete Paving", "Bed Preparation & Compaction:15|Wire Mesh/Rebar (Kg) & Plastic Sheet:25|Form Work & Joints:10|Concrete Pouring (M3):40|Curing:5|Final Inspection:5"],
  ["Civil", "Gravell Paving", "Bed Preparation & Compaction:20|Gravelling:75|Final Inspection:5"],
  ["Civil", "Cable Trench", "Excavation:10|Preparation:5|Lean Concrete:5|Rebar:15|Form Work:10|Concrete Pouring (M3):30|Curing:3|Bitumin. Coat:2|Backfill & Compaction:10|Sandfill:5|Final Inspection:5"],
  ["Civil", "UG Trench", "Excavation:30|Preparation:10|Sand Fill (M3):20|Backfill & Compaction (M3):35|Final Inspection:5"],
  ["Civil", "U Ditch (Open Ditch)/Channel", "Excavation:10|Preparation & Lean Concrete (M3):5|Rebar:20|Form Work:15|Concrete Pouring (M3):27|Curing:3|Backfill & Compaction (M3):10|Slab Placing:5|Final Inspection:5"],
  ["Civil", "Culvert (Cubes beside road)", "Excavation:15|Preparation & Lean Concrete (M3):5|Rebar:15|Form Work:15|Concrete Pouring (M3):35|Backfill & Compaction (M3):10|Final Inspection:5"],
  ["Civil", "Equipment, PL FDN", "Excavation:5|Leveling&Compaction:5|Lean Concrete:5|Foundation Rebar:10|Foundation Formwork:5|Foundation Concrete Pouring (M3):20|Pedestal Rebar:5|Pedestal Formwork:5|Anchor Bolt (PCS):5|Pedestal Concrete Pouring (M3):15|Curing:2|Bitumen. Coat:3|Backfill & Compaction:10|Final Inspection:5"],
  ["Civil", "Duct Bank", "Excavation:10|Lean Concrete:3|Rebar:15|PVC:10|Formwork:15|Concrete Pouring (M3):30|Curing:3|Bitumen. Coat:2|Backfill & Compaction:7|Final Inspection:5"],
  ["Civil", "Pit/Pond/Sump/Basin", "Excavation:5|Lean Concrete:2|Rebar:20|Form Work:21|Concrete Pouring (M3):30|Curing:2|Bitumen. Coat:5|Backfill & Compaction:5|Chequered Plate Cap Installation:5|Final Inspection:5"],
  ["Civil", "Manhole, Catch Basin, Sump Valvebox", "Excavation:5|Lean Concrete:2|Rebar:19|Form Work:19|Concrete Pouring (M3):25|Curing:2|Bitumin. Coat:5|Installation:5|Leak Test:3|Backfill & Compaction:5|Cap Installation:5|Final Inspection:5"],
  ["Civil", "Pipe Sleeper/Pipe Support", "Excavation:5|Leveling&Compaction:5|Lean Concrete:5|Foundation Rebar:10|Foundation Formwork:4|Foundation Concrete Pouring (M3):20|Pedestal Rebar:5|Pedestal Formwork:5|Embedded Item:6|Bolt/Plate Positioning:5|Pedestal Concrete Pouring (M3):10|Curing:2|Bitumen. Coat:3|Backfill & Compaction:10|Final Inspection:5"],
  ["Civil", "Pipe Rack & Equipment Structure & Shelter", "Excavation:5|Leveling&Compaction:5|Lean Concrete:5|Foundation Rebar:10|Foundation Formwork:5|Foundation Concrete Pouring (M3):20|Pedestal Rebar:5|Pedestal Formwork:5|Anchor Bolt (PCS):5|Pedestal Concrete Pouring (M3):15|Curing:2|Bitumen. Coat:3|Backfill & Compaction:10|Final Inspection:5"],
  ["Civil", "Dikes/Bund Wall/Spillage Wall/Seperation Wall/Retaining Wall", "Excavation:5|Lean Concrete:5|Rebar:20|Formwork:24|Concrete Pouring (M3):29|Curing:2|Bitumin. Coat:5|Backfill & Compaction:5|Final Inspection:5"],
  ["Civil", "Stone Pitching", "Leveling:15|Chromming:10|Marlstone:20|Stone Concert:50|Final Inspection:5"],
  ["Civil", "Lighting Pole", "Excavation:5|Lean Concrete:3|Rebar:20|Formwork:20|Concrete Pouring (M3):30|Anchor Bolt Set.:12|Backfill & Compaction:5|Final Inspection:5"],
  ["Civil", "UG RC", "Excavation:20|Preparation:20|Pipe laying:40|Fit up:15|Final Inspection:5"],

  /* ═══════════ Steel Work ═══════════ */

  /* سه ردیف زیر ` / ` داخل نام خودشان دارند و گروهشان صریح تکرار شده،
   * وگرنه قاعدهٔ سازگاریِ شکل سه‌تایی «Column / Tower» را به گروه
   * «Column» و ردیف «Tower» تکه می‌کرد — گروهی که در برگه وجود ندارد. */
  ["Steel Work", "Equipment Structure Erection", "MATERIAL DELIVERY AT JOB SITE:10|Chipping & Padding:5|ERECTION:55|ALIGNMENT:10|BOLT TIGHTENING:10|GROUTING:5|PUNCH CLEAR:5"],
  ["Steel Work", "Pipe Rack /Shelter/PST/STR/etc Erection", "MATERIAL DELIVERY AT JOB SITE:10|Chipping & Padding:5|ERECTION:55|ALIGNMENT:10|BOLT TIGHTENING:10|GROUTING:5|PUNCH CLEAR:5"],
  ["Steel Work", "SHEETING", "MATERIAL DELIVERY AT JOB SITE:10|SIZING  & ASSEMBLING:10|ERECTION:55|ALIGNMENT:10|BOLT TIGHTENING:10|PUNCH CLEAR:5"],
  ["Steel Work", "HAND  RAIL / LADDER", "HAND  RAIL / LADDER", "MATERIAL DELIVERY AT JOB SITE:10|ERECTION:65|BOLT TIGHTENING:20|PUNCH CLEAR:5"],
  ["Steel Work", "GRATING / STAIR TREAD", "GRATING / STAIR TREAD", "MATERIAL DELIVERY AT JOB SITE:10|ERECTION:55|ALIGNMENT:10|BOLT TIGHTENING:20|PUNCH CLEAR:5"],

  /* ═══════════ Piping ═══════════ */

  ["Piping", "Piping Support Shop Fabrication -(AG)", "Handling:10|Cutting:10|Assembling:35|Welding:35|NDT:5|Final Inspection:5"],
  ["Piping", "Piping Support Field Installation -(AG)", "Handling:10|Erection/Fit Up ( Assembly in Position):34|Welding/Bolting:30|NDT:11|Clamp Installation:5|Punch Removal:5|Final Inspection:5"],
  ["Piping", "Piping Shop Fabrication - (AG)", "Fit Up:35|Welding:48|NDT:10|PWHT:2|Final Inspection:5"],
  ["Piping", "Piping Field Erection - (AG)", "Scaffolding:5|Fit Up:25|Welding:35|NDT:8|PWHT:2|Punch A Removal:5|Test Package Prepration:2|Hydro-Test:10|Reinstatement:3|Final Inspection:5"],
  /* «Valve Erection- (AG)»: در برگهٔ پتروشیمی فقط ردیف وزن پر است و
   * سلول‌های نام گام خالی‌اند. نام‌ها از ردیف هم‌ارز کاتالوگ نفتی
   * («Valve Erection (AG) - welded») برداشته شد، چون هر پنج وزن مو به
   * مو یکی‌اند: ۱۰/۲۵/۵۰/۱۰/۵. این تنها ردیفی است که برچسب گامش از
   * برگهٔ پتروشیمی خوانده نشده — با تأیید کاربر. اگر نسخهٔ کامل برگه
   * رسید، همین‌جا جایگزین شود. */
  ["Piping", "Valve Erection- (AG)", "Material Handling:10|Valve Pre Installation (Fit Up):25|Welding:50|NDT:10|Final Inspection:5"],
  ["Piping", "Valve Erection- (UG)", "Handling:15|Installation:60|welding/Bolting:20|Final Inspection:5"],
  ["Piping", "Steam Tracing - (AG)", "Erection:15|Assembly:40|Welding/Threading:40|Final Inspection:5"],
  ["Piping", "U/G Piping (Metal)", "Material Handling:5|Fit Up:22|Welding:40|Alignment/Padding:5|NDT:5|Hydro-Test:10|Coating/Wrapping:5|Holiday Test:3|Final Inspection:5"],
  ["Piping", "U/G Piping (Non Metal)", "Material Handling:5|Bonding:70|Alignment/Padding:10|Hydro-Test:10|Final Inspection:5"],

  /* ═══════════ Static Equipment ═══════════
   * «Fixed/Floating Roof Tanks» در برگه سرگروهِ نُه زیرردیف است. */

  ["Static Equipment", "Drum/Vessel", SE_STD_10],
  ["Static Equipment", "Boiler", "Material Handling:10|Chipping & Padding:5|Installation:40|Align:10|Steel work, Coil Connection:15|Accessory Install:15|Final Inspection:5"],
  ["Static Equipment", "Dryer(DR)", SE_STD_10],
  ["Static Equipment", "Deaerator", SE_STD_10],
  ["Static Equipment", "Column / Tower", "Column / Tower", "Material Handling:5|Chipping & Padding:5|Installation:47|Alignment / Leveling:4|Grouting:5|Bolt Tightening:6|External Installation:10|Internal Installation:10|Punch Removal:2|Final Inspection:6"],
  ["Static Equipment", "Reactor", SE_STD_9],
  ["Static Equipment", "Heat Exchanger", SE_STD_9],
  ["Static Equipment", "Filter", SE_STD_10],
  ["Static Equipment", "Ejector", SE_STD_9],

  ["Static Equipment", "Fixed/Floating Roof Tanks", "Installation & Welding of ANNULAR Plate", SE_TANK_PLATE],
  ["Static Equipment", "Fixed/Floating Roof Tanks", "Installation & Welding of Bottom Plate", SE_TANK_PLATE],
  ["Static Equipment", "Fixed/Floating Roof Tanks", "Draw off Sump", SE_TANK_PLATE],
  ["Static Equipment", "Fixed/Floating Roof Tanks", "Installation & Welding of Shell Plate", "Marking & Cutting & Beveling:20|Rolling:6|Material Handling  & Arrangement:2|Shell Courses Fit up:35|Shell Courses Welding:20|Welding of Shell to Annular:15|NDT & Inspection Test:2"],
  ["Static Equipment", "Fixed/Floating Roof Tanks", "Installation & Welding of Roof Plate (Including Roof Support)", "Marking & Cutting & Beveling:20|Forming:6|Material Handling  & Arrangement:2|Fabrication & Installation Roof Support:35|Fit up:20|Welding:15|NDT & Inspection Test:2"],
  ["Static Equipment", "Fixed/Floating Roof Tanks", "Installation & Welding of Accessory", "Marking & Cutting & Beveling:20|Fabrication & Installation:35|Material Handling  & Arrangement:4|Fit up:24|Welding:15|NDT & Inspection Test:2"],
  ["Static Equipment", "Fixed/Floating Roof Tanks", "Hydro Test and Drainage & Cleaning Out", "Cleaning:25|Hydrostatic-Supply & Setelments & Filling in Water:45|Hydro Test and Drainage & Drying:30"],
  ["Static Equipment", "Fixed/Floating Roof Tanks", "Foam Package Sysrem", "Equipment Installation:60|Piping:30|Accessory Installation:10"],
  ["Static Equipment", "Fixed/Floating Roof Tanks", "Final Inspection Of Tank", "VT&RT Test:30|Oil&Pad Test:25|Final Inspection Test:45"],

  /* ═══════════ Rotary Equipment ═══════════ */

  ["Rotary Equipment", "Gas Compressor/Turbine", RE_STD],
  ["Rotary Equipment", "Compressor", RE_STD],
  ["Rotary Equipment", "Pump", RE_STD],
  ["Rotary Equipment", "Overhead Crane", "Material Handling:5|Installing Rail Frame:35|Main Frame Fabrication:30|Crane Install:20|Load Test:5|Final Inspection:5"],
  ["Rotary Equipment", "Air Cooler", "Material Handling:5|Assembling (Structure):10|Structure Installation:20|Tube Bundle Erection:26|Fan ( Ring,Guard,Support, Plate):10|Motor Installation:5|Positioning&Alignment of Body( St, Plenum):5|Bolt Tightening:2|Shaft Vertically/Motor Adjustment:3|Fabe Blade Angle/Gap Clearnce:3|Lubrication:3|Punch Removal:3|Final Inspection:5"],
  ["Rotary Equipment", "Mixer Agitator", "Installation:85|Internal Installation:10|Final Inspection:5"],
  ["Rotary Equipment", "Furnace", "Material Handling:0|Installation:60|Alignment / Leveling:8|Brick Work & Refractory:10|Internal Accessories:5|Grouting:4|External Installation:8|Final Inspection:5"],
  /* ⚠ ردیف Fan/Blower در تصویر بسیار فشرده است (۳۲ گام در یک نوار
   * باریک) و جمع خوانده‌شده ۹۸٫۵ درصد درمی‌آید نه ۱۰۰. رونویسی شد ولی
   * پیش از استناد باید با نسخهٔ بزرگ‌ترِ برگه مقابله شود. */
  ["Rotary Equipment", "Fan/Blower", "Material Handling:5|Chipping/Padding:1.5|Fan Stack:1|Motor:0.5|Gear Box:0.5|Film Fill Installation:10|Support Erection:3|Glung & Film Pack Module Preparation:3|Film Pack Moduls Installation:3|Distribution System:3|Pipe Drilling Preparation:1.5|Branches Fitting Assembly:1|Pipe Installation:1|Eliminator Installation:3|Pre Assembly of Eliminator Parts Inside Tower:1.5|Installation Elim Parts Inside Tower:1.5|FRP Fan Stack Installation:4|Fan Stack Assembly:4|Fan Stack Installation:4|Mechanical Parts ( Rotary Parts):16|Fan and Blade Shaft & Gear Box Erection:8|Motor Erection:6|Alignment & Bolting:2|Grouting:2|Jelousie Around the wall (Louver):4|Inside Walkway and Ladder Erection:1|Internal Walkway:0.5|Handrail Installation (Fandeck):0.5|Handrail Installation (Cold Water Basin Extension):0.5|Escape Ladder Installation:0.5|Handrail Installation ( Stairway):0.5|Final Inspection:5"],

  /* ═══════════ Equipment Packages ═══════════
   * ستون گروه‌بندی برگه: Fix / Machinery / Package */

  ["Equipment Packages", "Fix", "Drum/Vessel", "Material Handling:10|Chipping & Padding:8|Installation:60|Alignment / Leveling:8|Grouting:1|External Installation:8|Final Inspection:5"],
  ["Equipment Packages", "Fix", "Boiler", "Material Handling:10|Chipping & Padding:8|Installation:40|Align:10|Steel work, Coil Connection:15|Accessory Install:12|Final Inspection:5"],
  ["Equipment Packages", "Fix", "Column / Tower", "Material Handling:10|Chipping & Padding:8|Installation:60|Alignment / Leveling:8|Grouting:1|External Installation:8|Final Inspection:5"],
  ["Equipment Packages", "Fix", "Reactor", "Material Handling:10|Chipping & Padding:8|Installation:60|Alignment / Leveling:8|Grouting:1|External Installation:8|Final Inspection:5"],
  ["Equipment Packages", "Fix", "Heat Exchanger", "Material Handling:10|Chipping & Padding:8|Installation:60|Alignment / Leveling:8|Grouting:1|External Installation:8|Final Inspection:5"],
  ["Equipment Packages", "Fix", "Filter", "Material Handling:10|Chipping & Padding:8|Installation:60|Alignment / Leveling:8|Grouting:1|External Installation:8|Final Inspection:5"],
  ["Equipment Packages", "Fix", "Furnace Blower/ Heater", "Material Handling:0|Installation:70|Alignment / Leveling:7|Internal Accessories:5|Grouting:3|External Installation:10|Final Inspection:5"],
  ["Equipment Packages", "Fix", "Ejector", "Material Handling:10|Installation:75|Alignment / Leveling:10|Final Inspection:5"],
  ["Equipment Packages", "Machinery", "Gas Compressor/Turbine", "Material Handling:10|Chipping & Padding:5|Turbine/Generator Install:43|1st Alignment:15|Steel Structure/Platform:10|Duct/Accessory:4|2nd Align/Grouting/Coupling:3|Grouting:2|Final Inspection:8"],
  ["Equipment Packages", "Machinery", "Compressor", "Material Handling:10|Chipping & Padding:8|Installation:52|Alignment / Leveling:10|Grouting:4|Final Alignment / Piping:8|Final Inspection:8"],
  ["Equipment Packages", "Fix", "Mixer Agitator", "Material Handling:10|Installation:85|Final Inspection:5"],
  ["Equipment Packages", "Machinery", "Pump", "Material Handling:10|Chipping & Padding:8|Installation:52|1st Alignment:15|Grouting:5|2nd Alignment:5|Final Inspection:5"],
  /* تعارض دو برگه (۹۵ در برابر ۱۰۰) با تصمیم کاربر ۱۴۰۵/۰۷/۰۸ به نفع
   * برگهٔ کوچک‌تر حل شد: وزن‌ها ۵/۵/۶۰/۱۵/۵/۵/۵ (جمع ۱۰۰) از برگهٔ
   * کوچک‌تر، نام هر هفت گام از برگهٔ کامل (برچسب‌های برگهٔ کوچک‌تر
   * داده نشده). «Levelinng» همان املای برگهٔ کامل است؛ اگر در برگهٔ
   * کوچک‌تر «Leveling» است، با رؤیت اصلاح شود. وزن‌های پیشین برگهٔ
   * کامل: ۱۰/۸/۶۰/۵/۵/۲/۵ (جمع ۹۵). */
  ["Equipment Packages", "Package", "Package Equipment", "Material Handling:5|Chipping & Padding:5|Installation:60|Skid Alignment/Levelinng:15|Grouting:5|Accessory Install:5|Final Inspection:5"],
  ["Equipment Packages", "Machinery", "Overhead Crane", "Material Handling:8|Installing Rail Frame:37|Main Frame Fabrication:30|Crane Install:18|Load Test:2|Final Inspection:5"],
  ["Equipment Packages", "Fix", "Internals/Tray", "Material Handling:10|Install:85|Final Inspection:5"],
  ["Equipment Packages", "Machinery", "Air Cooler", "Material Handling:10|Structure Ground Assembly:15|Structure Installation:6|Tube Bundle Erection:20|Ground Assembly of Plenum:8|Plenum Chamber Installation:10|Motor Installation:4|Blade Installation:5|Pulley Installation:4|Ladder & Platform:4|Pully Adjustment:4|Shaft Alignment/Leveling:5|Final Inspection:5"],
  ["Equipment Packages", "Fix", "FF Tank", "Material Handling:0|Foundation Preparation:5|Installation & Welding of Bottom Plate:12|Installation & Welding of Annular Plate:3|Installation & Welding of Shell Plate:45|Installation & Welding of Roof Plate (Including Roof Support):15|Installation & Welding of Accessory:8|Hydro Test and Drainage & Cleaning out:7|Final Inspection:5"],
  ["Equipment Packages", "Fix", "Flare", "Material Handling:10|Tip Assembling:4|Derrick Installation:50|Pipe Service Installation:20|Align:6|Platform/Stair:5|Final Inspection:5"],

  /* ═══════════ HVAC ═══════════ */

  ["HVAC", "Equipment Installation", "Handling:10|INSTALLATION:70|Alignment:15|FINAL INSPECTION:5"],
  ["HVAC", "Ducting Work and Accessories", "Handling:5|Duct Fabrication:5|Duct Installation:15|Lighting Test:5|Duct Insulation:5|Blast Proof Valve:5|Air Terminal:15|Sand Trap Louver/Sound Attenuator:10|All Kind of Galv. Damper:5|Flexible Canvas Connection:15|Duct Lining:10|FINAL INSPECTION:5"],
  ["HVAC", "Piping Work", "Handling:5|Fit-Up:10|Support Installation:15|Spool Erection:10|Welding:30|Hydro Test:5|Valve Installation:5|Insulation:10|Cladding:5|FINAL INSPECTION:5"],
  ["HVAC", "Electrical Work", "Handling:5|Conduit Installation:15|Ladder Installation:35|Cabling:35|Termination:5|FINAL INSPECTION:5"],
  ["HVAC", "Control Work", "Handling:5|Conduit Installation:15|Tray Installation:15|Cabling:40|Termination:10|Control Device Installation:10|FINAL INSPECTION:5"],
  ["HVAC", "Plumbing Works", "Handling:5|Waste, Drain & Vent Piping and Test:30|Domestic Water Piping and Test:45|Plumbing Fixture Installation:15|FINAL INSPECTION:5"],
  ["HVAC", "Fire Fighting", "Handing:5|Piping:45|Fire Extinguishers installation:35|Hydro Test:10|FINAL INSPECTION:5"],

  /* ═══════════ Safety & Fire Fighting ═══════════ */

  ["Safety & Fire Fighting", "Local Equipment", "Handling&Prepration:10|Erection of Equipment & Piping:80|Final Adjustment&Operating Test:5|Final Inspection:5"],
  ["Safety & Fire Fighting", "Deluge Valve", "Installation:95|Final Check/Inspection:5"],
  ["Safety & Fire Fighting", "Co2 System", "Extinguisher Installation:45|Piping Joint:25|Flashing Light:4|Control Panel(Local Panel):14|Cabling & Termination:7|Final Inspection:5"],

  /* ═══════════ Painting ═══════════ */

  ["Painting", "Structure", "Punch Clear:95|Final Inspection:5"],
  ["Painting", "Piping", "Blast & Primer:30|Intermediate Coat:35|Finish Coating:25|Touch-up,Punch Clear & Finish:5|Final Inspection:5"],
  ["Painting", "Support", "Blast & Primer:30|Intermediate Coat:35|Finish Coating:30|Final Inspection:5"],
  ["Painting", "Tank", "Blast & Primer:30|Intermediate Coat:35|Finish Coating:25|Touch-up,Punch Clear & Finish:5|Final Inspection:5"],
  ["Painting", "Fire proofing Structure", "Preparation & Wire Mesh:40|Gunite:50|Punch Clear:5|Final Inspection:5"],
  ["Painting", "Fire proofing Equipment", "Preparation & Wire Mesh:40|Gunite:50|Punch Clear:5|Final Inspection:5"],

  /* ═══════════ Insulation ═══════════ */

  ["Insulation", "Piping Cold", INS_STD],
  ["Insulation", "Piping Hot", INS_STD],
  ["Insulation", "Equipment Cold", INS_STD],
  ["Insulation", "Equipment Hot", INS_STD],
  ["Insulation", "Valve Cold", INS_STD],
  ["Insulation", "Valve Hot", INS_STD],

  /* ═══════════ Electrical ═══════════ */

  ["Electrical", "Lighting work", "Handling:5|LIGHTING POLE/Support INSTALLATION:15|LIGHTING FIXTURE INSTALLATION:10|JUNCTION BOX INSTALLATION:15|Cable Laying:25|Cable Gland:10|Termination:10|Test:5|FINAL INSPECTION:5"],
  ["Electrical", "Main Lighting Work (Street lighting work)", "Handling:5|LIGHTING POLE/Support and Fuse Box Installation:10|LIGHTING FIXTURE INSTALLATION:15|JUNCTION BOX INSTALLATION:20|Cable Laying:20|Cable Gland:15|Termination:5|Test:5|FINAL INSPECTION:5"],
  ["Electrical", "Grounding work", GROUNDING],
  ["Electrical", "Cathodic protection For Drums and Tanks", CATHODIC],
  ["Electrical", "Piping U/G Cathodic protection", CATHODIC],
  ["Electrical", "Cable tray and Ladder Installaion", "Handling:5|SUPPORT FABRICATION:35|SUPPORT INSTALLATION:20|TRAY / LADDER INSTALLATION:35|FINAL  INSPECTION:5"],
  ["Electrical", "Conduit Installation", "Handling:5|SUPPORT FABRICATION:20|SUPPORT INSTALLATION:25|CONDUIT INSTALLATION:45|FINAL  INSPECTION:5"],
  ["Electrical", "Equipment installation", "Handling:5|INSTALLATION:65|Fixing&Bonding:20|Test:5|Final Inspection:5"],
  ["Electrical", "Cabling & Termination", "Handling:5|CABLE PULLING:65|GLAND:10|TERMINATION and JOINT:10|Megger/ HV TEST:5|FINAL  INSPECTION:5"],

  /* ═══════════ Instrumentation ═══════════ */

  ["Instrumentation", "Cable tray and Ladder Installaion", "Handling:5|SUPPORT FABRICATION:20|SUPPORT INSTALLATION:30|TRAY / LADDER INSTALLATION:40|FINAL  INSPECTION:5"],
  ["Instrumentation", "Junction Box", "Handling:5|SUPPORT FABRICATION and Installation:20|Setting/Installation:70|Final Inspection:5"],
  ["Instrumentation", "Instrument Cabling", "Handling:5|CABLE PULLING:55|Cable Arrangment:5|Cable Tagging:5|GLAND:5|TERMINATION:15|cable test:5|Final Inspection:5"],
  ["Instrumentation", "Instrumentation (Devices Install)", "Handling:5|Calibration:40|Support and Stand:10|Installation:25|Sunshade:5|Loop Check:10|Final Inspection:5"],
  ["Instrumentation", "Grounding Work", GROUNDING],
  ["Instrumentation", "Piping & Tubing", "Handling:5|Support Installation:15|Piping/Tubing:45|Valve & Accessories Installation:15|Leak Test:15|Final Inspection:5"],
  ["Instrumentation", "Equipment Install(DCS/PLC/F&G/LOCAL PANNEL/ANALYSER/DB)", "Handling:10|Support Fabrication & Painting:20|Support Installation:15|Panel Installation:50|FINAL  INSPECTION:5"],
  ["Instrumentation", "Fire Alarm system (F&G DEVISES)", "Handling:5|Support Installation:15|Equipment Installation:20|Conduit And Tray Installation:15|Cable Laying:15|Cable Gland:10|Termination:10|Test:5|Final Inspection:5"],

  /* ═══════════ Telecommunication ═══════════ */

  ["Telecommunication", "Telecommunication Cable Tray and Ladder", "Handling:5|Support Fabrication:30|Support Installation:30|Installation Ladder/Tray:30|Final Inspection:5"],
  ["Telecommunication", "Indoor Equipment", TEL_EQUIP],
  ["Telecommunication", "Outdoor Equipment", TEL_EQUIP],
  ["Telecommunication", "Boxes/Sockets/telephones (Indoor)", TEL_EQUIP],
  ["Telecommunication", "Telecommunication Cabling/Glanding/Termination", "Handling:5|Cable Laying:60|Gland/Termination:25|Test:5|Final Inspection:5"],
  ["Telecommunication", "Telecommunication Tower", "Handling:35|Assembling and Installation:60|Final Inspection:5"],

  /* ═══════════ Industrial Building and Architectural ═══════════
   * ستون گروه‌بندی برگه: Building Type */

  ["Industrial Building and Architectural", "Substation/ITR", "CONCRETE STRUCTURE", BLD_CONCRETE],
  ["Industrial Building and Architectural", "Substation/ITR", "Floor/Roof", "Rebar:10|Form Work:20|Concrete Pouring:25|Roof Insulation:20|Roof Tiling:20|Final Certificate:5"],
  ["Industrial Building and Architectural", "Substation/ITR", "Interior/Architecture", "Suspended Roof:10|Blocking:50|Plaster & Stucco:15|Painting:10|Roof Interior Works:10|Final Certificate:5"],
  ["Industrial Building and Architectural", "Substation/ITR", "Exterior", "Doors & Windows Installation:60|Plaster & Stucco:25|Painting:10|Final Certificate:5"],
  ["Industrial Building and Architectural", "Substation/ITR", "ELECTRICAL WORK", BLD_ELEC_TRAY],

  ["Industrial Building and Architectural", "Control Room", "CONCRETE STRUCTURE", BLD_CONCRETE],
  ["Industrial Building and Architectural", "Control Room", "Floor/Roof", "Rebar:10|Form Work:20|Concrete Pouring:25|Roof Insulation:20|Roof Tiling:20|Final Certificate:5"],
  ["Industrial Building and Architectural", "Control Room", "Interior/Architecture", "Suspended Roof:10|Blocking:50|Plaster & Stucco:15|Painting:10|Roof Interior Works:10|Final Certificate:5"],
  ["Industrial Building and Architectural", "Control Room", "Exterior", "Doors & Windows Installation:60|Plaster & Stucco:25|Painting:10|Final Certificate:5"],
  ["Industrial Building and Architectural", "Control Room", "ELECTRICAL WORK", BLD_ELEC_TRAY],

  ["Industrial Building and Architectural", "Laboratory", "CONCRETE STRUCTURE", BLD_CONCRETE],
  ["Industrial Building and Architectural", "Laboratory", "MECHANICAL WORK (EXCL. HVAC)", BLD_MECH_FULL],
  ["Industrial Building and Architectural", "Laboratory", "ELECTRICAL WORK", BLD_ELEC_23],
  ["Industrial Building and Architectural", "Laboratory", "Architectural", BLD_ARCH],

  ["Industrial Building and Architectural", "Telecom Building", "CONCRETE STRUCTURE", BLD_CONCRETE],
  ["Industrial Building and Architectural", "Telecom Building", "MECHANICAL WORK (EXCL. HVAC)", BLD_MECH_FULL],
  ["Industrial Building and Architectural", "Telecom Building", "ELECTRICAL WORK", BLD_ELEC_15],
  ["Industrial Building and Architectural", "Telecom Building", "Architectural", BLD_ARCH],

  ["Industrial Building and Architectural", "Buildings With Steel Structure:", "CONCRETE STRUCTURE", "Excavation:5|Lean Conc.:3|Rebar:20|Formwork:20|Embedded Item:10|Concrete Pouring (M3):32|Curing:5|Backfill & Compaction:5"],
  ["Industrial Building and Architectural", "Buildings With Steel Structure:", "STEEL STRUCTURE", "Prefabrication:45|Installation:35|Alignment:10|Bolting:10"],
  ["Industrial Building and Architectural", "Buildings With Steel Structure:", "MECHANICAL WORK (EXCL. HVAC)", BLD_MECH_FULL],
  ["Industrial Building and Architectural", "Buildings With Steel Structure:", "ELECTRICAL WORK", BLD_ELEC_15],
  ["Industrial Building and Architectural", "Buildings With Steel Structure:", "Architectural", BLD_ARCH],

  /* ═══════════ Non-Industrial Building and Architectural ═══════════
   * ستون گروه‌بندی برگه: Building Type */

  ["Non-Industrial Building and Architectural", "Gate House", "CONCRETE STRUCTURE", BLD_CONCRETE],
  ["Non-Industrial Building and Architectural", "Gate House", "MECHANICAL WORK (EXCL. HVAC)", "Handling:5|HVAC Equipment:25|HVAC Ducting Work:60|Plumbing Works:5|Final Inspection:5"],
  ["Non-Industrial Building and Architectural", "Gate House", "ELECTRICAL WORK", BLD_ELEC_TRAY],
  ["Non-Industrial Building and Architectural", "Gate House", "Architectural", BLD_ARCH],

  ["Non-Industrial Building and Architectural", "Fire Fighting Building / Clinic", "CONCRETE STRUCTURE", BLD_CONCRETE],
  ["Non-Industrial Building and Architectural", "Fire Fighting Building / Clinic", "MECHANICAL WORK (EXCL. HVAC)", "Handling:5|HVAC Equipment:25|HVAC Ducting Work:35|HVAC Piping Work:20|Fire Fighting:6|Plumbing Works:4|Final Inspection:5"],
  ["Non-Industrial Building and Architectural", "Fire Fighting Building / Clinic", "ELECTRICAL WORK", BLD_ELEC_TRAY],
  ["Non-Industrial Building and Architectural", "Fire Fighting Building / Clinic", "Architectural", BLD_ARCH],

  ["Non-Industrial Building and Architectural", "Site Toilets 8 Nos", "CONCRETE STRUCTURE", BLD_CONCRETE],
  ["Non-Industrial Building and Architectural", "Site Toilets 8 Nos", "MECHANICAL WORK (EXCL. HVAC)", "Handling:5|HVAC Equipment:20|HVAC Ducting Work:60|Plumbing Works:10|Final Inspection:5"],
  ["Non-Industrial Building and Architectural", "Site Toilets 8 Nos", "ELECTRICAL WORK", "Tray Installation:13|Conduit Installation:13|Cabling and Wiring:38|Ltg Fixture, Detector, etc Install:21|Distribution Panel:8|Support:5|Final Inspection:2"],
  ["Non-Industrial Building and Architectural", "Site Toilets 8 Nos", "Architectural", BLD_ARCH],

  ["Non-Industrial Building and Architectural", "Administration Building", "CONCRETE STRUCTURE", BLD_CONCRETE],
  ["Non-Industrial Building and Architectural", "Administration Building", "MECHANICAL WORK (EXCL. HVAC)", BLD_MECH_FULL],
  ["Non-Industrial Building and Architectural", "Administration Building", "ELECTRICAL WORK", BLD_ELEC_23],
  ["Non-Industrial Building and Architectural", "Administration Building", "Architectural", BLD_ARCH],

  ["Non-Industrial Building and Architectural", "Canteen", "CONCRETE STRUCTURE", BLD_CONCRETE],
  ["Non-Industrial Building and Architectural", "Canteen", "MECHANICAL WORK (EXCL. HVAC)", BLD_MECH_FULL],
  ["Non-Industrial Building and Architectural", "Canteen", "ELECTRICAL WORK", BLD_ELEC_23],
  ["Non-Industrial Building and Architectural", "Canteen", "Architectural", BLD_ARCH],

  ["Non-Industrial Building and Architectural", "Security Building", "CONCRETE STRUCTURE", BLD_CONCRETE],
  ["Non-Industrial Building and Architectural", "Security Building", "MECHANICAL WORK (EXCL. HVAC)", BLD_MECH_FULL],
  ["Non-Industrial Building and Architectural", "Security Building", "ELECTRICAL WORK", BLD_ELEC_23],
  ["Non-Industrial Building and Architectural", "Security Building", "Architectural", BLD_ARCH],
];

export const petrochemicalWorkStages = buildWorkStages(rows);
