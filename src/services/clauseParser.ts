/**
 * موتور تقسیم متن قرارداد به بند.
 *
 * این موتور **قاعده‌محور** است و به هیچ سرویس بیرونی نیاز ندارد. کارش
 * پیدا کردن مرز بندها در متن خام است تا هر چیزی که بعداً استخراج شود
 * بتواند بگوید «از کدام بند آمدم».
 *
 * چرا قاعده‌محور و نه AI:
 *
 * تقسیم بند یک مسئلهٔ الگویی است، نه معنایی. شماره‌گذاری قرارداد
 * ساختار دارد و آن ساختار با regex قابل تشخیص است. سپردنش به AI یعنی
 * پرداخت هزینه و پذیرش عدم قطعیت برای کاری که قطعی است. AI جای دیگری
 * لازم می‌شود: گروه‌بندی معنایی اقلام BoQ.
 *
 * قید مهم: تا دیدن قرارداد واقعی کاربر، الگوها بر پایهٔ رایج‌ترین
 * شکل‌های قرارداد فارسی و انگلیسی تنظیم شده‌اند. هر الگو جداگانه
 * آزمون دارد، پس افزودن الگوی تازه چیزی را نمی‌شکند.
 */

import { normalizeDigits } from "./integration";

export const CLAUSE_VERSION = "clause-v1";

/* ══════════════════════════ نوع‌ها ══════════════════════════ */

/** سبک شماره‌گذاری که در متن تشخیص داده شد. */
export type ClauseStyle =
  | "numeric_dash"   // ۵-۲-۳
  | "numeric_dot"    // ۵.۲.۳
  | "article"        // ماده ۷
  | "paragraph"      // بند ب
  | "note"           // تبصره ۲
  | "section_en"     // Article 7 / Section 3
  | "clause_en"      // 5.2.3 (لاتین)
  | "step_code";     // C.P3.1 / CP.3.9 / Cp.3.9.B

export type ParsedClause = {
  clauseNo: string;
  parentClauseNo: string | null;
  depth: number;
  titleFa: string | null;
  bodyText: string;
  style: ClauseStyle;
  charStart: number;
  charEnd: number;
  pageNo: number;
  ordinal: number;
};

export type ParseResult = {
  clauses: ParsedClause[];
  /** سبک غالب متن؛ برای نمایش به کاربر و انتخاب قواعد بعدی. */
  dominantStyle: ClauseStyle | null;
  /** آنچه پیش از نخستین بند آمده — معمولاً سربرگ و مقدمه. */
  preamble: string;
  warningsFa: string[];
};

/**
 * تبدیل رقم فارسی/عربی به لاتین **بدون تغییر طول رشته**.
 *
 * `normalizeDigits` مشترک، نیم‌فاصله را حذف و رشته را trim می‌کند و در
 * نتیجه طول عوض می‌شود. اینجا نمی‌شود از آن استفاده کرد چون `charStart`
 * و `charEnd` باید به متن اصلی اشاره کنند؛ یک نویسه جابه‌جایی یعنی
 * برجسته‌سازی پیش‌نمایش روی جای غلط می‌افتد.
 */
function latinizeDigitsKeepLength(line: string): string {
  return line
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS_LOCAL.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS_LOCAL.indexOf(d)));
}

const FA_DIGITS_LOCAL = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS_LOCAL = "٠١٢٣٤٥٦٧٨٩";

/* ══════════════════════════ الگوها ══════════════════════════ */

/**
 * هر الگو یک سرِ بند را می‌گیرد.
 *
 * ترتیب مهم است: الگوهای خاص‌تر (ماده، تبصره) پیش از عمومی‌تر
 * (عدد-خط‌تیره) می‌آیند، وگرنه «ماده ۵-۲» به‌عنوان عدد ساده خوانده
 * می‌شود و کلمهٔ «ماده» از دست می‌رود.
 */
type PatternDef = {
  style: ClauseStyle;
  /** باید گروه `no` داشته باشد. */
  re: RegExp;
  /** عمق را از شمارهٔ بند حساب می‌کند. */
  depthOf: (no: string) => number;
};

const PATTERNS: PatternDef[] = [
  {
    style: "note",
    /* تبصره — همیشه فرزند بند پیشین است. */
    re: /^[ \t]*(?<no>تبصره[ \t]*\d*)[ \t]*[:.\-–)]?[ \t]*/,
    depthOf: () => 9,
  },
  {
    style: "article",
    re: /^[ \t]*(?<no>ماده[ \t]*\d+)[ \t]*[:.\-–)]?[ \t]*/,
    depthOf: () => 1,
  },
  {
    style: "paragraph",
    /* بند الف / بند ۲
     *
     * سقف حرف‌ها ۳ است نه ۲: نشانه‌های ترتیبی فارسی «الف» سه حرفی است
     * و با سقف ۲ به «ال» بریده می‌شد — شمارهٔ بند خراب و درخت غلط. */
    re: /^[ \t]*(?<no>بند[ \t]*(?:الف|[ب-ی]{1,2}|\d+))[ \t]*[:.\-–)]?[ \t]*/,
    depthOf: () => 2,
  },
  {
    /* کد گام رویه‌ای: C.P3.1 · CP.3.9 · Cp.3.9.B
     *
     * این الگو از سند واقعی کاربر (Scope of Work حفاری) آمد. سندهای
     * رویه‌ای به‌جای بند شماره‌دار، گام‌های اجرایی با کد حرفی-عددی
     * دارند و هر گام یک واحد کار است — یعنی مستقیماً نامزد گرهٔ WBS.
     *
     * پیش از الگوهای عددی می‌آید وگرنه «3.1» از دل «C.P3.1» بیرون
     * کشیده می‌شود و حرف‌ها گم می‌شوند.
     */
    style: "step_code",
    re: /^[ \t]*(?<no>[A-Za-z](?:\.?[A-Za-z])*\.?\d+(?:\.\d+)+(?:\.?[A-Za-z])?)[ \t]+(?=\S)/,
    depthOf: () => 2,
  },
  {
    style: "section_en",
    re: /^[ \t]*(?<no>(?:Article|Section|Clause)[ \t]+\d+(?:\.\d+)*)[ \t]*[:.\-–)]?[ \t]*/i,
    depthOf: (no) => (no.match(/\./g)?.length ?? 0) + 1,
  },
  {
    style: "numeric_dash",
    /* دو شکل رایج فارسی:
     *   «۱- موضوع»      عدد تنها با خط تیرهٔ پایانی
     *   «۱-۱- شرح کار»  سلسله‌مراتبی
     * خط تیرهٔ پایانی اجباری است تا «۱۴ نفر» سرِ بند شمرده نشود. */
    re: /^[ \t]*(?<no>\d+(?:-\d+)*)[ \t]*-[ \t]+/,
    depthOf: (no) => no.split("-").length,
  },
  {
    style: "numeric_dot",
    /* ۵.۲.۳ — دست‌کم یک نقطه لازم است تا با شمارهٔ صفحه اشتباه نشود */
    re: /^[ \t]*(?<no>\d+(?:\.\d+)+)[ \t]*[:.\-–)]?[ \t]+/,
    depthOf: (no) => no.split(".").length,
  },
  {
    style: "clause_en",
    /* عدد تنها در ابتدای خط: «7. Payment» — پرخطرترین الگو، آخر می‌آید */
    re: /^[ \t]*(?<no>\d{1,2})[.)][ \t]+(?=[^\d])/,
    depthOf: () => 1,
  },
];

/* ══════════════════════════ کمکی ══════════════════════════ */

/**
 * یکسان‌سازی شمارهٔ بند برای مقایسه.
 *
 * «۵-۲» و «5-2» و «۵ - ۲» باید یک چیز شمرده شوند، وگرنه درخت والد و
 * فرزند به هم وصل نمی‌شود.
 */
/**
 * شکل متعارف کد گام.
 *
 * سند واقعی همان گام را سه جور می‌نویسد: `C.P3.1` و `CP.3.1` و
 * `Cp.3.9.B`. اگر یکسان نشوند، ارجاع متقابل داخل متن به گام دیگری
 * وصل می‌شود و درخت سه شاخهٔ تکراری می‌گیرد.
 *
 * قاعده: حروف بزرگ می‌شوند، نقطهٔ میان حروف حذف و نقطهٔ میان اعداد
 * نگه داشته می‌شود.
 */
export function canonicalStepCode(raw: string): string {
  const s = normalizeDigits(raw).toUpperCase().replace(/\s+/g, "");
  const m = /^([A-Z.]+?)\.?(\d.*)$/.exec(s);
  if (!m) return s;
  const letters = m[1].replace(/\./g, "");
  return `${letters}${m[2]}`;
}

export function normalizeClauseNo(raw: string): string {
  return normalizeDigits(raw)
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*\.\s*/g, ".")
    .trim();
}

/**
 * والد یک شمارهٔ بند سلسله‌مراتبی.
 *
 * «۵-۲-۳» ← «۵-۲». برای بندهای غیرسلسله‌مراتبی (ماده، تبصره) اینجا
 * `null` برمی‌گردد و والد در زمان پیمایش از بند پیشین گرفته می‌شود.
 */
export function parentOf(clauseNo: string): string | null {
  const s = normalizeClauseNo(clauseNo);
  const sep = s.includes("-") ? "-" : s.includes(".") ? "." : null;
  if (!sep) return null;
  const parts = s.split(sep);
  if (parts.length < 2) return null;
  /* فقط وقتی سلسله‌مراتبی است که همهٔ اجزا عدد باشند. */
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  return parts.slice(0, -1).join(sep);
}

/** آیا این خط سرِ بند است؟ نخستین الگوی منطبق برنده است. */
function matchHead(line: string): { style: ClauseStyle; no: string; rest: string; depth: number } | null {
  /* الگوها با `\d` نوشته شده‌اند و `\d` رقم فارسی را نمی‌گیرد. بدون
   * این تبدیل، هیچ بند فارسی‌ای شناسایی نمی‌شود — و چون تابع فقط
   * `null` برمی‌گرداند، شکست بی‌صدا بود. */
  const probe = latinizeDigitsKeepLength(line);
  for (const p of PATTERNS) {
    const m = p.re.exec(probe);
    if (!m?.groups?.no) continue;
    const no = p.style === "step_code"
      ? canonicalStepCode(m.groups.no)
      : normalizeClauseNo(m.groups.no);
    return {
      style: p.style,
      no,
      rest: line.slice(m[0].length),
      depth: p.depthOf(no),
    };
  }
  return null;
}

/**
 * حدس عنوان بند از نخستین خط آن.
 *
 * عنوان معمولاً کوتاه است و با نقطه تمام نمی‌شود. اگر خط بلند باشد
 * احتمالاً خودِ متن است نه عنوان، و در آن صورت `null` برمی‌گردد —
 * عنوان ساختگی بدتر از نبودن عنوان است.
 */
export function guessTitle(firstLine: string): string | null {
  const s = firstLine.trim();
  if (!s) return null;
  if (s.length > 80) return null;
  if (/[.،؛]$/.test(s)) return null;
  return s;
}

/* ══════════════════════════ تقسیم صفحه ══════════════════════════ */

/** جداکنندهٔ صفحه که استخراج‌کننده‌های PDF می‌گذارند. */
const PAGE_BREAK = /\f/;

/**
 * نگاشت اندیس نویسه به شمارهٔ صفحه.
 *
 * بدون این، `pageNo` همیشه صفر می‌ماند و ارجاع «ص ۱۴ / بند ۵-۲» که
 * قرار است منشأ را ثابت کند، بی‌معنا می‌شود.
 */
export function buildPageIndex(text: string): number[] {
  const bounds: number[] = [];
  let at = 0;
  for (const part of text.split(PAGE_BREAK)) {
    at += part.length + 1;
    bounds.push(at);
  }
  return bounds;
}

export function pageOf(charIndex: number, bounds: number[]): number {
  for (let i = 0; i < bounds.length; i += 1) {
    if (charIndex < bounds[i]) return i + 1;
  }
  return Math.max(1, bounds.length);
}

/* ══════════════════════════ موتور اصلی ══════════════════════════ */

/**
 * تقسیم متن قرارداد به بند.
 *
 * روش: متن خط‌به‌خط پیمایش می‌شود؛ هر خطی که سرِ بند باشد یک بند تازه
 * آغاز می‌کند و خطوط بعدی تا سرِ بند بعدی، بدنهٔ آن می‌شوند.
 */
export function parseClauses(rawText: string): ParseResult {
  const warningsFa: string[] = [];
  const text = String(rawText ?? "");

  if (!text.trim()) {
    return {
      clauses: [],
      dominantStyle: null,
      preamble: "",
      warningsFa: ["متنی برای تجزیه وجود ندارد. اگر فایل PDF اسکن‌شده است، نیاز به OCR دارد."],
    };
  }

  const pageBounds = buildPageIndex(text);
  const lines = text.split(/\r?\n/);

  type Acc = { head: NonNullable<ReturnType<typeof matchHead>>; start: number; lines: string[] };
  const acc: Acc[] = [];
  let preambleLines: string[] = [];
  let cursor = 0;

  for (const line of lines) {
    const lineStart = cursor;
    cursor += line.length + 1;

    const head = matchHead(line);
    if (head) {
      acc.push({ head, start: lineStart, lines: head.rest ? [head.rest] : [] });
    } else if (acc.length === 0) {
      preambleLines.push(line);
    } else {
      acc[acc.length - 1].lines.push(line);
    }
  }

  if (acc.length === 0) {
    return {
      clauses: [],
      dominantStyle: null,
      preamble: text.trim(),
      warningsFa: ["هیچ شمارهٔ بندی شناسایی نشد. الگوی شماره‌گذاری این قرارداد پشتیبانی نمی‌شود."],
    };
  }

  /* سبک غالب: پرتکرارترین سبک. سندی که چند سبک قاطی دارد معمولاً
   * پیوست‌های متفاوت را کنار هم گذاشته است. */
  const styleCount = new Map<ClauseStyle, number>();
  for (const a of acc) styleCount.set(a.head.style, (styleCount.get(a.head.style) ?? 0) + 1);
  const dominantStyle = [...styleCount.entries()].sort((x, y) => y[1] - x[1])[0][0];
  if (styleCount.size > 2) {
    warningsFa.push(`چند سبک شماره‌گذاری هم‌زمان دیده شد (${styleCount.size} سبک). مرز بندها را بازبینی کنید.`);
  }

  const clauses: ParsedClause[] = [];
  const seen = new Set<string>();
  const numberedSoFar = new Set<string>();
  let lastAny: string | null = null;
  let lastTopLevel: string | null = null;
  let lastSection: string | null = null;

  acc.forEach((a, i) => {
    const end = i + 1 < acc.length ? acc[i + 1].start : text.length;
    const body = a.lines.join("\n").trim();

    /* شمارهٔ تکراری: بعضی قراردادها شماره را در سربرگ صفحه تکرار
     * می‌کنند. نگه داشتن هر دو یعنی درخت دو شاخهٔ یکسان می‌گیرد. */
    let no = a.head.no;
    if (seen.has(no)) {
      warningsFa.push(`شمارهٔ بند «${no}» بیش از یک بار آمده است.`);
      let n = 2;
      while (seen.has(`${no}#${n}`)) n += 1;
      no = `${no}#${n}`;
    }
    seen.add(no);

    let parent = parentOf(no);

    if (a.head.style === "note") {
      /* تبصره فرزند آخرین بند است، هر سبکی که داشته باشد. */
      parent = lastAny;
    } else if (a.head.style === "step_code") {
      /* گام رویه‌ای فرزند سرفصلی است که پیش از آن آمده — مثلاً
       * C.P3.1 زیر بخش 5.2.2.3 «Contingency plan-3». */
      parent = lastSection;
    } else if (parent) {
      /* والد عددی «۲» ممکن است اصلاً بندی به آن نام نداشته باشد چون
       * سند از «ماده ۲» استفاده کرده است. آن وقت «۲-۱» یتیم می‌شود.
       *
       * این روی متن واقعی دیده شد، نه در طراحی: سندهای فارسی مرتب
       * سرشاخه را «ماده» و زیرشاخه را عددی می‌نویسند. پس اگر والد
       * عددی وجود نداشت، به آخرین سرشاخهٔ سطح‌یک وصل می‌شود. */
      if (!numberedSoFar.has(parent) && lastTopLevel) {
        parent = lastTopLevel;
      }
    }

    if (a.head.style !== "note") {
      lastAny = no;
      if (a.head.depth === 1) lastTopLevel = no;
    }
    if (a.head.style !== "step_code" && a.head.style !== "note") lastSection = no;
    numberedSoFar.add(no);

    const depth = a.head.style === "note" ? 2 : a.head.depth;

    clauses.push({
      clauseNo: no,
      parentClauseNo: parent,
      depth,
      titleFa: guessTitle(a.lines[0] ?? ""),
      bodyText: body,
      style: a.head.style,
      charStart: a.start,
      charEnd: end,
      pageNo: pageOf(a.start, pageBounds),
      ordinal: i + 1,
    });
  });

  /* والدِ گم‌شده: «۵-۲-۳» بدون «۵-۲». درخت را می‌شکند و باید دیده شود. */
  const numbers = new Set(clauses.map((c) => c.clauseNo));
  const orphans = clauses.filter((c) => c.parentClauseNo && !numbers.has(c.parentClauseNo));
  if (orphans.length) {
    warningsFa.push(`${orphans.length} بند والدِ ثبت‌نشده دارند (نمونه: ${orphans[0].clauseNo}).`);
  }

  return {
    clauses,
    dominantStyle,
    preamble: preambleLines.join("\n").trim(),
    warningsFa,
  };
}

/* ══════════════════════════ درخت ══════════════════════════ */

export type ClauseTreeNode = ParsedClause & { children: ClauseTreeNode[] };

/**
 * ساخت درخت از فهرست تخت.
 *
 * بندی که والدش پیدا نشود به ریشه می‌رود، نه اینکه دور ریخته شود —
 * یک بند گم‌شده بدتر از یک درخت ناقص است.
 */
export function buildClauseTree(clauses: ParsedClause[]): ClauseTreeNode[] {
  const byNo = new Map<string, ClauseTreeNode>();
  for (const c of clauses) byNo.set(c.clauseNo, { ...c, children: [] });

  const roots: ClauseTreeNode[] = [];
  for (const node of byNo.values()) {
    const parent = node.parentClauseNo ? byNo.get(node.parentClauseNo) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** ارجاع خوانا برای اثبات منشأ: «ص ۱۴ / بند ۵-۲». */
export function sourceRefFa(clause: Pick<ParsedClause, "pageNo" | "clauseNo">): string {
  const page = clause.pageNo > 0 ? `ص ${clause.pageNo}` : "ص نامشخص";
  return `${page} / بند ${clause.clauseNo}`;
}
