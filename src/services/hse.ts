/**
 * ماژول بهداشت، ایمنی و محیط زیست (HSE) — دامنهٔ d16.
 *
 * این ماژول دو مسئولیت دارد که نباید با هم اشتباه شوند:
 *   ۱. صدور و پایش پروانهٔ کار — که پیش‌نیاز سخت دروازهٔ RFSU در ماژول
 *      راه‌اندازی است. پیش از این ماژول، آن پیش‌نیاز فقط یک رشتهٔ آزاد بود.
 *   ۲. ثبت رویداد ایمنی و محاسبهٔ شاخص‌های استاندارد (LTIFR/TRIR).
 *
 * قاعدهٔ حاکم بر کل ماژول: تابع ارزیابی هرگز استثنا پرتاب نمی‌کند و همهٔ
 * موانع را یک‌جا برمی‌گرداند. کشف مانع‌ها یکی‌یکی، تیم اجرا را در رفت‌وبرگشت
 * می‌اندازد و همان چیزی است که باعث می‌شود کنترل ایمنی دور زده شود.
 */

/* ══════════════ ثابت‌ها ══════════════ */

export const PERMIT_TYPES = ["hot", "cold", "confined", "height", "electrical", "excavation", "lifting"] as const;
export type PermitType = (typeof PERMIT_TYPES)[number];

export const PERMIT_TYPE_FA: Record<string, string> = {
  hot: "کار گرم",
  cold: "کار سرد",
  confined: "فضای بسته",
  height: "کار در ارتفاع",
  electrical: "کار برقی",
  excavation: "گودبرداری",
  lifting: "عملیات بالابری",
};

/** پروانه‌هایی که ذاتاً پرخطرند و بدون تأییدیهٔ SIMOPS صادر نمی‌شوند. */
export const HIGH_RISK_PERMITS: PermitType[] = ["hot", "confined", "excavation"];

export const PERMIT_STATUSES = ["draft", "active", "suspended", "closed", "expired", "rejected"] as const;
export type PermitStatus = (typeof PERMIT_STATUSES)[number];

export const PERMIT_STATUS_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  active: "معتبر",
  suspended: "معلق",
  closed: "بسته",
  expired: "منقضی",
  rejected: "رد شده",
};

export const INCIDENT_TYPES = [
  "near_miss", "first_aid", "medical_treatment", "lost_time", "fatality",
  "environmental", "property_damage",
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_TYPE_FA: Record<string, string> = {
  near_miss: "شبه‌حادثه",
  first_aid: "کمک‌های اولیه",
  medical_treatment: "درمان پزشکی",
  lost_time: "حادثهٔ منجر به از کارافتادگی",
  fatality: "حادثهٔ منجر به فوت",
  environmental: "رویداد زیست‌محیطی",
  property_damage: "خسارت به اموال",
};

/**
 * رویدادهایی که در شاخص TRIR (نرخ کل حوادث ثبت‌شدنی) شمرده می‌شوند.
 * شبه‌حادثه و کمک‌های اولیه طبق OSHA ثبت‌شدنی نیستند — اگر شمرده شوند،
 * تیم برای پایین نگه داشتن شاخص از گزارش شبه‌حادثه خودداری می‌کند و
 * سامانه دقیقاً همان داده‌ای را از دست می‌دهد که برای پیشگیری لازم است.
 */
export const RECORDABLE_TYPES: IncidentType[] = ["medical_treatment", "lost_time", "fatality"];

/** رویدادهایی که در LTIFR (نرخ حوادث منجر به از کارافتادگی) می‌آیند. */
export const LOST_TIME_TYPES: IncidentType[] = ["lost_time", "fatality"];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_FA: Record<string, string> = {
  low: "کم",
  medium: "متوسط",
  high: "بالا",
  critical: "بحرانی",
};

export const INSPECTION_TYPES = ["walkthrough", "toolbox", "audit", "drill", "equipment"] as const;
export const INSPECTION_TYPE_FA: Record<string, string> = {
  walkthrough: "بازدید میدانی",
  toolbox: "جلسهٔ ایمنی روزانه",
  audit: "ممیزی",
  drill: "مانور",
  equipment: "بازرسی تجهیزات",
};

/* ══════════════ انواع داده ══════════════ */

export type PermitRow = {
  Id: string;
  ProjectId: string;
  PermitNo: string;
  PermitType: string;
  TitleFa: string;
  SystemId?: string | null;
  ActivityId?: string | null;
  LocationFa?: string | null;
  RequestedBy: string;
  ValidFrom: string;
  ValidTo: string;
  ApprovedBy?: string | null;
  ApprovedAt?: string | null;
  ClosedBy?: string | null;
  ClosedAt?: string | null;
  SimopsRequired?: boolean | null;
  SimopsApprovedBy?: string | null;
  GasTestResultFa?: string | null;
  NoteFa?: string | null;
  Status: string;
};

export type IncidentRow = {
  Id: string;
  ProjectId: string;
  IncidentNo: string;
  TitleFa: string;
  IncidentType: string;
  OccurredAt: string;
  LocationFa?: string | null;
  SystemId?: string | null;
  ActivityId?: string | null;
  ReportedBy: string;
  InjuredPersonFa?: string | null;
  LostDays?: number | null;
  RootCauseFa?: string | null;
  CorrectiveActionFa?: string | null;
  NcrRef?: string | null;
  ClosedAt?: string | null;
  ClosedBy?: string | null;
  Severity: string;
  Status: string;
};

export type InspectionRow = {
  Id: string;
  ProjectId: string;
  InspectionNo: string;
  TitleFa: string;
  InspectionType: string;
  InspectedAt: string;
  InspectedBy: string;
  AreaFa?: string | null;
  FindingsCount?: number | null;
  ClosedFindings?: number | null;
  ScorePct?: number | null;
  Status: string;
};

export type TrainingRow = {
  Id: string;
  ProjectId: string;
  PersonRef: string;
  CourseCode: string;
  CourseTitleFa: string;
  CompletedAt: string;
  ExpiresAt?: string | null;
  ScorePct?: number | null;
  CertificateNo?: string | null;
  Status: string;
};

export type ValidationIssue = { code: string; message: string };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* مقدار پسماند سه رقم اعشار می‌خواهد: ۰٫۲۵ تن با ۰٫۳ تن فرق دارد. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/* ══════════════ اعتبارسنجی پروانهٔ کار ══════════════ */

export function validatePermitInput(input: Partial<PermitRow>): ValidationIssue[] {
  const out: ValidationIssue[] = [];

  if (!String(input.PermitNo ?? "").trim()) {
    out.push({ code: "E-HSE-PERMIT-NO-REQUIRED", message: "شمارهٔ پروانه الزامی است" });
  }
  if (!String(input.TitleFa ?? "").trim()) {
    out.push({ code: "E-HSE-TITLE-REQUIRED", message: "عنوان کار الزامی است" });
  }
  if (!PERMIT_TYPES.includes(input.PermitType as PermitType)) {
    out.push({ code: "E-HSE-PERMIT-TYPE", message: "نوع پروانه نامعتبر است" });
  }
  if (!String(input.RequestedBy ?? "").trim()) {
    out.push({ code: "E-HSE-REQUESTER-REQUIRED", message: "درخواست‌کننده الزامی است" });
  }

  const from = String(input.ValidFrom ?? "").trim();
  const to = String(input.ValidTo ?? "").trim();
  if (!from || !to) {
    out.push({ code: "E-HSE-VALIDITY-REQUIRED", message: "بازهٔ اعتبار پروانه الزامی است" });
  } else if (new Date(to).getTime() <= new Date(from).getTime()) {
    out.push({ code: "E-HSE-VALIDITY-RANGE", message: "پایان اعتبار باید پس از شروع باشد" });
  }

  return out;
}

/**
 * آیا پروانه قابل تأیید است؟
 *
 * تصمیم عمدی: پروانهٔ پرخطر بدون تأییدیهٔ SIMOPS تأیید نمی‌شود. کار گرم
 * هم‌زمان با عملیات دیگر، شایع‌ترین سناریوی حادثهٔ صنعتی است.
 */
export function canApprovePermit(permit: PermitRow, approverId?: string): {
  ok: boolean;
  blockersFa: string[];
} {
  const blockersFa: string[] = [];

  if (permit.Status === "closed" || permit.Status === "expired") {
    blockersFa.push(`پروانهٔ ${PERMIT_STATUS_FA[permit.Status] ?? permit.Status} قابل تأیید نیست`);
  }
  if (permit.Status === "active") {
    blockersFa.push("این پروانه قبلاً تأیید شده است");
  }

  const needsSimops = permit.SimopsRequired === true
    || HIGH_RISK_PERMITS.includes(permit.PermitType as PermitType);
  if (needsSimops && !String(permit.SimopsApprovedBy ?? "").trim()) {
    blockersFa.push(`${PERMIT_TYPE_FA[permit.PermitType] ?? permit.PermitType} بدون تأییدیهٔ عملیات هم‌زمان (SIMOPS) مجاز نیست`);
  }

  /* آزمون گاز برای کار گرم و فضای بسته اجباری است. */
  if ((permit.PermitType === "hot" || permit.PermitType === "confined")
      && !String(permit.GasTestResultFa ?? "").trim()) {
    blockersFa.push("نتیجهٔ آزمون گاز ثبت نشده است");
  }

  /* تأییدکننده نباید همان درخواست‌کننده باشد — تفکیک وظیفه. */
  if (approverId && approverId === permit.RequestedBy) {
    blockersFa.push("تأییدکنندهٔ پروانه نمی‌تواند همان درخواست‌کننده باشد");
  }

  return { ok: blockersFa.length === 0, blockersFa };
}

/**
 * وضعیت واقعی پروانه در لحظهٔ مشخص.
 *
 * انقضا از روی تاریخ محاسبه می‌شود نه از روی ستون وضعیت: اگر فقط به ستون
 * تکیه کنیم، پروانه‌ای که کسی آن را نبسته تا ابد «معتبر» می‌ماند.
 */
export function permitState(permit: PermitRow, now: Date = new Date()): {
  effectiveStatus: PermitStatus;
  statusFa: string;
  isValidNow: boolean;
  expiresInHours: number | null;
} {
  const t = now.getTime();
  const to = new Date(permit.ValidTo).getTime();
  const from = new Date(permit.ValidFrom).getTime();

  /* پروانهٔ معلق هم منقضی می‌شود. پیش از این فقط `active` بررسی
   * می‌شد، پس پروانه‌ای که تعلیق شده و بعد تاریخش گذشته بود تا ابد
   * «معلق» می‌ماند و از شاخص انطباق و هشدار پروانهٔ منقضی فرار
   * می‌کرد — یعنی راه دور زدن دروازه با یک تعلیق ساده باز بود.
   * `draft` و `rejected` عمداً بیرون‌اند: پروانه‌ای که هرگز صادر
   * نشده، منقضی هم نمی‌شود. */
  let effective = permit.Status as PermitStatus;
  if ((permit.Status === "active" || permit.Status === "suspended")
    && Number.isFinite(to) && t > to) {
    effective = "expired";
  }

  const isValidNow = effective === "active"
    && Number.isFinite(from) && Number.isFinite(to)
    && t >= from && t <= to;

  const expiresInHours = Number.isFinite(to) && effective === "active"
    ? round2((to - t) / 3_600_000)
    : null;

  return {
    effectiveStatus: effective,
    statusFa: PERMIT_STATUS_FA[effective] ?? effective,
    isValidNow,
    expiresInHours,
  };
}

/**
 * دروازهٔ ایمنی برای آمادگی راه‌اندازی (RFSU) — این تابع همان چیزی است که
 * شکاف G-05 گزارش کیفی ماژول راه‌اندازی را می‌بندد.
 *
 * قاعده: هیچ پروانهٔ کار بازی روی سیستم نباید مانده باشد و رویداد ایمنی
 * باز با شدت بالا مانع سخت است.
 */
export function rfsuSafetyClearance(args: {
  systemId: string;
  permits: PermitRow[];
  incidents?: IncidentRow[];
  /* تخلفات از D6 اضافه شد. اختیاری است تا فراخوانی‌های قبلی نشکنند،
   * ولی بدون آن سیستمی با دستور توقف کار فعال می‌توانست RFSU بگیرد. */
  violations?: ViolationRow[];
  now?: Date;
}): {
  systemId: string;
  ok: boolean;
  openPermits: number;
  expiredPermits: number;
  openHighSeverityIncidents: number;
  activeStopWorkOrders: number;
  blockersFa: string[];
  warningsFa: string[];
} {
  const now = args.now ?? new Date();
  const permits = (args.permits ?? []).filter((p) => p.SystemId === args.systemId);
  const incidents = (args.incidents ?? []).filter((i) => i.SystemId === args.systemId);

  const blockersFa: string[] = [];
  const warningsFa: string[] = [];

  const states = permits.map((p) => ({ permit: p, state: permitState(p, now) }));
  const open = states.filter((s) => s.state.effectiveStatus === "active" || s.state.effectiveStatus === "suspended");
  const expired = states.filter((s) => s.state.effectiveStatus === "expired");

  if (open.length) {
    blockersFa.push(`${open.length} پروانهٔ کار باز روی این سیستم وجود دارد`);
  }
  /* پروانهٔ منقضی‌نشده‌ی بسته‌نشده نشانهٔ کار رهاشده است — هشدار می‌دهیم
     ولی مانع نمی‌کنیم چون ممکن است صرفاً فراموشی اداری باشد. */
  if (expired.length) {
    warningsFa.push(`${expired.length} پروانهٔ منقضی بسته نشده است`);
  }

  const openHigh = incidents.filter(
    (i) => i.Status !== "closed" && (i.Severity === "high" || i.Severity === "critical"),
  );
  if (openHigh.length) {
    blockersFa.push(`${openHigh.length} رویداد ایمنی باز با شدت بالا وجود دارد`);
  }

  const openLow = incidents.filter(
    (i) => i.Status !== "closed" && i.Severity !== "high" && i.Severity !== "critical",
  );
  if (openLow.length) {
    warningsFa.push(`${openLow.length} رویداد ایمنی باز با شدت پایین‌تر`);
  }

  /* دستور توقف کار فعال روی این سیستم — یا در سطح کل پروژه — مانع
   * قطعی است: نمی‌شود سیستمی را «آمادهٔ راه‌اندازی» اعلام کرد در حالی
   * که کار رویش رسماً متوقف است. */
  const stopWorkOrders = (args.violations ?? []).filter((v) => {
    const st = violationState(v, now);
    if (!st.isBlocking || !st.isEnforceable) return false;
    const scope = v.StopWorkScope;
    if (scope === "project") return true;
    if (scope === "system") return v.SystemId === args.systemId;
    /* توقف در سطح فعالیت یا منطقه فقط وقتی به این سیستم مربوط است که
     * تخلف صریحاً همین سیستم را نام برده باشد. */
    return v.SystemId === args.systemId;
  });
  if (stopWorkOrders.length) {
    blockersFa.push(
      `${stopWorkOrders.length} دستور توقف کار فعال روی این سیستم وجود دارد`,
    );
  }

  /* توقف بی‌اثر مانع نیست ولی باید دیده شود: نشانهٔ دادهٔ ناقص است. */
  const unenforceable = (args.violations ?? []).filter((v) => {
    const st = violationState(v, now);
    return st.isBlocking && !st.isEnforceable && v.SystemId === args.systemId;
  });
  if (unenforceable.length) {
    warningsFa.push(`${unenforceable.length} دستور توقف کار ناقص روی این سیستم ثبت شده است`);
  }

  return {
    systemId: args.systemId,
    ok: blockersFa.length === 0,
    openPermits: open.length,
    expiredPermits: expired.length,
    openHighSeverityIncidents: openHigh.length,
    activeStopWorkOrders: stopWorkOrders.length,
    blockersFa,
    warningsFa,
  };
}

/* ══════════════ رویداد ایمنی ══════════════ */

export function validateIncidentInput(input: Partial<IncidentRow>): ValidationIssue[] {
  const out: ValidationIssue[] = [];

  if (!String(input.IncidentNo ?? "").trim()) {
    out.push({ code: "E-HSE-INCIDENT-NO-REQUIRED", message: "شمارهٔ رویداد الزامی است" });
  }
  if (!String(input.TitleFa ?? "").trim()) {
    out.push({ code: "E-HSE-TITLE-REQUIRED", message: "عنوان رویداد الزامی است" });
  }
  if (!INCIDENT_TYPES.includes(input.IncidentType as IncidentType)) {
    out.push({ code: "E-HSE-INCIDENT-TYPE", message: "نوع رویداد نامعتبر است" });
  }
  if (!String(input.OccurredAt ?? "").trim()) {
    out.push({ code: "E-HSE-OCCURRED-REQUIRED", message: "زمان وقوع الزامی است" });
  }
  if (!String(input.ReportedBy ?? "").trim()) {
    out.push({ code: "E-HSE-REPORTER-REQUIRED", message: "گزارش‌دهنده الزامی است" });
  }
  if (input.Severity !== undefined && !SEVERITIES.includes(input.Severity as Severity)) {
    out.push({ code: "E-HSE-SEVERITY", message: "شدت رویداد نامعتبر است" });
  }

  /* حادثهٔ منجر به از کارافتادگی بدون تعداد روز، شاخص LTIFR را بی‌معنا می‌کند. */
  const t = input.IncidentType as IncidentType;
  if (LOST_TIME_TYPES.includes(t) && t !== "fatality") {
    const d = Number(input.LostDays ?? 0);
    if (!Number.isFinite(d) || d <= 0) {
      out.push({ code: "E-HSE-LOST-DAYS", message: "برای حادثهٔ منجر به از کارافتادگی، روزهای از دست رفته الزامی است" });
    }
  }

  return out;
}

/**
 * شدت پیشنهادی بر پایهٔ نوع رویداد — کاربر می‌تواند بالاتر ببرد ولی
 * پایین‌تر آوردنش باید آگاهانه باشد.
 */
export function suggestSeverity(type: IncidentType, lostDays = 0): Severity {
  if (type === "fatality") return "critical";
  if (type === "lost_time") return lostDays > 14 ? "critical" : "high";
  if (type === "medical_treatment") return "medium";
  if (type === "environmental") return "high";
  if (type === "property_damage") return "medium";
  return "low";
}

/**
 * بستن رویداد بدون ریشه‌یابی و اقدام اصلاحی مجاز نیست — رویدادی که علتش
 * ثبت نشود، دوباره رخ می‌دهد و سامانه فقط بایگانی حادثه می‌شود.
 */
export function canCloseIncident(incident: IncidentRow): { ok: boolean; blockersFa: string[] } {
  const blockersFa: string[] = [];

  if (incident.Status === "closed") {
    blockersFa.push("این رویداد قبلاً بسته شده است");
  }
  if (!String(incident.RootCauseFa ?? "").trim()) {
    blockersFa.push("ریشه‌یابی رویداد ثبت نشده است");
  }
  if (!String(incident.CorrectiveActionFa ?? "").trim()) {
    blockersFa.push("اقدام اصلاحی ثبت نشده است");
  }

  return { ok: blockersFa.length === 0, blockersFa };
}

/**
 * شاخص‌های استاندارد ایمنی.
 *
 * LTIFR = (حوادث منجر به از کارافتادگی × ۱٬۰۰۰٬۰۰۰) ÷ نفر-ساعت کارکرد
 * TRIR  = (حوادث ثبت‌شدنی × ۲۰۰٬۰۰۰) ÷ نفر-ساعت کارکرد
 *
 * ضریب ۲۰۰٬۰۰۰ در TRIR معادل ۱۰۰ کارگر تمام‌وقت در یک سال است (استاندارد OSHA).
 * بدون نفر-ساعت، شاخص محاسبه نمی‌شود و null برمی‌گردد — عدد صفر گمراه‌کننده
 * است چون «ایمن» تفسیر می‌شود در حالی که یعنی «نمی‌دانیم».
 */
export function safetyMetrics(incidents: IncidentRow[], manHours?: number | null): {
  total: number;
  byType: Record<string, number>;
  recordable: number;
  lostTime: number;
  lostDays: number;
  nearMiss: number;
  openCount: number;
  ltifr: number | null;
  trir: number | null;
  manHours: number | null;
} {
  const byType: Record<string, number> = {};
  for (const t of INCIDENT_TYPES) byType[t] = 0;

  let lostDays = 0;
  for (const i of incidents) {
    byType[i.IncidentType] = (byType[i.IncidentType] ?? 0) + 1;
    lostDays += Number(i.LostDays ?? 0) || 0;
  }

  const recordable = incidents.filter((i) => RECORDABLE_TYPES.includes(i.IncidentType as IncidentType)).length;
  const lostTime = incidents.filter((i) => LOST_TIME_TYPES.includes(i.IncidentType as IncidentType)).length;
  const hours = Number(manHours ?? 0);
  const usable = Number.isFinite(hours) && hours > 0 ? hours : null;

  return {
    total: incidents.length,
    byType,
    recordable,
    lostTime,
    lostDays,
    nearMiss: byType.near_miss ?? 0,
    openCount: incidents.filter((i) => i.Status !== "closed").length,
    ltifr: usable ? round2((lostTime * 1_000_000) / usable) : null,
    trir: usable ? round2((recordable * 200_000) / usable) : null,
    manHours: usable,
  };
}

/* ══════════════ آموزش ══════════════ */

/**
 * آیا آموزش ایمنی فرد معتبر است؟ ماژول منابع انسانی گیت `hseTraining` را
 * از اینجا می‌خواند و خودش نمی‌نویسد (منبع حقیقت یکی است).
 */
export function trainingValidity(records: TrainingRow[], personRef: string, now: Date = new Date()): {
  personRef: string;
  hasValid: boolean;
  validCourses: string[];
  expiredCourses: string[];
  expiringSoonCourses: string[];
} {
  const mine = records.filter((r) => r.PersonRef === personRef);
  const t = now.getTime();
  const soonMs = 30 * 24 * 3_600_000;

  const validCourses: string[] = [];
  const expiredCourses: string[] = [];
  const expiringSoonCourses: string[] = [];

  for (const r of mine) {
    if (r.Status === "revoked") {
      expiredCourses.push(r.CourseCode);
      continue;
    }
    const exp = String(r.ExpiresAt ?? "").trim();
    if (!exp) {
      validCourses.push(r.CourseCode);   // بدون انقضا
      continue;
    }
    const e = new Date(exp).getTime();
    if (!Number.isFinite(e)) {
      validCourses.push(r.CourseCode);
    } else if (e < t) {
      expiredCourses.push(r.CourseCode);
    } else {
      validCourses.push(r.CourseCode);
      if (e - t <= soonMs) expiringSoonCourses.push(r.CourseCode);
    }
  }

  return {
    personRef,
    hasValid: validCourses.length > 0,
    validCourses,
    expiredCourses,
    expiringSoonCourses,
  };
}

/* ══════════════ خلاصه و هشدار ══════════════ */

export function hseSummary(args: {
  permits: PermitRow[];
  incidents: IncidentRow[];
  inspections?: InspectionRow[];
  manHours?: number | null;
  now?: Date;
}): {
  permits: { total: number; active: number; expired: number; byType: Record<string, number> };
  incidents: ReturnType<typeof safetyMetrics>;
  inspections: { total: number; avgScorePct: number | null; openFindings: number };
} {
  const now = args.now ?? new Date();

  const byType: Record<string, number> = {};
  for (const t of PERMIT_TYPES) byType[t] = 0;
  let active = 0;
  let expired = 0;
  for (const p of args.permits) {
    byType[p.PermitType] = (byType[p.PermitType] ?? 0) + 1;
    const st = permitState(p, now).effectiveStatus;
    if (st === "active") active += 1;
    if (st === "expired") expired += 1;
  }

  const insp = args.inspections ?? [];
  const scored = insp.filter((i) => i.ScorePct != null && Number.isFinite(Number(i.ScorePct)));
  const avg = scored.length
    ? round2(scored.reduce((s, i) => s + Number(i.ScorePct), 0) / scored.length)
    : null;
  const openFindings = insp.reduce(
    (s, i) => s + Math.max(0, Number(i.FindingsCount ?? 0) - Number(i.ClosedFindings ?? 0)),
    0,
  );

  return {
    permits: { total: args.permits.length, active, expired, byType },
    incidents: safetyMetrics(args.incidents, args.manHours),
    inspections: { total: insp.length, avgScorePct: avg, openFindings },
  };
}

/** قواعد هشدار زودهنگام ایمنی. */
export function hseAlerts(args: {
  permits: PermitRow[];
  incidents: IncidentRow[];
  training?: TrainingRow[];
  now?: Date;
}): { code: string; severity: Severity; messageFa: string }[] {
  const now = args.now ?? new Date();
  const out: { code: string; severity: Severity; messageFa: string }[] = [];

  /* EWS-HSE-01 — پروانهٔ در آستانهٔ انقضا */
  const expiring = args.permits
    .map((p) => permitState(p, now))
    .filter((s) => s.effectiveStatus === "active" && s.expiresInHours !== null && s.expiresInHours <= 4);
  if (expiring.length) {
    out.push({
      code: "EWS-HSE-01",
      severity: "medium",
      messageFa: `${expiring.length} پروانهٔ کار کمتر از ۴ ساعت تا انقضا دارد`,
    });
  }

  /* EWS-HSE-02 — پروانهٔ منقضی بسته‌نشده */
  const expired = args.permits.map((p) => permitState(p, now)).filter((s) => s.effectiveStatus === "expired");
  if (expired.length) {
    out.push({
      code: "EWS-HSE-02",
      severity: "high",
      messageFa: `${expired.length} پروانهٔ منقضی هنوز بسته نشده است`,
    });
  }

  /* EWS-HSE-03 — رویداد بحرانی باز */
  const critical = args.incidents.filter((i) => i.Status !== "closed" && i.Severity === "critical");
  if (critical.length) {
    out.push({
      code: "EWS-HSE-03",
      severity: "critical",
      messageFa: `${critical.length} رویداد ایمنی بحرانی باز است`,
    });
  }

  /* EWS-HSE-04 — تکرار یک نوع رویداد
     سه رویداد هم‌نوع نشانهٔ علت سیستمی است نه بدشانسی. */
  const counts: Record<string, number> = {};
  for (const i of args.incidents) counts[i.IncidentType] = (counts[i.IncidentType] ?? 0) + 1;
  for (const [type, n] of Object.entries(counts)) {
    if (n >= 3 && type !== "near_miss") {
      out.push({
        code: "EWS-HSE-04",
        severity: "high",
        messageFa: `${INCIDENT_TYPE_FA[type] ?? type} ${n} بار تکرار شده — نیازمند ریشه‌یابی سیستمی`,
      });
    }
  }

  /* EWS-HSE-05 — آموزش منقضی */
  const training = args.training ?? [];
  const people = new Set(training.map((r) => r.PersonRef));
  let expiredPeople = 0;
  for (const p of people) {
    const v = trainingValidity(training, p, now);
    if (!v.hasValid && v.expiredCourses.length) expiredPeople += 1;
  }
  if (expiredPeople) {
    out.push({
      code: "EWS-HSE-05",
      severity: "medium",
      messageFa: `${expiredPeople} نفر آموزش ایمنی معتبر ندارند`,
    });
  }

  return out;
}

/* ══════════════════════════════════════════════════════════════
 * بخش ۲ — ارزیابی ریسک شغلی (JSA) و سلسله‌مراتب کنترل خطر
 *
 * تحویلی D3. طبق ISO 45001 بند ۸٫۱٫۲، ارزیابی خطر پیش‌نیاز صدور
 * پروانهٔ کار است و کنترل‌ها باید به ترتیب اثربخشی اعمال شوند.
 * ══════════════════════════════════════════════════════════════ */

/** پنج سطح کنترل به ترتیب اثربخشی — شمارهٔ کمتر یعنی مؤثرتر. */
export const CONTROL_LEVELS = ["elimination", "substitution", "engineering", "administrative", "ppe"] as const;
export type ControlLevel = (typeof CONTROL_LEVELS)[number];

export const CONTROL_LEVEL_FA: Record<string, string> = {
  elimination: "حذف خطر",
  substitution: "جایگزینی",
  engineering: "کنترل مهندسی",
  administrative: "کنترل اداری",
  ppe: "تجهیزات حفاظت فردی",
};

/** رتبهٔ اثربخشی: هرچه کمتر، مؤثرتر. مبنای هشدار اتکای صرف به PPE. */
export const CONTROL_RANK: Record<string, number> = {
  elimination: 1, substitution: 2, engineering: 3, administrative: 4, ppe: 5,
};

export const HAZARD_CATEGORIES = [
  "fall", "struck", "caught", "electrical", "chemical",
  "fire", "ergonomic", "environmental", "biological", "noise",
] as const;
export type HazardCategory = (typeof HAZARD_CATEGORIES)[number];

export const HAZARD_CATEGORY_FA: Record<string, string> = {
  fall: "سقوط از ارتفاع",
  struck: "برخورد جسم",
  caught: "گیرافتادگی بین اجسام",
  electrical: "برق‌گرفتگی",
  chemical: "مواد شیمیایی",
  fire: "آتش و انفجار",
  ergonomic: "ارگونومی",
  environmental: "زیست‌محیطی",
  biological: "عوامل بیولوژیک",
  noise: "صدا و ارتعاش",
};

export const JSA_STATUSES = ["draft", "approved", "expired", "void"] as const;
export type JsaStatus = (typeof JSA_STATUSES)[number];

export const JSA_STATUS_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  approved: "مصوب",
  expired: "منقضی",
  void: "باطل",
};

/** باندهای ریسک بر پایهٔ حاصل‌ضرب احتمال × شدت (۱ تا ۲۵). */
export const RISK_BANDS = [
  { max: 4, code: "low", fa: "کم", color: "#16A34A" },
  { max: 9, code: "medium", fa: "متوسط", color: "#CA8A04" },
  { max: 14, code: "high", fa: "بالا", color: "#EA580C" },
  { max: 25, code: "extreme", fa: "بحرانی", color: "#DC2626" },
] as const;

/** آستانه‌ای که بالاتر از آن، اتکای صرف به PPE پذیرفتنی نیست. */
export const PPE_ONLY_RISK_THRESHOLD = 15;

/** ریسک باقیماندهٔ بیشینه‌ای که JSA با آن تصویب می‌شود. */
export const MAX_APPROVABLE_RESIDUAL = 12;

export type JsaRow = {
  Id: string;
  ProjectId: string;
  JsaNo: string;
  TitleFa: string;
  ActivityId?: string | null;
  TemplateCode?: string | null;
  DisciplineCode?: string | null;
  LocationFa?: string | null;
  PreparedBy: string;
  PreparedAt: string;
  ApprovedBy?: string | null;
  ApprovedAt?: string | null;
  ValidUntil?: string | null;
  MaxResidualRisk?: number | null;
  NoteFa?: string | null;
  Status: string;
};

export type JobStepRow = {
  Id: string;
  ProjectId: string;
  JsaId: string;
  StepNo: number;
  DescriptionFa: string;
  ResponsibleFa?: string | null;
  NoteFa?: string | null;
};

export type HazardRow = {
  Id: string;
  ProjectId: string;
  JsaId: string;
  StepId: string;
  HazardNo: number;
  HazardFa: string;
  HazardCategory?: string | null;
  Likelihood: number;
  Severity: number;
  InitialRisk?: number | null;
  ResidualLikelihood?: number | null;
  ResidualSeverity?: number | null;
  ResidualRisk?: number | null;
  NoteFa?: string | null;
};

export type ControlRow = {
  Id: string;
  ProjectId: string;
  JsaId: string;
  HazardId: string;
  ControlNo: number;
  ControlLevel: string;
  ControlFa: string;
  ResponsibleFa?: string | null;
  VerifiedBy?: string | null;
  VerifiedAt?: string | null;
};

/** باند ریسک از نمرهٔ عددی. */
export function riskBand(score: number | null | undefined): {
  code: string; fa: string; color: string; score: number | null;
} {
  const n = Number(score);
  if (!Number.isFinite(n) || n <= 0) {
    return { code: "unknown", fa: "نامشخص", color: "#94A3B8", score: null };
  }
  for (const b of RISK_BANDS) {
    if (n <= b.max) return { code: b.code, fa: b.fa, color: b.color, score: n };
  }
  const last = RISK_BANDS[RISK_BANDS.length - 1];
  return { code: last.code, fa: last.fa, color: last.color, score: n };
}

/**
 * نمرهٔ ریسک از احتمال و شدت.
 *
 * مقادیر خارج از بازهٔ ۱ تا ۵ به همان بازه محدود می‌شوند نه اینکه صفر
 * برگردانده شود: ورودی نامعتبر نباید خطر را «بی‌خطر» نشان دهد.
 */
export function riskScore(likelihood: number, severity: number): number {
  const clamp = (v: number) => Math.max(1, Math.min(5, Math.round(Number(v) || 1)));
  return clamp(likelihood) * clamp(severity);
}

export function validateJsaInput(input: Partial<JsaRow>): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!String(input.JsaNo ?? "").trim()) {
    out.push({ code: "E-HSE-JSA-NO-REQUIRED", message: "شمارهٔ ارزیابی ریسک الزامی است" });
  }
  if (!String(input.TitleFa ?? "").trim()) {
    out.push({ code: "E-HSE-JSA-TITLE-REQUIRED", message: "عنوان کار الزامی است" });
  }
  if (!String(input.PreparedBy ?? "").trim()) {
    out.push({ code: "E-HSE-JSA-PREPARER-REQUIRED", message: "تهیه‌کننده الزامی است" });
  }
  if (input.Status !== undefined && !JSA_STATUSES.includes(input.Status as JsaStatus)) {
    out.push({ code: "E-HSE-JSA-STATUS", message: "وضعیت ارزیابی نامعتبر است" });
  }
  return out;
}

export function validateHazardInput(input: Partial<HazardRow>): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!String(input.HazardFa ?? "").trim()) {
    out.push({ code: "E-HSE-HAZARD-DESC-REQUIRED", message: "شرح خطر الزامی است" });
  }
  for (const [field, label] of [["Likelihood", "احتمال"], ["Severity", "شدت"]] as const) {
    const v = Number(input[field]);
    if (!Number.isFinite(v) || v < 1 || v > 5) {
      out.push({ code: "E-HSE-RISK-RANGE", message: `${label} باید عددی بین ۱ تا ۵ باشد` });
    }
  }
  if (input.HazardCategory && !HAZARD_CATEGORIES.includes(input.HazardCategory as HazardCategory)) {
    out.push({ code: "E-HSE-HAZARD-CATEGORY", message: "دستهٔ خطر نامعتبر است" });
  }
  return out;
}

export function validateControlInput(input: Partial<ControlRow>): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!String(input.ControlFa ?? "").trim()) {
    out.push({ code: "E-HSE-CONTROL-DESC-REQUIRED", message: "شرح کنترل الزامی است" });
  }
  if (!CONTROL_LEVELS.includes(input.ControlLevel as ControlLevel)) {
    out.push({ code: "E-HSE-CONTROL-LEVEL", message: "سطح کنترل نامعتبر است" });
  }
  return out;
}

/**
 * ارزیابی یک خطر با کنترل‌هایش.
 *
 * دو قاعدهٔ عمدی:
 *  ۱. اگر ریسک باقیمانده ثبت نشده باشد، برابر ریسک اولیه فرض می‌شود —
 *     نه صفر. کنترلی که اثرش سنجیده نشده، خطر را کم نکرده است.
 *  ۲. اتکای صرف به تجهیزات حفاظت فردی برای ریسک بالا هشدار می‌دهد.
 *     کلاه ایمنی جلوی سقوط از ارتفاع را نمی‌گیرد؛ این شایع‌ترین ضعف
 *     ارزیابی‌های صوری است.
 */
export function evaluateHazard(hazard: HazardRow, controls: ControlRow[]): {
  hazardId: string;
  initialRisk: number;
  initialBand: ReturnType<typeof riskBand>;
  residualRisk: number;
  residualBand: ReturnType<typeof riskBand>;
  controlCount: number;
  bestControlLevel: string | null;
  bestControlLevelFa: string | null;
  ppeOnly: boolean;
  reductionPct: number;
  warningsFa: string[];
} {
  const mine = controls.filter((c) => c.HazardId === hazard.Id);
  const initial = riskScore(hazard.Likelihood, hazard.Severity);

  const hasResidual = hazard.ResidualLikelihood != null && hazard.ResidualSeverity != null;
  const residual = hasResidual
    ? riskScore(Number(hazard.ResidualLikelihood), Number(hazard.ResidualSeverity))
    : initial;

  const ranks = mine
    .map((c) => CONTROL_RANK[c.ControlLevel])
    .filter((r) => Number.isFinite(r));
  const bestRank = ranks.length ? Math.min(...ranks) : null;
  const bestLevel = bestRank
    ? (CONTROL_LEVELS.find((l) => CONTROL_RANK[l] === bestRank) ?? null)
    : null;

  const ppeOnly = mine.length > 0 && mine.every((c) => c.ControlLevel === "ppe");

  const warningsFa: string[] = [];
  if (!mine.length) {
    warningsFa.push("این خطر هیچ کنترلی ندارد");
  }
  if (ppeOnly && initial >= PPE_ONLY_RISK_THRESHOLD) {
    warningsFa.push(
      `ریسک ${initial} تنها با تجهیزات حفاظت فردی کنترل شده — کنترل مهندسی یا حذف لازم است`,
    );
  }
  if (mine.length && !hasResidual) {
    warningsFa.push("اثر کنترل‌ها بر ریسک سنجیده نشده است");
  }
  if (residual > initial) {
    warningsFa.push("ریسک باقیمانده از ریسک اولیه بیشتر است");
  }

  return {
    hazardId: hazard.Id,
    initialRisk: initial,
    initialBand: riskBand(initial),
    residualRisk: residual,
    residualBand: riskBand(residual),
    controlCount: mine.length,
    bestControlLevel: bestLevel,
    bestControlLevelFa: bestLevel ? CONTROL_LEVEL_FA[bestLevel] : null,
    ppeOnly,
    reductionPct: initial > 0 ? round2(((initial - residual) / initial) * 100) : 0,
    warningsFa,
  };
}

/** خلاصهٔ کل ارزیابی: گام‌ها، خطرات، کنترل‌ها و بیشینهٔ ریسک باقیمانده. */
export function jsaSummary(
  steps: JobStepRow[],
  hazards: HazardRow[],
  controls: ControlRow[],
): {
  steps: number;
  hazards: number;
  controls: number;
  maxInitialRisk: number | null;
  maxResidualRisk: number | null;
  maxResidualBand: ReturnType<typeof riskBand>;
  byControlLevel: Record<string, number>;
  byBand: Record<string, number>;
  hazardsWithoutControl: number;
  ppeOnlyHighRisk: number;
  stepsWithoutHazard: number;
  warningsFa: string[];
} {
  const byControlLevel: Record<string, number> = {};
  for (const l of CONTROL_LEVELS) byControlLevel[l] = 0;
  for (const c of controls) {
    byControlLevel[c.ControlLevel] = (byControlLevel[c.ControlLevel] ?? 0) + 1;
  }

  const byBand: Record<string, number> = { low: 0, medium: 0, high: 0, extreme: 0 };
  const evals = hazards.map((h) => evaluateHazard(h, controls));
  for (const e of evals) {
    byBand[e.residualBand.code] = (byBand[e.residualBand.code] ?? 0) + 1;
  }

  const maxInitial = evals.length ? Math.max(...evals.map((e) => e.initialRisk)) : null;
  const maxResidual = evals.length ? Math.max(...evals.map((e) => e.residualRisk)) : null;

  const stepIdsWithHazard = new Set(hazards.map((h) => h.StepId));
  const stepsWithoutHazard = steps.filter((s) => !stepIdsWithHazard.has(s.Id)).length;

  const warningsFa: string[] = [];
  const noControl = evals.filter((e) => e.controlCount === 0).length;
  if (noControl) warningsFa.push(`${noControl} خطر بدون کنترل است`);
  const ppeHigh = evals.filter((e) => e.ppeOnly && e.initialRisk >= PPE_ONLY_RISK_THRESHOLD).length;
  if (ppeHigh) warningsFa.push(`${ppeHigh} خطر پرریسک تنها با حفاظت فردی کنترل شده است`);
  if (stepsWithoutHazard) warningsFa.push(`${stepsWithoutHazard} گام کاری بدون شناسایی خطر است`);

  return {
    steps: steps.length,
    hazards: hazards.length,
    controls: controls.length,
    maxInitialRisk: maxInitial,
    maxResidualRisk: maxResidual,
    maxResidualBand: riskBand(maxResidual),
    byControlLevel,
    byBand,
    hazardsWithoutControl: noControl,
    ppeOnlyHighRisk: ppeHigh,
    stepsWithoutHazard,
    warningsFa,
  };
}

/**
 * آیا ارزیابی ریسک قابل تصویب است؟
 *
 * موانع سخت (طبق ADR-HSE-02 همه یک‌جا برمی‌گردند):
 *  · ارزیابی بدون گام کاری یا بدون خطر شناسایی‌شده
 *  · خطر بدون هیچ کنترل
 *  · ریسک باقیماندهٔ بالاتر از حد مجاز
 *  · اتکای صرف به حفاظت فردی برای ریسک بالا
 *  · تصویب‌کننده همان تهیه‌کننده
 */
export function canApproveJsa(args: {
  jsa: JsaRow;
  steps: JobStepRow[];
  hazards: HazardRow[];
  controls: ControlRow[];
  approverId?: string;
}): { ok: boolean; blockersFa: string[]; warningsFa: string[]; maxResidualRisk: number | null } {
  const { jsa, steps, hazards, controls, approverId } = args;
  const blockersFa: string[] = [];
  const warningsFa: string[] = [];

  if (jsa.Status === "approved") blockersFa.push("این ارزیابی قبلاً تصویب شده است");
  if (jsa.Status === "void") blockersFa.push("ارزیابی باطل قابل تصویب نیست");

  if (!steps.length) blockersFa.push("ارزیابی بدون گام کاری قابل تصویب نیست");
  if (!hazards.length) blockersFa.push("هیچ خطری شناسایی نشده است");

  const evals = hazards.map((h) => evaluateHazard(h, controls));

  const noControl = evals.filter((e) => e.controlCount === 0);
  if (noControl.length) {
    blockersFa.push(`${noControl.length} خطر هیچ کنترلی ندارد`);
  }

  const ppeHigh = evals.filter((e) => e.ppeOnly && e.initialRisk >= PPE_ONLY_RISK_THRESHOLD);
  if (ppeHigh.length) {
    blockersFa.push(
      `${ppeHigh.length} خطر پرریسک تنها با تجهیزات حفاظت فردی کنترل شده — کنترل بالاتر لازم است`,
    );
  }

  const maxResidual = evals.length ? Math.max(...evals.map((e) => e.residualRisk)) : null;
  if (maxResidual !== null && maxResidual > MAX_APPROVABLE_RESIDUAL) {
    blockersFa.push(
      `ریسک باقیمانده ${maxResidual} از حد مجاز ${MAX_APPROVABLE_RESIDUAL} بیشتر است`,
    );
  }

  if (approverId && approverId === jsa.PreparedBy) {
    blockersFa.push("تصویب‌کننده نمی‌تواند همان تهیه‌کننده باشد");
  }

  const stepIdsWithHazard = new Set(hazards.map((h) => h.StepId));
  const orphanSteps = steps.filter((s) => !stepIdsWithHazard.has(s.Id));
  if (orphanSteps.length) {
    warningsFa.push(`${orphanSteps.length} گام کاری بدون شناسایی خطر است`);
  }
  const unmeasured = evals.filter((e) => e.controlCount > 0 && e.warningsFa.some((w) => w.includes("سنجیده نشده")));
  if (unmeasured.length) {
    warningsFa.push(`${unmeasured.length} خطر اثر کنترلش سنجیده نشده است`);
  }

  return { ok: blockersFa.length === 0, blockersFa, warningsFa, maxResidualRisk: maxResidual };
}

/**
 * وضعیت مؤثر ارزیابی در لحظه — انقضا از تاریخ مشتق می‌شود نه ستون وضعیت.
 * همان قاعدهٔ ADR-HSE-05 که برای پروانه اعمال شد.
 */
export function jsaState(jsa: JsaRow, now: Date = new Date()): {
  effectiveStatus: JsaStatus;
  statusFa: string;
  isUsable: boolean;
  expiresInDays: number | null;
} {
  let effective = jsa.Status as JsaStatus;
  const until = String(jsa.ValidUntil ?? "").trim();
  const t = now.getTime();
  let expiresInDays: number | null = null;

  if (until) {
    const e = new Date(until).getTime();
    if (Number.isFinite(e)) {
      expiresInDays = Math.floor((e - t) / 86_400_000);
      if (jsa.Status === "approved" && e < t) effective = "expired";
    }
  }

  return {
    effectiveStatus: effective,
    statusFa: JSA_STATUS_FA[effective] ?? effective,
    isUsable: effective === "approved",
    expiresInDays: effective === "approved" ? expiresInDays : null,
  };
}

/**
 * دروازهٔ پیش‌نیاز پروانهٔ کار: آیا این ارزیابی ریسک پروانه را پشتیبانی می‌کند؟
 *
 * این تابع همان چیزی است که شکاف GH-05 را می‌بندد — پیش از آن، شرط
 * «JSA مصوب» روی پروانه هیچ سنجه‌ای نداشت.
 */
export function jsaSupportsPermit(
  jsa: JsaRow | null | undefined,
  now: Date = new Date(),
): { ok: boolean; blockersFa: string[] } {
  const blockersFa: string[] = [];
  if (!jsa) {
    return { ok: false, blockersFa: ["ارزیابی ریسک شغلی به این پروانه پیوست نشده است"] };
  }
  const st = jsaState(jsa, now);
  if (st.effectiveStatus === "draft") blockersFa.push("ارزیابی ریسک هنوز تصویب نشده است");
  if (st.effectiveStatus === "expired") blockersFa.push("اعتبار ارزیابی ریسک منقضی شده است");
  if (st.effectiveStatus === "void") blockersFa.push("ارزیابی ریسک باطل شده است");
  return { ok: blockersFa.length === 0, blockersFa };
}

/* ═══════════════════════════════════════════════════════════════════════
 * بخش ۳ — سامانهٔ پروانهٔ کار (PTW) · تحویلی D4
 *
 * این بخش سه شکاف را می‌بندد:
 *   GH-05  پیوند پروانه با ارزیابی ریسک مصوب
 *   GH-06  گازسنجی عددی به‌جای رشتهٔ آزاد «OK»
 *   GH-07  قفل و برچسب (LOTO) و امضای سه‌سطحی
 *
 * تابع `canApprovePermit` بخش ۱ دست‌نخورده می‌ماند؛ دروازهٔ کامل‌تر
 * `canIssuePermit` روی آن سوار می‌شود تا آزمون‌ها و مصرف‌کنندگان موجود
 * نشکنند.
 * ═════════════════════════════════════════════════════════════════════ */

/* ── آستانه‌های گاز؛ مبنای استاندارد فضای محصور ── */
export const GAS_LIMITS = {
  /** حد پایین انفجار — بالاتر از این یعنی مخلوط قابل اشتعال. */
  lelMaxPct: 10,
  /** کمبود اکسیژن؛ زیر این حد خفگی. */
  oxygenMinPct: 19.5,
  /** غنای اکسیژن؛ بالای این حد آتش‌گیری شدید. */
  oxygenMaxPct: 23.5,
  h2sMaxPpm: 10,
  coMaxPpm: 35,
} as const;

/** پس از این مدت، گازسنجی برای ورود دوباره معتبر نیست. */
export const GAS_TEST_VALIDITY_MINUTES = 120;

export const ISOLATION_TYPES = ["electrical", "mechanical", "process", "hydraulic"] as const;
export type IsolationType = (typeof ISOLATION_TYPES)[number];

export const ISOLATION_TYPE_FA: Record<string, string> = {
  electrical: "برقی",
  mechanical: "مکانیکی",
  process: "فرآیندی",
  hydraulic: "هیدرولیکی",
};

export const ISOLATION_STATUSES = ["planned", "applied", "removed"] as const;
export type IsolationStatus = (typeof ISOLATION_STATUSES)[number];

export const ISOLATION_STATUS_FA: Record<string, string> = {
  planned: "برنامه‌ریزی‌شده",
  applied: "اعمال‌شده",
  removed: "برداشته‌شده",
};

/** ترتیب امضا اجباری است — نمایه در آرایه همان رتبهٔ امضاست. */
export const APPROVAL_LEVELS = ["supervisor", "hse", "area_manager"] as const;
export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number];

export const APPROVAL_LEVEL_FA: Record<string, string> = {
  supervisor: "سرپرست اجرا",
  hse: "افسر ایمنی و بهداشت",
  area_manager: "مدیر منطقه",
};

/** انواع پروانه که گازسنجی عددی برایشان اجباری است. */
export const GAS_TEST_REQUIRED_PERMITS: PermitType[] = ["hot", "confined"];

/** انواع پروانه که ایزولاسیون برایشان اجباری است. */
export const ISOLATION_REQUIRED_PERMITS: PermitType[] = ["electrical", "confined"];

export type GasTestRow = {
  Id: string;
  ProjectId: string;
  PermitId: string;
  TestedAt: string;
  LelPct?: number | null;
  OxygenPct?: number | null;
  H2sPpm?: number | null;
  CoPpm?: number | null;
  IsSafe?: boolean | null;
  BreachedFa?: string | null;
  TestedBy: string;
  DeviceSerial?: string | null;
};

export type IsolationRow = {
  Id: string;
  ProjectId: string;
  PermitId: string;
  IsolationNo: number;
  IsolationType: string;
  PointTagFa: string;
  LockNo?: string | null;
  TagNo?: string | null;
  AppliedAt?: string | null;
  AppliedBy?: string | null;
  RemovedAt?: string | null;
  RemovedBy?: string | null;
  Status: string;
};

export type PtwApprovalRow = {
  Id: string;
  ProjectId: string;
  PermitId: string;
  ApprovalLevel: string;
  ApproverRef: string;
  SignedAt: string;
  DecisionFa: string;
  CommentFa?: string | null;
};

export type PrecautionRow = {
  Id: string;
  ProjectId: string;
  PermitId: string;
  PrecautionNo: number;
  PrecautionFa: string;
  IsMandatory?: boolean | null;
  IsConfirmed?: boolean | null;
  ConfirmedBy?: string | null;
  ConfirmedAt?: string | null;
};

/* ── گازسنجی ───────────────────────────────────────────────────────── */

/**
 * ارزیابی یک گازسنجی در برابر آستانه‌ها.
 *
 * `IsSafe` هرگز از ورودی کاربر خوانده نمی‌شود. دلیلش رفتار واقعی میدان
 * است: اپراتوری که زیر فشار زمانی است تیک «ایمن» را می‌زند بی‌آنکه عدد
 * را بخواند. اینجا فقط عدد حرف می‌زند.
 *
 * پارامتر ثبت‌نشده «ایمن» فرض نمی‌شود — برای پروانه‌ای که آن گاز را لازم
 * دارد، نبودِ اندازه‌گیری خودش یک ایراد است.
 */
export function evaluateGasTest(reading: {
  LelPct?: number | null;
  OxygenPct?: number | null;
  H2sPpm?: number | null;
  CoPpm?: number | null;
}): {
  isSafe: boolean;
  breachesFa: string[];
  missingFa: string[];
  measuredCount: number;
} {
  const breachesFa: string[] = [];
  const missingFa: string[] = [];

  /*
   * مقدار منفی از دستگاه خراب یا کالیبره‌نشده می‌آید و «صفر ایمن» نیست.
   * اگر آن را بپذیریم، گازسنجی معیوب سبزترین نتیجهٔ ممکن را می‌دهد —
   * دقیقاً برعکس چیزی که ایمنی لازم دارد. پس مثل اندازه‌نگرفته رفتار
   * می‌کند و در فهرست کمبودها می‌آید.
   */
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };

  const lel = num(reading.LelPct);
  const o2 = num(reading.OxygenPct);
  const h2s = num(reading.H2sPpm);
  const co = num(reading.CoPpm);

  if (lel === null) missingFa.push("حد انفجار (LEL) اندازه‌گیری نشده");
  else if (lel >= GAS_LIMITS.lelMaxPct) {
    breachesFa.push(`حد انفجار ${lel}٪ — بیشینهٔ مجاز ${GAS_LIMITS.lelMaxPct}٪`);
  }

  if (o2 === null) missingFa.push("درصد اکسیژن اندازه‌گیری نشده");
  else if (o2 < GAS_LIMITS.oxygenMinPct) {
    breachesFa.push(`کمبود اکسیژن ${o2}٪ — کمینهٔ مجاز ${GAS_LIMITS.oxygenMinPct}٪`);
  } else if (o2 > GAS_LIMITS.oxygenMaxPct) {
    /* غنای اکسیژن هم خطر است، نه فقط کمبودش. */
    breachesFa.push(`غنای اکسیژن ${o2}٪ — بیشینهٔ مجاز ${GAS_LIMITS.oxygenMaxPct}٪`);
  }

  if (h2s === null) missingFa.push("غلظت سولفید هیدروژن اندازه‌گیری نشده");
  else if (h2s >= GAS_LIMITS.h2sMaxPpm) {
    breachesFa.push(`سولفید هیدروژن ${h2s} ppm — بیشینهٔ مجاز ${GAS_LIMITS.h2sMaxPpm} ppm`);
  }

  if (co === null) missingFa.push("غلظت مونوکسید کربن اندازه‌گیری نشده");
  else if (co >= GAS_LIMITS.coMaxPpm) {
    breachesFa.push(`مونوکسید کربن ${co} ppm — بیشینهٔ مجاز ${GAS_LIMITS.coMaxPpm} ppm`);
  }

  const measuredCount = [lel, o2, h2s, co].filter((x) => x !== null).length;

  return {
    /* هیچ اندازه‌گیری = ناایمن. سکوت تأیید نیست. */
    isSafe: breachesFa.length === 0 && measuredCount > 0,
    breachesFa,
    missingFa,
    measuredCount,
  };
}

/**
 * آخرین گازسنجی معتبر یک پروانه.
 *
 * گازسنجی کهنه بی‌ارزش است: جو فضای محصور در دو ساعت عوض می‌شود.
 */
export function latestGasTest(
  tests: GasTestRow[],
  permitId: string,
  now: Date = new Date(),
): {
  test: GasTestRow | null;
  isFresh: boolean;
  ageMinutes: number | null;
  isSafe: boolean;
} {
  const mine = tests
    .filter((t) => t.PermitId === permitId && Number.isFinite(new Date(t.TestedAt).getTime()))
    .sort((a, b) => new Date(b.TestedAt).getTime() - new Date(a.TestedAt).getTime());

  const test = mine[0] ?? null;
  if (!test) return { test: null, isFresh: false, ageMinutes: null, isSafe: false };

  const ageMinutes = round2((now.getTime() - new Date(test.TestedAt).getTime()) / 60_000);
  const evalRes = evaluateGasTest(test);

  return {
    test,
    /* منفی یعنی زمان‌سنج دستگاه جلوتر است؛ آن را تازه نمی‌شماریم. */
    isFresh: ageMinutes >= 0 && ageMinutes <= GAS_TEST_VALIDITY_MINUTES,
    ageMinutes,
    isSafe: evalRes.isSafe,
  };
}

/* ── ایزولاسیون ────────────────────────────────────────────────────── */

/**
 * وضعیت قفل و برچسب یک پروانه.
 *
 * قفل جامانده روی تجهیز، خطر مستقیم راه‌اندازی ناخواسته است؛ به همین دلیل
 * «همه اعمال‌شده» شرط شروع کار و «همه برداشته‌شده» شرط بستن پروانه است.
 */
export function isolationState(isolations: IsolationRow[], permitId: string): {
  total: number;
  planned: number;
  applied: number;
  removed: number;
  allApplied: boolean;
  allRemoved: boolean;
  missingLockFa: string[];
} {
  const mine = isolations.filter((i) => i.PermitId === permitId);
  const planned = mine.filter((i) => i.Status === "planned").length;
  const applied = mine.filter((i) => i.Status === "applied").length;
  const removed = mine.filter((i) => i.Status === "removed").length;

  /* قفل بدون شمارهٔ فیزیکی قابل ممیزی نیست. */
  const missingLockFa = mine
    .filter((i) => i.Status === "applied" && !String(i.LockNo ?? "").trim())
    .map((i) => `ایزولاسیون ${i.IsolationNo} (${i.PointTagFa}) شمارهٔ قفل ندارد`);

  return {
    total: mine.length,
    planned,
    applied,
    removed,
    allApplied: mine.length > 0 && planned === 0,
    allRemoved: mine.length > 0 && removed === mine.length,
    missingLockFa,
  };
}

/* ── امضای سه‌سطحی ─────────────────────────────────────────────────── */

/**
 * وضعیت زنجیرهٔ امضا با ترتیب اجباری.
 *
 * ترتیب برای این است که مدیر منطقه چیزی را تأیید نکند که افسر ایمنی هنوز
 * ندیده — امضای بی‌ترتیب همان مهر لاستیکی است.
 */
export function approvalChain(approvals: PtwApprovalRow[], permitId: string): {
  signed: ApprovalLevel[];
  pending: ApprovalLevel[];
  nextLevel: ApprovalLevel | null;
  rejectedBy: ApprovalLevel | null;
  isComplete: boolean;
  outOfOrderFa: string[];
} {
  const mine = approvals.filter((a) => a.PermitId === permitId);
  const byLevel = new Map(mine.map((a) => [a.ApprovalLevel, a]));

  const rejected = APPROVAL_LEVELS.find((l) => byLevel.get(l)?.DecisionFa === "rejected") ?? null;
  const signed = APPROVAL_LEVELS.filter((l) => byLevel.get(l)?.DecisionFa === "approved");
  const pending = APPROVAL_LEVELS.filter((l) => !byLevel.has(l));

  const outOfOrderFa: string[] = [];
  for (let i = 0; i < APPROVAL_LEVELS.length; i += 1) {
    const level = APPROVAL_LEVELS[i];
    if (!byLevel.has(level)) continue;
    const unsignedBefore = APPROVAL_LEVELS.slice(0, i).filter((prev) => !byLevel.has(prev));
    if (unsignedBefore.length) {
      outOfOrderFa.push(
        `${APPROVAL_LEVEL_FA[level]} پیش از ${unsignedBefore.map((x) => APPROVAL_LEVEL_FA[x]).join(" و ")} امضا کرده است`,
      );
    }
  }

  return {
    signed,
    pending,
    nextLevel: rejected ? null : (pending[0] ?? null),
    rejectedBy: rejected,
    isComplete: rejected === null && signed.length === APPROVAL_LEVELS.length,
    outOfOrderFa,
  };
}

/** آیا این سطح همین حالا می‌تواند امضا کند؟ */
export function canSignPermit(args: {
  permit: PermitRow;
  approvals: PtwApprovalRow[];
  level: string;
  approverId?: string;
}): { ok: boolean; blockersFa: string[] } {
  const { permit, approvals, level, approverId } = args;
  const blockersFa: string[] = [];

  if (!APPROVAL_LEVELS.includes(level as ApprovalLevel)) {
    blockersFa.push("سطح امضا نامعتبر است");
    return { ok: false, blockersFa };
  }

  if (permit.Status === "closed" || permit.Status === "expired" || permit.Status === "rejected") {
    blockersFa.push(`پروانهٔ ${PERMIT_STATUS_FA[permit.Status] ?? permit.Status} امضا نمی‌پذیرد`);
  }

  const chain = approvalChain(approvals, permit.Id);
  if (chain.rejectedBy) {
    blockersFa.push(`${APPROVAL_LEVEL_FA[chain.rejectedBy]} پروانه را رد کرده است`);
  }
  if (chain.signed.includes(level as ApprovalLevel) || approvals.some((a) => a.PermitId === permit.Id && a.ApprovalLevel === level)) {
    blockersFa.push(`${APPROVAL_LEVEL_FA[level]} قبلاً نظر خود را ثبت کرده است`);
  }
  if (chain.nextLevel && chain.nextLevel !== level) {
    blockersFa.push(`نوبت امضای ${APPROVAL_LEVEL_FA[chain.nextLevel]} است`);
  }

  /* درخواست‌کننده در هیچ سطحی امضاکنندهٔ پروانهٔ خودش نیست. */
  if (approverId && approverId === permit.RequestedBy) {
    blockersFa.push("درخواست‌کننده نمی‌تواند پروانهٔ خود را امضا کند");
  }

  return { ok: blockersFa.length === 0, blockersFa };
}

/* ── چک‌لیست احتیاطی ───────────────────────────────────────────────── */

/**
 * وضعیت اقدامات احتیاطی.
 *
 * `IsConfirmed === null` یعنی «هنوز بررسی نشده» و با `false` یکی نیست:
 * اولی یعنی کسی نگاه نکرده، دومی یعنی نگاه کرده و برقرار نبوده. هر دو
 * مانع‌اند ولی پیام‌شان فرق دارد.
 */
export function precautionState(precautions: PrecautionRow[], permitId: string): {
  total: number;
  confirmed: number;
  unconfirmed: number;
  unchecked: number;
  mandatoryPendingFa: string[];
  isReady: boolean;
} {
  const mine = precautions.filter((p) => p.PermitId === permitId);
  const confirmed = mine.filter((p) => p.IsConfirmed === true).length;
  const unconfirmed = mine.filter((p) => p.IsConfirmed === false).length;
  const unchecked = mine.filter((p) => p.IsConfirmed === null || p.IsConfirmed === undefined).length;

  const mandatoryPendingFa = mine
    .filter((p) => p.IsMandatory !== false && p.IsConfirmed !== true)
    .map((p) => {
      const stateFa = p.IsConfirmed === false ? "برقرار نیست" : "بررسی نشده";
      return `اقدام ${p.PrecautionNo}: ${p.PrecautionFa} — ${stateFa}`;
    });

  return {
    total: mine.length,
    confirmed,
    unconfirmed,
    unchecked,
    mandatoryPendingFa,
    isReady: mandatoryPendingFa.length === 0,
  };
}

/* ── دروازهٔ صدور پروانه ───────────────────────────────────────────── */

/**
 * دروازهٔ کامل صدور پروانهٔ کار.
 *
 * این تابع جمع‌کنندهٔ همهٔ شرط‌هاست و بر خلاف `canApprovePermit` بخش ۱،
 * به رکوردهای وابسته هم نگاه می‌کند. مطابق ADR-HSE-02 هرگز استثنا پرتاب
 * نمی‌کند و همهٔ موانع را یک‌جا برمی‌گرداند تا کاربر میدانی رفت‌وبرگشت
 * نکند.
 */
export function canIssuePermit(args: {
  permit: PermitRow;
  jsa?: JsaRow | null;
  gasTests?: GasTestRow[];
  isolations?: IsolationRow[];
  approvals?: PtwApprovalRow[];
  precautions?: PrecautionRow[];
  approverId?: string;
  now?: Date;
}): {
  ok: boolean;
  blockersFa: string[];
  warningsFa: string[];
  checks: Record<string, boolean>;
} {
  const {
    permit,
    jsa = null,
    gasTests = [],
    isolations = [],
    approvals = [],
    precautions = [],
    approverId,
    now = new Date(),
  } = args;

  const blockersFa: string[] = [];
  const warningsFa: string[] = [];
  const checks: Record<string, boolean> = {
    baseGate: false,
    jsa: false,
    gasTest: false,
    isolation: false,
    approvals: false,
    precautions: false,
  };

  /* ۱) دروازهٔ پایه — همان قواعد بخش ۱ بدون تکرار منطق.
   *
   * یک استثنا: `canApprovePermit` ستون متنی قدیمی `GasTestResultFa` را
   * می‌سنجد. از D4 به بعد منبع حقیقتِ گازسنجی جدول عددی `GasTestLog`
   * است و بند ۳ همین تابع آن را دقیق‌تر می‌سنجد. اگر مانع پایه را هم
   * نگه داریم، پروانه‌ای که گازسنجی عددی سالم دارد ولی رشتهٔ قدیمی‌اش
   * خالی است بی‌دلیل رد می‌شود. پس فقط همان یک مانع کنار گذاشته
   * می‌شود، نه بیشتر. */
  const base = canApprovePermit(permit, approverId);
  const LEGACY_GAS_BLOCKER = "نتیجهٔ آزمون گاز ثبت نشده است";
  const baseBlockers = base.blockersFa.filter((b) => b !== LEGACY_GAS_BLOCKER);
  checks.baseGate = baseBlockers.length === 0;
  blockersFa.push(...baseBlockers);

  const type = permit.PermitType as PermitType;

  /* ۲) ارزیابی ریسک مصوب — شکاف GH-05. */
  const jsaId = String((permit as { JsaId?: string }).JsaId ?? "").trim();
  if (!jsaId) {
    blockersFa.push("پروانه به ارزیابی ریسک شغلی متصل نیست");
  } else if (!jsa) {
    blockersFa.push("ارزیابی ریسک مرتبط یافت نشد");
  } else {
    const support = jsaSupportsPermit(jsa, now);
    if (!support.ok) blockersFa.push(...support.blockersFa);
    else checks.jsa = true;
  }

  /* ۳) گازسنجی عددی — شکاف GH-06. */
  if (GAS_TEST_REQUIRED_PERMITS.includes(type)) {
    const gas = latestGasTest(gasTests, permit.Id, now);
    if (!gas.test) {
      blockersFa.push(`${PERMIT_TYPE_FA[type] ?? type} بدون گازسنجی ثبت‌شده مجاز نیست`);
    } else if (!gas.isSafe) {
      const detail = evaluateGasTest(gas.test);
      blockersFa.push(
        detail.breachesFa.length
          ? `گازسنجی خارج از محدودهٔ ایمن: ${detail.breachesFa.join("، ")}`
          : "گازسنجی هیچ پارامتری را اندازه نگرفته است",
      );
    } else if (!gas.isFresh) {
      blockersFa.push(
        `گازسنجی ${gas.ageMinutes} دقیقه پیش انجام شده — اعتبار آن ${GAS_TEST_VALIDITY_MINUTES} دقیقه است`,
      );
    } else {
      /*
       * برای پروانه‌ای که گازسنجی اجباری دارد، «هیچ تخلفی نبود» کافی
       * نیست: پارامتر اندازه‌نگرفته یعنی آن خطر اصلاً سنجیده نشده.
       * مقدار منفیِ دستگاه معیوب هم اینجا می‌افتد چون مثل اندازه‌نگرفته
       * رفتار می‌کند.
       */
      const detail = evaluateGasTest(gas.test);
      if (detail.missingFa.length) {
        blockersFa.push(
          `گازسنجی ناقص است: ${detail.missingFa.join("، ")}`,
        );
      } else {
        checks.gasTest = true;
      }
    }
  } else {
    checks.gasTest = true;
    /* گازسنجی اختیاری اگر ثبت شده و ناایمن بود، هشدار است نه مانع. */
    const gas = latestGasTest(gasTests, permit.Id, now);
    if (gas.test && !gas.isSafe) {
      warningsFa.push("گازسنجی ثبت‌شده خارج از محدودهٔ ایمن است هرچند برای این نوع پروانه اجباری نیست");
    }
  }

  /* ۴) قفل و برچسب — شکاف GH-07. */
  const iso = isolationState(isolations, permit.Id);
  if (ISOLATION_REQUIRED_PERMITS.includes(type)) {
    if (iso.total === 0) {
      blockersFa.push(`${PERMIT_TYPE_FA[type] ?? type} بدون ثبت ایزولاسیون مجاز نیست`);
    } else if (!iso.allApplied) {
      blockersFa.push(`${iso.planned} ایزولاسیون هنوز اعمال نشده است`);
    } else {
      checks.isolation = true;
    }
  } else {
    checks.isolation = true;
    if (iso.planned > 0) warningsFa.push(`${iso.planned} ایزولاسیون برنامه‌ریزی‌شده هنوز اعمال نشده است`);
  }
  blockersFa.push(...iso.missingLockFa);

  /* ۵) زنجیرهٔ امضا. */
  const chain = approvalChain(approvals, permit.Id);
  if (chain.rejectedBy) {
    blockersFa.push(`${APPROVAL_LEVEL_FA[chain.rejectedBy]} پروانه را رد کرده است`);
  } else if (!chain.isComplete) {
    blockersFa.push(
      `امضای ${chain.pending.map((l) => APPROVAL_LEVEL_FA[l]).join(" و ")} باقی مانده است`,
    );
  } else {
    checks.approvals = true;
  }
  warningsFa.push(...chain.outOfOrderFa);

  /* ۶) اقدامات احتیاطی. */
  const prec = precautionState(precautions, permit.Id);
  if (prec.total === 0) {
    warningsFa.push("هیچ اقدام احتیاطی برای این پروانه تعریف نشده است");
    checks.precautions = true;
  } else if (!prec.isReady) {
    blockersFa.push(...prec.mandatoryPendingFa);
  } else {
    checks.precautions = true;
  }

  return { ok: blockersFa.length === 0, blockersFa, warningsFa, checks };
}

/**
 * دروازهٔ بستن پروانه.
 *
 * قفل جامانده مهم‌ترین مانع است: پروانه‌ای که بسته شود ولی ایزولاسیونش
 * برداشته نشده باشد، یعنی تجهیز قفل‌شده بدون متولی رها شده است.
 */
export function canClosePermit(args: {
  permit: PermitRow;
  isolations?: IsolationRow[];
  openIncidents?: number;
  closerId?: string;
}): { ok: boolean; blockersFa: string[]; warningsFa: string[] } {
  const { permit, isolations = [], openIncidents = 0, closerId } = args;
  const blockersFa: string[] = [];
  const warningsFa: string[] = [];

  if (permit.Status === "closed") blockersFa.push("این پروانه قبلاً بسته شده است");
  if (permit.Status === "draft") blockersFa.push("پروانهٔ پیش‌نویس بستنی نیست");

  const iso = isolationState(isolations, permit.Id);
  if (iso.total > 0 && !iso.allRemoved) {
    const left = iso.total - iso.removed;
    blockersFa.push(`${left} قفل هنوز روی تجهیز است — پیش از بستن پروانه باید برداشته شود`);
  }

  if (openIncidents > 0) {
    blockersFa.push(`${openIncidents} رویداد ایمنی باز زیر این پروانه ثبت شده است`);
  }

  if (closerId && closerId === permit.RequestedBy) {
    /* بستن پروانه به‌دست درخواست‌کننده رایج و پذیرفتنی است؛ فقط ثبت شود. */
    warningsFa.push("پروانه به‌دست درخواست‌کننده بسته می‌شود");
  }

  return { ok: blockersFa.length === 0, blockersFa, warningsFa };
}

/**
 * تعلیق پروانه — عمداً از لغو جداست.
 *
 * پروانهٔ معلق دوباره فعال می‌شود؛ پروانهٔ لغوشده نه. این تمایز برای
 * توقف موقت کار (مثلاً باد شدید یا مانور اضطراری) لازم است و مبنای ادعای
 * تمدید زمان را هم حفظ می‌کند — همان اصلی که در ADR-HSE-10 برای دستور
 * توقف کار پذیرفتیم.
 */
export function canSuspendPermit(permit: PermitRow): { ok: boolean; blockersFa: string[] } {
  const blockersFa: string[] = [];
  if (permit.Status !== "active") {
    blockersFa.push(`فقط پروانهٔ فعال قابل تعلیق است — وضعیت فعلی: ${PERMIT_STATUS_FA[permit.Status] ?? permit.Status}`);
  }
  return { ok: blockersFa.length === 0, blockersFa };
}

export function canResumePermit(
  permit: PermitRow,
  now: Date = new Date(),
  gasTests: GasTestRow[] = [],
): { ok: boolean; blockersFa: string[] } {
  const blockersFa: string[] = [];
  if (permit.Status !== "suspended") {
    blockersFa.push(`فقط پروانهٔ معلق قابل ازسرگیری است — وضعیت فعلی: ${PERMIT_STATUS_FA[permit.Status] ?? permit.Status}`);
  }
  /* پروانه‌ای که در مدت تعلیق منقضی شده، از سر گرفته نمی‌شود؛ تمدید لازم است. */
  const to = new Date(permit.ValidTo).getTime();
  if (Number.isFinite(to) && now.getTime() > to) {
    blockersFa.push("اعتبار پروانه در مدت تعلیق منقضی شده — تمدید لازم است");
  }

  /*
   * اگر گازسنجی برای این نوع پروانه اجباری است، ازسرگیری بدون قرائت
   * تازه و ایمن ممنوع است — وگرنه تعلیقی که خودِ گاز باعثش شده با یک
   * کلیک برداشته می‌شود. این قاعده عمداً در موتور است نه فقط در لایهٔ
   * وب، تا هر مصرف‌کنندهٔ دیگری هم آن را ببیند.
   *
   * وقتی سیاههٔ گازسنجی داده نشده، سکوت تأیید نیست: برای پروانهٔ
   * نیازمند گاز، نبودِ سیاهه خودش مانع است.
   */
  if (GAS_TEST_REQUIRED_PERMITS.includes(permit.PermitType as PermitType)) {
    const gas = latestGasTest(gasTests, permit.Id, now);
    if (!gas.test) {
      blockersFa.push("ازسرگیری این پروانه نیازمند گازسنجی ثبت‌شده است");
    } else if (!gas.isSafe) {
      blockersFa.push("آخرین گازسنجی خارج از محدودهٔ ایمن است");
    } else if (!gas.isFresh) {
      blockersFa.push(`گازسنجی ${gas.ageMinutes} دقیقه پیش انجام شده — قرائت تازه لازم است`);
    }
  }

  return { ok: blockersFa.length === 0, blockersFa };
}

/**
 * خلاصهٔ سامانهٔ پروانه برای داشبورد کنترل‌روم.
 *
 * کلیدهای شمارنده از پیش صفر می‌شوند تا مصرف‌کننده با کلید غایب نشکند.
 */
export function ptwSummary(args: {
  permits: PermitRow[];
  gasTests?: GasTestRow[];
  isolations?: IsolationRow[];
  now?: Date;
}): {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  activeNow: number;
  expiringSoon: number;
  expiredNotClosed: number;
  highRiskActive: number;
  unsafeGasTests: number;
  locksOnEquipment: number;
  warningsFa: string[];
} {
  const { permits, gasTests = [], isolations = [], now = new Date() } = args;

  const byStatus: Record<string, number> = {};
  for (const s of PERMIT_STATUSES) byStatus[s] = 0;
  const byType: Record<string, number> = {};
  for (const t of PERMIT_TYPES) byType[t] = 0;

  let activeNow = 0;
  let expiringSoon = 0;
  let expiredNotClosed = 0;
  let highRiskActive = 0;

  for (const p of permits) {
    const st = permitState(p, now);
    byStatus[st.effectiveStatus] = (byStatus[st.effectiveStatus] ?? 0) + 1;
    byType[p.PermitType] = (byType[p.PermitType] ?? 0) + 1;

    if (st.isValidNow) {
      activeNow += 1;
      if (HIGH_RISK_PERMITS.includes(p.PermitType as PermitType)) highRiskActive += 1;
      if (st.expiresInHours !== null && st.expiresInHours <= 4) expiringSoon += 1;
    }
    /* پروانه‌ای که تاریخش گذشته ولی کسی نبسته — بدهی عملیاتی. */
    if (st.effectiveStatus === "expired" && p.Status !== "closed") expiredNotClosed += 1;
  }

  const unsafeGasTests = gasTests.filter((t) => !evaluateGasTest(t).isSafe).length;
  const locksOnEquipment = isolations.filter((i) => i.Status === "applied").length;

  const warningsFa: string[] = [];
  if (expiredNotClosed > 0) {
    warningsFa.push(`${expiredNotClosed} پروانهٔ منقضی هنوز بسته نشده است`);
  }
  if (expiringSoon > 0) {
    warningsFa.push(`${expiringSoon} پروانه کمتر از ۴ ساعت اعتبار دارد`);
  }
  if (unsafeGasTests > 0) {
    warningsFa.push(`${unsafeGasTests} گازسنجی خارج از محدودهٔ ایمن ثبت شده است`);
  }

  return {
    total: permits.length,
    byStatus,
    byType,
    activeNow,
    expiringSoon,
    expiredNotClosed,
    highRiskActive,
    unsafeGasTests,
    locksOnEquipment,
    warningsFa,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 * بخش ۴ — حوادث، تحقیق و اقدام اصلاحی · تحویلی D5
 *
 * شکاف‌های هدف:
 *   GH-08  چند مصدوم در یک حادثه (امروز یک ستون متنی)
 *   GH-09  ریشه‌یابی ساختاریافته به‌جای یک پاراگراف
 *   GH-11  نفرساعت واقعی برای مخرج LTIFR/TRIR
 *
 * توابع بخش ۱ (`canCloseIncident`, `safetyMetrics`, `suggestSeverity`)
 * دست‌نخورده می‌مانند؛ نسخه‌های آگاه‌تر روی آنها سوار می‌شوند.
 * ═════════════════════════════════════════════════════════════════════ */

export const INJURY_TYPES = [
  "cut", "fracture", "burn", "poisoning", "crush", "sprain", "eye", "other",
] as const;
export type InjuryType = (typeof INJURY_TYPES)[number];

export const INJURY_TYPE_FA: Record<string, string> = {
  cut: "بریدگی",
  fracture: "شکستگی",
  burn: "سوختگی",
  poisoning: "مسمومیت",
  crush: "له‌شدگی",
  sprain: "کشیدگی و رگ‌به‌رگ",
  eye: "آسیب چشم",
  other: "سایر",
};

export const BODY_PARTS = [
  "head", "eye", "hand", "arm", "leg", "foot", "torso", "back", "multiple",
] as const;

export const BODY_PART_FA: Record<string, string> = {
  head: "سر",
  eye: "چشم",
  hand: "دست",
  arm: "بازو",
  leg: "پا",
  foot: "کف پا",
  torso: "تنه",
  back: "کمر",
  multiple: "چند ناحیه",
};

export const CAUSE_LEVELS = ["immediate", "underlying", "root"] as const;
export type CauseLevel = (typeof CAUSE_LEVELS)[number];

export const CAUSE_LEVEL_FA: Record<string, string> = {
  immediate: "علت بی‌واسطه",
  underlying: "علت زمینه‌ای",
  root: "علت ریشه‌ای",
};

/** استخوان ماهی — شش شاخهٔ استاندارد. */
export const CAUSE_CATEGORIES = [
  "man", "machine", "method", "material", "environment", "management",
] as const;
export type CauseCategory = (typeof CAUSE_CATEGORIES)[number];

export const CAUSE_CATEGORY_FA: Record<string, string> = {
  man: "نیروی انسانی",
  machine: "ماشین و تجهیزات",
  method: "روش اجرا",
  material: "مواد و مصالح",
  environment: "محیط",
  management: "مدیریت و سامانه",
};

export const CAPA_TYPES = ["corrective", "preventive"] as const;
export type CapaType = (typeof CAPA_TYPES)[number];

export const CAPA_TYPE_FA: Record<string, string> = {
  corrective: "اصلاحی",
  preventive: "پیشگیرانه",
};

export const CAPA_STATUSES = ["open", "in_progress", "completed", "verified", "cancelled"] as const;

export const CAPA_STATUS_FA: Record<string, string> = {
  open: "باز",
  in_progress: "در حال انجام",
  completed: "انجام‌شده",
  verified: "تأییدشده",
  cancelled: "لغوشده",
};

export const INVESTIGATION_STATUSES = ["open", "in_progress", "completed", "approved"] as const;

export const INVESTIGATION_STATUS_FA: Record<string, string> = {
  open: "باز",
  in_progress: "در حال بررسی",
  completed: "تکمیل‌شده",
  approved: "تأییدشده",
};

/** رویدادی که تحقیق رسمی لازم دارد — پایین‌تر از این، بررسی سرپرست کافی است. */
export const INVESTIGATION_REQUIRED_TYPES: IncidentType[] = [
  "lost_time", "fatality", "environmental",
];

/** مهلت گزارش فوری از لحظهٔ وقوع، به دقیقه. */
export const FLASH_REPORT_SLA_MINUTES = 15;

/** حداقل عمق درخت ریشه‌یابی برای حادثهٔ سنگین — «۵ چرا» یعنی دست‌کم ۳ لایه. */
export const MIN_ROOT_CAUSE_DEPTH = 3;

/** نسبت متعارف هزینهٔ غیرمستقیم به مستقیم (کوه یخ). */
export const ICEBERG_RATIO_MIN = 4;

export type InjuredPersonRow = {
  Id: string;
  ProjectId: string;
  IncidentId: string;
  PersonNo: number;
  PersonRef?: string | null;
  FullNameFa: string;
  CompanyFa?: string | null;
  InjuryType: string;
  BodyPart?: string | null;
  LostWorkDays?: number | null;
  RestrictedDays?: number | null;
  ReturnedToWork?: boolean | null;
  ReturnedAt?: string | null;
};

export type InvestigationRow = {
  Id: string;
  ProjectId: string;
  IncidentId: string;
  LeadInvestigator: string;
  StartedAt: string;
  CompletedAt?: string | null;
  MethodFa?: string | null;
  SummaryFa?: string | null;
  DirectCost?: number | null;
  IndirectCost?: number | null;
  LessonsLearnedFa?: string | null;
  ApprovedBy?: string | null;
  Status: string;
};

export type RootCauseNodeRow = {
  Id: string;
  ProjectId: string;
  InvestigationId: string;
  NodeNo: number;
  ParentId?: string | null;
  Depth: number;
  StatementFa: string;
  CauseLevel: string;
  Category?: string | null;
  IsVerified?: boolean | null;
};

export type CapaRow = {
  Id: string;
  ProjectId: string;
  SourceType: string;
  SourceId: string;
  ActionNo: number;
  ActionFa: string;
  ActionType: string;
  RootCauseNodeId?: string | null;
  OwnerRef: string;
  DueDate: string;
  CompletedAt?: string | null;
  VerifiedBy?: string | null;
  VerifiedAt?: string | null;
  Status: string;
};

export type ManHourRow = {
  Id: string;
  ProjectId: string;
  LogDate: string;
  ManHours: number;
  HeadCount?: number | null;
  ContractorFa?: string | null;
  SourceFa: string;
};

/* ── اعتبارسنجی ────────────────────────────────────────────────────── */

export function validateInjuredPersonInput(input: Partial<InjuredPersonRow>): ValidationIssue[] {
  const out: ValidationIssue[] = [];

  if (!String(input.FullNameFa ?? "").trim()) {
    out.push({ code: "E-HSE-INJURED-NAME-REQUIRED", message: "نام فرد مصدوم الزامی است" });
  }
  if (!INJURY_TYPES.includes(input.InjuryType as InjuryType)) {
    out.push({ code: "E-HSE-INJURY-TYPE", message: "نوع آسیب نامعتبر است" });
  }
  if (input.BodyPart != null && !BODY_PARTS.includes(input.BodyPart as (typeof BODY_PARTS)[number])) {
    out.push({ code: "E-HSE-BODY-PART", message: "ناحیهٔ آسیب نامعتبر است" });
  }
  for (const [field, label] of [["LostWorkDays", "روزهای از دست رفته"], ["RestrictedDays", "روزهای کار سبک"]] as const) {
    const v = input[field];
    if (v != null && (!Number.isFinite(Number(v)) || Number(v) < 0)) {
      out.push({ code: "E-HSE-DAYS-RANGE", message: `${label} نمی‌تواند منفی باشد` });
    }
  }

  return out;
}

export function validateRootCauseInput(input: Partial<RootCauseNodeRow>): ValidationIssue[] {
  const out: ValidationIssue[] = [];

  if (!String(input.StatementFa ?? "").trim()) {
    out.push({ code: "E-HSE-CAUSE-STATEMENT-REQUIRED", message: "شرح علت الزامی است" });
  }
  if (!CAUSE_LEVELS.includes(input.CauseLevel as CauseLevel)) {
    out.push({ code: "E-HSE-CAUSE-LEVEL", message: "سطح علت نامعتبر است" });
  }
  if (input.Category != null && !CAUSE_CATEGORIES.includes(input.Category as CauseCategory)) {
    out.push({ code: "E-HSE-CAUSE-CATEGORY", message: "دستهٔ علت نامعتبر است" });
  }

  return out;
}

export function validateCapaInput(input: Partial<CapaRow>): ValidationIssue[] {
  const out: ValidationIssue[] = [];

  if (!String(input.ActionFa ?? "").trim()) {
    out.push({ code: "E-HSE-CAPA-ACTION-REQUIRED", message: "شرح اقدام الزامی است" });
  }
  if (!CAPA_TYPES.includes(input.ActionType as CapaType)) {
    out.push({ code: "E-HSE-CAPA-TYPE", message: "نوع اقدام نامعتبر است" });
  }
  if (!String(input.OwnerRef ?? "").trim()) {
    out.push({ code: "E-HSE-CAPA-OWNER-REQUIRED", message: "مسئول اقدام الزامی است" });
  }
  if (!String(input.DueDate ?? "").trim()) {
    out.push({ code: "E-HSE-CAPA-DUE-REQUIRED", message: "مهلت اقدام الزامی است" });
  }

  return out;
}

/* ── گزارش فوری ────────────────────────────────────────────────────── */

/**
 * آیا گزارش فوری در مهلت انجام شد؟
 *
 * تأخیر اعلام مهم‌ترین نشانهٔ فرهنگ ایمنی ضعیف است: حادثه‌ای که دیر
 * اعلام شود، صحنه‌اش دست‌کاری شده و شواهدش از بین رفته.
 */
export function flashReportStatus(incident: IncidentRow, now: Date = new Date()): {
  reported: boolean;
  delayMinutes: number | null;
  withinSla: boolean;
  pendingMinutes: number | null;
  statusFa: string;
} {
  const occurred = new Date(incident.OccurredAt).getTime();
  const flash = (incident as { FlashReportAt?: string }).FlashReportAt;

  if (!Number.isFinite(occurred)) {
    return { reported: false, delayMinutes: null, withinSla: false, pendingMinutes: null, statusFa: "زمان وقوع نامعتبر" };
  }

  if (!flash) {
    const pending = round2((now.getTime() - occurred) / 60_000);
    return {
      reported: false,
      delayMinutes: null,
      /* گزارش‌نشده هرگز «در مهلت» نیست، حتی اگر تازه رخ داده باشد. */
      withinSla: false,
      pendingMinutes: pending >= 0 ? pending : null,
      statusFa: pending > FLASH_REPORT_SLA_MINUTES ? "گزارش فوری انجام نشده — مهلت گذشته" : "در انتظار گزارش فوری",
    };
  }

  const at = new Date(flash).getTime();
  if (!Number.isFinite(at)) {
    return { reported: false, delayMinutes: null, withinSla: false, pendingMinutes: null, statusFa: "زمان گزارش نامعتبر" };
  }

  const delay = round2((at - occurred) / 60_000);

  /* زمان گزارش پیش از زمان وقوع یعنی یکی از دو تاریخ اشتباه ثبت شده.
   * پیش از این «با -۳۰ دقیقه تأخیر» گزارش می‌شد که هم بی‌معناست و هم
   * خطای داده را پنهان می‌کرد. */
  if (delay < 0) {
    return {
      reported: true,
      delayMinutes: delay,
      withinSla: false,
      pendingMinutes: null,
      statusFa: "زمان گزارش پیش از زمان وقوع است — تاریخ‌ها را بررسی کنید",
    };
  }

  const withinSla = delay <= FLASH_REPORT_SLA_MINUTES;

  return {
    reported: true,
    delayMinutes: delay,
    withinSla,
    pendingMinutes: null,
    statusFa: withinSla ? "در مهلت گزارش شد" : `با ${delay} دقیقه تأخیر گزارش شد`,
  };
}

/* ── مصدومان ───────────────────────────────────────────────────────── */

/**
 * جمع‌بندی مصدومان یک حادثه.
 *
 * روز از دست رفته از جدول مصدومان خوانده می‌شود نه از ستون `LostDays`
 * حادثه: با دو مصدوم، ستون واحد نمی‌تواند هر دو را نگه دارد.
 */
export function injurySummary(persons: InjuredPersonRow[], incidentId: string): {
  count: number;
  totalLostDays: number;
  totalRestrictedDays: number;
  maxLostDays: number;
  returnedCount: number;
  stillOffWork: number;
  byInjuryType: Record<string, number>;
  byBodyPart: Record<string, number>;
} {
  const mine = persons.filter((p) => p.IncidentId === incidentId);

  const byInjuryType: Record<string, number> = {};
  for (const t of INJURY_TYPES) byInjuryType[t] = 0;
  const byBodyPart: Record<string, number> = {};
  for (const b of BODY_PARTS) byBodyPart[b] = 0;

  let totalLostDays = 0;
  let totalRestrictedDays = 0;
  let maxLostDays = 0;

  for (const p of mine) {
    byInjuryType[p.InjuryType] = (byInjuryType[p.InjuryType] ?? 0) + 1;
    if (p.BodyPart) byBodyPart[p.BodyPart] = (byBodyPart[p.BodyPart] ?? 0) + 1;
    const lost = Number(p.LostWorkDays ?? 0) || 0;
    totalLostDays += lost;
    totalRestrictedDays += Number(p.RestrictedDays ?? 0) || 0;
    if (lost > maxLostDays) maxLostDays = lost;
  }

  const returnedCount = mine.filter((p) => p.ReturnedToWork === true).length;

  return {
    count: mine.length,
    totalLostDays,
    totalRestrictedDays,
    maxLostDays,
    returnedCount,
    /* کسی که هنوز برنگشته و روز از دست رفته دارد. */
    stillOffWork: mine.filter((p) => p.ReturnedToWork !== true && (Number(p.LostWorkDays ?? 0) || 0) > 0).length,
    byInjuryType,
    byBodyPart,
  };
}

/* ── درخت ریشه‌یابی ────────────────────────────────────────────────── */

/**
 * تحلیل درخت ۵ چرا.
 *
 * گره یتیم (والدی که وجود ندارد) و حلقه را جدا گزارش می‌کند — هر دو
 * درخت را برای نمایش و پیمایش خراب می‌کنند.
 */
export function rootCauseTree(nodes: RootCauseNodeRow[], investigationId: string): {
  total: number;
  maxDepth: number;
  layerCount: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  rootCauses: RootCauseNodeRow[];
  verifiedRoots: number;
  orphanIds: string[];
  cyclicIds: string[];
  warningsFa: string[];
} {
  const mine = nodes.filter((n) => n.InvestigationId === investigationId);
  const byId = new Map(mine.map((n) => [n.Id, n]));

  const byLevel: Record<string, number> = {};
  for (const l of CAUSE_LEVELS) byLevel[l] = 0;
  const byCategory: Record<string, number> = {};
  for (const c of CAUSE_CATEGORIES) byCategory[c] = 0;

  let maxDepth = 0;
  const orphanIds: string[] = [];

  for (const n of mine) {
    byLevel[n.CauseLevel] = (byLevel[n.CauseLevel] ?? 0) + 1;
    if (n.Category) byCategory[n.Category] = (byCategory[n.Category] ?? 0) + 1;
    const d = Number(n.Depth ?? 0) || 0;
    if (d > maxDepth) maxDepth = d;
    if (n.ParentId && !byId.has(n.ParentId)) orphanIds.push(n.Id);
  }

  /* تشخیص حلقه: از هر گره بالا می‌رویم؛ اگر به خودمان برسیم یا از عمق
   * درخت بگذریم، حلقه است. */
  const cyclicIds: string[] = [];
  for (const n of mine) {
    const seen = new Set<string>([n.Id]);
    let cur = n.ParentId ? byId.get(n.ParentId) : undefined;
    let hops = 0;
    while (cur && hops <= mine.length) {
      if (seen.has(cur.Id)) {
        cyclicIds.push(n.Id);
        break;
      }
      seen.add(cur.Id);
      cur = cur.ParentId ? byId.get(cur.ParentId) : undefined;
      hops += 1;
    }
  }

  const rootCauses = mine.filter((n) => n.CauseLevel === "root");

  const warningsFa: string[] = [];
  if (orphanIds.length) warningsFa.push(`${orphanIds.length} گره والد ناموجود دارد`);
  if (cyclicIds.length) warningsFa.push(`${cyclicIds.length} گره در حلقهٔ ارجاعی است`);
  if (mine.length && !rootCauses.length) warningsFa.push("هیچ علت ریشه‌ای شناسایی نشده است");

  return {
    total: mine.length,
    maxDepth,
    /* تعداد لایه‌ها — مصرف‌کننده نباید خودش `maxDepth + 1` حساب کند. */
    layerCount: mine.length ? maxDepth + 1 : 0,
    byLevel,
    byCategory,
    rootCauses,
    verifiedRoots: rootCauses.filter((n) => n.IsVerified === true).length,
    orphanIds,
    cyclicIds,
    warningsFa,
  };
}

/* ── CAPA ──────────────────────────────────────────────────────────── */

/**
 * وضعیت اقدامات اصلاحی و پیشگیرانه.
 *
 * `verified` از `completed` جداست: «انجام شد» ادعای مسئول است،
 * «تأیید شد» یعنی کسی دیگر اثربخشی را دیده.
 */
export function capaSummary(actions: CapaRow[], now: Date = new Date()): {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  open: number;
  overdue: number;
  dueSoon: number;
  verified: number;
  hasPreventive: boolean;
  overdueFa: string[];
} {
  const byStatus: Record<string, number> = {};
  for (const s of CAPA_STATUSES) byStatus[s] = 0;
  const byType: Record<string, number> = {};
  for (const t of CAPA_TYPES) byType[t] = 0;

  let overdue = 0;
  let dueSoon = 0;
  const overdueFa: string[] = [];
  const t = now.getTime();

  for (const a of actions) {
    byStatus[a.Status] = (byStatus[a.Status] ?? 0) + 1;
    byType[a.ActionType] = (byType[a.ActionType] ?? 0) + 1;

    const isOpen = a.Status === "open" || a.Status === "in_progress";
    if (!isOpen) continue;

    const due = new Date(a.DueDate).getTime();
    if (!Number.isFinite(due)) continue;
    const days = (due - t) / 86_400_000;
    if (days < 0) {
      overdue += 1;
      overdueFa.push(`اقدام ${a.ActionNo}: ${a.ActionFa} — ${Math.abs(Math.round(days))} روز تأخیر`);
    } else if (days <= 7) {
      dueSoon += 1;
    }
  }

  return {
    total: actions.length,
    byStatus,
    byType,
    open: (byStatus.open ?? 0) + (byStatus.in_progress ?? 0),
    overdue,
    dueSoon,
    verified: byStatus.verified ?? 0,
    /* اقدام لغوشده به‌عنوان پیشگیرانه به حساب نمی‌آید. */
    hasPreventive: actions.some((a) => a.ActionType === "preventive" && a.Status !== "cancelled"),
    overdueFa,
  };
}

/* ── دروازه‌ها ─────────────────────────────────────────────────────── */

/** آیا این رویداد تحقیق رسمی لازم دارد؟ */
export function requiresInvestigation(incident: IncidentRow): {
  required: boolean;
  reasonFa: string | null;
} {
  const type = incident.IncidentType as IncidentType;
  if (INVESTIGATION_REQUIRED_TYPES.includes(type)) {
    return { required: true, reasonFa: `${INCIDENT_TYPE_FA[type] ?? type} تحقیق رسمی لازم دارد` };
  }
  if (incident.Severity === "critical" || incident.Severity === "high") {
    return { required: true, reasonFa: `شدت ${SEVERITY_FA[incident.Severity] ?? incident.Severity} تحقیق رسمی لازم دارد` };
  }
  /* شبه‌حادثه با پتانسیل بالا هم باید بررسی شود — همان بار دوم ممکن است
   * حادثه شود. این را هشدار می‌گذاریم نه الزام. */
  return { required: false, reasonFa: null };
}

/**
 * دروازهٔ بستن تحقیق.
 *
 * تحقیق بدون اقدام پیشگیرانه بسته نمی‌شود: اقدام صرفاً اصلاحی وضعیت
 * موجود را درست می‌کند ولی جلوی تکرار را نمی‌گیرد.
 */
export function canCloseInvestigation(args: {
  investigation: InvestigationRow;
  nodes?: RootCauseNodeRow[];
  actions?: CapaRow[];
  approverId?: string;
  requireDepth?: boolean;
}): { ok: boolean; blockersFa: string[]; warningsFa: string[] } {
  const { investigation, nodes = [], actions = [], approverId, requireDepth = true } = args;
  const blockersFa: string[] = [];
  const warningsFa: string[] = [];

  if (investigation.Status === "approved") {
    blockersFa.push("این تحقیق قبلاً تأیید شده است");
  }

  const tree = rootCauseTree(nodes, investigation.Id);
  if (!tree.total) {
    blockersFa.push("درخت ریشه‌یابی خالی است");
  } else {
    if (!tree.rootCauses.length) {
      blockersFa.push("هیچ علت ریشه‌ای شناسایی نشده است");
    }
    /* `Depth` صفرمبناست، پس تعداد لایه‌ها یکی بیشتر از بیشینهٔ عمق است.
     * قبلاً مستقیم `maxDepth` با آستانه مقایسه می‌شد و عملاً ۴ لایه
     * می‌خواست در حالی که پیام «۳ لایه» می‌گفت. */
    if (requireDepth && tree.layerCount < MIN_ROOT_CAUSE_DEPTH) {
      blockersFa.push(
        `ریشه‌یابی ${tree.layerCount} لایه دارد — دست‌کم ${MIN_ROOT_CAUSE_DEPTH} لایه لازم است`,
      );
    }
    if (tree.cyclicIds.length) {
      blockersFa.push(`${tree.cyclicIds.length} گره در حلقهٔ ارجاعی است و درخت معتبر نیست`);
    }
    warningsFa.push(...tree.warningsFa.filter((w) => !w.includes("حلقه") && !w.includes("ریشه‌ای")));
  }

  const mine = actions.filter((a) => a.SourceId === investigation.Id || a.SourceId === investigation.IncidentId);
  const capa = capaSummary(mine);
  if (!capa.total) {
    blockersFa.push("هیچ اقدام اصلاحی یا پیشگیرانه‌ای ثبت نشده است");
  } else if (!capa.hasPreventive) {
    blockersFa.push("دست‌کم یک اقدام پیشگیرانه لازم است — اقدام صرفاً اصلاحی جلوی تکرار را نمی‌گیرد");
  }

  if (capa.overdue > 0) {
    warningsFa.push(`${capa.overdue} اقدام دارای تأخیر است`);
  }

  if (approverId && approverId === investigation.LeadInvestigator) {
    blockersFa.push("تأییدکنندهٔ تحقیق نمی‌تواند همان سرپرست تحقیق باشد");
  }

  /* هزینهٔ غیرمستقیم صفر یعنی محاسبه نشده، نه اینکه واقعاً صفر بوده. */
  const direct = Number(investigation.DirectCost ?? 0) || 0;
  const indirect = Number(investigation.IndirectCost ?? 0) || 0;
  if (direct > 0 && indirect === 0) {
    warningsFa.push("هزینهٔ غیرمستقیم ثبت نشده — معمولاً چند برابر هزینهٔ مستقیم است");
  } else if (direct > 0 && indirect > 0 && indirect < direct * ICEBERG_RATIO_MIN) {
    warningsFa.push(
      `نسبت هزینهٔ غیرمستقیم به مستقیم کمتر از ${ICEBERG_RATIO_MIN} برابر است — احتمال کم‌برآوردی`,
    );
  }

  return { ok: blockersFa.length === 0, blockersFa, warningsFa };
}

/**
 * دروازهٔ بستن رویداد — نسخهٔ آگاه به رکوردهای وابسته.
 *
 * `canCloseIncident` بخش ۱ فقط دو ستون متنی را می‌سنجید. این نسخه
 * تحقیق و CAPA را هم می‌بیند و برای همین جدا نوشته شده تا مصرف‌کنندگان
 * قدیمی نشکنند.
 */
export function canCloseIncidentFull(args: {
  incident: IncidentRow;
  investigation?: InvestigationRow | null;
  nodes?: RootCauseNodeRow[];
  actions?: CapaRow[];
  persons?: InjuredPersonRow[];
  closerId?: string;
}): { ok: boolean; blockersFa: string[]; warningsFa: string[] } {
  const { incident, investigation = null, nodes = [], actions = [], persons = [], closerId } = args;
  const blockersFa: string[] = [];
  const warningsFa: string[] = [];

  if (incident.Status === "closed") {
    blockersFa.push("این رویداد قبلاً بسته شده است");
  }

  const need = requiresInvestigation(incident);
  if (need.required) {
    if (!investigation) {
      blockersFa.push(`${need.reasonFa} — تحقیقی ثبت نشده است`);
    } else if (investigation.Status !== "approved") {
      blockersFa.push(
        `تحقیق در وضعیت ${INVESTIGATION_STATUS_FA[investigation.Status] ?? investigation.Status} است و باید تأیید شود`,
      );
    } else {
      /* تحقیق «تأییدشده» با درخت ریشه‌یابی خالی یعنی تأیید صوری. */
      const tree = rootCauseTree(nodes, investigation.Id);
      if (!tree.rootCauses.length) {
        blockersFa.push("تحقیق تأیید شده ولی هیچ علت ریشه‌ای در درخت ثبت نشده است");
      } else if (!tree.verifiedRoots) {
        warningsFa.push("هیچ‌یک از علل ریشه‌ای راستی‌آزمایی نشده است");
      }
    }
  } else {
    /* رویداد سبک تحقیق رسمی لازم ندارد ولی علت و اقدام باید ثبت شود. */
    if (!String(incident.RootCauseFa ?? "").trim()) {
      blockersFa.push("ریشه‌یابی رویداد ثبت نشده است");
    }
    if (!String(incident.CorrectiveActionFa ?? "").trim()) {
      blockersFa.push("اقدام اصلاحی ثبت نشده است");
    }
  }

  const src = investigation
    ? actions.filter((a) => a.SourceId === incident.Id || a.SourceId === investigation.Id)
    : actions.filter((a) => a.SourceId === incident.Id);
  const capa = capaSummary(src);
  if (capa.open > 0) {
    blockersFa.push(`${capa.open} اقدام اصلاحی هنوز باز است`);
  }

  /* مصدومی که هنوز سر کار برنگشته یعنی پروندهٔ پزشکی باز است. */
  const inj = injurySummary(persons, incident.Id);
  if (inj.stillOffWork > 0) {
    warningsFa.push(`${inj.stillOffWork} مصدوم هنوز به کار بازنگشته است`);
  }

  if (closerId && closerId === incident.ReportedBy) {
    warningsFa.push("رویداد به‌دست گزارش‌دهنده بسته می‌شود");
  }

  const flash = flashReportStatus(incident);
  if (flash.reported && !flash.withinSla) {
    warningsFa.push(`گزارش فوری با ${flash.delayMinutes} دقیقه تأخیر انجام شده بود`);
  }

  return { ok: blockersFa.length === 0, blockersFa, warningsFa };
}

/* ── نفرساعت و شاخص ────────────────────────────────────────────────── */

/**
 * جمع نفرساعت در بازه.
 *
 * بدون بازه، همهٔ سیاهه‌ها جمع می‌شوند. تاریخ نامعتبر نادیده گرفته
 * می‌شود ولی شمرده می‌شود تا کاربر بداند داده‌اش مشکل دارد.
 */
export function manHourTotal(logs: ManHourRow[], from?: string, to?: string): {
  totalHours: number;
  dayCount: number;
  invalidCount: number;
  avgHeadCount: number | null;
  bySource: Record<string, number>;
} {
  const f = from ? new Date(from).getTime() : null;
  const t = to ? new Date(to).getTime() : null;

  let totalHours = 0;
  let invalidCount = 0;
  let headSum = 0;
  let headDays = 0;
  const days = new Set<string>();
  const bySource: Record<string, number> = { manual: 0, timesheet: 0 };

  for (const l of logs) {
    const d = new Date(l.LogDate).getTime();
    const h = Number(l.ManHours);
    if (!Number.isFinite(d) || !Number.isFinite(h) || h < 0) {
      invalidCount += 1;
      continue;
    }
    if (f !== null && d < f) continue;
    if (t !== null && d > t) continue;

    totalHours += h;
    days.add(String(l.LogDate));
    bySource[l.SourceFa] = (bySource[l.SourceFa] ?? 0) + h;

    const hc = Number(l.HeadCount ?? 0);
    if (Number.isFinite(hc) && hc > 0) {
      headSum += hc;
      headDays += 1;
    }
  }

  return {
    totalHours: round2(totalHours),
    dayCount: days.size,
    invalidCount,
    avgHeadCount: headDays ? round2(headSum / headDays) : null,
    bySource,
  };
}

/**
 * شاخص‌های ایمنی با مصدومان واقعی و نفرساعت واقعی.
 *
 * تفاوت با `safetyMetrics` بخش ۱:
 *   • روز از دست رفته از جدول مصدومان می‌آید نه ستون واحد حادثه
 *   • مخرج از سیاههٔ نفرساعت می‌آید نه پارامتر دستی
 *   • شدت (Severity Rate) هم محاسبه می‌شود
 *
 * تابع بخش ۱ حذف نشده چون مصرف‌کننده دارد.
 */
export function safetyMetricsFull(args: {
  incidents: IncidentRow[];
  persons?: InjuredPersonRow[];
  manHourLogs?: ManHourRow[];
  from?: string;
  to?: string;
}): {
  total: number;
  byType: Record<string, number>;
  recordable: number;
  lostTime: number;
  lostDays: number;
  restrictedDays: number;
  injuredCount: number;
  nearMiss: number;
  openCount: number;
  manHours: number | null;
  ltifr: number | null;
  trir: number | null;
  severityRate: number | null;
  warningsFa: string[];
} {
  const { incidents: allIncidents, persons = [], manHourLogs = [], from, to } = args;

  /* بازه باید روی رویدادها هم اعمال شود، نه فقط روی نفرساعت. پیش از
   * این صورتِ کسر همهٔ رویدادهای تاریخ پروژه بود و مخرج فقط نفرساعت
   * بازه — یعنی نرخ ماهانه چند برابر واقع گزارش می‌شد. */
  const f = from ? new Date(from).getTime() : null;
  const t2 = to ? new Date(to).getTime() : null;
  const incidents = (f === null && t2 === null)
    ? allIncidents
    : allIncidents.filter((i) => {
        const d = new Date(i.OccurredAt).getTime();
        if (!Number.isFinite(d)) return false;
        if (f !== null && d < f) return false;
        /* `to` روزِ پایان را کامل در بر می‌گیرد. */
        if (t2 !== null && d > t2 + 86_399_999) return false;
        return true;
      });

  const byType: Record<string, number> = {};
  for (const t of INCIDENT_TYPES) byType[t] = 0;
  for (const i of incidents) byType[i.IncidentType] = (byType[i.IncidentType] ?? 0) + 1;

  const incidentIds = new Set(incidents.map((i) => i.Id));
  const mine = persons.filter((p) => incidentIds.has(p.IncidentId));

  let lostDays = 0;
  let restrictedDays = 0;
  for (const p of mine) {
    lostDays += Number(p.LostWorkDays ?? 0) || 0;
    restrictedDays += Number(p.RestrictedDays ?? 0) || 0;
  }

  /* اگر مصدومی ثبت نشده، به ستون قدیمی برمی‌گردیم تا دادهٔ تاریخی از
   * دست نرود. */
  const warningsFa: string[] = [];
  if (!mine.length) {
    let legacy = 0;
    for (const i of incidents) legacy += Number(i.LostDays ?? 0) || 0;
    if (legacy > 0) {
      lostDays = legacy;
      warningsFa.push("روزهای از دست رفته از ستون قدیمی خوانده شد — جدول مصدومان خالی است");
    }
  }

  const recordable = incidents.filter((i) => RECORDABLE_TYPES.includes(i.IncidentType as IncidentType)).length;
  const lostTime = incidents.filter((i) => LOST_TIME_TYPES.includes(i.IncidentType as IncidentType)).length;

  const mh = manHourTotal(manHourLogs, from, to);
  const usable = mh.totalHours > 0 ? mh.totalHours : null;
  if (!usable) {
    warningsFa.push("نفرساعت ثبت نشده — شاخص‌های نسبی محاسبه نمی‌شوند");
  }
  if (mh.invalidCount > 0) {
    warningsFa.push(`${mh.invalidCount} سیاههٔ نفرساعت نامعتبر نادیده گرفته شد`);
  }

  return {
    total: incidents.length,
    byType,
    recordable,
    lostTime,
    lostDays,
    restrictedDays,
    injuredCount: mine.length,
    nearMiss: byType.near_miss ?? 0,
    openCount: incidents.filter((i) => i.Status !== "closed").length,
    manHours: usable,
    ltifr: usable ? round2((lostTime * 1_000_000) / usable) : null,
    trir: usable ? round2((recordable * 200_000) / usable) : null,
    /* نرخ شدت: روز از دست رفته به ازای یک میلیون نفرساعت. */
    severityRate: usable ? round2((lostDays * 1_000_000) / usable) : null,
    warningsFa,
  };
}

/* ════════════════════════════════════════════════════════════════════
 * بخش ۵ — بازرسی، تخلف و دستور توقف کار (D6، زیرماژول ۰۸٫۴)
 *
 * این بخش تنها جایی است که ماژول HSE اهرم اجرایی پیدا می‌کند: تا پیش
 * از این می‌شد خطر را ثبت کرد ولی نمی‌شد کار را متوقف کرد (شکاف GH-04).
 * ════════════════════════════════════════════════════════════════════ */

/** دسته‌های یافتهٔ بازرسی. */
export const FINDING_CATEGORIES = [
  "unsafe_act", "unsafe_condition", "housekeeping", "ppe", "documentation", "environmental",
] as const;

export const FINDING_CATEGORY_FA: Record<string, string> = {
  unsafe_act: "رفتار ناایمن",
  unsafe_condition: "شرایط ناایمن",
  housekeeping: "نظم و نظافت",
  ppe: "تجهیزات حفاظت فردی",
  documentation: "مستندات",
  environmental: "زیست‌محیطی",
};

/** انواع تخلف. */
export const VIOLATION_TYPES = [
  "unsafe_act", "unsafe_condition", "no_ptw", "ppe_missing", "environmental", "housekeeping",
] as const;

export const VIOLATION_TYPE_FA: Record<string, string> = {
  unsafe_act: "رفتار ناایمن",
  unsafe_condition: "شرایط ناایمن",
  no_ptw: "کار بدون پروانه",
  ppe_missing: "نبود تجهیزات حفاظت فردی",
  environmental: "تخلف زیست‌محیطی",
  housekeeping: "بی‌نظمی کارگاه",
};

/** دامنهٔ توقف کار. */
export const STOP_WORK_SCOPES = ["activity", "area", "system", "project"] as const;

export const STOP_WORK_SCOPE_FA: Record<string, string> = {
  activity: "فعالیت",
  area: "منطقه",
  system: "سیستم",
  project: "کل پروژه",
};

export const VIOLATION_STATUSES = ["issued", "in_progress", "re_inspected", "closed", "void"] as const;

export const VIOLATION_STATUS_FA: Record<string, string> = {
  issued: "صادرشده",
  in_progress: "در حال رفع",
  re_inspected: "بازبینی‌شده",
  closed: "بسته‌شده",
  void: "ابطال‌شده",
};

export const FINDING_STATUSES = ["open", "in_progress", "closed", "void"] as const;

export const FINDING_STATUS_FA: Record<string, string> = {
  open: "باز",
  in_progress: "در حال رفع",
  closed: "بسته‌شده",
  void: "ابطال‌شده",
};

/**
 * انواع تخلفی که توقف کار برایشان اجباری است.
 *
 * کار بدون پروانه استثنا ندارد: خودِ نبودِ پروانه یعنی هیچ ارزیابی
 * خطری انجام نشده، پس ادامهٔ کار قمار است.
 */
export const MANDATORY_STOP_WORK_TYPES: string[] = ["no_ptw"];

/** مهلت متعارف رفع تخلف بر حسب شدت، به روز. */
export const VIOLATION_SLA_DAYS: Record<string, number> = {
  critical: 1,
  high: 3,
  medium: 7,
  low: 14,
};

/** حداقل امتیاز قابل‌قبول بازرسی. زیر این عدد بازرسی مجدد لازم است. */
export const INSPECTION_PASS_SCORE = 80;

/* `InspectionRow` در بخش ۱ تعریف شده و همان است — دوباره اعلام نمی‌شود. */

export type FindingRow = {
  Id: string;
  ProjectId: string;
  InspectionId: string;
  FindingNo: number;
  DescriptionFa: string;
  Category: string;
  Severity: string;
  AreaFa?: string | null;
  ActivityId?: string | null;
  OwnerRef?: string | null;
  DueDate?: string | null;
  ClosedAt?: string | null;
  ClosedBy?: string | null;
  Status: string;
};

export type ViolationRow = {
  Id: string;
  ProjectId: string;
  ViolationNo: string;
  TitleFa: string;
  ViolationType: string;
  Severity: string;
  IssuedAt: string;
  IssuedBy: string;
  AreaFa?: string | null;
  ActivityId?: string | null;
  SystemId?: string | null;
  PermitId?: string | null;
  InspectionId?: string | null;
  FindingId?: string | null;
  ContractorFa?: string | null;
  OffenderRef?: string | null;
  IsStopWork?: boolean | null;
  StopWorkScope?: string | null;
  FineAmount?: number | null;
  DueDate?: string | null;
  Status: string;
};

export type ClosureRow = {
  Id: string;
  ProjectId: string;
  ViolationId: string;
  AttemptNo: number;
  ReInspectedAt: string;
  ReInspectedBy: string;
  IsSatisfactory?: boolean | null;
  EvidenceFa?: string | null;
  ReleasedBy?: string | null;
  ReleasedAt?: string | null;
  RejectReasonFa?: string | null;
};

/* ── اعتبارسنجی ورودی ──────────────────────────────────────────────── */

export function validateFindingInput(input: Partial<FindingRow>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!String(input.DescriptionFa ?? "").trim()) {
    issues.push({ code: "E-HSE-FINDING-DESC", message: "شرح یافته الزامی است" });
  }
  if (!FINDING_CATEGORIES.includes(input.Category as (typeof FINDING_CATEGORIES)[number])) {
    issues.push({ code: "E-HSE-FINDING-CATEGORY", message: "دستهٔ یافته نامعتبر است" });
  }
  if (!SEVERITIES.includes(input.Severity as (typeof SEVERITIES)[number])) {
    issues.push({ code: "E-HSE-FINDING-SEVERITY", message: "شدت یافته نامعتبر است" });
  }
  return issues;
}

export function validateViolationInput(input: Partial<ViolationRow>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!String(input.ViolationNo ?? "").trim()) {
    issues.push({ code: "E-HSE-VIOLATION-NO", message: "شمارهٔ تخلف الزامی است" });
  }
  if (!String(input.TitleFa ?? "").trim()) {
    issues.push({ code: "E-HSE-VIOLATION-TITLE", message: "عنوان تخلف الزامی است" });
  }
  if (!VIOLATION_TYPES.includes(input.ViolationType as (typeof VIOLATION_TYPES)[number])) {
    issues.push({ code: "E-HSE-VIOLATION-TYPE", message: "نوع تخلف نامعتبر است" });
  }
  if (!SEVERITIES.includes(input.Severity as (typeof SEVERITIES)[number])) {
    issues.push({ code: "E-HSE-VIOLATION-SEVERITY", message: "شدت تخلف نامعتبر است" });
  }
  if (!String(input.IssuedBy ?? "").trim()) {
    issues.push({ code: "E-HSE-VIOLATION-ISSUER", message: "صادرکنندهٔ تخلف الزامی است" });
  }
  if (input.IssuedAt && !Number.isFinite(new Date(input.IssuedAt).getTime())) {
    issues.push({ code: "E-HSE-VIOLATION-DATE", message: "زمان صدور نامعتبر است" });
  }

  if (input.IsStopWork === true) {
    if (!STOP_WORK_SCOPES.includes(input.StopWorkScope as (typeof STOP_WORK_SCOPES)[number])) {
      issues.push({ code: "E-HSE-SWO-SCOPE", message: "دامنهٔ توقف کار الزامی و باید معتبر باشد" });
    }
    /* توقف در سطح فعالیت بدون شناسهٔ فعالیت قابل اعمال نیست: هیچ‌چیز
     * قفل نمی‌شود و کاربر خیال می‌کند کار متوقف شده. */
    if (input.StopWorkScope === "activity" && !String(input.ActivityId ?? "").trim()) {
      issues.push({ code: "E-HSE-SWO-ACTIVITY", message: "توقف در سطح فعالیت بدون شناسهٔ فعالیت معنا ندارد" });
    }
    if (input.StopWorkScope === "system" && !String(input.SystemId ?? "").trim()) {
      issues.push({ code: "E-HSE-SWO-SYSTEM", message: "توقف در سطح سیستم بدون شناسهٔ سیستم معنا ندارد" });
    }
    if (input.StopWorkScope === "area" && !String(input.AreaFa ?? "").trim()) {
      issues.push({ code: "E-HSE-SWO-AREA", message: "توقف در سطح منطقه بدون نام منطقه معنا ندارد" });
    }
  }

  const fine = Number(input.FineAmount ?? 0);
  if (input.FineAmount != null && (!Number.isFinite(fine) || fine < 0)) {
    issues.push({ code: "E-HSE-VIOLATION-FINE", message: "مبلغ جریمه نمی‌تواند منفی باشد" });
  }

  return issues;
}

/**
 * آیا این تخلف باید توقف کار داشته باشد؟
 *
 * تصمیم نهایی با بازرس است، ولی موتور برای دو حالت الزام می‌گذارد تا
 * فشار پیمانکار نتواند تخلف بحرانی را «بدون توقف» ثبت کند.
 */
export function stopWorkRequirement(input: Partial<ViolationRow>): {
  required: boolean;
  reasonFa: string | null;
} {
  if (MANDATORY_STOP_WORK_TYPES.includes(String(input.ViolationType))) {
    return {
      required: true,
      reasonFa: `${VIOLATION_TYPE_FA[String(input.ViolationType)]} بدون استثنا توقف کار دارد`,
    };
  }
  if (input.Severity === "critical") {
    return { required: true, reasonFa: "تخلف با شدت بحرانی توقف کار دارد" };
  }
  return { required: false, reasonFa: null };
}

/** مهلت پیشنهادی رفع بر پایهٔ شدت. */
export function suggestViolationDueDate(severity: string, issuedAt: string): string | null {
  const days = VIOLATION_SLA_DAYS[severity];
  const t = new Date(issuedAt).getTime();
  if (days == null || !Number.isFinite(t)) return null;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/* ── وضعیت و تجمیع ─────────────────────────────────────────────────── */

/** خلاصهٔ یافته‌های یک بازرسی. */
export function findingSummary(findings: FindingRow[], inspectionId: string, now: Date = new Date()): {
  total: number;
  open: number;
  closed: number;
  overdue: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  closureRatePct: number | null;
  hasCritical: boolean;
  overdueFa: string[];
} {
  const mine = findings.filter((f) => f.InspectionId === inspectionId);

  const byCategory: Record<string, number> = {};
  for (const c of FINDING_CATEGORIES) byCategory[c] = 0;
  const bySeverity: Record<string, number> = {};
  for (const s of SEVERITIES) bySeverity[s] = 0;

  let open = 0;
  let closed = 0;
  let overdue = 0;
  const overdueFa: string[] = [];
  const today = now.getTime();

  for (const f of mine) {
    byCategory[f.Category] = (byCategory[f.Category] ?? 0) + 1;
    bySeverity[f.Severity] = (bySeverity[f.Severity] ?? 0) + 1;

    if (f.Status === "closed") {
      closed += 1;
      continue;
    }
    /* یافتهٔ باطل‌شده نه باز است نه بسته — از مخرج درصد بستن هم بیرون
     * می‌ماند وگرنه با ابطال می‌شد درصد را بالا برد. */
    if (f.Status === "void") continue;

    open += 1;
    const due = f.DueDate ? new Date(f.DueDate).getTime() : null;
    if (due != null && Number.isFinite(due) && due < today) {
      overdue += 1;
      overdueFa.push(`یافتهٔ ${f.FindingNo}: ${f.DescriptionFa.slice(0, 40)}`);
    }
  }

  const denominator = open + closed;

  return {
    total: mine.length,
    open,
    closed,
    overdue,
    byCategory,
    bySeverity,
    closureRatePct: denominator ? round2((closed * 100) / denominator) : null,
    hasCritical: mine.some((f) => f.Severity === "critical" && f.Status !== "closed" && f.Status !== "void"),
    overdueFa,
  };
}

/**
 * وضعیت مؤثر تخلف.
 *
 * مثل پروانهٔ کار، وضعیت ذخیره‌شده تنها منبع حقیقت نیست: تخلفی که
 * مهلتش گذشته «معوق» است حتی اگر ستون وضعیت هنوز «در حال رفع» باشد.
 */
export function violationState(violation: ViolationRow, now: Date = new Date()): {
  status: string;
  statusFa: string;
  isOpen: boolean;
  isBlocking: boolean;
  isEnforceable: boolean;
  enforcementIssueFa: string | null;
  isOverdue: boolean;
  overdueDays: number | null;
  slaFa: string;
} {
  const status = violation.Status;
  const isClosed = status === "closed" || status === "void";
  const isOpen = !isClosed;
  /* قفل فقط تا وقتی برقرار است که تخلف باز باشد؛ تخلف بسته دیگر
   * فعالیت را متوقف نمی‌کند. */
  const isBlocking = isOpen && violation.IsStopWork === true;

  /* توقف کار «قابل اعمال» یعنی دامنه‌اش معتبر است و مرجعی که باید قفل
   * شود واقعاً ذکر شده. بدون این بررسی، تخلفی با دامنهٔ ناشناخته یا
   * مرجع تهی در آمار «توقف کار فعال» شمرده می‌شد ولی هیچ فعالیتی را
   * قفل نمی‌کرد — یعنی داشبورد می‌گفت کار متوقف است در حالی که ادامه
   * داشت. اعتبارسنجی ورودی جلوی ساخت چنین ردیفی را می‌گیرد، ولی دادهٔ
   * قدیمی یا نوشتن مستقیم در جدول همچنان می‌تواند بسازد. */
  let isEnforceable = true;
  let enforcementIssueFa: string | null = null;
  if (isBlocking) {
    const scope = violation.StopWorkScope;
    if (!scope) {
      isEnforceable = false;
      enforcementIssueFa = "توقف کار بدون دامنه ثبت شده و هیچ کاری را متوقف نمی‌کند";
    } else if (!STOP_WORK_SCOPES.includes(scope as (typeof STOP_WORK_SCOPES)[number])) {
      isEnforceable = false;
      enforcementIssueFa = `دامنهٔ توقف کار «${scope}» شناخته‌شده نیست`;
    } else if (scope === "activity" && !String(violation.ActivityId ?? "").trim()) {
      isEnforceable = false;
      enforcementIssueFa = "توقف در سطح فعالیت بدون شناسهٔ فعالیت اعمال نمی‌شود";
    } else if (scope === "system" && !String(violation.SystemId ?? "").trim()) {
      isEnforceable = false;
      enforcementIssueFa = "توقف در سطح سیستم بدون شناسهٔ سیستم اعمال نمی‌شود";
    } else if (scope === "area" && !String(violation.AreaFa ?? "").trim()) {
      isEnforceable = false;
      enforcementIssueFa = "توقف در سطح منطقه بدون نام منطقه اعمال نمی‌شود";
    }
  }

  let isOverdue = false;
  let overdueDays: number | null = null;
  if (isOpen && violation.DueDate) {
    const due = new Date(violation.DueDate).getTime();
    if (Number.isFinite(due)) {
      const diff = Math.floor((now.getTime() - due) / 86_400_000);
      if (diff > 0) {
        isOverdue = true;
        overdueDays = diff;
      }
    }
  }

  return {
    status,
    statusFa: VIOLATION_STATUS_FA[status] ?? status,
    isOpen,
    isBlocking,
    isEnforceable,
    enforcementIssueFa,
    isOverdue,
    overdueDays,
    slaFa: isOverdue ? `${overdueDays} روز از مهلت گذشته` : isOpen ? "در مهلت" : "بسته",
  };
}

/**
 * آیا فعالیت به‌خاطر تخلف قفل است؟
 *
 * توقف در سطح منطقه یا سیستم هم فعالیت را می‌گیرد، نه فقط توقف مستقیم
 * روی شناسهٔ فعالیت — وگرنه با تغییر دامنه می‌شد قفل را دور زد.
 */
export function activityStopWorkState(args: {
  activityId: string;
  violations: ViolationRow[];
  areaFa?: string | null;
  systemId?: string | null;
  now?: Date;
}): {
  activityId: string;
  isLocked: boolean;
  blockingIds: string[];
  reasonsFa: string[];
  unenforceableFa: string[];
} {
  const now = args.now ?? new Date();
  const blockingIds: string[] = [];
  const reasonsFa: string[] = [];

  const unenforceableFa: string[] = [];

  for (const v of args.violations) {
    const st = violationState(v, now);
    if (!st.isBlocking) continue;

    /* توقف کار غیرقابل‌اعمال جداگانه گزارش می‌شود تا بی‌صدا نادیده
     * گرفته نشود: کاربر باید بداند دستوری صادر شده که اثر ندارد. */
    if (!st.isEnforceable) {
      unenforceableFa.push(`تخلف ${v.ViolationNo}: ${st.enforcementIssueFa}`);
      continue;
    }

    const scope = v.StopWorkScope as string;
    let hits = false;
    if (scope === "project") hits = true;
    else if (scope === "activity") hits = v.ActivityId === args.activityId;
    else if (scope === "area") hits = v.AreaFa === args.areaFa;
    else if (scope === "system") hits = v.SystemId === args.systemId;

    if (!hits) continue;
    blockingIds.push(v.Id);
    reasonsFa.push(
      `تخلف ${v.ViolationNo} (${VIOLATION_TYPE_FA[v.ViolationType] ?? v.ViolationType}) — توقف در سطح ${STOP_WORK_SCOPE_FA[scope] ?? scope}`,
    );
  }

  return {
    activityId: args.activityId,
    isLocked: blockingIds.length > 0,
    blockingIds,
    reasonsFa,
    unenforceableFa,
  };
}

/* ── دروازه‌ها ─────────────────────────────────────────────────────── */

/**
 * دروازهٔ آزادسازی تخلف.
 *
 * تفکیک وظیفه اینجا سه‌طرفه است: آزادکننده نباید صادرکننده باشد (وگرنه
 * بازرس می‌تواند تخلف صوری بزند و خودش ببندد)، نباید متخلف باشد، و
 * نباید بازبین همان تلاش باشد.
 */
export function canReleaseViolation(args: {
  violation: ViolationRow;
  closures?: ClosureRow[];
  actions?: CapaRow[];
  releaserId?: string;
}): { ok: boolean; blockersFa: string[]; warningsFa: string[] } {
  const { violation, closures = [], actions = [], releaserId } = args;
  const blockersFa: string[] = [];
  const warningsFa: string[] = [];

  if (violation.Status === "closed") {
    blockersFa.push("این تخلف قبلاً بسته شده است");
  }
  if (violation.Status === "void") {
    blockersFa.push("تخلف ابطال‌شده قابل آزادسازی نیست");
  }

  const mine = closures
    .filter((c) => c.ViolationId === violation.Id)
    .sort((a, b) => Number(a.AttemptNo) - Number(b.AttemptNo));

  const last = mine.at(-1);
  if (!last) {
    blockersFa.push("بازبینی مجدد انجام نشده است");
  } else if (last.IsSatisfactory !== true) {
    blockersFa.push(`آخرین بازبینی (تلاش ${last.AttemptNo}) نتیجهٔ رضایت‌بخش نداشت`);
  }

  if (releaserId) {
    if (releaserId === violation.IssuedBy) {
      blockersFa.push("آزادکننده نمی‌تواند همان صادرکنندهٔ تخلف باشد");
    }
    if (violation.OffenderRef && releaserId === violation.OffenderRef) {
      blockersFa.push("متخلف نمی‌تواند تخلف خودش را آزاد کند");
    }
    if (last && releaserId === last.ReInspectedBy) {
      warningsFa.push("آزادکننده همان بازبین است — بهتر است دو نفر جدا باشند");
    }
  }

  /* تخلف با توقف کار بدون اقدام اصلاحی ثبت‌شده یعنی علت هنوز پابرجاست
   * و کار دوباره متوقف خواهد شد. */
  if (violation.IsStopWork === true) {
    const mineActions = actions.filter((a) => a.SourceType === "violation" && a.SourceId === violation.Id);
    if (!mineActions.length) {
      blockersFa.push("تخلف دارای توقف کار بدون اقدام اصلاحی ثبت‌شده آزاد نمی‌شود");
    } else {
      const stillOpen = mineActions.filter((a) => a.Status === "open" || a.Status === "in_progress");
      if (stillOpen.length) {
        blockersFa.push(`${stillOpen.length} اقدام اصلاحی این تخلف هنوز باز است`);
      }
    }
  }

  if (mine.length > 2) {
    warningsFa.push(`${mine.length} بار بازبینی لازم شد — نشانهٔ ضعف نظام‌مند پیمانکار`);
  }

  const st = violationState(violation);
  if (st.isOverdue) {
    warningsFa.push(`رفع تخلف ${st.overdueDays} روز از مهلت گذشت`);
  }

  return { ok: blockersFa.length === 0, blockersFa, warningsFa };
}

/**
 * دروازهٔ بستن بازرسی.
 *
 * بازرسی با یافتهٔ باز بسته نمی‌شود: بستن بازرسی یعنی «همه‌چیز رسیدگی
 * شد» و اگر یافته‌ای باز بماند، از رادار خارج می‌شود.
 */
export function canCloseInspection(args: {
  inspection: InspectionRow;
  findings?: FindingRow[];
  violations?: ViolationRow[];
  now?: Date;
}): { ok: boolean; blockersFa: string[]; warningsFa: string[] } {
  const { inspection, findings = [], violations = [], now = new Date() } = args;
  const blockersFa: string[] = [];
  const warningsFa: string[] = [];

  if (inspection.Status === "closed") {
    blockersFa.push("این بازرسی قبلاً بسته شده است");
  }

  const sum = findingSummary(findings, inspection.Id, now);
  if (sum.open > 0) {
    blockersFa.push(`${sum.open} یافتهٔ باز دارد`);
  }

  const openViolations = violations.filter(
    (v) => v.InspectionId === inspection.Id && violationState(v, now).isOpen,
  );
  if (openViolations.length) {
    blockersFa.push(`${openViolations.length} تخلف صادرشده از این بازرسی هنوز باز است`);
  }

  const score = Number(inspection.ScorePct ?? NaN);
  if (Number.isFinite(score) && score < INSPECTION_PASS_SCORE) {
    warningsFa.push(`امتیاز ${score} زیر حد قبولی ${INSPECTION_PASS_SCORE} است — بازرسی مجدد توصیه می‌شود`);
  }
  if (sum.total === 0) {
    warningsFa.push("هیچ یافته‌ای ثبت نشده — بازرسی بدون یافته معمولاً یعنی بازرسی سطحی");
  }

  return { ok: blockersFa.length === 0, blockersFa, warningsFa };
}

/**
 * خلاصهٔ تخلفات یک پروژه.
 *
 * `stopWorkActive` عدد کلیدی مدیریت است: چند کار همین حالا متوقف است.
 */
export function violationSummary(violations: ViolationRow[], now: Date = new Date()): {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  open: number;
  overdue: number;
  stopWorkTotal: number;
  stopWorkActive: number;
  stopWorkUnenforceable: number;
  totalFine: number;
  repeatOffendersFa: string[];
  unenforceableFa: string[];
  warningsFa: string[];
} {
  const byStatus: Record<string, number> = {};
  for (const s of VIOLATION_STATUSES) byStatus[s] = 0;
  const byType: Record<string, number> = {};
  for (const t of VIOLATION_TYPES) byType[t] = 0;
  const bySeverity: Record<string, number> = {};
  for (const s of SEVERITIES) bySeverity[s] = 0;

  let open = 0;
  let overdue = 0;
  let stopWorkTotal = 0;
  let stopWorkActive = 0;
  let stopWorkUnenforceable = 0;
  let totalFine = 0;
  const unenforceableFa: string[] = [];
  const byContractor: Record<string, number> = {};

  for (const v of violations) {
    byStatus[v.Status] = (byStatus[v.Status] ?? 0) + 1;
    byType[v.ViolationType] = (byType[v.ViolationType] ?? 0) + 1;
    bySeverity[v.Severity] = (bySeverity[v.Severity] ?? 0) + 1;

    const st = violationState(v, now);
    if (st.isOpen) open += 1;
    if (st.isOverdue) overdue += 1;
    if (v.IsStopWork === true) stopWorkTotal += 1;
    if (st.isBlocking) {
      stopWorkActive += 1;
      if (!st.isEnforceable) {
        stopWorkUnenforceable += 1;
        unenforceableFa.push(`تخلف ${v.ViolationNo}: ${st.enforcementIssueFa}`);
      }
    }

    /* جریمهٔ تخلف باطل‌شده وصول نمی‌شود. */
    if (v.Status !== "void") {
      const fine = Number(v.FineAmount ?? 0);
      if (Number.isFinite(fine) && fine > 0) totalFine += fine;
    }

    const c = String(v.ContractorFa ?? "").trim();
    if (c) byContractor[c] = (byContractor[c] ?? 0) + 1;
  }

  /* پیمانکار با سه تخلف یا بیشتر، مسئلهٔ نظام‌مند دارد نه اتفاقی. */
  const repeatOffendersFa = Object.entries(byContractor)
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `${name}: ${n} تخلف`);

  const warningsFa: string[] = [];
  if (stopWorkActive > 0) {
    warningsFa.push(`${stopWorkActive} توقف کار فعال است`);
  }
  if (overdue > 0) {
    warningsFa.push(`${overdue} تخلف از مهلت رفع گذشته است`);
  }
  if (repeatOffendersFa.length) {
    warningsFa.push(`${repeatOffendersFa.length} پیمانکار تخلف تکراری دارد`);
  }
  if (stopWorkUnenforceable > 0) {
    warningsFa.push(
      `${stopWorkUnenforceable} دستور توقف کار قابل اعمال نیست — دامنه یا مرجع آن ناقص است`,
    );
  }

  return {
    total: violations.length,
    byStatus,
    byType,
    bySeverity,
    open,
    overdue,
    stopWorkTotal,
    stopWorkActive,
    stopWorkUnenforceable,
    totalFine: round2(totalFine),
    repeatOffendersFa,
    unenforceableFa,
    warningsFa,
  };
}


/* ════════════════════════════════════════════════════════════════════
 * بخش ۶ — آموزش، بهداشت شغلی و محیط‌زیست (زیرماژول ۰۸٫۵)
 *
 * سه حوزه که یک چیز مشترک دارند: همگی «اعتبار زمان‌دار» می‌سازند.
 * گواهی آموزش منقضی می‌شود، معاینهٔ طب کار دوره‌ای است، هارنس تاریخ
 * تعویض دارد. پس هستهٔ مشترک هر سه، محاسبهٔ وضعیت اعتبار در یک لحظهٔ
 * مشخص است — و هر سه به یک پرسش واحد ختم می‌شوند: آیا این فرد
 * همین حالا مجاز به ورود به کارگاه است؟
 * ════════════════════════════════════════════════════════════════════ */

export const TRAINING_TYPES = ["induction", "toolbox", "specialist", "refresher", "drill"] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];
export const TRAINING_TYPE_FA: Record<string, string> = {
  induction: "آموزش بدو ورود",
  toolbox: "جلسهٔ روزانهٔ ایمنی",
  specialist: "دورهٔ تخصصی",
  refresher: "دورهٔ بازآموزی",
  drill: "مانور",
};

export const SESSION_STATUSES = ["planned", "held", "cancelled"] as const;
export const SESSION_STATUS_FA: Record<string, string> = {
  planned: "برنامه‌ریزی‌شده",
  held: "برگزارشده",
  cancelled: "لغوشده",
};

export const PPE_TYPES = [
  "helmet", "boots", "goggles", "gloves", "harness",
  "respirator", "earplug", "coverall", "face_shield",
] as const;
export type PpeType = (typeof PPE_TYPES)[number];
export const PPE_TYPE_FA: Record<string, string> = {
  helmet: "کلاه ایمنی",
  boots: "کفش ایمنی",
  goggles: "عینک ایمنی",
  gloves: "دستکش",
  harness: "کمربند و هارنس",
  respirator: "ماسک تنفسی",
  earplug: "گوشی حفاظتی",
  coverall: "لباس کار",
  face_shield: "شیلد صورت",
};

/* تجهیز حیاتی: نبودش به‌تنهایی توقف کار می‌آورد، نه فقط تذکر. */
export const CRITICAL_PPE: PpeType[] = ["helmet", "boots", "harness", "respirator"];

export const PPE_STATUSES = ["issued", "returned", "lost", "damaged"] as const;
export const PPE_STATUS_FA: Record<string, string> = {
  issued: "تحویل‌شده",
  returned: "بازگردانده‌شده",
  lost: "مفقود",
  damaged: "آسیب‌دیده",
};

export const HAZARD_TYPES = [
  "noise", "dust", "chemical", "vibration", "radiation", "heat", "ergonomic", "biological",
] as const;
export const HAZARD_TYPE_FA: Record<string, string> = {
  noise: "صدا",
  dust: "گرد و غبار",
  chemical: "عوامل شیمیایی",
  vibration: "ارتعاش",
  radiation: "پرتو",
  heat: "استرس گرمایی",
  ergonomic: "ارگونومی",
  biological: "عوامل بیولوژیک",
};

export const EXAM_TYPES = ["pre_employment", "periodic", "exit", "special"] as const;
export type ExamType = (typeof EXAM_TYPES)[number];
export const EXAM_TYPE_FA: Record<string, string> = {
  pre_employment: "معاینهٔ بدو استخدام",
  periodic: "معاینهٔ دوره‌ای",
  exit: "معاینهٔ خروج",
  special: "معاینهٔ اختصاصی",
};

export const FITNESS_RESULTS = ["fit", "fit_with_restriction", "unfit", "pending"] as const;
export type FitnessResult = (typeof FITNESS_RESULTS)[number];
export const FITNESS_FA: Record<string, string> = {
  fit: "بلامانع",
  fit_with_restriction: "بلامانع مشروط",
  unfit: "غیرمجاز",
  pending: "در انتظار نتیجه",
};

export const WASTE_TYPES = ["hazardous", "non_hazardous", "recyclable", "construction", "liquid"] as const;
export type WasteType = (typeof WASTE_TYPES)[number];
export const WASTE_TYPE_FA: Record<string, string> = {
  hazardous: "پسماند خطرناک",
  non_hazardous: "پسماند عادی",
  recyclable: "پسماند بازیافتی",
  construction: "نخالهٔ ساختمانی",
  liquid: "پسماند مایع",
};

/* پسماندی که بدون مانیفست حمل، تخلف زیست‌محیطی است. */
export const MANIFEST_REQUIRED_WASTE: WasteType[] = ["hazardous", "liquid"];

export const DISPOSAL_METHODS = [
  "landfill", "incineration", "recycling", "treatment", "licensed_contractor",
] as const;
export const DISPOSAL_METHOD_FA: Record<string, string> = {
  landfill: "دفن بهداشتی",
  incineration: "سوزاندن",
  recycling: "بازیافت",
  treatment: "تصفیه",
  licensed_contractor: "پیمانکار مجاز",
};

export const WASTE_STATUSES = ["generated", "in_transit", "disposed", "rejected"] as const;
export const WASTE_STATUS_FA: Record<string, string> = {
  generated: "تولیدشده",
  in_transit: "در حال حمل",
  disposed: "دفع‌شده",
  rejected: "برگشت‌خورده",
};

export const MONITORING_MEDIA = ["air", "water", "soil", "noise", "effluent"] as const;
export type MonitoringMedium = (typeof MONITORING_MEDIA)[number];
export const MEDIUM_FA: Record<string, string> = {
  air: "هوا",
  water: "آب",
  soil: "خاک",
  noise: "صدا",
  effluent: "پساب",
};

/** آستانهٔ هشدار پیش از انقضا (روز) — یکسان برای گواهی، معاینه و تجهیز. */
export const EXPIRY_WARNING_DAYS = 30;

/** دورهٔ بدو ورود بدون آن هیچ‌کس وارد کارگاه نمی‌شود. */
export const INDUCTION_COURSE_CODE = "HSE-IND";

/* ── ردیف‌ها ── */

export type TrainingSessionRow = {
  Id: string;
  ProjectId: string;
  SessionNo: string;
  TitleFa: string;
  CourseCode: string;
  TrainingType: string;
  HeldAt: string;
  DurationMinutes: number;
  InstructorFa: string;
  LocationFa?: string | null;
  ContractorFa?: string | null;
  ValidityMonths?: number | null;
  MaterialRef?: string | null;
  Status: string;
};

export type TrainingAttendeeRow = {
  Id: string;
  ProjectId: string;
  SessionId: string;
  PersonRef: string;
  PersonNameFa: string;
  TradeCode?: string | null;
  ContractorFa?: string | null;
  Attended: boolean;
  ScorePct?: number | null;
  Passed: boolean;
  SignatureRef?: string | null;
  NoteFa?: string | null;
};

export type PpeIssuanceRow = {
  Id: string;
  ProjectId: string;
  IssueNo: string;
  PersonRef: string;
  PersonNameFa: string;
  PpeType: string;
  IssuedAt: string;
  IssuedBy: string;
  Quantity: number;
  SizeFa?: string | null;
  SerialNo?: string | null;
  ReplaceDueDate?: string | null;
  ReturnedAt?: string | null;
  UnitCost?: number | null;
  ContractorFa?: string | null;
  Status: string;
};

export type OccupationalHazardRow = {
  Id: string;
  ProjectId: string;
  HazardCode: string;
  TitleFa: string;
  HazardType: string;
  TradeCode?: string | null;
  ExposureLimitFa?: string | null;
  ExamIntervalMonths: number;
  RequiredExamsFa?: string | null;
  RequiredPpeFa?: string | null;
  Status: string;
};

export type HealthExamRow = {
  Id: string;
  ProjectId: string;
  ExamNo: string;
  PersonRef: string;
  PersonNameFa: string;
  ExamType: string;
  ExaminedAt: string;
  Fitness: string;
  RestrictionFa?: string | null;
  HazardCode?: string | null;
  NextExamDate?: string | null;
  PhysicianFa?: string | null;
  ClinicFa?: string | null;
  ReportRef?: string | null;
  Status: string;
};

export type WasteLogRow = {
  Id: string;
  ProjectId: string;
  WasteNo: string;
  WasteType: string;
  DescriptionFa: string;
  Quantity: number;
  Unit: string;
  GeneratedAt: string;
  AreaFa?: string | null;
  DisposalMethod: string;
  ManifestNo?: string | null;
  CarrierFa?: string | null;
  DestinationFa?: string | null;
  DisposedAt?: string | null;
  CostAmount?: number | null;
  Status: string;
};

export type EnvMonitoringRow = {
  Id: string;
  ProjectId: string;
  ReadingNo: string;
  Medium: string;
  ParameterFa: string;
  MeasuredAt: string;
  MeasuredValue: number;
  Unit: string;
  LimitValue: number;
  LocationFa?: string | null;
  MethodFa?: string | null;
  LabFa?: string | null;
  CorrectiveActionFa?: string | null;
  ViolationId?: string | null;
  Status: string;
};

/* ── ابزار مشترک تاریخ ── */

/** روزهای باقی‌مانده تا یک تاریخ؛ منفی یعنی گذشته. `null` یعنی بی‌تاریخ. */
function daysUntil(dateStr: string | null | undefined, now: Date): number | null {
  const raw = String(dateStr ?? "").trim();
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return null;
  /* روز پایان کامل حساب می‌شود: گواهی‌ای که امروز منقضی می‌شود امروز
   * هنوز معتبر است. */
  return Math.floor((t + 86_399_999 - now.getTime()) / 86_400_000);
}

/** افزودن ماه به تاریخ، با درنظرگرفتن ماه‌های کوتاه‌تر. */
function addMonths(dateStr: string, months: number): string | null {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return null;
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  /* ۳۱ فروردین + ۱ ماه نباید به اول ماه بعد بپرد. */
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/* ══════════════ ۶٫۱ آموزش ══════════════ */

/**
 * وضعیت یک جلسهٔ آموزش به‌همراه آمار حاضران.
 *
 * نرخ قبولی روی «حاضران» حساب می‌شود نه «ثبت‌نام‌شدگان»: کسی که نیامده
 * نه قبول است نه مردود، و شمردنش در مخرج نرخ قبولی را مصنوعی پایین
 * می‌آورد و مربی را به‌جای غایب مجازات می‌کند.
 */
export function trainingSessionState(
  session: TrainingSessionRow,
  attendees: TrainingAttendeeRow[],
  now: Date = new Date(),
): {
  statusFa: string;
  typeFa: string;
  registered: number;
  attended: number;
  passed: number;
  absent: number;
  attendanceRatePct: number | null;
  passRatePct: number | null;
  certificateExpiry: string | null;
  expiresInDays: number | null;
  isExpired: boolean;
  warningsFa: string[];
} {
  const mine = attendees.filter((a) => a.SessionId === session.Id);
  const registered = mine.length;
  const attended = mine.filter((a) => a.Attended === true).length;
  const passed = mine.filter((a) => a.Attended === true && a.Passed === true).length;
  const absent = registered - attended;

  const attendanceRatePct = registered > 0 ? round2((attended / registered) * 100) : null;
  const passRatePct = attended > 0 ? round2((passed / attended) * 100) : null;

  /* انقضا از تاریخ برگزاری مشتق می‌شود، نه از تاریخ صدور گواهی: اگر
   * گواهی دو ماه بعد صادر شود، اعتبارش نباید دو ماه بیشتر شود. */
  const months = session.ValidityMonths;
  const certificateExpiry =
    months != null && months > 0 ? addMonths(session.HeldAt.slice(0, 10), months) : null;
  const expiresInDays = daysUntil(certificateExpiry, now);
  const isExpired = expiresInDays !== null && expiresInDays < 0;

  const warningsFa: string[] = [];
  if (session.Status === "held" && registered === 0) {
    warningsFa.push("جلسه برگزارشده ثبت شده ولی هیچ حاضری ندارد");
  }
  if (session.Status === "held" && attended === 0 && registered > 0) {
    warningsFa.push("هیچ‌یک از ثبت‌نام‌شدگان حاضر نشده‌اند");
  }
  if (absent > 0 && session.Status === "held") {
    warningsFa.push(`${absent} نفر از ثبت‌نام‌شدگان غایب بوده‌اند`);
  }
  if (passRatePct !== null && passRatePct < 50) {
    warningsFa.push(`نرخ قبولی ${passRatePct} درصد است — اثربخشی آموزش باید بازنگری شود`);
  }
  if (isExpired && session.Status === "held") {
    warningsFa.push("اعتبار گواهی این جلسه منقضی شده و حاضران نیاز به بازآموزی دارند");
  }

  return {
    statusFa: SESSION_STATUS_FA[session.Status] ?? session.Status,
    typeFa: TRAINING_TYPE_FA[session.TrainingType] ?? session.TrainingType,
    registered,
    attended,
    passed,
    absent,
    attendanceRatePct,
    passRatePct,
    certificateExpiry,
    expiresInDays,
    isExpired,
    warningsFa,
  };
}

/**
 * ماتریس آموزش یک فرد: چه دارد، چه ندارد، چه نزدیک انقضاست.
 *
 * این تابع تعمیم `trainingValidity` است و آن را جایگزین نمی‌کند —
 * تابع قدیمی امضای ساده‌تری دارد و ماژول منابع انسانی از آن استفاده
 * می‌کند؛ شکستنش یعنی شکستن گیت `hseTraining`.
 */
export function personTrainingMatrix(args: {
  personRef: string;
  records: TrainingRow[];
  requiredCourses?: string[];
  now?: Date;
}): {
  personRef: string;
  valid: { courseCode: string; titleFa: string; expiresAt: string | null; daysLeft: number | null }[];
  expired: { courseCode: string; titleFa: string; expiredAt: string | null }[];
  expiringSoon: { courseCode: string; titleFa: string; daysLeft: number }[];
  missingRequired: string[];
  hasInduction: boolean;
  isCleared: boolean;
  blockersFa: string[];
  warningsFa: string[];
} {
  const { personRef, records, requiredCourses = [], now = new Date() } = args;
  const mine = records.filter((r) => r.PersonRef === personRef);

  const valid: { courseCode: string; titleFa: string; expiresAt: string | null; daysLeft: number | null }[] = [];
  const expired: { courseCode: string; titleFa: string; expiredAt: string | null }[] = [];
  const expiringSoon: { courseCode: string; titleFa: string; daysLeft: number }[] = [];

  for (const r of mine) {
    const titleFa = r.CourseTitleFa || r.CourseCode;
    /* گواهی باطل‌شده منقضی است، نه معتبرِ بی‌تاریخ. */
    if (r.Status === "revoked") {
      expired.push({ courseCode: r.CourseCode, titleFa, expiredAt: r.ExpiresAt ?? null });
      continue;
    }
    const left = daysUntil(r.ExpiresAt, now);
    if (left === null) {
      valid.push({ courseCode: r.CourseCode, titleFa, expiresAt: null, daysLeft: null });
      continue;
    }
    if (left < 0) {
      expired.push({ courseCode: r.CourseCode, titleFa, expiredAt: r.ExpiresAt ?? null });
      continue;
    }
    valid.push({ courseCode: r.CourseCode, titleFa, expiresAt: r.ExpiresAt ?? null, daysLeft: left });
    if (left <= EXPIRY_WARNING_DAYS) expiringSoon.push({ courseCode: r.CourseCode, titleFa, daysLeft: left });
  }

  const validCodes = new Set(valid.map((v) => v.courseCode));
  const missingRequired = requiredCourses.filter((c) => !validCodes.has(c));
  const hasInduction = validCodes.has(INDUCTION_COURSE_CODE);

  const blockersFa: string[] = [];
  if (!hasInduction) blockersFa.push("آموزش بدو ورود معتبر ندارد");
  for (const c of missingRequired) {
    if (c === INDUCTION_COURSE_CODE) continue; /* دوباره نگوییم. */
    blockersFa.push(`دورهٔ الزامی «${c}» معتبر نیست`);
  }

  const warningsFa: string[] = [];
  for (const e of expiringSoon) {
    warningsFa.push(`گواهی «${e.titleFa}» تا ${e.daysLeft} روز دیگر منقضی می‌شود`);
  }
  if (mine.length === 0) warningsFa.push("هیچ سابقهٔ آموزشی برای این فرد ثبت نشده است");

  return {
    personRef,
    valid,
    expired,
    expiringSoon,
    missingRequired,
    hasInduction,
    isCleared: blockersFa.length === 0,
    blockersFa,
    warningsFa,
  };
}

/* ══════════════ ۶٫۲ تجهیزات حفاظت فردی ══════════════ */

/**
 * وضعیت تجهیزات یک فرد.
 *
 * تجهیز «تحویل‌شده» با تجهیز «موجود و سالم» یکی نیست: هارنسی که تاریخ
 * تعویضش گذشته روی کاغذ تحویل‌شده است ولی در عمل نباید استفاده شود.
 */
export function personPpeState(args: {
  personRef: string;
  issuances: PpeIssuanceRow[];
  requiredPpe?: PpeType[];
  now?: Date;
}): {
  personRef: string;
  active: { ppeType: string; typeFa: string; issuedAt: string; replaceDue: string | null; daysLeft: number | null }[];
  overdue: { ppeType: string; typeFa: string; replaceDue: string; overdueDays: number }[];
  dueSoon: { ppeType: string; typeFa: string; daysLeft: number }[];
  missingRequired: string[];
  missingCriticalFa: string[];
  isEquipped: boolean;
  blockersFa: string[];
  warningsFa: string[];
} {
  const { personRef, issuances, requiredPpe = [], now = new Date() } = args;
  const mine = issuances.filter((i) => i.PersonRef === personRef);

  const active: { ppeType: string; typeFa: string; issuedAt: string; replaceDue: string | null; daysLeft: number | null }[] = [];
  const overdue: { ppeType: string; typeFa: string; replaceDue: string; overdueDays: number }[] = [];
  const dueSoon: { ppeType: string; typeFa: string; daysLeft: number }[] = [];

  for (const i of mine) {
    /* بازگردانده، مفقود یا آسیب‌دیده = در اختیار فرد نیست. */
    if (i.Status !== "issued") continue;
    const typeFa = PPE_TYPE_FA[i.PpeType] ?? i.PpeType;
    const left = daysUntil(i.ReplaceDueDate, now);
    if (left !== null && left < 0) {
      overdue.push({ ppeType: i.PpeType, typeFa, replaceDue: String(i.ReplaceDueDate), overdueDays: -left });
      continue; /* منقضی در فهرست فعال نمی‌آید. */
    }
    active.push({ ppeType: i.PpeType, typeFa, issuedAt: i.IssuedAt, replaceDue: i.ReplaceDueDate ?? null, daysLeft: left });
    if (left !== null && left <= EXPIRY_WARNING_DAYS) dueSoon.push({ ppeType: i.PpeType, typeFa, daysLeft: left });
  }

  const activeTypes = new Set(active.map((a) => a.ppeType));
  const missingRequired = requiredPpe.filter((t) => !activeTypes.has(t));
  const missingCritical = missingRequired.filter((t) => CRITICAL_PPE.includes(t as PpeType));
  const missingCriticalFa = missingCritical.map((t) => PPE_TYPE_FA[t] ?? t);

  const blockersFa: string[] = [];
  for (const t of missingCritical) {
    blockersFa.push(`تجهیز حیاتی «${PPE_TYPE_FA[t] ?? t}» تحویل نشده است`);
  }
  for (const o of overdue) {
    if (CRITICAL_PPE.includes(o.ppeType as PpeType)) {
      blockersFa.push(`«${o.typeFa}» ${o.overdueDays} روز از تاریخ تعویضش گذشته است`);
    }
  }

  const warningsFa: string[] = [];
  for (const t of missingRequired) {
    if (missingCritical.includes(t)) continue;
    warningsFa.push(`تجهیز «${PPE_TYPE_FA[t] ?? t}» تحویل نشده است`);
  }
  for (const d of dueSoon) warningsFa.push(`«${d.typeFa}» تا ${d.daysLeft} روز دیگر باید تعویض شود`);
  for (const o of overdue) {
    if (!CRITICAL_PPE.includes(o.ppeType as PpeType)) {
      warningsFa.push(`«${o.typeFa}» ${o.overdueDays} روز از تاریخ تعویضش گذشته است`);
    }
  }

  return {
    personRef,
    active,
    overdue,
    dueSoon,
    missingRequired,
    missingCriticalFa,
    isEquipped: blockersFa.length === 0,
    blockersFa,
    warningsFa,
  };
}

/* ══════════════ ۶٫۳ طب کار ══════════════ */

/**
 * وضعیت سلامت شغلی یک فرد.
 *
 * فقط آخرین معاینه از هر نوع اهمیت دارد: معاینهٔ پارسال با نتیجهٔ
 * «غیرمجاز» که امسال با «بلامانع» جایگزین شده نباید فرد را مسدود کند.
 */
export function personHealthState(args: {
  personRef: string;
  exams: HealthExamRow[];
  hazards?: OccupationalHazardRow[];
  tradeCode?: string | null;
  now?: Date;
}): {
  personRef: string;
  latestExam: HealthExamRow | null;
  fitness: string;
  fitnessFa: string;
  restrictionFa: string | null;
  nextExamDate: string | null;
  daysToNextExam: number | null;
  isOverdue: boolean;
  hasPreEmployment: boolean;
  requiredHazards: { hazardCode: string; titleFa: string; intervalMonths: number }[];
  isCleared: boolean;
  blockersFa: string[];
  warningsFa: string[];
} {
  const { personRef, exams, hazards = [], tradeCode = null, now = new Date() } = args;
  const mine = exams
    .filter((e) => e.PersonRef === personRef && e.Status !== "superseded")
    .sort((a, b) => new Date(a.ExaminedAt).getTime() - new Date(b.ExaminedAt).getTime());

  const latestExam = mine.length ? mine[mine.length - 1] : null;
  const hasPreEmployment = mine.some((e) => e.ExamType === "pre_employment" && e.Fitness !== "unfit");

  const fitness = latestExam?.Fitness ?? "pending";
  const nextExamDate = latestExam?.NextExamDate ?? null;
  const daysToNextExam = daysUntil(nextExamDate, now);
  const isOverdue = daysToNextExam !== null && daysToNextExam < 0;

  /* عوامل زیان‌آور مربوط به شغل فرد؛ عامل بدون TradeCode یعنی همگانی. */
  const requiredHazards = hazards
    .filter((h) => h.Status === "active" && (!h.TradeCode || h.TradeCode === tradeCode))
    .map((h) => ({ hazardCode: h.HazardCode, titleFa: h.TitleFa, intervalMonths: h.ExamIntervalMonths }));

  const blockersFa: string[] = [];
  if (!latestExam) {
    blockersFa.push("هیچ معاینهٔ طب کاری برای این فرد ثبت نشده است");
  } else {
    if (fitness === "unfit") blockersFa.push("نتیجهٔ آخرین معاینه «غیرمجاز» است");
    if (fitness === "pending") blockersFa.push("نتیجهٔ معاینه هنوز اعلام نشده است");
    if (!hasPreEmployment) blockersFa.push("معاینهٔ بدو استخدام معتبر ندارد");
    if (isOverdue) blockersFa.push(`معاینهٔ دوره‌ای ${-(daysToNextExam as number)} روز معوق است`);
  }

  const warningsFa: string[] = [];
  if (fitness === "fit_with_restriction") {
    /* محدودیت بدون شرح یعنی سرپرست نمی‌داند چه کاری را نباید بدهد. */
    warningsFa.push(
      latestExam?.RestrictionFa
        ? `کار مشروط: ${latestExam.RestrictionFa}`
        : "نتیجه «بلامانع مشروط» است ولی شرح محدودیت ثبت نشده",
    );
  }
  if (daysToNextExam !== null && daysToNextExam >= 0 && daysToNextExam <= EXPIRY_WARNING_DAYS) {
    warningsFa.push(`معاینهٔ دوره‌ای تا ${daysToNextExam} روز دیگر سررسید می‌شود`);
  }
  if (requiredHazards.length && !latestExam?.HazardCode) {
    warningsFa.push("عامل زیان‌آور شغل مشخص است ولی معاینه به آن ارجاع نداده");
  }

  return {
    personRef,
    latestExam,
    fitness,
    fitnessFa: FITNESS_FA[fitness] ?? fitness,
    restrictionFa: latestExam?.RestrictionFa ?? null,
    nextExamDate,
    daysToNextExam,
    isOverdue,
    hasPreEmployment,
    requiredHazards,
    isCleared: blockersFa.length === 0,
    blockersFa,
    warningsFa,
  };
}

/** تاریخ معاینهٔ بعدی از فاصلهٔ عامل زیان‌آور. */
export function nextExamDate(examinedAt: string, intervalMonths: number): string | null {
  if (!Number.isFinite(intervalMonths) || intervalMonths <= 0) return null;
  return addMonths(examinedAt.slice(0, 10), intervalMonths);
}

/* ══════════════ ۶٫۴ دروازهٔ ورود به کارگاه ══════════════ */

/**
 * آیا این فرد همین حالا مجاز به ورود و کار است؟
 *
 * سه دروازهٔ آموزش، تجهیزات و سلامت با «و» ترکیب می‌شوند نه «یا».
 * این تابع همان چیزی است که گیت `hseTraining` در ماژول منابع انسانی
 * باید بخواند — و تعمیم آن به دو بُعد دیگر است.
 */
export function personSiteClearance(args: {
  personRef: string;
  trainings?: TrainingRow[];
  issuances?: PpeIssuanceRow[];
  exams?: HealthExamRow[];
  hazards?: OccupationalHazardRow[];
  requiredCourses?: string[];
  requiredPpe?: PpeType[];
  tradeCode?: string | null;
  now?: Date;
}): {
  personRef: string;
  ok: boolean;
  training: { ok: boolean; blockersFa: string[] };
  ppe: { ok: boolean; blockersFa: string[] };
  health: { ok: boolean; blockersFa: string[] };
  blockersFa: string[];
  warningsFa: string[];
} {
  const {
    personRef, trainings = [], issuances = [], exams = [], hazards = [],
    requiredCourses = [], requiredPpe = [], tradeCode = null, now = new Date(),
  } = args;

  const t = personTrainingMatrix({ personRef, records: trainings, requiredCourses, now });
  const p = personPpeState({ personRef, issuances, requiredPpe, now });
  const h = personHealthState({ personRef, exams, hazards, tradeCode, now });

  /* پیشوند دامنه اضافه می‌شود تا کاربر بداند کدام دفتر را باید ببیند. */
  const blockersFa = [
    ...t.blockersFa.map((b) => `آموزش: ${b}`),
    ...p.blockersFa.map((b) => `تجهیزات: ${b}`),
    ...h.blockersFa.map((b) => `سلامت: ${b}`),
  ];
  const warningsFa = [
    ...t.warningsFa.map((w) => `آموزش: ${w}`),
    ...p.warningsFa.map((w) => `تجهیزات: ${w}`),
    ...h.warningsFa.map((w) => `سلامت: ${w}`),
  ];

  return {
    personRef,
    ok: blockersFa.length === 0,
    training: { ok: t.isCleared, blockersFa: t.blockersFa },
    ppe: { ok: p.isEquipped, blockersFa: p.blockersFa },
    health: { ok: h.isCleared, blockersFa: h.blockersFa },
    blockersFa,
    warningsFa,
  };
}

/* ══════════════ ۶٫۵ پسماند ══════════════ */

/**
 * وضعیت یک ردیف پسماند.
 *
 * پسماند خطرناکِ بدون شمارهٔ مانیفست، تخلف زیست‌محیطی است نه صرفاً
 * دادهٔ ناقص: قانون حمل پسماند ویژه، مانیفست را الزامی می‌کند.
 */
export function wasteLogState(waste: WasteLogRow, now: Date = new Date()): {
  typeFa: string;
  statusFa: string;
  methodFa: string;
  needsManifest: boolean;
  hasManifest: boolean;
  isCompliant: boolean;
  isStale: boolean;
  ageDays: number | null;
  issuesFa: string[];
} {
  const needsManifest = MANIFEST_REQUIRED_WASTE.includes(waste.WasteType as WasteType);
  const hasManifest = String(waste.ManifestNo ?? "").trim().length > 0;

  const gen = new Date(waste.GeneratedAt).getTime();
  const ageDays = Number.isFinite(gen) ? Math.floor((now.getTime() - gen) / 86_400_000) : null;
  /* پسماند خطرناکی که ۹۰ روز در کارگاه مانده، خودش یک ریسک است. */
  const isStale = waste.Status !== "disposed" && ageDays !== null && ageDays > 90;

  const issuesFa: string[] = [];
  if (needsManifest && !hasManifest) {
    issuesFa.push(`${WASTE_TYPE_FA[waste.WasteType] ?? waste.WasteType} بدون شمارهٔ مانیفست حمل ثبت شده است`);
  }
  if (waste.Status === "disposed" && !waste.DisposedAt) {
    issuesFa.push("وضعیت «دفع‌شده» است ولی تاریخ دفع ثبت نشده");
  }
  if (waste.Status === "in_transit" && !String(waste.CarrierFa ?? "").trim()) {
    issuesFa.push("پسماند در حال حمل است ولی حمل‌کننده مشخص نیست");
  }
  if (isStale) {
    issuesFa.push(`${ageDays} روز از تولید این پسماند می‌گذرد و هنوز دفع نشده`);
  }
  if (waste.Quantity <= 0) issuesFa.push("مقدار پسماند باید بزرگ‌تر از صفر باشد");

  return {
    typeFa: WASTE_TYPE_FA[waste.WasteType] ?? waste.WasteType,
    statusFa: WASTE_STATUS_FA[waste.Status] ?? waste.Status,
    methodFa: DISPOSAL_METHOD_FA[waste.DisposalMethod] ?? waste.DisposalMethod,
    needsManifest,
    hasManifest,
    isCompliant: issuesFa.length === 0,
    isStale,
    ageDays,
    issuesFa,
  };
}

/**
 * خلاصهٔ پسماند.
 *
 * نرخ بازیافت روی جرم حساب می‌شود نه تعداد ردیف: صد ردیف کاغذ باطله
 * در برابر یک ردیف خاک آلوده، اگر تعدادی بشماریم، نرخ بازیافت را
 * ۹۹ درصد نشان می‌دهد. واحدهای ناهمگن جدا نگه داشته می‌شوند.
 */
export function wasteSummary(logs: WasteLogRow[], now: Date = new Date()): {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  quantityByUnit: Record<string, number>;
  hazardousQuantityByUnit: Record<string, number>;
  recycledQuantityByUnit: Record<string, number>;
  recyclingRatePctByUnit: Record<string, number>;
  missingManifest: number;
  staleCount: number;
  totalCost: number;
  nonCompliantFa: string[];
  warningsFa: string[];
} {
  const byType: Record<string, number> = {};
  for (const t of WASTE_TYPES) byType[t] = 0;
  const byStatus: Record<string, number> = {};
  for (const st of WASTE_STATUSES) byStatus[st] = 0;

  const quantityByUnit: Record<string, number> = {};
  const hazardousQuantityByUnit: Record<string, number> = {};
  const recycledQuantityByUnit: Record<string, number> = {};

  let missingManifest = 0;
  let staleCount = 0;
  let totalCost = 0;
  const nonCompliantFa: string[] = [];

  for (const w of logs) {
    byType[w.WasteType] = (byType[w.WasteType] ?? 0) + 1;
    byStatus[w.Status] = (byStatus[w.Status] ?? 0) + 1;

    const q = Number(w.Quantity) || 0;
    const u = w.Unit || "?";
    quantityByUnit[u] = round3((quantityByUnit[u] ?? 0) + q);
    if (w.WasteType === "hazardous") {
      hazardousQuantityByUnit[u] = round3((hazardousQuantityByUnit[u] ?? 0) + q);
    }
    if (w.WasteType === "recyclable" || w.DisposalMethod === "recycling") {
      recycledQuantityByUnit[u] = round3((recycledQuantityByUnit[u] ?? 0) + q);
    }
    totalCost += Number(w.CostAmount) || 0;

    const st = wasteLogState(w, now);
    if (st.needsManifest && !st.hasManifest) missingManifest += 1;
    if (st.isStale) staleCount += 1;
    if (!st.isCompliant) nonCompliantFa.push(`${w.WasteNo}: ${st.issuesFa.join("؛ ")}`);
  }

  /* نرخ بازیافت به تفکیک واحد؛ جمع‌کردن کیلوگرم و لیتر بی‌معناست. */
  const recyclingRatePctByUnit: Record<string, number> = {};
  for (const [u, total] of Object.entries(quantityByUnit)) {
    if (total > 0) recyclingRatePctByUnit[u] = round2(((recycledQuantityByUnit[u] ?? 0) / total) * 100);
  }

  const warningsFa: string[] = [];
  if (missingManifest > 0) {
    warningsFa.push(`${missingManifest} ردیف پسماند نیازمند مانیفست، بدون شمارهٔ مانیفست ثبت شده است`);
  }
  if (staleCount > 0) {
    warningsFa.push(`${staleCount} ردیف پسماند بیش از ۹۰ روز است که دفع نشده`);
  }
  if (Object.keys(quantityByUnit).length > 2) {
    warningsFa.push("پسماندها با واحدهای ناهمگن ثبت شده‌اند؛ مقایسهٔ مستقیم مقادیر معتبر نیست");
  }

  return {
    total: logs.length,
    byType,
    byStatus,
    quantityByUnit,
    hazardousQuantityByUnit,
    recycledQuantityByUnit,
    recyclingRatePctByUnit,
    missingManifest,
    staleCount,
    totalCost: round2(totalCost),
    nonCompliantFa,
    warningsFa,
  };
}

/* ══════════════ ۶٫۶ پایش زیست‌محیطی ══════════════ */

/**
 * آیا این اندازه‌گیری از حد مجاز فراتر رفته؟
 *
 * حد از خود ردیف خوانده می‌شود نه از جدول جاری: حد قانونی با زمان
 * عوض می‌شود و اندازه‌گیری پارسال باید با حد پارسال سنجیده شود.
 */
export function monitoringState(reading: EnvMonitoringRow): {
  mediumFa: string;
  isExceeded: boolean;
  exceedancePct: number | null;
  ratio: number | null;
  isNearLimit: boolean;
  severityFa: string;
  needsAction: boolean;
  issuesFa: string[];
} {
  const v = Number(reading.MeasuredValue);
  const lim = Number(reading.LimitValue);
  const issuesFa: string[] = [];

  if (!Number.isFinite(v) || !Number.isFinite(lim) || lim <= 0) {
    issuesFa.push("مقدار اندازه‌گیری یا حد مجاز نامعتبر است");
    return {
      mediumFa: MEDIUM_FA[reading.Medium] ?? reading.Medium,
      isExceeded: false, exceedancePct: null, ratio: null, isNearLimit: false,
      severityFa: "نامشخص", needsAction: false, issuesFa,
    };
  }

  const ratio = round3(v / lim);
  const isExceeded = v > lim;
  const exceedancePct = isExceeded ? round2(((v - lim) / lim) * 100) : 0;
  /* ۹۰ درصد حد یعنی هنوز مجاز ولی یک نوسان تا تخلف فاصله دارد. */
  const isNearLimit = !isExceeded && ratio >= 0.9;

  let severityFa = "در حد مجاز";
  if (isExceeded) {
    severityFa = exceedancePct >= 100 ? "فراتر از دو برابر حد" : exceedancePct >= 20 ? "فراتر از حد" : "فراتر از حد (جزئی)";
  } else if (isNearLimit) {
    severityFa = "نزدیک حد مجاز";
  }

  if (isExceeded) {
    issuesFa.push(`${reading.ParameterFa} ${exceedancePct} درصد فراتر از حد مجاز است`);
    if (!String(reading.CorrectiveActionFa ?? "").trim()) {
      issuesFa.push("فراتررفتن از حد بدون ثبت اقدام اصلاحی");
    }
  }

  return {
    mediumFa: MEDIUM_FA[reading.Medium] ?? reading.Medium,
    isExceeded,
    exceedancePct,
    ratio,
    isNearLimit,
    severityFa,
    /* اقدام لازم است وقتی فراتر رفته و هنوز اقدامی ثبت نشده. */
    needsAction: isExceeded && !String(reading.CorrectiveActionFa ?? "").trim(),
    issuesFa,
  };
}

/** خلاصهٔ پایش زیست‌محیطی به تفکیک محیط. */
export function monitoringSummary(readings: EnvMonitoringRow[]): {
  total: number;
  byMedium: Record<string, number>;
  exceeded: number;
  nearLimit: number;
  exceededWithoutAction: number;
  complianceRatePct: number | null;
  worstFa: string | null;
  exceededByMedium: Record<string, number>;
  warningsFa: string[];
} {
  const byMedium: Record<string, number> = {};
  for (const m of MONITORING_MEDIA) byMedium[m] = 0;
  const exceededByMedium: Record<string, number> = {};
  for (const m of MONITORING_MEDIA) exceededByMedium[m] = 0;

  let exceeded = 0;
  let nearLimit = 0;
  let exceededWithoutAction = 0;
  let valid = 0;
  let worstPct = -1;
  let worstFa: string | null = null;

  for (const r of readings) {
    byMedium[r.Medium] = (byMedium[r.Medium] ?? 0) + 1;
    const st = monitoringState(r);
    /* اندازه‌گیری نامعتبر نه در صورت می‌آید نه در مخرج. */
    if (st.ratio === null) continue;
    valid += 1;
    if (st.isExceeded) {
      exceeded += 1;
      exceededByMedium[r.Medium] = (exceededByMedium[r.Medium] ?? 0) + 1;
      if (st.needsAction) exceededWithoutAction += 1;
      if ((st.exceedancePct ?? 0) > worstPct) {
        worstPct = st.exceedancePct ?? 0;
        worstFa = `${r.ReadingNo} — ${r.ParameterFa} (${st.mediumFa}): ${st.exceedancePct} درصد فراتر از حد`;
      }
    } else if (st.isNearLimit) {
      nearLimit += 1;
    }
  }

  const warningsFa: string[] = [];
  if (exceededWithoutAction > 0) {
    warningsFa.push(`${exceededWithoutAction} اندازه‌گیری فراتر از حد بدون اقدام اصلاحی ثبت‌شده است`);
  }
  if (nearLimit > 0) {
    warningsFa.push(`${nearLimit} اندازه‌گیری نزدیک حد مجاز است و روند باید پایش شود`);
  }
  if (valid === 0 && readings.length > 0) {
    warningsFa.push("هیچ اندازه‌گیری معتبری برای محاسبهٔ نرخ انطباق وجود ندارد");
  }

  return {
    total: readings.length,
    byMedium,
    exceeded,
    nearLimit,
    exceededWithoutAction,
    complianceRatePct: valid > 0 ? round2(((valid - exceeded) / valid) * 100) : null,
    worstFa,
    exceededByMedium,
    warningsFa,
  };
}

/* ══════════════ ۶٫۷ خلاصه‌های تجمیعی ══════════════ */

/** خلاصهٔ آموزش در سطح پروژه. */
export function trainingSummary(args: {
  sessions: TrainingSessionRow[];
  attendees: TrainingAttendeeRow[];
  records?: TrainingRow[];
  now?: Date;
}): {
  totalSessions: number;
  heldSessions: number;
  bySessionType: Record<string, number>;
  totalAttendees: number;
  uniquePersons: number;
  totalManHours: number;
  avgAttendanceRatePct: number | null;
  avgPassRatePct: number | null;
  validCertificates: number;
  expiredCertificates: number;
  expiringSoonCertificates: number;
  personsWithoutInduction: string[];
  warningsFa: string[];
} {
  const { sessions, attendees, records = [], now = new Date() } = args;

  const bySessionType: Record<string, number> = {};
  for (const t of TRAINING_TYPES) bySessionType[t] = 0;

  let totalManHours = 0;
  const attendanceRates: number[] = [];
  const passRates: number[] = [];
  const held = sessions.filter((s) => s.Status === "held");

  for (const s of sessions) {
    bySessionType[s.TrainingType] = (bySessionType[s.TrainingType] ?? 0) + 1;
  }
  for (const s of held) {
    const st = trainingSessionState(s, attendees, now);
    /* نفرساعت آموزش فقط از جلسهٔ برگزارشده و حاضر واقعی. */
    totalManHours += (st.attended * (Number(s.DurationMinutes) || 0)) / 60;
    if (st.attendanceRatePct !== null) attendanceRates.push(st.attendanceRatePct);
    if (st.passRatePct !== null) passRates.push(st.passRatePct);
  }

  const sessionIds = new Set(sessions.map((s) => s.Id));
  const mine = attendees.filter((a) => sessionIds.has(a.SessionId));
  const persons = new Set(mine.map((a) => a.PersonRef));

  let validCertificates = 0;
  let expiredCertificates = 0;
  let expiringSoonCertificates = 0;
  for (const r of records) {
    if (r.Status === "revoked") { expiredCertificates += 1; continue; }
    const left = daysUntil(r.ExpiresAt, now);
    if (left === null) { validCertificates += 1; continue; }
    if (left < 0) expiredCertificates += 1;
    else {
      validCertificates += 1;
      if (left <= EXPIRY_WARNING_DAYS) expiringSoonCertificates += 1;
    }
  }

  /* کسی که در جلسه‌ای حاضر بوده ولی گواهی بدو ورود معتبر ندارد. */
  const withInduction = new Set(
    records
      .filter((r) => r.CourseCode === INDUCTION_COURSE_CODE && r.Status !== "revoked")
      .filter((r) => {
        const left = daysUntil(r.ExpiresAt, now);
        return left === null || left >= 0;
      })
      .map((r) => r.PersonRef),
  );
  const personsWithoutInduction = [...persons].filter((p) => !withInduction.has(p)).sort();

  const avg = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

  const warningsFa: string[] = [];
  if (expiredCertificates > 0) {
    warningsFa.push(`${expiredCertificates} گواهی آموزش منقضی یا باطل شده است`);
  }
  if (expiringSoonCertificates > 0) {
    warningsFa.push(`${expiringSoonCertificates} گواهی تا ${EXPIRY_WARNING_DAYS} روز آینده منقضی می‌شود`);
  }
  if (personsWithoutInduction.length > 0) {
    warningsFa.push(`${personsWithoutInduction.length} نفر بدون آموزش بدو ورود معتبر در جلسات شرکت کرده‌اند`);
  }

  return {
    totalSessions: sessions.length,
    heldSessions: held.length,
    bySessionType,
    totalAttendees: mine.length,
    uniquePersons: persons.size,
    totalManHours: round2(totalManHours),
    avgAttendanceRatePct: avg(attendanceRates),
    avgPassRatePct: avg(passRates),
    validCertificates,
    expiredCertificates,
    expiringSoonCertificates,
    personsWithoutInduction,
    warningsFa,
  };
}

/** خلاصهٔ تجهیزات و سلامت در سطح پروژه. */
export function healthPpeSummary(args: {
  issuances: PpeIssuanceRow[];
  exams: HealthExamRow[];
  now?: Date;
}): {
  totalIssuances: number;
  byPpeType: Record<string, number>;
  activeIssuances: number;
  overdueReplacement: number;
  dueSoonReplacement: number;
  totalPpeCost: number;
  totalExams: number;
  byFitness: Record<string, number>;
  overdueExams: number;
  dueSoonExams: number;
  unfitPersons: string[];
  restrictedWithoutDetail: number;
  warningsFa: string[];
} {
  const { issuances, exams, now = new Date() } = args;

  const byPpeType: Record<string, number> = {};
  for (const t of PPE_TYPES) byPpeType[t] = 0;

  let activeIssuances = 0;
  let overdueReplacement = 0;
  let dueSoonReplacement = 0;
  let totalPpeCost = 0;

  for (const i of issuances) {
    byPpeType[i.PpeType] = (byPpeType[i.PpeType] ?? 0) + 1;
    totalPpeCost += (Number(i.UnitCost) || 0) * (Number(i.Quantity) || 0);
    if (i.Status !== "issued") continue;
    const left = daysUntil(i.ReplaceDueDate, now);
    if (left !== null && left < 0) { overdueReplacement += 1; continue; }
    activeIssuances += 1;
    if (left !== null && left <= EXPIRY_WARNING_DAYS) dueSoonReplacement += 1;
  }

  const byFitness: Record<string, number> = {};
  for (const f of FITNESS_RESULTS) byFitness[f] = 0;

  /* فقط آخرین معاینهٔ هر فرد در آمار می‌آید؛ وگرنه کسی که پارسال
   * غیرمجاز بوده و امسال بلامانع، هر دو بار شمرده می‌شود. */
  const latestByPerson = new Map<string, HealthExamRow>();
  for (const e of exams) {
    if (e.Status === "superseded") continue;
    const prev = latestByPerson.get(e.PersonRef);
    if (!prev || new Date(e.ExaminedAt).getTime() > new Date(prev.ExaminedAt).getTime()) {
      latestByPerson.set(e.PersonRef, e);
    }
  }

  let overdueExams = 0;
  let dueSoonExams = 0;
  let restrictedWithoutDetail = 0;
  const unfitPersons: string[] = [];

  for (const e of latestByPerson.values()) {
    byFitness[e.Fitness] = (byFitness[e.Fitness] ?? 0) + 1;
    if (e.Fitness === "unfit") unfitPersons.push(e.PersonNameFa || e.PersonRef);
    if (e.Fitness === "fit_with_restriction" && !String(e.RestrictionFa ?? "").trim()) {
      restrictedWithoutDetail += 1;
    }
    const left = daysUntil(e.NextExamDate, now);
    if (left === null) continue;
    if (left < 0) overdueExams += 1;
    else if (left <= EXPIRY_WARNING_DAYS) dueSoonExams += 1;
  }

  const warningsFa: string[] = [];
  if (overdueReplacement > 0) {
    warningsFa.push(`${overdueReplacement} تجهیز حفاظت فردی از تاریخ تعویض گذشته و همچنان تحویل‌نشده مانده است`);
  }
  if (overdueExams > 0) warningsFa.push(`${overdueExams} نفر معاینهٔ دوره‌ای معوق دارند`);
  if (unfitPersons.length > 0) {
    warningsFa.push(`${unfitPersons.length} نفر با نتیجهٔ «غیرمجاز» در فهرست فعال هستند`);
  }
  if (restrictedWithoutDetail > 0) {
    warningsFa.push(`${restrictedWithoutDetail} معاینهٔ «مشروط» بدون شرح محدودیت ثبت شده است`);
  }

  return {
    totalIssuances: issuances.length,
    byPpeType,
    activeIssuances,
    overdueReplacement,
    dueSoonReplacement,
    totalPpeCost: round2(totalPpeCost),
    totalExams: exams.length,
    byFitness,
    overdueExams,
    dueSoonExams,
    unfitPersons: unfitPersons.sort(),
    restrictedWithoutDetail,
    warningsFa,
  };
}

/* ══════════════ ۶٫۸ اعتبارسنجی ورودی ══════════════ */

export function validateTrainingSessionInput(input: Partial<TrainingSessionRow>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!String(input.SessionNo ?? "").trim()) {
    issues.push({ code: "E-HSE-SESSION-NO", message: "شمارهٔ جلسه الزامی است" });
  }
  if (!String(input.TitleFa ?? "").trim()) {
    issues.push({ code: "E-HSE-SESSION-TITLE", message: "عنوان جلسه الزامی است" });
  }
  if (!String(input.CourseCode ?? "").trim()) {
    issues.push({ code: "E-HSE-SESSION-COURSE", message: "کد دوره الزامی است" });
  }
  if (!TRAINING_TYPES.includes(input.TrainingType as TrainingType)) {
    issues.push({ code: "E-HSE-SESSION-TYPE", message: "نوع آموزش نامعتبر است" });
  }
  const held = new Date(String(input.HeldAt ?? "")).getTime();
  if (!Number.isFinite(held)) {
    issues.push({ code: "E-HSE-SESSION-DATE", message: "تاریخ برگزاری نامعتبر است" });
  }
  const dur = Number(input.DurationMinutes);
  if (!Number.isFinite(dur) || dur <= 0) {
    issues.push({ code: "E-HSE-SESSION-DURATION", message: "مدت جلسه باید عددی مثبت باشد" });
  }
  if (!String(input.InstructorFa ?? "").trim()) {
    issues.push({ code: "E-HSE-SESSION-INSTRUCTOR", message: "نام مدرس الزامی است" });
  }
  if (input.ValidityMonths != null) {
    const v = Number(input.ValidityMonths);
    if (!Number.isFinite(v) || v <= 0) {
      issues.push({ code: "E-HSE-SESSION-VALIDITY", message: "مدت اعتبار گواهی باید عددی مثبت باشد" });
    }
  }
  return issues;
}

export function validatePpeInput(input: Partial<PpeIssuanceRow>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!String(input.IssueNo ?? "").trim()) {
    issues.push({ code: "E-HSE-PPE-NO", message: "شمارهٔ تحویل الزامی است" });
  }
  if (!String(input.PersonRef ?? "").trim()) {
    issues.push({ code: "E-HSE-PPE-PERSON", message: "شناسهٔ فرد الزامی است" });
  }
  if (!PPE_TYPES.includes(input.PpeType as PpeType)) {
    issues.push({ code: "E-HSE-PPE-TYPE", message: "نوع تجهیز حفاظت فردی نامعتبر است" });
  }
  const q = Number(input.Quantity);
  if (!Number.isFinite(q) || q <= 0) {
    issues.push({ code: "E-HSE-PPE-QTY", message: "تعداد باید عددی مثبت باشد" });
  }
  if (!String(input.IssuedAt ?? "").trim() || !Number.isFinite(new Date(String(input.IssuedAt)).getTime())) {
    issues.push({ code: "E-HSE-PPE-DATE", message: "تاریخ تحویل نامعتبر است" });
  }
  /* تجهیز حیاتی بدون تاریخ تعویض یعنی هیچ‌وقت کنترل نمی‌شود. */
  if (CRITICAL_PPE.includes(input.PpeType as PpeType) && input.PpeType === "harness" && !input.ReplaceDueDate) {
    issues.push({ code: "E-HSE-PPE-REPLACE-REQUIRED", message: "هارنس باید تاریخ تعویض داشته باشد" });
  }
  return issues;
}

export function validateHealthExamInput(input: Partial<HealthExamRow>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!String(input.ExamNo ?? "").trim()) {
    issues.push({ code: "E-HSE-EXAM-NO", message: "شمارهٔ معاینه الزامی است" });
  }
  if (!String(input.PersonRef ?? "").trim()) {
    issues.push({ code: "E-HSE-EXAM-PERSON", message: "شناسهٔ فرد الزامی است" });
  }
  if (!EXAM_TYPES.includes(input.ExamType as ExamType)) {
    issues.push({ code: "E-HSE-EXAM-TYPE", message: "نوع معاینه نامعتبر است" });
  }
  if (!FITNESS_RESULTS.includes(input.Fitness as FitnessResult)) {
    issues.push({ code: "E-HSE-EXAM-FITNESS", message: "نتیجهٔ معاینه نامعتبر است" });
  }
  if (!String(input.ExaminedAt ?? "").trim() || !Number.isFinite(new Date(String(input.ExaminedAt)).getTime())) {
    issues.push({ code: "E-HSE-EXAM-DATE", message: "تاریخ معاینه نامعتبر است" });
  }
  /* «مشروط» بدون شرح، برای سرپرست قابل اجرا نیست. */
  if (input.Fitness === "fit_with_restriction" && !String(input.RestrictionFa ?? "").trim()) {
    issues.push({
      code: "E-HSE-EXAM-RESTRICTION-REQUIRED",
      message: "نتیجهٔ «بلامانع مشروط» بدون شرح محدودیت ثبت نمی‌شود",
    });
  }
  return issues;
}

export function validateWasteInput(input: Partial<WasteLogRow>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!String(input.WasteNo ?? "").trim()) {
    issues.push({ code: "E-HSE-WASTE-NO", message: "شمارهٔ پسماند الزامی است" });
  }
  if (!WASTE_TYPES.includes(input.WasteType as WasteType)) {
    issues.push({ code: "E-HSE-WASTE-TYPE", message: "نوع پسماند نامعتبر است" });
  }
  if (!String(input.DescriptionFa ?? "").trim()) {
    issues.push({ code: "E-HSE-WASTE-DESC", message: "شرح پسماند الزامی است" });
  }
  const q = Number(input.Quantity);
  if (!Number.isFinite(q) || q <= 0) {
    issues.push({ code: "E-HSE-WASTE-QTY", message: "مقدار پسماند باید عددی مثبت باشد" });
  }
  if (!String(input.Unit ?? "").trim()) {
    issues.push({ code: "E-HSE-WASTE-UNIT", message: "واحد اندازه‌گیری الزامی است" });
  }
  if (!DISPOSAL_METHODS.includes(input.DisposalMethod as (typeof DISPOSAL_METHODS)[number])) {
    issues.push({ code: "E-HSE-WASTE-METHOD", message: "روش دفع نامعتبر است" });
  }
  /* مانیفست برای پسماند ویژه در لحظهٔ ثبت الزامی است، نه بعداً. */
  if (
    MANIFEST_REQUIRED_WASTE.includes(input.WasteType as WasteType) &&
    !String(input.ManifestNo ?? "").trim()
  ) {
    issues.push({
      code: "E-HSE-WASTE-MANIFEST-REQUIRED",
      message: `${WASTE_TYPE_FA[input.WasteType as string] ?? "این پسماند"} بدون شمارهٔ مانیفست حمل ثبت نمی‌شود`,
    });
  }
  return issues;
}

export function validateMonitoringInput(input: Partial<EnvMonitoringRow>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!String(input.ReadingNo ?? "").trim()) {
    issues.push({ code: "E-HSE-ENV-NO", message: "شمارهٔ اندازه‌گیری الزامی است" });
  }
  if (!MONITORING_MEDIA.includes(input.Medium as MonitoringMedium)) {
    issues.push({ code: "E-HSE-ENV-MEDIUM", message: "محیط اندازه‌گیری نامعتبر است" });
  }
  if (!String(input.ParameterFa ?? "").trim()) {
    issues.push({ code: "E-HSE-ENV-PARAM", message: "نام پارامتر الزامی است" });
  }
  const v = Number(input.MeasuredValue);
  if (!Number.isFinite(v)) {
    issues.push({ code: "E-HSE-ENV-VALUE", message: "مقدار اندازه‌گیری باید عدد باشد" });
  }
  const lim = Number(input.LimitValue);
  if (!Number.isFinite(lim) || lim <= 0) {
    issues.push({ code: "E-HSE-ENV-LIMIT", message: "حد مجاز باید عددی مثبت باشد" });
  }
  if (!String(input.Unit ?? "").trim()) {
    issues.push({ code: "E-HSE-ENV-UNIT", message: "واحد اندازه‌گیری الزامی است" });
  }
  if (!String(input.MeasuredAt ?? "").trim() || !Number.isFinite(new Date(String(input.MeasuredAt)).getTime())) {
    issues.push({ code: "E-HSE-ENV-DATE", message: "تاریخ اندازه‌گیری نامعتبر است" });
  }
  return issues;
}

/* ══════════════════════════════════════════════════════════════════
 * بخش ۷ — شاخص، نمرهٔ ایمنی و هشدار زودهنگام (زیرماژول ۰۸٫۶)
 *
 * پنج بخش پیشین هر کدام خلاصهٔ خودشان را می‌دادند، ولی هیچ‌کس آن‌ها را
 * کنار هم نمی‌گذاشت. مدیر پروژه برای پاسخ به «وضعیت ایمنی چطور است؟»
 * باید شش صفحه را می‌دید و خودش جمع می‌بست — که یعنی هیچ‌وقت نمی‌دید.
 *
 * دو قاعدهٔ حاکم بر این بخش:
 *
 * ۱. شاخصی که دادهٔ پایه‌اش نیست `null` است نه صفر. صفر یعنی «سنجیدیم و
 *    مشکلی نبود»؛ `null` یعنی «نمی‌دانیم». در ایمنی، این دو را یکی
 *    نشان‌دادن بدترین خطای ممکن است چون سکوت را به سلامت ترجمه می‌کند.
 *
 * ۲. نمرهٔ ترکیبی هرگز مانع‌ها را پنهان نمی‌کند. پروژه‌ای با دستور توقف
 *    کار فعال نباید نمرهٔ «خوب» بگیرد، هر قدر هم بقیهٔ شاخص‌ها خوب
 *    باشند — پس سقف نمره با وجود مانع‌های قطعی پایین کشیده می‌شود.
 * ══════════════════════════════════════════════════════════════════ */

/** شش شاخص رسمی ایمنی. */
export const HSE_METRIC_CODES = [
  "ltifr",
  "trir",
  "permit_compliance",
  "training_hours_per_worker",
  "violation_closure_rate",
  "hse_score",
] as const;
export type HseMetricCode = (typeof HSE_METRIC_CODES)[number];

export const HSE_METRIC_FA: Record<HseMetricCode, string> = {
  ltifr: "نرخ تکرار حادثهٔ منجر به از کارافتادگی",
  trir: "نرخ کل حوادث ثبت‌شدنی",
  permit_compliance: "انطباق پروانهٔ کار",
  training_hours_per_worker: "ساعت آموزش سرانه",
  violation_closure_rate: "نرخ رفع تخلف",
  hse_score: "نمرهٔ ایمنی",
};

export const HSE_METRIC_UNIT: Record<HseMetricCode, "rate" | "pct" | "hours" | "score"> = {
  ltifr: "rate",
  trir: "rate",
  permit_compliance: "pct",
  training_hours_per_worker: "hours",
  violation_closure_rate: "pct",
  hse_score: "score",
};

/**
 * جهت مطلوب هر شاخص.
 *
 * بدون این نگاشت، رنگ‌آمیزی داشبورد باید در UI حدس زده می‌شد و
 * «LTIFR بالا = سبز» یک اشتباه یک‌کاراکتری فاصله داشت.
 */
export const HSE_METRIC_DIRECTION: Record<HseMetricCode, "lower_better" | "higher_better"> = {
  ltifr: "lower_better",
  trir: "lower_better",
  permit_compliance: "higher_better",
  training_hours_per_worker: "higher_better",
  violation_closure_rate: "higher_better",
  hse_score: "higher_better",
};

/**
 * هدف پیش‌فرض هر شاخص.
 *
 * اعداد از عرف صنعت پیمانکاری نفت و گاز گرفته شده‌اند. هدفِ صریحِ
 * ثبت‌شده روی پروژه همیشه بر این مقادیر اولویت دارد.
 */
export const HSE_METRIC_DEFAULT_TARGET: Record<HseMetricCode, number> = {
  ltifr: 0.5,
  trir: 2,
  permit_compliance: 95,
  training_hours_per_worker: 8,
  violation_closure_rate: 90,
  hse_score: 80,
};

/** پنج قاعدهٔ هشدار زودهنگام. */
export const HSE_ALERT_RULES = [
  "unsafe_gas",
  "active_stop_work",
  "expired_permit",
  "training_gap",
  "env_exceedance",
] as const;
export type HseAlertRuleCode = (typeof HSE_ALERT_RULES)[number];

export const HSE_ALERT_RULE_FA: Record<HseAlertRuleCode, string> = {
  unsafe_gas: "گازسنجی ناایمن",
  active_stop_work: "دستور توقف کار فعال",
  expired_permit: "پروانهٔ منقضی بازنشده",
  training_gap: "شکاف آموزش ایمنی",
  env_exceedance: "تجاوز از حد مجاز زیست‌محیطی",
};

/**
 * آستانه و شدت پیش‌فرض هر قاعده.
 *
 * `unsafe_gas` و `active_stop_work` آستانهٔ صفر دارند: یک مورد هم
 * بیش از حد است. بقیه تحمل محدودی دارند چون در کارگاه زنده، صفرِ
 * مطلق یعنی هشدار همیشه روشن و هشدار همیشه‌روشن یعنی هشدار خاموش.
 */
export const HSE_ALERT_DEFAULTS: Record<
  HseAlertRuleCode,
  { threshold: number; comparison: "gt" | "gte" | "lt" | "lte" | "eq"; severity: Severity; ownerRole: string; actionFa: string }
> = {
  unsafe_gas: {
    threshold: 0,
    comparison: "gt",
    severity: "critical",
    ownerRole: "hse_officer",
    actionFa: "توقف فوری کار در محل، تخلیه و گازسنجی مجدد پیش از هر ادامه‌ای",
  },
  active_stop_work: {
    threshold: 0,
    comparison: "gt",
    severity: "critical",
    ownerRole: "project_manager",
    actionFa: "پیگیری رفع علت توقف و بستن اقدام اصلاحی پیش از درخواست آزادسازی",
  },
  expired_permit: {
    threshold: 0,
    comparison: "gt",
    severity: "high",
    ownerRole: "hse_officer",
    actionFa: "بستن رسمی پروانه‌های منقضی و بازگرداندن قفل‌ها و تجهیزات جداسازی",
  },
  training_gap: {
    threshold: 0,
    comparison: "gt",
    severity: "high",
    ownerRole: "hse_officer",
    actionFa: "برگزاری دورهٔ بدو ورود برای افراد فاقد گواهی و تعلیق کارت تردد آنان",
  },
  env_exceedance: {
    threshold: 0,
    comparison: "gt",
    severity: "medium",
    ownerRole: "hse_officer",
    actionFa: "ثبت اقدام اصلاحی و نمونه‌گیری مجدد؛ اطلاع به واحد محیط‌زیست کارفرما",
  },
};

/**
 * وزن هر شاخص در نمرهٔ ترکیبی.
 *
 * نرخ حادثه بیشترین وزن را دارد چون تنها شاخصی است که پیامد واقعی را
 * می‌سنجد؛ بقیه پیش‌نگرند. مجموع وزن‌ها ۱۰۰ است، ولی اگر شاخصی دادهٔ
 * پایه نداشته باشد وزنش از مخرج حذف می‌شود نه اینکه صفر گرفته شود.
 */
export const HSE_SCORE_WEIGHTS: Record<Exclude<HseMetricCode, "hse_score">, number> = {
  ltifr: 30,
  trir: 20,
  permit_compliance: 20,
  training_hours_per_worker: 15,
  violation_closure_rate: 15,
};

/** سقف نمره وقتی مانع قطعی وجود دارد. */
export const HSE_SCORE_BLOCKED_CAP = 55;

export type MetricSnapshotRow = {
  Id: string;
  ProjectId: string;
  PeriodCode: string;
  MetricCode: string;
  Value: number;
  Target?: number | null;
  Unit: string;
  CapturedAt: string;
  BaseManHours?: number | null;
  SampleSize?: number | null;
  IsEstimated?: boolean | null;
  NoteFa?: string | null;
  Status: string;
};

export type AlertRuleRow = {
  Id: string;
  ProjectId: string;
  RuleCode: string;
  TitleFa: string;
  Severity: string;
  Threshold: number;
  Comparison: string;
  IsEnabled?: boolean | null;
  MutedUntil?: string | null;
  MuteReasonFa?: string | null;
  OwnerRole?: string | null;
  ActionFa?: string | null;
  Status: string;
};

/**
 * کد دورهٔ گزارش از یک تاریخ.
 *
 * دوره میلادی-ماهانه است (`YYYY-MM`) چون دادهٔ پایه هم با تاریخ میلادی
 * ذخیره می‌شود؛ تبدیل به شمسی کار لایهٔ نمایش است تا مرز داده و نمایش
 * مخلوط نشود.
 */
export function periodCodeOf(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** بازهٔ کامل یک دورهٔ ماهانه. */
export function periodRange(periodCode: string): { from: string; to: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(periodCode).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = new Date(Date.UTC(y, mo - 1, 1));
  /* روز صفرِ ماه بعد = آخرین روز این ماه؛ ماه‌های ۲۸ تا ۳۱ روزه
   * خودبه‌خود درست می‌شوند. */
  const end = new Date(Date.UTC(y, mo, 0));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

/**
 * انطباق پروانهٔ کار.
 *
 * «منطبق» یعنی پروانه یا هنوز معتبر است یا رسمی بسته شده. پروانه‌ای که
 * منقضی شده و کسی نبسته، نشانهٔ رهاشدن کار است و همان چیزی است که در
 * بازرسی بیرونی گرفته می‌شود.
 */
export function permitComplianceMetric(
  permits: PermitRow[],
  now: Date = new Date(),
): { value: number | null; total: number; compliant: number; expiredOpen: number; warningsFa: string[] } {
  const warningsFa: string[] = [];
  if (!permits.length) {
    warningsFa.push("هیچ پروانهٔ کاری در این دوره ثبت نشده است");
    return { value: null, total: 0, compliant: 0, expiredOpen: 0, warningsFa };
  }

  let compliant = 0;
  let expiredOpen = 0;
  for (const p of permits) {
    const st = permitState(p, now);
    if (st.effectiveStatus === "expired" && p.Status !== "closed" && p.Status !== "cancelled") {
      expiredOpen += 1;
      continue;
    }
    compliant += 1;
  }
  return {
    value: round2((compliant / permits.length) * 100),
    total: permits.length,
    compliant,
    expiredOpen,
    warningsFa,
  };
}

/**
 * ساعت آموزش سرانه.
 *
 * مخرج «تعداد افراد یکتای حاضر» است نه «تعداد کارکنان پروژه»، چون
 * فهرست کارکنان در ماژول منابع انسانی است و اینجا در دسترس نیست.
 * این تفاوت در `noteFa` صریح گفته می‌شود تا کسی عدد را با شاخص
 * قراردادی کارفرما اشتباه نگیرد.
 */
export function trainingHoursMetric(args: {
  sessions: TrainingSessionRow[];
  attendees: TrainingAttendeeRow[];
  headCount?: number | null;
  from?: string;
  to?: string;
}): { value: number | null; totalManHours: number; personCount: number; basis: "headcount" | "attendees"; warningsFa: string[] } {
  const { sessions, attendees, headCount, from, to } = args;
  const warningsFa: string[] = [];

  const f = from ? new Date(from).getTime() : null;
  const t = to ? new Date(to).getTime() : null;
  const inRange = (iso: string) => {
    const d = new Date(iso).getTime();
    if (!Number.isFinite(d)) return false;
    if (f !== null && d < f) return false;
    if (t !== null && d > t + 86_399_999) return false;
    return true;
  };

  const held = sessions.filter((s) => s.Status === "held" && inRange(String(s.HeldAt)));
  const heldIds = new Set(held.map((s) => s.Id));
  const durationById = new Map(held.map((s) => [s.Id, Number(s.DurationMinutes) || 0]));

  let totalMinutes = 0;
  const persons = new Set<string>();
  for (const a of attendees) {
    if (!heldIds.has(a.SessionId)) continue;
    if (a.Attended === false) continue;
    totalMinutes += durationById.get(a.SessionId) ?? 0;
    persons.add(a.PersonRef);
  }

  const totalManHours = round2(totalMinutes / 60);

  /* شمار کارکنانِ صریح همیشه بهتر است؛ اگر نبود، به حاضران برمی‌گردیم
   * ولی این را پنهان نمی‌کنیم چون عدد را خوش‌بینانه می‌کند. */
  const explicit = Number(headCount);
  if (Number.isFinite(explicit) && explicit > 0) {
    return {
      value: round2(totalManHours / explicit),
      totalManHours,
      personCount: explicit,
      basis: "headcount",
      warningsFa,
    };
  }

  if (!persons.size) {
    warningsFa.push("هیچ حاضری در جلسات این دوره ثبت نشده است");
    return { value: null, totalManHours, personCount: 0, basis: "attendees", warningsFa };
  }

  warningsFa.push(
    "شمار کارکنان پروژه در دسترس نبود؛ سرانه بر پایهٔ افراد حاضر محاسبه شده و از مقدار واقعی بالاتر است",
  );
  return {
    value: round2(totalManHours / persons.size),
    totalManHours,
    personCount: persons.size,
    basis: "attendees",
    warningsFa,
  };
}

/**
 * نرخ رفع تخلف.
 *
 * مخرج فقط تخلف‌هایی است که مهلتشان در این دوره سررسید شده؛ تخلفی که
 * هنوز فرصت دارد، «رفع‌نشده» نیست و شمردنش نرخ را ناعادلانه پایین
 * می‌آورد.
 */
export function violationClosureMetric(
  violations: ViolationRow[],
  now: Date = new Date(),
): { value: number | null; due: number; closed: number; overdue: number; warningsFa: string[] } {
  const warningsFa: string[] = [];
  const nowMs = now.getTime();

  const due = violations.filter((v) => {
    if (v.Status === "cancelled") return false;
    if (v.Status === "closed" || v.Status === "released") return true;
    const d = v.DueDate ? new Date(String(v.DueDate)).getTime() : NaN;
    return Number.isFinite(d) && d + 86_399_999 < nowMs;
  });

  if (!due.length) {
    warningsFa.push("هیچ تخلفی در این دوره سررسید نشده است");
    return { value: null, due: 0, closed: 0, overdue: 0, warningsFa };
  }

  const closed = due.filter((v) => v.Status === "closed" || v.Status === "released").length;
  return {
    value: round2((closed / due.length) * 100),
    due: due.length,
    closed,
    overdue: due.length - closed,
    warningsFa,
  };
}

/**
 * وضعیت یک شاخص در برابر هدفش.
 *
 * `null` بودن مقدار به «نامعلوم» ترجمه می‌شود نه «قبول» — تفاوتی که
 * کل ارزش این بخش به آن بستگی دارد.
 */
export function metricVerdict(
  code: HseMetricCode,
  value: number | null,
  target?: number | null,
): { code: string; fa: string; color: string; isMet: boolean | null } {
  if (value == null || !Number.isFinite(value)) {
    return { code: "unknown", fa: "نامعلوم — دادهٔ پایه ناقص است", color: "#6B7280", isMet: null };
  }
  const t = Number.isFinite(Number(target)) ? Number(target) : HSE_METRIC_DEFAULT_TARGET[code];
  const lower = HSE_METRIC_DIRECTION[code] === "lower_better";
  const met = lower ? value <= t : value >= t;
  if (met) return { code: "met", fa: "در حد هدف", color: "#059669", isMet: true };

  /* فاصلهٔ تا هدف تعیین می‌کند هشدار است یا شکست؛ ۲۰ درصد انحراف مرز
   * عرفی گزارش‌های ایمنی است. */
  const gap = lower ? (value - t) / (t || 1) : (t - value) / (t || 1);
  if (gap <= 0.2) return { code: "near", fa: "نزدیک هدف", color: "#D97706", isMet: false };
  return { code: "missed", fa: "خارج از هدف", color: "#DC2626", isMet: false };
}

/**
 * محاسبهٔ شش شاخص برای یک دوره.
 *
 * همهٔ ورودی‌ها اختیاری‌اند: پروژه‌ای که هنوز پروانه‌ای صادر نکرده باید
 * بتواند شاخص حادثه‌اش را ببیند بدون اینکه بقیه صفر شوند.
 */
export function hseMetricSet(args: {
  periodCode: string;
  incidents?: IncidentRow[];
  persons?: InjuredPersonRow[];
  manHourLogs?: ManHourRow[];
  permits?: PermitRow[];
  violations?: ViolationRow[];
  sessions?: TrainingSessionRow[];
  attendees?: TrainingAttendeeRow[];
  headCount?: number | null;
  targets?: Partial<Record<HseMetricCode, number>>;
  now?: Date;
}): {
  periodCode: string;
  from: string | null;
  to: string | null;
  metrics: {
    code: HseMetricCode;
    titleFa: string;
    unit: string;
    value: number | null;
    target: number;
    verdict: ReturnType<typeof metricVerdict>;
    detailFa: string;
  }[];
  manHours: number | null;
  warningsFa: string[];
} {
  const {
    periodCode,
    incidents = [],
    persons = [],
    manHourLogs = [],
    permits = [],
    violations = [],
    sessions = [],
    attendees = [],
    headCount,
    targets = {},
    now = new Date(),
  } = args;

  const range = periodRange(periodCode);
  const from = range?.from ?? undefined;
  const to = range?.to ?? undefined;
  const warningsFa: string[] = [];

  const safety = safetyMetricsFull({ incidents, persons, manHourLogs, from, to });
  warningsFa.push(...safety.warningsFa);

  /* پروانه و تخلف بر پایهٔ تاریخ صدور در دوره فیلتر می‌شوند. */
  const inRange = (iso?: string | null) => {
    if (!range) return true;
    const d = iso ? new Date(String(iso)).getTime() : NaN;
    if (!Number.isFinite(d)) return false;
    return d >= new Date(range.from).getTime() && d <= new Date(range.to).getTime() + 86_399_999;
  };

  const periodPermits = permits.filter((p) => inRange(p.ValidFrom));
  const periodViolations = violations.filter((v) => inRange(v.IssuedAt));

  const compliance = permitComplianceMetric(periodPermits, now);
  warningsFa.push(...compliance.warningsFa);

  const training = trainingHoursMetric({ sessions, attendees, headCount, from, to });
  warningsFa.push(...training.warningsFa);

  const closure = violationClosureMetric(periodViolations, now);
  warningsFa.push(...closure.warningsFa);

  const raw: Record<Exclude<HseMetricCode, "hse_score">, { value: number | null; detailFa: string }> = {
    ltifr: {
      value: safety.ltifr,
      detailFa: safety.manHours
        ? `${safety.lostTime} حادثهٔ منجر به از کارافتادگی در ${round2(safety.manHours).toLocaleString("fa-IR")} نفرساعت`
        : "نفرساعت ثبت نشده است",
    },
    trir: {
      value: safety.trir,
      detailFa: safety.manHours
        ? `${safety.recordable} حادثهٔ ثبت‌شدنی در ${round2(safety.manHours).toLocaleString("fa-IR")} نفرساعت`
        : "نفرساعت ثبت نشده است",
    },
    permit_compliance: {
      value: compliance.value,
      detailFa: compliance.total
        ? `${compliance.compliant} از ${compliance.total} پروانه منطبق · ${compliance.expiredOpen} منقضی بازنشده`
        : "پروانه‌ای ثبت نشده است",
    },
    training_hours_per_worker: {
      value: training.value,
      detailFa: training.personCount
        ? `${training.totalManHours} نفرساعت آموزش برای ${training.personCount} نفر (${training.basis === "headcount" ? "شمار کارکنان" : "افراد حاضر"})`
        : "حاضری ثبت نشده است",
    },
    violation_closure_rate: {
      value: closure.value,
      detailFa: closure.due
        ? `${closure.closed} از ${closure.due} تخلف سررسیدشده رفع شده · ${closure.overdue} معوق`
        : "تخلف سررسیدشده‌ای نیست",
    },
  };

  const metrics = (Object.keys(raw) as Exclude<HseMetricCode, "hse_score">[]).map((code) => {
    const target = Number.isFinite(Number(targets[code])) ? Number(targets[code]) : HSE_METRIC_DEFAULT_TARGET[code];
    return {
      code: code as HseMetricCode,
      titleFa: HSE_METRIC_FA[code],
      unit: HSE_METRIC_UNIT[code],
      value: raw[code].value,
      target,
      verdict: metricVerdict(code, raw[code].value, target),
      detailFa: raw[code].detailFa,
    };
  });

  return {
    periodCode,
    from: range?.from ?? null,
    to: range?.to ?? null,
    metrics,
    manHours: safety.manHours,
    warningsFa: [...new Set(warningsFa)],
  };
}

/**
 * ارزیابی پنج قاعدهٔ هشدار در برابر وضعیت جاری.
 *
 * قاعده‌ای که در سامانه ثبت نشده باشد با مقدار پیش‌فرض ارزیابی می‌شود —
 * یعنی پروژه‌ای که هرگز قاعده تعریف نکرده باز هم هشدار می‌گیرد. اگر
 * برعکس بود، فراموشیِ پیکربندی به سکوت ترجمه می‌شد.
 */
export function evaluateHseAlerts(args: {
  rules?: AlertRuleRow[];
  gasTests?: GasTestRow[];
  violations?: ViolationRow[];
  permits?: PermitRow[];
  trainings?: TrainingRow[];
  personRefs?: string[];
  readings?: EnvMonitoringRow[];
  now?: Date;
}): {
  alerts: {
    ruleCode: HseAlertRuleCode;
    titleFa: string;
    severity: string;
    isTriggered: boolean;
    isMuted: boolean;
    observed: number;
    threshold: number;
    comparison: string;
    ownerRole: string;
    actionFa: string;
    detailFa: string;
  }[];
  triggeredCount: number;
  criticalCount: number;
  mutedCount: number;
  blockingFa: string[];
  warningsFa: string[];
} {
  const {
    rules = [],
    gasTests = [],
    violations = [],
    permits = [],
    trainings = [],
    personRefs = [],
    readings = [],
    now = new Date(),
  } = args;

  const byCode = new Map(rules.filter((r) => r.Status !== "retired").map((r) => [r.RuleCode, r]));
  const warningsFa: string[] = [];
  const nowMs = now.getTime();

  /* ── مشاهدهٔ هر قاعده ── */
  const unsafeGas = gasTests.filter((g) => g.IsSafe === false).length;

  const activeStopWork = violations.filter((v) => {
    const st = violationState(v, now);
    return st.isBlocking;
  }).length;

  const expiredPermits = permits.filter((p) => {
    const st = permitState(p, now);
    return st.effectiveStatus === "expired" && p.Status !== "closed" && p.Status !== "cancelled";
  }).length;

  /* شکاف آموزش فقط وقتی سنجیدنی است که فهرست افراد داده شده باشد؛
   * وگرنه «صفر نفر بدون آموزش» ادعایی است که پشتوانه ندارد. */
  let trainingGap = 0;
  let trainingMeasurable = true;
  if (!personRefs.length) {
    trainingMeasurable = false;
    warningsFa.push("فهرست افراد کارگاه در دسترس نبود؛ شکاف آموزش سنجیده نشد");
  } else {
    for (const ref of personRefs) {
      const m = personTrainingMatrix({ personRef: ref, records: trainings, now });
      if (!m.isCleared) trainingGap += 1;
    }
  }

  const envExceedance = readings.filter((r) => {
    const st = monitoringState(r);
    return st.needsAction;
  }).length;

  const observed: Record<HseAlertRuleCode, number> = {
    unsafe_gas: unsafeGas,
    active_stop_work: activeStopWork,
    expired_permit: expiredPermits,
    training_gap: trainingGap,
    env_exceedance: envExceedance,
  };

  const compare = (v: number, op: string, t: number): boolean => {
    switch (op) {
      case "gte": return v >= t;
      case "lt": return v < t;
      case "lte": return v <= t;
      case "eq": return v === t;
      case "gt":
      default: return v > t;
    }
  };

  const alerts = HSE_ALERT_RULES.map((code) => {
    const def = HSE_ALERT_DEFAULTS[code];
    const row = byCode.get(code);
    const threshold = row && Number.isFinite(Number(row.Threshold)) ? Number(row.Threshold) : def.threshold;
    const comparison = row?.Comparison || def.comparison;
    const severity = row?.Severity || def.severity;
    const enabled = row ? row.IsEnabled !== false : true;

    /* سکوت موقت فقط تا تاریخ پایانش معتبر است؛ سکوت بی‌پایان همان
     * خاموش‌کردن است و باید صریح باشد. */
    const mutedUntil = row?.MutedUntil ? new Date(String(row.MutedUntil)).getTime() : NaN;
    const isMuted = !enabled || (Number.isFinite(mutedUntil) && mutedUntil + 86_399_999 >= nowMs);

    const value = observed[code];
    const measurable = code === "training_gap" ? trainingMeasurable : true;
    const isTriggered = measurable && !isMuted && compare(value, comparison, threshold);

    let detailFa: string;
    if (!measurable) detailFa = "قابل سنجش نبود";
    else if (isMuted) detailFa = row?.MuteReasonFa ? `در سکوت: ${row.MuteReasonFa}` : "در سکوت موقت";
    else if (!isTriggered) detailFa = "در وضعیت عادی";
    else {
      switch (code) {
        case "unsafe_gas": detailFa = `${value} گازسنجی ناایمن ثبت شده است`; break;
        case "active_stop_work": detailFa = `${value} دستور توقف کار فعال است`; break;
        case "expired_permit": detailFa = `${value} پروانه منقضی شده و بسته نشده است`; break;
        case "training_gap": detailFa = `${value} نفر فاقد آموزش معتبر بدو ورود هستند`; break;
        default: detailFa = `${value} اندازه‌گیری فراتر از حد بدون اقدام اصلاحی است`;
      }
    }

    return {
      ruleCode: code,
      titleFa: row?.TitleFa || HSE_ALERT_RULE_FA[code],
      severity,
      isTriggered,
      isMuted,
      observed: value,
      threshold,
      comparison,
      ownerRole: row?.OwnerRole || def.ownerRole,
      actionFa: row?.ActionFa || def.actionFa,
      detailFa,
    };
  });

  const triggered = alerts.filter((a) => a.isTriggered);
  const critical = triggered.filter((a) => a.severity === "critical");

  return {
    alerts,
    triggeredCount: triggered.length,
    criticalCount: critical.length,
    mutedCount: alerts.filter((a) => a.isMuted).length,
    blockingFa: critical.map((a) => `${a.titleFa}: ${a.detailFa}`),
    warningsFa,
  };
}

/**
 * نمرهٔ ایمنی ترکیبی.
 *
 * هر شاخص به نمرهٔ صفر تا صد نگاشت می‌شود، سپس با وزنش میانگین گرفته
 * می‌شود. شاخص بدون داده از **مخرج** حذف می‌شود نه اینکه صفر بگیرد —
 * وگرنه پروژهٔ تازه‌شروع‌شده نمرهٔ فاجعه‌بار می‌گرفت و کسی به نمره
 * اعتماد نمی‌کرد.
 *
 * سقف نمره با وجود هشدار بحرانی پایین کشیده می‌شود: نمرهٔ ۹۰ برای
 * کارگاهی که دستور توقف کار فعال دارد، عددِ درستِ بی‌معناست.
 */
export function hseScore(args: {
  metrics: ReturnType<typeof hseMetricSet>["metrics"];
  alerts?: ReturnType<typeof evaluateHseAlerts>;
}): {
  score: number | null;
  band: { code: string; fa: string; color: string };
  coveragePct: number;
  contributions: { code: string; titleFa: string; weight: number; normalized: number | null }[];
  isCapped: boolean;
  capReasonFa: string[];
  warningsFa: string[];
} {
  const { metrics, alerts } = args;
  const warningsFa: string[] = [];

  const contributions: { code: string; titleFa: string; weight: number; normalized: number | null }[] = [];
  let weighted = 0;
  let usedWeight = 0;
  let totalWeight = 0;

  for (const m of metrics) {
    if (m.code === "hse_score") continue;
    const weight = HSE_SCORE_WEIGHTS[m.code as Exclude<HseMetricCode, "hse_score">] ?? 0;
    totalWeight += weight;

    if (m.value == null || !Number.isFinite(m.value)) {
      contributions.push({ code: m.code, titleFa: m.titleFa, weight, normalized: null });
      continue;
    }

    /* نگاشت به صفر تا صد: برای شاخص «کمتر بهتر»، رسیدن به هدف نمرهٔ
     * کامل می‌دهد و دو برابر هدف نمرهٔ صفر. برای «بیشتر بهتر» نسبت
     * مستقیم است. هر دو کلامپ می‌شوند. */
    const target = m.target || HSE_METRIC_DEFAULT_TARGET[m.code];
    let normalized: number;
    if (HSE_METRIC_DIRECTION[m.code] === "lower_better") {
      normalized = target <= 0
        ? (m.value <= 0 ? 100 : 0)
        : 100 * (1 - (m.value - target) / target);
      if (m.value <= target) normalized = 100;
    } else {
      normalized = target <= 0 ? 100 : (m.value / target) * 100;
    }
    normalized = Math.max(0, Math.min(100, round2(normalized)));

    contributions.push({ code: m.code, titleFa: m.titleFa, weight, normalized });
    weighted += normalized * weight;
    usedWeight += weight;
  }

  if (!usedWeight) {
    warningsFa.push("هیچ شاخصی دادهٔ کافی نداشت؛ نمرهٔ ایمنی محاسبه نشد");
    return {
      score: null,
      band: { code: "unknown", fa: "نامعلوم", color: "#6B7280" },
      coveragePct: 0,
      contributions,
      isCapped: false,
      capReasonFa: [],
      warningsFa,
    };
  }

  const coveragePct = round2((usedWeight / (totalWeight || 1)) * 100);
  if (coveragePct < 60) {
    warningsFa.push(`نمره تنها بر پایهٔ ${coveragePct} درصد وزن شاخص‌ها محاسبه شده و قابل اتکا نیست`);
  }

  let score = round2(weighted / usedWeight);

  const capReasonFa: string[] = [];
  if (alerts && alerts.criticalCount > 0 && score > HSE_SCORE_BLOCKED_CAP) {
    score = HSE_SCORE_BLOCKED_CAP;
    capReasonFa.push(...alerts.blockingFa);
    warningsFa.push(`نمره به‌دلیل ${alerts.criticalCount} هشدار بحرانی به سقف ${HSE_SCORE_BLOCKED_CAP} محدود شد`);
  }

  const band =
    score >= 85 ? { code: "excellent", fa: "عالی", color: "#059669" }
      : score >= 70 ? { code: "good", fa: "قابل قبول", color: "#65A30D" }
        : score >= 55 ? { code: "fair", fa: "نیازمند بهبود", color: "#D97706" }
          : { code: "poor", fa: "بحرانی", color: "#DC2626" };

  return {
    score,
    band,
    coveragePct,
    contributions,
    isCapped: capReasonFa.length > 0,
    capReasonFa,
    warningsFa,
  };
}

/**
 * روند یک شاخص در چند دوره.
 *
 * جهت روند با توجه به «کمتر بهتر» یا «بیشتر بهتر» تفسیر می‌شود، وگرنه
 * کاهش LTIFR در داشبورد قرمز نشان داده می‌شد.
 */
export function metricTrend(
  snapshots: MetricSnapshotRow[],
  metricCode: HseMetricCode,
): {
  metricCode: HseMetricCode;
  titleFa: string;
  points: { periodCode: string; value: number; isEstimated: boolean }[];
  latest: number | null;
  previous: number | null;
  changePct: number | null;
  direction: "improving" | "worsening" | "flat" | "unknown";
  directionFa: string;
} {
  const points = snapshots
    .filter((s) => s.MetricCode === metricCode && s.Status !== "superseded")
    .map((s) => ({
      periodCode: String(s.PeriodCode),
      value: Number(s.Value),
      isEstimated: s.IsEstimated === true,
    }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.periodCode.localeCompare(b.periodCode));

  const titleFa = HSE_METRIC_FA[metricCode];
  if (points.length < 2) {
    return {
      metricCode,
      titleFa,
      points,
      latest: points.length ? points[points.length - 1].value : null,
      previous: null,
      changePct: null,
      direction: "unknown",
      directionFa: "روند هنوز قابل تشخیص نیست",
    };
  }

  const latest = points[points.length - 1].value;
  const previous = points[points.length - 2].value;
  const changePct = previous === 0 ? null : round2(((latest - previous) / Math.abs(previous)) * 100);

  const lower = HSE_METRIC_DIRECTION[metricCode] === "lower_better";
  let direction: "improving" | "worsening" | "flat";
  if (latest === previous) direction = "flat";
  else if (latest < previous) direction = lower ? "improving" : "worsening";
  else direction = lower ? "worsening" : "improving";

  const directionFa =
    direction === "improving" ? "رو به بهبود"
      : direction === "worsening" ? "رو به بدتر شدن"
        : "بدون تغییر";

  return { metricCode, titleFa, points, latest, previous, changePct, direction, directionFa };
}

/**
 * داشبورد کامل ایمنی: شاخص، هشدار، نمره و روند در یک پاسخ.
 *
 * یک تابع به‌جای شش فراخوانی جدا، تا داشبورد نتواند ترکیبی از
 * دوره‌های ناهمخوان نشان دهد.
 */
export function hseDashboard(args: Parameters<typeof hseMetricSet>[0] & {
  rules?: AlertRuleRow[];
  gasTests?: GasTestRow[];
  trainings?: TrainingRow[];
  personRefs?: string[];
  readings?: EnvMonitoringRow[];
  snapshots?: MetricSnapshotRow[];
}): {
  periodCode: string;
  from: string | null;
  to: string | null;
  metrics: ReturnType<typeof hseMetricSet>["metrics"];
  manHours: number | null;
  alerts: ReturnType<typeof evaluateHseAlerts>;
  score: ReturnType<typeof hseScore>;
  trends: ReturnType<typeof metricTrend>[];
  warningsFa: string[];
} {
  const set = hseMetricSet(args);
  const alerts = evaluateHseAlerts({
    rules: args.rules,
    gasTests: args.gasTests,
    violations: args.violations,
    permits: args.permits,
    trainings: args.trainings,
    personRefs: args.personRefs,
    readings: args.readings,
    now: args.now,
  });
  const score = hseScore({ metrics: set.metrics, alerts });

  const snapshots = args.snapshots ?? [];
  const trends = snapshots.length
    ? HSE_METRIC_CODES.map((c) => metricTrend(snapshots, c)).filter((t) => t.points.length > 0)
    : [];

  return {
    periodCode: set.periodCode,
    from: set.from,
    to: set.to,
    metrics: set.metrics,
    manHours: set.manHours,
    alerts,
    score,
    trends,
    warningsFa: [...new Set([...set.warningsFa, ...alerts.warningsFa, ...score.warningsFa])],
  };
}

/**
 * ردیف‌های عکس شاخص برای ذخیره‌سازی.
 *
 * نمرهٔ ایمنی هم به‌عنوان یک شاخص ذخیره می‌شود تا ماژول پایش بتواند
 * بدون بازمحاسبه آن را در شاخص سلامت پروژه تزریق کند.
 */
export function buildMetricSnapshots(args: {
  projectId: string;
  periodCode: string;
  dashboard: ReturnType<typeof hseDashboard>;
  capturedAt?: string;
}): Omit<MetricSnapshotRow, "Id">[] {
  const { projectId, periodCode, dashboard, capturedAt } = args;
  const at = capturedAt || new Date().toISOString();
  const rows: Omit<MetricSnapshotRow, "Id">[] = [];

  for (const m of dashboard.metrics) {
    if (m.value == null) continue;
    rows.push({
      ProjectId: projectId,
      PeriodCode: periodCode,
      MetricCode: m.code,
      Value: m.value,
      Target: m.target,
      Unit: HSE_METRIC_UNIT[m.code],
      CapturedAt: at,
      BaseManHours: dashboard.manHours ?? null,
      SampleSize: null,
      IsEstimated: dashboard.manHours == null,
      NoteFa: m.detailFa,
      Status: "published",
    });
  }

  if (dashboard.score.score != null) {
    rows.push({
      ProjectId: projectId,
      PeriodCode: periodCode,
      MetricCode: "hse_score",
      Value: dashboard.score.score,
      Target: HSE_METRIC_DEFAULT_TARGET.hse_score,
      Unit: "score",
      CapturedAt: at,
      BaseManHours: dashboard.manHours ?? null,
      SampleSize: dashboard.score.contributions.filter((c) => c.normalized != null).length,
      /* پوشش کمتر از کامل یعنی نمره برآوردی است، حتی اگر عدد دقیق
       * به نظر برسد. */
      IsEstimated: dashboard.score.coveragePct < 100,
      NoteFa: dashboard.score.isCapped
        ? `محدودشده به سقف: ${dashboard.score.capReasonFa.join("؛ ")}`
        : `پوشش ${dashboard.score.coveragePct} درصد وزن شاخص‌ها`,
      Status: "published",
    });
  }

  return rows;
}

/**
 * سهم ایمنی در شاخص سلامت پروژه.
 *
 * ماژول پایش پیش از این مقدار ثابتی برای بُعد ایمنی داشت. این تابع
 * همان جای خالی را پر می‌کند و صریح می‌گوید که مقدار برآوردی است یا
 * سنجیده‌شده، تا شاخص سلامت ترکیبی نتواند قطعیتی را ادعا کند که
 * پشتوانه ندارد.
 */
export function hseHealthContribution(args: {
  score: ReturnType<typeof hseScore>;
  alerts: ReturnType<typeof evaluateHseAlerts>;
}): {
  kpiCode: string;
  value: number | null;
  status: "green" | "amber" | "red" | "unknown";
  isReliable: boolean;
  summaryFa: string;
} {
  const { score, alerts } = args;
  if (score.score == null) {
    return {
      kpiCode: "hse_score",
      value: null,
      status: "unknown",
      isReliable: false,
      summaryFa: "نمرهٔ ایمنی به‌دلیل نبود دادهٔ پایه محاسبه نشد",
    };
  }

  /* هشدار بحرانی وضعیت را قرمز می‌کند حتی اگر عدد در محدودهٔ کهربایی
   * باشد؛ رنگ باید کاری را نشان دهد که باید انجام شود. */
  const status: "green" | "amber" | "red" =
    alerts.criticalCount > 0 ? "red"
      : score.score >= 85 ? "green"
        : score.score >= 70 ? "amber"
          : score.score >= 55 ? "amber"
            : "red";

  const parts = [`نمرهٔ ایمنی ${score.score} (${score.band.fa})`];
  if (alerts.triggeredCount) parts.push(`${alerts.triggeredCount} هشدار فعال`);
  if (alerts.criticalCount) parts.push(`${alerts.criticalCount} مورد بحرانی`);
  if (score.coveragePct < 100) parts.push(`پوشش داده ${score.coveragePct} درصد`);

  return {
    kpiCode: "hse_score",
    value: score.score,
    status,
    isReliable: score.coveragePct >= 60 && !score.isCapped,
    summaryFa: parts.join(" · "),
  };
}

/** اعتبارسنجی ورودی قاعدهٔ هشدار. */
export function validateAlertRuleInput(input: Partial<AlertRuleRow>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!HSE_ALERT_RULES.includes(String(input.RuleCode) as HseAlertRuleCode)) {
    issues.push({ code: "E-HSE-ALERT-CODE", message: "کد قاعدهٔ هشدار نامعتبر است" });
  }
  if (!String(input.TitleFa ?? "").trim()) {
    issues.push({ code: "E-HSE-ALERT-TITLE", message: "عنوان قاعده الزامی است" });
  }
  if (!SEVERITIES.includes(String(input.Severity) as Severity)) {
    issues.push({ code: "E-HSE-ALERT-SEVERITY", message: "شدت هشدار نامعتبر است" });
  }
  const th = Number(input.Threshold);
  if (!Number.isFinite(th) || th < 0) {
    issues.push({ code: "E-HSE-ALERT-THRESHOLD", message: "آستانه باید عددی نامنفی باشد" });
  }
  if (!["gt", "gte", "lt", "lte", "eq"].includes(String(input.Comparison))) {
    issues.push({ code: "E-HSE-ALERT-COMPARISON", message: "عملگر مقایسه نامعتبر است" });
  }
  /* سکوت بدون دلیل، همان خاموش‌کردن بی‌سروصداست و در ممیزی قابل دفاع
   * نیست. */
  if (input.MutedUntil && !String(input.MuteReasonFa ?? "").trim()) {
    issues.push({ code: "E-HSE-ALERT-MUTE-REASON", message: "برای سکوت موقت، ذکر دلیل الزامی است" });
  }
  if (input.MutedUntil && !Number.isFinite(new Date(String(input.MutedUntil)).getTime())) {
    issues.push({ code: "E-HSE-ALERT-MUTE-DATE", message: "تاریخ پایان سکوت نامعتبر است" });
  }
  return issues;
}
