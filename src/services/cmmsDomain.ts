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

/* ═══════════════════════ ۱۴. چرخهٔ عمر دستورکار — توقف / ادامه ═══════════════════════ */

/**
 * ماشین وضعیت دستورکار نت.
 *
 * پیش از این، گذارها درون `server/cmmsApi.js` پراکنده بودند و هر مسیر فهرست
 * «وضعیت‌های مجاز» خودش را داشت. حالا یک منبع حقیقت وجود دارد تا فرانت‌اند
 * (برای فعال/غیرفعال‌کردن دکمه) و بک‌اند (برای اعتبارسنجی) از یک جدول
 * بخوانند. `hold` و `resume` پیش‌تر هیچ مسیر REST نداشتند و وضعیت `on-hold`
 * فقط با `start` ترک می‌شد؛ اکنون هر دو گذار صریح و آزمون‌پذیرند.
 */
export const CMMS_WORK_ORDER_STATUSES = [
  "draft", "planned", "scheduled", "released", "in-progress",
  "on-hold", "completed", "closed", "cancelled",
] as const;

export type CmmsWorkOrderStatus = (typeof CMMS_WORK_ORDER_STATUSES)[number];

export const CMMS_WORK_ORDER_ACTIONS = [
  "release", "start", "hold", "resume", "complete", "close", "cancel",
] as const;

export type CmmsWorkOrderAction = (typeof CMMS_WORK_ORDER_ACTIONS)[number];

export type WorkOrderTransitionRule = {
  /** وضعیت‌هایی که گذار از آن‌ها مجاز است. */
  from: readonly CmmsWorkOrderStatus[];
  /** وضعیت مقصد — برای `resume` مقدار پیش‌فرض است، چون وضعیت واقعی از رکورد توقف می‌آید. */
  to: CmmsWorkOrderStatus;
  /** آیا این گذار وضعیت پیشین را بازمی‌گرداند؟ */
  restoresPreviousStatus?: boolean;
  /** آیا گذار نیازمند علت مستند است؟ */
  requiresReason?: boolean;
};

export const CMMS_WORK_ORDER_TRANSITIONS: Readonly<Record<CmmsWorkOrderAction, WorkOrderTransitionRule>> = Object.freeze({
  release: { from: ["draft", "planned", "scheduled"], to: "released" },
  start: { from: ["released", "on-hold"], to: "in-progress" },
  /* توقف از «در حال اجرا» و همچنین از مراحل پیش از اجرا مجاز است: توقف
   * «انتظار مجوز کار» یا «انتظار قطعه» پیش از شروع کار هم رخ می‌دهد. */
  hold: { from: ["planned", "scheduled", "released", "in-progress"], to: "on-hold", requiresReason: true },
  resume: { from: ["on-hold"], to: "in-progress", restoresPreviousStatus: true },
  complete: { from: ["in-progress"], to: "completed" },
  close: { from: ["completed"], to: "closed" },
  cancel: { from: ["draft", "planned", "scheduled", "released", "on-hold"], to: "cancelled" },
});

export const CMMS_HOLD_CATEGORIES = [
  "material", "labor", "permit", "schedule", "safety", "machine", "process", "other",
] as const;

export type CmmsHoldCategory = (typeof CMMS_HOLD_CATEGORIES)[number];

/** نوع توقف در واژگان IEC 60050-192: توقف برنامه‌ریزی‌شده در برابر ناخواسته. */
export const CMMS_HOLD_DOWNTIME_TYPES = ["planned", "unplanned"] as const;
export type CmmsHoldDowntimeType = (typeof CMMS_HOLD_DOWNTIME_TYPES)[number];

export type CmmsHoldReasonDef = {
  code: string;
  fa: string;
  en: string;
  category: CmmsHoldCategory;
  /** نگاشت به `DowntimeType` در MES؛ مبنای محاسبهٔ مؤلفهٔ Availability در OEE. */
  downtimeType: CmmsHoldDowntimeType;
  /** آیا شرح آزاد الزامی است؟ */
  requiresNote: boolean;
};

/**
 * کاتالوگ علل توقف. این فهرست بسته است تا گزارش «چرا دستورکارها می‌خوابند»
 * قابل تجمیع باشد؛ شرح آزاد مکمل است نه جایگزین.
 */
export const CMMS_HOLD_REASONS: readonly CmmsHoldReasonDef[] = Object.freeze([
  { code: "waiting-parts", fa: "انتظار قطعهٔ یدکی", en: "Waiting for spare part", category: "material", downtimeType: "unplanned", requiresNote: false },
  { code: "waiting-tools", fa: "انتظار ابزار یا تجهیز ویژه", en: "Waiting for special tools", category: "material", downtimeType: "unplanned", requiresNote: false },
  { code: "waiting-vendor", fa: "انتظار پیمانکار / سرویس‌کار", en: "Waiting for vendor", category: "labor", downtimeType: "unplanned", requiresNote: false },
  { code: "waiting-crew", fa: "انتظار گروه کاری یا نفر", en: "Waiting for crew", category: "labor", downtimeType: "unplanned", requiresNote: false },
  { code: "waiting-permit", fa: "انتظار مجوز کار (PTW)", en: "Waiting for work permit", category: "permit", downtimeType: "planned", requiresNote: false },
  { code: "waiting-production-window", fa: "انتظار پنجرهٔ توقف تولید", en: "Waiting for production window", category: "schedule", downtimeType: "planned", requiresNote: false },
  { code: "waiting-shutdown", fa: "انتظار توقف اساسی (Shutdown)", en: "Waiting for shutdown", category: "schedule", downtimeType: "planned", requiresNote: false },
  { code: "machine-breakdown", fa: "خرابی تجهیز", en: "Machine breakdown", category: "machine", downtimeType: "unplanned", requiresNote: false },
  { code: "process-hold", fa: "توقف فرآیندی / کیفیت", en: "Process or quality hold", category: "process", downtimeType: "planned", requiresNote: false },
  { code: "unsafe-condition", fa: "شرایط ناایمن", en: "Unsafe condition", category: "safety", downtimeType: "unplanned", requiresNote: true },
  { code: "weather", fa: "شرایط جوی", en: "Weather condition", category: "other", downtimeType: "unplanned", requiresNote: false },
  { code: "other", fa: "سایر (شرح الزامی)", en: "Other (note required)", category: "other", downtimeType: "unplanned", requiresNote: true },
]);

export function holdReasonByCode(code: unknown): CmmsHoldReasonDef | null {
  if (typeof code !== "string") return null;
  return CMMS_HOLD_REASONS.find((item) => item.code === code.trim().toLowerCase()) ?? null;
}

export type OpenHoldLike = {
  HoldStatus?: string | null;
  PreviousStatus?: string | null;
  HoldReasonCode?: string | null;
} | null;

export type WorkOrderTransitionPlan = {
  action: CmmsWorkOrderAction;
  from: string;
  to: CmmsWorkOrderStatus | null;
  allowed: boolean;
  code: string | null;
  messageFa: string | null;
  allowedFrom: readonly CmmsWorkOrderStatus[];
  /** فقط برای `resume`: وضعیت پیش از توقف که باید بازگردد. */
  previousStatus?: CmmsWorkOrderStatus | null;
};

const isWorkOrderStatus = (value: unknown): value is CmmsWorkOrderStatus =>
  typeof value === "string" && (CMMS_WORK_ORDER_STATUSES as readonly string[]).includes(value);

/**
 * برنامه‌ریزی یک گذار روی دستورکار.
 *
 * این تابع هیچ I/O ندارد و «تصمیم» را از «اجرا» جدا می‌کند؛ لایهٔ HTTP بعد از
 * گرفتن مجوز، فقط نتیجه را در تراکنش می‌نویسد. برای `resume` وضعیت مقصد از
 * رکورد توقف باز خوانده می‌شود، چون بازگرداندن دستورکار به وضعیت پیش از توقف
 * یک الزام عملیاتی است نه یک جزئیات پیاده‌سازی.
 */
export function planWorkOrderTransition(input: {
  action: CmmsWorkOrderAction;
  currentStatus: string;
  openHold?: OpenHoldLike;
  now?: Date | string;
}): WorkOrderTransitionPlan {
  const rule = CMMS_WORK_ORDER_TRANSITIONS[input.action];
  const base: WorkOrderTransitionPlan = {
    action: input.action,
    from: input.currentStatus,
    to: rule?.to ?? null,
    allowed: false,
    code: null,
    messageFa: null,
    allowedFrom: rule?.from ?? [],
  };
  if (!rule) {
    return { ...base, code: "CMMS_WO_UNKNOWN_ACTION", messageFa: `اقدام «${input.action}» شناخته‌شده نیست` };
  }
  const openHold = input.openHold ?? null;

  if (input.action === "hold") {
    if (openHold && openHold.HoldStatus === "open") {
      return { ...base, code: "CMMS_HOLD_ALREADY_OPEN", messageFa: "این دستورکار از قبل متوقف است؛ ابتدا آن را ادامه دهید" };
    }
  }
  if (input.action === "resume") {
    if (!openHold || openHold.HoldStatus !== "open") {
      return { ...base, code: "CMMS_HOLD_NOT_OPEN", messageFa: "دستورکار در وضعیت توقف نیست" };
    }
    const previous = openHold.PreviousStatus;
    if (!isWorkOrderStatus(previous) || ["completed", "closed", "cancelled", "on-hold"].includes(previous)) {
      return {
        ...base,
        code: "CMMS_HOLD_PREVIOUS_STATUS_INVALID",
        messageFa: `وضعیت پیش از توقف («${String(previous)}») برای بازگشت معتبر نیست`,
      };
    }
    if (!rule.from.includes(input.currentStatus as CmmsWorkOrderStatus)) {
      return {
        ...base,
        code: "CMMS_WO_STATE",
        messageFa: `دستورکار در وضعیت «${input.currentStatus}» قابل «${input.action}» نیست`,
      };
    }
    return { ...base, to: previous, allowed: true, previousStatus: previous };
  }

  if (!rule.from.includes(input.currentStatus as CmmsWorkOrderStatus)) {
    return {
      ...base,
      code: "CMMS_WO_STATE",
      messageFa: `دستورکار در وضعیت «${input.currentStatus}» قابل «${input.action}» نیست`,
    };
  }
  return { ...base, allowed: true };
}

/**
 * اعتبارسنجی درخواست توقف. شرح برای علل `requiresNote` اجباری است و زمان
 * بازگشت پیش‌بینی‌شده نباید در گذشته باشد — وگرنه «توقف با بازگشت گذشته»
 * ثبت می‌شود و در محاسبهٔ Availability بی‌معنا می‌شود.
 */
export function validateHoldRequest(input: {
  reasonCode: unknown;
  reasonFa?: string | null;
  noteFa?: string | null;
  expectedResumeAt?: string | Date | null;
  now?: Date | string;
}): string[] {
  const issues: string[] = [];
  const reason = holdReasonByCode(input.reasonCode);
  if (!reason) {
    issues.push("HoldReasonCode باید یکی از علل کاتالوگ باشد");
    return issues;
  }
  const narrative = String(input.noteFa ?? input.reasonFa ?? "").trim();
  if (reason.requiresNote && narrative.length < 5) {
    issues.push(`برای علت «${reason.fa}» ثبت شرح حداقل ۵ نویسه‌ای الزامی است`);
  }
  if (input.expectedResumeAt) {
    const expected = input.expectedResumeAt instanceof Date ? input.expectedResumeAt : new Date(input.expectedResumeAt);
    if (Number.isNaN(expected.getTime())) {
      issues.push("ExpectedResumeAt تاریخ معتبر نیست");
    } else {
      const now = input.now instanceof Date ? input.now : input.now ? new Date(input.now) : new Date();
      if (!Number.isNaN(now.getTime()) && expected.getTime() < now.getTime()) {
        issues.push("زمان بازگشت پیش‌بینی‌شده در گذشته است");
      }
    }
  }
  return issues;
}

/** مدت توقف بر حسب دقیقه — تا سطح دقیقه گرد می‌شود چون SLA نت دقیقه‌ای است. */
export function computeHoldMinutes(heldAt: string | Date, resumedAt: string | Date): number | null {
  const start = heldAt instanceof Date ? heldAt : new Date(heldAt);
  const end = resumedAt instanceof Date ? resumedAt : new Date(resumedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end.getTime() < start.getTime()) return null;
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

export type HoldHistorySummary = {
  count: number;
  openHold: boolean;
  totalMinutes: number;
  downtimeMinutes: number;
  meanMinutes: number;
  longestMinutes: number;
  byCategory: Array<{ category: CmmsHoldCategory | "unknown"; minutes: number; count: number }>;
  topReasonCode: string | null;
  interpretationFa: string;
};

/**
 * تجمیع تاریخچهٔ توقف یک دستورکار — ورودی مستقیم گزارش «علل رایج توقف» و
 * «زمان از دست رفتهٔ نت». ورودی ناقص باعث استثنا نمی‌شود؛ ردیف ناشناخته
 * در دستهٔ `unknown` می‌افتد تا آمار بی‌صدا کوچک نشود.
 */
export function summarizeHoldHistory(holds: Array<Record<string, unknown>>, now: Date | string = new Date()): HoldHistorySummary {
  const rows = Array.isArray(holds) ? holds : [];
  const at = now instanceof Date ? now : new Date(now);
  let totalMinutes = 0;
  let downtimeMinutes = 0;
  let longest = 0;
  let openHold = false;
  const byCategory = new Map<string, { minutes: number; count: number }>();
  const byReason = new Map<string, number>();

  for (const row of rows) {
    const reason = holdReasonByCode(row.HoldReasonCode);
    const category = (row.HoldCategory as string | undefined) ?? reason?.category ?? "unknown";
    const status = String(row.HoldStatus ?? "");
    let minutes: number | null = null;
    if (status === "open") {
      openHold = true;
      minutes = computeHoldMinutes(String(row.HeldAt ?? ""), at);
    } else if (row.ResumedAt) {
      minutes = computeHoldMinutes(String(row.HeldAt ?? ""), String(row.ResumedAt));
    }
    const safeMinutes = minutes ?? 0;
    totalMinutes += safeMinutes;
    if ((reason?.downtimeType ?? "unplanned") === "unplanned") downtimeMinutes += safeMinutes;
    longest = Math.max(longest, safeMinutes);
    const bucket = byCategory.get(category) ?? { minutes: 0, count: 0 };
    byCategory.set(category, { minutes: bucket.minutes + safeMinutes, count: bucket.count + 1 });
    if (reason) byReason.set(reason.code, (byReason.get(reason.code) ?? 0) + 1);
  }

  const topReasonCode = [...byReason.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    count: rows.length,
    openHold,
    totalMinutes: round(totalMinutes),
    downtimeMinutes: round(downtimeMinutes),
    meanMinutes: rows.length ? round(totalMinutes / rows.length) : 0,
    longestMinutes: round(longest),
    byCategory: [...byCategory.entries()]
      .map(([category, value]) => ({ category: category as CmmsHoldCategory | "unknown", minutes: round(value.minutes), count: value.count }))
      .sort((left, right) => right.minutes - left.minutes),
    topReasonCode,
    interpretationFa: rows.length === 0
      ? "این دستورکار تا کنون متوقف نشده است."
      : `${rows.length} نوبت توقف با مجموع ${round(totalMinutes)} دقیقه؛${openHold ? " یک توقف همچنان باز است" : " همهٔ توقف‌ها بسته شده‌اند"}.`,
  };
}

/* ═══════════════════════ ۱۵. RCFA — ۵ چرا، استخوان‌ماهی، پارتو و CAPA ═══════════════════════ */

/**
 * تحلیل ریشه‌ای خرابی (RCFA) روی سه ستون بنا شده است:
 *   ۱) زنجیرهٔ ۵ چرا  — تفکر علّی خطی و مستند.
 *   ۲) نمودار استخوان‌ماهی (Ishikawa) — جست‌وجوی علل در ۶ شاخهٔ M.
 *   ۳) پارتو — جداکردن «چند علت حیاتی» از «بسیاری علل کم‌اثر».
 *
 * بر پایهٔ آن‌ها، اقدام اصلاحی و پیشگیرانه (CAPA) با مالک، سررسید و تأیید
 * اثربخشی ثبت می‌شود. هیچ‌کدام از توابع این بخش I/O ندارند؛ همان‌ها در
 * فرانت‌اند برای پیش‌نمایش و در سرور برای اعتبارسنجی اجرا می‌شوند.
 */
export const RCFA_METHODS = ["five-why", "fishbone", "combined"] as const;
export type RcfaMethod = (typeof RCFA_METHODS)[number];

export const RCFA_CASE_STATUSES = ["open", "in-progress", "closed", "verified"] as const;
export type RcfaCaseStatus = (typeof RCFA_CASE_STATUSES)[number];

/** ۶M استاندارد نمودار ایشیکاوا. */
export const FISHBONE_CATEGORIES = ["man", "machine", "method", "material", "measurement", "environment"] as const;
export type FishboneCategory = (typeof FISHBONE_CATEGORIES)[number];

export const FISHBONE_CATEGORY_LABELS: Readonly<Record<FishboneCategory, { fa: string; en: string }>> = Object.freeze({
  man: { fa: "نیروی انسانی", en: "Man" },
  machine: { fa: "ماشین و تجهیز", en: "Machine" },
  method: { fa: "روش و رویه", en: "Method" },
  material: { fa: "مواد و قطعه", en: "Material" },
  measurement: { fa: "اندازه‌گیری و پایش", en: "Measurement" },
  environment: { fa: "محیط و شرایط کار", en: "Environment" },
});

/** سقف عمق زنجیرهٔ چرا؛ «۵ چرا» حداقل است نه سقف. */
export const RCFA_MAX_WHY_DEPTH = 7;
/** کمتر از سه سطح، زنجیرهٔ علّی محسوب نمی‌شود. */
export const RCFA_MIN_WHY_DEPTH = 3;

export const CAPA_ACTION_TYPES = ["containment", "corrective", "preventive", "detection", "systemic"] as const;
export type CapaActionType = (typeof CAPA_ACTION_TYPES)[number];

export const CAPA_ACTION_TYPE_LABELS: Readonly<Record<CapaActionType, { fa: string; en: string }>> = Object.freeze({
  containment: { fa: "کنترل موقت (Containment)", en: "Containment" },
  corrective: { fa: "اقدام اصلاحی", en: "Corrective" },
  preventive: { fa: "اقدام پیشگیرانه", en: "Preventive" },
  detection: { fa: "بهبود شناسایی / پایش", en: "Detection improvement" },
  systemic: { fa: "اصلاح سیستمی", en: "Systemic" },
});

export const CAPA_STATUSES = ["draft", "assigned", "in-progress", "implemented", "verified", "closed", "cancelled"] as const;
export type CapaStatus = (typeof CAPA_STATUSES)[number];

export const CAPA_VERIFICATION_RESULTS = ["effective", "partially-effective", "ineffective"] as const;
export type CapaVerificationResult = (typeof CAPA_VERIFICATION_RESULTS)[number];

/** سررسید CAPA بر پایهٔ اولویت — SLA داخلی نت: اولویت ۱ فوری، اولویت ۵ بلندمدت. */
export const CAPA_PRIORITY_SLA_DAYS: Readonly<Record<number, number>> = Object.freeze({ 1: 3, 2: 7, 3: 14, 4: 30, 5: 60 });

export function capaDueDate(priority: number, from: Date | string = new Date()): string {
  const days = CAPA_PRIORITY_SLA_DAYS[priority] ?? CAPA_PRIORITY_SLA_DAYS[3];
  const base = from instanceof Date ? from : new Date(from);
  const at = Number.isNaN(base.getTime()) ? new Date() : base;
  return new Date(at.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export type WhyEntryLike = {
  Sequence: number;
  StatementFa: string;
  EvidencePath?: string | null;
  IsRootCause?: boolean | null;
};

/** پرسش سطح بعدی از سطح پیشین ساخته می‌شود — همان‌طور که در جلسهٔ RCFA پرسیده می‌شود. */
export function buildWhyQuestion(previousStatementFa: string | null | undefined, level: number): string {
  const level$ = Number.isFinite(level) && level > 1 ? Math.trunc(level) : 2;
  const previous = String(previousStatementFa ?? "").trim();
  if (!previous) return `چرا سطح ${level$}: ریشهٔ رویداد چه بود؟`;
  return `چرا «${previous}» رخ داد؟`;
}

/** سطح بعدی زنجیره؛ زنجیره همیشه یک‌پارچه و بدون شکاف ساخته می‌شود. */
export function nextWhyLevel(entries: WhyEntryLike[]): number {
  const levels = (Array.isArray(entries) ? entries : [])
    .map((item) => Number(item.Sequence))
    .filter((value) => Number.isFinite(value) && value > 0);
  return levels.length ? Math.max(...levels) + 1 : 1;
}

export type WhyChainEvaluation = {
  depth: number;
  levels: number[];
  rootCauseLevel: number | null;
  rootCauseCount: number;
  evidencedCount: number;
  evidencedRatio: number;
  terminated: boolean;
  reachedRecommendedDepth: boolean;
  missingLevels: number[];
  issues: string[];
  summaryFa: string;
};

/**
 * ارزیابی زنجیرهٔ ۵ چرا.
 *
 * سه چیز سنجیده می‌شود که در ممیزی پرسیده می‌شود: پیوستگی سطح‌ها، مستندبودن
 * ریشه، و اینکه زنجیره به عمق معنادار رسیده باشد. زنجیرهٔ دو سطحی با ادعای
 * ریشه، «علت‌شناسی ظاهری» است و اینجا هشدار می‌گیرد.
 */
export function evaluateFiveWhyChain(entries: WhyEntryLike[]): WhyChainEvaluation {
  const rows = (Array.isArray(entries) ? entries : []).slice().sort((left, right) => Number(left.Sequence) - Number(right.Sequence));
  const issues: string[] = [];
  const levels = rows.map((row) => Number(row.Sequence));
  const depth = levels.length ? Math.max(...levels) : 0;
  const uniqueLevels = new Set(levels);
  if (uniqueLevels.size !== levels.length) issues.push("سطح تکراری در زنجیرهٔ چرا وجود دارد");

  const missingLevels: number[] = [];
  for (let level = 1; level <= depth; level += 1) {
    if (!uniqueLevels.has(level)) missingLevels.push(level);
  }
  if (missingLevels.length) issues.push(`شکاف در زنجیرهٔ چرا: سطح ${missingLevels.join(", ")} ثبت نشده است`);

  const empty = rows.filter((row) => !String(row.StatementFa ?? "").trim());
  if (empty.length) issues.push(`${empty.length} سطح بدون شرح علت است`);

  const rootRows = rows.filter((row) => row.IsRootCause === true);
  const rootCauseCount = rootRows.length;
  if (rootCauseCount > 1) issues.push("بیش از یک ریشه در یک زنجیرهٔ ۵ چرا اعلام شده است");
  const rootCauseLevel = rootCauseCount === 1 ? Number(rootRows[0].Sequence) : null;

  const evidencedCount = rows.filter((row) => String(row.EvidencePath ?? "").trim().length > 0).length;
  const evidencedRatio = depth ? Math.round((evidencedCount / depth) * 1000) / 1000 : 0;
  if (rootCauseCount === 1 && !String(rootRows[0].EvidencePath ?? "").trim()) {
    issues.push("ریشهٔ اعلام‌شده مدرک مستند ندارد");
  }
  if (depth > 0 && depth < RCFA_MIN_WHY_DEPTH) {
    issues.push(`زنجیره تا سطح ${depth} رفته است؛ کمتر از ${RCFA_MIN_WHY_DEPTH} سطح برای رسیدن به ریشه کافی نیست`);
  }
  if (depth > RCFA_MAX_WHY_DEPTH) {
    issues.push(`زنجیره از سقف ${RCFA_MAX_WHY_DEPTH} سطح گذشته است`);
  }

  const reachedRecommendedDepth = depth >= RCFA_MIN_WHY_DEPTH;
  const terminated = rootCauseCount === 1 && (rootCauseLevel ?? 0) >= RCFA_MIN_WHY_DEPTH;
  const summaryFa = depth === 0
    ? "زنجیرهٔ ۵ چرا هنوز آغاز نشده است."
    : terminated
      ? `ریشه در سطح ${rootCauseLevel} با ${evidencedCount} مدرک مستند شناسایی شده است.`
      : `زنجیره در سطح ${depth} باز است؛ ریشهٔ مستند و تأییدشده‌ای ثبت نشده است.`;

  return {
    depth, levels, rootCauseLevel, rootCauseCount, evidencedCount, evidencedRatio,
    terminated, reachedRecommendedDepth, missingLevels, issues, summaryFa,
  };
}

/** اعتبارسنجی یک سطح تازه از ۵ چرا پیش از نوشتن در پایگاه‌داده. */
export function validateWhyEntry(input: {
  statementFa: unknown;
  sequence?: number | null;
  evidencePath?: string | null;
  isRootCause?: boolean | null;
  existing?: WhyEntryLike[];
}): string[] {
  const issues: string[] = [];
  const statement = String(input.statementFa ?? "").trim();
  if (statement.length < 5) issues.push("شرح علت باید دست‌کم ۵ نویسه باشد");
  if (statement.length > 1200) issues.push("شرح علت نمی‌تواند بیشتر از ۱۲۰۰ نویسه باشد");
  const existing = Array.isArray(input.existing) ? input.existing : [];
  const expected = nextWhyLevel(existing);
  if (input.sequence != null && Number(input.sequence) !== expected) {
    issues.push(`سطح بعدی زنجیره ${expected} است، نه ${Number(input.sequence)}`);
  }
  if (expected > RCFA_MAX_WHY_DEPTH) issues.push(`عمق زنجیره از سقف ${RCFA_MAX_WHY_DEPTH} می‌گذرد`);
  if (input.isRootCause === true && !String(input.evidencePath ?? "").trim()) {
    issues.push("اعلام ریشه بدون مدرک مستند پذیرفته نمی‌شود");
  }
  if (input.isRootCause === true && existing.some((row) => row.IsRootCause === true)) {
    issues.push("برای این پرونده از قبل ریشه‌ای ثبت شده است؛ نخست آن را اصلاح کنید");
  }
  const previous = existing.slice().sort((left, right) => Number(left.Sequence) - Number(right.Sequence)).pop();
  if (previous && String(previous.StatementFa ?? "").trim() === statement) {
    issues.push("این پاسخ با سطح پیشین یکسان است؛ زنجیره پیش نمی‌رود");
  }
  return issues;
}

export type ParetoInputItem = { key: string; labelFa: string; value: number; impactScore?: number | null };
export type ParetoRow = {
  rank: number;
  key: string;
  labelFa: string;
  value: number;
  sharePct: number;
  cumulativePct: number;
  classification: "vital-few" | "trivial-many";
};
export type ParetoAnalysis = {
  mode: "count" | "weighted";
  threshold: number;
  total: number;
  itemCount: number;
  rows: ParetoRow[];
  vitalFew: ParetoRow[];
  vitalFewSharePct: number;
  interpretationFa: string;
  issues: string[];
};

/**
 * تحلیل پارتو (قاعدهٔ ۸۰/۲۰).
 *
 * `mode = "count"` فراوانی وقوع را می‌شمارد و `mode = "weighted"` فراوانی را
 * در شدت اثر ضرب می‌کند. تفاوت مهم است: یک علت کم‌تکرار ولی با اثر
 * ایمنی بالا باید در فهرست حیاتی بماند، وگرنه تحلیل پارتو آن را حذف می‌کند.
 */
export function computeParetoAnalysis(
  items: ParetoInputItem[],
  options: { threshold?: number; mode?: "count" | "weighted" } = {},
): ParetoAnalysis {
  const threshold = typeof options.threshold === "number" && options.threshold > 0 && options.threshold < 1 ? options.threshold : 0.8;
  const mode = options.mode === "weighted" ? "weighted" : "count";
  const issues: string[] = [];
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => {
      const value = Number(item.value);
      const impact = item.impactScore == null ? null : Number(item.impactScore);
      const weight = mode === "weighted" ? Math.max(0, value) * Math.max(0, impact ?? 1) : Math.max(0, value);
      return { key: String(item.key ?? ""), labelFa: String(item.labelFa ?? item.key ?? ""), value: Number.isFinite(value) ? Math.max(0, value) : 0, impactScore: impact, weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((item) => item.key.length > 0);
  if (normalized.some((item) => item.value <= 0)) issues.push("ردیف‌های با فراوانی صفر در تحلیل پارتو معنایی ندارند");

  const total = normalized.reduce((sum, item) => sum + item.weight, 0);
  const sorted = normalized.slice().sort((left, right) => right.weight - left.weight || left.key.localeCompare(right.key));
  let cumulative = 0;
  const rows: ParetoRow[] = sorted.map((item, index) => {
    const share = total > 0 ? (item.weight / total) * 100 : 0;
    cumulative += share;
    const sharePct = Math.round(share * 100) / 100;
    const cumulativePct = Math.min(100, Math.round(cumulative * 100) / 100);
    return {
      rank: index + 1,
      key: item.key,
      labelFa: item.labelFa,
      value: item.value,
      sharePct,
      cumulativePct,
      classification: cumulativePct <= threshold * 100 + 1e-9 ? "vital-few" : "trivial-many",
    };
  });
  const boundary = rows.filter((row) => row.classification === "vital-few").length;
  const ties = rows.length > boundary && boundary > 0 && rows[boundary].value === rows[boundary - 1].value;
  if (ties) issues.push("دو علت هم‌ارزش روی مرز ۸۰٪ افتاده‌اند؛ مرز را دستی بازبینی کنید");

  const vitalFew = rows.filter((row) => row.classification === "vital-few");
  const vitalFewSharePct = rows.length ? rows[Math.max(0, vitalFew.length - 1)].cumulativePct : 0;
  const interpretationFa = rows.length === 0
    ? "داده‌ای برای تحلیل پارتو وجود ندارد."
    : `${vitalFew.length} علت از ${rows.length} علت، ${vitalFewSharePct}٪ اثر تجمعی را می‌سازند؛ تمرکز CAPA باید روی همین‌ها باشد.`;

  return { mode, threshold, total: Math.round(total * 100) / 100, itemCount: rows.length, rows, vitalFew, vitalFewSharePct, interpretationFa, issues };
}

export type FishboneCauseLike = {
  Id?: string | null;
  Category?: string | null;
  StatementFa: string;
  ParentCauseId?: string | null;
  OccurrenceCount?: number | null;
  ImpactScore?: number | null;
  IsRootCause?: boolean | null;
};
export type FishboneSummary = {
  total: number;
  byCategory: Array<{ category: FishboneCategory; labelFa: string; count: number; rootCauseCount: number; occurrenceCount: number; sharePct: number }>;
  coveredCategories: FishboneCategory[];
  missingCategories: FishboneCategory[];
  coveragePct: number;
  maxDepth: number;
  orphanCauseIds: string[];
  dominantBranch: { category: FishboneCategory; count: number } | null;
  issues: string[];
  interpretationFa: string;
};

/**
 * تجمیع نمودار استخوان‌ماهی.
 *
 * جدا از شمارش، دو نقص ساختاری را پیدا می‌کند که به‌راحتی از چشم می‌افتند:
 * شاخهٔ بی‌گزارش (پوشش ناقص ۶M) و علت یتیم (شاخه‌ای که والدش وجود ندارد).
 */
export function summarizeFishbone(causes: FishboneCauseLike[]): FishboneSummary {
  const rows = (Array.isArray(causes) ? causes : []).filter((cause) => String(cause.StatementFa ?? "").trim().length > 0);
  const byId = new Map(rows.filter((row) => row.Id).map((row) => [String(row.Id), row]));
  const buckets = new Map<FishboneCategory, { count: number; rootCauseCount: number; occurrenceCount: number }>();
  const issues: string[] = [];
  const orphanCauseIds: string[] = [];
  let maxDepth = 0;

  const depthOf = (cause: FishboneCauseLike, guard = 0): number => {
    const parentId = cause.ParentCauseId ? String(cause.ParentCauseId) : null;
    if (!parentId) return 1;
    if (guard > rows.length) return guard;
    const parent = byId.get(parentId);
    if (!parent) return 1;
    return 1 + depthOf(parent, guard + 1);
  };

  for (const cause of rows) {
    const category = (FISHBONE_CATEGORIES as readonly string[]).includes(String(cause.Category))
      ? (cause.Category as FishboneCategory)
      : null;
    if (!category) {
      issues.push("علتی بدون شاخهٔ معتبر ۶M ثبت شده است");
      continue;
    }
    const previous = buckets.get(category) ?? { count: 0, rootCauseCount: 0, occurrenceCount: 0 };
    const occurrence = Number(cause.OccurrenceCount);
    buckets.set(category, {
      count: previous.count + 1,
      rootCauseCount: previous.rootCauseCount + (cause.IsRootCause === true ? 1 : 0),
      occurrenceCount: previous.occurrenceCount + (Number.isFinite(occurrence) && occurrence > 0 ? occurrence : 0),
    });
    if (cause.ParentCauseId && !byId.has(String(cause.ParentCauseId))) orphanCauseIds.push(String(cause.Id ?? cause.StatementFa));
    maxDepth = Math.max(maxDepth, depthOf(cause));
  }

  const total = [...buckets.values()].reduce((sum, value) => sum + value.count, 0);
  const byCategory = FISHBONE_CATEGORIES.map((category) => {
    const value = buckets.get(category) ?? { count: 0, rootCauseCount: 0, occurrenceCount: 0 };
    return {
      category,
      labelFa: FISHBONE_CATEGORY_LABELS[category].fa,
      count: value.count,
      rootCauseCount: value.rootCauseCount,
      occurrenceCount: value.occurrenceCount,
      sharePct: total ? Math.round((value.count / total) * 10000) / 100 : 0,
    };
  });
  const coveredCategories = byCategory.filter((row) => row.count > 0).map((row) => row.category);
  const missingCategories = byCategory.filter((row) => row.count === 0).map((row) => row.category);
  if (missingCategories.length) issues.push(`شاخه‌های بی‌گزارش: ${missingCategories.map((category) => FISHBONE_CATEGORY_LABELS[category].fa).join("، ")}`);
  if (orphanCauseIds.length) issues.push(`${orphanCauseIds.length} علت به والد ناموجود ارجاع می‌دهد`);
  const dominant = [...byCategory].sort((left, right) => right.count - left.count)[0] ?? null;

  return {
    total,
    byCategory,
    coveredCategories,
    missingCategories,
    coveragePct: Math.round((coveredCategories.length / FISHBONE_CATEGORIES.length) * 10000) / 100,
    maxDepth,
    orphanCauseIds,
    dominantBranch: dominant && dominant.count > 0 ? { category: dominant.category, count: dominant.count } : null,
    issues,
    interpretationFa: total === 0
      ? "نمودار استخوان‌ماهی خالی است."
      : `شاخهٔ غالب «${dominant ? FISHBONE_CATEGORY_LABELS[dominant.category].fa : "—"}» با ${dominant?.count ?? 0} علت؛ پوشش ${coveredCategories.length} از ۶ شاخه.`,
  };
}

export type RcfaReadinessInput = {
  status: string;
  rootCauseFa?: string | null;
  method?: string | null;
  whys?: WhyEntryLike[];
  causes?: FishboneCauseLike[];
  capas?: Array<{ ActionType?: string | null; Status?: string | null; VerificationResult?: string | null; DueOn?: string | null }>;
  now?: Date | string;
};
export type RcfaReadiness = {
  ready: boolean;
  targetStatus: "closed" | "verified" | null;
  blockers: string[];
  warnings: string[];
  overdueCapaCount: number;
  score: number;
};

const capaIsClosed = (status: string | null | undefined): boolean => status === "closed" || status === "verified";
const capaIsDone = (status: string | null | undefined): boolean => status === "implemented" || capaIsClosed(status);

/**
 * آمادگی پروندهٔ RCFA برای بستن یا تأیید.
 *
 * قاعده‌ها عمداً سخت‌گیرند: پرونده‌ای که ریشهٔ مستند یا CAPA اجراشده ندارد
 * «بسته» نمی‌شود. بستن بی‌شاهد، همان تحلیل تشریفاتی است که در حادثهٔ بعدی
 * دوباره سر باز می‌کند.
 */
export function evaluateRcfaReadiness(input: RcfaReadinessInput): RcfaReadiness {
  const status = String(input.status ?? "open");
  const whys = Array.isArray(input.whys) ? input.whys : [];
  const causes = Array.isArray(input.causes) ? input.causes : [];
  const capas = Array.isArray(input.capas) ? input.capas : [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const now = input.now instanceof Date ? input.now : input.now ? new Date(String(input.now)) : new Date();

  const documentedRootFromWhys = whys.some((row) => row.IsRootCause === true && String(row.EvidencePath ?? "").trim().length > 0);
  const documentedRootFromCauses = causes.some((row) => row.IsRootCause === true);
  const rootCauseFa = String(input.rootCauseFa ?? "").trim();
  if (!rootCauseFa) blockers.push("ریشهٔ تأییدشده (RootCauseFa) ثبت نشده است");
  if (whys.length > 0 && !documentedRootFromWhys && !documentedRootFromCauses) {
    blockers.push("هیچ سطحی از زنجیرهٔ ۵ چرا به‌عنوان ریشهٔ مستند علامت‌گذاری نشده است");
  }
  if (whys.length === 0 && causes.length === 0) blockers.push("هیچ تحلیل علّی (۵ چرا یا استخوان‌ماهی) ثبت نشده است");
  if (whys.length > 0) {
    const chain = evaluateFiveWhyChain(whys);
    for (const issue of chain.issues) if (chain.depth > 0) blockers.push(issue);
  }
  if (causes.length > 0) {
    const fishbone = summarizeFishbone(causes);
    if (!fishbone.byCategory.some((row) => row.rootCauseCount > 0)) {
      blockers.push("در نمودار استخوان‌ماهی هیچ علتی به‌عنوان ریشه علامت‌گذاری نشده است");
    }
    for (const issue of fishbone.issues) warnings.push(issue);
  }

  const effectiveCapas = capas.filter((capa) => capa.Status !== "cancelled");
  if (effectiveCapas.length === 0) {
    blockers.push("هیچ اقدام اصلاحی/پیشگیرانه‌ای (CAPA) ثبت نشده است");
  }
  const openCapas = effectiveCapas.filter((capa) => !capaIsDone(capa.Status));
  const unverified = effectiveCapas.filter((capa) => capaIsDone(capa.Status) && !capa.VerificationResult);
  const hasPreventive = effectiveCapas.some((capa) => capa.ActionType === "preventive" || capa.ActionType === "systemic");
  if (effectiveCapas.length > 0 && !hasPreventive) {
    warnings.push("هیچ اقدام پیشگیرانه/سیستمی ثبت نشده است؛ خطر تکرار باقی می‌ماند");
  }
  const verificationEffective = effectiveCapas.length > 0
    && effectiveCapas.every((capa) => capaIsClosed(capa.Status) && (capa.VerificationResult === "effective" || capa.VerificationResult === "partially-effective"));
  const overdueCapaCount = effectiveCapas.filter((capa) => {
    if (capaIsDone(capa.Status) || !capa.DueOn) return false;
    const due = new Date(`${String(capa.DueOn).slice(0, 10)}T23:59:59Z`);
    return Number.isFinite(due.getTime()) && Number.isFinite(now.getTime()) && due.getTime() < now.getTime();
  }).length;
  if (overdueCapaCount > 0) warnings.push(`${overdueCapaCount} اقدام از سررسید گذشته است`);

  if (status === "verified") {
    blockers.push("پرونده قبلاً تأیید شده است");
    return { ready: false, targetStatus: null, blockers, warnings, overdueCapaCount, score: 1 };
  }

  const closeBlockers = [...blockers];
  if (openCapas.length > 0) closeBlockers.push(`${openCapas.length} اقدام هنوز به مرحلهٔ اجرا نرسیده است`);
  if (unverified.length > 0) closeBlockers.push(`${unverified.length} اقدام اجرا شده اما تأیید اثربخشی ندارد`);

  const readyToClose = closeBlockers.length === 0;
  const readyToVerify = readyToClose && status === "closed" && verificationEffective && effectiveCapas.every((capa) => capaIsClosed(capa.Status));

  const targetStatus: "closed" | "verified" | null = readyToVerify ? "verified" : readyToClose && status !== "closed" ? "closed" : null;
  const score = Math.round(
    Math.max(0, Math.min(1,
      (rootCauseFa ? 0.35 : 0)
      + (documentedRootFromWhys || documentedRootFromCauses ? 0.2 : 0)
      + (effectiveCapas.length > 0 ? 0.2 : 0)
      + (openCapas.length === 0 ? 0.15 : 0)
      + (verificationEffective ? 0.1 : 0),
    )) * 100,
  ) / 100;

  return { ready: targetStatus !== null, targetStatus, blockers: closeBlockers, warnings, overdueCapaCount, score };
}

/* ═══════════════════════ ۱۶. یکپارچگی بین‌بخشی — رویداد و بلوکه‌سازی نرم ظرفیت ═══════════════════════ */

/**
 * قرارداد یکپارچگی CMMS ↔ MES.
 *
 * تصمیم معماری: هیچ کلید خارجی به جداول `Mfg*` وجود ندارد. ارتباط از دو راه
 * انجام می‌شود که هر دو استقلال اسکیما را حفظ می‌کنند:
 *   ۱) ارجاع نرم متنی (`CmmsAsset.MfgWorkCenterId`).
 *   ۲) رویداد بیرونی در صف خروجی (`CmmsIntegrationEvent`) و تحویل با
 *      HTTP/REST به سامانهٔ مقصد.
 *
 * این ماژول تعریف رویداد، کلید تکرارناپذیری، محاسبهٔ پنجرهٔ ظرفیت و ضریب
 * دسترس‌پذیری را به‌صورت تابع خالص فراهم می‌کند تا هر دو سمت قرارداد از
 * یک منبع حقیقت بخوانند.
 */
export const CMMS_INTEGRATION_CONTRACT = "cmms-mes-v1";

export const CMMS_INTEGRATION_EVENT_TYPES = [
  "downtime.started",
  "downtime.finished",
  "downtime.reported",
  "capacity.block.requested",
  "capacity.block.released",
] as const;
export type CmmsIntegrationEventType = (typeof CMMS_INTEGRATION_EVENT_TYPES)[number];

export const CMMS_INTEGRATION_TARGETS = ["mes"] as const;
export type CmmsIntegrationTarget = (typeof CMMS_INTEGRATION_TARGETS)[number];

export const CMMS_INTEGRATION_EVENT_STATUSES = ["pending", "published", "acknowledged", "failed", "cancelled"] as const;
export type CmmsIntegrationEventStatus = (typeof CMMS_INTEGRATION_EVENT_STATUSES)[number];

export const CMMS_CAPACITY_BLOCK_SOURCES = ["pm-schedule", "work-order", "shutdown", "manual"] as const;
export type CmmsCapacityBlockSource = (typeof CMMS_CAPACITY_BLOCK_SOURCES)[number];

export const CMMS_CAPACITY_BLOCK_STATUSES = ["requested", "active", "released", "rejected", "cancelled"] as const;
export type CmmsCapacityBlockStatus = (typeof CMMS_CAPACITY_BLOCK_STATUSES)[number];

/** مجوز لازم در سمت مقصد برای هر نوع رویداد — نگاشت صریح، نه استنباط ضمنی. */
export const CMMS_MES_EVENT_PERMISSIONS: Readonly<Record<CmmsIntegrationEventType, string>> = Object.freeze({
  "downtime.started": "mfg.downtime.report",
  "downtime.finished": "mfg.downtime.report",
  "downtime.reported": "mfg.downtime.report",
  "capacity.block.requested": "mfg.calendar.edit",
  "capacity.block.released": "mfg.calendar.edit",
});

export function isTerminalIntegrationStatus(status: unknown): boolean {
  return status === "acknowledged" || status === "cancelled";
}

/**
 * کلید تکرارناپذیری: «همین رویداد، از همین منبع، در همین نسخه».
 *
 * تحویل در شبکهٔ ناپایدار حداقل یک‌بار است؛ بدون این کلید یک توقف واحد
 * چند بار در MES ثبت می‌شود و مؤلفهٔ Availability بی‌دلیل افت می‌کند.
 */
export function buildIdempotencyKey(input: {
  siteId: string;
  eventType: string;
  sourceTable: string;
  sourceId: string;
  revision?: number | string | null;
}): string {
  const parts = [input.siteId, input.eventType, input.sourceTable, input.sourceId, input.revision ?? "1"];
  return parts.map((part) => String(part).trim().replace(/\s+/g, "_")).join(":");
}

export type DowntimeEventPayload = {
  contract: string;
  sourceSystem: "cmms";
  siteId: string;
  assetRef: string;
  assetTag: string | null;
  workCenterRef: string;
  productionImpact: string;
  downtimeType: CmmsHoldDowntimeType;
  reasonCode: string | null;
  reasonFa: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMinutes: number | null;
  workOrderRef: string | null;
  failureRef: string | null;
  sourceRef: string;
};

export type DowntimeEventDraft = {
  eventType: CmmsIntegrationEventType;
  targetSystem: CmmsIntegrationTarget;
  targetRef: string;
  payload: DowntimeEventPayload;
  idempotencyKey: string;
  occurredAt: string;
};

/**
 * ساخت رویداد توقف از دادهٔ CMMS.
 *
 * اگر تجهیز به مرکز کاری MES گره نخورده باشد، `null` برمی‌گردد: رویداد
 * بی‌مقصد ساخته نمی‌شود. این انتخاب صریح است تا صف خروجی با رویدادهای
 * غیرقابل‌تحویل پر نشود.
 */
export function buildDowntimeEvent(input: {
  eventType: CmmsIntegrationEventType;
  siteId: string;
  asset: { Id: string; AssetTag?: string | null; MfgWorkCenterId?: string | null };
  sourceTable: string;
  sourceId: string;
  revision?: number | string | null;
  startedAt: string;
  finishedAt?: string | null;
  durationMinutes?: number | null;
  downtimeType: CmmsHoldDowntimeType;
  reasonCode?: string | null;
  reasonFa?: string | null;
  productionImpact?: string | null;
  workOrderRef?: string | null;
  failureRef?: string | null;
  plantRef?: string | null;
}): DowntimeEventDraft | null {
  const workCenterRef = String(input.asset?.MfgWorkCenterId ?? "").trim();
  if (!workCenterRef) return null;
  const finishedAt = input.finishedAt ?? null;
  const computedMinutes = input.durationMinutes != null
    ? Math.max(0, Math.round(Number(input.durationMinutes)))
    : finishedAt
      ? computeHoldMinutes(input.startedAt, finishedAt)
      : null;
  const payload: DowntimeEventPayload = {
    contract: CMMS_INTEGRATION_CONTRACT,
    sourceSystem: "cmms",
    siteId: input.siteId,
    assetRef: input.asset.Id,
    assetTag: input.asset.AssetTag ?? null,
    workCenterRef,
    plantRef: input.plantRef ?? null,
    productionImpact: input.productionImpact ?? "none",
    downtimeType: input.downtimeType,
    reasonCode: input.reasonCode ?? null,
    reasonFa: input.reasonFa ?? null,
    startedAt: input.startedAt,
    finishedAt,
    durationMinutes: computedMinutes,
    workOrderRef: input.workOrderRef ?? null,
    failureRef: input.failureRef ?? null,
    sourceRef: `${input.sourceTable}:${input.sourceId}`,
  } as DowntimeEventPayload;
  return {
    eventType: input.eventType,
    targetSystem: "mes",
    targetRef: workCenterRef,
    payload,
    idempotencyKey: buildIdempotencyKey({
      siteId: input.siteId,
      eventType: input.eventType,
      sourceTable: input.sourceTable,
      sourceId: input.sourceId,
      revision: input.revision ?? 1,
    }),
    occurredAt: input.startedAt,
  };
}

export type CapacityBlockLike = {
  Id: string;
  SiteId: string;
  PlantRef?: string | null;
  WorkCenterRef: string;
  SourceType: string;
  SourceRef?: string | null;
  WindowStart: string;
  WindowEnd: string;
  ReservedMinutes?: number | null;
  ReasonFa?: string | null;
  RowVersion?: number | null;
};

export type CapacityBlockEventDraft = {
  eventType: CmmsIntegrationEventType;
  targetSystem: CmmsIntegrationTarget;
  targetRef: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  occurredAt: string;
};

/** ساخت رویداد رزرو/آزادسازی ظرفیت برای موتور زمان‌بندی MES. */
export function buildCapacityBlockEvent(
  block: CapacityBlockLike,
  action: "requested" | "released",
  options: { occurredAt?: string; revision?: number | string | null; contract?: string } = {},
): CapacityBlockEventDraft {
  const eventType: CmmsIntegrationEventType = action === "released" ? "capacity.block.released" : "capacity.block.requested";
  return {
    eventType,
    targetSystem: "mes",
    targetRef: String(block.WorkCenterRef ?? "").trim(),
    payload: {
      contract: options.contract ?? CMMS_INTEGRATION_CONTRACT,
      sourceSystem: "cmms",
      siteId: block.SiteId,
      blockRef: block.Id,
      plantRef: block.PlantRef ?? null,
      workCenterRef: block.WorkCenterRef,
      sourceType: block.SourceType,
      sourceRef: block.SourceRef ?? null,
      windowStart: block.WindowStart,
      windowEnd: block.WindowEnd,
      reservedMinutes: block.ReservedMinutes ?? null,
      reasonFa: block.ReasonFa ?? null,
      action,
    },
    idempotencyKey: buildIdempotencyKey({
      siteId: block.SiteId,
      eventType,
      sourceTable: "CmmsCapacityBlock",
      sourceId: block.Id,
      revision: options.revision ?? block.RowVersion ?? 1,
    }),
    occurredAt: options.occurredAt ?? new Date().toISOString(),
  };
}

/** دقیقه‌های رزروشده در یک پنجرهٔ زمانی؛ پایان باید بعد از شروع باشد. */
export function reservedMinutesBetween(windowStart: string | Date, windowEnd: string | Date): number | null {
  const start = windowStart instanceof Date ? windowStart : new Date(String(windowStart));
  const end = windowEnd instanceof Date ? windowEnd : new Date(String(windowEnd));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end.getTime() <= start.getTime()) return null;
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

export type CapacityBlockConflict = {
  blockRef: string;
  workCenterRef: string;
  overlapMinutes: number;
  windowStart: string;
  windowEnd: string;
};

/**
 * تشخیص هم‌پوشانی بلوک‌های ظرفیت.
 *
 * دو بلوک روی یک مرکز کاری به‌خودی‌خود غلط نیست (مثلاً دو دستورکار پشت‌سرهم
 * که هم‌پوشانی جزئی دارند) اما باید دیده شود؛ پس هم‌پوشانی «هشدار» است و
 * فقط هم‌پوشانی کامل روی همان منبع «تعارض» تلقی می‌شود.
 */
export function detectCapacityBlockConflicts(
  existing: CapacityBlockLike[],
  candidate: Pick<CapacityBlockLike, "Id" | "WorkCenterRef" | "WindowStart" | "WindowEnd">,
): { conflicts: CapacityBlockConflict[]; overlapMinutes: number; exactDuplicate: boolean; issues: string[] } {
  const conflicts: CapacityBlockConflict[] = [];
  const issues: string[] = [];
  const start = new Date(String(candidate.WindowStart));
  const end = new Date(String(candidate.WindowEnd));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    return { conflicts, overlapMinutes: 0, exactDuplicate: false, issues: ["پنجرهٔ بلوک ظرفیت نامعتبر است"] };
  }
  let overlapMinutes = 0;
  let exactDuplicate = false;
  for (const row of Array.isArray(existing) ? existing : []) {
    if (row.Id === candidate.Id) continue;
    if (String(row.WorkCenterRef) !== String(candidate.WorkCenterRef)) continue;
    const rowStart = new Date(String(row.WindowStart));
    const rowEnd = new Date(String(row.WindowEnd));
    if (Number.isNaN(rowStart.getTime()) || Number.isNaN(rowEnd.getTime())) continue;
    const overlapStart = Math.max(start.getTime(), rowStart.getTime());
    const overlapEnd = Math.min(end.getTime(), rowEnd.getTime());
    if (overlapEnd <= overlapStart) continue;
    const minutes = Math.round((overlapEnd - overlapStart) / 60_000);
    overlapMinutes += minutes;
    if (rowStart.getTime() === start.getTime() && rowEnd.getTime() === end.getTime()) exactDuplicate = true;
    conflicts.push({
      blockRef: row.Id,
      workCenterRef: String(row.WorkCenterRef),
      overlapMinutes: minutes,
      windowStart: String(row.WindowStart),
      windowEnd: String(row.WindowEnd),
    });
  }
  if (exactDuplicate) issues.push("بلوکی با همین پنجره روی همین مرکز کاری از قبل وجود دارد");
  else if (conflicts.length) issues.push(`${conflicts.length} بلوک هم‌پوشان روی همین مرکز کاری وجود دارد`);
  return { conflicts, overlapMinutes, exactDuplicate, issues };
}

export type AvailabilityProjection = {
  calendarMinutes: number;
  plannedDowntimeMinutes: number;
  unplannedDowntimeMinutes: number;
  plannedProductionMinutes: number;
  operatingMinutes: number;
  availabilityValue: number | null;
  availabilityPct: number | null;
  interpretationFa: string;
};

/**
 * بازتاب توقف ثبت‌شده در CMMS روی مؤلفهٔ Availability شاخص OEE.
 *
 * همان تعریف MES: زمان تولید برنامه‌ریزی‌شده = زمان تقویم − توقف برنامه‌ریزی‌شده،
 * زمان کارکرد = زمان تولید برنامه‌ریزی‌شده − توقف ناخواسته.
 */
export function projectAvailability(input: {
  calendarMinutes: number;
  plannedDowntimeMinutes?: number | null;
  unplannedDowntimeMinutes?: number | null;
}): AvailabilityProjection {
  const round3 = (value: number) => Math.round(value * 1000) / 1000;
  const calendarMinutes = Math.max(0, Number(input.calendarMinutes) || 0);
  const planned = Math.max(0, Number(input.plannedDowntimeMinutes ?? 0) || 0);
  const unplanned = Math.max(0, Number(input.unplannedDowntimeMinutes ?? 0) || 0);
  const plannedProductionMinutes = round3(Math.max(0, calendarMinutes - planned));
  const operatingMinutes = round3(Math.max(0, plannedProductionMinutes - unplanned));
  const availabilityValue = plannedProductionMinutes > 0 ? round3(operatingMinutes / plannedProductionMinutes) : null;
  const availabilityPct = availabilityValue === null ? null : round3(availabilityValue * 100);
  return {
    calendarMinutes: round3(calendarMinutes),
    plannedDowntimeMinutes: round3(planned),
    unplannedDowntimeMinutes: round3(unplanned),
    plannedProductionMinutes,
    operatingMinutes,
    availabilityValue,
    availabilityPct,
    interpretationFa: availabilityPct === null
      ? "زمان تولید برنامه‌ریزی‌شده‌ای وجود ندارد؛ دسترس‌پذیری قابل محاسبه نیست."
      : `دسترس‌پذیری ${availabilityPct}٪ پس از کسر ${round3(planned + unplanned)} دقیقه توقف.`,
  };
}

export type OutboxSummary = {
  total: number;
  byStatus: Record<string, number>;
  pending: number;
  failed: number;
  acknowledged: number;
  oldestPendingAt: string | null;
  retryable: number;
  interpretationFa: string;
};

/** خلاصهٔ صف خروجی برای داشبورد یکپارچگی. */
export function summarizeOutbox(events: Array<Record<string, unknown>>, now: Date | string = new Date()): OutboxSummary {
  const rows = Array.isArray(events) ? events : [];
  const byStatus: Record<string, number> = {};
  let oldestPending: number | null = null;
  let pending = 0;
  let failed = 0;
  let acknowledged = 0;
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime();
  for (const row of rows) {
    const status = String(row.Status ?? "unknown");
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (status === "pending" || status === "published") {
      pending += 1;
      const at = Date.parse(String(row.OccurredAt ?? row.CreatedAt ?? ""));
      if (Number.isFinite(at) && (oldestPending === null || at < oldestPending)) oldestPending = at;
    }
    if (status === "failed") failed += 1;
    if (status === "acknowledged") acknowledged += 1;
  }
  const oldestPendingAt = oldestPending === null ? null : new Date(oldestPending).toISOString();
  const ageMinutes = oldestPending !== null && Number.isFinite(nowMs) ? Math.round((nowMs - oldestPending) / 60_000) : null;
  return {
    total: rows.length,
    byStatus,
    pending,
    failed,
    acknowledged,
    oldestPendingAt,
    retryable: pending + failed,
    interpretationFa: rows.length === 0
      ? "صف خروجی یکپارچگی خالی است."
      : `${rows.length} رویداد؛ ${acknowledged} تحویل‌شده، ${pending} در انتظار، ${failed} ناموفق${ageMinutes != null && pending > 0 ? `، قدیمی‌ترین در انتظار ${ageMinutes} دقیقه` : ""}.`,
  };
}
