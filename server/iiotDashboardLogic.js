/* GENERATED از src/services/iiotDashboard.ts — ویرایش دستی ممنوع. بازتولید: npm run build:iiotdash */

// src/services/accessControl.ts
var CLASSIFICATION_RANK = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3
};
function meetsClearance(clearance, required) {
  return CLASSIFICATION_RANK[clearance] >= CLASSIFICATION_RANK[required];
}
var P = (code, module, fa, en, touches = "internal", audited = false) => ({ code, module, title: { fa, en }, touches, audited });
var PERMISSION_CATALOG = [
  /* LIVE-6: business access is explicit; system admin is not a strategy assessor. */
  P("spm.plan.view", "d20", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0628\u0631\u0646\u0627\u0645\u0647\u0654 \u0627\u0633\u062A\u0631\u0627\u062A\u0698\u06CC\u06A9", "View strategic plans", "confidential"),
  P("spm.plan.edit", "d20", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0628\u0631\u0646\u0627\u0645\u0647\u0654 \u0627\u0633\u062A\u0631\u0627\u062A\u0698\u06CC\u06A9", "Edit strategic plans", "confidential", true),
  P("oex.assessment.view", "d19", "\u0645\u0634\u0627\u0647\u062F\u0647 \u062E\u0648\u062F\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u062A\u0639\u0627\u0644\u06CC", "View excellence self-assessments", "confidential"),
  P("oex.assessment.edit", "d19", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062E\u0648\u062F\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u062A\u0639\u0627\u0644\u06CC", "Edit excellence self-assessments", "confidential", true),
  /* ── هسته و سامانه ── */
  P("core.portfolio.view", "core", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0633\u0628\u062F \u067E\u0631\u0648\u0698\u0647", "View portfolio", "internal"),
  P("core.project.view", "core", "\u0645\u0634\u0627\u0647\u062F\u0647 \u067E\u0631\u0648\u0698\u0647", "View project", "internal"),
  P("core.project.edit", "core", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0645\u0634\u062E\u0635\u0627\u062A \u067E\u0631\u0648\u0698\u0647", "Edit project", "confidential", true),
  P("core.ai.run", "core", "\u0627\u062C\u0631\u0627\u06CC \u062F\u0633\u062A\u06CC\u0627\u0631 \u0647\u0648\u0634\u0645\u0646\u062F", "Run AI assistant", "internal"),
  /* صندوق خروجی رویداد (D13).
   *
   * دیدن صف تحویل «داخلی» است — هرکس که با یکپارچه‌سازی سروکار دارد
   * باید بفهمد چرا رقمش به سامانهٔ بیرونی نرسیده. ولی **تلاش دوبارهٔ
   * دستی** محرمانه است: هر تلاش یک نوشتن در سامانهٔ بیرونی است. */
  P("core.event.view", "core", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0635\u0646\u062F\u0648\u0642 \u0631\u0648\u06CC\u062F\u0627\u062F", "View event outbox", "internal"),
  P("core.event.replay", "core", "\u062A\u0644\u0627\u0634 \u062F\u0648\u0628\u0627\u0631\u0647\u0654 \u062A\u062D\u0648\u06CC\u0644 \u0631\u0648\u06CC\u062F\u0627\u062F", "Replay event delivery", "confidential", true),
  P("sys.config.manage", "d7", "\u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC \u0633\u0627\u0645\u0627\u0646\u0647", "Manage system config", "restricted", true),
  P("sys.user.manage", "d7", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u06A9\u0627\u0631\u0628\u0631\u0627\u0646 \u0648 \u0646\u0642\u0634\u200C\u0647\u0627", "Manage users & roles", "restricted", true),
  P("sys.audit.view", "d7", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0644\u0627\u06AF \u0645\u0645\u06CC\u0632\u06CC", "View audit log", "confidential", true),
  P("sys.audit.purge", "d7", "\u067E\u0627\u06A9\u200C\u0633\u0627\u0632\u06CC \u0644\u0627\u06AF \u0645\u0645\u06CC\u0632\u06CC", "Purge audit log", "restricted", true),
  P("sys.backup.export", "d7", "\u062A\u0647\u06CC\u0647 \u0646\u0633\u062E\u0647 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646", "Export backup", "restricted", true),
  P("sys.backup.restore", "d7", "\u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0646\u0633\u062E\u0647 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646", "Restore backup", "restricted", true),
  /* ── d1 اسناد و مدارک ── */
  P("doc.document.view", "d1", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0645\u062F\u0627\u0631\u06A9", "View documents", "internal"),
  P("doc.document.upload", "d1", "\u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u0645\u062F\u0631\u06A9", "Upload document", "internal", true),
  P("doc.document.approve", "d1", "\u062A\u0623\u06CC\u06CC\u062F \u0645\u062F\u0631\u06A9", "Approve document", "confidential", true),
  P("doc.transmittal.issue", "d1", "\u0635\u062F\u0648\u0631 \u062A\u0631\u0627\u0646\u0633\u0645\u06CC\u062A\u0627\u0644", "Issue transmittal", "confidential", true),
  /* ── d2 برنامه‌ریزی و اجرا ── */
  P("plan.schedule.view", "d2", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0628\u0631\u0646\u0627\u0645\u0647 \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC", "View schedule", "internal"),
  P("plan.schedule.edit", "d2", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0628\u0631\u0646\u0627\u0645\u0647 \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC", "Edit schedule", "confidential", true),
  P("plan.baseline.set", "d2", "\u062A\u062B\u0628\u06CC\u062A \u0628\u0631\u0646\u0627\u0645\u0647 \u0645\u0628\u0646\u0627", "Set baseline", "confidential", true),
  P("plan.progress.report", "d2", "\u062B\u0628\u062A \u067E\u06CC\u0634\u0631\u0641\u062A \u0627\u062C\u0631\u0627", "Report progress", "internal"),
  P("plan.progress.approve", "d2", "\u062A\u0623\u06CC\u06CC\u062F \u067E\u06CC\u0634\u0631\u0641\u062A \u0627\u062C\u0631\u0627", "Approve progress", "confidential", true),
  /* ── d3 پایش و کنترل ── */
  P("pex.dashboard.view", "d3", "\u0645\u0634\u0627\u0647\u062F\u0647 \u062F\u0627\u0634\u0628\u0648\u0631\u062F \u0639\u0645\u0644\u06A9\u0631\u062F", "View performance dashboard", "internal"),
  P("pex.evm.view", "d3", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0627\u0631\u0632\u0634 \u06A9\u0633\u0628\u200C\u0634\u062F\u0647", "View earned value", "confidential"),
  P("pex.kpi.edit", "d3", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u0627\u062E\u0635\u200C\u0647\u0627", "Edit KPIs", "confidential", true),
  P("pex.forecast.edit", "d3", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u067E\u06CC\u0634\u200C\u0628\u06CC\u0646\u06CC", "Edit forecast", "confidential", true),
  /* ── d4 ریسک، تغییر و ادعا ── */
  P("rcc.risk.view", "d4", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0631\u06CC\u0633\u06A9", "View risks", "internal"),
  P("rcc.risk.edit", "d4", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0631\u06CC\u0633\u06A9", "Edit risks", "confidential"),
  P("rcc.change.raise", "d4", "\u062B\u0628\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u063A\u06CC\u06CC\u0631", "Raise change request", "confidential", true),
  P("rcc.change.approve", "d4", "\u062A\u0635\u0648\u06CC\u0628 \u062A\u063A\u06CC\u06CC\u0631 \u062F\u0631 CCB", "Approve change (CCB)", "restricted", true),
  P("rcc.claim.view", "d4", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0627\u062F\u0639\u0627", "View claims", "confidential"),
  P("rcc.claim.edit", "d4", "\u062A\u0646\u0638\u06CC\u0645 \u0627\u062F\u0639\u0627", "Draft claim", "restricted", true),
  P("rcc.claim.submit", "d4", "\u0627\u0631\u0633\u0627\u0644 \u0631\u0633\u0645\u06CC \u0627\u062F\u0639\u0627", "Submit claim", "restricted", true),
  P("rcc.claim.decide", "d4", "\u0628\u0631\u0631\u0633\u06CC \u0648 \u062A\u0639\u06CC\u06CC\u0646 \u062A\u06A9\u0644\u06CC\u0641 \u0627\u062F\u0639\u0627", "Review and determine claims", "restricted", true),
  P("rcc.issue.view", "d4", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0645\u0633\u0626\u0644\u0647 \u0648 \u0647\u0634\u062F\u0627\u0631 \u0632\u0648\u062F", "View issues and early warnings", "internal"),
  P("rcc.issue.edit", "d4", "\u062B\u0628\u062A \u0648 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0645\u0633\u0626\u0644\u0647", "Record and progress issues", "confidential"),
  P("rcc.issue.escalate", "d4", "\u062A\u0634\u062F\u06CC\u062F \u0648 \u0628\u0633\u062A\u0646 \u0645\u0633\u0626\u0644\u0647", "Escalate and close issues", "restricted", true),
  P("rcc.delay.view", "d4", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627\u06CC \u062A\u0623\u062E\u06CC\u0631 \u0648 \u062A\u0645\u062F\u06CC\u062F \u0645\u062F\u062A", "View delay events and EOT", "confidential"),
  P("rcc.delay.edit", "d4", "\u062B\u0628\u062A \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0631\u0648\u06CC\u062F\u0627\u062F \u062A\u0623\u062E\u06CC\u0631", "Record and edit delay events", "restricted", true),
  P("rcc.delay.calculate", "d4", "\u0645\u062D\u0627\u0633\u0628\u0647 \u062A\u0623\u062E\u06CC\u0631 \u0648 \u0628\u062E\u0634\u0646\u0627\u0645\u0647\u200C\u0647\u0627\u06CC \u06F1\u06F3\u06F0\u06F0 \u0648 \u06F5\u06F0\u06F9\u06F0", "Calculate delay, Circular 1300 and 5090", "restricted", true),
  P("rcc.delay.approve", "d4", "\u062A\u0623\u06CC\u06CC\u062F \u0645\u062D\u0627\u0633\u0628\u0647 \u0648 \u062A\u0645\u062F\u06CC\u062F \u0645\u062F\u062A", "Approve delay calculation and EOT", "restricted", true),
  /* ── d12 مهندسی و طراحی ──
   * تفکیک بر پایهٔ اقتدار واقعی: ثبت مدرک، صدور ریویژن، پاسخ به نظر و
   * تأیید کارفرما چهار اقتدار جدا هستند. کد بررسی ۱ تا ۴ را فقط کارفرما و
   * مشاور می‌دهند، و همان کسی که مدرک را صادر می‌کند نباید کدش را بزند. */
  P("eng.mdr.view", "d12", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0641\u0647\u0631\u0633\u062A \u0645\u062F\u0627\u0631\u06A9", "View document register", "internal"),
  P("eng.mdr.edit", "d12", "\u062B\u0628\u062A \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0645\u062F\u0631\u06A9", "Edit document register", "confidential", true),
  P("eng.revision.issue", "d12", "\u0635\u062F\u0648\u0631 \u0631\u06CC\u0648\u06CC\u0698\u0646 \u0645\u062F\u0631\u06A9", "Issue revision", "confidential", true),
  P("eng.review.code", "d12", "\u062B\u0628\u062A \u06A9\u062F \u0628\u0631\u0631\u0633\u06CC \u06F1 \u062A\u0627 \u06F4", "Assign review code", "confidential", true),
  P("eng.crs.comment", "d12", "\u062B\u0628\u062A \u0646\u0638\u0631 \u062F\u0631 \u0634\u06CC\u062A \u0628\u0631\u0631\u0633\u06CC", "Raise CRS comment", "internal"),
  P("eng.crs.resolve", "d12", "\u0628\u0633\u062A\u0646 \u0648 \u062A\u0623\u06CC\u06CC\u062F \u067E\u0627\u0633\u062E \u0646\u0638\u0631", "Resolve CRS comment", "confidential", true),
  P("eng.tq.raise", "d12", "\u062B\u0628\u062A \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0648 \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0627\u0631\u06AF\u0627\u0647\u06CC", "Raise TQ/FCR", "internal"),
  P("eng.tq.answer", "d12", "\u067E\u0627\u0633\u062E \u0628\u0647 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0641\u0646\u06CC", "Answer technical query", "confidential", true),
  P("eng.vpr.review", "d12", "\u0628\u0631\u0631\u0633\u06CC \u0645\u062F\u0627\u0631\u06A9 \u0633\u0627\u0632\u0646\u062F\u06AF\u0627\u0646", "Review vendor prints", "confidential", true),
  P("eng.ifc.release", "d12", "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0633\u0627\u062E\u062A \u0628\u0627 \u0635\u062F\u0648\u0631 IFC", "Release construction via IFC", "restricted", true),
  P("eng.mr.raise", "d12", "\u0635\u062F\u0648\u0631 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u06A9\u0627\u0644\u0627\u06CC \u0645\u0647\u0646\u062F\u0633\u06CC", "Raise material request", "confidential", true),
  P("eng.mr.approve", "d12", "\u062A\u0623\u06CC\u06CC\u062F \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u06A9\u0627\u0644\u0627 \u0648 \u062A\u0628\u062F\u06CC\u0644 \u0628\u0647 \u062E\u0631\u06CC\u062F", "Approve MR and convert to PR", "restricted", true),
  /* ── d14 پیمان و صورت‌وضعیت ──
   * تفکیک بر پایهٔ اقتدار مالی: نگهداری شناسنامهٔ پیمان، ویرایش فهرست بها و
   * ثبت ریزمتره سه اقتدار جداست. ریزمتره را کسی می‌زند که در کارگاه است،
   * ولی نرخ را کسی تغییر می‌دهد که به پیمان دسترسی دارد — وگرنه هر سرکارگر
   * می‌توانست مبلغ صورت‌وضعیت را بالا ببرد. دور زدن دروازهٔ کیفی مجوز
   * جداگانه است تا در ممیزی مشخص باشد چه کسی آن را باز کرده. */
  P("cnt.contract.view", "d14", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0634\u0646\u0627\u0633\u0646\u0627\u0645\u0647 \u067E\u06CC\u0645\u0627\u0646", "View contract master", "confidential"),
  P("cnt.contract.edit", "d14", "\u062B\u0628\u062A \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u067E\u06CC\u0645\u0627\u0646 \u0648 \u0627\u0644\u062D\u0627\u0642\u06CC\u0647", "Edit contract and amendments", "restricted", true),
  P("cnt.boq.edit", "d14", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0641\u0647\u0631\u0633\u062A \u0628\u0647\u0627 \u0648 \u0646\u0631\u062E \u0631\u062F\u06CC\u0641", "Edit BOQ and unit rates", "restricted", true),
  /* ریزمتره فقط مقدار فیزیکی است و هیچ نرخی نشان نمی‌دهد، پس طبقه‌بندی
   * «داخلی» کافی است — وگرنه سرپرست کارگاه که کار را متره می‌کند نمی‌توانست
   * آن را ثبت کند و متره به گلوگاه دفتر مرکزی می‌افتاد. */
  P("cnt.measurement.record", "d14", "\u062B\u0628\u062A \u0631\u06CC\u0632\u0645\u062A\u0631\u0647 \u06A9\u0627\u0631\u06A9\u0631\u062F", "Record measurement sheet", "internal", true),
  P("cnt.ipc.override", "d14", "\u062F\u0648\u0631 \u0632\u062F\u0646 \u062F\u0631\u0648\u0627\u0632\u0647 \u06A9\u06CC\u0641\u06CC \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A", "Override IPC quality gate", "restricted", true),
  /* گردش صورت‌وضعیت عمداً به سه مجوز جدا شکسته شد، نه یک «cnt.ipc.edit».
   * تهیهٔ صورت‌وضعیت کار پیمانکار و دفتر فنی است، تأیید مشاور و تأیید
   * کارفرما دو تصمیم مستقل‌اند. اگر یک مجوز باشد، هر کسی که بتواند
   * صورت‌وضعیت بسازد می‌تواند خودش هم تأییدش کند و کل کنترل سه‌طرفه
   * بی‌معنا می‌شود. تفکیک وظیفه در `SOD_RULES` تضمین می‌شود. */
  P("cnt.ipc.prepare", "d14", "\u062A\u0647\u06CC\u0647 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A", "Prepare interim payment certificate", "confidential", true),
  P("cnt.ipc.review", "d14", "\u0628\u0631\u0631\u0633\u06CC \u0648 \u062A\u0623\u06CC\u06CC\u062F \u0645\u0634\u0627\u0648\u0631", "Consultant review of IPC", "confidential", true),
  P("cnt.ipc.approve", "d14", "\u062A\u0635\u0648\u06CC\u0628 \u0646\u0647\u0627\u06CC\u06CC \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A", "Employer approval of IPC", "restricted", true),
  /* سپرده جدا از صورت‌وضعیت مجوز دارد چون آزادسازی‌اش رویداد مالی
   * مستقلی است که ماه‌ها پس از آخرین صورت‌وضعیت رخ می‌دهد. */
  P("cnt.retainage.manage", "d14", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0648 \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0633\u067E\u0631\u062F\u0647", "Manage retainage ledger", "restricted", true),
  /* دیدن دفتر ضمانت‌نامه از تغییرش جداست: کنترل پروژه باید بداند چه
   * وثیقه‌ای نزدیک انقضاست تا تمدیدش را پیگیری کند، بی‌آنکه بتواند
   * آزاد یا ضبطش کند. */
  P("cnt.guarantee.view", "d14", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062F\u0641\u062A\u0631 \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647", "View guarantee register", "internal", false),
  P("cnt.guarantee.manage", "d14", "\u062B\u0628\u062A \u0648 \u062A\u0645\u062F\u06CC\u062F \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647", "Record and extend guarantee", "restricted", true),
  /* آزادسازی و ضبط از ثبت جدا شده‌اند: این دو نقطه‌ای‌اند که وثیقه
   * از دست می‌رود یا وصول می‌شود، و هر دو تصمیم کارفرماست نه
   * کارشناس پیمان. */
  P("cnt.guarantee.release", "d14", "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u06CC\u0627 \u0636\u0628\u0637 \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647", "Release or forfeit guarantee", "confidential", true),
  P("cnt.advance.manage", "d14", "\u062B\u0628\u062A \u0648 \u0628\u0627\u0632\u06CC\u0627\u0641\u062A \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A", "Manage advance payment", "restricted", true),
  /* صورت‌وضعیت پیمانکار جزء: تهیه از تأیید جدا می‌شود، دقیقاً مثل
   * صورت‌وضعیت اصلی. اینجا حساس‌تر هم هست چون تأییدکننده دارد پول
   * پیمانکار اصلی را خرج می‌کند. */
  P("cnt.subipc.view", "d14", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u062C\u0632\u0621", "View subcontractor IPC", "internal", false),
  P("cnt.subipc.prepare", "d14", "\u062A\u0647\u06CC\u0647\u0654 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u062C\u0632\u0621", "Prepare subcontractor IPC", "restricted", true),
  P("cnt.subipc.approve", "d14", "\u062A\u0623\u06CC\u06CC\u062F \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u062C\u0632\u0621", "Approve subcontractor IPC", "confidential", true),
  /* ثبت کسر پشت‌به‌پشت مجوز جدا دارد: کسی که کار جزء را تحویل
   * می‌گیرد نباید بتواند خودش مبلغ کسر را تعیین کند. */
  P("cnt.backtoback.manage", "d14", "\u062B\u0628\u062A \u06A9\u0633\u0631 \u067E\u0634\u062A\u200C\u0628\u0647\u200C\u067E\u0634\u062A", "Record back-to-back deduction", "restricted", true),
  /* پیشرفت پیمان خواندنی است و باید برای ناظر و کارفرما هم باز باشد:
   * درصد پیشرفت چیزی نیست که پنهان کردنش به کسی کمک کند. */
  P("cnt.progress.view", "d14", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u067E\u06CC\u0634\u0631\u0641\u062A \u067E\u06CC\u0645\u0627\u0646", "View contract progress", "internal", false),
  /* ثبت نقطهٔ عطف و تأییدش اما نوشتنی است و مستقیم روی درصد پیشرفت
   * پیمان مقطوع اثر می‌گذارد، یعنی روی پول. */
  P("cnt.milestone.manage", "d14", "\u062B\u0628\u062A \u0648 \u062A\u0623\u06CC\u06CC\u062F \u0646\u0642\u0637\u0647\u0654 \u0639\u0637\u0641", "Manage lump-sum milestones", "restricted", true),
  /* تابلوی سلامت پیمان: همان مخاطبان پیشرفت. عددی که مدیر پروژه
   * می‌بیند نباید با عددی که کارفرما می‌بیند فرق کند. */
  P("cnt.kpi.view", "d14", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0633\u0646\u062C\u0647 \u0648 \u0647\u0634\u062F\u0627\u0631 \u067E\u06CC\u0645\u0627\u0646", "View contract KPIs and alerts", "internal", false),
  /* دیدن سنجه با ثبت‌کردنش یکی نیست: عکس دوره‌ای مبنای تحلیل روند است
   * و چون upsert روی همان دورهٔ قبلی می‌نشیند، ثبت دوباره یعنی
   * بازنویسی تاریخچه. طرف بیرونی — مشاور و کارفرما — تابلو را
   * می‌بیند ولی حافظهٔ آن را نمی‌نویسد. */
  P("cnt.kpi.snapshot", "d14", "\u062B\u0628\u062A \u0639\u06A9\u0633 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC \u0633\u0646\u062C\u0647\u200C\u0647\u0627", "Record contract KPI snapshot", "internal", false),
  /* تنظیم آستانهٔ هشدار اما نوشتنی و حساس است: کسی که می‌تواند
   * آستانه را جابه‌جا کند، می‌تواند هشدار را خاموش کند. */
  P("cnt.alertrule.manage", "d14", "\u062A\u0646\u0638\u06CC\u0645 \u0622\u0633\u062A\u0627\u0646\u0647\u0654 \u0647\u0634\u062F\u0627\u0631 \u067E\u06CC\u0645\u0627\u0646", "Configure contract alert thresholds", "restricted", true),
  /* پل مالی (G-03). دیدن تطبیق دو دفتر با انجام ارسال یکی نیست:
   * اولی کنترل است و باید مخاطب گسترده داشته باشد، دومی دفتر مالی
   * پروژه را تغییر می‌دهد. */
  P("cnt.fin.view", "d14", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u0637\u0628\u06CC\u0642 \u067E\u06CC\u0645\u0627\u0646 \u0628\u0627 \u0645\u0627\u0644\u06CC", "View contract-finance reconciliation", "internal", false),
  /* ارسال صورت‌وضعیت به حساب هزینه — تنها جای ماژول پیمان که عدد را
   * در دفتر مالی می‌نشاند. تهیه‌کنندهٔ صورت‌وضعیت نباید همان کسی باشد
   * که آن را در دفتر می‌نشاند (SOD-15). */
  P("cnt.fin.post", "d14", "\u0627\u0631\u0633\u0627\u0644 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0628\u0647 \u0645\u0627\u0644\u06CC", "Post contract IPC to finance", "restricted", true),
  /* گزارش‌های پیمان. تفکیک «دیدن» از «صدور رسمی» عمدی است: نسخهٔ
   * داخلی ابزار کار است، ولی نسخهٔ رسمی سندی است که ممکن است پیوست
   * نامهٔ اداری یا مدرک دعوا شود و امضای سازمان پای آن می‌رود. */
  P("cnt.report.view", "d14", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u06AF\u0632\u0627\u0631\u0634\u200C\u0647\u0627\u06CC \u067E\u06CC\u0645\u0627\u0646", "View contract reports", "internal", false),
  P("cnt.report.issue", "d14", "\u0635\u062F\u0648\u0631 \u0646\u0633\u062E\u0647\u0654 \u0631\u0633\u0645\u06CC \u06AF\u0632\u0627\u0631\u0634 \u067E\u06CC\u0645\u0627\u0646", "Issue official contract report", "restricted", true),
  /* ── d15 راه‌اندازی و تحویل نهایی ── */
  P("com.punch.record", "d15", "\u062B\u0628\u062A \u0648 \u0628\u0633\u062A\u0646 \u0646\u0642\u0635 \u0641\u0647\u0631\u0633\u062A \u062A\u062D\u0648\u06CC\u0644", "Record punch list item", "internal", true),
  P("com.certificate.view", "d15", "\u0645\u0634\u0627\u0647\u062F\u0647 \u06AF\u0648\u0627\u0647\u06CC \u062A\u062D\u0648\u06CC\u0644", "View completion certificate", "internal"),
  /* صدور گواهی تحویل تصمیم کارفرماست و ضمانت‌نامه و سپرده را آزاد
   * می‌کند؛ پس در سطح «سری» و جدا از ثبت نواقص. */
  P("com.certificate.issue", "d15", "\u0635\u062F\u0648\u0631 \u06AF\u0648\u0627\u0647\u06CC \u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A \u0648 \u0642\u0637\u0639\u06CC", "Issue completion certificate", "restricted", true),
  /* تفکیک سیستمی ساختار پروژه را تعیین می‌کند و مبنای همهٔ دروازه‌های
   * تحویل است؛ ویرایشش از مشاهده‌اش جدا نگه داشته می‌شود. */
  P("com.system.view", "d15", "\u0645\u0634\u0627\u0647\u062F\u0647 \u062F\u0631\u062E\u062A \u0633\u06CC\u0633\u062A\u0645\u200C\u0647\u0627 \u0648 \u0628\u0631\u0646\u0627\u0645\u0647 \u062A\u062D\u0648\u06CC\u0644", "View systemization tree", "internal"),
  P("com.system.edit", "d15", "\u062A\u0639\u0631\u06CC\u0641 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0641\u06A9\u06CC\u06A9 \u0633\u06CC\u0633\u062A\u0645\u06CC \u0648 \u0645\u0631\u0632\u0628\u0646\u062F\u06CC", "Edit systemization and boundaries", "confidential", true),
  /* تاریخ هدف دروازه تعهد زمانی به کارفرماست و مبنای محاسبهٔ لغزش و ادعا؛
   * پس در سطح بالاتر از ویرایش ساختار. */
  P("com.milestone.manage", "d15", "\u062A\u0639\u06CC\u06CC\u0646 \u062A\u0627\u0631\u06CC\u062E \u0647\u062F\u0641 \u062F\u0631\u0648\u0627\u0632\u0647\u200C\u0647\u0627\u06CC \u062A\u062D\u0648\u06CC\u0644", "Manage gate milestone targets", "confidential", true),
  /* ثبت نتیجهٔ آزمون کار میدانی است و باید در دسترس تیم اجرا باشد، وگرنه
   * ثبت به گلوگاه دفتر مرکزی می‌افتد و برگه‌ها با تأخیر وارد می‌شوند. */
  P("com.checksheet.record", "d15", "\u062B\u0628\u062A \u0628\u0631\u06AF\u0647 \u0648 \u0646\u062A\u06CC\u062C\u0647 \u0622\u0632\u0645\u0648\u0646", "Record check sheet results", "internal", true),
  /* امضای برگه از ثبت نتیجه جدا نگه داشته می‌شود چون تعهد کیفی است و
   * پیش‌نیاز تکمیل مکانیکی. ولی طبقه‌بندی‌اش «داخلی» است هم‌تراز
   * `qms.inspection.record`: بازرس کیفی که در میدان امضا می‌کند سطح
   * داخلی دارد و اگر این مجوز محرمانه باشد، امضا به دفتر مرکزی می‌افتد
   * و برگه‌ها روی زمین می‌مانند. تفکیک واقعی با خودِ مجوز انجام می‌شود
   * نه با بالا بردن طبقه‌بندی. */
  P("com.checksheet.sign", "d15", "\u0627\u0645\u0636\u0627\u06CC \u0628\u0631\u06AF\u0647 \u0648 \u062A\u0623\u06CC\u06CC\u062F \u0628\u0633\u062A\u0647 \u0622\u0632\u0645\u0648\u0646", "Sign check sheet and clear pack", "internal", true),
  /* ── d16 بهداشت، ایمنی و محیط زیست ── */
  P("hse.permit.view", "d16", "\u0645\u0634\u0627\u0647\u062F\u0647 \u067E\u0631\u0648\u0627\u0646\u0647 \u06A9\u0627\u0631", "View work permits", "internal"),
  /* درخواست پروانه کار میدانی است و باید در دسترس تیم اجرا باشد. */
  P("hse.permit.request", "d16", "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u067E\u0631\u0648\u0627\u0646\u0647 \u06A9\u0627\u0631", "Request work permit", "internal", true),
  /* تأیید از درخواست جدا است: مجری کار نباید مجوز ایمنی همان کار را صادر
   * کند. طبقه‌بندی «داخلی» هم‌تراز com.checksheet.sign چون افسر ایمنی در
   * میدان کار می‌کند؛ محرمانه‌کردن آن صدور پروانه را به دفتر مرکزی می‌برد
   * و کار روی زمین می‌ماند. تفکیک واقعی با خودِ مجوز است نه با طبقه‌بندی. */
  P("hse.permit.approve", "d16", "\u062A\u0623\u06CC\u06CC\u062F \u0648 \u0628\u0633\u062A\u0646 \u067E\u0631\u0648\u0627\u0646\u0647 \u06A9\u0627\u0631", "Approve and close work permit", "internal", true),
  P("hse.jsa.view", "d16", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0631\u06CC\u0633\u06A9 \u0634\u063A\u0644\u06CC", "View job safety analysis", "internal"),
  P("hse.jsa.edit", "d16", "\u062A\u062F\u0648\u06CC\u0646 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0631\u06CC\u0633\u06A9 \u0634\u063A\u0644\u06CC", "Prepare job safety analysis", "internal", true),
  /* تصویب ارزیابی ریسک تعهد فنی است و از تدوین جدا نگه داشته می‌شود. */
  P("hse.jsa.approve", "d16", "\u062A\u0635\u0648\u06CC\u0628 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0631\u06CC\u0633\u06A9 \u0634\u063A\u0644\u06CC", "Approve job safety analysis", "confidential", true),
  P("hse.incident.record", "d16", "\u062B\u0628\u062A \u0631\u0648\u06CC\u062F\u0627\u062F \u0627\u06CC\u0645\u0646\u06CC", "Record safety incident", "internal", true),
  /* بستن رویداد نیازمند پذیرش ریشه‌یابی است و از ثبت جدا است. */
  P("hse.incident.close", "d16", "\u0628\u0633\u062A\u0646 \u0631\u0648\u06CC\u062F\u0627\u062F \u0627\u06CC\u0645\u0646\u06CC", "Close safety incident", "confidential", true),
  P("hse.inspection.record", "d16", "\u062B\u0628\u062A \u0628\u0627\u0632\u0631\u0633\u06CC \u0648 \u0622\u0645\u0648\u0632\u0634 \u0627\u06CC\u0645\u0646\u06CC", "Record safety inspection and training", "internal", true),
  /* گازسنجی و ایزولاسیون میدانی‌اند و باید در دسترس تیم اجرا باشند؛
   * درستی‌شان با اسکیما و موتور تضمین می‌شود نه با محدودکردن ثبت. */
  P("hse.permit.gastest", "d16", "\u062B\u0628\u062A \u06AF\u0627\u0632\u0633\u0646\u062C\u06CC", "Record gas test", "internal", true),
  P("hse.permit.isolation", "d16", "\u062B\u0628\u062A \u0648 \u0628\u0631\u062F\u0627\u0634\u062A\u0646 \u0627\u06CC\u0632\u0648\u0644\u0627\u0633\u06CC\u0648\u0646", "Record and remove isolation", "internal", true),
  /* امضا از تأیید نهایی جداست: سه سطح امضا می‌کنند، صدور یک اقدام است. */
  P("hse.permit.sign", "d16", "\u0627\u0645\u0636\u0627\u06CC \u067E\u0631\u0648\u0627\u0646\u0647 \u06A9\u0627\u0631", "Sign work permit", "internal", true),
  /* تعلیق و ازسرگیری اقدام کنترلی است و ردپای مستقل می‌خواهد. */
  P("hse.permit.suspend", "d16", "\u062A\u0639\u0644\u06CC\u0642 \u0648 \u0627\u0632\u0633\u0631\u06AF\u06CC\u0631\u06CC \u067E\u0631\u0648\u0627\u0646\u0647", "Suspend and resume permit", "internal", true),
  /* تحقیق حادثه داده‌های حساس فردی و مبنای ادعای بیمه دارد. */
  P("hse.investigation.manage", "d16", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u062A\u062D\u0642\u06CC\u0642 \u062D\u0627\u062F\u062B\u0647", "Manage incident investigation", "confidential", true),
  /* تأیید تحقیق از انجامش جداست — تفکیک وظیفه در موتور هم اعمال می‌شود. */
  P("hse.investigation.approve", "d16", "\u062A\u0623\u06CC\u06CC\u062F \u062A\u062D\u0642\u06CC\u0642 \u062D\u0627\u062F\u062B\u0647", "Approve incident investigation", "confidential", true),
  P("hse.capa.manage", "d16", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC \u0648 \u067E\u06CC\u0634\u06AF\u06CC\u0631\u0627\u0646\u0647", "Manage CAPA actions", "internal", true),
  /* راستی‌آزمایی اثربخشی باید به‌دست کسی جز مجری باشد. */
  P("hse.capa.verify", "d16", "\u0631\u0627\u0633\u062A\u06CC\u200C\u0622\u0632\u0645\u0627\u06CC\u06CC \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC", "Verify CAPA effectiveness", "confidential", true),
  P("hse.manhour.record", "d16", "\u062B\u0628\u062A \u0646\u0641\u0631\u0633\u0627\u0639\u062A \u0627\u06CC\u0645\u0646\u06CC", "Record HSE man-hours", "internal", true),
  P("hse.inspection.conduct", "d16", "\u0627\u0646\u062C\u0627\u0645 \u0628\u0627\u0632\u0631\u0633\u06CC \u0627\u06CC\u0645\u0646\u06CC", "Conduct HSE inspection", "internal", true),
  P("hse.finding.close", "d16", "\u0628\u0633\u062A\u0646 \u06CC\u0627\u0641\u062A\u0647\u0654 \u0628\u0627\u0632\u0631\u0633\u06CC", "Close inspection finding", "internal", true),
  /* خواندن از صدور جدا شد: نقش آزادکننده (تضمین کیفیت) و مدیر پروژه
   * باید فهرست تخلفات و دستورهای توقف کار را ببینند بدون آنکه اختیار
   * صدور بگیرند. پیش از این، تنها دارندهٔ مجوز آزادسازی حتی نمی‌توانست
   * تخلفی را که قرار بود آزاد کند فهرست کند. */
  P("hse.violation.view", "d16", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u062E\u0644\u0641 \u0648 \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631", "View violations and stop-work", "internal", true),
  /* صدور تخلف اهرم اجرایی است؛ اثر مالی (جریمه) و قراردادی دارد. */
  P("hse.violation.issue", "d16", "\u0635\u062F\u0648\u0631 \u062A\u062E\u0644\u0641 \u0627\u06CC\u0645\u0646\u06CC", "Issue HSE violation", "internal", true),
  /* توقف کار جدی‌ترین اختیار ماژول: کار را از حرکت می‌اندازد. */
  P("hse.violation.stopwork", "d16", "\u0635\u062F\u0648\u0631 \u062F\u0633\u062A\u0648\u0631 \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631", "Issue stop-work order", "confidential", true),
  /* آزادسازی باید نزد نقشی باشد که خودش تخلف را صادر نکرده است. */
  P("hse.violation.release", "d16", "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u062A\u062E\u0644\u0641 \u0648 \u0631\u0641\u0639 \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631", "Release violation and lift stop-work", "confidential", true),
  /* ── d16 آموزش، بهداشت شغلی و محیط‌زیست (زیرماژول ۰۸٫۵) ── */
  P("hse.training.manage", "d16", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u062C\u0644\u0633\u0627\u062A \u0622\u0645\u0648\u0632\u0634 \u0627\u06CC\u0645\u0646\u06CC", "Manage HSE training sessions", "internal", true),
  P("hse.training.view", "d16", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0633\u0648\u0627\u0628\u0642 \u0622\u0645\u0648\u0632\u0634", "View training records", "internal"),
  P("hse.ppe.issue", "d16", "\u062A\u062D\u0648\u06CC\u0644 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A \u062D\u0641\u0627\u0638\u062A \u0641\u0631\u062F\u06CC", "Issue PPE", "internal", true),
  /* خواندن از نوشتن جدا شد: سرپرست کارگاه باید بداند تیمش هارنس
   * دارد یا نه، بی‌آنکه بتواند تحویل ثبت کند. */
  P("hse.ppe.view", "d16", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0645\u0648\u062C\u0648\u062F\u06CC \u0648 \u062A\u062D\u0648\u06CC\u0644 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A", "View PPE issuances", "internal"),
  /* دادهٔ پزشکی محرمانه است: نتیجهٔ معاینه فراتر از «مجاز/غیرمجاز»
   * نباید در دسترس سرپرست اجرایی باشد. */
  P("hse.health.record", "d16", "\u062B\u0628\u062A \u0645\u0639\u0627\u06CC\u0646\u0647\u0654 \u0637\u0628 \u06A9\u0627\u0631", "Record occupational health exam", "restricted", true),
  P("hse.health.view", "d16", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0648\u0636\u0639\u06CC\u062A \u0633\u0644\u0627\u0645\u062A \u0634\u063A\u0644\u06CC", "View occupational fitness", "confidential"),
  /* دروازهٔ ورود فقط نتیجهٔ سه‌گانه را می‌دهد نه جزئیات پزشکی، پس
   * سطحش پایین‌تر از خواندن پرونده است. */
  P("hse.clearance.check", "d16", "\u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0645\u062C\u0648\u0632 \u0648\u0631\u0648\u062F \u0641\u0631\u062F \u0628\u0647 \u06A9\u0627\u0631\u06AF\u0627\u0647", "Check person site clearance", "internal"),
  P("hse.waste.record", "d16", "\u062B\u0628\u062A \u0633\u06CC\u0627\u0647\u0647\u0654 \u067E\u0633\u0645\u0627\u0646\u062F", "Record waste log", "internal", true),
  P("hse.env.record", "d16", "\u062B\u0628\u062A \u067E\u0627\u06CC\u0634 \u0632\u06CC\u0633\u062A\u200C\u0645\u062D\u06CC\u0637\u06CC", "Record environmental monitoring", "internal", true),
  P("hse.env.view", "d16", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u06AF\u0632\u0627\u0631\u0634 \u0632\u06CC\u0633\u062A\u200C\u0645\u062D\u06CC\u0637\u06CC", "View environmental report", "internal"),
  /* ── d16 شاخص، نمره و هشدار زودهنگام (زیرماژول ۰۸٫۶) ── */
  P("hse.metrics.view", "d16", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0634\u0627\u062E\u0635 \u0648 \u0646\u0645\u0631\u0647\u0654 \u0627\u06CC\u0645\u0646\u06CC", "View HSE metrics and score", "internal"),
  /* انتشار عکس شاخص، عدد را برای دوره تثبیت می‌کند و مبنای گزارش به
   * کارفرما می‌شود؛ پس فقط دست نقشی که پاسخ‌گوی آن گزارش است. */
  P("hse.metrics.publish", "d16", "\u0627\u0646\u062A\u0634\u0627\u0631 \u0639\u06A9\u0633 \u0634\u0627\u062E\u0635 \u062F\u0648\u0631\u0647", "Publish period metric snapshot", "confidential", true),
  P("hse.alert.configure", "d16", "\u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC \u0648 \u0633\u06A9\u0648\u062A \u0642\u0648\u0627\u0639\u062F \u0647\u0634\u062F\u0627\u0631", "Configure and mute alert rules", "confidential", true),
  /* ── d5 مالی و هزینه ── */
  P("fin.cost.view", "d5", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0647\u0632\u06CC\u0646\u0647", "View cost", "confidential"),
  P("fin.budget.edit", "d5", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0628\u0648\u062F\u062C\u0647", "Edit budget", "restricted", true),
  /* LIVE-1: میز کار هزینه و تأمین روی دادهٔ ماندگار. */
  P("fin.cost.post", "d5", "\u062B\u0628\u062A \u0647\u0632\u06CC\u0646\u0647\u0654 \u0648\u0627\u0642\u0639\u06CC \u0648 \u0645\u0637\u0627\u0644\u0628\u0627\u062A", "Post actual cost & receivables", "confidential", true),
  P("fin.procure.edit", "d5", "\u062B\u0628\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A/\u0633\u0641\u0627\u0631\u0634 \u062E\u0631\u06CC\u062F \u0648 \u0645\u0648\u062C\u0648\u062F\u06CC", "Edit PR/PO & stock", "confidential", true),
  P("fin.procure.approve", "d5", "\u062A\u0623\u06CC\u06CC\u062F \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062E\u0631\u06CC\u062F", "Approve purchase requisition", "restricted", true),
  P("fin.reserve.draw", "d5", "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0630\u062E\u06CC\u0631\u0647\u0654 \u0627\u062D\u062A\u06CC\u0627\u0637\u06CC", "Release contingency reserve", "restricted", true),
  P("fin.ipc.prepare", "d5", "\u062A\u0647\u06CC\u0647 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A", "Prepare payment certificate", "confidential", true),
  P("fin.ipc.approve", "d5", "\u062A\u0623\u06CC\u06CC\u062F \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A", "Approve payment certificate", "restricted", true),
  P("fin.rate.view", "d5", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0646\u0631\u062E \u0648 \u0642\u06CC\u0645\u062A \u0648\u0627\u062D\u062F", "View unit rates", "restricted"),
  P("fin.invoice.issue", "d5", "\u0635\u062F\u0648\u0631 \u0641\u0627\u06A9\u062A\u0648\u0631", "Issue invoice", "restricted", true),
  /* ── d5 خرید و تدارکات — SCM (P5) ── */
  P("scm.vendor.view", "d5", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0641\u0631\u0648\u0634\u0646\u062F\u06AF\u0627\u0646", "View vendors", "internal"),
  P("scm.vendor.manage", "d5", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0641\u0631\u0648\u0634\u0646\u062F\u06AF\u0627\u0646 \u0648 AVL", "Manage vendors & AVL", "confidential", true),
  P("scm.package.view", "d5", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0628\u0633\u062A\u0647 \u062E\u0631\u06CC\u062F", "View procurement packages", "internal"),
  P("scm.package.edit", "d5", "\u0627\u06CC\u062C\u0627\u062F \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0628\u0633\u062A\u0647 \u062E\u0631\u06CC\u062F \u0648 \u0627\u0633\u062A\u0639\u0644\u0627\u0645", "Edit procurement & inquiry packages", "confidential", true),
  P("scm.bidder.view", "d5", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0645\u0646\u0627\u0642\u0635\u0647\u200C\u06AF\u0631\u0627\u0646", "View bidders", "internal"),
  P("scm.bidder.manage", "d5", "\u0645\u062F\u06CC\u0631\u06CC\u062A LBL/SBL \u0648 \u062F\u0639\u0648\u062A\u200C\u0646\u0627\u0645\u0647", "Manage LBL/SBL & invitations", "confidential", true),
  P("scm.mr.view", "d5", "\u0645\u0634\u0627\u0647\u062F\u0647 \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A MR", "View MR changes", "internal"),
  P("scm.mr.manage", "d5", "\u0645\u062F\u06CC\u0631\u06CC\u062A MR \u0648 \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A", "Manage MR & changes", "confidential", true),
  P("scm.mrr.view", "d5", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0631\u0633\u06CC\u062F \u0645\u0648\u0627\u062F", "View material receiving", "internal"),
  P("scm.mrr.post", "d5", "\u062B\u0628\u062A \u0631\u0633\u06CC\u062F \u0645\u0648\u0627\u062F \u0648 OPI", "Post MRR & OPI", "confidential", true),
  /* ── d2+d8 ساخت و اجرا — CPMS (P7) ── */
  P("cpm.workarea.view", "d2", "\u0645\u0634\u0627\u0647\u062F\u0647 \u062D\u0648\u0632\u0647\u0654 \u06A9\u0627\u0631\u06CC \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631", "View contractor work areas", "internal"),
  P("cpm.workarea.edit", "d2", "\u062A\u062E\u0635\u06CC\u0635 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062D\u0648\u0632\u0647\u0654 \u06A9\u0627\u0631\u06CC \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631", "Assign & edit contractor work areas", "confidential", true),
  P("cpm.dpr.view", "d2", "\u0645\u0634\u0627\u0647\u062F\u0647 \u06AF\u0632\u0627\u0631\u0634 \u0631\u0648\u0632\u0627\u0646\u0647\u0654 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631", "View contractor daily reports", "internal"),
  P("cpm.dpr.record", "d2", "\u062B\u0628\u062A \u06AF\u0632\u0627\u0631\u0634 \u0631\u0648\u0632\u0627\u0646\u0647\u0654 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631", "Record contractor daily report", "internal", true),
  P("cpm.dpr.approve", "d2", "\u062A\u0623\u06CC\u06CC\u062F \u06AF\u0632\u0627\u0631\u0634 \u0631\u0648\u0632\u0627\u0646\u0647\u0654 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631", "Approve contractor daily report", "confidential", true),
  P("cpm.discipline.view", "d2", "\u0645\u0634\u0627\u0647\u062F\u0647 \u06AF\u0632\u0627\u0631\u0634 \u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646\u06CC", "View discipline reports", "internal"),
  P(
    "cpm.discipline.record",
    "d2",
    "\u062B\u0628\u062A \u06AF\u0632\u0627\u0631\u0634 \u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646\u06CC (Fit-up/Weld/NDT/\u2026)",
    "Record discipline reports",
    "internal",
    true
  ),
  P("cpm.discipline.approve", "d2", "\u062A\u0623\u06CC\u06CC\u062F \u06AF\u0632\u0627\u0631\u0634 \u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646\u06CC", "Approve discipline reports", "confidential", true),
  P("cpm.inspection.view", "d8", "\u0645\u0634\u0627\u0647\u062F\u0647 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0628\u0627\u0632\u0631\u0633\u06CC", "View inspection requests", "internal"),
  P("cpm.inspection.request", "d8", "\u062B\u0628\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0628\u0627\u0632\u0631\u0633\u06CC (IR/RFI)", "Raise inspection request", "internal", true),
  P("cpm.inspection.release", "d8", "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC/\u0631\u062F \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0628\u0627\u0632\u0631\u0633\u06CC \u062A\u0648\u0633\u0637 QC", "QC release/reject inspection request", "internal", true),
  /* P8/PMO: دفتر مدیریت پروژه — منشور (تحریر/تصویب)، فرم‌ساز (طراحی/ثبت/تصویب)
   * و کارت سلامت (ثبت/تصویب). تحریر و تصویب منشور دو مجوز جدا هستند تا
   * SOD-30 قابل اعمال بماند. */
  P("pmo.charter.view", "d6", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0645\u0646\u0634\u0648\u0631 \u067E\u0631\u0648\u0698\u0647", "View project charter", "internal"),
  P("pmo.charter.edit", "d6", "\u062A\u062D\u0631\u06CC\u0631 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0645\u0646\u0634\u0648\u0631 \u067E\u0631\u0648\u0698\u0647", "Draft & edit project charter", "confidential", true),
  P("pmo.charter.approve", "d6", "\u062A\u0635\u0648\u06CC\u0628 \u0645\u0646\u0634\u0648\u0631 \u067E\u0631\u0648\u0698\u0647", "Approve project charter", "restricted", true),
  P("pmo.form.view", "d6", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0641\u0631\u0645\u200C\u0647\u0627\u06CC \u0645\u0635\u0648\u0628", "View approved forms", "internal"),
  P("pmo.form.manage", "d6", "\u0637\u0631\u0627\u062D\u06CC\u060C \u0627\u0646\u062A\u0634\u0627\u0631 \u0648 \u0628\u0627\u0632\u0646\u0634\u0633\u062A\u06AF\u06CC \u0641\u0631\u0645", "Design, publish & retire forms", "confidential", true),
  P("pmo.form.submit", "d6", "\u062A\u06A9\u0645\u06CC\u0644 \u0648 \u0627\u0631\u0633\u0627\u0644 \u0631\u06A9\u0648\u0631\u062F \u0641\u0631\u0645", "Fill & submit form entries", "internal", true),
  P("pmo.form.approve", "d6", "\u062A\u0623\u06CC\u06CC\u062F \u0648 \u0628\u0631\u06AF\u0634\u062A \u0631\u06A9\u0648\u0631\u062F \u0641\u0631\u0645", "Approve & return form entries", "confidential", true),
  P("pmo.health.view", "d6", "\u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0627\u0631\u062A \u0633\u0644\u0627\u0645\u062A \u067E\u0631\u0648\u0698\u0647", "View project health card", "internal"),
  P("pmo.health.record", "d6", "\u062B\u0628\u062A \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0633\u0644\u0627\u0645\u062A \u067E\u0631\u0648\u0698\u0647", "Record project health assessment", "confidential", true),
  P("pmo.health.approve", "d6", "\u062A\u0635\u0648\u06CC\u0628 \u06A9\u0627\u0631\u062A \u0633\u0644\u0627\u0645\u062A \u067E\u0631\u0648\u0698\u0647", "Approve project health card", "restricted", true),
  /* P8/CNT: قالب‌پذیری صورت‌وضعیت. تهیه/بازبینی/تصویب صورت‌وضعیت از قبل
   * مجوز مستقل دارند (cnt.ipc.prepare / cnt.ipc.review / cnt.ipc.approve —
   * SOD-11)؛ اینجا فقط تعریف قالب اضافه می‌شود و همان‌ها بازاستفاده می‌شوند. */
  P("cnt.ipctemplate.edit", "d14", "\u062A\u0639\u0631\u06CC\u0641 \u0648 \u0627\u0646\u062A\u0634\u0627\u0631 \u0642\u0627\u0644\u0628 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A", "Define & publish IPC templates", "confidential", true),
  /* P8/GOV-1: ویرایش ساختار فرایند برای همهٔ حوزه‌ها (پیش‌تر فقط نمایش بود). */
  P("gov.process.edit", "d6", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0633\u0627\u062E\u062A\u0627\u0631 \u0641\u0631\u0627\u06CC\u0646\u062F \u062D\u0648\u0632\u0647\u200C\u0647\u0627", "Edit domain process structure", "confidential", true),
  /* ── d6 حاکمیت ── */
  P("gov.process.view", "d6", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0641\u0631\u0622\u06CC\u0646\u062F\u0647\u0627", "View processes", "internal"),
  P("gov.gate.review", "d6", "\u0628\u0627\u0632\u0628\u06CC\u0646\u06CC \u062F\u0631\u0648\u0627\u0632\u0647 \u0645\u0631\u062D\u0644\u0647", "Review stage gate", "confidential", true),
  P("gov.gate.approve", "d6", "\u062A\u0635\u0648\u06CC\u0628 \u062F\u0631\u0648\u0627\u0632\u0647 \u0645\u0631\u062D\u0644\u0647", "Approve stage gate", "restricted", true),
  P("gov.owner.assign", "d6", "\u0627\u0646\u062A\u0635\u0627\u0628 \u0645\u0627\u0644\u06A9 \u062F\u0627\u062F\u0647", "Assign data owner", "confidential", true),
  /* ── d8 کیفیت ── */
  P("qms.itp.view", "d8", "\u0645\u0634\u0627\u0647\u062F\u0647 ITP", "View ITP", "internal"),
  P("qms.inspection.record", "d8", "\u062B\u0628\u062A \u0646\u062A\u06CC\u062C\u0647 \u0628\u0627\u0632\u0631\u0633\u06CC", "Record inspection", "internal", true),
  P("qms.ncr.raise", "d8", "\u0635\u062F\u0648\u0631 \u0639\u062F\u0645 \u0627\u0646\u0637\u0628\u0627\u0642", "Raise NCR", "confidential", true),
  P("qms.ncr.close", "d8", "\u0628\u0633\u062A\u0646 \u0639\u062F\u0645 \u0627\u0646\u0637\u0628\u0627\u0642", "Close NCR", "confidential", true),
  P("qms.audit.conduct", "d8", "\u0627\u062C\u0631\u0627\u06CC \u0645\u0645\u06CC\u0632\u06CC \u06A9\u06CC\u0641\u06CC\u062A", "Conduct quality audit", "confidential", true),
  /* LIVE-4: machinery workspace, separate preparation from dispatch approval. */
  P("eqm.workspace.view", "d9", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0646\u0627\u0648\u06AF\u0627\u0646 \u0648 \u0647\u0632\u06CC\u0646\u0647 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A", "View machinery workspace", "confidential"),
  P("eqm.workspace.manage", "d9", "\u062B\u0628\u062A \u0639\u0645\u0644\u06CC\u0627\u062A \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A", "Manage machinery operations", "confidential", true),
  P("eqm.dispatch.approve", "d9", "\u062A\u0635\u0648\u06CC\u0628 \u062F\u06CC\u0633\u067E\u0686", "Approve machinery dispatch", "restricted", true),
  /* ── d10 منابع انسانی ── */
  P("hrm.roster.view", "d10", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0641\u0647\u0631\u0633\u062A \u0646\u06CC\u0631\u0648", "View workforce roster", "internal"),
  P("hrm.timesheet.enter", "d10", "\u062B\u0628\u062A \u062A\u0627\u06CC\u0645\u200C\u0634\u06CC\u062A", "Enter timesheet", "internal"),
  P("hrm.timesheet.approve", "d10", "\u062A\u0623\u06CC\u06CC\u062F \u062A\u0627\u06CC\u0645\u200C\u0634\u06CC\u062A", "Approve timesheet", "confidential", true),
  P("hrm.rate.view", "d10", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0646\u0631\u062E \u062F\u0633\u062A\u0645\u0632\u062F", "View labour rates", "restricted"),
  P("hrm.personal.view", "d10", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0641\u0631\u062F\u06CC", "View personal data", "restricted", true),
  P("hrm.productivity.view", "d10", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0628\u0647\u0631\u0647\u200C\u0648\u0631\u06CC", "View productivity", "confidential"),
  /* زنجیرهٔ تأیید کارکرد (D4). سه گیت جدا تعریف شده‌اند چون سه دست
   * متفاوت امضا می‌کنند: سرپرست حضور را می‌بیند، کیفیت پیشرفت را
   * تطبیق می‌دهد، مدیر پروژه عدد را وارد بهره‌وری و هزینه می‌کند.
   * `hrm.timesheet.approve` میراثی باقی می‌ماند و معنای «تأیید کلی»
   * دارد؛ SOD-04 روی آن سوار است. */
  P("hrm.timesheet.sign", "d10", "\u0627\u0645\u0636\u0627\u06CC \u0633\u0631\u067E\u0631\u0633\u062A \u0628\u0631 \u06A9\u0627\u0631\u06A9\u0631\u062F", "Foreman sign timesheet", "internal", true),
  P("hrm.timesheet.verify", "d10", "\u062A\u0623\u06CC\u06CC\u062F \u06A9\u06CC\u0641\u06CC\u062A \u06A9\u0627\u0631\u06A9\u0631\u062F", "QC verify timesheet", "internal", true),
  P("hrm.timesheet.finalize", "d10", "\u0646\u0647\u0627\u06CC\u06CC\u200C\u0633\u0627\u0632\u06CC \u06A9\u0627\u0631\u06A9\u0631\u062F \u062A\u0648\u0633\u0637 \u0645\u062F\u06CC\u0631 \u067E\u0631\u0648\u0698\u0647", "PM finalize timesheet", "confidential", true),
  /* بستن دوره برگشت‌ناپذیر است و از تأیید تک‌برگه جداست. */
  P("hrm.period.lock", "d10", "\u0628\u0633\u062A\u0646 \u0648 \u0628\u0627\u0632\u06AF\u0634\u0627\u06CC\u06CC \u062F\u0648\u0631\u0647\u0654 \u06A9\u0627\u0631\u06A9\u0631\u062F", "Lock timesheet period", "confidential", true),
  P("hrm.adjustment.raise", "d10", "\u062B\u0628\u062A \u0633\u0646\u062F \u0627\u0635\u0644\u0627\u062D\u06CC \u06A9\u0627\u0631\u06A9\u0631\u062F", "Raise timesheet adjustment", "internal", true),
  P("hrm.adjustment.approve", "d10", "\u062A\u0623\u06CC\u06CC\u062F \u0633\u0646\u062F \u0627\u0635\u0644\u0627\u062D\u06CC \u06A9\u0627\u0631\u06A9\u0631\u062F", "Approve timesheet adjustment", "confidential", true),
  P("hrm.conflict.resolve", "d10", "\u062D\u0644 \u062A\u0639\u0627\u0631\u0636 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC", "Resolve sync conflict", "internal", true),
  /* پایش ناوگان دستگاه‌های میدانی (D9).
   *
   * مجوز جدا از `conflict.resolve` است چون کار متفاوتی است: آن یکی
   * تعارضِ رسیده را حل می‌کند، این یکی می‌بیند کدام دستگاه اصلاً
   * چیزی نفرستاده. دادهٔ نرسیده خطرناک‌تر از دادهٔ متعارض است —
   * تعارض دست‌کم دیده می‌شود.
   *
   * «داخلی» است چون سرپرست کارگاه باید ببیند گوشیِ کدام اکیپ عقب
   * مانده؛ این اطلاعات عملیاتی است نه محرمانه. */
  P("hrm.device.monitor", "d10", "\u067E\u0627\u06CC\u0634 \u062F\u0633\u062A\u06AF\u0627\u0647\u200C\u0647\u0627\u06CC \u0645\u06CC\u062F\u0627\u0646\u06CC", "Monitor field devices", "internal"),
  /* تعریف کارت نرخ ساعتی (D12).
   *
   * `hrm.rate.view` از قبل در خط ۳۱۳ تعریف شده؛ اینجا فقط نوشتن
   * اضافه می‌شود. تفکیک دیدن از نوشتن لازم است چون نرخ، ضریب مستقیم
   * مبلغی است که به دفتر مالی می‌رود. */
  P("hrm.rate.manage", "d10", "\u062A\u0639\u0631\u06CC\u0641 \u0648 \u0628\u0627\u0632\u0646\u06AF\u0631\u06CC \u06A9\u0627\u0631\u062A \u0646\u0631\u062E", "Manage hourly rate card", "restricted", true),
  P("hrm.cost.post", "d10", "\u0627\u0631\u0633\u0627\u0644 \u0647\u0632\u06CC\u0646\u0647\u0654 \u06A9\u0627\u0631\u06A9\u0631\u062F \u0628\u0647 \u0645\u0627\u0644\u06CC", "Post labour cost to finance", "restricted", true),
  /* بهره‌وری و ریشه‌یابی (D5).
   *
   * «محاسبه» از «مشاهده» جدا شده چون اجرای دوبارهٔ محاسبه عدد
   * منتشرشدهٔ دوره را جابه‌جا می‌کند؛ این یک عمل نوشتنی است حتی
   * وقتی هیچ فرمی پر نمی‌شود. */
  P("hrm.productivity.compute", "d10", "\u0627\u062C\u0631\u0627\u06CC \u0645\u062D\u0627\u0633\u0628\u0647\u0654 \u0628\u0647\u0631\u0647\u200C\u0648\u0631\u06CC", "Run productivity computation", "internal", true),
  P("hrm.rca.record", "d10", "\u062B\u0628\u062A \u0639\u0644\u062A \u0627\u0641\u062A \u0628\u0647\u0631\u0647\u200C\u0648\u0631\u06CC", "Record productivity root cause", "internal", true),
  /* تبدیل علت به ادعا اثر قراردادی و مالی دارد، پس سطح سری و دست
   * مدیر پیمان است — نه دست کسی که علت را در کارگاه ثبت کرده. */
  P("hrm.claim.link", "d10", "\u067E\u06CC\u0648\u0646\u062F \u0639\u0644\u062A \u0627\u0641\u062A \u0628\u0647 \u0627\u062F\u0639\u0627", "Link root cause to claim", "restricted", true),
  P("hrm.metric.finalize", "d10", "\u0646\u0647\u0627\u06CC\u06CC\u200C\u0633\u0627\u0632\u06CC \u0645\u062A\u0631\u06CC\u06A9 \u062F\u0648\u0631\u0647", "Finalize period metrics", "confidential", true),
  /* اکیپ و نیروی پیمانکاری (D6).
   *
   * دیدن اکیپ از ساختن آن جدا است چون تابلوی نرخ استفاده را همه
   * می‌بینند ولی ترکیب اکیپ را فقط کسی می‌چیند که پای کار است. */
  P("hrm.crew.view", "d10", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0627\u06A9\u06CC\u067E \u0648 \u0646\u0631\u062E \u0627\u0633\u062A\u0641\u0627\u062F\u0647", "View crews and utilisation", "internal"),
  P("hrm.crew.manage", "d10", "\u062A\u0631\u06A9\u06CC\u0628 \u0627\u06A9\u06CC\u067E \u0648 \u0639\u0636\u0648\u06CC\u062A", "Manage crew composition", "internal", true),
  /* انحلال اکیپ برگشت‌ناپذیر است و سابقهٔ کارکرد را از تخصیص جاری
   * جدا می‌کند؛ همان جنس اقتدار قفل دوره، پس یک پله بالاتر از ترکیب. */
  P("hrm.crew.disband", "d10", "\u0627\u0646\u062D\u0644\u0627\u0644 \u0627\u06A9\u06CC\u067E", "Disband crew", "confidential", true),
  /* قرارداد نیروی پیمانکاری دو چهره دارد: چهرهٔ کارگاهی (چند نفر
   * امروز آمدند) و چهرهٔ تجاری (نرخ توافقی هر رسته). این دو با دو
   * سطح دسترسی متفاوت جدا شده‌اند تا سرپرست کارگاه بتواند حضور را
   * ثبت کند بی‌آنکه نرخ قرارداد را ببیند. */
  P("hrm.sub.view", "d10", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0646\u06CC\u0631\u0648\u06CC \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631\u06CC", "View labour subcontract", "confidential"),
  P("hrm.sub.manage", "d10", "\u062B\u0628\u062A \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0646\u06CC\u0631\u0648\u06CC \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631\u06CC", "Manage labour subcontract", "restricted", true),
  P("hrm.sub.record", "d10", "\u062B\u0628\u062A \u062D\u0636\u0648\u0631 \u06AF\u0631\u0648\u0647\u06CC \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631\u06CC", "Record subcontractor attendance", "internal", true),
  P("hrm.sub.verify", "d10", "\u062A\u0623\u06CC\u06CC\u062F \u062D\u0636\u0648\u0631 \u06AF\u0631\u0648\u0647\u06CC \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631\u06CC", "Verify subcontractor attendance", "internal", true),
  P("hrm.subipc.prepare", "d10", "\u062A\u0647\u06CC\u0647\u0654 \u0635\u0648\u0631\u062A\u200C\u06A9\u0627\u0631\u06A9\u0631\u062F \u0646\u06CC\u0631\u0648\u06CC \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631\u06CC", "Prepare labour IPC", "confidential", true),
  P("hrm.subipc.approve", "d10", "\u062A\u0623\u06CC\u06CC\u062F \u0635\u0648\u0631\u062A\u200C\u06A9\u0627\u0631\u06A9\u0631\u062F \u0646\u06CC\u0631\u0648\u06CC \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631\u06CC", "Approve labour IPC", "restricted", true),
  /* پذیرش، احکام و انطباق (D7).
   *
   * «مشاهدهٔ پرونده» از «مشاهدهٔ اطلاعات فردی» جدا است: سرپرست کارگاه
   * باید بداند نفرش مدرک معتبر دارد یا نه، بی‌آنکه کد ملی و شمارهٔ
   * تماس او را ببیند — آن پشت `hrm.personal.view` سری می‌ماند. */
  P("hrm.person.view", "d10", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u067E\u0631\u0648\u0646\u062F\u0647\u0654 \u067E\u0631\u0633\u0646\u0644\u06CC", "View personnel file", "internal"),
  P("hrm.person.manage", "d10", "\u062B\u0628\u062A \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u067E\u0631\u0648\u0646\u062F\u0647\u0654 \u067E\u0631\u0633\u0646\u0644\u06CC", "Manage personnel file", "confidential", true),
  /* فعال کردن نفر یعنی «حق ثبت ساعت»؛ این تنها دروازه‌ای است که
   * تصمیم می‌گیرد چه کسی وارد چرخهٔ هزینه می‌شود. */
  P("hrm.person.activate", "d10", "\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u0646\u0641\u0631 \u067E\u0633 \u0627\u0632 \u06AF\u06CC\u062A\u200C\u0647\u0627", "Activate person after gates", "confidential", true),
  P("hrm.person.demobilize", "d10", "\u062A\u062E\u0644\u06CC\u0647 \u0648 \u0642\u0637\u0639 \u0647\u0645\u06A9\u0627\u0631\u06CC \u0646\u06CC\u0631\u0648", "Demobilize person", "confidential", true),
  /* بارگذاری مدرک از تأیید صحت آن جدا است: کارگاه اسکن می‌فرستد،
   * منابع انسانی اصالت را تأیید می‌کند — SOD-24. */
  P("hrm.doc.upload", "d10", "\u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u0645\u062F\u0631\u06A9 \u067E\u0631\u0633\u0646\u0644\u06CC", "Upload personnel document", "internal", true),
  P("hrm.doc.verify", "d10", "\u062A\u0623\u06CC\u06CC\u062F \u0627\u0635\u0627\u0644\u062A \u0645\u062F\u0631\u06A9 \u067E\u0631\u0633\u0646\u0644\u06CC", "Verify personnel document", "confidential", true),
  P("hrm.skill.assess", "d10", "\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0645\u0647\u0627\u0631\u062A \u0648 \u0635\u0644\u0627\u062D\u06CC\u062A", "Assess skills", "internal", true),
  P("hrm.mob.request", "d10", "\u062B\u0628\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u062C\u0647\u06CC\u0632 \u0646\u06CC\u0631\u0648", "Raise mobilization request", "internal", true),
  P("hrm.mob.approve", "d10", "\u062A\u0623\u06CC\u06CC\u062F \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u062C\u0647\u06CC\u0632 \u0646\u06CC\u0631\u0648", "Approve mobilization request", "confidential", true),
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
  P("hrm.analytics.view", "d10", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u062D\u0644\u06CC\u0644 \u0648 \u0647\u06CC\u0633\u062A\u0648\u06AF\u0631\u0627\u0645 \u0646\u06CC\u0631\u0648", "View workforce analytics", "internal"),
  P("hrm.analytics.export", "d10", "\u0635\u062F\u0648\u0631 \u06AF\u0632\u0627\u0631\u0634 \u0631\u0633\u0645\u06CC \u0646\u06CC\u0631\u0648", "Export official workforce report", "confidential", true),
  P("hrm.plan.baseline", "d10", "\u062B\u0628\u062A \u0648 \u0628\u0627\u0632\u0646\u06AF\u0631\u06CC \u0628\u0631\u0646\u0627\u0645\u0647\u0654 \u0645\u0628\u0646\u0627\u06CC \u0646\u06CC\u0631\u0648", "Set manpower baseline plan", "confidential", true),
  P("hrm.rate.calibrate", "d10", "\u06A9\u0627\u0644\u06CC\u0628\u0631\u0627\u0633\u06CC\u0648\u0646 \u0646\u0631\u062E \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F", "Calibrate standard rates", "confidential", true),
  /* ── d11 ارتباطات و دانش ── */
  P("ckm.letter.view", "d11", "\u0645\u0634\u0627\u0647\u062F\u0647 \u0645\u06A9\u0627\u062A\u0628\u0627\u062A", "View correspondence", "confidential"),
  P("ckm.letter.draft", "d11", "\u062A\u0646\u0638\u06CC\u0645 \u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633 \u0646\u0627\u0645\u0647", "Draft letter", "confidential"),
  P("ckm.letter.sign", "d11", "\u0627\u0645\u0636\u0627 \u0648 \u0635\u062F\u0648\u0631 \u0646\u0627\u0645\u0647", "Sign & issue letter", "restricted", true),
  P("ckm.meeting.record", "d11", "\u062B\u0628\u062A \u0635\u0648\u0631\u062A\u200C\u062C\u0644\u0633\u0647", "Record meeting minutes", "internal"),
  P("ckm.lesson.publish", "d11", "\u0627\u0646\u062A\u0634\u0627\u0631 \u062F\u0631\u0633 \u0622\u0645\u0648\u062E\u062A\u0647", "Publish lesson learned", "internal"),
  /* LIVE-2: ثبت ذی‌نفعان و قواعد اطلاع‌رسانی دیگر در حافظهٔ مرورگر نیست. */
  P("ckm.stakeholder.edit", "d11", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062B\u0628\u062A \u0630\u06CC\u200C\u0646\u0641\u0639\u0627\u0646", "Edit stakeholder register", "internal"),
  P("ckm.notify.manage", "d11", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0642\u0648\u0627\u0639\u062F \u0627\u0637\u0644\u0627\u0639\u200C\u0631\u0633\u0627\u0646\u06CC", "Manage notification rules", "internal"),
  /* ── گزارش‌ساز ── */
  P("report.internal.generate", "core", "\u062A\u0648\u0644\u06CC\u062F \u06AF\u0632\u0627\u0631\u0634 \u062F\u0627\u062E\u0644\u06CC", "Generate internal report", "internal"),
  P("report.official.publish", "core", "\u0627\u0646\u062A\u0634\u0627\u0631 \u06AF\u0632\u0627\u0631\u0634 \u0627\u0628\u0644\u0627\u063A\u06CC", "Publish official report", "restricted", true),
  P("report.export.bulk", "core", "\u062E\u0631\u0648\u062C\u06CC \u0627\u0646\u0628\u0648\u0647 \u062F\u0627\u062F\u0647", "Bulk data export", "restricted", true),
  /* P9/RPT-1: گزارش‌ساز سفارشی. مشخصات قالب سند حاکمیتی است: تحریر و انتشار
   * جدا شده‌اند (SOD-31) و هر مجموعه‌داده مجوز پایهٔ خودش را می‌خواهد. */
  P("report.custom.view", "d3", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u06AF\u0632\u0627\u0631\u0634\u200C\u0633\u0627\u0632 \u0633\u0641\u0627\u0631\u0634\u06CC", "View custom report builder", "internal"),
  P("report.custom.run", "d3", "\u0627\u062C\u0631\u0627\u06CC \u06AF\u0632\u0627\u0631\u0634 \u0633\u0641\u0627\u0631\u0634\u06CC \u0631\u0648\u06CC \u062F\u0627\u062F\u0647\u0654 \u0645\u062C\u0627\u0632", "Run custom report on authorized data", "internal"),
  P("report.custom.edit", "d3", "\u0633\u0627\u062E\u062A \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0642\u0627\u0644\u0628 \u06AF\u0632\u0627\u0631\u0634 \u0633\u0641\u0627\u0631\u0634\u06CC", "Author custom report template", "confidential", true),
  P("report.custom.publish", "d3", "\u0627\u0646\u062A\u0634\u0627\u0631 \u0648 \u0628\u0627\u0632\u0646\u0634\u0633\u062A\u06AF\u06CC \u0642\u0627\u0644\u0628 \u06AF\u0632\u0627\u0631\u0634", "Publish/retire custom report template", "confidential", true),
  /* P9/ITG-1..3: خروجی و نوشتن در سامانهٔ بیرونی. هر چهار مجوز جدا‌اند تا
   * «خروجی XER» با «ارسال به P6» یا «همگام‌سازی تقویم» یکی گرفته نشود. */
  P("itg.connector.view", "core", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0648\u0636\u0639\u06CC\u062A \u0627\u062A\u0635\u0627\u0644\u200C\u062F\u0647\u0646\u062F\u0647\u200C\u0647\u0627 \u0648 \u062F\u0641\u062A\u0631 \u0627\u062C\u0631\u0627", "View connectors & run ledger", "internal"),
  P("itg.export.run", "core", "\u0633\u0627\u062E\u062A \u062E\u0631\u0648\u062C\u06CC XER \u0648 XML \u067E\u0631\u0648\u0698\u0647", "Run XER / Project XML export", "confidential", true),
  P("itg.primavera.push", "core", "\u0627\u0631\u0633\u0627\u0644 \u0641\u0639\u0627\u0644\u06CC\u062A\u200C\u0647\u0627 \u0628\u0647 API \u067E\u0631\u06CC\u0645\u0627\u0648\u0631\u0627", "Push activities to Primavera API", "confidential", true),
  P("itg.calendar.sync", "core", "\u062E\u0631\u0648\u062C\u06CC \u0648 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u062A\u0642\u0648\u06CC\u0645 Outlook/Exchange", "Outlook/Exchange calendar export & sync", "confidential", true),
  /* ── d17 تولید عملیات‌محور؛ Plant دامنهٔ دسترسی است، نه Project. ── */
  P("mfg.part.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0642\u0637\u0639\u0647 \u0648 \u0645\u062D\u0635\u0648\u0644", "View parts and products", "internal"),
  P("mfg.part.edit", "mfg", "\u062B\u0628\u062A \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0642\u0637\u0639\u0647 \u0648 \u0645\u062D\u0635\u0648\u0644", "Create and edit parts", "confidential", true),
  P("mfg.bom.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0646\u0633\u062E\u0647\u200C\u0647\u0627\u06CC BOM", "View BOM revisions", "internal"),
  P("mfg.bom.edit", "mfg", "\u0648\u06CC\u0631\u0627\u06CC\u0634 BOM \u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633", "Edit draft BOMs", "confidential", true),
  P("mfg.bom.release", "mfg", "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0646\u0633\u062E\u0647\u0654 BOM", "Release BOM revision", "restricted", true),
  P("mfg.routing.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0645\u0633\u06CC\u0631\u0647\u0627\u06CC \u062A\u0648\u0644\u06CC\u062F", "View routings", "internal"),
  P("mfg.routing.edit", "mfg", "\u0648\u06CC\u0631\u0627\u06CC\u0634 Routing \u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633", "Edit draft routings", "confidential", true),
  P("mfg.routing.release", "mfg", "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC Routing", "Release routing revision", "restricted", true),
  P("mfg.workcenter.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0645\u0631\u0627\u06A9\u0632 \u06A9\u0627\u0631\u06CC \u0648 \u0645\u0646\u0627\u0628\u0639", "View work centers and resources", "internal"),
  P("mfg.workcenter.edit", "mfg", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0645\u0631\u0627\u06A9\u0632 \u06A9\u0627\u0631\u06CC \u0648 \u0645\u0646\u0627\u0628\u0639", "Manage work centers and resources", "confidential", true),
  P("mfg.calendar.edit", "mfg", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u062A\u0642\u0648\u06CC\u0645 \u0648 \u0634\u06CC\u0641\u062A \u062A\u0648\u0644\u06CC\u062F", "Manage production calendars and shifts", "confidential", true),
  P("mfg.order.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0633\u0641\u0627\u0631\u0634\u200C\u0647\u0627\u06CC \u062A\u0648\u0644\u06CC\u062F", "View production orders", "internal"),
  P("mfg.order.create", "mfg", "\u062B\u0628\u062A \u0633\u0641\u0627\u0631\u0634 \u062A\u0648\u0644\u06CC\u062F", "Create production order", "confidential", true),
  P("mfg.order.release", "mfg", "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0633\u0641\u0627\u0631\u0634 \u062A\u0648\u0644\u06CC\u062F", "Release production order", "restricted", true),
  P("mfg.order.reprioritize", "mfg", "\u062A\u063A\u06CC\u06CC\u0631 \u0627\u0648\u0644\u0648\u06CC\u062A \u0627\u0639\u0632\u0627\u0645 \u0633\u0641\u0627\u0631\u0634", "Change order dispatch priority", "confidential", true),
  P("mfg.order.close", "mfg", "\u0628\u0633\u062A\u0646 \u0633\u0641\u0627\u0631\u0634 \u062A\u0648\u0644\u06CC\u062F", "Close production order", "restricted", true),
  P("mfg.schedule.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0628\u0631\u0646\u0627\u0645\u0647\u0654 \u0639\u0645\u0644\u06CC\u0627\u062A \u0648 \u06AF\u0627\u0646\u062A", "View operation schedule and Gantt", "internal"),
  P("mfg.schedule.run", "mfg", "\u0627\u062C\u0631\u0627\u06CC \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC \u0638\u0631\u0641\u06CC\u062A \u062A\u0648\u0644\u06CC\u062F", "Run finite-capacity scheduling", "confidential", true),
  P("mfg.schedule.resequence", "mfg", "\u062A\u063A\u06CC\u06CC\u0631 \u062A\u0648\u0627\u0644\u06CC \u0635\u0641 \u0639\u0645\u0644\u06CC\u0627\u062A", "Resequence operation queue", "confidential", true),
  P("mfg.capacity.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0628\u0627\u0631 \u0648 \u06AF\u0644\u0648\u06AF\u0627\u0647 \u0638\u0631\u0641\u06CC\u062A", "View capacity load and bottlenecks", "internal"),
  P("mfg.execution.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0648\u0636\u0639\u06CC\u062A \u0627\u062C\u0631\u0627\u06CC \u0639\u0645\u0644\u06CC\u0627\u062A", "View operation execution", "internal"),
  P("mfg.execution.start", "mfg", "\u0634\u0631\u0648\u0639 \u0627\u062C\u0631\u0627\u06CC \u0639\u0645\u0644\u06CC\u0627\u062A", "Start operation execution", "confidential", true),
  P("mfg.execution.report", "mfg", "\u062B\u0628\u062A \u0645\u0642\u062F\u0627\u0631 \u062A\u0648\u0644\u06CC\u062F \u0648 \u067E\u06CC\u0634\u0631\u0641\u062A \u0639\u0645\u0644\u06CC\u0627\u062A", "Report operation production and progress", "internal", true),
  P("mfg.execution.finish", "mfg", "\u0627\u062A\u0645\u0627\u0645 \u0627\u062C\u0631\u0627\u06CC \u0639\u0645\u0644\u06CC\u0627\u062A", "Finish operation execution", "confidential", true),
  P("mfg.downtime.report", "mfg", "\u062B\u0628\u062A \u062A\u0648\u0642\u0641 \u0645\u0631\u06A9\u0632 \u06A9\u0627\u0631\u06CC", "Report work-center downtime", "internal", true),
  P("mfg.scrap.report", "mfg", "\u062B\u0628\u062A \u0636\u0627\u06CC\u0639\u0627\u062A \u062A\u0648\u0644\u06CC\u062F", "Report production scrap", "confidential", true),
  P("mfg.rework.report", "mfg", "\u062B\u0628\u062A \u062F\u0648\u0628\u0627\u0631\u0647\u200C\u06A9\u0627\u0631\u06CC \u062A\u0648\u0644\u06CC\u062F", "Report production rework", "confidential", true),
  P("mfg.material.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0645\u0648\u0627\u062F \u0648 \u0645\u0648\u062C\u0648\u062F\u06CC \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC", "View materials and planning inventory", "internal"),
  P("mfg.mrp.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0646\u06CC\u0627\u0632 \u0648 \u06A9\u0645\u0628\u0648\u062F \u0645\u0648\u0627\u062F", "View material requirements and shortages", "internal"),
  P("mfg.mrp.run", "mfg", "\u0627\u062C\u0631\u0627\u06CC \u0645\u062D\u0627\u0633\u0628\u0647\u0654 MRP", "Run material requirements planning", "confidential", true),
  P("mfg.material.consume", "mfg", "\u062B\u0628\u062A \u0645\u0635\u0631\u0641 \u0648\u0627\u0642\u0639\u06CC \u0645\u0648\u0627\u062F", "Post actual material consumption", "confidential", true),
  P("mfg.requisition.create", "mfg", "\u0627\u06CC\u062C\u0627\u062F \u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u062A\u0623\u0645\u06CC\u0646 \u0645\u0648\u0627\u062F", "Create material procurement proposal", "confidential", true),
  P("mfg.cost.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0628\u0647\u0627\u06CC \u062A\u0645\u0627\u0645\u200C\u0634\u062F\u0647\u0654 \u062A\u0648\u0644\u06CC\u062F", "View manufacturing costs", "confidential"),
  P("mfg.cost.reconcile", "mfg", "\u062A\u0637\u0628\u06CC\u0642 \u0648 \u0628\u0633\u062A\u0646 \u0628\u0647\u0627\u06CC \u062A\u0645\u0627\u0645\u200C\u0634\u062F\u0647\u0654 \u0633\u0641\u0627\u0631\u0634", "Reconcile and close production cost", "restricted", true),
  P("mfg.dashboard.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062F\u0627\u0634\u0628\u0648\u0631\u062F \u062A\u0648\u0644\u06CC\u062F", "View manufacturing dashboard", "internal"),
  P("mfg.alert.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0647\u0634\u062F\u0627\u0631\u0647\u0627\u06CC \u062A\u0648\u0644\u06CC\u062F", "View manufacturing alerts", "internal"),
  P("mfg.alert.ack", "mfg", "\u0631\u0633\u06CC\u062F\u06AF\u06CC \u0648 \u062A\u0623\u06CC\u06CC\u062F \u0647\u0634\u062F\u0627\u0631 \u062A\u0648\u0644\u06CC\u062F", "Acknowledge manufacturing alert", "confidential", true),
  /* فاز ۵ — MES پیشرفته: تقاضا، اندازه‌گذاری لات، MPS، ATP و تقسیم/هم‌پوشانی */
  P("mfg.demand.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u0642\u0627\u0636\u0627 \u0648 \u067E\u06CC\u0634\u200C\u0628\u06CC\u0646\u06CC \u0641\u0631\u0648\u0634", "View demand and sales forecast", "internal"),
  P("mfg.demand.edit", "mfg", "\u062B\u0628\u062A \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0642\u0627\u0636\u0627 \u0648 \u067E\u06CC\u0634\u200C\u0628\u06CC\u0646\u06CC \u0641\u0631\u0648\u0634", "Create and edit demand lines", "confidential", true),
  P("mfg.lotsize.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0633\u06CC\u0627\u0633\u062A \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC \u0644\u0627\u062A", "View lot sizing policies", "internal"),
  P("mfg.lotsize.edit", "mfg", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0633\u06CC\u0627\u0633\u062A \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC \u0644\u0627\u062A", "Manage lot sizing policies", "confidential", true),
  P("mfg.mps.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0628\u0631\u0646\u0627\u0645\u0647\u0654 \u0627\u0635\u0644\u06CC \u062A\u0648\u0644\u06CC\u062F", "View master production schedule", "internal"),
  P("mfg.mps.run", "mfg", "\u0627\u062C\u0631\u0627\u06CC \u0645\u062D\u0627\u0633\u0628\u0647\u0654 MPS", "Run master production schedule", "confidential", true),
  /* قطعی‌کردن ردیف MPS تعهد برنامه‌ای است نه آزادسازی مالی؛ هم‌طراز
   * `mfg.mps.run` confidential است تا برنامه‌ریز تولید که clearance او
   * confidential است بتواند برنامهٔ خودش را قطعی کند (با ثبت مموزی). */
  P("mfg.mps.firm", "mfg", "\u0642\u0637\u0639\u06CC\u200C\u06A9\u0631\u062F\u0646 \u0633\u0641\u0627\u0631\u0634\u200C\u0647\u0627\u06CC \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647\u0654 MPS", "Firm planned MPS orders", "confidential", true),
  P("mfg.atp.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0642\u0627\u0628\u0644\u06CC\u062A \u062A\u0639\u0647\u062F \u062A\u062D\u0648\u06CC\u0644", "View available-to-promise", "internal"),
  P("mfg.atp.check", "mfg", "\u0628\u0631\u0631\u0633\u06CC \u062A\u0639\u0647\u062F \u062A\u062D\u0648\u06CC\u0644 \u0628\u0647 \u0645\u0634\u062A\u0631\u06CC", "Run ATP promise check", "confidential", true),
  P("mfg.split.edit", "mfg", "\u062A\u0642\u0633\u06CC\u0645 \u0644\u0627\u062A \u0648 \u0647\u0645\u200C\u067E\u0648\u0634\u0627\u0646\u06CC \u0639\u0645\u0644\u06CC\u0627\u062A", "Split lots and overlap operations", "confidential", true),
  /* بخش ۱۱ فاز ۵ — تفکیک اقتدارها عمداً ریز است، چون «دیدن پیشنهاد MRP»،
   * «ویرایش مقدار لات» و «تبدیل به سفارش تولید» سه مسئولیت متفاوت‌اند:
   * تبدیل، کار واقعی روی کف کارگاه ایجاد می‌کند و باید جدا گیت شود. */
  P("mfg.plannedorder.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0633\u0641\u0627\u0631\u0634\u200C\u0647\u0627\u06CC \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647", "View planned orders", "internal"),
  P("mfg.plannedorder.edit", "mfg", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0633\u0641\u0627\u0631\u0634 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647 \u067E\u06CC\u0634 \u0627\u0632 \u062A\u0628\u062F\u06CC\u0644", "Edit planned order before conversion", "confidential", true),
  P("mfg.plannedorder.approve", "mfg", "\u062A\u0623\u06CC\u06CC\u062F \u06CC\u0627 \u0631\u062F \u0633\u0641\u0627\u0631\u0634 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647", "Approve or reject planned order", "confidential", true),
  P("mfg.plannedorder.convert", "mfg", "\u062A\u0628\u062F\u06CC\u0644 \u0633\u0641\u0627\u0631\u0634 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647 \u0628\u0647 \u0633\u0641\u0627\u0631\u0634 \u062A\u0648\u0644\u06CC\u062F", "Convert planned order to production order", "confidential", true),
  P("mfg.version.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0646\u0633\u062E\u0647\u200C\u0647\u0627\u06CC \u062A\u0648\u0644\u06CC\u062F", "View production versions", "internal"),
  P("mfg.version.edit", "mfg", "\u062A\u0639\u0631\u06CC\u0641 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0646\u0633\u062E\u0647\u0654 \u062A\u0648\u0644\u06CC\u062F", "Maintain production versions", "confidential", true),
  P("mfg.crp.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC \u0646\u06CC\u0627\u0632 \u0638\u0631\u0641\u06CC\u062A (CRP)", "View capacity requirements planning", "internal"),
  P("mfg.mps.approve", "mfg", "\u062A\u0623\u06CC\u06CC\u062F \u062F\u0633\u062A\u06CC MPS \u067E\u06CC\u0634 \u0627\u0632 \u0627\u062C\u0631\u0627\u06CC MRP", "Approve MPS before MRP run", "confidential", true),
  P("mfg.conformance.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0627\u0646\u0637\u0628\u0627\u0642 ISA-95 \u0648 MESA-11", "View ISA-95 / MESA-11 conformance", "internal"),
  /* تنظیمات کارخانه و نوع صنعت. ویرایش IndustryType رفتار موجود را عوض نمی‌کند
   * (نگاشت قابلیت فقط توصیفی است)، ولی audited است چون تصمیم سطح کارخانه است. */
  P("mfg.plant.view", "mfg", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u06A9\u0627\u0631\u062E\u0627\u0646\u0647 \u0648 \u0642\u0627\u0628\u0644\u06CC\u062A\u200C\u0647\u0627\u06CC \u0635\u0646\u0639\u062A", "View plant settings and industry capabilities", "internal"),
  P("mfg.plant.edit", "mfg", "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u06A9\u0627\u0631\u062E\u0627\u0646\u0647 \u0648 \u0646\u0648\u0639 \u0635\u0646\u0639\u062A", "Maintain plant settings and industry type", "confidential", true),
  /* P10/AI-1..4: دستیار هوشمند. پرسش فقط‌خواندنی است، ولی چهار اقتدار جدا
   * دارد و یکی گرفته نمی‌شوند: پرسیدن (ai.assistant.ask)، دیدن بینش آماده
   * (ai.insight.view)، خواندن تاریخچهٔ پرسش‌وپاسخ (ai.history.view — می‌تواند
   * پرسش دیگران را هم نشان دهد) و خروجی گرفتن/ساخت سند (ai.export.run). سرویس
   * بیرونی هوش مصنوعی هیچ‌کدام از این‌ها را جانشین نمی‌کند؛ «پرسش» و
   * «پروایدر» دو چیز جدا هستند. */
  P("ai.assistant.ask", "core", "\u067E\u0631\u0633\u0634 \u0627\u0632 \u062F\u0633\u062A\u06CC\u0627\u0631 \u0647\u0648\u0634\u0645\u0646\u062F", "Ask the AI assistant", "internal"),
  P("ai.insight.view", "core", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0628\u06CC\u0646\u0634\u200C\u0647\u0627\u06CC \u0622\u0645\u0627\u062F\u0647\u0654 \u067E\u0631\u0648\u0698\u0647", "View ready project insights", "internal"),
  P("ai.history.view", "core", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u0627\u0631\u06CC\u062E\u0686\u0647\u0654 \u067E\u0631\u0633\u0634 \u0648 \u067E\u0627\u0633\u062E", "View AI interaction history", "confidential"),
  P("ai.export.run", "core", "\u062E\u0631\u0648\u062C\u06CC \u062C\u062F\u0648\u0644/\u0633\u0646\u062F \u0627\u0632 \u067E\u0627\u0633\u062E \u062F\u0633\u062A\u06CC\u0627\u0631", "Export AI answer table/document", "confidential", true),
  /* ── بخش ۳: نگهداری و تعمیرات و دارایی‌ها (CMMS / EAM / APM) ──────────────
   * دامنهٔ این مجوزها `siteId` است نه `projectId`؛ یک دارایی فیزیکی عمری
   * ده‌ساله دارد و نباید دسترسی به آن با چرخهٔ قرارداد/پروژه عوض شود.
   * تفکیک اقتدارها عمداً ریز است: «دیدن دستورکار»، «آزادسازی» و «بستن» سه
   * مسئولیت متفاوت‌اند و در محیط عملیاتی باید جدا گیت شوند. */
  /* دارایی و شناسنامه */
  P("cmms.asset.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0634\u0646\u0627\u0633\u0646\u0627\u0645\u0647\u0654 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A \u0648 \u062F\u0627\u0631\u0627\u06CC\u06CC\u200C\u0647\u0627", "View asset registry", "internal"),
  P("cmms.asset.edit", "cmms", "\u062B\u0628\u062A \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u062C\u0647\u06CC\u0632", "Create and edit assets", "confidential", true),
  P("cmms.asset.commission", "cmms", "\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0648 \u062A\u062D\u0648\u06CC\u0644\u200C\u06AF\u0631\u0641\u0646 \u062A\u062C\u0647\u06CC\u0632", "Commission asset", "confidential", true),
  P("cmms.asset.retire", "cmms", "\u0627\u0632 \u0631\u062F\u0647 \u062E\u0627\u0631\u062C\u200C\u06A9\u0631\u062F\u0646 \u0648 \u0627\u0633\u0642\u0627\u0637 \u062F\u0627\u0631\u0627\u06CC\u06CC", "Retire or dispose asset", "restricted", true),
  P("cmms.location.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0633\u0627\u062E\u062A\u0627\u0631 \u0645\u06A9\u0627\u0646 \u0648 \u062C\u0627\u0646\u0645\u0627\u06CC\u06CC", "View location hierarchy", "internal"),
  P("cmms.location.edit", "cmms", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0633\u0627\u062E\u062A\u0627\u0631 \u0645\u06A9\u0627\u0646 \u0648 \u0645\u062E\u062A\u0635\u0627\u062A \u062C\u063A\u0631\u0627\u0641\u06CC\u0627\u06CC\u06CC", "Manage location hierarchy", "confidential", true),
  P("cmms.meter.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u06A9\u0646\u062A\u0648\u0631\u0647\u0627\u06CC \u06A9\u0627\u0631\u06A9\u0631\u062F", "View operating meters", "internal"),
  P("cmms.meter.read", "cmms", "\u062B\u0628\u062A \u0642\u0631\u0627\u0626\u062A \u06A9\u0646\u062A\u0648\u0631 \u06A9\u0627\u0631\u06A9\u0631\u062F", "Post meter reading", "internal", true),
  P("cmms.barcode.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0628\u0627\u0631\u06A9\u062F \u0648 QR \u062A\u062C\u0647\u06CC\u0632", "View asset barcodes", "internal"),
  P("cmms.barcode.print", "cmms", "\u0686\u0627\u067E \u0648 \u0635\u062F\u0648\u0631 \u0628\u0631\u0686\u0633\u0628 \u0628\u0627\u0631\u06A9\u062F", "Print asset barcode label", "confidential", true),
  P("cmms.document.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0622\u0631\u0634\u06CC\u0648 \u0641\u0646\u06CC \u0627\u0633\u0646\u0627\u062F", "View technical archive", "internal"),
  P("cmms.document.edit", "cmms", "\u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u0633\u0646\u0627\u062F \u0641\u0646\u06CC", "Upload and edit technical documents", "confidential", true),
  /* خانوادهٔ تجهیز — ساختار ۱۳گانهٔ PMworks */
  P("cmms.family.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0627\u0644\u06AF\u0648 \u0648 \u062E\u0627\u0646\u0648\u0627\u062F\u0647\u0654 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A", "View equipment families", "internal"),
  P("cmms.family.edit", "cmms", "\u062A\u0639\u0631\u06CC\u0641 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062E\u0627\u0646\u0648\u0627\u062F\u0647\u0654 \u062A\u062C\u0647\u06CC\u0632", "Maintain equipment family", "confidential", true),
  P("cmms.family.approve", "cmms", "\u062A\u0635\u0648\u06CC\u0628 \u0646\u0633\u062E\u0647\u0654 \u062E\u0627\u0646\u0648\u0627\u062F\u0647\u0654 \u062A\u062C\u0647\u06CC\u0632", "Approve equipment family revision", "restricted", true),
  P("cmms.family.bulkchange", "cmms", "\u0627\u0639\u0645\u0627\u0644 \u062A\u063A\u06CC\u06CC\u0631 \u0647\u0645\u06AF\u0627\u0646\u06CC \u0631\u0648\u06CC \u0627\u0639\u0636\u0627\u06CC \u062E\u0627\u0646\u0648\u0627\u062F\u0647", "Apply family-wide bulk change", "restricted", true),
  P("cmms.customfield.edit", "cmms", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0641\u06CC\u0644\u062F\u0647\u0627\u06CC \u067E\u0648\u06CC\u0627\u06CC \u062E\u0627\u0646\u0648\u0627\u062F\u0647", "Manage family dynamic fields", "confidential", true),
  /* مهندسی قابلیت اطمینان و استانداردها */
  P("cmms.failuremode.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062D\u0627\u0644\u0627\u062A \u062E\u0631\u0627\u0628\u06CC \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F (ISO 14224)", "View standard failure modes", "internal"),
  P("cmms.failuremode.edit", "cmms", "\u062A\u0639\u0631\u06CC\u0641 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062D\u0627\u0644\u062A \u062E\u0631\u0627\u0628\u06CC \u062E\u0627\u0646\u0648\u0627\u062F\u0647", "Maintain family failure modes", "confidential", true),
  P("cmms.failure.report", "cmms", "\u062B\u0628\u062A \u0631\u062E\u062F\u0627\u062F \u062E\u0631\u0627\u0628\u06CC \u0628\u0627 \u06A9\u062F ISO 14224", "Report failure event", "internal", true),
  P("cmms.downtime.report", "cmms", "\u062B\u0628\u062A \u062A\u0648\u0642\u0641 \u062A\u062C\u0647\u06CC\u0632", "Report asset downtime", "internal", true),
  P("cmms.fmea.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u062D\u0644\u06CC\u0644 FMEA/FMECA (IEC 60812)", "View FMEA/FMECA analysis", "internal"),
  P("cmms.fmea.edit", "cmms", "\u062A\u062F\u0648\u06CC\u0646 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u062D\u0644\u06CC\u0644 FMEA", "Maintain FMEA analysis", "confidential", true),
  P("cmms.fmea.approve", "cmms", "\u062A\u0635\u0648\u06CC\u0628 \u062A\u062D\u0644\u06CC\u0644 FMEA/FMECA", "Approve FMEA/FMECA analysis", "restricted", true),
  P("cmms.rcm.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u062D\u0644\u06CC\u0644 RCM (IEC 60300-3-11)", "View RCM analysis", "internal"),
  P("cmms.rcm.edit", "cmms", "\u062A\u062F\u0648\u06CC\u0646 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u062D\u0644\u06CC\u0644 RCM", "Maintain RCM analysis", "confidential", true),
  P("cmms.rcm.approve", "cmms", "\u062A\u0635\u0648\u06CC\u0628 \u062A\u062D\u0644\u06CC\u0644 RCM \u0648 \u0628\u0631\u0646\u0627\u0645\u0647\u0654 \u0646\u062A", "Approve RCM analysis and plan", "restricted", true),
  P("cmms.rca.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u067E\u0631\u0648\u0646\u062F\u0647\u200C\u0647\u0627\u06CC \u062A\u062D\u0644\u06CC\u0644 \u0631\u06CC\u0634\u0647\u200C\u0627\u06CC", "View RCA cases", "internal"),
  P("cmms.rca.edit", "cmms", "\u062A\u062F\u0648\u06CC\u0646 \u062A\u062D\u0644\u06CC\u0644 \u0631\u06CC\u0634\u0647\u200C\u0627\u06CC (5-Why / Fishbone)", "Maintain RCA case", "confidential", true),
  P("cmms.rca.close", "cmms", "\u0628\u0633\u062A\u0646 \u0648 \u062A\u0623\u06CC\u06CC\u062F \u0627\u062B\u0631\u0628\u062E\u0634\u06CC \u062A\u062D\u0644\u06CC\u0644 \u0631\u06CC\u0634\u0647\u200C\u0627\u06CC", "Close and verify RCA case", "restricted", true),
  P("cmms.reliability.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0634\u0627\u062E\u0635\u200C\u0647\u0627\u06CC \u0642\u0627\u0628\u0644\u06CC\u062A \u0627\u0637\u0645\u06CC\u0646\u0627\u0646 (MTBF/MTTR)", "View reliability indicators", "internal"),
  P("cmms.oee.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0627\u062B\u0631\u0628\u062E\u0634\u06CC \u06A9\u0644\u06CC \u062A\u062C\u0647\u06CC\u0632\u0627\u062A (OEE)", "View OEE snapshots", "internal"),
  /* پایش وضعیت (ISO 17359) */
  P("cmms.condition.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u067E\u0627\u06CC\u0634 \u0648\u0636\u0639\u06CC\u062A", "View condition monitoring data", "internal"),
  P("cmms.condition.record", "cmms", "\u062B\u0628\u062A \u0642\u0631\u0627\u0626\u062A \u067E\u0627\u06CC\u0634 \u0648\u0636\u0639\u06CC\u062A", "Post condition reading", "internal", true),
  P("cmms.condition.threshold", "cmms", "\u062A\u0646\u0638\u06CC\u0645 \u0622\u0633\u062A\u0627\u0646\u0647\u200C\u0647\u0627\u06CC \u067E\u0627\u06CC\u0634 \u0648\u0636\u0639\u06CC\u062A", "Maintain condition thresholds", "confidential", true),
  /* درخواست‌کار و دستورکار */
  P("cmms.request.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u0647\u0627\u06CC \u06A9\u0627\u0631 \u0646\u062A", "View work requests", "internal"),
  P("cmms.request.create", "cmms", "\u062B\u0628\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u06A9\u0627\u0631 \u0646\u062A", "Create work request", "internal", true),
  P("cmms.request.review", "cmms", "\u0628\u0631\u0631\u0633\u06CC \u0648 \u062A\u0635\u0648\u06CC\u0628 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u06A9\u0627\u0631", "Review and approve work request", "confidential", true),
  P("cmms.request.reject", "cmms", "\u0631\u062F \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u06A9\u0627\u0631", "Reject work request", "confidential", true),
  P("cmms.wo.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631\u0647\u0627\u06CC \u0646\u062A", "View maintenance work orders", "internal"),
  P("cmms.wo.create", "cmms", "\u0627\u06CC\u062C\u0627\u062F \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0646\u062A", "Create maintenance work order", "confidential", true),
  P("cmms.wo.plan", "cmms", "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 (\u0645\u0646\u0627\u0628\u0639 \u0648 \u0628\u0631\u0622\u0648\u0631\u062F)", "Plan work order", "confidential", true),
  P("cmms.wo.schedule", "cmms", "\u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u062F\u0631 \u062A\u0642\u0648\u06CC\u0645", "Schedule work order", "confidential", true),
  P("cmms.wo.release", "cmms", "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u0631\u0627\u06CC \u0627\u062C\u0631\u0627", "Release work order", "restricted", true),
  P("cmms.wo.execute", "cmms", "\u0627\u062C\u0631\u0627\u06CC \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0648 \u062B\u0628\u062A \u067E\u06CC\u0634\u0631\u0641\u062A", "Execute work order", "internal", true),
  P("cmms.wo.complete", "cmms", "\u0627\u0639\u0644\u0627\u0645 \u0627\u062A\u0645\u0627\u0645 \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631", "Complete work order", "confidential", true),
  P("cmms.wo.close", "cmms", "\u0628\u0633\u062A\u0646 \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0648 \u0642\u0637\u0639\u06CC\u200C\u06A9\u0631\u062F\u0646 \u0647\u0632\u06CC\u0646\u0647", "Close work order and finalize cost", "restricted", true),
  P("cmms.wo.cancel", "cmms", "\u0644\u063A\u0648 \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631", "Cancel work order", "restricted", true),
  P("cmms.labor.report", "cmms", "\u062B\u0628\u062A \u0646\u0641\u0631\u0633\u0627\u0639\u062A \u0648 \u06A9\u0627\u0631\u06A9\u0631\u062F \u062A\u06A9\u0646\u0633\u06CC\u0646", "Report labor hours", "internal", true),
  P("cmms.workflow.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u0639\u0631\u06CC\u0641 \u0648 \u0645\u0633\u06CC\u0631 \u06AF\u0631\u062F\u0634\u200C\u06A9\u0627\u0631", "View workflow definitions", "internal"),
  P("cmms.workflow.edit", "cmms", "\u062A\u0639\u0631\u06CC\u0641 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u06AF\u0631\u062F\u0634\u200C\u06A9\u0627\u0631", "Maintain workflow definitions", "restricted", true),
  /* برنامه‌ریزی نت */
  P("cmms.pm.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0647\u0627\u06CC \u0646\u06AF\u0647\u062F\u0627\u0634\u062A \u067E\u06CC\u0634\u06AF\u06CC\u0631\u0627\u0646\u0647", "View PM schedules", "internal"),
  P("cmms.pm.edit", "cmms", "\u062A\u0639\u0631\u06CC\u0641 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0628\u0631\u0646\u0627\u0645\u0647\u0654 PM", "Maintain PM schedule", "confidential", true),
  P("cmms.strategy.approve", "cmms", "\u062A\u0635\u0648\u06CC\u0628 \u0627\u0633\u062A\u0631\u0627\u062A\u0698\u06CC \u0646\u06AF\u0647\u062F\u0627\u0634\u062A", "Approve maintenance strategy", "restricted", true),
  /* قطعات یدکی و انبار نت */
  P("cmms.spare.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0642\u0637\u0639\u0627\u062A \u06CC\u062F\u06A9\u06CC MRO \u0648 \u0645\u0648\u062C\u0648\u062F\u06CC", "View MRO spare parts", "internal"),
  P("cmms.spare.edit", "cmms", "\u062B\u0628\u062A \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0642\u0637\u0639\u0647\u0654 \u06CC\u062F\u06A9\u06CC", "Maintain spare part master", "confidential", true),
  P("cmms.spare.issue", "cmms", "\u0635\u062F\u0648\u0631 \u0642\u0637\u0639\u0647 \u0627\u0632 \u0627\u0646\u0628\u0627\u0631 \u0646\u062A", "Issue spare part", "confidential", true),
  P("cmms.spare.receive", "cmms", "\u0631\u0633\u06CC\u062F \u0642\u0637\u0639\u0647 \u0628\u0647 \u0627\u0646\u0628\u0627\u0631 \u0646\u062A", "Receive spare part", "confidential", true),
  /* منابع انسانی، پیمانکار و ابزار */
  P("cmms.technician.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u06A9\u0646\u0633\u06CC\u0646\u200C\u0647\u0627 \u0648 \u0645\u0647\u0627\u0631\u062A\u200C\u0647\u0627", "View technicians and skills", "internal"),
  P("cmms.technician.edit", "cmms", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u062A\u06A9\u0646\u0633\u06CC\u0646\u200C\u0647\u0627 \u0648 \u0645\u0647\u0627\u0631\u062A\u200C\u0647\u0627", "Manage technicians and skills", "confidential", true),
  P("cmms.crew.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u06AF\u0631\u0648\u0647\u200C\u0647\u0627\u06CC \u06A9\u0627\u0631\u06CC \u0648 \u062A\u0642\u0648\u06CC\u0645 \u0634\u06CC\u0641\u062A", "View crews and shift calendar", "internal"),
  P("cmms.crew.edit", "cmms", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u06AF\u0631\u0648\u0647\u200C\u0647\u0627\u06CC \u06A9\u0627\u0631\u06CC \u0648 \u062A\u0642\u0648\u06CC\u0645 \u0634\u06CC\u0641\u062A", "Manage crews and shift calendar", "confidential", true),
  P("cmms.vendor.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u0623\u0645\u06CC\u0646\u200C\u06A9\u0646\u0646\u062F\u06AF\u0627\u0646 \u0648 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631\u0627\u0646 \u0646\u062A", "View maintenance vendors", "internal"),
  P("cmms.vendor.edit", "cmms", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u062A\u0623\u0645\u06CC\u0646\u200C\u06A9\u0646\u0646\u062F\u06AF\u0627\u0646 \u0648 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631\u0627\u0646 \u0646\u062A", "Manage maintenance vendors", "confidential", true),
  /* هزینه، شاخص و هشدار */
  P("cmms.cost.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0646\u062A", "View maintenance costs", "confidential"),
  P("cmms.cost.post", "cmms", "\u062B\u0628\u062A \u0647\u0632\u06CC\u0646\u0647\u0654 \u0646\u062A \u0631\u0648\u06CC \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631", "Post maintenance cost", "confidential", true),
  P("cmms.lcc.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0647\u0632\u06CC\u0646\u0647\u0654 \u0686\u0631\u062E\u0647\u0654 \u0639\u0645\u0631 \u062F\u0627\u0631\u0627\u06CC\u06CC (LCC)", "View life cycle cost", "confidential"),
  P("cmms.lcc.edit", "cmms", "\u062A\u062D\u0644\u06CC\u0644 \u0648 \u062B\u0628\u062A \u0633\u0646\u0627\u0631\u06CC\u0648\u06CC LCC", "Maintain LCC scenarios", "confidential", true),
  P("cmms.kpi.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0634\u0627\u062E\u0635\u200C\u0647\u0627\u06CC \u0639\u0645\u0644\u06A9\u0631\u062F \u0646\u062A (EN 15341)", "View maintenance KPIs", "internal"),
  P("cmms.kpi.edit", "cmms", "\u062A\u0646\u0638\u06CC\u0645 \u0647\u062F\u0641 \u0648 \u0622\u0633\u062A\u0627\u0646\u0647\u0654 \u0634\u0627\u062E\u0635\u200C\u0647\u0627", "Maintain KPI targets", "confidential", true),
  P("cmms.dashboard.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062F\u0627\u0634\u0628\u0648\u0631\u062F \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC \u0646\u062A", "View maintenance dashboard", "internal"),
  P("cmms.alert.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0647\u0634\u062F\u0627\u0631\u0647\u0627\u06CC \u0646\u062A", "View maintenance alerts", "internal"),
  P("cmms.alert.ack", "cmms", "\u0631\u0633\u06CC\u062F\u06AF\u06CC \u0648 \u062A\u0623\u06CC\u06CC\u062F \u0647\u0634\u062F\u0627\u0631 \u0646\u062A", "Acknowledge maintenance alert", "confidential", true),
  /* فاز ۲ — توقف/ادامهٔ دستورکار. توقف و ادامه دو اقتدار جدا هستند: یک نفر
   * می‌تواند کار را بخواباند (مثلاً تکنسین در انتظار قطعه) ولی بازگرداندن
   * آن به خط تولید یک تصمیم دیگر است. */
  P("cmms.wo.hold", "cmms", "\u0645\u062A\u0648\u0642\u0641\u200C\u06A9\u0631\u062F\u0646 \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u0627 \u062B\u0628\u062A \u0639\u0644\u062A", "Hold work order with reason", "internal", true),
  P("cmms.wo.resume", "cmms", "\u0627\u062F\u0627\u0645\u0647\u0654 \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0645\u062A\u0648\u0642\u0641\u200C\u0634\u062F\u0647", "Resume held work order", "internal", true),
  /* فاز ۳ — CAPA روی خروجی RCFA. تدوین تحلیل با مهندس قابلیت اطمینان است؛
   * ارجاع اقدام به دستورکار جدید علاوه بر این مجوز، مجوز ساخت دستورکار
   * (`cmms.wo.create`) را هم می‌خواهد — دو گیت، دو مسئولیت. */
  P("cmms.capa.create", "cmms", "\u062B\u0628\u062A \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC \u0648 \u067E\u06CC\u0634\u06AF\u06CC\u0631\u0627\u0646\u0647 (CAPA)", "Create corrective and preventive action", "confidential", true),
  P("cmms.capa.verify", "cmms", "\u062A\u0623\u06CC\u06CC\u062F \u0627\u062B\u0631\u0628\u062E\u0634\u06CC \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC", "Verify CAPA effectiveness", "restricted", true),
  /* فاز ۴ — یکپارچگی بین‌بخشی. «دیدن صف رویداد» از «فرستادن آن به سامانهٔ
   * بیرونی» جدا گیت شده؛ ارسال به MES یک نوشتن بیرونی است و ممیزی می‌خواهد. */
  P("cmms.integration.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0635\u0641 \u0631\u0648\u06CC\u062F\u0627\u062F \u06CC\u06A9\u067E\u0627\u0631\u0686\u06AF\u06CC", "View integration outbox", "internal"),
  P("cmms.integration.dispatch", "cmms", "\u0627\u0631\u0633\u0627\u0644 \u0648 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0631\u0648\u06CC\u062F\u0627\u062F \u06CC\u06A9\u067E\u0627\u0631\u0686\u06AF\u06CC \u0628\u0647 \u0633\u0627\u0645\u0627\u0646\u0647\u0654 \u0628\u06CC\u0631\u0648\u0646\u06CC", "Dispatch integration events", "confidential", true),
  P("cmms.capacity.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0628\u0644\u0648\u06A9\u0647\u200C\u0633\u0627\u0632\u06CC \u0638\u0631\u0641\u06CC\u062A \u0645\u0631\u0627\u06A9\u0632 \u06A9\u0627\u0631\u06CC", "View capacity blocks", "internal"),
  P("cmms.capacity.block", "cmms", "\u0631\u0632\u0631\u0648 \u0648 \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0646\u0631\u0645 \u0638\u0631\u0641\u06CC\u062A \u0645\u0631\u06A9\u0632 \u06A9\u0627\u0631\u06CC \u062A\u0648\u0644\u06CC\u062F", "Block and release work-center capacity", "confidential", true),
  /* لایهٔ هوش مصنوعی — «دیدن پیشنهاد»، «اجرای موتور» و «اعمال پیشنهاد»
   * سه اقتدار جدا هستند. اعمال پیشنهاد AI یک تصمیم انسانی است و عمداً
   * از اجرای موتور جدا گیت شده تا هیچ پیشنهاد خودکار بی‌تأیید اجرا نشود. */
  P("cmms.ai.view", "cmms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u0647\u0627\u06CC \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC \u0646\u062A", "View CMMS AI recommendations", "internal"),
  P("cmms.ai.run", "cmms", "\u0627\u062C\u0631\u0627\u06CC \u0645\u0648\u062A\u0648\u0631\u0647\u0627\u06CC \u062A\u062D\u0644\u06CC\u0644\u06CC \u0646\u062A", "Run CMMS AI engines", "confidential", true),
  P("cmms.ai.apply", "cmms", "\u0627\u0639\u0645\u0627\u0644 \u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC \u0631\u0648\u06CC \u062F\u0627\u062F\u0647\u0654 \u0648\u0627\u0642\u0639\u06CC", "Apply AI recommendation", "restricted", true),
  /* ── بخش ۵: پایش میدانی، اینترنت اشیاء صنعتی و تله‌متری حفاری (IIoT & DAS) ──
   * دامنهٔ این مجوزها `rigId` است نه `projectId`: یک دکل بین چندین چاه و
   * قرارداد جابه‌جا می‌شود و دسترسی به دادهٔ تله‌متری‌اش نباید با چرخهٔ
   * قرارداد عوض شود. ارزیابی از طریق `plantIds` و fail-closed است.
   *
   * تفکیک اقتدارها عمداً ریز است، چون سه مسئولیت متفاوت روی یک هشدار وجود
   * دارد: «دیدن» (همه)، «تأیید/بستن» (سرپرست شیفت) و «ارسال به سامانهٔ
   * بیرونی» (نوشتن در CMMS/MES/PMIS — تصمیم سطح عملیات). */
  /* دکل و جریان */
  P("iiot.rig.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062F\u06A9\u0644\u200C\u0647\u0627\u06CC \u062D\u0641\u0627\u0631\u06CC \u0648 \u0648\u0636\u0639\u06CC\u062A \u0639\u0645\u0644\u06CC\u0627\u062A", "View drilling rigs", "internal"),
  P("iiot.rig.edit", "iiot", "\u062B\u0628\u062A \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062F\u06A9\u0644 \u062D\u0641\u0627\u0631\u06CC", "Create and edit drilling rig", "confidential", true),
  P("iiot.stream.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062C\u0631\u06CC\u0627\u0646\u200C\u0647\u0627\u06CC \u062A\u0644\u0647\u200C\u0645\u062A\u0631\u06CC", "View telemetry streams", "internal"),
  P("iiot.stream.edit", "iiot", "\u062A\u0639\u0631\u06CC\u0641 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062C\u0631\u06CC\u0627\u0646 \u062A\u0644\u0647\u200C\u0645\u062A\u0631\u06CC", "Maintain telemetry stream", "confidential", true),
  P("iiot.channel.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u06A9\u0627\u0646\u0627\u0644\u200C\u0647\u0627\u06CC \u0633\u06CC\u06AF\u0646\u0627\u0644 (DAS)", "View DAS signal channels", "internal"),
  P("iiot.channel.edit", "iiot", "\u062A\u0639\u0631\u06CC\u0641 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u06A9\u0627\u0646\u0627\u0644 \u0633\u06CC\u06AF\u0646\u0627\u0644", "Maintain DAS channel", "confidential", true),
  /* تله‌متری */
  P("iiot.telemetry.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0633\u0631\u06CC \u0632\u0645\u0627\u0646\u06CC \u062A\u0644\u0647\u200C\u0645\u062A\u0631\u06CC", "View telemetry time series", "internal"),
  P("iiot.telemetry.ingest", "iiot", "\u062B\u0628\u062A \u0646\u0645\u0648\u0646\u0647\u0654 \u062A\u0644\u0647\u200C\u0645\u062A\u0631\u06CC \u0648 \u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u0628\u0627\u0641\u0631 \u0644\u0628\u0647", "Ingest telemetry samples", "confidential", true),
  /* فیلترینگ و آستانه */
  P("iiot.filter.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0642\u0627\u0639\u062F\u0647\u200C\u0647\u0627\u06CC \u0641\u06CC\u0644\u062A\u0631\u06CC\u0646\u06AF \u0633\u06CC\u06AF\u0646\u0627\u0644", "View signal filter rules", "internal"),
  P("iiot.filter.edit", "iiot", "\u062A\u0646\u0638\u06CC\u0645 \u0641\u06CC\u0644\u062A\u0631 \u0648 \u067E\u0646\u062C\u0631\u0647\u0654 \u0647\u0645\u0648\u0627\u0631\u0633\u0627\u0632\u06CC \u0633\u06CC\u06AF\u0646\u0627\u0644", "Maintain signal filter rules", "confidential", true),
  P("iiot.threshold.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0622\u0633\u062A\u0627\u0646\u0647\u200C\u0647\u0627\u06CC \u0647\u0634\u062F\u0627\u0631", "View threshold rules", "internal"),
  P("iiot.threshold.edit", "iiot", "\u062A\u0646\u0638\u06CC\u0645 \u0622\u0633\u062A\u0627\u0646\u0647\u200C\u0647\u0627\u06CC \u0686\u0646\u062F\u0633\u0637\u062D\u06CC \u0648 \u0642\u0648\u0627\u0639\u062F \u062A\u0634\u062E\u06CC\u0635", "Maintain threshold and detection rules", "confidential", true),
  /* هشدار */
  P("iiot.alert.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0647\u0634\u062F\u0627\u0631\u0647\u0627\u06CC \u062A\u0644\u0647\u200C\u0645\u062A\u0631\u06CC", "View telemetry alerts", "internal"),
  P("iiot.alert.ack", "iiot", "\u062A\u0623\u06CC\u06CC\u062F \u062F\u0631\u06CC\u0627\u0641\u062A \u0647\u0634\u062F\u0627\u0631 \u062A\u0648\u0633\u0637 \u067E\u0631\u0633\u0646\u0644 \u0634\u06CC\u0641\u062A", "Acknowledge telemetry alert", "internal", true),
  P("iiot.alert.resolve", "iiot", "\u0628\u0633\u062A\u0646 \u0647\u0634\u062F\u0627\u0631 \u06CC\u0627 \u062B\u0628\u062A \u0647\u0634\u062F\u0627\u0631 \u06A9\u0627\u0630\u0628", "Resolve alert or mark false positive", "confidential", true),
  P("iiot.alert.dispatch", "iiot", "\u0627\u0631\u0633\u0627\u0644 \u062F\u0633\u062A\u06CC \u0647\u0634\u062F\u0627\u0631 \u0628\u0647 CMMS/MES/PMIS", "Dispatch alert to downstream systems", "confidential", true),
  /* گیت‌وی و Store-and-Forward */
  P("iiot.gateway.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u06AF\u06CC\u062A\u200C\u0648\u06CC\u200C\u0647\u0627\u06CC \u0644\u0628\u0647 \u0648 \u0633\u0644\u0627\u0645\u062A \u0627\u062A\u0635\u0627\u0644", "View edge gateways", "internal"),
  P("iiot.gateway.edit", "iiot", "\u062B\u0628\u062A \u0648 \u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC \u06AF\u06CC\u062A\u200C\u0648\u06CC \u0644\u0628\u0647", "Maintain edge gateway", "confidential", true),
  P("iiot.buffer.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0628\u0627\u0641\u0631 \u0644\u0628\u0647 \u0648 \u062F\u0633\u062A\u0647\u200C\u0647\u0627\u06CC \u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631", "View store-and-forward buffer", "internal"),
  P("iiot.buffer.sync", "iiot", "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0648 \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0628\u0627\u0641\u0631 \u0644\u0628\u0647", "Synchronize edge buffer", "confidential", true),
  /* سنسور و پایش وضعیت */
  P("iiot.sensor.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0634\u0646\u0627\u0633\u0646\u0627\u0645\u0647\u0654 \u0633\u0646\u0633\u0648\u0631\u0647\u0627 \u0648 \u062A\u06AF\u200C\u0647\u0627", "View sensor registry", "internal"),
  P("iiot.sensor.edit", "iiot", "\u062B\u0628\u062A \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0633\u0646\u0633\u0648\u0631 \u0645\u06CC\u062F\u0627\u0646", "Maintain field sensor", "confidential", true),
  P("iiot.sensor.calibrate", "iiot", "\u062B\u0628\u062A \u06A9\u0627\u0644\u06CC\u0628\u0631\u0627\u0633\u06CC\u0648\u0646 \u0633\u0646\u0633\u0648\u0631", "Record sensor calibration", "confidential", true),
  P("iiot.condition.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0639\u06A9\u0633\u200C\u0647\u0627\u06CC \u067E\u0627\u06CC\u0634 \u0648\u0636\u0639\u06CC\u062A (CBM)", "View condition monitoring snapshots", "internal"),
  P("iiot.condition.record", "iiot", "\u062B\u0628\u062A \u0642\u0631\u0627\u0626\u062A \u067E\u0627\u06CC\u0634 \u0648\u0636\u0639\u06CC\u062A \u062A\u062C\u0647\u06CC\u0632\u0627\u062A", "Record condition snapshot", "internal", true),
  /* توقف، NPT و یکپارچگی */
  P("iiot.downtime.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u0648\u0642\u0641\u0627\u062A \u062F\u06A9\u0644", "View rig downtime", "internal"),
  P("iiot.downtime.report", "iiot", "\u062B\u0628\u062A \u0648 \u0628\u0633\u062A\u0646 \u062A\u0648\u0642\u0641 \u062F\u06A9\u0644", "Report and close rig downtime", "internal", true),
  P("iiot.downtime.verify", "iiot", "\u062A\u0623\u06CC\u06CC\u062F \u062A\u0648\u0642\u0641 \u0648 \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u06AF\u0632\u0627\u0631\u0634 NPT", "Verify downtime and release NPT", "confidential", true),
  P("iiot.npt.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062C\u0645\u0639\u200C\u0628\u0646\u062F\u06CC \u0632\u0645\u0627\u0646 \u0646\u0627\u0645\u0648\u0644\u0651\u062F (NPT)", "View NPT summary", "internal"),
  P("iiot.integration.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0635\u0641 \u0631\u0648\u06CC\u062F\u0627\u062F \u06CC\u06A9\u067E\u0627\u0631\u0686\u06AF\u06CC \u0628\u06CC\u0646\u200C\u0628\u062E\u0634\u06CC", "View cross-module event outbox", "internal"),
  P("iiot.integration.dispatch", "iiot", "\u0627\u0631\u0633\u0627\u0644 \u0631\u0648\u06CC\u062F\u0627\u062F \u06CC\u06A9\u067E\u0627\u0631\u0686\u06AF\u06CC \u0628\u0647 \u0633\u0627\u0645\u0627\u0646\u0647\u0654 \u0645\u0642\u0635\u062F", "Dispatch cross-module event", "confidential", true),
  P("iiot.dashboard.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062F\u0627\u0634\u0628\u0648\u0631\u062F \u0632\u0646\u062F\u0647\u0654 \u067E\u0627\u06CC\u0634 \u0645\u06CC\u062F\u0627\u0646\u06CC", "View live field monitoring dashboard", "internal"),
  P("iiot.analytics.view", "iiot", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u062D\u0644\u06CC\u0644 \u0648 \u062A\u062C\u0645\u06CC\u0639 \u0633\u0631\u06CC \u0632\u0645\u0627\u0646\u06CC", "View telemetry analytics and rollups", "internal"),
  /* ── بخش ۶: مدیریت جامع منابع انسانی (HRM — ISO 30414 & قوانین کار و تأمین اجتماعی) ── */
  P("hrm.org.view", "hrm", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0686\u0627\u0631\u062A \u0633\u0627\u0632\u0645\u0627\u0646\u06CC\u060C \u0627\u062D\u06A9\u0627\u0645 \u0648 \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u0647\u0627\u06CC \u06A9\u0627\u0631", "View org chart, decrees and contracts", "internal"),
  P("hrm.org.manage", "hrm", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0686\u0627\u0631\u062A \u0633\u0627\u0632\u0645\u0627\u0646\u06CC\u060C \u0627\u062D\u06A9\u0627\u0645 \u06A9\u0627\u0631\u06AF\u0632\u06CC\u0646\u06CC \u0648 \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u0647\u0627", "Manage org chart, decrees and contracts", "confidential", true),
  P("hrm.skill.view", "hrm", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0645\u0627\u062A\u0631\u06CC\u0633 \u0645\u0647\u0627\u0631\u062A\u200C\u0647\u0627 \u0648 \u06AF\u0648\u0627\u0647\u06CC\u200C\u0646\u0627\u0645\u0647\u200C\u0647\u0627\u06CC \u0641\u0646\u06CC", "View skill matrix and technical certificates", "internal"),
  P("hrm.skill.manage", "hrm", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0645\u0627\u062A\u0631\u06CC\u0633 \u0645\u0647\u0627\u0631\u062A\u200C\u0647\u0627 \u0648 \u06AF\u0648\u0627\u0647\u06CC\u200C\u0646\u0627\u0645\u0647\u200C\u0647\u0627\u06CC \u0645\u062A\u0635\u0644 \u0628\u0647 CMMS/MES", "Manage skill matrix and technical certificates", "confidential", true),
  P("hrm.attendance.view", "hrm", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u062A\u0642\u0648\u06CC\u0645 \u06A9\u0627\u0631\u06CC\u060C \u0634\u06CC\u0641\u062A\u200C\u0647\u0627\u060C \u0645\u0631\u062E\u0635\u06CC \u0648 \u0645\u0623\u0645\u0648\u0631\u06CC\u062A", "View shift calendars, attendance, leaves and missions", "internal"),
  P("hrm.attendance.manage", "hrm", "\u062B\u0628\u062A \u0648 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0634\u06CC\u0641\u062A\u200C\u0628\u0646\u062F\u06CC\u060C \u06A9\u0627\u0631\u06A9\u0631\u062F\u060C \u0645\u0631\u062E\u0635\u06CC \u0648 \u0645\u0623\u0645\u0648\u0631\u06CC\u062A", "Manage shifts, attendance roster, leaves and missions", "confidential", true),
  P("hrm.payroll.view", "hrm", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0645\u062D\u0627\u0633\u0628\u0627\u062A \u062D\u0642\u0648\u0642 \u0648 \u062F\u0633\u062A\u0645\u0632\u062F \u0648 \u0641\u06CC\u0634 \u062D\u0642\u0648\u0642\u06CC", "View payroll runs and payslips", "confidential"),
  P("hrm.payroll.run", "hrm", "\u0627\u062C\u0631\u0627\u06CC \u0645\u062D\u0627\u0633\u0628\u0647\u0654 \u062D\u0642\u0648\u0642\u060C \u0628\u06CC\u0645\u0647\u060C \u0645\u0627\u0644\u06CC\u0627\u062A \u0648 \u0635\u062F\u0648\u0631 \u0641\u06CC\u0634", "Run payroll calculation and issue payslips", "restricted", true),
  P("hrm.payroll.approve", "hrm", "\u062A\u0635\u0648\u06CC\u0628 \u0646\u0647\u0627\u06CC\u06CC \u062D\u0642\u0648\u0642 \u0648 \u0627\u0631\u0633\u0627\u0644 \u0633\u0646\u062F \u0647\u0632\u06CC\u0646\u0647 \u0628\u0647 \u0645\u0627\u0644\u06CC", "Approve payroll and dispatch cost voucher to finance", "restricted", true),
  P("hrm.training.view", "hrm", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0646\u06CC\u0627\u0632\u0633\u0646\u062C\u06CC\u060C \u062F\u0648\u0631\u0647\u200C\u0647\u0627\u06CC \u0622\u0645\u0648\u0632\u0634\u06CC \u0648 \u0627\u062B\u0631\u0628\u062E\u0634\u06CC", "View training needs, courses and effectiveness", "internal"),
  P("hrm.training.manage", "hrm", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0646\u06CC\u0627\u0632\u0633\u0646\u062C\u06CC \u0622\u0645\u0648\u0632\u0634\u06CC\u060C \u062F\u0648\u0631\u0647\u200C\u0647\u0627 \u0648 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0627\u062B\u0631\u0628\u062E\u0634\u06CC", "Manage training needs, courses and Kirkpatrick evaluation", "confidential", true),
  P("hrm.performance.view", "hrm", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0627\u0647\u062F\u0627\u0641 KPI/OKR \u0648 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0639\u0645\u0644\u06A9\u0631\u062F \u06F3\u06F6\u06F0 \u062F\u0631\u062C\u0647", "View KPIs/OKRs and 360-degree performance reviews", "internal"),
  P("hrm.performance.manage", "hrm", "\u062A\u0639\u0631\u06CC\u0641 KPI/OKR \u0648 \u062B\u0628\u062A \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0639\u0645\u0644\u06A9\u0631\u062F \u06F3\u06F6\u06F0 \u062F\u0631\u062C\u0647", "Define KPIs/OKRs and manage 360-degree reviews", "confidential", true),
  /* ── بخش ۷: مدیریت اسناد، بایگانی دیجیتال و مدیریت دانش (EDMS / KMS — ISO 15489 / 30301 / 9001) ── */
  P("edms.document.view", "edms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0634\u0646\u0627\u0633\u0646\u0627\u0645\u0647\u0654 \u0627\u0633\u0646\u0627\u062F (DMI) \u0648 \u0627\u0644\u06AF\u0648\u0647\u0627\u06CC \u0634\u0645\u0627\u0631\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC", "View Document Master Index (DMI) and numbering rules", "internal"),
  P("edms.document.manage", "edms", "\u062B\u0628\u062A \u0648 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0634\u0646\u0627\u0633\u0646\u0627\u0645\u0647\u0654 \u0627\u0633\u0646\u0627\u062F \u0648 \u06A9\u062F\u06CC\u0646\u06AF \u062E\u0648\u062F\u06A9\u0627\u0631", "Manage DMI documents and auto-numbering rules", "confidential", true),
  P("edms.revision.view", "edms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0646\u0633\u062E\u0647\u200C\u0647\u0627\u06CC \u0627\u0633\u0646\u0627\u062F\u060C \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u0648 \u0648\u0636\u0639\u06CC\u062A \u0642\u0641\u0644", "View document revisions, diffs and check-out locks", "internal"),
  P("edms.revision.manage", "edms", "\u0635\u062F\u0648\u0631 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062C\u062F\u06CC\u062F\u060C Check-Out / Check-In \u0648 \u0645\u0642\u0627\u06CC\u0633\u0647\u0654 \u0646\u0633\u062E\u0647", "Issue revisions, check-out/check-in and compare diffs", "confidential", true),
  P("edms.workflow.view", "edms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u06AF\u0631\u062F\u0634\u200C\u06A9\u0627\u0631 \u0628\u0631\u0631\u0633\u06CC/\u062A\u0623\u06CC\u06CC\u062F \u0648 \u062A\u0631\u0627\u0646\u0633\u0645\u06CC\u062A\u0627\u0644\u200C\u0647\u0627", "View review/approval workflows and transmittals", "internal"),
  P("edms.workflow.approve", "edms", "\u0628\u0631\u0631\u0633\u06CC \u0641\u0646\u06CC \u0648 \u062A\u0623\u06CC\u06CC\u062F \u06AF\u0631\u062F\u0634\u200C\u06A9\u0627\u0631 \u0627\u0633\u0646\u0627\u062F", "Review and approve document workflow steps", "confidential", true),
  P("edms.transmittal.manage", "edms", "\u0635\u062F\u0648\u0631 \u0648 \u062B\u0628\u062A \u0628\u0631\u06AF\u0647\u0654 \u0627\u0631\u0633\u0627\u0644 \u0645\u062F\u0627\u0631\u06A9 (Transmittal)", "Issue and manage official transmittals", "confidential", true),
  P("edms.archive.view", "edms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u0632\u0648\u0646\u200C\u0628\u0646\u062F\u06CC \u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u062F\u06CC\u062C\u06CC\u062A\u0627\u0644\u060C OCR \u0648 \u062C\u0633\u062A\u062C\u0648\u06CC \u0645\u062A\u0646\u06CC", "View digital archive zones, OCR records and search", "internal"),
  P("edms.archive.manage", "edms", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u062F\u06CC\u062C\u06CC\u062A\u0627\u0644\u060C \u0627\u0633\u06A9\u0646 \u0648 \u0646\u0645\u0627\u06CC\u0647\u200C\u0633\u0627\u0632\u06CC OCR", "Manage digital archive zones, scanning and OCR indexing", "confidential", true),
  P("edms.kms.view", "edms", "\u0645\u0634\u0627\u0647\u062F\u0647\u0654 \u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u0646\u0634 (Wiki) \u0648 \u062F\u0631\u0648\u0633 \u0622\u0645\u0648\u062E\u062A\u0647\u200C\u0634\u062F\u0647 (KMS)", "View Knowledge Base Wiki and Lessons Learned", "internal"),
  P("edms.kms.manage", "edms", "\u062B\u0628\u062A \u0648 \u0627\u0646\u062A\u0634\u0627\u0631 \u062F\u0631\u0648\u0633 \u0622\u0645\u0648\u062E\u062A\u0647\u200C\u0634\u062F\u0647 \u0648 \u0645\u0642\u0627\u0644\u0627\u062A \u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u0646\u0634", "Author and publish KMS lessons learned and wiki articles", "confidential", true)
];
var PERMISSION_CODES = PERMISSION_CATALOG.map((p) => p.code);
var PERM_BY_CODE = new Map(PERMISSION_CATALOG.map((p) => [p.code, p]));
var ROLE_CATALOG = [
  {
    code: "viewer",
    title: { fa: "\u0628\u06CC\u0646\u0646\u062F\u0647", en: "Viewer" },
    inherits: [],
    clearance: "internal",
    party: "any",
    grants: [
      "core.portfolio.view",
      "core.project.view",
      "doc.document.view",
      "plan.schedule.view",
      "pex.dashboard.view",
      "gov.process.view",
      "report.internal.generate",
      "eng.mdr.view",
      "report.custom.view",
      "report.custom.run",
      /* P10: پرسیدن و دیدن بینش پایه به همهٔ بینندگان داده می‌شود، چون خودِ
       * ابزار برای هر منبع داده مجوز پایه را دوباره می‌سنجد و بخش بسته را
       * «بسته» اعلام می‌کند، نه صفر. تاریخچه و خروجی سند این‌طور نیستند. */
      "ai.assistant.ask",
      "ai.insight.view",
      "hrm.org.view",
      "hrm.skill.view",
      "hrm.attendance.view",
      "hrm.training.view",
      "hrm.performance.view",
      "edms.document.view",
      "edms.revision.view",
      "edms.workflow.view",
      "edms.archive.view",
      "edms.kms.view"
    ]
  },
  {
    code: "site_engineer",
    title: { fa: "\u0645\u0647\u0646\u062F\u0633/\u0633\u0631\u067E\u0631\u0633\u062A \u06A9\u0627\u0631\u06AF\u0627\u0647", en: "Site Engineer" },
    inherits: ["viewer"],
    clearance: "internal",
    party: "contractor",
    grants: [
      "cnt.measurement.record",
      "com.punch.record",
      "com.checksheet.record",
      "plan.progress.report",
      "doc.document.upload",
      "qms.itp.view",
      "qms.inspection.record",
      "hrm.roster.view",
      "hrm.timesheet.enter",
      "hrm.conflict.resolve",
      "ckm.meeting.record",
      "eng.tq.raise",
      "eng.crs.comment",
      "hse.permit.view",
      "hse.permit.request",
      "hse.jsa.view",
      "hse.jsa.edit",
      "hse.incident.record",
      "hse.permit.gastest",
      "hse.permit.isolation",
      "hse.permit.sign",
      "hse.capa.manage",
      "hse.manhour.record",
      "hse.finding.close",
      /* سرپرست کارگاه مسئول رفع تخلف و بستن یافته است؛ بدون مجوز
       * خواندن، تنها راه اطلاعش از توقف کارِ خودش کاغذ بود. خواندن
       * اختیار صدور یا آزادسازی نمی‌دهد. */
      "hse.violation.view",
      /* او تصمیم می‌گیرد چه کسی وارد جبههٔ کاری شود، پس باید بتواند
       * دروازه را استعلام کند. نتیجه سه‌گانه است، نه پروندهٔ پزشکی. */
      "hse.clearance.check",
      "hse.training.view",
      "hse.ppe.view",
      "hse.metrics.view",
      /* علت افت را کسی می‌داند که آن روز پای کار بوده. ثبت علت سطح
       * «داخلی» است تا سرپرست کارگاه بتواند بنویسد؛ تبدیلش به ادعا
       * سطح سری می‌خواهد و دست او نیست — SOD-20. */
      "hrm.rca.record",
      /* اکیپ را کسی می‌چیند که هر روز صبح جلوی نیروها می‌ایستد. ثبت
       * حضور گروهی پیمانکار هم کار اوست، ولی تأیید آن نه — SOD-21. */
      "hrm.crew.view",
      "hrm.crew.manage",
      "hrm.sub.record",
      /* سرپرست باید بداند نفرش مدرک معتبر دارد یا نه — بدون دیدن کد
       * ملی. اسکن مدرک را او می‌فرستد ولی اصالتش را تأیید نمی‌کند
       * (SOD-24)، و مهارت را ارزیابی می‌کند چون کار او را دیده. */
      "hrm.person.view",
      "hrm.doc.upload",
      "hrm.skill.assess",
      "hrm.mob.request",
      /* گوشی اکیپ خودش را می‌بیند؛ بدون آن نمی‌فهمد چرا برگه‌هایش
       * در سامانه نیست. */
      "hrm.device.monitor",
      /* تصمیم تخصیص نیرو در کارگاه گرفته می‌شود؛ بدون دیدن هیستوگرام
       * رستهٔ خودش، آن تصمیم کور است. */
      "hrm.analytics.view",
      /* P7/CPMS: ثبت گزارش روزانه و دیسیپلینی و درخواست بازرسی کار کارگاه
       * است؛ تأیید گزارش و آزادسازی QC دست او نیست. */
      "cpm.workarea.view",
      "cpm.dpr.view",
      "cpm.dpr.record",
      "cpm.discipline.view",
      "cpm.discipline.record",
      "cpm.inspection.view",
      "cpm.inspection.request",
      "pmo.form.view",
      "pmo.form.submit",
      "cnt.ipc.prepare",
      "pmo.health.view"
    ]
  },
  {
    code: "planner",
    title: { fa: "\u06A9\u0627\u0631\u0634\u0646\u0627\u0633 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC", en: "Planner" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "plan.schedule.edit",
      "plan.progress.report",
      "pex.evm.view",
      "pex.forecast.edit",
      "rcc.risk.view",
      "rcc.issue.view",
      "core.ai.run",
      /* بهره‌وری کار روزمرهٔ برنامه‌ریز است: او بودجهٔ نفر-ساعت را
       * بسته و باید بداند مصرف واقعی کجا از آن جدا شد. محاسبه با
       * اوست، ولی نهایی‌سازی نه — SOD-19. */
      "hrm.productivity.view",
      "hrm.productivity.compute",
      "hrm.rate.calibrate",
      "hrm.rca.record",
      /* نرخ استفادهٔ اکیپ ورودی مستقیم برنامه‌ریزی منابع است؛ دیدن
       * کافی است، چیدن اکیپ کار کارگاه است. */
      "hrm.crew.view",
      /* کسری نیرو در برنامهٔ او دیده می‌شود، پس درخواست تجهیز هم از
       * همان‌جا زده می‌شود؛ تأییدش نه. */
      "hrm.mob.request",
      /* هیستوگرام و منحنی S ابزار اصلی برنامه‌ریز است، و مبنای نیرو
       * محصول کار خود اوست. */
      "hrm.analytics.view",
      "hrm.plan.baseline",
      "hrm.device.monitor",
      /* P7/CPMS: تخصیص WBS به پیمانکار کار برنامه‌ریزی است؛ ثبت گزارش
       * روزانه و آزادسازی QC سمت کارگاه و کیفیت است. */
      "cpm.workarea.view",
      "cpm.workarea.edit",
      "cpm.dpr.view",
      "cpm.discipline.view",
      "cpm.inspection.view",
      "pmo.charter.view",
      "pmo.form.view",
      "pmo.health.view",
      "report.custom.edit",
      "itg.connector.view",
      "itg.export.run",
      "itg.primavera.push"
    ]
  },
  {
    code: "cost_controller",
    title: { fa: "\u06A9\u0646\u062A\u0631\u0644 \u0647\u0632\u06CC\u0646\u0647", en: "Cost Controller" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "eqm.workspace.view",
      "cnt.contract.view",
      "cnt.ipc.prepare",
      "fin.cost.view",
      "fin.ipc.prepare",
      "fin.invoice.issue",
      "fin.rate.view",
      "pex.evm.view",
      "hrm.productivity.view",
      "core.ai.run",
      /* هزینهٔ نیروی پیمانکاری بخشی از هزینهٔ مستقیم پروژه است و
       * کنترل هزینه باید مبنای آن را ببیند؛ ثبت و تأیید دست او نیست. */
      "hrm.crew.view",
      "hrm.sub.view",
      "hrm.analytics.view",
      /* کنترل هزینه مغایرت دو دفتر را می‌بیند — این دقیقاً کار اوست.
       * ولی ارسال نمی‌کند چون تهیه‌کنندهٔ صورت‌وضعیت مالی است. */
      "cnt.fin.view",
      /* شکاف میان دفتر داخلی و سامانهٔ بیرونی را می‌بیند؛ تلاش دوباره
       * دست او نیست چون هر تلاش یک نوشتن در سامانهٔ بیرونی است. */
      "core.event.view",
      /* LIVE-1: ثبت هزینه، مطالبات، PR/PO و موجودی کار روزانهٔ اوست؛
       * تأیید PR و آزادسازی ذخیره دست مدیر پروژه است. */
      "fin.cost.post",
      "fin.procure.edit",
      "scm.vendor.view",
      "scm.vendor.manage",
      "scm.package.view",
      "scm.package.edit",
      "scm.bidder.view",
      "scm.bidder.manage",
      "scm.mr.view",
      "scm.mr.manage",
      "scm.mrr.view",
      "scm.mrr.post",
      "cnt.contract.view",
      "cnt.ipctemplate.edit",
      "cnt.ipc.prepare",
      "pmo.health.view",
      "pmo.form.view",
      "hrm.payroll.view"
    ]
  },
  {
    code: "qc_inspector",
    title: { fa: "\u0628\u0627\u0632\u0631\u0633 \u06A9\u06CC\u0641\u06CC\u062A", en: "QC Inspector" },
    inherits: ["viewer"],
    clearance: "internal",
    party: "any",
    grants: [
      "qms.itp.view",
      "qms.inspection.record",
      "qms.ncr.raise",
      "com.checksheet.record",
      "com.checksheet.sign",
      /* P7/CPMS: آزادسازی و رد درخواست بازرسی فقط با بازرس کیفیت است و
       * موتور، ثبت‌کنندهٔ درخواست را از آزادسازی همان درخواست منع می‌کند. */
      "cpm.workarea.view",
      "cpm.dpr.view",
      "cpm.discipline.view",
      "cpm.inspection.view",
      "cpm.inspection.release",
      "mfg.execution.view",
      /* گیت کیفیت در زنجیرهٔ کارکرد: تطبیق ساعت ثبت‌شده با پیشرفت
       * تأییدشده. بدون این، ساعت روی فعالیتی می‌نشیند که اصلاً اجرا
       * نشده است. */
      "hrm.timesheet.verify",
      "pmo.form.view",
      "pmo.form.submit",
      "pmo.health.view"
    ]
  },
  {
    code: "qa_manager",
    title: { fa: "\u0645\u062F\u06CC\u0631 \u062A\u0636\u0645\u06CC\u0646 \u06A9\u06CC\u0641\u06CC\u062A", en: "QA Manager" },
    // عمداً از qc_inspector ارث نمی‌برد: صدور و بستن عدم انطباق باید جدا بماند (SOD-02).
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "qms.itp.view",
      "qms.ncr.close",
      "qms.audit.conduct",
      "gov.gate.review",
      "doc.document.approve",
      /* تأیید تحقیق حادثه عمداً به مدیر تضمین کیفیت داده می‌شود نه افسر
       * ایمنی: افسر ایمنی خودش سرپرست تحقیق است و موتور تأیید توسط
       * سرپرست را رد می‌کند. بدون این گرنت هیچ تحقیقی تأیید نمی‌شد. */
      "hse.investigation.approve",
      "hse.capa.verify",
      /* آزادسازی تخلف عمداً از افسر ایمنی جدا شد: موتور صادرکننده را از
       * آزادسازی منع می‌کند و افسر ایمنی معمولاً خودش صادرکننده است. */
      "hse.violation.release",
      "hse.inspection.conduct",
      "hse.violation.view",
      "pmo.form.view",
      "pmo.form.submit",
      "pmo.health.view",
      "pmo.health.record",
      "hrm.training.manage",
      "edms.workflow.approve",
      "edms.archive.manage",
      "edms.kms.manage"
    ]
  },
  {
    code: "hr_manager",
    title: { fa: "\u0645\u062F\u06CC\u0631 \u0645\u0646\u0627\u0628\u0639 \u0627\u0646\u0633\u0627\u0646\u06CC", en: "HR Manager" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: [
      "hrm.roster.view",
      "hrm.timesheet.approve",
      "hrm.rate.view",
      "hrm.personal.view",
      "hrm.productivity.view",
      "hrm.timesheet.sign",
      "hrm.adjustment.raise",
      "hrm.conflict.resolve",
      /* ارسال هزینهٔ کارکرد به مالی سطح دسترسی «محرمانه‌تر» می‌خواهد
       * چون نرخ دستمزد را لمس می‌کند؛ کنترل هزینه آن سطح را ندارد و
       * مدیر پروژه به‌خاطر SOD-17 نمی‌تواند. */
      /* گیت hseTraining از سوابق آموزش HSE خوانده می‌شود، پس مدیر
       * منابع انسانی باید بتواند بخواند — ولی نه بنویسد: منبع حقیقت
       * یکی است و آن ماژول ایمنی است. */
      "hse.training.view",
      "hse.clearance.check",
      /* پروندهٔ طب کار سطح «سری» دارد و این نقش تنها نقش سطح سری با
       * مسئولیت سلامت نیروی انسانی است. */
      "hse.health.record",
      "hse.health.view",
      /* اکیپ واحد پایهٔ سازمان نیروی انسانی است؛ چیدن، جابه‌جایی و
       * انحلال آن کار مدیر منابع انسانی است. */
      "hrm.crew.view",
      "hrm.crew.manage",
      "hrm.crew.disband",
      /* تأیید حضور گروهی پیمانکار دروازهٔ ورود ساعت به صورت‌کارکرد
       * است؛ ثبت‌کننده در کارگاه است و تأییدکننده اینجا — SOD-21. */
      "hrm.sub.view",
      "hrm.sub.verify",
      "hrm.analytics.view",
      "hrm.analytics.export",
      "hrm.device.monitor",
      /* نرخ را تعریف می‌کند (کار قراردادی-پرسنلی اوست) ولی ارسال
       * هزینه را نه — SOD-28. */
      "hrm.rate.view",
      "hrm.rate.manage",
      /* پروندهٔ پرسنلی خانهٔ اصلی این نقش است: ثبت، تأیید اصالت مدرک،
       * فعال‌سازی پس از گیت‌ها و تخلیه. */
      "hrm.person.view",
      "hrm.person.manage",
      "hrm.person.activate",
      "hrm.person.demobilize",
      "hrm.doc.verify",
      "hrm.skill.assess",
      "hrm.org.manage",
      "hrm.skill.manage",
      "hrm.attendance.manage",
      "hrm.payroll.view",
      "hrm.payroll.run",
      "hrm.payroll.approve",
      "hrm.training.manage",
      "hrm.performance.manage",
      "edms.kms.manage"
    ]
  },
  {
    code: "doc_controller",
    title: { fa: "\u06A9\u0646\u062A\u0631\u0644 \u0645\u062F\u0627\u0631\u06A9", en: "Document Controller" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "doc.document.upload",
      "doc.transmittal.issue",
      "ckm.letter.view",
      "ckm.letter.draft",
      "ckm.meeting.record",
      "ckm.lesson.publish",
      "ckm.notify.manage",
      "eng.mdr.edit",
      "eng.revision.issue",
      "edms.document.manage",
      "edms.revision.manage",
      "edms.transmittal.manage",
      "edms.archive.manage",
      "edms.kms.manage"
    ]
  },
  {
    code: "contracts_manager",
    title: { fa: "\u0645\u062F\u06CC\u0631 \u067E\u06CC\u0645\u0627\u0646 \u0648 \u0627\u062F\u0639\u0627", en: "Contracts Manager" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: [
      "rcc.claim.view",
      "rcc.claim.edit",
      "rcc.change.raise",
      "rcc.issue.view",
      "rcc.issue.edit",
      "rcc.delay.view",
      "rcc.delay.edit",
      "rcc.delay.calculate",
      "fin.cost.view",
      "fin.rate.view",
      "ckm.letter.view",
      "ckm.letter.draft",
      "cnt.contract.view",
      "cnt.contract.edit",
      "cnt.boq.edit",
      "cnt.ipc.prepare",
      "cnt.retainage.manage",
      "com.certificate.view",
      /* ثبت و تمدید ضمانت‌نامه کار روزمرهٔ مدیر پیمان است، ولی
       * آزادسازی و ضبط عمداً به او داده نشده: کسی که سند را ثبت
       * می‌کند نباید بتواند خودش وثیقه را برگرداند. */
      "cnt.guarantee.view",
      "cnt.guarantee.manage",
      "cnt.advance.manage",
      /* تهیه با مدیر پیمان، تأیید با مدیر پروژه — SOD-14. */
      "cnt.subipc.view",
      "cnt.subipc.prepare",
      "cnt.backtoback.manage",
      "cnt.progress.view",
      "cnt.milestone.manage",
      "cnt.kpi.view",
      "cnt.kpi.snapshot",
      /* مدیر پیمان گزارش را می‌سازد؛ صدور رسمی امضای بالاتر می‌خواهد. */
      "cnt.report.view",
      /* مدیر پیمان تطبیق را می‌بیند تا بداند چه چیزی ارسال نشده، ولی
       * خودش ارسال نمی‌کند: او تهیه‌کنندهٔ صورت‌وضعیت است. */
      "cnt.fin.view",
      /* پروندهٔ ادعا اینجا ساخته می‌شود، پس پیوند علت افت بهره‌وری به
       * ادعا هم باید همین‌جا باشد؛ همراهش دیدن بهره‌وری لازم است
       * وگرنه ادعای بی‌عدد نوشته می‌شود. */
      "hrm.productivity.view",
      "hrm.claim.link",
      /* قرارداد نیروی پیمانکاری از جنس پیمان است نه از جنس استخدام:
       * نرخ توافقی، حسن انجام کار و جریمه اینجا بسته می‌شود. تهیهٔ
       * صورت‌کارکرد هم با اوست، ولی تأیید نه — SOD-22 و SOD-23. */
      "hrm.sub.view",
      "hrm.sub.manage",
      "hrm.subipc.prepare",
      "cnt.contract.view",
      "cnt.ipctemplate.edit",
      "cnt.ipc.prepare",
      "pmo.charter.view",
      "pmo.form.view",
      "itg.connector.view"
    ]
  },
  {
    code: "project_manager",
    title: { fa: "\u0645\u062F\u06CC\u0631 \u067E\u0631\u0648\u0698\u0647", en: "Project Manager" },
    // عمداً از نقش‌های «تهیه‌کننده» ارث نمی‌برد؛ اقتدار مدیر پروژه تأیید است نه ثبت داده.
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: [
      "spm.plan.view",
      "oex.assessment.view",
      "eqm.workspace.view",
      "eqm.dispatch.approve",
      /* P7/CPMS: مدیر پروژه گزارش پیمانکار و دیسیپلینی را تأیید می‌کند،
       * ولی آزادسازی QC سمت خودش نیست. */
      "cpm.workarea.view",
      "cpm.dpr.view",
      "cpm.dpr.approve",
      "cpm.discipline.view",
      "cpm.discipline.approve",
      "cpm.inspection.view",
      "core.project.edit",
      "core.ai.run",
      "plan.baseline.set",
      "plan.progress.approve",
      "pex.evm.view",
      "pex.kpi.edit",
      "pex.forecast.edit",
      "rcc.risk.view",
      "rcc.risk.edit",
      "rcc.change.raise",
      "rcc.claim.view",
      "rcc.claim.submit",
      "rcc.claim.decide",
      "rcc.issue.view",
      "rcc.issue.edit",
      "rcc.issue.escalate",
      "rcc.delay.view",
      "rcc.delay.edit",
      "rcc.delay.calculate",
      "rcc.delay.approve",
      "fin.cost.view",
      "fin.rate.view",
      "fin.ipc.approve",
      "fin.procure.approve",
      "fin.reserve.draw",
      "qms.itp.view",
      "qms.ncr.close",
      "hrm.roster.view",
      "hrm.timesheet.approve",
      "hrm.productivity.view",
      /* مدیر پروژه عدد را نهایی می‌کند و دوره را می‌بندد، ولی ارسال به
       * دفتر مالی دست کنترل هزینه است: سازندهٔ عدد نباید ثبت‌کنندهٔ
       * آن در دفتر باشد. */
      "hrm.timesheet.finalize",
      "hrm.period.lock",
      "hrm.adjustment.approve",
      /* قفل کردن عدد بهره‌وری دوره همان جنس اقتدار قفل دوره است:
       * برگشت‌ناپذیر و مبنای گزارش رسمی به کارفرما. */
      "hrm.metric.finalize",
      /* تأیید صورت‌کارکرد نیروی پیمانکاری همان الگوی SOD-14 است:
       * تأییدکننده دارد نقدینگی پروژه را خرج می‌کند و باید پاسخ‌گو
       * باشد. انحلال اکیپ هم اثر برنامه‌ای دارد، پس دست اوست. */
      "hrm.crew.view",
      "hrm.crew.disband",
      "hrm.sub.view",
      "hrm.subipc.approve",
      /* تجهیز نیرو یعنی تعهد بودجهٔ نفر-ساعت دوره؛ تأییدش با کسی است
       * که پاسخ‌گوی هزینهٔ پروژه است، نه با درخواست‌دهنده (SOD-25). */
      /* گزارش رسمی را امضا می‌کند ولی مبنا را نمی‌نویسد — SOD-27.
       * ثبت مبنا کار برنامه‌ریزی است و او تأییدکنندهٔ نتیجه. */
      "hrm.person.view",
      "hrm.mob.approve",
      "hrm.analytics.view",
      "hrm.analytics.export",
      /* سطح سوم امضای پروانهٔ کار «مدیر منطقه» است؛ در ساختار فعلی
       * مدیر پروژه این نقش را دارد. بدون این گرنت هیچ‌کس نمی‌تواند
       * زنجیرهٔ امضا را کامل کند و هیچ پروانه‌ای صادر نمی‌شود. */
      "hse.permit.view",
      "hse.permit.sign",
      "hse.jsa.view",
      /* دستور توقف کار برنامهٔ زمانی مدیر پروژه را می‌شکند و مبنای ادعای
       * تمدید است؛ او باید آن را ببیند، هرچند نه صادر و نه آزاد کند. */
      "hse.violation.view",
      "hse.incident.record",
      /* تعهد زیست‌محیطی و آموزش، الزام قراردادی کارفرماست. */
      "hse.env.view",
      "hse.training.view",
      /* تأیید صورت‌وضعیت پیمانکار جزء با مدیر پروژه است نه مدیر
       * پیمان (SOD-14): تأییدکننده دارد نقدینگی پیمانکار اصلی را خرج
       * می‌کند و همان کسی باید باشد که پاسخ‌گوی آن است. */
      "scm.vendor.view",
      "scm.vendor.manage",
      "scm.package.view",
      "scm.package.edit",
      "scm.bidder.view",
      "scm.bidder.manage",
      "scm.mr.view",
      "scm.mr.manage",
      "scm.mrr.view",
      "scm.mrr.post",
      "cnt.subipc.view",
      "cnt.subipc.approve",
      "cnt.progress.view",
      /* تنظیم آستانه با مدیر پروژه است نه مدیر پیمان: مدیر پیمان
       * سنجه‌شونده است و نباید بتواند معیار سنجش خودش را بازتعریف
       * کند. */
      "cnt.kpi.view",
      "cnt.kpi.snapshot",
      "cnt.alertrule.manage",
      /* ارسال به مالی با مدیر پروژه است نه مدیر پیمان — SOD-15. */
      "cnt.fin.view",
      "cnt.fin.post",
      "cnt.report.view",
      "cnt.report.issue",
      /* نمرهٔ ایمنی وارد شاخص سلامت پروژه می‌شود و مدیر پروژه پاسخ‌گوی
       * آن گزارش است، پس انتشار دوره با اوست. */
      "hse.metrics.view",
      "hse.metrics.publish",
      "doc.document.approve",
      "doc.transmittal.issue",
      "ckm.letter.view",
      "ckm.letter.draft",
      "ckm.letter.sign",
      /* LIVE-2: مدیر پروژه صورت‌جلسه را تصویب می‌کند (ثبت‌کننده ≠ تصویب‌کننده
       * در سرور)، مالک برنامهٔ ارتباطات است و درس‌آموخته را تأیید می‌کند. */
      "ckm.meeting.record",
      "ckm.lesson.publish",
      "ckm.stakeholder.edit",
      "ckm.notify.manage",
      "gov.gate.review",
      "report.official.publish",
      "eng.ifc.release",
      "eng.mr.approve",
      "eng.tq.answer",
      /* مدیر پروژه متره ثبت می‌کند چون کلید دور زدن دروازهٔ کیفی دست
       * اوست و باید بتواند همان‌جا ثبت را تمام کند؛ ولی عمداً
       * `cnt.boq.edit` ندارد تا نرخ را نتواند تغییر دهد. */
      "cnt.contract.view",
      "cnt.measurement.record",
      "cnt.ipc.override",
      "com.punch.record",
      "com.certificate.view",
      "com.system.view",
      "com.milestone.manage",
      "pmo.charter.view",
      "pmo.charter.edit",
      "pmo.form.view",
      "pmo.form.approve",
      "pmo.health.view",
      "pmo.health.record",
      "cnt.contract.view",
      "cnt.ipc.approve",
      "gov.process.edit",
      "report.custom.publish",
      "itg.connector.view",
      "itg.export.run",
      "itg.calendar.sync",
      "hrm.org.manage",
      "hrm.skill.manage",
      "hrm.attendance.manage",
      "hrm.payroll.view",
      "hrm.payroll.approve",
      "hrm.training.manage",
      "hrm.performance.manage",
      "edms.document.manage",
      "edms.workflow.approve",
      "edms.transmittal.manage",
      "edms.kms.manage"
    ]
  },
  {
    /* افسر ایمنی پروانه را تأیید و می‌بندد و ارزیابی ریسک را تصویب می‌کند،
     * ولی درخواست‌دهنده یا تدوین‌کنندهٔ آنها نیست؛ تفکیک وظیفه علاوه بر
     * این ماتریس، در خودِ موتور هم اعمال می‌شود (canApprovePermit و
     * canApproveJsa تصویب‌کنندهٔ برابر با تهیه‌کننده را رد می‌کنند). */
    code: "hse_officer",
    title: { fa: "\u0627\u0641\u0633\u0631 \u0627\u06CC\u0645\u0646\u06CC \u0648 \u0628\u0647\u062F\u0627\u0634\u062A", en: "HSE Officer" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "hse.permit.view",
      "hse.permit.request",
      "hse.permit.approve",
      "hse.jsa.view",
      "hse.jsa.edit",
      "hse.jsa.approve",
      "hse.incident.record",
      "hse.incident.close",
      "hse.inspection.record",
      "hse.permit.gastest",
      "hse.permit.isolation",
      "hse.permit.sign",
      "hse.permit.suspend",
      "hse.investigation.manage",
      "hse.capa.manage",
      "hse.capa.verify",
      "hse.manhour.record",
      "hse.inspection.conduct",
      "hse.finding.close",
      "hse.violation.view",
      "hse.violation.issue",
      "hse.violation.stopwork",
      /* آموزش، تجهیزات و محیط‌زیست کار روزمرهٔ افسر ایمنی است. ثبت
       * پروندهٔ پزشکی عمداً نیست: آن کار پزشک طب کار است و سطح «سری»
       * دارد؛ افسر ایمنی فقط نتیجهٔ سه‌گانهٔ دروازه را می‌بیند. */
      "hse.training.manage",
      "hse.training.view",
      "hse.ppe.issue",
      "hse.clearance.check",
      "hse.waste.record",
      "hse.env.record",
      "hse.env.view",
      "hse.ppe.view",
      /* افسر ایمنی هشدارها را تنظیم می‌کند چون او پاسخ‌گوی آن‌هاست،
       * ولی انتشار عکس دوره دست او نیست: کسی که عدد را می‌سازد نباید
       * همان کسی باشد که آن را برای کارفرما نهایی می‌کند. */
      "hse.metrics.view",
      "hse.alert.configure",
      "hse.health.view",
      "com.system.view",
      "hrm.roster.view"
    ]
  },
  {
    /* مدیر راه‌اندازی صاحب ساختار سیستمی و مجری آزمون‌هاست، ولی عمداً
     * `com.certificate.issue` ندارد: صدور گواهی تصمیم کارفرماست و کسی که
     * آزمون را اجرا می‌کند نباید قبولی خودش را هم تأیید کند. */
    code: "commissioning_manager",
    title: { fa: "\u0645\u062F\u06CC\u0631 \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0648 \u062A\u062D\u0648\u06CC\u0644", en: "Commissioning Manager" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "com.system.view",
      "com.system.edit",
      "com.milestone.manage",
      "com.checksheet.record",
      "com.checksheet.sign",
      "com.punch.record",
      "com.certificate.view",
      /* دروازهٔ آمادگی راه‌اندازی پروانهٔ باز را می‌سنجد، پس مدیر راه‌اندازی
       * باید پروانه‌ها را ببیند — ولی تأییدشان با افسر ایمنی است. */
      "hse.permit.view",
      "qms.itp.view",
      "qms.inspection.record",
      "doc.document.upload",
      "plan.progress.report"
    ]
  },
  {
    code: "engineering_manager",
    title: { fa: "\u0645\u062F\u06CC\u0631 \u0645\u0647\u0646\u062F\u0633\u06CC \u0648 \u0637\u0631\u0627\u062D\u06CC", en: "Engineering Manager" },
    /* عمداً از doc_controller ارث نمی‌برد: مدیر مهندسی صادرکنندهٔ ریویژن
     * نیست بلکه تأییدکنندهٔ آزادسازی ساخت است (SOD-08). */
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "eng.mdr.view",
      "eng.mdr.edit",
      "eng.review.code",
      "eng.crs.resolve",
      "eng.tq.answer",
      "eng.vpr.review",
      "eng.ifc.release",
      "eng.mr.approve",
      "doc.document.approve",
      "core.ai.run",
      "report.internal.generate",
      "report.custom.edit",
      "itg.connector.view",
      "edms.document.manage",
      "edms.revision.manage",
      "edms.workflow.approve",
      "edms.kms.manage"
    ]
  },
  {
    code: "design_lead",
    title: { fa: "\u0633\u0631\u067E\u0631\u0633\u062A \u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646 \u0637\u0631\u0627\u062D\u06CC", en: "Design Discipline Lead" },
    /* ثبت و صدور می‌کند ولی کد بررسی نمی‌زند و نظر خودش را نمی‌بندد.
     * سطح «محرمانه» لازم است چون ثبت مدرک و صدور درخواست کالا هر دو در
     * این طبقه‌بندی‌اند؛ با سطح «داخلی» نقش عملاً بی‌اثر می‌شد. */
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "eng.mdr.view",
      "eng.mdr.edit",
      "eng.revision.issue",
      "eng.crs.comment",
      "eng.tq.raise",
      "eng.mr.raise",
      "doc.document.upload",
      "core.ai.run"
    ]
  },
  {
    code: "pmo",
    title: { fa: "\u062F\u0641\u062A\u0631 \u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0631\u0648\u0698\u0647", en: "PMO" },
    inherits: ["planner"],
    clearance: "restricted",
    party: "contractor",
    grants: [
      "spm.plan.view",
      "spm.plan.edit",
      "oex.assessment.view",
      "oex.assessment.edit",
      "eqm.workspace.view",
      "eqm.workspace.manage",
      "gov.process.view",
      "gov.gate.review",
      "gov.owner.assign",
      "pex.kpi.edit",
      "rcc.risk.edit",
      "rcc.issue.view",
      "rcc.issue.edit",
      "rcc.issue.escalate",
      "fin.cost.view",
      "report.official.publish",
      "report.export.bulk",
      "sys.audit.view",
      /* ارسال هزینهٔ نیرو به دفتر مالی.
       *
       * نه مدیر منابع انسانی (نرخ را او تعریف می‌کند — SOD-28) و نه
       * مدیر پروژه (کارکرد را او نهایی می‌کند — SOD-17). PMO تنها
       * نقشی است که هیچ‌کدام از دو سرِ زنجیره را در دست ندارد. */
      "hrm.cost.post",
      /* PMO ارسال را می‌زند، پس باید ببیند به مقصد رسیده یا نه و
       * بتواند دوباره تلاش کند (D13). */
      "core.event.view",
      "core.event.replay",
      /* P7/CPMS: PMO تأییدکنندهٔ گزارش روزانه و دیسیپلینی است و حوزهٔ
       * کاری پیمانکار را تعریف می‌کند؛ آزادسازی QC سمت بازرس است. */
      "cpm.workarea.view",
      "cpm.workarea.edit",
      "cpm.dpr.view",
      "cpm.dpr.approve",
      "cpm.discipline.view",
      "cpm.discipline.approve",
      "cpm.inspection.view",
      "pmo.charter.view",
      "pmo.charter.edit",
      "pmo.form.view",
      "pmo.form.manage",
      "pmo.form.submit",
      "pmo.health.view",
      "pmo.health.record",
      "cnt.contract.view",
      "gov.process.edit",
      /* P9: خروجی و همگام‌سازی سامانه‌های بیرونی کار PMO است. انتشار قالب
       * گزارش به PMO داده نشد چون تحریر آن (از طریق planner) در همین نقش
       * است و SOD-31 تحریر و انتشار را از هم جدا می‌کند. */
      "itg.connector.view",
      "itg.export.run",
      "itg.primavera.push",
      "itg.calendar.sync",
      /* P10: تاریخچهٔ پرسش‌وپاسخ و خروجی سند، کار گزارش‌دهی PMO است. */
      "ai.history.view",
      "ai.export.run",
      "hrm.payroll.view",
      "hrm.payroll.approve",
      "hrm.performance.manage",
      "edms.document.manage",
      "edms.workflow.approve",
      "edms.archive.manage",
      "edms.kms.manage"
    ]
  },
  {
    code: "executive",
    title: { fa: "\u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F", en: "Executive" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: [
      "spm.plan.view",
      "spm.plan.edit",
      "oex.assessment.view",
      "oex.assessment.edit",
      "eqm.workspace.view",
      "eqm.dispatch.approve",
      "fin.cost.view",
      "fin.budget.edit",
      "fin.reserve.draw",
      "pex.evm.view",
      "rcc.change.approve",
      "gov.gate.approve",
      "rcc.claim.view",
      "rcc.claim.decide",
      "rcc.issue.view",
      "rcc.issue.escalate",
      "core.ai.run",
      "pmo.charter.view",
      "pmo.charter.approve",
      "pmo.health.view",
      "pmo.health.approve",
      "cnt.contract.view",
      "cnt.ipc.approve",
      "report.custom.publish",
      "itg.connector.view",
      "ai.history.view",
      "ai.export.run"
    ]
  },
  {
    code: "consultant",
    title: { fa: "\u0645\u0634\u0627\u0648\u0631 / \u0646\u0638\u0627\u0631\u062A", en: "Consultant" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "consultant",
    grants: [
      "doc.document.approve",
      "plan.progress.approve",
      "qms.itp.view",
      "qms.inspection.record",
      "qms.ncr.raise",
      "fin.ipc.prepare",
      "cnt.contract.view",
      "cnt.ipc.review",
      "cnt.guarantee.view",
      "cnt.progress.view",
      "cnt.kpi.view",
      "cnt.report.view",
      "com.punch.record",
      "com.certificate.view",
      "ckm.letter.view",
      "ckm.letter.draft",
      "gov.gate.review",
      "eng.mdr.view",
      "eng.review.code",
      "eng.crs.resolve",
      "eng.vpr.review"
    ]
  },
  {
    code: "client",
    title: { fa: "\u06A9\u0627\u0631\u0641\u0631\u0645\u0627", en: "Client" },
    inherits: ["viewer"],
    // سطح «سری»: نمایندهٔ کارفرما صورت‌وضعیت را تأیید و نامهٔ رسمی را امضا می‌کند.
    // جداسازی دادهٔ پیمانکار از کارفرما محور جداگانه‌ای است (party) نه سطح دسترسی.
    clearance: "restricted",
    party: "client",
    grants: [
      "fin.cost.view",
      "fin.ipc.approve",
      "cnt.contract.view",
      "cnt.ipc.approve",
      /* آزادسازی و ضبط وثیقه تصمیم کارفرماست: پول از جیب او رفته و
       * برگشتنش هم به تشخیص او. */
      "cnt.guarantee.view",
      "cnt.guarantee.release",
      "cnt.progress.view",
      "cnt.kpi.view",
      "cnt.report.view",
      "com.certificate.view",
      "com.certificate.issue",
      "pex.evm.view",
      "rcc.change.approve",
      "rcc.claim.view",
      "rcc.claim.decide",
      "rcc.delay.view",
      "rcc.delay.approve",
      "gov.gate.approve",
      "ckm.letter.view",
      "ckm.letter.sign",
      "doc.document.approve",
      "eng.review.code",
      "eng.crs.resolve",
      "eng.tq.answer",
      "pmo.charter.view",
      "pmo.charter.approve",
      "pmo.health.view",
      "pmo.health.approve"
    ]
  },
  {
    code: "subcontractor",
    title: { fa: "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u062C\u0632\u0621", en: "Subcontractor" },
    inherits: [],
    clearance: "internal",
    party: "subcontractor",
    grants: [
      "core.project.view",
      "plan.schedule.view",
      "plan.progress.report",
      "doc.document.view",
      "hrm.timesheet.enter",
      "qms.itp.view",
      /* P7/CPMS: پیمانکار جزء گزارش روزانه و دیسیپلینی خودش را ثبت می‌کند،
       * ولی تأیید و آزادسازی با کارفرما/QC است. */
      "cpm.workarea.view",
      "cpm.dpr.view",
      "cpm.dpr.record",
      "cpm.discipline.view",
      "cpm.discipline.record",
      "cpm.inspection.view",
      "cpm.inspection.request",
      /* P10: دستیار برای پیمانکار جزء فقط همان دادهٔ خودش را می‌بیند؛ بخش‌های
       * بیرون از مجوزش «بسته» اعلام می‌شود. */
      "ai.assistant.ask",
      "ai.insight.view"
    ]
  },
  {
    code: "auditor",
    title: { fa: "\u0645\u0645\u06CC\u0632 \u062F\u0627\u062E\u0644\u06CC", en: "Internal Auditor" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "any",
    grants: [
      "sys.audit.view",
      "qms.audit.conduct",
      "fin.cost.view",
      "fin.rate.view",
      "rcc.claim.view",
      "rcc.issue.view",
      "ckm.letter.view",
      "hrm.productivity.view",
      "itg.connector.view",
      /* P10: ممیز باید ببیند چه پرسشی از داده پرسیده شده و کدام منبع
       * خوانده شده؛ ولی خودش خروجی سند نمی‌گیرد. */
      "ai.history.view"
    ]
  },
  /* d17 — نقش‌های تولید مستقل از نقش‌های پروژه‌ای‌اند. دسترسی هر نقش
   * علاوه بر این مجوزها، در زمان ارزیابی به plantIds کاربر هم محدود می‌شود. */
  {
    code: "manufacturing_engineer",
    title: { fa: "\u0645\u0647\u0646\u062F\u0633 \u0633\u0627\u062E\u062A \u0648 \u0641\u0631\u0627\u06CC\u0646\u062F", en: "Manufacturing Engineer" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: [
      "mfg.part.view",
      "mfg.part.edit",
      "mfg.bom.view",
      "mfg.bom.edit",
      "mfg.bom.release",
      "mfg.routing.view",
      "mfg.routing.edit",
      "mfg.routing.release",
      "mfg.workcenter.view",
      "mfg.workcenter.edit",
      "mfg.calendar.edit",
      "mfg.capacity.view",
      "mfg.alert.view",
      /* فاز ۵: الگوی اندازه‌گذاری لات و تقسیم/هم‌پوشانی در مستر مهندسی تعریف می‌شود. */
      "mfg.lotsize.view",
      "mfg.lotsize.edit",
      "mfg.split.edit",
      /* بخش ۱۱: نسخهٔ تولید ترکیب BOM+Routing است، پس مالکیتش با مهندسی ساخت است؛
       * اما تبدیل سفارش برنامه‌ریزی‌شده به او داده نمی‌شود (تفکیک وظایف). */
      "mfg.version.view",
      "mfg.version.edit",
      "mfg.plannedorder.view",
      "mfg.conformance.view",
      /* الگوی تولید/نوع صنعت بخشی از مستر مهندسی است که این نقش مالک آن است؛
       * چون کاربر پیش‌فرض تب «مهندسی ساخت» مهندس ساخت است، ویرایش این‌جا هم
       * فعال است (تصمیم دمو). تغییر همچنان حسابرسی می‌شود
       * (audited=true) و مدیر تولید این مجوز را هم نگه داشته است. */
      "mfg.plant.view",
      "mfg.plant.edit"
    ]
  },
  {
    code: "production_planner",
    title: { fa: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632 \u062A\u0648\u0644\u06CC\u062F", en: "Production Planner" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "mfg.part.view",
      "mfg.bom.view",
      "mfg.routing.view",
      "mfg.workcenter.view",
      "mfg.order.view",
      "mfg.order.create",
      "mfg.order.reprioritize",
      "mfg.schedule.view",
      "mfg.schedule.run",
      "mfg.schedule.resequence",
      "mfg.capacity.view",
      "mfg.material.view",
      "mfg.mrp.view",
      "mfg.mrp.run",
      "mfg.requisition.create",
      "mfg.dashboard.view",
      "mfg.alert.view",
      /* فاز ۵: برنامه‌ریز تولید مالک تقاضا، MPS و پاسخ ATP است. */
      "mfg.demand.view",
      "mfg.demand.edit",
      "mfg.lotsize.view",
      "mfg.lotsize.edit",
      "mfg.mps.view",
      "mfg.mps.run",
      "mfg.mps.firm",
      "mfg.atp.view",
      "mfg.atp.check",
      "mfg.split.edit",
      /* بخش ۱۱: برنامه‌ریز مالک سفارش برنامه‌ریزی‌شده، نسخهٔ تولید، MPS تأییدشده
       * و گزارش CRP است. تبدیل به سفارش تولید هم با اوست چون آزادسازی سفارش
       * (mfg.order.create) را هم دارد. */
      "mfg.plannedorder.view",
      "mfg.plannedorder.edit",
      "mfg.plannedorder.approve",
      "mfg.plannedorder.convert",
      "mfg.version.view",
      "mfg.version.edit",
      "mfg.crp.view",
      "mfg.mps.approve",
      "mfg.conformance.view",
      /* برنامه‌ریز قابلیت‌های صنعت را می‌بیند ولی پیکربندی کارخانه با او نیست. */
      "mfg.plant.view"
    ]
  },
  {
    code: "production_manager",
    title: { fa: "\u0645\u062F\u06CC\u0631 \u062A\u0648\u0644\u06CC\u062F", en: "Production Manager" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: [
      "mfg.order.view",
      "mfg.order.release",
      "mfg.order.close",
      "mfg.schedule.view",
      "mfg.schedule.run",
      "mfg.capacity.view",
      "mfg.execution.view",
      "mfg.dashboard.view",
      "mfg.alert.view",
      "mfg.alert.ack",
      /* فاز ۵: مدیر تولید برنامهٔ اصلی را تصویب و تعهد تحویل را دیده‌بانی می‌کند. */
      "mfg.demand.view",
      "mfg.mps.view",
      "mfg.mps.firm",
      "mfg.atp.view",
      "mfg.split.edit",
      /* بخش ۱۱: مدیر تولید تأیید MPS، تصویب و تبدیل سفارش برنامه‌ریزی‌شده و
       * گزارش ظرفیت را دارد؛ ویرایش مستقیم مقدار لات پیشنهادی با برنامه‌ریز است. */
      "mfg.mps.approve",
      "mfg.plannedorder.view",
      "mfg.plannedorder.approve",
      "mfg.plannedorder.convert",
      "mfg.crp.view",
      "mfg.version.view",
      "mfg.conformance.view",
      /* پیکربندی سطح کارخانه (از جمله نوع صنعت) یک تصمیم مدیریتی است، پس
       * ویرایشش با مدیر تولید است؛ مهندس ساخت هم برای دمو آن را دارد
       * (تفصیل در نقش manufacturing_engineer). برنامه‌ریز فقط مشاهده می‌کند. */
      "mfg.plant.view",
      "mfg.plant.edit"
    ]
  },
  {
    code: "shop_floor_supervisor",
    title: { fa: "\u0633\u0631\u067E\u0631\u0633\u062A \u0633\u0627\u0644\u0646 \u062A\u0648\u0644\u06CC\u062F", en: "Shop-floor Supervisor" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "mfg.order.view",
      "mfg.schedule.view",
      "mfg.capacity.view",
      "mfg.execution.view",
      "mfg.execution.start",
      "mfg.execution.report",
      "mfg.execution.finish",
      "mfg.downtime.report",
      "mfg.scrap.report",
      "mfg.rework.report",
      "mfg.material.view",
      "mfg.material.consume",
      "mfg.dashboard.view",
      "mfg.alert.view",
      "mfg.alert.ack",
      /* فاز ۵: سرپرست سالن لات را پای کار تقسیم می‌کند. */
      "mfg.split.edit"
    ]
  },
  {
    code: "production_operator",
    title: { fa: "\u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u062A\u0648\u0644\u06CC\u062F", en: "Production Operator" },
    inherits: [],
    clearance: "internal",
    party: "contractor",
    grants: [
      "mfg.execution.view",
      "mfg.execution.start",
      "mfg.execution.report",
      "mfg.execution.finish",
      "mfg.downtime.report",
      "mfg.scrap.report",
      "mfg.rework.report",
      "mfg.material.view",
      "mfg.material.consume",
      "mfg.alert.view"
    ]
  },
  {
    code: "material_planner",
    title: { fa: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632 \u0645\u0648\u0627\u062F", en: "Material Planner" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "mfg.part.view",
      "mfg.order.view",
      "mfg.material.view",
      "mfg.mrp.view",
      "mfg.mrp.run",
      "mfg.requisition.create",
      "mfg.dashboard.view",
      "mfg.alert.view",
      /* فاز ۵: برنامه‌ریز مواد تقاضا، MPS و ATP را می‌خواند و تعهد مواد را بررسی می‌کند. */
      "mfg.demand.view",
      "mfg.lotsize.view",
      "mfg.mps.view",
      "mfg.atp.view",
      "mfg.atp.check"
    ]
  },
  {
    code: "industrial_accountant",
    title: { fa: "\u062D\u0633\u0627\u0628\u062F\u0627\u0631 \u0635\u0646\u0639\u062A\u06CC", en: "Industrial Accountant" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: [
      "mfg.order.view",
      "mfg.cost.view",
      "mfg.cost.reconcile",
      "mfg.dashboard.view",
      /* فاز ۵: حسابدار صنعتی برنامهٔ اصلی را برای تعهدات مالی می‌بیند. */
      "mfg.mps.view",
      "mfg.atp.view"
    ]
  },
  /* ── نقش‌های بخش ۳: نگهداری و تعمیرات ────────────────────────────────────
   * این نقش‌ها عمداً از نقش‌های تولید (mfg) جدا هستند: تفکیک «برنامه‌ریز
   * تولید» و «برنامه‌ریز نت» یک الزام سازمانی است، نه یک ترجیح پیاده‌سازی.
   * دسترسی هر نقش در زمان ارزیابی به `plantIds`/`siteId` کاربر هم محدود
   * می‌شود، همان‌طور که برای نقش‌های تولید انجام شد. */
  {
    code: "maintenance_manager",
    title: { fa: "\u0645\u062F\u06CC\u0631 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0648 \u062A\u0639\u0645\u06CC\u0631\u0627\u062A", en: "Maintenance Manager" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: [
      "cmms.asset.view",
      "cmms.asset.edit",
      "cmms.asset.commission",
      "cmms.asset.retire",
      "cmms.location.view",
      "cmms.location.edit",
      "cmms.meter.view",
      "cmms.barcode.view",
      "cmms.document.view",
      "cmms.document.edit",
      "cmms.family.view",
      "cmms.family.edit",
      "cmms.family.approve",
      "cmms.family.bulkchange",
      "cmms.customfield.edit",
      "cmms.failuremode.view",
      "cmms.failuremode.edit",
      "cmms.failure.report",
      "cmms.downtime.report",
      "cmms.fmea.view",
      "cmms.fmea.approve",
      "cmms.rcm.view",
      "cmms.rcm.approve",
      "cmms.rca.view",
      "cmms.rca.close",
      "cmms.reliability.view",
      "cmms.oee.view",
      "cmms.condition.view",
      "cmms.condition.threshold",
      "cmms.request.view",
      "cmms.request.review",
      "cmms.request.reject",
      "cmms.wo.view",
      "cmms.wo.release",
      "cmms.wo.close",
      "cmms.wo.cancel",
      "cmms.workflow.view",
      "cmms.workflow.edit",
      "cmms.pm.view",
      "cmms.strategy.approve",
      "cmms.spare.view",
      "cmms.technician.view",
      "cmms.technician.edit",
      "cmms.crew.view",
      "cmms.crew.edit",
      "cmms.vendor.view",
      "cmms.vendor.edit",
      "cmms.cost.view",
      "cmms.cost.post",
      "cmms.lcc.view",
      "cmms.lcc.edit",
      "cmms.kpi.view",
      "cmms.kpi.edit",
      "cmms.dashboard.view",
      "cmms.alert.view",
      "cmms.alert.ack",
      /* مدیر نت مالک توقف/ادامه و یکپارچگی با MES است؛ ارسال رویداد به
       * سامانهٔ تولید یک تصمیم سطح سایت است. */
      "cmms.wo.hold",
      "cmms.wo.resume",
      "cmms.capa.create",
      "cmms.capa.verify",
      "cmms.integration.view",
      "cmms.integration.dispatch",
      "cmms.capacity.view",
      "cmms.capacity.block",
      "cmms.ai.view",
      "cmms.ai.run",
      "cmms.ai.apply"
      /* تدوین FMEA/RCM با مهندس قابلیت اطمینان است، نه مدیر؛ مدیر تصویب می‌کند.
       * این تفکیک دقیقاً همان چیزی است که در ممیزی ISO 55001 پرسیده می‌شود. */
    ]
  },
  {
    code: "maintenance_planner",
    title: { fa: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0648 \u062A\u0639\u0645\u06CC\u0631\u0627\u062A", en: "Maintenance Planner" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "cmms.asset.view",
      "cmms.location.view",
      "cmms.meter.view",
      "cmms.meter.read",
      "cmms.document.view",
      "cmms.family.view",
      "cmms.failuremode.view",
      /* چاپ برچسب بارکد با برنامه‌ریز است چون او مالک یکپارچگی شناسنامهٔ تجهیز است. */
      "cmms.barcode.print",
      "cmms.request.view",
      "cmms.request.create",
      "cmms.request.review",
      "cmms.wo.view",
      "cmms.wo.create",
      "cmms.wo.plan",
      "cmms.wo.schedule",
      "cmms.workflow.view",
      "cmms.pm.view",
      "cmms.pm.edit",
      "cmms.spare.view",
      "cmms.technician.view",
      "cmms.crew.view",
      "cmms.vendor.view",
      "cmms.reliability.view",
      "cmms.oee.view",
      "cmms.kpi.view",
      "cmms.dashboard.view",
      "cmms.alert.view",
      "cmms.alert.ack",
      "cmms.condition.view",
      "cmms.cost.view",
      "cmms.lcc.view",
      "cmms.fmea.view",
      "cmms.rcm.view",
      "cmms.rca.view",
      /* برنامه‌ریز کار را متوقف می‌کند (انتظار قطعه/پنجرهٔ تولید) و ظرفیت
       * مرکز کاری را برای PM رزرو می‌کند؛ اما ادامهٔ کار و تأیید اثربخشی
       * CAPA با او نیست. */
      "cmms.wo.hold",
      "cmms.capa.create",
      "cmms.integration.view",
      "cmms.capacity.view",
      "cmms.capacity.block",
      "cmms.ai.view",
      "cmms.ai.run"
      /* آزادسازی و بستن دستورکار با برنامه‌ریز نیست: او برنامه می‌سازد،
       * مدیر نت آزادسازی و قطعی‌کردن هزینه را انجام می‌دهد. */
    ]
  },
  {
    code: "reliability_engineer",
    title: { fa: "\u0645\u0647\u0646\u062F\u0633 \u0642\u0627\u0628\u0644\u06CC\u062A \u0627\u0637\u0645\u06CC\u0646\u0627\u0646", en: "Reliability Engineer" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: [
      "cmms.asset.view",
      "cmms.family.view",
      "cmms.family.edit",
      "cmms.customfield.edit",
      "cmms.failuremode.view",
      "cmms.failuremode.edit",
      "cmms.failure.report",
      "cmms.downtime.report",
      "cmms.fmea.view",
      "cmms.fmea.edit",
      "cmms.rcm.view",
      "cmms.rcm.edit",
      "cmms.rca.view",
      "cmms.rca.edit",
      "cmms.rca.close",
      "cmms.reliability.view",
      "cmms.oee.view",
      "cmms.condition.view",
      "cmms.condition.threshold",
      "cmms.condition.record",
      "cmms.pm.view",
      "cmms.pm.edit",
      "cmms.spare.view",
      "cmms.wo.view",
      "cmms.request.view",
      "cmms.cost.view",
      "cmms.lcc.view",
      "cmms.lcc.edit",
      "cmms.kpi.view",
      "cmms.kpi.edit",
      "cmms.dashboard.view",
      "cmms.alert.view",
      "cmms.document.view",
      "cmms.document.edit",
      "cmms.meter.view",
      "cmms.meter.read",
      /* CAPA بخشی از خروجی RCFA است و صاحبش مهندس قابلیت اطمینان است؛
       * اثربخشی را هم او تأیید می‌کند — ولی رویداد را به MES نمی‌فرستد. */
      "cmms.capa.create",
      "cmms.capa.verify",
      "cmms.integration.view",
      "cmms.capacity.view",
      "cmms.ai.view",
      "cmms.ai.run",
      "cmms.ai.apply"
      /* تصویب FMEA/RCM با مدیر نت است نه تدوین‌کننده — تفکیک وظیفه. */
    ]
  },
  {
    code: "maintenance_engineer",
    title: { fa: "\u0645\u0647\u0646\u062F\u0633 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0648 \u062A\u0639\u0645\u06CC\u0631\u0627\u062A", en: "Maintenance Engineer" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "cmms.asset.view",
      "cmms.asset.edit",
      "cmms.location.view",
      "cmms.meter.view",
      "cmms.meter.read",
      "cmms.barcode.view",
      "cmms.document.view",
      "cmms.document.edit",
      "cmms.family.view",
      "cmms.family.edit",
      "cmms.customfield.edit",
      "cmms.failuremode.view",
      "cmms.failuremode.edit",
      "cmms.failure.report",
      "cmms.downtime.report",
      "cmms.fmea.view",
      "cmms.fmea.edit",
      "cmms.rcm.view",
      "cmms.rcm.edit",
      "cmms.rca.view",
      "cmms.rca.edit",
      "cmms.request.view",
      "cmms.request.create",
      "cmms.wo.view",
      "cmms.wo.create",
      "cmms.wo.plan",
      /* اتمام فنی کار با مهندس نت است، اما بستن و قطعی‌کردن هزینه با مدیر.
       * این دو یک اقتدار نیستند و عمداً جدا گیت شده‌اند. */
      "cmms.wo.complete",
      "cmms.pm.view",
      "cmms.pm.edit",
      "cmms.spare.view",
      "cmms.spare.edit",
      "cmms.technician.view",
      "cmms.crew.view",
      "cmms.vendor.view",
      "cmms.condition.view",
      "cmms.condition.record",
      "cmms.condition.threshold",
      "cmms.reliability.view",
      "cmms.oee.view",
      "cmms.kpi.view",
      "cmms.dashboard.view",
      "cmms.alert.view",
      "cmms.alert.ack",
      "cmms.cost.view",
      "cmms.lcc.view",
      /* مهندس نت کار را متوقف و ادامه می‌دهد؛ رزرو ظرفیت تولید با او نیست. */
      "cmms.wo.hold",
      "cmms.wo.resume",
      "cmms.capa.create",
      "cmms.integration.view",
      "cmms.capacity.view",
      "cmms.ai.view",
      "cmms.ai.run",
      "cmms.workflow.view"
    ]
  },
  {
    code: "maintenance_technician",
    title: { fa: "\u062A\u06A9\u0646\u0633\u06CC\u0646 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0648 \u062A\u0639\u0645\u06CC\u0631\u0627\u062A", en: "Maintenance Technician" },
    inherits: [],
    clearance: "internal",
    party: "contractor",
    grants: [
      /* تکنسین اجرا می‌کند و گزارش می‌دهد؛ نه برنامه می‌ریزد، نه آزادسازی
       * می‌کند، نه هزینه را قطعی می‌کند. دسترسی‌های او عمداً حداقلی است. */
      "cmms.asset.view",
      "cmms.location.view",
      "cmms.document.view",
      "cmms.family.view",
      "cmms.failuremode.view",
      "cmms.barcode.view",
      "cmms.request.view",
      "cmms.request.create",
      "cmms.wo.view",
      "cmms.wo.execute",
      "cmms.labor.report",
      "cmms.failure.report",
      "cmms.downtime.report",
      "cmms.meter.view",
      "cmms.meter.read",
      "cmms.condition.view",
      "cmms.condition.record",
      "cmms.spare.view",
      "cmms.alert.view",
      "cmms.ai.view",
      /* تکنسین در صحنهٔ کار کار را می‌خواباند و ادامه می‌دهد؛ اما ارجاع
       * CAPA، رزرو ظرفیت و ارسال رویداد به MES با او نیست. */
      "cmms.wo.hold",
      "cmms.wo.resume"
    ]
  },
  {
    code: "maintenance_storekeeper",
    title: { fa: "\u0627\u0646\u0628\u0627\u0631\u062F\u0627\u0631 \u0642\u0637\u0639\u0627\u062A \u0646\u062A", en: "Maintenance Storekeeper" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "cmms.asset.view",
      "cmms.wo.view",
      "cmms.spare.view",
      "cmms.spare.edit",
      "cmms.spare.issue",
      "cmms.spare.receive",
      "cmms.vendor.view",
      "cmms.alert.view",
      "cmms.alert.ack",
      "cmms.cost.view",
      "cmms.ai.view",
      "cmms.dashboard.view"
    ]
  },
  {
    code: "condition_monitoring_analyst",
    title: { fa: "\u062A\u062D\u0644\u06CC\u0644\u200C\u06AF\u0631 \u067E\u0627\u06CC\u0634 \u0648\u0636\u0639\u06CC\u062A", en: "Condition Monitoring Analyst" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "cmms.asset.view",
      "cmms.family.view",
      "cmms.location.view",
      "cmms.document.view",
      "cmms.condition.view",
      "cmms.condition.record",
      "cmms.condition.threshold",
      "cmms.meter.view",
      "cmms.meter.read",
      "cmms.failuremode.view",
      "cmms.failure.report",
      "cmms.reliability.view",
      "cmms.oee.view",
      "cmms.dashboard.view",
      "cmms.alert.view",
      "cmms.alert.ack",
      "cmms.pm.view",
      "cmms.request.create",
      "cmms.request.view",
      "cmms.wo.view",
      "cmms.rca.view",
      "cmms.rca.edit",
      "cmms.ai.view",
      "cmms.ai.run",
      "cmms.kpi.view",
      "cmms.fmea.view",
      "cmms.rcm.view"
    ]
  },
  /* ── بخش ۵: نقش‌های پایش میدانی و تله‌متری حفاری (IIoT & DAS) ─────────────
   * تفکیک سه‌گانه عمداست و بازتاب ساختار واقعی دکل است:
   *   • مهندس IIoT مالک «پیکربندی» است (کانال، فیلتر، آستانه، گیت‌وی) — ولی
   *     تأیید/بستن هشدار و ارسال به سامانهٔ بیرونی با او نیست، وگرنه همان
   *     کسی که آستانه را تنظیم کرده، صحت هشدارش را هم تأیید می‌کند.
   *   • سرپرست حفاری مالک «تصمیم عملیاتی» است: تأیید/بستن هشدار، ثبت و تأیید
   *     توقف/NPT و آزادسازی رویداد به CMMS/MES/PMIS.
   *   • تکنسین ابزار دقیق مالک «میدان» است: سنسور، کالیبراسیون و همگام‌سازی
   *     بافر لبه — بدون دسترسی به آستانه‌ها و بدون ارسال بین‌بخشی. */
  {
    code: "iiot_engineer",
    title: { fa: "\u0645\u0647\u0646\u062F\u0633 \u062A\u0644\u0647\u200C\u0645\u062A\u0631\u06CC \u0648 IIoT", en: "IIoT & Telemetry Engineer" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "iiot.rig.view",
      "iiot.rig.edit",
      "iiot.stream.view",
      "iiot.stream.edit",
      "iiot.channel.view",
      "iiot.channel.edit",
      "iiot.telemetry.view",
      "iiot.telemetry.ingest",
      "iiot.filter.view",
      "iiot.filter.edit",
      "iiot.threshold.view",
      "iiot.threshold.edit",
      "iiot.alert.view",
      "iiot.gateway.view",
      "iiot.gateway.edit",
      "iiot.buffer.view",
      "iiot.buffer.sync",
      "iiot.sensor.view",
      "iiot.sensor.edit",
      "iiot.condition.view",
      "iiot.condition.record",
      "iiot.downtime.view",
      "iiot.downtime.report",
      "iiot.npt.view",
      "iiot.analytics.view",
      "iiot.integration.view",
      "iiot.dashboard.view"
    ]
  },
  {
    code: "drilling_supervisor",
    title: { fa: "\u0633\u0631\u067E\u0631\u0633\u062A \u062D\u0641\u0627\u0631\u06CC (\u0645\u0633\u0626\u0648\u0644 \u0634\u06CC\u0641\u062A \u062F\u06A9\u0644)", en: "Drilling Supervisor (Shift Owner)" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: [
      "iiot.rig.view",
      "iiot.stream.view",
      "iiot.channel.view",
      "iiot.telemetry.view",
      "iiot.filter.view",
      "iiot.threshold.view",
      "iiot.alert.view",
      "iiot.alert.ack",
      "iiot.alert.resolve",
      "iiot.alert.dispatch",
      "iiot.gateway.view",
      "iiot.sensor.view",
      "iiot.condition.view",
      "iiot.downtime.view",
      "iiot.downtime.report",
      "iiot.downtime.verify",
      "iiot.npt.view",
      "iiot.analytics.view",
      "iiot.integration.view",
      "iiot.integration.dispatch",
      "iiot.dashboard.view"
    ]
  },
  {
    code: "field_iot_technician",
    title: { fa: "\u062A\u06A9\u0646\u0633\u06CC\u0646 \u0627\u0628\u0632\u0627\u0631 \u062F\u0642\u06CC\u0642 \u0645\u06CC\u062F\u0627\u0646", en: "Field Instrument Technician" },
    inherits: ["viewer"],
    // confidential و نه internal: سه مجوز عملیاتی این نقش — پذیرش نمونه،
    // همگام‌سازی بافر لبه و کالیبراسیون سنسور — طبقه‌بندی confidential دارند
    // (تله‌متری لحظه‌ای حفاری دادهٔ حساس عملیاتی است). با ردهٔ internal، آن
    // سه مجوز «داده‌شده ولی غیرقابل استفاده» می‌شدند و تکنسین میدان دقیقاً
    // همان کاری را نمی‌توانست بکند که نقش برایش ساخته شده.
    clearance: "confidential",
    party: "contractor",
    grants: [
      "iiot.rig.view",
      "iiot.channel.view",
      "iiot.telemetry.view",
      "iiot.telemetry.ingest",
      "iiot.sensor.view",
      "iiot.sensor.edit",
      "iiot.sensor.calibrate",
      "iiot.gateway.view",
      "iiot.buffer.view",
      "iiot.buffer.sync",
      "iiot.condition.view",
      "iiot.condition.record",
      "iiot.alert.view",
      "iiot.downtime.view",
      "iiot.dashboard.view"
    ]
  },
  {
    code: "admin",
    title: { fa: "\u0645\u062F\u06CC\u0631 \u0633\u0627\u0645\u0627\u0646\u0647", en: "System Admin" },
    inherits: [],
    clearance: "restricted",
    party: "contractor",
    // sys.audit.view عمداً داده نشده: مدیر سامانه نباید ممیزِ کارِ خودش باشد (SOD-06).
    //
    // core.ai.run داده شده چون همین نقش سرویس هوش مصنوعی را پیکربندی
    // می‌کند؛ بدون آن، مدیر سامانه کلید را وارد می‌کرد ولی خودش اجازهٔ
    // آزمودنش را نداشت و پنل دانش پروژه برایش قفل می‌ماند.
    grants: [
      "sys.config.manage",
      "sys.user.manage",
      "sys.audit.purge",
      "sys.backup.export",
      "sys.backup.restore",
      "report.export.bulk",
      "core.portfolio.view",
      "core.project.view",
      "plan.progress.report",
      "core.ai.run",
      "scm.vendor.view",
      "scm.vendor.manage",
      "scm.package.view",
      "scm.package.edit",
      "scm.bidder.view",
      "scm.bidder.manage",
      "scm.mr.view",
      "scm.mrr.view",
      "scm.mrr.post",
      "hrm.org.view",
      "hrm.org.manage",
      "hrm.skill.view",
      "hrm.skill.manage",
      "hrm.attendance.view",
      "hrm.attendance.manage",
      "hrm.payroll.view",
      "hrm.payroll.run",
      "hrm.payroll.approve",
      "hrm.training.view",
      "hrm.training.manage",
      "hrm.performance.view",
      "hrm.performance.manage",
      "edms.document.view",
      "edms.document.manage",
      "edms.revision.view",
      "edms.revision.manage",
      "edms.workflow.view",
      "edms.workflow.approve",
      "edms.transmittal.manage",
      "edms.archive.view",
      "edms.archive.manage",
      "edms.kms.view",
      "edms.kms.manage",
      /* P10: مدیر سامانه سرویس هوش مصنوعی را پیکربندی و می‌آزماید، ولی
       * تاریخچهٔ پرسش کسب‌وکار و خروجی سند به او داده نمی‌شود. */
      "ai.assistant.ask",
      "ai.insight.view"
    ]
  }
];
var ROLE_BY_CODE = new Map(ROLE_CATALOG.map((r) => [r.code, r]));
function effectivePermissions(roleCode, seen = /* @__PURE__ */ new Set()) {
  const role = ROLE_BY_CODE.get(roleCode);
  if (!role || seen.has(roleCode)) return [];
  seen.add(roleCode);
  const out = new Set(role.grants);
  for (const parent of role.inherits) {
    for (const p of effectivePermissions(parent, seen)) out.add(p);
  }
  return [...out].sort();
}
function combinedClearance(roleCodes) {
  let best = "public";
  for (const rc of roleCodes) {
    const r = ROLE_BY_CODE.get(rc);
    if (r && CLASSIFICATION_RANK[r.clearance] > CLASSIFICATION_RANK[best]) best = r.clearance;
  }
  return best;
}
function sodInstanceConflict(subjectId, record) {
  return [record.preparedBy, record.raisedBy, record.enteredBy].some((v) => !!v && v === subjectId);
}
function isDelegationActive(d, onDate) {
  if (d.revoked) return false;
  return d.from <= onDate && onDate <= d.to;
}
function delegatedPermissions(delegations, userId, onDate) {
  const out = /* @__PURE__ */ new Set();
  for (const d of delegations) {
    if (d.toUserId !== userId) continue;
    if (!isDelegationActive(d, onDate)) continue;
    for (const p of d.permissions) out.add(p);
  }
  return [...out].sort();
}
var DECISION_REASON = {
  ALLOW: { fa: "\u062F\u0633\u062A\u0631\u0633\u06CC \u0645\u062C\u0627\u0632 \u0627\u0633\u062A", en: "Access granted" },
  ALLOW_DELEGATED: { fa: "\u062F\u0633\u062A\u0631\u0633\u06CC \u0627\u0632 \u0637\u0631\u06CC\u0642 \u062A\u0641\u0648\u06CC\u0636 \u0627\u062E\u062A\u06CC\u0627\u0631 \u0645\u062C\u0627\u0632 \u0627\u0633\u062A", en: "Access granted via delegation" },
  DENY_INACTIVE: { fa: "\u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A", en: "User account is inactive" },
  DENY_EXPLICIT: { fa: "\u0627\u06CC\u0646 \u0645\u062C\u0648\u0632 \u0635\u0631\u06CC\u062D\u0627\u064B \u0628\u0631\u0627\u06CC \u06A9\u0627\u0631\u0628\u0631 \u0645\u0645\u0646\u0648\u0639 \u0634\u062F\u0647 \u0627\u0633\u062A", en: "Permission explicitly denied for this user" },
  DENY_NO_PERMISSION: { fa: "\u0647\u06CC\u0686\u200C\u06CC\u06A9 \u0627\u0632 \u0646\u0642\u0634\u200C\u0647\u0627\u06CC \u06A9\u0627\u0631\u0628\u0631 \u0627\u06CC\u0646 \u0645\u062C\u0648\u0632 \u0631\u0627 \u0646\u062F\u0627\u0631\u062F", en: "None of the user roles grant this permission" },
  DENY_PROJECT_SCOPE: { fa: "\u06A9\u0627\u0631\u0628\u0631 \u0628\u0647 \u0627\u06CC\u0646 \u067E\u0631\u0648\u0698\u0647 \u062F\u0633\u062A\u0631\u0633\u06CC \u0646\u062F\u0627\u0631\u062F", en: "User is not assigned to this project" },
  DENY_PLANT_SCOPE: { fa: "\u06A9\u0627\u0631\u0628\u0631 \u0628\u0647 \u0627\u06CC\u0646 \u06A9\u0627\u0631\u062E\u0627\u0646\u0647 \u062F\u0633\u062A\u0631\u0633\u06CC \u0646\u062F\u0627\u0631\u062F", en: "User is not assigned to this plant" },
  DENY_DISCIPLINE_SCOPE: { fa: "\u06A9\u0627\u0631\u0628\u0631 \u0628\u0647 \u0627\u06CC\u0646 \u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646 \u062F\u0633\u062A\u0631\u0633\u06CC \u0646\u062F\u0627\u0631\u062F", en: "User is not assigned to this discipline" },
  DENY_CLEARANCE: { fa: "\u0633\u0637\u062D \u062F\u0633\u062A\u0631\u0633\u06CC \u06A9\u0627\u0631\u0628\u0631 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0637\u0628\u0642\u0647\u200C\u0628\u0646\u062F\u06CC \u06A9\u0627\u0641\u06CC \u0646\u06CC\u0633\u062A", en: "User clearance is insufficient for this classification" },
  DENY_SOD: { fa: "\u062A\u0641\u06A9\u06CC\u06A9 \u0648\u0638\u0627\u06CC\u0641 \u0646\u0642\u0636 \u0645\u06CC\u200C\u0634\u0648\u062F: \u062A\u0647\u06CC\u0647\u200C\u06A9\u0646\u0646\u062F\u0647 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u062A\u0623\u06CC\u06CC\u062F\u06A9\u0646\u0646\u062F\u0647 \u0628\u0627\u0634\u062F", en: "Segregation of duties violated: preparer cannot approve" },
  DENY_UNKNOWN_PERMISSION: { fa: "\u06A9\u062F \u0645\u062C\u0648\u0632 \u062F\u0631 \u06A9\u0627\u062A\u0627\u0644\u0648\u06AF \u0646\u06CC\u0633\u062A", en: "Permission code is not in the catalogue" }
};
var deny = (code) => ({ allow: false, code, reason: DECISION_REASON[code], audit: true });
function subjectPermissions(subject) {
  const out = /* @__PURE__ */ new Set();
  for (const rc of subject.roles) for (const p of effectivePermissions(rc)) out.add(p);
  for (const p of subject.extraGrants ?? []) out.add(p);
  for (const p of subject.denies ?? []) out.delete(p);
  return [...out].sort();
}
function subjectClearance(subject) {
  return subject.clearance ?? combinedClearance(subject.roles);
}
function inScope(list, value) {
  if (!value) return true;
  if (!list || list.length === 0) return true;
  if (list.includes("*")) return true;
  return list.includes(value);
}
function inPlantScope(list, value) {
  if (!value) return true;
  if (!list || list.length === 0) return false;
  return list.includes("*") || list.includes(value);
}
function evaluate(subject, permission, ctx = {}) {
  const def = PERM_BY_CODE.get(permission);
  if (!def) return deny("DENY_UNKNOWN_PERMISSION");
  if (!subject.active) return deny("DENY_INACTIVE");
  if ((subject.denies ?? []).includes(permission)) return deny("DENY_EXPLICIT");
  if (!inScope(subject.projectIds, ctx.projectId)) return deny("DENY_PROJECT_SCOPE");
  if (!inPlantScope(subject.plantIds, ctx.plantId)) return deny("DENY_PLANT_SCOPE");
  if (!inScope(subject.disciplines, ctx.discipline)) return deny("DENY_DISCIPLINE_SCOPE");
  const required = ctx.classification ?? def.touches;
  if (!meetsClearance(subjectClearance(subject), required)) return deny("DENY_CLEARANCE");
  const base = subjectPermissions(subject);
  let via = base.includes(permission) ? "role" : null;
  if (!via && ctx.delegations && ctx.onDate) {
    if (delegatedPermissions(ctx.delegations, subject.id, ctx.onDate).includes(permission)) via = "delegation";
  }
  if (!via) return deny("DENY_NO_PERMISSION");
  if (ctx.record && isApprovalPermission(permission) && sodInstanceConflict(subject.id, ctx.record)) {
    return deny("DENY_SOD");
  }
  const code = via === "delegation" ? "ALLOW_DELEGATED" : "ALLOW";
  return { allow: true, code, reason: DECISION_REASON[code], audit: def.audited || via === "delegation" };
}
function isApprovalPermission(permission) {
  return /\.(approve|sign|close|publish|submit|issue)$/.test(permission);
}
var DEMO_SUBJECTS = [
  { id: "u-admin", displayName: "\u0645\u062D\u0645\u062F\u0631\u0636\u0627 \u0647\u0627\u0634\u0645\u06CC\u200C\u067E\u0648\u0631", roles: ["admin"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-pm", displayName: "\u0645\u062F\u06CC\u0631 \u067E\u0631\u0648\u0698\u0647 \u0622\u0632\u0627\u062F\u06AF\u0627\u0646", roles: ["project_manager"], projectIds: ["c1-p1", "c1-p2"], active: true, party: "contractor" },
  { id: "u-pmo", displayName: "\u062F\u0641\u062A\u0631 \u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0631\u0648\u0698\u0647", roles: ["pmo"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-planner", displayName: "\u06A9\u0627\u0631\u0634\u0646\u0627\u0633 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC", roles: ["planner"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-cost", displayName: "\u06A9\u0646\u062A\u0631\u0644 \u0647\u0632\u06CC\u0646\u0647", roles: ["cost_controller"], projectIds: ["c1-p1"], active: true, party: "contractor" },
  { id: "u-qc", displayName: "\u0628\u0627\u0632\u0631\u0633 \u06A9\u06CC\u0641\u06CC\u062A", roles: ["qc_inspector"], projectIds: ["c1-p1"], disciplines: ["mechanical", "piping"], active: true, party: "contractor" },
  { id: "u-qa", displayName: "\u0645\u062F\u06CC\u0631 \u062A\u0636\u0645\u06CC\u0646 \u06A9\u06CC\u0641\u06CC\u062A", roles: ["qa_manager"], projectIds: ["c1-p1", "c1-p2"], active: true, party: "contractor" },
  { id: "u-hr", displayName: "\u0645\u062F\u06CC\u0631 \u0645\u0646\u0627\u0628\u0639 \u0627\u0646\u0633\u0627\u0646\u06CC", roles: ["hr_manager"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-doc", displayName: "\u06A9\u0646\u062A\u0631\u0644 \u0645\u062F\u0627\u0631\u06A9", roles: ["doc_controller"], projectIds: ["c1-p1"], active: true, party: "contractor" },
  { id: "u-contracts", displayName: "\u0645\u062F\u06CC\u0631 \u067E\u06CC\u0645\u0627\u0646", roles: ["contracts_manager"], projectIds: ["c1-p1", "c1-p2"], active: true, party: "contractor" },
  { id: "u-site", displayName: "\u0633\u0631\u067E\u0631\u0633\u062A \u06A9\u0627\u0631\u06AF\u0627\u0647", roles: ["site_engineer"], projectIds: ["c1-p1"], disciplines: ["civil"], active: true, party: "contractor" },
  { id: "u-comm", displayName: "\u0645\u062F\u06CC\u0631 \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0648 \u062A\u062D\u0648\u06CC\u0644", roles: ["commissioning_manager"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-hse", displayName: "\u0627\u0641\u0633\u0631 \u0627\u06CC\u0645\u0646\u06CC \u0648 \u0628\u0647\u062F\u0627\u0634\u062A", roles: ["hse_officer"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-engmgr", displayName: "\u0645\u062F\u06CC\u0631 \u0645\u0647\u0646\u062F\u0633\u06CC \u0648 \u0637\u0631\u0627\u062D\u06CC", roles: ["engineering_manager"], projectIds: ["c1-p1", "c1-p2"], active: true, party: "contractor" },
  { id: "u-design", displayName: "\u0633\u0631\u067E\u0631\u0633\u062A \u0637\u0631\u0627\u062D\u06CC \u2014 \u0644\u0648\u0644\u0647\u200C\u06A9\u0634\u06CC", roles: ["design_lead"], projectIds: ["c1-p1"], disciplines: ["piping"], active: true, party: "contractor" },
  { id: "u-consultant", displayName: "\u0646\u0645\u0627\u06CC\u0646\u062F\u0647 \u0645\u0634\u0627\u0648\u0631", roles: ["consultant"], projectIds: ["c1-p1", "c5-p1"], active: true, party: "consultant" },
  { id: "u-client", displayName: "\u0646\u0645\u0627\u06CC\u0646\u062F\u0647 \u06A9\u0627\u0631\u0641\u0631\u0645\u0627", roles: ["client"], projectIds: ["c1-p1", "c3-p1"], active: true, party: "client" },
  { id: "u-ceo", displayName: "\u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F", roles: ["executive"], projectIds: ["*"], active: true, party: "contractor" },
  { id: "u-sub", displayName: "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u062C\u0632\u0621 \u2014 \u0627\u0628\u0646\u06CC\u0647", roles: ["subcontractor"], projectIds: ["c1-p1"], disciplines: ["civil"], active: true, party: "subcontractor" },
  { id: "u-auditor", displayName: "\u0645\u0645\u06CC\u0632 \u062F\u0627\u062E\u0644\u06CC", roles: ["auditor"], projectIds: ["*"], active: true, party: "any" },
  // کاربر عمداً پرمجوز: دو نقش هم‌زمان که تفکیک وظیفه را نقض می‌کند — ورودی آزمون وضعیت امنیتی.
  { id: "u-over", displayName: "\u0633\u0631\u067E\u0631\u0633\u062A \u0645\u0627\u0644\u06CC \u06A9\u0627\u0631\u06AF\u0627\u0647 (\u062F\u0648 \u0646\u0642\u0634)", roles: ["cost_controller", "project_manager"], projectIds: ["c1-p1"], active: true, party: "contractor" },
  { id: "u-left", displayName: "\u06A9\u0627\u0631\u0634\u0646\u0627\u0633 \u0645\u0646\u062A\u0642\u0644\u200C\u0634\u062F\u0647", roles: ["planner"], projectIds: ["c1-p1"], active: false, party: "contractor" },
  /* هویت‌های نمایشی MFG فقط برای توسعه/آزمون‌اند؛ در استقرار واقعی از IdP و تخصیص Plant می‌آیند. */
  { id: "u-mfg-eng", displayName: "\u0645\u0647\u0646\u062F\u0633 \u0633\u0627\u062E\u062A (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["manufacturing_engineer"], projectIds: ["*"], plantIds: ["PLANT-DEMO"], active: true, party: "contractor" },
  { id: "u-mfg-plan", displayName: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632 \u062A\u0648\u0644\u06CC\u062F (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["production_planner"], projectIds: ["*"], plantIds: ["PLANT-DEMO"], active: true, party: "contractor" },
  { id: "u-mfg-manager", displayName: "\u0645\u062F\u06CC\u0631 \u062A\u0648\u0644\u06CC\u062F (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["production_manager"], projectIds: ["*"], plantIds: ["PLANT-DEMO"], active: true, party: "contractor" },
  { id: "u-mfg-supervisor", displayName: "\u0633\u0631\u067E\u0631\u0633\u062A \u0633\u0627\u0644\u0646 (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["shop_floor_supervisor"], projectIds: ["*"], plantIds: ["PLANT-DEMO"], active: true, party: "contractor" },
  { id: "u-mfg-operator", displayName: "\u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u062A\u0648\u0644\u06CC\u062F (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["production_operator"], projectIds: ["*"], plantIds: ["PLANT-DEMO"], active: true, party: "contractor" },
  { id: "u-mfg-material", displayName: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632 \u0645\u0648\u0627\u062F (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["material_planner"], projectIds: ["*"], plantIds: ["PLANT-DEMO"], active: true, party: "contractor" },
  { id: "u-mfg-cost", displayName: "\u062D\u0633\u0627\u0628\u062F\u0627\u0631 \u0635\u0646\u0639\u062A\u06CC (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["industrial_accountant"], projectIds: ["*"], plantIds: ["PLANT-DEMO"], active: true, party: "contractor" },
  /* بخش ۳ — کاربران آزمایشی نت. `plantIds` اینجا همان «دامنهٔ سایت
   * بهره‌برداری» است (توضیحش در سرآییند server/cmmsApi.js آمده). دامنهٔ
   * SITE-DEMO عمداً از PLANT-DEMO جداست تا دامنه‌بندی سایت واقعاً آزموده شود. */
  { id: "u-cmms-manager", displayName: "\u0645\u062F\u06CC\u0631 \u0646\u062A (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["maintenance_manager"], projectIds: ["*"], plantIds: ["SITE-DEMO"], active: true, party: "contractor" },
  { id: "u-cmms-planner", displayName: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632 \u0646\u062A (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["maintenance_planner"], projectIds: ["*"], plantIds: ["SITE-DEMO"], active: true, party: "contractor" },
  { id: "u-cmms-reliability", displayName: "\u0645\u0647\u0646\u062F\u0633 \u0642\u0627\u0628\u0644\u06CC\u062A \u0627\u0637\u0645\u06CC\u0646\u0627\u0646 (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["reliability_engineer"], projectIds: ["*"], plantIds: ["SITE-DEMO"], active: true, party: "contractor" },
  { id: "u-cmms-engineer", displayName: "\u0645\u0647\u0646\u062F\u0633 \u0646\u062A (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["maintenance_engineer"], projectIds: ["*"], plantIds: ["SITE-DEMO"], active: true, party: "contractor" },
  { id: "u-cmms-tech", displayName: "\u062A\u06A9\u0646\u0633\u06CC\u0646 \u0646\u062A (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["maintenance_technician"], projectIds: ["*"], plantIds: ["SITE-DEMO"], active: true, party: "contractor" },
  { id: "u-cmms-store", displayName: "\u0627\u0646\u0628\u0627\u0631\u062F\u0627\u0631 \u0646\u062A (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["maintenance_storekeeper"], projectIds: ["*"], plantIds: ["SITE-DEMO"], active: true, party: "contractor" },
  { id: "u-cmms-cbm", displayName: "\u062A\u062D\u0644\u06CC\u0644\u200C\u06AF\u0631 \u067E\u0627\u06CC\u0634 \u0648\u0636\u0639\u06CC\u062A (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["condition_monitoring_analyst"], projectIds: ["*"], plantIds: ["SITE-DEMO"], active: true, party: "contractor" },
  /* بخش ۵ — کاربران آزمایشی پایش میدانی و تله‌متری حفاری. اینجا `plantIds`
   * همان «دامنهٔ دکل» است (توضیحش در سرآییند server/iiotApi.js آمده). دامنهٔ
   * RIG-DEMO عمداً از SITE-DEMO و PLANT-DEMO جداست تا دامنه‌بندی دکل واقعاً
   * آزموده شود و دسترسی سایت نت به دادهٔ دکل نشت نکند. */
  { id: "u-iiot-eng", displayName: "\u0645\u0647\u0646\u062F\u0633 \u062A\u0644\u0647\u200C\u0645\u062A\u0631\u06CC (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["iiot_engineer"], projectIds: ["*"], plantIds: ["RIG-DEMO"], active: true, party: "contractor" },
  { id: "u-iiot-driller", displayName: "\u0633\u0631\u067E\u0631\u0633\u062A \u062D\u0641\u0627\u0631\u06CC \u0634\u06CC\u0641\u062A (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["drilling_supervisor"], projectIds: ["*"], plantIds: ["RIG-DEMO"], active: true, party: "contractor" },
  { id: "u-iiot-tech", displayName: "\u062A\u06A9\u0646\u0633\u06CC\u0646 \u0627\u0628\u0632\u0627\u0631 \u062F\u0642\u06CC\u0642 (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)", roles: ["field_iot_technician"], projectIds: ["*"], plantIds: ["RIG-DEMO"], active: true, party: "contractor" }
];

// src/services/iiotApi.ts
var DEFAULT_RIG_ID = "RIG-DEMO";
function findIiotSubject(userId) {
  if (!userId) return null;
  return DEMO_SUBJECTS.find((s) => s.id === userId) ?? null;
}
function evaluateIiotAccess(userId, permission, rigId = DEFAULT_RIG_ID) {
  const subject = findIiotSubject(userId);
  if (!subject) {
    return {
      allow: false,
      code: "DENY_INACTIVE",
      reason: { fa: "\u06A9\u0627\u0631\u0628\u0631 \u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A", en: "Unauthenticated user" },
      audit: true
    };
  }
  return evaluate(subject, permission, { plantId: rigId });
}
function canIiotAccess(userId, permission, rigId = DEFAULT_RIG_ID) {
  return evaluateIiotAccess(userId, permission, rigId).allow;
}
var IIOT_SIGNAL_META = {
  wob: { fa: "\u0648\u0632\u0646 \u0631\u0648\u06CC \u0645\u062A\u0647", en: "Weight on Bit", uom: "klbf", shortFa: "WOB", max: 60, decimals: 1 },
  rpm: { fa: "\u062F\u0648\u0631 \u0645\u062A\u0647", en: "Rotary Speed", uom: "rpm", shortFa: "RPM", max: 200, decimals: 0 },
  torque: { fa: "\u06AF\u0634\u062A\u0627\u0648\u0631", en: "Torque", uom: "kft\xB7lb", shortFa: "TORQUE", max: 40, decimals: 1 },
  "mud-pump-pressure": { fa: "\u0641\u0634\u0627\u0631 \u067E\u0645\u067E \u06AF\u0644", en: "Mud Pump Pressure", uom: "psi", shortFa: "SPP", max: 5e3, decimals: 0 },
  "flow-rate": { fa: "\u062F\u0628\u06CC \u062C\u0631\u06CC\u0627\u0646", en: "Flow Rate", uom: "gpm", shortFa: "FLOW", max: 1500, decimals: 0 },
  temperature: { fa: "\u062F\u0645\u0627", en: "Temperature", uom: "\xB0C", shortFa: "TEMP", max: 200, decimals: 1 },
  vibration: { fa: "\u0627\u0631\u062A\u0639\u0627\u0634", en: "Vibration", uom: "mm/s", shortFa: "VIB", max: 30, decimals: 2 },
  rop: { fa: "\u0646\u0631\u062E \u0646\u0641\u0648\u0630", en: "Rate of Penetration", uom: "m/h", shortFa: "ROP", max: 60, decimals: 1 },
  depth: { fa: "\u0639\u0645\u0642 \u0686\u0627\u0647", en: "Depth", uom: "m", shortFa: "DEPTH", max: 6e3, decimals: 0 },
  "standpipe-pressure": { fa: "\u0641\u0634\u0627\u0631 \u0644\u0648\u0644\u0647\u0654 \u0642\u0627\u0626\u0645", en: "Standpipe Pressure", uom: "psi", shortFa: "SP", max: 5e3, decimals: 0 },
  hookload: { fa: "\u0628\u0627\u0631 \u0647\u0648\u06A9", en: "Hookload", uom: "klbf", shortFa: "HOOK", max: 500, decimals: 0 },
  gas: { fa: "\u06AF\u0627\u0632 \u06AF\u0644", en: "Gas Units", uom: "%", shortFa: "GAS", max: 100, decimals: 1 }
};

// src/services/iiotDashboard.ts
var IIOT_DASHBOARD_VERSION = "iiot-dashboard-v1";
var IIOT_TONE_ORDER = ["danger", "warn", "ok", "idle"];
var IIOT_TONE_LABEL = {
  ok: { fa: "\u0633\u0627\u0644\u0645", en: "Normal", glyph: "\u25CF", dot: "bg-emerald-400" },
  warn: { fa: "\u0647\u0634\u062F\u0627\u0631", en: "Warning", glyph: "\u25B2", dot: "bg-amber-400" },
  danger: { fa: "\u0628\u062D\u0631\u0627\u0646\u06CC", en: "Critical", glyph: "\u25C6", dot: "bg-rose-500" },
  idle: { fa: "\u0628\u06CC\u200C\u062F\u0627\u062F\u0647", en: "No data", glyph: "\u25CB", dot: "bg-slate-500" }
};
function toneForStatus(status) {
  switch (status) {
    case "critical":
      return "danger";
    case "warning":
      return "warn";
    case "normal":
    case "ok":
      return "ok";
    default:
      return "idle";
  }
}
var IIOT_TONE_FRAME = {
  ok: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/50 bg-amber-500/10 text-amber-300",
  danger: "border-rose-500/60 bg-rose-500/10 text-rose-300",
  idle: "border-slate-500/40 bg-slate-500/10 text-slate-400"
};
function toneWeight(tone) {
  return IIOT_TONE_ORDER.length - IIOT_TONE_ORDER.indexOf(tone);
}
function formatMeasure(value, opts = {}) {
  const fallback = opts.fallback ?? "\u2014";
  if (value === null || value === void 0 || !Number.isFinite(Number(value))) return fallback;
  const decimals = Math.max(0, Math.min(6, opts.decimals ?? 1));
  const text = Number(value).toFixed(decimals);
  return opts.uom ? `${text} ${opts.uom}` : text;
}
function decimalsForSignal(signalType) {
  const meta = signalType ? IIOT_SIGNAL_META[signalType] : void 0;
  return meta?.decimals ?? 1;
}
function displayRangeFor(signalType, displayMin, displayMax) {
  const meta = signalType ? IIOT_SIGNAL_META[signalType] : void 0;
  const min = typeof displayMin === "number" && Number.isFinite(displayMin) ? displayMin : 0;
  const fallbackMax = meta?.max ?? 100;
  const max = typeof displayMax === "number" && Number.isFinite(displayMax) && displayMax > min ? displayMax : Math.max(fallbackMax, min + 1);
  return { min, max };
}
function gaugeFillPct(value, min, max) {
  if (value === null || value === void 0 || !Number.isFinite(Number(value))) return 0;
  if (!(max > min)) return 0;
  const pct = (Number(value) - min) / (max - min) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}
function formatAgeFa(seconds) {
  if (seconds === null || seconds === void 0 || !Number.isFinite(seconds)) return "\u0628\u06CC\u200C\u0632\u0645\u0627\u0646";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} \u062B\u0627\u0646\u06CC\u0647 \u067E\u06CC\u0634`;
  if (s < 3600) return `${Math.floor(s / 60)} \u062F\u0642\u06CC\u0642\u0647 \u067E\u06CC\u0634`;
  if (s < 86400) return `${Math.floor(s / 3600)} \u0633\u0627\u0639\u062A \u067E\u06CC\u0634`;
  return `${Math.floor(s / 86400)} \u0631\u0648\u0632 \u067E\u06CC\u0634`;
}
function ageSecondsOf(iso, nowIso) {
  if (!iso || !nowIso) return null;
  const t = Date.parse(iso);
  const now = Date.parse(nowIso);
  if (Number.isNaN(t) || Number.isNaN(now)) return null;
  return Math.max(0, Math.round((now - t) / 1e3));
}
var round2 = (n) => Math.round(n * 100) / 100;
function buildChartGeometry(points, opts = {}) {
  const width = opts.width ?? 760;
  const height = opts.height ?? 220;
  const padX = opts.padX ?? 34;
  const padY = opts.padY ?? 18;
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padY * 2);
  const rows = (Array.isArray(points) ? points : []).filter((p) => p && typeof p.at === "string");
  const rawValues = rows.map((p) => p.value).filter((v) => typeof v === "number" && Number.isFinite(v));
  const filteredValues = rows.map((p) => p.filtered).filter((v) => typeof v === "number" && Number.isFinite(v));
  const all = [...rawValues, ...filteredValues];
  const empty = all.length === 0;
  const cfgMin = typeof opts.displayMin === "number" && Number.isFinite(opts.displayMin) ? opts.displayMin : null;
  const cfgMax = typeof opts.displayMax === "number" && Number.isFinite(opts.displayMax) && (cfgMin === null || opts.displayMax > cfgMin) ? opts.displayMax : null;
  let min = cfgMin ?? (empty ? 0 : Math.min(...all));
  let max = cfgMax ?? (empty ? 1 : Math.max(...all));
  if (!empty) {
    min = Math.min(min, ...all);
    max = Math.max(max, ...all);
  }
  if (!(max > min)) max = min + 1;
  const xOf = (index) => rows.length <= 1 ? padX : padX + index / (rows.length - 1) * innerW;
  const yOf = (value) => padY + innerH - (value - min) / (max - min) * innerH;
  const lineFor = (key, pick) => {
    const vertices = [];
    rows.forEach((p, index) => {
      const value = pick(p);
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      vertices.push({ x: round2(xOf(index)), y: round2(yOf(value)), at: p.at, value });
    });
    const shifted = vertices.length === 1 ? [{ x: padX, y: vertices[0].y, at: vertices[0].at, value: vertices[0].value }, { x: padX + innerW, y: vertices[0].y, at: vertices[0].at, value: vertices[0].value }] : vertices;
    return { key, vertices, points: shifted.map((v) => `${v.x},${v.y}`).join(" ") };
  };
  const rawLine = lineFor("raw", (p) => p.value);
  const filteredLine = lineFor("filtered", (p) => p.filtered);
  const lines = [...rawLine.vertices.length ? [rawLine] : [], ...filteredLine.vertices.length ? [filteredLine] : []];
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const value = max - (max - min) * i / (tickCount - 1);
    return { y: round2(padY + innerH * i / (tickCount - 1)), value: Math.round(value * 1e3) / 1e3 };
  });
  const areaBase = round2(padY + innerH);
  const rawArea = rawLine.vertices.length ? `M ${rawLine.vertices[0].x} ${areaBase} L ${rawLine.vertices.map((v) => `${v.x} ${v.y}`).join(" L ")} L ${rawLine.vertices[rawLine.vertices.length - 1].x} ${areaBase} Z` : "";
  return {
    width,
    height,
    padX,
    padY,
    empty,
    sampleCount: rows.length,
    min: round2(min),
    max: round2(max),
    lines,
    yTicks,
    xTickCount: Math.min(6, rows.length),
    firstAt: rows.length ? rows[0].at : null,
    lastAt: rows.length ? rows[rows.length - 1].at : null,
    rawArea
  };
}
function summarizeGaugeStatuses(gauges) {
  const out = { ok: 0, warn: 0, danger: 0, idle: 0 };
  for (const gauge of Array.isArray(gauges) ? gauges : []) out[toneForStatus(gauge?.status)] += 1;
  return out;
}
function summarizeBufferRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const pending = list.filter((r) => r?.Status === "buffered" || r?.Status === "sending" || r?.Status === "failed");
  const deadLetter = list.filter((r) => r?.Status === "dead-letter");
  const oldest = [...pending, ...deadLetter].map((r) => r?.CapturedAt).filter((v) => typeof v === "string" && v.length > 0).sort()[0] ?? null;
  return {
    buffered: list.filter((r) => r?.Status === "buffered" || r?.Status === "sending").length,
    failed: list.filter((r) => r?.Status === "failed").length,
    deadLetter: deadLetter.length,
    sent: list.filter((r) => r?.Status === "sent").length,
    pendingSamples: [...pending, ...deadLetter].reduce((sum, r) => sum + (Number(r?.SampleCount) || 0), 0),
    oldestCapturedAt: oldest,
    needsAttention: deadLetter.length > 0
  };
}
function summarizeIntegrationEvents(events) {
  const list = Array.isArray(events) ? events : [];
  const byTarget = {};
  for (const e of list) {
    const target = String(e?.TargetSystem ?? "unknown");
    byTarget[target] = (byTarget[target] ?? 0) + 1;
  }
  return {
    pending: list.filter((e) => e?.Status === "pending").length,
    dispatched: list.filter((e) => e?.Status === "dispatched").length,
    failed: list.filter((e) => e?.Status === "failed").length,
    deadLetter: list.filter((e) => e?.Status === "dead-letter").length,
    retryable: list.filter((e) => e?.Status === "failed" || e?.Status === "dead-letter" || e?.Status === "pending").length,
    byTarget
  };
}
var IIOT_ACTION_PERMISSIONS = Object.freeze({
  acknowledgeAlert: "iiot.alert.ack",
  resolveAlert: "iiot.alert.resolve",
  falsePositiveAlert: "iiot.alert.resolve",
  dispatchAlert: "iiot.alert.dispatch",
  verifyDowntime: "iiot.downtime.verify",
  reportDowntime: "iiot.downtime.report",
  ingestTelemetry: "iiot.telemetry.ingest",
  configureRule: "iiot.threshold.edit",
  syncBuffer: "iiot.buffer.sync",
  calibrateSensor: "iiot.sensor.calibrate",
  recordCondition: "iiot.condition.record",
  dispatchEvent: "iiot.integration.dispatch",
  createRig: "iiot.rig.edit"
});
function permissionOf(action) {
  return IIOT_ACTION_PERMISSIONS[action];
}
function canPerformAction(userId, action, rigId = DEFAULT_RIG_ID) {
  return canIiotAccess(userId, permissionOf(action), rigId);
}
function actionGates(userId, rigId = DEFAULT_RIG_ID) {
  const out = {};
  for (const action of Object.keys(IIOT_ACTION_PERMISSIONS)) out[action] = canPerformAction(userId, action, rigId);
  return out;
}
var IIOT_DEMO_CHANNELS = [
  { code: "CH-WOB", signalType: "wob", nameFa: "\u0648\u0632\u0646 \u0631\u0648\u06CC \u0645\u062A\u0647", unit: "klbf", displayMin: 0, displayMax: 60, isCritical: false },
  { code: "CH-RPM", signalType: "rpm", nameFa: "\u062F\u0648\u0631 \u0645\u062A\u0647", unit: "rpm", displayMin: 0, displayMax: 200, isCritical: false },
  { code: "CH-TORQUE", signalType: "torque", nameFa: "\u06AF\u0634\u062A\u0627\u0648\u0631 \u0631\u0634\u062A\u0647", unit: "kft.lbf", displayMin: 0, displayMax: 40, isCritical: true },
  { code: "CH-SPP", signalType: "mud-pump-pressure", nameFa: "\u0641\u0634\u0627\u0631 \u067E\u0645\u067E \u06AF\u0644", unit: "psi", displayMin: 0, displayMax: 5e3, isCritical: true },
  { code: "CH-TEMP", signalType: "temperature", nameFa: "\u062F\u0645\u0627\u06CC \u06CC\u0627\u062A\u0627\u0642\u0627\u0646", unit: "C", displayMin: 0, displayMax: 150, isCritical: true },
  { code: "CH-VIB", signalType: "vibration", nameFa: "\u0627\u0631\u062A\u0639\u0627\u0634 \u067E\u0645\u067E", unit: "mm/s", displayMin: 0, displayMax: 30, isCritical: false }
];
var IIOT_DEMO_RULES = [
  {
    code: "TR-TEMP-HH",
    channelCode: "CH-TEMP",
    nameFa: "\u062F\u0645\u0627\u06CC \u0628\u062D\u0631\u0627\u0646\u06CC \u06CC\u0627\u062A\u0627\u0642\u0627\u0646",
    level: "critical",
    detectKind: "threshold",
    comparison: "gt",
    thresholdValue: 120,
    durationSeconds: 20,
    minSamples: 5,
    hysteresisPct: 5,
    cooldownSeconds: 300,
    autoDispatch: true,
    nptCode: "NPT-1.1",
    cmmsSiteRef: "SITE-DEMO",
    mesWorkCenterRef: "WC-DRILL-01",
    pmisProjectRef: "c1-p1"
  },
  {
    code: "TR-TORQ-H",
    channelCode: "CH-TORQUE",
    nameFa: "\u06AF\u0634\u062A\u0627\u0648\u0631 \u0628\u0627\u0644\u0627 (\u0647\u0634\u062F\u0627\u0631)",
    level: "warning",
    detectKind: "threshold",
    comparison: "gt",
    thresholdValue: 28,
    durationSeconds: 15,
    minSamples: 4,
    cooldownSeconds: 300,
    autoDispatch: false
  },
  {
    code: "TR-STICKSLIP",
    channelCode: "CH-TORQUE",
    nameFa: "\u062A\u0634\u062E\u06CC\u0635 Stick-Slip",
    level: "critical",
    detectKind: "stick-slip",
    comparison: "gt",
    durationSeconds: 5,
    minSamples: 6,
    cooldownSeconds: 300,
    autoDispatch: false
  },
  {
    code: "TR-SPP-DROP",
    channelCode: "CH-SPP",
    nameFa: "\u0627\u0641\u062A \u0641\u0634\u0627\u0631 \u067E\u0645\u067E \u06AF\u0644",
    level: "critical",
    detectKind: "pump-drop",
    comparison: "lt",
    thresholdValue: 20,
    durationSeconds: 5,
    minSamples: 6,
    cooldownSeconds: 300,
    autoDispatch: false
  }
];
function buildDemoRigPlan(rigId = DEFAULT_RIG_ID) {
  return {
    version: IIOT_DASHBOARD_VERSION,
    rigId,
    rig: {
      RigId: rigId,
      RigNo: "RIG-91",
      NameFa: "\u062F\u06A9\u0644 \u06F9\u06F1 \u0622\u0632\u0627\u062F\u06AF\u0627\u0646 \u062C\u0646\u0648\u0628\u06CC (\u0646\u0645\u0648\u0646\u0647)",
      RigType: "land",
      Status: "drilling",
      FieldName: "\u0622\u0632\u0627\u062F\u06AF\u0627\u0646 \u062C\u0646\u0648\u0628\u06CC",
      WellName: "AZ-91",
      CmmsSiteRef: "SITE-DEMO",
      PmisProjectRef: "c1-p1",
      MesWorkCenterRef: "WC-DRILL-01",
      TimeZoneId: "Asia/Tehran",
      NominalSampleRateHz: 1,
      IsActive: true,
      NoteFa: "\u062F\u06A9\u0644 \u0646\u0645\u0648\u0646\u0647\u0654 \u062F\u0627\u0634\u0628\u0648\u0631\u062F IIoT & DAS \u2014 \u0633\u0627\u062E\u062A\u0647\u200C\u0634\u062F\u0647 \u0627\u0632 \u0631\u0627\u0647 REST"
    },
    gateway: {
      code: "GW-01",
      body: {
        GatewayCode: "GW-01",
        NameFa: "\u06AF\u06CC\u062A\u200C\u0648\u06CC \u0644\u0628\u0647\u0654 \u062F\u06A9\u0644 \u06F9\u06F1",
        Protocol: "mqtt",
        SyncMode: "store-forward",
        BufferCapacity: 1e4,
        MaxBatchSize: 500,
        MaxAttempts: 3,
        AuthMode: "token",
        IsActive: true
      }
    },
    stream: {
      code: "MUDLOG-01",
      body: {
        StreamCode: "MUDLOG-01",
        NameFa: "\u062C\u0631\u06CC\u0627\u0646 \u0645\u0627\u062F\u0644\u0627\u06AF\u0631",
        SourceSystem: "mudlogger",
        TransportProtocol: "mqtt",
        SampleRateHz: 1,
        BatchSize: 100,
        ConnectionState: "offline",
        IsActive: true
      }
    },
    channels: IIOT_DEMO_CHANNELS.map((spec) => ({
      code: spec.code,
      signalType: spec.signalType,
      body: {
        ChannelCode: spec.code,
        NameFa: spec.nameFa,
        SignalType: spec.signalType,
        Unit: spec.unit,
        DisplayMin: spec.displayMin,
        DisplayMax: spec.displayMax,
        SampleRateHz: 1,
        FilterMethod: "sma",
        FilterWindowSeconds: 5,
        DeadbandPct: 0.5,
        IsCritical: spec.isCritical,
        IsActive: true
      }
    })),
    rules: IIOT_DEMO_RULES.map((spec) => ({
      code: spec.code,
      channelCode: spec.channelCode,
      body: {
        RuleCode: spec.code,
        NameFa: spec.nameFa,
        Level: spec.level,
        DetectKind: spec.detectKind,
        Comparison: spec.comparison,
        ThresholdValue: spec.thresholdValue,
        DurationSeconds: spec.durationSeconds,
        MinSamples: spec.minSamples,
        HysteresisPct: spec.hysteresisPct,
        CooldownSeconds: spec.cooldownSeconds,
        AutoDispatch: spec.autoDispatch,
        DispatchTargets: spec.autoDispatch ? "cmms,mes,pmis" : null,
        CmmsSiteRef: spec.cmmsSiteRef,
        MesWorkCenterRef: spec.mesWorkCenterRef,
        PmisProjectRef: spec.pmisProjectRef,
        NptCode: spec.nptCode,
        IsActive: true
      }
    }))
  };
}
function resolveDemoRigPlan(plan, resolved) {
  return {
    stream: { ...plan.stream.body, GatewayId: resolved.gatewayId },
    channels: plan.channels.map((channel) => ({ code: channel.code, signalType: channel.signalType, body: { ...channel.body, StreamId: resolved.streamId } })),
    rules: plan.rules.map((rule) => ({ code: rule.code, channelCode: rule.channelCode, body: { ...rule.body, ChannelId: resolved.channelIdByCode[rule.channelCode] ?? null } }))
  };
}
var IIOT_DEMO_BASELINE = {
  wob: 22,
  rpm: 110,
  torque: 18,
  "mud-pump-pressure": 3200,
  "flow-rate": 720,
  temperature: 78,
  vibration: 3.2,
  rop: 14,
  depth: 2450,
  "standpipe-pressure": 3100,
  hookload: 210,
  gas: 2.4
};
var round3 = (n) => Math.round(n * 1e3) / 1e3;
function demoSignalValue(signalType, index, baselineOverride) {
  const base = baselineOverride ?? IIOT_DEMO_BASELINE[signalType] ?? 10;
  const swing = signalType === "depth" || signalType === "hookload" ? 2e-3 : 0.06;
  return round3(base * (1 + swing * Math.sin(index / 9)));
}
function buildDemoTelemetrySamples(input) {
  const minutes = Math.max(1, Math.min(60, input.minutes ?? 10));
  const stepSeconds = Math.max(1, input.stepSeconds ?? 10);
  const nowMs = Date.parse(input.nowIso);
  if (Number.isNaN(nowMs)) return [];
  const count = Math.floor(minutes * 60 / stepSeconds);
  const out = [];
  for (const channel of input.channels) {
    for (let i = count; i >= 1; i -= 1) {
      out.push({
        channelCode: channel.code,
        at: new Date(nowMs - i * stepSeconds * 1e3).toISOString(),
        value: demoSignalValue(channel.signalType, i),
        quality: "good",
        source: "simulated"
      });
    }
  }
  return out;
}
function buildSpikeSamples(input) {
  const samples = Math.max(2, Math.min(600, input.samples ?? 24));
  const stepSeconds = Math.max(1, input.stepSeconds ?? 1);
  const nowMs = Date.parse(input.nowIso);
  if (Number.isNaN(nowMs)) return [];
  const out = [];
  for (let i = 0; i < samples; i += 1) {
    const ratio = samples === 1 ? 1 : i / (samples - 1);
    out.push({
      channelCode: input.channelCode,
      at: new Date(nowMs - (samples - 1 - i) * stepSeconds * 1e3).toISOString(),
      value: round3(input.from + (input.to - input.from) * ratio),
      quality: "good",
      source: "simulated"
    });
  }
  return out;
}
export {
  IIOT_ACTION_PERMISSIONS,
  IIOT_DASHBOARD_VERSION,
  IIOT_DEMO_BASELINE,
  IIOT_DEMO_CHANNELS,
  IIOT_DEMO_RULES,
  IIOT_TONE_FRAME,
  IIOT_TONE_LABEL,
  IIOT_TONE_ORDER,
  actionGates,
  ageSecondsOf,
  buildChartGeometry,
  buildDemoRigPlan,
  buildDemoTelemetrySamples,
  buildSpikeSamples,
  canPerformAction,
  decimalsForSignal,
  demoSignalValue,
  displayRangeFor,
  formatAgeFa,
  formatMeasure,
  gaugeFillPct,
  permissionOf,
  resolveDemoRigPlan,
  summarizeBufferRows,
  summarizeGaugeStatuses,
  summarizeIntegrationEvents,
  toneForStatus,
  toneWeight
};
