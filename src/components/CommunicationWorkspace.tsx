import { useEffect, useMemo, useState } from "react";
import { type Lang } from "../data/framework";
import { logAudit } from "../services/auditLogger";
import {
  CKM_FORMULA_VERSION,
  DEFAULT_RESPONSE_DAYS,
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
  type Meeting,
  type NotificationRule,
  type Stakeholder,
} from "../services/communication";

/* شش تب = دقیقاً شش زیرماژول ماژول ارتباطات و دانش */
export type CkmTab = "correspondence" | "meetings" | "stakeholders" | "notifications" | "knowledge" | "analytics";

const TABS: { id: CkmTab; fa: string; en: string; icon: string; proc: string }[] = [
  { id: "correspondence", fa: "مکاتبات و اعلان قراردادی", en: "Correspondence & Notices", icon: "✉️", proc: "d11-p1" },
  { id: "meetings", fa: "جلسات و مصوبات", en: "Meetings & Actions", icon: "🗓", proc: "d11-p2" },
  { id: "stakeholders", fa: "ذی‌نفعان و برنامه ارتباطات", en: "Stakeholders & Comms Plan", icon: "🤝", proc: "d11-p3" },
  { id: "notifications", fa: "اطلاع‌رسانی و تشدید", en: "Notification & Escalation", icon: "🔔", proc: "d11-p4" },
  { id: "knowledge", fa: "دانش و درس‌آموخته", en: "Knowledge & Lessons Learned", icon: "💡", proc: "d11-p5" },
  { id: "analytics", fa: "تحلیل و گزارش ارتباطات", en: "Communication Analytics", icon: "📊", proc: "d11-p6" },
];

const TODAY = "2026-09-08";

/* ─────────────── داده نمونه (پروژه OG-2401) ─────────────── */

const SAMPLE_LETTERS: Letter[] = [
  { id: "L-1", ref: "OG2401-CL-0412", direction: "incoming", letterClass: "claim_notice", subject: "اعلان ادعای تأخیر ناشی از تحویل دیرهنگام زمین منطقه ۳", from: "پیمانکار", to: "کارفرما", issuedAt: "2026-07-20", receivedAt: "2026-07-21", status: "under_review", links: ["CLM-014"], ownerRole: "مدیر قرارداد", attachments: 6 },
  { id: "L-2", ref: "OG2401-IN-0388", direction: "incoming", letterClass: "instruction", subject: "دستور تغییر مسیر پایپ‌رک واحد ۲۰۰", from: "کارفرما", to: "پیمانکار", issuedAt: "2026-08-30", receivedAt: "2026-08-31", status: "registered", links: ["CR-041"], ownerRole: "مدیر مهندسی", attachments: 3 },
  { id: "L-3", ref: "OG2401-RFI-0765", direction: "outgoing", letterClass: "rfi", subject: "استعلام ابهام نقشه فونداسیون F-204", from: "پیمانکار", to: "مشاور", issuedAt: "2026-09-01", status: "registered", ownerRole: "سرپرست مهندسی عمران", attachments: 2 },
  { id: "L-4", ref: "OG2401-NT-0201", direction: "outgoing", letterClass: "notice", subject: "اعلان وضعیت غیرقابل پیش‌بینی زمین در گمانه ۷", from: "پیمانکار", to: "کارفرما", issuedAt: "2026-08-05", status: "registered", links: ["RSK-022"], ownerRole: "مدیر پروژه", attachments: 4 },
  { id: "L-5", ref: "OG2401-SB-0530", direction: "outgoing", letterClass: "submittal", subject: "ارسال مدارک تأیید جوشکار ۶G برای بازرسی شخص ثالث", from: "پیمانکار", to: "مشاور", issuedAt: "2026-09-02", status: "under_review", ownerRole: "مدیر کیفیت", attachments: 12 },
  { id: "L-6", ref: "OG2401-GN-0299", direction: "incoming", letterClass: "general", subject: "معرفی نماینده جدید کارفرما در کارگاه", from: "کارفرما", to: "پیمانکار", issuedAt: "2026-09-03", receivedAt: "2026-09-03", respondedAt: "2026-09-06", status: "closed", ownerRole: "مدیر پروژه", attachments: 1 },
  { id: "L-7", ref: "OG2401-NC-0117", direction: "incoming", letterClass: "ncr_related", subject: "ابلاغ عدم انطباق جوش خط ۱۴ اینچ و درخواست اقدام اصلاحی", from: "مشاور", to: "پیمانکار", issuedAt: "2026-08-25", receivedAt: "2026-08-26", status: "under_review", links: ["NCR-338"], ownerRole: "مدیر کیفیت", attachments: 5 },
  { id: "L-8", ref: "OG2401-CL-0418", direction: "outgoing", letterClass: "claim_notice", subject: "اعلان ادعای هزینه ناشی از توقف کار توسط بازرس ایمنی", from: "پیمانکار", to: "کارفرما", issuedAt: "2026-08-02", status: "registered", links: ["CLM-018"], ownerRole: "مدیر قرارداد", attachments: 8 },
  { id: "L-9", ref: "OG2401-RFI-0771", direction: "outgoing", letterClass: "rfi", subject: "استعلام مشخصات رنگ مخزن T-02", from: "پیمانکار", to: "مشاور", issuedAt: "2026-09-04", receivedAt: undefined, respondedAt: "2026-09-07", status: "responded", ownerRole: "سرپرست خوردگی", attachments: 1 },
  { id: "L-10", ref: "OG2401-IN-0392", direction: "incoming", letterClass: "instruction", subject: "دستور توقف موقت عملیات خاکی منطقه ۱", from: "کارفرما", to: "پیمانکار", issuedAt: "2026-09-06", receivedAt: "2026-09-06", status: "registered", links: ["CR-044"], ownerRole: "مدیر کارگاه", attachments: 2 },
];

const SAMPLE_MEETINGS: Meeting[] = [
  { id: "M-1", title: "جلسه هفتگی پیشرفت کارگاه", type: "weekly", heldAt: "2026-09-05", chair: "مدیر پروژه", invited: ["مدیر پروژه", "مدیر کارگاه", "برنامه‌ریزی", "کیفیت", "ایمنی", "مهندسی"], attendees: ["مدیر پروژه", "مدیر کارگاه", "برنامه‌ریزی", "کیفیت", "ایمنی"], minutesApproved: true, distributedAt: "2026-09-06" },
  { id: "M-2", title: "جلسه ماهانه با کارفرما", type: "client", heldAt: "2026-09-02", chair: "مدیر پروژه", invited: ["کارفرما", "مشاور", "مدیر پروژه", "مدیر قرارداد", "برنامه‌ریزی"], attendees: ["کارفرما", "مشاور", "مدیر پروژه", "مدیر قرارداد", "برنامه‌ریزی"], minutesApproved: true, distributedAt: "2026-09-04" },
  { id: "M-3", title: "جلسه فنی رفع ابهام پایپینگ", type: "technical", heldAt: "2026-09-03", chair: "مدیر مهندسی", invited: ["مهندسی", "اجرا", "کیفیت", "مشاور"], attendees: ["مهندسی", "اجرا"], minutesApproved: false, distributedAt: undefined },
  { id: "M-4", title: "جلسه بررسی ادعای تأخیر زمین", type: "claim", heldAt: "2026-08-29", chair: "مدیر قرارداد", invited: ["مدیر قرارداد", "برنامه‌ریزی", "حقوقی", "کارفرما"], attendees: ["مدیر قرارداد", "برنامه‌ریزی", "حقوقی"], minutesApproved: true, distributedAt: "2026-08-31" },
  { id: "M-5", title: "کمیته ایمنی ماهانه", type: "hse", heldAt: "2026-09-01", chair: "مدیر HSE", invited: ["مدیر HSE", "افسران ایمنی", "مدیر کارگاه", "پیمانکاران"], attendees: ["مدیر HSE", "افسران ایمنی", "مدیر کارگاه"], minutesApproved: false, distributedAt: "2026-09-02" },
];

const SAMPLE_ACTIONS: ActionItem[] = [
  { id: "A-1", meetingId: "M-1", title: "ارائه برنامه جبرانی جوشکاری پایپ‌رک منطقه ۳", ownerRole: "برنامه‌ریزی", dueDate: "2026-09-12", status: "in_progress", links: ["A-1240"] },
  { id: "A-2", meetingId: "M-1", title: "تأمین ۱۸ جوشکار ۶G طبق درخواست تجهیز MOB-0112", ownerRole: "منابع انسانی", dueDate: "2026-09-04", status: "in_progress", links: ["MOB-0112"] },
  { id: "A-3", meetingId: "M-1", title: "به‌روزرسانی نقشه‌های As-Built واحد ۱۰۰", ownerRole: "مهندسی", dueDate: "2026-09-20", status: "open" },
  { id: "A-4", meetingId: "M-2", title: "ارسال مستندات پشتیبان ادعای تأخیر زمین به کارفرما", ownerRole: "مدیر قرارداد", dueDate: "2026-09-09", status: "in_progress", links: ["CLM-014"] },
  { id: "A-5", meetingId: "M-2", title: "توافق بر روش اندازه‌گیری پیشرفت کار خاکی", ownerRole: "برنامه‌ریزی", dueDate: "2026-08-28", status: "open" },
  { id: "A-6", meetingId: "M-3", title: "صدور نقشه اصلاحی مسیر لوله ۱۴ اینچ", ownerRole: "مهندسی", dueDate: "2026-09-01", status: "open", links: ["NCR-338"] },
  { id: "A-7", meetingId: "M-4", title: "تهیه تحلیل تأخیر پنجره‌ای برای دوره تیر تا شهریور", ownerRole: "برنامه‌ریزی", dueDate: "2026-09-15", status: "open", links: ["CLM-014"] },
  { id: "A-8", meetingId: "M-5", title: "بازآموزی ایمنی کار در ارتفاع برای اکیپ داربست", ownerRole: "مدیر HSE", dueDate: "2026-09-10", status: "in_progress" },
  { id: "A-9", meetingId: "M-1", title: "بستن پانچ‌های کلاس A واحد ۲۰۰", ownerRole: "کیفیت", dueDate: "2026-08-30", status: "open" },
  { id: "A-10", meetingId: "M-2", title: "ابلاغ رسمی نماینده جدید کارفرما به تیم اجرا", ownerRole: "مدیر پروژه", dueDate: "2026-09-07", status: "done", closedAt: "2026-09-06" },
];

const SAMPLE_STAKEHOLDERS: Stakeholder[] = [
  { id: "S-1", name: "شرکت ملی نفت — مدیریت طرح", org: "کارفرما", role: "تصمیم‌گیر نهایی", power: 5, interest: 5, current: "neutral", desired: "supportive", channel: ["جلسه ماهانه", "نامه رسمی"], frequency: "monthly", ownerRole: "مدیر پروژه" },
  { id: "S-2", name: "مهندسان مشاور طرح", org: "مشاور", role: "تأییدکننده فنی", power: 4, interest: 5, current: "supportive", desired: "supportive", channel: ["نامه رسمی", "جلسه فنی"], frequency: "weekly", ownerRole: "مدیر مهندسی" },
  { id: "S-3", name: "اداره کل حفاظت محیط زیست استان", org: "نهاد نظارتی", role: "مجوزدهنده", power: 5, interest: 2, current: "unaware", desired: "neutral", channel: ["نامه رسمی"], frequency: "on_event", ownerRole: "مدیر HSE" },
  { id: "S-4", name: "پیمانکار جزء سازه فلزی", org: "پیمانکار جزء", role: "مجری", power: 2, interest: 5, current: "supportive", desired: "leading", channel: ["جلسه هفتگی", "پیام‌رسان"], frequency: "weekly", ownerRole: "مدیر کارگاه" },
  { id: "S-5", name: "جامعه محلی و شورای روستا", org: "ذی‌نفع اجتماعی", role: "تأثیرپذیر", power: 3, interest: 4, current: "resistant", desired: "neutral", channel: ["نشست حضوری"], frequency: "monthly", ownerRole: "روابط عمومی" },
  { id: "S-6", name: "بازرسی فنی شخص ثالث", org: "TPI", role: "گواهی‌دهنده", power: 4, interest: 3, current: "neutral", desired: "supportive", channel: ["نامه رسمی", "بازرسی میدانی"], frequency: "biweekly", ownerRole: "مدیر کیفیت" },
  { id: "S-7", name: "تأمین‌کننده تجهیزات دوار", org: "فروشنده", role: "تأمین‌کننده بحرانی", power: 3, interest: 3, current: "neutral", desired: "supportive", channel: ["ایمیل"], frequency: "biweekly", ownerRole: "مدیر تدارکات" },
  { id: "S-8", name: "اداره کار و تأمین اجتماعی", org: "نهاد نظارتی", role: "ناظر انطباق", power: 4, interest: 2, current: "unaware", desired: "neutral", channel: [], frequency: "on_event", ownerRole: "" },
];

const SAMPLE_LESSONS: Lesson[] = [
  { id: "K-1", title: "تحویل زمین بدون آزمایش ژئوتکنیک تکمیلی، ریسک تأخیر سیستماتیک می‌سازد", category: "schedule", sourceRef: "CLM-014", situation: "تحویل منطقه ۳ بدون گمانه‌زنی کافی انجام شد و در حفاری به لایه سنگی برخورد کردیم.", recommendation: "پیش از پذیرش تحویل زمین، گزارش ژئوتکنیک با حداقل یک گمانه در هر ۲۵۰۰ متر مربع الزامی شود و در صورت‌جلسه تحویل قید گردد.", capturedAt: "2026-08-10", capturedBy: "مدیر برنامه‌ریزی", validated: true, reuseCount: 3, impact: "high", tags: ["تحویل زمین", "ژئوتکنیک", "ادعا"] },
  { id: "K-2", title: "تأیید صلاحیت جوشکار پیش از بسیج، دوباره‌کاری بازرسی را حذف می‌کند", category: "quality", sourceRef: "NCR-338", situation: "جوشکاران بدون تأیید قبلی TPI به کارگاه آمدند و ۱۱ نفر رد صلاحیت شدند.", recommendation: "آزمون تأیید جوشکار به گیت تجهیز نیرو در ماژول منابع انسانی اضافه شود و بدون آن کارت تردد صادر نگردد.", capturedAt: "2026-08-28", capturedBy: "مدیر کیفیت", validated: true, reuseCount: 2, impact: "high", tags: ["جوشکاری", "تجهیز نیرو", "TPI"] },
  { id: "K-3", title: "اعلان ادعا در روز آخر مهلت، قدرت چانه‌زنی را از بین می‌برد", category: "contract", sourceRef: "CLM-018", situation: "اعلان توقف کار توسط ایمنی در روز بیست‌وهفتم ارسال شد و کارفرما به شکلی بودن آن ایراد گرفت.", recommendation: "هشدار خودکار در روز هفتم و چهاردهم مهلت اعلان فعال شود و ارسال در نیمه دوم مهلت نیازمند تأیید مدیر قرارداد باشد.", capturedAt: "2026-09-01", capturedBy: "مدیر قرارداد", validated: true, reuseCount: 1, impact: "high", tags: ["Time-Bar", "ادعا", "FIDIC"] },
  { id: "K-4", title: "جلسه فنی بدون حضور مشاور، مصوبه غیرقابل اجرا تولید می‌کند", category: "stakeholder", sourceRef: "M-3", situation: "جلسه رفع ابهام پایپینگ بدون مشاور برگزار شد و مصوبه‌اش در مرحله تأیید رد شد.", recommendation: "جلسه فنی که خروجی‌اش نیازمند تأیید مشاور است، در نبود نماینده مشاور به تعویق بیفتد.", capturedAt: "2026-09-04", capturedBy: "مدیر مهندسی", validated: true, reuseCount: 0, impact: "medium", tags: ["جلسات", "مشاور"] },
  { id: "K-5", title: "خرید زودهنگام تجهیزات دوار، ریسک نوسان ارز را مهار می‌کند", category: "procurement", sourceRef: "RSK-009", situation: "تأخیر در سفارش پمپ‌ها منجر به افزایش ۲۲ درصدی قیمت شد.", recommendation: "برای اقلام با زمان تدارک بیش از شش ماه، سفارش‌گذاری بلافاصله پس از تأیید مهندسی پایه انجام شود.", capturedAt: "2026-07-15", capturedBy: "مدیر تدارکات", validated: true, reuseCount: 4, impact: "high", tags: ["تدارکات", "ارز", "Long Lead"] },
  { id: "K-6", title: "ثبت کاغذی کارکرد، اختلاف صورت‌وضعیت با پیمانکار جزء را سه برابر می‌کند", category: "cost", sourceRef: "AUD-2026-03", situation: "مغایرت ۱۸ درصدی بین کارکرد ادعایی پیمانکار جزء و ثبت کارگاه.", recommendation: "ثبت حضور پیمانکار جزء از طریق کارت تردد و تأیید روزانه سرپرست انجام شود، نه جمع‌بندی ماهانه.", capturedAt: "2026-06-20", capturedBy: "کنترل پروژه", validated: false, reuseCount: 0, impact: "medium", tags: ["پیمانکار جزء", "تایم‌شیت"] },
  { id: "K-7", title: "داربست غیراستاندارد، پرتکرارترین ریشه حوادث ارتفاع است", category: "hse", sourceRef: "INC-2026-11", situation: "دو حادثه سقوط از ارتفاع در یک فصل، هر دو با داربست بدون بازرسی.", recommendation: "برچسب سبز/قرمز بازرسی داربست اجباری شود و کار روی داربست بدون برچسب سبز متوقف گردد.", capturedAt: "2026-08-18", capturedBy: "مدیر HSE", validated: true, reuseCount: 2, impact: "high", tags: ["داربست", "کار در ارتفاع"] },
  { id: "K-8", title: "نبود ماتریس ابلاغ، دستور کار شفاهی را جایگزین دستور کتبی می‌کند", category: "technical", sourceRef: "CR-041", situation: "تغییر مسیر پایپ‌رک ابتدا شفاهی اجرا شد و سپس دستور کتبی آمد.", recommendation: "هیچ تغییری بدون شماره ثبت در دبیرخانه اجرا نشود؛ اجرای شفاهی به عنوان عدم انطباق فرآیندی ثبت گردد.", capturedAt: "2026-09-05", capturedBy: "مدیر قرارداد", validated: false, reuseCount: 0, impact: "medium", tags: ["تغییرات", "دستور کار"] },
];

const SAMPLE_RULES: NotificationRule[] = [
  { id: "NR-1", event: "اعلان قراردادی نزدیک مهلت", channels: ["email", "sms", "in_app"], audienceRoles: ["مدیر قرارداد", "مدیر پروژه"], escalateAfterHours: 24, escalateToRole: "مدیر ارشد پروژه", active: true },
  { id: "NR-2", event: "نامه وارده بدون مالک", channels: ["in_app", "email"], audienceRoles: ["دبیرخانه"], escalateAfterHours: 48, escalateToRole: "مدیر دفتر پروژه", active: true },
  { id: "NR-3", event: "مصوبه جلسه معوق", channels: ["email", "in_app"], audienceRoles: ["مالک مصوبه"], escalateAfterHours: 72, escalateToRole: "رئیس جلسه", active: true },
  { id: "NR-4", event: "صورت‌جلسه تصویب‌نشده پس از سه روز", channels: ["in_app"], audienceRoles: ["رئیس جلسه"], escalateAfterHours: 72, escalateToRole: "مدیر پروژه", active: true },
  { id: "NR-5", event: "درس‌آموخته جدید تأییدشده", channels: ["in_app", "board"], audienceRoles: ["همه مدیران"], escalateAfterHours: 0, escalateToRole: "—", active: false },
];

const ALL_CATEGORIES: LessonCategory[] = ["technical", "schedule", "cost", "quality", "hse", "contract", "procurement", "hr", "stakeholder"];

const CATEGORY_LABEL: Record<LessonCategory, { fa: string; en: string }> = {
  technical: { fa: "فنی", en: "Technical" },
  schedule: { fa: "زمان", en: "Schedule" },
  cost: { fa: "هزینه", en: "Cost" },
  quality: { fa: "کیفیت", en: "Quality" },
  hse: { fa: "ایمنی", en: "HSE" },
  contract: { fa: "قرارداد", en: "Contract" },
  procurement: { fa: "تدارکات", en: "Procurement" },
  hr: { fa: "منابع انسانی", en: "HR" },
  stakeholder: { fa: "ذی‌نفعان", en: "Stakeholder" },
};

const CLASS_LABEL: Record<Letter["letterClass"], { fa: string; en: string }> = {
  general: { fa: "عادی", en: "General" },
  instruction: { fa: "دستور کار", en: "Instruction" },
  notice: { fa: "اعلان قراردادی", en: "Notice" },
  claim_notice: { fa: "اعلان ادعا", en: "Claim notice" },
  submittal: { fa: "ارسال مدرک", en: "Submittal" },
  rfi: { fa: "استعلام", en: "RFI" },
  ncr_related: { fa: "عدم انطباق", en: "NCR related" },
};

const ENGAGEMENT_LABEL: Record<EngagementLevel, { fa: string; en: string }> = {
  unaware: { fa: "ناآگاه", en: "Unaware" },
  resistant: { fa: "مقاوم", en: "Resistant" },
  neutral: { fa: "خنثی", en: "Neutral" },
  supportive: { fa: "حامی", en: "Supportive" },
  leading: { fa: "پیشران", en: "Leading" },
};

const QUADRANT_LABEL = {
  manage_closely: { fa: "مدیریت نزدیک", en: "Manage closely", tone: "bg-rose-400/15 text-rose-300" },
  keep_satisfied: { fa: "راضی نگه دار", en: "Keep satisfied", tone: "bg-amber-400/15 text-amber-200" },
  keep_informed: { fa: "مطلع نگه دار", en: "Keep informed", tone: "bg-sky-400/15 text-sky-300" },
  monitor: { fa: "پایش", en: "Monitor", tone: "bg-white/5 tx3" },
} as const;

/* ─────────────── اجزای نمایشی ─────────────── */

function Kpi({ label, value, hint, tone = "tx1" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/15 px-2.5 py-2">
      <div className="text-[8.5px] font-extralight tx3">{label}</div>
      <div className={`text-[13px] font-semibold tabular-nums ${tone}`} dir="ltr">{value}</div>
      {hint && <div className="text-[8px] font-extralight tx4">{hint}</div>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="glass-dark rounded-2xl p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h4 className="text-[11px] font-semibold tx1">{title}</h4>
        {note && <span className="text-[8.5px] font-extralight tx3">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-2 py-1 text-start font-normal">{children}</th>;
}

/* ══════════════════════════ کامپوننت اصلی ══════════════════════════ */

export default function CommunicationWorkspace({
  lang,
  initialTab = "correspondence",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: CkmTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const [tab, setTab] = useState<CkmTab>(initialTab);
  const [letters, setLetters] = useState<Letter[]>(SAMPLE_LETTERS);
  const [actions, setActions] = useState<ActionItem[]>(SAMPLE_ACTIONS);
  const [lessons, setLessons] = useState<Lesson[]>(SAMPLE_LESSONS);
  const [classFilter, setClassFilter] = useState<"all" | Letter["letterClass"]>("all");
  const [selectedMeeting, setSelectedMeeting] = useState<string>("M-1");
  useEffect(() => setTab(initialTab), [initialTab]);

  const fmt = (n: number) => n.toLocaleString(rtl ? "fa-IR" : "en-US");
  const L = (b: { fa: string; en: string }) => (rtl ? b.fa : b.en);

  /* ── محاسبات مکاتبات ── */
  const letterRows = useMemo(
    () => letters.map((l) => ({ l, due: responseDue(l, TODAY), issues: validateLetter(l) })),
    [letters]
  );
  const timeBarBreaches = letterRows.filter((r) => r.due.timeBarBreached).length;
  const overdueLetters = letterRows.filter((r) => r.due.overdue).length;
  const dueSoon = letterRows.filter((r) => r.due.severity === "due_soon").length;
  const avgResponse = averageResponseTime(letters);
  const openLetters = letters.filter((l) => l.status !== "closed").length;

  const filteredLetters = useMemo(
    () => (classFilter === "all" ? letterRows : letterRows.filter((r) => r.l.letterClass === classFilter)),
    [letterRows, classFilter]
  );

  /* ── محاسبات جلسات ── */
  const meetingRows = useMemo(
    () => SAMPLE_MEETINGS.map((m) => ({ m, h: meetingHealth(m, actions, TODAY) })),
    [actions]
  );
  const overdueActions = actions.filter((a) => actionState(a, TODAY) === "overdue").length;
  const unapprovedMinutes = SAMPLE_MEETINGS.filter((m) => !m.minutesApproved).length;
  const meetingActions = actions.filter((a) => a.meetingId === selectedMeeting);

  /* ── محاسبات ذی‌نفعان ── */
  const critical = criticalStakeholders(SAMPLE_STAKEHOLDERS);
  const coverage = commsPlanCoverage(SAMPLE_STAKEHOLDERS);
  const channels = communicationChannels(SAMPLE_STAKEHOLDERS.length);
  const distGap = distributionGap(
    ["کارفرما", "مشاور", "مدیر پروژه", "مدیر قرارداد", "برنامه‌ریزی"],
    SAMPLE_MEETINGS[1].attendees
  );

  /* ── محاسبات دانش ── */
  const utilization = knowledgeUtilization(lessons);
  const coverageByCat = lessonCoverage(lessons, ALL_CATEGORIES);
  const maxCat = Math.max(...coverageByCat.map((c) => c.count), 1);
  const rankedLessons = useMemo(
    () => [...lessons].map((l) => ({ l, v: lessonValue(l), issues: validateLesson(l) })).sort((a, b) => b.v - a.v),
    [lessons]
  );

  const alerts = ckmEws({
    timeBarBreaches,
    overdueLetters,
    overdueActions,
    avgResponseDays: avgResponse,
    engagementGaps: critical.length,
    knowledgeUtilizationPct: utilization,
    unapprovedMinutes,
  });

  /* ── تعاملات ── */
  const respond = (id: string) => {
    setLetters((prev) =>
      prev.map((l) => (l.id === id ? { ...l, respondedAt: TODAY, status: "responded" as const } : l))
    );
    logAudit("CKM_LETTER_RESPOND", "Communication", `Letter ${id} marked responded on ${TODAY}`);
  };

  const closeAction = (id: string) => {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status: "done" as const, closedAt: TODAY } : a)));
    logAudit("CKM_ACTION_CLOSE", "Communication", `Meeting action ${id} closed`);
  };

  const reuseLesson = (id: string) => {
    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, reuseCount: l.reuseCount + 1 } : l)));
    logAudit("CKM_LESSON_REUSE", "Communication", `Lesson ${id} reused — utilization counter incremented`);
  };

  const validateLessonRow = (id: string) => {
    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, validated: true } : l)));
    logAudit("CKM_LESSON_VALIDATE", "Communication", `Lesson ${id} validated by knowledge board`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* هدر */}
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-violet-400/40 bg-violet-400/10 text-[15px]">📡</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-semibold tx1">
              {rtl ? "مدیریت ارتباطات و دانش" : "Communications & Knowledge Management"}
            </h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "اعلان قراردادی مهلت‌دار است · مصوبه بدون مالک و موعد پذیرفته نمی‌شود · دانش با استفاده مجدد سنجیده می‌شود"
                : "notices are time-barred · no action without owner and due date · knowledge measured by reuse"}
            </p>
          </div>
          <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold tabular-nums ${timeBarBreaches ? "bg-rose-400/15 text-rose-300" : "bg-emerald-400/15 text-emerald-300"}`}>
            {rtl ? "نقض مهلت قراردادی" : "Time-bar breach"} {fmt(timeBarBreaches)}
          </span>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">{rtl ? "پاسخ" : "Resp"} {avgResponse}d</span>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">{rtl ? "دانش" : "Reuse"} {utilization}%</span>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3">{rtl ? "داده نمونه" : "Sample data"}</span>
          <span className="rounded-lg border b-line-soft px-2 py-1 font-mono text-[9px] tx3" dir="ltr">{CKM_FORMULA_VERSION} · {TODAY}</span>
        </div>
        {alerts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {alerts.map((a) => (
              <span
                key={a.code}
                className={`rounded-lg px-2 py-0.5 text-[8.5px] ${
                  a.severity === "critical" ? "bg-rose-400/15 text-rose-300" : a.severity === "high" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"
                }`}
              >
                <span dir="ltr">{a.code}</span> · {a.message}
              </span>
            ))}
          </div>
        )}
      </section>

      {!hideTabs && (
        <nav className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl bg-black/15 p-1">
          {TABS.map((it) => (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-light transition ${tab === it.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"}`}
              title={it.proc}
            >
              <span>{it.icon}</span>
              <span>{rtl ? it.fa : it.en}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* ═══ تب ۱: مکاتبات ═══ */}
        {tab === "correspondence" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Kpi label={rtl ? "نامه باز" : "Open letters"} value={fmt(openLetters)} hint={`${fmt(letters.length)} ${rtl ? "کل" : "total"}`} />
              <Kpi label={rtl ? "نقض مهلت قراردادی" : "Time-bar breached"} value={fmt(timeBarBreaches)} tone={timeBarBreaches ? "text-rose-300" : "text-emerald-300"} hint={rtl ? "حق ادعا در خطر" : "claim right at risk"} />
              <Kpi label={rtl ? "از مهلت گذشته" : "Overdue"} value={fmt(overdueLetters)} tone={overdueLetters ? "text-amber-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "نزدیک مهلت" : "Due soon"} value={fmt(dueSoon)} hint={rtl ? "سه روز کاری" : "3 working days"} />
              <Kpi label={rtl ? "میانگین پاسخ" : "Avg response"} value={`${avgResponse}`} tone={avgResponse > 10 ? "text-amber-300" : "tx1"} hint={rtl ? "روز کاری" : "working days"} />
            </div>

            <nav className="flex flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1">
              {(["all", "claim_notice", "notice", "instruction", "rfi", "submittal", "ncr_related", "general"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setClassFilter(c)}
                  className={`rounded-lg px-2.5 py-1 text-[9px] font-light transition ${classFilter === c ? "toggle-on tx1" : "tx3 hover:tx2"}`}
                >
                  {c === "all" ? (rtl ? "همه" : "All") : L(CLASS_LABEL[c])}
                  {c !== "all" && isTimeBarred(c) && <span className="ms-1 text-rose-300">•</span>}
                </button>
              ))}
            </nav>

            <Section
              title={rtl ? "دفتر مکاتبات" : "Correspondence register"}
              note={rtl ? "مهلت‌ها بر پایه روز کاری تقویم پروژه محاسبه می‌شود، نه روز تقویمی" : "deadlines counted in project working days, not calendar days"}
            >
              <div className="thin-scroll max-h-[420px] overflow-auto">
                <table className="w-full text-[9.5px]">
                  <thead className="tx3">
                    <tr className="border-b b-line-soft">
                      <Th>{rtl ? "شماره" : "Ref"}</Th>
                      <Th>{rtl ? "نوع" : "Class"}</Th>
                      <Th>{rtl ? "موضوع" : "Subject"}</Th>
                      <Th>{rtl ? "طرف" : "Party"}</Th>
                      <Th>{rtl ? "مهلت" : "Due"}</Th>
                      <Th>{rtl ? "باقی‌مانده" : "Left"}</Th>
                      <Th>{rtl ? "ارجاع" : "Links"}</Th>
                      <Th>{rtl ? "اقدام" : "Action"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLetters.map(({ l, due, issues }) => (
                      <tr key={l.id} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{l.ref}</td>
                        <td className="px-2 py-1">
                          <span className={`rounded px-1.5 py-[1px] text-[8px] ${isTimeBarred(l.letterClass) ? "bg-rose-400/15 text-rose-300" : "bg-white/5 tx3"}`}>
                            {L(CLASS_LABEL[l.letterClass])}
                          </span>
                        </td>
                        <td className="max-w-[280px] px-2 py-1 tx1">
                          <div className="truncate" title={l.subject}>{l.subject}</div>
                          {issues.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {issues.map((i, k) => (
                                <span key={k} className={`text-[7.5px] ${i.severity === "error" ? "text-rose-300" : "text-amber-200"}`} dir="ltr">{i.code}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1 tx3">
                          <span className="text-[8.5px]">{l.direction === "incoming" ? `← ${l.from}` : `${l.to} →`}</span>
                        </td>
                        <td className="px-2 py-1 font-mono tx3" dir="ltr">{due.dueDate}</td>
                        <td className={`px-2 py-1 tabular-nums ${
                          due.severity === "critical" ? "text-rose-300 font-semibold"
                          : due.severity === "overdue" ? "text-rose-300"
                          : due.severity === "due_soon" ? "text-amber-300" : "text-emerald-300"
                        }`} dir="ltr">
                          {l.respondedAt ? "✓" : `${due.daysRemaining}d`}
                        </td>
                        <td className="px-2 py-1 font-mono text-[8px] tx4" dir="ltr">{l.links?.join(" ") ?? "—"}</td>
                        <td className="px-2 py-1">
                          {!l.respondedAt && (
                            <button
                              onClick={() => respond(l.id)}
                              className="glass-row rounded-lg px-2 py-0.5 text-[8.5px] font-light tx2 transition hover:tx1"
                            >
                              {rtl ? "ثبت پاسخ" : "Respond"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title={rtl ? "مهلت پیش‌فرض پاسخ بر حسب نوع نامه" : "Default response window by letter class"} note={rtl ? "روز کاری · موارد نشان‌دار تعهد قراردادی دارند" : "working days · marked classes carry contractual obligation"}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
                {(Object.keys(DEFAULT_RESPONSE_DAYS) as Letter["letterClass"][]).map((c) => (
                  <div key={c} className={`rounded-xl border px-2.5 py-2 ${isTimeBarred(c) ? "border-rose-400/30 bg-rose-400/5" : "b-line-soft bg-black/15"}`}>
                    <div className="text-[8.5px] font-extralight tx3">{L(CLASS_LABEL[c])}</div>
                    <div className="text-[13px] font-semibold tabular-nums tx1" dir="ltr">{fmt(DEFAULT_RESPONSE_DAYS[c])}</div>
                    {isTimeBarred(c) && <div className="text-[7.5px] text-rose-300">{rtl ? "مهلت الزام‌آور" : "time-barred"}</div>}
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ═══ تب ۲: جلسات و مصوبات ═══ */}
        {tab === "meetings" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "جلسات ثبت‌شده" : "Meetings"} value={fmt(SAMPLE_MEETINGS.length)} />
              <Kpi label={rtl ? "مصوبات باز" : "Open actions"} value={fmt(actions.filter((a) => actionState(a, TODAY) !== "done").length)} />
              <Kpi label={rtl ? "مصوبات معوق" : "Overdue actions"} value={fmt(overdueActions)} tone={overdueActions ? "text-rose-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "صورت‌جلسه تصویب‌نشده" : "Unapproved minutes"} value={fmt(unapprovedMinutes)} tone={unapprovedMinutes ? "text-amber-300" : "text-emerald-300"} />
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
              <Section title={rtl ? "جلسات" : "Meetings"} note={rtl ? "برای دیدن مصوبات انتخاب کنید" : "select to view actions"}>
                <div className="space-y-1.5">
                  {meetingRows.map(({ m, h }) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMeeting(m.id)}
                      className={`glass-row w-full rounded-lg px-2.5 py-2 text-start transition ${selectedMeeting === m.id ? "row-on" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${h.status === "green" ? "bg-emerald-400" : h.status === "amber" ? "bg-amber-400" : "bg-rose-400"}`} />
                        <span className="min-w-0 flex-1 truncate text-[10px] font-light tx1">{m.title}</span>
                        <span className="shrink-0 font-mono text-[8px] tx4" dir="ltr">{m.heldAt}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 ps-3.5">
                        <span className="text-[8px] tx3">{rtl ? "حضور" : "Attend"} {h.attendanceRate}%</span>
                        <span className="text-[8px] tx3">·</span>
                        <span className="text-[8px] tx3">{rtl ? "مصوبه" : "Actions"} {fmt(h.actions)}</span>
                        {h.overdue > 0 && <span className="rounded bg-rose-400/15 px-1 py-[1px] text-[7.5px] text-rose-300">{fmt(h.overdue)} {rtl ? "معوق" : "overdue"}</span>}
                        {!m.minutesApproved && <span className="rounded bg-amber-400/15 px-1 py-[1px] text-[7.5px] text-amber-200">{rtl ? "تصویب‌نشده" : "unapproved"}</span>}
                        {!m.distributedAt && <span className="rounded bg-white/5 px-1 py-[1px] text-[7.5px] tx4">{rtl ? "توزیع‌نشده" : "not distributed"}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </Section>

              <Section
                title={rtl ? "مصوبات جلسه" : "Meeting actions"}
                note={rtl ? "مصوبه بدون مالک و موعد اصلاً مصوبه نیست" : "an action without owner and due date is not an action"}
              >
                <table className="w-full text-[9.5px]">
                  <thead className="tx3">
                    <tr className="border-b b-line-soft">
                      <Th>{rtl ? "شرح" : "Title"}</Th>
                      <Th>{rtl ? "مالک" : "Owner"}</Th>
                      <Th>{rtl ? "موعد" : "Due"}</Th>
                      <Th>{rtl ? "وضعیت" : "Status"}</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetingActions.map((a) => {
                      const st = actionState(a, TODAY);
                      return (
                        <tr key={a.id} className="border-b b-line-soft/50">
                          <td className="max-w-[240px] px-2 py-1 tx1">
                            <div className="truncate" title={a.title}>{a.title}</div>
                            {a.links && <div className="font-mono text-[7.5px] tx4" dir="ltr">{a.links.join(" ")}</div>}
                          </td>
                          <td className="px-2 py-1 tx2">{a.ownerRole}</td>
                          <td className="px-2 py-1 font-mono tx3" dir="ltr">{a.dueDate}</td>
                          <td className="px-2 py-1">
                            <span className={`rounded px-1.5 py-[1px] text-[8px] ${
                              st === "done" ? "bg-emerald-400/15 text-emerald-300"
                              : st === "overdue" ? "bg-rose-400/15 text-rose-300"
                              : st === "in_progress" ? "bg-sky-400/15 text-sky-300" : "bg-white/5 tx3"
                            }`}>
                              {st === "done" ? (rtl ? "انجام‌شده" : "Done")
                                : st === "overdue" ? (rtl ? "معوق" : "Overdue")
                                : st === "in_progress" ? (rtl ? "در جریان" : "In progress") : rtl ? "باز" : "Open"}
                            </span>
                          </td>
                          <td className="px-2 py-1">
                            {st !== "done" && (
                              <button onClick={() => closeAction(a.id)} className="glass-row rounded-lg px-2 py-0.5 text-[8.5px] font-light tx2 transition hover:tx1">
                                {rtl ? "بستن" : "Close"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Section>
            </div>
          </>
        )}

        {/* ═══ تب ۳: ذی‌نفعان ═══ */}
        {tab === "stakeholders" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "ذی‌نفعان ثبت‌شده" : "Stakeholders"} value={fmt(SAMPLE_STAKEHOLDERS.length)} />
              <Kpi label={rtl ? "ذی‌نفع بحرانی" : "Critical gaps"} value={fmt(critical.length)} tone={critical.length ? "text-rose-300" : "text-emerald-300"} hint={rtl ? "قدرت بالا با شکاف تعامل" : "high power with gap"} />
              <Kpi label={rtl ? "پوشش برنامه ارتباطات" : "Comms plan coverage"} value={`${coverage}%`} tone={coverage < 90 ? "text-amber-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "کانال ارتباطی بالقوه" : "Potential channels"} value={fmt(channels)} hint="n(n−1)/2" />
            </div>

            <Section title={rtl ? "شبکه قدرت — علاقه" : "Power–interest grid"} note={rtl ? "محور افقی علاقه، محور عمودی قدرت" : "x: interest, y: power"}>
              <div className="relative h-64 rounded-xl border b-line-soft bg-black/20">
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                  {(["keep_satisfied", "manage_closely", "monitor", "keep_informed"] as const).map((q) => (
                    <div key={q} className="border b-line-soft/40 p-1.5">
                      <span className="text-[7.5px] font-extralight tx4">{L(QUADRANT_LABEL[q])}</span>
                    </div>
                  ))}
                </div>
                {SAMPLE_STAKEHOLDERS.map((s) => {
                  const gap = engagementGap(s);
                  const left = ((s.interest - 1) / 4) * 88 + 4;
                  const bottom = ((s.power - 1) / 4) * 84 + 6;
                  return (
                    <div
                      key={s.id}
                      className="absolute -translate-x-1/2"
                      style={{ insetInlineStart: `${left}%`, bottom: `${bottom}%` }}
                      title={`${s.name} · ${L(ENGAGEMENT_LABEL[s.current])} → ${L(ENGAGEMENT_LABEL[s.desired])}`}
                    >
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full text-[8px] font-semibold ${
                          gap > 1 ? "bg-rose-400/80 text-black" : gap === 1 ? "bg-amber-400/80 text-black" : "bg-emerald-400/70 text-black"
                        }`}
                      >
                        {s.id.replace("S-", "")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title={rtl ? "ماتریس ارتباطات" : "Communication matrix"} note={rtl ? "ذی‌نفع بدون کانال، تناوب یا مالک یعنی برنامه ارتباطی ناقص" : "no channel, cadence or owner means an incomplete plan"}>
              <div className="thin-scroll max-h-80 overflow-auto">
                <table className="w-full text-[9.5px]">
                  <thead className="tx3">
                    <tr className="border-b b-line-soft">
                      <Th>#</Th>
                      <Th>{rtl ? "ذی‌نفع" : "Stakeholder"}</Th>
                      <Th>{rtl ? "راهبرد" : "Strategy"}</Th>
                      <Th>{rtl ? "فعلی → مطلوب" : "Current → Desired"}</Th>
                      <Th>{rtl ? "کانال" : "Channel"}</Th>
                      <Th>{rtl ? "تناوب" : "Cadence"}</Th>
                      <Th>{rtl ? "مالک" : "Owner"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_STAKEHOLDERS.map((s) => {
                      const q = powerInterestQuadrant(s);
                      const gap = engagementGap(s);
                      return (
                        <tr key={s.id} className="border-b b-line-soft/50">
                          <td className="px-2 py-1 font-mono tx4" dir="ltr">{s.id}</td>
                          <td className="px-2 py-1">
                            <div className="tx1">{s.name}</div>
                            <div className="text-[8px] tx4">{s.org} · {s.role}</div>
                          </td>
                          <td className="px-2 py-1">
                            <span className={`rounded px-1.5 py-[1px] text-[8px] ${QUADRANT_LABEL[q].tone}`}>{L(QUADRANT_LABEL[q])}</span>
                          </td>
                          <td className="px-2 py-1">
                            <span className="tx3">{L(ENGAGEMENT_LABEL[s.current])}</span>
                            <span className="tx4"> → </span>
                            <span className="tx1">{L(ENGAGEMENT_LABEL[s.desired])}</span>
                            {gap > 0 && <span className="ms-1 rounded bg-rose-400/15 px-1 py-[1px] text-[7.5px] text-rose-300" dir="ltr">+{gap}</span>}
                          </td>
                          <td className="px-2 py-1 tx3">{s.channel.length ? s.channel.join("، ") : <span className="text-rose-300">{rtl ? "تعریف نشده" : "undefined"}</span>}</td>
                          <td className="px-2 py-1 tx3">{s.frequency}</td>
                          <td className="px-2 py-1 tx2">{s.ownerRole || <span className="text-rose-300">{rtl ? "بدون مالک" : "unassigned"}</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {/* ═══ تب ۴: اطلاع‌رسانی ═══ */}
        {tab === "notifications" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "قواعد فعال" : "Active rules"} value={fmt(SAMPLE_RULES.filter((r) => r.active).length)} hint={`${fmt(SAMPLE_RULES.length)} ${rtl ? "کل" : "total"}`} />
              <Kpi label={rtl ? "رویداد نیازمند تشدید" : "Escalating now"} value={fmt(timeBarBreaches + overdueActions)} tone={timeBarBreaches + overdueActions ? "text-amber-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "شکاف توزیع جلسه ماهانه" : "Distribution gap"} value={fmt(distGap.length)} tone={distGap.length ? "text-amber-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "کانال‌های پیکربندی‌شده" : "Configured channels"} value={fmt(new Set(SAMPLE_RULES.flatMap((r) => r.channels)).size)} />
            </div>

            <Section title={rtl ? "قواعد اطلاع‌رسانی و تشدید" : "Notification & escalation rules"} note={rtl ? "سطح تشدید با گذشت زمان بی‌پاسخ بالا می‌رود" : "escalation level rises with unanswered elapsed time"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <Th>{rtl ? "رویداد" : "Event"}</Th>
                    <Th>{rtl ? "کانال" : "Channels"}</Th>
                    <Th>{rtl ? "مخاطب" : "Audience"}</Th>
                    <Th>{rtl ? "تشدید پس از" : "Escalate after"}</Th>
                    <Th>{rtl ? "تشدید به" : "Escalate to"}</Th>
                    <Th>{rtl ? "سطح در ۹۶ ساعت" : "Level @96h"}</Th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_RULES.map((r) => (
                    <tr key={r.id} className="border-b b-line-soft/50">
                      <td className="px-2 py-1 tx1">
                        {r.event}
                        {!r.active && <span className="ms-1 rounded bg-white/5 px-1 py-[1px] text-[7.5px] tx4">{rtl ? "غیرفعال" : "off"}</span>}
                      </td>
                      <td className="px-2 py-1 tx3" dir="ltr">{r.channels.join(" · ")}</td>
                      <td className="px-2 py-1 tx2">{r.audienceRoles.join("، ")}</td>
                      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{r.escalateAfterHours ? `${fmt(r.escalateAfterHours)}h` : "—"}</td>
                      <td className="px-2 py-1 tx2">{r.escalateToRole}</td>
                      <td className="px-2 py-1">
                        {(() => {
                          const lvl = escalationLevel(96, r);
                          return (
                            <span className={`rounded px-1.5 py-[1px] text-[8px] ${
                              lvl === 3 ? "bg-rose-400/15 text-rose-300" : lvl === 2 ? "bg-amber-400/15 text-amber-200" : lvl === 1 ? "bg-sky-400/15 text-sky-300" : "bg-white/5 tx4"
                            }`} dir="ltr">
                              L{lvl}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title={rtl ? "شکاف توزیع صورت‌جلسه ماهانه کارفرما" : "Distribution gap — monthly client meeting"} note={rtl ? "مخاطبان الزامی که پوشش داده نشده‌اند" : "required recipients not covered"}>
              {distGap.length === 0 ? (
                <p className="text-[9.5px] text-emerald-300">{rtl ? "همه مخاطبان الزامی پوشش داده شده‌اند." : "All required recipients covered."}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {distGap.map((d) => (
                    <span key={d} className="rounded-lg bg-amber-400/15 px-2 py-0.5 text-[8.5px] text-amber-200">{d}</span>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}

        {/* ═══ تب ۵: دانش و درس‌آموخته ═══ */}
        {tab === "knowledge" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "درس‌آموخته ثبت‌شده" : "Lessons captured"} value={fmt(lessons.length)} />
              <Kpi label={rtl ? "تأییدشده" : "Validated"} value={fmt(lessons.filter((l) => l.validated).length)} />
              <Kpi label={rtl ? "نرخ استفاده مجدد" : "Utilization"} value={`${utilization}%`} tone={utilization < 40 ? "text-amber-300" : "text-emerald-300"} hint={rtl ? "آستانه ۴۰٪" : "threshold 40%"} />
              <Kpi label={rtl ? "کل دفعات استفاده" : "Total reuse"} value={fmt(lessons.reduce((a, l) => a + l.reuseCount, 0))} />
            </div>

            <Section title={rtl ? "پوشش دانش بر حسب حوزه" : "Knowledge coverage by category"} note={rtl ? "ستون کوتاه یعنی حوزه کور سازمانی" : "a short bar marks an organizational blind spot"}>
              <div className="flex h-32 items-end gap-2">
                {coverageByCat.map((c) => (
                  <div key={c.category} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="flex h-24 w-full items-end justify-center">
                      <div
                        className={`w-full rounded-t ${c.count === 0 ? "bg-rose-400/30" : "bg-violet-400/60"}`}
                        style={{ height: `${Math.max(4, (c.count / maxCat) * 100)}%` }}
                      />
                    </div>
                    <span className="truncate text-[7.5px] tx4">{L(CATEGORY_LABEL[c.category])}</span>
                    <span className="text-[8px] tabular-nums tx3" dir="ltr">{fmt(c.count)}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title={rtl ? "بانک درس‌آموخته — مرتب‌شده بر پایه ارزش" : "Lessons register — ranked by value"}
              note={rtl ? "ارزش = اثر + تأیید + استفاده مجدد + منشأ" : "value = impact + validation + reuse + traceable source"}
            >
              <div className="space-y-2">
                {rankedLessons.map(({ l, v, issues }) => (
                  <div key={l.id} className="rounded-xl border b-line-soft bg-black/15 p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[8.5px] tx4" dir="ltr">{l.id}</span>
                      <span className="rounded bg-violet-400/15 px-1.5 py-[1px] text-[8px] text-violet-300">{L(CATEGORY_LABEL[l.category])}</span>
                      <span className={`rounded px-1.5 py-[1px] text-[8px] ${l.impact === "high" ? "bg-rose-400/15 text-rose-300" : l.impact === "medium" ? "bg-amber-400/15 text-amber-200" : "bg-white/5 tx3"}`}>
                        {l.impact === "high" ? (rtl ? "اثر بالا" : "High") : l.impact === "medium" ? (rtl ? "اثر متوسط" : "Medium") : rtl ? "اثر کم" : "Low"}
                      </span>
                      {l.validated ? (
                        <span className="rounded bg-emerald-400/15 px-1.5 py-[1px] text-[8px] text-emerald-300">{rtl ? "تأییدشده" : "Validated"}</span>
                      ) : (
                        <button onClick={() => validateLessonRow(l.id)} className="glass-row rounded px-1.5 py-[1px] text-[8px] tx2 transition hover:tx1">
                          {rtl ? "تأیید شورای دانش" : "Validate"}
                        </button>
                      )}
                      <span className="ms-auto flex items-center gap-1.5">
                        <span className="text-[8px] tx4" dir="ltr">{rtl ? "استفاده" : "reuse"} {fmt(l.reuseCount)}</span>
                        <span className="rounded-lg border b-line-soft px-1.5 py-[1px] text-[9px] font-semibold tabular-nums tx1" dir="ltr">{fmt(v)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 text-[10px] font-light tx1">{l.title}</div>
                    <div className="mt-1 text-[8.5px] font-extralight tx3">{l.situation}</div>
                    <div className="mt-1 rounded-lg bg-emerald-400/5 px-2 py-1 text-[9px] tx2">
                      <span className="text-emerald-300">{rtl ? "توصیه: " : "Recommendation: "}</span>{l.recommendation}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[7.5px] tx4" dir="ltr">← {l.sourceRef}</span>
                      {l.tags.map((tg) => (
                        <span key={tg} className="rounded bg-white/5 px-1.5 py-[1px] text-[7.5px] tx4">{tg}</span>
                      ))}
                      {issues.map((i, k) => (
                        <span key={k} className={`text-[7.5px] ${i.severity === "error" ? "text-rose-300" : "text-amber-200"}`}>
                          <span dir="ltr">{i.code}</span> {i.message}
                        </span>
                      ))}
                      <button onClick={() => reuseLesson(l.id)} className="glass-row ms-auto rounded-lg px-2 py-0.5 text-[8.5px] font-light tx2 transition hover:tx1">
                        {rtl ? "استفاده در پروژه جاری" : "Apply here"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ═══ تب ۶: تحلیل ═══ */}
        {tab === "analytics" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "میانگین زمان پاسخ" : "Avg response time"} value={`${avgResponse}`} hint={rtl ? "روز کاری · آستانه ۱۰" : "working days · threshold 10"} tone={avgResponse > 10 ? "text-amber-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "نرخ بستن مصوبات" : "Action closure"} value={`${Math.round((actions.filter((a) => actionState(a, TODAY) === "done").length / actions.length) * 100)}%`} />
              <Kpi label={rtl ? "پوشش برنامه ارتباطات" : "Comms coverage"} value={`${coverage}%`} />
              <Kpi label={rtl ? "نرخ استفاده از دانش" : "Knowledge utilization"} value={`${utilization}%`} tone={utilization < 40 ? "text-amber-300" : "text-emerald-300"} />
            </div>

            <Section title={rtl ? "توزیع مکاتبات بر حسب نوع و وضعیت مهلت" : "Correspondence by class and deadline status"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <Th>{rtl ? "نوع" : "Class"}</Th>
                    <Th>{rtl ? "تعداد" : "Count"}</Th>
                    <Th>{rtl ? "پاسخ‌داده" : "Answered"}</Th>
                    <Th>{rtl ? "از مهلت گذشته" : "Overdue"}</Th>
                    <Th>{rtl ? "نقض مهلت قراردادی" : "Time-bar breach"}</Th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(DEFAULT_RESPONSE_DAYS) as Letter["letterClass"][]).map((c) => {
                    const rows = letterRows.filter((r) => r.l.letterClass === c);
                    if (!rows.length) return null;
                    const breach = rows.filter((r) => r.due.timeBarBreached).length;
                    return (
                      <tr key={c} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 tx1">
                          {L(CLASS_LABEL[c])}
                          {isTimeBarred(c) && <span className="ms-1 text-[7.5px] text-rose-300">•</span>}
                        </td>
                        <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmt(rows.length)}</td>
                        <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{fmt(rows.filter((r) => r.l.respondedAt).length)}</td>
                        <td className={`px-2 py-1 tabular-nums ${rows.filter((r) => r.due.overdue).length ? "text-amber-300" : "tx3"}`} dir="ltr">
                          {fmt(rows.filter((r) => r.due.overdue).length)}
                        </td>
                        <td className={`px-2 py-1 tabular-nums ${breach ? "text-rose-300 font-semibold" : "tx3"}`} dir="ltr">{fmt(breach)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>

            <Section title={rtl ? "سلامت جلسات" : "Meeting health"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <Th>{rtl ? "جلسه" : "Meeting"}</Th>
                    <Th>{rtl ? "حضور" : "Attendance"}</Th>
                    <Th>{rtl ? "مصوبه" : "Actions"}</Th>
                    <Th>{rtl ? "نرخ بستن" : "Closure"}</Th>
                    <Th>{rtl ? "ایراد" : "Issues"}</Th>
                  </tr>
                </thead>
                <tbody>
                  {meetingRows.map(({ m, h }) => (
                    <tr key={m.id} className="border-b b-line-soft/50">
                      <td className="px-2 py-1 tx1">{m.title}</td>
                      <td className={`px-2 py-1 tabular-nums ${h.attendanceRate < 70 ? "text-amber-300" : "tx2"}`} dir="ltr">{h.attendanceRate}%</td>
                      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{fmt(h.actions)}</td>
                      <td className={`px-2 py-1 tabular-nums ${h.closureRate < 50 ? "text-rose-300" : "tx2"}`} dir="ltr">{h.closureRate}%</td>
                      <td className="px-2 py-1 text-[8.5px] tx3">{h.issues.length ? h.issues.join(" · ") : rtl ? "—" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title={rtl ? "مرزهای مالکیت داده" : "Data ownership boundaries"} note={rtl ? "این ماژول چه چیزی را می‌نویسد و چه چیزی را فقط می‌خواند" : "what this module writes versus reads"}>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-2.5">
                  <div className="text-[9px] font-semibold text-emerald-300">{rtl ? "مالک (می‌نویسد)" : "Owns (writes)"}</div>
                  <ul className="mt-1 space-y-0.5 text-[8.5px] font-light tx2">
                    <li>{rtl ? "دفتر مکاتبات و مهلت پاسخ" : "Correspondence register and response deadlines"}</li>
                    <li>{rtl ? "صورت‌جلسه و مصوبات" : "Minutes and action register"}</li>
                    <li>{rtl ? "ثبت ذی‌نفعان و برنامه ارتباطات" : "Stakeholder register and comms plan"}</li>
                    <li>{rtl ? "بانک درس‌آموخته و شمارنده استفاده مجدد" : "Lessons register and reuse counter"}</li>
                  </ul>
                </div>
                <div className="rounded-xl border b-line-soft bg-black/15 p-2.5">
                  <div className="text-[9px] font-semibold tx2">{rtl ? "فقط می‌خواند" : "Reads only"}</div>
                  <ul className="mt-1 space-y-0.5 text-[8.5px] font-light tx3">
                    <li>{rtl ? "فایل مدرک و نسخه‌ها ← مدیریت مستندات" : "Document files and revisions ← Document module"}</li>
                    <li>{rtl ? "ادعا، تغییر و ریسک ← ریسک و ادعا" : "Claims, changes and risks ← RCC module"}</li>
                    <li>{rtl ? "عدم انطباق ← کیفیت" : "Non-conformance ← Quality module"}</li>
                    <li>{rtl ? "ماتریس اختیار و سطوح تأیید ← حاکمیت" : "Authority matrix ← Governance module"}</li>
                    <li>{rtl ? "تقویم کاری پروژه ← برنامه‌ریزی" : "Project work calendar ← Planning module"}</li>
                  </ul>
                </div>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
