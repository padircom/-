/**
 * فرمان‌های گفت‌وگویی روی درخت ساختار شکست.
 *
 * کاربر پرسید دستور استخراج را کجا بدهد. پاسخ طراحی: یک نوار فرمان زیر
 * خود درخت، تا دستور و نتیجه‌اش در یک نگاه باشند.
 *
 * این فایل موتور آن است — بدون React، تا بدون مرورگر آزمون شود.
 *
 * سه تصمیم:
 *
 * ۱. **هر فرمان قاعده‌محور اول تلاش می‌کند.** «سطح چهار را حذف کن» یک
 *    عملیات قطعی است؛ فرستادنش به مدل زبانی یعنی پرداخت هزینه و پذیرش
 *    عدم قطعیت برای کاری که با یک شرط انجام می‌شود. فقط آنچه قاعده
 *    نمی‌فهمد به AI می‌رود.
 *
 * ۲. **هر فرمان برگشت‌پذیر است.** AI گاهی درخت را بدتر می‌کند و کاربر
 *    باید بتواند برگردد، وگرنه یک دستور اشتباه کل کار را می‌سوزاند.
 *
 * ۳. **فرمانی که چیزی را تغییر ندهد، صریح اعلام می‌شود.** سکوت یعنی
 *    کاربر فکر می‌کند کار انجام شده و روی درختی حساب می‌کند که عوض
 *    نشده است.
 */

export const WBS_CMD_VERSION = "wcmd-v1";

/* ══════════════════════════ نوع‌ها ══════════════════════════ */

export type CmdNode = {
  code: string;
  parentCode?: string | null;
  titleFa: string;
  titleEn?: string | null;
  depth: number;
  weightFactor?: number | null;
  sourceRefFa?: string | null;
};

export type CommandKind =
  | "prune_depth"     // حذف سطوح عمیق‌تر از N
  | "drop_branch"     // حذف یک شاخه
  | "rename"          // تغییر عنوان یک گره
  | "renumber"        // شماره‌گذاری دوباره
  | "ai";             // چیزی که قاعده نفهمید

export type ParsedCommand = {
  kind: CommandKind;
  /** پارامتر عددی — مثلاً سطح در prune_depth. */
  value?: number;
  /** کد هدف. */
  target?: string;
  /** متن تازه برای rename. */
  text?: string;
  /** متن خام، برای فرستادن به AI. */
  raw: string;
};

export type CommandResult = {
  nodes: CmdNode[];
  changed: boolean;
  messageFa: string;
  /** چند گره حذف یا تغییر کرد. */
  affected: number;
};

/* ══════════════════════════ تجزیهٔ فرمان ══════════════════════════ */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function toLatinDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
}

/** عددهای نوشتاری رایج فارسی — «سطح چهار» باید مثل «سطح ۴» کار کند. */
const WORD_NUMBERS: Record<string, number> = {
  یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
};

function findNumber(text: string): number | null {
  const t = toLatinDigits(text);
  const digit = t.match(/\d+/);
  if (digit) return Number(digit[0]);
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (t.includes(word)) return n;
  }
  return null;
}

/**
 * تشخیص نیت فرمان.
 *
 * عمداً محافظه‌کار است: هر چیزی که قطعی نباشد به `ai` می‌رود. حدس زدن
 * نیت و اجرای عملیات اشتباه، بدتر از سپردن کار به مدل است.
 */
export function parseCommand(input: string): ParsedCommand {
  const raw = String(input ?? "").trim();
  const t = toLatinDigits(raw).toLowerCase();

  /* حذف سطح: «سطح ۴ را حذف کن» / «تا سطح ۳ نگه دار» */
  const mentionsLevel = /سطح|level|عمق|depth/.test(t);
  const mentionsRemove = /حذف|پاک|remove|delete|drop/.test(t);
  const mentionsKeep = /نگه|تا سطح|keep|limit|حداکثر/.test(t);

  if (mentionsLevel && (mentionsRemove || mentionsKeep)) {
    const n = findNumber(t);
    if (n !== null && n > 0) {
      /* «سطح ۴ را حذف کن» یعنی تا ۳ نگه دار؛ «تا سطح ۳ نگه دار» یعنی
       * همان ۳. این تفاوت یک واحدی اگر رعایت نشود، یک سطح کامل بی‌خبر
       * قربانی می‌شود. */
      const keep = mentionsKeep && !mentionsRemove ? n : n - 1;
      return { kind: "prune_depth", value: Math.max(1, keep), raw };
    }
  }

  /* حذف شاخه: «شاخهٔ P را حذف کن» */
  if (mentionsRemove) {
    const code = raw.match(/[A-Za-z]+[\w.\-]*/)?.[0];
    if (code && !/سطح|level/.test(t)) {
      return { kind: "drop_branch", target: code, raw };
    }
  }

  /* شماره‌گذاری دوباره */
  if (/شماره|renumber|بازشماری|کدگذاری/.test(t)) {
    return { kind: "renumber", raw };
  }

  /* تغییر نام: «X را به «عنوان تازه» تغییر بده» */
  if (/تغییر نام|rename|عنوانش|نامش/.test(t)) {
    const code = raw.match(/[A-Za-z]+[\w.\-]*/)?.[0];
    const quoted = raw.match(/[«"']([^»"']+)[»"']/)?.[1];
    if (code && quoted) return { kind: "rename", target: code, text: quoted, raw };
  }

  return { kind: "ai", raw };
}

/* ══════════════════════════ اجرای فرمان ══════════════════════════ */

/** فرزندان یک گره، به‌صورت بازگشتی. */
export function descendantsOf(nodes: CmdNode[], code: string): string[] {
  const out: string[] = [];
  const walk = (parent: string) => {
    for (const n of nodes) {
      if (n.parentCode === parent && !out.includes(n.code)) {
        out.push(n.code);
        walk(n.code);
      }
    }
  };
  walk(code);
  return out;
}

export function pruneDepth(nodes: CmdNode[], keep: number): CommandResult {
  const kept = nodes.filter((n) => n.depth <= keep);
  const affected = nodes.length - kept.length;
  return {
    nodes: kept,
    changed: affected > 0,
    affected,
    messageFa: affected > 0
      ? `${affected} گره عمیق‌تر از سطح ${keep} حذف شد.`
      : `هیچ گرهی عمیق‌تر از سطح ${keep} نبود.`,
  };
}

export function dropBranch(nodes: CmdNode[], code: string): CommandResult {
  const exists = nodes.some((n) => n.code.toLowerCase() === code.toLowerCase());
  if (!exists) {
    return { nodes, changed: false, affected: 0, messageFa: `گرهی با کد «${code}» پیدا نشد.` };
  }
  const real = nodes.find((n) => n.code.toLowerCase() === code.toLowerCase())!.code;
  /* فرزندان هم باید بروند، وگرنه یتیم می‌مانند و درخت می‌شکند. */
  const doomed = new Set([real, ...descendantsOf(nodes, real)]);
  const kept = nodes.filter((n) => !doomed.has(n.code));
  return {
    nodes: kept,
    changed: true,
    affected: doomed.size,
    messageFa: `شاخهٔ «${real}» با ${doomed.size - 1} زیرشاخه حذف شد.`,
  };
}

export function renameNode(nodes: CmdNode[], code: string, title: string): CommandResult {
  let hit = false;
  const next = nodes.map((n) => {
    if (n.code.toLowerCase() !== code.toLowerCase()) return n;
    hit = true;
    return { ...n, titleFa: title };
  });
  return {
    nodes: next,
    changed: hit,
    affected: hit ? 1 : 0,
    messageFa: hit ? `عنوان «${code}» تغییر کرد.` : `گرهی با کد «${code}» پیدا نشد.`,
  };
}

/**
 * شماره‌گذاری دوبارهٔ سلسله‌مراتبی: ۱، ۱-۱، ۱-۲، ۲ …
 *
 * ارجاع به بند قرارداد (`sourceRefFa`) دست‌نخورده می‌ماند — آن سند
 * حقوقی است و با تغییر شمارهٔ داخلی ما عوض نمی‌شود.
 */
export function renumber(nodes: CmdNode[]): CommandResult {
  if (nodes.length === 0) {
    return { nodes, changed: false, affected: 0, messageFa: "درختی برای شماره‌گذاری نیست." };
  }

  const childrenOf = new Map<string, CmdNode[]>();
  const roots: CmdNode[] = [];
  const codes = new Set(nodes.map((n) => n.code));
  for (const n of nodes) {
    if (n.parentCode && codes.has(n.parentCode)) {
      const arr = childrenOf.get(n.parentCode) ?? [];
      arr.push(n);
      childrenOf.set(n.parentCode, arr);
    } else {
      roots.push(n);
    }
  }

  const out: CmdNode[] = [];
  const guard = new Set<string>();
  const walk = (n: CmdNode, prefix: string, parentNew: string | null, depth: number) => {
    if (guard.has(n.code)) return;
    guard.add(n.code);
    out.push({ ...n, code: prefix, parentCode: parentNew, depth });
    (childrenOf.get(n.code) ?? []).forEach((c, i) => walk(c, `${prefix}-${i + 1}`, prefix, depth + 1));
  };
  roots.forEach((r, i) => walk(r, String(i + 1), null, 1));

  /* گره‌هایی که به‌خاطر حلقه جا ماندند نباید بی‌صدا حذف شوند. */
  for (const n of nodes) if (!guard.has(n.code)) out.push(n);

  return { nodes: out, changed: true, affected: out.length, messageFa: `${out.length} گره دوباره شماره‌گذاری شد.` };
}

/**
 * اجرای یک فرمان تجزیه‌شده.
 *
 * فرمان `ai` اینجا اجرا نمی‌شود؛ فراخواننده باید آن را به سرویس
 * بفرستد. جدا نگه داشتنشان یعنی مسیر قاعده‌محور بدون شبکه آزمون‌پذیر
 * می‌ماند.
 */
export function applyCommand(nodes: CmdNode[], cmd: ParsedCommand): CommandResult {
  switch (cmd.kind) {
    case "prune_depth":
      return pruneDepth(nodes, cmd.value ?? 1);
    case "drop_branch":
      return dropBranch(nodes, cmd.target ?? "");
    case "rename":
      return renameNode(nodes, cmd.target ?? "", cmd.text ?? "");
    case "renumber":
      return renumber(nodes);
    default:
      return { nodes, changed: false, affected: 0, messageFa: "این دستور به هوش مصنوعی سپرده می‌شود." };
  }
}

/* ══════════════════════════ پیشنهادها ══════════════════════════ */

/** نمونه‌فرمان‌هایی که زیر نوار نشان داده می‌شوند. */
export const COMMAND_HINTS: { fa: string; en: string }[] = [
  { fa: "تا سطح ۳ نگه دار", en: "Keep to level 3" },
  { fa: "دوباره شماره‌گذاری کن", en: "Renumber" },
  { fa: "شاخهٔ P را حذف کن", en: "Drop branch P" },
  { fa: "تدارکات را به سه بستهٔ فرعی بشکن", en: "Split procurement into three packages" },
];

/* ══════════════════════════ تاریخچه ══════════════════════════ */

export type HistoryEntry = {
  command: string;
  messageFa: string;
  at: string;
  /** وضعیت درخت پیش از این فرمان — مبنای بازگشت. */
  before: CmdNode[];
};

/** سقف تاریخچه؛ نگه داشتن بی‌نهایت وضعیت درخت، حافظه را می‌خورد. */
export const HISTORY_LIMIT = 20;

export function pushHistory(list: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [...list, entry].slice(-HISTORY_LIMIT);
}

/** بازگشت یک گام. */
export function undo(list: HistoryEntry[]): { nodes: CmdNode[] | null; history: HistoryEntry[] } {
  if (list.length === 0) return { nodes: null, history: list };
  const last = list[list.length - 1];
  return { nodes: last.before, history: list.slice(0, -1) };
}
