/**
 * مرز موجودی d5 ↔ SCM. باندل: npm run build:stksrc
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeScmStock } from "./stockSourceLogic.js";

const fin = [
  { Code: "CEM", OnHand: 100, OnOrder: 5, AvgDailyUse: 3 },
  { Code: "REB", OnHand: 40, OnOrder: null, AvgDailyUse: 1 },
  { Code: "PNT", OnHand: 7, OnOrder: 0 },
];

test("کالای دارای موجودی SCM: جمع انبارها جایگزین می‌شود و پارامترهای d5 می‌مانند", () => {
  const r = mergeScmStock(fin, [
    { MaterialCode: "CEM", OnHand: 60, OnOrder: 10 },
    { MaterialCode: "CEM", OnHand: 25, OnOrder: 0 },
  ]);
  const cem = r.stock.find((s) => s.Code === "CEM");
  assert.equal(cem.OnHand, 85);
  assert.equal(cem.OnOrder, 10);
  assert.equal(cem.AvgDailyUse, 3);
  assert.deepEqual([...r.scmManaged], ["CEM"]);
  assert.deepEqual(r.mismatches, [{ code: "CEM", finOnHand: 100, scmOnHand: 85 }]);
});

test("کالای بی‌موجودی در SCM دست‌نخورده می‌ماند", () => {
  const r = mergeScmStock(fin, [{ MaterialCode: "CEM", OnHand: 100 }]);
  assert.equal(r.stock.find((s) => s.Code === "REB").OnHand, 40);
  assert.equal(r.stock.find((s) => s.Code === "PNT").OnHand, 7);
  assert.ok(!r.scmManaged.has("REB"));
});

test("برابر بودن مقدارها اختلافی گزارش نمی‌کند و OnOrder نبود → مقدار FIN", () => {
  const r = mergeScmStock(fin, [{ MaterialCode: "CEM", OnHand: 100 }]);
  assert.deepEqual(r.mismatches, []);
  assert.equal(r.stock.find((s) => s.Code === "CEM").OnOrder, 5);
});

test("کالای فقط-SCM در scmOnly می‌آید و به stock اضافه نمی‌شود", () => {
  const r = mergeScmStock(fin, [{ MaterialCode: "ZZZ", OnHand: 3 }, { MaterialCode: "AAA", OnHand: 1 }]);
  assert.deepEqual(r.scmOnly, ["AAA", "ZZZ"]);
  assert.equal(r.stock.length, fin.length);
  assert.equal(r.scmManaged.size, 0);
});

test("ورودی خالی/نامعتبر امن است و ورودی را تغییر نمی‌دهد", () => {
  const copy = JSON.parse(JSON.stringify(fin));
  assert.deepEqual(mergeScmStock(fin, []).stock, fin);
  assert.deepEqual(mergeScmStock(fin, undefined).stock, fin);
  assert.equal(mergeScmStock(fin, [{ MaterialCode: "CEM", OnHand: "x" }]).stock[0].OnHand, 0);
  mergeScmStock(fin, [{ MaterialCode: "CEM", OnHand: 1 }]);
  assert.deepEqual(fin, copy);
});

test("CostSupplyWorkspace از mergeScmStock استفاده می‌کند و ردیف SCM را فقط‌خواندنی می‌کند", () => {
  const src = readFileSync(new URL("../src/components/CostSupplyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(src, /mergeScmStock\(ws\.stock/);
  assert.match(src, /scmManaged\.has\(s\.row\.Code\)/);
});
