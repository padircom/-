import test from "node:test";
import assert from "node:assert/strict";
import {
  validateChangeSetting, effectiveChangeTypes, effectiveReviewDueDays,
  addDaysIso, validateChangeInput, CHANGE_TYPES, CHANGE_SETTING_KEYS, CHANGE_SETTING_FA,
} from "./changeMgmtLogic.js";

test("فاز ۷: validateChangeSetting — workflow_defaults", () => {
  assert.deepEqual(validateChangeSetting("workflow_defaults", { reviewDueDays: 14 }), { ok: true, normalized: { reviewDueDays: 14 } });
  assert.equal(validateChangeSetting("workflow_defaults", { reviewDueDays: 0 }).ok, false);
  assert.equal(validateChangeSetting("workflow_defaults", { reviewDueDays: 366 }).ok, false);
  assert.equal(validateChangeSetting("workflow_defaults", { reviewDueDays: 1.5 }).ok, false);
  assert.equal(validateChangeSetting("workflow_defaults", "x").ok, false);
  assert.equal(validateChangeSetting("workflow_defaults", {}).ok, false);
});

test("فاز ۷: validateChangeSetting — change_types_extra", () => {
  const ok = validateChangeSetting("change_types_extra", [{ code: "site_access", fa: " دسترسی به کارگاه " }]);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.normalized, [{ code: "site_access", fa: "دسترسی به کارگاه" }]); /* trim شد */
  assert.equal(validateChangeSetting("change_types_extra", { not: "array" }).ok, false);
  assert.equal(validateChangeSetting("change_types_extra", [{ code: "design", fa: "تداخل با پایه" }]).ok, false);
  assert.equal(validateChangeSetting("change_types_extra", [{ code: "Bad", fa: "حروف بزرگ" }]).ok, false);
  assert.equal(validateChangeSetting("change_types_extra", [{ code: "x", fa: "کوتاه" }]).ok, false);
  assert.equal(validateChangeSetting("change_types_extra", [{ code: "dup1", fa: "یک" }, { code: "dup1", fa: "دو" }]).ok, false);
  assert.equal(validateChangeSetting("change_types_extra", [{ code: "ok1", fa: "ab" }]).ok, false);
});

test("فاز ۷: کلید ناشناخته رد می‌شود + فهرست مجاز اشتباه‌تداخل دار", () => {
  const bad = validateChangeSetting("evil_key", {});
  assert.equal(bad.ok, false);
  assert.match(bad.error, /change_types_extra/);
  assert.deepEqual(CHANGE_SETTING_KEYS, ["change_types_extra", "workflow_defaults"]);
  assert.equal(CHANGE_SETTING_FA.change_types_extra.includes("سفارشی"), true);
});

test("فاز ۷: effectiveChangeTypes — ادغام واقعی + کنار گذاشتن مقادیر معیوب", () => {
  const m = effectiveChangeTypes([{ code: "site_access", fa: "دسترسی به کارگاه" }, { code: "design", fa: "معیوب — تداخل" }, "x"]);
  assert.equal(m.length, CHANGE_TYPES.length + 1);
  assert.equal(m.some((t) => t.code === "site_access"), true);
  assert.equal(m.filter((t) => t.code === "design").length, 1); /* فقط نوع پایه */
  assert.deepEqual(effectiveChangeTypes(null).length, CHANGE_TYPES.length);
});

test("فاز ۷: effectiveReviewDueDays — مرزها", () => {
  assert.equal(effectiveReviewDueDays({ reviewDueDays: 365 }), 365);
  assert.equal(effectiveReviewDueDays({ reviewDueDays: 1 }), 1);
  assert.equal(effectiveReviewDueDays({ reviewDueDays: 0 }), null);
  assert.equal(effectiveReviewDueDays(null), null);
  assert.equal(effectiveReviewDueDays({ reviewDueDays: "10" }), null);
});

test("فاز ۷: addDaysIso — تاریخ واقعی + UTC-safe", () => {
  assert.equal(addDaysIso("2026-10-19", 10), "2026-10-29");
  assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysIso("19/10/2026", 5), null);
  assert.equal(addDaysIso("2026-10-19", 1.5), null);
});

test("فاز ۷: validateChangeInput با انواع سفارشی (signature backward-compatible)", () => {
  assert.equal(validateChangeInput({ TitleFa: "عنوان واقعی", ChangeType: "site_access" }).ok, false);
  assert.equal(validateChangeInput({ TitleFa: "عنوان واقعی", ChangeType: "site_access" }, [{ code: "site_access", fa: "دسترسی به کارگاه" }]).ok, true);
  assert.equal(validateChangeInput({ TitleFa: "عنوان واقعی", ChangeType: "design" }).ok, true);
});
