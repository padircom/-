import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { jalaaliMonthLength, toGregorian } from "jalaali-js";
import type { Lang } from "../data/framework";
import { DPR_MANPOWER, DPR_MANPOWER_GROUPS } from "../data/dprManpower";
import { DPR_MACHINERY, DPR_MACHINERY_GROUPS } from "../data/dprMachinery";
import {
  DPR_SITE_STATUSES,
  DPR_WEATHERS,
  activityCalc,
  activityHistoryKey,
  changeCalc,
  emptyReport,
  JALALI_MONTHS_FA,
  jalaliMonthNameFa,
  machineryTotals,
  manpowerTotals,
  materialBlockForRow,
  materialRowQty,
  normalizeReport,
  splitReportDate,
  type DprChangeRow,
  type DprHistory,
  type DprMainActivityRow,
  type DprMaterialRow,
  type DprReportStatus,
  type DprTablesReport,
  MATERIAL_CATALOG,
} from "../services/dprTables";
import {
  DprTablesError,
  dprReportAction,
  getDprReport,
  listDprReports,
  saveDprReport,
  type DprReportSummary,
} from "../services/dprTablesApi";

export interface DprIdentityInfo {
  reportNo: string;
  reportDate: string;
}

export interface DprGeneralInfo {
  siteStatus: string;
  weather: string;
  avgTemp: number | null;
  minTemp: number | null;
  maxTemp: number | null;
  humidity: number | null;
  workShift: string;
  landStatus: string;
}

type TabId = "site" | "narrative" | "manpower" | "machinery" | "materials" | "changes" | "activities";
type ReportTabId = "cover" | "narrative" | "manpower" | "machinery" | "materials" | "changes" | "activities";

const TABS: Array<{ id: TabId; fa: string; en: string }> = [
  { id: "site", fa: "وضعیت کارگاه", en: "Site status" },
  { id: "narrative", fa: "شرح تشریحی", en: "Narrative" },
  { id: "manpower", fa: "نیروی انسانی", en: "Manpower" },
  { id: "machinery", fa: "ماشین‌آلات", en: "Machinery" },
  { id: "materials", fa: "متریال وارده", en: "Materials" },
  { id: "changes", fa: "تغییرات و فعالیت", en: "Changes" },
  { id: "activities", fa: "PMS", en: "PMS" },
];

const REPORT_TABS: Array<{ id: ReportTabId; fa: string; en: string }> = [
  { id: "cover", fa: "کاور", en: "Cover" },
  { id: "narrative", fa: "شرح تشریحی", en: "Narrative" },
  { id: "manpower", fa: "نیروی انسانی", en: "Manpower" },
  { id: "machinery", fa: "ماشین‌آلات", en: "Machinery" },
  { id: "materials", fa: "متریال", en: "Material" },
  { id: "changes", fa: "تغییرات و فعالیت", en: "Changes" },
  { id: "activities", fa: "PMS", en: "PMS" },
];

const JALALI_MONTHS_EN = ["Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar", "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"];
const JALALI_WEEKDAYS_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const JALALI_WEEKDAYS_EN = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

const REPORT_MANPOWER_DIRECT_SECTIONS: Array<{ title: string; items: string[] }> = [
  {
    title: "Management",
    items: [
      "Execution Manager",
      "Execution Expert",
      "Execution Technician",
      "Supervisor",
    ],
  },
  {
    title: "Civil & Building",
    items: [
      "Foreman",
      "Concrete Tank-Wall Enforcement Cabling",
      "Bar Bender / Bolt Man",
      "Form Worker / Carpenter",
      "Concrete Worker / Pump Operator",
      "Asphalt Worker",
      "Batching Plant Operator",
      "Brick Layer / Mason / Tiler",
      "Painter / Plasterer",
      "Plumber",
      "Welder",
      "Welder Helper",
      "Water Proofing Worker",
      "Others",
    ],
  },
  {
    title: "Steel Structure",
    items: [
      "Foreman",
      "Grouter",
      "Assembler",
      "Steel / Iron Worker",
      "Helper",
      "Welder",
      "Welder Helper",
      "Others",
    ],
  },
  {
    title: "Piping",
    items: [
      "Foreman Weld/Fit Up",
      "Cutter / Bender / Grinder",
      "Bevel Machine Operator",
      "Bonder",
      "Bonder helper",
      "Pipe Fitter-1(First Level)",
      "Pipe Fitter-2(Second Level)",
      "Fitter Helper",
      "Tack Welder",
      "Pipe Welder ( ARC )",
      "Pipe Welder ( TIG )",
      "Pipe Welder ( TIG + ARC )",
      "Pipe Welder ( CO₂ )",
      "Pipe Support Welder",
      "Welder Helper",
      "Pipe Wrapper",
      "Assembler",
      "Punchist",
      "Test Man",
      "Test Man Helper",
      "Others",
    ],
  },
  {
    title: "Electrical & Instrumentation",
    items: [
      "Foreman",
      "Technician - Electrical",
      "Technician - Instrumentation",
      "Installer",
      "Cable Man",
      "Calibrator",
      "Connection Man",
      "Welder",
      "Helper",
      "Termination installer",
      "Others",
    ],
  },
  {
    title: "Equipment & Tanks",
    items: [
      "Foreman",
      "Technician - Mechanical",
      "Mechanical Fitter",
      "Plate Welder",
      "Tank Welder",
      "Welder Helper",
      "Assembler",
      "Assembler Helper",
      "Equipment Erector",
      "Millwright",
      "Alignment & Calibrator",
      "Others",
    ],
  },
  {
    title: "Paint & Insulation",
    items: [
      "Foreman",
      "Sand Blaster",
      "Sand Blast Helper",
      "Painter",
      "Insulator - Equipment",
      "Insulator - Pipe",
      "Insulator Helper",
      "Others",
    ],
  },
  {
    title: "General",
    items: [
      "Controller",
      "Scaffolder Forman",
      "Scaffolder",
      "Scaffolder Helper",
      "Skilled Labor",
      "Common Labor",
      "Equipment Operator",
      "Heavy Vehicle Driver",
      "Rigger",
      "Others",
    ],
  },
];

const REPORT_MANPOWER_INDIRECT_SECTIONS: Array<{ title: string; items: string[] }> = [
  {
    title: "Management",
    items: [
      "Project Manager / Director",
      "Site Manager / Deputy",
    ],
  },
  {
    title: "Construction",
    items: [
      "Construction Manager / Deputy",
      "Area/Discipline Manager(Superintendent)",
      "Superintendent",
      "Civil & Building - Supervisor",
      "Steel Structure - Supervisor",
      "Piping - Supervisor",
      "Equipment & Tanks - Supervisor",
      "Electrical - Supervisor",
      "Instrument - Supervisor",
      "Telecommunication - Supervisor",
      "Insulation & Paint - Supervisor",
      "Others",
    ],
  },
  {
    title: "Technical Office",
    items: [
      "Technical Office Manager / Deputy",
      "Technical Office - Engineers",
      "Technical Office - Technicians",
      "Document Controller",
      "Others",
    ],
  },
  {
    title: "Planning & Project Control",
    items: [
      "Planning & Control Manager / Deputy",
      "Planning & Control - Engineers",
      "Planning & Control - Technicians",
      "Others",
    ],
  },
  {
    title: "IT & Communication",
    items: [
      "IT & Communication Manager / Deputy",
      "Engineers / Technicians",
      "Others",
    ],
  },
  {
    title: "QA / QC",
    items: [
      "QC Manager / Deputy",
      "QC - Engineers",
      "QC - Technicians",
      "Concrete Lab.",
      "Soil Mechanic Lab.",
      "NDT Controller / Radiography",
      "PWHT Man",
      "Staff",
      "Others",
    ],
  },
  {
    title: "HSE",
    items: [
      "HSE Manager / Deputy",
      "HSE - Supervisor",
      "HSE - Officer",
      "Doctor",
      "Nurse",
      "HSE Driver",
      "Others",
    ],
  },
  {
    title: "Material Control",
    items: [
      "Material Control Manager / Deputy",
      "Custom Clearance",
      "Spool Man",
      "Warehouse - Material Man",
      "Warehouse - Tool Man",
      "Material Helper",
      "Others",
    ],
  },
  {
    title: "Finance / Cost / Contracts",
    items: [
      "Finance Manager",
      "Finance / Accountant",
      "Cost Control",
      "Contracts",
      "Others",
    ],
  },
  {
    title: "Survey",
    items: [
      "Surveyor Manager",
      "Surveyor",
      "Surveyor Helper",
    ],
  },
  {
    title: "Facility / Maintenance",
    items: [
      "Manager",
      "Electrician",
      "Serviceman",
      "Motor Man",
      "Others",
    ],
  },
  {
    title: "Security",
    items: [
      "Security Manager / Deputy",
      "Guardian",
    ],
  },
  {
    title: "Logistics",
    items: [
      "Logistics Manager / Deputy",
      "Local Procurement / Purchaser",
      "Transportation Office",
      "Administration / Clerk",
      "Light Vehicle Driver",
      "Maintenance / General Services - Site",
      "Maintenance / General Services - Camp",
      "Others",
    ],
  },
];

const STATUS_FA: Record<DprReportStatus, string> = { draft: "پیش‌نویس", submitted: "ارسال‌شده", approved: "تأییدشده" };
const STATUS_COLOR: Record<DprReportStatus, string> = { draft: "#9AA4B2", submitted: "#7FB2FF", approved: "#8FE3C8" };

/** نرمال‌سازی ارقام فارسی/عربی به لاتین. */
function faDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

/** تبدیل ارقام لاتین/عربی به فارسی برای نمایش تاریخ در هدر گزارشات روزانه. */
function toPersianDigits(s: string): string {
  return String(s ?? "")
    .replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 1728))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 144));
}

function todayJalali(): string {
  try {
    const parts = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const g = (t: string) => faDigits(parts.find((p) => p.type === t)?.value ?? "");
    return `${g("year")}/${g("month")}/${g("day")}`;
  } catch {
    return "";
  }
}

function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${Math.round(v * 100) / 100}%`;
}

function fmtQty(v: number | null): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US");
}

function groupOrder(codes: Array<{ code: string; group: string }>): string[] {
  const out: string[] = [];
  for (const r of codes) if (!out.includes(r.group)) out.push(r.group);
  return out;
}

/* ── سلول عددی با حالت محلی: تایپ روان بدون بازرندر کل جدول ──────── */
function CellNum({
  value,
  onCommit,
  disabled,
  resetKey,
  wide,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  disabled: boolean;
  resetKey: string;
  wide?: boolean;
}) {
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value));
  useEffect(() => {
    setText(value === null || value === undefined ? "" : String(value));
  }, [value, resetKey]);
  const commit = () => {
    const t = faDigits(text).trim();
    if (t === "") {
      onCommit(null);
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) {
      setText(value === null || value === undefined ? "" : String(value));
      return;
    }
    onCommit(n);
  };
  return (
    <input
      value={text}
      disabled={disabled}
      dir="ltr"
      inputMode="decimal"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={`${wide ? "w-24" : "w-16"} rounded-md border b-line-soft bg-black/20 px-1 py-0.5 text-center tabular-nums tx1 outline-none focus:border-[var(--accent)] disabled:opacity-50`}
    />
  );
}

/* ── سلول متنی کوتاه با حالت محلی ───────────────────────────────── */
function CellText({
  value,
  onCommit,
  disabled,
  resetKey,
  listId,
  placeholder,
  align,
}: {
  value: string;
  onCommit: (v: string) => void;
  disabled: boolean;
  resetKey: string;
  listId?: string;
  placeholder?: string;
  align?: "start" | "center";
}) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => {
    setText(value ?? "");
  }, [value, resetKey]);
  return (
    <input
      value={text}
      disabled={disabled}
      list={listId}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={`w-full min-w-16 rounded-md border b-line-soft bg-black/20 px-1.5 py-0.5 tx1 outline-none placeholder:text-[8px] focus:border-[var(--accent)] disabled:opacity-50 ${align === "center" ? "text-center" : "text-start"}`}
    />
  );
}

const th = "border-e border-b b-line-soft px-1.5 py-2 text-center font-normal whitespace-nowrap";
const td = "border-e b-line-soft px-1.5 py-1 text-center";
const tdL = "border-e b-line-soft px-1.5 py-1 text-start";
const calc = "bg-black/10 tx2 tabular-nums";

export default function DprSupportTables({
  lang,
  projectCode,
  canEdit,
  onIdentity,
  onGeneralStatus,
}: {
  lang: Lang;
  projectCode: string;
  canEdit: boolean;
  onIdentity?: (info: DprIdentityInfo) => void;
  onGeneralStatus?: (info: DprGeneralInfo) => void;
}) {
  const rtl = lang === "fa";
  const [viewMode, setViewMode] = useState<"support" | "cover">("support");
  const [tab, setTab] = useState<TabId>("site");
  const [reportTab, setReportTab] = useState<ReportTabId>("cover");
  const activeTab = viewMode === "cover" ? reportTab : tab;
  const [dateText, setDateText] = useState(todayJalali());
  const [date, setDate] = useState(todayJalali());
  const initialCalendarDate = splitReportDate(todayJalali()) ?? { year: 1403, month: 1, day: 1 };
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState(initialCalendarDate.year);
  const [calendarMonth, setCalendarMonth] = useState(initialCalendarDate.month);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<DprTablesReport | null>(null);
  const [history, setHistory] = useState<DprHistory>({ changes: {}, activities: {} });
  const [summaries, setSummaries] = useState<DprReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [localOnly, setLocalOnly] = useState(false);
  const [filter, setFilter] = useState("");
  const [changeFilter, setChangeFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [materialCatalog, setMaterialCatalog] = useState<Array<[string, string]>>([...MATERIAL_CATALOG]);
  const [newMaterialCode, setNewMaterialCode] = useState("");
  const [newMaterialDesc, setNewMaterialDesc] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [coverLogos, setCoverLogos] = useState<{ client: string | null; consultant: string | null; contractor: string | null }>({
    client: null,
    consultant: null,
    contractor: null,
  });

  const [coverSheet, setCoverSheet] = useState({
    weatherChoice: "Sunny" as "Sunny" | "Windy" | "Cloudy" | "Rainy" | "Snowy",
    tempMin: "",
    tempMax: "",
    workShift: "Day Shift",
    landStatus: "",
    comment: "",
    indirectActive: "",
    indirectInactive: "",
    indirectPlural: "",
    directActive: "",
    directInactive: "",
    directPlural: "",
    machineryActive: "",
    machineryInactive: "",
    machineryPlural: "",
    mainQuantities: [
      { desc: "Excavation & Leveling", contractQty: "", unit: "", lastPeriod: "", today: "", upToNow: "" },
      { desc: "Rebar Work", contractQty: "", unit: "", lastPeriod: "", today: "", upToNow: "" },
      { desc: "Form Work", contractQty: "", unit: "", lastPeriod: "", today: "", upToNow: "" },
      { desc: "Concrete Pouring/Curing", contractQty: "", unit: "", lastPeriod: "", today: "", upToNow: "" },
    ],
    preparedSign: "",
    siteManagerSign: "",
    approvedName: "",
    approvedSign: "",
    receivedName: "",
    receivedSign: "",
    manpowerRows: {} as Record<string, { day: string; night: string; last: string; cum: string }>,
    manpowerSigns: { preparedBy: "", approvedBy: "", confirmedBy: "" },
    machineryRows: {} as Record<string, { day: string; night: string; idle: string; repair: string }>,
    machinerySigns: { preparedBy: "", approvedSiteManager: "", approvedSupervisor: "", receivedBy: "" },
    machineryHeader: { con: "", line1: "", line2: "" },
    materialSheetRows: {} as Record<string, { desc: string; unit: string; upToLast: string; today: string; upToNow: string }>,
    materialSigns: { preparedBy: "", approvedSiteManager: "", approvedOiec: "", receivedOiec: "" },
    narrativeAreaOfConcerns2: "",
  });

  useEffect(() => {
    const storageKey = `dpr-cover-sheet:${projectCode}:${date}`;
    const emptyCoverState = {
      weatherChoice: "Sunny" as "Sunny" | "Windy" | "Cloudy" | "Rainy" | "Snowy",
      tempMin: "",
      tempMax: "",
      workShift: "Day Shift",
      landStatus: "",
      comment: "",
      indirectActive: "",
      indirectInactive: "",
      indirectPlural: "",
      directActive: "",
      directInactive: "",
      directPlural: "",
      machineryActive: "",
      machineryInactive: "",
      machineryPlural: "",
      mainQuantities: [
        { desc: "Excavation & Leveling", contractQty: "", unit: "", lastPeriod: "", today: "", upToNow: "" },
        { desc: "Rebar Work", contractQty: "", unit: "", lastPeriod: "", today: "", upToNow: "" },
        { desc: "Form Work", contractQty: "", unit: "", lastPeriod: "", today: "", upToNow: "" },
        { desc: "Concrete Pouring/Curing", contractQty: "", unit: "", lastPeriod: "", today: "", upToNow: "" },
      ],
      preparedSign: "",
      siteManagerSign: "",
      approvedName: "",
      approvedSign: "",
      receivedName: "",
      receivedSign: "",
      manpowerRows: {} as Record<string, { day: string; night: string; last: string; cum: string }>,
      manpowerSigns: { preparedBy: "", approvedBy: "", confirmedBy: "" },
      machineryRows: {} as Record<string, { day: string; night: string; idle: string; repair: string }>,
      machinerySigns: { preparedBy: "", approvedSiteManager: "", approvedSupervisor: "", receivedBy: "" },
      machineryHeader: { con: "", line1: "", line2: "" },
      materialSheetRows: {} as Record<string, { desc: string; unit: string; upToLast: string; today: string; upToNow: string }>,
      materialSigns: { preparedBy: "", approvedSiteManager: "", approvedOiec: "", receivedOiec: "" },
      narrativeAreaOfConcerns2: "",
    };
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<typeof coverSheet>;
        setCoverSheet({
          ...emptyCoverState,
          ...parsed,
          mainQuantities: parsed.mainQuantities?.length ? parsed.mainQuantities : emptyCoverState.mainQuantities,
          manpowerRows: parsed.manpowerRows ?? {},
          manpowerSigns: parsed.manpowerSigns ?? { preparedBy: "", approvedBy: "", confirmedBy: "" },
          machineryRows: parsed.machineryRows ?? {},
          machinerySigns: parsed.machinerySigns ?? { preparedBy: "", approvedSiteManager: "", approvedSupervisor: "", receivedBy: "" },
          machineryHeader: parsed.machineryHeader ?? { con: "", line1: "", line2: "" },
          materialSheetRows: parsed.materialSheetRows ?? {},
          materialSigns: parsed.materialSigns ?? { preparedBy: "", approvedSiteManager: "", approvedOiec: "", receivedOiec: "" },
          narrativeAreaOfConcerns2: parsed.narrativeAreaOfConcerns2 ?? "",
        });
      } else {
        setCoverSheet(emptyCoverState);
      }
    } catch {
      setCoverSheet(emptyCoverState);
    }
  }, [projectCode, date]);

  const patchCoverSheet = (fn: (prev: typeof coverSheet) => typeof coverSheet) => {
    setCoverSheet((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(`dpr-cover-sheet:${projectCode}:${date}`, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const importCoverLogo = (who: "client" | "consultant" | "contractor", files: FileList | null) => {
    if (!files?.length) return;
    const reader = new FileReader();
    reader.onload = () => setCoverLogos((prev) => ({ ...prev, [who]: String(reader.result) }));
    reader.readAsDataURL(files[0]);
  };

  // جدول‌های روزانه در وضعیت پیش‌نویس برای ورود و محاسبهٔ محلی قابل ویرایش‌اند؛
  // مجوز همچنان فقط ذخیره/ارسال را کنترل می‌کند.
  const locked = !report || report.status !== "draft";
  const canPersist = canEdit;
  const resetKey = `${projectCode}:${date}:${report?.updatedAt ?? "new"}`;
  const draftKey = `dpr-tables-draft:${projectCode}:${date}`;

  const manGroups = useMemo(() => groupOrder(DPR_MANPOWER), []);
  const macGroups = useMemo(() => groupOrder(DPR_MACHINERY), []);
  const manTotals = useMemo(() => manpowerTotals(report?.manpower ?? {}), [report?.manpower]);
  const macTotals = useMemo(() => machineryTotals(report?.machinery ?? {}), [report?.machinery]);
  const owners = useMemo(() => {
    const s = new Set<string>();
    for (const e of Object.values(report?.machinery ?? {})) {
      if (e?.owner?.trim()) s.add(e.owner.trim());
    }
    return [...s];
  }, [report?.machinery]);
  const knownChangeIds = useMemo(() => Object.keys(history.changes), [history]);
  const monthInfo = useMemo(() => {
    const p = splitReportDate(date);
    return p ? { label: `${jalaliMonthNameFa(p.month)} ${p.year}`, month: p.month, year: p.year } : null;
  }, [date]);
  const calendarCells = useMemo(() => {
    const firstDay = toGregorian(calendarYear, calendarMonth, 1);
    const weekday = new Date(Date.UTC(firstDay.gy, firstDay.gm - 1, firstDay.gd)).getUTCDay();
    const offsetFromSaturday = (weekday + 1) % 7;
    const cells: Array<number | null> = Array.from({ length: offsetFromSaturday }, () => null);
    const monthLength = jalaaliMonthLength(calendarYear, calendarMonth);
    for (let day = 1; day <= monthLength; day += 1) cells.push(day);
    return cells;
  }, [calendarYear, calendarMonth]);
  const calendarToday = todayJalali();

  useEffect(() => {
    if (!projectCode) return;
    listDprReports(projectCode).then(setSummaries).catch(() => setSummaries([]));
  }, [projectCode]);

  useEffect(() => {
    if (!projectCode || !splitReportDate(date)) return;
    setLoading(true);
    setError("");
    getDprReport(projectCode, date)
      .then((payload) => {
        setHistory(payload.history);
        if (payload.exists) {
          setReport(normalizeReport(payload.report));
          setLocalOnly(false);
          try {
            localStorage.removeItem(draftKey);
          } catch { /* ignore */ }
        } else {
          let draft: DprTablesReport | null = null;
          try {
            const raw = localStorage.getItem(draftKey);
            if (raw) draft = JSON.parse(raw) as DprTablesReport;
          } catch { /* ignore */ }
          if (draft && draft.reportDate === date) {
            setReport(normalizeReport(draft));
            setLocalOnly(true);
          } else {
            const shell = emptyReport(projectCode, date, payload.suggestedNo || "DRT-001");
            setReport(shell);
            setLocalOnly(false);
          }
        }
      })
      .catch((e) => {
        let draft: DprTablesReport | null = null;
        try {
          const raw = localStorage.getItem(draftKey);
          if (raw) draft = JSON.parse(raw) as DprTablesReport;
        } catch { /* ignore */ }
        if (draft && draft.reportDate === date) {
          setReport(normalizeReport(draft));
          setHistory({ changes: {}, activities: {} });
          setLocalOnly(true);
          setError("");
        } else {
          setReport(emptyReport(projectCode, date, ""));
          setError(e instanceof Error ? e.message : "خطا");
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, date]);

  useEffect(() => {
    if (!calendarOpen) return;
    const dismissOnOutsideClick = (event: PointerEvent) => {
      if (!datePickerRef.current?.contains(event.target as Node)) setCalendarOpen(false);
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

  /* سربرگ گزارش روزانه آینهٔ همین هویت و وضعیت عمومی است (تک‌منبعی). */
  useEffect(() => {
    onIdentity?.({ reportNo: report?.reportNo ?? "", reportDate: date });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.reportNo, date]);
  useEffect(() => {
    onGeneralStatus?.({
      siteStatus: report?.site.siteStatus ?? "",
      weather: report?.site.weather ?? "",
      avgTemp: report?.site.avgTemp ?? null,
      minTemp: report?.site.minTemp ?? null,
      maxTemp: report?.site.maxTemp ?? null,
      humidity: report?.site.humidity ?? null,
      workShift: report?.site.workShift ?? "",
      landStatus: report?.site.landStatus ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.site.siteStatus, report?.site.weather, report?.site.avgTemp, report?.site.minTemp, report?.site.maxTemp, report?.site.humidity, report?.site.workShift, report?.site.landStatus]);

  if (!projectCode) {
    return (
      <section className="glass-dark rounded-2xl p-4" dir={rtl ? "rtl" : "ltr"}>
        <p className="text-[11px] tx3">{rtl ? "برای ثبت جداول پشتیبان، ابتدا یک پروژه انتخاب کنید." : "Select a project first."}</p>
      </section>
    );
  }

  const commitDate = () => {
    const t = faDigits(dateText).trim();
    if (splitReportDate(t)) {
      setDate(t);
      setError("");
    } else {
      setError(rtl ? "تاریخ باید شمسی YYYY/MM/DD باشد (مثل 1403/08/26)" : "Date must be YYYY/MM/DD");
    }
  };

  const toggleDateCalendar = () => {
    if (!calendarOpen) {
      const selected = splitReportDate(faDigits(dateText).trim()) ?? splitReportDate(date) ?? initialCalendarDate;
      setCalendarYear(selected.year);
      setCalendarMonth(selected.month);
    }
    setCalendarOpen((open) => !open);
  };

  const shiftCalendarMonth = (offset: number) => {
    const totalMonths = calendarYear * 12 + (calendarMonth - 1) + offset;
    const nextYear = Math.floor(totalMonths / 12);
    if (nextYear < 1300 || nextYear > 1500) return;
    setCalendarYear(nextYear);
    setCalendarMonth((totalMonths % 12) + 1);
  };

  const chooseCalendarDate = (day: number) => {
    const selected = `${calendarYear}/${String(calendarMonth).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
    setDateText(selected);
    setDate(selected);
    setError("");
    setCalendarOpen(false);
  };

  const patch = (fn: (r: DprTablesReport) => DprTablesReport) => setReport((r) => (r ? fn(r) : r));

  const save = async () => {
    if (!report || locked || !canPersist) return;
    setSaving(true);
    setError("");
    const effectiveReportNo = report.reportNo.trim() || "DRT-001";
    const payload: DprTablesReport = {
      ...report,
      reportNo: effectiveReportNo,
      site: { ...report.site, reportDate: date, reportNo: effectiveReportNo },
    };
    try {
      const res = await saveDprReport(projectCode, date, payload);
      setReport(res.report);
      setHistory(res.history);
      setLocalOnly(false);
      try {
        localStorage.removeItem(draftKey);
      } catch { /* ignore */ }
      listDprReports(projectCode).then(setSummaries).catch(() => {});
    } catch (e) {
      if (e instanceof DprTablesError) {
        setError(e.message);
      } else {
        try {
          localStorage.setItem(draftKey, JSON.stringify(payload));
        } catch { /* ignore */ }
        setLocalOnly(true);
        setError(rtl ? "سرور در دسترس نیست — پیش‌نویس محلی ذخیره شد" : "Server unreachable — local draft saved");
      }
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: "submit" | "approve" | "return") => {
    if (!report || !canEdit) return;
    setActing(true);
    setError("");
    try {
      const res = await dprReportAction(projectCode, date, action);
      patch((r) => ({ ...r, status: res.status }));
      listDprReports(projectCode).then(setSummaries).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setActing(false);
    }
  };

  const setMan = (code: string, k: "pd" | "ad" | "pn" | "an", v: number | null) => {
    patch((r) => {
      const next = { ...r.manpower };
      const cur = next[code] ?? { pd: 0, ad: 0, pn: 0, an: 0 };
      const e = { ...cur, [k]: v ?? 0 };
      if (!e.pd && !e.ad && !e.pn && !e.an) delete next[code];
      else next[code] = e;
      return { ...r, manpower: next };
    });
  };

  const setMac = (code: string, k: "active" | "ready" | "repair", v: number | null) => {
    patch((r) => {
      const next = { ...r.machinery };
      const cur = next[code] ?? { active: 0, ready: 0, repair: 0, owner: "" };
      const e = { ...cur, [k]: v ?? 0 };
      if (!e.active && !e.ready && !e.repair && !e.owner.trim()) delete next[code];
      else next[code] = e;
      return { ...r, machinery: next };
    });
  };

  const setMacOwner = (code: string, v: string) => {
    patch((r) => {
      const next = { ...r.machinery };
      const cur = next[code] ?? { active: 0, ready: 0, repair: 0, owner: "" };
      const e = { ...cur, owner: v.slice(0, 120) };
      if (!e.active && !e.ready && !e.repair && !e.owner.trim()) delete next[code];
      else next[code] = e;
      return { ...r, machinery: next };
    });
  };

  const patchChange = (i: number, fn: (c: DprChangeRow) => DprChangeRow) => {
    patch((r) => ({ ...r, changes: r.changes.map((c, j) => (j === i ? fn(c) : c)) }));
  };

  const patchActivity = (i: number, fn: (a: DprMainActivityRow) => DprMainActivityRow) => {
    patch((r) => ({ ...r, activities: r.activities.map((a, j) => (j === i ? fn(a) : a)) }));
  };

  const patchMaterial = (i: number, fn: (m: DprMaterialRow) => DprMaterialRow) => {
    patch((r) => ({ ...r, materials: r.materials.map((m, j) => (j === i ? fn(m) : m)) }));
  };

  const matchFilter = (title: string, code: string) => {
    const f = filter.trim().toLowerCase();
    if (!f) return true;
    return title.toLowerCase().includes(f) || code.toLowerCase().includes(f);
  };

  const statusChip = (st: DprReportStatus) => (
    <span className="rounded px-2 py-0.5 text-[8.5px]" style={{ background: `${STATUS_COLOR[st]}22`, color: STATUS_COLOR[st] }}>
      {rtl ? STATUS_FA[st] : st}
    </span>
  );

  const toggleGroup = (key: string) => setOpenGroups((p) => ({ ...p, [key]: !(p[key] ?? true) }));

  const coverLogoBox = (who: "client" | "consultant" | "contractor", caption: string) => (
    <div className="flex flex-col items-center gap-0.5">
      <input type="file" hidden accept="image/*" id={`dpr-cover-logo-${who}`} onChange={(e) => importCoverLogo(who, e.target.files)} />
      <button
        type="button"
        onClick={() => document.getElementById(`dpr-cover-logo-${who}`)?.click()}
        className={`grid h-12 w-24 place-items-center overflow-hidden rounded border border-dashed border-neutral-400 bg-neutral-50 text-[9px] text-neutral-600 transition hover:border-blue-600 ${
          coverLogos[who] ? "has-logo" : "no-print-placeholder"
        }`}
      >
        {coverLogos[who] ? <img src={coverLogos[who]!} alt={caption} className="h-full w-full object-contain" /> : `+ ${caption}`}
      </button>
    </div>
  );

  const indActDefault = manTotals.indirect.pd + manTotals.indirect.pn;
  const indInactDefault = manTotals.indirect.ad + manTotals.indirect.an;
  const dirActDefault = manTotals.direct.pd + manTotals.direct.pn;
  const dirInactDefault = manTotals.direct.ad + manTotals.direct.an;
  const macActDefault = macTotals.active;
  const macInactDefault = macTotals.ready + macTotals.repair;

  let indHistCum = 0;
  let dirHistCum = 0;
  for (const m of DPR_MANPOWER) {
    const hVal = history.manpower?.[m.code] ?? 0;
    if (m.kind === "indirect") indHistCum += hVal;
    else dirHistCum += hVal;
  }
  let macHistCum = 0;
  for (const m of DPR_MACHINERY) {
    macHistCum += history.machinery?.[m.code] ?? 0;
  }

  const indActVal = indActDefault ? String(indActDefault) : "";
  const indInactVal = indInactDefault ? String(indInactDefault) : "";
  const indTotNum = (Number(indActVal) || 0) + (Number(indInactVal) || 0);
  const indPluralDefault = indHistCum + manTotals.indirect.total;
  const indPluralVal = indPluralDefault ? String(indPluralDefault) : "";

  const dirActVal = dirActDefault ? String(dirActDefault) : "";
  const dirInactVal = dirInactDefault ? String(dirInactDefault) : "";
  const dirTotNum = (Number(dirActVal) || 0) + (Number(dirInactVal) || 0);
  const dirPluralDefault = dirHistCum + manTotals.direct.total;
  const dirPluralVal = dirPluralDefault ? String(dirPluralDefault) : "";

  const totActNum = (Number(indActVal) || 0) + (Number(dirActVal) || 0);
  const totInactNum = (Number(indInactVal) || 0) + (Number(dirInactVal) || 0);
  const totAllNum = indTotNum + dirTotNum;
  const totPluralNum = (Number(indPluralVal) || 0) + (Number(dirPluralVal) || 0);

  const macActVal = macActDefault ? String(macActDefault) : "";
  const macInactVal = macInactDefault ? String(macInactDefault) : "";
  const macTotNum = (Number(macActVal) || 0) + (Number(macInactVal) || 0);
  const macPluralDefault = macHistCum + macActDefault;
  const macPluralVal = macPluralDefault ? String(macPluralDefault) : "";

  const coverMainQuantities = coverSheet.mainQuantities.map((row, idx) => {
    const activity = report?.activities[idx];
    if (!activity) return { ...row, desc: "", contractQty: "", unit: "", lastPeriod: "", today: "", upToNow: "" };
    const key = activityHistoryKey(activity.acCode, activity.activity);
    const calc = activityCalc(activity.estimated, history.activities[key] ?? 0, activity.todayQty);
    return {
      ...row,
      desc: activity.activity,
      contractQty: String(activity.boq ?? activity.estimated ?? ""),
      unit: activity.unit,
      lastPeriod: String(calc.lastCum),
      today: activity.todayQty === null ? "" : String(activity.todayQty),
      upToNow: String(calc.cum),
    };
  });

  return (
    <section id="dpr-support-tables" className="glass-dark scroll-mt-4 space-y-3 rounded-2xl p-3" dir={rtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tx1">
            {viewMode === "cover"
              ? rtl ? "گزارش روزانه (Daily Report)" : "Daily Report"
              : rtl ? "پشتیبان گزارش روزانه" : "Daily report support"}
          </h3>
          <p className="mt-1 text-[10px] tx3">
            {viewMode === "cover"
              ? rtl
                ? "کاور و فرم رسمی گزارش روزانه — متصل به داده‌های پشتیبان گزارش روزانه با کلید مشترک تاریخ و شماره گزارش."
                : "Official daily report cover — synced with daily report support tables by date and report number."
              : rtl
                ? "وضعیت کارگاه، شرح تشریحی، نیروی انسانی، ماشین‌آلات، متریال وارده، تغییرات و فعالیت‌های اصلی — با کلید مشترک تاریخ و شماره گزارش."
                : "Site status, narrative, manpower, machinery, materials, changes and main activities — keyed by date and report number."}
          </p>
        </div>
        {viewMode === "cover" && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border b-line-soft bg-black/15 px-3 py-1.5 text-[10px] tx2 transition hover:tx1"
            >
              🖨 {rtl ? "چاپ گزارش (A4)" : "Print A4"}
            </button>
          </div>
        )}
      </div>

      {/* ── نوار گزارش ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border b-line-soft bg-black/10 p-2 text-[10px]">
        <span className="tx3">{rtl ? "تاریخ" : "Date"}</span>
        <div ref={datePickerRef} className="relative" dir="ltr">
          <div className="flex h-7 items-center rounded-lg border b-line-soft bg-black/20 px-1">
            <input
              value={toPersianDigits(dateText)}
              dir="ltr"
              onChange={(e) => setDateText(faDigits(e.target.value))}
              onBlur={commitDate}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDate();
              }}
              placeholder="۱۴۰۳/۰۸/۲۶"
              className="w-28 bg-transparent px-2 py-1 text-center tabular-nums tx1 outline-none"
            />
            <button
              type="button"
              aria-label={rtl ? "انتخاب تاریخ از تقویم" : "Choose date from calendar"}
              aria-haspopup="dialog"
              aria-expanded={calendarOpen}
              title={rtl ? "انتخاب تاریخ از تقویم" : "Choose date from calendar"}
              onClick={toggleDateCalendar}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-sky-200 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-1 focus:ring-sky-300"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
              </svg>
            </button>
          </div>
          {calendarOpen && (
            <div
              role="dialog"
              aria-label={rtl ? "تقویم انتخاب تاریخ گزارش" : "Report date calendar"}
              dir={rtl ? "rtl" : "ltr"}
              className={`absolute top-full z-[60] mt-1 w-[264px] rounded-xl border b-line-soft bg-[#101827] p-2.5 text-[10px] shadow-2xl ${rtl ? "right-0" : "left-0"}`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label={rtl ? "ماه قبل" : "Previous month"}
                  disabled={calendarYear === 1300 && calendarMonth === 1}
                  onClick={() => shiftCalendarMonth(-1)}
                  className="grid h-7 w-7 place-items-center rounded-lg border b-line-soft tx2 transition hover:bg-white/10 disabled:opacity-30"
                >
                  {rtl ? "›" : "‹"}
                </button>
                <div className="font-semibold tx1">
                  {rtl
                    ? `${JALALI_MONTHS_FA[calendarMonth - 1]} ${toPersianDigits(String(calendarYear))}`
                    : `${JALALI_MONTHS_EN[calendarMonth - 1]} ${calendarYear}`}
                </div>
                <button
                  type="button"
                  aria-label={rtl ? "ماه بعد" : "Next month"}
                  disabled={calendarYear === 1500 && calendarMonth === 12}
                  onClick={() => shiftCalendarMonth(1)}
                  className="grid h-7 w-7 place-items-center rounded-lg border b-line-soft tx2 transition hover:bg-white/10 disabled:opacity-30"
                >
                  {rtl ? "‹" : "›"}
                </button>
              </div>
              <div className="grid grid-cols-7 text-center tx4">
                {(rtl ? JALALI_WEEKDAYS_FA : JALALI_WEEKDAYS_EN).map((weekday, index) => (
                  <span key={`${weekday}-${index}`} className="py-1.5 font-medium">{weekday}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {calendarCells.map((day, index) => {
                  if (day === null) return <span key={`empty-${index}`} aria-hidden="true" className="h-8" />;
                  const dayDate = `${calendarYear}/${String(calendarMonth).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
                  const selected = date === dayDate;
                  const isToday = calendarToday === dayDate;
                  const hasReport = summaries.some((summary) => summary.date === dayDate);
                  return (
                    <button
                      key={dayDate}
                      type="button"
                      aria-current={isToday ? "date" : undefined}
                      aria-label={`${rtl ? "انتخاب" : "Select"} ${toPersianDigits(dayDate)}`}
                      title={hasReport ? `${rtl ? "گزارش ثبت‌شده" : "Report saved"} · ${toPersianDigits(dayDate)}` : toPersianDigits(dayDate)}
                      onClick={() => chooseCalendarDate(day)}
                      className={`relative h-8 rounded-md text-center transition hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-sky-300 ${selected ? "bg-sky-500/30 font-semibold text-sky-100" : "tx1"} ${isToday && !selected ? "ring-1 ring-inset ring-amber-300/70" : ""}`}
                    >
                      {rtl ? toPersianDigits(String(day)) : day}
                      {hasReport && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-300" />}
                    </button>
                  );
                })}
              </div>
              {summaries.some((summary) => summary.date.startsWith(`${calendarYear}/${String(calendarMonth).padStart(2, "0")}/`)) && (
                <div className="mt-2 border-t b-line-soft pt-1.5 text-center text-[9px] tx4">
                  {rtl ? "نقطهٔ سبز: گزارش ثبت‌شده" : "Green dot: saved report"}
                </div>
              )}
            </div>
          )}
        </div>
        <button onClick={() => { const t = todayJalali(); setDateText(t); if (splitReportDate(t)) setDate(t); }} className="rounded-lg border b-line-soft px-2 py-1 tx2">
          {rtl ? "امروز" : "Today"}
        </button>
        <span className="tx3">{rtl ? "شماره گزارش" : "Report no"}</span>
        <input
          value={report?.reportNo ?? ""}
          dir="ltr"
          disabled={locked || viewMode === "cover"}
          onChange={(e) => patch((r) => ({ ...r, reportNo: e.target.value })) }
          placeholder="DRT-…"
          className="w-44 rounded-lg border b-line-soft bg-black/20 px-2 py-1 font-mono tx1 outline-none focus:border-[var(--accent)] disabled:opacity-50"
        />
        {monthInfo && <span className="tx3">{monthInfo.label}</span>}
        {report && statusChip(report.status)}
        {summaries.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                setDateText(e.target.value);
                setDate(e.target.value);
              }
            }}
            className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1"
            style={{ colorScheme: "dark" }}
          >
            <option value="">{rtl ? "گزارش‌های قبلی…" : "Previous…"}</option>
            {summaries.map((s) => (
              <option key={s.date} value={s.date} dir="ltr">
                {s.date} · {s.reportNo} · {rtl ? STATUS_FA[s.status] : s.status}
              </option>
            ))}
          </select>
        )}
        <span className="ms-auto flex items-center gap-1.5">
          {report?.status === "draft" && (
            <button onClick={() => void save()} disabled={locked || !canPersist || saving || loading} className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-emerald-200 disabled:opacity-40">
              💾 {saving ? "…" : rtl ? "ذخیره" : "Save"}
            </button>
          )}
          {report?.status === "draft" && canEdit && (
            <button onClick={() => void runAction("submit")} disabled={acting || loading} className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-sky-200 disabled:opacity-40">
              {rtl ? "ارسال برای تأیید" : "Submit"}
            </button>
          )}
          {report?.status === "submitted" && canEdit && (
            <>
              <button onClick={() => void runAction("approve")} disabled={acting} className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-emerald-200 disabled:opacity-40">
                {rtl ? "تأیید" : "Approve"}
              </button>
              <button onClick={() => void runAction("return")} disabled={acting} className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-amber-200 disabled:opacity-40">
                {rtl ? "برگشت به پیش‌نویس" : "Return"}
              </button>
            </>
          )}
        </span>
      </div>

      {localOnly && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-2.5 text-[10px] text-amber-200">
          {rtl ? "سرور در دسترس نیست — این گزارش فعلاً فقط در همین مرورگر ذخیره شده است." : "Server unreachable — this report is stored in this browser only."}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-2.5 text-[10px] text-rose-200">{error}</div>
      )}
      {report && report.status !== "draft" && (
        <div className="rounded-xl border b-line-soft bg-black/10 p-2.5 text-[10px] tx3">
          {rtl ? "این گزارش قفل است؛ برای ویرایش ابتدا آن را به پیش‌نویس برگردانید." : "This report is locked; return it to draft to edit."}
        </div>
      )}

      {/* ── تب‌ها ── */}
      <nav className="flex flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1" role="tablist">
        {(viewMode === "support" ? TABS : REPORT_TABS).map((t) => {
          const isSelected = viewMode === "support" ? tab === t.id : reportTab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                if (viewMode === "support") setTab(t.id as TabId);
                else setReportTab(t.id as ReportTabId);
              }}
              className={`rounded-lg px-3 py-1.5 text-[10.5px] transition ${isSelected ? "toggle-on tx1" : "tx3 hover:tx1"}`}
            >
              {rtl ? t.fa : t.en}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            if (viewMode === "support") {
              setViewMode("cover");
              setReportTab("cover");
              window.dispatchEvent(new CustomEvent("open-daily-report-cover"));
            } else {
              setViewMode("support");
            }
          }}
          className={`rounded-lg border px-3 py-1.5 text-[10.5px] font-medium transition ${
            viewMode === "cover"
              ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25"
              : "border-sky-400/50 bg-sky-400/15 text-sky-200 hover:bg-sky-400/25"
          }`}
        >
          {viewMode === "support"
            ? rtl ? "ورود به گزارش روزانه" : "Enter daily report"
            : rtl ? "بازگشت به پشتیبان گزارش روزانه" : "Back to daily report support"}
        </button>
        {loading && <span className="ms-auto text-[9px] tx4">{rtl ? "در حال بارگذاری…" : "Loading…"}</span>}
      </nav>

      {/* ═══ صفحهٔ گزارش روزانه (کاور دقیق مطابق شیت ارسالی) ═══ */}
      {activeTab === "cover" && report && (
        <div id="daily-report-cover" data-daily-cover="true" className="fade-rise overflow-x-auto py-1" dir="ltr">
          <div className="flex min-h-[285mm] w-full min-w-[680px] flex-col border-2 border-[#1d3b8b] bg-white font-serif text-black shadow-lg">
            {/* کادر بالای کاور (محل لوگوها) */}
            <div className="flex min-h-[68px] items-center justify-between border-b border-black px-4 py-2">
              {coverLogoBox("client", "Client Logo")}
              {coverLogoBox("consultant", "Consultant Logo")}
              {coverLogoBox("contractor", "Contractor Logo")}
            </div>

            {/* نوار عنوان Daily Report */}
            <div className="border-b border-black bg-[#c4bd97] py-1.5 text-center text-[17px] font-bold tracking-wide text-black">
              Daily Report
            </div>

            {/* ردیف Report NO. و Date */}
            <div className="flex items-center justify-between border-b border-black px-3 py-1 text-[12px] font-bold text-black">
              <div className="flex items-center gap-2">
                <span>Report NO. :</span>
                <input
                  value={report.reportNo}
                  disabled={locked}
                  onChange={(e) => patch((r) => ({ ...r, reportNo: e.target.value }))}
                  placeholder="DRT-001"
                  className="w-44 border-b border-dotted border-black/40 bg-transparent px-1 py-0.5 font-mono text-[12px] font-semibold text-black outline-none focus:border-black"
                />
              </div>
              <div className="flex items-center gap-2">
                <span>Date :</span>
                <input
                  value={toPersianDigits(dateText)}
                  onChange={(e) => setDateText(faDigits(e.target.value))}
                  onBlur={commitDate}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitDate();
                  }}
                  className="w-32 border-b border-dotted border-black/40 bg-transparent px-1 py-0.5 text-center font-sans text-[12px] font-semibold text-black outline-none focus:border-black"
                />
              </div>
            </div>

            {/* بخش General Information */}
            <div className="px-4 pt-2 pb-1">
              <div className="text-center text-[14.5px] font-bold text-black">General Information</div>

              {/* ردیف وضعیت آب‌وهوا با مثلث نشانگر بنفش */}
              <div className="mt-2 grid grid-cols-5 items-end gap-2 px-4">
                {(
                  [
                    { key: "Sunny", label: "Sunny", apiWeather: "Sunny" },
                    { key: "Windy", label: "Windy", apiWeather: "Cyclone" },
                    { key: "Cloudy", label: "Cloudy", apiWeather: "Cloudy" },
                    { key: "Rainy", label: "Rainy", apiWeather: "Rainy" },
                    { key: "Snowy", label: "Snowy", apiWeather: "Stormy" },
                  ] as const
                ).map((w) => {
                  const selected = report.site.weather === w.apiWeather;
                  return (
                    <button
                      key={w.key}
                      type="button"
                      disabled
                      className="flex flex-col items-center gap-1 rounded py-1 disabled:cursor-default"
                    >
                      {/* مثلث بنفش نشانگر انتخاب */}
                      <div className="h-5">
                        {selected && (
                          <svg viewBox="0 0 20 20" className="h-5 w-5">
                            <polygon points="3,2 17,2 10,18" fill="#c026d3" stroke="#1e293b" strokeWidth="1.5" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10.5px] font-bold text-black">{w.label}</span>
                        {w.key === "Sunny" && (
                          <svg viewBox="0 0 48 36" className="h-8 w-11">
                            <circle cx="24" cy="18" r="9" fill="#fde047" stroke="#f59e0b" strokeWidth="1.5" />
                            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
                              const rad = (deg * Math.PI) / 180;
                              return (
                                <line
                                  key={deg}
                                  x1={24 + Math.cos(rad) * 11}
                                  y1={18 + Math.sin(rad) * 11}
                                  x2={24 + Math.cos(rad) * 15}
                                  y2={18 + Math.sin(rad) * 15}
                                  stroke="#facc15"
                                  strokeWidth="2"
                                />
                              );
                            })}
                          </svg>
                        )}
                        {w.key === "Windy" && (
                          <svg viewBox="0 0 48 36" className="h-8 w-11">
                            <ellipse cx="26" cy="8" rx="14" ry="4" fill="#93c5fd" stroke="#475569" strokeWidth="1" />
                            <ellipse cx="24" cy="14" rx="11" ry="3.2" fill="#bfdbfe" stroke="#475569" strokeWidth="1" />
                            <ellipse cx="22" cy="20" rx="8" ry="2.5" fill="#93c5fd" stroke="#475569" strokeWidth="1" />
                            <ellipse cx="20" cy="25" rx="5" ry="2" fill="#bfdbfe" stroke="#475569" strokeWidth="1" />
                            <ellipse cx="18" cy="30" rx="3" ry="1.5" fill="#60a5fa" stroke="#475569" strokeWidth="1" />
                          </svg>
                        )}
                        {w.key === "Cloudy" && (
                          <svg viewBox="0 0 56 36" className="h-8 w-13">
                            <ellipse cx="22" cy="14" rx="14" ry="5" fill="#dbeafe" stroke="#60a5fa" strokeWidth="1" />
                            <ellipse cx="32" cy="23" rx="16" ry="5.5" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1" />
                          </svg>
                        )}
                        {w.key === "Rainy" && (
                          <svg viewBox="0 0 52 38" className="h-8 w-12">
                            <ellipse cx="26" cy="12" rx="16" ry="6" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="1" />
                            <polygon points="25,16 20,25 25,25 22,34 31,22 26,22" fill="#facc15" stroke="#eab308" strokeWidth="0.6" />
                            <line x1="14" y1="20" x2="11" y2="30" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="2 2" />
                            <line x1="36" y1="20" x2="33" y2="30" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="2 2" />
                          </svg>
                        )}
                        {w.key === "Snowy" && (
                          <svg viewBox="0 0 48 36" className="h-8 w-11">
                            <ellipse cx="24" cy="13" rx="14" ry="5.5" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1" />
                            <text x="14" y="29" fontSize="10" fill="#0284c7">✻ ✻</text>
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ردیف Temprature : Min / Max */}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-10 text-[12px] text-black">
                <span>Temprature :</span>
                <label className="flex items-center gap-1.5">
                  <span>Min</span>
                  <input
                    value={report.site.minTemp == null ? "" : String(report.site.minTemp)}
                    readOnly
                    className="w-16 border-b border-dotted border-black/50 bg-transparent px-1 text-center text-[12px] text-black outline-none"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <span>Max</span>
                  <input
                    value={report.site.maxTemp == null ? "" : String(report.site.maxTemp)}
                    readOnly
                    className="w-16 border-b border-dotted border-black/50 bg-transparent px-1 text-center text-[12px] text-black outline-none focus:border-black"
                  />
                </label>
              </div>

              {/* ردیف Work Shift / Site Status / Land Status */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4 px-1 py-1 text-[12px] text-black">
                <div className="flex items-center gap-2">
                  <span>Work Shift:</span>
                  <input
                    value={report.site.workShift ?? ""}
                    readOnly
                    className="w-28 border-b border-dotted border-black/40 bg-transparent px-1 text-[12px] text-black outline-none focus:border-black"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>Site Status:</span>
                  <select
                    value={report.site.siteStatus || "Active"}
                    disabled={locked || viewMode === "cover"}
                    onChange={(e) => patch((r) => ({ ...r, site: { ...r.site, siteStatus: e.target.value as DprTablesReport["site"]["siteStatus"] } }))}
                    className="border-b border-dotted border-black/40 bg-transparent px-2 py-0.5 text-[12px] text-black outline-none"
                  >
                    {DPR_SITE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span>Land Status:</span>
                  <input
                    value={report.site.landStatus ?? ""}
                    readOnly
                    className="w-28 border-b border-dotted border-black/40 bg-transparent px-1 text-[12px] text-black outline-none focus:border-black"
                  />
                </div>
              </div>
            </div>

            {/* جدول اول: Man power & machinery sketch status */}
            <div className="px-10 pt-2">
              <table className="w-full border-collapse border border-black text-[11.5px] text-black">
                <thead>
                  <tr className="bg-[#c4bd97]">
                    <th colSpan={6} className="border border-black py-1 text-center text-[13.5px] font-bold">
                      Man power &amp; machinery sketch status
                    </th>
                  </tr>
                  <tr className="bg-[#d8d3b8] font-bold">
                    <th className="w-[28%] border border-black px-2 py-1 text-center">Description</th>
                    <th className="w-[20%] border border-black px-2 py-1 text-center">Unit</th>
                    <th className="w-[13%] border border-black px-2 py-1 text-center">Active</th>
                    <th className="w-[13%] border border-black px-2 py-1 text-center">Inactive</th>
                    <th className="w-[11%] border border-black px-2 py-1 text-center">Total</th>
                    <th className="w-[15%] border border-black px-2 py-1 text-center">Plural to now</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black px-2 py-1">Indirect Manpower</td>
                    <td className="border border-black px-2 py-1">Man / hr</td>
                    <td className="border border-black p-0">
                      <input value={indActVal} readOnly className="w-full bg-transparent px-1 py-1 text-center outline-none" />
                    </td>
                    <td className="border border-black p-0">
                      <input value={indInactVal} readOnly className="w-full bg-transparent px-1 py-1 text-center outline-none" />
                    </td>
                    <td className="border border-black px-2 py-1 text-center tabular-nums">
                      {indTotNum > 0 ? indTotNum : ""}
                    </td>
                    <td className="border border-black p-0">
                      <input value={indPluralVal} readOnly className="w-full bg-transparent px-1 py-1 text-center outline-none" />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1">direct Manpower</td>
                    <td className="border border-black px-2 py-1">Man / hr</td>
                    <td className="border border-black p-0">
                      <input value={dirActVal} readOnly className="w-full bg-transparent px-1 py-1 text-center outline-none" />
                    </td>
                    <td className="border border-black p-0">
                      <input value={dirInactVal} readOnly className="w-full bg-transparent px-1 py-1 text-center outline-none" />
                    </td>
                    <td className="border border-black px-2 py-1 text-center tabular-nums">
                      {dirTotNum > 0 ? dirTotNum : ""}
                    </td>
                    <td className="border border-black p-0">
                      <input value={dirPluralVal} readOnly className="w-full bg-transparent px-1 py-1 text-center outline-none" />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1">Total</td>
                    <td className="border border-black px-2 py-1">Man / hr</td>
                    <td className="border border-black px-2 py-1 text-center tabular-nums">
                      {totActNum > 0 ? totActNum : ""}
                    </td>
                    <td className="border border-black px-2 py-1 text-center tabular-nums">
                      {totInactNum > 0 ? totInactNum : ""}
                    </td>
                    <td className="border border-black px-2 py-1 text-center tabular-nums">
                      {totAllNum > 0 ? totAllNum : ""}
                    </td>
                    <td className="border border-black px-2 py-1 text-center tabular-nums">
                      {totPluralNum > 0 ? totPluralNum : ""}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1">Machinery</td>
                    <td className="border border-black px-2 py-1">Machin / hr</td>
                    <td className="border border-black p-0">
                      <input value={macActVal} readOnly className="w-full bg-transparent px-1 py-1 text-center outline-none" />
                    </td>
                    <td className="border border-black p-0">
                      <input value={macInactVal} readOnly className="w-full bg-transparent px-1 py-1 text-center outline-none" />
                    </td>
                    <td className="border border-black px-2 py-1 text-center tabular-nums">
                      {macTotNum > 0 ? macTotNum : ""}
                    </td>
                    <td className="border border-black p-0">
                      <input value={macPluralVal} readOnly className="w-full bg-transparent px-1 py-1 text-center outline-none" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* جدول دوم: Main Quantity Table Project */}
            <div className="px-10 pt-4">
              <table className="w-full border-collapse border border-black text-[11.5px] text-black">
                <thead>
                  <tr className="bg-[#c4bd97]">
                    <th colSpan={6} className="border border-black py-1 text-center text-[13.5px] font-bold">
                      Main Quantity Table Project
                    </th>
                  </tr>
                  <tr className="bg-[#d8d3b8] font-bold">
                    <th className="w-[28%] border border-black px-2 py-1 text-center">Description</th>
                    <th className="w-[20%] border border-black px-2 py-1 text-center">Contract Quantity</th>
                    <th className="w-[13%] border border-black px-2 py-1 text-center">Unit</th>
                    <th className="w-[13%] border border-black px-2 py-1 text-center">Last period</th>
                    <th className="w-[11%] border border-black px-2 py-1 text-center">Today</th>
                    <th className="w-[15%] border border-black px-2 py-1 text-center">Up to Now</th>
                  </tr>
                </thead>
                <tbody>
                  {coverMainQuantities.map((row, idx) => (
                    <tr key={idx}>
                      <td className="border border-black px-2 py-1 text-start">{row.desc}</td>
                      <td className="border border-black px-2 py-1 text-center tabular-nums">{row.contractQty}</td>
                      <td className="border border-black px-2 py-1 text-center">{row.unit}</td>
                      <td className="border border-black px-2 py-1 text-center tabular-nums">{row.lastPeriod}</td>
                      <td className="border border-black px-2 py-1 text-center tabular-nums">{row.today}</td>
                      <td className="border border-black px-2 py-1 text-center tabular-nums">{row.upToNow}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* بخش Comment */}
            <div className="flex flex-1 flex-col px-4 pt-3 pb-3">
              <div className="mb-1.5 text-center text-[13px] font-bold text-black">Comment</div>
              <div className="flex flex-1 flex-col rounded-[28px] border border-black p-3">
                <textarea
                  value={coverSheet.comment ?? ""}
                  onChange={(e) => patchCoverSheet((s) => ({ ...s, comment: e.target.value.slice(0, 4000) }))}
                  rows={8}
                  className="h-full min-h-[160px] w-full flex-1 resize-none bg-transparent text-[12px] leading-5 text-black outline-none"
                  dir="auto"
                />
              </div>
            </div>

            {/* جدول امضاهای پایین صفحه */}
            <table className="w-full border-collapse border-t border-black text-[11.5px] text-black">
              <tbody>
                <tr className="border-b border-dotted border-black/70">
                  <td className="w-1/4 border-r border-black px-2 py-1">Prepared By:</td>
                  <td className="w-1/4 border-r border-black px-2 py-1">Approved By:</td>
                  <td className="w-1/4 border-r border-black px-2 py-1">Approved By:</td>
                  <td className="w-1/4 px-2 py-1">Received By:</td>
                </tr>
                <tr className="h-24 align-top">
                  <td className="border-r border-black px-2 py-1">
                    <div>Planning &amp; Project Control</div>
                    <input
                      value={coverSheet.preparedSign}
                      onChange={(e) => patchCoverSheet((s) => ({ ...s, preparedSign: e.target.value }))}
                      className="mt-2 w-full bg-transparent text-[11px] outline-none"
                    />
                  </td>
                  <td className="border-r border-black px-2 py-1">
                    <div>Site Maneger</div>
                    <input
                      value={coverSheet.siteManagerSign}
                      onChange={(e) => patchCoverSheet((s) => ({ ...s, siteManagerSign: e.target.value }))}
                      className="mt-2 w-full bg-transparent text-[11px] outline-none"
                    />
                  </td>
                  <td className="border-r border-black px-2 py-1 space-y-1">
                    <div className="flex items-center gap-1">
                      <span>Name:</span>
                      <input
                        value={coverSheet.approvedName}
                        onChange={(e) => patchCoverSheet((s) => ({ ...s, approvedName: e.target.value }))}
                        className="w-full bg-transparent text-[11px] outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Sign:</span>
                      <input
                        value={coverSheet.approvedSign}
                        onChange={(e) => patchCoverSheet((s) => ({ ...s, approvedSign: e.target.value }))}
                        className="w-full bg-transparent text-[11px] outline-none"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1 space-y-1">
                    <div className="flex items-center gap-1">
                      <span>Name:</span>
                      <input
                        value={coverSheet.receivedName}
                        onChange={(e) => patchCoverSheet((s) => ({ ...s, receivedName: e.target.value }))}
                        className="w-full bg-transparent text-[11px] outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Sign:</span>
                      <input
                        value={coverSheet.receivedSign}
                        onChange={(e) => patchCoverSheet((s) => ({ ...s, receivedSign: e.target.value }))}
                        className="w-full bg-transparent text-[11px] outline-none"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ تب ۱: وضعیت کارگاه ═══ */}
      {activeTab === "site" && report && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "وضعیت کارگاه" : "Site status"}</span>
            <select
              value={report.site.siteStatus}
              disabled={locked}
              onChange={(e) => patch((r) => ({ ...r, site: { ...r.site, siteStatus: e.target.value as DprTablesReport["site"]["siteStatus"] } }))}
              className="rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-[11px] tx1 outline-none disabled:opacity-50"
              style={{ colorScheme: "dark" }}
              dir="ltr"
            >
              <option value="">—</option>
              {DPR_SITE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "وضعیت هوا" : "Weather"}</span>
            <select
              value={report.site.weather}
              disabled={locked}
              onChange={(e) => patch((r) => ({ ...r, site: { ...r.site, weather: e.target.value } }))}
              className="rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-[11px] tx1 outline-none disabled:opacity-50"
              style={{ colorScheme: "dark" }}
              dir="ltr"
            >
              <option value="">—</option>
              {DPR_WEATHERS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "میانگین رطوبت (٪)" : "Avg humidity (%)"}</span>
            <div dir="ltr">
              <CellNum wide value={report.site.humidity} disabled={locked} resetKey={resetKey} onCommit={(v) => patch((r) => ({ ...r, site: { ...r.site, humidity: v } }))} />
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "میانگین دما" : "Avg temp"}</span>
            <div dir="ltr">
              <CellNum wide value={report.site.avgTemp} disabled={locked} resetKey={resetKey} onCommit={(v) => patch((r) => ({ ...r, site: { ...r.site, avgTemp: v } }))} />
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "حداقل دما" : "Min temp"}</span>
            <div dir="ltr">
              <CellNum wide value={report.site.minTemp ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => patch((r) => ({ ...r, site: { ...r.site, minTemp: v } }))} />
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "حداکثر دما" : "Max temp"}</span>
            <div dir="ltr">
              <CellNum wide value={report.site.maxTemp ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => patch((r) => ({ ...r, site: { ...r.site, maxTemp: v } }))} />
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "شیفت کاری" : "Work shift"}</span>
            <input
              value={report.site.workShift ?? ""}
              disabled={locked}
              onChange={(e) => patch((r) => ({ ...r, site: { ...r.site, workShift: e.target.value } }))}
              className="rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-[11px] tx1 outline-none disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "وضعیت زمین" : "Land status"}</span>
            <input
              value={report.site.landStatus ?? ""}
              disabled={locked}
              onChange={(e) => patch((r) => ({ ...r, site: { ...r.site, landStatus: e.target.value } }))}
              className="rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-[11px] tx1 outline-none disabled:opacity-50"
            />
          </label>
          <p className="text-[9px] tx4 sm:col-span-2 lg:col-span-4">
            {rtl ? "ماه و سال از روی تاریخ گزارش می‌آیند و سربرگ گزارش همین مقادیر را نمایش می‌دهد." : "Month/year derive from the report date; the cover mirrors these values."}
          </p>
        </div>
      )}

      {/* ═══ تب ۲ در گزارش روزانه: شیت رسمی شرح تشریحی (Narrative Daily Report) ═══ */}
      {viewMode === "cover" && reportTab === "narrative" && report && (
        <div id="daily-report-cover" dir="ltr" className="w-full overflow-x-auto">
          <div className="mx-auto box-border flex min-h-[285mm] w-full flex-col border-2 border-[#0000cc] bg-white font-serif text-[#111] shadow-xl">
            {/* ═══ هدر بالای شیت شرح تشریحی (مشابه شیت نیروی انسانی) ═══ */}
            <table className="w-full table-fixed border-collapse border-b-2 border-black font-serif text-[10px] text-black">
              <colgroup>
                <col style={{ width: "6%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "45%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
              </colgroup>
              <tbody>
                <tr className="h-[18px] border-b border-gray-300">
                  <td className="border-r border-gray-300 px-1.5 font-semibold">Con.:</td>
                  <td className="border-r border-gray-300 px-1">
                    <input
                      size={1}
                      value={coverSheet.machineryHeader?.con ?? ""}
                      onChange={(e) =>
                        patchCoverSheet((s) => ({
                          ...s,
                          machineryHeader: { ...(s.machineryHeader ?? { con: "", line1: "", line2: "" }), con: e.target.value },
                        }))
                      }
                      className="h-full min-w-0 w-full bg-transparent text-[10px] outline-none"
                    />
                  </td>
                  <td className="border-r border-gray-300 px-2 text-center">
                    <input
                      size={1}
                      value={coverSheet.machineryHeader?.line1 ?? ""}
                      onChange={(e) =>
                        patchCoverSheet((s) => ({
                          ...s,
                          machineryHeader: { ...(s.machineryHeader ?? { con: "", line1: "", line2: "" }), line1: e.target.value },
                        }))
                      }
                      className="h-full min-w-0 w-full bg-transparent text-center text-[10.5px] font-semibold outline-none"
                    />
                  </td>
                  {(["client", "consultant", "contractor"] as const).map((roleKey, idx) => {
                    const labelFa = roleKey === "client" ? "لوگوی کارفرما" : roleKey === "consultant" ? "لوگوی مشاور" : "لوگوی پیمانکار";
                    const logoSrc = coverLogos[roleKey];
                    return (
                      <td
                        key={roleKey}
                        rowSpan={3}
                        className={`${idx < 2 ? "border-r border-gray-300" : ""} p-0.5 align-middle`}
                      >
                        <label
                          className={`flex h-[48px] w-full cursor-pointer flex-col items-center justify-center rounded px-1 text-center transition ${
                            logoSrc ? "has-logo" : "border border-dashed border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {logoSrc ? (
                            <img src={logoSrc} alt={roleKey} className="max-h-[44px] max-w-full object-contain" />
                          ) : (
                            <span className="no-print-placeholder font-sans text-[8.5px] text-gray-400">{labelFa}</span>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => importCoverLogo(roleKey, e.target.files)} />
                        </label>
                      </td>
                    );
                  })}
                </tr>
                <tr className="h-[18px] border-b border-gray-300">
                  <td className="border-r border-gray-300 px-1.5 font-semibold">Date:</td>
                  <td className="border-r border-gray-300 px-1 font-sans text-[10px] font-medium">{toPersianDigits(report.reportDate)}</td>
                  <td className="border-r border-gray-300 px-2 text-center">
                    <input
                      size={1}
                      value={coverSheet.machineryHeader?.line2 ?? ""}
                      onChange={(e) =>
                        patchCoverSheet((s) => ({
                          ...s,
                          machineryHeader: { ...(s.machineryHeader ?? { con: "", line1: "", line2: "" }), line2: e.target.value },
                        }))
                      }
                      className="h-full min-w-0 w-full bg-transparent text-center text-[10.5px] font-semibold outline-none"
                    />
                  </td>
                </tr>
                <tr className="h-[18px]">
                  <td className="border-r border-gray-300 px-1.5 font-semibold">No:</td>
                  <td className="border-r border-gray-300 px-1 font-sans text-[10px] font-medium">{report.reportNo}</td>
                  <td className="border-r border-gray-300 px-2 text-center text-[12px] font-bold">Narrative Daily Report</td>
                </tr>
              </tbody>
            </table>

            {/* نوار عنوان Narrative Daily Report */}
            <div className="flex h-[26px] items-center justify-center border-b border-white bg-[#d9d9d9] text-[12.5px] font-bold text-[#4f4f4f]">
              Narrative Daily Report
            </div>

            {/* بخش ۱: Site Activities (۱۲ سطر خط‌کشی‌شده) */}
            <div className="flex h-[24px] items-center justify-center bg-[#d9d9d9] text-[12px] font-bold text-[#4f4f4f]">
              Site Activities
            </div>
            <div className="relative w-full">
              <textarea
                value={report.narrative.siteActivities}
                disabled={locked}
                rows={12}
                onChange={(e) =>
                  patch((r) => ({
                    ...r,
                    narrative: { ...r.narrative, siteActivities: e.target.value.slice(0, 4000) },
                  }))
                }
                dir="auto"
                style={{
                  lineHeight: "21px",
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, transparent 0px, transparent 20px, #d9d9d9 20px, #d9d9d9 21px)",
                }}
                className="block h-[252px] w-full resize-none bg-transparent px-3 py-0 font-sans text-[11.5px] text-black outline-none"
              />
            </div>

            {/* بخش ۲: Work Front (۸ سطر خط‌کشی‌شده) */}
            <div className="flex h-[24px] items-center justify-center bg-[#d9d9d9] text-[12px] font-bold text-[#4f4f4f]">
              Work Front
            </div>
            <div className="relative w-full">
              <textarea
                value={report.narrative.workFront}
                disabled={locked}
                rows={8}
                onChange={(e) =>
                  patch((r) => ({
                    ...r,
                    narrative: { ...r.narrative, workFront: e.target.value.slice(0, 4000) },
                  }))
                }
                dir="auto"
                style={{
                  lineHeight: "21px",
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, transparent 0px, transparent 20px, #d9d9d9 20px, #d9d9d9 21px)",
                }}
                className="block h-[168px] w-full resize-none bg-transparent px-3 py-0 font-sans text-[11.5px] text-black outline-none"
              />
            </div>

            {/* بخش ۳: Area of concerns اول (۱۰ سطر خط‌کشی‌شده) */}
            <div className="flex h-[24px] items-center justify-center bg-[#d9d9d9] text-[12px] font-bold text-[#4f4f4f]">
              Area of concerns
            </div>
            <div className="relative w-full">
              <textarea
                value={report.narrative.areaOfConcerns}
                disabled={locked}
                rows={10}
                onChange={(e) =>
                  patch((r) => ({
                    ...r,
                    narrative: { ...r.narrative, areaOfConcerns: e.target.value.slice(0, 4000) },
                  }))
                }
                dir="auto"
                style={{
                  lineHeight: "21px",
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, transparent 0px, transparent 20px, #d9d9d9 20px, #d9d9d9 21px)",
                }}
                className="block h-[210px] w-full resize-none bg-transparent px-3 py-0 font-sans text-[11.5px] text-black outline-none"
              />
            </div>

            {/* بخش ۴: Area of concerns دوم (۵ سطر خط‌کشی‌شده، پرکنندهٔ فضای تا امضاها) */}
            <div className="flex h-[24px] items-center justify-center bg-[#d9d9d9] text-[12px] font-bold text-[#4f4f4f]">
              Area of concerns
            </div>
            <div className="relative flex flex-1 flex-col">
              <textarea
                value={report.narrative.areaOfConcerns2 ?? ""}
                readOnly
                rows={5}
                dir="auto"
                style={{
                  lineHeight: "21px",
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, transparent 0px, transparent 20px, #d9d9d9 20px, #d9d9d9 21px)",
                }}
                className="block min-h-[105px] w-full flex-1 resize-none bg-transparent px-3 py-0 font-sans text-[11.5px] text-black outline-none"
              />
            </div>

            {/* جدول ۴ ستونی امضاهای پایین شیت شرح تشریحی (عین تصویر) */}
            <table className="w-full table-fixed border-collapse border-t-2 border-black font-serif text-[11px] text-black">
              <colgroup>
                <col style={{ width: "25.5%" }} />
                <col style={{ width: "23%" }} />
                <col style={{ width: "25.5%" }} />
                <col style={{ width: "26%" }} />
              </colgroup>
              <tbody>
                <tr className="h-[20px] border-b border-gray-300">
                  <td className="border-r border-black px-1.5">Prepared By:</td>
                  <td className="border-r border-black px-1.5">Approved By:</td>
                  <td className="border-r border-black px-1.5">Approved By:</td>
                  <td className="px-1.5">Received By:</td>
                </tr>
                <tr className="h-[26px] border-b border-gray-300">
                  <td rowSpan={2} className="border-r border-black px-1.5 align-middle">
                    <div>Planning &amp; Project Control</div>
                    <input
                      size={1}
                      value={coverSheet.preparedSign}
                      onChange={(e) => patchCoverSheet((s) => ({ ...s, preparedSign: e.target.value }))}
                      className="mt-1 min-w-0 w-full bg-transparent font-sans text-[10.5px] outline-none"
                    />
                  </td>
                  <td className="border-r border-black px-1.5 align-middle">Site Maneger</td>
                  <td className="border-r border-black px-1.5 align-middle">
                    <div className="flex items-center gap-1">
                      <span>Name:</span>
                      <input
                        size={1}
                        value={coverSheet.approvedName}
                        onChange={(e) => patchCoverSheet((s) => ({ ...s, approvedName: e.target.value }))}
                        className="min-w-0 w-full bg-transparent font-sans text-[10.5px] outline-none"
                      />
                    </div>
                  </td>
                  <td className="px-1.5 align-middle">
                    <div className="flex items-center gap-1">
                      <span>Name:</span>
                      <input
                        size={1}
                        value={coverSheet.receivedName}
                        onChange={(e) => patchCoverSheet((s) => ({ ...s, receivedName: e.target.value }))}
                        className="min-w-0 w-full bg-transparent font-sans text-[10.5px] outline-none"
                      />
                    </div>
                  </td>
                </tr>
                <tr className="h-[24px]">
                  <td className="border-r border-black px-1.5 align-middle">
                    <input
                      size={1}
                      value={coverSheet.siteManagerSign}
                      onChange={(e) => patchCoverSheet((s) => ({ ...s, siteManagerSign: e.target.value }))}
                      className="min-w-0 w-full bg-transparent font-sans text-[10.5px] outline-none"
                    />
                  </td>
                  <td className="border-r border-black px-1.5 align-middle">
                    <div className="flex items-center gap-1">
                      <span>Sign:</span>
                      <input
                        size={1}
                        value={coverSheet.approvedSign}
                        onChange={(e) => patchCoverSheet((s) => ({ ...s, approvedSign: e.target.value }))}
                        className="min-w-0 w-full bg-transparent font-sans text-[10.5px] outline-none"
                      />
                    </div>
                  </td>
                  <td className="px-1.5 align-middle">
                    <div className="flex items-center gap-1">
                      <span>Sign:</span>
                      <input
                        size={1}
                        value={coverSheet.receivedSign}
                        onChange={(e) => patchCoverSheet((s) => ({ ...s, receivedSign: e.target.value }))}
                        className="min-w-0 w-full bg-transparent font-sans text-[10.5px] outline-none"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ تب ۲ در پشتیبان گزارش روزانه: شرح تشریحی ═══ */}
      {viewMode === "support" && tab === "narrative" && report && (
        <div className="grid grid-cols-1 gap-2.5">
          {([
            ["siteActivities", rtl ? "فعالیت‌های سایت (Site Activities)" : "Site Activities"],
            ["workFront", rtl ? "جبهه کاری (Work Front)" : "Work Front"],
            ["areaOfConcerns", rtl ? "نگرانی‌ها (Area of concerns)" : "Area of concerns"],
            ["areaOfConcerns2", rtl ? "نگرانی‌های تکمیلی (Area of concerns 2)" : "Area of concerns 2"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-[9px] font-extralight tx3">{label}</span>
              <textarea
                value={report.narrative[key] ?? ""}
                disabled={locked}
                rows={4}
                onChange={(e) => patch((r) => ({ ...r, narrative: { ...r.narrative, [key]: e.target.value.slice(0, 4000) } }))}
                className="w-full rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-[11px] leading-5 tx1 outline-none focus:border-[var(--accent)] disabled:opacity-50"
              />
            </label>
          ))}
        </div>
      )}

      {/* ═══ تب ۳ در گزارش روزانه: شیت رسمی نیروی انسانی (Manpower Sheet) ═══ */}
      {viewMode === "cover" && reportTab === "manpower" && report && (() => {
        type LeftCell =
          | { kind: "section"; title: string }
          | { kind: "item"; key: string; title: string; spanLeft: number }
          | { kind: "total-direct" };

        type RightCell =
          | { kind: "section"; title: string }
          | { kind: "item"; key: string; title: string; spanLeft: number }
          | { kind: "total-indirect" }
          | { kind: "total-manpower" }
          | { kind: "spacer" }
          | { kind: "sign-start"; field: "preparedBy" | "approvedBy" | "confirmedBy"; label: string }
          | { kind: "sign-cont" };

        const leftRows: LeftCell[] = [];
        let dIdx = 0;
        for (const sec of REPORT_MANPOWER_DIRECT_SECTIONS) {
          leftRows.push({ kind: "section", title: sec.title });
          sec.items.forEach((title, i) => {
            leftRows.push({
              kind: "item",
              key: `D-${dIdx++}`,
              title,
              spanLeft: i === 0 ? sec.items.length : 0,
            });
          });
        }
        leftRows.push({ kind: "total-direct" });

        const rightRows: RightCell[] = [];
        let iIdx = 0;
        for (const sec of REPORT_MANPOWER_INDIRECT_SECTIONS) {
          rightRows.push({ kind: "section", title: sec.title });
          sec.items.forEach((title, i) => {
            rightRows.push({
              kind: "item",
              key: `I-${iIdx++}`,
              title,
              spanLeft: i === 0 ? sec.items.length : 0,
            });
          });
        }
        rightRows.push({ kind: "total-indirect" });
        rightRows.push({ kind: "total-manpower" });
        rightRows.push({ kind: "spacer" });
        rightRows.push({ kind: "sign-start", field: "preparedBy", label: "Prepared by :" });
        rightRows.push({ kind: "sign-cont" });
        rightRows.push({ kind: "sign-cont" });
        rightRows.push({ kind: "sign-start", field: "approvedBy", label: "Approved by :" });
        rightRows.push({ kind: "sign-cont" });
        rightRows.push({ kind: "sign-cont" });
        rightRows.push({ kind: "sign-start", field: "confirmedBy", label: "Confirmed by :" });
        rightRows.push({ kind: "sign-cont" });
        rightRows.push({ kind: "sign-cont" });

        const getRowVals = (key: string) => {
          const [side, idxStr] = key.split("-");
          const mpIdx = (side === "D" ? 0 : 88) + Number(idxStr) + 1;
          const mpCode = `MP-${String(mpIdx).padStart(3, "0")}`;
          const supRow = manTotals.rows[mpCode];
          const dayNum = supRow?.day ?? 0;
          const nightNum = supRow?.night ?? 0;
          const lastNum = history.manpower?.[mpCode] ?? 0;
          const cumNum = dayNum + nightNum + lastNum;
          const hasAny = dayNum > 0 || nightNum > 0 || lastNum > 0;
          return {
            day: dayNum > 0 ? String(dayNum) : "",
            night: nightNum > 0 ? String(nightNum) : "",
            last: hasAny ? String(lastNum) : "",
            autoCum: hasAny ? String(cumNum) : "",
            dayNum,
            nightNum,
            lastNum,
            cumNum,
          };
        };

        const directTotals = { day: 0, night: 0, last: 0, cum: 0 };
        for (let k = 0; k < dIdx; k++) {
          const v = getRowVals(`D-${k}`);
          directTotals.day += v.dayNum;
          directTotals.night += v.nightNum;
          directTotals.last += v.lastNum;
          directTotals.cum += v.cumNum;
        }

        const indirectTotals = { day: 0, night: 0, last: 0, cum: 0 };
        for (let k = 0; k < iIdx; k++) {
          const v = getRowVals(`I-${k}`);
          indirectTotals.day += v.dayNum;
          indirectTotals.night += v.nightNum;
          indirectTotals.last += v.lastNum;
          indirectTotals.cum += v.cumNum;
        }

        const grandTotals = {
          day: directTotals.day + indirectTotals.day,
          night: directTotals.night + indirectTotals.night,
          last: directTotals.last + indirectTotals.last,
          cum: directTotals.cum + indirectTotals.cum,
        };

        return (
          <div id="daily-report-cover" dir="ltr" className="w-full overflow-x-auto">
            <div className="daily-report-sheet-fit daily-report-sheet-manpower mx-auto box-border flex w-full flex-col bg-white p-2 font-sans text-[#111] shadow-xl">
              {/* ── هدر شیت نیروی انسانی (Con. / Date / No | Daily Manpower Report | لوگوی کارفرما، مشاور و پیمانکار) ── */}
              <table className="daily-report-sub-header mb-1 w-full table-fixed border-collapse border-2 border-black font-sans text-[10px] text-black">
                <colgroup>
                  <col style={{ width: "6.5%" }} />
                  <col style={{ width: "21.5%" }} />
                  <col style={{ width: "44%" }} />
                  <col style={{ width: "28%" }} />
                </colgroup>
                <tbody>
                  <tr className="h-[18px]">
                    <td className="border-b border-r border-black px-1.5 font-bold">Con.:</td>
                    <td className="border-b border-r-2 border-r-black border-b-black/60 p-0">
                      <input
                        size={1}
                        value={coverSheet.machineryHeader?.con ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machineryHeader: { ...(s.machineryHeader ?? { con: "", line1: "", line2: "" }), con: e.target.value },
                          }))
                        }
                        className="min-w-0 w-full bg-transparent px-1.5 text-[9.5px] outline-none"
                      />
                    </td>
                    <td className="border-b border-r-2 border-r-black border-b-black/25 p-0">
                      <input
                        size={1}
                        value={coverSheet.machineryHeader?.line1 ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machineryHeader: { ...(s.machineryHeader ?? { con: "", line1: "", line2: "" }), line1: e.target.value },
                          }))
                        }
                        className="min-w-0 w-full bg-transparent px-2 text-center text-[10px] font-semibold outline-none"
                      />
                    </td>
                    <td rowSpan={3} className="p-1 align-middle">
                      <div className="grid h-full grid-cols-3 items-center gap-1">
                        {(["client", "consultant", "contractor"] as const).map((roleKey) => {
                          const labelFa = roleKey === "client" ? "کارفرما" : roleKey === "consultant" ? "مشاور" : "پیمانکار";
                          const logoSrc = coverLogos[roleKey];
                          return (
                            <label
                              key={roleKey}
                              className={`flex h-[46px] cursor-pointer flex-col items-center justify-center rounded px-1 text-center transition ${
                                logoSrc ? "has-logo" : "border border-dashed border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {logoSrc ? (
                                <img src={logoSrc} alt={roleKey} className="max-h-[42px] max-w-full object-contain" />
                              ) : (
                                <span className="no-print-placeholder text-[8px] text-gray-400">{labelFa}</span>
                              )}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => importCoverLogo(roleKey, e.target.files)} />
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                  <tr className="h-[18px]">
                    <td className="border-b border-r border-black px-1.5 font-bold">Date:</td>
                    <td className="border-b border-r-2 border-r-black border-b-black/60 px-1.5 font-sans font-medium tabular-nums">
                      {toPersianDigits(report.reportDate)}
                    </td>
                    <td className="border-b border-r-2 border-r-black border-b-black/25 p-0">
                      <input
                        size={1}
                        value={coverSheet.machineryHeader?.line2 ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machineryHeader: { ...(s.machineryHeader ?? { con: "", line1: "", line2: "" }), line2: e.target.value },
                          }))
                        }
                        className="min-w-0 w-full bg-transparent px-2 text-center text-[9.5px] outline-none"
                      />
                    </td>
                  </tr>
                  <tr className="h-[18px]">
                    <td className="border-r border-black px-1.5 font-bold">No:</td>
                    <td className="border-r-2 border-black px-1.5 font-mono font-medium">
                      {report.reportNo}
                    </td>
                    <td className="border-r-2 border-black px-2 text-center text-[11px] font-bold">
                      Daily Manpower Report
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="daily-report-manpower-table w-full table-fixed border-collapse text-[9.5px] leading-tight text-black">
                <colgroup>
                  <col style={{ width: "2.5%" }} />
                  <col style={{ width: "24.5%" }} />
                  <col style={{ width: "5.5%" }} />
                  <col style={{ width: "5.5%" }} />
                  <col style={{ width: "5.5%" }} />
                  <col style={{ width: "5.5%" }} />
                  <col style={{ width: "1.5%" }} />
                  <col style={{ width: "2.5%" }} />
                  <col style={{ width: "25%" }} />
                  <col style={{ width: "5.5%" }} />
                  <col style={{ width: "5.5%" }} />
                  <col style={{ width: "5.5%" }} />
                  <col style={{ width: "5.5%" }} />
                </colgroup>
                <thead>
                  <tr className="h-[20px]">
                    <th colSpan={2} className="border-2 border-black bg-[#f2ef68] px-1 py-0.5 text-center text-[10.5px] font-bold">
                      Direct
                    </th>
                    <th className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold">Day</th>
                    <th className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold">Night</th>
                    <th className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold">last</th>
                    <th className="border-y-2 border-r-2 border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold">Cum</th>
                    <th className="border-0 bg-white" />
                    <th colSpan={2} className="border-2 border-black bg-[#f2ef68] px-1 py-0.5 text-center text-[10.5px] font-bold">
                      Indirect
                    </th>
                    <th className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold">Day</th>
                    <th className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold">Night</th>
                    <th className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold">last</th>
                    <th className="border-y-2 border-r-2 border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold">Cum</th>
                  </tr>
                </thead>
                <tbody>
                  {leftRows.map((left, rowIdx) => {
                    const right = rightRows[rowIdx];
                    return (
                      <tr key={rowIdx} className="h-[16px]">
                        {/* ── نیمهٔ چپ: Direct ── */}
                        {left.kind === "section" && (
                          <>
                            <td colSpan={2} className="border-l-2 border-y border-r border-black bg-[#d9e1f2] px-1 py-0 text-left font-bold">
                              {left.title}
                            </td>
                            <td className="border border-black/70 bg-[#d9e1f2]" />
                            <td className="border border-black/70 bg-[#d9e1f2]" />
                            <td className="border border-black/70 bg-[#d9e1f2]" />
                            <td className="border-y border-l border-r-2 border-black bg-[#d9e1f2]" />
                          </>
                        )}
                        {left.kind === "item" && (() => {
                          const vals = getRowVals(left.key);
                          return (
                            <>
                              {left.spanLeft > 0 && (
                                <td rowSpan={left.spanLeft} className="border-l-2 border-y border-r border-black bg-[#d9e1f2]" />
                              )}
                              <td className="truncate border border-black/70 bg-white px-1 py-0 text-left tracking-tight">
                                {left.title}
                              </td>
                              <td className="border border-black/70 bg-white p-0">
                                <div className="min-w-0 w-full px-0.5 text-center tabular-nums">{vals.day}</div>
                              </td>
                              <td className="border border-black/70 bg-white p-0">
                                <div className="min-w-0 w-full px-0.5 text-center tabular-nums">{vals.night}</div>
                              </td>
                              <td className="border border-black/70 bg-white p-0">
                                <div className="min-w-0 w-full px-0.5 text-center tabular-nums">{vals.last}</div>
                              </td>
                              <td className="border-y border-l border-black/70 border-r-2 border-r-black bg-white p-0">
                                <div className="min-w-0 w-full px-0.5 text-center tabular-nums">{vals.autoCum}</div>
                              </td>
                            </>
                          );
                        })()}
                        {left.kind === "total-direct" && (
                          <>
                            <td colSpan={2} className="border-2 border-black bg-[#f2ef68] px-1 py-0.5 text-center font-bold">
                              Total Direct
                            </td>
                            <td className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold tabular-nums">
                              {directTotals.day}
                            </td>
                            <td className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold tabular-nums">
                              {directTotals.night}
                            </td>
                            <td className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold tabular-nums">
                              {directTotals.last}
                            </td>
                            <td className="border-y-2 border-r-2 border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold tabular-nums">
                              {directTotals.cum}
                            </td>
                          </>
                        )}

                        {/* ── ستون فاصلهٔ میانی ── */}
                        <td className="border-0 bg-white" />

                        {/* ── نیمهٔ راست: Indirect ── */}
                        {right.kind === "section" && (
                          <>
                            <td colSpan={2} className="border-l-2 border-y border-r border-black bg-[#d9e1f2] px-1 py-0 text-left font-bold">
                              {right.title}
                            </td>
                            <td className="border border-black/70 bg-[#d9e1f2]" />
                            <td className="border border-black/70 bg-[#d9e1f2]" />
                            <td className="border border-black/70 bg-[#d9e1f2]" />
                            <td className="border-y border-l border-r-2 border-black bg-[#d9e1f2]" />
                          </>
                        )}
                        {right.kind === "item" && (() => {
                          const vals = getRowVals(right.key);
                          return (
                            <>
                              {right.spanLeft > 0 && (
                                <td rowSpan={right.spanLeft} className="border-l-2 border-y border-r border-black bg-[#d9e1f2]" />
                              )}
                              <td className="truncate border border-black/70 bg-white px-1 py-0 text-left tracking-tight">
                                {right.title}
                              </td>
                              <td className="border border-black/70 bg-white p-0">
                                <div className="min-w-0 w-full px-0.5 text-center tabular-nums">{vals.day}</div>
                              </td>
                              <td className="border border-black/70 bg-white p-0">
                                <div className="min-w-0 w-full px-0.5 text-center tabular-nums">{vals.night}</div>
                              </td>
                              <td className="border border-black/70 bg-white p-0">
                                <div className="min-w-0 w-full px-0.5 text-center tabular-nums">{vals.last}</div>
                              </td>
                              <td className="border-y border-l border-black/70 border-r-2 border-r-black bg-white p-0">
                                <div className="min-w-0 w-full px-0.5 text-center tabular-nums">{vals.autoCum}</div>
                              </td>
                            </>
                          );
                        })()}
                        {right.kind === "total-indirect" && (
                          <>
                            <td colSpan={2} className="border-2 border-black bg-[#f2ef68] px-1 py-0.5 text-center font-bold">
                              Total Indirect
                            </td>
                            <td className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold tabular-nums">
                              {indirectTotals.day}
                            </td>
                            <td className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold tabular-nums">
                              {indirectTotals.night}
                            </td>
                            <td className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold tabular-nums">
                              {indirectTotals.last}
                            </td>
                            <td className="border-y-2 border-r-2 border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold tabular-nums">
                              {indirectTotals.cum}
                            </td>
                          </>
                        )}
                        {right.kind === "total-manpower" && (
                          <>
                            <td colSpan={2} className="border-2 border-black bg-[#f2ef68] px-1 py-0.5 text-center font-bold">
                              Total Manpower
                            </td>
                            <td className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold tabular-nums">
                              {grandTotals.day}
                            </td>
                            <td className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold tabular-nums">
                              {grandTotals.night}
                            </td>
                            <td className="border-y-2 border-r border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold tabular-nums">
                              {grandTotals.last}
                            </td>
                            <td className="border-y-2 border-r-2 border-black bg-[#f2ef68] px-0.5 py-0.5 text-center font-bold tabular-nums">
                              {grandTotals.cum}
                            </td>
                          </>
                        )}
                        {right.kind === "spacer" && <td colSpan={6} className="border-0 bg-white" />}
                        {right.kind === "sign-start" && (
                          <>
                            <td
                              colSpan={2}
                              rowSpan={3}
                              className="border-l-2 border-y border-r border-black bg-white px-2 align-middle text-[10px] font-bold"
                            >
                              {right.label}
                            </td>
                            <td colSpan={4} rowSpan={3} className="border-y border-l border-r-2 border-black bg-white p-1 align-middle">
                              <input
                                size={1}
                                value={coverSheet.manpowerSigns?.[right.field] ?? ""}
                                disabled={locked}
                                onChange={(e) =>
                                  patchCoverSheet((s) => ({
                                    ...s,
                                    manpowerSigns: {
                                      ...(s.manpowerSigns ?? { preparedBy: "", approvedBy: "", confirmedBy: "" }),
                                      [right.field]: e.target.value,
                                    },
                                  }))
                                }
                                className="h-full min-w-0 w-full bg-transparent px-1 text-[10px] outline-none"
                              />
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ═══ تب ۳ در پشتیبان گزارش روزانه: نیروی انسانی ═══ */}
      {viewMode === "support" && tab === "manpower" && report && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={rtl ? "جست‌وجوی شغل یا کد…" : "Search…"}
              className="w-52 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1 outline-none placeholder:text-[9px] focus:border-[var(--accent)]"
            />
            <label className="flex items-center gap-1.5 tx3">
              <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
              {rtl ? "فقط پرشده‌ها" : "Non-empty only"}
            </label>
            <span className="ms-auto tx4">{rtl ? `${DPR_MANPOWER.length} ردیف ثابت` : `${DPR_MANPOWER.length} fixed rows`}</span>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-xl border b-line-soft">
            <table className="w-full border-separate border-spacing-0 text-[10px]">
              <thead className="sticky top-0 z-10 bg-[var(--bg-c)] tx1">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>{rtl ? "کد" : "Code"}</th>
                  <th className={th}>{rtl ? "مستقیم / غیرمستقیم" : "Direct / Indirect"}</th>
                  <th className={th}>{rtl ? "شغل" : "Craft"}</th>
                  <th className={th}>{rtl ? "حاضر روز" : "Present (day)"}</th>
                  <th className={th}>{rtl ? "غایب روز" : "Absent (day)"}</th>
                  <th className={th}>{rtl ? "حاضر شب" : "Present (night)"}</th>
                  <th className={th}>{rtl ? "غایب شب" : "Absent (night)"}</th>
                  <th className={th}>{rtl ? "جمع روز" : "Day total"}</th>
                  <th className={th}>{rtl ? "جمع شب" : "Night total"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {manGroups.map((g) => {
                  const rows = DPR_MANPOWER.filter((m) => m.group === g && matchFilter(m.title, m.code)).filter((m) => {
                    if (!hideEmpty) return true;
                    const t = manTotals.rows[m.code];
                    return (t?.total ?? 0) > 0;
                  });
                  if (!rows.length) return null;
                  const open = openGroups[`man:${g}`] ?? true;
                  const sub = manTotals.byGroup[g] ?? { pd: 0, ad: 0, pn: 0, an: 0, total: 0 };
                  return (
                    <Fragment key={g}>
                      <tr className="bg-black/15">
                        <td colSpan={10} className="px-2 py-1.5">
                          <button onClick={() => toggleGroup(`man:${g}`)} className="flex w-full items-center gap-2 text-[10px] font-medium tx1">
                            <span className="tx3">{open ? "▾" : "▸"}</span>
                            <span dir="ltr">{rtl ? DPR_MANPOWER_GROUPS[g]?.fa : DPR_MANPOWER_GROUPS[g]?.en}</span>
                            <span className="ms-auto font-normal tabular-nums tx3" dir="ltr">
                              {sub.pd + sub.ad + sub.pn + sub.an > 0 ? `${sub.total}` : "—"}
                            </span>
                          </button>
                        </td>
                      </tr>
                      {open &&
                        rows.map((m, i) => {
                          const e = report.manpower[m.code];
                          const t = manTotals.rows[m.code];
                          return (
                            <tr key={m.code} className="bg-[var(--bg-b)]">
                              <td className={`${td} tx4 tabular-nums`} dir="ltr">{i + 1}</td>
                              <td className={`${td} font-mono text-[8.5px] tx4`} dir="ltr">{m.code}</td>
                              <td className={`${td} whitespace-nowrap text-[9px] tx3`}>{m.kind === "direct" ? (rtl ? "مستقیم" : "Direct") : (rtl ? "غیرمستقیم" : "Indirect")}</td>
                              <td className={tdL}>
                                <span className="tx1" dir="ltr">{m.title}</span>
                              </td>
                              <td className={td}><CellNum value={e?.pd ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMan(m.code, "pd", v)} /></td>
                              <td className={td}><CellNum value={e?.ad ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMan(m.code, "ad", v)} /></td>
                              <td className={td}><CellNum value={e?.pn ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMan(m.code, "pn", v)} /></td>
                              <td className={td}><CellNum value={e?.an ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMan(m.code, "an", v)} /></td>
                              <td className={`${td} ${calc}`} dir="ltr">{t.day}</td>
                              <td className={`${td} ${calc}`} dir="ltr">{t.night}</td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-[var(--bg-c)] tx1">
                <tr className="border-t b-line-soft text-[10px] font-semibold">
                  <td className="px-2 py-2 text-start">{rtl ? "جمع کل" : "Total"}</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{manTotals.grand.pd}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{manTotals.grand.ad}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{manTotals.grand.pn}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{manTotals.grand.an}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{manTotals.grand.pd + manTotals.grand.ad}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{manTotals.grand.pn + manTotals.grand.an}</td>
                </tr>
                <tr className="text-[9px] font-normal tx3">
                  <td className="px-2 py-1 text-start">{rtl ? "مستقیم / غیرمستقیم" : "Direct / indirect"}</td>
                  <td colSpan={6} className="px-2 py-1 text-center tabular-nums" dir="ltr">
                    {manTotals.direct.total} / {manTotals.indirect.total}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[9px] tx4">{rtl ? "خانهٔ خالی صفر حساب می‌شود؛ جمع‌ها لحظه‌ای‌اند." : "Empty cells count as zero; totals update live."}</p>
        </div>
      )}

      {/* ═══ تب ۴ در گزارش روزانه: شیت رسمی ماشین‌آلات (Machinery Sheet — ۱۶۰ ردیف) ═══ */}
      {viewMode === "cover" && reportTab === "machinery" && report && (() => {
        const civilList = DPR_MACHINERY.filter((m) => m.discipline === "Civil");
        const generalList = DPR_MACHINERY.filter((m) => m.discipline === "General");
        const mechList = DPR_MACHINERY.filter((m) => m.discipline === "Mechanical");
        const facList = DPR_MACHINERY.filter((m) => m.discipline === "Facility");
        const otherList = DPR_MACHINERY.filter((m) => m.discipline === "Other");

        const buildSide = (blocks: Array<{ disc: string; list: typeof DPR_MACHINERY }>) => {
          const out: Array<{
            code: string;
            title: string;
            category: string;
            disc: string;
            discSpan: number;
            isFirstInDisc: boolean;
            isLastInDisc: boolean;
          }> = [];
          for (const b of blocks) {
            b.list.forEach((m, i) => {
              out.push({
                code: m.code,
                title: m.title,
                category: m.category,
                disc: b.disc,
                discSpan: i === 0 ? b.list.length : 0,
                isFirstInDisc: i === 0,
                isLastInDisc: i === b.list.length - 1,
              });
            });
          }
          return out;
        };

        const halfCount = Math.ceil(DPR_MACHINERY.length / 2);
        const leftGenCount = Math.max(0, halfCount - civilList.length);
        const generalLeft = generalList.slice(0, leftGenCount);
        const generalRight = generalList.slice(leftGenCount);

        const leftItems = buildSide([
          { disc: "Civil", list: civilList },
          { disc: "General", list: generalLeft },
        ]);
        const rightItems = buildSide([
          { disc: "Mechanical", list: mechList },
          { disc: "Facility", list: facList },
          ...(generalRight.length ? [{ disc: "General", list: generalRight }] : []),
          ...(otherList.length ? [{ disc: "Other", list: otherList }] : []),
        ]);

        const rowCount = Math.max(leftItems.length, rightItems.length);

        const getMacVals = (code: string) => {
          const sup = report.machinery[code];
          const dayNum = sup?.active ?? 0;
          const idleNum = sup?.ready ?? 0;
          const repairNum = sup?.repair ?? 0;
          return {
            day: dayNum > 0 ? String(dayNum) : "",
            // تب پشتیبان فعلی تعداد فعال/آماده/تعمیر را ثبت می‌کند، نه تفکیک شیفت شب.
            night: "",
            idle: idleNum > 0 ? String(idleNum) : "",
            repair: repairNum > 0 ? String(repairNum) : "",
            dayNum,
            nightNum: 0,
            idleNum,
            repairNum,
          };
        };

        const leftTotals = { day: 0, night: 0, idle: 0, repair: 0 };
        for (const it of leftItems) {
          const v = getMacVals(it.code);
          leftTotals.day += v.dayNum;
          leftTotals.night += v.nightNum;
          leftTotals.idle += v.idleNum;
          leftTotals.repair += v.repairNum;
        }

        const rightTotals = { day: 0, night: 0, idle: 0, repair: 0 };
        for (const it of rightItems) {
          const v = getMacVals(it.code);
          rightTotals.day += v.dayNum;
          rightTotals.night += v.nightNum;
          rightTotals.idle += v.idleNum;
          rightTotals.repair += v.repairNum;
        }

        const groundTotals = {
          day: leftTotals.day + rightTotals.day,
          night: leftTotals.night + rightTotals.night,
          idle: leftTotals.idle + rightTotals.idle,
          repair: leftTotals.repair + rightTotals.repair,
        };

        return (
          <div id="daily-report-cover" dir="ltr" className="w-full overflow-x-auto">
            <div className="daily-report-sheet-fit daily-report-sheet-machinery mx-auto box-border flex w-full flex-col bg-white p-1.5 font-serif text-[#111] shadow-xl">
              {/* ── هدر شیت ماشین‌آلات (Con. / Date / No | Daily Machinery Report | لوگوی کارفرما، مشاور و پیمانکار) ── */}
              <table className="daily-report-sub-header mb-1 w-full table-fixed border-collapse border-2 border-black font-sans text-[10px] text-black">
                <colgroup>
                  <col style={{ width: "6.5%" }} />
                  <col style={{ width: "21.5%" }} />
                  <col style={{ width: "44%" }} />
                  <col style={{ width: "28%" }} />
                </colgroup>
                <tbody>
                  <tr className="h-[18px]">
                    <td className="border-b border-r border-black px-1.5 font-bold">Con.:</td>
                    <td className="border-b border-r-2 border-r-black border-b-black/60 p-0">
                      <input
                        size={1}
                        value={coverSheet.machineryHeader?.con ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machineryHeader: { ...(s.machineryHeader ?? { con: "", line1: "", line2: "" }), con: e.target.value },
                          }))
                        }
                        className="min-w-0 w-full bg-transparent px-1.5 text-[9.5px] outline-none"
                      />
                    </td>
                    <td className="border-b border-r-2 border-r-black border-b-black/25 p-0">
                      <input
                        size={1}
                        value={coverSheet.machineryHeader?.line1 ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machineryHeader: { ...(s.machineryHeader ?? { con: "", line1: "", line2: "" }), line1: e.target.value },
                          }))
                        }
                        className="min-w-0 w-full bg-transparent px-2 text-center text-[10px] font-semibold outline-none"
                      />
                    </td>
                    <td rowSpan={3} className="p-1 align-middle">
                      <div className="grid h-full grid-cols-3 items-center gap-1">
                        {(["client", "consultant", "contractor"] as const).map((roleKey) => {
                          const labelFa = roleKey === "client" ? "کارفرما" : roleKey === "consultant" ? "مشاور" : "پیمانکار";
                          const logoSrc = coverLogos[roleKey];
                          return (
                            <label
                              key={roleKey}
                              className={`flex h-[46px] cursor-pointer flex-col items-center justify-center rounded px-1 text-center transition ${
                                logoSrc ? "has-logo" : "border border-dashed border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {logoSrc ? (
                                <img src={logoSrc} alt={roleKey} className="max-h-[42px] max-w-full object-contain" />
                              ) : (
                                <span className="no-print-placeholder text-[8px] text-gray-400">{labelFa}</span>
                              )}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => importCoverLogo(roleKey, e.target.files)} />
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                  <tr className="h-[18px]">
                    <td className="border-b border-r border-black px-1.5 font-bold">Date:</td>
                    <td className="border-b border-r-2 border-r-black border-b-black/60 px-1.5 font-sans font-medium tabular-nums">
                      {toPersianDigits(report.reportDate)}
                    </td>
                    <td className="border-b border-r-2 border-r-black border-b-black/25 p-0">
                      <input
                        size={1}
                        value={coverSheet.machineryHeader?.line2 ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machineryHeader: { ...(s.machineryHeader ?? { con: "", line1: "", line2: "" }), line2: e.target.value },
                          }))
                        }
                        className="min-w-0 w-full bg-transparent px-2 text-center text-[9.5px] outline-none"
                      />
                    </td>
                  </tr>
                  <tr className="h-[18px]">
                    <td className="border-r border-black px-1.5 font-bold">No:</td>
                    <td className="border-r-2 border-black px-1.5 font-mono font-medium">
                      {report.reportNo}
                    </td>
                    <td className="border-r-2 border-black px-2 text-center text-[11px] font-bold">
                      Daily Machinery Report
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="daily-report-machinery-table w-full table-fixed border-collapse text-[10px] leading-tight text-black">
                <colgroup>
                  <col style={{ width: "8.3%" }} />
                  <col style={{ width: "3.5%" }} />
                  <col style={{ width: "23.5%" }} />
                  <col style={{ width: "3.5%" }} />
                  <col style={{ width: "3.5%" }} />
                  <col style={{ width: "3.5%" }} />
                  <col style={{ width: "3.5%" }} />
                  <col style={{ width: "1.4%" }} />
                  <col style={{ width: "8.3%" }} />
                  <col style={{ width: "3.5%" }} />
                  <col style={{ width: "23.5%" }} />
                  <col style={{ width: "3.5%" }} />
                  <col style={{ width: "3.5%" }} />
                  <col style={{ width: "3.5%" }} />
                  <col style={{ width: "3.5%" }} />
                </colgroup>
                <thead>
                  <tr className="h-[38px] bg-[#e4dfec] text-[10.5px] font-normal text-black">
                    <th className="border-2 border-black px-1 text-center font-normal">Catg.</th>
                    <th className="border-y-2 border-r border-black px-0.5 text-center font-normal">Disc.</th>
                    <th className="border-y-2 border-r-2 border-black px-1.5 text-center font-normal">Machinery Description</th>
                    <th className="border-y-2 border-r border-black p-0 text-center font-normal">
                      <div className="mx-auto flex h-[34px] items-center justify-center [writing-mode:vertical-rl] rotate-180 text-[9.5px]">Day</div>
                    </th>
                    <th className="border-y-2 border-r border-black p-0 text-center font-normal">
                      <div className="mx-auto flex h-[34px] items-center justify-center [writing-mode:vertical-rl] rotate-180 text-[9.5px]">Night</div>
                    </th>
                    <th className="border-y-2 border-r border-black p-0 text-center font-normal">
                      <div className="mx-auto flex h-[34px] items-center justify-center [writing-mode:vertical-rl] rotate-180 text-[9.5px]">Idle</div>
                    </th>
                    <th className="border-y-2 border-r-2 border-black p-0 text-center font-normal">
                      <div className="mx-auto flex h-[34px] items-center justify-center [writing-mode:vertical-rl] rotate-180 text-[9.5px]">Repair</div>
                    </th>
                    <th className="border-0 bg-white" />
                    <th className="border-2 border-black px-1 text-center font-normal">Catg.</th>
                    <th className="border-y-2 border-r border-black px-0.5 text-center font-normal">Disc.</th>
                    <th className="border-y-2 border-r-2 border-black px-1.5 text-center font-normal">Machinery Description</th>
                    <th className="border-y-2 border-r border-black p-0 text-center font-normal">
                      <div className="mx-auto flex h-[34px] items-center justify-center [writing-mode:vertical-rl] rotate-180 text-[9.5px]">Day</div>
                    </th>
                    <th className="border-y-2 border-r border-black p-0 text-center font-normal">
                      <div className="mx-auto flex h-[34px] items-center justify-center [writing-mode:vertical-rl] rotate-180 text-[9.5px]">Night</div>
                    </th>
                    <th className="border-y-2 border-r border-black p-0 text-center font-normal">
                      <div className="mx-auto flex h-[34px] items-center justify-center [writing-mode:vertical-rl] rotate-180 text-[9.5px]">Idle</div>
                    </th>
                    <th className="border-y-2 border-r-2 border-black p-0 text-center font-normal">
                      <div className="mx-auto flex h-[34px] items-center justify-center [writing-mode:vertical-rl] rotate-180 text-[9.5px]">Repair</div>
                    </th>
                  </tr>
                  <tr className="h-[3px]">
                    <td colSpan={15} className="border-0 bg-white p-0" />
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowCount }).map((_, idx) => {
                    const l = leftItems[idx];
                    const r = rightItems[idx];
                    const lVals = l ? getMacVals(l.code) : null;
                    const rVals = r ? getMacVals(r.code) : null;
                    return (
                      <tr key={idx} className="h-[16px]">
                        {/* ── نیمهٔ چپ ── */}
                        {l && lVals ? (
                          <>
                            <td
                              className={`whitespace-nowrap border-l-2 border-r border-black/60 bg-white px-0.5 text-center text-[8.5px] tracking-tight text-[#1f497d] ${
                                l.isFirstInDisc ? "border-t-2 border-t-black" : "border-t border-t-[#b8b09c]"
                              } ${l.isLastInDisc ? "border-b-2 border-b-black" : "border-b border-b-[#b8b09c]"}`}
                            >
                              {l.category}
                            </td>
                            {l.discSpan > 0 && (
                              <td
                                rowSpan={l.discSpan}
                                className="border-2 border-black bg-white p-0 text-center align-middle text-[10px] text-[#1f497d]"
                              >
                                <div className="mx-auto flex items-center justify-center [writing-mode:vertical-rl] rotate-180">
                                  {l.disc}
                                </div>
                              </td>
                            )}
                            <td
                              className={`truncate border-r-2 border-r-black bg-white px-1.5 text-left text-[9.5px] tracking-tight text-[#1f497d] ${
                                l.isFirstInDisc ? "border-t-2 border-t-black" : "border-t border-t-[#b8b09c]"
                              } ${l.isLastInDisc ? "border-b-2 border-b-black" : "border-b border-b-[#b8b09c]"}`}
                            >
                              {l.title}
                            </td>
                            {(["day", "night", "idle", "repair"] as const).map((col, cIdx) => (
                              <td
                                key={col}
                                className={`bg-white p-0 ${
                                  cIdx === 3 ? "border-r-2 border-r-black" : "border-r border-r-black/70"
                                } ${l.isFirstInDisc ? "border-t-2 border-t-black" : "border-t border-t-[#b8b09c]"} ${
                                  l.isLastInDisc ? "border-b-2 border-b-black" : "border-b border-b-[#b8b09c]"
                                }`}
                              >
                                <div className="min-w-0 w-full px-0.5 text-center font-sans text-[9.5px] text-black tabular-nums">{lVals[col]}</div>
                              </td>
                            ))}
                          </>
                        ) : (
                          <td colSpan={7} className="border-0 bg-white" />
                        )}

                        {/* ── ستون فاصلهٔ میانی ── */}
                        <td className="border-0 bg-white" />

                        {/* ── نیمهٔ راست ── */}
                        {r && rVals ? (
                          <>
                            <td
                              className={`whitespace-nowrap border-l-2 border-r border-black/60 bg-white px-0.5 text-center text-[8.5px] tracking-tight text-[#1f497d] ${
                                r.isFirstInDisc ? "border-t-2 border-t-black" : "border-t border-t-[#b8b09c]"
                              } ${r.isLastInDisc ? "border-b-2 border-b-black" : "border-b border-b-[#b8b09c]"}`}
                            >
                              {r.category}
                            </td>
                            {r.discSpan > 0 && (
                              <td
                                rowSpan={r.discSpan}
                                className="border-2 border-black bg-white p-0 text-center align-middle text-[10px] text-[#1f497d]"
                              >
                                <div className="mx-auto flex items-center justify-center [writing-mode:vertical-rl] rotate-180">
                                  {r.disc}
                                </div>
                              </td>
                            )}
                            <td
                              className={`truncate border-r-2 border-r-black bg-white px-1.5 text-left text-[9.5px] tracking-tight text-[#1f497d] ${
                                r.isFirstInDisc ? "border-t-2 border-t-black" : "border-t border-t-[#b8b09c]"
                              } ${r.isLastInDisc ? "border-b-2 border-b-black" : "border-b border-b-[#b8b09c]"}`}
                            >
                              {r.title}
                            </td>
                            {(["day", "night", "idle", "repair"] as const).map((col, cIdx) => (
                              <td
                                key={col}
                                className={`bg-white p-0 ${
                                  cIdx === 3 ? "border-r-2 border-r-black" : "border-r border-r-black/70"
                                } ${r.isFirstInDisc ? "border-t-2 border-t-black" : "border-t border-t-[#b8b09c]"} ${
                                  r.isLastInDisc ? "border-b-2 border-b-black" : "border-b border-b-[#b8b09c]"
                                }`}
                              >
                                <div className="min-w-0 w-full px-0.5 text-center font-sans text-[9.5px] text-black tabular-nums">{rVals[col]}</div>
                              </td>
                            ))}
                          </>
                        ) : (
                          <td colSpan={7} className="border-0 bg-white" />
                        )}
                      </tr>
                    );
                  })}

                  {/* ── ردیف Total دو طرف ── */}
                  <tr className="h-[18px] font-bold text-black">
                    <td colSpan={3} className="border-2 border-black bg-white px-2 text-center text-[10px] font-bold">
                      Total
                    </td>
                    <td className="border-y-2 border-r border-black bg-white text-center font-sans text-[9px] tabular-nums">
                      {leftTotals.day || ""}
                    </td>
                    <td className="border-y-2 border-r border-black bg-white text-center font-sans text-[9px] tabular-nums">
                      {leftTotals.night || ""}
                    </td>
                    <td className="border-y-2 border-r border-black bg-white text-center font-sans text-[9px] tabular-nums">
                      {leftTotals.idle || ""}
                    </td>
                    <td className="border-y-2 border-r-2 border-black bg-white text-center font-sans text-[9px] tabular-nums">
                      {leftTotals.repair || ""}
                    </td>
                    <td className="border-0 bg-white" />
                    <td colSpan={3} className="border-2 border-black bg-white px-2 text-center text-[10px] font-bold">
                      Total
                    </td>
                    <td className="border-y-2 border-r border-black bg-white text-center font-sans text-[9px] tabular-nums">
                      {rightTotals.day || ""}
                    </td>
                    <td className="border-y-2 border-r border-black bg-white text-center font-sans text-[9px] tabular-nums">
                      {rightTotals.night || ""}
                    </td>
                    <td className="border-y-2 border-r border-black bg-white text-center font-sans text-[9px] tabular-nums">
                      {rightTotals.idle || ""}
                    </td>
                    <td className="border-y-2 border-r-2 border-black bg-white text-center font-sans text-[9px] tabular-nums">
                      {rightTotals.repair || ""}
                    </td>
                  </tr>

                  {/* ── فاصلهٔ باریک و ردیف Total Ground در سمت راست ── */}
                  <tr className="h-[2px]">
                    <td colSpan={15} className="border-0 bg-white p-0" />
                  </tr>
                  <tr className="h-[18px] font-bold text-black">
                    <td colSpan={7} className="border-0 bg-white" />
                    <td className="border-0 bg-white" />
                    <td colSpan={3} className="border-2 border-black bg-white px-2 text-center text-[10px] font-bold">
                      Total Ground
                    </td>
                    <td className="border-y-2 border-r border-black bg-white text-center font-sans text-[9px] tabular-nums">
                      {groundTotals.day || ""}
                    </td>
                    <td className="border-y-2 border-r border-black bg-white text-center font-sans text-[9px] tabular-nums">
                      {groundTotals.night || ""}
                    </td>
                    <td className="border-y-2 border-r border-black bg-white text-center font-sans text-[9px] tabular-nums">
                      {groundTotals.idle || ""}
                    </td>
                    <td className="border-y-2 border-r-2 border-black bg-white text-center font-sans text-[9px] tabular-nums">
                      {groundTotals.repair || ""}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ── کادر امضاهای پایین شیت ماشین‌آلات (۴ ستونی عین تصویر) ── */}
              <table className="mt-1 w-full table-fixed border-collapse border-2 border-black font-sans text-[9.5px] text-black">
                <tbody>
                  <tr className="h-[46px] align-top">
                    <td className="w-1/4 border-r-2 border-black px-2 py-0.5">
                      <div>Prepared &nbsp;By:</div>
                      <div className="mt-0.5">Planning &amp; Project Control</div>
                      <input
                        size={1}
                        value={coverSheet.machinerySigns?.preparedBy ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machinerySigns: {
                              ...(s.machinerySigns ?? { preparedBy: "", approvedSiteManager: "", approvedSupervisor: "", receivedBy: "" }),
                              preparedBy: e.target.value,
                            },
                          }))
                        }
                        className="mt-0.5 min-w-0 w-full bg-transparent text-[9px] outline-none"
                      />
                    </td>
                    <td className="w-1/4 border-r-2 border-black px-2 py-0.5">
                      <div>Appreoved By:</div>
                      <div className="mt-0.5">Site Manager</div>
                      <input
                        size={1}
                        value={coverSheet.machinerySigns?.approvedSiteManager ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machinerySigns: {
                              ...(s.machinerySigns ?? { preparedBy: "", approvedSiteManager: "", approvedSupervisor: "", receivedBy: "" }),
                              approvedSiteManager: e.target.value,
                            },
                          }))
                        }
                        className="mt-0.5 min-w-0 w-full bg-transparent text-[9px] outline-none"
                      />
                    </td>
                    <td className="w-1/4 border-r-2 border-black px-2 py-0.5">
                      <div>Appreoved &nbsp;By:</div>
                      <div className="mt-0.5">Super visor</div>
                      <input
                        size={1}
                        value={coverSheet.machinerySigns?.approvedSupervisor ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machinerySigns: {
                              ...(s.machinerySigns ?? { preparedBy: "", approvedSiteManager: "", approvedSupervisor: "", receivedBy: "" }),
                              approvedSupervisor: e.target.value,
                            },
                          }))
                        }
                        className="mt-0.5 min-w-0 w-full bg-transparent text-[9px] outline-none"
                      />
                    </td>
                    <td className="w-1/4 px-2 py-0.5">
                      <div>Received &nbsp;By:</div>
                      <div className="mt-0.5">Planning &nbsp;&amp; Project Control</div>
                      <input
                        size={1}
                        value={coverSheet.machinerySigns?.receivedBy ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machinerySigns: {
                              ...(s.machinerySigns ?? { preparedBy: "", approvedSiteManager: "", approvedSupervisor: "", receivedBy: "" }),
                              receivedBy: e.target.value,
                            },
                          }))
                        }
                        className="mt-0.5 min-w-0 w-full bg-transparent text-[9px] outline-none"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ═══ تب ۴ در پشتیبان گزارش روزانه: ماشین‌آلات ═══ */}
      {viewMode === "support" && tab === "machinery" && report && (
        <div className="space-y-2">
          <datalist id="dpr-owners">
            {owners.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={rtl ? "جست‌وجوی دستگاه یا کد…" : "Search…"}
              className="w-52 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1 outline-none placeholder:text-[9px] focus:border-[var(--accent)]"
            />
            <label className="flex items-center gap-1.5 tx3">
              <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
              {rtl ? "فقط پرشده‌ها" : "Non-empty only"}
            </label>
            <span className="ms-auto tx4">{rtl ? `${DPR_MACHINERY.length} قلم ثابت` : `${DPR_MACHINERY.length} fixed items`}</span>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-xl border b-line-soft">
            <table className="w-full border-separate border-spacing-0 text-[10px]">
              <thead className="sticky top-0 z-10 bg-[var(--bg-c)] tx1">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>{rtl ? "کد" : "Code"}</th>
                  <th className={th}>{rtl ? "نوع (رده)" : "Category"}</th>
                  <th className={th}>{rtl ? "بخش (دیسیپلین)" : "Discipline"}</th>
                  <th className={th}>{rtl ? "دستگاه" : "Machine"}</th>
                  <th className={th}>{rtl ? "فعال" : "Active"}</th>
                  <th className={th}>{rtl ? "آماده" : "Ready"}</th>
                  <th className={th}>{rtl ? "تعمیر" : "Repair"}</th>
                  <th className={th}>{rtl ? "مالکیت" : "Owner"}</th>
                  <th className={th}>{rtl ? "جمع" : "Total"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {macGroups.map((g) => {
                  const rows = DPR_MACHINERY.filter(
                    (m) => m.group === g && (matchFilter(m.title, m.code) || matchFilter(m.category, m.discipline)),
                  ).filter((m) => {
                    if (!hideEmpty) return true;
                    return (macTotals.rows[m.code] ?? 0) > 0 || Boolean(report.machinery[m.code]?.owner?.trim());
                  });
                  if (!rows.length) return null;
                  const open = openGroups[`mac:${g}`] ?? true;
                  const sub = macTotals.byGroup[g] ?? { active: 0, ready: 0, repair: 0, total: 0 };
                  return (
                    <Fragment key={g}>
                      <tr className="bg-black/15">
                        <td colSpan={10} className="px-2 py-1.5">
                          <button onClick={() => toggleGroup(`mac:${g}`)} className="flex w-full items-center gap-2 text-[10px] font-medium tx1">
                            <span className="tx3">{open ? "▾" : "▸"}</span>
                            <span dir="ltr">{rtl ? DPR_MACHINERY_GROUPS[g]?.fa : DPR_MACHINERY_GROUPS[g]?.en}</span>
                            <span className="ms-auto font-normal tabular-nums tx3" dir="ltr">{sub.total > 0 ? sub.total : "—"}</span>
                          </button>
                        </td>
                      </tr>
                      {open &&
                        rows.map((m, i) => {
                          const e = report.machinery[m.code];
                          return (
                            <tr key={m.code} className="bg-[var(--bg-b)]">
                              <td className={`${td} tx4 tabular-nums`} dir="ltr">{i + 1}</td>
                              <td className={`${td} font-mono text-[8.5px] tx4`} dir="ltr">{m.code}</td>
                              <td className={`${td} whitespace-nowrap text-[9px] tx3`} dir="ltr">{m.category}</td>
                              <td className={`${td} whitespace-nowrap text-[9px] tx3`} dir="ltr">{m.discipline}</td>
                              <td className={tdL}>
                                <span className="tx1" dir="ltr">{m.title}</span>
                              </td>
                              <td className={td}><CellNum value={e?.active ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMac(m.code, "active", v)} /></td>
                              <td className={td}><CellNum value={e?.ready ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMac(m.code, "ready", v)} /></td>
                              <td className={td}><CellNum value={e?.repair ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMac(m.code, "repair", v)} /></td>
                              <td className={td}>
                                <CellText value={e?.owner ?? ""} disabled={locked} resetKey={resetKey} listId="dpr-owners" align="center" onCommit={(v) => setMacOwner(m.code, v)} />
                              </td>
                              <td className={`${td} ${calc}`} dir="ltr">{macTotals.rows[m.code] ?? 0}</td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-[var(--bg-c)] tx1">
                <tr className="border-t b-line-soft text-[10px] font-semibold">
                  <td className="px-2 py-2 text-start">{rtl ? "جمع کل" : "Total"}</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{macTotals.active}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{macTotals.ready}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{macTotals.repair}</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{macTotals.grand}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[9px] tx4">{rtl ? "فعال/آماده/تعمیر تعداد دستگاه است؛ مالکیت متن کوتاه با حافظهٔ پیشنهاد." : "Active/ready/repair are unit counts; owner is short text with memory."}</p>
        </div>
      )}

      {/* ═══ تب ۵ در گزارش روزانه: شیت رسمی متریال (Daily Material Report) ═══ */}
      {viewMode === "cover" && reportTab === "materials" && report && (() => {
        interface MaterialBlockDef {
          id: string;
          title: string;
          descHeader: string;
          upToLastHeader?: string;
          todayRed?: boolean;
          totalLabel: string;
          rows: Array<{ num: string; defaultDesc?: string; defaultUnit?: string }>;
        }

        const pairs: Array<[MaterialBlockDef, MaterialBlockDef | null]> = [
          [
            {
              id: "rebar",
              title: "Rebar",
              descHeader: "Size/Des.",
              todayRed: true,
              totalLabel: "Total",
              rows: Array.from({ length: 12 }, (_, i) => ({ num: String(i + 1) })),
            },
            {
              id: "anchorbolt",
              title: "Anchorbolt",
              descHeader: "Kind/Des.",
              todayRed: true,
              totalLabel: "Total",
              rows: Array.from({ length: 12 }, (_, i) => ({ num: String(i + 1) })),
            },
          ],
          [
            {
              id: "batching",
              title: "Batching Plant Material",
              descHeader: "Kind/Des.",
              totalLabel: "Total",
              rows: [...Array.from({ length: 5 }, (_, i) => ({ num: String(i + 1) })), { num: "" }],
            },
            {
              id: "steel",
              title: "Steel Structure",
              descHeader: "Kind/Des.",
              upToLastHeader: "",
              totalLabel: "Total",
              rows: [...Array.from({ length: 5 }, (_, i) => ({ num: String(i + 1) })), { num: "" }],
            },
          ],
          [
            {
              id: "other",
              title: "Other",
              descHeader: "Kind/Des.",
              totalLabel: "Total",
              rows: Array.from({ length: 7 }, (_, i) => ({ num: String(i + 1) })),
            },
            {
              id: "ugPipe",
              title: "U/G Pipe",
              descHeader: "Kind/Des.",
              todayRed: true,
              totalLabel: "Total",
              rows: Array.from({ length: 7 }, (_, i) => ({ num: String(i + 1) })),
            },
          ],
          [
            {
              id: "agPiping",
              title: "A/G Piping",
              descHeader: "Kind/Des.",
              totalLabel: "Total",
              rows: [...Array.from({ length: 5 }, (_, i) => ({ num: String(i + 1) })), { num: "" }],
            },
            {
              id: "elecInst",
              title: "Electrical& instrument",
              descHeader: "Kind/Des.",
              totalLabel: "Total",
              rows: [
                { num: "1", defaultDesc: "Cable Shoe 25mm", defaultUnit: "pcs" },
                ...Array.from({ length: 4 }, (_, i) => ({ num: String(i + 2) })),
                { num: "" },
              ],
            },
          ],
          [
            {
              id: "equipment",
              title: "Equipment",
              descHeader: "Kind/Des.",
              totalLabel: "Total",
              rows: [
                { num: "1", defaultDesc: "Static", defaultUnit: "Ton" },
                { num: "2", defaultDesc: "Rotary", defaultUnit: "Ton" },
                { num: "" },
              ],
            },
            null,
          ],
        ];

        const historyBlockKey: Record<string, string> = {
          rebar: "rebar",
          anchorbolt: "anchorbolt",
          batching: "batching",
          steel: "steel",
          other: "other",
          ugPipe: "ug-pipe",
          agPiping: "ag-piping",
          elecInst: "elec-inst",
          equipment: "equipment",
        };
        const currentMaterialData: Record<string, Record<string, { desc: string; unit: string; qty: number }>> = {};
        for (const m of report.materials) {
          const desc = (m.desc ?? "").trim();
          if (!desc) continue;
          const blockKey = materialBlockForRow(m);
          const bucket = (currentMaterialData[blockKey] ??= {});
          const cur = bucket[desc] ?? { desc, unit: (m.unit ?? "").trim(), qty: 0 };
          cur.qty = Number((cur.qty + materialRowQty(m)).toFixed(2));
          if (!cur.unit && m.unit) cur.unit = m.unit.trim();
          bucket[desc] = cur;
        }

        const materialRowsForBlock = (b: MaterialBlockDef) => {
          const key = historyBlockKey[b.id] ?? b.id;
          const current = currentMaterialData[key] ?? {};
          const historic = history.materialsByBlock?.[key] ?? {};
          const baseDescriptions = b.rows.map((r) => r.defaultDesc).filter((d): d is string => Boolean(d));
          const descriptions = [...new Set([...Object.keys(current), ...Object.keys(historic), ...baseDescriptions])];
          const count = Math.max(b.rows.length, descriptions.length);
          return Array.from({ length: count }, (_, i) => ({
            ...(b.rows[i] ?? {}),
            num: b.rows[i]?.num !== undefined ? b.rows[i].num : String(i + 1),
            defaultDesc: descriptions[i] ?? b.rows[i]?.defaultDesc ?? "",
          }));
        };

        const getMatCell = (blockId: string, desc = "", defUnit = "") => {
          const key = historyBlockKey[blockId] ?? blockId;
          const current = currentMaterialData[key]?.[desc];
          const historic = history.materialsByBlock?.[key]?.[desc];
          const lastNum = historic?.qty ?? 0;
          const todayNum = current?.qty ?? 0;
          const hasQty = Boolean(current || historic);
          return {
            desc,
            unit: current?.unit || historic?.unit || defUnit,
            upToLast: historic ? String(lastNum) : "",
            today: current ? String(todayNum) : "",
            autoUpToNow: hasQty ? String(Number((lastNum + todayNum).toFixed(2))) : "",
            lastNum,
            todayNum,
            nowNum: hasQty ? Number((lastNum + todayNum).toFixed(2)) : 0,
          };
        };

        const renderBlock = (b: MaterialBlockDef) => {
          const rows = materialRowsForBlock(b);
          let sumLast = 0;
          let sumToday = 0;
          let sumNow = 0;
          let anyEntered = false;
          rows.forEach((r) => {
            const v = getMatCell(b.id, r.defaultDesc ?? "", r.defaultUnit);
            if (v.upToLast || v.today || v.autoUpToNow) anyEntered = true;
            sumLast += v.lastNum;
            sumToday += v.todayNum;
            sumNow += v.nowNum;
          });

          return (
            <table className="daily-report-material-subtable w-full table-fixed border-collapse border-2 border-black font-serif text-[10px] text-black">
              <colgroup>
                <col style={{ width: "6.5%" }} />
                <col style={{ width: "31.5%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "17%" }} />
              </colgroup>
              <thead>
                <tr className="h-[20px] bg-white">
                  <th colSpan={6} className="border-b-2 border-black px-2 text-center text-[11px] font-bold">
                    {b.title}
                  </th>
                </tr>
                <tr className="h-[28px] bg-[#c5d9f1] font-bold">
                  <th className="border-b border-r border-black p-0 text-center">
                    <div className="mx-auto flex h-[26px] items-center justify-center [writing-mode:vertical-rl] rotate-180 text-[9px] font-bold">
                      Row
                    </div>
                  </th>
                  <th className="border-b border-r border-black px-1 text-center text-[10px] font-bold">{b.descHeader}</th>
                  <th className="border-b border-r border-black px-1 text-center text-[9.5px] font-bold">Unit</th>
                  <th className="border-b border-r border-black px-1 text-center text-[9.5px] font-bold">
                    {b.upToLastHeader !== undefined ? b.upToLastHeader : "Up to Last"}
                  </th>
                  <th
                    className={`border-b border-r border-black px-1 text-center text-[9.5px] font-bold ${
                      b.todayRed ? "text-[#c00000]" : "text-black"
                    }`}
                  >
                    Today
                  </th>
                  <th className="border-b border-black px-1 text-center text-[9px] leading-tight font-bold">
                    <div>Up to</div>
                    <div>Now</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const v = getMatCell(b.id, r.defaultDesc ?? "", r.defaultUnit);
                  return (
                    <tr key={i} className="h-[17px] bg-white">
                      <td className="border-b border-r border-black/70 text-center font-sans text-[9.5px] tabular-nums">
                        {r.num}
                      </td>
                      <td className="border-b border-r border-black/70 p-0">
                        <div className="min-w-0 w-full px-1 text-center font-serif text-[10px]">{v.desc}</div>
                      </td>
                      <td className="border-b border-r border-black/70 p-0">
                        <div className="min-w-0 w-full px-0.5 text-center font-serif text-[9.5px]">{v.unit}</div>
                      </td>
                      <td className="border-b border-r border-black/70 p-0">
                        <div className="min-w-0 w-full px-0.5 text-center font-sans text-[9.5px] tabular-nums">{v.upToLast}</div>
                      </td>
                      <td className="border-b border-r border-black/70 p-0">
                        <div className="min-w-0 w-full px-0.5 text-center font-sans text-[9.5px] tabular-nums">{v.today}</div>
                      </td>
                      <td className="border-b border-black/70 p-0">
                        <div className="min-w-0 w-full px-0.5 text-center font-sans text-[9.5px] tabular-nums">{v.autoUpToNow}</div>
                      </td>
                    </tr>
                  );
                })}
                <tr className="h-[19px] bg-white font-bold">
                  <td colSpan={3} className="border-t-2 border-r-2 border-black text-center text-[10.5px] font-bold">
                    {b.totalLabel}
                  </td>
                  <td className="border-t-2 border-r border-black text-center font-sans text-[9.5px] tabular-nums">
                    {anyEntered && sumLast ? sumLast : ""}
                  </td>
                  <td className="border-t-2 border-r border-black text-center font-sans text-[9.5px] tabular-nums">
                    {anyEntered && sumToday ? sumToday : ""}
                  </td>
                  <td className="border-t-2 border-black text-center font-sans text-[9.5px] tabular-nums">
                    {anyEntered && sumNow ? sumNow : ""}
                  </td>
                </tr>
              </tbody>
            </table>
          );
        };

        return (
          <div id="daily-report-cover" dir="ltr" className="w-full overflow-x-auto">
            <div className="daily-report-sheet-fit daily-report-sheet-material mx-auto box-border flex w-full flex-col bg-white p-1.5 font-sans text-[#111] shadow-xl">
              {/* ── هدر شیت متریال (همان هدر نیروی انسانی: Con. / Date / No | Daily Material Report | لوگوی کارفرما، مشاور و پیمانکار) ── */}
              <table className="daily-report-sub-header mb-1.5 w-full table-fixed border-collapse border-2 border-black font-sans text-[10px] text-black">
                <colgroup>
                  <col style={{ width: "6.5%" }} />
                  <col style={{ width: "21.5%" }} />
                  <col style={{ width: "44%" }} />
                  <col style={{ width: "28%" }} />
                </colgroup>
                <tbody>
                  <tr className="h-[18px]">
                    <td className="border-b border-r border-black px-1.5 font-bold">Con.:</td>
                    <td className="border-b border-r-2 border-r-black border-b-black/60 p-0">
                      <input
                        size={1}
                        value={coverSheet.machineryHeader?.con ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machineryHeader: { ...(s.machineryHeader ?? { con: "", line1: "", line2: "" }), con: e.target.value },
                          }))
                        }
                        className="min-w-0 w-full bg-transparent px-1.5 text-[9.5px] outline-none"
                      />
                    </td>
                    <td className="border-b border-r-2 border-r-black border-b-black/25 p-0">
                      <input
                        size={1}
                        value={coverSheet.machineryHeader?.line1 ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machineryHeader: { ...(s.machineryHeader ?? { con: "", line1: "", line2: "" }), line1: e.target.value },
                          }))
                        }
                        className="min-w-0 w-full bg-transparent px-2 text-center text-[10px] font-semibold outline-none"
                      />
                    </td>
                    <td rowSpan={3} className="p-1 align-middle">
                      <div className="grid h-full grid-cols-3 items-center gap-1">
                        {(["client", "consultant", "contractor"] as const).map((roleKey) => {
                          const labelFa = roleKey === "client" ? "کارفرما" : roleKey === "consultant" ? "مشاور" : "پیمانکار";
                          const logoSrc = coverLogos[roleKey];
                          return (
                            <label
                              key={roleKey}
                              className={`flex h-[46px] cursor-pointer flex-col items-center justify-center rounded px-1 text-center transition ${
                                logoSrc ? "has-logo" : "border border-dashed border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {logoSrc ? (
                                <img src={logoSrc} alt={roleKey} className="max-h-[42px] max-w-full object-contain" />
                              ) : (
                                <span className="no-print-placeholder text-[8px] text-gray-400">{labelFa}</span>
                              )}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => importCoverLogo(roleKey, e.target.files)} />
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                  <tr className="h-[18px]">
                    <td className="border-b border-r border-black px-1.5 font-bold">Date:</td>
                    <td className="border-b border-r-2 border-r-black border-b-black/60 px-1.5 font-sans font-medium tabular-nums">
                      {toPersianDigits(report.reportDate)}
                    </td>
                    <td className="border-b border-r-2 border-r-black border-b-black/25 p-0">
                      <input
                        size={1}
                        value={coverSheet.machineryHeader?.line2 ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            machineryHeader: { ...(s.machineryHeader ?? { con: "", line1: "", line2: "" }), line2: e.target.value },
                          }))
                        }
                        className="min-w-0 w-full bg-transparent px-2 text-center text-[9.5px] outline-none"
                      />
                    </td>
                  </tr>
                  <tr className="h-[18px]">
                    <td className="border-r border-black px-1.5 font-bold">No:</td>
                    <td className="border-r-2 border-black px-1.5 font-mono font-medium">
                      {report.reportNo}
                    </td>
                    <td className="border-r-2 border-black px-2 text-center text-[11px] font-bold">
                      Daily Material Report
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ── ۹ جدول متریال در ۵ ردیف دوتایی مطابق تصویر ── */}
              <div className="flex flex-1 flex-col justify-between space-y-2">
                {pairs.map(([leftB, rightB], pIdx) => (
                  <div key={pIdx} className="grid grid-cols-[1fr_12px_1fr] items-start">
                    <div>{renderBlock(leftB)}</div>
                    <div />
                    <div>{rightB ? renderBlock(rightB) : null}</div>
                  </div>
                ))}
              </div>

              {/* ── کادر امضاهای پایین شیت متریال (۴ ستونی عین تصویر) ── */}
              <table className="mt-2 w-full table-fixed border-collapse border-2 border-black font-sans text-[10px] text-black">
                <tbody>
                  <tr className="h-[52px] align-top">
                    <td className="w-1/4 border-r border-black px-2 py-1">
                      <div>Prepared &nbsp;By:</div>
                      <div className="mt-0.5">Planning &amp; Project Control</div>
                      <input
                        size={1}
                        value={coverSheet.materialSigns?.preparedBy ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            materialSigns: {
                              ...(s.materialSigns ?? { preparedBy: "", approvedSiteManager: "", approvedOiec: "", receivedOiec: "" }),
                              preparedBy: e.target.value,
                            },
                          }))
                        }
                        className="mt-0.5 min-w-0 w-full bg-transparent text-[9.5px] outline-none"
                      />
                    </td>
                    <td className="w-1/4 border-r border-black px-2 py-1">
                      <div>Appreoved By:</div>
                      <div className="mt-0.5">Site Manager</div>
                      <input
                        size={1}
                        value={coverSheet.materialSigns?.approvedSiteManager ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            materialSigns: {
                              ...(s.materialSigns ?? { preparedBy: "", approvedSiteManager: "", approvedOiec: "", receivedOiec: "" }),
                              approvedSiteManager: e.target.value,
                            },
                          }))
                        }
                        className="mt-0.5 min-w-0 w-full bg-transparent text-[9.5px] outline-none"
                      />
                    </td>
                    <td className="w-1/4 border-r border-black px-2 py-1">
                      <div>Appreoved By:</div>
                      <div className="mt-0.5">(Area manager A)</div>
                      <input
                        size={1}
                        value={coverSheet.materialSigns?.approvedOiec ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            materialSigns: {
                              ...(s.materialSigns ?? { preparedBy: "", approvedSiteManager: "", approvedOiec: "", receivedOiec: "" }),
                              approvedOiec: e.target.value,
                            },
                          }))
                        }
                        className="mt-0.5 min-w-0 w-full bg-transparent text-[9.5px] outline-none"
                      />
                    </td>
                    <td className="w-1/4 px-2 py-1">
                      <div>Received By:</div>
                      <div className="mt-0.5">Planning &amp; Project Control</div>
                      <input
                        size={1}
                        value={coverSheet.materialSigns?.receivedOiec ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          patchCoverSheet((s) => ({
                            ...s,
                            materialSigns: {
                              ...(s.materialSigns ?? { preparedBy: "", approvedSiteManager: "", approvedOiec: "", receivedOiec: "" }),
                              receivedOiec: e.target.value,
                            },
                          }))
                        }
                        className="mt-0.5 min-w-0 w-full bg-transparent text-[9.5px] outline-none"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ═══ تب ۵ در پشتیبان گزارش روزانه: متریال وارده به کارگاه ═══ */}
      {viewMode === "support" && tab === "materials" && report && (
        <div className="space-y-2">
          <datalist id="dpr-material-codes">
            {materialCatalog.map(([code, desc]) => <option key={code} value={code}>{code} — {desc}</option>)}
          </datalist>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <label className="shrink-0 tx3">{rtl ? "کد کالای ثابت:" : "Fixed material code:"}</label>
            <select
              className="max-w-48 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1"
              style={{ colorScheme: "dark" }}
              onChange={(e) => {
                const code = e.target.value;
                if (!code) return;
                const desc = materialCatalog.find(([c]) => c === code)?.[1] ?? "";
                patch((r) => ({
                  ...r,
                  materials: [
                    ...r.materials,
                    { group: "", itemCode: code, desc, truckNo: "", ticketNo: "", grade: "", unit: "", gross: null, tare: null, net: null, qtyVcn: null, tonnage: null, entryDate: date, entryTime: "", contractor: "", usage: "" },
                  ],
                }));
                e.currentTarget.value = "";
              }}
            >
              <option value="">{rtl ? "انتخاب کد برای افزودن ردیف…" : "Choose code to add a row…"}</option>
              {materialCatalog.map(([code, desc]) => (
                <option key={code} value={code}>
                  {code} — {desc}
                </option>
              ))}
            </select>
            <span className="h-4 w-px bg-white/10" aria-hidden="true" />
            <input
              value={newMaterialCode}
              onChange={(e) => setNewMaterialCode(e.target.value)}
              placeholder={rtl ? "کد جدید" : "New code"}
              className="w-20 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1"
            />
            <input
              value={newMaterialDesc}
              onChange={(e) => setNewMaterialDesc(e.target.value)}
              placeholder={rtl ? "شرح کد جدید" : "New description"}
              className="w-36 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1"
            />
            <button
              disabled={!newMaterialCode.trim() || !newMaterialDesc.trim()}
              onClick={() => {
                const code = newMaterialCode.trim();
                const desc = newMaterialDesc.trim();
                setMaterialCatalog((prev) => [...prev.filter(([c]) => c !== code), [code, desc]]);
                setNewMaterialCode("");
                setNewMaterialDesc("");
              }}
              className="shrink-0 rounded-lg border b-line-soft px-2 py-1 tx2 disabled:opacity-40"
            >
              + {rtl ? "افزودن کد" : "Add code"}
            </button>
            <span className="h-4 w-px bg-white/10" aria-hidden="true" />
            <input
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              placeholder={rtl ? "فیلتر کد، شرح، گروه یا پیمانکار…" : "Filter code, description, group or contractor…"}
              className="min-w-40 flex-1 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1 outline-none focus:border-[var(--accent)]"
            />
            <span className="shrink-0 tabular-nums tx4">
              {report.materials.filter((m) => !materialFilter || [m.itemCode, m.desc, m.group, m.contractor, m.usage].join(" ").toLowerCase().includes(materialFilter.toLowerCase())).length} / {report.materials.length}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border b-line-soft">
            <table className="w-full min-w-max border-separate border-spacing-0 text-[10px]">
              <thead className="bg-[var(--bg-c)] tx1">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>{rtl ? "گروه" : "Group"}</th>
                  <th className={th}>{rtl ? "کد کالا" : "Item code"}</th>
                  <th className={th}>{rtl ? "شرح" : "Description"}</th>
                  <th className={th}>{rtl ? "شماره کامیون/تراک" : "Truck no."}</th>
                  <th className={th}>{rtl ? "قبض انبار/باسکول" : "Ticket no."}</th>
                  <th className={th}>{rtl ? "رده" : "Grade"}</th>
                  <th className={th}>{rtl ? "واحد" : "Unit"}</th>
                  <th className={th}>{rtl ? "پر" : "Gross"}</th>
                  <th className={th}>{rtl ? "خالی" : "Tare"}</th>
                  <th className={th}>{rtl ? "خالص" : "Net"}</th>
                  <th className={th}>{rtl ? "(حجم/تعداد/وزن)" : "(Vol/Cnt/Wt)"}</th>
                  <th className={th}>{rtl ? "تناز" : "Tonnage"}</th>
                  <th className={th}>{rtl ? "تاریخ ورود" : "Entry date"}</th>
                  <th className={th}>{rtl ? "ساعت ورود" : "Entry time"}</th>
                  <th className={th}>{rtl ? "پیمانکار/شخص" : "Contractor"}</th>
                  <th className={th}>{rtl ? "موقعیت مصرف" : "Usage"}</th>
                  <th className={th}>—</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {report.materials.map((m, originalIndex) => ({ m, originalIndex })).filter(({ m }) => !materialFilter || [m.itemCode,m.desc,m.group,m.contractor,m.usage].join(" ").toLowerCase().includes(materialFilter.toLowerCase())).map(({ m, originalIndex: i }) => (
                  <tr key={i} className="bg-[var(--bg-b)]">
                    <td className={`${td} tx4 tabular-nums`} dir="ltr">{i + 1}</td>
                    <td className={td}><CellText value={m.group} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, group: v }))} /></td>
                    <td className={td}><CellText value={m.itemCode} disabled={locked} resetKey={resetKey} listId="dpr-material-codes" align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, itemCode: v }))} /></td>
                    <td className={td}><CellText value={m.desc} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, desc: v }))} /></td>
                    <td className={td}><CellText value={m.truckNo} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, truckNo: v }))} /></td>
                    <td className={td}><CellText value={m.ticketNo} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, ticketNo: v }))} /></td>
                    <td className={td}><CellText value={m.grade} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, grade: v }))} /></td>
                    <td className={td}><CellText value={m.unit} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, unit: v }))} /></td>
                    <td className={td}><CellNum wide value={m.gross} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, gross: v }))} /></td>
                    <td className={td}><CellNum wide value={m.tare} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, tare: v }))} /></td>
                    <td className={td}><CellNum wide value={m.net} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, net: v }))} /></td>
                    <td className={td}><CellNum wide value={m.qtyVcn} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, qtyVcn: v }))} /></td>
                    <td className={td}><CellNum wide value={m.tonnage} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, tonnage: v }))} /></td>
                    <td className={td}><CellText value={m.entryDate} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, entryDate: v }))} /></td>
                    <td className={td}><CellText value={m.entryTime} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, entryTime: v }))} /></td>
                    <td className={td}><CellText value={m.contractor} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, contractor: v }))} /></td>
                    <td className={td}><CellText value={m.usage} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, usage: v }))} /></td>
                    <td className={td}>
                      <button disabled={locked} onClick={() => patch((r) => ({ ...r, materials: r.materials.filter((_, j) => j !== i) }))} className="px-1 text-rose-300 disabled:opacity-40">✕</button>
                    </td>
                  </tr>
                ))}
                {!report.materials.length && (
                  <tr className="bg-[var(--bg-b)]">
                    <td colSpan={18} className="px-2 py-3 text-center tx4">{rtl ? "ردیفی ثبت نشده — «+ ردیف»" : "No rows — press + row"}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={locked}
              onClick={() =>
                patch((r) => ({
                  ...r,
                  materials: [...r.materials, { group: "", itemCode: "", desc: "", truckNo: "", ticketNo: "", grade: "", unit: "", gross: null, tare: null, net: null, qtyVcn: null, tonnage: null, entryDate: date, entryTime: "", contractor: "", usage: "" }],
                }))
              }
              className="rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2 disabled:opacity-40"
            >
              + {rtl ? "ردیف" : "Row"}
            </button>
            <p className="text-[9px] tx4">{rtl ? `تعداد ردیف: ${report.materials.length} · سرستون «(حجم/تعداد/وزن)» از روی عکس خوانده شد؛ اگر دقیق نیست اعلام کنید.` : `Rows: ${report.materials.length} · The "(Vol/Cnt/Wt)" header was read from the photo; report if inaccurate.`}</p>
          </div>
        </div>
      )}

      {/* ═══ تب ۶: تغییرات و فعالیت تشریحی ═══ */}
      {activeTab === "changes" && report && (
        <div className="space-y-2">
          <datalist id="dpr-change-ids">
            {knownChangeIds.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <input
              value={changeFilter}
              onChange={(e) => setChangeFilter(e.target.value)}
              placeholder={rtl ? "فیلتر شناسه، موقعیت، واحد، دیسیپلین، فعالیت یا پیمانکار…" : "Filter ID, location, unit, discipline, activity or contractor…"}
              className="w-72 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1 outline-none focus:border-[var(--accent)]"
            />
            <span className="tabular-nums tx4">
              {report.changes.filter((c) => !changeFilter || [c.refId, c.location, c.unit, c.discipline, c.activity, c.contractor].join(" ").toLowerCase().includes(changeFilter.toLowerCase())).length} / {report.changes.length}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border b-line-soft">
            <table className="w-full min-w-max border-separate border-spacing-0 text-[10px]">
              <thead className="bg-[var(--bg-c)] tx1">
                <tr>
                  <th className={th}>ID</th>
                  <th className={th}>Location</th>
                  <th className={th}>Unit</th>
                  <th className={th}>Discipline</th>
                  <th className={th}>Activity</th>
                  <th className={th}>{rtl ? "مقدار کل" : "Total"}</th>
                  <th className={th}>{rtl ? "این دوره" : "This period"}</th>
                  <th className={th}>{rtl ? "تجمعی" : "Cumulative"}</th>
                  <th className={th}>{rtl ? "باقیمانده" : "Remaining"}</th>
                  <th className={th}>{rtl ? "درصد" : "%"}</th>
                  <th className={th}>Contractor</th>
                  <th className={th}>{rtl ? "شرح عملیات" : "شرح عملیات"}</th>
                  <th className={th}>{rtl ? "توضیحات" : "توضیحات"}</th>
                  <th className={th}>—</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {report.changes.map((c, originalIndex) => ({ c, originalIndex })).filter(({ c }) => !changeFilter || [c.refId,c.location,c.unit,c.discipline,c.activity,c.contractor].join(" ").toLowerCase().includes(changeFilter.toLowerCase())).map(({ c, originalIndex: i }) => {
                  // اگر یک فعالیت در همان گزارش بیش از یک بار آمده باشد، هر ردیف ادامهٔ
                  // ردیف قبلی همان شناسه است؛ بنابراین تجمعی و درصد از صفر شروع نمی‌شود.
                  const ref = c.refId.trim();
                  const sameActivityToday = report.changes
                    .slice(0, i)
                    .filter((x) => x.refId.trim() === ref)
                    .reduce((sum, x) => sum + (Number(x.thisQty) || 0), 0);
                  const prev = (history.changes[ref] ?? 0) + sameActivityToday;
                  const calcR = changeCalc(c.totalQty, prev, c.thisQty);
                  return (
                    <tr key={i} className="bg-[var(--bg-b)]">
                      <td className={td}><CellText value={c.refId} disabled={locked || viewMode === "cover"} resetKey={resetKey} listId="dpr-change-ids" align="center" onCommit={(v) => patchChange(i, (x) => ({ ...x, refId: v }))} /></td>
                      <td className={td}><CellText value={c.location} disabled={locked || viewMode === "cover"} resetKey={resetKey} align="center" onCommit={(v) => patchChange(i, (x) => ({ ...x, location: v }))} /></td>
                      <td className={td}><CellText value={c.unit} disabled={locked || viewMode === "cover"} resetKey={resetKey} align="center" onCommit={(v) => patchChange(i, (x) => ({ ...x, unit: v }))} /></td>
                      <td className={td}><CellText value={c.discipline} disabled={locked || viewMode === "cover"} resetKey={resetKey} align="center" onCommit={(v) => patchChange(i, (x) => ({ ...x, discipline: v }))} /></td>
                      <td className={td}><CellText value={c.activity} disabled={locked || viewMode === "cover"} resetKey={resetKey} onCommit={(v) => patchChange(i, (x) => ({ ...x, activity: v }))} /></td>
                      <td className={td}><CellNum wide value={c.totalQty} disabled={locked || viewMode === "cover"} resetKey={resetKey} onCommit={(v) => patchChange(i, (x) => ({ ...x, totalQty: v }))} /></td>
                      <td className={td}><CellNum wide value={c.thisQty} disabled={locked || viewMode === "cover"} resetKey={resetKey} onCommit={(v) => patchChange(i, (x) => ({ ...x, thisQty: v }))} /></td>
                      <td className={`${td} ${calc}`} dir="ltr" title={rtl ? `سابقه: ${fmtQty(prev)}` : `History: ${fmtQty(prev)}`}>{fmtQty(calcR.cum)}</td>
                      <td className={`${td} ${calc}`} dir="ltr">{fmtQty(calcR.remaining)}</td>
                      <td className={`${td} ${calc}`} dir="ltr">{fmtPct(calcR.pct)}</td>
                      <td className={td}><CellText value={c.contractor} disabled={locked || viewMode === "cover"} resetKey={resetKey} align="center" onCommit={(v) => patchChange(i, (x) => ({ ...x, contractor: v }))} /></td>
                      <td className={td}><CellText value={c.opsFa} disabled={locked || viewMode === "cover"} resetKey={resetKey} onCommit={(v) => patchChange(i, (x) => ({ ...x, opsFa: v }))} /></td>
                      <td className={td}><CellText value={c.noteFa} disabled={locked || viewMode === "cover"} resetKey={resetKey} onCommit={(v) => patchChange(i, (x) => ({ ...x, noteFa: v }))} /></td>
                      <td className={td}>
                        <button disabled={locked || viewMode === "cover"} onClick={() => patch((r) => ({ ...r, changes: r.changes.filter((_, j) => j !== i) }))} className="px-1 text-rose-300 disabled:opacity-40">✕</button>
                      </td>
                    </tr>
                  );
                })}
                {!report.changes.length && (
                  <tr className="bg-[var(--bg-b)]">
                    <td colSpan={14} className="px-2 py-3 text-center tx4">{rtl ? "ردیفی ثبت نشده — «+ ردیف»" : "No rows — press + row"}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={locked || viewMode === "cover"}
              onClick={() =>
                patch((r) => ({
                  ...r,
                  changes: [...r.changes, { date, refId: "", location: "", unit: "", discipline: "", activity: "", totalQty: null, thisQty: null, contractor: "", opsFa: "", noteFa: "" }],
                }))
              }
              className="rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2 disabled:opacity-40"
            >
              + {rtl ? "ردیف" : "Row"}
            </button>
            <p className="text-[9px] tx4">{rtl ? "تجمعی هر شناسه = جمع «این دوره» همان شناسه در گزارش‌های قبلی + امروز." : "Cumulative per ID = prior history + today."}</p>
          </div>
        </div>
      )}

      {/* ═══ تب ۷: PMS ═══ */}
      {activeTab === "activities" && report && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <input
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              placeholder={rtl ? "فیلتر شناسه، کد، فعالیت، فاز، ناحیه یا WBS…" : "Filter ID, code, activity, phase, area or WBS…"}
              className="w-72 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1 outline-none focus:border-[var(--accent)]"
            />
            <span className="tx4">
              {
                report.activities.filter(
                  (a) =>
                    !activityFilter ||
                    [
                      a.activityId ?? "",
                      a.activityType ?? "",
                      a.acCode,
                      a.activity,
                      a.subPhase,
                      a.dis,
                      a.area,
                      a.workPackage,
                      a.subPackage,
                      a.wbsCode ?? "",
                      a.level ?? "",
                      a.executor,
                    ]
                      .join(" ")
                      .toLowerCase()
                      .includes(activityFilter.toLowerCase()),
                ).length
              }{" "}
              / {report.activities.length}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border b-line-soft" dir="ltr">
            <table className="w-full min-w-max border-separate border-spacing-0 text-[10px]">
              <thead>
                <tr className="bg-[#d9d9d9] text-[11px] font-bold text-[#111]">
                  <th colSpan={1} className="border-b border-r border-gray-400 px-2 py-1" />
                  <th colSpan={3} className="border-b border-r border-gray-400 px-2 py-1" />
                  <th colSpan={3} className="border-b border-r border-gray-400 px-2 py-1 text-center font-bold">
                    Duration
                  </th>
                  <th colSpan={3} className="border-b border-r border-gray-400 px-2 py-1" />
                  <th colSpan={6} className="border-b border-r border-gray-400 px-2 py-1 text-center font-bold">
                    QUANTITY -TOTAL
                  </th>
                  <th colSpan={3} className="border-b border-r border-gray-400 bg-[#3b4b61] px-2 py-1 text-center font-serif font-semibold text-white">
                    % PROGRESS
                  </th>
                  <th className="border-b border-gray-400 bg-[#d9d9d9] px-1 py-1" />
                </tr>
                <tr className="bg-[#d9d9d9] text-[10px] font-medium text-[#111]">
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">level</th>
                  <th className="border-b border-r border-gray-400 px-2 py-2 text-center">Activity</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">W.V</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">W.F</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">Du.</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">Start</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">Finish</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">Plan</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">Act</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">Var.</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">U.O.M</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">BOQ</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">Estimate</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">
                    Up To<br />Last
                  </th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">
                    Up To<br />Now
                  </th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">Remain</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">Last Day</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">Today</th>
                  <th className="border-b border-r border-gray-400 px-1.5 py-2 text-center">Cum.</th>
                  <th className="border-b border-gray-400 px-1 py-2 text-center">—</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {report.activities
                  .map((a, originalIndex) => ({ a, originalIndex }))
                  .filter(
                    ({ a }) =>
                      !activityFilter ||
                      [
                        a.activity,
                        a.level ?? "",
                        a.unit,
                        a.executor,
                      ]
                        .join(" ")
                        .toLowerCase()
                        .includes(activityFilter.toLowerCase()),
                  )
                  .map(({ a, originalIndex: i }) => {
                    const last = history.activities[activityHistoryKey(a.acCode, a.activity)] ?? 0;
                    const calcR = activityCalc(a.estimated, last, a.todayQty);
                    const varVal =
                      a.varPct !== undefined && a.varPct !== null
                        ? a.varPct
                        : a.actPct !== undefined && a.actPct !== null && a.planPct !== undefined && a.planPct !== null
                          ? Number((a.actPct - a.planPct).toFixed(2))
                          : null;
                    return (
                      <tr key={i} className="bg-[var(--bg-b)]">
                        <td className={td}>
                          <CellText
                            value={a.level ?? ""}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            align="center"
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, level: v }))}
                          />
                        </td>
                        <td className={td}>
                          <CellText
                            value={a.activity}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, activity: v }))}
                          />
                        </td>
                        <td className={td}>
                          <CellNum
                            wide
                            value={a.wv ?? null}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, wv: v }))}
                          />
                        </td>
                        <td className={td}>
                          <CellNum
                            wide
                            value={a.wf ?? null}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, wf: v }))}
                          />
                        </td>
                        <td className={td}>
                          <CellNum
                            wide
                            value={a.duration ?? null}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, duration: v }))}
                          />
                        </td>
                        <td className={td}>
                          <CellText
                            value={a.startDate}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            align="center"
                            placeholder="1403/.."
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, startDate: v }))}
                          />
                        </td>
                        <td className={td}>
                          <CellText
                            value={a.endDate}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            align="center"
                            placeholder="1403/.."
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, endDate: v }))}
                          />
                        </td>
                        <td className={td}>
                          <CellNum
                            wide
                            value={a.planPct ?? null}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, planPct: v }))}
                          />
                        </td>
                        <td className={td}>
                          <CellNum
                            wide
                            value={a.actPct ?? null}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, actPct: v }))}
                          />
                        </td>
                        <td className={`${td} ${calc}`} dir="ltr">
                          {varVal !== null ? fmtQty(varVal) : "—"}
                        </td>
                        <td className={td}>
                          <CellText
                            value={a.unit}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            align="center"
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, unit: v }))}
                          />
                        </td>
                        <td className={td}>
                          <CellNum
                            wide
                            value={a.boq ?? null}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, boq: v }))}
                          />
                        </td>
                        <td className={td}>
                          <CellNum
                            wide
                            value={a.estimated}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, estimated: v }))}
                          />
                        </td>
                        <td className={`${td} ${calc}`} dir="ltr">
                          {fmtQty(calcR.lastCum)}
                        </td>
                        <td className={`${td} ${calc}`} dir="ltr">
                          {fmtQty(calcR.cum)}
                        </td>
                        <td className={`${td} ${calc}`} dir="ltr">
                          {fmtQty(calcR.rem)}
                        </td>
                        <td className={`${td} ${calc}`} dir="ltr">
                          {fmtPct(calcR.lastPct)}
                        </td>
                        <td className={td}>
                          <CellNum
                            wide
                            value={a.todayQty}
                            disabled={locked || viewMode === "cover"}
                            resetKey={resetKey}
                            onCommit={(v) => patchActivity(i, (x) => ({ ...x, todayQty: v }))}
                          />
                        </td>
                        <td className={`${td} ${calc}`} dir="ltr">
                          {fmtPct(calcR.cumPct)}
                        </td>
                        <td className={td}>
                          <button
                            disabled={locked || viewMode === "cover"}
                            onClick={() => patch((r) => ({ ...r, activities: r.activities.filter((_, j) => j !== i) }))}
                            className="px-1 text-rose-300 disabled:opacity-40"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {!report.activities.length && (
                  <tr className="bg-[var(--bg-b)]">
                    <td colSpan={20} className="px-2 py-3 text-center tx4">
                      {rtl ? "ردیفی ثبت نشده — «+ ردیف»" : "No rows — press + row"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={locked || viewMode === "cover"}
              onClick={() =>
                patch((r) => ({
                  ...r,
                  activities: [
                    ...r.activities,
                    {
                      activityId: "",
                      activityType: "",
                      acCode: "",
                      subPhase: "",
                      dis: "",
                      area: "",
                      workPackage: "",
                      subPackage: "",
                      wbsCode: "",
                      level: "",
                      activity: "",
                      wv: null,
                      wf: null,
                      duration: null,
                      unit: "",
                      boq: null,
                      estimated: null,
                      todayQty: null,
                      startDate: "",
                      endDate: "",
                      planPct: null,
                      actPct: null,
                      varPct: null,
                      executor: "",
                      note: "",
                    },
                  ],
                }))
              }
              className="rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2 disabled:opacity-40"
            >
              + {rtl ? "ردیف" : "Row"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
