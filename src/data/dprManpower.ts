/** فهرست ثابت مشاغل گزارش روزانه (Manpower) — ۱۶۰ ردیف مطابق شیت رسمی نیروی انسانی (۸۸ مستقیم + ۷۲ غیرمستقیم). */

export type DprManpowerKind = "direct" | "indirect";

export interface DprManpowerRow {
  code: string;
  title: string;
  kind: DprManpowerKind;
  group: string;
  /** یادداشت رونویسی؛ فقط برای موارد نامطمئن عکس پر می‌شود. */
  note?: string;
}

export const DPR_MANPOWER_GROUPS: Record<string, { fa: string; en: string }> = {
  "direct-management": { fa: "مدیریت اجرا (Management)", en: "Management (Direct)" },
  civil: { fa: "ابنیه و سیویل (Civil & Building)", en: "Civil & Building" },
  structure: { fa: "سازه فلزی (Steel Structure)", en: "Steel Structure" },
  piping: { fa: "پایپینگ (Piping)", en: "Piping" },
  electrical: { fa: "برق و ابزار دقیق (Electrical & Instrumentation)", en: "Electrical & Instrumentation" },
  equipment: { fa: "تجهیزات و مخازن (Equipment & Tanks)", en: "Equipment & Tanks" },
  paint: { fa: "رنگ و عایق (Paint & Insulation)", en: "Paint & Insulation" },
  general: { fa: "عمومی (General)", en: "General" },
  management: { fa: "مدیریت (Management)", en: "Management" },
  construction: { fa: "اجرا (Construction)", en: "Construction" },
  "tech-office": { fa: "دفتر فنی (Technical Office)", en: "Technical Office" },
  planning: { fa: "برنامه‌ریزی و کنترل پروژه (Planning & Project Control)", en: "Planning & Project Control" },
  it: { fa: "فناوری اطلاعات و ارتباطات (IT & Communication)", en: "IT & Communication" },
  qc: { fa: "تضمین و کنترل کیفیت (QA / QC)", en: "QA / QC" },
  hse: { fa: "ایمنی و بهداشت (HSE)", en: "HSE" },
  material: { fa: "کنترل متریال (Material Control)", en: "Material Control" },
  finance: { fa: "مالی، هزینه و قراردادها (Finance / Cost / Contracts)", en: "Finance / Cost / Contracts" },
  survey: { fa: "نقشه‌برداری (Survey)", en: "Survey" },
  facility: { fa: "تأسیسات و تعمیرات (Facility / Maintenance)", en: "Facility / Maintenance" },
  security: { fa: "حراست (Security)", en: "Security" },
  logistics: { fa: "لجستیک و خدمات (Logistics)", en: "Logistics" },
};

const D = "direct" as const;
const I = "indirect" as const;

const rows: Array<[title: string, kind: DprManpowerKind, group: string, note?: string]> = [
  /* ── Direct: Management (4) ── */
  ["Execution Manager", D, "direct-management"],
  ["Execution Expert", D, "direct-management"],
  ["Execution Technician", D, "direct-management"],
  ["Supervisor", D, "direct-management"],
  /* ── Direct: Civil & Building (14) ── */
  ["Foreman", D, "civil"],
  ["Concrete Tank-Wall Enforcement Cabling", D, "civil"],
  ["Bar Bender / Bolt Man", D, "civil"],
  ["Form Worker / Carpenter", D, "civil"],
  ["Concrete Worker / Pump Operator", D, "civil"],
  ["Asphalt Worker", D, "civil"],
  ["Batching Plant Operator", D, "civil"],
  ["Brick Layer / Mason / Tiler", D, "civil"],
  ["Painter / Plasterer", D, "civil"],
  ["Plumber", D, "civil"],
  ["Welder", D, "civil"],
  ["Welder Helper", D, "civil"],
  ["Water Proofing Worker", D, "civil"],
  ["Others", D, "civil"],
  /* ── Direct: Steel Structure (8) ── */
  ["Foreman", D, "structure"],
  ["Grouter", D, "structure"],
  ["Assembler", D, "structure"],
  ["Steel / Iron Worker", D, "structure"],
  ["Helper", D, "structure"],
  ["Welder", D, "structure"],
  ["Welder Helper", D, "structure"],
  ["Others", D, "structure"],
  /* ── Direct: Piping (21) ── */
  ["Foreman Weld/Fit Up", D, "piping"],
  ["Cutter / Bender / Grinder", D, "piping"],
  ["Bevel Machine Operator", D, "piping"],
  ["Bonder", D, "piping"],
  ["Bonder helper", D, "piping"],
  ["Pipe Fitter-1(First Level)", D, "piping"],
  ["Pipe Fitter-2(Second Level)", D, "piping"],
  ["Fitter Helper", D, "piping"],
  ["Tack Welder", D, "piping"],
  ["Pipe Welder ( ARC )", D, "piping"],
  ["Pipe Welder ( TIG )", D, "piping"],
  ["Pipe Welder ( TIG + ARC )", D, "piping"],
  ["Pipe Welder ( CO₂ )", D, "piping"],
  ["Pipe Support Welder", D, "piping"],
  ["Welder Helper", D, "piping"],
  ["Pipe Wrapper", D, "piping"],
  ["Assembler", D, "piping"],
  ["Punchist", D, "piping"],
  ["Test Man", D, "piping"],
  ["Test Man Helper", D, "piping"],
  ["Others", D, "piping"],
  /* ── Direct: Electrical & Instrumentation (11) ── */
  ["Foreman", D, "electrical"],
  ["Technician - Electrical", D, "electrical"],
  ["Technician - Instrumentation", D, "electrical"],
  ["Installer", D, "electrical"],
  ["Cable Man", D, "electrical"],
  ["Calibrator", D, "electrical"],
  ["Connection Man", D, "electrical"],
  ["Welder", D, "electrical"],
  ["Helper", D, "electrical"],
  ["Termination installer", D, "electrical"],
  ["Others", D, "electrical"],
  /* ── Direct: Equipment & Tanks (12) ── */
  ["Foreman", D, "equipment"],
  ["Technician - Mechanical", D, "equipment"],
  ["Mechanical Fitter", D, "equipment"],
  ["Plate Welder", D, "equipment"],
  ["Tank Welder", D, "equipment"],
  ["Welder Helper", D, "equipment"],
  ["Assembler", D, "equipment"],
  ["Assembler Helper", D, "equipment"],
  ["Equipment Erector", D, "equipment"],
  ["Millwright", D, "equipment"],
  ["Alignment & Calibrator", D, "equipment"],
  ["Others", D, "equipment"],
  /* ── Direct: Paint & Insulation (8) ── */
  ["Foreman", D, "paint"],
  ["Sand Blaster", D, "paint"],
  ["Sand Blast Helper", D, "paint"],
  ["Painter", D, "paint"],
  ["Insulator - Equipment", D, "paint"],
  ["Insulator - Pipe", D, "paint"],
  ["Insulator Helper", D, "paint"],
  ["Others", D, "paint"],
  /* ── Direct: General (10) ── */
  ["Controller", D, "general"],
  ["Scaffolder Forman", D, "general"],
  ["Scaffolder", D, "general"],
  ["Scaffolder Helper", D, "general"],
  ["Skilled Labor", D, "general"],
  ["Common Labor", D, "general"],
  ["Equipment Operator", D, "general"],
  ["Heavy Vehicle Driver", D, "general"],
  ["Rigger", D, "general"],
  ["Others", D, "general"],

  /* ── Indirect: Management (2) ── */
  ["Project Manager / Director", I, "management"],
  ["Site Manager / Deputy", I, "management"],
  /* ── Indirect: Construction (12) ── */
  ["Construction Manager / Deputy", I, "construction"],
  ["Area/Discipline Manager(Superintendent)", I, "construction"],
  ["Superintendent", I, "construction"],
  ["Civil & Building - Supervisor", I, "construction"],
  ["Steel Structure - Supervisor", I, "construction"],
  ["Piping - Supervisor", I, "construction"],
  ["Equipment & Tanks - Supervisor", I, "construction"],
  ["Electrical - Supervisor", I, "construction"],
  ["Instrument - Supervisor", I, "construction"],
  ["Telecommunication - Supervisor", I, "construction"],
  ["Insulation & Paint - Supervisor", I, "construction"],
  ["Others", I, "construction"],
  /* ── Indirect: Technical Office (5) ── */
  ["Technical Office Manager / Deputy", I, "tech-office"],
  ["Technical Office - Engineers", I, "tech-office"],
  ["Technical Office - Technicians", I, "tech-office"],
  ["Document Controller", I, "tech-office"],
  ["Others", I, "tech-office"],
  /* ── Indirect: Planning & Project Control (4) ── */
  ["Planning & Control Manager / Deputy", I, "planning"],
  ["Planning & Control - Engineers", I, "planning"],
  ["Planning & Control - Technicians", I, "planning"],
  ["Others", I, "planning"],
  /* ── Indirect: IT & Communication (3) ── */
  ["IT & Communication Manager / Deputy", I, "it"],
  ["Engineers / Technicians", I, "it"],
  ["Others", I, "it"],
  /* ── Indirect: QA / QC (9) ── */
  ["QC Manager / Deputy", I, "qc"],
  ["QC - Engineers", I, "qc"],
  ["QC - Technicians", I, "qc"],
  ["Concrete Lab.", I, "qc"],
  ["Soil Mechanic Lab.", I, "qc"],
  ["NDT Controller / Radiography", I, "qc"],
  ["PWHT Man", I, "qc"],
  ["Staff", I, "qc"],
  ["Others", I, "qc"],
  /* ── Indirect: HSE (7) ── */
  ["HSE Manager / Deputy", I, "hse"],
  ["HSE - Supervisor", I, "hse"],
  ["HSE - Officer", I, "hse"],
  ["Doctor", I, "hse"],
  ["Nurse", I, "hse"],
  ["HSE Driver", I, "hse"],
  ["Others", I, "hse"],
  /* ── Indirect: Material Control (7) ── */
  ["Material Control Manager / Deputy", I, "material"],
  ["Custom Clearance", I, "material"],
  ["Spool Man", I, "material"],
  ["Warehouse - Material Man", I, "material"],
  ["Warehouse - Tool Man", I, "material"],
  ["Material Helper", I, "material"],
  ["Others", I, "material"],
  /* ── Indirect: Finance / Cost / Contracts (5) ── */
  ["Finance Manager", I, "finance"],
  ["Finance / Accountant", I, "finance"],
  ["Cost Control", I, "finance"],
  ["Contracts", I, "finance"],
  ["Others", I, "finance"],
  /* ── Indirect: Survey (3) ── */
  ["Surveyor Manager", I, "survey"],
  ["Surveyor", I, "survey"],
  ["Surveyor Helper", I, "survey"],
  /* ── Indirect: Facility / Maintenance (5) ── */
  ["Manager", I, "facility"],
  ["Electrician", I, "facility"],
  ["Serviceman", I, "facility"],
  ["Motor Man", I, "facility"],
  ["Others", I, "facility"],
  /* ── Indirect: Security (2) ── */
  ["Security Manager / Deputy", I, "security"],
  ["Guardian", I, "security"],
  /* ── Indirect: Logistics (8) ── */
  ["Logistics Manager / Deputy", I, "logistics"],
  ["Local Procurement / Purchaser", I, "logistics"],
  ["Transportation Office", I, "logistics"],
  ["Administration / Clerk", I, "logistics"],
  ["Light Vehicle Driver", I, "logistics"],
  ["Maintenance / General Services - Site", I, "logistics"],
  ["Maintenance / General Services - Camp", I, "logistics"],
  ["Others", I, "logistics"],
];

export const DPR_MANPOWER: DprManpowerRow[] = rows.map(([title, kind, group, note], i) => ({
  code: `MP-${String(i + 1).padStart(3, "0")}`,
  title,
  kind,
  group,
  ...(note ? { note } : {}),
}));
