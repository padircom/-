/**
 * ناوبری و شاخص‌های ماژول عملکرد پروژه (d3). باندل: npm run build:perfnav
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  D3_ALIAS_SUBS,
  D3_PAGE_SUBS,
  D3_SCOPE_NOTES,
  D3_TAB_BY_SUB,
  d3ScopeNote,
  d3TabForSub,
  performanceNavReport,
} from "./perfNavLogic.js";
import { earnedProgress, indexTone, varianceRows, varianceTone } from "./perfKpiLogic.js";

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");

test("هر زیرماژول دیدنی تب دارد، یتیمی نیست و مستعارها درست‌اند", () => {
  const r = performanceNavReport();
  assert.deepEqual(r.noTab, []);
  assert.deepEqual(r.orphans, []);
  assert.deepEqual(r.badAliases, []);
  assert.deepEqual(r.badNotes, []);
});

test("هر تب پایش فقط از یک ردیف دیدنی باز می‌شود (بدون ردیف تکراری)", () => {
  assert.deepEqual(performanceNavReport().sharedTabs, {});
});

test("همهٔ تب‌های MonitorTab از سایدبار قابل‌دسترسی‌اند (چهار تب پنهان دیگر پنهان نیستند)", () => {
  const m = src("components/MonitoringWorkspace.tsx").match(/export type MonitorTab = ([^;]+);/);
  const all = [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
  assert.equal(all.length, 15);
  const reached = new Set(performanceNavReport().visible.map((id) => D3_TAB_BY_SUB[id]));
  assert.deepEqual(all.filter((t) => !reached.has(t)), []);
  for (const id of ["d3-p6-builder", "d3-p6-drill", "d3-p6-ai", "d3-p2-trend"]) {
    assert.ok(performanceNavReport().visible.includes(id), id);
  }
});

test("لینک‌های قدیمی (مستعار) هنوز به همان تب می‌رسند", () => {
  assert.equal(d3TabForSub("d3-p4-ews"), "ews");
  assert.equal(d3TabForSub("d3-p6-exec"), "exec");
  assert.equal(d3TabForSub("d3-p6-s1"), "exec");
  assert.equal(d3TabForSub("d3-p6-dash"), "dash");
  assert.equal(d3TabForSub("nope"), undefined);
  assert.equal(d3TabForSub(undefined), undefined);
  for (const alias of Object.keys(D3_ALIAS_SUBS)) {
    assert.ok(!Object.values(D3_PAGE_SUBS).flat().some((s) => s.id === alias), `${alias} نباید ردیف سایدبار باشد`);
  }
});

test("MonitoringWorkspace و ModuleDetail نگاشت جدا ندارند و از یک منبع می‌خوانند", () => {
  const mw = src("components/MonitoringWorkspace.tsx");
  assert.match(mw, /const SUB: Record<string,MonitorTab> = D3_TAB_BY_SUB;/);
  const md = src("components/ModuleDetail.tsx");
  assert.ok(!md.includes("const D3_TAB_BY_SUB"));
  assert.ok(!md.includes("const D3_PAGE_SUBS"));
  assert.match(md, /from "\.\.\/services\/performanceNav"/);
});

test("یادداشت دامنه: PHI «پیاده‌سازی نشده»؛ KPI/انحراف/اکشن‌پلن/پیش‌بینی «محدود»", () => {
  assert.equal(d3ScopeNote("d3-p1-phi").level, "missing");
  for (const id of ["d3-p1-s1", "d3-p3-s1", "d3-p5-s1", "d3-p2-fc"]) assert.equal(d3ScopeNote(id).level, "limited", id);
  assert.equal(d3ScopeNote("d3-p2-s1"), undefined);
  for (const n of Object.values(D3_SCOPE_NOTES)) {
    assert.match(n.fa, /پیاده‌سازی نشده/);
    assert.ok(!n.fa.includes("به‌زودی"));
  }
});

test("رنگ‌بندی شاخص‌ها با آستانهٔ قاعدهٔ هشدار سرور یکی است", () => {
  assert.equal(indexTone("spi", 0.94), "alert");
  assert.equal(indexTone("spi", 0.95), "ok");
  assert.equal(indexTone("cpi", 0.99), "alert");
  assert.equal(indexTone("cpi", 1), "ok");
  assert.equal(indexTone("spi", null), "unknown");
  assert.equal(indexTone("cpi", undefined), "unknown");
  assert.equal(indexTone("spi", NaN), "unknown");
  /* همان ثابت‌ها در قاعدهٔ هشدار سرور استفاده می‌شوند، نه عدد خام. */
  const ws = src("services/monitoringWorkspace.ts");
  assert.match(ws, /spi < SPI_ALERT_THRESHOLD/);
  assert.match(ws, /cpi < CPI_ALERT_THRESHOLD/);
});

test("انحراف و پیشرفت: نامعلوم هرگز صفر نمی‌شود", () => {
  assert.equal(varianceTone(-1), "alert");
  assert.equal(varianceTone(0), "ok");
  assert.equal(varianceTone(null), "unknown");
  assert.equal(earnedProgress(50, 200), 0.25);
  assert.equal(earnedProgress(50, 0), null);
  assert.equal(earnedProgress(null, 200), null);
  assert.equal(earnedProgress(50, undefined), null);
});

test("ردیف‌های روند انحراف: مرتب قدیم←جدید، بی‌تاریخ کنار، usable از SV/CV", () => {
  const mk = (id, dataDate, sv, cv) => ({ id, dataDate, integrity: "verified", pv: 1, ev: 1, ac: 1, bac: 1, spi: 1, cpi: 1, sv, cv });
  const rows = varianceRows([mk("b", "2026-02-01", -1, 2), mk("x", null, 0, 0), mk("a", "2026-01-01", null, null)]);
  assert.deepEqual(rows.map((r) => r.id), ["a", "b"]);
  assert.deepEqual(rows.map((r) => r.usable), [false, true]);
  assert.deepEqual(varianceRows([]), []);
});
