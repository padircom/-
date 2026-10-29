/**
 * ردیف‌های سایدبار برای شش تب تأمین/لجستیک d5. باندل: npm run build:csnav
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  D5_DETAIL_VIEW_SUBS,
  D5_SCM_VIEW_PERMISSION,
  d5ScmSubLocked,
  D5_SCM_NAV,
  D5_SCM_TAB_BY_SUB,
  D5_SECTION_ANCHORS,
  D5_SECTION_BY_SUB,
  SCM_TAB_IDS,
  costSupplyNavReport,
  d5ScmProcesses,
  d5SectionForSub,
  d5TabForSub,
  d5ViewForSub,
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

test("p7-s2، p8-s2 و p9-s2 نمای جدا دارند و s1ها نمای اصلی", () => {
  assert.deepEqual([...D5_DETAIL_VIEW_SUBS].sort(), ["d5-p7-s2", "d5-p8-s2", "d5-p9-s2"]);
  for (const p of ["p7", "p8", "p9"]) {
    assert.equal(d5ViewForSub(`d5-${p}-s1`), "main");
    assert.equal(d5ViewForSub(`d5-${p}-s2`), "detail");
    // هر دو زیرماژول روی یک تبِ مستقل می‌مانند؛ فقط نمایشان فرق می‌کند.
    assert.equal(d5TabForSub(`d5-${p}-s1`), d5TabForSub(`d5-${p}-s2`));
  }
  assert.equal(d5ViewForSub(undefined), "main");
  assert.equal(d5ViewForSub("d5-p1-cbs"), "main");
});

test("پنل‌های p7 تا p9 هر دو نما را پشتیبانی می‌کنند و ModuleDetail نما را می‌فرستد", () => {
  const panels = ["QuantityBalancePanel", "ProfitLossPanel"].map((f) =>
    readFileSync(new URL(`../src/components/${f}.tsx`, import.meta.url), "utf8"));
  for (const src of panels) assert.match(src, /view === "detail"/);
  const md = readFileSync(new URL("../src/components/ModuleDetail.tsx", import.meta.url), "utf8");
  assert.match(md, /panelView=\{d5ViewForSub\(/);
});

test("ردیف‌های SCM بدون مجوز scm.package.view کم‌رنگ می‌شوند؛ بقیهٔ ردیف‌ها هرگز", () => {
  const none = () => false;
  const all = () => true;
  for (const e of D5_SCM_NAV) {
    assert.equal(d5ScmSubLocked(e.subId, none), true, e.subId);
    assert.equal(d5ScmSubLocked(e.subId, all), false, e.subId);
  }
  /* فقط همان یک مجوز پرسیده می‌شود. */
  const asked = [];
  d5ScmSubLocked("d5-p10-s1", (p) => { asked.push(p); return true; });
  assert.deepEqual(asked, [D5_SCM_VIEW_PERMISSION]);
  /* ردیف‌های رسمی و افزودهٔ d5 و ورودی نامعتبر قفل نمی‌شوند. */
  for (const id of ["d5-p1-s1", "d5-p1-cbs", "d5-p7-s2", "d5-p9-s2", undefined, "nope"]) {
    assert.equal(d5ScmSubLocked(id, none), false, String(id));
  }
  /* مجوز واقعاً در کاتالوگ دسترسی تعریف شده است. */
  const ac = readFileSync(new URL("../src/services/accessControl.ts", import.meta.url), "utf8");
  assert.ok(ac.includes(`P("${D5_SCM_VIEW_PERMISSION}"`));
});
