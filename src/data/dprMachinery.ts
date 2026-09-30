/** فهرست ثابت ماشین‌آلات گزارش روزانه (Machinery) — طبق عکس اکسل کاربر.
 *
 * ── منشأ ────────────────────────────────────────────────────────────
 * رونویسی از عکس‌های شیت Machinery (ستون Machinery). ترتیب ردیف‌ها عین
 * عکس است؛ کدها (MC-001…) صرفاً کلید فنی‌اند و در عکس نیستند.
 *
 * املا و فاصله‌گذاری عین عکس حفظ شده، حتی موارد نامتعارف:
 * «Macking»، «Theodolit»، «Jimplock»، «Pichor / Jack Hammer»،
 * «Silevv Plant»، «100<Crane< 250 Ton»، «Electric Engine(5KW)»،
 * «Auto Cutting Machine ( CNC)»، «Mini &finger milling stone».
 * در شیت، «Batching Plant» دو بار و «X-Ray» در دو ردیف (M/C و Machine)
 * آمده است — هر دو عیناً نگه داشته شدند.
 *
 * ── گروه‌ها ──────────────────────────────────────────────────────────
 * ستون گروه در عکس نیست؛ گروه‌بندی فقط برای نمایش تاشو در رابط کاربری
 * از روی چینش عکس استخراج شده و جنبهٔ نمایشی دارد.
 *
 * ── وضعیت شمارش ─────────────────────────────────────────────────────
 * این رونویسی ۱۴۲ عنوان است؛ کاربر گفته ۱۴۴ ردیف. دو عنوان در عکس‌ها
 * خوانده نشد و عمداً با حدس پر نشده — پس از اعلام، همین‌جا درج می‌شود.
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
  ["Pichor / Jack Hammer", "earth", "عین عکس"],
  ["Bitumen Spreader", "earth"],
  ["Asphalt Finishing Machine", "earth"],
  ["Compact Roller / Vibrating Roller", "earth"],
  ["Compactor (small)", "earth"],
  ["Screening set", "earth"],
  /* ── Concrete (6) ── */
  ["Batching Plant", "concrete", "در شیت دو بار آمده (ردیف ۱۲ و ۲۳)"],
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
  /* ── Batching (5) ── */
  ["Silevv Plant", "batching", "عین عکس؛ با اکسل کنترل شود"],
  ["Batching Plant", "batching", "تکرار دوم در شیت"],
  ["Truck Mixer", "batching"],
  ["Vibrator", "batching"],
  ["Truck Spray Bar", "batching"],
  /* ── Rebar & cutting (4) ── */
  ["Rebar Cutting", "rebar"],
  ["Bar Bending", "rebar"],
  ["Grinding Machine", "rebar"],
  ["Tractor/Loader Tractor", "rebar"],
  /* ── Hauling (11) ── */
  ["Dumper", "haul"],
  ["Dump Truck < 10 Ton", "haul"],
  ["Dump Truck > 10 Ton", "haul"],
  ["Hand mixing concrete", "haul", "عین عکس"],
  ["Tractor", "haul"],
  ["Empty truck", "haul", "عین عکس"],
  ["Truck", "haul"],
  ["Trailer", "haul"],
  ["Weigh Scale", "haul"],
  ["Water Tanker", "haul"],
  ["Fuel Tanker", "haul"],
  /* ── Lifting (15) ── */
  ["Boom Truck < 5 Ton", "lifting"],
  ["Boom Truck > 5 Ton", "lifting"],
  ["Crane < 10 Ton", "lifting"],
  ["Crane 11-20 Ton", "lifting"],
  ["Crane 21-30 Ton", "lifting"],
  ["Crane 31-40 Ton", "lifting"],
  ["Crane 41-50 Ton", "lifting"],
  ["Crane 51-70 Ton", "lifting"],
  ["Crane 71-100 Ton", "lifting"],
  ["100<Crane< 250 Ton", "lifting"],
  ["250<Crane< 500 Ton", "lifting"],
  ["Crawler Crane", "lifting"],
  ["Lift Truck < 5 Ton", "lifting"],
  ["Lift Truck (6 - 10 Ton)", "lifting", "فاصله‌گذاری داخل پرانتز با اکسل کنترل شود"],
  ["Lift Truck > 10 Ton", "lifting"],
  /* ── Power & air (9) ── */
  ["Power Generator < 100 KVA", "power"],
  ["Power Generator 150-300 KVA", "power"],
  ["Power Generator 301-500 KVA", "power"],
  ["Power Generator > 500 KVA", "power"],
  ["Lighting Tower", "power"],
  ["Air Compressor < 200 cfm", "power"],
  ["Air Compressor 201-500 cfm", "power"],
  ["Air Compressor 501-700 cfm", "power"],
  ["Air Compressor > 700 cfm", "power"],
  /* ── Blasting & paint (5) ── */
  ["Shot blast Machine", "blast", "عین عکس"],
  ["Sandblast Machine", "blast"],
  ["Paint-Spray Machine", "blast"],
  ["Hydro-Test Pump", "blast"],
  ["Water Jet", "blast"],
  /* ── Welding (7) ── */
  ["Welding Machine (Rectifier)", "weld"],
  ["Welding Machine (Transformer)", "weld"],
  ["Welding Machine (Diesel Engine)", "weld"],
  ["Auto Welding Machine", "weld"],
  ["Turning Positioner", "weld"],
  ["PWHT Machine (stress relieving)", "weld"],
  ["X-Ray M/C", "weld", "در شیت دو ردیف X-Ray هست (M/C و Machine)"],
  /* ── Tanks & misc (8) ── */
  ["Buggy Mixer", "tanks"],
  ["Water Tank", "tanks"],
  ["Diesel Tank", "tanks"],
  ["Electric Engine(5KW)", "tanks"],
  ["Lifting Fixture", "tanks"],
  ["Lighting Projector", "tanks"],
  ["Air cutting", "tanks"],
  ["Sewage pumps", "tanks"],
  /* ── Survey (6) ── */
  ["Survey Camera - Nivo", "survey"],
  ["Survey Camera - Total", "survey"],
  ["Survey Camera - Theodolit", "survey", "عین عکس (Theodolit)"],
  ["GPS", "survey"],
  ["Topography Camera", "survey"],
  ["Surveying Instrument", "survey"],
  /* ── Testing (7) ── */
  ["Welding Trans", "test", "عین عکس؛ احتمال بریدگی کلمه"],
  ["Rectifier", "test"],
  ["Stress Relief Machine(PWHT Eq)", "test"],
  ["X-Ray Machine", "test"],
  ["Ultrasonic Equipment", "test"],
  ["Holiday Test Detector(Black Lig)", "test", "عین عکس؛ احتمال بریدگی کلمه"],
  ["Vacuum Box Tester", "test"],
  /* ── Saw & bend (15) ── */
  ["Saw Machine", "saw"],
  ["Gouge", "saw"],
  ["Junction Box", "saw"],
  ["Auto Cutting Machine ( CNC)", "saw"],
  ["Plasma Cutting Machine", "saw"],
  ["Cutting Machine / Bevel Machine", "saw"],
  ["Saw Machine - Circular", "saw"],
  ["Guillotine", "saw"],
  ["Saw Machine - Band", "saw"],
  ["Bending Machine - Bar", "saw"],
  ["Bending Machine - Pipe", "saw"],
  ["Rolling Machine", "saw"],
  ["Threading Machine", "saw"],
  ["Grinder", "saw"],
  ["Punch / Press", "saw"],
  /* ── Oven & jacks (5) ── */
  ["Drying Oven (165-350 kg)", "oven"],
  ["Drying Oven ( 5-45 kg)", "oven"],
  ["Oven ( 10KG)", "oven"],
  ["Jack - Horizontal", "oven"],
  ["Jack - Vertical", "oven"],
  /* ── Drilling & hoist (5) ── */
  ["Drilling Machine", "drill"],
  ["Drill Wagon", "drill"],
  ["Elevator", "drill"],
  ["Electric Winch", "drill"],
  ["Electric Hammer", "drill"],
  /* ── Vehicles (6) ── */
  ["Bus", "vehicles"],
  ["Mini-Bus", "vehicles"],
  ["Pick Up", "vehicles"],
  ["Light Vehicle ( 2Wd & 4Wd )", "vehicles"],
  ["Ambulance", "vehicles"],
  ["Motor Cycle", "vehicles"],
  /* ── Office (5) ── */
  ["Container / Conex", "office"],
  ["Computer", "office"],
  ["Printer", "office"],
  ["Copy Machine", "office"],
  ["Fax Machine", "office"],
  /* ── Tools (8) ── */
  ["Oxygen - Acetylene Cutter", "tools"],
  ["Angle Grinder", "tools"],
  ["Electrode Dry Oven", "tools"],
  ["Electrode Portable Oven", "tools"],
  ["Jimplock", "tools", "عین عکس"],
  ["Grinding Stone", "tools"],
  ["Scanner", "tools"],
  ["Mini &finger milling stone", "tools", "عین عکس"],
];

export const DPR_MACHINERY: DprMachineryRow[] = rows.map(([title, group, note], i) => ({
  code: `MC-${String(i + 1).padStart(3, "0")}`,
  title,
  group,
  ...(note ? { note } : {}),
}));
