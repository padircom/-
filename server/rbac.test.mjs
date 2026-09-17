import test from "node:test";
import assert from "node:assert/strict";
import {
  CLASSIFICATION_RANK,
  DEFAULT_LOCKOUT,
  DEFAULT_PASSWORD_POLICY,
  DEMO_DELEGATIONS,
  DEMO_SUBJECTS,
  MASK_RULES,
  PERMISSION_CATALOG,
  PERMISSION_CODES,
  RBAC_ENGINE_VERSION,
  ROLE_CATALOG,
  SOD_RULES,
  auditSeverity,
  buildAuditRecord,
  can,
  checkPassword,
  combinedClearance,
  danglingGrants,
  delegatedPermissions,
  effectivePermissions,
  evaluate,
  hasInheritanceCycle,
  isApprovalPermission,
  isDelegationActive,
  loginThrottle,
  maskRecord,
  maskedFields,
  meetsClearance,
  orphanPermissions,
  permissionDef,
  permissionsOfModule,
  roleDef,
  roleMatrix,
  roleTitle,
  scorePosture,
  sessionPolicyFor,
  sodInstanceConflict,
  sodViolations,
  subjectClearance,
  subjectPermissions,
  validateDelegation,
} from "./rbacLogic.js";

const subj = (id) => DEMO_SUBJECTS.find((s) => s.id === id);
const TODAY = "2026-09-08";

/* ══════════ ۱. یکپارچگی کاتالوگ ══════════ */

test("کاتالوگ: نسخه موتور و اندازه‌ها", () => {
  assert.equal(RBAC_ENGINE_VERSION, "rbac-v1");
  /* ۵۹ پایه + ۱۲ مهندسی + ۹ پیمان + ۳ تحویل نهایی + ۳ تفکیک سیستمی
     + ۲ بستهٔ آزمون + ۹ ایمنی و بهداشت + ۴ سامانهٔ پروانهٔ کار
     + ۲ گزارش پیمان (دیدن و صدور رسمی)
     + ۸ تایم‌شیت نیروی انسانی (سه گیت تأیید، قفل دوره، دو سند
       اصلاحی، حل تعارض، ارسال هزینه)
     + ۵ بهره‌وری نیروی انسانی (اجرای محاسبه، ثبت علت افت، پیوند به
       ادعا، نهایی‌سازی متریک، کالیبراسیون نرخ)
     + ۹ اکیپ و نیروی پیمانکاری (سه اکیپ: دیدن، ترکیب، انحلال؛
       شش پیمانکاری: دیدن و مدیریت قرارداد، ثبت و تأیید حضور
       گروهی، تهیه و تأیید صورت‌کارکرد)
     + ۹ پذیرش و انطباق (چهار پرونده: دیدن، مدیریت، فعال‌سازی،
       تخلیه؛ دو مدرک: بارگذاری و تأیید اصالت؛ ارزیابی مهارت؛
       دو تجهیز: درخواست و تأیید)
     + ۳ تحلیل نیرو (مشاهده، صدور رسمی، ثبت مبنا) + ۱ پایش دستگاه میدانی؛
     ۲۰ نقش پیشین + افسر ایمنی و بهداشت. */
  assert.equal(PERMISSION_CATALOG.length, 180);
  assert.equal(ROLE_CATALOG.length, 21);
});

test("کاتالوگ: کد مجوزها یکتا و با قالب domain.resource.action هستند", () => {
  assert.equal(new Set(PERMISSION_CODES).size, PERMISSION_CODES.length);
  for (const c of PERMISSION_CODES) {
    assert.match(c, /^[a-z]+\.[a-z]+\.[a-z]+$/, `کد نامعتبر: ${c}`);
  }
});

test("کاتالوگ: کد نقش‌ها یکتاست و همه عنوان دوزبانه دارند", () => {
  const codes = ROLE_CATALOG.map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const r of ROLE_CATALOG) {
    assert.ok(r.title.fa && r.title.en, `${r.code} عنوان ناقص`);
  }
});

test("کاتالوگ: هیچ مجوز یتیمی نیست — هر مجوز دست‌کم یک نقش دارد", () => {
  assert.deepEqual(orphanPermissions(), []);
});

test("کاتالوگ: هیچ نقشی به مجوز ناموجود ارجاع نمی‌دهد", () => {
  assert.deepEqual(danglingGrants(), []);
});

test("کاتالوگ: زنجیره وراثت نقش‌ها حلقه ندارد", () => {
  assert.deepEqual(hasInheritanceCycle(), []);
});

test("کاتالوگ: هیچ نقشی به‌تنهایی تفکیک وظیفه را نقض نمی‌کند", () => {
  for (const r of ROLE_CATALOG) {
    assert.deepEqual(sodViolations(effectivePermissions(r.code)).map((x) => x.id), [], `نقش ${r.code}`);
  }
});

test("permissionDef و permissionsOfModule درست کار می‌کنند", () => {
  assert.equal(permissionDef("fin.ipc.approve").module, "d5");
  assert.equal(permissionDef("ناموجود"), undefined);
  assert.ok(permissionsOfModule("d8").length >= 5);
  assert.equal(permissionsOfModule("d99").length, 0);
});

/* ══════════ ۲. وراثت نقش ══════════ */

test("وراثت: نقش فرزند مجوزهای والد را دارد", () => {
  const site = effectivePermissions("site_engineer");
  assert.ok(site.includes("core.project.view"), "از viewer به ارث نرسیده");
  assert.ok(site.includes("qms.inspection.record"), "مجوز مستقیم ندارد");
});

test("وراثت: خروجی مرتب و بدون تکرار است", () => {
  const p = effectivePermissions("project_manager");
  assert.equal(new Set(p).size, p.length);
  assert.deepEqual(p, [...p].sort());
});

test("وراثت: نقش ناشناخته آرایه خالی می‌دهد", () => {
  assert.deepEqual(effectivePermissions("no_such_role"), []);
});

test("roleDef و roleTitle دوزبانه", () => {
  assert.equal(roleDef("pmo").clearance, "restricted");
  assert.equal(roleTitle("client", "fa"), "کارفرما");
  assert.equal(roleTitle("client", "en"), "Client");
  assert.equal(roleTitle("unknown", "fa"), "unknown");
});

test("roleMatrix: برای همه نقش‌ها ردیف تولید می‌کند", () => {
  const m = roleMatrix();
  assert.equal(m.length, ROLE_CATALOG.length);
  assert.ok(m.every((row) => row.permissions.length > 0));
});

/* ══════════ ۳. طبقه‌بندی و سطح دسترسی ══════════ */

test("طبقه‌بندی: ترتیب رتبه‌ها درست است", () => {
  assert.ok(CLASSIFICATION_RANK.public < CLASSIFICATION_RANK.internal);
  assert.ok(CLASSIFICATION_RANK.confidential < CLASSIFICATION_RANK.restricted);
});

test("meetsClearance: سطح بالاتر سطح پایین‌تر را پوشش می‌دهد و برعکس نه", () => {
  assert.equal(meetsClearance("restricted", "confidential"), true);
  assert.equal(meetsClearance("internal", "internal"), true);
  assert.equal(meetsClearance("internal", "restricted"), false);
});

test("combinedClearance: بالاترین سطح میان نقش‌ها انتخاب می‌شود", () => {
  assert.equal(combinedClearance(["viewer", "hr_manager"]), "restricted");
  assert.equal(combinedClearance(["viewer"]), "internal");
  assert.equal(combinedClearance([]), "public");
});

test("subjectClearance: مقدار صریح بر استنتاج از نقش مقدم است", () => {
  assert.equal(subjectClearance(subj("u-site")), "internal");
  assert.equal(subjectClearance({ ...subj("u-site"), clearance: "restricted" }), "restricted");
});

/* ══════════ ۴. مجوزهای کاربر ══════════ */

test("subjectPermissions: منع صریح بر اعطای نقش غالب است", () => {
  const s = { ...subj("u-pm"), denies: ["fin.ipc.approve"] };
  assert.ok(!subjectPermissions(s).includes("fin.ipc.approve"));
});

test("subjectPermissions: اعطای موردی به مجموعه افزوده می‌شود", () => {
  const s = { ...subj("u-site"), extraGrants: ["fin.cost.view"] };
    assert.ok(subjectPermissions(s).includes("fin.cost.view"));
});

test("subjectPermissions: کاربر چندنقشی اجتماع مجوزها را می‌گیرد", () => {
  const p = subjectPermissions(subj("u-over"));
  assert.ok(p.includes("fin.ipc.prepare"), "از cost_controller");
  assert.ok(p.includes("fin.ipc.approve"), "از project_manager");
});

/* ══════════ ۵. موتور تصمیم ══════════ */

test("evaluate: مسیر خوش‌بینانه اجازه می‌دهد", () => {
  const d = evaluate(subj("u-planner"), "plan.schedule.edit", { projectId: "c1-p1" });
  assert.equal(d.allow, true);
  assert.equal(d.code, "ALLOW");
});

test("evaluate: کد مجوز ناشناخته رد می‌شود", () => {
  assert.equal(evaluate(subj("u-admin"), "fake.perm.code").code, "DENY_UNKNOWN_PERMISSION");
});

test("evaluate: حساب غیرفعال همیشه رد می‌شود", () => {
  const d = evaluate(subj("u-left"), "plan.schedule.edit", { projectId: "c1-p1" });
  assert.equal(d.allow, false);
  assert.equal(d.code, "DENY_INACTIVE");
});

test("evaluate: منع صریح بر مجوز نقش غالب است", () => {
  const s = { ...subj("u-pm"), denies: ["fin.ipc.approve"] };
  assert.equal(evaluate(s, "fin.ipc.approve", { projectId: "c1-p1" }).code, "DENY_EXPLICIT");
});

test("evaluate: دامنه پروژه رعایت می‌شود", () => {
  const ok = evaluate(subj("u-pm"), "core.project.edit", { projectId: "c1-p1" });
  const no = evaluate(subj("u-pm"), "core.project.edit", { projectId: "c9-p9" });
  assert.equal(ok.allow, true);
  assert.equal(no.code, "DENY_PROJECT_SCOPE");
});

test("evaluate: ستاره یعنی همه پروژه‌ها", () => {
  assert.equal(evaluate(subj("u-planner"), "plan.schedule.edit", { projectId: "c7-p3" }).allow, true);
});

test("evaluate: دامنه دیسیپلین رعایت می‌شود", () => {
  const ok = evaluate(subj("u-qc"), "qms.inspection.record", { projectId: "c1-p1", discipline: "piping" });
  const no = evaluate(subj("u-qc"), "qms.inspection.record", { projectId: "c1-p1", discipline: "electrical" });
  assert.equal(ok.allow, true);
  assert.equal(no.code, "DENY_DISCIPLINE_SCOPE");
});

test("evaluate: نبود دیسیپلین در کاربر یعنی بدون محدودیت", () => {
  assert.equal(evaluate(subj("u-qa"), "qms.ncr.close", { projectId: "c1-p1", discipline: "electrical" }).allow, true);
});

test("evaluate: سطح دسترسی ناکافی رد می‌شود", () => {
  // سرپرست کارگاه سطح internal دارد؛ نرخ دستمزد restricted است.
  assert.equal(evaluate(subj("u-site"), "hrm.rate.view", { projectId: "c1-p1" }).code, "DENY_CLEARANCE");
});

test("evaluate: طبقه‌بندی صریح رکورد بر پیش‌فرض مجوز مقدم است", () => {
  const d = evaluate(subj("u-site"), "doc.document.view", { projectId: "c1-p1", classification: "restricted" });
  assert.equal(d.code, "DENY_CLEARANCE");
});

test("evaluate: نداشتن مجوز با کد مخصوص خودش رد می‌شود", () => {
  // ckm.lesson.publish سطح internal دارد، پس بررسی سطح دسترسی رد نمی‌شود و علت واقعی نبود مجوز است.
  assert.equal(evaluate(subj("u-site"), "ckm.lesson.publish", { projectId: "c1-p1" }).code, "DENY_NO_PERMISSION");
});

test("evaluate: ترتیب رد غالب — کمبود سطح دسترسی پیش از نبود مجوز اعلام می‌شود", () => {
  // سرپرست کارگاه نه مجوز تثبیت مبنا دارد نه سطح confidential؛ موتور علت شدیدتر را برمی‌گرداند.
  assert.equal(evaluate(subj("u-site"), "plan.baseline.set", { projectId: "c1-p1" }).code, "DENY_CLEARANCE");
});

test("evaluate: تصمیم روی مجوز حساس پرچم ممیزی می‌گیرد", () => {
  assert.equal(evaluate(subj("u-pm"), "ckm.letter.sign", { projectId: "c1-p1" }).audit, true);
  assert.equal(evaluate(subj("u-planner"), "core.project.view", { projectId: "c1-p1" }).audit, false);
});

test("can: میان‌بر بولی و کاربر تهی", () => {
  assert.equal(can(subj("u-client"), "fin.ipc.approve", { projectId: "c1-p1" }), true);
  assert.equal(can(null, "core.project.view"), false);
});

/* ══════════ ۶. تفکیک وظایف ══════════ */

test("SOD: بیست‌وهشت قاعده تعریف شده و شناسه‌ها یکتاست", () => {
  /* هفت پایه + سه مهندسی (SOD-08..10) + دو گردش صورت‌وضعیت پیمان
   * (SOD-11، SOD-12) + یک وثیقه (SOD-13) + یک پیمانکار جزء (SOD-14)
   * + یک پل مالی (SOD-15: تهیه‌کننده ≠ ثبت‌کننده در دفتر)
   * + سه کارکرد نیروی انسانی (SOD-16 ثبت≠امضای سرپرست،
   *   SOD-17 نهایی‌کننده≠ثبت‌کنندهٔ هزینه، SOD-18 نویسنده≠تأییدکنندهٔ
   *   سند اصلاحی)
   * + دو بهره‌وری (SOD-19 محاسبه‌کننده≠نهایی‌کنندهٔ متریک،
   *   SOD-20 ثبت‌کنندهٔ علت افت≠سازندهٔ ادعای قراردادی)
   * + سه نیروی پیمانکاری (SOD-21 ثبت‌کننده≠تأییدکنندهٔ حضور گروهی،
   *   SOD-22 تهیه‌کننده≠تأییدکنندهٔ صورت‌کارکرد، SOD-23 تنظیم‌کنندهٔ
   *   نرخ≠تأییدکنندهٔ سند مبتنی بر آن)
   * + سه پذیرش و انطباق (SOD-24 بارگذارنده≠تأییدکنندهٔ اصالت مدرک،
   *   SOD-25 درخواست‌دهنده≠تأییدکنندهٔ تجهیز، SOD-26 فعال‌کنندهٔ
   *   نفر≠ثبت‌کنندهٔ ساعت او)
   * + یک تحلیل نیرو (SOD-27 ثبت‌کنندهٔ مبنا≠صادرکنندهٔ گزارش رسمی
   *   انحراف از همان مبنا). */
  assert.equal(SOD_RULES.length, 28);
  assert.equal(new Set(SOD_RULES.map((r) => r.id)).size, 28);
  for (const id of ["SOD-01", "SOD-07", "SOD-08", "SOD-10", "SOD-11", "SOD-12", "SOD-13", "SOD-14", "SOD-15", "SOD-21", "SOD-22", "SOD-23", "SOD-24", "SOD-25", "SOD-26", "SOD-27", "SOD-28"]) {
    assert.ok(SOD_RULES.some((r) => r.id === id), `${id} نیست`);
  }
});

test("SOD: کاربر دو‌نقشی تخلف تهیه/تأیید صورت‌وضعیت را نشان می‌دهد", () => {
  /* سرپرست مالی کارگاه هم‌زمان کنترل هزینه و مدیر پروژه است، پس دو
     تمرکز خطرناک دارد: تهیه و تأیید صورت‌وضعیت (SOD-01)، و تهیهٔ
     صورت‌وضعیت پیمان به‌همراه نشاندن آن در دفتر مالی (SOD-15). */
  const v = sodViolations(subjectPermissions(subj("u-over")));
  assert.deepEqual(v.map((x) => x.id).sort(), ["SOD-01", "SOD-15"]);
  for (const x of v) assert.equal(x.severity, "critical");
});

test("SOD: مدیر سامانه عمداً مجوز مشاهده لاگ ندارد", () => {
  const p = effectivePermissions("admin");
  assert.ok(p.includes("sys.audit.purge"));
  assert.ok(!p.includes("sys.audit.view"));
});

test("sodInstanceConflict: تهیه‌کننده همان کاربر است", () => {
  assert.equal(sodInstanceConflict("u-pm", { preparedBy: "u-pm" }), true);
  assert.equal(sodInstanceConflict("u-pm", { preparedBy: "u-cost" }), false);
  assert.equal(sodInstanceConflict("u-pm", {}), false);
});

test("evaluate: مدیر پروژه نمی‌تواند صورت‌وضعیتی را که خودش تهیه کرده تأیید کند", () => {
  const d = evaluate(subj("u-pm"), "fin.ipc.approve", { projectId: "c1-p1", record: { preparedBy: "u-pm" } });
  assert.equal(d.allow, false);
  assert.equal(d.code, "DENY_SOD");
});

test("evaluate: همان مدیر پروژه صورت‌وضعیت دیگری را تأیید می‌کند", () => {
  const d = evaluate(subj("u-pm"), "fin.ipc.approve", { projectId: "c1-p1", record: { preparedBy: "u-cost" } });
  assert.equal(d.allow, true);
});

test("evaluate: تفکیک وظیفه سطح رکورد فقط روی اقدام تأییدی اعمال می‌شود", () => {
  const d = evaluate(subj("u-pm"), "rcc.change.raise", { projectId: "c1-p1", record: { preparedBy: "u-pm" } });
  assert.equal(d.allow, true);
});

test("isApprovalPermission: افعال تأییدی شناخته می‌شوند", () => {
  assert.equal(isApprovalPermission("fin.ipc.approve"), true);
  assert.equal(isApprovalPermission("ckm.letter.sign"), true);
  assert.equal(isApprovalPermission("qms.ncr.close"), true);
  assert.equal(isApprovalPermission("plan.schedule.edit"), false);
});

/* ══════════ ۷. تفویض اختیار ══════════ */

test("isDelegationActive: بازه شامل هر دو سر است", () => {
  const d = DEMO_DELEGATIONS[0];
  assert.equal(isDelegationActive(d, "2026-09-01"), true);
  assert.equal(isDelegationActive(d, "2026-09-20"), true);
  assert.equal(isDelegationActive(d, "2026-08-31"), false);
  assert.equal(isDelegationActive(d, "2026-09-21"), false);
});

test("isDelegationActive: تفویض باطل‌شده فعال نیست", () => {
  assert.equal(isDelegationActive({ ...DEMO_DELEGATIONS[0], revoked: true }, TODAY), false);
});

test("delegatedPermissions: فقط برای گیرنده و در بازه", () => {
  assert.deepEqual(delegatedPermissions(DEMO_DELEGATIONS, "u-planner", TODAY), ["plan.baseline.set", "plan.progress.approve"]);
  assert.deepEqual(delegatedPermissions(DEMO_DELEGATIONS, "u-planner", "2026-10-01"), []);
  assert.deepEqual(delegatedPermissions(DEMO_DELEGATIONS, "u-site", TODAY), []);
});

test("evaluate: مجوز تفویض‌شده اجازه می‌دهد و کد جداگانه دارد", () => {
  const d = evaluate(subj("u-planner"), "plan.baseline.set", { projectId: "c1-p1", delegations: DEMO_DELEGATIONS, onDate: TODAY });
  assert.equal(d.allow, true);
  assert.equal(d.code, "ALLOW_DELEGATED");
  assert.equal(d.audit, true, "تفویض همیشه باید ممیزی شود");
});

test("evaluate: پس از پایان بازه تفویض دسترسی برمی‌گردد به رد", () => {
  const d = evaluate(subj("u-planner"), "plan.baseline.set", { projectId: "c1-p1", delegations: DEMO_DELEGATIONS, onDate: "2026-11-01" });
  assert.equal(d.code, "DENY_NO_PERMISSION");
});

test("evaluate: تفویض نمی‌تواند سقف سطح دسترسی را دور بزند", () => {
  const dlg = [{ id: "x", fromUserId: "u-hr", toUserId: "u-site", permissions: ["hrm.rate.view"], from: "2026-09-01", to: "2026-09-30", reason: "مرخصی" }];
  const d = evaluate(subj("u-site"), "hrm.rate.view", { projectId: "c1-p1", delegations: dlg, onDate: TODAY });
  assert.equal(d.code, "DENY_CLEARANCE");
});

test("validateDelegation: تفویض معتبر هیچ ایرادی ندارد", () => {
  const granter = subjectPermissions(subj("u-pm"));
  assert.deepEqual(validateDelegation(DEMO_DELEGATIONS[0], granter), []);
});

test("validateDelegation: تفویض به خود رد می‌شود", () => {
  const bad = { ...DEMO_DELEGATIONS[0], toUserId: DEMO_DELEGATIONS[0].fromUserId };
  assert.ok(validateDelegation(bad, subjectPermissions(subj("u-pm"))).some((i) => i.code === "E-DLG-01"));
});

test("validateDelegation: تاریخ معکوس رد می‌شود", () => {
  const bad = { ...DEMO_DELEGATIONS[0], from: "2026-09-20", to: "2026-09-01" };
  assert.ok(validateDelegation(bad, subjectPermissions(subj("u-pm"))).some((i) => i.code === "E-DLG-02"));
});

test("validateDelegation: تفویض مجوزی که تفویض‌کننده ندارد ممنوع است", () => {
  const bad = { ...DEMO_DELEGATIONS[0], permissions: ["sys.config.manage"] };
  assert.ok(validateDelegation(bad, subjectPermissions(subj("u-pm"))).some((i) => i.code === "E-DLG-04"));
});

test("validateDelegation: کد مجوز ناشناخته و دلیل خالی گرفته می‌شوند", () => {
  const bad = { ...DEMO_DELEGATIONS[0], permissions: ["no.such.perm"], reason: "   " };
  const codes = validateDelegation(bad, subjectPermissions(subj("u-pm"))).map((i) => i.code);
  assert.ok(codes.includes("E-DLG-05"));
  assert.ok(codes.includes("E-DLG-06"));
});

test("validateDelegation: بیش از ۹۰ روز هشدار می‌گیرد", () => {
  const codes = validateDelegation(DEMO_DELEGATIONS[1], subjectPermissions(subj("u-pm"))).map((i) => i.code);
  assert.ok(codes.includes("W-DLG-07"));
});

/* ══════════ ۸. پوشاندن میدان حساس ══════════ */

test("maskRecord: نرخ دستمزد برای سرپرست کارگاه پوشانده می‌شود", () => {
  const row = { name: "علی", dailyRate: 4_200_000, nationalId: "0012345678" };
  const out = maskRecord(subj("u-site"), row, { projectId: "c1-p1" });
  assert.equal(out.name, "علی");
  assert.equal(out.dailyRate, "•••");
  assert.equal(out.nationalId, "••••••••••");
});

test("maskRecord: مدیر منابع انسانی مقدار واقعی را می‌بیند", () => {
  const row = { dailyRate: 4_200_000, nationalId: "0012345678" };
  const out = maskRecord(subj("u-hr"), row, { projectId: "c1-p1" });
  assert.equal(out.dailyRate, 4_200_000);
  assert.equal(out.nationalId, "0012345678");
});

test("maskRecord: رکورد ورودی دست‌نخورده می‌ماند", () => {
  const row = { dailyRate: 100 };
  maskRecord(subj("u-site"), row, { projectId: "c1-p1" });
  assert.equal(row.dailyRate, 100);
});

test("maskRecord: میدان‌های نامرتبط دست نمی‌خورند و کاربر تهی همه را می‌پوشاند", () => {
  assert.deepEqual(maskRecord(subj("u-site"), { foo: 1 }), { foo: 1 });
  assert.equal(maskRecord(null, { unitRate: 5 }).unitRate, "•••");
});

test("maskedFields: فهرست میدان‌های پوشانده‌شده را می‌دهد", () => {
  const f = maskedFields(subj("u-site"), { dailyRate: 1, unitRate: 2, name: "x" }, { projectId: "c1-p1" });
  assert.deepEqual(f.sort(), ["dailyRate", "unitRate"]);
  assert.ok(MASK_RULES.length >= 7);
});

/* ══════════ ۹. سیاست‌های امنیتی ══════════ */

test("checkPassword: گذرواژه قوی قبول می‌شود", () => {
  const r = checkPassword("Arena#2026Pmis!");
  assert.equal(r.ok, true);
  assert.ok(r.score >= 80);
});

test("checkPassword: گذرواژه کوتاه و ساده همه ایرادها را می‌گیرد", () => {
  const r = checkPassword("abc");
  assert.equal(r.ok, false);
  assert.ok(r.issues.length >= 4);
  assert.ok(r.score < 40);
});

test("checkPassword: نویسه تکراری مطلق مردود است", () => {
  assert.equal(checkPassword("aaaaaaaaaaaaaaaa").ok, false);
});

test("checkPassword: سیاست سفارشی رعایت می‌شود", () => {
  const loose = { ...DEFAULT_PASSWORD_POLICY, minLength: 4, requireUpper: false, requireDigit: false, requireSymbol: false };
  assert.equal(checkPassword("abcd", loose).ok, true);
});

test("sessionPolicyFor: سطح بالاتر نشست کوتاه‌تر و MFA اجباری دارد", () => {
  assert.deepEqual(sessionPolicyFor("restricted"), { idleMinutes: 15, absoluteHours: 8, mfaRequired: true });
  assert.equal(sessionPolicyFor("confidential").mfaRequired, true);
  assert.equal(sessionPolicyFor("internal").mfaRequired, false);
  assert.ok(sessionPolicyFor("internal").idleMinutes > sessionPolicyFor("restricted").idleMinutes);
});

test("loginThrottle: پیش از سقف، تلاش باقی‌مانده اعلام می‌شود", () => {
  const s = loginThrottle(2, 3);
  assert.equal(s.locked, false);
  assert.equal(s.remainingAttempts, DEFAULT_LOCKOUT.maxAttempts - 2);
});

test("loginThrottle: در سقف قفل می‌شود", () => {
  const s = loginThrottle(5, 3);
  assert.equal(s.locked, true);
  assert.equal(s.unlockAfterMinutes, DEFAULT_LOCKOUT.lockMinutes);
});

test("loginThrottle: پس از پایان پنجره شمارش صفر می‌شود", () => {
  const s = loginThrottle(9, 60);
  assert.equal(s.locked, false);
  assert.equal(s.remainingAttempts, DEFAULT_LOCKOUT.maxAttempts);
});

/* ══════════ ۱۰. وضعیت امنیتی ══════════ */

const goodPosture = {
  subjects: [subj("u-pm"), subj("u-cost")],
  delegations: [],
  onDate: TODAY,
  httpsEnforced: true,
  mfaEnabled: true,
  auditRetentionDays: 730,
  backupAgeDays: 1,
  sqlEncrypted: true,
};

test("scorePosture: پیکربندی سالم نمره کامل و درجه A می‌گیرد", () => {
  const p = scorePosture(goodPosture);
  assert.equal(p.score, 100);
  assert.equal(p.grade, "A");
  assert.deepEqual(p.findings, []);
});

test("scorePosture: نبود HTTPS و پشتیبان نمره را به شدت پایین می‌آورد", () => {
  const p = scorePosture({ ...goodPosture, httpsEnforced: false, backupAgeDays: null });
  assert.ok(p.score < 75);
  const codes = p.findings.map((f) => f.code);
  assert.ok(codes.includes("SEC-NET-01"));
  assert.ok(codes.includes("SEC-BKP-01"));
});

test("scorePosture: تخلف تفکیک وظیفه به‌عنوان یافته گزارش می‌شود", () => {
  const p = scorePosture({ ...goodPosture, subjects: [subj("u-over")] });
  assert.ok(p.findings.some((f) => f.code === "SEC-SOD-SOD-01" && f.severity === "critical"));
});

test("scorePosture: حساب غیرفعال با نقش باقی‌مانده یافته می‌سازد", () => {
  const p = scorePosture({ ...goodPosture, subjects: [subj("u-left")] });
  assert.ok(p.findings.some((f) => f.code === "SEC-USR-01"));
});

test("scorePosture: تفویض طولانی‌مدت یافته می‌سازد", () => {
  const p = scorePosture({ ...goodPosture, delegations: DEMO_DELEGATIONS });
  assert.ok(p.findings.some((f) => f.code === "SEC-DLG-01"));
});

test("scorePosture: دسترسی سراسری بیش از سه کاربر هشدار می‌دهد", () => {
  const wide = DEMO_SUBJECTS.filter((s) => s.active && s.projectIds.includes("*"));
  assert.ok(wide.length > 3);
  const p = scorePosture({ ...goodPosture, subjects: wide });
  assert.ok(p.findings.some((f) => f.code === "SEC-SCOPE-01"));
});

test("scorePosture: نمره هرگز منفی نمی‌شود و یافته‌ها بر حسب وزن مرتب‌اند", () => {
  const p = scorePosture({
    ...goodPosture,
    subjects: DEMO_SUBJECTS,
    delegations: DEMO_DELEGATIONS,
    httpsEnforced: false,
    mfaEnabled: false,
    sqlEncrypted: false,
    auditRetentionDays: 30,
    backupAgeDays: null,
  });
  assert.ok(p.score >= 0 && p.score < 30, `نمره خارج از بازه: ${p.score}`);
  assert.equal(p.grade, "E");
  for (let i = 1; i < p.findings.length; i++) {
    assert.ok(p.findings[i - 1].weight >= p.findings[i].weight);
  }
});

test("scorePosture: نگهداشت کوتاه لاگ و پشتیبان بیات یافته متوسط می‌دهند", () => {
  const p = scorePosture({ ...goodPosture, auditRetentionDays: 90, backupAgeDays: 30 });
  const codes = p.findings.map((f) => f.code);
  assert.ok(codes.includes("SEC-AUD-01"));
  assert.ok(codes.includes("SEC-BKP-02"));
  assert.equal(p.grade, "B");
});

/* ══════════ ۱۱. ممیزی ══════════ */

test("auditSeverity: رد به دلیل تفکیک وظیفه بحرانی است", () => {
  assert.equal(auditSeverity("fin.ipc.approve", "DENY_SOD"), "critical");
  assert.equal(auditSeverity("fin.ipc.approve", "DENY_EXPLICIT"), "critical");
});

test("auditSeverity: سایر ردها هشدار و مجوز سری امنیتی است", () => {
  assert.equal(auditSeverity("core.project.view", "DENY_PROJECT_SCOPE"), "warning");
  assert.equal(auditSeverity("ckm.letter.sign", "ALLOW"), "security");
  assert.equal(auditSeverity("core.project.view", "ALLOW"), "info");
});

test("buildAuditRecord: رکورد کامل با شناسه کاربر و تصمیم می‌سازد", () => {
  const d = evaluate(subj("u-pm"), "ckm.letter.sign", { projectId: "c1-p1" });
  const rec = buildAuditRecord(subj("u-pm"), "ckm.letter.sign", d, "2026-09-08T10:00:00Z", "c1-p1");
  assert.equal(rec.subjectId, "u-pm");
  assert.equal(rec.decision, "ALLOW");
  assert.equal(rec.severity, "security");
  assert.equal(rec.projectId, "c1-p1");
});

test("buildAuditRecord: بدون پروژه مقدار تهی می‌گذارد", () => {
  const d = evaluate(subj("u-admin"), "sys.backup.export");
  assert.equal(buildAuditRecord(subj("u-admin"), "sys.backup.export", d, "2026-09-08T10:00:00Z").projectId, null);
});

/* ══════════ ۱۲. سناریوهای واقعی ══════════ */

test("سناریو: پیمانکار جزء به هزینه و نرخ دسترسی ندارد", () => {
  assert.equal(can(subj("u-sub"), "fin.cost.view", { projectId: "c1-p1" }), false);
  assert.equal(can(subj("u-sub"), "fin.rate.view", { projectId: "c1-p1" }), false);
  assert.equal(can(subj("u-sub"), "plan.progress.report", { projectId: "c1-p1", discipline: "civil" }), true);
});

test("سناریو: کارفرما گزارش ابلاغی منتشر نمی‌کند ولی صورت‌وضعیت تأیید می‌کند", () => {
  assert.equal(can(subj("u-client"), "report.official.publish", { projectId: "c1-p1" }), false);
  assert.equal(can(subj("u-client"), "fin.ipc.approve", { projectId: "c1-p1" }), true);
});

test("سناریو: مشاور فقط در پروژه‌های ابلاغی خودش تأیید می‌کند", () => {
  assert.equal(can(subj("u-consultant"), "plan.progress.approve", { projectId: "c1-p1" }), true);
  assert.equal(can(subj("u-consultant"), "plan.progress.approve", { projectId: "c1-p2" }), false);
});

test("سناریو: ممیز داخلی لاگ می‌بیند ولی پیکربندی را دست نمی‌زند", () => {
  assert.equal(can(subj("u-auditor"), "sys.audit.view"), true);
  assert.equal(can(subj("u-auditor"), "sys.config.manage"), false);
  assert.equal(can(subj("u-auditor"), "sys.audit.purge"), false);
});

test("سناریو: انتشار گزارش ابلاغی فقط برای مدیر پروژه و PMO باز است", () => {
  const allowed = ROLE_CATALOG.filter((r) => effectivePermissions(r.code).includes("report.official.publish")).map((r) => r.code);
  assert.deepEqual(allowed.sort(), ["pmo", "project_manager"]);
});
