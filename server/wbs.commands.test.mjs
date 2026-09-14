/**
 * آزمون فرمان‌های گفت‌وگویی روی درخت ساختار شکست.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  WBS_CMD_VERSION,
  parseCommand,
  descendantsOf,
  pruneDepth,
  dropBranch,
  renameNode,
  renumber,
  applyCommand,
  COMMAND_HINTS,
  HISTORY_LIMIT,
  pushHistory,
  undo,
} from "./wcmdLogic.js";

const TREE = [
  { code: "E", parentCode: null, titleFa: "مهندسی", depth: 1 },
  { code: "E.1", parentCode: "E", titleFa: "پایه", depth: 2 },
  { code: "E.1.1", parentCode: "E.1", titleFa: "مطالعات", depth: 3 },
  { code: "E.1.1.1", parentCode: "E.1.1", titleFa: "بازدید", depth: 4 },
  { code: "P", parentCode: null, titleFa: "تدارکات", depth: 1 },
  { code: "P.1", parentCode: "P", titleFa: "بلندسفارش", depth: 2 },
];

test("wcmd: نسخهٔ موتور اعلام شده است", () => {
  assert.equal(WBS_CMD_VERSION, "wcmd-v1");
});

/* ══════════════════ تجزیهٔ فرمان ══════════════════ */

test("wcmd: «تا سطح ۳ نگه دار» یعنی سه سطح", () => {
  const c = parseCommand("تا سطح ۳ نگه دار");
  assert.equal(c.kind, "prune_depth");
  assert.equal(c.value, 3);
});

test("wcmd: «سطح ۴ را حذف کن» یعنی تا سه نگه دار", () => {
  /* این تفاوت یک واحدی اگر رعایت نشود، یک سطح کامل بی‌خبر قربانی
   * می‌شود. */
  const c = parseCommand("سطح ۴ را حذف کن");
  assert.equal(c.kind, "prune_depth");
  assert.equal(c.value, 3);
});

test("wcmd: عدد نوشتاری فارسی هم خوانده می‌شود", () => {
  assert.equal(parseCommand("تا سطح سه نگه دار").value, 3);
  assert.equal(parseCommand("سطح چهار را حذف کن").value, 3);
});

test("wcmd: ارقام لاتین هم کار می‌کنند", () => {
  assert.equal(parseCommand("keep to level 2").value, 2);
});

test("wcmd: حذف شاخه با کد تشخیص داده می‌شود", () => {
  const c = parseCommand("شاخهٔ P را حذف کن");
  assert.equal(c.kind, "drop_branch");
  assert.equal(c.target, "P");
});

test("wcmd: شماره‌گذاری دوباره تشخیص داده می‌شود", () => {
  assert.equal(parseCommand("دوباره شماره‌گذاری کن").kind, "renumber");
  assert.equal(parseCommand("renumber the tree").kind, "renumber");
});

test("wcmd: تغییر نام با متن داخل گیومه", () => {
  const c = parseCommand('E.1 را تغییر نام بده به «مهندسی پایه»');
  assert.equal(c.kind, "rename");
  assert.equal(c.target, "E.1");
  assert.equal(c.text, "مهندسی پایه");
});

test("wcmd: دستور مبهم به هوش مصنوعی می‌رود", () => {
  /* حدس زدن نیت و اجرای عملیات اشتباه، بدتر از سپردن کار به مدل است. */
  const c = parseCommand("تدارکات را به سه بستهٔ فرعی بشکن");
  assert.equal(c.kind, "ai");
});

test("wcmd: متن خام همیشه نگه داشته می‌شود", () => {
  assert.equal(parseCommand("  یک دستور  ").raw, "یک دستور");
});

test("wcmd: ورودی خالی موتور را نمی‌شکند", () => {
  assert.equal(parseCommand("").kind, "ai");
  assert.equal(parseCommand(null).raw, "");
});

/* ══════════════════ هرس سطح ══════════════════ */

test("wcmd: هرس سطح گره‌های عمیق را حذف می‌کند", () => {
  const r = pruneDepth(TREE, 2);
  assert.equal(r.nodes.length, 4);
  assert.ok(!r.nodes.some((n) => n.depth > 2));
  assert.equal(r.affected, 2);
});

test("wcmd: هرس بی‌اثر صریح اعلام می‌شود", () => {
  /* سکوت یعنی کاربر فکر می‌کند کار انجام شده. */
  const r = pruneDepth(TREE, 9);
  assert.equal(r.changed, false);
  assert.ok(r.messageFa.includes("هیچ"));
});

/* ══════════════════ حذف شاخه ══════════════════ */

test("wcmd: فرزندان یک گره پیدا می‌شوند", () => {
  assert.deepEqual(descendantsOf(TREE, "E"), ["E.1", "E.1.1", "E.1.1.1"]);
});

test("wcmd: حذف شاخه فرزندان را هم می‌برد", () => {
  /* وگرنه یتیم می‌مانند و درخت می‌شکند. */
  const r = dropBranch(TREE, "E");
  assert.equal(r.nodes.length, 2);
  assert.ok(r.nodes.every((n) => n.code.startsWith("P")));
  assert.equal(r.affected, 4);
});

test("wcmd: حذف برگ فقط خودش را می‌برد", () => {
  const r = dropBranch(TREE, "P.1");
  assert.equal(r.nodes.length, TREE.length - 1);
});

test("wcmd: کد ناموجود خطای روشن می‌دهد", () => {
  const r = dropBranch(TREE, "GHOST");
  assert.equal(r.changed, false);
  assert.ok(r.messageFa.includes("GHOST"));
});

test("wcmd: کد بدون توجه به بزرگی حرف پیدا می‌شود", () => {
  assert.equal(dropBranch(TREE, "p").changed, true);
});

/* ══════════════════ تغییر نام ══════════════════ */

test("wcmd: عنوان گره عوض می‌شود", () => {
  const r = renameNode(TREE, "E.1", "مهندسی پایه و FEED");
  assert.equal(r.nodes.find((n) => n.code === "E.1").titleFa, "مهندسی پایه و FEED");
  assert.equal(r.affected, 1);
});

test("wcmd: تغییر نام گره ناموجود بی‌صدا نیست", () => {
  const r = renameNode(TREE, "GHOST", "x");
  assert.equal(r.changed, false);
});

/* ══════════════════ شماره‌گذاری دوباره ══════════════════ */

test("wcmd: شماره‌گذاری سلسله‌مراتبی است", () => {
  const r = renumber(TREE);
  const codes = r.nodes.map((n) => n.code);
  assert.ok(codes.includes("1"));
  assert.ok(codes.includes("1-1"));
  assert.ok(codes.includes("1-1-1"));
  assert.ok(codes.includes("2"));
});

test("wcmd: والدها پس از شماره‌گذاری درست می‌مانند", () => {
  const r = renumber(TREE);
  const child = r.nodes.find((n) => n.code === "1-1");
  assert.equal(child.parentCode, "1");
});

test("wcmd: ارجاع به بند قرارداد دست‌نخورده می‌ماند", () => {
  /* آن سند حقوقی است و با تغییر شمارهٔ داخلی ما عوض نمی‌شود. */
  const withRef = [{ code: "E", parentCode: null, titleFa: "مهندسی", depth: 1, sourceRefFa: "ص ۵ / بند ۲-۱" }];
  const r = renumber(withRef);
  assert.equal(r.nodes[0].sourceRefFa, "ص ۵ / بند ۲-۱");
});

test("wcmd: حلقهٔ والد گره‌ها را حذف نمی‌کند", () => {
  const loop = [
    { code: "A", parentCode: "B", titleFa: "الف", depth: 1 },
    { code: "B", parentCode: "A", titleFa: "ب", depth: 1 },
  ];
  assert.equal(renumber(loop).nodes.length, 2);
});

test("wcmd: درخت خالی شماره‌گذاری نمی‌شود", () => {
  const r = renumber([]);
  assert.equal(r.changed, false);
});

/* ══════════════════ اجرای یکپارچه ══════════════════ */

test("wcmd: زنجیرهٔ فرمان از متن تا نتیجه", () => {
  const cmd = parseCommand("تا سطح ۲ نگه دار");
  const r = applyCommand(TREE, cmd);
  assert.equal(r.nodes.length, 4);
  assert.equal(r.changed, true);
});

test("wcmd: فرمان AI درخت را دست نمی‌زند", () => {
  /* اجرای آن کار فراخواننده است؛ جدا نگه داشتنشان یعنی مسیر
   * قاعده‌محور بدون شبکه آزمون‌پذیر می‌ماند. */
  const r = applyCommand(TREE, parseCommand("یک چیز عجیب بساز"));
  assert.equal(r.changed, false);
  assert.equal(r.nodes.length, TREE.length);
});

test("wcmd: نمونه‌فرمان‌ها دوزبانه‌اند", () => {
  assert.ok(COMMAND_HINTS.length >= 3);
  for (const h of COMMAND_HINTS) assert.ok(h.fa && h.en);
});

/* ══════════════════ تاریخچه و بازگشت ══════════════════ */

const entry = (cmd, before) => ({ command: cmd, messageFa: "x", at: "2026-09-12", before });

test("wcmd: بازگشت وضعیت پیشین را برمی‌گرداند", () => {
  /* AI گاهی درخت را بدتر می‌کند؛ بدون بازگشت، یک دستور اشتباه کل کار
   * را می‌سوزاند. */
  const hist = pushHistory([], entry("prune", TREE));
  const { nodes, history } = undo(hist);
  assert.equal(nodes.length, TREE.length);
  assert.equal(history.length, 0);
});

test("wcmd: بازگشت روی تاریخچهٔ خالی امن است", () => {
  const { nodes } = undo([]);
  assert.equal(nodes, null);
});

test("wcmd: تاریخچه سقف دارد", () => {
  /* نگه داشتن بی‌نهایت وضعیت درخت، حافظه را می‌خورد. */
  let hist = [];
  for (let i = 0; i < HISTORY_LIMIT + 8; i += 1) hist = pushHistory(hist, entry(`c${i}`, TREE));
  assert.equal(hist.length, HISTORY_LIMIT);
  assert.equal(hist[hist.length - 1].command, `c${HISTORY_LIMIT + 7}`);
});
