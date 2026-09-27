/**
 * میز کار ارتباطات و دانش d11 — منطق خالص مشترک کلاینت و سرور (LIVE-2).
 * آینهٔ سرور با `npm run build:ckmws` ساخته می‌شود (server/ckmWsLogic.js).
 *
 * پیش از این، صفحهٔ d11 آرایه‌های ثابت درون کامپوننت داشت، «امروز» را
 * ثابت ۲۰۲۶-۰۹-۰۸ گرفته بود و سطح تشدید همهٔ قواعد را با عدد ساختگی
 * «۹۶ ساعت» حساب می‌کرد. اینجا:
 *  - سطرهای جدول (همان ستون‌های SQL) به نوع‌های موتور `communication.ts`
 *    نگاشت می‌شوند؛ فرمول‌ها همان موتور است و تکرار نمی‌شود.
 *  - سطح تشدید هر قاعده از رویدادهای واقعی باز محاسبه می‌شود
 *    (قدیمی‌ترین مورد معلق همان رویداد).
 *  - دادهٔ نمونه فقط با درخواست صریح، و نسبت به تاریخ امروز جابه‌جا
 *    می‌شود تا وضعیت‌های «نزدیک مهلت/معوق» همان معنای نمونهٔ اصلی را بدهند.
 */
import {
  CKM_FORMULA_VERSION,
  actionState,
  averageResponseTime,
  ckmEws,
  commsPlanCoverage,
  communicationChannels,
  criticalStakeholders,
  distributionGap,
  engagementGap,
  escalationLevel,
  isTimeBarred,
  knowledgeUtilization,
  lessonCoverage,
  lessonValue,
  meetingHealth,
  powerInterestQuadrant,
  responseDue,
  validateLesson,
  validateLetter,
  type ActionItem,
  type EngagementLevel,
  type Lesson,
  type LessonCategory,
  type Letter,
  type LetterClass,
  type Meeting,
  type NotificationRule,
  type Stakeholder,
} from "./communication";

export const CKM_WS_VERSION = "ckm-ws-v1";

/* ═══════════════════════ واژگان مجاز ═══════════════════════ */

export const LETTER_CLASSES: LetterClass[] = ["general", "instruction", "notice", "claim_notice", "submittal", "rfi", "ncr_related"];
/** وضعیت‌های ذخیره‌شدنی؛ «معوق» هرگز ذخیره نمی‌شود و از مهلت مشتق است. */
export const LETTER_STATUSES = ["draft", "registered", "under_review", "responded", "closed"] as const;
export type StoredLetterStatus = (typeof LETTER_STATUSES)[number];
export const MEETING_TYPES: Meeting["type"][] = ["kickoff", "weekly", "monthly", "technical", "client", "hse", "claim"];
export const ACTION_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
export const ENGAGEMENT_LEVELS: EngagementLevel[] = ["unaware", "resistant", "neutral", "supportive", "leading"];
export const FREQUENCIES: Stakeholder["frequency"][] = ["daily", "weekly", "biweekly", "monthly", "on_event"];
export const LESSON_CATEGORIES: LessonCategory[] = ["technical", "schedule", "cost", "quality", "hse", "contract", "procurement", "hr", "stakeholder"];
export const IMPACTS: Lesson["impact"][] = ["low", "medium", "high"];
export const CHANNELS: NotificationRule["channels"] = ["email", "sms", "in_app", "board"];

/**
 * رویدادهای قابل پایش برای قواعد اطلاع‌رسانی. هر رویداد از دادهٔ واقعی
 * فهرست موارد معلق و «از چه تاریخی معلق است» را می‌سازد.
 */
export const EVENT_CATALOG = {
  notice_due: { fa: "اعلان قراردادی بی‌پاسخ نزدیک یا گذشته از مهلت", en: "Contractual notice near/over deadline" },
  letter_unowned: { fa: "نامهٔ وارده بدون مالک پاسخ", en: "Incoming letter without owner" },
  action_overdue: { fa: "مصوبهٔ جلسهٔ معوق", en: "Overdue meeting action" },
  minutes_unapproved: { fa: "صورت‌جلسهٔ تصویب‌نشده", en: "Unapproved minutes" },
  minutes_undistributed: { fa: "صورت‌جلسهٔ تصویب‌شدهٔ توزیع‌نشده", en: "Approved minutes not distributed" },
  lesson_unvalidated: { fa: "درس‌آموخته در انتظار تأیید شورا", en: "Lesson awaiting validation" },
} as const;
export type EventCode = keyof typeof EVENT_CATALOG;
export const EVENT_CODES = Object.keys(EVENT_CATALOG) as EventCode[];

/* ═══════════════════════ سطرهای جدول (ستون‌های SQL) ═══════════════════════ */

export type LetterRow = {
  LetterNo: string;
  Direction: "incoming" | "outgoing";
  Kind: LetterClass;
  SubjectFa: string;
  FromParty?: string | null;
  ToParty?: string | null;
  IssuedAt: string;
  ReceivedAt?: string | null;
  ResponseDays?: number | null;
  RespondedAt?: string | null;
  ResponseRef?: string | null;
  Status: StoredLetterStatus;
  Links?: string[] | null;
  OwnerRole?: string | null;
  Attachments?: number | null;
  RefLetterNo?: string | null;
  DueAt?: string | null;
  TimeBarred?: boolean | null;
  DraftedBy?: string | null;
  SignedBy?: string | null;
  SignedAt?: string | null;
};

export type MeetingRow = {
  Code: string;
  TitleFa: string;
  MeetingType: Meeting["type"];
  HeldAt: string;
  Chair: string;
  Invited: string[];
  Attendees: string[];
  MinutesApproved: boolean;
  ApprovedBy?: string | null;
  ApprovedAt?: string | null;
  DistributedAt?: string | null;
  DistributedTo?: string[] | null;
  RecordedBy?: string | null;
};

export type ActionRow = {
  Code: string;
  MeetingCode: string;
  TitleFa: string;
  OwnerRole: string;
  DueDate: string;
  Status: (typeof ACTION_STATUSES)[number];
  ClosedAt?: string | null;
  Links?: string[] | null;
  CancelReasonFa?: string | null;
};

export type StakeholderRow = {
  Code: string;
  NameFa: string;
  Org?: string | null;
  RoleFa?: string | null;
  Power: number;
  Interest: number;
  CurrentLevel: EngagementLevel;
  DesiredLevel: EngagementLevel;
  Channels?: string[] | null;
  Frequency?: Stakeholder["frequency"] | null;
  OwnerRole?: string | null;
};

export type LessonRow = {
  Code: string;
  TitleFa: string;
  Category: LessonCategory;
  Impact: Lesson["impact"];
  Validated: boolean;
  ReuseCount: number;
  Value?: number | null;
  SourceRef?: string | null;
  SituationFa?: string | null;
  RecommendationFa?: string | null;
  CapturedAt?: string | null;
  CapturedBy?: string | null;
  Tags?: string[] | null;
  ValidatedBy?: string | null;
  ValidatedAt?: string | null;
};

export type ReuseRow = { LessonCode: string; UsedBy: string; UsedAt: string; NoteFa: string };

export type RuleRow = {
  Code: string;
  EventCode: EventCode;
  NameFa: string;
  Channels?: NotificationRule["channels"] | null;
  AudienceRoles?: string[] | null;
  EscalateAfterHours: number;
  EscalateToRole?: string | null;
  Active: boolean;
};

export type CkmWorkspaceData = {
  projectId: string;
  letters: LetterRow[];
  meetings: MeetingRow[];
  actions: ActionRow[];
  stakeholders: StakeholderRow[];
  lessons: LessonRow[];
  reuses: ReuseRow[];
  rules: RuleRow[];
};

/* ═══════════════════════ نگاشت سطر ← نوع موتور ═══════════════════════ */

/** تاریخ SQL ممکن است Date یا رشتهٔ زمان‌دار برگردد؛ فقط بخش تاریخ معتبر است. */
export const isoDay = (v: unknown): string | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function toLetter(r: LetterRow): Letter {
  return {
    id: r.LetterNo,
    ref: r.LetterNo,
    direction: r.Direction,
    letterClass: r.Kind,
    subject: r.SubjectFa,
    from: r.FromParty ?? "",
    to: r.ToParty ?? "",
    issuedAt: isoDay(r.IssuedAt)!,
    receivedAt: isoDay(r.ReceivedAt),
    responseDays: r.ResponseDays ?? undefined,
    respondedAt: isoDay(r.RespondedAt),
    status: r.Status,
    links: r.Links?.length ? arr(r.Links) : undefined,
    ownerRole: r.OwnerRole ?? undefined,
    attachments: r.Attachments ?? undefined,
  };
}

export function toMeeting(r: MeetingRow): Meeting {
  return {
    id: r.Code,
    title: r.TitleFa,
    type: r.MeetingType,
    heldAt: isoDay(r.HeldAt)!,
    chair: r.Chair,
    attendees: arr(r.Attendees),
    invited: arr(r.Invited),
    minutesApproved: Boolean(r.MinutesApproved),
    distributedAt: isoDay(r.DistributedAt),
  };
}

export function toAction(r: ActionRow): ActionItem {
  return {
    id: r.Code,
    meetingId: r.MeetingCode,
    title: r.TitleFa,
    ownerRole: r.OwnerRole,
    dueDate: isoDay(r.DueDate)!,
    status: r.Status,
    closedAt: isoDay(r.ClosedAt),
    links: r.Links?.length ? arr(r.Links) : undefined,
  };
}

export function toStakeholder(r: StakeholderRow): Stakeholder {
  return {
    id: r.Code,
    name: r.NameFa,
    org: r.Org ?? "",
    role: r.RoleFa ?? "",
    power: Number(r.Power),
    interest: Number(r.Interest),
    current: r.CurrentLevel,
    desired: r.DesiredLevel,
    channel: arr(r.Channels),
    /* تناوب تعریف‌نشده باید پوشش برنامه را کم کند، نه اینکه «on_event» فرض شود. */
    frequency: (r.Frequency ?? "") as Stakeholder["frequency"],
    ownerRole: r.OwnerRole ?? "",
  };
}

export function toLesson(r: LessonRow): Lesson {
  return {
    id: r.Code,
    title: r.TitleFa,
    category: r.Category,
    sourceRef: r.SourceRef ?? "",
    situation: r.SituationFa ?? "",
    recommendation: r.RecommendationFa ?? "",
    capturedAt: isoDay(r.CapturedAt) ?? "",
    capturedBy: r.CapturedBy ?? "",
    validated: Boolean(r.Validated),
    reuseCount: Number(r.ReuseCount) || 0,
    impact: r.Impact,
    tags: arr(r.Tags),
  };
}

export function toRule(r: RuleRow): NotificationRule {
  return {
    id: r.Code,
    event: r.NameFa,
    channels: (r.Channels ?? []) as NotificationRule["channels"],
    audienceRoles: arr(r.AudienceRoles),
    escalateAfterHours: Number(r.EscalateAfterHours),
    escalateToRole: r.EscalateToRole ?? "",
    active: Boolean(r.Active),
  };
}

/** مهلت پاسخ یک سطر نامه (برای ستون DueAt سرور و نمایش). */
export function letterDueDate(r: LetterRow, today: string): string {
  return responseDue(toLetter(r), today).dueDate;
}

/* ═══════════════════════ تاریخ ═══════════════════════ */

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ═══════════════════════ رویدادهای معلق و تشدید ═══════════════════════ */

export type PendingItem = { ref: string; since: string; hours: number };

/** موارد معلق هر رویداد با تاریخ شروع تعلیق — منبع سطح تشدید قواعد. */
export function pendingEvents(ws: CkmWorkspaceData, today: string): Record<EventCode, PendingItem[]> {
  const item = (ref: string, since: string | undefined): PendingItem | null =>
    since ? { ref, since, hours: Math.max(0, daysBetween(since, today) * 24) } : null;
  const keep = (xs: (PendingItem | null)[]) => xs.filter((x): x is PendingItem => x !== null).sort((a, b) => b.hours - a.hours);

  const openLetters = ws.letters.filter((l) => l.Status !== "draft" && l.Status !== "closed" && !l.RespondedAt);
  return {
    notice_due: keep(
      openLetters
        .filter((l) => isTimeBarred(l.Kind) && responseDue(toLetter(l), today).severity !== "ok")
        .map((l) => item(l.LetterNo, isoDay(l.ReceivedAt) ?? isoDay(l.IssuedAt))),
    ),
    letter_unowned: keep(
      openLetters.filter((l) => l.Direction === "incoming" && !l.OwnerRole).map((l) => item(l.LetterNo, isoDay(l.ReceivedAt) ?? isoDay(l.IssuedAt))),
    ),
    action_overdue: keep(
      ws.actions.filter((a) => actionState(toAction(a), today) === "overdue").map((a) => item(a.Code, isoDay(a.DueDate))),
    ),
    minutes_unapproved: keep(ws.meetings.filter((m) => !m.MinutesApproved).map((m) => item(m.Code, isoDay(m.HeldAt)))),
    minutes_undistributed: keep(
      ws.meetings.filter((m) => m.MinutesApproved && !m.DistributedAt).map((m) => item(m.Code, isoDay(m.ApprovedAt) ?? isoDay(m.HeldAt))),
    ),
    lesson_unvalidated: keep(ws.lessons.filter((l) => !l.Validated).map((l) => item(l.Code, isoDay(l.CapturedAt)))),
  };
}

/* ═══════════════════════ نمای مشتق ═══════════════════════ */

export function buildCkmView(ws: CkmWorkspaceData, today: string) {
  const letters = ws.letters.map(toLetter);
  const meetings = ws.meetings.map(toMeeting);
  const actions = ws.actions.map(toAction);
  const stakeholders = ws.stakeholders.map(toStakeholder);
  const lessons = ws.lessons.map(toLesson);

  /* پیش‌نویس هنوز نامه نیست: در مهلت‌ها و آمار شمرده نمی‌شود. */
  const letterRows = ws.letters.map((row, i) => ({
    row,
    l: letters[i],
    due: row.Status === "draft" ? null : responseDue(letters[i], today),
    issues: validateLetter(letters[i]),
  }));
  const live = letterRows.filter((r) => r.due !== null);
  const timeBarBreaches = live.filter((r) => r.due!.timeBarBreached).length;
  const overdueLetters = live.filter((r) => r.due!.overdue).length;
  const dueSoon = live.filter((r) => r.due!.severity === "due_soon").length;
  const avgResponse = averageResponseTime(live.map((r) => r.l));
  const openLetters = live.filter((r) => r.row.Status !== "closed").length;
  const drafts = letterRows.length - live.length;

  const meetingRows = ws.meetings.map((row, i) => {
    const m = meetings[i];
    const required = Array.from(new Set([...m.invited]));
    return {
      row,
      m,
      h: meetingHealth(m, actions, today),
      distGap: row.DistributedAt ? distributionGap(required, arr(row.DistributedTo)) : null,
    };
  });
  const actionRows = ws.actions.map((row, i) => ({ row, a: actions[i], state: actionState(actions[i], today) }));
  const overdueActions = actionRows.filter((a) => a.state === "overdue").length;
  const openActions = actionRows.filter((a) => a.state !== "done" && a.state !== "cancelled").length;
  const doneActions = actionRows.filter((a) => a.state === "done").length;
  const countedActions = actionRows.filter((a) => a.state !== "cancelled").length;
  const unapprovedMinutes = ws.meetings.filter((m) => !m.MinutesApproved).length;

  const critical = criticalStakeholders(stakeholders);
  const stakeholderRows = ws.stakeholders.map((row, i) => ({
    row,
    s: stakeholders[i],
    quadrant: powerInterestQuadrant(stakeholders[i]),
    gap: engagementGap(stakeholders[i]),
  }));

  const utilization = knowledgeUtilization(lessons);
  const coverageByCat = lessonCoverage(lessons, LESSON_CATEGORIES);
  const rankedLessons = ws.lessons
    .map((row, i) => ({ row, l: lessons[i], v: lessonValue(lessons[i]), issues: validateLesson(lessons[i]) }))
    .sort((a, b) => b.v - a.v);

  const pending = pendingEvents(ws, today);
  const ruleRows = ws.rules.map((row) => {
    const rule = toRule(row);
    const items = pending[row.EventCode] ?? [];
    const maxHours = items.length ? items[0].hours : 0;
    return { row, rule, items, maxHours, level: items.length ? escalationLevel(maxHours, rule) : (0 as const) };
  });
  const uncoveredEvents = EVENT_CODES.filter((e) => pending[e].length > 0 && !ws.rules.some((r) => r.Active && r.EventCode === e));

  const byClass = LETTER_CLASSES.map((c) => {
    const rows = live.filter((r) => r.l.letterClass === c);
    return {
      cls: c,
      total: rows.length,
      overdue: rows.filter((r) => r.due!.overdue).length,
      breach: rows.filter((r) => r.due!.timeBarBreached).length,
      answered: rows.filter((r) => r.l.respondedAt).length,
    };
  }).filter((x) => x.total > 0);

  /* نبودِ داده «سالم» نیست: EWS فقط وقتی دادهٔ مرتبط هست محاسبه می‌شود. */
  const alerts = ckmEws({
    timeBarBreaches,
    overdueLetters,
    overdueActions,
    avgResponseDays: avgResponse,
    engagementGaps: critical.length,
    knowledgeUtilizationPct: lessons.some((l) => l.validated) ? utilization : 100,
    unapprovedMinutes,
  });

  const empty =
    ws.letters.length + ws.meetings.length + ws.actions.length + ws.stakeholders.length + ws.lessons.length + ws.rules.length === 0;

  return {
    empty,
    today,
    formulaVersion: CKM_FORMULA_VERSION,
    letterRows,
    timeBarBreaches,
    overdueLetters,
    dueSoon,
    avgResponse: live.some((r) => r.l.respondedAt) ? avgResponse : null,
    openLetters,
    drafts,
    meetingRows,
    actionRows,
    overdueActions,
    openActions,
    closureRate: countedActions ? Math.round((doneActions / countedActions) * 100) : null,
    unapprovedMinutes,
    stakeholderRows,
    critical,
    coverage: stakeholders.length ? commsPlanCoverage(stakeholders) : null,
    channels: communicationChannels(stakeholders.length),
    utilization: lessons.some((l) => l.validated) ? utilization : null,
    coverageByCat,
    rankedLessons,
    totalReuse: lessons.reduce((a, l) => a + l.reuseCount, 0),
    pending,
    ruleRows,
    uncoveredEvents,
    byClass,
    alerts,
  };
}

export type CkmView = ReturnType<typeof buildCkmView>;

/* ═══════════════════════ دادهٔ نمونه (فقط با درخواست صریح) ═══════════════════════
 * همان نمونهٔ پیشین صفحه (پروژه OG-2401) به شکل سطرهای جدول. تاریخ‌ها
 * نسبت به CKM_SAMPLE_BASE نوشته شده‌اند و هنگام بارگذاری به اندازهٔ فاصلهٔ
 * امروز تا این تاریخ جابه‌جا می‌شوند. */

export const CKM_SAMPLE_BASE = "2026-09-08";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** همهٔ تاریخ‌های YYYY-MM-DD یک ساختار را n روز جابه‌جا می‌کند (غیرمخرب). */
export function shiftDates<T>(value: T, n: number): T {
  if (n === 0) return value;
  if (typeof value === "string") return (ISO_RE.test(value) ? addDays(value, n) : value) as T;
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, n)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, shiftDates(v, n)])) as T;
  }
  return value;
}

export function ckmSampleFor(today: string): Omit<CkmWorkspaceData, "projectId"> {
  return shiftDates(CKM_SAMPLE, daysBetween(CKM_SAMPLE_BASE, today));
}

export const CKM_SAMPLE: Omit<CkmWorkspaceData, "projectId"> = {
  "letters": [
    {
      "LetterNo": "OG2401-CL-0412",
      "Direction": "incoming",
      "Kind": "claim_notice",
      "SubjectFa": "اعلان ادعای تأخیر ناشی از تحویل دیرهنگام زمین منطقه ۳",
      "FromParty": "پیمانکار",
      "ToParty": "کارفرما",
      "IssuedAt": "2026-07-20",
      "ReceivedAt": "2026-07-21",
      "Status": "under_review",
      "Links": [
        "CLM-014"
      ],
      "OwnerRole": "مدیر قرارداد",
      "Attachments": 6,
      "DraftedBy": "u-doc"
    },
    {
      "LetterNo": "OG2401-IN-0388",
      "Direction": "incoming",
      "Kind": "instruction",
      "SubjectFa": "دستور تغییر مسیر پایپ‌رک واحد ۲۰۰",
      "FromParty": "کارفرما",
      "ToParty": "پیمانکار",
      "IssuedAt": "2026-08-30",
      "ReceivedAt": "2026-08-31",
      "Status": "registered",
      "Links": [
        "CR-041"
      ],
      "OwnerRole": "مدیر مهندسی",
      "Attachments": 3,
      "DraftedBy": "u-doc"
    },
    {
      "LetterNo": "OG2401-RFI-0765",
      "Direction": "outgoing",
      "Kind": "rfi",
      "SubjectFa": "استعلام ابهام نقشه فونداسیون F-204",
      "FromParty": "پیمانکار",
      "ToParty": "مشاور",
      "IssuedAt": "2026-09-01",
      "Status": "registered",
      "OwnerRole": "سرپرست مهندسی عمران",
      "Attachments": 2,
      "DraftedBy": "u-contracts",
      "SignedBy": "u-pm"
    },
    {
      "LetterNo": "OG2401-NT-0201",
      "Direction": "outgoing",
      "Kind": "notice",
      "SubjectFa": "اعلان وضعیت غیرقابل پیش‌بینی زمین در گمانه ۷",
      "FromParty": "پیمانکار",
      "ToParty": "کارفرما",
      "IssuedAt": "2026-08-05",
      "Status": "registered",
      "Links": [
        "RSK-022"
      ],
      "OwnerRole": "مدیر پروژه",
      "Attachments": 4,
      "DraftedBy": "u-contracts",
      "SignedBy": "u-pm"
    },
    {
      "LetterNo": "OG2401-SB-0530",
      "Direction": "outgoing",
      "Kind": "submittal",
      "SubjectFa": "ارسال مدارک تأیید جوشکار ۶G برای بازرسی شخص ثالث",
      "FromParty": "پیمانکار",
      "ToParty": "مشاور",
      "IssuedAt": "2026-09-02",
      "Status": "under_review",
      "OwnerRole": "مدیر کیفیت",
      "Attachments": 12,
      "DraftedBy": "u-contracts",
      "SignedBy": "u-pm"
    },
    {
      "LetterNo": "OG2401-GN-0299",
      "Direction": "incoming",
      "Kind": "general",
      "SubjectFa": "معرفی نماینده جدید کارفرما در کارگاه",
      "FromParty": "کارفرما",
      "ToParty": "پیمانکار",
      "IssuedAt": "2026-09-03",
      "ReceivedAt": "2026-09-03",
      "RespondedAt": "2026-09-06",
      "Status": "closed",
      "OwnerRole": "مدیر پروژه",
      "Attachments": 1,
      "DraftedBy": "u-doc"
    },
    {
      "LetterNo": "OG2401-NC-0117",
      "Direction": "incoming",
      "Kind": "ncr_related",
      "SubjectFa": "ابلاغ عدم انطباق جوش خط ۱۴ اینچ و درخواست اقدام اصلاحی",
      "FromParty": "مشاور",
      "ToParty": "پیمانکار",
      "IssuedAt": "2026-08-25",
      "ReceivedAt": "2026-08-26",
      "Status": "under_review",
      "Links": [
        "NCR-338"
      ],
      "OwnerRole": "مدیر کیفیت",
      "Attachments": 5,
      "DraftedBy": "u-doc"
    },
    {
      "LetterNo": "OG2401-CL-0418",
      "Direction": "outgoing",
      "Kind": "claim_notice",
      "SubjectFa": "اعلان ادعای هزینه ناشی از توقف کار توسط بازرس ایمنی",
      "FromParty": "پیمانکار",
      "ToParty": "کارفرما",
      "IssuedAt": "2026-08-02",
      "Status": "registered",
      "Links": [
        "CLM-018"
      ],
      "OwnerRole": "مدیر قرارداد",
      "Attachments": 8,
      "DraftedBy": "u-contracts",
      "SignedBy": "u-pm"
    },
    {
      "LetterNo": "OG2401-RFI-0771",
      "Direction": "outgoing",
      "Kind": "rfi",
      "SubjectFa": "استعلام مشخصات رنگ مخزن T-02",
      "FromParty": "پیمانکار",
      "ToParty": "مشاور",
      "IssuedAt": "2026-09-04",
      "RespondedAt": "2026-09-07",
      "Status": "responded",
      "OwnerRole": "سرپرست خوردگی",
      "Attachments": 1,
      "DraftedBy": "u-contracts",
      "SignedBy": "u-pm"
    },
    {
      "LetterNo": "OG2401-IN-0392",
      "Direction": "incoming",
      "Kind": "instruction",
      "SubjectFa": "دستور توقف موقت عملیات خاکی منطقه ۱",
      "FromParty": "کارفرما",
      "ToParty": "پیمانکار",
      "IssuedAt": "2026-09-06",
      "ReceivedAt": "2026-09-06",
      "Status": "registered",
      "Links": [
        "CR-044"
      ],
      "OwnerRole": "مدیر کارگاه",
      "Attachments": 2,
      "DraftedBy": "u-doc"
    }
  ],
  "meetings": [
    {
      "Code": "M-1",
      "TitleFa": "جلسه هفتگی پیشرفت کارگاه",
      "MeetingType": "weekly",
      "HeldAt": "2026-09-05",
      "Chair": "مدیر پروژه",
      "Invited": [
        "مدیر پروژه",
        "مدیر کارگاه",
        "برنامه‌ریزی",
        "کیفیت",
        "ایمنی",
        "مهندسی"
      ],
      "Attendees": [
        "مدیر پروژه",
        "مدیر کارگاه",
        "برنامه‌ریزی",
        "کیفیت",
        "ایمنی"
      ],
      "MinutesApproved": true,
      "ApprovedBy": "u-pm",
      "ApprovedAt": "2026-09-06",
      "DistributedAt": "2026-09-06",
      "DistributedTo": [
        "مدیر پروژه",
        "مدیر کارگاه",
        "برنامه‌ریزی",
        "کیفیت",
        "ایمنی",
        "مهندسی"
      ],
      "RecordedBy": "u-doc"
    },
    {
      "Code": "M-2",
      "TitleFa": "جلسه ماهانه با کارفرما",
      "MeetingType": "client",
      "HeldAt": "2026-09-02",
      "Chair": "مدیر پروژه",
      "Invited": [
        "کارفرما",
        "مشاور",
        "مدیر پروژه",
        "مدیر قرارداد",
        "برنامه‌ریزی"
      ],
      "Attendees": [
        "کارفرما",
        "مشاور",
        "مدیر پروژه",
        "مدیر قرارداد",
        "برنامه‌ریزی"
      ],
      "MinutesApproved": true,
      "ApprovedBy": "u-pm",
      "ApprovedAt": "2026-09-03",
      "DistributedAt": "2026-09-04",
      "DistributedTo": [
        "کارفرما",
        "مشاور",
        "مدیر پروژه",
        "مدیر قرارداد",
        "برنامه‌ریزی"
      ],
      "RecordedBy": "u-doc"
    },
    {
      "Code": "M-3",
      "TitleFa": "جلسه فنی رفع ابهام پایپینگ",
      "MeetingType": "technical",
      "HeldAt": "2026-09-03",
      "Chair": "مدیر مهندسی",
      "Invited": [
        "مهندسی",
        "اجرا",
        "کیفیت",
        "مشاور"
      ],
      "Attendees": [
        "مهندسی",
        "اجرا"
      ],
      "MinutesApproved": false,
      "RecordedBy": "u-doc"
    },
    {
      "Code": "M-4",
      "TitleFa": "جلسه بررسی ادعای تأخیر زمین",
      "MeetingType": "claim",
      "HeldAt": "2026-08-29",
      "Chair": "مدیر قرارداد",
      "Invited": [
        "مدیر قرارداد",
        "برنامه‌ریزی",
        "حقوقی",
        "کارفرما"
      ],
      "Attendees": [
        "مدیر قرارداد",
        "برنامه‌ریزی",
        "حقوقی"
      ],
      "MinutesApproved": true,
      "ApprovedBy": "u-pm",
      "ApprovedAt": "2026-08-30",
      "DistributedAt": "2026-08-31",
      "DistributedTo": [
        "مدیر قرارداد",
        "برنامه‌ریزی",
        "حقوقی",
        "کارفرما"
      ],
      "RecordedBy": "u-doc"
    },
    {
      "Code": "M-5",
      "TitleFa": "کمیته ایمنی ماهانه",
      "MeetingType": "hse",
      "HeldAt": "2026-09-01",
      "Chair": "مدیر HSE",
      "Invited": [
        "مدیر HSE",
        "افسران ایمنی",
        "مدیر کارگاه",
        "پیمانکاران"
      ],
      "Attendees": [
        "مدیر HSE",
        "افسران ایمنی",
        "مدیر کارگاه"
      ],
      "MinutesApproved": false,
      "RecordedBy": "u-doc"
    }
  ],
  "actions": [
    {
      "Code": "A-1",
      "MeetingCode": "M-1",
      "TitleFa": "ارائه برنامه جبرانی جوشکاری پایپ‌رک منطقه ۳",
      "OwnerRole": "برنامه‌ریزی",
      "DueDate": "2026-09-12",
      "Status": "in_progress",
      "Links": [
        "A-1240"
      ]
    },
    {
      "Code": "A-2",
      "MeetingCode": "M-1",
      "TitleFa": "تأمین ۱۸ جوشکار ۶G طبق درخواست تجهیز MOB-0112",
      "OwnerRole": "منابع انسانی",
      "DueDate": "2026-09-04",
      "Status": "in_progress",
      "Links": [
        "MOB-0112"
      ]
    },
    {
      "Code": "A-3",
      "MeetingCode": "M-1",
      "TitleFa": "به‌روزرسانی نقشه‌های As-Built واحد ۱۰۰",
      "OwnerRole": "مهندسی",
      "DueDate": "2026-09-20",
      "Status": "open"
    },
    {
      "Code": "A-4",
      "MeetingCode": "M-2",
      "TitleFa": "ارسال مستندات پشتیبان ادعای تأخیر زمین به کارفرما",
      "OwnerRole": "مدیر قرارداد",
      "DueDate": "2026-09-09",
      "Status": "in_progress",
      "Links": [
        "CLM-014"
      ]
    },
    {
      "Code": "A-5",
      "MeetingCode": "M-2",
      "TitleFa": "توافق بر روش اندازه‌گیری پیشرفت کار خاکی",
      "OwnerRole": "برنامه‌ریزی",
      "DueDate": "2026-08-28",
      "Status": "open"
    },
    {
      "Code": "A-6",
      "MeetingCode": "M-3",
      "TitleFa": "صدور نقشه اصلاحی مسیر لوله ۱۴ اینچ",
      "OwnerRole": "مهندسی",
      "DueDate": "2026-09-01",
      "Status": "open",
      "Links": [
        "NCR-338"
      ]
    },
    {
      "Code": "A-7",
      "MeetingCode": "M-4",
      "TitleFa": "تهیه تحلیل تأخیر پنجره‌ای برای دوره تیر تا شهریور",
      "OwnerRole": "برنامه‌ریزی",
      "DueDate": "2026-09-15",
      "Status": "open",
      "Links": [
        "CLM-014"
      ]
    },
    {
      "Code": "A-8",
      "MeetingCode": "M-5",
      "TitleFa": "بازآموزی ایمنی کار در ارتفاع برای اکیپ داربست",
      "OwnerRole": "مدیر HSE",
      "DueDate": "2026-09-10",
      "Status": "in_progress"
    },
    {
      "Code": "A-9",
      "MeetingCode": "M-1",
      "TitleFa": "بستن پانچ‌های کلاس A واحد ۲۰۰",
      "OwnerRole": "کیفیت",
      "DueDate": "2026-08-30",
      "Status": "open"
    },
    {
      "Code": "A-10",
      "MeetingCode": "M-2",
      "TitleFa": "ابلاغ رسمی نماینده جدید کارفرما به تیم اجرا",
      "OwnerRole": "مدیر پروژه",
      "DueDate": "2026-09-07",
      "Status": "done",
      "ClosedAt": "2026-09-06"
    }
  ],
  "stakeholders": [
    {
      "Code": "S-1",
      "NameFa": "شرکت ملی نفت — مدیریت طرح",
      "Org": "کارفرما",
      "RoleFa": "تصمیم‌گیر نهایی",
      "Power": 5,
      "Interest": 5,
      "CurrentLevel": "neutral",
      "DesiredLevel": "supportive",
      "Channels": [
        "جلسه ماهانه",
        "نامه رسمی"
      ],
      "Frequency": "monthly",
      "OwnerRole": "مدیر پروژه"
    },
    {
      "Code": "S-2",
      "NameFa": "مهندسان مشاور طرح",
      "Org": "مشاور",
      "RoleFa": "تأییدکننده فنی",
      "Power": 4,
      "Interest": 5,
      "CurrentLevel": "supportive",
      "DesiredLevel": "supportive",
      "Channels": [
        "نامه رسمی",
        "جلسه فنی"
      ],
      "Frequency": "weekly",
      "OwnerRole": "مدیر مهندسی"
    },
    {
      "Code": "S-3",
      "NameFa": "اداره کل حفاظت محیط زیست استان",
      "Org": "نهاد نظارتی",
      "RoleFa": "مجوزدهنده",
      "Power": 5,
      "Interest": 2,
      "CurrentLevel": "unaware",
      "DesiredLevel": "neutral",
      "Channels": [
        "نامه رسمی"
      ],
      "Frequency": "on_event",
      "OwnerRole": "مدیر HSE"
    },
    {
      "Code": "S-4",
      "NameFa": "پیمانکار جزء سازه فلزی",
      "Org": "پیمانکار جزء",
      "RoleFa": "مجری",
      "Power": 2,
      "Interest": 5,
      "CurrentLevel": "supportive",
      "DesiredLevel": "leading",
      "Channels": [
        "جلسه هفتگی",
        "پیام‌رسان"
      ],
      "Frequency": "weekly",
      "OwnerRole": "مدیر کارگاه"
    },
    {
      "Code": "S-5",
      "NameFa": "جامعه محلی و شورای روستا",
      "Org": "ذی‌نفع اجتماعی",
      "RoleFa": "تأثیرپذیر",
      "Power": 3,
      "Interest": 4,
      "CurrentLevel": "resistant",
      "DesiredLevel": "neutral",
      "Channels": [
        "نشست حضوری"
      ],
      "Frequency": "monthly",
      "OwnerRole": "روابط عمومی"
    },
    {
      "Code": "S-6",
      "NameFa": "بازرسی فنی شخص ثالث",
      "Org": "TPI",
      "RoleFa": "گواهی‌دهنده",
      "Power": 4,
      "Interest": 3,
      "CurrentLevel": "neutral",
      "DesiredLevel": "supportive",
      "Channels": [
        "نامه رسمی",
        "بازرسی میدانی"
      ],
      "Frequency": "biweekly",
      "OwnerRole": "مدیر کیفیت"
    },
    {
      "Code": "S-7",
      "NameFa": "تأمین‌کننده تجهیزات دوار",
      "Org": "فروشنده",
      "RoleFa": "تأمین‌کننده بحرانی",
      "Power": 3,
      "Interest": 3,
      "CurrentLevel": "neutral",
      "DesiredLevel": "supportive",
      "Channels": [
        "ایمیل"
      ],
      "Frequency": "biweekly",
      "OwnerRole": "مدیر تدارکات"
    },
    {
      "Code": "S-8",
      "NameFa": "اداره کار و تأمین اجتماعی",
      "Org": "نهاد نظارتی",
      "RoleFa": "ناظر انطباق",
      "Power": 4,
      "Interest": 2,
      "CurrentLevel": "unaware",
      "DesiredLevel": "neutral",
      "Channels": [],
      "Frequency": "on_event",
      "OwnerRole": ""
    }
  ],
  "lessons": [
    {
      "Code": "K-1",
      "TitleFa": "تحویل زمین بدون آزمایش ژئوتکنیک تکمیلی، ریسک تأخیر سیستماتیک می‌سازد",
      "Category": "schedule",
      "Impact": "high",
      "Validated": true,
      "ReuseCount": 3,
      "SourceRef": "CLM-014",
      "SituationFa": "تحویل منطقه ۳ بدون گمانه‌زنی کافی انجام شد و در حفاری به لایه سنگی برخورد کردیم.",
      "RecommendationFa": "پیش از پذیرش تحویل زمین، گزارش ژئوتکنیک با حداقل یک گمانه در هر ۲۵۰۰ متر مربع الزامی شود و در صورت‌جلسه تحویل قید گردد.",
      "CapturedAt": "2026-08-10",
      "CapturedBy": "مدیر برنامه‌ریزی",
      "Tags": [
        "تحویل زمین",
        "ژئوتکنیک",
        "ادعا"
      ],
      "ValidatedBy": "u-pm"
    },
    {
      "Code": "K-2",
      "TitleFa": "تأیید صلاحیت جوشکار پیش از بسیج، دوباره‌کاری بازرسی را حذف می‌کند",
      "Category": "quality",
      "Impact": "high",
      "Validated": true,
      "ReuseCount": 2,
      "SourceRef": "NCR-338",
      "SituationFa": "جوشکاران بدون تأیید قبلی TPI به کارگاه آمدند و ۱۱ نفر رد صلاحیت شدند.",
      "RecommendationFa": "آزمون تأیید جوشکار به گیت تجهیز نیرو در ماژول منابع انسانی اضافه شود و بدون آن کارت تردد صادر نگردد.",
      "CapturedAt": "2026-08-28",
      "CapturedBy": "مدیر کیفیت",
      "Tags": [
        "جوشکاری",
        "تجهیز نیرو",
        "TPI"
      ],
      "ValidatedBy": "u-pm"
    },
    {
      "Code": "K-3",
      "TitleFa": "اعلان ادعا در روز آخر مهلت، قدرت چانه‌زنی را از بین می‌برد",
      "Category": "contract",
      "Impact": "high",
      "Validated": true,
      "ReuseCount": 1,
      "SourceRef": "CLM-018",
      "SituationFa": "اعلان توقف کار توسط ایمنی در روز بیست‌وهفتم ارسال شد و کارفرما به شکلی بودن آن ایراد گرفت.",
      "RecommendationFa": "هشدار خودکار در روز هفتم و چهاردهم مهلت اعلان فعال شود و ارسال در نیمه دوم مهلت نیازمند تأیید مدیر قرارداد باشد.",
      "CapturedAt": "2026-09-01",
      "CapturedBy": "مدیر قرارداد",
      "Tags": [
        "Time-Bar",
        "ادعا",
        "FIDIC"
      ],
      "ValidatedBy": "u-pm"
    },
    {
      "Code": "K-4",
      "TitleFa": "جلسه فنی بدون حضور مشاور، مصوبه غیرقابل اجرا تولید می‌کند",
      "Category": "stakeholder",
      "Impact": "medium",
      "Validated": true,
      "ReuseCount": 0,
      "SourceRef": "M-3",
      "SituationFa": "جلسه رفع ابهام پایپینگ بدون مشاور برگزار شد و مصوبه‌اش در مرحله تأیید رد شد.",
      "RecommendationFa": "جلسه فنی که خروجی‌اش نیازمند تأیید مشاور است، در نبود نماینده مشاور به تعویق بیفتد.",
      "CapturedAt": "2026-09-04",
      "CapturedBy": "مدیر مهندسی",
      "Tags": [
        "جلسات",
        "مشاور"
      ],
      "ValidatedBy": "u-pm"
    },
    {
      "Code": "K-5",
      "TitleFa": "خرید زودهنگام تجهیزات دوار، ریسک نوسان ارز را مهار می‌کند",
      "Category": "procurement",
      "Impact": "high",
      "Validated": true,
      "ReuseCount": 4,
      "SourceRef": "RSK-009",
      "SituationFa": "تأخیر در سفارش پمپ‌ها منجر به افزایش ۲۲ درصدی قیمت شد.",
      "RecommendationFa": "برای اقلام با زمان تدارک بیش از شش ماه، سفارش‌گذاری بلافاصله پس از تأیید مهندسی پایه انجام شود.",
      "CapturedAt": "2026-07-15",
      "CapturedBy": "مدیر تدارکات",
      "Tags": [
        "تدارکات",
        "ارز",
        "Long Lead"
      ],
      "ValidatedBy": "u-pm"
    },
    {
      "Code": "K-6",
      "TitleFa": "ثبت کاغذی کارکرد، اختلاف صورت‌وضعیت با پیمانکار جزء را سه برابر می‌کند",
      "Category": "cost",
      "Impact": "medium",
      "Validated": false,
      "ReuseCount": 0,
      "SourceRef": "AUD-2026-03",
      "SituationFa": "مغایرت ۱۸ درصدی بین کارکرد ادعایی پیمانکار جزء و ثبت کارگاه.",
      "RecommendationFa": "ثبت حضور پیمانکار جزء از طریق کارت تردد و تأیید روزانه سرپرست انجام شود، نه جمع‌بندی ماهانه.",
      "CapturedAt": "2026-06-20",
      "CapturedBy": "کنترل پروژه",
      "Tags": [
        "پیمانکار جزء",
        "تایم‌شیت"
      ]
    },
    {
      "Code": "K-7",
      "TitleFa": "داربست غیراستاندارد، پرتکرارترین ریشه حوادث ارتفاع است",
      "Category": "hse",
      "Impact": "high",
      "Validated": true,
      "ReuseCount": 2,
      "SourceRef": "INC-2026-11",
      "SituationFa": "دو حادثه سقوط از ارتفاع در یک فصل، هر دو با داربست بدون بازرسی.",
      "RecommendationFa": "برچسب سبز/قرمز بازرسی داربست اجباری شود و کار روی داربست بدون برچسب سبز متوقف گردد.",
      "CapturedAt": "2026-08-18",
      "CapturedBy": "مدیر HSE",
      "Tags": [
        "داربست",
        "کار در ارتفاع"
      ],
      "ValidatedBy": "u-pm"
    },
    {
      "Code": "K-8",
      "TitleFa": "نبود ماتریس ابلاغ، دستور کار شفاهی را جایگزین دستور کتبی می‌کند",
      "Category": "technical",
      "Impact": "medium",
      "Validated": false,
      "ReuseCount": 0,
      "SourceRef": "CR-041",
      "SituationFa": "تغییر مسیر پایپ‌رک ابتدا شفاهی اجرا شد و سپس دستور کتبی آمد.",
      "RecommendationFa": "هیچ تغییری بدون شماره ثبت در دبیرخانه اجرا نشود؛ اجرای شفاهی به عنوان عدم انطباق فرآیندی ثبت گردد.",
      "CapturedAt": "2026-09-05",
      "CapturedBy": "مدیر قرارداد",
      "Tags": [
        "تغییرات",
        "دستور کار"
      ]
    }
  ],
  "reuses": [],
  "rules": [
    {
      "Code": "NR-1",
      "EventCode": "notice_due",
      "NameFa": "اعلان قراردادی نزدیک مهلت",
      "Channels": [
        "email",
        "sms",
        "in_app"
      ],
      "AudienceRoles": [
        "مدیر قرارداد",
        "مدیر پروژه"
      ],
      "EscalateAfterHours": 24,
      "EscalateToRole": "مدیر ارشد پروژه",
      "Active": true
    },
    {
      "Code": "NR-2",
      "EventCode": "letter_unowned",
      "NameFa": "نامه وارده بدون مالک",
      "Channels": [
        "in_app",
        "email"
      ],
      "AudienceRoles": [
        "دبیرخانه"
      ],
      "EscalateAfterHours": 48,
      "EscalateToRole": "مدیر دفتر پروژه",
      "Active": true
    },
    {
      "Code": "NR-3",
      "EventCode": "action_overdue",
      "NameFa": "مصوبه جلسه معوق",
      "Channels": [
        "email",
        "in_app"
      ],
      "AudienceRoles": [
        "مالک مصوبه"
      ],
      "EscalateAfterHours": 72,
      "EscalateToRole": "رئیس جلسه",
      "Active": true
    },
    {
      "Code": "NR-4",
      "EventCode": "minutes_unapproved",
      "NameFa": "صورت‌جلسه تصویب‌نشده پس از سه روز",
      "Channels": [
        "in_app"
      ],
      "AudienceRoles": [
        "رئیس جلسه"
      ],
      "EscalateAfterHours": 72,
      "EscalateToRole": "مدیر پروژه",
      "Active": true
    },
    {
      "Code": "NR-5",
      "EventCode": "lesson_unvalidated",
      "NameFa": "درس‌آموخته در انتظار تأیید شورای دانش",
      "Channels": [
        "in_app",
        "board"
      ],
      "AudienceRoles": [
        "همه مدیران"
      ],
      "EscalateAfterHours": 168,
      "EscalateToRole": "مدیر پروژه",
      "Active": false
    }
  ]
};
