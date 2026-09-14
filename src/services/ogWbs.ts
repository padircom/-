/**
 * ساختار شکست استاندارد نفت و گاز + واژگان ترجمهٔ تخصصی.
 *
 * چرا این فایل جداست:
 *
 * ترجمهٔ عمومی برای قرارداد نفت و گاز کافی نیست. یک مترجم عمومی
 * «Tie-in» را «گره خوردن» و «Hook-up» را «قلاب کردن» ترجمه می‌کند،
 * و آن یعنی ساختار شکستی که هیچ مهندسی نمی‌فهمد. واژگان زیر پیش از
 * سپردن متن به مدل زبانی اعمال می‌شود تا اصطلاح فنی دست‌نخورده بماند.
 *
 * دربارهٔ نگهداری متن اصلی:
 *
 * متن انگلیسی **حذف نمی‌شود**. در دعوای قراردادی، مرجع همان نسخه‌ای
 * است که طرفین امضا کرده‌اند، نه ترجمه. پس هر دو نگه داشته می‌شوند و
 * ترجمه به‌عنوان کمک‌خوان علامت می‌خورد نه جایگزین.
 */

export const OG_WBS_VERSION = "ogw-v1";

/* ══════════════════════════ نوع‌ها ══════════════════════════ */

export type Bi = { fa: string; en: string };

export type OgTemplateNode = {
  code: string;
  parentCode: string | null;
  title: Bi;
  /** درصد پیشنهادی نسبت به والد — نقطهٔ شروع مذاکره، نه حکم. */
  typicalPct: number | null;
  /** فاز EPC که این گره زیر آن می‌نشیند. */
  phase: "E" | "P" | "C" | "CM" | null;
};

export type OgTemplate = {
  id: string;
  title: Bi;
  /** توضیح کوتاه که کاربر بداند کدام قالب به کارش می‌آید. */
  note: Bi;
  nodes: OgTemplateNode[];
};

/* ══════════════════════════ قالب‌های صنعت ══════════════════════════ */

/**
 * قالب عمومی EPC نفت و گاز — سطح یک و دو.
 *
 * سطح سه عمداً خالی است: آنجا وابسته به دامنهٔ کار هر قرارداد است و
 * پر کردنش با حدس یعنی ساختاری که با قرارداد نمی‌خواند.
 */
const OG_EPC_NODES: OgTemplateNode[] = [
  { code: "E", parentCode: null, title: { fa: "مهندسی", en: "Engineering" }, typicalPct: 11, phase: "E" },
  { code: "E.1", parentCode: "E", title: { fa: "مهندسی پایه", en: "Basic engineering / FEED" }, typicalPct: 30, phase: "E" },
  { code: "E.2", parentCode: "E", title: { fa: "مهندسی تفصیلی", en: "Detailed engineering" }, typicalPct: 55, phase: "E" },
  { code: "E.3", parentCode: "E", title: { fa: "مدارک حین ساخت و نهایی", en: "As-built & final documentation" }, typicalPct: 15, phase: "E" },

  { code: "P", parentCode: null, title: { fa: "تدارکات", en: "Procurement" }, typicalPct: 45, phase: "P" },
  { code: "P.1", parentCode: "P", title: { fa: "اقلام بلندسفارش", en: "Long-lead items" }, typicalPct: 40, phase: "P" },
  { code: "P.2", parentCode: "P", title: { fa: "تجهیزات ثابت و دوار", en: "Static & rotating equipment" }, typicalPct: 30, phase: "P" },
  { code: "P.3", parentCode: "P", title: { fa: "اقلام انبوه", en: "Bulk materials" }, typicalPct: 20, phase: "P" },
  { code: "P.4", parentCode: "P", title: { fa: "حمل و ترخیص", en: "Logistics & customs" }, typicalPct: 10, phase: "P" },

  { code: "C", parentCode: null, title: { fa: "اجرا", en: "Construction" }, typicalPct: 36, phase: "C" },
  { code: "C.1", parentCode: "C", title: { fa: "ابنیه و محوطه", en: "Civil & infrastructure" }, typicalPct: 22, phase: "C" },
  { code: "C.2", parentCode: "C", title: { fa: "مکانیک و نصب تجهیزات", en: "Mechanical & equipment erection" }, typicalPct: 30, phase: "C" },
  { code: "C.3", parentCode: "C", title: { fa: "خطوط لوله و پایپینگ", en: "Piping & pipelines" }, typicalPct: 24, phase: "C" },
  { code: "C.4", parentCode: "C", title: { fa: "برق و ابزار دقیق", en: "Electrical & instrumentation" }, typicalPct: 16, phase: "C" },
  { code: "C.5", parentCode: "C", title: { fa: "رنگ، عایق و حفاظت", en: "Painting, insulation & protection" }, typicalPct: 8, phase: "C" },

  { code: "CM", parentCode: null, title: { fa: "پیش‌راه‌اندازی و راه‌اندازی", en: "Pre-commissioning & commissioning" }, typicalPct: 8, phase: "CM" },
  { code: "CM.1", parentCode: "CM", title: { fa: "پیش‌راه‌اندازی", en: "Pre-commissioning" }, typicalPct: 45, phase: "CM" },
  { code: "CM.2", parentCode: "CM", title: { fa: "راه‌اندازی و تحویل موقت", en: "Commissioning & provisional acceptance" }, typicalPct: 40, phase: "CM" },
  { code: "CM.3", parentCode: "CM", title: { fa: "آموزش و تحویل نهایی", en: "Training & final handover" }, typicalPct: 15, phase: "CM" },
];

/**
 * قالب عملیات حفاری و تعمیر چاه.
 *
 * از سند واقعی کاربر (Scope of Work) استخراج شد: در این نوع کار، واحد
 * شکست «گام رویه‌ای» است نه «قلم متره»، و برنامهٔ اضطراری بخش جدایی
 * از دامنهٔ کار است نه یک ریسک حاشیه‌ای.
 */
const OG_DRILLING_NODES: OgTemplateNode[] = [
  { code: "D", parentCode: null, title: { fa: "آماده‌سازی و بسیج", en: "Mobilisation & preparation" }, typicalPct: 10, phase: "C" },
  { code: "D.1", parentCode: "D", title: { fa: "بسیج دکل و تجهیزات", en: "Rig & equipment mobilisation" }, typicalPct: 60, phase: "C" },
  { code: "D.2", parentCode: "D", title: { fa: "آماده‌سازی محل و ایمنی", en: "Site preparation & HSE setup" }, typicalPct: 40, phase: "C" },

  { code: "W", parentCode: null, title: { fa: "عملیات درون‌چاهی", en: "Well operations" }, typicalPct: 60, phase: "C" },
  { code: "W.1", parentCode: "W", title: { fa: "کشیدن تکمیل و لوله مغزی", en: "Completion & tubing retrieval" }, typicalPct: 25, phase: "C" },
  { code: "W.2", parentCode: "W", title: { fa: "برش و ماهیگیری", en: "Cutting & fishing" }, typicalPct: 25, phase: "C" },
  { code: "W.3", parentCode: "W", title: { fa: "سیمان‌کاری و آزمون", en: "Cementing & testing" }, typicalPct: 25, phase: "C" },
  { code: "W.4", parentCode: "W", title: { fa: "تکمیل مجدد", en: "Re-completion" }, typicalPct: 25, phase: "C" },

  { code: "CP", parentCode: null, title: { fa: "برنامه‌های اضطراری", en: "Contingency plans" }, typicalPct: 20, phase: "C" },

  { code: "X", parentCode: null, title: { fa: "جمع‌آوری و ترخیص", en: "Demobilisation" }, typicalPct: 10, phase: "CM" },
];

export const OG_TEMPLATES: OgTemplate[] = [
  {
    id: "og-epc",
    title: { fa: "EPC عمومی نفت، گاز و پتروشیمی", en: "General oil, gas & petrochemical EPC" },
    note: { fa: "چهار فاز استاندارد با شکست سطح دو. سطح سه از متن قرارداد پر می‌شود.", en: "Four standard phases with level-2 breakdown." },
    nodes: OG_EPC_NODES,
  },
  {
    id: "og-drilling",
    title: { fa: "حفاری و تعمیر چاه", en: "Drilling & well intervention" },
    note: { fa: "واحد شکست «گام رویه‌ای» است؛ برنامهٔ اضطراری شاخهٔ مستقل دارد.", en: "Procedural steps; contingency plans as a separate branch." },
    nodes: OG_DRILLING_NODES,
  },
];

export const TEMPLATE_BY_ID = new Map(OG_TEMPLATES.map((t) => [t.id, t]));

/* ══════════════════════════ واژگان تخصصی ══════════════════════════ */

/**
 * اصطلاحاتی که مترجم عمومی خراب می‌کند.
 *
 * فهرست عمداً کوتاه و پرکاربرد است. واژه‌نامهٔ بلند که نگهداری نشود،
 * بدتر از نداشتن است چون توهم پوشش می‌دهد.
 */
export const OG_GLOSSARY: { en: string; fa: string }[] = [
  { en: "tie-in", fa: "اتصال به خط موجود (Tie-in)" },
  { en: "hook-up", fa: "اتصال نهایی (Hook-up)" },
  { en: "long lead", fa: "بلندسفارش" },
  { en: "punch list", fa: "فهرست نواقص (Punch list)" },
  { en: "mechanical completion", fa: "تکمیل مکانیکی" },
  { en: "pre-commissioning", fa: "پیش‌راه‌اندازی" },
  { en: "commissioning", fa: "راه‌اندازی" },
  { en: "provisional acceptance", fa: "تحویل موقت" },
  { en: "final acceptance", fa: "تحویل قطعی" },
  { en: "as-built", fa: "چون‌ساخت (As-built)" },
  { en: "shutdown", fa: "توقف تولید (Shutdown)" },
  { en: "turnaround", fa: "تعمیرات اساسی (Turnaround)" },
  { en: "workover", fa: "تعمیر چاه (Workover)" },
  { en: "wellhead", fa: "سرچاهی" },
  { en: "christmas tree", fa: "درخت کریسمس (شیرآلات سرچاهی)" },
  { en: "casing", fa: "جداره (Casing)" },
  { en: "tubing", fa: "لوله مغزی (Tubing)" },
  { en: "liner", fa: "رشتهٔ آویز (Liner)" },
  { en: "packer", fa: "پکر" },
  { en: "fishing", fa: "ماهیگیری (بازیابی ابزار)" },
  { en: "coiled tubing", fa: "لوله مغزی پیوسته (CT)" },
  { en: "drilling fluid", fa: "سیال حفاری" },
  { en: "blowout preventer", fa: "فوران‌گیر (BOP)" },
  { en: "flare", fa: "فلر" },
  { en: "skid", fa: "اسکید" },
  { en: "spool", fa: "اسپول" },
  { en: "hydrotest", fa: "آزمون هیدرواستاتیک" },
  { en: "loop test", fa: "آزمون حلقه (Loop test)" },
  { en: "bill of quantities", fa: "فهرست مقادیر" },
  { en: "scope of work", fa: "دامنهٔ کار" },
  { en: "lump sum", fa: "مقطوع (لامپ‌سام)" },
  { en: "milestone", fa: "نقطهٔ عطف" },
  { en: "liquidated damages", fa: "خسارت تأخیر" },
  { en: "change order", fa: "دستور تغییر" },
  { en: "variation order", fa: "دستور کار اضافی" },
];

/**
 * دستور سامانه‌ای مترجم.
 *
 * سه قید سخت دارد که هر کدام یک شکست واقعی را می‌بندد:
 *  ـ عدد و کد دست‌نخورده بماند (یک رقم جابه‌جا یعنی مبلغ غلط)
 *  ـ چیزی اضافه یا خلاصه نشود (خلاصه‌سازی بند قرارداد یعنی حذف تعهد)
 *  ـ اصطلاح مبهم با معادل انگلیسی در پرانتز بیاید
 */
export function translationInstructions(targetLang: "fa" | "en"): string {
  const glossary = OG_GLOSSARY.map((g) => `${g.en} = ${g.fa}`).join("; ");
  const dir = targetLang === "fa" ? "به فارسی" : "to English";
  return [
    `You are a specialist translator for oil, gas and petrochemical construction contracts. Translate ${dir}.`,
    "Hard rules:",
    "1. Never change numbers, dates, codes, clause numbers, units or currency symbols. Copy them exactly.",
    "2. Never summarise, merge or omit a sentence. A contract clause loses legal meaning when shortened.",
    "3. Keep the original clause numbering and line structure.",
    "4. For an industry term, use the glossary. Where a term has no settled equivalent, give the translation followed by the English in parentheses.",
    "5. If a passage is unreadable, output the original text unchanged rather than guessing.",
    `Glossary: ${glossary}`,
  ].join("\n");
}

/**
 * دستور استخراج ساختار شکست.
 *
 * مدل حق ساختن عدد ندارد. این قید در D8 هم بود و اینجا بحرانی‌تر است
 * چون خروجی مستقیم وارد محاسبهٔ هزینه می‌شود.
 */
export function wbsInstructions(templateId: string | null): string {
  const tpl = templateId ? TEMPLATE_BY_ID.get(templateId) : null;
  const skeleton = tpl
    ? `Prefer this industry skeleton where the contract supports it: ${tpl.nodes.map((n) => `${n.code}=${n.title.en}`).join(", ")}.`
    : "Derive the structure from the contract itself.";
  return [
    "You extract a work breakdown structure from a construction contract in the oil and gas sector.",
    skeleton,
    "Hard rules:",
    "1. Every node must trace to a clause. Put the clause number in sourceRef.",
    "2. Never invent a quantity, rate or amount. If the contract does not state it, use null.",
    "3. Suggest a weight only when the contract or the scope implies relative effort; otherwise null.",
    "4. Do not exceed four levels.",
    "5. Output strict JSON: an array of objects with keys code, parentCode, titleFa, titleEn, weightPct, sourceRef.",
  ].join("\n");
}

/* ══════════════════════════ اعمال واژگان ══════════════════════════ */

/**
 * علامت‌گذاری اصطلاحات شناخته‌شده پیش از ترجمه.
 *
 * خروجی فقط برای نمایش به کاربر است — نشان می‌دهد چند اصطلاح تخصصی
 * در متن هست تا بداند ترجمهٔ عمومی چقدر خطرناک بود.
 */
export function detectGlossaryTerms(text: string): { term: string; fa: string; count: number }[] {
  const lower = String(text ?? "").toLowerCase();
  const out: { term: string; fa: string; count: number }[] = [];
  for (const g of OG_GLOSSARY) {
    const needle = g.en.toLowerCase();
    let count = 0;
    let at = lower.indexOf(needle);
    while (at !== -1) {
      count += 1;
      at = lower.indexOf(needle, at + needle.length);
    }
    if (count > 0) out.push({ term: g.en, fa: g.fa, count });
  }
  return out.sort((a, b) => b.count - a.count);
}

/**
 * تشخیص زبان غالب متن.
 *
 * روش ساده و قطعی: نسبت نویسه‌های فارسی به لاتین. مدل زبانی برای این
 * کار لازم نیست و استفاده از آن یعنی پرداخت هزینه برای چیزی که با
 * شمارش حل می‌شود.
 */
export function detectLanguage(text: string): { lang: "fa" | "en" | "mixed" | "unknown"; faRatio: number } {
  const s = String(text ?? "");
  const fa = (s.match(/[\u0600-\u06FF]/g) ?? []).length;
  const en = (s.match(/[A-Za-z]/g) ?? []).length;
  const total = fa + en;
  if (total < 10) return { lang: "unknown", faRatio: 0 };
  const ratio = Math.round((fa / total) * 100) / 100;
  if (ratio >= 0.8) return { lang: "fa", faRatio: ratio };
  if (ratio <= 0.2) return { lang: "en", faRatio: ratio };
  return { lang: "mixed", faRatio: ratio };
}

/* ══════════════════════════ قالب سازمانی ══════════════════════════ */

export type TemplateKind = "internal" | "client";

export type TemplateProfile = {
  kind: TemplateKind;
  title: Bi;
  note: Bi;
  /** آیا ستون‌ها قابل تغییرند. قالب ابلاغی قفل است. */
  editableColumns: boolean;
};

/**
 * دو قالب خروجی.
 *
 * تفاوت کلیدی: قالب ابلاغی کارفرما **قفل** است. اگر ستونی کم یا زیاد
 * شود، کارفرما فایل را رد می‌کند و یک چرخهٔ بازبینی هدر می‌رود. قالب
 * داخلی آزاد است چون مخاطبش خود سازمان است.
 */
export const TEMPLATE_PROFILES: TemplateProfile[] = [
  {
    kind: "internal",
    title: { fa: "قالب داخلی سازمان", en: "Internal template" },
    note: { fa: "ستون‌ها قابل افزودن است؛ مخاطب، تیم داخلی پروژه.", en: "Columns can be extended; audience is the internal team." },
    editableColumns: true,
  },
  {
    kind: "client",
    title: { fa: "قالب ابلاغی کارفرما", en: "Client-issued template" },
    note: { fa: "ستون‌ها قفل است؛ تغییر ستون یعنی رد شدن فایل توسط کارفرما.", en: "Columns are locked; any change gets the file rejected." },
    editableColumns: false,
  },
];

export function profileOf(kind: TemplateKind): TemplateProfile {
  return TEMPLATE_PROFILES.find((p) => p.kind === kind) ?? TEMPLATE_PROFILES[0];
}

/* ══════════════════════════ تبدیل قالب به گره ══════════════════════════ */

export type SeedNode = {
  code: string;
  parentCode: string | null;
  titleFa: string;
  titleEn: string;
  weightPct: number | null;
  basis: "typical";
  sourceRefFa: null;
};

/** تبدیل قالب صنعتی به گره‌های قابل ویرایش. */
export function seedFromTemplate(templateId: string): SeedNode[] {
  const tpl = TEMPLATE_BY_ID.get(templateId);
  if (!tpl) return [];
  return tpl.nodes.map((n) => ({
    code: n.code,
    parentCode: n.parentCode,
    titleFa: n.title.fa,
    titleEn: n.title.en,
    weightPct: n.typicalPct,
    basis: "typical" as const,
    sourceRefFa: null,
  }));
}

/** بررسی اینکه جمع درصد هر شاخهٔ قالب ۱۰۰ باشد. */
export function validateTemplate(templateId: string): { ok: boolean; issues: string[] } {
  const tpl = TEMPLATE_BY_ID.get(templateId);
  if (!tpl) return { ok: false, issues: [`قالب «${templateId}» وجود ندارد.`] };

  const issues: string[] = [];
  const parents = [...new Set(tpl.nodes.map((n) => n.parentCode))];
  for (const p of parents) {
    const kids = tpl.nodes.filter((n) => n.parentCode === p && n.typicalPct !== null);
    if (kids.length === 0) continue;
    const sum = Math.round(kids.reduce((s, k) => s + (k.typicalPct ?? 0), 0) * 100) / 100;
    if (Math.abs(sum - 100) > 0.01) {
      issues.push(`جمع درصد زیرشاخه‌های «${p ?? "ریشه"}» برابر ${sum} است نه ۱۰۰.`);
    }
  }
  return { ok: issues.length === 0, issues };
}

/* ══════════════════════════ ترجمهٔ آفلاین ══════════════════════════ */

export type OfflineTranslation = {
  text: string;
  /** چند اصطلاح تخصصی واقعاً جایگزین شد. */
  replaced: number;
  /** نسبت پوشش: چه کسری از واژه‌های متن ترجمه شدند. */
  coveragePct: number;
};

/**
 * ترجمهٔ واژه‌نامه‌ای بدون شبکه.
 *
 * چرا لازم است: بدون اینترنت هیچ سرویسی پاسخ نمی‌دهد، پس `translated`
 * همیشه خالی می‌ماند و نماهای «ترجمه» و «دوستونی» برای همیشه خاموش
 * می‌مانند. کاربر دکمه‌ای می‌بیند که هرگز روشن نمی‌شود.
 *
 * این تابع جایگزین مترجم واقعی **نیست** و ادعای ترجمهٔ روان ندارد:
 * فقط اصطلاحات تخصصی شناخته‌شده را برمی‌گرداند تا مهندس بتواند بند
 * انگلیسی را کنار معادل‌های فارسی‌اش بخواند. نرخ پوشش برگردانده
 * می‌شود تا رابط کاربری بتواند صریح بگوید این ترجمهٔ کامل نیست.
 *
 * ترتیب جایگزینی از بلند به کوتاه است، وگرنه «tie» داخل «tie-in»
 * جایگزین می‌شود و اصطلاح بلندتر هرگز تطبیق نمی‌یابد.
 */
export function offlineGlossaryTranslate(input: string): OfflineTranslation {
  const source = String(input ?? "");
  if (!source.trim()) return { text: "", replaced: 0, coveragePct: 0 };

  const terms = [...OG_GLOSSARY].sort((a, b) => b.en.length - a.en.length);
  let out = source;
  let replaced = 0;

  for (const g of terms) {
    /* مرز واژه لازم است تا «cut» داخل «circuit» تطبیق نیابد. */
    const escaped = g.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?![\\p{L}\\p{N}])`, "giu");
    out = out.replace(re, (_m, pre) => {
      replaced += 1;
      return `${pre}${g.fa}`;
    });
  }

  const words = source.split(/\s+/).filter(Boolean).length || 1;
  return {
    text: out,
    replaced,
    coveragePct: Math.round(Math.min(100, (replaced / words) * 100) * 10) / 10,
  };
}
