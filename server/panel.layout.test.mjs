/**
 * آزمون موتور چیدمان پنل‌ها.
 *
 * تمرکز روی چیزهایی است که بی‌صدا خراب می‌شوند: قفلی که کار نکند،
 * پنلی که با نسخهٔ تازه ناپدید شود، و حافظهٔ محلی خرابی که صفحه را
 * بالا نیاورد.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  LAYOUT_VERSION,
  WIDTH_ORDER,
  WIDTH_PCT,
  widthClass,
  defaultLayout,
  reconcile,
  ordered,
  movePanel,
  reorderTo,
  cycleWidth,
  setWidth,
  toggleHidden,
  setLocked,
  toggleLock,
  layoutStorageKey,
  loadLayout,
  saveLayout,
  clearLayout,
  summarize,
  MIN_PCT,
  MAX_PCT,
  clampPct,
  nearestWidth,
  effectivePct,
  setPct,
  clearPct,
} from "./layLogic.js";

const DEFS = [
  { id: "upload", titleFa: "بارگذاری", titleEn: "Upload", defaultWidth: "full" },
  { id: "extract", titleFa: "استخراج", titleEn: "Extract", required: true, defaultWidth: "full" },
  { id: "tree", titleFa: "درخت", titleEn: "Tree", defaultWidth: "full" },
  { id: "engine", titleFa: "موتور AI", titleEn: "AI engine", defaultWidth: "full" },
];

/** حافظهٔ ساختگی تا آزمون به مرورگر نیاز نداشته باشد. */
function memStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const unlocked = (defs = DEFS) => setLocked(defaultLayout(defs), false);

test("lay: نسخهٔ موتور اعلام شده است", () => {
  assert.equal(LAYOUT_VERSION, "lay-v1");
});

/* ══════════════════ پیش‌فرض ══════════════════ */

test("lay: چیدمان پیش‌فرض قفل است", () => {
  /* کاربری که چیدمان را تنظیم کرده، نباید با یک کشیدن تصادفی همه را
   * به هم بریزد. */
  assert.equal(defaultLayout(DEFS).locked, true);
});

test("lay: هر پنل در چیدمان پیش‌فرض هست", () => {
  const l = defaultLayout(DEFS);
  assert.equal(l.panels.length, DEFS.length);
  assert.deepEqual(l.panels.map((p) => p.id), DEFS.map((d) => d.id));
});

test("lay: ترتیب پیش‌فرض همان ترتیب تعریف است", () => {
  const l = defaultLayout(DEFS);
  assert.deepEqual(ordered(l).map((p) => p.id), ["upload", "extract", "tree", "engine"]);
});

test("lay: پهنای پیش‌فرض از تعریف می‌آید", () => {
  const l = defaultLayout([{ id: "a", titleFa: "الف", titleEn: "A", defaultWidth: "half" }]);
  assert.equal(l.panels[0].width, "half");
});

test("lay: نبود پهنای پیش‌فرض به تمام‌عرض می‌افتد", () => {
  const l = defaultLayout([{ id: "a", titleFa: "الف", titleEn: "A" }]);
  assert.equal(l.panels[0].width, "full");
});

/* ══════════════════ قفل ══════════════════ */

test("lay: در حالت قفل، جابه‌جایی طولی اثر ندارد", () => {
  const locked = defaultLayout(DEFS);
  const after = movePanel(locked, "tree", -1);
  assert.deepEqual(ordered(after).map((p) => p.id), ordered(locked).map((p) => p.id));
});

test("lay: در حالت قفل، تغییر عرض اثر ندارد", () => {
  const locked = defaultLayout(DEFS);
  assert.equal(cycleWidth(locked, "upload").panels[0].width, locked.panels[0].width);
  assert.equal(setWidth(locked, "upload", "half").panels[0].width, "full");
});

test("lay: در حالت قفل، پنهان‌سازی اثر ندارد", () => {
  const locked = defaultLayout(DEFS);
  const after = toggleHidden(locked, "upload", DEFS);
  assert.equal(after.panels.find((p) => p.id === "upload").hidden, false);
});

test("lay: در حالت قفل، کشیدن و رها کردن اثر ندارد", () => {
  const locked = defaultLayout(DEFS);
  const after = reorderTo(locked, "engine", "upload");
  assert.deepEqual(ordered(after).map((p) => p.id), ordered(locked).map((p) => p.id));
});

test("lay: قفل باز و بسته می‌شود", () => {
  const l = defaultLayout(DEFS);
  assert.equal(toggleLock(l).locked, false);
  assert.equal(toggleLock(toggleLock(l)).locked, true);
  assert.equal(setLocked(l, false).locked, false);
});

/* ══════════════════ جابه‌جایی طولی ══════════════════ */

test("lay: پنل به بالا جابه‌جا می‌شود", () => {
  const after = movePanel(unlocked(), "tree", -1);
  assert.deepEqual(ordered(after).map((p) => p.id), ["upload", "tree", "extract", "engine"]);
});

test("lay: پنل به پایین جابه‌جا می‌شود", () => {
  const after = movePanel(unlocked(), "upload", 1);
  assert.deepEqual(ordered(after).map((p) => p.id), ["extract", "upload", "tree", "engine"]);
});

test("lay: پنل نخست بالاتر نمی‌رود", () => {
  const l = unlocked();
  assert.deepEqual(ordered(movePanel(l, "upload", -1)).map((p) => p.id), ordered(l).map((p) => p.id));
});

test("lay: پنل آخر پایین‌تر نمی‌رود", () => {
  const l = unlocked();
  assert.deepEqual(ordered(movePanel(l, "engine", 1)).map((p) => p.id), ordered(l).map((p) => p.id));
});

test("lay: پنل ناشناخته چیدمان را خراب نمی‌کند", () => {
  const l = unlocked();
  assert.deepEqual(ordered(movePanel(l, "ghost", 1)).map((p) => p.id), ordered(l).map((p) => p.id));
});

test("lay: پنل پنهان در جابه‌جایی شمرده نمی‌شود", () => {
  /* اگر شمرده شود، کاربر دکمه را می‌زند و هیچ تغییری نمی‌بیند چون
   * پنل با یک پنلِ نامرئی جا عوض کرده است. */
  let l = unlocked();
  l = toggleHidden(l, "tree", DEFS);
  const after = movePanel(l, "engine", -1);
  const vis = ordered(after).filter((p) => !p.hidden).map((p) => p.id);
  assert.deepEqual(vis, ["upload", "engine", "extract"]);
});

test("lay: ترتیب پس از جابه‌جایی پیوسته می‌ماند", () => {
  /* شکاف در شماره‌ها بعداً مقایسه‌ها را غیرقابل‌پیش‌بینی می‌کند. */
  const after = movePanel(unlocked(), "tree", -1);
  assert.deepEqual(ordered(after).map((p) => p.order), [0, 1, 2, 3]);
});

/* ══════════════════ کشیدن و رها کردن ══════════════════ */

test("lay: پنل به جای پنل دیگر منتقل می‌شود", () => {
  const after = reorderTo(unlocked(), "engine", "upload");
  assert.deepEqual(ordered(after).map((p) => p.id), ["engine", "upload", "extract", "tree"]);
});

test("lay: انتقال به خود بی‌اثر است", () => {
  const l = unlocked();
  assert.deepEqual(ordered(reorderTo(l, "tree", "tree")).map((p) => p.id), ordered(l).map((p) => p.id));
});

test("lay: انتقال به پنل ناموجود بی‌اثر است", () => {
  const l = unlocked();
  assert.deepEqual(ordered(reorderTo(l, "tree", "ghost")).map((p) => p.id), ordered(l).map((p) => p.id));
});

/* ══════════════════ جابه‌جایی عرضی ══════════════════ */

test("lay: چهار حالت عرض تعریف شده است", () => {
  assert.deepEqual(WIDTH_ORDER, ["third", "half", "two-thirds", "full"]);
});

test("lay: درصد هر حالت عرض درست است", () => {
  assert.equal(WIDTH_PCT.half, 50);
  assert.equal(WIDTH_PCT.full, 100);
  assert.ok(Math.abs(WIDTH_PCT.third - 33.333) < 0.01);
});

test("lay: عرض در حلقه می‌چرخد", () => {
  /* حلقه‌ای است تا کاربر برای برگشت از «تمام» دکمهٔ دیگری نخواهد. */
  let l = setWidth(unlocked(), "upload", "third");
  const seen = [];
  for (let i = 0; i < 5; i += 1) {
    seen.push(l.panels.find((p) => p.id === "upload").width);
    l = cycleWidth(l, "upload");
  }
  assert.deepEqual(seen, ["third", "half", "two-thirds", "full", "third"]);
});

test("lay: چرخش معکوس هم کار می‌کند", () => {
  const l = setWidth(unlocked(), "upload", "third");
  assert.equal(cycleWidth(l, "upload", -1).panels.find((p) => p.id === "upload").width, "full");
});

test("lay: تغییر عرض یک پنل بقیه را دست نمی‌زند", () => {
  const after = setWidth(unlocked(), "upload", "half");
  assert.equal(after.panels.find((p) => p.id === "tree").width, "full");
});

test("lay: هر حالت عرض کلاس متمایز دارد", () => {
  const classes = WIDTH_ORDER.map(widthClass);
  assert.equal(new Set(classes).size, WIDTH_ORDER.length);
});

/* ══════════════════ پهنای دستی ══════════════════ */

test("lay: درصد پهنا در بازهٔ مجاز مهار می‌شود", () => {
  /* زیر بیست درصد کارت آن‌قدر باریک می‌شود که کاربر حتی لبه‌اش را
   * پیدا نمی‌کند — یعنی کارت عملاً گم می‌شود. */
  assert.equal(clampPct(5), MIN_PCT);
  assert.equal(clampPct(250), MAX_PCT);
  assert.equal(clampPct(47.26), 47.3);
});

test("lay: درصد نامعتبر به تمام‌عرض می‌افتد", () => {
  assert.equal(clampPct(NaN), MAX_PCT);
  assert.equal(clampPct(Infinity), MAX_PCT);
});

test("lay: نزدیک‌ترین حالت نام‌دار درست انتخاب می‌شود", () => {
  assert.equal(nearestWidth(34), "third");
  assert.equal(nearestWidth(51), "half");
  assert.equal(nearestWidth(65), "two-thirds");
  assert.equal(nearestWidth(96), "full");
});

test("lay: کشیدن لبه پهنا را تنظیم می‌کند", () => {
  const after = setPct(unlocked(), "upload", 42);
  const p = after.panels.find((x) => x.id === "upload");
  assert.equal(p.pct, 42);
});

test("lay: پهنای دستی حالت نام‌دار را هم به‌روز می‌کند", () => {
  /* تا اگر کاربر بعداً درصد را رها کرد، چیدمان به حالتی معقول برگردد
   * نه به پهنای بی‌ربط قبلی. */
  const after = setPct(unlocked(), "upload", 49);
  assert.equal(after.panels.find((x) => x.id === "upload").width, "half");
});

test("lay: پهنای دستی بر حالت نام‌دار مقدم است", () => {
  const after = setPct(unlocked(), "upload", 37);
  assert.equal(effectivePct(after.panels.find((x) => x.id === "upload")), 37);
});

test("lay: نبود پهنای دستی یعنی حالت نام‌دار حاکم است", () => {
  assert.equal(effectivePct({ width: "half" }), 50);
});

test("lay: انتخاب حالت نام‌دار، پهنای دستی را کنار می‌گذارد", () => {
  /* وگرنه کاربر روی «نصف» می‌زند و هیچ تغییری نمی‌بیند. */
  let l = setPct(unlocked(), "upload", 88);
  l = setWidth(l, "upload", "half");
  const p = l.panels.find((x) => x.id === "upload");
  assert.equal(p.pct, undefined);
  assert.equal(effectivePct(p), 50);
});

test("lay: رها کردن پهنای دستی ممکن است", () => {
  let l = setPct(unlocked(), "upload", 71);
  l = clearPct(l, "upload");
  assert.equal(l.panels.find((x) => x.id === "upload").pct, undefined);
});

test("lay: در حالت قفل، کشیدن لبه اثر ندارد", () => {
  const locked = defaultLayout(DEFS);
  assert.equal(setPct(locked, "upload", 30).panels.find((x) => x.id === "upload").pct, undefined);
});

test("lay: پهنای دستی ذخیره و بازخوانی می‌شود", () => {
  const store = memStore();
  saveLayout("ws", setPct(unlocked(), "upload", 38), store);
  assert.equal(loadLayout("ws", DEFS, store).panels.find((x) => x.id === "upload").pct, 38);
});

test("lay: پهنای دستی خارج از بازه هنگام بازخوانی مهار می‌شود", () => {
  const store = memStore({
    [layoutStorageKey("ws")]: JSON.stringify({
      version: LAYOUT_VERSION,
      locked: false,
      panels: [{ id: "upload", order: 0, width: "full", pct: 900 }],
    }),
  });
  assert.equal(loadLayout("ws", DEFS, store).panels.find((x) => x.id === "upload").pct, MAX_PCT);
});

test("lay: شمارش ردیف از پهنای دستی پیروی می‌کند", () => {
  let l = unlocked();
  l = setPct(l, "upload", 50);
  l = setPct(l, "extract", 50);
  l = toggleHidden(l, "tree", DEFS);
  l = toggleHidden(l, "engine", DEFS);
  assert.equal(summarize(l).rows, 1);
});

/* ══════════════════ پنهان‌سازی ══════════════════ */

test("lay: پنل عادی پنهان و آشکار می‌شود", () => {
  let l = toggleHidden(unlocked(), "upload", DEFS);
  assert.equal(l.panels.find((p) => p.id === "upload").hidden, true);
  l = toggleHidden(l, "upload", DEFS);
  assert.equal(l.panels.find((p) => p.id === "upload").hidden, false);
});

test("lay: پنل اجباری پنهان نمی‌شود", () => {
  /* وگرنه کاربر ناحیهٔ استخراج را می‌بندد و صفحه‌ای می‌بیند که هیچ
   * کاری نمی‌کند و دلیلش پیدا نیست. */
  const after = toggleHidden(unlocked(), "extract", DEFS);
  assert.equal(after.panels.find((p) => p.id === "extract").hidden, false);
});

/* ══════════════════ آشتی با نسخهٔ تازه ══════════════════ */

test("lay: پنل تازه به چیدمان ذخیره‌شده افزوده می‌شود", () => {
  /* بدون این، هر قابلیت تازه برای کاربران قدیمی نامرئی می‌ماند. */
  const saved = {
    version: LAYOUT_VERSION,
    locked: true,
    panels: [
      { id: "upload", order: 0, width: "full" },
      { id: "extract", order: 1, width: "full" },
    ],
  };
  const l = reconcile(saved, DEFS);
  assert.equal(l.panels.length, 4);
  assert.ok(l.panels.some((p) => p.id === "tree"));
});

test("lay: پنل تازه به انتها می‌رود نه وسط", () => {
  const saved = {
    version: LAYOUT_VERSION,
    locked: false,
    panels: [
      { id: "engine", order: 0, width: "full" },
      { id: "upload", order: 1, width: "full" },
    ],
  };
  const ids = ordered(reconcile(saved, DEFS)).map((p) => p.id);
  assert.equal(ids[0], "engine");
  assert.equal(ids[1], "upload");
  assert.deepEqual(ids.slice(2).sort(), ["extract", "tree"]);
});

test("lay: پنل حذف‌شده از کد کنار گذاشته می‌شود", () => {
  const saved = {
    version: LAYOUT_VERSION,
    locked: true,
    panels: [{ id: "obsolete", order: 0, width: "full" }, { id: "upload", order: 1, width: "half" }],
  };
  const l = reconcile(saved, DEFS);
  assert.ok(!l.panels.some((p) => p.id === "obsolete"));
});

test("lay: عرض ذخیره‌شده حفظ می‌شود", () => {
  const saved = { version: LAYOUT_VERSION, locked: true, panels: [{ id: "upload", order: 0, width: "half" }] };
  assert.equal(reconcile(saved, DEFS).panels.find((p) => p.id === "upload").width, "half");
});

test("lay: عرض نامعتبر به پیش‌فرض می‌افتد", () => {
  const saved = { version: LAYOUT_VERSION, locked: true, panels: [{ id: "upload", order: 0, width: "enormous" }] };
  assert.equal(reconcile(saved, DEFS).panels.find((p) => p.id === "upload").width, "full");
});

test("lay: پنل اجباریِ پنهان‌شده در ذخیره، آشکار برمی‌گردد", () => {
  const saved = { version: LAYOUT_VERSION, locked: true, panels: [{ id: "extract", order: 0, width: "full", hidden: true }] };
  assert.equal(reconcile(saved, DEFS).panels.find((p) => p.id === "extract").hidden, false);
});

test("lay: ورودی بی‌معنا به پیش‌فرض می‌افتد", () => {
  for (const bad of [null, undefined, 42, "x", []]) {
    const l = reconcile(bad, DEFS);
    assert.equal(l.panels.length, DEFS.length);
  }
});

/* ══════════════════ ذخیره‌سازی ══════════════════ */

test("lay: کلید ذخیره به دامنه وابسته است", () => {
  assert.notEqual(layoutStorageKey("workshop"), layoutStorageKey("planning"));
});

test("lay: چیدمان ذخیره و بازخوانی می‌شود", () => {
  const store = memStore();
  const l = setWidth(unlocked(), "upload", "half");
  assert.equal(saveLayout("ws", l, store), true);
  const back = loadLayout("ws", DEFS, store);
  assert.equal(back.panels.find((p) => p.id === "upload").width, "half");
  assert.equal(back.locked, false);
});

test("lay: نبود ذخیره به پیش‌فرض می‌افتد", () => {
  assert.equal(loadLayout("empty", DEFS, memStore()).locked, true);
});

test("lay: JSON خراب صفحه را نمی‌شکند", () => {
  /* صفحه‌ای که به‌خاطر یک رشتهٔ خراب بالا نیاید، بدترین نوع شکست است. */
  const store = memStore({ [layoutStorageKey("ws")]: "{not json" });
  const l = loadLayout("ws", DEFS, store);
  assert.equal(l.panels.length, DEFS.length);
  assert.equal(l.locked, true);
});

test("lay: حافظهٔ ممنوع کار را متوقف نمی‌کند", () => {
  /* حالت ناشناس مرورگر: نوشتن پرتاب می‌کند. */
  const hostile = {
    getItem: () => { throw new Error("denied"); },
    setItem: () => { throw new Error("denied"); },
    removeItem: () => { throw new Error("denied"); },
  };
  assert.equal(loadLayout("ws", DEFS, hostile).panels.length, DEFS.length);
  assert.equal(saveLayout("ws", defaultLayout(DEFS), hostile), false);
  clearLayout("ws", hostile);
});

test("lay: پاک کردن چیدمان به پیش‌فرض برمی‌گرداند", () => {
  const store = memStore();
  saveLayout("ws", setWidth(unlocked(), "upload", "third"), store);
  clearLayout("ws", store);
  assert.equal(loadLayout("ws", DEFS, store).panels.find((p) => p.id === "upload").width, "full");
});

/* ══════════════════ خلاصه ══════════════════ */

test("lay: چهار پنل تمام‌عرض چهار ردیف می‌شود", () => {
  assert.equal(summarize(defaultLayout(DEFS)).rows, 4);
});

test("lay: دو پنل نصف‌عرض یک ردیف می‌شود", () => {
  let l = unlocked();
  l = setWidth(l, "upload", "half");
  l = setWidth(l, "extract", "half");
  l = toggleHidden(l, "tree", DEFS);
  l = toggleHidden(l, "engine", DEFS);
  assert.equal(summarize(l).rows, 1);
});

test("lay: سه پنل یک‌سوم یک ردیف می‌شود", () => {
  /* جمع ۹۹٫۹۹۹ نباید به ردیف دوم سرریز کند. */
  const defs = ["a", "b", "c"].map((id) => ({ id, titleFa: id, titleEn: id, defaultWidth: "third" }));
  assert.equal(summarize(defaultLayout(defs)).rows, 1);
});

test("lay: خلاصه پنهان‌ها را جدا می‌شمارد", () => {
  const l = toggleHidden(unlocked(), "upload", DEFS);
  const s = summarize(l);
  assert.equal(s.visible, 3);
  assert.equal(s.hidden, 1);
});

test("lay: چیدمان خالی صفر ردیف است", () => {
  assert.equal(summarize({ version: LAYOUT_VERSION, locked: true, panels: [] }).rows, 0);
});
