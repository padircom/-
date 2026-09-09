/**
 * CKM — موتور مدیریت ارتباطات و دانش
 * منبع یگانه منطق. آینه سرور با `npm run build:ckm` ساخته می‌شود.
 *
 * اصول حاکم:
 * ۱) نامه‌ای که تعهد قراردادی دارد بدون مهلت پاسخ ثبت نمی‌شود.
 * ۲) هر مصوبه جلسه باید مالک و موعد داشته باشد، وگرنه مصوبه نیست.
 * ۳) درس‌آموخته بدون منشأ و بدون ردیابی استفاده مجدد، دانش نیست؛ بایگانی است.
 * ۴) ذی‌نفع با سطح تعامل مطلوب سنجیده می‌شود، نه با فهرست اسامی.
 */

import { IRAN_CALENDAR, addWorkingDays, isWorkingDay, type WorkCalendar } from "./planning";

export const CKM_FORMULA_VERSION = "ckm-v1";

/** کد دامنه در یک نقطه متمرکز — تغییر آن تک‌خطی است. */
export const CKM_DOMAIN_ID = "d11";

/* ══════════════════════════ مکاتبات ══════════════════════════ */

export type LetterDirection = "incoming" | "outgoing";

export type LetterStatus =
  | "draft" | "registered" | "under_review" | "responded" | "closed" | "overdue";

/** طبقه‌بندی قراردادی نامه — تعیین‌کننده مهلت و پیامد حقوقی. */
export type LetterClass =
  | "general"        // مکاتبه عادی، بدون تعهد
  | "instruction"    // دستور کار کارفرما
  | "notice"         // اعلان قراردادی (Time-Bar دارد)
  | "claim_notice"   // اعلان ادعا — بحرانی‌ترین نوع
  | "submittal"      // ارسال مدرک برای تأیید
  | "rfi"            // درخواست اطلاعات
  | "ncr_related";   // مرتبط با عدم انطباق

export type Letter = {
  id: string;
  ref: string;
  direction: LetterDirection;
  letterClass: LetterClass;
  subject: string;
  from: string;
  to: string;
  issuedAt: string;      // ISO
  receivedAt?: string;   // تاریخ ثبت در دبیرخانه
  /** مهلت پاسخ بر حسب روز — اگر تعریف نشود از جدول پیش‌فرض کلاس گرفته می‌شود */
  responseDays?: number;
  respondedAt?: string;
  status: LetterStatus;
  /** ارجاع متقابل: ادعا، تغییر، ریسک، NCR یا فعالیت */
  links?: string[];
  ownerRole?: string;
  attachments?: number;
};

/**
 * مهلت پیش‌فرض پاسخ به تفکیک کلاس نامه (روز کاری).
 * مبنا: عرف قراردادهای EPC ایران و FIDIC — اعلان ادعا ۲۸ روز تقویمی که
 * محافظه‌کارانه به ۲۰ روز کاری تبدیل شده است.
 */
export const DEFAULT_RESPONSE_DAYS: Record<LetterClass, number> = {
  general: 14,
  instruction: 7,
  notice: 14,
  claim_notice: 20,
  submittal: 10,
  rfi: 5,
  ncr_related: 7,
};

/** آیا این کلاس نامه مهلت قراردادی الزام‌آور دارد؟ */
export function isTimeBarred(letterClass: LetterClass): boolean {
  return letterClass === "claim_notice" || letterClass === "notice";
}

export type DueResult = {
  dueDate: string;
  daysRemaining: number;
  overdue: boolean;
  /** نامه‌ای که مهلت قراردادی دارد و از دست رفته — حق ادعا ساقط می‌شود */
  timeBarBreached: boolean;
  severity: "ok" | "due_soon" | "overdue" | "critical";
};

/**
 * مهلت پاسخ بر پایه روز کاری تقویم پروژه (نه روز تقویمی).
 * از همان `addWorkingDays` ماژول برنامه‌ریزی استفاده می‌کند تا تقویم یگانه بماند.
 */
export function responseDue(
  letter: Letter,
  today: string,
  cal: WorkCalendar = IRAN_CALENDAR
): DueResult {
  const base = letter.receivedAt ?? letter.issuedAt;
  const days = letter.responseDays ?? DEFAULT_RESPONSE_DAYS[letter.letterClass];
  const dueDate = addWorkingDays(base, days, cal);
  const remaining = workingDaysBetween(today, dueDate, cal);
  const answered = !!letter.respondedAt;
  const overdue = !answered && remaining < 0;
  const timeBarBreached = overdue && isTimeBarred(letter.letterClass);

  let severity: DueResult["severity"] = "ok";
  if (answered) severity = "ok";
  else if (timeBarBreached) severity = "critical";
  else if (overdue) severity = "overdue";
  else if (remaining <= 3) severity = "due_soon";

  return { dueDate, daysRemaining: remaining, overdue, timeBarBreached, severity };
}

/** شمارش روزهای کاری بین دو تاریخ؛ منفی یعنی تاریخ دوم گذشته است. */
export function workingDaysBetween(fromIso: string, toIso: string, cal: WorkCalendar = IRAN_CALENDAR): number {
  if (fromIso === toIso) return 0;
  const forward = fromIso < toIso;
  const [a, b] = forward ? [fromIso, toIso] : [toIso, fromIso];
  let count = 0;
  const d = new Date(a + "T00:00:00Z");
  const end = new Date(b + "T00:00:00Z");
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorkingDay(d.toISOString().slice(0, 10), cal)) count++;
  }
  return forward ? count : -count;
}

/** میانگین زمان پاسخ‌گویی بر حسب روز کاری — شاخص کلیدی سلامت ارتباطات. */
export function averageResponseTime(letters: Letter[], cal: WorkCalendar = IRAN_CALENDAR): number {
  const answered = letters.filter((l) => l.respondedAt);
  if (!answered.length) return 0;
  const total = answered.reduce(
    (a, l) => a + workingDaysBetween(l.receivedAt ?? l.issuedAt, l.respondedAt!, cal),
    0
  );
  return round1(total / answered.length);
}

/** اعتبارسنجی نامه پیش از ثبت. */
export function validateLetter(l: Letter): { code: string; severity: "error" | "warning"; message: string }[] {
  const out: { code: string; severity: "error" | "warning"; message: string }[] = [];
  if (!l.subject?.trim()) out.push({ code: "E-CKM-101", severity: "error", message: "موضوع نامه خالی است" });
  if (!l.ref?.trim()) out.push({ code: "E-CKM-102", severity: "error", message: "شماره ثبت نامه الزامی است" });
  if (isTimeBarred(l.letterClass) && !(l.links?.length)) {
    out.push({ code: "E-CKM-103", severity: "error", message: "اعلان قراردادی باید به ادعا، تغییر یا ریسک ارجاع داشته باشد" });
  }
  if (l.direction === "incoming" && !l.receivedAt) {
    out.push({ code: "E-CKM-104", severity: "error", message: "نامه وارده بدون تاریخ ثبت دبیرخانه پذیرفته نمی‌شود" });
  }
  if (!l.ownerRole) {
    out.push({ code: "W-CKM-301", severity: "warning", message: "نامه مالک پاسخ ندارد" });
  }
  return out;
}

/* ══════════════════════════ جلسات و مصوبات ══════════════════════════ */

export type ActionStatus = "open" | "in_progress" | "done" | "cancelled" | "overdue";

export type ActionItem = {
  id: string;
  meetingId: string;
  title: string;
  ownerRole: string;
  dueDate: string;
  status: ActionStatus;
  closedAt?: string;
  /** ارجاع به ریسک، ادعا، NCR یا فعالیت */
  links?: string[];
};

export type Meeting = {
  id: string;
  title: string;
  type: "kickoff" | "weekly" | "monthly" | "technical" | "client" | "hse" | "claim";
  heldAt: string;
  chair: string;
  attendees: string[];
  invited: string[];
  minutesApproved: boolean;
  distributedAt?: string;
};

/** وضعیت واقعی مصوبه با در نظر گرفتن تاریخ امروز. */
export function actionState(a: ActionItem, today: string): ActionStatus {
  if (a.status === "done" || a.status === "cancelled") return a.status;
  return a.dueDate < today ? "overdue" : a.status;
}

export function actionAgeDays(a: ActionItem, today: string, cal: WorkCalendar = IRAN_CALENDAR): number {
  return workingDaysBetween(a.dueDate, today, cal);
}

/** سلامت جلسه: حضور، تصویب صورت‌جلسه، توزیع و نرخ بستن مصوبات. */
export function meetingHealth(m: Meeting, actions: ActionItem[], today: string) {
  const mine = actions.filter((a) => a.meetingId === m.id);
  const closed = mine.filter((a) => actionState(a, today) === "done").length;
  const overdue = mine.filter((a) => actionState(a, today) === "overdue").length;
  const attendanceRate = m.invited.length ? round1((m.attendees.length / m.invited.length) * 100) : 100;
  const closureRate = mine.length ? round1((closed / mine.length) * 100) : 100;

  const issues: string[] = [];
  if (!m.minutesApproved) issues.push("صورت‌جلسه تصویب نشده");
  if (!m.distributedAt) issues.push("صورت‌جلسه توزیع نشده");
  if (attendanceRate < 70) issues.push("حضور زیر ۷۰٪");
  if (overdue > 0) issues.push(`${overdue} مصوبه معوق`);

  return {
    actions: mine.length,
    closed,
    overdue,
    attendanceRate,
    closureRate,
    status: issues.length === 0 ? ("green" as const) : overdue > 0 || !m.minutesApproved ? ("red" as const) : ("amber" as const),
    issues,
  };
}

/** مصوبه بدون مالک یا بدون موعد، مصوبه نیست (اصل ۲). */
export function validateAction(a: ActionItem): { code: string; severity: "error" | "warning"; message: string }[] {
  const out: { code: string; severity: "error" | "warning"; message: string }[] = [];
  if (!a.ownerRole?.trim()) out.push({ code: "E-CKM-201", severity: "error", message: "مصوبه بدون مالک پذیرفته نمی‌شود" });
  if (!a.dueDate) out.push({ code: "E-CKM-202", severity: "error", message: "مصوبه بدون موعد پذیرفته نمی‌شود" });
  if (!a.title?.trim() || a.title.trim().length < 8) {
    out.push({ code: "W-CKM-302", severity: "warning", message: "شرح مصوبه بیش از حد کوتاه است و قابل پیگیری نیست" });
  }
  return out;
}

/* ══════════════════════════ ذی‌نفعان ══════════════════════════ */

export type EngagementLevel = "unaware" | "resistant" | "neutral" | "supportive" | "leading";

export const ENGAGEMENT_ORDER: EngagementLevel[] = ["unaware", "resistant", "neutral", "supportive", "leading"];

export type Stakeholder = {
  id: string;
  name: string;
  org: string;
  role: string;
  /** ۱ تا ۵ */
  power: number;
  interest: number;
  current: EngagementLevel;
  desired: EngagementLevel;
  channel: string[];
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "on_event";
  ownerRole: string;
};

/** راهبرد مواجهه بر پایه شبکه قدرت–علاقه (PMBOK 13). */
export function powerInterestQuadrant(s: Stakeholder): "manage_closely" | "keep_satisfied" | "keep_informed" | "monitor" {
  const highPower = s.power >= 4;
  const highInterest = s.interest >= 4;
  if (highPower && highInterest) return "manage_closely";
  if (highPower && !highInterest) return "keep_satisfied";
  if (!highPower && highInterest) return "keep_informed";
  return "monitor";
}

/** فاصله سطح تعامل فعلی تا مطلوب — عدد مثبت یعنی نیازمند اقدام است. */
export function engagementGap(s: Stakeholder): number {
  return ENGAGEMENT_ORDER.indexOf(s.desired) - ENGAGEMENT_ORDER.indexOf(s.current);
}

/** ذی‌نفعان بحرانی: قدرت بالا و شکاف تعامل مثبت. */
export function criticalStakeholders(list: Stakeholder[]): Stakeholder[] {
  return list.filter((s) => s.power >= 4 && engagementGap(s) > 0);
}

/**
 * تعداد کانال ارتباطی بالقوه = n(n−1)/2 (PMBOK 10).
 * پایه استدلال برای محدود کردن اعضای رسمی جلسات.
 */
export function communicationChannels(n: number): number {
  return n > 1 ? (n * (n - 1)) / 2 : 0;
}

/** پوشش برنامه ارتباطات: چند درصد ذی‌نفعان کانال و تناوب مشخص دارند. */
export function commsPlanCoverage(list: Stakeholder[]): number {
  if (!list.length) return 0;
  const ok = list.filter((s) => s.channel.length > 0 && !!s.frequency && !!s.ownerRole).length;
  return round1((ok / list.length) * 100);
}

/* ══════════════════════════ دانش و درس‌آموخته ══════════════════════════ */

export type LessonCategory =
  | "technical" | "schedule" | "cost" | "quality" | "hse"
  | "contract" | "procurement" | "hr" | "stakeholder";

export type Lesson = {
  id: string;
  title: string;
  category: LessonCategory;
  /** منشأ الزامی: NCR، ادعا، ریسک، حادثه یا جلسه */
  sourceRef: string;
  situation: string;
  recommendation: string;
  capturedAt: string;
  capturedBy: string;
  /** تأیید شورای دانش — درس تأییدنشده در جستجوی سازمانی ظاهر نمی‌شود */
  validated: boolean;
  /** دفعات استفاده مجدد در پروژه‌های بعدی */
  reuseCount: number;
  impact: "low" | "medium" | "high";
  tags: string[];
};

/**
 * امتیاز ارزش یک درس‌آموخته (۰ تا ۱۰۰).
 * وزن اصلی روی «استفاده مجدد» است، نه روی «ثبت شدن» —
 * چون دانشی که به کار نرود هزینه است نه دارایی.
 */
export function lessonValue(l: Lesson): number {
  const impactWeight = { low: 10, medium: 20, high: 30 }[l.impact];
  const validatedWeight = l.validated ? 20 : 0;
  const reuseWeight = Math.min(40, l.reuseCount * 10);
  const linkWeight = l.sourceRef ? 10 : 0;
  return impactWeight + validatedWeight + reuseWeight + linkWeight;
}

/** نرخ تبدیل دانش: چند درصد درس‌های تأییدشده دست‌کم یک‌بار استفاده شده‌اند. */
export function knowledgeUtilization(list: Lesson[]): number {
  const validated = list.filter((l) => l.validated);
  if (!validated.length) return 0;
  return round1((validated.filter((l) => l.reuseCount > 0).length / validated.length) * 100);
}

/** توزیع درس‌ها بر حسب دسته — برای یافتن حوزه‌های کور. */
export function lessonCoverage(list: Lesson[], categories: LessonCategory[]) {
  return categories.map((c) => ({
    category: c,
    count: list.filter((l) => l.category === c).length,
  }));
}

export function validateLesson(l: Lesson): { code: string; severity: "error" | "warning"; message: string }[] {
  const out: { code: string; severity: "error" | "warning"; message: string }[] = [];
  if (!l.sourceRef?.trim()) {
    out.push({ code: "E-CKM-401", severity: "error", message: "درس‌آموخته بدون منشأ ثبت نمی‌شود" });
  }
  if (!l.recommendation?.trim() || l.recommendation.trim().length < 15) {
    out.push({ code: "E-CKM-402", severity: "error", message: "توصیه اجرایی باید مشخص و قابل اقدام باشد" });
  }
  if (l.validated && l.reuseCount === 0) {
    out.push({ code: "W-CKM-303", severity: "warning", message: "درس تأییدشده اما هرگز استفاده نشده است" });
  }
  return out;
}

/* ══════════════════════════ اطلاع‌رسانی و توزیع ══════════════════════════ */

export type NotificationRule = {
  id: string;
  event: string;
  channels: ("email" | "sms" | "in_app" | "board")[];
  audienceRoles: string[];
  /** ساعت تا تشدید در صورت بی‌پاسخ ماندن */
  escalateAfterHours: number;
  escalateToRole: string;
  active: boolean;
};

/** سطح تشدید بر پایه ساعت سپری‌شده. */
export function escalationLevel(hoursElapsed: number, rule: NotificationRule): 0 | 1 | 2 | 3 {
  if (!rule.active || hoursElapsed < rule.escalateAfterHours) return 0;
  const factor = hoursElapsed / rule.escalateAfterHours;
  if (factor >= 3) return 3;
  if (factor >= 2) return 2;
  return 1;
}

/** کامل بودن توزیع: آیا همه مخاطبان لازم پوشش داده شده‌اند؟ */
export function distributionGap(required: string[], actual: string[]): string[] {
  const have = new Set(actual);
  return required.filter((r) => !have.has(r));
}

/* ══════════════════════════ هشدار زودهنگام ══════════════════════════ */

export type CkmAlert = { code: string; severity: "critical" | "high" | "medium"; message: string };

export function ckmEws(input: {
  timeBarBreaches: number;
  overdueLetters: number;
  overdueActions: number;
  avgResponseDays: number;
  engagementGaps: number;
  knowledgeUtilizationPct: number;
  unapprovedMinutes: number;
}): CkmAlert[] {
  const out: CkmAlert[] = [];
  if (input.timeBarBreaches > 0) {
    out.push({
      code: "EWS-CKM-01",
      severity: "critical",
      message: `${input.timeBarBreaches} اعلان قراردادی از مهلت گذشته — ریسک سقوط حق ادعا`,
    });
  }
  if (input.overdueLetters > 5) {
    out.push({ code: "EWS-CKM-02", severity: "high", message: `${input.overdueLetters} نامه بی‌پاسخ از مهلت گذشته` });
  }
  if (input.overdueActions > 3) {
    out.push({ code: "EWS-CKM-03", severity: "high", message: `${input.overdueActions} مصوبه جلسه معوق` });
  }
  if (input.avgResponseDays > 10) {
    out.push({ code: "EWS-CKM-04", severity: "medium", message: `میانگین زمان پاسخ ${input.avgResponseDays} روز کاری — بیش از آستانه ۱۰` });
  }
  if (input.engagementGaps > 0) {
    out.push({ code: "EWS-CKM-05", severity: "medium", message: `${input.engagementGaps} ذی‌نفع پرقدرت با شکاف تعامل` });
  }
  if (input.knowledgeUtilizationPct < 40) {
    out.push({ code: "EWS-CKM-06", severity: "medium", message: `نرخ استفاده از دانش ${input.knowledgeUtilizationPct}٪ زیر آستانه ۴۰٪` });
  }
  if (input.unapprovedMinutes > 2) {
    out.push({ code: "EWS-CKM-07", severity: "medium", message: `${input.unapprovedMinutes} صورت‌جلسه تصویب‌نشده` });
  }
  return out;
}

/* ══════════════════════════ ابزار ══════════════════════════ */

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
