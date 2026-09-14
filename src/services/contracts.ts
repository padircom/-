/**
 * Arena Platform — موتور پیمان، صورت‌وضعیت و تعدیل (cnt-v1، دامنهٔ d14)
 * ---------------------------------------------------------------------------
 * منطق خالص و بدون I/O. مصرف‌کننده‌ها: server/index.js از راه باندل
 * server/cntLogic.js و رابط کاربری از راه import مستقیم.
 *
 * تصمیم محوری این موتور — ADR-CNT-11:
 * دو حالت ارزش‌گذاری (فهرست بهایی و مقطوع) فقط در دو نقطه از هم جدا می‌شوند:
 * تعریف ردیف، و اثبات کارکرد. از مرز `lineEarnedValue` به بعد همه‌چیز با
 * «ارزش کسب‌شدهٔ ریالی» کار می‌کند و هیچ تابع پایین‌دستی نمی‌داند پیمان
 * فهرست‌بهایی است یا مقطوع. دلیلش درسی است که در گزارش مدیریتی مهندسی
 * گرفتیم: وقتی دو مسیر محاسبه وجود دارد، دو رقم متفاوت تولید می‌شود و
 * اختلافشان در جلسهٔ کارفرما بیرون می‌زند.
 *
 * مبنا: docs/CNT_Architecture.md (D1) و docs/CNT_DataModel.md (D2)
 * شرایط عمومی پیمان — نشریهٔ ۴۳۱۱ · FIDIC Clause 13 و 14
 */

export const CNT_VERSION = "cnt-v1";
export const CNT_DOMAIN_ID = "d14";

/* ══════════════════════════ انواع پایه ══════════════════════════ */

export type PricingBasis = "unit_price" | "lump_sum";
export type ContractType = "unit_price" | "lump_sum" | "mixed" | "cost_plus";

export type Bi = { fa: string; en: string };

export type ContractMaster = {
  Id: string;
  ProjectId: string;
  Code: string;
  TitleFa: string;
  ContractType: ContractType;
  Party?: "main" | "subcontract";
  InitialAmount: number;
  CurrentAmount: number;
  Currency?: string;
  CeilingPct?: number;
  AdvancePct?: number | null;
  AdvanceRecoveryPct?: number | null;
  RetainagePct?: number;
  InsuranceRatePct?: number | null;
  WithholdingTaxPct?: number | null;
  VatPct?: number | null;
  AdjustmentEnabled?: boolean;
  BaseIndexPeriod?: string | null;
  ReviewDaysConsultant?: number | null;
  ReviewDaysEmployer?: number | null;
  StartDate?: string;
  DurationDays?: number;
  Status?: string;
};

export type BoqItem = {
  Id: string;
  ProjectId: string;
  ContractId: string;
  ItemNo: string;
  ParentItemNo?: string | null;
  ChapterCode?: string | null;
  TitleFa: string;
  PricingBasis: PricingBasis;
  Unit?: string | null;
  ContractQty?: number | null;
  UnitRate?: number | null;
  LumpSumAmount?: number | null;
  LineAmount: number;
  WbsId?: string | null;
  CostAccountCode?: string | null;
  IsStarred?: boolean;
  RateStatus?: "agreed" | "rate_pending" | "disputed";
  Status?: string;
};

export type LumpSumMilestone = {
  Id: string;
  BoqItemId: string;
  MilestoneNo: number;
  TitleFa: string;
  WeightPct: number;
  AcceptanceCriteriaFa?: string | null;
  AchievedPct?: number | null;
  AchievedDate?: string | null;
  EvidenceDocNo?: string | null;
  Status?: "pending" | "claimed" | "verified" | "rejected";
};

export type MeasurementRow = {
  Id?: string;
  BoqItemId: string;
  SheetNo?: number;
  LocationFa?: string | null;
  DrawingNo?: string | null;
  Count?: number | null;
  Length?: number | null;
  Width?: number | null;
  Height?: number | null;
  Factor?: number | null;
  Quantity?: number | null;
  InspectionRecordCode?: string | null;
  Status?: string;
};

/* ══════════════════════════ کمکی‌های عددی ══════════════════════════ */

/** گرد کردن با دقت مشخص؛ خطای ممیز شناور در جمع ریالی انباشته می‌شود. */
export function round(n: number, digits = 2): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** عدد امن: ورودی تهی یا نامعتبر صفر می‌شود، نه NaN. */
export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ══════════════════════════ ۱. اعتبارسنجی ردیف دوحالته ══════════════════════════ */

export type ValidationIssue = {
  code: string;
  field?: string;
  itemNo?: string;
  severity: "error" | "warning";
  messageFa: string;
};

/**
 * اعتبارسنجی ترکیب ستون‌های یک ردیف بر پایهٔ حالت ارزش‌گذاری.
 *
 * چرا در موتور و نه در پایگاه داده؟ شرط CHECK شرطی در SQL Server هدف
 * پرهزینه و در درایور JSON نامفهوم است؛ ضمن اینکه پیام فارسی با شمارهٔ
 * ردیف فقط اینجا قابل تولید است.
 */
export function validateBoqItem(item: BoqItem): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const at = item.ItemNo;

  if (item.PricingBasis === "unit_price") {
    if (!item.Unit) {
      issues.push({ code: "CNT-BOQ-UNIT", field: "Unit", itemNo: at, severity: "error", messageFa: `ردیف ${at}: واحد سنجش برای ردیف فهرست‌بهایی الزامی است` });
    }
    if (item.ContractQty === null || item.ContractQty === undefined) {
      issues.push({ code: "CNT-BOQ-QTY", field: "ContractQty", itemNo: at, severity: "error", messageFa: `ردیف ${at}: مقدار پیمانی الزامی است` });
    } else if (num(item.ContractQty) < 0) {
      issues.push({ code: "CNT-BOQ-QTY-NEG", field: "ContractQty", itemNo: at, severity: "error", messageFa: `ردیف ${at}: مقدار پیمانی منفی نامعتبر است` });
    }
    if (item.UnitRate === null || item.UnitRate === undefined) {
      issues.push({ code: "CNT-BOQ-RATE", field: "UnitRate", itemNo: at, severity: "error", messageFa: `ردیف ${at}: قیمت واحد الزامی است` });
    } else if (num(item.UnitRate) < 0) {
      issues.push({ code: "CNT-BOQ-RATE-NEG", field: "UnitRate", itemNo: at, severity: "error", messageFa: `ردیف ${at}: قیمت واحد منفی نامعتبر است` });
    }
    if (item.LumpSumAmount !== null && item.LumpSumAmount !== undefined) {
      issues.push({ code: "CNT-BOQ-MIXED", field: "LumpSumAmount", itemNo: at, severity: "error", messageFa: `ردیف ${at}: ردیف فهرست‌بهایی نباید مبلغ مقطوع داشته باشد` });
    }
    /* مبلغ ردیف باید حاصل‌ضرب باشد؛ مغایرت یعنی یکی از سه عدد دستکاری شده. */
    const expected = round(num(item.ContractQty) * num(item.UnitRate), 2);
    if (item.ContractQty != null && item.UnitRate != null && Math.abs(expected - num(item.LineAmount)) > 0.5) {
      issues.push({
        code: "CNT-BOQ-AMOUNT", field: "LineAmount", itemNo: at, severity: "error",
        messageFa: `ردیف ${at}: مبلغ ردیف ${num(item.LineAmount).toLocaleString("fa-IR")} با حاصل‌ضرب مقدار در نرخ (${expected.toLocaleString("fa-IR")}) نمی‌خواند`,
      });
    }
  } else if (item.PricingBasis === "lump_sum") {
    if (item.LumpSumAmount === null || item.LumpSumAmount === undefined) {
      issues.push({ code: "CNT-BOQ-LS-AMOUNT", field: "LumpSumAmount", itemNo: at, severity: "error", messageFa: `ردیف ${at}: مبلغ مقطوع الزامی است` });
    } else if (num(item.LumpSumAmount) < 0) {
      issues.push({ code: "CNT-BOQ-LS-NEG", field: "LumpSumAmount", itemNo: at, severity: "error", messageFa: `ردیف ${at}: مبلغ مقطوع منفی نامعتبر است` });
    }
    if (item.ContractQty != null || item.UnitRate != null) {
      issues.push({
        code: "CNT-BOQ-LS-MIXED", itemNo: at, severity: "error",
        messageFa: `ردیف ${at}: ردیف مقطوع نباید مقدار یا قیمت واحد داشته باشد؛ اگر مقدار دارد حالت آن فهرست‌بهایی است`,
      });
    }
    if (item.LumpSumAmount != null && Math.abs(num(item.LumpSumAmount) - num(item.LineAmount)) > 0.5) {
      issues.push({ code: "CNT-BOQ-LS-AMOUNT-MISMATCH", field: "LineAmount", itemNo: at, severity: "error", messageFa: `ردیف ${at}: مبلغ ردیف با مبلغ مقطوع یکی نیست` });
    }
  } else {
    issues.push({ code: "CNT-BOQ-BASIS", field: "PricingBasis", itemNo: at, severity: "error", messageFa: `ردیف ${at}: حالت ارزش‌گذاری باید unit_price یا lump_sum باشد` });
  }

  if (item.IsStarred && item.RateStatus === "agreed" && !num(item.LineAmount)) {
    issues.push({ code: "CNT-BOQ-STAR-RATE", itemNo: at, severity: "warning", messageFa: `ردیف ${at}: کار جدید با نرخ توافق‌شده ولی مبلغ صفر` });
  }
  return issues;
}

/** اعتبارسنجی کل فهرست بها: ردیف‌ها، یکتایی شماره، و درستی درخت. */
export function validateBoq(items: BoqItem[]): {
  ok: boolean;
  issues: ValidationIssue[];
  totalAmount: number;
  byBasis: { unit_price: number; lump_sum: number };
} {
  const issues: ValidationIssue[] = [];
  for (const it of items) issues.push(...validateBoqItem(it));

  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.ItemNo)) {
      issues.push({ code: "CNT-BOQ-DUP", itemNo: it.ItemNo, severity: "error", messageFa: `شمارهٔ ردیف ${it.ItemNo} تکراری است` });
    }
    seen.add(it.ItemNo);
  }
  /* والد ناموجود، درخت را می‌شکند و رول‌آپ فصل را غلط می‌کند. */
  for (const it of items) {
    if (it.ParentItemNo && !seen.has(it.ParentItemNo)) {
      issues.push({ code: "CNT-BOQ-ORPHAN", itemNo: it.ItemNo, severity: "warning", messageFa: `ردیف ${it.ItemNo}: ردیف والد ${it.ParentItemNo} در فهرست نیست` });
    }
  }

  const active = items.filter((i) => (i.Status ?? "active") === "active");
  const byBasis = {
    unit_price: round(active.filter((i) => i.PricingBasis === "unit_price").reduce((s, i) => s + num(i.LineAmount), 0), 2),
    lump_sum: round(active.filter((i) => i.PricingBasis === "lump_sum").reduce((s, i) => s + num(i.LineAmount), 0), 2),
  };

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
    totalAmount: round(byBasis.unit_price + byBasis.lump_sum, 2),
    byBasis,
  };
}

/* ══════════════════════════ ۲. مبلغ ردیف و رول‌آپ ══════════════════════════ */

/** مبلغ ردیف از اجزای آن — منبع واحد محاسبه، برای هر دو حالت. */
export function lineAmount(item: Pick<BoqItem, "PricingBasis" | "ContractQty" | "UnitRate" | "LumpSumAmount">): number {
  return item.PricingBasis === "lump_sum"
    ? round(num(item.LumpSumAmount), 2)
    : round(num(item.ContractQty) * num(item.UnitRate), 2);
}

export type ChapterRollup = {
  chapterCode: string;
  itemCount: number;
  amount: number;
  sharePct: number;
  byBasis: { unit_price: number; lump_sum: number };
};

/**
 * تجمیع فهرست بها به تفکیک فصل.
 * فصل مبنای ضریب تعدیل است، پس این تابع ورودی موتور تعدیل هم هست.
 */
export function boqRollup(items: BoqItem[]): { chapters: ChapterRollup[]; total: number } {
  const active = items.filter((i) => (i.Status ?? "active") === "active");
  const total = round(active.reduce((s, i) => s + num(i.LineAmount), 0), 2);
  const map = new Map<string, ChapterRollup>();

  for (const it of active) {
    const key = it.ChapterCode ?? "بدون فصل";
    const cur = map.get(key) ?? { chapterCode: key, itemCount: 0, amount: 0, sharePct: 0, byBasis: { unit_price: 0, lump_sum: 0 } };
    cur.itemCount += 1;
    cur.amount = round(cur.amount + num(it.LineAmount), 2);
    cur.byBasis[it.PricingBasis] = round(cur.byBasis[it.PricingBasis] + num(it.LineAmount), 2);
    map.set(key, cur);
  }
  const chapters = [...map.values()]
    .map((c) => ({ ...c, sharePct: total > 0 ? round((c.amount / total) * 100, 2) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  return { chapters, total };
}

/* ══════════════════════════ ۳. ریزمتره ══════════════════════════ */

/**
 * مقدار یک سطر ریزمتره: تعداد × طول × عرض × ارتفاع × ضریب.
 *
 * ابعاد نانوشته حذف می‌شوند نه صفر: سطری که فقط طول دارد (مثل خط‌کشی)
 * باید همان طول را بدهد، نه صفر. این تفاوت، منبع کلاسیک متره صفر است.
 */
export function measurementQuantity(row: MeasurementRow): number {
  const parts = [row.Count, row.Length, row.Width, row.Height, row.Factor]
    .filter((v) => v !== null && v !== undefined && v !== ("" as unknown))
    .map((v) => num(v));
  if (parts.length === 0) return 0;
  return round(parts.reduce((a, b) => a * b, 1), 3);
}

/** جمع ریزمتره یک ردیف، با کشف مغایرت مقدار ذخیره‌شده و بازمحاسبه. */
export function measurementTotal(rows: MeasurementRow[]): {
  total: number;
  rowCount: number;
  mismatches: { sheetNo?: number; stored: number; computed: number }[];
} {
  let total = 0;
  const mismatches: { sheetNo?: number; stored: number; computed: number }[] = [];

  for (const r of rows) {
    const computed = measurementQuantity(r);
    const stored = r.Quantity === null || r.Quantity === undefined ? computed : num(r.Quantity);
    if (Math.abs(stored - computed) > 0.001) {
      mismatches.push({ sheetNo: r.SheetNo, stored, computed });
    }
    /* مقدار ذخیره‌شده ملاک جمع است چون ممکن است عمداً اصلاح شده باشد؛
     * ولی مغایرت گزارش می‌شود تا بی‌صدا نماند. */
    total += stored;
  }
  return { total: round(total, 3), rowCount: rows.length, mismatches };
}

/* ══════════════════════════ ۴. مرز همگرایی دو حالت ══════════════════════════ */

export type EarnedInput = {
  item: Pick<BoqItem, "PricingBasis" | "UnitRate" | "LumpSumAmount" | "LineAmount">;
  /** حالت فهرست‌بهایی: مقدار تجمعی قبل و تا این دوره. */
  prevQty?: number | null;
  cumQty?: number | null;
  /** حالت مقطوع: درصد تجمعی قبل و تا این دوره. */
  prevPct?: number | null;
  cumPct?: number | null;
};

export type EarnedResult = {
  basis: PricingBasis;
  currentQty: number | null;
  currentPct: number | null;
  earnedCurrent: number;
  earnedCumulative: number;
  earnedPrevious: number;
};

/**
 * ⭐ نقطهٔ همگرایی دو حالت (ADR-CNT-11).
 *
 * هر آنچه بالادست است — مقدار متره یا درصد مرحله — اینجا به ارزش ریالی
 * تبدیل می‌شود. هیچ تابعی پس از این نقطه به `PricingBasis` نگاه نمی‌کند.
 *
 * مقدار جاری همیشه مشتق است: تجمعی منهای تجمعی قبل (ADR-CNT-03). اگر
 * جاری مستقل ذخیره شود، اصلاح یک صورت‌وضعیت قدیمی زنجیره را می‌شکند.
 */
export function lineEarnedValue(input: EarnedInput): EarnedResult {
  const basis = input.item.PricingBasis;

  if (basis === "lump_sum") {
    const amount = num(input.item.LumpSumAmount) || num(input.item.LineAmount);
    const prevPct = num(input.prevPct);
    const cumPct = num(input.cumPct);
    const currentPct = round(cumPct - prevPct, 4);
    return {
      basis,
      currentQty: null,
      currentPct,
      earnedPrevious: round((prevPct / 100) * amount, 2),
      earnedCurrent: round((currentPct / 100) * amount, 2),
      earnedCumulative: round((cumPct / 100) * amount, 2),
    };
  }

  const rate = num(input.item.UnitRate);
  const prevQty = num(input.prevQty);
  const cumQty = num(input.cumQty);
  const currentQty = round(cumQty - prevQty, 3);
  return {
    basis,
    currentQty,
    currentPct: null,
    earnedPrevious: round(prevQty * rate, 2),
    earnedCurrent: round(currentQty * rate, 2),
    earnedCumulative: round(cumQty * rate, 2),
  };
}

/** درصد تحقق یک ردیف مقطوع از روی مراحل تأییدشده. */
export function milestoneProgress(milestones: LumpSumMilestone[]): {
  cumPct: number;
  verifiedCount: number;
  claimedCount: number;
  weightSum: number;
  weightIssueFa: string | null;
} {
  const weightSum = round(milestones.reduce((s, m) => s + num(m.WeightPct), 0), 4);
  /* فقط مرحلهٔ تأییدشده پیشرفت می‌دهد؛ ادعاشده هنوز پول نیست. */
  const verified = milestones.filter((m) => m.Status === "verified");
  const cumPct = round(
    verified.reduce((s, m) => s + (num(m.AchievedPct) || num(m.WeightPct)), 0),
    4,
  );
  return {
    cumPct: Math.min(cumPct, 100),
    verifiedCount: verified.length,
    claimedCount: milestones.filter((m) => m.Status === "claimed").length,
    weightSum,
    weightIssueFa: Math.abs(weightSum - 100) > 0.01
      ? `جمع وزن مراحل ${weightSum} است، نه ۱۰۰`
      : null,
  };
}

/* ══════════════════════════ ۵. سقف ۲۵٪ و کار جدید ══════════════════════════ */

export type CeilingResult = {
  initialAmount: number;
  ceilingPct: number;
  ceilingAmount: number;
  executedAmount: number;
  usedPct: number;
  remainingAmount: number;
  status: "ok" | "warning" | "exceeded";
  messageFa: string;
};

/**
 * کنترل سقف تغییر مقادیر — مادهٔ ۲۹ شرایط عمومی پیمان.
 *
 * سقف همیشه بر مبنای مبلغ **اولیه** سنجیده می‌شود، نه مبلغ جاری. اگر
 * مبنا جاری باشد، هر الحاقیه سقف را بالا می‌برد و کنترل بی‌معنا می‌شود.
 */
export function contractCeiling(input: {
  initialAmount: number;
  executedAmount: number;
  ceilingPct?: number;
  warnAtPct?: number;
}): CeilingResult {
  const initialAmount = round(num(input.initialAmount), 2);
  const ceilingPct = input.ceilingPct ?? 25;
  const ceilingAmount = round(initialAmount * (1 + ceilingPct / 100), 2);
  const executedAmount = round(num(input.executedAmount), 2);
  const usedPct = initialAmount > 0 ? round((executedAmount / initialAmount) * 100, 2) : 0;
  const remainingAmount = round(ceilingAmount - executedAmount, 2);
  const warnAt = input.warnAtPct ?? 100 + ceilingPct * 0.8;

  const status: CeilingResult["status"] =
    executedAmount > ceilingAmount ? "exceeded" : usedPct >= warnAt ? "warning" : "ok";

  const messageFa =
    status === "exceeded"
      ? `کارکرد ${usedPct}٪ مبلغ اولیه است و از سقف ${100 + ceilingPct}٪ گذشته؛ نیازمند الحاقیه یا درخواست تغییر مصوب`
      : status === "warning"
        ? `کارکرد ${usedPct}٪ مبلغ اولیه است؛ تا سقف ${100 + ceilingPct}٪ فاصلهٔ کمی مانده`
        : `کارکرد ${usedPct}٪ مبلغ اولیه است؛ در محدودهٔ مجاز`;

  return { initialAmount, ceilingPct, ceilingAmount, executedAmount, usedPct, remainingAmount, status, messageFa };
}

/** آیا این ردیف کار جدید، مجاز به ورود به جمع مالی است؟ (ADR-CNT-08) */
export function extraWorkBillable(item: { RateStatus?: string; Status?: string; AgreedRate?: number | null }): {
  billable: boolean;
  reasonFa: string;
} {
  if (item.Status === "rejected") return { billable: false, reasonFa: "کار جدید رد شده است" };
  if (item.RateStatus === "rate_pending" || item.Status === "rate_pending") {
    return { billable: false, reasonFa: "نرخ هنوز تصویب نشده؛ مقدار ثبت می‌شود ولی در جمع مالی نمی‌آید" };
  }
  if (item.RateStatus === "disputed") return { billable: false, reasonFa: "نرخ مورد اختلاف است" };
  if (!num(item.AgreedRate)) return { billable: false, reasonFa: "نرخ توافق‌شده ثبت نشده است" };
  return { billable: true, reasonFa: "قابل درج در صورت‌وضعیت" };
}

/* ══════════════════════════ ۶. دروازهٔ کیفی ══════════════════════════ */

export type QualityGateInput = {
  activityId?: string | null;
  inspectionRecordCode?: string | null;
  inspections: { Code: string; ActivityId?: string; Outcome?: string }[];
  openNcrActivityIds?: string[];
  override?: { by: string; reasonFa: string } | null;
};

export type QualityGateResult = {
  status: "passed" | "no_ir" | "open_ncr" | "overridden";
  passed: boolean;
  code: string | null;
  messageFa: string;
};

/**
 * دروازهٔ کیفی ثبت کارکرد — ADR-CNT-02.
 *
 * دروازه بسته است، ولی کلید دارد: گاهی بازرسی با تأخیر ثبت می‌شود و کل
 * صورت‌وضعیت نباید بخوابد. استفاده از کلید در همان رکورد ثبت می‌شود تا
 * در ممیزی دیده شود.
 */
export function qualityGate(input: QualityGateInput): QualityGateResult {
  const accepted = input.inspections.filter(
    (i) => String(i.Outcome ?? "").toLowerCase() === "accepted" || String(i.Outcome ?? "") === "pass",
  );

  const hasIr = input.inspectionRecordCode
    ? accepted.some((i) => i.Code === input.inspectionRecordCode)
    : input.activityId
      ? accepted.some((i) => i.ActivityId === input.activityId)
      : false;

  const hasOpenNcr = !!input.activityId && (input.openNcrActivityIds ?? []).includes(input.activityId);

  if (hasIr && !hasOpenNcr) {
    return { status: "passed", passed: true, code: null, messageFa: "تأییدیهٔ بازرسی موجود و عدم انطباق باز ندارد" };
  }
  if (input.override && input.override.by) {
    return {
      status: "overridden",
      passed: true,
      code: "CNT-GATE-OVERRIDE",
      messageFa: `دروازهٔ کیفی با مجوز ${input.override.by} دور زده شد: ${input.override.reasonFa}`,
    };
  }
  if (hasOpenNcr) {
    return { status: "open_ncr", passed: false, code: "E-CNT-OPEN-NCR", messageFa: "عدم انطباق باز روی این فعالیت ثبت است" };
  }
  return { status: "no_ir", passed: false, code: "E-CNT-NO-IR", messageFa: "تأییدیهٔ بازرسی پذیرفته‌شده برای این کارکرد یافت نشد" };
}

/* ══════════════════════════ ۷. نگاشت WBS و CBS ══════════════════════════ */

/** پوشش نگاشت ردیف‌ها به ساختار شکست کار و حساب هزینه. */
export function mappingCoverage(items: BoqItem[]): {
  total: number;
  wbsMapped: number;
  cbsMapped: number;
  wbsCoveragePct: number;
  cbsCoveragePct: number;
  unmappedWbs: string[];
  unmappedCbs: string[];
  noteFa: string;
} {
  const active = items.filter((i) => (i.Status ?? "active") === "active");
  const unmappedWbs = active.filter((i) => !i.WbsId).map((i) => i.ItemNo);
  const unmappedCbs = active.filter((i) => !i.CostAccountCode).map((i) => i.ItemNo);
  const total = active.length;
  const wbsMapped = total - unmappedWbs.length;
  const cbsMapped = total - unmappedCbs.length;

  return {
    total,
    wbsMapped,
    cbsMapped,
    wbsCoveragePct: total > 0 ? round((wbsMapped / total) * 100, 2) : 0,
    cbsCoveragePct: total > 0 ? round((cbsMapped / total) * 100, 2) : 0,
    unmappedWbs: unmappedWbs.slice(0, 50),
    unmappedCbs: unmappedCbs.slice(0, 50),
    /* ردیف بدون نگاشت WBS در مقایسهٔ پیشرفت فیزیکی و مالی نامرئی می‌ماند —
     * همان تلهٔ «فعالیت بدون WbsId هرگز قفل نمی‌گیرد» در ماژول مهندسی. */
    noteFa: unmappedWbs.length
      ? `${unmappedWbs.length} ردیف بدون نگاشت WBS در مقایسهٔ پیشرفت فیزیکی و مالی دیده نمی‌شود`
      : "همهٔ ردیف‌ها به ساختار شکست کار نگاشت شده‌اند",
  };
}

/* ══════════════════════════ ۸. خلاصهٔ شناسنامهٔ پیمان ══════════════════════════ */

export type ContractSummary = {
  contractId: string;
  code: string;
  titleFa: string;
  contractType: ContractType;
  initialAmount: number;
  currentAmount: number;
  amendmentDelta: number;
  boqTotal: number;
  boqVarianceFa: string | null;
  chapters: ChapterRollup[];
  ceiling: CeilingResult;
  mapping: ReturnType<typeof mappingCoverage>;
  validation: { ok: boolean; errorCount: number; warningCount: number };
};

/** نمای یکجای شناسنامهٔ پیمان برای داشبورد و گزارش. */
export function contractSummary(input: {
  contract: ContractMaster;
  items: BoqItem[];
  amendments?: { AmountDelta?: number | null; Status?: string }[];
  executedAmount?: number;
}): ContractSummary {
  const { contract, items } = input;
  const roll = boqRollup(items);
  const validation = validateBoq(items);

  const amendmentDelta = round(
    (input.amendments ?? [])
      .filter((a) => a.Status === "approved")
      .reduce((s, a) => s + num(a.AmountDelta), 0),
    2,
  );

  /* جمع فهرست بها باید با مبلغ جاری پیمان بخواند؛ اختلاف یعنی یا ردیفی
   * جا افتاده یا الحاقیه‌ای در فهرست منعکس نشده. */
  const expectedCurrent = round(num(contract.InitialAmount) + amendmentDelta, 2);
  const boqVariance = round(roll.total - expectedCurrent, 2);

  return {
    contractId: contract.Id,
    code: contract.Code,
    titleFa: contract.TitleFa,
    contractType: contract.ContractType,
    initialAmount: round(num(contract.InitialAmount), 2),
    currentAmount: round(num(contract.CurrentAmount), 2),
    amendmentDelta,
    boqTotal: roll.total,
    boqVarianceFa: Math.abs(boqVariance) > 1
      ? `جمع فهرست بها ${roll.total.toLocaleString("fa-IR")} با مبلغ پیمان به‌علاوهٔ الحاقیه‌ها (${expectedCurrent.toLocaleString("fa-IR")}) ${Math.abs(boqVariance).toLocaleString("fa-IR")} ریال اختلاف دارد`
      : null,
    chapters: roll.chapters,
    ceiling: contractCeiling({
      initialAmount: num(contract.InitialAmount),
      executedAmount: input.executedAmount ?? 0,
      ceilingPct: contract.CeilingPct ?? 25,
    }),
    mapping: mappingCoverage(items),
    validation: {
      ok: validation.ok,
      errorCount: validation.issues.filter((i) => i.severity === "error").length,
      warningCount: validation.issues.filter((i) => i.severity === "warning").length,
    },
  };
}

/* ══════════════════════════ ۹. واژگان نمایشی ══════════════════════════ */

export const PRICING_BASIS_FA: Record<PricingBasis, string> = {
  unit_price: "فهرست بهایی",
  lump_sum: "مقطوع",
};

export const CONTRACT_TYPE_FA: Record<ContractType, string> = {
  unit_price: "فهرست بهایی",
  lump_sum: "مقطوع",
  mixed: "ترکیبی",
  cost_plus: "امانی",
};

export const RATE_STATUS_FA: Record<string, string> = {
  agreed: "توافق‌شده",
  rate_pending: "در انتظار نرخ",
  disputed: "مورد اختلاف",
};

export const IPC_WORKFLOW_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  contractor_submitted: "ارسال پیمانکار",
  consultant_review: "بررسی مشاور",
  consultant_approved: "تأیید مشاور",
  employer_review: "بررسی کارفرما",
  approved: "مصوب",
  rejected: "رد شده",
  paid: "پرداخت‌شده",
};

export const GUARANTEE_TYPE_FA: Record<string, string> = {
  advance: "پیش‌پرداخت",
  performance: "حسن انجام تعهدات",
  bid: "شرکت در مناقصه",
  retention: "حسن انجام کار",
  warranty: "دورهٔ تضمین",
};

/* ══════════════════════ ۱۰. موتور صورت‌وضعیت (D4) ══════════════════════ */

export type IpcWorkflowState =
  | "draft"
  | "contractor_submitted"
  | "consultant_review"
  | "consultant_approved"
  | "employer_review"
  | "approved"
  | "rejected"
  | "paid";

export type IpcAction = "submit" | "approve" | "reject" | "return_for_correction" | "pay";

export type Actor = "contractor" | "consultant" | "employer";

/**
 * ماشین حالت گردش صورت‌وضعیت — ADR-CNT-12.
 *
 * چرا جدول صریح و نه شرط‌های پراکنده: مسیر تأیید صورت‌وضعیت در پیمان‌های
 * عمرانی سه‌طرفه است و هر طرف فقط در نوبت خودش حق اقدام دارد. اگر این
 * قاعده در چند نقطه تکرار شود، دیر یا زود جایی از قلم می‌افتد و مشاور
 * می‌تواند صورت‌وضعیتی را تأیید کند که هنوز ارسال نشده.
 *
 * `return_for_correction` عمداً به `draft` برمی‌گردد نه به حالت قبلی:
 * وقتی مدرکی برای اصلاح برمی‌گردد، پیمانکار باید دوباره از ابتدای زنجیره
 * تأیید عبور کند، وگرنه اصلاحِ پس از تأیید مشاور بدون بازبینی او رد می‌شود.
 */
const IPC_TRANSITIONS: {
  from: IpcWorkflowState;
  action: IpcAction;
  actor: Actor;
  to: IpcWorkflowState;
}[] = [
  { from: "draft", action: "submit", actor: "contractor", to: "contractor_submitted" },
  { from: "contractor_submitted", action: "approve", actor: "consultant", to: "consultant_approved" },
  { from: "contractor_submitted", action: "reject", actor: "consultant", to: "rejected" },
  { from: "contractor_submitted", action: "return_for_correction", actor: "consultant", to: "draft" },
  { from: "consultant_approved", action: "approve", actor: "employer", to: "approved" },
  { from: "consultant_approved", action: "reject", actor: "employer", to: "rejected" },
  { from: "consultant_approved", action: "return_for_correction", actor: "employer", to: "draft" },
  { from: "approved", action: "pay", actor: "employer", to: "paid" },
];

export type TransitionResult = {
  ok: boolean;
  from: IpcWorkflowState;
  to: IpcWorkflowState | null;
  code: string | null;
  messageFa: string;
};

/** آیا این اقدام از این حالت و توسط این نقش مجاز است؟ */
export function ipcTransition(
  from: IpcWorkflowState,
  action: IpcAction,
  actor: Actor,
): TransitionResult {
  const match = IPC_TRANSITIONS.find((t) => t.from === from && t.action === action);

  if (!match) {
    return {
      ok: false,
      from,
      to: null,
      code: "E-CNT-BAD-TRANSITION",
      messageFa: `اقدام «${action}» از وضعیت «${IPC_WORKFLOW_FA[from] ?? from}» مجاز نیست`,
    };
  }
  if (match.actor !== actor) {
    return {
      ok: false,
      from,
      to: null,
      code: "E-CNT-WRONG-ACTOR",
      messageFa: `این اقدام تنها در اختیار ${match.actor === "consultant" ? "مشاور" : match.actor === "employer" ? "کارفرما" : "پیمانکار"} است`,
    };
  }
  return { ok: true, from, to: match.to, code: null, messageFa: "" };
}

/** گام‌های مجاز بعدی — برای غیرفعال کردن دکمه‌ها در رابط کاربری. */
export function ipcNextActions(from: IpcWorkflowState, actor?: Actor): IpcAction[] {
  return IPC_TRANSITIONS.filter((t) => t.from === from && (!actor || t.actor === actor)).map(
    (t) => t.action,
  );
}

/** حالت‌هایی که صورت‌وضعیت در آن‌ها قفل است و ردیف‌هایش نباید تغییر کند. */
export function isIpcLocked(state: IpcWorkflowState): boolean {
  return state === "approved" || state === "paid" || state === "rejected";
}

export type DeductionType =
  | "insurance"
  | "withholding_tax"
  | "retainage"
  | "advance_recovery"
  | "penalty"
  | "back_to_back"
  | "other";

export type DeductionRow = {
  DeductionType: DeductionType;
  BaseAmount: number;
  RatePct: number | null;
  Amount: number;
  IsStatutory: boolean;
  NoteFa: string;
};

export type DeductionConfig = {
  /** بیمه — سهم پیمانکار، معمولاً ۵٪ کارکرد یا ۱٫۶٪ در قراردادهای مشمول ضریب. */
  insurancePct?: number | null;
  /** مالیات تکلیفی. */
  taxPct?: number | null;
  /** سپردهٔ حسن انجام کار، معمولاً ۱۰٪. */
  retainagePct?: number | null;
  /** درصد بازیافت پیش‌پرداخت از هر صورت‌وضعیت. */
  advanceRecoveryPct?: number | null;
  /** ماندهٔ بازنگشتهٔ پیش‌پرداخت — سقف کسر این دوره. */
  advanceOutstanding?: number | null;
  /** جریمهٔ تأخیر یا سایر کسور دستی. */
  penaltyAmount?: number | null;
  /** کسور بازگشتی از پیمانکار جزء (Back-to-Back). */
  backToBackAmount?: number | null;
  otherAmount?: number | null;
  otherNoteFa?: string | null;
  /** ارزش افزوده — افزوده می‌شود نه کسر (ADR-CNT-05). */
  vatPct?: number | null;
};

export type IpcTotals = {
  grossCurrent: number;
  adjustmentAmount: number;
  materialDiffAmount: number;
  subtotal: number;
  deductions: DeductionRow[];
  totalDeductions: number;
  vatAmount: number;
  netPayable: number;
};

/**
 * آبشار کسورات — ADR-CNT-13.
 *
 * ⚠️ ترتیب اینجا معنادار است و نباید جابه‌جا شود:
 *
 *   ۱. مبنا = کارکرد + تعدیل + مابه‌التفاوت مصالح
 *   ۲. بازیافت پیش‌پرداخت، محدود به ماندهٔ واقعی
 *   ۳. سپردهٔ حسن انجام کار روی همان مبنا
 *   ۴. بیمه و مالیات روی همان مبنا
 *   ۵. ارزش افزوده *افزوده* می‌شود
 *
 * همهٔ درصدها روی «مبنا» اعمال می‌شوند نه روی مانده پس از کسر قبلی. اگر
 * زنجیره‌ای حساب شوند، ترتیب ثبت کسور نتیجه را عوض می‌کند و دو نفر با
 * داده یکسان به دو عدد می‌رسند.
 *
 * بازیافت پیش‌پرداخت به ماندهٔ باقی‌مانده محدود است، وگرنه در آخرین
 * صورت‌وضعیت‌ها بیش از آنچه پرداخت شده بازمی‌گردد.
 *
 * مبنای منفی (اصلاح کاهشی متره در دوره‌های بعد) عمداً مجاز است و کسورات
 * هم منفی می‌شوند — یعنی سپرده و بیمهٔ اضافه‌کسر‌شدهٔ دورهٔ قبل برمی‌گردد.
 * اگر اینجا به صفر بریده شود، پیمانکار سپرده‌ای را که روی کار برگشتی
 * کسر شده هرگز پس نمی‌گیرد. تنها استثنا بازیافت پیش‌پرداخت است که با
 * `Math.max(0, ...)` هرگز منفی نمی‌شود، چون بازگرداندن پیش‌پرداخت به
 * پیمانکار معنای اقتصادی ندارد.
 */
export function computeDeductions(subtotal: number, cfg: DeductionConfig): DeductionRow[] {
  const base = round(num(subtotal), 2);
  const rows: DeductionRow[] = [];

  const pctRow = (
    type: DeductionType,
    pct: number | null | undefined,
    statutory: boolean,
    noteFa: string,
  ) => {
    const rate = num(pct);
    if (rate <= 0) return;
    rows.push({
      DeductionType: type,
      BaseAmount: base,
      RatePct: rate,
      Amount: round((base * rate) / 100, 2),
      IsStatutory: statutory,
      NoteFa: noteFa,
    });
  };

  /* پیش‌پرداخت اول، چون سقف‌دار است و باید پیش از سایر درصدها دیده شود. */
  const recoveryPct = num(cfg.advanceRecoveryPct);
  if (recoveryPct > 0) {
    const uncapped = round((base * recoveryPct) / 100, 2);
    const outstanding = cfg.advanceOutstanding == null ? uncapped : round(num(cfg.advanceOutstanding), 2);
    const amount = Math.max(0, Math.min(uncapped, outstanding));
    if (amount > 0) {
      rows.push({
        DeductionType: "advance_recovery",
        BaseAmount: base,
        RatePct: recoveryPct,
        Amount: amount,
        IsStatutory: false,
        NoteFa:
          amount < uncapped
            ? `بازیافت پیش‌پرداخت محدود به ماندهٔ ${outstanding.toLocaleString("fa-IR")}`
            : "بازیافت پیش‌پرداخت",
      });
    }
  }

  pctRow("retainage", cfg.retainagePct, false, "سپردهٔ حسن انجام کار");
  pctRow("insurance", cfg.insurancePct, true, "حق بیمهٔ سهم پیمانکار");
  pctRow("withholding_tax", cfg.taxPct, true, "مالیات تکلیفی");

  const fixed = (type: DeductionType, amount: number | null | undefined, noteFa: string) => {
    const v = round(num(amount), 2);
    if (v <= 0) return;
    rows.push({ DeductionType: type, BaseAmount: base, RatePct: null, Amount: v, IsStatutory: false, NoteFa: noteFa });
  };

  fixed("penalty", cfg.penaltyAmount, "جریمهٔ تأخیر");
  fixed("back_to_back", cfg.backToBackAmount, "کسور بازگشتی پیمانکار جزء");
  fixed("other", cfg.otherAmount, cfg.otherNoteFa || "سایر کسور");

  return rows;
}

export type IpcLineInput = {
  BoqItemId: string;
  PricingBasis: PricingBasis;
  UnitRate?: number | null;
  LumpSumAmount?: number | null;
  LineAmount?: number | null;
  prevQty?: number | null;
  cumQty?: number | null;
  prevPct?: number | null;
  cumPct?: number | null;
  /** وضعیت دروازهٔ کیفی؛ ردیف مردود از تجمیع کنار می‌رود. */
  QualityGateStatus?: string | null;
  Status?: string | null;
};

export type IpcLineComputed = EarnedResult & {
  BoqItemId: string;
  included: boolean;
  excludeReasonFa: string | null;
};

/**
 * تجمیع ردیف‌های صورت‌وضعیت.
 *
 * ردیفی که دروازهٔ کیفی را رد نکرده در جمع نمی‌آید ولی حذف هم نمی‌شود —
 * با پرچم `included=false` برمی‌گردد تا در رابط کاربری دیده شود چرا مبلغ
 * کمتر از انتظار است. حذف بی‌صدا باعث می‌شود کاربر ساعت‌ها دنبال اختلاف
 * بگردد.
 */
export function computeIpcLines(lines: IpcLineInput[]): {
  lines: IpcLineComputed[];
  grossCurrent: number;
  grossCumulative: number;
  excludedCount: number;
} {
  const out: IpcLineComputed[] = [];
  let grossCurrent = 0;
  let grossCumulative = 0;
  let excludedCount = 0;

  for (const line of lines) {
    const earned = lineEarnedValue({
      item: {
        PricingBasis: line.PricingBasis,
        UnitRate: line.UnitRate ?? null,
        LumpSumAmount: line.LumpSumAmount ?? null,
        LineAmount: line.LineAmount ?? null,
      } as EarnedInput["item"],
      prevQty: line.prevQty,
      cumQty: line.cumQty,
      prevPct: line.prevPct,
      cumPct: line.cumPct,
    });

    const gate = String(line.QualityGateStatus ?? "");
    const rejected = String(line.Status ?? "") === "rejected";
    const gateBlocked = gate === "no_ir" || gate === "open_ncr";

    let excludeReasonFa: string | null = null;
    if (rejected) excludeReasonFa = "ردیف رد شده است";
    else if (gateBlocked) {
      excludeReasonFa = gate === "open_ncr" ? "عدم انطباق باز دارد" : "تأییدیهٔ بازرسی ندارد";
    }

    const included = !excludeReasonFa;
    if (included) {
      grossCurrent = round(grossCurrent + earned.earnedCurrent, 2);
      grossCumulative = round(grossCumulative + earned.earnedCumulative, 2);
    } else {
      excludedCount += 1;
    }

    out.push({ ...earned, BoqItemId: line.BoqItemId, included, excludeReasonFa });
  }

  return { lines: out, grossCurrent, grossCumulative, excludedCount };
}

/**
 * محاسبهٔ کامل یک صورت‌وضعیت: از ردیف‌ها تا مبلغ خالص پرداختنی.
 *
 * این تنها نقطه‌ای است که `NetPayable` تولید می‌شود. هر جای دیگری که
 * بخواهد این عدد را دوباره حساب کند، دیر یا زود با این واگرا می‌شود.
 */
export function computeIpc(input: {
  lines: IpcLineInput[];
  adjustmentAmount?: number | null;
  materialDiffAmount?: number | null;
  deductions?: DeductionConfig;
}): IpcTotals & { lines: IpcLineComputed[]; grossCumulative: number; excludedCount: number } {
  const agg = computeIpcLines(input.lines ?? []);
  const adjustmentAmount = round(num(input.adjustmentAmount), 2);
  const materialDiffAmount = round(num(input.materialDiffAmount), 2);
  const subtotal = round(agg.grossCurrent + adjustmentAmount + materialDiffAmount, 2);

  const cfg = input.deductions ?? {};
  const deductions = computeDeductions(subtotal, cfg);
  const totalDeductions = round(
    deductions.reduce((s, d) => s + d.Amount, 0),
    2,
  );

  /* ارزش افزوده روی مبنا حساب می‌شود، نه روی مبلغ پس از کسورات. */
  const vatPct = num(cfg.vatPct);
  const vatAmount = vatPct > 0 ? round((subtotal * vatPct) / 100, 2) : 0;

  return {
    lines: agg.lines,
    grossCurrent: agg.grossCurrent,
    grossCumulative: agg.grossCumulative,
    excludedCount: agg.excludedCount,
    adjustmentAmount,
    materialDiffAmount,
    subtotal,
    deductions,
    totalDeductions,
    vatAmount,
    netPayable: round(subtotal - totalDeductions + vatAmount, 2),
  };
}

/**
 * شمارهٔ سریال بعدی صورت‌وضعیت در یک پیمان.
 *
 * روی `UX_InterimPaymentCertificate(ContractId, SerialNo)` تکیه دارد:
 * اگر دو کاربر هم‌زمان ثبت کنند، دومی با خطای یکتایی رد می‌شود و شماره
 * تکراری ساخته نمی‌شود.
 */
export function nextIpcSerial(existing: { SerialNo?: number | null }[]): number {
  const max = (existing ?? []).reduce((m, r) => Math.max(m, num(r.SerialNo)), 0);
  return max + 1;
}

export const DEDUCTION_TYPE_FA: Record<DeductionType, string> = {
  insurance: "بیمه",
  withholding_tax: "مالیات تکلیفی",
  retainage: "سپردهٔ حسن انجام کار",
  advance_recovery: "بازیافت پیش‌پرداخت",
  penalty: "جریمه",
  back_to_back: "کسور پیمانکار جزء",
  other: "سایر",
};

/* ══════════════════════ ۱۱. تعدیل و مابه‌التفاوت (D5) ══════════════════════ */

export type IndexRow = {
  IndexPeriod: string;
  ChapterCode: string;
  IndexValue: number;
  Status?: string | null;
  SourceFa?: string | null;
};

export type AdjustmentInput = {
  chapterCode: string;
  /** کارکرد همین دوره، نه تجمعی (ADR-CNT-04). */
  workAmount: number;
  baseIndex: number;
  periodIndex: number;
  /** ضریب کاهش قراردادی؛ نبودش یعنی صددرصد. */
  appliedRatePct?: number | null;
};

export type AdjustmentResult = {
  chapterCode: string;
  workAmount: number;
  baseIndex: number;
  periodIndex: number;
  adjustmentFactor: number;
  adjustmentAmount: number;
  appliedRatePct: number;
  direction: "up" | "down" | "flat";
  calcNoteFa: string;
};

/**
 * محاسبهٔ تعدیل یک فصل در یک دوره — ADR-CNT-04.
 *
 *   Factor = PeriodIndex ÷ BaseIndex
 *   Amount = WorkAmount × (Factor − 1) × AppliedRatePct ÷ 100
 *
 * مبنا «کارکرد همین دوره» است نه تجمعی. اگر تجمعی باشد، هر دوره تعدیل
 * دوره‌های قبل را با شاخص جدید دوباره حساب می‌کند و مبلغ پرداختی به
 * پیمانکار با هر انتشار شاخص عقب‌گرد می‌خورد.
 *
 * تعدیل منفی عمداً مجاز است: وقتی شاخص پایین می‌آید، مابه‌التفاوت به نفع
 * کارفرماست و بریدنش به صفر یعنی قرارداد یک‌طرفه اجرا شده.
 */
export function priceAdjustment(input: AdjustmentInput): AdjustmentResult {
  const workAmount = round(num(input.workAmount), 2);
  const baseIndex = num(input.baseIndex);
  const periodIndex = num(input.periodIndex);
  const appliedRatePct = input.appliedRatePct == null ? 100 : num(input.appliedRatePct);

  /* شاخص مبنای صفر یعنی داده ناقص است؛ ضریب یک برمی‌گردد تا محاسبه
   * بی‌سروصدا بی‌نهایت نشود. */
  const adjustmentFactor = baseIndex > 0 ? round(periodIndex / baseIndex, 6) : 1;
  const adjustmentAmount = round((workAmount * (adjustmentFactor - 1) * appliedRatePct) / 100, 2);

  const direction: AdjustmentResult["direction"] =
    adjustmentFactor > 1 ? "up" : adjustmentFactor < 1 ? "down" : "flat";

  const calcNoteFa =
    baseIndex > 0
      ? `فصل ${input.chapterCode}: ضریب ${adjustmentFactor} = ${periodIndex} ÷ ${baseIndex}` +
        (appliedRatePct !== 100 ? ` با ضریب اعمال ${appliedRatePct}٪` : "")
      : `فصل ${input.chapterCode}: شاخص مبنا ثبت نشده؛ تعدیل صفر منظور شد`;

  return {
    chapterCode: input.chapterCode,
    workAmount,
    baseIndex,
    periodIndex,
    adjustmentFactor,
    adjustmentAmount,
    appliedRatePct,
    direction,
    calcNoteFa,
  };
}

export type IndexLookup = {
  found: boolean;
  index: IndexRow | null;
  usable: boolean;
  code: string | null;
  messageFa: string;
};

/**
 * یافتن شاخص یک فصل در یک دوره — دروازهٔ G-04.
 *
 * ⚠️ فقط شاخص با وضعیت `published` مبنای محاسبهٔ مصوب است. شاخص
 * پیش‌نویس برای برآورد داخلی مفید است ولی اگر وارد صورت‌وضعیت مصوب شود،
 * عددی که به پیمانکار پرداخت شده مستند رسمی ندارد و در ممیزی برگشت
 * می‌خورد. `superseded` هم رد می‌شود چون سازمان برنامه بازنگری‌اش کرده.
 */
export function findIndex(
  catalog: IndexRow[],
  indexPeriod: string,
  chapterCode: string,
): IndexLookup {
  const rows = (catalog ?? []).filter(
    (r) => r.IndexPeriod === indexPeriod && r.ChapterCode === chapterCode,
  );

  if (!rows.length) {
    return {
      found: false,
      index: null,
      usable: false,
      code: "E-CNT-NO-INDEX",
      messageFa: `شاخص فصل ${chapterCode} برای دورهٔ ${indexPeriod} در کاتالوگ نیست`,
    };
  }

  const published = rows.find((r) => String(r.Status ?? "") === "published");
  if (published) {
    return { found: true, index: published, usable: true, code: null, messageFa: "" };
  }

  const draft = rows[0];
  return {
    found: true,
    index: draft,
    usable: false,
    code: "E-CNT-INDEX-NOT-PUBLISHED",
    messageFa: `شاخص فصل ${chapterCode} دورهٔ ${indexPeriod} وضعیت «${draft.Status}» دارد و مبنای محاسبهٔ مصوب نیست`,
  };
}

export type ChapterWork = { chapterCode: string; workAmount: number };

export type AdjustmentBatch = {
  rows: AdjustmentResult[];
  blocked: { chapterCode: string; code: string; messageFa: string }[];
  totalAdjustment: number;
  totalWork: number;
  effectivePct: number;
  usable: boolean;
};

/**
 * تعدیل همهٔ فصل‌های یک صورت‌وضعیت.
 *
 * فصلی که شاخص منتشرشده ندارد در `blocked` می‌آید و در جمع نمی‌نشیند.
 * کل دسته تنها وقتی `usable` است که هیچ فصلی مسدود نباشد — چون
 * صورت‌وضعیتی که نیمی از تعدیلش محاسبه شده، عدد گمراه‌کننده‌ای به
 * تأییدکننده نشان می‌دهد.
 */
export function adjustmentBatch(input: {
  chapters: ChapterWork[];
  catalog: IndexRow[];
  indexPeriod: string;
  baseIndexPeriod: string;
  appliedRatePct?: number | null;
}): AdjustmentBatch {
  const rows: AdjustmentResult[] = [];
  const blocked: AdjustmentBatch["blocked"] = [];
  let totalWork = 0;

  for (const ch of input.chapters ?? []) {
    totalWork = round(totalWork + num(ch.workAmount), 2);

    const period = findIndex(input.catalog, input.indexPeriod, ch.chapterCode);
    const base = findIndex(input.catalog, input.baseIndexPeriod, ch.chapterCode);

    if (!period.usable || !base.usable) {
      const bad = !base.usable ? base : period;
      blocked.push({
        chapterCode: ch.chapterCode,
        code: bad.code ?? "E-CNT-NO-INDEX",
        messageFa: bad.messageFa,
      });
      continue;
    }

    rows.push(
      priceAdjustment({
        chapterCode: ch.chapterCode,
        workAmount: ch.workAmount,
        baseIndex: num(base.index?.IndexValue),
        periodIndex: num(period.index?.IndexValue),
        appliedRatePct: input.appliedRatePct,
      }),
    );
  }

  const totalAdjustment = round(
    rows.reduce((s, r) => s + r.adjustmentAmount, 0),
    2,
  );

  return {
    rows,
    blocked,
    totalAdjustment,
    totalWork,
    effectivePct: totalWork > 0 ? round((totalAdjustment / totalWork) * 100, 2) : 0,
    usable: blocked.length === 0 && rows.length > 0,
  };
}

/**
 * تعدیل تجمعی = جمع تعدیل دوره‌ها، نه تعدیل جمع (ADR-CNT-04).
 *
 * این تابع عمداً ساده است تا جای دیگری این جمع را دوباره نسازد.
 */
export function cumulativeAdjustment(
  periods: { AdjustmentAmount?: number | null; Status?: string | null }[],
): { total: number; approvedTotal: number; pendingTotal: number } {
  let total = 0;
  let approvedTotal = 0;
  for (const p of periods ?? []) {
    const v = num(p.AdjustmentAmount);
    total = round(total + v, 2);
    if (String(p.Status ?? "") === "approved") approvedTotal = round(approvedTotal + v, 2);
  }
  return { total, approvedTotal, pendingTotal: round(total - approvedTotal, 2) };
}

export type MaterialDiffInput = {
  materialCode: string;
  materialNameFa: string;
  quantity: number;
  baseRate: number;
  periodRate: number;
  unit?: string | null;
};

export type MaterialDiffResult = MaterialDiffInput & {
  rateDelta: number;
  diffAmount: number;
  direction: "up" | "down" | "flat";
};

/**
 * مابه‌التفاوت مصالح — تفاوت نرخ ضرب در مقدار مصرفی.
 *
 * جدا از تعدیل شاخص است و با آن جمع نمی‌شود مگر در سرآیند صورت‌وضعیت:
 * تعدیل بر مبنای شاخص عمومی فصل است، مابه‌التفاوت بر مبنای فاکتور واقعی
 * خرید یک قلم مشخص. یکی‌کردنشان یعنی یک افزایش قیمت دو بار پرداخت شود.
 */
export function materialDiff(input: MaterialDiffInput): MaterialDiffResult {
  const quantity = num(input.quantity);
  const baseRate = num(input.baseRate);
  const periodRate = num(input.periodRate);
  const rateDelta = round(periodRate - baseRate, 2);

  return {
    ...input,
    quantity,
    baseRate,
    periodRate,
    rateDelta,
    diffAmount: round(quantity * rateDelta, 2),
    direction: rateDelta > 0 ? "up" : rateDelta < 0 ? "down" : "flat",
  };
}

export const INDEX_STATUS_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  superseded: "بازنگری‌شده",
};

/* ═══════════ ۱۲. تحویل موقت و قطعی — PAC/FAC (ماژول d15) ═══════════ */

export type CertificateType = "pac" | "fac";

export type PunchItem = {
  ItemNo?: string;
  Category?: string | null;
  Status?: string | null;
  TitleFa?: string | null;
};

export type PunchSummary = {
  total: number;
  open: number;
  closed: number;
  waived: number;
  openByCategory: Record<string, number>;
  blockingCount: number;
  blockingItems: string[];
};

/**
 * جمع‌بندی فهرست نواقص.
 *
 * دستهٔ «الف» نقصی است که بهره‌برداری را ممکن نمی‌کند و مانع تحویل است.
 * دستهٔ ب و ج تحویل را نمی‌بندند ولی در گواهی فهرست می‌شوند تا در دورهٔ
 * تضمین پیگیری شوند. «صرف‌نظر شده» بسته حساب می‌شود چون تصمیم رسمی
 * گرفته شده، ولی جدا شمرده می‌شود تا در ممیزی دیده شود.
 */
export function punchSummary(items: PunchItem[]): PunchSummary {
  const list = items ?? [];
  const openByCategory: Record<string, number> = {};
  const blockingItems: string[] = [];
  let open = 0;
  let closed = 0;
  let waived = 0;

  for (const it of list) {
    const status = String(it.Status ?? "open");
    const cat = String(it.Category ?? "c").toLowerCase();

    if (status === "closed") { closed += 1; continue; }
    if (status === "waived") { waived += 1; continue; }

    open += 1;
    openByCategory[cat] = (openByCategory[cat] ?? 0) + 1;
    if (cat === "a") blockingItems.push(String(it.ItemNo ?? it.TitleFa ?? "بدون شماره"));
  }

  return {
    total: list.length,
    open,
    closed,
    waived,
    openByCategory,
    blockingCount: blockingItems.length,
    blockingItems,
  };
}

export type CertificateGateResult = {
  ok: boolean;
  code: string | null;
  messageFa: string;
  punch: PunchSummary;
};

/**
 * دروازهٔ صدور گواهی تحویل.
 *
 * قواعد عمداً بین PAC و FAC فرق دارند:
 *
 * - **PAC** با نقص دستهٔ الف صادر نمی‌شود، ولی ب و ج مانع نیستند —
 *   وگرنه هیچ پروژه‌ای هرگز تحویل موقت نمی‌گرفت.
 * - **FAC** هیچ نقص بازی را نمی‌پذیرد و بدون PAC قبلی صادر نمی‌شود.
 *   تحویل قطعی یعنی همه‌چیز بسته است؛ اگر نقص بازی بماند، ضمانت‌نامهٔ
 *   حسن انجام کار آزاد می‌شود در حالی که کار ناتمام است.
 */
export function certificateGate(input: {
  type: CertificateType;
  punchItems: PunchItem[];
  hasPac?: boolean;
  warrantyEnded?: boolean;
}): CertificateGateResult {
  const punch = punchSummary(input.punchItems ?? []);

  if (input.type === "pac") {
    if (punch.blockingCount > 0) {
      return {
        ok: false,
        code: "E-CNT-PUNCH-BLOCKING",
        messageFa: `${punch.blockingCount} نقص دستهٔ الف باز است و مانع تحویل موقت می‌شود: ${punch.blockingItems.slice(0, 5).join("، ")}`,
        punch,
      };
    }
    return { ok: true, code: null, messageFa: "شرایط صدور تحویل موقت فراهم است", punch };
  }

  if (!input.hasPac) {
    return {
      ok: false,
      code: "E-CNT-NO-PAC",
      messageFa: "تحویل قطعی بدون تحویل موقت پیشین صادر نمی‌شود",
      punch,
    };
  }
  if (punch.open > 0) {
    return {
      ok: false,
      code: "E-CNT-PUNCH-OPEN",
      messageFa: `${punch.open} نقص باز مانده و تحویل قطعی صادر نمی‌شود`,
      punch,
    };
  }
  if (input.warrantyEnded === false) {
    return {
      ok: false,
      code: "E-CNT-WARRANTY-ACTIVE",
      messageFa: "دورهٔ تضمین هنوز به پایان نرسیده است",
      punch,
    };
  }
  return { ok: true, code: null, messageFa: "شرایط صدور تحویل قطعی فراهم است", punch };
}

/** تاریخ پایان دورهٔ تضمین از تاریخ تحویل موقت، نه تاریخ صدور برگه. */
export function warrantyEnd(handoverDate: string, warrantyMonths: number): string | null {
  if (!handoverDate) return null;
  const d = new Date(handoverDate);
  if (Number.isNaN(d.getTime())) return null;
  const months = num(warrantyMonths) || 0;
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out.toISOString().slice(0, 10);
}

export const CERTIFICATE_TYPE_FA: Record<string, string> = {
  pac: "تحویل موقت",
  fac: "تحویل قطعی",
};

export const PUNCH_CATEGORY_FA: Record<string, string> = {
  a: "الف — مانع تحویل",
  b: "ب — رفع در دورهٔ تضمین",
  c: "ج — جزئی",
};

/* ══════ ۱۳. دفتر سپردهٔ حسن انجام کار و آزادسازی ۵۰/۵۰ (D6) ══════ */

export type RetainageEntry = {
  EntryType: "accrual" | "release_pac" | "release_fac" | "forfeit" | "adjustment";
  Amount: number;
  BalanceAfter?: number | null;
  TriggerEvent?: string | null;
  TriggerDocNo?: string | null;
  EntryDate?: string | null;
  Status?: string | null;
};

export type RetainageBalance = {
  accrued: number;
  released: number;
  forfeited: number;
  adjusted: number;
  balance: number;
  pacReleased: boolean;
  facReleased: boolean;
};

/**
 * ماندهٔ دفتر سپرده.
 *
 * ورودی `reversed` کنار گذاشته می‌شود — سطر برگشتی در دفتر می‌ماند
 * برای ردیابی، ولی در مانده اثر ندارد.
 */
export function retainageBalance(entries: RetainageEntry[]): RetainageBalance {
  let accrued = 0;
  let released = 0;
  let forfeited = 0;
  let adjusted = 0;
  let pacReleased = false;
  let facReleased = false;

  for (const e of entries ?? []) {
    if (String(e.Status ?? "posted") === "reversed") continue;
    const amt = round(num(e.Amount), 2);

    switch (e.EntryType) {
      case "accrual": accrued = round(accrued + amt, 2); break;
      case "release_pac": released = round(released + amt, 2); pacReleased = true; break;
      case "release_fac": released = round(released + amt, 2); facReleased = true; break;
      case "forfeit": forfeited = round(forfeited + amt, 2); break;
      case "adjustment": adjusted = round(adjusted + amt, 2); break;
    }
  }

  return {
    accrued,
    released,
    forfeited,
    adjusted,
    balance: round(accrued - released - forfeited + adjusted, 2),
    pacReleased,
    facReleased,
  };
}

export type ReleasePlan = {
  ok: boolean;
  code: string | null;
  messageFa: string;
  entryType: "release_pac" | "release_fac" | null;
  releaseAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  sharePct: number;
};

/**
 * آزادسازی سپرده روی رویداد تحویل — نصف در PAC، نصف در FAC.
 *
 * ⚠️ سهم PAC روی **کل انباشت** حساب می‌شود نه روی ماندهٔ لحظه‌ای، ولی
 * آزادسازی FAC کل ماندهٔ باقی‌مانده را می‌برد. دلیل: اگر بین PAC و FAC
 * صورت‌وضعیت جدیدی سپردهٔ تازه انباشته کند، آن سپرده هم باید در FAC
 * آزاد شود. اگر FAC هم پنجاه درصدِ ثابت می‌گرفت، مبلغی برای همیشه در
 * دفتر گیر می‌کرد و پیمانکار هرگز کاملش را نمی‌گرفت.
 *
 * ضبط سپرده (`forfeit`) پیش از آزادسازی از مانده کم شده، پس خودبه‌خود
 * سهم آزادسازی را کاهش می‌دهد.
 */
export function planRetainageRelease(input: {
  entries: RetainageEntry[];
  event: "pac" | "fac";
  /** درصد آزادسازی در تحویل موقت؛ پیش‌فرض نصف. */
  pacSharePct?: number | null;
}): ReleasePlan {
  const bal = retainageBalance(input.entries ?? []);
  const sharePct = input.pacSharePct == null ? 50 : num(input.pacSharePct);

  if (bal.balance <= 0) {
    return {
      ok: false,
      code: "E-CNT-NO-RETAINAGE",
      messageFa: "ماندهٔ سپردهٔ قابل آزادسازی وجود ندارد",
      entryType: null,
      releaseAmount: 0,
      balanceBefore: bal.balance,
      balanceAfter: bal.balance,
      sharePct,
    };
  }

  if (input.event === "pac") {
    if (bal.pacReleased) {
      return {
        ok: false,
        code: "E-CNT-PAC-ALREADY-RELEASED",
        messageFa: "سهم تحویل موقت پیش‌تر آزاد شده است",
        entryType: null,
        releaseAmount: 0,
        balanceBefore: bal.balance,
        balanceAfter: bal.balance,
        sharePct,
      };
    }
    /* سهم روی کل انباشت، ولی هرگز بیش از ماندهٔ موجود. */
    const target = round((bal.accrued * sharePct) / 100, 2);
    const releaseAmount = Math.min(target, bal.balance);
    return {
      ok: true,
      code: null,
      messageFa: `${sharePct}٪ سپرده بابت تحویل موقت آزاد می‌شود`,
      entryType: "release_pac",
      releaseAmount,
      balanceBefore: bal.balance,
      balanceAfter: round(bal.balance - releaseAmount, 2),
      sharePct,
    };
  }

  if (!bal.pacReleased) {
    return {
      ok: false,
      code: "E-CNT-PAC-NOT-RELEASED",
      messageFa: "آزادسازی تحویل قطعی پیش از سهم تحویل موقت انجام نمی‌شود",
      entryType: null,
      releaseAmount: 0,
      balanceBefore: bal.balance,
      balanceAfter: bal.balance,
      sharePct,
    };
  }
  if (bal.facReleased) {
    return {
      ok: false,
      code: "E-CNT-FAC-ALREADY-RELEASED",
      messageFa: "سهم تحویل قطعی پیش‌تر آزاد شده است",
      entryType: null,
      releaseAmount: 0,
      balanceBefore: bal.balance,
      balanceAfter: bal.balance,
      sharePct,
    };
  }

  /* تحویل قطعی کل ماندهٔ باقی‌مانده را می‌برد. */
  return {
    ok: true,
    code: null,
    messageFa: "ماندهٔ سپرده بابت تحویل قطعی آزاد می‌شود",
    entryType: "release_fac",
    releaseAmount: bal.balance,
    balanceBefore: bal.balance,
    balanceAfter: 0,
    sharePct,
  };
}

export const RETAINAGE_ENTRY_FA: Record<string, string> = {
  accrual: "انباشت",
  release_pac: "آزادسازی تحویل موقت",
  release_fac: "آزادسازی تحویل قطعی",
  forfeit: "ضبط",
  adjustment: "اصلاح",
};

/* ══════ ۱۴. ضمانت‌نامه و بازیافت پیش‌پرداخت (D7) ══════ */

/**
 * دفتر ضمانت‌نامه‌های پیمان.
 *
 * ضمانت‌نامه تنها سندی در پیمان است که «نبودنش» گران‌تر از «بودنش»
 * تمام می‌شود: اگر یک ضمانت‌نامهٔ حسن انجام تعهدات بی‌سروصدا منقضی
 * شود، کارفرما وثیقهٔ خود را از دست داده و معمولاً وقتی می‌فهمد که
 * پیمانکار دیگر انگیزه‌ای برای تمدید ندارد. پس منطق این بخش عمداً
 * سخت‌گیر است: تاریخ انقضا هرگز «تقریبی» نیست و هشدار زودهنگام
 * قابل خاموش‌کردن نیست.
 */

export type GuaranteeType = "advance" | "performance" | "bid" | "retention" | "warranty";
export type GuaranteeStatus = "active" | "extended" | "released" | "forfeited" | "expired";
export type GuaranteeAlert = "none" | "d30" | "d10" | "d3" | "overdue";

export const GUARANTEE_TYPES: GuaranteeType[] = [
  "advance", "performance", "bid", "retention", "warranty",
];

export const GUARANTEE_STATUSES: GuaranteeStatus[] = [
  "active", "extended", "released", "forfeited", "expired",
];

export const GUARANTEE_STATUS_FA: Record<string, string> = {
  active: "معتبر",
  extended: "تمدیدشده",
  released: "آزادشده",
  forfeited: "ضبط‌شده",
  expired: "منقضی",
};

export const GUARANTEE_ALERT_FA: Record<string, string> = {
  none: "بدون هشدار",
  d30: "کمتر از سی روز تا انقضا",
  d10: "کمتر از ده روز تا انقضا",
  d3: "کمتر از سه روز تا انقضا",
  overdue: "منقضی‌شده",
};

/** آستانه‌های هشدار به روز — از بزرگ به کوچک ارزیابی می‌شوند. */
export const GUARANTEE_ALERT_DAYS = { d30: 30, d10: 10, d3: 3 } as const;

/**
 * درصد مرسوم ضمانت‌نامه نسبت به مبلغ پیمان در پیمان‌های دولتی ایران.
 * اینها «هشدار» می‌سازند نه «خطا»: پیمان خاص می‌تواند درصد دیگری
 * توافق کرده باشد و موتور حق ندارد جای طرفین تصمیم بگیرد.
 */
export const GUARANTEE_CUSTOMARY_PCT = {
  advance: 100,      /* هم‌اندازهٔ خودِ پیش‌پرداخت */
  performance: 5,
  bid: 5,
  retention: 10,
  warranty: 10,
} as const satisfies Record<GuaranteeType, number>;

export type GuaranteeRow = {
  Id?: string;
  Code?: string | null;
  GuaranteeType?: string | null;
  BankName?: string | null;
  GuaranteeNo?: string | null;
  Amount?: number | null;
  Currency?: string | null;
  IssueDate?: string | null;
  ExpiryDate?: string | null;
  ExtendedToDate?: string | null;
  ReleaseDate?: string | null;
  Status?: string | null;
  AlertLevel?: string | null;
};

const dayMs = 86_400_000;

/** روز اختلاف بین دو تاریخ؛ `null` وقتی هر کدام نامعتبر باشد. */
function daysBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  /* هر دو سر بازه به نیمه‌شب برده می‌شوند تا «امروز» همیشه صفر باشد
   * و ساعت ثبت رکورد نتواند یک روز هشدار را جابه‌جا کند. */
  return Math.round((Math.floor(b / dayMs) - Math.floor(a / dayMs)));
}

/**
 * تاریخ مؤثر انقضا.
 *
 * تمدید تاریخ اصلی را پاک نمی‌کند؛ سند بانکی هنوز تاریخ اولش را
 * دارد و در دعوا همان ملاک است. پس هر دو نگه داشته می‌شوند و فقط
 * محاسبه روی دیرتر انجام می‌شود — تمدید به عقب پذیرفته نیست.
 */
export function guaranteeEffectiveExpiry(row: GuaranteeRow): string | null {
  const base = row.ExpiryDate ?? null;
  const ext = row.ExtendedToDate ?? null;
  if (!base) return ext;
  if (!ext) return base;
  const b = new Date(base).getTime();
  const e = new Date(ext).getTime();
  if (!Number.isFinite(e)) return base;
  if (!Number.isFinite(b)) return ext;
  return e > b ? ext : base;
}

export type GuaranteeState = {
  status: GuaranteeStatus;
  statusFa: string;
  effectiveExpiry: string | null;
  daysToExpiry: number | null;
  alert: GuaranteeAlert;
  alertFa: string;
  isLive: boolean;
  isExpiredSilently: boolean;
  warningsFa: string[];
};

/**
 * وضعیت مؤثر یک ضمانت‌نامه در لحظهٔ `now`.
 *
 * `isExpiredSilently` مهم‌ترین خروجی این تابع است: ضمانت‌نامه‌ای که در
 * پایگاه داده هنوز «معتبر» ثبت شده ولی تاریخش گذشته. این حالت یعنی
 * کسی فراموش کرده و پروژه بدون وثیقه جلو می‌رود.
 */
export function guaranteeState(row: GuaranteeRow, now: Date = new Date()): GuaranteeState {
  const warningsFa: string[] = [];
  const stored = String(row.Status ?? "active") as GuaranteeStatus;
  const effectiveExpiry = guaranteeEffectiveExpiry(row);
  const today = new Date(now).toISOString().slice(0, 10);
  const daysToExpiry = daysBetween(today, effectiveExpiry);

  /* حالت‌های پایانی دست‌نخورده می‌مانند: ضمانت‌نامه‌ای که آزاد یا ضبط
   * شده، دیگر انقضا معنا ندارد. */
  const terminal = stored === "released" || stored === "forfeited";

  let status: GuaranteeStatus = stored;
  let isExpiredSilently = false;

  if (!terminal && daysToExpiry != null && daysToExpiry < 0) {
    isExpiredSilently = stored === "active" || stored === "extended";
    status = "expired";
  }

  let alert: GuaranteeAlert = "none";
  if (!terminal && daysToExpiry != null) {
    if (daysToExpiry < 0) alert = "overdue";
    else if (daysToExpiry <= GUARANTEE_ALERT_DAYS.d3) alert = "d3";
    else if (daysToExpiry <= GUARANTEE_ALERT_DAYS.d10) alert = "d10";
    else if (daysToExpiry <= GUARANTEE_ALERT_DAYS.d30) alert = "d30";
  }

  if (!effectiveExpiry) {
    warningsFa.push("تاریخ انقضای ضمانت‌نامه ثبت نشده است؛ هشدار زودهنگام کار نمی‌کند");
  }
  if (isExpiredSilently) {
    warningsFa.push("ضمانت‌نامه در سامانه معتبر ثبت شده ولی تاریخش گذشته است");
  }
  if (row.ExtendedToDate && row.ExpiryDate) {
    const b = new Date(row.ExpiryDate).getTime();
    const e = new Date(row.ExtendedToDate).getTime();
    if (Number.isFinite(b) && Number.isFinite(e) && e <= b) {
      warningsFa.push("تاریخ تمدید از تاریخ انقضای اصلی جلوتر نیست و اثری ندارد");
    }
  }

  return {
    status,
    statusFa: GUARANTEE_STATUS_FA[status] ?? status,
    effectiveExpiry,
    daysToExpiry,
    alert,
    alertFa: GUARANTEE_ALERT_FA[alert],
    isLive: status === "active" || status === "extended",
    isExpiredSilently,
    warningsFa,
  };
}

export type GuaranteeIssue = { code: string; messageFa: string; severity: "error" | "warning" };

/**
 * اعتبارسنجی ثبت یا ویرایش ضمانت‌نامه.
 *
 * تفکیک `error` از `warning` عمدی است: مبلغ منفی خطاست و باید جلویش
 * گرفته شود، ولی درصد غیرمرسوم فقط هشدار است چون پیمان می‌تواند
 * توافق دیگری داشته باشد و رد کردنش یعنی موتور جای طرفین تصمیم
 * بگیرد.
 */
export function validateGuaranteeInput(input: {
  code?: string | null;
  guaranteeType?: string | null;
  bankName?: string | null;
  guaranteeNo?: string | null;
  amount?: number | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  contractAmount?: number | null;
}): { ok: boolean; issues: GuaranteeIssue[] } {
  const issues: GuaranteeIssue[] = [];
  const err = (code: string, messageFa: string) => issues.push({ code, messageFa, severity: "error" });
  const warn = (code: string, messageFa: string) => issues.push({ code, messageFa, severity: "warning" });

  if (!String(input.code ?? "").trim()) {
    err("E-CNT-GRT-CODE", "کد ضمانت‌نامه الزامی است");
  }
  const type = String(input.guaranteeType ?? "");
  if (!GUARANTEE_TYPES.includes(type as GuaranteeType)) {
    err("E-CNT-GRT-TYPE", "نوع ضمانت‌نامه نامعتبر است");
  }
  if (!String(input.bankName ?? "").trim()) {
    err("E-CNT-GRT-BANK", "نام بانک صادرکننده الزامی است");
  }
  if (!String(input.guaranteeNo ?? "").trim()) {
    /* شمارهٔ سند بانکی تنها راه استعلام از بانک است؛ بدون آن
     * ضمانت‌نامه یک ردیف در جدول است نه یک وثیقه. */
    err("E-CNT-GRT-NO", "شمارهٔ ضمانت‌نامهٔ بانکی الزامی است");
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    err("E-CNT-GRT-AMOUNT", "مبلغ ضمانت‌نامه باید عددی بزرگ‌تر از صفر باشد");
  }

  const issue = input.issueDate ? new Date(input.issueDate).getTime() : NaN;
  const expiry = input.expiryDate ? new Date(input.expiryDate).getTime() : NaN;
  if (!Number.isFinite(issue)) {
    err("E-CNT-GRT-ISSUE-DATE", "تاریخ صدور الزامی و باید معتبر باشد");
  }
  if (!Number.isFinite(expiry)) {
    err("E-CNT-GRT-EXPIRY-DATE", "تاریخ انقضا الزامی و باید معتبر باشد");
  }
  if (Number.isFinite(issue) && Number.isFinite(expiry) && expiry <= issue) {
    err("E-CNT-GRT-DATE-ORDER", "تاریخ انقضا باید پس از تاریخ صدور باشد");
  }

  const contractAmount = Number(input.contractAmount);
  if (
    Number.isFinite(amount) && amount > 0
    && Number.isFinite(contractAmount) && contractAmount > 0
    && GUARANTEE_TYPES.includes(type as GuaranteeType)
  ) {
    const customary = GUARANTEE_CUSTOMARY_PCT[type as GuaranteeType];
    if (customary != null && type !== "advance") {
      const pct = (amount / contractAmount) * 100;
      /* بازهٔ تحمل نصف تا دو برابر درصد مرسوم است: بیرون از آن
       * احتمال اشتباه تایپی در مبلغ بیشتر از توافق خاص است. */
      if (pct < customary / 2 || pct > customary * 2) {
        warn(
          "W-CNT-GRT-PCT",
          `مبلغ ضمانت‌نامه ${round(pct)} درصد مبلغ پیمان است؛ عرف برای این نوع حدود ${customary} درصد است`,
        );
      }
    }
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}

export type GuaranteeAction = "extend" | "release" | "forfeit";

/**
 * آیا این عمل روی ضمانت‌نامه مجاز است؟
 *
 * آزادسازی ضمانت‌نامهٔ پیش‌پرداختِ بازیافت‌نشده بزرگ‌ترین ریسک این
 * بخش است: پول رفته و وثیقه‌اش هم برگشته. پس این یکی دروازهٔ سخت
 * دارد، نه هشدار.
 */
export function canActOnGuarantee(input: {
  row: GuaranteeRow;
  action: GuaranteeAction;
  newExpiry?: string | null;
  advanceOutstanding?: number | null;
  now?: Date;
}): { ok: boolean; code: string | null; messageFa: string; blockersFa: string[]; warningsFa: string[] } {
  const { row, action, newExpiry } = input;
  const now = input.now ?? new Date();
  const st = guaranteeState(row, now);
  const blockersFa: string[] = [];
  const warningsFa: string[] = [];

  if (st.status === "released") {
    return {
      ok: false, code: "E-CNT-GRT-ALREADY-RELEASED",
      messageFa: "ضمانت‌نامه پیش‌تر آزاد شده است",
      blockersFa: ["ضمانت‌نامهٔ آزادشده دوباره قابل تغییر نیست"], warningsFa,
    };
  }
  if (st.status === "forfeited") {
    return {
      ok: false, code: "E-CNT-GRT-ALREADY-FORFEITED",
      messageFa: "ضمانت‌نامه پیش‌تر ضبط شده است",
      blockersFa: ["ضمانت‌نامهٔ ضبط‌شده دوباره قابل تغییر نیست"], warningsFa,
    };
  }

  if (action === "extend") {
    const t = newExpiry ? new Date(newExpiry).getTime() : NaN;
    if (!Number.isFinite(t)) {
      blockersFa.push("تاریخ تمدید الزامی و باید معتبر باشد");
    } else {
      const cur = st.effectiveExpiry ? new Date(st.effectiveExpiry).getTime() : NaN;
      if (Number.isFinite(cur) && t <= cur) {
        blockersFa.push("تاریخ تمدید باید از انقضای فعلی جلوتر باشد");
      }
      if (t < now.getTime()) {
        blockersFa.push("تمدید به تاریخ گذشته معنا ندارد");
      }
    }
    /* تمدید پس از انقضا ممکن است ولی بی‌خطر نیست: بین تاریخ انقضا و
     * تاریخ تمدید، پروژه بدون وثیقه بوده و این فاصله باید دیده شود. */
    if (st.alert === "overdue") {
      warningsFa.push(
        `ضمانت‌نامه ${Math.abs(st.daysToExpiry ?? 0)} روز منقضی بوده است؛ این فاصله در سابقه می‌ماند`,
      );
    }
    return {
      ok: blockersFa.length === 0,
      code: blockersFa.length ? "E-CNT-GRT-EXTEND-BLOCKED" : null,
      messageFa: blockersFa.length ? "تمدید ممکن نیست" : "تمدید ضمانت‌نامه مجاز است",
      blockersFa, warningsFa,
    };
  }

  if (action === "release") {
    const outstanding = Number(input.advanceOutstanding);
    if (
      String(row.GuaranteeType) === "advance"
      && Number.isFinite(outstanding) && outstanding > 0
    ) {
      blockersFa.push(
        `پیش‌پرداخت هنوز ${round(outstanding)} بازیافت‌نشده دارد؛ آزادسازی ضمانت‌نامهٔ پیش‌پرداخت ممکن نیست`,
      );
    }
    if (st.alert === "overdue") {
      warningsFa.push("ضمانت‌نامه پیش از آزادسازی رسمی منقضی شده بود");
    }
    return {
      ok: blockersFa.length === 0,
      code: blockersFa.length ? "E-CNT-GRT-RELEASE-BLOCKED" : null,
      messageFa: blockersFa.length ? "آزادسازی ممکن نیست" : "آزادسازی ضمانت‌نامه مجاز است",
      blockersFa, warningsFa,
    };
  }

  /* ضبط ضمانت‌نامهٔ منقضی از نظر بانکی بی‌اثر است — سند دیگر قابل
   * مطالبه نیست و ثبتش در سامانه توهم وصول می‌سازد. */
  if (st.alert === "overdue") {
    blockersFa.push("ضمانت‌نامهٔ منقضی قابل ضبط نیست؛ سند نزد بانک اعتبار ندارد");
  }
  return {
    ok: blockersFa.length === 0,
    code: blockersFa.length ? "E-CNT-GRT-FORFEIT-BLOCKED" : null,
    messageFa: blockersFa.length ? "ضبط ممکن نیست" : "ضبط ضمانت‌نامه مجاز است",
    blockersFa, warningsFa,
  };
}

export type GuaranteeRegister = {
  items: (GuaranteeRow & { state: GuaranteeState })[];
  totalAmount: number;
  liveAmount: number;
  byType: Record<string, { count: number; amount: number }>;
  expiringSoon: number;
  expiredSilently: number;
  coverageGapsFa: string[];
  warningsFa: string[];
};

/**
 * دفتر کل ضمانت‌نامه‌ها با پوشش‌سنجی.
 *
 * `coverageGapsFa` پاسخ سؤالی است که هیچ ردیف جدولی نمی‌دهد: «چه
 * وثیقه‌ای *باید* می‌بود و نیست؟» نبودِ یک سطر، در نمای فهرستی هرگز
 * دیده نمی‌شود.
 */
export function guaranteeRegister(input: {
  rows: GuaranteeRow[];
  contractAmount?: number | null;
  advanceOutstanding?: number | null;
  now?: Date;
}): GuaranteeRegister {
  const now = input.now ?? new Date();
  const rows = input.rows ?? [];
  const items = rows.map((r) => ({ ...r, state: guaranteeState(r, now) }));

  let totalAmount = 0;
  let liveAmount = 0;
  let expiringSoon = 0;
  let expiredSilently = 0;
  const byType: Record<string, { count: number; amount: number }> = {};

  for (const it of items) {
    const amt = Number(it.Amount) || 0;
    totalAmount += amt;
    if (it.state.isLive) liveAmount += amt;
    if (it.state.alert === "d30" || it.state.alert === "d10" || it.state.alert === "d3") expiringSoon += 1;
    if (it.state.isExpiredSilently) expiredSilently += 1;

    const t = String(it.GuaranteeType ?? "unknown");
    byType[t] ??= { count: 0, amount: 0 };
    byType[t].count += 1;
    byType[t].amount += amt;
  }

  const coverageGapsFa: string[] = [];
  const warningsFa: string[] = [];
  const liveOf = (t: GuaranteeType) => items.some((i) => i.GuaranteeType === t && i.state.isLive);

  if (!liveOf("performance")) {
    coverageGapsFa.push("ضمانت‌نامهٔ حسن انجام تعهدات معتبری ثبت نشده است");
  }
  const outstanding = Number(input.advanceOutstanding);
  if (Number.isFinite(outstanding) && outstanding > 0 && !liveOf("advance")) {
    coverageGapsFa.push(
      `پیش‌پرداخت ${round(outstanding)} بازیافت‌نشده دارد ولی ضمانت‌نامهٔ پیش‌پرداخت معتبری نیست`,
    );
  }
  if (expiredSilently > 0) {
    warningsFa.push(`${expiredSilently} ضمانت‌نامه در سامانه معتبر است ولی تاریخش گذشته`);
  }
  if (expiringSoon > 0) {
    warningsFa.push(`${expiringSoon} ضمانت‌نامه کمتر از سی روز تا انقضا دارد`);
  }

  const ca = Number(input.contractAmount);
  if (Number.isFinite(ca) && ca > 0) {
    const perf = items
      .filter((i) => i.GuaranteeType === "performance" && i.state.isLive)
      .reduce((s, i) => s + (Number(i.Amount) || 0), 0);
    if (perf > 0) {
      const pct = (perf / ca) * 100;
      if (pct < GUARANTEE_CUSTOMARY_PCT.performance / 2) {
        warningsFa.push(
          `پوشش حسن انجام تعهدات ${round(pct)} درصد مبلغ پیمان است و از عرف کمتر است`,
        );
      }
    }
  }

  return {
    items, totalAmount, liveAmount, byType,
    expiringSoon, expiredSilently, coverageGapsFa, warningsFa,
  };
}

/* ── بازیافت پیش‌پرداخت ── */

export type AdvanceRow = {
  Id?: string;
  InstallmentNo?: number | null;
  PaidAmount?: number | null;
  PaidAt?: string | null;
  RecoveryPct?: number | null;
  RecoveredToDate?: number | null;
  OutstandingAmount?: number | null;
  Status?: string | null;
};

export const ADVANCE_STATUSES = ["pending", "paid", "recovering", "settled"] as const;

export const ADVANCE_STATUS_FA: Record<string, string> = {
  pending: "پرداخت‌نشده",
  paid: "پرداخت‌شده",
  recovering: "در حال بازیافت",
  settled: "تسویه‌شده",
};

/**
 * نرخ پیش‌فرض بازیافت پیش‌پرداخت در پیمان‌های دولتی: از هر صورت‌وضعیت
 * به نسبت کارکرد کسر می‌شود. عدد در پیمان قابل تغییر است.
 */
export const ADVANCE_DEFAULT_RECOVERY_PCT = 20;

export type AdvanceLedger = {
  paidTotal: number;
  recoveredTotal: number;
  outstanding: number;
  recoveredPct: number | null;
  isSettled: boolean;
  installments: (AdvanceRow & {
    statusFa: string;
    outstanding: number;
    recoveredPct: number | null;
  })[];
  warningsFa: string[];
};

/**
 * دفتر پیش‌پرداخت.
 *
 * `outstanding` از روی پرداخت منهای بازیافت بازمحاسبه می‌شود و ستون
 * ذخیره‌شده فقط برای مقایسه به کار می‌رود: اگر این دو نخوانند یعنی
 * جایی از زنجیرهٔ صورت‌وضعیت‌ها ناقص ثبت شده و باید دیده شود، نه
 * اینکه بی‌سروصدا یکی‌شان برنده شود.
 */
export function advanceLedger(rows: AdvanceRow[]): AdvanceLedger {
  const warningsFa: string[] = [];
  let paidTotal = 0;
  let recoveredTotal = 0;

  const installments = (rows ?? []).map((r) => {
    const paid = Number(r.PaidAmount) || 0;
    const rec = Number(r.RecoveredToDate) || 0;
    paidTotal += paid;
    recoveredTotal += rec;

    if (rec > paid && paid > 0) {
      warningsFa.push(
        `قسط ${r.InstallmentNo ?? "؟"}: بازیافت از مبلغ پرداختی بیشتر است`,
      );
    }
    const stored = Number(r.OutstandingAmount);
    const computed = round(paid - rec);
    if (Number.isFinite(stored) && Math.abs(stored - computed) > 1) {
      warningsFa.push(
        `قسط ${r.InstallmentNo ?? "؟"}: ماندهٔ ثبت‌شده با ماندهٔ محاسبه‌شده نمی‌خواند`,
      );
    }

    return {
      ...r,
      statusFa: ADVANCE_STATUS_FA[String(r.Status ?? "pending")] ?? String(r.Status ?? ""),
      outstanding: computed,
      recoveredPct: paid > 0 ? round((rec / paid) * 100) : null,
    };
  });

  const outstanding = round(paidTotal - recoveredTotal);
  return {
    paidTotal: round(paidTotal),
    recoveredTotal: round(recoveredTotal),
    outstanding,
    recoveredPct: paidTotal > 0 ? round((recoveredTotal / paidTotal) * 100) : null,
    /* «تسویه» فقط وقتی که پولی پرداخت شده باشد: دفتر خالی تسویه‌شده
     * نیست، هنوز شروع نشده. */
    isSettled: paidTotal > 0 && outstanding <= 0,
    installments,
    warningsFa,
  };
}

export type AdvanceRecovery = {
  recoverable: number;
  appliedPct: number;
  outstandingBefore: number;
  outstandingAfter: number;
  isFinalRecovery: boolean;
  messageFa: string;
  warningsFa: string[];
};

/**
 * سهم بازیافت پیش‌پرداخت از یک صورت‌وضعیت.
 *
 * دو قید همیشه با هم اعمال می‌شوند: درصد قراردادی، و سقف ماندهٔ
 * بازیافت‌نشده. بدون قید دوم، آخرین صورت‌وضعیت بیش از بدهی پیمانکار
 * کسر می‌کند و کارفرما بدهکار می‌شود.
 */
export function advanceRecovery(input: {
  grossAmount: number;
  outstanding: number;
  recoveryPct?: number | null;
}): AdvanceRecovery {
  const warningsFa: string[] = [];
  const gross = Number(input.grossAmount) || 0;
  const outstanding = Math.max(0, Number(input.outstanding) || 0);

  let pct = Number(input.recoveryPct);
  if (!Number.isFinite(pct) || pct <= 0) {
    pct = ADVANCE_DEFAULT_RECOVERY_PCT;
    warningsFa.push(`نرخ بازیافت در پیمان ثبت نشده؛ نرخ پیش‌فرض ${ADVANCE_DEFAULT_RECOVERY_PCT} درصد اعمال شد`);
  }
  if (pct > 100) {
    pct = 100;
    warningsFa.push("نرخ بازیافت بیش از صد درصد بود و به صد درصد محدود شد");
  }

  if (gross <= 0) {
    return {
      recoverable: 0, appliedPct: pct,
      outstandingBefore: outstanding, outstandingAfter: outstanding,
      isFinalRecovery: false,
      messageFa: "مبلغ ناخالص صورت‌وضعیت صفر است؛ بازیافتی محاسبه نشد",
      warningsFa,
    };
  }
  if (outstanding <= 0) {
    return {
      recoverable: 0, appliedPct: pct,
      outstandingBefore: 0, outstandingAfter: 0,
      isFinalRecovery: false,
      messageFa: "پیش‌پرداخت تسویه شده است؛ کسری بابت بازیافت ندارد",
      warningsFa,
    };
  }

  const byPct = round((gross * pct) / 100);
  const recoverable = Math.min(byPct, outstanding);
  const isFinalRecovery = recoverable >= outstanding;
  if (isFinalRecovery && byPct > outstanding) {
    warningsFa.push("سهم درصدی از ماندهٔ بازیافت‌نشده بیشتر بود و به مانده محدود شد");
  }

  return {
    recoverable: round(recoverable),
    appliedPct: pct,
    outstandingBefore: round(outstanding),
    outstandingAfter: round(outstanding - recoverable),
    isFinalRecovery,
    messageFa: isFinalRecovery
      ? "این کسر، پیش‌پرداخت را کامل تسویه می‌کند"
      : `${pct} درصد کارکرد ناخالص بابت بازیافت پیش‌پرداخت کسر می‌شود`,
    warningsFa,
  };
}

/**
 * اعتبارسنجی ثبت قسط پیش‌پرداخت.
 *
 * سقف پیش‌پرداخت در پیمان‌های دولتی معمولاً بیست و پنج درصد مبلغ
 * پیمان است؛ عبور از آن هشدار می‌گیرد نه خطا، چون پیمان خاص می‌تواند
 * سقف دیگری داشته باشد.
 */
export const ADVANCE_CUSTOMARY_CAP_PCT = 25;

export function validateAdvanceInput(input: {
  installmentNo?: number | null;
  paidAmount?: number | null;
  recoveryPct?: number | null;
  contractAmount?: number | null;
  alreadyPaid?: number | null;
  existingNos?: number[];
}): { ok: boolean; issues: GuaranteeIssue[] } {
  const issues: GuaranteeIssue[] = [];
  const err = (code: string, messageFa: string) => issues.push({ code, messageFa, severity: "error" });
  const warn = (code: string, messageFa: string) => issues.push({ code, messageFa, severity: "warning" });

  const no = Number(input.installmentNo);
  if (!Number.isInteger(no) || no <= 0) {
    err("E-CNT-ADV-NO", "شمارهٔ قسط باید عدد صحیح مثبت باشد");
  } else if ((input.existingNos ?? []).includes(no)) {
    err("E-CNT-ADV-DUPLICATE", `قسط شمارهٔ ${no} پیش‌تر ثبت شده است`);
  }

  const amount = Number(input.paidAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    err("E-CNT-ADV-AMOUNT", "مبلغ قسط باید عددی بزرگ‌تر از صفر باشد");
  }

  const pct = Number(input.recoveryPct);
  if (input.recoveryPct != null && (!Number.isFinite(pct) || pct <= 0 || pct > 100)) {
    err("E-CNT-ADV-PCT", "نرخ بازیافت باید بین صفر و صد باشد");
  }

  const ca = Number(input.contractAmount);
  const already = Number(input.alreadyPaid) || 0;
  if (Number.isFinite(ca) && ca > 0 && Number.isFinite(amount) && amount > 0) {
    const total = already + amount;
    const totalPct = (total / ca) * 100;
    if (totalPct > ADVANCE_CUSTOMARY_CAP_PCT) {
      warn(
        "W-CNT-ADV-CAP",
        `مجموع پیش‌پرداخت ${round(totalPct)} درصد مبلغ پیمان می‌شود؛ سقف مرسوم ${ADVANCE_CUSTOMARY_CAP_PCT} درصد است`,
      );
    }
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}

/**
 * سلامت وثیقه‌ای پیمان — یک عدد برای نمای کلان.
 *
 * این تابع عمداً نمره نمی‌سازد: پوشش وثیقه دودویی است. یا ضمانت‌نامهٔ
 * معتبر هست یا نیست؛ «هفتاد درصد پوشش» در دعوای حقوقی معنایی ندارد.
 */
export function guaranteeHealth(input: {
  register: GuaranteeRegister;
  advance?: AdvanceLedger | null;
}): {
  status: "green" | "amber" | "red";
  headlineFa: string;
  gapCount: number;
  expiringSoon: number;
  expiredSilently: number;
} {
  const { register } = input;
  const gapCount = register.coverageGapsFa.length;
  const status: "green" | "amber" | "red" =
    gapCount > 0 || register.expiredSilently > 0 ? "red"
      : register.expiringSoon > 0 ? "amber"
        : "green";

  const parts: string[] = [];
  if (gapCount > 0) parts.push(`${gapCount} خلأ پوشش`);
  if (register.expiredSilently > 0) parts.push(`${register.expiredSilently} منقضی ثبت‌نشده`);
  if (register.expiringSoon > 0) parts.push(`${register.expiringSoon} نزدیک انقضا`);
  if (input.advance && input.advance.outstanding > 0) {
    parts.push(`${round(input.advance.outstanding)} پیش‌پرداخت بازیافت‌نشده`);
  }

  return {
    status,
    headlineFa: parts.length ? parts.join(" · ") : "پوشش وثیقه‌ای کامل است",
    gapCount,
    expiringSoon: register.expiringSoon,
    expiredSilently: register.expiredSilently,
  };
}

/* ══════ ۱۵. صورت‌وضعیت پیمانکار جزء و کسور پشت‌به‌پشت (D8) ══════ */

/**
 * صورت‌وضعیت پیمانکار جزء.
 *
 * منطق حاکم بر این بخش یک جملهٔ ساده است: **پیمانکار جزء نمی‌تواند
 * بابت کاری پول بگیرد که کارفرما هنوز به پیمانکار اصلی نداده است.**
 * این همان جایی است که پیمانکار اصلی نقدینگی‌اش را از دست می‌دهد؛
 * ردیفی که در صورت‌وضعیت جزء تأیید شده ولی در صورت‌وضعیت اصلی رد یا
 * کسر شده، مستقیماً از جیب پیمانکار اصلی می‌رود و معمولاً ماه‌ها بعد
 * در تطبیق حساب کشف می‌شود.
 *
 * پس هر ردیف جزء به ردیف متناظرش در صورت‌وضعیت اصلی گره می‌خورد و
 * انحراف با پرچم صریح اعلام می‌شود، نه با یک عدد بی‌صدا.
 */

export type SubIpcWorkflowState =
  | "draft" | "submitted" | "reviewed" | "approved" | "rejected" | "paid";

export const SUB_IPC_STATES: SubIpcWorkflowState[] = [
  "draft", "submitted", "reviewed", "approved", "rejected", "paid",
];

export const SUB_IPC_STATE_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  reviewed: "بررسی‌شده",
  approved: "تأییدشده",
  rejected: "ردشده",
  paid: "پرداخت‌شده",
};

/**
 * گذارهای مجاز.
 *
 * `paid` بن‌بست است: پرداخت‌شده برنمی‌گردد. اصلاح پس از پرداخت باید
 * در صورت‌وضعیت بعدی به شکل ردیف منفی بیاید تا رد حسابداری بماند.
 */
export const SUB_IPC_TRANSITIONS: Record<SubIpcWorkflowState, SubIpcWorkflowState[]> = {
  draft: ["submitted"],
  submitted: ["reviewed", "rejected"],
  reviewed: ["approved", "rejected"],
  approved: ["paid", "rejected"],
  rejected: ["draft"],
  paid: [],
};

export type VarianceFlag = "ok" | "exceeds_main" | "no_main_ref";

export const VARIANCE_FLAG_FA: Record<VarianceFlag, string> = {
  ok: "منطبق با صورت‌وضعیت اصلی",
  exceeds_main: "بیش از مقدار تأییدشده در صورت‌وضعیت اصلی",
  no_main_ref: "بدون ردیف متناظر در صورت‌وضعیت اصلی",
};

export const BACK_TO_BACK_SOURCES = [
  "fin_material", "hse_incident", "qlt_rework", "other",
] as const;

export const BACK_TO_BACK_SOURCE_FA: Record<string, string> = {
  fin_material: "مصالح تحویلی کارفرما",
  hse_incident: "خسارت حادثهٔ ایمنی",
  qlt_rework: "دوباره‌کاری کیفی",
  other: "سایر",
};

export const BACK_TO_BACK_STATUS_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  approved: "تأییدشده",
  disputed: "مورد اختلاف",
  waived: "صرف‌نظر شده",
};

export type SubIpcLineInput = {
  Id?: string;
  BoqItemId?: string | null;
  DescriptionFa?: string | null;
  Unit?: string | null;
  Quantity?: number | null;
  UnitRate?: number | null;
  Amount?: number | null;
  MainApprovedQty?: number | null;
  Status?: string | null;
};

export type SubIpcLineResult = SubIpcLineInput & {
  amount: number;
  varianceFlag: VarianceFlag;
  varianceFa: string;
  excessQty: number | null;
  excessAmount: number | null;
};

/**
 * ارزیابی ردیف‌های صورت‌وضعیت جزء در برابر مقادیر تأییدشدهٔ اصلی.
 *
 * `no_main_ref` عمداً از `exceeds_main` جدا است: اولی یعنی «هنوز
 * نمی‌دانیم» (شاید ردیف در صورت‌وضعیت بعدی اصلی بیاید) و دومی یعنی
 * «می‌دانیم و بیشتر است». یکی‌کردنشان یا هشدار کاذب می‌سازد یا
 * انحراف واقعی را می‌پوشاند.
 */
export function subIpcLines(lines: SubIpcLineInput[]): {
  lines: SubIpcLineResult[];
  gross: number;
  exceedingCount: number;
  unmatchedCount: number;
  totalExcessAmount: number;
  warningsFa: string[];
} {
  const warningsFa: string[] = [];
  const out: SubIpcLineResult[] = [];
  let gross = 0;
  let exceedingCount = 0;
  let unmatchedCount = 0;
  let totalExcessAmount = 0;

  for (const l of lines ?? []) {
    /* مبلغ صریح بر حاصل‌ضرب اولویت دارد: ردیف توافقی مقطوع ممکن است
     * مقدار و نرخ نداشته باشد. */
    const qty = num(l.Quantity);
    const rate = num(l.UnitRate);
    const amount = l.Amount != null && Number.isFinite(Number(l.Amount))
      ? round(Number(l.Amount))
      : round(qty * rate);
    gross += amount;

    let varianceFlag: VarianceFlag = "ok";
    let excessQty: number | null = null;
    let excessAmount: number | null = null;

    if (!l.BoqItemId) {
      varianceFlag = "no_main_ref";
      unmatchedCount += 1;
    } else if (l.MainApprovedQty == null || !Number.isFinite(Number(l.MainApprovedQty))) {
      varianceFlag = "no_main_ref";
      unmatchedCount += 1;
    } else {
      const approved = Number(l.MainApprovedQty);
      if (qty > approved) {
        varianceFlag = "exceeds_main";
        exceedingCount += 1;
        excessQty = round(qty - approved);
        /* مبلغ مازاد با همان نرخ ردیف جزء سنجیده می‌شود، چون همان
         * است که پیمانکار اصلی باید از جیب بدهد. */
        excessAmount = round(excessQty * rate);
        totalExcessAmount += excessAmount;
      }
    }

    out.push({
      ...l,
      amount,
      varianceFlag,
      varianceFa: VARIANCE_FLAG_FA[varianceFlag],
      excessQty,
      excessAmount,
    });
  }

  if (exceedingCount > 0) {
    warningsFa.push(
      `${exceedingCount} ردیف بیش از مقدار تأییدشده در صورت‌وضعیت اصلی است؛ مازاد ${round(totalExcessAmount)} از جیب پیمانکار اصلی می‌رود`,
    );
  }
  if (unmatchedCount > 0) {
    warningsFa.push(
      `${unmatchedCount} ردیف به صورت‌وضعیت اصلی گره نخورده و قابل تطبیق نیست`,
    );
  }

  return {
    lines: out,
    gross: round(gross),
    exceedingCount,
    unmatchedCount,
    totalExcessAmount: round(totalExcessAmount),
    warningsFa,
  };
}

export type BackToBackRow = {
  Id?: string;
  SourceModule?: string | null;
  SourceRefCode?: string | null;
  DescriptionFa?: string | null;
  Amount?: number | null;
  EvidenceDocNo?: string | null;
  Status?: string | null;
};

export type BackToBackSummary = {
  rows: (BackToBackRow & { sourceFa: string; statusFa: string; isCountable: boolean })[];
  approvedTotal: number;
  disputedTotal: number;
  draftTotal: number;
  waivedTotal: number;
  byModule: Record<string, number>;
  missingEvidence: number;
  warningsFa: string[];
};

/**
 * جمع کسور پشت‌به‌پشت.
 *
 * فقط ردیف `approved` از پرداخت کم می‌شود. ردیف `disputed` عمداً
 * کسر نمی‌شود: کسر مبلغ مورد اختلاف پیش از حل اختلاف، پیمانکار جزء را
 * وادار به توقف کار می‌کند و معمولاً گران‌تر از خود مبلغ تمام می‌شود.
 * ولی در جمع جدا نمایش داده می‌شود تا نادیده نماند.
 */
export function backToBackSummary(rows: BackToBackRow[]): BackToBackSummary {
  const warningsFa: string[] = [];
  const byModule: Record<string, number> = {};
  let approvedTotal = 0;
  let disputedTotal = 0;
  let draftTotal = 0;
  let waivedTotal = 0;
  let missingEvidence = 0;

  const out = (rows ?? []).map((r) => {
    const amount = num(r.Amount);
    const status = String(r.Status ?? "draft");
    const isCountable = status === "approved";

    if (status === "approved") approvedTotal += amount;
    else if (status === "disputed") disputedTotal += amount;
    else if (status === "waived") waivedTotal += amount;
    else draftTotal += amount;

    const mod = String(r.SourceModule ?? "other");
    byModule[mod] = round((byModule[mod] ?? 0) + amount);

    /* کسر بدون سند، در داوری قابل دفاع نیست. */
    if (isCountable && !String(r.EvidenceDocNo ?? "").trim()) {
      missingEvidence += 1;
    }

    return {
      ...r,
      sourceFa: BACK_TO_BACK_SOURCE_FA[mod] ?? mod,
      statusFa: BACK_TO_BACK_STATUS_FA[status] ?? status,
      isCountable,
    };
  });

  if (missingEvidence > 0) {
    warningsFa.push(`${missingEvidence} کسر تأییدشده سند پشتیبان ندارد و در داوری قابل دفاع نیست`);
  }
  if (disputedTotal > 0) {
    warningsFa.push(`${round(disputedTotal)} کسر مورد اختلاف است و تا حل اختلاف از پرداخت کم نمی‌شود`);
  }

  return {
    rows: out,
    approvedTotal: round(approvedTotal),
    disputedTotal: round(disputedTotal),
    draftTotal: round(draftTotal),
    waivedTotal: round(waivedTotal),
    byModule,
    missingEvidence,
    warningsFa,
  };
}

export type SubIpcTotals = {
  gross: number;
  backToBack: number;
  otherDeductions: number;
  totalDeductions: number;
  netPayable: number;
  exceedingCount: number;
  unmatchedCount: number;
  totalExcessAmount: number;
  isNegative: boolean;
  warningsFa: string[];
};

/**
 * محاسبهٔ خالص پرداختنی صورت‌وضعیت جزء.
 *
 * خالص منفی مجاز است ولی پرچم می‌گیرد: وقتی کسور از کارکرد دوره
 * بیشتر باشد، پیمانکار جزء این دوره چیزی نمی‌گیرد و مانده به دورهٔ
 * بعد منتقل می‌شود. صفر کردنش، بدهی را ناپدید می‌کند.
 */
export function subIpcTotals(input: {
  lines: SubIpcLineInput[];
  backToBack?: BackToBackRow[];
  otherDeductions?: number | null;
}): SubIpcTotals & { lineDetail: SubIpcLineResult[]; backToBackDetail: BackToBackSummary } {
  const lineSet = subIpcLines(input.lines ?? []);
  const btb = backToBackSummary(input.backToBack ?? []);
  const other = Math.max(0, num(input.otherDeductions));

  const totalDeductions = round(btb.approvedTotal + other);
  const netPayable = round(lineSet.gross - totalDeductions);
  const warningsFa = [...lineSet.warningsFa, ...btb.warningsFa];

  if (netPayable < 0) {
    warningsFa.push(
      `کسور از کارکرد دوره بیشتر است؛ ${round(Math.abs(netPayable))} به دورهٔ بعد منتقل می‌شود`,
    );
  }

  return {
    gross: lineSet.gross,
    backToBack: btb.approvedTotal,
    otherDeductions: round(other),
    totalDeductions,
    netPayable,
    exceedingCount: lineSet.exceedingCount,
    unmatchedCount: lineSet.unmatchedCount,
    totalExcessAmount: lineSet.totalExcessAmount,
    isNegative: netPayable < 0,
    warningsFa,
    lineDetail: lineSet.lines,
    backToBackDetail: btb,
  };
}

export type SubIpcGate = {
  ok: boolean;
  code: string | null;
  messageFa: string;
  blockersFa: string[];
  warningsFa: string[];
};

/**
 * دروازهٔ گذار وضعیت صورت‌وضعیت جزء.
 *
 * سخت‌ترین قید اینجاست: تأیید صورت‌وضعیت جزء وقتی صورت‌وضعیت اصلیِ
 * متناظر هنوز تأیید نشده، بسته است. این همان جایی است که پیمانکار
 * اصلی پول را می‌دهد و بعد می‌فهمد کارفرما همان ردیف را نپذیرفته.
 */
export function canTransitionSubIpc(input: {
  from: string;
  to: string;
  /* جزئیات کسور اختیاری است: دروازه بدون آن هم کار می‌کند، ولی با
   * آن می‌تواند نبودِ سند پشتیبان را هم هشدار بدهد. */
  totals?: (SubIpcTotals & { backToBackDetail?: BackToBackSummary }) | null;
  mainIpcState?: string | null;
  allowUnmatched?: boolean;
}): SubIpcGate {
  const from = String(input.from ?? "draft") as SubIpcWorkflowState;
  const to = String(input.to ?? "") as SubIpcWorkflowState;
  const blockersFa: string[] = [];
  const warningsFa: string[] = [];

  if (!SUB_IPC_STATES.includes(to)) {
    return {
      ok: false, code: "E-CNT-SUB-STATE",
      messageFa: "وضعیت مقصد نامعتبر است",
      blockersFa: ["وضعیت مقصد در واژگان تعریف نشده است"], warningsFa,
    };
  }
  const allowed = SUB_IPC_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      ok: false, code: "E-CNT-SUB-TRANSITION",
      messageFa: `گذار از ${SUB_IPC_STATE_FA[from] ?? from} به ${SUB_IPC_STATE_FA[to] ?? to} مجاز نیست`,
      blockersFa: allowed.length
        ? [`از این وضعیت فقط ${allowed.map((a) => SUB_IPC_STATE_FA[a]).join(" یا ")} ممکن است`]
        : ["این وضعیت پایانی است و گذاری ندارد"],
      warningsFa,
    };
  }

  const totals = input.totals ?? null;

  if (to === "approved") {
    /* گرهٔ اصلی: بدون تأیید صورت‌وضعیت اصلی، تأیید جزء یعنی پرداخت
     * از جیب پیمانکار اصلی. */
    const mainState = input.mainIpcState ? String(input.mainIpcState) : null;
    if (!mainState) {
      blockersFa.push("صورت‌وضعیت جزء به هیچ صورت‌وضعیت اصلی گره نخورده است");
    } else if (mainState !== "approved" && mainState !== "paid") {
      blockersFa.push(
        `صورت‌وضعیت اصلی هنوز تأیید نشده (وضعیت فعلی: ${mainState}); تأیید جزء پیش از آن، پرداخت از جیب پیمانکار اصلی است`,
      );
    }

    if (totals && totals.exceedingCount > 0) {
      blockersFa.push(
        `${totals.exceedingCount} ردیف بیش از مقدار تأییدشدهٔ اصلی است و باید اصلاح یا به کار جدید تبدیل شود`,
      );
    }
    if (totals && totals.unmatchedCount > 0 && !input.allowUnmatched) {
      /* ردیف بی‌مرجع می‌تواند مشروع باشد (کار جدید توافقی)، پس
       * دروازه با تأیید صریح باز می‌شود نه با نادیده گرفتن. */
      blockersFa.push(
        `${totals.unmatchedCount} ردیف بدون مرجع در صورت‌وضعیت اصلی است؛ تأیید آن باید صریح باشد`,
      );
    }
    const missingEvidence = totals?.backToBackDetail?.missingEvidence ?? 0;
    if (missingEvidence > 0) {
      warningsFa.push(`${missingEvidence} کسر پشت‌به‌پشت سند پشتیبان ندارد`);
    }
    if (totals && totals.isNegative) {
      warningsFa.push("خالص پرداختنی منفی است؛ مانده به دورهٔ بعد منتقل می‌شود");
    }
  }

  if (to === "paid" && totals && totals.netPayable <= 0) {
    blockersFa.push("خالص پرداختنی مثبت نیست؛ چیزی برای پرداخت وجود ندارد");
  }

  return {
    ok: blockersFa.length === 0,
    code: blockersFa.length ? "E-CNT-SUB-BLOCKED" : null,
    messageFa: blockersFa.length
      ? "گذار وضعیت ممکن نیست"
      : `گذار به ${SUB_IPC_STATE_FA[to] ?? to} مجاز است`,
    blockersFa, warningsFa,
  };
}

/** آیا صورت‌وضعیت جزء در این وضعیت قفل است؟ */
export function isSubIpcLocked(state: string): boolean {
  const s = String(state ?? "draft");
  /* از لحظهٔ ارسال، ردیف‌ها قفل می‌شوند: ویرایش پس از ارسال یعنی
   * بررسی‌کننده چیزی را تأیید کند که دیگر وجود ندارد. */
  return s !== "draft" && s !== "rejected";
}

export type SubIpcRegister = {
  items: (Record<string, unknown> & { stateFa: string; isLocked: boolean })[];
  count: number;
  grossTotal: number;
  netTotal: number;
  deductionTotal: number;
  byState: Record<string, number>;
  awaitingMain: number;
  warningsFa: string[];
};

/**
 * دفتر صورت‌وضعیت‌های جزء یک پیمان.
 *
 * `awaitingMain` عددی است که پیمانکار اصلی باید هر هفته ببیند:
 * صورت‌وضعیت‌هایی که جزء تحویل داده و منتظر تأیید اصلی مانده‌اند.
 * انباشتشان یعنی ریسک نقدینگی.
 */
export function subIpcRegister(input: {
  rows: Record<string, unknown>[];
  mainStates?: Record<string, string>;
}): SubIpcRegister {
  const rows = input.rows ?? [];
  const mainStates = input.mainStates ?? {};
  const byState: Record<string, number> = {};
  let grossTotal = 0;
  let netTotal = 0;
  let deductionTotal = 0;
  let awaitingMain = 0;

  const items = rows.map((r) => {
    const state = String(r.WorkflowState ?? "draft");
    byState[state] = (byState[state] ?? 0) + 1;
    grossTotal += num(r.GrossCurrent);
    netTotal += num(r.NetPayable);
    deductionTotal += num(r.TotalDeductions);

    const mainId = r.MainIpcId ? String(r.MainIpcId) : null;
    const mainState = mainId ? mainStates[mainId] ?? null : null;
    const waiting = (state === "submitted" || state === "reviewed")
      && mainState !== "approved" && mainState !== "paid";
    if (waiting) awaitingMain += 1;

    return {
      ...r,
      stateFa: SUB_IPC_STATE_FA[state] ?? state,
      isLocked: isSubIpcLocked(state),
      mainIpcState: mainState,
      isAwaitingMain: waiting,
    };
  });

  const warningsFa: string[] = [];
  if (awaitingMain > 0) {
    warningsFa.push(
      `${awaitingMain} صورت‌وضعیت جزء منتظر تأیید صورت‌وضعیت اصلی است`,
    );
  }

  return {
    items,
    count: rows.length,
    grossTotal: round(grossTotal),
    netTotal: round(netTotal),
    deductionTotal: round(deductionTotal),
    byState,
    awaitingMain,
    warningsFa,
  };
}

/** اعتبارسنجی ثبت کسر پشت‌به‌پشت. */
export function validateBackToBack(input: {
  sourceModule?: string | null;
  descriptionFa?: string | null;
  amount?: number | null;
  evidenceDocNo?: string | null;
  status?: string | null;
}): { ok: boolean; issues: GuaranteeIssue[] } {
  const issues: GuaranteeIssue[] = [];
  const err = (code: string, messageFa: string) => issues.push({ code, messageFa, severity: "error" });
  const warn = (code: string, messageFa: string) => issues.push({ code, messageFa, severity: "warning" });

  const src = String(input.sourceModule ?? "");
  if (!BACK_TO_BACK_SOURCES.includes(src as (typeof BACK_TO_BACK_SOURCES)[number])) {
    err("E-CNT-BTB-SOURCE", "منشأ کسر نامعتبر است");
  }
  if (!String(input.descriptionFa ?? "").trim()) {
    err("E-CNT-BTB-DESC", "شرح کسر الزامی است");
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    err("E-CNT-BTB-AMOUNT", "مبلغ کسر باید عددی بزرگ‌تر از صفر باشد");
  }

  /* منشأ «سایر» بدون شرح دقیق، سطل زبالهٔ کسورهای بی‌مبناست. */
  if (src === "other" && String(input.descriptionFa ?? "").trim().length < 10) {
    warn("W-CNT-BTB-VAGUE", "کسر با منشأ «سایر» باید شرح دقیق‌تری داشته باشد");
  }
  if (String(input.status ?? "") === "approved" && !String(input.evidenceDocNo ?? "").trim()) {
    warn("W-CNT-BTB-NO-EVIDENCE", "کسر تأییدشده بدون سند پشتیبان در داوری قابل دفاع نیست");
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}

/* ══════════════════════════════════════════════════════════════════
 * بخش ۱۶ — پیشرفت پیمان (D9)
 *
 * دو عدد که همیشه با هم اشتباه گرفته می‌شوند:
 *
 *   پیشرفت فیزیکی = چقدر کار انجام شده (وزن‌دار بر مبلغ ردیف)
 *   پیشرفت مالی   = چقدر پول تأیید شده
 *
 * این دو هرگز برابر نیستند و فاصله‌شان معنا دارد. اگر مالی جلوتر
 * باشد، یعنی پیمانکار بیش از کارکردش پول گرفته (اضافه‌پرداخت). اگر
 * فیزیکی جلوتر باشد، یعنی کار انجام‌شده هنوز تأیید نشده و پیمانکار
 * دارد کار را از جیب خودش تأمین مالی می‌کند.
 *
 * هیچ‌کدام «بد» نیست؛ اما هر دو باید دیده شوند.
 * ══════════════════════════════════════════════════════════════════ */

export type ProgressBasis = "amount" | "quantity";

/** ردیف فهرست‌بها آن‌گونه که محاسبهٔ پیشرفت لازم دارد. */
export type ProgressBoqRow = {
  Id?: string;
  ItemNo?: string | null;
  TitleFa?: string | null;
  ChapterCode?: string | null;
  PricingBasis?: string | null;
  Unit?: string | null;
  ContractQty?: number | null;
  UnitRate?: number | null;
  LumpSumAmount?: number | null;
  LineAmount?: number | null;
  Status?: string | null;
};

/** مقدار تجمعی تأییدشدهٔ یک ردیف تا این لحظه. */
export type ProgressAchievedRow = {
  BoqItemId?: string | null;
  CumQty?: number | null;
  CumPct?: number | null;
  EarnedCumulative?: number | null;
};

/**
 * مبلغ پایهٔ یک ردیف فهرست‌بها.
 *
 * `LineAmount` اگر ذخیره شده باشد مرجع است؛ وگرنه از مقدار×نرخ یا
 * مبلغ مقطوع بازسازی می‌شود. ترتیب مهم است: ردیف مقطوع مقدار و نرخ
 * ندارد و اگر اول ضرب را امتحان کنیم صفر می‌گیریم.
 */
export function boqLineAmount(row: ProgressBoqRow): number {
  const stored = num(row.LineAmount);
  if (stored > 0) return round(stored);

  const lump = num(row.LumpSumAmount);
  if (lump > 0) return round(lump);

  return round(num(row.ContractQty) * num(row.UnitRate));
}

export type ProgressLine = {
  boqItemId: string;
  itemNo: string | null;
  titleFa: string | null;
  chapterCode: string | null;
  pricingBasis: string;
  contractQty: number;
  cumQty: number;
  lineAmount: number;
  earnedAmount: number;
  /** درصد پیشرفت خود ردیف (۰ تا ۱۰۰+). */
  itemPct: number;
  /** سهم این ردیف از کل پیمان (۰ تا ۱۰۰). */
  weightPct: number;
  /** سهم این ردیف در پیشرفت کل = وزن × درصد. */
  contributionPct: number;
  isOverrun: boolean;
};

export type ProgressBreakdown = {
  lines: ProgressLine[];
  /** جمع مبلغ ردیف‌ها — مخرج وزن‌دهی. */
  baseAmount: number;
  earnedAmount: number;
  physicalPct: number;
  lineCount: number;
  startedCount: number;
  completedCount: number;
  overrunCount: number;
  /** ردیف‌هایی که مبلغ پایه‌شان صفر است و در وزن‌دهی نقشی ندارند. */
  zeroWeightCount: number;
  byChapter: { chapterCode: string; weightPct: number; progressPct: number; earnedAmount: number }[];
  warningsFa: string[];
};

/**
 * پیشرفت فیزیکی وزن‌دار بر مبلغ ردیف.
 *
 * وزن‌دهی بر مبلغ است نه بر تعداد ردیف: صد ردیف کوچک نباید یک ردیف
 * بزرگ را زیر سایه ببرند. ردیفی که مبلغ پایه‌اش صفر است (نرخ هنوز
 * تعیین نشده) از وزن‌دهی کنار گذاشته می‌شود، چون در غیر این صورت
 * مخرج را دست‌نخورده می‌گذارد ولی صورت را بالا می‌برد — و پیشرفت
 * بی‌دلیل بزرگ‌نمایی می‌شود.
 */
export function progressBreakdown(input: {
  boq: ProgressBoqRow[];
  achieved?: ProgressAchievedRow[];
}): ProgressBreakdown {
  const boq = (input.boq ?? []).filter((r) => String(r.Status ?? "active") !== "cancelled");
  const achievedBy = new Map<string, ProgressAchievedRow>();
  for (const a of input.achieved ?? []) {
    const key = String(a.BoqItemId ?? "");
    if (!key) continue;
    /* اگر چند صورت‌وضعیت همان ردیف را داشته باشند، بزرگ‌ترین تجمعی
     * ملاک است — تجمعی طبق تعریف کاهش نمی‌یابد. */
    const prev = achievedBy.get(key);
    if (!prev || num(a.EarnedCumulative) > num(prev.EarnedCumulative)) achievedBy.set(key, a);
  }

  const lines: ProgressLine[] = [];
  let baseAmount = 0;
  let zeroWeightCount = 0;

  for (const row of boq) {
    const id = String(row.Id ?? "");
    const lineAmount = boqLineAmount(row);
    if (lineAmount <= 0) zeroWeightCount += 1;
    baseAmount += lineAmount;

    const got = achievedBy.get(id);
    const contractQty = num(row.ContractQty);
    const cumQty = num(got?.CumQty);

    /* مبلغ کسب‌شده: اگر صورت‌وضعیت آن را داده باشد همان مرجع است،
     * وگرنه از درصد یا نسبت مقدار بازسازی می‌شود. */
    let earned = num(got?.EarnedCumulative);
    if (earned === 0 && got) {
      const pct = num(got.CumPct);
      if (pct > 0) earned = round((pct / 100) * lineAmount);
      else if (contractQty > 0) earned = round((cumQty / contractQty) * lineAmount);
    }

    const itemPct = lineAmount > 0 ? round((earned / lineAmount) * 100) : 0;

    lines.push({
      boqItemId: id,
      itemNo: row.ItemNo ?? null,
      titleFa: row.TitleFa ?? null,
      chapterCode: row.ChapterCode ?? null,
      pricingBasis: String(row.PricingBasis ?? "unit_price"),
      contractQty,
      cumQty,
      lineAmount,
      earnedAmount: round(earned),
      itemPct,
      weightPct: 0,      /* پس از دانستن مخرج پر می‌شود */
      contributionPct: 0,
      isOverrun: itemPct > 100.000_01,
    });
  }

  baseAmount = round(baseAmount);
  let earnedTotal = 0;
  for (const l of lines) {
    l.weightPct = baseAmount > 0 ? round((l.lineAmount / baseAmount) * 100, 4) : 0;
    l.contributionPct = round((l.weightPct * l.itemPct) / 100, 4);
    earnedTotal += l.earnedAmount;
  }
  earnedTotal = round(earnedTotal);

  const physicalPct = baseAmount > 0 ? round((earnedTotal / baseAmount) * 100) : 0;

  /* تجمیع فصلی: مدیر پیمان معمولاً می‌خواهد بداند کدام فصل عقب است،
   * نه کدام ردیف. */
  const chapterMap = new Map<string, { weight: number; earned: number; base: number }>();
  for (const l of lines) {
    const key = l.chapterCode ?? "—";
    const c = chapterMap.get(key) ?? { weight: 0, earned: 0, base: 0 };
    c.weight += l.weightPct;
    c.earned += l.earnedAmount;
    c.base += l.lineAmount;
    chapterMap.set(key, c);
  }
  const byChapter = [...chapterMap.entries()]
    .map(([chapterCode, c]) => ({
      chapterCode,
      weightPct: round(c.weight, 2),
      progressPct: c.base > 0 ? round((c.earned / c.base) * 100) : 0,
      earnedAmount: round(c.earned),
    }))
    .sort((a, b) => b.weightPct - a.weightPct);

  const warningsFa: string[] = [];
  if (baseAmount <= 0) {
    warningsFa.push("فهرست‌بها مبلغ ندارد؛ پیشرفت وزن‌دار محاسبه‌پذیر نیست");
  }
  if (zeroWeightCount > 0) {
    warningsFa.push(`${zeroWeightCount} ردیف بدون مبلغ است و در وزن‌دهی نقشی ندارد`);
  }
  const overrunCount = lines.filter((l) => l.isOverrun).length;
  if (overrunCount > 0) {
    warningsFa.push(`${overrunCount} ردیف بیش از مقدار پیمان اجرا شده است`);
  }

  return {
    lines,
    baseAmount,
    earnedAmount: earnedTotal,
    physicalPct,
    lineCount: lines.length,
    startedCount: lines.filter((l) => l.itemPct > 0).length,
    completedCount: lines.filter((l) => l.itemPct >= 99.999).length,
    overrunCount,
    zeroWeightCount,
    byChapter,
    warningsFa,
  };
}

/* ─────────────── پیشرفت مالی ─────────────── */

export type FinancialProgress = {
  contractAmount: number;
  approvedGross: number;
  approvedNet: number;
  paidNet: number;
  pendingGross: number;
  financialPct: number;
  paidPct: number;
  ceilingUsedPct: number;
  approvedCount: number;
  pendingCount: number;
  warningsFa: string[];
};

/**
 * پیشرفت مالی از صورت‌وضعیت‌های تأییدشده.
 *
 * مخرج `CurrentAmount` است نه `InitialAmount`: پس از الحاقیه، مبلغ
 * اولیه دیگر سقف واقعی نیست و درصد را ساختگی بزرگ نشان می‌دهد.
 *
 * صورت‌وضعیت در جریان (`submitted`/`reviewed`) جدا شمرده می‌شود، نه
 * در درصد: پولی که هنوز تأیید نشده، پیشرفت مالی نیست — ولی نادیده
 * گرفتنش هم یعنی غافلگیری در دورهٔ بعد.
 */
export function financialProgress(input: {
  contractAmount: number;
  ipcs: {
    WorkflowState?: string | null;
    GrossCumulative?: number | null;
    GrossCurrent?: number | null;
    NetPayable?: number | null;
    Status?: string | null;
  }[];
  ceilingPct?: number | null;
}): FinancialProgress {
  const amount = round(num(input.contractAmount));
  const rows = (input.ipcs ?? []).filter((x) => String(x.Status ?? "open") !== "cancelled");

  const APPROVED = new Set(["approved", "paid"]);
  const PENDING = new Set(["submitted", "reviewed", "consultant_approved"]);

  let approvedGross = 0;
  let approvedNet = 0;
  let paidNet = 0;
  let pendingGross = 0;
  let approvedCount = 0;
  let pendingCount = 0;

  for (const x of rows) {
    const state = String(x.WorkflowState ?? "draft");
    /* ناخالص تجمعی مرجع است اگر باشد؛ در پیمان‌هایی که فقط دوره‌ای
     * ثبت شده، جمع دوره‌ها جایگزین می‌شود. */
    const gross = num(x.GrossCumulative) || num(x.GrossCurrent);
    if (APPROVED.has(state)) {
      approvedCount += 1;
      /* تجمعی بزرگ‌ترین است، نه جمع: جمع کردن تجمعی‌ها یعنی چندبار
       * شمردن همان کار. */
      approvedGross = Math.max(approvedGross, gross);
      approvedNet += num(x.NetPayable);
      if (state === "paid") paidNet += num(x.NetPayable);
    } else if (PENDING.has(state)) {
      pendingCount += 1;
      pendingGross += num(x.GrossCurrent);
    }
  }

  approvedGross = round(approvedGross);
  approvedNet = round(approvedNet);
  paidNet = round(paidNet);
  pendingGross = round(pendingGross);

  const financialPct = amount > 0 ? round((approvedGross / amount) * 100) : 0;
  const paidPct = amount > 0 ? round((paidNet / amount) * 100) : 0;

  const ceiling = num(input.ceilingPct);
  const ceilingAmount = ceiling > 0 ? amount * (1 + ceiling / 100) : amount;
  const ceilingUsedPct = ceilingAmount > 0 ? round((approvedGross / ceilingAmount) * 100) : 0;

  const warningsFa: string[] = [];
  if (amount <= 0) warningsFa.push("مبلغ پیمان صفر است؛ درصد مالی معنا ندارد");
  if (financialPct > 100) {
    warningsFa.push(`کارکرد تأییدشده ${round(financialPct - 100)}٪ از مبلغ پیمان فراتر رفته است`);
  }
  if (pendingCount > 0) {
    warningsFa.push(`${pendingCount} صورت‌وضعیت در جریان بررسی است و در درصد مالی نیامده`);
  }

  return {
    contractAmount: amount,
    approvedGross,
    approvedNet,
    paidNet,
    pendingGross,
    financialPct,
    paidPct,
    ceilingUsedPct,
    approvedCount,
    pendingCount,
    warningsFa,
  };
}

/* ─────────────── فاصلهٔ فیزیکی و مالی ─────────────── */

export type ProgressGapVerdict = "balanced" | "overpaid" | "underpaid" | "unknown";

export const PROGRESS_GAP_FA: Record<ProgressGapVerdict, string> = {
  balanced: "متوازن",
  overpaid: "پرداخت جلوتر از کار",
  underpaid: "کار جلوتر از پرداخت",
  unknown: "قابل سنجش نیست",
};

/** آستانه‌ای که زیرش فاصله را نویز می‌دانیم، نه علامت. */
export const PROGRESS_GAP_TOLERANCE_PCT = 5;

export type ProgressGap = {
  physicalPct: number;
  financialPct: number;
  gapPct: number;
  verdict: ProgressGapVerdict;
  verdictFa: string;
  /** مبلغی که این فاصله نمایندگی می‌کند. */
  exposureAmount: number;
  messageFa: string;
  isMaterial: boolean;
};

/**
 * تحلیل فاصلهٔ پیشرفت فیزیکی و مالی.
 *
 * علامت `gapPct` عمداً «مالی منهای فیزیکی» است: عدد مثبت یعنی پول
 * جلوتر رفته، و آن حالتی است که کارفرما باید نگرانش باشد.
 */
export function progressGap(input: {
  physicalPct: number;
  financialPct: number;
  contractAmount?: number | null;
  tolerancePct?: number | null;
}): ProgressGap {
  const phys = round(num(input.physicalPct));
  const fin = round(num(input.financialPct));
  const tol = input.tolerancePct == null ? PROGRESS_GAP_TOLERANCE_PCT : num(input.tolerancePct);
  const gap = round(fin - phys);
  const amount = round(num(input.contractAmount));
  const exposure = round((Math.abs(gap) / 100) * amount);

  let verdict: ProgressGapVerdict = "balanced";
  if (phys <= 0 && fin <= 0) verdict = "unknown";
  else if (gap > tol) verdict = "overpaid";
  else if (gap < -tol) verdict = "underpaid";

  const messageFa =
    verdict === "unknown"
      ? "هنوز نه کاری ثبت شده نه پرداختی انجام شده"
      : verdict === "overpaid"
        ? `پرداخت ${Math.abs(gap)}٪ از کارکرد جلوتر است؛ معادل ${exposure} ریال اضافه‌پرداخت محتمل`
        : verdict === "underpaid"
          ? `کارکرد ${Math.abs(gap)}٪ از پرداخت جلوتر است؛ پیمانکار معادل ${exposure} ریال را از منابع خود تأمین کرده`
          : "فاصلهٔ پیشرفت فیزیکی و مالی در محدودهٔ متعارف است";

  return {
    physicalPct: phys,
    financialPct: fin,
    gapPct: gap,
    verdict,
    verdictFa: PROGRESS_GAP_FA[verdict],
    exposureAmount: exposure,
    messageFa,
    isMaterial: verdict === "overpaid" || verdict === "underpaid",
  };
}

/* ─────────────── منحنی S ─────────────── */

export type SCurvePoint = {
  periodCode: string;
  plannedPct: number;
  actualPct: number;
  plannedAmount: number;
  actualAmount: number;
  variancePct: number;
  isForecast: boolean;
};

export type SCurve = {
  points: SCurvePoint[];
  latest: SCurvePoint | null;
  /** آخرین دوره‌ای که داده واقعی دارد. */
  dataThroughPeriod: string | null;
  maxLagPct: number;
  worstPeriod: string | null;
  warningsFa: string[];
};

/**
 * منحنی S از دوره‌های واقعی و برنامه.
 *
 * دوره‌هایی که فقط برنامه دارند و هنوز نرسیده‌اند `isForecast` می‌شوند
 * و درصد واقعی‌شان صفر **نیست** — آخرین واقعی را حمل می‌کنند. کشیدن
 * خط واقعی تا صفر در آینده، نمودار را به دره‌ای می‌اندازد که وجود
 * ندارد و مدیر را می‌ترساند.
 */
export function sCurve(input: {
  planned: { periodCode: string; cumPct?: number | null; cumAmount?: number | null }[];
  actual: { periodCode: string; cumPct?: number | null; cumAmount?: number | null }[];
}): SCurve {
  const plannedBy = new Map<string, { pct: number; amount: number }>();
  for (const p of input.planned ?? []) {
    const key = String(p.periodCode ?? "").trim();
    if (!key) continue;
    plannedBy.set(key, { pct: round(num(p.cumPct)), amount: round(num(p.cumAmount)) });
  }
  const actualBy = new Map<string, { pct: number; amount: number }>();
  for (const a of input.actual ?? []) {
    const key = String(a.periodCode ?? "").trim();
    if (!key) continue;
    actualBy.set(key, { pct: round(num(a.cumPct)), amount: round(num(a.cumAmount)) });
  }

  /* کد دوره مرتب‌شدنی است (۱۴۰۵-۰۶)، پس مرتب‌سازی متنی کافی است و
   * نیازی به تجزیهٔ تاریخ نیست. */
  const periods = [...new Set([...plannedBy.keys(), ...actualBy.keys()])].sort();

  const lastActualPeriod = [...actualBy.keys()].sort().pop() ?? null;

  const points: SCurvePoint[] = [];
  let carriedActualPct = 0;
  let carriedActualAmount = 0;

  for (const periodCode of periods) {
    const plan = plannedBy.get(periodCode) ?? { pct: 0, amount: 0 };
    const act = actualBy.get(periodCode);
    const isForecast = lastActualPeriod == null || periodCode > lastActualPeriod;

    if (act) {
      carriedActualPct = act.pct;
      carriedActualAmount = act.amount;
    }

    const actualPct = isForecast ? carriedActualPct : (act?.pct ?? carriedActualPct);
    const actualAmount = isForecast ? carriedActualAmount : (act?.amount ?? carriedActualAmount);

    points.push({
      periodCode,
      plannedPct: plan.pct,
      actualPct,
      plannedAmount: plan.amount,
      actualAmount,
      variancePct: round(actualPct - plan.pct),
      isForecast,
    });
  }

  const realPoints = points.filter((p) => !p.isForecast);
  const worst = realPoints.reduce<SCurvePoint | null>(
    (m, p) => (m == null || p.variancePct < m.variancePct ? p : m),
    null,
  );

  const warningsFa: string[] = [];
  if (!points.length) warningsFa.push("داده‌ای برای رسم منحنی S وجود ندارد");
  if (!plannedBy.size && actualBy.size) {
    warningsFa.push("برنامهٔ زمانی ثبت نشده؛ انحراف قابل سنجش نیست");
  }
  if (worst && worst.variancePct < 0) {
    warningsFa.push(`بیشترین عقب‌ماندگی ${Math.abs(worst.variancePct)}٪ در دورهٔ ${worst.periodCode}`);
  }

  return {
    points,
    latest: realPoints.length ? realPoints[realPoints.length - 1] : null,
    dataThroughPeriod: lastActualPeriod,
    maxLagPct: worst && worst.variancePct < 0 ? round(Math.abs(worst.variancePct)) : 0,
    worstPeriod: worst && worst.variancePct < 0 ? worst.periodCode : null,
    warningsFa,
  };
}

/* ─────────────── نقاط عطف مقطوع ─────────────── */

/**
 * واژگان وضعیت نقطهٔ عطف.
 *
 * دو نسل واژه اینجا کنار هم زندگی می‌کنند: مسیر قدیمی ثبت مرحله
 * `pending/claimed/verified/rejected` می‌نویسد و مسیر تازه
 * `planned/in_progress/achieved/cancelled`. یکی کردن اجباری‌شان
 * یعنی مهاجرت داده روی سطرهای موجود؛ پس هر دو شناخته می‌شوند و
 * `MILESTONE_EFFECTIVE_STATUS` معادل‌سازی می‌کند.
 */
export const MILESTONE_STATUS_FA: Record<string, string> = {
  planned: "برنامه‌ریزی‌شده",
  pending: "برنامه‌ریزی‌شده",
  in_progress: "در حال اجرا",
  achieved: "محقق‌شده",
  claimed: "محقق‌شده (ادعایی)",
  verified: "تأییدشده",
  rejected: "ردشده",
  cancelled: "لغوشده",
};

/** نگاشت واژگان قدیمی به رفتار محاسباتی. */
export const MILESTONE_EFFECTIVE_STATUS: Record<string, "planned" | "achieved" | "verified" | "dropped"> = {
  planned: "planned",
  pending: "planned",
  in_progress: "planned",
  achieved: "achieved",
  claimed: "achieved",
  verified: "verified",
  rejected: "dropped",
  cancelled: "dropped",
};

export type MilestoneRow = {
  Id?: string;
  MilestoneNo?: number | null;
  TitleFa?: string | null;
  WeightPct?: number | null;
  PlannedDate?: string | null;
  AchievedDate?: string | null;
  AchievedPct?: number | null;
  EvidenceDocNo?: string | null;
  VerifiedBy?: string | null;
  Status?: string | null;
};

export type MilestoneRollup = {
  items: (MilestoneRow & {
    statusFa: string;
    effectivePct: number;
    contributionPct: number;
    isLate: boolean;
    lateDays: number;
    needsEvidence: boolean;
  })[];
  totalWeightPct: number;
  progressPct: number;
  achievedCount: number;
  verifiedCount: number;
  lateCount: number;
  missingEvidence: number;
  warningsFa: string[];
};

/**
 * پیشرفت پیمان مقطوع از نقاط عطف.
 *
 * در پیمان مقطوع مقدار و نرخ وجود ندارد، پس پیشرفت فقط از تحقق نقاط
 * عطف می‌آید. نقطهٔ عطفِ محقق‌شدهٔ بدون سند، به شکل کامل شمرده
 * **نمی‌شود** — این همان جایی است که پیشرفت کاغذی ساخته می‌شود.
 */
export function milestoneRollup(input: {
  rows: MilestoneRow[];
  now?: Date;
  requireEvidence?: boolean;
}): MilestoneRollup {
  const now = input.now ?? new Date();
  const requireEvidence = input.requireEvidence !== false;
  /* «ردشده» هم مثل «لغوشده» از وزن‌دهی بیرون است: مرحله‌ای که رد
   * شده، کاری است که پذیرفته نشده و نباید مخرج را بزرگ کند. */
  const rows = (input.rows ?? []).filter(
    (r) => MILESTONE_EFFECTIVE_STATUS[String(r.Status ?? "planned")] !== "dropped",
  );

  let totalWeight = 0;
  let weighted = 0;
  let lateCount = 0;
  let missingEvidence = 0;

  const items = rows.map((r) => {
    const status = String(r.Status ?? "planned");
    const eff = MILESTONE_EFFECTIVE_STATUS[status] ?? "planned";
    const weight = num(r.WeightPct);
    totalWeight += weight;

    /* درصد مؤثر: «تأییدشده» صد است، «محقق‌شده» درصد اعلامی خودش را
     * دارد، بقیه صفر مگر درصد جزئی ثبت شده باشد. */
    let effective = num(r.AchievedPct);
    if (eff === "verified") effective = 100;
    else if (eff === "achieved" && effective === 0) effective = 100;

    const needsEvidence =
      requireEvidence && effective > 0 && !String(r.EvidenceDocNo ?? "").trim();
    if (needsEvidence) missingEvidence += 1;

    /* بدون سند، نقطهٔ عطف نیمه‌شمرده می‌شود: نه نادیده گرفته می‌شود
     * (که کار انجام‌شده را انکار می‌کند) نه کامل (که ادعا را قبول
     * می‌کند). */
    const counted = needsEvidence ? effective / 2 : effective;
    weighted += (weight * counted) / 100;

    let lateDays = 0;
    let isLate = false;
    const planned = String(r.PlannedDate ?? "").trim();
    if (planned && effective < 100) {
      const p = new Date(planned);
      if (!Number.isNaN(p.getTime())) {
        const diff = Math.floor((now.getTime() - p.getTime()) / 86_400_000);
        if (diff > 0) { isLate = true; lateDays = diff; }
      }
    }
    if (isLate) lateCount += 1;

    return {
      ...r,
      statusFa: MILESTONE_STATUS_FA[status] ?? status,
      effectivePct: round(effective),
      contributionPct: round((weight * counted) / 100, 4),
      isLate,
      lateDays,
      needsEvidence,
    };
  });

  totalWeight = round(totalWeight, 4);
  const progressPct = totalWeight > 0 ? round((weighted / totalWeight) * 100) : 0;

  const warningsFa: string[] = [];
  if (rows.length && Math.abs(totalWeight - 100) > 0.5) {
    warningsFa.push(`جمع وزن نقاط عطف ${totalWeight}٪ است، نه ۱۰۰٪`);
  }
  if (missingEvidence > 0) {
    warningsFa.push(`${missingEvidence} نقطهٔ عطف بدون سند پشتیبان است و نیم‌شمرده شده`);
  }
  if (lateCount > 0) {
    warningsFa.push(`${lateCount} نقطهٔ عطف از تاریخ برنامه‌ای عقب است`);
  }

  return {
    items,
    totalWeightPct: totalWeight,
    progressPct,
    achievedCount: items.filter((i) => i.effectivePct >= 100).length,
    verifiedCount: items.filter(
      (i) => MILESTONE_EFFECTIVE_STATUS[String(i.Status ?? "planned")] === "verified",
    ).length,
    lateCount,
    missingEvidence,
    warningsFa,
  };
}

/* ─────────────── تصویر یکجای پیشرفت ─────────────── */

export type ProgressSnapshot = {
  periodCode: string | null;
  physicalPct: number;
  financialPct: number;
  boqCoveragePct: number | null;
  isGapReliable: boolean;
  gap: ProgressGap;
  physical: ProgressBreakdown;
  financial: FinancialProgress;
  milestones: MilestoneRollup | null;
  /** منبعی که پیشرفت فیزیکی از آن آمده. */
  physicalSource: "boq" | "milestone" | "none";
  warningsFa: string[];
};

/**
 * تصویر کامل پیشرفت یک پیمان.
 *
 * منبع پیشرفت فیزیکی به نوع پیمان بستگی دارد: پیمان مقطوع نقطهٔ
 * عطف دارد و فهرست‌بهایش وزنی ندارد. اگر هر دو موجود باشند فهرست‌بها
 * مرجع است — دقیق‌تر است.
 */
export function progressSnapshot(input: {
  periodCode?: string | null;
  contractAmount: number;
  contractType?: string | null;
  ceilingPct?: number | null;
  boq?: ProgressBoqRow[];
  achieved?: ProgressAchievedRow[];
  ipcs?: Parameters<typeof financialProgress>[0]["ipcs"];
  milestones?: MilestoneRow[];
  now?: Date;
}): ProgressSnapshot {
  const physical = progressBreakdown({ boq: input.boq ?? [], achieved: input.achieved });
  const financial = financialProgress({
    contractAmount: input.contractAmount,
    ipcs: input.ipcs ?? [],
    ceilingPct: input.ceilingPct,
  });

  const hasMilestones = (input.milestones ?? []).length > 0;
  const milestones = hasMilestones
    ? milestoneRollup({ rows: input.milestones ?? [], now: input.now })
    : null;

  const useBoq = physical.baseAmount > 0;
  const physicalSource: ProgressSnapshot["physicalSource"] =
    useBoq ? "boq" : milestones ? "milestone" : "none";
  const physicalPct = useBoq ? physical.physicalPct : (milestones?.progressPct ?? 0);

  const gap = progressGap({
    physicalPct,
    financialPct: financial.financialPct,
    contractAmount: input.contractAmount,
  });

  const warningsFa = [
    ...physical.warningsFa,
    ...financial.warningsFa,
    ...(milestones?.warningsFa ?? []),
  ];
  if (physicalSource === "none") {
    warningsFa.unshift("نه فهرست‌بهای مبلغ‌دار ثبت شده نه نقطهٔ عطف؛ پیشرفت فیزیکی صفر فرض شد");
  }

  /* دو درصد، دو مخرج: فیزیکی بر جمع فهرست‌بها سنجیده می‌شود و مالی
   * بر مبلغ پیمان. اگر این دو با هم نخوانند، «فاصله» چیزی را نشان
   * می‌دهد که وجود ندارد — نه اضافه‌پرداخت، فقط فهرست‌بهای ناقص.
   * سکوت در این حالت بدترین کار است: عدد غلط با ظاهر معتبر. */
  const coverage = useBoq && input.contractAmount > 0
    ? round((physical.baseAmount / num(input.contractAmount)) * 100)
    : null;
  if (coverage != null && Math.abs(coverage - 100) > 5) {
    warningsFa.unshift(
      coverage < 100
        ? `فهرست‌بها تنها ${coverage}٪ مبلغ پیمان را پوشش می‌دهد؛ فاصلهٔ فیزیکی و مالی تا تکمیل آن گمراه‌کننده است`
        : `جمع فهرست‌بها ${coverage}٪ مبلغ پیمان است؛ مبلغ پیمان یا فهرست‌بها بازبینی شود`,
    );
  }
  if (gap.isMaterial) warningsFa.unshift(gap.messageFa);

  return {
    periodCode: input.periodCode ?? null,
    physicalPct,
    financialPct: financial.financialPct,
    /** درصد پوشش فهرست‌بها از مبلغ پیمان؛ `null` یعنی قابل سنجش نیست. */
    boqCoveragePct: coverage,
    /** آیا فاصله بر دو مخرج ناهمخوان سنجیده شده. */
    isGapReliable: coverage == null || Math.abs(coverage - 100) <= 5,
    gap,
    physical,
    financial,
    milestones,
    physicalSource,
    warningsFa,
  };
}

/* ══════════════════════════════════════════════════════════════════
 * بخش ۱۷ — سنجه‌های پیمان و هشدار زودهنگام (D10)
 *
 * تفاوت گزارش و هشدار: گزارش می‌گوید «چه شد»، هشدار می‌گوید «اگر
 * کاری نکنی چه می‌شود». یک سامانه که فقط گزارش می‌دهد، مدیر را
 * تماشاچیِ باخت خودش می‌کند.
 *
 * دو اصل حاکم بر این بخش:
 *
 *   ۱. روند مهم‌تر از سطح است. پیمانی با ۴۰٪ انحراف که دارد بهبود
 *      می‌یابد، وضعش از پیمانی با ۲۰٪ انحرافِ رو به بدترشدن بهتر است.
 *
 *   ۲. هشدار بدون آستانه، نویز است. آستانه باید قابل تنظیم باشد و
 *      هشداری که همیشه روشن است، هشدار نیست — تزئین است.
 * ══════════════════════════════════════════════════════════════════ */

export type KpiDirection = "higher_better" | "lower_better" | "target_100";

export type KpiUnit = "pct" | "days" | "count" | "amount";

export type KpiSpec = {
  code: string;
  titleFa: string;
  unit: KpiUnit;
  direction: KpiDirection;
  /** وزن در نمرهٔ سلامت؛ صفر یعنی فقط گزارشی است. */
  weight: number;
  hintFa: string;
};

/**
 * فهرست سنجه‌های پیمان.
 *
 * وزن‌ها جمعشان صد نیست و نباید باشد: نمرهٔ سلامت بر جمع وزنِ
 * سنجه‌های **قابل محاسبه** نرمال می‌شود، نه بر عدد ثابت. پیمانی که
 * هنوز پیش‌پرداخت ندارد نباید بابت نداشتنش نمره از دست بدهد.
 */
export const CONTRACT_KPI_CATALOG: KpiSpec[] = [
  {
    code: "physical_pct", titleFa: "پیشرفت فیزیکی", unit: "pct",
    direction: "higher_better", weight: 0,
    hintFa: "کارِ تأییدشده نسبت به کل — مبنای مقایسه، نه خودش نمره",
  },
  {
    code: "financial_pct", titleFa: "پیشرفت مالی", unit: "pct",
    direction: "higher_better", weight: 0,
    hintFa: "پولِ تأییدشده نسبت به مبلغ پیمان",
  },
  {
    code: "progress_gap_pct", titleFa: "فاصلهٔ مالی و فیزیکی", unit: "pct",
    direction: "lower_better", weight: 25,
    hintFa: "مثبت یعنی پول جلوتر از کار رفته",
  },
  {
    code: "ceiling_used_pct", titleFa: "مصرف سقف", unit: "pct",
    direction: "lower_better", weight: 20,
    hintFa: "کارکرد نسبت به سقف مجاز شامل ۲۵٪ ماده ۲۹",
  },
  {
    code: "advance_recovered_pct", titleFa: "بازیافت پیش‌پرداخت", unit: "pct",
    direction: "higher_better", weight: 15,
    hintFa: "چه سهمی از پیش‌پرداخت بازگشته",
  },
  {
    code: "extra_work_ratio_pct", titleFa: "نسبت کار جدید", unit: "pct",
    direction: "lower_better", weight: 15,
    hintFa: "سهم ردیف‌های ستاره‌دار و تغییر مقادیر از کارکرد",
  },
  {
    code: "avg_ipc_cycle_days", titleFa: "میانگین چرخهٔ صورت‌وضعیت", unit: "days",
    direction: "lower_better", weight: 15,
    hintFa: "از ارسال تا تأیید کارفرما",
  },
  {
    code: "open_guarantee_count", titleFa: "ضمانت‌نامهٔ باز", unit: "count",
    direction: "lower_better", weight: 0,
    hintFa: "تعداد وثیقهٔ در جریان",
  },
  {
    code: "expiring_guarantee_count", titleFa: "ضمانت‌نامهٔ رو به انقضا", unit: "count",
    direction: "lower_better", weight: 10,
    hintFa: "کمتر از ۳۰ روز تا سررسید",
  },
  {
    code: "retainage_balance", titleFa: "ماندهٔ حسن انجام کار", unit: "amount",
    direction: "higher_better", weight: 0,
    hintFa: "سپردهٔ کسرشده و آزادنشده",
  },
];

export const KPI_BY_CODE: Record<string, KpiSpec> = Object.fromEntries(
  CONTRACT_KPI_CATALOG.map((k) => [k.code, k]),
);

/* ─────────────── چرخهٔ صورت‌وضعیت ─────────────── */

export type IpcCycleRow = {
  Id?: string;
  SerialNo?: number | null;
  WorkflowState?: string | null;
  SubmittedAt?: string | null;
  ConsultantApprovedAt?: string | null;
  EmployerApprovedAt?: string | null;
  PaidAt?: string | null;
  Status?: string | null;
};

export type IpcCycle = {
  closed: { serialNo: number | null; days: number; consultantDays: number | null }[];
  open: { serialNo: number | null; ageDays: number; stage: string; stageFa: string }[];
  avgDays: number;
  maxDays: number;
  /** میانگینی که صورت‌وضعیت‌های گیرکرده را هم می‌بیند. */
  avgIncludingOpenDays: number;
  openCount: number;
  oldestOpenDays: number;
  warningsFa: string[];
};

const IPC_STAGE_FA: Record<string, string> = {
  submitted: "منتظر بررسی مشاور",
  consultant_approved: "منتظر تأیید کارفرما",
  reviewed: "منتظر تأیید کارفرما",
  approved: "منتظر پرداخت",
};

/**
 * فاصلهٔ روز، هرگز منفی.
 *
 * `daysBetween` موجود (بخش ضمانت‌نامه) هر دو سر بازه را به نیمه‌شب
 * می‌برد تا ساعت ثبت نتواند یک روز را جابه‌جا کند؛ همان مبنا اینجا
 * هم درست است. تنها تفاوت: چرخهٔ منفی بی‌معناست (تأیید پیش از
 * ارسال) و به صفر کلمپ می‌شود، نه اینکه میانگین را خراب کند.
 */
function cycleDays(a: string | null | undefined, b: string | null | undefined): number | null {
  const d = daysBetween(String(a ?? "").trim() || null, String(b ?? "").trim() || null);
  return d == null ? null : Math.max(0, d);
}

/**
 * چرخهٔ عمر صورت‌وضعیت‌ها.
 *
 * **دام بقا:** میانگینِ فقط صورت‌وضعیت‌های بسته، همان‌هایی را می‌شمارد
 * که سریع پیش رفته‌اند. صورت‌وضعیتی که شش ماه است روی میز کارفرما
 * خاک می‌خورد، چون هنوز تأیید نشده از محاسبه بیرون می‌ماند — و
 * میانگین را مصنوعاً کوتاه و دلگرم‌کننده نشان می‌دهد.
 *
 * پس دو عدد برمی‌گردد: میانگین بسته‌ها، و میانگینی که سن
 * صورت‌وضعیت‌های باز را هم به حساب می‌آورد. عدد دوم آن است که باید
 * در تابلو دیده شود.
 */
export function ipcCycle(input: { rows: IpcCycleRow[]; now?: Date }): IpcCycle {
  const now = input.now ?? new Date();
  const rows = (input.rows ?? []).filter((r) => String(r.Status ?? "open") !== "cancelled");

  const closed: IpcCycle["closed"] = [];
  const open: IpcCycle["open"] = [];

  for (const r of rows) {
    const state = String(r.WorkflowState ?? "draft");
    const submitted = String(r.SubmittedAt ?? "").trim();
    if (!submitted) continue;  /* هنوز ارسال نشده: چرخه‌ای شروع نشده */

    const end = String(r.EmployerApprovedAt ?? "").trim();
    if (end) {
      const days = cycleDays(submitted, end);
      if (days != null) {
        closed.push({
          serialNo: r.SerialNo ?? null,
          days,
          consultantDays: cycleDays(submitted, r.ConsultantApprovedAt),
        });
      }
      continue;
    }

    if (["approved", "paid"].includes(state)) continue;  /* بسته ولی بی‌تاریخ */

    const age = cycleDays(submitted, now.toISOString());
    if (age != null) {
      open.push({
        serialNo: r.SerialNo ?? null,
        ageDays: age,
        stage: state,
        stageFa: IPC_STAGE_FA[state] ?? state,
      });
    }
  }

  const closedDays = closed.map((c) => c.days);
  const avgDays = closedDays.length
    ? round(closedDays.reduce((s, d) => s + d, 0) / closedDays.length, 1)
    : 0;
  const maxDays = closedDays.length ? Math.max(...closedDays) : 0;

  const allDays = [...closedDays, ...open.map((o) => o.ageDays)];
  const avgIncludingOpenDays = allDays.length
    ? round(allDays.reduce((s, d) => s + d, 0) / allDays.length, 1)
    : 0;

  const oldestOpenDays = open.length ? Math.max(...open.map((o) => o.ageDays)) : 0;

  const warningsFa: string[] = [];
  if (open.length && avgIncludingOpenDays > avgDays + 5) {
    warningsFa.push(
      `میانگین با احتساب ${open.length} صورت‌وضعیت باز ${avgIncludingOpenDays} روز است، نه ${avgDays} روز`,
    );
  }
  if (oldestOpenDays > 60) {
    const worst = open.find((o) => o.ageDays === oldestOpenDays);
    warningsFa.push(
      `صورت‌وضعیت ${worst?.serialNo ?? "—"} پس از ${oldestOpenDays} روز هنوز ${worst?.stageFa ?? "باز"} است`,
    );
  }

  return {
    closed: closed.sort((a, b) => (a.serialNo ?? 0) - (b.serialNo ?? 0)),
    open: open.sort((a, b) => b.ageDays - a.ageDays),
    avgDays,
    maxDays,
    avgIncludingOpenDays,
    openCount: open.length,
    oldestOpenDays,
    warningsFa,
  };
}

/* ─────────────── نسبت کار جدید ─────────────── */

export type ExtraWorkRatio = {
  starredAmount: number;
  changeAmount: number;
  extraTotal: number;
  baseAmount: number;
  ratioPct: number;
  /** آیا اصلاً داده‌ای برای سنجش بوده. */
  isMeasurable: boolean;
  starredCount: number;
  changeCount: number;
  warningsFa: string[];
};

/**
 * سهم کار جدید از کارکرد.
 *
 * دو منبع دارد: ردیف ستاره‌دار (قیمت جدید) و تغییر مقادیر. جمعشان
 * نسبت به مبلغ **اولیه** سنجیده می‌شود نه جاری — چون مبلغ جاری خودش
 * شامل همین اضافات است و نسبت را به‌طور مصنوعی کوچک می‌کند.
 */
export function extraWorkRatio(input: {
  boq: { LineAmount?: number | null; ContractQty?: number | null; UnitRate?: number | null; LumpSumAmount?: number | null; IsStarred?: unknown; Status?: string | null }[];
  changes?: { Amount?: number | null; DeltaAmount?: number | null; Status?: string | null }[];
  initialAmount: number;
}): ExtraWorkRatio {
  const base = round(num(input.initialAmount));

  const live = (input.boq ?? []).filter((x) => String(x.Status ?? "active") !== "cancelled");
  const starred = live.filter((x) => x.IsStarred === true || x.IsStarred === 1 || x.IsStarred === "1");
  const starredAmount = round(starred.reduce((s, x) => s + boqLineAmount(x), 0));

  const changeRows = (input.changes ?? []).filter((x) => String(x.Status ?? "approved") !== "cancelled");
  const changeAmount = round(
    changeRows.reduce((s, x) => s + (num(x.DeltaAmount) || num(x.Amount)), 0),
  );

  const extraTotal = round(starredAmount + changeAmount);
  const ratioPct = base > 0 ? round((extraTotal / base) * 100) : 0;
  /* پیمانی که هنوز فهرست‌بها ندارد، «صفر درصد کار جدید» ندارد —
   * هیچ نمی‌دانیم. صفر یک ادعاست و نمرهٔ سلامت را الکی بالا می‌برد. */
  const isMeasurable = live.length > 0 || changeRows.length > 0;

  const warningsFa: string[] = [];
  if (base <= 0) warningsFa.push("مبلغ اولیهٔ پیمان صفر است؛ نسبت کار جدید معنا ندارد");
  if (ratioPct > 25) {
    warningsFa.push(`کار جدید ${ratioPct}٪ مبلغ اولیه است و از سقف ماده ۲۹ عبور کرده`);
  }

  return {
    starredAmount, changeAmount, extraTotal, baseAmount: base, ratioPct,
    isMeasurable,
    starredCount: starred.length,
    changeCount: changeRows.length,
    warningsFa,
  };
}

/* ─────────────── محاسبهٔ سنجه‌ها ─────────────── */

export type KpiValue = {
  code: string;
  titleFa: string;
  unit: KpiUnit;
  direction: KpiDirection;
  value: number | null;
  /** متن آمادهٔ نمایش با واحد. */
  displayFa: string;
  isComputable: boolean;
};

export type ContractKpis = {
  periodCode: string | null;
  values: KpiValue[];
  byCode: Record<string, number | null>;
  computableCount: number;
  warningsFa: string[];
};

function kpiDisplay(value: number | null, unit: KpiUnit): string {
  if (value == null) return "—";
  if (unit === "pct") return `${round(value)}٪`;
  if (unit === "days") return `${round(value, 1)} روز`;
  if (unit === "count") return String(Math.round(value));
  return String(round(value));
}

/**
 * محاسبهٔ سنجه‌های یک پیمان از ورودی‌های پراکنده.
 *
 * سنجهٔ محاسبه‌ناپذیر `null` می‌شود، نه صفر. صفر یک ادعاست («اندازه
 * گرفتیم، صفر بود») و `null` یک اعتراف («نمی‌دانیم»). قاطی کردنشان
 * یعنی تابلویی پر از صفرهای دروغین.
 */
export function contractKpis(input: {
  periodCode?: string | null;
  physicalPct?: number | null;
  financialPct?: number | null;
  gapPct?: number | null;
  ceilingUsedPct?: number | null;
  advanceRecoveredPct?: number | null;
  extraWorkRatioPct?: number | null;
  avgIpcCycleDays?: number | null;
  openGuaranteeCount?: number | null;
  expiringGuaranteeCount?: number | null;
  retainageBalance?: number | null;
}): ContractKpis {
  const raw: Record<string, number | null | undefined> = {
    physical_pct: input.physicalPct,
    financial_pct: input.financialPct,
    progress_gap_pct: input.gapPct,
    ceiling_used_pct: input.ceilingUsedPct,
    advance_recovered_pct: input.advanceRecoveredPct,
    extra_work_ratio_pct: input.extraWorkRatioPct,
    avg_ipc_cycle_days: input.avgIpcCycleDays,
    open_guarantee_count: input.openGuaranteeCount,
    expiring_guarantee_count: input.expiringGuaranteeCount,
    retainage_balance: input.retainageBalance,
  };

  const values: KpiValue[] = CONTRACT_KPI_CATALOG.map((spec) => {
    const v = raw[spec.code];
    const value = v == null || !Number.isFinite(Number(v)) ? null : round(Number(v));
    return {
      code: spec.code,
      titleFa: spec.titleFa,
      unit: spec.unit,
      direction: spec.direction,
      value,
      displayFa: kpiDisplay(value, spec.unit),
      isComputable: value != null,
    };
  });

  const byCode = Object.fromEntries(values.map((v) => [v.code, v.value]));
  const computableCount = values.filter((v) => v.isComputable).length;

  const warningsFa: string[] = [];
  if (computableCount < 4) {
    warningsFa.push("دادهٔ کافی برای سنجش سلامت پیمان وجود ندارد");
  }

  return {
    periodCode: input.periodCode ?? null,
    values,
    byCode,
    computableCount,
    warningsFa,
  };
}

/* ─────────────── قواعد هشدار زودهنگام ─────────────── */

export type AlertSeverity = "info" | "warning" | "critical";

export const ALERT_SEVERITY_FA: Record<AlertSeverity, string> = {
  info: "اطلاعی",
  warning: "هشدار",
  critical: "بحرانی",
};

export const ALERT_SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 1, warning: 2, critical: 3,
};

export type AlertRuleSpec = {
  code: string;
  titleFa: string;
  kpi: string;
  /** جهت مقایسه: مقدار از آستانه بیشتر شود یا کمتر. */
  op: "gt" | "lt";
  threshold: number;
  severity: AlertSeverity;
  actionFa: string;
};

/**
 * قواعد پیش‌فرض هشدار.
 *
 * هر قاعده یک **اقدام** دارد، نه فقط یک جمله. هشداری که نمی‌گوید چه
 * باید کرد، فقط اضطراب تولید می‌کند.
 */
export const DEFAULT_ALERT_RULES: AlertRuleSpec[] = [
  {
    code: "EWS-01", titleFa: "اضافه‌پرداخت به پیمانکار",
    kpi: "progress_gap_pct", op: "gt", threshold: 10, severity: "critical",
    actionFa: "پیش از تأیید صورت‌وضعیت بعدی، تطبیق متره با کارکرد واقعی الزامی است",
  },
  {
    code: "EWS-02", titleFa: "کارکرد تأییدنشدهٔ انباشته",
    kpi: "progress_gap_pct", op: "lt", threshold: -15, severity: "warning",
    actionFa: "علت تأخیر در تأیید صورت‌وضعیت بررسی شود؛ ریسک ادعای پیمانکار",
  },
  {
    code: "EWS-03", titleFa: "نزدیک شدن به سقف پیمان",
    kpi: "ceiling_used_pct", op: "gt", threshold: 90, severity: "critical",
    actionFa: "تشریفات الحاقیه پیش از رسیدن به سقف آغاز شود",
  },
  {
    code: "EWS-04", titleFa: "کار جدید فراتر از ماده ۲۹",
    kpi: "extra_work_ratio_pct", op: "gt", threshold: 25, severity: "critical",
    actionFa: "کار جدید بدون الحاقیه قابل پرداخت نیست؛ مصوبه اخذ شود",
  },
  {
    code: "EWS-05", titleFa: "کندی چرخهٔ صورت‌وضعیت",
    kpi: "avg_ipc_cycle_days", op: "gt", threshold: 45, severity: "warning",
    actionFa: "گلوگاه بررسی شناسایی شود؛ تأخیر پرداخت به ادعای خسارت می‌انجامد",
  },
  {
    code: "EWS-06", titleFa: "بازیافت کند پیش‌پرداخت",
    kpi: "advance_recovered_pct", op: "lt", threshold: 30, severity: "warning",
    actionFa: "نرخ کسر پیش‌پرداخت با پیشرفت کار بازبینی شود",
  },
  {
    code: "EWS-07", titleFa: "ضمانت‌نامهٔ رو به انقضا",
    kpi: "expiring_guarantee_count", op: "gt", threshold: 0, severity: "critical",
    actionFa: "تمدید یا ضبط پیش از سررسید؛ پس از انقضا پوشش از بین می‌رود",
  },
];

export type FiredAlert = {
  code: string;
  titleFa: string;
  kpi: string;
  kpiTitleFa: string;
  severity: AlertSeverity;
  severityFa: string;
  value: number;
  threshold: number;
  op: "gt" | "lt";
  messageFa: string;
  actionFa: string;
};

export type AlertVerdict = {
  fired: FiredAlert[];
  criticalCount: number;
  warningCount: number;
  /** قواعدی که به‌خاطر نبود داده اصلاً سنجیده نشدند. */
  skipped: { code: string; titleFa: string; reasonFa: string }[];
  topSeverity: AlertSeverity | null;
  summaryFa: string;
};

/**
 * سنجش قواعد هشدار روی سنجه‌ها.
 *
 * قاعده‌ای که سنجهٔ لازمش `null` است **رد نمی‌شود، کنار گذاشته
 * می‌شود** و در `skipped` گزارش می‌گردد. سکوت به‌جای هشدار، بدترین
 * حالت است: مدیر فرض می‌کند بررسی شده و مشکلی نبوده.
 */
export function evaluateAlerts(input: {
  kpis: ContractKpis;
  rules?: AlertRuleSpec[];
  /** بازنویسی آستانه از جدول `ContractAlertRule`. */
  overrides?: { RuleCode?: string | null; ThresholdValue?: number | null; Severity?: string | null; IsEnabled?: unknown }[];
}): AlertVerdict {
  const overrideBy = new Map<string, { threshold?: number; severity?: AlertSeverity; enabled: boolean }>();
  for (const o of input.overrides ?? []) {
    const code = String(o.RuleCode ?? "").trim();
    if (!code) continue;
    const enabled = !(o.IsEnabled === false || o.IsEnabled === 0 || o.IsEnabled === "0");
    const t = o.ThresholdValue;
    const sev = String(o.Severity ?? "") as AlertSeverity;
    overrideBy.set(code, {
      threshold: t == null || !Number.isFinite(Number(t)) ? undefined : Number(t),
      severity: (["info", "warning", "critical"] as const).includes(sev) ? sev : undefined,
      enabled,
    });
  }

  const rules = input.rules ?? DEFAULT_ALERT_RULES;
  const fired: FiredAlert[] = [];
  const skipped: AlertVerdict["skipped"] = [];

  for (const rule of rules) {
    const ov = overrideBy.get(rule.code);
    if (ov && !ov.enabled) continue;  /* عمداً خاموش شده: سکوت آگاهانه است */

    const value = input.kpis.byCode[rule.kpi];
    if (value == null) {
      skipped.push({
        code: rule.code,
        titleFa: rule.titleFa,
        reasonFa: `سنجهٔ «${KPI_BY_CODE[rule.kpi]?.titleFa ?? rule.kpi}» محاسبه‌پذیر نیست`,
      });
      continue;
    }

    const threshold = ov?.threshold ?? rule.threshold;
    const severity = ov?.severity ?? rule.severity;
    const hit = rule.op === "gt" ? value > threshold : value < threshold;
    if (!hit) continue;

    const spec = KPI_BY_CODE[rule.kpi];
    fired.push({
      code: rule.code,
      titleFa: rule.titleFa,
      kpi: rule.kpi,
      kpiTitleFa: spec?.titleFa ?? rule.kpi,
      severity,
      severityFa: ALERT_SEVERITY_FA[severity],
      value,
      threshold,
      op: rule.op,
      messageFa: `${spec?.titleFa ?? rule.kpi} برابر ${kpiDisplay(value, spec?.unit ?? "pct")} است؛ آستانه ${kpiDisplay(threshold, spec?.unit ?? "pct")}`,
      actionFa: rule.actionFa,
    });
  }

  fired.sort((a, b) => ALERT_SEVERITY_RANK[b.severity] - ALERT_SEVERITY_RANK[a.severity]);

  const criticalCount = fired.filter((f) => f.severity === "critical").length;
  const warningCount = fired.filter((f) => f.severity === "warning").length;
  const topSeverity = fired.length ? fired[0].severity : null;

  const summaryFa = fired.length === 0
    ? (skipped.length
      ? `هشداری فعال نیست، ولی ${skipped.length} قاعده به‌دلیل نبود داده سنجیده نشد`
      : "هیچ هشداری فعال نیست")
    : `${criticalCount} بحرانی و ${warningCount} هشدار فعال است`;

  return { fired, criticalCount, warningCount, skipped, topSeverity, summaryFa };
}

/* ─────────────── نمرهٔ سلامت ─────────────── */

export type HealthBand = "good" | "watch" | "poor" | "unknown";

export const HEALTH_BAND_FA: Record<HealthBand, string> = {
  good: "سالم",
  watch: "نیازمند مراقبت",
  poor: "بحرانی",
  unknown: "قابل سنجش نیست",
};

export type ContractHealth = {
  score: number | null;
  band: HealthBand;
  bandFa: string;
  /** سهم هر سنجه در نمره، برای اینکه نمره جعبهٔ سیاه نباشد. */
  contributions: { code: string; titleFa: string; normalized: number; weight: number; penaltyFa: string | null }[];
  weightCovered: number;
  messageFa: string;
};

/** نرمال‌سازی یک سنجه به بازهٔ ۰ (بد) تا ۱۰۰ (خوب). */
function normalizeKpi(code: string, value: number): number {
  switch (code) {
    case "progress_gap_pct": {
      /* فاصله در هر دو جهت بد است، ولی اضافه‌پرداخت بدتر: پول رفته و
       * برگرداندنش دعوا می‌خواهد، در حالی که کارِ تأییدنشده هنوز
       * قابل تأیید است. */
      const g = value;
      const penalty = g > 0 ? g * 4 : Math.abs(g) * 2;
      return Math.max(0, 100 - penalty);
    }
    case "ceiling_used_pct":
      /* تا ۷۵٪ سالم؛ از آنجا تا ۱۰۰٪ افت تند. */
      return value <= 75 ? 100 : Math.max(0, 100 - (value - 75) * 4);
    case "advance_recovered_pct":
      return Math.max(0, Math.min(100, value));
    case "extra_work_ratio_pct":
      /* ۲۵٪ سقف قانونی است؛ رسیدن به آن یعنی صفر. */
      return Math.max(0, 100 - (value / 25) * 100);
    case "avg_ipc_cycle_days":
      /* ۳۰ روز متعارف، ۹۰ روز فاجعه. */
      return value <= 30 ? 100 : Math.max(0, 100 - ((value - 30) / 60) * 100);
    case "expiring_guarantee_count":
      return value <= 0 ? 100 : Math.max(0, 100 - value * 34);
    default:
      return Math.max(0, Math.min(100, value));
  }
}

/**
 * نمرهٔ سلامت پیمان.
 *
 * میانگین وزنی بر **وزن پوشش‌داده‌شده** نرمال می‌شود، نه بر جمع کل
 * وزن‌ها. پیمانی که پیش‌پرداخت ندارد نباید بابت نداشتن سنجهٔ بازیافت
 * نمره از دست بدهد — نداشتن داده با بد بودن یکی نیست.
 *
 * اگر کمتر از نیمی از وزن پوشش داده شود، نمره اصلاً برنمی‌گردد:
 * عددی که بر پایهٔ یک‌سوم داده ساخته شده، دقتی را ادعا می‌کند که
 * ندارد.
 */
export function contractHealth(input: { kpis: ContractKpis; minCoveragePct?: number }): ContractHealth {
  const minCoverage = input.minCoveragePct ?? 50;
  const scored = CONTRACT_KPI_CATALOG.filter((s) => s.weight > 0);
  const totalWeight = scored.reduce((s, k) => s + k.weight, 0);

  const contributions: ContractHealth["contributions"] = [];
  let weighted = 0;
  let covered = 0;

  for (const spec of scored) {
    const value = input.kpis.byCode[spec.code];
    if (value == null) continue;
    const normalized = round(normalizeKpi(spec.code, value), 1);
    weighted += normalized * spec.weight;
    covered += spec.weight;
    contributions.push({
      code: spec.code,
      titleFa: spec.titleFa,
      normalized,
      weight: spec.weight,
      penaltyFa: normalized < 60 ? `${spec.titleFa} نمره را پایین کشیده` : null,
    });
  }

  const weightCovered = totalWeight > 0 ? round((covered / totalWeight) * 100) : 0;

  if (covered <= 0 || weightCovered < minCoverage) {
    return {
      score: null,
      band: "unknown",
      bandFa: HEALTH_BAND_FA.unknown,
      contributions,
      weightCovered,
      messageFa: `تنها ${weightCovered}٪ از وزن سنجه‌ها داده دارد؛ نمرهٔ سلامت با این پوشش گمراه‌کننده است`,
    };
  }

  const score = round(weighted / covered, 1);
  const band: HealthBand = score >= 75 ? "good" : score >= 50 ? "watch" : "poor";

  const worst = [...contributions].sort((a, b) => a.normalized - b.normalized)[0];
  const messageFa = band === "good"
    ? "سنجه‌های پیمان در محدودهٔ سالم است"
    : `${HEALTH_BAND_FA[band]} — ضعیف‌ترین سنجه: ${worst?.titleFa ?? "—"}`;

  return {
    score,
    band,
    bandFa: HEALTH_BAND_FA[band],
    contributions: contributions.sort((a, b) => a.normalized - b.normalized),
    weightCovered,
    messageFa,
  };
}

/* ─────────────── روند بین دوره‌ها ─────────────── */

export type TrendDirection = "improving" | "worsening" | "flat" | "unknown";

export const TREND_FA: Record<TrendDirection, string> = {
  improving: "رو به بهبود",
  worsening: "رو به بدترشدن",
  flat: "بدون تغییر معنادار",
  unknown: "قابل سنجش نیست",
};

export type KpiTrend = {
  code: string;
  titleFa: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
  direction: TrendDirection;
  directionFa: string;
  /** آیا این تغییر آن‌قدر هست که ارزش دیدن داشته باشد. */
  isSignificant: boolean;
};

export type TrendReport = {
  periods: string[];
  trends: KpiTrend[];
  worsening: KpiTrend[];
  improving: KpiTrend[];
  /** هشدار روندی: چیزی که هنوز از آستانه رد نشده ولی دارد می‌رود. */
  emergingFa: string[];
  summaryFa: string;
};

/** آستانهٔ تغییر معنادار به تفکیک واحد. */
const TREND_NOISE: Record<KpiUnit, number> = { pct: 2, days: 3, count: 0.5, amount: 0 };

/**
 * روند سنجه‌ها بین دو دورهٔ متوالی.
 *
 * ارزش این تابع در `emergingFa` است: سنجه‌ای که هنوز از آستانهٔ
 * هشدار رد نشده ولی با همین شیب، دورهٔ بعد رد می‌کند. این تنها جای
 * سامانه است که پیش از وقوع حرف می‌زند — بقیه پس از وقوع گزارش
 * می‌دهند.
 */
export function kpiTrend(input: {
  snapshots: { PeriodCode?: string | null; [k: string]: unknown }[];
  rules?: AlertRuleSpec[];
}): TrendReport {
  const COLUMN_BY_KPI: Record<string, string> = {
    physical_pct: "PhysicalPct",
    financial_pct: "FinancialPct",
    progress_gap_pct: "VariancePct",
    ceiling_used_pct: "CeilingUsedPct",
    advance_recovered_pct: "AdvanceRecoveredPct",
    extra_work_ratio_pct: "ExtraWorkRatioPct",
    avg_ipc_cycle_days: "AvgIpcCycleDays",
    open_guarantee_count: "OpenGuaranteeCount",
    retainage_balance: "RetainageBalance",
  };

  const sorted = [...(input.snapshots ?? [])]
    .filter((s) => String(s.PeriodCode ?? "").trim())
    .sort((a, b) => String(a.PeriodCode).localeCompare(String(b.PeriodCode)));

  const periods = sorted.map((s) => String(s.PeriodCode));

  if (sorted.length < 2) {
    return {
      periods,
      trends: [],
      worsening: [],
      improving: [],
      emergingFa: [],
      summaryFa: sorted.length === 0
        ? "هیچ عکس دوره‌ای ثبت نشده است"
        : "تنها یک دوره ثبت شده؛ روند از دو دوره به بعد معنا دارد",
    };
  }

  const cur = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];

  const trends: KpiTrend[] = [];
  for (const spec of CONTRACT_KPI_CATALOG) {
    const col = COLUMN_BY_KPI[spec.code];
    if (!col) continue;
    const c = cur[col];
    const p = prev[col];
    const current = c == null || !Number.isFinite(Number(c)) ? null : round(Number(c));
    const previous = p == null || !Number.isFinite(Number(p)) ? null : round(Number(p));

    if (current == null || previous == null) {
      trends.push({
        code: spec.code, titleFa: spec.titleFa, current, previous, delta: null,
        direction: "unknown", directionFa: TREND_FA.unknown, isSignificant: false,
      });
      continue;
    }

    const delta = round(current - previous);
    const noise = TREND_NOISE[spec.unit] ?? 0;
    const isSignificant = Math.abs(delta) > noise;

    /* «بهبود» به جهت سنجه بستگی دارد، نه به علامت عدد: کاهش چرخهٔ
     * صورت‌وضعیت بهبود است، کاهش پیشرفت فیزیکی فاجعه. */
    let direction: TrendDirection = "flat";
    if (isSignificant) {
      const better = spec.direction === "lower_better" ? delta < 0 : delta > 0;
      direction = better ? "improving" : "worsening";
    }

    trends.push({
      code: spec.code, titleFa: spec.titleFa, current, previous, delta,
      direction, directionFa: TREND_FA[direction], isSignificant,
    });
  }

  const worsening = trends.filter((t) => t.direction === "worsening");
  const improving = trends.filter((t) => t.direction === "improving");

  /* پیش‌بینی خطی یک دوره جلوتر. */
  const emergingFa: string[] = [];
  for (const rule of input.rules ?? DEFAULT_ALERT_RULES) {
    const t = trends.find((x) => x.code === rule.kpi);
    if (!t || t.current == null || t.delta == null || t.direction !== "worsening") continue;

    const alreadyFired = rule.op === "gt" ? t.current > rule.threshold : t.current < rule.threshold;
    if (alreadyFired) continue;  /* از قبل هشدار داده شده، «نوظهور» نیست */

    const next = round(t.current + t.delta);
    const willFire = rule.op === "gt" ? next > rule.threshold : next < rule.threshold;
    if (willFire) {
      emergingFa.push(
        `${rule.titleFa}: ${t.titleFa} از ${t.previous} به ${t.current} رفته؛ با همین شیب دورهٔ بعد از آستانهٔ ${rule.threshold} رد می‌شود`,
      );
    }
  }

  const summaryFa = emergingFa.length
    ? `${emergingFa.length} سنجه در مسیر عبور از آستانه است`
    : worsening.length
      ? `${worsening.length} سنجه بدتر و ${improving.length} سنجه بهتر شده است`
      : "روند سنجه‌ها پایدار یا رو به بهبود است";

  return { periods, trends, worsening, improving, emergingFa, summaryFa };
}

/* ─────────────── تابلوی یکجا ─────────────── */

export type ContractScorecard = {
  contractId: string | null;
  periodCode: string | null;
  kpis: ContractKpis;
  health: ContractHealth;
  alerts: AlertVerdict;
  trend: TrendReport;
  headlineFa: string;
};

/**
 * تابلوی سلامت پیمان: سنجه، نمره، هشدار و روند در یک شیء.
 *
 * `headlineFa` عمداً یک جمله است: اگر مدیر فقط یک سطر بخواند، آن سطر
 * باید مهم‌ترین چیز باشد — و مهم‌ترین چیز، هشدار بحرانی است نه نمره.
 */
export function contractScorecard(input: {
  contractId?: string | null;
  periodCode?: string | null;
  kpis: ContractKpis;
  snapshots?: { PeriodCode?: string | null; [k: string]: unknown }[];
  overrides?: Parameters<typeof evaluateAlerts>[0]["overrides"];
  rules?: AlertRuleSpec[];
}): ContractScorecard {
  const alerts = evaluateAlerts({ kpis: input.kpis, rules: input.rules, overrides: input.overrides });
  const health = contractHealth({ kpis: input.kpis });
  const trend = kpiTrend({ snapshots: input.snapshots ?? [], rules: input.rules });

  const headlineFa = alerts.criticalCount > 0
    ? `${alerts.criticalCount} هشدار بحرانی: ${alerts.fired[0].titleFa}`
    : trend.emergingFa.length > 0
      ? trend.emergingFa[0]
      : alerts.warningCount > 0
        ? `${alerts.warningCount} هشدار فعال: ${alerts.fired[0].titleFa}`
        : health.score == null
          ? health.messageFa
          : `نمرهٔ سلامت ${health.score} — ${health.bandFa}`;

  return {
    contractId: input.contractId ?? null,
    periodCode: input.periodCode ?? null,
    kpis: input.kpis,
    health,
    alerts,
    trend,
    headlineFa,
  };
}

/* ════════════════════════════════════════════════════════════════════
 * بخش ۱۸ — پل CNT → FIN (G-03)
 *
 * تا اینجا ماژول پیمان یک جزیرهٔ مالی بود: صورت‌وضعیت تأیید و پرداخت
 * می‌شد ولی هیچ عددی به حساب هزینهٔ پروژه نمی‌رسید. مدیر مالی جمع
 * تعهدات را از فایل اکسل جدا نگه می‌داشت و دو عدد هیچ‌وقت نمی‌خواندند.
 *
 * چهار قید سختی که این پل را از یک «کپی عدد» جدا می‌کند:
 *
 * ۱. فقط صورت‌وضعیت تأییدشده ارسال می‌شود. پیش‌نویس تعهد نیست.
 *
 * ۲. ایدمپوتنت با کلید `IpcId`. ارسال دوباره سطر دوم نمی‌سازد؛ سهم
 *    قبلی همان صورت‌وضعیت کسر و سهم تازه جایگزین می‌شود. بدون این،
 *    یک کلیک اضافی جمع Actual را دوبرابر می‌کند.
 *
 * ۳. دومرحله‌ای: پیش‌نمایش بدون اثر، سپس اعمال. کسی نباید با یک
 *    درخواست GET-مانند دفتر مالی را تغییر دهد.
 *
 * ۴. حساب هزینه حدس زده نمی‌شود. پیمان بدون `CostAccountCode` ارسال
 *    نمی‌شود — نشاندن پول روی حساب اشتباه بدتر از نفرستادن آن است،
 *    چون خطای دوم دیده می‌شود و اولی نه.
 * ════════════════════════════════════════════════════════════════════ */

/** وضعیت‌هایی که از نظر مالی «قطعی» شمرده می‌شوند. */
export const FIN_POSTABLE_STATES = ["approved", "paid"] as const;

/** دلیل رد ارسال، به زبان کسی که باید رفعش کند. */
export const FIN_BLOCK_REASON_FA: Record<string, string> = {
  not_approved: "صورت‌وضعیت هنوز تأیید نهایی نشده است",
  no_cost_account: "برای این پیمان حساب هزینه تعیین نشده است",
  account_missing: "حساب هزینهٔ تعیین‌شده در دفتر مالی پیدا نشد",
  zero_amount: "مبلغ خالص پرداختنی صفر است",
  cancelled: "صورت‌وضعیت باطل شده است",
  already_reversed: "این ثبت پیش‌تر برگشت خورده است",
};

export type IpcPostabilityInput = {
  ipc: Record<string, unknown>;
  contract: Record<string, unknown>;
  account?: Record<string, unknown> | null;
};

export type IpcPostability = {
  ipcId: string;
  serialNo: number;
  isPostable: boolean;
  blockCode: string | null;
  blockFa: string | null;
  costAccountCode: string | null;
  netAmount: number;
};

/**
 * آیا این صورت‌وضعیت قابل ارسال به مالی است؟
 *
 * ترتیب بررسی‌ها عمدی است: اول وضعیت گردش کار (که مسئولیتش با پیمان
 * است)، بعد پیکربندی حساب (که مسئولیتش با مالی است). این‌طور هر خطا
 * به صاحبش می‌رسد.
 */
export function ipcPostability(inp: IpcPostabilityInput): IpcPostability {
  const ipc = inp.ipc ?? {};
  const state = String(ipc.WorkflowState ?? "");
  const status = String(ipc.Status ?? "");
  const net = num(ipc.NetPayable);
  const code = String(inp.contract?.CostAccountCode ?? "").trim();

  const base = {
    ipcId: String(ipc.Id ?? ""),
    serialNo: Number(ipc.SerialNo) || 0,
    costAccountCode: code || null,
    netAmount: round(net),
  };

  const block = (c: string) => ({
    ...base, isPostable: false, blockCode: c, blockFa: FIN_BLOCK_REASON_FA[c] ?? c,
  });

  if (status === "cancelled") return block("cancelled");
  if (!(FIN_POSTABLE_STATES as readonly string[]).includes(state)) return block("not_approved");
  if (!code) return block("no_cost_account");
  if (!inp.account) return block("account_missing");
  if (net <= 0) return block("zero_amount");

  return { ...base, isPostable: true, blockCode: null, blockFa: null };
}

export type PostingLine = {
  ipcId: string;
  serialNo: number;
  periodCode: string;
  costAccountId: string;
  costAccountCode: string;
  grossAmount: number;
  netAmount: number;
  deductionAmount: number;
  vatAmount: number;
  /** سهمی که همین صورت‌وضعیت قبلاً روی این حساب گذاشته بود. */
  previousShare: number;
  previousActual: number;
  nextActual: number;
  /** تفاوت خالصی که این ارسال روی دفتر می‌گذارد. */
  deltaAmount: number;
  isRepost: boolean;
  memoFa: string;
};

/**
 * اثر یک صورت‌وضعیت روی مانده حساب هزینه.
 *
 * `previousShare` کلید ایدمپوتنسی است: اگر همین صورت‌وضعیت قبلاً ثبت
 * شده باشد، سهم قبلی‌اش کسر و مبلغ تازه جایگزین می‌شود. پس ارسال
 * دوباره پس از اصلاح مبلغ، فقط تفاوت را جابه‌جا می‌کند نه کل مبلغ را.
 */
export function applyPostingToAccount(
  previousActual: number,
  previousShare: number,
  newShare: number,
): number {
  return round(num(previousActual) - num(previousShare) + num(newShare));
}

export type BuildPostingInput = {
  ipc: Record<string, unknown>;
  contract: Record<string, unknown>;
  account: Record<string, unknown>;
  prior?: Record<string, unknown> | null;
  periodCode?: string;
};

/** ساخت سطر ثبت — محاسبهٔ خالص، بدون هیچ اثر جانبی. */
export function buildFinPosting(inp: BuildPostingInput): PostingLine {
  const ipc = inp.ipc ?? {};
  const acc = inp.account ?? {};
  const prior = inp.prior ?? null;

  const gross = round(num(ipc.SubtotalAmount) || num(ipc.GrossCurrent));
  const net = round(num(ipc.NetPayable));
  const deduction = round(num(ipc.TotalDeductions));
  const vat = round(num(ipc.VatAmount));

  /* سهم قبلی فقط از ثبت‌های فعال خوانده می‌شود: ثبت برگشت‌خورده اثرش
   * را از دفتر پس گرفته، پس دیگر سهمی ندارد. */
  const previousShare = prior && String(prior.Status) === "posted" ? round(num(prior.NetAmount)) : 0;
  const previousActual = round(num(acc.Actual));
  const nextActual = applyPostingToAccount(previousActual, previousShare, net);

  const serial = Number(ipc.SerialNo) || 0;
  const period = String(inp.periodCode ?? ipc.PeriodCode ?? "");

  return {
    ipcId: String(ipc.Id ?? ""),
    serialNo: serial,
    periodCode: period,
    costAccountId: String(acc.Id ?? ""),
    costAccountCode: String(acc.Code ?? ""),
    grossAmount: gross,
    netAmount: net,
    deductionAmount: deduction,
    vatAmount: vat,
    previousShare,
    previousActual,
    nextActual,
    deltaAmount: round(nextActual - previousActual),
    isRepost: previousShare > 0,
    memoFa: `صورت‌وضعیت ${toFaDigits(String(serial))} پیمان ${String(inp.contract?.Code ?? "")}`
      + (period ? ` — دورهٔ ${period}` : ""),
  };
}

/** تبدیل رقم لاتین به فارسی برای متن‌های نمایشی. */
function toFaDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export type BudgetImpact = {
  costAccountCode: string;
  budget: number;
  previousActual: number;
  nextActual: number;
  remaining: number;
  usedPct: number | null;
  /** آیا این ثبت حساب را از بودجه رد می‌کند؟ */
  isOverBudget: boolean;
  /** آیا پیش از این ثبت هم رد شده بود؟ (تقصیر این ثبت نیست) */
  wasAlreadyOver: boolean;
  warningFa: string | null;
};

/**
 * اثر ثبت بر بودجهٔ حساب.
 *
 * تفکیک `isOverBudget` از `wasAlreadyOver` عمدی است: اگر حساب از قبل
 * منفی بوده، هشدار دادن به کاربری که فقط یک صورت‌وضعیت درست را ثبت
 * می‌کند، او را به بی‌توجهی به هشدارها عادت می‌دهد. هشدار باید بگوید
 * چه کسی خط را رد کرد.
 */
export function budgetImpact(line: PostingLine, account: Record<string, unknown>): BudgetImpact {
  const budget = round(num(account.Budget));
  const prev = round(num(account.Actual));
  const next = line.nextActual;
  const remaining = round(budget - next);
  const usedPct = budget > 0 ? round((next / budget) * 100) : null;
  const isOver = budget > 0 && next > budget;
  const wasOver = budget > 0 && prev > budget;

  let warningFa: string | null = null;
  if (isOver && !wasOver) {
    warningFa = `این ثبت حساب «${String(account.Code ?? "")}» را از بودجه رد می‌کند`
      + ` (کسری ${Math.abs(remaining).toLocaleString("fa-IR")})`;
  } else if (isOver && wasOver) {
    warningFa = `حساب «${String(account.Code ?? "")}» پیش از این ثبت هم فراتر از بودجه بود`;
  } else if (usedPct != null && usedPct >= 90) {
    warningFa = `مصرف بودجهٔ حساب «${String(account.Code ?? "")}» به ${usedPct}٪ رسید`;
  }

  return {
    costAccountCode: String(account.Code ?? ""),
    budget, previousActual: prev, nextActual: next, remaining, usedPct,
    isOverBudget: isOver, wasAlreadyOver: wasOver, warningFa,
  };
}

export type ReconcileInput = {
  ipcs: Record<string, unknown>[];
  postings: Record<string, unknown>[];
};

export type ReconcileRow = {
  ipcId: string;
  serialNo: number;
  periodCode: string;
  workflowState: string;
  netAmount: number;
  postedAmount: number | null;
  /** in_sync | not_posted | amount_drift | orphan_posting | reversed */
  state: string;
  stateFa: string;
  driftAmount: number;
  needsActionFa: string | null;
};

export const RECONCILE_STATE_FA: Record<string, string> = {
  in_sync: "هماهنگ",
  not_posted: "ارسال‌نشده",
  amount_drift: "مغایرت مبلغ",
  orphan_posting: "ثبت بی‌مرجع",
  reversed: "برگشت‌خورده",
};

/**
 * تطبیق دفتر پیمان با دفتر مالی.
 *
 * این تابع همان کاری را می‌کند که حسابدار با دو فایل اکسل می‌کرد و سه
 * روز طول می‌کشید. سه حالت خطرناک را جدا می‌کند:
 *
 * - `not_posted`: صورت‌وضعیت تأییدشده که به مالی نرفته — پول تعهد شده
 *   ولی در گزارش هزینه دیده نمی‌شود.
 * - `amount_drift`: صورت‌وضعیت پس از ارسال اصلاح شده و دو دفتر دیگر
 *   یک عدد نمی‌گویند. خطرناک‌ترین حالت، چون هر دو طرف «ثبت‌شده» به
 *   نظر می‌رسند.
 * - `orphan_posting`: ثبتی در مالی که صورت‌وضعیت متناظرش نیست یا باطل
 *   شده — پولی که کسی مسئولش نیست.
 */
export function reconcileFinPostings(inp: ReconcileInput): {
  rows: ReconcileRow[];
  summary: {
    total: number;
    inSync: number;
    notPosted: number;
    amountDrift: number;
    orphan: number;
    reversed: number;
    notPostedAmount: number;
    driftAmount: number;
    isClean: boolean;
  };
  warningsFa: string[];
} {
  const postings = inp.postings ?? [];
  const byIpc = new Map<string, Record<string, unknown>>();
  for (const p of postings) byIpc.set(String(p.IpcId ?? ""), p);

  const rows: ReconcileRow[] = [];
  const seen = new Set<string>();

  for (const ipc of inp.ipcs ?? []) {
    const id = String(ipc.Id ?? "");
    seen.add(id);
    const state = String(ipc.WorkflowState ?? "");
    const status = String(ipc.Status ?? "");
    const net = round(num(ipc.NetPayable));
    const p = byIpc.get(id);
    const isFinal = (FIN_POSTABLE_STATES as readonly string[]).includes(state) && status !== "cancelled";

    let st: string;
    let posted: number | null = null;
    let drift = 0;

    if (!p) {
      /* صورت‌وضعیت غیرنهایی که ثبت نشده، اصلاً مسئله نیست. */
      if (!isFinal) continue;
      st = "not_posted";
    } else if (String(p.Status) === "reversed") {
      posted = round(num(p.NetAmount));
      st = isFinal ? "not_posted" : "reversed";
    } else {
      posted = round(num(p.NetAmount));
      drift = round(net - posted);
      st = drift === 0 ? "in_sync" : "amount_drift";
    }

    rows.push({
      ipcId: id,
      serialNo: Number(ipc.SerialNo) || 0,
      periodCode: String(ipc.PeriodCode ?? ""),
      workflowState: state,
      netAmount: net,
      postedAmount: posted,
      state: st,
      stateFa: RECONCILE_STATE_FA[st] ?? st,
      driftAmount: drift,
      needsActionFa: st === "not_posted"
        ? "ارسال به مالی"
        : st === "amount_drift"
          ? "ارسال دوباره برای هم‌ترازی مبلغ"
          : null,
    });
  }

  /* ثبت‌هایی که صورت‌وضعیت متناظرشان در فهرست نیست. */
  for (const p of postings) {
    const id = String(p.IpcId ?? "");
    if (seen.has(id)) continue;
    if (String(p.Status) === "reversed") continue;
    rows.push({
      ipcId: id,
      serialNo: Number(p.SerialNo) || 0,
      periodCode: String(p.PeriodCode ?? ""),
      workflowState: "—",
      netAmount: 0,
      postedAmount: round(num(p.NetAmount)),
      state: "orphan_posting",
      stateFa: RECONCILE_STATE_FA.orphan_posting,
      driftAmount: round(-num(p.NetAmount)),
      needsActionFa: "بررسی و در صورت لزوم برگشت ثبت",
    });
  }

  rows.sort((a, b) => {
    const rank: Record<string, number> = { amount_drift: 0, orphan_posting: 1, not_posted: 2, reversed: 3, in_sync: 4 };
    const d = (rank[a.state] ?? 9) - (rank[b.state] ?? 9);
    return d !== 0 ? d : a.serialNo - b.serialNo;
  });

  const count = (s: string) => rows.filter((r) => r.state === s).length;
  const notPosted = count("not_posted");
  const drifted = count("amount_drift");
  const orphan = count("orphan_posting");

  const notPostedAmount = round(rows.filter((r) => r.state === "not_posted")
    .reduce((s, r) => s + r.netAmount, 0));
  const driftAmount = round(rows.filter((r) => r.state === "amount_drift")
    .reduce((s, r) => s + Math.abs(r.driftAmount), 0));

  const warningsFa: string[] = [];
  if (drifted > 0) {
    warningsFa.push(`${drifted} صورت‌وضعیت پس از ارسال اصلاح شده و دو دفتر یک عدد نمی‌گویند`);
  }
  if (orphan > 0) {
    warningsFa.push(`${orphan} ثبت مالی بدون صورت‌وضعیت معتبر پیدا شد`);
  }
  if (notPosted > 0) {
    warningsFa.push(`${notPosted} صورت‌وضعیت تأییدشده هنوز به مالی نرفته`
      + ` (${notPostedAmount.toLocaleString("fa-IR")} ریال تعهد ثبت‌نشده)`);
  }

  return {
    rows,
    summary: {
      total: rows.length,
      inSync: count("in_sync"),
      notPosted, amountDrift: drifted, orphan, reversed: count("reversed"),
      notPostedAmount, driftAmount,
      isClean: drifted === 0 && orphan === 0 && notPosted === 0,
    },
    warningsFa,
  };
}

export type ContractFinSummary = {
  contractId: string;
  contractCode: string;
  costAccountCode: string | null;
  contractAmount: number;
  /** جمع خالص ارسال‌شده به مالی. */
  postedNet: number;
  /** جمع ناخالص صورت‌وضعیت‌های تأییدشده. */
  approvedGross: number;
  /** کسوری که در حساب هزینه ننشسته چون هنوز پول پروژه است. */
  withheldAmount: number;
  postedCount: number;
  pendingCount: number;
  /** تعهد باقی‌مانده: مبلغ پیمان منهای آنچه واقعاً هزینه شده. */
  remainingCommitment: number;
  commitmentUsedPct: number | null;
  notesFa: string[];
};

/**
 * خلاصهٔ مالی یک پیمان از دید حساب هزینه.
 *
 * نکتهٔ ظریف: `postedNet` خالص پرداختنی است، ولی تعهد پروژه ناخالص
 * است. تفاوت این دو (سپرده، پیش‌پرداخت، مالیات) هنوز پول پروژه است و
 * نباید در Actual بنشیند — ولی باید جایی دیده شود، وگرنه مدیر فکر
 * می‌کند پیمان ارزان‌تر از آنچه هست تمام می‌شود.
 */
export function contractFinSummary(inp: {
  contract: Record<string, unknown>;
  ipcs: Record<string, unknown>[];
  postings: Record<string, unknown>[];
}): ContractFinSummary {
  const c = inp.contract ?? {};
  const active = (inp.postings ?? []).filter((p) => String(p.Status) === "posted");
  const approved = (inp.ipcs ?? []).filter((i) =>
    (FIN_POSTABLE_STATES as readonly string[]).includes(String(i.WorkflowState ?? ""))
    && String(i.Status) !== "cancelled");

  const postedNet = round(active.reduce((s, p) => s + num(p.NetAmount), 0));
  const approvedGross = round(approved.reduce((s, i) => s + (num(i.SubtotalAmount) || num(i.GrossCurrent)), 0));
  const amount = round(num(c.CurrentAmount) || num(c.InitialAmount));
  const withheld = round(approvedGross - postedNet);

  const postedIds = new Set(active.map((p) => String(p.IpcId)));
  const pending = approved.filter((i) => !postedIds.has(String(i.Id))).length;

  const notesFa: string[] = [];
  if (withheld > 0) {
    notesFa.push(`${withheld.toLocaleString("fa-IR")} ریال کسور (سپرده، پیش‌پرداخت، مالیات)`
      + ` در حساب هزینه ننشسته چون هنوز پول پروژه است`);
  }
  if (pending > 0) {
    notesFa.push(`${pending} صورت‌وضعیت تأییدشده هنوز ارسال نشده`);
  }
  if (!String(c.CostAccountCode ?? "").trim()) {
    notesFa.push("برای این پیمان حساب هزینه تعیین نشده و هیچ عددی به مالی نمی‌رسد");
  }

  return {
    contractId: String(c.Id ?? ""),
    contractCode: String(c.Code ?? ""),
    costAccountCode: String(c.CostAccountCode ?? "").trim() || null,
    contractAmount: amount,
    postedNet,
    approvedGross,
    withheldAmount: withheld,
    postedCount: active.length,
    pendingCount: pending,
    remainingCommitment: round(amount - approvedGross),
    commitmentUsedPct: amount > 0 ? round((approvedGross / amount) * 100) : null,
    notesFa,
  };
}

/* ════════════════════════════════════════════════════════════════════
 * بخش ۱۹ — گزارش‌های رسمی پیمان (D11)
 *
 * اصل حاکم: **گزارش هیچ عددی نمی‌سازد.** هر رقمی که در برگهٔ A4 چاپ
 * می‌شود باید عیناً از موتورهای بخش‌های قبلی آمده باشد. اگر گزارش خودش
 * حساب کند، دو منبع حقیقت پیدا می‌شود و روزی که این دو نخوانند، هیچ‌کس
 * نمی‌داند کدام درست است.
 *
 * تفکیک مخاطب هم سطحی نیست: گزارش «رسمی» سندی است که ممکن است پیوست
 * نامهٔ اداری یا مدرک دعوا شود. چیزهایی که برای تصمیم داخلی لازم‌اند —
 * برآورد ادعا، نمرهٔ سلامت، هشدار زودهنگام — در سند رسمی جایی ندارند،
 * چون طرف مقابل آن‌ها را علیه شما استفاده می‌کند.
 * ════════════════════════════════════════════════════════════════════ */

export type CntReportDef = {
  code: string;
  title: { fa: string; en: string };
  periodicity: "weekly" | "monthly" | "on_demand" | "milestone";
  audiences: ("internal" | "official")[];
  purpose: { fa: string; en: string };
};

export const CNT_REPORT_CATALOG: CntReportDef[] = [
  {
    code: "RPT-CNT-IPC",
    title: { fa: "برگه صورت‌وضعیت موقت", en: "Interim payment certificate" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: {
      fa: "سند رسمی مطالبه: ریزمتره، کسور و مبلغ خالص با جای امضای سه طرف",
      en: "formal claim document with line items, deductions and three-party signature",
    },
  },
  {
    code: "RPT-CNT-BOQ",
    title: { fa: "فهرست بها و پیشرفت ردیف‌ها", en: "BOQ and line progress" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: {
      fa: "مقدار پیمانی، اجراشده و باقی‌مانده هر ردیف با درصد تحقق",
      en: "contract, executed and remaining quantity per line",
    },
  },
  {
    code: "RPT-CNT-PRG",
    title: { fa: "گزارش پیشرفت پیمان", en: "Contract progress report" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: {
      fa: "پیشرفت فیزیکی و مالی، فاصلهٔ بین‌شان و منحنی S",
      en: "physical vs financial progress with gap and S-curve",
    },
  },
  {
    code: "RPT-CNT-GRT",
    title: { fa: "دفتر ضمانت‌نامه‌ها", en: "Guarantee register" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: {
      fa: "وثیقه‌های در جریان، سررسید و پوشش‌سنجی",
      en: "active guarantees, expiry and coverage",
    },
  },
  {
    code: "RPT-CNT-DED",
    title: { fa: "صورت کسور و سپرده", en: "Deductions and retainage statement" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: {
      fa: "تفکیک کسور قانونی و قراردادی با ماندهٔ سپردهٔ حسن انجام کار",
      en: "statutory and contractual deductions with retainage balance",
    },
  },
  {
    code: "RPT-CNT-SUB",
    title: { fa: "گزارش پیمانکاران جزء", en: "Subcontractor report" },
    periodicity: "monthly",
    /* فقط داخلی: رابطهٔ مالی با جزء به کارفرما مربوط نیست و افشایش
     * موضع چانه‌زنی را تضعیف می‌کند. */
    audiences: ["internal"],
    purpose: {
      fa: "صورت‌وضعیت جزء، تطبیق با پیمان اصلی و مبلغ خالص پرداختنی",
      en: "sub IPCs, back-to-back check and net payable",
    },
  },
  {
    code: "RPT-CNT-FIN",
    title: { fa: "تطبیق پیمان با دفتر مالی", en: "Contract-finance reconciliation" },
    periodicity: "monthly",
    /* فقط داخلی: مغایرت دفاتر مسئلهٔ کنترل داخلی است، نه سند رسمی. */
    audiences: ["internal"],
    purpose: {
      fa: "صورت‌وضعیت‌های ارسال‌نشده و مغایرت مبلغ بین دو دفتر",
      en: "unposted certificates and amount drift between ledgers",
    },
  },
  {
    code: "RPT-CNT-EXEC",
    title: { fa: "گزارش تک‌صفحه‌ای مدیریتی پیمان", en: "Contract executive summary" },
    periodicity: "monthly",
    /* فقط داخلی: نمرهٔ سلامت و هشدار زودهنگام قضاوت درونی‌اند. */
    audiences: ["internal"],
    purpose: {
      fa: "یک صفحه برای تصمیم‌گیر ارشد: نمرهٔ سلامت، هشدارهای بحرانی و سه قلم نیازمند تصمیم",
      en: "one page for executives: health score, critical alerts, top decisions",
    },
  },
];

const CNT_REPORT_BY_CODE = new Map(CNT_REPORT_CATALOG.map((r) => [r.code, r]));

export function getCntReport(code: string): CntReportDef | undefined {
  return CNT_REPORT_BY_CODE.get(code);
}

/**
 * آیا این مخاطب اجازهٔ دریافت این گزارش را دارد؟
 *
 * پیش‌فرض «نه» است: کد ناشناخته به هیچ مخاطبی داده نمی‌شود.
 */
export function isCntAudienceAllowed(code: string, audience: string): boolean {
  const def = CNT_REPORT_BY_CODE.get(code);
  return !!def && (def.audiences as string[]).includes(audience);
}

/* ─────────────── کمک‌تابع‌های نمایش ─────────────── */

/** «—» برای مقدار غایب: صفر چاپ‌کردن یعنی ادعای دانستن. */
function cell(v: unknown): string | number {
  if (v == null || v === "") return "—";
  return typeof v === "number" ? v : String(v);
}

function pct(v: unknown): string {
  return v == null ? "—" : `${round(num(v), 1)}`;
}

/** برچسب فارسی نوع کسر؛ نوع ناشناخته خودش چاپ می‌شود نه «نامشخص». */
function dedTypeFa(k: string): string {
  return (DEDUCTION_TYPE_FA as Record<string, string>)[k] ?? k;
}

/* ─────────────── سازندهٔ هر گزارش ─────────────── */

export type CntReportInput = {
  contract: Record<string, unknown>;
  boq?: Record<string, unknown>[];
  ipcs?: Record<string, unknown>[];
  ipc?: Record<string, unknown> | null;
  ipcLines?: Record<string, unknown>[];
  deductions?: Record<string, unknown>[];
  guarantees?: Record<string, unknown>[];
  subIpcs?: Record<string, unknown>[];
  postings?: Record<string, unknown>[];
  progress?: Record<string, unknown> | null;
  sCurve?: Record<string, unknown>[] | null;
  scorecard?: Record<string, unknown> | null;
  reconcile?: Record<string, unknown> | null;
  finSummary?: Record<string, unknown> | null;
  periodLabel?: string;
  asOf?: string;
};

type Section =
  | { kind: "kpi"; title: { fa: string; en: string }; cells: { label: { fa: string; en: string }; value: string; tone?: string }[] }
  | { kind: "table"; title: { fa: string; en: string }; note?: { fa: string; en: string }; columns: Record<string, unknown>[]; rows: Record<string, unknown>[] }
  | { kind: "text"; title: { fa: string; en: string }; body: { fa: string; en: string } };

/** برگهٔ صورت‌وضعیت — سند رسمی مطالبه. */
function buildIpcSheet(inp: CntReportInput): Section[] {
  const ipc = inp.ipc ?? {};
  const c = inp.contract ?? {};
  const lines = inp.ipcLines ?? [];
  const deds = inp.deductions ?? [];

  const boqById = new Map((inp.boq ?? []).map((b) => [String(b.Id), b]));

  return [
    {
      kind: "kpi",
      title: { fa: "خلاصهٔ صورت‌وضعیت", en: "Certificate summary" },
      cells: [
        { label: { fa: "شمارهٔ صورت‌وضعیت", en: "Serial" }, value: String(cell(ipc.SerialNo)) },
        { label: { fa: "دوره", en: "Period" }, value: String(cell(ipc.PeriodCode)) },
        { label: { fa: "ناخالص دوره", en: "Gross current" }, value: String(cell(round(num(ipc.GrossCurrent)))) },
        { label: { fa: "ناخالص تجمعی", en: "Gross cumulative" }, value: String(cell(round(num(ipc.GrossCumulative)))) },
        { label: { fa: "جمع کسور", en: "Deductions" }, value: String(cell(round(num(ipc.TotalDeductions)))) },
        { label: { fa: "خالص پرداختنی", en: "Net payable" }, value: String(cell(round(num(ipc.NetPayable)))), tone: "good" },
      ],
    },
    {
      kind: "table",
      title: { fa: "ریزمتره", en: "Line items" },
      note: {
        fa: "مقدار تأییدشده مبنای مبلغ است، نه مقدار ادعایی",
        en: "approved quantity is the basis, not claimed",
      },
      columns: [
        { key: "itemNo", title: { fa: "ردیف", en: "Item" }, weight: 1 },
        { key: "titleFa", title: { fa: "شرح", en: "Description" }, weight: 4 },
        { key: "unit", title: { fa: "واحد", en: "Unit" }, weight: 1 },
        { key: "rate", title: { fa: "بهای واحد", en: "Rate" }, format: "currency", align: "end", weight: 2 },
        { key: "prevQty", title: { fa: "قبلی", en: "Previous" }, format: "number", align: "end", weight: 1 },
        { key: "currentQty", title: { fa: "این دوره", en: "Current" }, format: "number", align: "end", weight: 1 },
        { key: "cumQty", title: { fa: "تجمعی", en: "Cumulative" }, format: "number", align: "end", weight: 1 },
        { key: "earned", title: { fa: "مبلغ دوره", en: "Amount" }, format: "currency", align: "end", weight: 2 },
      ],
      rows: lines.map((l) => {
        const b = boqById.get(String(l.BoqItemId));
        return {
          itemNo: cell(b?.ItemNo),
          titleFa: cell(b?.TitleFa),
          unit: cell(b?.Unit),
          rate: cell(round(num(l.UnitRate) || num(b?.UnitRate))),
          prevQty: cell(num(l.PrevQty)),
          currentQty: cell(num(l.CurrentQty)),
          cumQty: cell(num(l.CumQty)),
          earned: cell(round(num(l.EarnedCurrent))),
        };
      }),
    },
    {
      kind: "table",
      title: { fa: "کسور", en: "Deductions" },
      note: {
        fa: "کسور قانونی از کسور قراردادی جدا نگه داشته می‌شود",
        en: "statutory and contractual deductions are separated",
      },
      columns: [
        { key: "type", title: { fa: "نوع", en: "Type" }, weight: 3 },
        { key: "base", title: { fa: "مأخذ", en: "Base" }, format: "currency", align: "end", weight: 2 },
        { key: "rate", title: { fa: "نرخ", en: "Rate" }, format: "percent", align: "end", weight: 1 },
        { key: "amount", title: { fa: "مبلغ", en: "Amount" }, format: "currency", align: "end", weight: 2 },
        { key: "statutory", title: { fa: "قانونی", en: "Statutory" }, align: "center", weight: 1 },
      ],
      rows: deds.map((d) => ({
        type: cell(dedTypeFa(String(d.DeductionType))),
        base: cell(round(num(d.BaseAmount))),
        rate: cell(num(d.RatePct)),
        amount: cell(round(num(d.Amount))),
        statutory: d.IsStatutory === true || d.IsStatutory === 1 || d.IsStatutory === "1" ? "بله" : "خیر",
      })),
    },
    {
      kind: "text",
      title: { fa: "تأییدها", en: "Approvals" },
      body: {
        fa: `تهیه: ${String(c.ContractorName ?? "پیمانکار")} · تأیید فنی: ${String(c.ConsultantName ?? "مشاور")}`
          + ` · تصویب: ${String(c.EmployerName ?? "کارفرما")}`,
        en: "Prepared by contractor, verified by consultant, approved by employer",
      },
    },
  ];
}

/** فهرست بها با پیشرفت هر ردیف. */
function buildBoqSheet(inp: CntReportInput): Section[] {
  const boq = inp.boq ?? [];
  const lines = inp.ipcLines ?? [];

  /* بیشینهٔ تجمعی هر ردیف در همهٔ صورت‌وضعیت‌ها — همان قاعدهٔ D9. */
  const cumByItem = new Map<string, number>();
  for (const l of lines) {
    const k = String(l.BoqItemId);
    const v = num(l.CumQty);
    if (!cumByItem.has(k) || v > (cumByItem.get(k) ?? 0)) cumByItem.set(k, v);
  }

  const rows = boq.map((b) => {
    const contractQty = num(b.ContractQty);
    const done = cumByItem.get(String(b.Id)) ?? 0;
    const rate = num(b.UnitRate);
    return {
      itemNo: cell(b.ItemNo),
      titleFa: cell(b.TitleFa),
      unit: cell(b.Unit),
      rate: cell(round(rate)),
      contractQty: cell(contractQty),
      doneQty: cell(round(done, 3)),
      remainQty: cell(round(contractQty - done, 3)),
      donePct: contractQty > 0 ? pct((done / contractQty) * 100) : "—",
      amount: cell(round(num(b.LineAmount) || contractQty * rate)),
      starred: b.IsStarred === true || b.IsStarred === 1 || b.IsStarred === "1" ? "★" : "",
    };
  });

  const totalAmount = round(boq.reduce((s, b) => s + (num(b.LineAmount) || num(b.ContractQty) * num(b.UnitRate)), 0));

  return [
    {
      kind: "kpi",
      title: { fa: "جمع فهرست بها", en: "BOQ totals" },
      cells: [
        { label: { fa: "تعداد ردیف", en: "Line count" }, value: String(boq.length) },
        { label: { fa: "جمع مبلغ", en: "Total amount" }, value: String(totalAmount) },
        {
          label: { fa: "ردیف ستاره‌دار", en: "Starred lines" },
          value: String(boq.filter((b) => b.IsStarred === true || b.IsStarred === 1 || b.IsStarred === "1").length),
        },
      ],
    },
    {
      kind: "table",
      title: { fa: "ردیف‌های فهرست بها", en: "BOQ lines" },
      note: {
        fa: "ستاره یعنی ردیف خارج از فهرست بهای پایه (کار جدید)",
        en: "star marks non-schedule (extra work) items",
      },
      columns: [
        { key: "starred", title: { fa: "", en: "" }, align: "center", weight: 1 },
        { key: "itemNo", title: { fa: "ردیف", en: "Item" }, weight: 1 },
        { key: "titleFa", title: { fa: "شرح", en: "Description" }, weight: 4 },
        { key: "unit", title: { fa: "واحد", en: "Unit" }, weight: 1 },
        { key: "rate", title: { fa: "بهای واحد", en: "Rate" }, format: "currency", align: "end", weight: 2 },
        { key: "contractQty", title: { fa: "مقدار پیمان", en: "Contract" }, format: "number", align: "end", weight: 1 },
        { key: "doneQty", title: { fa: "اجراشده", en: "Executed" }, format: "number", align: "end", weight: 1 },
        { key: "remainQty", title: { fa: "باقی", en: "Remaining" }, format: "number", align: "end", weight: 1 },
        { key: "donePct", title: { fa: "٪", en: "%" }, format: "percent", align: "end", weight: 1 },
        { key: "amount", title: { fa: "مبلغ ردیف", en: "Amount" }, format: "currency", align: "end", weight: 2 },
      ],
      rows,
    },
  ];
}

/** پیشرفت پیمان با فاصلهٔ فیزیکی و مالی. */
function buildProgressSheet(inp: CntReportInput): Section[] {
  const p = inp.progress ?? {};
  const curve = inp.sCurve ?? [];

  const sections: Section[] = [
    {
      kind: "kpi",
      title: { fa: "پیشرفت", en: "Progress" },
      cells: [
        { label: { fa: "فیزیکی", en: "Physical" }, value: pct(p.physicalPct) },
        { label: { fa: "مالی", en: "Financial" }, value: pct(p.financialPct) },
        {
          label: { fa: "فاصله", en: "Gap" },
          value: pct(p.gapPct),
          tone: num(p.gapPct) > 5 ? "bad" : num(p.gapPct) < -5 ? "warn" : "good",
        },
        { label: { fa: "مصرف سقف", en: "Ceiling used" }, value: pct(p.ceilingUsedPct) },
      ],
    },
  ];

  /* هشدار کیفیت داده پیش از نمودار: منحنی زیبا روی مخرج غلط، بدترین
   * نوع گزارش است. */
  if (p.isGapReliable === false) {
    sections.push({
      kind: "text",
      title: { fa: "هشدار کیفیت داده", en: "Data quality warning" },
      body: {
        fa: `فهرست بها ${pct(p.boqCoveragePct)}٪ مبلغ پیمان را پوشش می‌دهد؛`
          + " فاصلهٔ فیزیکی و مالی روی دو مخرج ناهمخوان سنجیده شده و قابل اتکا نیست",
        en: "BOQ does not cover the contract amount; the progress gap is not reliable",
      },
    });
  }

  if (curve.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "منحنی پیشرفت", en: "Progress curve" },
      note: {
        fa: "دورهٔ پس از آخرین داده واقعی، پیش‌بینی است نه واقعیت",
        en: "periods after the last actual are forecast",
      },
      columns: [
        { key: "period", title: { fa: "دوره", en: "Period" }, weight: 2 },
        { key: "physical", title: { fa: "فیزیکی ٪", en: "Physical %" }, format: "percent", align: "end", weight: 1 },
        { key: "financial", title: { fa: "مالی ٪", en: "Financial %" }, format: "percent", align: "end", weight: 1 },
        { key: "kind", title: { fa: "نوع", en: "Type" }, align: "center", weight: 1 },
      ],
      rows: curve.map((s) => ({
        period: cell(s.periodCode),
        physical: pct(s.physicalPct),
        financial: pct(s.financialPct),
        kind: s.isForecast ? "پیش‌بینی" : "واقعی",
      })),
    });
  }

  return sections;
}

/** دفتر ضمانت‌نامه‌ها. */
function buildGuaranteeSheet(inp: CntReportInput): Section[] {
  const gs = inp.guarantees ?? [];
  const active = gs.filter((g) => String(g.Status) === "active");

  return [
    {
      kind: "kpi",
      title: { fa: "وثیقه‌ها", en: "Guarantees" },
      cells: [
        { label: { fa: "در جریان", en: "Active" }, value: String(active.length) },
        {
          label: { fa: "جمع مبلغ در جریان", en: "Active amount" },
          value: String(round(active.reduce((s, g) => s + num(g.Amount), 0))),
        },
        { label: { fa: "آزادشده", en: "Released" }, value: String(gs.filter((g) => String(g.Status) === "released").length) },
      ],
    },
    {
      kind: "table",
      title: { fa: "دفتر ضمانت‌نامه", en: "Guarantee register" },
      columns: [
        { key: "type", title: { fa: "نوع", en: "Type" }, weight: 2 },
        { key: "no", title: { fa: "شماره", en: "Number" }, weight: 2 },
        { key: "bank", title: { fa: "بانک", en: "Bank" }, weight: 2 },
        { key: "amount", title: { fa: "مبلغ", en: "Amount" }, format: "currency", align: "end", weight: 2 },
        { key: "issue", title: { fa: "صدور", en: "Issued" }, format: "date", weight: 2 },
        { key: "expiry", title: { fa: "سررسید", en: "Expiry" }, format: "date", weight: 2 },
        { key: "status", title: { fa: "وضعیت", en: "Status" }, weight: 2 },
      ],
      rows: gs.map((g) => ({
        type: cell(GUARANTEE_TYPE_FA[String(g.GuaranteeType)] ?? g.GuaranteeType),
        no: cell(g.GuaranteeNo),
        bank: cell(g.BankName),
        amount: cell(round(num(g.Amount))),
        issue: cell(g.IssueDate),
        expiry: cell(g.ExpiryDate),
        status: cell(g.Status),
      })),
    },
  ];
}

/** صورت کسور و ماندهٔ سپرده. */
function buildDeductionSheet(inp: CntReportInput): Section[] {
  const deds = inp.deductions ?? [];

  const byType = new Map<string, { amount: number; count: number; statutory: boolean }>();
  for (const d of deds) {
    const k = String(d.DeductionType);
    const cur = byType.get(k) ?? { amount: 0, count: 0, statutory: false };
    cur.amount = round(cur.amount + num(d.Amount));
    cur.count += 1;
    cur.statutory = cur.statutory || d.IsStatutory === true || d.IsStatutory === 1 || d.IsStatutory === "1";
    byType.set(k, cur);
  }

  const retainage = byType.get("retainage")?.amount ?? 0;
  const total = round([...byType.values()].reduce((s, v) => s + v.amount, 0));

  return [
    {
      kind: "kpi",
      title: { fa: "جمع کسور", en: "Deduction totals" },
      cells: [
        { label: { fa: "جمع کل", en: "Total" }, value: String(total) },
        { label: { fa: "سپردهٔ حسن انجام کار", en: "Retainage" }, value: String(round(retainage)) },
        {
          label: { fa: "کسور قانونی", en: "Statutory" },
          value: String(round([...byType.entries()].filter(([, v]) => v.statutory).reduce((s, [, v]) => s + v.amount, 0))),
        },
      ],
    },
    {
      kind: "table",
      title: { fa: "تفکیک کسور", en: "Deduction breakdown" },
      note: {
        fa: "سپردهٔ حسن انجام کار پول پیمانکار است که نزد کارفرما امانت می‌ماند، نه هزینهٔ پروژه",
        en: "retainage is contractor money held in trust, not project cost",
      },
      columns: [
        { key: "type", title: { fa: "نوع کسر", en: "Type" }, weight: 3 },
        { key: "count", title: { fa: "دفعات", en: "Count" }, format: "number", align: "end", weight: 1 },
        { key: "amount", title: { fa: "جمع مبلغ", en: "Amount" }, format: "currency", align: "end", weight: 2 },
        { key: "statutory", title: { fa: "قانونی", en: "Statutory" }, align: "center", weight: 1 },
      ],
      rows: [...byType.entries()].map(([k, v]) => ({
        type: cell(dedTypeFa(k)),
        count: v.count,
        amount: v.amount,
        statutory: v.statutory ? "بله" : "خیر",
      })),
    },
  ];
}

/** پیمانکاران جزء — فقط داخلی. */
function buildSubSheet(inp: CntReportInput): Section[] {
  const subs = inp.subIpcs ?? [];
  return [
    {
      kind: "kpi",
      title: { fa: "پیمانکاران جزء", en: "Subcontractors" },
      cells: [
        { label: { fa: "صورت‌وضعیت جزء", en: "Sub IPCs" }, value: String(subs.length) },
        {
          label: { fa: "جمع خالص", en: "Net total" },
          value: String(round(subs.reduce((s, x) => s + num(x.NetPayable), 0))),
        },
        {
          label: { fa: "تأییدشده", en: "Approved" },
          value: String(subs.filter((x) => ["approved", "paid"].includes(String(x.WorkflowState))).length),
        },
      ],
    },
    {
      kind: "table",
      title: { fa: "صورت‌وضعیت پیمانکاران جزء", en: "Subcontractor certificates" },
      columns: [
        { key: "sub", title: { fa: "پیمانکار جزء", en: "Subcontractor" }, weight: 3 },
        { key: "serial", title: { fa: "شماره", en: "Serial" }, format: "number", align: "end", weight: 1 },
        { key: "period", title: { fa: "دوره", en: "Period" }, weight: 2 },
        { key: "gross", title: { fa: "ناخالص", en: "Gross" }, format: "currency", align: "end", weight: 2 },
        { key: "net", title: { fa: "خالص", en: "Net" }, format: "currency", align: "end", weight: 2 },
        { key: "state", title: { fa: "وضعیت", en: "State" }, weight: 2 },
      ],
      rows: subs.map((x) => ({
        sub: cell(x.SubcontractorName),
        serial: cell(x.SerialNo),
        period: cell(x.PeriodCode),
        gross: cell(round(num(x.GrossAmount))),
        net: cell(round(num(x.NetPayable))),
        state: cell(x.WorkflowState),
      })),
    },
  ];
}

/** تطبیق با دفتر مالی — فقط داخلی. */
function buildFinSheet(inp: CntReportInput): Section[] {
  const rec = inp.reconcile ?? {};
  const sm = (rec.summary ?? {}) as Record<string, unknown>;
  const rows = (rec.rows ?? []) as Record<string, unknown>[];
  const fs = inp.finSummary ?? {};

  const sections: Section[] = [
    {
      kind: "kpi",
      title: { fa: "تطبیق دو دفتر", en: "Ledger reconciliation" },
      cells: [
        { label: { fa: "هماهنگ", en: "In sync" }, value: String(cell(sm.inSync)), tone: "good" },
        {
          label: { fa: "ارسال‌نشده", en: "Not posted" },
          value: String(cell(sm.notPosted)),
          tone: num(sm.notPosted) > 0 ? "warn" : "good",
        },
        {
          label: { fa: "مغایرت مبلغ", en: "Amount drift" },
          value: String(cell(sm.amountDrift)),
          tone: num(sm.amountDrift) > 0 ? "bad" : "good",
        },
        { label: { fa: "خالص ارسال‌شده", en: "Posted net" }, value: String(cell(round(num(fs.postedNet)))) },
        { label: { fa: "کسور نگه‌داشته", en: "Withheld" }, value: String(cell(round(num(fs.withheldAmount)))) },
      ],
    },
  ];

  if (rows.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "ردیف‌های تطبیق", en: "Reconciliation rows" },
      note: {
        fa: "مغایرت مبلغ خطرناک‌تر از ارسال‌نشده است، چون هر دو دفتر «ثبت‌شده» به نظر می‌رسند",
        en: "amount drift is more dangerous than unposted: both ledgers look settled",
      },
      columns: [
        { key: "serial", title: { fa: "شماره", en: "Serial" }, format: "number", align: "end", weight: 1 },
        { key: "period", title: { fa: "دوره", en: "Period" }, weight: 2 },
        { key: "net", title: { fa: "خالص پیمان", en: "Contract net" }, format: "currency", align: "end", weight: 2 },
        { key: "posted", title: { fa: "ثبت مالی", en: "Posted" }, format: "currency", align: "end", weight: 2 },
        { key: "drift", title: { fa: "اختلاف", en: "Drift" }, format: "currency", align: "end", weight: 2 },
        { key: "state", title: { fa: "وضعیت", en: "State" }, weight: 2 },
        { key: "action", title: { fa: "اقدام", en: "Action" }, weight: 3 },
      ],
      rows: rows.map((r) => ({
        serial: cell(r.serialNo),
        period: cell(r.periodCode),
        net: cell(round(num(r.netAmount))),
        posted: r.postedAmount == null ? "—" : round(num(r.postedAmount)),
        drift: cell(round(num(r.driftAmount))),
        state: cell(r.stateFa),
        action: cell(r.needsActionFa),
      })),
    });
  }

  return sections;
}

/** تک‌صفحه‌ای مدیریتی — فقط داخلی. */
function buildExecSheet(inp: CntReportInput): Section[] {
  const card = inp.scorecard ?? {};
  const health = (card.health ?? {}) as Record<string, unknown>;
  const alerts = (card.alerts ?? {}) as Record<string, unknown>;
  const fired = (alerts.fired ?? []) as Record<string, unknown>[];
  const p = inp.progress ?? {};

  const sections: Section[] = [
    {
      kind: "text",
      title: { fa: "قضاوت کلی", en: "Verdict" },
      body: {
        fa: String(card.headlineFa ?? "دادهٔ کافی برای قضاوت نیست"),
        en: String(card.headlineFa ?? "insufficient data"),
      },
    },
    {
      kind: "kpi",
      title: { fa: "شاخص‌های کلیدی", en: "Key indicators" },
      cells: [
        {
          label: { fa: "نمرهٔ سلامت", en: "Health score" },
          value: health.score == null ? "—" : String(health.score),
          tone: health.band === "good" ? "good" : health.band === "watch" ? "warn" : "bad",
        },
        { label: { fa: "پیشرفت فیزیکی", en: "Physical" }, value: pct(p.physicalPct) },
        { label: { fa: "پیشرفت مالی", en: "Financial" }, value: pct(p.financialPct) },
        {
          label: { fa: "هشدار بحرانی", en: "Critical alerts" },
          value: String(cell(alerts.criticalCount)),
          tone: num(alerts.criticalCount) > 0 ? "bad" : "good",
        },
      ],
    },
  ];

  if (fired.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "قلم‌های نیازمند تصمیم", en: "Decisions required" },
      note: {
        fa: "به ترتیب شدت — هر سطر یک اقدام مشخص دارد",
        en: "ordered by severity, each with a concrete action",
      },
      columns: [
        { key: "code", title: { fa: "کد", en: "Code" }, weight: 1 },
        { key: "title", title: { fa: "موضوع", en: "Subject" }, weight: 3 },
        { key: "severity", title: { fa: "شدت", en: "Severity" }, weight: 1 },
        { key: "message", title: { fa: "وضعیت", en: "Status" }, weight: 4 },
        { key: "action", title: { fa: "اقدام", en: "Action" }, weight: 4 },
      ],
      rows: fired.slice(0, 5).map((f) => ({
        code: cell(f.code),
        title: cell(f.titleFa),
        severity: cell(f.severityFa),
        message: cell(f.messageFa),
        action: cell(f.actionFa),
      })),
    });
  }

  const emerging = ((card.trend ?? {}) as Record<string, unknown>).emergingFa as string[] | undefined;
  if (emerging && emerging.length > 0) {
    sections.push({
      kind: "text",
      title: { fa: "در مسیر هشدار", en: "Emerging" },
      body: { fa: emerging.join(" · "), en: emerging.join(" · ") },
    });
  }

  return sections;
}

const CNT_REPORT_BUILDERS: Record<string, (inp: CntReportInput) => Section[]> = {
  "RPT-CNT-IPC": buildIpcSheet,
  "RPT-CNT-BOQ": buildBoqSheet,
  "RPT-CNT-PRG": buildProgressSheet,
  "RPT-CNT-GRT": buildGuaranteeSheet,
  "RPT-CNT-DED": buildDeductionSheet,
  "RPT-CNT-SUB": buildSubSheet,
  "RPT-CNT-FIN": buildFinSheet,
  "RPT-CNT-EXEC": buildExecSheet,
};

/**
 * ساخت گزارش به قالب مشترک `ReportDef` موتور گزارش‌ساز.
 *
 * خروجی مستقیم به `toPrintHtml` / `toExcelHtml` / `toCsv` داده می‌شود؛
 * قالب‌بندی A4، سربرگ سه‌لوگویی و صفحه‌بندی همه از همان موتور می‌آید و
 * اینجا بازنویسی نمی‌شود.
 */
export function buildCntReport(code: string, inp: CntReportInput): Record<string, unknown> | null {
  const def = CNT_REPORT_BY_CODE.get(code);
  const builder = CNT_REPORT_BUILDERS[code];
  if (!def || !builder) return null;

  const c = inp.contract ?? {};
  const sections = builder(inp);

  /* سربرگ هر گزارش، هویت پیمان را تکرار می‌کند: برگهٔ چاپ‌شده‌ای که
   * از پرونده جدا شود باید خودش بگوید مال کدام پیمان است. */
  const head: Section = {
    kind: "kpi",
    title: { fa: "شناسهٔ پیمان", en: "Contract identity" },
    cells: [
      { label: { fa: "کد پیمان", en: "Contract code" }, value: String(cell(c.Code)) },
      { label: { fa: "موضوع", en: "Subject" }, value: String(cell(c.TitleFa)) },
      { label: { fa: "پیمانکار", en: "Contractor" }, value: String(cell(c.ContractorName)) },
      { label: { fa: "مبلغ پیمان", en: "Contract amount" }, value: String(round(num(c.CurrentAmount) || num(c.InitialAmount))) },
    ],
  };

  return {
    code,
    title: def.title,
    periodicity: def.periodicity,
    sourceModule: "d14",
    audiences: def.audiences,
    sections: [head, ...sections],
    periodLabel: inp.periodLabel ?? null,
    asOf: inp.asOf ?? null,
  };
}
