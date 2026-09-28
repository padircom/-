/**
 * MIX-1 — Drill-down سبد ← پروژه ← فاز ← سند/بستهٔ خرید/فعالیت (P9).
 *
 * هر بخش (section) یک جدول زنده با **مجوز خواندن خودش** است. بخشی که کاربر
 * مجوزش را ندارد با `restricted` برمی‌گردد و شمارشش `null` می‌ماند — نه صفر.
 * فاز از سلسله‌مراتب `WbsNode` ساخته می‌شود: ریشهٔ هر گره، فاز آن است.
 */
export const DRILL_MODEL = "mcs-drill-v1";

export type Bi = { fa: string; en: string };
export type DrillRow = Record<string, unknown>;

export type DrillSectionSpec = {
  key: string;
  table: string;
  label: Bi;
  permissions: readonly string[];
  codeField: string;
  titleField: string;
  statusField?: string;
  dateField?: string;
  amountField?: string;
  /** ستونی که به `WbsNode.Id` اشاره می‌کند؛ بدون آن ردیف در «بدون فاز» می‌نشیند. */
  wbsField?: string;
  sortField?: string;
};

const S = (spec: DrillSectionSpec): DrillSectionSpec => spec;

export const DRILL_SECTIONS: readonly DrillSectionSpec[] = [
  S({ key: "activities", table: "Activity", label: { fa: "فعالیت‌ها", en: "Activities" }, permissions: ["plan.schedule.view"], codeField: "Code", titleField: "NameFa", statusField: "Discipline", dateField: "PlannedFinish", wbsField: "WbsId", sortField: "PlannedFinish" }),
  S({ key: "documents", table: "Document", label: { fa: "مدارک", en: "Documents" }, permissions: ["doc.document.view"], codeField: "DocNo", titleField: "TitleFa", statusField: "Status", dateField: "IssuedAt", sortField: "IssuedAt" }),
  S({ key: "proc_packages", table: "ScmProcPackage", label: { fa: "بسته‌های خرید", en: "Procurement packages" }, permissions: ["scm.package.view"], codeField: "Code", titleField: "TitleFa", statusField: "Status", dateField: "PlannedIssueDate", amountField: "TotalEstimatedAmount", wbsField: "WbsId", sortField: "PlannedIssueDate" }),
  S({ key: "purchase_orders", table: "PurchaseOrder", label: { fa: "سفارش‌های خرید", en: "Purchase orders" }, permissions: ["fin.cost.view"], codeField: "PoNo", titleField: "TitleFa", statusField: "Status", dateField: "IssuedAt", amountField: "Amount", sortField: "IssuedAt" }),
  S({ key: "ipc_certificates", table: "CntIpcCertificate", label: { fa: "صورت‌وضعیت‌ها", en: "IPC certificates" }, permissions: ["cnt.ipc.review", "cnt.ipc.prepare", "cnt.contract.view"], codeField: "ContractCode", titleField: "TemplateCode", statusField: "Status", dateField: "PeriodTo", amountField: "NetAmount", sortField: "PeriodTo" }),
  S({ key: "dpr", table: "CpmDprEntry", label: { fa: "گزارش‌های روزانه", en: "Daily reports" }, permissions: ["cpm.dpr.view"], codeField: "ReportNo", titleField: "WorkDoneFa", statusField: "Status", dateField: "ReportDate", sortField: "ReportDate" }),
  S({ key: "inspections", table: "CpmInspectionRequest", label: { fa: "درخواست‌های بازرسی", en: "Inspection requests" }, permissions: ["cpm.inspection.view"], codeField: "RequestNo", titleField: "ScopeFa", statusField: "Status", dateField: "TargetDate", sortField: "TargetDate" }),
  S({ key: "ncrs", table: "Ncr", label: { fa: "عدم‌انطباق‌ها", en: "NCRs" }, permissions: ["qms.itp.view"], codeField: "Code", titleField: "TitleFa", statusField: "Status", dateField: "DueAt", sortField: "DueAt" }),
  S({ key: "risks", table: "Risk", label: { fa: "ریسک‌ها", en: "Risks" }, permissions: ["rcc.risk.view"], codeField: "Code", titleField: "TitleFa", statusField: "Status", amountField: "Score", sortField: "Code" }),
  S({ key: "health", table: "PmoHealthAssessment", label: { fa: "کارت‌های سلامت", en: "Health cards" }, permissions: ["pmo.health.view"], codeField: "AsOfDate", titleField: "Band", statusField: "Status", dateField: "AsOfDate", amountField: "ScoreTotal", sortField: "AsOfDate" }),
] as const;

export function drillSectionByKey(key: unknown): DrillSectionSpec | undefined {
  const k = String(key ?? "").trim();
  return DRILL_SECTIONS.find((s) => s.key === k);
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const iso = (v: unknown): string | null => {
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

export type DrillWbsNode = { Id: string; Code: string; NameFa: string; ParentId: string | null; Level: number | null };

export type PhaseInfo = { id: string; code: string; title: string; level: number };

/** نگاشت هر گرهٔ WBS به ریشهٔ خودش؛ ریشه = فاز. */
export function buildPhaseIndex(wbs: DrillWbsNode[]): { phaseOf: Map<string, PhaseInfo>; phases: PhaseInfo[] } {
  const byId = new Map(wbs.map((w) => [str(w.Id), w]));
  const phaseOf = new Map<string, PhaseInfo>();
  const memo = (id: string, depth = 0): PhaseInfo => {
    const cached = phaseOf.get(id);
    if (cached) return cached;
    const node = byId.get(id);
    if (!node || depth > 30) {
      const fallback: PhaseInfo = { id: "", code: "", title: "—", level: 0 };
      return fallback;
    }
    const parentId = node.ParentId ? str(node.ParentId) : "";
    const info = parentId && byId.has(parentId)
      ? memo(parentId, depth + 1)
      : { id: str(node.Id), code: str(node.Code), title: str(node.NameFa) || str(node.Code), level: num(node.Level) ?? 1 };
    phaseOf.set(id, info);
    return info;
  };
  const phases = new Map<string, PhaseInfo>();
  for (const w of wbs) {
    const info = memo(str(w.Id));
    if (info.id) phases.set(info.id, info);
  }
  return { phaseOf, phases: [...phases.values()].sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id)) };
}

export type DrillSectionResult = {
  key: string;
  table: string;
  label: Bi;
  state: "ready" | "empty" | "restricted" | "unavailable" | "too_large";
  restricted: boolean;
  count: number | null;
  amount: number | null;
  amountField: string | null;
  statusCounts: Record<string, number> | null;
  phased: boolean;
};

export type DrillItem = { id: string; code: string; title: string; status: string | null; date: string | null; amount: number | null; phaseId: string | null; phaseCode: string | null };

export function sectionRollup(spec: DrillSectionSpec, rows: DrillRow[]): DrillSectionResult {
  const statuses: Record<string, number> = {};
  if (spec.statusField) {
    for (const row of rows) {
      const key = str(row[spec.statusField]) || "—";
      statuses[key] = (statuses[key] ?? 0) + 1;
    }
  }
  let amount: number | null = null;
  if (spec.amountField) {
    let sum = 0;
    let seen = 0;
    for (const row of rows) {
      const n = num(row[spec.amountField]);
      if (n === null) continue;
      sum += n;
      seen += 1;
    }
    amount = seen ? Math.round(sum * 100) / 100 : null;
  }
  return {
    key: spec.key,
    table: spec.table,
    label: spec.label,
    state: rows.length ? "ready" : "empty",
    restricted: false,
    count: rows.length,
    amount,
    amountField: spec.amountField ?? null,
    statusCounts: spec.statusField ? statuses : null,
    phased: Boolean(spec.wbsField),
  };
}

export function projectItems(spec: DrillSectionSpec, rows: DrillRow[], limit: number, phaseIndex?: { phaseOf: Map<string, PhaseInfo> }): DrillItem[] {
  const sorted = [...rows].sort((a, b) => {
    const field = spec.sortField ?? spec.codeField;
    const av = iso(a[field]) ?? str(a[field]);
    const bv = iso(b[field]) ?? str(b[field]);
    return String(bv).localeCompare(String(av)) || str(a.Id).localeCompare(str(b.Id));
  });
  return sorted.slice(0, limit).map((row) => {
    const wbsId = spec.wbsField ? str(row[spec.wbsField]) : "";
    const phase = wbsId && phaseIndex ? phaseIndex.phaseOf.get(wbsId) ?? null : null;
    return {
      id: str(row.Id),
      code: str(row[spec.codeField]),
      title: str(row[spec.titleField]).slice(0, 300),
      status: spec.statusField ? str(row[spec.statusField]) || null : null,
      date: spec.dateField ? iso(row[spec.dateField]) : null,
      amount: spec.amountField ? num(row[spec.amountField]) : null,
      phaseId: phase && phase.id ? phase.id : null,
      phaseCode: phase && phase.code ? phase.code : null,
    };
  });
}

export type DrillResult = {
  model: string;
  projectId: string;
  generatedAt: string;
  sections: DrillSectionResult[];
  phases: { id: string; code: string; title: string; counts: Record<string, number>; total: number }[];
  unphased: Record<string, number>;
};

/** درخت پروژه ← فاز ← بخش‌ها؛ فقط از بخش‌هایی که کاربر دیده است. */
export function buildDrill(input: {
  projectId: string;
  wbs: DrillWbsNode[];
  sections: { spec: DrillSectionSpec; rows: DrillRow[] }[];
  generatedAt: string;
}): DrillResult {
  const { phaseOf, phases } = buildPhaseIndex(input.wbs);
  const sectionResults: DrillSectionResult[] = [];
  const phaseCounts = new Map<string, Record<string, number>>();
  const unphased: Record<string, number> = {};
  for (const { spec, rows } of input.sections) {
    sectionResults.push(sectionRollup(spec, rows));
    if (!spec.wbsField) continue;
    for (const row of rows) {
      const wbsId = str(row[spec.wbsField]);
      const phase = wbsId ? phaseOf.get(wbsId) : undefined;
      if (phase && phase.id) {
        const bucket = phaseCounts.get(phase.id) ?? {};
        bucket[spec.key] = (bucket[spec.key] ?? 0) + 1;
        phaseCounts.set(phase.id, bucket);
      } else {
        unphased[spec.key] = (unphased[spec.key] ?? 0) + 1;
      }
    }
  }
  return {
    model: DRILL_MODEL,
    projectId: input.projectId,
    generatedAt: input.generatedAt,
    sections: sectionResults,
    phases: phases
      .map((p) => {
        const counts = phaseCounts.get(p.id) ?? {};
        return { id: p.id, code: p.code, title: p.title, counts, total: Object.values(counts).reduce((s, n) => s + n, 0) };
      })
      .filter((p) => p.total > 0)
      .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code)),
    unphased,
  };
}

/** سطح سبد: شمارش هر پروژه برای هر بخش — همان بخش‌ها، بدون فاز. */
export type PortfolioDrillRow = { projectId: string; sections: { key: string; count: number | null; state: DrillSectionResult["state"] }[]; total: number | null };

export function buildPortfolioDrill(input: {
  projects: string[];
  perProject: Record<string, { spec: DrillSectionSpec; rows: DrillRow[]; state: DrillSectionResult["state"] }[]>;
}): { model: string; projects: PortfolioDrillRow[] } {
  return {
    model: DRILL_MODEL,
    projects: input.projects.map((projectId) => {
      const buckets = input.perProject[projectId] ?? [];
      const sections = buckets.map((b) => ({ key: b.spec.key, count: b.state === "ready" || b.state === "empty" ? b.rows.length : null, state: b.rows.length ? ("ready" as const) : b.state }));
      const total = sections.every((s) => s.count === null) ? null : sections.reduce((sum, s) => sum + (s.count ?? 0), 0);
      return { projectId, sections, total };
    }),
  };
}
