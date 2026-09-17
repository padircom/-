/**
 * موتور com-v1 — ماژول MOD-13 راه‌اندازی، تحویل و اختتام نهایی.
 *
 * بخش ۱ (D3): تفکیک سیستمی، مرزبندی و برنامه‌ریزی دروازه‌ها.
 *
 * قاعدهٔ سخت این فایل: توابع خالص‌اند و به پایگاه داده دست نمی‌زنند.
 * لایهٔ REST داده را می‌خواند، به این توابع می‌دهد و نتیجه را می‌نویسد.
 */

/* ══════════════════════════ واژگان و ثابت‌ها ══════════════════════════ */

export const SYSTEM_TYPES = ["system", "subsystem", "package"] as const;
export type SystemType = (typeof SYSTEM_TYPES)[number];

export const SYSTEM_STATUSES = ["planned", "precomm", "comm", "handed_over", "closed"] as const;
export type SystemStatus = (typeof SYSTEM_STATUSES)[number];

export const GATE_TYPES = ["mc", "rfsu", "pac", "fac"] as const;
export type GateType = (typeof GATE_TYPES)[number];

export const BOUNDARY_KINDS = ["wbs", "activity", "pid", "equipment", "tag"] as const;
export type BoundaryKind = (typeof BOUNDARY_KINDS)[number];

export const CRITICALITIES = ["high", "medium", "low"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

export const SYSTEM_TYPE_FA: Record<SystemType, string> = {
  system: "سیستم",
  subsystem: "زیرسیستم",
  package: "بسته",
};

export const SYSTEM_STATUS_FA: Record<SystemStatus, string> = {
  planned: "برنامه‌ریزی‌شده",
  precomm: "پیش‌راه‌اندازی",
  comm: "راه‌اندازی",
  handed_over: "تحویل‌شده",
  closed: "بسته",
};

export const GATE_TYPE_FA: Record<GateType, string> = {
  mc: "تکمیل مکانیکی",
  rfsu: "آمادگی راه‌اندازی",
  pac: "تحویل موقت",
  fac: "تحویل قطعی",
};

export const BOUNDARY_KIND_FA: Record<BoundaryKind, string> = {
  wbs: "بستهٔ کاری",
  activity: "فعالیت",
  pid: "نقشهٔ فرآیندی",
  equipment: "تجهیز",
  tag: "برچسب",
};

export const CRITICALITY_FA: Record<Criticality, string> = {
  high: "بحرانی",
  medium: "متوسط",
  low: "کم",
};

/**
 * ترتیب زنجیرهٔ دروازه‌ها. جایگاه در این آرایه معنا دارد: هر دروازه فقط
 * پس از دروازهٔ پیشین خود صادر می‌شود.
 */
export const GATE_ORDER: GateType[] = ["mc", "rfsu", "pac", "fac"];

export function previousGate(gate: GateType): GateType | null {
  const i = GATE_ORDER.indexOf(gate);
  return i <= 0 ? null : GATE_ORDER[i - 1];
}

/* ══════════════════════════ نوع‌های ورودی ══════════════════════════ */

export type SystemNode = {
  Id: string;
  ProjectId: string;
  ParentId?: string | null;
  SystemCode: string;
  TitleFa: string;
  SystemType: string;
  DisciplineCode?: string | null;
  CommissioningPriority?: number | null;
  CriticalityFa?: string | null;
  SortOrder?: number | null;
  Status: string;
};

export type BoundaryRow = {
  Id: string;
  SystemId: string;
  TargetKind: string;
  TargetRef: string;
  IsPrimary?: boolean | number | null;
  BoundaryNoteFa?: string | null;
};

export type MilestoneRow = {
  Id: string;
  SystemId: string;
  GateType: string;
  TargetDate: string;
  ForecastDate?: string | null;
  ActualDate?: string | null;
};

export type ComError = { code: string; message: string };

/* ══════════════════════════ ۱. اعتبارسنجی سیستم ══════════════════════════ */

const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9\-_.]{0,39}$/;

/**
 * کد سیستم در گزارش‌های رسمی و نام فایل پرونده تحویل ظاهر می‌شود، پس
 * کاراکتر آزاد در آن مجاز نیست.
 */
export function validateSystemCode(code: string): ComError | null {
  const v = (code ?? "").trim();
  if (!v) return { code: "E-COM-CODE-REQUIRED", message: "کد سیستم الزامی است" };
  if (!CODE_RE.test(v))
    return {
      code: "E-COM-CODE-INVALID",
      message: "کد سیستم فقط حرف لاتین، رقم، خط تیره، زیرخط و نقطه می‌پذیرد و باید با حرف یا رقم شروع شود",
    };
  return null;
}

export function validateSystemInput(input: {
  systemCode?: string;
  titleFa?: string;
  systemType?: string;
  status?: string;
  criticalityFa?: string | null;
  commissioningPriority?: number | null;
}): ComError[] {
  const errors: ComError[] = [];
  const codeErr = validateSystemCode(input.systemCode ?? "");
  if (codeErr) errors.push(codeErr);
  if (!(input.titleFa ?? "").trim())
    errors.push({ code: "E-COM-TITLE-REQUIRED", message: "عنوان فارسی سیستم الزامی است" });
  if (!SYSTEM_TYPES.includes(input.systemType as SystemType))
    errors.push({ code: "E-COM-TYPE-INVALID", message: `نوع سیستم باید یکی از ${SYSTEM_TYPES.join("، ")} باشد` });
  if (input.status !== undefined && !SYSTEM_STATUSES.includes(input.status as SystemStatus))
    errors.push({ code: "E-COM-STATUS-INVALID", message: `وضعیت سیستم باید یکی از ${SYSTEM_STATUSES.join("، ")} باشد` });
  if (input.criticalityFa != null && input.criticalityFa !== "" && !CRITICALITIES.includes(input.criticalityFa as Criticality))
    errors.push({ code: "E-COM-CRITICALITY-INVALID", message: "بحرانیت باید high یا medium یا low باشد" });
  const p = input.commissioningPriority;
  if (p != null && (!Number.isFinite(p) || p < 1 || Math.floor(p) !== p))
    errors.push({ code: "E-COM-PRIORITY-INVALID", message: "اولویت راه‌اندازی باید عدد صحیح مثبت باشد" });
  return errors;
}

/* ══════════════════════════ ۲. درخت سیستم‌ها ══════════════════════════ */

/**
 * جلوگیری از حلقه در درخت.
 *
 * ⚠️ این بررسی در موتور انجام می‌شود نه در پایگاه داده، چون SQL Server 2008
 * محدودیت CHECK بازگشتی ندارد. بدون این تابع یک ویرایش ساده می‌تواند
 * درخت را به گراف حلقه‌دار تبدیل کند و هر پیمایشی را تا بی‌نهایت ببرد.
 */
export function detectCycle(nodes: SystemNode[], childId: string, newParentId?: string | null): ComError | null {
  if (!newParentId) return null;
  if (newParentId === childId)
    return { code: "E-COM-SELF-PARENT", message: "یک سیستم نمی‌تواند والد خودش باشد" };

  const byId = new Map(nodes.map((n) => [n.Id, n]));
  const seen = new Set<string>([childId]);
  let cursor: string | null | undefined = newParentId;
  while (cursor) {
    if (seen.has(cursor))
      return { code: "E-COM-CYCLE", message: "این انتساب در درخت سیستم‌ها حلقه می‌سازد" };
    seen.add(cursor);
    cursor = byId.get(cursor)?.ParentId ?? null;
  }
  return null;
}

export type TreeNode = SystemNode & {
  depth: number;
  path: string[];
  children: TreeNode[];
  descendantCount: number;
};

/**
 * ساخت درخت از فهرست تخت. گره‌ای که والدش در فهرست نیست، به‌عنوان ریشه
 * برگردانده می‌شود تا هرگز از نمایش حذف نشود — دادهٔ یتیم باید دیده شود
 * نه اینکه بی‌صدا ناپدید شود.
 */
export function buildSystemTree(nodes: SystemNode[]): { roots: TreeNode[]; orphans: string[] } {
  const byId = new Map<string, TreeNode>();
  for (const n of nodes) byId.set(n.Id, { ...n, depth: 0, path: [], children: [], descendantCount: 0 });

  const roots: TreeNode[] = [];
  const orphans: string[] = [];

  for (const node of byId.values()) {
    const pid = node.ParentId;
    if (!pid) {
      roots.push(node);
      continue;
    }
    const parent = byId.get(pid);
    if (!parent) {
      orphans.push(node.Id);
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }

  const sortFn = (a: TreeNode, b: TreeNode) =>
    (a.SortOrder ?? 0) - (b.SortOrder ?? 0) || a.SystemCode.localeCompare(b.SystemCode);

  const walk = (node: TreeNode, depth: number, path: string[]): number => {
    node.depth = depth;
    node.path = [...path, node.SystemCode];
    node.children.sort(sortFn);
    let count = 0;
    for (const child of node.children) count += 1 + walk(child, depth + 1, node.path);
    node.descendantCount = count;
    return count;
  };

  roots.sort(sortFn);
  for (const r of roots) walk(r, 0, []);
  return { roots, orphans };
}

export function flattenTree(roots: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (n: TreeNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

/** زیردرخت یک گره شامل خودش — مبنای محاسبهٔ پیشرفت تجمیعی. */
export function subtreeIds(nodes: SystemNode[], rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.ParentId) continue;
    const arr = children.get(n.ParentId) ?? [];
    arr.push(n.Id);
    children.set(n.ParentId, arr);
  }
  const out: string[] = [];
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const c of children.get(id) ?? []) stack.push(c);
  }
  return out;
}

/* ══════════════════════════ ۳. مرزبندی سیستم ══════════════════════════ */

export function validateBoundary(input: { targetKind?: string; targetRef?: string }): ComError[] {
  const errors: ComError[] = [];
  if (!BOUNDARY_KINDS.includes(input.targetKind as BoundaryKind))
    errors.push({ code: "E-COM-BOUNDARY-KIND", message: `نوع مرز باید یکی از ${BOUNDARY_KINDS.join("، ")} باشد` });
  if (!(input.targetRef ?? "").trim())
    errors.push({ code: "E-COM-BOUNDARY-REF", message: "ارجاع مرز الزامی است" });
  return errors;
}

/**
 * یک سیستم باید دقیقاً یک نگاشت اصلی داشته باشد، وگرنه محاسبهٔ پیشرفت
 * فیزیکی مبنای روشنی ندارد.
 */
export function assertSinglePrimary(rows: BoundaryRow[], systemId: string): ComError | null {
  const primaries = rows.filter((r) => r.SystemId === systemId && truthy(r.IsPrimary));
  if (primaries.length > 1)
    return { code: "E-COM-MULTI-PRIMARY", message: "هر سیستم فقط یک نگاشت اصلی می‌پذیرد" };
  return null;
}

function truthy(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

export type BoundaryCoverage = {
  systemId: string;
  total: number;
  byKind: Record<string, number>;
  hasPrimary: boolean;
  gapsFa: string[];
};

/**
 * سیستمی که مرز ندارد در راه‌اندازی قابل کنترل نیست — نه می‌شود پیشرفتش را
 * سنجید نه دامنه‌اش را به بازرس نشان داد.
 */
export function boundaryCoverage(rows: BoundaryRow[], systemId: string): BoundaryCoverage {
  const mine = rows.filter((r) => r.SystemId === systemId);
  const byKind: Record<string, number> = {};
  for (const r of mine) byKind[r.TargetKind] = (byKind[r.TargetKind] ?? 0) + 1;
  const hasPrimary = mine.some((r) => truthy(r.IsPrimary));
  const gapsFa: string[] = [];
  if (mine.length === 0) gapsFa.push("هیچ مرزی تعریف نشده است");
  else if (!hasPrimary) gapsFa.push("نگاشت اصلی تعیین نشده است");
  if (mine.length > 0 && !byKind.wbs && !byKind.activity)
    gapsFa.push("به هیچ بستهٔ کاری یا فعالیتی نگاشت نشده است");
  return { systemId, total: mine.length, byKind, hasPrimary, gapsFa };
}

/* ══════════════════════════ ۴. اولویت‌بندی راه‌اندازی ══════════════════════════ */

export type PriorityCell = {
  systemId: string;
  systemCode: string;
  titleFa: string;
  priority: number;
  criticality: Criticality;
  readinessPct: number;
  band: "now" | "next" | "later" | "hold";
  bandFa: string;
  rank: number;
};

const BAND_FA: Record<PriorityCell["band"], string> = {
  now: "اکنون",
  next: "بعدی",
  later: "بعداً",
  hold: "معلق",
};

/**
 * ماتریس اولویت دوبعدی: بحرانیت × آمادگی.
 *
 * تک‌بعدی بودن اولویت مشکل واقعی دارد — سیستم بسیار بحرانی که هنوز ساختش
 * تمام نشده نباید بالای صف راه‌اندازی بنشیند و منابع را قفل کند.
 */
export function priorityMatrix(
  systems: SystemNode[],
  readiness: Record<string, number> = {},
): PriorityCell[] {
  const cells = systems.map((s) => {
    const criticality = (CRITICALITIES.includes(s.CriticalityFa as Criticality)
      ? s.CriticalityFa
      : "medium") as Criticality;
    const readinessPct = clampPct(readiness[s.Id] ?? 0);
    const priority = s.CommissioningPriority ?? 999;
    let band: PriorityCell["band"];
    if (readinessPct >= 90) band = criticality === "low" ? "next" : "now";
    else if (readinessPct >= 50) band = criticality === "high" ? "next" : "later";
    else band = criticality === "high" ? "later" : "hold";
    return {
      systemId: s.Id,
      systemCode: s.SystemCode,
      titleFa: s.TitleFa,
      priority,
      criticality,
      readinessPct,
      band,
      bandFa: BAND_FA[band],
      rank: 0,
    };
  });

  const bandWeight: Record<PriorityCell["band"], number> = { now: 0, next: 1, later: 2, hold: 3 };
  const critWeight: Record<Criticality, number> = { high: 0, medium: 1, low: 2 };
  cells.sort(
    (a, b) =>
      bandWeight[a.band] - bandWeight[b.band] ||
      a.priority - b.priority ||
      critWeight[a.criticality] - critWeight[b.criticality] ||
      b.readinessPct - a.readinessPct ||
      a.systemCode.localeCompare(b.systemCode),
  );
  cells.forEach((c, i) => (c.rank = i + 1));
  return cells;
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

/* ══════════════════════════ ۵. تاریخ‌های هدف دروازه ══════════════════════════ */

export function validateMilestone(input: { gateType?: string; targetDate?: string }): ComError[] {
  const errors: ComError[] = [];
  if (!GATE_TYPES.includes(input.gateType as GateType))
    errors.push({ code: "E-COM-GATE-INVALID", message: `نوع دروازه باید یکی از ${GATE_TYPES.join("، ")} باشد` });
  if (!isIsoDate(input.targetDate ?? ""))
    errors.push({ code: "E-COM-TARGET-DATE", message: "تاریخ هدف باید به شکل YYYY-MM-DD باشد" });
  return errors;
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * لغزش دروازه.
 *
 * اولویت با تاریخ واقعی است؛ اگر صادر نشده باشد پیش‌بینی مبناست. سیستمی که
 * نه واقعی دارد نه پیش‌بینی، لغزش صفر نمی‌گیرد بلکه نامعلوم است — صفر
 * نشان‌دادنش گزارش را دروغین خوش‌بین می‌کند.
 */
export function gateSlip(row: MilestoneRow): { slipDays: number | null; basis: "actual" | "forecast" | "unknown" } {
  if (row.ActualDate) return { slipDays: daysBetween(row.TargetDate, row.ActualDate), basis: "actual" };
  if (row.ForecastDate) return { slipDays: daysBetween(row.TargetDate, row.ForecastDate), basis: "forecast" };
  return { slipDays: null, basis: "unknown" };
}

/**
 * ترتیب زمانی دروازه‌ها باید صعودی باشد: تحویل موقت نمی‌تواند پیش از
 * تکمیل مکانیکی برنامه‌ریزی شود.
 */
export function validateGateSequence(rows: MilestoneRow[]): ComError[] {
  const errors: ComError[] = [];
  const byGate = new Map<string, MilestoneRow>();
  for (const r of rows) byGate.set(r.GateType, r);
  for (let i = 1; i < GATE_ORDER.length; i++) {
    const cur = byGate.get(GATE_ORDER[i]);
    const prev = byGate.get(GATE_ORDER[i - 1]);
    if (!cur || !prev) continue;
    if (daysBetween(prev.TargetDate, cur.TargetDate) < 0)
      errors.push({
        code: "E-COM-GATE-SEQUENCE",
        message: `تاریخ هدف ${GATE_TYPE_FA[GATE_ORDER[i]]} نمی‌تواند پیش از ${GATE_TYPE_FA[GATE_ORDER[i - 1]]} باشد`,
      });
  }
  return errors;
}

export type CompletionPlanRow = {
  systemId: string;
  systemCode: string;
  titleFa: string;
  gates: Record<GateType, { target: string | null; forecast: string | null; actual: string | null; slipDays: number | null; basis: string }>;
  worstSlipDays: number | null;
  status: string;
  statusFa: string;
};

export function completionPlan(systems: SystemNode[], milestones: MilestoneRow[]): CompletionPlanRow[] {
  const bySystem = new Map<string, MilestoneRow[]>();
  for (const m of milestones) {
    const arr = bySystem.get(m.SystemId) ?? [];
    arr.push(m);
    bySystem.set(m.SystemId, arr);
  }

  return systems.map((s) => {
    const rows = bySystem.get(s.Id) ?? [];
    const gates = {} as CompletionPlanRow["gates"];
    let worst: number | null = null;
    for (const g of GATE_ORDER) {
      const row = rows.find((r) => r.GateType === g);
      if (!row) {
        gates[g] = { target: null, forecast: null, actual: null, slipDays: null, basis: "unset" };
        continue;
      }
      const { slipDays, basis } = gateSlip(row);
      gates[g] = {
        target: row.TargetDate,
        forecast: row.ForecastDate ?? null,
        actual: row.ActualDate ?? null,
        slipDays,
        basis,
      };
      if (slipDays != null && (worst == null || slipDays > worst)) worst = slipDays;
    }
    const status = SYSTEM_STATUSES.includes(s.Status as SystemStatus) ? s.Status : "planned";
    return {
      systemId: s.Id,
      systemCode: s.SystemCode,
      titleFa: s.TitleFa,
      gates,
      worstSlipDays: worst,
      status,
      statusFa: SYSTEM_STATUS_FA[status as SystemStatus],
    };
  });
}

/* ══════════════════════════ ۶. خلاصهٔ تفکیک سیستمی ══════════════════════════ */

export type SystemizationSummary = {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byCriticality: Record<string, number>;
  rootCount: number;
  maxDepth: number;
  orphanCount: number;
  withoutBoundary: number;
  withoutMilestone: number;
  readinessPct: number;
};

/**
 * درصد آمادگیِ خودِ تفکیک سیستمی — نه پیشرفت راه‌اندازی.
 *
 * سیستمی «آماده» است که هم مرز داشته باشد هم تاریخ هدف. این عدد به تیم
 * می‌گوید چقدر از کار برنامه‌ریزی تحویل انجام شده.
 */
export function systemizationSummary(
  systems: SystemNode[],
  boundaries: BoundaryRow[],
  milestones: MilestoneRow[],
): SystemizationSummary {
  const { roots, orphans } = buildSystemTree(systems);
  const flat = flattenTree(roots);
  const boundedIds = new Set(boundaries.map((b) => b.SystemId));
  const milestonedIds = new Set(milestones.map((m) => m.SystemId));

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byCriticality: Record<string, number> = {};
  for (const s of systems) {
    byType[s.SystemType] = (byType[s.SystemType] ?? 0) + 1;
    byStatus[s.Status] = (byStatus[s.Status] ?? 0) + 1;
    const crit = s.CriticalityFa ?? "unset";
    byCriticality[crit] = (byCriticality[crit] ?? 0) + 1;
  }

  const withoutBoundary = systems.filter((s) => !boundedIds.has(s.Id)).length;
  const withoutMilestone = systems.filter((s) => !milestonedIds.has(s.Id)).length;
  const ready = systems.filter((s) => boundedIds.has(s.Id) && milestonedIds.has(s.Id)).length;

  return {
    total: systems.length,
    byType,
    byStatus,
    byCriticality,
    rootCount: roots.length,
    maxDepth: flat.reduce((m, n) => Math.max(m, n.depth), 0),
    orphanCount: orphans.length,
    withoutBoundary,
    withoutMilestone,
    readinessPct: systems.length ? round2((ready / systems.length) * 100) : 0,
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/* ══════════════════════════ ۷. خروجی ماتریس سیستمی ══════════════════════════ */

export type MatrixRow = {
  ردیف: number;
  کد: string;
  عنوان: string;
  نوع: string;
  سطح: number;
  والد: string;
  دیسیپلین: string;
  اولویت: string;
  بحرانیت: string;
  وضعیت: string;
  مرزها: number;
  "هدف تکمیل مکانیکی": string;
  "هدف آمادگی راه‌اندازی": string;
  "هدف تحویل موقت": string;
  "هدف تحویل قطعی": string;
  "بدترین لغزش": string;
};

/**
 * ماتریس سیستمی برای خروجی اکسل و گزارش A4.
 *
 * ستون‌ها فارسی‌اند چون مستقیم به فایل تحویل کارفرما می‌روند؛ ترجمه در
 * لایهٔ خروجی باعث ناسازگاری بین گزارش و صفحه می‌شد.
 */
export function systemizationMatrix(
  systems: SystemNode[],
  boundaries: BoundaryRow[],
  milestones: MilestoneRow[],
): MatrixRow[] {
  const { roots } = buildSystemTree(systems);
  const flat = flattenTree(roots);
  const byId = new Map(systems.map((s) => [s.Id, s]));
  const plan = new Map(completionPlan(systems, milestones).map((p) => [p.systemId, p]));
  const boundaryCount = new Map<string, number>();
  for (const b of boundaries) boundaryCount.set(b.SystemId, (boundaryCount.get(b.SystemId) ?? 0) + 1);

  return flat.map((n, i) => {
    const p = plan.get(n.Id);
    const g = (k: GateType) => p?.gates[k]?.target ?? "—";
    const worst = p?.worstSlipDays;
    return {
      ردیف: i + 1,
      کد: n.SystemCode,
      عنوان: n.TitleFa,
      نوع: SYSTEM_TYPE_FA[n.SystemType as SystemType] ?? n.SystemType,
      سطح: n.depth + 1,
      والد: n.ParentId ? (byId.get(n.ParentId)?.SystemCode ?? "—") : "—",
      دیسیپلین: n.DisciplineCode ?? "—",
      اولویت: n.CommissioningPriority != null ? String(n.CommissioningPriority) : "—",
      بحرانیت: n.CriticalityFa ? (CRITICALITY_FA[n.CriticalityFa as Criticality] ?? n.CriticalityFa) : "—",
      وضعیت: SYSTEM_STATUS_FA[n.Status as SystemStatus] ?? n.Status,
      مرزها: boundaryCount.get(n.Id) ?? 0,
      "هدف تکمیل مکانیکی": g("mc"),
      "هدف آمادگی راه‌اندازی": g("rfsu"),
      "هدف تحویل موقت": g("pac"),
      "هدف تحویل قطعی": g("fac"),
      "بدترین لغزش": worst == null ? "—" : `${worst} روز`,
    };
  });
}

/* ══════════════════════════ بخش ۲ (D4) — بستهٔ آزمون و برگه‌ها ══════════════════════════ */

export const PACK_TYPES = ["a", "b"] as const;
export type PackType = (typeof PACK_TYPES)[number];

export const PACK_STATUSES = ["draft", "in_progress", "cleared", "rejected"] as const;
export type PackStatus = (typeof PACK_STATUSES)[number];

export const SHEET_STATUSES = ["draft", "signed", "void"] as const;
export type SheetStatus = (typeof SHEET_STATUSES)[number];

export const SHEET_RESULTS = ["pass", "fail", "conditional"] as const;
export type SheetResult = (typeof SHEET_RESULTS)[number];

/**
 * انواع آزمون به تفکیک سرد و گرم.
 *
 * این نگاشت سخت‌گیرانه است چون آزمون گرم پیش از تکمیل مکانیکی یعنی
 * راه‌اندازی تجهیز بدون تأیید ساخت — خطر جانی دارد نه فقط اداری.
 */
export const TEST_KINDS_BY_TYPE: Record<PackType, string[]> = {
  a: ["hydrotest", "flushing", "blowing", "megger", "loop_check", "calibration", "alignment"],
  b: ["no_load", "load_test", "vibration", "performance", "interlock_test"],
};

export const ALL_TEST_KINDS = [...TEST_KINDS_BY_TYPE.a, ...TEST_KINDS_BY_TYPE.b];

export const TEST_KIND_FA: Record<string, string> = {
  hydrotest: "آزمون هیدرواستاتیک",
  flushing: "شست‌وشو",
  blowing: "دمش هوا",
  megger: "مقاومت عایقی",
  loop_check: "کنترل حلقهٔ ابزار دقیق",
  calibration: "کالیبراسیون",
  alignment: "هم‌محوری",
  no_load: "آزمون بی‌باری",
  load_test: "آزمون زیر بار",
  vibration: "آزمون لرزش",
  performance: "آزمون عملکرد",
  interlock_test: "آزمون اینترلاک",
};

export const PACK_TYPE_FA: Record<PackType, string> = {
  a: "آزمون سرد",
  b: "آزمون گرم",
};

export const PACK_STATUS_FA: Record<PackStatus, string> = {
  draft: "پیش‌نویس",
  in_progress: "در حال اجرا",
  cleared: "تأییدشده",
  rejected: "مردود",
};

export const SHEET_RESULT_FA: Record<SheetResult, string> = {
  pass: "قبول",
  fail: "مردود",
  conditional: "مشروط",
};

export type SheetLine = {
  Id?: string;
  SheetId?: string;
  LineNo: number;
  ParameterFa: string;
  ExpectedValue?: string | null;
  ActualValue?: string | null;
  UnitFa?: string | null;
  IsMandatory?: boolean | null;
  Passed?: boolean | null;
};

export type SheetRow = {
  Id: string;
  PackId: string;
  SheetNo: string;
  SheetType: string;
  TestKind: string;
  TitleFa: string;
  ResultFa?: string | null;
  WitnessedBy?: string | null;
  NcrRef?: string | null;
  Status: string;
};

export type PackRow = {
  Id: string;
  ProjectId: string;
  SystemId: string;
  PackNo: string;
  PackType: string;
  Status: string;
};

/* ── اعتبارسنجی ── */

export function validatePackInput(input: { packNo?: string; titleFa?: string; packType?: string; status?: string }): ComError[] {
  const errors: ComError[] = [];
  if (!(input.packNo ?? "").trim())
    errors.push({ code: "E-COM-PACK-NO-REQUIRED", message: "شمارهٔ بستهٔ آزمون الزامی است" });
  if (!(input.titleFa ?? "").trim())
    errors.push({ code: "E-COM-TITLE-REQUIRED", message: "عنوان فارسی بستهٔ آزمون الزامی است" });
  if (!PACK_TYPES.includes(input.packType as PackType))
    errors.push({ code: "E-COM-PACK-TYPE", message: "نوع بسته باید a (سرد) یا b (گرم) باشد" });
  if (input.status !== undefined && !PACK_STATUSES.includes(input.status as PackStatus))
    errors.push({ code: "E-COM-PACK-STATUS", message: `وضعیت بسته باید یکی از ${PACK_STATUSES.join("، ")} باشد` });
  return errors;
}

/**
 * برگه باید با نوع بستهٔ خود بخواند.
 *
 * آزمون هیدرواستاتیک در بستهٔ گرم یا آزمون زیر بار در بستهٔ سرد نشانهٔ
 * خطای ثبت است، نه سلیقه — و اگر رد نشود، گزارش پیشرفت پیش‌راه‌اندازی
 * عددی می‌دهد که پشتش کار انجام‌نشده است.
 */
export function validateSheetInput(input: {
  sheetNo?: string;
  titleFa?: string;
  testKind?: string;
  packType?: string;
  resultFa?: string | null;
  status?: string;
}): ComError[] {
  const errors: ComError[] = [];
  if (!(input.sheetNo ?? "").trim())
    errors.push({ code: "E-COM-SHEET-NO-REQUIRED", message: "شمارهٔ برگه الزامی است" });
  if (!(input.titleFa ?? "").trim())
    errors.push({ code: "E-COM-TITLE-REQUIRED", message: "عنوان فارسی برگه الزامی است" });

  const kind = input.testKind ?? "";
  if (!ALL_TEST_KINDS.includes(kind)) {
    errors.push({ code: "E-COM-TEST-KIND", message: `نوع آزمون ${kind || "خالی"} شناخته نشده است` });
  } else if (input.packType && PACK_TYPES.includes(input.packType as PackType)) {
    const allowed = TEST_KINDS_BY_TYPE[input.packType as PackType];
    if (!allowed.includes(kind))
      errors.push({
        code: "E-COM-KIND-PACK-MISMATCH",
        message: `${TEST_KIND_FA[kind] ?? kind} با بستهٔ ${PACK_TYPE_FA[input.packType as PackType]} سازگار نیست`,
      });
  }

  if (input.resultFa != null && input.resultFa !== "" && !SHEET_RESULTS.includes(input.resultFa as SheetResult))
    errors.push({ code: "E-COM-SHEET-RESULT", message: `نتیجهٔ برگه باید یکی از ${SHEET_RESULTS.join("، ")} باشد` });
  if (input.status !== undefined && !SHEET_STATUSES.includes(input.status as SheetStatus))
    errors.push({ code: "E-COM-SHEET-STATUS", message: `وضعیت برگه باید یکی از ${SHEET_STATUSES.join("، ")} باشد` });
  return errors;
}

export function validateSheetLines(lines: SheetLine[]): ComError[] {
  const errors: ComError[] = [];
  if (!Array.isArray(lines) || lines.length === 0) {
    errors.push({ code: "E-COM-NO-LINES", message: "برگهٔ آزمون بدون ردیف پارامتر معنا ندارد" });
    return errors;
  }
  const seen = new Set<number>();
  for (const [i, l] of lines.entries()) {
    const n = Number(l.LineNo);
    if (!Number.isInteger(n) || n < 1)
      errors.push({ code: "E-COM-LINE-NO", message: `ردیف ${i + 1}: شمارهٔ ردیف باید عدد صحیح مثبت باشد` });
    else if (seen.has(n)) errors.push({ code: "E-COM-DUP-LINE", message: `شمارهٔ ردیف ${n} تکراری است` });
    else seen.add(n);
    if (!(l.ParameterFa ?? "").trim())
      errors.push({ code: "E-COM-LINE-PARAM", message: `ردیف ${n || i + 1}: نام پارامتر الزامی است` });
  }
  return errors;
}

/* ── نتیجهٔ برگه ── */

export type SheetVerdict = {
  total: number;
  mandatory: number;
  passed: number;
  failed: number;
  pending: number;
  resultFa: SheetResult | "pending";
  resultLabelFa: string;
  blockersFa: string[];
};

/**
 * نتیجهٔ برگه از ردیف‌ها مشتق می‌شود، نه از انتخاب دستی کاربر.
 *
 * برگه قبول است اگر همهٔ ردیف‌های الزامی قبول شده باشند. اگر ردیف الزامی
 * سنجیده‌نشده بماند نتیجه «در انتظار» است نه قبول — سکوت را نباید قبولی
 * تفسیر کرد.
 */
export function sheetVerdict(lines: SheetLine[]): SheetVerdict {
  const mandatoryLines = lines.filter((l) => l.IsMandatory !== false);
  const passed = mandatoryLines.filter((l) => l.Passed === true).length;
  const failed = mandatoryLines.filter((l) => l.Passed === false).length;
  const pending = mandatoryLines.filter((l) => l.Passed == null).length;

  let resultFa: SheetResult | "pending";
  const blockersFa: string[] = [];
  if (mandatoryLines.length === 0) {
    resultFa = "pending";
    blockersFa.push("هیچ ردیف الزامی تعریف نشده است");
  } else if (failed > 0) {
    resultFa = "fail";
    blockersFa.push(`${failed} پارامتر الزامی مردود است`);
  } else if (pending > 0) {
    resultFa = "pending";
    blockersFa.push(`${pending} پارامتر الزامی هنوز سنجیده نشده است`);
  } else {
    resultFa = "pass";
  }

  return {
    total: lines.length,
    mandatory: mandatoryLines.length,
    passed,
    failed,
    pending,
    resultFa,
    resultLabelFa: resultFa === "pending" ? "در انتظار" : SHEET_RESULT_FA[resultFa],
    blockersFa,
  };
}

/**
 * امضای برگه فقط وقتی مجاز است که نتیجه قطعی باشد.
 *
 * برگهٔ مردود هم امضا می‌شود — امضا یعنی «نتیجه ثبت و تأیید شد»، نه
 * «آزمون قبول شد». ولی برگه‌ای که هنوز پارامتر سنجیده‌نشده دارد قابل
 * امضا نیست.
 */
export function canSignSheet(lines: SheetLine[], witnessedBy?: string | null): ComError | null {
  const v = sheetVerdict(lines);
  if (v.resultFa === "pending")
    return { code: "E-COM-SHEET-PENDING", message: v.blockersFa[0] ?? "برگه هنوز کامل نشده است" };
  if (!(witnessedBy ?? "").trim())
    return { code: "E-COM-NO-WITNESS", message: "امضای برگهٔ آزمون بدون ثبت شاهد مجاز نیست" };
  return null;
}

/* ── وضعیت بسته ── */

export type PackProgress = {
  packId: string;
  total: number;
  signed: number;
  passed: number;
  failed: number;
  draft: number;
  voided: number;
  clearedPct: number;
  canClear: boolean;
  blockersFa: string[];
};

/**
 * پیشرفت بسته بر مبنای برگه‌های امضاشده است، نه ثبت‌شده.
 *
 * برگهٔ باطل‌شده از مخرج حذف می‌شود؛ نگه‌داشتنش درصد را مصنوعی پایین
 * می‌آورد و تیم را به باطل‌نکردن برگهٔ اشتباه تشویق می‌کند.
 */
export function packProgress(packId: string, sheets: SheetRow[]): PackProgress {
  const mine = sheets.filter((s) => s.PackId === packId);
  const active = mine.filter((s) => s.Status !== "void");
  const signed = active.filter((s) => s.Status === "signed");
  const passed = signed.filter((s) => s.ResultFa === "pass" || s.ResultFa === "conditional").length;
  const failed = signed.filter((s) => s.ResultFa === "fail").length;
  const draft = active.filter((s) => s.Status === "draft").length;

  const blockersFa: string[] = [];
  if (active.length === 0) blockersFa.push("بسته هیچ برگهٔ فعالی ندارد");
  if (draft > 0) blockersFa.push(`${draft} برگه هنوز امضا نشده است`);
  if (failed > 0) blockersFa.push(`${failed} برگه مردود است`);

  return {
    packId,
    total: active.length,
    signed: signed.length,
    passed,
    failed,
    draft,
    voided: mine.length - active.length,
    clearedPct: active.length ? round2((signed.length / active.length) * 100) : 0,
    canClear: blockersFa.length === 0,
    blockersFa,
  };
}

/* ── دروازهٔ تأیید آزمون سرد ── */

export type ColdClearanceInput = {
  systemId: string;
  packs: PackRow[];
  sheets: SheetRow[];
  openNcrCount?: number;
  physicalPct?: number | null;
};

export type ColdClearance = {
  systemId: string;
  ok: boolean;
  packCount: number;
  clearedPacks: number;
  blockersFa: string[];
  warningsFa: string[];
};

/**
 * گواهی تأیید آزمون سرد — پیش‌نیاز تکمیل مکانیکی.
 *
 * ⚠️ همهٔ موانع یک‌جا برمی‌گردند نه فقط اولی (ADR-COM-03): تیم راه‌اندازی
 * باید یک‌بار بداند چه چیزی مانده، نه اینکه پنج بار تلاش کند و هر بار یک
 * مانع تازه کشف کند.
 *
 * تفکیک مانع از هشدار عمدی است: پیشرفت فیزیکی کمتر از صد درصد هشدار
 * است نه مانع، چون در عمل کارهای جزئی ساخت تا پس از آزمون سرد ادامه
 * دارند و قفل‌کردن مطلق پروژه را می‌خواباند.
 */
export function coldTestClearance(input: ColdClearanceInput): ColdClearance {
  const coldPacks = input.packs.filter((p) => p.SystemId === input.systemId && p.PackType === "a");
  const blockersFa: string[] = [];
  const warningsFa: string[] = [];

  if (coldPacks.length === 0) blockersFa.push("هیچ بستهٔ آزمون سردی برای این سیستم تعریف نشده است");

  let cleared = 0;
  for (const p of coldPacks) {
    if (p.Status === "cleared") {
      cleared++;
      continue;
    }
    const prog = packProgress(p.Id, input.sheets);
    blockersFa.push(`بستهٔ ${p.PackNo}: ${prog.blockersFa.join("؛ ") || "هنوز تأیید نشده است"}`);
  }

  const ncr = input.openNcrCount ?? 0;
  if (ncr > 0) blockersFa.push(`${ncr} عدم انطباق باز در دامنهٔ این سیستم وجود دارد`);

  const pct = input.physicalPct;
  if (pct != null && pct < 100) warningsFa.push(`پیشرفت فیزیکی ${round2(pct)}٪ است و هنوز کامل نشده`);

  return {
    systemId: input.systemId,
    ok: blockersFa.length === 0,
    packCount: coldPacks.length,
    clearedPacks: cleared,
    blockersFa,
    warningsFa,
  };
}

/* ── خلاصهٔ پیش‌راه‌اندازی ── */

export type PreCommSummary = {
  packs: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  sheets: number;
  signedSheets: number;
  failedSheets: number;
  progressPct: number;
  systemsWithoutPack: string[];
};

export function preCommSummary(systems: SystemNode[], packs: PackRow[], sheets: SheetRow[]): PreCommSummary {
  /* هر دو نوع بسته همیشه کلید دارند — کلید غایب مصرف‌کننده را می‌شکند و
   * «هنوز بستهٔ گرمی نداریم» با «این میدان وجود ندارد» یکی می‌شود. */
  const byType: Record<string, number> = { a: 0, b: 0 };
  const byStatus: Record<string, number> = {};
  for (const p of packs) {
    byType[p.PackType] = (byType[p.PackType] ?? 0) + 1;
    byStatus[p.Status] = (byStatus[p.Status] ?? 0) + 1;
  }
  const active = sheets.filter((s) => s.Status !== "void");
  const signed = active.filter((s) => s.Status === "signed");
  const withPack = new Set(packs.map((p) => p.SystemId));

  return {
    packs: packs.length,
    byType,
    byStatus,
    sheets: active.length,
    signedSheets: signed.length,
    failedSheets: signed.filter((s) => s.ResultFa === "fail").length,
    progressPct: active.length ? round2((signed.length / active.length) * 100) : 0,
    systemsWithoutPack: systems.filter((s) => !withPack.has(s.Id)).map((s) => s.SystemCode),
  };
}
