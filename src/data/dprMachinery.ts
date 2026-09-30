/** فهرست ثابت ماشین‌آلات گزارش روزانه (Machinery) — طبق عکس اکسل کاربر.
 *
 * ── منشأ ────────────────────────────────────────────────────────────
 * رونویسی از عکس شیت Machinery (ستون Machinery). ترتیب ردیف‌ها عین عکس
 * است؛ کدها (MC-001…) صرفاً کلید فنی‌اند و در عکس نیستند. املای عکس
 * عیناً حفظ شده («Macking»، «Theodolit»)؛ فقط فاصله‌گذاری داخل پرانتزها
 * و ردیف‌های تناژ جرثقیل (`100<Crane<250 Ton` ← ‏`Crane 100 - 250 Ton`)
 * یکدست شد تا با ردیف‌های خواهر هم‌قالب باشد.
 *
 * ── گروه‌ها ──────────────────────────────────────────────────────────
 * ستون گروه در عکس نیست؛ گروه‌بندی فقط برای نمایش تاشو در رابط کاربری
 * از روی چینش عکس استخراج شده و جنبهٔ نمایشی دارد.
 *
 * ── موارد نیازمند کنترل با اکسل ──────────────────────────────────────
 * چند عنوان در عکس ناخوانا بود و با پرچم `note` مشخص شده‌اند. اگر در
 * اکسل چیز دیگری است، همین فایل در یک پاس اصلاح می‌شود — کدها ثابت
 * می‌مانند.
 */

export interface DprMachineryRow {
  code: string;
  title: string;
  group: string;
  /** یادداشت رونویسی؛ فقط برای موارد نامطمئن عکس پر می‌شود. */
  note?: string;
}

export const DPR_MACHINERY_GROUPS: Record<string, { fa: string; en: string }> = {
  earth: { fa: "راهسازی و خاکی", en: "Earthmoving" },
  concrete: { fa: "بتن", en: "Concrete" },
  utility: { fa: "آتش‌نشانی و تانکر", en: "Utility" },
  batching: { fa: "بچینگ و سیلو", en: "Batching" },
  rebar: { fa: "آرماتور و برش", en: "Rebar & Cutting" },
  haul: { fa: "بارکش و تراکتور", en: "Hauling" },
  lifting: { fa: "بالابر و جرثقیل", en: "Lifting" },
  power: { fa: "برق و هوای فشرده", en: "Power & Air" },
  blast: { fa: "سندبلاست و رنگ", en: "Blasting & Paint" },
  weld: { fa: "جوش", en: "Welding" },
  tanks: { fa: "مخازن و متفرقه", en: "Tanks & Misc" },
  survey: { fa: "نقشه‌برداری", en: "Survey" },
  test: { fa: "تست و بازرسی", en: "Testing" },
  saw: { fa: "برش و خم", en: "Saw & Bend" },
  oven: { fa: "کوره و جک", en: "Oven & Jacks" },
  drill: { fa: "حفاری و بالابر کارگاهی", en: "Drilling & Hoist" },
  vehicles: { fa: "خودرو", en: "Vehicles" },
  office: { fa: "اداری", en: "Office" },
  tools: { fa: "ابزار", en: "Tools" },
};

const rows: Array<[title: string, group: string, note?: string]> = [
  /* ── Earthmoving (11) ── */
  ["Bulldozer", "earth"],
  ["Loader", "earth"],
  ["Excavator", "earth"],
  ["Grader", "earth"],
  ["Hammer excavator", "earth"],
  ["Picher / Jack Hammer", "earth", "عین عکس؛ خوانش نامطمئن"],
  ["Bitumen Spreader", "earth"],
  ["Asphalt Finishing Machine", "earth"],
  ["Compact Roller / Vibrating Roller", "earth", "خوانش از عکس نامطمئن"],
  ["Compactor (small)", "earth"],
  ["Screening set", "earth"],
  /* ── Concrete (6) ── */
  ["Batching Plant", "concrete", "دو بار در عکس آمده؛ با اکسل کنترل شود"],
  ["Concrete Laboratory", "concrete"],
  ["Concrete / Truck Mixer", "concrete"],
  ["Concrete Pump", "concrete"],
  ["Concrete Vibrator", "concrete"],
  ["Concrete Block Macking Machine", "concrete", "عین عکس (Macking)"],
  /* ── Utility (4) ── */
  ["Fire Fighting Truck", "utility"],
  ["Fire Fighting Sprinter", "utility"],
  ["Water Tank Lorry", "utility"],
  ["Fuel Tank Lorry", "utility"],
  /* ── Batching (3) ── */
  ["Silo Plant", "batching", "خوانش از عکس نامطمئن؛ با اکسل کنترل شود"],
  ["Batching Plant", "batching", "تکرار دوم در عکس؛ با اکسل کنترل شود"],
  ["Cement Silo", "batching"],
  ["Truck Mixer", "batching"],
  ["Vibrator", "batching"],
  ["Truck Spray Bar", "batching", "خوانش از عکس نامطمئن"],
  /* ── Rebar & cutting (4) ── */
  ["Rebar Cutting", "rebar"],
  ["Bar Bending", "rebar"],
  ["Grinding Machine", "rebar"],
  ["Tractor/Loader Tractor", "rebar", "خوانش از عکس نامطمئن"],
  /* ── Hauling (11) ── */
  ["Dumper", "haul"],
  ["Dump Truck < 10 Ton", "haul"],
  ["Dump Truck > 10 Ton", "haul"],
  ["Hand mixing concrete", "haul", "عین عکس؛ خوانش نامطمئن"],
  ["Tractor", "haul"],
  ["Empty truck", "haul", "عین عکس؛ خوانش نامطمئن"],
  ["Truck", "haul"],
  ["Trailer", "haul"],
  ["Weigh Scale", "haul", "خوانش از عکس نامطمئن"],
  ["Water Tanker", "haul"],
  ["Fuel Tanker", "haul"],
  /* ── Lifting (15) ── */
  ["Boom Truck < 5 Ton", "lifting"],
  ["Boom Truck > 5 Ton", "lifting"],
  ["Crane < 10 Ton", "lifting"],
  ["Crane 11 - 20 Ton", "lifting"],
  ["Crane 21 - 30 Ton", "lifting"],
  ["Crane 31 - 40 Ton", "lifting"],
  ["Crane 41 - 50 Ton", "lifting"],
  ["Crane 51 - 70 Ton", "lifting"],
  ["Crane 71 - 100 Ton", "lifting"],
  ["Crane 100 - 250 Ton", "lifting"],
  ["Crane 250 - 500 Ton", "lifting"],
  ["Crawler Crane", "lifting"],
  ["Lift Truck < 5 Ton", "lifting"],
  ["Lift Truck (6 - 10 Ton)", "lifting"],
  ["Lift Truck > 10 Ton", "lifting"],
  /* ── Power & air (9) ── */
  ["Power Generator < 100 KVA", "power"],
  ["Power Generator 150 - 300 KVA", "power", "در عکس 150-300 خوانده شد؛ احتمالاً 100-300؛ با اکسل کنترل شود"],
  ["Power Generator 301 - 500 KVA", "power", "خوانش از عکس نامطمئن"],
  ["Power Generator > 500 KVA", "power"],
  ["Lighting Tower", "power"],
  ["Air Compressor < 200 cfm", "power"],
  ["Air Compressor 201 - 500 cfm", "power"],
  ["Air Compressor 501 - 700 cfm", "power"],
  ["Air Compressor > 700 cfm", "power"],
  /* ── Blasting & paint (5) ── */
  ["Shot blast Machine", "blast", "عین عکس"],
  ["Sandblast Machine", "blast"],
  ["Paint-Spray Machine", "blast", "خوانش از عکس نامطمئن"],
  ["Hydro-Test Pump", "blast"],
  ["Water Jet", "blast"],
  /* ── Welding (7) ── */
  ["Welding Machine (Rectifier)", "weld"],
  ["Welding Machine (Transformer)", "weld"],
  ["Welding Machine (Diesel Engine)", "weld"],
  ["Auto Welding Machine", "weld"],
  ["Turning Positioner", "weld", "خوانش از عکس نامطمئن"],
  ["PWHT Machine (stress relieving)", "weld", "خوانش از عکس نامطمئن"],
  ["X-Ray M/C", "weld", "در عکس دو ردیف X-Ray هست (M/C و Machine)؛ با اکسل کنترل شود"],
  /* ── Tanks & misc (7) ── */
  ["Buggy Mixer", "tanks", "خوانش از عکس نامطمئن"],
  ["Water Tank", "tanks"],
  ["Diesel Tank", "tanks"],
  ["Electric Engine (5KW)", "tanks", "خوانش از عکس نامطمئن"],
  ["Lifting Fixture", "tanks", "خوانش از عکس نامطمئن"],
  ["Lighting Projector", "tanks", "خوانش از عکس نامطمئن"],
  ["Air cutting", "tanks", "خوانش از عکس نامطمئن"],
  ["Sewage pumps", "tanks"],
  /* ── Survey (5) ── */
  ["Survey Camera - Nivo", "survey", "خوانش از عکس نامطمئن"],
  ["Survey Camera - Total", "survey", "خوانش از عکس نامطمئن"],
  ["Survey Camera - Theodolit", "survey", "عین عکس (Theodolit)"],
  ["GPS", "survey"],
  ["Topography Camera", "survey", "خوانش از عکس نامطمئن"],
  ["Surveying Instrument", "survey", "خوانش از عکس نامطمئن"],
  /* ── Testing (7) ── */
  ["Welding Trans", "test", "عین عکس؛ احتمال بریدگی کلمه؛ با اکسل کنترل شود"],
  ["Rectifier", "test"],
  ["Stress Relief Machine (PWHT Eq)", "test"],
  ["X-Ray Machine", "test", "ردیف دوم X-Ray؛ با اکسل کنترل شود"],
  ["Ultrasonic Equipment", "test"],
  ["Holiday Test Detector (Black Lig)", "test", "عین عکس؛ احتمال بریدگی کلمه"],
  ["Vacuum Box Tester", "test"],
  /* ── Saw & bend (12) ── */
  ["Saw Machine", "saw", "خوانش از عکس نامطمئن"],
  ["Gouge", "saw", "خوانش از عکس نامطمئن"],
  ["Junction Box", "saw", "خوانش از عکس نامطمئن"],
  ["Auto Cutting Machine (CNC)", "saw", "خوانش از عکس نامطمئن"],
  ["Cutting Machine / Bevel Machine", "saw", "خوانش از عکس نامطمئن"],
  ["Plasma Cutting Machine", "saw"],
  ["Saw Machine - Circular", "saw", "خوانش از عکس نامطمئن"],
  ["Guillotine", "saw", "خوانش از عکس نامطمئن"],
  ["Saw Machine - Band", "saw", "خوانش از عکس نامطمئن"],
  ["Bending Machine - Bar", "saw", "خوانش از عکس نامطمئن"],
  ["Bending Machine - Pipe", "saw", "خوانش از عکس نامطمئن"],
  ["Rolling Machine", "saw", "خوانش از عکس نامطمئن"],
  ["Threading Machine", "saw", "خوانش از عکس نامطمئن"],
  ["Grinder", "saw"],
  ["Punch / Press", "saw", "خوانش از عکس نامطمئن"],
  /* ── Oven & jacks (6) ── */
  ["Drying Oven (165 - 350 kg)", "oven", "خوانش از عکس نامطمئن"],
  ["Drying Oven (5 - 45 kg)", "oven", "خوانش از عکس نامطمئن"],
  ["Oven (10KG)", "oven", "خوانش از عکس نامطمئن"],
  ["Jack - Horizontal", "oven", "خوانش از عکس نامطمئن"],
  ["Jack - Vertical", "oven", "خوانش از عکس نامطمئن"],
  /* ── Drilling & hoist (5) ── */
  ["Drilling Machine", "drill"],
  ["Drill Wagon", "drill", "خوانش از عکس نامطمئن"],
  ["Elevator", "drill", "خوانش از عکس نامطمئن"],
  ["Electric Winch", "drill", "خوانش از عکس نامطمئن"],
  ["Electric Hammer", "drill", "خوانش از عکس نامطمئن"],
  /* ── Vehicles (7) ── */
  ["Bus", "vehicles"],
  ["Mini-Bus", "vehicles"],
  ["Pick Up", "vehicles"],
  ["Light Vehicle (2Wd & 4Wd)", "vehicles"],
  ["Ambulance", "vehicles"],
  ["Motor Cycle", "vehicles"],
  /* ── Office (5) ── */
  ["Container / Conex", "office"],
  ["Computer", "office"],
  ["Printer", "office"],
  ["Copy Machine", "office"],
  ["Fax Machine", "office"],
  ["Scanner", "office", "خوانش از عکس نامطمئن"],
  /* ── Tools (7) ── */
  ["Oxygen - Acetylene Cutter", "tools"],
  ["Angle Grinder", "tools", "خوانش از عکس نامطمئن"],
  ["Electrode Dry Oven", "tools", "خوانش از عکس نامطمئن"],
  ["Electrode Portable Oven", "tools", "خوانش از عکس نامطمئن"],
  ["Jimplock", "tools", "عین عکس؛ خوانش بسیار نامطمئن؛ حتماً با اکسل کنترل شود"],
  ["Grinding Stone", "tools", "خوانش از عکس نامطمئن"],
  ["Mini & finger milling stone", "tools", "عین عکس؛ خوانش نامطمئن"],
];

export const DPR_MACHINERY: DprMachineryRow[] = rows.map(([title, group, note], i) => ({
  code: `MC-${String(i + 1).padStart(3, "0")}`,
  title,
  group,
  ...(note ? { note } : {}),
}));
