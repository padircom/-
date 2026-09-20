/**
 * آزمون ترجمهٔ خطاهای فنی به زبان قابل فهم.
 *
 * محور: کاربر مبتدی باید بفهمد چه شده و چه کند.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  PLAIN_ERROR_VERSION,
  toPlainError,
  areaHealth,
  HEALTH_LABEL,
} from "./perrLogic.js";

test("perr: نسخهٔ موتور اعلام شده است", () => {
  assert.equal(PLAIN_ERROR_VERSION, "perr-v1");
});

/* ══════════════════ پایگاه داده ══════════════════ */

test("perr: خطای واقعی پایگاه داده ترجمه می‌شود", () => {
  /* همان چیزی که کاربر دید: getaddrinfo ENOTFOUND . */
  const p = toPlainError(new Error("getaddrinfo ENOTFOUND ."));
  assert.ok(p.titleFa.includes("پایگاه داده"));
  assert.ok(p.actionFa.includes("SQL Server"));
  assert.equal(p.needsAdmin, true);
});

test("perr: پیام فنی در هیچ حالتی گم نمی‌شود", () => {
  /* پشتیبانی به آن نیاز دارد. */
  const p = toPlainError(new Error("EINSTLOOKUP failure"));
  assert.ok(p.technical.includes("EINSTLOOKUP"));
});

test("perr: حالت‌های دیگر نرسیدن به پایگاه داده هم پوشش دارند", () => {
  for (const msg of ["ECONNREFUSED", "ETIMEDOUT", "ELOGIN failed", "Failed to connect to ."]) {
    assert.ok(toPlainError(msg).titleFa.includes("پایگاه داده"), msg);
  }
});

/* ══════════════════ تفکیک از هوش مصنوعی ══════════════════ */

test("perr: خطای سرویس هوش مصنوعی با پایگاه داده اشتباه نمی‌شود", () => {
  /* هر دو ENOTFOUND دارند؛ اگر تفکیک نشوند، کاربر سراغ چیز اشتباهی
   * می‌رود. */
  const p = toPlainError("اتصال به api.deepseek.com برقرار نشد (fetch failed)");
  assert.ok(p.titleFa.includes("هوش مصنوعی"));
  assert.ok(!p.titleFa.includes("پایگاه داده"));
});

test("perr: نبود کلید راه‌حل دقیق می‌دهد", () => {
  const p = toPlainError("E-AI-NO-SECRET");
  assert.ok(p.actionFa.includes("۵. هوش مصنوعی"));
  /* این مشکل با تنظیمات خود کاربر حل می‌شود. */
  assert.equal(p.needsAdmin, false);
});

test("perr: حالت آزمایشی از نبود کلید جدا است", () => {
  const sim = toPlainError("موتور قاعده‌محور ترجمه نمی‌کند");
  const key = toPlainError("E-AI-NO-SECRET");
  assert.notEqual(sim.titleFa, key.titleFa);
});

test("perr: نبود نشست Arena پیام خودش را دارد", () => {
  assert.ok(toPlainError("E-AI-ARENA-NO-SESSION").titleFa.includes("Arena"));
});

/* ══════════════════ فایل ══════════════════ */

test("perr: فایل اسکن‌شده راهنمای درست می‌دهد", () => {
  const p = toPlainError("NO_TEXT_FOUND: No extractable text was found.");
  assert.ok(p.actionFa.includes("اسکن"));
  assert.equal(p.needsAdmin, false);
});

/* ══════════════════ دسترسی و مسیر ══════════════════ */

test("perr: نبود مجوز به مدیر ارجاع می‌دهد", () => {
  const p = toPlainError("403 FORBIDDEN");
  assert.ok(p.titleFa.includes("اجازه"));
  assert.equal(p.needsAdmin, true);
});

test("perr: مسیر ناموجود یعنی قابلیت فعال نیست", () => {
  const p = toPlainError("Route GET /api/projects/PRJ/knowledge was not found");
  assert.ok(p.titleFa.includes("فعال نیست"));
});

/* ══════════════════ ناشناخته ══════════════════ */

test("perr: خطای ناشناخته حدس نمی‌زند", () => {
  /* حدس زدن علت بدتر از گفتن «نمی‌دانم» است. */
  const p = toPlainError("something entirely unexpected");
  assert.ok(p.titleFa.includes("کار نمی‌کند"));
  assert.equal(p.technical, "something entirely unexpected");
});

test("perr: ورودی خالی موتور را نمی‌شکند", () => {
  assert.ok(toPlainError(null).titleFa);
  assert.ok(toPlainError(undefined).titleFa);
  assert.equal(toPlainError(null).technical, "");
});

test("perr: هر پیام دو زبان دارد", () => {
  for (const raw of ["ENOTFOUND", "E-AI-NO-SECRET", "403", "unknown thing"]) {
    const p = toPlainError(raw);
    assert.ok(p.titleFa && p.titleEn, raw);
    assert.ok(p.actionFa && p.actionEn, raw);
  }
});

test("perr: پیام قابل فهم است و کد فنی را تکرار نمی‌کند", () => {
  /* عنوان نباید خودش یک کد خطای دیگر باشد. */
  const p = toPlainError("getaddrinfo ENOTFOUND .");
  assert.ok(!p.titleFa.includes("ENOTFOUND"));
  assert.ok(!p.titleFa.includes("getaddrinfo"));
});

/* ══════════════════ وضعیت بخش ══════════════════ */

test("perr: نبود خطا یعنی آماده", () => {
  assert.equal(areaHealth([]), "ready");
  assert.equal(areaHealth([null, undefined, ""]), "ready");
});

test("perr: خطای اتصال یعنی غیرفعال", () => {
  assert.equal(areaHealth(["getaddrinfo ENOTFOUND ."]), "offline");
});

test("perr: خطای جزئی یعنی با محدودیت، نه غیرفعال", () => {
  /* نشان دادن «خاموش» وقتی بخشی کار می‌کند، کاربر را از قابلیتی که
   * در دسترس است محروم می‌کند. */
  assert.equal(areaHealth(["E-AI-NO-SECRET"]), "degraded");
});

test("perr: هر وضعیت برچسب و رنگ دارد", () => {
  for (const k of ["ready", "degraded", "offline"]) {
    assert.ok(HEALTH_LABEL[k].fa);
    assert.ok(HEALTH_LABEL[k].color.startsWith("#"));
  }
});
