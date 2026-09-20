/**
 * Arena Platform — Unified RBAC & Security Engine (rbac-v1)
 * ---------------------------------------------------------------------------
 * موتور یکپارچهٔ کنترل دسترسی و امنیت.
 *
 * قید طراحی: این فایل کاملاً خالص است — هیچ ارجاعی به window، document،
 * localStorage یا fetch ندارد، تا مستقیم در Node تست شود و در سرور هم
 * قابل استفاده باشد. لایهٔ React فقط آن را مصرف می‌کند.
 *
 * می‌بندد: PEX-G4 · CKM-C06 · HRM-D14 · RPT R-06
 */

export const RBAC_ENGINE_VERSION = "rbac-v1";

export type Bi = { fa: string; en: string };
export type Lang = "fa" | "en";

/* ═══════════════════════════ ۱. طبقه‌بندی داده ═══════════════════════════ */

/** سطوح طبقه‌بندی، از باز به بسته. عدد بزرگ‌تر = محرمانه‌تر. */
export type Classification = "public" | "internal" | "confidential" | "restricted";

export const CLASSIFICATION_RANK: Record<Classification, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

export const CLASSIFICATION_LABEL: Record<Classification, Bi> = {
  public: { fa: "عمومی", en: "Public" },
  internal: { fa: "داخلی", en: "Internal" },
  confidential: { fa: "محرمانه", en: "Confidential" },
  restricted: { fa: "سری", en: "Restricted" },
};

/** آیا سطح دسترسی کاربر برای دیدن این طبقه‌بندی کافی است؟ */
export function meetsClearance(clearance: Classification, required: Classification): boolean {
  return CLASSIFICATION_RANK[clearance] >= CLASSIFICATION_RANK[required];
}

/* ═══════════════════════════ ۲. کاتالوگ مجوزها ═══════════════════════════ */

/**
 * قالب کد مجوز: `<domain>.<resource>.<action>`
 * domainها با ماژول‌های framework هم‌نام‌اند تا ردیابی ممیزی ساده بماند.
 */
export type PermissionDef = {
  code: string;
  module: string;            // d1..d11 یا "core"
  title: Bi;
  /** حداقل طبقه‌بندی‌ای که این مجوز به آن دست می‌زند */
  touches: Classification;
  /** آیا استفاده از آن باید حتماً در لاگ ممیزی ثبت شود */
  audited: boolean;
};

const P = (code: string, module: string, fa: string, en: string, touches: Classification = "internal", audited = false): PermissionDef =>
  ({ code, module, title: { fa, en }, touches, audited });

export const PERMISSION_CATALOG: PermissionDef[] = [
  /* ── هسته و سامانه ── */
  P("core.portfolio.view", "core", "مشاهده سبد پروژه", "View portfolio", "internal"),
  P("core.project.view", "core", "مشاهده پروژه", "View project", "internal"),
  P("core.project.edit", "core", "ویرایش مشخصات پروژه", "Edit project", "confidential", true),
  P("core.ai.run", "core", "اجرای دستیار هوشمند", "Run AI assistant", "internal"),
  /* صندوق خروجی رویداد (D13).
   *
   * دیدن صف تحویل «داخلی» است — هرکس که با یکپارچه‌سازی سروکار دارد
   * باید بفهمد چرا رقمش به سامانهٔ بیرونی نرسیده. ولی **تلاش دوبارهٔ
   * دستی** محرمانه است: هر تلاش یک نوشتن در سامانهٔ بیرونی است. */
  P("core.event.view", "core", "مشاهدهٔ صندوق رویداد", "View event outbox", "internal"),
  P("core.event.replay", "core", "تلاش دوبارهٔ تحویل رویداد", "Replay event delivery", "confidential", true),
  P("sys.config.manage", "d7", "پیکربندی سامانه", "Manage system config", "restricted", true),
  P("sys.user.manage", "d7", "مدیریت کاربران و نقش‌ها", "Manage users & roles", "restricted", true),
  P("sys.audit.view", "d7", "مشاهده لاگ ممیزی", "View audit log", "confidential", true),
  P("sys.audit.purge", "d7", "پاک‌سازی لاگ ممیزی", "Purge audit log", "restricted", true),
  P("sys.backup.export", "d7", "تهیه نسخه پشتیبان", "Export backup", "restricted", true),
  P("sys.backup.restore", "d7", "بازیابی نسخه پشتیبان", "Restore backup", "restricted", true),

  /* ── d1 اسناد و مدارک ── */
  P("doc.document.view", "d1", "مشاهده مدارک", "View documents", "internal"),
  P("doc.document.upload", "d1", "بارگذاری مدرک", "Upload document", "internal", true),
  P("doc.document.approve", "d1", "تأیید مدرک", "Approve document", "confidential", true),
  P("doc.transmittal.issue", "d1", "صدور ترانسمیتال", "Issue transmittal", "confidential", true),

  /* ── d2 برنامه‌ریزی و اجرا ── */
  P("plan.schedule.view", "d2", "مشاهده برنامه زمان‌بندی", "View schedule", "internal"),
  P("plan.schedule.edit", "d2", "ویرایش برنامه زمان‌بندی", "Edit schedule", "confidential", true),
  P("plan.baseline.set", "d2", "تثبیت برنامه مبنا", "Set baseline", "confidential", true),
  P("plan.progress.report", "d2", "ثبت پیشرفت اجرا", "Report progress", "internal"),
  P("plan.progress.approve", "d2", "تأیید پیشرفت اجرا", "Approve progress", "confidential", true),

  /* ── d3 پایش و کنترل ── */
  P("pex.dashboard.view", "d3", "مشاهده داشبورد عملکرد", "View performance dashboard", "internal"),
  P("pex.evm.view", "d3", "مشاهده ارزش کسب‌شده", "View earned value", "confidential"),
  P("pex.kpi.edit", "d3", "ویرایش شاخص‌ها", "Edit KPIs", "confidential", true),
  P("pex.forecast.edit", "d3", "ویرایش پیش‌بینی", "Edit forecast", "confidential", true),

  /* ── d4 ریسک، تغییر و ادعا ── */
  P("rcc.risk.view", "d4", "مشاهده ریسک", "View risks", "internal"),
  P("rcc.risk.edit", "d4", "ویرایش ریسک", "Edit risks", "confidential"),
  P("rcc.change.raise", "d4", "ثبت درخواست تغییر", "Raise change request", "confidential", true),
  P("rcc.change.approve", "d4", "تصویب تغییر در CCB", "Approve change (CCB)", "restricted", true),
  P("rcc.claim.view", "d4", "مشاهده ادعا", "View claims", "confidential"),
  P("rcc.claim.edit", "d4", "تنظیم ادعا", "Draft claim", "restricted", true),
  P("rcc.claim.submit", "d4", "ارسال رسمی ادعا", "Submit claim", "restricted", true),

  /* ── d12 مهندسی و طراحی ──
   * تفکیک بر پایهٔ اقتدار واقعی: ثبت مدرک، صدور ریویژن، پاسخ به نظر و
   * تأیید کارفرما چهار اقتدار جدا هستند. کد بررسی ۱ تا ۴ را فقط کارفرما و
   * مشاور می‌دهند، و همان کسی که مدرک را صادر می‌کند نباید کدش را بزند. */
  P("eng.mdr.view", "d12", "مشاهده فهرست مدارک", "View document register", "internal"),
  P("eng.mdr.edit", "d12", "ثبت و ویرایش مدرک", "Edit document register", "confidential", true),
  P("eng.revision.issue", "d12", "صدور ریویژن مدرک", "Issue revision", "confidential", true),
  P("eng.review.code", "d12", "ثبت کد بررسی ۱ تا ۴", "Assign review code", "confidential", true),
  P("eng.crs.comment", "d12", "ثبت نظر در شیت بررسی", "Raise CRS comment", "internal"),
  P("eng.crs.resolve", "d12", "بستن و تأیید پاسخ نظر", "Resolve CRS comment", "confidential", true),
  P("eng.tq.raise", "d12", "ثبت استعلام و تغییر کارگاهی", "Raise TQ/FCR", "internal"),
  P("eng.tq.answer", "d12", "پاسخ به استعلام فنی", "Answer technical query", "confidential", true),
  P("eng.vpr.review", "d12", "بررسی مدارک سازندگان", "Review vendor prints", "confidential", true),
  P("eng.ifc.release", "d12", "آزادسازی ساخت با صدور IFC", "Release construction via IFC", "restricted", true),
  P("eng.mr.raise", "d12", "صدور درخواست کالای مهندسی", "Raise material request", "confidential", true),
  P("eng.mr.approve", "d12", "تأیید درخواست کالا و تبدیل به خرید", "Approve MR and convert to PR", "restricted", true),

  /* ── d14 پیمان و صورت‌وضعیت ──
   * تفکیک بر پایهٔ اقتدار مالی: نگهداری شناسنامهٔ پیمان، ویرایش فهرست بها و
   * ثبت ریزمتره سه اقتدار جداست. ریزمتره را کسی می‌زند که در کارگاه است،
   * ولی نرخ را کسی تغییر می‌دهد که به پیمان دسترسی دارد — وگرنه هر سرکارگر
   * می‌توانست مبلغ صورت‌وضعیت را بالا ببرد. دور زدن دروازهٔ کیفی مجوز
   * جداگانه است تا در ممیزی مشخص باشد چه کسی آن را باز کرده. */
  P("cnt.contract.view", "d14", "مشاهده شناسنامه پیمان", "View contract master", "confidential"),
  P("cnt.contract.edit", "d14", "ثبت و ویرایش پیمان و الحاقیه", "Edit contract and amendments", "restricted", true),
  P("cnt.boq.edit", "d14", "ویرایش فهرست بها و نرخ ردیف", "Edit BOQ and unit rates", "restricted", true),
  /* ریزمتره فقط مقدار فیزیکی است و هیچ نرخی نشان نمی‌دهد، پس طبقه‌بندی
   * «داخلی» کافی است — وگرنه سرپرست کارگاه که کار را متره می‌کند نمی‌توانست
   * آن را ثبت کند و متره به گلوگاه دفتر مرکزی می‌افتاد. */
  P("cnt.measurement.record", "d14", "ثبت ریزمتره کارکرد", "Record measurement sheet", "internal", true),
  P("cnt.ipc.override", "d14", "دور زدن دروازه کیفی صورت‌وضعیت", "Override IPC quality gate", "restricted", true),
  /* گردش صورت‌وضعیت عمداً به سه مجوز جدا شکسته شد، نه یک «cnt.ipc.edit».
   * تهیهٔ صورت‌وضعیت کار پیمانکار و دفتر فنی است، تأیید مشاور و تأیید
   * کارفرما دو تصمیم مستقل‌اند. اگر یک مجوز باشد، هر کسی که بتواند
   * صورت‌وضعیت بسازد می‌تواند خودش هم تأییدش کند و کل کنترل سه‌طرفه
   * بی‌معنا می‌شود. تفکیک وظیفه در `SOD_RULES` تضمین می‌شود. */
  P("cnt.ipc.prepare", "d14", "تهیه و ویرایش صورت‌وضعیت", "Prepare interim payment certificate", "confidential", true),
  P("cnt.ipc.review", "d14", "بررسی و تأیید مشاور", "Consultant review of IPC", "confidential", true),
  P("cnt.ipc.approve", "d14", "تصویب نهایی صورت‌وضعیت", "Employer approval of IPC", "restricted", true),
  /* سپرده جدا از صورت‌وضعیت مجوز دارد چون آزادسازی‌اش رویداد مالی
   * مستقلی است که ماه‌ها پس از آخرین صورت‌وضعیت رخ می‌دهد. */
  P("cnt.retainage.manage", "d14", "مدیریت و آزادسازی سپرده", "Manage retainage ledger", "restricted", true),
  /* دیدن دفتر ضمانت‌نامه از تغییرش جداست: کنترل پروژه باید بداند چه
   * وثیقه‌ای نزدیک انقضاست تا تمدیدش را پیگیری کند، بی‌آنکه بتواند
   * آزاد یا ضبطش کند. */
  P("cnt.guarantee.view", "d14", "مشاهدهٔ دفتر ضمانت‌نامه", "View guarantee register", "internal", false),
  P("cnt.guarantee.manage", "d14", "ثبت و تمدید ضمانت‌نامه", "Record and extend guarantee", "restricted", true),
  /* آزادسازی و ضبط از ثبت جدا شده‌اند: این دو نقطه‌ای‌اند که وثیقه
   * از دست می‌رود یا وصول می‌شود، و هر دو تصمیم کارفرماست نه
   * کارشناس پیمان. */
  P("cnt.guarantee.release", "d14", "آزادسازی یا ضبط ضمانت‌نامه", "Release or forfeit guarantee", "confidential", true),
  P("cnt.advance.manage", "d14", "ثبت و بازیافت پیش‌پرداخت", "Manage advance payment", "restricted", true),
  /* صورت‌وضعیت پیمانکار جزء: تهیه از تأیید جدا می‌شود، دقیقاً مثل
   * صورت‌وضعیت اصلی. اینجا حساس‌تر هم هست چون تأییدکننده دارد پول
   * پیمانکار اصلی را خرج می‌کند. */
  P("cnt.subipc.view", "d14", "مشاهدهٔ صورت‌وضعیت پیمانکار جزء", "View subcontractor IPC", "internal", false),
  P("cnt.subipc.prepare", "d14", "تهیهٔ صورت‌وضعیت پیمانکار جزء", "Prepare subcontractor IPC", "restricted", true),
  P("cnt.subipc.approve", "d14", "تأیید صورت‌وضعیت پیمانکار جزء", "Approve subcontractor IPC", "confidential", true),
  /* ثبت کسر پشت‌به‌پشت مجوز جدا دارد: کسی که کار جزء را تحویل
   * می‌گیرد نباید بتواند خودش مبلغ کسر را تعیین کند. */
  P("cnt.backtoback.manage", "d14", "ثبت کسر پشت‌به‌پشت", "Record back-to-back deduction", "restricted", true),
  /* پیشرفت پیمان خواندنی است و باید برای ناظر و کارفرما هم باز باشد:
   * درصد پیشرفت چیزی نیست که پنهان کردنش به کسی کمک کند. */
  P("cnt.progress.view", "d14", "مشاهدهٔ پیشرفت پیمان", "View contract progress", "internal", false),
  /* ثبت نقطهٔ عطف و تأییدش اما نوشتنی است و مستقیم روی درصد پیشرفت
   * پیمان مقطوع اثر می‌گذارد، یعنی روی پول. */
  P("cnt.milestone.manage", "d14", "ثبت و تأیید نقطهٔ عطف", "Manage lump-sum milestones", "restricted", true),
  /* تابلوی سلامت پیمان: همان مخاطبان پیشرفت. عددی که مدیر پروژه
   * می‌بیند نباید با عددی که کارفرما می‌بیند فرق کند. */
  P("cnt.kpi.view", "d14", "مشاهدهٔ سنجه و هشدار پیمان", "View contract KPIs and alerts", "internal", false),
  /* دیدن سنجه با ثبت‌کردنش یکی نیست: عکس دوره‌ای مبنای تحلیل روند است
   * و چون upsert روی همان دورهٔ قبلی می‌نشیند، ثبت دوباره یعنی
   * بازنویسی تاریخچه. طرف بیرونی — مشاور و کارفرما — تابلو را
   * می‌بیند ولی حافظهٔ آن را نمی‌نویسد. */
  P("cnt.kpi.snapshot", "d14", "ثبت عکس دوره‌ای سنجه‌ها", "Record contract KPI snapshot", "internal", false),
  /* تنظیم آستانهٔ هشدار اما نوشتنی و حساس است: کسی که می‌تواند
   * آستانه را جابه‌جا کند، می‌تواند هشدار را خاموش کند. */
  P("cnt.alertrule.manage", "d14", "تنظیم آستانهٔ هشدار پیمان", "Configure contract alert thresholds", "restricted", true),
  /* پل مالی (G-03). دیدن تطبیق دو دفتر با انجام ارسال یکی نیست:
   * اولی کنترل است و باید مخاطب گسترده داشته باشد، دومی دفتر مالی
   * پروژه را تغییر می‌دهد. */
  P("cnt.fin.view", "d14", "مشاهدهٔ تطبیق پیمان با مالی", "View contract-finance reconciliation", "internal", false),
  /* ارسال صورت‌وضعیت به حساب هزینه — تنها جای ماژول پیمان که عدد را
   * در دفتر مالی می‌نشاند. تهیه‌کنندهٔ صورت‌وضعیت نباید همان کسی باشد
   * که آن را در دفتر می‌نشاند (SOD-15). */
  P("cnt.fin.post", "d14", "ارسال صورت‌وضعیت به مالی", "Post contract IPC to finance", "restricted", true),
  /* گزارش‌های پیمان. تفکیک «دیدن» از «صدور رسمی» عمدی است: نسخهٔ
   * داخلی ابزار کار است، ولی نسخهٔ رسمی سندی است که ممکن است پیوست
   * نامهٔ اداری یا مدرک دعوا شود و امضای سازمان پای آن می‌رود. */
  P("cnt.report.view", "d14", "مشاهدهٔ گزارش‌های پیمان", "View contract reports", "internal", false),
  P("cnt.report.issue", "d14", "صدور نسخهٔ رسمی گزارش پیمان", "Issue official contract report", "restricted", true),

  /* ── d15 راه‌اندازی و تحویل نهایی ── */
  P("com.punch.record", "d15", "ثبت و بستن نقص فهرست تحویل", "Record punch list item", "internal", true),
  P("com.certificate.view", "d15", "مشاهده گواهی تحویل", "View completion certificate", "internal"),
  /* صدور گواهی تحویل تصمیم کارفرماست و ضمانت‌نامه و سپرده را آزاد
   * می‌کند؛ پس در سطح «سری» و جدا از ثبت نواقص. */
  P("com.certificate.issue", "d15", "صدور گواهی تحویل موقت و قطعی", "Issue completion certificate", "restricted", true),
  /* تفکیک سیستمی ساختار پروژه را تعیین می‌کند و مبنای همهٔ دروازه‌های
   * تحویل است؛ ویرایشش از مشاهده‌اش جدا نگه داشته می‌شود. */
  P("com.system.view", "d15", "مشاهده درخت سیستم‌ها و برنامه تحویل", "View systemization tree", "internal"),
  P("com.system.edit", "d15", "تعریف و ویرایش تفکیک سیستمی و مرزبندی", "Edit systemization and boundaries", "confidential", true),
  /* تاریخ هدف دروازه تعهد زمانی به کارفرماست و مبنای محاسبهٔ لغزش و ادعا؛
   * پس در سطح بالاتر از ویرایش ساختار. */
  P("com.milestone.manage", "d15", "تعیین تاریخ هدف دروازه‌های تحویل", "Manage gate milestone targets", "confidential", true),
  /* ثبت نتیجهٔ آزمون کار میدانی است و باید در دسترس تیم اجرا باشد، وگرنه
   * ثبت به گلوگاه دفتر مرکزی می‌افتد و برگه‌ها با تأخیر وارد می‌شوند. */
  P("com.checksheet.record", "d15", "ثبت برگه و نتیجه آزمون", "Record check sheet results", "internal", true),
  /* امضای برگه از ثبت نتیجه جدا نگه داشته می‌شود چون تعهد کیفی است و
   * پیش‌نیاز تکمیل مکانیکی. ولی طبقه‌بندی‌اش «داخلی» است هم‌تراز
   * `qms.inspection.record`: بازرس کیفی که در میدان امضا می‌کند سطح
   * داخلی دارد و اگر این مجوز محرمانه باشد، امضا به دفتر مرکزی می‌افتد
   * و برگه‌ها روی زمین می‌مانند. تفکیک واقعی با خودِ مجوز انجام می‌شود
   * نه با بالا بردن طبقه‌بندی. */
  P("com.checksheet.sign", "d15", "امضای برگه و تأیید بسته آزمون", "Sign check sheet and clear pack", "internal", true),

  /* ── d16 بهداشت، ایمنی و محیط زیست ── */
  P("hse.permit.view", "d16", "مشاهده پروانه کار", "View work permits", "internal"),
  /* درخواست پروانه کار میدانی است و باید در دسترس تیم اجرا باشد. */
  P("hse.permit.request", "d16", "درخواست پروانه کار", "Request work permit", "internal", true),
  /* تأیید از درخواست جدا است: مجری کار نباید مجوز ایمنی همان کار را صادر
   * کند. طبقه‌بندی «داخلی» هم‌تراز com.checksheet.sign چون افسر ایمنی در
   * میدان کار می‌کند؛ محرمانه‌کردن آن صدور پروانه را به دفتر مرکزی می‌برد
   * و کار روی زمین می‌ماند. تفکیک واقعی با خودِ مجوز است نه با طبقه‌بندی. */
  P("hse.permit.approve", "d16", "تأیید و بستن پروانه کار", "Approve and close work permit", "internal", true),
  P("hse.jsa.view", "d16", "مشاهده ارزیابی ریسک شغلی", "View job safety analysis", "internal"),
  P("hse.jsa.edit", "d16", "تدوین ارزیابی ریسک شغلی", "Prepare job safety analysis", "internal", true),
  /* تصویب ارزیابی ریسک تعهد فنی است و از تدوین جدا نگه داشته می‌شود. */
  P("hse.jsa.approve", "d16", "تصویب ارزیابی ریسک شغلی", "Approve job safety analysis", "confidential", true),
  P("hse.incident.record", "d16", "ثبت رویداد ایمنی", "Record safety incident", "internal", true),
  /* بستن رویداد نیازمند پذیرش ریشه‌یابی است و از ثبت جدا است. */
  P("hse.incident.close", "d16", "بستن رویداد ایمنی", "Close safety incident", "confidential", true),
  P("hse.inspection.record", "d16", "ثبت بازرسی و آموزش ایمنی", "Record safety inspection and training", "internal", true),
  /* گازسنجی و ایزولاسیون میدانی‌اند و باید در دسترس تیم اجرا باشند؛
   * درستی‌شان با اسکیما و موتور تضمین می‌شود نه با محدودکردن ثبت. */
  P("hse.permit.gastest", "d16", "ثبت گازسنجی", "Record gas test", "internal", true),
  P("hse.permit.isolation", "d16", "ثبت و برداشتن ایزولاسیون", "Record and remove isolation", "internal", true),
  /* امضا از تأیید نهایی جداست: سه سطح امضا می‌کنند، صدور یک اقدام است. */
  P("hse.permit.sign", "d16", "امضای پروانه کار", "Sign work permit", "internal", true),
  /* تعلیق و ازسرگیری اقدام کنترلی است و ردپای مستقل می‌خواهد. */
  P("hse.permit.suspend", "d16", "تعلیق و ازسرگیری پروانه", "Suspend and resume permit", "internal", true),
  /* تحقیق حادثه داده‌های حساس فردی و مبنای ادعای بیمه دارد. */
  P("hse.investigation.manage", "d16", "مدیریت تحقیق حادثه", "Manage incident investigation", "confidential", true),
  /* تأیید تحقیق از انجامش جداست — تفکیک وظیفه در موتور هم اعمال می‌شود. */
  P("hse.investigation.approve", "d16", "تأیید تحقیق حادثه", "Approve incident investigation", "confidential", true),
  P("hse.capa.manage", "d16", "مدیریت اقدام اصلاحی و پیشگیرانه", "Manage CAPA actions", "internal", true),
  /* راستی‌آزمایی اثربخشی باید به‌دست کسی جز مجری باشد. */
  P("hse.capa.verify", "d16", "راستی‌آزمایی اقدام اصلاحی", "Verify CAPA effectiveness", "confidential", true),
  P("hse.manhour.record", "d16", "ثبت نفرساعت ایمنی", "Record HSE man-hours", "internal", true),
  P("hse.inspection.conduct", "d16", "انجام بازرسی ایمنی", "Conduct HSE inspection", "internal", true),
  P("hse.finding.close", "d16", "بستن یافتهٔ بازرسی", "Close inspection finding", "internal", true),
  /* خواندن از صدور جدا شد: نقش آزادکننده (تضمین کیفیت) و مدیر پروژه
   * باید فهرست تخلفات و دستورهای توقف کار را ببینند بدون آنکه اختیار
   * صدور بگیرند. پیش از این، تنها دارندهٔ مجوز آزادسازی حتی نمی‌توانست
   * تخلفی را که قرار بود آزاد کند فهرست کند. */
  P("hse.violation.view", "d16", "مشاهدهٔ تخلف و توقف کار", "View violations and stop-work", "internal", true),
  /* صدور تخلف اهرم اجرایی است؛ اثر مالی (جریمه) و قراردادی دارد. */
  P("hse.violation.issue", "d16", "صدور تخلف ایمنی", "Issue HSE violation", "internal", true),
  /* توقف کار جدی‌ترین اختیار ماژول: کار را از حرکت می‌اندازد. */
  P("hse.violation.stopwork", "d16", "صدور دستور توقف کار", "Issue stop-work order", "confidential", true),
  /* آزادسازی باید نزد نقشی باشد که خودش تخلف را صادر نکرده است. */
  P("hse.violation.release", "d16", "آزادسازی تخلف و رفع توقف کار", "Release violation and lift stop-work", "confidential", true),
  /* ── d16 آموزش، بهداشت شغلی و محیط‌زیست (زیرماژول ۰۸٫۵) ── */
  P("hse.training.manage", "d16", "مدیریت جلسات آموزش ایمنی", "Manage HSE training sessions", "internal", true),
  P("hse.training.view", "d16", "مشاهدهٔ سوابق آموزش", "View training records", "internal"),
  P("hse.ppe.issue", "d16", "تحویل تجهیزات حفاظت فردی", "Issue PPE", "internal", true),
  /* خواندن از نوشتن جدا شد: سرپرست کارگاه باید بداند تیمش هارنس
   * دارد یا نه، بی‌آنکه بتواند تحویل ثبت کند. */
  P("hse.ppe.view", "d16", "مشاهدهٔ موجودی و تحویل تجهیزات", "View PPE issuances", "internal"),
  /* دادهٔ پزشکی محرمانه است: نتیجهٔ معاینه فراتر از «مجاز/غیرمجاز»
   * نباید در دسترس سرپرست اجرایی باشد. */
  P("hse.health.record", "d16", "ثبت معاینهٔ طب کار", "Record occupational health exam", "restricted", true),
  P("hse.health.view", "d16", "مشاهدهٔ وضعیت سلامت شغلی", "View occupational fitness", "confidential"),
  /* دروازهٔ ورود فقط نتیجهٔ سه‌گانه را می‌دهد نه جزئیات پزشکی، پس
   * سطحش پایین‌تر از خواندن پرونده است. */
  P("hse.clearance.check", "d16", "استعلام مجوز ورود فرد به کارگاه", "Check person site clearance", "internal"),
  P("hse.waste.record", "d16", "ثبت سیاههٔ پسماند", "Record waste log", "internal", true),
  P("hse.env.record", "d16", "ثبت پایش زیست‌محیطی", "Record environmental monitoring", "internal", true),
  P("hse.env.view", "d16", "مشاهدهٔ گزارش زیست‌محیطی", "View environmental report", "internal"),
  /* ── d16 شاخص، نمره و هشدار زودهنگام (زیرماژول ۰۸٫۶) ── */
  P("hse.metrics.view", "d16", "مشاهدهٔ شاخص و نمرهٔ ایمنی", "View HSE metrics and score", "internal"),
  /* انتشار عکس شاخص، عدد را برای دوره تثبیت می‌کند و مبنای گزارش به
   * کارفرما می‌شود؛ پس فقط دست نقشی که پاسخ‌گوی آن گزارش است. */
  P("hse.metrics.publish", "d16", "انتشار عکس شاخص دوره", "Publish period metric snapshot", "confidential", true),
  P("hse.alert.configure", "d16", "پیکربندی و سکوت قواعد هشدار", "Configure and mute alert rules", "confidential", true),

  /* ── d5 مالی و هزینه ── */
  P("fin.cost.view", "d5", "مشاهده هزینه", "View cost", "confidential"),
  P("fin.budget.edit", "d5", "ویرایش بودجه", "Edit budget", "restricted", true),
  P("fin.ipc.prepare", "d5", "تهیه صورت‌وضعیت", "Prepare payment certificate", "confidential", true),
  P("fin.ipc.approve", "d5", "تأیید صورت‌وضعیت", "Approve payment certificate", "restricted", true),
  P("fin.rate.view", "d5", "مشاهده نرخ و قیمت واحد", "View unit rates", "restricted"),
  P("fin.invoice.issue", "d5", "صدور فاکتور", "Issue invoice", "restricted", true),

  /* ── d6 حاکمیت ── */
  P("gov.process.view", "d6", "مشاهده فرآیندها", "View processes", "internal"),
  P("gov.gate.review", "d6", "بازبینی دروازه مرحله", "Review stage gate", "confidential", true),
  P("gov.gate.approve", "d6", "تصویب دروازه مرحله", "Approve stage gate", "restricted", true),
  P("gov.owner.assign", "d6", "انتصاب مالک داده", "Assign data owner", "confidential", true),

  /* ── d8 کیفیت ── */
  P("qms.itp.view", "d8", "مشاهده ITP", "View ITP", "internal"),
  P("qms.inspection.record", "d8", "ثبت نتیجه بازرسی", "Record inspection", "internal", true),
  P("qms.ncr.raise", "d8", "صدور عدم انطباق", "Raise NCR", "confidential", true),
  P("qms.ncr.close", "d8", "بستن عدم انطباق", "Close NCR", "confidential", true),
  P("qms.audit.conduct", "d8", "اجرای ممیزی کیفیت", "Conduct quality audit", "confidential", true),

  /* ── d10 منابع انسانی ── */
  P("hrm.roster.view", "d10", "مشاهده فهرست نیرو", "View workforce roster", "internal"),
  P("hrm.timesheet.enter", "d10", "ثبت تایم‌شیت", "Enter timesheet", "internal"),
  P("hrm.timesheet.approve", "d10", "تأیید تایم‌شیت", "Approve timesheet", "confidential", true),
  P("hrm.rate.view", "d10", "مشاهده نرخ دستمزد", "View labour rates", "restricted"),
  P("hrm.personal.view", "d10", "مشاهده اطلاعات فردی", "View personal data", "restricted", true),
  P("hrm.productivity.view", "d10", "مشاهده بهره‌وری", "View productivity", "confidential"),
  /* زنجیرهٔ تأیید کارکرد (D4). سه گیت جدا تعریف شده‌اند چون سه دست
   * متفاوت امضا می‌کنند: سرپرست حضور را می‌بیند، کیفیت پیشرفت را
   * تطبیق می‌دهد، مدیر پروژه عدد را وارد بهره‌وری و هزینه می‌کند.
   * `hrm.timesheet.approve` میراثی باقی می‌ماند و معنای «تأیید کلی»
   * دارد؛ SOD-04 روی آن سوار است. */
  P("hrm.timesheet.sign", "d10", "امضای سرپرست بر کارکرد", "Foreman sign timesheet", "internal", true),
  P("hrm.timesheet.verify", "d10", "تأیید کیفیت کارکرد", "QC verify timesheet", "internal", true),
  P("hrm.timesheet.finalize", "d10", "نهایی‌سازی کارکرد توسط مدیر پروژه", "PM finalize timesheet", "confidential", true),
  /* بستن دوره برگشت‌ناپذیر است و از تأیید تک‌برگه جداست. */
  P("hrm.period.lock", "d10", "بستن و بازگشایی دورهٔ کارکرد", "Lock timesheet period", "confidential", true),
  P("hrm.adjustment.raise", "d10", "ثبت سند اصلاحی کارکرد", "Raise timesheet adjustment", "internal", true),
  P("hrm.adjustment.approve", "d10", "تأیید سند اصلاحی کارکرد", "Approve timesheet adjustment", "confidential", true),
  P("hrm.conflict.resolve", "d10", "حل تعارض همگام‌سازی", "Resolve sync conflict", "internal", true),
  /* پایش ناوگان دستگاه‌های میدانی (D9).
   *
   * مجوز جدا از `conflict.resolve` است چون کار متفاوتی است: آن یکی
   * تعارضِ رسیده را حل می‌کند، این یکی می‌بیند کدام دستگاه اصلاً
   * چیزی نفرستاده. دادهٔ نرسیده خطرناک‌تر از دادهٔ متعارض است —
   * تعارض دست‌کم دیده می‌شود.
   *
   * «داخلی» است چون سرپرست کارگاه باید ببیند گوشیِ کدام اکیپ عقب
   * مانده؛ این اطلاعات عملیاتی است نه محرمانه. */
  P("hrm.device.monitor", "d10", "پایش دستگاه‌های میدانی", "Monitor field devices", "internal"),
  /* تعریف کارت نرخ ساعتی (D12).
   *
   * `hrm.rate.view` از قبل در خط ۳۱۳ تعریف شده؛ اینجا فقط نوشتن
   * اضافه می‌شود. تفکیک دیدن از نوشتن لازم است چون نرخ، ضریب مستقیم
   * مبلغی است که به دفتر مالی می‌رود. */
  P("hrm.rate.manage", "d10", "تعریف و بازنگری کارت نرخ", "Manage hourly rate card", "restricted", true),
  P("hrm.cost.post", "d10", "ارسال هزینهٔ کارکرد به مالی", "Post labour cost to finance", "restricted", true),
  /* بهره‌وری و ریشه‌یابی (D5).
   *
   * «محاسبه» از «مشاهده» جدا شده چون اجرای دوبارهٔ محاسبه عدد
   * منتشرشدهٔ دوره را جابه‌جا می‌کند؛ این یک عمل نوشتنی است حتی
   * وقتی هیچ فرمی پر نمی‌شود. */
  P("hrm.productivity.compute", "d10", "اجرای محاسبهٔ بهره‌وری", "Run productivity computation", "internal", true),
  P("hrm.rca.record", "d10", "ثبت علت افت بهره‌وری", "Record productivity root cause", "internal", true),
  /* تبدیل علت به ادعا اثر قراردادی و مالی دارد، پس سطح سری و دست
   * مدیر پیمان است — نه دست کسی که علت را در کارگاه ثبت کرده. */
  P("hrm.claim.link", "d10", "پیوند علت افت به ادعا", "Link root cause to claim", "restricted", true),
  P("hrm.metric.finalize", "d10", "نهایی‌سازی متریک دوره", "Finalize period metrics", "confidential", true),
  /* اکیپ و نیروی پیمانکاری (D6).
   *
   * دیدن اکیپ از ساختن آن جدا است چون تابلوی نرخ استفاده را همه
   * می‌بینند ولی ترکیب اکیپ را فقط کسی می‌چیند که پای کار است. */
  P("hrm.crew.view", "d10", "مشاهده اکیپ و نرخ استفاده", "View crews and utilisation", "internal"),
  P("hrm.crew.manage", "d10", "ترکیب اکیپ و عضویت", "Manage crew composition", "internal", true),
  /* انحلال اکیپ برگشت‌ناپذیر است و سابقهٔ کارکرد را از تخصیص جاری
   * جدا می‌کند؛ همان جنس اقتدار قفل دوره، پس یک پله بالاتر از ترکیب. */
  P("hrm.crew.disband", "d10", "انحلال اکیپ", "Disband crew", "confidential", true),
  /* قرارداد نیروی پیمانکاری دو چهره دارد: چهرهٔ کارگاهی (چند نفر
   * امروز آمدند) و چهرهٔ تجاری (نرخ توافقی هر رسته). این دو با دو
   * سطح دسترسی متفاوت جدا شده‌اند تا سرپرست کارگاه بتواند حضور را
   * ثبت کند بی‌آنکه نرخ قرارداد را ببیند. */
  P("hrm.sub.view", "d10", "مشاهده قرارداد نیروی پیمانکاری", "View labour subcontract", "confidential"),
  P("hrm.sub.manage", "d10", "ثبت و ویرایش قرارداد نیروی پیمانکاری", "Manage labour subcontract", "restricted", true),
  P("hrm.sub.record", "d10", "ثبت حضور گروهی پیمانکاری", "Record subcontractor attendance", "internal", true),
  P("hrm.sub.verify", "d10", "تأیید حضور گروهی پیمانکاری", "Verify subcontractor attendance", "internal", true),
  P("hrm.subipc.prepare", "d10", "تهیهٔ صورت‌کارکرد نیروی پیمانکاری", "Prepare labour IPC", "confidential", true),
  P("hrm.subipc.approve", "d10", "تأیید صورت‌کارکرد نیروی پیمانکاری", "Approve labour IPC", "restricted", true),
  /* پذیرش، احکام و انطباق (D7).
   *
   * «مشاهدهٔ پرونده» از «مشاهدهٔ اطلاعات فردی» جدا است: سرپرست کارگاه
   * باید بداند نفرش مدرک معتبر دارد یا نه، بی‌آنکه کد ملی و شمارهٔ
   * تماس او را ببیند — آن پشت `hrm.personal.view` سری می‌ماند. */
  P("hrm.person.view", "d10", "مشاهدهٔ پروندهٔ پرسنلی", "View personnel file", "internal"),
  P("hrm.person.manage", "d10", "ثبت و ویرایش پروندهٔ پرسنلی", "Manage personnel file", "confidential", true),
  /* فعال کردن نفر یعنی «حق ثبت ساعت»؛ این تنها دروازه‌ای است که
   * تصمیم می‌گیرد چه کسی وارد چرخهٔ هزینه می‌شود. */
  P("hrm.person.activate", "d10", "فعال‌سازی نفر پس از گیت‌ها", "Activate person after gates", "confidential", true),
  P("hrm.person.demobilize", "d10", "تخلیه و قطع همکاری نیرو", "Demobilize person", "confidential", true),
  /* بارگذاری مدرک از تأیید صحت آن جدا است: کارگاه اسکن می‌فرستد،
   * منابع انسانی اصالت را تأیید می‌کند — SOD-24. */
  P("hrm.doc.upload", "d10", "بارگذاری مدرک پرسنلی", "Upload personnel document", "internal", true),
  P("hrm.doc.verify", "d10", "تأیید اصالت مدرک پرسنلی", "Verify personnel document", "confidential", true),
  P("hrm.skill.assess", "d10", "ارزیابی مهارت و صلاحیت", "Assess skills", "internal", true),
  P("hrm.mob.request", "d10", "ثبت درخواست تجهیز نیرو", "Raise mobilization request", "internal", true),
  P("hrm.mob.approve", "d10", "تأیید درخواست تجهیز نیرو", "Approve mobilization request", "confidential", true),
  /* تحلیل و گزارش (D8).
   *
   * سه مجوز و نه بیشتر: افزودن مجوز به ازای هر نمودار کاتالوگ را باد
   * می‌کرد بی‌آنکه مرز تازه‌ای بسازد. مرزهای واقعی اینجا سه‌تاست.
   *
   * مشاهده «داخلی» است چون تصمیم تخصیص نیرو در کارگاه گرفته می‌شود و
   * سرپرست باید هیستوگرام رستهٔ خودش را ببیند. صدور نسخهٔ رسمی ولی
   * «محرمانه» است: سندی که با سربرگ بیرون می‌رود مبنای مطالبه است.
   *
   * ثبت مبنا مجوز جداست چون تنها نوشتنِ این لایه است و خطرناک‌ترین
   * کار ممکن: هرکس بتواند مبنا را عوض کند، می‌تواند انحراف دیروز را
   * محو کند. اینکه «فقط یک عدد برنامه است» فریبنده است. */
  P("hrm.analytics.view", "d10", "مشاهدهٔ تحلیل و هیستوگرام نیرو", "View workforce analytics", "internal"),
  P("hrm.analytics.export", "d10", "صدور گزارش رسمی نیرو", "Export official workforce report", "confidential", true),
  P("hrm.plan.baseline", "d10", "ثبت و بازنگری برنامهٔ مبنای نیرو", "Set manpower baseline plan", "confidential", true),
  P("hrm.rate.calibrate", "d10", "کالیبراسیون نرخ استاندارد", "Calibrate standard rates", "confidential", true),

  /* ── d11 ارتباطات و دانش ── */
  P("ckm.letter.view", "d11", "مشاهده مکاتبات", "View correspondence", "confidential"),
  P("ckm.letter.draft", "d11", "تنظیم پیش‌نویس نامه", "Draft letter", "confidential"),
  P("ckm.letter.sign", "d11", "امضا و صدور نامه", "Sign & issue letter", "restricted", true),
  P("ckm.meeting.record", "d11", "ثبت صورت‌جلسه", "Record meeting minutes", "internal"),
  P("ckm.lesson.publish", "d11", "انتشار درس آموخته", "Publish lesson learned", "internal"),

  /* ── گزارش‌ساز ── */
  P("report.internal.generate", "core", "تولید گزارش داخلی", "Generate internal report", "internal"),
  P("report.official.publish", "core", "انتشار گزارش ابلاغی", "Publish official report", "restricted", true),
  P("report.export.bulk", "core", "خروجی انبوه داده", "Bulk data export", "restricted", true),
];

export const PERMISSION_CODES: string[] = PERMISSION_CATALOG.map((p) => p.code);

const PERM_BY_CODE = new Map(PERMISSION_CATALOG.map((p) => [p.code, p]));

export function permissionDef(code: string): PermissionDef | undefined {
  return PERM_BY_CODE.get(code);
}

export function permissionsOfModule(module: string): PermissionDef[] {
  return PERMISSION_CATALOG.filter((p) => p.module === module);
}

/* ═══════════════════════════ ۳. کاتالوگ نقش‌ها ═══════════════════════════ */

export type RoleDef = {
  code: string;
  title: Bi;
  /** نقش‌هایی که مجوزهایشان به ارث می‌رسد */
  inherits: string[];
  /** مجوزهای مستقیم این نقش */
  grants: string[];
  /** حداکثر طبقه‌بندی‌ای که این نقش می‌تواند ببیند */
  clearance: Classification;
  /** طرف قرارداد — برای جداسازی داده پیمانکار از کارفرما */
  party: "contractor" | "client" | "consultant" | "subcontractor" | "any";
};

export const ROLE_CATALOG: RoleDef[] = [
  {
    code: "viewer",
    title: { fa: "بیننده", en: "Viewer" },
    inherits: [],
    clearance: "internal",
    party: "any",
    grants: ["core.portfolio.view", "core.project.view", "doc.document.view", "plan.schedule.view", "pex.dashboard.view", "gov.process.view", "report.internal.generate", "eng.mdr.view"],
  },
  {
    code: "site_engineer",
    title: { fa: "مهندس/سرپرست کارگاه", en: "Site Engineer" },
    inherits: ["viewer"],
    clearance: "internal",
    party: "contractor",
    grants: ["cnt.measurement.record", "com.punch.record", "com.checksheet.record", "plan.progress.report", "doc.document.upload", "qms.itp.view", "qms.inspection.record", "hrm.roster.view", "hrm.timesheet.enter", "hrm.conflict.resolve", "ckm.meeting.record", "eng.tq.raise", "eng.crs.comment", "hse.permit.view", "hse.permit.request", "hse.jsa.view", "hse.jsa.edit", "hse.incident.record", "hse.permit.gastest", "hse.permit.isolation", "hse.permit.sign", "hse.capa.manage", "hse.manhour.record", "hse.finding.close",
      /* سرپرست کارگاه مسئول رفع تخلف و بستن یافته است؛ بدون مجوز
       * خواندن، تنها راه اطلاعش از توقف کارِ خودش کاغذ بود. خواندن
       * اختیار صدور یا آزادسازی نمی‌دهد. */
      "hse.violation.view",
      /* او تصمیم می‌گیرد چه کسی وارد جبههٔ کاری شود، پس باید بتواند
       * دروازه را استعلام کند. نتیجه سه‌گانه است، نه پروندهٔ پزشکی. */
      "hse.clearance.check", "hse.training.view", "hse.ppe.view", "hse.metrics.view",
      /* علت افت را کسی می‌داند که آن روز پای کار بوده. ثبت علت سطح
       * «داخلی» است تا سرپرست کارگاه بتواند بنویسد؛ تبدیلش به ادعا
       * سطح سری می‌خواهد و دست او نیست — SOD-20. */
      "hrm.rca.record",
      /* اکیپ را کسی می‌چیند که هر روز صبح جلوی نیروها می‌ایستد. ثبت
       * حضور گروهی پیمانکار هم کار اوست، ولی تأیید آن نه — SOD-21. */
      "hrm.crew.view", "hrm.crew.manage", "hrm.sub.record",
      /* سرپرست باید بداند نفرش مدرک معتبر دارد یا نه — بدون دیدن کد
       * ملی. اسکن مدرک را او می‌فرستد ولی اصالتش را تأیید نمی‌کند
       * (SOD-24)، و مهارت را ارزیابی می‌کند چون کار او را دیده. */
      "hrm.person.view", "hrm.doc.upload", "hrm.skill.assess", "hrm.mob.request",
      /* گوشی اکیپ خودش را می‌بیند؛ بدون آن نمی‌فهمد چرا برگه‌هایش
       * در سامانه نیست. */
      "hrm.device.monitor",
      /* تصمیم تخصیص نیرو در کارگاه گرفته می‌شود؛ بدون دیدن هیستوگرام
       * رستهٔ خودش، آن تصمیم کور است. */
      "hrm.analytics.view"],
  },
  {
    code: "planner",
    title: { fa: "کارشناس برنامه‌ریزی", en: "Planner" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: ["plan.schedule.edit", "plan.progress.report", "pex.evm.view", "pex.forecast.edit", "rcc.risk.view", "core.ai.run",
      /* بهره‌وری کار روزمرهٔ برنامه‌ریز است: او بودجهٔ نفر-ساعت را
       * بسته و باید بداند مصرف واقعی کجا از آن جدا شد. محاسبه با
       * اوست، ولی نهایی‌سازی نه — SOD-19. */
      "hrm.productivity.view", "hrm.productivity.compute", "hrm.rate.calibrate", "hrm.rca.record",
      /* نرخ استفادهٔ اکیپ ورودی مستقیم برنامه‌ریزی منابع است؛ دیدن
       * کافی است، چیدن اکیپ کار کارگاه است. */
      "hrm.crew.view",
      /* کسری نیرو در برنامهٔ او دیده می‌شود، پس درخواست تجهیز هم از
       * همان‌جا زده می‌شود؛ تأییدش نه. */
      "hrm.mob.request",
      /* هیستوگرام و منحنی S ابزار اصلی برنامه‌ریز است، و مبنای نیرو
       * محصول کار خود اوست. */
      "hrm.analytics.view", "hrm.plan.baseline", "hrm.device.monitor"],
  },
  {
    code: "cost_controller",
    title: { fa: "کنترل هزینه", en: "Cost Controller" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: ["cnt.contract.view", "cnt.ipc.prepare", "fin.cost.view", "fin.ipc.prepare", "fin.invoice.issue", "fin.rate.view", "pex.evm.view", "hrm.productivity.view", "core.ai.run",
      /* هزینهٔ نیروی پیمانکاری بخشی از هزینهٔ مستقیم پروژه است و
       * کنترل هزینه باید مبنای آن را ببیند؛ ثبت و تأیید دست او نیست. */
      "hrm.crew.view", "hrm.sub.view", "hrm.analytics.view",
      /* کنترل هزینه مغایرت دو دفتر را می‌بیند — این دقیقاً کار اوست.
       * ولی ارسال نمی‌کند چون تهیه‌کنندهٔ صورت‌وضعیت مالی است. */
      "cnt.fin.view",
      /* شکاف میان دفتر داخلی و سامانهٔ بیرونی را می‌بیند؛ تلاش دوباره
       * دست او نیست چون هر تلاش یک نوشتن در سامانهٔ بیرونی است. */
      "core.event.view"],
  },
  {
    code: "qc_inspector",
    title: { fa: "بازرس کیفیت", en: "QC Inspector" },
    inherits: ["viewer"],
    clearance: "internal",
    party: "any",
    grants: ["qms.itp.view", "qms.inspection.record", "qms.ncr.raise", "com.checksheet.record", "com.checksheet.sign",
      /* گیت کیفیت در زنجیرهٔ کارکرد: تطبیق ساعت ثبت‌شده با پیشرفت
       * تأییدشده. بدون این، ساعت روی فعالیتی می‌نشیند که اصلاً اجرا
       * نشده است. */
      "hrm.timesheet.verify"],
  },
  {
    code: "qa_manager",
    title: { fa: "مدیر تضمین کیفیت", en: "QA Manager" },
    // عمداً از qc_inspector ارث نمی‌برد: صدور و بستن عدم انطباق باید جدا بماند (SOD-02).
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "qms.itp.view", "qms.ncr.close", "qms.audit.conduct", "gov.gate.review", "doc.document.approve",
      /* تأیید تحقیق حادثه عمداً به مدیر تضمین کیفیت داده می‌شود نه افسر
       * ایمنی: افسر ایمنی خودش سرپرست تحقیق است و موتور تأیید توسط
       * سرپرست را رد می‌کند. بدون این گرنت هیچ تحقیقی تأیید نمی‌شد. */
      "hse.investigation.approve", "hse.capa.verify",
      /* آزادسازی تخلف عمداً از افسر ایمنی جدا شد: موتور صادرکننده را از
       * آزادسازی منع می‌کند و افسر ایمنی معمولاً خودش صادرکننده است. */
      "hse.violation.release", "hse.inspection.conduct", "hse.violation.view",
    ],
  },
  {
    code: "hr_manager",
    title: { fa: "مدیر منابع انسانی", en: "HR Manager" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: ["hrm.roster.view", "hrm.timesheet.approve", "hrm.rate.view", "hrm.personal.view", "hrm.productivity.view",
      "hrm.timesheet.sign", "hrm.adjustment.raise", "hrm.conflict.resolve",
      /* ارسال هزینهٔ کارکرد به مالی سطح دسترسی «محرمانه‌تر» می‌خواهد
       * چون نرخ دستمزد را لمس می‌کند؛ کنترل هزینه آن سطح را ندارد و
       * مدیر پروژه به‌خاطر SOD-17 نمی‌تواند. */

      /* گیت hseTraining از سوابق آموزش HSE خوانده می‌شود، پس مدیر
       * منابع انسانی باید بتواند بخواند — ولی نه بنویسد: منبع حقیقت
       * یکی است و آن ماژول ایمنی است. */
      "hse.training.view", "hse.clearance.check",
      /* پروندهٔ طب کار سطح «سری» دارد و این نقش تنها نقش سطح سری با
       * مسئولیت سلامت نیروی انسانی است. */
      "hse.health.record", "hse.health.view",
      /* اکیپ واحد پایهٔ سازمان نیروی انسانی است؛ چیدن، جابه‌جایی و
       * انحلال آن کار مدیر منابع انسانی است. */
      "hrm.crew.view", "hrm.crew.manage", "hrm.crew.disband",
      /* تأیید حضور گروهی پیمانکار دروازهٔ ورود ساعت به صورت‌کارکرد
       * است؛ ثبت‌کننده در کارگاه است و تأییدکننده اینجا — SOD-21. */
      "hrm.sub.view", "hrm.sub.verify", "hrm.analytics.view", "hrm.analytics.export", "hrm.device.monitor",
      /* نرخ را تعریف می‌کند (کار قراردادی-پرسنلی اوست) ولی ارسال
       * هزینه را نه — SOD-28. */
      "hrm.rate.view", "hrm.rate.manage",
      /* پروندهٔ پرسنلی خانهٔ اصلی این نقش است: ثبت، تأیید اصالت مدرک،
       * فعال‌سازی پس از گیت‌ها و تخلیه. */
      "hrm.person.view", "hrm.person.manage", "hrm.person.activate",
      "hrm.person.demobilize", "hrm.doc.verify", "hrm.skill.assess",],
  },
  {
    code: "doc_controller",
    title: { fa: "کنترل مدارک", en: "Document Controller" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: ["doc.document.upload", "doc.transmittal.issue", "ckm.letter.view", "ckm.letter.draft", "ckm.meeting.record", "ckm.lesson.publish", "eng.mdr.edit", "eng.revision.issue"],
  },
  {
    code: "contracts_manager",
    title: { fa: "مدیر پیمان و ادعا", en: "Contracts Manager" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: [
      "rcc.claim.view", "rcc.claim.edit", "rcc.change.raise",
      "fin.cost.view", "fin.rate.view", "ckm.letter.view", "ckm.letter.draft",
      "cnt.contract.view", "cnt.contract.edit", "cnt.boq.edit", "cnt.ipc.prepare",
      "cnt.retainage.manage", "com.certificate.view",
      /* ثبت و تمدید ضمانت‌نامه کار روزمرهٔ مدیر پیمان است، ولی
       * آزادسازی و ضبط عمداً به او داده نشده: کسی که سند را ثبت
       * می‌کند نباید بتواند خودش وثیقه را برگرداند. */
      "cnt.guarantee.view", "cnt.guarantee.manage", "cnt.advance.manage",
      /* تهیه با مدیر پیمان، تأیید با مدیر پروژه — SOD-14. */
      "cnt.subipc.view", "cnt.subipc.prepare", "cnt.backtoback.manage",
      "cnt.progress.view", "cnt.milestone.manage", "cnt.kpi.view", "cnt.kpi.snapshot",
      /* مدیر پیمان گزارش را می‌سازد؛ صدور رسمی امضای بالاتر می‌خواهد. */
      "cnt.report.view",
      /* مدیر پیمان تطبیق را می‌بیند تا بداند چه چیزی ارسال نشده، ولی
       * خودش ارسال نمی‌کند: او تهیه‌کنندهٔ صورت‌وضعیت است. */
      "cnt.fin.view",
      /* پروندهٔ ادعا اینجا ساخته می‌شود، پس پیوند علت افت بهره‌وری به
       * ادعا هم باید همین‌جا باشد؛ همراهش دیدن بهره‌وری لازم است
       * وگرنه ادعای بی‌عدد نوشته می‌شود. */
      "hrm.productivity.view", "hrm.claim.link",
      /* قرارداد نیروی پیمانکاری از جنس پیمان است نه از جنس استخدام:
       * نرخ توافقی، حسن انجام کار و جریمه اینجا بسته می‌شود. تهیهٔ
       * صورت‌کارکرد هم با اوست، ولی تأیید نه — SOD-22 و SOD-23. */
      "hrm.sub.view", "hrm.sub.manage", "hrm.subipc.prepare",
    ],
  },
  {
    code: "project_manager",
    title: { fa: "مدیر پروژه", en: "Project Manager" },
    // عمداً از نقش‌های «تهیه‌کننده» ارث نمی‌برد؛ اقتدار مدیر پروژه تأیید است نه ثبت داده.
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: [
      "core.project.edit", "core.ai.run",
      "plan.baseline.set", "plan.progress.approve",
      "pex.evm.view", "pex.kpi.edit", "pex.forecast.edit",
      "rcc.risk.view", "rcc.risk.edit", "rcc.change.raise", "rcc.claim.view", "rcc.claim.submit",
      "fin.cost.view", "fin.rate.view", "fin.ipc.approve",
      "qms.itp.view", "qms.ncr.close",
      "hrm.roster.view", "hrm.timesheet.approve", "hrm.productivity.view",
      /* مدیر پروژه عدد را نهایی می‌کند و دوره را می‌بندد، ولی ارسال به
       * دفتر مالی دست کنترل هزینه است: سازندهٔ عدد نباید ثبت‌کنندهٔ
       * آن در دفتر باشد. */
      "hrm.timesheet.finalize", "hrm.period.lock", "hrm.adjustment.approve",
      /* قفل کردن عدد بهره‌وری دوره همان جنس اقتدار قفل دوره است:
       * برگشت‌ناپذیر و مبنای گزارش رسمی به کارفرما. */
      "hrm.metric.finalize",
      /* تأیید صورت‌کارکرد نیروی پیمانکاری همان الگوی SOD-14 است:
       * تأییدکننده دارد نقدینگی پروژه را خرج می‌کند و باید پاسخ‌گو
       * باشد. انحلال اکیپ هم اثر برنامه‌ای دارد، پس دست اوست. */
      "hrm.crew.view", "hrm.crew.disband", "hrm.sub.view", "hrm.subipc.approve",
      /* تجهیز نیرو یعنی تعهد بودجهٔ نفر-ساعت دوره؛ تأییدش با کسی است
       * که پاسخ‌گوی هزینهٔ پروژه است، نه با درخواست‌دهنده (SOD-25). */
      /* گزارش رسمی را امضا می‌کند ولی مبنا را نمی‌نویسد — SOD-27.
       * ثبت مبنا کار برنامه‌ریزی است و او تأییدکنندهٔ نتیجه. */
      "hrm.person.view", "hrm.mob.approve", "hrm.analytics.view", "hrm.analytics.export",
      /* سطح سوم امضای پروانهٔ کار «مدیر منطقه» است؛ در ساختار فعلی
       * مدیر پروژه این نقش را دارد. بدون این گرنت هیچ‌کس نمی‌تواند
       * زنجیرهٔ امضا را کامل کند و هیچ پروانه‌ای صادر نمی‌شود. */
      "hse.permit.view", "hse.permit.sign", "hse.jsa.view",
      /* دستور توقف کار برنامهٔ زمانی مدیر پروژه را می‌شکند و مبنای ادعای
       * تمدید است؛ او باید آن را ببیند، هرچند نه صادر و نه آزاد کند. */
      "hse.violation.view", "hse.incident.record",
      /* تعهد زیست‌محیطی و آموزش، الزام قراردادی کارفرماست. */
      "hse.env.view", "hse.training.view",
      /* تأیید صورت‌وضعیت پیمانکار جزء با مدیر پروژه است نه مدیر
       * پیمان (SOD-14): تأییدکننده دارد نقدینگی پیمانکار اصلی را خرج
       * می‌کند و همان کسی باید باشد که پاسخ‌گوی آن است. */
      "cnt.subipc.view", "cnt.subipc.approve", "cnt.progress.view",
      /* تنظیم آستانه با مدیر پروژه است نه مدیر پیمان: مدیر پیمان
       * سنجه‌شونده است و نباید بتواند معیار سنجش خودش را بازتعریف
       * کند. */
      "cnt.kpi.view", "cnt.kpi.snapshot", "cnt.alertrule.manage",
      /* ارسال به مالی با مدیر پروژه است نه مدیر پیمان — SOD-15. */
      "cnt.fin.view", "cnt.fin.post",
      "cnt.report.view", "cnt.report.issue",
      /* نمرهٔ ایمنی وارد شاخص سلامت پروژه می‌شود و مدیر پروژه پاسخ‌گوی
       * آن گزارش است، پس انتشار دوره با اوست. */
      "hse.metrics.view", "hse.metrics.publish",
      "doc.document.approve", "doc.transmittal.issue",
      "ckm.letter.view", "ckm.letter.draft", "ckm.letter.sign",
      "gov.gate.review", "report.official.publish",
      "eng.ifc.release", "eng.mr.approve", "eng.tq.answer",
      /* مدیر پروژه متره ثبت می‌کند چون کلید دور زدن دروازهٔ کیفی دست
       * اوست و باید بتواند همان‌جا ثبت را تمام کند؛ ولی عمداً
       * `cnt.boq.edit` ندارد تا نرخ را نتواند تغییر دهد. */
      "cnt.contract.view", "cnt.measurement.record", "cnt.ipc.override",
      "com.punch.record", "com.certificate.view", "com.system.view", "com.milestone.manage",
    ],
  },
  {
    /* افسر ایمنی پروانه را تأیید و می‌بندد و ارزیابی ریسک را تصویب می‌کند،
     * ولی درخواست‌دهنده یا تدوین‌کنندهٔ آنها نیست؛ تفکیک وظیفه علاوه بر
     * این ماتریس، در خودِ موتور هم اعمال می‌شود (canApprovePermit و
     * canApproveJsa تصویب‌کنندهٔ برابر با تهیه‌کننده را رد می‌کنند). */
    code: "hse_officer",
    title: { fa: "افسر ایمنی و بهداشت", en: "HSE Officer" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "hse.permit.view", "hse.permit.request", "hse.permit.approve",
      "hse.jsa.view", "hse.jsa.edit", "hse.jsa.approve",
      "hse.incident.record", "hse.incident.close", "hse.inspection.record",
      "hse.permit.gastest", "hse.permit.isolation", "hse.permit.sign", "hse.permit.suspend",
      "hse.investigation.manage", "hse.capa.manage", "hse.capa.verify", "hse.manhour.record",
      "hse.inspection.conduct", "hse.finding.close", "hse.violation.view",
      "hse.violation.issue", "hse.violation.stopwork",
      /* آموزش، تجهیزات و محیط‌زیست کار روزمرهٔ افسر ایمنی است. ثبت
       * پروندهٔ پزشکی عمداً نیست: آن کار پزشک طب کار است و سطح «سری»
       * دارد؛ افسر ایمنی فقط نتیجهٔ سه‌گانهٔ دروازه را می‌بیند. */
      "hse.training.manage", "hse.training.view", "hse.ppe.issue",
      "hse.clearance.check", "hse.waste.record", "hse.env.record", "hse.env.view",
      "hse.ppe.view",
      /* افسر ایمنی هشدارها را تنظیم می‌کند چون او پاسخ‌گوی آن‌هاست،
       * ولی انتشار عکس دوره دست او نیست: کسی که عدد را می‌سازد نباید
       * همان کسی باشد که آن را برای کارفرما نهایی می‌کند. */
      "hse.metrics.view", "hse.alert.configure",
      "hse.health.view",
      "com.system.view", "hrm.roster.view",
    ],
  },
  {
    /* مدیر راه‌اندازی صاحب ساختار سیستمی و مجری آزمون‌هاست، ولی عمداً
     * `com.certificate.issue` ندارد: صدور گواهی تصمیم کارفرماست و کسی که
     * آزمون را اجرا می‌کند نباید قبولی خودش را هم تأیید کند. */
    code: "commissioning_manager",
    title: { fa: "مدیر راه‌اندازی و تحویل", en: "Commissioning Manager" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "com.system.view", "com.system.edit", "com.milestone.manage",
      "com.checksheet.record", "com.checksheet.sign",
      "com.punch.record", "com.certificate.view",
      /* دروازهٔ آمادگی راه‌اندازی پروانهٔ باز را می‌سنجد، پس مدیر راه‌اندازی
       * باید پروانه‌ها را ببیند — ولی تأییدشان با افسر ایمنی است. */
      "hse.permit.view",
      "qms.itp.view", "qms.inspection.record",
      "doc.document.upload", "plan.progress.report",
    ],
  },
  {
    code: "engineering_manager",
    title: { fa: "مدیر مهندسی و طراحی", en: "Engineering Manager" },
    /* عمداً از doc_controller ارث نمی‌برد: مدیر مهندسی صادرکنندهٔ ریویژن
     * نیست بلکه تأییدکنندهٔ آزادسازی ساخت است (SOD-08). */
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "eng.mdr.view", "eng.mdr.edit", "eng.review.code", "eng.crs.resolve",
      "eng.tq.answer", "eng.vpr.review", "eng.ifc.release", "eng.mr.approve",
      "doc.document.approve", "core.ai.run", "report.internal.generate",
    ],
  },
  {
    code: "design_lead",
    title: { fa: "سرپرست دیسیپلین طراحی", en: "Design Discipline Lead" },
    /* ثبت و صدور می‌کند ولی کد بررسی نمی‌زند و نظر خودش را نمی‌بندد.
     * سطح «محرمانه» لازم است چون ثبت مدرک و صدور درخواست کالا هر دو در
     * این طبقه‌بندی‌اند؛ با سطح «داخلی» نقش عملاً بی‌اثر می‌شد. */
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "eng.mdr.view", "eng.mdr.edit", "eng.revision.issue",
      "eng.crs.comment", "eng.tq.raise", "eng.mr.raise",
      "doc.document.upload", "core.ai.run",
    ],
  },
  {
    code: "pmo",
    title: { fa: "دفتر مدیریت پروژه", en: "PMO" },
    inherits: ["planner"],
    clearance: "restricted",
    party: "contractor",
    grants: ["gov.process.view", "gov.gate.review", "gov.owner.assign", "pex.kpi.edit", "rcc.risk.edit", "fin.cost.view", "report.official.publish", "report.export.bulk", "sys.audit.view",
      /* ارسال هزینهٔ نیرو به دفتر مالی.
       *
       * نه مدیر منابع انسانی (نرخ را او تعریف می‌کند — SOD-28) و نه
       * مدیر پروژه (کارکرد را او نهایی می‌کند — SOD-17). PMO تنها
       * نقشی است که هیچ‌کدام از دو سرِ زنجیره را در دست ندارد. */
      "hrm.cost.post",
      /* PMO ارسال را می‌زند، پس باید ببیند به مقصد رسیده یا نه و
       * بتواند دوباره تلاش کند (D13). */
      "core.event.view", "core.event.replay"]
  },
  {
    code: "executive",
    title: { fa: "مدیر ارشد", en: "Executive" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: ["fin.cost.view", "fin.budget.edit", "pex.evm.view", "rcc.change.approve", "gov.gate.approve", "rcc.claim.view", "core.ai.run"],
  },
  {
    code: "consultant",
    title: { fa: "مشاور / نظارت", en: "Consultant" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "consultant",
    grants: ["doc.document.approve", "plan.progress.approve", "qms.itp.view", "qms.inspection.record", "qms.ncr.raise", "fin.ipc.prepare", "cnt.contract.view", "cnt.ipc.review", "cnt.guarantee.view", "cnt.progress.view", "cnt.kpi.view", "cnt.report.view",
      "com.punch.record", "com.certificate.view", "ckm.letter.view", "ckm.letter.draft", "gov.gate.review", "eng.mdr.view", "eng.review.code", "eng.crs.resolve", "eng.vpr.review"],
  },
  {
    code: "client",
    title: { fa: "کارفرما", en: "Client" },
    inherits: ["viewer"],
    // سطح «سری»: نمایندهٔ کارفرما صورت‌وضعیت را تأیید و نامهٔ رسمی را امضا می‌کند.
    // جداسازی دادهٔ پیمانکار از کارفرما محور جداگانه‌ای است (party) نه سطح دسترسی.
    clearance: "restricted",
    party: "client",
    grants: ["fin.cost.view", "fin.ipc.approve", "cnt.contract.view", "cnt.ipc.approve",
      /* آزادسازی و ضبط وثیقه تصمیم کارفرماست: پول از جیب او رفته و
       * برگشتنش هم به تشخیص او. */
      "cnt.guarantee.view", "cnt.guarantee.release", "cnt.progress.view", "cnt.kpi.view",
      "cnt.report.view",
      "com.certificate.view", "com.certificate.issue", "pex.evm.view", "rcc.change.approve", "gov.gate.approve", "ckm.letter.view", "ckm.letter.sign", "doc.document.approve", "eng.review.code", "eng.crs.resolve", "eng.tq.answer"],
  },
  {
    code: "subcontractor",
    title: { fa: "پیمانکار جزء", en: "Subcontractor" },
    inherits: [],
    clearance: "internal",
    party: "subcontractor",
    grants: ["core.project.view", "plan.schedule.view", "plan.progress.report", "doc.document.view", "hrm.timesheet.enter", "qms.itp.view"],
  },
  {
    code: "auditor",
    title: { fa: "ممیز داخلی", en: "Internal Auditor" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "any",
    grants: ["sys.audit.view", "qms.audit.conduct", "fin.cost.view", "fin.rate.view", "rcc.claim.view", "ckm.letter.view", "hrm.productivity.view"],
  },
  {
    code: "admin",
    title: { fa: "مدیر سامانه", en: "System Admin" },
    inherits: [],
    clearance: "restricted",
    party: "contractor",
    // sys.audit.view عمداً داده نشده: مدیر سامانه نباید ممیزِ کارِ خودش باشد (SOD-06).
    //
    // core.ai.run داده شده چون همین نقش سرویس هوش مصنوعی را پیکربندی
    // می‌کند؛ بدون آن، مدیر سامانه کلید را وارد می‌کرد ولی خودش اجازهٔ
    // آزمودنش را نداشت و پنل دانش پروژه برایش قفل می‌ماند.
    grants: ["sys.config.manage", "sys.user.manage", "sys.audit.purge", "sys.backup.export", "sys.backup.restore", "report.export.bulk", "core.portfolio.view", "core.project.view", "core.ai.run"],
  },
];

const ROLE_BY_CODE = new Map(ROLE_CATALOG.map((r) => [r.code, r]));

export function roleDef(code: string): RoleDef | undefined {
  return ROLE_BY_CODE.get(code);
}

export function roleTitle(code: string, lang: Lang = "fa"): string {
  const r = ROLE_BY_CODE.get(code);
  if (!r) return code;
  return lang === "fa" ? r.title.fa : r.title.en;
}

/**
 * مجوزهای مؤثر یک نقش با پیمایش وراثت.
 * حلقهٔ وراثت باعث بی‌نهایت نمی‌شود چون نقش‌های دیده‌شده علامت می‌خورند.
 */
export function effectivePermissions(roleCode: string, seen = new Set<string>()): string[] {
  const role = ROLE_BY_CODE.get(roleCode);
  if (!role || seen.has(roleCode)) return [];
  seen.add(roleCode);
  const out = new Set<string>(role.grants);
  for (const parent of role.inherits) {
    for (const p of effectivePermissions(parent, seen)) out.add(p);
  }
  return [...out].sort();
}

/** بالاترین سطح دسترسی میان چند نقش. */
export function combinedClearance(roleCodes: string[]): Classification {
  let best: Classification = "public";
  for (const rc of roleCodes) {
    const r = ROLE_BY_CODE.get(rc);
    if (r && CLASSIFICATION_RANK[r.clearance] > CLASSIFICATION_RANK[best]) best = r.clearance;
  }
  return best;
}

/** آیا زنجیرهٔ وراثت نقش‌ها حلقه دارد؟ (برای اعتبارسنجی کاتالوگ) */
export function hasInheritanceCycle(): string[] {
  const bad: string[] = [];
  for (const role of ROLE_CATALOG) {
    const stack = [...role.inherits];
    const seen = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === role.code) { bad.push(role.code); break; }
      if (seen.has(cur)) continue;
      seen.add(cur);
      const r = ROLE_BY_CODE.get(cur);
      if (r) stack.push(...r.inherits);
    }
  }
  return bad;
}

/* ═══════════════════ ۴. تفکیک وظایف (Segregation of Duties) ═══════════════════ */

export type SodRule = {
  id: string;
  a: string;
  b: string;
  severity: "high" | "critical";
  reason: Bi;
};

/**
 * جفت مجوزهایی که نباید هم‌زمان به یک نفر داده شود.
 * منطق: «تهیه‌کننده نباید تأییدکننده باشد» و «صادرکنندهٔ ایراد نباید بستن آن را امضا کند».
 */
export const SOD_RULES: SodRule[] = [
  {
    id: "SOD-01",
    a: "fin.ipc.prepare",
    b: "fin.ipc.approve",
    severity: "critical",
    reason: { fa: "تهیه و تأیید صورت‌وضعیت نباید بر عهدهٔ یک نفر باشد", en: "Preparing and approving a payment certificate must be separated" },
  },
  {
    id: "SOD-11",
    a: "cnt.ipc.prepare",
    b: "cnt.ipc.approve",
    severity: "critical",
    reason: {
      fa: "تهیه‌کنندهٔ صورت‌وضعیت پیمان نباید تصویب‌کنندهٔ نهایی آن باشد",
      en: "The preparer of a contract IPC must not be its final approver",
    },
  },
  {
    id: "SOD-14",
    a: "cnt.subipc.prepare",
    b: "cnt.subipc.approve",
    severity: "critical",
    reason: {
      fa: "تهیه‌کنندهٔ صورت‌وضعیت پیمانکار جزء نباید تأییدکنندهٔ آن باشد",
      en: "The preparer of a subcontractor IPC must not approve it",
    },
  },
  {
    id: "SOD-15",
    a: "cnt.ipc.prepare",
    b: "cnt.fin.post",
    severity: "critical",
    reason: {
      fa: "تهیه‌کنندهٔ صورت‌وضعیت نباید همان کسی باشد که آن را در دفتر مالی می‌نشاند",
      en: "The IPC preparer must not be the one posting it to the finance ledger",
    },
  },
  {
    /* SOD-04 قبلاً ثبت و تأیید کلی را جدا کرده بود؛ این قاعده همان
     * اصل را روی گیت سرپرست می‌آورد، چون ثبت‌کننده و سرپرست اغلب در
     * یک اتاق‌اند و وسوسهٔ «خودم ثبت کردم، خودم امضا می‌کنم» واقعی است. */
    id: "SOD-16",
    a: "hrm.timesheet.enter",
    b: "hrm.timesheet.sign",
    severity: "high",
    reason: {
      fa: "ثبت‌کنندهٔ کارکرد نباید امضای سرپرستی همان برگه را بدهد",
      en: "The timesheet enterer must not sign it as foreman",
    },
  },
  {
    /* نرخ ساعتی، ضریب مستقیم مبلغی است که به دفتر مالی می‌رود.
     *
     * اگر یک نفر هم نرخ را تعریف کند و هم هزینه را بفرستد، می‌تواند
     * نرخ را بالا ببرد و همان لحظه ارسال کند — بی‌آنکه هیچ ساعتی جعل
     * شده باشد و بی‌آنکه هیچ عددی غلط به نظر برسد. تنها ردی که
     * می‌ماند یک کارت نرخ تازه است که کسی دلیلی برای بازبینی‌اش
     * ندارد.
     *
     * این همان الگوی SOD-27 است: سازندهٔ مبنا نباید مصرف‌کنندهٔ
     * رسمی همان مبنا باشد. */
    id: "SOD-28",
    a: "hrm.rate.manage",
    b: "hrm.cost.post",
    severity: "critical",
    reason: {
      fa: "تعریف‌کنندهٔ نرخ ساعتی نباید همان کسی باشد که هزینهٔ محاسبه‌شده با آن نرخ را به دفتر مالی می‌فرستد",
      en: "The rate card owner must not be the one posting cost computed with that rate",
    },
  },
  {
    /* عدد نفر-ساعت پس از تأیید مدیر پروژه وارد بهره‌وری و هزینه
     * می‌شود؛ کسی که آن را نهایی می‌کند نباید همان کسی باشد که در
     * دفتر مالی می‌نشاندش. همان الگوی SOD-15 در دامنهٔ نیروی انسانی. */
    id: "SOD-17",
    a: "hrm.timesheet.finalize",
    b: "hrm.cost.post",
    severity: "critical",
    reason: {
      fa: "تأییدکنندهٔ نهایی کارکرد نباید همان کسی باشد که هزینهٔ آن را در دفتر مالی ثبت می‌کند",
      en: "The final timesheet approver must not post its cost to the finance ledger",
    },
  },
  {
    /* سند اصلاحی تنها راه تغییر دورهٔ بسته است؛ اگر یک نفر هم آن را
     * بنویسد و هم تأیید کند، قفل دوره بی‌معنا می‌شود. */
    id: "SOD-18",
    a: "hrm.adjustment.raise",
    b: "hrm.adjustment.approve",
    severity: "high",
    reason: {
      fa: "نویسندهٔ سند اصلاحی کارکرد نباید تأییدکنندهٔ آن باشد",
      en: "The adjustment author must not approve it",
    },
  },
  {
    /* کسی که موتور بهره‌وری را اجرا می‌کند ورودی‌هایش را هم انتخاب
     * می‌کند؛ اگر همان نفر عدد را نهایی و تغییرناپذیر کند، هیچ چشم
     * دومی روی شاخصی که به کارفرما گزارش می‌شود نمی‌ماند. */
    id: "SOD-19",
    a: "hrm.productivity.compute",
    b: "hrm.metric.finalize",
    severity: "high",
    reason: {
      fa: "اجراکنندهٔ محاسبهٔ بهره‌وری نباید متریک همان دوره را نهایی کند",
      en: "The productivity computer must not finalize the same period's metrics",
    },
  },
  {
    /* علت افت در کارگاه ثبت می‌شود و در دفتر پیمان به پول تبدیل
     * می‌شود. یکی بودن این دو دست، انگیزهٔ ساختن علت ادعاپذیر از
     * هیچ را می‌سازد. */
    id: "SOD-20",
    a: "hrm.rca.record",
    b: "hrm.claim.link",
    severity: "high",
    reason: {
      fa: "ثبت‌کنندهٔ علت افت بهره‌وری نباید همان کسی باشد که آن را به ادعای قراردادی تبدیل می‌کند",
      en: "The root-cause recorder must not be the one converting it into a contractual claim",
    },
  },
  {
    /* اسکن مدرک را کسی می‌فرستد که نفر جلوی اوست؛ اصالتش را باید
     * چشم دومی تأیید کند. بدون این تفکیک، «قرارداد امضاشده» به یک
     * فایل تصویری بی‌بررسی تقلیل پیدا می‌کرد. */
    id: "SOD-24",
    a: "hrm.doc.upload",
    b: "hrm.doc.verify",
    severity: "high",
    reason: {
      fa: "بارگذارندهٔ مدرک پرسنلی نباید تأییدکنندهٔ اصالت آن باشد",
      en: "The uploader of a personnel document must not verify its authenticity",
    },
  },
  {
    /* درخواست تجهیز تعهد بودجهٔ نفر-ساعت است؛ همان الگوی SOD-03 در
     * دامنهٔ نیروی انسانی. */
    id: "SOD-25",
    a: "hrm.mob.request",
    b: "hrm.mob.approve",
    severity: "high",
    reason: {
      fa: "درخواست‌دهندهٔ تجهیز نیرو نباید تأییدکنندهٔ آن باشد",
      en: "The mobilization requester must not approve it",
    },
  },
  {
    /* فعال‌سازی نفر یعنی باز کردن در ثبت ساعت. اگر همان کسی که
     * مدرک را تأیید می‌کند بتواند نفر را هم فعال کند، هر دو کنترل
     * در یک دست جمع می‌شود و گیت‌ها تشریفاتی می‌شوند. */
    id: "SOD-26",
    a: "hrm.person.activate",
    b: "hrm.timesheet.enter",
    severity: "high",
    reason: {
      fa: "فعال‌کنندهٔ نفر نباید همان کسی باشد که برای او ساعت ثبت می‌کند",
      en: "The person activator must not enter timesheets for them",
    },
  },
  {
    /* حضور گروهی پیمانکار سند اصلی مطالبهٔ اوست و بر خلاف تایم‌شیت
     * فردی، هیچ امضای شخصی پشتش نیست: فقط یک عدد سرشماری. اگر
     * ثبت‌کننده خودش تأیید کند، هیچ چشم دومی روی آن عدد نیست. */
    id: "SOD-21",
    a: "hrm.sub.record",
    b: "hrm.sub.verify",
    severity: "high",
    reason: {
      fa: "ثبت‌کنندهٔ حضور گروهی پیمانکار نباید همان کسی باشد که آن را تأیید می‌کند",
      en: "The recorder of subcontractor attendance must not verify it",
    },
  },
  {
    /* همان اصل SOD-14 در دامنهٔ نیروی انسانی: تهیه‌کنندهٔ
     * صورت‌کارکرد پیمانکار نباید تصویب‌کنندهٔ پرداختش باشد. */
    id: "SOD-22",
    a: "hrm.subipc.prepare",
    b: "hrm.subipc.approve",
    severity: "critical",
    reason: {
      fa: "تهیه‌کنندهٔ صورت‌کارکرد نیروی پیمانکاری نباید تأییدکنندهٔ آن باشد",
      en: "The preparer of a labour IPC must not approve it",
    },
  },
  {
    /* نرخ توافقی هر رسته ضریب مستقیم مبلغ صورت‌کارکرد است؛ کسی که
     * نرخ را می‌نویسد نباید همان کسی باشد که سند مبتنی بر آن را
     * تأیید می‌کند، وگرنه نرخ پس از توافق هم قابل جابه‌جایی است. */
    id: "SOD-23",
    a: "hrm.sub.manage",
    b: "hrm.subipc.approve",
    severity: "high",
    reason: {
      fa: "تنظیم‌کنندهٔ نرخ قرارداد نیروی پیمانکاری نباید تأییدکنندهٔ صورت‌کارکرد مبتنی بر همان نرخ باشد",
      en: "The setter of subcontract rates must not approve the IPC priced by them",
    },
  },
  {
    id: "SOD-13",
    a: "cnt.guarantee.manage",
    b: "cnt.guarantee.release",
    severity: "critical",
    reason: {
      fa: "ثبت‌کنندهٔ ضمانت‌نامه نباید بتواند همان وثیقه را آزاد یا ضبط کند",
      en: "The recorder of a guarantee must not release or forfeit it",
    },
  },
  {
    id: "SOD-12",
    a: "cnt.ipc.review",
    b: "cnt.ipc.approve",
    severity: "high",
    reason: {
      fa: "تأیید مشاور و تصویب کارفرما دو کنترل مستقل‌اند و در یک نفر جمع نمی‌شوند",
      en: "Consultant review and employer approval are independent controls",
    },
  },
  {
    id: "SOD-02",
    a: "qms.ncr.raise",
    b: "qms.ncr.close",
    severity: "high",
    reason: { fa: "صادرکنندهٔ عدم انطباق نباید خودش آن را ببندد", en: "The raiser of an NCR must not close it" },
  },
  {
    id: "SOD-03",
    a: "rcc.change.raise",
    b: "rcc.change.approve",
    severity: "critical",
    reason: { fa: "درخواست‌کنندهٔ تغییر نباید در CCB رأی تصویب بدهد", en: "The change requester must not approve it in CCB" },
  },
  {
    id: "SOD-04",
    a: "hrm.timesheet.enter",
    b: "hrm.timesheet.approve",
    severity: "high",
    reason: { fa: "ثبت‌کنندهٔ تایم‌شیت نباید تأییدکنندهٔ آن باشد", en: "Timesheet entry and approval must be separated" },
  },
  {
    id: "SOD-05",
    a: "plan.progress.report",
    b: "plan.progress.approve",
    severity: "high",
    reason: { fa: "اعلام‌کنندهٔ پیشرفت نباید تأییدکنندهٔ آن باشد", en: "Progress reporting and approval must be separated" },
  },
  {
    id: "SOD-06",
    a: "sys.audit.view",
    b: "sys.audit.purge",
    severity: "critical",
    reason: { fa: "پاک‌سازی لاگ ممیزی باید از مشاهدهٔ آن جدا باشد", en: "Audit purge must be separated from audit review" },
  },
  {
    id: "SOD-08",
    a: "eng.revision.issue",
    b: "eng.review.code",
    severity: "critical",
    reason: { fa: "صادرکنندهٔ مدرک نباید کد بررسی همان مدرک را بزند", en: "The revision issuer must not assign its own review code" },
  },
  {
    id: "SOD-09",
    a: "eng.crs.comment",
    b: "eng.crs.resolve",
    severity: "high",
    reason: { fa: "ثبت‌کنندهٔ نظر نباید خودش آن را ببندد", en: "The comment raiser must not resolve it" },
  },
  {
    id: "SOD-10",
    a: "eng.mr.raise",
    b: "eng.mr.approve",
    severity: "critical",
    reason: { fa: "صادرکنندهٔ درخواست کالا نباید تأییدکنندهٔ خرید آن باشد", en: "Material request raiser must not approve its purchase" },
  },
  {
    id: "SOD-07",
    a: "fin.budget.edit",
    b: "fin.invoice.issue",
    severity: "critical",
    reason: { fa: "ویرایش بودجه و صدور فاکتور نباید در یک دست جمع شود", en: "Budget editing and invoicing must not be combined" },
  },
  {
    /* گزارش رسمی نیرو، انحراف واقعی از **مبنا** را اعلام می‌کند و
     * مبنای مطالبهٔ تمدید یا دفاع در برابر آن است. اگر یک نفر هم مبنا
     * را بنویسد و هم گزارش انحراف از آن را امضا کند، می‌تواند مبنا را
     * پایین بیاورد تا انحراف ناپدید شود — بی‌آنکه هیچ عددی جعل شده
     * باشد. همان الگوی SOD-07 در دامنهٔ نیروی انسانی. */
    id: "SOD-27",
    a: "hrm.plan.baseline",
    b: "hrm.analytics.export",
    severity: "high",
    reason: {
      fa: "ثبت‌کنندهٔ مبنای نیرو نباید صادرکنندهٔ گزارش رسمی انحراف از همان مبنا باشد",
      en: "The manpower baseline setter must not issue the official variance report",
    },
  },
];

/** تخلف‌های تفکیک وظیفه در مجموعه‌ای از مجوزها. */
export function sodViolations(permissions: string[]): SodRule[] {
  const set = new Set(permissions);
  return SOD_RULES.filter((r) => set.has(r.a) && set.has(r.b));
}

/**
 * تفکیک وظیفه در سطح رکورد: کسی که رکورد را تهیه کرده نمی‌تواند تأییدش کند.
 * مهم‌تر از تفکیک سطح نقش است، چون مدیر پروژه هر دو مجوز را دارد.
 */
export function sodInstanceConflict(subjectId: string, record: { preparedBy?: string; raisedBy?: string; enteredBy?: string }): boolean {
  return [record.preparedBy, record.raisedBy, record.enteredBy].some((v) => !!v && v === subjectId);
}

/* ═══════════════════════════ ۵. تفویض اختیار ═══════════════════════════ */

export type Delegation = {
  id: string;
  fromUserId: string;
  toUserId: string;
  permissions: string[];
  /** ISO date YYYY-MM-DD — هر دو سرِ بازه شامل است */
  from: string;
  to: string;
  reason: string;
  revoked?: boolean;
};

export function isDelegationActive(d: Delegation, onDate: string): boolean {
  if (d.revoked) return false;
  return d.from <= onDate && onDate <= d.to;
}

/** مجوزهایی که در تاریخ داده‌شده به این کاربر تفویض شده است. */
export function delegatedPermissions(delegations: Delegation[], userId: string, onDate: string): string[] {
  const out = new Set<string>();
  for (const d of delegations) {
    if (d.toUserId !== userId) continue;
    if (!isDelegationActive(d, onDate)) continue;
    for (const p of d.permissions) out.add(p);
  }
  return [...out].sort();
}

export type DelegationIssue = { code: string; message: Bi };

/** اعتبارسنجی یک تفویض پیش از ثبت. */
export function validateDelegation(d: Delegation, granterPermissions: string[]): DelegationIssue[] {
  const issues: DelegationIssue[] = [];
  if (d.fromUserId === d.toUserId) {
    issues.push({ code: "E-DLG-01", message: { fa: "تفویض به خود بی‌معناست", en: "Cannot delegate to self" } });
  }
  if (d.to < d.from) {
    issues.push({ code: "E-DLG-02", message: { fa: "تاریخ پایان پیش از تاریخ شروع است", en: "End date precedes start date" } });
  }
  if (d.permissions.length === 0) {
    issues.push({ code: "E-DLG-03", message: { fa: "هیچ مجوزی برای تفویض انتخاب نشده", en: "No permission selected" } });
  }
  const notOwned = d.permissions.filter((p) => !granterPermissions.includes(p));
  if (notOwned.length) {
    issues.push({ code: "E-DLG-04", message: { fa: `تفویض مجوزی که خود ندارید ممکن نیست: ${notOwned.join("، ")}`, en: `Cannot delegate permissions you lack: ${notOwned.join(", ")}` } });
  }
  const unknown = d.permissions.filter((p) => !PERM_BY_CODE.has(p));
  if (unknown.length) {
    issues.push({ code: "E-DLG-05", message: { fa: `کد مجوز ناشناخته: ${unknown.join("، ")}`, en: `Unknown permission code: ${unknown.join(", ")}` } });
  }
  if (!d.reason.trim()) {
    issues.push({ code: "E-DLG-06", message: { fa: "دلیل تفویض الزامی است", en: "Delegation reason is mandatory" } });
  }
  const days = dayDiff(d.from, d.to);
  if (days > 90) {
    issues.push({ code: "W-DLG-07", message: { fa: "تفویض بیش از ۹۰ روز — بازنگری لازم است", en: "Delegation exceeds 90 days — review required" } });
  }
  return issues;
}

function dayDiff(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/* ═══════════════════════════ ۶. کاربر و ارزیابی ═══════════════════════════ */

export type Subject = {
  id: string;
  displayName: string;
  roles: string[];
  /** ["*"] یعنی همهٔ پروژه‌ها */
  projectIds: string[];
  /** ["*"] یعنی همهٔ دیسیپلین‌ها؛ خالی هم یعنی بدون محدودیت */
  disciplines?: string[];
  /** مجوزهای اضافه‌شدهٔ موردی */
  extraGrants?: string[];
  /** ممنوعیت صریح — همیشه بر همه‌چیز غالب است */
  denies?: string[];
  active: boolean;
  /** اگر تعیین نشود از نقش‌ها استنتاج می‌شود */
  clearance?: Classification;
  party?: RoleDef["party"];
};

export type AccessContext = {
  projectId?: string | null;
  discipline?: string | null;
  classification?: Classification;
  /** برای بررسی تفکیک وظیفه در سطح رکورد */
  record?: { preparedBy?: string; raisedBy?: string; enteredBy?: string };
  delegations?: Delegation[];
  /** تاریخ ISO برای ارزیابی تفویض — پیش‌فرض «امروز» را فراخوان می‌دهد */
  onDate?: string;
};

export type DecisionCode =
  | "ALLOW"
  | "ALLOW_DELEGATED"
  | "DENY_INACTIVE"
  | "DENY_EXPLICIT"
  | "DENY_NO_PERMISSION"
  | "DENY_PROJECT_SCOPE"
  | "DENY_DISCIPLINE_SCOPE"
  | "DENY_CLEARANCE"
  | "DENY_SOD"
  | "DENY_UNKNOWN_PERMISSION";

export type Decision = {
  allow: boolean;
  code: DecisionCode;
  reason: Bi;
  /** آیا این تصمیم باید در لاگ ممیزی ثبت شود */
  audit: boolean;
};

const DECISION_REASON: Record<DecisionCode, Bi> = {
  ALLOW: { fa: "دسترسی مجاز است", en: "Access granted" },
  ALLOW_DELEGATED: { fa: "دسترسی از طریق تفویض اختیار مجاز است", en: "Access granted via delegation" },
  DENY_INACTIVE: { fa: "حساب کاربری غیرفعال است", en: "User account is inactive" },
  DENY_EXPLICIT: { fa: "این مجوز صریحاً برای کاربر ممنوع شده است", en: "Permission explicitly denied for this user" },
  DENY_NO_PERMISSION: { fa: "هیچ‌یک از نقش‌های کاربر این مجوز را ندارد", en: "None of the user roles grant this permission" },
  DENY_PROJECT_SCOPE: { fa: "کاربر به این پروژه دسترسی ندارد", en: "User is not assigned to this project" },
  DENY_DISCIPLINE_SCOPE: { fa: "کاربر به این دیسیپلین دسترسی ندارد", en: "User is not assigned to this discipline" },
  DENY_CLEARANCE: { fa: "سطح دسترسی کاربر برای این طبقه‌بندی کافی نیست", en: "User clearance is insufficient for this classification" },
  DENY_SOD: { fa: "تفکیک وظایف نقض می‌شود: تهیه‌کننده نمی‌تواند تأییدکننده باشد", en: "Segregation of duties violated: preparer cannot approve" },
  DENY_UNKNOWN_PERMISSION: { fa: "کد مجوز در کاتالوگ نیست", en: "Permission code is not in the catalogue" },
};

const deny = (code: DecisionCode): Decision => ({ allow: false, code, reason: DECISION_REASON[code], audit: true });

/** همهٔ مجوزهای پایهٔ کاربر بدون در نظر گرفتن تفویض. */
export function subjectPermissions(subject: Subject): string[] {
  const out = new Set<string>();
  for (const rc of subject.roles) for (const p of effectivePermissions(rc)) out.add(p);
  for (const p of subject.extraGrants ?? []) out.add(p);
  for (const p of subject.denies ?? []) out.delete(p);
  return [...out].sort();
}

export function subjectClearance(subject: Subject): Classification {
  return subject.clearance ?? combinedClearance(subject.roles);
}

function inScope(list: string[] | undefined, value: string | null | undefined): boolean {
  if (!value) return true;
  if (!list || list.length === 0) return true;
  if (list.includes("*")) return true;
  return list.includes(value);
}

/**
 * تصمیم‌گیری واحد. ترتیب بررسی عمداً «رد غالب» است:
 * غیرفعال ← ممنوعیت صریح ← دامنه ← سطح دسترسی ← مجوز ← تفکیک وظیفه.
 */
export function evaluate(subject: Subject, permission: string, ctx: AccessContext = {}): Decision {
  const def = PERM_BY_CODE.get(permission);
  if (!def) return deny("DENY_UNKNOWN_PERMISSION");
  if (!subject.active) return deny("DENY_INACTIVE");
  if ((subject.denies ?? []).includes(permission)) return deny("DENY_EXPLICIT");
  if (!inScope(subject.projectIds, ctx.projectId)) return deny("DENY_PROJECT_SCOPE");
  if (!inScope(subject.disciplines, ctx.discipline)) return deny("DENY_DISCIPLINE_SCOPE");

  const required = ctx.classification ?? def.touches;
  if (!meetsClearance(subjectClearance(subject), required)) return deny("DENY_CLEARANCE");

  const base = subjectPermissions(subject);
  let via: "role" | "delegation" | null = base.includes(permission) ? "role" : null;
  if (!via && ctx.delegations && ctx.onDate) {
    if (delegatedPermissions(ctx.delegations, subject.id, ctx.onDate).includes(permission)) via = "delegation";
  }
  if (!via) return deny("DENY_NO_PERMISSION");

  // تفکیک وظیفه در سطح رکورد فقط روی اقدام‌های تأییدی معنا دارد.
  if (ctx.record && isApprovalPermission(permission) && sodInstanceConflict(subject.id, ctx.record)) {
    return deny("DENY_SOD");
  }

  const code: DecisionCode = via === "delegation" ? "ALLOW_DELEGATED" : "ALLOW";
  return { allow: true, code, reason: DECISION_REASON[code], audit: def.audited || via === "delegation" };
}

/** آیا این مجوز یک اقدام «تأیید/امضا/بستن» است؟ */
export function isApprovalPermission(permission: string): boolean {
  return /\.(approve|sign|close|publish|submit|issue)$/.test(permission);
}

/** میان‌بر بولی برای مصرف در UI. */
export function can(subject: Subject | null, permission: string, ctx: AccessContext = {}): boolean {
  if (!subject) return false;
  return evaluate(subject, permission, ctx).allow;
}

/* ═══════════════════════════ ۷. پوشاندن میدان‌های حساس ═══════════════════════════ */

export type MaskRule = { field: string; permission: string; mask: string };

/** میدان‌هایی که بدون مجوز مربوطه پوشانده می‌شوند. */
export const MASK_RULES: MaskRule[] = [
  { field: "dailyRate", permission: "hrm.rate.view", mask: "•••" },
  { field: "monthlySalary", permission: "hrm.rate.view", mask: "•••" },
  { field: "nationalId", permission: "hrm.personal.view", mask: "••••••••••" },
  { field: "mobile", permission: "hrm.personal.view", mask: "•••••••••••" },
  { field: "unitRate", permission: "fin.rate.view", mask: "•••" },
  { field: "contractValue", permission: "fin.cost.view", mask: "•••" },
  { field: "claimStrategy", permission: "rcc.claim.edit", mask: "[محرمانه]" },
];

/** یک رکورد را بر اساس مجوزهای کاربر می‌پوشاند. رکورد ورودی تغییر نمی‌کند. */
export function maskRecord<T extends Record<string, unknown>>(subject: Subject | null, row: T, ctx: AccessContext = {}): T {
  const out: Record<string, unknown> = { ...row };
  for (const rule of MASK_RULES) {
    if (!(rule.field in out)) continue;
    if (!can(subject, rule.permission, ctx)) out[rule.field] = rule.mask;
  }
  return out as T;
}

export function maskedFields(subject: Subject | null, row: Record<string, unknown>, ctx: AccessContext = {}): string[] {
  return MASK_RULES.filter((r) => r.field in row && !can(subject, r.permission, ctx)).map((r) => r.field);
}

/* ═══════════════════════════ ۸. سیاست‌های امنیتی ═══════════════════════════ */

export type PasswordPolicy = {
  minLength: number;
  requireUpper: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  maxAgeDays: number;
  historyDepth: number;
};

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  requireUpper: true,
  requireDigit: true,
  requireSymbol: true,
  maxAgeDays: 90,
  historyDepth: 5,
};

export type PasswordCheck = { ok: boolean; score: number; issues: Bi[] };

export function checkPassword(pw: string, policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY): PasswordCheck {
  const issues: Bi[] = [];
  if (pw.length < policy.minLength) issues.push({ fa: `حداقل ${policy.minLength} نویسه لازم است`, en: `At least ${policy.minLength} characters required` });
  if (policy.requireUpper && !/[A-Z]/.test(pw)) issues.push({ fa: "حرف بزرگ لاتین لازم است", en: "An uppercase letter is required" });
  if (policy.requireDigit && !/\d/.test(pw)) issues.push({ fa: "رقم لازم است", en: "A digit is required" });
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(pw)) issues.push({ fa: "نویسهٔ ویژه لازم است", en: "A symbol is required" });
  if (/^(.)\1+$/.test(pw)) issues.push({ fa: "نویسهٔ تکراری مطلق", en: "All characters identical" });

  let score = 0;
  score += Math.min(40, pw.length * 3);
  if (/[A-Z]/.test(pw)) score += 15;
  if (/[a-z]/.test(pw)) score += 10;
  if (/\d/.test(pw)) score += 15;
  if (/[^A-Za-z0-9]/.test(pw)) score += 20;
  score = Math.max(0, Math.min(100, score - issues.length * 10));

  return { ok: issues.length === 0, score, issues };
}

export type SessionPolicy = { idleMinutes: number; absoluteHours: number; mfaRequired: boolean };

/** هرچه سطح دسترسی بالاتر، نشست کوتاه‌تر و MFA الزامی. */
export function sessionPolicyFor(clearance: Classification): SessionPolicy {
  if (clearance === "restricted") return { idleMinutes: 15, absoluteHours: 8, mfaRequired: true };
  if (clearance === "confidential") return { idleMinutes: 30, absoluteHours: 10, mfaRequired: true };
  return { idleMinutes: 60, absoluteHours: 12, mfaRequired: false };
}

export type LockoutPolicy = { maxAttempts: number; windowMinutes: number; lockMinutes: number };

export const DEFAULT_LOCKOUT: LockoutPolicy = { maxAttempts: 5, windowMinutes: 15, lockMinutes: 30 };

export type LockoutState = { locked: boolean; remainingAttempts: number; unlockAfterMinutes: number };

export function loginThrottle(failedAttempts: number, minutesSinceFirstFail: number, policy: LockoutPolicy = DEFAULT_LOCKOUT): LockoutState {
  // پنجره منقضی شده باشد، شمارش از صفر است.
  if (minutesSinceFirstFail > policy.windowMinutes) {
    return { locked: false, remainingAttempts: policy.maxAttempts, unlockAfterMinutes: 0 };
  }
  const remaining = Math.max(0, policy.maxAttempts - failedAttempts);
  if (remaining > 0) return { locked: false, remainingAttempts: remaining, unlockAfterMinutes: 0 };
  return { locked: true, remainingAttempts: 0, unlockAfterMinutes: policy.lockMinutes };
}

/* ═══════════════════════════ ۹. امتیاز وضعیت امنیتی ═══════════════════════════ */

export type PostureInput = {
  subjects: Subject[];
  delegations: Delegation[];
  onDate: string;
  httpsEnforced: boolean;
  mfaEnabled: boolean;
  auditRetentionDays: number;
  backupAgeDays: number | null;
  sqlEncrypted: boolean;
};

export type Finding = {
  code: string;
  severity: "critical" | "high" | "medium" | "low";
  title: Bi;
  detail: Bi;
  weight: number;
};

export type Posture = { score: number; grade: "A" | "B" | "C" | "D" | "E"; findings: Finding[] };

export function scorePosture(input: PostureInput): Posture {
  const findings: Finding[] = [];

  // ۱. تفکیک وظایف در سطح نقش
  for (const s of input.subjects) {
    if (!s.active) continue;
    const v = sodViolations(subjectPermissions(s));
    for (const rule of v) {
      findings.push({
        code: `SEC-SOD-${rule.id}`,
        severity: rule.severity === "critical" ? "critical" : "high",
        title: { fa: `نقض تفکیک وظیفه — ${s.displayName}`, en: `SoD violation — ${s.displayName}` },
        detail: rule.reason,
        weight: rule.severity === "critical" ? 12 : 7,
      });
    }
  }

  // ۲. کاربران با دسترسی همهٔ پروژه‌ها
  const wildcard = input.subjects.filter((s) => s.active && s.projectIds.includes("*"));
  if (wildcard.length > 3) {
    findings.push({
      code: "SEC-SCOPE-01",
      severity: "medium",
      title: { fa: "دسترسی سراسری بیش از حد", en: "Excessive portfolio-wide access" },
      detail: { fa: `${wildcard.length} کاربر به همهٔ پروژه‌ها دسترسی دارند`, en: `${wildcard.length} users have access to every project` },
      weight: 6,
    });
  }

  // ۳. تفویض‌های منقضی‌نشدهٔ طولانی
  const stale = input.delegations.filter((d) => isDelegationActive(d, input.onDate) && dayDiff(d.from, d.to) > 90);
  if (stale.length) {
    findings.push({
      code: "SEC-DLG-01",
      severity: "medium",
      title: { fa: "تفویض اختیار طولانی‌مدت", en: "Long-running delegation" },
      detail: { fa: `${stale.length} تفویض فعال بیش از ۹۰ روز`, en: `${stale.length} active delegations exceed 90 days` },
      weight: 5,
    });
  }

  // ۴. کاربران غیرفعال با مجوز باقی‌مانده
  const zombie = input.subjects.filter((s) => !s.active && subjectPermissions(s).length > 0);
  if (zombie.length) {
    findings.push({
      code: "SEC-USR-01",
      severity: "high",
      title: { fa: "حساب غیرفعال با مجوز باقی‌مانده", en: "Inactive account retains grants" },
      detail: { fa: `${zombie.length} حساب غیرفعال هنوز نقش دارد`, en: `${zombie.length} inactive accounts still hold roles` },
      weight: 8,
    });
  }

  if (!input.httpsEnforced) {
    findings.push({ code: "SEC-NET-01", severity: "critical", title: { fa: "HTTPS اجباری نیست", en: "HTTPS is not enforced" }, detail: { fa: "ترافیک باید روی TLS اجبار شود", en: "Traffic must be forced over TLS" }, weight: 15 });
  }
  if (!input.mfaEnabled) {
    findings.push({ code: "SEC-AUTH-01", severity: "high", title: { fa: "احراز هویت دومرحله‌ای غیرفعال", en: "MFA disabled" }, detail: { fa: "برای نقش‌های سطح سری الزامی است", en: "Mandatory for restricted-clearance roles" }, weight: 10 });
  }
  if (!input.sqlEncrypted) {
    findings.push({ code: "SEC-DB-01", severity: "high", title: { fa: "رمزنگاری پایگاه داده غیرفعال", en: "Database encryption off" }, detail: { fa: "TDE یا رمزنگاری ستونی فعال نیست", en: "TDE or column encryption is not enabled" }, weight: 9 });
  }
  if (input.auditRetentionDays < 365) {
    findings.push({ code: "SEC-AUD-01", severity: "medium", title: { fa: "نگهداشت لاگ ممیزی کوتاه", en: "Short audit retention" }, detail: { fa: `${input.auditRetentionDays} روز — حداقل ۳۶۵ روز توصیه می‌شود`, en: `${input.auditRetentionDays} days — 365 recommended` }, weight: 5 });
  }
  if (input.backupAgeDays === null) {
    findings.push({ code: "SEC-BKP-01", severity: "critical", title: { fa: "هیچ نسخهٔ پشتیبانی وجود ندارد", en: "No backup snapshot" }, detail: { fa: "پیش از بهره‌برداری پشتیبان بگیرید", en: "Take a backup before go-live" }, weight: 14 });
  } else if (input.backupAgeDays > 7) {
    findings.push({ code: "SEC-BKP-02", severity: "medium", title: { fa: "پشتیبان قدیمی", en: "Stale backup" }, detail: { fa: `${input.backupAgeDays} روز از آخرین پشتیبان گذشته`, en: `${input.backupAgeDays} days since last backup` }, weight: 6 });
  }

  const penalty = findings.reduce((s, f) => s + f.weight, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const grade: Posture["grade"] = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E";
  return { score, grade, findings: findings.sort((a, b) => b.weight - a.weight) };
}

/* ═══════════════════════════ ۱۰. ماتریس و ممیزی ═══════════════════════════ */

/** ماتریس نقش × مجوز برای نمایش و صدور. */
export function roleMatrix(): { role: string; title: Bi; clearance: Classification; permissions: string[] }[] {
  return ROLE_CATALOG.map((r) => ({ role: r.code, title: r.title, clearance: r.clearance, permissions: effectivePermissions(r.code) }));
}

/** مجوزهایی که هیچ نقشی ندارد — نشانهٔ کاتالوگ ناقص. */
export function orphanPermissions(): string[] {
  const granted = new Set<string>();
  for (const r of ROLE_CATALOG) for (const p of effectivePermissions(r.code)) granted.add(p);
  return PERMISSION_CODES.filter((c) => !granted.has(c));
}

/** مجوزهایی که در نقش‌ها آمده ولی در کاتالوگ نیست — نشانهٔ غلط املایی. */
export function danglingGrants(): { role: string; permission: string }[] {
  const out: { role: string; permission: string }[] = [];
  for (const r of ROLE_CATALOG) {
    for (const p of r.grants) if (!PERM_BY_CODE.has(p)) out.push({ role: r.code, permission: p });
  }
  return out;
}

export type AccessAuditRecord = {
  at: string;
  subjectId: string;
  permission: string;
  decision: DecisionCode;
  projectId?: string | null;
  severity: "info" | "warning" | "security" | "critical";
};

/** شدت رویداد ممیزی از روی تصمیم و حساسیت مجوز. */
export function auditSeverity(permission: string, decision: DecisionCode): AccessAuditRecord["severity"] {
  if (decision === "DENY_SOD" || decision === "DENY_EXPLICIT") return "critical";
  if (decision.startsWith("DENY")) return "warning";
  const def = PERM_BY_CODE.get(permission);
  if (def && def.touches === "restricted") return "security";
  return "info";
}

export function buildAuditRecord(subject: Subject, permission: string, decision: Decision, at: string, projectId?: string | null): AccessAuditRecord {
  return {
    at,
    subjectId: subject.id,
    permission,
    decision: decision.code,
    projectId: projectId ?? null,
    severity: auditSeverity(permission, decision.code),
  };
}

/* ═══════════════════════════ ۱۱. کاربران نمونه ═══════════════════════════ */

export const DEMO_SUBJECTS: Subject[] = [
  { id: "u-admin", displayName: "محمدرضا هاشمی‌پور", roles: ["admin"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-pm", displayName: "مدیر پروژه آزادگان", roles: ["project_manager"], projectIds: ["c1-p1", "c1-p2"], active: true, party: "contractor" },
  { id: "u-pmo", displayName: "دفتر مدیریت پروژه", roles: ["pmo"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-planner", displayName: "کارشناس برنامه‌ریزی", roles: ["planner"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-cost", displayName: "کنترل هزینه", roles: ["cost_controller"], projectIds: ["c1-p1"], active: true, party: "contractor" },
  { id: "u-qc", displayName: "بازرس کیفیت", roles: ["qc_inspector"], projectIds: ["c1-p1"], disciplines: ["mechanical", "piping"], active: true, party: "contractor" },
  { id: "u-qa", displayName: "مدیر تضمین کیفیت", roles: ["qa_manager"], projectIds: ["c1-p1", "c1-p2"], active: true, party: "contractor" },
  { id: "u-hr", displayName: "مدیر منابع انسانی", roles: ["hr_manager"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-doc", displayName: "کنترل مدارک", roles: ["doc_controller"], projectIds: ["c1-p1"], active: true, party: "contractor" },
  { id: "u-contracts", displayName: "مدیر پیمان", roles: ["contracts_manager"], projectIds: ["c1-p1", "c1-p2"], active: true, party: "contractor" },
  { id: "u-site", displayName: "سرپرست کارگاه", roles: ["site_engineer"], projectIds: ["c1-p1"], disciplines: ["civil"], active: true, party: "contractor" },
  { id: "u-comm", displayName: "مدیر راه‌اندازی و تحویل", roles: ["commissioning_manager"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-hse", displayName: "افسر ایمنی و بهداشت", roles: ["hse_officer"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-engmgr", displayName: "مدیر مهندسی و طراحی", roles: ["engineering_manager"], projectIds: ["c1-p1", "c1-p2"], active: true, party: "contractor" },
  { id: "u-design", displayName: "سرپرست طراحی — لوله‌کشی", roles: ["design_lead"], projectIds: ["c1-p1"], disciplines: ["piping"], active: true, party: "contractor" },
  { id: "u-consultant", displayName: "نماینده مشاور", roles: ["consultant"], projectIds: ["c1-p1", "c5-p1"], active: true, party: "consultant" },
  { id: "u-client", displayName: "نماینده کارفرما", roles: ["client"], projectIds: ["c1-p1", "c3-p1"], active: true, party: "client" },
  { id: "u-ceo", displayName: "مدیر ارشد", roles: ["executive"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-sub", displayName: "پیمانکار جزء — ابنیه", roles: ["subcontractor"], projectIds: ["c1-p1"], disciplines: ["civil"], active: true, party: "subcontractor" },
  { id: "u-auditor", displayName: "ممیز داخلی", roles: ["auditor"], projectIds: ["*"], active: true, party: "any" },
  // کاربر عمداً پرمجوز: دو نقش هم‌زمان که تفکیک وظیفه را نقض می‌کند — ورودی آزمون وضعیت امنیتی.
  { id: "u-over", displayName: "سرپرست مالی کارگاه (دو نقش)", roles: ["cost_controller", "project_manager"], projectIds: ["c1-p1"], active: true, party: "contractor" },
  { id: "u-left", displayName: "کارشناس منتقل‌شده", roles: ["planner"], projectIds: ["c1-p1"], active: false, party: "contractor" },
];

export const DEMO_DELEGATIONS: Delegation[] = [
  {
    id: "dlg-1",
    fromUserId: "u-pm",
    toUserId: "u-planner",
    permissions: ["plan.baseline.set", "plan.progress.approve"],
    from: "2026-09-01",
    to: "2026-09-20",
    reason: "مأموریت مدیر پروژه به تهران",
  },
  {
    id: "dlg-2",
    fromUserId: "u-pm",
    toUserId: "u-cost",
    permissions: ["fin.ipc.approve"],
    from: "2026-06-01",
    to: "2026-12-30",
    reason: "تفویض دائم تأیید صورت‌وضعیت",
  },
];
