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
