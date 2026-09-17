/**
 * QMS — موتور مدیریت کیفیت و بازرسی (d8).
 * قواعد: Hold Point مسدودکننده است · هر NCR مالک و اقدام اصلاحی دارد · گواهی مواد پیش از نصب ·
 * تحویل مکانیکی بدون پانچ کلاس A و NCR بحرانی باز · QMS اعداد پیشرفت/هزینه را نمی‌نویسد، فقط ارجاع می‌دهد.
 */

export const QMS_FORMULA_VERSION = "qms-v1";

/* ══════════════════════════ ۱) برنامه کیفیت و ITP ══════════════════════════ */

/** نوع نقطه کنترل در ITP: H توقف · W شاهد · R بازبینی مدرک · M پایش */
export type ItpPointType = "H" | "W" | "R" | "M";

export type ItpPoint = {
  id: string;
  activityId: string;
  type: ItpPointType;
  party: "contractor" | "consultant" | "client" | "tpi";
  signedAt?: string;
  waivedBy?: string;
};

/** فقط نقطه توقف امضانشده مانع ادامه کار است؛ شاهد با اطلاع‌رسانی قابل عبور است. */
export function itpBlocking(points: ItpPoint[]): ItpPoint[] {
  return points.filter((p) => p.type === "H" && !p.signedAt && !p.waivedBy);
}

export function canProceed(points: ItpPoint[]): { ok: boolean; blockedBy: string[] } {
  const blocked = itpBlocking(points).map((p) => p.id);
  return { ok: blocked.length === 0, blockedBy: blocked };
}

/** پوشش ITP: نسبت فعالیت‌های دارای حداقل یک نقطه کنترل. */
export function itpCoverage(activityIds: string[], points: ItpPoint[]): number {
  if (!activityIds.length) return 0;
  const covered = new Set(points.map((p) => p.activityId));
  return (activityIds.filter((a) => covered.has(a)).length / activityIds.length) * 100;
}

/* ══════════════════════════ ۲) درخواست بازرسی (IR) ══════════════════════════ */

export type IrNotice = { requestedAt: string; inspectionAt: string; noticeHours: number };

/** اعلام دیرهنگام = فاصله کمتر از حداقل اعلان قراردادی (پیش‌فرض ۴۸ ساعت). */
export function irNoticeCheck(ir: IrNotice, minHours = 48): { ok: boolean; leadHours: number } {
  const lead = (Date.parse(ir.inspectionAt) - Date.parse(ir.requestedAt)) / 3_600_000;
  return { ok: lead >= (ir.noticeHours || minHours), leadHours: Math.round(lead) };
}

export type IrResult = "accepted" | "conditional" | "rejected";

/** نتیجه بازرسی از روی تعداد و شدت ایرادها. */
export function irOutcome(defects: { severity: "critical" | "major" | "minor" }[]): IrResult {
  if (defects.some((d) => d.severity === "critical")) return "rejected";
  if (defects.filter((d) => d.severity === "major").length > 2) return "rejected";
  if (defects.length > 0) return "conditional";
  return "accepted";
}

/** نرخ قبولی بار اول (First Pass Yield). */
export function firstPassYield(accepted: number, total: number): number {
  return total > 0 ? (accepted / total) * 100 : 0;
}

/* ══════════════════════════ ۳) عدم انطباق و اقدام اصلاحی ══════════════════════════ */

export type NcrSeverity = "critical" | "major" | "minor";
export type NcrDisposition = "rework" | "repair" | "use_as_is" | "reject" | "scrap";

/** طبقه‌بندی عدم انطباق: ایمنی/سازه‌ای ⇐ بحرانی · هزینه بالا یا عملکردی ⇐ عمده. */
export function ncrSeverity(input: { safetyImpact: boolean; structuralImpact: boolean; reworkCost: number; functionalImpact: boolean }): NcrSeverity {
  if (input.safetyImpact || input.structuralImpact) return "critical";
  if (input.functionalImpact || input.reworkCost >= 500_000_000) return "major";
  return "minor";
}

/** مهلت بستن NCR بر حسب شدت (روز). */
export function ncrDueDays(sev: NcrSeverity): number {
  return sev === "critical" ? 7 : sev === "major" ? 14 : 30;
}

/** «استفاده به‌همان‌صورت» و «تعمیر» بدون مجوز ارفاق مهندسی ممنوع است. */
export function dispositionAllowed(d: NcrDisposition, concessionApprovedBy?: string): { ok: boolean; reason?: string } {
  if ((d === "use_as_is" || d === "repair") && !concessionApprovedBy) return { ok: false, reason: "concession_required" };
  return { ok: true };
}

export type NcrRow = { id: string; severity: NcrSeverity; openedAt: string; closedAt?: string; capaId?: string };

export function ncrAgeDays(n: NcrRow, now = new Date()): number {
  const end = n.closedAt ? Date.parse(n.closedAt) : now.getTime();
  return Math.max(0, Math.floor((end - Date.parse(n.openedAt)) / 86_400_000));
}

export function ncrOverdue(n: NcrRow, now = new Date()): boolean {
  return !n.closedAt && ncrAgeDays(n, now) > ncrDueDays(n.severity);
}

/** نرخ بسته‌شدن عدم انطباق‌ها. */
export function ncrClosureRate(rows: NcrRow[]): number {
  return rows.length ? (rows.filter((r) => r.closedAt).length / rows.length) * 100 : 0;
}

/** NCR بحرانی یا تکرارشونده الزاماً CAPA می‌خواهد. */
export function capaRequired(sev: NcrSeverity, recurrenceCount: number): boolean {
  return sev === "critical" || recurrenceCount >= 3;
}

/** تحلیل پارتو: علل پوشش‌دهنده ۸۰٪ ایرادها. */
export function pareto(causes: { cause: string; count: number }[]): { cause: string; count: number; cumPct: number; vital: boolean }[] {
  const total = causes.reduce((s, c) => s + c.count, 0) || 1;
  let cum = 0;
  return [...causes]
    .sort((a, b) => b.count - a.count)
    .map((c) => {
      cum += c.count;
      const cumPct = (cum / total) * 100;
      return { ...c, cumPct, vital: cumPct - (c.count / total) * 100 < 80 };
    });
}

/* ══════════════════════════ ۴) کنترل مواد و گواهی‌ها ══════════════════════════ */

export type MaterialCert = {
  heatNo: string;
  certType: "2.1" | "2.2" | "3.1" | "3.2";
  issuedAt: string;
  expiresAt?: string;
  declaredGrade: string;
  requiredGrade: string;
  labVerified: boolean;
};

export type CertVerdict = { ok: boolean; reasons: string[] };

/** پذیرش مواد: نوع گواهی، انطباق گرید، اعتبار و تأیید آزمایشگاه. */
export function verifyCertificate(c: MaterialCert, minType: "3.1" | "3.2" = "3.1", now = new Date()): CertVerdict {
  const rank = { "2.1": 1, "2.2": 2, "3.1": 3, "3.2": 4 } as const;
  const reasons: string[] = [];
  if (rank[c.certType] < rank[minType]) reasons.push("cert_type_below_requirement");
  if (c.declaredGrade !== c.requiredGrade) reasons.push("grade_mismatch");
  if (c.expiresAt && Date.parse(c.expiresAt) < now.getTime()) reasons.push("certificate_expired");
  if (!c.labVerified) reasons.push("lab_verification_missing");
  if (!c.heatNo) reasons.push("heat_number_missing");
  return { ok: reasons.length === 0, reasons };
}

/** زنجیره ردیابی: شماره ذوب ⇐ قطعه ⇐ جوش ⇐ آزمون ⇐ داکیومنت تحویل. */
export function traceChain(heatNo: string, links: { from: string; to: string }[]): string[] {
  const chain = [heatNo];
  let cur = heatNo;
  for (let i = 0; i < links.length; i++) {
    const nxt = links.find((l) => l.from === cur && !chain.includes(l.to));
    if (!nxt) break;
    chain.push(nxt.to);
    cur = nxt.to;
  }
  return chain;
}

/* ─────────── پذیرش آزمون‌های اجرایی ─────────── */

/** پذیرش بتن مطابق ACI 318: میانگین هر ۳ آزمون متوالی ≥ f′c و هیچ آزمونی کمتر از f′c−۳٫۵ مگاپاسکال. */
export function concreteAcceptance(tests: number[], fc: number): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (tests.some((x) => x < fc - 3.5)) reasons.push("single_test_below_limit");
  for (let i = 0; i + 2 < tests.length; i++) {
    const avg = (tests[i] + tests[i + 1] + tests[i + 2]) / 3;
    if (avg < fc) {
      reasons.push("moving_average_below_fc");
      break;
    }
  }
  return { ok: reasons.length === 0, reasons };
}

/** نرخ تعمیر جوش؛ بیش از ۳٪ ⇐ تعلیق صلاحیت جوشکار. */
export function weldRepairRate(repaired: number, total: number): { ratePct: number; welderSuspended: boolean } {
  const ratePct = total > 0 ? (repaired / total) * 100 : 0;
  return { ratePct, welderSuspended: ratePct > 3 };
}

/** نمونه‌برداری ساده‌شده ISO 2859-1 (سطح بازرسی II) برای AQL ۲٫۵. */
export function samplingPlan(lotSize: number): { sampleSize: number; accept: number; reject: number } {
  const table: [number, number, number][] = [
    [8, 2, 0],
    [15, 3, 0],
    [25, 5, 0],
    [50, 8, 1],
    [90, 13, 1],
    [150, 20, 2],
    [280, 32, 3],
    [500, 50, 5],
    [1200, 80, 7],
    [3200, 125, 10],
    [Infinity, 200, 14],
  ];
  const row = table.find(([max]) => lotSize <= max)!;
  const sampleSize = Math.min(row[1], Math.max(1, lotSize));
  return { sampleSize, accept: row[2], reject: row[2] + 1 };
}

/* ══════════════════════════ ۵) ممیزی کیفیت و ISO 9001 ══════════════════════════ */

export type AuditFinding = { clause: string; severity: "major" | "minor" | "observation"; closed?: boolean };

/** امتیاز انطباق: عمده ۱۰ نمره، جزئی ۳ نمره، مشاهده ۱ نمره کسر (کف صفر). */
export function complianceScore(findings: AuditFinding[]): number {
  const penalty = findings.reduce((s, f) => s + (f.closed ? 0 : f.severity === "major" ? 10 : f.severity === "minor" ? 3 : 1), 0);
  return Math.max(0, 100 - penalty);
}

export function certificationRisk(findings: AuditFinding[]): "none" | "watch" | "suspension" {
  const openMajor = findings.filter((f) => f.severity === "major" && !f.closed).length;
  if (openMajor >= 2) return "suspension";
  if (openMajor === 1) return "watch";
  return "none";
}

/* ─────────── هزینه کیفیت (CoQ) ─────────── */

export type CoqInput = { prevention: number; appraisal: number; internalFailure: number; externalFailure: number };

/** هزینه کیفیت: انطباق (پیشگیری+ارزیابی) در برابر عدم انطباق (شکست داخلی+خارجی). */
export function costOfQuality(c: CoqInput, projectCost: number): {
  conformance: number; nonConformance: number; total: number; copqPct: number; ratio: number;
} {
  const conformance = c.prevention + c.appraisal;
  const nonConformance = c.internalFailure + c.externalFailure;
  const total = conformance + nonConformance;
  return {
    conformance,
    nonConformance,
    total,
    copqPct: projectCost > 0 ? (nonConformance / projectCost) * 100 : 0,
    ratio: nonConformance > 0 ? conformance / nonConformance : Infinity,
  };
}

/** DPMO و سطح سیگما (تقریب صنعتی با شیفت ۱٫۵ سیگما). */
export function dpmo(defects: number, units: number, opportunitiesPerUnit: number): number {
  const opp = units * opportunitiesPerUnit;
  return opp > 0 ? (defects / opp) * 1_000_000 : 0;
}

export function sigmaLevel(dpmoValue: number): number {
  const yieldRatio = 1 - dpmoValue / 1_000_000;
  if (yieldRatio <= 0) return 0;
  if (yieldRatio >= 1) return 6;
  // تقریب معکوس نرمال (Beasley-Springer-Moro ساده‌شده) + شیفت ۱٫۵
  const t = Math.sqrt(-2 * Math.log(1 - yieldRatio));
  const z = t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
  return Math.round((z + 1.5) * 100) / 100;
}

/**
 * حدود کنترل نمودار مقادیر منفرد (I-MR).
 * برآورد پراکندگی از میانگین دامنه متحرک (σ̂ = MR̄ / 1.128) است، نه انحراف معیار کل؛
 * وگرنه یک نقطه پرت خودش حدود را باد می‌کند و دیگر «خارج از کنترل» دیده نمی‌شود.
 */
export function controlLimits(series: number[]): { mean: number; ucl: number; lcl: number; sigma: number } {
  const n = series.length || 1;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  let sigma = 0;
  if (series.length >= 2) {
    const mr = series.slice(1).map((v, i) => Math.abs(v - series[i]));
    sigma = mr.reduce((a, b) => a + b, 0) / mr.length / 1.128;
  }
  return { mean, ucl: mean + 3 * sigma, lcl: mean - 3 * sigma, sigma };
}

/**
 * قواعد نلسون: ۱) نقطه بیرون حدود کنترل · ۲) هفت نقطه متوالی یک‌طرفِ میانگین (شیفت) ·
 * ۳) شش نقطه متوالی صعودی یا نزولی (روند).
 */
export function outOfControl(series: number[]): { violating: number[]; trend: boolean; shift: boolean } {
  const { mean, ucl, lcl } = controlLimits(series);
  const violating = series.map((v, i) => (v > ucl || v < lcl ? i : -1)).filter((i) => i >= 0);

  let sameSide = 1;
  let shift = false;
  for (let i = 1; i < series.length; i++) {
    sameSide = series[i] > mean === series[i - 1] > mean ? sameSide + 1 : 1;
    if (sameSide >= 7) shift = true;
  }

  let up = 1;
  let down = 1;
  let trend = false;
  for (let i = 1; i < series.length; i++) {
    up = series[i] > series[i - 1] ? up + 1 : 1;
    down = series[i] < series[i - 1] ? down + 1 : 1;
    if (up >= 6 || down >= 6) trend = true;
  }

  return { violating, trend, shift };
}

/* ══════════════════════════ ۶) تحویل، پانچ و راه‌اندازی ══════════════════════════ */

export type PunchItem = { id: string; category: "A" | "B"; closed?: boolean; systemId: string };

/** پانچ کلاس A مانع تحویل مکانیکی است؛ کلاس B تا تحویل نهایی مهلت دارد. */
export function punchSummary(items: PunchItem[]): { openA: number; openB: number; closureRate: number } {
  const openA = items.filter((i) => i.category === "A" && !i.closed).length;
  const openB = items.filter((i) => i.category === "B" && !i.closed).length;
  const closed = items.filter((i) => i.closed).length;
  return { openA, openB, closureRate: items.length ? (closed / items.length) * 100 : 0 };
}

export type McGateInput = {
  punch: PunchItem[];
  ncrs: NcrRow[];
  itp: ItpPoint[];
  dossierCompletenessPct: number;
  preCommissioningDone: boolean;
};

/** دروازه تحویل مکانیکی (MC): پنج شرط هم‌زمان. */
export function mechanicalCompletionGate(input: McGateInput): { ok: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const p = punchSummary(input.punch);
  if (p.openA > 0) blockers.push("open_punch_class_a");
  if (input.ncrs.some((n) => n.severity === "critical" && !n.closedAt)) blockers.push("open_critical_ncr");
  if (itpBlocking(input.itp).length > 0) blockers.push("unsigned_hold_point");
  if (input.dossierCompletenessPct < 95) blockers.push("dossier_incomplete");
  if (!input.preCommissioningDone) blockers.push("pre_commissioning_pending");
  return { ok: blockers.length === 0, blockers };
}

/** کامل‌بودن داکیومنت تحویل (Quality Dossier) بر پایه اقلام الزامی. */
export function dossierCompleteness(required: string[], delivered: string[]): { pct: number; missing: string[] } {
  const missing = required.filter((r) => !delivered.includes(r));
  return { pct: required.length ? ((required.length - missing.length) / required.length) * 100 : 100, missing };
}

/* ══════════════════════════ امضای غیرقابل انکار رکورد بازرسی ══════════════════════════ */

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

export function signRecord(payload: unknown, signer: string, at: string): { signer: string; at: string; hash: string; version: string } {
  const s = stableStringify({ payload, signer, at });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return { signer, at, hash: h.toString(16).padStart(8, "0"), version: QMS_FORMULA_VERSION };
}

export function verifySignature(payload: unknown, sig: { signer: string; at: string; hash: string }): boolean {
  return signRecord(payload, sig.signer, sig.at).hash === sig.hash;
}

/* ══════════════════════════ هشدارهای زودهنگام کیفیت ══════════════════════════ */

export type QmsAlert = { code: string; severity: "warning" | "high" | "critical"; message: string };

export function qmsEws(ctx: {
  openCriticalNcr?: number;
  ncrOverdueCount?: number;
  fpyPct?: number;
  weldRepairPct?: number;
  copqPct?: number;
  openMajorAuditFindings?: number;
  certRejections?: number;
  openPunchA?: number;
  unsignedHoldPoints?: number;
  outOfControlTrend?: boolean;
}): QmsAlert[] {
  const a: QmsAlert[] = [];
  if ((ctx.openCriticalNcr ?? 0) > 0) a.push({ code: "EWS-QMS-01", severity: "critical", message: "عدم انطباق بحرانی باز" });
  if ((ctx.ncrOverdueCount ?? 0) > 0) a.push({ code: "EWS-QMS-02", severity: "high", message: "NCR فراتر از مهلت بستن" });
  if (ctx.fpyPct !== undefined && ctx.fpyPct < 85) a.push({ code: "EWS-QMS-03", severity: "high", message: "قبولی بار اول زیر ۸۵٪" });
  if ((ctx.weldRepairPct ?? 0) > 3) a.push({ code: "EWS-QMS-04", severity: "high", message: "نرخ تعمیر جوش بالای ۳٪" });
  if ((ctx.copqPct ?? 0) > 2) a.push({ code: "EWS-QMS-05", severity: "warning", message: "هزینه عدم کیفیت بالای ۲٪ هزینه پروژه" });
  if ((ctx.openMajorAuditFindings ?? 0) > 0) a.push({ code: "EWS-QMS-06", severity: "high", message: "یافته عمده ممیزی باز — ریسک گواهینامه" });
  if ((ctx.certRejections ?? 0) > 0) a.push({ code: "EWS-QMS-07", severity: "warning", message: "رد گواهی مواد ورودی" });
  if ((ctx.openPunchA ?? 0) > 0) a.push({ code: "EWS-QMS-08", severity: "high", message: "پانچ کلاس A باز — مانع تحویل مکانیکی" });
  if ((ctx.unsignedHoldPoints ?? 0) > 0) a.push({ code: "EWS-QMS-09", severity: "critical", message: "نقطه توقف امضانشده — کار متوقف" });
  if (ctx.outOfControlTrend) a.push({ code: "EWS-QMS-10", severity: "warning", message: "روند خارج از کنترل در نمودار پایش" });
  return a;
}
