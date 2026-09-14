/**
 * HRM — موتور مدیریت منابع انسانی، تایم‌شیت و بهره‌وری نیروی کار
 * منبع یگانه منطق (ADR-03). آینه سرور با `npm run build:hrm` ساخته می‌شود.
 *
 * مرجع طراحی: docs/HRM_D1_Architecture.md · D2_DataModel · D3_PlanningOBS
 * اصل حاکم: HRM مالک «ساعت» است نه «هزینه»؛ نرخ×ساعت فقط برای هزینه پروژه (ADR-14).
 */

export const HRM_FORMULA_VERSION = "hrm-v1";

/** کد دامنه در یک نقطه متمرکز (ADR-15) — تغییر آن تک‌خطی است. */
export const HRM_DOMAIN_ID = "d10";

/* ══════════════════════════ انواع پایه ══════════════════════════ */

export type TradeCategory =
  | "civil" | "welding" | "mechanical" | "piping" | "electrical"
  | "instrument" | "equipment_op" | "qc" | "hse" | "staff" | "general";

export type Grade = "helper" | "skilled" | "senior" | "foreman" | "supervisor";

export type Trade = {
  code: string;
  fa: string;
  en: string;
  category: TradeCategory;
  /** مستقیم = قابل شارژ به فعالیت اجرایی؛ غیرمستقیم = سربار پروژه */
  direct: boolean;
  /** نرخ استاندارد مرجع صنعت (واحد بر نفر-ساعت)؛ باید با داده تاریخی کالیبره شود */
  stdRate?: number;
  uom?: string;
};

export type TimesheetStatus =
  | "draft" | "submitted" | "foreman_approved" | "qc_verified"
  | "pm_approved" | "posted" | "locked" | "rejected";

export type AttendanceCode =
  | "present" | "absent" | "leave" | "sick"
  | "mission" | "standby" | "weather_delay" | "no_work_front";

export type ObsNode = {
  id: string;
  parentId?: string;
  code: string;
  fa: string;
  en: string;
  level: number;
  managerId?: string;
  /** پیوند به WBS در PEX — پایه ماتریس RAM */
  wbsLink: string[];
  headcount?: number;
};

export type PlanLine = {
  id: string;
  periodCode: string;
  periodStart: string;
  periodEnd: string;
  tradeCode: string;
  obsNodeId: string;
  plannedHeadcount: number;
  plannedMH: number;
  actualHeadcount?: number;
  actualMH?: number;
};

export type MobilizationRequest = {
  id: string;
  tradeCode: string;
  qty: number;
  needByDate: string;
  status: "draft" | "submitted" | "approved" | "in_progress" | "fulfilled" | "rejected" | "cancelled";
  fulfilledQty: number;
  justification: string;
  /** پنج گیت تجهیز — نتیجه آموزش ایمنی از ماژول HSE خوانده می‌شود، نوشته نمی‌شود */
  gates?: { contract: boolean; medical: boolean; hseTraining: boolean; tradeDocs: boolean; gatePass: boolean };
};

/* ══════════════════════════ قانون کار (ADR-07) ══════════════════════════ */

export type LaborLawConfig = {
  dailyNormalCap: number;
  weeklyNormalCap: number;
  dailyOtCap: number;
  dailyAbsoluteCap: number;
  otFactor: number;
  holidayFactor: number;
  nightFactor: number;
  weekendDays: number[];
};

/** پیش‌فرض قانون کار ایران — مواد ۵۱، ۵۸، ۵۹ و ۶۲. */
export const IRAN_LABOR_LAW: LaborLawConfig = {
  dailyNormalCap: 8,
  weeklyNormalCap: 44,
  dailyOtCap: 4,
  dailyAbsoluteCap: 16,
  otFactor: 1.4,
  holidayFactor: 1.4,
  nightFactor: 1.35,
  weekendDays: [5], // جمعه
};

export type HoursBreakdown = {
  raw: number;
  normal: number;
  ot: number;
  night: number;
  holiday: number;
  /** ساعتی که از سقف مطلق فراتر رفته و پذیرفته نشده است */
  rejected: number;
};

/**
 * تفکیک ساعت خام به عادی/اضافه‌کاری/شب/تعطیل.
 * خروجی موتور است و کاربر آن را دستی وارد نمی‌کند (قاعده ۲ سند D2).
 */
export function splitHours(
  hoursRaw: number,
  opts: {
    dateIso: string;
    shift?: "day" | "night" | "swing";
    holidays?: string[];
    law?: LaborLawConfig;
    priorHoursToday?: number;
  }
): HoursBreakdown {
  const law = opts.law ?? IRAN_LABOR_LAW;
  const prior = Math.max(0, opts.priorHoursToday ?? 0);
  const empty: HoursBreakdown = { raw: 0, normal: 0, ot: 0, night: 0, holiday: 0, rejected: 0 };
  if (!(hoursRaw > 0)) return empty;

  const room = Math.max(0, law.dailyAbsoluteCap - prior);
  const accepted = Math.min(hoursRaw, room);
  const rejected = round2(hoursRaw - accepted);

  const dow = new Date(opts.dateIso + "T00:00:00Z").getUTCDay();
  const isHoliday = law.weekendDays.includes(dow) || (opts.holidays ?? []).includes(opts.dateIso);
  const isNight = opts.shift === "night";

  // در روز تعطیل کل ساعت با ضریب تعطیل‌کاری محاسبه می‌شود.
  if (isHoliday) {
    return { raw: round2(hoursRaw), normal: 0, ot: 0, night: isNight ? round2(accepted) : 0, holiday: round2(accepted), rejected };
  }

  const normalRoom = Math.max(0, law.dailyNormalCap - prior);
  const normal = Math.min(accepted, normalRoom);
  const ot = round2(accepted - normal);

  return {
    raw: round2(hoursRaw),
    normal: round2(normal),
    ot,
    night: isNight ? round2(accepted) : 0,
    holiday: 0,
    rejected,
  };
}

/** ضریب مؤثر هزینه یک ردیف ساعت — مصرف در سند ارسال به FIN. */
export function costFactor(h: HoursBreakdown, law: LaborLawConfig = IRAN_LABOR_LAW): number {
  const base = h.normal + h.ot * law.otFactor + h.holiday * law.holidayFactor;
  const nightPremium = h.night > 0 ? h.night * (law.nightFactor - 1) : 0;
  return round2(base + nightPremium);
}

/* ══════════════════════════ اعتبارسنجی OBS ══════════════════════════ */

export type ValidationIssue = { code: string; severity: "error" | "warning"; message: string; nodeId?: string };

/** قواعد پنج‌گانه OBS در بخش ۲-۱ سند D3. */
export function validateObs(nodes: ObsNode[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (const n of nodes) {
    if (n.parentId) {
      const parent = byId.get(n.parentId);
      if (!parent) {
        issues.push({ code: "E-HRM-110", severity: "error", message: `والد ${n.parentId} یافت نشد`, nodeId: n.id });
      } else if (!n.code.startsWith(parent.code + ".")) {
        issues.push({ code: "E-HRM-110", severity: "error", message: `کد ${n.code} با کد والد ${parent.code} هم‌خوان نیست`, nodeId: n.id });
      }
    }
    if (n.level > 6) {
      issues.push({ code: "E-HRM-111", severity: "error", message: `عمق ${n.level} بیش از حد مجاز ۶ است`, nodeId: n.id });
    }
    if (n.level >= 3 && !n.managerId) {
      issues.push({ code: "W-HRM-310", severity: "warning", message: `گره ${n.code} مسئول ندارد`, nodeId: n.id });
    }
  }

  // تشخیص دور در درخت
  for (const n of nodes) {
    const seen = new Set<string>([n.id]);
    let cur = n.parentId ? byId.get(n.parentId) : undefined;
    while (cur) {
      if (seen.has(cur.id)) {
        issues.push({ code: "E-HRM-113", severity: "error", message: `دور در درخت سازمانی از ${n.code}`, nodeId: n.id });
        break;
      }
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }
  return issues;
}

/** جابه‌جایی زیردرخت: کدها آبشاری بازنویسی می‌شوند، شناسه‌ها ثابت می‌مانند. */
export function reparent(nodes: ObsNode[], nodeId: string, newParentId: string): ObsNode[] {
  const byId = new Map(nodes.map((n) => [n.id, { ...n }]));
  const node = byId.get(nodeId);
  const parent = byId.get(newParentId);
  if (!node || !parent) return nodes;

  const childrenOf = (id: string) => [...byId.values()].filter((x) => x.parentId === id);
  const rewrite = (n: ObsNode, prefix: string, level: number) => {
    const leaf = n.code.split(".").pop()!;
    n.code = `${prefix}.${leaf}`;
    n.level = level;
    for (const c of childrenOf(n.id)) rewrite(c, n.code, level + 1);
  };

  node.parentId = newParentId;
  rewrite(node, parent.code, parent.level + 1);
  return [...byId.values()];
}

/** سه شاخص سلامت سازمان (بخش ۲-۳ سند D3). */
export function obsHealth(nodes: ObsNode[], allWbs: string[]) {
  const covered = new Set(nodes.flatMap((n) => n.wbsLink));
  const wbsCoverage = allWbs.length ? (allWbs.filter((w) => covered.has(w)).length / allWbs.length) * 100 : 0;

  const ids = new Set(nodes.map((n) => n.id));
  const hasChild = new Set(nodes.map((n) => n.parentId).filter((p): p is string => !!p && ids.has(p)));
  const leafDepths = nodes.filter((n) => !hasChild.has(n.id)).map((n) => n.level);
  const mean = leafDepths.length ? leafDepths.reduce((a, b) => a + b, 0) / leafDepths.length : 0;
  const depthStdDev = leafDepths.length
    ? Math.sqrt(leafDepths.reduce((a, b) => a + (b - mean) ** 2, 0) / leafDepths.length)
    : 0;

  const l4 = nodes.filter((n) => n.level === 4);
  const spanOfControl = l4.length
    ? l4.reduce((a, n) => a + (n.headcount ?? 0), 0) / l4.length
    : 0;

  return {
    wbsCoverage: round2(wbsCoverage),
    depthStdDev: round2(depthStdDev),
    spanOfControl: round2(spanOfControl),
    status: wbsCoverage < 95 || depthStdDev > 1.5 || spanOfControl > 35 ? ("amber" as const) : ("green" as const),
  };
}

/* ══════════════════════════ برنامه‌ریزی نیرو ══════════════════════════ */

export type DistributionShape = "uniform" | "bell" | "front_loaded" | "back_loaded";

/** توزیع نفر-ساعت فعالیت روی n دوره؛ جمع خروجی همیشه ۱ است (F-1). */
export function distribute(n: number, shape: DistributionShape = "bell"): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  const w: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n;
    let v: number;
    if (shape === "uniform") v = 1;
    else if (shape === "bell") v = x * (1 - x);             // β(2,2)
    else if (shape === "front_loaded") v = (1 - x) ** 4;    // β(2,5)
    else v = x ** 4;                                         // β(5,2)
    w.push(v);
  }
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / sum);
}

/** نفرات مورد نیاز = سقفِ نفر-ساعت تقسیم بر ساعت مؤثر (F-3). */
export function headcountFor(mh: number, effectiveHours = 8.5): number {
  if (effectiveHours <= 0) return 0;
  return Math.ceil(mh / effectiveHours);
}

/** ضریب پیک: بیش از ۲.۵ یعنی برنامه عملاً قابل تجهیز نیست (F-5). */
export function peakFactor(headcounts: number[]): number {
  if (!headcounts.length) return 0;
  const max = Math.max(...headcounts);
  const avg = headcounts.reduce((a, b) => a + b, 0) / headcounts.length;
  return avg > 0 ? round2(max / avg) : 0;
}

/** انحراف تجهیز نیرو نسبت به برنامه (F-6) — آستانه ±۱۰٪. */
export function mobilizationVariance(actualHC: number, planHC: number): number {
  if (planHC <= 0) return 0;
  return round2(((actualHC - planHC) / planHC) * 100);
}

/** ضریب راندمان هفته‌های نخست تجهیز (F-8). */
export function rampUpFactor(week: number, rampWeeks = 3): number {
  if (rampWeeks <= 0) return 1;
  return round2(Math.min(1, Math.max(0, week) / rampWeeks));
}

/** سهم نیروی غیرمستقیم — آستانه ۲۵٪. */
export function indirectShare(rows: { tradeCode: string; headcount: number }[]): number {
  const total = rows.reduce((a, r) => a + r.headcount, 0);
  if (!total) return 0;
  const indirect = rows
    .filter((r) => !(TRADE_BY_CODE[r.tradeCode]?.direct ?? true))
    .reduce((a, r) => a + r.headcount, 0);
  return round2((indirect / total) * 100);
}

/** اعتبارسنجی برنامه پیش از تأیید (بخش ۴-۵ سند D3). */
export function validatePlan(lines: PlanLine[], pexTotalMH: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const total = lines.reduce((a, l) => a + l.plannedMH, 0);
  if (pexTotalMH > 0 && Math.abs(total - pexTotalMH) / pexTotalMH > 0.02) {
    issues.push({
      code: "E-HRM-120",
      severity: "error",
      message: `اختلاف نفر-ساعت برنامه (${Math.round(total)}) با برنامه زمان‌بندی (${Math.round(pexTotalMH)}) بیش از ۲٪ است`,
    });
  }
  for (const l of lines) {
    if (!TRADE_BY_CODE[l.tradeCode]) {
      issues.push({ code: "E-HRM-121", severity: "error", message: `رسته نامعتبر ${l.tradeCode}`, nodeId: l.id });
    }
  }
  const pf = peakFactor(lines.map((l) => l.plannedHeadcount));
  if (pf > 2.5) {
    issues.push({ code: "W-HRM-320", severity: "warning", message: `ضریب پیک ${pf} بیش از ۲.۵ — برنامه سوزنی است` });
  }
  const ind = indirectShare(lines.map((l) => ({ tradeCode: l.tradeCode, headcount: l.plannedHeadcount })));
  if (ind > 25) {
    issues.push({ code: "W-HRM-321", severity: "warning", message: `سهم نیروی غیرمستقیم ${ind}٪ بیش از آستانه ۲۵٪` });
  }
  return issues;
}

/* ══════════════════════════ بهره‌وری ══════════════════════════ */

/**
 * شاخص بهره‌وری (ADR-09).
 * EarnedMH فقط از پیشرفت **تأییدشده** می‌آید، نه پیشرفت اعلامی.
 */
export function productivityIndex(budgetMH: number, approvedProgressPct: number, actualMH: number) {
  const earned = round2((budgetMH * clamp(approvedProgressPct, 0, 100)) / 100);
  const pi = actualMH > 0 ? round2(earned / actualMH) : 0;
  return {
    earnedMH: earned,
    actualMH: round2(actualMH),
    pi,
    pf: pi > 0 ? round2(1 / pi) : 0,
    status: pi === 0 ? ("na" as const) : pi < 0.85 ? ("red" as const) : pi < 1 ? ("amber" as const) : ("green" as const),
  };
}

/** نرخ اجرا در برابر نرخ استاندارد رسته. */
export function unitRate(qty: number, actualMH: number, tradeCode?: string) {
  const rate = actualMH > 0 ? round2(qty / actualMH) : 0;
  const std = tradeCode ? TRADE_BY_CODE[tradeCode]?.stdRate : undefined;
  return {
    rate,
    stdRate: std,
    variancePct: std && std > 0 ? round2(((rate - std) / std) * 100) : undefined,
  };
}

/* ══════════════════════════ هشدار زودهنگام ══════════════════════════ */

export type HrmAlert = { code: string; severity: "critical" | "high" | "medium"; message: string };

/** چهار قاعده EWS-HRM طبق سند D1. */
export function hrmEws(input: {
  mobVarPct: number;
  piWorst: number;
  otPct: number;
  expiringDocs: number;
  absenteeismPct?: number;
  indirectPct?: number;
}): HrmAlert[] {
  const out: HrmAlert[] = [];
  if (Math.abs(input.mobVarPct) > 10) {
    out.push({
      code: "EWS-HRM-01",
      severity: Math.abs(input.mobVarPct) > 25 ? "critical" : "high",
      message: `انحراف تجهیز نیرو ${input.mobVarPct}٪ فراتر از ±۱۰٪`,
    });
  }
  if (input.piWorst > 0 && input.piWorst < 0.85) {
    out.push({
      code: "EWS-HRM-02",
      severity: input.piWorst < 0.7 ? "critical" : "high",
      message: `شاخص بهره‌وری ${input.piWorst} زیر آستانه ۰.۸۵`,
    });
  }
  if (input.otPct > 15) {
    out.push({
      code: "EWS-HRM-03",
      severity: input.otPct > 25 ? "high" : "medium",
      message: `سهم اضافه‌کاری ${input.otPct}٪ بیش از آستانه ۱۵٪ — ریسک فرسودگی و هزینه`,
    });
  }
  if (input.expiringDocs > 0) {
    out.push({
      code: "EWS-HRM-04",
      severity: "high",
      message: `${input.expiringDocs} مدرک انطباق تا ۳۰ روز آینده منقضی می‌شود`,
    });
  }
  if ((input.absenteeismPct ?? 0) > 5) {
    out.push({ code: "EWS-HRM-05", severity: "medium", message: `نرخ غیبت ${input.absenteeismPct}٪ بیش از ۵٪` });
  }
  if ((input.indirectPct ?? 0) > 25) {
    out.push({ code: "EWS-HRM-06", severity: "medium", message: `سهم نیروی غیرمستقیم ${input.indirectPct}٪ بیش از ۲۵٪` });
  }
  return out;
}

/* ══════════════════════════ کاتالوگ رسته‌ها (۶۰ رسته) ══════════════════════════ */

export const TRADE_CATALOG: Trade[] = [
  // عمران و ابنیه
  { code: "CIV-FRM", fa: "قالب‌بند", en: "Formworker", category: "civil", direct: true, stdRate: 0.8, uom: "m²/MH" },
  { code: "CIV-RBR", fa: "آرماتوربند", en: "Rebar Fixer", category: "civil", direct: true, stdRate: 0.09, uom: "ton/MH" },
  { code: "CIV-CNC", fa: "بتن‌ریز", en: "Concrete Placer", category: "civil", direct: true, stdRate: 0.7, uom: "m³/MH" },
  { code: "CIV-MAS", fa: "بنّا", en: "Mason", category: "civil", direct: true, stdRate: 0.9, uom: "m²/MH" },
  { code: "CIV-PLS", fa: "گچ‌کار و اندودکار", en: "Plasterer", category: "civil", direct: true, stdRate: 1.2, uom: "m²/MH" },
  { code: "CIV-TIL", fa: "کاشی‌کار", en: "Tiler", category: "civil", direct: true, stdRate: 0.85, uom: "m²/MH" },
  { code: "CIV-PNT", fa: "نقاش ساختمان", en: "Painter (Building)", category: "civil", direct: true, stdRate: 2.5, uom: "m²/MH" },
  { code: "CIV-EXC", fa: "خاک‌بردار دستی", en: "Manual Excavator", category: "civil", direct: true, stdRate: 0.6, uom: "m³/MH" },
  { code: "CIV-ASP", fa: "آسفالت‌کار", en: "Asphalt Worker", category: "civil", direct: true, stdRate: 1.5, uom: "m²/MH" },
  { code: "CIV-SCF", fa: "داربست‌بند", en: "Scaffolder", category: "civil", direct: true, stdRate: 0.45, uom: "m³/MH" },
  // جوشکاری و سازه فلزی
  { code: "WLD-6G", fa: "جوشکار ۶G آرگون", en: "Welder 6G GTAW", category: "welding", direct: true, stdRate: 0.35, uom: "inch-dia/MH" },
  { code: "WLD-3G", fa: "جوشکار ۳G برق", en: "Welder 3G SMAW", category: "welding", direct: true, stdRate: 0.55, uom: "inch-dia/MH" },
  { code: "WLD-STR", fa: "جوشکار سازه", en: "Structural Welder", category: "welding", direct: true, stdRate: 1.1, uom: "m/MH" },
  { code: "WLD-FIT", fa: "فیتر جوش", en: "Weld Fitter", category: "welding", direct: true, stdRate: 0.6, uom: "inch-dia/MH" },
  { code: "WLD-TAC", fa: "تک‌جوش‌کار", en: "Tack Welder", category: "welding", direct: true, stdRate: 0.9, uom: "joint/MH" },
  { code: "MEC-STF", fa: "نصاب سازه فلزی", en: "Steel Erector", category: "mechanical", direct: true, stdRate: 0.07, uom: "ton/MH" },
  { code: "MEC-RIG", fa: "ریگر", en: "Rigger", category: "mechanical", direct: true },
  { code: "MEC-EQP", fa: "نصاب تجهیزات", en: "Equipment Installer", category: "mechanical", direct: true, stdRate: 0.04, uom: "ton/MH" },
  { code: "MEC-STC", fa: "نصاب تجهیزات ثابت", en: "Static Equipment Fitter", category: "mechanical", direct: true, stdRate: 0.05, uom: "ton/MH" },
  { code: "MEC-ROT", fa: "نصاب تجهیزات دوار", en: "Rotating Equipment Fitter", category: "mechanical", direct: true, stdRate: 0.03, uom: "ton/MH" },
  // پایپینگ
  { code: "PIP-FIT", fa: "پایپ‌فیتر", en: "Pipe Fitter", category: "piping", direct: true, stdRate: 0.5, uom: "inch-dia/MH" },
  { code: "PIP-SPL", fa: "سازنده اسپول", en: "Spool Fabricator", category: "piping", direct: true, stdRate: 0.65, uom: "inch-dia/MH" },
  { code: "PIP-SUP", fa: "نصاب ساپورت", en: "Support Installer", category: "piping", direct: true, stdRate: 0.25, uom: "pcs/MH" },
  { code: "PIP-INS", fa: "عایق‌کار", en: "Insulator", category: "piping", direct: true, stdRate: 1.1, uom: "m²/MH" },
  { code: "PIP-PNT", fa: "رنگ و پوشش صنعتی", en: "Industrial Coating", category: "piping", direct: true, stdRate: 1.8, uom: "m²/MH" },
  { code: "PIP-HYD", fa: "تکنسین تست هیدرواستاتیک", en: "Hydrotest Technician", category: "piping", direct: true },
  { code: "PIP-VLV", fa: "نصاب شیرآلات", en: "Valve Fitter", category: "piping", direct: true, stdRate: 0.4, uom: "pcs/MH" },
  // برق
  { code: "ELE-CAB", fa: "کابل‌کش", en: "Cable Puller", category: "electrical", direct: true, stdRate: 8, uom: "m/MH" },
  { code: "ELE-TRM", fa: "ترمیناتور کابل", en: "Cable Terminator", category: "electrical", direct: true, stdRate: 1.5, uom: "core/MH" },
  { code: "ELE-TRY", fa: "نصاب سینی و نردبان کابل", en: "Tray & Ladder Installer", category: "electrical", direct: true, stdRate: 1.2, uom: "m/MH" },
  { code: "ELE-PNL", fa: "نصاب تابلو برق", en: "Panel Installer", category: "electrical", direct: true, stdRate: 0.15, uom: "pcs/MH" },
  { code: "ELE-LGT", fa: "نصاب روشنایی", en: "Lighting Fitter", category: "electrical", direct: true, stdRate: 0.8, uom: "pcs/MH" },
  { code: "ELE-ERT", fa: "ارت‌کار", en: "Earthing Technician", category: "electrical", direct: true, stdRate: 2.5, uom: "m/MH" },
  { code: "ELE-HVT", fa: "تکنسین فشار قوی", en: "HV Technician", category: "electrical", direct: true },
  // ابزار دقیق
  { code: "INS-FIT", fa: "نصاب ابزار دقیق", en: "Instrument Fitter", category: "instrument", direct: true, stdRate: 0.2, uom: "pcs/MH" },
  { code: "INS-TUB", fa: "تیوب‌کش", en: "Tubing Technician", category: "instrument", direct: true, stdRate: 2, uom: "m/MH" },
  { code: "INS-LOP", fa: "تکنسین تست لوپ", en: "Loop Test Technician", category: "instrument", direct: true, stdRate: 0.3, uom: "loop/MH" },
  { code: "INS-CAL", fa: "کالیبراتور", en: "Calibration Technician", category: "instrument", direct: true, stdRate: 0.25, uom: "pcs/MH" },
  { code: "INS-DCS", fa: "تکنسین DCS و PLC", en: "DCS/PLC Technician", category: "instrument", direct: true },
  // اپراتور ماشین‌آلات
  { code: "EQP-CRN", fa: "اپراتور جرثقیل", en: "Crane Operator", category: "equipment_op", direct: true },
  { code: "EQP-EXC", fa: "اپراتور بیل مکانیکی", en: "Excavator Operator", category: "equipment_op", direct: true },
  { code: "EQP-LDR", fa: "اپراتور لودر", en: "Loader Operator", category: "equipment_op", direct: true },
  { code: "EQP-FRK", fa: "اپراتور لیفتراک", en: "Forklift Operator", category: "equipment_op", direct: true },
  { code: "EQP-MAN", fa: "اپراتور منلیفت", en: "Manlift Operator", category: "equipment_op", direct: true },
  { code: "EQP-TRK", fa: "راننده کامیون", en: "Truck Driver", category: "equipment_op", direct: true },
  { code: "EQP-CMP", fa: "اپراتور کمپرسور", en: "Compressor Operator", category: "equipment_op", direct: true },
  // کیفیت
  { code: "QCM-WLD", fa: "بازرس جوش", en: "Welding Inspector", category: "qc", direct: false },
  { code: "QCM-NDT", fa: "تکنسین NDT", en: "NDT Technician", category: "qc", direct: false },
  { code: "QCM-CIV", fa: "بازرس عمران", en: "Civil QC Inspector", category: "qc", direct: false },
  { code: "QCM-ELE", fa: "بازرس برق و ابزار دقیق", en: "E&I QC Inspector", category: "qc", direct: false },
  { code: "QCM-DOC", fa: "کنترل مدارک کیفیت", en: "QC Document Controller", category: "qc", direct: false },
  // ایمنی
  { code: "HSE-OFF", fa: "افسر HSE", en: "HSE Officer", category: "hse", direct: false },
  { code: "HSE-FRM", fa: "ناظر ایمنی کارگاه", en: "Safety Supervisor", category: "hse", direct: false },
  { code: "HSE-FRA", fa: "نگهبان آتش", en: "Fire Watch", category: "hse", direct: false },
  { code: "HSE-MED", fa: "امدادگر و بهیار", en: "Medic", category: "hse", direct: false },
  // ستادی و عمومی
  { code: "STF-PM", fa: "مدیر پروژه", en: "Project Manager", category: "staff", direct: false },
  { code: "STF-CM", fa: "مدیر کارگاه", en: "Construction Manager", category: "staff", direct: false },
  { code: "STF-SUP", fa: "سوپروایزر اجرا", en: "Field Supervisor", category: "staff", direct: false },
  { code: "STF-FRM", fa: "سرپرست اکیپ", en: "Foreman", category: "staff", direct: true },
  { code: "STF-PLN", fa: "برنامه‌ریز و کنترل پروژه", en: "Planner / Cost Control", category: "staff", direct: false },
  { code: "STF-SUR", fa: "نقشه‌بردار", en: "Surveyor", category: "staff", direct: true },
  { code: "STF-WHS", fa: "انباردار", en: "Warehouse Keeper", category: "staff", direct: false },
  { code: "STF-ADM", fa: "اداری و پشتیبانی", en: "Admin & Support", category: "staff", direct: false },
  { code: "STF-DRV", fa: "راننده سبک", en: "Light Vehicle Driver", category: "staff", direct: false },
  { code: "GEN-HLP", fa: "کارگر ساده", en: "General Helper", category: "general", direct: true },
  { code: "GEN-CLN", fa: "نظافت کارگاه", en: "Housekeeping", category: "general", direct: false },
];

export const TRADE_BY_CODE: Record<string, Trade> = Object.fromEntries(
  TRADE_CATALOG.map((t) => [t.code, t])
);

/* ══════════════════════════ ابزار ══════════════════════════ */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/* ══════════════════════════ D4 — تایم‌شیت و ثبت میدانی ══════════════════════════
 *
 * هستهٔ ماژول. سه مسئله را حل می‌کند که هرکدام جای دیگری حل نمی‌شود:
 *
 * ۱) **ساعت بی‌صاحب.** هر ساعتی که ثبت می‌شود باید فعالیت و حساب هزینه
 *    داشته باشد، وگرنه بعداً کسی نمی‌تواند بگوید این پول کجا رفت.
 * ۲) **دورهٔ بسته.** پس از بستن دوره، عدد تغییر نمی‌کند؛ اصلاح فقط با
 *    سند اصلاحی و ردپا.
 * ۳) **دو دستگاه، یک حقیقت.** ثبت آفلاین یعنی دو نسخه از یک برگه؛
 *    قاعدهٔ برنده باید از پیش نوشته شده باشد، نه در لحظهٔ تعارض.
 */

/* ─────────── ۱. ماشین حالت ─────────── */

export const TIMESHEET_STATES = [
  "draft", "submitted", "foreman_approved", "qc_verified",
  "pm_approved", "posted", "locked", "rejected",
] as const;

export type TsState = (typeof TIMESHEET_STATES)[number];

export const TS_STATE_FA: Record<TsState, string> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  foreman_approved: "تأیید سرپرست",
  qc_verified: "تأیید کنترل کیفیت",
  pm_approved: "تأیید مدیر پروژه",
  posted: "ارسال‌شده به مالی",
  locked: "قفل‌شده",
  rejected: "برگشتی",
};

/** رتبهٔ اقتدار هر حالت — مبنای حل تعارض و قفل ویرایش. */
export const TS_STATE_RANK: Record<TsState, number> = {
  draft: 0,
  rejected: 0,
  submitted: 1,
  foreman_approved: 2,
  qc_verified: 3,
  pm_approved: 4,
  posted: 5,
  locked: 6,
};

export type TsTransition = {
  from: TsState;
  to: TsState;
  permission: string;
  /** آیا این گذار امضای سرپرست را لازم دارد؟ */
  requiresSignature?: boolean;
  labelFa: string;
};

/**
 * گذارهای مجاز. `rejected` عمداً از هر مرحلهٔ تأیید ممکن است، چون
 * ایراد ممکن است در هر لایه دیده شود؛ ولی بازگشت همیشه به `draft`
 * است تا چرخه دوباره از اول طی شود.
 */
export const TS_TRANSITIONS: TsTransition[] = [
  { from: "draft", to: "submitted", permission: "hrm.timesheet.enter", labelFa: "ارسال برای تأیید" },
  { from: "submitted", to: "foreman_approved", permission: "hrm.timesheet.sign", requiresSignature: true, labelFa: "تأیید سرپرست" },
  { from: "foreman_approved", to: "qc_verified", permission: "hrm.timesheet.verify", labelFa: "تأیید کنترل کیفیت" },
  { from: "foreman_approved", to: "pm_approved", permission: "hrm.timesheet.finalize", labelFa: "تأیید مدیر پروژه (بدون گیت کیفیت)" },
  { from: "qc_verified", to: "pm_approved", permission: "hrm.timesheet.finalize", labelFa: "تأیید مدیر پروژه" },
  { from: "pm_approved", to: "posted", permission: "hrm.cost.post", labelFa: "ارسال به مالی" },
  { from: "posted", to: "locked", permission: "hrm.period.lock", labelFa: "قفل دوره" },
  { from: "submitted", to: "rejected", permission: "hrm.timesheet.sign", labelFa: "برگشت به ثبت‌کننده" },
  { from: "foreman_approved", to: "rejected", permission: "hrm.timesheet.verify", labelFa: "برگشت به ثبت‌کننده" },
  { from: "qc_verified", to: "rejected", permission: "hrm.timesheet.finalize", labelFa: "برگشت به ثبت‌کننده" },
  { from: "rejected", to: "draft", permission: "hrm.timesheet.enter", labelFa: "بازگشایی برای اصلاح" },
];

export function tsTransition(from: string, to: string): TsTransition | undefined {
  return TS_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

/** گذارهای ممکن از یک حالت — برای ساخت دکمه‌های UI. */
export function tsNextStates(from: string): TsTransition[] {
  return TS_TRANSITIONS.filter((t) => t.from === from);
}

export type TransitionCheck = {
  ok: boolean;
  code?: string;
  messageFa?: string;
  transition?: TsTransition;
};

/**
 * آیا گذار مجاز است؟ فقط قواعد حالت را بررسی می‌کند — مجوز کاربر
 * جداگانه در لایهٔ REST سنجیده می‌شود.
 */
export function canTransition(input: {
  from: string;
  to: string;
  hasForemanSignature?: boolean;
  isPeriodLocked?: boolean;
  entryCount?: number;
}): TransitionCheck {
  const t = tsTransition(input.from, input.to);
  if (!t) {
    return {
      ok: false,
      code: "E-HRM-110",
      messageFa: `گذار از «${TS_STATE_FA[input.from as TsState] ?? input.from}» به «${TS_STATE_FA[input.to as TsState] ?? input.to}» تعریف نشده است`,
    };
  }
  /* دورهٔ قفل‌شده هیچ گذاری نمی‌پذیرد جز خواندن. این بررسی پیش از
   * امضا می‌آید چون قفل، بالاترین اقتدار را دارد. */
  if (input.isPeriodLocked) {
    return { ok: false, code: "E-HRM-103", messageFa: "دورهٔ این برگه بسته است؛ اصلاح فقط با سند اصلاحی ممکن است" };
  }
  /* برگهٔ بی‌ردیف ارسال نمی‌شود: تأیید کردن هیچ، یعنی امضا زیر هیچ. */
  if (input.to === "submitted" && !(Number(input.entryCount ?? 0) > 0)) {
    return { ok: false, code: "E-HRM-111", messageFa: "برگهٔ بدون ردیف کارکرد ارسال نمی‌شود" };
  }
  if (t.requiresSignature && !input.hasForemanSignature) {
    return { ok: false, code: "E-HRM-112", messageFa: "تأیید سرپرست بدون امضای دیجیتال ثبت نمی‌شود" };
  }
  return { ok: true, transition: t };
}

/** آیا برگه در این حالت ویرایش‌پذیر است؟ */
export function isTsEditable(status: string): boolean {
  return status === "draft" || status === "rejected";
}

/* ─────────── ۲. اعتبارسنجی ردیف ─────────── */

export type TsEntryInput = {
  personId?: string;
  tradeCode?: string;
  activityId?: string;
  cbsId?: string;
  hoursRaw?: number;
  attendanceCode?: string;
  qtyDone?: number;
  qtyUom?: string;
};

export type TsIssue = {
  code: string;
  severity: "error" | "warning";
  messageFa: string;
  field?: string;
  personId?: string;
};

/** کدهای حضور که ساعت واقعی دارند ولی کار مولد نیستند. */
export const NON_PRODUCTIVE_CODES = ["standby", "weather_delay", "no_work_front"] as const;

/** کدهای حضور که اصلاً ساعت کار ندارند. */
export const ABSENCE_CODES = ["absent", "leave", "sick"] as const;

export const ATTENDANCE_FA: Record<string, string> = {
  present: "حاضر",
  absent: "غایب",
  leave: "مرخصی",
  sick: "استعلاجی",
  mission: "مأموریت",
  standby: "آماده‌به‌کار",
  weather_delay: "توقف جوی",
  no_work_front: "نبود جبههٔ کاری",
};

export function isProductiveCode(code: string): boolean {
  return !(NON_PRODUCTIVE_CODES as readonly string[]).includes(code)
    && !(ABSENCE_CODES as readonly string[]).includes(code);
}

export type TsValidationContext = {
  law?: LaborLawConfig;
  /** ساعت‌های همان نفر در همان روز از برگه‌های دیگر. */
  priorHoursByPerson?: Record<string, number>;
  /** فعالیت‌های معتبر پروژه؛ خالی یعنی بررسی نکن. */
  validActivityIds?: string[];
  /** حساب‌های هزینهٔ باز؛ خالی یعنی بررسی نکن. */
  openCbsIds?: string[];
  /** نفراتی که در این تاریخ انتصاب فعال دارند؛ خالی یعنی بررسی نکن. */
  assignedPersonIds?: string[];
  /** نفراتی که مدرک مسدودکنندهٔ منقضی دارند. */
  blockedPersonIds?: string[];
  /** نفراتی که پاکسازی ایمنی ندارند. */
  unclearedPersonIds?: string[];
  isPeriodLocked?: boolean;
};

/**
 * اعتبارسنجی یک ردیف. خطاها ثبت را متوقف می‌کنند، هشدارها نه.
 *
 * ترتیب بررسی‌ها عمدی است: اول چیزهایی که ردیف را بی‌معنا می‌کنند
 * (نفر، ساعت)، بعد چیزهایی که مقصد هزینه را مبهم می‌گذارند، آخر
 * انطباق و سقف‌ها.
 */
export function validateTsEntry(e: TsEntryInput, ctx: TsValidationContext = {}): TsIssue[] {
  const law = ctx.law ?? IRAN_LABOR_LAW;
  const out: TsIssue[] = [];
  const person = String(e.personId ?? "");
  const code = String(e.attendanceCode ?? "present");
  const hours = Number(e.hoursRaw ?? 0);

  if (!person) {
    out.push({ code: "E-HRM-100", severity: "error", messageFa: "نفر ردیف مشخص نیست", field: "personId" });
    return out;
  }
  if (ctx.isPeriodLocked) {
    out.push({ code: "E-HRM-103", severity: "error", messageFa: "دورهٔ این تاریخ بسته است", personId: person });
  }

  const isAbsence = (ABSENCE_CODES as readonly string[]).includes(code);

  if (isAbsence) {
    /* غیبت و مرخصی ساعت ندارند؛ اگر ساعت آمده یعنی کاربر کد را
     * اشتباه انتخاب کرده و سکوت در برابرش، عدد را خراب می‌کند. */
    if (hours > 0) {
      out.push({
        code: "E-HRM-106", severity: "error", personId: person, field: "hoursRaw",
        messageFa: `کد حضور «${ATTENDANCE_FA[code] ?? code}» با ساعت کارکرد سازگار نیست`,
      });
    }
    return out;
  }

  if (!(hours > 0)) {
    out.push({ code: "E-HRM-107", severity: "error", personId: person, field: "hoursRaw", messageFa: "ساعت کارکرد باید بزرگ‌تر از صفر باشد" });
  }

  /* هر ساعتی باید صاحب داشته باشد. */
  if (!e.activityId) {
    out.push({ code: "E-HRM-101", severity: "error", personId: person, field: "activityId", messageFa: "ساعت بدون فعالیت ثبت نمی‌شود" });
  } else if (ctx.validActivityIds?.length && !ctx.validActivityIds.includes(String(e.activityId))) {
    out.push({ code: "E-HRM-101", severity: "error", personId: person, field: "activityId", messageFa: `فعالیت ${e.activityId} در این پروژه شناخته نشد` });
  }

  if (!e.cbsId) {
    out.push({ code: "E-HRM-105", severity: "error", personId: person, field: "cbsId", messageFa: "حساب هزینه (CBS) الزامی است" });
  } else if (ctx.openCbsIds?.length && !ctx.openCbsIds.includes(String(e.cbsId))) {
    out.push({ code: "E-HRM-105", severity: "error", personId: person, field: "cbsId", messageFa: `حساب هزینه ${e.cbsId} باز نیست` });
  }

  if (ctx.assignedPersonIds?.length && !ctx.assignedPersonIds.includes(person)) {
    out.push({ code: "E-HRM-104", severity: "error", personId: person, messageFa: "این نفر در این تاریخ انتصاب فعال روی پروژه ندارد" });
  }
  if (ctx.blockedPersonIds?.includes(person)) {
    out.push({ code: "E-HRM-201", severity: "error", personId: person, messageFa: "مدرک مسدودکنندهٔ این نفر منقضی شده است" });
  }
  if (ctx.unclearedPersonIds?.includes(person)) {
    out.push({ code: "E-HRM-202", severity: "error", personId: person, messageFa: "پاکسازی ایمنی و بهداشت این نفر تأیید نشده است" });
  }

  /* سقف مطلق روزانه روی جمع همهٔ برگه‌ها سنجیده می‌شود، نه یک برگه:
   * وگرنه ثبت ۱۲ ساعت در دو برگهٔ ۶ ساعته از سقف رد می‌شود. */
  const prior = Number(ctx.priorHoursByPerson?.[person] ?? 0);
  if (prior + hours > law.dailyAbsoluteCap) {
    out.push({
      code: "E-HRM-102", severity: "error", personId: person, field: "hoursRaw",
      messageFa: `جمع ساعت این نفر در این روز ${round2(prior + hours)} می‌شود و از سقف ${law.dailyAbsoluteCap} ساعت عبور می‌کند`,
    });
  } else if (prior + hours > law.dailyNormalCap + law.dailyOtCap) {
    /* از سقف اضافه‌کاری رد شده ولی زیر سقف مطلق: هشدار، نه رد. این
     * حالت واقعی است (شیفت فوق‌العاده) و تأیید سطح بالاتر می‌خواهد. */
    out.push({
      code: "W-HRM-301", severity: "warning", personId: person,
      messageFa: `اضافه‌کاری بیش از سقف روزانه (${law.dailyOtCap} ساعت) — تأیید سطح بالاتر لازم است`,
    });
  }

  if (e.qtyDone != null && Number(e.qtyDone) > 0 && !e.qtyUom) {
    out.push({ code: "W-HRM-302", severity: "warning", personId: person, field: "qtyUom", messageFa: "کمیت اجراشده بدون واحد ثبت شده است" });
  }

  return out;
}

/** آیا فهرست ایرادها مانع ثبت است؟ */
export function hasBlockingIssue(issues: TsIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

/* ─────────── ۳. ساخت برگه ─────────── */

export type TsHeaderInput = {
  projectId: string;
  crewId: string;
  workDate: string;
  shift?: "day" | "night" | "swing";
};

/**
 * شناسهٔ قطعی برگه.
 *
 * چرا قطعی: دستگاه آفلاین همان شناسه‌ای را می‌سازد که سرور می‌سازد،
 * پس ارسال دوباره به‌جای برگهٔ تکراری، همان برگه را به‌روز می‌کند.
 */
export function timesheetId(i: TsHeaderInput): string {
  const d = String(i.workDate).replace(/-/g, "");
  return `TS-${i.projectId}-${d}-${i.crewId}-${i.shift ?? "day"}`;
}

export type TsEntryComputed = TsEntryInput & {
  hoursNormal: number;
  hoursOt: number;
  hoursNight: number;
  hoursHoliday: number;
  hoursRejected: number;
  isProductive: boolean;
};

/**
 * تفکیک ساعت همهٔ ردیف‌های یک برگه.
 *
 * نکتهٔ مهم: تفکیک برای هر نفر انباشتی است. اگر یک نفر دو ردیف روی دو
 * فعالیت داشته باشد، ردیف دوم از سقف عادی ردیف اول شروع می‌شود —
 * وگرنه هر ردیف ۸ ساعت عادی می‌گرفت و اضافه‌کاری هرگز دیده نمی‌شد.
 */
export function computeTsEntries(
  entries: TsEntryInput[],
  opts: {
    workDate: string;
    shift?: "day" | "night" | "swing";
    holidays?: string[];
    law?: LaborLawConfig;
    priorHoursByPerson?: Record<string, number>;
  }
): TsEntryComputed[] {
  const law = opts.law ?? IRAN_LABOR_LAW;
  const running: Record<string, number> = { ...(opts.priorHoursByPerson ?? {}) };
  const out: TsEntryComputed[] = [];

  for (const e of entries) {
    const person = String(e.personId ?? "");
    const code = String(e.attendanceCode ?? "present");
    const raw = Number(e.hoursRaw ?? 0);

    if ((ABSENCE_CODES as readonly string[]).includes(code) || !(raw > 0)) {
      out.push({
        ...e, hoursNormal: 0, hoursOt: 0, hoursNight: 0, hoursHoliday: 0,
        hoursRejected: 0, isProductive: false,
      });
      continue;
    }

    const prior = Number(running[person] ?? 0);
    const split = splitHours(raw, {
      dateIso: opts.workDate,
      shift: opts.shift,
      holidays: opts.holidays,
      law,
      priorHoursToday: prior,
    });
    running[person] = round2(prior + raw);

    out.push({
      ...e,
      hoursNormal: split.normal,
      hoursOt: split.ot,
      hoursNight: split.night,
      hoursHoliday: split.holiday,
      hoursRejected: split.rejected,
      isProductive: isProductiveCode(code),
    });
  }
  return out;
}

export type TsTotals = {
  raw: number;
  normal: number;
  ot: number;
  night: number;
  holiday: number;
  rejected: number;
  productiveHours: number;
  lostHours: number;
  headcount: number;
  /** درصد ساعتی که حاضر بوده ولی کار مولد نکرده است. */
  lostTimePct: number | null;
};

/** جمع‌های برگه — همان اعدادی که در سربرگ cache می‌شوند. */
export function tsTotals(rows: TsEntryComputed[]): TsTotals {
  const t: TsTotals = {
    raw: 0, normal: 0, ot: 0, night: 0, holiday: 0, rejected: 0,
    productiveHours: 0, lostHours: 0, headcount: 0, lostTimePct: null,
  };
  const people = new Set<string>();

  for (const r of rows) {
    const raw = Number(r.hoursRaw ?? 0);
    /* شب جدا جمع نمی‌شود چون همان ساعت عادی/اضافه است با ضریب؛
     * جمع کردنش یعنی دوباره‌شماری. */
    t.raw = round2(t.raw + raw);
    t.normal = round2(t.normal + r.hoursNormal);
    t.ot = round2(t.ot + r.hoursOt);
    t.night = round2(t.night + r.hoursNight);
    t.holiday = round2(t.holiday + r.hoursHoliday);
    t.rejected = round2(t.rejected + r.hoursRejected);
    if (raw > 0) {
      if (r.isProductive) t.productiveHours = round2(t.productiveHours + raw);
      else t.lostHours = round2(t.lostHours + raw);
      if (r.personId) people.add(String(r.personId));
    }
  }
  t.headcount = people.size;
  const attended = round2(t.productiveHours + t.lostHours);
  t.lostTimePct = attended > 0 ? round2((t.lostHours / attended) * 100) : null;
  return t;
}

/* ─────────── ۴. هزینهٔ کارکرد ─────────── */

export type RateLookup = (tradeCode: string, grade?: string) => number | null;

export type TsCostLine = {
  cbsId: string;
  activityId: string;
  tradeCode: string;
  hoursNormal: number;
  hoursOt: number;
  hoursNight: number;
  hoursHoliday: number;
  /** ساعت مؤثر پس از اعمال ضرایب قانون کار. */
  equivalentHours: number;
  hourlyRate: number | null;
  amount: number | null;
  /** ردیف‌هایی که نرخ نداشتند و مبلغشان محاسبه نشد. */
  missingRate: boolean;
};

/**
 * تجمیع ساعت به خطوط هزینه بر پایهٔ (حساب هزینه × فعالیت × رسته).
 *
 * دامنه: نرخ × ساعت برای هزینهٔ پروژه. این تابع فیش حقوقی، بیمه و
 * مالیات محاسبه نمی‌کند — آن کار Payroll است و در دامنهٔ این سامانه
 * نیست.
 *
 * ردیف بدون نرخ حذف نمی‌شود؛ با `missingRate` علامت می‌خورد تا ساعتش
 * گم نشود. ساعت گم‌شده بدتر از مبلغ نامعلوم است.
 */
export function buildTsCostLines(
  rows: TsEntryComputed[],
  rateOf: RateLookup,
  law: LaborLawConfig = IRAN_LABOR_LAW
): TsCostLine[] {
  const map = new Map<string, TsCostLine>();

  for (const r of rows) {
    if (!(Number(r.hoursRaw ?? 0) > 0)) continue;
    const cbs = String(r.cbsId ?? "");
    const act = String(r.activityId ?? "");
    const trade = String(r.tradeCode ?? "");
    if (!cbs || !act) continue;

    const key = `${cbs}|${act}|${trade}`;
    let line = map.get(key);
    if (!line) {
      line = {
        cbsId: cbs, activityId: act, tradeCode: trade,
        hoursNormal: 0, hoursOt: 0, hoursNight: 0, hoursHoliday: 0,
        equivalentHours: 0, hourlyRate: null, amount: null, missingRate: false,
      };
      map.set(key, line);
    }
    line.hoursNormal = round2(line.hoursNormal + r.hoursNormal);
    line.hoursOt = round2(line.hoursOt + r.hoursOt);
    line.hoursNight = round2(line.hoursNight + r.hoursNight);
    line.hoursHoliday = round2(line.hoursHoliday + r.hoursHoliday);
    line.equivalentHours = round2(line.equivalentHours + costFactor({
      raw: Number(r.hoursRaw ?? 0),
      normal: r.hoursNormal, ot: r.hoursOt,
      night: r.hoursNight, holiday: r.hoursHoliday, rejected: 0,
    }, law));
  }

  for (const line of map.values()) {
    const rate = rateOf(line.tradeCode);
    if (rate == null || !(rate > 0)) {
      line.missingRate = true;
      line.hourlyRate = null;
      line.amount = null;
    } else {
      line.hourlyRate = rate;
      line.amount = round2(line.equivalentHours * rate);
    }
  }

  return [...map.values()].sort((a, b) =>
    a.cbsId.localeCompare(b.cbsId) || a.activityId.localeCompare(b.activityId) || a.tradeCode.localeCompare(b.tradeCode));
}

export type TsCostSummary = {
  lines: TsCostLine[];
  totalEquivalentHours: number;
  totalAmount: number;
  /** ساعتی که به‌خاطر نبود نرخ مبلغ‌گذاری نشد. */
  unpricedHours: number;
  isComplete: boolean;
};

export function tsCostSummary(lines: TsCostLine[]): TsCostSummary {
  let hours = 0, amount = 0, unpriced = 0;
  for (const l of lines) {
    hours = round2(hours + l.equivalentHours);
    if (l.missingRate) unpriced = round2(unpriced + l.equivalentHours);
    else amount = round2(amount + (l.amount ?? 0));
  }
  return {
    lines,
    totalEquivalentHours: hours,
    totalAmount: amount,
    unpricedHours: unpriced,
    isComplete: unpriced === 0,
  };
}

/* ─────────── ۵. حل تعارض همگام‌سازی (رفع شکاف H-03) ─────────── */

export type SyncSide = {
  status: string;
  revision: number;
  capturedAt?: string;
  hasForemanSignature?: boolean;
  deviceId?: string;
};

export type ConflictVerdict = {
  winner: "server" | "local" | "none";
  /** آیا باید در دفتر تعارض ثبت شود؟ */
  needsConflictRecord: boolean;
  /** آیا اصلاح فقط با سند اصلاحی ممکن است؟ */
  requiresAdjustment: boolean;
  ruleFa: string;
  code: string;
};

/**
 * جدول تصمیم حل تعارض — جایگزین «آخرین نوشته برنده» (ADR-08).
 *
 * چرا LWW کافی نیست: در کارگاه، ساعت دستگاه‌ها قابل اعتماد نیست و
 * مهم‌تر اینکه یک پیش‌نویسِ دیرتر ثبت‌شده نباید یک برگهٔ امضاشده را
 * پاک کند. اقتدار حالت بر زمان مقدم است.
 *
 * ترتیب بررسی‌ها عمدی و از قوی به ضعیف است.
 */
export function resolveSyncConflict(server: SyncSide, local: SyncSide): ConflictVerdict {
  const sRank = TS_STATE_RANK[server.status as TsState] ?? 0;
  const lRank = TS_STATE_RANK[local.status as TsState] ?? 0;

  /* ۱) قفل، قاطع است. دورهٔ بسته حتی نسخهٔ امضاشده را هم نمی‌پذیرد. */
  if (server.status === "locked") {
    return {
      winner: "server", needsConflictRecord: true, requiresAdjustment: true,
      code: "E-HRM-103",
      ruleFa: "دورهٔ سرور قفل است؛ نسخهٔ محلی رد شد و اصلاح فقط با سند اصلاحی ممکن است",
    };
  }

  /* ۲) از تأیید سرپرست به بالا، سرور همیشه برنده است: چیزی که امضا
   *    شده با همگام‌سازی خاموش بازنویسی نمی‌شود. */
  if (sRank >= TS_STATE_RANK.foreman_approved) {
    return {
      winner: "server", needsConflictRecord: true, requiresAdjustment: true,
      code: "W-HRM-401",
      ruleFa: `نسخهٔ سرور در وضعیت «${TS_STATE_FA[server.status as TsState] ?? server.status}» است و بازنویسی نمی‌شود؛ اصلاح با سند اصلاحی`,
    };
  }

  /* ۳) سرور ارسال‌شده، محلی پیش‌نویس: سرور برنده، ولی نسخهٔ محلی
   *    به‌عنوان پیشنهاد ثبت می‌شود تا کار اپراتور هدر نرود. */
  if (server.status === "submitted" && lRank < TS_STATE_RANK.submitted) {
    return {
      winner: "server", needsConflictRecord: true, requiresAdjustment: false,
      code: "W-HRM-402",
      ruleFa: "نسخهٔ سرور ارسال شده است؛ نسخهٔ محلی به‌عنوان پیشنهاد در دفتر تعارض ثبت شد",
    };
  }

  /* ۴) محلیِ قوی‌تر برنده است — اپراتور در کارگاه امضا گرفته و
   *    سرور هنوز پیش‌نویس دارد. */
  if (lRank > sRank) {
    return {
      winner: "local", needsConflictRecord: lRank >= TS_STATE_RANK.foreman_approved, requiresAdjustment: false,
      code: "W-HRM-403",
      ruleFa: `نسخهٔ محلی در وضعیت بالاتر «${TS_STATE_FA[local.status as TsState] ?? local.status}» است و اعمال شد`,
    };
  }

  /* ۵) هر دو پیش‌نویس با امضای متفاوت: امضا بر زمان مقدم است. */
  if (sRank === lRank && Boolean(server.hasForemanSignature) !== Boolean(local.hasForemanSignature)) {
    const localWins = Boolean(local.hasForemanSignature);
    return {
      winner: localWins ? "local" : "server",
      needsConflictRecord: true, requiresAdjustment: false,
      code: "W-HRM-404",
      ruleFa: "هر دو نسخه هم‌سطح‌اند؛ نسخهٔ دارای امضای سرپرست برنده شد",
    };
  }

  /* ۶) هم‌سطح و بی‌تفاوت: تازه‌ترین ثبت میدانی برنده. */
  const sAt = String(server.capturedAt ?? "");
  const lAt = String(local.capturedAt ?? "");
  if (sAt || lAt) {
    if (lAt > sAt) {
      return { winner: "local", needsConflictRecord: false, requiresAdjustment: false, code: "I-HRM-405", ruleFa: "هر دو پیش‌نویس‌اند؛ ثبت میدانی تازه‌تر اعمال شد" };
    }
    if (sAt > lAt) {
      return { winner: "server", needsConflictRecord: false, requiresAdjustment: false, code: "I-HRM-405", ruleFa: "هر دو پیش‌نویس‌اند؛ نسخهٔ سرور تازه‌تر است" };
    }
  }

  /* ۷) شمارندهٔ نسخه، آخرین حرف. */
  if (local.revision > server.revision) {
    return { winner: "local", needsConflictRecord: false, requiresAdjustment: false, code: "I-HRM-406", ruleFa: "شمارندهٔ نسخهٔ محلی بالاتر است" };
  }
  return { winner: "none", needsConflictRecord: false, requiresAdjustment: false, code: "I-HRM-407", ruleFa: "دو نسخه یکسان‌اند؛ کاری لازم نیست" };
}

/* ─────────── ۶. قفل دوره ─────────── */

/** آیا این تاریخ در دورهٔ قفل‌شده است؟ */
export function isDateLocked(workDate: string, locks: { PeriodCode?: string; UnlockedAt?: string | null }[]): boolean {
  const period = periodOf(workDate);
  return locks.some((l) => String(l.PeriodCode) === period && !l.UnlockedAt);
}

/** کد دوره از تاریخ — `1404-06-19` ⇒ `1404-06`. */
export function periodOf(dateIso: string): string {
  return String(dateIso).slice(0, 7);
}

export type LockCheck = {
  canLock: boolean;
  code?: string;
  messageFa?: string;
  pendingCount: number;
  postedCount: number;
};

/**
 * آیا دوره قابل بستن است؟
 *
 * دوره‌ای که برگهٔ تأییدنشده دارد بسته نمی‌شود: قفل کردن یعنی «همهٔ
 * اعداد نهایی‌اند»، و برگهٔ پیش‌نویس یعنی هنوز نیستند.
 */
export function canLockPeriod(headers: { Status?: string }[]): LockCheck {
  let pending = 0, posted = 0;
  for (const h of headers) {
    const st = String(h.Status ?? "draft");
    if (st === "posted" || st === "locked") posted++;
    else pending++;
  }
  if (headers.length === 0) {
    return { canLock: false, code: "E-HRM-120", messageFa: "دورهٔ بدون برگهٔ کارکرد بسته نمی‌شود", pendingCount: 0, postedCount: 0 };
  }
  if (pending > 0) {
    return {
      canLock: false, code: "E-HRM-121",
      messageFa: `${pending} برگه هنوز به مالی نرفته است؛ دوره پس از تعیین تکلیف همهٔ برگه‌ها بسته می‌شود`,
      pendingCount: pending, postedCount: posted,
    };
  }
  return { canLock: true, pendingCount: 0, postedCount: posted };
}

/* ─────────── ۷. سند اصلاحی ─────────── */

export type AdjustmentInput = {
  adjustmentType?: string;
  deltaHours?: number;
  reasonTextFa?: string;
  newActivityId?: string;
  newCbsId?: string;
};

export const ADJUSTMENT_TYPES = ["reverse", "reclass", "hours_correction"] as const;

export const ADJUSTMENT_TYPE_FA: Record<string, string> = {
  reverse: "ابطال",
  reclass: "تغییر مقصد هزینه",
  hours_correction: "اصلاح ساعت",
};

/**
 * اعتبارسنجی سند اصلاحی.
 *
 * قاعدهٔ محوری: ساعت اصلی + جمع جبری اصلاحیه‌ها هرگز منفی نمی‌شود.
 * اگر می‌شد، گزارش تاریخی ساعت منفی نشان می‌داد و کسی نمی‌فهمید چه
 * اتفاقی افتاده.
 */
export function validateAdjustment(
  a: AdjustmentInput,
  ctx: { originalHours: number; existingDelta?: number }
): TsIssue[] {
  const out: TsIssue[] = [];
  const type = String(a.adjustmentType ?? "");
  if (!(ADJUSTMENT_TYPES as readonly string[]).includes(type)) {
    out.push({ code: "E-HRM-130", severity: "error", field: "adjustmentType", messageFa: `نوع اصلاح باید یکی از این‌ها باشد: ${ADJUSTMENT_TYPES.map((t) => ADJUSTMENT_TYPE_FA[t]).join("، ")}` });
  }

  /* دلیل، اجباری و معنادار: «اصلاح» دلیل نیست. */
  const reason = String(a.reasonTextFa ?? "").trim();
  if (reason.length < 10) {
    out.push({ code: "E-HRM-131", severity: "error", field: "reasonTextFa", messageFa: "دلیل اصلاح باید دست‌کم ۱۰ نویسه و قابل فهم برای ممیز باشد" });
  }

  const delta = Number(a.deltaHours ?? 0);
  const prior = Number(ctx.existingDelta ?? 0);
  const result = round2(Number(ctx.originalHours ?? 0) + prior + delta);

  if (type === "reverse") {
    /* ابطال یعنی صفر کردن، نه عددی دلخواه. */
    const expected = round2(-(Number(ctx.originalHours ?? 0) + prior));
    if (round2(delta) !== expected) {
      out.push({ code: "E-HRM-132", severity: "error", field: "deltaHours", messageFa: `ابطال باید ساعت را به صفر برساند؛ مقدار درست ${expected} است` });
    }
  } else if (type === "hours_correction") {
    if (delta === 0) {
      out.push({ code: "E-HRM-133", severity: "error", field: "deltaHours", messageFa: "اصلاح ساعت با مقدار صفر معنا ندارد" });
    }
    if (result < 0) {
      out.push({ code: "E-HRM-134", severity: "error", field: "deltaHours", messageFa: `ساعت نهایی ${result} منفی می‌شود؛ اصلاح پذیرفته نیست` });
    }
  } else if (type === "reclass") {
    if (delta !== 0) {
      out.push({ code: "E-HRM-135", severity: "error", field: "deltaHours", messageFa: "تغییر مقصد هزینه، ساعت را عوض نمی‌کند؛ اختلاف ساعت باید صفر باشد" });
    }
    if (!a.newActivityId && !a.newCbsId) {
      out.push({ code: "E-HRM-136", severity: "error", messageFa: "مقصد جدید (فعالیت یا حساب هزینه) مشخص نشده است" });
    }
  }

  return out;
}

/** ساعت مؤثر یک ردیف پس از اعمال همهٔ اصلاحیه‌های تأییدشده. */
export function effectiveHours(originalHours: number, adjustments: { DeltaHours?: number; Status?: string }[]): number {
  const delta = adjustments
    .filter((a) => String(a.Status ?? "") === "approved")
    .reduce((s, a) => s + Number(a.DeltaHours ?? 0), 0);
  return Math.max(0, round2(Number(originalHours ?? 0) + delta));
}

/* ─────────── ۸. خلاصهٔ روزانه ─────────── */

export type DailySummary = {
  workDate: string;
  headerCount: number;
  headcount: number;
  totalHours: number;
  productiveHours: number;
  lostHours: number;
  lostTimePct: number | null;
  otPct: number | null;
  byStatus: Record<string, number>;
  /** برگه‌هایی که هنوز تأیید نشده‌اند و جلوی بستن دوره را می‌گیرند. */
  pendingCount: number;
};

export function dailySummary(
  workDate: string,
  headers: { Status?: string; TotalHoursRaw?: number; TotalHoursOt?: number }[],
  entries: { PersonId?: string; HoursRaw?: number; IsProductive?: boolean | number }[]
): DailySummary {
  const byStatus: Record<string, number> = {};
  let total = 0, ot = 0, pending = 0;
  for (const h of headers) {
    const st = String(h.Status ?? "draft");
    byStatus[st] = (byStatus[st] ?? 0) + 1;
    total = round2(total + Number(h.TotalHoursRaw ?? 0));
    ot = round2(ot + Number(h.TotalHoursOt ?? 0));
    if (TS_STATE_RANK[st as TsState] < TS_STATE_RANK.pm_approved) pending++;
  }

  const people = new Set<string>();
  let productive = 0, lost = 0;
  for (const e of entries) {
    const h = Number(e.HoursRaw ?? 0);
    if (!(h > 0)) continue;
    if (e.PersonId) people.add(String(e.PersonId));
    /* JSON بولین را گاهی ۰/۱ ذخیره می‌کند. */
    if (e.IsProductive === false || e.IsProductive === 0) lost = round2(lost + h);
    else productive = round2(productive + h);
  }

  const attended = round2(productive + lost);
  return {
    workDate,
    headerCount: headers.length,
    headcount: people.size,
    totalHours: total,
    productiveHours: productive,
    lostHours: lost,
    lostTimePct: attended > 0 ? round2((lost / attended) * 100) : null,
    otPct: total > 0 ? round2((ot / total) * 100) : null,
    byStatus,
    pendingCount: pending,
  };
}

/* ══════════════════════════ D5 — بهره‌وری و ریشه‌یابی ══════════════════════════
 *
 * D4 ساعت را ثبت کرد. D5 می‌پرسد آن ساعت چه چیزی تولید کرد.
 *
 * سه اصل که کل این بخش رویشان بنا شده:
 *
 * ۱) **ارزش کسب‌شده فقط از پیشرفت تأییدشده می‌آید.** پیشرفت اعلامی
 *    سرکارگر عدد امیدوارکننده‌ای است که هیچ‌کس امضا نکرده؛ اگر وارد
 *    PI شود، شاخص بهره‌وری تبدیل به آینهٔ خوش‌بینی می‌شود.
 * ۲) **ساعت غیرمولد از PI بیرون نمی‌رود، ولی جدا شمرده می‌شود.** اگر
 *    بیرونش کنیم، بهره‌وری کاذب بالا می‌رود؛ اگر جدا نشماریم، مبنای
 *    ادعای تأخیر از بین می‌رود.
 * ۳) **عدد بدون علت، گزارش نیست.** افت زیر آستانه بدون ریشه‌یابی
 *    ثبت‌شده، «قرمز بی‌صاحب» است و در دروازهٔ نهایی رد می‌شود.
 */

/* ─────────── ۱. کاتالوگ علت افت ─────────── */

export const RCA_CATEGORIES = [
  "material", "equipment", "drawing", "permit", "weather",
  "rework", "access", "manpower_skill", "client_delay", "hse_stop",
] as const;
export type RcaCategory = (typeof RCA_CATEGORIES)[number];

export type RcaReason = {
  code: string;
  fa: string;
  en: string;
  category: RcaCategory;
  /** آیا این علت مبنای ادعای قراردادی است؟ تصمیم قراردادی، نه فنی. */
  isClaimable: boolean;
  /** دامنه‌ای که مالک رفع این علت است — برای ارجاع کارتابل. */
  ownerDomain: string;
};

/**
 * کاتالوگ علت‌ها.
 *
 * `isClaimable` فقط برای علت‌هایی روشن است که ریشه‌شان **بیرون از
 * کنترل پیمانکار** است. «مهارت ناکافی» و «دوباره‌کاری» ادعاپذیر
 * نیستند حتی اگر پرهزینه باشند — این خط، مرز صداقت گزارش است.
 */
export const RCA_CATALOG: RcaReason[] = [
  { code: "RCA-MAT-01", fa: "نرسیدن مصالح به پای کار", en: "Material not at workface", category: "material", isClaimable: true, ownerDomain: "d12" },
  { code: "RCA-MAT-02", fa: "مصالح معیوب یا مردود", en: "Defective material", category: "material", isClaimable: true, ownerDomain: "d8" },
  { code: "RCA-EQP-01", fa: "خرابی ماشین‌آلات", en: "Equipment breakdown", category: "equipment", isClaimable: false, ownerDomain: "d9" },
  { code: "RCA-EQP-02", fa: "در دسترس نبودن جرثقیل یا بالابر", en: "Lifting equipment unavailable", category: "equipment", isClaimable: false, ownerDomain: "d9" },
  { code: "RCA-DWG-01", fa: "نبود نقشهٔ تأییدشده برای اجرا", en: "No IFC drawing", category: "drawing", isClaimable: true, ownerDomain: "d12" },
  { code: "RCA-DWG-02", fa: "تغییر نقشه پس از شروع کار", en: "Drawing revised after start", category: "drawing", isClaimable: true, ownerDomain: "d12" },
  { code: "RCA-PRM-01", fa: "تأخیر در صدور پروانهٔ کار", en: "Work permit delay", category: "permit", isClaimable: false, ownerDomain: "d16" },
  { code: "RCA-WTR-01", fa: "شرایط جوی نامساعد", en: "Adverse weather", category: "weather", isClaimable: true, ownerDomain: "d10" },
  { code: "RCA-RWK-01", fa: "دوباره‌کاری ناشی از عدم انطباق", en: "Rework from NCR", category: "rework", isClaimable: false, ownerDomain: "d8" },
  { code: "RCA-ACC-01", fa: "نبود جبههٔ کاری آماده", en: "No available work front", category: "access", isClaimable: true, ownerDomain: "d2" },
  { code: "RCA-ACC-02", fa: "تداخل با پیمانکار دیگر", en: "Interface clash with another contractor", category: "access", isClaimable: true, ownerDomain: "d14" },
  { code: "RCA-SKL-01", fa: "مهارت ناکافی نیرو", en: "Insufficient crew skill", category: "manpower_skill", isClaimable: false, ownerDomain: "d10" },
  { code: "RCA-SKL-02", fa: "ترکیب نامناسب اکیپ", en: "Wrong crew composition", category: "manpower_skill", isClaimable: false, ownerDomain: "d10" },
  { code: "RCA-CLD-01", fa: "تأخیر در تصمیم کارفرما", en: "Client decision delay", category: "client_delay", isClaimable: true, ownerDomain: "d11" },
  { code: "RCA-CLD-02", fa: "تأخیر در تحویل زمین یا دسترسی", en: "Site access handover delay", category: "client_delay", isClaimable: true, ownerDomain: "d11" },
  { code: "RCA-HSE-01", fa: "توقف کار به دستور ایمنی", en: "HSE stop-work order", category: "hse_stop", isClaimable: false, ownerDomain: "d16" },
];

export const RCA_BY_CODE: Record<string, RcaReason> = Object.fromEntries(
  RCA_CATALOG.map((r) => [r.code, r])
);

export const RCA_CATEGORY_FA: Record<RcaCategory, string> = {
  material: "مصالح",
  equipment: "ماشین‌آلات",
  drawing: "نقشه و مدرک",
  permit: "پروانهٔ کار",
  weather: "شرایط جوی",
  rework: "دوباره‌کاری",
  access: "دسترسی و جبهه",
  manpower_skill: "مهارت نیرو",
  client_delay: "تأخیر کارفرما",
  hse_stop: "توقف ایمنی",
};

/* ─────────── ۲. آستانه‌ها و متریک‌ها ─────────── */

/**
 * آستانه‌های وضعیت PI.
 *
 * ۰٫۸۵ عدد دلبخواه نیست: زیر آن، انحراف از بودجهٔ نفر-ساعت آن‌قدر
 * بزرگ می‌شود که با اضافه‌کاری جبران نمی‌شود و باید برنامه بازنگری شود.
 */
export const PI_THRESHOLD = { red: 0.85, amber: 1.0 } as const;

/** حداقل تعداد دوره برای اینکه نرخ استاندارد «کالیبره» شمرده شود (H-15). */
export const CALIBRATION_MIN_PERIODS = 3;

export const METRIC_CODES = ["PI", "PF", "OT_PCT", "LOST_PCT", "UNIT_RATE_VAR", "RCA_COVERAGE"] as const;
export type MetricCode = (typeof METRIC_CODES)[number];

export const METRIC_FA: Record<MetricCode, string> = {
  PI: "شاخص بهره‌وری",
  PF: "ضریب عملکرد",
  OT_PCT: "سهم اضافه‌کاری",
  LOST_PCT: "سهم زمان تلف‌شده",
  UNIT_RATE_VAR: "انحراف نرخ اجرا",
  RCA_COVERAGE: "پوشش ریشه‌یابی",
};

export type ProdStatus = "green" | "amber" | "red" | "na";

/** وضعیت رنگی از روی PI — یک تابع، تا هیچ‌جا آستانه دوباره نوشته نشود. */
export function piStatus(pi: number, hasData = true): ProdStatus {
  if (!hasData || !(pi > 0)) return "na";
  if (pi < PI_THRESHOLD.red) return "red";
  if (pi < PI_THRESHOLD.amber) return "amber";
  return "green";
}

/* ─────────── ۳. اثر انگشت ورودی ─────────── */

/**
 * هش پایدار ورودی محاسبه.
 *
 * کلیدها مرتب می‌شوند تا ترتیب صفت‌ها روی هش اثر نگذارد؛ بدون این،
 * دو محاسبه با دادهٔ یکسان هش متفاوت می‌گرفتند و «تغییر نکرده» هرگز
 * تشخیص داده نمی‌شد.
 */
export function stableStringify(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }
  if (typeof v === "number") return String(round2(v));
  return JSON.stringify(v);
}

/** هش ۵۲ بیتی به‌صورت هگز — برای تشخیص تغییر کافی است، رمزنگاری نیست. */
export function inputHash(v: unknown): string {
  const s = stableStringify(v);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + ch + i, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

/* ─────────── ۴. موتور بهره‌وری ─────────── */

export type ProdEntryRow = {
  activityId: string;
  tradeCode?: string;
  cbsId?: string;
  hoursRaw: number;
  isProductive: boolean;
  qtyDone?: number;
  qtyUom?: string;
};

export type ProdActivityInput = {
  activityId: string;
  budgetMh: number;
  /** درصد پیشرفت **تأییدشده**. اگر تأیید نشده، اصلاً نفرست. */
  approvedProgressPct: number;
  tradeCode?: string;
  cbsId?: string;
  qtyUom?: string;
};

export type ProductivityRow = {
  activityId: string;
  periodCode: string;
  tradeCode?: string;
  cbsId?: string;
  budgetMh: number;
  earnedMh: number;
  actualMh: number;
  /** ساعت غیرمولد؛ داخل actualMh هست ولی جدا هم گزارش می‌شود. */
  lostMh: number;
  approvedProgressPct: number;
  pi: number;
  pf: number;
  qtyDone?: number;
  qtyUom?: string;
  unitRate?: number;
  stdRate?: number;
  variancePct?: number;
  isCalibrated: boolean;
  trend: "improving" | "stable" | "declining";
  status: ProdStatus;
  inputHash: string;
};

/**
 * محاسبهٔ بهره‌وری برای یک دوره.
 *
 * `priorPi` روند را می‌سازد. بدون آن، هر دوره یک عکس منفرد است و
 * «رو به بهبود» از «رو به افت» تشخیص داده نمی‌شود — که دقیقاً همان
 * چیزی است که مدیر پروژه می‌خواهد بداند.
 */
export function computeProductivity(
  activities: ProdActivityInput[],
  entries: ProdEntryRow[],
  periodCode: string,
  opts: {
    priorPi?: Record<string, number>;
    calibratedTrades?: string[];
    stdRates?: Record<string, number>;
  } = {}
): ProductivityRow[] {
  const prior = opts.priorPi ?? {};
  const calibrated = new Set(opts.calibratedTrades ?? []);

  const byActivity = new Map<string, ProdEntryRow[]>();
  for (const e of entries) {
    const k = String(e.activityId ?? "");
    if (!k) continue;
    if (!byActivity.has(k)) byActivity.set(k, []);
    byActivity.get(k)!.push(e);
  }

  const out: ProductivityRow[] = [];
  for (const a of activities) {
    const rows = byActivity.get(a.activityId) ?? [];
    let actual = 0, lost = 0, qty = 0, hasQty = false;
    for (const e of rows) {
      const h = Number(e.hoursRaw ?? 0);
      if (!(h > 0)) continue;
      actual = round2(actual + h);
      if (!e.isProductive) lost = round2(lost + h);
      if (typeof e.qtyDone === "number" && Number.isFinite(e.qtyDone)) {
        qty = round2(qty + e.qtyDone);
        hasQty = true;
      }
    }

    const pct = clamp(Number(a.approvedProgressPct ?? 0), 0, 100);
    const budget = round2(Number(a.budgetMh ?? 0));
    const earned = round2((budget * pct) / 100);
    const pi = actual > 0 ? round3(earned / actual) : 0;
    const pf = pi > 0 ? round3(1 / pi) : 0;

    const trade = a.tradeCode ?? rows.find((r) => r.tradeCode)?.tradeCode;
    const std = trade
      ? (opts.stdRates?.[trade] ?? TRADE_BY_CODE[trade]?.stdRate)
      : undefined;
    const rate = hasQty && actual > 0 ? round3(qty / actual) : undefined;
    const variance = rate !== undefined && std && std > 0
      ? round2(((rate - std) / std) * 100)
      : undefined;

    /* روند فقط وقتی معنا دارد که دورهٔ قبل هم عددی داشته باشد؛
     * وگرنه «پایدار» می‌گوییم نه «بهبود». */
    const p0 = prior[a.activityId];
    const trend = typeof p0 === "number" && p0 > 0 && pi > 0
      ? (pi > p0 * 1.05 ? "improving" : pi < p0 * 0.95 ? "declining" : "stable")
      : "stable";

    out.push({
      activityId: a.activityId,
      periodCode,
      tradeCode: trade,
      cbsId: a.cbsId ?? rows.find((r) => r.cbsId)?.cbsId,
      budgetMh: budget,
      earnedMh: earned,
      actualMh: actual,
      lostMh: lost,
      approvedProgressPct: pct,
      pi,
      pf,
      qtyDone: hasQty ? qty : undefined,
      qtyUom: a.qtyUom ?? rows.find((r) => r.qtyUom)?.qtyUom,
      unitRate: rate,
      stdRate: std,
      variancePct: variance,
      isCalibrated: trade ? calibrated.has(trade) : false,
      trend,
      status: piStatus(pi, actual > 0),
      inputHash: inputHash({ a: a.activityId, p: periodCode, b: budget, g: pct, h: actual, l: lost, q: hasQty ? qty : null }),
    });
  }

  return out.sort((x, y) => x.activityId.localeCompare(y.activityId));
}

/* ─────────── ۵. تجمیع دوره ─────────── */

export type ProdSummary = {
  periodCode: string;
  activityCount: number;
  budgetMh: number;
  earnedMh: number;
  actualMh: number;
  lostMh: number;
  /** PI کل = Σearned / Σactual، نه میانگین PIها. */
  pi: number;
  pf: number;
  lostPct: number | null;
  redCount: number;
  amberCount: number;
  greenCount: number;
  worstPi: number | null;
  worstActivityId: string | null;
  /** درصد فعالیت‌های قرمزی که ریشه‌یابی ثبت‌شده دارند. */
  rcaCoveragePct: number | null;
  unexplainedRed: string[];
};

/**
 * جمع دوره.
 *
 * PI کل **میانگین وزنی** است نه میانگین ساده: یک فعالیت ۱۰ ساعته با
 * PI=۰٫۲ نباید همان وزن فعالیت ۱۰۰۰ ساعته با PI=۱٫۱ را داشته باشد.
 */
export function productivitySummary(
  rows: ProductivityRow[],
  explainedActivityIds: string[] = []
): ProdSummary {
  const explained = new Set(explainedActivityIds);
  let budget = 0, earned = 0, actual = 0, lost = 0;
  let red = 0, amber = 0, green = 0;
  let worst: ProductivityRow | null = null;
  const unexplained: string[] = [];

  for (const r of rows) {
    budget = round2(budget + r.budgetMh);
    earned = round2(earned + r.earnedMh);
    actual = round2(actual + r.actualMh);
    lost = round2(lost + r.lostMh);
    if (r.status === "red") {
      red++;
      if (!explained.has(r.activityId)) unexplained.push(r.activityId);
    } else if (r.status === "amber") amber++;
    else if (r.status === "green") green++;
    if (r.pi > 0 && (worst === null || r.pi < worst.pi)) worst = r;
  }

  const pi = actual > 0 ? round3(earned / actual) : 0;
  return {
    periodCode: rows[0]?.periodCode ?? "",
    activityCount: rows.length,
    budgetMh: budget,
    earnedMh: earned,
    actualMh: actual,
    lostMh: lost,
    pi,
    pf: pi > 0 ? round3(1 / pi) : 0,
    lostPct: actual > 0 ? round2((lost / actual) * 100) : null,
    redCount: red,
    amberCount: amber,
    greenCount: green,
    worstPi: worst ? worst.pi : null,
    worstActivityId: worst ? worst.activityId : null,
    rcaCoveragePct: red > 0 ? round2(((red - unexplained.length) / red) * 100) : null,
    unexplainedRed: unexplained.sort(),
  };
}

/** تجمیع بهره‌وری بر حسب رسته — برای پیدا کردن رستهٔ مشکل‌دار. */
export function productivityByTrade(rows: ProductivityRow[]) {
  const m = new Map<string, { tradeCode: string; earnedMh: number; actualMh: number; lostMh: number; activityCount: number }>();
  for (const r of rows) {
    const k = r.tradeCode ?? "—";
    if (!m.has(k)) m.set(k, { tradeCode: k, earnedMh: 0, actualMh: 0, lostMh: 0, activityCount: 0 });
    const g = m.get(k)!;
    g.earnedMh = round2(g.earnedMh + r.earnedMh);
    g.actualMh = round2(g.actualMh + r.actualMh);
    g.lostMh = round2(g.lostMh + r.lostMh);
    g.activityCount++;
  }
  return [...m.values()]
    .map((g) => {
      const pi = g.actualMh > 0 ? round3(g.earnedMh / g.actualMh) : 0;
      return {
        ...g,
        pi,
        status: piStatus(pi, g.actualMh > 0),
        tradeFa: TRADE_BY_CODE[g.tradeCode]?.fa ?? g.tradeCode,
      };
    })
    .sort((a, b) => a.pi - b.pi);
}

/* ─────────── ۶. ریشه‌یابی ─────────── */

export type RcaInput = {
  activityId: string;
  periodCode: string;
  reasonCode: string;
  sharePct?: number;
  lostMh?: number;
  noteFa?: string;
};

/**
 * اعتبارسنجی یک ثبت ریشه‌یابی.
 *
 * یادداشت اجباری است چون کد علت به تنهایی در جلسهٔ ادعا بی‌فایده
 * است: «نرسیدن مصالح» بدون «کدام مصالح، از کی» قابل دفاع نیست.
 */
export function validateRca(input: RcaInput, existingShare = 0): TsIssue[] {
  const out: TsIssue[] = [];
  const reason = RCA_BY_CODE[String(input.reasonCode ?? "")];
  if (!reason) {
    out.push({ code: "E-HRM-140", severity: "error", field: "reasonCode", messageFa: "کد علت در کاتالوگ نیست" });
  }
  const share = input.sharePct === undefined ? 100 : Number(input.sharePct);
  if (!(share > 0) || share > 100) {
    out.push({ code: "E-HRM-141", severity: "error", field: "sharePct", messageFa: "سهم علت باید بین ۱ تا ۱۰۰ درصد باشد" });
  } else if (round2(existingShare + share) > 100) {
    out.push({
      code: "E-HRM-142",
      severity: "error",
      field: "sharePct",
      messageFa: `جمع سهم علت‌ها از ۱۰۰٪ بیشتر می‌شود (ثبت‌شده: ${round2(existingShare)}٪)`,
    });
  }
  const note = String(input.noteFa ?? "").trim();
  if (note.length < 10) {
    out.push({ code: "E-HRM-143", severity: "error", field: "noteFa", messageFa: "شرح علت باید دست‌کم ۱۰ نویسه باشد" });
  }
  if (input.lostMh !== undefined && Number(input.lostMh) < 0) {
    out.push({ code: "E-HRM-144", severity: "error", field: "lostMh", messageFa: "ساعت تلف‌شده منفی نمی‌شود" });
  }
  if (!String(input.activityId ?? "").trim()) {
    out.push({ code: "E-HRM-145", severity: "error", field: "activityId", messageFa: "فعالیت الزامی است" });
  }
  if (!String(input.periodCode ?? "").trim()) {
    out.push({ code: "E-HRM-146", severity: "error", field: "periodCode", messageFa: "دوره الزامی است" });
  }
  return out;
}

/**
 * آیا این ریشه‌یابی می‌تواند به ادعا تبدیل شود؟
 *
 * سه شرط: علت ادعاپذیر باشد، ساعت تلف‌شده صفر نباشد، و قبلاً ادعا
 * نشده باشد. شرط سوم مهم‌ترین است — ادعای دوباره روی یک رویداد،
 * اعتبار کل پروندهٔ ادعا را نزد کارفرما از بین می‌برد.
 */
export function canRaiseClaim(entry: { ReasonCode?: string; LostMh?: number; ClaimRef?: string | null; Status?: string }): {
  ok: boolean;
  code?: string;
  messageFa?: string;
} {
  const reason = RCA_BY_CODE[String(entry.ReasonCode ?? "")];
  if (!reason) return { ok: false, code: "E-HRM-140", messageFa: "کد علت شناخته نشد" };
  if (!reason.isClaimable) {
    return { ok: false, code: "E-HRM-147", messageFa: `علت «${reason.fa}» ادعاپذیر نیست؛ ریشهٔ آن درون کنترل پیمانکار است` };
  }
  if (!(Number(entry.LostMh ?? 0) > 0)) {
    return { ok: false, code: "E-HRM-148", messageFa: "بدون ساعت تلف‌شده، ادعا مبنای کمّی ندارد" };
  }
  if (entry.ClaimRef) {
    return { ok: false, code: "E-HRM-149", messageFa: `این رویداد قبلاً در ادعای ${entry.ClaimRef} استفاده شده است` };
  }
  return { ok: true };
}

/** تجمیع ریشه‌یابی بر حسب دسته — نمای «کجا بیشترین ساعت را باختیم». */
export function rcaRollup(entries: { ReasonCode?: string; LostMh?: number; ClaimRef?: string | null }[]) {
  const m = new Map<string, { category: RcaCategory; categoryFa: string; lostMh: number; count: number; claimableMh: number; claimedMh: number }>();
  for (const e of entries) {
    const reason = RCA_BY_CODE[String(e.ReasonCode ?? "")];
    if (!reason) continue;
    const k = reason.category;
    if (!m.has(k)) m.set(k, { category: k, categoryFa: RCA_CATEGORY_FA[k], lostMh: 0, count: 0, claimableMh: 0, claimedMh: 0 });
    const g = m.get(k)!;
    const h = round2(Number(e.LostMh ?? 0));
    g.lostMh = round2(g.lostMh + h);
    g.count++;
    if (reason.isClaimable) g.claimableMh = round2(g.claimableMh + h);
    if (e.ClaimRef) g.claimedMh = round2(g.claimedMh + h);
  }
  return [...m.values()].sort((a, b) => b.lostMh - a.lostMh);
}

/* ─────────── ۷. کالیبراسیون نرخ استاندارد (H-15) ─────────── */

export type RateObservation = { tradeCode: string; periodCode: string; qty: number; hours: number };

/**
 * کالیبراسیون نرخ استاندارد از دادهٔ واقعی.
 *
 * تا پیش از سه دوره، نرخ مرجع کاتالوگ با برچسب «کالیبره‌نشده»
 * برگردانده می‌شود. نمایش نرخ کالیبره‌نشده به‌عنوان حقیقت، بدترین
 * نوع دروغ آماری است: عددی که دقیق به نظر می‌رسد ولی پشتش داده نیست.
 */
export function calibrateStdRate(observations: RateObservation[], minPeriods = CALIBRATION_MIN_PERIODS) {
  const byTrade = new Map<string, { periods: Set<string>; qty: number; hours: number }>();
  for (const o of observations) {
    const t = String(o.tradeCode ?? "");
    if (!t || !(Number(o.hours) > 0)) continue;
    if (!byTrade.has(t)) byTrade.set(t, { periods: new Set(), qty: 0, hours: 0 });
    const g = byTrade.get(t)!;
    g.periods.add(String(o.periodCode));
    g.qty = round2(g.qty + Number(o.qty ?? 0));
    g.hours = round2(g.hours + Number(o.hours));
  }

  return [...byTrade.entries()]
    .map(([tradeCode, g]) => {
      const observed = g.hours > 0 ? round3(g.qty / g.hours) : 0;
      const catalog = TRADE_BY_CODE[tradeCode]?.stdRate;
      const ok = g.periods.size >= minPeriods && observed > 0;
      return {
        tradeCode,
        tradeFa: TRADE_BY_CODE[tradeCode]?.fa ?? tradeCode,
        periodCount: g.periods.size,
        observedRate: observed,
        catalogRate: catalog,
        /* نرخ مؤثر: کالیبره‌شده اگر داده کافی باشد، وگرنه کاتالوگ. */
        effectiveRate: ok ? observed : catalog,
        isCalibrated: ok,
        driftPct: ok && catalog && catalog > 0 ? round2(((observed - catalog) / catalog) * 100) : undefined,
      };
    })
    .sort((a, b) => a.tradeCode.localeCompare(b.tradeCode));
}

/* ─────────── ۸. عکس متریک و دروازهٔ نهایی‌سازی ─────────── */

export type MetricSnapshotRow = {
  metricCode: MetricCode;
  dimension: "project" | "trade" | "activity";
  dimensionId: string | null;
  value: number;
  target: number | null;
  status: ProdStatus;
  inputHash: string;
};

/** ساخت مجموعهٔ عکس متریک از جمع دوره — ورودی تابلوی KPI و MON. */
export function buildMetricSnapshots(
  summary: ProdSummary,
  byTrade: ReturnType<typeof productivityByTrade>,
  extra: { otPct?: number | null } = {}
): MetricSnapshotRow[] {
  const out: MetricSnapshotRow[] = [];
  const push = (metricCode: MetricCode, dimension: MetricSnapshotRow["dimension"], dimensionId: string | null, value: number, target: number | null, status: ProdStatus) => {
    out.push({ metricCode, dimension, dimensionId, value: round3(value), target, status, inputHash: inputHash({ metricCode, dimension, dimensionId, value: round3(value) }) });
  };

  push("PI", "project", null, summary.pi, 1, piStatus(summary.pi, summary.actualMh > 0));
  push("PF", "project", null, summary.pf, 1, summary.pf === 0 ? "na" : summary.pf > 1.18 ? "red" : summary.pf > 1 ? "amber" : "green");
  if (summary.lostPct !== null) {
    push("LOST_PCT", "project", null, summary.lostPct, 5, summary.lostPct > 10 ? "red" : summary.lostPct > 5 ? "amber" : "green");
  }
  if (extra.otPct !== undefined && extra.otPct !== null) {
    push("OT_PCT", "project", null, extra.otPct, 15, extra.otPct > 25 ? "red" : extra.otPct > 15 ? "amber" : "green");
  }
  if (summary.rcaCoveragePct !== null) {
    push("RCA_COVERAGE", "project", null, summary.rcaCoveragePct, 100, summary.rcaCoveragePct >= 100 ? "green" : summary.rcaCoveragePct >= 60 ? "amber" : "red");
  }
  for (const t of byTrade) {
    if (t.tradeCode === "—") continue;
    push("PI", "trade", t.tradeCode, t.pi, 1, t.status);
  }
  return out;
}

/**
 * دروازهٔ نهایی‌سازی دوره.
 *
 * چهار چیز جلوی نهایی شدن را می‌گیرد؛ همه از یک جنس‌اند: عددی که
 * نمی‌توان از آن دفاع کرد نباید در گزارش رسمی قفل شود.
 */
export function canFinalizeProductivity(input: {
  rows: ProductivityRow[];
  summary: ProdSummary;
  alreadyFinal?: boolean;
  timesheetPending?: number;
}): { ok: boolean; code?: string; messageFa?: string; detailsFa?: string[] } {
  const details: string[] = [];
  if (input.alreadyFinal) {
    return { ok: false, code: "E-HRM-150", messageFa: "این دوره قبلاً نهایی شده و تغییرناپذیر است" };
  }
  if (input.rows.length === 0) {
    return { ok: false, code: "E-HRM-151", messageFa: "دورهٔ بدون فعالیت نهایی نمی‌شود" };
  }
  if ((input.timesheetPending ?? 0) > 0) {
    details.push(`${input.timesheetPending} برگهٔ کارکرد هنوز تأیید نشده است`);
  }
  if (input.summary.unexplainedRed.length > 0) {
    details.push(`${input.summary.unexplainedRed.length} فعالیت قرمز بدون ریشه‌یابی: ${input.summary.unexplainedRed.slice(0, 5).join("، ")}`);
  }
  if (input.summary.actualMh <= 0) {
    details.push("ساعت واقعی صفر است؛ محاسبهٔ بهره‌وری مبنا ندارد");
  }
  if (details.length > 0) {
    return { ok: false, code: "E-HRM-152", messageFa: "دوره آمادهٔ نهایی شدن نیست", detailsFa: details };
  }
  return { ok: true };
}

/** آیا عکس متریک نهایی‌شده قابل بازنویسی است؟ پاسخ همیشه خیر (ADR-11). */
export function canOverwriteSnapshot(snap: { IsFinal?: boolean | number }): boolean {
  return !(snap.IsFinal === true || snap.IsFinal === 1);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/* ══════════════════════════ D6 — اکیپ و نیروی پیمانکاری ══════════════════════════
 *
 * دو دنیای موازی که عمداً جدا نگه داشته شده‌اند:
 *
 *   نیروی مستقیم → عضویت در اکیپ → برگهٔ کارکرد فردی → دستمزد
 *   نیروی پیمانکاری → حضور گروهی → صورت‌کارکرد → صورت‌وضعیت پیمانکار
 *
 * قاطی کردنشان تنها راهی است که نفر-ساعت دوبار شمرده می‌شود: یک بار
 * در تایم‌شیت فردی و یک بار در حضور گروهی. `assertNoDoubleCount` دقیقاً
 * برای بستن همین در نوشته شده است.
 *
 * سه قاعدهٔ ثابت:
 *   ۱) یک نفر در یک روز فقط در یک اکیپ فعال است (T-4).
 *   ۲) جمع درصد تخصیص یک نفر در یک روز ≤ ۱۰۰ (T-1).
 *   ۳) اکیپ بدون سرپرست فعال نمی‌شود — برگهٔ بی‌امضا معنا ندارد.
 */

/* ─────────── ۱. نقش در اکیپ و ترکیب ─────────── */

export const CREW_ROLES = ["foreman", "skilled", "helper", "operator"] as const;
export type CrewRole = (typeof CREW_ROLES)[number];

export const CREW_ROLE_FA: Record<CrewRole, string> = {
  foreman: "سرپرست",
  skilled: "استادکار",
  helper: "کمکی",
  operator: "اپراتور",
};

export const CREW_STATUSES = ["forming", "active", "disbanded"] as const;
export type CrewStatus = (typeof CREW_STATUSES)[number];

export const CREW_STATUS_FA: Record<CrewStatus, string> = {
  forming: "در حال تشکیل",
  active: "فعال",
  disbanded: "منحل‌شده",
};

/** نسبت متعارف استادکار به کمکی؛ خروج از این بازه هشدار ترکیب است. */
export const CREW_SKILL_RATIO = { min: 0.8, max: 3 } as const;

/** حداکثر نفرات یک اکیپ که یک سرپرست بتواند واقعاً کنترل کند. */
export const CREW_MAX_SPAN = 25;

export type CrewMemberRow = {
  personId: string;
  roleInCrew: string;
  tradeCode?: string;
  fromDate: string;
  toDate?: string | null;
  allocationPct?: number;
  status?: string;
};

/** آیا عضویت در این تاریخ فعال است؟ بازهٔ باز یعنی همچنان عضو. */
export function isMemberActiveOn(m: CrewMemberRow, dateIso: string): boolean {
  if (String(m.status ?? "active") !== "active") return false;
  if (String(m.fromDate) > dateIso) return false;
  if (m.toDate && String(m.toDate) < dateIso) return false;
  return true;
}

export type CrewComposition = {
  headcount: number;
  byRole: Record<string, number>;
  byTrade: Record<string, number>;
  foremanCount: number;
  skillRatio: number | null;
  /** جمع درصد تخصیص ÷ ۱۰۰ — نفرِ معادلِ تمام‌وقت. */
  fte: number;
  issues: TsIssue[];
};

/**
 * ترکیب واقعی اکیپ در یک تاریخ.
 *
 * `fte` از `headcount` جدا شده چون ده نفرِ نیمه‌وقت، ده نفر نیست؛
 * برنامه‌ریزی با سرشماری و هزینه با FTE بسته می‌شود.
 */
export function crewComposition(
  members: CrewMemberRow[],
  dateIso: string,
  target: { size?: number; mix?: Record<string, number> } = {}
): CrewComposition {
  const active = members.filter((m) => isMemberActiveOn(m, dateIso));
  const byRole: Record<string, number> = {};
  const byTrade: Record<string, number> = {};
  let fte = 0;

  for (const m of active) {
    const role = String(m.roleInCrew ?? "skilled");
    byRole[role] = (byRole[role] ?? 0) + 1;
    if (m.tradeCode) byTrade[m.tradeCode] = (byTrade[m.tradeCode] ?? 0) + 1;
    fte = round2(fte + clamp(Number(m.allocationPct ?? 100), 0, 100) / 100);
  }

  const skilled = byRole.skilled ?? 0;
  const helper = byRole.helper ?? 0;
  const foremanCount = byRole.foreman ?? 0;
  const issues: TsIssue[] = [];

  if (active.length === 0) {
    issues.push({ code: "W-HRM-501", severity: "warning", messageFa: "اکیپ در این تاریخ عضو فعالی ندارد" });
  }
  if (foremanCount === 0 && active.length > 0) {
    issues.push({ code: "E-HRM-160", severity: "error", field: "roleInCrew", messageFa: "اکیپ سرپرست فعال ندارد؛ برگهٔ کارکرد بدون امضای سرپرست معتبر نیست" });
  }
  if (foremanCount > 1) {
    issues.push({ code: "W-HRM-502", severity: "warning", messageFa: `${foremanCount} سرپرست هم‌زمان — مسئولیت امضا مبهم می‌شود` });
  }
  if (active.length > CREW_MAX_SPAN) {
    issues.push({ code: "W-HRM-503", severity: "warning", messageFa: `${active.length} نفر زیر یک سرپرست بیش از حد کنترل‌پذیر (${CREW_MAX_SPAN}) است` });
  }

  const ratio = helper > 0 ? round2(skilled / helper) : null;
  if (ratio !== null && (ratio < CREW_SKILL_RATIO.min || ratio > CREW_SKILL_RATIO.max)) {
    issues.push({
      code: "W-HRM-504",
      severity: "warning",
      messageFa: ratio < CREW_SKILL_RATIO.min
        ? `نسبت استادکار به کمکی ${ratio} پایین است؛ کیفیت و دوباره‌کاری در خطر است`
        : `نسبت استادکار به کمکی ${ratio} بالاست؛ نیروی گران روی کار ساده می‌رود`,
    });
  }

  if (target.size && target.size > 0) {
    const gap = active.length - target.size;
    if (Math.abs(gap) > 0) {
      issues.push({
        code: gap < 0 ? "W-HRM-505" : "W-HRM-506",
        severity: "warning",
        messageFa: gap < 0
          ? `${Math.abs(gap)} نفر کمتر از اندازهٔ هدف (${target.size})`
          : `${gap} نفر بیشتر از اندازهٔ هدف (${target.size})`,
      });
    }
  }

  if (target.mix) {
    for (const [trade, want] of Object.entries(target.mix)) {
      const have = byTrade[trade] ?? 0;
      if (have < Number(want)) {
        issues.push({
          code: "W-HRM-507",
          severity: "warning",
          messageFa: `رستهٔ ${trade}: ${have} نفر در برابر ${want} نفرِ هدف`,
        });
      }
    }
  }

  return { headcount: active.length, byRole, byTrade, foremanCount, skillRatio: ratio, fte, issues };
}

/* ─────────── ۲. تعارض عضویت ─────────── */

export type MembershipSpan = {
  crewId: string;
  personId: string;
  fromDate: string;
  toDate?: string | null;
  allocationPct?: number;
  status?: string;
};

/** آیا دو بازه همپوشانی دارند؟ بازهٔ باز تا ابد ادامه دارد. */
export function spansOverlap(a: MembershipSpan, b: MembershipSpan): boolean {
  const aEnd = a.toDate ?? "9999-12-31";
  const bEnd = b.toDate ?? "9999-12-31";
  return String(a.fromDate) <= bEnd && String(b.fromDate) <= aEnd;
}

/**
 * اعتبارسنجی افزودن عضو تازه.
 *
 * دو قید T-1 و T-4 اینجا اجرا می‌شوند. جدا نکردنشان یک اشتباه رایج
 * است: عضویت هم‌زمان در دو اکیپ **ممنوع** است (T-4)، ولی تخصیص
 * جزئی روی یک اکیپ **مجاز** است تا وقتی جمع از ۱۰۰ نگذرد (T-1).
 */
export function validateMembership(
  candidate: MembershipSpan,
  existing: MembershipSpan[]
): TsIssue[] {
  const out: TsIssue[] = [];
  const from = String(candidate.fromDate ?? "");
  const to = candidate.toDate ? String(candidate.toDate) : null;

  if (!String(candidate.personId ?? "").trim()) {
    out.push({ code: "E-HRM-161", severity: "error", field: "personId", messageFa: "شناسهٔ نفر الزامی است" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    out.push({ code: "E-HRM-162", severity: "error", field: "fromDate", messageFa: "تاریخ شروع عضویت نامعتبر است" });
  }
  if (to && to < from) {
    out.push({ code: "E-HRM-163", severity: "error", field: "toDate", messageFa: "تاریخ پایان پیش از تاریخ شروع است" });
  }

  const alloc = candidate.allocationPct === undefined ? 100 : Number(candidate.allocationPct);
  if (!(alloc > 0) || alloc > 100) {
    out.push({ code: "E-HRM-164", severity: "error", field: "allocationPct", messageFa: "درصد تخصیص باید بین ۱ تا ۱۰۰ باشد" });
  }

  const live = existing.filter(
    (e) => String(e.personId) === String(candidate.personId)
      && String(e.status ?? "active") === "active"
      && spansOverlap(candidate, e)
  );

  /* T-4: اکیپ متفاوت در بازهٔ همپوشان ⇒ ساعت این نفر بین دو برگه
   * دوبار شمرده می‌شود. */
  const otherCrew = live.filter((e) => String(e.crewId) !== String(candidate.crewId));
  if (otherCrew.length > 0) {
    out.push({
      code: "E-HRM-165",
      severity: "error",
      field: "crewId",
      personId: String(candidate.personId),
      messageFa: `این نفر در همین بازه عضو اکیپ ${otherCrew.map((x) => x.crewId).join("، ")} است؛ عضویت هم‌زمان در دو اکیپ نفر-ساعت را دوبار می‌شمارد`,
    });
  }

  /* T-1: جمع تخصیص همپوشان از ۱۰۰ نگذرد. */
  const sum = live.reduce((s, e) => s + Number(e.allocationPct ?? 100), 0);
  if (round2(sum + alloc) > 100) {
    out.push({
      code: "E-HRM-166",
      severity: "error",
      field: "allocationPct",
      personId: String(candidate.personId),
      messageFa: `جمع تخصیص این نفر ${round2(sum + alloc)}٪ می‌شود؛ سقف ۱۰۰٪ است`,
    });
  }

  const sameCrew = live.filter((e) => String(e.crewId) === String(candidate.crewId));
  if (sameCrew.length > 0) {
    out.push({
      code: "W-HRM-508",
      severity: "warning",
      personId: String(candidate.personId),
      messageFa: "این نفر از قبل در همین اکیپ عضویت فعال دارد؛ رکورد تازه تاریخچه را دوتکه می‌کند",
    });
  }

  return out;
}

/* ─────────── ۳. گذار حالت اکیپ ─────────── */

export type CrewGateResult = { ok: boolean; code?: string; messageFa?: string; detailsFa?: string[] };

/**
 * دروازهٔ فعال‌سازی اکیپ.
 *
 * اکیپ فعال یعنی «می‌تواند برگهٔ کارکرد بزند». اگر سرپرست یا عضو
 * نداشته باشد، آن برگه یا بی‌امضا می‌ماند یا خالی است.
 */
export function canActivateCrew(input: {
  status: string;
  composition: CrewComposition;
  hasForemanAssigned?: boolean;
}): CrewGateResult {
  if (input.status === "disbanded") {
    return { ok: false, code: "E-HRM-167", messageFa: "اکیپ منحل‌شده دوباره فعال نمی‌شود؛ اکیپ تازه بسازید" };
  }
  if (input.status === "active") {
    return { ok: false, code: "E-HRM-168", messageFa: "اکیپ از قبل فعال است" };
  }
  const details: string[] = [];
  if (input.composition.headcount === 0) details.push("اکیپ عضو فعالی ندارد");
  if (!input.hasForemanAssigned && input.composition.foremanCount === 0) {
    details.push("سرپرست اکیپ تعیین نشده است");
  }
  if (details.length > 0) {
    return { ok: false, code: "E-HRM-169", messageFa: "اکیپ آمادهٔ فعال شدن نیست", detailsFa: details };
  }
  return { ok: true };
}

/**
 * دروازهٔ انحلال اکیپ.
 *
 * برگهٔ باز یعنی ساعت ثبت‌نشده؛ منحل کردن اکیپ پیش از تعیین تکلیف
 * آن‌ها، ساعت را بی‌صاحب می‌کند.
 */
export function canDisbandCrew(input: {
  status: string;
  openTimesheets?: number;
  activeMembers?: number;
  reasonFa?: string;
}): CrewGateResult {
  if (input.status === "disbanded") {
    return { ok: false, code: "E-HRM-170", messageFa: "اکیپ قبلاً منحل شده است" };
  }
  if (String(input.reasonFa ?? "").trim().length < 10) {
    return { ok: false, code: "E-HRM-171", messageFa: "دلیل انحلال باید دست‌کم ۱۰ نویسه باشد" };
  }
  const details: string[] = [];
  if ((input.openTimesheets ?? 0) > 0) {
    details.push(`${input.openTimesheets} برگهٔ کارکرد باز دارد`);
  }
  if ((input.activeMembers ?? 0) > 0) {
    details.push(`${input.activeMembers} عضو فعال دارد که باید ابتدا خارج شوند`);
  }
  if (details.length > 0) {
    return { ok: false, code: "E-HRM-172", messageFa: "اکیپ آمادهٔ انحلال نیست", detailsFa: details };
  }
  return { ok: true };
}

/* ─────────── ۴. نیروی پیمانکاری ─────────── */

export const PRICING_MODELS = ["hourly", "daily", "unit_rate", "lump_sum"] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const PRICING_MODEL_FA: Record<PricingModel, string> = {
  hourly: "ساعتی",
  daily: "روزمزد",
  unit_rate: "نرخ واحد",
  lump_sum: "مقطوع",
};

export const SUB_ATT_STATES = ["draft", "submitted", "verified", "rejected", "invoiced"] as const;
export type SubAttState = (typeof SUB_ATT_STATES)[number];

export const SUB_ATT_STATE_FA: Record<SubAttState, string> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  verified: "تأییدشده",
  rejected: "برگشتی",
  invoiced: "در صورت‌کارکرد",
};

export type SubContractRow = {
  Id?: string;
  ScopeTrades?: unknown;
  AgreedRates?: unknown;
  StartDate?: string;
  EndDate?: string;
  Status?: string;
  PricingModel?: string;
  RetentionPct?: number;
};

/** خواندن امن JSON که درایور ممکن است رشته یا شیء برگرداند. */
function asRecord(v: unknown): Record<string, number> {
  if (!v) return {};
  if (typeof v === "string") {
    try { return JSON.parse(v) as Record<string, number>; } catch { return {}; }
  }
  if (Array.isArray(v)) return Object.fromEntries(v.map((x) => [String(x), 1]));
  return v as Record<string, number>;
}

function asList(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string") {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : Object.keys(p); } catch { return []; }
  }
  if (Array.isArray(v)) return v.map(String);
  return Object.keys(v as Record<string, unknown>);
}

export type SubAttendanceInput = {
  workDate: string;
  tradeCode: string;
  headcount: number;
  hoursPerPerson: number;
  activityId: string;
  cbsId: string;
  gatePassRef?: string;
};

/**
 * اعتبارسنجی حضور گروهی.
 *
 * سقف ساعت اینجا هم اعمال می‌شود ولی **per-person** نه per-row:
 * ردیف گروهی ۲۰ نفر × ۱۰ ساعت مجاز است؛ ۱ نفر × ۲۰ ساعت نه.
 */
export function validateSubAttendance(
  input: SubAttendanceInput,
  contract: SubContractRow,
  law: LaborLawConfig = IRAN_LABOR_LAW
): TsIssue[] {
  const out: TsIssue[] = [];
  const date = String(input.workDate ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    out.push({ code: "E-HRM-180", severity: "error", field: "workDate", messageFa: "تاریخ کارکرد نامعتبر است" });
  } else {
    if (contract.StartDate && date < String(contract.StartDate)) {
      out.push({ code: "E-HRM-181", severity: "error", field: "workDate", messageFa: `تاریخ پیش از شروع قرارداد (${contract.StartDate}) است` });
    }
    if (contract.EndDate && date > String(contract.EndDate)) {
      out.push({ code: "E-HRM-182", severity: "error", field: "workDate", messageFa: `تاریخ پس از پایان قرارداد (${contract.EndDate}) است` });
    }
  }

  if (String(contract.Status ?? "") !== "active") {
    out.push({ code: "E-HRM-183", severity: "error", messageFa: "قرارداد پیمانکاری فعال نیست" });
  }

  const scope = asList(contract.ScopeTrades);
  const trade = String(input.tradeCode ?? "");
  if (!trade) {
    out.push({ code: "E-HRM-184", severity: "error", field: "tradeCode", messageFa: "رسته الزامی است" });
  } else if (scope.length > 0 && !scope.includes(trade)) {
    /* بدون این بند، پیمانکار جوشکاری می‌توانست صورت‌کارکرد برق‌کار
     * بفرستد و کسی متوجه نمی‌شد. */
    out.push({ code: "E-HRM-185", severity: "error", field: "tradeCode", messageFa: `رستهٔ ${trade} در دامنهٔ این قرارداد نیست` });
  }

  const hc = Number(input.headcount ?? 0);
  if (!Number.isInteger(hc) || hc <= 0) {
    out.push({ code: "E-HRM-186", severity: "error", field: "headcount", messageFa: "تعداد نفرات باید عدد صحیح مثبت باشد" });
  }

  const hpp = Number(input.hoursPerPerson ?? 0);
  if (!(hpp > 0)) {
    out.push({ code: "E-HRM-187", severity: "error", field: "hoursPerPerson", messageFa: "ساعت هر نفر باید بزرگ‌تر از صفر باشد" });
  } else if (hpp > law.dailyAbsoluteCap) {
    out.push({ code: "E-HRM-188", severity: "error", field: "hoursPerPerson", messageFa: `ساعت هر نفر از سقف مطلق روزانه (${law.dailyAbsoluteCap}) بیشتر است` });
  } else if (hpp > law.dailyNormalCap + law.dailyOtCap) {
    out.push({ code: "W-HRM-509", severity: "warning", field: "hoursPerPerson", messageFa: `${hpp} ساعت فراتر از عادی+اضافه‌کاری است و مستندات پشتیبان می‌خواهد` });
  }

  if (!String(input.activityId ?? "").trim()) {
    out.push({ code: "E-HRM-189", severity: "error", field: "activityId", messageFa: "فعالیت الزامی است؛ ساعت بی‌صاحب پذیرفته نمی‌شود" });
  }
  if (!String(input.cbsId ?? "").trim()) {
    out.push({ code: "E-HRM-190", severity: "error", field: "cbsId", messageFa: "حساب هزینه الزامی است" });
  }

  const rates = asRecord(contract.AgreedRates);
  if (trade && rates[trade] === undefined) {
    out.push({ code: "W-HRM-510", severity: "warning", field: "tradeCode", messageFa: `نرخ توافقی رستهٔ ${trade} در قرارداد نیست؛ این ساعت بی‌قیمت می‌ماند` });
  }

  return out;
}

/**
 * جلوگیری از دوبار شمردن نفر-ساعت.
 *
 * اگر نفری هم در تایم‌شیت فردی همان روز باشد و هم زیر چتر حضور
 * گروهی پیمانکار، ساعتش دو بار وارد هزینه و بهره‌وری می‌شود. این
 * تابع همان تقاطع را پیدا می‌کند.
 */
export function assertNoDoubleCount(input: {
  workDate: string;
  subCrewId?: string | null;
  directEntries: { PersonId?: string; WorkDate?: string; HoursRaw?: number }[];
  crewMemberPersonIds: string[];
}): TsIssue[] {
  const ids = new Set(input.crewMemberPersonIds.map(String));
  if (ids.size === 0) return [];
  const hit = input.directEntries.filter(
    (e) => String(e.WorkDate) === String(input.workDate) && ids.has(String(e.PersonId)) && Number(e.HoursRaw ?? 0) > 0
  );
  if (hit.length === 0) return [];
  const people = [...new Set(hit.map((e) => String(e.PersonId)))];
  return [{
    code: "E-HRM-191",
    severity: "error",
    messageFa: `${people.length} نفر (${people.slice(0, 3).join("، ")}) در همین روز برگهٔ کارکرد فردی هم دارند؛ ثبت حضور گروهی ساعتشان را دوبار می‌شمارد`,
  }];
}

/* ─────────── ۵. صورت‌کارکرد پیمانکار ─────────── */

export type SubAttRow = {
  Id?: string;
  WorkDate?: string;
  TradeCode?: string;
  Headcount?: number;
  HoursPerPerson?: number;
  TotalHours?: number;
  ActivityId?: string;
  CbsId?: string;
  Status?: string;
};

export type SubIpcLine = {
  tradeCode: string;
  activityId: string;
  cbsId: string;
  headcountDays: number;
  totalHours: number;
  rate: number | null;
  amount: number | null;
  missingRate: boolean;
};

export type SubIpcDraft = {
  periodCode: string;
  lines: SubIpcLine[];
  totalHours: number;
  grossAmount: number;
  unpricedHours: number;
  retentionAmount: number;
  netBeforeDeduction: number;
  isComplete: boolean;
  issues: TsIssue[];
};

/**
 * ساخت پیش‌نویس صورت‌کارکرد از حضور تأییدشده.
 *
 * فقط ردیف `verified` وارد می‌شود: ردیف ارسال‌نشده یا برگشتی هنوز
 * مورد اختلاف است و نباید مبنای پرداخت شود.
 *
 * ساعت بی‌نرخ **صفر نمی‌شود**؛ در `unpricedHours` می‌نشیند و
 * `isComplete=false` می‌کند تا کسی مبلغ ناقص را کامل نپندارد — همان
 * الگوی `buildTsCostLines` در D4.
 */
export function buildSubIpc(
  rows: SubAttRow[],
  contract: SubContractRow,
  periodCode: string
): SubIpcDraft {
  const rates = asRecord(contract.AgreedRates);
  const retentionPct = clamp(Number(contract.RetentionPct ?? 0), 0, 100);
  const usable = rows.filter((r) => String(r.Status ?? "") === "verified");
  const issues: TsIssue[] = [];

  const skipped = rows.length - usable.length;
  if (skipped > 0) {
    issues.push({
      code: "W-HRM-511",
      severity: "warning",
      messageFa: `${skipped} ردیف حضور هنوز تأیید نشده و در این صورت‌کارکرد نیامده است`,
    });
  }

  const byKey = new Map<string, SubIpcLine>();
  let totalHours = 0, gross = 0, unpriced = 0;

  for (const r of usable) {
    const trade = String(r.TradeCode ?? "");
    const activityId = String(r.ActivityId ?? "");
    const cbsId = String(r.CbsId ?? "");
    const hc = Number(r.Headcount ?? 0);
    const hours = round2(Number(r.TotalHours ?? hc * Number(r.HoursPerPerson ?? 0)));
    if (!(hours > 0)) continue;

    const key = `${cbsId}|${activityId}|${trade}`;
    if (!byKey.has(key)) {
      const rate = rates[trade];
      byKey.set(key, {
        tradeCode: trade, activityId, cbsId,
        headcountDays: 0, totalHours: 0,
        rate: rate === undefined ? null : Number(rate),
        amount: rate === undefined ? null : 0,
        missingRate: rate === undefined,
      });
    }
    const line = byKey.get(key)!;
    line.headcountDays += hc;
    line.totalHours = round2(line.totalHours + hours);
    totalHours = round2(totalHours + hours);

    if (line.rate === null) unpriced = round2(unpriced + hours);
    else {
      line.amount = round2((line.amount ?? 0) + hours * line.rate);
      gross = round2(gross + hours * line.rate);
    }
  }

  if (unpriced > 0) {
    issues.push({
      code: "W-HRM-512",
      severity: "warning",
      messageFa: `${unpriced} نفر-ساعت بدون نرخ توافقی است و در مبلغ نیامده؛ مبلغ زیر ناقص است`,
    });
  }
  if (byKey.size === 0) {
    issues.push({ code: "E-HRM-192", severity: "error", messageFa: "هیچ ردیف حضور تأییدشده‌ای برای این دوره نیست" });
  }

  const retention = round2((gross * retentionPct) / 100);
  return {
    periodCode,
    lines: [...byKey.values()].sort((a, b) => (a.cbsId + a.activityId + a.tradeCode).localeCompare(b.cbsId + b.activityId + b.tradeCode)),
    totalHours,
    grossAmount: gross,
    unpricedHours: unpriced,
    retentionAmount: retention,
    netBeforeDeduction: round2(gross - retention),
    isComplete: unpriced === 0 && byKey.size > 0,
    issues,
  };
}

/**
 * دروازهٔ تأیید صورت‌کارکرد.
 *
 * صورت‌کارکردِ دارای ساعت بی‌نرخ تأیید نمی‌شود: مبلغی که بعداً باید
 * اصلاح شود، پس از پرداخت اصلاح نمی‌شود.
 */
export function canApproveSubIpc(input: {
  status: string;
  unpricedHours?: number;
  totalHours?: number;
  netAmount?: number;
}): CrewGateResult {
  if (input.status === "approved") {
    return { ok: false, code: "E-HRM-193", messageFa: "این صورت‌کارکرد قبلاً تأیید شده است" };
  }
  if (input.status === "rejected") {
    return { ok: false, code: "E-HRM-194", messageFa: "صورت‌کارکرد برگشتی باید دوباره تنظیم شود" };
  }
  const details: string[] = [];
  if (!(Number(input.totalHours ?? 0) > 0)) details.push("جمع ساعت صفر است");
  if (Number(input.unpricedHours ?? 0) > 0) {
    details.push(`${input.unpricedHours} نفر-ساعت بدون نرخ توافقی است`);
  }
  if (Number(input.netAmount ?? 0) < 0) details.push("مبلغ خالص منفی است");
  if (details.length > 0) {
    return { ok: false, code: "E-HRM-195", messageFa: "صورت‌کارکرد آمادهٔ تأیید نیست", detailsFa: details };
  }
  return { ok: true };
}

/* ─────────── ۶. نرخ استفاده و تابلوی اکیپ ─────────── */

export type CrewUtilRow = {
  crewId: string;
  crewNameFa?: string;
  status?: string;
  headcount: number;
  availableHours: number;
  chargedHours: number;
  productiveHours: number;
  utilizationPct: number | null;
  productivePct: number | null;
  flag: "green" | "amber" | "red" | "na";
};

/**
 * نرخ استفادهٔ اکیپ.
 *
 * دو نسبت جداگانه، چون دو مسئلهٔ متفاوت را نشان می‌دهند:
 *   utilization = ساعت ثبت‌شده ÷ ساعت در دسترس  → «آمدند سر کار؟»
 *   productive  = ساعت مولد ÷ ساعت ثبت‌شده      → «کار کردند؟»
 * اکیپی که ۱۰۰٪ حاضر است ولی ۴۰٪ مولد، مسئله‌اش مدیریت جبهه است نه
 * غیبت؛ یک عدد ترکیبی این تفاوت را پنهان می‌کرد.
 */
export function crewUtilization(
  crews: { Id?: string; NameFa?: string; Status?: string }[],
  members: (CrewMemberRow & { crewId: string })[],
  entries: { CrewId?: string; HoursRaw?: number; IsProductive?: boolean | number }[],
  opts: { workingDays: number; hoursPerDay?: number; dateIso?: string } = { workingDays: 0 }
): CrewUtilRow[] {
  const perDay = opts.hoursPerDay ?? IRAN_LABOR_LAW.dailyNormalCap;
  const on = opts.dateIso ?? "9999-12-31";

  return crews.map((c) => {
    const cid = String(c.Id ?? "");
    const comp = crewComposition(members.filter((m) => String(m.crewId) === cid), on);
    const rows = entries.filter((e) => String(e.CrewId ?? "") === cid);

    let charged = 0, productive = 0;
    for (const e of rows) {
      const h = Number(e.HoursRaw ?? 0);
      if (!(h > 0)) continue;
      charged = round2(charged + h);
      if (!(e.IsProductive === false || e.IsProductive === 0)) productive = round2(productive + h);
    }

    const available = round2(comp.fte * perDay * Math.max(0, opts.workingDays));
    const util = available > 0 ? round2((charged / available) * 100) : null;
    const prod = charged > 0 ? round2((productive / charged) * 100) : null;

    /* پرچم از هرکدام که بدتر است می‌آید: اکیپی که حاضر است ولی
     * بی‌کار، به همان اندازهٔ اکیپ غایب مشکل‌دار است. */
    const worst = Math.min(util ?? 101, prod ?? 101);
    const flag = util === null && prod === null
      ? ("na" as const)
      : worst < 60 ? ("red" as const) : worst < 85 ? ("amber" as const) : ("green" as const);

    return {
      crewId: cid,
      crewNameFa: c.NameFa ? String(c.NameFa) : undefined,
      status: c.Status ? String(c.Status) : undefined,
      headcount: comp.headcount,
      availableHours: available,
      chargedHours: charged,
      productiveHours: productive,
      utilizationPct: util,
      productivePct: prod,
      flag,
    };
  }).sort((a, b) => (a.utilizationPct ?? 999) - (b.utilizationPct ?? 999));
}

/** خلاصهٔ تابلوی اکیپ‌ها برای سربرگ صفحه. */
export function crewBoardSummary(rows: CrewUtilRow[]) {
  const active = rows.filter((r) => r.status === "active");
  const totalAvail = rows.reduce((s, r) => s + r.availableHours, 0);
  const totalCharged = rows.reduce((s, r) => s + r.chargedHours, 0);
  const totalProd = rows.reduce((s, r) => s + r.productiveHours, 0);
  return {
    crewCount: rows.length,
    activeCount: active.length,
    headcount: rows.reduce((s, r) => s + r.headcount, 0),
    availableHours: round2(totalAvail),
    chargedHours: round2(totalCharged),
    utilizationPct: totalAvail > 0 ? round2((totalCharged / totalAvail) * 100) : null,
    productivePct: totalCharged > 0 ? round2((totalProd / totalCharged) * 100) : null,
    redCount: rows.filter((r) => r.flag === "red").length,
    worstCrewId: rows.find((r) => r.flag === "red")?.crewId ?? null,
  };
}

/* ══════════════════════ D7 — پذیرش، احکام و انطباق ══════════════════════
 *
 * این تحویلی یک دروازه است، نه یک دفتر: هیچ عددی تولید نمی‌کند و فقط
 * جواب می‌دهد «آیا این نفر اجازهٔ کار دارد؟».
 *
 * مرز سخت با ماژول ایمنی: HRM نتیجهٔ آموزش و طب کار را **می‌خواند** و
 * هرگز **نمی‌نویسد**. مالک آن داده HSE است. اگر HRM هم بتواند بنویسد،
 * دو دفتر واگرا می‌شوند و آن‌که سهل‌گیرتر است برنده می‌شود — یعنی
 * دقیقاً همان دفتری که نباید.
 *
 * سه قاعدهٔ ثابت:
 *   ۱) نفر بدون پنج گیت سبز به `active` نمی‌رسد و ساعت ثبت نمی‌کند.
 *   ۲) مدرک بدون تاریخ انقضا «دائمی» است، نه «منقضی».
 *   ۳) نفری که ساعت تأییدنشده دارد تخلیه نمی‌شود (ساعت یتیم ممنوع).
 */

/* ─────────── ۱. وضعیت نفر ─────────── */

export const PERSON_STATUSES = [
  "candidate", "onboarding", "active", "on_leave", "demobilized", "terminated",
] as const;
export type PersonStatus = (typeof PERSON_STATUSES)[number];

export const PERSON_STATUS_FA: Record<PersonStatus, string> = {
  candidate: "داوطلب",
  onboarding: "در حال پذیرش",
  active: "فعال",
  on_leave: "مرخصی",
  demobilized: "تخلیه‌شده",
  terminated: "قطع همکاری",
};

export const EMPLOYMENT_TYPES = [
  "permanent", "contract", "daily_wage", "subcontractor", "consultant",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_FA: Record<EmploymentType, string> = {
  permanent: "رسمی",
  contract: "قراردادی",
  daily_wage: "روزمزد",
  subcontractor: "پیمانکاری",
  consultant: "مشاور",
};

/**
 * گذارهای مجاز وضعیت نفر.
 *
 * `terminated` از هر جایی ممکن است (فوت، انصراف، اخراج) ولی برگشت
 * ندارد. `demobilized → active` عمداً باز است: تجهیز دوبارهٔ نیروی
 * فصلی در پروژه‌های عمرانی قاعده است نه استثنا.
 */
export const PERSON_TRANSITIONS: Record<PersonStatus, PersonStatus[]> = {
  candidate: ["onboarding", "terminated"],
  onboarding: ["active", "candidate", "terminated"],
  active: ["on_leave", "demobilized", "terminated"],
  on_leave: ["active", "demobilized", "terminated"],
  demobilized: ["active", "terminated"],
  terminated: [],
};

export function personNextStates(from: string): PersonStatus[] {
  return PERSON_TRANSITIONS[from as PersonStatus] ?? [];
}

/* ─────────── ۲. مدرک و انقضا ─────────── */

export const DOC_TYPES = [
  "id_card", "contract", "medical", "hse_card", "insurance", "training", "visa", "other",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_FA: Record<DocType, string> = {
  id_card: "کارت شناسایی",
  contract: "قرارداد",
  medical: "معاینات طب کار",
  hse_card: "کارت ایمنی",
  insurance: "بیمه",
  training: "گواهی آموزش",
  visa: "روادید",
  other: "سایر",
};

/** پنجرهٔ هشدار انقضا؛ مبنای `EWS-HRM-04`. */
export const DOC_EXPIRY_WARN_DAYS = 30;

export type PersonDocRow = {
  Id?: string;
  PersonId?: string;
  DocType?: string;
  DocNo?: string;
  IssuedAt?: string | null;
  ExpiresAt?: string | null;
  IsBlocking?: boolean | number;
  Status?: string;
};

const isTrue = (v: unknown) => v === true || v === 1;

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / 86_400_000);
}

/**
 * وضعیت مشتق یک مدرک.
 *
 * `Status` ذخیره‌شده عمداً نادیده گرفته می‌شود: مدرکی که دیروز
 * «معتبر» ذخیره شده امروز منقضی است و هیچ کارِ پس‌زمینه‌ای آن را
 * به‌روز نمی‌کند. تاریخ منبع حقیقت است، نه ستون وضعیت.
 */
export function docState(doc: PersonDocRow, todayIso: string): {
  state: "valid" | "expiring" | "expired" | "undated";
  daysLeft: number | null;
  isBlocking: boolean;
  messageFa: string;
} {
  const blocking = isTrue(doc.IsBlocking);
  const typeFa = DOC_TYPE_FA[String(doc.DocType) as DocType] ?? String(doc.DocType ?? "مدرک");
  const exp = doc.ExpiresAt ? String(doc.ExpiresAt) : null;

  if (!exp) {
    /* بدون تاریخ انقضا یعنی دائمی. اگر اینجا «منقضی» برمی‌گرداندیم،
     * کارت ملی هر نفر پروندهٔ او را قرمز می‌کرد. */
    return { state: "undated", daysLeft: null, isBlocking: blocking, messageFa: `${typeFa} بدون تاریخ انقضا (دائمی)` };
  }

  const left = daysBetween(todayIso, exp);
  if (Number.isNaN(left)) {
    return { state: "undated", daysLeft: null, isBlocking: blocking, messageFa: `${typeFa}: تاریخ انقضا نامعتبر است` };
  }
  if (left < 0) {
    return { state: "expired", daysLeft: left, isBlocking: blocking, messageFa: `${typeFa} ${Math.abs(left)} روز است منقضی شده` };
  }
  if (left <= DOC_EXPIRY_WARN_DAYS) {
    return { state: "expiring", daysLeft: left, isBlocking: blocking, messageFa: `${typeFa} تا ${left} روز دیگر منقضی می‌شود` };
  }
  return { state: "valid", daysLeft: left, isBlocking: blocking, messageFa: `${typeFa} معتبر است` };
}

/** خلاصهٔ پروندهٔ مدارک یک نفر. */
export function docCompliance(docs: PersonDocRow[], todayIso: string): {
  total: number;
  valid: number;
  expiring: number;
  expired: number;
  blockingExpired: number;
  issues: TsIssue[];
} {
  let valid = 0, expiring = 0, expired = 0, blockingExpired = 0;
  const issues: TsIssue[] = [];

  for (const d of docs) {
    const st = docState(d, todayIso);
    if (st.state === "expired") {
      expired++;
      if (st.isBlocking) {
        blockingExpired++;
        issues.push({ code: "E-HRM-201", severity: "error", field: "docType", messageFa: st.messageFa });
      } else {
        issues.push({ code: "W-HRM-520", severity: "warning", messageFa: st.messageFa });
      }
    } else if (st.state === "expiring") {
      expiring++;
      issues.push({ code: "W-HRM-521", severity: "warning", messageFa: st.messageFa });
    } else {
      valid++;
    }
  }

  return { total: docs.length, valid, expiring, expired, blockingExpired, issues };
}

/* ─────────── ۳. ماتریس مهارت ─────────── */

export type SkillRow = {
  Id?: string;
  PersonId?: string;
  SkillCode?: string;
  SkillNameFa?: string;
  Level?: number;
  ExpiresAt?: string | null;
  IsBlocking?: boolean | number;
};

/**
 * وضعیت مهارت‌های یک نفر.
 *
 * سطح ۰ یعنی «ارزیابی نشده» و با «بلد نیست» یکی نیست؛ اولی شکاف
 * دادهٔ ماست و دومی واقعیت نفر. قاطی کردنشان باعث می‌شود مدیر
 * آموزشی برای کسی برنامه بریزد که شاید اصلاً نیازی ندارد.
 */
export function skillMatrix(skills: SkillRow[], todayIso: string): {
  count: number;
  assessed: number;
  unassessed: number;
  expiredBlocking: number;
  averageLevel: number | null;
  items: { skillCode: string; nameFa: string; level: number; state: string; daysLeft: number | null; isBlocking: boolean }[];
  issues: TsIssue[];
} {
  const issues: TsIssue[] = [];
  const items = skills.map((s) => {
    const level = Number(s.Level ?? 0);
    const st = docState({ ExpiresAt: s.ExpiresAt, IsBlocking: s.IsBlocking, DocType: "training" }, todayIso);
    const nameFa = String(s.SkillNameFa ?? s.SkillCode ?? "");
    if (st.state === "expired" && isTrue(s.IsBlocking)) {
      issues.push({ code: "E-HRM-201", severity: "error", messageFa: `صلاحیت «${nameFa}» ${Math.abs(st.daysLeft ?? 0)} روز است منقضی شده` });
    } else if (st.state === "expiring") {
      issues.push({ code: "W-HRM-521", severity: "warning", messageFa: `صلاحیت «${nameFa}» تا ${st.daysLeft} روز دیگر منقضی می‌شود` });
    }
    return {
      skillCode: String(s.SkillCode ?? ""),
      nameFa,
      level,
      state: st.state,
      daysLeft: st.daysLeft,
      isBlocking: isTrue(s.IsBlocking),
    };
  });

  const assessed = items.filter((x) => x.level > 0);
  return {
    count: items.length,
    assessed: assessed.length,
    unassessed: items.length - assessed.length,
    expiredBlocking: items.filter((x) => x.state === "expired" && x.isBlocking).length,
    /* میانگین فقط از ارزیابی‌شده‌ها: صفرهای «نمی‌دانیم» میانگین را
     * مصنوعی پایین می‌آوردند. */
    averageLevel: assessed.length > 0 ? round2(assessed.reduce((s, x) => s + x.level, 0) / assessed.length) : null,
    items,
    issues,
  };
}

/* ─────────── ۴. پنج گیت تجهیز ─────────── */

export const MOB_GATES = ["contract", "medical", "hse_training", "trade_docs", "gate_pass"] as const;
export type MobGate = (typeof MOB_GATES)[number];

export const MOB_GATE_FA: Record<MobGate, string> = {
  contract: "قرارداد امضاشده",
  medical: "معاینات طب کار معتبر",
  hse_training: "آموزش ایمنی عمومی",
  trade_docs: "مدارک مسدودکنندهٔ رسته",
  gate_pass: "کارت تردد",
};

export type GateResult = {
  gate: MobGate;
  titleFa: string;
  ok: boolean;
  isBlocking: boolean;
  code: string | null;
  messageFa: string;
};

/**
 * ارزیابی پنج گیت تجهیز.
 *
 * `gate_pass` عمداً **هشدار** است نه مانع: کارت تردد را حراست صادر
 * می‌کند و گاهی یک روز عقب می‌افتد؛ مسدود کردن فعال‌سازی به‌خاطر آن،
 * نفر آماده‌به‌کار را پشت در نگه می‌داشت و تنها نتیجه‌اش دور زدن
 * سامانه بود.
 *
 * `hse_training` از ماژول ایمنی می‌آید و اینجا فقط خوانده می‌شود.
 * اگر استعلام نشده باشد (`null`) گیت **قرمز** است نه سبز — نبودِ خبر،
 * خبر خوب نیست.
 */
export function evaluateMobGates(input: {
  docs: PersonDocRow[];
  skills?: SkillRow[];
  hseCleared?: boolean | null;
  hseBlockersFa?: string[];
  gatePassRef?: string | null;
  todayIso: string;
}): { gates: GateResult[]; ok: boolean; blockersFa: string[]; warningsFa: string[] } {
  const { docs, skills = [], hseCleared = null, hseBlockersFa = [], gatePassRef = null, todayIso } = input;
  const gates: GateResult[] = [];

  const liveDoc = (type: DocType) => docs
    .filter((d) => String(d.DocType) === type)
    .map((d) => ({ d, st: docState(d, todayIso) }))
    .sort((a, b) => (b.st.daysLeft ?? 1e9) - (a.st.daysLeft ?? 1e9))[0];

  /* گیت ۱ — قرارداد */
  const contract = liveDoc("contract");
  gates.push(contract && contract.st.state !== "expired"
    ? { gate: "contract", titleFa: MOB_GATE_FA.contract, ok: true, isBlocking: true, code: null, messageFa: contract.st.messageFa }
    : { gate: "contract", titleFa: MOB_GATE_FA.contract, ok: false, isBlocking: true, code: "E-HRM-210", messageFa: contract ? contract.st.messageFa : "قرارداد امضاشده در پرونده نیست" });

  /* گیت ۲ — طب کار */
  const medical = liveDoc("medical");
  gates.push(medical && medical.st.state !== "expired"
    ? { gate: "medical", titleFa: MOB_GATE_FA.medical, ok: true, isBlocking: true, code: null, messageFa: medical.st.messageFa }
    : { gate: "medical", titleFa: MOB_GATE_FA.medical, ok: false, isBlocking: true, code: "E-HRM-211", messageFa: medical ? medical.st.messageFa : "معاینات طب کار در پرونده نیست" });

  /* گیت ۳ — آموزش ایمنی (خوانده از HSE) */
  gates.push(hseCleared === true
    ? { gate: "hse_training", titleFa: MOB_GATE_FA.hse_training, ok: true, isBlocking: true, code: null, messageFa: "دروازهٔ ایمنی سبز است" }
    : {
        gate: "hse_training",
        titleFa: MOB_GATE_FA.hse_training,
        ok: false,
        isBlocking: true,
        code: "E-HRM-202",
        messageFa: hseCleared === null
          ? "دروازهٔ ایمنی استعلام نشده است؛ تا استعلام، این گیت باز فرض نمی‌شود"
          : (hseBlockersFa[0] ?? "دروازهٔ ایمنی این نفر بسته است"),
      });

  /* گیت ۴ — مدارک و صلاحیت‌های مسدودکنندهٔ رسته */
  const blockingDocs = docs.filter((d) => isTrue(d.IsBlocking) && docState(d, todayIso).state === "expired");
  const blockingSkills = skills.filter((s) => isTrue(s.IsBlocking)
    && docState({ ExpiresAt: s.ExpiresAt, IsBlocking: s.IsBlocking }, todayIso).state === "expired");
  const blockedCount = blockingDocs.length + blockingSkills.length;
  gates.push(blockedCount === 0
    ? { gate: "trade_docs", titleFa: MOB_GATE_FA.trade_docs, ok: true, isBlocking: true, code: null, messageFa: "هیچ مدرک یا صلاحیت مسدودکنندهٔ منقضی نیست" }
    : { gate: "trade_docs", titleFa: MOB_GATE_FA.trade_docs, ok: false, isBlocking: true, code: "E-HRM-201", messageFa: `${blockedCount} مدرک یا صلاحیت مسدودکننده منقضی است` });

  /* گیت ۵ — کارت تردد (هشدار) */
  gates.push(String(gatePassRef ?? "").trim()
    ? { gate: "gate_pass", titleFa: MOB_GATE_FA.gate_pass, ok: true, isBlocking: false, code: null, messageFa: `کارت تردد ${gatePassRef}` }
    : { gate: "gate_pass", titleFa: MOB_GATE_FA.gate_pass, ok: false, isBlocking: false, code: "W-HRM-330", messageFa: "کارت تردد هنوز صادر نشده؛ ورود به کارگاه ممکن نیست ولی مانع فعال‌سازی نیست" });

  const blockersFa = gates.filter((g) => !g.ok && g.isBlocking).map((g) => `${g.titleFa}: ${g.messageFa}`);
  const warningsFa = gates.filter((g) => !g.ok && !g.isBlocking).map((g) => `${g.titleFa}: ${g.messageFa}`);
  return { gates, ok: blockersFa.length === 0, blockersFa, warningsFa };
}

/** دروازهٔ گذار وضعیت نفر. */
export function canTransitionPerson(input: {
  from: string;
  to: string;
  gates?: { ok: boolean; blockersFa: string[] };
  openTimesheets?: number;
  demobChecklist?: { done: number; mandatoryTotal: number; pendingFa: string[] };
  reasonFa?: string;
}): CrewGateResult {
  const from = String(input.from);
  const to = String(input.to);

  if (!PERSON_STATUSES.includes(to as PersonStatus)) {
    return { ok: false, code: "E-HRM-215", messageFa: `وضعیت «${to}» تعریف نشده است` };
  }
  if (from === to) {
    return { ok: false, code: "E-HRM-216", messageFa: `نفر از قبل در وضعیت «${PERSON_STATUS_FA[to as PersonStatus]}» است` };
  }
  if (!personNextStates(from).includes(to as PersonStatus)) {
    return {
      ok: false,
      code: "E-HRM-217",
      messageFa: `گذار از «${PERSON_STATUS_FA[from as PersonStatus] ?? from}» به «${PERSON_STATUS_FA[to as PersonStatus]}» مجاز نیست`,
    };
  }

  /* فعال شدن = اجازهٔ ثبت ساعت. تنها جایی که پنج گیت اعمال می‌شود. */
  if (to === "active") {
    const g = input.gates;
    if (!g) {
      return { ok: false, code: "E-HRM-218", messageFa: "بدون ارزیابی گیت‌ها، فعال‌سازی ممکن نیست" };
    }
    if (!g.ok) {
      return { ok: false, code: "E-HRM-219", messageFa: "نفر آمادهٔ فعال شدن نیست", detailsFa: g.blockersFa };
    }
  }

  if (to === "demobilized") {
    const details: string[] = [];
    /* ساعت یتیم: برگهٔ تأییدنشدهٔ نفری که رفته، هرگز تأیید نمی‌شود
     * و آن ساعت نه به هزینه می‌رسد نه به بهره‌وری. */
    if ((input.openTimesheets ?? 0) > 0) {
      details.push(`${input.openTimesheets} برگهٔ کارکرد تأییدنشده دارد`);
    }
    const cl = input.demobChecklist;
    if (cl && cl.done < cl.mandatoryTotal) {
      details.push(...cl.pendingFa);
    }
    if (details.length > 0) {
      return { ok: false, code: "E-HRM-123", messageFa: "نفر آمادهٔ تخلیه نیست", detailsFa: details };
    }
  }

  if (to === "terminated" && String(input.reasonFa ?? "").trim().length < 10) {
    return { ok: false, code: "E-HRM-220", messageFa: "دلیل قطع همکاری باید دست‌کم ۱۰ نویسه باشد" };
  }

  return { ok: true };
}

/* ─────────── ۵. چک‌لیست تخلیه ─────────── */

export const DEMOB_ITEMS = ["tools_returned", "gate_pass_returned", "timesheets_closed", "exit_interview", "final_settlement"] as const;
export type DemobItem = (typeof DEMOB_ITEMS)[number];

export const DEMOB_ITEM_FA: Record<DemobItem, string> = {
  tools_returned: "تسویهٔ ابزار و انبار",
  gate_pass_returned: "تحویل کارت تردد",
  timesheets_closed: "بستن برگه‌های کارکرد",
  exit_interview: "مصاحبهٔ خروج",
  final_settlement: "تسویه‌حساب نهایی",
};

/** مصاحبهٔ خروج اختیاری است؛ بقیه اجباری. */
export const DEMOB_OPTIONAL: DemobItem[] = ["exit_interview"];

export type DemobRow = { ItemCode?: string; IsDone?: boolean | number; IsMandatory?: boolean | number };

export function demobProgress(rows: DemobRow[]): {
  done: number;
  total: number;
  mandatoryTotal: number;
  mandatoryDone: number;
  isComplete: boolean;
  pendingFa: string[];
  items: { itemCode: string; titleFa: string; isDone: boolean; isMandatory: boolean }[];
} {
  /* فهرست کامل ساخته می‌شود حتی اگر ردیفی ثبت نشده باشد: بند
   * ثبت‌نشده «انجام‌نشده» است، نه «وجود ندارد». */
  const byCode = new Map(rows.map((r) => [String(r.ItemCode), r]));
  const items = DEMOB_ITEMS.map((code) => {
    const r = byCode.get(code);
    return {
      itemCode: code,
      titleFa: DEMOB_ITEM_FA[code],
      isDone: r ? isTrue(r.IsDone) : false,
      isMandatory: r ? isTrue(r.IsMandatory) : !DEMOB_OPTIONAL.includes(code),
    };
  });

  const mandatory = items.filter((x) => x.isMandatory);
  const mandatoryDone = mandatory.filter((x) => x.isDone).length;
  return {
    done: items.filter((x) => x.isDone).length,
    total: items.length,
    mandatoryTotal: mandatory.length,
    mandatoryDone,
    isComplete: mandatoryDone === mandatory.length,
    pendingFa: mandatory.filter((x) => !x.isDone).map((x) => `${x.titleFa} انجام نشده`),
    items,
  };
}

/* ─────────── ۶. درخواست تجهیز ─────────── */

export const MOB_REQ_STATES = [
  "draft", "submitted", "approved", "rejected", "in_progress", "fulfilled", "cancelled",
] as const;
export type MobReqState = (typeof MOB_REQ_STATES)[number];

export const MOB_REQ_STATE_FA: Record<MobReqState, string> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  approved: "تأییدشده",
  rejected: "برگشتی",
  in_progress: "در حال جذب",
  fulfilled: "تکمیل‌شده",
  cancelled: "لغوشده",
};

export const MOB_REQ_TRANSITIONS: Record<MobReqState, MobReqState[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "rejected", "cancelled"],
  approved: ["in_progress", "cancelled"],
  rejected: ["draft", "cancelled"],
  in_progress: ["fulfilled", "cancelled"],
  fulfilled: [],
  cancelled: [],
};

export const MOB_REQUEST_TYPES = ["mobilize", "demobilize", "replace"] as const;
export const MOB_REQUEST_TYPE_FA: Record<string, string> = {
  mobilize: "تجهیز",
  demobilize: "تخلیه",
  replace: "جایگزینی",
};

export function validateMobRequest(input: {
  requestType?: string;
  tradeCode?: string;
  qty?: number;
  needByDate?: string;
  justificationFa?: string;
  todayIso?: string;
}): TsIssue[] {
  const out: TsIssue[] = [];

  if (!MOB_REQUEST_TYPES.includes(String(input.requestType) as never)) {
    out.push({ code: "E-HRM-230", severity: "error", field: "requestType", messageFa: "نوع درخواست نامعتبر است" });
  }
  if (!String(input.tradeCode ?? "").trim()) {
    out.push({ code: "E-HRM-231", severity: "error", field: "tradeCode", messageFa: "رسته الزامی است" });
  }
  const qty = Number(input.qty ?? 0);
  if (!Number.isInteger(qty) || qty <= 0) {
    out.push({ code: "E-HRM-232", severity: "error", field: "qty", messageFa: "تعداد باید عدد صحیح مثبت باشد" });
  }
  const need = String(input.needByDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(need)) {
    out.push({ code: "E-HRM-233", severity: "error", field: "needByDate", messageFa: "تاریخ نیاز نامعتبر است" });
  } else if (input.todayIso && need < input.todayIso) {
    /* تاریخ گذشته خطا نیست — درخواست عقب‌افتاده واقعیت کارگاه است —
     * ولی باید دیده شود وگرنه در صف با بقیه یکسان می‌نشیند. */
    out.push({ code: "W-HRM-522", severity: "warning", field: "needByDate", messageFa: `تاریخ نیاز (${need}) گذشته است؛ این درخواست از قبل عقب افتاده` });
  }
  /* توجیه کوتاه یعنی توجیه نداشتن؛ تأییدکننده باید بداند چرا. */
  if (String(input.justificationFa ?? "").trim().length < 10) {
    out.push({ code: "E-HRM-234", severity: "error", field: "justificationFa", messageFa: "توجیه درخواست باید دست‌کم ۱۰ نویسه باشد" });
  }

  return out;
}

export function canTransitionMobRequest(input: {
  from: string;
  to: string;
  fulfilledQty?: number;
  qty?: number;
  reasonFa?: string;
}): CrewGateResult {
  const from = String(input.from) as MobReqState;
  const to = String(input.to) as MobReqState;

  if (!MOB_REQ_STATES.includes(to)) {
    return { ok: false, code: "E-HRM-235", messageFa: `وضعیت «${to}» تعریف نشده است` };
  }
  if (!(MOB_REQ_TRANSITIONS[from] ?? []).includes(to)) {
    return {
      ok: false,
      code: "E-HRM-236",
      messageFa: `گذار از «${MOB_REQ_STATE_FA[from] ?? from}» به «${MOB_REQ_STATE_FA[to]}» مجاز نیست`,
    };
  }
  if ((to === "rejected" || to === "cancelled") && String(input.reasonFa ?? "").trim().length < 5) {
    return { ok: false, code: "E-HRM-237", messageFa: "دلیل رد یا لغو باید دست‌کم ۵ نویسه باشد" };
  }
  if (to === "fulfilled") {
    const f = Number(input.fulfilledQty ?? 0);
    const q = Number(input.qty ?? 0);
    if (f < q) {
      /* بستن درخواست نیمه‌تمام یعنی کسری نیرو از رادار خارج می‌شود. */
      return {
        ok: false,
        code: "E-HRM-238",
        messageFa: `فقط ${f} نفر از ${q} نفر جذب شده‌اند؛ درخواست ناتمام بسته نمی‌شود`,
      };
    }
  }
  return { ok: true };
}

/* ─────────── ۷. تابلوی انطباق ─────────── */

export type PersonRow = {
  Id?: string;
  PersonnelNo?: string;
  FullNameFa?: string;
  PrimaryTradeCode?: string;
  Status?: string;
  EmploymentType?: string;
  HseClearance?: string;
  GatePassRef?: string | null;
};

/**
 * تابلوی انطباق نیروی پروژه.
 *
 * هدف پاسخ به یک سؤال است: «چند نفر امروز حق کار دارند و چند نفر
 * نه؟». نفرِ فعالِ دارای مدرک منقضی خطرناک‌ترین حالت است چون سامانه
 * او را مجاز می‌داند ولی نیست — پس جدا شمرده می‌شود.
 */
export function compliancePanel(
  people: PersonRow[],
  docsByPerson: Record<string, PersonDocRow[]>,
  skillsByPerson: Record<string, SkillRow[]>,
  todayIso: string
): {
  headcount: number;
  byStatus: Record<string, number>;
  activeCount: number;
  compliantCount: number;
  blockedActiveCount: number;
  expiringSoonCount: number;
  noGatePassCount: number;
  rows: {
    personId: string;
    personnelNo: string;
    nameFa: string;
    tradeCode: string;
    status: string;
    statusFa: string;
    docSummary: { valid: number; expiring: number; expired: number; blockingExpired: number };
    skillLevel: number | null;
    isCompliant: boolean;
    flag: "green" | "amber" | "red";
    blockersFa: string[];
  }[];
} {
  const byStatus: Record<string, number> = {};
  let compliant = 0, blockedActive = 0, expiringSoon = 0, noGatePass = 0;

  const rows = people.map((p) => {
    const pid = String(p.Id ?? "");
    const status = String(p.Status ?? "candidate");
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    const dc = docCompliance(docsByPerson[pid] ?? [], todayIso);
    const sm = skillMatrix(skillsByPerson[pid] ?? [], todayIso);
    const blockers = [
      ...dc.issues.filter((i) => i.severity === "error").map((i) => i.messageFa),
      ...sm.issues.filter((i) => i.severity === "error").map((i) => i.messageFa),
    ];
    const isCompliant = blockers.length === 0;
    if (isCompliant) compliant++;
    if (status === "active" && !isCompliant) blockedActive++;
    if (dc.expiring > 0) expiringSoon++;
    if (!String(p.GatePassRef ?? "").trim() && status === "active") noGatePass++;

    return {
      personId: pid,
      personnelNo: String(p.PersonnelNo ?? ""),
      nameFa: String(p.FullNameFa ?? ""),
      tradeCode: String(p.PrimaryTradeCode ?? ""),
      status,
      statusFa: PERSON_STATUS_FA[status as PersonStatus] ?? status,
      docSummary: { valid: dc.valid, expiring: dc.expiring, expired: dc.expired, blockingExpired: dc.blockingExpired },
      skillLevel: sm.averageLevel,
      isCompliant,
      flag: (!isCompliant ? "red" : dc.expiring > 0 ? "amber" : "green") as "green" | "amber" | "red",
      blockersFa: blockers,
    };
  });

  return {
    headcount: people.length,
    byStatus,
    activeCount: byStatus.active ?? 0,
    compliantCount: compliant,
    blockedActiveCount: blockedActive,
    expiringSoonCount: expiringSoon,
    noGatePassCount: noGatePass,
    /* نفرِ فعالِ ناسازگار اول فهرست: او همین الان دارد کار می‌کند. */
    rows: rows.sort((a, b) => {
      const rank = (x: typeof a) => (x.status === "active" && !x.isCompliant ? 0 : x.isCompliant ? 2 : 1);
      return rank(a) - rank(b);
    }),
  };
}

/** فهرست مدارک رو به انقضا برای هشدار زودهنگام — مبنای EWS-HRM-04. */
export function expiryWatch(
  docs: (PersonDocRow & { ProjectId?: string })[],
  todayIso: string,
  horizonDays = DOC_EXPIRY_WARN_DAYS
): { personId: string; docType: string; docTypeFa: string; expiresAt: string; daysLeft: number; isBlocking: boolean; severity: "error" | "warning" }[] {
  const out: { personId: string; docType: string; docTypeFa: string; expiresAt: string; daysLeft: number; isBlocking: boolean; severity: "error" | "warning" }[] = [];
  for (const d of docs) {
    if (!d.ExpiresAt) continue;
    const left = daysBetween(todayIso, String(d.ExpiresAt));
    if (Number.isNaN(left) || left > horizonDays) continue;
    out.push({
      personId: String(d.PersonId ?? ""),
      docType: String(d.DocType ?? ""),
      docTypeFa: DOC_TYPE_FA[String(d.DocType) as DocType] ?? String(d.DocType ?? ""),
      expiresAt: String(d.ExpiresAt),
      daysLeft: left,
      isBlocking: isTrue(d.IsBlocking),
      severity: left < 0 && isTrue(d.IsBlocking) ? "error" : "warning",
    });
  }
  /* فوری‌ترین اول: منقضی‌شده‌ها با عدد منفی خودبه‌خود بالا می‌آیند. */
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/* ══════════════════════ D8 — تحلیل، هیستوگرام و گزارش ══════════════════════
 *
 * این تحویلی هیچ دادهٔ تازه‌ای نمی‌سازد؛ فقط آنچه D4 تا D7 ثبت کرده‌اند
 * را کنار هم می‌گذارد تا سؤال‌های مدیریتی جواب بگیرند.
 *
 * دو خطر ذاتی هر لایهٔ تحلیلی که اینجا صریحاً بسته شده‌اند:
 *
 *   ۱) **عدد بی‌مبنا.** دوره‌ای که برنامه ندارد، انحراف هم ندارد —
 *      نه اینکه انحرافش صفر باشد. صفر یعنی «مطابق برنامه» که دروغ است.
 *      همه‌جا `null` برمی‌گردد و پرچم `hasPlan` جدا می‌آید.
 *
 *   ۲) **جمع زدن سیب و پرتقال.** ساعت تأییدنشده با تأییدشده جمع
 *      نمی‌شود، و ساعت پیمانکاری با مستقیم در یک ستون نمی‌نشیند —
 *      هرکدام مسیر هزینهٔ متفاوتی دارند.
 */

/* ─────────── ۱. هیستوگرام نیرو ─────────── */

export type HistogramBar = {
  periodCode: string;
  plannedMh: number | null;
  actualMh: number;
  /** ساعت پیمانکاری جدا می‌ماند؛ در `actualMh` هست ولی قابل تفکیک. */
  subMh: number;
  directMh: number;
  plannedHeadcount: number | null;
  actualHeadcount: number | null;
  variancePct: number | null;
  status: "over" | "under" | "on_track" | "no_plan";
};

/** آستانهٔ انحراف تجهیز؛ مبنای `EWS-HRM-01`. */
export const HISTOGRAM_VARIANCE_THRESHOLD = 10;

export type HistogramInput = {
  periodCode: string;
  plannedMh?: number | null;
  plannedHeadcount?: number | null;
  directMh?: number;
  subMh?: number;
  actualHeadcount?: number | null;
};

/**
 * هیستوگرام دوره‌ای نیرو: برنامه در برابر واقعی.
 *
 * دوره‌ای که برنامه ندارد `no_plan` می‌گیرد و انحرافش `null` است.
 * اگر صفر برمی‌گرداندیم، مدیر آن را «مطابق برنامه» می‌خواند در حالی
 * که اصلاً برنامه‌ای وجود نداشته.
 */
export function manpowerHistogram(rows: HistogramInput[]): {
  bars: HistogramBar[];
  totals: {
    plannedMh: number | null;
    actualMh: number;
    directMh: number;
    subMh: number;
    variancePct: number | null;
    peakPeriod: string | null;
    peakMh: number;
    periodsWithPlan: number;
    periodsWithoutPlan: number;
  };
} {
  const bars: HistogramBar[] = rows
    .slice()
    .sort((a, b) => String(a.periodCode).localeCompare(String(b.periodCode)))
    .map((r) => {
      const direct = round2(Number(r.directMh ?? 0));
      const sub = round2(Number(r.subMh ?? 0));
      const actual = round2(direct + sub);
      const planned = r.plannedMh === null || r.plannedMh === undefined ? null : round2(Number(r.plannedMh));

      let variancePct: number | null = null;
      let status: HistogramBar["status"] = "no_plan";
      if (planned !== null && planned > 0) {
        variancePct = round2(((actual - planned) / planned) * 100);
        status = variancePct > HISTOGRAM_VARIANCE_THRESHOLD ? "over"
          : variancePct < -HISTOGRAM_VARIANCE_THRESHOLD ? "under"
          : "on_track";
      }

      return {
        periodCode: String(r.periodCode),
        plannedMh: planned,
        actualMh: actual,
        subMh: sub,
        directMh: direct,
        plannedHeadcount: r.plannedHeadcount === null || r.plannedHeadcount === undefined ? null : Number(r.plannedHeadcount),
        actualHeadcount: r.actualHeadcount === null || r.actualHeadcount === undefined ? null : Number(r.actualHeadcount),
        variancePct,
        status,
      };
    });

  const withPlan = bars.filter((b) => b.plannedMh !== null);
  const totalPlanned = withPlan.length > 0 ? round2(withPlan.reduce((s, b) => s + (b.plannedMh ?? 0), 0)) : null;
  const totalActual = round2(bars.reduce((s, b) => s + b.actualMh, 0));

  /* جمع انحراف فقط از دوره‌هایی که برنامه دارند: وگرنه دوره‌های
   * بی‌برنامه مخرج را باد می‌کنند و انحراف کل کوچک‌تر از واقع می‌شود. */
  const plannedActual = round2(withPlan.reduce((s, b) => s + b.actualMh, 0));

  const peak = bars.reduce<HistogramBar | null>((mx, b) => (!mx || b.actualMh > mx.actualMh ? b : mx), null);

  return {
    bars,
    totals: {
      plannedMh: totalPlanned,
      actualMh: totalActual,
      directMh: round2(bars.reduce((s, b) => s + b.directMh, 0)),
      subMh: round2(bars.reduce((s, b) => s + b.subMh, 0)),
      variancePct: totalPlanned !== null && totalPlanned > 0
        ? round2(((plannedActual - totalPlanned) / totalPlanned) * 100)
        : null,
      peakPeriod: peak && peak.actualMh > 0 ? peak.periodCode : null,
      peakMh: peak?.actualMh ?? 0,
      periodsWithPlan: withPlan.length,
      periodsWithoutPlan: bars.length - withPlan.length,
    },
  };
}

/* ─────────── ۲. منحنی S تجمعی ─────────── */

export type SCurvePoint = {
  periodCode: string;
  cumPlannedMh: number | null;
  cumActualMh: number;
  cumPlannedPct: number | null;
  cumActualPct: number | null;
  /** اختلاف درصد تجمعی؛ منفی یعنی عقب‌افتادگی. */
  deltaPct: number | null;
};

/**
 * منحنی S نفر-ساعت.
 *
 * درصد تجمعی بر پایهٔ **کل برنامه** حساب می‌شود نه کل واقعی: اگر مخرج
 * را واقعی می‌گرفتیم، پروژه‌ای که نصف کار را کرده همیشه ۱۰۰٪ نشان
 * می‌داد و منحنی بی‌معنا می‌شد.
 */
export function manpowerSCurve(bars: HistogramBar[]): {
  points: SCurvePoint[];
  totalPlannedMh: number | null;
  hasBaseline: boolean;
} {
  const totalPlanned = bars.some((b) => b.plannedMh !== null)
    ? round2(bars.reduce((s, b) => s + (b.plannedMh ?? 0), 0))
    : null;
  const totalActual = round2(bars.reduce((s, b) => s + b.actualMh, 0));

  let cumP = 0, cumA = 0;
  const points = bars.map((b) => {
    if (b.plannedMh !== null) cumP = round2(cumP + b.plannedMh);
    cumA = round2(cumA + b.actualMh);

    const cumPlannedPct = totalPlanned && totalPlanned > 0 ? round2((cumP / totalPlanned) * 100) : null;
    /* درصد واقعی هم بر مبنای کل برنامه است تا دو منحنی روی یک محور
     * قابل مقایسه بمانند. بدون برنامه، درصدی هم وجود ندارد. */
    const cumActualPct = totalPlanned && totalPlanned > 0
      ? round2((cumA / totalPlanned) * 100)
      : (totalActual > 0 ? null : null);

    return {
      periodCode: b.periodCode,
      cumPlannedMh: b.plannedMh !== null || cumP > 0 ? cumP : null,
      cumActualMh: cumA,
      cumPlannedPct,
      cumActualPct,
      deltaPct: cumPlannedPct !== null && cumActualPct !== null ? round2(cumActualPct - cumPlannedPct) : null,
    };
  });

  return { points, totalPlannedMh: totalPlanned, hasBaseline: totalPlanned !== null && totalPlanned > 0 };
}

/* ─────────── ۳. شاخص‌های سطح پروژه ─────────── */

export const HR_KPI_CODES = [
  "HEADCOUNT", "TURNOVER_PCT", "COMPLIANCE_PCT", "UTILIZATION_PCT",
  "OT_PCT", "SUB_SHARE_PCT",
] as const;
export type HrKpiCode = (typeof HR_KPI_CODES)[number];

export const HR_KPI_FA: Record<HrKpiCode, string> = {
  HEADCOUNT: "سرشماری فعال",
  TURNOVER_PCT: "نرخ گردش نیرو",
  COMPLIANCE_PCT: "نرخ انطباق مدارک",
  UTILIZATION_PCT: "نرخ استفاده",
  OT_PCT: "سهم اضافه‌کاری",
  SUB_SHARE_PCT: "سهم نیروی پیمانکاری",
};

/** آستانهٔ هر شاخص؛ جهت «خوب» بودن با `higherIsBetter` مشخص می‌شود. */
export const HR_KPI_TARGETS: Record<HrKpiCode, { target: number | null; higherIsBetter: boolean; amberAt: number }> = {
  HEADCOUNT: { target: null, higherIsBetter: true, amberAt: 0 },
  TURNOVER_PCT: { target: 5, higherIsBetter: false, amberAt: 8 },
  COMPLIANCE_PCT: { target: 95, higherIsBetter: true, amberAt: 85 },
  UTILIZATION_PCT: { target: 85, higherIsBetter: true, amberAt: 70 },
  OT_PCT: { target: 15, higherIsBetter: false, amberAt: 25 },
  SUB_SHARE_PCT: { target: 40, higherIsBetter: false, amberAt: 60 },
};

export type HrKpi = {
  code: HrKpiCode;
  nameFa: string;
  value: number | null;
  target: number | null;
  status: "green" | "amber" | "red" | "na";
  /** چرا این عدد قابل اتکا نیست — خالی یعنی قابل اتکاست. */
  caveatFa: string | null;
};

function kpiStatus(code: HrKpiCode, value: number | null): HrKpi["status"] {
  if (value === null) return "na";
  const t = HR_KPI_TARGETS[code];
  if (t.target === null) return "na";
  if (t.higherIsBetter) {
    return value >= t.target ? "green" : value >= t.amberAt ? "amber" : "red";
  }
  return value <= t.target ? "green" : value <= t.amberAt ? "amber" : "red";
}

/**
 * شش شاخص کلیدی نیروی انسانی در سطح پروژه.
 *
 * هر شاخصی که مخرجش صفر باشد `null` می‌گیرد و `caveatFa` می‌گوید چرا.
 * تبدیل «نمی‌دانیم» به صفر، بدترین کاری است که یک داشبورد می‌تواند
 * بکند: مدیر عدد سبز می‌بیند و خیالش راحت می‌شود.
 */
export function hrKpiSet(input: {
  /** `null` یعنی «نمی‌دانیم»، که با صفر یکی نیست. */
  activeHeadcount?: number | null;
  periodStartHeadcount?: number;
  leaversInPeriod?: number;
  compliantCount?: number;
  totalPeople?: number;
  availableHours?: number;
  chargedHours?: number;
  otHours?: number;
  totalHours?: number;
  subMh?: number;
  directMh?: number;
}): HrKpi[] {
  const mk = (code: HrKpiCode, value: number | null, caveatFa: string | null = null): HrKpi => ({
    code,
    nameFa: HR_KPI_FA[code],
    value,
    target: HR_KPI_TARGETS[code].target,
    status: kpiStatus(code, value),
    caveatFa,
  });

  const out: HrKpi[] = [];
  /* سرشماری صفر در کنار هزاران نفر-ساعت ثبت‌شده، تناقضی است که
   * خواننده را گمراه می‌کند. وقتی دفتر پرسنلی خالی است ولی کارکرد
   * وجود دارد، پاسخ درست «نمی‌دانیم» است نه «صفر». */
  out.push(input.activeHeadcount === null || input.activeHeadcount === undefined
    ? mk("HEADCOUNT", null, "دفتر پرسنلی خالی است ولی کارکرد ثبت شده؛ سرشماری قابل استناد نیست")
    : mk("HEADCOUNT", Number(input.activeHeadcount)));

  /* گردش نیرو بر مبنای سرشماری ابتدای دوره؛ اگر دوره با صفر نفر شروع
   * شده باشد، نرخ گردش تعریف ندارد. */
  const base = Number(input.periodStartHeadcount ?? 0);
  out.push(base > 0
    ? mk("TURNOVER_PCT", round2((Number(input.leaversInPeriod ?? 0) / base) * 100))
    : mk("TURNOVER_PCT", null, "سرشماری ابتدای دوره صفر است؛ نرخ گردش تعریف ندارد"));

  const total = Number(input.totalPeople ?? 0);
  out.push(total > 0
    ? mk("COMPLIANCE_PCT", round2((Number(input.compliantCount ?? 0) / total) * 100))
    : mk("COMPLIANCE_PCT", null, "پروندهٔ پرسنلی ثبت نشده است"));

  /* مخرج باید **ظرفیت** باشد نه ساعت ثبت‌شده. اگر ساعت ثبت‌شده را
   * مخرج بگیریم، هر پروژه‌ای همیشه نزدیک ۱۰۰٪ سبز می‌شود — حتی
   * پروژه‌ای که یک‌دهم برنامه کار کرده. */
  const avail = Number(input.availableHours ?? 0);
  out.push(avail > 0
    ? mk("UTILIZATION_PCT", round2((Number(input.chargedHours ?? 0) / avail) * 100))
    : mk("UTILIZATION_PCT", null, "ظرفیت دوره محاسبه نشد؛ سرشماری فعال یا تقویم کاری در دسترس نیست"));

  const th = Number(input.totalHours ?? 0);
  out.push(th > 0
    ? mk("OT_PCT", round2((Number(input.otHours ?? 0) / th) * 100))
    : mk("OT_PCT", null, "در این دوره ساعتی ثبت نشده است"));

  const mix = round2(Number(input.subMh ?? 0) + Number(input.directMh ?? 0));
  out.push(mix > 0
    ? mk("SUB_SHARE_PCT", round2((Number(input.subMh ?? 0) / mix) * 100))
    : mk("SUB_SHARE_PCT", null, "در این دوره ساعتی ثبت نشده است"));

  return out;
}

/**
 * شمار روزهای کاری یک ماه `YYYY-MM` با احتساب تعطیلی هفتگی.
 *
 * تعطیلات رسمی اینجا نیست چون تقویم رسمی سالانه است و جای آن در
 * پیکربندی پروژه است، نه در یک تابع محاسباتی. نتیجه سقف ظرفیت است،
 * پس کمی خوش‌بینانه بودنش امن‌تر از کم‌برآورد کردن نرخ استفاده است.
 */
export function workingDaysInPeriod(periodCode: string, weekendDays: number[] = IRAN_LABOR_LAW.weekendDays): number {
  if (!/^\d{4}-\d{2}$/.test(periodCode)) return 0;
  const [y, m] = periodCode.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    if (!weekendDays.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay())) count++;
  }
  return count;
}

/** ظرفیت نفر-ساعت یک بازه: سرشماری × روز کاری × سقف روزانه. */
export function capacityMh(
  activeHeadcount: number | null,
  periodCodes: string[],
  dailyCap: number = IRAN_LABOR_LAW.dailyNormalCap
): number | null {
  if (activeHeadcount === null || activeHeadcount <= 0) return null;
  const days = periodCodes.reduce((s, c) => s + workingDaysInPeriod(c), 0);
  if (days <= 0) return null;
  return round2(activeHeadcount * days * dailyCap);
}

/* ─────────── ۴. تجمیع رسته‌ای و سازمانی ─────────── */

export type BreakdownRow = {
  key: string;
  nameFa: string;
  directMh: number;
  subMh: number;
  totalMh: number;
  sharePct: number;
  headcount: number;
};

/**
 * تجمیع ساعت بر اساس بُعد دلخواه (رسته، گره سازمانی، اکیپ).
 *
 * سهم درصدی از جمع کل همان نما حساب می‌شود، نه از کل پروژه: اگر
 * فیلتری اعمال شده باشد، سهم‌ها باید روی همان زیرمجموعه جمع ۱۰۰ شوند
 * وگرنه نمودار دایره‌ای ناقص می‌شود.
 */
export function mhBreakdown(
  rows: { key?: string; nameFa?: string; directMh?: number; subMh?: number; personId?: string }[],
  labelOf: (key: string) => string = (k) => k
): BreakdownRow[] {
  const acc = new Map<string, { direct: number; sub: number; people: Set<string> }>();
  for (const r of rows) {
    const k = String(r.key ?? "");
    if (!acc.has(k)) acc.set(k, { direct: 0, sub: 0, people: new Set() });
    const a = acc.get(k)!;
    a.direct = round2(a.direct + Number(r.directMh ?? 0));
    a.sub = round2(a.sub + Number(r.subMh ?? 0));
    if (r.personId) a.people.add(String(r.personId));
  }

  const total = round2([...acc.values()].reduce((s, a) => s + a.direct + a.sub, 0));
  return [...acc.entries()]
    .map(([key, a]) => {
      const totalMh = round2(a.direct + a.sub);
      return {
        key,
        nameFa: labelOf(key),
        directMh: a.direct,
        subMh: a.sub,
        totalMh,
        sharePct: total > 0 ? round2((totalMh / total) * 100) : 0,
        headcount: a.people.size,
      };
    })
    .sort((a, b) => b.totalMh - a.totalMh);
}

/* ─────────── ۵. هشدار زودهنگام سطح تحلیل ─────────── */

export type HrAlert = {
  code: string;
  severity: "high" | "medium" | "low";
  messageFa: string;
  metricCode?: string;
};

/**
 * هشدارهای سطح تحلیل.
 *
 * عمداً از `hrmEws` (D1) جدا است: آن روی دادهٔ برنامه‌ریزی کار می‌کند و
 * این روی نتیجهٔ تجمیع‌شدهٔ دوره. یکی کردنشان یعنی هشدار تجهیز و هشدار
 * عملکرد در یک صف قاطی شوند در حالی که مخاطبشان دو نفر متفاوت است.
 */
export function hrAnalyticsAlerts(input: {
  kpis?: HrKpi[];
  histogram?: { totals: { variancePct: number | null; periodsWithoutPlan: number } };
  sCurve?: { points: SCurvePoint[]; hasBaseline: boolean };
  blockedActiveCount?: number;
  expiringSoonCount?: number;
  /** تعارض همگام‌سازی باز — بخشی از کارکرد که هنوز تکلیفش روشن نیست. */
  openSyncConflicts?: number;
}): HrAlert[] {
  const out: HrAlert[] = [];
  const byCode = new Map((input.kpis ?? []).map((k) => [k.code, k]));

  for (const k of input.kpis ?? []) {
    if (k.status === "red") {
      out.push({
        code: `EWS-HRA-${k.code}`,
        severity: "high",
        metricCode: k.code,
        messageFa: `${k.nameFa} برابر ${k.value}٪ است و از آستانهٔ ${k.target} فاصلهٔ بحرانی دارد`,
      });
    }
  }

  const hv = input.histogram?.totals.variancePct;
  if (hv !== null && hv !== undefined && Math.abs(hv) > HISTOGRAM_VARIANCE_THRESHOLD) {
    out.push({
      code: "EWS-HRA-MOB",
      severity: Math.abs(hv) > 25 ? "high" : "medium",
      messageFa: hv > 0
        ? `نفر-ساعت واقعی ${hv}٪ بیشتر از برنامه است؛ یا برنامه کم‌برآورد بوده یا بهره‌وری افت کرده`
        : `نفر-ساعت واقعی ${Math.abs(hv)}٪ کمتر از برنامه است؛ کسری تجهیز به تأخیر برنامه منجر می‌شود`,
    });
  }

  /* دورهٔ بی‌برنامه خودش یک هشدار است: بدون آن، نصف نمودار بی‌مبنا
   * است و کسی متوجه نمی‌شود. */
  const noPlan = input.histogram?.totals.periodsWithoutPlan ?? 0;
  if (noPlan > 0) {
    out.push({
      code: "EWS-HRA-NOPLAN",
      severity: "medium",
      messageFa: `${noPlan} دوره برنامهٔ نیرو ندارد؛ انحراف آن‌ها محاسبه‌نشدنی است و در جمع کل نیامده`,
    });
  }

  if (input.sCurve && !input.sCurve.hasBaseline) {
    out.push({
      code: "EWS-HRA-NOBASE",
      severity: "medium",
      messageFa: "برنامهٔ مبنا برای این پروژه ثبت نشده؛ منحنی S فقط روند واقعی را نشان می‌دهد نه انحراف را",
    });
  } else if (input.sCurve) {
    const last = input.sCurve.points.at(-1);
    if (last && last.deltaPct !== null && last.deltaPct < -10) {
      out.push({
        code: "EWS-HRA-SLIP",
        severity: "high",
        messageFa: `تا پایان دوره ${Math.abs(last.deltaPct)}٪ از منحنی برنامه عقب است`,
      });
    }
  }

  if ((input.blockedActiveCount ?? 0) > 0) {
    out.push({
      code: "EWS-HRA-BLOCKED",
      severity: "high",
      messageFa: `${input.blockedActiveCount} نفر فعال با مدرک منقضی سر کار هستند؛ سامانه آن‌ها را مجاز می‌داند ولی نیستند`,
    });
  }
  /* تعارض باز یعنی عددِ همین گزارش ناقص است. بدون این هشدار، داشبورد
   * با اطمینان کامل رقمی را نشان می‌دهد که خودش می‌داند تمام نیست. */
  if ((input.openSyncConflicts ?? 0) > 0) {
    out.push({
      code: "EWS-HRA-UNSYNCED",
      severity: "medium",
      messageFa: `${input.openSyncConflicts} تعارض همگام‌سازی باز است؛ ارقام این گزارش تا تعیین تکلیف آن‌ها کامل نیست`,
    });
  }

  if ((input.expiringSoonCount ?? 0) > 0) {
    out.push({
      code: "EWS-HRA-EXPIRING",
      severity: "low",
      messageFa: `${input.expiringSoonCount} نفر مدرک رو به انقضا دارند`,
    });
  }

  /* کارکرد بدون پرونده یعنی هیچ‌کدام از گیت‌های D7 روی این ساعت‌ها
   * اجرا نشده؛ عدد هست ولی پشتوانهٔ انطباق ندارد. */
  if (byCode.get("HEADCOUNT")?.value === null) {
    out.push({
      code: "EWS-HRA-NOREG",
      severity: "high",
      messageFa: "برای این پروژه کارکرد ثبت شده ولی پروندهٔ پرسنلی وجود ندارد؛ ساعت‌ها پشتوانهٔ انطباق ندارند",
    });
  }

  const comp = byCode.get("COMPLIANCE_PCT");
  if (comp?.value === null) {
    out.push({
      code: "EWS-HRA-NODATA",
      severity: "low",
      messageFa: "نرخ انطباق محاسبه نشد چون پروندهٔ پرسنلی ثبت نشده است",
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/* ─────────── ۶. سربرگ گزارش ─────────── */

/**
 * خلاصهٔ یک‌خطی وضعیت نیرو برای سربرگ گزارش A4.
 *
 * جمله‌ای که مدیر در سه ثانیه می‌خواند. اگر داده ناقص باشد، جمله
 * صریحاً همان را می‌گوید — نه اینکه با اعداد صفر خوش‌بین به نظر برسد.
 */
export function hrHeadlineFa(kpis: HrKpi[], alerts: HrAlert[]): string {
  const hc = kpis.find((k) => k.code === "HEADCOUNT")?.value ?? null;
  const comp = kpis.find((k) => k.code === "COMPLIANCE_PCT");
  const high = alerts.filter((a) => a.severity === "high").length;

  const parts: string[] = [hc === null ? "سرشماری نامعلوم" : `${hc} نفر فعال`];
  if (comp?.value === null) parts.push("نرخ انطباق نامعلوم");
  else parts.push(`${comp?.value}٪ انطباق مدارک`);

  parts.push(high > 0 ? `${high} هشدار بحرانی` : "بدون هشدار بحرانی");
  return parts.join(" · ");
}

/* ══════════════════ D9 — همگام‌سازی میدانی و کارتابل تعارض ══════════════════
 *
 * D4 قرارداد حل تعارض را بست (`resolveSyncConflict`) ولی سه چیز باز ماند
 * که بدون آن‌ها یک دستگاه آفلاین واقعی کار نمی‌کند:
 *
 *   ۱) **ارسال دسته‌ای.** گوشی‌ای که سه روز آفلاین بوده، سی برگه دارد.
 *      سی درخواست جدا یعنی سی فرصت برای قطع شدن وسط کار.
 *   ۲) **ایدمپوتنسی.** شبکهٔ کارگاه قطع می‌شود *بعد* از اینکه سرور
 *      نوشت و *قبل* از اینکه پاسخ برسد. دستگاه دوباره می‌فرستد. اگر
 *      سرور دو بار بنویسد، نفر-ساعت دو برابر می‌شود.
 *   ۳) **بستن تعارض.** دفتر تعارض فقط خواندنی بود؛ ردیف `open` تا ابد
 *      باز می‌ماند و کسی نمی‌دانست تکلیفش چیست.
 *
 * اصل حاکم این بخش: **هیچ نسخه‌ای بی‌صدا دور ریخته نمی‌شود.** بازنده
 * همیشه در دفتر تعارض می‌نشیند، چون کار اپراتوری که در کارگاه امضا
 * گرفته، دادهٔ واقعی است حتی وقتی برنده نیست.
 */

/* ─────────── ۱. ایدمپوتنسی دسته ─────────── */

/**
 * اثر انگشت یک دسته — مبنای تشخیص ارسال تکراری.
 *
 * از محتوا ساخته می‌شود نه از زمان: دستگاهی که همان دسته را دوباره
 * می‌فرستد باید همان اثر انگشت را تولید کند، وگرنه ایدمپوتنسی
 * بی‌معناست. ترتیب برگه‌ها هم بی‌اثر است چون دستگاه ممکن است صف را
 * جور دیگری مرتب کند.
 *
 * الگوریتم عمداً ساده و بدون وابستگی است (FNV-1a 32 بیتی): این یک
 * مهر ضدجعل نیست، فقط کلید تشخیص تکرار است. برای ضدجعل، امضای
 * دیجیتال لازم است که در دامنهٔ این مخزن نیست.
 */
export function batchFingerprint(deviceId: string, items: { id?: string; revision?: number }[]): string {
  const canon = items
    .map((x) => `${String(x.id ?? "")}@${Number(x.revision ?? 1)}`)
    .sort()
    .join("|");
  const input = `${String(deviceId ?? "")}::${canon}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `bf-${h.toString(16).padStart(8, "0")}-${items.length}`;
}

/* ─────────── ۲. اعتبارسنجی دسته ─────────── */

export const SYNC_BATCH_MAX = 200;

export type SyncBatchItem = {
  id?: string;
  status?: string;
  revision?: number;
  capturedAt?: string;
  foremanSignatureRef?: string;
  deviceId?: string;
};

export type SyncIssue = {
  code: string;
  severity: "error" | "warning";
  messageFa: string;
  itemId?: string | null;
  index?: number;
};

/**
 * اعتبارسنجی دسته پیش از هر نوشتنی.
 *
 * دسته یا کامل پذیرفته می‌شود یا کامل رد — پذیرش نیمه‌کاره بدترین
 * حالت است: دستگاه نمی‌داند کدام برگه رفته و کدام نه، و اپراتور
 * دوباره می‌فرستد.
 */
export function validateSyncBatch(input: {
  deviceId?: string;
  items?: SyncBatchItem[];
  capturedAtMax?: string;
}): SyncIssue[] {
  const out: SyncIssue[] = [];
  const items = input.items ?? [];

  if (!String(input.deviceId ?? "").trim()) {
    out.push({ code: "E-HRM-420", severity: "error", messageFa: "شناسهٔ دستگاه الزامی است؛ بدون آن تعارض قابل ردیابی نیست" });
  }
  if (items.length === 0) {
    out.push({ code: "E-HRM-421", severity: "error", messageFa: "دستهٔ خالی ارسال شد" });
  }
  if (items.length > SYNC_BATCH_MAX) {
    out.push({
      code: "E-HRM-422", severity: "error",
      messageFa: `دسته ${items.length} برگه دارد؛ سقف هر ارسال ${SYNC_BATCH_MAX} برگه است`,
    });
  }

  const seen = new Set<string>();
  items.forEach((it, i) => {
    const id = String(it.id ?? "").trim();
    if (!id) {
      out.push({ code: "E-HRM-423", severity: "error", index: i, itemId: null, messageFa: `ردیف ${i + 1}: شناسهٔ برگه ندارد` });
      return;
    }
    /* شناسهٔ تکراری *داخل* یک دسته یعنی صف دستگاه خراب است؛ اگر
     * می‌پذیرفتیم، دومی روی اولی می‌نوشت و یکی از دو برگه گم می‌شد. */
    if (seen.has(id)) {
      out.push({ code: "E-HRM-424", severity: "error", index: i, itemId: id, messageFa: `شناسهٔ ${id} در همین دسته تکرار شده است` });
    }
    seen.add(id);

    if (it.revision !== undefined && Number(it.revision) < 1) {
      out.push({ code: "E-HRM-425", severity: "error", index: i, itemId: id, messageFa: `شمارهٔ نسخهٔ ${id} باید از ۱ شروع شود` });
    }

    /* ساعت دستگاه در کارگاه قابل اعتماد نیست. زمان آیندهٔ دور نشانهٔ
     * تنظیم غلط ساعت است — هشدار می‌دهیم ولی برگه را رد نمی‌کنیم،
     * چون ساعت غلط دلیلی برای دور ریختن کار واقعی نیست. */
    if (it.capturedAt && input.capturedAtMax && String(it.capturedAt) > String(input.capturedAtMax)) {
      out.push({
        code: "W-HRM-426", severity: "warning", index: i, itemId: id,
        messageFa: `زمان ثبت ${id} از زمان سرور جلوتر است؛ ساعت دستگاه احتمالاً تنظیم نیست`,
      });
    }
  });

  return out;
}

/* ─────────── ۳. خلاصهٔ نتیجهٔ دسته ─────────── */

export type SyncOutcome = {
  itemId: string;
  winner: "server" | "local" | "none";
  action: "apply_local" | "keep_server" | "create_needed" | "noop";
  code: string;
  ruleFa: string;
  conflictRecorded: boolean;
  requiresAdjustment: boolean;
};

export type SyncBatchSummary = {
  total: number;
  applied: number;
  kept: number;
  created: number;
  conflicts: number;
  needsAdjustment: number;
  /** برگه‌هایی که تکلیفشان با یک آدم است، نه با ماشین. */
  blockedIds: string[];
  messageFa: string;
};

/**
 * جمع‌بندی دسته برای پاسخ به دستگاه.
 *
 * دستگاه باید بداند کدام برگه‌ها را می‌تواند از صف محلی پاک کند و
 * کدام‌ها منتظر تصمیم انسان‌اند. پاک کردن زودهنگام صف = گم شدن دائمی
 * کار اپراتور.
 */
export function summarizeSyncBatch(outcomes: SyncOutcome[]): SyncBatchSummary {
  const s: SyncBatchSummary = {
    total: outcomes.length,
    applied: 0, kept: 0, created: 0,
    conflicts: 0, needsAdjustment: 0,
    blockedIds: [],
    messageFa: "",
  };
  for (const o of outcomes) {
    if (o.action === "apply_local") s.applied++;
    else if (o.action === "keep_server") s.kept++;
    else if (o.action === "create_needed") s.created++;
    if (o.conflictRecorded) s.conflicts++;
    if (o.requiresAdjustment) {
      s.needsAdjustment++;
      s.blockedIds.push(o.itemId);
    }
  }
  s.messageFa = s.needsAdjustment > 0
    ? `${s.total} برگه پردازش شد؛ ${s.needsAdjustment} برگه نیازمند سند اصلاحی است و در صف دستگاه می‌ماند`
    : `${s.total} برگه پردازش شد؛ ${s.applied} اعمال، ${s.kept} نسخهٔ سرور حفظ، ${s.created} نیازمند ارسال عادی`;
  return s;
}

/* ─────────── ۴. زنجیرهٔ امضا ─────────── */

export const SIGNATURE_ROLES = ["foreman", "qc", "pm", "client"] as const;
export type SignatureRole = (typeof SIGNATURE_ROLES)[number];

export const SIGNATURE_ROLE_FA: Record<SignatureRole, string> = {
  foreman: "سرپرست اکیپ",
  qc: "کنترل کیفیت",
  pm: "مدیر پروژه",
  client: "نمایندهٔ کارفرما",
};

export type SignatureLink = {
  role: string;
  ref?: string;
  signedAt?: string;
  signerId?: string;
};

export type ChainVerdict = {
  ok: boolean;
  signedRoles: string[];
  missingRolesFa: string[];
  issues: SyncIssue[];
  /** آیا ترتیب امضاها با ترتیب اقتدار می‌خواند؟ */
  orderOk: boolean;
};

/**
 * بررسی زنجیرهٔ امضای یک برگه.
 *
 * دو چیز بررسی می‌شود که در نگاه اول یکی به نظر می‌آیند ولی نیستند:
 * **کامل بودن** زنجیره، و **ترتیب** آن. امضای مدیر پروژه پیش از
 * امضای سرپرست، یعنی کسی برگه‌ای را تأیید کرده که هنوز کسی در
 * کارگاه صحتش را تأیید نکرده بود — و آن برگه مبنای پرداخت می‌شود.
 *
 * `requiredRoles` ورودی است نه ثابت: برگهٔ داخلی امضای کارفرما
 * نمی‌خواهد، ولی صورت‌وضعیت می‌خواهد.
 */
export function verifySignatureChain(
  links: SignatureLink[],
  requiredRoles: string[] = ["foreman"]
): ChainVerdict {
  const issues: SyncIssue[] = [];
  const signed: { role: string; at: string }[] = [];

  for (const l of links) {
    const role = String(l.role ?? "");
    if (!SIGNATURE_ROLES.includes(role as SignatureRole)) {
      issues.push({ code: "E-HRM-430", severity: "error", messageFa: `نقش امضای ناشناخته: ${role}` });
      continue;
    }
    /* امضای بدون مرجع یعنی ادعای امضا، نه امضا. */
    if (!String(l.ref ?? "").trim()) {
      issues.push({ code: "E-HRM-431", severity: "error", messageFa: `امضای «${SIGNATURE_ROLE_FA[role as SignatureRole]}» مرجع ندارد` });
      continue;
    }
    if (!String(l.signedAt ?? "").trim()) {
      issues.push({ code: "W-HRM-432", severity: "warning", messageFa: `امضای «${SIGNATURE_ROLE_FA[role as SignatureRole]}» زمان ندارد؛ ترتیب زنجیره قابل بررسی نیست` });
    }
    signed.push({ role, at: String(l.signedAt ?? "") });
  }

  const signedRoles = [...new Set(signed.map((x) => x.role))];
  const missing = requiredRoles.filter((r) => !signedRoles.includes(r));
  for (const m of missing) {
    issues.push({
      code: "E-HRM-433", severity: "error",
      messageFa: `امضای «${SIGNATURE_ROLE_FA[m as SignatureRole] ?? m}» در زنجیره نیست`,
    });
  }

  /* ترتیب فقط روی امضاهای زمان‌دار بررسی می‌شود؛ نبود زمان قبلاً
   * هشدار گرفته و نباید دو بار جریمه شود. */
  const dated = signed.filter((x) => x.at).sort((a, b) => a.at.localeCompare(b.at));
  let orderOk = true;
  for (let i = 1; i < dated.length; i++) {
    const prev = SIGNATURE_ROLES.indexOf(dated[i - 1].role as SignatureRole);
    const cur = SIGNATURE_ROLES.indexOf(dated[i].role as SignatureRole);
    if (cur < prev) {
      orderOk = false;
      issues.push({
        code: "E-HRM-434", severity: "error",
        messageFa: `امضای «${SIGNATURE_ROLE_FA[dated[i].role as SignatureRole]}» پیش از «${SIGNATURE_ROLE_FA[dated[i - 1].role as SignatureRole]}» ثبت شده است`,
      });
    }
  }

  return {
    ok: issues.filter((x) => x.severity === "error").length === 0,
    signedRoles,
    missingRolesFa: missing.map((m) => SIGNATURE_ROLE_FA[m as SignatureRole] ?? m),
    issues,
    orderOk,
  };
}

/* ─────────── ۵. بستن تعارض ─────────── */

export const CONFLICT_RESOLUTIONS = ["server_wins", "local_wins", "manual", "adjustment_raised"] as const;
export type ConflictResolution = (typeof CONFLICT_RESOLUTIONS)[number];

export const CONFLICT_RESOLUTION_FA: Record<ConflictResolution, string> = {
  server_wins: "نسخهٔ سرور تأیید شد",
  local_wins: "نسخهٔ دستگاه اعمال شد",
  manual: "تصمیم دستی",
  adjustment_raised: "سند اصلاحی صادر شد",
};

export type CloseConflictInput = {
  currentStatus?: string;
  resolution?: string;
  noteFa?: string;
  requiresAdjustment?: boolean;
  adjustmentId?: string | null;
};

export type CloseConflictVerdict = {
  ok: boolean;
  code: string;
  messageFa: string;
  detailsFa?: string[];
};

/**
 * آیا این تعارض بسته می‌شود؟
 *
 * دو گیت که هرکدام یک راه فرار را می‌بندند:
 *
 *   ۱) تعارضی که سند اصلاحی می‌خواهد، بدون آن سند بسته نمی‌شود.
 *      وگرنه «حل شد» زدن روی یک برگهٔ قفل‌شده، اختلاف را پنهان
 *      می‌کند بی‌آنکه چیزی اصلاح شود.
 *   ۲) تعارض بسته دوباره بسته نمی‌شود — بستن دوباره یعنی بازنویسی
 *      تصمیم قبلی و پاک شدن نام تصمیم‌گیرندهٔ اول.
 */
export function canCloseConflict(input: CloseConflictInput): CloseConflictVerdict {
  const status = String(input.currentStatus ?? "open");
  const resolution = String(input.resolution ?? "");

  if (status !== "open") {
    return {
      ok: false, code: "E-HRM-440",
      messageFa: `این تعارض قبلاً بسته شده است (وضعیت: ${status})`,
    };
  }
  if (!CONFLICT_RESOLUTIONS.includes(resolution as ConflictResolution)) {
    return {
      ok: false, code: "E-HRM-441",
      messageFa: "نوع تصمیم نامعتبر است",
      detailsFa: CONFLICT_RESOLUTIONS.map((c) => `${c} = ${CONFLICT_RESOLUTION_FA[c]}`),
    };
  }
  /* تصمیم دستی بدون توضیح، همان «بستن بی‌دلیل» است با نام بهتر. */
  if (resolution === "manual" && String(input.noteFa ?? "").trim().length < 10) {
    return {
      ok: false, code: "E-HRM-442",
      messageFa: "تصمیم دستی باید دلیل داشته باشد (حداقل ۱۰ نویسه)",
    };
  }
  if (input.requiresAdjustment && resolution !== "adjustment_raised") {
    return {
      ok: false, code: "E-HRM-443",
      /* پیام قبلی «روی دورهٔ بسته است» می‌گفت، ولی دلیل غالب در عمل
       * برگهٔ **امضاشده** است نه دورهٔ قفل. پیام غلط، کاربر را دنبال
       * مشکلی می‌فرستد که وجود ندارد. */
      messageFa: "نسخهٔ سرور امضا یا قفل شده است؛ این تعارض فقط با صدور سند اصلاحی بسته می‌شود",
    };
  }
  if (resolution === "adjustment_raised" && !String(input.adjustmentId ?? "").trim()) {
    return {
      ok: false, code: "E-HRM-444",
      messageFa: "شمارهٔ سند اصلاحی الزامی است",
    };
  }

  return {
    ok: true, code: "I-HRM-445",
    messageFa: CONFLICT_RESOLUTION_FA[resolution as ConflictResolution],
  };
}

/* ─────────── ۶. سلامت صف دستگاه‌ها ─────────── */

export type DeviceHealthRow = {
  deviceId: string;
  openConflicts: number;
  totalConflicts: number;
  lastSeenAt: string | null;
  /** روز از آخرین همگام‌سازی؛ `null` یعنی هرگز دیده نشده. */
  staleDays: number | null;
  flag: "green" | "amber" | "red";
  noteFa: string | null;
};

export const DEVICE_STALE_WARN_DAYS = 3;
export const DEVICE_STALE_CRIT_DAYS = 7;

/**
 * سلامت صف دستگاه‌های میدانی.
 *
 * دستگاهی که هفت روز همگام نشده، هفت روز داده در جیب کسی است. این
 * خطرناک‌تر از تعارض است چون تعارض دست‌کم دیده می‌شود؛ دادهٔ نرسیده
 * اصلاً وجود ندارد و برنامه‌ریز فکر می‌کند آن اکیپ کار نکرده.
 */
export function deviceHealth(
  conflicts: { DeviceId?: string; Status?: string; DetectedAt?: string }[],
  todayIso: string,
  lastSyncByDevice: Record<string, string> = {}
): DeviceHealthRow[] {
  const acc = new Map<string, { open: number; total: number; last: string | null }>();

  const touch = (id: string) => {
    if (!acc.has(id)) acc.set(id, { open: 0, total: 0, last: null });
    return acc.get(id)!;
  };

  for (const c of conflicts) {
    const id = String(c.DeviceId ?? "").trim();
    if (!id) continue;
    const a = touch(id);
    a.total++;
    if (String(c.Status ?? "") === "open") a.open++;
    const at = String(c.DetectedAt ?? "");
    if (at && (!a.last || at > a.last)) a.last = at;
  }

  /* دستگاهی که تعارض نداشته هم باید دیده شود — نبودِ تعارض با
   * نبودِ ارتباط اشتباه گرفته می‌شود. */
  for (const [id, at] of Object.entries(lastSyncByDevice)) {
    const a = touch(id);
    if (at && (!a.last || at > a.last)) a.last = at;
  }

  const rows: DeviceHealthRow[] = [];
  for (const [deviceId, a] of acc) {
    const staleDays = a.last ? daysBetween(String(a.last).slice(0, 10), todayIso) : null;
    let flag: DeviceHealthRow["flag"] = "green";
    let noteFa: string | null = null;

    if (staleDays === null) {
      flag = "amber";
      noteFa = "زمان آخرین همگام‌سازی ثبت نشده است";
    } else if (staleDays >= DEVICE_STALE_CRIT_DAYS) {
      flag = "red";
      noteFa = `${staleDays} روز است همگام نشده؛ داده‌های این مدت هنوز به سامانه نرسیده`;
    } else if (staleDays >= DEVICE_STALE_WARN_DAYS) {
      flag = "amber";
      noteFa = `${staleDays} روز است همگام نشده`;
    }
    /* تعارض باز از کهنگی مهم‌تر است: داده رسیده ولی بلاتکلیف مانده. */
    if (a.open > 0) {
      flag = "red";
      noteFa = `${a.open} تعارض باز دارد${noteFa ? ` · ${noteFa}` : ""}`;
    }

    rows.push({ deviceId, openConflicts: a.open, totalConflicts: a.total, lastSeenAt: a.last, staleDays, flag, noteFa });
  }

  /* بدترین اول: کارتابل باید با مشکل شروع شود نه با آرامش. */
  const rank = { red: 0, amber: 1, green: 2 };
  return rows.sort((x, y) => rank[x.flag] - rank[y.flag] || y.openConflicts - x.openConflicts);
}

/* ══════════════════ D11 — گزارش‌های رسمی و خروجی چندقالبی ══════════════════
 *
 * D8 عدد را ساخت و JSON داد. D11 آن را به **سندی** تبدیل می‌کند که
 * می‌شود روی میز گذاشت: سربرگ سه‌طرفه، شمارهٔ سند، دروازهٔ انتشار و
 * خروجی PDF/Word/Excel/CSV. این شکاف H-06 و L9 است که از D1 باز مانده.
 *
 * هیچ محاسبهٔ تازه‌ای اینجا نیست — و این عمدی است. اگر گزارش رسمی
 * محاسبهٔ خودش را داشت، دو سند از یک ماه دو رقم متفاوت می‌دادند و
 * جلسه سر «کدام درست است» می‌گذشت. سازندهٔ گزارش فقط شکل می‌دهد.
 *
 * تفاوت بنیادی با D8: آنجا مخاطب **داشبورد داخلی** بود و «نمی‌دانیم»
 * یک وضعیت قابل قبول. اینجا مخاطب **بیرون سازمان** است و سند ناقص
 * می‌تواند مبنای مطالبه شود. پس دروازهٔ انتشار وجود دارد.
 */

/* ─────────── ۱. کاتالوگ گزارش ─────────── */

export type HrmBi = { fa: string; en: string };

export type HrmReportDef = {
  code: string;
  title: HrmBi;
  periodicity: "daily" | "weekly" | "monthly" | "quarterly" | "adhoc";
  audiences: ("internal" | "official")[];
  purpose: HrmBi;
};

/**
 * چهار گزارش رسمی نیرو.
 *
 * تعداد عمداً کم است. کاتالوگ بیست‌تایی یعنی هیچ‌کدام نگهداری نمی‌شوند
 * و کاربر هم نمی‌داند کدام را باید بگیرد.
 *
 * `RPT-HRM-TS` تنها گزارشی است که مخاطب رسمی‌اش پیمانکار است، پس
 * فقط همان `official` می‌گیرد و بقیه هم داخلی و هم رسمی‌اند.
 */
export const HRM_REPORT_CATALOG: HrmReportDef[] = [
  {
    code: "RPT-HRM-MP",
    title: { fa: "گزارش هیستوگرام و انحراف نیرو", en: "Manpower Histogram & Variance" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: { fa: "برنامه در برابر واقعی به تفکیک دوره، با منحنی S تجمعی", en: "Plan vs actual by period with cumulative S-curve" },
  },
  {
    code: "RPT-HRM-TS",
    title: { fa: "صورت کارکرد رسمی نیرو", en: "Official Timesheet Certificate" },
    periodicity: "monthly",
    audiences: ["official"],
    purpose: { fa: "نفر-ساعت تأییدشدهٔ دوره به تفکیک رسته — مبنای صورت‌وضعیت", en: "Approved man-hours by trade — payment basis" },
  },
  {
    code: "RPT-HRM-PRD",
    title: { fa: "گزارش بهره‌وری و انحراف نرخ", en: "Productivity & Rate Variance" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: { fa: "شاخص بهره‌وری، نفر-ساعت کسب‌شده و ریشهٔ افت", en: "PI, earned man-hours and loss root cause" },
  },
  {
    code: "RPT-HRM-CMP",
    title: { fa: "گزارش انطباق مدارک و صلاحیت", en: "Document & Competency Compliance" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: { fa: "وضعیت مدارک، طب کار و آموزش HSE نیروی فعال", en: "Documents, medical and HSE training status" },
  },
];

export function hrmReportByCode(code: string): HrmReportDef | undefined {
  return HRM_REPORT_CATALOG.find((r) => r.code === code);
}

/* ─────────── ۲. دروازهٔ انتشار ─────────── */

export type HrmPublishBlockers = {
  /** تعارض همگام‌سازی باز — بخشی از کارکرد هنوز نرسیده. */
  openSyncConflicts?: number;
  /** برگهٔ کارکرد تأییدنشده در بازه. */
  unapprovedSheets?: number;
  /** دوره‌های بدون برنامهٔ مبنا. */
  periodsWithoutPlan?: number;
  /** نیروی فعال با مدرک مسدودکننده. */
  blockedActive?: number;
  /** سرشماری نامعلوم (دفتر پرسنلی خالی ولی کارکرد ثبت‌شده). */
  headcountUnknown?: boolean;
  /** مدارک نزدیک انقضا. */
  expiringSoon?: number;
};

export type HrmPublishVerdict = {
  ok: boolean;
  reasons: string[];
  warnings: string[];
};

/**
 * آیا این گزارش قابل ابلاغ رسمی است؟
 *
 * تفکیک «دلیل» از «هشدار» مهم‌ترین تصمیم این تابع است:
 *
 *   - **دلیل** چیزی است که عدد گزارش را *غلط* می‌کند. سند با آن بیرون
 *     نمی‌رود.
 *   - **هشدار** چیزی است که خواننده باید بداند ولی عدد را غلط
 *     نمی‌کند. در سند درج می‌شود.
 *
 * اگر همه‌چیز مسدودکننده بود، هیچ گزارشی هرگز صادر نمی‌شد و کاربر
 * دروازه را دور می‌زد؛ اگر همه‌چیز هشدار بود، دروازه بی‌معنا بود.
 *
 * گزارش داخلی دروازه ندارد: مخاطبش همان کسی است که می‌داند داده ناقص
 * است و دقیقاً برای دیدن همان نقص گزارش می‌گیرد.
 */
export function hrmPublishGate(
  audience: "internal" | "official",
  blockers: HrmPublishBlockers
): HrmPublishVerdict {
  if (audience === "internal") return { ok: true, reasons: [], warnings: [] };

  const reasons: string[] = [];
  const warnings: string[] = [];

  /* تعارض باز یعنی ساعتی که هنوز تکلیفش روشن نیست؛ صورت‌وضعیت روی
   * عدد ناتمام امضا نمی‌شود. */
  if ((blockers.openSyncConflicts ?? 0) > 0) {
    reasons.push(`${blockers.openSyncConflicts} تعارض همگام‌سازی باز — ساعت این برگه‌ها هنوز قطعی نیست`);
  }
  if ((blockers.unapprovedSheets ?? 0) > 0) {
    reasons.push(`${blockers.unapprovedSheets} برگهٔ کارکرد تأییدنشده در بازه — سند رسمی فقط بر ساعت تأییدشده استوار است`);
  }
  /* سرشماری نامعلوم یعنی مخرج شاخص‌ها معلوم نیست؛ درصدهای سند
   * بی‌پشتوانه‌اند. */
  if (blockers.headcountUnknown) {
    reasons.push("سرشماری نیروی فعال نامعلوم است — درصدهای این گزارش مخرج قابل اتکا ندارند");
  }
  if ((blockers.blockedActive ?? 0) > 0) {
    reasons.push(`${blockers.blockedActive} نفر فعال با مدرک مسدودکننده — انطباق پیش از ابلاغ باید تعیین تکلیف شود`);
  }

  if ((blockers.periodsWithoutPlan ?? 0) > 0) {
    warnings.push(`${blockers.periodsWithoutPlan} دوره بدون برنامهٔ مبنا — انحراف آن دوره‌ها محاسبه نشده است`);
  }
  if ((blockers.expiringSoon ?? 0) > 0) {
    warnings.push(`${blockers.expiringSoon} مدرک نزدیک انقضا در گزارش درج شده است`);
  }

  return { ok: reasons.length === 0, reasons, warnings };
}

/* ─────────── ۳. سربرگ ─────────── */

export type HrmParty = { name: string; logoText: string; role: HrmBi };

/**
 * سربرگ سه‌لوگو.
 *
 * شکل آن عمداً **همان** `Letterhead` گزارش‌ساز مرکزی است، نه یک شکل
 * تازه. اگر HRM سربرگ خودش را می‌ساخت، `validateLetterhead` و
 * `toPrintHtml` مشترک روی آن کار نمی‌کردند و کل زیرساخت گزارش دوباره
 * نوشته می‌شد.
 */
export type HrmLetterhead = {
  projectName: string;
  projectCode: string;
  contractNo: string;
  contractor: HrmParty;
  client: HrmParty;
  consultant: HrmParty;
  docNo: string;
  revision: string;
  issueDate: string;
  periodLabel: string;
  classification: "internal" | "confidential" | "public";
  distribution: string[];
  preparedBy: string;
  approvedBy: string;
};

export const HRM_DEFAULT_LETTERHEAD: HrmLetterhead = {
  projectName: "پروژه نمونه — واحد فرآورش گاز",
  projectCode: "OG-2401",
  contractNo: "C-1404-118",
  contractor: { name: "شرکت پیمانکار نمونه", logoText: "پیمانکار", role: { fa: "پیمانکار", en: "Contractor" } },
  client: { name: "شرکت کارفرمای نمونه", logoText: "کارفرما", role: { fa: "کارفرما", en: "Client" } },
  consultant: { name: "مهندسین مشاور نمونه", logoText: "مشاور", role: { fa: "مشاور", en: "Consultant" } },
  docNo: "",
  revision: "R00",
  issueDate: new Date().toISOString().slice(0, 10),
  periodLabel: "",
  /* نرخ ساعتی و پروندهٔ پرسنلی دادهٔ حساس‌اند؛ پیش‌فرض «محرمانه» است
   * نه «داخلی». */
  classification: "confidential",
  distribution: ["مدیر پروژه", "مدیر منابع انسانی", "امور قراردادها"],
  preparedBy: "واحد منابع انسانی",
  approvedBy: "مدیر پروژه",
};

/* ─────────── ۴. سازندهٔ گزارش ─────────── */

/**
 * ستون گزارش.
 *
 * نام فیلد `title` است نه `header` — چون `toCsv`/`toPrintHtml` مرکزی
 * همین را می‌خوانند. یک نام متفاوت یعنی خروجی بی‌صدا خالی می‌شود یا
 * می‌شکند؛ همان درسی که سربرگ داد.
 */
export type HrmReportColumn = {
  key: string;
  title: HrmBi;
  format?: "text" | "number" | "percent" | "currency" | "date" | "status";
  align?: "start" | "center" | "end";
  weight?: number;
};

export type HrmReportRow = Record<string, string | number | undefined>;

export type HrmReportSection =
  | { kind: "kpi"; title: HrmBi; cells: { label: HrmBi; value: string; tone?: "good" | "warn" | "bad" }[] }
  | { kind: "table"; title: HrmBi; note?: HrmBi; columns: HrmReportColumn[]; rows: HrmReportRow[] }
  | { kind: "text"; title: HrmBi; body: HrmBi };

export type HrmReport = {
  code: string;
  title: HrmBi;
  periodicity: HrmReportDef["periodicity"];
  sourceModule: string;
  audiences: ("internal" | "official")[];
  sections: HrmReportSection[];
};

/**
 * برچسب فارسی وضعیت هیستوگرام.
 *
 * یافتهٔ آزمون زنده: ستون با `format:"status"` تعریف شده بود، ولی آن
 * قالب واژگان **زمان‌بندی** را می‌خواهد (`critical`/`on_track`/…) و
 * وضعیت نیرو واژگان دیگری دارد (`over`/`under`/`no_plan`).
 * `primaveraColor` روی مقدار ناشناخته `undefined` می‌داد و رندر HTML
 * می‌شکست — یعنی خروجی چاپی برای همان گزارشی که مهم‌ترین است.
 *
 * راه‌حل: وضعیت به متن فارسی ترجمه می‌شود و ستون `text` می‌ماند.
 * استفاده از واژگان زمان‌بندی برای نیرو، معنای هر دو را خراب می‌کرد.
 */
export const HISTOGRAM_STATUS_FA: Record<string, string> = {
  over: "بیش از برنامه",
  under: "کمتر از برنامه",
  on_track: "مطابق برنامه",
  no_plan: "بدون برنامه",
};

const hcol = (
  key: string,
  fa: string,
  en: string,
  format: HrmReportColumn["format"] = "text"
): HrmReportColumn => ({ key, title: { fa, en }, format });

/** مقدار نامعلوم در سند رسمی «—» می‌شود، نه صفر. */
const cell = (v: number | null | undefined): string | number => (v === null || v === undefined ? "—" : v);

/**
 * گزارش هیستوگرام و انحراف نیرو (`RPT-HRM-MP`).
 *
 * ورودی مستقیماً خروجی `hrmBuildAnalytics` است؛ هیچ عددی دوباره
 * حساب نمی‌شود.
 */
export function buildManpowerReport(view: {
  histogram: { bars: HrmReportRow[]; totals: Record<string, unknown> };
  sCurve: { points: HrmReportRow[]; hasBaseline: boolean };
  kpis: { code: string; nameFa: string; value: number | null; status: string; caveatFa?: string }[];
  headlineFa?: string;
}): HrmReport {
  const t = view.histogram.totals as Record<string, number | null>;
  const kpi = (code: string) => view.kpis.find((k) => k.code === code);
  const tone = (s?: string) => (s === "red" ? "bad" : s === "amber" ? "warn" : "good") as "good" | "warn" | "bad";

  const sections: HrmReportSection[] = [
    {
      kind: "kpi",
      title: { fa: "چکیدهٔ دوره", en: "Period summary" },
      cells: [
        { label: { fa: "نفر-ساعت برنامه", en: "Planned MH" }, value: String(cell(t.plannedMh as number)) },
        { label: { fa: "نفر-ساعت واقعی", en: "Actual MH" }, value: String(cell(t.actualMh as number)) },
        {
          label: { fa: "انحراف", en: "Variance" },
          value: t.variancePct === null || t.variancePct === undefined ? "—" : `${t.variancePct}٪`,
          tone: t.variancePct === null || t.variancePct === undefined ? "warn" : Math.abs(Number(t.variancePct)) > 10 ? "bad" : "good",
        },
        {
          label: { fa: "سرشماری فعال", en: "Active headcount" },
          value: String(cell(kpi("HEADCOUNT")?.value ?? null)),
          tone: tone(kpi("HEADCOUNT")?.status),
        },
      ],
    },
    {
      kind: "table",
      title: { fa: "هیستوگرام دوره‌ای", en: "Periodic histogram" },
      /* دورهٔ بی‌برنامه در ستون انحراف «—» می‌گیرد نه صفر — صفر یعنی
       * «مطابق برنامه» که وقتی برنامه‌ای نیست، ادعای نادرستی است. */
      note: { fa: "دورهٔ بدون برنامهٔ مبنا انحراف ندارد و با «—» نمایش داده می‌شود", en: "Periods without baseline show no variance" },
      columns: [
        hcol("period", "دوره", "Period"),
        hcol("planned", "برنامه", "Planned", "number"),
        hcol("direct", "مستقیم", "Direct", "number"),
        hcol("sub", "پیمانکاری", "Subcontracted", "number"),
        hcol("actual", "واقعی", "Actual", "number"),
        hcol("variance", "انحراف٪", "Var %", "text"),
        hcol("status", "وضعیت", "Status", "text"),
      ],
      rows: view.histogram.bars.map((b) => ({
        period: String(b.periodCode ?? ""),
        planned: cell(b.plannedMh as number),
        direct: cell(b.directMh as number),
        sub: cell(b.subMh as number),
        actual: cell(b.actualMh as number),
        variance: b.variancePct === null || b.variancePct === undefined ? "—" : `${b.variancePct}٪`,
        status: HISTOGRAM_STATUS_FA[String(b.status ?? "")] ?? String(b.status ?? ""),
      })),
    },
  ];

  /* منحنی S بدون مبنا فقط جدولی از صفرهاست؛ حذفش صادقانه‌تر از
   * نمایش دادنش است. */
  if (view.sCurve.hasBaseline) {
    sections.push({
      kind: "table",
      title: { fa: "منحنی S تجمعی", en: "Cumulative S-curve" },
      columns: [
        hcol("period", "دوره", "Period"),
        hcol("cumPlanned", "تجمعی برنامه", "Cum. planned", "number"),
        hcol("cumActual", "تجمعی واقعی", "Cum. actual", "number"),
        hcol("plannedPct", "٪ برنامه", "Planned %", "text"),
        hcol("actualPct", "٪ واقعی", "Actual %", "text"),
      ],
      rows: view.sCurve.points.map((p) => ({
        period: String(p.periodCode ?? ""),
        cumPlanned: cell(p.cumPlannedMh as number),
        cumActual: cell(p.cumActualMh as number),
        plannedPct: p.plannedPct === null || p.plannedPct === undefined ? "—" : `${p.plannedPct}٪`,
        actualPct: p.actualPct === null || p.actualPct === undefined ? "—" : `${p.actualPct}٪`,
      })),
    });
  } else {
    sections.push({
      kind: "text",
      title: { fa: "منحنی S تجمعی", en: "Cumulative S-curve" },
      body: {
        fa: "برنامهٔ مبنای نیرو برای این بازه ثبت نشده است؛ منحنی S بدون مبنا معنا ندارد و درج نشد.",
        en: "No manpower baseline recorded for this range; the S-curve is omitted.",
      },
    });
  }

  if (view.headlineFa) {
    sections.push({
      kind: "text",
      title: { fa: "جمع‌بندی", en: "Summary" },
      body: { fa: view.headlineFa, en: "" },
    });
  }

  return {
    code: "RPT-HRM-MP",
    title: { fa: "گزارش هیستوگرام و انحراف نیرو", en: "Manpower Histogram & Variance" },
    periodicity: "monthly",
    sourceModule: "d10 · منابع انسانی و بهره‌وری",
    audiences: ["internal", "official"],
    sections,
  };
}

/**
 * صورت کارکرد رسمی (`RPT-HRM-TS`).
 *
 * این سند مبنای پرداخت است، پس **مبنای محاسبه** صریحاً در آن نوشته
 * می‌شود. سندی که نگوید کدام ساعت‌ها را شمرده، در جلسهٔ اختلاف
 * بی‌فایده است.
 */
export function buildTimesheetCertificate(view: {
  breakdown: HrmReportRow[];
  histogram: { totals: Record<string, unknown> };
  fromCode: string;
  toCode: string;
  groupByFa: string;
}): HrmReport {
  const t = view.histogram.totals as Record<string, number | null>;

  return {
    code: "RPT-HRM-TS",
    title: { fa: "صورت کارکرد رسمی نیرو", en: "Official Timesheet Certificate" },
    periodicity: "monthly",
    sourceModule: "d10 · منابع انسانی و بهره‌وری",
    audiences: ["official"],
    sections: [
      {
        kind: "text",
        title: { fa: "مبنای محاسبه", en: "Basis of calculation" },
        body: {
          fa: `ارقام این صورت کارکرد فقط از برگه‌های کارکرد تأییدشدهٔ مدیر پروژه (وضعیت pm_approved) و ابطال‌نشده در بازهٔ ${view.fromCode} تا ${view.toCode} استخراج شده است. حضور نیروی پیمانکاری با وضعیت ردشده در محاسبه نیامده. ساعت مستقیم و پیمانکاری در یک ستون جمع نشده‌اند.`,
          en: `Figures derive solely from PM-approved, non-voided timesheets between ${view.fromCode} and ${view.toCode}.`,
        },
      },
      {
        kind: "kpi",
        title: { fa: "جمع دوره", en: "Period totals" },
        cells: [
          { label: { fa: "نفر-ساعت مستقیم", en: "Direct MH" }, value: String(cell(t.directMh as number)) },
          { label: { fa: "نفر-ساعت پیمانکاری", en: "Subcontracted MH" }, value: String(cell(t.subMh as number)) },
          { label: { fa: "جمع کل", en: "Total MH" }, value: String(cell(t.actualMh as number)) },
        ],
      },
      {
        kind: "table",
        title: { fa: `تفکیک بر اساس ${view.groupByFa}`, en: "Breakdown" },
        columns: [
          hcol("label", "عنوان", "Label"),
          hcol("headcount", "نفرات", "Headcount", "number"),
          hcol("direct", "مستقیم", "Direct", "number"),
          hcol("sub", "پیمانکاری", "Subcontracted", "number"),
          hcol("total", "جمع", "Total", "number"),
          hcol("share", "سهم٪", "Share %", "text"),
        ],
        rows: view.breakdown.map((b) => ({
          label: String(b.labelFa ?? b.key ?? ""),
          headcount: cell(b.headcount as number),
          direct: cell(b.directMh as number),
          sub: cell(b.subMh as number),
          total: cell(b.totalMh as number),
          share: b.sharePct === null || b.sharePct === undefined ? "—" : `${b.sharePct}٪`,
        })),
      },
    ],
  };
}

/** گزارش انطباق مدارک (`RPT-HRM-CMP`). */
export function buildComplianceReport(view: {
  compliance: Record<string, unknown>;
  alerts: { code: string; severity: string; messageFa: string }[];
}): HrmReport {
  const c = view.compliance as Record<string, number | null>;
  const rate = c.compliancePct;

  return {
    code: "RPT-HRM-CMP",
    title: { fa: "گزارش انطباق مدارک و صلاحیت", en: "Document & Competency Compliance" },
    periodicity: "monthly",
    sourceModule: "d10 · منابع انسانی و بهره‌وری",
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: "وضعیت انطباق", en: "Compliance status" },
        cells: [
          { label: { fa: "کل پرونده", en: "Total files" }, value: String(cell(c.headcount)) },
          { label: { fa: "نیروی فعال", en: "Active" }, value: String(cell(c.activeCount)) },
          {
            label: { fa: "منطبق", en: "Compliant" },
            value: String(cell(c.activeCompliantCount)),
          },
          {
            label: { fa: "نرخ انطباق", en: "Compliance rate" },
            value: rate === null || rate === undefined ? "—" : `${rate}٪`,
            tone: rate === null || rate === undefined ? "warn" : Number(rate) >= 95 ? "good" : Number(rate) >= 85 ? "warn" : "bad",
          },
        ],
      },
      {
        kind: "table",
        title: { fa: "هشدارهای انطباق", en: "Compliance alerts" },
        columns: [
          hcol("severity", "شدت", "Severity", "text"),
          hcol("code", "کد", "Code"),
          hcol("message", "شرح", "Description"),
        ],
        /* هشدارِ شدت پایین در سند رسمی نویز است؛ خواننده باید فوری
         * ببیند چه چیزی واقعاً مهم است. */
        rows: view.alerts
          .filter((a) => a.severity === "high" || a.severity === "medium")
          .map((a) => ({
            severity: a.severity === "high" ? "بحرانی" : "متوسط",
            code: a.code,
            message: a.messageFa,
          })),
      },
    ],
  };
}

/** شمار ردیف جدولی — پایهٔ برآورد تعداد صفحهٔ A4. */
export function hrmReportRows(report: HrmReport): number {
  return report.sections.reduce((s, sec) => s + (sec.kind === "table" ? sec.rows.length : 0), 0);
}

/* ══════════════════ D12 — ارسال هزینهٔ نیرو به مالی ══════════════════
 *
 * D4 خطوط هزینه را ساخت (`buildTsCostLines`) ولی جایی نمی‌فرستاد.
 * D12 آن‌ها را به حساب هزینهٔ FIN می‌رساند.
 *
 * **دامنه (قید صریح کارفرما):** نرخ × ساعت برای هزینهٔ پروژه. فیش
 * حقوقی، بیمه، مالیات و عیدی محاسبه نمی‌شود — آن کار Payroll است و
 * در دامنهٔ این سامانه نیست. اگر روزی لازم شد، ماژول جداست نه
 * گسترش این فایل.
 *
 * سه اصل:
 *
 *   ۱) **HRM هزینه نمی‌نویسد، سند ارسال می‌سازد** (ADR-04). مالک
 *      `Actual` حساب هزینه، FIN است. HRM فقط سهم خودش را اعلام
 *      می‌کند و FIN آن را می‌پذیرد.
 *   ۲) **ارسال دوباره جمع را متورم نمی‌کند.** سهم قبلی از دفتر ثبت
 *      خوانده و کسر می‌شود، نه از متن یادداشت.
 *   ۳) **ساعت بدون نرخ گم نمی‌شود.** مبلغش نامعلوم می‌ماند ولی
 *      ساعتش شمرده و گزارش می‌شود — ساعت گم‌شده بدتر از مبلغ
 *      نامعلوم است.
 */

/* ─────────── ۱. انتخاب نرخ ─────────── */

export type RateCardRow = {
  TradeCode?: string;
  Grade?: string | null;
  HourlyRate?: number | string;
  Currency?: string;
  EffectiveFrom?: string;
  EffectiveTo?: string | null;
  Status?: string;
};

/**
 * نرخ معتبر یک رسته در یک تاریخ.
 *
 * چرا تاریخ ورودی است و «نرخ جاری» کافی نیست: هزینهٔ فروردین باید با
 * نرخ فروردین حساب شود. اگر همیشه آخرین نرخ را برمی‌داشتیم، هر
 * افزایش دستمزد کل تاریخ هزینهٔ پروژه را بازنویسی می‌کرد و مقایسهٔ
 * دوره‌ها بی‌معنا می‌شد.
 *
 * وقتی چند نسخه هم‌زمان معتبرند، **تازه‌ترین شروع** برنده است.
 */
export function rateCardFor(
  cards: RateCardRow[],
  tradeCode: string,
  onDate: string,
  grade?: string | null
): RateCardRow | null {
  const day = String(onDate).slice(0, 10);
  const eligible = cards.filter((c) => {
    if (String(c.Status ?? "active") !== "active") return false;
    if (String(c.TradeCode ?? "") !== tradeCode) return false;
    /* درجهٔ خواسته‌شده اگر موجود نبود، کارت بدون درجه پاسخ می‌دهد —
     * وگرنه یک درجهٔ تعریف‌نشده کل ردیف را بی‌نرخ می‌کرد. */
    const g = c.Grade ?? null;
    if (grade && g && String(g) !== String(grade)) return false;
    if (!grade && g) return false;
    const from = String(c.EffectiveFrom ?? "");
    if (from && from > day) return false;
    const to = c.EffectiveTo ? String(c.EffectiveTo) : null;
    if (to && to < day) return false;
    return true;
  });
  if (eligible.length === 0 && grade) return rateCardFor(cards, tradeCode, onDate, null);
  if (eligible.length === 0) return null;

  /* ترتیب اولویت: کارت **درجه‌دار** بر عمومی مقدم است، و در میان
   * هم‌رتبه‌ها تازه‌ترین شروع برنده. اگر فقط تاریخ ملاک بود، یک کارت
   * عمومیِ تازه‌تر می‌توانست نرخ اختصاصی یک درجه را بی‌صدا کنار
   * بزند. */
  return eligible.sort((a, b) => {
    const ga = a.Grade ? 0 : 1;
    const gb = b.Grade ? 0 : 1;
    if (ga !== gb) return ga - gb;
    return String(b.EffectiveFrom ?? "").localeCompare(String(a.EffectiveFrom ?? ""));
  })[0];
}

/** جست‌وجوگر نرخ آمادهٔ تحویل به `buildTsCostLines`. */
export function rateLookupFrom(cards: RateCardRow[], onDate: string): RateLookup {
  return (tradeCode: string, grade?: string) => {
    const card = rateCardFor(cards, tradeCode, onDate, grade ?? null);
    const v = Number(card?.HourlyRate ?? 0);
    return v > 0 ? v : null;
  };
}

/* ─────────── ۲. تجمیع به حساب هزینه ─────────── */

export type LaborPostingLine = {
  costAccountId: string;
  amount: number;
  equivalentHours: number;
  unpricedHours: number;
  tradeCount: number;
  memoFa: string;
};

export type LaborPostingPlan = {
  periodCode: string;
  lines: LaborPostingLine[];
  totalAmount: number;
  totalHours: number;
  /** ساعتی که حساب هزینه نداشت — قابل ارسال نیست. */
  unallocatedHours: number;
  unpricedHours: number;
  currency: string;
  isComplete: boolean;
};

/**
 * تبدیل خطوط هزینه به سطرهای ارسال، یکی به‌ازای هر حساب هزینه.
 *
 * ردیف بدون `cbsId` **حذف نمی‌شود**؛ ساعتش در `unallocatedHours`
 * می‌نشیند. اگر بی‌صدا کنار می‌رفت، جمع ساعت گزارش نیرو و جمع ساعت
 * سند ارسال دو عدد متفاوت می‌شدند و کسی نمی‌فهمید چرا.
 */
export function buildLaborPostings(input: {
  periodCode: string;
  lines: TsCostLine[];
  currency?: string;
}): LaborPostingPlan {
  const byAccount = new Map<string, LaborPostingLine & { trades: Set<string> }>();
  let unallocated = 0;
  let unpricedTotal = 0;

  for (const l of input.lines) {
    if (l.missingRate) unpricedTotal = round2(unpricedTotal + l.equivalentHours);

    const acc = String(l.cbsId ?? "").trim();
    if (!acc) {
      unallocated = round2(unallocated + l.equivalentHours);
      continue;
    }
    let row = byAccount.get(acc);
    if (!row) {
      row = {
        costAccountId: acc, amount: 0, equivalentHours: 0, unpricedHours: 0,
        tradeCount: 0, memoFa: "", trades: new Set<string>(),
      };
      byAccount.set(acc, row);
    }
    row.equivalentHours = round2(row.equivalentHours + l.equivalentHours);
    if (l.missingRate) row.unpricedHours = round2(row.unpricedHours + l.equivalentHours);
    else row.amount = round2(row.amount + (l.amount ?? 0));
    if (l.tradeCode) row.trades.add(l.tradeCode);
  }

  const lines: LaborPostingLine[] = [...byAccount.values()]
    .map(({ trades, ...row }) => ({
      ...row,
      tradeCount: trades.size,
      memoFa: `هزینهٔ نیرو دورهٔ ${input.periodCode} — ${trades.size} رسته، ${row.equivalentHours} نفر-ساعت معادل${
        row.unpricedHours > 0 ? ` (${row.unpricedHours} ساعت بدون نرخ، مبلغ‌گذاری نشده)` : ""
      }`,
    }))
    .sort((a, b) => b.amount - a.amount || a.costAccountId.localeCompare(b.costAccountId));

  return {
    periodCode: input.periodCode,
    lines,
    totalAmount: round2(lines.reduce((s, x) => s + x.amount, 0)),
    totalHours: round2(lines.reduce((s, x) => s + x.equivalentHours, 0)),
    unallocatedHours: unallocated,
    unpricedHours: unpricedTotal,
    currency: input.currency ?? "IRR",
    isComplete: unallocated === 0 && unpricedTotal === 0,
  };
}

/* ─────────── ۳. دروازهٔ ارسال ─────────── */

export type PostingBlockers = {
  /** آیا پیش‌شرط قفل رعایت شده؟ */
  periodLocked?: boolean;
  /** وضعیت واقعی قفل — فقط برای هشدار، نه برای مسدود کردن. */
  periodLockedActual?: boolean;
  unapprovedSheets?: number;
  openConflicts?: number;
  unpricedHours?: number;
  unallocatedHours?: number;
  alreadyPostedAt?: string | null;
};

export type PostingVerdict = {
  ok: boolean;
  reasons: string[];
  warnings: string[];
  code: string;
};

/**
 * آیا هزینهٔ این دوره قابل ارسال است؟
 *
 * **دورهٔ قفل‌شده مانع نیست — پیش‌شرط است.** این عمدی و برخلاف
 * دروازه‌های دیگر است: قفل یعنی «دیگر ساعتی اضافه نمی‌شود»، و ارسال
 * هزینه از دورهٔ باز یعنی رقمی که فردا عوض می‌شود. FIN نمی‌تواند روی
 * عددی که هنوز در حال تغییر است حساب باز کند.
 *
 * ساعت بدون نرخ **هشدار** است نه مانع: مبلغش نامعلوم است ولی بقیهٔ
 * حساب‌ها نباید معطل یک رستهٔ بی‌نرخ بمانند. ولی ساعت بدون حساب
 * هزینه هم هشدار است — چون اصلاً وارد ارسال نمی‌شود و رقم را خراب
 * نمی‌کند، فقط ناقص می‌گذارد.
 */
export function laborPostingGate(blockers: PostingBlockers): PostingVerdict {
  const reasons: string[] = [];
  const warnings: string[] = [];

  /* پیش‌شرط قفل به‌صورت پارامتر می‌آید تا فراخوان تصمیم بگیرد.
   *
   * در HRM ترتیب برعکسِ شهود است: `canLockPeriod` همهٔ برگه‌ها را
   * `posted` می‌خواهد و `posted` شدن نتیجهٔ همین ارسال است. پس قفل
   * **پس از** ارسال می‌آید، نه پیش از آن. */
  if (blockers.periodLocked === false) {
    reasons.push("پیش‌شرط قفل دوره رعایت نشده است");
  }
  if ((blockers.unapprovedSheets ?? 0) > 0) {
    reasons.push(`${blockers.unapprovedSheets} برگهٔ کارکرد تأییدنشده در دوره — فقط ساعت تأییدشده هزینه می‌شود`);
  }
  if ((blockers.openConflicts ?? 0) > 0) {
    reasons.push(`${blockers.openConflicts} تعارض همگام‌سازی باز — ساعت این برگه‌ها هنوز قطعی نیست`);
  }

  /* ارسال روی دورهٔ **قفل‌شده** ممنوع نیست — پس از سند اصلاحی لازم
   * می‌شود — ولی باید دیده شود، چون رقمی را عوض می‌کند که قبلاً
   * نهایی اعلام شده بود. */
  if (blockers.periodLockedActual) {
    warnings.push("دوره قفل است؛ ارسال دوباره رقم نهایی‌شدهٔ دفتر مالی را جایگزین می‌کند");
  }
  if ((blockers.unpricedHours ?? 0) > 0) {
    warnings.push(`${blockers.unpricedHours} نفر-ساعت بدون کارت نرخ؛ مبلغ آن ارسال نمی‌شود و ساعتش در دفتر ثبت می‌ماند`);
  }
  if ((blockers.unallocatedHours ?? 0) > 0) {
    warnings.push(`${blockers.unallocatedHours} نفر-ساعت بدون حساب هزینه؛ در ارسال نیامد`);
  }
  if (blockers.alreadyPostedAt) {
    warnings.push(`این دوره قبلاً در ${String(blockers.alreadyPostedAt).slice(0, 10)} ارسال شده؛ ارسال دوباره سهم قبلی را جایگزین می‌کند نه اضافه`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    warnings,
    code: reasons.length === 0 ? "I-HRM-450" : "E-HRM-451",
  };
}

/* ─────────── ۴. اعمال روی حساب هزینه ─────────── */

/**
 * مقدار تازهٔ `Actual` پس از جایگزینی سهم HRM.
 *
 * فرمول عمداً «کسر سهم قبلی، افزودن سهم تازه» است نه «افزودن».
 * ارسال دوباره — که در عمل همیشه پیش می‌آید، چون یک ردیف اصلاح
 * می‌شود و دوره دوباره ارسال می‌گردد — نباید رقم را دو برابر کند.
 */
export function applyLaborPosting(currentActual: number, previousShare: number, nextShare: number): number {
  return round2(Number(currentActual || 0) - Number(previousShare || 0) + Number(nextShare || 0));
}

/** کلید ایدمپوتنسی رویداد — پایهٔ قرارداد `hrm.labor.posted` در D13. */
export function laborEventKey(projectId: string, periodCode: string, costAccountId: string): string {
  return `hrm.labor.posted:${projectId}:${periodCode}:${costAccountId}`;
}

/* ══════════════════ D13 — قرارداد رویداد و یکپارچه‌سازی ══════════════════
 *
 * D12 هزینه را در دفتر مالی نشاند، ولی فقط **داخل همین سامانه**. ERP
 * سازمان چیزی نمی‌داند. شکاف H-04 از D1: «اسکیمای رسمی رویداد ارسال
 * هزینه به FIN».
 *
 * چرا صندوق خروجی و نه فراخوانی مستقیم: مصرف‌کننده ممکن است پایین
 * باشد. فراخوانی مستقیم یا تراکنش را نگه می‌دارد تا مقصد جواب بدهد،
 * یا رویداد را بی‌صدا از دست می‌دهد. الگوی outbox نوشتن محلی را قطعی
 * می‌کند و تحویل را به بعد می‌سپارد.
 *
 * اصل حاکم: **رویداد عکس لحظهٔ وقوع است، نه ارجاع به اکنون.** بار
 * کامل ذخیره می‌شود؛ اگر فقط شناسه می‌فرستادیم، مصرف‌کننده برمی‌گشت
 * و رویدادِ دیروز را با دادهٔ امروز می‌خواند.
 */

/* ─────────── ۱. کاتالوگ رویداد ─────────── */

export const EVENT_SCHEMA_VERSION = "1.0";

export type EventDef = {
  type: string;
  version: string;
  sourceModule: string;
  targetModule: string;
  titleFa: string;
  /** فیلدهای الزامی بار رویداد — قرارداد با مصرف‌کننده. */
  required: string[];
  descriptionFa: string;
};

/**
 * سه رویداد خروجی HRM.
 *
 * تعداد عمداً کم است و هر سه **واقعیت رخ‌داده** را اعلام می‌کنند نه
 * درخواست. `hrm.labor.posted` یعنی «هزینه ثبت شد»، نه «لطفاً ثبت
 * کن» — مصرف‌کننده نمی‌تواند ردش کند، فقط می‌تواند بپذیرد یا خطا
 * بدهد. رویداد به‌عنوان دستور، مالکیت داده را مبهم می‌کند.
 */
export const HRM_EVENT_CATALOG: EventDef[] = [
  {
    type: "hrm.labor.posted",
    version: EVENT_SCHEMA_VERSION,
    sourceModule: "d10",
    targetModule: "d5",
    titleFa: "ثبت هزینهٔ نیرو در دفتر مالی",
    required: ["projectId", "periodCode", "costAccountId", "amount", "equivalentHours", "currency"],
    descriptionFa: "پس از ارسال موفق هزینهٔ یک حساب در یک دوره منتشر می‌شود. مبلغ، سهم جایگزین‌شدهٔ HRM است نه افزوده.",
  },
  {
    type: "hrm.period.locked",
    version: EVENT_SCHEMA_VERSION,
    sourceModule: "d10",
    targetModule: "d5",
    titleFa: "قفل دورهٔ کارکرد",
    required: ["projectId", "periodCode", "lockedAt"],
    descriptionFa: "دوره بسته شد و ساعت تازه پذیرفته نمی‌شود؛ اصلاح فقط با سند اصلاحی.",
  },
  {
    type: "hrm.manhours.approved",
    version: EVENT_SCHEMA_VERSION,
    sourceModule: "d10",
    targetModule: "d2",
    titleFa: "نفر-ساعت تأییدشدهٔ دوره",
    required: ["projectId", "periodCode", "actualMh"],
    descriptionFa: "برای وزن‌دهی نفر-ساعتی برنامه؛ فقط ساعت تأییدشدهٔ مدیر پروژه.",
  },
];

export function eventDefOf(type: string): EventDef | undefined {
  return HRM_EVENT_CATALOG.find((e) => e.type === type);
}

/* ─────────── ۲. ساخت و اعتبارسنجی ─────────── */

export type EventEnvelope = {
  eventKey: string;
  eventType: string;
  schemaVersion: string;
  sourceModule: string;
  targetModule: string;
  projectId: string;
  entityName?: string;
  entityId?: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type EventIssue = { code: string; severity: "error" | "warning"; messageFa: string; field?: string };

/**
 * اعتبارسنجی بار رویداد در برابر قرارداد.
 *
 * چرا پیش از نوشتن و نه هنگام تحویل: رویداد ناقصی که در صندوق
 * می‌نشیند، بارها تلاش می‌شود و بارها شکست می‌خورد. خطا باید جایی
 * دیده شود که هنوز قابل اصلاح است.
 *
 * فیلد اضافه **خطا نیست** — مصرف‌کنندهٔ نسخهٔ قدیمی آن را نادیده
 * می‌گیرد و این همان چیزی است که سازگاری رو به جلو را ممکن می‌کند.
 */
export function validateEventPayload(type: string, payload: Record<string, unknown>): EventIssue[] {
  const def = eventDefOf(type);
  if (!def) {
    return [{ code: "E-HRM-470", severity: "error", messageFa: `نوع رویداد ${type} در کاتالوگ نیست` }];
  }
  const out: EventIssue[] = [];
  for (const f of def.required) {
    const v = payload[f];
    if (v === undefined || v === null || v === "") {
      out.push({ code: "E-HRM-471", severity: "error", field: f, messageFa: `فیلد الزامی «${f}» در بار رویداد نیست` });
    }
  }
  /* مبلغ منفی ممکن است (اصلاح رو به پایین) ولی باید عدد باشد. */
  for (const f of ["amount", "equivalentHours", "actualMh"]) {
    if (f in payload && !Number.isFinite(Number(payload[f]))) {
      out.push({ code: "E-HRM-472", severity: "error", field: f, messageFa: `مقدار «${f}» عدد نیست` });
    }
  }
  return out;
}

/**
 * ساخت پاکت رویداد.
 *
 * `eventKey` از **داده** ساخته می‌شود نه از زمان: همان رویداد دو بار
 * در صندوق نمی‌نشیند حتی اگر منبع دو بار تولیدش کند. این تنها دفاع
 * در برابر ارسال دوباره پس از قطعی شبکه است.
 */
export function buildEvent(input: {
  type: string;
  projectId: string;
  keyParts: string[];
  payload: Record<string, unknown>;
  entityName?: string;
  entityId?: string;
  occurredAt?: string;
}): { envelope: EventEnvelope | null; issues: EventIssue[] } {
  const def = eventDefOf(input.type);
  if (!def) {
    return { envelope: null, issues: [{ code: "E-HRM-470", severity: "error", messageFa: `نوع رویداد ${input.type} در کاتالوگ نیست` }] };
  }
  const issues = validateEventPayload(input.type, input.payload);
  if (issues.some((i) => i.severity === "error")) return { envelope: null, issues };

  return {
    envelope: {
      eventKey: [input.type, input.projectId, ...input.keyParts].join(":"),
      eventType: input.type,
      schemaVersion: def.version,
      sourceModule: def.sourceModule,
      targetModule: def.targetModule,
      projectId: input.projectId,
      entityName: input.entityName,
      entityId: input.entityId,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      payload: input.payload,
    },
    issues,
  };
}

/* ─────────── ۳. چرخهٔ تحویل ─────────── */

export const EVENT_STATES = ["pending", "delivered", "failed", "abandoned"] as const;
export type EventState = (typeof EVENT_STATES)[number];

export const EVENT_STATE_FA: Record<EventState, string> = {
  pending: "در صف تحویل",
  delivered: "تحویل شد",
  failed: "تلاش ناموفق",
  abandoned: "رهاشده — نیازمند رسیدگی",
};

/** پس از این تعداد تلاش، رویداد رها و به آدم سپرده می‌شود. */
export const EVENT_MAX_ATTEMPTS = 5;

export type DeliveryOutcome = {
  nextStatus: EventState;
  attemptCount: number;
  /** ثانیه تا تلاش بعدی؛ `null` یعنی تلاش دیگری نیست. */
  retryAfterSec: number | null;
  messageFa: string;
};

/**
 * وضعیت بعدی یک رویداد پس از تلاش تحویل.
 *
 * عقب‌نشینی نمایی است (۳۰ ثانیه × ۲^تلاش) و سقف دارد: مصرف‌کنندهٔ
 * پایین نباید با تلاش هر ثانیه بیشتر زمین بخورد.
 *
 * پس از سقف تلاش، وضعیت `abandoned` می‌شود نه `failed`. تفاوت مهم
 * است: `failed` یعنی «دوباره تلاش می‌کنیم»، `abandoned` یعنی «ماشین
 * دست کشید، آدم باید نگاه کند». رویدادی که تا ابد `failed` بماند،
 * هرگز دیده نمی‌شود.
 */
export function nextDeliveryState(input: {
  ok: boolean;
  attemptCount?: number;
  errorFa?: string;
}): DeliveryOutcome {
  const attempts = Number(input.attemptCount ?? 0) + 1;

  if (input.ok) {
    return { nextStatus: "delivered", attemptCount: attempts, retryAfterSec: null, messageFa: "تحویل شد" };
  }
  if (attempts >= EVENT_MAX_ATTEMPTS) {
    return {
      nextStatus: "abandoned",
      attemptCount: attempts,
      retryAfterSec: null,
      messageFa: `پس از ${attempts} تلاش تحویل نشد؛ نیازمند رسیدگی دستی${input.errorFa ? ` — ${input.errorFa}` : ""}`,
    };
  }
  return {
    nextStatus: "failed",
    attemptCount: attempts,
    retryAfterSec: Math.min(30 * 2 ** (attempts - 1), 3600),
    messageFa: `تلاش ${attempts} ناموفق${input.errorFa ? ` — ${input.errorFa}` : ""}`,
  };
}

/** آیا این رویداد الان آمادهٔ تلاش دوباره است؟ */
export function isDueForRetry(row: { Status?: string; AttemptCount?: number; DeliveredAt?: string | null; OccurredAt?: string }, nowIso: string): boolean {
  const st = String(row.Status ?? "pending");
  if (st === "delivered" || st === "abandoned") return false;
  if (st === "pending") return true;

  const attempts = Number(row.AttemptCount ?? 0);
  const waitSec = Math.min(30 * 2 ** Math.max(attempts - 1, 0), 3600);
  const base = new Date(String(row.OccurredAt ?? nowIso)).getTime();
  return new Date(nowIso).getTime() - base >= waitSec * 1000;
}

/* ─────────── ۴. سلامت صندوق ─────────── */

export type OutboxHealth = {
  total: number;
  pending: number;
  failed: number;
  abandoned: number;
  delivered: number;
  /** قدیمی‌ترین رویداد تحویل‌نشده — سن آن معیار واقعی سلامت است. */
  oldestPendingAt: string | null;
  stalenessHours: number | null;
  flag: "green" | "amber" | "red";
  noteFa: string | null;
};

export const OUTBOX_STALE_WARN_HOURS = 6;
export const OUTBOX_STALE_CRIT_HOURS = 24;

/**
 * سلامت صندوق خروجی.
 *
 * معیار **سن قدیمی‌ترین رویداد تحویل‌نشده** است نه تعداد. صد رویدادِ
 * پنج‌دقیقه‌ای سالم است؛ یک رویدادِ سه‌روزه یعنی دفتر مالی سازمان سه
 * روز است عقب مانده.
 */
export function outboxHealth(
  rows: { Status?: string; OccurredAt?: string }[],
  nowIso: string
): OutboxHealth {
  const h: OutboxHealth = {
    total: rows.length, pending: 0, failed: 0, abandoned: 0, delivered: 0,
    oldestPendingAt: null, stalenessHours: null, flag: "green", noteFa: null,
  };

  for (const r of rows) {
    const st = String(r.Status ?? "pending");
    if (st === "delivered") h.delivered++;
    else if (st === "failed") h.failed++;
    else if (st === "abandoned") h.abandoned++;
    else h.pending++;

    if (st !== "delivered") {
      const at = String(r.OccurredAt ?? "");
      if (at && (!h.oldestPendingAt || at < h.oldestPendingAt)) h.oldestPendingAt = at;
    }
  }

  if (h.oldestPendingAt) {
    const ms = new Date(nowIso).getTime() - new Date(h.oldestPendingAt).getTime();
    h.stalenessHours = Math.round((ms / 3_600_000) * 10) / 10;
  }

  /* رویداد رهاشده از کهنگی مهم‌تر است: ماشین دست کشیده و کسی خبر
   * ندارد. */
  if (h.abandoned > 0) {
    h.flag = "red";
    h.noteFa = `${h.abandoned} رویداد رهاشده — تحویل خودکار متوقف شده و نیازمند رسیدگی است`;
  } else if ((h.stalenessHours ?? 0) >= OUTBOX_STALE_CRIT_HOURS) {
    h.flag = "red";
    h.noteFa = `قدیمی‌ترین رویداد تحویل‌نشده ${h.stalenessHours} ساعت سن دارد`;
  } else if ((h.stalenessHours ?? 0) >= OUTBOX_STALE_WARN_HOURS) {
    h.flag = "amber";
    h.noteFa = `صف تحویل ${h.stalenessHours} ساعت عقب است`;
  }

  return h;
}

/* ─────────── ۵. آشتی‌دادن دو دفتر ─────────── */

export type ReconRow = {
  periodCode: string;
  costAccountId: string;
  postedAmount: number;
  eventAmount: number | null;
  status: "matched" | "not_emitted" | "mismatch" | "undelivered";
  noteFa: string;
};

/**
 * مقایسهٔ دفتر ارسال HRM با صندوق رویداد.
 *
 * چرا لازم است: ارسال هزینه و انتشار رویداد دو نوشتن جدا هستند. اگر
 * میانشان چیزی بشکند، دفتر مالی داخلی رقم دارد ولی ERP سازمان
 * ندارد — و هیچ‌کدام از دو طرف متوجه نمی‌شوند، چون هرکدام دفتر
 * خودش را کامل می‌بیند.
 *
 * این تابع همان شکاف خاموش را قابل دیدن می‌کند.
 */
export function reconcilePostings(
  postings: { PeriodCode?: string; CostAccountId?: string; Amount?: number | string }[],
  events: { EventType?: string; Status?: string; PayloadJson?: string; EventKey?: string }[]
): { rows: ReconRow[]; matched: number; issues: number } {
  /* کلید اصلاحی پسوند `#rN` می‌گیرد (رویداد تحویل‌شده بازنویسی
   * نمی‌شود). آشتی باید **تازه‌ترین** نسخه را ببیند، نه اولی — وگرنه
   * پس از هر اصلاح، `mismatch` کاذب می‌ساخت. */
  const byKey = new Map<string, { amount: number | null; status: string; revision: number }>();
  for (const e of events) {
    if (String(e.EventType ?? "") !== "hrm.labor.posted") continue;
    let amount: number | null = null;
    let revision = 0;
    try {
      const p = JSON.parse(String(e.PayloadJson ?? "{}"));
      amount = Number.isFinite(Number(p.amount)) ? Number(p.amount) : null;
      revision = Number(p.revision ?? 0) || 0;
    } catch { amount = null; }

    const raw = String(e.EventKey ?? "");
    const base = raw.split("#")[0];
    const prev = byKey.get(base);
    if (prev && prev.revision >= revision) continue;
    byKey.set(base, { amount, status: String(e.Status ?? "pending"), revision });
  }

  const rows: ReconRow[] = [];
  for (const p of postings) {
    const period = String(p.PeriodCode ?? "");
    const acc = String(p.CostAccountId ?? "");
    const posted = round2(Number(p.Amount ?? 0));
    /* تطبیق با پسوند کلید انجام می‌شود چون `projectId` در میانهٔ
     * کلید است و اینجا در دسترس نیست؛ `:دوره:حساب` به‌اندازهٔ کافی
     * یکتاست چون فراخوان همیشه ردیف یک پروژه را می‌دهد. */
    const hit = [...byKey.entries()].find(([k]) => k.endsWith(`:${period}:${acc}`));
    if (!hit) {
      rows.push({
        periodCode: period, costAccountId: acc, postedAmount: posted, eventAmount: null,
        status: "not_emitted",
        noteFa: "هزینه ثبت شد ولی رویدادی منتشر نشده؛ سامانهٔ بیرونی از این رقم بی‌خبر است",
      });
      continue;
    }
    const [, ev] = hit;
    if (ev.amount !== null && round2(ev.amount) !== posted) {
      rows.push({
        periodCode: period, costAccountId: acc, postedAmount: posted, eventAmount: round2(ev.amount),
        status: "mismatch",
        noteFa: "مبلغ رویداد با دفتر ارسال نمی‌خواند؛ احتمالاً ارسال دوباره بدون انتشار رویداد تازه",
      });
      continue;
    }
    if (ev.status !== "delivered") {
      rows.push({
        periodCode: period, costAccountId: acc, postedAmount: posted, eventAmount: ev.amount,
        status: "undelivered",
        noteFa: `رویداد ساخته شد ولی هنوز تحویل نشده (${EVENT_STATE_FA[ev.status as EventState] ?? ev.status})`,
      });
      continue;
    }
    rows.push({
      periodCode: period, costAccountId: acc, postedAmount: posted, eventAmount: ev.amount,
      status: "matched", noteFa: "منطبق",
    });
  }

  const order = { mismatch: 0, not_emitted: 1, undelivered: 2, matched: 3 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.costAccountId.localeCompare(b.costAccountId));

  return {
    rows,
    matched: rows.filter((r) => r.status === "matched").length,
    issues: rows.filter((r) => r.status !== "matched").length,
  };
}
