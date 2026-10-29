/**
 * ردیف‌های سایدبار برای شش تب تأمین/لجستیک d5. باندل: npm run build:csnav
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  D5_SCM_NAV,
  D5_SCM_TAB_BY_SUB,
  SCM_TAB_IDS,
  costSupplyNavReport,
  d5ScmProcesses,
} from "./csNavLogic.js";

test("هر شش تب scm-* دقیقاً یک ردیف سایدبار دارند", () => {
  const { uncoveredScmTabs } = costSupplyNavReport();
  assert.deepEqual(uncoveredScmTabs, []);
  assert.equal(D5_SCM_NAV.length, SCM_TAB_IDS.length);
  assert.deepEqual([...D5_SCM_NAV.map((e) => e.tab)].sort(), [...SCM_TAB_IDS].sort());
});

test("شناسه‌ها یکتا هستند و با فرایندهای رسمی d5 برخورد ندارند", () => {
  const { duplicateIds, collisions } = costSupplyNavReport();
  assert.deepEqual(duplicateIds, []);
  assert.deepEqual(collisions, []);
});

test("نگاشت زیرماژول به تب کامل است", () => {
  for (const e of D5_SCM_NAV) assert.equal(D5_SCM_TAB_BY_SUB[e.subId], e.tab, e.subId);
});

test("بخش‌ها: تأمین ← فروشندگان/بسته‌ها/مناقصه، لجستیک ← رسید/انبار/تغییرات MR", () => {
  assert.deepEqual(
    d5ScmProcesses("procurement").map((p) => p.id),
    ["d5-p10", "d5-p11", "d5-p12"],
  );
  assert.deepEqual(
    d5ScmProcesses("logistics").map((p) => p.id),
    ["d5-p13", "d5-p15", "d5-p14"],
  );
  assert.deepEqual(d5ScmProcesses("cost"), []);
  for (const p of [...d5ScmProcesses("procurement"), ...d5ScmProcesses("logistics")]) {
    assert.equal(p.subs.length, 1);
    assert.ok(p.title.fa && p.title.en && p.subs[0].title.fa && p.subs[0].title.en);
  }
});
