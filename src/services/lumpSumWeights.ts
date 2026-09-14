/**
 * وزن توافقی قرارداد لامپ‌سام — مسیر رسیدن از درصد به هزینه.
 *
 * منطق کاری که این فایل پیاده می‌کند:
 *
 * در قرارداد لامپ‌سام (EPC یا EPCC) یک عدد کل توافق می‌شود — مثلاً
 * ۱۶۷٬۰۰۰ میلیون دلار — و هیچ ردیف قیمتی زیر آن وجود ندارد. آنچه هست
 * درصدهای **توافقی** روی بسته‌های کاری است. هزینهٔ هر بسته از ضرب
 * همان درصد در مبلغ کل به دست می‌آید، نه از متره و نرخ.
 *
 * یعنی جهت محاسبه برعکس قرارداد فهرست‌بهاست:
 *
 *   فهرست‌بها:  مقدار × نرخ  →  مبلغ ردیف  →  جمع = مبلغ قرارداد
 *   لامپ‌سام:  مبلغ قرارداد × درصد توافقی  →  مبلغ بسته
 *
 * سه پیامد که کل طراحی اینجا بر آن‌ها استوار است:
 *
 * ۱. **جمع درصدها باید دقیقاً ۱۰۰ شود.** در فهرست‌بها اگر ردیفی جا
 *    بیفتد، جمع کمتر می‌شود و کسی می‌فهمد. اینجا اگر جمع ۹۸ باشد،
 *    ۲٪ از مبلغ قرارداد — بیش از ۳ هزار میلیون دلار در این پروژه —
 *    به هیچ بسته‌ای تخصیص نیافته و بی‌صدا گم می‌شود. پس گیت سخت است.
 *
 * ۲. **گرد کردن باید جبران شود.** ۱۶۷۰۰۰ تقسیم بر سه بسته یعنی سه
 *    عدد اعشاری که جمعشان با اصل نمی‌خواند. باقی‌مانده به بزرگ‌ترین
 *    بسته داده می‌شود تا جمع مبالغ دقیقاً برابر مبلغ قرارداد بماند.
 *
 * ۳. **درصد توافقی سند می‌خواهد.** چون از متره درنمی‌آید، تنها
 *    پشتوانه‌اش توافق طرفین است. هر وزن باید بگوید از کجا آمده.
 */

export const LUMPSUM_VERSION = "lsw-v1";

/* ══════════════════════════ نوع‌ها ══════════════════════════ */

/** نوع قرارداد؛ فازهای پیش‌فرض از این تعیین می‌شود. */
export type LumpSumContractType = "EPC" | "EPCC";

/**
 * فاز استاندارد.
 *
 * EPCC یک C اضافه دارد (Commissioning) که در EPC معمولاً داخل
 * Construction دیده می‌شود. جدا کردنش وقتی مهم است که تحویل موقت و
 * راه‌اندازی صورت‌وضعیت جدا دارند.
 */
export type PhaseCode = "E" | "P" | "C" | "CM";

export type PhaseMeta = {
  code: PhaseCode;
  titleFa: string;
  titleEn: string;
  /** درصد پیشنهادی آغازین — نقطهٔ شروع مذاکره، نه حکم. */
  typicalPct: number;
};

/**
 * درصدهای پیشنهادی رایج صنعت.
 *
 * اینها **پیشنهاد** هستند نه استاندارد. کاربر گفت «درصدها به‌صورت
 * توافقی و پیشنهادی» تعیین می‌شوند، پس نقش این جدول فقط پر کردن
 * فرم اولیه است تا کاربر از صفر شروع نکند.
 */
export const EPC_PHASES: PhaseMeta[] = [
  { code: "E", titleFa: "مهندسی", titleEn: "Engineering", typicalPct: 12 },
  { code: "P", titleFa: "تدارکات", titleEn: "Procurement", typicalPct: 48 },
  { code: "C", titleFa: "اجرا", titleEn: "Construction", typicalPct: 40 },
];

export const EPCC_PHASES: PhaseMeta[] = [
  { code: "E", titleFa: "مهندسی", titleEn: "Engineering", typicalPct: 11 },
  { code: "P", titleFa: "تدارکات", titleEn: "Procurement", typicalPct: 45 },
  { code: "C", titleFa: "اجرا", titleEn: "Construction", typicalPct: 36 },
  { code: "CM", titleFa: "راه‌اندازی", titleEn: "Commissioning", typicalPct: 8 },
];

export function phasesFor(type: LumpSumContractType): PhaseMeta[] {
  return type === "EPCC" ? EPCC_PHASES : EPC_PHASES;
}

/** پشتوانهٔ یک وزن توافقی. */
export type WeightBasis =
  | "agreed"     // توافق مکتوب طرفین
  | "proposed"   // پیشنهاد پیمانکار، هنوز تأیید نشده
  | "typical"    // از جدول پیشنهادی پر شده
  | "derived";   // از جمع فرزندان محاسبه شده

export type WeightedNode = {
  code: string;
  parentCode?: string | null;
  titleFa: string;
  /** درصد نسبت به **والد**، نه نسبت به کل پروژه. */
  weightPct: number | null;
  basis: WeightBasis;
  /** ارجاع به بند قرارداد یا صورت‌جلسه. */
  sourceRefFa?: string | null;
};

/* ══════════════════════════ کمکی ══════════════════════════ */

/** گرد کردن پول با دقت مشخص. */
export function roundMoney(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function roundPct(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/* ══════════════════════════ گیت جمع وزن ══════════════════════════ */

export type WeightGateResult = {
  ok: boolean;
  sum: number;
  /** فاصله تا ۱۰۰. مثبت یعنی بیش‌برآورد. */
  deltaPct: number;
  /** همان فاصله به پول — عددی که واقعاً گم یا اضافه می‌شود. */
  deltaAmount: number;
  missingCount: number;
  messageFa: string | null;
};

/**
 * آستانهٔ پذیرش جمع وزن.
 *
 * چرا این‌قدر تنگ: با مبلغ ۱۶۷٬۰۰۰ میلیون دلار، هر صدم درصد برابر
 * ۱۶٫۷ میلیون دلار است. آستانهٔ ۰٫۰۱ یعنی حداکثر همان یک واحد خطای
 * گرد کردن پذیرفته می‌شود و نه بیشتر.
 */
export const WEIGHT_SUM_TOLERANCE = 0.01;

/**
 * سنجش جمع وزن هم‌نیاکان.
 *
 * `null` با صفر یکی نیست: صفر یعنی «این بسته وزنی ندارد» که ادعاست،
 * و `null` یعنی «هنوز توافق نشده» که اعتراف است. دومی باید شمرده و
 * گزارش شود، نه اینکه در جمع صفر فرض شود.
 */
export function checkWeightSum(
  nodes: Pick<WeightedNode, "weightPct">[],
  contractAmount = 0,
): WeightGateResult {
  const withValue = nodes.filter((n) => n.weightPct !== null && n.weightPct !== undefined);
  const missingCount = nodes.length - withValue.length;
  const sum = roundPct(withValue.reduce((s, n) => s + (n.weightPct as number), 0));
  const deltaPct = roundPct(sum - 100);
  const deltaAmount = roundMoney((deltaPct / 100) * contractAmount);

  if (nodes.length === 0) {
    return { ok: false, sum: 0, deltaPct: -100, deltaAmount: roundMoney(-contractAmount), missingCount: 0, messageFa: "هیچ بسته‌ای تعریف نشده است." };
  }
  if (missingCount > 0) {
    return {
      ok: false,
      sum,
      deltaPct,
      deltaAmount,
      missingCount,
      messageFa: `${missingCount} بسته هنوز درصد توافقی ندارد.`,
    };
  }
  if (Math.abs(deltaPct) > WEIGHT_SUM_TOLERANCE) {
    const dir = deltaPct > 0 ? "بیش از" : "کمتر از";
    return {
      ok: false,
      sum,
      deltaPct,
      deltaAmount,
      missingCount: 0,
      messageFa: `جمع درصدها ${sum} است — ${dir} ۱۰۰. اختلاف معادل ${Math.abs(deltaAmount).toLocaleString("fa-IR")} از مبلغ قرارداد.`,
    };
  }
  return { ok: true, sum, deltaPct, deltaAmount, missingCount: 0, messageFa: null };
}

/* ══════════════════════════ وزن مطلق ══════════════════════════ */

export type AbsoluteWeight = {
  code: string;
  /** WF — درصد نسبت به والد. */
  weightFactor: number;
  /** WV — درصد نسبت به کل پروژه. حاصل‌ضرب زنجیرهٔ نیاکان. */
  weightValue: number;
  depth: number;
};

/**
 * تبدیل درصد نسبی به درصد مطلق.
 *
 * WV یک گره = WF خودش × WV والدش. بدون این، درصدهای سطوح مختلف با هم
 * جمع‌پذیر نیستند و «پیشرفت کل پروژه» بی‌معنا می‌شود.
 */
export function computeAbsoluteWeights(nodes: WeightedNode[]): AbsoluteWeight[] {
  const byCode = new Map(nodes.map((n) => [n.code, n]));
  const cache = new Map<string, { wv: number; depth: number }>();

  const resolve = (code: string, guard: Set<string>): { wv: number; depth: number } => {
    const hit = cache.get(code);
    if (hit) return hit;

    const node = byCode.get(code);
    if (!node) return { wv: 0, depth: 0 };

    /* حلقهٔ والد: A والد B و B والد A. بدون این نگهبان، بازگشت
     * بی‌پایان می‌شود و برگه بی‌هیچ پیامی می‌ماسد. */
    if (guard.has(code)) return { wv: 0, depth: 0 };
    guard.add(code);

    const wf = node.weightPct ?? 0;
    if (!node.parentCode) {
      const out = { wv: roundPct(wf), depth: 1 };
      cache.set(code, out);
      return out;
    }
    const parent = resolve(node.parentCode, guard);
    const out = { wv: roundPct((wf * parent.wv) / 100), depth: parent.depth + 1 };
    cache.set(code, out);
    return out;
  };

  return nodes.map((n) => {
    const r = resolve(n.code, new Set());
    return { code: n.code, weightFactor: roundPct(n.weightPct ?? 0), weightValue: r.wv, depth: r.depth };
  });
}

/* ══════════════════════════ درصد به پول ══════════════════════════ */

export type CostAllocation = {
  code: string;
  weightValue: number;
  amount: number;
};

export type AllocationResult = {
  rows: CostAllocation[];
  /** جمع مبالغ تخصیص‌یافته — باید دقیقاً برابر مبلغ قرارداد باشد. */
  allocated: number;
  /** باقی‌ماندهٔ گرد کردن که جبران شد. */
  roundingFixApplied: number;
  warningsFa: string[];
};

/**
 * تبدیل وزن مطلق به مبلغ — قلب مسیر «از درصد به هزینه».
 *
 * جبران گرد کردن: پس از ضرب، جمع مبالغ ممکن است چند سنت با مبلغ
 * قرارداد فرق کند. آن باقی‌مانده به بزرگ‌ترین بسته اضافه می‌شود، چون
 * اثر نسبی‌اش آنجا کمترین است. پخش کردنش بین همه، خطا را در همه‌جا
 * می‌نشاند به‌جای اینکه در یک جا مهار شود.
 */
export function allocateCost(
  weights: Pick<AbsoluteWeight, "code" | "weightValue">[],
  contractAmount: number,
  digits = 2,
): AllocationResult {
  const warningsFa: string[] = [];

  if (!(contractAmount > 0)) {
    return { rows: [], allocated: 0, roundingFixApplied: 0, warningsFa: ["مبلغ قرارداد تعیین نشده است."] };
  }
  /* فقط برگ‌ها تخصیص می‌گیرند؛ اگر والد و فرزند هر دو شمرده شوند،
   * مبلغ دو بار حساب می‌شود. تشخیص برگ کار فراخواننده است، ولی جمع
   * وزن اینجا کنترل می‌شود تا خطا زود دیده شود. */
  const sumWv = roundPct(weights.reduce((s, w) => s + w.weightValue, 0));
  if (Math.abs(sumWv - 100) > WEIGHT_SUM_TOLERANCE) {
    warningsFa.push(`جمع وزن مطلق ${sumWv} است نه ۱۰۰؛ احتمالاً گره‌های میانی هم شمرده شده‌اند.`);
  }

  const rows: CostAllocation[] = weights.map((w) => ({
    code: w.code,
    weightValue: w.weightValue,
    amount: roundMoney((w.weightValue / 100) * contractAmount, digits),
  }));

  const allocatedRaw = roundMoney(rows.reduce((s, r) => s + r.amount, 0), digits);
  let fix = 0;

  /* جبران فقط وقتی معنا دارد که وزن‌ها درست باشند؛ وگرنه اختلاف
   * واقعی است و پنهان کردنش خطا را می‌پوشاند. */
  if (rows.length > 0 && Math.abs(sumWv - 100) <= WEIGHT_SUM_TOLERANCE) {
    fix = roundMoney(contractAmount - allocatedRaw, digits);
    if (fix !== 0) {
      let biggest = 0;
      for (let i = 1; i < rows.length; i += 1) {
        if (rows[i].amount > rows[biggest].amount) biggest = i;
      }
      rows[biggest].amount = roundMoney(rows[biggest].amount + fix, digits);
    }
  }

  return {
    rows,
    allocated: roundMoney(rows.reduce((s, r) => s + r.amount, 0), digits),
    roundingFixApplied: fix,
    warningsFa,
  };
}

/* ══════════════════════════ پیشرفت وزنی ══════════════════════════ */

export type ProgressInput = { code: string; physicalPct: number };

export type EarnedResult = {
  /** پیشرفت کل پروژه بر پایهٔ وزن مطلق. */
  overallPct: number;
  /** ارزش کسب‌شده به پول. */
  earnedAmount: number;
  /** بسته‌هایی که پیشرفت دارند ولی وزن ندارند — نشت پیشرفت. */
  unweightedCodes: string[];
};

/**
 * پیشرفت وزنی و ارزش کسب‌شده.
 *
 * نکتهٔ حیاتی: بسته‌ای که پیشرفت دارد ولی وزنش `null` است، پیشرفتش
 * هرگز در عدد کل دیده نمی‌شود. آن بسته‌ها جدا برگردانده می‌شوند چون
 * سکوت در این مورد یعنی پروژه جلوتر از عددی است که گزارش می‌شود.
 */
export function computeEarned(
  weights: Pick<AbsoluteWeight, "code" | "weightValue">[],
  progress: ProgressInput[],
  contractAmount: number,
): EarnedResult {
  const wvByCode = new Map(weights.map((w) => [w.code, w.weightValue]));
  const unweightedCodes: string[] = [];
  let acc = 0;

  for (const p of progress) {
    const wv = wvByCode.get(p.code);
    const pct = Math.min(100, Math.max(0, p.physicalPct));
    if (wv === undefined || wv === 0) {
      if (pct > 0) unweightedCodes.push(p.code);
      continue;
    }
    acc += (wv * pct) / 100;
  }

  const overallPct = roundPct(acc);
  return {
    overallPct,
    earnedAmount: roundMoney((overallPct / 100) * contractAmount),
    unweightedCodes,
  };
}

/* ══════════════════════════ توزیع پیشنهادی ══════════════════════════ */

/**
 * پر کردن اولیهٔ درصدها از جدول پیشنهادی.
 *
 * خروجی `basis: "typical"` می‌گیرد تا در گزارش از وزن توافقی واقعی
 * قابل تفکیک باشد. وزن پیشنهادی که به‌عنوان توافقی جا بزند، مبنای
 * صورت‌وضعیتی می‌شود که هیچ‌کس امضایش نکرده.
 */
export function seedTypicalWeights(type: LumpSumContractType): WeightedNode[] {
  return phasesFor(type).map((p) => ({
    code: p.code,
    parentCode: null,
    titleFa: p.titleFa,
    weightPct: p.typicalPct,
    basis: "typical" as WeightBasis,
    sourceRefFa: null,
  }));
}

/**
 * نرمال‌سازی به ۱۰۰ با حفظ نسبت‌ها.
 *
 * وقتی کاربر چند درصد را دستی عوض می‌کند، جمع از ۱۰۰ خارج می‌شود.
 * این تابع نسبت‌ها را نگه می‌دارد و فقط مقیاس را اصلاح می‌کند —
 * ولی نتیجه `basis: "derived"` است نه `agreed`، چون عددی که کاربر
 * توافق کرده دیگر همان نیست.
 */
export function normalizeToHundred(nodes: WeightedNode[]): WeightedNode[] {
  const withValue = nodes.filter((n) => n.weightPct !== null);
  const sum = withValue.reduce((s, n) => s + (n.weightPct as number), 0);
  if (sum <= 0) return nodes;

  return nodes.map((n) => {
    if (n.weightPct === null) return n;
    const scaled = roundPct((n.weightPct * 100) / sum);
    return scaled === n.weightPct ? n : { ...n, weightPct: scaled, basis: "derived" as WeightBasis };
  });
}
