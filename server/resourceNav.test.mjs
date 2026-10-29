/**
 * نگاشت زیرماژول‌های حوزهٔ «منابع» (ماشین‌آلات d9، منابع انسانی d10).
 * باندل: npm run build:resnav
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  D10_TARGET_BY_SUB,
  D9_TAB_BY_SUB,
  D9_NOT_IMPLEMENTED_SUBS,
  isTcoSub,
  eqmTabForSub,
  isNotImplementedSub,
  hrmTargetForSub,
  resourceNavReport,
} from "./resNavLogic.js";

test("هر زیرماژول d9 و d10 در framework نگاشت دارد و نگاشت یتیم ندارد", () => {
  const { unmapped, orphaned } = resourceNavReport();
  assert.deepEqual(unmapped, [], `بی‌نگاشت: ${unmapped.join(", ")}`);
  assert.deepEqual(orphaned, [], `یتیم: ${orphaned.join(", ")}`);
});

test("d10: هیچ دو زیرماژول منابع انسانی به یک {تب، نما} نمی‌رسند", () => {
  const { hrmDuplicates } = resourceNavReport();
  assert.deepEqual(hrmDuplicates, [], `مقصد تکراری: ${hrmDuplicates.join(", ")}`);
});

test("d10: سه زیرماژول p1 سه نمای جدا از تب برنامه‌ریزی را باز می‌کنند", () => {
  assert.deepEqual(hrmTargetForSub("d10-p1-s1"), { tab: "planning", view: "obs" });
  assert.deepEqual(hrmTargetForSub("d10-p1-s2"), { tab: "planning", view: "plan" });
  assert.deepEqual(hrmTargetForSub("d10-p1-s3"), { tab: "planning", view: "mob" });
});

test("d10: زیرماژول‌های دیگر تب خودشان را با نمای پیش‌فرض باز می‌کنند", () => {
  const expected = {
    "d10-p2-s1": "timesheet",
    "d10-p3-s1": "productivity",
    "d10-p4-s1": "crew",
    "d10-p5-s1": "onboarding",
    "d10-p6-s1": "analytics",
  };
  for (const [sub, tab] of Object.entries(expected)) {
    assert.deepEqual(hrmTargetForSub(sub), { tab, view: "obs" }, sub);
  }
  assert.equal(Object.keys(D10_TARGET_BY_SUB).length, 8);
});

test("d10: شناسهٔ خالی یا ناشناخته به برنامه‌ریزی / چارت سازمانی برمی‌گردد", () => {
  assert.deepEqual(hrmTargetForSub(undefined), { tab: "planning", view: "obs" });
  assert.deepEqual(hrmTargetForSub("nope"), { tab: "planning", view: "obs" });
});

test("d9: تب هر زیرماژول ماشین‌آلات و پیش‌فرض ناوگان", () => {
  assert.equal(eqmTabForSub("d9-p6-s1"), "dispatch");
  assert.equal(eqmTabForSub("d9-p7-s1"), "fuel");
  assert.equal(eqmTabForSub("d9-p8-s1"), "parts");
  /* TCO و خرید در برابر اجاره در تب «بهره‌وری» است، نه «اجاره». */
  assert.equal(eqmTabForSub("d9-p5-s3"), "productivity");
  assert.equal(eqmTabForSub("d9-p3-s1"), "rental");
  assert.equal(eqmTabForSub(undefined), "fleet");
  assert.equal(eqmTabForSub("nope"), "fleet");
  assert.equal(Object.keys(D9_TAB_BY_SUB).length, 13);
});

test("d9: فهرست «پیاده‌سازی نشده» فقط شناسه‌های واقعی با نگاشت تب را دارد", () => {
  const { badNotImplemented } = resourceNavReport();
  assert.deepEqual(badNotImplemented, [], `نامعتبر: ${badNotImplemented.join(", ")}`);
  assert.deepEqual(
    [...D9_NOT_IMPLEMENTED_SUBS].sort(),
    ["d9-p1-s2", "d9-p4-s3", "d9-p5-s2"],
  );
  /* TCO ساخته شده؛ دیگر «پیاده‌سازی نشده» نیست و ماشین‌حساب خودش را دارد. */
  assert.equal(isNotImplementedSub("d9-p5-s3"), false);
  assert.equal(isTcoSub("d9-p5-s3"), true);
  assert.equal(isTcoSub("d9-p5-s2"), false);
  assert.equal(isTcoSub(undefined), false);
  assert.equal(isNotImplementedSub("d9-p1-s1"), false);
  assert.equal(isNotImplementedSub(undefined), false);
});

test("d9-p5-s3: ModuleDetail نمای TCO را می‌فرستد و MachineryWorkspace آن را در تب بهره‌وری رندر می‌کند", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (f) => readFileSync(new URL(`../src/components/${f}.tsx`, import.meta.url), "utf8");
  assert.match(read("ModuleDetail"), /showTco=\{isTcoSub\(d9SubKey\)\}/);
  const mw = read("MachineryWorkspace");
  assert.match(mw, /tab==='productivity'&&showTco\?<EquipmentTcoPanel/);
  /* ماشین‌حساب باید همان توابعِ سرور را به کار ببرد، نه فرمول جداگانه. */
  const panel = read("EquipmentTcoPanel");
  assert.match(panel, /import \{[^}]*buyVsRent[^}]*tco[^}]*\} from "..\/services\/equipment"/);
});
