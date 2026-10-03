import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import { useSystem } from "../context/SystemContext";
import type { Lang } from "../data/framework";
import type { DprTablesReport } from "../services/dprTables";
import { getDprReport, listDprReports } from "../services/dprTablesApi";

type WeeklyReportTab =
  | "cover"
  | "index"
  | "hse"
  | "narrative"
  | "workFront"
  | "keyMilestone"
  | "pms"
  | "summary"
  | "sCurve"
  | "delay"
  | "manpower"
  | "machinery"
  | "consumingMaterial"
  | "durableMaterial"
  | "engineeringDocuments"
  | "photos";

type WeeklyTabDef = { id: WeeklyReportTab; fa: string; en: string };

type HseManpowerRow = { last: string; thisWeek: string };
type HseIndicatorRow = { last: string; thisWeek: string; upToNow: string; cumulativeMode: "sum" | "manual" };
type WorkRow = { task: string; location: string };
type WorkFrontRow = { task: string; location: string; quantity: string };
type SCurveWeekRow = {
  week: string;
  weeklyPlan: string;
  cumulativePlan: string;
  weeklyActual: string;
  cumulativeActual: string;
};
type DelayCauseColumn = { heading: string; causeLabels: (string | null)[]; lowerLabel: string };
type DelayAnalysisRow = {
  task: string;
  wbs: string;
  workFront: string;
  planStart: string;
  actualStart: string;
  planFinish: string;
  actualFinish: string;
  cause1: string;
  cause2: string;
  duration: string;
  engineeringShare: string;
  procurementShare: string;
  constructionShare: string;
  clientShare: string;
  contractorShare: string;
};
type ManpowerTableRow = { description: string; kind: "section" | "role" | "total"; values: string[] };
type MachineryEquipmentRow = {
  mainGroup: string;
  subGroup: string;
  description: string;
  values: string[];
  kind: "asset" | "total";
};
type SitePhotoRow = { image: string; label: string };
type KeyMilestoneRow = {
  division: string;
  unit: string;
  task: string;
  planStart: string;
  planFinish: string;
  actualStart: string;
  actualFinish: string;
};

type WeeklyReportData = {
  reportNo: string;
  reportDate: string;
  periodStart: string;
  periodEnd: string;
  projectTitle: string;
  phases: string;
  organizationOne: string;
  organizationTwo: string;
  location: string;
  hseManHoursSinceLti: string;
  hseManpower: HseManpowerRow[];
  hseIndicators: HseIndicatorRow[];
  hseConcerns: string[];
  hseActions: string[];
  keyMilestones: KeyMilestoneRow[];
  availableWorkFronts: WorkFrontRow[];
  nextWeekActivities: WorkFrontRow[];
  sCurveWeeks: SCurveWeekRow[];
  delayCauseColumns: DelayCauseColumn[];
  delayAnalysisRows: DelayAnalysisRow[];
  directManpowerRows: ManpowerTableRow[];
  indirectManpowerRows: ManpowerTableRow[];
  machineryPageOneRows: MachineryEquipmentRow[];
  machineryPageTwoRows: MachineryEquipmentRow[];
  consumingMaterialRows: string[][];
  durableMaterialRows: string[][];
  engineeringDocumentRows: string[][];
  sitePhotos: SitePhotoRow[];
  projectProgressValues: string[][];
  summaryProgressValues: string[][];
  workVolumeValues: string[][];
  performedWorks: WorkRow[];
  narrativeConcerns: string[];
};

const WEEKLY_REPORT_TABS: WeeklyTabDef[] = [
  { id: "cover", fa: "کاور", en: "Cover" },
  { id: "index", fa: "فهرست", en: "Index" },
  { id: "hse", fa: "ایمنی (HSE)", en: "HSE" },
  { id: "narrative", fa: "شرح کار", en: "Narrative" },
  { id: "workFront", fa: "جبهه کاری", en: "Work Front" },
  { id: "keyMilestone", fa: "نقاط عطف کلیدی", en: "Key Milestone" },
  { id: "pms", fa: "PMS", en: "PMS" },
  { id: "summary", fa: "خلاصه", en: "Summary" },
  { id: "sCurve", fa: "منحنی S", en: "S-Curve" },
  { id: "delay", fa: "تأخیر", en: "Delay" },
  { id: "manpower", fa: "نیروی انسانی", en: "Manpower" },
  { id: "machinery", fa: "ماشین‌آلات", en: "Machinery" },
  { id: "consumingMaterial", fa: "مصالح مصرفی", en: "Consuming Material" },
  { id: "durableMaterial", fa: "مصالح بادوام", en: "Durable Material" },
  { id: "engineeringDocuments", fa: "مدارک مهندسی", en: "Engineering Documents" },
  { id: "photos", fa: "تصاویر", en: "Photos" },
];

const INDEX_ITEMS = [
  "HSE",
  "Narrative",
  "Work Front",
  "Key Milestone",
  "PMS",
  "Summary",
  "S-Curve",
  "Delay",
  "Manpower",
  "Machinery",
  "Consuming Material",
  "Durable Material",
  "Engineering Documents",
  "Photos",
];

type DailyNarrativeSource = { reportDate: string; isoDate: string; report: DprTablesReport };
type RankedNarrativeEntry = { text: string; locations: Set<string>; dates: Set<string>; latestDate: string };

function jalaliDateToIso(value: string): string | null {
  const normalized = String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[.-]/g, "/");
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized.trim());
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1300 || year > 1500 || month < 1 || month > 12 || day < 1 || day > (month <= 6 ? 31 : 30)) return null;
  try {
    const converted = toGregorian(year, month, day);
    return `${converted.gy}-${String(converted.gm).padStart(2, "0")}-${String(converted.gd).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function splitNarrativeEntries(value: string): string[] {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n+|[•●▪◦]+|(?<=[.!?؟؛])\s+/u)
    .map((entry) => entry.trim().replace(/^(?:[-–—*•●▪◦]+|\d+[.)])\s*/u, "").trim())
    .filter(Boolean);
}

function normalizeNarrativeKey(value: string): string {
  return value.normalize("NFKC").replace(/ي/g, "ی").replace(/ك/g, "ک").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}



const JALALI_MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"] as const;
const JALALI_MONTHS_EN = ["Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar", "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"] as const;
const JALALI_WEEKDAYS_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;
const JALALI_WEEKDAYS_EN = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function toAsciiDigits(value: string): string {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
}

function toPersianDigits(value: string): string {
  return String(value ?? "").replace(/[0-9]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) + 1728));
}

type JalaliDateParts = { year: number; month: number; day: number };

function parseJalaliDate(value: string): JalaliDateParts | null {
  const normalized = toAsciiDigits(value).trim().replace(/[.-]/g, "/");
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1300 || year > 1500 || month < 1 || month > 12 || day < 1 || day > jalaaliMonthLength(year, month)) return null;
  return { year, month, day };
}

function formatJalaliDate({ year, month, day }: JalaliDateParts): string {
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

function normalizeJalaliDate(value: string, fallback = ""): string {
  const normalized = toAsciiDigits(value).trim();
  const jalaliParts = parseJalaliDate(normalized);
  if (jalaliParts) return formatJalaliDate(jalaliParts);
  const gregorian = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (gregorian) {
    const [, year, month, day] = gregorian;
    const converted = toJalaali(Number(year), Number(month), Number(day));
    return formatJalaliDate({ year: converted.jy, month: converted.jm, day: converted.jd });
  }
  return fallback;
}

function todayJalaliDate(): string {
  try {
    const parts = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = (type: string) => toAsciiDigits(parts.find((part) => part.type === type)?.value ?? "");
    return formatJalaliDate({ year: Number(value("year")), month: Number(value("month")), day: Number(value("day")) });
  } catch {
    const converted = toJalaali(new Date());
    return formatJalaliDate({ year: converted.jy, month: converted.jm, day: converted.jd });
  }
}

type WorkHighlightCandidate = { task: string; location: string };

function mergeWorkHighlights(rows: WorkRow[], candidates: WorkHighlightCandidate[]) {
  const nextRows = rows.map((row) => ({ ...row }));
  const existing = new Set(nextRows.map((row) => normalizeNarrativeKey(row.task)).filter(Boolean));
  let added = 0;
  for (const candidate of candidates) {
    const key = normalizeNarrativeKey(candidate.task);
    if (!key || existing.has(key)) continue;
    const emptyIndex = nextRows.findIndex((row) => !row.task.trim() && !row.location.trim());
    if (emptyIndex < 0) break;
    nextRows[emptyIndex] = { task: candidate.task, location: candidate.location };
    existing.add(key);
    added += 1;
  }
  return { rows: nextRows, added };
}

function mergeConcernHighlights(rows: string[], candidates: string[]) {
  const nextRows = [...rows];
  const existing = new Set(nextRows.map(normalizeNarrativeKey).filter(Boolean));
  let added = 0;
  for (const candidate of candidates) {
    const key = normalizeNarrativeKey(candidate);
    if (!key || existing.has(key)) continue;
    const emptyIndex = nextRows.findIndex((row) => !row.trim());
    if (emptyIndex < 0) break;
    nextRows[emptyIndex] = candidate;
    existing.add(key);
    added += 1;
  }
  return { rows: nextRows, added };
}

const NARRATIVE_WORK_GROUPS = [
  { title: "Summary of Engineering Department Actions", rowCount: 12 },
  { title: "Summary of Procurement Department Actions", rowCount: 12 },
  { title: "Summary of Procurement Department Actions", rowCount: 11 },
] as const;
const NARRATIVE_WORK_ROW_COUNT = NARRATIVE_WORK_GROUPS.reduce((total, group) => total + group.rowCount, 0);
const KEY_MILESTONE_ROW_COUNT = 14;
const WORK_FRONT_ROW_COUNT = 20;
const DELAY_ANALYSIS_ROW_COUNT = 28;
const CONSUMING_MATERIAL_ROW_COUNT = 14;
const DURABLE_MATERIAL_ROW_COUNT = 14;
const ENGINEERING_DOCUMENT_ROW_COUNT = 14;
const SITE_PHOTO_COUNT = 8;
const MILESTONE_SAMPLE_BARS = [
  { planStart: 1, planFinish: 8, actualStart: 2, actualFinish: 9, actualColor: "#f01818" },
  { planStart: 1, planFinish: 11, actualStart: 2, actualFinish: 5, actualColor: "#8bd34c" },
] as const;

const SUMMARY_DISCIPLINES = [
  "Mobilization",
  "Civil",
  "Building and Architectural",
  "Steel Structure",
  "Piping",
  "Equipment",
  "HVAC",
  "Electrical",
  "Instrument",
  "Telecommunication",
  "Safety and Firefighting",
  "Paint",
  "Insulation",
  "Precom",
  "Demobilization",
  "Project",
] as const;
const WORK_VOLUME_TASKS = [
  "Excavation",
  "Reinforcement",
  "Formworking",
  "Concrete Pouring",
  "Back fill",
  "Steel Structure",
  "U/G Piping",
  "A/G Piping",
  "Equipment Package",
  "Steel Tanks",
] as const;
const SUMMARY_PROGRESS_VALUE_COUNT = 8;
const WORK_VOLUME_VALUE_COUNT = 5;
const PROJECT_PROGRESS_VALUE_COUNT = 21;
const PROJECT_PROGRESS_ROWS = [
  { task: "Area C2 - Jahan Pars", depth: 0, band: "#40588f", text: "#ffffff", editable: false },
  { task: "Mobilization", depth: 1, band: "#b8c9dc", text: "#18283a", editable: false },
  { task: "Preliminary Mobilization", depth: 2, band: "#c7d9a5", text: "#18283a", editable: false },
  { task: "Continues Mobilization", depth: 2, band: "#c7d9a5", text: "#18283a", editable: false },
  { task: "Civil and Underground", depth: 1, band: "#b5c6d4", text: "#18283a", editable: false },
  { task: "Unit 101-3,104-3,105-3 (Train 3)", depth: 2, band: "#c7d9a5", text: "#18283a", editable: false },
  { task: "Equipment foundation", depth: 3, band: "#ffc65c", text: "#18283a", editable: false },
  { task: "101-D-301", depth: 4, band: "#f45151", text: "#ffffff", editable: false },
  { task: "Excavation", depth: 4, band: "#ffffff", text: "#18283a", editable: true },
  { task: "Bed Preparation", depth: 4, band: "#ffffff", text: "#18283a", editable: true },
  { task: "Lean Concrete", depth: 4, band: "#ffffff", text: "#18283a", editable: true },
  { task: "Rebar", depth: 4, band: "#ffffff", text: "#18283a", editable: true },
  { task: "Foundation Formwork", depth: 4, band: "#ffffff", text: "#18283a", editable: true },
  { task: "Foundation Concrete", depth: 4, band: "#ffffff", text: "#18283a", editable: true },
  { task: "Pedestal Formwork", depth: 4, band: "#ffffff", text: "#18283a", editable: true },
  { task: "Anchor Bolt", depth: 4, band: "#ffffff", text: "#18283a", editable: true },
  { task: "Pedestal Concrete", depth: 4, band: "#ffffff", text: "#18283a", editable: true },
  { task: "Curing", depth: 4, band: "#ffffff", text: "#18283a", editable: true },
  { task: "U/G Coating", depth: 4, band: "#ffffff", text: "#18283a", editable: true },
  { task: "Back Filling", depth: 4, band: "#ffffff", text: "#18283a", editable: true },
] as const;
const PROJECT_PROGRESS_LEVEL_COLORS = ["#40588f", "#8ba8c7", "#c7d9a5", "#ffc65c", "#f45151"] as const;

const HSE_MANPOWER_NAMES = ["HSE Manager", "HSE Manpower"];
const HSE_INDICATOR_NAMES = [
  "No of HSE Employee",
  "No of Employee Training",
  "No of Anomalies Reported",
  "No of Outstanding Anomalies",
  "No of First Aid Case (FAC)",
  "No of Medical Treatment Case",
  "No of Restricted Workday Case",
  "No of Lost Time Injuries (LTI)",
  "No of Fatalities",
  "Recordable Incidence Rate",
  "No of Environmental Damage Case",
  "No of Material Damage / Loss Case",
  "No of Fires",
  "No of Other Near Misses With Potential Severity >=3",
  "No of HSE Meetings Held",
  "No of Tool Box Talks Held",
  "No of Emergency Drills Held",
  "No of Induction Course",
];
const repeatManpowerDay = (present = "", rest = ""): [string, string][] =>
  Array.from({ length: 7 }, () => [present, rest]);
const makeManpowerRow = (
  description: string,
  kind: ManpowerTableRow["kind"],
  days: [string, string][] = [],
  week: [string, string] = ["", ""],
  upToNow: [string, string] = week,
): ManpowerTableRow => {
  const dailyValues = Array.from({ length: 7 }, (_, index) => days[index] ?? ["", ""]);
  return { description, kind, values: [...dailyValues.flatMap(([present, rest]) => [present, rest]), ...week, ...upToNow] };
};

const DIRECT_MANPOWER_ROWS: ManpowerTableRow[] = [
  makeManpowerRow("Civil & Building", "section", [["24", "3"], ["24", "3"], ["24", "3"], ["25", "2"], ["24", "3"], ["24", "3"], ["24", "3"]], ["169", "20"]),
  makeManpowerRow("Foreman civil", "role", repeatManpowerDay("", "1"), ["0", "7"]),
  makeManpowerRow("Bar Bender", "role", repeatManpowerDay("10"), ["70", "0"]),
  makeManpowerRow("Bolt Man", "role", [], ["0", "0"]),
  makeManpowerRow("Form Worker / Carpenter", "role", repeatManpowerDay("13", "1"), ["91", "7"]),
  makeManpowerRow("Concrete Worker", "role"),
  makeManpowerRow("Concrete Pump Operator", "role"),
  makeManpowerRow("Asphalt Worker", "role"),
  makeManpowerRow("Batching Plant Operator", "role", [], ["0", "0"]),
  makeManpowerRow("Brick Layer / Mason", "role"),
  makeManpowerRow("Tiler", "role", [], ["0", "0"]),
  makeManpowerRow("Painter / Plasterer", "role"),
  makeManpowerRow("Plumber", "role"),
  makeManpowerRow("Iron Worker", "role"),
  makeManpowerRow("Water Proofing Worker", "role"),
  makeManpowerRow("Others Civil", "role", [["1", "1"], ["1", "1"], ["1", "1"], ["2", "1"], ["1", "1"], ["1", "1"], ["1", "1"]], ["8", "6"]),
  makeManpowerRow("Steel Structure", "section", [["57", "0"], ["58", "0"], ["58", "0"], ["58", "0"], ["59", "0"], ["59", "0"], ["", ""]], ["349", "0"]),
  makeManpowerRow("Foreman Structure", "role", [], ["0", "0"]),
  makeManpowerRow("Technician", "role", [["1", "0"], ["1", "0"], ["1", "0"], ["1", "0"], ["1", "0"], ["1", "0"], ["", ""]], ["6", "0"]),
  makeManpowerRow("Assembler/Cutter", "role", [["22", "0"], ["22", "0"], ["22", "0"], ["22", "0"], ["23", "0"], ["23", "0"], ["", ""]], ["134", "0"]),
  makeManpowerRow("Steel / Iron Worker", "role", [["8", "0"], ["8", "0"], ["8", "0"], ["8", "0"], ["8", "0"], ["8", "0"], ["", ""]], ["48", "0"]),
  makeManpowerRow("Welder", "role", [["12", "0"], ["12", "0"], ["12", "0"], ["12", "0"], ["12", "0"], ["12", "0"], ["", ""]], ["72", "0"]),
  makeManpowerRow("Welder Helper", "role", [], ["0", "0"]),
  makeManpowerRow("Others Structure", "role", [["14", "0"], ["15", "0"], ["15", "0"], ["15", "0"], ["15", "0"], ["15", "0"], ["", ""]], ["89", "0"]),
  makeManpowerRow("Piping", "section", repeatManpowerDay("0", "0"), ["0", "0"]),
  makeManpowerRow("Foreman Piping", "role"),
  makeManpowerRow("Fitter Helper", "role"),
  makeManpowerRow("Tack Welder", "role"),
  makeManpowerRow("Pipe Welder ( ARC )", "role"),
  makeManpowerRow("Welder Helper", "role"),
  makeManpowerRow("Assembler", "role"),
  makeManpowerRow("Electrical & Instrumentation", "section", repeatManpowerDay("0", "0"), ["0", "0"]),
  makeManpowerRow("Foreman Electrical", "role"),
  makeManpowerRow("Technician - Electrical", "role"),
  makeManpowerRow("Technical Worker", "role"),
  makeManpowerRow("Paint & Insulation", "section", [["5", "0"], ["5", "0"], ["5", "0"], ["5", "0"], ["5", "0"], ["5", "0"], ["0", "0"]], ["30", "0"]),
  makeManpowerRow("Foreman painting", "role"),
  makeManpowerRow("Sand Blaster", "role"),
  makeManpowerRow("Shot Blaster", "role"),
  makeManpowerRow("Painter", "role", [["5", "0"], ["5", "0"], ["5", "0"], ["5", "0"], ["5", "0"], ["5", "0"], ["", ""]], ["30", "0"]),
  makeManpowerRow("Insulator - Pipe", "role"),
  makeManpowerRow("General", "section", [["30", "4"], ["19", "3"], ["19", "2"], ["31", "3"], ["18", "4"], ["17", "4"], ["23", "3"]], ["157", "23"]),
  makeManpowerRow("Controller", "role"),
  makeManpowerRow("Equipment Operator", "role"),
  makeManpowerRow("Rigger", "role", [], ["0", "0"]),
  makeManpowerRow("Scaffolder", "role", [["2", "0"], ["2", "0"], ["2", "0"], ["2", "0"], ["", ""], ["1", "1"], ["1", "1"]], ["10", "4"]),
  makeManpowerRow("Skilled Labor", "role"),
  makeManpowerRow("Common Labor", "role", [["8", "2"], ["9", "1"], ["10", "0"], ["9", "1"], ["10", "0"], ["10", "0"], ["10", "0"]], ["66", "4"]),
  makeManpowerRow("Helper", "role", [], ["0", "0"]),
  makeManpowerRow("Heavy Vehicle Driver", "role", [["19", "2"], ["7", "2"], ["6", "2"], ["19", "2"], ["7", "2"], ["5", "3"], ["11", "2"]], ["74", "15"]),
  makeManpowerRow("Machinery Maintenance", "role", repeatManpowerDay("1", "0"), ["7", "0"]),
  makeManpowerRow("Worker", "role", [], ["0", "0"]),
  makeManpowerRow("Total Direct", "total", [["146", "11"], ["125", "9"], ["125", "7"], ["150", "8"], ["124", "11"], ["122", "11"], ["70", "9"]], ["862", "66"], ["1578", "121"]),
];

const INDIRECT_MANPOWER_ROWS: ManpowerTableRow[] = [
  makeManpowerRow("Management", "section", repeatManpowerDay("2", "1"), ["14", "7"]),
  makeManpowerRow("Project Manager / Director", "role", repeatManpowerDay("", "1"), ["0", "7"]),
  makeManpowerRow("Site Manager / Deputy", "role", repeatManpowerDay("2", "0"), ["14", "0"]),
  makeManpowerRow("Construction", "section", [["8", "2"], ["8", "2"], ["8", "2"], ["7", "3"], ["8", "2"], ["7", "3"], ["7", "3"]], ["53", "17"]),
  makeManpowerRow("Civil & Steel Structure - Supervisor", "role", repeatManpowerDay("", "1"), ["0", "7"]),
  makeManpowerRow("Civil & Steel Structure - Technicians Executive", "role", [["3", "1"], ["3", "1"], ["3", "1"], ["3", "0"], ["4", "0"], ["4", "0"], ["4", "1"]], ["24", "4"]),
  makeManpowerRow("Surveying - Engineers", "role", [["3", "0"], ["3", "0"], ["3", "0"], ["2", "1"], ["2", "1"], ["2", "1"], ["2", "1"]], ["17", "4"]),
  makeManpowerRow("Surveying - Helper", "role", [], ["12", "4"]),
  makeManpowerRow("Insulation & Paint - Supervisor", "role"),
  makeManpowerRow("Technical Office", "section", [["2", "3"], ["2", "3"], ["3", "2"], ["3", "2"], ["2", "3"], ["2", "3"], ["2", "3"]], ["16", "19"]),
  makeManpowerRow("Technical Office Manager / Deputy", "role", repeatManpowerDay("", "1"), ["0", "7"]),
  makeManpowerRow("Technical Office - Engineers", "role", [], ["16", "12"]),
  makeManpowerRow("Technical Office - Technicians", "role"),
  makeManpowerRow("Planning", "section", [["0", "3"], ["0", "3"], ["1", "2"], ["1", "2"], ["1", "2"], ["1", "2"], ["1", "2"]], ["5", "16"]),
  makeManpowerRow("Planning & Control Manager / Deputy", "role", repeatManpowerDay("", "1"), ["0", "7"]),
  makeManpowerRow("Planning & Control - Technicians", "role", [], ["5", "9"]),
  makeManpowerRow("QA / QC", "section", [["2", "2"], ["2", "2"], ["2", "2"], ["2", "2"], ["2", "2"], ["3", "1"], ["3", "1"]], ["16", "12"]),
  makeManpowerRow("QC Manager / Deputy", "role", [], ["0", "0"]),
  makeManpowerRow("QC - Technicians", "role", [["1", "1"], ["1", "1"], ["1", "1"], ["1", "1"], ["1", "1"], ["2", "0"], ["2", "0"]], ["9", "5"]),
  makeManpowerRow("Concrete Lab.", "role", repeatManpowerDay("1", "1"), ["7", "7"]),
  makeManpowerRow("Soil Mechanic Lab.", "role"),
  makeManpowerRow("NDT Controller / Radiography", "role"),
  makeManpowerRow("Document Controller", "role"),
  makeManpowerRow("HSE", "section", [["6", "2"], ["6", "2"], ["5", "3"], ["5", "3"], ["5", "3"], ["5", "3"], ["3", "5"]], ["35", "21"]),
  makeManpowerRow("HSE Manager / Deputy", "role", [], ["6", "1"]),
  makeManpowerRow("HSE - Supervisor", "role", [], ["0", "0"]),
  makeManpowerRow("HSE - Officer", "role", [], ["16", "12"]),
  makeManpowerRow("Safety officer", "role"),
  makeManpowerRow("Clinic Doctor", "role", [["2", "1"], ["2", "1"], ["2", "1"], ["2", "1"], ["2", "1"], ["2", "1"], ["1", "2"]], ["13", "8"]),
  makeManpowerRow("Clinic Nurse", "role"),
  makeManpowerRow("Material Control", "section", [], ["1", "6"]),
  makeManpowerRow("Material Control Manager / Deputy", "role", repeatManpowerDay("", "1"), ["0", "7"]),
  makeManpowerRow("Warehouse - Material Man", "role", [], ["1", "6"]),
  makeManpowerRow("Material Helper", "role"),
  makeManpowerRow("Administration", "section", [["2", "1"], ["2", "1"], ["2", "1"], ["2", "1"], ["3", "0"], ["3", "0"], ["3", "0"]], ["17", "4"]),
  makeManpowerRow("Admin. Manager / Deputy", "role", repeatManpowerDay("", "1"), ["0", "7"]),
  makeManpowerRow("Admin./Clerk", "role", [["2", "1"], ["2", "1"], ["2", "1"], ["2", "1"], ["3", "0"], ["3", "0"], ["3", "0"]], ["17", "4"]),
  makeManpowerRow("Administrative", "role"),
  makeManpowerRow("Finance", "section", repeatManpowerDay("1", "0"), ["7", "0"]),
  makeManpowerRow("Finance Manager", "role"),
  makeManpowerRow("Finance / Accountant", "role", repeatManpowerDay("1", "0"), ["7", "0"]),
  makeManpowerRow("Logistics", "section", [["25", "2"], ["25", "2"], ["25", "2"], ["25", "2"], ["24", "3"], ["25", "3"], ["23", "3"]], ["172", "17"]),
  makeManpowerRow("Logistics Manager / Deputy", "role", [], ["0", "0"]),
  makeManpowerRow("Local Procurement / Purchaser", "role", repeatManpowerDay("2", "0"), ["14", "0"]),
  makeManpowerRow("Maintenance / General Services - Site", "role", repeatManpowerDay("2", "0"), ["14", "0"]),
  makeManpowerRow("Maintenance / General Services - Camp", "role", [["5", "1"], ["5", "1"], ["5", "1"], ["5", "1"], ["4", "2"], ["4", "2"], ["4", "2"]], ["32", "10"]),
  makeManpowerRow("Security Manager / Deputy", "role"),
  makeManpowerRow("Security Officer", "role"),
  makeManpowerRow("Guard", "role", [["7", "0"], ["7", "0"], ["7", "0"], ["7", "0"], ["7", "0"], ["8", "0"], ["8", "0"]], ["51", "0"]),
  makeManpowerRow("Well guard", "role"),
  makeManpowerRow("Light Vehicle Driver", "role", [["7", "0"], ["7", "0"], ["7", "0"], ["7", "0"], ["7", "0"], ["7", "0"], ["5", "0"]], ["47", "0"]),
  makeManpowerRow("Services & Kitchen worker", "role", repeatManpowerDay("2", "1"), ["14", "7"]),
  makeManpowerRow("Total IN Direct", "total", [["48", "17"], ["48", "17"], ["49", "16"], ["48", "17"], ["48", "17"], ["49", "17"], ["46", "18"]], ["336", "119"]),
];

const MACHINERY_DAYS = [
  { date: "1404.07.26", weekday: "شنبه" },
  { date: "1404.07.27", weekday: "یکشنبه" },
  { date: "1404.07.28", weekday: "دوشنبه" },
  { date: "1404.07.29", weekday: "سه شنبه" },
  { date: "1404.07.30", weekday: "چهارشنبه" },
  { date: "1404.08.01", weekday: "پنجشنبه" },
  { date: "1404.08.02", weekday: "جمعه" },
] as const;
const repeatEquipmentDay = (active = "", inactive = "", inrepair = ""): [string, string, string][] =>
  Array.from({ length: 7 }, () => [active, inactive, inrepair]);
const makeMachineryRow = (
  mainGroup: string,
  subGroup: string,
  description: string,
  week: [string, string, string] = ["0", "0", "0"],
  days: [string, string, string][] = [],
  kind: MachineryEquipmentRow["kind"] = "asset",
  upToNow: [string, string, string] = week,
): MachineryEquipmentRow => {
  const dailyValues = Array.from({ length: 7 }, (_, index) => days[index] ?? ["", "", ""]);
  return {
    mainGroup,
    subGroup,
    description,
    kind,
    values: [...dailyValues.flatMap(([active, inactive, inrepair]) => [active, inactive, inrepair]), ...week, ...upToNow],
  };
};

const MACHINERY_PAGE_ONE_ROWS: MachineryEquipmentRow[] = [
  makeMachineryRow("Civil", "Heavy", "Excavator", ["7", "7", "0"], repeatEquipmentDay("1", "1")),
  makeMachineryRow("Civil", "Heavy", "Pichor / Jack Hammer"),
  makeMachineryRow("Civil", "Heavy", "Bulldozer"),
  makeMachineryRow("Civil", "Heavy", "Loader", ["7", "7", "0"], repeatEquipmentDay("1", "1")),
  makeMachineryRow("Civil", "Heavy", "Grader"),
  makeMachineryRow("Civil", "Heavy", "Compact Roller / Vibrating Roller", ["7", "7", "0"], repeatEquipmentDay("1", "1")),
  makeMachineryRow("Civil", "Semi-Heavy", "Truck Mixer", ["29", "25", "0"], [["12", "", ""], ["", "6", ""], ["", "6", ""], ["12", "", ""], ["", "6", ""], ["", "6", ""], ["5", "1", ""]]),
  makeMachineryRow("Civil", "Semi-Heavy", "Concrete & Grout Mixer"),
  makeMachineryRow("Civil", "Semi-Heavy", "Concrete Pump", ["2", "12", "0"]),
  makeMachineryRow("Civil", "Semi-Heavy", "Truck 1", ["6", "8", "0"]),
  makeMachineryRow("Civil", "Semi-Heavy", "Dumper"),
  makeMachineryRow("Civil", "Semi-Heavy", "Bob cat / Back hoe"),
  makeMachineryRow("Civil", "Semi-Heavy", "Compactor"),
  makeMachineryRow("Civil", "Workshop", "Hand Mixer", ["0", "7", "0"]),
  makeMachineryRow("Civil", "Workshop", "Batching Plant", ["4", "10", "0"]),
  makeMachineryRow("Civil", "Workshop", "Cement Silo", ["14", "0", "0"]),
  makeMachineryRow("Civil", "Workshop", "Concrete Laboratory", ["7", "0", "0"]),
  makeMachineryRow("Civil", "Workshop", "Vibrator", ["10", "25", "0"]),
  makeMachineryRow("Civil", "Workshop", "Rebar Cutting", ["35", "0", "0"]),
  makeMachineryRow("Civil", "Workshop", "Bar Bending"),
  makeMachineryRow("Civil", "Workshop", "Grinding Machine"),
  makeMachineryRow("General", "Heavy", "Crane ≥ 50 Ton"),
  makeMachineryRow("General", "Heavy", "Tower Crane"),
  makeMachineryRow("General", "Heavy", "Tractor / Loader Tractor"),
  makeMachineryRow("General", "Heavy", "Trailer"),
  makeMachineryRow("General", "Heavy", "Truck"),
  makeMachineryRow("General", "Heavy", "Boom Truck", ["2", "0", "0"]),
  makeMachineryRow("General", "Semi-Heavy", "Lift Truck", ["8", "0", "0"]),
  makeMachineryRow("General", "Semi-Heavy", "Water Tank Lorry", ["7", "7", "0"]),
  makeMachineryRow("General", "Workshop", "Fuel Tank Lorry"),
  makeMachineryRow("General", "Workshop", "Diesel generator(150-200 kv)", ["14", "14", "0"]),
  makeMachineryRow("General", "Workshop", "Crane ≤ 50 Ton", ["9", "2", "0"]),
  makeMachineryRow("General", "Workshop", "Air Less", ["6", "8", "0"]),
  makeMachineryRow("General", "Workshop", "Scaffolding Pipes & Board ( ML )"),
  makeMachineryRow("General", "Workshop", "Water Pump", ["21", "0", "0"]),
  makeMachineryRow("General", "Workshop", "Elevator"),
  makeMachineryRow("General", "Workshop", "Survey Camera - Leica", ["14", "0", "0"]),
  makeMachineryRow("General", "Workshop", "Survey Camera - Nivo"),
  makeMachineryRow("General", "Workshop", "Survey Camera - Theodolite"),
  makeMachineryRow("General", "Workshop", "GPS"),
  makeMachineryRow("General", "Workshop", "Water Tank", ["70", "0", "0"], repeatEquipmentDay("10")),
  makeMachineryRow("General", "Workshop", "Diesel Tank (10000 L)", ["14", "0", "0"], repeatEquipmentDay("2")),
  makeMachineryRow("", "", "", ["293", "153", "0"], [["55", "13", "0"], ["37", "26", "0"], ["36", "27", "0"], ["55", "14", "0"], ["35", "26", "0"], ["34", "27", "0"], ["41", "20", "0"]], "total"),
];

const MACHINERY_PAGE_TWO_ROWS: MachineryEquipmentRow[] = [
  makeMachineryRow("Equipment", "Workshop", "CuttingMachine", ["40", "30", "0"], [["7", "3", "0"], ["7", "3", "0"], ["7", "3", "0"], ["7", "3", "0"], ["6", "4", "0"], ["6", "4", "0"], ["0", "10", "0"]]),
  makeMachineryRow("Equipment", "Workshop", "SandBlastMachine", ["6", "8", "0"]),
  makeMachineryRow("Equipment", "Workshop", "Waterjet"),
  makeMachineryRow("Equipment", "Workshop", "WeldingTrans", ["72", "33", "0"]),
  makeMachineryRow("Equipment", "Workshop", "Rectifier", ["36", "38", "0"]),
  makeMachineryRow("Equipment", "Workshop", "StressReliefMachine(PWHTEq.)"),
  makeMachineryRow("Equipment", "Workshop", "AirCompressor", ["0", "7", "0"]),
  makeMachineryRow("Equipment", "Workshop", "UltrasonicEquipment"),
  makeMachineryRow("Equipment", "Workshop", "MagnetTest(Detector/BlackLight)"),
  makeMachineryRow("Equipment", "Workshop", "VacumBoxTester"),
  makeMachineryRow("Equipment", "Workshop", "HydrotestWaterPump"),
  makeMachineryRow("Equipment", "Workshop", "PlasmaCuttingMachine"),
  makeMachineryRow("Equipment", "Workshop", "SawMachine", ["18", "10", "0"]),
  makeMachineryRow("Equipment", "Workshop", "Gouge"),
  makeMachineryRow("Equipment", "Workshop", "Shegell"),
  makeMachineryRow("Equipment", "Workshop", "JunctionBox"),
  makeMachineryRow("Equipment", "Workshop", "Oxygen-AcetyleneCutter", ["7", "0", "0"], repeatEquipmentDay("1")),
  makeMachineryRow("Equipment", "Workshop", "AngleCutter"),
  makeMachineryRow("Equipment", "Workshop", "RollingMachine"),
  makeMachineryRow("Equipment", "Workshop", "ThreadingMachine"),
  makeMachineryRow("Equipment", "Workshop", "Grinder"),
  makeMachineryRow("Equipment", "Workshop", "Punch/Press"),
  makeMachineryRow("Equipment", "Workshop", "ElectrodeDryOven"),
  makeMachineryRow("Equipment", "Workshop", "ElectrodePortableOven"),
  makeMachineryRow("Equipment", "Workshop", "Jack-Horizontal"),
  makeMachineryRow("Equipment", "Workshop", "Jack-Vertical"),
  makeMachineryRow("Equipment", "Workshop", "DrillingMachine", ["21", "0", "0"], repeatEquipmentDay("3")),
  makeMachineryRow("Equipment", "Workshop", "Blower"),
  makeMachineryRow("Equipment", "Workshop", "ChainBlock"),
  makeMachineryRow("Equipment", "Workshop", "ElectricWinch"),
  makeMachineryRow("Vehicle", "", "Bus/Minibus", ["14", "0", "0"], repeatEquipmentDay("2")),
  makeMachineryRow("Vehicle", "", "Car", ["70", "0", "0"], repeatEquipmentDay("10")),
  makeMachineryRow("Vehicle", "", "Ambulance"),
  makeMachineryRow("Facility", "Workshop", "Container/Conex", ["91", "0", "0"], repeatEquipmentDay("13")),
  makeMachineryRow("Office", "Workshop", "Computer", ["175", "0", "0"], repeatEquipmentDay("25")),
  makeMachineryRow("Office", "Workshop", "Printer", ["63", "0", "0"], repeatEquipmentDay("9")),
  makeMachineryRow("Other", "Workshop", "FireProofMachine"),
  makeMachineryRow("Other", "Workshop", "Weldingmachine"),
  makeMachineryRow("Other", "Workshop", "TagMachine"),
  makeMachineryRow("Other", "Workshop", "Projector", ["0", "42", "0"]),
  makeMachineryRow("Other", "Workshop", "Electricscissors", ["35", "0", "7"], repeatEquipmentDay("5", "", "1")),
  makeMachineryRow("", "", "", ["648", "168", "7"], [["104", "24", "1"], ["93", "15", "1"], ["93", "15", "1"], ["93", "15", "1"], ["92", "16", "1"], ["103", "25", "1"], ["70", "58", "1"]], "total"),
];

const blankRows = (count: number) => Array.from({ length: count }, () => "");
const blankMatrix = (rowCount: number, columnCount: number) => Array.from({ length: rowCount }, () => blankRows(columnCount));
const makeBlankDelayRow = (): DelayAnalysisRow => ({
  task: "",
  wbs: "",
  workFront: "",
  planStart: "",
  actualStart: "",
  planFinish: "",
  actualFinish: "",
  cause1: "",
  cause2: "",
  duration: "",
  engineeringShare: "",
  procurementShare: "",
  constructionShare: "",
  clientShare: "",
  contractorShare: "",
});
const makeDefaultReport = (): WeeklyReportData => ({
  reportNo: "SP2021-ON-OTCC-WR-00083",
  reportDate: todayJalaliDate(),
  periodStart: "",
  periodEnd: "",
  projectTitle: "SOUTH PARS GAS FIELD DEVELOPMENT",
  phases: "PHASES 20 & 21",
  organizationOne: "OIEC",
  organizationTwo: "OTCC",
  location: "Area F, Unit 106",
  hseManHoursSinceLti: "413,141",
  hseManpower: HSE_MANPOWER_NAMES.map(() => ({ last: "", thisWeek: "" })),
  hseIndicators: HSE_INDICATOR_NAMES.map((_, index) => ({
    last: "",
    thisWeek: "",
    upToNow: "",
    cumulativeMode: index === 9 ? "manual" : "sum",
  })),
  hseConcerns: blankRows(7),
  hseActions: blankRows(7),
  keyMilestones: Array.from({ length: KEY_MILESTONE_ROW_COUNT }, (_, index) => ({
    division: index === 0 ? "CIV" : "",
    unit: index === 0 ? "100" : "",
    task: index === 0 ? "Slug Catcher Foundation" : "",
    planStart: "",
    planFinish: "",
    actualStart: "",
    actualFinish: "",
  })),
  availableWorkFronts: Array.from({ length: WORK_FRONT_ROW_COUNT }, () => ({ task: "", location: "", quantity: "" })),
  nextWeekActivities: Array.from({ length: WORK_FRONT_ROW_COUNT }, () => ({ task: "", location: "", quantity: "" })),
  sCurveWeeks: [],
  delayCauseColumns: [
    {
      heading: "Management",
      causeLabels: ["Primary Cause", null, "Primary Cause", "Secondary Cause", "Secondary Cause", null, "Sub-Category", "Primary Cause", "Primary Cause", "Secondary Cause", "Secondary Cause"],
      lowerLabel: "DWG",
    },
    { heading: "People", causeLabels: [], lowerLabel: "Material" },
    { heading: "Equipment", causeLabels: [], lowerLabel: "" },
    { heading: "Work Process", causeLabels: [], lowerLabel: "" },
  ],
  delayAnalysisRows: Array.from({ length: DELAY_ANALYSIS_ROW_COUNT }, makeBlankDelayRow),
  directManpowerRows: DIRECT_MANPOWER_ROWS.map((row) => ({ ...row, values: [...row.values] })),
  indirectManpowerRows: INDIRECT_MANPOWER_ROWS.map((row) => ({ ...row, values: [...row.values] })),
  machineryPageOneRows: MACHINERY_PAGE_ONE_ROWS.map((row) => ({ ...row, values: [...row.values] })),
  machineryPageTwoRows: MACHINERY_PAGE_TWO_ROWS.map((row) => ({ ...row, values: [...row.values] })),
  consumingMaterialRows: blankMatrix(CONSUMING_MATERIAL_ROW_COUNT, 8),
  durableMaterialRows: blankMatrix(DURABLE_MATERIAL_ROW_COUNT, 26),
  engineeringDocumentRows: blankMatrix(ENGINEERING_DOCUMENT_ROW_COUNT, 6),
  sitePhotos: Array.from({ length: SITE_PHOTO_COUNT }, (_, index) => ({ image: "", label: index === 0 ? "121-D-101" : "" })),
  projectProgressValues: blankMatrix(PROJECT_PROGRESS_ROWS.length, PROJECT_PROGRESS_VALUE_COUNT),
  summaryProgressValues: blankMatrix(SUMMARY_DISCIPLINES.length, SUMMARY_PROGRESS_VALUE_COUNT),
  workVolumeValues: blankMatrix(WORK_VOLUME_TASKS.length, WORK_VOLUME_VALUE_COUNT),
  performedWorks: Array.from({ length: NARRATIVE_WORK_ROW_COUNT }, () => ({ task: "", location: "" })),
  narrativeConcerns: blankRows(8),
});

function normalizeStoredReport(value: unknown): WeeklyReportData {
  const defaults = makeDefaultReport();
  if (!value || typeof value !== "object") return defaults;
  const stored = value as Record<string, unknown>;
  const readString = (key: string, fallback: string): string =>
    typeof stored[key] === "string" ? stored[key] as string : fallback;
  const readArray = (key: string): unknown[] => Array.isArray(stored[key]) ? stored[key] as unknown[] : [];
  const objectAt = (rows: unknown[], index: number): Record<string, unknown> => {
    const row = rows[index];
    return row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : {};
  };
  const stringRows = (key: string, fallback: string[]): string[] => {
    const rows = readArray(key);
    return fallback.map((value, index) => typeof rows[index] === "string" ? rows[index] as string : value);
  };
  const stringMatrix = (key: string, fallback: string[][]): string[][] => {
    const rows = readArray(key);
    return fallback.map((fallbackRow, rowIndex) => {
      const storedRow = Array.isArray(rows[rowIndex]) ? rows[rowIndex] as unknown[] : [];
      return fallbackRow.map((value, columnIndex) => typeof storedRow[columnIndex] === "string" ? storedRow[columnIndex] as string : value);
    });
  };
  const normalizeManpowerRows = (rows: unknown[], fallback: ManpowerTableRow[]): ManpowerTableRow[] =>
    fallback.map((defaultRow, index) => {
      const row = objectAt(rows, index);
      const values = Array.isArray(row.values) ? row.values as unknown[] : [];
      return {
        description: typeof row.description === "string" ? row.description : defaultRow.description,
        kind: defaultRow.kind,
        values: defaultRow.values.map((value, valueIndex) => typeof values[valueIndex] === "string" ? values[valueIndex] as string : value),
      };
    });
  const normalizeMachineryRows = (rows: unknown[], fallback: MachineryEquipmentRow[]): MachineryEquipmentRow[] =>
    fallback.map((defaultRow, index) => {
      const row = objectAt(rows, index);
      const values = Array.isArray(row.values) ? row.values as unknown[] : [];
      return {
        ...defaultRow,
        description: typeof row.description === "string" ? row.description : defaultRow.description,
        values: defaultRow.values.map((value, valueIndex) => typeof values[valueIndex] === "string" ? values[valueIndex] as string : value),
      };
    });

  const storedManpower = readArray("hseManpower");
  const storedIndicators = readArray("hseIndicators");
  const storedMilestones = readArray("keyMilestones");
  const storedAvailableWorkFronts = readArray("availableWorkFronts");
  const storedNextWeekActivities = readArray("nextWeekActivities");
  const storedSCurveWeeks = readArray("sCurveWeeks");
  const storedDelayCauseColumns = readArray("delayCauseColumns");
  const storedDelayAnalysisRows = readArray("delayAnalysisRows");
  const storedDirectManpowerRows = readArray("directManpowerRows");
  const storedIndirectManpowerRows = readArray("indirectManpowerRows");
  const storedMachineryPageOneRows = readArray("machineryPageOneRows");
  const storedMachineryPageTwoRows = readArray("machineryPageTwoRows");
  const storedSitePhotos = readArray("sitePhotos");
  const storedWorks = readArray("performedWorks");

  // Clamp persisted rows to the configured row counts for each sheet.
  return {
    reportNo: readString("reportNo", defaults.reportNo),
    reportDate: normalizeJalaliDate(readString("reportDate", defaults.reportDate), defaults.reportDate),
    periodStart: readString("periodStart", defaults.periodStart),
    periodEnd: readString("periodEnd", defaults.periodEnd),
    projectTitle: readString("projectTitle", defaults.projectTitle),
    phases: readString("phases", defaults.phases),
    organizationOne: readString("organizationOne", defaults.organizationOne),
    organizationTwo: readString("organizationTwo", defaults.organizationTwo),
    location: readString("location", defaults.location),
    hseManHoursSinceLti: readString("hseManHoursSinceLti", defaults.hseManHoursSinceLti),
    hseManpower: defaults.hseManpower.map((fallback, index) => {
      const row = objectAt(storedManpower, index);
      return {
        last: typeof row.last === "string" ? row.last : fallback.last,
        thisWeek: typeof row.thisWeek === "string" ? row.thisWeek : fallback.thisWeek,
      };
    }),
    hseIndicators: defaults.hseIndicators.map((fallback, index) => {
      const row = objectAt(storedIndicators, index);
      return {
        last: typeof row.last === "string" ? row.last : fallback.last,
        thisWeek: typeof row.thisWeek === "string" ? row.thisWeek : fallback.thisWeek,
        upToNow: typeof row.upToNow === "string" ? row.upToNow : fallback.upToNow,
        cumulativeMode: fallback.cumulativeMode,
      };
    }),
    hseConcerns: stringRows("hseConcerns", defaults.hseConcerns),
    hseActions: stringRows("hseActions", defaults.hseActions),
    keyMilestones: defaults.keyMilestones.map((fallback, index) => {
      const row = objectAt(storedMilestones, index);
      return {
        division: typeof row.division === "string" ? row.division : fallback.division,
        unit: typeof row.unit === "string" ? row.unit : fallback.unit,
        task: typeof row.task === "string" ? row.task : fallback.task,
        planStart: typeof row.planStart === "string" ? row.planStart : fallback.planStart,
        planFinish: typeof row.planFinish === "string" ? row.planFinish : fallback.planFinish,
        actualStart: typeof row.actualStart === "string" ? row.actualStart : fallback.actualStart,
        actualFinish: typeof row.actualFinish === "string" ? row.actualFinish : fallback.actualFinish,
      };
    }),
    availableWorkFronts: defaults.availableWorkFronts.map((fallback, index) => {
      const row = objectAt(storedAvailableWorkFronts, index);
      return {
        task: typeof row.task === "string" ? row.task : fallback.task,
        location: typeof row.location === "string" ? row.location : fallback.location,
        quantity: typeof row.quantity === "string" ? row.quantity : fallback.quantity,
      };
    }),
    nextWeekActivities: defaults.nextWeekActivities.map((fallback, index) => {
      const row = objectAt(storedNextWeekActivities, index);
      return {
        task: typeof row.task === "string" ? row.task : fallback.task,
        location: typeof row.location === "string" ? row.location : fallback.location,
        quantity: typeof row.quantity === "string" ? row.quantity : fallback.quantity,
      };
    }),
    sCurveWeeks: storedSCurveWeeks.map((_, index) => {
      const row = objectAt(storedSCurveWeeks, index);
      return {
        week: typeof row.week === "string" ? row.week : String(index + 1),
        weeklyPlan: typeof row.weeklyPlan === "string" ? row.weeklyPlan : "",
        cumulativePlan: typeof row.cumulativePlan === "string" ? row.cumulativePlan : "",
        weeklyActual: typeof row.weeklyActual === "string" ? row.weeklyActual : "",
        cumulativeActual: typeof row.cumulativeActual === "string" ? row.cumulativeActual : "",
      };
    }),
    delayCauseColumns: defaults.delayCauseColumns.map((fallback, index) => {
      const row = objectAt(storedDelayCauseColumns, index);
      const causeLabels = Array.isArray(row.causeLabels)
        ? row.causeLabels.map((label) => typeof label === "string" || label === null ? label : "")
        : fallback.causeLabels;
      return {
        heading: typeof row.heading === "string" ? row.heading : fallback.heading,
        causeLabels,
        lowerLabel: typeof row.lowerLabel === "string" ? row.lowerLabel : fallback.lowerLabel,
      };
    }),
    delayAnalysisRows: defaults.delayAnalysisRows.map((fallback, index) => {
      const row = objectAt(storedDelayAnalysisRows, index);
      return {
        task: typeof row.task === "string" ? row.task : fallback.task,
        wbs: typeof row.wbs === "string" ? row.wbs : fallback.wbs,
        workFront: typeof row.workFront === "string" ? row.workFront : fallback.workFront,
        planStart: typeof row.planStart === "string" ? row.planStart : fallback.planStart,
        actualStart: typeof row.actualStart === "string" ? row.actualStart : fallback.actualStart,
        planFinish: typeof row.planFinish === "string" ? row.planFinish : fallback.planFinish,
        actualFinish: typeof row.actualFinish === "string" ? row.actualFinish : fallback.actualFinish,
        cause1: typeof row.cause1 === "string" ? row.cause1 : fallback.cause1,
        cause2: typeof row.cause2 === "string" ? row.cause2 : fallback.cause2,
        duration: typeof row.duration === "string" ? row.duration : fallback.duration,
        engineeringShare: typeof row.engineeringShare === "string" ? row.engineeringShare : fallback.engineeringShare,
        procurementShare: typeof row.procurementShare === "string" ? row.procurementShare : fallback.procurementShare,
        constructionShare: typeof row.constructionShare === "string" ? row.constructionShare : fallback.constructionShare,
        clientShare: typeof row.clientShare === "string" ? row.clientShare : fallback.clientShare,
        contractorShare: typeof row.contractorShare === "string" ? row.contractorShare : fallback.contractorShare,
      };
    }),
    directManpowerRows: normalizeManpowerRows(storedDirectManpowerRows, defaults.directManpowerRows),
    indirectManpowerRows: normalizeManpowerRows(storedIndirectManpowerRows, defaults.indirectManpowerRows),
    machineryPageOneRows: normalizeMachineryRows(storedMachineryPageOneRows, defaults.machineryPageOneRows),
    machineryPageTwoRows: normalizeMachineryRows(storedMachineryPageTwoRows, defaults.machineryPageTwoRows),
    consumingMaterialRows: stringMatrix("consumingMaterialRows", defaults.consumingMaterialRows),
    durableMaterialRows: stringMatrix("durableMaterialRows", defaults.durableMaterialRows),
    engineeringDocumentRows: stringMatrix("engineeringDocumentRows", defaults.engineeringDocumentRows),
    sitePhotos: defaults.sitePhotos.map((fallback, index) => {
      const row = objectAt(storedSitePhotos, index);
      return {
        image: typeof row.image === "string" ? row.image : fallback.image,
        label: typeof row.label === "string" ? row.label : fallback.label,
      };
    }),
    projectProgressValues: stringMatrix("projectProgressValues", defaults.projectProgressValues),
    summaryProgressValues: stringMatrix("summaryProgressValues", defaults.summaryProgressValues),
    workVolumeValues: stringMatrix("workVolumeValues", defaults.workVolumeValues),
    performedWorks: defaults.performedWorks.map((fallback, index) => {
      const row = objectAt(storedWorks, index);
      return {
        task: typeof row.task === "string" ? row.task : fallback.task,
        location: typeof row.location === "string" ? row.location : fallback.location,
      };
    }),
    narrativeConcerns: stringRows("narrativeConcerns", defaults.narrativeConcerns),
  };
}

function CoverText({
  value,
  onChange,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full min-w-0 border-0 bg-transparent p-0 text-center text-inherit outline-none focus:bg-white/30 ${className}`}
    />
  );
}

function WeeklyReportDatePicker({
  value,
  rtl,
  onChange,
}: {
  value: string;
  rtl: boolean;
  onChange: (value: string) => void;
}) {
  const initialValue = normalizeJalaliDate(value, todayJalaliDate());
  const initialParts = parseJalaliDate(initialValue) ?? parseJalaliDate(todayJalaliDate())!;
  const [dateText, setDateText] = useState(initialValue);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState(initialParts.year);
  const [calendarMonth, setCalendarMonth] = useState(initialParts.month);
  const [error, setError] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const normalized = normalizeJalaliDate(value, todayJalaliDate());
    setDateText(normalized);
    const selected = parseJalaliDate(normalized);
    if (selected) {
      setCalendarYear(selected.year);
      setCalendarMonth(selected.month);
    }
    setError("");
  }, [value]);

  useEffect(() => {
    if (!calendarOpen) return;
    const dismissOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setCalendarOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCalendarOpen(false);
    };
    document.addEventListener("pointerdown", dismissOnOutsideClick);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutsideClick);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [calendarOpen]);

  const commitDate = (rawValue = dateText) => {
    const normalized = normalizeJalaliDate(rawValue);
    if (!parseJalaliDate(normalized)) {
      setError(rtl ? "تاریخ باید شمسی و به‌شکل سال/ماه/روز باشد." : "Enter a valid Jalali date as year/month/day.");
      return;
    }
    setDateText(normalized);
    setError("");
    onChange(normalized);
  };
  const chooseDate = (selected: string) => {
    setDateText(selected);
    setError("");
    onChange(selected);
    setCalendarOpen(false);
  };
  const toggleCalendar = () => {
    if (!calendarOpen) {
      const selected = parseJalaliDate(dateText) ?? parseJalaliDate(value) ?? parseJalaliDate(todayJalaliDate())!;
      setCalendarYear(selected.year);
      setCalendarMonth(selected.month);
    }
    setCalendarOpen((open) => !open);
  };
  const shiftCalendarMonth = (offset: number) => {
    const totalMonths = calendarYear * 12 + calendarMonth - 1 + offset;
    const nextYear = Math.floor(totalMonths / 12);
    if (nextYear < 1300 || nextYear > 1500) return;
    setCalendarYear(nextYear);
    setCalendarMonth((totalMonths % 12) + 1);
  };

  const firstDay = toGregorian(calendarYear, calendarMonth, 1);
  const weekday = new Date(Date.UTC(firstDay.gy, firstDay.gm - 1, firstDay.gd)).getUTCDay();
  const offsetFromSaturday = (weekday + 1) % 7;
  const calendarCells: Array<number | null> = Array.from({ length: offsetFromSaturday }, () => null);
  for (let day = 1; day <= jalaaliMonthLength(calendarYear, calendarMonth); day += 1) calendarCells.push(day);
  const selectedDate = normalizeJalaliDate(value);
  const today = todayJalaliDate();
  const weekdayNames = rtl ? JALALI_WEEKDAYS_FA : JALALI_WEEKDAYS_EN;
  const monthNames = rtl ? JALALI_MONTHS_FA : JALALI_MONTHS_EN;

  return (
    <div ref={pickerRef} className="relative" dir="ltr">
      <div className="flex h-7 items-center rounded-lg border b-line-soft bg-black/20 px-1">
        <input
          aria-label={rtl ? "تاریخ شمسی گزارش" : "Jalali report date"}
          aria-invalid={Boolean(error)}
          value={rtl ? toPersianDigits(dateText) : dateText}
          dir="ltr"
          onChange={(event) => { setDateText(toAsciiDigits(event.target.value)); setError(""); }}
          onBlur={() => commitDate()}
          onKeyDown={(event) => { if (event.key === "Enter") commitDate(); }}
          placeholder={rtl ? "۱۴۰۵/۰۷/۱۱" : "1405/07/11"}
          className={`w-28 bg-transparent px-2 py-1 text-center tabular-nums tx1 outline-none ${error ? "text-rose-300" : ""}`}
        />
        <button
          type="button"
          aria-label={rtl ? "انتخاب تاریخ از تقویم فارسی" : "Choose Jalali date from calendar"}
          aria-haspopup="dialog"
          aria-expanded={calendarOpen}
          title={rtl ? "انتخاب تاریخ از تقویم فارسی" : "Choose Jalali date from calendar"}
          onClick={toggleCalendar}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-sky-200 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-1 focus:ring-sky-300"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
          </svg>
        </button>
      </div>
      {error && <span role="alert" className="absolute top-full z-50 mt-0.5 whitespace-nowrap text-[8px] text-rose-300">{error}</span>}
      {calendarOpen && (
        <div
          role="dialog"
          aria-label={rtl ? "تقویم انتخاب تاریخ گزارش" : "Report date calendar"}
          dir={rtl ? "rtl" : "ltr"}
          className={`absolute top-full z-[80] mt-1 w-[264px] rounded-xl border b-line-soft bg-[#101827] p-2.5 text-[10px] shadow-2xl ${rtl ? "right-0" : "left-0"}`}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <button type="button" aria-label={rtl ? "ماه قبل" : "Previous month"} disabled={calendarYear === 1300 && calendarMonth === 1} onClick={() => shiftCalendarMonth(-1)} className="grid h-7 w-7 place-items-center rounded-lg border b-line-soft tx2 transition hover:bg-white/10 disabled:opacity-30">{rtl ? "›" : "‹"}</button>
            <div className="font-semibold tx1">{rtl ? `${monthNames[calendarMonth - 1]} ${toPersianDigits(String(calendarYear))}` : `${monthNames[calendarMonth - 1]} ${calendarYear}`}</div>
            <button type="button" aria-label={rtl ? "ماه بعد" : "Next month"} disabled={calendarYear === 1500 && calendarMonth === 12} onClick={() => shiftCalendarMonth(1)} className="grid h-7 w-7 place-items-center rounded-lg border b-line-soft tx2 transition hover:bg-white/10 disabled:opacity-30">{rtl ? "‹" : "›"}</button>
          </div>
          <div className="grid grid-cols-7 text-center tx4">
            {weekdayNames.map((name, index) => <span key={`${name}-${index}`} className="py-1.5 font-medium">{name}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calendarCells.map((day, index) => {
              if (day === null) return <span key={`empty-${index}`} aria-hidden="true" className="h-8" />;
              const dayDate = formatJalaliDate({ year: calendarYear, month: calendarMonth, day });
              const isSelected = selectedDate === dayDate;
              const isToday = today === dayDate;
              return (
                <button key={dayDate} type="button" aria-current={isToday ? "date" : undefined} aria-label={`${rtl ? "انتخاب" : "Select"} ${rtl ? toPersianDigits(dayDate) : dayDate}`} onClick={() => chooseDate(dayDate)} className={`relative h-8 rounded-md text-center transition hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-sky-300 ${isSelected ? "bg-sky-500/30 font-semibold text-sky-100" : "tx1"} ${isToday && !isSelected ? "ring-1 ring-inset ring-amber-300/70" : ""}`}>
                  {rtl ? toPersianDigits(String(day)) : day}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t b-line-soft pt-1.5">
            <span className="text-[9px] tx4">{rtl ? "تقویم شمسی" : "Jalali calendar"}</span>
            <button type="button" onClick={() => chooseDate(today)} className="rounded-md px-2 py-1 text-[9px] text-sky-200 hover:bg-white/10">{rtl ? "امروز" : "Today"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyCoverSheet({
  report,
  rtl,
  update,
}: {
  report: WeeklyReportData;
  rtl: boolean;
  update: (next: WeeklyReportData) => void;
}) {
  const dateParts = parseJalaliDate(report.reportDate);
  const year = dateParts ? String(dateParts.year) : "—";
  const monthNumber = dateParts ? String(dateParts.month).padStart(2, "0") : "—";
  const day = dateParts ? String(dateParts.day).padStart(2, "0") : "—";
  const monthIndex = dateParts ? dateParts.month - 1 : -1;
  const monthEn = JALALI_MONTHS_EN[monthIndex] ?? "—";
  const monthFa = JALALI_MONTHS_FA[monthIndex] ?? "—";
  const monthNumberText = rtl ? toPersianDigits(monthNumber) : monthNumber;
  const dayText = rtl ? toPersianDigits(day) : day;
  const yearText = rtl ? toPersianDigits(year) : year;

  return (
    <article
      id="weekly-report-print-root"
      aria-label={rtl ? "کاور گزارش هفتگی" : "Weekly report cover"}
      className="weekly-report-sheet relative mx-auto aspect-[210/297] w-full min-w-[520px] max-w-[760px] overflow-hidden border-2 border-[#0000ff] bg-[#f3f6fa] text-[#172b3f] shadow-xl print:aspect-auto print:h-[297mm] print:w-[210mm] print:min-w-0 print:max-w-none print:shadow-none"
      dir="ltr"
    >
      <div className="absolute inset-y-0 left-0 w-[23%] bg-[#eef3f8]" />
      <div className="absolute left-0 top-[31%] grid w-[23%] grid-cols-2">
        <div className="aspect-square bg-[#82a8c5]" />
        <div className="aspect-square bg-transparent" />
        <div className="aspect-square bg-[#507da3]" />
        <div className="aspect-square bg-[#82a8c5]" />
        <div className="aspect-square bg-[#82a8c5]" />
        <div className="aspect-square bg-[#507da3]" />
        <div className="aspect-square bg-transparent" />
        <div className="aspect-square bg-[#82a8c5]" />
      </div>

      <div className="absolute left-[23%] top-[3.5%] w-[77%] px-3 text-center font-sans">
        <CoverText
          ariaLabel={rtl ? "عنوان پروژه" : "Project title"}
          value={report.projectTitle}
          onChange={(value) => update({ ...report, projectTitle: value })}
          className="text-[clamp(12px,2vw,19px)] font-medium"
        />
        <CoverText
          ariaLabel={rtl ? "فازهای پروژه" : "Project phases"}
          value={report.phases}
          onChange={(value) => update({ ...report, phases: value })}
          className="mt-[2.2%] text-[clamp(12px,1.9vw,17px)] font-semibold"
        />
      </div>

      <div className="absolute left-[23%] top-[41.5%] w-[77%] px-3 text-center font-sans">
        <div className="text-[clamp(13px,2.1vw,19px)] font-bold tracking-[0.09em] text-[#183b5b]">WEEKLY REPORT</div>
        <div className="mt-2 flex items-center justify-center gap-1 text-[clamp(10px,1.6vw,14px)]">
          <span>NO.</span>
          <CoverText
            ariaLabel={rtl ? "شماره گزارش" : "Report number"}
            value={report.reportNo}
            onChange={(value) => update({ ...report, reportNo: value })}
            className="w-auto max-w-[72%] text-start"
          />
        </div>
        {(report.periodStart || report.periodEnd) && (
          <div className="mt-1 font-sans text-[clamp(8px,1.1vw,10px)]">
            {rtl ? "دوره گزارش:" : "Reporting period:"} {report.periodStart || "—"} – {report.periodEnd || "—"}
          </div>
        )}
        <CoverText
          ariaLabel={rtl ? "سازمان اول" : "First organization"}
          value={report.organizationOne}
          onChange={(value) => update({ ...report, organizationOne: value })}
          className="mt-[6.5%] text-[clamp(10px,1.5vw,14px)]"
        />
        <CoverText
          ariaLabel={rtl ? "سازمان دوم" : "Second organization"}
          value={report.organizationTwo}
          onChange={(value) => update({ ...report, organizationTwo: value })}
          className="mt-[2.2%] text-[clamp(10px,1.5vw,14px)]"
        />
        <CoverText
          ariaLabel={rtl ? "ناحیه و واحد" : "Area and unit"}
          value={report.location}
          onChange={(value) => update({ ...report, location: value })}
          className="mt-[2.2%] text-[clamp(10px,1.5vw,14px)]"
        />
      </div>

      <div className="absolute bottom-[10%] left-[61%] flex items-stretch gap-1 font-sans">
        <div className="flex w-[clamp(58px,12vw,96px)] flex-col items-center justify-center border border-[#cbd5e1] bg-white/80 px-2 py-1">
          <span className="text-[clamp(10px,1.3vw,14px)]">{monthNumberText}</span>
          <span className="text-[clamp(30px,5vw,48px)] leading-none">{dayText}</span>
        </div>
        <div className="flex min-w-0 flex-col justify-center text-[clamp(12px,1.9vw,18px)]">
          <span className="font-bold">{rtl ? monthFa : monthEn}</span>
          <span className="mt-1">{yearText}</span>
        </div>
      </div>
    </article>
  );
}

function WeeklySheet({
  title,
  children,
  dense = false,
  landscape = false,
  fullBleed = false,
  widerContent = false,
  printRoot = true,
  compactHeader = false,
  showTitleBanner = true,
}: {
  title: string;
  children: ReactNode;
  dense?: boolean;
  landscape?: boolean;
  fullBleed?: boolean;
  widerContent?: boolean;
  printRoot?: boolean;
  compactHeader?: boolean;
  showTitleBanner?: boolean;
}) {
  const pageLayout = landscape
    ? "aspect-[297/210] min-w-[640px] max-w-[1000px] print:aspect-auto print:h-[210mm] print:w-[297mm]"
    : "aspect-[210/297] min-w-[520px] max-w-[760px] print:aspect-auto print:h-[297mm] print:w-[210mm]";
  const contentSpacing = !showTitleBanner
    ? "p-0"
    : compactHeader
      ? "pb-[1%] pt-[0.7%]"
      : landscape
        ? "pb-[2.5%] pt-[1.8%]"
        : dense
          ? "pb-[1%] pt-[1.6%] print:pb-[4.5%]"
          : "pb-[3%] pt-[2.4%]";
  const contentInset = fullBleed ? "px-0" : widerContent ? "px-[2%]" : "px-[5.6%]";
  const headerHeight = !showTitleBanner ? "h-0" : compactHeader ? "h-[8.3%]" : landscape ? "h-[16.2%]" : "h-[10.2%]";
  const bodyTop = !showTitleBanner ? "top-0" : compactHeader ? "top-[8.3%]" : landscape ? "top-[16.2%]" : "top-[10.2%]";
  const mosaicWidth = compactHeader ? "w-[30%]" : landscape ? "w-[16.3%]" : "w-[25%]";
  const mosaicColumns = compactHeader ? "grid-cols-[7fr_3fr]" : "grid-cols-2";
  const mosaicRows = landscape ? "grid-rows-[2fr_1fr]" : "grid-rows-2";

  return (
    <article
      id={printRoot ? "weekly-report-print-root" : undefined}
      aria-label={title}
      className={`weekly-report-sheet relative mx-auto w-full overflow-hidden border-2 border-[#0000ff] bg-[#eef0f2] text-[#152536] shadow-xl ${pageLayout} print:min-w-0 print:max-w-none print:shadow-none ${landscape ? "weekly-report-landscape" : ""}`}
      dir="ltr"
    >
      {showTitleBanner && (
        <div className={`absolute inset-x-0 top-0 ${headerHeight} border border-black bg-[#c7dcf0]`}>
          <div className={`absolute inset-y-0 left-0 grid ${mosaicColumns} ${mosaicRows} ${mosaicWidth}`}>
            <div className="bg-[#91afd0]" />
            <div className="bg-[#c7dcf0]" />
            <div className="bg-[#c7dcf0]" />
            <div className="bg-[#91afd0]" />
          </div>
          <h1 className="weekly-report-page-title absolute inset-0 flex items-center justify-center text-center text-[clamp(16px,2.2vw,21px)] font-medium tracking-[0.015em] text-[#152536]">
            {title}
          </h1>
        </div>
      )}
      <div className={`absolute inset-x-0 bottom-0 ${bodyTop} overflow-hidden bg-[#eef0f2] ${contentInset} ${contentSpacing}`}>
        {children}
      </div>
    </article>
  );
}

function WeeklyIndexSheet() {
  return (
    <WeeklySheet title="INDEX">
      <div className="space-y-[clamp(10px,2.1vw,16px)] ps-[6.5%] pt-[2%] font-sans text-[clamp(12px,1.8vw,14px)] leading-[1.4] font-medium text-[#152536]">
        {INDEX_ITEMS.map((item) => <div key={item}>{item}</div>)}
      </div>
    </WeeklySheet>
  );
}

function normalizedNumber(value: string): number {
  const western = value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[٬,\s]/g, "");
  const parsed = Number(western);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumValues(left: string, right: string): string {
  if (!left.trim() && !right.trim()) return "";
  return (normalizedNumber(left) + normalizedNumber(right)).toLocaleString("en-US");
}

function parseSPercent(value: string): number | null {
  const western = value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[٬,%٪\s]/g, "");
  if (!western) return null;
  const parsed = Number(western);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSPercent(value: number): string {
  return Number(value.toFixed(2)).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function cumulativeSCurveValues(
  rows: SCurveWeekRow[],
  weeklyField: "weeklyPlan" | "weeklyActual",
  cumulativeField: "cumulativePlan" | "cumulativeActual",
): (number | null)[] {
  let total = 0;
  let hasValue = false;
  return rows.map((row) => {
    const cumulative = parseSPercent(row[cumulativeField]);
    if (cumulative !== null) {
      total = cumulative;
      hasValue = true;
      return total;
    }
    const weekly = parseSPercent(row[weeklyField]);
    if (weekly !== null) {
      total += weekly;
      hasValue = true;
      return total;
    }
    return hasValue ? total : null;
  });
}

function parseSCurvePaste(text: string): SCurveWeekRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((cell) => cell.trim()))
    .filter((line) => line.some((cell) => cell !== ""));
  if (lines.length === 0) return [];

  const compact = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
  const rowKind = (label: string): "weeklyPlan" | "cumulativePlan" | "weeklyActual" | "cumulativeActual" | null => {
    const normalized = compact(label);
    const isCumulative = normalized.includes("cumulative") || normalized.includes("cum");
    const isPlan = normalized.includes("plan");
    const isActual = normalized.includes("actual");
    if (isPlan && isCumulative) return "cumulativePlan";
    if (isActual && isCumulative) return "cumulativeActual";
    if (isPlan && normalized.includes("weekly")) return "weeklyPlan";
    if (isActual && normalized.includes("weekly")) return "weeklyActual";
    return null;
  };

  const horizontalRows = new Map<NonNullable<ReturnType<typeof rowKind>>, string[]>();
  lines.forEach((line) => {
    const kind = rowKind(line[0] ?? "");
    if (kind) horizontalRows.set(kind, line);
  });
  if (horizontalRows.has("weeklyPlan") || horizontalRows.has("weeklyActual")) {
    const periodHeaders = lines.find((line) => !rowKind(line[0] ?? "")) ?? [];
    const periodCount = Math.max(0, ...lines.map((line) => line.length - 1));
    return Array.from({ length: periodCount }, (_, index) => {
      const column = index + 1;
      return {
        week: periodHeaders[column] || String(index + 1),
        weeklyPlan: horizontalRows.get("weeklyPlan")?.[column] ?? "",
        cumulativePlan: horizontalRows.get("cumulativePlan")?.[column] ?? "",
        weeklyActual: horizontalRows.get("weeklyActual")?.[column] ?? "",
        cumulativeActual: horizontalRows.get("cumulativeActual")?.[column] ?? "",
      };
    }).filter((row) => row.weeklyPlan || row.cumulativePlan || row.weeklyActual || row.cumulativeActual);
  }

  const headerIndex = lines.findIndex((line) => {
    const labels = line.map(compact);
    const hasPlan = labels.some((label) => label.includes("weekly") && label.includes("plan"));
    const hasActual = labels.some((label) => label.includes("weekly") && label.includes("actual"));
    const hasPeriod = labels.some((label) => /week|period|date/.test(label));
    return hasPlan && hasActual && hasPeriod;
  });
  const headers = headerIndex >= 0 ? lines[headerIndex].map(compact) : [];
  const headerColumn = (predicate: (label: string) => boolean) => headers.findIndex(predicate);
  const periodColumn = headerColumn((label) => /week|period|date/.test(label));
  const weeklyPlanColumn = headerColumn((label) => label.includes("weekly") && label.includes("plan"));
  const cumulativePlanColumn = headerColumn((label) => (label.includes("cumulative") || label.includes("cum")) && label.includes("plan"));
  const weeklyActualColumn = headerColumn((label) => label.includes("weekly") && label.includes("actual"));
  const cumulativeActualColumn = headerColumn((label) => (label.includes("cumulative") || label.includes("cum")) && label.includes("actual"));
  const hasHeader = headerIndex >= 0;
  const firstDataLine = hasHeader ? headerIndex + 1 : 0;

  return lines.slice(firstDataLine).map((line, index) => {
    const week = hasHeader ? periodColumn : 0;
    const weeklyPlan = hasHeader ? weeklyPlanColumn : 1;
    const cumulativePlan = hasHeader ? cumulativePlanColumn : (line.length >= 5 ? 2 : -1);
    const weeklyActual = hasHeader ? weeklyActualColumn : (line.length >= 5 ? 3 : 2);
    const cumulativeActual = hasHeader ? cumulativeActualColumn : (line.length >= 5 ? 4 : -1);
    return {
      week: line[week] || String(index + 1),
      weeklyPlan: weeklyPlan >= 0 ? line[weeklyPlan] ?? "" : "",
      cumulativePlan: cumulativePlan >= 0 ? line[cumulativePlan] ?? "" : "",
      weeklyActual: weeklyActual >= 0 ? line[weeklyActual] ?? "" : "",
      cumulativeActual: cumulativeActual >= 0 ? line[cumulativeActual] ?? "" : "",
    };
  }).filter((row) => row.weeklyPlan || row.cumulativePlan || row.weeklyActual || row.cumulativeActual);
}

function timelineDay(value: string): number | null {
  const western = value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
  const parts = western.match(/\d+/g)?.map(Number) ?? [];
  if (parts.length === 0) return null;
  const day = parts[0] > 31 ? parts.slice(1).at(-1) : parts[0];
  return day !== undefined && day >= 1 && day <= 31 ? day : null;
}

function SheetInput({

  value,
  onChange,
  ariaLabel,
  numeric = false,
  centered = false,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  numeric?: boolean;
  centered?: boolean;
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      inputMode={numeric ? "decimal" : "text"}
      onChange={(event) => onChange(event.target.value)}
      className={`h-full min-h-[16px] w-full min-w-0 border-0 bg-transparent px-1 py-0 text-[9px] font-medium text-[#152536] outline-none focus:bg-[#e7f0f8] ${numeric || centered ? "text-center" : "text-start"} ${numeric ? "tabular-nums" : ""}`}
    />
  );
}

function SectionBand({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[20px] items-center justify-center border-y border-[#b7c7d5] bg-[#dce7f0] px-1 text-center font-sans text-[9.5px] font-semibold text-[#1b4672]">
      {children}
    </div>
  );
}

function BlankRowsSection({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: string[];
  onChange: (index: number, value: string) => void;
}) {
  return (
    <section className="shrink-0">
      <SectionBand>{title}</SectionBand>
      <table className="w-full table-fixed border-collapse bg-white font-sans text-[9px] text-[#152536]">
        <tbody>
          {rows.map((value, index) => (
            <tr key={`${title}-${index}`} className="h-[18px] odd:bg-white even:bg-[#f7f9fb]">
              <td className="border border-[#b6bec6] px-1 py-0">
                <SheetInput ariaLabel={`${title} row ${index + 1}`} value={value} onChange={(next) => onChange(index, next)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function HseSheet({
  report,
  patchReport,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
}) {
  const table = "w-full table-fixed border-collapse font-sans text-[9.5px] leading-[1.15] text-[#152536]";
  const cell = "border border-[#b6bec6] px-1 py-0 text-start align-middle";
  const headerCell = `${cell} text-center font-semibold text-[#172f46]`;

  return (
    <WeeklySheet title="H.S.E">
      <div className="flex h-full flex-col gap-[16px] overflow-hidden font-sans">
        <div className="flex h-[72px] shrink-0 justify-end">
          <div className="h-full w-[36%] border border-[#aebbc7] bg-white px-2 pt-[10px] text-center text-[#183b5b]">
            <div className="border-b border-[#496b8b] pb-1 text-[11px] font-semibold leading-[18px]">M/H Work Since Last LTI</div>
            <SheetInput
              ariaLabel="Man-hours work since last LTI"
              value={report.hseManHoursSinceLti}
              numeric
              onChange={(value) => patchReport((current) => ({ ...current, hseManHoursSinceLti: value }))}
            />
          </div>
        </div>

        <section className="shrink-0">
          <SectionBand>HSE Man Power (M/H)</SectionBand>
          <table className={table}>
            <colgroup>
              <col style={{ width: "56%" }} />
              <col style={{ width: "14.66%" }} />
              <col style={{ width: "14.66%" }} />
              <col style={{ width: "14.66%" }} />
            </colgroup>
            <thead>
              <tr className="h-[18px] bg-[#edf3f8]">
                <th className={headerCell}>Manpower</th>
                <th className={headerCell}>Up to Last</th>
                <th className={headerCell}>This Week</th>
                <th className={headerCell}>Up to Now</th>
              </tr>
            </thead>
            <tbody>
              {HSE_MANPOWER_NAMES.map((name, index) => {
                const row = report.hseManpower[index];
                return (
                  <tr key={name} className="h-[18px] bg-white even:bg-[#f7f9fb]">
                    <td className={cell}>{name}</td>
                    <td className={cell}><SheetInput ariaLabel={`${name} up to last`} value={row.last} numeric onChange={(value) => patchReport((current) => ({ ...current, hseManpower: current.hseManpower.map((item, rowIndex) => rowIndex === index ? { ...item, last: value } : item) }))} /></td>
                    <td className={cell}><SheetInput ariaLabel={`${name} this week`} value={row.thisWeek} numeric onChange={(value) => patchReport((current) => ({ ...current, hseManpower: current.hseManpower.map((item, rowIndex) => rowIndex === index ? { ...item, thisWeek: value } : item) }))} /></td>
                    <td className={`${cell} text-center font-semibold tabular-nums`}>{sumValues(row.last, row.thisWeek)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="shrink-0">
          <SectionBand>HSE Key Indicators</SectionBand>
          <table className={table}>
            <colgroup>
              <col style={{ width: "55%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead>
              <tr className="h-[18px] bg-[#edf3f8]">
                <th className={headerCell}>Indicator</th>
                <th className={headerCell}>Up to Last</th>
                <th className={headerCell}>This Week</th>
                <th className={headerCell}>Up to Now</th>
              </tr>
            </thead>
            <tbody>
              {HSE_INDICATOR_NAMES.map((name, index) => {
                const row = report.hseIndicators[index];
                const upToNow = row.cumulativeMode === "manual" ? row.upToNow : sumValues(row.last, row.thisWeek);
                return (
                  <tr key={name} className="h-[18px] bg-white even:bg-[#f7f9fb]">
                    <td className={cell}>{name}</td>
                    <td className={cell}><SheetInput ariaLabel={`${name} up to last`} value={row.last} numeric onChange={(value) => patchReport((current) => ({ ...current, hseIndicators: current.hseIndicators.map((item, rowIndex) => rowIndex === index ? { ...item, last: value } : item) }))} /></td>
                    <td className={cell}><SheetInput ariaLabel={`${name} this week`} value={row.thisWeek} numeric onChange={(value) => patchReport((current) => ({ ...current, hseIndicators: current.hseIndicators.map((item, rowIndex) => rowIndex === index ? { ...item, thisWeek: value } : item) }))} /></td>
                    <td className={`${cell} text-center tabular-nums`}>{row.cumulativeMode === "manual" ? <SheetInput ariaLabel={`${name} up to now`} value={upToNow} numeric onChange={(value) => patchReport((current) => ({ ...current, hseIndicators: current.hseIndicators.map((item, rowIndex) => rowIndex === index ? { ...item, upToNow: value } : item) }))} /> : upToNow}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <BlankRowsSection
          title="Area of Concerns"
          rows={report.hseConcerns}
          onChange={(index, value) => patchReport((current) => ({ ...current, hseConcerns: current.hseConcerns.map((row, rowIndex) => rowIndex === index ? value : row) }))}
        />
        <BlankRowsSection
          title="Corrective and Prevention Action"
          rows={report.hseActions}
          onChange={(index, value) => patchReport((current) => ({ ...current, hseActions: current.hseActions.map((row, rowIndex) => rowIndex === index ? value : row) }))}
        />
      </div>
    </WeeklySheet>
  );
}

function NarrativeSheet({
  report,
  patchReport,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
}) {
  const cell = "border border-[#b8b8b8] px-1 py-0 align-middle";
  const headerCell = `${cell} text-center font-semibold text-[#111111]`;
  const narrativeBand = "flex h-[20px] items-center justify-center border-y border-[#a9a9a9] bg-[#c4c4c4] px-1 text-center font-sans text-[10px] font-semibold text-[#1b4672]";

  return (
    <WeeklySheet title="WORK NARRATIVE" dense>
      <div className="relative flex h-full min-h-0 flex-col gap-[12px] overflow-y-auto font-sans">
        <section className="shrink-0">
          <div className={narrativeBand}>Major Performed Works</div>
          <table className="w-full table-fixed border-collapse bg-white font-sans text-[10px] leading-[1.15] text-[#111111]">
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "80%" }} />
            </colgroup>
            {NARRATIVE_WORK_GROUPS.map((group, groupIndex) => {
              const rowStart = NARRATIVE_WORK_GROUPS
                .slice(0, groupIndex)
                .reduce((total, item) => total + item.rowCount, 0);
              return (
                <tbody key={`narrative-group-${groupIndex}`}>
                  <tr className="h-[18px] bg-[#ededed]">
                    <th rowSpan={2} className={headerCell}>Task</th>
                    <th className={headerCell}>{group.title}</th>
                  </tr>
                  <tr className="h-[18px] bg-[#ededed]">
                    <th className={headerCell}>Location</th>
                  </tr>
                  {Array.from({ length: group.rowCount }, (_, rowOffset) => {
                    const index = rowStart + rowOffset;
                    const row = report.performedWorks[index];
                    return (
                      <tr key={`performed-work-${index}`} className="h-[18px] bg-white">
                        <td className={cell}>
                          <SheetInput
                            ariaLabel={`Performed work task ${index + 1}`}
                            value={row.task}
                            onChange={(value) => patchReport((current) => ({
                              ...current,
                              performedWorks: current.performedWorks.map((item, rowIndex) => rowIndex === index ? { ...item, task: value } : item),
                            }))}
                          />
                        </td>
                        <td className={cell}>
                          <SheetInput
                            ariaLabel={`Performed work location ${index + 1}`}
                            value={row.location}
                            onChange={(value) => patchReport((current) => ({
                              ...current,
                              performedWorks: current.performedWorks.map((item, rowIndex) => rowIndex === index ? { ...item, location: value } : item),
                            }))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </section>

        <section className="shrink-0">
          <div className={narrativeBand}>Area Of Concerns</div>
          <table className="w-full table-fixed border-collapse bg-white font-sans text-[9px] text-[#111111]">
            <tbody>
              {report.narrativeConcerns.map((value, index) => (
                <tr key={`narrative-concern-${index}`} className="h-[18px] bg-white">
                  <td className={cell}>
                    <SheetInput
                      ariaLabel={`Area Of Concerns row ${index + 1}`}
                      value={value}
                      onChange={(next) => patchReport((current) => ({
                        ...current,
                        narrativeConcerns: current.narrativeConcerns.map((item, rowIndex) => rowIndex === index ? next : item),
                      }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[44%] z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-sans text-[clamp(48px,10vw,76px)] font-light leading-none text-[#777777]/60 print:hidden"
        >
          Page 1
        </div>
      </div>
    </WeeklySheet>
  );
}

function SummarySheet({
  report,
  patchReport,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
}) {
  const gridCell = "border border-[#b8b8b8] px-1 py-0 align-middle";
  const headingCell = `${gridCell} bg-[#e3e3e3] text-center font-medium text-[#152536]`;
  const band = "flex h-[20px] items-center justify-center border-y border-[#a9a9a9] bg-[#c4c4c4] px-1 text-center font-sans text-[10px] font-semibold text-[#1b4672]";
  const updateProgress = (rowIndex: number, columnIndex: number, value: string) => patchReport((current) => ({
    ...current,
    summaryProgressValues: current.summaryProgressValues.map((row, index) => index === rowIndex ? row.map((cell, cellIndex) => cellIndex === columnIndex ? value : cell) : row),
  }));
  const updateVolume = (rowIndex: number, columnIndex: number, value: string) => patchReport((current) => ({
    ...current,
    workVolumeValues: current.workVolumeValues.map((row, index) => index === rowIndex ? row.map((cell, cellIndex) => cellIndex === columnIndex ? value : cell) : row),
  }));

  return (
    <WeeklySheet title="SUMMARY">
      <div className="flex h-full flex-col gap-[34px] overflow-y-auto font-sans">
        <section className="shrink-0">
          <div className={band}>Work Progress</div>
          <table className="w-full table-fixed border-collapse bg-white font-sans text-[9.5px] leading-[1.15] text-[#152536]">
            <colgroup>
              <col style={{ width: "35.7%" }} />
              <col style={{ width: "7.1%" }} />
              {Array.from({ length: 6 }, (_, index) => <col key={`progress-value-col-${index}`} style={{ width: "7.15%" }} />)}
              <col style={{ width: "14.3%" }} />
            </colgroup>
            <thead>
              <tr className="h-[18px]">
                <th rowSpan={2} className={headingCell}>Discipline</th>
                <th rowSpan={2} className={headingCell}>W.F</th>
                <th colSpan={2} className={headingCell}>Up to Last</th>
                <th colSpan={2} className={headingCell}>This Week</th>
                <th colSpan={2} className={headingCell}>Up to Now</th>
                <th rowSpan={2} className={headingCell}>Variance</th>
              </tr>
              <tr className="h-[18px]">
                {Array.from({ length: 3 }, (_, groupIndex) => (
                  <Fragment key={`progress-subhead-${groupIndex}`}>
                    <th className={headingCell}>P</th>
                    <th className={headingCell}>A</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {SUMMARY_DISCIPLINES.map((discipline, rowIndex) => {
                const isProject = discipline === "Project";
                const values = report.summaryProgressValues[rowIndex] ?? blankRows(SUMMARY_PROGRESS_VALUE_COUNT);
                return (
                  <tr key={discipline} className="h-[18px]">
                    <td className={`${gridCell} ${isProject ? "bg-[#d9d9d9] text-center font-semibold text-[#315d8c]" : "bg-white"}`}>{discipline}</td>
                    {values.map((value, columnIndex) => (
                      <td key={`summary-progress-${rowIndex}-${columnIndex}`} className={`${gridCell} ${isProject ? "bg-[#d9d9d9]" : "bg-white"}`}>
                        <SheetInput
                          ariaLabel={`${discipline} progress value ${columnIndex + 1}`}
                          value={value}
                          centered
                          onChange={(next) => updateProgress(rowIndex, columnIndex, next)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="shrink-0">
          <div className={band}>Work Volume</div>
          <table className="w-full table-fixed border-collapse bg-white font-sans text-[9.5px] leading-[1.15] text-[#152536]">
            <colgroup>
              <col style={{ width: "35.7%" }} />
              <col style={{ width: "7.1%" }} />
              {Array.from({ length: 4 }, (_, index) => <col key={`volume-value-col-${index}`} style={{ width: "14.3%" }} />)}
            </colgroup>
            <thead>
              <tr className="h-[36px]">
                {["Task", "U/M", "Estimate", "Up to Last", "This Week", "Up to Now"].map((heading) => (
                  <th key={heading} className={headingCell}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORK_VOLUME_TASKS.map((task, rowIndex) => {
                const values = report.workVolumeValues[rowIndex] ?? blankRows(WORK_VOLUME_VALUE_COUNT);
                return (
                  <tr key={task} className="h-[18px]">
                    <td className={`${gridCell} bg-white`}>{task}</td>
                    {values.map((value, columnIndex) => (
                      <td key={`work-volume-${rowIndex}-${columnIndex}`} className={`${gridCell} bg-white`}>
                        <SheetInput
                          ariaLabel={`${task} work volume value ${columnIndex + 1}`}
                          value={value}
                          centered
                          onChange={(next) => updateVolume(rowIndex, columnIndex, next)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </WeeklySheet>
  );
}

function ProjectProgressSheet({
  report,
  patchReport,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
}) {
  const valueColumnWidths = [
    "5.5%", "14.1%", "5.3%", "2.6%", "4.8%", "2.5%", "2.5%",
    ...Array.from({ length: 7 }, () => "4.87%"),
    "2.7%", "5.4%", "2.8%", "2.8%", "2.8%", "2.8%", "2.8%", "2.8%", "3.7%",
  ];
  const tableCell = "border border-[#c0c0c0] px-0 py-0 align-middle";
  const headerCell = `${tableCell} bg-[#d7d7d7] px-0.5 text-center text-[clamp(7px,0.8vw,9px)] font-semibold text-[#111111]`;
  const band = "flex h-[clamp(16px,1.8vw,20px)] items-center justify-center border-y border-[#a9a9a9] bg-[#c4c4c4] text-center text-[10px] font-semibold text-[#1b4672]";
  const updateValue = (rowIndex: number, columnIndex: number, value: string) => patchReport((current) => ({
    ...current,
    projectProgressValues: current.projectProgressValues.map((row, index) => index === rowIndex ? row.map((cell, cellIndex) => cellIndex === columnIndex ? value : cell) : row),
  }));
  return (
    <WeeklySheet title="PROJECT PROGRESS" landscape fullBleed>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#e9e9e9] px-[1.2%] font-sans">
        <div className={band}>PMS</div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <table className="h-full w-full table-fixed border-collapse bg-[#e9e9e9] font-sans text-[8px] leading-none text-[#111111]">
            <colgroup>
              {valueColumnWidths.map((width, index) => <col key={`project-progress-col-${index}`} style={{ width }} />)}
            </colgroup>
            <thead>
              <tr className="h-[clamp(14px,1.6vw,18px)]">
                <th rowSpan={2} className={headerCell}>Level</th>
                <th rowSpan={2} className={headerCell}>Task</th>
                <th rowSpan={2} className={headerCell}>W.F</th>
                <th rowSpan={2} className={headerCell}>U/M</th>
                <th rowSpan={2} className={headerCell}>Estimate</th>
                <th colSpan={2} className={headerCell}>Up to Last</th>
                {(["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const).map((day) => (
                  <th key={day} rowSpan={2} className={headerCell}>{day}</th>
                ))}
                <th rowSpan={2} className={headerCell}>Sum</th>
                <th rowSpan={2} className={headerCell}>Up to Now</th>
                <th colSpan={2} className={headerCell}>Last Week</th>
                <th colSpan={2} className={headerCell}>This Week</th>
                <th colSpan={2} className={headerCell}>Up to Now</th>
                <th rowSpan={2} className={headerCell}>Var.</th>
              </tr>
              <tr className="h-[clamp(14px,1.6vw,18px)]">
                {Array.from({ length: 8 }, (_, index) => (
                  <th key={`project-progress-subhead-${index}`} className={headerCell}>{index % 2 === 0 ? "P" : "A"}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROJECT_PROGRESS_ROWS.map((row, rowIndex) => {
                const values = report.projectProgressValues[rowIndex] ?? blankRows(PROJECT_PROGRESS_VALUE_COUNT);
                return (
                  <tr key={`project-progress-row-${rowIndex}`} className="h-[clamp(18px,2.4vw,26px)]">
                    <td className={`${tableCell} p-0`} style={{ backgroundColor: row.band }}>
                      <div className="flex h-full w-full" aria-hidden="true">
                        {PROJECT_PROGRESS_LEVEL_COLORS.map((color, depth) => (
                          <span key={`level-${depth}`} className="h-full flex-1" style={{ backgroundColor: depth <= row.depth ? color : row.band }} />
                        ))}
                      </div>
                    </td>
                    <td className={`${tableCell} px-1`} style={{ backgroundColor: row.band, color: row.text }}>
                      <span className="block truncate">{row.task}</span>
                    </td>
                    {values.map((value, columnIndex) => (
                      <td key={`project-progress-${rowIndex}-${columnIndex}`} className={tableCell} style={{ backgroundColor: row.band }}>
                        {row.editable && (
                          <SheetInput
                            ariaLabel={`${row.task} progress value ${columnIndex + 1}`}
                            value={value}
                            centered
                            onChange={(next) => updateValue(rowIndex, columnIndex, next)}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </WeeklySheet>
  );
}

function WorkFrontSheet({
  report,
  patchReport,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
}) {
  const gridCell = "border border-[#b8b8b8] px-1 py-0 align-middle";
  const headerCell = `${gridCell} bg-[#e3e3e3] text-center font-semibold text-[#111111]`;
  const band = "flex h-[20px] items-center justify-center border-y border-[#a9a9a9] bg-[#c4c4c4] px-1 text-center font-sans text-[10px] font-semibold text-[#1b4672]";
  const updateRow = (section: "availableWorkFronts" | "nextWeekActivities", rowIndex: number, field: keyof WorkFrontRow, value: string) => {
    patchReport((current) => ({
      ...current,
      [section]: current[section].map((row, index) => index === rowIndex ? { ...row, [field]: value } : row),
    }));
  };
  const renderSection = (title: string, rows: WorkFrontRow[], section: "availableWorkFronts" | "nextWeekActivities") => (
    <section className="shrink-0">
      <div className={band}>{title}</div>
      <table className="w-full table-fixed border-collapse bg-white font-sans text-[9.5px] leading-[1.15] text-[#152536]">
        <colgroup>
          <col style={{ width: "20%" }} />
          <col style={{ width: "66%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead>
          <tr className="h-[18px] bg-[#e3e3e3]">
            {["Task", "Location", "Quantity"].map((heading) => <th key={heading} className={headerCell}>{heading}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${section}-${index}`} className="h-[20px] bg-white">
              <td className={gridCell}><SheetInput ariaLabel={`${title} task ${index + 1}`} value={row.task} onChange={(value) => updateRow(section, index, "task", value)} /></td>
              <td className={gridCell}><SheetInput ariaLabel={`${title} location ${index + 1}`} value={row.location} onChange={(value) => updateRow(section, index, "location", value)} /></td>
              <td className={gridCell}><SheetInput ariaLabel={`${title} quantity ${index + 1}`} value={row.quantity} centered onChange={(value) => updateRow(section, index, "quantity", value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );

  return (
    <WeeklySheet title="WORK FRONTS">
      <div className="relative flex h-full min-h-0 flex-col gap-[16px] overflow-y-auto font-sans">
        {renderSection("Available Work Fronts", report.availableWorkFronts, "availableWorkFronts")}
        {renderSection("Next Week Activities", report.nextWeekActivities, "nextWeekActivities")}
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[44%] z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-sans text-[clamp(48px,10vw,76px)] font-light leading-none text-[#777777]/60 print:hidden">
          Page 1
        </div>
      </div>
    </WeeklySheet>
  );
}

function SCurveWorkspace({
  report,
  patchReport,
  rtl,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
  rtl: boolean;
}) {
  const [pasteText, setPasteText] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const planValues = cumulativeSCurveValues(report.sCurveWeeks, "weeklyPlan", "cumulativePlan");
  const actualValues = cumulativeSCurveValues(report.sCurveWeeks, "weeklyActual", "cumulativeActual");
  const plot = { left: 90, top: 70, width: 850, height: 420 };
  const tableLabels = rtl
    ? ["هفته / تاریخ", "برنامه هفتگی (%)", "برنامه تجمعی (%)", "واقعی هفتگی (%)", "واقعی تجمعی (%)", ""]
    : ["Week / Date", "Weekly Plan (%)", "Cumulative Plan (%)", "Weekly Actual (%)", "Cumulative Actual (%)", ""];

  const updateWeek = (index: number, field: "week" | "weeklyPlan" | "weeklyActual", value: string) => {
    patchReport((current) => ({
      ...current,
      sCurveWeeks: current.sCurveWeeks.map((row, rowIndex) => {
        if (rowIndex === index) {
          if (field === "weeklyPlan") return { ...row, weeklyPlan: value, cumulativePlan: "" };
          if (field === "weeklyActual") return { ...row, weeklyActual: value, cumulativeActual: "" };
          return { ...row, week: value };
        }
        if (field === "weeklyPlan") return { ...row, cumulativePlan: "" };
        if (field === "weeklyActual") return { ...row, cumulativeActual: "" };
        return row;
      }),
    }));
  };

  const updateCumulative = (index: number, field: "cumulativePlan" | "cumulativeActual", value: string) => {
    patchReport((current) => ({
      ...current,
      sCurveWeeks: current.sCurveWeeks.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row),
    }));
  };

  const addWeek = () => {
    patchReport((current) => ({
      ...current,
      sCurveWeeks: [...current.sCurveWeeks, {
        week: String(current.sCurveWeeks.length + 1),
        weeklyPlan: "",
        cumulativePlan: "",
        weeklyActual: "",
        cumulativeActual: "",
      }],
    }));
    setImportMessage("");
  };

  const removeWeek = (index: number) => {
    patchReport((current) => ({
      ...current,
      sCurveWeeks: current.sCurveWeeks
        .filter((_, rowIndex) => rowIndex !== index)
        .map((row) => ({ ...row, cumulativePlan: "", cumulativeActual: "" })),
    }));
  };

  const importWeeks = () => {
    const rows = parseSCurvePaste(pasteText);
    if (rows.length === 0) {
      setImportMessage(rtl ? "دادهٔ هفتگی قابل‌شناسایی نیست؛ جدول را با جداکنندهٔ Tab از Excel کپی کنید." : "No weekly rows found. Copy the table from Excel with tab separators.");
      return;
    }
    patchReport((current) => ({ ...current, sCurveWeeks: rows }));
    setPasteText("");
    setImportMessage(rtl ? `${rows.length} هفته وارد شد.` : `${rows.length} weeks imported.`);
  };

  const displayCumulative = (manual: string, calculated: number | null) => {
    const value = manual.trim() || (calculated === null ? "" : formatSPercent(calculated));
    if (!value) return "—";
    return /[%٪]$/.test(value) ? value : `${value}%`;
  };

  const pointsFor = (values: (number | null)[]) => values.flatMap((value, index) => value === null ? [] : [{
    x: plot.left + (index / Math.max(1, values.length - 1)) * plot.width,
    y: plot.top + ((100 - value) / 100) * plot.height,
    value,
    index,
  }]);
  const smoothPath = (points: { x: number; y: number }[]) => points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const before = points[Math.max(0, index - 2)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const firstControl = { x: previous.x + (point.x - before.x) / 6, y: previous.y + (point.y - before.y) / 6 };
    const secondControl = { x: point.x - (after.x - previous.x) / 6, y: point.y - (after.y - previous.y) / 6 };
    return `${path} C ${firstControl.x} ${firstControl.y}, ${secondControl.x} ${secondControl.y}, ${point.x} ${point.y}`;
  }, "");
  const planPoints = pointsFor(planValues);
  const actualPoints = pointsFor(actualValues);
  const planPath = smoothPath(planPoints);
  const actualPath = smoothPath(actualPoints);
  const tickCount = Math.min(report.sCurveWeeks.length, 8);
  const tickIndexes = tickCount <= 1
    ? (tickCount === 1 ? [0] : [])
    : Array.from(new Set(Array.from({ length: tickCount }, (_, index) => Math.round(index * (report.sCurveWeeks.length - 1) / (tickCount - 1)))));
  const pointRadius = report.sCurveWeeks.length > 40 ? 1.5 : report.sCurveWeeks.length > 20 ? 2.2 : 3.2;
  const yTicks = [0, 20, 40, 60, 80, 100];
  const inputClass = "w-full min-w-0 rounded border b-line-soft bg-black/10 px-2 py-1 text-[10px] tx1 outline-none focus:border-[var(--accent)]";

  return (
    <div className="space-y-3">
      <section className="weekly-report-no-print rounded-xl border b-line-soft bg-black/10 p-2" aria-label={rtl ? "جدول داده‌های هفتگی منحنی S" : "Weekly S-curve data table"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold tx1">{rtl ? "جدول هفتگی منحنی S" : "Weekly S-Curve Data"}</div>
          <button type="button" onClick={addWeek} className="rounded-lg border b-line-soft bg-black/15 px-3 py-1.5 text-[10px] tx1 hover:bg-black/25">
            {rtl ? "+ افزودن هفته" : "+ Add week"}
          </button>
        </div>
        <p className="mt-1 text-[9px] tx3">
          {rtl
            ? "جدول را از Excel کپی و اینجا بچسبانید؛ مقادیر تجمعی در صورت خالی‌بودن خودکار محاسبه می‌شوند."
            : "Paste the Excel table below; blank cumulative values are calculated from weekly values."}
        </p>
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <textarea
            aria-label={rtl ? "چسباندن جدول هفتگی از Excel" : "Paste weekly table from Excel"}
            dir="ltr"
            rows={3}
            value={pasteText}
            onChange={(event) => { setPasteText(event.target.value); setImportMessage(""); }}
            placeholder={rtl ? "کپی مستقیم جدول از Excel (جداکننده Tab)" : "Paste rows from Excel (tab-separated)"}
            className="min-h-[56px] min-w-[260px] flex-1 rounded-lg border b-line-soft bg-black/15 px-2 py-1.5 font-mono text-[10px] tx1 outline-none focus:border-[var(--accent)]"
          />
          <button type="button" onClick={importWeeks} disabled={!pasteText.trim()} className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-[10px] text-sky-200 hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-40">
            {rtl ? "واردکردن جدول" : "Import table"}
          </button>
          {importMessage && <span role="status" className="basis-full text-[9px] tx3">{importMessage}</span>}
        </div>
        <div className="mt-2 max-h-[320px] overflow-auto rounded-lg border b-line-soft">
          <table dir={rtl ? "rtl" : "ltr"} className="min-w-[780px] w-full table-fixed border-collapse text-[9px] tx1">
            <colgroup>
              <col style={{ width: "13%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "17%" }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#27384a] text-start">
              <tr>{tableLabels.map((label, index) => <th key={`scurve-head-${index}`} className="border-b border-white/10 px-2 py-1.5 font-semibold">{label}</th>)}</tr>
            </thead>
            <tbody>
              {report.sCurveWeeks.length === 0 ? (
                <tr><td colSpan={6} className="px-2 py-3 text-center tx3">{rtl ? "داده‌ای ثبت نشده؛ از Excel وارد کنید یا یک هفته بیفزایید." : "No weekly data yet. Paste from Excel or add a week."}</td></tr>
              ) : report.sCurveWeeks.map((row, index) => (
                <tr key={`s-curve-week-${index}`} className="odd:bg-black/5 even:bg-black/10">
                  <td className="border-b border-white/10 p-1"><input aria-label={`${rtl ? "هفته یا تاریخ" : "Week or date"} ${index + 1}`} dir="auto" value={row.week} onChange={(event) => updateWeek(index, "week", event.target.value)} className={inputClass} /></td>
                  <td className="border-b border-white/10 p-1"><input aria-label={`${rtl ? "برنامه هفتگی" : "Weekly plan"} ${index + 1}`} dir="ltr" inputMode="decimal" value={row.weeklyPlan} onChange={(event) => updateWeek(index, "weeklyPlan", event.target.value)} className={inputClass} /></td>
                  <td className="border-b border-white/10 p-1"><input aria-label={`${rtl ? "برنامه تجمعی" : "Cumulative plan"} ${index + 1}`} dir="ltr" inputMode="decimal" value={row.cumulativePlan} placeholder={displayCumulative("", planValues[index])} onChange={(event) => updateCumulative(index, "cumulativePlan", event.target.value)} className={`${inputClass} tabular-nums`} /></td>
                  <td className="border-b border-white/10 p-1"><input aria-label={`${rtl ? "واقعی هفتگی" : "Weekly actual"} ${index + 1}`} dir="ltr" inputMode="decimal" value={row.weeklyActual} onChange={(event) => updateWeek(index, "weeklyActual", event.target.value)} className={inputClass} /></td>
                  <td className="border-b border-white/10 p-1"><input aria-label={`${rtl ? "واقعی تجمعی" : "Cumulative actual"} ${index + 1}`} dir="ltr" inputMode="decimal" value={row.cumulativeActual} placeholder={displayCumulative("", actualValues[index])} onChange={(event) => updateCumulative(index, "cumulativeActual", event.target.value)} className={`${inputClass} tabular-nums`} /></td>
                  <td className="border-b border-white/10 p-1 text-center"><button type="button" aria-label={`${rtl ? "حذف هفته" : "Remove week"} ${index + 1}`} onClick={() => removeWeek(index)} className="rounded px-2 py-1 text-rose-300 hover:bg-rose-400/10">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <WeeklySheet title="S-CURVE" landscape>
        <div className="h-full min-h-0 w-full">
          <svg viewBox="0 0 1000 600" preserveAspectRatio="none" className="h-full w-full font-sans" role="img" aria-label={rtl ? "نمودار تجمعی هفتگی برنامه و عملکرد" : "Weekly cumulative plan and actual S-curve"}>
            <rect x="0" y="0" width="1000" height="600" fill="#eef0f2" />
            <rect x={plot.left} y={plot.top} width={plot.width} height={plot.height} fill="#ffffff" stroke="#aeb8c2" strokeWidth="1" />
            {yTicks.map((tick) => {
              const y = plot.top + ((100 - tick) / 100) * plot.height;
              return (
                <g key={`s-curve-y-${tick}`}>
                  <line x1={plot.left} y1={y} x2={plot.left + plot.width} y2={y} stroke="#d6dce2" strokeWidth="1" />
                  <text x={plot.left - 12} y={y + 4} textAnchor="end" fill="#334155" fontSize="12">{tick}%</text>
                </g>
              );
            })}
            {tickIndexes.map((index) => {
              const x = plot.left + (index / Math.max(1, report.sCurveWeeks.length - 1)) * plot.width;
              const label = report.sCurveWeeks[index]?.week.trim() || String(index + 1);
              return (
                <g key={`s-curve-x-${index}`}>
                  <line x1={x} y1={plot.top} x2={x} y2={plot.top + plot.height} stroke="#edf0f2" strokeWidth="1" />
                  <line x1={x} y1={plot.top + plot.height} x2={x} y2={plot.top + plot.height + 5} stroke="#7b8794" strokeWidth="1" />
                  <text x={x} y={plot.top + plot.height + 24} textAnchor="middle" fill="#334155" fontSize="11">{label}</text>
                </g>
              );
            })}
            <line x1={plot.left} y1={plot.top + plot.height} x2={plot.left + plot.width} y2={plot.top + plot.height} stroke="#697586" strokeWidth="1.3" />
            <line x1={plot.left} y1={plot.top} x2={plot.left} y2={plot.top + plot.height} stroke="#697586" strokeWidth="1.3" />
            <text x="22" y="280" transform="rotate(-90 22 280)" textAnchor="middle" fill="#334155" fontSize="13" fontWeight="600">Overall</text>
            <text x={plot.left + plot.width / 2} y="570" textAnchor="middle" fill="#334155" fontSize="13" fontWeight="600">{rtl ? "هفته / تاریخ" : "Week / Date"}</text>
            <g transform="translate(560 24)">
              <line x1="0" y1="0" x2="30" y2="0" stroke="#4c89e8" strokeWidth="3" />
              <circle cx="15" cy="0" r="3.5" fill="#4c89e8" />
              <text x="38" y="4" fill="#243447" fontSize="13">Cumulative Plan</text>
              <line x1="190" y1="0" x2="220" y2="0" stroke="#df625b" strokeWidth="3" />
              <circle cx="205" cy="0" r="3.5" fill="#df625b" />
              <text x="228" y="4" fill="#243447" fontSize="13">Cumulative Actual</text>
            </g>
            {planPath && <path d={planPath} fill="none" stroke="#4c89e8" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
            {actualPath && <path d={actualPath} fill="none" stroke="#df625b" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
            {planPoints.map((point, index) => <circle key={`plan-point-${index}`} cx={point.x} cy={point.y} r={pointRadius} fill="#4c89e8" stroke="#ffffff" strokeWidth="1.2" />)}
            {actualPoints.map((point, index) => <circle key={`actual-point-${index}`} cx={point.x} cy={point.y} r={pointRadius} fill="#df625b" stroke="#ffffff" strokeWidth="1.2" />)}
            {planPoints.length > 0 && <text x={plot.left + plot.width - 4} y={planPoints[planPoints.length - 1].y - 12} textAnchor="end" fill="#346fc0" fontSize="12" fontWeight="700">{formatSPercent(planPoints[planPoints.length - 1].value)}%</text>}
            {actualPoints.length > 0 && <text x={plot.left + plot.width - 4} y={actualPoints[actualPoints.length - 1].y - 10} textAnchor="end" fill="#c64f49" fontSize="12" fontWeight="700">{formatSPercent(actualPoints[actualPoints.length - 1].value)}%</text>}
          </svg>
        </div>
      </WeeklySheet>
    </div>
  );
}

function DelayCauseEffectSheet({
  report,
  patchReport,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
}) {
  const columnLefts = [5.5, 24.5, 43.5, 62.5];
  const centers = [122, 312, 502, 692];
  const updateColumn = (columnIndex: number, field: "heading" | "lowerLabel", value: string) => {
    patchReport((current) => ({
      ...current,
      delayCauseColumns: current.delayCauseColumns.map((column, index) => index === columnIndex ? { ...column, [field]: value } : column),
    }));
  };
  const updateCauseLabel = (columnIndex: number, causeIndex: number, value: string) => {
    patchReport((current) => ({
      ...current,
      delayCauseColumns: current.delayCauseColumns.map((column, index) => index === columnIndex
        ? { ...column, causeLabels: column.causeLabels.map((label, itemIndex) => itemIndex === causeIndex ? value : label) }
        : column),
    }));
  };

  return (
    <WeeklySheet title="DELAYS" landscape printRoot={false}>
      <div className="flex h-full min-h-0 flex-col font-sans">
        <div className="flex h-[20px] shrink-0 items-center justify-center border-y border-[#aaaaaa] bg-[#c4c4c4] text-center text-[10px] font-semibold text-[#244f7b]">Cause &amp; Effect</div>
        <div className="relative min-h-0 flex-1">
          <svg viewBox="0 0 1000 540" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <marker id="delay-arrow-head" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 z" fill="#111111" />
              </marker>
            </defs>
            {centers.map((center, index) => (
              <g key={`delay-spine-${index}`}>
                <line x1={center} y1="55" x2={center} y2="322" stroke="#111111" strokeWidth="1.2" markerEnd="url(#delay-arrow-head)" />
                <line x1={center} y1="448" x2={center} y2="322" stroke="#111111" strokeWidth="1.2" markerEnd="url(#delay-arrow-head)" />
              </g>
            ))}
            <line x1="0" y1="322" x2="812" y2="322" stroke="#111111" strokeWidth="3" markerEnd="url(#delay-arrow-head)" />
          </svg>

          {report.delayCauseColumns.map((column, index) => (
            <div key={`delay-cause-column-${index}`} className="absolute z-10" style={{ left: `${columnLefts[index] ?? 5.5 + index * 19}%`, top: "6%", width: "14.5%" }}>
              <div className="h-[20px] border border-[#111111] bg-white text-center">
                <SheetInput ariaLabel={`Delay cause category ${index + 1}`} value={column.heading} centered onChange={(value) => updateColumn(index, "heading", value)} />
              </div>
              <div className="mt-[18px] flex flex-col">
                {column.causeLabels.map((label, causeIndex) => label === null
                  ? <div key={`delay-cause-gap-${index}-${causeIndex}`} className="h-[18px] shrink-0" />
                  : <div key={`delay-cause-label-${index}-${causeIndex}`} className="h-[18px] shrink-0 border border-[#111111] bg-white text-center">
                      <SheetInput ariaLabel={`Delay cause ${causeIndex + 1} in ${column.heading || `category ${index + 1}`}`} value={label} centered onChange={(value) => updateCauseLabel(index, causeIndex, value)} />
                    </div>)}
              </div>
            </div>
          ))}

          {report.delayCauseColumns.map((column, index) => (
            <div key={`delay-lower-label-${index}`} className="absolute top-[83%] z-10 h-[20px] border border-[#111111] bg-white text-center" style={{ left: `${columnLefts[index] ?? 5.5 + index * 19}%`, width: "14.5%" }}>
              <SheetInput ariaLabel={`Delay cause lower label ${index + 1}`} value={column.lowerLabel} centered onChange={(value) => updateColumn(index, "lowerLabel", value)} />
            </div>
          ))}

          <div className="absolute z-10 flex h-[36px] items-center justify-center border border-[#111111] bg-white text-center font-sans text-[10px] text-[#152536]" style={{ left: "81.5%", top: "calc(59.6% - 18px)", width: "14.5%" }}>Project Delays</div>
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[48%] z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-sans text-[clamp(64px,13vw,104px)] font-light leading-none text-[#777777]/60 print:hidden">Page 1</div>
        </div>
      </div>
    </WeeklySheet>
  );
}

function DelayAnalysisSheet({
  report,
  patchReport,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
}) {
  const cell = "border border-[#c1c1c1] px-0.5 py-0 align-middle";
  const header = `${cell} bg-[#e3e3e3] text-center font-medium text-[#111111]`;
  const updateRow = (rowIndex: number, field: keyof DelayAnalysisRow, value: string) => {
    patchReport((current) => ({
      ...current,
      delayAnalysisRows: current.delayAnalysisRows.map((row, index) => index === rowIndex ? { ...row, [field]: value } : row),
    }));
  };
  const inputCell = (row: DelayAnalysisRow, rowIndex: number, field: keyof DelayAnalysisRow, centered = false) => (
    <td className={cell}>
      <SheetInput ariaLabel={`Delay row ${rowIndex + 1} ${field}`} value={row[field]} centered={centered} onChange={(value) => updateRow(rowIndex, field, value)} />
    </td>
  );

  return (
    <WeeklySheet title="DELAYS" landscape printRoot={false}>
      <div className="flex h-full min-h-0 flex-col font-sans">
        <div className="flex h-[20px] shrink-0 items-center justify-center border-y border-[#aaaaaa] bg-[#c4c4c4] text-center text-[10px] font-semibold text-[#244f7b]">Delay Analyze</div>
        <div className="relative min-h-0 flex-1">
          <table className="h-full w-full table-fixed border-collapse bg-white font-sans text-[9px] leading-[1.1] text-[#152536]">
            <colgroup>
              <col style={{ width: "16%" }} />
              <col style={{ width: "8.5%" }} />
              <col style={{ width: "4%" }} />
              <col style={{ width: "6.5%" }} />
              <col style={{ width: "6.5%" }} />
              <col style={{ width: "19.5%" }} />
              <col style={{ width: "6.8%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "7.2%" }} />
            </colgroup>
            <thead>
              <tr className="h-[18px]">
                <th rowSpan={2} className={header}>Task</th>
                <th rowSpan={2} className={header}>WBS</th>
                <th rowSpan={2} className={header}>W.F</th>
                <th className={header}>P Start</th>
                <th className={header}>P Finish</th>
                <th className={header}>Cause 1</th>
                <th rowSpan={2} className={header}>Delay DUR</th>
                <th colSpan={5} className={header}>Delay Share</th>
              </tr>
              <tr className="h-[18px]">
                <th className={header}>A Start</th>
                <th className={header}>A Finish</th>
                <th className={header}>Cause 2</th>
                <th className={header}>E</th>
                <th className={header}>P</th>
                <th className={header}>C</th>
                <th className={header}>Client</th>
                <th className={header}>Contractor</th>
              </tr>
            </thead>
            <tbody>
              {report.delayAnalysisRows.map((row, rowIndex) => (
                <tr key={`delay-analysis-row-${rowIndex}`} className="h-[18px]">
                  {inputCell(row, rowIndex, "task")}
                  {inputCell(row, rowIndex, "wbs", true)}
                  {inputCell(row, rowIndex, "workFront", true)}
                  {inputCell(row, rowIndex, "planStart", true)}
                  {inputCell(row, rowIndex, "planFinish", true)}
                  <td className={cell}><SheetInput ariaLabel={`Delay cause 1 row ${rowIndex + 1}`} value={row.cause1} onChange={(value) => updateRow(rowIndex, "cause1", value)} /></td>
                  {inputCell(row, rowIndex, "duration", true)}
                  {inputCell(row, rowIndex, "engineeringShare", true)}
                  {inputCell(row, rowIndex, "procurementShare", true)}
                  {inputCell(row, rowIndex, "constructionShare", true)}
                  {inputCell(row, rowIndex, "clientShare", true)}
                  {inputCell(row, rowIndex, "contractorShare", true)}
                </tr>
              ))}
            </tbody>
          </table>
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[48%] z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-sans text-[clamp(64px,13vw,104px)] font-light leading-none text-[#777777]/60 print:hidden">Page 2</div>
        </div>
      </div>
    </WeeklySheet>
  );
}

function DelayWorkspace({
  report,
  patchReport,
  printRoot = false,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
  printRoot?: boolean;
}) {
  return (
    <div id={printRoot ? "weekly-report-print-root" : undefined} className="weekly-report-multipage-print-root mx-auto space-y-3">
      <DelayCauseEffectSheet report={report} patchReport={patchReport} />
      <DelayAnalysisSheet report={report} patchReport={patchReport} />
    </div>
  );
}

const MANPOWER_DAYS = [
  { date: "1404.07.26", weekday: "Saturday" },
  { date: "1404.07.27", weekday: "Sunday" },
  { date: "1404.07.28", weekday: "Monday" },
  { date: "1404.07.29", weekday: "Tuesday" },
  { date: "1404.07.30", weekday: "Wednesday" },
  { date: "1404.08.01", weekday: "Thursday" },
  { date: "1404.08.02", weekday: "Friday" },
] as const;

type ManpowerRowsKey = "directManpowerRows" | "indirectManpowerRows";

function ManpowerTablePage({
  report,
  patchReport,
  rowsKey,
  sectionTitle,
  pageNumber,
  showTitleBanner,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
  rowsKey: ManpowerRowsKey;
  sectionTitle: string;
  pageNumber: 1 | 2;
  showTitleBanner: boolean;
}) {
  const rows = report[rowsKey];
  const cell = "border border-[#bcbcbc] px-0 py-0 align-middle";
  const headerCell = `${cell} bg-[#dedede] text-center font-medium text-[#233b55]`;
  const updateDescription = (rowIndex: number, value: string) => {
    patchReport((current) => ({
      ...current,
      [rowsKey]: current[rowsKey].map((row, index) => index === rowIndex ? { ...row, description: value } : row),
    }));
  };
  const updateValue = (rowIndex: number, valueIndex: number, value: string) => {
    patchReport((current) => ({
      ...current,
      [rowsKey]: current[rowsKey].map((row, index) => index === rowIndex
        ? { ...row, values: row.values.map((cellValue, cellIndex) => cellIndex === valueIndex ? value : cellValue) }
        : row),
    }));
  };
  const valueLabel = (row: ManpowerTableRow, rowIndex: number, valueIndex: number) => {
    const group = valueIndex < 14
      ? `${MANPOWER_DAYS[Math.floor(valueIndex / 2)].date} ${valueIndex % 2 === 0 ? "Present" : "Rest"}`
      : valueIndex < 16
        ? `Week ${valueIndex % 2 === 0 ? "Present" : "Rest"}`
        : `Up to now ${valueIndex % 2 === 0 ? "Present" : "Rest"}`;
    return `${sectionTitle} ${row.description || `row ${rowIndex + 1}`} ${group}`;
  };

  return (
    <WeeklySheet title="MANPOWER" landscape fullBleed printRoot={false} compactHeader={showTitleBanner} showTitleBanner={showTitleBanner}>
      <div className="flex h-full min-h-0 flex-col font-sans">
        <div className="flex h-[18px] shrink-0 items-center justify-start border-y border-[#a9a9a9] bg-[#c4c4c4] px-1 text-[10px] font-semibold text-[#254e78]">{sectionTitle}</div>
        <div className="min-h-0 flex-1 overflow-auto print:overflow-visible">
          <table className="w-full table-fixed border-collapse bg-white font-sans text-[8px] leading-none text-[#152536]">
            <colgroup>
              <col style={{ width: "21%" }} />
              {Array.from({ length: 14 }, (_, index) => <col key={`manpower-day-col-${index}`} style={{ width: "4.1%" }} />)}
              {Array.from({ length: 4 }, (_, index) => <col key={`manpower-summary-col-${index}`} style={{ width: "5.4%" }} />)}
            </colgroup>
            <thead>
              <tr className="h-[14px]">
                <th rowSpan={3} className={`${headerCell} text-[10px] font-semibold text-[#111111]`}>Job Description</th>
                {MANPOWER_DAYS.map((day) => <th key={day.date} colSpan={2} className={headerCell}>{day.date}</th>)}
                <th colSpan={2} rowSpan={2} className={`${headerCell} font-semibold`}>WEEK</th>
                <th colSpan={2} rowSpan={2} className={`${headerCell} font-semibold`}>Up to Now</th>
              </tr>
              <tr className="h-[14px]">
                {MANPOWER_DAYS.map((day) => <th key={`weekday-${day.date}`} colSpan={2} className={headerCell}>{day.weekday}</th>)}
              </tr>
              <tr className="h-[14px]">
                {MANPOWER_DAYS.flatMap((day) => [
                  <th key={`${day.date}-present`} className={`${headerCell} text-[7px] font-bold`}>Present</th>,
                  <th key={`${day.date}-rest`} className={`${headerCell} text-[7px] font-bold`}>Rest</th>,
                ])}
                <th className={`${headerCell} text-[7px] font-bold`}>Present</th>
                <th className={`${headerCell} text-[7px] font-bold`}>Rest</th>
                <th className={`${headerCell} text-[7px] font-bold`}>Present</th>
                <th className={`${headerCell} text-[7px] font-bold`}>Rest</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const sectionRow = row.kind === "section";
                const totalRow = row.kind === "total";
                return (
                  <tr key={`${rowsKey}-${rowIndex}`} className={`h-[12px] ${sectionRow || totalRow ? "bg-[#d5d5d5]" : "bg-white"}`}>
                    <td className={`${cell} px-1 ${sectionRow ? "font-semibold text-[#111111]" : totalRow ? "font-bold text-[#7116b3]" : "text-[#152536]"}`}>
                      <input aria-label={`${sectionTitle} job description row ${rowIndex + 1}`} value={row.description} onChange={(event) => updateDescription(rowIndex, event.target.value)} className={`h-[11px] w-full min-w-0 border-0 bg-transparent px-1 text-[8px] leading-[10px] outline-none focus:bg-[#e7f0f8] ${sectionRow || totalRow ? "font-semibold" : ""} ${totalRow ? "text-[#7116b3]" : "text-[#152536]"}`} />
                    </td>
                    {row.values.map((value, valueIndex) => {
                      const weekColumn = valueIndex >= 14 && valueIndex < 16;
                      const upToNowColumn = valueIndex >= 16;
                      return (
                        <td key={`manpower-value-${rowIndex}-${valueIndex}`} className={`${cell} ${weekColumn ? "bg-[#f0f0f0]" : ""} ${upToNowColumn ? "bg-[#e6e6e6]" : ""} ${sectionRow ? "font-semibold text-[#173e6c]" : totalRow ? "font-bold text-[#7116b3]" : ""}`}>
                          <input aria-label={valueLabel(row, rowIndex, valueIndex)} inputMode="decimal" value={value} onChange={(event) => updateValue(rowIndex, valueIndex, event.target.value)} className={`h-[11px] w-full min-w-0 border-0 bg-transparent px-0 text-center text-[8px] leading-[10px] tabular-nums outline-none focus:bg-[#e7f0f8] ${totalRow ? "text-[#7116b3]" : "text-inherit"}`} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[48%] z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-sans text-[clamp(90px,18vw,180px)] font-light leading-none text-[#777777]/60 print:hidden">Page {pageNumber}</div>
      </div>
    </WeeklySheet>
  );
}

function ManpowerWorkspace({
  report,
  patchReport,
  printRoot = false,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
  printRoot?: boolean;
}) {
  return (
    <div id={printRoot ? "weekly-report-print-root" : undefined} className="weekly-report-multipage-print-root mx-auto space-y-3">
      <ManpowerTablePage report={report} patchReport={patchReport} rowsKey="directManpowerRows" sectionTitle="Direct Manpower" pageNumber={1} showTitleBanner />
      <ManpowerTablePage report={report} patchReport={patchReport} rowsKey="indirectManpowerRows" sectionTitle="Indirect Manpower" pageNumber={2} showTitleBanner={false} />
    </div>
  );
}

type MachineryRowsKey = "machineryPageOneRows" | "machineryPageTwoRows";

function MachineryEquipmentPage({
  report,
  patchReport,
  rowsKey,
  pageNumber,
  showTitleBanner,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
  rowsKey: MachineryRowsKey;
  pageNumber: 1 | 2;
  showTitleBanner: boolean;
}) {
  const rows = report[rowsKey];
  const cell = "border border-[#c4c4c4] px-0 py-0 align-middle";
  const headerCell = `${cell} bg-[#dedede] text-center text-[8px] font-medium text-[#263a55]`;
  const updateDescription = (rowIndex: number, value: string) => {
    patchReport((current) => ({
      ...current,
      [rowsKey]: current[rowsKey].map((row, index) => index === rowIndex ? { ...row, description: value } : row),
    }));
  };
  const updateValue = (rowIndex: number, valueIndex: number, value: string) => {
    patchReport((current) => ({
      ...current,
      [rowsKey]: current[rowsKey].map((row, index) => index === rowIndex
        ? { ...row, values: row.values.map((cellValue, cellIndex) => cellIndex === valueIndex ? value : cellValue) }
        : row),
    }));
  };
  const rowSpan = (rowIndex: number, field: "mainGroup" | "subGroup") => {
    const row = rows[rowIndex];
    let count = 1;
    for (let index = rowIndex + 1; index < rows.length; index += 1) {
      const next = rows[index];
      if (next.kind === "total" || next.mainGroup !== row.mainGroup || next[field] !== row[field]) break;
      count += 1;
    }
    return count;
  };
  const verticalLabel = (label: string) => (
    <span className="block whitespace-nowrap py-1 text-[7px] font-semibold text-[#142b45] [writing-mode:vertical-rl] rotate-180">{label}</span>
  );
  const inputClass = "h-[12px] w-full min-w-0 border-0 bg-transparent px-0 text-center text-[8px] leading-[10px] tabular-nums text-[#152536] outline-none focus:bg-[#e7f0f8]";
  const valueLabel = (row: MachineryEquipmentRow, rowIndex: number, valueIndex: number) => {
    const status = ["Active", "Inactive", "Inrepair"][valueIndex % 3];
    const period = valueIndex < 21
      ? `${MACHINERY_DAYS[Math.floor(valueIndex / 3)].date}`
      : valueIndex < 24
        ? "Week"
        : "UpToNow";
    return `${row.description || `equipment row ${rowIndex + 1}`} ${period} ${status}`;
  };

  return (
    <WeeklySheet title="MACHINERY&EQUIPMENTDESCRIPTION" landscape fullBleed printRoot={false} compactHeader={showTitleBanner} showTitleBanner={showTitleBanner}>
      <div className="flex h-full min-h-0 flex-col font-sans">
        <div className="flex h-[18px] shrink-0 items-center justify-start border-y border-[#a9a9a9] bg-[#c4c4c4] px-1 text-[10px] font-semibold text-[#254e78]">Machinery&EquipmentDescription</div>
        <div className="min-h-0 flex-1 overflow-auto print:overflow-visible">
          <table className="w-full table-fixed border-collapse bg-white font-sans text-[8px] leading-none text-[#152536]">
            <colgroup>
              <col style={{ width: "1.4%" }} />
              <col style={{ width: "1.4%" }} />
              <col style={{ width: "16.5%" }} />
              {Array.from({ length: 21 }, (_, index) => <col key={`machinery-day-col-${index}`} style={{ width: "2.9%" }} />)}
              {Array.from({ length: 6 }, (_, index) => <col key={`machinery-summary-col-${index}`} style={{ width: "3.3%" }} />)}
            </colgroup>
            <thead>
              <tr className="h-[16px]">
                <th rowSpan={3} className={headerCell} />
                <th rowSpan={3} className={headerCell} />
                <th rowSpan={3} className={`${headerCell} text-[10px] font-semibold text-[#111111]`}>Description</th>
                {MACHINERY_DAYS.map((day) => <th key={day.date} colSpan={3} className={headerCell}>{day.date}</th>)}
                <th colSpan={3} rowSpan={2} className={`${headerCell} font-semibold`}>Week</th>
                <th colSpan={3} rowSpan={2} className={`${headerCell} font-semibold`}>UpToNow</th>
              </tr>
              <tr className="h-[14px]">
                {MACHINERY_DAYS.map((day) => <th key={`machinery-weekday-${day.date}`} colSpan={3} className={`${headerCell} text-[7px]`}>{day.weekday}</th>)}
              </tr>
              <tr className="h-[54px]">
                {Array.from({ length: 21 }, (_, index) => <th key={`machinery-status-${index}`} className={`${headerCell} p-0`}><span className="inline-block whitespace-nowrap [writing-mode:vertical-rl] rotate-180">{["Active", "Inactive", "Inrepair"][index % 3]}</span></th>)}
                {Array.from({ length: 6 }, (_, index) => <th key={`machinery-summary-status-${index}`} className={`${headerCell} p-0`}><span className="inline-block whitespace-nowrap [writing-mode:vertical-rl] rotate-180">{["Active", "Inactive", "Inrepair"][index % 3]}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const totalRow = row.kind === "total";
                const firstMain = row.kind !== "total" && (rowIndex === 0 || rows[rowIndex - 1].mainGroup !== row.mainGroup);
                const firstSub = row.kind !== "total" && (rowIndex === 0 || rows[rowIndex - 1].mainGroup !== row.mainGroup || rows[rowIndex - 1].subGroup !== row.subGroup);
                return (
                  <tr key={`${rowsKey}-${rowIndex}`} className={`h-[13px] ${totalRow ? "bg-[#d3d3d3] font-bold text-[#7116b3]" : "bg-white"}`}>
                    {totalRow ? <><td className={`${cell} bg-[#d3d3d3]`} /><td className={`${cell} bg-[#d3d3d3]`} /></> : firstMain ? <td rowSpan={rowSpan(rowIndex, "mainGroup")} className={`${cell} bg-[#e0e0e0] px-0 text-center`}>{verticalLabel(row.mainGroup)}</td> : null}
                    {totalRow ? <td className={`${cell} bg-[#d3d3d3]`} /> : firstSub ? <td rowSpan={rowSpan(rowIndex, "subGroup")} className={`${cell} bg-[#e7e7e7] px-0 text-center`}>{verticalLabel(row.subGroup)}</td> : null}
                    <td className={`${cell} px-1 ${totalRow ? "text-[#7116b3]" : "text-[#152536]"}`}>
                      <input aria-label={`${rowsKey} description row ${rowIndex + 1}`} value={row.description} onChange={(event) => updateDescription(rowIndex, event.target.value)} className={`h-[12px] w-full min-w-0 border-0 bg-transparent px-1 text-start text-[8px] leading-[10px] outline-none focus:bg-[#e7f0f8] ${totalRow ? "text-[#7116b3]" : "text-[#152536]"}`} />
                    </td>
                    {row.values.map((value, valueIndex) => {
                      const weekColumn = valueIndex >= 21 && valueIndex < 24;
                      const upToNowColumn = valueIndex >= 24;
                      return (
                        <td key={`equipment-value-${rowIndex}-${valueIndex}`} className={`${cell} ${weekColumn ? "bg-[#f0f0f0]" : ""} ${upToNowColumn ? "bg-[#e5e5e5]" : ""} ${totalRow ? "font-bold text-[#7116b3]" : ""}`}>
                          <input aria-label={valueLabel(row, rowIndex, valueIndex)} inputMode="decimal" value={value} onChange={(event) => updateValue(rowIndex, valueIndex, event.target.value)} className={`${inputClass} ${totalRow ? "text-[#7116b3]" : ""}`} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[48%] z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-sans text-[clamp(90px,18vw,180px)] font-light leading-none text-[#777777]/60 print:hidden">Page {pageNumber}</div>
      </div>
    </WeeklySheet>
  );
}

function MachineryWorkspace({
  report,
  patchReport,
  printRoot = false,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
  printRoot?: boolean;
}) {
  return (
    <div id={printRoot ? "weekly-report-print-root" : undefined} className="weekly-report-multipage-print-root mx-auto space-y-3">
      <MachineryEquipmentPage report={report} patchReport={patchReport} rowsKey="machineryPageOneRows" pageNumber={1} showTitleBanner />
      <MachineryEquipmentPage report={report} patchReport={patchReport} rowsKey="machineryPageTwoRows" pageNumber={2} showTitleBanner={false} />
    </div>
  );
}

function EditableGridSheet({
  title,
  sectionTitle,
  headers,
  widths,
  rows,
  onCellChange,
  landscape = false,
  compactHeader = false,
}: {
  title: string;
  sectionTitle: string;
  headers: string[];
  widths: number[];
  rows: string[][];
  onCellChange: (rowIndex: number, columnIndex: number, value: string) => void;
  landscape?: boolean;
  compactHeader?: boolean;
}) {
  const cell = "border border-[#c2c2c2] px-0.5 py-0 align-middle";
  return (
    <WeeklySheet title={title} landscape={landscape} compactHeader={compactHeader}>
      <div className="flex h-full min-h-0 flex-col font-sans">
        <div className="flex h-[20px] shrink-0 items-center justify-center border-y border-[#a9a9a9] bg-[#c4c4c4] text-center text-[9px] font-semibold text-[#254e78]">{sectionTitle}</div>
        <div className="min-h-0 flex-1 overflow-auto print:overflow-visible">
          <table className="w-full table-fixed border-collapse bg-white font-sans text-[8px] leading-[1.1] text-[#152536]">
            <colgroup>{widths.map((width, index) => <col key={`grid-width-${index}`} style={{ width: `${width}%` }} />)}</colgroup>
            <thead>
              <tr className="h-[18px] bg-[#e3e3e3]">
                {headers.map((header) => <th key={header} className={`${cell} text-center font-semibold text-[#111111]`}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`grid-row-${rowIndex}`} className="h-[18px]">
                  {headers.map((_, columnIndex) => (
                    <td key={`grid-cell-${rowIndex}-${columnIndex}`} className={cell}>
                      <SheetInput ariaLabel={`${title} row ${rowIndex + 1} column ${headers[columnIndex]}`} value={row[columnIndex] ?? ""} centered={columnIndex !== 0} onChange={(value) => onCellChange(rowIndex, columnIndex, value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </WeeklySheet>
  );
}

function ConsumingMaterialSheet({ report, patchReport }: { report: WeeklyReportData; patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void }) {
  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    patchReport((current) => ({
      ...current,
      consumingMaterialRows: current.consumingMaterialRows.map((row, index) => index === rowIndex ? row.map((cell, cellIndex) => cellIndex === columnIndex ? value : cell) : row),
    }));
  };
  return (
    <EditableGridSheet
      title="CONSUMING MATERIAL"
      sectionTitle="Received Material"
      headers={["Item", "Type", "U/M", "Quantity", "Up to Last", "This Week", "Up to Now", "Prog."]}
      widths={[14.3, 14.3, 7.1, 14.3, 14.3, 14.3, 14.3, 7.1]}
      rows={report.consumingMaterialRows}
      onCellChange={updateCell}
    />
  );
}

function DurableMaterialSheet({ report, patchReport }: { report: WeeklyReportData; patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void }) {
  const cell = "border border-[#c2c2c2] px-0 py-0 align-middle";
  const header = `${cell} whitespace-normal break-words bg-[#e3e3e3] text-center text-[7px] leading-[1.05] font-medium text-[#111111]`;
  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    patchReport((current) => ({
      ...current,
      durableMaterialRows: current.durableMaterialRows.map((row, index) => index === rowIndex ? row.map((item, itemIndex) => itemIndex === columnIndex ? value : item) : row),
    }));
  };
  const planDate = <>Plan<br />Date</>;
  const actualDate = <>Actual<br />Date</>;
  const subHeadings = [
    planDate, actualDate, "Name", "Origin",
    planDate, actualDate, planDate, actualDate, planDate, actualDate,
    planDate, actualDate, planDate, actualDate, planDate, actualDate, planDate, actualDate,
  ];
  const primaryHeadings = [
    { key: "item", label: "Item" },
    { key: "uom", label: "U/M" },
    { key: "qty", label: "QTY" },
    { key: "plan-date", label: planDate },
    { key: "actual-date", label: actualDate },
    { key: "duration", label: "DURT" },
    { key: "origin", label: <>Foreign /<br />Local</> },
  ];
  const groupedHeadings = [
    { key: "inquiry", label: "Inquiry" },
    { key: "vendor", label: "Vendor" },
    { key: "tech-offer", label: <>Tech.<br />Offer<br />Status</> },
    { key: "tbe-cbe", label: <>TBE &amp; CBE<br />Issued</> },
    { key: "purchase-order", label: <>P.O<br />Placement</> },
    { key: "engineering", label: <>Completion<br />of Engineering</> },
    { key: "fabrication", label: "Fabrication" },
    { key: "inspection", label: "Inspection" },
    { key: "shipping", label: <>Shipping<br />documents</> },
    { key: "received", label: <>Received<br />at site</> },
  ];
  const columnWidths = [17, 3, 3, 4, 4, 3, 5, 3, 3, 5, 4, 4, ...Array.from({ length: 14 }, () => 3)];

  return (
    <WeeklySheet title="DURABLE MATERIAL" landscape compactHeader widerContent>
      <div className="flex h-full min-h-0 flex-col font-sans">
        <div className="flex h-[20px] shrink-0 items-center justify-center border-y border-[#a9a9a9] bg-[#c4c4c4] text-center text-[9px] font-semibold text-[#254e78]">Tag &amp; Bulk Items</div>
        <div className="min-h-0 flex-1 overflow-auto print:overflow-visible">
          <table className="w-full table-fixed border-collapse bg-white font-sans text-[8px] leading-[1.05] text-[#152536]">
            <colgroup>
              {columnWidths.map((width, index) => <col key={`durable-col-${index}`} style={{ width: `${width}%` }} />)}
            </colgroup>
            <thead>
              <tr className="h-[42px]">
                {primaryHeadings.map(({ key, label }) => <th key={key} rowSpan={2} className={header}>{label}</th>)}
                <th colSpan={2} className={header}>{groupedHeadings[0].label}</th>
                <th colSpan={2} className={header}>{groupedHeadings[1].label}</th>
                <th rowSpan={2} className={header}>{groupedHeadings[2].label}</th>
                {groupedHeadings.slice(3).map(({ key, label }) => <th key={key} colSpan={2} className={header}>{label}</th>)}
              </tr>
              <tr className="h-[42px]">
                {subHeadings.map((heading, index) => <th key={`durable-subhead-${index}`} className={header}>{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {report.durableMaterialRows.map((row, rowIndex) => (
                <tr key={`durable-row-${rowIndex}`} className="h-[18px]">
                  {Array.from({ length: 26 }, (_, columnIndex) => (
                    <td key={`durable-cell-${rowIndex}-${columnIndex}`} className={cell}>
                      <SheetInput ariaLabel={`Durable material row ${rowIndex + 1} column ${columnIndex + 1}`} value={row[columnIndex] ?? ""} centered={columnIndex !== 0} onChange={(value) => updateCell(rowIndex, columnIndex, value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </WeeklySheet>
  );
}

function EngineeringDocumentsSheet({ report, patchReport }: { report: WeeklyReportData; patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void }) {
  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    patchReport((current) => ({
      ...current,
      engineeringDocumentRows: current.engineeringDocumentRows.map((row, index) => index === rowIndex ? row.map((cell, cellIndex) => cellIndex === columnIndex ? value : cell) : row),
    }));
  };
  return (
    <EditableGridSheet
      title="ENGINEERING DOCUMENTS"
      sectionTitle="Documents' Status"
      headers={["Dis.", "Unit", "Document Number", "Document Description", "AFC Plan", "AFC Actual"]}
      widths={[5, 5, 24, 47, 9.5, 9.5]}
      rows={report.engineeringDocumentRows}
      onCellChange={updateCell}
    />
  );
}

function resizeSitePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Unable to decode image"));
      image.onload = () => {
        const scale = Math.min(1, 1000 / image.width, 700 / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas is unavailable"));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = String(reader.result ?? "");
    };
    reader.readAsDataURL(file);
  });
}

function SitePhotosSheet({ report, patchReport }: { report: WeeklyReportData; patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void }) {
  const updateLabel = (index: number, label: string) => {
    patchReport((current) => ({ ...current, sitePhotos: current.sitePhotos.map((photo, photoIndex) => photoIndex === index ? { ...photo, label } : photo) }));
  };
  const updatePhoto = async (index: number, file?: File) => {
    if (!file) return;
    try {
      const image = await resizeSitePhoto(file);
      patchReport((current) => ({ ...current, sitePhotos: current.sitePhotos.map((photo, photoIndex) => photoIndex === index ? { ...photo, image } : photo) }));
    } catch {
      // Keep the existing photo if the selected file cannot be read.
    }
  };

  return (
    <WeeklySheet title="SITE PHOTOS" fullBleed>
      <div className="relative h-full min-h-0">
        <div className="grid h-full grid-cols-2 grid-rows-4 gap-x-[12%] gap-y-[2.7%] px-[0.3%]">
          {report.sitePhotos.map((photo, index) => (
            <div key={`site-photo-${index}`} className="flex min-h-0 flex-col">
              <label className="relative min-h-0 flex-1 cursor-pointer overflow-hidden bg-[#08a9d6]" aria-label={`Upload site photo ${index + 1}`}>
                {photo.image ? (
                  <img src={photo.image} alt={`Site photo ${index + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#04a6d2] via-[#00b5df] to-[#0299c5]">
                    <div className="relative flex aspect-square h-[48%] items-center justify-center rounded-full border-[3px] border-cyan-100/25 shadow-[0_0_20px_5px_rgba(123,246,255,0.28)]">
                      <div className="absolute inset-[14%] rounded-full border-[2px] border-cyan-100/20 shadow-[0_0_14px_3px_rgba(154,255,255,0.24)]" />
                      <div className="absolute bottom-[8%] h-[8%] w-[28%] rounded-full bg-cyan-100/40 blur-[3px]" />
                    </div>
                  </div>
                )}
                <input type="file" accept="image/*" aria-label={`Choose site photo ${index + 1}`} onChange={(event) => { void updatePhoto(index, event.target.files?.[0]); event.target.value = ""; }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </label>
              <div className="mt-[2px] h-[20px] shrink-0 bg-[#bcbcbc] text-center">
                <input aria-label={`Site photo caption ${index + 1}`} value={photo.label} onChange={(event) => updateLabel(index, event.target.value)} className="h-full w-full border-0 bg-transparent text-center text-[9px] leading-[18px] text-[#111111] outline-none focus:bg-white/50" />
              </div>
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-sans text-[clamp(64px,13vw,100px)] font-light leading-none text-[#777777]/60 print:hidden">Page 1</div>
      </div>
    </WeeklySheet>
  );
}

function KeyMilestoneSheet({
  report,
  patchReport,
}: {
  report: WeeklyReportData;
  patchReport: (update: (current: WeeklyReportData) => WeeklyReportData) => void;
}) {
  const tableCell = "border border-[#b8b8b8] px-0 py-0 align-middle";
  const headingCell = `${tableCell} whitespace-nowrap bg-[#d2d2d2] px-0.5 text-center text-[clamp(7px,0.8vw,9px)] font-semibold text-[#111111]`;
  const dayCount = 31;
  const dayWidth = `${42.9 / dayCount}%`;
  const updateMilestone = (index: number, field: keyof KeyMilestoneRow, value: string) => {
    patchReport((current) => ({
      ...current,
      keyMilestones: current.keyMilestones.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row),
    }));
  };

  return (
    <WeeklySheet title="KEY MILESTONES" landscape>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#e9e9e9]">
        <div className="flex h-[clamp(16px,2vw,22px)] shrink-0 items-center justify-center border-y border-[#b8b8b8] bg-[#d3d3d3] text-center text-[clamp(9px,1.2vw,12px)] font-semibold text-[#355f91]">
          Milestones Gantt Chart
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <table className="h-full w-full table-fixed border-collapse bg-[#e9e9e9] font-sans text-[9px] leading-none text-[#111111]">
            <colgroup>
              <col style={{ width: "4.1%" }} />
              <col style={{ width: "4.1%" }} />
              <col style={{ width: "16.3%" }} />
              <col style={{ width: "8.15%" }} />
              <col style={{ width: "8.15%" }} />
              <col style={{ width: "8.15%" }} />
              <col style={{ width: "8.15%" }} />
              {Array.from({ length: dayCount }, (_, index) => <col key={`day-col-${index + 1}`} style={{ width: dayWidth }} />)}
            </colgroup>
            <thead>
              <tr className="h-[clamp(14px,1.8vw,20px)]">
                {["Dis.", "Unit", "Task", "Plan Start", "Plan Finish", "Actual Start", "Actual Finish"].map((heading) => (
                  <th key={heading} className={headingCell}>{heading}</th>
                ))}
                {Array.from({ length: dayCount }, (_, index) => (
                  <th key={`day-${index + 1}`} className={`${headingCell} px-0`}>
                    {index + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.keyMilestones.map((row, rowIndex) => {
                const sample = MILESTONE_SAMPLE_BARS[rowIndex];
                const planStart = timelineDay(row.planStart) ?? sample?.planStart ?? null;
                const planFinish = timelineDay(row.planFinish) ?? sample?.planFinish ?? null;
                const actualStart = timelineDay(row.actualStart) ?? sample?.actualStart ?? null;
                const actualFinish = timelineDay(row.actualFinish) ?? sample?.actualFinish ?? null;
                const actualColor = sample?.actualColor ?? "#8bd34c";

                return (
                  <tr key={`milestone-${rowIndex}`} className="h-[clamp(22px,3.6vw,40px)]">
                    <td className={`${tableCell} bg-[#e9e9e9]`}><SheetInput ariaLabel={`Milestone discipline ${rowIndex + 1}`} value={row.division} centered onChange={(value) => updateMilestone(rowIndex, "division", value)} /></td>
                    <td className={`${tableCell} bg-[#e9e9e9]`}><SheetInput ariaLabel={`Milestone unit ${rowIndex + 1}`} value={row.unit} centered onChange={(value) => updateMilestone(rowIndex, "unit", value)} /></td>
                    <td className={`${tableCell} bg-[#e9e9e9}`}><SheetInput ariaLabel={`Milestone task ${rowIndex + 1}`} value={row.task} onChange={(value) => updateMilestone(rowIndex, "task", value)} /></td>
                    <td className={`${tableCell} bg-[#e9e9e9}`}><SheetInput ariaLabel={`Milestone plan start ${rowIndex + 1}`} value={row.planStart} centered onChange={(value) => updateMilestone(rowIndex, "planStart", value)} /></td>
                    <td className={`${tableCell} bg-[#e9e9e9}`}><SheetInput ariaLabel={`Milestone plan finish ${rowIndex + 1}`} value={row.planFinish} centered onChange={(value) => updateMilestone(rowIndex, "planFinish", value)} /></td>
                    <td className={`${tableCell} bg-[#e9e9e9}`}><SheetInput ariaLabel={`Milestone actual start ${rowIndex + 1}`} value={row.actualStart} centered onChange={(value) => updateMilestone(rowIndex, "actualStart", value)} /></td>
                    <td className={`${tableCell} bg-[#e9e9e9}`}><SheetInput ariaLabel={`Milestone actual finish ${rowIndex + 1}`} value={row.actualFinish} centered onChange={(value) => updateMilestone(rowIndex, "actualFinish", value)} /></td>
                    {Array.from({ length: dayCount }, (_, dayIndex) => {
                      const day = dayIndex + 1;
                      const planned = planStart !== null && planFinish !== null && day >= planStart && day <= planFinish;
                      const actual = actualStart !== null && actualFinish !== null && day >= actualStart && day <= actualFinish;
                      return (
                        <td key={`milestone-${rowIndex}-day-${day}`} className="border-r border-b border-[#d0d0d0] p-0">
                          <div className="grid h-[clamp(22px,3.6vw,40px)] grid-rows-2">
                            <div className={`border-b border-[#c6c6c6] ${planned ? "bg-[#4c89e8]" : ""}`} />
                            <div style={actual ? { backgroundColor: actualColor } : undefined} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </WeeklySheet>
  );
}

export default function WeeklyReportWorkspace({
  lang,
  projectId,
}: {
  lang: Lang;
  projectId?: string;
}) {
  const rtl = lang === "fa";
  const storageKey = `weekly-report:${projectId?.trim() || "default"}`;
  const { projectScope, projectsByCluster } = useSystem();
  const projects = Object.values(projectsByCluster).flat();
  const routeProject = projects.find((project) => project.id === projectId || project.code === projectId);
  const scopedProject = projectScope ? projects.find((project) => project.id === projectScope.projectId) : undefined;
  const dailyProjectCode = routeProject?.code ?? scopedProject?.code ?? projectId?.trim() ?? projectScope?.projectId ?? "";
  const [activeTab, setActiveTab] = useState<WeeklyReportTab>("cover");
  const [report, setReport] = useState<WeeklyReportData>(makeDefaultReport);
  const [saveMessage, setSaveMessage] = useState("");
  const [narrativeImporting, setNarrativeImporting] = useState(false);
  const [narrativeImportMessage, setNarrativeImportMessage] = useState("");
  const isMultiPagePrintTab = activeTab === "delay" || activeTab === "manpower" || activeTab === "machinery";

  useEffect(() => {
    if (!isMultiPagePrintTab) return;
    document.body.classList.add("weekly-report-multipage-print-active");
    return () => document.body.classList.remove("weekly-report-multipage-print-active");
  }, [isMultiPagePrintTab]);

  useEffect(() => {
    let raw: string | null = null;
    let loaded = makeDefaultReport();
    try {
      raw = localStorage.getItem(storageKey);
      if (raw) loaded = normalizeStoredReport(JSON.parse(raw));
    } catch {
      raw = null;
      loaded = makeDefaultReport();
    }
    setReport(loaded);
    setSaveMessage("");

    // Normalize saved fields to the sheet structures and fixed row counts.
    if (raw) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(loaded));
      } catch {
        // Keep the loaded Cover visible even when browser storage is unavailable.
      }
    }
  }, [storageKey]);

  const patchReport = (update: (current: WeeklyReportData) => WeeklyReportData) => {
    setReport((current) => update(current));
    setSaveMessage("");
  };

  const updateCover = (next: WeeklyReportData) => patchReport(() => next);

  const updateField = <K extends keyof WeeklyReportData>(key: K, value: WeeklyReportData[K]) => {
    patchReport((current) => ({ ...current, [key]: value }));
  };

  const saveReport = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(report));
      setSaveMessage(rtl ? "در این مرورگر ذخیره شد" : "Saved in this browser");
    } catch {
      setSaveMessage(rtl ? "ذخیره‌سازی مرورگر در دسترس نیست" : "Browser storage is unavailable");
    }
  };

  const importNarrativeFromDaily = async () => {
    if (!dailyProjectCode) {
      setNarrativeImportMessage(rtl ? "پروژهٔ فعالی برای گزارش روزانه پیدا نشد." : "No active project is available for daily reports.");
      return;
    }
    if (!report.periodStart || !report.periodEnd) {
      setNarrativeImportMessage(rtl ? "ابتدا تاریخ شروع و پایان دورهٔ هفتگی را مشخص کنید." : "Set the weekly period start and end dates first.");
      return;
    }
    if (report.periodStart > report.periodEnd) {
      setNarrativeImportMessage(rtl ? "تاریخ شروع دوره بعد از تاریخ پایان است." : "The period start date is after the end date.");
      return;
    }

    setNarrativeImporting(true);
    setNarrativeImportMessage("");
    try {
      const sourcesByIso = new Map<string, DailyNarrativeSource>();
      let listFailed = false;
      let summaries: Awaited<ReturnType<typeof listDprReports>> = [];
      try {
        summaries = await listDprReports(dailyProjectCode);
      } catch {
        listFailed = true;
      }

      const matchingSummaries = summaries
        .map((summary) => ({ summary, isoDate: jalaliDateToIso(summary.date) }))
        .filter((item): item is { summary: (typeof summaries)[number]; isoDate: string } => Boolean(item.isoDate && item.isoDate >= report.periodStart && item.isoDate <= report.periodEnd))
        .sort((a, b) => a.isoDate.localeCompare(b.isoDate));

      const fetched = await Promise.allSettled(matchingSummaries.map(async ({ summary, isoDate }) => {
        const payload = await getDprReport(dailyProjectCode, summary.date);
        if (!payload.exists) return null;
        return { reportDate: summary.date, isoDate, report: payload.report } satisfies DailyNarrativeSource;
      }));
      fetched.forEach((result) => {
        if (result.status === "fulfilled" && result.value) sourcesByIso.set(result.value.isoDate, result.value);
      });

      try {
        const draftPrefix = `dpr-tables-draft:${dailyProjectCode}:`;
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          if (!key?.startsWith(draftPrefix)) continue;
          const draftDate = key.slice(draftPrefix.length);
          const draft = JSON.parse(localStorage.getItem(key) ?? "null") as DprTablesReport | null;
          if (!draft) continue;
          const reportDate = draft.reportDate || draftDate;
          const isoDate = jalaliDateToIso(reportDate);
          if (!isoDate || isoDate < report.periodStart || isoDate > report.periodEnd || sourcesByIso.has(isoDate)) continue;
          sourcesByIso.set(isoDate, { reportDate, isoDate, report: { ...draft, reportDate } });
        }
      } catch {
        // Continue with the daily reports that were loaded from the shared API.
      }

      const sources = [...sourcesByIso.values()].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
      if (!sources.length) {
        setNarrativeImportMessage(listFailed
          ? (rtl ? "گزارش روزانه از سرویس در دسترس نیست و پیش‌نویس محلی هم پیدا نشد." : "Daily reports are unavailable and no local drafts were found.")
          : (rtl ? "در بازهٔ انتخاب‌شده گزارش روزانه‌ای پیدا نشد." : "No daily reports were found in the selected period."));
        return;
      }

      const workEntries = new Map<string, RankedNarrativeEntry>();
      const concernEntries = new Map<string, RankedNarrativeEntry>();
      const addEntry = (target: Map<string, RankedNarrativeEntry>, text: string, source: DailyNarrativeSource, location = "") => {
        const key = normalizeNarrativeKey(text);
        if (!key) return;
        const existing = target.get(key) ?? { text, locations: new Set<string>(), dates: new Set<string>(), latestDate: source.isoDate };
        if (text.length > existing.text.length) existing.text = text;
        if (location) existing.locations.add(location);
        existing.dates.add(source.isoDate);
        if (source.isoDate > existing.latestDate) existing.latestDate = source.isoDate;
        target.set(key, existing);
      };

      sources.forEach((source) => {
        const narrative = source.report.narrative;
        const location = splitNarrativeEntries(narrative?.workFront ?? "").join(" / ");
        splitNarrativeEntries(narrative?.siteActivities ?? "").forEach((entry) => addEntry(workEntries, entry, source, location));
        [narrative?.areaOfConcerns ?? "", narrative?.areaOfConcerns2 ?? ""]
          .flatMap(splitNarrativeEntries)
          .forEach((entry) => addEntry(concernEntries, entry, source));
      });

      const rank = (a: RankedNarrativeEntry, b: RankedNarrativeEntry) =>
        b.dates.size - a.dates.size || b.latestDate.localeCompare(a.latestDate) || b.text.length - a.text.length;
      const workCandidates = [...workEntries.values()].sort(rank).slice(0, NARRATIVE_WORK_ROW_COUNT).map((entry) => ({
        task: entry.text,
        location: [...entry.locations].join(" / "),
      }));
      const concernCandidates = [...concernEntries.values()].sort(rank).slice(0, report.narrativeConcerns.length).map((entry) => entry.text);
      const mergedWorks = mergeWorkHighlights(report.performedWorks, workCandidates);
      const mergedConcerns = mergeConcernHighlights(report.narrativeConcerns, concernCandidates);

      patchReport((current) => ({
        ...current,
        performedWorks: mergeWorkHighlights(current.performedWorks, workCandidates).rows,
        narrativeConcerns: mergeConcernHighlights(current.narrativeConcerns, concernCandidates).rows,
      }));
      setNarrativeImportMessage(rtl
        ? `${sources.length} گزارش روزانه بررسی شد؛ ${mergedWorks.added} فعالیت و ${mergedConcerns.added} نگرانی در خانه‌های خالی افزوده شد. موارد تکراری اولویت گرفتند و داده‌های قبلی حفظ شدند.`
        : `${sources.length} daily reports reviewed; added ${mergedWorks.added} works and ${mergedConcerns.added} concerns to empty rows. Repeated entries were prioritized; existing data was preserved.`);
    } catch (error) {
      setNarrativeImportMessage(error instanceof Error
        ? (rtl ? `بارگذاری شرح روزانه ناموفق بود: ${error.message}` : `Daily narrative import failed: ${error.message}`)
        : (rtl ? "بارگذاری شرح روزانه ناموفق بود." : "Daily narrative import failed."));
    } finally {
      setNarrativeImporting(false);
    }
  };

  const printable = activeTab === "cover" || activeTab === "index" || activeTab === "hse" || activeTab === "narrative" || activeTab === "workFront" || activeTab === "keyMilestone" || activeTab === "pms" || activeTab === "summary" || activeTab === "sCurve" || activeTab === "delay" || activeTab === "manpower" || activeTab === "machinery" || activeTab === "consumingMaterial" || activeTab === "durableMaterial" || activeTab === "engineeringDocuments" || activeTab === "photos";
  const landscapePrint = activeTab === "keyMilestone" || activeTab === "pms" || activeTab === "sCurve" || activeTab === "delay" || activeTab === "manpower" || activeTab === "machinery" || activeTab === "durableMaterial";
  const printPageWidth = landscapePrint ? "285mm" : "198mm";
  const printPageHeight = landscapePrint ? "198mm" : "285mm";
  const multipagePrintContent = activeTab === "delay"
    ? <DelayWorkspace report={report} patchReport={patchReport} printRoot />
    : activeTab === "manpower"
      ? <ManpowerWorkspace report={report} patchReport={patchReport} printRoot />
      : activeTab === "machinery"
        ? <MachineryWorkspace report={report} patchReport={patchReport} printRoot />
        : null;

  return (
    <>
    <section className="space-y-3" dir={rtl ? "rtl" : "ltr"}>
      <style>{`
        .weekly-report-sheet {
          font-family: "Inter", "Vazirmatn", Arial, sans-serif;
          font-size: 10px;
          font-weight: 400;
          line-height: 1.4;
          letter-spacing: 0;
          font-kerning: normal;
          font-synthesis: none;
          -webkit-font-smoothing: antialiased;
        }
        .weekly-report-sheet * { font-family: inherit; }
        .weekly-report-page-title { font-family: Georgia, "Times New Roman", serif; }
        .weekly-report-print-portal { display: none; }
        @page { size: A4 ${landscapePrint ? "landscape" : "portrait"}; margin: 6mm; }
        @page weekly-report-landscape { size: A4 landscape; margin: 6mm; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          body.weekly-report-multipage-print-active > #root { display: none !important; }
          body.weekly-report-multipage-print-active > .weekly-report-print-portal { display: block !important; visibility: visible !important; }
          #weekly-report-print-root, #weekly-report-print-root * { visibility: visible !important; }
          #weekly-report-print-root { position: fixed !important; inset: 0 auto auto 0 !important; box-sizing: border-box !important; width: ${printPageWidth} !important; height: ${printPageHeight} !important; min-width: 0 !important; max-width: none !important; aspect-ratio: auto !important; margin: 0 !important; box-shadow: none !important; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          #weekly-report-print-root.weekly-report-landscape { page: weekly-report-landscape !important; width: 285mm !important; height: 198mm !important; }
          #weekly-report-print-root.weekly-report-multipage-print-root { position: static !important; inset: auto !important; display: block !important; box-sizing: border-box !important; width: auto !important; height: auto !important; min-width: 0 !important; max-width: none !important; margin: 0 !important; overflow: visible !important; }
          #weekly-report-print-root.weekly-report-multipage-print-root > .weekly-report-sheet { position: relative !important; inset: auto !important; display: block !important; box-sizing: border-box !important; width: 283mm !important; height: 196mm !important; min-width: 0 !important; max-width: none !important; margin: 0 auto !important; margin-block: 0 !important; page: weekly-report-landscape !important; break-after: auto !important; page-break-after: auto !important; break-inside: avoid !important; page-break-inside: avoid !important; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          #weekly-report-print-root.weekly-report-multipage-print-root > .weekly-report-sheet + .weekly-report-sheet { break-before: page !important; page-break-before: always !important; }
          .weekly-report-no-print { display: none !important; }
        }
      `}</style>

      <div className="weekly-report-no-print flex flex-wrap items-end gap-2 rounded-xl border b-line-soft bg-black/10 p-2 text-[10px]">
        <label className="flex flex-col gap-1">
          <span className="tx3">{rtl ? "شماره گزارش" : "Report No."}</span>
          <input value={report.reportNo} onChange={(event) => updateField("reportNo", event.target.value)} dir="ltr" className="w-52 rounded-lg border b-line-soft bg-black/20 px-2 py-1.5 font-mono tx1 outline-none focus:border-[var(--accent)]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="tx3">{rtl ? "تاریخ گزارش" : "Report date"}</span>
          <WeeklyReportDatePicker value={report.reportDate} rtl={rtl} onChange={(value) => updateField("reportDate", value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="tx3">{rtl ? "شروع دوره" : "Period start"}</span>
          <input type="date" value={report.periodStart} onChange={(event) => updateField("periodStart", event.target.value)} className="rounded-lg border b-line-soft bg-black/20 px-2 py-1.5 tx1 outline-none focus:border-[var(--accent)]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="tx3">{rtl ? "پایان دوره" : "Period end"}</span>
          <input type="date" value={report.periodEnd} onChange={(event) => updateField("periodEnd", event.target.value)} className="rounded-lg border b-line-soft bg-black/20 px-2 py-1.5 tx1 outline-none focus:border-[var(--accent)]" />
        </label>
        {activeTab === "narrative" && (
          <span className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => void importNarrativeFromDaily()} disabled={narrativeImporting} className="rounded-lg border border-sky-400/50 bg-sky-400/10 px-3 py-1.5 text-sky-200 transition hover:bg-sky-400/15 disabled:cursor-wait disabled:opacity-50">
              {narrativeImporting ? "⏳" : "↧"} {rtl ? "بارگذاری نکات مهم از گزارش روزانه" : "Load highlights from daily reports"}
            </button>
            {narrativeImportMessage && <span role="status" className="max-w-lg text-[9px] tx3">{narrativeImportMessage}</span>}
          </span>
        )}
        <span className="ms-auto flex items-center gap-1.5">
          {saveMessage && <span className="text-[9px] tx4">{saveMessage}</span>}
          <button type="button" onClick={saveReport} className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-emerald-200 transition hover:bg-emerald-400/15">
            💾 {rtl ? "ذخیره" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isMultiPagePrintTab) document.body.classList.add("weekly-report-multipage-print-active");
              window.print();
            }}
            disabled={!printable}
            className="rounded-lg border b-line-soft bg-black/15 px-3 py-1.5 tx2 transition hover:tx1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            🖨 {rtl ? "چاپ شیت جاری (A4)" : "Print current sheet (A4)"}
          </button>
        </span>
      </div>

      <nav className="weekly-report-no-print flex flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1" role="tablist" aria-label={rtl ? "شیت‌های گزارش هفتگی" : "Weekly report sheets"}>
        {WEEKLY_REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-2.5 py-1.5 text-[10px] transition ${activeTab === tab.id ? "toggle-on tx1" : "tx3 hover:tx1"}`}
          >
            {rtl ? tab.fa : tab.en}
          </button>
        ))}
      </nav>

      {activeTab === "cover" && <WeeklyCoverSheet report={report} rtl={rtl} update={updateCover} />}
      {activeTab === "index" && <WeeklyIndexSheet />}
      {activeTab === "hse" && <HseSheet report={report} patchReport={patchReport} />}
      {activeTab === "narrative" && <NarrativeSheet report={report} patchReport={patchReport} />}
      {activeTab === "workFront" && <WorkFrontSheet report={report} patchReport={patchReport} />}
      {activeTab === "manpower" && <ManpowerWorkspace report={report} patchReport={patchReport} />}
      {activeTab === "machinery" && <MachineryWorkspace report={report} patchReport={patchReport} />}
      {activeTab === "consumingMaterial" && <ConsumingMaterialSheet report={report} patchReport={patchReport} />}
      {activeTab === "durableMaterial" && <DurableMaterialSheet report={report} patchReport={patchReport} />}
      {activeTab === "engineeringDocuments" && <EngineeringDocumentsSheet report={report} patchReport={patchReport} />}
      {activeTab === "photos" && <SitePhotosSheet report={report} patchReport={patchReport} />}
      {activeTab === "keyMilestone" && <KeyMilestoneSheet report={report} patchReport={patchReport} />}
      {activeTab === "pms" && <ProjectProgressSheet report={report} patchReport={patchReport} />}
      {activeTab === "summary" && <SummarySheet report={report} patchReport={patchReport} />}
      {activeTab === "sCurve" && <SCurveWorkspace report={report} patchReport={patchReport} rtl={rtl} />}
      {activeTab === "delay" && <DelayWorkspace report={report} patchReport={patchReport} />}
    </section>
    {multipagePrintContent && typeof document !== "undefined" ? createPortal(
      <div className="weekly-report-print-portal">{multipagePrintContent}</div>,
      document.body,
    ) : null}
    </>
  );
}
