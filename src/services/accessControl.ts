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
    grants: ["core.portfolio.view", "core.project.view", "doc.document.view", "plan.schedule.view", "pex.dashboard.view", "gov.process.view", "report.internal.generate"],
  },
  {
    code: "site_engineer",
    title: { fa: "مهندس/سرپرست کارگاه", en: "Site Engineer" },
    inherits: ["viewer"],
    clearance: "internal",
    party: "contractor",
    grants: ["plan.progress.report", "doc.document.upload", "qms.itp.view", "qms.inspection.record", "hrm.roster.view", "hrm.timesheet.enter", "ckm.meeting.record"],
  },
  {
    code: "planner",
    title: { fa: "کارشناس برنامه‌ریزی", en: "Planner" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: ["plan.schedule.edit", "plan.progress.report", "pex.evm.view", "pex.forecast.edit", "rcc.risk.view", "core.ai.run"],
  },
  {
    code: "cost_controller",
    title: { fa: "کنترل هزینه", en: "Cost Controller" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: ["fin.cost.view", "fin.ipc.prepare", "fin.invoice.issue", "fin.rate.view", "pex.evm.view", "hrm.productivity.view", "core.ai.run"],
  },
  {
    code: "qc_inspector",
    title: { fa: "بازرس کیفیت", en: "QC Inspector" },
    inherits: ["viewer"],
    clearance: "internal",
    party: "any",
    grants: ["qms.itp.view", "qms.inspection.record", "qms.ncr.raise"],
  },
  {
    code: "qa_manager",
    title: { fa: "مدیر تضمین کیفیت", en: "QA Manager" },
    // عمداً از qc_inspector ارث نمی‌برد: صدور و بستن عدم انطباق باید جدا بماند (SOD-02).
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: ["qms.itp.view", "qms.ncr.close", "qms.audit.conduct", "gov.gate.review", "doc.document.approve"],
  },
  {
    code: "hr_manager",
    title: { fa: "مدیر منابع انسانی", en: "HR Manager" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: ["hrm.roster.view", "hrm.timesheet.approve", "hrm.rate.view", "hrm.personal.view", "hrm.productivity.view"],
  },
  {
    code: "doc_controller",
    title: { fa: "کنترل مدارک", en: "Document Controller" },
    inherits: ["viewer"],
    clearance: "confidential",
    party: "contractor",
    grants: ["doc.document.upload", "doc.transmittal.issue", "ckm.letter.view", "ckm.letter.draft", "ckm.meeting.record", "ckm.lesson.publish"],
  },
  {
    code: "contracts_manager",
    title: { fa: "مدیر پیمان و ادعا", en: "Contracts Manager" },
    inherits: ["viewer"],
    clearance: "restricted",
    party: "contractor",
    grants: ["rcc.claim.view", "rcc.claim.edit", "rcc.change.raise", "fin.cost.view", "fin.rate.view", "ckm.letter.view", "ckm.letter.draft"],
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
      "doc.document.approve", "doc.transmittal.issue",
      "ckm.letter.view", "ckm.letter.draft", "ckm.letter.sign",
      "gov.gate.review", "report.official.publish",
    ],
  },
  {
    code: "pmo",
    title: { fa: "دفتر مدیریت پروژه", en: "PMO" },
    inherits: ["planner"],
    clearance: "restricted",
    party: "contractor",
    grants: ["gov.process.view", "gov.gate.review", "gov.owner.assign", "pex.kpi.edit", "rcc.risk.edit", "fin.cost.view", "report.official.publish", "report.export.bulk", "sys.audit.view"],
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
    grants: ["doc.document.approve", "plan.progress.approve", "qms.itp.view", "qms.inspection.record", "qms.ncr.raise", "fin.ipc.prepare", "ckm.letter.view", "ckm.letter.draft", "gov.gate.review"],
  },
  {
    code: "client",
    title: { fa: "کارفرما", en: "Client" },
    inherits: ["viewer"],
    // سطح «سری»: نمایندهٔ کارفرما صورت‌وضعیت را تأیید و نامهٔ رسمی را امضا می‌کند.
    // جداسازی دادهٔ پیمانکار از کارفرما محور جداگانه‌ای است (party) نه سطح دسترسی.
    clearance: "restricted",
    party: "client",
    grants: ["fin.cost.view", "fin.ipc.approve", "pex.evm.view", "rcc.change.approve", "gov.gate.approve", "ckm.letter.view", "ckm.letter.sign", "doc.document.approve"],
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
    grants: ["sys.config.manage", "sys.user.manage", "sys.audit.purge", "sys.backup.export", "sys.backup.restore", "report.export.bulk", "core.portfolio.view", "core.project.view"],
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
    id: "SOD-07",
    a: "fin.budget.edit",
    b: "fin.invoice.issue",
    severity: "critical",
    reason: { fa: "ویرایش بودجه و صدور فاکتور نباید در یک دست جمع شود", en: "Budget editing and invoicing must not be combined" },
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
