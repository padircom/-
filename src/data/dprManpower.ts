/** فهرست ثابت مشاغل گزارش روزانه (Manpower) — ۱۴۴ ردیف طبق عکس اکسل کاربر.
 *
 * ── منشأ ────────────────────────────────────────────────────────────
 * رونویسی از عکس شیت Manpower (ستون Manpower). ترتیب ردیف‌ها عین عکس
 * است؛ کدها (MP-001…) صرفاً کلید فنی‌اند و در عکس نیستند.
 *
 * ── گروه‌ها ──────────────────────────────────────────────────────────
 * ستون گروه در عکس نیست؛ گروه‌بندی فقط برای نمایش تاشو در رابط کاربری
 * از روی چینش بخش‌های عکس استخراج شده و جنبهٔ نمایشی دارد.
 *
 * ── موارد نیازمند کنترل با اکسل ──────────────────────────────────────
 * املای عکس عیناً حفظ شده («Structur»، «Radiograph»، «Custom Clearance»،
 * «Soil Mechanic Lab.»)؛ موارد مشکوک با پرچم `note` مشخص‌اند. فاصله‌گذاری
 * عین عکس است («Admin./Clerk»، «Communication- Engineer»). اگر در اکسل
 * چیز دیگری است، همین فایل در یک پاس اصلاح می‌شود — کدها ثابت می‌مانند.
 *
 * فقط فاصله‌گذاری داخل پرانتزها یکدست شد: «( ARC )» ← «(ARC)».
 */

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
  civil: { fa: "عمرانی", en: "Civil" },
  structure: { fa: "سازه", en: "Structure" },
  piping: { fa: "پایپینگ", en: "Piping" },
  electrical: { fa: "برق", en: "Electrical" },
  equipment: { fa: "تجهیزات / مکانیک", en: "Equipment" },
  paint: { fa: "رنگ و عایق", en: "Paint & Insulation" },
  general: { fa: "عمومی اجرا", en: "General" },
  management: { fa: "مدیریت", en: "Management" },
  "civil-eng": { fa: "مهندسی عمران و سازه", en: "Civil/Structure Eng." },
  "piping-eng": { fa: "مهندسی پایپینگ", en: "Piping Eng." },
  "mech-eng": { fa: "مهندسی مکانیک", en: "Mechanical Eng." },
  "elec-eng": { fa: "مهندسی برق", en: "Electrical Eng." },
  "inst-eng": { fa: "مهندسی ابزار دقیق", en: "Instrumentation Eng." },
  "paint-eng": { fa: "مهندسی رنگ و عایق", en: "Paint/Insulation Eng." },
  "tech-office": { fa: "دفتر فنی", en: "Technical Office" },
  planning: { fa: "برنامه‌ریزی و کنترل", en: "Planning & Control" },
  it: { fa: "فناوری اطلاعات", en: "IT & Communication" },
  qc: { fa: "کنترل کیفیت و آزمایشگاه", en: "QC & Labs" },
  "doc-hse": { fa: "مستندات و HSE", en: "Document & HSE" },
  clinic: { fa: "بهداری", en: "Clinic" },
  material: { fa: "کنترل متریال و انبار", en: "Material & Warehouse" },
  admin: { fa: "اداری و مالی", en: "Admin & Finance" },
  logistics: { fa: "لجستیک و خرید", en: "Logistics" },
  maintenance: { fa: "تعمیرات و خدمات عمومی", en: "Maintenance" },
  security: { fa: "حراست", en: "Security" },
  services: { fa: "نقلیه سبک و خدمات", en: "Services" },
};

const D = "direct" as const;
const I = "indirect" as const;

const rows: Array<[title: string, kind: DprManpowerKind, group: string, note?: string]> = [
  /* ── Civil (15) ── */
  ["Foreman civil", D, "civil"],
  ["Bar Bender", D, "civil"],
  ["Bolt Man", D, "civil"],
  ["Form Worker / Carpenter", D, "civil"],
  ["Concrete Worker", D, "civil"],
  ["Concrete Pump Operator", D, "civil"],
  ["Asphalt Worker", D, "civil"],
  ["Batching Plant Operator", D, "civil"],
  ["Brick Layer / Mason", D, "civil"],
  ["Tiler", D, "civil"],
  ["Painter / Plasterer", D, "civil"],
  ["Plumber", D, "civil"],
  ["Iron Worker", D, "civil"],
  ["Water Proofing Worker", D, "civil"],
  ["Others Civil", D, "civil"],
  /* ── Structure (7) ── */
  ["Foreman Structur", D, "structure", "عین عکس (احتمالاً Structure)"],
  ["Technician", D, "structure"],
  ["Assembler/Cutter", D, "structure"],
  ["Steel / Iron Worker", D, "structure"],
  ["Welder", D, "structure"],
  ["Welder Helper", D, "structure"],
  ["Others Structur", D, "structure", "عین عکس (احتمالاً Structure)"],
  /* ── Piping (17) ── */
  ["Foreman Piping", D, "piping"],
  ["Cutter / Bender / Grinder", D, "piping"],
  ["Bevel Machine Operator", D, "piping"],
  ["Pipe Fitter-1", D, "piping"],
  ["Pipe Fitter-2", D, "piping"],
  ["Fitter Helper", D, "piping"],
  ["Tack Welder", D, "piping"],
  ["Pipe Welder (ARC)", D, "piping"],
  ["Pipe Welder (TIG)", D, "piping"],
  ["Pipe Welder (TIG & ARC)", D, "piping"],
  ["Pipe Welder (CO2)", D, "piping"],
  ["Pipe Support Welder", D, "piping"],
  ["Welder Helper", D, "piping"],
  ["Pipe Wrapper", D, "piping"],
  ["Assembler", D, "piping"],
  ["Radiograph", D, "piping", "عین عکس"],
  ["Others Piping", D, "piping"],
  /* ── Electrical (5) ── */
  ["Foreman Electrical", D, "electrical"],
  ["Technician - Electrical", D, "electrical"],
  ["Technician - Instrumentation", D, "electrical"],
  ["Cable Man", D, "electrical"],
  ["Others Electrical", D, "electrical"],
  /* ── Equipment / Mechanical (10) ── */
  ["Foreman Equipment", D, "equipment"],
  ["Technician - Mechanical", D, "equipment"],
  ["Mechanical Fitter", D, "equipment"],
  ["Plate Welder", D, "equipment"],
  ["Tank Welder", D, "equipment"],
  ["Welder Helper", D, "equipment"],
  ["Assembler", D, "equipment"],
  ["Millwright / Equipment Erector", D, "equipment"],
  ["Alignment & Calibrator", D, "equipment"],
  ["Others Equipment", D, "equipment"],
  /* ── Paint & Insulation (8) ── */
  ["Foreman painting", D, "paint"],
  ["Sand Blaster", D, "paint"],
  ["Shot Blaster", D, "paint"],
  ["Painter", D, "paint"],
  ["Insulator - Vessel", D, "paint"],
  ["Insulator - Pipe", D, "paint"],
  ["Insulator - Equipment", D, "paint"],
  ["Others painting", D, "paint"],
  /* ── General (10) ── */
  ["Controller", D, "general"],
  ["Equipment Operator", D, "general"],
  ["Rigger", D, "general"],
  ["Scaffolder", D, "general"],
  ["Skilled Labor", D, "general"],
  ["Common Labor", D, "general"],
  ["Helper", D, "general"],
  ["Heavy Vehicle Driver", D, "general"],
  ["Machinery Maintenance", D, "general"],
  ["Others", D, "general"],
  /* ── Management (5) ── */
  ["Project Manager / Director", I, "management"],
  ["Site Manager / Deputy", I, "management"],
  ["Construction Manager / Deputy", I, "management"],
  ["Area / Discipline Manager", I, "management"],
  ["Superintendent", I, "management"],
  /* ── Civil/Structure + Survey (5) ── */
  ["Civil / Steel Structure - Supervisor", I, "civil-eng"],
  ["Civil & Steel Structure - Engineers", I, "civil-eng"],
  ["Civil & Steel Structure - Technicians Executive", I, "civil-eng"],
  ["Surveying - Engineers", I, "civil-eng"],
  ["Surveying - Helper", I, "civil-eng"],
  /* ── Piping eng (3) ── */
  ["Executive Supervisor Piping", I, "piping-eng"],
  ["Piping - Engineers", I, "piping-eng"],
  ["Piping - Technicians", I, "piping-eng"],
  /* ── Mechanical eng (3) ── */
  ["Mechanical & Equipment - Supervisor", I, "mech-eng"],
  ["Mechanical & Equipment - Engineers", I, "mech-eng"],
  ["Mechanical & Equipment - Technicians", I, "mech-eng"],
  /* ── Electrical eng (3) ── */
  ["Electrical & Power - Supervisor", I, "elec-eng"],
  ["Electrical & Power - Engineers", I, "elec-eng"],
  ["Electrical & Power - Technicians", I, "elec-eng"],
  /* ── Instrumentation eng (3) ── */
  ["Instrumentation & Control - Supervisor", I, "inst-eng"],
  ["Instrumentation & Control - Engineers", I, "inst-eng"],
  ["Instrumentation & Control - Technicians", I, "inst-eng"],
  /* ── Paint/Insulation eng (3) ── */
  ["Insulation & Paint - Supervisor", I, "paint-eng"],
  ["Insulation & Paint - Engineers", I, "paint-eng"],
  ["Insulation & Paint - Technicians", I, "paint-eng"],
  /* ── Technical office (4) ── */
  ["Technical Office Manager / Deputy", I, "tech-office"],
  ["Technical Office - Engineers", I, "tech-office"],
  ["Technical Office - Technicians", I, "tech-office"],
  ["TDC", I, "tech-office"],
  /* ── Planning (5) ── */
  ["Planning & Control Manager / Deputy", I, "planning"],
  ["Planning & Control - Engineers", I, "planning"],
  ["Planning & Control - Technicians", I, "planning"],
  ["Cost Control", I, "planning"],
  ["Contracts", I, "planning"],
  /* ── IT (2) ── */
  ["IT & Communication- Engineer", I, "it"],
  ["IT & Communication- Technician", I, "it"],
  /* ── QC & labs (6) ── */
  ["QC Manager / Deputy", I, "qc"],
  ["QC - Engineers", I, "qc"],
  ["QC - Technicians", I, "qc"],
  ["Concrete Lab.", I, "qc"],
  ["Soil Mechanic Lab.", I, "qc", "عین عکس؛ احتمالاً Mechanics"],
  ["NDT Controller / Radiography", I, "qc"],
  /* ── Document & HSE (5) ── */
  ["Document Controller", I, "doc-hse"],
  ["HSE Manager / Deputy", I, "doc-hse"],
  ["HSE - Supervisor", I, "doc-hse"],
  ["HSE - Officer", I, "doc-hse"],
  ["Safety officer", I, "doc-hse"],
  /* ── Clinic (2) ── */
  ["Clinic Doctor", I, "clinic"],
  ["Clinic Nurse", I, "clinic"],
  /* ── Material & warehouse (7) ── */
  ["Material Control Manager / Deputy", I, "material"],
  ["Custom Clearance", I, "material", "عین عکس"],
  ["Spool Man", I, "material"],
  ["Warehouse - Material Man", I, "material"],
  ["Warehouse - Tool Man", I, "material"],
  ["Material Helper", I, "material"],
  ["FMCS", I, "material"],
  /* ── Admin & finance (6) ── */
  ["Admin. Manager", I, "admin"],
  ["Admin./Clerk", I, "admin"],
  ["Administrative", I, "admin"],
  ["Finance Manager", I, "admin"],
  ["Finance / Accountant", I, "admin"],
  ["Others Finance", I, "admin"],
  /* ── Logistics (2) ── */
  ["Logistics Manager / Deputy", I, "logistics"],
  ["Local Procurement / Purchaser", I, "logistics"],
  /* ── Maintenance (2) ── */
  ["Maintenance / General Services - Site", I, "maintenance"],
  ["Maintenance / General Services - Camp", I, "maintenance"],
  /* ── Security (4) ── */
  ["Security Manager / Deputy", I, "security"],
  ["Security Officer", I, "security"],
  ["Guard", I, "security"],
  ["Well guard", I, "security"],
  /* ── Services (2) ── */
  ["Light Vehicle Driver", I, "services"],
  ["Services & Kitchen worker", I, "services"],
];

export const DPR_MANPOWER: DprManpowerRow[] = rows.map(([title, kind, group, note], i) => ({
  code: `MP-${String(i + 1).padStart(3, "0")}`,
  title,
  kind,
  group,
  ...(note ? { note } : {}),
}));
