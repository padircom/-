/* آزمون کنترل دسترسی ماژول مهندسی.
 *
 * اقدام‌های نوشتاری این ماژول اثر قراردادی دارند: آزادسازی ساخت، ادعای EOT
 * علیه کارفرما و تبدیل درخواست کالا به خرید. پس تمرکز آزمون بر «چه کسی
 * نباید بتواند» است، و هر قاعدهٔ تفکیک وظیفه با یک جفت نقش واقعی سنجیده
 * می‌شود نه فقط با فهرست مجوزها. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_SUBJECTS,
  PERMISSION_CATALOG,
  ROLE_CATALOG,
  SOD_RULES,
  evaluate,
  permissionDef,
  roleDef,
  sodViolations,
  subjectClearance,
  subjectPermissions,
} from "./rbacLogic.js";

const ENG_PERMS = PERMISSION_CATALOG.filter((p) => p.module === "d12");
const subj = (id) => DEMO_SUBJECTS.find((u) => u.id === id);
const permsOf = (roleCode) => [...subjectPermissions({ roles: [roleCode], active: true, projectIds: ["*"] })];
const allows = (userId, perm) => evaluate(subj(userId), perm, {}).allow === true;

/* ══════ کاتالوگ ══════ */

test("ماژول d12 دوازده مجوز دارد", () => {
  assert.equal(ENG_PERMS.length, 12);
});

test("هر مجوز ENG عنوان دوزبانه و طبقه‌بندی دارد", () => {
  for (const p of ENG_PERMS) {
    assert.ok(p.title.fa && p.title.en, `${p.code} عنوان دوزبانه ندارد`);
    assert.ok(["internal", "confidential", "restricted"].includes(p.touches), `${p.code} طبقه‌بندی نامعتبر`);
  }
});

test("کد مجوزها یکتا و با پیشوند eng هستند", () => {
  const codes = ENG_PERMS.map((p) => p.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const c of codes) assert.match(c, /^eng\./);
});

test("اقدام‌های اثرگذار ممیزی می‌شوند", () => {
  for (const c of ["eng.ifc.release", "eng.mr.approve", "eng.review.code", "eng.revision.issue", "eng.crs.resolve"]) {
    assert.equal(permissionDef(c).audited, true, `${c} باید ممیزی شود`);
  }
});

test("آزادسازی ساخت و تأیید خرید در بالاترین طبقه‌بندی‌اند", () => {
  assert.equal(permissionDef("eng.ifc.release").touches, "restricted");
  assert.equal(permissionDef("eng.mr.approve").touches, "restricted");
});

test("مشاهدهٔ فهرست مدارک طبقه‌بندی داخلی دارد", () => {
  assert.equal(permissionDef("eng.mdr.view").touches, "internal", "دیدن فهرست نباید محرمانه باشد");
});

/* ══════ تفکیک وظیفه ══════ */

test("سه قاعدهٔ SOD مهندسی تعریف شده‌اند", () => {
  for (const id of ["SOD-08", "SOD-09", "SOD-10"]) {
    assert.ok(SOD_RULES.some((r) => r.id === id), `${id} نیست`);
  }
  /* شمارش کل قواعد کار این فایل نیست؛ آن ادعا در rbac.test.mjs است
   * و اینجا فقط با افزودن قاعده در ماژول دیگر می‌شکست. */
  assert.equal(new Set(SOD_RULES.map((r) => r.id)).size, SOD_RULES.length, "شناسهٔ SOD تکراری");
});

test("SOD-08: صادرکنندهٔ مدرک کد بررسی نمی‌زند", () => {
  const v = sodViolations(["eng.revision.issue", "eng.review.code"]);
  assert.equal(v.length, 1);
  assert.equal(v[0].id, "SOD-08");
  assert.equal(v[0].severity, "critical");
});

test("SOD-09: ثبت‌کنندهٔ نظر آن را نمی‌بندد", () => {
  assert.equal(sodViolations(["eng.crs.comment", "eng.crs.resolve"])[0].id, "SOD-09");
});

test("SOD-10: صادرکنندهٔ درخواست کالا خرید را تأیید نمی‌کند", () => {
  const v = sodViolations(["eng.mr.raise", "eng.mr.approve"]);
  assert.equal(v[0].id, "SOD-10");
  assert.equal(v[0].severity, "critical");
});

test("هیچ نقشی در کاتالوگ تخلف SOD ندارد", () => {
  for (const r of ROLE_CATALOG) {
    const v = sodViolations(permsOf(r.code));
    assert.equal(v.length, 0, `${r.code} تخلف دارد: ${v.map((x) => x.id).join(", ")}`);
  }
});

test("قواعد SOD پیشین دست‌نخورده مانده‌اند", () => {
  for (const id of ["SOD-01", "SOD-02", "SOD-03", "SOD-04", "SOD-05", "SOD-06", "SOD-07"]) {
    assert.ok(SOD_RULES.some((r) => r.id === id), `${id} حذف شده`);
  }
});

/* ══════ نقش‌های تازه ══════ */

test("دو نقش مهندسی تعریف شده‌اند", () => {
  assert.ok(roleDef("engineering_manager"), "مدیر مهندسی نیست");
  assert.ok(roleDef("design_lead"), "سرپرست طراحی نیست");
});

test("مدیر مهندسی از کنترل مدارک ارث نمی‌برد — SOD-08", () => {
  const r = roleDef("engineering_manager");
  assert.ok(!r.inherits.includes("doc_controller"));
  assert.ok(!permsOf("engineering_manager").includes("eng.revision.issue"), "نباید ریویژن صادر کند");
  assert.ok(permsOf("engineering_manager").includes("eng.review.code"), "باید کد بررسی بزند");
});

test("سرپرست طراحی صادر می‌کند ولی تأیید نمی‌کند", () => {
  const p = permsOf("design_lead");
  assert.ok(p.includes("eng.revision.issue"));
  assert.ok(p.includes("eng.mr.raise"));
  assert.ok(!p.includes("eng.review.code"), "نباید کد بررسی بزند");
  assert.ok(!p.includes("eng.mr.approve"), "نباید خرید را تأیید کند");
});

test("سرپرست طراحی سطح محرمانه دارد وگرنه نقش بی‌اثر است", () => {
  assert.equal(roleDef("design_lead").clearance, "confidential");
  assert.ok(allows("u-design", "eng.mr.raise"), "با سطح ناکافی نقش کار نمی‌کند");
});

test("دو کاربر نمونهٔ مهندسی وجود دارند", () => {
  assert.ok(subj("u-engmgr"), "u-engmgr نیست");
  assert.ok(subj("u-design"), "u-design نیست");
  assert.equal(subjectClearance(subj("u-engmgr")), "confidential");
});

/* ══════ اعطای مجوز به نقش‌های موجود ══════ */

test("بیننده فقط فهرست مدارک را می‌بیند", () => {
  const p = permsOf("viewer");
  assert.ok(p.includes("eng.mdr.view"));
  assert.equal(p.filter((x) => x.startsWith("eng.")).length, 1, "بیننده نباید مجوز نوشتن بگیرد");
});

test("مشاور و کارفرما کد بررسی می‌دهند", () => {
  for (const r of ["consultant", "client"]) {
    assert.ok(permsOf(r).includes("eng.review.code"), `${r} باید کد بررسی بدهد`);
  }
});

test("مشاور نظر را می‌بندد ولی ثبت نمی‌کند — SOD-09", () => {
  const p = permsOf("consultant");
  assert.ok(p.includes("eng.crs.resolve"));
  assert.ok(!p.includes("eng.crs.comment"));
});

test("مهندس کارگاه استعلام می‌دهد ولی پاسخ نمی‌دهد", () => {
  const p = permsOf("site_engineer");
  assert.ok(p.includes("eng.tq.raise"));
  assert.ok(!p.includes("eng.tq.answer"), "طرح‌کننده نباید پاسخ‌دهنده باشد");
});

test("کنترل مدارک ثبت می‌کند ولی کد بررسی نمی‌زند", () => {
  const p = permsOf("doc_controller");
  assert.ok(p.includes("eng.revision.issue"));
  assert.ok(!p.includes("eng.review.code"));
});

test("مدیر پروژه آزادسازی و تأیید می‌کند ولی درخواست نمی‌سازد", () => {
  const p = permsOf("project_manager");
  assert.ok(p.includes("eng.ifc.release"));
  assert.ok(p.includes("eng.mr.approve"));
  assert.ok(!p.includes("eng.mr.raise"), "اقتدار مدیر تأیید است نه ثبت");
});

/* ══════ ارزیابی زنده ══════ */

test("بازرس کیفیت هیچ اقدام مهندسی نمی‌تواند", () => {
  for (const c of ["eng.ifc.release", "eng.mr.approve", "eng.review.code", "eng.revision.issue"]) {
    assert.equal(allows("u-qc", c), false, `u-qc نباید ${c} داشته باشد`);
  }
});

test("مدیر پروژه آزادسازی ساخت را می‌تواند", () => {
  assert.ok(allows("u-pm", "eng.ifc.release"));
  assert.ok(allows("u-pm", "eng.mr.approve"));
});

test("مدیر سامانه مجوز کسب‌وکاری مهندسی ندارد", () => {
  /* admin نقش سامانه‌ای است؛ همان‌طور که صورت‌وضعیت را تأیید نمی‌کند،
   * ساخت را هم آزاد نمی‌کند. تجمیع اقتدار فنی در نقش فنی خطر است. */
  assert.equal(allows("u-admin", "eng.ifc.release"), false);
});

test("کاربر غیرفعال هیچ مجوزی ندارد", () => {
  const dead = { ...subj("u-engmgr"), active: false };
  assert.equal(evaluate(dead, "eng.review.code", {}).allow, false);
});

test("مجوز ناشناخته رد می‌شود نه اجازه", () => {
  const v = evaluate(subj("u-engmgr"), "eng.nonexistent", {});
  assert.equal(v.allow, false);
  assert.equal(v.code, "DENY_UNKNOWN_PERMISSION");
});

test("حکم موتور میدان allow دارد نه allowed", () => {
  /* رگرسیون: خواندن نام غلط همه را بی‌صدا رد می‌کرد و مدیر پروژه هم بسته
   * می‌شد — رفتار ایمن ولی نادرست. */
  const v = evaluate(subj("u-pm"), "eng.ifc.release", {});
  assert.equal(typeof v.allow, "boolean");
  assert.equal(v.allowed, undefined, "میدان allowed وجود ندارد");
});

test("رد دسترسی کد دلیل ماشین‌خوان دارد", () => {
  const v = evaluate(subj("u-qc"), "eng.mr.approve", {});
  assert.ok(String(v.code).startsWith("DENY_"));
  assert.ok(v.reason.fa, "پیام فارسی لازم است");
});

/* ══════ رگرسیون ══════ */

test("کاتالوگ مجوز رشد کرده و چیزی حذف نشده", () => {
  assert.ok(PERMISSION_CATALOG.length >= 71);
  for (const c of ["fin.ipc.approve", "qms.ncr.close", "rcc.claim.submit", "sys.user.manage"]) {
    assert.ok(permissionDef(c), `${c} حذف شده`);
  }
});

test("نقش‌های پیشین دست‌نخورده‌اند", () => {
  for (const r of ["viewer", "project_manager", "consultant", "client", "doc_controller", "qa_manager"]) {
    assert.ok(roleDef(r), `${r} حذف شده`);
  }
});
