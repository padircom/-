/**
 * آزمون ماندگاری نشست کارگاه.
 *
 * محور: کاری که کاربر انجام داده نباید با ترک ماژول از بین برود.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_VERSION,
  MAX_STORED_TEXT,
  emptySession,
  sessionKey,
  sanitiseSession,
  loadSession,
  saveSession,
  clearSession,
  formatBytes,
  summarise,
} from "./wsessLogic.js";

function memStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const sample = () => ({
  ...emptySession(),
  fileName: "Agreement.pdf",
  fileSize: 245_000,
  loadedAt: "2026-09-12T10:00:00.000Z",
  rawText: "Article 1 - Definitions",
  translated: "ماده ۱ — تعاریف",
  nodes: [{ code: "1", parentCode: null, titleFa: "مهندسی", depth: 1 }],
});

test("wsess: نسخهٔ نشست اعلام شده است", () => {
  assert.equal(SESSION_VERSION, "wsess-v1");
});

/* ══════════════════ دوام پس از ترک ماژول ══════════════════ */

test("wsess: فایل پس از ذخیره و بارگذاری دوباره باقی می‌ماند", () => {
  /* همان سناریوی کاربر: بارگذاری، خروج از ماژول، بازگشت. */
  const store = memStore();
  saveSession("PRJ", sample(), store);
  const back = loadSession("PRJ", store);
  assert.equal(back.fileName, "Agreement.pdf");
  assert.equal(back.rawText, "Article 1 - Definitions");
  assert.equal(back.translated, "ماده ۱ — تعاریف");
  assert.equal(back.nodes.length, 1);
});

test("wsess: درخت استخراج‌شده هم باقی می‌ماند", () => {
  const store = memStore();
  const s = { ...sample(), nodes: [
    { code: "1", parentCode: null, titleFa: "مهندسی", depth: 1, sourceRefFa: "ص ۳ / بند ۲" },
    { code: "1-1", parentCode: "1", titleFa: "پایه", depth: 2 },
  ] };
  saveSession("PRJ", s, store);
  const back = loadSession("PRJ", store);
  assert.equal(back.nodes.length, 2);
  assert.equal(back.nodes[0].sourceRefFa, "ص ۳ / بند ۲");
  assert.equal(back.nodes[1].parentCode, "1");
});

test("wsess: نشست نبود، خالی برمی‌گردد نه خطا", () => {
  assert.equal(loadSession("NEW", memStore()).fileName, "");
});

/* ══════════════════ جدایی پروژه‌ها ══════════════════ */

test("wsess: کلید هر پروژه جداست", () => {
  /* نشت سند یک پروژه به پروژهٔ دیگر در محیط پیمانکاری فاجعه است. */
  assert.notEqual(sessionKey("PRJ-A"), sessionKey("PRJ-B"));
});

test("wsess: دو پروژه قرارداد هم را نمی‌بینند", () => {
  const store = memStore();
  saveSession("A", { ...sample(), fileName: "A.pdf" }, store);
  saveSession("B", { ...sample(), fileName: "B.pdf" }, store);
  assert.equal(loadSession("A", store).fileName, "A.pdf");
  assert.equal(loadSession("B", store).fileName, "B.pdf");
});

test("wsess: کد پروژهٔ خالی به کلید پیش‌فرض می‌افتد", () => {
  assert.equal(sessionKey(""), sessionKey("default"));
  assert.equal(sessionKey("   "), sessionKey("default"));
});

/* ══════════════════ پاک‌سازی داده ══════════════════ */

test("wsess: نسخهٔ ناسازگار تمیز دور ریخته می‌شود", () => {
  /* بهتر از نیمه‌خواندن و خطای عجیب در جای دیگر. */
  const s = sanitiseSession({ version: "old-v0", fileName: "x.pdf", rawText: "متن" });
  assert.equal(s.fileName, "");
});

test("wsess: گرهٔ خراب حذف می‌شود ولی بقیه می‌مانند", () => {
  /* دور ریختن کل نشست به‌خاطر یک گرهٔ خراب، همان از دست رفتن کار
   * است که می‌خواستیم جلویش را بگیریم. */
  const s = sanitiseSession({
    ...sample(),
    nodes: [
      { code: "1", titleFa: "سالم", depth: 1 },
      { titleFa: "بدون کد", depth: 1 },
      null,
      "رشته",
      { code: "2", titleFa: "سالم دوم", depth: 1 },
    ],
  });
  assert.equal(s.nodes.length, 2);
  assert.deepEqual(s.nodes.map((n) => n.code), ["1", "2"]);
});

test("wsess: ورودی بی‌معنا نشست خالی می‌دهد", () => {
  for (const bad of [null, undefined, 42, "x", []]) {
    assert.equal(sanitiseSession(bad).fileName, "");
  }
});

test("wsess: زبان نامعتبر به فارسی می‌افتد", () => {
  assert.equal(sanitiseSession({ ...sample(), targetLang: "de" }).targetLang, "fa");
});

test("wsess: عمق کمتر از یک اصلاح می‌شود", () => {
  const s = sanitiseSession({ ...sample(), nodes: [{ code: "1", titleFa: "x", depth: 0 }] });
  assert.equal(s.nodes[0].depth, 1);
});

/* ══════════════════ سقف حجم ══════════════════ */

test("wsess: متن بسیار بلند بریده می‌شود و اعلام می‌گردد", () => {
  /* حافظهٔ مرورگر سقف دارد؛ یک قرارداد ۳۰۰ صفحه‌ای می‌تواند پرش کند
   * و نوشتن‌های بعدی بی‌صدا شکست می‌خورند. */
  const store = memStore();
  const huge = { ...sample(), rawText: "x".repeat(MAX_STORED_TEXT + 5000) };
  const out = saveSession("PRJ", huge, store);
  assert.equal(out.truncated, true);
  const back = loadSession("PRJ", store);
  assert.equal(back.rawText.length, MAX_STORED_TEXT);
  assert.equal(back.textTruncated, true);
});

test("wsess: متن کوتاه بریده نمی‌شود", () => {
  const store = memStore();
  const out = saveSession("PRJ", sample(), store);
  assert.equal(out.truncated, false);
  assert.equal(loadSession("PRJ", store).textTruncated, false);
});

test("wsess: حافظهٔ پر، ساختار را نگه می‌دارد و متن را رها می‌کند", () => {
  /* متن را می‌شود دوباره از فایل گرفت؛ درخت ویرایش‌شده را نه. */
  let calls = 0;
  const tight = {
    getItem: () => null,
    setItem: (_k, v) => {
      calls += 1;
      if (calls === 1) throw new Error("QuotaExceededError");
      tight._last = v;
    },
    removeItem: () => {},
    _last: null,
  };
  const out = saveSession("PRJ", sample(), tight);
  assert.equal(out.ok, true);
  assert.ok(out.reasonFa.includes("حافظه پر"));
  const stored = JSON.parse(tight._last);
  assert.equal(stored.rawText, "");
  assert.equal(stored.nodes.length, 1);
});

test("wsess: حافظهٔ ممنوع کار را متوقف نمی‌کند", () => {
  const hostile = {
    getItem: () => { throw new Error("denied"); },
    setItem: () => { throw new Error("denied"); },
    removeItem: () => { throw new Error("denied"); },
  };
  assert.equal(loadSession("PRJ", hostile).fileName, "");
  const out = saveSession("PRJ", sample(), hostile);
  assert.equal(out.ok, false);
  assert.ok(out.reasonFa);
  clearSession("PRJ", hostile);
});

test("wsess: JSON خراب صفحه را نمی‌شکند", () => {
  const store = memStore({ [sessionKey("PRJ")]: "{broken" });
  assert.equal(loadSession("PRJ", store).fileName, "");
});

/* ══════════════════ حذف ══════════════════ */

test("wsess: حذف نشست، فایل را پاک می‌کند", () => {
  const store = memStore();
  saveSession("PRJ", sample(), store);
  clearSession("PRJ", store);
  assert.equal(loadSession("PRJ", store).fileName, "");
});

test("wsess: حذف یک پروژه به دیگری کاری ندارد", () => {
  const store = memStore();
  saveSession("A", { ...sample(), fileName: "A.pdf" }, store);
  saveSession("B", { ...sample(), fileName: "B.pdf" }, store);
  clearSession("A", store);
  assert.equal(loadSession("A", store).fileName, "");
  assert.equal(loadSession("B", store).fileName, "B.pdf");
});

/* ══════════════════ خلاصهٔ نمایش ══════════════════ */

test("wsess: اندازهٔ فایل خوانا می‌شود", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.00 MB");
});

test("wsess: اندازهٔ نامعتبر خط تیره می‌دهد نه NaN", () => {
  assert.equal(formatBytes(NaN), "—");
  assert.equal(formatBytes(-5), "—");
});

test("wsess: خلاصه وضعیت کامل را می‌دهد", () => {
  const s = summarise(sample(), "en");
  assert.equal(s.hasFile, true);
  assert.equal(s.fileName, "Agreement.pdf");
  assert.equal(s.nodeCount, 1);
  assert.equal(s.hasTranslation, true);
  assert.ok(s.sizeLabel.includes("KB"));
});

test("wsess: نشست خالی، نبودِ فایل را اعلام می‌کند", () => {
  const s = summarise(emptySession());
  assert.equal(s.hasFile, false);
  assert.equal(s.nodeCount, 0);
  assert.equal(s.hasTranslation, false);
});

test("wsess: تاریخ نامعتبر خط تیره می‌دهد نه Invalid Date", () => {
  const s = summarise({ ...sample(), loadedAt: "not-a-date" });
  assert.equal(s.loadedLabel, "—");
});

test("wsess: ترجمهٔ فقط فاصله، ترجمه حساب نمی‌شود", () => {
  assert.equal(summarise({ ...sample(), translated: "   " }).hasTranslation, false);
});
