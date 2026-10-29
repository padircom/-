/**
 * ردیف‌های سایدبار برای شش تب تأمین/لجستیک d5. باندل: npm run build:csnav
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  D5_SCM_NAV,
  D5_SCM_TAB_BY_SUB,
  D5_SECTION_ANCHORS,
  D5_SECTION_BY_SUB,
  SCM_TAB_IDS,
  costSupplyNavReport,
  d5ScmProcesses,
  d5SectionForSub,
  d5TabForSub,
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

test("هر زیرماژول d5 (رسمی، افزوده، تأمین/لجستیک) تب و بخش مقصد دارد", () => {
  const { noTab, noSection, orphanSections } = costSupplyNavReport();
  assert.deepEqual(noTab, [], `بی‌تب: ${noTab.join(", ")}`);
  assert.deepEqual(noSection, [], `بی‌بخش: ${noSection.join(", ")}`);
  assert.deepEqual(orphanSections, [], `یتیم: ${orphanSections.join(", ")}`);
});

test("زیرماژول‌های هم‌تب هر کدام به بخش خودشان می‌روند", () => {
  assert.equal(d5TabForSub("d5-p1-cbs"), d5TabForSub("d5-p1-res"));
  assert.notEqual(d5SectionForSub("d5-p1-cbs"), d5SectionForSub("d5-p1-res"));
  assert.equal(d5SectionForSub("d5-p2-evm"), "eac");
  assert.equal(d5SectionForSub("d5-p2-snap"), "snapshots");
  assert.equal(d5SectionForSub("d5-p2-s1"), "actuals");
  assert.equal(d5SectionForSub("d5-p3-age"), "ar-aging");
  assert.equal(d5SectionForSub("d5-p4-mrp"), "reorder");
  assert.equal(d5SectionForSub("d5-p5-3wm"), "match3");
  assert.equal(d5SectionForSub("d5-p6-trc"), "warehouse-flow");
});

test("زیرماژول بی‌بخش به ابتدای تب می‌رود و ناشناخته undefined است", () => {
  assert.equal(d5SectionForSub("d5-p1-s1"), "top");
  assert.equal(d5SectionForSub("d5-p7-s2"), "top");
  assert.equal(d5SectionForSub("d5-p10-s1"), "top");
  assert.equal(d5SectionForSub("nope"), undefined);
  assert.equal(d5SectionForSub(undefined), undefined);
  assert.equal(d5TabForSub("nope"), undefined);
  assert.ok(Object.keys(D5_SECTION_BY_SUB).length >= 18);
});

test("هر بخش مقصد در CostSupplyWorkspace.tsx یک <Section anchor> دارد", () => {
  const src = readFileSync(new URL("../src/components/CostSupplyWorkspace.tsx", import.meta.url), "utf8");
  const inSource = [...src.matchAll(/<Section anchor="d5s-([a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(inSource).size, inSource.length, "anchor تکراری");
  for (const a of D5_SECTION_ANCHORS) {
    assert.ok(inSource.includes(a), `anchor «${a}» در کامپوننت نیست`);
  }
});
