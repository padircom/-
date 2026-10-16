/**
 * PMO-CONTRACT-RISK-ENGINE-V1.0 — سرویس تحلیل بندهای قرارداد.
 *
 * ContractClauseAnalysisService: قاعده‌محور و صادقانه؛ روی متن قابل
 * استخراجِ قرارداد (خروجی clauseParser موجود) کار می‌کند. سند اسکن‌شده
 * یا متن ناکافی → وضعیت not_extractable و هیچ یافتهٔ قطعی تولید نمی‌شود.
 * هر یافته ارجاع دقیق به بند و صفحه دارد، سطح اطمینان دارد و تا تأیید
 * کارشناس «پیشنهاد» است — هرگز جایگزین بررسی حقوقی نمی‌شود و هیچ بند یا
 * استناد قانونی جعل نمی‌کند.
 */

import { parseClauses } from "./clauseParser";

export const CLAUSE_ANALYSIS_VERSION = "contract-clause-analysis-v1";

export type ClauseFindingKind =
  | "payment" | "deadline" | "extension" | "suspension" | "termination"
  | "guarantee" | "insurance" | "liability" | "variation"
  | "obligation_employer" | "obligation_contractor" | "ambiguity" | "missing_criteria";

export type ClauseFinding = {
  clauseNo: string;
  clauseText: string;
  kind: ClauseFindingKind;
  findingFa: string;
  reasonFa: string;
  confidence: number; /* 0..1 */
  sourceRef: string;
  suggestedCategory: string | null;
};

const RULES: { kind: ClauseFindingKind; labelFa: string; patterns: RegExp[]; category: string | null; baseConfidence: number }[] = [
  { kind: "payment", labelFa: "شرط پرداخت", patterns: [/صورت.?وضعیت/, /پرداخت/, /علی.?الحساب/, /پیش.?پرداخت/, /کسور/, /سپرده حسن انجام/], category: "payment_cashflow", baseConfidence: 0.75 },
  { kind: "extension", labelFa: "شرط تمدید مدت", patterns: [/تمدید مدت/, /تمدید پیمان/, /مدت پیمان.*تمدید/, /ماده\s*۵۰/], category: "delay_eot", baseConfidence: 0.8 },
  { kind: "suspension", labelFa: "شرط تعلیق", patterns: [/تعلیق/, /توقف کار/], category: "suspension_termination", baseConfidence: 0.8 },
  { kind: "termination", labelFa: "شرط خاتمه/فسخ", patterns: [/خاتمه پیمان/, /فسخ/, /ماده\s*۴[۶۷]/], category: "suspension_termination", baseConfidence: 0.8 },
  { kind: "guarantee", labelFa: "ضمانت‌نامه و تضمین", patterns: [/ضمانت.?نامه/, /ضمانت انجام تعهدات/, /وثیقه/, /تضمین شرکت در مناقصه/], category: "guarantee_bond", baseConfidence: 0.8 },
  { kind: "insurance", labelFa: "تعهد بیمه‌ای", patterns: [/بیمه/, /بیمه.?نامه/, /تمام.?خطر/], category: "insurance_liability", baseConfidence: 0.75 },
  { kind: "liability", labelFa: "مسئولیت و جبران خسارت", patterns: [/جبران خسارت/, /خسارت/, /مسئولیت/, /وجه التزام/, /جریمه تأخیر/], category: "insurance_liability", baseConfidence: 0.7 },
  { kind: "variation", labelFa: "تغییر مقادیر و کار جدید", patterns: [/تغییر مقادیر/, /کار جدید/, /دستور تغییر/, /افزایش.*کاهش مقادیر/, /۲۵\s*درصد/], category: "variation_scope", baseConfidence: 0.75 },
  { kind: "deadline", labelFa: "مهلت قراردادی", patterns: [/مهلت/, /ظرف مدت/, /حداکثر.*روز/, /روز پس از/], category: null, baseConfidence: 0.7 },
];

const EMPLOYER_OBLIGATION = /(کارفرما|دستگاه اجرایی|مشاور).{0,40}(موظف|مکلف|متعهد|باید)/;
const CONTRACTOR_OBLIGATION = /(پیمانکار).{0,40}(موظف|مکلف|متعهد|باید)/;
const HAS_DEADLINE = /(\d|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده)\s*(روز|ماه|هفته)|\d{4}\/\d{2}\/\d{2}|مهلت\s*\d/;
const VAGUE_TERMS = [/در اسرع وقت/, /در صورت لزوم/, /به تشخیص/, /حسب مورد/, /به\s*موقع/, /بدون تأخیر/];

export type ClauseAnalysisResult = {
  version: string;
  extractable: boolean;
  status: "analyzed" | "not_extractable";
  clauseCount: number;
  findings: ClauseFinding[];
  warningsFa: string[];
  provider: "rule";
  llmConnected: false;
};

/** تحلیل متن قرارداد؛ متن ناکافی = عدم استخراج، بدون یافتهٔ ساختگی. */
export function analyzeContractText(rawText: string, sourceLabel = "متن قرارداد"): ClauseAnalysisResult {
  const text = (rawText ?? "").trim();
  const warningsFa: string[] = [];
  if (text.length < 200) {
    return { version: CLAUSE_ANALYSIS_VERSION, extractable: false, status: "not_extractable", clauseCount: 0, findings: [], warningsFa: ["متن قابل استخراج کافی نیست (احتمالاً سند اسکن‌شده یا ناقص است)؛ تحلیل قطعی بر مبنای متن ناقص انجام نمی‌شود. ابتدا متن سند را از EDMS بازیابی یا OCR کنید."], provider: "rule", llmConnected: false };
  }
  const parsed = parseClauses(text);
  warningsFa.push(...parsed.warningsFa);
  const findings: ClauseFinding[] = [];
  for (const clause of parsed.clauses) {
    const body = `${clause.titleFa ?? ""} ${clause.bodyText}`;
    const excerpt = clause.bodyText.slice(0, 900);
    const sourceRef = `${sourceLabel} — بند ${clause.clauseNo}، صفحه ${clause.pageNo}`;
    for (const rule of RULES) {
      const hit = rule.patterns.find((p) => p.test(body));
      if (!hit) continue;
      const hasDeadline = HAS_DEADLINE.test(body);
      findings.push({
        clauseNo: clause.clauseNo, clauseText: excerpt, kind: rule.kind,
        findingFa: `${rule.labelFa} در بند ${clause.clauseNo} شناسایی شد.`,
        reasonFa: `الگوی «${hit.source}» در متن بند دیده شد.${rule.category ? " این بند می‌تواند منشأ ریسک قراردادی باشد و بررسی کارشناس برای ثبت ریسک لازم است." : ""}`,
        confidence: hasDeadline && rule.kind !== "deadline" ? Math.min(0.95, rule.baseConfidence + 0.1) : rule.baseConfidence,
        sourceRef, suggestedCategory: rule.category,
      });
    }
    if (EMPLOYER_OBLIGATION.test(body)) findings.push({ clauseNo: clause.clauseNo, clauseText: excerpt, kind: "obligation_employer", findingFa: `تعهد کارفرما/مشاور در بند ${clause.clauseNo} شناسایی شد.`, reasonFa: "فعل تعهدی نسبت به کارفرما/مشاور دیده شد؛ برای دفتر تعهدات و مهلت‌ها پیشنهاد می‌شود.", confidence: 0.7, sourceRef, suggestedCategory: null });
    if (CONTRACTOR_OBLIGATION.test(body)) findings.push({ clauseNo: clause.clauseNo, clauseText: excerpt, kind: "obligation_contractor", findingFa: `تعهد پیمانکار در بند ${clause.clauseNo} شناسایی شد.`, reasonFa: "فعل تعهدی نسبت به پیمانکار دیده شد؛ برای دفتر تعهدات و مهلت‌ها پیشنهاد می‌شود.", confidence: 0.7, sourceRef, suggestedCategory: null });
    const vague = VAGUE_TERMS.find((p) => p.test(body));
    if (vague && /موظف|باید|تعهد|مهلت|تحویل|پرداخت/.test(body)) {
      findings.push({ clauseNo: clause.clauseNo, clauseText: excerpt, kind: "ambiguity", findingFa: `ابهام احتمالی در بند ${clause.clauseNo}: عبارت غیرقطعی بدون معیار سنجش.`, reasonFa: `عبارت «${vague.source}» بدون عدد یا تاریخ مشخص به‌کار رفته است؛ منشأ اختلاف تفسیری است.`, confidence: 0.65, sourceRef, suggestedCategory: "scope_ambiguity" });
    } else if ((EMPLOYER_OBLIGATION.test(body) || CONTRACTOR_OBLIGATION.test(body)) && !HAS_DEADLINE.test(body)) {
      findings.push({ clauseNo: clause.clauseNo, clauseText: excerpt, kind: "missing_criteria", findingFa: `بند ${clause.clauseNo} تعهد دارد ولی مهلت یا معیار روشن ندارد.`, reasonFa: "تعهد بدون مهلت عددی/تاریخ مشخص، قابل پایش و استناد نیست؛ پیشنهاد اصلاح بند مطرح شود.", confidence: 0.6, sourceRef, suggestedCategory: "noncompliance" });
    }
  }
  if (!parsed.clauses.length) warningsFa.push("هیچ بند شماره‌داری در متن تشخیص داده نشد؛ یافته‌ها قابل ردیابی به بند نیستند.");
  return { version: CLAUSE_ANALYSIS_VERSION, extractable: true, status: "analyzed", clauseCount: parsed.clauses.length, findings, warningsFa, provider: "rule", llmConnected: false };
}

export type ClauseVersionDiff = {
  added: { clauseNo: string; excerpt: string }[];
  removed: { clauseNo: string; excerpt: string }[];
  changed: { clauseNo: string; beforeExcerpt: string; afterExcerpt: string }[];
  unchangedCount: number;
};

/** مقایسهٔ دو نسخهٔ متن قرارداد در سطح بند. */
export function compareContractVersions(textBefore: string, textAfter: string): ClauseVersionDiff {
  const a = new Map(parseClauses(textBefore ?? "").clauses.map((c) => [c.clauseNo, c]));
  const b = new Map(parseClauses(textAfter ?? "").clauses.map((c) => [c.clauseNo, c]));
  const diff: ClauseVersionDiff = { added: [], removed: [], changed: [], unchangedCount: 0 };
  for (const [no, clause] of b) {
    const prev = a.get(no);
    if (!prev) diff.added.push({ clauseNo: no, excerpt: clause.bodyText.slice(0, 300) });
    else if (prev.bodyText.trim() !== clause.bodyText.trim()) diff.changed.push({ clauseNo: no, beforeExcerpt: prev.bodyText.slice(0, 300), afterExcerpt: clause.bodyText.slice(0, 300) });
    else diff.unchangedCount++;
  }
  for (const [no, clause] of a) if (!b.has(no)) diff.removed.push({ clauseNo: no, excerpt: clause.bodyText.slice(0, 300) });
  return diff;
}
