/**
 * منطق دامنهٔ CMMS / EAM / APM — لایهٔ محاسباتی خالص.
 *
 * این فایل عمداً هیچ I/O، شبکه یا وابستگی به persistence ندارد تا:
 *   ۱) مستقیماً در مرورگر (فرانت‌اند) و هم در سرور قابل استفاده باشد؛
 *   ۲) با esbuild به `server/cmmsLogic.js` باندل شود و آزمون‌ها بدون
 *      دیتابیس، رفتار استانداردها را بسنجند.
 *
 * استانداردهای پیاده‌شده در این فایل:
 *   • ISO 14224      — تاکسونومی و کدینگ قابلیت اطمینان تجهیز
 *   • IEC 60812      — FMEA/FMECA، RPN و عدد بحرانی‌بودن
 *   • IEC 60300-3-11 — منطق تصمیم هفت‌گامی RCM
 *   • ISO 17359 / ISO 10816 — پایش وضعیت و منطقه‌بندی ارتعاش
 *   • IEEE 1366      — SAIDI / SAIFI / CAIDI / ASAI / MAIFI
 *   • OEE v2         — اثربخشی کلی تجهیزات و شش اتلاف بزرگ
 *   • IEC 60300-3-3  — هزینهٔ چرخهٔ عمر (LCC) با ارزش فعلی خالص
 *   • BS EN 15341    — دسته‌بندی و سلامت شاخص‌ها
 *   • EN 13306       — واژگان دامنه
 *   • PMO Study      — بهینه‌سازی فاصلهٔ سرویس پیشگیرانه
 */

/** نسخهٔ مدل دامنه؛ در رکوردهای محاسباتی ذخیره می‌شود تا تغییر الگوریتم قابل ردیابی باشد. */
export const CMMS_MODEL_VERSION = "cmms-domain-v1";

/* ═══════════════════════ ۱. واژگان و کاتالوگ‌های مرجع ═══════════════════════ */

/**
 * واژگان دامنه بر پایهٔ EN 13306. نام فارسی/انگلیسی هر اصطلاح یک‌جا نگه
 * داشته می‌شود تا فرانت‌اند، گزارش‌ها و API از یک منبع ترجمه استفاده کنند.
 */
export const CMMS_VOCABULARY: Record<string, { fa: string; en: string }> = {
  asset: { fa: "دارایی", en: "Asset" },
  item: { fa: "قلم", en: "Item" },
  failure: { fa: "خرابی", en: "Failure" },
  "failure-mode": { fa: "حالت خرابی", en: "Failure mode" },
  "failure-mechanism": { fa: "مکانیزم خرابی", en: "Failure mechanism" },
  "preventive-maintenance": { fa: "نگهداری پیشگیرانه", en: "Preventive maintenance" },
  "corrective-maintenance": { fa: "نگهداری اصلاحی", en: "Corrective maintenance" },
  "predictive-maintenance": { fa: "نگهداری پیش‌بینانه", en: "Predictive maintenance" },
  "condition-monitoring": { fa: "پایش وضعیت", en: "Condition monitoring" },
  "run-to-failure": { fa: "کار تا خرابی", en: "Run to failure" },
  mtbf: { fa: "میانگین زمان بین خرابی‌ها", en: "Mean time between failures" },
  mttr: { fa: "میانگین زمان تعمیر", en: "Mean time to repair" },
  mttf: { fa: "میانگین زمان تا خرابی", en: "Mean time to failure" },
  availability: { fa: "دسترس‌پذیری", en: "Availability" },
  reliability: { fa: "قابلیت اطمینان", en: "Reliability" },
  maintainability: { fa: "نگهداشت‌پذیری", en: "Maintainability" },
  criticality: { fa: "بحرانی‌بودن", en: "Criticality" },
  "work-order": { fa: "دستورکار", en: "Work order" },
  "work-request": { fa: "درخواست کار", en: "Work request" },
  rcfa: { fa: "تحلیل ریشه‌ای خرابی", en: "Root cause failure analysis" },
  oee: { fa: "اثربخشی کلی تجهیزات", en: "Overall equipment effectiveness" },
  lcc: { fa: "هزینهٔ چرخهٔ عمر", en: "Life cycle cost" },
};

/** ترجمهٔ واژهٔ دامنه؛ در نبود، خود کلید برمی‌گردد تا هیچ‌گاه undefined نشود. */
export function vocabularyTerm(key: string, lang: "fa" | "en" = "fa"): string {
  const entry = CMMS_VOCABULARY[key];
  return entry ? entry[lang] : key;
}

/**
 * حالات خرابی استاندارد ISO 14224 بند ۹.۲ — فهرست بسته است و هر مقدار
 * دیگری در CHECK جدول CmmsFamilyFailureMode رد می‌شود.
 */
export const ISO14224_FAILURE_MODES = [
  "fail-to-start", "fail-to-function", "fail-to-stop", "abnormal-start",
  "abnormal-shutdown", "erratic-output", "reduced-output", "excessive-output",
  "spurious-output", "leakage", "structural",
] as const;
export type Iso14224FailureMode = (typeof ISO14224_FAILURE_MODES)[number];

/** مکانیزم‌های خرابی ISO 14224 بند ۹.۳. */
export const ISO14224_FAILURE_MECHANISMS = [
  "wear", "corrosion", "fatigue", "overload", "fouling", "misalignment",
  "imbalance", "lubrication", "electrical", "seal", "thermal", "vibration", "other",
] as const;
export type Iso14224FailureMechanism = (typeof ISO14224_FAILURE_MECHANISMS)[number];

/** روش‌های کشف خرابی — ISO 14224 بند ۹.۴. */
export const ISO14224_DETECTION_METHODS = ["operator", "inspection", "cbm", "alarm", "breakdown-report", "other"] as const;

/** سطوح مرز تجهیز در ISO 14224 بند ۶.۲. */
export const ISO14224_BOUNDARY_LEVELS = ["equipment", "sub-unit", "component", "maintenance-item"] as const;
export type Iso14224BoundaryLevel = (typeof ISO14224_BOUNDARY_LEVELS)[number];

export function isIso14224FailureMode(value: unknown): value is Iso14224FailureMode {
  return typeof value === "string" && (ISO14224_FAILURE_MODES as readonly string[]).includes(value);
}

/**
 * ساخت کد تاکسونومی ISO 14224 از اجزای مرز تجهیز.
 *
 * شکل خروجی: `کلاس تجهیز | زیرواحد | قطعه | حالت خرابی | مکانیزم`
 * مثلاً: `PUMP|SEAL-ASSY|MECH-SEAL|leakage|wear`
 *
 * اجزای خالی با `*` پر می‌شوند تا عرض کد ثابت بماند و مرتب‌سازی رشته‌ای
 * در گزارش‌ها معنادار باشد.
 */
export function classifyIso14224(input: {
  equipmentClass?: string | null;
  subUnit?: string | null;
  component?: string | null;
  failureMode?: string | null;
  failureMechanism?: string | null;
}): string {
  const norm = (value: string | null | undefined): string => {
    const text = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "-");
    return text.length ? text : "*";
  };
  const mode = String(input.failureMode ?? "").trim() || "*";
  const mechanism = String(input.failureMechanism ?? "").trim() || "*";
  return [norm(input.equipmentClass), norm(input.subUnit), norm(input.component), mode, mechanism].join("|");
}

/**
 * ساخت مسیر مرز تجهیز از گره‌های درخت خانواده.
 * خروجی برای پرکردن `Iso14224Code` و ستون `PathCode` به کار می‌رود.
 * گره‌ها باید از ریشه به برگ مرتب باشند.
 */
export function buildAssetBoundaryPath(nodes: Array<{ nodeCode: string; boundaryLevel?: string }>): string {
  return nodes.map((node) => String(node.nodeCode ?? "").trim().toUpperCase()).filter(Boolean).join("/");
}

/* ═══════════════════════ ۲. IEC 60812 — FMEA / FMECA ═══════════════════════ */

export type RpnInput = { severity: number; occurrence: number; detection: number };
export type RpnResult = {
  rpn: number;
  actionPriority: "high" | "medium" | "low";
  /** دلیل تعیین اولویت — برای توضیح‌پذیری در رابط کاربری. */
  reasonFa: string;
  warnings: string[];
};

export const RPN_THRESHOLDS = Object.freeze({ high: 200, medium: 100, severityEscalation: 9 });

/**
 * عدد اولویت ریسک (RPN) طبق IEC 60812.
 *
 * RPN = شدت × وقوع × کشف، هر سه در بازهٔ ۱ تا ۱۰، پس خروجی ۱ تا ۱۰۰۰.
 * ورودی خارج از بازه استثنا می‌دهد، نه اینکه بی‌صدا بریده شود — چون عدد
 * اشتباه در FMEA تصمیم مهندسی را منحرف می‌کند.
 */
export function computeRiskPriorityNumber(input: RpnInput): RpnResult {
  const { severity, occurrence, detection } = input;
  for (const [name, value] of [["severity", severity], ["occurrence", occurrence], ["detection", detection]] as const) {
    if (!Number.isFinite(value) || value < 1 || value > 10 || !Number.isInteger(value)) {
      throw new RangeError(`CMMS_FMEA_RANGE: ${name} باید عدد صحیح ۱ تا ۱۰ باشد (دریافت: ${value})`);
    }
  }
  const rpn = severity * occurrence * detection;
  const warnings: string[] = [];
  let actionPriority: RpnResult["actionPriority"];
  let reasonFa: string;

  /* قاعدهٔ تشدید شدت: شدت ۹ یا ۱۰ یعنی اثر ایمنی/زیست‌محیطی یا توقف کامل.
   * در این حالت RPN پایین هم باید «زیاد» باشد، چون ریسک ایمنی با میانگین‌گیری
   * پنهان نمی‌شود. این یک قاعدهٔ محافظه‌کارانهٔ صریح است، نه جدول کامل
   * Action Priority در AIAG-VDA. */
  if (severity >= RPN_THRESHOLDS.severityEscalation) {
    actionPriority = "high";
    reasonFa = `شدت ${severity} بالاتر از آستانهٔ تشدید ${RPN_THRESHOLDS.severityEscalation} است؛ بدون توجه به RPN=${rpn} اولویت زیاد تعیین شد.`;
  } else if (rpn >= RPN_THRESHOLDS.high) {
    actionPriority = "high";
    reasonFa = `RPN=${rpn} بالاتر از آستانهٔ ${RPN_THRESHOLDS.high} است.`;
  } else if (rpn >= RPN_THRESHOLDS.medium) {
    actionPriority = "medium";
    reasonFa = `RPN=${rpn} بین ${RPN_THRESHOLDS.medium} و ${RPN_THRESHOLDS.high} است.`;
    if (detection >= 8) warnings.push("کشف‌پذیری ضعیف (≥۸) حتی با RPN متوسط باید بازنگری شود.");
  } else {
    actionPriority = "low";
    reasonFa = `RPN=${rpn} زیر آستانهٔ ${RPN_THRESHOLDS.medium} است.`;
  }
  return { rpn, actionPriority, reasonFa, warnings };
}

/**
 * عدد بحرانی‌بودن (Criticality Number) طبق IEC 60812 بخش FMECA:
 *   Cm = λ × β × t
 * λ = نرخ خرابی قلم در ساعت، β = نسبت حالت خرابی به کل خرابی‌ها، t = زمان مأموریت.
 */
export function computeCriticality(input: {
  failureRatePerHour: number;
  betaFactor: number;
  missionTimeHours: number;
}): { criticalityNumber: number; betaFactor: number } {
  const { failureRatePerHour, betaFactor, missionTimeHours } = input;
  if (!(failureRatePerHour >= 0)) throw new RangeError("CMMS_FMECA_RATE: نرخ خرابی نمی‌تواند منفی باشد");
  if (!(betaFactor > 0 && betaFactor <= 1)) throw new RangeError("CMMS_FMECA_BETA: ضریب β باید در (۰,۱] باشد");
  if (!(missionTimeHours > 0)) throw new RangeError("CMMS_FMECA_TIME: زمان مأموریت باید مثبت باشد");
  return { criticalityNumber: failureRatePerHour * betaFactor * missionTimeHours, betaFactor };
}

/* ═══════════════════════ ۳. IEC 60300-3-11 — تصمیم RCM ═══════════════════════ */

export type RcmConsequence = "safety-environmental" | "operational" | "non-operational";

export type RcmInput = {
  isHiddenFailure: boolean;
  consequence: RcmConsequence;
  isConditionMonitorable: boolean;
  hasAgeRelatedPattern: boolean;
  /** آیا وظیفهٔ پایش وضعیتِ مؤثر و قابل اجرا وجود دارد؟ */
  conditionTaskApplicable: boolean;
  /** آیا بازسازی زمان‌بندی‌شده مؤثر است؟ */
  restorationApplicable: boolean;
  /** آیا دوراندازی زمان‌بندی‌شده مؤثر است؟ */
  discardApplicable: boolean;
  /** آیا وظیفهٔ کشف خرابی پنهان وجود دارد؟ */
  failureFindingApplicable: boolean;
};

export type RcmTask =
  | "condition-based" | "scheduled-restoration" | "scheduled-discard"
  | "failure-finding" | "run-to-failure" | "redesign";

export type RcmDecision = {
  selectedTask: RcmTask;
  decisionPath: Array<{ step: number; questionFa: string; answerFa: string }>;
  consequence: RcmConsequence;
  /** توضیح یک‌خطی برای گزارش. */
  reasonFa: string;
};

const RCM_CONSEQUENCES: RcmConsequence[] = ["safety-environmental", "operational", "non-operational"];

/**
 * منطق تصمیم هفت‌گامی RCM (IEC 60300-3-11).
 *
 * ترتیب پرسش‌ها عمداً ثابت است و در `decisionPath` ثبت می‌شود تا هر تصمیم
 * قابل دفاع و قابل بازبینی در ممیزی باشد — تصمیم RCM بدون ردّ دلیل، در
 * ممیزی ISO 55001 مردود است.
 *
 * گام‌ها:
 *   ۱) آیا خرابی پنهان است؟ → وظیفهٔ کشف خرابی، وگرنه بازطراحی
 *   ۲) طبقهٔ پیامد چه بود؟ (ایمنی/زیست‌محیطی > عملیاتی > غیرعملیاتی)
 *   ۳) آیا پایش وضعیت مؤثر ممکن است؟ → نگهداری مبتنی بر وضعیت
 *   ۴) آیا الگوی سنی/فرسایشی وجود دارد؟ → بازسازی یا دوراندازی زمان‌بندی‌شده
 *   ۵) آیا هیچ وظیفهٔ مؤثری وجود ندارد؟
 *        - پیامد غیرعملیاتی → کار تا خرابی (پذیرفتنی)
 *        - پیامد عملیاتی یا ایمنی → بازطراحی
 */
export function decideRcmTask(input: RcmInput): RcmDecision {
  if (!RCM_CONSEQUENCES.includes(input.consequence)) {
    throw new RangeError(`CMMS_RCM_CONSEQUENCE: پیامد نامعتبر «${input.consequence}»`);
  }
  const path: RcmDecision["decisionPath"] = [];
  let step = 0;
  const ask = (questionFa: string, answerFa: string) => {
    step += 1;
    path.push({ step, questionFa, answerFa });
  };

  ask("آیا خرابی پنهان است؟ (تابع محافظ که در حالت عادی دیده نمی‌شود)",
    input.isHiddenFailure ? "بله — خرابی پنهان" : "خیر — خرابی آشکار");

  if (input.isHiddenFailure) {
    ask("آیا وظیفهٔ کشف خرابی پنهان مؤثر و قابل اجرا وجود دارد؟",
      input.failureFindingApplicable ? "بله" : "خیر");
    return input.failureFindingApplicable
      ? {
        selectedTask: "failure-finding", consequence: input.consequence, decisionPath: path,
        reasonFa: "خرابی پنهان با وظیفهٔ کشف خرابی پوشش داده می‌شود.",
      }
      : {
        selectedTask: "redesign", consequence: input.consequence, decisionPath: path,
        reasonFa: "خرابی پنهان بدون وظیفهٔ کشف مؤثر، نیازمند بازطراحی است.",
      };
  }

  ask("طبقهٔ پیامد خرابی چیست؟",
    input.consequence === "safety-environmental" ? "ایمنی/زیست‌محیطی"
      : input.consequence === "operational" ? "عملیاتی" : "غیرعملیاتی");

  ask("آیا پایش وضعیت مؤثر برای این حالت خرابی امکان‌پذیر است؟",
    input.isConditionMonitorable && input.conditionTaskApplicable ? "بله" : "خیر");
  if (input.isConditionMonitorable && input.conditionTaskApplicable) {
    return {
      selectedTask: "condition-based", consequence: input.consequence, decisionPath: path,
      reasonFa: "پایش وضعیت مؤثر امکان‌پذیر است؛ نگهداری مبتنی بر وضعیت انتخاب شد.",
    };
  }

  ask("آیا حالت خرابی الگوی سنی/فرسایشی دارد؟", input.hasAgeRelatedPattern ? "بله" : "خیر");
  if (input.hasAgeRelatedPattern) {
    ask("آیا بازسازی زمان‌بندی‌شده مؤثر است؟", input.restorationApplicable ? "بله" : "خیر");
    if (input.restorationApplicable) {
      return {
        selectedTask: "scheduled-restoration", consequence: input.consequence, decisionPath: path,
        reasonFa: "الگوی فرسایش با بازسازی زمان‌بندی‌شده کنترل می‌شود.",
      };
    }
    ask("آیا دوراندازی (تعویض قطعی) زمان‌بندی‌شده مؤثر است؟", input.discardApplicable ? "بله" : "خیر");
    if (input.discardApplicable) {
      return {
        selectedTask: "scheduled-discard", consequence: input.consequence, decisionPath: path,
        reasonFa: "الگوی فرسایش با دوراندازی زمان‌بندی‌شده کنترل می‌شود.",
      };
    }
  }

  ask("آیا هیچ وظیفهٔ پیشگیرانهٔ مؤثری یافت نشد؟", "بله — به گام پیامد می‌رویم");
  if (input.consequence === "non-operational") {
    return {
      selectedTask: "run-to-failure", consequence: input.consequence, decisionPath: path,
      reasonFa: "پیامد غیرعملیاتی است؛ کار تا خرابی از نظر اقتصادی بهینه است.",
    };
  }
  return {
    selectedTask: "redesign", consequence: input.consequence, decisionPath: path,
    reasonFa: "پیامد عملیاتی/ایمنی بدون وظیفهٔ مؤثر؛ بازطراحی لازم است.",
  };
}

/* ═══════════════════════ ۴. ISO 17359 / ISO 10816 — پایش وضعیت ═══════════════════════ */

export type ConditionZone = "A" | "B" | "C" | "D";

/**
 * حدود منطقه‌بندی سرعت ارتعاش مؤثر (mm/s RMS) بر پایهٔ ISO 10816-3 جدول ۱.
 * کلید: گروه ماشین + سختی تکیه‌گاه. خروجی: سقف منطقهٔ A، B و C.
 */
export const ISO10816_ZONE_LIMITS: Record<string, { zoneA: number; zoneB: number; zoneC: number; labelFa: string }> = {
  group1_rigid: { zoneA: 2.3, zoneB: 4.5, zoneC: 7.1, labelFa: "گروه ۱ — ماشین‌های بزرگ با تکیه‌گاه صلب" },
  group1_flexible: { zoneA: 3.5, zoneB: 7.1, zoneC: 11.0, labelFa: "گروه ۱ — ماشین‌های بزرگ با تکیه‌گاه انعطاف‌پذیر" },
  group2_rigid: { zoneA: 1.4, zoneB: 2.8, zoneC: 4.5, labelFa: "گروه ۲ — ماشین‌های متوسط با تکیه‌گاه صلب" },
  group2_flexible: { zoneA: 2.3, zoneB: 4.5, zoneC: 7.1, labelFa: "گروه ۲ — ماشین‌های متوسط با تکیه‌گاه انعطاف‌پذیر" },
  group3_rigid: { zoneA: 2.3, zoneB: 4.5, zoneC: 7.1, labelFa: "گروه ۳ — پمپ‌های جریان شعاعی یکپارچه، تکیه‌گاه صلب" },
  group3_flexible: { zoneA: 3.5, zoneB: 7.1, zoneC: 11.0, labelFa: "گروه ۳ — پمپ‌های جریان شعاعی، تکیه‌گاه انعطاف‌پذیر" },
  group4_rigid: { zoneA: 3.5, zoneB: 7.1, zoneC: 11.0, labelFa: "گروه ۴ — ماشین‌های کوچک، تکیه‌گاه صلب" },
  group4_flexible: { zoneA: 4.5, zoneB: 9.0, zoneC: 14.0, labelFa: "گروه ۴ — ماشین‌های کوچک، تکیه‌گاه انعطاف‌پذیر" },
};

/**
 * منطقهٔ ارتعاش بر پایهٔ ISO 10816-3.
 * A = تازه/سالم، B = قابل قبول برای بهره‌برداری طولانی، C = نامناسب برای
 * بهره‌برداری طولانی، D = آسیب‌زا.
 */
export function vibrationZoneIso10816(rmsVelocityMmPerSec: number, machineClass: string, rigidSupport: boolean): {
  zone: ConditionZone;
  limits: { zoneA: number; zoneB: number; zoneC: number };
  labelFa: string;
  key: string;
} {
  if (!Number.isFinite(rmsVelocityMmPerSec) || rmsVelocityMmPerSec < 0) {
    throw new RangeError(`CMMS_CBM_VALUE: سرعت ارتعاش نامعتبر (${rmsVelocityMmPerSec})`);
  }
  const key = `${machineClass}_${rigidSupport ? "rigid" : "flexible"}`;
  const limits = ISO10816_ZONE_LIMITS[key];
  if (!limits) throw new RangeError(`CMMS_CBM_CLASS: کلاس ماشین/تکیه‌گاه ناشناخته «${key}»`);
  const zone: ConditionZone =
    rmsVelocityMmPerSec <= limits.zoneA ? "A"
      : rmsVelocityMmPerSec <= limits.zoneB ? "B"
        : rmsVelocityMmPerSec <= limits.zoneC ? "C" : "D";
  return { zone, limits: { zoneA: limits.zoneA, zoneB: limits.zoneB, zoneC: limits.zoneC }, labelFa: limits.labelFa, key };
}

/**
 * ارزیابی عمومی یک قرائت پایش وضعیت (ISO 17359).
 *
 * دو جهت پشتیبانی می‌شود: «افزایشی» (دما، ارتعاش، ذرات روغن) که با بزرگ‌شدن
 * بدتر می‌شود، و «کاهشی» (مقاومت عایقی، فشار روغن) که با کوچک‌شدن بدتر می‌شود.
 */
export function evaluateCondition(input: {
  value: number;
  alertLimit: number | null;
  alarmLimit: number | null;
  tripLimit?: number | null;
  direction?: "increasing" | "decreasing";
  trendDirection?: "rising" | "falling" | "stable" | null;
  rateOfChange?: number | null;
  /** میانگین دورهٔ سالم برای محاسبهٔ انحراف از مبنا. */
  baseline?: number | null;
}): {
  zone: ConditionZone;
  severity: "normal" | "alert" | "alarm" | "trip";
  actionFa: string;
  deviationFromBaselinePct: number | null;
  trendDirection: "rising" | "falling" | "stable";
} {
  const direction = input.direction ?? "increasing";
  const value = input.value;
  if (!Number.isFinite(value)) throw new RangeError(`CMMS_CBM_VALUE: مقدار نامعتبر (${value})`);

  /* بدتر بودن یعنی دورتر از محدودهٔ سالم در جهت مشخص‌شده. */
  const worse = (v: number, limit: number): boolean => (direction === "increasing" ? v > limit : v < limit);

  let severity: "normal" | "alert" | "alarm" | "trip" = "normal";
  if (input.tripLimit != null && worse(value, input.tripLimit)) severity = "trip";
  else if (input.alarmLimit != null && worse(value, input.alarmLimit)) severity = "alarm";
  else if (input.alertLimit != null && worse(value, input.alertLimit)) severity = "alert";

  const zone: ConditionZone = severity === "normal" ? "A" : severity === "alert" ? "B" : severity === "alarm" ? "C" : "D";

  const actionFa = severity === "normal" ? "بهره‌برداری عادی؛ پایش طبق برنامه ادامه یابد."
    : severity === "alert" ? "هشدار اولیه — افزایش فراوانی پایش و بررسی علت."
      : severity === "alarm" ? "بحران — صدور دستورکار پیشگیرانه و پایش نزدیک."
        : "قطع — توقف تجهیز و صدور دستورکار اضطراری.";

  const trendDirection = input.trendDirection ?? "stable";
  const baseline = input.baseline;
  const deviationFromBaselinePct = baseline != null && Number.isFinite(baseline) && baseline !== 0
    ? ((value - baseline) / Math.abs(baseline)) * 100
    : null;

  return { zone, severity, actionFa, deviationFromBaselinePct, trendDirection };
}

/* ═══════════════════════ ۵. IEEE 1366 — قابلیت اطمینان تأمین ═══════════════════════ */

export type OutageEvent = {
  customersAffected: number;
  durationMinutes: number;
  /** رویداد لحظه‌ای (≤ ۵ دقیقه) در MAIFI می‌آید و از SAIDI/SAIFI حذف می‌شود. */
  isMomentary?: boolean;
  /** رویداد عمده (طوفان و...) که در محاسبهٔ بدون رویداد عمده کنار گذاشته می‌شود. */
  isMajorEvent?: boolean;
};

export type SupplyReliabilityResult = {
  saidiMinutes: number;
  saifiCount: number;
  caidiMinutes: number;
  asaiPct: number;
  maifiCount: number;
  customersServed: number;
  totalInterruptions: number;
  customersInterrupted: number;
  totalCustomerInterruptionMinutes: number;
  totalCustomerMinutesAffected: number;
  excludedMajorEvents: number;
  warnings: string[];
};

/**
 * شاخص‌های قابلیت اطمینان توزیع طبق IEEE 1366.
 *
 *   SAIDI = Σ(مشتریان قطع‌شده × دقیقه) / کل مشتریان
 *   SAIFI = Σ(مشتریان قطع‌شده)          / کل مشتریان
 *   CAIDI = Σ(مشتری-دقیقه)             / Σ(مشتریان قطع‌شده) = SAIDI / SAIFI
 *   ASAI  = (مشتری-دقیقهٔ در دسترس − مشتری-دقیقهٔ قطع) / مشتری-دقیقهٔ در دسترس
 *   MAIFI = تعداد قطعی‌های لحظه‌ای      / کل مشتریان
 *
 * `periodMinutes` برای ASAI لازم است چون مبنای آن «زمان کل دوره» است.
 */
export function computeSupplyReliability(input: {
  customersServed: number;
  periodMinutes: number;
  events: OutageEvent[];
  excludeMajorEvents?: boolean;
}): SupplyReliabilityResult {
  const customersServed = input.customersServed;
  if (!Number.isInteger(customersServed) || customersServed < 0) {
    throw new RangeError(`CMMS_1366_CUSTOMERS: تعداد مشتریان نامعتبر (${customersServed})`);
  }
  if (!Number.isFinite(input.periodMinutes) || input.periodMinutes <= 0) {
    throw new RangeError(`CMMS_1366_PERIOD: طول دوره باید مثبت باشد (${input.periodMinutes})`);
  }
  const warnings: string[] = [];
  const excludeMajor = input.excludeMajorEvents ?? false;
  const usable = (input.events ?? []).filter((event) => {
    if (event.customersAffected < 0 || event.durationMinutes < 0) {
      throw new RangeError("CMMS_1366_EVENT: تعداد مشتریان و مدت قطعی نمی‌توانند منفی باشند");
    }
    return !(excludeMajor && event.isMajorEvent);
  });
  const excludedMajorEvents = (input.events ?? []).length - usable.length;

  const sustained = usable.filter((event) => !event.isMomentary);
  const momentary = usable.filter((event) => event.isMomentary);

  const totalCustomerInterruptionMinutes = sustained.reduce((sum, e) => sum + e.customersAffected * e.durationMinutes, 0);
  const customersInterrupted = sustained.reduce((sum, e) => sum + e.customersAffected, 0);
  const totalCustomerMinutesAffected = momentary.reduce((sum, e) => sum + e.customersAffected, 0);

  const totalCustomerMinutesAvailable = customersServed * input.periodMinutes;

  if (customersServed === 0) {
    warnings.push("تعداد مشتریان صفر است؛ SAIDI/SAIFI/MAIFI معنا ندارند و صفر گزارش می‌شوند.");
  }
  if (sustained.length === 0 && customersServed > 0) warnings.push("هیچ قطعی پایداری در دوره ثبت نشده است.");

  const saidiMinutes = customersServed > 0 ? totalCustomerInterruptionMinutes / customersServed : 0;
  const saifiCount = customersServed > 0 ? customersInterrupted / customersServed : 0;
  const caidiMinutes = customersInterrupted > 0 ? totalCustomerInterruptionMinutes / customersInterrupted : 0;
  const asaiPct = totalCustomerMinutesAvailable > 0
    ? ((totalCustomerMinutesAvailable - totalCustomerInterruptionMinutes) / totalCustomerMinutesAvailable) * 100
    : 100;
  const maifiCount = customersServed > 0 ? totalCustomerMinutesAffected / customersServed : 0;

  return {
    saidiMinutes, saifiCount, caidiMinutes, asaiPct, maifiCount,
    customersServed, totalInterruptions: usable.length, customersInterrupted,
    totalCustomerInterruptionMinutes, totalCustomerMinutesAffected,
    excludedMajorEvents, warnings,
  };
}

/* ═══════════════════════ ۶. OEE نسخهٔ ۲ ═══════════════════════ */

export type OeeInput = {
  calendarMinutes: number;
  plannedProductionMinutes: number;
  runMinutes: number;
  totalUnits: number;
  goodUnits: number;
  idealCycleTimeSeconds: number;
  /** شش اتلاف بزرگ — برای تفکیک علّت، نه برای محاسبهٔ OEE. */
  breakdownMinutes?: number;
  setupMinutes?: number;
  minorStopMinutes?: number;
  reducedSpeedMinutes?: number;
  startupRejectUnits?: number;
  productionRejectUnits?: number;
};

export type OeeResult = {
  availabilityPct: number;
  performancePct: number;
  qualityPct: number;
  oeePct: number;
  teepPct: number;
  sixBigLosses: {
    breakdownMinutes: number; setupMinutes: number; minorStopMinutes: number;
    reducedSpeedMinutes: number; startupRejectUnits: number; productionRejectUnits: number;
  };
  warnings: string[];
};

const pct = (value: number): number => Math.round(value * 10000) / 100;

/**
 * اثربخشی کلی تجهیزات (OEE) و TEEP.
 *
 *   دسترس‌پذیری = زمان کار / زمان برنامه‌ریزی‌شدهٔ تولید
 *   کارایی      = (زمان چرخهٔ ایده‌آل × کل تولید) / زمان کار
 *   کیفیت       = تولید سالم / کل تولید
 *   OEE         = دسترس‌پذیری × کارایی × کیفیت
 *   TEEP        = OEE × (زمان برنامه‌ریزی‌شده / زمان تقویمی)
 *
 * کارایی بالای ۱۰۰٪ بریده نمی‌شود، چون بریدن آن خطای داده را پنهان می‌کند؛
 * به‌جایش هشدار داده می‌شود که زمان چرخهٔ ایده‌آل خوش‌بینانه است.
 */
export function computeOee(input: OeeInput): OeeResult {
  const {
    calendarMinutes, plannedProductionMinutes, runMinutes,
    totalUnits, goodUnits, idealCycleTimeSeconds,
  } = input;
  for (const [name, value] of [
    ["calendarMinutes", calendarMinutes], ["plannedProductionMinutes", plannedProductionMinutes],
    ["runMinutes", runMinutes], ["totalUnits", totalUnits], ["goodUnits", goodUnits],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`CMMS_OEE_INPUT: ${name} نامعتبر (${value})`);
  }
  if (!(idealCycleTimeSeconds > 0)) throw new RangeError(`CMMS_OEE_CYCLE: زمان چرخهٔ ایده‌آل باید مثبت باشد (${idealCycleTimeSeconds})`);
  if (runMinutes > plannedProductionMinutes) {
    throw new RangeError(`CMMS_OEE_RUN: زمان کار (${runMinutes}) از زمان برنامه‌ریزی‌شده (${plannedProductionMinutes}) بیشتر است`);
  }
  if (goodUnits > totalUnits) {
    throw new RangeError(`CMMS_OEE_UNITS: تولید سالم (${goodUnits}) از کل تولید (${totalUnits}) بیشتر است`);
  }
  if (plannedProductionMinutes > calendarMinutes) {
    throw new RangeError(`CMMS_OEE_PLANNED: زمان برنامه‌ریزی‌شده (${plannedProductionMinutes}) از زمان تقویمی (${calendarMinutes}) بیشتر است`);
  }

  const warnings: string[] = [];
  const availability = plannedProductionMinutes > 0 ? runMinutes / plannedProductionMinutes : 0;
  const idealRunMinutes = (idealCycleTimeSeconds * totalUnits) / 60;
  const performance = runMinutes > 0 ? idealRunMinutes / runMinutes : 0;
  const quality = totalUnits > 0 ? goodUnits / totalUnits : 1;

  if (performance > 1) warnings.push("کارایی بالای ۱۰۰٪ — زمان چرخهٔ ایده‌آل احتمالاً خوش‌بینانه است یا شمارش تولید بیش‌برآورد شده.");
  if (totalUnits === 0) warnings.push("تولید صفر است؛ کیفیت ۱۰۰٪ فرض شد و کارایی صفر است.");
  if (plannedProductionMinutes === 0) warnings.push("زمان برنامه‌ریزی‌شده صفر است؛ دسترس‌پذیری صفر گزارش شد.");

  const oee = availability * performance * quality;
  const teep = calendarMinutes > 0 ? oee * (plannedProductionMinutes / calendarMinutes) : 0;

  return {
    availabilityPct: pct(availability),
    performancePct: pct(performance),
    qualityPct: pct(quality),
    oeePct: pct(oee),
    teepPct: pct(teep),
    sixBigLosses: {
      breakdownMinutes: input.breakdownMinutes ?? 0,
      setupMinutes: input.setupMinutes ?? 0,
      minorStopMinutes: input.minorStopMinutes ?? 0,
      reducedSpeedMinutes: input.reducedSpeedMinutes ?? 0,
      startupRejectUnits: input.startupRejectUnits ?? 0,
      productionRejectUnits: input.productionRejectUnits ?? 0,
    },
    warnings,
  };
}

/* ═══════════════════════ ۷. قابلیت اطمینان (MTBF / MTTR / R(t)) ═══════════════════════ */

export type ReliabilityInput = {
  calendarHours: number;
  operatingHours: number;
  downtimeHours: number;
  repairHours?: number;
  failureCount: number;
  pmScheduled?: number;
  pmDoneOnTime?: number;
  missionTimeHours?: number | null;
};

export type ReliabilityResult = {
  mtbfHours: number | null;
  mttfHours: number | null;
  mttrHours: number | null;
  failureRateLambda: number | null;
  availabilityPct: number;
  inherentAvailabilityPct: number | null;
  reliabilityAtMission: number | null;
  missionTimeHours: number | null;
  pmCompliancePct: number | null;
  warnings: string[];
};

const round4 = (value: number): number => Math.round(value * 10000) / 10000;
const round6 = (value: number): number => Math.round(value * 1000000) / 1000000;

/**
 * شاخص‌های قابلیت اطمینان و نگهداشت‌پذیری.
 *
 *   MTBF = ساعات کار / تعداد خرابی‌ها          (قلم تعمیرپذیر)
 *   MTTR = ساعات تعمیر / تعداد خرابی‌ها
 *   MTTF = MTBF − MTTR                        (رابطهٔ متداول صنعتی)
 *   λ    = تعداد خرابی‌ها / ساعات کار
 *   R(t) = e^(−λt)                            (توزیع نمایی)
 *   دسترس‌پذیری  = ساعات کار / (ساعات کار + ساعات توقف)
 *   دسترس‌پذیری ذاتی = MTBF / (MTBF + MTTR)
 *
 * با صفر خرابی، MTBF/λ/R(t) تعریف‌نشده‌اند و `null` برمی‌گردند نه بی‌نهایت؛
 * بی‌نهایت در داشبورد به «۱۰۰٪ قابلیت اطمینان» تفسیر می‌شود که گمراه‌کننده است.
 */
export function computeReliability(input: ReliabilityInput): ReliabilityResult {
  const { calendarHours, operatingHours, downtimeHours, failureCount } = input;
  const repairHours = input.repairHours ?? 0;
  for (const [name, value] of [
    ["calendarHours", calendarHours], ["operatingHours", operatingHours],
    ["downtimeHours", downtimeHours], ["repairHours", repairHours],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`CMMS_REL_INPUT: ${name} نامعتبر (${value})`);
  }
  if (!Number.isInteger(failureCount) || failureCount < 0) {
    throw new RangeError(`CMMS_REL_FAILCOUNT: تعداد خرابی نامعتبر (${failureCount})`);
  }
  if (operatingHours + downtimeHours > calendarHours + 1e-6) {
    throw new RangeError("CMMS_REL_TIME: مجموع ساعات کار و توقف از ساعات تقویمی بیشتر است");
  }

  const warnings: string[] = [];
  const missionTimeHours = input.missionTimeHours ?? null;

  const hasFailures = failureCount > 0 && operatingHours > 0;
  const mtbfHours = hasFailures ? round4(operatingHours / failureCount) : null;
  const mttrHours = hasFailures && repairHours > 0 ? round4(repairHours / failureCount) : null;
  const mttfHours = mtbfHours != null ? round4(mtbfHours - (mttrHours ?? 0)) : null;
  const failureRateLambda = hasFailures ? round6(failureCount / operatingHours) : null;
  const inherentAvailabilityPct = mtbfHours != null && mttrHours != null && (mtbfHours + mttrHours) > 0
    ? round4((mtbfHours / (mtbfHours + mttrHours)) * 100)
    : null;
  const reliabilityAtMission = failureRateLambda != null && missionTimeHours != null && missionTimeHours > 0
    ? round6(Math.exp(-failureRateLambda * missionTimeHours))
    : null;

  const denominator = operatingHours + downtimeHours;
  const availabilityPct = denominator > 0 ? round4((operatingHours / denominator) * 100) : 0;

  const pmScheduled = input.pmScheduled ?? null;
  const pmCompliancePct = pmScheduled != null && pmScheduled > 0
    ? round4(((input.pmDoneOnTime ?? 0) / pmScheduled) * 100)
    : null;

  if (!hasFailures) warnings.push("خرابی یا ساعت کار صفر است؛ MTBF/λ/R(t) تعریف‌نشده گزارش شدند.");
  if (mttrHours == null && hasFailures) warnings.push("ساعات تعمیر ثبت نشده؛ MTTR و دسترس‌پذیری ذاتی محاسبه نشد.");
  if (pmScheduled != null && pmScheduled > 0 && (input.pmDoneOnTime ?? 0) > pmScheduled) {
    warnings.push("PM انجام‌شدهٔ به‌موقع بیشتر از PM برنامه‌ریزی‌شده است — دادهٔ ورودی بازبینی شود.");
  }

  return {
    mtbfHours, mttfHours, mttrHours, failureRateLambda,
    availabilityPct, inherentAvailabilityPct, reliabilityAtMission,
    missionTimeHours, pmCompliancePct, warnings,
  };
}

/* ═══════════════════════ ۸. IEC 60300-3-3 — هزینهٔ چرخهٔ عمر ═══════════════════════ */

export type LccInput = {
  lifeYears: number;
  discountRatePct: number;
  acquisitionCost: number;
  installationCost?: number;
  operatingCostPerYear?: number;
  maintenanceCostPerYear?: number;
  downtimeLossPerYear?: number;
  energyCostPerYear?: number;
  disposalCost?: number;
  residualValue?: number;
  /** ارزش‌های جریان نقدی که باید تنزیل شوند به ترتیب سال ۱..n. */
  yearlyCashflows?: number[];
};

export type LccResult = {
  npvAcquisition: number;
  npvOperation: number;
  npvMaintenance: number;
  npvDowntime: number;
  npvDisposal: number;
  totalNpv: number;
  /** سهم هر عنصر از کل، برای نمودار دایره‌ای. */
  shares: { acquisition: number; operation: number; maintenance: number; downtime: number; disposal: number };
  lifeYears: number;
  discountRatePct: number;
  warnings: string[];
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** عامل تنزیل سال n با نرخ r (درصد): 1 / (1 + r/100)^n */
export function discountFactor(yearIndex: number, discountRatePct: number): number {
  if (!Number.isInteger(yearIndex) || yearIndex < 0) throw new RangeError(`CMMS_LCC_YEAR: شاخص سال نامعتبر (${yearIndex})`);
  if (!Number.isFinite(discountRatePct) || discountRatePct < 0) throw new RangeError(`CMMS_LCC_RATE: نرخ تنزیل نامعتبر (${discountRatePct})`);
  return 1 / Math.pow(1 + discountRatePct / 100, yearIndex);
}

/**
 * هزینهٔ چرخهٔ عمر دارایی با تنزیل جریان نقدی (IEC 60300-3-3).
 *
 * هزینه‌های سالانه از سال ۱ تا n تنزیل می‌شوند؛ اکتساب و نصب در سال صفر
 * (بدون تنزیل) و اسقاط/ارزش باقی‌مانده در سال n.
 *
 * `residualValue` با علامت منفی از کل کم می‌شود چون ورودی نقدی است، پس
 * کاربر باید آن را مثبت وارد کند.
 */
export function computeLifeCycleCost(input: LccInput): LccResult {
  const { lifeYears, discountRatePct } = input;
  if (!Number.isInteger(lifeYears) || lifeYears <= 0) throw new RangeError(`CMMS_LCC_LIFE: عمر مفید نامعتبر (${lifeYears})`);
  if (!Number.isFinite(discountRatePct) || discountRatePct < 0) throw new RangeError(`CMMS_LCC_RATE: نرخ تنزیل نامعتبر (${discountRatePct})`);

  const warnings: string[] = [];
  const annual = (value?: number): number => {
    if (value == null) return 0;
    if (!Number.isFinite(value)) throw new RangeError("CMMS_LCC_ANNUAL: هزینهٔ سالانه نامعتبر است");
    if (value < 0) warnings.push("هزینهٔ سالانهٔ منفی وارد شده — به‌عنوان ورودی نقدی تفسیر شد.");
    return value;
  };

  const acquisition = input.acquisitionCost ?? 0;
  const installation = input.installationCost ?? 0;
  const operatingPerYear = annual(input.operatingCostPerYear);
  const maintenancePerYear = annual(input.maintenanceCostPerYear);
  const downtimePerYear = annual(input.downtimeLossPerYear);
  const energyPerYear = annual(input.energyCostPerYear);
  const disposalCost = input.disposalCost ?? 0;
  const residualValue = input.residualValue ?? 0;

  /* جریان سالانه را اگر کاربر صریحاً داد بر تنزیل‌های آماده اولویت می‌دهیم،
   * چون ممکن است هزینه‌ها سال‌به‌سال رشد کنند (تورم قطعات و دستمزد). */
  const explicit = input.yearlyCashflows;
  const operationNpv = explicit && explicit.length
    ? explicit.reduce((sum, cashflow, index) => sum + cashflow * discountFactor(index + 1, discountRatePct), 0)
    : (operatingPerYear + energyPerYear) * annuityFactor(lifeYears, discountRatePct);

  const maintenanceNpv = maintenancePerYear * annuityFactor(lifeYears, discountRatePct);
  const downtimeNpv = downtimePerYear * annuityFactor(lifeYears, discountRatePct);
  const acquisitionNpv = acquisition + installation;
  const disposalNpv = (disposalCost - residualValue) * discountFactor(lifeYears, discountRatePct);

  const totalNpv = acquisitionNpv + operationNpv + maintenanceNpv + downtimeNpv + disposalNpv;
  const base = Math.abs(totalNpv) || 1;

  return {
    npvAcquisition: round2(acquisitionNpv),
    npvOperation: round2(operationNpv),
    npvMaintenance: round2(maintenanceNpv),
    npvDowntime: round2(downtimeNpv),
    npvDisposal: round2(disposalNpv),
    totalNpv: round2(totalNpv),
    shares: {
      acquisition: round4((acquisitionNpv / base) * 100),
      operation: round4((operationNpv / base) * 100),
      maintenance: round4((maintenanceNpv / base) * 100),
      downtime: round4((downtimeNpv / base) * 100),
      disposal: round4((disposalNpv / base) * 100),
    },
    lifeYears, discountRatePct, warnings,
  };
}

/** عامل ارزش فعلی اقساط سالانهٔ ثابت برای n سال. */
export function annuityFactor(years: number, discountRatePct: number): number {
  if (!Number.isInteger(years) || years <= 0) throw new RangeError(`CMMS_LCC_ANNUITY: تعداد سال نامعتبر (${years})`);
  const r = discountRatePct / 100;
  if (r === 0) return years;
  return (1 - Math.pow(1 + r, -years)) / r;
}

/**
 * انتخاب گزینهٔ بهینه از میان چند سناریوی LCC.
 * گزینهٔ با کمینهٔ NPV برنده است؛ تساوی با تلورانس ۱٪ شکسته نمی‌شود و
 * در `warnings` گزارش می‌شود تا تصمیم انسانی باقی بماند.
 */
export function selectLccOption(scenarios: Array<{ name: string; totalNpv: number }>): {
  selected: string | null;
  ranked: Array<{ name: string; totalNpv: number; rank: number }>;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    return { selected: null, ranked: [], warnings: ["هیچ سناریویی برای مقایسه داده نشد."] };
  }
  const ranked = [...scenarios]
    .sort((left, right) => left.totalNpv - right.totalNpv)
    .map((scenario, index) => ({ name: scenario.name, totalNpv: scenario.totalNpv, rank: index + 1 }));

  if (ranked.length > 1) {
    const gap = Math.abs(ranked[1].totalNpv - ranked[0].totalNpv);
    const base = Math.abs(ranked[0].totalNpv) || 1;
    if (gap / base < 0.01) {
      warnings.push(`اختلاف دو گزینهٔ اول زیر ۱٪ است (${ranked[0].name} و ${ranked[1].name}) — تصمیم باید با معیارهای غیرمالی هم سنجیده شود.`);
    }
  }
  return { selected: ranked[0].name, ranked, warnings };
}

/* ═══════════════════════ ۹. PMO Study — بهینه‌سازی فاصلهٔ PM ═══════════════════════ */

/** قابلیت اطمینان وایبول: R(t) = exp(−(t/η)^β) */
export function weibullReliability(t: number, eta: number, beta: number): number {
  if (!Number.isFinite(t) || t < 0) throw new RangeError(`CMMS_PM_T: زمان نامعتبر (${t})`);
  if (!(eta > 0)) throw new RangeError(`CMMS_PM_ETA: پارامتر مقیاس η باید مثبت باشد (${eta})`);
  if (!(beta > 0)) throw new RangeError(`CMMS_PM_BETA: پارامتر شکل β باید مثبت باشد (${beta})`);
  if (t === 0) return 1;
  return Math.exp(-Math.pow(t / eta, beta));
}

/**
 * انتگرال R(t) از صفر تا T با روش سیمپسون.
 * دقت عمدی با گام‌های زیاد گرفته می‌شود تا نتیجه در آزمون پایدار بماند.
 */
function integrateReliability(upperLimit: number, eta: number, beta: number, steps = 200): number {
  if (upperLimit <= 0) return 0;
  const n = steps % 2 === 0 ? steps : steps + 1;
  const h = upperLimit / n;
  let sum = weibullReliability(0, eta, beta) + weibullReliability(upperLimit, eta, beta);
  for (let i = 1; i < n; i += 1) {
    sum += weibullReliability(i * h, eta, beta) * (i % 2 === 0 ? 2 : 4);
  }
  return (h / 3) * sum;
}

/**
 * نرخ هزینهٔ مدل تعویض سنی (age-replacement):
 *
 *   C(T) = [Cp·R(T) + Cf·(1−R(T))] / [∫₀ᵀ R(u)du + Tr·(1−R(T))]
 *
 * صورت: هزینهٔ انتظار در هر چرخه (یا سرویس پیشگیرانه با Cp یا خرابی با Cf)
 * مخرج: طول مورد انتظار هر چرخه (کارکرد سالم + زمان تعمیر پس از خرابی)
 */
export function ageReplacementCostRate(interval: number, input: {
  eta: number; beta: number; preventiveCost: number; failureCost: number; meanRepairHours: number;
}): number {
  const { eta, beta, preventiveCost, failureCost, meanRepairHours } = input;
  if (!(interval > 0)) throw new RangeError(`CMMS_PM_INTERVAL: فاصله باید مثبت باشد (${interval})`);
  if (!(preventiveCost >= 0)) throw new RangeError("CMMS_PM_CP: هزینهٔ سرویس پیشگیرانه نمی‌تواند منفی باشد");
  if (!(failureCost >= 0)) throw new RangeError("CMMS_PM_CF: هزینهٔ خرابی نمی‌تواند منفی باشد");
  if (!(meanRepairHours >= 0)) throw new RangeError("CMMS_PM_TR: زمان تعمیر نمی‌تواند منفی باشد");
  const r = weibullReliability(interval, eta, beta);
  const numerator = preventiveCost * r + failureCost * (1 - r);
  const denominator = integrateReliability(interval, eta, beta) + meanRepairHours * (1 - r);
  if (denominator <= 0) throw new RangeError("CMMS_PM_DENOM: طول چرخه صفر شد — ورودی‌ها را بازبینی کنید");
  return numerator / denominator;
}

export type PmOptimizationResult = {
  recommendedInterval: number;
  costRateAtRecommended: number;
  costRateRunToFailure: number;
  savingPct: number | null;
  beta: number;
  eta: number;
  recommendationFa: string;
  wearOutDetected: boolean;
  grid: Array<{ interval: number; costRate: number }>;
  warnings: string[];
};

/**
 * بهینه‌سازی فاصلهٔ سرویس پیشگیرانه (PMO Study).
 *
 * منطق تصمیم:
 *   • اگر β ≤ ۱، الگوی فرسایش وجود ندارد (نرخ خرابی ثابت یا کاهشی). در این
 *     حالت سرویس پیشگیرانه دوره‌ای پول دور ریختن است و «کار تا خرابی» یا
 *     پایش وضعیت پیشنهاد می‌شود. این مهم‌ترین نتیجهٔ PMO Study است و عمداً
 *     صریح گزارش می‌شود.
 *   • اگر β > ۱، شبکه‌ای از فواصل پیمایش و فاصله‌ای با کمینهٔ نرخ هزینه
 *     انتخاب می‌شود؛ نرخ هزینه در همان فاصله با حالت «هرگز سرویس نکن»
 *     مقایسه و درصد صرفه‌جویی گزارش می‌شود.
 */
export function optimizePmInterval(input: {
  eta: number; beta: number; preventiveCost: number; failureCost: number; meanRepairHours: number;
  minInterval?: number; maxInterval?: number; step?: number;
}): PmOptimizationResult {
  const eta = input.eta;
  const beta = input.beta;
  if (!(eta > 0)) throw new RangeError(`CMMS_PM_ETA: η باید مثبت باشد (${eta})`);
  if (!(beta > 0)) throw new RangeError(`CMMS_PM_BETA: β باید مثبت باشد (${beta})`);

  const warnings: string[] = [];
  const wearOutDetected = beta > 1;
  const maxInterval = input.maxInterval ?? Math.max(eta * 2, 1);
  const minInterval = input.minInterval ?? Math.max(maxInterval * 0.02, 1);
  const step = input.step ?? Math.max((maxInterval - minInterval) / 60, 1);

  /* «هرگز سرویس نکن» با فاصله‌ای بسیار بزرگ تقریب زده می‌شود؛ بی‌نهایت
   * در محاسبهٔ عددی معنا ندارد. */
  const runToFailureInterval = Math.max(maxInterval * 20, eta * 20);
  const costRateRunToFailure = ageReplacementCostRate(runToFailureInterval, input);

  if (!wearOutDetected) {
    warnings.push(`β=${beta} ≤ ۱ است؛ الگوی فرسایش دیده نمی‌شود و سرویس پیشگیرانه دوره‌ای توجیه اقتصادی ندارد.`);
    if (input.failureCost > input.preventiveCost * 10) {
      warnings.push("هزینهٔ خرابی بسیار بیشتر از سرویس است؛ پایش وضعیت (CBM) جایگزین مناسب‌تری است.");
    }
    return {
      recommendedInterval: runToFailureInterval,
      costRateAtRecommended: round4(costRateRunToFailure),
      costRateRunToFailure: round4(costRateRunToFailure),
      savingPct: 0, beta, eta,
      recommendationFa: "بدون الگوی فرسایش (β≤۱): استراتژی کار تا خرابی یا پایش وضعیت پیشنهاد می‌شود، نه سرویس دوره‌ای.",
      wearOutDetected, grid: [], warnings,
    };
  }

  const grid: Array<{ interval: number; costRate: number }> = [];
  let best = { interval: minInterval, costRate: ageReplacementCostRate(minInterval, input) };
  for (let t = minInterval; t <= maxInterval + 1e-9; t += step) {
    const costRate = ageReplacementCostRate(t, input);
    const point = { interval: round4(t), costRate: round4(costRate) };
    grid.push(point);
    if (costRate < best.costRate) best = { interval: t, costRate };
  }
  if (grid.length === 0) warnings.push("شبکهٔ جست‌وجو خالی شد؛ بازهٔ minInterval/maxInterval را بازبینی کنید.");

  const savingPct = costRateRunToFailure > 0
    ? round4(((costRateRunToFailure - best.costRate) / costRateRunToFailure) * 100)
    : null;

  return {
    recommendedInterval: round4(best.interval),
    costRateAtRecommended: round4(best.costRate),
    costRateRunToFailure: round4(costRateRunToFailure),
    savingPct, beta, eta,
    recommendationFa: savingPct != null && savingPct > 0
      ? `فاصلهٔ بهینهٔ سرویس ${round4(best.interval)} ساعت با ${savingPct}٪ کاهش نرخ هزینه نسبت به حالت بدون سرویس.`
      : "سرویس پیشگیرانه در این بازه مزیت هزینه‌ای نسبت به کار تا خرابی ایجاد نکرد.",
    wearOutDetected, grid, warnings,
  };
}

/* ═══════════════════════ ۱۰. موتور گردش‌کار ═══════════════════════ */

export type WorkflowStepDef = {
  stepCode: string;
  stepKind: "task" | "approval" | "notification" | "end";
  ownerRole: string;
  slaHours?: number | null;
  isTerminal?: boolean;
  requiresEvidence?: boolean;
};

export type WorkflowTransitionDef = {
  fromStepCode: string;
  toStepCode: string;
  actionCode: string;
  requiredPermission: string;
};

export type WorkflowDefinition = {
  workflowCode: string;
  startStepCode: string;
  steps: WorkflowStepDef[];
  transitions: WorkflowTransitionDef[];
};

export class CmmsWorkflowError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "CmmsWorkflowError";
  }
}

/**
 * اعتبارسنجی ساختاری یک تعریف گردش‌کار.
 * این بررسی پیش از اجرای هر گذار انجام می‌شود، چون تعریف ناسالم در زمان
 * اجرا به «بن‌بست بی‌صدا» می‌رسد که در محیط عملیاتی بسیار پرهزینه‌تر از
 * یک خطای صریح در زمان تعریف است.
 */
export function validateWorkflowDefinition(definition: WorkflowDefinition): string[] {
  const issues: string[] = [];
  const codes = new Set<string>();
  for (const step of definition.steps ?? []) {
    if (!step.stepCode) { issues.push("گامی بدون کد وجود دارد"); continue; }
    if (codes.has(step.stepCode)) issues.push(`کد گام تکراری: ${step.stepCode}`);
    codes.add(step.stepCode);
  }
  if (!definition.startStepCode) issues.push("گام شروع تعریف نشده است");
  else if (!codes.has(definition.startStepCode)) issues.push(`گام شروع «${definition.startStepCode}» در فهرست گام‌ها نیست`);

  const terminals = (definition.steps ?? []).filter((step) => step.isTerminal || step.stepKind === "end");
  if (terminals.length === 0) issues.push("هیچ گام پایانی تعریف نشده — گردش‌کار هرگز بسته نمی‌شود");

  const outgoing = new Set((definition.transitions ?? []).map((t) => t.fromStepCode));
  for (const step of definition.steps ?? []) {
    const isTerminal = step.isTerminal || step.stepKind === "end";
    if (!isTerminal && !outgoing.has(step.stepCode)) {
      issues.push(`گام «${step.stepCode}» نه پایانی است نه خروجی دارد (بن‌بست)`);
    }
  }
  for (const transition of definition.transitions ?? []) {
    if (!codes.has(transition.fromStepCode)) issues.push(`گذار از گام ناموجود: ${transition.fromStepCode}`);
    if (!codes.has(transition.toStepCode)) issues.push(`گذار به گام ناموجود: ${transition.toStepCode}`);
    if (!transition.requiredPermission) issues.push(`گذار ${transition.fromStepCode}→${transition.toStepCode} مجوز لازم ندارد`);
  }
  /* گام شروع نباید مقصد هیچ گذاری باشد، وگرنه گردش‌کار می‌تواند به وضعیت
   * «هنوز شروع نشده» برگردد. */
  for (const transition of definition.transitions ?? []) {
    if (transition.toStepCode === definition.startStepCode && transition.actionCode !== "reopen") {
      issues.push(`گذار به گام شروع با اقدام «${transition.actionCode}» مجاز نیست`);
    }
  }
  return issues;
}

export type WorkflowAdvanceInput = {
  definition: WorkflowDefinition;
  currentStepCode: string;
  actionCode: string;
  now: Date | string;
  actorPermissions: string[];
  actorRoles: string[];
  evidenceProvided?: boolean;
};

export type WorkflowAdvanceResult = {
  nextStepCode: string;
  nextStep: WorkflowStepDef;
  terminal: boolean;
  dueAt: string | null;
  transition: WorkflowTransitionDef;
  slaHours: number | null;
};

/**
 * اجرای یک گذار در گردش‌کار.
 *
 * سه بررسی به ترتیب «رد غالب»:
 *   ۱) گذار تعریف‌شده برای این گام و این اقدام وجود دارد؟
 *   ۲) بازیگر مجوز لازم را دارد؟
 *   ۳) اگر گام مقصد نیازمند مدرک است، مدرک ارائه شده؟
 *
 * نقش مسئول گام هم سنجیده می‌شود، چون در نت تفکیک «انجام‌دهنده» و
 * «تأییدکننده» یک الزام ممیزی است نه یک ترجیح.
 */
export function advanceWorkflow(input: WorkflowAdvanceInput): WorkflowAdvanceResult {
  const { definition, currentStepCode, actionCode, actorPermissions, actorRoles } = input;
  const transition = (definition.transitions ?? []).find(
    (candidate) => candidate.fromStepCode === currentStepCode && candidate.actionCode === actionCode,
  );
  if (!transition) {
    throw new CmmsWorkflowError(
      "CMMS_WF_NO_TRANSITION",
      `گذار «${actionCode}» از گام «${currentStepCode}» در گردش‌کار «${definition.workflowCode}» تعریف نشده است`,
    );
  }
  if (!actorPermissions.includes(transition.requiredPermission)) {
    throw new CmmsWorkflowError(
      "CMMS_WF_FORBIDDEN",
      `مجوز «${transition.requiredPermission}» برای این گذار لازم است`,
    );
  }
  const nextStep = (definition.steps ?? []).find((step) => step.stepCode === transition.toStepCode);
  if (!nextStep) {
    throw new CmmsWorkflowError("CMMS_WF_MISSING_STEP", `گام مقصد «${transition.toStepCode}» تعریف نشده است`);
  }
  /* مدرک، پیش‌فرض «ندارد» است نه «دارد». یک گردش‌کار تأیید که با فراموش‌کردن
   * فیلد باز شود، همان چیزی است که ممیزی ISO 55001 رد می‌کند؛ پس نبودِ
   * evidenceProvided عمداً با false یکی گرفته می‌شود (شکست-بسته). */
  if (nextStep.requiresEvidence && input.evidenceProvided !== true) {
    throw new CmmsWorkflowError("CMMS_WF_EVIDENCE_REQUIRED", `گام «${nextStep.stepCode}» نیازمند بارگذاری مدرک است`);
  }
  if (!actorRoles.includes(nextStep.ownerRole) && nextStep.ownerRole !== "*") {
    /* رسیدن به گامی که بازیگر نقشش را ندارد مجاز است (انتقال کار)، اما باید
     * صریحاً به همان نقش واگذار شود؛ اینجا فقط هشدار ثبت نمی‌کنیم بلکه
     * مسئول گام را در خروجی برمی‌گردانیم تا لایهٔ HTTP کارتابل را به‌روز کند. */
  }

  const at = input.now instanceof Date ? input.now : new Date(input.now);
  if (Number.isNaN(at.getTime())) throw new CmmsWorkflowError("CMMS_WF_BAD_TIME", "زمان نامعتبر برای محاسبهٔ SLA");

  const terminal = Boolean(nextStep.isTerminal) || nextStep.stepKind === "end";
  const slaHours = nextStep.slaHours ?? null;
  const dueAt = !terminal && slaHours != null && slaHours > 0
    ? new Date(at.getTime() + slaHours * 3600_000).toISOString()
    : null;

  return { nextStepCode: nextStep.stepCode, nextStep, terminal, dueAt, transition, slaHours };
}

/* ═══════════════════════ ۱۱. درخت تجهیز و خانواده ═══════════════════════ */

export type TreeNode = { id: string; parentId: string | null; code?: string; name?: string };

export type TreeBuildResult<T extends TreeNode> = {
  roots: Array<T & { children: Array<T & { children: unknown[] }>; depth: number; pathCode: string }>;
  /** همهٔ گره‌ها با عمق و مسیر کد — برای جدول و جست‌وجو. */
  flat: Array<T & { depth: number; pathCode: string }>;
  /** شناسهٔ گره‌هایی که در حلقه افتاده‌اند و از درخت بیرون گذاشته شدند. */
  orphans: string[];
  cycleMembers: string[];
  maxDepth: number;
};

/**
 * ساخت درخت از فهرست مسطح گره‌ها با تشخیص حلقه.
 *
 * حلقه به‌جای حلقهٔ بی‌پایان، به‌صورت «حذف گره‌های عضو حلقه و گزارش آنها»
 * مدیریت می‌شود؛ چون دادهٔ خراب کاربر نباید فرایند را قفل کند، ولی نباید
 * بی‌صدا هم نادیده گرفته شود.
 */
export function buildTree<T extends TreeNode>(nodes: T[], separator = "/"): TreeBuildResult<T> {
  const byId = new Map<string, T>();
  for (const node of nodes) byId.set(node.id, node);

  const depthCache = new Map<string, number>();
  const cycleMembers = new Set<string>();

  const depthOf = (node: T, seen: Set<string>): number | null => {
    if (depthCache.has(node.id)) return depthCache.get(node.id)!;
    if (seen.has(node.id)) { cycleMembers.add(node.id); return null; }
    seen.add(node.id);
    if (!node.parentId || !byId.has(node.parentId)) {
      depthCache.set(node.id, 0);
      return 0;
    }
    const parent = byId.get(node.parentId)!;
    const parentDepth = depthOf(parent, seen);
    if (parentDepth == null) { cycleMembers.add(node.id); return null; }
    const depth = parentDepth + 1;
    depthCache.set(node.id, depth);
    return depth;
  };

  const pathOf = (node: T): string => {
    const parts: string[] = [];
    let current: T | undefined = node;
    const guard = new Set<string>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      parts.unshift(current.code ?? current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return parts.join(separator);
  };

  const flat: Array<T & { depth: number; pathCode: string }> = [];
  for (const node of nodes) {
    const depth = depthOf(node, new Set<string>());
    if (depth == null) continue;
    flat.push({ ...node, depth, pathCode: pathOf(node) });
  }

  const flatById = new Map(flat.map((entry) => [entry.id, entry]));
  const childrenOf = new Map<string, typeof flat>();
  const roots: typeof flat = [];
  for (const entry of flat) {
    if (!entry.parentId || !flatById.has(entry.parentId)) {
      roots.push(entry);
      continue;
    }
    const list = childrenOf.get(entry.parentId) ?? [];
    list.push(entry);
    childrenOf.set(entry.parentId, list);
  }

  const orphans = nodes.filter((node) => !flatById.has(node.id)).map((node) => node.id);
  const maxDepth = flat.reduce((max, entry) => Math.max(max, entry.depth), -1);

  return { roots: roots as never, flat, orphans, cycleMembers: [...cycleMembers], maxDepth };
}

/** آیا افزودن یال parent→child حلقه می‌سازد؟ (برای جلوگیری از ذخیرهٔ درخت خراب) */
export function wouldCreateCycle(nodes: TreeNode[], parentId: string, childId: string): boolean {
  if (parentId === childId) return true;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let cursor = byId.get(parentId);
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    if (cursor.id === childId) return true;
    seen.add(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return false;
}

/* ═══════════════════════ ۱۲. BS EN 15341 — شاخص‌ها ═══════════════════════ */

export type KpiDirection = "maximize" | "minimize" | "target";

/**
 * سلامت یک شاخص بر پایهٔ جهت بهینه‌سازی و آستانه‌ها (EN 15341).
 *
 * برای «maximize»: سبز اگر ≥ هدف، زرد اگر ≥ هشدار، قرمز در غیر این صورت.
 * برای «minimize»:  سبز اگر ≤ هدف، زرد اگر ≤ هشدار، قرمز در غیر این صورت.
 * برای «target»:    سبز در بازهٔ هشدار حول هدف، قرمز بیرون بازهٔ آلارم.
 */
export function evaluateKpiHealth(input: {
  actualValue: number;
  targetValue: number | null;
  warnThreshold?: number | null;
  alarmThreshold?: number | null;
  direction: KpiDirection;
}): { health: "green" | "amber" | "red"; variancePct: number | null; reasonFa: string } {
  const { actualValue, targetValue, direction } = input;
  if (!Number.isFinite(actualValue)) throw new RangeError(`CMMS_KPI_VALUE: مقدار نامعتبر (${actualValue})`);
  if (!["maximize", "minimize", "target"].includes(direction)) {
    throw new RangeError(`CMMS_KPI_DIRECTION: جهت نامعتبر «${direction}»`);
  }
  const warn = input.warnThreshold ?? null;
  const alarm = input.alarmThreshold ?? null;
  const variancePct = targetValue != null && targetValue !== 0
    ? round4(((actualValue - targetValue) / Math.abs(targetValue)) * 100)
    : null;

  let health: "green" | "amber" | "red";
  let reasonFa: string;

  if (direction === "maximize") {
    if (targetValue == null) {
      health = "green";
      reasonFa = "هدفی تعریف نشده؛ وضعیت سبز فرض شد.";
    } else if (actualValue >= targetValue) {
      health = "green";
      reasonFa = `مقدار ${actualValue} به هدف ${targetValue} رسیده است.`;
    } else if (warn != null && actualValue >= warn) {
      health = "amber";
      reasonFa = `مقدار ${actualValue} زیر هدف ${targetValue} ولی بالای آستانهٔ هشدار ${warn} است.`;
    } else {
      health = alarm != null && actualValue < alarm ? "red" : "red";
      reasonFa = alarm != null && actualValue < alarm
        ? `مقدار ${actualValue} زیر آستانهٔ آلارم ${alarm} است.`
        : `مقدار ${actualValue} به هدف ${targetValue} نرسیده است.`;
    }
  } else if (direction === "minimize") {
    if (targetValue == null) {
      health = "green";
      reasonFa = "هدفی تعریف نشده؛ وضعیت سبز فرض شد.";
    } else if (actualValue <= targetValue) {
      health = "green";
      reasonFa = `مقدار ${actualValue} زیر هدف ${targetValue} است.`;
    } else if (warn != null && actualValue <= warn) {
      health = "amber";
      reasonFa = `مقدار ${actualValue} بالای هدف ${targetValue} ولی زیر آستانهٔ هشدار ${warn} است.`;
    } else {
      health = "red";
      reasonFa = alarm != null && actualValue > alarm
        ? `مقدار ${actualValue} بالای آستانهٔ آلارم ${alarm} است.`
        : `مقدار ${actualValue} از هدف ${targetValue} فراتر رفته است.`;
    }
  } else {
    const band = warn != null ? Math.abs(warn) : Math.abs(targetValue ?? 0) * 0.1;
    const alarmBand = alarm != null ? Math.abs(alarm) : band * 2;
    const deviation = Math.abs(actualValue - (targetValue ?? 0));
    if (targetValue == null) {
      health = "green";
      reasonFa = "هدفی تعریف نشده؛ وضعیت سبز فرض شد.";
    } else if (deviation <= band) {
      health = "green";
      reasonFa = `انحراف ${round4(deviation)} در بازهٔ مجاز ${round4(band)} است.`;
    } else if (deviation <= alarmBand) {
      health = "amber";
      reasonFa = `انحراف ${round4(deviation)} از بازهٔ هشدار گذشته است.`;
    } else {
      health = "red";
      reasonFa = `انحراف ${round4(deviation)} از بازهٔ آلارم ${round4(alarmBand)} گذشته است.`;
    }
  }
  return { health, variancePct, reasonFa };
}

/* ═══════════════════════ ۱۳. بحرانی‌بودن و اولویت ═══════════════════════ */

/**
 * ماتریس بحرانی‌بودن تجهیز (معیار رایج صنعتی، هم‌راستا با ISO 55001).
 * امتیاز = وزن پیامد × وزن احتمال، خروجی A/B/C/D.
 */
export function computeAssetCriticality(input: {
  safetyImpact: 1 | 2 | 3 | 4 | 5;
  productionImpact: 1 | 2 | 3 | 4 | 5;
  maintenanceCostImpact: 1 | 2 | 3 | 4 | 5;
  failureFrequency: 1 | 2 | 3 | 4 | 5;
  spareAvailability: 1 | 2 | 3 | 4 | 5;
  weights?: { safety: number; production: number; cost: number; frequency: number; spare: number };
}): { score: number; rank: "A" | "B" | "C" | "D"; driversFa: string[] } {
  const weights = { safety: 0.35, production: 0.30, cost: 0.15, frequency: 0.15, spare: 0.05, ...(input.weights ?? {}) };
  const parts: Array<[string, number, number]> = [
    ["ایمنی و محیط زیست", input.safetyImpact, weights.safety],
    ["اثر بر تولید", input.productionImpact, weights.production],
    ["هزینهٔ نت", input.maintenanceCostImpact, weights.cost],
    ["تکرار خرابی", input.failureFrequency, weights.frequency],
    ["دسترس‌پذیری قطعهٔ یدکی", input.spareAvailability, weights.spare],
  ];
  for (const [name, value] of parts) {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new RangeError(`CMMS_CRITICALITY: ${name} باید عدد صحیح ۱ تا ۵ باشد (دریافت: ${value})`);
    }
  }
  const weightSum = Object.values(weights).reduce((sum, w) => sum + w, 0) || 1;
  /* میانگین وزنیِ امتیازهای ۱..۵ خودش در همان بازه است؛ تقسیم بر مجموع وزن‌ها
   * فقط برای وقتی لازم است که وزن‌های سفارشی جمعشان ۱ نباشد. ضرب دوباره در ۵
   * مقیاس را به ۵..۲۵ می‌برد و آستانه‌های A/B/C/D را بی‌معنا می‌کند. */
  const score = round4(parts.reduce((sum, [, value, weight]) => sum + value * weight, 0) / weightSum);
  const rank: "A" | "B" | "C" | "D" = score >= 4 ? "A" : score >= 3 ? "B" : score >= 2 ? "C" : "D";
  const driversFa = [...parts]
    .filter(([, value]) => value >= 4)
    .map(([name, value]) => `${name}: ${value}/۵`)
    .sort();
  return { score, rank, driversFa };
}

/**
 * امتیاز اولویت یک دستورکار برای صف‌بندی در زمان‌بند.
 * وزن‌ها صریح‌اند تا برنامه‌ریز بتواند آنها را ببیند و بحث کند — اولویت‌بندی
 * پنهان در نت، منبع اصلی اختلاف بین برنامه‌ریزی و اجراست.
 */
export function computeWorkOrderPriorityScore(input: {
  criticalityRank: "A" | "B" | "C" | "D";
  isAssetDown: boolean;
  productionImpact: "none" | "partial" | "line-stop" | "plant-stop";
  safetyConcern: boolean;
  hoursUntilDue: number | null;
  /**
   * وزن‌های قابل تنظیم. عمداً Partial است: فراخوان می‌تواند فقط یک وزن را
   * عوض کند و بقیه پیش‌فرض بمانند — پیاده‌سازی هم روی پیش‌فرض‌ها spread
   * می‌کند. اگر Partial نبود، هر فراخوانی مجبور می‌شد هر پنج وزن را بنویسد.
   */
  weights?: Partial<{ criticality: number; downtime: number; impact: number; safety: number; urgency: number }>;
}): { score: number; components: Record<string, number>; reasonFa: string } {
  const weights = { criticality: 30, downtime: 25, impact: 20, safety: 15, urgency: 10, ...(input.weights ?? {}) };
  const criticalityValue = { A: 1, B: 0.7, C: 0.4, D: 0.15 }[input.criticalityRank];
  if (criticalityValue == null) throw new RangeError(`CMMS_PRIORITY_CRITICALITY: رتبهٔ نامعتبر «${input.criticalityRank}»`);
  const impactValue = { none: 0, partial: 0.4, "line-stop": 0.8, "plant-stop": 1 }[input.productionImpact];
  if (impactValue == null) throw new RangeError(`CMMS_PRIORITY_IMPACT: اثر نامعتبر «${input.productionImpact}»`);

  /* فوریت: هرچه به سررسید نزدیک‌تر، امتیاز بیشتر. سررسید گذشته = ۱. */
  const urgencyValue = input.hoursUntilDue == null ? 0.5
    : input.hoursUntilDue <= 0 ? 1
      : Math.max(0, 1 - input.hoursUntilDue / 168);

  const components = {
    criticality: round4(criticalityValue * weights.criticality),
    downtime: round4((input.isAssetDown ? 1 : 0) * weights.downtime),
    impact: round4(impactValue * weights.impact),
    safety: round4((input.safetyConcern ? 1 : 0) * weights.safety),
    urgency: round4(urgencyValue * weights.urgency),
  };
  const score = round4(Object.values(components).reduce((sum, value) => sum + value, 0));
  const reasonFa = [
    `بحرانی‌بودن ${input.criticalityRank}`,
    input.isAssetDown ? "تجهیز از مدار خارج" : "تجهیز در مدار",
    `اثر تولید: ${input.productionImpact}`,
    input.safetyConcern ? "ملاحظهٔ ایمنی دارد" : "بدون ملاحظهٔ ایمنی",
    input.hoursUntilDue == null ? "بدون سررسید" : `تا سررسید ${round4(input.hoursUntilDue)} ساعت`,
  ].join(" · ");
  return { score, components, reasonFa };
}

/** مرتب‌سازی پایدار بر پایهٔ امتیاز نزولی، با شکستن تساوی بر پایهٔ سررسید. */
export function sortByPriority<T>(items: T[], scoreOf: (item: T) => number, tieBreaker?: (a: T, b: T) => number): T[] {
  return [...items].sort((left, right) => {
    const difference = scoreOf(right) - scoreOf(left);
    if (Math.abs(difference) > 1e-9) return difference;
    return tieBreaker ? tieBreaker(left, right) : 0;
  });
}
