/**
 * ENG — موتور مدیریت مهندسی و طراحی (MDR، بررسی و CRS، IDC، TQ/FCR، VPR، پیشرفت)
 * منبع یگانه منطق. آینهٔ سرور با `npm run build:eng` ساخته می‌شود.
 *
 * اصل حاکم: موتور «خالص» است — بدون I/O، بدون Date.now مستقیم («اکنون» تزریق
 * می‌شود؛ درس EQP دربارهٔ وابستگی به ساعت دیوار) و تاریخ‌ها همگی ISO (YYYY-MM-DD).
 * نمایش شمسی بر عهدهٔ لایهٔ UI است.
 *
 * داده از جدول‌های d12 در sql-v1 می‌آید: MdrDeliverable, EngineeringRevision,
 * CrsComment, SquadCheck, InterfaceClashLog, TechnicalQuery, VendorPrintReview,
 * EngineeringProgressSnapshot. این فایل فقط محاسبه و اعتبارسنجی می‌کند.
 *
 * مبنای طراحی: docs/ENG_Architecture.md — ADR-ENG-01..10.
 */

export const ENG_VERSION = "eng-v1";

/** کد دامنه در یک نقطه متمرکز — تغییر آن تک‌خطی است. */
export const ENG_DOMAIN_ID = "d12";

/* ══════════════════════════ انواع پایه ══════════════════════════ */

export type Discipline =
  | "process" | "piping" | "civil" | "electrical"
  | "instrument" | "mechanical" | "hvac" | "safety";

export const DISCIPLINES: Discipline[] = [
  "process", "piping", "civil", "electrical", "instrument", "mechanical", "hvac", "safety",
];

export const DISCIPLINE_FA: Record<Discipline, string> = {
  process: "فرآیند",
  piping: "لوله‌کشی",
  civil: "عمران",
  electrical: "برق",
  instrument: "ابزار دقیق",
  mechanical: "مکانیک",
  hvac: "تهویه",
  safety: "ایمنی",
};

export type DocType =
  | "drawing" | "specification" | "calculation" | "datasheet"
  | "pid" | "model3d" | "report";

export const DOC_TYPE_FA: Record<DocType, string> = {
  drawing: "نقشه",
  specification: "مشخصات فنی",
  calculation: "محاسبات",
  datasheet: "دیتاشیت",
  pid: "P&ID",
  model3d: "مدل سه‌بعدی",
  report: "گزارش",
};

/** هدف صدور ریویژن. ترتیب اهمیت دارد: نمایانگر پیشروی چرخهٔ عمر است. */
export type RevisionPurpose = "IFR" | "IFA" | "IFC" | "IFT" | "AB";

export const PURPOSE_FA: Record<RevisionPurpose, string> = {
  IFR: "برای بازبینی",
  IFA: "برای تأیید",
  IFC: "برای ساخت",
  IFT: "برای مناقصه",
  AB: "چون‌ساخت",
};

/** کد بررسی کارفرما/مشاور. رشته است نه عدد چون در فرم‌های رسمی «Code 1» می‌آید. */
export type ReviewCode = "1" | "2" | "3" | "4";

export const REVIEW_CODE_FA: Record<ReviewCode, string> = {
  "1": "تأیید شده",
  "2": "تأیید با نظر",
  "3": "اصلاح و ارسال مجدد",
  "4": "صرفاً جهت اطلاع",
};

/** آیا این کد بررسی اجازهٔ پیشروی به IFC می‌دهد؟ */
export function isApprovingCode(code: string | null | undefined): boolean {
  return code === "1" || code === "2";
}

/** آیا این کد بررسی چرخهٔ دوباره‌کاری می‌سازد؟ */
export function isRejectingCode(code: string | null | undefined): boolean {
  return code === "3";
}

export type TqKind = "TQ" | "FCR" | "DCN";

export const TQ_KIND_FA: Record<TqKind, string> = {
  TQ: "استعلام فنی",
  FCR: "درخواست تغییر کارگاهی",
  DCN: "ابلاغیه تغییر طراحی",
};

/** مهلت پیش‌فرض بررسی کارفرما بر حسب روز — ADR-ENG-08. */
export const DEFAULT_CONTRACT_REVIEW_DAYS = 14;

/* ══════════════════════════ شکل رکوردها ══════════════════════════ */

export type MdrDeliverable = {
  Id: string;
  ProjectId: string;
  DocNo: string;
  TitleFa: string;
  TitleEn?: string | null;
  Discipline: string;
  DocType: string;
  PlannedWeight: number;
  EstimatedManhours?: number | null;
  WbsId?: string | null;
  DocumentId?: string | null;
  TargetIfaDate?: string | null;
  TargetIfcDate?: string | null;
  Status: string;
  CriticalityLevel?: string | null;
  ContractReviewDays?: number | null;
  RemarksFa?: string | null;
};

export type EngineeringRevision = {
  Id: string;
  ProjectId: string;
  DeliverableId: string;
  RevCode: string;
  Purpose: string;
  IssuedAt: string;
  IssuedBy?: string | null;
  TransmittalId?: string | null;
  ReviewDueAt?: string | null;
  ReviewCode?: string | null;
  ReviewedBy?: string | null;
  ReviewedAt?: string | null;
  ReviewAgingDays?: number | null;
  Status: string;
  IdcCompletedAt?: string | null;
  DocumentId?: string | null;
  RemarksFa?: string | null;
};

export type CrsComment = {
  Id: string;
  ProjectId: string;
  RevisionId: string;
  CommentNo: number;
  RaisedBy: string;
  RaisedAt: string;
  Discipline?: string | null;
  SheetRef?: string | null;
  Severity: string;
  CommentText: string;
  ResponseText?: string | null;
  RespondedBy?: string | null;
  RespondedAt?: string | null;
  ResponseStatus: string;
  VerifiedBy?: string | null;
  VerifiedAt?: string | null;
  ClosedInRevCode?: string | null;
};

export type SquadCheck = {
  Id: string;
  ProjectId: string;
  RevisionId: string;
  Discipline: string;
  ReviewerId: string;
  RequestedAt: string;
  DueAt?: string | null;
  CompletedAt?: string | null;
  Status: string;
  FindingsCount?: number | null;
  RemarksFa?: string | null;
};

export type InterfaceClashLog = {
  Id: string;
  ProjectId: string;
  ClashNo: string;
  DetectedAt: string;
  SourceTool: string;
  DisciplineA: string;
  DisciplineB: string;
  ElementA?: string | null;
  ElementB?: string | null;
  Zone?: string | null;
  Severity: string;
  Status: string;
  OwnerDiscipline?: string | null;
  ResolvedAt?: string | null;
  ResolutionFa?: string | null;
  ModelReviewStage?: string | null;
};

export type TechnicalQuery = {
  Id: string;
  ProjectId: string;
  Code: string;
  Kind: string;
  TitleFa: string;
  Discipline: string;
  RaisedBy: string;
  RaisedAt: string;
  DeliverableId?: string | null;
  DueAt?: string | null;
  Status: string;
  AnsweredBy?: string | null;
  AnsweredAt?: string | null;
  AnswerText?: string | null;
  CostImpact?: number | null;
  TimeImpactDays?: number | null;
  LinkedCrCode?: string | null;
  RedlineDocumentId?: string | null;
  AsBuiltStatus?: string | null;
  ParentTqId?: string | null;
};

export type VendorPrintReview = {
  Id: string;
  ProjectId: string;
  VendorDocNo: string;
  VendorName: string;
  TitleFa: string;
  PoNo?: string | null;
  TagNo?: string | null;
  Discipline: string;
  RevCode: string;
  ReceivedAt: string;
  DueAt?: string | null;
  ReviewCode?: string | null;
  ReviewedBy?: string | null;
  ReviewedAt?: string | null;
  Status: string;
  DocumentId?: string | null;
  RemarksFa?: string | null;
};

/* ══════════════════════════ ابزار تاریخ ══════════════════════════ */

const DAY_MS = 86_400_000;

/** تاریخ ISO را به عدد روز تبدیل می‌کند؛ ورودی نامعتبر NaN می‌دهد نه استثنا. */
export function dayNumber(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const t = Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(t) ? NaN : Math.floor(t / DAY_MS);
}

/** فاصلهٔ روز بین دو تاریخ ISO. نامعتبر → null (نه صفر؛ صفر معنای واقعی دارد). */
export function daysBetween(fromIso: string | null | undefined, toIso: string | null | undefined): number | null {
  const a = dayNumber(fromIso);
  const b = dayNumber(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return b - a;
}

/** n روز به تاریخ ISO می‌افزاید و ISO برمی‌گرداند. */
export function addDays(iso: string, days: number): string | null {
  const d = dayNumber(iso);
  if (Number.isNaN(d) || !Number.isFinite(days)) return null;
  return new Date((d + Math.trunc(days)) * DAY_MS).toISOString().slice(0, 10);
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const round = (v: number, p = 2): number => {
  const f = 10 ** p;
  return Math.round((v + Number.EPSILON) * f) / f;
};

/* ══════════════════════════ ۱۲.۱ — MDR ══════════════════════════ */

/** مهلت قراردادی بررسی این مدرک؛ نبودِ مقدار یعنی پیش‌فرض ۱۴ روز (ADR-ENG-08). */
export function reviewDaysFor(d: Pick<MdrDeliverable, "ContractReviewDays"> | null | undefined): number {
  const v = d?.ContractReviewDays;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.trunc(v) : DEFAULT_CONTRACT_REVIEW_DAYS;
}

/** تاریخ سررسید بررسی برای یک ریویژن. */
export function reviewDueDate(issuedAt: string, deliverable?: Pick<MdrDeliverable, "ContractReviewDays"> | null): string | null {
  return addDays(issuedAt, reviewDaysFor(deliverable));
}

export type MdrIssue = {
  code: string;
  severity: "error" | "warning";
  docNo: string;
  messageFa: string;
};

/**
 * سلامت فهرست MDR. وزن‌ها باید جمعشان ۱۰۰ شود؛ انحراف بیش از ۰٫۰۱ خطاست.
 * دلیل سخت‌گیری: پیشرفت مهندسی وزنی است و مجموع غلط یعنی درصد غلط.
 */
export function validateMdr(rows: MdrDeliverable[]): { issues: MdrIssue[]; totalWeight: number; ok: boolean } {
  const issues: MdrIssue[] = [];
  const seen = new Map<string, number>();
  let total = 0;

  for (const r of rows) {
    const docNo = r.DocNo ?? "";
    total += num(r.PlannedWeight);

    seen.set(docNo, (seen.get(docNo) ?? 0) + 1);

    if (!docNo.trim()) {
      issues.push({ code: "ENG-MDR-NODOC", severity: "error", docNo, messageFa: "شمارهٔ مدرک خالی است" });
    }
    if (num(r.PlannedWeight) <= 0) {
      issues.push({ code: "ENG-MDR-WEIGHT", severity: "error", docNo, messageFa: "وزن مدرک باید بزرگ‌تر از صفر باشد" });
    }
    if (!DISCIPLINES.includes(r.Discipline as Discipline)) {
      issues.push({ code: "ENG-MDR-DISC", severity: "warning", docNo, messageFa: `دیسیپلین ناشناخته: ${r.Discipline}` });
    }
    const ifa = dayNumber(r.TargetIfaDate);
    const ifc = dayNumber(r.TargetIfcDate);
    if (!Number.isNaN(ifa) && !Number.isNaN(ifc) && ifc < ifa) {
      issues.push({ code: "ENG-MDR-DATE", severity: "error", docNo, messageFa: "تاریخ هدف IFC پیش از IFA است" });
    }
    if (Number.isNaN(ifc)) {
      issues.push({ code: "ENG-MDR-NOIFC", severity: "warning", docNo, messageFa: "تاریخ هدف IFC تعیین نشده" });
    }
  }

  for (const [docNo, n] of seen) {
    if (n > 1) issues.push({ code: "ENG-MDR-DUP", severity: "error", docNo, messageFa: `شمارهٔ مدرک ${n} بار تکرار شده` });
  }

  if (rows.length > 0 && Math.abs(total - 100) > 0.01) {
    issues.push({
      code: "ENG-MDR-SUM",
      severity: "error",
      docNo: "",
      messageFa: `مجموع وزن مدارک ${round(total, 4)} است، باید ۱۰۰ باشد`,
    });
  }

  return { issues, totalWeight: round(total, 4), ok: !issues.some((i) => i.severity === "error") };
}

/** توزیع خودکار وزن بر پایهٔ نفرساعت برآوردی؛ نبودِ نفرساعت یعنی توزیع مساوی. */
export function distributeWeights(rows: Pick<MdrDeliverable, "DocNo" | "EstimatedManhours">[]): { docNo: string; weight: number }[] {
  if (rows.length === 0) return [];
  const total = rows.reduce((s, r) => s + num(r.EstimatedManhours), 0);
  if (total <= 0) {
    const even = round(100 / rows.length, 4);
    return rows.map((r) => ({ docNo: r.DocNo, weight: even }));
  }
  return rows.map((r) => ({ docNo: r.DocNo, weight: round((num(r.EstimatedManhours) / total) * 100, 4) }));
}

/* ══════════════════ ۱۲.۶ — Rule of Credit و پیشرفت ══════════════════ */

export type RocStep = {
  code: string;
  pct: number;
  titleFa: string;
};

/**
 * پله‌های پیشرفت مهندسی — ADR-ENG-03. پیشرفت هرگز دستی وارد نمی‌شود.
 * ترتیب صعودی است و کد پله در گزارش‌ها نمایش داده می‌شود.
 */
export const ROC_STEPS: RocStep[] = [
  { code: "DRAFT", pct: 20, titleFa: "پیش‌نویس" },
  { code: "IDC", pct: 30, titleFa: "بررسی بین‌دیسیپلینی" },
  { code: "IFA", pct: 60, titleFa: "ارسال برای تأیید" },
  { code: "CODE12", pct: 85, titleFa: "تأیید کارفرما (کد ۱ یا ۲)" },
  { code: "IFC", pct: 95, titleFa: "صدور برای ساخت" },
  { code: "ASBUILT", pct: 100, titleFa: "چون‌ساخت" },
];

const ROC_BY_CODE = new Map(ROC_STEPS.map((s) => [s.code, s]));

export function rocPct(code: string): number {
  return ROC_BY_CODE.get(code)?.pct ?? 0;
}

export type ProgressEvidence = {
  step: string;
  pct: number;
  titleFa: string;
  /** شاهد این پله؛ نبودش یعنی پله قفل است. */
  evidence: string | null;
  reached: boolean;
};

/**
 * پیشرفت یک مدرک از روی ریویژن‌هایش مشتق می‌شود — ADR-ENG-03.
 * پله بدون شاهد باز نمی‌شود؛ «۹۵٪ بدون فایل IFC» ناممکن است.
 *
 * requireDocument=true یعنی پلهٔ IFC و چون‌ساخت فقط با DocumentId معتبر باز می‌شود
 * (شاهد در مخزن d1). پیش‌فرض روشن است چون همین قید ارزش اصلی ADR است.
 */
export function deliverableProgress(
  revisions: EngineeringRevision[],
  opts: { requireDocument?: boolean } = {},
): { pct: number; step: string; trail: ProgressEvidence[] } {
  const requireDoc = opts.requireDocument !== false;
  const revs = [...revisions].sort((a, b) => (a.IssuedAt ?? "").localeCompare(b.IssuedAt ?? ""));

  const hasAny = revs.length > 0;
  const idcDone = revs.find((r) => !!r.IdcCompletedAt);
  const ifaSent = revs.find((r) => r.Purpose === "IFA");
  const approved = revs.find((r) => r.Purpose === "IFA" && isApprovingCode(r.ReviewCode));
  const ifcRev = revs.find((r) => r.Purpose === "IFC" && (!requireDoc || !!r.DocumentId));
  const abRev = revs.find((r) => r.Purpose === "AB" && (!requireDoc || !!r.DocumentId));

  const trail: ProgressEvidence[] = [
    { step: "DRAFT", pct: 20, titleFa: "پیش‌نویس", evidence: hasAny ? `ریویژن ${revs[0].RevCode}` : null, reached: hasAny },
    { step: "IDC", pct: 30, titleFa: "بررسی بین‌دیسیپلینی", evidence: idcDone ? `IDC در ${idcDone.IdcCompletedAt}` : null, reached: !!idcDone },
    { step: "IFA", pct: 60, titleFa: "ارسال برای تأیید", evidence: ifaSent ? `IFA ریویژن ${ifaSent.RevCode}` : null, reached: !!ifaSent },
    { step: "CODE12", pct: 85, titleFa: "تأیید کارفرما (کد ۱ یا ۲)", evidence: approved ? `کد ${approved.ReviewCode} روی ${approved.RevCode}` : null, reached: !!approved },
    { step: "IFC", pct: 95, titleFa: "صدور برای ساخت", evidence: ifcRev ? `IFC ریویژن ${ifcRev.RevCode}` : null, reached: !!ifcRev },
    { step: "ASBUILT", pct: 100, titleFa: "چون‌ساخت", evidence: abRev ? `چون‌ساخت ${abRev.RevCode}` : null, reached: !!abRev },
  ];

  let pct = 0;
  let step = "NONE";
  for (const t of trail) {
    if (!t.reached) break;
    pct = t.pct;
    step = t.step;
  }
  return { pct, step, trail };
}

export type ProgressRow = {
  deliverable: MdrDeliverable;
  revisions: EngineeringRevision[];
};

export type EngProgressResult = {
  actualPct: number;
  plannedPct: number;
  spi: number | null;
  earnedWeight: number;
  totalWeight: number;
  byDiscipline: { discipline: string; actualPct: number; plannedPct: number; weight: number; count: number }[];
  items: { docNo: string; discipline: string; weight: number; pct: number; step: string; earned: number }[];
};

/**
 * پیشرفت کل مهندسی. برنامه از تاریخ‌های هدف مشتق می‌شود:
 * مدرکی که تاریخ هدف IFC آن گذشته باید ۹۵٪ باشد؛ گذشتن IFA یعنی ۶۰٪.
 * SPI = EV/PV و در نبودِ PV مثبت null است (نه صفر و نه بی‌نهایت — درس EQP).
 */
export function engineeringProgress(rows: ProgressRow[], asOf: string): EngProgressResult {
  const asOfDay = dayNumber(asOf);
  let earned = 0;
  let planned = 0;
  let totalWeight = 0;

  const items: EngProgressResult["items"] = [];
  const discMap = new Map<string, { earned: number; planned: number; weight: number; count: number }>();

  for (const row of rows) {
    const w = num(row.deliverable.PlannedWeight);
    totalWeight += w;

    const { pct, step } = deliverableProgress(row.revisions);
    const ev = (w * pct) / 100;
    earned += ev;

    let plannedPctItem = 0;
    const ifa = dayNumber(row.deliverable.TargetIfaDate);
    const ifc = dayNumber(row.deliverable.TargetIfcDate);
    if (!Number.isNaN(ifc) && asOfDay >= ifc) plannedPctItem = 95;
    else if (!Number.isNaN(ifa) && asOfDay >= ifa) plannedPctItem = 60;
    planned += (w * plannedPctItem) / 100;

    items.push({ docNo: row.deliverable.DocNo, discipline: row.deliverable.Discipline, weight: w, pct, step, earned: round(ev, 4) });

    const d = row.deliverable.Discipline;
    const agg = discMap.get(d) ?? { earned: 0, planned: 0, weight: 0, count: 0 };
    agg.earned += ev;
    agg.planned += (w * plannedPctItem) / 100;
    agg.weight += w;
    agg.count += 1;
    discMap.set(d, agg);
  }

  const actualPct = totalWeight > 0 ? round((earned / totalWeight) * 100, 4) : 0;
  const plannedPct = totalWeight > 0 ? round((planned / totalWeight) * 100, 4) : 0;

  return {
    actualPct,
    plannedPct,
    spi: planned > 0 ? round(earned / planned, 4) : null,
    earnedWeight: round(earned, 4),
    totalWeight: round(totalWeight, 4),
    byDiscipline: [...discMap.entries()]
      .map(([discipline, a]) => ({
        discipline,
        actualPct: a.weight > 0 ? round((a.earned / a.weight) * 100, 4) : 0,
        plannedPct: a.weight > 0 ? round((a.planned / a.weight) * 100, 4) : 0,
        weight: round(a.weight, 4),
        count: a.count,
      }))
      .sort((x, y) => y.weight - x.weight),
    items,
  };
}

/* ══════════════════ ۱۲.۲ — بررسی و CRS ══════════════════ */

export type ReviewAging = {
  revisionId: string;
  deliverableId: string;
  issuedAt: string;
  dueAt: string | null;
  /** روزهای سپری‌شده از سررسید؛ منفی یعنی هنوز مهلت باقی است. */
  overdueDays: number | null;
  status: "on_time" | "due_soon" | "overdue" | "reviewed" | "unknown";
  reviewCode: string | null;
};

/**
 * سن بررسی. اگر بررسی انجام شده باشد تأخیر واقعی ثبت می‌شود، وگرنه تأخیر جاری.
 * این عدد مبنای ادعای تأخیر کارفرما در RCC است (ADR-ENG-08).
 */
export function reviewAging(
  revisions: EngineeringRevision[],
  asOf: string,
  deliverableById: Map<string, MdrDeliverable> = new Map(),
): ReviewAging[] {
  const asOfDay = dayNumber(asOf);
  return revisions.map((r) => {
    const due = r.ReviewDueAt ?? reviewDueDate(r.IssuedAt, deliverableById.get(r.DeliverableId));
    const dueDay = dayNumber(due);
    const base: ReviewAging = {
      revisionId: r.Id,
      deliverableId: r.DeliverableId,
      issuedAt: r.IssuedAt,
      dueAt: due,
      overdueDays: null,
      status: "unknown",
      reviewCode: r.ReviewCode ?? null,
    };
    if (Number.isNaN(dueDay)) return base;

    if (r.ReviewedAt) {
      const d = daysBetween(due, r.ReviewedAt);
      return { ...base, overdueDays: d, status: "reviewed" };
    }
    if (Number.isNaN(asOfDay)) return base;

    const over = asOfDay - dueDay;
    return {
      ...base,
      overdueDays: over,
      status: over > 0 ? "overdue" : over >= -3 ? "due_soon" : "on_time",
    };
  });
}

export type CrsSummary = {
  total: number;
  open: number;
  agreed: number;
  disagreed: number;
  noted: number;
  verified: number;
  unanswered: number;
  bySeverity: Record<string, number>;
  closureRate: number;
};

/** خلاصهٔ شیت نظرات. نرخ بسته‌شدن = نظرهای پاسخ‌گرفته و صحه‌خورده. */
export function crsSummary(comments: CrsComment[]): CrsSummary {
  const bySeverity: Record<string, number> = {};
  let open = 0, agreed = 0, disagreed = 0, noted = 0, verified = 0, unanswered = 0;

  for (const c of comments) {
    bySeverity[c.Severity] = (bySeverity[c.Severity] ?? 0) + 1;
    switch (c.ResponseStatus) {
      case "agreed": agreed++; break;
      case "disagreed": disagreed++; break;
      case "noted": noted++; break;
      default: open++;
    }
    if (c.VerifiedBy) verified++;
    if (!c.ResponseText) unanswered++;
  }

  return {
    total: comments.length,
    open, agreed, disagreed, noted, verified, unanswered,
    bySeverity,
    closureRate: comments.length > 0 ? round((verified / comments.length) * 100, 2) : 0,
  };
}

export type CrsGateResult = {
  passed: boolean;
  blockers: { code: string; messageFa: string; count?: number }[];
};

/**
 * دروازهٔ صدور IFC از منظر CRS: نظر باز یا نظر بحرانی صحه‌نخورده مانع است.
 * دلیل: صدور IFC با نظر حل‌نشده یعنی دوباره‌کاری قطعی در کارگاه.
 */
export function crsGate(comments: CrsComment[]): CrsGateResult {
  const blockers: CrsGateResult["blockers"] = [];
  const open = comments.filter((c) => c.ResponseStatus === "open");
  const disagreed = comments.filter((c) => c.ResponseStatus === "disagreed");
  const criticalUnverified = comments.filter((c) => (c.Severity === "critical" || c.Severity === "major") && !c.VerifiedBy);

  if (open.length > 0) blockers.push({ code: "ENG-CRS-OPEN", messageFa: `${open.length} نظر بدون پاسخ`, count: open.length });
  if (disagreed.length > 0) blockers.push({ code: "ENG-CRS-DISAGREED", messageFa: `${disagreed.length} نظر مورد اختلاف`, count: disagreed.length });
  if (criticalUnverified.length > 0) {
    blockers.push({ code: "ENG-CRS-UNVERIFIED", messageFa: `${criticalUnverified.length} نظر مهم بدون صحه‌گذاری ناظر`, count: criticalUnverified.length });
  }

  return { passed: blockers.length === 0, blockers };
}

/** شمارش چرخه‌های دوباره‌کاری: هر کد ۳ یک چرخه است. */
export function rejectionCycles(revisions: EngineeringRevision[]): number {
  return revisions.filter((r) => isRejectingCode(r.ReviewCode)).length;
}

/* ══════════════════ ۱۲.۳ — IDC و تداخل ══════════════════ */

export type IdcStatus = {
  revisionId: string;
  requested: number;
  cleared: number;
  objected: number;
  pending: number;
  complete: boolean;
  overdue: string[];
};

/** وضعیت Squad Check یک ریویژن. تکمیل یعنی هیچ بازبینی معلق یا معترضی نمانده. */
export function idcStatus(checks: SquadCheck[], asOf: string): IdcStatus[] {
  const asOfDay = dayNumber(asOf);
  const byRev = new Map<string, SquadCheck[]>();
  for (const c of checks) {
    const arr = byRev.get(c.RevisionId) ?? [];
    arr.push(c);
    byRev.set(c.RevisionId, arr);
  }

  return [...byRev.entries()].map(([revisionId, list]) => {
    const cleared = list.filter((c) => c.Status === "cleared").length;
    const objected = list.filter((c) => c.Status === "objected").length;
    const pending = list.filter((c) => c.Status === "pending" || c.Status === "in_review").length;
    const overdue = list
      .filter((c) => !c.CompletedAt && !Number.isNaN(dayNumber(c.DueAt)) && !Number.isNaN(asOfDay) && asOfDay > dayNumber(c.DueAt))
      .map((c) => c.Discipline);

    return { revisionId, requested: list.length, cleared, objected, pending, complete: list.length > 0 && cleared === list.length, overdue };
  });
}

export type ClashSummary = {
  total: number;
  open: number;
  resolved: number;
  critical: number;
  byPair: { pair: string; count: number; open: number }[];
  byStage: Record<string, number>;
  resolutionRate: number;
};

/** خلاصهٔ تداخلات. جفت دیسیپلین مرتب می‌شود تا A-B و B-A یکی شمرده شوند. */
export function clashSummary(clashes: InterfaceClashLog[]): ClashSummary {
  const byPair = new Map<string, { count: number; open: number }>();
  const byStage: Record<string, number> = {};
  let open = 0, resolved = 0, critical = 0;

  for (const c of clashes) {
    const isOpen = c.Status === "open" || c.Status === "assigned";
    if (isOpen) open++;
    if (c.Status === "resolved" || c.Status === "accepted") resolved++;
    if (c.Severity === "critical") critical++;

    const pair = [c.DisciplineA, c.DisciplineB].sort().join("↔");
    const agg = byPair.get(pair) ?? { count: 0, open: 0 };
    agg.count++;
    if (isOpen) agg.open++;
    byPair.set(pair, agg);

    if (c.ModelReviewStage) byStage[c.ModelReviewStage] = (byStage[c.ModelReviewStage] ?? 0) + 1;
  }

  return {
    total: clashes.length,
    open, resolved, critical,
    byPair: [...byPair.entries()].map(([pair, a]) => ({ pair, ...a })).sort((x, y) => y.count - x.count),
    byStage,
    resolutionRate: clashes.length > 0 ? round((resolved / clashes.length) * 100, 2) : 0,
  };
}

/* ══════════════════ ۱۲.۴ — TQ / FCR / DCN ══════════════════ */

export type TqAging = {
  code: string;
  kind: string;
  raisedAt: string;
  ageDays: number | null;
  overdue: boolean;
  status: string;
  hasImpact: boolean;
};

/** سن استعلام‌های باز. بسته‌شده‌ها سن نهایی می‌گیرند نه سن جاری. */
export function tqAging(queries: TechnicalQuery[], asOf: string): TqAging[] {
  const asOfDay = dayNumber(asOf);
  return queries.map((q) => {
    const closed = q.Status === "closed" || q.Status === "rejected";
    const end = closed && q.AnsweredAt ? q.AnsweredAt : asOf;
    const age = daysBetween(q.RaisedAt, end);
    const dueDay = dayNumber(q.DueAt);
    return {
      code: q.Code,
      kind: q.Kind,
      raisedAt: q.RaisedAt,
      ageDays: age,
      overdue: !closed && !Number.isNaN(dueDay) && !Number.isNaN(asOfDay) && asOfDay > dueDay,
      status: q.Status,
      hasImpact: hasCommercialImpact(q),
    };
  });
}

/** آیا این استعلام اثر مالی یا زمانی دارد؟ محرک CR خودکار — ADR-ENG-06. */
export function hasCommercialImpact(q: Pick<TechnicalQuery, "CostImpact" | "TimeImpactDays">): boolean {
  return num(q.CostImpact) !== 0 || num(q.TimeImpactDays) !== 0;
}

export type CrDraft = {
  sourceCode: string;
  sourceKind: string;
  code: string;
  titleFa: string;
  costImpact: number;
  timeImpactDays: number;
  raisedAt: string;
  reasonFa: string;
};

export type CrPlan = {
  drafts: CrDraft[];
  skippedExisting: string[];
  skippedNoImpact: string[];
};

/**
 * پیش‌نویس CR از TQ/FCR اثرگذار — ADR-ENG-06.
 * ایدمپوتنت: استعلامی که LinkedCrCode دارد دوباره CR نمی‌سازد.
 * کد CR قطعی است تا اجرای مکرر نتیجهٔ یکسان بدهد (درس G-02).
 */
export function planChangeRequests(queries: TechnicalQuery[]): CrPlan {
  const drafts: CrDraft[] = [];
  const skippedExisting: string[] = [];
  const skippedNoImpact: string[] = [];

  for (const q of queries) {
    if (q.LinkedCrCode) { skippedExisting.push(q.Code); continue; }
    if (!hasCommercialImpact(q)) { skippedNoImpact.push(q.Code); continue; }
    if (q.Status === "rejected") { skippedNoImpact.push(q.Code); continue; }

    const cost = num(q.CostImpact);
    const time = num(q.TimeImpactDays);
    const parts: string[] = [];
    if (cost !== 0) parts.push(`اثر هزینه ${round(cost, 2)}`);
    if (time !== 0) parts.push(`اثر زمان ${time} روز`);

    drafts.push({
      sourceCode: q.Code,
      sourceKind: q.Kind,
      code: `CR-${q.Kind}-${q.Code}`,
      titleFa: q.TitleFa,
      costImpact: cost,
      timeImpactDays: time,
      raisedAt: q.RaisedAt,
      reasonFa: `برخاسته از ${TQ_KIND_FA[q.Kind as TqKind] ?? q.Kind} ${q.Code} — ${parts.join(" و ")}`,
    });
  }

  return { drafts, skippedExisting, skippedNoImpact };
}

export type AsBuiltStatus = {
  total: number;
  notRequired: number;
  pending: number;
  drafted: number;
  approved: number;
  completionRate: number;
  outstanding: string[];
};

/** وضعیت چون‌ساخت. تحویل نهایی پروژه به بسته‌شدن همین‌هاست. */
export function asBuiltStatus(queries: TechnicalQuery[]): AsBuiltStatus {
  let notRequired = 0, pending = 0, drafted = 0, approved = 0;
  const outstanding: string[] = [];

  for (const q of queries) {
    switch (q.AsBuiltStatus) {
      case "approved": approved++; break;
      case "drafted": drafted++; outstanding.push(q.Code); break;
      case "pending": pending++; outstanding.push(q.Code); break;
      default: notRequired++;
    }
  }

  const required = pending + drafted + approved;
  return {
    total: queries.length,
    notRequired, pending, drafted, approved,
    completionRate: required > 0 ? round((approved / required) * 100, 2) : 100,
    outstanding,
  };
}

/* ══════════════════ ۱۲.۵ — VPR ══════════════════ */

export type VprSummary = {
  total: number;
  underReview: number;
  approvedForMfg: number;
  rejected: number;
  overdue: number;
  unmappedToPo: string[];
  byVendor: { vendor: string; count: number; approved: number }[];
};

/** خلاصهٔ مدارک سازندگان. مدرک بدون PO پرچم می‌خورد چون نگاشت FIN لازم است. */
export function vprSummary(rows: VendorPrintReview[], asOf: string): VprSummary {
  const asOfDay = dayNumber(asOf);
  const byVendor = new Map<string, { count: number; approved: number }>();
  let underReview = 0, approvedForMfg = 0, rejected = 0, overdue = 0;
  const unmappedToPo: string[] = [];

  for (const r of rows) {
    if (r.Status === "under_review" || r.Status === "received") underReview++;
    if (r.Status === "approved_for_mfg") approvedForMfg++;
    if (r.Status === "rejected") rejected++;

    const dueDay = dayNumber(r.DueAt);
    const done = r.Status === "approved_for_mfg" || r.Status === "rejected";
    if (!done && !Number.isNaN(dueDay) && !Number.isNaN(asOfDay) && asOfDay > dueDay) overdue++;

    if (!r.PoNo) unmappedToPo.push(r.VendorDocNo);

    const agg = byVendor.get(r.VendorName) ?? { count: 0, approved: 0 };
    agg.count++;
    if (r.Status === "approved_for_mfg") agg.approved++;
    byVendor.set(r.VendorName, agg);
  }

  return {
    total: rows.length,
    underReview, approvedForMfg, rejected, overdue,
    unmappedToPo,
    byVendor: [...byVendor.entries()].map(([vendor, a]) => ({ vendor, ...a })).sort((x, y) => y.count - x.count),
  };
}

/* ══════════════════ ۱۲.۶ — قفل IFC (ENG ↔ PEX) ══════════════════ */

export type ActivityLike = {
  Id: string;
  ProjectId: string;
  Code?: string | null;
  NameFa?: string | null;
  ActualStart?: string | null;
  BlockedByDocumentId?: string | null;
};

export type IfcLockPlan = {
  lock: { activityId: string; documentId: string; docNo: string; reasonFa: string }[];
  release: { activityId: string; previousDocumentId: string; reasonFa: string }[];
  unchanged: number;
};

/**
 * برنامهٔ قفل و آزادسازی فعالیت‌های ساخت بر پایهٔ صدور IFC — ADR-ENG-04/05.
 *
 * قفل «وضعیت مشتق‌شده» است نه رویداد: هر بار کل وضعیت بازمحاسبه می‌شود، پس
 * صدور IFC خودبه‌خود آزادسازی می‌آورد و قفلِ جامانده نمی‌ماند (درس ADR-20 در EQP).
 *
 * activityDocLinks نگاشت فعالیت به مدرک پیش‌نیاز است؛ از WBS یا تخصیص دستی می‌آید.
 * فعالیتی که واقعاً شروع شده قفل نمی‌شود — قفلِ گذشته بی‌معناست.
 */
export function planIfcLocks(input: {
  activities: ActivityLike[];
  activityDocLinks: { activityId: string; deliverableId: string }[];
  deliverables: MdrDeliverable[];
  revisions: EngineeringRevision[];
  requireDocument?: boolean;
}): IfcLockPlan {
  const requireDoc = input.requireDocument !== false;
  const delById = new Map(input.deliverables.map((d) => [d.Id, d]));

  const revsByDel = new Map<string, EngineeringRevision[]>();
  for (const r of input.revisions) {
    const arr = revsByDel.get(r.DeliverableId) ?? [];
    arr.push(r);
    revsByDel.set(r.DeliverableId, arr);
  }

  const ifcReady = new Set<string>();
  for (const [delId, revs] of revsByDel) {
    if (revs.some((r) => r.Purpose === "IFC" && (!requireDoc || !!r.DocumentId))) ifcReady.add(delId);
  }

  const linkByActivity = new Map(input.activityDocLinks.map((l) => [l.activityId, l.deliverableId]));

  const lock: IfcLockPlan["lock"] = [];
  const release: IfcLockPlan["release"] = [];
  let unchanged = 0;

  for (const a of input.activities) {
    const delId = linkByActivity.get(a.Id);
    const shouldLock = !!delId && !ifcReady.has(delId) && !a.ActualStart;
    const current = a.BlockedByDocumentId ?? null;

    if (shouldLock && current !== delId) {
      const d = delById.get(delId!);
      lock.push({
        activityId: a.Id,
        documentId: delId!,
        docNo: d?.DocNo ?? delId!,
        reasonFa: `نقشهٔ ${d?.DocNo ?? delId} هنوز IFC نشده`,
      });
    } else if (!shouldLock && current) {
      const d = delById.get(current);
      release.push({
        activityId: a.Id,
        previousDocumentId: current,
        reasonFa: d && ifcReady.has(current) ? `نقشهٔ ${d.DocNo} به IFC رسید` : "پیش‌نیاز مدرک برداشته شد",
      });
    } else {
      unchanged++;
    }
  }

  return { lock, release, unchanged };
}

/* ══════════════════ ۱۲.۶ — KPI و EWS ══════════════════ */

export type EngKpi = {
  code: string;
  title: { fa: string; en: string };
  value: number | null;
  unit: string;
  target: number;
  direction: "higher" | "lower";
  status: "good" | "warn" | "bad" | "unknown";
};

export const ENG_KPI_TARGETS: Record<string, { target: number; direction: "higher" | "lower" }> = {
  "K-ENG-SPI": { target: 0.95, direction: "higher" },
  "K-ENG-FTA": { target: 60, direction: "higher" },
  "K-ENG-AGE": { target: 14, direction: "lower" },
  "K-ENG-REJ": { target: 20, direction: "lower" },
  "K-ENG-TQA": { target: 10, direction: "lower" },
  "K-ENG-IFC": { target: 90, direction: "higher" },
};

function kpiStatus(value: number | null, target: number, direction: "higher" | "lower"): EngKpi["status"] {
  if (value === null) return "unknown";
  const ok = direction === "higher" ? value >= target : value <= target;
  if (ok) return "good";
  const margin = direction === "higher" ? value >= target * 0.9 : value <= target * 1.1;
  return margin ? "warn" : "bad";
}

/** شش شاخص مهندسی. هر شاخص در نبودِ داده null می‌دهد نه صفر — درس EQP. */
export function engineeringKpis(input: {
  progress: EngProgressResult;
  revisions: EngineeringRevision[];
  aging: ReviewAging[];
  queries: TechnicalQuery[];
  deliverables: MdrDeliverable[];
  asOf: string;
}): EngKpi[] {
  const { progress, revisions, aging, queries, deliverables, asOf } = input;

  const firstRevs = new Map<string, EngineeringRevision>();
  for (const r of revisions.filter((x) => x.Purpose === "IFA")) {
    const cur = firstRevs.get(r.DeliverableId);
    if (!cur || (r.IssuedAt ?? "") < (cur.IssuedAt ?? "")) firstRevs.set(r.DeliverableId, r);
  }
  const firstReviewed = [...firstRevs.values()].filter((r) => !!r.ReviewCode);
  const fta = firstReviewed.length > 0
    ? round((firstReviewed.filter((r) => isApprovingCode(r.ReviewCode)).length / firstReviewed.length) * 100, 2)
    : null;

  const overdueAging = aging.filter((a) => a.overdueDays !== null && a.overdueDays > 0);
  const avgAge = overdueAging.length > 0
    ? round(overdueAging.reduce((s, a) => s + (a.overdueDays ?? 0), 0) / overdueAging.length, 2)
    : (aging.length > 0 ? 0 : null);

  const coded = revisions.filter((r) => !!r.ReviewCode);
  const rej = coded.length > 0 ? round((coded.filter((r) => isRejectingCode(r.ReviewCode)).length / coded.length) * 100, 2) : null;

  const openQ = tqAging(queries.filter((q) => q.Status !== "closed" && q.Status !== "rejected"), asOf);
  const tqa = openQ.length > 0 ? round(openQ.reduce((s, q) => s + (q.ageDays ?? 0), 0) / openQ.length, 2) : null;

  const asOfDay = dayNumber(asOf);
  const dueIfc = deliverables.filter((d) => {
    const t = dayNumber(d.TargetIfcDate);
    return !Number.isNaN(t) && !Number.isNaN(asOfDay) && asOfDay >= t;
  });
  const ifcIssued = new Set(revisions.filter((r) => r.Purpose === "IFC").map((r) => r.DeliverableId));
  const ifcRate = dueIfc.length > 0 ? round((dueIfc.filter((d) => ifcIssued.has(d.Id)).length / dueIfc.length) * 100, 2) : null;

  const defs: { code: string; fa: string; en: string; value: number | null; unit: string }[] = [
    { code: "K-ENG-SPI", fa: "شاخص عملکرد زمانی مهندسی", en: "Engineering SPI", value: progress.spi, unit: "" },
    { code: "K-ENG-FTA", fa: "نرخ تأیید بار اول", en: "First-time approval rate", value: fta, unit: "%" },
    { code: "K-ENG-AGE", fa: "میانگین تأخیر بررسی کارفرما", en: "Client review aging", value: avgAge, unit: "روز" },
    { code: "K-ENG-REJ", fa: "نرخ کد ۳ (اصلاح مجدد)", en: "Rejection rate", value: rej, unit: "%" },
    { code: "K-ENG-TQA", fa: "میانگین سن استعلام باز", en: "Open TQ aging", value: tqa, unit: "روز" },
    { code: "K-ENG-IFC", fa: "نرخ صدور IFC طبق برنامه", en: "IFC release rate", value: ifcRate, unit: "%" },
  ];

  return defs.map((d) => {
    const t = ENG_KPI_TARGETS[d.code];
    return {
      code: d.code,
      title: { fa: d.fa, en: d.en },
      value: d.value,
      unit: d.unit,
      target: t.target,
      direction: t.direction,
      status: kpiStatus(d.value, t.target, t.direction),
    };
  });
}

export type EngAlert = {
  code: string;
  severity: "high" | "medium" | "low";
  titleFa: string;
  detailFa: string;
  subject: string;
};

/** پنج قاعدهٔ هشدار زودهنگام مهندسی. */
export function engineeringAlerts(input: {
  aging: ReviewAging[];
  revisionsByDeliverable: Map<string, EngineeringRevision[]>;
  queries: TechnicalQuery[];
  lockPlan: IfcLockPlan;
  kpis: EngKpi[];
  asOf: string;
}): EngAlert[] {
  const alerts: EngAlert[] = [];

  for (const a of input.aging) {
    if (a.status === "overdue" && (a.overdueDays ?? 0) > 0) {
      alerts.push({
        code: "EWS-ENG-01",
        severity: (a.overdueDays ?? 0) > 14 ? "high" : "medium",
        titleFa: "بررسی کارفرما از مهلت گذشت",
        detailFa: `ریویژن ${a.revisionId} ${a.overdueDays} روز از سررسید ${a.dueAt} گذشته`,
        subject: a.revisionId,
      });
    }
  }

  for (const [delId, revs] of input.revisionsByDeliverable) {
    const cycles = rejectionCycles(revs);
    if (cycles >= 3) {
      alerts.push({
        code: "EWS-ENG-02",
        severity: "high",
        titleFa: "دوباره‌کاری مزمن مدرک",
        detailFa: `مدرک ${delId} تاکنون ${cycles} بار کد ۳ گرفته`,
        subject: delId,
      });
    }
  }

  for (const q of tqAging(input.queries, input.asOf)) {
    if ((q.status === "closed" || q.status === "rejected")) continue;
    if ((q.ageDays ?? 0) > 15) {
      alerts.push({
        code: "EWS-ENG-03",
        severity: q.hasImpact ? "high" : "medium",
        titleFa: "استعلام فنی بی‌پاسخ",
        detailFa: `${q.kind} ${q.code} پس از ${q.ageDays} روز هنوز باز است`,
        subject: q.code,
      });
    }
  }

  if (input.lockPlan.lock.length > 0) {
    alerts.push({
      code: "EWS-ENG-04",
      severity: "high",
      titleFa: "ساخت به دلیل نبود IFC قفل است",
      detailFa: `${input.lockPlan.lock.length} فعالیت در انتظار صدور نقشهٔ IFC`,
      subject: String(input.lockPlan.lock.length),
    });
  }

  const spi = input.kpis.find((k) => k.code === "K-ENG-SPI");
  if (spi && spi.value !== null && spi.value < 0.85) {
    alerts.push({
      code: "EWS-ENG-05",
      severity: "high",
      titleFa: "عقب‌ماندگی پیشرفت مهندسی",
      detailFa: `SPI مهندسی ${spi.value} است و از آستانهٔ ۰٫۸۵ پایین‌تر`,
      subject: "K-ENG-SPI",
    });
  }

  return alerts;
}

/* ══════════════════ کاتالوگ گزارش‌ها ══════════════════ */

export type EngReportDef = {
  code: string;
  title: { fa: string; en: string };
  periodicity: "daily" | "weekly" | "monthly" | "on_demand";
  audiences: ("internal" | "official")[];
  purpose: { fa: string; en: string };
};

export const ENG_REPORT_CATALOG: EngReportDef[] = [
  {
    code: "RPT-ENG-MDR",
    title: { fa: "ماتریس وضعیت مدارک مهندسی", en: "MDR status matrix" },
    periodicity: "weekly",
    audiences: ["internal", "official"],
    purpose: { fa: "وضعیت هر مدرک روی شش پلهٔ پیشرفت به تفکیک دیسیپلین", en: "per-document status across six credit steps" },
  },
  {
    code: "RPT-ENG-TRN",
    title: { fa: "برگه ترانسمیتال مهندسی", en: "Engineering transmittal sheet" },
    periodicity: "on_demand",
    audiences: ["official"],
    purpose: { fa: "فرم رسمی ارسال مدارک به کارفرما یا مشاور", en: "formal document submission form" },
  },
  {
    code: "RPT-ENG-CRS",
    title: { fa: "شیت پاسخ به نظرات", en: "Comment resolution sheet" },
    periodicity: "on_demand",
    audiences: ["internal", "official"],
    purpose: { fa: "نظر بازبین، پاسخ طراح و صحه‌گذاری ناظر در یک برگه", en: "comment, response and verification in one sheet" },
  },
  {
    code: "RPT-ENG-TQF",
    title: { fa: "گزارش استعلام و تغییر فنی", en: "TQ / FCR register" },
    periodicity: "weekly",
    audiences: ["internal", "official"],
    purpose: { fa: "فهرست استعلام‌ها و تغییرات کارگاهی با اثر مالی و زمانی", en: "field queries and changes with impacts" },
  },
  {
    code: "RPT-ENG-PRG",
    title: { fa: "گزارش ماهانه پیشرفت مهندسی", en: "Engineering monthly progress" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: { fa: "منحنی S برنامه‌ای و واقعی با SPI مهندسی", en: "planned vs actual S-curve with engineering SPI" },
  },
  {
    code: "RPT-ENG-VPR",
    title: { fa: "گزارش بررسی مدارک سازندگان", en: "Vendor print review register" },
    periodicity: "weekly",
    audiences: ["internal"],
    purpose: { fa: "وضعیت مدارک سازندگان و نگاشت به سفارش خرید", en: "vendor documents and PO mapping" },
  },
  {
    code: "RPT-ENG-IDC",
    title: { fa: "گزارش بررسی بین‌دیسیپلینی و تداخل", en: "IDC and clash report" },
    periodicity: "weekly",
    audiences: ["internal"],
    purpose: { fa: "وضعیت Squad Check و تداخلات کشف‌شده در مدل", en: "squad check status and detected clashes" },
  },
  {
    code: "RPT-ENG-EXEC",
    title: { fa: "گزارش تک‌صفحه‌ای مدیریتی مهندسی", en: "Engineering executive summary" },
    periodicity: "monthly",
    /* فقط داخلی: برآورد ادعای قابل مطالبه در آن هست. */
    audiences: ["internal"],
    purpose: {
      fa: "یک صفحه برای تصمیم‌گیر ارشد: قضاوت کلی، اثر بر ساخت و قرارداد، سه قلم نیازمند تصمیم",
      en: "one page for executives: verdict, impact on execution and contract, top three decisions",
    },
  },
];

const REPORT_BY_CODE = new Map(ENG_REPORT_CATALOG.map((r) => [r.code, r]));

export function getEngReport(code: string): EngReportDef | undefined {
  return REPORT_BY_CODE.get(code);
}

/** آیا این مخاطب اجازهٔ دریافت این گزارش را دارد؟ */
export function isAudienceAllowed(code: string, audience: string): boolean {
  const def = REPORT_BY_CODE.get(code);
  return !!def && (def.audiences as string[]).includes(audience);
}

/* ══════════════════ منظرهٔ یکپارچه ══════════════════ */

export type EngOverview = {
  version: string;
  asOf: string;
  progress: EngProgressResult;
  kpis: EngKpi[];
  alerts: EngAlert[];
  crs: CrsSummary;
  clash: ClashSummary;
  vpr: VprSummary;
  asBuilt: AsBuiltStatus;
  reviewOverdue: number;
  openQueries: number;
};

/** یک فراخوان، کل تصویر مهندسی. لایهٔ REST همین را سرو می‌کند. */
export function engineeringOverview(input: {
  deliverables: MdrDeliverable[];
  revisions: EngineeringRevision[];
  comments: CrsComment[];
  clashes: InterfaceClashLog[];
  queries: TechnicalQuery[];
  vendorDocs: VendorPrintReview[];
  lockPlan?: IfcLockPlan;
  asOf: string;
}): EngOverview {
  const { deliverables, revisions, comments, clashes, queries, vendorDocs, asOf } = input;

  const delById = new Map(deliverables.map((d) => [d.Id, d]));
  const revsByDel = new Map<string, EngineeringRevision[]>();
  for (const r of revisions) {
    const arr = revsByDel.get(r.DeliverableId) ?? [];
    arr.push(r);
    revsByDel.set(r.DeliverableId, arr);
  }

  const progress = engineeringProgress(
    deliverables.map((d) => ({ deliverable: d, revisions: revsByDel.get(d.Id) ?? [] })),
    asOf,
  );

  const aging = reviewAging(revisions.filter((r) => r.Purpose === "IFA"), asOf, delById);
  const lockPlan = input.lockPlan ?? { lock: [], release: [], unchanged: 0 };
  const kpis = engineeringKpis({ progress, revisions, aging, queries, deliverables, asOf });

  return {
    version: ENG_VERSION,
    asOf,
    progress,
    kpis,
    alerts: engineeringAlerts({ aging, revisionsByDeliverable: revsByDel, queries, lockPlan, kpis, asOf }),
    crs: crsSummary(comments),
    clash: clashSummary(clashes),
    vpr: vprSummary(vendorDocs, asOf),
    asBuilt: asBuiltStatus(queries),
    reviewOverdue: aging.filter((a) => a.status === "overdue").length,
    openQueries: queries.filter((q) => q.Status !== "closed" && q.Status !== "rejected").length,
  };
}

/* ══════════════════ D15 — سازندگان گزارش A4 سه‌لوگو ══════════════════
 * 📌 موجود: کاتالوگ ENG_REPORT_CATALOG و کنترل مخاطب از D11.
 * 🔧 بهبود: کاتالوگ حالا بدنهٔ واقعی می‌سازد، نه فقط فراداده.
 * ✨ جدید: هفت سازنده که از دادهٔ خام `EngReportBody` می‌سازند.
 *
 * ساختار عمداً با `ReportDef` موتور rpt-v1 هم‌ریخت است تا `toPrintHtml`،
 * `toWordHtml`، `toExcelHtml` و `toCsv` بدون تبدیل میانی مصرفش کنند.
 * ENG هیچ عددی نمی‌سازد که پیش‌تر محاسبه نشده باشد — گزارش فقط می‌چیند. */

export type EngBi = { fa: string; en: string };

export type EngColumnDef = {
  key: string;
  title: EngBi;
  format?: "text" | "number" | "percent" | "currency" | "date" | "status";
  align?: "start" | "center" | "end";
  weight?: number;
};

export type EngKpiCell = { label: EngBi; value: string; tone?: "good" | "warn" | "bad" };

export type EngReportSection =
  | { kind: "kpi"; title: EngBi; cells: EngKpiCell[] }
  | { kind: "table"; title: EngBi; note?: EngBi; columns: EngColumnDef[]; rows: Record<string, string | number | undefined>[] }
  | { kind: "text"; title: EngBi; body: EngBi };

export type EngReportBody = {
  code: string;
  title: EngBi;
  periodicity: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "milestone" | "adhoc";
  sourceModule: string;
  audiences: ("internal" | "official")[];
  sections: EngReportSection[];
};

const SRC = `${ENG_DOMAIN_ID} · مهندسی و طراحی`;

/** نگاشت دوره‌ای کاتالوگ به واژگان rpt-v1 (`on_demand` آنجا `adhoc` است). */
function toRptPeriodicity(p: EngReportDef["periodicity"]): EngReportBody["periodicity"] {
  return p === "on_demand" ? "adhoc" : p;
}

const dash = (v: unknown): string => (v === null || v === undefined || v === "" ? "—" : String(v));

/* ── ۱. ماتریس وضعیت مدارک ── */

export function buildMdrStatusReport(input: {
  deliverables: MdrDeliverable[];
  revisionsByDeliverable: Map<string, EngineeringRevision[]>;
  validation?: ReturnType<typeof validateMdr>;
}): EngReportBody {
  const rows = input.deliverables.map((d) => {
    const p = deliverableProgress(input.revisionsByDeliverable.get(d.Id) ?? []);
    const revs = input.revisionsByDeliverable.get(d.Id) ?? [];
    const last = [...revs].sort((a, b) => String(b.IssuedAt).localeCompare(String(a.IssuedAt)))[0];
    return {
      docNo: d.DocNo,
      title: d.TitleFa,
      discipline: DISCIPLINE_FA[d.Discipline as Discipline] ?? d.Discipline,
      docType: DOC_TYPE_FA[d.DocType as DocType] ?? d.DocType,
      weight: round(num(d.PlannedWeight), 2),
      rev: dash(last?.RevCode),
      purpose: last ? (PURPOSE_FA[last.Purpose as RevisionPurpose] ?? last.Purpose) : "—",
      reviewCode: last?.ReviewCode ? `${last.ReviewCode} — ${REVIEW_CODE_FA[last.ReviewCode as ReviewCode] ?? ""}` : "—",
      step: p.step === "NONE" ? "—" : (ROC_BY_CODE.get(p.step)?.titleFa ?? p.step),
      pct: p.pct,
      targetIfc: dash(d.TargetIfcDate),
    };
  });

  const v = input.validation ?? validateMdr(input.deliverables);
  const sections: EngReportSection[] = [
    {
      kind: "kpi",
      title: { fa: "خلاصه فهرست", en: "Register summary" },
      cells: [
        { label: { fa: "تعداد مدرک", en: "Deliverables" }, value: String(input.deliverables.length) },
        { label: { fa: "مجموع وزن", en: "Total weight" }, value: `${v.totalWeight}٪`, tone: v.ok ? "good" : "bad" },
        { label: { fa: "رسیده به IFC", en: "Reached IFC" }, value: String(rows.filter((r) => r.pct >= 95).length) },
        { label: { fa: "شروع‌نشده", en: "Not started" }, value: String(rows.filter((r) => r.pct === 0).length), tone: rows.some((r) => r.pct === 0) ? "warn" : "good" },
      ],
    },
    {
      kind: "table",
      title: { fa: "ماتریس وضعیت مدارک", en: "Document status matrix" },
      note: { fa: "پیشرفت از پله‌های مصوب مشتق می‌شود و دستی وارد نمی‌شود.", en: "Progress is derived from approved credit steps." },
      columns: [
        { key: "docNo", title: { fa: "شماره مدرک", en: "Doc no" }, weight: 2 },
        { key: "title", title: { fa: "عنوان", en: "Title" }, weight: 3 },
        { key: "discipline", title: { fa: "دیسیپلین", en: "Discipline" } },
        { key: "docType", title: { fa: "نوع", en: "Type" } },
        { key: "weight", title: { fa: "وزن", en: "Weight" }, format: "number", align: "center" },
        { key: "rev", title: { fa: "ریویژن", en: "Rev" }, align: "center" },
        { key: "purpose", title: { fa: "هدف صدور", en: "Purpose" } },
        { key: "reviewCode", title: { fa: "کد بررسی", en: "Review code" }, weight: 2 },
        { key: "step", title: { fa: "پله جاری", en: "Step" }, weight: 2 },
        { key: "pct", title: { fa: "پیشرفت", en: "Progress" }, format: "percent", align: "center" },
        { key: "targetIfc", title: { fa: "هدف IFC", en: "Target IFC" }, format: "date", align: "center" },
      ],
      rows,
    },
  ];

  if (!v.ok) {
    sections.push({
      kind: "table",
      title: { fa: "مغایرت‌های فهرست", en: "Register issues" },
      columns: [
        { key: "code", title: { fa: "کد", en: "Code" } },
        { key: "docNo", title: { fa: "مدرک", en: "Document" } },
        { key: "msg", title: { fa: "شرح", en: "Message" }, weight: 4 },
      ],
      rows: v.issues.map((i) => ({ code: i.code, docNo: dash(i.docNo), msg: i.messageFa })),
    });
  }

  return {
    code: "RPT-ENG-MDR",
    title: { fa: "ماتریس وضعیت مدارک مهندسی", en: "MDR Status Matrix" },
    periodicity: "weekly",
    sourceModule: SRC,
    audiences: ["internal", "official"],
    sections,
  };
}

/* ── ۲. برگه ترانسمیتال ── */

export function buildTransmittalReport(input: {
  revisions: EngineeringRevision[];
  deliverableById: Map<string, MdrDeliverable>;
  transmittalId?: string | null;
}): EngReportBody {
  const scoped = input.transmittalId
    ? input.revisions.filter((r) => r.TransmittalId === input.transmittalId)
    : input.revisions.filter((r) => !!r.TransmittalId);

  const rows = scoped.map((r, i) => {
    const d = input.deliverableById.get(r.DeliverableId);
    return {
      no: i + 1,
      docNo: dash(d?.DocNo ?? r.DeliverableId),
      title: dash(d?.TitleFa),
      discipline: d ? (DISCIPLINE_FA[d.Discipline as Discipline] ?? d.Discipline) : "—",
      rev: r.RevCode,
      purpose: PURPOSE_FA[r.Purpose as RevisionPurpose] ?? r.Purpose,
      issuedAt: r.IssuedAt,
      dueAt: dash(r.ReviewDueAt),
      transmittal: dash(r.TransmittalId),
    };
  });

  return {
    code: "RPT-ENG-TRN",
    title: {
      fa: input.transmittalId ? `برگه ترانسمیتال ${input.transmittalId}` : "برگه ترانسمیتال مهندسی",
      en: input.transmittalId ? `Transmittal ${input.transmittalId}` : "Engineering Transmittal Sheet",
    },
    periodicity: "adhoc",
    sourceModule: SRC,
    audiences: ["official"],
    sections: [
      {
        kind: "text",
        title: { fa: "موضوع", en: "Subject" },
        body: {
          fa: `بدین‌وسیله ${rows.length} فقره مدرک مهندسی به شرح جدول پیوست جهت اقدام مقتضی ارسال می‌گردد. خواهشمند است نتیجه بررسی ظرف مهلت قراردادی اعلام شود.`,
          en: `${rows.length} engineering document(s) are hereby transmitted for your action. Please advise the review outcome within the contractual period.`,
        },
      },
      {
        kind: "table",
        title: { fa: "فهرست مدارک ارسالی", en: "Transmitted documents" },
        columns: [
          { key: "no", title: { fa: "ردیف", en: "No" }, align: "center" },
          { key: "docNo", title: { fa: "شماره مدرک", en: "Doc no" }, weight: 2 },
          { key: "title", title: { fa: "عنوان", en: "Title" }, weight: 3 },
          { key: "discipline", title: { fa: "دیسیپلین", en: "Discipline" } },
          { key: "rev", title: { fa: "ریویژن", en: "Rev" }, align: "center" },
          { key: "purpose", title: { fa: "هدف صدور", en: "Purpose" } },
          { key: "issuedAt", title: { fa: "تاریخ صدور", en: "Issued" }, format: "date", align: "center" },
          { key: "dueAt", title: { fa: "مهلت بررسی", en: "Review due" }, format: "date", align: "center" },
        ],
        rows,
      },
    ],
  };
}

/* ── ۳. شیت پاسخ به نظرات ── */

export function buildCrsReport(input: {
  comments: CrsComment[];
  revisionId?: string | null;
  summary?: CrsSummary;
  gate?: CrsGateResult;
}): EngReportBody {
  const scoped = input.revisionId ? input.comments.filter((c) => c.RevisionId === input.revisionId) : input.comments;
  const s = input.summary ?? crsSummary(scoped);
  const g = input.gate ?? crsGate(scoped);

  const sections: EngReportSection[] = [
    {
      kind: "kpi",
      title: { fa: "خلاصه نظرات", en: "Comment summary" },
      cells: [
        { label: { fa: "کل نظر", en: "Total" }, value: String(s.total) },
        { label: { fa: "بدون پاسخ", en: "Open" }, value: String(s.open), tone: s.open > 0 ? "bad" : "good" },
        { label: { fa: "مورد توافق", en: "Agreed" }, value: String(s.agreed), tone: "good" },
        { label: { fa: "مورد اختلاف", en: "Disagreed" }, value: String(s.disagreed), tone: s.disagreed > 0 ? "warn" : "good" },
        { label: { fa: "صحه‌خورده", en: "Verified" }, value: String(s.verified) },
        { label: { fa: "نرخ بسته‌شدن", en: "Closure rate" }, value: `${s.closureRate}٪`, tone: s.closureRate >= 90 ? "good" : s.closureRate >= 60 ? "warn" : "bad" },
      ],
    },
    {
      kind: "table",
      title: { fa: "شیت ثبت و پاسخ نظرات", en: "Comment resolution sheet" },
      columns: [
        { key: "no", title: { fa: "ردیف", en: "No" }, align: "center" },
        { key: "raisedBy", title: { fa: "بازبین", en: "Reviewer" } },
        { key: "raisedAt", title: { fa: "تاریخ", en: "Date" }, format: "date", align: "center" },
        { key: "sheetRef", title: { fa: "مرجع", en: "Ref" } },
        { key: "severity", title: { fa: "شدت", en: "Severity" }, align: "center" },
        { key: "comment", title: { fa: "متن نظر", en: "Comment" }, weight: 4 },
        { key: "response", title: { fa: "پاسخ طراح", en: "Response" }, weight: 4 },
        { key: "status", title: { fa: "وضعیت", en: "Status" }, align: "center" },
        { key: "verified", title: { fa: "صحه ناظر", en: "Verified" }, align: "center" },
        { key: "closedIn", title: { fa: "اعمال در", en: "Closed in" }, align: "center" },
      ],
      rows: scoped.map((c) => ({
        no: c.CommentNo,
        raisedBy: c.RaisedBy,
        raisedAt: c.RaisedAt,
        sheetRef: dash(c.SheetRef),
        severity: c.Severity,
        comment: c.CommentText,
        response: dash(c.ResponseText),
        status: c.ResponseStatus,
        verified: c.VerifiedBy ? "✔" : "—",
        closedIn: dash(c.ClosedInRevCode),
      })),
    },
    {
      kind: "text",
      title: { fa: "نتیجه دروازه صدور", en: "Issue gate result" },
      body: g.passed
        ? { fa: "همه نظرات پاسخ و صحه‌گذاری شده‌اند؛ مانعی برای صدور IFC وجود ندارد.", en: "All comments resolved and verified; no blocker for IFC issue." }
        : {
            fa: `صدور IFC مجاز نیست: ${g.blockers.map((b) => b.messageFa).join(" · ")}`,
            en: `IFC issue blocked: ${g.blockers.map((b) => b.code).join(", ")}`,
          },
    },
  ];

  return {
    code: "RPT-ENG-CRS",
    title: {
      fa: input.revisionId ? `شیت پاسخ نظرات — ریویژن ${input.revisionId}` : "شیت پاسخ به نظرات",
      en: "Comment Resolution Sheet",
    },
    periodicity: "adhoc",
    sourceModule: SRC,
    audiences: ["internal", "official"],
    sections,
  };
}

/* ── ۴. دفتر استعلام و تغییر فنی ── */

export function buildTqFcrReport(input: {
  queries: TechnicalQuery[];
  asOf: string;
  aging?: TqAging[];
  crPlan?: CrPlan;
  asBuilt?: AsBuiltStatus;
}): EngReportBody {
  const aging = input.aging ?? tqAging(input.queries, input.asOf);
  const plan = input.crPlan ?? planChangeRequests(input.queries);
  const ab = input.asBuilt ?? asBuiltStatus(input.queries);
  const byCode = new Map(input.queries.map((q) => [q.Code, q]));

  const totalCost = input.queries.reduce((s, q) => s + num(q.CostImpact), 0);
  const totalDays = input.queries.reduce((s, q) => s + num(q.TimeImpactDays), 0);

  const sections: EngReportSection[] = [
    {
      kind: "kpi",
      title: { fa: "خلاصه تغییرات", en: "Change summary" },
      cells: [
        { label: { fa: "کل استعلام", en: "Total queries" }, value: String(input.queries.length) },
        { label: { fa: "باز", en: "Open" }, value: String(aging.filter((a) => a.status !== "closed" && a.status !== "rejected").length) },
        { label: { fa: "از مهلت گذشته", en: "Overdue" }, value: String(aging.filter((a) => a.overdue).length), tone: aging.some((a) => a.overdue) ? "bad" : "good" },
        { label: { fa: "اثر هزینه‌ای", en: "Cost impact" }, value: String(round(totalCost, 0)) },
        { label: { fa: "اثر زمانی (روز)", en: "Time impact" }, value: String(totalDays), tone: totalDays > 0 ? "warn" : "good" },
        { label: { fa: "نرخ چون‌ساخت", en: "As-built rate" }, value: `${ab.completionRate}٪`, tone: ab.completionRate >= 90 ? "good" : "warn" },
      ],
    },
    {
      kind: "table",
      title: { fa: "دفتر استعلام و تغییر فنی کارگاهی", en: "TQ / FCR register" },
      columns: [
        { key: "code", title: { fa: "شماره", en: "Code" }, weight: 2 },
        { key: "kind", title: { fa: "نوع", en: "Kind" } },
        { key: "title", title: { fa: "موضوع", en: "Subject" }, weight: 4 },
        { key: "discipline", title: { fa: "دیسیپلین", en: "Discipline" } },
        { key: "raisedAt", title: { fa: "تاریخ ثبت", en: "Raised" }, format: "date", align: "center" },
        { key: "age", title: { fa: "سن (روز)", en: "Age" }, format: "number", align: "center" },
        { key: "status", title: { fa: "وضعیت", en: "Status" } },
        { key: "cost", title: { fa: "اثر هزینه", en: "Cost" }, format: "currency", align: "end" },
        { key: "days", title: { fa: "اثر زمان", en: "Days" }, format: "number", align: "center" },
        { key: "cr", title: { fa: "درخواست تغییر", en: "Change request" }, weight: 2 },
      ],
      rows: aging.map((a) => {
        const q = byCode.get(a.code);
        return {
          code: a.code,
          kind: TQ_KIND_FA[a.kind as TqKind] ?? a.kind,
          title: dash(q?.TitleFa),
          discipline: q ? (DISCIPLINE_FA[q.Discipline as Discipline] ?? q.Discipline) : "—",
          raisedAt: a.raisedAt,
          age: a.ageDays ?? "—",
          status: a.overdue ? `${a.status} ⚠` : a.status,
          cost: num(q?.CostImpact) || "—",
          days: num(q?.TimeImpactDays) || "—",
          cr: dash(q?.LinkedCrCode),
        };
      }),
    },
  ];

  if (plan.drafts.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "پیش‌نویس درخواست تغییر", en: "Draft change requests" },
      note: {
        fa: "این پیش‌نویس‌ها ایدمپوتنت هستند؛ اجرای دوباره رکورد تکراری نمی‌سازد.",
        en: "Drafts are idempotent; re-running creates no duplicates.",
      },
      columns: [
        { key: "code", title: { fa: "کد پیشنهادی", en: "Proposed code" }, weight: 2 },
        { key: "source", title: { fa: "منشأ", en: "Source" } },
        { key: "title", title: { fa: "عنوان", en: "Title" }, weight: 3 },
        { key: "cost", title: { fa: "اثر هزینه", en: "Cost" }, format: "currency", align: "end" },
        { key: "days", title: { fa: "اثر زمان", en: "Days" }, format: "number", align: "center" },
      ],
      rows: plan.drafts.map((d) => ({
        code: d.code,
        source: d.sourceCode,
        title: d.titleFa,
        cost: d.costImpact || "—",
        days: d.timeImpactDays || "—",
      })),
    });
  }

  return {
    code: "RPT-ENG-TQF",
    title: { fa: "گزارش استعلام و تغییرات فنی کارگاه", en: "TQ / FCR Register" },
    periodicity: "weekly",
    sourceModule: SRC,
    audiences: ["internal", "official"],
    sections,
  };
}

/* ── ۵. گزارش ماهانه پیشرفت مهندسی ── */

export function buildProgressReport(input: {
  progress: EngProgressResult;
  kpis: EngKpi[];
  alerts?: EngAlert[];
  periodLabel?: string;
}): EngReportBody {
  const p = input.progress;
  const variance = round(p.actualPct - p.plannedPct, 2);

  const sections: EngReportSection[] = [
    {
      kind: "kpi",
      title: { fa: "وضعیت کلی مهندسی", en: "Engineering overview" },
      cells: [
        { label: { fa: "پیشرفت واقعی", en: "Actual" }, value: `${p.actualPct}٪` },
        { label: { fa: "پیشرفت برنامه‌ای", en: "Planned" }, value: `${p.plannedPct}٪` },
        { label: { fa: "انحراف", en: "Variance" }, value: `${variance}٪`, tone: variance >= 0 ? "good" : variance >= -5 ? "warn" : "bad" },
        { label: { fa: "SPI مهندسی", en: "Engineering SPI" }, value: p.spi === null ? "—" : String(p.spi), tone: p.spi === null ? undefined : p.spi >= 0.95 ? "good" : p.spi >= 0.85 ? "warn" : "bad" },
        { label: { fa: "وزن کسب‌شده", en: "Earned weight" }, value: String(p.earnedWeight) },
        { label: { fa: "وزن کل", en: "Total weight" }, value: String(p.totalWeight) },
      ],
    },
    {
      kind: "table",
      title: { fa: "پیشرفت به تفکیک دیسیپلین", en: "Progress by discipline" },
      columns: [
        { key: "discipline", title: { fa: "دیسیپلین", en: "Discipline" }, weight: 2 },
        { key: "count", title: { fa: "تعداد مدرک", en: "Documents" }, format: "number", align: "center" },
        { key: "weight", title: { fa: "وزن", en: "Weight" }, format: "number", align: "center" },
        { key: "planned", title: { fa: "برنامه", en: "Planned" }, format: "percent", align: "center" },
        { key: "actual", title: { fa: "واقعی", en: "Actual" }, format: "percent", align: "center" },
        { key: "variance", title: { fa: "انحراف", en: "Variance" }, format: "percent", align: "center" },
      ],
      rows: p.byDiscipline.map((d) => ({
        discipline: DISCIPLINE_FA[d.discipline as Discipline] ?? d.discipline,
        count: d.count,
        weight: d.weight,
        planned: d.plannedPct,
        actual: d.actualPct,
        variance: round(d.actualPct - d.plannedPct, 2),
      })),
    },
    {
      kind: "table",
      title: { fa: "شاخص‌های کلیدی مهندسی", en: "Engineering KPIs" },
      columns: [
        { key: "code", title: { fa: "کد", en: "Code" } },
        { key: "name", title: { fa: "شاخص", en: "Indicator" }, weight: 3 },
        { key: "value", title: { fa: "مقدار", en: "Value" }, align: "center" },
        { key: "target", title: { fa: "هدف", en: "Target" }, align: "center" },
        { key: "status", title: { fa: "وضعیت", en: "Status" }, align: "center" },
      ],
      rows: input.kpis.map((k) => ({
        code: k.code,
        name: k.title.fa,
        value: k.value === null ? "—" : `${k.value}${k.unit}`,
        target: `${k.direction === "higher" ? "≥" : "≤"} ${k.target}${k.unit}`,
        status: k.status === "good" ? "مطلوب" : k.status === "warn" ? "هشدار" : k.status === "bad" ? "نامطلوب" : "بی‌داده",
      })),
    },
  ];

  if (input.alerts && input.alerts.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "هشدارهای زودهنگام", en: "Early warnings" },
      columns: [
        { key: "code", title: { fa: "کد", en: "Code" } },
        { key: "severity", title: { fa: "شدت", en: "Severity" }, align: "center" },
        { key: "title", title: { fa: "عنوان", en: "Title" }, weight: 2 },
        { key: "detail", title: { fa: "شرح", en: "Detail" }, weight: 4 },
      ],
      rows: input.alerts.map((a) => ({
        code: a.code,
        severity: a.severity === "high" ? "بالا" : a.severity === "medium" ? "متوسط" : "پایین",
        title: a.titleFa,
        detail: a.detailFa,
      })),
    });
  }

  return {
    code: "RPT-ENG-PRG",
    title: {
      fa: input.periodLabel ? `گزارش پیشرفت مهندسی — ${input.periodLabel}` : "گزارش ماهانه پیشرفت مهندسی",
      en: "Engineering Monthly Progress Report",
    },
    periodicity: "monthly",
    sourceModule: SRC,
    audiences: ["internal", "official"],
    sections,
  };
}

/* ── ۶. دفتر مدارک سازندگان ── */

export function buildVprReport(input: { rows: VendorPrintReview[]; asOf: string; summary?: VprSummary }): EngReportBody {
  const s = input.summary ?? vprSummary(input.rows, input.asOf);

  const sections: EngReportSection[] = [
    {
      kind: "kpi",
      title: { fa: "خلاصه مدارک سازندگان", en: "Vendor print summary" },
      cells: [
        { label: { fa: "کل مدرک", en: "Total" }, value: String(s.total) },
        { label: { fa: "در حال بررسی", en: "Under review" }, value: String(s.underReview) },
        { label: { fa: "تأیید ساخت", en: "Approved for mfg" }, value: String(s.approvedForMfg), tone: "good" },
        { label: { fa: "مردود", en: "Rejected" }, value: String(s.rejected), tone: s.rejected > 0 ? "warn" : "good" },
        { label: { fa: "از مهلت گذشته", en: "Overdue" }, value: String(s.overdue), tone: s.overdue > 0 ? "bad" : "good" },
        { label: { fa: "بدون سفارش خرید", en: "Unmapped to PO" }, value: String(s.unmappedToPo.length), tone: s.unmappedToPo.length > 0 ? "warn" : "good" },
      ],
    },
    {
      kind: "table",
      title: { fa: "دفتر مدارک فنی سازندگان", en: "Vendor print register" },
      note: { fa: "مدرک بدون نگاشت سفارش خرید قابل ردیابی مالی نیست.", en: "Documents without PO mapping are not financially traceable." },
      columns: [
        { key: "docNo", title: { fa: "شماره مدرک", en: "Doc no" }, weight: 2 },
        { key: "vendor", title: { fa: "سازنده", en: "Vendor" }, weight: 2 },
        { key: "title", title: { fa: "عنوان", en: "Title" }, weight: 3 },
        { key: "po", title: { fa: "سفارش خرید", en: "PO" } },
        { key: "tag", title: { fa: "تگ", en: "Tag" } },
        { key: "rev", title: { fa: "ریویژن", en: "Rev" }, align: "center" },
        { key: "received", title: { fa: "دریافت", en: "Received" }, format: "date", align: "center" },
        { key: "code", title: { fa: "کد بررسی", en: "Code" }, align: "center" },
        { key: "status", title: { fa: "وضعیت", en: "Status" } },
      ],
      rows: input.rows.map((v) => ({
        docNo: v.VendorDocNo,
        vendor: v.VendorName,
        title: v.TitleFa,
        po: dash(v.PoNo),
        tag: dash(v.TagNo),
        rev: v.RevCode,
        received: v.ReceivedAt,
        code: dash(v.ReviewCode),
        status: v.Status,
      })),
    },
  ];

  return {
    code: "RPT-ENG-VPR",
    title: { fa: "گزارش بررسی مدارک سازندگان", en: "Vendor Print Review Register" },
    periodicity: "weekly",
    sourceModule: SRC,
    audiences: ["internal"],
    sections,
  };
}

/* ── ۷. گزارش بین‌دیسیپلینی و تداخل ── */

export function buildIdcReport(input: {
  checks: SquadCheck[];
  clashes: InterfaceClashLog[];
  asOf: string;
  status?: IdcStatus[];
  clashSummaryData?: ClashSummary;
}): EngReportBody {
  const st = input.status ?? idcStatus(input.checks, input.asOf);
  const cs = input.clashSummaryData ?? clashSummary(input.clashes);

  return {
    code: "RPT-ENG-IDC",
    title: { fa: "گزارش بررسی بین‌دیسیپلینی و تداخل مدل", en: "IDC and Clash Report" },
    periodicity: "weekly",
    sourceModule: SRC,
    audiences: ["internal"],
    sections: [
      {
        kind: "kpi",
        title: { fa: "خلاصه هماهنگی", en: "Coordination summary" },
        cells: [
          { label: { fa: "ریویژن در گردش", en: "Revisions in IDC" }, value: String(st.length) },
          { label: { fa: "تکمیل‌شده", en: "Complete" }, value: String(st.filter((x) => x.complete).length), tone: "good" },
          { label: { fa: "دارای اعتراض", en: "With objection" }, value: String(st.filter((x) => x.objected > 0).length), tone: st.some((x) => x.objected > 0) ? "warn" : "good" },
          { label: { fa: "کل تداخل", en: "Total clashes" }, value: String(cs.total) },
          { label: { fa: "تداخل باز", en: "Open clashes" }, value: String(cs.open), tone: cs.open > 0 ? "bad" : "good" },
          { label: { fa: "نرخ رفع", en: "Resolution rate" }, value: `${cs.resolutionRate}٪`, tone: cs.resolutionRate >= 80 ? "good" : "warn" },
        ],
      },
      {
        kind: "table",
        title: { fa: "وضعیت بررسی بین‌دیسیپلینی", en: "Squad check status" },
        columns: [
          { key: "rev", title: { fa: "ریویژن", en: "Revision" }, weight: 2 },
          { key: "requested", title: { fa: "درخواست", en: "Requested" }, format: "number", align: "center" },
          { key: "cleared", title: { fa: "تأیید", en: "Cleared" }, format: "number", align: "center" },
          { key: "objected", title: { fa: "اعتراض", en: "Objected" }, format: "number", align: "center" },
          { key: "pending", title: { fa: "معلق", en: "Pending" }, format: "number", align: "center" },
          { key: "overdue", title: { fa: "دیسیپلین تأخیردار", en: "Overdue disciplines" }, weight: 3 },
        ],
        rows: st.map((x) => ({
          rev: x.revisionId,
          requested: x.requested,
          cleared: x.cleared,
          objected: x.objected,
          pending: x.pending,
          overdue: x.overdue.length ? x.overdue.map((d) => DISCIPLINE_FA[d as Discipline] ?? d).join("، ") : "—",
        })),
      },
      {
        kind: "table",
        title: { fa: "تداخل به تفکیک جفت دیسیپلین", en: "Clashes by discipline pair" },
        note: { fa: "مدل سه‌بعدی در سامانه رندر نمی‌شود؛ فقط خروجی ابزار تشخیص ثبت می‌گردد.", en: "3D models are not rendered; only detection tool output is logged." },
        columns: [
          { key: "pair", title: { fa: "جفت دیسیپلین", en: "Pair" }, weight: 3 },
          { key: "count", title: { fa: "تعداد", en: "Count" }, format: "number", align: "center" },
          { key: "open", title: { fa: "باز", en: "Open" }, format: "number", align: "center" },
        ],
        rows: cs.byPair.map((p) => ({
          pair: p.pair.split("↔").map((d) => DISCIPLINE_FA[d as Discipline] ?? d).join(" ↔ "),
          count: p.count,
          open: p.open,
        })),
      },
      {
        kind: "table",
        title: { fa: "فهرست تداخلات", en: "Clash log" },
        columns: [
          { key: "no", title: { fa: "شماره", en: "Clash no" } },
          { key: "tool", title: { fa: "ابزار", en: "Tool" } },
          { key: "a", title: { fa: "دیسیپلین الف", en: "Discipline A" } },
          { key: "b", title: { fa: "دیسیپلین ب", en: "Discipline B" } },
          { key: "zone", title: { fa: "ناحیه", en: "Zone" } },
          { key: "severity", title: { fa: "شدت", en: "Severity" }, align: "center" },
          { key: "status", title: { fa: "وضعیت", en: "Status" }, align: "center" },
          { key: "stage", title: { fa: "مرحله بازبینی", en: "Stage" }, align: "center" },
        ],
        rows: input.clashes.map((c) => ({
          no: c.ClashNo,
          tool: c.SourceTool,
          a: DISCIPLINE_FA[c.DisciplineA as Discipline] ?? c.DisciplineA,
          b: DISCIPLINE_FA[c.DisciplineB as Discipline] ?? c.DisciplineB,
          zone: dash(c.Zone),
          severity: c.Severity,
          status: c.Status,
          stage: c.ModelReviewStage ? `${c.ModelReviewStage}٪` : "—",
        })),
      },
    ],
  };
}

/* ── ارسال‌کنندهٔ یکپارچه ── */

export type EngReportInput = {
  deliverables: MdrDeliverable[];
  revisions: EngineeringRevision[];
  comments: CrsComment[];
  checks: SquadCheck[];
  clashes: InterfaceClashLog[];
  queries: TechnicalQuery[];
  vendorDocs: VendorPrintReview[];
  asOf: string;
  progress?: EngProgressResult;
  kpis?: EngKpi[];
  alerts?: EngAlert[];
  revisionId?: string | null;
  transmittalId?: string | null;
  periodLabel?: string;
  /* فقط گزارش مدیریتی از این‌ها استفاده می‌کند؛ نبودشان یعنی «هیچ فعالیتی
   * متصل نیست» نه «هیچ فعالیتی متوقف نیست» — تفاوتش در گزارش گفته می‌شود. */
  activities?: ActivityLike[];
  activityDocLinks?: { activityId: string; deliverableId: string }[];
  lockPlan?: IfcLockPlan;
  eotDrafts?: { extensionDays?: number }[];
};

/**
 * یک کد گزارش را به بدنهٔ کامل تبدیل می‌کند. کد ناشناخته null می‌دهد تا
 * لایهٔ REST بتواند ۴۰۴ برگرداند — استثنا پرتاب نمی‌شود.
 */
export function buildEngReport(code: string, input: EngReportInput): EngReportBody | null {
  const def = getEngReport(code);
  if (!def) return null;

  const revsByDel = new Map<string, EngineeringRevision[]>();
  for (const r of input.revisions) {
    const arr = revsByDel.get(r.DeliverableId) ?? [];
    arr.push(r);
    revsByDel.set(r.DeliverableId, arr);
  }
  const delById = new Map(input.deliverables.map((d) => [d.Id, d]));

  switch (code) {
    case "RPT-ENG-MDR":
      return buildMdrStatusReport({ deliverables: input.deliverables, revisionsByDeliverable: revsByDel });
    case "RPT-ENG-TRN":
      return buildTransmittalReport({ revisions: input.revisions, deliverableById: delById, transmittalId: input.transmittalId });
    case "RPT-ENG-CRS":
      return buildCrsReport({ comments: input.comments, revisionId: input.revisionId });
    case "RPT-ENG-TQF":
      return buildTqFcrReport({ queries: input.queries, asOf: input.asOf });
    case "RPT-ENG-PRG": {
      const progress = input.progress ?? engineeringProgress(
        input.deliverables.map((d) => ({ deliverable: d, revisions: revsByDel.get(d.Id) ?? [] })),
        input.asOf,
      );
      const aging = reviewAging(input.revisions.filter((r) => r.Purpose === "IFA"), input.asOf, delById);
      const kpis = input.kpis ?? engineeringKpis({
        progress, revisions: input.revisions, aging, queries: input.queries, deliverables: input.deliverables, asOf: input.asOf,
      });
      return buildProgressReport({ progress, kpis, alerts: input.alerts, periodLabel: input.periodLabel });
    }
    case "RPT-ENG-VPR":
      return buildVprReport({ rows: input.vendorDocs, asOf: input.asOf });
    case "RPT-ENG-IDC":
      return buildIdcReport({ checks: input.checks, clashes: input.clashes, asOf: input.asOf });
    case "RPT-ENG-EXEC": {
      /* همان مسیر محاسبهٔ گزارش پیشرفت تا دو گزارش دو عدد ندهند (ADR-ENG-16). */
      const progress = input.progress ?? engineeringProgress(
        input.deliverables.map((d) => ({ deliverable: d, revisions: revsByDel.get(d.Id) ?? [] })),
        input.asOf,
      );
      const aging = reviewAging(input.revisions.filter((r) => r.Purpose === "IFA"), input.asOf, delById);
      const kpis = input.kpis ?? engineeringKpis({
        progress, revisions: input.revisions, aging, queries: input.queries, deliverables: input.deliverables, asOf: input.asOf,
      });
      const lockPlan = input.lockPlan ?? planIfcLocks({
        activities: input.activities ?? [],
        activityDocLinks: input.activityDocLinks ?? [],
        deliverables: input.deliverables,
        revisions: input.revisions,
      });
      const alerts = input.alerts ?? engineeringAlerts({
        aging, revisionsByDeliverable: revsByDel, queries: input.queries, lockPlan, kpis, asOf: input.asOf,
      });
      /* ادعای قابل مطالبه باید با همان قاعده‌ای شمرده شود که اندپوینت
       * پیش‌نویس ادعا به کار می‌برد؛ وگرنه گزارش مدیرعامل عددی می‌دهد که
       * در عمل قابل مطالبه نیست. آستانهٔ هشت روز اینجا هم اعمال می‌شود. */
      const eot = input.eotDrafts ?? planEotClaims({ aging, deliverableById: delById }).drafts;
      return buildExecutiveReport({
        progress, kpis, alerts, aging, queries: input.queries, lockPlan,
        eotDrafts: eot, asOf: input.asOf, periodLabel: input.periodLabel,
      });
    }
    default:
      return null;
  }
}

/* ── ۸. گزارش تک‌صفحه‌ای مدیرعامل ── */

/**
 * گزارش یک‌برگی برای تصمیم‌گیر ارشد.
 *
 * تفاوت آن با گزارش پیشرفت ماهانه در حذف است نه در افزودن: مدیرعامل
 * فهرست مدارک نمی‌خواهد، می‌خواهد بداند «آیا مهندسی جلوی ساخت را گرفته،
 * چقدر ادعای قابل مطالبه داریم، و کدام سه قلم امروز تصمیم می‌خواهد».
 * پس هیچ جدول ردیف‌به‌ردیفی ندارد و همه‌چیز در یک صفحهٔ A4 جا می‌شود.
 *
 * ADR-ENG-16: عددی که اینجا می‌آید هیچ‌گاه در این تابع محاسبه نمی‌شود؛
 * همه از همان توابعی می‌آید که گزارش‌های تفصیلی مصرف می‌کنند، وگرنه دو
 * گزارش از یک سامانه دو عدد متفاوت می‌دهند.
 */
export function buildExecutiveReport(input: {
  progress: EngProgressResult;
  kpis: EngKpi[];
  alerts: EngAlert[];
  aging: ReviewAging[];
  queries: TechnicalQuery[];
  lockPlan: IfcLockPlan;
  eotDrafts?: { extensionDays?: number }[];
  asOf: string;
  periodLabel?: string;
}): EngReportBody {
  const p = input.progress;
  const variance = round(p.actualPct - p.plannedPct, 2);

  /* ── قضاوت کلی: سه حالت، نه یک عدد خام ── */
  const critical = input.alerts.filter((a) => a.severity === "high").length;
  const verdict =
    p.spi !== null && p.spi < 0.85
      ? { fa: "نیازمند مداخلهٔ فوری", tone: "bad" as const }
      : critical > 0 || (p.spi !== null && p.spi < 0.95)
        ? { fa: "نیازمند توجه مدیریتی", tone: "warn" as const }
        : { fa: "در مسیر برنامه", tone: "good" as const };

  /* ── اثر مهندسی بر ساخت: تنها عددی که مدیرعامل بی‌درنگ می‌فهمد ── */
  const blockedActivities = input.lockPlan.lock.length;

  /* ── ادعای قابل مطالبه از تأخیر بررسی کارفرما ── */
  /* «قابل مطالبه» یعنی گذشته از آستانهٔ قراردادی، نه هر تأخیری. جمع خام
   * روزهای تأخیر عددی بزرگ‌تر و غیرقابل دفاع می‌دهد، پس اگر پیش‌نویس ادعا
   * در دست باشد همان مبناست. */
  const claimableDays = (input.eotDrafts ?? []).reduce((sum, d) => sum + Number(d.extensionDays ?? 0), 0);

  /* ── اثر مالی و زمانی استعلام‌های باز ── */
  const openQueries = input.queries.filter((q) => q.Status !== "closed" && q.Status !== "answered");
  const queryCost = openQueries.reduce((sum, q) => sum + Number(q.CostImpact ?? 0), 0);
  const queryDays = openQueries.reduce((sum, q) => sum + Number(q.TimeImpactDays ?? 0), 0);

  const sections: EngReportSection[] = [
    {
      kind: "kpi",
      title: { fa: "قضاوت کلی", en: "Overall verdict" },
      cells: [
        { label: { fa: "وضعیت مهندسی", en: "Status" }, value: verdict.fa, tone: verdict.tone },
        {
          label: { fa: "پیشرفت واقعی", en: "Actual" },
          value: `${p.actualPct}٪`,
          tone: variance >= 0 ? "good" : variance >= -5 ? "warn" : "bad",
        },
        { label: { fa: "انحراف از برنامه", en: "Variance" }, value: `${variance}٪`, tone: variance >= 0 ? "good" : "bad" },
        {
          label: { fa: "SPI مهندسی", en: "SPI" },
          value: p.spi === null ? "—" : String(p.spi),
          tone: p.spi === null ? undefined : p.spi >= 0.95 ? "good" : p.spi >= 0.85 ? "warn" : "bad",
        },
      ],
    },
    {
      kind: "kpi",
      title: { fa: "اثر بر اجرا و قرارداد", en: "Impact on execution and contract" },
      cells: [
        {
          label: { fa: "فعالیت متوقف بابت نبود مدرک", en: "Activities blocked" },
          value: String(blockedActivities),
          tone: blockedActivities === 0 ? "good" : blockedActivities > 5 ? "bad" : "warn",
        },
        {
          label: { fa: "روز قابل مطالبه از کارفرما", en: "Claimable days" },
          value: String(claimableDays),
          tone: claimableDays === 0 ? "good" : "warn",
        },
        {
          label: { fa: "اثر هزینه‌ای استعلام باز", en: "Open query cost" },
          value: queryCost ? queryCost.toLocaleString("fa-IR") : "—",
          tone: queryCost > 0 ? "warn" : "good",
        },
        {
          label: { fa: "اثر زمانی استعلام باز", en: "Open query days" },
          value: queryDays ? `${queryDays} روز` : "—",
          tone: queryDays > 0 ? "warn" : "good",
        },
      ],
    },
  ];

  /* ── سه قلم نیازمند تصمیم: مرتب‌شده بر اساس شدت، حداکثر سه تا ── */
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const decisions = [...input.alerts]
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .slice(0, 3);

  if (decisions.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "نیازمند تصمیم", en: "Requires decision" },
      note: {
        fa: "سه قلم با بالاترین شدت؛ فهرست کامل در گزارش پیشرفت ماهانه است.",
        en: "Top three by severity; full list in the monthly progress report.",
      },
      columns: [
        { key: "severity", title: { fa: "شدت", en: "Severity" }, align: "center" },
        { key: "title", title: { fa: "موضوع", en: "Subject" }, weight: 2 },
        { key: "detail", title: { fa: "شرح", en: "Detail" }, weight: 4 },
      ],
      rows: decisions.map((a) => ({
        severity: a.severity === "high" ? "بالا" : a.severity === "medium" ? "متوسط" : "پایین",
        title: a.titleFa,
        detail: a.detailFa,
      })),
    });
  }

  /* ── دیسیپلین‌های عقب‌مانده: فقط آن‌هایی که واقعاً عقب‌اند ── */
  const lagging = p.byDiscipline
    .map((d) => ({ ...d, variance: round(d.actualPct - d.plannedPct, 2) }))
    .filter((d) => d.variance < 0)
    .sort((a, b) => a.variance - b.variance)
    .slice(0, 5);

  if (lagging.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "دیسیپلین‌های عقب از برنامه", en: "Lagging disciplines" },
      columns: [
        { key: "discipline", title: { fa: "دیسیپلین", en: "Discipline" }, weight: 2 },
        { key: "weight", title: { fa: "وزن", en: "Weight" }, format: "number", align: "center" },
        { key: "planned", title: { fa: "برنامه", en: "Planned" }, format: "percent", align: "center" },
        { key: "actual", title: { fa: "واقعی", en: "Actual" }, format: "percent", align: "center" },
        { key: "variance", title: { fa: "انحراف", en: "Variance" }, format: "percent", align: "center" },
      ],
      rows: lagging.map((d) => ({
        discipline: DISCIPLINE_FA[d.discipline as Discipline] ?? d.discipline,
        weight: d.weight,
        planned: d.plannedPct,
        actual: d.actualPct,
        variance: d.variance,
      })),
    });
  } else {
    sections.push({
      kind: "text",
      title: { fa: "دیسیپلین‌های عقب از برنامه", en: "Lagging disciplines" },
      body: { fa: "هیچ دیسیپلینی عقب از برنامه نیست.", en: "No discipline is behind plan." },
    });
  }

  return {
    code: "RPT-ENG-EXEC",
    title: {
      fa: input.periodLabel ? `گزارش مدیریتی مهندسی — ${input.periodLabel}` : "گزارش تک‌صفحه‌ای مدیریتی مهندسی",
      en: "Engineering Executive Summary",
    },
    periodicity: "monthly",
    sourceModule: SRC,
    /* فقط داخلی: شامل برآورد ادعای قابل مطالبه است و ارسال آن به کارفرما
     * موضع قراردادی را پیش از طرح رسمی ادعا فاش می‌کند. */
    audiences: ["internal"],
    sections,
  };
}

/** فراداده گزارش برای لایهٔ ارائه، بدون ساخت بدنه. */
export function engReportMeta(code: string): { def: EngReportDef; periodicity: EngReportBody["periodicity"] } | null {
  const def = getEngReport(code);
  return def ? { def, periodicity: toRptPeriodicity(def.periodicity) } : null;
}

/* ══════════════════ ۱۲.۹ — بستن شکاف‌های شناسایی‌شده ══════════════════
 *
 * این بلوک شکاف‌های ماتریس بخش ۲ سند تحویل نهایی را می‌بندد. اصل راهنما:
 * هیچ جدول تازه‌ای ساخته نمی‌شود اگر جدول مقصد از قبل وجود دارد. سه مقصد
 * `KpiSnapshot` و `Claim` و `EngineeringProgressSnapshot` از قبل ساخته
 * شده‌اند و فقط نویسنده نداشتند.
 */

/* ── شکاف ۲ (High): فعالیت بدون WbsId بی‌صدا از محافظ IFC عبور می‌کند ──
 *
 * خطرناک‌تر از نبود محافظ است، چون اعتماد کاذب می‌سازد: کاربر می‌بیند
 * «قفل: ۰» و نتیجه می‌گیرد همه‌چیز آزاد است، در حالی که ممکن است ده‌ها
 * فعالیت ساخت اصلاً وارد محاسبه نشده باشند.
 */

export type UnmappedActivity = {
  activityId: string;
  code: string | null;
  nameFa: string | null;
  reasonFa: string;
};

export type IfcCoverage = {
  totalActivities: number;
  mappedActivities: number;
  unmappedActivities: number;
  coveragePct: number | null;
  unmapped: UnmappedActivity[];
};

/**
 * پوشش نگاشت فعالیت↔مدرک را می‌سنجد تا شکاف محافظ IFC دیده شود.
 *
 * فعالیتی که واقعاً شروع شده از شمارش کنار می‌رود: قفل گذشته بی‌معناست و
 * گزارش کردنش فقط نوفه می‌سازد (همان منطق planIfcLocks).
 */
export function ifcLockCoverage(input: {
  activities: ActivityLike[];
  activityDocLinks: { activityId: string; deliverableId: string }[];
  onlyNotStarted?: boolean;
}): IfcCoverage {
  const onlyNotStarted = input.onlyNotStarted !== false;
  const linked = new Set(input.activityDocLinks.map((l) => l.activityId));
  const scope = onlyNotStarted ? input.activities.filter((a) => !a.ActualStart) : input.activities;

  const unmapped: UnmappedActivity[] = [];
  for (const a of scope) {
    if (linked.has(a.Id)) continue;
    unmapped.push({
      activityId: a.Id,
      code: a.Code ?? null,
      nameFa: a.NameFa ?? null,
      reasonFa: "فعالیت به هیچ مدرکی نگاشت نشده؛ محافظ IFC روی آن اعمال نمی‌شود",
    });
  }

  const total = scope.length;
  const mapped = total - unmapped.length;
  return {
    totalActivities: total,
    mappedActivities: mapped,
    unmappedActivities: unmapped.length,
    coveragePct: total === 0 ? null : round((mapped / total) * 100, 2),
    unmapped,
  };
}

/* ── شکاف ۱ (High): تزریق شاخص به KpiSnapshot ──
 *
 * جدول مقصد با کلید یکتای (ProjectId, KpiCode, PeriodCode) از قبل هست.
 * قاعدهٔ حیاتی: شاخص بدون داده باید null بماند. تبدیلش به صفر «صفر واقعی»
 * را جعل می‌کند و داشبورد حاکمیتی را گمراه می‌سازد.
 */

export type KpiSnapshotRow = {
  ProjectId: string;
  KpiCode: string;
  PeriodCode: string;
  Value: number | null;
  Target: number | null;
  Status: string;
};

/** کد دورهٔ ماهانه از تاریخ میلادی — «۲۰۲۶-۰۶» با ارقام لاتین برای کلید پایدار. */
export function periodCodeOf(asOf: string): string {
  const s = String(asOf ?? "");
  return s.length >= 7 ? s.slice(0, 7) : s;
}

export function engKpiSnapshots(kpis: EngKpi[], projectId: string, periodCode: string): KpiSnapshotRow[] {
  return kpis.map((k) => ({
    ProjectId: projectId,
    KpiCode: k.code,
    PeriodCode: periodCode,
    Value: k.value,
    Target: k.target ?? null,
    Status: k.status,
  }));
}

/* ── شکاف ۹ (Medium): snapshot دوره‌ای پیشرفت ──
 *
 * جدول EngineeringProgressSnapshot ساخته شده ولی خالی مانده بود. بدون سری
 * زمانی ذخیره‌شده، S-Curve و تحلیل روند غیرممکن است — و گذشته را نمی‌توان
 * بازسازی کرد، پس ثبت باید از روز اول شروع شود.
 */

export type ProgressSnapshotRow = {
  ProjectId: string;
  PeriodCode: string;
  Discipline: string;
  PlannedPct: number | null;
  ActualPct: number | null;
  EarnedWeight: number | null;
  SpiEng: number | null;
  DeliverableCount: number;
  IfcIssuedCount: number;
  OpenCommentCount: number;
  SnapshotAt: string;
};

/**
 * عکس دوره‌ای پیشرفت به تفکیک دیسیپلین، به‌علاوهٔ یک ردیف تجمعی «ALL».
 *
 * ردیف ALL عمداً جدا ثبت می‌شود نه محاسبه‌شده در زمان خواندن: اگر بعداً
 * تعریف وزن‌ها عوض شود، عدد تاریخی نباید بازنویسی گردد.
 */
export function engProgressSnapshots(input: {
  projectId: string;
  progress: EngProgressResult;
  deliverables: MdrDeliverable[];
  revisions: EngineeringRevision[];
  comments: CrsComment[];
  asOf: string;
  periodCode?: string;
}): ProgressSnapshotRow[] {
  const period = input.periodCode ?? periodCodeOf(input.asOf);

  const ifcByDel = new Set(
    input.revisions.filter((r) => r.Purpose === "IFC").map((r) => r.DeliverableId),
  );
  const openComments = input.comments.filter((c) => c.ResponseStatus !== "agreed");

  const delByDiscipline = new Map<string, MdrDeliverable[]>();
  for (const d of input.deliverables) {
    const arr = delByDiscipline.get(d.Discipline) ?? [];
    arr.push(d);
    delByDiscipline.set(d.Discipline, arr);
  }

  /* نظر باز به دیسیپلین مدرکش نسبت داده می‌شود؛ نظر یتیم در ALL می‌ماند. */
  const delById = new Map(input.deliverables.map((d) => [d.Id, d]));
  const revById = new Map(input.revisions.map((r) => [r.Id, r]));
  const openByDiscipline = new Map<string, number>();
  for (const c of openComments) {
    const rev = revById.get(c.RevisionId);
    const del = rev ? delById.get(rev.DeliverableId) : undefined;
    if (!del) continue;
    openByDiscipline.set(del.Discipline, (openByDiscipline.get(del.Discipline) ?? 0) + 1);
  }

  const rows: ProgressSnapshotRow[] = [];

  for (const byDis of input.progress.byDiscipline) {
    const dels = delByDiscipline.get(byDis.discipline) ?? [];
    /* byDiscipline وزن و درصد می‌دهد؛ ارزش کسب‌شده و SPI اینجا مشتق می‌شوند.
     * SPI در نبودِ برنامهٔ مثبت null است، نه صفر و نه بی‌نهایت (درس EQP). */
    const earned = round((byDis.weight * byDis.actualPct) / 100, 4);
    const planned = round((byDis.weight * byDis.plannedPct) / 100, 4);
    rows.push({
      ProjectId: input.projectId,
      PeriodCode: period,
      Discipline: byDis.discipline,
      PlannedPct: byDis.plannedPct,
      ActualPct: byDis.actualPct,
      EarnedWeight: earned,
      SpiEng: planned > 0 ? round(earned / planned, 4) : null,
      DeliverableCount: dels.length,
      IfcIssuedCount: dels.filter((d) => ifcByDel.has(d.Id)).length,
      OpenCommentCount: openByDiscipline.get(byDis.discipline) ?? 0,
      SnapshotAt: input.asOf,
    });
  }

  rows.push({
    ProjectId: input.projectId,
    PeriodCode: period,
    Discipline: "ALL",
    PlannedPct: input.progress.plannedPct,
    ActualPct: input.progress.actualPct,
    EarnedWeight: input.progress.earnedWeight,
    SpiEng: input.progress.spi,
    DeliverableCount: input.deliverables.length,
    IfcIssuedCount: ifcByDel.size,
    OpenCommentCount: openComments.length,
    SnapshotAt: input.asOf,
  });

  return rows;
}

/* ── شکاف ۴ (High): تأخیر بررسی کارفرما → پیش‌نویس ادعای EOT ──
 *
 * دادهٔ لازم از قبل محاسبه می‌شد (reviewAging) اما به دارایی قراردادی تبدیل
 * نمی‌شد. ADR-ENG-11: ادعا فقط «پیش‌نویس» ساخته می‌شود و تأیید انسانی لازم
 * دارد — ثبت خودکار ادعا علیه کارفرما تصمیم حقوقی است نه محاسباتی.
 */

export type EotClaimDraft = {
  code: string;
  revisionId: string;
  deliverableId: string;
  docNo: string;
  titleFa: string;
  noticeDate: string;
  overdueDays: number;
  extensionDays: number;
  severity: "info" | "medium" | "high" | "critical";
  evidenceFa: string;
};

export type EotClaimPlan = {
  drafts: EotClaimDraft[];
  skippedOnTime: string[];
  skippedBelowThreshold: string[];
  /** ردیف بدون سررسید معتبر؛ ادعا بدون مبنای تاریخ قابل دفاع نیست. */
  skippedNoDueDate: string[];
  totalExtensionDays: number;
};

/** ماتریس تشدید تأخیر بررسی — مطابق بخش ۳-و سند تحویل. */
export function eotSeverity(overdueDays: number): EotClaimDraft["severity"] {
  if (overdueDays > 30) return "critical";
  if (overdueDays >= 15) return "high";
  if (overdueDays >= 8) return "medium";
  return "info";
}

/**
 * پیش‌نویس ادعای تمدید زمان از ردیف‌های معوق بررسی.
 *
 * آستانه پیش‌فرض ۸ روز است نه ۱ روز: ادعا برای یک روز تأخیر رابطهٔ کاری را
 * می‌سوزاند بی‌آنکه ارزش قراردادی معناداری بسازد. آستانه پارامتری است چون
 * قراردادها متفاوت‌اند.
 *
 * کد ادعا ایدمپوتنت است (`EOT-ENG-${revisionId}`) تا اجرای مکرر ادعای
 * تکراری نسازد — همان الگوی اثبات‌شدهٔ planChangeRequests.
 */
export function planEotClaims(input: {
  aging: ReviewAging[];
  deliverableById?: Map<string, MdrDeliverable>;
  minOverdueDays?: number;
  contractReviewDays?: number;
}): EotClaimPlan {
  const threshold = input.minOverdueDays ?? 8;
  const contractDays = input.contractReviewDays ?? DEFAULT_CONTRACT_REVIEW_DAYS;
  const delById = input.deliverableById ?? new Map<string, MdrDeliverable>();

  const drafts: EotClaimDraft[] = [];
  const skippedOnTime: string[] = [];
  const skippedBelowThreshold: string[] = [];
  const skippedNoDueDate: string[] = [];

  for (const a of input.aging) {
    const over = a.overdueDays;
    if (over === null || over <= 0) {
      skippedOnTime.push(a.revisionId);
      continue;
    }
    if (over < threshold) {
      skippedBelowThreshold.push(a.revisionId);
      continue;
    }
    /* سررسید مبنای حقوقی ادعاست. بدون آن، «تأخیر» عددی بی‌پشتوانه است و
     * جایگزین کردنش با تاریخ ساختگی ادعا را در داوری بی‌اعتبار می‌کند. */
    if (!a.dueAt) {
      skippedNoDueDate.push(a.revisionId);
      continue;
    }

    const d = delById.get(a.deliverableId);
    const docNo = d?.DocNo ?? a.deliverableId;
    drafts.push({
      code: `EOT-ENG-${a.revisionId}`,
      revisionId: a.revisionId,
      deliverableId: a.deliverableId,
      docNo,
      titleFa: `تأخیر بررسی کارفرما — مدرک ${docNo}`,
      noticeDate: a.dueAt,
      overdueDays: over,
      /* روزهای تمدید برابر تأخیر خالص است؛ اثر شبکه‌ای بر مسیر بحرانی در
       * ماژول برنامه‌ریزی سنجیده می‌شود، نه اینجا. */
      extensionDays: over,
      severity: eotSeverity(over),
      evidenceFa:
        `مدرک ${docNo} در ${a.issuedAt} ارسال شد؛ مهلت قراردادی ${contractDays} روز و سررسید ${a.dueAt} بود. ` +
        `تأخیر ثبت‌شده ${over} روز است.`,
    });
  }

  drafts.sort((x, y) => y.overdueDays - x.overdueDays);
  return {
    drafts,
    skippedOnTime,
    skippedBelowThreshold,
    skippedNoDueDate,
    totalExtensionDays: drafts.reduce((s, d) => s + d.extensionDays, 0),
  };
}

/* ── شکاف ۵ (Medium): Design NCR از QMS → اصلاح مدرک ──
 *
 * جدول عام `Ncr` در d8 وجود دارد. به‌جای ساخت جدول موازی، عدم‌انطباق‌های
 * طراحی از همان جدول خوانده و به استعلام فنی از نوع DCN نگاشت می‌شوند.
 * ADR-ENG-12: منبع حقیقت عدم‌انطباق نزد QMS می‌ماند؛ ENG فقط اقدام اصلاحی
 * مدرک را می‌سازد.
 */

export type NcrLike = {
  Id: string;
  ProjectId: string;
  Code: string;
  TitleFa: string;
  Severity?: string | null;
  Discipline?: string | null;
  RaisedBy?: string | null;
  RaisedAt: string;
  DueAt?: string | null;
  Status: string;
  Disposition?: string | null;
};

export type DesignNcrDraft = {
  code: string;
  ncrId: string;
  ncrCode: string;
  titleFa: string;
  discipline: string;
  raisedAt: string;
  dueAt: string | null;
  deliverableId: string | null;
  docNo: string | null;
  severity: string;
  reasonFa: string;
};

export type DesignNcrPlan = {
  drafts: DesignNcrDraft[];
  skippedClosed: string[];
  skippedNotDesign: string[];
  unmatchedDiscipline: string[];
};

/** آیا عدم‌انطباق منشأ طراحی دارد؟ مبنا: کد، عنوان یا تعیین‌تکلیف. */
function isDesignNcr(n: NcrLike): boolean {
  const hay = `${n.Code} ${n.TitleFa} ${n.Disposition ?? ""}`.toLowerCase();
  if (/design|طراح|نقشه|مدرک|مهندس/.test(hay)) return true;
  return /^ncr-(eng|dsg)/i.test(n.Code);
}

/**
 * از عدم‌انطباق‌های طراحیِ باز، پیش‌نویس اعلان تغییر مدرک (DCN) می‌سازد.
 *
 * نگاشت به مدرک از راه دیسیپلین انجام می‌شود و وقتی چند مدرک هم‌دیسیپلین
 * باشند عمداً هیچ‌کدام انتخاب نمی‌شود: حدس زدن مدرک هدف بدتر از خالی
 * گذاشتن آن است، چون اصلاح را روی مدرک اشتباه می‌نشاند.
 */
export function planDesignNcrActions(input: {
  ncrs: NcrLike[];
  deliverables: MdrDeliverable[];
  existingQueries?: TechnicalQuery[];
}): DesignNcrPlan {
  const existing = new Set((input.existingQueries ?? []).map((q) => q.Code));

  const byDiscipline = new Map<string, MdrDeliverable[]>();
  for (const d of input.deliverables) {
    const arr = byDiscipline.get(d.Discipline) ?? [];
    arr.push(d);
    byDiscipline.set(d.Discipline, arr);
  }

  const drafts: DesignNcrDraft[] = [];
  const skippedClosed: string[] = [];
  const skippedNotDesign: string[] = [];
  const unmatchedDiscipline: string[] = [];

  for (const n of input.ncrs) {
    if (!isDesignNcr(n)) {
      skippedNotDesign.push(n.Code);
      continue;
    }
    if (n.Status === "closed" || n.Status === "cancelled") {
      skippedClosed.push(n.Code);
      continue;
    }

    const code = `DCN-${n.Code}`;
    if (existing.has(code)) continue;

    const dis = n.Discipline ?? "";
    const candidates = byDiscipline.get(dis) ?? [];
    const target = candidates.length === 1 ? candidates[0] : null;
    if (!target && dis) unmatchedDiscipline.push(n.Code);

    drafts.push({
      code,
      ncrId: n.Id,
      ncrCode: n.Code,
      titleFa: `اصلاح مدرک بر پایهٔ عدم‌انطباق ${n.Code} — ${n.TitleFa}`,
      discipline: dis || "general",
      raisedAt: n.RaisedAt,
      dueAt: n.DueAt ?? null,
      deliverableId: target?.Id ?? null,
      docNo: target?.DocNo ?? null,
      severity: n.Severity ?? "major",
      reasonFa: target
        ? `عدم‌انطباق طراحی به مدرک ${target.DocNo} نسبت داده شد`
        : `مدرک هدف تعیین نشد؛ ${candidates.length} مدرک هم‌دیسیپلین یافت شد و انتخاب خودکار ایمن نیست`,
    });
  }

  return { drafts, skippedClosed, skippedNotDesign, unmatchedDiscipline };
}

/* ── شکاف ۷ (Medium): ارجاع PoNo بدون کلید خارجی ──
 *
 * ADR-ENG-13: کلید نرم آگاهانه انتخاب شد تا دامنه‌ها به هم سخت گره نخورند،
 * ولی بهایش این است که صحت ارجاع باید در لایهٔ کاربرد بررسی شود. این تابع
 * همان بررسی است.
 */

export type PoRefIssue = {
  vendorDocNo: string;
  revCode: string;
  poNo: string | null;
  code: "E-ENG-PO-MISSING" | "E-ENG-PO-ORPHAN";
  messageFa: string;
};

export type PoRefAudit = {
  total: number;
  linked: number;
  missing: number;
  orphan: number;
  issues: PoRefIssue[];
};

/**
 * صحت ارجاع مدارک سازنده به سفارش خرید را می‌سنجد.
 *
 * وقتی فهرست سفارش‌های معتبر داده نشود، فقط نبود ارجاع گزارش می‌شود و
 * ارجاع یتیم بررسی نمی‌گردد — چون بدون مرجع، هر شماره‌ای «نامعتبر» به نظر
 * می‌رسد و هشدار کاذب می‌سازد.
 */
export function auditVendorPoRefs(input: {
  vendorDocs: VendorPrintReview[];
  knownPoNumbers?: string[] | null;
}): PoRefAudit {
  const known = input.knownPoNumbers ? new Set(input.knownPoNumbers.map((p) => String(p).trim())) : null;
  const issues: PoRefIssue[] = [];
  let linked = 0;

  for (const v of input.vendorDocs) {
    const po = v.PoNo ? String(v.PoNo).trim() : "";
    if (!po) {
      issues.push({
        vendorDocNo: v.VendorDocNo,
        revCode: v.RevCode,
        poNo: null,
        code: "E-ENG-PO-MISSING",
        messageFa: `مدرک ${v.VendorDocNo} به هیچ سفارش خریدی ارجاع ندارد`,
      });
      continue;
    }
    if (known && !known.has(po)) {
      issues.push({
        vendorDocNo: v.VendorDocNo,
        revCode: v.RevCode,
        poNo: po,
        code: "E-ENG-PO-ORPHAN",
        messageFa: `سفارش خرید ${po} در ماژول مالی یافت نشد`,
      });
      continue;
    }
    linked++;
  }

  return {
    total: input.vendorDocs.length,
    linked,
    missing: issues.filter((i) => i.code === "E-ENG-PO-MISSING").length,
    orphan: issues.filter((i) => i.code === "E-ENG-PO-ORPHAN").length,
    issues,
  };
}

/* ── شکاف ۱۱ (Medium): Activity.RocCode خالی است ──
 *
 * بدون کد پله، پیشرفت مهندسی به فعالیت زمان‌بندی نمی‌چسبد و ماژول
 * برنامه‌ریزی نمی‌داند این فعالیت به کدام مرحلهٔ مدرک وابسته است.
 */

export type RocBackfillRow = {
  activityId: string;
  code: string | null;
  deliverableId: string;
  docNo: string;
  currentRocCode: string | null;
  suggestedRocCode: string;
  reachedPct: number;
};

export function planRocBackfill(input: {
  activities: ActivityLike[];
  activityDocLinks: { activityId: string; deliverableId: string }[];
  deliverables: MdrDeliverable[];
  revisions: EngineeringRevision[];
}): { rows: RocBackfillRow[]; alreadySet: number; unlinked: number } {
  const delById = new Map(input.deliverables.map((d) => [d.Id, d]));
  const linkByActivity = new Map(input.activityDocLinks.map((l) => [l.activityId, l.deliverableId]));

  const revsByDel = new Map<string, EngineeringRevision[]>();
  for (const r of input.revisions) {
    const arr = revsByDel.get(r.DeliverableId) ?? [];
    arr.push(r);
    revsByDel.set(r.DeliverableId, arr);
  }

  const rows: RocBackfillRow[] = [];
  let alreadySet = 0;
  let unlinked = 0;

  for (const a of input.activities) {
    const delId = linkByActivity.get(a.Id);
    if (!delId) {
      unlinked++;
      continue;
    }
    const current = (a as ActivityLike & { RocCode?: string | null }).RocCode ?? null;
    if (current) {
      alreadySet++;
      continue;
    }
    const d = delById.get(delId);
    const prog = deliverableProgress(revsByDel.get(delId) ?? []);

    rows.push({
      activityId: a.Id,
      code: a.Code ?? null,
      deliverableId: delId,
      docNo: d?.DocNo ?? delId,
      currentRocCode: null,
      /* بالاترین پلهٔ رسیدهٔ مدرک، کد پیشنهادی فعالیت وابسته است. */
      suggestedRocCode: prog.step,
      reachedPct: prog.pct,
    });
  }

  return { rows, alreadySet, unlinked };
}

/* ══════════════════ ۱۲.۱۰ — چرخهٔ تدارکات مهندسی (شکاف ۳) ══════════════════
 *
 * ADR-ENG-14: مرز مالکیت صریح است. مهندسی می‌گوید «چه چیزی لازم است و کِی»؛
 * مالی می‌گوید «از که و به چه قیمت». پس `MaterialRequest` در d12 می‌ماند
 * (منشأ آن مدرک IFC است) و `PurchaseRequisition`/`PurchaseOrder` در d5
 * (کنترل بودجه و تعهد مالی آنجاست). پیوند با کلید نرم برقرار می‌شود.
 *
 * ADR-ENG-15: درخواست کالا فقط از مدرک **IFC-شده** ساخته می‌شود. سفارش کالا
 * بر پایهٔ نقشهٔ تأییدنشده، همان اشتباهی است که کل محافظ IFC برای جلوگیری از
 * آن ساخته شد — با این تفاوت که خسارتش به‌جای دوباره‌کاری ساخت، پول است.
 */

export type MaterialRequest = {
  Id: string;
  ProjectId: string;
  Code: string;
  TitleFa: string;
  Discipline: string;
  DeliverableId?: string | null;
  DocNo?: string | null;
  ItemCode?: string | null;
  Quantity?: number | null;
  Unit?: string | null;
  LeadTimeDays?: number | null;
  NeedByDate?: string | null;
  ReleaseByDate?: string | null;
  RaisedBy: string;
  RaisedAt: string;
  Status: string;
  LinkedPrCode?: string | null;
  RemarksFa?: string | null;
};

export type MrDraft = {
  code: string;
  deliverableId: string;
  docNo: string;
  titleFa: string;
  discipline: string;
  leadTimeDays: number;
  needByDate: string | null;
  releaseByDate: string | null;
  raisedAt: string;
  reasonFa: string;
};

export type MrPlan = {
  drafts: MrDraft[];
  skippedNotIfc: string[];
  skippedExisting: string[];
  skippedNoActivity: string[];
};

/** مهلت پیش‌فرض تدارک به تفکیک دیسیپلین (روز) — مبنای تاریخ آزادسازی سفارش. */
export const DEFAULT_LEAD_TIME_DAYS: Record<string, number> = {
  process: 90,
  mechanical: 120,
  piping: 90,
  civil: 45,
  structural: 60,
  electrical: 105,
  instrument: 120,
};

export const DEFAULT_PROCUREMENT_BUFFER_DAYS = 14;

/** تاریخ آزادسازی سفارش = تاریخ نیاز منهای مهلت تدارک و حاشیهٔ اطمینان. */
export function procurementReleaseDate(needBy: string, leadTimeDays: number, bufferDays = DEFAULT_PROCUREMENT_BUFFER_DAYS): string {
  return addDays(needBy, -(leadTimeDays + bufferDays)) ?? needBy;
}

/**
 * از مدارک IFC-شده پیش‌نویس درخواست کالا می‌سازد.
 *
 * تاریخ نیاز از شروع برنامه‌ای فعالیت وابسته می‌آید نه از تاریخ مدرک: کالا
 * باید پیش از **ساخت** برسد، و مدرک ممکن است ماه‌ها زودتر صادر شده باشد.
 * فعالیتی که تاریخ برنامه‌ای ندارد کنار می‌رود، چون تاریخ نیاز حدسی
 * بدتر از نبود آن است — سفارش زودهنگام پول را می‌خواباند و دیرهنگام
 * کارگاه را می‌خواباند.
 *
 * کد ایدمپوتنت `MR-${DocNo}` است تا اجرای مکرر درخواست تکراری نسازد.
 */
export function planMaterialRequests(input: {
  deliverables: MdrDeliverable[];
  revisions: EngineeringRevision[];
  activities?: ActivityLike[];
  activityDocLinks?: { activityId: string; deliverableId: string }[];
  existingRequests?: MaterialRequest[];
  leadTimeByDiscipline?: Record<string, number>;
  bufferDays?: number;
  requireDocument?: boolean;
}): MrPlan {
  const requireDoc = input.requireDocument !== false;
  const leadTimes = { ...DEFAULT_LEAD_TIME_DAYS, ...(input.leadTimeByDiscipline ?? {}) };
  const buffer = input.bufferDays ?? DEFAULT_PROCUREMENT_BUFFER_DAYS;
  const existing = new Set((input.existingRequests ?? []).map((m) => m.Code));

  const ifcByDel = new Set(
    input.revisions
      .filter((r) => r.Purpose === "IFC" && (!requireDoc || !!r.DocumentId))
      .map((r) => r.DeliverableId),
  );

  /* تاریخ نیاز از زودترین فعالیت وابسته گرفته می‌شود: اگر چند فعالیت به یک
   * مدرک وصل باشند، دیرترین تاریخ کالا را به کارگاه دیر می‌رساند. */
  const startByDel = new Map<string, string>();
  const actById = new Map((input.activities ?? []).map((a) => [a.Id, a]));
  for (const link of input.activityDocLinks ?? []) {
    const a = actById.get(link.activityId) as (ActivityLike & { PlannedStart?: string | null }) | undefined;
    const start = a?.PlannedStart;
    if (!start) continue;
    const cur = startByDel.get(link.deliverableId);
    if (!cur || start < cur) startByDel.set(link.deliverableId, start);
  }

  const drafts: MrDraft[] = [];
  const skippedNotIfc: string[] = [];
  const skippedExisting: string[] = [];
  const skippedNoActivity: string[] = [];

  for (const d of input.deliverables) {
    if (!ifcByDel.has(d.Id)) {
      skippedNotIfc.push(d.DocNo);
      continue;
    }
    const code = `MR-${d.DocNo}`;
    if (existing.has(code)) {
      skippedExisting.push(d.DocNo);
      continue;
    }
    const needBy = startByDel.get(d.Id) ?? null;
    if (!needBy) {
      skippedNoActivity.push(d.DocNo);
      continue;
    }

    const lead = leadTimes[d.Discipline] ?? 60;
    drafts.push({
      code,
      deliverableId: d.Id,
      docNo: d.DocNo,
      titleFa: `درخواست کالا بر پایهٔ مدرک ${d.DocNo} — ${d.TitleFa}`,
      discipline: d.Discipline,
      leadTimeDays: lead,
      needByDate: needBy,
      releaseByDate: procurementReleaseDate(needBy, lead, buffer),
      raisedAt: needBy,
      reasonFa: `مدرک به IFC رسیده؛ مهلت تدارک ${lead} روز و حاشیهٔ ${buffer} روز`,
    });
  }

  drafts.sort((a, b) => String(a.releaseByDate).localeCompare(String(b.releaseByDate)));
  return { drafts, skippedNotIfc, skippedExisting, skippedNoActivity };
}

/* ── هشدار «دیر سفارش دادن» ── */

export type ProcurementAlert = {
  code: string;
  mrCode: string;
  docNo: string;
  discipline: string;
  releaseByDate: string;
  needByDate: string | null;
  slackDays: number;
  severity: "medium" | "high" | "critical";
  titleFa: string;
  detailFa: string;
};

/**
 * درخواست‌هایی که پنجرهٔ سفارششان در حال بسته‌شدن است.
 *
 * وقتی تاریخ آزادسازی گذشته باشد، هر روز تأخیر مستقیم به تأخیر کارگاه بدل
 * می‌شود — چون مهلت تدارک قابل فشرده‌سازی نیست. پس شدت بر پایهٔ **شناوری**
 * سنجیده می‌شود نه سن درخواست.
 */
export function procurementAlerts(input: {
  requests: MaterialRequest[];
  asOf: string;
  warnDays?: number;
}): ProcurementAlert[] {
  const warn = input.warnDays ?? 14;
  const today = dayNumber(input.asOf);
  if (Number.isNaN(today)) return [];

  const out: ProcurementAlert[] = [];
  for (const m of input.requests) {
    if (m.Status === "ordered" || m.Status === "closed" || m.Status === "cancelled") continue;
    if (m.LinkedPrCode) continue;
    if (!m.ReleaseByDate) continue;

    const rel = dayNumber(m.ReleaseByDate);
    if (Number.isNaN(rel)) continue;

    const slack = rel - today;
    if (slack > warn) continue;

    const severity: ProcurementAlert["severity"] = slack < 0 ? "critical" : slack <= 7 ? "high" : "medium";
    out.push({
      code: "EWS-ENG-06",
      mrCode: m.Code,
      docNo: m.DocNo ?? m.Code,
      discipline: m.Discipline,
      releaseByDate: m.ReleaseByDate,
      needByDate: m.NeedByDate ?? null,
      slackDays: slack,
      severity,
      titleFa: slack < 0 ? "پنجرهٔ سفارش کالا بسته شد" : "پنجرهٔ سفارش کالا رو به بسته‌شدن",
      detailFa:
        slack < 0
          ? `درخواست ${m.Code} باید تا ${m.ReleaseByDate} سفارش می‌شد؛ ${Math.abs(slack)} روز گذشته و تأخیر مستقیم به کارگاه منتقل می‌شود`
          : `درخواست ${m.Code} تا ${m.ReleaseByDate} فرصت سفارش دارد (${slack} روز)`,
    });
  }

  return out.sort((a, b) => a.slackDays - b.slackDays);
}

/* ── پیش‌نویس درخواست خرید برای FIN ── */

export type PrDraft = {
  code: string;
  mrCode: string;
  titleFa: string;
  discipline: string;
  requestedAt: string;
  needByDate: string | null;
  estimatedAmount: number | null;
  costAccountCode: string | null;
  budgetStatus: "ok" | "over_budget" | "unknown";
  reasonFa: string;
};

export type PrPlan = {
  drafts: PrDraft[];
  skippedLinked: string[];
  skippedDraft: string[];
  overBudget: string[];
};

/**
 * از درخواست‌های کالای تأییدشده، پیش‌نویس درخواست خرید می‌سازد.
 *
 * کنترل بودجه اینجا **مشورتی** است نه بازدارنده: ENG مالک بودجه نیست و
 * نباید خرید را وتو کند. وضعیت `over_budget` علامت‌گذاری می‌شود تا مالی
 * تصمیم بگیرد — همان‌طور که prBudgetCheck در موتور FIN اجازهٔ override
 * می‌دهد.
 *
 * برآورد قیمت عمداً محاسبه نمی‌شود: ENG قیمت نمی‌داند و عدد ساختگی بدتر از
 * خالی گذاشتن است، چون کنترل بودجه را روی داده‌ای بی‌پایه اجرا می‌کند.
 */
export function planPurchaseRequisitions(input: {
  requests: MaterialRequest[];
  existingPrCodes?: string[];
  estimates?: Record<string, number>;
  costAccountByDiscipline?: Record<string, string>;
  budgetRemaining?: Record<string, number>;
}): PrPlan {
  const existing = new Set(input.existingPrCodes ?? []);
  const estimates = input.estimates ?? {};
  const accounts = input.costAccountByDiscipline ?? {};
  const remaining = input.budgetRemaining ?? {};

  const drafts: PrDraft[] = [];
  const skippedLinked: string[] = [];
  const skippedDraft: string[] = [];
  const overBudget: string[] = [];

  for (const m of input.requests) {
    if (m.LinkedPrCode) {
      skippedLinked.push(m.Code);
      continue;
    }
    /* فقط درخواست تأییدشده به خرید می‌رود؛ پیش‌نویس هنوز نهایی نیست. */
    if (m.Status !== "approved" && m.Status !== "released") {
      skippedDraft.push(m.Code);
      continue;
    }

    const code = `PR-${m.Code}`;
    if (existing.has(code)) continue;

    const amount = estimates[m.Code] ?? null;
    const account = accounts[m.Discipline] ?? null;

    let budgetStatus: PrDraft["budgetStatus"] = "unknown";
    if (amount !== null && account && account in remaining) {
      budgetStatus = amount <= remaining[account] ? "ok" : "over_budget";
      if (budgetStatus === "over_budget") overBudget.push(code);
    }

    drafts.push({
      code,
      mrCode: m.Code,
      titleFa: m.TitleFa,
      discipline: m.Discipline,
      requestedAt: m.RaisedAt,
      needByDate: m.NeedByDate ?? null,
      estimatedAmount: amount,
      costAccountCode: account,
      budgetStatus,
      reasonFa:
        budgetStatus === "over_budget"
          ? "برآورد از باقیماندهٔ بودجه بیشتر است؛ تصمیم با مالی است"
          : budgetStatus === "unknown"
            ? "برآورد قیمت یا حساب هزینه در دسترس نیست؛ کنترل بودجه انجام نشد"
            : "کنترل بودجهٔ اولیه بدون ایراد",
    });
  }

  return { drafts, skippedLinked, skippedDraft, overBudget };
}

/* ── اتصال VPR به دفتر سفارش (تکمیل شکاف ۷) ── */

export type PoLike = { ProjectId: string; PoNo: string; VendorName?: string | null; Status?: string | null };

/** شماره‌های سفارش معتبر از دفتر خرید — ورودی auditVendorPoRefs. */
export function poRegistry(orders: PoLike[]): string[] {
  return orders.map((o) => String(o.PoNo).trim()).filter(Boolean);
}
